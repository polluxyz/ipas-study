---
id: vector-norm-linear-combination
title: 向量範數與線性組合
kind: theory
codes:
  - L23102
aliases:
  - Euclidean Norm
  - L2 Norm
  - 線性組合
summary: 範數量大小，向量加減與線性組合描述誤差與更新
goals:
  - id: g1
    text: 計算 L2 範數、向量加減與線性組合，解釋殘差向量的大小
requires:
  - vector-inner-product
guide_refs:
  - guide-3:3-10
textbook: v2
author: codex
status: draft
formula_groups:
  - id: vector-norm
    source: https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-A
  - id: vector-add-subtract
    source: https://d2l.ai/chapter_preliminaries/linear-algebra.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-A
  - id: vector-combination
    source: https://textbooks.math.gatech.edu/ila/spans.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23102-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某能源模型兩筆實際值為 (4,6)，預測為 (1,2)。以實際減預測定義殘差，殘差的 L2 範數是多少？
    options:
      A: "5"
      B: "25"
      C: "7"
      D: (3,4)
    answer: A
    explain:
      A: 殘差為 (3,4)，平方和 25 開根號是 5。
      B: 25 是平方範數，還沒有開根號。
      C: 7 是分量絕對值總和，並非 L2 範數。
      D: (3,4) 是殘差向量，範數應是一個非負數。
  - id: c2
    goal: g1
    type: choice
    prompt: 兩維參數為 u=(3,4)，調整方向為 v=(1,2)。更新規則是 u−0.5v，得到什麼？
    options:
      A: (2,2)
      B: (3.5,5)
      C: (2.5,3)
      D: (1.5,2)
    answer: C
    explain:
      A: 這是減去完整的 v，沒有乘 0.5。
      B: 這是加上半個方向，更新符號反了。
      C: 先算半個方向 (0.5,1)，再逐分量相減。
      D: 這是把 u 直接減半，沒有依更新方向計算。
---

## 為什麼需要

模型可能同時對許多樣本產生誤差。向量保留各筆誤差，範數（Norm）則把它們的整體大小濃縮成一個數。

指引把 L2 範數連到正規化與正則化，也把向量加減連到誤差與梯度。這些運算是之後讀參數更新的前置。

## 直覺

L2 範數（L2 Norm），也稱歐幾里得範數（Euclidean Norm），是原點到箭頭末端的直線距離。兩個向量相加，可以把第二個箭頭接在第一個末端，合成箭頭由原點指向最後落點。

:::supplement[來源：Dive into Deep Learning 2.3]
下圖表示無單位的抽象向量 $u,v$，用互相垂直的軸觀察長度與加法。後面的殘差算例另以 $r$ 表示兩筆預測誤差，採相同的長度算法。
:::

![實線 u=(3,4) 長 5，虛線把 v=(1,2) 接到末端後，合成向量是 (4,6)。](figure:l23102-vector-norm-linear-combination-arrows)

## 定義與公式

指引說明 L2 範數量測長度；以下展開計算式。

:::supplement[來源：NumPy linalg.norm；Dive into Deep Learning 2.3；Interactive Linear Algebra 2.2]
對實數向量 $x=(x_1,\ldots,x_d)$：

$$
\lVert x\rVert_2=\sqrt{\sum_{j=1}^{d}x_j^2}
$$

$d$ 是分量數，$j$ 是索引。長度一定非負，只有零向量的長度為 0；平方範數是根號內的總和。

同維向量 $u,v$ 的加減逐分量進行：

$$
(u+v)_j=u_j+v_j,\qquad(u-v)_j=u_j-v_j
$$

$u_j,v_j$ 是相同座標的分量；配對分量應有相同單位，才能相加減。

線性組合（Linear Combination）先縮放，再加總：

$$
c=\alpha u+\beta v
$$

$\alpha,\beta$ 是純量係數，$c$ 與 $u,v$ 維數相同。負係數也合法，代表箭頭反向。
:::

## 算一次（補充）

共用資料另設一組獨立的能源殘差示例：實際值 $y=(4,6)$、預測值 $\hat y=(1,2)$，單位都是用電指數。

1. 定義殘差為實際減預測：$r=y-\hat y=(3,4)$。
2. 算長度：$\lVert r\rVert_2=\sqrt{3^2+4^2}=5$。
3. 算平方範數：$\lVert r\rVert_2^2=25$，它和 5 是不同的量。

取方向 $u=(3,4)$、$v=(1,2)$，得 $u+v=(4,6)$、$u-v=(2,2)$；係數取 $1,-0.5$ 時，$c=(2.5,3)$。

換成授信的額度指數時，可依同樣步驟計算殘差長度，但需重新使用授信資料與單位。不同領域的誤差大小不能直接比較。

平方 L2 損失以殘差平方範數為基礎；若取每筆平方誤差的平均，就是均方誤差。本例為 $25/2=12.5$；實作須確認採總和還是平均。

## 程式（補充）

```python
import numpy as np
u = np.array([3., 4.])
v = np.array([1., 2.])
print("範數", float(np.linalg.norm(u)))
print("平方範數", float(u @ u))
print("和", (u + v).tolist(), "差", (u - v).tolist())
print("組合", (u - 0.5 * v).tolist())
r = np.array([4., 6.]) - np.array([1., 2.])
print("均方誤差", float(np.mean(r ** 2)))
```
```text
範數 5.0
平方範數 25.0
和 [4.0, 6.0] 差 [2.0, 2.0]
組合 [2.5, 3.0]
均方誤差 12.5
```

:::tip[讀碼重點]
一維陣列交給 np.linalg.norm，預設得到 L2 範數；u @ u 是長度的平方，少了一次開根號。
:::

## 怎麼用、怎麼判讀

範數只保留整體大小；要追查哪一筆錯得最多，還要回看殘差各分量。梯度向量的線性組合則能表達縮放、加總與更新方向。

### 換個場景

| 場景 | 指引的用途或資料條件 | 判讀 |
|---|---|---|
| 正規化、正則化 | 使用向量大小 | 範數與平方範數要分清 |
| 誤差與梯度 | 多個分量的加減或組合 | 座標必須對應同一物件 |
| 能源預測（補充） | 多筆用電殘差 | 比較時固定單位與樣本數 |
| 授信額度（補充） | 多筆額度殘差 | 不和用電誤差直接比大小 |
| 機器手臂（補充） | 同單位的位移向量 | 合成位移由向量相加得到 |

## 常見誤解

- 範數沒有負值；負分量也要先平方。（補充）
- 同一範數可能來自不同誤差分布，不能只看總量診斷。（補充）
- 不同單位的特徵直接量距離，可能讓大尺度特徵主導結果。（補充）

## 進階

### 參考來源

- 科目 3 指引 3.2，guide-3:3-10（版本未標示）：支持範數、誤差及梯度的用途。
- [NumPy linalg.norm](https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html)：支持範數與程式。
- [Dive into Deep Learning 2.3](https://d2l.ai/chapter_preliminaries/linear-algebra.html)：支持加減及範數算例安排。
- [Interactive Linear Algebra 2.2](https://textbooks.math.gatech.edu/ila/spans.html)：支持「定義與公式」的一般線性組合。
- [PyTorch MSELoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.MSELoss.html)：支持平方 L2 損失的總和與平均設定。

## 小結

- L2 範數把向量壓成一個大小。
- 加減逐座標進行；線性組合先乘係數再相加。
- 殘差保留方向與各筆細節，範數只保留大小。（補充）
