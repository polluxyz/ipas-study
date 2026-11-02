---
id: backpropagation
title: 反向傳播與鏈鎖律
kind: technique
codes:
  - L23203
aliases:
  - Chain Rule
summary: 反向傳播沿計算圖用鏈鎖律求梯度，優化器讀取梯度後才更新參數
goals:
  - id: g1
    text: 區分前向、反向求梯度與優化器更新的輸入輸出，判斷梯度方向
  - id: g2
    text: 手算雙層網路梯度，對照 Autograd 並核對 backward 與 step 前後的參數
requires:
  - forward-propagation
  - gradient-descent
  - cross-entropy-loss
guide_refs:
  - guide-3:4-59
  - guide-3:4-60
  - guide-3:4-61
  - guide-3:5-39
textbook: v2
author: codex
status: draft
formula_groups:
  - id: chain-rule
    source: https://d2l.ai/chapter_multilayer-perceptrons/backprop.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
  - id: binary-chain
    source: https://cs229.stanford.edu/notes2022fall/main_notes.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-A
  - id: sgd-update
    source: https://docs.pytorch.org/docs/2.15/generated/torch.optim.SGD.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一個權重原為 1.0，呼叫 loss.backward() 後 grad=−0.4，尚未執行 optimizer.step()。哪個描述正確？
    options:
      A: 權重仍為 1.0；反向只把梯度算出並存下
      B: 權重自動變成 1.4
      C: 梯度為負表示應降低權重才會局部下降
      D: 必須重新給標籤才能讀出已計算梯度
    answer: A
    explain:
      A: 求梯度與參數更新是兩個不同操作。
      B: 這相當於先以學習率 1 減去梯度，但 backward 尚未更新權重。
      C: 對最小化的基本 SGD，負梯度會使權重增加。
      D: 梯度已由該次損失計算完成，讀取不需再次提供標籤。
  - id: c2
    goal: g2
    type: choice
    prompt: 製造樣本 x=(1,0)、y=1；隱藏表示 h=(0.75,0)，輸出機率約 0.562177。輸出第一個權重的梯度約是多少？
    options:
      A: −0.437823
      B: "0.421633"
      C: −0.328368
      D: "0"
    answer: C
    explain:
      A: 這是對輸出加權和的梯度，尚未乘上 h1。
      B: 這把機率直接乘 h1，漏掉與真實標籤的差。
      C: 先算 p−y≈−0.437823，再乘 h1=0.75。
      D: 第一個隱藏輸出非零，此路徑會有梯度。
  - id: c3
    goal: g2
    type: choice
    prompt: 同一樣本對 W1 第一列第一個權重的梯度為 −0.437823，舊值 1.0。用無動量、無正則化 SGD、學習率 0.1，一步後約為何？
    options:
      A: "0.956218"
      B: "1.043782"
      C: "1.437823"
      D: −0.043782
    answer: B
    explain:
      A: 這沿正梯度相加，方向與最小化更新相反。
      B: 新值為 1−0.1×(−0.437823)，所以增加至約 1.043782。
      C: 這忘了乘學習率 0.1。
      D: 這只算學習率乘梯度，符號與實際改變量相反，也未加回舊權重。
---

## 為什麼需要

前向傳播算出預測後，還要知道每個參數如何影響損失。反向傳播（Backpropagation）利用鏈鎖律（Chain Rule），沿運算相反方向計算梯度。

反向傳播的產物是梯度。優化器再讀取梯度與學習率，調整參數；這兩項責任要分開看。

## 直覺

每一層接收後層傳回的梯度，乘上本層局部導數，再往前一層傳。前向時留下的中間值，會在求導時重新用到。

![虛線表示梯度的回傳與使用；算梯度的方框和改參數的方框分開，最後才回到下一次前向。](figure:l23203-backpropagation-cycle)

| 步驟 | 輸入 | 輸出 | 參數是否改變 |
|---|---|---|---|
| 前向與損失 | 輸入、參數、標籤 | 預測、中間值、損失 | 否 |
| 反向求導 | 損失與計算圖 | 各參數的梯度 | 否 |
| 優化器更新 | 舊參數、梯度、設定 | 新參數 | 是 |

:::supplement[來源：Dive into Deep Learning 5.3；PyTorch Autograd 教學]
指引 4-60 把梯度比作指向最快下坡的方向，需要校正：在一般歐氏幾何下，梯度指向局部最陡上升，負梯度才是下降方向。步長過大仍可能讓更新後損失增加。
:::

