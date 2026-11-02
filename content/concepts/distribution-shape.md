---
id: distribution-shape
title: 偏態、峰度與探索圖
kind: technique
codes: [L23101]
aliases: [Kurtosis, QQ-plot, Skewness, 直方圖, 箱型圖]
requires: [descriptive-statistics, normal-uniform-distributions]
summary: 由偏態、尾部與探索圖判斷資料形狀，再選下一步處理
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-8, guide-3:5-7, guide-3:5-56]
goals:
  - id: g1
    text: 綜合偏態、尾部、三種探索圖與轉換前後比較，選擇下一步檢查
formula_groups:
  - id: shape-moments
    source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda35b.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23101-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 48期等待偏態為4.635，常態QQ圖的右端明顯上彎，箱型圖又標出90分鐘。下一步最合適的是什麼？
    options:
      A: 直接刪除90分鐘那筆，重新計算其餘47期的偏態與QQ圖，以修正輸入錯誤
      B: 先把48期等待標準化，就能消除右偏並保證轉成常態
      C: 直方圖最高柱越高，就表示峰度越大
      D: 查90分鐘的資料來源，並比較適當轉換後的形狀及任務表現
    answer: D
    explain:
      A: 箱外點不等於輸入錯誤；未查來源就刪除，可能抹去真實的尖峰等待。
      B: 標準化只調整48期資料的位置與尺度，不會消除偏態或保證常態。
      C: 柱高受組距與頻數尺度影響，不能直接作為峰度的大小判準。
      D: 先核對極端值，再比較處理前後，避免把真實長等待直接刪掉。
  - id: c2
    goal: g1
    type: choice
    prompt: 某軟體報一般峰度5，另一軟體報同資料超額峰度2。哪項解讀正確？
    options:
      A: 兩者可相容，超額峰度是一般峰度減3
      B: 兩軟體必定有一個算錯，峰度只有一種定義
      C: 兩個數表示資料有5個或2個峰
      D: 超額峰度2證明資料一定是常態
    answer: A
    explain:
      A: 在相同矩估計約定下，兩種峰度定義相差3。
      B: 軟體可能使用不同峰度約定，也可能另有小樣本校正。
      C: 峰度衡量尾部相關特性，不是峰的個數。
      D: 常態的一般峰度為3，超額峰度為0，且單一矩也不能證明常態。
  - id: c3
    goal: g1
    type: choice
    prompt: 48筆正值中24筆是1、24筆是16，取對數後仍是兩群。最合理的結論是什麼？
    options:
      A: 只要偏態為0，就已證明常態
      B: 對數不能保證改善成常態，應查兩群是否來自不同機制
      C: 取對數後所有點必須擠在一個值上
      D: 兩群一定是程式亂數種子不同造成
    answer: B
    explain:
      A: 對稱的兩點或雙峰資料也可以偏態為0。
      B: 單調轉換沒有把兩群變成連續鐘形，應查來源及分群需求。
      C: 對數把1與16轉成兩個不同的值，仍保留兩群。
      D: 分群可以來自班次等機制，僅憑圖不能歸因於種子。
---

## 為什麼需要

平均等待只有幾分鐘，仍可能藏著少數等很久的客戶。偏態（Skewness）幫助辨認不對稱，探索圖則讓我們看見尾部與分群。

指引建議將偏態、峰度（Kurtosis）和圖一起看，再決定轉換、清理或分群。統計量是下一步檢查的線索，不宜單憑一個數字直接刪資料。

## 直覺

右偏是右側拖著較長的尾巴，不是柱子集中在右邊。峰度則不宜只讀成「山峰有多高」；少數很遠的值也會大幅影響它。

### 同一批等待時間的三個視角

共用資料有48期，最後一期保留90分鐘長等待。下圖依同一欄位計算三種圖；重複值會在QQ圖重疊。

![直方圖呈現長右尾，箱型圖標出待查的長等待，常態QQ圖右端偏離參考直線。](figure:l23101-distribution-shape-raw)

## 定義與公式

### 偏態與峰度的矩（補充）

