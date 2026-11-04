---
id: classification-tree
title: 分類決策樹
kind: model
codes: [L23202]
aliases: [Classification Tree, 分類樹]
requires: [tree-impurity]
summary: 分類決策樹逐次選擇條件切分資料，沿路徑到葉節點給類別
goals:
  - id: g1
    text: 用節點純度、停止規則與葉投票描述分類樹的建構及預測
guide_refs: [guide-3:4-30, guide-3:4-31, guide-1:5-8]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 分類樹根節點問借款餘額是否≤408千元，左子節點問收入是否≤45千元。客戶餘額364、收入40，應往哪個葉走？
    options:
      A: 根往右、子往左，因為364大於408且40小於45
      B: 根往左、子往左，因為364小於408且40小於45
      C: 根往左、子往右，因為364小於408且40大於45
      D: 根往右、子往右，因為364大於408且40大於45
    answer: B
    explain:
      A: 餘額364滿足小於等於408，不能走否分支。
      B: 兩個條件都成立，依序沿兩條是分支到達葉。
      C: 收入40滿足小於等於45，不能走子節點的否分支。
      D: 兩個比較都顛倒，與輸入值不符。
  - id: c2
    goal: g1
    type: choice
    prompt: 某葉節點有14筆訓練樣本，6筆未違約、8筆違約。未加類別權重時，如何預測新客戶？
    options:
      A: 預測違約，因為8筆比6筆多，葉內違約比例約0.571
      B: 預測未違約，因為6筆比8筆多，葉內未違約比例約0.571
      C: 預測第三類，因為兩類都有樣本，應自動建立混合類別
      D: 拒絕預測，因為只有14筆而非純葉，任何樹都不能輸出
    answer: A
    explain:
      A: 葉採多數類別，8除以14約為0.571，但不保證機率校準。
      B: 兩類筆數與比例的判讀顛倒。
      C: 混合葉仍從既定類別選答案，不會自動創造新類別。
      D: 停止規則可以留下混合葉，並不要求所有葉完全純。
  - id: c3
    goal: g1
    type: choice
    prompt: 單棵樹在54筆訓練資料全對，但驗證18筆僅答對11筆。團隊想改善泛化，先比較哪個方案？
    options:
      A: 增加最大深度，確保每個葉都只有1筆，再只看訓練表現
      B: 刪除驗證錯誤的7筆，保留原樹結構，再宣稱模型更準確
      C: 改用最後18筆測試資料挑深度，再宣稱它仍是獨立評估
      D: 限制深度或增加葉最少筆數，再以訓練內驗證比較取捨
    answer: D
    explain:
      A: 更深更碎可能加重記憶訓練噪聲的問題。
      B: 依錯誤刪除評估資料會美化結果，沒有改善模型。
      C: 測試資料一旦參與選型，就不再是最終獨立評估。
      D: 停止規則可以降低複雜度，仍需用驗證檢查是否有效。
is_a: [decision-tree]
---

## 為什麼需要

金融與醫療常希望看見明確條件，例如「餘額低於某值，再看收入」。分類決策樹（Classification Tree）用逐層判斷形成可追蹤的預測路徑。

它不要求特徵與類別呈線性關係，也能表達交互作用。不過規則清楚，不代表一定穩定；單棵深樹仍容易過擬合。

## 直覺

把分類看成依序回答幾個問題。根節點先問一個條件，內部節點接著問，走到葉節點後才輸出類別。

下面的小樹來自共用金融訓練資料。先看根節點，再順著是／否往下；葉下面保留兩類筆數，避免把類別名稱誤當成完全確定。

![從根到葉依序比較條件；葉下的兩類筆數顯示有些葉仍然混合。](figure:l23202-classification-tree-path)

## 定義與公式

### 建構與停止

在每個節點比較候選特徵與切點，選出讓子節點更純的條件，再對子節點重複。指引列出最大深度、節點最少樣本量（分裂前的下限），以及純度足夠等停止條件。

:::supplement[來源：scikit-learn Decision Trees Classification criteria]
分類樹可以在混合葉停止。沒有加權時，新樣本沿條件到達某葉，就選該葉訓練樣本的多數類別。
:::

### 三種純度判準的角色

| 判準 | 看什麼 | 用途與方向 |
|---|---|---|
| Gini不純度 | 各類在節點中的混雜程度 | 子節點加權不純度越低越好 |
| 熵與資訊增益 | 分割後不確定性降低多少 | 資訊增益越大越好 |
| 分類誤差 | 若全部預測多數類會錯多少 | 描述節點內錯分比例 |

:::supplement[來源：scikit-learn Decision Trees Classification criteria]
三者描述節點，不是獨立測試成績。`DecisionTreeClassifier`可選Gini或熵等準則，沒有名為「分類誤差」的criterion選項。

