---
id: association-rule-metrics
title: 關聯規則的支持度、信賴度與提升度
kind: metric
codes:
  - L23202
aliases:
  - Confidence
  - Lift
  - Support
  - association-confidence
  - association-lift
  - association-support
  - 信賴度
  - 提升度
  - 支持度
requires:
  - conditional-probability
summary: 用支持度看共同頻率、信賴度看方向、提升度看獨立基準
goals:
  - id: g1
    text: 由交易表計算支持度，分清項集聯集與事件交集
  - id: g2
    text: 計算雙向信賴度，辨認零分母與熱門品偏誤
  - id: g3
    text: 計算提升度並比較獨立基準，避免因果推論
guide_refs:
  - guide-3:4-48
  - guide-3:4-49
textbook: v2
author: codex
status: draft
formula_groups:
  - id: support
    source: guide-3:4-49
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
  - id: confidence
    source: guide-3:4-49
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
  - id: lift
    source: guide-3:4-49
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 10筆購物籃中，5筆含咖啡、7筆含牛奶、4筆兩者都有。規則咖啡⇒牛奶的支持度為何？
    options:
      A: 4/5＝0.8，分母只算咖啡交易
      B: 4/7，分母只算牛奶交易
      C: 8/10＝0.8，分子算至少一項
      D: 4/10＝0.4，分子算兩項皆有
    answer: D
    explain:
      A: 這是正向信賴度。
      B: 這是反向信賴度。
      C: 至少一項屬事件聯集，不是共同出現。
      D: 支持度分母是全部10筆。
  - id: c2
    goal: g2
    type: choice
    prompt: 同10筆交易中咖啡5筆、牛奶7筆、共同4筆。雙向信賴度的正確組合為何？
    options:
      A: 咖啡⇒牛奶為4/5；牛奶⇒咖啡為4/7
      B: 咖啡⇒牛奶為4/7；牛奶⇒咖啡為4/5
      C: 咖啡⇒牛奶為4/10；牛奶⇒咖啡為4/10
      D: 咖啡⇒牛奶為5/7；牛奶⇒咖啡為7/5
    answer: A
    explain:
      A: 方向改變時，分母改成該方向的前件數。
      B: 兩個前件的分母顛倒。
      C: 共同出現除全部交易是支持度。
      D: 分子應是共同出現數，信賴度也不能超過1。
  - id: c3
    goal: g3
    type: choice
    prompt: 10筆工單中，高溫5筆、漏油4筆、兩者都有2筆；振動5筆與漏油共同1筆。提升度應如何判讀？
    options:
      A: 高溫⇒漏油為1；振動⇒漏油為2
      B: 高溫⇒漏油為1；振動⇒漏油為0.5
      C: 高溫⇒漏油為2；振動⇒漏油為1
      D: 高溫⇒漏油為0.5；振動⇒漏油為1
    answer: B
    explain:
      A: 第二個應為(1/5)/(4/10)=0.5。
      B: 第一個為(2/5)/0.4=1，第二個為0.2/0.4=0.5。
      C: 兩者都未按各自的共同次數計算。
      D: 第一個未正確除以漏油的整體比例。
---

## 為什麼需要

「買咖啡的人常買牛奶」可能只是因為牛奶本來就熱門。關聯規則需要同時看共同頻率、條件比例與獨立基準，才能說清楚觀察到什麼。

支持度（Support）看整體中的共同出現；信賴度（Confidence）看有前件時出現後件的比例；提升度（Lift）再與後件本來的比例相比。

## 直覺

三個指標可以用同一張交易表，分母卻不同。先把「全部交易」「含前件交易」「後件整體比例」分清楚，再計算。

![同一共同出現計數，支持度除全部交易，信賴度除前件，提升度再除後件比例](figure:l23202-association-rule-metrics-denominators)

## 定義與公式

### 支持度與兩種集合

