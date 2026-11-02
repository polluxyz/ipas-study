---
id: knn
title: K 最近鄰
kind: model
codes: [L23202, L21301]
aliases: [K-Nearest Neighbors, k-nearest-neighbors, KNN]
requires: [classification-regression, feature-scaling]
summary: K最近鄰先找離新樣本最近的K筆訓練資料，再依鄰居標籤投票
goals:
  - id: g1
    text: 依近鄰圖與投票解釋分類結果，說明資料量及查詢成本限制
  - id: g2
    text: 計算距離與不同K的預測，辨識尺度、高維與惰性學習的限制
formula_groups:
  - id: distance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.DistanceMetric.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23202-B
  - id: neighbor-vote
    source: https://www.cs.cornell.edu/courses/cs4780/2022fa/lectures/lecturenote02_kNN.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23202-B
guide_refs: [guide-1:5-9, guide-3:4-32, guide-3:4-33, guide-3:4-34]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某新客戶最近5筆鄰居依距離排序，標籤為違約、違約、未違約、未違約、未違約。採等權投票，K=3與K=5分別如何？
    options:
      A: "K=3判違約，K=5判未違約"
      B: "K=3判未違約，K=5判違約"
      C: "K=3判違約，K=5也判違約"
      D: "K=3判未違約，K=5也判未違約"
    answer: A
    explain:
      A: 前三筆正類2票、負類1票；前五筆正類2票、負類3票。
      B: 兩次都把票數較少的一類當成多數。
      C: K為5時三張未違約票超過兩張違約票。
      D: K為3時兩張違約票超過一張未違約票。
  - id: c2
    goal: g2
    type: choice
    prompt: 查詢座標為(2.45,2.75)，鄰居F038為(2,4)。歐幾里得距離約多少？
    options:
      A: "距離約1.700，將兩軸絕對差直接相加"
      B: "距離約1.765，將兩軸平方差相加即完成"
      C: "距離約1.329，將平方差相加後再開根號"
      D: "距離約0.800，將兩軸有號差相加後取絕對值"
    answer: C
    explain:
      A: 1.700是曼哈頓距離，並非本題指定的距離。
      B: 1.765是平方距離，還要開根號。
      C: 0.45平方加1.25平方為1.765，開根號約1.3285。
      D: 有號差先相加會抵消，並非歐幾里得距離。
  - id: c3
    goal: g2
    type: choice
    prompt: 製造模型原有4個感測特徵，擴成400個無關雜訊特徵後KNN表現下降。訓練資料也由90筆增為90萬筆，哪個處理方向合理？
    options:
      A: 只把K設為1，因為最小K必能消除所有無關維度的影響
      B: 檢查縮放與特徵選擇，並量測大量資料下的查詢時間
      C: 把全部特徵改成同一常數，因為距離全部相同就更準確
      D: 取消驗證只看訓練，因為惰性學習代表沒有任何計算成本
    answer: B
    explain:
      A: K為1仍受距離失真與噪聲影響，且可能更敏感。
      B: 尺度、高維與樣本量分別影響近鄰品質及推論成本。
      C: 常數化會抹除可分辨訊息，距離相同無法改善判斷。
      D: 惰性學習仍需保存資料、前處理及執行查詢，也需要驗證。
---

## 為什麼需要

有些資料不適合用一條直線切開，但相近樣本往往有相似類別。K 最近鄰（K-Nearest Neighbors，KNN）直接向附近已知樣本取票。

它把大量工作留到預測時，因此模型建構直觀，查詢成本卻可能高。指引強調小到中等資料、低維與局部結構清楚的條件。

## 直覺

新樣本先找附近K個鄰居，再選票數最多的類別。K決定要看多大的鄰里；同一個位置改K，可能改變答案。

![叉號是新客戶；K=3時違約票較多，圈到K=5時未違約票反而較多。](figure:l23202-knn-neighbors)