分類誤差只看多數類比例，對其他比例的細小變化較不敏感。它與Gini、熵的敏感程度不同，不應當成同一指標。
:::

## 走一次流程

### 金融客戶走樹（補充）

共用資料先取54筆訓練，用熵、深度上限2與葉最少3筆建立圖中的樹。這棵樹和二元與多類別模型選用頁的深度3、Gini樹，設定不同。

1. F038的借款餘額364千元，滿足根節點的「≤408」，往左。
2. 月收入40千元，滿足「≤45」，再次往左。
3. 到達14筆的葉：6筆未違約、8筆違約，因此判違約。

8除以14約為0.571，是葉內違約比例。這筆是訓練樣本，只示範路徑；獨立的18筆驗證集，這個設定答對13筆。

### 停在混合葉

圖中即使有未違約與違約混在一起的葉，深度達上限就停止。若不設複雜度限制，樹可能繼續切到只剩少數樣本，反而把噪聲學成規則。

## 程式（補充）

先重建同一金融資料與切分，不讀取測試資料做選擇。

```python
import numpy as np
from sklearn.tree import DecisionTreeClassifier
i = np.arange(90)
a, b = i % 9, i // 9
X = np.column_stack((20+10*a, 100*b, 16+8*a+(i%3-1), 90*b+2*(i%4)))
y = (b-a-1 >= 0).astype(int)
hand = [10, 28, 11, 38, 12, 48]
order = np.random.default_rng(42).permutation([j for j in i if j not in hand])
train, val = np.r_[hand, order[:48]], order[48:66]
print("訓練/驗證", len(train), len(val))
```
```text
訓練/驗證 54 18
```

```python
tree = DecisionTreeClassifier(criterion="entropy", max_depth=2,
                              min_samples_leaf=3, random_state=42)
tree.fit(X[train], y[train])
leaf = tree.apply(X[[38]])[0]
counts = tree.tree_.value[leaf, 0] * tree.tree_.n_node_samples[leaf]
print("葉兩類筆數", np.rint(counts).astype(int).tolist())
print("F038預測", tree.predict(X[[38]]).tolist())
print("驗證答對", int((tree.predict(X[val]) == y[val]).sum()), "/18")
print("深度/葉數", tree.get_depth(), tree.get_n_leaves())
```
```text
葉兩類筆數 [6, 8]
F038預測 [1]
驗證答對 13 /18
深度/葉數 2 4
```

:::tip[讀碼重點]
`max_depth`限制層數，`min_samples_leaf`限制葉內筆數；兩者不等於`min_samples_split`。圖上同樣預測違約的兩個葉，也可能有不同的類別比例。
:::

## 怎麼用、怎麼判讀

指引把醫療、金融的可解釋分類，以及規模不過大的資料列為場景。樹對單位尺度較不敏感；條件門檻會隨單位一起改，不依歐幾里得距離投票。

:::supplement[來源：scikit-learn Decision Trees]
樹模型的家族可以處理數值與類別特徵，但本例的scikit-learn實作不能直接把任意文字類別丟入。要先採用適當類別編碼，並檢查編碼是否引入不合理順序。
:::

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 金融、醫療 | 追蹤條件到類別的路徑 | 短規則仍需查核穩定性 |
| 非線性與交互作用 | 逐層依條件分區 | 分段邊界可能不平滑 |
| 規模不過大的分類資料 | 建立單棵樹基準 | 別只看訓練純度 |
| 製造瑕疵（補充） | 依壓力、振動條件分故障 | 運作條件改變後要重驗證 |
| 客服分流（補充） | 用少數可用欄位形成規則 | 避免用事後才知道的資訊 |

## 常見誤解

- 決策樹一定要切到每個葉只剩一類：停止規則可以保留混合葉。
- Gini較低就表示測試準確率必高：節點純度與新資料表現不同。（補充）
- 每條規則都是因果：資料稍有變動，規則就可能改變；可追蹤性不是因果證據。（補充）

## 進階

### 參考來源

- 科目3指引4.2，guide-3:4-30～4-31；科目1指引5.1，guide-1:5-8（版本未標示）：支持建構、停止、三種判準、適用場景與限制。
- [scikit-learn Decision Trees](https://scikit-learn.org/stable/modules/tree.html)：核對criterion、葉預測與類別欄位限制。
- [INRIA Build a classification decision tree](https://inria.github.io/scikit-learn-mooc/python_scripts/trees_classification.html)：參考由條件路徑連到特徵分區的教法。
- [INRIA Importance of decision tree hyperparameters](https://inria.github.io/scikit-learn-mooc/python_scripts/trees_hyperparameters.html)：支持停止規則與泛化比較。

## 小結

- 訓練時比較候選切分，預測時沿固定路徑到葉。
- Gini、熵與分類誤差描述節點，驗證指標描述新資料表現。
- 混合葉可用多數類別預測；深度限制不保證效果，仍需驗證。
