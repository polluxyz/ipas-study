---
id: descriptive-statistics
title: 期望與敘述統計
kind: theory
codes: [L23101]
aliases: [Expected Value, Standard Deviation, Variance, 中位數, 平均數]
requires: [discrete-random-variable]
summary: 用中心與離散程度摘要資料，並分清機率模型與觀測樣本
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-8, guide-3:3-30]
goals:
  - id: g1
    text: 用單位與同平均算例解釋期望、變異及標準差的探索用途
  - id: g2
    text: 計算加權期望、母體與樣本變異，選對分母並求標準差
  - id: g3
    text: 算出替換極端值前後的平均數與中位數，說明穩健性的意思
formula_groups:
  - id: expectation-center
    source: https://www.probabilitycourse.com/chapter3/3_2_2_expectation.php
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-C
  - id: variance-scale
    source: https://numpy.org/doc/stable/reference/generated/numpy.var.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23101-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩個客服班次的平均等待都是3分鐘，甲的母體標準差1分鐘，乙為4分鐘。哪項判讀最合適？
    options:
      A: 中心相同，乙的等待較分散；變異的單位是平方分鐘
      B: 乙的平均等待一定比甲長4分鐘
      C: 兩班的每一筆等待時間都相同
      D: 甲、乙的變異分別為1分鐘與4分鐘
    answer: A
    explain:
      A: 平均描述中心，標準差描述離散，平方後的變異帶平方單位。
      B: 標準差4描述離散，不能加到平均當作另一個平均。
      C: 同平均沒有要求每筆資料相同，標準差不同也顯示離散不同。
      D: 變異應分別為1及16平方分鐘，不能直接沿用標準差。
  - id: c2
    goal: g2
    type: choice
    prompt: 隨機抽到的三期用量是1、2、3 kWh，假設為獨立同分佈樣本，要用通常的不偏估計估計母體變異。結果是多少？
    options: { A: '2/3 kWh²', B: '1 kWh²', C: '2 kWh²', D: '3 kWh²' }
    answer: B
    explain:
      A: 除以3得到這三筆本身的母體式描述量，不是題目指定的不偏樣本估計。
      B: 平均為2，離差平方和為2，除以樣本數減一得到1。
      C: 2只是離差平方和，還沒有除以自由度2。
      D: 3是樣本數，沒有反映離差平方的大小。
  - id: c3
    goal: g3
    type: choice
    prompt: 五筆等待由1、2、3、4、5分鐘，將最後一筆替換為100分鐘。新的平均數與中位數是哪一組？
    options: { A: '平均3，中位22', B: '平均20，中位4', C: '平均22，中位3', D: '平均22，中位4' }
    answer: C
    explain:
      A: 平均會受100拉動，中位仍取排序後第三筆，兩個數放反了。
      B: 五筆總和為110，除以5是22，排序第三筆是3。
      C: 總和110除以5為22，第三筆仍是3。
      D: 平均22正確，但4是排序第四筆，並非五筆的中間位置。
  - id: c4
    goal: g2
    type: short
    prompt: 某等待模型取1、3、8分鐘，機率為0.5、0.3、0.2。請算期望，並說明它為何不等於把三個可能值直接平均。
    key_points:
      - 期望是1乘0.5加3乘0.3加8乘0.2，等於3分鐘
      - 三種可能值的機率不相等，不能各配三分之一的權重
      - 期望是模型的加權中心，不是保證下一次會等待3分鐘
---

## 為什麼需要

一週平均用電相同的兩棟樓，一棟每天穩定，另一棟偶爾暴增。只報平均會漏掉尖峰；只報最大值，又看不出平常的中心。

指引把期望值（Expected Value）用於預測基準與參數估計，把變異（Variance，亦稱變異數）及標準差（Standard Deviation）用於探索離散與判斷縮放需求。

例如，指引以線性迴歸截距說明期望與參數估計的關係。

:::supplement[來源：scikit-learn Ordinary Least Squares]
只用截距、不放其他特徵的最小平方模型，會以目標的樣本平均作為預測。一般含特徵的迴歸，不能直接把截距當作目標平均。
:::

## 直覺

平均數把每筆大小都算進去；中位數（Median）先排序，再取中間位置。少數極端值很大時，前者會被拉動，後者通常較穩定。

### 兩種中心放在同一條數線

共用例子 `L23101-C-energy-service.json` 中，五筆客服等待原為1到5分鐘。只把5改成100，平均從3移到22，中位數仍是3。

