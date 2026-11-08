---
id: k-means
title: K-means 分群
kind: model
codes:
  - L23202
  - L21301
aliases:
  - K 均值
  - K-means Clustering
summary: K-means 把相近的資料分成 K 群，反覆調整各群中心
requires: [unsupervised-learning]
guide_refs:
  - guide-1:5-9
  - guide-1:5-10
  - guide-3:4-41
  - guide-3:4-42
goals:
  - id: g1
    text: 執行兩輪中心分派與更新，計算平方距離目標
  - id: g2
    text: 依初值、離群值與群形限制判斷 K-means 是否適用
formula_groups:
  - id: kmeans-objective
    source: https://scikit-learn.org/stable/modules/clustering.html#k-means
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 六個一維座標為 0、2、3、8、10、12，初始中心為 0、3。先分派再更新一次，中心為何？
    options:
      A: 中心 1 與 9；先按排序切成等量兩群
      B: 中心 0 與 7；各群取目前成員的平均
      C: 中心 0 與 3；每輪都使用原始起始點
      D: 中心 2 與 8；各群改用成員的中位數
    answer: B
    explain:
      A: K-means 不要求每群相同筆數。
      B: 第一輪只有 0 靠近中心 0；其餘五點平均為 7。
      C: 更新步驟要重新算平均。
      D: 中位數不是平方距離目標所需的質心。
  - id: c2
    goal: g2
    type: choice
    prompt: 零售資料有兩個彎月群與 8 個遠離點，以 K=2 執行 K-means。哪種判讀合理？
    options:
      A: 群數設為 2，模型便能自動排除遠離點
      B: 起始值試 20 次，就必定找到全域最佳
      C: 模型已收斂，就已證明兩個客群真實
      D: 中心受遠點拉動，彎月也可能被切開
    answer: D
    explain:
      A: 一般 K-means 仍會分派遠點。
      B: 多次起始沒有全域最佳保證。
      C: 收斂不證明業務群組成立。
      D: 平方距離與最近中心區域不適合彎月連通群。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

網店記下顧客的購買頻次、金額與退貨率。但沒有標籤（每筆資料所屬客群的正確答案）可供學習。K-means 分群（K-means Clustering）把相近資料分在同群。

每群用一個中心代表，中心就是成員各項數值的平均。同群資料彼此靠近時，適合先用這個方法探索客群。

## 直覺

這個中心稱為質心（centroid）。K-means 依下列步驟分群：

1. 先決定要分幾群（K）。
2. 挑 K 個起始中心。
3. 把每筆資料歸到最近的中心。
4. 把每群中心移到成員的平均位置。
5. 重複第 3、4 步，直到中心幾乎不動或達到設定的重複次數上限。

每輪移動的是中心，資料點本身不動。

![用下方「算一次」的 6 個點，逐列看中心怎麼移動，直到沒有點換群。](figure:l23202-k-means-steps)

上圖每一列是同一條數線。點的位置從頭到尾都一樣，只有菱形的中心在移動。

## 定義與公式

K 是事前指定的群數。分派時計算點到各中心的距離，更新時取群內平均；初始中心不同，可能得到不同結果。

一種初始化方式是從資料中隨機選 K 個點作為質心。

### 最小化群內平方距離（補充）

$$
J=\sum_{k=1}^{K}\sum_{i\in C_k}\lVert x_i-\mu_k\rVert^2,
\qquad \mu_k=\frac{1}{|C_k|}\sum_{i\in C_k}x_i
$$

$x_i$ 是第 i 筆特徵向量，$C_k$ 是第 k 群成員集合，$\mu_k$ 是該群質心，$|C_k|$ 是群內筆數。這裡使用歐氏距離，且每群非空、每筆等權重。

$J$ 是所有群的群內平方距離總和，也是這裡要最小化的目標。

本頁六點最後分成 {0,2,3} 與 {8,10,12}，中心為 5/3 與 10。平方距離和是 14/3＋8＝38/3，約 12.667；不是先取每群距離平均再相加。

## 算一次

### 六點做兩輪（補充）

共用 JSON 的 kmeans_small 存 0、2、3、8、10、12。它是可手算的教學切片，不與 120 筆弧形資料混算。

