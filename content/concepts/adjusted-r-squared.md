---
id: adjusted-r-squared
title: 調整後 R²
kind: metric
codes: [L23202]
aliases: [Adjusted R-squared]
requires: [r-squared, linear-regression]
guide_refs: [guide-3:4-13]
summary: 在相同資料的線性模型比較中，對增加特徵帶來的擬合改善作自由度調整
goals:
  - id: g1
    text: 說明一般R²與調整後R²的用途及相同資料比較條件
  - id: g2
    text: 計算調整後R²，判斷加入無用特徵的代價與公式適用邊界
formula_groups:
  - id: adjusted-r2
    source: https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.rsquared_adj.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23202-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊以相同60筆房價訓練資料擬合含截距的OLS。加一個無用欄位後訓練R²略升，如何解釋？
    options:
      A: R²略升就證明新欄有實質用途，不需比較複雜度
      B: R²略升就保證測試誤差下降，不需再用保留資料
      C: R²略升就代表新欄有因果效果，不需另查資料來源
      D: R²本來不易因加欄下降，還要看調整值與獨立驗證
    answer: D
    explain:
      A: 相同資料的巢狀OLS增加特徵可保留原解，訓練R²不下降並不意外。
      B: 訓練擬合改善不保證未見資料的誤差下降。
      C: 指標無法把預測關聯轉為因果證據。
      D: 複雜度與泛化需要額外檢查，不能只看訓練R²。
  - id: c2
    goal: g2
    type: choice
    prompt: 六筆資料的SST為5800，含截距、兩個特徵的OLS其SSE為300。調整後R²約為多少？
    options:
      A: "0.914"
      B: "0.948"
      C: "0.871"
      D: "0.969"
    answer: A
    explain:
      A: 1−(300/5800)×5/3約為0.914。
      B: 1−300/5800是未調整的R²。
      C: 這是誤把特徵數設成3後的調整值。
      D: 這是把自由度比值倒過來計算的結果。
  - id: c3
    goal: g2
    type: choice
    prompt: 六筆資料原有兩個特徵，加第三個特徵後，含截距的設計矩陣秩由3變4，SSE仍為300、SST仍為5800。哪個判斷合理？
    options:
      A: 調整值升到0.979，所以三個特徵更值得保留
      B: 調整值降到0.871，因未降低SSE卻消耗自由度
      C: 調整值維持0.914，因R²沒變便不需要再調整
      D: 調整值降到0.741，因截距也要再算一個特徵
    answer: B
    explain:
      A: 自由度比值不能倒置，新增欄位並沒有擬合改善。
      B: n=6、p=3時分母為2，1−(300/5800)×5/2約為0.871。
      C: 題幹已確認秩增加1；SSE不變仍須扣除新增的自由度。
      D: 本頁p不含截距，不能再重複扣一次。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

同一批資料加入更多特徵，模型通常更容易貼近訓練值。若只看決定係數 R²，可能把多記住一些雜訊誤當成進步。

調整後 R²（Adjusted R-squared）把特徵數納入考量。指引以它比較不同複雜度的模型，重點是檢查擬合改善是否值得增加複雜度。

## 直覺（補充）

想像六筆房價只有有限的資訊。每多估計一個係數，就多用掉一份自由度；新欄位若幾乎沒有減少誤差，調整值可能反而降低。

本頁用兩個並列算式呈現這個取捨，不另畫圖。兩模型共用相同目標、筆數及資料列，避免把不同資料的分數硬比。

## 定義與公式（補充）

以下固定為含截距、未加懲罰且設計矩陣滿欄秩的普通最小平方線性模型：

$$
R^2=1-\frac{\mathrm{SSE}}{\mathrm{SST}},\qquad
\overline R^2=1-(1-R^2)\frac{n-1}{n-p-1}
$$

$n$是擬合資料筆數，$p$是特徵數，**不含截距**。SSE是實際減預測的平方和，SST是實際值減同批目標平均的平方和。

要求 $\mathrm{SST}>0$、$n>p+1$。$n-p-1$是殘差自由度；若剛好為0就不能除，若樣本不足也不能把算出的數字當有效比較。

:::caution[注意]
一般R²與調整值都可能為負，不能一律限制在0到1。指引4-13的R²範圍是常見訓練情況，並非所有預測的通則；完整定義見決定係數 R²。
:::

## 算一次（補充）

沿用房屋六筆訓練子集，實際目標為40、50、60、100、110、120，平均80。SST為 $1600+900+400+400+900+1600=5800$。

先用面積、屋齡兩個特徵加截距擬合OLS。得到SSE=300，所以：

$$
R^2=1-\frac{300}{5800}\approx0.948276
$$

$$
\overline R^2_{p=2}=1-\frac{300}{5800}\frac{6-1}{6-2-1}\approx0.913793
$$

### 新欄增加獨立資訊方向

另設教學新欄 $u=(1,-1,0,0,-1,1)$，依同六筆的順序加入；它記在本組調整值示例JSON，不取代共用資料的無關欄。

含截距的設計矩陣秩由3變4，表示多了一個獨立參數方向。但擬合後SSE仍為300，新增欄在這六筆沒有改善誤差。

$$
\overline R^2_{p=3}=1-\frac{300}{5800}\frac{5}{2}\approx0.870690
$$

| 同六筆資料 | 特徵數p | 一般R² | 調整後R² |
|---|---:|---:|---:|
| 面積、屋齡 | 2 | 0.948276 | 0.913793 |
| 再加教學新欄u | 3 | 0.948276 | 0.870690 |

新增的獨立方向沒有換來誤差改善，因此較小模型的調整值較高。新欄在其他有限樣本中也可能偶然降低SSE；是否值得仍要重算，不能只看欄位名稱。