## 定義與公式

### 一條路徑的鏈鎖律（補充）

若參數 $w$ 先影響中間值 $u$，再影響損失 $L$：

$$
\frac{\partial L}{\partial w}
=\frac{\partial L}{\partial u}\frac{\partial u}{\partial w}
$$

$\partial$ 表偏導，求導時其他獨立參數保持不變。有多條路徑從 $w$ 通向 $L$，各路徑的貢獻要相加，不能只挑一條。

### 本例的輸出梯度（補充）

本例只取標籤 $y=1$ 的一筆資料。對輸出加權和 $z_2$、機率 $p=\sigma(z_2)$，二元交叉熵為 $L=-\ln p$：

$$
\frac{\partial L}{\partial z_2}
=\left(-\frac1p\right)p(1-p)=p-1
$$

$\ln$ 是自然對數，$p(1-p)$ 是 Sigmoid 對 $z_2$ 的局部導數。本式是單筆損失，沒有做批次平均；若用批次平均，梯度尺度也要跟著平均。

CS229 2.1 先對對數概似求導；本頁改用負對數概似作損失，所以導數符號相反。取 $y=1$ 後，就得到上式。

### 梯度到更新

科目 3 指引 4-61 說明取得梯度後沿反方向更新，5-39 列出 SGD 更新式。無動量、無權重衰減時採用：

$$
\theta_{\mathrm{new}}=\theta_{\mathrm{old}}-\eta\nabla_\theta L
$$

$\theta$ 收集所有權重與偏置，$\eta>0$ 是學習率，$\nabla_\theta L$ 收集同一舊位置的偏導。

:::supplement[來源：科目 3 指引 5-39 的歷史狀態說明；PyTorch SGD 的適用條件]
Adam 等優化器還會用歷史狀態，不能一律當成此式。
:::

## 算一次（補充）

製造索引 1 的 $x=(1,0)$、$y=1$。前向頁算得 $h=(0.75,0)$、$z_2=0.25$，機率約 0.562177，損失約 0.575939。

令 $\delta=p-1\approx-0.437823$。輸出層權重向量記為 $v=(1,-2)$，它就是 $W_2$ 唯一的一列；輸出偏置為 $b_2$。

| 參數 | 梯度規則 | 代入結果（約） |
|---|---|---|
| $v_1$ | $\delta h_1$ | $-0.328368$ |
| $v_2$ | $\delta h_2$ | $0$ |
| $b_2$ | $\delta$ | $-0.437823$ |

把梯度傳回第一個隱藏單元：它的加權和為正，ReLU 局部導數為 1。對 $W_1$ 的第一列第一個權重，逐段相乘：

$$
\frac{\partial L}{\partial w_{11}}
=\delta\,v_1\,\phi'(z_{1,1})\,x_1
=(-0.437823)\times1\times1\times1
\approx-0.437823
$$

$w_{11}$ 是第一個隱藏單元對第一個輸入的權重；$z_{1,1}$ 是該單元的加權和，$\phi'$ 是 ReLU 的局部導數。第二個輸入為零，所以同列第二個權重梯度為零。

第二個隱藏單元的加權和為負，ReLU 導數為零，因此本筆對它的權重與偏置梯度都為零。第一層偏置梯度則為 $(-0.437823,0)$。

取學習率 0.1，$w_{11}$ 從 1 變為約 1.043782，輸出權重 $v_1$ 從 1 變為約 1.032837。這兩個梯度都為負，基本 SGD 因此增加它們。

## 程式（補充）

