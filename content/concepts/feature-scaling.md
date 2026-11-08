---
id: feature-scaling
title: 特徵縮放與標準化
kind: technique
codes: [L23301, L21301]
aliases: [Feature Scaling, Min-Max Scaling, "Min-Max、Z-score 與 Robust Scaling", MinMaxScaler, Normalization, RobustScaler, StandardScaler, Standardization, Z-score 標準化]
requires: [descriptive-statistics, train-val-test-split]
summary: 用訓練資料調整各欄數字大小，避免數字較大的欄位過度影響模型
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-4, guide-3:5-6, guide-3:5-7]
goals:
  - id: g1
    text: 依尺度、偏態與離群值比較Min-Max、Z-score及Robust Scaling
  - id: g2
    text: 以訓練統計量計算新值，處理超界、零分母並辨認除以255的差異
formula_groups:
  - id: min-max
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.MinMaxScaler.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: z-score
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: robust-scale
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.RobustScaler.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 20筆旅次距離大多在0–8公里，另有2筆64公里；要讓KNN不被票價的元單位支配，又不想讓極端值決定中心與尺度，先比較哪種處理？
    options:
      A: Min-Max，以訓練最小值和最大值決定中心與尺度
      B: Z-score，以訓練平均值和標準差抵抗所有極端值
      C: Robust，以訓練中位數和四分位距決定中心與尺度
      D: 除以255，以固定影像上限決定距離與票價的尺度
    answer: C
    explain:
      A: Min-Max直接依賴最大與最小值，64公里仍會壓縮一般旅次的範圍。
      B: 平均與標準差會受極端值影響，不能宣稱抵抗所有極端值。
      C: 中位數與四分位距較不受少量尾端值牽動，適合先作比較基準。
      D: 255是特定像素格式的上限，並非公里或元的自然尺度。
  - id: c2
    goal: g2
    type: choice
    prompt: 距離訓練最小0、最大64、平均10、標準差√330、中位4.5、IQR為5。新旅次8公里的三種縮放依序為Min-Max、Z-score、Robust，何者正確？
    options:
      A: "0.125、約−0.110、0.700"
      B: "0.125、約−0.110、1.600"
      C: "0.125、約0.440、0.700"
      D: "0.875、約−0.110、0.700"
    answer: A
    explain:
      A: 依序是8/64、(8−10)/√330及(8−4.5)/5。
      B: Robust要先減中位數，8/5漏掉中心化。
      C: Z-score要先減平均，8/√330不是標準化結果。
      D: 0.875是1−8/64，不是本題Min-Max的定義。
  - id: c3
    goal: g1
    type: choice
    prompt: 將20筆右偏距離做Z-score，訓練平均變0、標準差變1。關於長尾的判讀何者正確？
    options:
      A: 長尾必定消失，因為平均0與標準差1足以定義常態形狀
      B: 長尾必定反向，因為低於平均的旅次都被轉成了負值
      C: 長尾必定被刪，因為超過3個標準差的旅次會自動移除
      D: 長尾仍然存在，因為正斜率線性縮放不改變分布形狀
    answer: D
    explain:
      A: 相同的平均與標準差可以對應多種分布，並不能保證常態。
      B: 中心化改變零點，不會把排序與長尾方向反轉。
      C: StandardScaler不會自動刪除或截斷離群值。
      D: Z-score只平移與縮放，右尾相對位置仍然保留。
  - id: c4
    goal: g2
    type: choice
    prompt: 訓練距離範圍0–64，新值128；另有訓練欄位全為7。下列如何處理才合理？
    options:
      A: 新值重fit後映成1；常數欄代入原式除以0再繼續訓練
      B: 新值沿用規則得2；常數欄先識別並採明確的退化處理
      C: 新值沿用規則得1；常數欄直接宣稱轉換後標準差為1
      D: 新值重fit後映成2；常數欄以驗證資料估計新的標準差
    answer: B
    explain:
      A: 驗證新值不能重新估計範圍，數學上也不能直接除以0。
      B: 未啟用截斷時128/64=2；零分母需另訂刪欄或套件約定。
      C: 新值可超出訓練區間，常數轉成全0後標準差仍是0。
      D: 驗證資料不能用來替訓練轉換器估計尺度。
---

## 為什麼需要

同一張表的收入可能以萬元記，年齡以歲記。模型直接計算距離時，數字較大的欄位可能影響更多。計算梯度（用來判斷參數調整方向的數值）時，也有同樣的問題。

特徵縮放（Feature Scaling）調整各欄數字的大小。這樣能避免欄位只因數字大，就影響模型更多。

指引提到線性模型、SVM、KNN 與神經網路。這些模型常會算距離、計算梯度，或限制參數大小。限制參數大小的做法，稱為參數懲罰。

## 直覺

以下三種方法都用訓練資料決定換算規則。

