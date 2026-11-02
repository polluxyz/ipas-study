---
id: eigenvalue-decomposition
title: 特徵值分解
kind: theory
codes:
  - L23102
aliases:
  - Eigen Decomposition
  - Eigenvalue Decomposition
  - 特徵向量
summary: 用保持方向的向量與伸縮倍數，描述對稱矩陣的作用
guide_refs:
  - guide-3:3-13
  - guide-3:3-14
requires:
  - linear-transformation
formula_groups:
  - id: eigenvector-check
    source: https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/lecture-21-eigenvalues-and-eigenvectors/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: symmetric-eigen
    source: guide-3:3-13
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
goals:
  - id: g1
    text: 驗算特徵向量與特徵值，並在對稱前提下乘回正交分解
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工程師用 A=[[2,1],[1,2]] 轉換向量 v=(1,1)。哪個特徵值能通過 Av=λv 的檢查？
    options:
      A: "1"
      B: "3"
      C: "2"
      D: "0"
    answer: B
    explain:
      A: Av為(3,3)，不是(1,1)。
      B: Av=(3,3)=3v，所以倍數為3。
      C: 只看對角線2會漏掉另一個分量的貢獻。
      D: 倍數0代表Av為零，與實算不符。
  - id: c2
    goal: g1
    type: choice
    prompt: 醫院取得 3×3 的實數對稱協方差矩陣，準備使用 QΛQᵀ。哪項說法正確？
    options:
      A: 任意3×2資料矩陣都能直接照用
      B: "Q的欄可選任意3個正交單位方向，Λ仍放原矩陣特徵值"
      C: "協方差矩陣若含負相關，Λ就一定含負的特徵值"
      D: Q的欄是正交單位特徵向量，Λ放對應特徵值
    answer: D
    explain:
      A: 這個正交形式要求方陣且對稱。
      B: "方向還必須是與Λ對應的特徵向量，任意正交單位方向不保證重建原矩陣。"
      C: "負相關不等於負特徵值；協方差矩陣為半正定，特徵值仍非負。"
      D: 配對方向與倍數才能重建原矩陣。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

一個矩陣可能同時混合多個座標。特徵值分解（EVD，Eigenvalue Decomposition）找出在變換後仍沿原直線的方向，再記錄每個方向的伸縮倍數。

指引把這個觀點用於主成分分析與線性判別分析。本頁先學對稱矩陣的分解，後續再把它用於資料的協方差矩陣。

## 直覺

沿特徵方向輸入一個箭頭，矩陣作用後仍落在同一條直線。特徵值決定放大、縮小或反向；方向和倍數必須成對理解。

![對稱矩陣將同向分量伸長三倍，差值方向 (1,−1) 維持一倍，兩個特徵方向互相垂直。](figure:l23102-eigenvalue-decomposition-directions)

## 定義與公式

:::supplement[來源：MIT Lecture 21 Eigenvalues and eigenvectors]
$$
Av=\lambda v,\qquad v\ne0
$$

$A$ 是方陣，$v$ 是非零特徵向量（Eigenvector），$\lambda$ 是對應特徵值（Eigenvalue）。零向量不能用來辨認方向。
:::

本頁限定 $A$ 為 $d\times d$ 的實數對稱矩陣，亦即 $A=A^\top$。此時可寫成：

$$
A=Q\Lambda Q^\top
$$

$Q$ 的每欄是一個正交單位特徵向量，$\Lambda$ 對角線放配對的特徵值，$Q^\top$ 是轉置。三個矩陣都是 $d\times d$。

:::supplement[來源：NumPy eigh；Deep Learning 2.7]
正交表示 $Q^\top Q=I$，$I$ 是單位矩陣。一般非對稱方陣不一定能用這個形式；不要把「特徵分解」都當作「正交分解」。
:::

## 算一次（補充）

共用資料另附二維對稱小例，方便手算：

