---
id: outlier-detection
title: 離群值偵測與處置
kind: technique
codes: [L23301, L21301]
aliases: [IQR, LOF, Outlier, Z-score, Z-score Outlier, 異常值門檻與局部密度判斷]
summary: 用統計門檻、圖形與鄰近關係找出待查候選，再查明它代表什麼
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-4, guide-3:5-3, guide-3:5-56, guide-3:4-51, guide-3:4-52]
goals:
  - id: g1
    text: 區分錯誤數值與有效稀有事件，解釋偵測後為何仍要查證
  - id: g2
    text: 對同一資料算Z-score與IQR候選，說明分布與常數欄限制
  - id: g3
    text: 讀箱型、散佈及時序圖，並依全域與局部差異選擇偵測思路
formula_groups:
  - id: empirical-reference-scale
    source: https://numpy.org/doc/stable/reference/generated/numpy.std.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-B
  - id: empirical-z-score
    source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23301-B
  - id: iqr-fences
    source: https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 設備兩筆溫度為999°C與80°C；通訊紀錄確認999是錯誤碼，獨立儀表確認80是真實升溫。兩筆皆被偵測器標記，應如何解讀？
    options:
      A: 999依錯誤證據修正或排除，80依任務評估保留與標記
      B: 999及80既然都被標記，兩筆都應直接刪除並視為雜訊
      C: 999及80既然都很少見，兩筆都應直接當成設備故障標籤
      D: 999及80既然都是數值，兩筆都應直接保留且省略查證
    answer: A
    explain:
      A: 處置依錯誤證據與預測價值決定，偵測標記本身不能取代來源查證。
      B: 真實升溫可能正是監控目標，不能與已知錯誤碼同樣刪除。
      C: 罕見不等於已確認故障，偵測結果不能直接變成真實標籤。
      D: 可轉成數字仍可能是錯誤碼，省略查證會把已知錯值交給模型。
  - id: c2
    goal: g2
    type: choice
    prompt: 八筆溫度的Q1為17.5°C、Q3為30°C。採1.5倍IQR且只標記嚴格超界值，80°C會如何判定？
    options:
      A: IQR為47.5，上界101.25，因此80°C未被這項規則標記
      B: IQR為12.5，上界18.75，因此80°C被這項規則標記
      C: IQR為12.5，上界48.75，因此80°C被這項規則標記
      D: IQR為47.5，上界71.25，因此80°C被這項規則標記
    answer: C
    explain:
      A: 四分位距應取第三四分位減第一四分位，不能將兩者相加。
      B: 18.75只是1.5倍四分位距，上界還要加上第三四分位數。
      C: 四分位距為12.5，上界為30加18.75，80嚴格超過48.75。
      D: 先把四分位距算錯，再漏加第三四分位數，得到的不是候選上界。
  - id: c3
    goal: g2
    type: choice
    prompt: 同一八筆資料均值28.125°C、分母採n的標準差約20.9072°C，80°C的Z分數約2.4812。若門檻為絕對值大於3，哪項正確？
    options:
      A: Z-score與IQR都未標記80，因兩法在同份資料上必須得到相同結果
      B: Z-score與IQR都已標記80，因溫度大於均值就必須超過3個標準差
      C: Z-score已標記80而IQR未標記，因2.4812已超過3而80未超過48.75
      D: Z-score未標記80而IQR已標記，因2.4812未超過3而80已超過48.75
    answer: D
    explain:
      A: IQR上界為48.75，不同規則用到的分布摘要也不同，結果不必一致。
      B: 大於均值只保證Z分數為正，不代表距離超過三個標準差。
      C: 兩個不等式都看反，2.4812小於3而80大於48.75。
      D: 此處Z未超界而IQR超界；同八筆估均值與分母n標準差時，樣本內絕對Z上限約2.6458，不能由此推論IQR一般較好。
  - id: c4
    goal: g3
    type: choice
    prompt: 22個同尺度座標形成一密一疏兩群；某點離全體中心不遠，卻比附近密群明顯稀疏。若重點是這種局部差異，先考慮哪種方法？
    options:
      A: 用IQR逐欄建立上下界，檢查該點是否嚴格超出任一欄的全域界線
      B: 用LOF比較自己與近鄰的局部密度，檢查該點是否相對鄰居更稀疏
      C: 用k-means建立群中心，檢查該點到最近中心的距離是否超過固定門檻
      D: 用Z-score逐欄建立分數，檢查該點是否偏離任一欄的全域均值
    answer: B
    explain:
      A: 逐欄全域界線不比較鄰居密度，可能漏掉群內相對稀疏的點。
      B: LOF以近鄰作比較基準，符合題目關心的相對局部稀疏程度。
      C: 中心距離配固定門檻沒有比較各鄰域的密度，密疏群可能需要不同距離尺度。
      D: 逐欄Z分數仍以全體均值與標準差為基準，沒有比較近鄰的相對密度。
  - id: c5
    goal: g3
    type: choice
    prompt: 高維設備資料要以隨機分割尋找容易被隔離的點。和LOF相比，Isolation Forest主要依據哪種訊號？
    options:
      A: 隨機分割樹的平均隔離路徑，路徑越短的樣本越可疑
      B: 固定全域中心的歐氏距離，離中心越遠的點越可疑
      C: 近鄰樣本的局部密度比，密度低於鄰居的點越可疑
      D: 每個特徵的絕對Z分數取最大值，最大值越大的點較可疑
    answer: A
    explain:
      A: 孤立森林透過隨機切割隔離樣本，以較短路徑作為可疑訊號。
      B: 這是全域中心距離法，沒有透過隨機分割建立隔離路徑。
      C: 這接近LOF的局部密度比較，並非孤立森林的隨機隔離機制。
      D: 這是合併單欄標準化偏離的規則，沒有建立隨機分割樹或計算隔離路徑。
