---
id: repeated-k-fold
title: 重複 K-fold 交叉驗證
aliases: [Repeated K-fold, RepeatedKFold, RepeatedStratifiedKFold, 重複交叉驗證]
kind: technique
codes: [L23303]
is_a: [k-fold-cross-validation]
contrasts:
  - target: stratified-k-fold
    note: 「重複」決定整套 K-fold 跑幾輪，「分層」決定每摺的類別比例；兩者互不相干，可以合用成 RepeatedStratifiedKFold
    source: [115-1-S3-Q45]
guide_refs: [guide-3:5-26, guide-3:5-28, guide-3:5-29]
gaps:
  - ref: guide-3:5-28
    level: shallow
    ability: 指引只寫重複 K-fold，沒有提到可以和分層合用；115-1 科3 第45題的選項直接出現 RepeatedStratifiedKFold
textbook: v2
summary: 重複 K-fold 多次重新隨機分摺，用所有分數觀察切法造成的平均表現與波動
goals:
  - id: g1
    text: 判讀重分摺流程，算出擬合次數，分辨重複、分層與隨機種子的作用
  - id: g2
    text: 計算全部摺分數的平均與標準差，說明相依分數不能直接產生獨立信賴區間
formula_groups:
  - id: repeated-fit-count
    source: guide-3:5-28
    status: verified
    checked_by: ctx_2f4741389715
  - id: repeated-mean
    source: guide-3:5-28
    status: verified
    checked_by: ctx_2f4741389715
  - id: repeated-spread
    source: https://numpy.org/doc/stable/reference/generated/numpy.std.html
    status: verified
    checked_by: ctx_2f4741389715
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 比較 4 組候選設定，每組做 5-fold、重複 3 輪，選定後另以全部開發資料重訓一次。總擬合次數是多少？
    options:
      A: '13'
      B: '20'
      C: '60'
      D: '61'
    answer: D
    explain:
      A: 13 是把候選組數、摺數、輪數與重訓相加，沒有算每組的完整驗證。
      B: 20 只算 4 組乘 5 摺，漏掉重複輪數與重訓。
      C: 60 是摺內擬合總數，還少了選定設定後的重訓。
      D: 4 乘 5 乘 3 得 60，再加最後重訓 1 次，共 61 次。
  - id: c2
    goal: g2
    type: choice
    prompt: 2-fold 重複 2 輪，四個分數依序為 0.5、1.0、0.5、1.0。採 NumPy 預設分母 4 的標準差，應回報哪一組？
    options:
      A: 平均 1.00，標準差 0.00
      B: 平均 0.75，標準差 0.25
      C: 平均 0.75，標準差 0.50
      D: 平均 0.50，標準差 0.25
    answer: B
    explain:
      A: 只挑出最好分數會忽略較差的摺。
      B: 總和 3 除以 4 得 0.75，離差平方和 0.25 除以 4 後開根號得 0.25。
      C: 0.50 是最大值減最小值的全距，不是標準差。
      D: 0.50 是最小摺分數，沒有平均全部結果。
  - id: c3
    goal: g1
    type: choice
    prompt: 罕見瑕疵分類想保留每摺類別比例，並做 5-fold、重複 3 輪觀察切分波動。哪一個設定直接符合？
    options:
      A: StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
      B: RepeatedKFold(n_splits=5, n_repeats=3, random_state=42)
      C: RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)
      D: RepeatedStratifiedKFold(n_splits=5, n_repeats=1, random_state=42)
    answer: C
    explain:
      A: 分層與洗牌只產生一輪切分，不會自動重複三輪。
      B: 普通重複 K-fold 沒有維持類別比例的要求。
      C: 分層控制比例，重複控制輪數，固定種子使整套流程可重現。
      D: n_repeats 設為 1 只跑一輪，未達指定的三輪。
  - id: c4
    goal: g2
    type: choice
    prompt: 團隊對同一批資料做 5-fold、重複 2 輪，得到 10 個分數。可以把摺分數標準差直接除以 10 的平方根，當作獨立樣本的標準誤嗎？
    options:
      A: 不可以，各摺重用資料，分數彼此相依
      B: 可以，每摺都重新訓練，所以 10 個分數彼此獨立
      C: 可以，固定隨機種子就能消除各個摺分數的相關性
      D: 不可以，應改用最好的一摺分數作為無偏的平均估計
    answer: A
    explain:
      A: 各摺共享樣本且訓練資料重疊，不能直接套用獨立樣本的公式。
      B: 重新擬合模型不會消除訓練資料重疊造成的相關性。
      C: 固定種子只讓流程重現，不會改變分數的相依結構。
      D: 挑最好的一摺會引入選擇偏差，也不是平均成績。