$$
A=\begin{bmatrix}2&1\\1&2\end{bmatrix},\quad
v_1=\begin{bmatrix}1\\1\end{bmatrix},\quad
v_2=\begin{bmatrix}1\\-1\end{bmatrix}
$$

乘回可得 $Av_1=(3,3)^\top=3v_1$，以及 $Av_2=(1,-1)^\top=v_2$。因此特徵值是3與1；兩向量內積 $1-1=0$，方向正交。

### 把分解乘回去（補充）

兩向量長度都是 $\sqrt2$，除以長度後得到 $Q$ 的兩欄：

$$
Q=\frac1{\sqrt2}\begin{bmatrix}1&1\\1&-1\end{bmatrix},\quad
\Lambda=\begin{bmatrix}3&0\\0&1\end{bmatrix}
$$

完整乘回一次：

$$
Q\Lambda Q^\top=\frac12\begin{bmatrix}4&2\\2&4\end{bmatrix}
=\begin{bmatrix}2&1\\1&2\end{bmatrix}
$$

這個小例不是製程資料的協方差矩陣。製程中心化矩陣的協方差特徵值是4、1.2、0，最大方向是 $(1,1,0)^\top/\sqrt2$。

## 程式（補充）

```python
import numpy as np
A = np.array([[2., 1.], [1., 2.]])
values, Q = np.linalg.eigh(A)
order = np.argsort(values)[::-1]
values, Q = values[order], Q[:, order]
print("特徵值", values.round(4).tolist())
print("逐方向驗算", np.allclose(A @ Q, Q * values))
print("正交", np.allclose(Q.T @ Q, np.eye(2)))
print("重建", np.allclose((Q * values) @ Q.T, A))
```
```text
特徵值 [3.0, 1.0]
逐方向驗算 True
正交 True
重建 True
```

:::tip[讀碼重點]
eigh 回傳的特徵值由小到大，排序時向量欄也要一起換。特徵向量可能整欄反號；驗算方向關係與重建，比死記正負號可靠。
:::

## 怎麼用、怎麼判讀

主成分分析分解協方差矩陣，以特徵向量決定投影方向，以特徵值描述沿該方向的變異。只有矩陣具有協方差意義時，才把特徵值讀成變異。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| PCA | 實數對稱協方差矩陣 | 找最大變異方向 |
| LDA | 比較類間與類內散布 | 目標是分類差異 |
| 製程感測（補充） | 相關感測欄位 | 共變動方向不等於設備故障原因 |
| 醫療探索（補充） | 年齡與血壓相關 | 大變異方向不一定最能辨識疾病 |

## 常見誤解

- 任意長方形都能套此式：不行，原資料可以長方形，但本頁分解的是對稱方陣。
- 特徵值越大就越能分類：只有最大變異，並沒有用到標籤。（補充）
- 特徵向量長度固定：任意非零倍數仍是特徵向量，組成正交矩陣時才取單位長度。（補充）

## 進階

### 重複特徵值（補充）

若多個方向共享相同特徵值，該子空間內可以選不同正交基底。此時兩次求解器回傳不同方向，仍可能都正確。

### 參考來源

- 科目3學習指引3-13～3-14（guide-3:3-13、guide-3:3-14）：對稱分解、幾何與PCA／LDA用途；已讀PDF頁20、21。
- [NumPy eigh](https://numpy.org/doc/stable/reference/generated/numpy.linalg.eigh.html)：程式、排序與適用矩陣。
- [MIT Lecture 21](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/resources/lecture-21-eigenvalues-and-eigenvectors/)：定義與公式、手算驗證的教學方式。
- [Deep Learning 2.7](https://www.deeplearningbook.org/contents/linear_algebra.html)：適用前提及重複特徵值。

## 小結

- 特徵向量經矩陣作用仍沿同一條直線，特徵值是倍數。
- 實數對稱矩陣可選正交單位特徵向量來重建。
- 用協方差矩陣時，特徵值才可解讀為方向變異。
