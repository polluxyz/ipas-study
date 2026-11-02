---
id: matrix-operations
title: 矩陣乘法、轉置與偽逆
kind: theory
codes:
  - L23102
aliases:
  - Matrix Multiplication
  - Pseudo-Inverse
  - Transpose
  - 反矩陣
summary: 矩陣乘法組合特徵，轉置交換軸，偽逆處理一般最小平方問題
goals:
  - id: g1
    text: 計算矩陣乘法與轉置，說明相乘順序的限制
  - id: g2
    text: 驗算逆矩陣，判斷不可逆情況並區分偽逆的用途
requires:
  - matrix-shapes
guide_refs:
  - guide-3:3-10
  - guide-3:3-11
textbook: v2
author: codex
status: draft
formula_groups:
  - id: matrix-product-transpose
    source: https://www.deeplearningbook.org/contents/linear_algebra.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-A
  - id: inverse-pseudoinverse
    source: https://www.deeplearningbook.org/contents/linear_algebra.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23102-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源批次取 2 筆、每筆 3 特徵得到 A（2×3），權重 B 為 3×2。哪個敘述正確？
    options:
      A: AB 與 BA 都是 2×2
      B: AB 是逐元素乘法
      C: (AB)ᵀ 等於 AᵀBᵀ
      D: BA 的形狀為 3×3
    answer: D
    explain:
      A: 反過來的外側尺寸是 3 與 3。
      B: AB 每個輸出是橫列與直欄的內積。
      C: 轉置整個乘積時要反轉順序。
      D: B 的 3 個橫列配 A 的 3 個直欄，結果為 3×3。
  - id: c2
    goal: g2
    type: choice
    prompt: 授信資料兩欄完全相同，A=[[1,1],[2,2]]，y=(2,4)。使用 pinv(A)@y 得到 (1,1)，應如何解釋？
    options:
      A: A 已變成可逆矩陣
      B: 它是多個零殘差解中 L2 範數最小的一個
      C: 偽逆保證所有未來資料都零誤差
      D: 偽逆只適用方陣
    answer: B
    explain:
      A: A 的兩欄仍然相依，沒有一般逆矩陣。
      B: 所有兩係數和為 2 的解都能擬合，(1,1) 的長度最小。
      C: 解方程或擬合資料不能保證未來誤差。
      D: 偽逆也定義在長方形矩陣上。
---

## 為什麼需要

矩陣乘法讓多筆資料一次通過同一組權重，轉置幫助交換樣本與特徵的排列。當要由資料反求參數時，還需要判斷能否使用逆矩陣。

指引把求逆與偽逆連到最小平方解。本頁先釐清它們能解什麼問題，完整的參數估計再接最小平方教材。

## 直覺

:::supplement[來源：Deep Learning 第 2.2 節]
計算乘積的一格時，拿左矩陣的一個橫列，配右矩陣的一個直欄做內積。每格都依同一規則算，便能將特徵合成新的輸出。
:::

轉置（Transpose）把橫列與直欄互換。它只是換排列，不代表把矩陣每一個數取倒數。

## 定義與公式

指引將乘法、轉置、逆矩陣與偽逆用於模型運算；以下補充逐項定義及求解條件。

:::supplement[來源：Deep Learning 第 2.1–2.2 節]
對 $A\in\mathbb R^{m\times d}$ 與 $B\in\mathbb R^{d\times k}$：

$$
C_{ij}=(AB)_{ij}=\sum_{t=1}^{d}A_{it}B_{tj},\qquad(A^\top)_{ji}=A_{ij}
$$

$i$ 是輸出橫列，$j$ 是輸出直欄，$t$ 是被加總的共同特徵索引。只有共同維度一致才能乘；轉置後形狀為 $d\times m$。

$$
(AB)^\top=B^\top A^\top
$$

上標 $\top$ 表轉置。乘積轉置需要倒轉相乘順序；一般情況不能把 $AB$ 與 $BA$ 當作相同。
:::

### 逆與偽逆

指引將求逆與偽逆用於最小平方等封閉解，並提到無法使用一般逆矩陣時的近似求解。

:::supplement[來源：Deep Learning 第 2.3、2.9 節]

對 $p\times p$ 方陣 $M$，一般逆矩陣 $M^{-1}$ 要滿足：

$$
MM^{-1}=M^{-1}M=I_p
$$

$I_p$ 是對角線為 1、其餘為 0 的單位矩陣。秩（Rank）是最多能取出的線性獨立直欄數；方陣須滿秩才可逆，否則有冗餘欄位。

一般矩陣 $A$ 的偽逆（Pseudoinverse）採 Moore–Penrose 定義，記為 $A^+$。

對目標向量 $y$，$\theta=A^+y$ 是最小平方解中 L2 範數最小的一個；$\theta$ 是待求參數，不是預測值。

這不表示 $A^+A$ 一定是單位矩陣，也不保證殘差為零。「近似求解」要依方程是否可解、解是否唯一來理解。
:::

## 算一次（補充）

取能源前兩筆與共用權重 $W_1$：

$$
A=\begin{bmatrix}1&2&3\\2&1&0\end{bmatrix},\quad
B=\begin{bmatrix}1&0\\2&1\\-1&2\end{bmatrix},\quad
AB=\begin{bmatrix}2&8\\4&1\end{bmatrix}
$$

