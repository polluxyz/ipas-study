---
id: confusion-matrix
title: 混淆矩陣
aliases: [ Confusion Matrix, TP, FP, FN, TN ]
kind: metric
codes: [ L23303 ]
contrasts:
  - target: roc-auc
    note: 混淆矩陣只記錄一個分類閾值下的四格結果，能直接算 Precision、Recall、Accuracy；ROC-AUC 要掃過多個閾值，單一矩陣算不出來
    source: [ guide-3:5-22, 115-1-S1-Q09 ]
guide_refs: [ guide-3:5-20, guide-3:5-21 ]
gaps:
  - ref: guide-3:5-20
    level: shallow
    ability: 指引只列出四格與名稱；考題要判斷哪些指標能由單一矩陣直接算出，哪些要跨閾值才有（115-1 科1 第9題）
author: codex
status: draft
textbook: v2
summary: 混淆矩陣把實際與預測交叉計數，分清抓到、漏掉、誤報與放行
goals:
  - id: g1
    text: 指定正類與座標方向後，逐筆填出四格並核對總數
  - id: g2
    text: 分辨單一矩陣能算的指標與需要其他資訊的指標
  - id: g3
    text: 說明閾值與行列順序改變時，該如何重新讀矩陣
formula_groups:
  - id: cell-totals
    source: guide-3:5-20
    status: verified
    checked_by: ctx_4f7951475612
  - id: derived-metrics
    source: guide-3:5-21 # Recall 依 recall_score 官方定義；指引 5-21 印刷分母誤植，見頁尾參考來源與召回率頁勘誤。
    status: verified
    checked_by: ctx_4f7951475612
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠以瑕疵品為正類。實際有 6 件瑕疵，其中 5 件被攔下；14 件良品中有 3 件被誤攔。TP、FP、FN、TN 依序是多少？
    options:
      A: 5、3、1、11
      B: 5、11、1、3
      C: 6、3、0、11
      D: 5、1、3、11
    answer: A
    explain:
      A: 5 件抓對、3 件誤攔、1 件漏掉、11 件正確放行，合計 20 件。
      B: 11 件良品被正確放行，屬於 TN，不是誤攔的 FP。
      C: 實際瑕疵還有 1 件被漏掉，不能全部列成 TP。
      D: 漏掉的瑕疵是 1 件 FN，誤攔的良品是 3 件 FP，兩者不可互換。
  - id: c2
    goal: g2
    type: choice
    prompt: 只保留某閾值的 TP=6、FP=2、FN=2、TN=10，沒有每筆分數。哪個數值不能由此唯一決定？
    options:
      A: 準確率
      B: 精確率
      C: ROC-AUC
      D: 召回率
    answer: C
    explain:
      A: 準確率可用正確的 16 筆除以全部 20 筆。
      B: 精確率可用 6 筆 TP 除以 8 筆預測正類。
      C: ROC-AUC 需要跨閾值的排序資訊，四個總數沒有保留這些分數。
      D: 召回率可用 6 筆 TP 除以 8 筆實際正類。
  - id: c3
    goal: g3
    type: choice
    prompt: 矩陣的列依序是「預測正類、預測負類」，欄依序是「實際正類、實際負類」；第一列數字為 5、3，第二列為 1、11。FN 是多少？
    options:
      A: "3"
      B: "5"
      C: "11"
      D: "1"
    answer: D
    explain:
      A: 第一列第二欄是預測正類、實際負類，3 代表 FP。
      B: 第一列第一欄是預測正類、實際正類，5 代表 TP。
      C: 第二列第二欄是預測負類、實際負類，11 代表 TN。
      D: FN 位於預測負類的第二列、實際正類的第一欄，所以是 1。
---

## 為什麼需要

同樣錯四筆，有的模型一直漏掉盜刷，有的卻把正常交易擋下。只報「錯四筆」，無法知道要修哪一種錯誤。

