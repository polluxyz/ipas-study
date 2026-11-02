---
id: random-search
title: 隨機搜尋
kind: technique
codes: [L21301, L23304]
aliases: [Random Search, RandomizedSearchCV]
summary: 在指定分布內抽取有限候選，用固定預算探索超參數空間
goals:
  - id: g1
    text: 比較固定預算的隨機與網格覆蓋，選擇連續或離散抽樣分布
requires: [hyperparameter-tuning]
is_a: [hyperparameter-search]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: log-uniform-sampling
    source: https://raw.githubusercontent.com/scipy/scipy/v1.18.0/scipy/stats/_continuous_distns.py
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23304-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩個超參數中只有 C 對品質影響明顯，預算 20 組。網格用 4 種 C 配 5 種 γ；隨機從連續分布抽 20 組。哪個說法合理？
    options:
      A: 網格在 C 軸上試過 20 種值，因此已完整取代隨機探索
      B: 隨機在 C 軸上可能試到更多不同值，但不保證品質勝出
      C: 隨機每組一定重複相同 C，只有 γ 才會隨著抽樣變動
      D: 網格只要增加 γ 的值數，就會自動增加 C 軸上的值數
    answer: B
    explain:
      A: 網格在 C 軸只試四種不同值，其餘預算用來交叉搭配。
      B: 連續抽樣通常讓 C 有更多不同取值，但好結果仍依資料與抽樣而定。
      C: C 也從指定分布抽取，沒有固定為同一值。
      D: 增加另一軸取值，只會增加搭配次數，不會新增 C 的值。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊想讓 C 在 0.01～0.1、0.1～1、1～10 三段有相同抽中機會，哪個配置符合目的？
    options:
      A: 在 0.01～10 線性均勻抽樣，保證三個十倍區間等機會
      B: 固定 C 為 10，只在每次訓練後隨機更換模型權重
      C: 列出 C 的全部實數值，做沒有預算上限的網格搜尋
      D: 在 0.01～10 對數均勻抽樣，讓三個數量級等機會
    answer: D
    explain:
      A: 線性均勻依區間長度給機會，高值區間會得到較多抽樣。
      B: 改權重初始化與探索 C 是不同的工作。
      C: 連續區間無法列舉全部實數，也違反有限預算前提。
      D: 三段在對數軸上長度相同，因此有相同抽中機會。
  - id: c3
    goal: g1
    type: choice
    prompt: RandomizedSearchCV 設 n_iter=20、cv=5，資料與模型都固定種子。哪個說法正確？
    options:
      A: 20 代表模型訓練輪次，每組超參數不需要另做五摺驗證
      B: 20 代表一定有 20 組互不重複候選，即使給的是抽樣分布
      C: 20 是候選抽樣預算，通常有 100 次驗證擬合，重訓另計
      D: 20 代表每摺的樣本數，固定種子保證找到全空間最佳點
    answer: C
    explain:
      A: n_iter 控制候選數，不是模型內部訓練的 epoch。
      B: 至少一項用分布時採有放回抽樣，不能普遍保證不重複。
      C: 每組候選各做五摺，20×5=100，若 refit 再加一次。
      D: n_iter 不決定樣本數，種子只幫助重現，沒有最優保證。
---

## 為什麼需要（補充）

隨機搜尋（Random Search）先指定預算，再依每個超參數的分布抽候選。它不必把所有軸的候選值交叉列完，適合先探索較大的空間。

當少數維度對品質特別重要，網格會把不少預算花在同一重要取值的不同搭配。隨機搜尋能在重要軸上試更多值，但不是每次都會贏。

## 直覺（補充）

同樣二十組預算，4×5 網格只看四種 C。連續隨機抽樣通常會得到二十種不同 C，但位置可能聚在一起，也可能漏掉好的區域。

![二十個候選從共用的對數範圍抽取，C 軸取值較多，仍可看見覆蓋空隙。](figure:l23304-random-search-coverage)

這張圖是授信資料的固定候選。製造例子用同一種子抽到相同候選位置，但因資料不同，驗證分數不同。

## 定義與公式（補充）

離散選項可用列表，例如樹深 [2,4,8]。正值連續參數跨數量級時，可用對數均勻分布（Log-uniform Distribution）。

$$
u\sim\mathrm{Uniform}(a,b),\qquad C=10^u
$$

$u$ 是在對數軸抽到的值；$a,b$ 是該軸上下界，須有 $a<b$；$C$ 是轉回原尺度的候選。適用於嚴格正值；0 與負數不能直接使用這個取對數方式。

SciPy 的 `loguniform` 分位數實作先在自然對數界限間內插，再取指數。改以十為底換元，就得到上式的抽樣方式。

