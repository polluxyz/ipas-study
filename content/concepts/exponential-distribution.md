---
id: exponential-distribution
title: 指數分佈與無記憶性
aliases:
- Exponential Distribution
- Memoryless Property
kind: theory
codes:
- L23101
requires:
- continuous-random-variable
contrasts:
- target: poisson-distribution
  note: 同質泊松過程中，泊松分佈數固定區間的事件次數，指數分佈描述相鄰事件間隔。
  source:
  - guide-3:3-3
  - guide-3:3-4
guide_refs:
- guide-3:3-4
author: codex
status: draft
textbook: v2
summary: 固定發生率下，指數等待時間的剩餘分佈不因已等待多久而改變
goals:
- id: g1
  text: 以固定率條件解釋等待時間與無記憶性，區分來電和故障場景
formula_groups:
- id: exponential-survival
  source: https://www.itl.nist.gov/div898/handbook/apr/section1/apr161.htm
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
- id: memoryless-wait
  source: https://www.stat.berkeley.edu/~ani/s200af18/Lec_08_28.html
  status: verified
  checked_by: codex-gpt-6.1-sol:CK2-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 假設來電是每分鐘固定1/15通的同質泊松過程，已經15分鐘沒來電。再等超過15分鐘的條件機率是多少？
  options:
    A: 0，因為平均等待是15分鐘，已等滿後應立即來電
    B: 約0.1353，因為應將已等與剩餘各15分鐘合計計算
    C: 約0.3679，與一開始等超過15分鐘相同
    D: 1，因為尚未來電代表之後也不會來電
  answer: C
  explain:
    A: 15分鐘是平均等待，不是必須來電的期限；已等滿仍不保證下一刻發生。
    B: 合計30分鐘只得到無條件機率exp(−2)，還須除以已等超過15分鐘的機率exp(−1)。
    C: 條件機率比值為exp(−30/15)除以exp(−15/15)，等於exp(−1)。
    D: 目前沒有來電不表示未來也沒有；固定率仍為每分鐘1/15通。
- id: c2
  goal: g1
  type: choice
  prompt: 某零件的故障率隨使用年限明顯升高。要預測已用3年後的剩餘壽命，下列哪個做法合理？
  options:
    A: 直接套固定率指數模型，因為是等待故障
    B: 先檢查隨年齡變化的故障率，不能直接宣稱無記憶性
    C: 把已用3年扣掉後，故障率必定回到新機水準
    D: 只要取100台平均就能讓每台都無記憶
  answer: B
  explain:
    A: 是生存時間並不足以符合固定故障率條件。
    B: 故障率隨年齡升高與指數模型的固定率假設衝突。
    C: 時間座標重設不會讓老化機制消失。
    D: 平均可摘要資料，不能改變個別設備的生成機制。
---

## 為什麼需要

泊松分佈數半小時有幾通電話；另一個問題是「還要等多久才有下一通」。指數分佈（Exponential Distribution）用來描述事件間隔或等待到事件的時間。

## 直覺

在固定率的理想模型下，等了一段時間還沒發生，不會讓事件在下一小段時間變得更迫切。這種剩餘等待分佈不因已等待多久而改變的特性，叫無記憶性（Memoryless Property）。

![從起點看30分鐘與已等15分鐘後再看15分鐘是不同事件，條件化後才比較剩餘等待。](figure:l23101-exponential-distribution-wait)

這不是說所有歷史都毫無用途。若歷史顯示現在是來電尖峰、設備正在老化，固定率假設本身就可能不成立。

## 定義與公式

指引列出機器故障時間、電話來電間隔與生存時間。使用前要確認所研究期間內的發生率穩定；來電間隔的指數模型通常連結到同質泊松過程。

### 等待超過某時間（補充）

$$
S(t)=P(T>t)=e^{-rt},\qquad F(t)=P(T\leq t)=1-e^{-rt},\quad t\geq0
$$

$T$ 是等待到事件的時間，$t$ 是指定時間，$r>0$ 是每單位時間的發生率，$S$ 是尚未發生的機率，$F$ 是已發生的累積機率。時間與率的單位必須互相抵消。

許多教材把指數分佈的發生率記為 $\lambda$；本組用 $r$，以便與泊松模型的區間平均次數 $\lambda$ 區分。

