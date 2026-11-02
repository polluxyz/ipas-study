---
id: stratified-k-fold
title: 分層 K-fold 交叉驗證
aliases: [Stratified K-fold, StratifiedKFold, 分層K折交叉驗證]
kind: technique
codes: [L23303]
is_a: [k-fold-cross-validation]
guide_refs: [guide-3:5-27]
textbook: v2
summary: 分層 K-fold 在分摺時盡量保留整體類別比例，減少某摺缺少少數類別的問題
goals:
  - id: g1
    text: 分配每摺的類別數，處理不能整除與少數類別不足的情況
  - id: g2
    text: 讀懂分層切分輸出，分辨分層、分組與時間切分的適用界線
formula_groups:
  - id: class-count
    source: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedKFold.html
    status: verified
    checked_by: ctx_2f4741389715
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療資料有 3 筆正類與 9 筆負類，每人一筆，做 3-fold 分層切分。每摺的驗證集應如何分配？
    options:
      A: 2 筆正類、2 筆負類
      B: 1 筆正類、3 筆負類
      C: 3 筆正類、1 筆負類
      D: 0 筆正類、4 筆負類
    answer: B
    explain:
      A: 分層保留原本 25% 正類比例，不會把它改成 50%。
      B: 正類與負類各除以 3，得到每摺 1 正與 3 負。
      C: 把全部正類放到一摺會讓其他摺缺少正類。
      D: 每摺都沒有正類不可能涵蓋原本的 3 筆正類。
  - id: c2
    goal: g2
    type: choice
    prompt: 要預測新病人是否罹病，同一位病人有多張影像，陽性又很少。哪個做法最合理？
    options:
      A: 只做分層切分，將同一病人的影像分配到所有摺
      B: 先過採樣全部病人的影像，再依標籤做分層切分
      C: 讓每摺固定維持 50% 陽性，不必保留原始類別比例
      D: 依病人分組，並盡量維持各摺類別比例
    answer: D
    explain:
      A: 分層不會阻止同一病人的資訊跨摺，無法模擬全新病人。
      B: 全資料過採樣會讓合成或重複樣本的資訊跨到驗證資料。
      C: 分層目標是接近原始比例，且群組隔離仍然必要。
      D: 群組隔離優先，分層分組切分能在不拆病人的前提下盡量維持比例。
  - id: c3
    goal: g1
    type: choice
    prompt: 某製造資料有 50 筆，其中只有 5 筆瑕疵。想讓每摺都有瑕疵，以下哪個敘述正確？
    options:
      A: 3 摺可分配 2、2、1 筆瑕疵，6 摺無法每摺都有瑕疵
      B: 只要採用分層切分，3 個驗證摺的瑕疵比例就必須完全相同
      C: 想分成 6 個驗證摺時，可以讓同一筆瑕疵同時出現在兩摺
      D: 分層切分會自動合成第 6 筆瑕疵，因此各個驗證摺都不會缺類
    answer: A
    explain:
      A: 5 筆分到 3 摺只能近似平均，分到 6 摺必有至少一摺分不到。
      B: 整數筆數不能任意切成小數，比例通常只能近似。
      C: 同一輪的驗證摺互不重疊，不能重用同一筆湊數。
      D: 分層只分配既有資料，不會生成樣本。
author: codex
status: draft
---

## 為什麼需要

一般切摺可能讓驗證集幾乎沒有少數類別。分層 K-fold 交叉驗證（Stratified K-fold Cross-Validation）維持各摺類別比例，減少評估失真。

建議先讀 K-fold 交叉驗證。本頁沿用該頁的 $n$（樣本數）、$K$（摺數）與 $s_k$（第 $k$ 摺分數），只看「每摺放哪些類別」的差異。

## 直覺

先辨識每筆的類別，再把各類別的樣本平均分配到各摺。每輪仍只拿一摺驗證，其餘訓練；類別比例應接近整體，而不是一律各占一半。

![對照標籤看每列的驗證格：分層後每摺都有正負類，一般切摺可能只剩單一類別](figure:l23303-stratified-k-fold-allocation)

:::supplement[來源：scikit-learn User Guide 3.1.2.2 Cross-validation iterators with stratification based on class labels]
共用資料正負各 5 筆，一般切法的第 1 摺是 S01、S02，全為負類；第 3 摺是 S05、S06，全為正類。這些驗證摺不能計算 ROC AUC，分層可避免本例的問題。
:::

## 定義與公式

分層切分用於分類資料，讓各摺的類別占比盡量接近原始資料。

