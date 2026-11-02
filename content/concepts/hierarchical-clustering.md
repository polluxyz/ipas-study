---
id: hierarchical-clustering
title: 階層式分群
kind: model
codes:
  - L23202
  - L21301
aliases:
  - Dendrogram
  - Hierarchical Clustering
summary: 階層式分群逐層合併或分裂，以樹狀圖呈現不同粒度的群組
requires:
  - unsupervised-learning
guide_refs:
  - guide-1:5-10
  - guide-3:4-42
  - guide-3:4-43
goals:
  - id: g1
    text: 比較凝聚與分裂，依樹狀圖高度讀出群數
  - id: g2
    text: 以距離表比較 single、complete 與 average
  - id: g3
    text: 辨認逐步決策不可撤回及大型資料的成本限制
formula_groups:
  - id: linkage-distances
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.cluster.hierarchy.linkage.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 四點以平均連結得到合併高度 1、3.5、7.333。水平切在高度 3 與 5，分別有幾群？
    options:
      A: 高度 3 有 3 群；高度 5 有 2 群
      B: 高度 3 有 2 群；高度 5 有 3 群
      C: 高度 3 有 1 群；高度 5 有 2 群
      D: 高度 3 有 3 群；高度 5 有 4 群
    answer: A
    explain:
      A: 前者只完成第一次合併，後者完成兩次。
      B: 提高切線不會增加群數。
      C: 高度 3 尚未完成所有合併。
      D: 高度 5 已完成兩次合併。
  - id: c2
    goal: g2
    type: choice
    prompt: 座標 0 與 1 已合成一群，另一群只有座標 4。single、complete、average 距離依序為何？
    options:
      A: 距離依序為 4、3、3.5
      B: 距離依序為 3.5、4、3
      C: 距離依序為 3、4、3.5
      D: 距離依序為 3、3.5、4
    answer: C
    explain:
      A: 最小與最大反過來。
      B: 平均不等於 single。
      C: 跨群距離為 4 與 3，取最小、最大與平均。
      D: complete 應取最大 4。
  - id: c3
    goal: g3
    type: choice
    prompt: 對 120 筆資料建立凝聚樹後，發現第一步合併不合理。哪種處理合適？
    options:
      A: 在既有樹撤回第一步，其餘合併保持原狀
      B: 檢查尺度與連結準則，再重新建立整棵樹
      C: 把切割高度改成零，既有錯誤便自動更正
      D: 只把樹葉左右互換，第一步成員便會改變
    answer: B
    explain:
      A: 一般凝聚法不在樹內撤回。
      B: 早期決策影響後續，修改設定後須重新擬合。
      C: 切割不能修正建立樹的過程。
      D: 左右順序不改成員。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

顧客分群不一定只有一個合理群數。行銷可能先看大群，再往下細分；階層式分群把這些層次放進同一棵樹，英文名稱為 Hierarchical Clustering。

## 直覺

凝聚式（agglomerative）從每點各一群開始，每次合併最接近的兩群。分裂式（divisive）從所有點一群開始，逐步往下拆；兩者都產生群組的層級關係。

![看水平線穿過幾條分支：高度 3 是三群，高度 5 是兩群。](figure:l23202-hierarchical-clustering-tree)

:::supplement[來源：SciPy linkage]
樹狀圖（dendrogram）的合併高度表示該連結準則的群間距離。葉子左右排列可交換，橫向位置不能直接當成原始點距離。
:::

## 定義與公式

建立完整樹時不必先選 K，但要得到一組平面分群結果，仍需決定切割高度或群數。凝聚與分裂的早期決策通常不會在後續自動撤回。

### 從上往下分裂

1. 先讓所有樣本屬於同一群，作為樹的根。
2. 選取一個尚可拆分的群，依設定規則分成子群。
3. 對子群重複拆分，直到達到目標群數、每群只剩一點或其他停止條件。

:::supplement[來源：本站階層式分群教學流程]
選哪一群、如何分成子群，要依具體方法決定。分裂式不是把某次凝聚結果倒放，也不保證得到同一棵樹。
:::

### 三種連結距離（補充）

$$
\begin{aligned}
D_{\mathrm{single}}(A,B)&=\min_{i\in A,j\in B}d(x_i,x_j)\\
D_{\mathrm{complete}}(A,B)&=\max_{i\in A,j\in B}d(x_i,x_j)\\
D_{\mathrm{average}}(A,B)&=\frac{\sum_{i\in A,j\in B}d(x_i,x_j)}{|A||B|}
\end{aligned}
$$

