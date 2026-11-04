---
id: gpu-inference-scheduling
title: GPU 推論排程與批次
kind: technique
codes:
  - L21302
aliases:
  - Dynamic Batching
  - GPU 排程
summary: 用時間軸分辨 GPU 閒置與等待，讓批次兼顧吞吐及回應時限
goals:
  - id: g1
    text: 由 kernel 閒置與請求延遲判斷排程及批次問題
guide_refs:
  - guide-1:3-58
  - guide-1:3-81
formula_groups:
  - id: schedule-window
    source: https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html#metrics
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同 24 請求，單筆排程 288 ms 完成，四筆合批 120 ms 完成。觀測範圍只有後端，哪個比較正確？
    options:
      A: 吞吐約由 83.33 變 200 req/s，仍須檢查逐筆端到端延遲
      B: 吞吐約由 83.33 變 200 ms，表示每一筆請求都變快一倍
      C: 吞吐約由 288 變 120 req/s，表示所有請求等待都歸零
      D: 吞吐約由 288 變 120 ms，無需再檢查傳輸與回應時間
    answer: A
    explain:
      A: 完成數除以視窗秒數是吞吐，逐筆等待仍是另一項驗收。
      B: 吞吐單位應為每秒完成數，且不能推出每筆都更快。
      C: 288 與 120 是毫秒視窗，不是每秒請求數。
      D: 時間視窗不是吞吐，也沒有包含端到端各段。
  - id: c2
    goal: g1
    type: choice
    prompt: 攝影、傳輸及前後處理共 30 ms，時限 50 ms；湊批最多等 15 ms，之後 host 4、kernel 16 ms。如何判讀？
    options:
      A: 總計 20 ms，因只需檢查 host 與 kernel 的時間
      B: 總計 35 ms，因外圍處理可直接忽略不計入
      C: 最壞 65 ms，湊批上限不能保證端到端時限
      D: 總計 50 ms，因設定時限後其餘時間會縮短
    answer: C
    explain:
      A: 20 只算發起與執行，漏掉外圍及湊批。
      B: 35 仍漏掉外圍 30 ms。
      C: 若等滿 15 ms，最壞為 30+15+4+16=65 ms；實際等待 0–15 ms 時，總延遲為 50–65 ms，不能保證符合 50 ms 時限。
      D: 時限不會自動縮短處理時間。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

指引提醒影像串流的批次處理若造成延遲，會妨礙即時反應。部署時應先確認回應是否符合場景時限。

:::supplement[來源：NVIDIA Triton「Batchers」「Optimization」；教學合成紀錄 L21302-B]
推論服務回應很慢，GPU 卻沒有持續工作，可能是資料準備、發起運算或排程等待占了時間。此時只換更大的 GPU，不一定解決問題。

GPU 推論排程安排請求何時執行、哪些請求合成一批。本頁利用固定紀錄，展開運算時間、閒置與使用者等待的差別。
:::

## 直覺

:::supplement[來源：NVIDIA Triton「Batchers」「Optimization」；教學合成紀錄 L21302-B]
kernel 是 GPU 實際執行的低階運算工作。本例每批先有 host 發起空檔，再執行 kernel；合批可減少發起次數，也可能讓早到的請求多等一會。

![看前兩批的 host 空檔與 kernel，批次縮短總視窗，但第一批完成時間較晚。](figure:l21302-gpu-inference-scheduling-timeline)

圖由同一批 24 請求的合成紀錄產生。它不量真實 GPU，也不把資料依賴或不同請求形狀造成的限制省略成無限並行。
:::

## 定義與公式

### 固定批次與動態批次（補充）

| 方式 | 如何組成工作 | 要確認的代價 |
|---|---|---|
| 單筆排程 | 每筆各自執行 | 發起成本重複、可能有空檔 |
| 固定批次 | 先準備固定數量再執行 | 早到請求可能等待湊齊 |
| 動態批次（Dynamic Batching） | 服務端把可相容請求合批 | 批次大小與等待上限需一起調 |

這裡處理可獨立推論的無狀態影像請求。相同模型不代表所有輸入都能合批，形狀、版本與模型支援都須確認。

### 完成率與時間範圍（補充）

GenAI-Perf 以完成回應數除觀測時間定義請求吞吐，以送出至最終回應的時間差定義請求延遲。本例把時間差的邊界改為後端到達與完成，再加固定外圍時間 $O$，自行推得下式：

$$
H=n/(D/1000),\qquad T_i=O+F_i-A_i.
$$

$H$ 是後端吞吐、單位 req/s；$n$ 是完成數，$D$ 是觀測視窗 ms。$A_i$、$F_i$ 是請求 $i$ 到達後端與完成後端的時間，$O$ 是固定外圍時間，本例為 30 ms。

$D>0$，$n$ 計同一視窗內完成的請求。$A_i$、$F_i$、$O$、$T_i$ 全以 ms 表示；$A_i$ 與 $F_i$ 使用同一時間基準，且 $F_i\ge A_i$。

$O\ge0$，只計後端以外的時間，不與 $F_i-A_i$ 重複。除另註明外，吞吐顯示至小數二位；門檻判斷使用未捨入值。

$T_i$ 是指定範圍的端到端延遲。後端觀測起點設為第一筆到達時刻，終點為最後一筆完成，包含 host 空檔與 kernel；不能只用 kernel 總和當分母。

## 算一次

### 同時到達的 24 請求（補充）

