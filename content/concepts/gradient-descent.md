---
id: "gradient-descent"
title: "梯度下降與更新步長"
kind: "technique"
codes:
  - "L23103"
aliases:
  - "Full-batch GD"
  - "Gradient Descent"
summary: "梯度下降以參數減去學習率乘梯度，學習率控制更新幅度"
goals:
  - id: "g1"
    text: "由偏導組成梯度，手算並用程式核對一次更新及過大步長的影響"
requires:
  - "optimization-problem"
  - "vector-norm-linear-combination"
guide_refs:
  - "guide-3:3-23"
  - "guide-3:3-24"
  - "guide-3:3-30"
textbook: "v2"
author: "codex"
status: "draft"
formula_groups:
  - id: "gradient-definition"
    source: "https://d2l.ai/chapter_preliminaries/calculus.html#partial-derivatives-and-gradients"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK2-W-L23103-A"
  - id: "negative-gradient-update"
    source: "https://d2l.ai/chapter_optimization/gd.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK-W-L23103-A"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "能源模型初始 (w,b)=(0,0)，J=2/3(w−2)²+(b−1)²，學習率 0.25。一次更新後為何？"
    options:
      A: "(−2/3,−1/2)"
      B: "(8/3,2)"
      C: "(1/2,1/2)"
      D: "(2/3,1/2)"
    answer: "D"
    explain:
      A: "此值把梯度直接加上，最小化要減去梯度。"
      B: "這是負梯度，尚未乘學習率。"
      C: "權重方向的曲率與偏差不同，不能把兩個偏導都當成 −2。"
      D: "梯度為 (−8/3,−2)，乘 0.25 後從原參數扣除即得此值。"
  - id: "c2"
    goal: "g1"
    type: "choice"
    prompt: "同一損失固定 w=2，由 b=2 開始，採學習率 1.1。一次更新後 b 與損失如何變化？"
    options:
      A: "b=0.9，損失必然下降"
      B: "b=−0.2，損失從 1 升到 1.44"
      C: "b=1，損失變 0"
      D: "b=4.2，因為最小化要沿正梯度"
    answer: "B"
    explain:
      A: "梯度是 2(b−1)=2，須減去 2.2。"
      B: "負梯度方向起初會下降，但步長過大跨越谷底，最後損失反而上升。"
      C: "此位置需要不同的學習率，不能由 1.1 得到。"
      D: "正梯度是局部上升方向，最小化應沿負方向。"
---

## 為什麼需要

參數很多時，逐組猜測很慢。梯度下降（Gradient Descent）利用損失對各參數的局部變化率，決定下一步調整方向。

本頁的全量梯度下降每次使用全部訓練資料。指引提到它的平均方向穩定，但每步計算成本可能較高。

## 直覺

梯度（Gradient）的每個分量都描述一個參數增加時，損失的局部變化。最小化目標要往負梯度方向走，學習率（Learning Rate）則控制移動多遠。

:::supplement[來源：Dive into Deep Learning 12.3]
這是局部資訊；步長太大可能越過谷底。指引 3-23 寫「沿梯度方向」時，本頁依最小化目標明確寫為負梯度，以免把符號反過來。
:::

## 定義與公式（補充）

對參數 $\theta=(w,b)$，梯度收集兩個偏導數：

$$
\nabla J(\theta)=\begin{bmatrix}\partial J/\partial w\\\partial J/\partial b\end{bmatrix}
$$

$\nabla$ 表梯度，$\partial J/\partial w$ 是固定 $b$、只微調 $w$ 的變化率，另一項反過來。偏導是每個方向的斜率，整個梯度是向量。

若要精確說明「微調」，可用極限定義：

$$
\frac{\partial J}{\partial w}(w,b)=\lim_{h\to0}\frac{J(w+h,b)-J(w,b)}{h}
$$

$h$ 是權重方向的小變動量；此極限存在時才有該偏導。若用程式做有限差分，會取很小但非零的 $h$；下方程式另以自動微分核對解析梯度。

在每個更新點可導時，基本規則是：

$$
\theta_{t+1}=\theta_t-\eta g_t,\qquad g_t=\nabla J(\theta_t),\quad\eta>0
$$

$t$ 是更新次數，$g_t$ 是舊參數位置的梯度。本組把 $\eta$ 稱為學習率，也叫步長；實際移動距離還取決於梯度大小。

各參數要用同一舊位置的梯度一起更新，不是先改 $w$ 再重算半套梯度。

## 算一次（補充）

能源與房價各六筆轉換後都得到同一目標：

$$
\begin{aligned}
J(w,b)&=\frac23(w-2)^2+(b-1)^2\\
\nabla J(w,b)&=\left(\frac43(w-2),\ 2(b-1)\right)
\end{aligned}
$$

