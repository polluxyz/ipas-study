---
id: forward-propagation
title: 前向傳播
kind: technique
codes:
  - L23203
aliases:
  - Forward Propagation
summary: 前向傳播依層序把輸入變成預測，每層先加權與偏置再激活
goals:
  - id: g1
    text: 追蹤雙層網路的輸入、加權和、激活與形狀，分辨分類和迴歸輸出
requires:
  - activation-functions
  - matrix-operations
guide_refs:
  - guide-3:3-10
  - guide-3:3-12
  - guide-3:4-58
  - guide-3:4-59
textbook: v2
author: codex
status: draft
formula_groups:
  - id: layer-forward
    source: https://d2l.ai/chapter_multilayer-perceptrons/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一批製造輸入 X 形狀 (4,2)，隱藏層寬 2、輸出層寬 1，W1 用 (2,2)、W2 用 (1,2)。以每列一筆運算，正確形狀是？
    options:
      A: 隱藏 (2,4)，輸出 (1,4)
      B: 隱藏 (4,2)，輸出 (4,1)
      C: 隱藏 (4,4)，輸出 (4,2)
      D: 隱藏 (2,2)，輸出一個純量
    answer: B
    explain:
      A: 這把樣本軸與特徵軸對調，與題目每列一筆的約定不同。
      B: 四筆樣本不變，先得到兩個隱藏特徵，再得到每筆一個輸出。
      C: 層寬由神經元數決定，不是樣本數相乘。
      D: 批次計算會為四筆各保留輸出，不會自行平均成一個值。
  - id: c2
    goal: g1
    type: choice
    prompt: 某零售輸入經兩層運算得到輸出加權和 z=0.25。哪個處理最合適？
    options:
      A: 二元流失直接把 0.25 當成校準後機率
      B: 連續消費金額一定要先轉成 0 或 1
      C: 只做前向就會把權重更新一次
      D: 二元分類可經 Sigmoid，連續迴歸可用線性輸出
    answer: D
    explain:
      A: 加權和可為任意實數，不能直接當成機率。
      B: 連續金額目標不該被任意改成二元類別。
      C: 前向計算預測，參數更新是另外的步驟。
      D: 輸出處理要依任務語意安排，不能只看數值大小。
---

## 為什麼需要

輸入如何變成預測，必須有明確的運算順序。這個逐層產生預測的過程，稱為前向傳播（Forward Propagation）。前層算出的結果，接著成為後層的輸入。

它既用於訓練時取得預測，也用於模型已訓練完成後做推論。單做這個步驟不會更新權重。

## 直覺

先完成前一層的所有輸出，再送入後一層。人工神經元中的「加權和、偏置、激活」會在每層重複，直到得到最終結果。

![由上往下追蹤同一筆資料，注意第二層接收的是隱藏輸出 h，並非再次接收原始 x。](figure:l23203-forward-propagation-network)

## 定義與公式

科目 3 指引 3-10、3-12 列出逐層加權與偏置公式，4-59 再說明激活後傳給下一層。

本組用直立向量表示單筆資料，雙層計算為：

$$
\begin{aligned}
z_1&=W_1x+b_1,\quad h=\phi(z_1)\\
z_2&=W_2h+b_2,\quad p=\sigma(z_2)
\end{aligned}
$$

$x$ 是輸入，$W_1,W_2$ 是各層權重，$b_1,b_2$ 是偏置，$z_1,z_2$ 是加權和。

$h$ 是隱藏輸出，$p$ 是輸出機率，$\phi,\sigma$ 是各層的激活函數。

:::supplement[來源：本組共用網路例子；PyTorch Linear]
本組取二維輸入，$W_1$ 為 $2\times2$、$W_2$ 為 $1\times2$。第一層偏置與中間值長度 2，第二層長度 1；$\phi$ 是 ReLU，$\sigma$ 是 Sigmoid。

批次矩陣 $X$ 每列一筆，形狀 $(N,2)$，$N$ 是樣本數。第一層用 $XW_1^\mathsf{T}+b_1$ 得到 $(N,2)$，下一層得到 $(N,1)$；偏置逐筆相加。
:::

## 算一次（補充）

取製造索引 1 的 $x=(1,0)$。兩個隱藏單元各有權重 $(1,1)$，偏置依序為 $-0.25,-1.25$。

1. 第一層加權和 $z_1=(0.75,-0.25)$，形狀 $(2,)$。
2. 經 ReLU 後，$h=(0.75,0)$，形狀仍為 $(2,)$。
3. 輸出權重為 $(1,-2)$、偏置 $-0.5$，得到 $z_2=1\times0.75-2\times0-0.5=0.25$。
4. 經 Sigmoid 得 $p\approx0.562177$，以 0.5 為閾值判為 1。

四個 XOR 角點的輸出可互相比對：

