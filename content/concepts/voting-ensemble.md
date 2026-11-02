---
id: voting-ensemble
title: 投票與機率整合
kind: technique
codes:
  - L23202
aliases:
  - Hard Voting
  - Soft Voting
  - 加權投票
requires:
  - ensemble-models
summary: 先分清類別票與機率，再用等權或加權規則整合預測
goals:
  - id: g1
    text: 計算硬投票、加權硬投票及機率平均，檢查可比較與校準條件
guide_refs:
  - guide-3:4-36
  - guide-3:4-37
textbook: v2
author: codex
status: draft
formula_groups:
  - id: voting-rules
    source: https://scikit-learn.org/stable/modules/ensemble.html#voting-classifier
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 甲乙丙對三類的機率為(0.45,0.40,0.15)、(0.45,0.40,0.15)、(0.01,0.98,0.01)。硬投票與等權軟投票的結果為何？
    options:
      A: 硬選類0；軟選類0
      B: 硬選類0；軟選類1
      C: 硬選類1；軟選類0
      D: 硬選類1；軟選類1
    answer: B
    explain:
      A: 軟投票的類1平均機率0.5933較高。
      B: 類別票為0、0、1；平均機率則類1最高。
      C: 硬投票中類0有兩票，軟投票則類1最高。
      D: 硬投票不會使用丙的0.98強度。
  - id: c2
    goal: g1
    type: choice
    prompt: 甲乙丙預測類別是0、0、1，固定權重為1、1、3。加權硬投票應如何決策？
    options:
      A: 選類0，累積權重為2比3高
      B: 選類0，只按原始兩票對一票
      C: 選類1，累積權重為3比2高
      D: 選類1，直接把類別編碼平均
    answer: C
    explain:
      A: 2小於3。
      B: 這是未加權的硬投票。
      C: 同類票先累積模型權重，再比大小。
      D: 類別編碼沒有可直接平均的距離意義。
  - id: c3
    goal: g1
    type: choice
    prompt: 兩個模型均輸出三欄機率；第一個欄序為帳務、技術、物流，第二個為物流、技術、帳務。做軟投票前應如何處理？
    options:
      A: 按同一類別對齊欄位，並用保留資料檢查校準
      B: 按原欄位直接平均，因每一列機率總和都是1
      C: 將最大機率改成1再平均，仍稱作原機率平均
      D: 用最終測試集反覆挑權重，直到整合錯誤最少
    answer: A
    explain:
      A: 欄序與機率品質都會影響平均的意義。
      B: 總和為1不代表同欄代表同一類。
      C: 這會丟掉機率強度，變成票數比例。
      D: 反覆用測試資料挑權重會污染評估。
---

## 為什麼需要

三個模型給出不同類別時，需要事先訂好合併規則。硬投票（Hard Voting）只讀類別；軟投票（Soft Voting）保留各類機率的強弱，因此可能選出不同結果。

## 直覺

兩個模型各以微小差距選類0，另一個模型非常確定類1。看票數時類0贏；看平均機率時類1可能贏。兩者回答的是不同的整合問題。

![硬投票先取各模型的類別，軟投票則先按類別平均機率](figure:l23202-voting-ensemble-combine)

## 定義與公式

指引介紹多數票、加權票與機率輸出；以下展開為可核算的整合規則。

### 票與機率分開算（補充）

$$
\begin{aligned}
v_k&=\sum_{m=1}^{M}w_m\mathbf1(\hat y_m=k),\\
\bar p_k&=\frac{\sum_{m=1}^{M}w_m p_{mk}}{\sum_{m=1}^{M}w_m}
\end{aligned}
$$

$M$是模型數，$k$是候選類別，$\hat y_m$是第$m$個模型選出的類別，$p_{mk}$是它對類$k$的機率。$w_m$為非負權重且總和大於零，指示函數成立為1，否則為0。

硬投票選$v_k$最大者，等權時每個權重為1；加權硬投票改用指定權重。軟投票選$\bar p_k$最大者；本頁也示範等權平均，權重不必跟硬投票相同。

平手規則要事先固定。本組以類別編碼較小者勝出，這只是重現用約定，不表示該類有較高業務優先序。

## 算一次

### 六筆中的第一筆（補充）

沿用文字任務保留索引6–11的六筆三類人工機率。郵件0／1／2為促銷／工作／私人，客服為帳務／技術／物流。切分同前頁，以下看索引6。

