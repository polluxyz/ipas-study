---
id: tree-impurity
title: 樹節點不純度與資訊增益
kind: theory
codes: [L23202]
aliases: [Entropy, Gini]
requires: [conditional-probability]
summary: 不純度衡量節點的類別混雜，切分要比較子節點加權後的改善
goals:
  - id: g1
    text: 計算Gini、熵與父子加權增益，在同一資料比較兩個候選切分
formula_groups:
  - id: gini
    source: https://scikit-learn.org/stable/modules/tree.html#classification-criteria
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: entropy
    source: https://scikit-learn.org/stable/modules/tree.html#classification-criteria
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: weighted-decrease
    source: https://scikit-learn.org/stable/modules/tree.html#mathematical-formulation
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
guide_refs: [guide-3:4-30, guide-3:4-31]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 金融節點有6筆資料，3筆未違約、3筆違約，熵採log₂。Gini與熵依序是多少？
    options:
      A: "Gini為0.000，熵為0.000 bit"
      B: "Gini為1.000，熵為0.500 bit"
      C: "Gini為0.500，熵為1.000 bit"
      D: "Gini為0.500，熵為0.500 bit"
    answer: C
    explain:
      A: 兩者為零代表單一類的純節點，不是兩類各半。
      B: Gini不能把兩類比例直接相加，且二元各半的熵為1。
      C: 1減兩個0.5平方為0.5，兩個負0.5乘log₂0.5相加為1。
      D: Gini與熵的尺度不同，不能把Gini數值沿用為熵。
  - id: c2
    goal: g1
    type: choice
    prompt: 父熵為1 bit，切分後左節點4筆、熵0.811278，右節點2筆、熵0。資訊增益約是多少？
    options:
      A: "增益約0.5944 bit，因為兩個子熵直接平均"
      B: "增益約0.1887 bit，因為只減去左子節點熵"
      C: "增益約0.7296 bit，因為左子權重採2／6"
      D: "增益約0.4591 bit，因為左子權重採4／6"
    answer: D
    explain:
      A: 子節點大小不同，不能直接給相同權重。
      B: 直接減左子熵忽略了節點所占的資料比例。
      C: 左節點有4筆，不應使用右節點的2筆權重。
      D: 1減4／6乘0.811278再減2／6乘0，約為0.4591。
  - id: c3
    goal: g1
    type: choice
    prompt: 製造節點兩類各5筆，另一個純節點10筆全正常。對純節點的零比例項，計算熵應如何處理？
    options:
      A: 採0log₂0=0的極限約定，純節點熵為0
      B: 採log₂0=0的數值約定，兩類各半熵為0
      C: 把零比例改為0.5再計算，純節點熵為1
      D: 直接判定任何純節點都無法算熵，也不能停止切分
    answer: A
    explain:
      A: 極限約定是零乘對數的整項為零，不是對數零有有限值。
      B: log₂0沒有定義，兩類各半的熵也不是零。
      C: 擅改類別比例會把純節點算成混雜節點。
      D: 採極限約定後可正常計算，純節點是常見停止情況。
---

## 為什麼需要

分類樹要判斷哪個切分比較好，不能只看其中一個子節點。把少數樣本切得很純，另一邊仍很混雜，未必有整體改善。

指引用Gini不純度、熵與資訊增益等概念描述切分品質。本頁集中比較Gini與熵；資訊增益頁再接到特徵篩選的用途。

## 直覺

節點內全是一類，看到該節點就容易猜答案；兩類各半，單靠節點位置仍難猜。這裡的「純」描述類別分布，不是資料有沒有錯字或缺值。

下面兩種切分都從同六筆金融資料開始。先看各子節點的筆數與類別比例，再比較加權結果。

![父節點相同，負債切分使兩邊比例不同；收入切分後每邊仍各半。](figure:l23202-tree-impurity-splits)

## 定義與公式

Gini越小，類別越集中；熵越小，類別越容易預期。資訊增益衡量切分後降低多少熵，方向則是越大越好。

### Gini不純度（補充）

$$
G(S)=1-\sum_{k=1}^{K}p_k^2
$$

$S$是非空節點，$K$是類別數，$p_k$是其中第$k$類的比例，各類比例總和為1。純節點只有一個比例為1，所以Gini為0。

### 熵（補充）

$$
H(S)=-\sum_{k=1}^{K}p_k\log_2p_k
$$

$H$為熵，採底數2時單位是bit。約定整項$0\log_2 0=0$，這來自極限，不是宣稱$\log_2 0$有有限值；實作可略過比例為0的項。

二元各半的熵為1、Gini為0.5。兩個指標的尺度不同，不能把它們的數值直接比較成「誰的模型較好」。

### 子節點加權與下降量（補充）

$$
\begin{aligned}
\Delta G&=G(S)-\sum_{v=1}^{m}\frac{n_v}{n}G(S_v),\\
\mathrm{IG}&=H(S)-\sum_{v=1}^{m}\frac{n_v}{n}H(S_v)
\end{aligned}
$$

