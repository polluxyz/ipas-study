---
id: phased-rollout
title: 漸進式部署與擴量門檻
kind: technique
codes: [L21302, L21202]
aliases: [Phased Rollout, 漸進式部署, 漸進式部署與擴量決策]
requires: [release-strategies]
summary: 漸進式部署先限制影響範圍，再按服務與業務門檻決定擴量、暫停或回復
goals:
  - id: g1
    text: 規劃按流量或單位擴張的階段，用品質與延遲門檻決定擴量、暫停或回復
  - id: g2
    text: 核對分版本的系統與業務指標，處理延遲惡化並驗證回復結果
formula_groups:
  - id: error-rate
    source: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21302-D
  - id: ctr
    source: https://support.google.com/google-ads/answer/2615875?hl=en
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-D
  - id: recall
    source: https://scikit-learn.org/stable/modules/model_evaluation.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售新版已接 30% 流量，錯誤率 0.5%、p95 為 115 ms、點擊率 12%，都達到門檻；但只觀察 10 分鐘，計畫要求至少 30 分鐘。應如何處理？
    options:
      A: 立刻升到 100%，因為目前每個比率都合格
      B: 立即回復舊版，因為觀察時間不足就等於品質失敗
      C: 暫停擴量，補足觀察時間與樣本再決定
      D: 把未來 20 分鐘指標填成和目前相同
    answer: C
    explain:
      A: 擴量需要指標和證據量同時滿足，短時間合格仍不足。
      B: 證據不足與已觸發回復門檻不同，可先維持受控範圍觀察。
      C: 保持目前比例能避免擴大風險，又能取得缺少的觀察證據。
      D: 未發生的觀測不能偽造成證據，否則門控失去依據。
  - id: c2
    goal: g2
    type: choice
    prompt: 全量後新版 p95 變成 160 ms、錯誤率 2%；計畫約定 p95 超過 120 ms 先暫停優化，超過 200 ms 或錯誤率超過 1% 就回復，點擊率仍有 12%。應如何處理？
    options:
      A: 依約回復舊版，核對載入、路由與指標
      B: 點擊率合格就能抵銷服務故障，維持全量
      C: 只把模型登錄標籤改成舊版，就宣告恢復
      D: 用新舊版本合併平均值取代新版數字
    answer: A
    explain:
      A: 錯誤率已超過 1% 的回復門檻；延遲尚未超過 200 ms，也不能忽略錯誤超標。
      B: 業務比率合格不能消除延遲及錯誤超標的影響。
      C: 標籤只表示管理意圖，不能證明服務載入與流量已切換。
      D: 合併值會稀釋新版問題，無法作為新版擴量的可靠依據。
  - id: c3
    goal: g1
    type: choice
    prompt: 工廠有 20 條產線，計畫先 1 條、再 6 條、最後 20 條更新。哪個說法正確？
    options:
      A: 第一條通過後，另外 19 條不必再看現場品質
      B: 更新 6／20 條產線必然等於新版收到 30% 工件
      C: 裝置更新不能使用暫停或回復門檻
      D: 比例為 5%、30%、100%，仍須驗證現場差異
    answer: D
    explain:
      A: 其他產線可能有不同相機或產品條件，單一現場不能保證全面適用。
      B: 產線工件量可能不同，單位比例不保證等於實際流量比例。
      C: 單位擴張也需要品質門控與可執行的回復程序。
      D: 分批單位部署符合漸進原則，但代表性與實際影響仍需逐階段驗證。
  - id: c4
    goal: g2
    type: choice
    prompt: 製造新版在 1,000 筆已標註工件中有 100 筆真瑕疵，抓到 88 筆；服務錯誤率 0.5%、p95 為 75 ms，皆合格。品質硬門檻為召回率至少 90%。應如何判斷？
    options:
      A: 召回率是 88／1,000，先改模型名稱再擴量
      B: 召回率 88% 未達標，依約回復並留紀錄
      C: 延遲合格就保證瑕疵品質也合格
      D: 服務錯誤率很低，所以直接擴到 100%
    answer: B
    explain:
      A: 召回率分母是實際瑕疵數 100，不是全部工件，也不能靠改名處理品質問題。
      B: 抓到 88／100 真瑕疵，低於 90% 門檻，應依已定政策止損。
      C: 延遲衡量服務速度，不能證明瑕疵是否被找出。
      D: 請求成功和預測正確是兩件事，不能省略品質門檻。
  - id: c5
    goal: g2
    type: choice
    prompt: 零售新版在 30% 流量時 p95 從 115 ms 升到 140 ms，錯誤率 0.5%、CTR 12%，觀察已滿 30 分鐘。約定超過 120 ms 暫停優化，超過 200 ms 或錯誤率超過 1% 回復。下一步最合適的是？
    options:
      A: 點擊率仍達標，升到全量後再處理延遲
      B: 延遲只要比上一階段高，就回復並停止測試
      C: 暫停擴量並分析延遲，優化驗證後再續推
      D: 保持 30% 且持續觀察，不必採取效能改善
    answer: C
    explain:
      A: 業務品質合格不能抵銷延遲惡化，應先停止增加影響範圍。
      B: 尚未觸發約定的回復條件，可以先在受控範圍內診斷與優化。
      C: 已達暫停門檻而未達回復門檻，須處理效能問題並重新取得驗證證據。
      D: 問題已被觀察到，單純等待不會取代分析、優化與重新驗證。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-21]
