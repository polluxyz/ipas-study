---
id: data-pipeline-integration
title: 資料管線與儲存介接
kind: technique
codes: [L21301, L21302]
aliases: [Data Lake, Data Pipeline, Data Warehouse]
requires: [mlops-lifecycle]
summary: 資料管線把異質來源整理成模型可用資料，並依時效分配儲存與讀取路徑
goals:
  - id: g1
    text: 規劃倉儲、湖、IoT 與 API 到模型的擷取、轉換、清理及入庫責任
  - id: g2
    text: 畫出串流事件、特徵計算與即時儲存到推論的路徑，辨識離線資料的限制
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠同時接收攝氏感測值、華氏 API 資料及影像索引。每天有 12 筆合成請求要回放，哪個整合安排最合適？
    options:
      A: 只把所有檔案移到資料湖，不記錄來源或單位
      B: 擷取時保留來源，轉換時統一單位，清理壞值後連同版本入庫
      C: 等模型收到錯誤後才猜各欄位原本的單位
      D: 先把缺值全部當成正常量測，再增加模型層數
    answer: B
    explain:
      A: 儲存位置不能取代欄位語意、來源與品質檢查。
      B: 各步驟有明確責任，模型才會接到語意與格式一致的資料。
      C: 單位應在進模型前確認，事後猜測無法建立可重現流程。
      D: 缺值不等於正常值，模型加深也不會修正錯誤語意。
  - id: c2
    goal: g2
    type: choice
    prompt: 推薦服務允許特徵最多落後 5 秒，r07 的請求時間為 109 秒、特徵時間為 90 秒。系統已有每日更新的倉儲，該如何改善？
    options:
      A: 把每日倉儲資料改名為即時資料，繼續回傳
      B: 只把推論服務增加到 10 個副本
      C: 將所有過期特徵改成零，且不記錄降級
      D: 串流更新線上特徵，讀取時檢查新鮮度
    answer: D
    explain:
      A: 更名不會縮短更新延遲，仍然不符合 5 秒限制。
      B: 增加推論副本不能讓來源特徵變新。
      C: 任意補零可能改變預測語意，且掩蓋資料更新問題。
      D: 串流更新與讀取時的新鮮度檢查共同處理時效，過期時仍須依規則降級。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-14, guide-1:5-15]
---

## 為什麼需要

模型可能同時使用交易表、影像、感測值與外部資料。這些來源的格式、更新速度與品質不相同，直接混在一起，容易讓模型讀到錯誤或過期的內容。

資料管線（Data Pipeline）把取得資料到提供模型使用的步驟固定下來。儲存介接則決定哪些資料放哪裡、誰負責更新、模型怎麼讀取。

## 直覺

資料湖（Data Lake）適合容納影像等多種原始資料；資料倉儲（Data Warehouse）通常提供整理過的結構化歷史資料。兩者都是來源或目的地，不能取代中間的整理流程。

![先看四類來源如何經過整理，再看即時特徵與離線歷史資料如何分流。](figure:l21302-data-pipeline-integration-flow)

:::supplement[來源：Microsoft Learn「Extract, transform, and load (ETL)」；Google Cloud MLOps 的 Feature store]
「最新已入庫」也可能不夠新。即時推薦常把事件送進串流處理，計算後放入低延遲的線上特徵儲存；歷史事件另存倉儲，供訓練與回放使用。
:::

## 定義與公式

指引的基本路徑包含擷取、格式轉換、清理及入庫。安排責任時，可以把「誰保證這一步的資料可用」寫清楚。

| 步驟 | 工作內容 | 本例的責任 |
|---|---|---|
| 擷取 | 從倉儲、湖、IoT、API 取得資料 | 來源介接保留 ID 與時間 |
| 格式轉換 | 統一模型需要的欄位與格式 | 資料工程確認單位及時間格式 |
| 清理 | 處理缺值、重複與不合理內容 | 品質規則標記或隔離異常 |
| 入庫 | 保存整理後資料供後續讀取 | 儲存層保留可查版本 |

