---
id: fp-growth
title: FP-Growth 頻繁項集挖掘
kind: model
codes:
  - L23202
aliases:
  - FP 樹
requires: [association-rule-metrics]
summary: 將交易壓成共用前綴的FP樹，再以條件模式基遞迴挖掘項集
goals:
  - id: g1
    text: 追蹤兩次掃描、FP樹與條件路徑，並比較Apriori的候選成本
guide_refs:
  - guide-3:4-49
  - guide-3:4-50
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 10筆交易中B有7筆、A有5筆、C有5筆、D有4筆、E有1筆，門檻2筆。哪個建樹安排正確？
    options:
      A: 保留E並排最前，因罕見項能保留所有規則
      B: 先刪E；同頻A、C固定次序，再依B、A、C、D建樹
      C: 各交易任意排序，再把所有同名節點的計數相加
      D: 把出現次數當分類標籤，訓練一棵監督式決策樹
    answer: B
    explain:
      A: E未達門檻，含E的超集也不頻繁。
      B: 先全域計數與固定排序，才能讓相同前綴合併。
      C: 各交易若順序不一致，相同前綴就無法共用；同名節點仍須保留路徑條件。
      D: FP樹儲存交易路徑，不是分類器。
  - id: c2
    goal: g1
    type: choice
    prompt: 某FP樹的C條件模式基為BA:2、B:2，另有根節點直接到C的1筆；全域門檻2。能由此得到什麼？
    options:
      A: BC為4筆、AC為2筆、ABC為2筆
      B: BC為5筆、AC為5筆、ABC為5筆
      C: BC為2筆、AC為4筆、ABC為4筆
      D: BC為4筆、AC為0筆、ABC為0筆
    answer: A
    explain:
      A: 路徑權重相加得B4、A2，且BA同現2。
      B: 根到C的交易沒有B或A，不能加入配對計數。
      C: B累計4、A累計2；選項對調了兩者，且AC與ABC都不能超過含A的2筆。
      D: BA路徑中A也出現2筆。
  - id: c3
    goal: g1
    type: choice
    prompt: 同一交易表、相同20%門檻，Apriori與FP-Growth各輸出9個項集。哪個驗證與解讀合理？
    options:
      A: 只比數量9就足夠，不必比項集或各自計數
      B: FP-Growth不產候選，所以不需要任何樹記憶體
      C: 兩次原表掃描代表之後不必再遍歷任何條件樹
      D: 逐項比對項集與計數，並區分原表掃描和條件遞迴
    answer: D
    explain:
      A: 數量相同仍可能是不同項集。
      B: FP樹與條件樹仍需記憶體。
      C: 原表掃描兩次後仍需在樹上遞迴。
      D: 比對完整結果才能確認同門檻下的一致性。
---

## 為什麼需要

Apriori可能反覆生成大量候選。FP-Growth（Frequent Pattern Growth）改將交易存成可共用前綴的FP樹，再從條件路徑延伸頻繁項集，避免逐階列出候選。

它和Apriori在相同資料、相同支持度下，應找到相同頻繁項集。改變的是搜尋過程與資料結構，不是支持度定義。

## 直覺

兩張排序後的交易都從B、A開始，就把這段路徑共用，節點計數累加。節點的數字是通過這個前綴的交易數，不能當成該商品的全域次數。

![同一商品可位於不同前綴；C的全域5筆分散在三個節點](figure:l23202-fp-growth-tree)

## 定義與公式

FP樹保存頻繁項目的有序路徑與計數，另可用表頭找到同名節點。條件模式基是某後綴項目之前的前綴路徑及其權重；條件FP樹則將這些路徑再壓縮。

本例的最小支持度20%，在10筆資料中就是最低2筆，包含等號。整個挖掘過程維持這個計數；條件路徑變少時，不重新把門檻改成條件資料的20%。（補充）

## 走一次流程

### 兩次掃描

第一遍掃描共用十筆交易，得到B7、A5、C5、D4、E1。刪去不足2筆的E，再按支持度由大到小排序；同頻的A與C固定A在前。

第二遍重新讀每筆交易，刪E並按B／A／C／D排序後插入樹。交易1、2成為B→A→C，第三筆B→A共用前兩節點；第四筆B→A→D則在A下分支。

完整樹的根有B:7、A:1、C:1、D:1四條分支。B下有A:4及C:2；A:4下再分C:2與D:1。圖中同名節點分處不同前綴，不能任意接在一起。

### 以C為後綴

C的三個節點計數2／2／1，加起來是5。擷取C之前的路徑，得到下表；根直接到C的那1筆沒有前綴，但仍計入C的總支持筆數。

| C所在路徑 | 前綴 | 路徑權重 |
|---|---|---|
| B→A→C | BA | 2 |
| B→C | B | 2 |
| 根→C | 空 | 1 |

前綴中B累計4，A累計2，都達門檻。條件樹可讀成B:4，其下A:2；延伸後得到BC4、AC2與ABC2。

![C的條件路徑保留原權重，生成條件樹後再接回後綴C](figure:l23202-fp-growth-conditional)

同理，D之前的BA:1、A:1、C:1使A累計2，B與C各1；條件剪枝後只有A，所以產生AD2。全組結果與Apriori同為9個非空頻繁項集。

