---
id: adagrad
title: Adagrad
kind: technique
codes: [L23103, L23304]
aliases: [Adaptive Gradient]
summary: Adagrad 以各參數累積的梯度平方縮放更新，常更新的座標步長會變小
goals:
  - id: g1
    text: 比較稀疏與密集梯度，說明逐參數調整的用途與衰減限制
  - id: g2
    text: 計算二參數兩步的平方累積與更新，說明 ε 的位置
  - id: g3
    text: 以稀疏兩座標算例判讀有效步長，辨識後期步長過小
requires: [sgd]
contrasts:
  - target: rmsprop
    note: Adagrad 保存全部歷史的梯度平方和；RMSprop 衰減舊平方梯度，縮放尺度能回應近期變化
    source: [guide-3:3-25]
guide_refs: [guide-3:3-25, guide-3:3-31, guide-3:5-40, guide-3:5-41]
formula_groups:
  - id: squared-accumulation
    source: guide-3:5-40
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-C
  - id: coordinate-update
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adagrad.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23103-C
  - id: guide-update
    source: guide-3:5-40
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23103-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 文字模型中，含本步在內，常見詞參數的平方梯度累積為 100，少見詞為 4；兩者本步梯度大小相同，學習率 0.1、ε 可忽略。哪個判斷正確？
    options:
      A: 常見詞的有效係數為 10，大於少見詞的 0.4
      B: 少見詞的有效係數為 0.05，大於常見詞的 0.01
      C: 兩者的有效係數均為 0.1，因為基礎學習率相同
      D: 兩者本步都清除歷史累積，因此改用相同的縮放係數
    answer: B
    explain:
      A: 這把學習率乘上平方和；應除以平方和的平方根。
      B: 0.1 除以 2 為 0.05，除以 10 為 0.01，呈現逐參數縮放。
      C: 共享基礎學習率不代表共享相同的有效係數。
      D: 基本 Adagrad 不會自動遺忘或歸零歷史累積。
  - id: c2
    goal: g2
    type: choice
    prompt: 初值 [1,−1]、G 初值 [0,0]，梯度依序 [3,4]、[−1,2]，η=0.1。忽略極小 ε 的數值影響，兩步後 G 與參數約為何？
    options:
      A: 平方和累積為 [10,20]，參數約 [0.9316,−1.1447]
      B: 累積帶符號梯度為 [2,6]，參數約 [0.8,−1.6]
      C: 平方和只留本步為 [1,4]，參數約 [1,−1.2]
      D: 平方和累積為 [10,20]，參數依動量得到 [0.53,−1.96]
    answer: A
    explain:
      A: 先加 [9,16] 再加 [1,4]，每步除以當時累積平方的平方根。
      B: 這累積了帶符號梯度，沒有先平方。
      C: 這只保存第二步平方，丟掉第一步歷史。
      D: 參數數值來自動量法，並未用平方和縮放。
  - id: c3
    goal: g3
    type: choice
    prompt: 稀疏例的梯度為 [3,0]、[−1,2]，G 初值為零、η=0.1、ε=10⁻⁸。第二座標在第一步與第二步如何變化？
    options:
      A: 第一步把係數 10⁷ 當成扣除量，參數大幅減少；第二步把係數 0.05 當成扣除量
      B: 第一步平方和為 0，便以零作分母而無法更新；第二步平方和為 4，也無法再繼續計算
      C: 第一步梯度為零所以不動；第二步首次出現梯度，約扣除 0.1
      D: 第一步梯度為 0 所以不動；第二步與第一座標共用平方和 10，約扣除 0.0632
    answer: C
    explain:
      A: 有效係數還要乘本步梯度，零梯度時扣除量為零。
      B: 正的 ε 讓零平方累積的分母仍非零。
      C: 第二步該座標 G=4，扣除量約為 0.1×2÷2=0.1。
      D: 第一座標累積為 10，第二座標為 4，各自縮放。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

文字特徵常很稀疏：常見詞經常出現，少見詞很久才出現一次。所有參數若使用相同縮放，未必能兼顧更新頻率與梯度大小的差異。

