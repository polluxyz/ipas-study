---
id: discrete-random-variable
title: 離散隨機變數與 PMF
aliases:
- PMF
- Probability Mass Function
kind: theory
codes:
- L23101
requires:
- probabilistic-modeling
guide_refs:
- guide-3:3-3
author: codex
status: draft
textbook: v2
summary: 離散變數以可列舉的取值與機率質量描述結果
goals:
- id: g1
  text: 辨認有限與可數取值，並驗算機率質量是否有效
formula_groups:
- id: pmf-normalization
  source: guide-3:3-3
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 客服用0、1、2通描述一種有限取值模型，機率依序為0.2、0.5、0.3。收到至少1通的機率是多少？
  options:
    A: '0.5'
    B: '0.8'
    C: '1.0'
    D: '0.3'
  answer: B
  explain:
    A: 0.5只包含恰好1通，尚未包含2通。
    B: 至少1通包含1通與2通，機率相加為0.8。
    C: 1.0還包括沒有來電的0.2。
    D: 0.3只代表恰好2通。
- id: c2
  goal: g1
  type: choice
  prompt: 系統保證只有0、1、2通三種結果，工程師給出機率0.2、0.5、0.4。哪個檢查結論正確？
  options:
    A: 全部非負，所以已是合法PMF
    B: 只有整數取值才能檢查總和
    C: 把0通刪掉就會變成合法PMF
    D: 機率總和1.1，不能當作完整PMF
  answer: D
  explain:
    A: 非負與總和為1都必須通過，不能只查一項。
    B: 非整數的有限取值也可以是離散變數。
    C: 刪掉0通會漏掉可能結果，而且剩下機率總和只有0.9。
    D: 三個互斥且完整結果的機率總和必須是1。
---

## 為什麼需要

客服要估計下一個窗口收到幾通電話。只給平均值不夠，因為「0 通」與「2 通」會帶來不同工作量。離散隨機變數（Discrete Random Variable）直接描述一個個可列舉的結果。

## 直覺

離散的重點是可能值可以逐個列出。骰子只有 1 到 6，是有限集合；每日訂單數可以是 0、1、2，依此延伸，是可數集合。

:::supplement[來源：華盛頓大學 STAT516 Common Distributions]
離散不等於整數。若獎金只能是 0、0.5、1 元，仍只有三個可能值；反之，厚度用小數顯示，也不能只憑顯示格式判斷其理想量測模型。
:::

下圖是另外指定的有限取值教學模型：只允許 0、1、2 通，機率為 0.2、0.5、0.3。它不是 48 個客服窗口的經驗次數，也不是泊松分佈。

![每個分離柱頂對應一個取值的機率，不把相鄰柱之間連成連續密度。](figure:l23101-discrete-random-variable-mass)

## 定義與公式

機率質量函數（PMF，全名 Probability Mass Function）描述每個特定值的機率：

$$
p(x)=P(X=x),\qquad p(x)\geq0,\qquad\sum_{x\in S}p(x)=1
$$

其中 $X$ 是隨機變數，$x$ 是它的一個可能值，$S$ 是全部可能值的集合。總和要涵蓋完整的 $S$；集合外的機率為 0。

:::supplement[來源：華盛頓大學 STAT516 Random Variable]
若事件包含數個互斥取值，就把對應質量相加。此時比較的是各柱頂的機率，不是把柱寬當成連續區間去算面積。
:::

## 算一次（補充）

使用 `L23101-A-customer.json` 的 `pmf_hand_model`，把完整取值逐一列出：

| $x$（通） | 0 | 1 | 2 |
|---|---|---|---|
| $p(x)$ | 0.2 | 0.5 | 0.3 |

每一項都非負，總和 $0.2+0.5+0.3=1$，所以是合法 PMF。至少 1 通包含 1 與 2，機率為 $0.5+0.3=0.8$。

若最後一項改為 0.4，總和變成 1.1，已經不合法。不能把不相容的預測直接當成完整機率分佈。

## 程式（補充）

```python
import numpy as np
p = np.array([0.2, 0.5, 0.3])
valid = bool(np.all(p >= 0) and np.isclose(p.sum(), 1.0))
print(valid, f"{p.sum():.1f}", f"{p[1:].sum():.1f}")
```
```text
True 1.0 0.8
```

:::tip[讀碼重點]
`p[1:]` 在這份表才剛好對應至少 1 通；換一個取值順序就要一起改索引。`isclose` 避免浮點加總的微小誤差。
:::

## 怎麼用、怎麼判讀

PMF 適合結果可逐個列出的資料；伯努利與二項分佈處理二元事件及其累計，泊松分佈則處理固定區間的發生次數。

### 換個場景

| 場景 | 取值條件 | 判讀重點 |
|---|---|---|
| 公平骰子 | 有限的1到6 | 每面機率1/6，六項合計1 |
| 電商每日訂單數 | 可數的0、1、2… | 不把觀察最大值當成理論上限 |
| 製造檢驗（補充） | 一件的0或1標籤 | 定義1是否代表瑕疵 |
| 客服窗口（補充） | 每個窗口的來電通數 | 真實計數不必限制為0到2 |

## 常見誤解

- 「沒有小數就是離散」不可靠；應檢查模型的可能取值集合。
- PMF 的值本身就是機率，介於 0 與 1；PDF 的高度不是機率，可以大於 1。
- 有限樣本沒有看過某結果，不代表它在母體中的機率必為 0。

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-3`：支持取值集合、PMF 與骰子、訂單數場景；已核對 PDF 第10頁。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持取值及質量加總算例。
- [NumPy Random Generator](https://numpy.org/doc/stable/reference/random/generator.html)：供本組抽樣程式的 API 對照；本頁僅做固定表驗算。

## 小結

- 離散變數的可能值是有限或可數的。
- PMF 每項非負，涵蓋全部結果的質量總和為 1。
- 一個事件包含數個取值時，對應機率可以相加。
