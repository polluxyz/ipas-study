---
id: fairness-constrained-training
title: 公平性約束與損失
kind: technique
codes: [L23402]
aliases: [Fairness Constraints, Fairness Regularization, In-processing, 公平性正規化]
requires: [debiasing-strategies, equalized-odds, regularization]
is_a: [debiasing-strategies]
summary: 訓練時把公平差距放入約束或懲罰，與預測效能一起選模型
goals:
  - id: g1
    text: 依任務選公平指標與容許差距，辨認效能取捨及不可行情況
  - id: g2
    text: 建立任務損失加公平懲罰的目標，區分公平與容量正則化
  - id: g3
    text: 用同一候選表比較硬約束與軟性懲罰的選用結果
formula_groups:
  - id: constrained-and-penalized-objectives
    source: 'https://fairlearn.org/main/api_reference/generated/fairlearn.metrics.equalized_odds_difference.html; https://proceedings.mlr.press/v80/agarwal18a/agarwal18a.pdf#page=4'
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23402-B
mitigates:
  - target: algorithmic-bias
    note: 針對選定的群體差距調整學習，並非所有公平目標都會同時滿足
    source: [guide-3:6-21, guide-3:6-22]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 候選模型的「準確率／公平差距」為甲70%/0.4、乙65%/0.1、丙60%/0。若要求準確率至少65%、差距至多0.05，該怎麼辦？
    options:
      A: 選甲，因準確率最高，可以將差距0.4視為可接受的小誤差
      B: 選乙，因準確率剛好達標，公平差距0.1也應視為符合要求
      C: 目前無可行候選，應回報限制並改善資料或模型再評估
      D: 選丙，因公平差距為零，可以不經討論取消最低準確率要求
    answer: C
    explain:
      A: 甲的公平差距超過既定上限，最高準確率不能取代約束。
      B: 乙的公平差距仍大於0.05，不是合格候選。
      C: 三個候選沒有同時滿足兩條件，需回報並重新尋找可行方案。
      D: 丙未達最低準確率，不能自行取消已定條件。
  - id: c2
    goal: g2
    type: choice
    prompt: 任務損失L分別為0.30、0.35，公平差距D為0.40、0.10；用J=L+λD且λ=1比較兩個模型。哪項正確？
    options:
      A: J為0.70與0.45，選第二個；公平懲罰針對群體差距
      B: J為0.30與0.35，選第一個；公平差距只應用於報表
      C: J為0.70與0.45，選第二個；等同只限制模型權重大小
      D: J為0.40與0.10，選第二個；加入公平項後可省略任務損失
    answer: A
    explain:
      A: 任務與公平項相加後第二個較小，懲罰的對象是所選群體差距。
      B: 計算漏掉公平項，不是題目指定的目標。
      C: 一般容量正則化限制權重或複雜度，不等於直接量群體差距。
      D: 公平損失是額外項，不會取消原本的預測目標。
  - id: c3
    goal: g3
    type: choice
    prompt: baseline/middle/strict的L為0.30/0.35/0.40、D為0.40/0.10/0。硬約束D≤0.10與軟目標L+0.1D各選誰？
    options:
      A: 硬約束選baseline，軟目標選middle，因任務損失都較小
      B: 硬約束選strict，軟目標選middle，因兩者公平差距較小
      C: 硬約束選middle，軟目標選strict，因懲罰會保證零差距
      D: 硬約束選middle，軟目標選baseline，兩者選取規則不同
    answer: D
    explain:
      A: baseline違反硬上限，而軟目標的最小值是0.34。
      B: 硬約束允許差距0.10，會在可行者中選任務損失較小的middle。
      C: 小權重的軟懲罰不保證零差距，strict的目標值反而較大。
      D: 硬約束先篩可行者；軟目標三值為0.34、0.36、0.40。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:6-21, guide-3:6-22]
---

## 為什麼需要

只讓整體錯誤最少，模型可能犧牲人數較少的群體。公平性約束與損失在訓練時加入群體要求，讓模型的學習目標反映這項需求。

指引舉貸款核准率相近、信用評分錯誤率接近為例。兩者的比較對象不同，必須先選公平指標，不能只寫「模型要公平」。

