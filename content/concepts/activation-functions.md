---
id: activation-functions
title: 激活函數的非線性與飽和
kind: component
codes:
  - L23203
aliases:
  - Activation Function
summary: 非線性激活讓多層網路學習複雜關係，輸出有界仍可能在飽和時梯度變小
goals:
  - id: g1
    text: 比較三種激活的範圍、非線性與飽和，解釋純線性層為何可合併
requires:
  - artificial-neuron
guide_refs:
  - guide-3:4-57
  - guide-3:4-58
textbook: v2
author: codex
status: draft
formula_groups:
  - id: linear-collapse
    source: https://d2l.ai/chapter_multilayer-perceptrons/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某網路有 2 個全連接層，中間完全不加非線性。團隊把層數從 2 增至 8，哪個判斷正確？
    options:
      A: 8 層就保證能解 XOR
      B: 每一層都會自動產生曲線邊界
      C: 整體仍可合併成一個仿射轉換
      D: 只要有偏置，整體就不再線性
    answer: C
    explain:
      A: 若中間仍是線性或仿射，增加層數不會自動形成非線性表示。
      B: 全連接本身只做仿射轉換，非線性要由其他運算引入。
      C: 多個仿射轉換可合併權重與偏置，沒有增加非線性表達能力。
      D: 偏置改變截距，但仿射轉換的合成仍是仿射。
  - id: c2
    goal: g1
    type: choice
    prompt: 工程師發現 Sigmoid 隱藏單元的輸入長期在 20 附近，輸出接近 1。哪個解釋合理？
    options:
      A: 輸出飽和，局部斜率很小，回傳梯度可能衰減
      B: 輸出在 0 到 1 之間，所以梯度不可能消失
      C: ReLU 在正輸入區也一定同樣飽和
      D: Tanh 只在正側飽和，負側不會
    answer: A
    explain:
      A: 靠近飽和端時輸出變動很慢，不能用有界性保證梯度穩定。
      B: 有界輸出不等於導數不小，兩者是不同問題。
      C: ReLU 正側保持斜率，不會像 Sigmoid 正端逐漸變平。
      D: Tanh 的正負兩端都可能飽和。
---

## 為什麼需要

只有加權和與偏置時，多層網路仍只是在反覆做線性組合。激活函數（Activation Function）引入非線性，讓中間表示能處理更複雜的關係。

指引以圖像、語音辨識說明非線性需求。層數增加必須搭配合適的非線性，才能超出單一線性模型的表達形式。

## 直覺

加權和先把輸入整合成一個數，激活再決定它如何傳下去。ReLU 把負值截成零；Sigmoid 與 Tanh 則把數值壓到有限範圍。

![三圖共用加權和範圍，但縱軸刻度不同；看兩端是否變平，不要只比較曲線高度。](figure:l23203-activation-functions-curves)

三種曲線都不是一條完整的直線，這正是引入非線性的地方。

## 定義與公式

本頁比較角色與範圍；ReLU、Sigmoid、Tanh 的個別公式、代入與導數，分別見各自概念頁。

| 函數 | 輸入如何轉換 | 輸出範圍 |
|---|---|---|
| ReLU | 負值變零，正值保留 | $[0,\infty)$ |
| Sigmoid | 平滑壓到零與一之間 | $(0,1)$ |
| Tanh | 平滑壓到負一與一之間 | $(-1,1)$ |

:::supplement[來源：Dive into Deep Learning 5.1；Keras Layer activation functions]
Sigmoid、Tanh 的兩端逐漸變平，稱為飽和（Saturation）；ReLU 的正側則持續增長。非線性與兩端是否飽和，是兩個不同的觀察面向。

有限實數輸入下，Sigmoid 與 Tanh 的端點是漸近值。指引以閉區間簡寫，本頁用開區間描述嚴格範圍；Tanh 也以零為中心，與 Sigmoid 不同。

ReLU 負側斜率為零，正側不飽和；Sigmoid 與 Tanh 的兩端斜率則很小。這些局部斜率會影響反向傳回的梯度。

輸出有界不保證梯度不消失。指引 4-58 把壓縮範圍與避免梯度消失連在一起，需加上這項限制：飽和時局部導數變小，多層連乘反而可能讓梯度衰減。
:::

### 沒有非線性時

指引 4-55、4-57 說明，中間沒有非線性激活時，多層仍等同單層線性模型。以下進一步展開含偏置的合併過程。

