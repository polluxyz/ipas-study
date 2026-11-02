---
id: sigmoid
title: Sigmoid
kind: component
codes: [L23203, L21103, L23304]
aliases: [邏輯激活函數]
summary: Sigmoid 把單一分數壓到零與一之間，適合逐個二元標籤輸出
goals:
  - id: g1
    text: 計算 Sigmoid 輸出與飽和區局部斜率，區分二元及多標籤機率
requires: [activation-functions]
contrasts:
  - target: softmax
    note: Sigmoid 逐標籤做二元輸出且總和不受限；Softmax 用於互斥單選並使總和為一
    source: [guide-3:5-36, guide-3:5-37]
  - target: tanh
    note: Sigmoid 輸出以 0.5 為中心；Tanh 對正負輸入產生零中心的對稱輸出
    source: [guide-3:5-37]
guide_refs: [guide-3:5-36, guide-3:5-37, guide-3:4-58, guide-3:4-65]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: sigmoid-output
    source: guide-3:5-36
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
  - id: sigmoid-derivative
    source: https://d2l.ai/chapter_multilayer-perceptrons/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療二元模型給一筆資料的 logit 為 1。經 Sigmoid 的正類輸出最接近多少？
    options:
      A: "0.2689"
      B: "0.7311"
      C: "0.5000"
      D: "1.0000"
    answer: B
    explain:
      A: 這是輸入負一的結果，符號方向相反。
      B: 一除以一加 exp(−1)，約為 0.7311。
      C: 只有輸入零時才得到 0.5。
      D: 有限輸入一不會使數學輸出剛好等於一。
  - id: c2
    goal: g1
    type: choice
    prompt: 一則客服訊息可同時有「需退款」與「有客訴」。兩個標籤的 logit 都為 1，各自經 Sigmoid 後，哪個判讀正確？
    options:
      A: 兩值各為 0.5，因兩個標籤的機率總和必須為一
      B: 兩值各為 0.7311，因此可證明兩個標籤統計獨立
      C: 兩值各為 0.7311，但只能保留其中一個標籤成立
      D: 兩值各為 0.7311，總和可大於一且可同時成立
    answer: D
    explain:
      A: 逐項 Sigmoid 不把兩個輸出相除，也不限制總和。
      B: 分別做二元輸出沒有證明標籤間的統計獨立。
      C: 多標籤容許同時成立，不需要以最大值強迫單選。
      D: 每個標籤各有二元機率，原值加總後總和約 1.4621，並不矛盾。
---

## 為什麼需要

模型的加權輸入可能是任意實數，直接讀成機率會遇到負數或大於一。Sigmoid（邏輯激活函數）把一個分數平滑轉成零與一之間的值，常用於二元分類輸出。

若同一筆資料可同時帶多個標籤，每個標籤也能各用一個 Sigmoid；不必把所有標籤強迫分成只能選一個。

## 直覺

輸入越往正側，輸出越接近一；越往負側，越接近零。它不會像 ReLU 一樣把所有負數截成相同值，曲線中間仍平滑變動。

![上圖看輸入零對應 0.5；下圖看兩端局部斜率變小，不要把接近一當成學習更快。](figure:l23203-sigmoid-output-gradient)

:::supplement[來源：Dive into Deep Learning 5.1.2.2]
兩端曲線逐漸變平，稱為飽和。此時輸入改變一些，輸出卻幾乎不動，局部斜率很小，連續多層可能讓梯度衰減。

指引 4-58 把輸出壓縮與避免梯度消失連在一起，但輸出有界不保證梯度不消失。校正見「激活函數的非線性與飽和」頁的「定義與公式」。
:::

## 定義與公式

$$
\sigma(x)=\frac{1}{1+e^{-x}}
$$

$x$ 是實數輸入，$\sigma(x)$ 是輸出，$e$ 為自然指數的底數。這裡輸出層未經壓縮的分數稱為 logit。

:::supplement[來源：Keras Layer activation functions]
有限實數輸入的嚴格範圍是 $(0,1)$；零與一是漸近端點。浮點計算在極端輸入可能顯示端點值，不能據此修改數學範圍。
:::

### 局部斜率（補充）

$$
\sigma'(x)=\sigma(x)\bigl(1-\sigma(x)\bigr)
$$

$\sigma'(x)$ 是輸出對輸入的局部斜率（導數）。輸出越接近零或一，乘積越小；在 $x=0$，局部斜率為 $0.5(1-0.5)=0.25$。

