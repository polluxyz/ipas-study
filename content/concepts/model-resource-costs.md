---
id: model-resource-costs
title: 模型參數、運算量與訓練記憶體
kind: technique
codes: [L23203]
aliases: [FLOPs, MACs, Parameter Count, Trainable Parameters]
summary: 參數量、運算量和記憶體各量一件事，模型摘要只能回答其中一部分
requires: [mlp, convolution-layer]
guide_refs: [guide-3:4-66, guide-3:4-71]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 由 Dense 與卷積摘要計算參數、MAC 和記憶體，區分最多參數與最多計算
formula_groups:
  - id: layer-parameters
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html
    status: pending
    checked_by: null
  - id: layer-macs
    source: https://arxiv.org/html/1704.04861v1#S3.SS1 ; https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html#math-and-memory-bounds
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-C
  - id: state-memory
    source: https://docs.pytorch.org/tutorials/intermediate/optimizer_step_in_backward_tutorial.html#memory-usage-during-training
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 影像模型的卷積層有 56 個參數、每張 1944 MAC，Dense 有 219 個參數、每張 216 MAC。哪個判讀正確？
    options:
      A: 卷積參數較多，且卷積的權重乘加計算也較多
      B: Dense 參數較多，且 Dense 的權重乘加計算也較多
      C: Dense 參數較多，卷積的權重乘加計算則較多
      D: 卷積參數較多，Dense 的權重乘加計算則較多
    answer: C
    explain:
      A: 卷積的 56 小於 Dense 的 219，前半判讀錯誤。
      B: Dense 雖有較多參數，216 MAC 卻小於卷積的 1944 MAC。
      C: 參數可跨空間位置重用，因此卷積少參數也可能有較多計算。
      D: 參數和運算量的大小關係都與題目數值相反。
  - id: c2
    goal: g1
    type: choice
    prompt: 275 個參數均可訓練，使用 FP32 權重、梯度和 Adam 一階矩與二階矩。排除 step scalar、激活與工作區，這四組張量共占多少？
    options:
      A: 1100 bytes，等於整次訓練的最高記憶體需求
      B: 4400 bytes，只是這四組參數相關張量的容量
      C: 2200 bytes，等於權重與兩組矩狀態的全部容量
      D: 8800 bytes，只是這四組 FP32 張量的總容量
    answer: B
    explain:
      A: 1100 只計權重，且不能由此保證完整訓練峰值。
      B: 275×4 bytes×4 組等於 4400，還沒計其他記憶體。
      C: 2200 是兩組張量容量，權重、梯度與兩組矩狀態共四組。
      D: 題目採每值四 bytes 的 FP32，8800 相當於多算一倍。
---

## 為什麼需要

:::supplement[來源：PyTorch Linear、Conv2d；MobileNets 3.1；PyTorch 訓練記憶體教學]
模型摘要中的參數數，不能直接回答每張圖要算多久，或訓練是否放得進記憶體。同一組卷積權重在很多位置重用，參數少仍可能反覆計算。

本頁把「存多少可學數值」「做多少權重乘加」「保留多少訓練狀態」分開算。指引介紹網路架構，本頁的成本公式與實測屬補充深度。
:::

## 直覺

Dense 把輸入各維連到輸出；卷積用一個小核掃過許多空間位置。

:::supplement[來源：MobileNets 3.1；NVIDIA Matrix Multiplication 2]
前者可能把參數集中在分類頭，後者可能把運算集中在特徵圖。

![同一影像網路中，Dense 的參數較多，卷積的 MAC 較多；兩個排序不能互相替代。](figure:l23203-model-resource-costs-layer-budget)
:::

## 定義與公式（補充）

### 參數數

對有偏置的 Dense 與一般二維卷積：

$$
\begin{aligned}
P_{\mathrm{dense}}&=(d+1)h,\\
P_{\mathrm{conv}}&=(k_hk_wC_{\mathrm{in}}+1)C_{\mathrm{out}}.
\end{aligned}
$$

$P$ 是參數數，$d,h$ 是 Dense 輸入、輸出維度；$k_h,k_w$ 是核高、寬；$C_{\mathrm{in}},C_{\mathrm{out}}$ 是輸入、輸出通道數。

維度皆為正整數；本頁卷積的 groups 為一。

每個輸出各有一個偏置，所以括號加一。若停用偏置就移除該項；分組卷積要調整輸入通道數，不能直接套這個未分組版本。

兩式由 PyTorch Linear 與 Conv2d 文件的 weight、bias 形狀分別計數推得；權重元素數加上輸出偏置數，即為本頁的參數公式。