令$N$是全部交易數，$A,B$是互不重疊的項集；$n_A,n_B,n_{AB}$分別是包含A、B及兩者全部項目的交易數。

$$
\operatorname{supp}(A\Rightarrow B)=\operatorname{supp}(A\cup B)
=\frac{n_{AB}}{N}=P(E_A\cap E_B)
$$

$A\cup B$是把兩邊商品合成一個項集；$E_A$是「交易包含A的全部項目」這個事件。要同時滿足兩邊，因此交易事件用交集，不能解讀成「至少買其中一項」。$N$須大於零。

### 信賴度有方向

$$
\operatorname{conf}(A\Rightarrow B)=\frac{n_{AB}}{n_A}=P(E_B\mid E_A)
$$

分母$n_A$是前件出現的交易數，須大於零。反向規則改除$n_B$，因此雙向信賴度通常不同。

:::supplement[來源：mlxtend Association rules；Emory Mining Association Rules課程]
前件一次也沒出現時，條件比例未定義，不應填成0%或100%。如果沒有交易，支持度也未定義；「沒有資料」和「觀察到零次」不同。
:::

### 提升度對照基準

$$
\operatorname{lift}(A\Rightarrow B)=
\frac{\operatorname{conf}(A\Rightarrow B)}{n_B/N}
=\frac{n_{AB}N}{n_A n_B}
$$

$n_B/N$是後件的整體出現比例，必須大於零。大於1表示共同出現多於獨立基準，等於1符合該基準，小於1則較少。

這是同一交易樣本中的關聯，不是「A造成B」。樣本提升度恰為1，也不能證明未來所有族群都獨立。（補充）

## 算一次

### 十筆交易（補充）

例子JSON的A／B／C／D／E代表咖啡／牛奶／麵包／茶包／果醬。一筆內每項只記有／無；為保持表格易讀，分成前後各五筆。

| 索引 | 出現項目 | A有無 | B有無 |
|---|---|---|---|
| 1 | ABC | 1 | 1 |
| 2 | ABC | 1 | 1 |
| 3 | AB | 1 | 1 |
| 4 | ABD | 1 | 1 |
| 5 | AD | 1 | 0 |

| 索引 | 出現項目 | A有無 | B有無 |
|---|---|---|---|
| 6 | BC | 0 | 1 |
| 7 | BC | 0 | 1 |
| 8 | B | 0 | 1 |
| 9 | CD | 0 | 0 |
| 10 | DE | 0 | 0 |

因此A有5筆、B有7筆、AB有4筆；C有5筆、D有4筆。維修版同樣十列，將項目依序讀成高溫／異音／振動／漏油／斷電，計數完全相同。

### 三指標核算

以下代入上面的教學資料。支持度A⇒B為$4/10=0.4$；若改數「至少A或B」會得到8筆，回答的是另一個問題。

信賴度A⇒B為$4/5=0.8$；反向B⇒A則為$4/7\approx0.5714$。兩者共享同一分子，分母隨前件方向改變。

提升度A⇒B為$0.8/0.7=8/7\approx1.1429$。相對牛奶原本70%的比例，含咖啡時80%只有溫和提高，不能僅看80%就認為關聯極強。

| 規則 | 支持度 | 信賴度 | 提升度 |
|---|---|---|---|
| A⇒B | 4/10 | 4/5 | 8/7，大於1 |
| A⇒D | 2/10 | 2/5 | 1，符合獨立基準 |
| C⇒D | 1/10 | 1/5 | 1/2，小於1 |

在維修版，A⇒D就是高溫⇒漏油：漏油本來有40%，高溫條件下仍為40%。這組資料沒有顯示比基準更強的關聯，不表示高溫造成或阻止漏油。

若設定最小支持度20%，在這10筆資料中就是最低2筆，包含等號。A⇒B與A⇒D通過，C⇒D只有1筆而未通過；提升度仍可計算，但不會取代支持度篩選。（補充）

