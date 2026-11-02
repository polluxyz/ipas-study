---
id: equalized-odds
title: 均衡機率
kind: metric
codes:
  - L23402
aliases:
  - Equalized Odds
requires:
  - equal-opportunity
summary: 均衡機率要求各群真正率與假正率都相同，需分別比較正例和負例
goals:
  - id: g1
    text: 同時比較各群 TPR 與 FPR，判定均衡機率並辨認效能取捨
  - id: g2
    text: 用同一組混淆矩陣指出只符合機會平等的反例
formula_groups:
  - id: two-conditional-rates
    source: https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23402-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 模型甲的兩群 TPR 為 80%/80%、FPR 為 20%/60%；模型乙為 70%/70%、20%/20%。就這批樣本的嚴格均衡機率而言，應選哪個敘述？
    options:
      A: 甲兩群 TPR 都是 80%，即使 FPR 為 20%/60% 也成立
      B: 乙兩群 TPR/FPR 各自相等，但須評估 TPR 下降的取捨
      C: 乙的 TPR 70% 不等於 FPR 20%，因此兩個模型都不成立
      D: 乙兩群 TPR/FPR 各自相等，因此所有個案服務品質都改善
    answer: B
    explain:
      A: 甲的 FPR 不同，因此條件不成立。
      B: 乙的兩種比例各自跨群一致，但 TPR 比甲低。
      C: 條件要求跨群一致，不要求同群 TPR 等於 FPR。
      D: 相等不保證絕對效能較佳，乙 TPR 已下降。
  - id: c2
    goal: g2
    type: choice
    prompt: A/B 各 20 人，四格為 TP8/FN2/FP2/TN8 與 TP8/FN2/FP6/TN4。哪一項造成均衡機率失敗？
    options:
      A: 兩群 TPR 為 80% 與 40%，正例獲選比例不同造成失敗
      B: A 正例只有 10/20，不符合每群正例必須占全部人的條件
      C: 兩群 FPR 為 20% 與 60%，負例各 10 人但誤選比例不同
      D: 兩群 TP 都為 8/20，正確選中人數相同造成公平條件失敗
    answer: C
    explain:
      A: TPR 均為 8 除以 10，差距為零。
      B: 只需正例分母大於零，無須全群都是正例。
      C: 負例各 10 人，誤選比例不同，造成條件失敗。
      D: TP 相同不會自行造成失敗，應比較條件比例。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-3:6-18
  - guide-3:6-19
---

## 為什麼需要

在信用評估中，漏掉真正符合資格者會失去服務機會；錯誤核准不具條件者也可能帶來損失。只顧正例的獲選機會，會漏看另一種風險。

## 直覺

均衡機率（Equalized Odds）把人分成真實正例與真實負例，再各做一次跨群體比較。兩條比較都相同，這個條件才成立。

![TPR兩根柱同為80%，FPR卻為20%與60%，所以只符合機會平等。](figure:l23402-equalized-odds-rates)

## 定義與公式

指引要求不同群體的正確核准比例與錯誤核准比例一致。這裡的「一致」是同一種比例跨群比較，不是要求單一群體的正確率等於錯誤率。

| 比較條件 | 留下誰作分母 | 比較的決策 |
|---|---|---|
| TPR：真正率／召回率 | 各群真實正例 | 符合資格者被選中 |
| FPR：假正率 | 各群真實負例 | 不符合資格者被誤選 |

真正率又稱真陽率，假正率又稱假陽率。本頁沿用網站主詞；真正率的計算也可回看召回率。

### 兩項條件都要成立（補充）

$$
\begin{aligned}
\mathrm{TPR}_g&=\frac{\mathrm{TP}_g}{\mathrm{TP}_g+\mathrm{FN}_g}\\
\mathrm{FPR}_g&=\frac{\mathrm{FP}_g}{\mathrm{FP}_g+\mathrm{TN}_g}\\
\mathrm{TPR}_A&=\mathrm{TPR}_B,\quad
\mathrm{FPR}_A=\mathrm{FPR}_B
\end{aligned}
$$

下標 $g$ 代表群體；TP/FN 是符合資格者的選中／漏選數，FP/TN 是不符合資格者的誤選／拒絕數。每群需同時有正例及負例。

任一群正例或負例為零，對應比例沒有定義，不能填零後宣稱公平。資料缺乏條件母群時，應標示無法評估。

