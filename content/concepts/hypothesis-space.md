---
id: hypothesis-space
title: 假設空間與泛化
kind: theory
codes:
  - L23201
aliases:
  - Hypothesis Space
  - 泛化能力
summary: 假設空間決定模型能表示哪些規律，泛化則看它在未知資料上的表現
goals:
  - id: g1
    text: 比較線性模型、樹與神經網路的假設，區分訓練擬合與新資料表現
requires:
  - supervised-learning
guide_refs:
  - guide-3:4-4
textbook: v2
author: codex
status: draft
formula_groups:
  - id: linear-hypotheses
    source: https://www.cs.huji.ac.il/~shais/UnderstandingMachineLearning/understanding-machine-learning-theory-algorithms.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23201-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一批 72 筆訓練、24 筆驗證，網路訓練答對 69 筆但驗證 20 筆，線性模型訓練 67 筆但驗證 22 筆，能說什麼？
    options:
      A: 網路的訓練答對數較高，表示其假設空間在這批資料上必然更適合泛化
      B: 這次驗證較支持線性模型，仍須留意樣本少與切分波動
      C: 兩者共用訓練集，所以學到的邊界相同
      D: 線性模型驗證較佳，證明網路無法表示這類二維輸入的非線性關係
    answer: B
    explain:
      A: 訓練答對數反映對已見資料的擬合，不能保證假設空間更適合未見資料。
      B: 同一驗證集上線性模型答對 22 筆，多於網路的 20 筆，但只有 24 筆仍須留意抽樣波動。
      C: 共用訓練資料不會強迫兩種模型學到相同邊界，題目也未提供足以證明邊界相同的資訊。
      D: 這次驗證分數較低不能證明表示能力不足，使用非線性活化的網路可以表示非線性關係。
  - id: c2
    goal: g1
    type: choice
    prompt: 二維分類器設定為 x₁+x₂≥10 判優先，另一模型用多個單軸閾值組成矩形區域。兩者最合理的比較是？
    options:
      A: 兩者都只能畫一條直線
      B: 矩形規則必定比直線泛化好
      C: 直線參數較少，所以永遠正確
      D: 它們容許的函數不同，是否適合須看資料與驗證
    answer: D
    explain:
      A: 多個單軸切分可以形成階梯或矩形區域。
      B: 形狀較複雜不會自動保證未見資料表現。
      C: 較簡單仍可能無法表達真實關係。
      D: 假設空間限制可選函數，驗證資料用來檢查選出的規律。
---
## 為什麼需要

選模型也在選「允許怎樣的規律」。如果只能畫直線，就無法任意繞過每個點；容許更複雜的形狀，也可能連資料中的偶然變動都學進去。

假設空間（Hypothesis Space）描述可選函數的範圍。泛化能力（Generalization）則描述選出來的函數，在未知資料上能否維持表現。

## 直覺

線性模型透過線性邊界區分類別；決策樹用連續條件分支；神經網路可藉非線性結構學習表示。這些模型不是只換名稱，而是限制了可使用的函數形狀。

### 同批資料、三種邊界

三列展示線性、樹與神經網路容許的不同邊界形狀。

:::supplement[來源：scikit-learn Linear Models、Decision Trees、Neural networks；本組教學合成資料]
三個模型使用同一批 72 筆訓練郵件；設定、切分與種子固定。線性列畫出學得的精確直線；樹與網路底色以網格取樣，顯示近似邊界。
:::

![每一列的點完全相同；觀察直線、軸向切分與非線性邊界如何對同一位置作不同判斷。](figure:l23201-hypothesis-space-boundaries)

## 定義與公式（補充）

依《Understanding Machine Learning》第 9.1 節的半空間假設類，將二維分類器的候選集合寫成：

$$
\begin{aligned}
\mathcal H&=\{h_{w,b}:w\in\mathbb R^2,\ b\in\mathbb R\},\\
h_{w,b}(x)&=\mathbf1[w^\top x+b\geq0].
\end{aligned}
$$

$\mathcal H$ 是假設空間，$x\in\mathbb R^2$ 是二維特徵，$w\in\mathbb R^2$ 是權重，$b\in\mathbb R$ 是偏差；$\top$ 表示轉置。

$w,b$ 遍歷上述範圍，每組參數給出一個候選函數。$\mathbf1$ 表示條件成立輸出 1，否則輸出 0。

原書使用 −1／+1；本頁改成 0／1，並約定分數恰為 0 時判為 1。這是依原書定義改寫的教學表示。

此式是用線性分數閾值說明分類邊界，不是宣稱所有線性模型都做二元分類。樹深、網路層數與活化函數也會限制可表示的規律。

## 算一次

:::supplement[來源：Understanding Machine Learning 第 9.1 節；本組教學合成資料]

