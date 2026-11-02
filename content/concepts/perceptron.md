---
id: perceptron
title: 感知器與線性可分性
kind: model
codes:
  - L23203
aliases:
  - XOR
summary: 感知器以一個線性邊界做二元決策，無法分開對角同類的 XOR 點集
goals:
  - id: g1
    text: 用步階決策與錯誤更新判斷線性可分點集，說明單一感知器的 XOR 限制
requires:
  - artificial-neuron
guide_refs:
  - guide-3:4-55
  - guide-3:4-56
textbook: v2
author: codex
status: draft
formula_groups:
  - id: step-decision
    source: guide-3:4-56
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
  - id: perceptron-update
    source: https://cs229.stanford.edu/notes2022fall/main_notes.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
  - id: xor-contradiction
    source: https://www.deeplearningbook.org/contents/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 四點 (0,0)、(1,0)、(0,1)、(1,1) 的標籤依序是 0、1、1、0。單一感知器嘗試 1000 輪仍有錯誤，最合理的結論是？
    options:
      A: 把學習率降到 0 就能分開
      B: 把同一個線性權重放大就能增加彎曲邊界
      C: 只要增加到 2000 輪就保證正確
      D: XOR 點集無法用一條直線分開
    answer: D
    explain:
      A: 零學習率只會停止更新，不改變可分性。
      B: 放大權重仍是同類型的直線邊界。
      C: 增加迭代不會擴充模型可表達的邊界。
      D: 對角同類的四點在線性決策規則下互相矛盾。
  - id: c2
    goal: g1
    type: choice
    prompt: 感知器 w=(1,1)、b=−0.25，遇到 x=(1,1)、y=0；預測規則 z≥0 判 1，學習率 0.1。一次錯誤更新後為何？
    options:
      A: w=(1.1,1.1)、b=−0.15
      B: w=(0.9,0.9)、b=−0.35
      C: w=(0.9,0.9)、b=−0.25
      D: w=(0,0)、b=0
    answer: B
    explain:
      A: 這是把錯判為正類時的修正方向反過來。
      B: 預測為 1、誤差為 −1，權重各減 0.1、偏置也減 0.1。
      C: 這只更新權重而漏了偏置。
      D: 錯誤更新不是把所有參數清零。
---

## 為什麼需要

感知器（Perceptron）把人工神經元變成簡單的二元分類器：先算加權和，再以步階函數輸出 0 或 1。它適合用來理解分類邊界，也能揭示單一神經元的限制。

## 直覺

兩個特徵時，感知器把平面切成兩側。同類點若能落在同一側，就有機會用一條直線分開；對角交錯的 XOR 點集做不到。

![兩張圖使用同一組座標；上圖的 OR 可用虛線分開，下圖 XOR 的同類位於對角。](figure:l23203-perceptron-separability)

## 定義與公式

本頁採用閾值為零、等於零判為 1 的規則：

$$
z=w_1x_1+w_2x_2+b,\qquad
\hat y=\begin{cases}1&z\ge0\\0&z<0\end{cases}
$$

$x_1,x_2$ 是兩個特徵，$w_1,w_2$ 是權重，$b$ 是偏置，$z$ 是純量加權和，$\hat y$ 是預測類別。邊界是 $z=0$，不會因訓練更多次就變成曲線。

指引說明：預測錯誤時調整權重與偏置，並反覆處理樣本。下面把這項敘述寫成可核算的更新式。

:::supplement[來源：Stanford CS229 Lecture Notes 2.2]
對標籤 $y\in\{0,1\}$ 與正的學習率 $\eta$：

$$
w_i^{\mathrm{new}}=w_i+\eta(y-\hat y)x_i,\qquad
b^{\mathrm{new}}=b+\eta(y-\hat y)
$$

$i$ 是特徵索引，右側全部使用同一舊狀態。正確分類時差值為零；錯判為正類時差值為負，降低該點的加權和。這不是對步階函數使用一般反向傳播。
:::

## 算一次（補充）