:::supplement[來源：scikit-learn StratifiedKFold API]
`StratifiedKFold` 接受二元或多類別的單標籤分類目標，不適用於直接拿連續的迴歸目標分層。

設類別 $c$ 有 $n_c$ 筆，第 $k$ 摺共有 $n_k$ 筆，其中類別 $c$ 有 $n_{k,c}$ 筆。分層目標可寫成：

$$
\frac{n_{k,c}}{n_k}\approx\frac{n_c}{n}
$$

$n$ 是全部樣本數，$c$ 是類別，$k$ 是摺編號。共用資料 $n=10$、正類 $n_c=5$；每摺 2 筆中有 1 筆正類，比例 $1/2=5/10=0.5$。

不能整除時只能近似。50 筆中 5 筆正類，做 3-fold，正類可分成 2、2、1；其餘 45 筆負類各分 15 筆，三摺正類比例約為 11.8%、11.8%、6.3%。

若希望**每摺都有每一類**，最少的類別筆數必須至少等於 $K$。例如 5 筆正類分成 6 摺，至少一摺沒有正類；應減少摺數或重新規劃評估。

上述 50 筆資料做 6-fold 時，scikit-learn 會警告少數類別不足，但仍照常切分，不會替缺類的摺補資料。若每個類別的筆數都少於摺數，則會報錯。
:::

## 走一次流程

### 十天交易：逐類分配（補充）

共用 `L23303-splits.json` 中，負類索引是 1、2、3、7、9，正類索引是 4、5、6、8、10。配對同位置的一正一負，形成 5 個驗證摺。

| 摺 | 驗證 ID | 訓練索引 | 驗證負／正 |
|---|---|---|---|
| 1 | S01、S04 | 2、3、5、6、7、8、9、10 | 1／1 |
| 2 | S02、S05 | 1、3、4、6、7、8、9、10 | 1／1 |
| 3 | S03、S06 | 1、2、4、5、7、8、9、10 | 1／1 |
| 4 | S07、S08 | 1、2、3、4、5、6、9、10 | 1／1 |
| 5 | S09、S10 | 1、2、3、4、5、6、7、8 | 1／1 |

每輪訓練 8 筆，恰好 4 負、4 正；每筆資料仍只驗證一次。這是獨立樣本的切分示意，若任務是預測未來交易，應改依時間切分。

### 醫療小樣本：保留原始比例（補充）

`L23303-C1-medical-small.json` 有 12 位不同病人，每人一筆，3 位罹病、9 位未罹病。做 3-fold，每摺驗證 1 正、3 負，訓練 2 正、6 負。

以 `StratifiedKFold(n_splits=3, shuffle=False)` 對這份資料實測，得到的驗證 ID 與 JSON 記錄相同；類別數量不是手填的理想分配。

整體與各驗證摺的正類比例都是 25%，不會被改成 50%。這份資料若做 5-fold，僅 3 位正類就不足以讓每摺都出現正類。

## 程式

### 檢查實際分到的類別數（補充）

`StratifiedKFold.split` 需要同時拿到特徵與標籤。下例的特徵只是佔位，程式用來檢查切分，沒有訓練盜刷模型。

```python
import numpy as np
from sklearn.model_selection import StratifiedKFold

ids = np.arange(1, 11)
X = ids.reshape(-1, 1)
y = np.array([0, 0, 0, 1, 1, 1, 0, 1, 0, 1])
cv = StratifiedKFold(n_splits=5, shuffle=False)
for k, (tr, va) in enumerate(cv.split(X, y), start=1):
    counts = np.bincount(y[va], minlength=2).tolist()
    print(k, ids[va].tolist(), counts, len(tr))
```
```text
1 [1, 4] [1, 1] 8
2 [2, 5] [1, 1] 8
3 [3, 6] [1, 1] 8
4 [7, 8] [1, 1] 8
5 [9, 10] [1, 1] 8
```

:::tip[讀碼重點]
- 四欄依序是摺編號、驗證索引、驗證集負／正類筆數、訓練筆數。
- 本例不洗牌，所以不設 `random_state`；改成洗牌時可用 `shuffle=True, random_state=42`。
- 切分索引不等於完成前處理；前處理仍要每摺只用訓練資料擬合，可放進 Pipeline。
:::

## 怎麼用、怎麼判讀

類別不平衡時特別適合採用分層切分。指引也將它列為分類任務可採用的預設方式。

