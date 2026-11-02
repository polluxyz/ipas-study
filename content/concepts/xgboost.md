---
id: "xgboost"
title: "XGBoost"
kind: "model"
codes: ["L23202"]
aliases: ["eXtreme Gradient Boosting"]
requires: ["gradient-boosted-trees"]
guide_refs: ["guide-3:4-22", "guide-3:4-23", "guide-3:4-24", "guide-3:4-25", "guide-3:4-40"]
summary: "在梯度提升中結合二階資訊、樹複雜度控制與學得的缺值路徑"
goals:
  - id: "g1"
    text: "辨識目標式、二階資訊、正則化與缺值路徑，並限定生長及並行設定"
  - id: "g2"
    text: "比較二元、多類別輸出與LightGBM的設定及泛化取捨"
is_a: ["gradient-boosted-trees"]
formula_groups:
  - id: "second-order"
    source: "https://xgboost.readthedocs.io/en/stable/tutorials/model.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK-W-L23202-E"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "新葉的梯度和4、Hessian和3；忽略L1，L2係數1。最佳葉權重依−G/(H+λ)為何？"
    options:
      A: "1；以梯度和4除以Hessian和加懲罰4"
      B: "−1.333；負梯度和−4只除以Hessian和3"
      C: "−1；負梯度和−4除以Hessian和加懲罰4"
      D: "−4；只取負梯度和，不使用Hessian與懲罰"
    answer: "C"
    explain:
      A: "漏了負號；梯度和為正時，葉值應為負。"
      B: "忽略指定的L2係數會得到不同權重。"
      C: "−4/(3+1)=−1，正梯度和對應負葉值。"
      D: "二階資訊與L2都參與這個葉值。"
  - id: "c2"
    goal: "g1"
    type: "choice"
    prompt: "樹節點以收入70分支，訓練時學得缺值走右。新個案收入缺漏，哪個理解正確？"
    options:
      A: "依該節點學得路徑走右，但仍須檢查缺漏原因"
      B: "自動將收入視為70，並保證對所有群體公平"
      C: "必須走左，因為所有缺值都代表數值比較小"
      D: "可由其他欄位還原收入，且一定回到真實值"
    answer: "A"
    explain:
      A: "預設方向由訓練學得，不能取代資料品質與治理檢查。"
      B: "缺值分支不是數值補成70，也不保證公平。"
      C: "不同節點學得方向可能不同。"
      D: "樹的路徑選擇不等於還原真實收入。"
  - id: "c3"
    goal: "g2"
    type: "choice"
    prompt: "3類授信風險、每筆要3個類別機率；團隊也要改用葉優先生長。哪組XGBoost設定合理？"
    options:
      A: "binary:logistic配3類；exact配lossguide即可"
      B: "multi:softmax配3類；不用區分類別與機率"
      C: "reg:squarederror配3類；輸出自然會總和為一"
      D: "multi:softprob及num_class=3；hist配lossguide"
    answer: "D"
    explain:
      A: "二元目標不符合3類，而且lossguide依樹方法支援。"
      B: "softmax目標輸出類別，不是所需的每類機率。"
      C: "平方誤差迴歸不會自動變成多類別機率。"
      D: "softprob提供機率向量，hist支援lossguide設定。"
textbook: "v2"
author: "codex"
status: "draft"
---

## 為什麼需要

傳統梯度提升逐輪加樹，但大型資料還有分裂搜尋、記憶體與過擬合問題。XGBoost（eXtreme Gradient Boosting）同時改良最佳化與工程效率，仍保留逐輪修正的核心。

## 直覺

新樹除了問「能修正多少」，也要問「多長一棵複雜樹是否值得」。二階資訊描述損失曲率，正則化則限制樹與葉值的複雜度。

![模型同時考量擬合改善與樹複雜度；缺值沿訓練學得的預設分支前進，不是固定補零。](figure:l23202-xgboost-objective-missing)

## 定義與公式

指引強調二階導數資訊、L1／L2正則化、稀疏資料及缺值路徑。以下把這些角色寫成一輪的目標式；展開與葉值推導屬補充。

### 一輪目標與葉權重（補充）

