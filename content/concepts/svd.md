---
id: svd
title: 奇異值分解與截斷近似
kind: technique
codes:
  - L23102
  - L23202
  - L23301
aliases:
  - LSA
  - SVD 的特徵壓縮用途
  - Singular Value Decomposition
  - Truncated SVD
  - singular-value-decomposition
summary: 將任意實數矩陣拆為方向與縮放，再以截斷交換資訊和成本
guide_refs:
  - guide-3:3-14
  - guide-3:5-6
requires:
  - matrix-factorization
  - eigenvalue-decomposition
is_a:
  - matrix-factorization
goals:
  - id: g1
    text: 辨認完整與精簡 SVD 的形狀，計算秩一重建與誤差
  - id: g2
    text: 由中心化資料的奇異值算協方差特徵值及保留變異比例
  - id: g3
    text: 依文字、推薦與影像資料說明低秩表示的用途
formula_groups:
  - id: svd-reconstruction
    source: guide-3:3-14
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: svd-truncation
    source: https://www.cs.ox.ac.uk/people/varun.kanade/teaching/ML-MT2017/lectures/lecture17.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23102-B
  - id: svd-pca-variance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 有6筆、3特徵，精簡SVD要保留全部3個奇異值。U、Σ、Vᵀ的形狀是哪一組？
    options:
      A: 6×6、3×3、3×3
      B: 6×3、6×3、3×3
      C: 6×3、3×3、3×3
      D: 3×6、3×3、3×3
    answer: C
    explain:
      A: 完整U需搭配6×3的Σ，此組乘法不符。
      B: U後方應接3×3，否則共同維度不同。
      C: 6×3乘3×3再乘3×3，重建為6×3。
      D: 第一個因子的方向反了，無法相乘。
  - id: c2
    goal: g2
    type: choice
    prompt: 6筆資料已中心化，三個奇異值平方為20、6、0。第一個協方差特徵值與保留比例為何？
    options:
      A: 20與20/6
      B: 4與20/26
      C: 4與4/6
      D: 20/6與20/26
    answer: B
    explain:
      A: 協方差須除以5，比例分母須加總全部平方。
      B: 特徵值20/5=4，比例20/(20+6)=20/26。
      C: 4/6把樣本數誤當變異總和。
      D: 樣本協方差分母為n−1，即5。
  - id: c3
    goal: g3
    type: choice
    prompt: 圖書館有1000份文件、5000個詞彙的稀疏表，欲壓成50維語意表示。哪個說法最恰當？
    options:
      A: "SVD只適用方陣，須先把1000×5000的詞頻表補成5000×5000"
      B: "50個奇異方向各對應一個已命名主題，不必再看詞彙權重"
      C: "稀疏表的0都代表詞頻缺失，須先用每欄平均值填補"
      D: "可用截斷SVD將文件壓成50維，再依詞彙權重解讀語意"
    answer: D
    explain:
      A: "SVD能處理長方形矩陣，原來1000×5000的表不必補成方陣。"
      B: "奇異方向是詞彙的數學組合，不能直接認定為已命名的人工主題。"
      C: "詞頻表的0是未出現的有效計數，不是必須填平均值的缺失資料。"
      D: "LSA可用截斷SVD得到50維文件表示，方向的語意仍需由詞彙權重等證據解讀。"
textbook: v2
author: codex
status: draft
---

## 為什麼需要

奇異值分解（SVD，Singular Value Decomposition）可處理任意實數矩陣，包含六筆三特徵的長方形資料。

指引以它串起資料降維、推薦系統、潛在語意分析與影像壓縮。保留較少方向時，得到的是原矩陣的低秩近似。

## 直覺

先用右奇異方向重組特徵，再依奇異值縮放，最後由左奇異方向組合回樣本空間。截斷就是只留前幾組配對方向與倍數。

![製程資料只有兩個非零奇異值，保留第一個仍有六單位平方重建誤差。](figure:l23102-svd-spectrum)

## 定義與公式

對 $X\in\mathbb R^{n\times d}$：

$$
X=U\Sigma V^\top
$$

$n$ 是樣本數，$d$ 是特徵數，各因子的意義如下：

- $U$：左奇異向量矩陣；每欄是樣本空間的一個方向，每列對應一筆樣本。
- $V$：右奇異向量矩陣；每欄是特徵空間的一個方向，各分量對應原特徵。
- $\Sigma$：對角線放非負奇異值 $\sigma_i$，由大到小排列。

