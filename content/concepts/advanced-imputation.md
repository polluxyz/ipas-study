---
id: advanced-imputation
title: 相似樣本與模型補值
kind: technique
codes: [L23301]
aliases: [Hot Deck, KNN Imputer, Model-based Imputation]
requires: [missing-value-imputation]
summary: 利用其他已知特徵挑選供體或建立預測模型，估計缺失欄位
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-2, guide-3:5-3]
goals:
  - id: g1
    text: 比較Hot Deck、KNN與模型補值的流程、尺度和相關性條件及不確定性限制
formula_groups:
  - id: neighbor-average
    source: https://scikit-learn.org/stable/modules/generated/sklearn.impute.KNNImputer.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-A
  - id: fitted-linear-rule
    source: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一筆缺溫度的樣本，最近兩筆訓練供體溫度是20及30°C。指定Hot Deck取第一筆，KNN用兩鄰居均勻平均，結果何者正確？
    options:
      A: Hot Deck補25，KNN一定補20
      B: Hot Deck補20，KNN補25
      C: 兩者都必須補35，因為全欄平均35
      D: 兩者都會自動知道真實溫度是25
    answer: B
    explain:
      A: 指定Hot Deck取一筆供體應得20，均勻平均才會得到25。
      B: Hot Deck複製選中供體的觀測值，兩鄰居平均為25。
      C: 相似樣本方法使用鄰近供體，不必等於全欄平均。
      D: 估計值可以剛好命中，但演算法沒有讀到缺失真值。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊用24筆訓練列的壓力預測缺失溫度，對驗證兩個缺口誤差為0。哪項後續判讀合適？
    options:
      A: 改用含驗證列在內的全部32筆真值再fit，讓成績更穩
      B: 只要這兩筆為0，所有MNAR缺失都已修正
      C: 檢查關係是否來自合成規則，並評估真實噪音、尺度及部署可用性
      D: 改用KNN時，任何量綱的欄位都能直接相加算距離
    answer: C
    explain:
      A: 驗證真值不能回流訓練補值器，否則失去獨立評估邊界。
      B: 兩個缺口命中不能證明對其他缺失機制無偏。
      C: 教學資料有刻意的完美線性關係，實務仍須驗證訊息與不確定性。
      D: 多個距離特徵的尺度會改變鄰居排序，必須先確認量綱與處理方式。
---

## 為什麼需要

整欄均值忽略了樣本差異。若壓力能解釋溫度，同樣缺溫度的兩台機器，不一定該補相同數字。

相似樣本補值利用其他特徵找到可參考的樣本；預測模型補值則學習欄位之間的關係。指引指出，模型補值適合特徵間相關性高的情況。

## 直覺

Hot Deck從相似樣本挑一筆有觀測值的供體；KNN補值（KNN Imputation）參考多個鄰居；模型補值（Model-based Imputation）則用已知欄位預測缺失欄位。

![三條分支比較取單一供體、平均鄰居與學得函數，所有規則都只能來自訓練資料。](figure:l23301-advanced-imputation-flow)

## 定義與公式

### 三種方法利用什麼

| 方法 | 用到的資訊 | 數值欄怎麼補 |
|---|---|---|
| Hot Deck | 相似或同組的已觀測供體 | 複製選中供體的值 |
| KNN | 可比較特徵的鄰近樣本 | 依鄰居值聚合 |
| 預測模型 | 缺值欄與其他欄的關係 | 數值用迴歸、類別用分類 |

:::supplement[來源：Andridge與Little 2010；scikit-learn KNNImputer]
Hot Deck可以按群組或距離定義相似，不只一種實作。KNN若取一個供體可與最近供體方法重疊；本頁比較的是「取一筆」與「多鄰居均勻平均」。

對目標缺值欄，供體必須在該欄有觀測。scikit-learn的`KNNImputer`使用可共同觀測特徵計算缺值友善距離，並非先把所有空白當0。
:::

### 鄰居平均（補充）

指定均勻權重時，KNN數值補值為：

$$
\hat{x}=\frac{1}{k}\sum_{r\in N_k}x_r
$$

$N_k$是被選中的$k$個訓練供體，$x_r$是供體該欄的觀測值，$\hat{x}$是估計值。這裡假設有足夠可用供體；距離加權時不能再直接套這個平均。

本例兩個鄰居是20與30°C，因此補成$(20+30)/2=25$°C。這是局部中心，不是全欄均值35°C。

### 學得線性規則（補充）

用一個完整的輔助欄預測缺值欄時，可寫成：

$$
\hat{x}=a+bz
$$