- 先減掉訓練最小值。再除以訓練最大值與最小值之差。這叫 Min-Max 正規化（Normalization）。
- Z-score 先減掉訓練平均值。再除以標準差（衡量資料與平均值相差多遠的數值）。這叫標準化（Standardization）。
- 先減掉中位數（資料排序後，由中間位置決定的數值）。再除以四分位距（衡量資料中間部分分散程度的數值）。這叫穩健縮放（Robust Scaling）。

:::supplement[來源：scikit-learn Normalizer]
scikit-learn的`Normalizer`逐列把非零向量調整成單位範數；本頁Min-Max則逐欄調整範圍，兩者不同。
:::

三者都是先減掉一個數，再除以一個數。少數值遠離大多數資料，這些值稱為離群值。Min-Max 與 Z-score 會受離群值影響。

Robust 較不受離群值影響，但不會自動刪掉極端旅次。Robust 也不保證轉換後符合任何特定分布。

![四格圖各用自己的橫軸範圍。一般旅次與64公里旅次的相對位置都保留。](figure:l23301-feature-scaling-distribution)

:::caution[注意]
科目3指引5-7把 Z-score 結果稱為常態分布。平均0、標準差1，不代表常態分布。輸入也不必先符合常態分布。上圖仍保留少數長程旅次形成的長尾，是反例（補充）。
:::

## 定義與公式

### Min-Max：訓練範圍作分母

Min-Max預設把訓練資料縮放至0到1。

:::supplement[來源：scikit-learn MinMaxScaler]
使用訓練欄的最小值與最大值計算：

$$
x_{\mathrm{mm}}=\frac{x-a}{b-a}
$$

$x$是待轉換值，$a,b$是訓練欄最小、最大值，要求$b>a$。新資料沿用相同$a,b$；超出訓練範圍時，結果可以小於0或大於1。
:::

### Z-score：訓練平均與標準差

對非常數的訓練欄位，Z-score轉換後平均為0、標準差為1。

:::supplement[來源：scikit-learn StandardScaler]

$$
\mu=\frac{1}{n}\sum_{i=1}^{n}x_i,\qquad
\sigma=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(x_i-\mu)^2},\qquad
z=\frac{x-\mu}{\sigma}
$$

$x_i$是第$i$筆訓練值，$n$是筆數，$\mu,\sigma$是平均與標準差。分母用$n$，與StandardScaler的`ddof=0`一致；要求$n>0$且$\sigma>0$。
:::

### Robust：中位數與IQR

Robust使用中位數與四分位距（IQR）進行縮放。

:::supplement[來源：scikit-learn RobustScaler]

$$
\mathrm{IQR}=Q_3-Q_1,\qquad
x_{\mathrm{rob}}=\frac{x-m}{\mathrm{IQR}}
$$

$m$是訓練中位數，$Q_1,Q_3$是第25與75百分位數，IQR為四分位距，要求IQR大於0。這是RobustScaler預設設定；不是把結果限制在0到1。
:::

## 算一次

共用JSON的交通距離訓練20筆，是0、1、2、3、4、5、6、7、8、64各出現2次。外層驗證固定為索引20–27，各頁均不重切。

### 先算訓練統計量（補充）

總和200，故平均200÷20=10；平方和8600，變異8600÷20−10²=330，標準差約18.165902。

排序後中央兩筆為4與5，中位數4.5；採NumPy預設線性分位數，Q1=2、Q3=7，IQR=5。最小0、最大64。

### 同一新值，三種結果（補充）

例如8公里：Min-Max是8÷64=0.125；Z-score是(8−10)÷√330≈−0.110；Robust是(8−4.5)÷5=0.700。

| 距離公里 | Min-Max | Z-score | Robust |
|---|---:|---:|---:|
| 0 | 0 | −0.550 | −0.900 |
| 4 | 0.0625 | −0.330 | −0.100 |
| 8 | 0.125 | −0.110 | 0.700 |
| 64 | 1 | 2.973 | 11.900 |
| 128，驗證新值 | 2 | 6.496 | 24.700 |

零售價格是同列距離加1後乘10。訓練平均110元、標準差10√330、中位數55、IQR為50；驗證1290元轉換後仍為2、6.496、24.700，可核對單位差異已消除。

### 零分母與固定除數（補充）

常數欄全為7，範圍、標準差與IQR皆為0，三條原式都不能直接套。可以刪除無資訊欄，或採明確的套件退化約定，不要假稱仍能得到單位變異。

本例scikit-learn對常數欄以尺度1處理：訓練7變0，新值8變1。另有1、1、1、1、2，IQR仍為0，卻不是常數；需先辨認原因，不能一律當作全欄相同。

8位元像素範圍固定0–255，除以255可映入0–1。若訓練只有50、100、200，50÷255≈0.196，依訓練範圍做Min-Max卻是0；兩者不是同一規則。

## 程式（補充）

### 三種縮放只fit訓練集

下列陣列與共用JSON完全相同；縮放器學完後，只對新值做`transform`。

