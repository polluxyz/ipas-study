---
id: filter-feature-selection
title: Filter 特徵篩選
kind: technique
codes: [L23301]
aliases: [ANOVA, Chi-square, Filter, Pearson]
summary: Filter 用統計關係篩選原始欄位，速度快但可能漏掉特徵互動
goals:
  - id: g1
    text: 依欄位型態選擇 Pearson、卡方或 ANOVA，並辨認單欄篩選的限制
requires: [hypothesis-testing]
contrasts:
  - target: wrapper-feature-selection
    note: Filter 依統計分數挑欄；Wrapper 反覆擬合指定模型來比較候選集合
    source: [guide-3:5-5]
guide_refs: [guide-3:5-5, guide-1:5-5]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫院有 240 位病人的年齡與三種診斷類別，要快速比較各診斷組的平均年齡，哪個起點合適？
    options:
      A: 對診斷代碼算 Pearson，認定三類有等距大小
      B: 對年齡分組做 ANOVA，先檢查檢定適用條件
      C: 對標準化年齡做卡方，保留其中負值供檢定
      D: 對診斷代碼求平均值，視為每位病人的風險
    answer: B
    explain:
      A: 無序診斷代碼不具數值距離，直接算相關會依編碼而變。
      B: ANOVA 可比較多個類別下連續特徵的組間平均，仍需檢查假設。
      C: 卡方應使用計數或適合的非負輸入，不能直接塞入含負值的標準化年齡。
      D: 代碼平均不是分類風險，也沒有回答年齡與診斷的關係。
  - id: c2
    goal: g1
    type: choice
    prompt: 四筆產品的兩個二元開關為 (0,0)、(0,1)、(1,0)、(1,1)，瑕疵標籤依序為 0、1、1、0。單欄相關都為 0，該如何解讀？
    options:
      A: 兩欄各自相關為零，因此合用也不可能預測
      B: 兩欄各自相關為零，因此增加樣本必能解決
      C: 兩欄各自相關為零，因此改成 PCA 必能分開
      D: 兩欄各自相關為零，仍可能合用才有預測力
    answer: D
    explain:
      A: 這是互斥或關係，兩欄合用可完全決定標籤。
      B: 此例的訊號是互動，增加同類型資料不會讓單欄相關自動出現。
      C: PCA 不以標籤為目標，不能保證解開互動關係。
      D: 單變量篩選未看兩欄搭配，可能把有用的互動變數一起刪除。
  - id: c3
    goal: g1
    type: choice
    prompt: 授信開發資料有 24 筆，另留 12 筆測試。團隊要篩選特徵並做 3 摺驗證，哪種操作合適？
    options:
      A: 每摺以訓練部分估篩選分數，再轉換驗證部分
      B: 先以全部開發資料估篩選分數，再進行分摺驗證
      C: 先以全部測試資料估篩選分數，再回開發資料訓練
      D: 每摺以驗證部分估篩選分數，再挑選訓練欄位
    answer: A
    explain:
      A: 篩選也會學習標籤關係，因此必須留在每一摺的訓練邊界內。
      B: 驗證摺的標籤已參與全開發資料篩選，仍有洩漏。
      C: 測試集參與篩選後，便不能作獨立的最終評估。
      D: 用驗證標籤選欄位會把驗證答案回饋進模型。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

授信表同時有月收入、年收入、負債比等欄位。欄位越多，資料蒐集與訓練越貴，也可能把雜訊交給模型。

Filter 特徵篩選（Filter Feature Selection）先用統計量快速挑出候選欄位。它選擇既有特徵，不會把數個欄位合成新座標。

## 直覺

每個欄位各自接受檢查：與目標有沒有線性關係？不同類別的數值是否有差異？先通過檢查，再交給模型學習。

![統計篩選與模型評估都留在訓練邊界內，測試集等選定流程後才使用。](figure:l23301-filter-feature-selection-flow)

:::supplement[來源：scikit-learn Common pitfalls 12.2]
圖中「只用訓練部分估計篩選規則」是評估邊界的補充。Filter 不依賴指定模型，不代表它完全不用標籤。
:::

## 定義與公式

指引列出三種工具：變異分析（ANOVA）、卡方檢定（Chi-square Test），以及皮爾森相關係數（Pearson's r）。三者回答的問題不同，不能不看欄位型態就任選一個。

科目 1 指引也列出資訊增益（Information Gain）作為篩選工具。比較候選方法時，應一併確認欄位與目標型態，而不是只記住名稱。

### 欄位與方法配對（補充）

| 欄位與問題 | 候選方法 | 先查的條件 |
|---|---|---|
| 兩個數值量的線性關聯 | Pearson | 兩欄不能為常數，留意離群值 |
| 類別欄與分類標籤的關聯 | 卡方獨立性檢定 | 用交叉表計數，檢查期望次數 |
| 連續欄在多個類別的平均差異 | 單因子 ANOVA | 傳統檢定假設獨立、組內近常態及等變異 |

Pearson 用於兩個數值欄時，可幫忙找冗餘；用於數值特徵與連續目標時，可篩線性關係。二元標籤編為 0／1 也能算，但無序多類別不能直接當成等距數字。

scikit-learn 的 chi2 接受非負計數或二元特徵；連續量需適當分箱。它和直接對交叉表呼叫卡方獨立性檢定的輸入格式不同。

若要把分數解讀成 p 值，需符合該檢定條件；只拿分數排序也不會自動證明因果。指引未列完整公式，本頁以配對與判讀為主。

## 走一次流程

### 共用授信資料（補充）