Adagrad（Adaptive Gradient）為每個參數保存自己的梯度平方和，用它縮放更新。指引也提醒：累積太多時，有效學習步伐可能小到幾乎停住。

## 直覺

常收到大梯度的座標，分母逐漸變大，後續走得更小步。很少收到梯度的座標，累積較少，仍保有相對較大的縮放係數。

這裡的稀疏是特徵或梯度常為零，不是指資料筆數少。指引提到文字、自然語言處理與特徵分佈不均的場景。

![同一梯度由大轉小後，Adagrad 的有效係數繼續縮小，RMSprop 則會隨舊梯度衰減而回升。](figure:l23103-adagrad-effective-scale)

圖採 PyTorch 的根號外 ε 慣例。縱軸是乘在當前梯度前的係數，不是參數的實際移動量；實際移動還要乘本步梯度。

## 定義與公式

逐座標累積平方梯度：

$$
G_{t,j}=G_{t-1,j}+g_{t,j}^2,\qquad G_{0,j}=0
$$

$t$ 是步數，$j$ 是參數座標，$g_{t,j}$ 是當前梯度，$G_{t,j}$ 是到本步為止的平方和。平方不保留正負號，因此反向梯度不會把累積抵銷。

依指引 5-40 的寫法，先把平方和與 ε 相加再開根號，得到有效係數後更新參數：

$$
\alpha_{t,j}=\frac{\eta}{\sqrt{G_{t,j}+\epsilon}},\qquad
\theta_{t,j}=\theta_{t-1,j}-\alpha_{t,j}g_{t,j}
$$

$\theta_{t,j}$ 是第 $t$ 步更新後的第 $j$ 個參數，$\theta_{t-1,j}$ 是更新前的值。

$\eta>0$ 是基礎學習率，$\epsilon>0$ 防止除零，$\alpha_{t,j}$ 是該座標的有效係數。

例如首步第一座標為 $1-0.1\times3/\sqrt{9+10^{-8}}\approx0.9$；先加本步平方，再算分母。

:::supplement[來源：PyTorch 2.9 Adagrad]
下方「算一次」與程式採 PyTorch 的根號外 ε 版本，參數更新與有效係數為：

$$
\alpha_{t,j}=\frac{\eta}{\sqrt{G_{t,j}}+\epsilon},\qquad
\theta_{t,j}=\theta_{t-1,j}-\alpha_{t,j}g_{t,j}
$$

同一個 ε 放在根號內、外，並不是完全相同的公式。平方和接近零時，不能直接假設差異可忽略。
:::

固定 $\eta$ 時，平方和不會減少，$\alpha$ 也不會增加。若本步梯度為零，即使係數很大，更新量仍為零。

**與指引的寫法差異**：本頁以 $\theta_{t-1}$、$\theta_t$ 表示更新前、後；指引 5-40 寫成 $\theta_t$、$\theta_{t+1}$。

兩者都在更新前的參數求梯度；另須辨認上述 ε 位置的差異。

## 算一次

共同初值為 $[1,-1]$，取 $\eta=0.1$、$\epsilon=10^{-8}$，梯度依序 $[3,4]$、$[-1,2]$。表內保留四位，過程不先取整。

| 步數 | 平方和 $G_t$ | 有效係數 $\alpha_t$ | 新參數 |
|---|---|---|---|
| 1 | [9,16] | [0.0333,0.0250] | [0.9000,−1.1000] |
| 2 | [10,20] | [0.0316,0.0224] | [0.9316,−1.1447] |

第一步第一座標為 $1-0.1\times3/(3+10^{-8})\approx0.9$。第二步扣除 $-0.1/(\sqrt{10}+10^{-8})$，參數增加約 0.0316。

### 換成稀疏梯度

:::supplement[來源：Dive into Deep Learning 12.7.1、12.7.3；PyTorch Adagrad]
只把第一步第二座標改成零，即 $[3,0]$、$[-1,2]$。這模擬第一個詞常出現、第二個詞較晚才出現，初值與其他設定不變。