| 物件 | 完整SVD形狀 | 六筆三特徵 |
|---|---|---|
| $U$ | $n\times n$ | $6\times6$ |
| $\Sigma$ | $n\times d$ | $6\times3$ |
| $V^\top$ | $d\times d$ | $3\times3$ |

:::supplement[來源：NumPy svd]
完整形式的U與V是正交矩陣；精簡形式的欄仍為互相正交的單位向量。

精簡SVD取 $p=\min(n,d)$，三者形狀為 $n\times p$、$p\times p$、$p\times d$。

本例的U改為六筆三方向，Σ改為三方向的對角矩陣，Vᵀ仍為三乘三；乘積仍能完整重建。
:::

![把樣本係數與特徵模式相乘，可重建六筆三特徵的資料形狀。](figure:l23102-matrix-factorization-shapes)

### 截斷與誤差（補充）

$$
X_k=U_k\Sigma_kV_k^\top,\qquad
\lVert X-X_k\rVert_F^2=\sum_{i=k+1}^{p}\sigma_i^2
$$

$k$ 是滿足 $1\le k\le p$ 的整數；$U_k$ 取前 $k$ 欄，形狀為 $n\times k$；$V_k^\top$ 取前 $k$ 列，形狀為 $k\times d$。

$$
\Sigma_k=\operatorname{diag}(\sigma_1,\ldots,\sigma_k)\in\mathbb R^{k\times k}
$$

$\Sigma_k$ 只留前 $k$ 個奇異值。Frobenius範數平方是所有格子的誤差平方和，記為SSE。

### 和協方差的連結（補充）

對已中心化的 $X_c$、$n>1$：

$$
\lambda_i=\frac{\sigma_i^2}{n-1},\qquad
\rho_i=\frac{\sigma_i^2}{\sum_j\sigma_j^2}
$$

$\lambda_i$ 是樣本協方差特徵值，$\rho_i$ 是解釋變異比例。分母總變異須大於零；未中心化SVD的平方比例不能直接解讀為PCA的變異比例。

## 算一次（補充）

沿用矩陣分解頁的製程中心化矩陣 $X_c$。第一、二欄是 $t=(-2,-1,0,0,1,2)^\top$，第三欄是 $z=(-1,1,-1,1,1,-1)^\top$。

兩方向內積為零，平方長度分別為10與6。第一方向的奇異值可由兩側向量長度相乘：

$$
\sigma_1=\lVert t\rVert_2\lVert(1,1,0)\rVert_2=\sqrt{10}\sqrt2=\sqrt{20}
$$

下標2表示向量長度。重複的 $t$ 欄因此提供20的平方量，三個奇異值是 $\sqrt{20}$、$\sqrt6$、0。

### 秩一重建（補充）

第一組方向可選 $u_1=t/\sqrt{10}$、$v_1=(1,1,0)^\top/\sqrt2$，配對 $\sigma_1=\sqrt{20}$。

$$
X_1=\sigma_1u_1v_1^\top
$$

第一列等於 $(-2,-2,0)$，原列是 $(-2,-2,-1)$。每列只漏掉第三欄的 $\pm1$，所以SSE為6；也等於被捨棄的 $\sigma_2^2+\sigma_3^2=6+0$。

### 三個值逐一核對（補充）

| 方向 | 奇異值平方 | 特徵值：除以5 | 解釋比例 |
|---|---|---|---|
| 1 | 20 | 4 | $20/26=76.9231\%$ |
| 2 | 6 | 1.2 | $6/26=23.0769\%$ |
| 3 | 0 | 0 | 0 |

保留兩方向時累積比例為100%，也正好精確重建這組秩2資料。這不代表任意三欄資料只要兩方向都夠用。

## 程式（補充）

程式中的常數直接取自共用JSON，方便在獨立環境執行；欄位與列序維持相同。

```python
import numpy as np
X = np.array([
    [8,18,4], [9,19,6], [10,20,4],
    [10,20,6], [11,21,6], [12,22,4]])
Xc = X - X.mean(axis=0)
U, s, Vt = np.linalg.svd(Xc, full_matrices=False)
Uf, sf, Vtf = np.linalg.svd(Xc, full_matrices=True)
print("完整與精簡U", Uf.shape, U.shape)
print("奇異值", s.round(4).tolist())
print("特徵值", (s**2 / (len(X)-1)).round(4).tolist())
print("比例", (s**2 / np.sum(s**2)).round(4).tolist())
print("秩1誤差", round(float(np.sum((Xc-(U[:, :1]*s[:1])@Vt[:1])**2)), 4))
print("完整重建", np.allclose((U*s)@Vt, Xc))
```
```text
完整與精簡U (6, 6) (6, 3)
奇異值 [4.4721, 2.4495, 0.0]
特徵值 [4.0, 1.2, 0.0]
比例 [0.7692, 0.2308, 0.0]
秩1誤差 6.0
完整重建 True
```