:::supplement[來源：Dive into Deep Learning 5.1.1.3]
對同一筆輸入，若中間層直接使用加權和：

$$
\begin{aligned}
h&=W_1x+b_1\\
z_2&=W_2h+b_2\\
&=(W_2W_1)x+(W_2b_1+b_2)
\end{aligned}
$$

$x$ 是二維輸入，$W_1$ 為 $2\times2$，$b_1,h$ 為長度 2，$W_2$ 為 $1\times2$，$b_2,z_2$ 為長度 1。合併後仍是一個權重矩陣加偏置的仿射轉換。
:::

## 算一次（補充）

共用網路的兩列 $W_1$ 都是 $(1,1)$，$b_1=(-0.25,-1.25)$；輸出權重 $W_2=(1,-2)$，$b_2=-0.5$。

不加非線性時，合併權重為 $(-1,-1)$，合併偏置為 $1.75$。輸入製造索引 1 的 $(1,0)$，直接合併算得 $z_2=-1+1.75=0.75$。

分層算也相同：隱藏值 $(0.75,-0.25)$，輸出是 $0.75-2(-0.25)-0.5=0.75$。因此拆兩層並未增加非線性。

插入 ReLU 後，隱藏值變為 $(0.75,0)$，輸出加權和改成 $0.25$。這是新表示帶來的差異，不是單純多乘一次矩陣。

## 程式（補充）

程式只核對線性層能否合併；各激活函數的讀碼留在個別頁面。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
n = d["network"]
x = np.array(d["manufacturing"]["rows"][1]["x"])
W1, W2 = np.array(n["W1"]), np.array(n["W2"])
b1, b2 = np.array(n["b1"]), np.array(n["b2"])
stacked = W2 @ (W1 @ x + b1) + b2
merged = (W2 @ W1) @ x + (W2 @ b1 + b2)
print("合併權重:", (W2 @ W1).tolist())
print("分層/合併:", stacked.tolist(), merged.tolist())
```
```text
合併權重: [[-1, -1]]
分層/合併: [0.75] [0.75]
```

## 怎麼用、怎麼判讀

先區分隱藏層與輸出層。隱藏層需要非線性表示；輸出層還要配合任務，例如二元分類可用 Sigmoid 表達正類機率。

:::supplement[來源：Stanford CS231n Commonly used activation functions]
Sigmoid 的數值落在零與一之間，不表示任意隱藏單元都能解釋成事件機率。必須有相應的標籤、損失與訓練語意；不能只看數值範圍。
:::

### 換個場景

| 場景 | 為何需要激活 | 判讀重點 |
|---|---|---|
| 圖像、語音辨識 | 多層組合非線性模式 | 只有線性層可被合併 |
| 製造感測（補充） | 兩指標的交互關係 | 隱藏表示改變分類邊界 |
| 零售流失（補充） | 非線性特徵組合與二元輸出 | 隱藏激活與機率輸出角色不同 |
| 能源迴歸（補充） | 隱藏層學非線性，最後預測數值 | 輸出不必被壓在零與一 |

## 常見誤解

- 「有八層就一定比一層有非線性。」中間若全是仿射轉換，仍可合併。
- 「輸出壓小就能避免梯度消失。」飽和時導數反而很小。（補充）
- 「ReLU 任何位置都能回傳非零梯度。」負側斜率為零。（補充）

## 進階

### 局部直線與整體非線性（補充）

ReLU 在每一側都是直線，但整體在零點改變斜率。許多這類單元組合後，可形成分段的非線性映射；不需要每個位置都彎曲才叫非線性。

### 參考來源

- 科目 3 指引 4-57、4-58：支持非線性、激活與輸出壓縮；飽和的梯度限制另行校正。
- [Keras 激活函數文件](https://keras.io/api/layers/activations/)：支持三函數定義、範圍與邊界。
- [Dive into Deep Learning 5.1](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)：支持曲線、線性層合併與飽和。
- [Stanford CS231n](https://cs231n.github.io/neural-networks-1/)的 Commonly used activation functions：支持隱藏層選擇與限制。

## 小結

- 非線性是多層網路超出單層線性模型的關鍵。
- ReLU、Sigmoid、Tanh 的輸出範圍不同。
- 飽和與梯度穩定不是同一件事。（補充）
- 個別函數公式見各自頁面，本頁用線性合併反例理解角色。
