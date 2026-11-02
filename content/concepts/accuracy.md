---
id: accuracy
title: 準確率
aliases: [Accuracy, 正確率]
kind: metric
codes: [L23303]
requires: [confusion-matrix]
contrasts:
  - target: f1-score
    note: Accuracy 把所有預測一視同仁，會被大量的真負例撐高；F1 只看正類的 Precision 與 Recall，不受真負例數量影響
    source: [guide-3:5-21, 114-2-S1-Q10]
  - target: recall
    note: Accuracy 是整體答對的比例，少數類別全漏掉也能很高；Recall 專看實際為正的樣本抓到多少
    source: [guide-3:5-21, 115-1-S3-Q12]
guide_refs: [guide-3:5-21, guide-3:4-26, guide-3:5-25]
gaps:
  - ref: guide-3:5-21
    level: covered
    ability: 指引的定義與「95% 負類」例子，足以回答 115-1 科3 第12題與 114-2 科3 第19題
author: codex
status: draft
textbook: v2
summary: 準確率計算全部樣本中判對的比例，先與全猜多數類的基準比較
goals:
  - id: g1
    text: 從同一張混淆矩陣算出準確率並說明分母
  - id: g2
    text: 比較準確率與全猜多數類的基準，辨認少數類別被漏掉的問題
  - id: g3
    text: 判斷準確率的適用條件、空資料限制與互補指標，依多模態輸出選對評估對象
formula_groups:
  - id: accuracy
    source: guide-3:5-21
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: m4-accuracy-links
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.accuracy_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: m4-top5-complement
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.top_k_accuracy_score.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 以盜刷為正類，TP=6、FP=2、FN=2、TN=10，準確率是多少？
    options:
      A: 75%
      B: 80%
      C: 60%
      D: 90%
    answer: B
    explain:
      A: 75% 是本例的精確率與召回率，不是全部判對的比例。
      B: 正確的 TP 與 TN 合計 16 筆，除以全部 20 筆是 80%。
      C: 60% 是這批資料全猜正常的基準，不是目前模型的結果。
      D: 全部 20 筆中，FP 與 FN 各錯 2 筆；只扣其中一種會算成 1−2/20=90%，漏計另一種錯誤。
  - id: c2
    goal: g2
    type: choice
    prompt: 100 件產品中 95 件良品、5 件瑕疵；系統全部判為良品。最合理的說法是什麼？
    options:
      A: 準確率高，所以已能偵測大部分瑕疵
      B: 資料不平衡，因此準確率沒有定義
      C: 準確率只有 5%，因為正類是瑕疵
      D: 準確率為 95%，但瑕疵召回率為 0%
    answer: D
    explain:
      A: 全部判為良品並沒有抓到任何瑕疵，高分由多數類別貢獻。
      B: 只要有樣本就能計算準確率，不平衡影響的是判讀。
      C: 準確率計算所有判對的樣本，不只數正類。
      D: 95 件良品全部判對，但 5 件瑕疵全部漏掉。
  - id: c3
    goal: g3
    type: choice
    prompt: 甲資料的兩類人數與兩種誤判代價都接近；乙資料中正常交易占 99%，模型準確率為 99%。哪個評估方案較合理？
    options:
      A: "甲可用準確率作摘要；乙再查盜刷召回率、精確率與混淆矩陣"
      B: "甲乙都只看準確率；既已納入全部樣本，各類漏報與誤報也都能由這個分數判定"
      C: "甲再查各類誤判；乙已有 99% 準確率，可據此認定已抓到大部分盜刷"
      D: "甲類別均衡不宜用準確率；乙則只需看準確率"
    answer: A
    explain:
      A: "甲類別與誤判代價接近，可用準確率作摘要；乙即使全猜正常也能得 99%，須另看盜刷偵測與誤報。"
      B: "納入全部樣本不表示保留各類錯誤資訊；同樣的準確率可能對應不同的盜刷漏報與誤報。"
      C: "乙全猜正常也能達到 99%，因此高準確率不能證明已找出大部分盜刷。"
      D: "類別均衡且誤判代價接近是準確率較易解讀的條件；乙反而需要補看少數類別指標。"
  - id: c4
    goal: g3
    type: choice
    prompt: 測試集沒有任何樣本時，準確率應怎麼報？
    options:
      A: 回報 100%，因為沒有判錯的樣本
      B: 回報 0%，因為沒有判對的樣本
      C: 回報無可評估樣本，準確率未定義
      D: 用上一次測試的準確率代替這次結果
    answer: C
    explain:
      A: 零筆錯誤除以零筆總數不能推得全部判對。
      B: 零筆正確除以零筆總數是 0/0，不能直接記為 0。
      C: 分母為零，應先說明沒有資料；本專案套件對空輸入也會拋出例外。
      D: 上次的分數來自另一批資料，不能冒充這次沒有觀測值的結果。
  - id: c5
    goal: g3
    type: short
    prompt: 多模態系統的姿態分類、ICU 警示誤報與摘要能否都用 Accuracy 驗收？另說明 20 筆交易的 Accuracy=0.80 為何不等於 F1。
    key_points: ["姿態真值與預測可算分類準確率，警示另看FPR與漏報，摘要另看ROUGE和事實", "同批交易F1=0.75，只使用TP、FP、FN，Accuracy還使用TN", "醫療仍須檢查隱私、時點同步與解釋性"]