## 程式（補充）

以下分四段依序執行：建節點、建樹、遞迴挖掘、獨立核對。使用純Python，保存真正的前綴樹與條件模式基；沒有額外套件需求。

```python
from collections import Counter, defaultdict
from itertools import combinations
tx = [set(s) for s in ["ABC","ABC","AB","ABD","AD","BC","BC","B","CD","DE"]]
minimum = 2
class Node:
    def __init__(self, item=None, parent=None):
        self.item, self.parent, self.n = item, parent, 0
        self.children = {}
print("交易筆數", len(tx), "最低筆數", minimum)
```
```text
交易筆數 10 最低筆數 2
```

```python
def build(paths):
    counts = Counter()
    for items, weight in paths:
        counts.update({i: weight for i in items})
    order = sorted((i for i in counts if counts[i]>=minimum), key=lambda i:(-counts[i],i))
    rank = {item:i for i,item in enumerate(order)}
    root, header = Node(), defaultdict(list)
    for items, weight in paths:
        node = root
        for item in sorted((i for i in items if i in rank), key=rank.get):
            if item not in node.children:
                node.children[item] = Node(item,node)
                header[item].append(node.children[item])
            node = node.children[item]; node.n += weight
    return root, header
print("建樹函式就緒")
```
```text
建樹函式就緒
```

```python
def mine(paths, suffix=frozenset()):
    root, header = build(paths)
    result = {}
    for item, nodes in sorted(header.items()):
        pattern = suffix | {item}
        result[pattern] = sum(node.n for node in nodes)
        conditional = []
        for node in nodes:
            prefix, parent = set(), node.parent
            while parent.item is not None:
                prefix.add(parent.item); parent = parent.parent
            if prefix:
                conditional.append((prefix,node.n))
        result.update(mine(conditional, pattern))
    return result
fp = mine([(t,1) for t in tx])
print("FP頻繁項集數", len(fp))
```
```text
FP頻繁項集數 9
```

最後用逐階Apriori與獨立窮舉核對完整字典，包括每個項集的計數，不只比較數量。

```python
def count(s):
    return sum(s <= t for t in tx)
level = {frozenset([i]) for i in "ABCDE" if count({i})>=minimum}
ap, k = {}, 1
while level:
    ap.update({s:count(s) for s in level}); k += 1
    joined = {a|b for a in level for b in level if len(a|b)==k}
    level = {s for s in joined if all(frozenset(p) in level for p in combinations(sorted(s),k-1)) and count(s)>=minimum}
brute = {frozenset(s):count(set(s)) for k in range(1,6) for s in combinations("ABCDE",k) if count(set(s))>=minimum}
assert fp == ap == brute
print("FP-Growth、Apriori、窮舉：項集與計數全相同")
print("結果", " ".join("".join(sorted(s))+":"+str(fp[s]) for s in sorted(fp,key=lambda s:(len(s),sorted(s)))))
```
```text
FP-Growth、Apriori、窮舉：項集與計數全相同
結果 A:5 B:7 C:5 D:4 AB:4 AC:2 AD:2 BC:4 ABC:2
```

:::tip[讀碼重點]
`node.n`是前綴路徑的權重，建立條件模式基時必須帶過去。`minimum`保持全域2筆，不能在每次遞迴重新按比例降低。
:::

## 怎麼用、怎麼判讀

指引強調大型或稠密交易可受益於前綴壓縮；極稀疏資料若共用前綴少，壓縮優勢可能減弱。樹與條件樹本身也會占用記憶體。

「兩次掃描」指原始交易資料：一次計數、一次建樹。之後還要遍歷樹、生成條件模式基並遞迴挖掘，不是讀完第二遍就不再計算。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 購物籃 | 大量或稠密交易 | 共用前綴是否多 |
| 高維稀疏資料 | 前綴較少重疊 | 壓縮與記憶體效益有限 |
| 維修工單（補充） | 故障標記常成組出現 | 只探索共現，不判定根因 |
| 課程資源（補充） | 同週期使用多種教材 | 統一每筆觀察的時間範圍 |

## 常見誤解

- FP樹不是用特徵分裂來預測標籤的決策樹。
- 不生成Apriori式候選，不代表沒有遞迴、計數或記憶體成本。
- 同名節點的前綴不同；挖掘時要保留路徑權重。

## 進階

### 輸出也可能很大（補充）

前綴壓縮不會消除所有輸出成本。若大量項目總是一起出現，頻繁子集本身就可能非常多；門檻與所需模式種類仍須按用途規劃。

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-49`～`guide-3:4-50`：支持兩次掃描、條件模式基與優缺點。
- [Han、Pei、Yin：Mining Frequent Patterns without Candidate Generation](https://www.cs.sfu.ca/~jpei/publications/sigmod00.pdf)：核對FP樹、條件路徑權重與遞迴挖掘原理。
- [mlxtend FP-Growth教學](https://rasbt.github.io/mlxtend/user_guide/frequent_patterns/fpgrowth/)：參考同門檻比較Apriori與FP-Growth結果的安排。

## 小結

- 原表掃描兩次建立FP樹，再遞迴挖條件模式。
- 同一商品可能在多條前綴下，路徑權重必須保留。
- 相同資料與門檻下，應與Apriori得到相同項集及計數。