---

## 為什麼需要

離群值（Outlier，也稱異常值）可能是輸入錯誤，也可能是真實的設備故障或稀有交易。兩者都能偏離多數樣本，但對模型的意義不同。

本組快照的999是已確認的錯誤碼；80°C則有獨立儀表佐證。偵測先產生調查候選，再由來源與任務決定保留、修正或排除。

## 直覺

看同一欄數值，箱型圖能找偏離中間區間的點，時間圖能看突升發生在哪一刻。若同時看多個特徵，散佈圖還能看群集與周圍的疏密。

![先確認單位一致，再沿時間看999尖峰與有佐證的80°C。](figure:l23301-outlier-detection-time)

圖中先把176°F換回80°C，999仍是突出的尖峰。它是錯誤碼的結論來自通訊紀錄，不是因為圖上最高。

箱型圖則把中間區間與候選點放在同一尺度比較。以下圖形與後文共用八筆校準資料，先注意80與箱體的位置關係。

![箱體表示中間一半觀測，80落在候選上界之外但仍需查明來源。](figure:l23301-outlier-detection-box)

## 定義與公式

Z分數（Z-score）以平均與標準差衡量偏離；四分位距（Interquartile Range，IQR）以中間一半資料的範圍建立候選界線。指引列出這兩種方法，以下把計算展開。

### Z分數與條件（補充）

本頁用固定參考資料的經驗均值及分母為n的標準差：

$$
\begin{aligned}
\bar{x}&=\frac{1}{n}\sum_{i=1}^{n}x_i\\
s_0&=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(x_i-\bar{x})^2}
\end{aligned}
$$

$n$是參考筆數，$x_i$是第$i$筆，$\bar{x}$是參考均值，$s_0$是這份資料的標準差。接著將待判讀值轉成離均值幾個標準差：

$$
z=\frac{x-\bar{x}}{s_0}
$$

$x$是待判讀值，$z$是標準化後的偏離。採$|z|>3$作示範候選規則；門檻不是錯誤機率或正確性保證。

NumPy的`ddof=0`對應上式；樣本式分母$n-1$會得到另一個標準差，必須宣告慣例。

近似單峰、對稱的資料較容易解讀此距離；偏態與多群可能讓規則漏抓或多抓。小樣本另有上限限制，見「算一次」。

若$s_0=0$，不能相除；應另查常數欄與新值差異。極端值也會拉動均值及標準差，因此不要把「Z未超界」解讀成「已證明正常」。

### IQR界線與條件

科3指引5-56以1.5倍IQR建立候選範圍，可寫成：

$$
\begin{aligned}
\mathrm{IQR}&=Q_3-Q_1\\
L&=Q_1-1.5\,\mathrm{IQR}\\
U&=Q_3+1.5\,\mathrm{IQR}
\end{aligned}
$$

$Q_1$與$Q_3$分別是25%與75%分位數，$L$、$U$是下、上界。本文以$x<L$或$x>U$標候選，剛好等於邊界不標。

