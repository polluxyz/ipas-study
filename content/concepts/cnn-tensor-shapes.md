---
id: cnn-tensor-shapes
title: CNN 張量尺寸、參數與成本
kind: technique
codes: [L23203, L21102]
aliases: [卷積輸出尺寸, 參數量]
summary: 先追蹤每層形狀，再分開計算參數、乘加與記憶體，才能讀懂 CNN 摘要
requires: [convolution-layer, pooling, flatten]
guide_refs: [guide-1:3-48, guide-3:4-68, guide-3:4-69]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 算出卷積、池化與展平形狀，處理步幅造成的餘數
  - id: g2
    text: 分開核算含偏置參數、MAC 與記憶體，辨識模型摘要的限制
formula_groups:
  - id: layer-shapes
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.MaxPool2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
  - id: layer-parameters
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
  - id: layer-macs
    source: https://arxiv.org/html/1704.04861v1 ; https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
  - id: memory-budget
    source: https://docs.pytorch.org/tutorials/intermediate/optimizer_step_in_backward_tutorial.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 交通影像為 8×8×3，3×3 卷積、stride 2、valid、輸出 2 通道，再做 2×2、stride 2、valid 最大池化。卷積、池化、展平的單筆形狀依序為何？
    options:
      A: 4×4×2、2×2×2、8 維
      B: 3×3×2、2×2×2、8 維
      C: 3×3×2、1×1×2、2 維
      D: 4×4×2、1×1×2、2 維
    answer: C
    explain:
      A: valid 卷積不能向上取整，所以不會得到四格。
      B: 池化也必須向下取整，三格輸入只容納一個完整視窗。
      C: 卷積向下取整得三，池化向下取整得一，乘兩通道得二維。
      D: 卷積尺寸已算錯，不能跳過餘數條件得到四格。
  - id: c2
    goal: g2
    type: choice
    prompt: 單張 8×8×3 影像經 3×3、stride 1、valid 的標準卷積，輸出 2 通道；不池化，直接展平接二類 Dense。兩層皆有偏置，只計前向權重 MAC，哪個排序正確？
    options:
      A: 卷積參數較多，卷積乘加也較多
      B: 卷積參數較多，Dense 乘加較多
      C: Dense 參數較多，Dense 乘加也較多
      D: Dense 參數較多，卷積乘加較多
    answer: D
    explain:
      A: 卷積為 (3×3×3＋1)×2＝56 參數，Dense 為 (6×6×2＋1)×2＝146，卷積較少。
      B: 參數與乘加兩個排序都與數值相反。
      C: Dense 的 144 MAC 遠少於卷積的 1944 MAC。
      D: 卷積權重在空間重用，因此參數較少仍可能計算較多。
  - id: c3
    goal: g2
    type: choice
    prompt: 含池化的模型有 94 個可訓練參數，均用 FP32。只算權重，及權重加梯度與 Adam 兩組矩狀態，容量依序為何？
    options:
      A: 376 bytes 與 1504 bytes，均非完整訓練峰值
      B: 376 bytes 與 752 bytes，後者是完整訓練峰值
      C: 94 bytes 與 376 bytes，均非完整訓練峰值
      D: 1504 bytes 與 6016 bytes，後者是完整訓練峰值
    answer: A
    explain:
      A: 每值四 bytes，權重是 376，四組同精度張量為 1504，尚未計激活等。
      B: 752 只計兩組同精度張量，且不能保證完整訓練峰值。
      C: 把每個 FP32 值誤當一 byte，兩個容量都少算四倍。
      D: 權重已多算四倍，也不能把四組容量當成訓練峰值。
---

## 為什麼需要

本例 CNN 的特徵圖經過卷積、池化，再交給分類頭。先追蹤各層輸入與輸出，才能接成可運作的網路。

:::supplement[來源：PyTorch Conv2d、Linear；MobileNets 3.1；PyTorch 訓練記憶體教學]
模型摘要的輸出形狀、參數數與運算成本回答不同問題。把批次張數乘進參數，或把最多參數當成最多計算，都可能導致錯誤部署估計。

本頁以同一份製造與交通影像，分別算出每層的形狀、參數與運算量。
:::

## 直覺

卷積改變空間尺寸及通道，池化縮小高寬，Flatten 銜接向量分類頭。

沿箭頭讀每一步的形狀；比較兩條路徑時，留意分類頭前有沒有先縮小特徵圖。

![上路徑先池化再展平為 18 維，下路徑直接展平為 72 維；卷積規格與參數不變。](figure:l23203-cnn-tensor-shapes-size-flow)

:::supplement[來源：PyTorch Conv2d、MaxPool2d；Keras Flatten]
先沿形狀流向算一遍，再問每層「存幾個權重」「在幾個位置重算」。參數是可學的數值，不是本次輸出的所有數值。
:::

## 定義與公式（補充）

### 尺寸先算空間，再補通道

對 dilation=1、對稱 padding、向下取整的二維卷積或池化：

$$
H_o=\left\lfloor\frac{H_i+2p_h-k_h}{s_h}\right\rfloor+1,
\qquad W_o=\left\lfloor\frac{W_i+2p_w-k_w}{s_w}\right\rfloor+1.
$$