### MAC 與 FLOPs

MAC（multiply-accumulate）指一次乘法加一次累加；FLOPs（floating-point operations）指浮點運算次數。本頁只計前向權重乘加。

$$
\begin{aligned}
M_{\mathrm{dense}}&=dh,\\
M_{\mathrm{conv}}&=H_{\mathrm{out}}W_{\mathrm{out}}C_{\mathrm{out}}k_hk_wC_{\mathrm{in}},\\
F&=2M.
\end{aligned}
$$

$M$ 是單筆前向 MAC，$H_{\mathrm{out}},W_{\mathrm{out}}$ 是輸出高、寬。$F$ 是 FLOPs，本頁一次乘法加一次加法算兩次。

此處只計權重乘加，排除偏置加法、激活、損失與反向。批次成本乘上筆數；不同工具對一次融合乘加可能採不同定義，比較前須先對齊。

MobileNets 3.1 式 (2) 列一般卷積的乘加成本；本頁把正方形尺寸改寫為高、寬。

NVIDIA 矩陣乘法文件列每次融合乘加為兩次運算；取矩陣向量特例可得 Dense 的 $dh$ 次乘加。

### 參數相關記憶體

Adam 的一階矩與二階矩分別保存梯度平均與梯度平方平均，與 SGD 的 momentum 不同。

PyTorch 訓練記憶體教學列出權重一份、梯度一份、Adam 狀態兩份；在同精度條件下相加並換算 bytes，得到：

$$
B_{\mathrm{weights}}=bP,\qquad
B_{\mathrm{four}}=4bP.
$$

$B$ 單位是 bytes，$b$ 是每個數值的 bytes，FP32 為四。$P$ 是全部可訓練參數；第二式只估權重、梯度、Adam 一階矩與二階矩四組同精度張量。

它排除 Adam 的 step scalar、激活、輸入、暫存工作區及配置器開銷。若有凍結、混合精度或不同優化器，狀態組數和精度可能不同，不能把四倍當通則。

## 算一次（補充）

客服的兩層 Dense 為 4→5→3，參數數為 25＋18＝43，每筆 MAC 為 20＋15＝35。參數數與 Keras 頁的模型摘要相同；MAC 是另外核算的成本。

製造例子每張 8×8×3；3×3 卷積由三通道變兩通道，stride 一、無 padding，輸出 6×6×2。展平後 72 維接三類 Dense，兩層都有偏置。

| 層 | 輸出 | 參數代入 | 單張 MAC 代入 |
|---|---|---|---|
| 卷積 | 6×6×2 | (3×3×3＋1)×2＝56 | 6×6×2×3×3×3＝1944 |
| Dense | 3 | (72＋1)×3＝219 | 72×3＝216 |
| 合計 | 三類 logits | 275 | 2160 |

Dense 參數最多，卷積 MAC 最多。依本頁定義，單張為 4320 FLOPs，四張為 8640 MAC、17280 FLOPs；均只是所列前向權重乘加。

權重為 $4\times275=1100$ bytes；Adam 四組張量為 $4\times4\times275=4400$ bytes。這不代表 GPU 峰值需求。

### 批次對激活的影響（補充）

| 四張一批的張量 | 元素數 | FP32 容量 |
|---|---|---|
| 輸入影像 | 4×8×8×3＝768 | 3072 bytes |
| 卷積輸出 | 4×6×6×2＝288 | 1152 bytes |
| 三類 logits | 4×3＝12 | 48 bytes |

這只是列出三個前向張量，不是訓練峰值；反傳保存內容與記憶體共用依實作不同。批次變大會放大這些容量，但不改變 275 個參數。

## 程式（補充）

本段在 PyTorch 2.15.0+cpu 實測，使用 CPU。

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

run-code 會切換暫存目錄，也須保留這項設定。同頁各段按順序接續執行。

