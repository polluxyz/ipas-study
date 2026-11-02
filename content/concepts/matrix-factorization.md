---
id: matrix-factorization
title: 矩陣分解與低秩結構
kind: theory
codes:
  - L23102
aliases:
  - Low-rank Approximation
  - Matrix Factorization
summary: 把資料拆成較小因子，辨認可重建的潛在結構與壓縮代價
guide_refs:
  - guide-3:3-13
requires:
  - matrix-operations
goals:
  - id: g1
    text: 判斷分解因子的形狀，分清精確低秩結構與有資訊損失的近似
formula_groups:
  - id: factor-shapes
    source: https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/singular-value-decomposition/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠有 600 筆、30 特徵，擬用 5 個潛在方向表示。哪組形狀能乘回原資料？
    options:
      A: 600×5 與 5×30
      B: 5×600 與 30×5
      C: 600×30 與 5×5
      D: 600×5 與 30×5
    answer: A
    explain:
      A: 共同維度是5，乘積為600×30。
      B: 內側維度600與30不同，無法直接相乘。
      C: 內側維度30與5不符。
      D: 第二個因子的方向反了，內側維度不一致。
  - id: c2
    goal: g1
    type: choice
    prompt: 某醫療資料原為 6×3，精確秩為 2。存兩因子需 6×2＋2×3＝18 個數，原表也有18個數，應如何判讀？
    options:
      A: "分成兩個因子後只需存其中一個，因此18個數可減為9個"
      B: "秩為2表示6筆病人中只有2筆有效，其餘4筆應從原資料刪除"
      C: 可精確重建，但此小例未節省數值個數
      D: "保留秩1仍能完整重建，因為矩陣原本只有3個特徵"
    answer: C
    explain:
      A: "重建需要同時保留兩個因子，本例的總數仍是18，不能只存一個因子。"
      B: "秩是獨立方向數，不是有效病人數，不能據此刪除其餘病人。"
      C: 形狀縮小不代表總儲存量必減，精確秩2仍能重建。
      D: "原資料的精確秩是2，秩至多1的乘積無法完整重建，與原表有3欄無關。"
textbook: v2
author: codex
status: draft
---

## 為什麼需要

三個感測器可能重複反映同一種製程變化。矩陣分解（MF，Matrix Factorization）把原資料改寫成幾個因子，讓重複資訊與潛在特徵更容易辨認。

指引將它用在高維、資訊冗餘與運算負擔大的資料。壓縮之後能否完整重建，取決於資料結構與保留的方向數。

## 直覺

把每筆資料看成幾種共同模式的組合。一個因子記錄「每筆用了多少模式」，另一個因子記錄「每個模式包含哪些特徵」。

![六筆三特徵拆為六筆兩方向與兩方向三特徵，內側的兩個方向必須對齊。](figure:l23102-matrix-factorization-shapes)

### 共用資料（補充）

本組使用製程與醫療教學合成資料，各六筆、三特徵，列序固定為01至06。完整數字存在 L23102-B-matrices.json；所有分解比較均沿用同一列序。

製程欄位依序為溫度、壓力、振動指數，均值為 $(10,20,5)$。減去均值後，前兩欄完全相同，因此第三個欄位不等於第三個獨立方向。

## 定義與公式

矩陣分解把資料寫成較小矩陣的乘積，讓因子表達潛在模式。下面補上形狀與精確重建的條件。

:::supplement[來源：MIT SVD 課程；Deep Learning 第2章]
對 $n$ 筆、$d$ 個特徵的實數矩陣：

$$
X\approx AB,\quad A\in\mathbb R^{n\times k},\quad B\in\mathbb R^{k\times d}
$$

$X$ 是原矩陣，$A$ 是每筆資料的係數，$B$ 是模式，$k$ 是保留方向數。相乘後仍為 $n\times d$；各因子的意義還要看採用哪一種分解。

秩（Rank）是線性獨立方向的數量。若 $X$ 的秩不超過 $k$，可找到精確乘積；若秩超過 $k$，乘積的秩至多 $k$，一定有損失。
:::