$H_i,W_i$ 是輸入高寬，$H_o,W_o$ 是輸出高寬；$k$、$p$、$s$ 分別是核大小、每側 padding 與步幅，下標 $h,w$ 分別指高、寬。可容納完整視窗才計一格。

卷積輸出通道由濾波器數決定；一般池化保留原通道。展平後單筆長度為 $d=H_oW_oC_o$，$C_o$ 是輸出通道；批次數 $N$ 保留在最前軸。

本頁池化設 `ceil_mode=False`、無 padding。若用 ceil、dilation 或不對稱補零，須依實際設定重算，不能直接套這版。

### 有偏置的參數

$$
P_{\mathrm{conv}}=(k_hk_wC_i+1)C_o,
\qquad P_{\mathrm{dense}}=(d+1)q.
$$

$P$ 是參數數，$C_i$ 是輸入通道，$d$ 是 Dense 輸入長度，$q$ 是輸出維度；括號內的一表示每個輸出的偏置。卷積限定 groups=1；停用偏置則去掉加一。

一般最大／平均池化、Flatten 與 ReLU 沒有可訓練參數。批次張數、高寬增加，可能增加激活數，但不直接增加同一卷積的參數。

### 前向乘加的計數約定

$$
\begin{aligned}
M_{\mathrm{conv}}&=H_oW_oC_ok_hk_wC_i,\\
M_{\mathrm{dense}}&=dq,\\
F&=2M.
\end{aligned}
$$

$M$ 是單筆前向 MAC（Multiply-accumulate，乘加次數）；$F$ 是本頁約定的 FLOPs（浮點運算次數），一次乘法加一次加法算兩次。

此處只計權重乘加，排除偏置加法、ReLU、池化比較、損失與反向。整批權重乘加再乘張數；比較工具前先確認一次融合乘加如何計數。

### 記憶體要列範圍

$$
B_{\mathrm{weights}}=bP,\qquad
B_{\mathrm{four}}=4bP,\qquad
B_{\mathrm{activation}}=bNH_oW_oC_o.
$$

$B$ 的單位是 bytes，$b$ 是每值 bytes，FP32 為四；$P$ 是可訓練參數總數。第二式限權重、梯度、Adam 一階矩與二階矩四組同精度張量；第三式只估一個輸出激活張量。

這些容量都不是完整訓練峰值：還可能需要保存其他中間值、優化器 step scalar、工作區與配置器空間。凍結、混合精度或不同優化器也會改變估算。

## 算一次（補充）

RGB 主規格與其他四頁共用：8×8×3 輸入，3×3 valid 卷積、stride 1、兩輸出通道，再接 2×2、stride 2 池化及二類分類頭。卷積與池化的手算另用較小的單通道圖。

| 層 | 單筆輸出 | 含偏置參數 | 單筆權重 MAC |
|---|---|---|---|
| 卷積 | 6×6×2 | (27＋1)×2＝56 | 6×6×2×27＝1944 |
| ReLU／池化 | 3×3×2 | 0 | 此處不計 |
| Flatten | 18 | 0 | 0 |
| Dense | 2 | (18＋1)×2＝38 | 18×2＝36 |
| 合計 | 2 個 logits | 94 | 1980 |

卷積高寬 $(8-3)/1+1=6$，池化 $(6-2)/2+1=3$，展平 $3\times3\times2=18$。

每張權重運算為 $1980\times2=3960$ FLOPs，仍只計本頁定義的乘加。

### 帶餘數的變體

只把卷積 stride 改二：$\lfloor(8-3)/2\rfloor+1=3$，不是四。左上起點依序是 0、2、4，起點 6 的核會越界，因此尾端不再多算一格。

再以 2×2、stride 2 池化，得 $\lfloor(3-2)/2\rfloor+1=1$。單筆輸出為 1×1×2，展平二維；若仍接 `Linear(18,2)` 就不相容。

### 同一卷積，不同分類頭

不池化時，卷積仍有 56 參數、1944 MAC。直接展平是 72 維，Dense 為 $(72+1)\times2=146$ 參數、$72\times2=144$ MAC。

這時 Dense 參數比卷積多，卷積的乘加卻比 Dense 多。兩層合計 202 參數、2088 MAC，不能把「最多參數」等同「最多計算」。

### 四張一批的容量

主模型的權重是 $4\times94=376$ bytes，四組同精度參數張量是 $4\times4\times94=1504$ bytes。兩者均排除激活與工作區。

四張一批、FP32 的兩個輸出張量容量如下：

- 卷積：$4\times6\times6\times2=288$ 個值，共 1152 bytes。
- 池化：$4\times3\times3\times2=72$ 個值，共 288 bytes。

增加 batch 會放大激活容量，但不會把 94 個參數變多。更完整的訓練狀態盤點可接著讀模型參數、運算量與訓練記憶體。

## 程式（補充）