:::supplement[來源：scikit-learn User Guide 3.1 Cross-validation]
對應到 API，`cross_val_score` 的 `cv=5` 在分類器搭配單標籤二元或多類別目標時，預設採分層切分且不洗牌；其他情況不一定如此。
:::

### 換個場景

先看指引列出的類別條件與領域，再依資料結構決定切法。

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 詐騙偵測 | 正負樣本懸殊 | 分層保留罕見正類，另看召回率與精確率 |
| 醫療診斷、疾病分類 | 疾病類別不平衡 | 檢查每摺陽性數，數量過少就降低摺數 |
| 異常事件預測 | 異常類別很少 | 每摺都要有可供評估的異常樣本 |
| 製造瑕疵（補充） | 每個零件有多張影像 | 先依零件分組，必要時再兼顧分層 |
| 客服工單（補充） | 同一客戶有多張工單 | 以客戶分組，避免相近工單跨摺 |

### 和相近切法比較（補充）

| 方法 | 主要控制什麼 | 不會自動處理什麼 |
|---|---|---|
| K-fold 交叉驗證 | 大致相等的摺大小 | 類別、群組、時間 |
| 分層 K-fold 交叉驗證 | 各摺類別比例 | 同一人跨摺、未來資訊 |
| `GroupKFold` | 同一群組不跨摺 | 各摺類別比例 |
| `StratifiedGroupKFold` | 群組隔離並盡量維持類別比例 | 不保證每摺比例完全一致 |
| 時間序列交叉驗證 | 以較早資料預測較晚資料 | 類別比例或群組隔離 |

同一病人有多筆資料時，普通分層不夠。預測未來疾病風險時，時間限制也要一起考慮；不能為了湊類別比例，把未來資料移回訓練摺。

## 常見誤解

:::supplement[來源：scikit-learn User Guide 3.1.2.2；StratifiedKFold API；StratifiedGroupKFold API]
- 「分層會提高模型準確率」：它改的是評估切法，沒有改模型、損失函數或少數類別數量，不保證準確率提高。
- 「分層能解決類別不平衡」：它維持原比例，沒有增加少數類別；過採樣與類別加權是另外的訓練策略。
- 「分層等於分組」：分層按標籤比例分配，分組按病人或客戶 ID 隔離，兩者目的不同。
:::

:::supplement[來源：imbalanced-learn Common pitfalls 9.1 Data leakage]
重採樣只應在每摺的訓練資料內進行。若先對全部資料過採樣，再切出驗證摺，複製或合成樣本的資訊就可能跨摺，讓驗證成績偏樂觀。
:::

## 進階

### 指引表述需校正

指引 5-27 把分層描述為可減少類別不均帶來的評估失真，並提到少數類別的穩定性與準確度。這裡要分清楚評估切法與模型訓練的效果。

:::supplement[來源：scikit-learn User Guide 3.1.2.2 Cross-validation iterators with stratification based on class labels]
「減少評估失真」指各摺的類別比例較接近整體，避免某摺缺類或比例偏離。原始訓練資料的不平衡仍在；分層沒有改模型，不保證少數類別的預測準確率提高。
:::

### 分層後的波動可能較小（補充）

類別比例變接近，各摺分數的標準差可能縮小。這不表示罕見事件的不確定性消失；要同時回報各摺正類筆數，避免把分層後的小波動解讀成充分可靠。

### 參考來源

- 科目 3 學習指引 5.3，5-27～5-28（支持：定義、分層目的、換個場景的指引領域）。
- [scikit-learn StratifiedKFold API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedKFold.html)（支持：定義與公式、分配算例、程式）。
- [scikit-learn User Guide 3.1.2.2](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-with-stratification-based-on-class-labels)（支持：缺少類別的限制、預設切法與分層後的波動）。
- [scikit-learn StratifiedGroupKFold API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedGroupKFold.html)（支持：分層與分組的比較）。
- [imbalanced-learn Common pitfalls 9.1](https://imbalanced-learn.org/stable/common_pitfalls.html#data-leakage)（支持：重採樣只能在訓練摺內進行）。
- [Inria scikit-learn 課程：Cross-validation framework](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_train_test.html)（支持：走一次流程；參考逐步列出切分再檢查結果的教學安排）。

## 小結

- 分層維持整體類別比例，不是把正負類改成各半。
- 類別數不能整除時比例只能近似；少數類別少於摺數時，無法讓每摺都有該類。
- 分層不會修正同一病人跨摺、時間洩漏或前處理洩漏。
- 看完比例仍要檢查樣本數與指標；分層不保證模型更準。
