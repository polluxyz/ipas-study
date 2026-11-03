---
id: continuous-random-variable
title: 連續隨機變數、PDF 與 CDF
aliases:
- CDF
- Cumulative Distribution Function
- PDF
- Probability Density Function
kind: theory
codes:
- L23101
requires:
- probabilistic-modeling
contrasts:
- target: discrete-random-variable
  note: PMF的單點質量就是機率；PDF的高度須對區間積分才得到機率。
  source:
  - guide-3:3-30
guide_refs:
- guide-3:3-3
- guide-3:3-4
- guide-3:3-30
author: codex
status: draft
textbook: v2
summary: 連續變數用密度下的區間面積算機率，CDF累計到指定位置
goals:
- id: g1
  text: 以區間面積區分密度與機率，辨認密度可大於1
- id: g2
  text: 比較PDF、CDF與連續單點機率，計算累積差值
formula_groups:
- id: density-interval
  source: guide-3:3-4
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
- id: cdf-difference
  source: https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html
  status: verified
  checked_by: codex-gpt-6.1-sol:CK-W-L23101-A
self_check:
- id: c1
  goal: g1
  type: choice
  prompt: 系統隨機延遲均勻落在0到0.2秒，區間內密度為5／秒。哪個判讀正確？
  options:
    A: 密度超過1，模型不合法
    B: 延遲恰0.1秒的機率是5
    C: 延遲在0到0.1秒的機率為0.5
    D: 密度5表示一定延遲5秒
  answer: C
  explain:
    A: 密度可以大於1；完整面積5×0.2=1，才是機率檢查。
    B: 有密度的連續模型中，單點機率是0。
    C: 區間機率等於面積5×0.1=0.5。
    D: 密度的單位是每秒，並非延遲秒數。
- id: c2
  goal: g2
  type: choice
  prompt: 提示延遲X均勻落在0到2分鐘，F(0.5)=0.25、F(1.5)=0.75。落在0.5到1.5分鐘的機率是多少？
  options:
    A: '0.5'
    B: '0.75'
    C: '1.0'
    D: '0.25'
  answer: A
  explain:
    A: 區間機率是累積差0.75−0.25=0.5。
    B: 0.75還包含0到0.5分鐘的累積機率。
    C: 兩個累積值不能相加，因為包含重疊部分。
    D: 0.25僅是累積到0.5分鐘的機率。
---

## 為什麼需要

厚度、時間與溫度可能在一段範圍內連續變動。只列幾個特定小數的機率，無法表達所有可能值；連續模型改用區間內的面積描述機率。

## 直覺

兩種函數回答不同問題：

| 名稱與縮寫 | 英文 | 回答的問題 |
|---|---|---|
| 機率密度函數（PDF） | Probability Density Function | 各處密度有多高 |
| 累積分佈函數（CDF） | Cumulative Distribution Function | 到這裡已累積多少機率 |

### 同一個延遲模型

:::supplement[來源：本組教學合成資料 L23101-A-customer.json]
本組客服系統另有一個均勻落在 0 到 2 分鐘的提示延遲，區間內密度為每分鐘 0.5。這是獨立的教學延遲設定，不是電話到達間隔，也不是排隊等待時間。
:::

![上圖陰影只算0.5到1.5分鐘的面積，下圖則用兩端累積值相減取得同一機率。](figure:l23101-continuous-random-variable-area-cdf)

## 定義與公式

對具有密度 $f$ 的連續隨機變數 $X$，區間機率為：

$$
P(a\leq X\leq b)=\int_a^b f(x)\,dx
$$

$a$、$b$ 是區間左右界且 $a\leq b$，$x$ 是積分中的位置，$f(x)$ 是該處密度，$dx$ 可理解為極窄區間的寬。積分就是把這些窄長條的面積加起來。

密度必須非負，涵蓋全部可能值的面積是 1。若 $X$ 以分鐘計，密度單位是每分鐘，乘上時間寬度後才成為沒有單位的機率。

指引指出，連續模型的單點機率是 0。單點沒有寬度，因此沒有面積；這不妨礙一次實際量測得到某個數值。

