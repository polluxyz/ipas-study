---
id: poisson-distribution
title: 泊松分佈
aliases:
- Poisson
- 卜瓦松分佈
kind: theory
codes:
- L23101
requires:
- discrete-random-variable
guide_refs:
- guide-3:3-3
author: codex
status: draft
textbook: v2
summary: 泊松分佈描述固定區間內，在穩定發生率下的事件次數
goals:
- id: g1
  text: 檢查泊松條件、區分次數與發生率，並換算區間參數
formula_groups:
- id: poisson-pmf
  source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 客服平均每30分鐘2通來電，且符合固定發生率與獨立增量。改看60分鐘時，泊松參數應是多少？
  options:
    A: '1'
    B: '2'
    C: '0.5'
    D: '4'
  answer: D
  explain:
    A: 窗口變長一倍，平均次數應增加而非減半。
    B: 2只適用於原本30分鐘的窗口。
    C: 0.5不是60分鐘的平均通數。
    D: 同樣發生率下，60分鐘的平均通數是2×2=4。
- id: c2
  goal: g1
  type: choice
  prompt: 網站平常每分鐘2次請求，促銷開始後第1分鐘湧入200次，之後逐漸回落。能否直接用固定參數2的泊松模型描述整段？
  options:
    A: 可以，因為請求數是整數
    B: 不宜，發生率明顯隨時間改變
    C: 可以，泊松模型只要求事件很少
    D: 不宜，泊松模型只能用在電話
  answer: B
  explain:
    A: 整數計數只是資料型態，仍要檢查發生機制。
    B: 促銷改變了發生率，單一固定參數無法表達這個變化。
    C: 事件稀少不是充分條件，穩定率與獨立性也要檢查。
    D: 請求數也能建模，重點在條件而非產業。
---

## 為什麼需要

客服要安排半小時的人力，需要知道這段期間可能收到幾通電話。泊松分佈（Poisson Distribution，亦稱卜瓦松分佈）用來描述固定時間或空間區間內的發生次數。

## 直覺

本組客服資料有 48 個半小時窗口。前兩個窗口固定有 1 通、3 通，後續窗口依每半小時平均 2 通的模型生成；各窗口不必剛好收到 2 通。

### 先檢查發生機制

- 平均發生率在所研究的期間內維持穩定。
- 不重疊區間的發生次數彼此獨立，不因一通電話就誘發另一通。
- 在很短的時間內，兩件以上同時發生的機會相對很小。（補充）

第三個條件用來連結同質泊松過程的計數假設；它不是說實務上絕對不能同時接到兩通電話。

## 定義與公式

泊松模型的取值為 0、1、2、…，沒有預設上限。它數的是某個已固定區間內的事件，不是成功前做了幾次試驗。

### 參數與機率（補充）

$$
\lambda=r\Delta t,\qquad
P(N=k)=\frac{e^{-\lambda}\lambda^k}{k!},\quad k=0,1,2,\ldots
$$

$N$ 是區間內次數，$k$ 是指定次數，$r$ 是每單位時間的平均發生率，$\Delta t$ 是區間長度。$\lambda$ 是此區間的平均次數，$e$ 是自然指數的底數，$k!$ 是階乘。

此處取 $\lambda>0$；若 $\lambda=0$，就表示該區間必定零次。算式中的時間單位必須一致，不能把每小時的率直接乘分鐘數。

## 算一次（補充）

`L23101-A-customer.json` 設定每半小時平均 2 通，因此 $r=2/30=1/15$ 通／分鐘。

半小時的 $\lambda=(1/15)\times30=2$。沒有來電的機率為 $e^{-2}\times2^0/0!=e^{-2}\approx0.135335$。

一小時的 $\lambda=(1/15)\times60=4$。沒有來電的機率為 $e^{-4}\approx0.018316$；窗口變長，仍然零通的可能性降低。

![兩組同座標的PMF顯示：窗口從30分鐘加倍到60分鐘，平均通數從2增至4，零通機率也隨之降低。](figure:l23101-poisson-distribution-window)

## 程式（補充）

```python
import math
import numpy as np
rate = 2 / 30
for minutes in (30, 60):
    lam = rate * minutes
    print(minutes, f"{lam:.1f}", f"{math.exp(-lam):.6f}")
rng = np.random.default_rng(23102)
print(rng.poisson(2, 5).tolist())
```
```text
30 2.0 0.135335
60 4.0 0.018316
[0, 3, 0, 1, 0]
```

:::tip[讀碼重點]
`poisson` 的 `lam` 放區間平均次數，本例是2，不是每分鐘率。五個抽樣值是獨立模擬窗口；不包含資料檔前兩個刻意固定的窗口。
:::

## 怎麼用、怎麼判讀

指引提到稀有事件，但「稀有」本身不能保證泊松假設成立。尖峰時段、促銷群聚或設備連鎖故障都應先查發生率與相依性。

### 換個場景

| 場景 | 固定區間 | 要先查什麼 |
|---|---|---|
| 客服來電 | 每30分鐘 | 不同時段的率是否穩定 |
| 伺服器請求 | 每分鐘 | 請求是否群聚或互相誘發 |
| 製造表面瑕點（補充） | 每平方公尺 | 不同區域的瑕點率是否一致 |
| 交通事故（補充） | 每週同一路段 | 天氣或車流是否改變發生率 |

## 常見誤解

- 二項分佈固定試驗次數；泊松分佈固定觀察區間，不能只看到「次數」就混用。
- 平均2通不表示每個窗口都是2通。
- 泊松分佈描述來電通數；連續的來電間隔時間應另外建模。

## 進階

### 模型範圍（補充）

把每個區間的總數建成泊松分佈，不代表已證明所有事件時刻都符合完整的同質泊松過程。需要解釋間隔時間時，還要確認過程的獨立增量與固定率條件。

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-3`：支持用途、固定率、獨立性及來電與請求場景。
- [NIST：Poisson Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm)：支持 PMF 與區間平均次數。
- [NIST：Exponential](https://www.itl.nist.gov/div898/handbook/apr/section1/apr161.htm)：支持固定率的事件間隔與區間計數對照。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持計數型建模的教學安排。
- [NumPy Random Generator](https://numpy.org/doc/stable/reference/random/generator.html)：支持固定種子的泊松抽樣。

## 小結

- 泊松分佈數固定區間內的事件次數。
- 先查固定率與獨立性，再決定模型是否合適。
- 窗口變長時，要按長度換算平均次數參數。