例如左上格是 $1\cdot1+2\cdot2+3\cdot(-1)=2$，右上格是 $1\cdot0+2\cdot1+3\cdot2=8$。第二列依同法得到 4 與 1。

$A^\top$ 是 $3\times2$，乘積轉置如下：

$$
(AB)^\top=\begin{bmatrix}2&4\\8&1\end{bmatrix}=B^\top A^\top
$$

交換成 $BA$，形狀變成 $3\times3$，不可能與 $AB$ 相等。

### 驗算可逆與秩不足（補充）

取矩陣 $M$ 與候選逆矩陣 $N$：

$$
M=\begin{bmatrix}1&1\\0&1\end{bmatrix},\qquad
N=\begin{bmatrix}1&-1\\0&1\end{bmatrix}
$$

兩個方向相乘都得到 $I_2$，因此 $N=M^{-1}$。

再看兩欄完全重複的 $S$：秩只有 1，不能求一般逆矩陣，但有偽逆 $S^+$。

$$
S=\begin{bmatrix}1&1\\2&2\end{bmatrix},\qquad
S^+=\begin{bmatrix}0.1&0.2\\0.1&0.2\end{bmatrix}
$$

目標 $y=(2,4)$ 的解是 $S^+y=(1,1)$，代回即得 $y$。解 $(2,0)$ 也能零殘差，但長度 2 大於前者的 $\sqrt2$；此處皆省略欄向量上標。

即使同為方陣，也不保證能交換。用上述 $M,S$ 計算，$MS$ 的兩列是 $(3,3),(2,2)$，$SM$ 的兩列是 $(1,2),(2,4)$；形狀相同，數值仍不同。

## 程式（補充）

```python
import numpy as np
A = np.array([[1, 2, 3], [2, 1, 0]])
B = np.array([[1, 0], [2, 1], [-1, 2]])
print("乘積", (A @ B).tolist())
print("轉置", np.array_equal((A @ B).T, B.T @ A.T))
M = np.array([[1., 1.], [0., 1.]])
print("驗逆", np.allclose(M @ np.linalg.inv(M), np.eye(2)))
S = np.array([[1., 1.], [2., 2.]])
try:
    np.linalg.inv(S)
except np.linalg.LinAlgError:
    print("一般逆失敗")
print("偽逆", np.linalg.pinv(S).round(3).tolist())
print("參數", (np.linalg.pinv(S) @ [2., 4.]).round(3).tolist())
print("方陣順序", (M @ S).tolist(), (S @ M).tolist())
```
```text
乘積 [[2, 8], [4, 1]]
轉置 True
驗逆 True
一般逆失敗
偽逆 [[0.1, 0.2], [0.1, 0.2]]
參數 [1.0, 1.0]
方陣順序 [[3.0, 3.0], [2.0, 2.0]] [[1.0, 2.0], [2.0, 4.0]]
```

:::tip[讀碼重點]
整數乘積可精確比較；浮點求逆用 np.allclose 容許小誤差。實務解方程宜選 solve 或 lstsq，不必先顯式算逆矩陣。
:::

## 怎麼用、怎麼判讀

批次預測用乘法，交換軸用轉置，反求參數才涉及求解。遇到欄位重複或特徵冗餘，先辨認秩不足，不能只看到方陣就呼叫 inv。

### 換個場景

| 場景 | 指引用途或資料條件 | 判讀 |
|---|---|---|
| 批次預測、權重更新 | 矩陣可相乘 | 留意左右順序 |
| 最小平方 | 反求模型參數 | 檢查是否可逆與是否多解 |
| PCA 特徵轉換 | 協方差與矩陣分解 | 轉置有具體軸意義 |
| 能源資料（補充） | 兩感測欄位完全重複 | 欄相依會限制可識別參數 |
| 授信資料（補充） | 同收入欄位存了兩份 | 偽逆不能消除資料冗餘的原因 |

## 常見誤解

- 矩陣乘法不是對應格相乘。（補充）
- 方陣不保證可逆，滿秩才是關鍵。（補充）
- 偽逆不是把每個元素取倒數，也不保證恢復被壓掉的資訊。（補充）

## 進階

### 教材勘誤（補充）

指引 3-10 的「無法反矩陣時近似解決」不能理解成近似求逆。偽逆另有精確定義，並選出最小範數的最小平方解；殘差是否為零，要看方程是否可解。

### 參考來源

- 科目 3 指引 3.2，guide-3:3-10、guide-3:3-11（版本未標示）：支持運算用途及 PCA 場景。
- [Deep Learning 第 2.2、2.3、2.9 節](https://www.deeplearningbook.org/contents/linear_algebra.html)：支持乘法、轉置及最小範數解。
- [NumPy inv](https://numpy.org/doc/stable/reference/generated/numpy.linalg.inv.html)、[pinv](https://numpy.org/doc/stable/reference/generated/numpy.linalg.pinv.html)：支持程式與奇異矩陣處理。
- [Dive into Deep Learning 2.3](https://d2l.ai/chapter_preliminaries/linear-algebra.html)：參考逐格算例的教學安排。

## 小結

- 每個乘積元素是一個內積。（補充）
- 乘積轉置要倒序，矩陣乘法通常不能交換。（補充）
- 一般逆需滿秩方陣；偽逆可處理更一般的求解情境。（補充）