:::supplement[來源：NumPy quantile；NIST Box Plot]
本例四分位採NumPy的`method="linear"`，先宣告插值慣例，才能核對不同套件的結果。

IQR較不受少數極端值牽動，但不代表適合所有分布。合法長尾仍可能超界；IQR為0時界線會塌縮，先查是否大量同值及量測解析度，不能直接把非中位數全刪掉。
:::

## 算一次

### 同八筆資料比較（補充）

取製造訓練索引0、1、2、4、6、7、8、3，得到10、20、30、25、10、20、30、80°C。八筆校準子集的門檻，不代表全24筆的估計。

1. 總和225，均值225÷8=28.125°C。
2. 平方偏差總和3496.875，除以8得變異數437.109375，開根號得$s_0\approx20.9072$°C。
3. 代入80，$z=(80-28.125)/20.9072\approx2.4812$，未超過3。
4. 排序為10、10、20、20、25、30、30、80。25%位置在第2、3值間75%處，故$Q_1=17.5$；$Q_3=30$。
5. IQR為30−17.5=12.5，下界17.5−18.75=−1.25，上界30+18.75=48.75°C。

80超出IQR上界，卻未超出Z門檻。這筆80已有量測證據，仍不能只因超界就刪除。

同一批資料同時估均值與$s_0$時，第$i$筆的Z分數$z_i$滿足$|z_i|\leq\sqrt{n-1}$。八筆的上限約2.6458，門檻3不可能達到；至少11筆才可能嚴格超過3。

這是小樣本的結構限制，不能推論IQR一般較敏感。若拿獨立新值對固定參考均值與標準差計分，則不受這個樣本內上限約束。

箱體由Q1到Q3，中線是中位數22.5；本圖的鬚延伸到界內實際最小與最大值10、30，不是直接畫到−1.25與48.75。不同套件的分位算法可能不同，做數字比較前要先對齊。

零售同索引金額為10倍：均值281.25元、標準差約209.0716元，IQR界線−12.5～487.5元。800元的Z仍約2.4812，IQR仍會標記。

### 全域與局部怎麼看

散佈圖能輔助觀察群集與候選點的相對位置。圖中同時保留密群、疏群及兩個待查點，先看候選和哪一群接近。

![密群旁的候選離全體中心不遠，疏群中的點則不必因稀疏而一律異常。](figure:l23301-outlier-detection-local-global)

:::supplement[來源：scikit-learn LocalOutlierFactor；不同密度群的比較教學]
全域距離把所有資料當成一個參考整體；多群資料可能沒有代表所有人的單一中心。局部離群則問：這個點是否比它自己的鄰居明顯稀疏？

圖用同尺度的22個教學座標。一點在密群旁、與密群有明顯間隔，即使離全體中心不遠，也可能是局部候選；疏群成員若和自己鄰居密度相近，未必需要標記。

局部離群因子（Local Outlier Factor，LOF）用近鄰密度作相對比較，鄰居數會影響「局部」的範圍。

LOF正向分數約1，表示密度與鄰居接近；明顯大於1，表示相對稀疏。scikit-learn的`negative_outlier_factor_`存負分數，讀取時要先分清正負方向。
:::

## 程式

### 同樣的輸入，各自套界線（補充）

```python
import numpy as np
x = np.array([10, 20, 30, 25, 10, 20, 30, 80], dtype=float)
mean, sd = x.mean(), x.std(ddof=0)
z = (x - mean) / sd
q1, q3 = np.quantile(x, [0.25, 0.75], method="linear")
iqr = q3 - q1
low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
print(round(float(mean), 4), round(float(sd), 4))
print(round(float(z[-1]), 4), x[np.abs(z) > 3].tolist())
print(low, high, x[(x < low) | (x > high)].tolist())
```
```text
28.125 20.9072
2.4812 []
-1.25 48.75 [80.0]
```

:::tip[讀碼重點]
`|`合併兩個布林遮罩，每側條件要加括號。這段已知標準差及IQR不為零；正式流程先檢查常數欄，再使用訓練資料所定的規則。
:::

## 怎麼用、怎麼判讀

先查單位、格式與已知錯誤碼，再依資料結構選候選方法。高維關係不一定能靠單欄門檻發現，圖形則能協助提出後續調查問題。

### 方法各在看什麼

