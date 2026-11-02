---
id: nonnegative-matrix-factorization
title: 非負矩陣分解
kind: technique
codes:
  - L23102
aliases:
  - NMF
  - Non-negative Matrix Factorization
summary: 用非負部件相加近似非負資料，並檢查重建與解釋限制
guide_refs:
  - guide-3:3-15
  - guide-3:3-20
requires:
  - matrix-factorization
is_a:
  - matrix-factorization
goals:
  - id: g1
    text: 以可驗算的非負因子解釋部件加法、近似誤差及適用條件
formula_groups:
  - id: nmf-parts
    source: guide-3:3-15
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: nmf-error
    source: https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.NMF.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 影像團隊把6張圖各取3個非負亮度值，做2部件NMF。哪個形狀與限制正確？
    options:
      A: W為6×2、H為2×3，兩者元素皆非負
      B: W為2×6、H為3×2，元素非負
      C: 資料可有負亮度，只要因子非負即可
      D: W與H一定正交
    answer: A
    explain:
      A: 乘積回到6×3，且各部件只相加。
      B: 內側維度不符，不能乘回6×3。
      C: 兩個非負矩陣的乘積不可能產生負元素。
      D: NMF加非負限制，沒有要求正交。
  - id: c2
    goal: g1
    type: choice
    prompt: 兩部件重建某訊號為(2,1,0)，觀測是(2,1,0.2)。只看這一列，平方重建誤差為何？
    options:
      A: "0.20"
      B: "0.04"
      C: "0.40"
      D: "0.00"
    answer: B
    explain:
      A: "0.20只取了第三格的絕對差，題目要求先平方再加總。"
      B: "只有第三格不同，平方重建誤差為0.2²＝0.04。"
      C: "0.40把差值乘以2，並非把0.2平方。"
      D: "非負不保證精確重建，第三格仍有0.2的差值，平方誤差不為零。"
  - id: c3
    goal: g1
    type: choice
    prompt: 指引把H稱為組合係數。程式以6×3的X擬合2部件NMF，若只對照H這個符號，應讀取哪個物件？
    options:
      A: fit_transform回傳值，形狀6×2
      B: model.components_，形狀6×2
      C: 輸入X，形狀6×3
      D: model.components_，形狀2×3
    answer: D
    explain:
      A: fit_transform回傳W，是六筆樣本的部件係數。
      B: components_是H，但其形狀是部件數乘特徵數。
      C: X是原始觀測表，並非分解因子。
      D: 符號H對應components_；本頁軸約定下每列是特徵部件，不能只照名稱猜樣本係數。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

詞頻、影像亮度或訊號強度常以非負數表示。若希望把它們解讀為「幾種部件相加」，含正負抵銷的因子可能不直觀。

非負矩陣分解（NMF，Non-negative Matrix Factorization）限制資料與因子都非負，讓每一筆近似值由部件的加法組合得到。

## 直覺

部件一強調第一個特徵，部件二強調第三個特徵。樣本可以只含某個部件，也可以同時含兩者；中間特徵可能由兩者共同貢獻。

![第三筆由兩個部件相加，三個特徵重建為二、二、二，沒有負數抵銷。](figure:l23102-nonnegative-matrix-factorization-parts)

## 定義與公式

對非負的 $n\times d$ 矩陣 $X$：

$$
X\approx WH,\qquad W\ge0,\quad H\ge0
$$

不等號表示每個元素都非負。$k$ 為部件數，$W$ 形狀為 $n\times k$，$H$ 為 $k\times d$；樣本放在橫列，因此本頁把 $W$ 讀成樣本係數、$H$ 的每列讀成部件。

:::note[名稱與軸的對照]
指引3-15稱W為基底、H為組合係數；題目若沿用該名稱，先對應指引符號。實作時再看樣本軸：本頁的W每列對應一筆樣本，H每列對應一個特徵部件。
:::

:::supplement[來源：scikit-learn NMF；Lee與Seung（1999）]
以平方誤差衡量近似時：

$$
E=\lVert X-WH\rVert_F^2=\sum_{i=1}^{n}\sum_{j=1}^{d}(X_{ij}-(WH)_{ij})^2
$$

$i$ 是樣本、$j$ 是特徵，$E$ 是各格誤差平方和。實作也可選其他損失或正則化，本頁只用這一種誤差。
:::

## 算一次（補充）

共用JSON的nmf_parts另附可手算的非負部件。六筆三特徵，前兩個部件為：