混淆矩陣（Confusion Matrix）把實際類別與預測結果交叉計數，讓誤報與漏報分開呈現。後續的準確率、精確率、召回率，都從這張表開始。

## 直覺

先指定「希望抓到的目標」為正類。這裡盜刷是正類、正常交易是負類。

:::supplement[來源：Google Machine Learning Crash Course：Thresholds and the confusion matrix]
正負不是好壞的意思。
:::

| 實際＼預測 | 預測正類：盜刷 | 預測負類：正常 |
|---|---|---|
| 實際正類：盜刷 | 真正 TP（True Positive）：抓到 | 假負 FN（False Negative）：漏掉 |
| 實際負類：正常 | 假正 FP（False Positive）：誤報 | 真負 TN（True Negative）：正確放行 |

:::supplement[來源：scikit-learn confusion_matrix API；Google Machine Learning Crash Course：Thresholds and the confusion matrix]
名稱的後半 Positive／Negative 指預測結果，前半 True／False 指有沒有判對。先問模型說什麼，再問事實是否支持它。

共用的教學模擬資料有 20 筆交易。分數大於或等於 0.5 就預測為盜刷；圖中的數字由原始標籤與分數計算。

![先讀軸標籤，再找兩格錯誤：FP 是誤報，FN 是漏報。](figure:l23303-confusion-matrix-credit-card)
:::

## 定義與公式

四格是「筆數」，不是百分比。本頁採實際類別為列、預測類別為欄；指引 5-20 原圖則採相反方向，名稱的意義相同。

$$
P=\mathrm{TP}+\mathrm{FN},\qquad N=\mathrm{FP}+\mathrm{TN},\qquad n=P+N
$$

$P$ 是實際正類數、$N$ 是實際負類數，$n$ 是總筆數。TP、FN 都來自實際正類，FP、TN 都來自實際負類。

代入共用資料：$P=6+2=8$、$N=2+10=12$，因此 $n=8+12=20$。四格不重複、不漏計，每筆恰好進一格。

四格還能組成三個基本指標：

$$
\begin{aligned}
\mathrm{Accuracy}&=\frac{\mathrm{TP}+\mathrm{TN}}{n}=\frac{6+10}{20}=0.80\\
\mathrm{Precision}&=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FP}}=\frac{6}{8}=0.75\\
\mathrm{Recall}&=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}}=\frac{6}{8}=0.75
\end{aligned}
$$

Accuracy 問全部判對多少，Precision 問警報有多少是真的，Recall 問實際盜刷抓到多少。數字相同不代表分母意義相同。

:::supplement[來源：scikit-learn precision_score、recall_score API]
三式都要求分母大於 0。空資料的準確率、零筆預測正類時的精確率、零筆實際正類時的召回率，數學上都未定義，不能當成模型得 0 分。
:::

## 算一次（補充）

依共用檔的逐筆標籤與預測分組。表中用「編號：分數」列出全部 20 筆；每組的實際與預測均明示，不靠樣本排序猜答案。

| 實際／預測 | 逐筆資料 | 計入哪格 |
|---|---|---|
| 盜刷／盜刷 | C01:0.95、C02:0.90、C04:0.80、C05:0.75、C06:0.65、C08:0.50 | TP=6 |
| 正常／盜刷 | C03:0.85、C07:0.65 | FP=2 |
| 盜刷／正常 | C10:0.35、C13:0.20 | FN=2 |
| 正常／正常 | C09:0.40、C11:0.30、C12:0.25、C14:0.18、C15:0.15、C16:0.12、C17:0.10、C18:0.08、C19:0.05、C20:0.02 | TN=10 |

C08 剛好等於閾值，仍預測正類；C06、C07 同為 0.65，卻因實際標籤不同進入兩格。加總 $6+2+2+10=20$，與原始筆數吻合。

## 程式（補充）

以下按共用檔 C01 到 C20 的順序放入資料。指定 labels=[1, 0]，讓輸出順序與本頁的表一致。