```python
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, RobustScaler
train = np.tile([0., 1., 2., 3., 4., 5., 6., 7., 8., 64.], 2).reshape(-1, 1)
new = np.array([[8.], [128.]])
for scaler in [MinMaxScaler(), StandardScaler(), RobustScaler()]:
    scaler.fit(train)
    print(scaler.__class__.__name__, np.round(scaler.transform(new).ravel(), 3).tolist())
print("訓練平均與標準差:", round(float(train.mean()), 3), round(float(train.std()), 3))
```
```text
MinMaxScaler [0.125, 2.0]
StandardScaler [-0.11, 6.496]
RobustScaler [0.7, 24.7]
訓練平均與標準差: 10.0 18.166
```

### 檢查退化欄位

```python
for scaler in [MinMaxScaler(), StandardScaler(), RobustScaler()]:
    old = scaler.fit_transform([[7.], [7.]]).ravel().tolist()
    print(scaler.__class__.__name__, old, scaler.transform([[8.]]).ravel().tolist())
q = np.array([1., 1., 1., 1., 2.])
print("IQR與標準差:", np.diff(np.percentile(q, [25, 75])).item(), round(float(q.std()), 3))
print("像素50:", round(50 / 255, 3), MinMaxScaler().fit([[50.], [100.], [200.]]).transform([[50.]]).item())
```
```text
MinMaxScaler [0.0, 0.0] [1.0]
StandardScaler [0.0, 0.0] [1.0]
RobustScaler [0.0, 0.0] [1.0]
IQR與標準差: 0.0 0.4
像素50: 0.196 0.0
```

:::tip[讀碼重點]
先`fit(train)`，再對驗證與未來資料`transform`。MinMaxScaler預設`clip=False`；值2是合法的超界結果，不能為了壓回1就讀驗證資料重fit。
:::

## 怎麼用、怎麼判讀

| 方法 | 優先比較的條件 | 主要限制 |
|---|---|---|
| Min-Max | 希望訓練值落在固定區間 | 極端值壓縮一般值的範圍 |
| Z-score | 需比較中心與離散程度 | 平均、標準差受離群值影響 |
| Robust | 偏態或有少量離群值 | 不保證常態，也不移除長尾 |

縮放處理的是量級；若想改變右偏形狀，接著看對數與冪次轉換。兩者解決的問題不同，可以先轉換再縮放。

:::supplement[來源：scikit-learn Common pitfalls；Compare the effect of different scalers on data with outliers]
比較方法要固定模型、切分與評估指標。K-fold交叉驗證時，每一摺各自fit；用Pipeline包住前處理，才能避免全資料統計先流進驗證摺。
:::

### 換個場景

| 場景／資料條件 | 縮放考量 | 判讀重點 |
|---|---|---|
| 收入與年齡量級不同 | 線性模型、SVM先比較縮放 | 避免單位大小決定影響力 |
| KNN、神經網路 | 距離或梯度對尺度敏感 | 保持訓練與推論規則一致 |
| 偏態或含離群值 | 比較Robust與其他方法 | 穩健不等於常態化 |
| 交通旅次（補充） | 公里與票價使用訓練統計 | 長程旅次仍保留 |
| 零售價格（補充） | 用元與十元各算一次縮放 | 只改單位，縮放結果不變 |

## 常見誤解

- **標準化會產生常態分布。** 線性縮放保留形狀，長尾不會自動消失。（補充）
- **Robust會把離群值裁掉。** 它更換中心與尺度，沒有執行刪除或截尾。
- **Min-Max的新資料一定介於0與1。** 只有訓練範圍內有此保證；新值可能超界。（補充）
- **除以255就是所有欄位的Min-Max。** 它利用像素格式的固定上限，不會估計每欄最小與最大。（補充）

## 進階

### 稀疏矩陣的中心化（補充）

One-hot編碼常有大量0，減平均會讓0變非0，破壞稀疏結構。StandardScaler用於稀疏矩陣時，須確認`with_mean=False`及模型需求。

### 參考來源

- 科目1指引5.1，`guide-1:5-4`：正規化、標準化與梯度模型用途。
- 科目3指引5.1，`guide-3:5-6`～`guide-3:5-7`：三種尺度調整、離群值敏感度與指引場景。
- [MinMaxScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.MinMaxScaler.html)：Min-Max公式、預設不截斷與程式。
- [Normalizer](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.Normalizer.html)：直覺段中逐列單位範數與逐欄縮放的區別。
- [StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)：Z-score、分母、常數欄及稀疏矩陣。
- [RobustScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.RobustScaler.html)：中位數／IQR公式與預設設定。
- [縮放器比較教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_all_scaling.html)：直覺圖的比較思路與離群值判讀。
- [Google數值正規化課程](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization)：按資料條件選方法的教學思路。
- [Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：訓練統計重用與折內fit。

## 小結

- 縮放讓量級可比較，距離與梯度模型尤其要留意。
- Min-Max依範圍、Z-score依平均與標準差，Robust依中位數與IQR。
- 線性縮放不會把偏態改成常態。（補充）
- 先切分再fit，明確處理超界與零分母。（補充）
