---
id: convolution-layer
title: 卷積層、通道與權重共享
kind: component
codes: [L23203]
aliases: [Conv2D, Convolution, 卷積核]
summary: 卷積層用同一組可學權重掃描局部區域，產生各通道的特徵圖
requires: [artificial-neuron]
part_of: [cnn]
guide_refs: [guide-3:4-67, guide-3:4-68]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 分清輸入通道與特徵圖，說明局部連接及權重共享
  - id: g2
    text: 依卷積核、步幅與 padding 算出 valid 和 same 的輸出尺寸
  - id: g3
    text: 計算含偏置的標準卷積參數，分清參數數和位置數
formula_groups:
  - id: convolution-value
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
  - id: convolution-shape
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
  - id: convolution-parameters
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 產線輸入為 8×8×3，標準卷積有 2 個濾波器。何者描述了通道與共享方式？
    options:
      A: 每個濾波器跨 3 個輸入通道，並在各空間位置重用
      B: 每個濾波器只看 1 個輸入通道，並在各空間位置重用
      C: 每個濾波器跨 3 個輸入通道，但在各空間位置重建
      D: 每個濾波器只看 1 個輸入通道，但在各空間位置重建
    answer: A
    explain:
      A: groups=1 時每個濾波器整合全部輸入通道，同一組權重掃過空間。
      B: 只看一個輸入通道不符合此處未分組卷積的連接方式。
      C: 各位置重建獨立權重會失去權重共享的特性。
      D: 此敘述同時誤解跨通道整合與空間權重共享。
  - id: c2
    goal: g2
    type: choice
    prompt: 交通影像是 8×8×3，3×3 卷積、stride 1、輸出 2 通道。valid 與每側補一圈零的 same 輸出依序為何？
    options:
      A: valid 為 8×8×2，same 為 6×6×2
      B: valid 為 6×6×2，same 為 8×8×2
      C: valid 為 6×6×3，same 為 8×8×3
      D: valid 為 8×8×3，same 為 6×6×3
    answer: B
    explain:
      A: 無 padding 會縮減尺寸，兩種尺寸被對調。
      B: 無 padding 得六格，每側加一後得八格，輸出通道均為二。
      C: 輸出通道由濾波器數決定，不能沿用 RGB 的三通道。
      D: 空間尺寸及輸出通道兩者都沒有依設定計算。
  - id: c3
    goal: g3
    type: choice
    prompt: 8×8×3 經 2 個 3×3 濾波器得到 6×6×2，groups=1 且有偏置。參數數是多少？
    options:
      A: 54 個，僅計兩個濾波器的權重
      B: 72 個，依全部輸出位置各算一個
      C: 20 個，將輸入視為單通道計算
      D: 56 個，另計每個輸出通道的偏置
    answer: D
    explain:
      A: 54 是權重數，尚少每個輸出通道的一個偏置。
      B: 72 是輸出元素數，各位置共用權重所以不是參數數。
      C: 20 是單通道輸入的結果，漏掉 RGB 的其餘通道。
      D: 每個濾波器有 27 個權重與一個偏置，兩個共 56。
---

## 為什麼需要

影像上的邊緣可能出現在左邊，也可能出現在右邊。若每個位置各學一套偵測權重，資料與參數需求都會增加。

卷積層（Convolutional Layer）讓一個小型偵測器移動到各處，用同一組權重尋找局部模式。訓練時，卷積核（Kernel，又稱濾波器 Filter）會隨損失的梯度更新。

## 直覺

把卷積核想成一個可移動的檢查框。它一次看局部區域，但移到下一格後，檢查規則不變。

![兩個視窗使用同一卷積核；局部位置改變，權重仍共用。](figure:l23203-convolution-layer-local-window)

輸入通道（Channel）是同一位置的不同數值來源，例如 RGB 的紅、綠、藍。特徵圖（Feature Map）則是某個濾波器在各位置的回應；兩個濾波器便產生兩個輸出通道。

