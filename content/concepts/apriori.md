---
id: apriori
title: Apriori 關聯規則挖掘
kind: model
codes:
  - L23202
aliases: []
requires:
  - association-rule-metrics
contrasts:
  - target: fp-growth
    note: Apriori逐階生成並計數候選；FP-Growth先壓縮前綴，再遞迴挖掘條件模式。
    source: [guide-3:4-49, guide-3:4-50]
summary: 逐階產生候選項集，利用非頻繁子集剪掉不可能的超集
goals:
  - id: g1
    text: 使用Apriori性質生成候選與剪枝，依支持度門檻篩選頻繁項集
guide_refs:
  - guide-3:4-48
  - guide-3:4-49
textbook: v2
author: codex
status: draft
formula_groups:
  - id: downward-closure
    source: https://www.vldb.org/conf/1994/P487.PDF
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 10筆交易設定最小支持度20%；單項A有5筆、B有7筆、D有4筆，BD只有1筆。候選ABD如何處理？
    options:
      A: 保留ABD，因三個單項各自都超過門檻
      B: 保留ABD，因項目越多支持度必然越高
      C: 剪除ABD，因其子集BD未達2筆的門檻
      D: 剪除ABD，因三項規則不適合購物籃分析
    answer: C
    explain:
      A: 所有單項頻繁只是必要條件的一部分。
      B: 加條件只會維持或減少共同交易數。
      C: ABD的出現次數不可能超過BD。
      D: 三項集可以分析，這裡剪枝原因是支持度。
  - id: c2
    goal: g1
    type: choice
    prompt: 10筆交易中AB有4筆、AC有2筆、BC有4筆，最小支持度20%。關於候選ABC何者正確？
    options:
      A: 兩項子集都頻繁，仍須計數ABC確認是否至少2筆
      B: 兩項子集都頻繁，直接宣告ABC至少出現4筆
      C: 只要AB頻繁就足夠，不須檢查AC與BC的支持度
      D: 兩項子集有一個剛好2筆，所以ABC必須剪掉
    answer: A
    explain:
      A: 子集皆頻繁不能保證三項真的共同出現。
      B: 子集計數不決定交集的確切大小。
      C: 每個兩項子集都必須通過。
      D: 門檻包含等號，2筆仍頻繁。
  - id: c3
    goal: g1
    type: choice
    prompt: 100萬筆交易、數千種商品，團隊將最小支持度由10%降到1%。何者是合理的成本預期？
    options:
      A: 門檻下降必使候選變少，掃描成本可忽略
      B: 只掃描一次即可生成所有階數的頻繁項集
      C: 信賴度門檻會自動刪除所有不頻繁的單項
      D: 可能留下更多候選與階數，需評估掃描及記憶體
    answer: D
    explain:
      A: 較低門檻通常保留更多候選。
      B: Apriori逐階計數可能多次掃描。
      C: 信賴度用於後續規則篩選，與單項支持度不同。
      D: 資料規模與頻繁模式數會共同決定成本。
---

## 為什麼需要

五個商品已經能組成許多非空項集。商品增加到數千種時，全部列出再計數會很昂貴；Apriori利用支持度的規律，提早排除不可能頻繁的組合。

它先找頻繁項集，再由項集生成規則並篩選信賴度。頻繁項集本身沒有箭頭，不能直接當成已通過門檻的規則。

## 直覺

如果含牛奶與茶包的交易都不到門檻，再加入咖啡只會讓條件更嚴格，不會增加交易數。因此，不必再掃描「咖啡、牛奶、茶包」的共同次數。

![非頻繁的BD阻止ABD等超集繼續生長，通過子集檢查的ABC仍須實際計數](figure:l23202-apriori-pruning)

## 定義與公式

指引4-48以文字說明Apriori性質，4-49定義支持度。下式由這兩者整理；包含整個$T$的交易一定也包含其子集$S$，因此前者的計數不會比較大。（補充）

$$
S\subseteq T\ \Longrightarrow\ n(T)\le n(S),\qquad
\operatorname{supp}(S)=\frac{n(S)}N
$$

$S,T$是項集，$n(S)$是包含S全部項目的交易數，$N$是同一交易資料庫的筆數且大於零。固定相同的最小支持度時，非頻繁子集的任何超集都不可能頻繁。

本例的最小支持度20%，在10筆資料中就是最低2筆，包含等號。某子集只有1筆時，任何超集至多1筆，支持度至多10%，可直接剪掉。

反方向不成立：所有子集都頻繁，不代表合起來也頻繁。候選通過剪枝後，仍要在交易表中計數。

## 走一次流程

### 同一十筆交易（補充）

沿用三指標頁的交易：ABC、ABC、AB、ABD、AD、BC、BC、B、CD、DE。零售與維修版只改項目的領域意義；共同使用2筆門檻。

