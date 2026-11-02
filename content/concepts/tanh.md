---
id: tanh
title: Tanh
kind: component
codes: [L23203, L23304]
aliases: [雙曲正切]
summary: Tanh 把實數壓到負一與一之間，正負輸入呈零中心對稱
goals:
  - id: g1
    text: 計算 Tanh 輸出，與 Sigmoid 比較零中心、範圍及飽和限制
requires: [activation-functions]
guide_refs: [guide-3:5-37, guide-3:4-58, guide-3:4-73]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: tanh-output
    source: guide-3:5-37
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
  - id: tanh-derivative
    source: https://d2l.ai/chapter_multilayer-perceptrons/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療網路把兩個隱藏層輸入 −1、1 分別送進 Tanh。輸出最接近哪一組？
    options:
      A: （−0.7616、0.7616）
      B: （0.2689、0.7311）
      C: （−1.0000、1.0000）
      D: （0.0000、1.0000）
    answer: A
    explain:
      A: 正負一代入 Tanh 得到大小相同、正負相反的兩值。
      B: 這組是 Sigmoid 的輸出，不具有零中心對稱。
      C: 負一與一是漸近端點，不是有限輸入正負一的輸出。
      D: 這組是 ReLU 的截零結果，不是平滑的 Tanh。
  - id: c2
    goal: g1
    type: choice
    prompt: 客服網路同一個 Tanh 單元的輸入從 0 移到 4，輸出約從 0 變成 0.9993。哪個判讀正確？
    options:
      A: 輸出接近一，所以局部斜率也從一升到四
      B: 輸出零中心，所以單批輸出平均必定為零
      C: 輸出接近飽和，局部斜率約從一降至 0.0013
      D: 輸出保持有界，所以多層梯度必定不會衰減
    answer: C
    explain:
      A: 輸出值與局部斜率是不同的量，正端變平時局部斜率會下降。
      B: 函數對稱不要求這批輸入也對稱，輸出平均沒有保證。
      C: 局部斜率為一減輸出平方，輸入四時約為 0.0013。
      D: 有界性不排除飽和，局部斜率連乘仍可能衰減。
---

## 為什麼需要

有些隱藏表示需要用正值與負值表達相反方向，Sigmoid 全是正輸出，不易直接呈現這種對稱。Tanh（Hyperbolic Tangent，雙曲正切）提供以零為中心的有界輸出。

指引把它用在深度網路隱藏層，以及需要正負輸出對稱的資料。指引 4-73 提到循環神經網路的隱藏狀態可用 Tanh 或 ReLU 轉換。

## 直覺

Tanh 通過原點，正負輸入得到正負相反的輸出。Sigmoid 的輸出都在零與一之間，兩者的中心位置不同。

![實線 Tanh 通過原點，虛線 Sigmoid 通過 0.5；下圖共用局部斜率軸，兩種函數的兩端都變平。](figure:l23203-tanh-output-gradient)

:::supplement[來源：Dive into Deep Learning 5.1.2.2–5.1.2.3]
兩端越接近水平，局部斜率越小。零中心能描述正負方向，但不能防止飽和區的梯度衰減。

指引 4-58 將輸出壓縮與避免梯度消失連在一起，不能當成保證。校正見「激活函數的非線性與飽和」頁的「定義與公式」。
:::

## 定義與公式

$$
\tanh(x)=\frac{e^x-e^{-x}}{e^x+e^{-x}}
$$

$x$ 是實數輸入，$e$ 是自然指數的底數，$\tanh(x)$ 是轉換後的輸出。正負輸入對稱，零輸入的分子為零，因此輸出也是零。

:::supplement[來源：Keras Layer activation functions]
有限實數的嚴格輸出範圍是 $(-1,1)$。指引以負一到一概述範圍；端點在數學上是漸近值，浮點顯示可能因取整而等於端點。
:::

### 局部斜率（補充）

$$
\tanh'(x)=1-\tanh^2(x)
$$

$\tanh'(x)$ 是輸出對輸入的局部斜率（導數）。輸入零時為 $1-0^2=1$；輸出接近正一或負一時，局部斜率都接近零。

