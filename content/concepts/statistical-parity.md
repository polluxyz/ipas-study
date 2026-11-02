---
id: statistical-parity
title: 統計均等
kind: metric
codes:
  - L21203
  - L23402
aliases:
  - Demographic Parity
  - Statistical Parity
  - 人口統計均等
  - Equality of Outcome
  - 結果均等
requires:
  - conditional-probability
summary: 統計均等要求不同群體得到有利決策的比例相同，不以真實標籤作分母
goals:
  - id: g1
    text: 區分選取率與準確率，對照統計均等及 Demographic Parity
  - id: g2
    text: 計算兩群選取率與差值，說明相同通過率不能保證錯誤率相同
contrasts:
  - target: equal-opportunity
    note: 全群選取比例與真實正例內獲選比例的分母不同
    source:
      - guide-3:6-18
formula_groups:
  - id: selection-and-difference
    source: https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23402-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: A/B 各 20 人，分別核准 10 與 14 人；正確預測分別為 16 與 12 人。要評估 Demographic Parity，應先比較什麼？
    options:
      A: 比較 16/20 與 12/20，以準確率判斷兩群的選取機會
      B: 比較 10/20 與 14/20，以全群核准比例判斷機會分配
      C: 比較 8/20 與 8/20，以正確核准比例代替全體核准比例
      D: 比較合計 28/40 與 70%，以相同總體效能判斷群體平等
    answer: B
    explain:
      A: 準確率用了真實標籤，和選取率不同。
      B: Demographic Parity 在本二元有利決策中比較全群核准比例。
      C: 人數沒有表明所比較的分母，也未含所有核准者。
      D: 總體平均無法比較兩群機會分配。
  - id: c2
    goal: g2
    type: choice
    prompt: 某模型兩群各 20 人、各錄取 10 人；A 的 TPR/FPR 為 80%/20%，B 為 60%/40%。哪個結論成立？
    options:
      A: 兩群都選 10/20，因此 TPR/FPR 也相同，均衡機率成立
      B: 兩群都選 10/20，因此真正有資格者的獲選機會相同
      C: 兩群都選 10/20，統計均等成立，但錯誤率仍不同
      D: 兩群都選 10/20，因此正確預測比例必相同，無須查真值
    answer: C
    explain:
      A: TPR 與 FPR 都不同，無法成立。
      B: 真正例中獲選比例不同，無法成立。
      C: 全群選取率都是 50%，但真實條件內的比例不同。
      D: 同通過率不限制預測正確數。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-3:6-17
  - guide-3:6-18
---

## 為什麼需要

招募系統對兩群人各發出 10 份面試邀請，看起來同樣多；但若一群有 20 人、另一群有 100 人，得到機會的比例就不同。

統計均等（Statistical Parity）用每群自己的總人數作分母，比較獲得有利結果的比例。它關心機會分配，不先問這些人是否真的符合資格。

## 直覺

先把每個群體都當成 100%，再看其中有多少比例被選上。這個比例稱選取率，在本組的面試及授信例子也稱通過率。

![同為每群20人的資料，A通過50%、B通過70%，應比較比例而非只有通過人數。](figure:l23402-statistical-parity-selection)

## 定義與公式

科目 3 指引稱 Demographic Parity 為群體平等率；本頁使用索引主詞「統計均等」。在二元決策中，這兩個英文名稱都指向不同群體選取率相同的要求。

指引也用結果均等（Equality of Outcome）說明它重視結果的比例分配。本頁限指群體選取率，不能把比例相同擴張為每個人的待遇都公平。

先定有利結果：招聘中是進入面試，信貸中是核准。若原模型的正類代表「高違約風險」，不能直接把預測正類比例當成核准比例。

### 選取率與有向差（補充）

$$
s_g=P(\hat Y=1\mid G=g)=\frac{n_{g,+}}{n_g},\qquad
\Delta_{A-B}=s_A-s_B
$$

$G$ 是群體，$g$ 是其中一群；$\hat Y=1$ 表示有利決策。$n_g$ 為該群人數，$n_{g,+}$ 為該群獲選人數，$s_g$ 為選取率。

