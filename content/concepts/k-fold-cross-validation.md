---
id: k-fold-cross-validation
title: K-fold 交叉驗證
aliases: [交叉驗證, K折交叉驗證, Cross-Validation, KFold]
kind: technique
codes: [L23303]
requires: [train-val-test-split]
contrasts:
  - target: stratified-k-fold
    note: K-fold 只把資料平均分成 K 份；分層 K-fold 另外盡量讓每一份的類別比例接近整體
    source: [guide-3:5-27, 115-1-S3-Q45]
  - target: leave-one-out-cv
    note: K-fold 的 K 通常取 5 或 10，只訓練 K 次；留一法的 K 等於樣本數 n，要訓練 n 次，偏差小但成本高、估計的變異大
    source: [guide-3:5-28, 114-2-S3-Q34]
  - target: repeated-k-fold
    note: 標準 K-fold 使用一套固定的摺分（啟用洗牌時也只洗牌一次）；重複 K-fold 每輪重新隨機分摺，能看出分數的波動，但成本是 R 倍
    source: [guide-3:5-26, guide-3:5-29]
  - target: time-series-split
    note: K-fold 的驗證摺可能比訓練資料更早；時間序列切分永遠用較早的資料訓練、較晚的資料驗證
    source: [115-1-S3-Q27]
guide_refs: [guide-3:5-17, guide-3:5-18, guide-3:5-26, guide-3:5-27]
gaps:
  - ref: guide-3:5-27
    level: erratum
    ability: 指引 5-18 說 K-fold 在資料量有限時特別有用，5-27 的適用場景卻寫中大型資料集（數千筆以上），兩處說法不一致
textbook: v2
summary: K-fold 把資料分成 K 份，輪流拿 1 份當驗證、其餘訓練，再平均 K 次分數
goals:
  - id: g1
    text: 說得出每一摺誰訓練、誰驗證，並把 K 個分數平均成一個結果
  - id: g2
    text: 算得出 K 摺搭配候選參數的擬合次數，並說明 K=5 與 K=10 的取捨
  - id: g3
    text: 做得到每一摺的前處理只用訓練摺、保留最終測試集，並分辨 K-fold 與其他切法