把離中心的距離除以標準差，可消除原單位。三次方保留左右方向，四次方會放大兩邊的遠端值。

$$
\gamma_1=\frac{\sum_jp_j(a_j-\mu)^3}{\sigma^3},\qquad
\beta_2=\frac{\sum_jp_j(a_j-\mu)^4}{\sigma^4},\qquad
\gamma_2=\beta_2-3
$$

$a_j$ 是可能值，$p_j$ 是其機率，$\mu$ 是期望，$\sigma>0$ 是標準差。$\gamma_1$ 是偏態，$\beta_2$ 是一般峰度，$\gamma_2$ 是超額峰度。

上式用於有限四階矩的離散模型；連續模型以積分取代加總。常態的一般峰度是3、超額峰度是0，但符合這兩個數仍不等於證明常態。

對 $n$ 筆觀測，$n$ 是樣本筆數，樣本描述版讓每筆權重取 $1/n$，並以分母 $n$ 的標準差計算。若改用小樣本校正版，數字會不同；比較軟體前要先對齊約定。

### 三種圖分別查什麼

| 圖 | 怎麼讀 | 看不到的事 |
|---|---|---|
| 直方圖（Histogram） | 分區間計數，看偏斜與多峰 | 組距改變會改外觀 |
| 箱型圖（Box plot） | 看中位、中央一半與箱外候選 | 不清楚顯示多峰結構 |
| 常態QQ圖（Normal Q–Q plot） | 排序值對常態理論分位數 | 接近直線不能證明常態 |

指引以1.5倍四分位距界線找待查的箱外點。

:::supplement[來源：NIST Box Plot；R stats qqline 說明]
本例箱鬚延伸至界線內最遠的實際值；界線外的點另外標記。QQ圖虛線通過第一與第三四分位數所對應的點，用來觀察偏離，不是模型預測線。
:::

## 算一次

### 手算形狀的矩（補充）

JSON 中的簡單分佈取 $-1,0,1$，機率為 $0.25,0.5,0.25$。期望為0，變異為 $0.25+0.25=0.5$。

三階中心矩為 $-0.25+0.25=0$，所以偏態為0。四階中心矩為 $0.25+0.25=0.5$，一般峰度 $0.5/(0.5^2)=2$，超額峰度為 $2-3=-1$。

### 轉換前後比一次

48期等待全部大於0，可以取自然對數。兩組都用相同的未校正樣本矩計算，不把小樣本校正混在一起比較。

:::supplement[來源：NIST Skewness and Kurtosis；本組教學合成資料]
| 等待欄位 | 偏態 | 超額峰度 | 判讀 |
|---|---:|---:|---|
| 原始分鐘數 | 4.635 | 23.721 | 右尾受少數長等待影響 |
| 自然對數 | 0.898 | 1.223 | 不對稱減少，仍有尾端偏離 |

:::

![對數後長尾受到壓縮，但QQ圖右端仍有偏離，不能因此宣稱已成常態。](figure:l23101-distribution-shape-log)

轉換有改善這份資料的偏斜，卻沒有保證預測更準。若要決定是否採用，仍須比較同一驗證條件下的任務表現。

### 沒有改善成常態的反例（補充）

另有24筆1、24筆16，取對數後仍只有兩個值：0與約2.773。整批原始值與整批對數值的偏態都是0，卻都不是連續鐘形；應先查是否混合兩種客群或班次。

## 程式（補充）

這段依 JSON 的固定規則重建48期等待，保留最後一期90分鐘。`std()` 預設除以筆數，與本頁的未校正描述矩一致。

```python
import numpy as np
wait = np.array([1, 2, 2, 3, 3, 4, 4, 5, 6, 8, 12, 30] * 4, float)
wait[-1] = 90
def shape(x):
    z = (x-x.mean()) / x.std(ddof=0)
    return np.mean(z**3), np.mean(z**4)-3
for x in (wait, np.log(wait)):
    skew, excess = shape(x)
    print(f"偏態={skew:.3f} 超額峰度={excess:.3f}")
two_groups = np.array([1.] * 24 + [16.] * 24)
print("轉換後不同值數:", len(np.unique(np.log(two_groups))))
```
```text
偏態=4.635 超額峰度=23.721
偏態=0.898 超額峰度=1.223
轉換後不同值數: 2
```

