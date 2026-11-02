---
id: linear-discriminant-analysis
title: LDA 監督式降維
kind: technique
codes: [L23301]
aliases: [LDA, Linear Discriminant Analysis]
summary: LDA 使用分類標籤找投影方向，讓不同類別分開、同類樣本集中
goals:
  - id: g1
    text: 用帶標籤的投影比較 LDA 與 PCA，說明類間、類內目標及維度限制
requires: [matrix-operations, classification-regression]
contrasts:
  - target: pca
    note: LDA 使用標籤追求類別分離，PCA 不使用標籤而追求整體變異
    source: [guide-3:5-6, guide-3:3-14]
guide_refs: [guide-3:5-6, guide-3:3-14]
formula_groups:
  - id: fisher-projection
    source: https://web.stanford.edu/class/ee368/Handouts/Lectures/2013_Spring/14-EigenImages_16x9.pdf#page=15
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23301-D
  - id: dimension-limit
    source: https://scikit-learn.org/stable/modules/generated/sklearn.discriminant_analysis.LinearDiscriminantAnalysis.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 24 筆標記資料在橫軸變異很大，但兩類橫軸平均相同；縱軸變異較小，但兩類平均不同且各自集中。壓成一維時，哪個比較合理？
    options:
      A: PCA 追求類別分離；LDA 追求所有樣本散開
      B: PCA 與 LDA 都必定選橫軸，因原始變異較大
      C: PCA 偏向橫軸變異；LDA 偏向縱軸類別分離
      D: PCA 與 LDA 都不用標籤，差異只在輸出名稱
    answer: C
    explain:
      A: 這把兩種方法的目標顛倒了。
      B: LDA 還考量類別標籤，不只看總變異。
      C: 在本題的軸向結構下，整體變異與分類訊號指向不同方向。
      D: LDA 是監督式方法，需用訓練標籤學習方向。
  - id: c2
    goal: g1
    type: choice
    prompt: 某分類資料有 6 個輸入特徵、3 個類別。若資料秩足夠，LDA 最多可輸出幾個判別成分？
    options:
      A: 最多 1 維，因為所有分類都只能投影成一維
      B: 最多 2 維，因為上限由類別數減一共同限制
      C: 最多 3 維，因為每個分類標籤各產生一個軸
      D: 最多 6 維，因為輸入的每個特徵各保留一軸
    answer: B
    explain:
      A: 二元分類最多一維，三類在秩足夠時可達二維。
      B: 上限是輸入維度與類別數減一的較小者，此處為二。
      C: 三個類別平均之間最多有兩個獨立差異方向。
      D: 六維輸入不能突破三類帶來的兩維上限。
  - id: c3
    goal: g1
    type: choice
    prompt: 授信資料切為 24 筆開發與 12 筆測試。要學 LDA 並轉換測試輸入，哪個做法合適？
    options:
      A: 用 36 筆特徵與標籤 fit，再對測試做 transform
      B: 用 24 筆開發 fit，再以測試標籤調整投影方向
      C: 用 12 筆測試 fit，再把方向套回開發資料訓練
      D: 用 24 筆開發及其標籤 fit，再對測試做 transform
    answer: D
    explain:
      A: 測試標籤已參與投影學習，造成資料洩漏。
      B: 改方向仍使用測試答案，不能保持最終評估獨立。
      C: 用測試集學前處理，同樣破壞資料邊界。
      D: transform 使用已學好的方向，不需測試標籤。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

授信資料的收入變化很大，卻不一定能區分違約。若只保留變異最大的方向，可能捨棄真正有分類訊號的負債比。

LDA 監督式降維（Linear Discriminant Analysis）利用分類標籤選方向。它讓不同類別的投影盡量分開，同類樣本的投影盡量集中。

## 直覺

想像把帶標籤的點投影到一條線。好的分類方向，應讓兩類的中心相隔夠遠，也讓每類自己的點不要散得太開。

![橫向雖較分散，兩類卻重疊；縱向投影才能看出兩類的分離。](figure:l23301-linear-discriminant-analysis-projection)