$z$是已觀測的輔助特徵，$a$是截距，$b$是斜率。只用訓練集中$x$有值的列擬合；本例輔助欄無缺值，否則要另處理輸入缺口。

製造資料的截距$a=10$°C、斜率$b=10$°C/bar。壓力$z=1.5$bar時，$\hat{x}=10+10\times1.5=25$°C。

## 算一次

### 用同一份資料找資訊

:::supplement[來源：scikit-learn KNNImputer；LinearRegression；Common pitfalls]
共用資料`L23301-A-missing-data.json`兩域各32筆，前24筆訓練、後8筆驗證。補值只用輔助欄，不讀真值、標籤及事後原因。

製造前4筆的壓力依序為0、1、2、7bar，溫度是10、20、30、80°C。M05壓力1.5bar，溫度缺失。

1. **Hot Deck**：把M02指定為相似供體，補它的觀測20°C。
2. **KNN**：在這4個示範供體中取最近兩筆M02、M03，平均後補25°C。
3. **模型補值**：以有溫度的訓練列學關係，再對M05的壓力預測，得到25°C。

完整訓練資料有重複供體。程式取8鄰居，M05參考4個20與4個30，平均仍為25；這與4筆示範取2鄰居的設定不同。

這批資料刻意設定完美線性關係。模型命中25只是教學規則的結果，不代表真實感測缺值都能精準復原。
:::

三者依序利用單一相似供體、多個鄰居的觀測值，以及其他特徵與缺值欄的預測關係。可利用的資訊不同，所需假設也不同。

### 同切分比較（補充）

只在固定驗證缺口索引28、29核算，真值為45、65°C；其他6筆驗證列沒有遮值。平均絕對誤差只衡量這兩個缺口，不是下游故障模型的表現。

| 方法 | 兩個缺口的結果°C | 缺口平均絕對誤差°C | 驗證列可保留比例 |
|---|---|---:|---|
| 刪除缺值列 | 無結果 | 不適用 | 6/8 |
| 訓練均值 | 35、35 | 20 | 8/8 |
| 訓練中位數 | 25、25 | 30 | 8/8 |
| KNN，8鄰居均勻權重 | 25、55 | 15 | 8/8 |
| 線性模型 | 45、65 | 0 | 8/8 |

線性模型兩個誤差都是0；均值補值兩個絕對誤差為10與30，平均20。刪除法沒有補值結果，不能把「沒有錯誤可算」當成誤差0。

零售在相同索引的真值為450、650元，均值補350、350，缺口平均絕對誤差200元；KNN補250、550，誤差150元。這只是相同合成規則的換景，不是跨產業效果的證據。

## 程式（補充）

### 同一訓練集、兩種補值器

下段重建JSON的數值欄；壓力完整可見，溫度只在固定位置遮住。只用一個距離特徵，避免在這個最小例混入多欄尺度問題。

```python
import numpy as np
from sklearn.impute import KNNImputer
from sklearn.linear_model import LinearRegression
truth = np.tile([10., 20., 30., 80., 25., 45.], 4)
temp = truth.copy(); temp[np.arange(24) % 6 >= 4] = np.nan
pressure = (truth - 10) / 10
train = np.column_stack([pressure, temp])
valid = np.array([[3.5, np.nan], [5.5, np.nan]])
knn = KNNImputer(n_neighbors=8, weights="uniform").fit(train)
known = ~np.isnan(temp)
reg = LinearRegression().fit(pressure[known, None], temp[known])
print("KNN:", knn.transform(valid)[:, 1].round(3).tolist())
print("模型:", reg.predict(valid[:, :1]).round(3).tolist())
print("參數:", round(reg.intercept_, 3), round(reg.coef_[0], 3))
```
```text
KNN: [25.0, 55.0]
模型: [45.0, 65.0]
參數: 10.0 10.0
```

### 驗證誤差只讀真值作核算

下面接續前段已fit的補值器。`actual`只進入誤差計算，沒有參與fit或補值輸入。

```python
actual = np.array([45., 65.])
predictions = {"均值": np.full(2, np.nanmean(temp)),
               "中位數": np.full(2, np.nanmedian(temp)),
               "KNN": knn.transform(valid)[:, 1],
               "模型": reg.predict(valid[:, :1])}
for name, pred in predictions.items():
    print(f"{name} MAE={np.mean(np.abs(actual - pred)):.3f}")
```
```text
均值 MAE=20.000
中位數 MAE=30.000
KNN MAE=15.000
模型 MAE=0.000
```

:::tip[讀碼重點]
`known`只挑訓練集中溫度有值的列擬合迴歸。完整`truth`用來重建合成輸入；遮值後，模型只接收壓力與可觀測溫度，真值不回流。
:::

