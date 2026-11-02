---
id: circuit-breaker
title: 斷路器與服務降級
kind: technique
codes:
  - L21302
aliases:
  - Circuit Breaker
  - 斷路器
requires:
  - inference-service-api
summary: 斷路器暫停可能持續失敗的呼叫，降級則提供受控的替代處理
goals:
  - id: g1
    text: 依關閉、開啟與半開狀態控制呼叫，區分逾時、重試及安全降級
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 語音服務連續 2 次逾時後，斷路器進入開啟狀態 3 秒。第 1 秒的新請求應怎麼處理？
    options:
      A: 開啟期間仍呼叫原下游，利用短間隔重試取代 FAQ 或轉人工
      B: 開啟期間把請求放進無期限佇列，等下游恢復後才給使用者任何回應
      C: 開啟期間不呼叫原下游，回覆標明降級的文字 FAQ 或轉人工
      D: 開啟期間視為已恢復，讓所有請求回到原下游並關閉降級流程
    answer: C
    explain:
      A: 密集重試會增加故障下游壓力，違反開啟狀態目的。
      B: 應有明確錯誤或替代流程，不能無限占用資源。
      C: 開啟狀態暫停下游呼叫，降級承接可接受的替代處理。
      D: 等待未結束且未探測恢復，不能當作正常運作。
  - id: c2
    goal: g1
    type: choice
    prompt: 製造檢驗服務半開後只允許少量探測，第 1 次探測仍逾時。哪個後續最適當？
    options:
      A: 探測失敗即回到開啟狀態並重新等待，待驗工件轉人工複檢
      B: 探測失敗仍維持半開並放行全部待驗工件，待下游恢復再補做檢驗
      C: 探測失敗改成無限重試並暫停人工複檢，直到下游成功才繼續出貨
      D: 探測失敗就永久關閉斷路保護，讓所有待驗工件照常送往原下游
    answer: A
    explain:
      A: 探測失敗代表尚未恢復，應重新隔離並維持可追蹤的處理路徑。
      B: 服務失效不代表工件合格，這會把未知風險當成安全。
      C: 無限重試會耗盡呼叫端與下游資源。
      D: 半開是確認恢復的試探，不能直接取消保護。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-15
---

## 為什麼需要

推論 API 可能還要呼叫語音、特徵或知識服務。指引要求介接考慮容錯；某個下游出問題時，不能讓每個呼叫都無限等待。

:::supplement[來源：Microsoft Learn「Circuit Breaker pattern」]
斷路器（Circuit Breaker）記錄近期失敗，達到條件就暫停呼叫。這能保護呼叫端的連線與工作資源，並給下游恢復時間。
:::

## 直覺（補充）

斷路器主要決定「要不要再呼叫」，服務降級（Graceful Degradation）決定「暫時提供什麼」。斷路器本身不會修復下游，也不一定內建替代答案。

![順著三個狀態看：達失敗門檻開啟，等待後少量試探，試探失敗就重新開啟。](figure:l21302-circuit-breaker-states)

## 定義與公式（補充）

| 狀態 | 下游呼叫 | 轉移條件 |
|---|---|---|
| 關閉（Closed） | 正常放行並計數 | 失敗達門檻則開啟 |
| 開啟（Open） | 立即拒絕，不打下游 | 等待到期後半開 |
| 半開（Half-open） | 只放少量探測 | 成功達標則關閉；失敗則重開 |

| 機制 | 回答的問題 | 和斷路器的關係 |
|---|---|---|
| 逾時（Timeout） | 單次最多等多久 | 避免一次等待拖垮呼叫端 |
| 重試（Retry） | 短暫失敗要不要再試 | 需次數、退避與總時間上限 |
| 降級 | 正常功能失效怎麼辦 | 回快取、簡化功能或轉人工 |

開啟狀態不再對故障下游重試。可能改動資料的操作還要避免重複執行；讀取逾時與扣款逾時不能直接套同一套重試規則。

## 走一次流程（補充）

共用資料 L21302-C-incidents.json 有 12 次故障與恢復觀測。本例固定：連續失敗 2 次開啟、等待 3 秒、半開需連續成功 2 次；失敗立即重開，沒有重試。