formula_groups:
  - id: fold-mean
    source: guide-3:5-26
    status: verified
    checked_by: coordinator-term_b08e717c
  - id: fold-spread
    source: https://scikit-learn.org/stable/modules/cross_validation.html
    status: verified
    checked_by: coordinator-term_b08e717c
  - id: fit-count
    source: guide-3:5-27
    status: verified
    checked_by: coordinator-term_b08e717c
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某團隊做 5-fold，5 摺的驗證準確率依序是 0.5、1.0、1.0、0.5、1.0。他們該回報的 K-fold 平均準確率是多少？
    options:
      A: '0.75'
      B: '0.80'
      C: '1.00'
      D: '0.50'
    answer: B
    explain:
      A: 錯。0.75 是只平均前 4 摺（0.5＋1.0＋1.0＋0.5）÷4，漏掉第 5 摺。
      B: 對。五摺相加是 4.0，除以 K=5 得 0.80。
      C: 錯。1.00 是挑出最好的一摺，K-fold 要用全部 K 摺的平均。
      D: 錯。0.50 是挑出最差的一摺，同樣沒有平均。
  - id: c2
    goal: g2
    type: choice
    prompt: 網格搜尋有 2 種正則化方式 × 5 種強度，共 10 組候選參數。每組做 10-fold，最後用全部開發資料重訓 1 次（refit）。總共擬合幾次？
    options:
      A: '20'
      B: '100'
      C: '101'
      D: '110'
    answer: C
    explain:
      A: 錯。20 是把組數 10 和摺數 10 相加；兩者是相乘關係，因為每一組都要做完整 K 摺。
      B: 錯。10 × 10 = 100 只算了各摺的訓練，漏掉選定參數後的重訓。
      C: 對。10 × 10 = 100 次摺內訓練，再加 1 次全資料重訓，共 101 次。若改用 5-fold，摺內訓練只有 50 次，共 51 次；10-fold 每輪用 90% 的資料訓練，偏差較小，但成本約為 5-fold 的 2 倍。
      D: 錯。110 是把重訓也乘上了組數；重訓只在選定參數後做 1 次，不是每組一次。
  - id: c4
    goal: g1
    type: choice
    prompt: 100 筆資料做 5-fold，不洗牌，依索引順序切成連續 5 摺（第 1 摺是索引 0–19，第 3 摺是索引 40–59）。第 3 輪的訓練與驗證各是什麼？
    options:
      A: 驗證是索引 40–59（20 筆），訓練是其餘 80 筆（索引 0–39 與 60–99）
      B: 驗證是索引 40–59，訓練只有排在它前面的索引 0–39（40 筆）
      C: 驗證是索引 0–19，訓練是索引 20–99
      D: 驗證與訓練各 50 筆，兩者輪流對調
    answer: A
    explain:
      A: 對。第 3 輪只有第 3 摺當驗證，其餘 4 摺（80 筆）合起來訓練，連排在驗證摺後面的 60–99 也在內。
      B: 錯。只用較早的資料訓練，是時間序列切分的做法。K-fold 的訓練集包含驗證摺前後所有的其他摺。
      C: 錯。索引 0–19 是第 1 摺，輪到第 1 輪才當驗證。
      D: 錯。各 50 筆是 K=2 才會有的切法。K=5 時每輪驗證 1/5、訓練 4/5。
  - id: c5
    goal: g3
    type: choice
    prompt: 三份資料要各自做交叉驗證。甲：36 個月的銷量，要預測下個月。乙：每位客戶有數十筆交易，要預測全新客戶。丙：彼此獨立的產品照片。下列哪一組切法搭配最合適？
    options:
      A: 甲用洗牌的一般 K-fold；乙用 GroupKFold；丙用時間序列切分
      B: 甲用 GroupKFold；乙用時間序列切分；丙用洗牌的一般 K-fold
      C: 甲用留一法；乙用留一法；丙用留一法
      D: 甲用時間序列切分；乙用 GroupKFold；丙用洗牌的一般 K-fold
    answer: D
    explain:
      A: 錯。銷量有時間先後，洗牌會讓未來的月份跑進訓練、過去的月份拿來驗證。照片彼此獨立，不需要時間序列切分。
      B: 錯。銷量要用較早的月份訓練、較晚的月份驗證，不是按群組切。客戶資料才需要依群組切分。
      C: 錯。留一法只是 K 等於樣本數，沒有處理時間先後與同一客戶的資料。乙裡同一位客戶的其他筆資料仍會留在訓練集，分數偏高。
      D: 對。銷量依時間切，訓練在前、驗證在後。客戶依群組切，同一位客戶的資料不跨摺。獨立的照片用一般 K-fold，洗牌即可。
  - id: c3
    goal: g3
    type: short
    prompt: 要在 K-fold 裡對特徵做標準化，為什麼每一摺都要重新用訓練摺算平均與標準差，而不是先對全部資料標準化再切摺？另外，保留的最終測試集在這個流程裡放在哪裡？
    key_points:
      - 保留的測試集在切摺之前就先留出，不進入 K-fold，最後只評估 1 次
      - 驗證摺的資料不能參與前處理的學習（平均與標準差），否則驗證摺的資訊流進訓練
      - 這是資料洩漏，會讓驗證分數偏樂觀
      - 做法是每一輪只在訓練摺 fit，再用同一組參數轉換驗證摺（可用 Pipeline 包起來）
author: claude
status: draft
---

## 為什麼需要

資料分割（見 [[train-val-test-split]]）只切一次驗證集，分數會看運氣。換一種切法，分數可能差很多，資料少時更明顯。

本頁用 10 天的交易資料（S01–S10，標籤 1 表示盜刷，5 筆盜刷、5 筆正常）。切一次、留 2 筆驗證，準確率只能是 0、0.5 或 1，哪 2 筆被選中就決定了結果。

K-fold 交叉驗證（英文 K-fold Cross-Validation）讓每一筆資料輪流當一次驗證，再把結果平均。這樣用到全部資料，分數也比單次切分穩定。

## 直覺

把資料排成一列，切成 K 段，每一段叫一摺（fold）。每一輪挑 1 摺當驗證集，其餘 K−1 摺合起來當訓練集。

![每一摺輪流當驗證集：每一欄恰好驗證 1 次；第 1 摺只有負類、第 3 摺只有正類](figure:l23303-kfold-split)

圖中每一列是一輪。K 輪做完，每筆資料恰好驗證 1 次、訓練 K−1 次，最後把 K 個驗證分數平均。

每一輪都從頭訓練一個新模型，上一輪的權重不會帶到下一輪。

## 定義與公式

設有 $n$ 筆資料，分成 $K$ 個互不重疊、大小大致相等的摺。第 $k$ 輪用第 $k$ 摺驗證，得到分數 $s_k$，例如準確率。