本頁的 $a,b$ 是對數界限；API 則收原尺度界限。例如 `loguniform(0.01, 10)` 對應本頁的 $a=-2,b=1$，不能直接傳入 -2 與 1。

本例 a=-2、b=1，所以 C 在 0.01～10。若抽到 u=-1，C=0.1；u=0.5 時 C 約為 3.1623。相同對數距離表示相同倍數，不是相同加減量。

## 走一次流程（補充）

沿用共用授信資料，標準化後接 RBF SVC，以固定五摺的平均 AUC 比較。這次把網格換成二十組對數均勻抽樣，其他評分條件保持一致。

1. 固定授信 240 筆資料；48 筆測試留到最後，192 筆內做同一套五摺驗證。
2. 定義 C 的對數均勻範圍 0.01～10、γ 的範圍 0.001～10，固定候選種子 42。
3. 抽 20 組，每組重新做五摺；標準化每摺只看訓練資料。
4. 以五摺平均 AUC 選設定，再用開發資料重訓；最終測試另行保留。

本例隨機最佳 C 約 0.635836、γ 約 0.679658，驗證 AUC 0.9219。網格最佳為 0.9203；這是一次固定抽樣的差異，不能推成普遍勝負。

## 程式（補充）

先重建與網格相同的資料、分摺與模型。這樣更換搜尋器時，不會同時換掉比較基準。

```python
import numpy as np
from scipy.stats import loguniform
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
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
space = {"svc__C": loguniform(.01, 10), "svc__gamma": loguniform(.001, 10)}
search = RandomizedSearchCV(model, space, n_iter=20, cv=cv,
    scoring="roc_auc", random_state=42, refit=True)
search.fit(X[dev], y[dev])
n = len(search.cv_results_["params"])
print(f"候選={n} 驗證擬合={n*search.n_splits_} 含重訓={n*search.n_splits_+1}")
print({k: round(float(v), 6) for k,v in search.best_params_.items()})
print(f"驗證 AUC={search.best_score_:.4f}")
```
```text
候選=20 驗證擬合=100 含重訓=101
{'svc__C': 0.635836, 'svc__gamma': 0.679658}
驗證 AUC=0.9219
```

:::tip[讀碼重點]
`n_iter` 是抽候選的次數。搜尋器、資料產生、分摺與模型的種子各有用途；只固定其中一個，不代表所有隨機來源都已固定。
:::

## 怎麼用、怎麼判讀（補充）

所有參數都用有限列表時，scikit-learn 採無放回抽樣；若列表全部組合少於 n_iter，會改為全試，實際組數較少。

只要至少一項是分布，就採有放回抽樣。連續值理論上精確重複機會很低，但離散維度或數值取整後仍可能重複。

### 換個場景（補充）

指引沒有展開隨機搜尋，也沒有列出專屬領域或資料量門檻。以下選用條件是預算固定、空間較廣。

| 場景 | 分布例子 | 查核重點 |
|---|---|---|
| 授信 | C、γ 用正值對數分布 | 跨數量級，驗證客戶須隔離 |
| 製造 | 樹深用離散列表 | 整數與不合法值須先排除 |
| 客服 | 學習率連續、批次大小離散 | 記憶體與訓練成本要同時看 |

## 常見誤解（補充）

- 隨機搜尋會依前次分數改善下一次抽樣：基本隨機搜尋不使用歷史分數選點。
- 固定種子就能保證最佳結果：它只能讓同環境較容易重現。
- n_iter=20 永遠是二十種不同設定：要看列表、分布與候選總數。

## 進階

### 參考來源

- 科目 3 指引（版本未標示），guide-3:5-30：只提供調校背景，本頁均為方法補充。
- [RandomizedSearchCV API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.RandomizedSearchCV.html)、[ParameterSampler API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.ParameterSampler.html)：支持 n_iter、分布與放回規則。
- [INRIA 隨機搜尋課程](https://inria.github.io/scikit-learn-mooc/python_scripts/parameter_tuning_randomized_search.html)：支持對數分布與程式教法。
- [SciPy loguniform Notes](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.loguniform.html)：支持正值界限與對數均勻分布。
- [SciPy reciprocal_gen._ppf 實作](https://raw.githubusercontent.com/scipy/scipy/v1.18.0/scipy/stats/_continuous_distns.py)：本頁以十為底的抽樣式由該分位數換元推得；API 界限使用原尺度。
- [Bergstra 與 Bengio（2012）](https://jmlr.org/papers/v13/bergstra12a.html)：支持少數重要維度與覆蓋比較，不作單次勝負保證。

## 小結（補充）

- 先定預算與分布，再抽候選；驗證成本仍要乘摺數。
- 正值跨數量級時可考慮對數尺度，整數選項可用列表。
- 更多軸上取值不等於保證更高品質。