## 怎麼用、怎麼判讀

其他特徵若有助辨認相似樣本，鄰居補值才有根據；若與缺值欄存在可泛化的關係，預測模型才可能優於簡單中心。

### 尺度、相關性與不確定性

模型補值適合特徵間相關性高的情況；相似樣本方法則需要能辨認相似性的特徵。

:::supplement[來源：scikit-learn Importance of Feature Scaling；van Buuren 1.3]
多欄算距離時，金額的數值範圍可能壓過壓力或年齡。先依欄位意義選尺度，縮放參數也只由訓練資料學；不是所有類別都能當連續數字量距離。

另用`L23301-A-distance-scale.json`的製造小例，已知壓力1.5bar、維護費1000元，要從兩筆訓練供體挑最近者。這兩欄均已觀測，待補的溫度不參與距離。

| 供體 | 壓力差bar | 費用差元 | 原尺度平方距離 |
|---|---:|---:|---:|
| 甲 | 1 | 500 | 250001 |
| 乙 | 2 | 0 | 4 |

直接把兩欄差值平方後相加，會選乙。示範把壓力差除1bar、費用差除1000元，平方距離改為1.25與4，改選甲；尺度足以改變「誰相似」。

這組尺度只是單位示範，不是最佳設定。主表的KNN仍只用完整壓力欄找鄰居，沒有把這個額外費用欄加入比較。

高相關不等於可部署：輔助欄可能在預測當下還拿不到，或部署後關係改變。MNAR若缺少決定漏記的關鍵資訊，換複雜模型也不保證去偏。

主例的維護時段全部缺值，無法直接檢驗該時段的溫度關係。即使模型預測合理，也倚賴關係可由其他時段延伸過來的假設。

單次模型預測通常比真實值更平滑，可能低估殘差變動；KNN平均也可能壓縮局部變異。不要把補值當成無誤差的新量測；推論用途還要處理補值不確定性。
:::

### 換個場景

| 場景／資料條件 | 可用方法 | 必查條件 |
|---|---|---|
| 有特徵相似的可觀測樣本 | Hot Deck或KNN | 供體相似且目標欄有值 |
| 特徵間高度相關 | 迴歸或分類補值 | 關係能否用於缺失樣本 |
| 製造溫度缺口（補充） | 壓力預測溫度 | 壓力當下可用且關係穩定 |
| 零售金額漏記（補充） | 相似購物樣本或金額模型 | 不使用事後退款或真值 |

## 常見誤解

- **KNN補值就是KNN分類。** 補值器的任務是補欄位，不是直接預測下游任務標籤。
- **有模型一定比較好。** 特徵沒資訊、供體不足或關係錯置時，簡單補值可能更穩。
- **誤差0就沒有不確定性。** 本例刻意無噪音，不能外推到真實資料。（補充）
- **驗證集也能當供體。** 這會把評估資料帶回學習過程。（補充）

## 進階

### 多重補值的界線（補充）

反覆迭代欄位預測，不等於已量化補值不確定性。scikit-learn的IterativeImputer預設只產生一份補值結果；多重補值還要產生多份合理資料，並依分析目的合併結果。

### 參考來源

- 科目3指引5.1，`guide-3:5-2`～`guide-3:5-3`：相似樣本、模型補值及高相關條件。
- [Andridge與Little：Hot Deck回顧](https://pubmed.ncbi.nlm.nih.gov/21743766/)：供體方法與Hot Deck定義。
- [KNNImputer](https://scikit-learn.org/stable/modules/generated/sklearn.impute.KNNImputer.html)：鄰居、均勻權重與程式。
- [LinearRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html)：線性模型與參數算例。
- [scikit-learn缺值處理](https://scikit-learn.org/stable/modules/impute.html)：多欄補值、迭代與多重補值的界線。
- [van Buuren：Ad-hoc solutions](https://stefvanbuuren.name/fimd/sec-simplesolutions.html)：教學圖與模型補值低估變異的限制。
- [scikit-learn Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：同切分、訓練供體與轉換邊界。
- [scikit-learn：Importance of Feature Scaling](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_scaling_importance.html)：尺度差異改變距離與鄰居排序。

## 小結

- Hot Deck取供體值，KNN聚合鄰居，模型補值學欄位關係。
- 相似特徵或高相關是可用資訊，還需檢查尺度與可用時點。（尺度與時點為補充。）
- 比較方法要固定資料，刪除法另報保留比例。（補充）
- 模型給出估計，不會自動還原缺失的不確定性。（補充）