```python
from sklearn.metrics import confusion_matrix

y = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
scores = [0.95, 0.90, 0.85, 0.80, 0.75, 0.65, 0.65, 0.50, 0.40, 0.35,
          0.30, 0.25, 0.20, 0.18, 0.15, 0.12, 0.10, 0.08, 0.05, 0.02]
pred = [int(s >= 0.5) for s in scores]
print(confusion_matrix(y, pred, labels=[1, 0]))
print(confusion_matrix(y, pred, labels=[0, 1]))
```

```text
[[ 6  2]
 [ 2 10]]
[[10  2]
 [ 2  6]]
```

:::tip[讀碼重點]
函式第一個參數是真實標籤，第二個是預測標籤，列是實際、欄是預測。labels 改順序只會重排格子，不會改變哪筆是誤報或漏報。
:::

## 怎麼用、怎麼判讀

:::supplement[來源：scikit-learn Metrics and scoring；Google Machine Learning Crash Course：Thresholds and the confusion matrix]
看矩陣時，依序確認正類、軸標籤與總數，再看錯誤集中在哪一格。只看對角線深不深，可能忽略少數類別被漏掉。

一張矩陣描述同一批資料在一個固定閾值下的結果。保留四格就能算基本分類指標，卻無法還原每筆分數的先後，所以不能唯一決定 ROC 曲線與 AUC。

閾值降低，預測正類集合只增不減，TP、FP 不減，FN、TN 不增。真正增加多少要回原始分數重算，不能把舊矩陣直接乘一個比例。
:::

### 換個場景（補充）

| 場景 | 正類 | 先看哪格 |
|---|---|---|
| 醫療初篩 | 確實罹病 | FN 告訴你漏掉多少病人；FP 反映額外複檢負擔 |
| 製造品檢 | 確實有瑕疵 | FN 對應流出的瑕疵品，FP 對應被誤攔的良品 |
| 客服分流 | 需要人工處理 | FN 可能延誤處理，FP 會占用客服量能 |

以上是把四格定義套到不同任務的教學延伸；正類由任務決定，不固定是疾病或瑕疵。

## 常見誤解

- **混淆矩陣一定把 TP 放左上。** 先讀軸與類別順序，不能記格子位置。（補充）
- **精確率與召回率同為 0.75，所以兩者一樣。** 本例的預測正類與實際正類剛好都是 8 筆，問題仍然不同。（補充）
- **把矩陣轉置就改變模型能力。** 若軸標籤同步交換，只是另一種呈現。（補充）
- **四格夠算一切。** 跨閾值指標還需要逐筆分數；四格也不會告訴你每次誤判的業務成本。（補充）

## 進階

### 多類別怎麼看（補充）

多類別矩陣會擴成「類別數 × 類別數」。每格仍是實際類別與預測類別的交叉計數；要算某一類的精確率與召回率，可把該類當正類，其餘合成負類。

### 參考來源

- 學習指引科目 3，5-20～5-21（支持：四格、總數、三個基本指標；Recall 印刷公式的勘誤見召回率頁）。
- [scikit-learn confusion_matrix API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.confusion_matrix.html)（支持：軸向、程式、類別順序、多類別）。
- [scikit-learn Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)（支持：單一矩陣能提供的資訊與跨閾值限制）。
- [scikit-learn precision_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_score.html)、[recall_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.recall_score.html)（支持：分母為零）。
- [Google 機器學習速成課：閾值與混淆矩陣](https://developers.google.com/machine-learning/crash-course/classification/thresholding)（支持：名稱讀法、閾值與錯誤種類；取教學組織方式）。

## 小結

- 先固定正類與軸標籤，再填 TP、FP、FN、TN，四格總和應等於資料筆數。
- 本例閾值 0.5 時四格為 6、2、2、10；準確率 0.80，精確率與召回率各 0.75。
- 單一矩陣可算固定閾值指標；ROC-AUC 還需要分數排序資訊。
- 預測門檻改了，要回逐筆分數重新計數。