:::supplement[來源：PyTorch Conv2d；D2L 7.2]
標準卷積的每個濾波器會跨全部輸入通道加總。3×3×3 的濾波器會在一個位置看 27 個數值，不是分別輸出三張互不相干的圖。
:::

全連接層讓每個輸出連到全部輸入，通常各用獨立權重；卷積採局部連接，並把同一濾波器的權重沿空間重用。

:::supplement[來源：Stanford CS231n 卷積網路]
以同樣的 8×8×3 輸入產生 6×6×2 個輸出：全連接需要 192×72＋72＝13,896 個參數；本例卷積只需 56 個。兩者連接方式不同，輸出值也不必相同。
:::

## 定義與公式（補充）

### 一個位置怎麼算

以單通道、stride 1、無 padding 的情況表示：

$$
y_{i,j}=b+\sum_{u=0}^{k_h-1}\sum_{v=0}^{k_w-1}w_{u,v}x_{i+u,j+v}.
$$

$x$ 是輸入，$w$ 是核權重，$b$ 是偏置；$i,j$ 是輸出位置，$u,v$ 是核內位置，$k_h,k_w$ 是核高、寬。多通道時還要對輸入通道加總。

深度學習框架通常做交叉相關（Cross-correlation），不把核上下左右翻轉；本頁稱為卷積，計算依這個慣例。

### 空間尺寸

本頁限定 dilation=1、groups=1，且每側對稱補零：

$$
H_o=\left\lfloor\frac{H_i+2p_h-k_h}{s_h}\right\rfloor+1,
\qquad
W_o=\left\lfloor\frac{W_i+2p_w-k_w}{s_w}\right\rfloor+1.
$$

$H_i,W_i$ 是輸入高寬，$H_o,W_o$ 是輸出高寬；$p_h,p_w$ 是每側補零數，$s_h,s_w$ 是步幅（Stride）。$\lfloor\cdot\rfloor$ 表示向下取整。

valid 表示不補零；本頁 same 限奇數核、stride 1，採足量對稱補零使高寬不變。步幅變大時不可直接宣稱輸出與輸入同大；PyTorch 的字串 same 不支援 stride 大於一。

### 權重與偏置

$$
P=k_hk_wC_iC_o+C_o.
$$

$P$ 是可訓練參數數，$C_i,C_o$ 是輸入、輸出通道。第一項計權重，第二項計每個輸出通道的一個偏置；停用偏置時移除第二項。

此式只適用標準未分組卷積。輸出位置變多會增加計算，卻不會增加這組共享參數。

## 算一次（補充）

本組共用 `L23203-D-images.json`，含製造瑕疵及交通標誌各 16 張 8×8×3 影像。先拿其中的單通道小圖手算，避免同時追蹤太多通道。

$$
X=\begin{bmatrix}1&2&0\\0&1&3\\2&1&0\end{bmatrix},
\quad K=\begin{bmatrix}1&0\\0&-1\end{bmatrix},
\quad b=0.
$$

$X$ 是小圖，$K$ 是手算核。左上輸出是 $1\times1+2\times0+0\times0+1\times(-1)=0$；右上改用右移一格的區域，得 $2-3=-1$。

下列兩格依相同規則，分別為 $0-1=-1$ 與 $1-0=1$，所以輸出為 $\begin{bmatrix}0&-1\\-1&1\end{bmatrix}$。四個位置都用原來的四個權重。

### 換回 RGB 規格

| 設定 | 高寬代入 | 輸出形狀 |
|---|---|---|
| 3×3、stride 1、valid | (8−3)÷1＋1＝6 | 6×6×2 |
| 3×3、stride 1、same | (8＋2−3)÷1＋1＝8 | 8×8×2 |

兩者參數都為 $3\times3\times3\times2+2=56$。valid 的 72 個輸出元素不是 72 個參數；same 雖有 128 個輸出元素，仍共用這 56 個參數。

