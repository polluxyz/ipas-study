---
id: business-system-integration
title: 模型結果與企業流程整合
kind: technique
codes: [L21302]
aliases: [CRM, ERP, MES, POS]
requires: [data-pipeline-integration]
summary: 把模型輸出接成企業可執行的作業，再把執行結果與業務成效回收
goals:
  - id: g1
    text: 說明 CRM 促銷、ERP 採購的完整流程，並指出 POS 與 MES 的介接位置
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售 r10 推薦分數 0.95，已符合促銷規則，但呼叫 CRM 時下游逾時，尚未確認寄送結果。哪個紀錄方式最合理？
    options:
      A: 只要模型有分數，就記成促銷已完成
      B: 先假設客人已購買，再回寫 POS
      C: 分別記錄預測、寄送待確認與後續兌換狀態
      D: 為了流程簡單，刪除 request_id
    answer: C
    explain:
      A: 模型預測完成不代表 CRM 已執行寄送。
      B: 是否購買要等實際交易資料，不能從推薦分數推定。
      C: 區分預測與執行狀態，才能查失敗環節並追蹤後續成效。
      D: 缺少關聯 ID 會讓推論與作業結果難以對上。
  - id: c2
    goal: g1
    type: choice
    prompt: 另一個需求模型預估商品需求 120 件，現貨 80 件，採購草案需主管核可；工廠另有瑕疵檢驗結果。哪個介接最合理？
    options:
      A: ERP 建 40 件待核草案，MES 接檢驗結果安排複檢
      B: 將瑕疵分數乘上現貨，直接當成採購件數
      C: 把所有結果送 CRM，取代採購與製造流程
      D: 把兩種預測結果存成報表圖片供業務查閱，即可視為完成系統整合
    answer: A
    explain:
      A: 預測應依語意接到對應系統，且保留既定的採購核可步驟。
      B: 瑕疵分數與需求數量不同，不能任意換算採購量。
      C: CRM 管理客戶互動，不能直接取代 ERP 採購及 MES 製造作業。
      D: 圖片能展示結果，但不會觸發作業或回收執行狀態。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-14, guide-1:5-15]
---

## 為什麼需要

模型說「這位客人適合促銷」，卻沒有系統接手寄送，行銷工作仍要人工抄資料。預測品質再高，也不會自動變成企業已完成的作業。

模型結果與企業流程整合，是把輸出接回既有系統與責任人。要先知道結果將支援什麼決策，再決定介接與回報方式。

## 直覺

一次推論回答「模型預測什麼」；企業流程接著回答「誰依規則做什麼」。客戶關係管理（CRM）、企業資源規劃（ERP）、銷售點（POS）與製造執行系統（MES）各有不同位置。

![注意 CRM 接促銷、ERP 接採購；圖內的 POS 回饋與 MES 處置是補充例子。](figure:l21302-business-system-integration-actions)

## 定義與公式

| 系統 | 主要角色 | 與模型的介接位置 |
|---|---|---|
| CRM | 管理客戶與互動 | 推薦結果接到促銷工作 |
| ERP | 整合企業資源與作業 | 需求預測接到採購調整 |
| POS | 記錄銷售交易 | 提供銷售輸入與交易結果（補充） |
| MES | 管理製造執行 | 將檢驗結果接到產線處置（補充） |

