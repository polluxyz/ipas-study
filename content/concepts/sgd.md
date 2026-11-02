---
id: sgd
title: 隨機梯度下降
kind: technique
codes: [L23103, L23304]
aliases: [Stochastic Gradient Descent]
summary: 隨機梯度下降以單筆或小批次梯度估計方向，再扣除學習率乘梯度
goals:
  - id: g1
    text: 計算二維 SGD 更新，解釋學習率與單筆、小批次梯度的差異
requires: [gradient-descent]
guide_refs: [guide-3:3-24, guide-3:5-18, guide-3:5-39]
formula_groups:
  - id: sgd-update
    source: guide-3:5-39
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-C
  - id: batch-gradient
    source: https://d2l.ai/chapter_optimization/minibatch-sgd.html#minibatches
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源模型的參數為 [1,−1]，目前梯度 [3,4]，學習率 0.1。一次最小化更新後為何？
    options:
      A: '[1.3,−0.6]'
      B: '[0.7,−1.4]'
      C: '[−2,−5]'
      D: '[0.9,−1.1]'
    answer: B
    explain:
      A: 這是把學習率乘梯度加回去，方向相反。
      B: 從舊參數分別扣除 0.3 與 0.4，即得新參數。
      C: 這是直接扣除梯度，漏乘學習率。
      D: 這把梯度大小消除了，基本 SGD 沒有這個正規化步驟。
  - id: c2
    goal: g1
    type: choice
    prompt: 在同一參數 [1,−1]，兩筆樣本的梯度為 [3,4] 與 [−1,2]。若以平均損失組成一批、學習率為 0.1，更新後為何？
    options:
      A: '[0.8,−1.6]'
      B: '[0.7,−1.4]'
      C: '[1.1,−1.2]'
      D: '[0.9,−1.3]'
    answer: D
    explain:
      A: 這用梯度總和 [2,6]，與平均損失的定義不符。
      B: 這只採用了第一筆梯度。
      C: 這只採用了第二筆梯度。
      D: 兩筆梯度平均為 [1,3]，一次扣除 [0.1,0.3]。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

每更新一次就掃過全部資料，可能要等很久。隨機梯度下降（SGD）先用少量資料估計方向，讓參數更頻繁地更新。

它的計算與額外記憶體需求低，但單次估計容易波動。學習率（Learning Rate）過大會走過頭，太小則進展緩慢。

## 直覺

每筆樣本都對目前模型提出修正方向。單筆更新立刻採用其中一筆的意見；小批次梯度下降先綜合一批的意見，再更新一次。

指引第 3 章把 SGD 限定為單筆，第 5 章也把小批次納入 SGD 的用法。本頁談取樣時明寫單筆或小批次；談更新器時則指沒有動量的基本規則。

:::supplement[來源：Dive into Deep Learning 12.4.1]
兩筆梯度若在同一舊參數算出，才可以直接平均成一批。連續更新兩次時，第二筆應在新的參數重新算梯度，通常不能把兩步結果當成一次批次更新。
:::

## 定義與公式

一次更新寫成：

$$
\theta_t=\theta_{t-1}-\eta g_t
$$

$\theta_{t-1}$ 是更新前的參數向量，$t$ 從 1 開始，$g_t$ 是這一步資料的損失梯度，$\eta>0$ 是學習率。最小化時使用減號；梯度大小也會影響實際移動量。

:::supplement[來源：Dive into Deep Learning 12.5.2]
若每批採用平均損失，梯度也取平均：

$$
g_t=\frac{1}{|B_t|}\sum_{i\in B_t}\nabla_\theta\ell_i(\theta_{t-1})
$$

$B_t$ 是這一步的樣本索引集合，$|B_t|$ 是筆數，$\ell_i$ 是第 $i$ 筆損失。單筆時 $|B_t|=1$；兩筆梯度 $[3,4]$、$[-1,2]$ 的平均是 $[1,3]$。
:::

**與指引的寫法差異**：本頁以 $\theta_{t-1}$、$\theta_t$ 表示更新前、後；指引 5-39 寫成 $\theta_t$、$\theta_{t+1}$。

兩者都在更新前的參數求梯度，只是步數編號不同。

## 算一次

全組使用教學合成資料：能源與文字分類各 128 筆，固定留出 96 筆訓練、16 筆驗證、16 筆測試。訓練資料固定種子 23103 排序，每批 16 筆，一輪共六批。

先只看更新機制：初值 $\theta_0=[1,-1]$、學習率 0.1，依序重播 $g_1=[3,4]$、$g_2=[-1,2]$。

| 步數 | 梯度 | 扣除量 | 新參數 |
|---|---|---|---|
| 1 | [3,4] | [0.3,0.4] | [0.7,−1.4] |
| 2 | [−1,2] | [−0.1,0.2] | [0.8,−1.6] |

第一步扣除 $0.1[3,4]$；第二步第一座標扣除負數，所以由 0.7 增至 0.8。學習率改成 0.05 時，同一梯度的扣除量減半。

