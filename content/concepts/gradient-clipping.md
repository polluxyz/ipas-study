---
id: gradient-clipping
title: 梯度裁剪與迴圈位置
kind: technique
codes: [L23304, L23103, L23203]
aliases: [Gradient Clipping, clip_grad_norm_, clip_grad_value_, 梯度裁剪]
summary: 梯度裁剪在反傳後更新前限制梯度，降低過大梯度造成的不穩定
goals:
  - id: g1
    text: 將一般及自動混合精度（Automatic Mixed Precision，AMP）裁剪放在正確位置，區分梯度、損失與權重
  - id: g2
    text: 算出逐值與全域範數裁剪及SGD更新，說明方向與數值限制
requires: [gradient-descent]
guide_refs: [guide-3:3-27, guide-3:5-52]
formula_groups:
  - id: value-clipping
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.utils.clip_grad_value_.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-B
  - id: global-norm-clipping
    source: https://d2l.ai/chapter_recurrent-neural-networks/rnn-scratch.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源模型本批反傳產生梯度[3,4]。若要讓這一步SGD使用裁剪後梯度，順序應如何安排？
    options:
      A: 清梯度、前向與損失、裁剪、反傳、更新參數
      B: 清梯度、前向與損失、反傳、更新參數、裁剪
      C: 清梯度、前向與損失、反傳、裁剪、更新參數
      D: 前向與損失、反傳、清梯度、裁剪、更新參數
    answer: C
    explain:
      A: 本批反傳前尚未建立要裁剪的梯度。
      B: 已用原梯度更新，之後裁剪來不及影響該步。
      C: 先產生本批梯度，再限制它，最後交給優化器。
      D: 反傳後清梯度會移除這次要使用的梯度。
  - id: c2
    goal: g2
    type: choice
    prompt: 同一梯度[3,4]，逐值上限2與全域L2範數上限2各得到什麼？
    options:
      A: 逐值[2,2]，全域[1.2,1.6]
      B: 逐值[1.2,1.6]，全域[2,2]
      C: 逐值[2,2]，全域[0.6,0.8]
      D: 逐值[3,4]，全域[1.2,1.6]
    answer: A
    explain:
      A: 逐值各截到2，全域把長度5縮到2，兩分量同乘0.4。
      B: 兩種裁剪的結果被對調。
      C: 全域結果長度是1，相當於用了上限1。
      D: 逐值裁剪也必須限制超過2的分量。
  - id: c3
    goal: g1
    type: choice
    prompt: AMP把真梯度[3,4]放大8倍後反傳，要以真梯度範數上限2裁剪。正確安排為何？
    options:
      A: 先裁剪[24,32]到長度2，再unscale，最後直接更新
      B: 先更新[24,32]，再unscale並裁剪，最後更新scale
      C: 先裁剪loss到2再反傳，略過unscale後交給step
      D: 先unscale回[3,4]再裁剪，交scaler.step後更新scale
    answer: D
    explain:
      A: 裁剪後再除8，最終長度變0.25，等效上限被改了。
      B: 已先使用放大梯度更新，裁剪位置太晚。
      C: 限制loss數值與限制參數梯度的範數不同。
      D: 先還原才讓上限2具有原本梯度尺度的意義。
  - id: c4
    goal: g2
    type: choice
    prompt: 參數初值[1,-1]，梯度[3,4]裁到全域範數2，基本SGD學習率0.1。忽略浮點微差，更新後為何？
    options:
      A: '[0.7,-1.4]，因為裁剪只改損失顯示而不改梯度'
      B: '[0.88,-1.16]，因為從初值扣除0.1乘[1.2,1.6]'
      C: '[0.8,-1.2]，因為全域裁剪把每個分量都設為2'
      D: '[1.12,-0.84]，因為最小化要把裁後梯度加回初值'
    answer: B
    explain:
      A: 這是未裁剪的SGD結果，裁剪會直接改梯度。
      B: 裁後梯度同乘學習率再從原參數扣除。
      C: 逐分量截斷不是全域範數裁剪。
      D: 基本梯度下降要扣除梯度，不能改為相加。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

深層模型或RNN的梯度可能突然很大，使參數更新過頭。梯度裁剪（Gradient Clipping）限制過大的梯度，降低發散或數值不穩定的風險。

:::supplement[來源：PyTorch梯度裁剪API；Dive into Deep Learning 9.5.3]
裁剪作用在損失對參數的梯度，不是把損失本身改小。它也不是限制權重範圍；三者修改的量與後果不同。
:::