### 相依欄不增加自由度

共用JSON的無關欄在這六筆恰為 $-18+0.15a+1.7z$；$a$是面積，$z$是屋齡。加上它後，含截距矩陣的秩仍為3，不能把有效特徵數當成3。

先刪除相依欄，仍是原來的兩個特徵，調整值維持0.913793。若保留欄位，以矩陣秩減1計算有效特徵數，也得到相同結果；詳見最小平方估計與投影。

能源目標是房價目標的3倍加100，SSE和SST都變9倍，比例不變。兩個滿秩模型仍得到0.913793與0.870690；改加相依欄則維持0.913793。

## 程式（補充）

面積、屋齡與無關欄沿用六筆共用資料，教學新欄u另行明列。程式先檢查含截距矩陣的秩，再算有效特徵數；所有模型都排除面積副本。

```python
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

X = np.array([[10,5],[20,10],[30,5],
              [40,10],[50,5],[60,10]], dtype=float)
y = np.array([40,50,60,100,110,120], dtype=float)
u = np.array([1,-1,0,0,-1,1], dtype=float)
v = np.array([-8,2,-5,5,-2,8], dtype=float)
print("樣本數", len(y))
```
```text
樣本數 6
```

比較原欄位、新增獨立欄與新增相依欄；每次都用同六筆目標重新擬合。

```python
for name, features in [("原兩欄", X), ("加新欄u", np.column_stack([X, u])),
                       ("加相依欄", np.column_stack([X, v]))]:
    design = np.column_stack([np.ones(len(y)), features])
    rank = np.linalg.matrix_rank(design)
    p = rank - 1
    pred = LinearRegression().fit(features, y).predict(features)
    r2 = r2_score(y, pred)
    adj = 1 - (1-r2)*(len(y)-1)/(len(y)-p-1)
    print(name, "秩", rank, "有效p", p, f"R² {r2:.6f}", f"調整 {adj:.6f}")
print("n=4,p=3可用嗎", 4 > 3+1)
```
```text
原兩欄 秩 3 有效p 2 R² 0.948276 調整 0.913793
加新欄u 秩 4 有效p 3 R² 0.948276 調整 0.870690
加相依欄 秩 3 有效p 2 R² 0.948276 調整 0.913793
n=4,p=3可用嗎 False
```

:::tip[讀碼重點]
p只數實際估計的特徵項，截距另扣1；常數欄、重複欄或秩不足時，應先處理設計矩陣，不能照原始欄位數套用本式。
:::

## 怎麼用、怎麼判讀

| 指標 | 回答什麼 | 主要用途 |
|---|---|---|
| 一般R² | 相對平均基準減少多少平方誤差 | 衡量擬合程度 |
| 調整後R² | 納入特徵數後，擬合改善是否足夠 | 比較不同複雜度的模型 |

:::supplement[來源：statsmodels rsquared_adj；Minitab迴歸結果教學]
比較時固定相同目標定義、轉換、觀測資料列與截距設定。若加欄後因缺值少了資料列，應先對齊資料再重新擬合比較。

同一資料上的巢狀OLS加特徵時，訓練SSE不會增加，R²不會下降；調整值則可能升也可能降。調整值仍是樣本內指標，預測選型要搭配交叉驗證與保留測試集。
:::

### 換個場景

| 場景／資料條件 | 怎麼使用 | 比較前確認 |
|---|---|---|
| 不同自變數數量的模型 | 同時查看一般與調整後R² | 複雜度是否得到足夠改善 |
| 房價模型加設備欄（補充） | 比較加欄前後調整值 | 用相同成交資料與價格單位 |
| 能源模型加感測欄（補充） | 比較相同線性模型的特徵組 | 用相同時段與耗電定義 |
| 醫療成本加檢驗欄（補充） | 避免僅靠多欄提高訓練分數 | 對齊缺值後的病人名單 |

## 常見誤解

- **調整後R²高就一定能預測新資料。** 樣本內校正不能取代獨立驗證。（補充）
- **每加一欄調整值都會下降。** 若SSE下降夠多，調整值也能上升。（補充）
- **所有模型都以輸入欄位數當p。** 樹、SVR和正則化模型的有效複雜度不同，不能直接沿用本頁OLS公式。（補充）

## 進階

### 指引的比較範圍如何使用（補充）

指引在多種迴歸模型的評估清單列出調整後R²。本頁將可直接計算的範圍限於上述OLS設定；跨樹、核模型或正則化模型選型，優先比較相同驗證切分上的MSE或R²。

### 參考來源

- 科目3指引`guide-3:4-13`：一般R²與納入複雜度的調整值用途；指引未展開公式。
- [statsmodels rsquared_adj](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.rsquared_adj.html)：含截距的公式與自由度。
- [statsmodels df_resid](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.OLS.df_resid.html)、[df_model](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.OLS.df_model.html)：算例與程式中，以設計矩陣秩判定自由度。
- [Minitab迴歸結果教學](https://support.minitab.com/en-us/minitab/help-and-how-to/statistical-modeling/regression/how-to/fit-regression-model/interpret-the-results/key-results/)：增加特徵時的比較思路與預測評估區別；其中R²範圍需連同樣本內OLS情境理解。
- [Penn State模型建構課程](https://online.stat.psu.edu/stat501/book/export/html/969)：獨立驗證、精簡模型與多項診斷的教學流程。

## 小結

- 調整後R²把特徵數納入複雜度比較。
- 固定相同資料與目標，再比較不同特徵組。（補充）
- 本頁公式中p不含截距，且要求n大於p+1。（補充）
- 樣本內調整不保證泛化，也不能直接套到所有模型。（補充）