對損失作二階Taylor近似，再略去與新樹無關的常數；以下形式不含L1：

$$
\widetilde{\mathcal L}^{(t)}=
\sum_i\left[g_i f_t(x_i)+\tfrac12 h_i f_t(x_i)^2\right]
+\gamma T+\tfrac12\lambda\sum_{j=1}^{T}w_j^2
$$

$f_t$是本輪新樹，$g_i$、$h_i$是損失對既有分數的一階、二階導數。$T$是葉數，$w_j$是葉值；$\gamma$懲罰增加葉數，$\lambda$抑制葉值大小。

固定樹結構、葉內Hessian和加$\lambda$為正時，葉$j$的最佳權重為：

$$
w_j^*=-\frac{G_j}{H_j+\lambda},\qquad
G_j=\sum_{i\in j}g_i,\quad H_j=\sum_{i\in j}h_i
$$

$G_j$與$H_j$分別是該葉的梯度和、Hessian和。葉內梯度−2、−1，Hessian各1，$\lambda=1$時，$w_j^*=3/(2+1)=1$。

兩葉值1與−1，$\gamma=0.2$、$\lambda=1$時，複雜度項為$0.2\times2+(1+1)/2=1.4$。總目標仍須加擬合項；開啟L1會改變葉值公式。

### 生長策略的設定界線

指引以層級式生長對比LightGBM葉優先，應理解為典型設定。不是所有XGBoost設定都只會逐層生長。

指引另列Block結構與並行運算：加速的是本輪建樹的分裂搜尋，逐輪提升仍需依前輪結果計算修正方向。

:::supplement[來源：XGBoost Parameters §grow_policy；Chen與Guestrin §4.1]
原論文的欄區塊設計把各特徵值預先排序並保存，供後續輪次重用；同一輪能分工搜尋不同欄位的切分。實際計算方法仍依`tree_method`與硬體設定。

`grow_policy=depthwise`優先處理靠近根的節點；`lossguide`優先處理損失改善最大的葉。後者須配合支援的`tree_method`，例如`hist`或`approx`。

同一層節點也可能因增益不足或限制而不分裂，不能說「所有葉一定同時分裂」。可並行的分裂搜尋，不表示下一輪新樹能完全不看前輪結果。
:::

## 走一次流程

### 缺值路徑

樹模型從訓練資料學得缺值走向。新個案的收入缺漏時，不必先補零，而是沿目前節點保留的預設方向前進。

:::supplement[來源：XGBoost FAQ §How to deal with missing values]
例如收入閾值70的節點，訓練時比較缺漏個案送左、送右的改善，再保留較好方向。若學得走右，推論時就走右；其他節點可能走左。此行為不能直接套到`gblinear`。
:::

### 共用三模型比較（補充）

房價與授信各100筆，全部模型共用60／20／20索引與種子23202。每模型只用3棵或3輪、最大深度2，是便於追蹤的教學設定，不是各模型最佳成績。

| 模型 | 房價驗證MSE | 授信驗證Logloss | 授信前三筆違約機率 |
|---|---|---|---|
| 隨機森林 | 462.861 | 0.160736 | 0.088889、0.666667、0 |
| XGBoost | 311.302 | 0.309813 | 0.114251、0.715132、0.114251 |
| LightGBM | 254.693 | 0.308980 | 0.100600、0.602218、0.066903 |

這份小表不能證明任一模型普遍較好；房價與授信的排序已不同。保留測試20筆未用來調參；缺值版另行訓練，結果不混入這張完整資料表。

## 程式（補充）

重建相同授信資料，在負債比與收入的固定位置加入缺值。完整與缺值版本分別訓練，不能把兩份輸出當成相同模型的一次預測。

