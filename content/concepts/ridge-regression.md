---
id: ridge-regression
title: 嶺迴歸
kind: model
codes: [L23202]
aliases: [Ridge, Ridge Regression]
requires: [linear-regression, l2-regularization]
guide_refs: [guide-3:4-15, guide-3:4-16, guide-3:4-17]
summary: 在線性迴歸加入係數平方和懲罰，收縮大係數以緩和共線性造成的不穩定
goals:
  - id: g1
    text: 計算L2迴歸目標，解釋λ對係數收縮的影響並與Lasso篩選比較
formula_groups:
  - id: ridge-objective
    source: guide-3:4-15
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 六筆房屋某候選式的兩個係數為2與−1，截距20、SSE=475。嶺迴歸以SSE加λ倍係數平方和，λ=10時目標值為多少？
    options:
      A: "505"
      B: "525"
      C: "485"
      D: "725"
    answer: B
    explain:
      A: 505用了絕對值和3，對應本例的Lasso目標。
      B: 平方和4+1=5，475+10×5=525。
      C: 不能先把係數2與−1相加再平方。
      D: 725把平方和5再平方一次；本式只加總各係數的平方。
  - id: c2
    goal: g1
    type: choice
    prompt: 60筆訓練資料有兩個完全相同、已標準化的面積欄。Ridge在λ=120時兩欄係數皆約9.3892，哪個解釋合理？
    options:
      A: 兩欄係數相同表示沒有共線性，可分別當成因果效果
      B: 兩欄係數不為0表示Ridge失效，應強制刪到只剩一欄
      C: 平方懲罰可分攤重複欄的係數，但不會直接篩成單欄
      D: 平方懲罰保證所有測試誤差更低，不必再驗證模型
    answer: C
    explain:
      A: 兩欄仍完全共線，係數配置不能證明各自的因果作用。
      B: Ridge的用途是收縮與穩定化，不是自動產生零係數。
      C: 固定係數總和時，平均分配有較小平方和；篩選需另選方法。
      D: 過強的懲罰也可能欠擬合，測試表現沒有保證。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

當兩個房屋面積欄幾乎重複，普通線性迴歸的個別係數可能不穩。嶺迴歸（Ridge Regression）對係數平方和加上代價，限制過大的係數。

它特別適合多重共線性或高維資料。若希望保留多個相關訊號，而非直接刪成少數欄位，可以把Ridge列入比較。

## 直覺

同樣需要兩個係數合計為2時，分成1與1，平方和是2；集中成2與0，平方和是4。平方懲罰偏好較分散、較小的配置。

:::supplement[來源：scikit-learn Ridge path 教學]
下圖與Lasso 迴歸使用相同房屋60筆訓練資料、相同標準化及λ清單。兩個面積欄完全相同，所以兩條Ridge係數線重疊。
:::

![λ增加時係數往0靠近；面積與副本重疊，沒有像Lasso那樣直接只留下其中一欄。](figure:l23202-ridge-regression-coefficient-path)

## 定義與公式

沿用指引的總平方誤差記法：

$$
L=\sum_{i=1}^{n}(y_i-\widehat y_i)^2+\lambda\sum_{j=1}^{p}\beta_j^2,
\qquad \widehat y_i=\beta_0+\sum_{j=1}^{p}\beta_jx_{ij}
$$

$n,p$是訓練筆數與特徵數；$y_i,\widehat y_i$是目標與預測。$x_{ij}$是第$i$筆第$j$個特徵，$\beta_j$是係數，$\lambda\ge0$控制懲罰。

:::supplement[來源：scikit-learn Ridge API]
截距$\beta_0$不列入本頁懲罰。
:::

λ增大會提高大係數代價，促使整體係數收縮，過強時也會欠擬合。通用懲罰原理另見L2 正則化與 Ridge，本頁著重迴歸模型與係數比較。

:::supplement[來源：scikit-learn Ridge API；Linear Models 1.1.2]
在未加權、相同資料設定下，`Ridge(alpha=λ)`對應本頁的SSE式。Lasso的API則有除以2n的尺度，不能假定兩模型相同alpha代表相同懲罰設定。

λ大於0時，平方懲罰可以穩定共線欄位的求解。它不會讓兩欄突然變獨立，也不代表共線性從資料中消失；比較懲罰前仍要以訓練資料縮放。
:::

## 算一次（補充）

沿用六筆房屋候選式 $\widehat y=20+2a-z$。預測35、50、75、90、115、130，實際40、50、60、100、110、120，SSE=475。

係數平方和為 $2^2+(-1)^2=5$。λ=10時，目標值是 $475+10\times5=525$；同一候選式的Lasso目標是505，差別來自懲罰函數。