## 直覺

訓練時把公平當成目標的一部分，模型就不只追求整體預測正確，也要考慮指定的群體要求。

:::supplement[來源：Fairlearn，Reductions]
硬約束像資格線：先過線，才能比誰預測較好。軟性懲罰像扣分：預測錯誤與群體差距都計入總分，再比較總分。
:::

## 定義與公式

### 先寫出公平目標

| 要先決定的條件 | 本組示例 |
|---|---|
| 預測任務與正類 | 招聘資格、信貸還款資格 |
| 群體與比較指標 | A/B兩群的TPR與FPR |
| 可接受差距 | 兩種率的最大群差不超過0.10 |
| 效能與檢查資料 | 在固定資料檢查錯誤比例及群體差距 |

統計均等限制選取率；機會平等限制TPR。公平性懲罰也可針對所選差距，與原本的任務損失一起考慮。

### 硬約束與軟性懲罰（補充）

為了同時檢查TPR與FPR，本頁改用均衡機率差距作公平量：

$$
D(\theta)=\max\left\{
|\mathrm{TPR}_A-\mathrm{TPR}_B|,
|\mathrm{FPR}_A-\mathrm{FPR}_B|
\right\}.
$$

$\theta$ 是模型參數；$D$ 是兩種群體差距的較大者。TPR在真實正例內計算，FPR在真實負例內計算，各群都須有相應樣本。

$$
\begin{aligned}
\text{硬約束：}&\quad\min_\theta L_{\mathrm{task}}(\theta)
&&\text{使 }D(\theta)\leq\varepsilon,\\
\text{軟性懲罰：}&\quad\min_\theta J(\theta)
&&J(\theta)=L_{\mathrm{task}}(\theta)+\lambda D(\theta).
\end{aligned}
$$

$L_{\mathrm{task}}$ 是任務損失，$\varepsilon$ 是容許差距，$\lambda\geq0$ 是懲罰權重。有限的$\lambda$通常不保證硬上限成立。

這裡的$D$對應Fairlearn的兩群最大TPR／FPR差；不是Reductions預設的群體相對整體平均差。

硬約束與加權目標借用Agarwal等人的拉格朗日形式，再特化成單一約束$D\leq\varepsilon$：

$$
L_{\mathrm{task}}+\lambda(D-\varepsilon)=J-\lambda\varepsilon.
$$

固定$\lambda$與$\varepsilon$時，右側的$-\lambda\varepsilon$是常數，省略後不改變候選排序。

固定權重的候選比較不等於原論文同時求解模型與乘數的演算法，也不保留其完整保證。

本頁用錯誤比例作可核算目標；真正訓練常用可優化的替代損失或reduction方法。不能直接把不連續的計數差距當成一般可微損失。

### 與容量正則化分開（補充）

公平性損失針對群體表現，容量正則化針對模型複雜度。限制權重大小可能影響效能，卻沒有直接保證指定的公平差距。

## 算一次

:::supplement[來源：Fairlearn，equalized_odds_difference；Agarwal等，第3.2節；本組教學合成資料]
以下是同一批40人的三組**假想候選輸出**，未宣稱由某個優化器訓練產生。候選集合限於這三個。

後處理頁另用細分分數，得到錯誤比例0.20、差距0的方案：錯誤更少，差距不高於這三個候選。這來自合成資料把4筆負例設為0.6分，不表示後處理普遍更好或沒有代價。

這裡只示範選擇規則。真實專案須把這類比較放在開發集，不能拿固定稽核集挑上線模型，再將同一成績當成獨立測試。

| 候選 | 任務損失L | 公平差距D | 依據 |
|---|---|---|---|
| baseline | 12/40＝0.30 | 0.40 | TPR差0、FPR差0.4 |
| middle | 14/40＝0.35 | 0.10 | TPR差0.1、FPR差0.1 |
| strict | 16/40＝0.40 | 0 | TPR與FPR群差均為0 |

硬上限$\varepsilon=0.10$時，baseline被排除。其餘兩個之中，middle的任務損失較小，因此選middle。