這張圖用同一份授信開發資料的收入、負債比兩欄。PCA 找整體變異，LDA 看類別分離，目標不同，所以選到的方向可能不同。

## 定義與公式

指引以「類間差異大、類內變異小」說明 LDA。以下用投影後的平方差把這句話寫清楚，公式與維度上限均為補充。

### 把分類目標寫成比值（補充）

先用方向向量 w 把每筆輸入投影為數字：

$$
z_i=w^\top x_i
$$

$x_i$ 是第 i 筆的 p 維輸入，w 是 p 維投影方向，$z_i$ 是投影值。上標 $\top$ 表示轉置；此式用來建立新座標，並非只刪掉原始欄位。

用投影後的類間平方差除以類內平方差：

$$
\begin{aligned}
B(w)&=\sum_{c=1}^{C}n_c(\bar z_c-\bar z)^2\\
W(w)&=\sum_{c=1}^{C}\sum_{i:y_i=c}(z_i-\bar z_c)^2\\
J(w)&=\frac{B(w)}{W(w)}
\end{aligned}
$$

C 是類別數，$n_c$ 是第 c 類筆數，$\bar z_c$ 是該類投影平均，$\bar z$ 是全部投影平均。$y_i$ 是類別標籤；B、W 分別累加類間與類內差異。

在這個 Fisher 準則下，尋找 J 較大的方向。比值要求 W 大於 0；若同類點投影完全重合，需另處理退化方向、秩或正則化，不能直接除以 0。

### 成分上限（補充）

$$
d\leq\min(p,C-1)
$$

d 是保留的判別成分數，p 是原始特徵數，C 是類別數。六欄二元分類最多一維；六欄三類最多二維。資料秩不足時，可用的方向還可能更少。

## 算一次

### 同一批點，比較兩個方向（補充）

取共用授信 24 筆開發資料。橫座標是「月收入減 50 再除以 5」，縱座標是「負債比減 0.5 再乘 20」；這是固定單位換算，未用全資料估計縮放參數。

兩類各 12 筆。橫軸兩類平均都為 −1；縱軸未違約平均 −2、違約平均 2，整體縱軸平均為 0。

| 方向 w | 類間平方差 B | 類內平方差 W | 比值 J |
|---|---:|---:|---:|
| 橫向 (1,0) | 0 | 240 | 0 |
| 縱向 (0,1) | 96 | 2.56 | 37.5 |

縱向的 B 為 12×(−2−0)²＋12×(2−0)²＝96。每類 12 筆，相對中心的偏移 −0.4、0、0.4 各有 4 筆，因此 W 為 2×4×(0.16＋0＋0.16)＝2.56。

所以 J＝96÷2.56＝37.5。橫向雖有較大的總平方差，類間平方差卻為 0；本例的 PCA 選橫向，LDA 選縱向。

若取共用資料第 1 筆 C01，原座標為 (−5,−2.4)，縱向投影就是 0×(−5)＋1×(−2.4)＝−2.4。模型可能再中心化或縮放座標，方向的正負號也不影響分類資訊。

## 程式（補充）

只重建圖中兩欄，切分仍與六欄篩選頁一致。LDA 的 fit 需要訓練標籤，transform 不需要新資料的標籤。

```python
import numpy as np
from sklearn.decomposition import PCA
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
i = np.arange(36); j = i//2; y = i%2
u = 2*(j%6)-5
v = 2*(2*y-1) + .4*(j//6-1)
X = np.column_stack([u, v]); tr, te = j%3 != 2, j%3 == 2
pca = PCA(n_components=1).fit(X[tr])
lda = LinearDiscriminantAnalysis(n_components=1).fit(X[tr], y[tr])
direction = lda.scalings_[:, 0]
print("PCA方向絕對值", np.abs(pca.components_[0]).round(4).tolist())
print("LDA方向絕對值", (np.abs(direction)/np.linalg.norm(direction)).round(4).tolist())
print("測試投影形狀", lda.transform(X[te]).shape)
```
```text
PCA方向絕對值 [1.0, 0.0]
LDA方向絕對值 [0.0, 1.0]
測試投影形狀 (12, 1)
```