請先把環境變數 `IPAS_REPO_ROOT` 設為 repo 根目錄的絕對路徑。CPU 實測分成兩段；第一段查主模型，第二段核對帶餘數的變體。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-D-images.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor([r['pixels'] for r in d['traffic']['rows'][:4]], dtype=torch.float32).permute(0,3,1,2)
conv, pool, flat, head = torch.nn.Conv2d(3,2,3), torch.nn.MaxPool2d(2,2), torch.nn.Flatten(1), torch.nn.Linear(18,2)
a = conv(x); p = pool(torch.relu(a)); v = flat(p); z = head(v)
counts = [sum(t.numel() for t in layer.parameters()) for layer in (conv,pool,flat,head)]
mac = [a[0].numel()*3*3*3, v.shape[1]*2]
print('形狀:', tuple(a.shape), tuple(p.shape), tuple(v.shape), tuple(z.shape))
print('逐層參數／MAC:', counts, mac)
print('權重／四組／卷積激活 bytes:', sum(counts)*4, sum(counts)*16, a.numel()*a.element_size())
print('單張 FLOPs:', sum(mac)*2)
```
```text
形狀: (4, 2, 6, 6) (4, 2, 3, 3) (4, 18) (4, 2)
逐層參數／MAC: [56, 0, 0, 38] [1944, 36]
權重／四組／卷積激活 bytes: 376 1504 1152
單張 FLOPs: 3960
```

```python
r = torch.nn.Conv2d(3,2,3,stride=2)(x)
rp = pool(r)
direct = torch.nn.Linear(a[0].numel(),2)
print('餘數變體:', tuple(r.shape), tuple(rp.shape), tuple(flat(rp).shape))
print('不池化的 Dense 參數／MAC:', sum(t.numel() for t in direct.parameters()), a[0].numel()*2)
```
```text
餘數變體: (4, 2, 3, 3) (4, 2, 1, 1) (4, 2)
不池化的 Dense 參數／MAC: 146 144
```

:::tip[讀碼重點]
`numel()` 計所有軸的元素。算單張 MAC 用 `a[0]`；算這一批的激活 bytes 才用整個 `a`。這避免把 batch 誤乘進單張成本。
:::

## 怎麼用、怎麼判讀

卷積與池化後接分類頭，是指引的典型影像資料流。

:::supplement[來源：PyTorch Conv2d、Linear；MobileNets 3.1；PyTorch 訓練記憶體教學]
核對順序是形狀、參數、運算量、記憶體範圍。前一項對了不代表後一項也對；真正的延遲與峰值還要在目標硬體量測。
:::

### 換個場景

| 場景 | 條件 | 核對重點 |
|---|---|---|
| 影像分類網路 | 卷積池化後接全連接 | 特徵流向與分類頭銜接 |
| 製造瑕疵（補充） | 高解析度放大特徵圖 | 固定卷積參數仍增加 MAC |
| 交通標誌（補充） | 行動裝置即時推論 | 小 batch、延遲與激活容量 |
| 醫療訓練（補充） | 大 batch、保存反向狀態 | 不只估權重檔大小 |

## 常見誤解

- 「valid 的餘數可以四捨五入」：完整視窗才算，這裡向下取整。（補充）
- 「batch 四張，參數也乘四」：共享參數相同，激活才隨 batch 放大。（補充）
- 「池化零參數，所以零運算」：它仍做比較或平均，只是未納入本頁的權重 MAC。（補充）
- 「FLOPs 較少一定跑得較快」：硬體、資料搬移與算子實作仍影響延遲。（補充）

## 進階

### 成本與效能不能互代（補充）

加入池化後，本例分類頭從 72 維降為 18 維，參數與乘加都變少。但若池化刪掉關鍵瑕疵，任務品質仍可能下降；架構選擇要同時比較固定資料上的結果與資源。

### 參考來源

- 科目 1 指引 `guide-1:3-48`、科目 3 指引 `guide-3:4-68`～`guide-3:4-69`：各層分工；本頁尺寸與成本公式為補充。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html)、[MaxPool2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.MaxPool2d.html)：形狀公式與餘數條件。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html)、[Keras Flatten](https://keras.io/api/layers/reshaping_layers/flatten/)：分類頭參數與展平形狀。
- [MobileNets 3.1](https://arxiv.org/html/1704.04861v1)：標準卷積乘加成本，本文改寫為高、寬分開表示。
- [NVIDIA Matrix Multiplication](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html)：一次融合乘加按兩運算的約定與 Dense 的矩陣向量特例。
- [PyTorch 訓練記憶體教學](https://docs.pytorch.org/tutorials/intermediate/optimizer_step_in_backward_tutorial.html)：權重、梯度、優化器狀態和激活的區別。
- [Stanford CS231n 卷積網路](https://cs231n.github.io/convolutional-networks/)：以逐層形狀、參數和激活分開核對的教學思路。

## 小結

- 先算高寬與通道，再算展平後的長度。（補充）
- 參數是共享權重與偏置，MAC 還要計各輸出位置。（補充）
- 成本比較須採同一計數範圍與精度。（補充）
- 訓練記憶體包含權重以外的狀態，摘要不是峰值保證。（補充）