## 程式（補充）

請先把環境變數 `IPAS_REPO_ROOT` 設為 repo 根目錄的絕對路徑，讓實測工具切換工作目錄後仍能讀檔。以下以 CPU 執行。

```python
import json, os, torch
from pathlib import Path
import torch.nn.functional as F
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-D-images.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor(d['hand']['image'], dtype=torch.float32)[None, None]
k = torch.tensor(d['hand']['kernel'], dtype=torch.float32)[None, None]
print('手算卷積:', F.conv2d(x, k).squeeze().tolist())
rgb = torch.tensor([r['pixels'] for r in d['manufacturing']['rows'][:4]], dtype=torch.float32).permute(0,3,1,2)
valid = torch.nn.Conv2d(3,2,3,padding='valid')
same = torch.nn.Conv2d(3,2,3,padding='same')
print('valid／same:', tuple(valid(rgb).shape), tuple(same(rgb).shape))
print('參數:', sum(p.numel() for p in valid.parameters()))
```
```text
手算卷積: [[0.0, -1.0], [-1.0, 1.0]]
valid／same: (4, 2, 6, 6) (4, 2, 8, 8)
參數: 56
```

:::tip[讀碼重點]
`permute(0,3,1,2)` 把 NHWC 改成 PyTorch 的 NCHW。輸出第二軸的 2 是濾波器數；第一軸的 4 是批次張數，不計入參數公式。
:::

## 怎麼用、怎麼判讀

局部區域有辨識線索時，可以讓卷積學邊緣、紋理或色塊。更深的層會把前一層的特徵當輸入，不再只是處理 RGB。

指引以貓眼出現在左右不同位置說明共享。

:::supplement[來源：PyTorch Conv2d]
較精確地說，stride 1 的卷積在邊界條件相容時呈平移等變：輸入移動，特徵圖也跟著移動。這不保證分類結果對任意位置都相同。
:::

### 換個場景

| 場景 | 觀察的局部模式 | 判讀重點 |
|---|---|---|
| 貓眼與物體辨識 | 邊緣、紋理、色塊 | 同一偵測器可掃不同位置 |
| 產線瑕疵（補充） | 局部直線、刮痕 | 不把高回應直接當瑕疵機率 |
| 交通標誌（補充） | 線條方向、色彩 | 換位置可重用，旋轉仍須驗證 |
| 醫療影像（補充） | 局部組織紋理 | 灰階只有一通道時須改輸入規格 |

## 常見誤解

- 「三個輸入通道必定輸出三通道」：輸出通道看濾波器數。（補充）
- 「每個位置各學一組核」：這會失去權重共享。
- 「核小就只能看小範圍」：多層組合能逐步整合更大區域。
- 「共享可保證任何旋轉、位置都不影響結果」：共享只提供局部運算規則的重用。（補充）

## 進階

### 尺寸公式的界線（補充）

dilation 大於一時，有效核大小要把核元素間距算進去；分組卷積也要重算每組接收的通道。本頁先掌握標準情況，跨層成本再接 CNN 張量尺寸、參數與成本。

### 參考來源

- 科目 3 指引 `guide-3:4-67`～`guide-3:4-68`：局部特徵、特徵映射、共享與貓眼場景；已核對 PDF 頁 105–106。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html)：定義與公式、valid/same、程式及等變性的適用條件。
- [D2L 7.2 Convolutions for Images](https://d2l.ai/chapter_convolutional-neural-networks/conv-layer.html)：滑窗逐格手算的教學思路。
- [Stanford CS231n 卷積網路](https://cs231n.github.io/convolutional-networks/)：直覺節的局部連接與全連接比較思路。

## 小結

- 濾波器在不同空間位置共用權重。
- 每個濾波器產生一個輸出通道。
- 先定 kernel、stride、padding，再算輸出高寬。（補充）
- 參數含權重和偏置，不乘輸出位置數。（補充）