---

## 為什麼需要

:::supplement[來源：Google SRE「Canarying Releases」；本組教學門控政策]
少量流量正常的模型，承接全部請求後可能壅塞。漸進式部署（Phased Rollout）先限制範圍，每一階段取得足夠證據後再擴張，並事先約定暫停與回復條件。
:::

指引 5-21 列出受控更新策略，本頁將它延伸為擴量決策。

## 直覺（補充）

每次擴量都要回答：「是否觸發回復條件？」以及「是否仍需優化或補證據？」嚴重超標就依約回復；延遲惡化但仍可受控修正，先暫停擴量並優化。證據不足也要暫停。

![每次擴量先查回復門檻；未觸發但延遲惡化時暫停優化，證據不足時補齊，全部合格才前進。](figure:l21302-phased-rollout-decisions)

## 定義與公式（補充）

流量可以按請求比例擴張，也可以按門市、產線或部門擴張。藍綠、金絲雀與滾動更新提供發布手段，漸進式決策再加上各階段的證據與停止條件。

服務錯誤率採固定觀察窗內的請求計數：

$$
\mathrm{ErrorRate}=\frac{E}{N}
$$

$E$ 是失敗請求數，$N$ 是同一模型版本、同一觀察窗的總請求數。共用資料 r-5 有 5 次失敗、1,000 次請求，錯誤率為 5／1,000＝0.5%。

零售品質採點擊率（Clickthrough Rate，CTR）：

$$
\mathrm{CTR}=\frac{C}{I}
$$

$C$ 是該版本推薦的點擊數，$I$ 是實際曝光數。r-5 的品質紀錄有 120 次點擊、1,000 次曝光，得 12%；品質事件與 API 請求是不同計數，不能任意混用分母。

製造品質採召回率，以瑕疵為正類：

$$
\mathrm{Recall}=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}}
$$

$\mathrm{TP}$ 是抓到的瑕疵，$\mathrm{FN}$ 是漏掉的瑕疵。m-5 的 100 件真瑕疵中抓到 95 件、漏 5 件，得 95／100＝95%，不能除以全部 1,000 件工件。

上述分母為零時，該比率無法判定，應暫停擴量並補資料。p95 延遲採最近秩定義：排序後取至少涵蓋 95% 請求的位置；1,000 筆就看第 950 筆，不用平均延遲代替。

最近秩對應 NumPy `quantile` 的 `method="inverted_cdf"`，不同於預設插值法。讀其他工具輸出時，先確認使用哪一種百分位定義。

## 走一次流程

:::supplement[來源：Google SRE「Canarying Releases」；教學合成資料 L21302-D]
指引列出發布策略，未展開以下擴量決策流程；以下守門表、例子與步驟為補充。所有門檻數值都是教學假設，實務須在發布前另行約定。
:::

### 先寫守門表（補充）

`content/examples/L21302-D-releases.json` 保存計數與延遲直方圖。每筆代表一個版本與觀察窗，不合併新舊版來稀釋問題。

| 條件 | 零售 rec-v3 | 製造 inspect-v4 |
|---|---|---|
| 延遲暫停門檻 | p95 >120 ms，先分析優化 | p95 >80 ms，先分析優化 |
| 服務回復門檻 | p95 >200 ms 或錯誤率 >1% | p95 >100 ms 或錯誤率 >1% |
| 品質回復門檻 | CTR <10% | 瑕疵召回率 <90% |
| 足夠觀察 | ≥30 分鐘、≥1,000 請求 | 相同 |
| 品質證據 | ≥1,000 曝光且回饋到齊 | ≥1,000 標註工件且回饋到齊 |
| 回復點 | rec-v2＋API v1＋f1 | inspect-v3＋API v1＋f1 |

先看回復門檻，觸發就依約回復。未觸發但延遲達暫停門檻，就停止擴量、診斷瓶頸並優化；只缺時間、樣本、標籤或相容證據時，則補齊驗證。

門檻合格、證據齊全且回復點可用，才擴到下一階段。已在 100% 則維持監控；相容性未確認時不可貿然回切。