本組有授信、製造各 36 筆教學合成資料。授信六欄為月收入、年收入、負債比、年齡、年資、雜訊；年收入恰為月收入的 12 倍，並未增加新資訊。

1. 依固定索引留 24 筆開發資料、12 筆測試；兩邊的違約與未違約各占一半。
2. 在開發資料的每個訓練摺，依分類標籤用 ANOVA 對六欄評分。
3. 此例只留一欄，負債比被選中；固定三摺與 ROC AUC 評估整個流程。
4. 選定後重訓流程，12 筆測試不參與挑欄或改設定。

三摺 AUC 都為 1，因資料刻意安排清楚的分類訊號。這只是驗證程式與資料一致，不代表真實授信能達到相同成績。

## 程式（補充）

用算術重建 JSON 的六欄及固定索引，不讀取外部資料。下面各段在同一頁依序執行。

```python
import numpy as np
i = np.arange(36); j = i // 2; y = i % 2
income = 50 + 5 * (2 * (j % 6) - 5)
ratio = .5 + .1 * (2 * y - 1) + .02 * (j // 6 - 1)
age, tenure, noise = 25 + 7*j%17, 1 + 5*j%9, 11*j%13
X = np.column_stack([income, 12*income, ratio, age, tenure, noise])
tr, te = j%3 != 2, j%3 == 2
names = np.array(["月收入", "年收入", "負債比", "年齡", "年資", "雜訊"])
print("訓練與測試", X[tr].shape, X[te].shape)
```
```text
訓練與測試 (24, 6) (12, 6)
```

```python
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
pipe = make_pipeline(SelectKBest(f_classif, k=1), StandardScaler(),
                     LogisticRegression(random_state=17))
cv = StratifiedKFold(3, shuffle=True, random_state=17)
print("三摺AUC", cross_val_score(pipe, X[tr], y[tr], cv=cv, scoring="roc_auc").tolist())
pipe.fit(X[tr], y[tr])
print("保留", names[pipe[0].get_support()].tolist())
```
```text
三摺AUC [1.0, 1.0, 1.0]
保留 ['負債比']
```

:::tip[讀碼重點]
SelectKBest 放在 Pipeline 裡，讓每摺重新學習篩選規則。最後一次 fit 只用 24 筆開發資料，沒有讀取 12 筆測試標籤。
:::

## 怎麼用、怎麼判讀

指引的適用條件是特徵多、希望快速減少計算，且暫時不想依賴某一種模型。若主要訊號來自特徵互動，單欄 Filter 可能漏掉它。

:::supplement[來源：scikit-learn Feature selection；SciPy pearsonr]
四筆二元開關資料的標籤若是互斥或：同值為 0、不同值為 1，每個開關單獨與標籤的相關都是 0，兩個一起卻能決定標籤。

「對目標各自有關」也不等於「彼此不冗餘」。月收入及年收入可能都得高分，仍要處理共線性，再比較 Wrapper 與 RFE 或 Embedded 特徵選擇。
:::

### 換個場景

| 場景或資料條件 | 篩選方向 | 判讀重點 |
|---|---|---|
| 大量原始欄位、需快速初篩 | 用統計量排候選欄 | 不保證保留所有互動 |
| 授信（補充） | 先查收入副本及負債比 | 高分欄仍可能互相冗餘 |
| 製造（補充） | 比較振動與瑕疵類別 | 批次相關時需調整切分 |
| 醫療（補充） | 比較診斷組的檢測值 | 檢查組內分佈與檢定前提 |

## 常見誤解

- Filter 不用模型，所以不能用標籤：ANOVA 與卡方篩選通常會用到目標標籤。（補充）
- 單欄分數低就永遠沒用：互動關係可能只在多欄合用時出現。
- 顯著就等於預測很好：還需看獨立驗證與實際效益。（補充）

## 進階

### 同分與大量檢定（補充）

本例除了負債比，其他五欄在完整開發資料的 ANOVA 分數都是 0。若硬選兩欄，第二欄可能由同分處理規則決定，不能宣稱它確實有用。

同時檢查大量欄位時，也會增加偶然通過檢定的機會。若用 p 值決定保留，可考慮多重比較控制；它仍不能取代模型驗證。

### 參考來源

- 科目 3 指引 guide-3:5-5（版本未標示）：支持 Filter 定位、ANOVA／卡方／Pearson 名稱與互動限制；未指定產業。
- 科目 1 指引 guide-1:5-5（版本未標示）：支持資訊增益、Pearson 等篩選方法名稱，不作為 ANOVA、卡方或互動限制的依據。
- [scikit-learn Feature selection](https://scikit-learn.org/stable/modules/feature_selection.html)：支持單變量篩選、同分限制與大量檢定。
- [SciPy pearsonr](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html)、[f_oneway](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.f_oneway.html)、[chi2_contingency](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.contingency.chi2_contingency.html)：支持欄位配對與檢定條件。
- [scikit-learn chi2](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.chi2.html)：支持非負計數輸入限制。
- [官方 Pipeline ANOVA SVM 教學](https://scikit-learn.org/stable/auto_examples/feature_selection/plot_feature_selection_pipeline.html)：參考把篩選放進流程、整體驗證的教法。
- [Common pitfalls 12.2](https://scikit-learn.org/stable/common_pitfalls.html)：支持折內估計與資料洩漏邊界。

## 小結

- Filter 用統計關係挑原始欄位，速度快且不綁定某個模型。
- 方法要配合欄位與目標型態，不能直接套用任意代碼。（補充）
- 單欄篩選可能漏互動，也不保證去除冗餘。
- 篩選規則在訓練摺內學習，再用於驗證摺。（補充）