## 算一次（補充）

沿用醫療 M01–M05 的 5 個給定分數作隱藏層輸入。與 Sigmoid 頁使用同一組分數，方便直接比較。

| 輸入 $x$ | Tanh 輸出 | Sigmoid 輸出 | Tanh 局部斜率 |
|---|---|---|---|
| −4 | −0.9993 | 0.0180 | 0.0013 |
| −1 | −0.7616 | 0.2689 | 0.4200 |
| 0 | 0.0000 | 0.5000 | 1.0000 |
| 1 | 0.7616 | 0.7311 | 0.4200 |
| 4 | 0.9993 | 0.9820 | 0.0013 |

代入 $x=1$，分子約 2.35040、分母約 3.08616，相除得 0.7616。再用未取整值求局部斜率，$1-0.76159416^2\approx0.4200$。

輸入 −1 交換分子兩項的次序，分母不變，所以輸出 −0.7616。這五筆對稱輸入的平均輸出是零，但任意一批資料不一定對稱。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))
x = np.array(d["probes"], dtype=float)
y = np.tanh(x)
print("輸出:", np.round(y, 4).tolist())
print("局部斜率:", np.round(1-y*y, 4).tolist())
print("僅取正輸入的平均:", round(float(y[x > 0].mean()), 4))
```
```text
輸出: [-0.9993, -0.7616, 0.0, 0.7616, 0.9993]
局部斜率: [0.0013, 0.42, 1.0, 0.42, 0.0013]
僅取正輸入的平均: 0.8805
```

:::tip[讀碼重點]
`tanh` 逐項轉換。最後一行只取正輸入，直接顯示「函數零中心」不等於「這批輸出平均必為零」。
:::

## 怎麼用、怎麼判讀

需要正負對稱的隱藏表示時，可考慮 Tanh。相較 Sigmoid，它在原點的局部斜率較大，但不能僅憑這點保證整個模型學得更快。

:::supplement[來源：Dive into Deep Learning 5.1.2.3；Stanford CS231n Commonly used activation functions]
若中間輸入常落在正負四附近，本例的局部斜率約 0.0013，已明顯飽和。選擇激活時要看輸入尺度、初始化與梯度，而不是只看輸出有沒有負數。
:::

### 換個場景

| 場景 | 使用位置或條件 | 判讀重點 |
|---|---|---|
| 深度網路隱藏層 | 需要正負對稱表示 | 零輸入映到零 |
| 循環神經網路 | 可用 Tanh 或 ReLU 轉換隱藏狀態 | 與時間遞迴搭配 |
| 醫療隱藏特徵（補充） | 正負方向的示意分數 | 負輸出不是負機率 |
| 客服語意表示（補充） | 隱藏特徵保留正負 | 監看輸入是否長期飽和 |

## 常見誤解

- 「Tanh 可以直接當成事件機率。」負值不符合機率範圍，隱藏值也不是自動具有機率語意。（補充）
- 「零中心表示每批平均輸出都是零。」只有合適的對稱輸入才有這種結果。（補充）
- 「Tanh 比 Sigmoid 一定不會梯度消失。」它的正負兩端同樣飽和。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-37`、`guide-3:4-73`：支持公式、正負對稱、隱藏層與循環網路場景；公式已回看 PDF 171 頁。
- 科目 3 指引 `guide-3:4-58`：列出 Tanh 與輸出壓縮；其避免梯度消失的說法需加限制，見直覺與激活函數的非線性與飽和的校正。
- [Keras 激活函數文件](https://keras.io/api/layers/activations/)：支持定義與範圍。
- [Dive into Deep Learning 5.1.2.3](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)：支持導數、飽和與算一次、程式的補深。
- [Stanford CS231n 激活函數課程](https://cs231n.github.io/neural-networks-1/)：支持怎麼用中零中心與飽和的取捨。

## 小結

- Tanh 輸出有正有負，函數以零為中心。
- 正負一輸入約得到正負 0.7616。
- 原點局部斜率較大不代表整體訓練必然較快。
- 兩端仍會飽和，批次平均也不保證為零。（補充）
