---
id: group-calibration
title: 分群體校準
kind: technique
codes: [L23402]
aliases: [Calibration, Group Calibration]
requires: [conditional-probability, equalized-odds]
is_a: [debiasing-strategies]
summary: 分群比較預測機率與真實發生率，確認相同分數的風險意義
goals:
  - id: g1
    text: 用每桶觀察比例檢查分數意義，分辨校準與任意加分
  - id: g2
    text: 用同一份資料比較分群校準與均衡機率，說明未必能兼得
formula_groups:
  - id: calibration-and-bucket-rates
    source: 'https://fairmlbook.org/classification.html#calibration-and-sufficiency; https://scikit-learn.org/stable/modules/calibration.html#calibration-curves'
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23402-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 信貸模型給兩群各10人0.8分，A有6人、B有8人符合還款規準。若想把分數解讀為符合規準的機率，何者正確？
    options:
      A: A觀察比例0.6、B為0.8，同樣原分數尚未有相同意義
      B: A與B都給0.8分，故觀察機率均為0.8且跨群一致
      C: A與B各加0.05分，便能確保兩群0.85分具有相同的實際風險
      D: A與B各選取6人，便能確保兩群0.8分對應相同的真實發生率
    answer: A
    explain:
      A: 要用真實結果檢查分數，兩桶的6/10與8/10並不相同。
      B: 模型輸出不會自動等於真實比例，必須用觀察資料核查。
      C: 任意加分沒有對照真實比例，不能視為校準證據。
      D: 改選取人數是在改決策，沒有改變原桶內觀察比例。
  - id: c2
    goal: g2
    type: choice
    prompt: 校準後A的0.2/0.6分各10人，正例2/6人；B的0.4/0.8分各10人，正例4/8人。用0.5閾值時，何者成立？
    options:
      A: 各桶均校準，故兩群TPR與FPR必然完全相同，可省略錯誤率核算
      B: 兩群各選10人，故各桶真實比例不須檢查，已可保證所有公平目標
      C: 兩群TPR不同，故每桶預測機率必定錯誤，必須把分數全部重設
      D: 各桶觀察比例吻合分數，但TPR為75%與約67%，均衡機率未成立
    answer: D
    explain:
      A: 校準按分數分組，TPR按真實正例分組，兩者比較條件不同。
      B: 同選取率不保證分數意義或錯誤率一致。
      C: TPR不同不能推翻桶內比例吻合分數的觀察。
      D: A為6/8、B為8/12，已足以否定此閾值下的均衡機率。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:6-23]
---

## 為什麼需要

兩位申請者都得到0.8分，若A群同分者只有六成符合規準，B群卻有八成，這個分數在兩群的意義就不同。

分群體校準（Group Calibration）檢查並調整分數意義。它與後處理門檻調整不同：一個處理「分數代表什麼」，另一個處理「多少分就採取行動」。

## 直覺

像檢查溫度計刻度，刻度要對得上觀察值。對機率分數而言，0.8分應對應大約八成正例，且各群都要檢查。

:::supplement[來源：scikit-learn，Probability calibration]
指引以「60分改65分」說明重新校準，但例子省略了觀察比例。校準必須有真實結果作依據；單看加分幅度，不能判定是否完成校準。
:::

## 定義與公式

指引要求相同分數在不同群體代表相同意義。本頁進一步把分數解讀為正例機率；本例正例是符合資格，不是違約。

### 機率與桶內比例（補充）

$$
P(Y=1\mid S=s,G=g)=s.
$$

$Y$是真實標籤，$S$是校準後的機率分數，$G$是群體。每個有資料支持的群體與分數，都應讓實際正例比例接近$s$。

參考書中的R／A，分別對應本頁的S／G。

實務上把相近分數放進一桶，計算：

$$
\bar s_{g,b}=\frac{1}{n_{g,b}}\sum_{i\in I_{g,b}}s_i,
\qquad
\hat r_{g,b}=\frac{1}{n_{g,b}}\sum_{i\in I_{g,b}}y_i.
$$

$I_{g,b}$是群體$g$在桶$b$內的樣本索引，$n_{g,b}$為筆數；$\bar s$是平均分數，$\hat r$是觀察正例比例。兩者接近才是該桶的校準證據。

A群原0.8分桶有10筆、6筆正例，所以平均分數0.8，觀察比例$6/10=0.6$。不能將這10人的0.8直接當成已驗證機率。

桶空時無法計算；桶只有10筆時，每增加1筆正例就變動0.1。這是教學小樣本，不能據此保證母體或個人的結果。

## 算一次

### 先分開擬合與檢查

:::supplement[來源：scikit-learn，Probability calibration；本組教學合成資料]
共用檔另設校準分數版本，與前置組的固定稽核分數分開。校準擬合集40筆、獨立校準稽核集40筆，兩者ID不重疊。

每群兩桶、每桶10筆。擬合集決定映射：A的0.3→0.2、0.8→0.6；B的0.3→0.4、0.8→0.8，再到稽核集檢查。

| 群體／原分數 | 稽核筆數 | 正例／觀察比例 | 映射後分數 |
|---|---|---|---|
| A／0.3 | 10 | 2／0.2 | 0.2 |
| A／0.8 | 10 | 6／0.6 | 0.6 |
| B／0.3 | 10 | 4／0.4 | 0.4 |
| B／0.8 | 10 | 8／0.8 | 0.8 |
:::