:::tip[讀碼重點]
NumPy回傳的是Vt與一維s，不是V與對角矩陣。U*s利用廣播把每欄乘對應奇異值；浮點計算的零可能只接近零。
:::

## 怎麼用、怎麼判讀

用原矩陣的重建誤差衡量壓縮，用下游任務成績衡量表示是否有用。主成分分析可用中心化後的SVD實作，右奇異方向就是主成分方向。

指引也強調SVD的數值穩定性，適合直接從資料求分解。

:::supplement[來源：scikit-learn PCA 的 full 與 covariance_eigh 求解器說明]
相較先形成 $X_c^\top X_c$ 再求特徵值，直接SVD可避免這一步進一步放大病態資料的數值誤差。這個比較尤其適用於奇異值大小差距很大的資料，不表示所有SVD近似演算法都有相同精度。
:::

### 低秩因子怎麼用

推薦把橫列看成使用者、直欄看成項目；LSA則把橫列看成文件、直欄看成詞彙。兩者都用較少潛在方向描述原本的大表。

:::supplement[來源：scikit-learn 分解指南2.5.3；MIT SVD 課程]
推薦表的 $U_k\Sigma_k$ 每列是一名使用者，$V_k$ 每列是一個項目，兩者都有 $k$ 維。內積近似原表偏好，可比較候選分數；缺失評分須另行處理。

文件×詞彙表採相同形狀：$U_k\Sigma_k$ 每列表示文件，$V_k$ 每列表示詞彙。內積近似該文件的詞權重，文件向量之間可再比較餘弦相似度，用於檢索；方向仍須語意解讀。
:::

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 推薦 | 使用者×項目 | 低秩因子表示潛在偏好 |
| 潛在語意分析（LSA） | 文件×詞彙 | 用低維組合表示共現關係 |
| 影像壓縮 | 像素亮度矩陣 | 留較大奇異值以近似影像 |
| 製程感測（補充） | 多個相關欄位 | 比較截斷前後重建誤差 |
| 醫療探索（補充） | 六筆三指數 | 未縮放時第一比例為89.2857% |

:::supplement[來源：scikit-learn Decomposition 2.5.3]
稀疏文字表可用不中心化的TruncatedSVD保留稀疏處理的優勢；它不等於先中心化的PCA。推薦表的缺失評分也不自動等於零評價，需另設觀測權重或模型。
:::

## 常見誤解

- 奇異值是協方差特徵值：中心化後仍須平方並除以 $n-1$。（補充）
- 精簡SVD等於截斷：精簡可保留全部 $p$ 個方向，截斷才捨去後段。（補充）
- 方向符號不同就是錯：成對反號不改變重建乘積。（補充）

## 進階

### 最佳近似的界線（補充）

截斷SVD在無其他限制的Frobenius誤差下提供最佳秩至多 $k$ 的近似。這不是分類損失、非負限制或只看已觀測評分時的最佳解保證。

### 參考來源

- 科目3學習指引3-14、5-6（guide-3:3-14、guide-3:5-6）：完整形狀、降維與推薦／LSA／影像情境；已讀PDF頁21。
- [NumPy svd](https://numpy.org/doc/stable/reference/generated/numpy.linalg.svd.html)：精簡形狀與程式。
- [MIT SVD 課程](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/singular-value-decomposition/)：秩一組合、截斷與誤差。
- [Oxford PCA講義第2～3節](https://www.cs.ox.ac.uk/people/varun.kanade/teaching/ML-MT2017/lectures/lecture17.pdf)：秩一分解、Frobenius截斷誤差與最佳低秩近似。
- [scikit-learn PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)：樣本變異、中心化SVD的連結與求解器穩定性比較。
- [scikit-learn 分解指南2.5.3](https://scikit-learn.org/stable/modules/decomposition.html#truncated-singular-value-decomposition-and-latent-semantic-analysis)：文字表示與不中心化的差異。

## 小結

- SVD允許長方形，完整與精簡形式都可重建原矩陣。
- 截斷保留前幾組方向，平方重建誤差等於捨棄的奇異值平方和。
- 只有中心化後，才直接把奇異值平方比例對到PCA解釋變異。
