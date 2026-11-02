---
id: top-k-error
title: Top-k 正確率與錯誤率
kind: metric
codes: [L21102, L23303]
aliases: [Top-5 Error, Top-5錯誤率, Top-k Accuracy]
requires: [accuracy]
summary: Top-k 正確率看真實類別是否排進前 k 名，錯誤率是沒有進榜的比例
goals:
  - id: g1
    text: 依六類排名判定 Top-1、Top-5 命中，計算正確率與互補的錯誤率
formula_groups:
  - id: top-k-complement
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.top_k_accuracy_score.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21102-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 六類分類的 20 筆測試，真值有 16 筆進前五名、其中 9 筆排第一。Top-5 錯誤率多少？
    options:
      A: 45%，以前一名命中的 9 筆除以 20
      B: 20%，以前五名未命中的 4 筆除以 20
      C: 80%，以前五名命中的 16 筆除以 20
      D: 55%，以前一名未命中的 11 筆除以 20
    answer: B
    explain:
      A: 9/20 是 Top-1 正確率，並非 Top-5 錯誤率。
      B: 沒進前五名的 4 筆才是 Top-5 錯誤，4/20 = 20%。
      C: 16/20 是 Top-5 正確率，與所問的錯誤率互補。
      D: 11/20 是 Top-1 錯誤率，採用的排名範圍不同。
  - id: c2
    goal: g1
    type: choice
    prompt: 一筆六類商品分類的真值排第五，系統若以 Top-1 自動選定唯一商品、以 Top-5 顯示候選清單，應如何判定？
    options:
      A: 唯一商品選錯，候選清單仍包含真值
      B: 唯一商品選對，候選清單卻漏掉真值
      C: 唯一商品選錯，候選清單也漏掉真值
      D: 唯一商品選對，因為第五名也是第一名
    answer: A
    explain:
      A: 第五名不符合 Top-1，但符合前五名命中。
      B: 真值未排第一，且仍在前五名清單內。
      C: 第五名包含在前五名，候選清單沒有漏掉真值。
      D: 第一與第五是不同排名，不能把候選命中當唯一選對。
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊比較同一六類測試集的 Top-1 與 Top-5，兩者使用相同同分規則。哪項必定成立？
    options:
      A: Top-5 正確率小於或等於 Top-1，因為候選越多越容易錯
      B: Top-5 錯誤率大於或等於 Top-1，因為前五名範圍更大
      C: Top-5 正確率一定等於 Top-1，因為兩者使用相同真值
      D: Top-5 正確率大於或等於 Top-1，因為第一名也在前五名
    answer: D
    explain:
      A: 納入更多候選不會移除原本的第一名命中。
      B: 候選範圍增加時，錯誤率不會因此上升。
      C: 真值相同不代表命中條件相同，排名二至五可能新增命中。
      D: 第一名集合包含於前五名集合，所以命中比例不會減少。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-48, guide-1:3-49]
---

## 為什麼需要

六種零件外觀相近，模型把正確類別排第二。若系統必須自動選一類，這筆算錯；若要先列五個候選供人工確認，它仍有參考價值。

Top-k 正確率（Top-k Accuracy）衡量真實類別是否進前 $k$ 名；Top-k 錯誤率（Top-k Error）則看沒進榜的比例。先分清楚報的是哪一個。

## 直覺

像把六個候選排成名次表，然後看正解有沒有在取用範圍內。Top-1 只開第一格，Top-5 則開前五格；每張影像最多算一次命中。

![括號標出真實類別索引；第五名仍算 Top-5 命中，第六名才算未命中。](figure:l21102-top-k-error-ranks)

## 定義與公式

指引將 Top-5 放在多分類影像評估中，說明真實類別落在前五名就算正確，常見於 ImageNet 這類類別多的資料。這個判定是「命中」，錯誤率要再計算未命中的比例。

:::supplement[來源：scikit-learn top_k_accuracy_score；必要前置：固定候選範圍與同分規則]
本頁採單標籤六類，要求 $1\le k\le6$；每筆有一個真值、六個分數。資料不可為空；$k$ 涵蓋全部類別時必然命中，難以比較模型。

同分必須有固定規則。本例採較大類別索引優先，與該 API 相同；分數欄位順序也必須對應固定類別表。若只有三類，Top-5 沒有相同的候選意義，不應直接拿來比較。
:::

### 命中比例與互補（補充）

$$
\begin{aligned}
\mathrm{Acc}@k&=\frac1N\sum_{i=1}^{N}\mathbf1[y_i\in S_{i,k}],\\
\mathrm{Err}@k&=1-\mathrm{Acc}@k
\end{aligned}
$$

$N$ 是樣本數，$y_i$ 是第 $i$ 筆真實類別；$S_{i,k}$ 是該筆分數最高的 $k$ 個類別集合。$\mathbf1$ 在真值進榜時為 1，否則為 0。

若 4 筆有 3 筆進前五名，則 $\mathrm{Acc}@5=3/4=0.75$，$\mathrm{Err}@5=1-0.75=0.25$。分母是 4 筆影像，不是 20 個候選。

## 算一次

:::supplement[來源：scikit-learn top_k_accuracy_score；核心延伸：以六類教學資料判定命中與互補]