## 算一次（補充）

使用醫療 M01–M05 的 5 個給定分數。這裡把它們當作二元輸出層的 logit，正類定為「需進一步檢查」；只示範轉換，不據此提供臨床判斷。

| logit | Sigmoid 輸出 | 局部斜率 |
|---|---|---|
| −4 | 0.0180 | 0.0177 |
| −1 | 0.2689 | 0.1966 |
| 0 | 0.5000 | 0.2500 |
| 1 | 0.7311 | 0.1966 |
| 4 | 0.9820 | 0.0177 |

M04 的 $x=1$，代入得 $1/(1+e^{-1})\approx0.7311$。以原值求局部斜率，$0.73105858(1-0.73105858)\approx0.1966$。

客服 S01 的三個多標籤分數是 $(1,1,-1)$。逐項輸出約 $(0.7311,0.7311,0.2689)$，總和約 1.7311；這三個標籤可以同時成立，總和不需是一。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))
x = np.array(d["probes"], dtype=float)
p = 1 / (1 + np.exp(-x))
tags = 1 / (1 + np.exp(-np.array(d["service"]["rows"][0]["tag_logits"])))
print("輸出:", np.round(p, 4).tolist())
print("局部斜率:", np.round(p * (1-p), 4).tolist())
print("標籤:", np.round(tags, 4).tolist(), "總和:", round(float(tags.sum()), 4))
```
```text
輸出: [0.018, 0.2689, 0.5, 0.7311, 0.982]
局部斜率: [0.0177, 0.1966, 0.25, 0.1966, 0.0177]
標籤: [0.7311, 0.7311, 0.2689] 總和: 1.7311
```

:::tip[讀碼重點]
這個 NumPy 寫法用於本例的有限範圍。訓練時若損失已接收 logits，就不要先加 Sigmoid 再把結果當 logits 傳入。
:::

## 怎麼用、怎麼判讀

二元分類通常用一個輸出表達正類機率，另一類為其補數。多標籤分類則每個輸出各做二元判斷，機率總和不受限制。

:::supplement[來源：PyTorch BCEWithLogitsLoss 官方文件]
「各自做二元判斷」不是證明標籤在統計上獨立。兩個標籤可以共享特徵，也可能高度相關；輸出層形式只指定如何表示各標籤的分數。

PyTorch 的 `BCEWithLogitsLoss` 接收原始 logits，內部整合 Sigmoid 與二元交叉熵；推論要顯示機率時再轉換。機率值是否校準仍需另外評估。
:::

### 換個場景

| 場景 | 輸出安排 | 判讀重點 |
|---|---|---|
| 二元分類 | 一個 Sigmoid | 指定哪類為正類 |
| 多標籤分類 | 每標籤一個 Sigmoid | 可多個同時成立，總和不受限 |
| 醫療篩檢（補充） | 是否需進一步檢查 | 轉換值不等於已驗證的風險 |
| 客服標記（補充） | 需退款、有客訴、需改址 | 每標籤可用不同閾值 |

## 常見誤解

- 「三個 Sigmoid 輸出總和一定為一。」逐項轉換沒有這項約束。
- 「每個標籤分開輸出，就表示它們互不相關。」輸出形式無法推出統計獨立。（補充）
- 「輸出越接近一，梯度一定越大。」局部斜率在兩端反而較小。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-36`、`guide-3:4-65`：支持公式與二元用途；公式已回看 PDF 170 頁。
- 科目 3 指引 `guide-3:5-37`：原文作「標籤分類」，並說各類各做二元判斷、總和不必為一；本頁據此解讀為多標籤分類。
- 科目 3 指引 `guide-3:4-58`：介紹輸出壓縮；不能據此保證梯度不消失，校正見直覺與激活函數的非線性與飽和。
- [Keras 激活函數文件](https://keras.io/api/layers/activations/)：支持定義與數學範圍。
- [Dive into Deep Learning 5.1.2.2](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)：支持導數、飽和、算一次的補深與曲線安排。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.15/generated/torch.nn.BCEWithLogitsLoss.html)：支持怎麼用中的 logits 契約與多標籤二元損失。

## 小結

- Sigmoid 把實數壓到零與一之間，零輸入得到 0.5。
- 二元分類一個輸出；多標籤每個標籤一個輸出。
- 多標籤的機率總和不需為一。
- 飽和時局部斜率很小；逐標籤輸出也不保證統計獨立。（補充）