author: codex
status: draft
---

## 為什麼需要

小樣本或高變異任務，換一套切法，成績就可能改變。重複 K-fold 交叉驗證（Repeated K-fold Cross-Validation）重新隨機分摺多輪，讓我們觀察這種波動。

建議先讀 K-fold 交叉驗證。本頁沿用 $K$（摺數）與 $s_k$（摺分數），另用 $R$ 表示重複輪數；不再重走單輪 K-fold 的原理。

## 直覺

做完第一輪 $K$ 摺後，重新洗牌分摺，再做下一輪。每輪仍把每筆資料驗證一次，差別是它和哪些樣本一起出現。

![兩輪各自讓每筆資料驗證一次，輪次之間重新分摺；最後合併十個分數觀察波動](figure:l23303-repeated-k-fold-rounds)

:::supplement[來源：scikit-learn RepeatedKFold API]
共用資料有 10 筆，做 5-fold、重複 2 輪，共得到 10 個摺分數、20 次留出預測。原始資料仍只有 10 筆，沒有增加成 20 個獨立樣本。
:::

## 定義與公式

一組模型設定，每輪訓練 $K$ 次，重複 $R$ 輪的擬合次數為：

$$
N_{\mathrm{fit}}=R\times K
$$

$N_{\mathrm{fit}}$ 是擬合次數，$R$ 是輪數，$K$ 是摺數。本例 $R=2$、$K=5$，共 10 次。指引另例 $R=5$、$K=10$，共 50 次。

有多輪時，以 $s_{r,k}$ 表示第 $r$ 輪、第 $k$ 摺的分數，平均為：

$$
\bar{s}=\frac{1}{RK}\sum_{r=1}^{R}\sum_{k=1}^{K}s_{r,k}
$$

$\bar{s}$ 是全部摺分數的平均，$r$、$k$ 分別是輪與摺的編號。下節 10 個分數相加為 2，故 $\bar{s}=2/10=0.20$。

:::supplement[來源：NumPy numpy.std API；scikit-learn RepeatedKFold API]
為和 K-fold 頁一致，本頁用 NumPy 預設的分母 $RK$ 描述摺分數的波動：

$$
\mathrm{std}=\sqrt{\frac{1}{RK}\sum_{r=1}^{R}\sum_{k=1}^{K}(s_{r,k}-\bar{s})^2}
$$

$\mathrm{std}$ 是標準差，括號內是摺分數與平均的差。下例離差平方和為 0.60，代入得 $\mathrm{std}=\sqrt{0.60/10}\approx0.245$。

若有 $C$ 組候選設定，摺內擬合次數為 $C\times R\times K$；最後選好設定重訓才另加 1。$C=4$ 時，本例是 $4\times2\times5+1=41$ 次。
:::

## 走一次流程

### 十天交易：兩輪切法與分數（補充）

沿用 `L23303-splits.json`，把 10 筆視為開發資料，最終測試集另留。這是獨立樣本切分示例，不能拿未來的交易訓練後評估過去。

下面實測一個只預測「訓練摺多數類別」的基準模型；平手時猜負類。它不使用特徵，只展示切分如何影響分數。

完整結果存於 `L23303-C1-repeated-scores.json`，可逐筆核對表中的驗證索引與分數。

