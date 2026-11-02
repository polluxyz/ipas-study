---
id: multiclass-strategies
title: 多類別分解策略
kind: technique
codes:
  - L23202
aliases:
  - One-vs-One
  - One-vs-Rest
  - OvO
  - OvR
requires:
  - logistic-regression
summary: 把互斥多類別拆成多個二元任務，再整合分數或勝票
goals:
  - id: g1
    text: 比較邏輯迴歸的OvR與多項擴展，說明機率輸出與限制
  - id: g2
    text: 計算OvR與OvO模型數，追蹤決策整合並區分Softmax
guide_refs:
  - guide-3:4-28
  - guide-3:4-37
textbook: v2
author: codex
status: draft
formula_groups:
  - id: model-counts
    source: https://scikit-learn.org/stable/modules/multiclass.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
  - id: softmax
    source: https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服互斥三類，團隊原本只有二元邏輯迴歸。哪種擴展與機率解讀正確？
    options:
      A: OvR分別訓練三個二元模型，原始機率必然相加為1
      B: 多項邏輯迴歸聯合訓練三類，輸出機率可加總為1
      C: OvR直接平均類別代碼，結果可當成三類的機率
      D: 多項邏輯迴歸刪去其餘兩類，只保留正類做擬合
    answer: B
    explain:
      A: 分開擬合的機率不必自然加總為1。
      B: 聯合的多類別目標搭配Softmax產生正規化機率。
      C: 類別代碼不是可平均的機率。
      D: 多項訓練保留全部互斥類別。
  - id: c2
    goal: g2
    type: choice
    prompt: 設備故障分為5個互斥類別；每個二元分類器各訓練一次。OvR與OvO各需幾個分類器？
    options:
      A: OvR為10個；OvO為5個
      B: OvR為5個；OvO為20個
      C: OvR為10個；OvO為20個
      D: OvR為5個；OvO為10個
    answer: D
    explain:
      A: 模型數的對應顛倒。
      B: OvO每一對只建一次，不計兩個方向。
      C: OvR不是兩兩配對。
      D: OvR為K，OvO為K(K−1)/2。
  - id: c3
    goal: g2
    type: choice
    prompt: 三類的兩兩模型，類0對1選1、類0對2選0、類1對2選1。依勝場投票應選哪類？
    options:
      A: 類0，因為0對2這一場獲勝
      B: 類2，因為參與兩場就有兩票
      C: 類1，因為累計得到兩場勝票
      D: 類0，因為把0、1、2取平均
    answer: C
    explain:
      A: 類0只獲一票。
      B: 參與比賽不等於勝出。
      C: 類1在對0與對2均勝出。
      D: 類別編碼平均不是OvO決策。
---

## 為什麼需要

二元分類器每次只回答兩種結果。客服若有帳務、技術、物流三類，可用多類別分解策略，把任務拆成多個二元問題，再決定最後類別。

先確認一筆只能屬於一類。本頁討論互斥多類別；同時貼上帳務與物流兩個標籤，是不同的多標籤任務。（補充）

## 直覺

一對其餘（One-vs-Rest，OvR）讓每類各自對抗其餘類。對「技術」分類器而言，帳務與物流都併為負類。

一對一（One-vs-One，OvO）讓每一對類別各比一次。帳務對技術的模型只使用這兩類訓練資料，物流資料不參與這一場。

![OvR各類對其餘，OvO則每一對各建一個二元分類器](figure:l23202-multiclass-strategies-split)

## 定義與公式

### 模型數（補充）

$$
M_{\mathrm{OvR}}=K,\qquad M_{\mathrm{OvO}}=\frac{K(K-1)}2
$$

$K$是互斥類別數，這裡討論$K\ge3$；$M$是要擬合的二元分類器數。OvO每對只算一次，類0對1和類1對0不是兩個模型。

三類時兩者都是3個，不能只靠模型數分辨。五類時OvR為5、OvO為10；OvO雖模型較多，每個模型的訓練樣本通常較少，成本須一起估計。

### 邏輯迴歸如何擴展

指引列出OvR與多項邏輯迴歸（Multinomial Logistic Regression）兩種方向。前者分開學每類對其餘；後者聯合學習多類別輸出。

:::supplement[來源：scikit-learn Multiclass；scikit-learn Logistic regression]
OvR可比較各二元分類器對正類的分數。分開估計的原始二元機率不保證加總為1；套件可能再正規化，但正規化不等於完成校準。

多項邏輯迴歸聯合最小化多類別損失，常以Softmax輸出機率。線性版本假設各類的線性分數足以描述決策差異，複雜非線性關係需額外特徵或其他模型。
:::