$w$ 是輸入指數的權重，$b$ 是偏差。這裡沒有加正則項，且每次以六筆完整資料的平均平方誤差求梯度。

初始 $(w,b)=(0,0)$，兩個偏導分別為 $-8/3$、$-2$。取 $\eta=0.25$，新參數為 $(0,0)-0.25(-8/3,-2)=(2/3,1/2)$。

代回目標得到 $J=155/108\approx1.4352$，低於初始 $11/3\approx3.6667$。第一步下降不代表任何後續步長都安全。

![兩條線從同一初始點出發，0.25 逐漸靠近中心，1.1 在偏差方向來回跨越且越走越遠。](figure:l23103-gradient-descent-trajectories)

固定 $w=2$、由 $b=2$ 開始，梯度是 $(0,2)$。改用 $\eta=1.1$，新偏差變為 $-0.2$，損失由 1 增至 1.44；方向正確仍可能走過頭。

## 程式（補充）

```python
import numpy as np
import torch
x = np.array([-1., 0., 1., -1., 0., 1.])
X = np.column_stack([x, np.ones(6)])
y = np.array([-1., 1., 3., -1., 1., 3.])
theta = np.zeros(2)
g = 2 * X.T @ (X @ theta - y) / len(y)
t = torch.tensor(theta, requires_grad=True)
loss = ((torch.tensor(X) @ t - torch.tensor(y))**2).mean()
auto, = torch.autograd.grad(loss, t)
new = theta - .25*g
print("梯度", g.round(4).tolist(), "相符", np.allclose(g, auto.numpy()))
print("新參數", new.round(4).tolist(), "損失", round(float(np.mean((X@new-y)**2)), 4))
```
```text
梯度 [-2.6667, -2.0] 相符 True
新參數 [0.6667, 0.5] 損失 1.4352
```

:::tip[讀碼重點]
X 第二欄的 1 對應偏差，平均損失的梯度也要除以六筆樣本數。autograd.grad 直接回傳梯度，本例不依賴累積的 .grad 狀態。
:::

## 怎麼用、怎麼判讀

先確認目標是最小化、梯度是否來自同一組舊參數，再檢查學習率。若發散或持續震盪，可固定其他條件，降低步長比較。

### 換個場景

| 場景 | 指引條件 | 判讀 |
|---|---|---|
| 全量梯度下降 | 小型資料集、高精度需求、可並行 | 每步算完整梯度；加總可並行，成本隨資料量增加 |
| 大型／線上資料 | 指引列為隨機梯度下降場景 | 不必每筆更新都掃全資料 |
| 中大型深度模型 | 指引列為小批次場景 | 留意記憶體與梯度波動 |
| 能源預測（補充） | 六筆二參數問題 | 可逐項核對解析梯度 |
| 房價預測（補充） | 使用相同轉換後資料 | 固定單位、索引和初始點再比步長 |
| 製造品質（補充） | 特徵尺度相差很多 | 檢查尺度對更新幅度的影響 |

:::supplement[來源：Dive into Deep Learning 12.5]
小批次也能利用向量化與 GPU 並行；「可並行」並不是全量方法獨有的優點。
:::

## 常見誤解

- 全量使用全部訓練資料，不包含驗證集與測試集。（補充）
- 負梯度是局部下降方向，不保證任意步長的終點都較低。（補充）
- 梯度不是損失本身，兩者的數值與單位都不同。（補充）

## 進階

### 參考來源

- 科目 3 指引 3.3，guide-3:3-23、guide-3:3-24、guide-3:3-30（版本未標示）：支持全量取樣、適用條件與梯度意義。
- [Deep Learning 4.3](https://www.deeplearningbook.org/contents/numerical.html)：支持偏導向量與負梯度方向。
- [Dive into Deep Learning 2.4.3，式 2.4.6、2.4.8](https://d2l.ai/chapter_preliminaries/calculus.html#partial-derivatives-and-gradients)：支持「定義與公式」中的偏導極限與梯度向量。
- [PyTorch autograd.grad](https://docs.pytorch.org/docs/2.15/generated/torch.autograd.grad.html)：支持程式的直接梯度回傳。
- [Dive into Deep Learning 12.3](https://d2l.ai/chapter_optimization/gd.html)：支持更新規則，參考步長過大時跨越谷底的教法。
- [Dive into Deep Learning 12.5](https://d2l.ai/chapter_optimization/minibatch-sgd.html)：支持「換個場景」後對小批次向量化與並行的補充。

## 小結

- 梯度描述損失對各參數的局部變化。
- 最小化時扣除學習率乘梯度。（補充）
- 固定資料與初始點，才容易比較步長影響。（補充）