孤立森林（Isolation Forest）用隨機切割的隔離難易度，不能把它說成全域中心距離法。較短的平均隔離路徑，表示樣本較容易被分離出來。

科3指引4-51～4-52指出，它適合大量、高維資料；靠近正常群、較難隔離的離群點則可能漏抓。效率優勢不代表所有高維資料都能分得好。

| 方法 | 比較基準 | 適合先問 |
|---|---|---|
| Z-score | 均值與標準差 | 單欄偏離中心多少？ |
| IQR | 中間一半資料的範圍 | 有無明顯超界值？ |
| Isolation Forest | 隨機分割的隔離路徑 | 多維樣本是否容易被隔離？ |
| LOF | 自己與近鄰的局部密度（補充） | 密疏不同時是否相對偏離？（補充） |

:::supplement[來源：scikit-learn Novelty and Outlier Detection；Common pitfalls 12.2]
LOF依賴近鄰與距離，先依欄位單位及意義縮放，再檢查鄰居數。資料量大時，近鄰搜尋的時間與記憶體成本也須評估；高維中距離可能失去辨別力。

若候選規則需要估計參數，先固定切分，只在訓練區估計，驗證區沿用規則。圖中的已知生成身分只供教學核算，不可拿來當模型輸入。
:::

### 換個場景

| 場景／資料條件 | 先看的證據 | 判讀重點 |
|---|---|---|
| 輸入錯誤、錯置或極端觀測 | 原始輸入、箱型與時間圖 | 超界是調查起點 |
| 高維資料 | 多欄關係與模型候選 | 可比較Isolation Forest與LOF |
| 欺詐或設備故障 | 事件本身有無預測價值 | 有效罕見值可能正是目標 |
| 零售大額訂單（補充） | 金額分布與訂單憑證 | 合法長尾不等於輸入錯誤 |
| 交通感測（補充） | 同地點時段與設備狀態 | 平常值也可能在特定時段異常 |

## 常見誤解

- **所有極端值都刪掉。** 罕見但真實的事件可能是預測目標。
- **IQR與Z應該得到同一批候選。** 兩法對中心與分散的定義不同。
- **稀疏群就是異常群。** 局部比較還要看該點與自己鄰居的關係。（補充）
- **孤立森林等於距均值最遠。** 它使用的是隨機隔離路徑。

## 進階

### 候選與正式檢定（補充）

本頁的Z與IQR是候選規則，沒有用八筆資料證明分布近似常態。若要做正式離群檢定，還要指定分布假設、單點或多點檢定及顯著水準，不能把門檻3當成檢定結論。

### 參考來源

- 科目1指引`guide-1:5-4`，科目3指引`guide-3:5-3`、`guide-3:5-56`：偵測、視覺化、處理策略及1.5倍IQR；已核對PDF頁面。
- 科目3指引`guide-3:4-51`～`guide-3:4-52`：孤立森林的隔離路徑、大量高維資料及近群候選的限制。
- [NIST 離群值偵測](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)：來源查證及小樣本限制；樣本內上限由其分母n−1的慣例換算成本頁分母n。
- [NIST 箱型圖教學](https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm)：IQR界線、箱體與鬚端。
- [NumPy std](https://numpy.org/doc/stable/reference/generated/numpy.std.html)、[quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)：分母慣例與線性分位計算。
- [scikit-learn 異常偵測指南](https://scikit-learn.org/stable/modules/outlier_detection.html)：孤立森林與LOF的比較、使用限制。
- [scikit-learn LocalOutlierFactor](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.LocalOutlierFactor.html)：正向LOF分數與套件負分數的方向。
- [scikit-learn 特徵縮放教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_scaling_importance.html)：距離受特徵尺度支配的原因。
- [scikit-learn 常見錯誤12.2](https://scikit-learn.org/stable/common_pitfalls.html)：只在訓練區估計前處理參數。
- [LOF教學例](https://scikit-learn.org/stable/auto_examples/neighbors/plot_lof_outlier_detection.html)、[不同密度群的比較教學](https://scikit-learn.org/stable/auto_examples/miscellaneous/plot_anomaly_comparison.html)：局部與全域圖的教學構想，座標為本組自建。

## 小結

- 候選可能是錯值，也可能是值得保留的有效事件。
- 門檻要寫出統計基準，先統一單位再計算。
- 箱型、散佈與時間圖看的是不同結構，要互相核對。
- Z與IQR的算例不能替代分布檢查；局部與全域判讀也不能混為一談。（補充）