:::supplement[來源：Microsoft Learn「Use your prediction model in Power Automate」；Google Developers「Rules of Machine Learning」Rule #2]
對每個輸出，應約定實體 ID、分數或預測量的意義、模型版本、業務規則與執行結果。預測成功、業務執行成功與最後成效，應分開記錄。

例如推薦分數不是購買機率的保證，也不是採購件數。先確認模型輸出的語意，才能把它接成合理動作。
:::

## 走一次流程

指引提出兩條典型路徑：CRM 依推薦執行促銷，ERP 依需求預測調整採購。

### 零售：推薦到 CRM，再回 POS

模型產生推薦結果，CRM 接收後寄送促銷訊息，讓預測接到行銷作業。

:::supplement[來源：Microsoft Learn「Use your prediction model in Power Automate」；教學合成資料 L21302-A]
以下沿用 `L21302-A-requests.json`，補上部門與回饋的完整步驟。

1. POS 歷史交易成為推薦資料來源，推論服務回傳 r01、rec-v2 與分數 0.90。
2. 行銷規則檢查是否達 0.80、對象是否符合寄送條件，再建立 CRM 促銷工作。
3. CRM 回報寄送完成；本例 r10 遇到下游逾時，先記「待確認／重試」，不能記成寄送成功。
4. 之後從 POS 回收兌換與交易，行銷再評估促銷是否達成目的。

r01、r10、r12 都達分數門檻；只有 r01、r12 在本例完成動作。API 成功 7 筆、符合門檻 3 筆、動作完成 2 筆，是三種不同計數。
:::

### 零售：需求預測到 ERP 採購

需求模型預測未來需求，ERP 依預測調整採購，將模型輸出接入資源規劃。

:::supplement[來源：Microsoft Learn「Use your prediction model in Power Automate」；教學合成資料 L21302-A]
POS 的歷史銷量另外供 demand-v1 需求模型使用。合成預測是需求 120 件、可用現貨 80 件，沒有安全庫存與在途量，因此採購草案為 40 件。

ERP 接收商品 ID、預測期間與版本後建立草案，採購人員核可才下單。這是獨立的需求預測案例，不能用 rec-v2 的推薦分數換算 40 件。
:::

### 製造：檢驗到 MES 複檢（補充）

m01 回傳 inspect-v3 的瑕疵分數 0.90，超過教學門檻 0.80。品管規則讓 MES 將工件送複檢，再回寫人工確認與處置結果。

這裡的動作完成是「送入複檢」，不是「證明工件有瑕疵」。m10 同樣遇到下游逾時，先保留待處理狀態，交給流程服務追蹤。

## 怎麼用、怎麼判讀

先找每天真正使用預測的人，問清楚他要看到什麼、下一步要做什麼。介面能傳回分數只是起點，還要接上業務原有的工作流程。

### 換個場景

| 場景 | 接回哪裡 | 要追蹤的結果 |
|---|---|---|
| 指引：推薦促銷 | CRM | 促銷作業有沒有被執行 |
| 指引：需求預測 | ERP | 採購是否依需求調整 |
| 製造檢驗（補充） | MES | 複檢及處置是否完成 |
| 客服分流（補充） | 工單系統 | 是否送到適當承辦人 |
| 物流預警（補充） | 派車系統 | 是否有調度與到貨回報 |

### 逾時之後怎麼處理（補充）

逾時不代表下游一定沒執行，可能只是回覆沒送達。用 request_id 加動作類型作為作業識別，先查狀態再重試，避免寄兩封信或建立兩張採購單。

這稱為冪等處理：同一作業重送，仍只產生一次預期效果。它是維持企業流程正確性的補充，不是模型準確率能代替的條件。

## 常見誤解

- **「模型上線就已經帶來營運價值。」** 還要接到企業實際作業，才能支援決策。
- **「分數高就直接執行全部動作。」** 還要符合業務規則與既有核可流程。（補充）
- **「逾時後重送一定安全。」** 下游可能已執行，必須處理重複作業。（補充）
- **「品質指標提高就代表促銷成功。」** 還要看作業是否執行及實際業務結果。（補充）

## 進階

### 回饋應分開保存（補充）

可分別保存 prediction_status、action_status 與 outcome。第一個表示模型是否完成，第二個表示部門動作是否完成，第三個才是之後的兌換、銷售或人工確認。

這能分辨「推薦不準」與「CRM 沒寄出」兩種問題，避免用錯誤的原因安排模型更新。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-14～5-15）：支持企業整合目的、四種系統名稱、CRM 促銷與 ERP 採購。
- [Microsoft Learn：Use your prediction model](https://learn.microsoft.com/en-us/ai-builder/prediction-use)，Real-time prediction：支持把單筆輸入與預測結果接到工作流程的定位。
- [Microsoft Learn：Use your prediction model in Power Automate](https://learn.microsoft.com/en-us/ai-builder/prediction-pwr-automate)：支持用預測結果驅動後續動作的教學設計。
- [Google Developers：Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)，Rule #2、Rule #39：支持指標與產品目標、預測與最終成效的區分。
- [Microsoft Learn：Design patterns for microservices](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/patterns)，跨服務一致性與補償模式：支持逾時後查詢、重試與作業識別的延伸設計。
- [Microsoft Learn：Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)，Idempotency：支持逾時可能已完成、避免重送造成重複動作的說明。

## 小結

- 模型輸出應接到企業已有的工作與責任人。
- CRM 接促銷、ERP 接採購，POS 與 MES 也有各自介接位置。
- 預測、執行與最終成效要分開記錄。（補充）
- 逾時與重送要避免重複動作，不能只看 API 是否成功。（補充）
