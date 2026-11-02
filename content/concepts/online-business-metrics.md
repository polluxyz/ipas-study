---
id: online-business-metrics
title: 線上應用與業務成效指標
kind: metric
codes:
  - L21302
aliases:
  - CTR
  - CVR
  - ROI
  - 留存率
requires:
  - inference-service-api
  - f1-score
summary: 應用指標確認模型行為，業務指標確認行為是否帶來價值
goals:
  - id: g1
    text: 依推薦、分類與異常偵測的目標選擇應用指標
  - id: g2
    text: 把轉換、節省、留存與 ROI 接到技術指標，辨認高分卻無業務改善的情況
formula_groups:
  - id: business-rates
    source: 'CTR：https://support.google.com/google-ads/answer/2615875?hl=en；使用者層級轉換：https://support.google.com/analytics/answer/12922540?co=GENIE.Platform%3DDesktop&hl=en；第 N 日留存：https://amplitude.com/docs/analytics/charts/retention-analysis/retention-analysis-calculation#return-on；本頁再限定合格入口母群、同日申辦及第 7 日結算'
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21302-C
  - id: classification-quality
    source: https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
  - id: net-return
    source: https://support.google.com/google-ads/answer/1722066?hl=en
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 1000 件工件只有 10 件瑕疵，模型全部判合格，準確率仍有 99%。如果怕警報太多耗盡複檢人力，該怎麼評估？
    options:
      A: 維持準確率為唯一門檻，達題設分數就視為漏檢和誤報均受控
      B: 只看召回率並把所有工件報警，抓到全部瑕疵就認定複檢負擔合理
      C: 以瑕疵為正類，搭配精確率、召回率或 F1 與漏檢成本
      D: 以服務可用率代替警報精確率，只要服務持續在線就視為異常辨識可靠
    answer: C
    explain:
      A: 多數正常工件會讓整體準確率看起來很高，仍可能漏掉全部瑕疵。
      B: 全部報警雖能抓到瑕疵，也會把正常件送去複檢，無法確認人力負擔。
      C: 精確率反映警報有多少是真的，召回率及 F1 補上漏檢資訊。
      D: 可用率衡量服務提供能力，不能取代標註後的模型品質。
  - id: c2
    goal: g2
    type: choice
    prompt: 客服 A、B 各展示 15 次，點擊分別 6、9 次，申辦完成各 3 次。哪個結論有資料支持？
    options:
      A: CTR 從 40% 到 60%，入口轉換率維持 20%，只支持點擊改善
      B: CTR 從 40% 到 60%，入口轉換率同步相對增 50%，支持業務改善
      C: CTR 與入口轉換率都從 40% 到 60%，因為點擊等同完成申辦
      D: CTR 從 40% 到 60%，就證明所有客群營收都會相對增 50%
    answer: A
    explain:
      A: 點擊比例上升，但完成申辦的比例沒有改變。
      B: 轉換各 3/15，沒有增加。
      C: 點擊與申辦是不同事件，入口轉換率仍是各 3/15。
      D: 小型合成資料且非隨機分派，不能推論所有客群的營收。
  - id: c3
    goal: g2
    type: choice
    prompt: 一週 AI 協作節省人時折合 300 元，新增系統及覆核成本合計 200 元；採淨效益除以新增成本。ROI 是多少？
    options:
      A: 150%
      B: 50%
      C: 250%
      D: 只知道模型 F1 才能算
    answer: B
    explain:
      A: 300/200 是毛效益相對成本，沒有扣新增成本。
      B: 淨效益 100 元除以新增成本 200 元為 50%。
      C: 把成本再加到效益會重複計算。
      D: 這個成本效益定義不需要 F1，但節省及成本資料必須可信。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-20
  - guide-1:4-6
  - guide-1:3-49
---

## 為什麼需要

推薦有人點，卻未必有人購買；客服答得準，卻未必縮短處理時間。模型行為與最終價值之間，還隔著使用者及部門流程。

指引將應用指標與業務指標分層，並建議技術加業務雙軌追蹤。工程要知道模型是否正常，營運則要知道它是否改善目標。

## 直覺

每個指標先配一個動作：展示後點擊、預測後核對標註、使用後完成申辦。把分母與觀察時間寫清楚，數字才有一致意義。

| 應用 | 可先看什麼 | 為什麼 |
|---|---|---|
| 推薦 | 點擊率（CTR） | 是否吸引使用者互動 |
| 分類 | 準確率（Accuracy）、F1 | 是否分類正確，是否兼顧正類 |
| 異常偵測 | 精確率（Precision） | 警報有多少是真的異常 |

:::supplement[來源：Google Machine Learning Crash Course「Accuracy, recall, precision, and related metrics」]
異常很少時，全部判正常也可能有很高準確率。精確率適合關注誤報負擔，還須搭配召回率與漏報成本；F1 以同等權重綜合精確率、召回率，不會自動反映不同錯誤成本。
:::