以下改為完整60筆訓練資料的真實擬合，係數皆對應標準化欄位。這是係數行為展示，λ並未以測試集調選。

| 模型／λ | 面積 | 面積副本 | 屋齡 |
|---|---:|---:|---:|
| Lasso／12 | 36.9710 | 0 | −5.6970 |
| Ridge／12 | 16.8824 | 16.8824 | −5.2970 |
| Lasso／1200 | 28.0977 | 0 | 0 |
| Ridge／1200 | 1.7271 | 1.7271 | −0.5565 |

表中的λ都按各自SSE版目標定義，但L1與L2的單位、幾何不同，不把同一λ解讀為同樣的收縮程度。Ridge通常只縮小係數，無法直接精簡要蒐集的欄位。

能源目標放大3倍加100時，相同Ridge λ會使斜率變為3倍，截距作相應調整。這與Lasso須同步改變λ的情況不同，原因是平方誤差與平方懲罰同樣放大9倍。

## 程式（補充）

先重建共用80筆資料；固定訓練60筆，且縮放器只看訓練列。

```python
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

i = np.arange(80)
a, z, v = (10+7*i%51).astype(float), (5+3*i%21).astype(float), 11*i%17-8
y = 20+2*a-z+20*(a>35)+(13*i%9-4)
h = [0,4,8,12,16,20]
a[h], z[h], y[h] = [10,20,30,40,50,60], [5,10,5,10,5,10], [40,50,60,100,110,120]
X = np.column_stack([a,a,z,v]); tr = i[i%4!=3]
Z = StandardScaler().fit_transform(X[tr])
print("訓練形狀", Z.shape)
```
```text
訓練形狀 (60, 4)
```

```python
for lam in [12, 120, 1200]:
    m = Ridge(alpha=lam).fit(Z, y[tr])
    print(lam, m.coef_.round(4).tolist())
```
```text
12 [16.8824, 16.8824, -5.297, -1.1818]
120 [9.3892, 9.3892, -2.9974, -0.6566]
1200 [1.7271, 1.7271, -0.5565, -0.1209]
```

:::tip[讀碼重點]
係數順序為面積、副本、屋齡、無關欄。前兩欄完全相同且受相同懲罰，所以分到相同係數；標準化係數不能直接解讀成每坪房價。
:::

## 怎麼用、怎麼判讀

指引把共線、高維、希望降低過擬合列為適用條件；如果預測精度比單次係數的簡單解釋更重要，也可以比較Ridge。

λ要透過交叉驗證或驗證集選擇，不能一次猜定。對明顯非線性資料，只對原始特徵加平方懲罰，不會自動產生非線性能力。

### 換個場景

| 場景／資料條件 | 使用方式 | 主要限制 |
|---|---|---|
| 多重共線性 | 收縮相關欄位的係數 | 不等於解除資料相關 |
| 特徵多於樣本 | 以懲罰限制係數 | 仍需驗證強度 |
| 希望避免過擬合 | 比較不同λ的驗證誤差 | 不能直接選特徵 |
| 房價重複欄（補充） | 保留相關面積訊號作基準 | 不宜各自解釋為因果 |
| 工廠能源（補充） | 合併多個同步變動的感測訊號 | 部署仍須蒐集全部保留欄 |

## 常見誤解

- **Ridge一定把係數變為0。** 一般會收縮而非產生稀疏，直接選欄通常比較Lasso。
- **Ridge保證每個係數絕對值都單調下降。** 有相關欄位時個別路徑可能轉折，應看整體收縮與驗證表現。（補充）
- **處理共線性就代表特徵不再相關。** 懲罰穩定的是估計，資料本身的關係仍在。（補充）

## 進階

### 指引假設的界線

指引4-16同時列出「無多重共線性」假設與「適用於多重共線性」場景。

:::supplement[來源：scikit-learn Linear Models 1.1.2]
共線會妨礙個別係數的原始解釋，但Ridge正是可用的穩定化方法；不需先消除所有共線才可使用。
:::

### 參考來源

- 科目3指引`guide-3:4-15`～`guide-3:4-17`：目標式、收縮、共線與高維場景、無法直接選欄。
- [Ridge API](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)：alpha定義與程式。
- [Linear Models 1.1.2](https://scikit-learn.org/stable/modules/linear_model.html)：共線性穩定化與Lasso比較。
- [Ridge路徑教學](https://scikit-learn.org/stable/auto_examples/linear_model/plot_ridge_path.html)：以路徑檢視不同強度的教學思路。

## 小結

- Ridge用係數平方和限制大係數，適合比較共線與高維問題。
- λ太強也會欠擬合，需用驗證資料選擇。
- Ridge通常保留非零係數，無法直接完成特徵篩選。
- 共線性沒有從資料消失；係數仍需連同尺度與相關性解讀。（補充）