第一輪掃描得到A5、B7、C5、D4、E1。頻繁單項為A／B／C／D，E被刪；所有含E的更大項集也不再考慮。

### 第二輪：候選兩項集

| 候選 | 共同筆數 | 至少2筆？ |
|---|---|---|
| AB | 4 | 是 |
| AC | 2 | 是 |
| AD | 2 | 是 |
| BC | 4 | 是 |
| BD | 1 | 否 |
| CD | 1 | 否 |

以上候選從頻繁單項兩兩組合而來。計數後，留下AB／AC／AD／BC作為下一輪的依據。

### 第三輪：先剪再數

按相同前綴連接頻繁兩項集，可生成ABC／ABD／ACD。ABC的兩項子集AB／AC／BC全部通過，因此保留候選；實際計數2筆，也頻繁。

ABD包含不頻繁的BD，ACD包含CD，這兩個候選不用再計數。

只剩一個頻繁三項集ABC，無法再生成四項候選，程序停止。本例共4個單項、4個兩項、1個三項，合計9個。

若要規則，才進一步拆前後件。例如AB有4筆，A有5筆，A⇒B信賴度80%；是否保留規則，需再比事先設定的信賴度門檻。

## 程式（補充）

以下是小資料可讀版：每輪由頻繁項集聯集產生候選，再檢查全部的前一階子集。並非針對大量交易優化的實作。

標準Apriori通常只連接排序後前綴相同的項集。本段先取聯集，可能多產生暫時候選；通過全部子集檢查後，與前綴連接保留相同候選。

本例兩種方法都只生成ABC／ABD／ACD，再剪至ABC。

```python
from itertools import combinations
tx = [set(s) for s in ["ABC","ABC","AB","ABD","AD","BC","BC","B","CD","DE"]]
def count(s):
    return sum(s <= t for t in tx)
minimum = 2
level = {frozenset([i]) for i in "ABCDE" if count({i}) >= minimum}
found, k = {}, 1
while level:
    found.update({s:count(s) for s in level})
    print(k, "項", " ".join("".join(sorted(s))+":"+str(count(s)) for s in sorted(level,key=lambda s:sorted(s))))
    k += 1
    joined = {a|b for a in level for b in level if len(a|b)==k}
    candidates = {s for s in joined if all(frozenset(p) in level for p in combinations(sorted(s),k-1))}
    level = {s for s in candidates if count(s) >= minimum}
print("頻繁項集數", len(found))
```
```text
1 項 A:5 B:7 C:5 D:4
2 項 AB:4 AC:2 AD:2 BC:4
3 項 ABC:2
頻繁項集數 9
```

:::tip[讀碼重點]
`candidates`只通過子集檢查，`level`才通過實際支持度檢查。這個簡單版本會重算一些計數；正式實作通常快取或批次掃描。
:::

## 怎麼用、怎麼判讀

Apriori適合從交易資料探索頻繁模式，購物籃是指引的主要場景。它容易逐階追蹤，但門檻太低或頻繁模式太多時，候選與多次掃描成本會增加。

### 換個場景

| 場景 | 交易定義或資料條件 | 判讀重點 |
|---|---|---|
| 購物籃 | 一筆結帳單、多種商品 | 分開項集與規則門檻 |
| 大量或高維稀疏交易 | 候選可能很多 | 掃描與記憶體成本 |
| 維修工單（補充） | 同一次工單的故障標記 | 頻繁不代表故障因果 |
| 線上課程（補充） | 一次學習週期的資源使用 | 交易邊界須一致 |

## 常見誤解

- 頻繁項集的所有子集都頻繁，但所有子集頻繁不保證超集頻繁。
- 最小支持度與最小信賴度不是同一門檻。
- 剪掉BD是因共同次數不足，不是B或D各自不熱門。

## 進階

### 掃描次數的意義（補充）

概念流程通常每一階對候選批次掃描原表。本頁可讀版逐候選掃描，因此不應用它的耗時評斷演算法的最佳實作；FP-Growth則以另一種資料結構降低候選成本。

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-48`～`guide-3:4-49`：支持向下封閉性、候選與剪枝、支持度及掃描成本。
- [Agrawal、Srikant：Apriori原始論文](https://www.vldb.org/conf/1994/P487.PDF)：第1、2.1節支持支持度定義、前綴連接與子集剪枝；計數不等式另由交易包含關係推得。
- [mlxtend Apriori](https://rasbt.github.io/mlxtend/user_guide/frequent_patterns/apriori/)：核對輸入交易形式與頻繁項集輸出。
- [Emory Apriori課程](https://www.cs.emory.edu/~cheung/Courses/584/Syllabus/10-Mining/Apriori.html)：參考項集階層與提早剪枝的圖解思路。

## 小結

- 先計單項，再由頻繁子集產生更大候選。
- 不頻繁子集的超集可以剪掉；通過剪枝後仍需計數。
- 項集挖掘完成後，才用信賴度等指標篩規則。
