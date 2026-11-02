---
id: relu
title: ReLU
kind: component
codes: [L23203, L23304]
aliases: [Rectified Linear Unit, 整流線性單元]
summary: ReLU 保留正輸入並把負輸入設為零，常用於隱藏層
goals:
  - id: g1
    text: 算出 ReLU 輸出與局部斜率，說明隱藏層用途及死亡神經元風險
requires: [activation-functions]
guide_refs: [guide-3:5-36, guide-3:4-57, guide-1:3-48, guide-1:3-49]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: relu-output
    source: guide-3:5-36
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
  - id: relu-derivative
    source: https://d2l.ai/chapter_multilayer-perceptrons/mlp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療模型某隱藏層的三個加權輸入為 −4、0、4。使用標準 ReLU 後，輸出依序為何？
    options:
      A: （−4、0、4）
      B: （0、0.5、1）
      C: （0、0、4）
      D: （−1、0、1）
    answer: C
    explain:
      A: 負數不能原樣通過 ReLU，−4 要改成零。
      B: 這像機率壓縮，但 ReLU 不把正數限制在一以內。
      C: 非正數輸出零，正數四保持四。
      D: ReLU 不把負數壓成負一，也不把正數壓成一。
  - id: c2
    goal: g1
    type: choice
    prompt: 客服網路的一個 ReLU 單元連續 10 輪對全部訓練樣本的加權輸入都小於 −1。哪個判讀最合理？
    options:
      A: 輸出與局部斜率皆為零，該單元可能死亡
      B: 輸出與局部斜率皆為一，該單元保持活躍
      C: 輸出為零但局部斜率為一，該單元仍可更新
      D: 輸出為負但局部斜率為零，該單元正在飽和
    answer: A
    explain:
      A: 長期對所有訓練樣本落在負側，經此單元回傳的梯度為零，是死亡風險。
      B: 負側輸出與局部斜率都是零，不能當成正側。
      C: ReLU 在嚴格負側的局部斜率也為零。
      D: 標準 ReLU 不輸出負值，不能用負輸出描述它。
---

## 為什麼需要

隱藏層若只有線性組合，多層仍可合併成一層。ReLU（Rectified Linear Unit，整流線性單元）用簡單的截斷引入非線性，計算負擔也低。

它常用在深度神經網路的隱藏層。科目 1 指引也以影像辨識的卷積網路與 AlexNet 說明這種用途。

## 直覺

輸入先算出加權和，再通過 ReLU。負輸入被截成零，正輸入則原樣保留；正側沒有固定上限。

一層中若有部分單元因負輸入而輸出零，就形成稀疏激活。

![上圖看負側截零與正側直線；下圖看兩側局部斜率，零點本身不可微。](figure:l23203-relu-output-gradient)

:::supplement[來源：Dive into Deep Learning 5.1.2.1]
下圖的局部斜率用來理解反向傳播。局部斜率為零表示該處輸入的小變化不會改變輸出；正側局部斜率則保持一。

某次輸出零是正常現象，與跨樣本、跨輪次持續不活躍的死亡風險不同。
:::

## 定義與公式

$$
f(x)=\max(0,x)=
\begin{cases}0,&x\leq0,\\x,&x>0.\end{cases}
$$

$x$ 是單一神經元的實數加權輸入，$f(x)$ 是傳給下一層的輸出。向量輸入逐項套用，輸出範圍為 $[0,\infty)$。

### 局部斜率（補充）

$$
f'(x)=\begin{cases}0,&x<0,\\1,&x>0.\end{cases}
$$

$f'(x)$ 是輸出對輸入的局部斜率（導數）。零點左右局部斜率不同，數學上不可微；框架可採零作為該點的反向傳播慣例，不能把這個慣例當成數學導數。

## 算一次（補充）

共用資料 `L23203-B-activations.json` 有醫療與客服各 24 筆。先取醫療 M01–M05 的 5 個給定分數，視為待比較的隱藏層輸入；不是把隱藏輸出解釋成疾病機率。

| 輸入 $x$ | ReLU 輸出 | 局部斜率 |
|---|---|---|
| −4 | 0 | 0 |
| −1 | 0 | 0 |
| 0 | 0 | 不可微 |
| 1 | 1 | 1 |
| 4 | 4 | 1 |

例如 $f(-4)=\max(0,-4)=0$，而 $f(4)=\max(0,4)=4$。輸入從 1 增到 4，輸出也增加 3，符合正側局部斜率一。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))
x = np.array(d["probes"], dtype=float)
print("輸出:", np.maximum(0, x).tolist())
print("反傳慣例:", (x > 0).astype(float).tolist())
```
```text
輸出: [0.0, 0.0, 0.0, 1.0, 4.0]
反傳慣例: [0.0, 0.0, 0.0, 1.0, 1.0]
```

:::tip[讀碼重點]
`maximum` 逐項截零；第二行輸出在零點選零，是實作慣例。本段只計算局部斜率，沒有執行整個網路的反向傳播。
:::

## 怎麼用、怎麼判讀

ReLU 的正側不飽和，適合在隱藏層提取非線性特徵。計算只需比較與保留，不必像 Sigmoid 或 Tanh 一樣計算指數。

:::supplement[來源：Stanford CS231n Commonly used activation functions]
指引 5-36 將 ReLU 描述成可解決梯度消失，應讀成「可減輕部分飽和造成的衰減」。負側局部斜率仍為零，整體梯度也受其他層影響，不能保證不消失。

若一個單元長期對所有訓練樣本都只產生非正輸入，就可能成為死亡 ReLU。可檢查學習率、初始化與每個單元的活躍比例；單筆輸出零還不足以下結論。
:::

### 換個場景

| 場景 | 放在哪裡 | 判讀重點 |
|---|---|---|
| 深度網路隱藏層 | 加權和之後 | 簡單引入非線性，正側無界 |
| 影像辨識、AlexNet | 卷積網路中 | 把線性特徵轉成非線性表示 |
| 醫療特徵組合（補充） | 隱藏層 | 零輸出不是零患病機率 |
| 客服意圖模型（補充） | 隱藏層 | 檢查長期不活躍的單元 |

## 常見誤解

- 「ReLU 輸出一定小於一。」正輸入多大就輸出多大。
- 「負側輸出零代表分類為陰性。」隱藏表示沒有直接的類別機率語意。（補充）
- 「某筆輸出零就是神經元死亡。」要觀察跨樣本、跨訓練輪次的持續不活躍。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-36`、`guide-3:4-57`：支持截零公式、隱藏層、稀疏激活與效率；公式已回看 PDF 170 頁。
- 科目 1 指引 `guide-1:3-48`、`guide-1:3-49`：支持影像卷積網路與 AlexNet 場景。
- [Dive into Deep Learning 5.1.2.1](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)：支持導數與零點慣例，作為算一次、程式的補深。
- [Stanford CS231n 激活函數課程](https://cs231n.github.io/neural-networks-1/)：支持怎麼用、常見誤解的死亡 ReLU 風險。

## 小結

- 負值截零、正值保留，輸出沒有上界。
- ReLU 常用於隱藏層，計算簡單。
- 正側局部斜率一，負側局部斜率零；零點不可微。（補充）
- 長期對所有訓練樣本不活躍才需要檢查死亡風險。（補充）
