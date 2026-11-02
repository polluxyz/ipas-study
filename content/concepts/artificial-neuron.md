---
id: artificial-neuron
title: 人工神經元
kind: component
codes:
  - L23203
aliases:
  - Artificial Neuron
  - 偏置
  - 加權和
summary: 人工神經元先算輸入的加權和與偏置，再以激活函數產生輸出
goals:
  - id: g1
    text: 由輸入、權重、偏置與激活算出單一神經元輸出，核對符號與維度
requires:
  - vector-norm-linear-combination
guide_refs:
  - guide-3:4-54
  - guide-3:4-55
textbook: v2
author: codex
status: draft
formula_groups:
  - id: neuron-output
    source: guide-3:4-55
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某製造神經元接收 x=(1,0)，w=(1,1)、偏置 −0.25，激活用 ReLU。輸出是多少？
    options:
      A: "0.75"
      B: "1"
      C: −0.25
      D: "1.75"
    answer: A
    explain:
      A: 加權和為 1×1+1×0−0.25=0.75，ReLU 保留正值。
      B: 這漏掉了偏置。
      C: 這只算了偏置而未納入第一個輸入。
      D: 這把第二個輸入誤當成 1，算成 (1,1) 的加權和。
  - id: c2
    goal: g1
    type: choice
    prompt: 同一神經元固定兩個權重，只把偏置由 −0.25 改成 0.25，輸入 x=(0,0)。哪個結果正確？
    options:
      A: 兩次輸出都是 0，因為輸入皆為 0
      B: 權重的數量由 2 變成 3
      C: ReLU 輸出由 0 變成 0.25
      D: 兩次輸出都是 −0.25
    answer: C
    explain:
      A: 零輸入時仍會先加偏置，正偏置可產生非零激活。
      B: 偏置是獨立參數，不會增加輸入對應的權重數。
      C: 加權和由 −0.25 變成 0.25，經 ReLU 後分別為 0、0.25。
      D: ReLU 不保留負值，且偏置已改變。
---

## 為什麼需要

溫度與壓力同時影響判斷時，需要一個能把多項輸入合併、再決定輸出的單元。人工神經元（Artificial Neuron）就是這個基本單元；把許多單元接起來，才形成神經網路。

## 直覺

每個輸入先乘上自己的權重，表示它在這個單元如何參與計算。全部加總後再加偏置（Bias），最後經激活函數得到輸出。

![偏置加在所有乘積加總之後，而且只加一次；最後的激活輸出才交給下一層。](figure:l23203-artificial-neuron-flow)

偏置會平移激活開始反應的位置。它不是另一筆樣本，也不是只在訓練時才出現的項目。

## 定義與公式

對一筆含 $d$ 個特徵的資料，神經元計算：

$$
z=\sum_{i=1}^{d}w_i x_i+b,\qquad a=\phi(z)
$$

$x_i$ 是第 $i$ 個輸入，$w_i$ 是對應權重，$b$ 是偏置，$z$ 是加權和，$\phi$ 是激活函數，$a$ 是輸出。$d$ 是特徵數，輸入與權重必須同樣長。

激活可以選 ReLU、Sigmoid 或 Tanh；各函數細節分別見對應概念頁。

:::supplement[來源：PyTorch Linear]
本頁輸入與權重都是長度 2 的向量，$b,z,a$ 都是純量。一層有多個單元時，權重可排成矩陣，輸出也變成向量。
:::

:::caution[注意]
指引 4-55 的加總式把每項都印成 $w_1x_1$。依同頁展開式，正確的加總項應為 $w_ix_i$，每個特徵使用自己的索引。
:::

## 算一次（補充）

使用共用例子的製造索引 1：溫度 80°C、壓力 1 bar。固定端點轉換後，輸入為 $x=(1,0)$；這是教學尺度，並非從 12 筆資料估計的平均值。

取第一個隱藏單元的 $w=(1,1)$、$b=-0.25$，激活用 ReLU，正值保留、負值變成零。

1. 兩項乘積為 $1\times1=1$、$1\times0=0$。
2. 加權和為 $z=1+0-0.25=0.75$。
3. $z$ 是正數，所以輸出 $a=0.75$。

共用例子的零售索引 1 是到訪 10 次、消費 100 元，固定轉換後同樣是 $(1,0)$。使用相同參數，就得到相同的 0.75；領域意義由欄位定義決定。

## 程式（補充）

以下讀取共用檔案，逐項核對單一神經元。所有參數固定，沒有隨機初始化。

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
n = d["network"]
x = torch.tensor(d["manufacturing"]["rows"][1]["x"], dtype=torch.float64)
w = torch.tensor(n["W1"][0], dtype=torch.float64)
b = n["b1"][0]
z = x @ w + b
a = torch.relu(z)
print("形狀:", tuple(x.shape), tuple(w.shape))
print(f"z={z.item():.2f}, a={a.item():.2f}")
```
```text
形狀: (2,) (2,)
z=0.75, a=0.75
```

:::tip[讀碼重點]
`x @ w` 把兩個向量做內積，結果是純量；`b` 在內積後才加一次。`relu` 接收的是加權和，不是原始兩欄輸入。
:::

## 怎麼用、怎麼判讀

人工神經元可接外部數值，也可接前一層神經元的輸出。指引討論的是多個輸入各配一個權重，再由偏置與激活決定最終反應。

:::supplement[來源：Stanford CS231n Modeling one neuron；PyTorch Linear]
權重大小必須連同輸入尺度與其他層一起看。不能只因溫度權重比壓力大，就宣稱溫度對真實瑕疵更重要；本例數值也不具有因果解釋。
:::

### 換個場景

| 場景 | 輸入角色 | 判讀重點 |
|---|---|---|
| 外部數值或前層輸出 | 每個分量配一個權重 | 輸入長度與權重長度一致 |
| 製造感測（補充） | 溫度、壓力的固定轉換 | 偏置改變反應位置 |
| 零售流失（補充） | 到訪、消費的固定轉換 | 相同數值不等於相同業務意義 |
| 聲音辨識（補充） | 前一層抽出的聲音特徵 | 單元輸出還要交由後層組合 |

## 常見誤解

- 「兩個輸入就加兩次偏置。」每個神經元只有自己的那一次偏置。
- 「加權和就是最後輸出。」還要經過指定的激活函數。
- 「神經元輸出一定是機率。」本例輸出是隱藏表示，沒有機率語意。（補充）

## 進階

### 從一個到一層（補充）

同一筆兩維輸入可同時送給多個神經元。每個單元保有自己的權重與偏置，輸出排成向量；這就是前向傳播中矩陣計算的來源。

### 參考來源

- 科目 3 指引 4-54、4-55：支持單元結構、輸入、偏置、激活及公式；已回 PDF 確認加總索引誤植。
- [Stanford CS231n 神經網路筆記](https://cs231n.github.io/neural-networks-1/)的 Modeling one neuron：支持直覺、權重判讀與一層多單元。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html)：支持程式的仿射計算與維度。

## 小結

- 一個輸入分量對應一個權重。
- 乘積加總後只加一次偏置，再通過激活。
- 輸入與權重長度相同，單一神經元輸出為純量。
- 隱藏單元的輸出不必是機率。（補充）