## 直覺

:::supplement[來源：Dive into Deep Learning 9.5.3；PyTorch clip_grad_value_]
把所有待更新參數的梯度接成一個向量。全域範數裁剪在它太長時整體縮短，逐值裁剪則分別截斷每個分量，可能改變方向。

![深色短線沿原向量縮到範數2；虛線逐值截斷後，方向與原來不同。](figure:l23304-gradient-clipping-vector)
:::

## 定義與公式

指引3-27以限制梯度最大值說明裁剪的用途，未分列逐值與全域範數兩種公式。以下補充兩種做法，實作時要確認上限限制的是分量還是整體長度。

### 逐值裁剪（補充）

$$
\widetilde g_i=\min(c,\max(-c,g_i)),\qquad c>0
$$

$g_i$是第$i$個梯度分量，$c$是每個分量的絕對值上限，$\widetilde g_i$是裁後梯度。它保證每一分量介於負$c$與正$c$，不保證整體長度不超過$c$。

### 全域範數裁剪（補充）

$$
r=\lVert g\rVert_2=\sqrt{\sum_i g_i^2},\qquad
\widetilde g=\begin{cases}g,&r\le\tau\\(\tau/r)g,&r>\tau\end{cases}
$$

$g$是本次一起裁剪的完整梯度，$r$是L2範數，$\tau>0$是全域長度上限。零向量走第一種情況，不需要除以零；非零向量同乘正係數，保留方向。

基本SGD再使用裁後梯度：

$$
\theta_{\mathrm{new}}=\theta-\eta\widetilde g
$$

$\theta$是舊參數，$\eta$是正學習率。此時更新長度不超過$\eta\tau$；動量法、Adam會再處理歷史與尺度，不能直接套用同一更新上限。

## 算一次（補充）

取$g=(3,4)$，$r=\sqrt{3^2+4^2}=5$。逐值上限2得到$(2,2)$，長度$\sqrt8\approx2.8284$，仍大於2。

全域取$\tau=2$，同乘$2/5=0.4$後為$(1.2,1.6)$，長度為2。由$(1,-1)$以學習率0.1更新後為$(0.88,-1.16)$。

若不裁剪，同一步SGD會到$(0.7,-1.4)$；若逐值裁剪則到$(0.8,-1.2)$。三個結果使用同一舊參數，只有裁剪設定不同。

## 程式（補充）

### 一般迴圈：反傳之後、更新之前（補充）

下例以線性教學損失產生指定梯度，只驗證位置與更新。執行前將`IPAS_REPO_ROOT`設為repo絕對路徑；同頁程式依序執行。

```python
import json, os
from pathlib import Path
import torch
torch.manual_seed(23103)
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23103-C-updates.json').read_text(encoding='utf-8'))
p = torch.nn.Parameter(torch.tensor(d['initial'], dtype=torch.float64))
g = torch.tensor(d['replay'][0], dtype=p.dtype)
opt = torch.optim.SGD([p], lr=d['lr'])
for _ in range(1):
    opt.zero_grad(set_to_none=True)
    loss = (p * g).sum(); loss.backward()
    before = torch.nn.utils.clip_grad_norm_([p], 2., error_if_nonfinite=True)
    print('裁前／裁後範數:', round(before.item(), 4), round(p.grad.norm().item(), 4))
    opt.step()
print('更新參數:', [round(v, 4) for v in p.tolist()])
```
```text
裁前／裁後範數: 5.0 2.0
更新參數: [0.88, -1.16]
```

`clip_grad_norm_`原地改`.grad`，回傳的是裁前總範數。實作為避免除零會有極小穩定項，這裡取小數4位與理想式比較。

![裁剪必須等反傳產生梯度；啟用AMP時，先還原尺度，再套用原單位的上限。](figure:l23304-gradient-clipping-order)

### AMP：先還原再裁剪（補充）

自動混合精度與梯度縮放的背景，可接著讀[[mixed-precision-training]]。

自動混合精度讓不同運算使用不同精度，詳見[混合精度訓練](/concepts/mixed-precision-training/)。啟用梯度縮放時，先還原梯度尺度，再裁剪。

下面在CPU使用真正啟用的GradScaler核對縮放流程，不量測GPU速度。刻意取初始縮放8，便於看見範數40還原為5；這是尺度測試，沒有宣稱CPU張量已改用FP16。