:::tip[重點]
K 輪、每筆資料恰好當 1 次驗證、訓練 K−1 次，最後把 K 個分數平均。
:::

整體結果是 K 個分數的平均：

$$
\bar{s}=\frac{1}{K}\sum_{k=1}^{K}s_k
$$

$\bar{s}$ 是平均分數，$K$ 是摺數，$s_k$ 是第 $k$ 摺在驗證摺上的分數。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.1、3.1.2 節；scikit-learn 官方文件 KFold、GridSearchCV API 頁面]
以準確率為例，各摺大小相同時，這個平均等於把全部預測合起來算出的準確率。這個等式只對能逐筆加總的指標成立。

AUC、F1 不行。兩摺的 AUC 都是 1，合併預測的 AUC 仍可能小於 1，因為不同摺的分數尺度不一定可比。

各摺分數的離散程度，用標準差表示：

$$
\mathrm{std}=\sqrt{\frac{1}{K}\sum_{k=1}^{K}\left(s_k-\bar{s}\right)^2}
$$

這是 NumPy 預設的算法（分母為 $K$）。有些教材分母用 $K-1$，數值會略大。

:::

$n$ 可被 $K$ 整除時，每輪的訓練筆數是 $\frac{(K-1)\,n}{K}$。$n=10$、$K=5$ 時是 8 筆，驗證 2 筆。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.1、3.1.2 節；scikit-learn 官方文件 KFold、GridSearchCV API 頁面]
不能整除時，各摺大小不同。第 $k$ 輪的訓練筆數是 $n$ 減去第 $k$ 摺的筆數，上式只是近似值。

若有 $C$ 組候選超參數（hyperparameter），每組都做一次 K-fold，總擬合次數是：

$$
N_{\mathrm{fit}}=C\times K\;(+1)
$$

$N_{\mathrm{fit}}$ 是擬合次數。括號的 +1 是選定參數後，用全部開發資料重訓的 1 次，有做才算。

例：$C=12$、$K=5$ 時是 60 次，加重訓共 61 次；$K=10$ 時是 120 次，加重訓共 121 次。

適用條件：資料可視為獨立同分布、$2 \le K \le n$、各摺大小接近。資料有時間先後或群組結構時，要換切法，見後文。
:::

## 走一次流程

以下串起交叉驗證與最後測試；切摺、逐摺訓練和平均分數是 K-fold 的核心：

1. 先留出測試集，之後不碰。
2. 在剩下的開發資料上切成 K 摺。
3. 每一輪用訓練摺訓練，再在驗證摺打分。
4. 平均 K 個分數，用來比較候選設定。
5. 最後只在測試集評估 1 次。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1、3.1.1 節]
第 3 步的前處理也只用訓練摺。選定設定後，在第 5 步以前，用全部開發資料重訓 1 次。
:::

:::note[例子]
S01–S10 當開發資料，$K=5$、不洗牌，每連續 2 筆成一摺。下表的準確率是**假設值**，用來示範平均怎麼算，不是模型實測。
:::

| 摺 | 驗證（索引） | 訓練（索引） | 假設的準確率 |
|---:|---|---|---:|
| 1 | 1、2 | 3–10 | 1.0 |
| 2 | 3、4 | 1–2、5–10 | 0.5 |
| 3 | 5、6 | 1–4、7–10 | 0.5 |
| 4 | 7、8 | 1–6、9–10 | 1.0 |
| 5 | 9、10 | 1–8 | 0.5 |

平均：$\bar{s}=(1.0+0.5+0.5+1.0+0.5)/5=0.70$。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.1 節]
標準差：偏差平方和為 $0.09+0.04+0.04+0.09+0.04=0.30$，除以 5 得 0.06，開根號約 0.245。
:::

10 筆資料各驗證 1 次，共 10 次預測，其中 7 次答對，所以 $7/10=0.70$，和平均相同。單次切分只看 2 筆，結果只能是 0、0.5 或 1。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.2.2「Cross-validation iterators with stratification based on class labels」；scikit-learn 官方文件 roc_auc_score API 頁面]
這個切法沒有分層。第 1 摺的驗證集全是負類，第 3 摺全是正類，驗證摺裡只有一種類別時，無法算 ROC AUC。分層切法見 [[stratified-k-fold]]。
:::

## 程式（補充）

先看切法。`cv.split` 回傳每一輪的訓練索引與驗證索引，用 10 筆資料、不洗牌，可以對照上表：