取教學候選規則 $w=(1,1)$、$b=-10$。mail-027 的 $x=(3,2)$，分數是 $3+2-10=-5$，預測 0。

mail-099 的 $x=(3,8)$，分數是 $3+8-10=1$，預測 1。

這是手動指定的候選函數，用來理解集合中的一員。下表和圖中的線性模型則由訓練資料學得參數，兩者不能混為同一條線。

| 模型設定 | 訓練答對／72 | 驗證答對／24 |
|---|---|---|
| 線性邏輯斯迴歸 | 67 | 22 |
| 深度 3 的決策樹 | 65 | 18 |
| 單隱藏層 8 節點網路 | 69 | 20 |
:::

網路在訓練資料答對較多，驗證卻少於線性模型。這次比較顯示「更能擬合訓練樣本」與「對未見樣本表現較好」是不同問題。

## 程式（補充）

先重建相同資料與索引，再比較模型；沒有用測試結果挑選假設。

```python
import numpy as np
i = np.arange(120)
X = np.column_stack((i % 12, i // 12))
y = (X.sum(axis=1) >= 10).astype(int)
y[i % 19 == 0] = 1 - y[i % 19 == 0]
order = np.random.default_rng(42).permutation(120)
train, val, test = order[:72], order[72:96], order[96:]
print("資料形狀", X.shape, "切分", len(train), len(val), len(test))
```
```text
資料形狀 (120, 2) 切分 72 24 24
```

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neural_network import MLPClassifier
models = [make_pipeline(StandardScaler(), LogisticRegression(random_state=42)),
          DecisionTreeClassifier(max_depth=3, random_state=42),
          make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(8,),
                        solver="lbfgs", max_iter=3000, random_state=42))]
for name, model in zip(["線性", "樹", "網路"], models):
    model.fit(X[train], y[train])
    print(name, int((model.predict(X[train]) == y[train]).sum()),
          int((model.predict(X[val]) == y[val]).sum()))
```
```text
線性 67 22
樹 65 18
網路 69 20
```

:::tip[讀碼重點]
hidden_layer_sizes=(8,) 代表一個有 8 節點的隱藏層。三模型在相同樣本上比較；縮放由各自的訓練資料估計，樹則直接使用原特徵。
:::

## 怎麼用、怎麼判讀

先看模型是否能表達問題需要的關係，再看驗證表現。目標是選出能泛化的函數，不是找最會背訓練資料的一個。

:::supplement[來源：Dive into Deep Learning 3.6]
比較成立的前提包含相同切分與指標。驗證較好也不保證跨領域有效；資料分布改變時，原本選出的規律可能不再適用。
:::

### 換個場景

| 場景 | 指引列出的假設條件 | 判讀 |
|---|---|---|
| 線性可分的分類 | 用線性邊界區分 | 檢查是否需要彎曲邊界 |
| 條件規則可描述的資料 | 逐步分支 | 檢查規則是否過度細碎 |
| 非線性抽象表示 | 網路學習表示 | 仍須查未見資料表現 |
| 客服郵件（補充） | 詞頻與優先類別 | 共用驗證資料比較假設 |
| 製造設備（補充） | 溫度與振動的聯合作用 | 邊界形狀須配合特徵表示 |

## 常見誤解

- 假設空間不是資料點所在的特徵空間。（補充）
- 網路能表示較複雜關係，不保證訓練程序一定找得到好解。（補充）
- 訓練準確率最高，不代表泛化能力最好。

## 進階

### 參考來源

- 科目 3 指引 4.1，guide-3:4-4（版本未標示）：支持三種模型假設、線性／條件／非線性場景與未知資料表現。
- [scikit-learn Linear Models](https://scikit-learn.org/stable/modules/linear_model.html)：支持線性分數、邊界與程式。
- [Understanding Machine Learning 第 9.1 節 Halfspaces](https://www.cs.huji.ac.il/~shais/UnderstandingMachineLearning/understanding-machine-learning-theory-algorithms.pdf)：支持假設集合、參數範圍與手算候選函數；本頁改用 0／1 並明訂零分數的歸類。
- [scikit-learn Decision Trees](https://scikit-learn.org/stable/modules/tree.html)、[Neural networks](https://scikit-learn.org/stable/modules/neural_networks_supervised.html)：支持圖中模型設定與程式。
- [Dive into Deep Learning 3.6](https://d2l.ai/chapter_linear-regression/generalization.html)：參考訓練與泛化分開比較的安排，支持容量、資料條件與驗證的延伸。

## 小結

- 模型選擇會限制允許的函數形狀。
- 三種模型可以對同一批點畫出不同邊界。
- 泛化要看未參與學習的資料，不能只看訓練擬合。