KNN是非參數的惰性學習：不先估一條全域分類邊界，而保留訓練樣本，等新資料到來再找鄰居。

## 定義與公式

指引列出歐幾里得、曼哈頓等距離，再用最近K筆的類別投票。距離的定義與特徵尺度，都屬於模型設定的一部分。

### 兩種距離

可以用歐幾里得或曼哈頓距離衡量遠近。兩軸若量級不相稱，距離也會偏向數值大的欄位。

:::supplement[來源：scikit-learn DistanceMetric]

$$
d_2(x,u)=\sqrt{\sum_{j=1}^{d}(x_j-u_j)^2},\qquad
d_1(x,u)=\sum_{j=1}^{d}|x_j-u_j|
$$

$x$是查詢、$u$是訓練樣本，$d$是特徵數，$x_j,u_j$是第$j$軸值。$d_2$為歐幾里得距離，$d_1$為曼哈頓距離。
:::

### 等權投票

最近K筆各投一票，票數最多的類別就是預測結果。

:::supplement[來源：Cornell CS4780 kNN講義]

$$
\widehat y=\underset{c}{\operatorname{argmax}}\sum_{i\in N_K(x)}\mathbf1(y_i=c)
$$

$N_K(x)$為最近K筆索引，$y_i$為標籤，$c$為類別。$\mathbf1$在條件成立時為1，否則為0；argmax選票最多的類別，等價於眾數（mode），不必過半。

要先訂好同距離與同票處理。二元等權的奇數K可避免兩類票數打平，但多類別即使K為奇數也可能同票。
:::

## 算一次

### 同一六筆金融資料（補充）

使用樹切分頁的同六筆，只取固定換算後的收入、負債座標。查詢$(2.45,2.75)$換回原值，是收入44.5千元、負債275千元。

F038為$(2,4)$，與查詢的兩軸差為0.45與$-1.25$。代入兩種距離公式：

$$
d_2=\sqrt{0.45^2+1.25^2}\approx1.3285,\qquad
d_1=0.45+1.25=1.70
$$

| 距離順位 | 鄰居 | 歐幾里得距離 | 標籤 |
|---|---|---|---|
| 1 | F038 | 1.3285 | 違約 |
| 2 | F028 | 1.4714 | 違約 |
| 3 | F011 | 1.8069 | 未違約 |
| 4 | F012 | 1.8344 | 未違約 |
| 5 | F010 | 2.2727 | 未違約 |
| 6 | F048 | 2.3162 | 違約 |

K=1時取最近的違約；K=3時違約2票、未違約1票，也判違約。K=5時違約2票、未違約3票，改判未違約。

這是同六筆教學子集的分類器，不是拿完整54筆訓練的KNN來做同一投票。模型比較頁則使用全部四個特徵，兩者不能混用分數。

### 尺度會換掉誰最近

若直接拿原始收入與負債數字算距離，負債的量級較大，本例最近的點改成F028。縮放會改變鄰居排序；要先決定什麼尺度具有業務意義。

![兩格分別依自己的距離排序；原始數字下最近是F028，換算座標下最近是F038。](figure:l23202-knn-scale)

:::supplement[來源：scikit-learn Nearest Neighbors；INRIA Preprocessing for numerical features]
本例使用固定工程單位換算；若改用StandardScaler，平均與標準差只從訓練集估計，驗證與新資料沿用同一組統計量。
:::

## 程式（補充）

下段重建六筆與查詢，讓距離、排序及K變化一起驗算。

