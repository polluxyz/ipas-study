---
id: mixed-precision-training
title: 混合精度訓練
kind: technique
codes: [L23304, L23203]
aliases: [AMP, Gradient Scaling, Mixed Precision]
summary: 混合精度訓練讓不同運算使用合適精度，省資源時仍須管理梯度尺度
goals:
  - id: g1
    text: 區分混合精度訓練與低精度推論，估算部分記憶體並辨識數值風險
  - id: g2
    text: 安排 scale、backward、unscale、clip 與 step，避免重複還原尺度
requires: [model-resource-costs]
contrasts:
  - target: quantization
    note: 混合精度訓練調整訓練運算的精度分工；量化改低精度表示以改善部署成本
    source: [guide-3:5-51, guide-3:5-52]
guide_refs: [guide-3:5-51, guide-3:5-52]
formula_groups:
  - id: partial-memory
    source: https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html ; https://docs.nvidia.com/deeplearning/performance/mixed-precision-training/index.html
    status: pending
    checked_by: null
  - id: scaled-gradient
    source: https://docs.nvidia.com/deeplearning/performance/mixed-precision-training/index.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 教學分類頭 43 個權重與偏置，權重、梯度都留 FP32；120 個激活改 FP16。只計這三類張量，容量如何變化？
    options:
      A: 824 變 584 bytes；權重與梯度的 344 bytes 沒有減半
      B: 824 變 412 bytes；權重與梯度也會跟著激活一起減半
      C: 824 變 240 bytes；只要保留激活便能完成所有更新
      D: 824 變 172 bytes；訓練只需要保存一份模型參數
    answer: A
    explain:
      A: 原來 344＋480，改後 344＋240；尚未計優化器與其他暫存。
      B: 題目明定權重與梯度仍用 FP32，不能一律除二。
      C: 激活不是全部訓練狀態，仍須權重與梯度。
      D: 172 只是一份參數容量，漏掉題目其他張量。
  - id: c2
    goal: g2
    type: choice
    prompt: 損失放大 1024 倍後反向，參數梯度為 4096；原尺度裁剪門檻為 1。哪個更新前處理正確？
    options:
      A: 先把 4096 裁到 1，再除以 1024，得到約 0.000977
      B: 先把 4096 乘以 1024，再裁到 1，得到更新梯度 1
      C: 先把 4096 除以 1024 得 4，再裁到 1，供優化器使用
      D: 直接用 4096 更新參數，再把新權重除以 1024 還原
    answer: C
    explain:
      A: 在放大尺度用原門檻裁剪，會把真實梯度錯誤壓得過小。
      B: 再乘尺度不能還原原始梯度，數值等於 1 只是裁剪掩蓋了錯誤。
      C: 先還原尺度，再按原尺度門檻裁剪，順序一致。
      D: 權重不是被放大的梯度，不能在更新後把權重除以尺度。
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊開啟混合精度後，模型參數仍是 FP32，準備在 CPU 部署 INT8 推論。哪項說法正確？
    options:
      A: 訓練曾用 FP16，所以匯出的所有權重已自然成為 INT8
      B: 訓練曾用 FP16，所以任何 CPU 都會得到同樣的加速
      C: 訓練曾用縮放，所以部署後每筆輸入也必須放大 1024 倍
      D: 訓練精度分工不等於 INT8 成品，部署轉換和效能須另驗收
    answer: D
    explain:
      A: 浮點混合精度不會自動產生整數量化模型。
      B: 不同硬體及算子支援會改變效益。
      C: 損失縮放管理訓練梯度，不是部署輸入的倍數。
      D: 訓練與部署是不同階段，INT8 轉換另有流程與限制。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

混合精度訓練（Mixed precision training）讓部分訓練運算用 FP16，其餘保留 FP32。這樣可減少大量矩陣運算與中間值的成本。

它適合有低精度運算支援的硬體，可容納更大批次或更深模型。缺少相應硬體時，效益可能有限；低精度帶來的數值風險也需處理，例如訓練時的梯度縮放（Gradient scaling）。