| 時刻（秒） | 動作與結果 | 觀測後狀態 |
|---|---|---|
| 0、1、2 | 成功、失敗、失敗 | 開啟，等到 5 秒 |
| 3、4 | 略過下游，直接降級 | 開啟 |
| 5、6 | 半開成功、失敗 | 重開，等到 9 秒 |
| 7、8 | 略過下游，直接降級 | 開啟 |
| 9、10、11 | 探測成功、成功，再正常成功 | 關閉 |

客服以標記降級的 FAQ 接手並提供轉人工；製造改人工複檢，不能把無法推論的工件直接放行。替代內容要有有效期、版本與追蹤紀錄。

## 程式（補充）

以下是固定合成觀測的狀態機。程式先定義狀態轉移，再依序重播；每秒一次觀測，沒有模擬真實網路或平行競爭。

```python
def step(t, ok, state, failures, probes, reopen_at):
    if state == "open" and t >= reopen_at:
        state, probes = "half-open", 0
    if state == "open":
        return state, failures, probes, reopen_at, False
    failures = 0 if ok else failures + 1
    if state == "half-open":
        probes = probes + 1 if ok else 0
        if ok and probes >= 2:
            state, failures = "closed", 0
        elif not ok:
            state, reopen_at = "open", t + 3
    elif failures >= 2:
        state, reopen_at = "open", t + 3
    return state, failures, probes, reopen_at, True

outcomes = [True, False, False, False, True, True,
            False, False, False, True, True, True]
state, failures, probes, reopen_at = "closed", 0, 0, 0
calls = skipped = degraded = 0
for t, ok in enumerate(outcomes):
    state, failures, probes, reopen_at, called = step(
        t, ok, state, failures, probes, reopen_at)
    calls += int(called)
    skipped += int(not called)
    degraded += int(not called or not ok)
print("呼叫", calls, "略過", skipped, "降級", degraded)
print("結束狀態", state)
```
```text
呼叫 8 略過 4 降級 7
結束狀態 closed
```

:::tip[讀碼重點]
略過的 4 次沒有呼叫下游，不能把資料裡假定的成功結果算成探測成功；3 次失敗加上 4 次略過，共 7 次降級。
:::

## 怎麼用、怎麼判讀

指引的 API 容錯要求，著眼於服務介接穩定。斷路器適合下游可能持續失敗的情況；單次快速、偶發的錯誤，未必需要立即停止全部呼叫。

### 換個場景

| 場景 | 替代動作 | 判讀重點 |
|---|---|---|
| 指引：服務介接與容錯 | 準備錯誤處理路徑 | 下游失效不要無限等待 |
| 客服（補充） | FAQ 與轉人工 | 替代資訊仍有有效版本 |
| 製造（補充） | 人工複檢 | 不因模型失效自動放行 |
| 推薦（補充） | 經核可的熱門清單 | 權限與庫存資訊仍需正確 |

## 常見誤解（補充）

- **「開啟代表正常通行。」** 開啟表示切斷下游呼叫，正常放行是關閉狀態。
- **「等待到期就證明下游好了。」** 等待只讓它進入半開，還需探測。
- **「降級也回成功碼，所以不用記錯誤。」** 應分開記主功能失敗、降級次數與業務完成率。

## 進階

### 門檻是政策，不是定律（補充）

真實系統可能用滑動視窗錯誤率而非連續次數。門檻需依流量、錯誤類型與恢復時間驗證，也要限制半開併發，避免一恢復就被全部請求淹沒。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-15）：支持 API 介接需考慮容錯；三狀態及程式超出原文深度。
- [Microsoft Learn：Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)，Solution、Example：支持三狀態、恢復探測、降級與教學流程。
- [Microsoft Learn：Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)，Issues and considerations：支持有限重試、退避及重複操作風險。
- [Google SRE：Handling Overload](https://sre.google/sre-book/handling-overload/)，Load Shedding、Graceful Degradation：支持資源保護與替代功能的取捨。

## 小結

- 服務介接需要容錯安排。
- 關閉放行、開啟阻擋、半開少量探測。（補充）
- 逾時限制等待，重試處理短暫失敗，降級提供替代路徑。（補充）
- 降級要維持安全與追蹤，不能掩蓋主功能失效。（補充）
