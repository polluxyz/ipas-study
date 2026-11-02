---
id: normal-uniform-distributions
title: 常態與均勻分佈
aliases:
- Gaussian Distribution
- Normal Distribution
- Uniform Distribution
kind: theory
codes:
- L23101
requires:
- continuous-random-variable
guide_refs:
- guide-3:3-4
author: codex
status: draft
textbook: v2
summary: 常態密度集中於中心，均勻密度在固定範圍內維持相同高度
goals:
- id: g1
  text: 比較兩種分佈的密度形狀、參數與適用條件
formula_groups:
- id: normal-standardization
  source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda364.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK2-W-L23101-A
- id: uniform-density
  source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda3662.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 厚度模型均值10 mm、標準差2 mm，某件厚度12 mm。標準化後的位置是多少？
  options:
    A: '6'
    B: '2'
    C: '0.5'
    D: '1'
  answer: D
  explain:
    A: 12除以2沒有先扣掉平均10。
    B: 厚度差2 mm還要除以標準差2 mm。
    C: 把分母誤當變異4，才會算出0.5。
    D: (12−10)/2=1，表示高於平均一個標準差。
- id: c2
  goal: g1
  type: choice
  prompt: 參數初始化均勻抽自2到6，落在3到5的機率是多少？
  options:
    A: '0.25'
    B: '0.5'
    C: '1'
    D: '0'
  answer: B
  explain:
    A: 0.25是區間內的密度，還要乘寬度2。
    B: 子區間長2，完整區間長4，機率為2/4。
    C: 3到5沒有涵蓋全部2到6。
    D: 區間有正寬度，因此並非單點機率0。
---

## 為什麼需要

厚度常在某個中心附近波動，初始化參數則可能刻意從固定範圍抽取。兩者都可以是連續量，但「中心較常見」與「各段同寬區間一樣常見」需要不同模型。

## 直覺

常態分佈（Normal，亦稱 Gaussian）呈對稱鐘形。均勻分佈（Uniform）在固定範圍內維持相同密度。

### 用相同座標比較

:::supplement[來源：本組教學合成資料 L23101-A-manufacturing.json]
下圖兩個面板使用相同座標：常態平均10、標準差2；均勻範圍6到14。兩者畫的都是密度，常態尾部仍延伸到圖外。
:::

![相同座標下，常態在中心較高且延伸到範圍外，均勻在6到14之間等高、範圍外為0。](figure:l23101-normal-uniform-distributions-shapes)

## 定義與公式

| 分佈 | 參數的意義 | 支持範圍 | 適合描述 |
|---|---|---|---|
| 常態 | 平均與標準差 | 整條實數軸 | 中心附近的對稱波動 |
| 均勻 | 下限與上限 | 指定的有限區間 | 等寬區間有相同機率 |

### 常態密度與標準化（補充）

$$
f(x)=\frac{1}{\sigma\sqrt{2\pi}}e^{-(x-\mu)^2/(2\sigma^2)},\qquad
z=\frac{x-\mu}{\sigma}
$$

$x$ 是位置，$\mu$ 是平均，$\sigma>0$ 是標準差；$e$ 是自然指數的底數，$\pi$ 是圓周率。$z$ 是離平均幾個標準差；常態變數標準化後為平均0、標準差1的常態。

### 均勻密度（補充）

$$
f(x)=\begin{cases}\dfrac1{b-a},&a\leq x\leq b,\\0,&\text{其他位置}.\end{cases}
$$

$a$、$b$ 是固定下上限且 $a<b$；$f(x)$ 是密度。說「所有值一樣可能」時，應理解成等寬區間的機率相等，而非每一單點都有相同的正機率。

## 算一次（補充）

沿用製造資料的厚度假設：平均 $\mu=10$ mm、標準差 $\sigma=2$ mm。固定第三件厚度為12 mm，$z=(12-10)/2=1$；此處密度約為 $0.1210$／mm。

該密度不是「厚度恰12 mm的機率」。常態模型下，10 到12 mm的機率約為 0.3413，由常態累積機率計算。

另設初始化參數 $U$ 均勻分佈於 2 到6。密度為 $1/(6-2)=0.25$，落在3到5的機率為 $0.25\times(5-3)=0.5$。

## 程式（補充）

```python
import math
import numpy as np
mu, sd, x = 10, 2, 12
z = (x-mu)/sd
density = math.exp(-z*z/2)/(sd*math.sqrt(2*math.pi))
prob = 0.5 * math.erf(z/math.sqrt(2))
print(f"{z:.1f}", f"{density:.4f}", f"{prob:.4f}")
print(f"{(5-3)/(6-2):.1f}")
rng = np.random.default_rng(23101)
print(np.round(rng.normal(10, 2, 3), 3).tolist())
print(np.round(rng.uniform(2, 6, 3), 3).tolist())
```
```text
1.0 0.1210 0.3413
0.5
[7.022, 8.022, 10.845]
[4.327, 2.583, 4.116]
```

:::tip[讀碼重點]
`normal` 的 `scale` 放標準差2，並非變異4；`uniform` 的兩個界是下限2、上限6。`erf` 在這裡計算從平均到12的常態面積，不是任意區間公式。
:::

## 怎麼用、怎麼判讀

指引把常態用於誤差建模、參數估計、特徵標準化與生成模型，把均勻用於參數初始化及隨機抽樣。實際選用仍要核對資料範圍與生成條件。

### 換個場景

| 場景 | 可考慮的模型 | 要查的條件 |
|---|---|---|
| 誤差建模、參數估計 | 常態 | 誤差是否近似對稱，尾部是否過長 |
| 特徵標準化、生成模型 | 常態相關建模 | 標準化本身不保證變成常態 |
| 參數初始化、隨機抽樣 | 均勻 | 有明確範圍，等寬區間等機率 |
| 製造厚度（補充） | 近似常態 | 不把正負無限尾部當成物理保證 |
| 客服隨機提示（補充） | 有界均勻 | 系統是否真的等機率抽延遲 |

## 常見誤解

- 平均與標準差相同，不代表兩份資料具有相同分佈。
- 標準化改變中心與尺度，不會自動把偏態資料變成常態。
- 所有初始化都採均勻並非規則；範圍、架構與方法要一起考慮。

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-4`：支持形狀與用途；密度、標準化公式與計算為補充。
- [NIST：Normal Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm)：支持常態密度、位置與尺度。
- [NIST：Location and Scale Parameters](https://www.itl.nist.gov/div898/handbook/eda/section3/eda364.htm)：支持減去位置再除以尺度的標準化，以及常態的位置、尺度分別對應平均、標準差。
- [NIST：Uniform Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3662.htm)：支持均勻密度與有限支持範圍。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持兩種連續模型的比較安排。
- [NumPy Random Generator](https://numpy.org/doc/stable/reference/random/generator.html)：支持常態與均勻抽樣 API。

## 小結

- 常態集中於中心，均勻在指定範圍內等密度。
- 常態看平均與標準差，均勻看兩個邊界。
- 模型形狀與資料生成條件都要符合；標準化不等於常態化。
