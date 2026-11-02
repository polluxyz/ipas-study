---
id: equal-opportunity
title: 機會平等
kind: metric
codes:
  - L23402
aliases:
  - Equal Opportunity
requires:
  - conditional-probability
  - confusion-matrix
summary: 機會平等比較各群真實正例的獲選比例，不限制負例被誤選的比例
goals:
  - id: g1
    text: 以真實正例為分母比較各群獲得服務的機會
  - id: g2
    text: 用同一份四格計數區分機會平等與均衡機率
contrasts:
  - target: statistical-parity
    note: 機會平等比較各群真實正例內的獲選比例（TPR），統計均等比較各群全體的選取比例，兩者分母不同
    source:
      - guide-3:6-18
  - target: equalized-odds
    note: 機會平等只約束TPR，均衡機率另約束FPR
    source:
      - guide-3:6-18
formula_groups:
  - id: true-positive-parity
    source: https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23402-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: A 群真正需要支援 10 人、服務到 8 人；B 群真正需要 20 人、服務到 16 人。機會平等如何判讀？
    options:
      A: A 漏掉 2/10、B 漏掉 4/20，因此 A 的獲選機會較高
      B: A 服務 8/10、B 服務 16/20，因此 B 的獲選機會較高
      C: A 的分母為 10、B 為 20，樣本數不同使比例無法比較
      D: A 為 8/10、B 為 16/20，兩群獲選比例都為 80%
    answer: D
    explain:
      A: 漏掉人數必須除以真實需要人數才可比較。
      B: 人數多不代表條件比例較高。
      C: 兩群都有正例，可分別計算比例。
      D: 8 除以 10 與 16 除以 20 相同，樣本 TPR 皆為 80%。
  - id: c2
    goal: g2
    type: choice
    prompt: A/B 兩群 TP/FN 都是 8/2，但 FP/TN 分別是 2/8 與 6/4。哪個結論正確？
    options:
      A: TPR 同為 80%、FPR 為 20%/60%，只符合機會平等
      B: TPR 同為 80%、FPR 為 20%/60%，兩種公平條件都成立
      C: 選取率為 50%/70%、TPR 同為 80%，只有統計均等成立
      D: TPR 應把 FP 加進分母，兩群分別為 8/12 與 8/16
    answer: A
    explain:
      A: TPR 同為 80%，FPR 卻為 20% 與 60%。
      B: 均衡機率還要求 FPR 跨群一致，此例不符。
      C: 兩群全體選取率為 50% 與 70%，並不相同。
      D: TPR 的分母由 TP 與 FN 構成，不含 FP。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-3:6-18
---

## 為什麼需要

醫療與福利核准可能最擔心「需要服務的人被漏掉」。只比較全群通過率，無法得知各群真正需要者得到服務的比例。

## 直覺

機會平等（Equal Opportunity）先留下各群的真實正例，再比較其中有多少人獲得正向決策。它問的是「同樣具備資格，有沒有同樣機會被找出來」。

兩群各有 10 位符合資格者，若都選出 8 位，就有相同的獲選比例。這沒有說明不符合資格的人是否被誤選。

![兩群真實正例皆選出80%，比較TPR兩根柱的高度。](figure:l23402-equal-opportunity-rates)

## 定義與公式

指引把比較對象限定為「實際應被選擇者」。在本組案例，招聘真值為職務規準資格，信貸真值為教學還款能力規準；兩者都不同於過去是否獲准。

本指標未約束負例的錯誤比例，所以不能代表所有不公平情況都消失。

### 用 TPR 表達（補充）

$$
\mathrm{TPR}_g=P(\hat Y=1\mid Y=1,G=g)
=\frac{\mathrm{TP}_g}{\mathrm{TP}_g+\mathrm{FN}_g},\qquad
\mathrm{TPR}_A=\mathrm{TPR}_B
$$

$Y$ 是真值，$\hat Y$ 是決策，$G$ 是群體。TP 為符合資格且被選中，FN 為符合資格卻未被選中；TPR 是真正率（別稱真陽率），也就是召回率。