---

## 為什麼需要

分類完成後，最直觀的問題是「全部判對幾成」。準確率（Accuracy；也稱正確率）讓不同模型在同一份資料上有一個容易理解的整體摘要。

但判對的樣本都來自哪一類，也很重要。若正常交易占大多數，高準確率可能只是正常交易判得多，盜刷仍全部漏掉。

## 直覺

從混淆矩陣選出兩格正確結果：抓對盜刷的 TP，以及正常放行的 TN。把這兩格加起來，再問它們占全部交易多少。

精確率只看「預測正類」的那群，召回率只看「實際正類」的那群。準確率的分母則包含兩類、四格，回答的範圍更廣。

## 定義與公式

$$
\mathrm{Accuracy}=\frac{\mathrm{TP}+\mathrm{TN}}{\mathrm{TP}+\mathrm{FP}+\mathrm{FN}+\mathrm{TN}}=\frac{\mathrm{TP}+\mathrm{TN}}{n}
$$

TP 是正類判對數，TN 是負類判對數；FP 是誤報數，FN 是漏報數。$n$ 是四格加總的總筆數，須大於 0。

代入共用資料：$(6+10)/(6+2+2+10)=16/20=0.80$，即 80%。它在 0 到 1 之間，1 代表這批資料全部判對。

:::supplement[來源：scikit-learn accuracy_score API]
這裡每筆樣本等權重，且每筆只有一個真實類別與一個預測類別。空資料時分母是 0，準確率未定義，應先回報沒有評估樣本。

本專案的 scikit-learn 1.9.1 對空輸入直接拋出 ValueError，不會回傳 0；下方程式也會實際捕捉這個例外。
:::

## 算一次（補充）

共用的 20 筆信用卡交易有 8 筆盜刷、12 筆正常。分數大於或等於 0.5 判為盜刷，四格仍是 TP=6、FP=2、FN=2、TN=10。

1. 判對：6 筆盜刷加 10 筆正常，共 16 筆。
2. 判錯：2 筆誤報加 2 筆漏報，共 4 筆。
3. 用判對數除以總數：16/20=0.80；反算 1−4/20 也等於 0.80。

接著建立不需模型的基準：全部猜正常。這樣只有 12 筆正常判對，準確率 12/20=0.60；8 筆盜刷全部漏掉，召回率是 0。

| 方法 | 判對／全部 | 準確率 | 盜刷召回率 |
|---|---|---|---|
| 全部猜正常 | 12/20 | 0.60 | 0 |
| 閾值 0.5 的模型 | 16/20 | 0.80 | 0.75 |

模型比這個基準高 0.20，也確實抓到部分盜刷。這仍只是小型教學模擬資料上的比較，不是實際上線成績。

### 同批四指標與成本（補充）

沿用 C01–C20、正類盜刷、分數 ≥ 0.5 的同一批資料。

