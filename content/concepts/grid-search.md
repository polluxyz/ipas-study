---
id: grid-search
title: 網格搜尋
kind: technique
codes: [L23304, L21301]
aliases: [Grid Search, GridSearchCV]
summary: 把列出的設定值配成所有組合，再逐組比較驗證成績
goals:
  - id: g1
    text: 計算網格候選組數乘交叉驗證摺數，並區分選定後的重訓
requires: [hyperparameter-tuning]
is_a: [hyperparameter-search]
contrasts:
  - target: random-search
    note: 網格列舉離散值的交叉組合，隨機則依指定分布抽取固定數量候選
    source: [114-2-S3-Q11]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: grid-fit-count
    source: https://raw.githubusercontent.com/scikit-learn/scikit-learn/afe5bcd80/sklearn/model_selection/_search.py
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23304-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊列出 4 種 C 與 5 種 γ，做五摺交叉驗證，不計最後重訓。候選組數與擬合次數各是多少？
    options:
      A: 9 組候選、45 次擬合，先把各個軸上的取值數量相加
      B: 20 組候選、20 次擬合，每個候選只用其中一摺訓練
      C: 100 組候選、500 次擬合，把每摺當成新的超參數值
      D: 20 組候選、100 次擬合，每組都在五份訓練資料擬合
    answer: D
    explain:
      A: 網格是交叉組合，四種值各配五種值，不能相加。
      B: 五摺需要五個不同的訓練資料子集，各擬合一次。
      C: 摺是驗證設計，不是另一個待選的超參數維度。
      D: 4×5 得 20 組，再乘五摺得到 100 次。
  - id: c2
    goal: g1
    type: choice
    prompt: 五個超參數分別有 3、4、5、3、3 個值，以五摺驗證，最後 refit 一次。所有模型擬合共有幾次？
    options:
      A: 2700 次，因為最後的 refit 已經包含在每組的五摺之中
      B: 2701 次，540 組各做五摺，再加選定設定的單次重訓
      C: 540 次，因為五摺評分不需要重新擬合任何候選模型
      D: 541 次，540 組各訓練一個模型，再加一次測試集預測
    answer: B
    explain:
      A: 五摺中的模型各只用部分資料，最終開發資料重訓是額外一次。
      B: 3×4×5×3×3=540，540×5+1=2701。
      C: 五摺的每一份訓練資料都要重新擬合候選。
      D: 不只少算交叉驗證，還把預測誤算成擬合。
  - id: c3
    goal: g1
    type: choice
    prompt: 以 192 筆開發資料完成 20 組五摺網格搜尋，另有 48 筆測試。refit=True 的作用是什麼？
    options:
      A: 選好設定後用傳入的 192 筆重訓，測試資料仍須另外保留
      B: 自動把測試 48 筆加進開發資料，合成 240 筆挑選超參數
      C: 把五摺各自訓練的模型投票，保證測試 AUC 高於驗證 AUC
      D: 把驗證最高的那一摺直接當最終模型，省下全部重訓成本
    answer: A
    explain:
      A: refit 使用傳給 fit 的整份開發資料，不會自行取得外部測試集。
      B: 搜尋器沒有收到測試資料，也不應讓測試參與選擇。
      C: refit 是重新擬合單一設定，不是把摺模型組成集成。
      D: 最終重訓使用全部開發資料，並不是取出某一摺的模型。
---

## 為什麼需要（補充）

想比較的設定值不多時，可以把所有組合都試過。這叫網格搜尋（Grid Search）。

模型訓練前先選定的設定稱為超參數（Hyperparameter）。按以下步驟比較，就不容易漏試組合：

1. 列出每個超參數想試的值。
2. 把各個超參數的值配成所有組合。
3. 用相同的驗證規則比較每組成績。

網格搜尋只會試列出的組合。列出的值之間，仍有沒試過的值。

## 直覺（補充）

共用例子讓設定 C 取四個值、設定 γ 取五個值。每個 C 都要配過全部五個 γ，因此共有二十組。

![四個 C 各配五個 γ，共有二十組。圖中只畫出這些組合。座標先取對數，也就是用十的幾次方來看數值。](figure:l23304-grid-search-coverage)

圖上橫向只有四種 C 值。即使改 C 最容易影響模型表現，多試幾個 γ 也不會多試到 C 的其他值。

## 定義與公式（補充）

對單一、完整交叉的網格，候選數和模型擬合次數是：

$$
N_{\mathrm{candidate}}=\prod_{j=1}^{d}m_j,
\qquad N_{\mathrm{fit}}=K N_{\mathrm{candidate}}+r
$$

$d$ 是超參數個數；$m_j$ 是第 $j$ 個超參數的候選值數；$K$ 是摺數；$r$ 是最終重訓次數，有重訓為 1，沒有為 0。

這兩式由官方實作推得：`ParameterGrid.__len__` 相乘各軸值數；`BaseSearchCV.fit` 對每組跑各摺，啟用 `refit` 時再額外擬合一次。