兩群嚴格統計均等要求 $s_A=s_B$。本頁有向差用 A 減 B，零代表相同；負值表示 A 較低。兩個群體都要非空，空群不能填成零選取率。

## 算一次（補充）

讀取共用招聘固定稽核集的 40 人：每群各 20 人。A 的 8 位符合資格者與 2 位不符合者被選中，B 則為 8 位與 6 位。

| 群體 | 選中／全群 | 選取率 | 正確／全群 |
|---|---|---|---|
| A | 10／20 | 50% | 16／20＝80% |
| B | 14／20 | 70% | 12／20＝60% |

$$
\Delta_{A-B}=10/20-14/20=-0.20
$$

差值為負 20 個百分點，所以這批資料不符合嚴格統計均等。選取率只看誰被選中；準確率則同時計算選對與拒對，兩者不可混用。

### 相同比例仍有不同錯誤（補充）

共用檔 parity_only_pred 是另一組假想決策，沒有更換人或資格。兩群都選 10 人，卻可能有以下錯誤差距。

| 群體 | TP／FN | FP／TN | 選取率 |
|---|---|---|---|
| A | 8／2 | 2／8 | 50% |
| B | 6／4 | 4／6 | 50% |

A 的 TPR 為 80%、FPR 為 20%，B 則為 60%、40%。統計均等成立，但機會平等與均衡機率都不成立，因為本指標不以真實標籤分組。

## 程式（補充）

按共用 JSON 的固定規則逐筆重建真值與決策，不手填選取率。空群回傳 None，表示無法計算。

```python
data = [(g, int(i < 10), int(i < 8 or 10 <= i < end))
        for g, end in [("A", 12), ("B", 16)] for i in range(20)]
def selection(rows, group):
    subset = [p for g, y, p in rows if g == group]
    return sum(subset) / len(subset) if subset else None
a, b = [selection(data, g) for g in "AB"]
print(f"A={a:.2f} B={b:.2f} 差={a-b:.2f}")
print("空群:", selection(data, "C"))
```
```text
A=0.50 B=0.70 差=-0.20
空群: None
```

:::tip[讀碼重點]
selection 沒有使用真值 y；這正是本指標的特性，也是不能用它推論錯誤率的原因。
:::

## 怎麼用、怎麼判讀

指引用招聘與入學說明結果分配的公平需求。比較時不看實際資格，因此可能與個案準確性產生取捨，不能把它當成唯一目標。

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 招聘與入學，重視結果機會分配 | 比較各群全體的錄取或入選比例 |
| 信貸核准 | 先把有利結果定義成核准 |
| 培訓名額（補充） | 看各群獲得進修資源的比例 |
| 公共住宅初選（補充） | 機會分配之外仍需查資格與錯拒 |

:::supplement[來源：Fairlearn，Common fairness metrics]
樣本差距不等於母體差距已被精確估計。保留各群樣本數，必要時做不確定性評估；容許差距須依用途事前訂定，不能看完結果再挑門檻。
:::

## 常見誤解

- 同樣選 10 人，若總人數不同，選取率仍不同。
- 通過率不是準確率；本指標不檢查選錯與拒錯。
- 通過率相同，仍可能對某群漏掉更多有資格者。（補充）
- 本頁有向差可為負；工具的最大群差通常報非負值，須先查定義。（補充）

## 進階

### 差與比回答不同問題（補充）

本例 A 比 B 低 20 個百分點。若改用不利影響比，必須先指定參照群，得到的是相對比值，不是再減一次。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:6-17`～`guide-3:6-18`：支持比較對象、場景與限制。
- [Fairlearn：Common fairness metrics](https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html)：支持補充的條件機率式、算例判準及標籤限制。
- [Barocas 等：Fairness and Machine Learning，第 3 章](https://fairmlbook.org/classification.html)：支持用同一份資料切換比較母群的教學安排。

## 小結

- 先定有利結果，再以全群人數算選取率。
- 統計均等與 Demographic Parity 在此指相同要求。
- 差值方向、百分點與比例要分清。（補充）
- 結果比例相同仍不保證錯誤率相同。