先在[混淆矩陣](../confusion-matrix/#算一次補充)核對 TP=6、FP=2、FN=2、TN=10，再讀[準確率](../accuracy/#算一次補充)的 16/20=0.80、[精確率](../precision/#算一次補充)與[召回率](../recall/#算一次補充)的 6/8=0.75，最後讀[F1](../f1-score/#四格計數與零分母補充)的 12/16=0.75。

誤報成本高，先查 Precision 及 FP；漏報成本高，先查 Recall 及 FN；要兼顧兩者可並列 F1，但成本不等時仍看實際代價。

Accuracy 包含 TN，適合作整體摘要，無法替代前述取捨。

資料索引與唯讀來源版本記在 `L23303-M4-E-metric-cases.json`。

## 程式（補充）

資料順序與共用檔相同。函式要的是每筆預測標籤，先把分數轉成 0 或 1，再計算準確率。

```python
from sklearn.metrics import accuracy_score

y = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
scores = [0.95, 0.90, 0.85, 0.80, 0.75, 0.65, 0.65, 0.50, 0.40, 0.35,
          0.30, 0.25, 0.20, 0.18, 0.15, 0.12, 0.10, 0.08, 0.05, 0.02]
pred = [int(s >= 0.5) for s in scores]
print(f"模型：{accuracy_score(y, pred):.2f}")
print(f"全猜正常：{accuracy_score(y, [0] * len(y)):.2f}")
try:
    accuracy_score([], [])
except ValueError as error:
    print(type(error).__name__)
```

```text
模型：0.80
全猜正常：0.60
ValueError
```

:::tip[讀碼重點]
accuracy_score 不會替你選閾值；pred 才是閾值決策之後的結果。要比較模型，先讓它們使用相同的評估資料。
:::

## 怎麼用、怎麼判讀

類別比例相近時，準確率是方便的整體摘要。遇到類別不平衡，必須再看混淆矩陣，尤其檢查少數正類的召回率。

指引的例子是 95% 樣本屬於負類：全猜負類也得到 95% 準確率。高分是真的「判對很多筆」，但不能解讀為「有抓到正類」。

:::supplement[來源：Google Machine Learning Crash Course：Accuracy, recall, precision, and related metrics]
即使類別均衡，漏報與誤報代價差很多時，也不宜只用準確率做決策。它把兩種錯誤各算錯一筆，沒有替高風險錯誤加重。
:::

### 換個場景

| 場景或條件 | 判讀重點 |
|---|---|
| 兩類分布接近 | 指引建議可用準確率概括整體結果 |
| 負類占 95% | 先與全猜負類的 95% 基準比，再看正類抓到多少 |
| 製造品檢（補充） | 瑕疵很少時，分開看漏檢數與誤攔良品數 |
| 客服意圖分類（補充） | 大量常見意圖可能掩蓋少見但重要的申訴分類 |

補充場景都是「多數類別可能撐高整體分數」的應用；不是換個產業就換準確率公式。

### 多模態醫療與互動的分母

以下任務與指標配對承接科目 1 指引 3-78～3-79，完整對照見段末的多模態責任頁；各指標的分母判讀、事實一致性與警報負擔檢查則是本頁補充延伸。

影像、病歷、生命徵象的評估須按輸出分開。

病灶與報告使用影像、病歷：病灶分類可算 Accuracy，報告文字看 ROUGE；另補查事實一致性（補充）。

慢性病用生理訊號及病歷做風險分類，並列 Accuracy 與 FPR。

ICU 用生命徵象、醫師筆記做警示，指引列出 FPR；本頁另補查漏報與警報負擔（補充）。

患者隱私、檢查時點同步、決策解釋都要另驗，分類高分不會自動滿足這些條件。

Avatar／展覽以語音與手勢驅動展示，教室以語音、手勢互動，會議則有即時手勢與轉寫。

姿態 Accuracy 比較姿態真值與預測；WER 衡量轉寫錯誤；Latency 衡量明訂起訖的等待時間。

三者不可互代，且須查語音／手勢同步與資源限制。

完整任務對照見[多模態醫療](../multimodal-application-evaluation/#醫療診斷與生成是不同任務)與[互動評估](../multimodal-application-evaluation/#互動姿態轉寫速度分開量)。

本頁只教分類的分母與選用限制，並不以 Accuracy 一項代表生成、轉寫或互動品質。

來源案例索引為 `L21104-M4-E-metric-links.json`。

## 常見誤解

- **準確率高就代表少數類別抓得好。** 全猜正常的基準即可反駁。
- **準確率與精確率只是譯名不同。** 前者分母是全部樣本，後者分母是預測正類。
- **準確率只能用在二元分類。** 單標籤多類別也能逐筆數對錯。（補充）
- **準確率越高一定越適合部署。** 若多抓到的正常交易伴隨更多高成本漏報，仍須依風險與其他指標判讀。（補充）

## 進階

### 分類與迴歸的分數別混用（補充）

本頁準確率評估離散類別是否判對。迴歸預測連續數值，應改用誤差指標或決定係數；決定係數 0.85 不能說成「準確率 85%」。

### Top-5 名稱易誤讀（補充）

科目 1 指引 3-49 在 Top-5 錯誤率項下說明真實類別進入前五名時算正確，描述的是命中條件。閱讀時要分清命中率與錯誤率，不能把這句解讀成命中就算錯誤。

每筆恰有一個真值、候選排序規則固定且資料非空時，由命中／未命中互斥且完整的兩種結果自行推導，Top-5 Error 是 1 減 Top-5 命中率，例如 100 筆中 90 筆命中，錯誤率是 10%。

它與本頁只看最終一個預測類別的 Accuracy 也不同；完整排序評估見 [[top-k-error]]。

### 參考來源

- 科目 1 學習指引，3-49、3-78～3-80：支持分類評估、Top-5 名稱易誤讀、多模態醫療及互動的任務與限制。
- [scikit-learn top_k_accuracy_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.top_k_accuracy_score.html)：支持前 k 名命中的定義；錯誤率的互補關係由本站按命中／未命中推導。
- 既有責任頁 [多模態應用與評估設計](../multimodal-application-evaluation/)：支持醫療、互動導讀；本站案例索引見 L21104-M4-E-metric-links.json。
- 學習指引科目 3，5-21（支持：公式、類別均衡條件、95% 負類的限制）。
- [scikit-learn accuracy_score API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.accuracy_score.html)（支持：定義與公式、程式、多類別；空資料由公式檢查分母）。
- [Google 機器學習速成課：分類指標](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)（支持：成本不同時的限制；取比較基準的教學思路）。
- [scikit-learn Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)（支持：分類與迴歸指標的區別）。

## 小結

- 準確率把 TP 與 TN 相加，再除以四格總數；空資料沒有定義。
- 共用例子為 16/20=0.80，高於全猜正常的 0.60。
- 類別均衡時可作整體摘要；類別不平衡時容易掩蓋少數類別漏報。
- 選模型時搭配精確率、召回率與混淆矩陣，並先確認兩種錯誤的代價。