用製造資料建立相同卷積與分類頭，PyTorch 輸入先由 NHWC 改成 NCHW。讀出實際參數與梯度張量，另手算本頁定義的 MAC。

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-C-frameworks.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
r = d['resource']; c, h = d['vision_layers']
x = torch.tensor([a['pixels'] for a in d['manufacturing']['rows'][:r['batch']]],dtype=torch.float32).permute(0,3,1,2)
m = torch.nn.Sequential(torch.nn.Conv2d(c['input_channels'],c['output_channels'],c['kernel']),torch.nn.ReLU(),torch.nn.Flatten(),torch.nn.Linear(h['input'],h['output']))
a = m[0](x); z = m(x)
params = [sum(p.numel() for p in layer.parameters()) for layer in (m[0],m[3])]
mac = [a[0].numel()*c['input_channels']*c['kernel']**2,h['input']*h['output']]
print('層參數:', params, '單張 MAC:', mac)
print('卷積／輸出:', tuple(a.shape), tuple(z.shape))
print('四張 FLOPs:', sum(mac)*r['batch']*r['flops_per_mac'])
```
```text
層參數: [56, 219] 單張 MAC: [1944, 216]
卷積／輸出: (4, 2, 6, 6) (4, 3)
四張 FLOPs: 17280
```

```python
y = torch.tensor([a['label'] for a in d['manufacturing']['rows'][:r['batch']]])
opt = torch.optim.Adam(m.parameters(),lr=0.001)
opt.zero_grad(set_to_none=True)
torch.nn.CrossEntropyLoss()(z,y).backward(); opt.step()
weights = sum(p.numel()*p.element_size() for p in m.parameters())
grads = sum(p.grad.numel()*p.grad.element_size() for p in m.parameters())
moments = sum(s[k].numel()*s[k].element_size() for s in opt.state.values() for k in ('exp_avg','exp_avg_sq'))
print('權重／梯度／兩組矩狀態 bytes:', weights, grads, moments)
print('四組合計 bytes:', weights+grads+moments)
print('輸入／卷積／logits bytes:', *[t.numel()*t.element_size() for t in (x,a,z)])
```
```text
權重／梯度／兩組矩狀態 bytes: 1100 1100 2200
四組合計 bytes: 4400
輸入／卷積／logits bytes: 3072 1152 48
```

:::tip[讀碼重點]
Adam 第一次 step 才建立這些矩狀態。程式刻意只取 `exp_avg` 與 `exp_avg_sq`，排除 step scalar，讓實測範圍和公式一致。
:::

## 怎麼用、怎麼判讀

:::supplement[來源：PyTorch 訓練記憶體教學；NVIDIA Matrix Multiplication 2]
問模型容量先看參數，問計算成本先看相同約定的 MAC，問能否訓練則還要看激活、梯度與優化器狀態。延遲最終要在目標硬體實測，不能只用 FLOPs 排名。
:::

### 換個場景

| 場景 | 資料與資源條件 | 先查什麼 |
|---|---|---|
| 客服分類（補充） | 四維向量、小型 Dense | 43 個參數與每筆 35 MAC |
| 產線影像（補充） | 相同權重掃多個位置 | 卷積輸出尺寸與 MAC |
| 行動醫療（補充） | 裝置記憶體有限 | 權重精度、激活與實測峰值 |
| 金融批次評分（補充） | 批次變大、追求吞吐 | 固定參數下的張量容量 |

## 常見誤解

- 「參數最多的層一定最耗算」：卷積的空間重用會改變排序。（補充）
- 「權重檔 1 MB 就只需 1 MB 訓練」：梯度、狀態和激活還要空間。（補充）
- 「FLOPs 一樣就一定同速」：硬體、算子實作和資料搬移仍會影響延遲。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-66`～`guide-3:4-71`：架構定位起點；本頁公式與成本核算為補充。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html)、[Conv2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html)：權重、偏置與張量形狀。
- [Stanford CS231n 卷積網路課程](https://cs231n.github.io/convolutional-networks/)：從每個位置計數與區分參數、激活記憶體的教學思路。
- [MobileNets 3.1 式 (2)](https://arxiv.org/html/1704.04861v1#S3.SS1)：一般卷積的權重乘加成本，正文改寫為矩形尺寸。
- [NVIDIA Matrix Multiplication 2](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html#math-and-memory-bounds)：矩陣乘法的 FMA 計數及每次兩運算約定，Dense 為矩陣向量特例。
- [PyTorch 訓練記憶體教學](https://docs.pytorch.org/tutorials/intermediate/optimizer_step_in_backward_tutorial.html#memory-usage-during-training)：權重、梯度及 Adam 狀態的容量比例，本頁再依精度換算 bytes。
- [PyTorch Adam](https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adam.html)：一階矩、二階矩與實際狀態欄位。

## 小結

- 有偏置的層，要把每個輸出的偏置算進參數。（補充）
- 卷積的參數共享不會免除各位置的計算。（補充）
- 比較 MAC 或 FLOPs 前先核對計數約定。（補充）
- 訓練記憶體估算要列清楚包含與排除的張量。（補充）