### Softmax不是拆題策略（補充）

$$
p_k=\frac{e^{z_k}}{\sum_{j=1}^{K}e^{z_j}}
$$

$z_k$是類$k$的實數分數，$p_k$是其正規化機率，$j$遍歷全部類別。Softmax描述如何把一組分數轉成總和為1的輸出，不規定建立K個或兩兩二元模型。

若三類分數是$0,\ln2,\ln3$，指數後為1／2／3，機率為1/6／2/6／3/6，選類2。這不是做三場二元投票。

## 走一次流程

### 同一筆客服（補充）

沿用六筆分數資料的第一筆（文字索引6），類0／1／2為帳務／技術／物流。JSON另存各二元任務的分解示意輸出，與投票頁的三個完整模型分數分開設計。

| 策略 | 二元任務 | 整合示例 |
|---|---|---|
| OvR | 0對其餘、1對其餘、2對其餘 | 正類分數0.40／0.85／0.20，選1 |
| OvO | 0對1、0對2、1對2 | 勝者1／0／1；類1得兩票 |
| 多項輸出 | 聯合比較全部三類 | Softmax示例選2，非上述同一擬合結果 |

三列各自示範一種整合規則，不是同一批擬合結果，不用來比較方法優劣。這筆真實標籤是類0；示例選類1或2都會分錯，能輸出答案不保證預測正確。

郵件把類名換成促銷／工作／私人，分解方法不變；固定0–5訓練、6–8驗證、9–11測試。例中OvR分數合計1.45，正好顯示不能把未正規化的三個二元機率當成完整多類分布。

若OvO三類各贏一場，要依事先訂好的平手規則處理。不同套件可能使用決策分數輔助，不能假定所有實作都只數票。（補充）

## 程式（補充）

下列先列五類的二元任務數，再核算同一筆的勝票與獨立Softmax示例。

```python
from itertools import combinations
import numpy as np
K = 5
print("OvR/OvO", K, len(list(combinations(range(K), 2))))
ovr = np.array([.40, .85, .20])
print("OvR選類", int(ovr.argmax()), "機率和", round(float(ovr.sum()), 2))
winners = [1, 0, 1]
print("OvO票數", np.bincount(winners, minlength=3).tolist())
z = np.log([1., 2., 3.])
p = np.exp(z-z.max()); p /= p.sum()
print("Softmax", p.round(4).tolist())
```
```text
OvR/OvO 5 10
OvR選類 1 機率和 1.45
OvO票數 [1, 2, 0]
Softmax [0.1667, 0.3333, 0.5]
```

:::tip[讀碼重點]
`ovr.argmax()`比較各類對其餘的正類分數，`bincount`累積兩兩模型的勝票。Softmax另從`z`轉成總和為1的機率，三者的輸入意義不同。
:::

## 怎麼用、怎麼判讀

指引在邏輯迴歸與集成式分類說明多類別支援。選擇時要查模型是否原生支援多類，或需要外層分解，不能僅從「可輸出機率」推斷其訓練策略。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 邏輯迴歸多類擴展 | 原二元任務增加類別 | OvR或聯合多項模型 |
| 集成式分類 | 有多種互斥結果 | 分解策略與輸出方式分開看 |
| 郵件分流（補充） | 促銷／工作／私人 | 欄序和類別意義固定 |
| 維修診斷（補充） | 五種互斥故障 | 模型數與各對訓練量 |

## 常見誤解

- 三類時OvR與OvO都建3個模型，但二元問題不同。（補充）
- OvR分數比較不是完整分類器之間的集成投票。（補充）
- Softmax是一種輸出正規化，並非OvR或OvO的別名。（補充）

## 進階

### 類別不平衡（補充）

OvR將其他類合成一群時，正負比例可能很懸殊；OvO則需留意每一對的樣本數。分解沒有自動消除不平衡，仍需在相同資料切分下逐類驗證。

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-28`、`guide-3:4-37`：支持邏輯迴歸擴展與三種多類別支援名稱。
- [scikit-learn Multiclass](https://scikit-learn.org/stable/modules/multiclass.html)：支持模型數、決策整合及多標籤界線。
- [scikit-learn Logistic regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression)：支持聯合多項目標與機率輸出限制。
- [Stanford文字分類課本第4章](https://web.stanford.edu/~jurafsky/slp3/4.pdf)：參考線性分數到Softmax的教學順序，支持補充算例。

## 小結

- OvR每類對其餘；OvO每一對各建二元模型。
- 五類的數量是5與10，三類則都是3。（補充）
- 分解、機率正規化、集成是不同層次的設計。（補充）