```python
import numpy as np
from sklearn.neighbors import KNeighborsClassifier
X = np.array([[1, 1], [1, 3], [2, 1], [2, 4], [3, 1], [3, 5]], dtype=float)
y = np.array([0, 1, 0, 1, 0, 1])
ids = np.array(["F010", "F028", "F011", "F038", "F012", "F048"])
query = np.array([[2.45, 2.75]])
distance = np.linalg.norm(X-query, axis=1)
order = np.argsort(distance, kind="stable")
print("鄰居順序", ids[order].tolist())
print("距離", np.round(distance[order], 4).tolist())
for k in [1, 3, 5]:
    model = KNeighborsClassifier(n_neighbors=k, weights="uniform").fit(X, y)
    print("K", k, "預測", model.predict(query).tolist())
```
```text
鄰居順序 ['F038', 'F028', 'F011', 'F012', 'F010', 'F048']
距離 [1.3285, 1.4714, 1.8069, 1.8344, 2.2727, 2.3162]
K 1 預測 [1]
K 3 預測 [1]
K 5 預測 [0]
```

:::tip[讀碼重點]
`n_neighbors`是取票筆數，`weights="uniform"`才是本頁的等權票。K不能大於可用訓練筆數；選K要用驗證流程，不能靠這一筆查詢挑出喜歡的答案。
:::

## 怎麼用、怎麼判讀

K小時可能緊貼局部、容易受噪聲影響；K大時較平滑，也可能抹掉少數類或小區域。指引建議用交叉驗證選K，並提醒離群值與高維稀疏的影響。

:::supplement[來源：scikit-learn Nearest Neighbors Algorithms]
逐一比距離時，單筆查詢約需隨訓練筆數及維度成長的工作量，還要保存訓練資料。KD-tree、Ball-tree等索引可加速部分情況，但高維時不保證有效。

惰性學習不等於訓練完全零成本：前處理、儲存與建立索引仍可能耗時。高維距離也不是必然全部相等，而是近遠差異可能變得較不具辨識力。
:::

### 換個場景

| 場景或資料條件 | 適用方式 | 判讀重點 |
|---|---|---|
| 郵件、診斷、流失、金融風險 | 科目1列出的分類共用場景 | 仍需依KNN條件驗證 |
| 資料量適中、低維 | 局部鄰居投票 | 查詢成本與尺度 |
| 複雜但局部清楚的邊界 | KNN追蹤局部結構 | K太大會模糊細節 |
| 多類別分類 | 直接比較各類票數 | 奇數K仍可能同票 |
| 製造感測（補充） | 找相似運作狀態 | 感測單位與無關欄位 |
| 物流案件（補充） | 比對相似路線的延誤類型 | 避免無關欄位主導距離 |

## 常見誤解

- K越小越準，或K越大越準：兩者都有取捨，要以驗證結果判斷。
- 加很多無關特徵也無妨：距離可能被雜訊維度稀釋。
- KNN不擬合參數，所以預測不需要計算：主要成本正是在找鄰居。

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-9；科目3指引4.2，guide-3:4-32～4-34（版本未標示）：支持近鄰流程、K取捨、尺度、高維與適用條件；距離展開式為補充。
- [scikit-learn Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html)：核對距離、等權票、同距離與索引限制。
- [scikit-learn DistanceMetric](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.DistanceMetric.html)：直接列出歐幾里得與曼哈頓距離，支持「兩種距離」的展開式。
- [Cornell CS4780 k-nearest neighbors](https://www.cs.cornell.edu/courses/cs4780/2022fa/lectures/lecturenote02_kNN.html)：直接以眾數定義近鄰分類，支持「等權投票」的argmax計票寫法。
- [INRIA First model with scikit-learn](https://inria.github.io/scikit-learn-mooc/python_scripts/02_numerical_pipeline_introduction.html)：參考從訓練樣本到新樣本預測的教法。
- [INRIA Preprocessing for numerical features](https://inria.github.io/scikit-learn-mooc/python_scripts/02_numerical_pipeline_scaling.html)：支持尺度改變近鄰的說明。

## 小結

- 先算距離、取K筆，再依指定投票規則分類。
- 相同資料改K或尺度，都可能改變答案。
- 低維局部結構是優勢；大資料與高維會影響成本及近鄰品質。
