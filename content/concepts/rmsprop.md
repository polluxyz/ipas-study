---
id: rmsprop
title: RMSprop
kind: technique
codes: [L23103]
aliases: [Root Mean Square Propagation]
summary: RMSprop 以平方梯度的衰減平均縮放更新，讓舊梯度的影響逐步淡化
goals:
  - id: g1
    text: 以相同序列比較衰減平均與 Adagrad 累積，判斷非平穩梯度場景
  - id: g2
    text: 計算基本 RMSprop 的兩步平方平均與參數更新
requires: [adagrad]
guide_refs: [guide-3:3-25]
formula_groups:
  - id: square-ema
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.RMSprop.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-C
  - id: rmsprop-update
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.RMSprop.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 序列模型前 2 步梯度很大，接著連續 10 步都較小。RMSprop 的 ρ=0.9，基礎學習率固定。相較 Adagrad，哪個敘述最合理？
    options:
      A: RMSprop 與 Adagrad 都清除前 2 步狀態，只用最近 1 步的小梯度決定有效係數
      B: RMSprop 每步都加上新的平方梯度，因此後 10 步的平方平均必定繼續增加
      C: RMSprop 直接平均帶符號梯度，不需平方，因此後 10 步會用方向抵銷控制尺度
      D: RMSprop 保留前 2 步的衰減影響，後 10 步小梯度可降低平方平均，讓有效係數回升
    answer: D
    explain:
      A: 兩種方法都有歷史狀態，記憶方式不同。
      B: 新平方梯度小於舊平均時，平均值可以降低。
      C: 基本 RMSprop 保存平方梯度的平均，並非帶符號方向平均。
      D: 近期較小的梯度可逐步降低平方平均，與不回復的全歷史累積不同。
  - id: c2
    goal: g2
    type: choice
    prompt: 平方平均初值 [0,0]、ρ=0.9，梯度依序 [3,4]、[−1,2]。依 s=ρs+(1−ρ)g²，兩步後狀態為何？
    options:
      A: '[10,20]，由 [9,16]+[1,4] 得到'
      B: '[0.91,1.84]，由 0.9[0.9,1.6]+0.1[1,4] 得到'
      C: '[1.7,5.6]，由 0.9[3,4]+[−1,2] 得到'
      D: '[0.1,0.2]，由 0.1[−1,2] 取絕對值得到'
    answer: B
    explain:
      A: 這是 Adagrad 的全歷史平方和。
      B: 第一步 [0.9,1.6]；再乘 0.9 並加 [0.1,0.4]，得到此值。
      C: 這是累積帶符號梯度的動量狀態。
      D: 這既沒有正確平方，也沒有保留第一步狀態。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

Adagrad 的平方和只增不減，早期的大梯度可能讓後期步伐一直偏小。RMSprop（Root Mean Square Propagation）以衰減平均取代全歷史累積，減輕這個問題。

指引把它用於非穩定梯度，並列出 RNN、語音處理與序列建模。這裡關心的是梯度尺度隨訓練改變，而不只是正負方向變動。

## 直覺

新的平方梯度加入狀態，舊狀態只保留一部分。近期梯度變小時，平方平均也能逐漸下降，讓更新的有效係數回升。

![由大梯度轉為小梯度後，RMSprop 的尺度可逐步調整；Adagrad 仍記得全部早期平方和。](figure:l23103-adagrad-effective-scale)

兩條線使用同一序列與基礎學習率，但狀態定義不同。看的是各方法如何記憶歷史，不能從線高低直接判定誰訓練得更好。

## 定義與公式（補充）

基本版本採用平方梯度的指數移動平均（Exponential Moving Average）：

$$
s_{t,j}=\rho s_{t-1,j}+(1-\rho)g_{t,j}^2,\qquad s_{0,j}=0
$$

$t$ 是步數、$j$ 是座標，$g_{t,j}$ 是梯度，$s_{t,j}$ 是平方平均。衰減率 $0\leq\rho<1$ 越接近 1，記憶越長、回應越慢。

更新式為：

$$
\alpha_{t,j}=\frac{\eta}{\sqrt{s_{t,j}}+\epsilon},\qquad
\theta_{t,j}=\theta_{t-1,j}-\alpha_{t,j}g_{t,j}
$$

$\theta$ 是參數，$\eta>0$ 是學習率，$\epsilon>0$ 防止除零，$\alpha$ 是有效係數。本頁 ε 在根號外，採無動量、非 centered 版本。

平方平均不等於變異數，也沒有保留梯度正負號。本版本不做 Adam 那種初始化偏差修正。

**與指引的寫法差異**：本頁以 $\theta_{t-1}$、$\theta_t$ 表示更新前、後，梯度在更新前求值。指引 3-25 沒有展開 RMSprop 公式；本節補充式採全組相同的步數編號。

## 算一次（補充）