| 階段 | 群 1 | 群 2 | 更新中心 |
|---|---|---|---|
| 初始 | 尚未分派 | 尚未分派 | 0；3 |
| 第一輪 | 0 | 2、3、8、10、12 | 0；7 |
| 第二輪 | 0、2、3 | 8、10、12 | 5/3；10 |
| 再次分派 | 0、2、3 | 8、10、12 | 不再改變 |

第一輪的點 2 距兩個中心為 2 與 1，故歸群 2。更新後它距中心 0 與 7 為 2 與 5，下一輪轉到群 1；先分派，才用新成員算平均。

### 尺度與遠點（補充）

若把群 2 的 12 改成 120，固定其餘成員，平均由 10 變成 46。平方距離讓極端點有很大影響；重新分群後連成員也可能改變。

原始零售金額以元儲存，數值為數千；頻次指標只有數十。直接混算歐氏距離會偏向大尺度欄位；特徵縮放要依業務意義選擇，並記錄尺度版本。

## 程式

### 核對手算與弧形群（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.cluster import KMeans
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["kmeans_small"]["x"], dtype=float)[:, None]
centers = np.array([[0.0], [3.0]])
for turn in range(2):
    labels = ((x - centers.T) ** 2).argmin(axis=1)
    centers = np.array([x[labels == k].mean(axis=0) for k in range(2)])
    print(turn + 1, labels.tolist(), centers.ravel().round(3).tolist())
uv = np.array(data["domains"]["retail"]["teaching_uv"])
model = KMeans(n_clusters=2, n_init=10, random_state=42).fit(uv)
print("弧形群筆數", np.bincount(model.labels_).tolist())
```
```text
1 [0, 1, 1, 1, 1, 1] [0.0, 7.0]
2 [0, 0, 0, 1, 1, 1] [1.667, 10.0]
弧形群筆數 [62, 58]
```

:::tip[讀碼重點]
先完成分派，平均才使用新標籤。n_init=10 是十次起始，不是十輪迭代，也沒有全域最佳保證。
:::

## 怎麼用、怎麼判讀

群內緊密、可先指定群數時，可考慮 K-means。彎月等非凸群、尺度差很大或離群值很多時，要先檢查距離定義，再比較 DBSCAN 密度分群或階層式分群。

![同一批彎月資料：K-means 用一條直線切開彎月，遠離的點也被分進某一群；DBSCAN 沿著點密的地方連成群，遠離的點標成雜訊。](figure:l23202-k-means-shape)

:::supplement[來源：本站 L23202-C 教學合成資料]
這是 120 筆零售教學資料，兩軸已換算成相近尺度。K-means 設 2 群，分成 62 筆與 58 筆。DBSCAN 的半徑 eps 設 0.24，圓內至少 4 個點才算密集，結果是兩群各 56 筆，加上 8 個雜訊。群的顏色只是編號，不代表客群好壞。
:::

計算與實作相對簡單，處理大量數值資料時通常有效率，適合先建立分群基準。

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 顧客分群，購買／網站行為 | 找行銷與推薦候選群 | 科1 5-10；群名須另做業務查核 |
| 結構明確的數值群集 | 以質心概括群內資料 | 科1 5-9；先給 K，注意初值與異常值 |
| 設備運轉模式（補充） | 比較不同負載群 | 溫度與振動先處理尺度 |
| 交通站點需求（補充） | 分組日需求型態 | 地理接近不代表需求相似 |

## 常見誤解

- 收斂就有全域最佳解：只代表本次更新停止，初值仍可能導向不同局部解。（補充）
- K=2 一定找回兩個彎月：中心分派形成凸的距離區域，不能沿彎月自由延伸。
- K 越大就越好：群內平方和通常下降，卻可能只把樣本切得更碎。（補充）

## 進階

### 參考來源

- guide-1:5-9、guide-1:5-10；guide-3:4-41、guide-3:4-42：流程、適用條件與場景。
- [scikit-learn K-means](https://scikit-learn.org/stable/modules/clustering.html#k-means)：平方距離目標與局部解。
- [KMeans API](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html)：程式參數。
- [分群比較教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_cluster_comparison.html)：弧形反例的設計思路。

## 小結

- 先指定 K，再反覆分派最近中心與更新平均。
- 質心與平方距離使離群值、尺度和初值都重要。
- 比較分群時固定資料與距離；群編號本身沒有業務語意。