## 程式（補充）

用交易集合計數，保留分數形式避免中途四捨五入。規則方向只改前件，不重排或重抽交易。

```python
from fractions import Fraction as F
transactions = [set(s) for s in ["ABC","ABC","AB","ABD","AD","BC","BC","B","CD","DE"]]
def count(items):
    return sum(set(items) <= t for t in transactions)
def metrics(a, b):
    na, nb, nab = count(a), count(b), count(a+b)
    support = F(nab, len(transactions))
    confidence = F(nab, na) if na else None
    lift = F(nab*len(transactions), na*nb) if na and nb else None
    return support, confidence, lift
for a, b in [("A","B"),("B","A"),("A","D"),("C","D")]:
    print(a+"=>"+b, *[str(x) for x in metrics(a,b)])
```
```text
A=>B 2/5 4/5 8/7
B=>A 2/5 4/7 8/7
A=>D 1/5 2/5 1
C=>D 1/10 1/5 1/2
```

三個獨立檢核各用不同的已知答案；另檢查零前件。不要只把同一函式再算一次當成驗證。

```python
assert count("AB") == 4 and metrics("A","B")[0] == F(4,10)
assert metrics("A","B")[1] == F(4,5) and metrics("B","A")[1] == F(4,7)
assert [metrics(a,"D")[2] for a in ["A","C"]] == [F(1),F(1,2)]
assert metrics("Z","B")[1:] == (None, None)
print("支持度、雙向信賴度、提升度三項檢核通過；零前件為未定義")
```
```text
支持度、雙向信賴度、提升度三項檢核通過；零前件為未定義
```

:::tip[讀碼重點]
`set(items) <= t`要求項目全部同現；`na`跟隨前件，`nb`提供後件基準。零前件回傳`None`，避免把未定義比例當成零。
:::

## 怎麼用、怎麼判讀

指引以購物籃分析說明共同購買。大量交易、高維商品也會帶來候選計算成本；三指標的計算和找出頻繁項集是不同步驟，後者見Apriori與FP-Growth。

### 換個場景

| 場景 | 一筆交易的單位 | 判讀重點 |
|---|---|---|
| 零售購物籃 | 一張結帳單 | 熱門商品的基準比例 |
| 維修工單（補充） | 同次維修的故障標記 | 共現不代表故障原因 |
| 網站瀏覽（補充） | 固定定義的一次工作階段 | 不能將同訪問誤當先後因果 |

## 常見誤解

- 項集聯集表示兩邊項目全部收進來，交易事件卻要同時成立。
- 信賴度高可能只是後件很熱門，仍要比較提升度。
- 提升度方向互換數值相同，信賴度則通常不同。
- 規則箭頭表示條件方向，不自動表示時間或因果。（補充）

## 進階

### 樣本與營運價值（補充）

罕見組合可能有高提升度卻只影響極少交易。實際採用前，要看支持筆數、時段與成本，並在新資料驗證；若要推銷活動的因果成效，需另外的實驗設計。

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-48`～`guide-3:4-49`：支持三指標、購物籃與計算成本；4-49公式已核對PDF。
- [mlxtend Association rules](https://rasbt.github.io/mlxtend/user_guide/frequent_patterns/association_rules/)：核對項集聯集的定義與三指標公式。
- [Emory Mining Association Rules](https://www.cs.emory.edu/~cheung/Courses/584/Syllabus/10-Mining/intro-mining.html)：參考同表雙分母的教學安排。
- [University of Tennessee關聯規則課程](https://datalab.utk.edu/bas474/chapters/AssociationRules.html)：支持熱門後件、獨立基準及監督／無監督的界線。

## 小結

- 支持度的分母是所有交易，分子是兩邊項目全部出現。
- 信賴度的分母跟隨前件，需防熱門品偏誤。
- 提升度再除後件比例；1是獨立基準，關聯不等於因果。
