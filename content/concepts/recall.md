---
id: recall
title: 召回率
aliases: [Recall, 敏感度, Sensitivity, 真陽率, TPR, 查全率]
kind: metric
codes: [L23303]
requires: [confusion-matrix]
guide_refs: [guide-3:5-21, guide-3:5-22, guide-3:4-26]
gaps:
  - ref: guide-3:5-22
    level: shallow
    ability: 指引的 ROC 一節只寫「真正率」，沒有說它就是 Recall；考題用敏感度、TPR 等不同名稱（115-1 科1 第8題）
author: codex
status: draft
textbook: v2
summary: 召回率只看實際正類，其中有多少被模型找出來
goals:
  - id: g1
    text: 用 TP 與 FN 算召回率，辨認敏感度、TPR 的同義關係
  - id: g2
    text: 區分沒有實際正類與沒有預測正類時的召回率
  - id: g3
    text: 依漏報成本選指標，並說明降低閾值的效果與代價
formula_groups:
  - id: recall
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.recall_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: m4-recall-cases
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.recall_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 共 20 筆交易，實際有 8 筆盜刷；模型抓到 6 筆並漏掉 2 筆，另誤報 3 筆正常交易。召回率是多少？
    options:
      A: 6/9≈0.667
      B: 6/20=0.300
      C: 2/8=0.250
      D: 6/8=0.750
    answer: D
    explain:
      A: 6/9 是把誤報計入分母的精確率，不是召回率。
      B: 6/20 是抓到的盜刷占全部交易的比例；召回率的分母應是實際盜刷的 8 筆。
      C: 2/8 是實際盜刷中被漏掉的比例，與召回率互補。
      D: 實際正類是 TP+FN=8，其中抓到 6 筆，所以召回率為 0.75。
  - id: c2
    goal: g2
    type: choice
    prompt: 兩批測試資料都沒有發出正類警報：甲有 8 筆實際正類，乙沒有任何實際正類。兩者的召回率如何報？
    options:
      A: 兩者都未定義，因為沒有預測正類
      B: 甲為 0，乙未定義
      C: 甲為 1，乙為 0
      D: 兩者都為 0，因為沒抓到正類
    answer: B
    explain:
      A: 召回率分母是實際正類數，甲的分母仍為 8。
      B: 甲的 0/8 為 0；乙的 0/0 未定義，兩者不能混為一談。
      C: 甲把全部正類漏掉，召回率不會是 1。
      D: 乙的分母為零，若程式回傳 0 也須說明那是約定。
  - id: c3
    goal: g3
    type: choice
    prompt: 模型分數不變，分數達閾值就判正類。把閾值降低，最穩妥的結論是什麼？
    options:
      A: 召回率一定嚴格上升，精確率一定下降
      B: 只會增加 TP，不會增加 FP
      C: 有實際正類時，召回率不會下降，但可能增加誤報
      D: 模型權重會自動更新，所以兩類都更容易判對
    answer: C
    explain:
      A: 若沒有新正類跨過閾值，召回率可不變；精確率也不保證單調。
      B: 新納入的樣本可能是負類，因此 FP 也可能增加。
      C: 已抓到的正類不會被移出，TP 不減；同時可能納入更多負類。
      D: 改決策閾值不會重訓模型，也不會更新權重。
  - id: c4
    goal: g3
    type: short
    prompt: 同批瑕疵 A 的 P=0.6、R=0.75；B 的 P=0.5、R=1，兩者 F1 都是 2/3。若 FP 每件 50 元、FN 每件 1000 元，應怎麼選？
    key_points: ["A為FP2、FN1，成本1100元；B為FP4、FN0，成本200元", "此假設下B較合適，相同F1不等於相同成本", "仍核對資料、正類、閾值與成本假設"]
---

## 為什麼需要

對癌症初篩或詐欺偵測而言，放過真正有問題的樣本可能造成嚴重後果。這時只問「全部判對多少」不夠，還要問「實際目標抓到了多少」。

召回率（Recall；也稱敏感度 Sensitivity）以實際正類為出發點。漏掉的正類越多，召回率越低。

## 直覺

在混淆矩陣中，先圈出「實際正類」那一列。每筆正類不是進 TP 被抓到，就是進 FN 被漏掉。