本例把本組同 24 個影像索引送進另一個固定壓測。它們在後端時間 0 同時可用，沒有額外湊批等待；各批串行、不重疊。

單筆每次有 4 ms host 空檔、8 ms kernel，24 批共 $24(4+8)=288$ ms。四筆一批則是六批，每批 4 ms 空檔加 16 ms kernel，共 $6(4+16)=120$ ms。

| 核算項目 | 單筆 | 四筆合批 |
|---|---|---|
| 發起批數 | 24 | 6 |
| host 空檔總和 | 96 ms | 24 ms |
| kernel 總和 | 192 ms | 96 ms |
| 後端吞吐 | 83.33 req/s | 200 req/s |
| 最慢端到端 | 318 ms | 150 ms |

單筆吞吐為 $24/0.288\approx83.33$ req/s；四筆合批是 $24/0.120=200$ req/s。83.33 是保留小數二位的近似值。

加外圍時間後，最慢請求分別等待 318 與 150 ms。

若本次尖峰門檻是 160 ms，四筆方案全部過關，單筆方案無法全過。但第一筆由 42 變 50 ms，仍顯示吞吐提高不代表每筆都更快。

### 低流量時改看等待上限（補充）

如果只到一筆請求，為了湊批再等 15 ms，之後還要 host 4 與 kernel 16 ms。端到端為 $30+15+4+16=65$ ms，不能滿足 50 ms 門檻。

動態批次的湊批等待上限，只限制為形成批次刻意增加的等待。排程壅塞、資源不可用及外圍處理仍可能另耗時間，不能當作端到端保證。

## 程式（補充）

這段重播已固定的排程條件。所有請求在 0 ms 到達，輸出的是合成核算，不是量測模型執行速度。

```python
for batch, kernel in ((1, 8), (4, 16)):
    finish = []
    now = 0
    for start in range(0, 24, batch):
        now += 4 + kernel
        finish.extend([now] * batch)
    latency = [30 + t for t in finish]
    idle = (24 // batch) * 4
    print(f"batch={batch}: window={now} ms, idle={idle} ms")
    print(f"throughput={24 / (now / 1000):.2f} req/s, max={max(latency)} ms")
    print(f"first={latency[0]} ms, pass160={sum(t <= 160 for t in latency)}/24")
```
```text
batch=1: window=288 ms, idle=96 ms
throughput=83.33 req/s, max=318 ms
first=42 ms, pass160=10/24
batch=4: window=120 ms, idle=24 ms
throughput=200.00 req/s, max=150 ms
first=50 ms, pass160=24/24
```

:::tip[讀碼重點]
now 加入每批 host 與 kernel，finish 保留每筆完成時間。吞吐看最後完成視窗，延遲則把每筆等待與外圍時間都留下。
:::

## 怎麼用、怎麼判讀

:::supplement[來源：NVIDIA Triton「Batchers」「Optimization」；教學合成紀錄 L21302-B]
先看時間軸：等待發生在資料準備、湊批、資源排程，還是 kernel？若 host 空檔明顯，可試合批或其他排程；若 GPU 已滿，增加併發可能只會堆積等待。

逐次固定模型、輸入、精度與同一批請求，比較記憶體、品質、吞吐與延遲。多開模型實例可能改善利用率，也可能耗盡記憶體，需再量測。
:::

### 換個場景（補充）

| 場景 | 排程方向 | 驗收重點 |
|---|---|---|
| 產線影像 | 短等待或較小批次 | 每張回應是否趕得上處理位置 |
| 夜間圖文摘要 | 可評估較大批次 | 整批期限及記憶體 |
| 車站影像分析 | 尖峰時調整批次 | 最慢請求而非只有平均 |

## 常見誤解

:::supplement[來源：NVIDIA Triton「Batchers」「Optimization」；教學合成紀錄 L21302-B]
- **GPU 閒置就是模型太小？** 也可能是資料準備或排程斷續，先看時間軸。
- **批次越大越好？** 湊批等待、記憶體與單筆時限都可能變差。
- **湊批最多等 15 ms，所以總延遲最多 15 ms？** 執行、壅塞與外圍成本仍存在。
:::

## 進階

### 與文字生成排程的界線（補充）

生成式服務的請求可能逐 token 完成，序列長度也不同。本頁的完整影像批次不直接代表連續批次的行為，不能把這組吞吐數字移用到所有生成模型。

### 參考來源

- guide-1:3-58、guide-1:3-81：批次延遲與部署資源議題；指引未完整教授本頁 GPU 時間軸及動態批次，相關展開皆標補充。
- [NVIDIA GenAI-Perf：Metrics](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html#metrics)：支援完成數／時間及完成減到達的定義；固定外圍 $O$ 為本例假設。
- [NVIDIA Triton：Batchers](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html)：支援動態批次、湊批等待上限及佇列政策。
- [NVIDIA Triton：Optimization](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/optimization.html)：官方教學，支援合批、模型實例與吞吐／延遲比較。
- [OpenVINO：吞吐優化](https://docs.openvino.ai/2025/openvino-workflow/running-inference/optimize-inference/optimizing-throughput.html)：支援不同性能目標需分開配置與測量。

## 小結

:::supplement[來源：NVIDIA Triton「Batchers」「Optimization」；教學合成紀錄 L21302-B]
- 看時間軸，分清 GPU 運算與未執行 kernel 的空檔。
- 用整個觀測視窗算吞吐，逐筆保存端到端等待。
- 動態合批需同時限制等待，並驗收記憶體與品質。
:::