例如 NVIDIA GPU 的 Tensor Cores 可支援混合精度運算；實際效益仍取決於模型使用的算子。

## 直覺

重複而大量的運算使用較低精度，對數值敏感的部分保留較高精度。這是訓練過程的精度分工，與部署時把參數改成 INT8 的模型量化有不同目的。

![低精度和高精度在同一次訓練合作；不是把整個模型所有步驟都改成低精度。](figure:l23304-mixed-precision-training-roles)

:::supplement[來源：PyTorch torch.amp；NVIDIA Train With Mixed Precision]
自動混合精度（Automatic mixed precision，AMP）按算子決定精度。常見 PyTorch 用法保留 FP32 參數；整個模型手動轉低精度不等於自動保護。
:::

## 定義與公式（補充）

### 只盤點指定張量

若 $P$ 個參數及其梯度留 FP32，$A$ 個激活值從 FP32 改成 FP16：

$$
B_{32}=8P+4A,\qquad B_{\mathrm{mixed}}=8P+2A.
$$

$B$ 是 bytes；一份 FP32 參數加一份 FP32 梯度共 $8P$ bytes。$A$ 是本例要保存的激活元素數，不是所有中間值。

依 Tensor.nbytes 逐類盤點，全 FP32 為 $P\times4+P\times4+A\times4$，只改激活則為 $P\times4+P\times4+A\times2$。

這是本頁按儲存假設自行推得的盤點，不是 NVIDIA 指南直接列出的容量式。

這是由各類張量位元數相加的部分盤點，排除優化器狀態、輸入、工作區及配置器開銷。實際峰值要量測，也不能假定每個激活都適合 FP16。

### 放大後再還原

令原始損失為 $L$、正尺度為 $S$，參數為 $\theta$，梯度為 $g$：

$$
\widetilde L=SL,\qquad
\widetilde g=\nabla_\theta\widetilde L=Sg,\qquad
g=\widetilde g/S.
$$

$\widetilde L$、$\widetilde g$ 是放大後的損失與梯度。本次反向把 $S$ 當固定常數，更新前把梯度還原；不能把已更新的權重除以 $S$。

縮放幫助小梯度避開 FP16 下溢，但尺度太大也可能使梯度溢位。自動尺度管理會檢查非有限值，必要時略過該次更新並調低尺度。

## 算一次（補充）

共用分類頭有 43 個參數，另盤點 120 個激活值。權重加梯度為 8×43＝344 bytes；激活從 4×120＝480 變成 2×120＝240 bytes。

所以指定三類張量合計從 824 降到 584 bytes，少了 240 bytes。這不是訓練峰值，也不是全部記憶體減半；法律摘要長文還可能保存更多激活。

FP16 最小正次正規值約為 $2^{-24}$，即 5.96×10⁻⁸。梯度 10⁻⁸ 直接存成 FP16 會成零；先乘 1024 得 1.024×10⁻⁵，可避免本例下溢。

還原仍會有捨入誤差，不是重新得到無限精度的梯度。這也不表示 BF16 必須用同樣縮放；BF16 的指數範圍較大，常不需梯度縮放。

### 更新順序（補充）

![先還原梯度尺度再裁剪；scaler.step 已知道還原完成，不要手動再除一次。](figure:l23304-mixed-precision-training-order)

若單一權重的原梯度為 4，縮放後為 4096。先除以 1024 得 4，再依原尺度門檻 1 做梯度裁剪；無動量 SGD、學習率 0.1 時，權重從 2 變成約 1.9。

## 程式（補充）

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

第一段核算 FP16 下溢；第二段用單一權重縮小驗證更新時序，並非重訓前述 43 參數分類頭。

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23304-E-compression.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
r = d['amp']
g = torch.tensor(r['gradient'], dtype=torch.float32)
scaled16 = (g * r['scale']).half()
print(f'直接 FP16={g.half().item():.1e}')
print(f'先放大再存 FP16={scaled16.item():.6e}')
print(f'FP32 還原={scaled16.float().item() / r["scale"]:.6e}')
```
```text
直接 FP16=0.0e+00
先放大再存 FP16=1.025200e-05
FP32 還原=1.001172e-08
```

CPU 以 BF16 autocast 執行；這裡刻意啟用 CPU GradScaler 來驗證介面時序，不代表 BF16 通常需要縮放。GPU FP16 的速度與穩定性仍要在對應 GPU 實測。

```python
m = torch.nn.Linear(1, 1, bias=False)
with torch.no_grad():
    m.weight.fill_(2.0)