共同初值 $[1,-1]$，梯度依序 $[3,4]$、$[-1,2]$。取 $\eta=0.1$、$\rho=0.9$、$\epsilon=10^{-8}$，每個座標各自計算。

首步 $s_1=0.1[9,16]=[0.9,1.6]$。第一座標扣除 $0.1\times3/(\sqrt{0.9}+10^{-8})\approx0.3162$。

| 步數 | 平方平均 $s_t$ | 有效係數 $\alpha_t$ | 新參數 |
|---|---|---|---|
| 1 | [0.9,1.6] | [0.1054,0.0791] | [0.6838,−1.3162] |
| 2 | [0.91,1.84] | [0.1048,0.0737] | [0.7886,−1.4637] |

第二步先算 $0.9[0.9,1.6]+0.1[1,4]=[0.91,1.84]$。再由上一個參數扣除約 $[-0.1048,0.1474]$，得到表中結果。

### 對照同一段歷史

前兩步之後，讓梯度連續十步都是 $[0.2,0.2]$。第一座標在第 12 步，Adagrad 平方和為 10.4，RMSprop 平方平均約 0.3434。

兩者有效係數分別約 0.0310 與 0.1707。這說明 RMSprop 可以淡化早期的大梯度，不代表較大的係數一定較安全。

## 程式（補充）

```python
import numpy as np
import torch
q, s = np.array([1., -1.]), np.zeros(2)
p = torch.tensor(q, dtype=torch.float64, requires_grad=True)
opt = torch.optim.RMSprop([p], lr=.1, alpha=.9, eps=1e-8, momentum=0, centered=False)
for t, g in enumerate(([3., 4.], [-1., 2.]), 1):
    g = np.array(g)
    s = .9 * s + .1 * g * g
    q = q - .1 * g / (np.sqrt(s) + 1e-8)
    p.grad = torch.tensor(g)
    opt.step()
    same = np.allclose(q, p.detach().numpy())
    same &= np.allclose(s, opt.state[p]['square_avg'].numpy())
    print(t, s.round(4).tolist(), q.round(4).tolist(), bool(same))
```
```text
1 [0.9, 1.6] [0.6838, -1.3162] True
2 [0.91, 1.84] [0.7886, -1.4637] True
```

:::tip[讀碼重點]
PyTorch 的 alpha 參數對應公式的 ρ；不是公式的有效係數 α。momentum=0、centered=False 將更新限制在本頁的基本版本。
:::

## 怎麼用、怎麼判讀

指引所說的非穩定梯度，可從不同訓練階段尺度改變來理解。與 Adagrad 相比，RMSprop 不讓所有舊平方梯度永遠等權留下。

:::supplement[來源：PyTorch RMSprop；Dive into Deep Learning 12.8.1]
若 $\rho=1$，新梯度完全進不來，零初值會讓分母只剩 ε，因此不能這樣設定。即使 $\rho<1$，仍要調基礎學習率，初期零狀態也可能使更新較大。
:::

### 換個場景

| 場景 | 指引條件或資料特性 | 判讀重點 |
|---|---|---|
| RNN 訓練 | 3-25 的非穩定梯度 | 觀察不同階段的梯度尺度 |
| 語音處理、序列建模 | 3-25 列出的非凸應用 | 有效縮放不構成全域解保證 |
| 能源預測（補充） | 固定資料與批次的比較 | 對照梯度尺度與平方平均 |
| 文字分類（補充） | 詞特徵更新頻率不同 | 長時間為零時，舊平方平均會衰減 |
| 交通序列（補充） | 各批訊號強弱不同 | 固定基礎學習率，再比較衰減率 |

## 常見誤解

- RMSprop 的重點是平方梯度的衰減平均，不是保存全部歷史平方和。
- 有效係數回升，不表示損失一定下降。（補充）
- 平方平均是尺度資訊，不是 Hessian 或二階導數。（補充）
- 不同實作的 ε 位置可能不同，必須以實際公式核對。（補充）

## 進階

### 參考來源

- 科目 3 指引（版本未標示）：guide-3:3-25，支持修正 Adagrad 衰減問題、非穩定梯度、RNN、語音與序列場景；指引此處未展開公式。
- [PyTorch 2.9 RMSprop](https://docs.pytorch.org/docs/2.9/generated/torch.optim.RMSprop.html)：支持基本公式、衰減率、根號外 ε 與程式參數。
- [Dive into Deep Learning 12.8.1](https://d2l.ai/chapter_optimization/rmsprop.html)：支持近期尺度與舊歷史衰減的教學；該書 ε 位於根號內，本頁採 PyTorch 版本。

## 小結

- RMSprop 讓舊平方梯度逐步衰減，能回應近期尺度改變。
- 衰減率越接近 1，記憶越長，回應也較慢。（補充）
- 基本版本以當前梯度除以平方平均的平方根加 ε。（補充）