### 零售：擴量、暫停、回復（補充）

每筆階段窗共 20,000 次總請求，因此新版 5%、30%、100% 對應 1,000、6,000、20,000 次新版請求。品質另固定觀測 1,000 次實際曝光，三個階段不能互借分母。

| 紀錄／新版比例 | p95／錯誤率 | CTR／觀察時間 | 決策 |
|---|---|---|---|
| r-5／5% | 110 ms／0.5% | 12%／30 分鐘 | 擴至 30% |
| r-30-early／30% | 115 ms／0.5% | 12%／10 分鐘 | 暫停擴量 |
| r-30-latency／30% | 140 ms／0.5% | 12%／30 分鐘 | 暫停並優化 |
| r-30-ready／30% | 115 ms／0.5% | 12%／30 分鐘 | 擴至 100% |
| r-100-breach／100% | 160 ms／2% | 12%／30 分鐘 | 回復 rec-v2 |

r-30-latency 的 p95 為 140 ms，介於暫停與回復門檻之間，應分析優化。r-100-breach 則因錯誤率 2% 超過 1% 而回復。

r-30-ready 是 early 的較完整快照，不與 early 相加。latency 是另一個惡化情境窗，ready 不代表它已完成優化；修改模型或程式後是新候選產物，必須重新驗證與觀察。

### 製造：按單位擴張與品質止損（補充）

20 條產線可安排 1 條→6 條→20 條，即單位比例 5%→30%→100%。但各產線產量不一定相同，仍要實測請求與工件數；先選具代表性的現場，再涵蓋不同相機與產品。

請求分流例中，m-5 召回率 95%，可繼續；m-30-breach 只抓到 88／100 瑕疵，低於 90% 門檻。即使延遲與錯誤率合格，仍回復 inspect-v3，未擴到 100%。

## 程式（補充）

三段接續執行。先從共用 JSON 擷取七筆紀錄做成自足資料；欄位依序是紀錄、領域、比例、分鐘、請求、錯誤、延遲中間檔、品質分子與分母、已到齊樣本數。

本例回饋與相容檢查都已完成，只演練時間、數量、暫停與回復門檻。這是紀錄核算，不是現場效能量測；不寫檔、不連線，也不執行部署。

```python
fields = ("id", "domain", "pct", "minutes", "requests", "errors",
          "middle_ms", "quality_good", "quality_count", "labeled_samples")
rows = [
    ("r-5", "retail", 5, 30, 1000, 5, 110, 120, 1000, 1000),
    ("r-30-early", "retail", 30, 10, 6000, 30, 115, 120, 1000, 1000),
    ("r-30-latency", "retail", 30, 30, 6000, 30, 140, 120, 1000, 1000),
    ("r-30-ready", "retail", 30, 30, 6000, 30, 115, 120, 1000, 1000),
    ("r-100-breach", "retail", 100, 30, 20000, 400, 160, 120, 1000, 1000),
    ("m-5", "manufacturing", 5, 30, 1000, 5, 70, 95, 100, 1000),
    ("m-30-breach", "manufacturing", 30, 30, 6000, 30, 75, 88, 100, 1000),
]
records = [dict(zip(fields, row)) for row in rows]
print("固定發布觀測筆數:", len(records))
```
```text
固定發布觀測筆數: 7
```

第二段從直方圖計數求最近秩 p95。每筆紀錄均有 90% 請求落在較低檔、5% 落在中間檔、5% 落在較高檔，與例子檔的直方圖相同。

```python
import math
def p95(o):
    n, mid = o["requests"], o["middle_ms"]
    if n == 0:
        return None
    bins = [(mid - 20, n * 90 // 100), (mid, n * 5 // 100),
            (mid + 30, n * 5 // 100)]
    assert sum(count for _, count in bins) == n
    rank, seen = math.ceil(0.95 * n), 0
    for ms, count in bins:
        seen += count
        if seen >= rank:
            return ms
print("r-5 的 p95:", p95(records[0]), "ms")
```
```text
r-5 的 p95: 110 ms
```

第三段先判斷回復，再分開判斷暫停優化與補證據。實際服務還要檢查回饋、相容性與回復點；嚴重超標時不能因樣本尚少就繼續擴量。