| 懲罰權重 | baseline的J | middle的J | strict的J |
|---|---|---|---|
| λ＝0.1 | 0.30＋0.1×0.40＝0.34 | 0.35＋0.1×0.10＝0.36 | 0.40 |
| λ＝1 | 0.30＋1×0.40＝0.70 | 0.35＋1×0.10＝0.45 | 0.40 |

權重0.1選baseline，權重1選strict。這個表展示可能的取捨，不表示公平改善必定降低準確率。

若另要求準確率至少65%、差距最多0.05，三個候選都不合格。應回報不可行、改善資料或模型；不能事後偷偷放寬條件。
:::

## 程式（補充）

用精確分數比較候選，避免0.1的浮點尾差影響硬上限。程式是在選候選，沒有執行公平約束訓練。

```python
from fractions import Fraction as F
candidates = {"baseline": (F(12, 40), F(4, 10)),
              "middle": (F(14, 40), F(1, 10)),
              "strict": (F(16, 40), F(0))}
for weight in [F(1, 10), F(1)]:
    objective = {k: loss + weight * gap
                 for k, (loss, gap) in candidates.items()}
    print(f"lambda={float(weight):.1f}", min(objective, key=objective.get))
feasible = [k for k, (loss, gap) in candidates.items() if gap <= F(1, 10)]
print("硬約束:", min(feasible, key=lambda k: candidates[k][0]))
```
```text
lambda=0.1 baseline
lambda=1.0 strict
硬約束: middle
```

## 怎麼用、怎麼判讀

比較權重時，同時列任務效能與公平差距。權重較大代表更重視懲罰，但演算法是否收斂、資料是否充足，仍影響實際結果。

:::supplement[來源：Fairlearn，Reductions；Google Machine Learning Crash Course，Mitigating bias]
在開發資料選公平指標、容許差距與權重，再用未參與選擇的測試資料確認結果。訓練中達標不代表新資料必定達標。
:::

### 換個場景

| 場景／資料條件 | 判讀重點 |
|---|---|
| 貸款核准率相近的要求 | 選取率約束是否符合決策目的 |
| 信用評分各群錯誤率接近 | 分清TPR、FPR與整體錯誤比例 |
| 醫療篩檢（補充） | 漏檢與誤檢的群體差距要分開 |
| 語音客服（補充） | 在方言群體間選定明確的品質限制 |

## 常見誤解

- 公平性正則化與限制模型容量的正則化，懲罰對象不同。
- 公平指標不同，達標的意義也不同。
- 加大懲罰權重不等於已保證硬上限。（補充）
- 沒有可行候選是需要回報的結果，不能硬選一個算通過。（補充）

## 進階

### 不必把所有公平目標同時設成零（補充）

群體基準率不同時，校準與錯誤率要求可能衝突。先確認要避免的傷害，再選可解釋、可量測的目標；不能只靠超參數替代政策決定。

### 參考來源

- 科目3學習指引 `guide-3:6-21`～`guide-3:6-22`：支持公平約束、公平性損失、效能取捨及金融場景。
- [Fairlearn：Reductions](https://fairlearn.org/main/user_guide/mitigation/reductions.html)：支持形式化約束、候選選擇及替代學習的補充。
- [Fairlearn：equalized_odds_difference](https://fairlearn.org/main/api_reference/generated/fairlearn.metrics.equalized_odds_difference.html)：支持定義與公式中的最大TPR／FPR群差。
- [Agarwal等：Fair Classification，第3.2節](https://proceedings.mlr.press/v80/agarwal18a/agarwal18a.pdf#page=4)：支持約束與拉格朗日形式；單一差距、固定權重及省略常數為本頁特化。
- [Google機器學習課程：Mitigating bias](https://developers.google.com/machine-learning/crash-course/fairness/mitigating-bias)：支持損失調整的直覺與教學安排。
- [Fairness and Machine Learning：Classification](https://fairmlbook.org/classification.html)：支持不同公平要求的比較及限制。

## 小結

- 任務、群體、指標、容許差距要先寫清楚。
- 公平懲罰直接處理群體差距，不等於容量限制。
- 硬約束先篩可行者，軟目標比較加權總損失。（補充）
- 權重與不可行情況都要留下紀錄。（補充）