![原始點偏離對角線；映射後每桶平均機率與觀察比例相同，但這只驗證了表中有資料的分數。](figure:l23402-group-calibration-buckets)

:::supplement[來源：scikit-learn，Probability calibration；Fairness and Machine Learning，Calibration and sufficiency]
擬合與稽核計數刻意相同，只為方便核算。映射後各桶在本稽核集吻合，仍不代表未觀察分數也已校準；兩群沒有共同新分數時，也不能外推跨群比較。
:::

### 校準不等於錯誤率相同（補充）

用新分數、同一閾值0.5，兩群都選取高分桶的10人。A共有8個正例，B共有12個正例，基準率分別40%與60%。

| 群體 | TP／FN | FP／TN | TPR／FPR |
|---|---|---|---|
| A | 6／2 | 4／8 | 6/8＝75%／4/12≈33% |
| B | 8／4 | 2／6 | 8/12≈67%／2/8＝25% |

桶內比例吻合分數，但均衡機率不成立。校準以「相同分數者」比較；TPR、FPR以「真實正例或負例」比較，條件不同。

這個反例證明校準不保證同錯誤率，不能擴張為任何資料、任何閾值都永遠無法兼得。設目標前應查基準率、分數分布及預測是否完美。

## 程式（補充）

第一段依共用檔規則建立兩個互不重疊的集合，從擬合集估每群、每桶的映射。資料皆為教學合成值，沒有下載或寫檔。

```python
rates = {"A": {0.3: 2, 0.8: 6}, "B": {0.3: 4, 0.8: 8}}
def make_rows(split):
    return [(f"{split}-{g}-{s}-{i}", g, s, int(i < count))
            for g, bins in rates.items() for s, count in bins.items()
            for i in range(10)]
fit, audit = make_rows("fit"), make_rows("audit")
mapping = {}
for g in "AB":
    for s in [0.3, 0.8]:
        labels = [y for rid, group, raw, y in fit if (group, raw) == (g, s)]
        mapping[g, s] = sum(labels) / len(labels)
print("集合ID重疊:", bool({r[0] for r in fit} & {r[0] for r in audit}))
```
```text
集合ID重疊: False
```

第二段只用稽核集核對每桶10筆的平均新分數與真實比例，不用稽核結果重新改映射。

```python
for g in "AB":
    for s in [0.3, 0.8]:
        part = [(mapping[g, raw], y) for rid, group, raw, y in audit
                if (group, raw) == (g, s)]
        n = len(part)
        mean = sum(p for p, y in part) / n
        observed = sum(y for p, y in part) / n
        print(f"{g} 原分數{s:.1f}: n={n} 新分數={mean:.1f} 觀察={observed:.1f}")
```
```text
A 原分數0.3: n=10 新分數=0.2 觀察=0.2
A 原分數0.8: n=10 新分數=0.6 觀察=0.6
B 原分數0.3: n=10 新分數=0.4 觀察=0.4
B 原分數0.8: n=10 新分數=0.8 觀察=0.8
```

## 怎麼用、怎麼判讀

信用評分需要比較各群的分數意義，並依各群分數的意義進行校準。

:::supplement[來源：scikit-learn，Probability calibration；Fairness and Machine Learning，Classification]
若輸出是點數而非機率，要先定義它與風險的映射。不能用任意加分取代真實發生率檢查。

群體校準器若使用不同映射，推論也需群體資訊。即使保持同一閾值，分數改變仍可能讓個案跨過界線；不能說校準完全不會改決策。

先凍結模型，在獨立資料擬合校準器，再用未參與擬合的資料檢查。只在用來估映射的桶上重算，容易得到過度樂觀的吻合。
:::

### 換個場景

| 場景／資料條件 | 判讀重點 |
|---|---|
| 信用評分，不同群體同分 | 對照相同分數下的真實結果 |
| 招聘資格分數（補充） | 定義可觀察的資格規準與標籤品質 |
| 醫療風險預測（補充） | 相同風險分數是否對應相近發生率 |

## 常見誤解

- 改成同一個分數，不代表背後實際比例相同。
- 任意把60改65，沒有觀察依據就不足以證明校準。（補充）
- 平均分數吻合整體比例，仍可能掩蓋分群或分桶失準。（補充）
- 校準達標不保證均衡機率或統計均等達標。（補充）

## 進階

### 「不能保證」比「永遠不可能」精確（補充）

公平要求可能在基準率不同、預測不完美時產生衝突，但分數層級與二元決策層級的要求也不同。本頁只證明本算例未同時達標，不用它代替所有不相容定理。

### 參考來源

- 科目3學習指引 `guide-3:6-23`：支持校準目的、信用評分場景及與閾值調整的區別；任意加分例須加真實比例核查。
- [scikit-learn：Probability calibration](https://scikit-learn.org/stable/modules/calibration.html)：支持機率定義、可靠度圖、分桶均值與擬合資料隔離。
- [Fairness and Machine Learning：Calibration and sufficiency](https://fairmlbook.org/classification.html#calibration-and-sufficiency)：支持群體條件校準式及與錯誤率要求的比較。
- [Fairness and Machine Learning：Relative notions of fairness](https://fairmlbook.org/relative.html)：支持分數意義與公平判斷的界線。

## 小結

- 校準要讓分數對得上各群的真實發生率。
- 分桶時同時保留平均分數、比例與樣本數。（補充）
- 校準資料與最終檢查資料要分開。（補充）
- 同分同意義，不等於群體錯誤率相同。（補充）