$n$是父節點筆數，$m$是子節點數，$S_v$與$n_v$為第$v$個子節點及其筆數。各子節點完整、不重疊地分割父節點；權重加總為1，空子節點不列入合法候選。

Gini下降量是另一個切分改善量，與資訊增益的尺度不同，兩者別共用同一個數值。

## 算一次

### 同六筆比較兩個條件（補充）

金融共用六筆有3負3正。父Gini為$1-0.5^2-0.5^2=0.5$，父熵為$-2(0.5\log_2 0.5)=1$；樣本與近鄰頁相同。

負債≤350千元切出左4筆3負1正、右2筆全正。左Gini為$1-(3/4)^2-(1/4)^2=0.375$、熵約0.811278；右邊兩者皆0。

按筆數加權後，子Gini為0.25、子熵約0.540852。由父值扣掉加權子值：

$$
\begin{aligned}
\Delta G&=0.5-\left[\frac46(0.375)+\frac26(0)\right]=0.25,\\
\mathrm{IG}&=1-\left[\frac46(0.811278)+\frac26(0)\right]\approx0.459148
\end{aligned}
$$

條件二是收入≤35千元。左邊1負1正，右邊2負2正，兩邊比例都各半，因此加權子Gini仍為0.5、子熵仍為1；兩種改善量都為0。

| 候選條件 | 加權子Gini | Gini下降 | 資訊增益：bit |
|---|---|---|---|
| 負債≤350 | 0.2500 | 0.2500 | 0.4591 |
| 收入≤35 | 0.5000 | 0.0000 | 0.0000 |

這次兩個判準都選負債條件。其他資料可能產生不同排名；不能由一個算例推論Gini與熵永遠選同一切分。

## 程式（補充）

以下從六筆座標與標籤重算，不把手算的熵數值當輸入。

```python
import numpy as np
X = np.array([[1, 1], [1, 3], [2, 1], [2, 4], [3, 1], [3, 5]])
y = np.array([0, 1, 0, 1, 0, 1])
def impurity(labels):
    p = np.bincount(labels, minlength=2) / len(labels)
    nz = p[p > 0]
    return 1 - np.sum(p*p), -np.sum(nz * np.log2(nz))
parent = np.array(impurity(y))
for feature, threshold in [(1, 3.5), (0, 1.5)]:
    left = X[:, feature] <= threshold
    weighted = sum(mask.mean() * np.array(impurity(y[mask])) for mask in [left, ~left])
    delta = parent - weighted
    print("子Gini/子熵", np.round(weighted, 6).tolist(), "下降", np.round(delta, 6).tolist())
```
```text
子Gini/子熵 [0.25, 0.540852] 下降 [0.25, 0.459148]
子Gini/子熵 [0.5, 1.0] 下降 [0.0, 0.0]
```

:::tip[讀碼重點]
`mask.mean()`是子節點筆數占比；`p[p > 0]`處理零比例項。改成兩個子熵直接平均，會把4筆與2筆當成同樣大小。
:::

## 怎麼用、怎麼判讀

指引把純度用在分類樹節點的切分決策。適合的比較單位是「同一父節點的候選切分」，並連同停止規則考慮，不能只追求葉越純越好。

:::supplement[來源：scikit-learn Decision Trees Mathematical formulation；Google Decision Forests glossary]
固定類別數時，兩種不純度都在均勻分布較大、純節點為0。Gini與熵可能偏好不同切分；不純度下降也不是驗證集準確率的增幅。
:::

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 分類樹的混合節點 | 比較候選切分 | 子節點依筆數加權 |
| 製造正常／瑕疵（補充） | 比較壓力與振動切點 | 小群純不代表整體佳 |
| 醫療篩檢（補充） | 比較檢查條件的分辨力 | 純度不能代替漏診成本 |
| 客服三類案件（補充） | 將三類比例放入公式 | 不再套用二元最大值 |

## 常見誤解

- 把Gini 0.5當成熵0.5：兩者的公式與尺度不同。（補充）
- 一邊純就可以忽略另一邊：還要依兩邊筆數加權。
- 資訊增益0代表特徵永遠無用：本例只代表這個節點、這個切點沒有降低熵。（補充）

## 進階

### 參考來源

- 科目3指引4.2，guide-3:4-30～4-31（版本未標示）：支持純度判準的名稱、方向與分類樹用途；公式與數值操作為補充。
- [scikit-learn Decision Trees](https://scikit-learn.org/stable/modules/tree.html#classification-criteria)：支持Gini、熵與加權切分公式。
- [Google Decision Forests：Exact splitter](https://developers.google.com/machine-learning/decision-forests/binary-classification)：參考用相同父節點比較好壞切分的圖解方法。
- [Google Decision Forests glossary](https://developers.google.com/machine-learning/glossary/df)：核對資訊增益與Gini下降的術語差異。

## 小結

- 純度看的是節點內各類比例。
- 子節點大小不同，熵與Gini都要依筆數加權。
- 同一父節點比較下降量，再以驗證資料檢查模型效果。
