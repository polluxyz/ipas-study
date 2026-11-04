---
id: dbscan
title: DBSCAN 密度分群
kind: model
codes:
  - L23202
  - L21301
aliases:
  - Eps
  - MinPts
  - 密度分群
summary: DBSCAN 以核心點的鄰域擴張連成群，並標出未歸群的雜訊
requires: [unsupervised-learning]
guide_refs:
  - guide-1:5-9
  - guide-1:5-10
  - guide-3:4-43
  - guide-3:4-44
goals:
  - id: g1
    text: 說明密度連通、免指定群數與非凸群用途
  - id: g2
    text: 依含自身的鄰域計數判斷核心、邊界、雜訊
  - id: g3
    text: 辨認密度不均、尺度與高維資料的限制
formula_groups:
  - id: eps-neighborhood
    source: https://cdn.aaai.org/KDD/1996/KDD96-037.pdf#page=2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 120 筆零售資料形成彎月，另有 8 個稀疏遠點。選 DBSCAN 的主要理由是什麼？
    options:
      A: 先指定兩群，再強制把每筆資料分派進群
      B: 以群內平均作中心，再最小化平方距離和
      C: 設定半徑與點數後，沿核心鄰域連通成群
      D: 按真實客群標籤訓練，再預測遠點的類別
    answer: C
    explain:
      A: DBSCAN 不先給群數，且可留下雜訊。
      B: 這是 K-means 的中心思路。
      C: 密度連通可沿非凸群擴張。
      D: 分群擬合不使用真實客群標籤。
  - id: c2
    goal: g2
    type: choice
    prompt: 一維點為 0、0.1、0.2、0.3、0.6、2；eps=0.31、MinPts=4 且含自身。0.6 是哪類點？
    options:
      A: 邊界點：自身鄰域僅 2 點，但鄰近核心點 0.3
      B: 核心點：自身鄰域僅 2 點，但屬於含 5 點群集
      C: 雜訊點：自身鄰域僅 2 點，不能成為任何群成員
      D: 核心點：到 0.3 的距離 0.3，所以滿足點數門檻
    answer: A
    explain:
      A: 0.6 與 0.3 相距 0.3，可由核心點納入。
      B: 群總筆數不等於自身鄰域筆數。
      C: 非核心也可能是邊界成員。
      D: 半徑條件不能代替 MinPts。
  - id: c3
    goal: g3
    type: choice
    prompt: 甲群內典型間距 0.05，乙群內間距 0.8，中間還有稀疏橋接點。單一 eps 可能有何限制？
    options:
      A: 小半徑一定保留乙群，大半徑一定排除橋接點
      B: 只要 MinPts 設為 4，就可自動適應兩群密度
      C: 增加十個無關欄位，就能穩定改善密度判斷
      D: 小半徑可能漏掉乙群，大半徑可能連起兩群
    answer: D
    explain:
      A: 小半徑會更難納入稀疏群。
      B: 單一全域門檻不能保證適應不同密度。
      C: 無關維度可能使距離更難判讀。
      D: 密度差異讓同一半徑難以兼顧。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

兩個彎月形客群並不各自圍住一個中心，還有少數遠離樣本。DBSCAN 沿密集區域找群，可留下雜訊，不必先指定群數。

英文全名為 Density-Based Spatial Clustering of Applications with Noise，名稱中的 Noise 指雜訊。

## 直覺

用固定半徑畫圓，圓裡夠多點，就能從這個核心點向外擴張。只靠近核心、自己周圍卻不夠密的點可加入群，但不能繼續當擴張起點。

![丁的半徑內含戊；戊只有兩個鄰域成員，因此是邊界點而非核心。](figure:l23202-dbscan-neighborhood)

圖中距離以工程座標計；四個藍點是核心，戊是邊界，己是雜訊。弧形群的整體結果見 K-means 分群的同資料比較圖。

## 定義與公式

兩個關鍵參數是鄰域半徑 Eps（epsilon）與最少點數 MinPts（minimum points）。

:::supplement[來源：scikit-learn DBSCAN API]
本頁對應 eps、min_samples；鄰域包含自身，距離等於半徑也納入。這個約定會直接影響核心點判斷。
:::

### 鄰域如何計數（補充）

$$
N_\varepsilon(x_i)=\{x_j:d(x_i,x_j)\leq\varepsilon\},
\qquad |N_\varepsilon(x_i)|\geq m
$$

$x_i$ 是被查詢點，$x_j$ 是資料中的點，$d$ 為歐氏距離，$\varepsilon$ 為非負半徑，$m$ 是 MinPts。右式成立才是核心點；自身距離為 0，也算一筆。

代入本例丁的位置 0.3，半徑 0.31 內有 0、0.1、0.2、0.3、0.6，共五點。5≥4，所以丁是核心；戊在 0.6，只有丁與自身兩點，2<4，不是核心。

### 三種角色