| 摺 | 第 1 輪 | 第 2 輪 |
|---|---|---|
| 1 | 驗證索引 2、9<br>準確率 0.0 | 驗證索引 1、2<br>準確率 0.0 |
| 2 | 驗證索引 1、6<br>準確率 0.5 | 驗證索引 6、9<br>準確率 0.5 |
| 3 | 驗證索引 3、8<br>準確率 0.5 | 驗證索引 4、5<br>準確率 0.0 |
| 4 | 驗證索引 5、10<br>準確率 0.0 | 驗證索引 8、10<br>準確率 0.0 |
| 5 | 驗證索引 4、7<br>準確率 0.5 | 驗證索引 3、7<br>準確率 0.0 |

每格以外的其餘 8 筆用於訓練。例如第一輪第 1 摺留出兩筆負類，訓練變成 3 負、5 正，模型全猜正，兩筆都答錯。

第一輪第 2 摺留出一負一正，訓練剩 4 負、4 正，模型猜負，因此答對一筆，準確率 0.5。

1. 第一輪分數相加為 1.5，平均為 $1.5/5=0.30$。
2. 第二輪分數相加為 0.5，平均為 $0.5/5=0.10$。
3. 全部共有 4 個 0.5、6 個 0，總和 2，平均 0.20。
4. 離差平方和為 $4(0.5-0.2)^2+6(0-0.2)^2=0.60$；除以 10、開根號得標準差約 0.245。

這裡算的是 10 個**摺分數**的標準差，不是兩個輪平均的標準差。回報時要寫清楚採用哪一層，避免把不同的波動量混在一起。

## 程式

### 實測全部摺分數（補充）

`RepeatedKFold` 會在不同輪次重新隨機分摺。設定整數種子，能讓整套多輪結果重現，不會讓各輪都變成同一切法。

```python
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import RepeatedKFold, cross_val_score

X = np.arange(10).reshape(-1, 1)
y = np.array([0, 0, 0, 1, 1, 1, 0, 1, 0, 1])
cv = RepeatedKFold(n_splits=5, n_repeats=2, random_state=42)
scores = cross_val_score(DummyClassifier(strategy="most_frequent"), X, y,
                         cv=cv, scoring="accuracy")
print("擬合次數", len(scores))
print(scores.reshape(2, 5).tolist())
print(f"平均 {scores.mean():.3f} 標準差 {scores.std():.3f}")
```
```text
擬合次數 10
[[0.0, 0.5, 0.5, 0.0, 0.5], [0.0, 0.5, 0.0, 0.0, 0.0]]
平均 0.200 標準差 0.245
```

:::tip[讀碼重點]
- `n_splits=5` 是一輪的摺數，`n_repeats=2` 是整輪重做次數，兩者相乘才是分數數量。
- `scores.reshape(2, 5)` 只把同一串分數排成兩輪，沒有再計算或挑選分數。
- 這個基準模型沒有隨機步驟；種子控制的是切分。實際模型的隨機種子須另外設定。
- 這份輸出來自專案的固定環境；修改資料、種子或套件版本時應重新執行確認。
:::

## 怎麼用、怎麼判讀

重複切分可用在調參的模型比較，也適合觀察小樣本或高變異任務的穩定性。平均接近的模型，要同時看分數分布；可接著讀模型比較。

指引提到研究需回報標準差與信賴範圍，也將觀察不同切法下的波動列為重複驗證的用途。

### 不把波動當成獨立信賴區間（補充）

所有分數重用同一批樣本，訓練資料也彼此重疊。平均與標準差只描述這套切分下的表現，不能直接用「標準差除以摺數平方根」當成獨立樣本的標準誤。

重複 K-fold 本身不提供通用的信賴區間算法。若要統計推論，必須另選適合資料相依結構的估計方法。

### 和分層、留一法比較（補充）