```python
gates = {"retail": (120, 200, 0.10, "rec-v2"), "manufacturing": (80, 100, 0.90, "inspect-v3")}
for o in records:
    pause, rollback, floor, old = gates[o["domain"]]
    err = o["errors"] / o["requests"] if o["requests"] else None
    quality = o["quality_good"] / o["quality_count"] if o["quality_count"] else None
    delay = p95(o)
    breach = ((err is not None and err > 0.01) or (delay is not None and delay > rollback)
              or (quality is not None and quality < floor))
    ready = (delay is not None and err is not None and o["minutes"] >= 30 and o["requests"] >= 1000
             and o["labeled_samples"] >= 1000 and quality is not None)
    slow = delay is not None and delay > pause
    action = ("回復" if breach else "暫停並優化" if slow else "暫停" if not ready
              else "維持" if o["pct"] == 100 else "擴量")
    print(o["id"], action + (" " + old if action == "回復" else ""))
```
```text
r-5 擴量
r-30-early 暫停
r-30-latency 暫停並優化
r-30-ready 擴量
r-100-breach 回復 rec-v2
m-5 擴量
m-30-breach 回復 inspect-v3
```

:::tip[讀碼重點]
回復條件優先，再看延遲是否需優化，最後才確認證據量。延遲上升不等於一律回復；輸出只是決策建議，實際回復仍須核對載入與路由。
:::

## 怎麼用、怎麼判讀（補充）

按版本、流量階段、觀察窗與重要子群拆開看。真實環境還要檢查尖峰、樣本代表性及統計不確定性；教學中的 30 分鐘與 1,000 筆不是成效提升的統計證明。

### 暫停與回復不同

- **暫停擴量**：尚未觸發回復條件，但延遲惡化仍可在受控範圍內修正，應分析瓶頸、優化再驗證；觀察不足、標籤未齊或相容驗證未完時，則先補證據。
- **回復版本**：已觸發事先約定的服務或品質回復門檻，將流量退回可用舊版；重大安全、合規或服務中斷事件也須先隔離止損。
- **繼續擴量**：沒有待解的效能惡化、證據齊全且回復點可用，才移到下一階段。

若情境只說延遲上升、體驗變差，未說已達回復條件，應先停止擴量並診斷優化。不要直接宣告模型測試終止，也不要維持原比例卻完全不處理延遲。

### 回復後還要驗證

核對實際載入的模型指紋、API／特徵規則與路由，再看延遲、錯誤及品質是否恢復。保存失敗窗與發布清單，避免只改登錄標籤就宣告成功；已發生的業務動作另行處理。

### 換個場景（補充）

指引列出部署策略但未提供擴量決策場景，以下為補充應用。

| 場景 | 階段安排 | 守門重點 |
|---|---|---|
| 零售推薦 | 5%→30%→100% 請求 | 延遲、錯誤與真實 CTR |
| 製造檢驗 | 1→6→20 條產線 | 召回率、相機差異與節拍 |
| 客服分類 | 一組客服→多組→全體 | 誤轉率、等待時間與回復程序 |

## 常見誤解（補充）

- **「只看業務數字就夠。」** CTR 合格仍可能伴隨服務錯誤與延遲超標。
- **「沒有壞消息就能擴量。」** 標籤未到齊可能只是還不知道結果。
- **「暫停一定要切回舊版。」** 暫停擴張與回復不同，要依已定觸發條件處理。
- **「延遲上升就必須回復舊版。」** 未達回復門檻時，先暫停擴量並優化；驗證改善後才續推。
- **「到 100% 就停止監控。」** 全量負載和長期資料變化仍可能帶來問題。

## 進階

### 門檻的訂定（補充）

本例為單純的絕對門檻。真實計畫可再加入與對照組的差距、重要子群與統計區間，但要在發布前訂好；不要看到不利結果後才改標準。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-21）：作為受控更新策略的背景，本頁擴量門控為補充。
- [Google SRE 教材：Canarying Releases](https://sre.google/workbook/canarying-releases/)，Canarying Principles、Metrics：支持分階段、按版本觀測與回復原則，並提供教學流程思路。
- [Google Cloud：MLOps 自動化架構](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)，Model validation：支持發布前模型驗證及上線後觀測的分工。
- [Google Ads：CTR 定義](https://support.google.com/google-ads/answer/2615875?hl=en)：支持 CTR 公式；本頁將相同曝光／點擊比率用於合成推薦例子。
- [scikit-learn：分類評估指標](https://scikit-learn.org/stable/modules/model_evaluation.html)，Precision, recall and F-measures：支持召回率公式與正類分母。
- [AWS CloudWatch：SLO](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html)，Calculate the burn rate：直接定義同一觀察窗內的失敗請求／總請求，支持服務錯誤率公式。
- [NumPy：quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html#notes)，Notes：支持最近秩對應的 `inverted_cdf` 方法，區別預設插值法。

## 小結（補充）

- 漸進式部署可以按流量，也可以按單位擴張。
- 每個階段都要看服務、品質與證據量。
- 延遲惡化先暫停優化；證據不足先補齊；觸發回復門檻則依約回復。
- 回復成功要由實際載入、路由與恢復指標確認。