- 核心點：自己的鄰域點數達門檻，可以向外擴張。
- 邊界點：自己不夠密，但落在某個核心點的鄰域內，可歸入群。
- 雜訊點：最後仍不屬於任何群；剛被掃到時暫列雜訊的點，後續可能被核心點納入。

### 密度可達與密度連通（補充）

固定半徑與 MinPts，從核心點出發，沿核心鄰域接力能抵達的點，稱為從起點密度可達。最後一點可以是邊界；邊界不能接力，因此可達關係不一定雙向。

若兩點都能從同一個核心點密度可達，便是密度連通。群內邊界點可以密度連通，卻不必彼此密度可達；不能把同群誤寫成彼此都能接力。

## 算一次

### 六點連通與擴張（補充）

共用 JSON 的 neighborhood_small 有六個位置：甲 0、乙 0.1、丙 0.2、丁 0.3、戊 0.6、己 2。固定 eps=0.31、MinPts=4，所有點都在同一條水平線。

| 點 | 鄰域成員 | 點數 | 最終角色 |
|---|---|---:|---|
| 甲／乙／丙 | 甲乙丙丁 | 各 4 | 核心 |
| 丁 | 甲乙丙丁戊 | 5 | 核心 |
| 戊 | 丁戊 | 2 | 邊界 |
| 己 | 己 | 1 | 雜訊 |

從甲建立一群，將乙、丙、丁加入待擴張集合。處理丁時納入戊；戊不夠密，只加入成員、不再擴張。己不在任何核心鄰域中，最終保持雜訊。

## 程式

### 小鄰域與大弧形共用距離慣例（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["neighborhood_small"]["xy"])
near = NearestNeighbors(radius=0.31, algorithm="brute").fit(x)
print("含自身", [len(v) for v in near.radius_neighbors(x, return_distance=False)])
m = DBSCAN(eps=0.31, min_samples=4).fit(x)
print("核心索引", m.core_sample_indices_.tolist(), "群號", m.labels_.tolist())
uv = np.array(data["domains"]["retail"]["teaching_uv"])
labels = DBSCAN(eps=0.23, min_samples=4).fit_predict(uv)
print("弧形", {int(k): int(sum(labels == k)) for k in np.unique(labels)})
```
```text
含自身 [4, 4, 4, 5, 2, 1]
核心索引 [0, 1, 2, 3] 群號 [0, 0, 0, 0, 0, -1]
弧形 {-1: 8, 0: 56, 1: 56}
```

:::tip[讀碼重點]
查詢時明確傳入 x，鄰域包含自身；若使用其他省略查詢資料的 API，須另查是否排除自身。群號 −1 是雜訊，不是第二群。
:::

## 怎麼用、怎麼判讀

DBSCAN 能沿非凸群形連通，不需指定 K，卻仍須選半徑與 MinPts。參數改動可能讓一群分裂、多群連在一起，或讓許多點變成雜訊。

### 密度差異與高維

同一個全域半徑難兼顧很密與很疏的群。半徑小會漏掉稀疏群，半徑大可能跨過間隙；高維資料又可能讓距離與密度難以區別，縮放也會改變鄰域。

:::caution[注意]
科1 指引 5-9 把「密度變化明顯」列為適用條件，容易被理解成群與群密度差很多也沒問題。應依科3 4-44 的限制判讀：適合密集區與雜訊有區別，不保證處理密度差異懸殊的多群。
:::

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 含雜訊、非凸群 | 找密集連通區 | 科1 5-9、科3 4-44；注意密度不均 |
| 顧客／工業異常探索 | 提出群組與異常候選 | 科1 5-10；雜訊仍須查核原因 |
| 交通熱點（補充） | 找不規則的停留區 | 地理距離單位要與半徑一致 |
| 生態觀測（補充） | 探索棲地聚集區 | 採樣密度不均可能扭曲結果 |

## 常見誤解

- 非核心就是雜訊：鄰近核心的非核心點可以是邊界。
- 邊界點也能接力連起兩群：擴張依核心點，不能只靠邊界鏈繼續傳遞。
- 不用選 K 就不用調參：半徑與 MinPts 同樣左右結果。

## 進階

### 參考來源

- guide-1:5-9、guide-1:5-10；guide-3:4-43、guide-3:4-44：角色、流程、場景與密度限制。
- [DBSCAN API](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html)：包含自身的 min_samples 慣例。
- [DBSCAN 原論文](https://cdn.aaai.org/KDD/1996/KDD96-037.pdf)：第 3 節定義 1～4，印刷頁 227～228；支持鄰域集合式、核心門檻及可達／連通的區別。
- [scikit-learn DBSCAN](https://scikit-learn.org/stable/modules/clustering.html#dbscan)：密度連通與參數。
- [分群比較教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_cluster_comparison.html)：同資料比較群形的例子設計。

## 小結

- 先問自己的鄰域是否夠密，再問能否由核心納入。
- 邊界可歸群但不繼續擴張；雜訊是最終未歸群者。
- 單一半徑不保證適應密度差異或高維資料。