| 方法 | 一組設定擬合次數 | 控制重點 |
|---|---|---|
| K-fold 交叉驗證 | $K$ | 單輪摺分，洗牌也只做一輪 |
| 分層 K-fold 交叉驗證 | $K$ | 盡量維持各摺類別比例 |
| 重複 K-fold 交叉驗證 | $RK$ | 多輪重新分摺，不自動分層 |
| `RepeatedStratifiedKFold` | $RK$ | 同時多輪重切與分層 |
| 留一法交叉驗證 | $n$ | 固定的逐筆留出，重複不增加切法 |

`RepeatedStratifiedKFold` 可兼顧重複與分層，但仍不會隔離同一病人或客戶。時間與群組限制要先滿足，不能為了重切而忽略資料的生成方式。

### 換個場景

| 場景 | 怎麼使用 | 判讀重點 |
|---|---|---|
| 調參與模型比較 | 所有候選模型共用同一套多輪切分 | 除了平均，也觀察波動 |
| 研究與論文報告 | 記錄設定、標準差與推論方法 | 信賴範圍不能由相依摺分數直接套獨立公式 |
| 金融風控、醫療 AI | 固定種子與資料版本以便重現 | 預測未來或同人多筆仍要處理時間、群組限制 |
| 製造小樣本（補充） | 材料試驗訓練便宜時重複比較 | 重切有助觀察評估波動，沒有增加實驗樣本 |
| 客服分類（補充） | 先辨識客戶群組，再規劃重複評估 | 不可直接逐張工單洗牌而讓同客戶跨摺 |

醫療共用小例有 12 位不同病人、3 正與 9 負。若做 3-fold、重複 2 輪，共擬合 6 次；要每摺維持 1 正、3 負，可選 `RepeatedStratifiedKFold`。

## 常見誤解

:::supplement[來源：scikit-learn RepeatedKFold API；RepeatedStratifiedKFold API；User Guide 3.1 Cross-validation]
- 「重複就等於分層」：重複決定多跑幾輪；分層決定類別如何分配。
- 「每輪都重設成相同種子就算重切」：自行建立相同的 K-fold 切法反覆跑，只會重複同一組分摺；應用重複切分器管理整套隨機過程。
- 「波動變小就治好過擬合」：這裡改進的是評估方式，模型仍需要合適的特徵、資料與正則化。
- 「重複後不需要測試集」：反覆比較的分數已參與選模，最後仍需獨立評估。
:::

## 進階

### 醫療例子的樣本數界線（補充）

12 位病人做兩輪時，每人驗證兩次，仍只有 12 位獨立病人。若每人有多次量測，獨立單位更應以病人為準，不能把重複量測與重切分都算成新樣本。

### 參考來源

- 科目 3 學習指引 5.3，5-26、5-28～5-29（支持：用途、重切流程、平均與變異、換個場景的指引場景）。
- [scikit-learn RepeatedKFold API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.RepeatedKFold.html)（支持：程式、種子與擬合次數）。
- [scikit-learn RepeatedStratifiedKFold API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.RepeatedStratifiedKFold.html)（支持：重複與分層變體比較）。
- [scikit-learn User Guide 3.1](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：相依性、時間與群組限制、常見誤解）。
- [NumPy numpy.std API](https://numpy.org/doc/stable/reference/generated/numpy.std.html)（支持：標準差公式與採分母為分數個數的約定）。
- [Bengio 與 Grandvalet（2004）：交叉驗證的變異估計](https://www.jmlr.org/papers/v5/grandvalet04a.html)（支持：忽略摺分數的相關性會低估不確定性）。
- [Inria scikit-learn 課程：Cross-validation framework](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_train_test.html)（支持：實測與判讀；參考同時報告平均和波動的教學方式）。

## 小結

- 重複 $R$ 輪、每輪 $K$ 摺，每組設定擬合 $RK$ 次。
- 回報全部摺分數的平均與標準差，說清楚統計的是摺分數還是輪平均。
- 重複與分層可以合用，但兩者都不自動處理時間與群組隔離。
- 重切不增加獨立資料量，也不直接產生可靠的獨立信賴區間。