| 輸入 $x$ | 隱藏表示 $h$ | 輸出加權和 | 正類機率（約） |
|---|---|---|---|
| $(0,0)$ | $(0,0)$ | $-0.5$ | 0.377541 |
| $(1,0)$ | $(0.75,0)$ | $0.25$ | 0.562177 |
| $(0,1)$ | $(0.75,0)$ | $0.25$ | 0.562177 |
| $(1,1)$ | $(1.75,0.75)$ | $-0.25$ | 0.437823 |

這套參數是刻意指定來說明計算，並非用四點訓練出的成績。它能分開四個角點，套用完整 12 筆時仍會錯判。

例如索引 7 的 $x=(0.8,0.8)$、標籤為 0，算得 $h=(1.35,0.35)$、$z_2=0.15$，卻判為 1。四個角點分對不足以代表整份資料的表現。

## 程式（補充）

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
t = lambda v: torch.tensor(v, dtype=torch.float64)
n = d["network"]
X = t([d["manufacturing"]["rows"][i]["x"] for i in d["xor_indices"]])
Z1 = X @ t(n["W1"]).T + t(n["b1"])
H = torch.relu(Z1)
Z2 = H @ t(n["W2"]).T + t(n["b2"])
P = torch.sigmoid(Z2)
print("形狀:", tuple(X.shape), tuple(H.shape), tuple(P.shape))
print("logits:", Z2.flatten().tolist())
print("機率:", [round(v, 6) for v in P.flatten().tolist()])
x7 = t(d["manufacturing"]["rows"][7]["x"])
h7 = torch.relu(x7 @ t(n["W1"]).T + t(n["b1"]))
z7 = h7 @ t(n["W2"]).T + t(n["b2"])
print(f"索引 7: z={z7.item():.2f}, 預測={int(torch.sigmoid(z7).item() >= n['threshold'])}, 標籤={d['manufacturing']['rows'][7]['label']}")
```
```text
形狀: (4, 2) (4, 2) (4, 1)
logits: [-0.5, 0.25, 0.25, -0.25]
機率: [0.377541, 0.562177, 0.562177, 0.437823]
索引 7: z=0.15, 預測=1, 標籤=0
```

:::tip[讀碼重點]
批次使用每列一筆，所以權重要轉置；`H` 同時保留樣本軸與隱藏單元軸。最後沒有把四筆平均，因為每筆各有一個預測。
:::

## 怎麼用、怎麼判讀

指引讓圖片像素、文本特徵等輸入沿層前進。先檢查張量形狀，再檢查輸出語意：分類可能產生類別或機率，迴歸則產生連續數值。

| 任務 | 常見輸出安排 | 判讀 |
|---|---|---|
| 二元分類 | 1 個值經 Sigmoid | 正類機率，再選閾值 |
| 互斥多類分類 | 類別數個值經 Softmax | 一筆各類機率總和為 1 |
| 連續迴歸 | 所需維度個線性輸出 | 依目標單位解讀 |

上表安排也見指引 4-65、4-66。輸出與損失的 API 搭配見[交叉熵損失的框架輸入對照](/concepts/cross-entropy-loss/#框架輸入對照補充)。

### 換個場景

| 場景 | 輸入或輸出 | 判讀重點 |
|---|---|---|
| 圖片、文本特徵 | 逐層形成中間輸出 | 後層接前層結果 |
| 製造瑕疵（補充） | 每筆一個瑕疵機率 | 不把批次軸誤當特徵軸 |
| 零售流失（補充） | 相同兩維轉換與輸出 | 先對齊欄位順序再推論 |
| 能源需求（補充） | 每筆一個連續需求量 | 可改線性輸出，保留單位 |

## 常見誤解

- 「前向傳播必須先有真實標籤。」推論不需要標籤；評估損失時才需要。（補充）
- 「所有層的輸出形狀都相同。」特徵寬度會隨層改變，樣本數通常保留。（補充）
- 「輸出加權和就是機率。」本例要再經 Sigmoid 才有機率範圍。

## 進階

### 預測與損失分開看（補充）

網路先產生預測，損失再比較預測與標籤。這個分工能幫助讀懂程式：有預測而沒有損失，仍是完整的推論；有損失但尚未求梯度，也還沒有參數更新。

### 參考來源

- 科目 3 指引 3-10、3-12：支持逐層加權與偏置公式；4-58、4-59 支持逐層資料流、輸入例子與分類／迴歸差異；4-65、4-66 支持輸出安排。
- [Dive into Deep Learning 5.1.1.3、5.1.2](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)：支持含偏置的逐層公式、ReLU 與 Sigmoid；本頁將其列向量批次記法換成單筆直立向量。
- [Dive into Deep Learning 5.3](https://d2l.ai/chapter_multilayer-perceptrons/backprop.html)：支持資料流與中間變數；該節範例省略偏置。
- [Stanford CS231n Example feed-forward computation](https://cs231n.github.io/neural-networks-1/)：支持算例的分層講解。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html)：支持批次矩陣方向與偏置廣播。

## 小結

- 前向傳播依層序產生預測。
- 每層先加權與偏置，再用指定激活。
- 形狀要分清樣本數、輸入寬度與輸出寬度。（補充）
- 分類機率與連續迴歸輸出有不同語意。