## 定義與公式

指引的業務層包括轉換率、成本節省、客戶留存及投資報酬率（ROI）。指標應依專案目標選擇，不能看到高分才事後更換成功條件。

### 比率先說清楚分母（補充）

$$
\begin{aligned}
\mathrm{CTR}&=C/E,&\mathrm{CVR}_{\mathrm{entry}}&=V/U\\
\mathrm{Retention}_7&=R_7/U_0
\end{aligned}
$$

$C$ 是點擊次數，$E$ 是展示次數；$V$ 是完成轉換的人數，$U$ 是合格入口人數。本例一人一請求、一展示最多點一次，轉換是同日完成申辦，採入口轉換率。

$U_0$ 是起始合格使用者，$R_7$ 是這群人在第 7 日仍有使用的人數。分母為零時比例未定義；廣告平台可能以互動次數定義 CVR，不能不換分母就直接比較。

入口 CVR 採 Google Analytics 的使用者層級事件比例，再把母群限為本例合格入口使用者、事件限為同日完成申辦。

第 7 日留存採 Amplitude 的 Return On：起始母群中恰於第 7 日回訪者的比例，不是第 7 日以後曾回訪的累計比例。

客服 30 次展示有 15 次點擊，CTR=15/30=50%；6 人轉換，入口 CVR=6/30=20%；第 7 日 18 人仍使用，留存率=18/30=60%。

### 模型品質

準確率衡量整批樣本有多少被分對，以正確預測件數除以總件數；科目 1 指引 3-49 已說明這個定義。二元分類可寫成：

$$
\mathrm{Accuracy}=\frac{\mathrm{TP}+\mathrm{TN}}{\mathrm{TP}+\mathrm{FP}+\mathrm{FN}+\mathrm{TN}}
$$

TP、FP、FN、TN 分別是真正、假正、假負與真負的件數。分子是分類正確的件數，分母是全部件數。

:::supplement[來源：Google Machine Learning Crash Course「Accuracy, recall, precision, and related metrics」；本頁製造教學合成資料]
製造以瑕疵為正類，精確率與 F1 進一步衡量警報品質：

$$
\begin{aligned}
\mathrm{Precision}&=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FP}},\quad
\mathrm{F1}=\frac{2\mathrm{TP}}{2\mathrm{TP}+\mathrm{FP}+\mathrm{FN}}
\end{aligned}
$$

同批工件的離線重播得到 TP=8、FP=2、FN=2、TN=18。準確率為 26/30≈86.67%，精確率為 8/10=80%，F1=16/20=0.8。

線上推論失敗不會被當成合格預測。公式分母為零時須明示工具政策，不硬填 100%。
:::

### 投資報酬率

$$
\mathrm{ROI}=\frac{B-K}{K}\times100\%
$$

$B$ 是同一期間可歸因的毛效益，$K$ 是全部新增成本，且 $K>0$。ROI 先扣成本再除以成本，衡量每單位投入帶來多少淨效益；科目 1 指引 4-6 已列出這個計算方式。

:::supplement[來源：本頁人時折算教學假設；Google Ads「ROI」]
本例省下 30 案各 2 分鐘，每分鐘 5 元，毛效益 300 元；新增成本 200 元，ROI=(300-200)/200=50%。

省下的人時不一定立刻變成現金收入，計入 ROI 前須說明折算與歸因方式。不得一面用節省成本當效益，一面又重複扣除相同項目。
:::

## 算一次（補充）

共用資料 L21302-C-requests.json 中，客服與製造各 30 筆，A、B 固定各 15 筆。這是合成觀測，不是隨機 A/B 實驗，不能憑差異認定因果。

| 項目 | A | B | 判讀 |
|---|---|---|---|
| 客服點擊率 | 6/15=40% | 9/15=60% | 增 20 個百分點 |
| 客服入口轉換率 | 3/15=20% | 3/15=20% | 沒有提升 |
| 第 7 日客服留存 | 9/15=60% | 9/15=60% | 沒有提升 |
| 製造重工率 | 3/15=20% | 2/15≈13.33% | 減少 1 件，仍須追蹤 |

另設客服意圖分類的版本比較：A 組使用舊版，離線 F1=0.88；B 組使用新版，離線 F1=0.94。這是獨立教學假設，與製造工件的 F1=0.8 不同，也不是從這 30 次客服請求重算的分數。

兩組客服入口轉換率仍各為 20%，示範高模型分數卻沒有業務提升。應調查入口設計、模型目標與使用流程；固定分組仍不能證明模型換版造成差異。

重工率不是模型的假負率。重工還可能來自人工覆核或製程原因，不能直接用重工件數推回模型漏報。

## 程式（補充）

以下按共用索引重算點擊、轉換與重工計數。全部欄位是固定合成結果，沒有重新抽樣或訓練模型。

