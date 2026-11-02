---
id: neighbor-search-index
title: 近鄰搜尋與距離索引
kind: technique
codes:
  - L21301
  - L23201
  - L23202
aliases:
  - Ball Tree
  - DBSCAN 鄰域搜尋與距離索引
  - KD-Tree
  - Time Complexity
  - dbscan-neighbor-index
  - time-complexity
  - 時間複雜度
  - 近鄰索引
summary: 近鄰索引以區域剪枝減少查詢，成本仍受維度與輸出數量限制
requires: []
guide_refs:
  - guide-3:4-43
  - guide-3:4-44
goals:
  - id: g1
    text: 比較直接查詢、KD-Tree 與 Ball Tree 的流程與成本
  - id: g2
    text: 核對索引查詢同結果，辨認高維與記憶體限制
  - id: g3
    text: 列舉全配對次數，推得固定維度下的平方級成長
formula_groups:
  - id: pair-counts
    source: https://docs.python.org/3/library/itertools.html#itertools.combinations
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 對同一份 120×3 特徵反覆做半徑查詢，距離與半徑不變。索引主要如何省工作？
    options:
      A: 把半徑改小，讓傳回的鄰居數量減少
      B: 先排除距離下界超過半徑的整個區域
      C: 略過所有遠點，完全不用核對距離值
      D: 將群數改成 2，使點對距離不必計算
    answer: B
    explain:
      A: 改半徑改變問題，不是同查詢加速。
      B: 安全剪枝不改查詢的定義。
      C: 邊界候選仍需核對距離。
      D: 群數不是半徑查詢參數。
  - id: c2
    goal: g2
    type: choice
    prompt: 同資料由 3 欄增加成 100 個多半無關的欄位，KD-Tree 查詢反而變慢。哪種解釋合理？
    options:
      A: 樹已建立，因此查詢時間必定低於直接掃描
      B: 結果相同，因此兩法的計算量也必定相同
      C: 每多一維，樹的剪枝效果就必定加強一倍
      D: 高維下許多區域都要訪問，另有索引額外成本
    answer: D
    explain:
      A: 建樹不保證查詢較快。
      B: 結果相同只核對正確性。
      C: 高維通常更難有效剪枝。
      D: 可能接近全面掃描，還有節點管理成本。
  - id: c3
    goal: g3
    type: choice
    prompt: 固定維度下，n=8 與 n=16 都要輸出所有不含自身、對稱去重的點對。筆數與成長為何？
    options:
      A: 28 與 120 對，精確比值 30/7，漸近為四倍
      B: 56 與 240 對，精確比值 30/7，漸近為四倍
      C: 28 與 120 對，精確比值為 4，始終保持四倍
      D: 64 與 256 對，精確比值為 4，已排除了自身
    answer: A
    explain:
      A: 各為 n(n−1)/2；有限 n 比值不必剛好是四。
      B: 這是仍保留兩個方向的點對數。
      C: 120/28 是 30/7，不是 4。
      D: n² 含自身且保留兩個方向。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

DBSCAN 要反覆問「這點半徑內有哪些點」。近鄰搜尋（nearest-neighbor search）若每次都掃全部資料，量大時成本很高；距離索引能先排除不可能入選的整個區域。

本頁把半徑查詢與全配對列舉分開。兩者輸出不同，不能用一次查詢的加速宣稱所有點對都免費得到。

## 直覺

### 區域距離下界（補充）

KD-Tree 沿特徵軸分割空間；Ball Tree 以球心及半徑包住子集。若查詢點到某區域的最短可能距離已大於查詢半徑，該區內所有點都能略過。

![橘色查詢圓沒有碰到右區域，因此右區可整個跳過，仍保留完全相同的鄰居定義。](figure:l23202-neighbor-search-index-regions)

圖是剪枝示意，不是新距離規則。無法排除的區域仍需搜尋與核對；是否加速取決於資料維度、分布與查詢大小。

## 定義與公式

### 先區分查詢任務（補充）

| 任務 | 需要的輸出 | 成本重點 |
|---|---|---|
| 一次 k 近鄰 | 一點的 k 個最近樣本 | 可用區域剪枝 |
| 一次半徑查詢 | 一點半徑內的所有樣本 | 至少要列出傳回的成員 |
| 全配對距離 | 所有指定點對的距離 | 不能用索引消除輸出本身 |
| 多次重複查詢 | 多個查詢的成員清單 | 建索引成本可分攤 |

### 全配對計數（補充）

$$
N_{\mathrm{ordered}}=n(n-1),\qquad
N_{\mathrm{unique}}=\frac{n(n-1)}{2}
$$

$n$ 是樣本數。兩式都排除自身配對；第一式區分「甲到乙」與「乙到甲」，第二式只在距離對稱、每對只留一次時使用。

n=8 時，第一式是 8×7＝56，第二式為 28。若保留自身且保留方向，才是 8×8＝64；對非對稱關係不能直接除以 2。

## 算一次

### 4、8、16 筆的直接列舉（補充）

子集固定取零售資料前 n 個索引。此處只列出索引點對，不用執行時間推論數學成長率。