```python
q = torch.nn.Parameter(torch.tensor(d['initial'], dtype=torch.float32))
opt = torch.optim.SGD([q], lr=.1)
scaler = torch.amp.GradScaler('cpu', init_scale=8.)
opt.zero_grad(set_to_none=True)
loss = (q * g.float()).sum()
scaler.scale(loss).backward()
print('縮放後範數:', round(q.grad.norm().item(), 4))
scaler.unscale_(opt)
before = torch.nn.utils.clip_grad_norm_([q], 2., error_if_nonfinite=True)
scaler.step(opt)
scaler.update()
print('還原／裁後範數:', round(before.item(), 4), round(q.grad.norm().item(), 4))
print('更新參數:', [round(v, 4) for v in q.tolist()])
```
```text
縮放後範數: 40.0
還原／裁後範數: 5.0 2.0
更新參數: [0.88, -1.16]
```

:::tip[讀碼重點]
- 一般流程：backward、clip、step。
- AMP：scale(loss).backward、unscale_、clip、scaler.step、scaler.update。
- 本例省略autocast，只核對梯度縮放；實務上若使用autocast，只包前向與損失，反傳放在區塊外。
:::

多個小批次若累積成一次更新，等該次梯度全部累積完才還原、裁剪與更新。同一優化器每次更新前只呼叫一次`unscale_`，不能每個微批次都還原一次。

## 怎麼用、怎麼判讀

指引特別提醒RNN與深層模型的過大梯度風險。觀察梯度及訓練趨勢，和學習率、初始化等穩定策略一起安排。

:::supplement[來源：PyTorch梯度裁剪及AMP文件；Dive into Deep Learning 9.5.3]
記錄裁前範數、上限與觸發頻率；幾乎每一步都強烈縮小時，要查上限、損失縮放或資料尺度。上限是超參數，不是看到範數大於1就一定錯。

NaN也可能來自非法對數、除零、非有限輸入或低精度溢位。NaN梯度不能靠一般範數縮放修成有效方向；先定位第一個非有限值，必要時中止該步。
:::

### 換個場景

| 場景 | 梯度條件 | 判讀重點 |
|---|---|---|
| RNN與深層模型 | 反傳梯度過大 | 指引列為裁剪的主要情境 |
| 能源序列（補充） | 需求尖峰形成大梯度 | 先查輸入尺度與異常資料 |
| 客服長句（補充） | 長序列更新不穩 | 同時檢查長度與損失歸約 |
| 影像微調（補充） | 啟用梯度縮放 | 還原之後才按原尺度裁剪 |

## 常見誤解（補充）

- **損失很大就必須裁剪。** 梯度才是被限制的量；加一個大常數會提高損失而不改梯度。
- **裁剪後權重必在正負2之內。** 上限2約束的是梯度範數或分量，並不約束參數值。
- **每層各裁到2等於全網裁到2。** 分層上限不能保證串接後總長度也在2以內。
- **裁剪能解決所有NaN或梯度消失。** 它壓制過大梯度，不會補回消失訊號，也不修復非法運算。

## 進階

### 參考來源

- 科目3指引`guide-3:3-27`：支持RNN、深層網路及防止過大梯度的用途；`guide-3:5-52`僅支持混合精度的數值風險，AMP插入位置為補充。
- [PyTorch clip_grad_value_](https://docs.pytorch.org/docs/2.9/generated/torch.nn.utils.clip_grad_value_.html)：支持逐值公式、原地修改梯度。
- [PyTorch clip_grad_norm_](https://docs.pytorch.org/docs/2.9/generated/torch.nn.utils.clip_grad_norm_.html)：支持全域範數、回傳裁前值與非有限檢查。
- [PyTorch AMP範例](https://docs.pytorch.org/docs/2.9/notes/amp_examples.html)：支持還原、裁剪、更新與梯度累積的順序。
- [Dive into Deep Learning 9.5.3](https://d2l.ai/chapter_recurrent-neural-networks/rnn-scratch.html)：支持向量縮放公式、方向與RNN教學說明。

## 小結

- 梯度裁剪限制過大梯度，降低訓練不穩定風險。
- 逐值截斷與全域縮放的方向、長度保證不同。（補充）
- 位置是反傳後更新前；AMP先還原尺度。（補充）
- 裁剪不直接限制損失或權重，也不修復所有非有限運算。（補充）