```python
import numpy as np
from sklearn.model_selection import KFold

X = np.arange(10).reshape(-1, 1)   # 10 筆資料，索引 0–9，對應 S01–S10
cv = KFold(n_splits=5, shuffle=False)
for k, (tr, va) in enumerate(cv.split(X), start=1):
    print(k, "訓練", tr, "驗證", va)
```

輸出如下（索引從 0 起算，對應上表的 1–10）：

```text
1 訓練 [2 3 4 5 6 7 8 9] 驗證 [0 1]
2 訓練 [0 1 4 5 6 7 8 9] 驗證 [2 3]
3 訓練 [0 1 2 3 6 7 8 9] 驗證 [4 5]
4 訓練 [0 1 2 3 4 5 8 9] 驗證 [6 7]
5 訓練 [0 1 2 3 4 5 6 7] 驗證 [8 9]
```

:::tip[讀碼重點]
- 看 `KFold(n_splits=5, shuffle=False)`：不洗牌時，每一摺是連續的 2 筆，驗證索引依序是 [0 1]、[2 3]……
- `cv.split(X)` 回傳的是索引，不是資料本身；要用索引再去取 `X`、`y`。
- 每筆資料恰好出現在 1 個驗證集、4 個訓練集：數一數每個索引在「驗證」欄出現幾次。
:::

再看打分。`cross_val_score` 把「切摺、逐摺訓練、逐摺打分」包成一行。下面用 scikit-learn 產生的模擬資料，讓程式可以直接執行：

```python
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import KFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = make_classification(n_samples=200, random_state=0)  # 0：固定模擬資料的產生
cv = KFold(n_splits=5, shuffle=True, random_state=42)  # 42：只固定洗牌分摺
model = make_pipeline(StandardScaler(), LogisticRegression())
scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
print(len(scores))                       # 5：每摺 1 個分數
print(scores.round(3))                   # 各摺準確率
print(f"{scores.mean():.3f} {scores.std():.3f}")  # 平均與標準差
```

輸出如下：

```text
5
[0.95  0.95  0.925 0.85  0.95 ]
0.925 0.039
```

第一行必為 5。平均與標準差的數值取決於資料與 `random_state`，換 scikit-learn 版本或換資料產生方式，數字可能不同；這裡的結果來自 scikit-learn 1.9.1。實際作業時，`X`、`y` 換成已留出測試集後的開發資料。

:::tip[讀碼重點]
- 看 `make_pipeline(StandardScaler(), LogisticRegression())`：標準化放進 `Pipeline`（見 [[sklearn-pipeline]]），才會每摺只用訓練摺重新擬合。
- `cross_val_score` 每一摺都複製一個全新模型，只回傳分數，不回傳訓練好的模型。最後要另外對全部開發資料呼叫 `model.fit(X, y)`。
- `random_state` 有兩個，用途不同：`make_classification(random_state=0)` 固定資料怎麼產生，`KFold(random_state=42)` 只固定洗牌分摺。模型若有隨機步驟，要在模型上另外設種子。
- `shuffle=False` 時不能給非空的 `random_state`（例如 42），會報錯；保留預設 `None` 則沒問題。
- `scores.std()` 預設分母是 K，與前面的公式一致；回報時要同時寫平均與標準差。
:::

## 怎麼用、怎麼判讀

### 怎麼選 K

K=5 或 10 是常見設定，能在評估精確度與運算效率之間取得平衡。每輪要重新訓練，一組參數共擬合 K 次。

:::supplement[來源：Hastie 等人《The Elements of Statistical Learning》7.10 節；scikit-learn 使用者指南 3.1.2.1.1「K-fold」]
K 的取捨有三件事：偏差、變異與成本。

偏差（bias）是系統性偏高或偏低。每輪訓練的資料比最終模型少，驗證分數就傾向偏悲觀。

變異（variance）是換一批資料或換一種切法時，估計值晃動的程度。
:::

| K | 每輪訓練占比（約） | 擬合次數（1 組參數） | 取捨 |
|---|---|---|---|
| 2（補充） | 50% | 2 | 訓練資料少，分數偏低估，成本最低 |
| 5 | 80% | 5 | 常見設定 |
| 10 | 90% | 10 | 常見設定 |
| $n$ | $(n-1)/n$ | $n$ | 即留一法，見 [[leave-one-out-cv]] |

:::supplement[來源：Hastie 等人《The Elements of Statistical Learning》7.10 節；scikit-learn 使用者指南 3.1.2.1.1「K-fold」]
表中 $K=5$ 是偏差與成本的折衷；$K=10$ 的偏差更小，成本約為 $K=5$ 的 2 倍。
:::