```python
import numpy as np
from xgboost import XGBClassifier
i = np.arange(100)
u, d, a = 30+i*11 % 91, (i*7 % 61)/100, 22+i*3 % 40
X = np.column_stack([u, d, a]).astype(float)
y = ((d>.35) & (u<90) | (u<45)).astype(int)
tr, va = i[i % 5 < 3], i[i % 5 == 3]
for missing in [False, True]:
    Z = X.copy()
    if missing:
        Z[i % 13 == 0, 1], Z[i % 17 == 0, 0] = np.nan, np.nan
    m = XGBClassifier(n_estimators=3, max_depth=2, learning_rate=.5,
        base_score=.5, tree_method="hist", grow_policy="depthwise",
        reg_lambda=1, random_state=23202, n_jobs=1).fit(Z[tr], y[tr])
    print("缺值版", missing, [round(float(p), 6) for p in m.predict_proba(Z[va[:3]])[:, 1]])
```
```text
缺值版 False [0.114251, 0.715132, 0.114251]
缺值版 True [0.113846, 0.668604, 0.496141]
```

:::tip[讀碼重點]
`NaN`保留給樹學缺值方向，沒有先補零。`reg_lambda`控制L2，與`learning_rate`縮小新樹的作用不同；XGBoost 3.4.1實測，末位可能隨版本與浮點運算改變。
:::

## 怎麼用、怎麼判讀

大型、高維與稀疏的表格資料，可比較XGBoost與LightGBM。兩者都能輸出二元或多類別結果，也都需要控制樹複雜度與驗證泛化。

樹的預測是分段常數；特徵跨過切點時，連續目標的預測可能跳動。需要平滑價格曲線時，應另檢查這種輸出形狀是否適合。

:::supplement[來源：XGBoost Parameters §Learning Task Parameters；LightGBM Parameters §objective]
| 任務 | XGBoost設定 | LightGBM設定 | 輸出意義 |
|---|---|---|---|
| 二元分類 | `binary:logistic` | `binary` | 一個正類機率；介面可回兩欄 |
| K類機率 | `multi:softprob`、`num_class=K` | `multiclass`、`num_class=K` | 每筆K個機率 |
| K類硬標籤 | `multi:softmax`、`num_class=K` | 由機率取最大類 | 類別，不是完整機率向量 |

二元通常用Sigmoid，多類別才常用Softmax。不能因指引統稱Softmax，就把任何分類輸出都解讀成同一種轉換。
:::

### 換個場景

| 場景／資料條件 | 用途 | 判讀重點 |
|---|---|---|
| 金融、電商、醫療 | 分類或迴歸 | 依任務選目標與輸出 |
| 大型、高維、稀疏資料 | 加速建模 | 比較記憶體、訓練及推論延遲 |
| 房價（補充） | 平方誤差迴歸 | 驗證誤差與分段輸出 |
| 能源（補充） | 用電尖峰預測 | 缺漏機制改變仍須監控 |

## 常見誤解

- 二階資訊不保證每次都比所有其他模型更快或更準。
- 內建正則化仍需調參，不會免除過擬合。
- XGBoost可依設定葉優先生長，也能採直方圖方法。（補充）
- 缺值能推論，不代表已知道缺漏真因或自動滿足公平性。（補充）

## 進階

### 參考來源

- 科目3指引（2025-12檔案版），`guide-3:4-22`～`guide-3:4-25`、`guide-3:4-40`：二階資訊、正則化、缺值與分類；生長及Softmax用語須限定。
- [XGBoost模型教學](https://xgboost.readthedocs.io/en/stable/tutorials/model.html)：支持二階目標與不含L1的葉值公式，參考從損失與複雜度解釋模型的順序。
- [Chen與Guestrin原論文](https://arxiv.org/abs/1603.02754)：支持稀疏處理與系統效率的設計背景。
- [XGBoost Parameters](https://xgboost.readthedocs.io/en/stable/parameter.html)：支持生長策略、樹方法、目標與正則化設定。
- [XGBoost FAQ](https://xgboost.readthedocs.io/en/stable/faq.html)：支持缺值分支及不同booster的界線。
- [Python Package Introduction](https://xgboost.readthedocs.io/en/stable/python/python_intro.html)：支持API、資料及預測流程。
- [LightGBM Parameters](https://lightgbm.readthedocs.io/en/stable/Parameters.html)：支持分類目標與跨實作輸出比較。

## 小結

- 二階資訊描述本輪損失，正則化約束樹與葉值。
- 缺值路徑由訓練學得，不等於固定補零。
- 生長策略與並行範圍須看實際設定。（補充）
- 二元與多類別須使用相應目標與機率轉換。（補充）