兩段程式接續執行。第一段使用同一參數與樣本，以 Autograd 對照手算；所有數值固定，沒有亂數。

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
n = d["network"]
t = lambda v: torch.tensor(v, dtype=torch.float64, requires_grad=True)
W1, b1, W2, b2 = [t(n[k]) for k in ["W1", "b1", "W2", "b2"]]
x = torch.tensor(d["manufacturing"]["rows"][1]["x"], dtype=torch.float64)
opt = torch.optim.SGD([W1, b1, W2, b2], lr=d["learning_rate"])
old = W1.detach().clone()
opt.zero_grad()
z = W2 @ torch.relu(W1 @ x + b1) + b2
loss = torch.nn.functional.binary_cross_entropy_with_logits(z, torch.ones_like(z))
loss.backward()
print(f"損失={loss.item():.6f}, backward 後權重未變={torch.equal(W1.detach(), old)}")
```
```text
損失=0.575939, backward 後權重未變=True
```

第二段讀取已算出的梯度，再執行更新。`step()` 前後各印一次同一權重，避免把求導誤認為更新。

```python
print("W1 梯度:", [[round(v, 6) for v in row] for row in W1.grad.tolist()])
print("W2 梯度:", [[round(v, 6) for v in row] for row in W2.grad.tolist()])
print(f"step 前 w11={W1[0, 0].item():.6f}")
opt.step()
print(f"step 後 w11={W1[0, 0].item():.6f}, v1={W2[0, 0].item():.6f}")
with torch.no_grad():
    new_z = W2 @ torch.relu(W1 @ x + b1) + b2
    new_loss = torch.nn.functional.binary_cross_entropy_with_logits(new_z, torch.ones_like(new_z))
print("本筆損失下降:", new_loss.item() < loss.item())
```
```text
W1 梯度: [[-0.437823, -0.0], [0.0, 0.0]]
W2 梯度: [[-0.328368, -0.0]]
step 前 w11=1.000000
step 後 w11=1.043782, v1=1.032837
本筆損失下降: True
```

:::tip[讀碼重點]
`zero_grad()` 清掉舊梯度；`backward()` 寫入 `.grad`；`step()` 才更動參數。輸出的 `-0.0` 是浮點數負零，數值等於 0。

本例損失下降只描述這一筆、這一步，不是對未見資料的保證。
:::

## 怎麼用、怎麼判讀

指引的訓練循環包含預測、損失、梯度與更新。讀程式時逐步指出目前有哪個產物，才能分辨模型只是完成推論，還是已經做完一次學習。

:::supplement[來源：PyTorch Autograd 教學；Dive into Deep Learning 5.3]
梯度為零可能來自輸入為零、激活阻斷或其他路徑抵消，不能直接認定整個模型已收斂。多筆梯度可能互相抵消；每次更新前要清楚採用總和還是平均。
:::

### 換個場景

| 場景 | 求梯度時依據 | 判讀重點 |
|---|---|---|
| 神經網路訓練 | 損失、局部導數、中間值 | 求梯度後才交給優化器 |
| 製造瑕疵（補充） | 本例一筆二元交叉熵 | 本筆零梯度不等於全資料無誤 |
| 零售流失（補充） | 同一轉換與網路結構 | 欄位一致才有相同梯度語意 |
| 醫療影像（補充） | 影像網路的多層計算圖 | 求導機制相同，資料與記憶體成本更高 |

## 常見誤解

- 「反向傳播直接把標籤倒送回輸入。」回傳的是梯度，不是把標籤當成原始輸入。
- 「梯度就是下坡方向。」最小化時，基本梯度下降沿負梯度。（補充）
- 「呼叫 backward 就已完成權重更新。」還要執行優化器更新。

## 進階

### 參考來源

- 科目 3 指引 4-59～4-61：支持訓練循環、鏈鎖律與求梯度後更新；已回 PDF 核對方向說明。5-39 支持 SGD 更新公式。
- [Dive into Deep Learning 5.3](https://d2l.ai/chapter_multilayer-perceptrons/backprop.html)：支持鏈鎖律、多路徑貢獻與逐層求導。
- [PyTorch Autograd 教學](https://docs.pytorch.org/tutorials/beginner/blitz/autograd_tutorial.html)：支持 `.grad`、`backward()` 與 `step()` 分工。
- [Stanford CS229 2.1～2.2](https://cs229.stanford.edu/notes2022fall/main_notes.pdf)，印刷頁 21～23：支持 Sigmoid 局部導數及對數概似的求導；改取負對數概似、令標籤為 1，即得本例輸出梯度。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.15/generated/torch.nn.BCEWithLogitsLoss.html)：支持二元損失與程式；[SGD](https://docs.pytorch.org/docs/2.15/generated/torch.optim.SGD.html)支持基本更新條件。

## 小結

- 前向產生預測，反向依鏈鎖律計算梯度。
- 梯度與參數更新的輸入輸出不同。
- 基本 SGD 要以舊參數減去學習率乘梯度。
- 手算、Autograd 與更新前後數值應能互相核對。（補充）