- 偏差：K 越大，每輪訓練的資料越接近全部，偏差越小。（補充）
- 變異：K 大時各摺的訓練集高度重疊，K 個分數彼此相關。（補充）
- 留一法的評估波動可能較大。
- 變異的實際差異仍依資料與模型而定。（補充）
- 成本：擬合次數是 K 倍。
- 每次只用 $(K-1)/K$ 的資料，總時間通常不恰為 K 倍。（補充）
- 若訓練時間與資料量成正比，總時間約為單次全資料訓練的 $K-1$ 倍；固定開銷與前處理會讓數字偏離。（補充）
- 資料量：資料少時單次切分最不穩，交叉驗證價值最高，訓練也便宜，可用 $K=10$。資料很大、訓練很貴時，$K=3$～5 或單次切分已夠用。（補充）

### 怎麼判讀 K 個分數

先看平均，再看標準差。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.1 節；Bengio 與 Grandvalet（2004）]
也要留意最低的那一摺。標準差只描述這 K 個摺分數的離散程度，不是平均分數的誤差，也不是信賴區間。

- 候選設定的平均差距小於標準差時，不要過度解讀。這是保守提醒，不是顯著性檢定。
- 某一摺特別低，回頭檢查該摺：類別是否缺漏、有沒有離群值、是否混入同一群樣本。

:::

### 和相近切法怎麼選

| 切法 | 和 K-fold 的差別 | 何時改用 |
|---|---|---|
| 分層 K-fold | 每摺類別比例接近整體；本例每摺 1 負 1 正 | 類別不平衡、要在每摺算 AUC，見 [[stratified-k-fold]] |
| 留一法 | $K=n=10$，每摺驗證 1 筆 | 資料極少且訓練便宜，見 [[leave-one-out-cv]] |
| 重複 K-fold | 重新洗牌、重做 R 輪，共擬合 $R\times K$ 次 | 想看分數受切法影響的波動，見 [[repeated-k-fold]] |
| 時間序列切分（補充） | 訓練永遠早於驗證 | 資料有時間先後，見 [[time-series-split]] |
| 巢狀交叉驗證（補充） | 內層調參、外層評估 | 調參用的分數又要當最終成績，見 [[nested-cross-validation]] |

:::caution[注意]
先對全部資料標準化、補值或選特徵，再切摺，是資料洩漏（見 [[data-leakage]]）。驗證摺的資訊跑進訓練，分數會偏高。（補充）
:::

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1、3.1.2.4、3.1.2.6 節]
K-fold 假設資料可互換。本例若要預測未來交易，第 1 摺用 3–10 日訓練、預測 1–2 日，等於用未來訓練過去，驗證分數不能代表上線表現。
:::

### 換個場景

指引 5-18 說明，資料量充足時也能使用 K-fold；5-27 則列出中大型資料與模型比較等用途。一般分類或迴歸資料若適合這種切法，可透過輪流驗證觀察表現是否穩定。

:::supplement[來源：scikit-learn 使用者指南 3.1「Cross-validation」的 3.1.2.4、3.1.2.6 節]
切摺的方式要看資料怎麼產生、模型要預測誰。同樣是交叉驗證，以下領域各用不同的切法。

| 場景 | 資料特性 | 切法 | 判讀重點 |
|---|---|---|---|
| 醫療影像診斷 | 每位病人有多張影像，要診斷全新病人 | 依病人分組切，同一位病人不跨摺 | 按張數隨機切會讓同一人的影像同時出現在訓練與驗證，分數偏高 |
| 交通流量預測 | 每小時一筆，有時間先後 | 時間序列切分，本例的訓練窗每輪往後加長 | 驗證永遠晚於訓練；各摺的訓練量與驗證時段都不同，分數差異要連同季節與資料漂移一起看 |
| 客服工單分類 | 同一客戶常有多張相關工單，緊急工單很少，要分類新客戶的工單 | 依客戶分組，並盡量維持類別比例（`StratifiedGroupKFold`） | 先檢查各摺的緊急工單夠不夠；不夠就減少摺數，不能為了分層拆散同一客戶 |

以醫療影像為例，200 位病人各有 10 張影像，共 2,000 張。5-fold 依病人切，每摺 40 位病人、約 400 張影像。同一位病人的 10 張影像一定在同一摺。