![兩圖都用0到100分鐘的橫軸，替換最大值後平均移動，中位數維持在3。](figure:l23101-descriptive-statistics-centers)

## 定義與公式

### 機率的中心與資料的中心

中位數先排序：奇數筆取正中央，偶數筆取中央兩筆的平均。計算前不可保留原本的未排序順序。

:::supplement[來源：ProbabilityCourse 3.2.2 Expectation]

期望依機率加權；樣本平均依觀測筆數平均。它們回答的是「模型的中心」與「這批資料的中心」。

$$
\mu=E[X]=\sum_j a_jp_j,\qquad
\bar{x}=\frac1n\sum_{i=1}^{n}x_i
$$

$X$ 是隨機變數，$a_j$ 是第 $j$ 種可能值，$p_j$ 是其機率。機率非負且總和為1；無限多可能值時，還須期望存在。

$x_i$ 是第 $i$ 筆觀測，$n$ 是筆數，$\bar{x}$ 是樣本平均。有限樣本的平均不一定恰等於模型期望 $\mu$。

:::

### 離散與分母（補充）

變異數與標準差都描述資料的離散程度。離差先平方再平均，可避免正負抵銷。

對已知離散機率模型，$\sigma^2$ 是母體變異數。$\sigma$ 是母體標準差，等於母體變異數的平方根：

$$
\sigma^2=\sum_jp_j(a_j-\mu)^2,\qquad \sigma=\sqrt{\sigma^2}
$$

平方使遠離中心的值影響變大。這裡假設二階矩（平方值的期望）有限。

對觀測資料，先區分描述樣本與估計母體。$v_n$ 用分母 $n$，描述這 $n$ 筆資料的離散程度。

估計母體變異數時，本頁採用分母 $n-1$ 的樣本變異數 $s^2$。樣本標準差 $s$ 是 $s^2$ 的平方根：

$$
v_n=\frac{\sum_i(x_i-\bar{x})^2}{n},\qquad
s^2=\frac{\sum_i(x_i-\bar{x})^2}{n-1},\qquad s=\sqrt{s^2}
$$

估計時，假設樣本獨立同分佈且母體變異數有限。在這些條件下，$n>1$ 時的 $s^2$ 是母體變異數的不偏估計。

開根號後，不能因此稱 $s$ 也是母體標準差的不偏估計。

變異數帶原資料單位的平方。標準差則回到原資料單位。

只有1筆時，$v_n=0$。$s^2$ 與 $s$ 都未定義。

## 算一次

### 加權期望與離散（補充）

等待模型的可能值為1、3、8分鐘，機率為0.5、0.3、0.2。先確認機率和為1，再算中心：

$\mu=1\times0.5+3\times0.3+8\times0.2=3$ 分鐘。

代回變異：$\sigma^2=0.5(1-3)^2+0.3(3-3)^2+0.2(8-3)^2=7$ 平方分鐘。標準差為 $\sqrt7\approx2.646$ 分鐘。

### 同平均，不同離散

| 等待資料（分鐘） | 平均 | 母體式變異 | 母體式標準差 |
|---|---:|---:|---:|
| 2、3、4 | 3 | $2/3$ 平方分鐘 | 約0.816分鐘 |
| 1、3、5 | 3 | $8/3$ 平方分鐘 | 約1.633分鐘 |

兩組中心相同，第二組離中心更遠。

:::supplement[來源：NumPy var]
若改用樣本分母，兩組變異是1與4平方分鐘；比較時要使用同一約定。

另取1、2、3三筆，平均是2，離差平方和是 $1+0+1=2$。因此 $v_n=2/3$、$s^2=2/(3-1)=1$，相應標準差約為0.816與1。
:::

### 替換極端值

五筆排序後原是1、2、3、4、5：平均 $15/5=3$，中位數取第三筆3。換成1、2、3、4、100後，平均 $110/5=22$，第三筆仍是3。

中位數較穩健不表示永遠不變。若替換的是中央附近的值，排序位置也可能改變。

## 程式（補充）

下段重算 JSON 內的手算小例。`ddof` 決定分母減掉多少，不代表資料是否已經標準化。

