---
id: pooling
title: 池化與特徵圖縮減
kind: component
codes: [L23203, L21102]
aliases: [Average Pooling, Global Average Pooling, Max Pooling, Max-Pooling, 最大池化, 池化與降採樣]
summary: 每個小區域只留最大值或平均值，讓後面處理的數值變少
guide_refs: [guide-1:3-48, guide-3:4-68, guide-3:4-69]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 用同一小圖算最大與平均池化，說明尺寸縮減及資訊損失
  - id: g2
    text: 區分區域取最大與 Softmax 轉機率，說明兩者不能還原什麼
formula_groups:
  - id: pooling-values
    source: guide-3:4-69 ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.MaxPool2d.html ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.AvgPool2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-D
  - id: softmax-comparison
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Softmax.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療特徵圖一個 2×2 視窗依序為 1、2、0、1。最大與平均池化結果依序是多少？
    options:
      A: 最大是 1，平均是 2，兩者都保留四個位置
      B: 最大是 2，平均是 4，兩者都保留四個位置
      C: 最大是 2，平均是 1，兩者都只留一個摘要
      D: 最大是 4，平均是 1，兩者都只留一個摘要
    answer: C
    explain:
      A: 最大值與平均值被顛倒，池化後也不保留四個原位置。
      B: 四是總和而非平均，單一視窗池化只產生一個值。
      C: 最大值是二，總和四除以四為一，各輸出一個值。
      D: 四不是最大值，這個視窗最大的數只有二。
  - id: c2
    goal: g2
    type: choice
    prompt: 工程師對 [1,2,0,1] 取最大得 2，做 Softmax 得約 [0.197,0.534,0.072,0.197]。全部加 10 後會如何？
    options:
      A: 最大改為 12；Softmax 比例維持相同
      B: 最大維持 2；Softmax 比例全部加 10
      C: 最大改為 12；Softmax 比例全部加 10
      D: 最大維持 2；Softmax 比例維持相同
    answer: A
    explain:
      A: 共同位移會改變最大值，但在 Softmax 分子分母中抵消。
      B: 最大值必須跟著增加十，機率也不能直接加十。
      C: 機率總和必須為一，Softmax 結果不會全部加十。
      D: Softmax 的判讀正確，但原始最大值也會增加十。
---

## 為什麼需要

卷積會在影像各處重複套用同一組計算。按位置排列這些結果，就得到特徵圖。

特徵圖可能很大。若全部交給最後判斷類別的分類頭，運算與儲存需求會增加。

池化（Pooling）把每個小區域縮成較少數值。這樣能縮小特徵圖，但會捨棄部分細節。

最大池化（Max Pooling）只留下區域內最大的數值。平均池化（Average Pooling）則留下區域內數值的平均。

## 直覺

在一個 2×2 區域內，可以找出最大值，也可以算出平均值。計算的方法不同，同一區域就可能得到不同答案。池化每次取來計算的小區域，稱為視窗。

![同一張小圖、同一組視窗，最大池化留下最大值，平均池化留下平均值。](figure:l23203-pooling-local-summary)

:::supplement[來源：PyTorch MaxPool2d、AvgPool2d；D2L 7.5]
通道（同一位置分開存放的各組數值）會各自做池化。一般二維池化不把不同通道混在一起。

步幅（stride）是視窗每次移動的格數。6×6×2 的輸入使用 2×2 視窗，步幅設為 2。池化後得到 3×3×2，通道數仍為二。
:::

## 定義與公式

對一個不含 padding、共有 $m$ 個數值的視窗：

$$
y_{\max}=\max(x_1,\ldots,x_m),
\qquad y_{\mathrm{avg}}=\frac{1}{m}\sum_{i=1}^{m}x_i.
$$

$x_i$ 是視窗第 $i$ 個值，$m$ 是視窗元素數；$y_{\max}$、$y_{\mathrm{avg}}$ 分別是最大與平均池化輸出。2×2 視窗的 $m=4$。

指引常用小型、不重疊視窗；本頁以 2×2 視窗、每次移兩格示範。

:::supplement[來源：PyTorch Softmax]
Softmax 針對指定軸的一組分數做指數正規化：

$$
p_i=\frac{e^{z_i}}{\sum_{j=1}^{m}e^{z_j}},\qquad
\operatorname{softmax}(z+c\mathbf{1})=\operatorname{softmax}(z).
$$

$z_i$ 是第 $i$ 個分數，$p_i$ 是轉換後比例，$m$ 是分數個數；$c$ 是所有分數共同增加的常數，$\mathbf{1}$ 是全一向量。轉換後各值為正，總和為一。

共同位移的 $e^c$ 在分子分母抵消，因此不能由機率唯一還原原始分數。Softmax 保留軸長，不是取一個最大值。
:::

## 算一次

使用共用例子 `pooling_demo` 的 4×4 小圖：

$$
X=\begin{bmatrix}1&2&2&0\\0&1&1&3\\0&1&1&3\\2&1&1&0\end{bmatrix}.
$$

$X$ 是單通道的教學特徵圖。取 2×2 視窗、stride 2、不補零，四個視窗互不重疊。左上視窗為 1、2、0、1，最大是 2，平均為 $(1+2+0+1)/4=1$。