| 步數 | 平方和 $G_t$ | 扣除量 | 新參數 |
|---|---|---|---|
| 1 | [9,0] | 約 [0.1,0] | 約 [0.9,−1] |
| 2 | [10,4] | 約 [−0.0316,0.1] | 約 [0.9316,−1.1] |

第二座標第一步完全不動，第二步的有效係數約為 0.05，大於第一座標約 0.0316。這是各座標自己的歷史造成的差異。
:::

## 程式（補充）

主序列逐步對照 NumPy、PyTorch 的平方和及參數。

```python
import numpy as np
import torch
q, G = np.array([1., -1.]), np.zeros(2)
p = torch.tensor(q, dtype=torch.float64, requires_grad=True)
opt = torch.optim.Adagrad([p], lr=.1, eps=1e-8, lr_decay=0, weight_decay=0)
for t, g in enumerate(([3., 4.], [-1., 2.]), 1):
    g = np.array(g)
    G = G + g * g
    q = q - .1 * g / (np.sqrt(G) + 1e-8)
    p.grad = torch.tensor(g)
    opt.step()
    same = np.allclose(q, p.detach().numpy())
    same &= np.allclose(G, opt.state[p]['sum'].numpy())
    print(t, G.tolist(), q.round(4).tolist(), bool(same))
```
```text
1 [9.0, 16.0] [0.9, -1.1] True
2 [10.0, 20.0] [0.9316, -1.1447] True
```

:::tip[讀碼重點]
先累積本步平方，再以新平方和更新。lr_decay=0 關閉另一種全域學習率衰減；此處變小的是逐座標有效係數。
:::

## 怎麼用、怎麼判讀

稀疏特徵或參數更新程度不均時，可以考慮 Adagrad。若訓練後期損失不再改善，要同時看梯度與有效係數，不能把步子很小直接當成已找到好解。

同一序列若後來一直只有小梯度，過往的大平方和仍留下來。RMSprop 用衰減平均淡化舊梯度，正是針對這類限制的另一種做法。

### 換個場景

| 場景 | 指引條件或資料特性 | 判讀重點 |
|---|---|---|
| 文字、自然語言處理 | 5-40 的稀疏特徵 | 常見與少見詞各有自己的平方和 |
| 特徵分佈／更新不均 | 3-25、5-40 的條件 | 比較各座標的歷史梯度大小 |
| 能源預測（補充） | 兩個連續特徵尺度不同 | 檢查分母，仍需合理前處理 |
| 文字分類（補充） | 本組常見詞每 4 筆、少見詞每 16 筆出現 | 梯度為零時不更新平方和 |
| 推薦系統（補充） | 少見項目的參數很久才被觸及 | 看更新頻率，也看梯度幅度 |

## 常見誤解

- 累積的是平方梯度，正負梯度不會互相抵銷。
- 有效係數較大，不保證實際移動量較大，還要乘當前梯度。
- 基本 Adagrad 不會因近期梯度變小就自動清掉舊平方和。
- 步長過小可能使訓練停滯，不等於模型已達最佳表現。

## 進階

### 參考來源

- 科目 3 指引：guide-3:3-25、guide-3:3-31、guide-3:5-40、guide-3:5-41（版本未標示）。

  支持平方累積與場景；5-40 支持正文的更新式及符號，已對照 PDF 確認 ε 在根號內。
- [PyTorch 2.9 Adagrad](https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adagrad.html)：支持零初始化、根號外 ε、lr_decay 與程式。
- [Dive into Deep Learning 12.7.1、12.7.3](https://d2l.ai/chapter_optimization/adagrad.html)：參考稀疏與密集座標對照的教法；該書與指引的 ε 都在根號內，下方表格採 PyTorch 根號外版本。

## 小結

- 每個參數有自己的梯度平方和，常更新的座標會縮小步伐。
- 先累積平方，再依正文的指引公式縮放更新；ε 在根號內。
- 有效係數與實際更新量不同；累積不會自動回復。