共用檔的製造六類索引是：0 正常、1 刮痕、2 凹痕、3 汙點、4 裂紋、5 缺角。輸入是各事件中 `[40,0,48,8]` 的獨立裁切圖，與偵測框的真值分開。

| 事件／真值 | 六類排名，由高至低 | Top-1 | Top-5 |
|---|---|---|---|
| M09／2 | 2 → 0 → 1 → 3 → 4 → 5 | 命中 | 命中 |
| M10／3 | 0 → 3 → 1 → 2 → 4 → 5 | 未命中 | 命中 |
| M11／4 | 0 → 1 → 2 → 3 → 4 → 5 | 未命中 | 命中 |
| M12／5 | 0 → 1 → 2 → 3 → 4 → 5 | 未命中 | 未命中 |

Top-1 正確率為 $1/4=0.25$、錯誤率為 $3/4=0.75$。Top-5 正確率為 $3/4=0.75$、錯誤率為 $1/4=0.25$；兩種 $k$ 都各自互補。

交通測試 T09–T12 改用六種交通類別，真值名次仍是 1、2、5、6，得到相同分數。只用各領域 09–12 測試事件，不把訓練或驗證資料加進分母。

本算例以六類示範候選判定；它不是 ImageNet 實測，也不代表增加候選數會讓唯一分類結果變正確。來源：scikit-learn 指標定義與本站教學合成資料。
:::

## 程式（補充）

下列直接列出共用檔 M09–M12 的測試分數。固定類別索引 0–5，不抽樣、不訓練模型。

```python
from sklearn.metrics import top_k_accuracy_score
y = [2, 3, 4, 5]
scores = [[.24, .18, .30, .13, .09, .06],
          [.30, .18, .13, .24, .09, .06],
          [.30, .24, .18, .13, .09, .06],
          [.30, .24, .18, .13, .09, .06]]
for k in [1, 5]:
    acc = top_k_accuracy_score(y, scores, k=k, labels=list(range(6)))
    print(f"Top-{k} 正確率={acc:.2f} 錯誤率={1-acc:.2f}")
```
```text
Top-1 正確率=0.25 錯誤率=0.75
Top-5 正確率=0.75 錯誤率=0.25
```

:::tip[讀碼重點]
測試真值沒出現所有六類，仍傳完整 `labels`，使六個分數欄位與類別對齊。輸出正確率後再用 1 減，才得到錯誤率。
:::

### 核對同分與類別數

```python
tie = [[.30, .25, .20, .15, .05, .05]]
print("同分真值4:", top_k_accuracy_score([4], tie, k=5, labels=list(range(6))))
print("同分真值5:", top_k_accuracy_score([5], tie, k=5, labels=list(range(6))))
def validate_k(k, class_count):
    if not 1 <= k <= class_count:
        raise ValueError("k 超出類別範圍")
try:
    validate_k(5, 3)
except ValueError as error:
    print(error)
```
```text
同分真值4: 0.0
同分真值5: 1.0
k 超出類別範圍
```

最後兩類同為 0.05，索引 5 優先，故真值 4 掉到第六名。`validate_k` 是本例先檢查資料的規則，並非聲稱 scikit-learn 對超出類別數一定丟出相同例外。

## 怎麼用、怎麼判讀

類別很多、想看真值是否落在短候選清單時，可報 Top-5。若最後仍由系統自動選唯一類別，要同時看 Top-1，不應把 Top-5 成績當成自動選對的比例。

### 換個場景

| 場景 | 判讀重點 |
|---|---|
| ImageNet 等大量類別影像 | 指引的 Top-5 應用；分清命中與錯誤率 |
| 製造缺陷候選（補充） | 清單供人工確認，不等於唯一缺陷選對 |
| 交通影像分類（補充） | 類別數較少時，過大的 k 會弱化比較 |
| 零售商品候選（補充） | 真值進候選清單，仍需後續商品確認 |

## 常見誤解

- **前五名有正解，所以 Top-5 錯誤率增加。** 命中增加的是正確率，錯誤率反而減少。
- **每張圖的五個候選各算一筆樣本。** 分母仍是影像筆數。
- **提高 k 就證明模型改善。** 放寬命中條件也會讓分數提高。（補充）
- **Top-k 衡量框的位置。** 本頁是類別排序，框位置另看 IoU 與偵測評分。（補充）

## 進階

### 單調關係（補充）

同一批樣本、分數與同分規則下，前一名必包含於前五名。因此 Top-5 正確率不小於 Top-1，Top-5 錯誤率不大於 Top-1；兩者相等也可能發生。

這是命中集合包含關係的推論，支持比較不同 k 的必要判斷。不能用不同測試集的兩個分數直接套此結論。

### 參考來源

- 科目 1 學習指引 `guide-1:3-48`～`guide-1:3-49`：影像分類評估、Top-5 命中條件與 ImageNet 多分類場景。
- [scikit-learn top_k_accuracy_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.top_k_accuracy_score.html)：公式、類別順序、同分與程式 API。
- [Stanford CS231n 分類課程](https://cs231n.github.io/classification/)：從影像到多類分數、再用真值核對的教學思路，支持直覺與任務邊界。

## 小結

- Top-k 正確率看真值是否進入前 k 名。
- 錯誤率等於 1 減去同一個 k 的正確率。（補充）
- 分母是樣本數，每筆最多記一次命中。（補充）
- 比較時固定測試集、類別表、k 與同分規則。（補充）