### 累積到某個位置（補充）

$$
F(x)=P(X\leq x)=\int_{-\infty}^{x}f(t)\,dt
$$

上圖的 PDF 用 $f(x)$ 表示，下圖的 CDF 用 $F(x)$ 表示。$t$ 只是積分中的位置符號，上限 $x$ 是累積到的位置。

積分把密度累積成機率。CDF 由左向右不下降，值介於 0 與 1。

在密度 $f$ 於 $x$ 連續之處，微分關係為：

$$
f(x)=F'(x)
$$

微分讀出累積函數在該點的變化率，也就是該處密度。本頁均勻例在 0 與 2 分鐘有轉折，這兩點的 $F'(x)$ 不存在。

本頁具有密度的連續模型也滿足：

$$
\begin{aligned}
P(a\leq X\leq b)&=F(b)-F(a)\\
&=\int_a^b f(x)\,dx
\end{aligned}
$$

區間機率既可用兩端累積值相減，也可用密度下的區間面積計算。

## 算一次（補充）

沿用 `L23101-A-customer.json` 的 `uniform_demo`。0 到 2 分鐘內密度為 0.5，其他位置為 0。

區間 0.5 到 1.5 分鐘的寬是 1 分鐘，機率為 $0.5\times(1.5-0.5)=0.5$。用 CDF 核對：$F(0.5)=0.25$、$F(1.5)=0.75$，差值同為 0.5。

再把均勻範圍縮成 0 到 0.2 秒，密度為 $1/0.2=5$／秒。高度大於 1 沒有問題，總面積 $5\times0.2=1$；0 到 0.1 秒的機率仍只有 0.5。

## 程式（補充）

```python
def cdf(x):
    return min(1.0, max(0.0, x / 2))
area = 0.5 * (1.5 - 0.5)
print(f"{area:.2f}", f"{cdf(1.5)-cdf(0.5):.2f}")
print(f"{1/0.2:.1f}", f"{(1/0.2)*0.1:.1f}")
```
```text
0.50 0.50
5.0 0.5
```

:::tip[讀碼重點]
CDF 在範圍外必須維持0或1，不能直接把 `x / 2` 延伸到所有位置。這裡是均勻分佈專用公式，不是任意分佈的CDF。
:::

## 怎麼用、怎麼判讀

PDF 高的區域代表相同小寬度下較集中的機率；CDF 則適合回答「不超過某值」的問題。PMF 的每個值直接是機率，不能與 PDF 高度互換。

### 換個場景

| 場景 | 連續量 | 判讀重點 |
|---|---|---|
| 身高、體重、溫度 | 量測值 | 用區間描述而非特定小數點 |
| 病患等待時間 | 時間 | CDF可表達指定時間內完成的比例 |
| 製造厚度（補充） | 毫米 | 規格上下限之間是合格區間 |
| 客服提示延遲（補充） | 分鐘 | 累積差值等於指定區間面積 |

## 常見誤解

- PDF 為 2 不等於機率為 200%；要看區間寬度。
- CDF 是累積機率，不是另一種密度高度。

:::supplement[來源：華盛頓大學 STAT516 Random Variable]
量測顯示「1.00」可能代表四捨五入後的整段區間，因此顯示值可以重複。單點機率為0的說法針對理想的連續模型，不適用於另有點質量的混合分佈。
:::

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-3`、`guide-3:3-4`：支持測量型變數、區間積分與場景；已核對 PDF 第11頁公式。
- 科目3學習指引 `guide-3:3-30`：支持單點機率與 PDF／CDF 的角色差異，不引用原練習題。
- [華盛頓大學 STAT516 機率課程](https://faculty.washington.edu/yenchic/26A_stat516/Lec1_probability.html)：支持 CDF 定義、區間差值與模型邊界。
- [NIST：Uniform Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3662.htm)：支持均勻密度與面積算例。

## 小結

- 連續模型用密度下的面積算區間機率。
- CDF 累計到指定位置，兩端差值就是區間機率。
- 密度可以大於1；具有密度的連續模型之單點機率為0。