:::supplement[來源：Microsoft Learn「Extract, transform, and load (ETL)」；Google Developers「Rules of Machine Learning」Rule #19]
以上責任分配是教學設計。實務上還應記錄轉換規則版本，避免訓練與推論各寫一套同名但不同算法的特徵。

這裡的資料管線涵蓋來源及儲存，不等於 scikit-learn Pipeline。後者主要把模型前處理與估計器串成可擬合的步驟。
:::

## 走一次流程

### 異質來源到模型

1. 從資料倉儲取交易欄位，從資料湖取得影像位置。
2. 從 IoT 收到感測值，從第三方 API 補齊外部欄位。
3. 將欄位與格式整理成模型預期的輸入，再清理與入庫。
4. 模型依固定介面讀取整理後資料，避免每個呼叫端自行猜格式。

### 即時推薦與離線分流（補充）

本組 `L21302-A-requests.json` 固定 retail-d1、manufacturing-d1 與 f1。各頁使用同一批 24 筆請求，每領域 12 筆，依相同索引回放。

事件可先寫入 Kafka，由特徵計算程序更新 Redis 或特徵儲存（Feature Store），再讓推論服務讀取。Kafka 負責事件傳遞與保存，不會自動替你算出特徵。

同一批事件另存離線倉儲，供歷史訓練與稽核。Redis 是本例的線上儲存選項；完整特徵儲存還可管理特徵定義與離線／線上讀取，不等於單一快取產品。

r01 在第 103 秒請求，特徵在第 101 秒更新，落後 2 秒。r07 在第 109 秒請求，特徵仍停在第 90 秒，落後 19 秒，超過本例 5 秒門檻。

本例 API 契約允許回傳 r07 的結果，資料時效檢查仍會另發警報。若應用要求更嚴格，應事先約定過期時重算、使用安全預設或拒絕服務，不能把舊值默默當新值。

## 程式

### 檢查固定請求的新鮮度（補充）

以下摘出共用資料的 r01、r07、m01 時間欄位。程式只檢查特徵時效，不連線、不啟動 Kafka 或 Redis；數值是教學資料，不是產品預設。

```python
requests = [
    ("r01", 103, 101),
    ("r07", 109, 90),
    ("m01", 103, 101),
]
ttl = 5
for request_id, request_time, feature_time in requests:
    age = request_time - feature_time
    state = "fresh" if 0 <= age <= ttl else "stale"
    print(f"{request_id}: age={age}s, {state}")
```
```text
r01: age=2s, fresh
r07: age=19s, stale
m01: age=2s, fresh
```

:::tip[讀碼重點]
`0 <= age <= ttl` 同時攔住過期值與未來時間。收到未來時間應查時鐘或時間欄位，不能當成特別新鮮的資料。
:::

## 怎麼用、怎麼判讀

先問模型要哪些來源，再問資料要多新、缺資料時怎麼辦。大量歷史分析與即時特徵讀取可能需要不同路徑。不能只用「資料都在同一個庫」判斷整合完成。

### 換個場景

| 場景 | 輸入條件 | 管線重點 |
|---|---|---|
| 指引：企業內部倉儲與資料湖 | 結構化與非結構化資料並存 | 擷取、轉換、清理、入庫 |
| 指引：IoT 與第三方 API | 感測回傳與外部格式不同 | 先整合再提供模型使用 |
| 零售推薦（補充） | 點擊持續到達，時效要求高 | 串流更新線上特徵 |
| 製造檢驗（補充） | 影像與感測資訊需對齊 | 以實體 ID 及時間接合 |
| 物流預測（補充） | 地點與交通資料更新頻率不同 | 保存來源時間與品質狀態 |

## 常見誤解

- **「資料都存起來就完成介接。」** 還要確認欄位、格式與讀取流程。
- **「倉儲容量很大就能支援即時推薦。」** 容量與更新延遲是不同條件。（補充）
- **「有 Kafka 就有即時特徵。」** 還需要特徵計算、線上儲存與新鮮度檢查。（補充）
- **「把壞資料送進模型，模型會自己學會修正。」** 品質問題應在資料流程中識別與處理。

## 進階

### 重放與晚到事件（補充）

事件重送時，以事件 ID 避免重複計數；晚到事件更新特徵時，需依事件時間或既定窗口規則處理。直接以「最後抵達」覆蓋「最新發生」，可能讓特徵倒退。

這是維持即時路徑正確性的延伸。是否接受晚到、保留多久，要依應用時效與重算成本設定。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-14～5-15）：支持四類來源、基本管線責任與換個場景的前兩列。
- [Microsoft Learn：ETL](https://learn.microsoft.com/en-us/azure/architecture/data-guide/relational-data/etl)，ETL process、Streaming：支持管線步驟、串流與批次分流的教學思路。
- [Apache Kafka：Introduction](https://kafka.apache.org/intro/)，What is event streaming：支持 Kafka 的定位與事件處理延伸。
- [Google Cloud：MLOps 架構的 Feature store](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning#feature_store)：支持即時特徵、線上／離線讀取及特徵定義的補充。
- [Google Developers：Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)，Rule #9、Rule #19：支持新鮮度檢查、程式及訓練／推論特徵一致性。

## 小結

- 四類來源都要經過明確的整理與儲存流程。
- 擷取、轉換、清理與入庫各自有責任，不能只指定儲存位置。
- 即時服務要檢查特徵時間，並安排線上更新與離線分流。（補充）
- 本例 r07 的特徵落後 19 秒，不能因 API 成功就忽略時效警報。（補充）