每群都必須有真實正例，分母才有定義。若某群沒有正例，不能把 TPR 填零，也不能據此宣稱已達成機會平等。

## 算一次（補充）

使用同一份 40 人招聘固定稽核集。四格計數如下，每列相加為 20；用相同規則換成信貸，數字完全一致。

| 群體 | TP／FN | FP／TN | 全群人數 |
|---|---|---|---|
| A | 8／2 | 2／8 | 20 |
| B | 8／2 | 6／4 | 20 |

$$
\mathrm{TPR}_A=8/(8+2)=0.8,\qquad
\mathrm{TPR}_B=8/(8+2)=0.8
$$

兩群 TPR 都是 80%，這批資料符合嚴格機會平等。注意兩群 FN 也是各 2 人，但在分母不同的其他資料裡，不能只比較 FN 人數。

再看負例：A 有 10 位不符合者，誤選 2 位，FPR 為 20%；B 同樣 10 位卻誤選 6 位，FPR 為 60%。因此均衡機率不成立。

## 程式（補充）

程式按固定規則重建 40 筆，再先篩群體、後篩真實正例。每群的負例不進入 TPR 分母。

```python
data = [(g, int(i < 10), int(i < 8 or 10 <= i < end))
        for g, end in [("A", 12), ("B", 16)] for i in range(20)]
def tpr(rows, group):
    positives = [p for g, y, p in rows if g == group and y == 1]
    return sum(positives) / len(positives) if positives else None
for g in "AB":
    print(g, f"TPR={tpr(data, g):.2f}")
print("無正例:", tpr([("C", 0, 1)], "C"))
```
```text
A TPR=0.80
B TPR=0.80
無正例: None
```

:::tip[讀碼重點]
篩選條件 y == 1 決定比較母群。不要改成 p == 1，那會改問獲選者有多少真的符合資格。
:::

## 怎麼用、怎麼判讀

指引的醫療診斷與社會福利核准，關注真正需要者不被漏掉。這個目標適合表達正例的獲得機會，但仍需另外檢查不必要服務與誤核准的風險。

### 換個場景

| 場景／資料條件 | 正例與判讀 |
|---|---|
| 醫療診斷、社會福利核准 | 真正有病或具資格者，是否同樣被找出 |
| 貸款應核准者 | 真正符合條件者的正確核准比例 |
| 職務培訓（補充） | 真正達申請門檻者是否同樣被入選 |
| 無障礙支援（補充） | 確有支援需求者是否同樣被接住 |

:::supplement[來源：Fairlearn，Common fairness metrics]
如果真實標籤本身沿用不公制度，TPR 一樣仍可能只表示同樣重現有偏規準。先審核標籤，再選擇公平目標，並保留各群正例樣本數。
:::

## 常見誤解

- 機會平等不要求每群的全體通過率相同。
- TPR 相同不約束 FPR，兩群誤選風險仍可能不同。
- 獲選者中的資格比例是精確率，分母與本頁不同。（補充）
- 若兩群都完全漏選，TPR 雖同為零，服務效能仍很差。（補充）

## 進階

### 指標成立與服務品質（補充）

機會平等是群體比較的條件，不是最低服務標準。實務可同時要求 TPR 的群差在容許範圍內，以及每群 TPR 至少達業務底線；兩者要分別報告。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:6-18`：支持比較對象、場景與限制。
- [Fairlearn：Common fairness metrics](https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html)：支持補充的條件機率式、算例判準及標籤限制。
- [Barocas 等：Fairness and Machine Learning，第 3 章](https://fairmlbook.org/classification.html)：支持用同一份資料切換比較母群的教學安排。
- [Hardt 等：Equality of Opportunity in Supervised Learning](https://arxiv.org/abs/1610.02413)：支持公平條件及觀察統計的限制。

## 小結

- 分母是各群真實正例，TPR 就是召回率。（補充）
- 相同 TPR 仍可能搭配不同 FPR。
- 真實正例為零時，不能宣稱通過比較。（補充）