$$
H=\begin{bmatrix}2&1&0\\0&1&2\end{bmatrix}
$$

前3筆的係數依序為 $(1,0)$、$(0,1)$、$(1,1)$。相乘得到：

| 樣本 | 部件係數 | 重建三特徵 |
|---|---|---|
| 01 | $(1,0)$ | $(2,1,0)$ |
| 02 | $(0,1)$ | $(0,1,2)$ |
| 03 | $(1,1)$ | $(2,2,2)$ |

第三筆就是 $(2,1,0)+(0,1,2)=(2,2,2)$。這張表既可當非負感測反應，也可當三個像素的亮度；不是醫療測量的實際部件。

### 加一點雜訊（補充）

把第一筆第三格從0改成0.2，原因子仍重建為0。固定原因子的全表誤差只有這格，$E=0.2^2=0.04$。

重新擬合兩個非負因子後，程式得到SSE約0.005974，仍不為零。因子可能改變，也不保證回到我們原先命名的兩個部件。

## 程式（補充）

程式中的常數直接取自共用JSON，方便在獨立環境執行；欄位與列序維持相同。

```python
import numpy as np
from sklearn.decomposition import NMF
W0 = np.array([[1,0],[0,1],[1,1],[2,0],[0,2],[2,1]], dtype=float)
H0 = np.array([[2,1,0],[0,1,2]], dtype=float)
X = W0 @ H0
X[0, 2] += 0.2
model = NMF(n_components=2, init="random", random_state=23102, max_iter=5000, tol=1e-8)
W = model.fit_transform(X)
H = model.components_
print("形狀", W.shape, H.shape)
print("非負", bool((W >= 0).all() and (H >= 0).all()))
print("平方誤差", round(float(np.sum((X-W@H)**2)), 6))
```
```text
形狀 (6, 2) (2, 3)
非負 True
平方誤差 0.005974
```

:::tip[讀碼重點]
fit_transform回傳W，components_才是H。固定種子是為了重現初始化；套件或求解器版本改變時，末位誤差與因子可能略變。
:::

## 怎麼用、怎麼判讀

先確認數值非負，再問加法部件有沒有領域意義。文件的詞頻可加，影像的非負亮度可加；中心化後的正負偏差不能直接丟入本頁NMF。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 文件主題 | 非負文件×詞表 | 部件是詞群權重，不自動是機率 |
| 生物訊號 | 非負強度或表現量 | 原始腦波若帶正負，先確認表示 |
| 影像與社群 | 非負亮度或互動量 | 觀察部件與結構的對應 |
| 製程反應（補充） | 非負感測反應量 | 測量值要符合加法解釋 |
| 音訊頻譜（補充） | 非負頻譜幅度 | 部件可能對應聲音型態 |

:::supplement[來源：scikit-learn Decomposition 2.5.7]
非負不保證稀疏，也不保證可解釋性或唯一解。若需要少量非零係數，需另加稀疏限制並驗證；不能把指引的「自然引入稀疏性」讀成保證。

指引3-20可行域段把NMF參數寫成「正數」，精確限制應為非負，0也允許；這與3-15的非負公式一致。
:::

## 常見誤解

- 部件數為2就一定零誤差：資料不一定能由兩個非負部件精確表示。（補充）
- 每列係數會加總為1：非負限制沒有要求機率正規化。（補充）
- 用任何非負值都能得到真實主題：仍要檢查重建、穩定性與領域意義。（補充）

## 進階

### 參考來源

- 科目3學習指引3-15（guide-3:3-15）：非負公式、文件／生物訊號／影像／社群場景；已讀PDF頁22。
- 科目3學習指引3-20（guide-3:3-20）：可行域的非負條件；本頁校正「正數」用語，0仍合法。
- [scikit-learn NMF](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.NMF.html)：程式、形狀與誤差。
- [scikit-learn分解指南2.5.7](https://scikit-learn.org/stable/modules/decomposition.html#nmf)：限制與稀疏性校正。
- [Lee與Seung（1999）](https://www.cs.columbia.edu/~blei/fogm/2020F/readings/LeeSeung1999.pdf)：部件加法的原始論文。
- [官方主題擷取教學](https://scikit-learn.org/stable/auto_examples/applications/plot_topics_extraction_with_nmf_lda.html)：文件表與部件的講解方式；本頁使用自編資料。

## 小結

- NMF把非負資料近似為兩個非負因子的乘積。
- 樣本係數與部件形狀須能乘回原表，且只有加法組合。
- 重建誤差、稀疏性與可解釋性需分開檢查。