opt = torch.optim.SGD(m.parameters(), lr=r['learning_rate'])
scaler = torch.amp.GradScaler('cpu', init_scale=r['scale'])
with torch.autocast(device_type='cpu', dtype=torch.bfloat16):
    loss = m(torch.ones(1, 1)).float().square().mean()
scaler.scale(loss).backward()
print(f'放大梯度={m.weight.grad.item():.0f}')
scaler.unscale_(opt)
print(f'還原梯度={m.weight.grad.item():.0f}')
torch.nn.utils.clip_grad_norm_(m.parameters(), r['clip_norm'])
scaler.step(opt)
scaler.update()
print(f'更新權重={m.weight.item():.3f}')
```
```text
放大梯度=4096
還原梯度=4
更新權重=1.900
```

:::tip[讀碼重點]
`unscale_` 對同個優化器每次更新只呼叫一次，且在 `clip_grad_norm_` 前。接著 `scaler.step` 不會再除一次尺度；`scaler.update` 才管理下一次尺度。

這裡只做新模型的第一次更新，尚無舊梯度；重複訓練時仍須在每步反向前清除前一步梯度。
:::

## 怎麼用、怎麼判讀

先確認硬體與運算支援，再檢查訓練速度、記憶體和效果。遇到非有限損失或梯度時，要查數值範圍及敏感算子，不能因為程式能跑就視為可靠。

:::supplement[來源：PyTorch AMP Recipe；torch.amp]
比較速度時固定模型、批次和資料，記錄暖機與同步條件。`autocast` 管算子精度，`GradScaler` 管梯度尺度；兩個工具分工不同，也不會自動產出 INT8 部署模型。
:::

### 換個場景

| 場景 | 條件 | 判讀重點 |
|---|---|---|
| 深層模型、大批次訓練 | GPU 有低精度支援、記憶體受限 | 速度與效果是否兼顧 |
| 行動影像模型的離線訓練（補充） | 在伺服器訓練，再放到手機 | 訓練節省不等於手機推論加速 |
| 法律摘要長文訓練（補充） | 序列較長、激活占用大 | 固定長度比較記憶體，留意溢位 |

## 常見誤解

- 「混合精度只是全改 FP16」：關鍵在不同運算的精度分工。
- 「硬體更新就一定更準」：數值精度改變仍可能造成不穩定。
- 「任何模型開啟混合精度都直接有效」：各演算法與算子的適用性不同，仍須驗證數值穩定性與訓練效果。
- 「縮放後直接裁剪也一樣」：原尺度的門檻不能直接套在放大梯度上。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-51`～`guide-3:5-52`：精度分工、批次與深度需求、硬體支援、梯度縮放風險。
- [PyTorch torch.amp](https://docs.pytorch.org/docs/2.15/amp.html)：autocast 與 GradScaler 分工、CPU 介面、低精度格式差異，支持程式及邊界條件。
- [PyTorch AMP 實作教學](https://docs.pytorch.org/tutorials/recipes/recipes/amp_recipe.html)：unscale、裁剪、step 的先後，支持更新順序與讀碼重點。
- [NVIDIA 混合精度訓練指南 2.1、2.3](https://docs.nvidia.com/deeplearning/performance/mixed-precision-training/index.html)：FP16 範圍、損失縮放及溢位，支持數值算例與記憶體盤點思路。
- [PyTorch Tensor.nbytes](https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html)：密集張量的元素數乘每元素 bytes，支持指定參數、梯度與激活的部分盤點推導。

## 小結

- 混合精度用不同精度合作，效益取決於硬體與工作負載。
- 記憶體要按張量類型盤點，不能一律減半。（補充）
- 先 scale 與 backward，再 unscale、clip、step、update。（補充）