| n | 含自身有方向 | 不含自身有方向 | 不含自身且去重 |
|---:|---:|---:|---:|
| 4 | 16 | 12 | 6 |
| 8 | 64 | 56 | 28 |
| 16 | 256 | 240 | 120 |

由 4 加倍到 8，去重點對成長為 28/6＝14/3 倍；由 8 到 16，為 120/28＝30/7 倍。精確比值不是固定四倍，但 n 越大越接近四倍。

時間複雜度描述資料量 n 增加時，所需工作量如何成長。大 O 記號表示漸近成長的上界；此處全配對次數的主導項是平方項，稱為平方級。

固定特徵維度 d、每次距離計算成本不隨 n 增加時，全配對是平方級 $O(n^2)$。若 d 也增加，歐氏距離逐欄計算的成本還要算進去。

原因是 n(n−1)=n²−n，主導成長的項為 n²；對稱去重只改變常數 1/2，不改平方級。這個結論針對全部配對，不能直接套用到單次近鄰查詢。

### 查詢流程與成本（補充）

1. 固定特徵縮放、距離與半徑。
2. 直接法逐點計算；樹法先建索引再用距離下界剪枝。
3. 對所有候選核對距離，輸出半徑內成員。
4. 用排序後成員核對兩種做法，不以原始傳回順序判斷對錯。

直接法單次掃描約需 n 次距離計算。低維且區域可有效排除時，樹法可減少掃描；建樹仍有時間與節點記憶體，少量查詢未必划算。

## 程式

### 同一批六點核對查詢（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.neighbors import NearestNeighbors
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["neighborhood_small"]["xy"])
for algorithm in ["brute", "kd_tree", "ball_tree"]:
    m = NearestNeighbors(radius=0.31, algorithm=algorithm).fit(x)
    found = m.radius_neighbors(x[[3]], return_distance=False)[0]
    print(algorithm, sorted(found.tolist()))
```
```text
brute [0, 1, 2, 3, 4]
kd_tree [0, 1, 2, 3, 4]
ball_tree [0, 1, 2, 3, 4]
```

### 直接列出全部索引對（補充）

```python
for n in [4, 8, 16]:
    all_pairs = [(i, j) for i in range(n) for j in range(n)]
    ordered = [(i, j) for i, j in all_pairs if i != j]
    unique = [(i, j) for i, j in ordered if i < j]
    assert len(ordered) == n * (n - 1)
    assert len(unique) == n * (n - 1) // 2
    print(n, len(all_pairs), len(ordered), len(unique))
```
```text
4 16 12 6
8 64 56 28
16 256 240 120
```

:::tip[讀碼重點]
兩段各驗證一件事：索引不改鄰域答案；全配對筆數符合計數公式。六點的小查詢結果不能證明任何大型效能優勢。
:::

## 怎麼用、怎麼判讀

指引談到 DBSCAN 在高維時距離與密度難定義。樹索引能處理搜尋工作，卻不會自動修好不合適的距離度量。

### 高維退化與記憶體（補充）

例如資料由 3 維加入 97 個無關欄位：若多數區域都與查詢球重疊，樹仍要訪問大量節點，可能接近全掃描再加上樹管理成本。Ball Tree 也不保證對所有高維資料有效。

若半徑大到每點都鄰近全部樣本，輸出的鄰接關係本身就可能達平方級。即使找到它們很快，儲存密集鄰接表仍耗記憶體；索引不能免除列出所有點對的工作。

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| DBSCAN 高維鄰域 | 找密度可達成員 | 科3 4-44 提出距離限制，沒有教授特定索引 |
| 零售行為查詢（補充） | 反覆找相似顧客 | 多次查詢才容易分攤建索引成本 |
| 設備近況搜尋（補充） | 找接近既有負載的紀錄 | 量綱、半徑及特徵版本要一致 |
| 地理定位（補充） | 找附近服務點 | 索引必須支援所選地理距離 |

## 常見誤解

- 樹的單次查詢永遠是對數級：維度與分布差時會退化。（補充）
- 成員傳回順序不同就是錯：應比較集合，必要時核對距離。（補充）
- 全配對可以靠一次近鄰查詢完成：兩者輸出需求不同。（補充）

## 進階

### 參考來源

- guide-3:4-43、guide-3:4-44：鄰域任務與高維限制；KD-Tree、Ball Tree 及配對推算是補充。
- [scikit-learn Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html)：三種演算法、剪枝與高維成本。
- [SciPy spatial 教學](https://docs.scipy.org/doc/scipy/tutorial/spatial.html)：區域查詢及距離結構的教學思路。
- [Python itertools](https://docs.python.org/3/library/itertools.html#itertools.combinations)：組合／排列數，配合直接列舉核對。
- 全配對公式由明確列舉推得；不以小樣本的執行時間作複雜度證明。

## 小結

- 先固定要問哪一種近鄰問題，再談索引加速。
- KD-Tree 用軸切區域，Ball Tree 用球包住子集。
- 高維、輸出量與建索引成本都可能限制效益。
- 對稱去重且排除自身是 n(n−1)/2，固定維度下呈平方級成長。