## 算一次（補充）

製程資料中心化後，以 $t$ 表共同變動、$z$ 表振動偏差：

$$
X_c=\begin{bmatrix}-2&-2&-1\\-1&-1&1\\0&0&-1\\0&0&1\\1&1&1\\2&2&-1\end{bmatrix}
$$

下標 $c$ 表已中心化，每列是一筆資料。用以下兩個因子即可精確重建：

$$
A=\begin{bmatrix}-2&-1\\-1&1\\0&-1\\0&1\\1&1\\2&-1\end{bmatrix},\qquad
B=\begin{bmatrix}1&1&0\\0&0&1\end{bmatrix}
$$

$A$ 第一列乘 $B$ 得到 $(-2,-2,-1)$；第三列 $(0,-1)$ 乘 $B$ 得到 $(0,0,-1)$。其餘列同樣算，故 $X_c=AB$。

### 少留一個方向（補充）

只保留 $t$，重建每列變成 $(t,t,0)$。第三欄原本六個值都是 $\pm1$，平方誤差合計為6，這就是資訊損失。

原資料有18個數；秩2的兩因子共 $6\times2+2\times3=18$ 個數，小例沒有節省儲存量。若改成秩1則只需9個數，代價是無法重建振動。

## 程式（補充）

程式中的常數直接取自共用JSON，方便在獨立環境執行；欄位與列序維持相同。

```python
import numpy as np
X = np.array([
    [8,18,4], [9,19,6], [10,20,4],
    [10,20,6], [11,21,6], [12,22,4]])
Xc = X - X.mean(axis=0)
A = Xc[:, [0, 2]]
B = np.array([[1, 1, 0], [0, 0, 1]])
print("形狀", Xc.shape, A.shape, B.shape)
print("秩與精確重建", np.linalg.matrix_rank(Xc), np.allclose(Xc, A @ B))
R1 = A[:, :1] @ B[:1]
print("秩1平方誤差", round(float(np.sum((Xc - R1)**2)), 4))
```
```text
形狀 (6, 3) (6, 2) (2, 3)
秩與精確重建 2 True
秩1平方誤差 6.0
```

## 怎麼用、怎麼判讀

先問要分解哪個矩陣，再問要保留哪些資訊。本單元的特徵值分解限定在對稱方陣；奇異值分解可處理長方形；非負矩陣分解另加非負限制。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 高維壓縮 | 欄位多且有冗餘 | 檢查重建誤差與運算成本 |
| 製程感測（補充） | 兩欄共享變動 | 潛在模式不等於物理原因 |
| 醫療指數（補充） | 第二欄偏差為第一欄兩倍 | 兩欄只提供一個獨立方向 |
| 文件表示（補充） | 文件與詞彙矩陣 | 潛在方向需另作語意解讀 |

## 常見誤解

- 因子形狀較小，不代表總儲存量必減；兩因子都要計入。（補充）
- 低秩不等於少樣本，秩計算的是獨立方向。（補充）
- 潛在方向是數學表示，沒有自動獲得因果意義。（補充）

## 進階

### 因子不是唯一答案（補充）

同時把 $A$ 某欄乘2、把 $B$ 對應列除2，乘積仍不變。因此不能僅因兩次分解的因子數字不同，就認定重建結果不同。

### 參考來源

- 科目3學習指引3-13（guide-3:3-13）：為什麼需要、直覺與高維資料條件。
- [MIT SVD 課程](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/singular-value-decomposition/)：定義與公式、低秩近似的教學順序。
- [Deep Learning 第2章](https://www.deeplearningbook.org/contents/linear_algebra.html)：因子乘積、形狀與線性相依；本頁數字為自行設計。

## 小結

- 因子內側維度一致，才能乘回原資料形狀。
- 保留方向至少涵蓋原秩，才可能精確重建。
- 降低秩通常伴隨資訊取捨，要量測重建誤差。