| 模型 | 類0機率 | 類1機率 | 類2機率 |
|---|---|---|---|
| 甲 | 0.45 | 0.40 | 0.15 |
| 乙 | 0.45 | 0.40 | 0.15 |
| 丙 | 0.01 | 0.98 | 0.01 |

1. 硬投票：甲乙選0，丙選1；類0得2票，類1得1票，選0。
2. 加權硬投票：事先給甲乙丙權重1／1／3；類0得2，類1得3，選1。
3. 等權軟投票：三類平均為0.3033／0.5933／0.1033，選1。

這筆人工標籤是0，因此這次硬投票答對，另外兩種沒有答對。一次算例不能證明哪種規則普遍較好；完整六筆結果會在下列程式逐筆列出。

## 程式（補充）

先讀同樣的六筆分數，固定欄序。數字是教學指定的機率，沒有擬合或隨機抽樣。

```python
import numpy as np
p = np.array([
 [[.45,.4,.15],[.45,.4,.15],[.01,.98,.01]],
 [[.1,.8,.1],[.2,.7,.1],[.1,.3,.6]],
 [[.1,.2,.7],[.15,.25,.6],[.2,.1,.7]],
 [[.6,.3,.1],[.4,.5,.1],[.35,.6,.05]],
 [[.6,.3,.1],[.7,.2,.1],[.5,.3,.2]],
 [[.2,.2,.6],[.2,.5,.3],[.1,.3,.6]]])
labels = p.argmax(axis=2)
print("首筆類別票", labels[0].tolist())
```
```text
首筆類別票 [0, 0, 1]
```

```python
hard = [np.bincount(row, minlength=3).argmax() for row in labels]
weighted = [np.bincount(row, weights=[1,1,3], minlength=3).argmax() for row in labels]
soft = p.mean(axis=1).argmax(axis=1)
print("硬投票", [int(x) for x in hard])
print("加權票", [int(x) for x in weighted])
print("軟投票", soft.tolist())
print("首筆平均", p[0].mean(axis=0).round(4).tolist())
```
```text
硬投票 [0, 1, 2, 1, 0, 2]
加權票 [1, 2, 2, 1, 0, 2]
軟投票 [1, 1, 2, 1, 0, 2]
首筆平均 [0.3033, 0.5933, 0.1033]
```

:::tip[讀碼重點]
`argmax(axis=2)`先把每模型的機率轉成一票；`mean(axis=1)`則先平均模型機率。交換這兩個步驟會改變規則。
:::

## 怎麼用、怎麼判讀

只取得類別標籤時，可用硬投票。模型能提供各類機率時，可考慮機率平均；指引所列的分類集成便會遇到這個選擇。

:::supplement[來源：scikit-learn Voting Classifier；scikit-learn Probability calibration]
軟投票前先對齊類名、樣本索引及欄序。還要用保留資料檢查機率校準：一個習慣報0.99卻常錯的模型，可能壓過較可靠但保守的模型。

校準應使用訓練外預測或獨立開發資料。權重也要由開發資料選，最終測試集只用於評估選好的方案。
:::

### 換個場景

| 場景 | 整合輸入 | 判讀重點 |
|---|---|---|
| 集成式分類 | 各基模型類別或機率 | 先確認合併規則 |
| 郵件分流（補充） | 促銷／工作／私人機率 | 各模型欄序相同 |
| 客服分流（補充） | 帳務／技術／物流機率 | 校準與錯分成本 |

## 常見誤解

- 加權票不等於每個模型都一票；比較的是各類別累積到的權重。
- 機率平均不是直接平均0／1／2的類別代碼。（補充）
- 高機率不代表高可信度，需查驗校準。（補充）

## 進階

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-36`～`guide-3:4-37`：支持多數票、加權投票與機率整合的定位。
- [scikit-learn Voting Classifier](https://scikit-learn.org/stable/modules/ensemble.html#voting-classifier)：支持公式、權重與適用條件。
- [mlxtend投票教學](https://rasbt.github.io/mlxtend/user_guide/classifier/EnsembleVoteClassifier/)：參考先列機率、再比較合併結果的教學方式。
- [scikit-learn Probability calibration](https://scikit-learn.org/stable/modules/calibration.html)：支持校準與訓練外資料的條件。

## 小結

- 硬投票先取類別，軟投票先平均機率。
- 加權票要累積同類的權重，而非只數模型。
- 對齊欄位並檢查校準，整合結果再用保留資料驗證。（補充）