:::tip[讀碼重點]
`np.log` 用於嚴格正值；含0或負值時不能照搬。標準差為0時，`shape` 的分母為0，偏態與峰度沒有定義，應先攔截而非當作0。
:::

## 怎麼用、怎麼判讀

先用直方圖看整體，再用箱型圖找待查值，最後用QQ圖比較指定分佈的形狀。看見異常時回查來源；資料正確但分群明顯時，考慮分開探索。

### 下一步的判斷

| 觀察 | 先做什麼 | 不宜直接宣稱 |
|---|---|---|
| 長右尾且全部正值 | 比較對數前後與驗證結果 | 轉換必然提升表現 |
| 箱外點很多 | 查單位、量測與群組來源 | 箱外點全是錯誤 |
| QQ兩端偏離 | 查尾部與模型假設 | 資料一定不能建模 |
| 有兩個明顯群 | 查是否混合不同機制 | 改尺度便會合成常態 |

:::supplement[來源：scikit-learn Preprocessing data；Ordinary Least Squares]
指引5-7的兩處說法需校正：Z-score標準化只移動中心、改變尺度，不會將資料自動變成常態；最小平方法也不要求每個輸入特徵都呈常態。
:::

### 換個場景

| 場景／資料條件 | 指標或圖的用途 | 下一步 |
|---|---|---|
| 資料探索、特徵工程 | 判斷偏斜、尾部與異常 | 評估分群、清理或轉換 |
| 收入、銷售額右偏 | 比較對數轉換 | 留意高值的實際意義 |
| 能源尖峰（補充） | 箱外點可能是真實超載 | 查感測器及時段 |
| 客服等待（補充） | 長尾可能只在特定班次 | 分班次重畫探索圖 |

## 常見誤解

- 峰度不是峰的數量，也不能只用峰高解釋。（補充）
- 偏態為0不保證常態，對稱雙峰也可能為0。（補充）
- 對數與Box-Cox是候選轉換，並不保證收斂或預測改善。
- 箱外點是調查線索，刪除前要先確認資料與任務。

## 進階

### 參考來源

- 科目3指引（2025-12版）`guide-3:3-8`、`guide-3:5-7`：支持統計量、三圖與轉換用途。
- 同版`guide-3:5-56`：支持箱外點規則、收入及銷售額場景；矩公式與細讀為補充。
- [NIST：Skewness and Kurtosis](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35b.htm)：支持形狀矩、兩種峰度約定。
- [NIST：Histogram](https://www.itl.nist.gov/div898/handbook/eda/section3/histogra.htm)、[Box Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm)、[Normal Probability Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/normprpl.htm)：支持三圖判讀。
- [NumPy：quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)：支持圖中線性插值分位數約定。
- [R：qqnorm、qqline](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/qqnorm.html)：支持「三種圖分別查什麼」的QQ參考線通過第一、第三四分位數。
- [scikit-learn：Preprocessing data](https://scikit-learn.org/stable/modules/preprocessing.html#mapping-to-a-gaussian-distribution)：支持轉換的條件與限制、縮放和形狀的區別。
- [scikit-learn：Ordinary Least Squares](https://scikit-learn.org/stable/modules/linear_model.html#ordinary-least-squares)：支持「下一步的判斷」對輸入常態假設的校正。
- [Berkeley Data 8：Visualizing Numerical Distributions](https://inferentialthinking.com/chapters/07/2/visualizing-numerical-distributions/index.html)：支持先看區間與組距再判讀的教學安排。

## 小結

- 偏態看不對稱，峰度要連尾部一起看，並先核對定義。
- 直方圖、箱型圖與QQ圖提供不同線索，合用較完整。
- 比較同批資料轉換前後，仍須保留任務與驗證條件。（補充）
- 標準化、轉換及低偏態都不能保證常態。（補充）