三個場景的共通點是：驗證摺要模擬「上線後會遇到的新資料」。上線時遇到新病人、更晚的時間或新來的工單，驗證就要照這個方向切。

:::

## 常見誤解

- 「K 個模型就是最終模型」：不是。每一摺的模型只用來打分，最後要用全部開發資料重訓。（補充）
- 「K-fold 的分數可以當最終成績」：最終成績要用沒參與調參的測試集。
- 用同一組分數挑參數，再拿它當成績，會偏樂觀（見 [[nested-cross-validation]]）。（補充）
- 「K 越大越好」：成本會增加，留一法的評估波動也可能較大。
- K 大時的偏差與變異取捨仍要看資料與模型。（補充）
- 「`KFold` 會自動分層」：不會。`KFold` 只平均分摺；有分層需求要用 `StratifiedKFold`。
- 「`cross_val_score(..., cv=5)` 一定不分層」：分類器搭配單標籤的二元或多類別目標時，整數 `cv` 預設用分層切法；迴歸等其他情況用一般 K-fold。兩者預設都不洗牌。（補充）
- 「資料先按類別排好也沒關係」：不洗牌時，連續切摺可能讓某摺只有一種類別，如本例第 1、3 摺。（補充）
- 「同一位客戶的多筆資料可以散在不同摺」：這樣驗證摺的樣本和訓練摺很像，分數偏高。要依群組切分（例如 `GroupKFold`）。（補充）

## 進階

### 摺大小不一（補充）

$n$ 除以 $K$ 有餘數時，scikit-learn 會讓前 $n \bmod K$ 摺多 1 筆。例如 $n=11$、$K=5$，各摺大小是 3、2、2、2、2，各輪訓練筆數是 8、9、9、9、9。

此時各摺平均給每一摺相同權重，但第 1 摺有 3 筆、其他摺只有 2 筆。

對準確率、MSE 這類可逐筆平均的指標，各摺平均會略不同於合併預測的分數。要得到合併結果，需按各摺筆數加權。AUC、F1 不能逐筆平均，兩種算法本來就可能不同。

### 教材表述差異

指引 5-18 說 K-fold 在資料量有限時特別有用，5-27 的適用場景卻寫中大型資料集（數千筆以上）。兩處說法不一致。

:::supplement[來源：Hastie 等人《The Elements of Statistical Learning》7.10 節；scikit-learn 使用者指南 3.1.2.1.1「K-fold」]
實務上，資料少時單次切分最不穩，交叉驗證價值最高；資料很大、訓練很貴時，才會改成單次切分。本頁的建議照這個邏輯寫。
:::

官方取哪一邊不確定，可寫信給執行單位（ipas@itri.org.tw）查證。

### 參考來源

- 科目 3 學習指引 5-17、5-18、5-26～5-29：切分、平均、重訓與常見 K 值。（支持：為什麼需要、直覺、定義與公式、走一次流程、怎麼選 K、和相近切法怎麼選、教材表述差異、小結）
- scikit-learn 使用者指南 [3.1「Cross-validation」](https://scikit-learn.org/stable/modules/cross_validation.html) 的 3.1.1、3.1.2.1、3.1.2.2、3.1.2.4、3.1.2.6 節，以及 [KFold API 的 Notes](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.KFold.html)。（支持：定義與公式、走一次流程、程式、怎麼判讀 K 個分數、和相近切法怎麼選、換個場景、常見誤解、摺大小不一、小結）
- [Hastie 等人《The Elements of Statistical Learning》作者書籍官網](https://hastie.su.domains/ElemStatLearn/)，7.10 節：建議 $K=5$ 或 10。（支持：怎麼選 K、教材表述差異）
- [Bengio 與 Grandvalet（2004）〈No Unbiased Estimator of the Variance of K-Fold Cross-Validation〉](https://jmlr.org/papers/v5/grandvalet04a.html)，JMLR 第 5 卷，第 1089–1105 頁。（支持：怎麼判讀 K 個分數）

## 小結

- K-fold 把資料分成 K 摺，輪流 1 摺驗證、K−1 摺訓練，共訓練 K 次，再平均 K 個分數。
- 每筆資料恰好驗證 1 次，結果比單次切分穩，也用到全部資料。
- 擬合次數是候選組數 × K，選定後再重訓 1 次。（補充）
- K=5 或 10 是常見折衷。
- 前處理放在每一摺的訓練摺內。（補充）
- 測試集先留出，最後只用 1 次。
- 類別不平衡用分層。
- 資料有時間先後用時間序列切分、調參又要評估用巢狀。（補充）