$A,B$ 是非空且不同的群成員索引集合，$i,j$ 分別索引兩群樣本，$x_i,x_j$ 是樣本向量。

$d$ 是點對距離，$|A|,|B|$ 是兩群筆數；本例用一維歐氏距離，average 對跨群點對等權平均。

若 A 群兩點的座標為 0、1，B 群單點座標為 4，跨群距離是 4 與 3。single 取 3、complete 取 4、average 是 (4＋3)/2＝3.5。

average 是所有跨群點對距離的平均，與質心連結（centroid linkage）使用兩群質心距離的定義不同。本例兩者數值恰好相同，不能據此視為同一方法。

## 算一次

### 四點距離表（補充）

共用 JSON 的 hierarchical_small：甲、乙、丙、丁分別在 0、1、4、9。先列六個不重複點對：

| 點對 | 距離 | 點對 | 距離 |
|---|---:|---|---:|
| 甲—乙 | 1 | 乙—丙 | 3 |
| 甲—丙 | 4 | 乙—丁 | 8 |
| 甲—丁 | 9 | 丙—丁 | 5 |

三種準則第一步都合併甲乙。接著 single 在高度 3 加入丙；complete 在高度 4 加入丙；average 在高度 3.5 加入丙。

最後加入丁的高度分別為 5、9、22/3。平均連結的 22/3 來自 (9＋8＋5)/3，不是把上一步的高度 3.5 和 5 取平均。

### 從樹讀出切割結果（補充）

平均連結切在高度 3：{甲乙}、{丙}、{丁}，共三群。切在高度 5：{甲乙丙}、{丁}，共兩群；切線不穿過合併節點，避免等號約定的歧義。

## 程式

### 用相同距離核對三種準則（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["hierarchical_small"]["x"])[:, None]
for method in ["single", "complete", "average"]:
    z = linkage(x, method=method, metric="euclidean")
    print(method, z[:, 2].round(3).tolist())
z = linkage(x, method="average")
for height in [3, 5]:
    labels = fcluster(z, height, criterion="distance")
    print("高度", height, "群數", len(set(labels)))
```
```text
single [1.0, 3.0, 5.0]
complete [1.0, 4.0, 9.0]
average [1.0, 3.5, 7.333]
高度 3 群數 3
高度 5 群數 2
```

:::tip[讀碼重點]
linkage 的第三欄是合併高度；fcluster 只是切同一棵樹，不會重算距離或撤回合併。
:::

## 怎麼用、怎麼判讀

想探索層級、群數尚未決定時，樹狀圖能保留多種粒度。資料很多時，距離計算與儲存可能成為負擔；不先給 K，仍有設定與切割的選擇成本。

:::supplement[來源：scikit-learn Clustering；SciPy linkage]
single 容易沿一串近點形成長鏈；complete 較在意最遠成員；average 使用跨群平均距離。準則沒有普遍贏家，要對照資料形狀與用途。

SciPy 的 single、complete、average 實作採平方級時間與記憶體。這是具體實作的條件，不能推廣成所有階層方法的固定成本；可接著讀近鄰搜尋與距離索引的全配對計數。
:::

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 探索資料層級 | 同時看粗群與細群 | 科1 5-10；要交代切割高度 |
| 顧客分群 | 分層規劃行銷 | 科1 5-10；非監督式應用總例 |
| 設備負載族群（補充） | 先分機種再比較模式 | 誤合併不會在樹內自動修復 |
| 生物樣本探索（補充） | 看表現型的相似層次 | 相似樹不直接證明演化因果 |

## 常見誤解

- 不指定 K 就不用決定群數：完整樹包含多種切法，使用時仍要選粒度。
- 葉子排得近就是原始距離近：應讀合併高度與準則。（補充）
- 後來發現錯誤會自動拆回：一般凝聚流程保留先前合併。

## 進階

### 參考來源

- guide-1:5-10；guide-3:4-42、guide-3:4-43：雙方向流程、樹狀圖及限制。
- [SciPy linkage](https://docs.scipy.org/doc/scipy/reference/generated/scipy.cluster.hierarchy.linkage.html)：三種公式、矩陣欄位與成本。
- [scikit-learn 階層式分群](https://scikit-learn.org/stable/modules/clustering.html#hierarchical-clustering)：連結準則與讀圖。
- [分群比較教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_cluster_comparison.html)：不同群形的比較思路。

## 小結

- 凝聚往上合併，分裂往下細分。
- 樹高必須搭配連結準則解釋，葉子順序不代表距離。
- 切割可改粒度，不能修正已執行的合併決策。
