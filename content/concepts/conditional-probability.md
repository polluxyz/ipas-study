---
id: conditional-probability
title: 條件機率
kind: theory
codes: [L23101]
aliases: [Conditional Probability, 聯合機率, 邊際機率]
requires: [probabilistic-modeling]
summary: 條件機率先限縮到已知事件，再計算其中目標事件所占的比例
goals:
  - id: g1
    text: 用列聯表計算條件機率，區分聯合、邊際與反向條件
formula_groups:
  - id: conditional-ratio
    source: guide-3:3-5
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 教學篩檢有 1,000 人，其中 100 人有病；有病且陽性 90 人，無病且陽性 45 人。隨機選出一位陽性者，其有病機率是多少？
    options:
      A: 90%，因為有病的 100 人中有 90 人陽性
      B: 約 66.67%，因為陽性共 135 人，其中 90 人有病
      C: 9%，因為全部 1,000 人中有 90 人同時有病且陽性
      D: 10%，因為全部 1,000 人中有 100 人有病
    answer: B
    explain:
      A: 90% 是給定有病時出現陽性的反向條件，分母不是陽性者。
      B: 給定陽性就把分母改為 90 加 45，90 除以 135 約為 66.67%。
      C: 9% 是有病且陽性的聯合機率，分母仍是全體。
      D: 10% 是不附陽性條件的有病邊際機率。
  - id: c2
    goal: g1
    type: choice
    prompt: 工廠抽取 1,000 件，20 件真瑕疵，其中 18 件警示；980 件正常品中有 49 件警示。工程師要算「已知真瑕疵時觸發警示」的機率，應如何計算？
    options:
      A: 18 除以 67
      B: 67 除以 1,000
      C: 18 除以 1,000
      D: 18 除以 20
    answer: D
    explain:
      A: 這是已知警示後為真瑕疵的機率，交換了條件。
      B: 這是所有產品的警示率，沒有給定真瑕疵。
      C: 這是同時真瑕疵且警示的比例，分母仍是全部產品。
      D: 條件限定真瑕疵的 20 件，其中警示 18 件，所以為 90%。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-2, guide-3:3-5, guide-3:3-6]
---

## 為什麼需要

分類、推薦與風險預測會先觀察輸入，再估計結果。例如已知檢驗結果後推估罹病風險，不能只用整體罹病比例回答。

條件機率把「已知什麼」寫進問題。條件改變，計算比例的母群也跟著改變。

## 直覺

已知某事件發生後，只在這個條件範圍內評估另一事件。

:::supplement[來源：Pishro-Nik《Introduction to Probability》1.4.0 Conditional Probability]
想像先從通訊錄篩出同一城市的朋友，再問其中有多少人會開車。分母已經變成該城市的朋友，不能繼續用整本通訊錄。

本組用教學合成的 1,000 人篩檢資料。令 $A$ 是「有病」、$B$ 是「陽性」；真值由教學資料給定，陽性只是檢驗判定。
:::

## 定義與公式

$A$、$B$ 是所關心的兩個事件。已知 $B$ 發生時，條件機率為：

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)}
$$

$A\cap B$ 表示兩事件同時發生；$P(B)$ 是條件事件的機率；$P(A\mid B)$ 是已知 $B$ 後，$A$ 發生的機率。

邊際機率只看單一事件，不附另一事件的條件；例如 $P(B)$ 不限定 $A$ 是否發生。

![先沿有病或無病分支看陽性率，再合併兩條陽性路徑計算反向條件。](figure:l23101-conditional-probability-tree)

:::supplement[來源：Pishro-Nik《Introduction to Probability》1.4.0 Conditional Probability]
這個比率要求 $P(B)>0$。資料中完全沒有陽性者時，不能用零分母算比例，也不能把結果填成 0。

聯合機率（Joint Probability）看兩事件同時發生；和條件機率相比，關鍵是分母是否已限縮到條件事件。
:::

:::tip[重點]
讀「已知 $B$，求 $A$」時，先圈出 $B$ 的範圍，再在其中找 $A$。不要看到同一對事件，就把條件順序交換。
:::

## 算一次（補充）

共用資料的列是真值，欄是判定；每人只進一格。

| 真值 | 陽性 | 陰性 | 合計 |
|---|---|---|---|
| 有病 | 90 | 10 | 100 |
| 無病 | 45 | 855 | 900 |
| 合計 | 135 | 865 | 1,000 |

依序算聯合、邊際、條件與反向條件：

$$
\begin{aligned}
P(A\cap B)&=90/1000=0.09\\
P(B)&=135/1000=0.135\\
P(A\mid B)&=0.09/0.135=2/3\\
P(B\mid A)&=90/100=0.9
\end{aligned}
$$

兩個條件機率分別約為 66.67% 與 90%。分子同樣數到 90 人，分母卻是 135 人與 100 人。