| 視窗左上角 | 最大值 | 平均值 |
|---|---|---|
| 第 1 列第 1 欄 | 2 | 1 |
| 第 1 列第 3 欄 | 3 | 1.5 |
| 第 3 列第 1 欄 | 2 | 1 |
| 第 3 列第 3 欄 | 3 | 1.25 |

兩種池化都把 4×4 變成 2×2，卻保留不同摘要。例如左上視窗的 0 在最大池化後消失，不能由 2 還原原來四個值。

### 同一視窗做 Softmax（補充）

左上視窗排成 $z=[1,2,0,1]$，分母 $e+e^2+1+e\approx13.8256$。比例約為 [0.1966,0.5344,0.0723,0.1966]，仍有四值。

若分數全加十成為 [11,12,10,11]，最大值從 2 變成 12，Softmax 比例卻不變。池化失去局部細節；Softmax 則失去共同位移資訊，兩者都不能唯一還原輸入。

## 程式（補充）

請先把環境變數 `IPAS_REPO_ROOT` 設為 repo 根目錄的絕對路徑。以下使用 CPU，沒有隨機取樣。

```python
import json, os, torch
from pathlib import Path
import torch.nn.functional as F
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-D-images.json').read_text(encoding='utf-8'))
x = torch.tensor(d['pooling_demo'], dtype=torch.float32)[None, None]
print('最大:', F.max_pool2d(x,2,stride=2).squeeze().tolist())
print('平均:', F.avg_pool2d(x,2,stride=2).squeeze().tolist())
z = x[0,0,:2,:2].reshape(-1)
print('Softmax:', [round(v,4) for v in z.softmax(0).tolist()])
print('共同位移不變:', torch.allclose(z.softmax(0),(z+10).softmax(0)))
print('2 通道特徵圖池化:', tuple(F.max_pool2d(torch.zeros(4,2,6,6),2,2).shape))
```
```text
最大: [[2.0, 3.0], [2.0, 3.0]]
平均: [[1.0, 1.5], [1.0, 1.25]]
Softmax: [0.1966, 0.5344, 0.0723, 0.1966]
共同位移不變: True
2 通道特徵圖池化: (4, 2, 3, 3)
```

:::tip[讀碼重點]
前兩行池化輸出都縮小高寬；`softmax(0)` 只在選定的四維向量上轉比例。兩種運算的目的與作用軸都要分清楚。
:::

## 怎麼用、怎麼判讀

最大池化適合關注局部強回應；平均池化適合保留區域平均強度。減少特徵圖數值，通常能降低後續層的成本，但也可能抹掉辨識所需的小細節。

科3 指引 4-68 說池化能增進平移不變性，原文已限定為小幅平移；不能把這個範圍擴大成任意位置都不影響結果。

:::supplement[來源：D2L 7.5；PyTorch MaxPool2d]
小幅移動若沒有讓峰值跨出視窗，最大值可能不變；跨過視窗邊界就可能改變。池化提供有限的局部穩健性，不保證任意平移、旋轉或縮放都不變。
:::

### 換個場景

| 場景 | 資料條件 | 摘要取捨 |
|---|---|---|
| 影像局部特徵 | 小型視窗、特徵圖需縮小 | 保留強回應或平均強度 |
| 產線瑕疵（補充） | 瑕疵可能只有少數像素 | 過早縮小可能漏掉細刮痕 |
| 醫療影像（補充） | 病灶尺寸很小 | 先驗證細節能否保留 |
| 語音頻譜（補充） | 時間頻率上的局部回應 | 池化軸決定犧牲哪種解析度 |

## 常見誤解

- 「Max Pooling 就是 Softmax」：前者取局部摘要，後者轉一組分數為比例。（補充）
- 「池化保留所有重要資訊」：被捨棄的值也可能含有辨識線索。
- 「池化會學出權重」：此處最大與平均池化沒有可訓練參數。（補充）
- 「縮小一定提高準確率」：成本較低不保證任務表現較好。（補充）

## 進階

### 全域平均池化（補充）

全域平均池化（Global Average Pooling）把每個通道整張圖平均成一個值。3×3×2 會得到兩個摘要，與展平保留 18 個數值不同；換較少分類頭參數的代價，是更少的位置細節。

### 參考來源

- 科目 3 指引 `guide-3:4-68`～`guide-3:4-69`：池化目的、兩種摘要與小型視窗；已核對 PDF 頁 106–107。
- 科目 1 指引 `guide-1:3-48`：池化與 Softmax 在 CNN 中的不同分工。
- [PyTorch MaxPool2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.MaxPool2d.html)、[AvgPool2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.AvgPool2d.html)：逐窗公式、程式與通道、步幅設定。
- [PyTorch Softmax](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Softmax.html)：定義與公式、同一視窗比較及共同位移推導。
- [D2L 7.5 Pooling](https://d2l.ai/chapter_convolutional-neural-networks/pooling.html)：逐窗算例與局部穩健性的教學思路。
- [Keras GlobalAveragePooling2D](https://keras.io/api/layers/pooling_layers/global_average_pooling2d/)：進階節的每通道全域摘要。

## 小結

- 最大與平均池化，回答的是局部強度的不同問題。
- 池化縮減空間細節，不能唯一還原原圖。
- 常見池化逐通道執行，不改通道數。（補充）
- Softmax 保留分數個數，與取最大值的目的不同。（補充）