共用索引 0–3 的標籤先改為 OR：0、1、1、1。取權重 $(1,1)$、偏置 $-0.25$，四個加權和為 −0.25、0.75、0.75、1.75，因此全部分對。

現在改回製造瑕疵的 XOR 標籤 $0,1,1,0$。同一參數會把 $(1,1)$ 錯判成 1；令 $\eta=0.1$，誤差 $y-\hat y=-1$。

逐項代入後，兩個新權重都是 $1+0.1(-1)\times1=0.9$，新偏置是 $-0.25+0.1(-1)=-0.35$。這是一次合法更新，不代表已經找到能分開四點的直線。

### 為何任何直線都不行（補充）

若四點能依本頁閾值規則分對，負類 $(0,0)$ 與 $(1,1)$ 要求：

$$
b<0,\qquad w_1+w_2+b<0
$$

正類 $(1,0)$、$(0,1)$ 則要求：

$$
w_1+b\ge0,\qquad w_2+b\ge0
$$

兩個正類條件相加得 $w_1+w_2+b\ge-b>0$，與負類條件矛盾。這裡的 $w_1,w_2,b$ 是任意候選參數，因此問題出在模型形式，並非只因初始值不好。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
X = np.array([d["manufacturing"]["rows"][i]["x"] for i in d["xor_indices"]])
w = np.array(d["network"]["W1"][0], dtype=float)
b = d["network"]["b1"][0]
pred = (X @ w + b >= 0).astype(int)
print("步階預測:", pred.tolist())
error = 0 - pred[3]
w = w + d["learning_rate"] * error * X[3]
b = b + d["learning_rate"] * error
print("更新:", w.round(2).tolist(), round(b, 2))
```
```text
步階預測: [0, 1, 1, 1]
更新: [0.9, 0.9] -0.35
```

:::tip[讀碼重點]
`>= 0` 明確規定邊界怎麼判。程式只展示一筆錯誤更新；不能拿有限次訓練失敗當成 XOR 不可分的數學證明，證明見上面的矛盾條件。
:::

## 怎麼用、怎麼判讀

指引將線性可分的二元分類列為感知器可處理的資料條件，並以 XOR 說明限制。先畫點集與標籤，比盲目增加迭代次數更能發現邊界形式不合適。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 線性可分二元分類 | 一條邊界可完全分開 | 可用簡單步階決策 |
| 製造感測（補充） | 兩指標不一致才標瑕疵 | XOR 關係不能靠單一直線 |
| 零售流失（補充） | 到訪與消費呈交互模式 | 非線性需額外表示或多層模型 |
| 信用初篩（補充） | 兩特徵可被線性邊界近似 | 不要把線性近似當成必然可分 |

## 常見誤解

- 「多跑幾輪就能解 XOR。」迭代不會改變單一直線的表達限制。
- 「感知器輸出的 1 是 100% 機率。」它是步階類別，並非機率估計。（補充）
- 「多層感知機只是反覆訓練同一個感知器。」它增加隱藏表示與非線性，不只是增加次數。（補充）

## 進階

### 可分性與收斂（補充）

對線性可分的有限資料，合適的感知器更新可在有限次錯誤後找到分隔面。含標註衝突或不可分資料時，不能承諾零錯誤收斂；實務仍需停止條件與驗證。

### 參考來源

- 科目 3 指引 4-55、4-56：支持步階、錯誤更新流程、線性可分與 XOR；公式已回 PDF 核對。
- [Stanford CS229 講義 2.2](https://cs229.stanford.edu/notes2022fall/main_notes.pdf)：支持更新式與錯誤方向。
- [Deep Learning 第 6.1 節](https://www.deeplearningbook.org/contents/mlp.html)：支持 XOR 與隱藏表示的必要性。
- [scikit-learn Perceptron](https://scikit-learn.org/stable/modules/linear_model.html#perceptron)：支持線性分類器定位與限制。

## 小結

- 感知器以加權和加步階做二元分類。
- 預測錯誤時調整權重與偏置。
- XOR 的對角標籤無法用一條直線分開。
- 一次更新算對，不代表模型能完全擬合資料。（補充）