## 算一次（補充）

沿用同一批 40 人，不更換標籤、索引或閾值。以下各格都可由共用 JSON 的逐筆真值與決策重算。

| 群體 | TP／FN | FP／TN | 人數 |
|---|---|---|---|
| A | 8／2 | 2／8 | 20 |
| B | 8／2 | 6／4 | 20 |

$$
\begin{aligned}
\mathrm{TPR}_A&=8/10=0.8,&\mathrm{TPR}_B&=8/10=0.8\\
\mathrm{FPR}_A&=2/10=0.2,&\mathrm{FPR}_B&=6/10=0.6
\end{aligned}
$$

TPR 相同，所以機會平等成立；FPR 相差 40 個百分點，所以均衡機率不成立。不能因為兩群都抓到 8 個正例，就跳過負例檢查。

## 程式（補充）

重建共用資料後，依真值分別篩選比較母群。函式直接計算該條件內預測為 1 的比例。

```python
data = [(g, int(i < 10), int(i < 8 or 10 <= i < end))
        for g, end in [("A", 12), ("B", 16)] for i in range(20)]
def rate(rows, group, truth):
    subset = [p for g, y, p in rows if g == group and y == truth]
    return sum(subset) / len(subset) if subset else None
for g in "AB":
    print(g, f"TPR={rate(data,g,1):.2f} FPR={rate(data,g,0):.2f}")
print("無負例:", rate([("C", 1, 1)], "C", 0))
```
```text
A TPR=0.80 FPR=0.20
B TPR=0.80 FPR=0.60
無負例: None
```

:::tip[讀碼重點]
truth=1 計 TPR，truth=0 計 FPR。兩者都在條件母群中數 p=1，但後者代表誤選。
:::

## 怎麼用、怎麼判讀

指引以司法與信用評估說明同時考量兩種錯誤的需求。實務上難以完全達成均衡機率，實現方式也較複雜，可能需要犧牲部分整體效能；應按風險與治理目標選擇。

### 換個場景

| 指引場景／條件 | 判讀重點 |
|---|---|
| 信用評估 | 合資格核准與不合資格誤核准分開比 |
| 司法判決相關風險評估 | 先寫正類含義，分清誤判對誰有害 |
| 醫療分流（補充） | 真正需要與不需要者的轉介比例分開比 |
| 招聘面試（補充） | 同時關注漏掉人才與誤選的群體分布 |

:::supplement[來源：Fairlearn，Common fairness metrics]
若司法正類代表高風險，預測為 1 並非有利決策，FPR 可能使無相應風險者受不利處置。不能把信貸「核准」的解釋原封不動搬過去。

真實標籤若含歷史或測量偏見，錯誤率一致仍不代表制度已公正。觀察比例也須附樣本數，不能把小樣本的相等當作母體保證。
:::

### 效能取捨怎麼查（補充）

若改閾值讓 B 的 FPR 下降，同群 TPR 也可能下降。應在驗證資料比較候選設定，再用固定稽核集報各群 TPR/FPR 與整體效能，不能只展示改善的一項。

## 常見誤解

- 均衡機率要求跨群 TPR 相同、跨群 FPR 相同，不要求 TPR 等於 FPR。
- 機會平等成立，不足以推出均衡機率成立。
- 均衡機率不等於全群通過率相同；各群正例占比不同時，通過率可能不同。（補充）
- 指標的名稱包含公平條件，仍不等於所有社會公平問題都已解決。（補充）

## 進階

### 指標之間的邊界（補充）

在每群正負例都存在時，均衡機率包含機會平等的 TPR 要求。它與統計均等則使用不同條件，不應當作彼此強弱的單一直線排序。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:6-18`、`guide-3:6-19`：支持比較對象、場景與限制。
- [Fairlearn：Common fairness metrics](https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html)：支持補充的條件機率式、算例判準及標籤限制。
- [Barocas 等：Fairness and Machine Learning，第 3 章](https://fairmlbook.org/classification.html)：支持用同一份資料切換比較母群的教學安排。
- [Hardt 等：Equality of Opportunity in Supervised Learning](https://arxiv.org/abs/1610.02413)：支持同時約束兩種條件比例的形式化定義。

## 小結

- 分別比較真實正例及負例，兩關都要過。
- TPR 相同、FPR 不同，是只符合機會平等的反例。（補充）
- 先查標籤與正類含義，再看效能取捨。
