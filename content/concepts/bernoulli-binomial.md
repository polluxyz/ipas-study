---
id: bernoulli-binomial
title: 伯努利與二項分佈
aliases:
- Bernoulli
- Binomial
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
summary: 伯努利看單次二元結果，二項分佈看固定次數的成功總數
goals:
- id: g1
  text: 區分伯努利結果與二項總數，檢查獨立同分佈條件
- id: g2
  text: 計算兩種模型的機率、期望與變異
formula_groups:
- id: binary-count-pmf
  source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
- id: binary-count-moments
  source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 製造線逐件檢驗5件，各件瑕疵機率都是0.2且互相獨立。哪個變數是二項分佈？
  options:
    A: 第1件是否瑕疵的0或1
    B: 第1件的厚度
    C: 這5件中的瑕疵總數
    D: 直到第一件瑕疵的檢驗件數
  answer: C
  explain:
    A: 單件的0或1結果是伯努利變數。
    B: 厚度是連續量，並非固定次數的成功計數。
    C: 固定5次、共同機率0.2且獨立，總數符合二項條件。
    D: 直到首次發生才停止，試驗次數不是預先固定的5次。
- id: c2
  goal: g2
  type: choice
  prompt: 上述5件的瑕疵總數K，恰有1件瑕疵的機率、期望、變異依序是多少？
  options:
    A: 0.4096、1、0.8
    B: 0.08192、1、0.8
    C: 0.4096、0.2、0.16
    D: 0.2、5、1
  answer: A
  explain:
    A: 機率為5×0.2×0.8的四次方，期望np為1，變異np(1−p)為0.8。
    B: 0.08192只算指定一件瑕疵的一種排列，漏了5個位置。
    C: 0.2與0.16是單件伯努利的期望與變異。
    D: 瑕疵總數的期望不是試驗次數，恰1件機率也不是單件機率。
---

## 為什麼需要

「這件是否瑕疵」與「五件中有幾件瑕疵」是不同問題。伯努利分佈（Bernoulli）描述一次二元結果；二項分佈（Binomial）描述固定次數的成功總數。

## 直覺

本組製造資料前五筆的瑕疵標籤為 `[0, 1, 0, 0, 0]`。單件標籤只有 0 或 1；把五個標籤相加，這次觀察到的總數為 1。

![上排五個二元結果相加成一個總數，下排列出總數可取0到5；觀察到1不表示每組都會有1件。](figure:l23101-bernoulli-binomial-count)

「成功」只是計數名稱。此處定義瑕疵為成功，不表示瑕疵是好事；換成廣告情境時，也可以把點擊定義為成功。

## 定義與公式

| 模型 | 隨機變數 | 參數 | 可能取值 |
|---|---|---|---|
| 伯努利 | 單次結果 $B$ | 成功機率 $p$ | 0、1 |
| 二項 | $n$次的成功總數 $K$ | $n$與$p$ | 0、1、…、$n$ |

二項模型要同時檢查四個條件：

- 試驗次數事先固定。（補充）
- 每次只有兩種結果。
- 成功機率相同。（補充）
- 各次互相獨立。

獨立同分佈（Independent and Identically Distributed，IID）表示各次互相獨立、採相同分佈，不要求每次結果相同。

### 機率與集中程度（補充）

兩種機率質量函數為：

$$
\begin{aligned}
P(B=b)&=p^b(1-p)^{1-b},\quad b\in\{0,1\},\\
P(K=k)&=\binom nk p^k(1-p)^{n-k},\quad k=0,\ldots,n.
\end{aligned}
$$

| 符號 | 意義 |
|---|---|
| $b$、$k$ | 指定結果 |
| $p$ | 成功機率，介於0與1 |
| $n$ | 固定次數，非負整數 |
| $\binom nk$ | $n!/[k!(n-k)!]$，成功位置的安排數 |
| $!$ | 階乘，且$0!=1$ |

當$p$為0或1時，結果固定為全失敗或全成功。

期望與變異（Variance，亦稱變異數）為：

$$
\begin{aligned}
E(B)&=p,&\operatorname{Var}(B)&=p(1-p),\\
E(K)&=np,&\operatorname{Var}(K)&=np(1-p).
\end{aligned}
$$

$E$ 表示長期平均，$\operatorname{Var}$ 表示相對平均值的平方離散程度。它們描述整個分佈，並非保證每一組試驗的結果。

## 算一次（補充）

沿用 `L23101-A-manufacturing.json`，設定 $n=5$、$p=0.2$。先算單件：$P(B=1)=0.2$，$P(B=0)=0.8$。

五件恰有一件瑕疵時，瑕疵可以出現在五個位置。每個指定位置的機率是 $0.2\times0.8^4=0.08192$，所以總機率為 $5\times0.08192=0.4096$。

| 模型 | 期望 | 變異 |
|---|---|---|
| 單件 | $p=0.2$ | $0.2\times0.8=0.16$ |
| 五件總數 | $np=5\times0.2=1$ | $5\times0.2\times0.8=0.8$ |

## 程式（補充）

```python
import math
import numpy as np
n, p = 5, 0.2
exact = math.comb(n, 1) * p * (1-p)**4
rng = np.random.default_rng(23101)
draws = rng.binomial(n, p, 5)
print(f"{exact:.4f}", f"{n*p:.1f}", f"{n*p*(1-p):.1f}")
print(draws.tolist())
```
```text
0.4096 1.0 0.8
[0, 0, 2, 1, 0]
```

:::tip[讀碼重點]
`binomial(5, 0.2, 5)` 抽出五個「每組檢驗五件的瑕疵總數」，不是五個單件標籤。上行是精確計算，下行是固定種子的模擬；不要求兩者逐筆相等。
:::

## 怎麼用、怎麼判讀

先問是在看一次結果，還是在看固定次數的累計。若同一批原料會讓相鄰零件一起變差，或日夜班的瑕疵機率不同，不能直接把全批當成同一個二項模型。

### 換個場景

| 場景 | 伯努利對象 | 二項對象與條件 |
|---|---|---|
| 點擊與否 | 一次曝光有無點擊 | 固定曝光次數、同機率且獨立 |
| 一般成功／失敗事件 | 一次二元結果 | 固定$n$次的累計成功數 |
| 製造檢驗（補充） | 一件有無瑕疵 | 同製程條件的固定件數 |
| 客服滿意度（補充） | 一位是否滿意 | 固定受訪人數，注意群聚影響 |

## 常見誤解

- $np=1$ 是長期平均，不是每五件必有一件瑕疵。
- 計算恰一件時，漏掉組合數就只算了一種位置安排。
- 固定庫存的不放回抽樣通常有相依性；不能只因結果是0或1就直接套二項模型。

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-3`：支持單次二元與固定獨立試驗累計、點擊場景；公式與算例為補充。
- [NIST：Binomial Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm)：支持 PMF、期望與標準差（平方得到變異）。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持單次結果與總和的教學安排。
- [NumPy Random Generator](https://numpy.org/doc/stable/reference/random/generator.html)：支持 `default_rng`、`binomial` 用法。

## 小結

- 伯努利的取值是0或1，二項的取值是0到$n$。
- 二項需要固定次數、共同成功機率與獨立試驗。
- 機率計算要含成功位置的組合數；期望與變異描述長期分佈。