:::supplement[來源：Dive into Deep Learning 12.4.1]
能源資料第 0、1 筆在同一初值的梯度恰為上述兩個向量。把兩筆當一批時，平均梯度 $[1,3]$ 只更新一次，得到 $[0.9,-1.3]$。

上表第二步是指定梯度的重播，並未重算模型梯度。它可核對更新器，不能拿來證明某方法在能源或文字任務收斂較快。
:::

## 程式（補充）

以下直接指定梯度，逐步對照基本更新與 PyTorch；不進行模型訓練。

```python
import numpy as np
import torch
q = np.array([1., -1.])
p = torch.tensor(q, dtype=torch.float64, requires_grad=True)
opt = torch.optim.SGD([p], lr=.1, momentum=0, weight_decay=0)
for t, g in enumerate(([3., 4.], [-1., 2.]), 1):
    g = np.array(g)
    q = q - .1 * g
    p.grad = torch.tensor(g)
    opt.step()
    print(t, q.round(4).tolist(), np.allclose(q, p.detach().numpy()))
```
```text
1 [0.7, -1.4] True
2 [0.8, -1.6] True
```

:::tip[讀碼重點]
這裡每步覆寫 p.grad，故沒有累積舊梯度。正常訓練要先清梯度、計算損失、反向傳播，再 step；優化器本身不負責抽樣。
:::

### 兩個領域的梯度來源

改用真實的損失計算梯度：能源取資料第 0、1 筆的平均平方殘差一半；文字取第 0 筆、兩個詞都出現且標籤為 1。各自都從同一初值開始。

文字這筆的預測機率為 0.5，交叉熵梯度是 $[-0.5,-0.5]$。學習率 0.1 使兩個詞的權重都增加 0.05；梯度隨任務、損失與資料而改變，更新規則相同。

```python
import torch
for domain in ('energy', 'text'):
    p = torch.tensor([1., -1.], dtype=torch.float64, requires_grad=True)
    if domain == 'energy':
        x = torch.tensor([[3., 4.], [-1., 2.]], dtype=torch.float64)
        y = torch.tensor([-2., -4.], dtype=torch.float64)
        loss = ((x @ p - y)**2).mean() / 2
    else:
        logit = p.sum()
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logit, torch.tensor(1.))
    g, = torch.autograd.grad(loss, p)
    new = p.detach() - .1 * g
    print(domain, g.tolist(), new.tolist())
```
```text
energy [1.0, 3.0] [0.9, -1.3]
text [-0.5, -0.5] [1.05, -0.95]
```

## 怎麼用、怎麼判讀

觀察一段訓練的趨勢，不要要求每次單筆更新都降低完整訓練損失。SGD 對學習率敏感；若持續震盪，先檢查尺度與學習率，再考慮動量法。

### 換個場景

| 場景 | 指引條件或資料特性 | 判讀重點 |
|---|---|---|
| 大型資料、線上與即時訓練 | 3-24、5-18 的單筆情境 | 每步成本低，但方向波動大 |
| 小型／淺層模型、較少資料 | 5-39 的適用範圍 | 基本規則簡單，不代表僅能用小資料 |
| 記憶體有限 | 5-39 的適用範圍 | 無須另外保存動量或平方累積 |
| 能源預測（補充） | 本組 128 筆轉換後特徵 | 比較時固定切分與批次索引 |
| 文字分類（補充） | 本組 128 筆稀疏詞特徵 | 留意少見詞參數更新頻率 |
| 製造檢測（補充） | 新樣本逐筆到達 | 將資料流與離線評估分開 |

## 常見誤解

- SGD 不等於每次使用全部資料；要看單筆或小批次的具體取樣方式。
- 更新快不表示達到指定驗證表現的總時間必然短。
- PyTorch 的 SGD 名稱不會替你決定批次大小。（補充）
- 指定梯度的兩步重播，只檢查算式，不是完整訓練。（補充）

## 進階

### 參考來源

- 科目 3 指引（版本未標示）：guide-3:3-24、guide-3:5-18、guide-3:5-39，支持取樣、更新式及場景；5-39 已對照 PDF。
- [PyTorch 2.9 SGD](https://docs.pytorch.org/docs/2.9/generated/torch.optim.SGD.html)：支持程式設定、梯度輸入與基本更新。
- [Dive into Deep Learning 12.4.1](https://d2l.ai/chapter_optimization/sgd.html)：支持同一參數點的比較與重播界線；參考以少量資料估計完整方向的教法。
- [Dive into Deep Learning 12.5.2](https://d2l.ai/chapter_optimization/minibatch-sgd.html#minibatches)：支持小批次的平均梯度公式。
- [PyTorch 二元交叉熵 logits API](https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.binary_cross_entropy_with_logits.html)：支持兩領域程式中的文字分類損失。

## 小結

- 單筆或小批次估計梯度，再扣除學習率乘梯度。
- 學習率控制縮放，實際移動量也取決於梯度。
- 比較批次平均時，各筆梯度必須在同一參數點計算。（補充）