召回率是在這群真實目標中，計算抓到的比例。正常交易是否誤報不在分母裡，所以不能只靠召回率評斷所有風險。

## 定義與公式

$$
\mathrm{Recall}=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}}
$$

TP 是實際正類且被正確判成正類的筆數，FN 是實際正類卻被判成負類的漏報數。分母是全部實際正類，須大於 0。

共用資料中，$6/(6+2)=0.75$。八筆實際盜刷抓到六筆，漏掉兩筆，不能解讀為八次警報有六次是真的。

:::caution[注意]
指引 5-21 的印刷公式把分母誤寫為 TP+FP，與同頁「實際正類」的文字定義不符。本頁採 TP+FN，與 scikit-learn recall_score 的定義一致。
:::

:::supplement[來源：scikit-learn recall_score API；Google Machine Learning Crash Course：Accuracy, recall, precision, and related metrics]
召回率也叫真正率（True Positive Rate，TPR；別名真陽率），就是 ROC 曲線的縱軸。不要與描述負類正確放行比例的特異度混淆。

如果有實際正類、卻一筆都沒抓到，召回率是 0。若資料根本沒有實際正類，分母是 0，召回率未定義；套件用 zero_division 設定回傳值，是另外的報告慣例。
:::

## 算一次（補充）

共用教學資料有 20 筆交易，以盜刷為正類。真實盜刷編號為 C01、C02、C04、C05、C06、C08、C10、C13，共 8 筆。

閾值 0.5 時，前六筆分數達標，進 TP；C10 的 0.35 與 C13 的 0.20 未達標，進 FN。因此 TP=6、FN=2，召回率是 6/8=0.75。

| 閾值（分數 ≥） | TP／FN | 召回率 | 誤報 FP |
|---|---|---|---|
| 0.75 | 4／4 | 4/8=0.500 | 1 |
| 0.50 | 6／2 | 6/8=0.750 | 2 |
| 0.20 | 8／0 | 8/8=1.000 | 5 |

降低到 0.20，兩筆漏掉的盜刷都抓到了，也多出三次誤報。精確率由 6/8=0.75 變成 8/13≈0.615，這是同一批分數上的實際取捨。

![沿著標示的閾值由 0.75 降到 0.20，召回率提高，但警報中的誤報占比也改變。](figure:l23303-precision-threshold-tradeoff)

### 同批四指標與成本（補充）

沿用 C01–C20、正類盜刷、分數 ≥ 0.5 的同一批資料。