```python
import numpy as np
a = np.array([1., 2., 3.])
values, probs = np.array([1., 3., 8.]), np.array([.5, .3, .2])
mu = np.sum(values * probs)
var = np.sum(probs * (values-mu)**2)
print(f"期望={mu:.3f} 變異={var:.3f} 標準差={var**.5:.3f}")
print(f"母體式={a.var(ddof=0):.3f} 樣本={a.var(ddof=1):.3f}")
print(f"標準差={a.std(ddof=0):.3f} {a.std(ddof=1):.3f}")
for x in ([1, 2, 3, 4, 5], [1, 2, 3, 4, 100]):
    print(f"平均={np.mean(x):.1f} 中位={np.median(x):.1f}")
```
```text
期望=3.000 變異=7.000 標準差=2.646
母體式=0.667 樣本=1.000
標準差=0.816 1.000
平均=3.0 中位=3.0
平均=22.0 中位=3.0
```

:::tip[讀碼重點]
`np.var` 預設 `ddof=0`；估計題指定樣本變異時，要明確寫 `ddof=1`。`np.median` 會處理排序，不可直接取原陣列中央元素。
:::

## 怎麼用、怎麼判讀

中心描述通常落在哪裡，離散描述散得多開。觀察標準差可發現特徵尺度差異，再依模型決定是否標準化；不是所有模型都必須縮放。

### 單位與縮放

| 欄位 | 平均、標準差的單位 | 變異的單位 | 共用48期的描述量 |
|---|---|---|---|
| 能源用量 | kWh | kWh² | 平均101.833、母體式標準差20.768 |
| 客服等待 | 分鐘 | 平方分鐘 | 平均7.917、母體式標準差13.772 |

兩欄的單位不同，不能只憑標準差數字判斷哪個領域「較危險」。標準化可用於調整特徵尺度，降低尺度差異對模型訓練的影響。

:::supplement[來源：NumPy var；scikit-learn StandardScaler]
能源改寫成 Wh，平均與標準差都變成原來1000倍，變異變成100萬倍。

實作標準化時，先用訓練集估中心與尺度，再套到其他資料。轉換後的形狀不會自動變成常態；形狀檢查見偏態、峰度與探索圖。
:::

### 換個場景

| 場景／資料條件 | 統計量的用途 | 下一步 |
|---|---|---|
| 預測基準、參數估計 | 期望提供平均趨勢 | 檢查基準與資料是否一致 |
| 特徵尺度差異大 | 變異、標準差描述離散 | 評估縮放需求 |
| 偏態或少數極端值 | 中位數較不易被拉動 | 同時報中心與尾部 |
| 能源尖峰管理（補充） | 平均用量不含最大需量 | 另查尖峰時段 |
| 客服服務水準（補充） | 中位等待描述常見經驗 | 另查高分位等待 |

## 常見誤解

- 期望不是保證下一次會出現的值，也可能不是任何一個可能值。（補充）
- 同平均不代表資料相同；比較時還要看離散與分佈形狀。
- 分母不能看心情選；描述整批與估計母體有不同目的。（補充）
- 中位數較穩健，不代表可以忽略極端事件對成本的影響。

## 進階

### 參考來源

- 科目3學習指引（2025-12版）`guide-3:3-8`、`guide-3:3-30`：支持統計量用途、尺度與中位數的穩健性；延伸定義、估計約定與實作步驟另標補充。
- [ProbabilityCourse 3.2.2：Expectation](https://www.probabilitycourse.com/chapter3/3_2_2_expectation.php)：支持加權期望、算一次。
- [ProbabilityCourse 3.2.4：Variance](https://www.probabilitycourse.com/chapter3/3_2_4_variance.php)：支持「離散與分母」的機率加權變異與標準差平方根。
- [NIST：Measures of Location](https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm)、[Measures of Scale](https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm)：支持排序取中位、離散單位、極端值影響。
- [NumPy：var](https://numpy.org/doc/stable/reference/generated/numpy.var.html)：支持分母約定與程式。
- [NumPy：std](https://numpy.org/doc/stable/reference/generated/numpy.std.html)：支持樣本標準差與開根號後仍有偏的提醒。
- [scikit-learn：StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)：支持「單位與縮放」中以訓練集估計中心與尺度、套用到其他資料的補充步驟。
- [scikit-learn：Ordinary Least Squares](https://scikit-learn.org/stable/modules/linear_model.html#ordinary-least-squares)：支持「為什麼需要」的最小平方模型；僅有截距時，以樣本平均預測可使平方誤差和最小。
- [Berkeley Data 8：Variability](https://inferentialthinking.com/chapters/14/2/variability/index.html)：支持同平均不同離散的教學安排。

## 小結

- 期望描述機率模型中心，平均數描述觀測資料中心。（補充）
- 變異帶平方單位，標準差回到原單位。（補充）
- 先分清描述整批或估計母體，再選分母。（補充）
- 極端值會拉動平均；中位數較穩健，尾部風險仍須另外看。