:::tip[讀碼重點]
方向向量只比較方向，不拿縮放後的座標值當機率。若做交叉驗證，LDA 也要放進每摺訓練的 Pipeline，不能先對全部開發資料 fit 再切摺。
:::

下面評估「投影後再分類」的完整流程。每摺都只把該摺訓練部分及標籤交給 LDA；固定單位換算不需估參數，因此可先重建座標。

```python
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
pipe = make_pipeline(LinearDiscriminantAnalysis(n_components=1),
                     LogisticRegression(random_state=17))
cv = StratifiedKFold(3, shuffle=True, random_state=17)
print("折內LDA三摺AUC", cross_val_score(pipe, X[tr], y[tr],
      cv=cv, scoring="roc_auc").tolist())
```
```text
折內LDA三摺AUC [1.0, 1.0, 1.0]
```

## 怎麼用、怎麼判讀

指引把 LDA 放在分類問題的線性降維；有標籤、希望壓縮特徵並保留類別差異時可考慮。沒有分類標籤就不能學這個目標，也不能拿它直接處理連續迴歸目標。

:::supplement[來源：scikit-learn Linear and Quadratic Discriminant Analysis；LinearDiscriminantAnalysis API]
輸出是新座標，不是原欄位清單。API 同時可做分類與降維；本頁用 transform，n_components 控制投影成分，並不是分類類別數。

常見 LDA 分類推導採類別條件高斯、共用共變異矩陣。資料不必完全線性可分，但非線性結構、樣本太少或共變異估計不穩，都可能降低效果。
:::

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 有分類標籤的高維資料 | 找線性分類投影 | 類間分離及類內集中 |
| 授信（補充） | 區分違約與未違約 | 二元分類最多一個判別方向 |
| 製造（補充） | 將振動等欄投影後分瑕疵 | 新批次只套已學好的方向 |
| 醫療（補充） | 比較多種診斷類別 | 類別少時成分上限很低 |

## 常見誤解

- LDA 只找變異最大方向：那是 PCA 的目標，LDA 要用類別資訊。
- 六欄資料就能取六個判別成分：二元分類最多一維。（補充）
- 投影圖分得開就證明泛化很好：方向也可能對訓練樣本過擬合，仍需獨立評估。（補充）

## 進階

### 二元分類也有投影（補充）

兩類只有一個獨立的類別差異方向，因此降維上限是一維。這仍可用來看分類訊號；若原資料本來只有一維，就沒有再減少欄數的空間。

### 參考來源

- 科目 3 指引 guide-3:5-6、3-14（版本未標示）：支持 LDA／PCA 目標與分類情境；未指定產業。
- [scikit-learn LDA 與 QDA 1.2.1～1.2.3](https://scikit-learn.org/stable/modules/lda_qda.html)：支持監督投影、分類假設及類別差異的目標。
- [Stanford EE368：Eigenimages，第 15 頁](https://web.stanford.edu/class/ee368/Handouts/Lectures/2013_Spring/14-EigenImages_16x9.pdf#page=15)：支持按類別筆數加權的類間散佈、逐點累加的類內散佈與 Fisher 準則；取實數一維投影後即為本頁的 B、W 與比值。
- [LinearDiscriminantAnalysis API](https://scikit-learn.org/stable/modules/generated/sklearn.discriminant_analysis.LinearDiscriminantAnalysis.html)：支持維度上限、fit／transform 及秩限制。
- [官方 PCA 與 LDA 投影教學](https://scikit-learn.org/stable/auto_examples/decomposition/plot_pca_vs_lda.html)：參考用同批點比較兩種投影的教法。
- [Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：支持訓練資料邊界。

## 小結

- LDA 用標籤找類間分離、類內集中的線性方向。
- PCA 看整體變異，兩者可能捨棄不同資訊。
- C 類的判別成分最多 C−1，還受輸入維度與秩限制。（補充）
- 方向只在訓練資料學習，新資料只做轉換。（補充）