### 條件等待（補充）

$$
\begin{aligned}
P(T>s+t\mid T>s)
&=\frac{S(s+t)}{S(s)}\\
&=\frac{e^{-r(s+t)}}{e^{-rs}}
=e^{-rt}=P(T>t).
\end{aligned}
$$

$s\geq0$ 是已經等過的時間，$t\geq0$ 是接下來還要等的時間。分母表示「已等到 $s$ 仍未發生」；本模型在有限的 $s$ 下分母為正。

## 算一次（補充）

客服例子每30分鐘平均2通，$r=1/15$ 通／分鐘。等超過15分鐘的機率是 $e^{-1}\approx0.367879$，15分鐘內有來電的機率約0.632121。

若已等15分鐘，還要再等超過15分鐘的機率為 $e^{-2}/e^{-1}=e^{-1}$。分子是總等待超過30分鐘，分母是總等待已超過15分鐘；不能把分子單獨當成答案。

設備故障率改為$r=0.5$／小時。壽命超過2小時的機率是$e^{-1}$；已運作3小時後，再運作超過2小時的條件機率為$e^{-2.5}/e^{-1.5}=e^{-1}$。

## 程式（補充）

```python
import math
import numpy as np
rate = 1 / 15
s, t = 15, 15
survival = math.exp(-rate*t)
conditional = math.exp(-rate*(s+t))/math.exp(-rate*s)
print(f"{survival:.6f}", f"{1-survival:.6f}", f"{conditional:.6f}")
print(f"{math.exp(-0.5*5)/math.exp(-0.5*3):.6f}")
rng = np.random.default_rng(23102)
print(np.round(rng.exponential(scale=1/rate, size=3), 3).tolist())
```
```text
0.367879 0.632121 0.367879
0.367879
[0.135, 28.453, 26.996]
```

:::tip[讀碼重點]
NumPy 的 `scale` 是平均等待時間，也就是發生率的倒數。本例要放15分鐘，不是1/15；抽樣值是獨立間隔，不是檔案裡前兩個固定窗口的事件重播。
:::

## 怎麼用、怎麼判讀

先確認事件發生率是否固定，再區分總等待與已等待後的剩餘時間。需要抽樣時，平均等待時間是發生率的倒數，並須配合時間單位。

### 換個場景

| 場景 | 等待到什麼 | 適用條件 |
|---|---|---|
| 電話來電間隔 | 下一通到達 | 同質泊松過程的固定到達率 |
| 機器故障／生存時間 | 首次故障 | 固定故障率，沒有明顯老化效應 |
| 網站請求（補充） | 下一個請求 | 請求不群聚，發生率穩定 |
| 交通到站（補充） | 下一次到達 | 定時班表通常不符無記憶假設 |

:::supplement[來源：NIST 8.1.6.1 Exponential；NumPy Generator.exponential]
來電間隔不等於顧客排隊等待客服接通的時間。排隊等待還受服務速度、人力與前方隊列影響；不能只因名稱有「等待」就套同一個指數模型。
:::

## 常見誤解

- 無記憶性比較的是條件下的「剩餘時間」，不是說總等待時間不增加。
- 來電數的泊松參數是窗口平均次數；指數模型的率則帶有每單位時間的單位。
- 服役越久越容易壞的設備，不符合固定故障率，不能直接宣稱剩餘壽命與年齡無關。

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-4`：支持事件間隔、故障、來電與無記憶性的名稱及用途；條件式與算例為補充。
- [NIST：Exponential](https://www.itl.nist.gov/div898/handbook/apr/section1/apr161.htm)：支持固定故障率、尾端機率與來電間隔對照。
- [Berkeley Stat 200A：Memoryless Property](https://www.stat.berkeley.edu/~ani/s200af18/Lec_08_28.html)：支持條件等待的比值推導，並以 $\lambda$ 表示發生率。
- [NumPy：Generator.exponential](https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.exponential.html)：支持率與 `scale` 的倒數關係及程式。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持條件機率與指數模型的教學安排。

## 小結

- 指數分佈描述固定發生率下的事件間隔或等待時間。
- 已等待多久，不改變同樣長度剩餘等待的條件分佈。
- 老化、尖峰與排隊機制都要先檢查，不能憑時間資料就套用。