先在[混淆矩陣](../confusion-matrix/#算一次補充)核對 TP=6、FP=2、FN=2、TN=10，再讀[準確率](../accuracy/#算一次補充)的 16/20=0.80、[精確率](../precision/#算一次補充)與[召回率](../recall/#算一次補充)的 6/8=0.75，最後讀[F1](../f1-score/#四格計數與零分母補充)的 12/16=0.75。

誤報成本高，先查 Precision 及 FP；漏報成本高，先查 Recall 及 FN；要兼顧兩者可並列 F1，但成本不等時仍看實際代價。

Accuracy 包含 TN，適合作整體摘要，無法替代前述取捨。

資料索引與唯讀來源版本記在 `L23303-M4-E-metric-cases.json`。

## 程式（補充）

依共用資料的標籤與分數，逐個候選閾值重算，不需要重新訓練模型。

```python
from sklearn.metrics import recall_score

y = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
scores = [0.95, 0.90, 0.85, 0.80, 0.75, 0.65, 0.65, 0.50, 0.40, 0.35,
          0.30, 0.25, 0.20, 0.18, 0.15, 0.12, 0.10, 0.08, 0.05, 0.02]
for t in (0.75, 0.5, 0.2, 1.0):
    pred = [int(s >= t) for s in scores]
    r = recall_score(y, pred, pos_label=1, zero_division=0)
    print(f"t={t:.2f}, recall={r:.3f}")
```

```text
t=0.75, recall=0.500
t=0.50, recall=0.750
t=0.20, recall=1.000
t=1.00, recall=0.000
```

:::tip[讀碼重點]
最後一列雖然沒有預測正類，仍有 8 筆實際正類，所以 0/8=0 有定義。zero_division=0 在這一列沒有被用到。
:::

## 怎麼用、怎麼判讀

漏報的代價高時，先關注召回率。例如篩檢漏掉患者、詐騙偵測放過詐騙，都對應 FN；指標能直接反映目標被漏掉多少。

### 閾值取捨（補充）

固定分數、採「大於或等於」規則時，降低閾值不會把已抓到的正類移出去。因此只要有實際正類，召回率不減，但可能停在原值，不一定每次都上升。

從 0.50 降到 0.40，只多納入正常交易 C09，TP 仍是 6，召回率仍是 0.75；精確率則由 6/8 降到 6/9≈0.667。

要兼顧漏報與誤報，可先設定召回率下限，再比較達標時的精確率與警報量。閾值在驗證資料上選，最後測試資料保留作評估。

### 換個場景

| 場景 | 正類 | 為什麼關注召回率 |
|---|---|---|
| 癌症偵測 | 實際罹癌 | 漏診代價高，需追蹤患者被找出多少 |
| 詐騙偵測 | 實際詐騙 | 漏掉的詐騙可能繼續造成損失 |
| 製造安全檢測（補充） | 危險瑕疵 | 不希望危險產品流出，另以精確率估複檢負擔 |
| 客服緊急分流（補充） | 緊急求助 | 漏分流可能延誤處理，也要確認人工接手容量 |

指引的兩個場景都以「漏報正類代價高」為共同條件。新場景也應先指定正類，再判斷漏報造成的實際後果。

### 醫療與瑕疵的同資料比較（補充）

完整四格、三指標及成本集中在[F1 共用案例](../f1-score/#醫療與瑕疵共用案例補充)，沿用各領域同一份資料。

醫療 TP=4、FP=5、FN=1、TN=90，所以 P=4/9、R=4/5、F1=8/14。

瑕疵 A 為 3、2、1、14，P=3/5、R=3/4、F1=6/9。

B 為 4、4、0、12，P=4/8、R=1、F1=8/12。

醫療 FP 增加複檢，FN 漏轉介；製造 FP 誤攔良品，FN 放行瑕疵。

依成本選用，不能只取較高的一個比例。

全判健康仍有 95% Accuracy、全判良品仍有 80%，卻都 Recall=0、F1=0、Precision 未定義；高整體分數未證明能偵測少數類。

## 常見誤解

- **分母是全部預測正類。** 那是精確率；召回率要沿實際正類找 TP 與 FN。
- **整體準確率高，就不必看召回率。** 多數正常樣本可撐高準確率，卻掩蓋漏掉的盜刷。
- **召回率 100% 就足夠好。** 有正類時，把所有交易判為正類也能達到，誤報可能很多。（補充）
- **沒有預測正類，召回率一定未定義。** 是否有定義要看有沒有實際正類。（補充）

## 進階

### 同義名稱與相近量（補充）

敏感度、真正率與召回率都是在實際正類中計算抓到的比例。特異度則從實際負類出發，計算正確放行的比例；不能只因中文看起來像「敏感程度」就混用。

### 參考來源

- [scikit-learn f1_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html)：支持共用醫療／瑕疵的 F1 計數重算；資料及成本為合成教學設定，索引見 L23303-M4-E-metric-cases.json。
- 學習指引科目 3，5-21～5-22（支持：文字定義、癌症與詐騙場景、ROC 縱軸名稱；5-21 印刷分母已回圖核對並勘誤）。
- [scikit-learn recall_score API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.recall_score.html)（支持：正確公式、分母為零、正類設定與程式）。
- [Google 機器學習速成課：分類指標](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)（支持：Recall 與 TPR 同義、漏報成本與指標限制；取實際正類視角的教學思路）。
- [scikit-learn 閾值調整指南](https://scikit-learn.org/stable/modules/classification_threshold.html)（支持：閾值取捨、驗證資料選閾值）。

## 小結

- 召回率是 TP/(TP+FN)，本例為 6/8=0.75；分母是實際正類。
- 敏感度、真正率 TPR 與召回率同義，TPR 是 ROC 曲線的縱軸。
- 沒抓到任何正類可得 0；沒有任何實際正類則未定義。
- 降低閾值時召回率不減，也可能增加誤報；要一起看精確率與工作量。