換成同組工廠資料，真瑕疵 20 件、警示 67 件，兩者交集 18 件。警示後是真瑕疵的機率約 26.87%，真瑕疵的警示率則為 90%。

### 用骰子確認方向（補充）

公平六面骰已知點數大於 4，條件範圍是 5、6，偶數只有 6，所以機率為 $1/2$。反過來，已知偶數時，範圍是 2、4、6，大於 4 的只有 6，所以機率為 $1/3$。

## 程式（補充）

把共用醫療資料合併為四格，最小程式直接帶入頻數。用布林條件挑出交集與分母，不能把四格摘要誤當成只有四人的資料。

```python
cells = [
    {"truth": 1, "decision": 1, "count": 90},
    {"truth": 1, "decision": 0, "count": 10},
    {"truth": 0, "decision": 1, "count": 45},
    {"truth": 0, "decision": 0, "count": 855},
]
def probability(a, b):
    numerator = sum(c["count"] for c in cells if a(c) and b(c))
    denominator = sum(c["count"] for c in cells if b(c))
    return None if denominator == 0 else numerator / denominator
disease = lambda c: c["truth"] == 1
positive = lambda c: c["decision"] == 1
print(f"有病｜陽性 = {probability(disease, positive):.6f}")
print(f"陽性｜有病 = {probability(positive, disease):.6f}")
print("空條件 =", probability(disease, lambda c: False))
```
```text
有病｜陽性 = 0.666667
陽性｜有病 = 0.900000
空條件 = None
```

:::tip[讀碼重點]
`a(c) and b(c)` 篩交集，只有 `b(c)` 篩條件母群。`count` 是頻數權重；零分母回傳 `None` 表示沒有定義。
:::

另用六個等可能點數逐一枚舉，核對骰子的兩個方向：

```python
faces = range(1, 7)
both = sum(x % 2 == 0 and x > 4 for x in faces)
print(f"偶數｜大於4 = {both / sum(x > 4 for x in faces):.6f}")
print(f"大於4｜偶數 = {both / sum(x % 2 == 0 for x in faces):.6f}")
```
```text
偶數｜大於4 = 0.500000
大於4｜偶數 = 0.333333
```

:::tip[讀碼重點]
`both` 都只數到點數 6，但兩個條件分別留下 2 面與 3 面，所以交換方向後的答案不同。
:::

## 怎麼用、怎麼判讀

學習指引用 $P(Y\mid X)$ 描述給定特徵後的標籤機率。這裡 $X$ 是觀察到的輸入，$Y$ 是要預測的結果；條件機率也能表達生成模型中變數之間的依存。

:::supplement[來源：OpenStax《Introductory Statistics 2e》3.3 Two Basic Rules of Probability]
若 $A$、$B$ 獨立且 $P(B)>0$，才有 $P(A\mid B)=P(A)$。本例整體有病率 10%，陽性者有病率約 66.67%，所以這兩事件不獨立。
:::

### 換個場景

指引列出分類、推薦、生醫與金融風控，以及變分自編碼器、隱馬可夫模型。共同條件是已有某些觀察，要推估另一事件。

| 場景 | 已知條件 | 判讀重點 |
|---|---|---|
| 生醫與金融風控 | 檢驗或行為模式 | 先寫清楚是風險還是檢出率 |
| 分類、推薦與生成模型 | 輸入特徵或其他變數 | 看條件指向哪個目標 |
| 製造檢驗（補充） | 產品已觸發警示 | 真瑕疵占警示品的比例 |
| 客服派單（補充） | 已知工單語言 | 該語言工單中各意圖的比例 |

## 常見誤解

- $P(A\mid B)$ 與 $P(B\mid A)$ 的條件不同，不能直接交換。
- 聯合機率以全體為分母；條件機率以條件事件為分母。（補充）
- 有條件不表示有因果；觀察到關聯還不能推出介入效果。（補充）

## 進階

### 頻率與模型機率（補充）

表格除法精確描述這 1,000 人的組成。把它當作新族群的機率，還需要樣本能代表目標族群；抽樣不確定性由統計推論與參數估計處理。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:3-2`、`guide-3:3-5`、`guide-3:3-6`：支持為什麼需要、條件及邊際機率定義與應用場景。
- [Pishro-Nik：1.4.0 Conditional Probability](https://www.probabilitycourse.com/chapter1/1_4_0_conditional_probability.php)：支持限縮母群的直覺、零分母條件與算例安排。
- [OpenStax：3.3 Two Basic Rules of Probability](https://openstax.org/books/introductory-statistics-2e/pages/3-3-two-basic-rules-of-probability)：支持乘法規則、獨立事件與條件方向的比較。

## 小結

- 先找條件事件，再決定比例的分母。
- 反向條件回答不同問題，不能直接交換。
- 交集為 90 人不代表條件機率就是 9%。（補充）
- 條件事件機率為零時，本頁比率公式不適用。（補充）