```python
for arm, ids in [("A", range(1, 16)), ("B", range(16, 31))]:
    clicks = sum(i <= 6 or 16 <= i <= 24 for i in ids)
    conversions = sum(i <= 3 or 16 <= i <= 18 for i in ids)
    rework = sum(i <= 3 or 16 <= i <= 17 for i in ids)
    print(arm, f"點擊 {clicks}/15={clicks/15:.0%}",
          f"轉換 {conversions}/15={conversions/15:.0%}",
          f"重工 {rework}/15={rework/15:.2%}")
benefit, cost = 30 * (10-8) * 5, 200
print(f"毛節省 {benefit} 元 ROI {(benefit-cost)/cost:.0%}")
```
```text
A 點擊 6/15=40% 轉換 3/15=20% 重工 3/15=20.00%
B 點擊 9/15=60% 轉換 3/15=20% 重工 2/15=13.33%
毛節省 300 元 ROI 50%
```

## 怎麼用、怎麼判讀

使用雙軌表，把技術品質與業務目標放在同一個回收週期。指引建議每日觀察服務及使用、每週彙整錯誤與回饋、每月重新評估模型。

| 軌道 | 客服例子 | 製造例子 |
|---|---|---|
| 技術／應用 | 回應耗時、分類 F1、推薦 CTR | 延遲、準確率、警報精確率 |
| 業務 | 完成申辦、處理成本、留存 | 重工、人工成本、ROI |

:::supplement[來源：Google「Measuring success」「Framing an ML problem」]
先訂業務目標，再定義模型需要支援的行為。分別觀察主功能與降級流程：FAQ 回得快，不代表申辦完成；人工複檢完成，也不代表模型恢復。
:::

### 換個場景

| 場景 | 應用指標 | 業務連結 |
|---|---|---|
| 指引：推薦 | CTR | 轉換、留存 |
| 指引：分類／異常偵測 | 準確率、F1、精確率 | 成本節省、ROI |
| 客服（補充） | 回應品質與耗時 | 工單處理時間、申辦完成 |
| 製造（補充） | 瑕疵辨識與誤報 | 重工、複檢成本 |
| 交通（補充） | 事件警報品質 | 處置時間及資源調度 |

## 常見誤解

- **「CTR 上升，轉換一定增加。」** 點擊與最終轉換是不同動作。
- **「模型分數提高就代表專案成功。」** 還需核對業務目標與真實使用結果。
- **「提升 20 個百分點等於提升 20%。」** 40% 到 60% 是增 20 個百分點、相對增 50%。（補充）
- **「全都判正常的 99% 準確率就是好模型。」** 類別不平衡時，還要檢查正類與錯誤成本。（補充）

## 進階

### 回饋時間要對齊（補充）

點擊通常較快回收，留存與重工結果較晚才知道。應保存事件與模型版本，等相同追蹤期結束再比較；不能把未滿 7 日的使用者直接當成不留存。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-20）：支持指標選用、雙軌制與日／週／月回收；本節未展開的比率公式與算例另列補充。
- 科目 1 學習指引（同上；guide-1:4-6）：支持投資報酬率的原式；人時折算與本例數字另列補充。
- 科目 1 學習指引（同上；guide-1:3-49）：支持準確率以正確預測件數除以總件數的定義；精確率、F1 公式與製造算例另列補充。
- [Google Ads：CTR](https://support.google.com/google-ads/answer/2615875?hl=en)，Definition：支持展示點擊比率。
- [Google Ads：Conversion rate](https://support.google.com/google-ads/answer/2684489?hl=en)，Definition：支持須明確約定轉換事件與互動分母。
- [Google Analytics：User acquisition report](https://support.google.com/analytics/answer/12922540?co=GENIE.Platform%3DDesktop&hl=en)，User key event rate：支持完成指定事件的使用者占比；本頁限定合格入口母群與同日申辦。
- [Amplitude：Retention calculation](https://amplitude.com/docs/analytics/charts/retention-analysis/retention-analysis-calculation#return-on)，Return On：支持起始母群中恰於第 N 日回訪的比率；本頁取 N=7。
- [Google Ads：ROI](https://support.google.com/google-ads/answer/1722066?hl=en)，How ROI works：支持淨效益相對成本；人時折算為本頁假設。
- [Google Crash Course：Classification metrics](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)，Accuracy、Precision、F1：支持分類指標與不平衡限制。
- [Google：Measuring success](https://developers.google.com/machine-learning/managing-ml-projects/success)，Business metrics、Keep in mind：支持模型高分不保證業務改善的教學思路。
- [Google：Framing an ML problem](https://developers.google.com/machine-learning/problem-framing/ml-framing)，Define the success metrics：支持以目標訂成功條件；第 7 日留存與入口 CVR 是本頁明定的觀測口徑。

## 小結

- 推薦、分類、異常偵測要依目標選指標。
- 技術與業務要雙軌追蹤，不能互相取代。
- 點擊、轉換與留存都有自己的事件及分母。（補充）
- ROI 要明訂期間、歸因及新增成本。（補充）