適用條件是每組都跑完整 K 摺、沒有額外重複種子或搜尋階段。若分成互不重疊的條件式子網格，先分別算乘積再加總。

## 算一次（補充）

授信例子的 C=[0.01,0.1,1,10]，γ=[0.001,0.01,0.1,1,10]。每組用 192 筆開發資料內相同五摺評估，48 筆測試暫不使用。

- 候選：4×5=20 組。
- 驗證階段：20×5=100 次擬合。
- `refit=True`：100+1=101 次。
- `refit=False`：只有 100 次，之後若手動重訓，須另加。

### 五維空間的成本（補充）

若把搜尋擴成五個超參數，各有 3、4、5、3、3 個值，候選數是 3×4×5×3×3=540。五摺總計 3×4×5×3×3×5=2700 次，重訓後為 2701 次。

這是另設的成本練習，並非本組二十組實測的一部分。每次資料量與模型複雜度不同，不能直接把次數當成精確秒數。

## 程式（補充）

重建共用資料。以下兩段在同一程式中依序執行，所有隨機步驟固定種子。

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
X, y = make_classification(n_samples=240, n_features=2, n_informative=2,
    n_redundant=0, n_clusters_per_class=2, class_sep=.9, flip_y=.08, random_state=17)
X = np.column_stack([np.round(80+12*X[:,0], 4), np.round(.4+.07*X[:,1], 6)])
dev, test = train_test_split(np.arange(240), test_size=48, stratify=y, random_state=42)
cv = list(StratifiedKFold(5, shuffle=True, random_state=42).split(X[dev], y[dev]))
model = make_pipeline(StandardScaler(), SVC(kernel="rbf", random_state=42))
print(len(dev), len(test))
```
```text
192 48
```

```python
space = {"svc__C": [.01, .1, 1, 10], "svc__gamma": [.001, .01, .1, 1, 10]}
search = GridSearchCV(model, space, cv=cv, scoring="roc_auc", refit=True)
search.fit(X[dev], y[dev])
n = len(search.cv_results_["params"])
print(f"候選={n} 驗證擬合={n*search.n_splits_} 含重訓={n*search.n_splits_+1}")
print(search.best_params_)
print(f"驗證 AUC={search.best_score_:.4f}")
```
```text
候選=20 驗證擬合=100 含重訓=101
{'svc__C': 1, 'svc__gamma': 1}
驗證 AUC=0.9203
```

:::tip[讀碼重點]
`cv_results_["params"]` 一列是一組候選，不是一摺。`best_estimator_` 是重訓後的模型；五摺平均用來選它，尚不是測試成績。
:::

## 怎麼用、怎麼判讀（補充）

少量離散值、窄範圍的細部比較適合網格。維度增多時，先算乘積；超過預算可縮範圍或改用隨機搜尋。

最佳值落在邊界，是可再檢查範圍的線索，並不能保證範圍外會更好。擴範圍也算新的搜尋，仍須留在開發資料內進行。

### 換個場景（補充）

指引未展開網格搜尋，因此沒有專屬的場景或資料量門檻。下列場景皆為補充，選用條件是可控的離散組合數。

| 場景 | 搜尋對象 | 判讀重點 |
|---|---|---|
| 授信 | 少量 C 與 γ | 網格夠小時可完整列舉 |
| 製造 | 樹深與最小葉節點數 | 同批次資料應保持驗證隔離 |
| 客服 | 少量詞組長度與正則化設定 | 詞彙前處理也要在訓練摺學習 |

## 常見誤解（補充）

- 候選數相加即可：交叉組合須相乘。
- 五摺的五個模型就是最終集成：選定後通常重新訓練一個模型。
- 開多個平行工作就減少擬合次數：它只改變排程，不改變組合數。

## 進階

### 參考來源

- 科目 3 指引（版本未標示），guide-3:5-30：僅提供超參數調校背景；本頁方法、算例與 API 為補充。
- [GridSearchCV API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GridSearchCV.html)：支持候選列舉、cv、refit 與程式。
- [scikit-learn 官方 _search.py（固定版本）](https://raw.githubusercontent.com/scikit-learn/scikit-learn/afe5bcd80/sklearn/model_selection/_search.py)：由 `ParameterGrid.__len__` 與 `BaseSearchCV.fit` 推得本頁候選數及擬合次數公式。
- [INRIA 網格搜尋課程](https://inria.github.io/scikit-learn-mooc/python_scripts/parameter_tuning_grid_search.html)：支持同資料逐組比較、搜尋範圍與成本的教法。
- [Bergstra 與 Bengio（2012）](https://jmlr.org/papers/v13/bergstra12a.html)：支持重要維度取值覆蓋的比較。

## 小結（補充）

- 每軸候選值數相乘，得到網格候選組數。
- 候選組數乘 K 摺，得到驗證擬合次數。
- 最終重訓有做才加 1，測試預測不算擬合。
