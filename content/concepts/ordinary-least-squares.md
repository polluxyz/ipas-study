---
id: ordinary-least-squares
title: 最小平方估計與投影
kind: technique
codes:
  - L23102
aliases:
  - OLS
  - Ordinary Least Squares
  - 正規方程
summary: 找出殘差平方和最小的參數，把目標投影到模型可表示的空間
guide_refs:
  - guide-3:3-16
  - guide-3:3-17
requires:
  - matrix-operations
  - vector-inner-product
goals:
  - id: g1
    text: 由觀測與預測建立殘差平方和，並說明它和平均損失的關係
  - id: g2
    text: 判斷正規方程的可逆前提，處理共線欄位的最小平方解
  - id: g3
    text: 驗算目標投影與正交殘差，判斷離群值影響
formula_groups:
  - id: ols-objective
    source: https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/198bde3a6536b62989b6cc09495575c1_MIT18_06SCF11_Ses2.3sum.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: ols-solution
    source: https://www.deeplearningbook.org/contents/linear_algebra.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23102-B
  - id: ols-projection
    source: https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/198bde3a6536b62989b6cc09495575c1_MIT18_06SCF11_Ses2.3sum.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠前四筆耗材觀測為4、11、5、13，某組參數預測為3、11、7、13。這四筆的SSE為多少？
    options:
      A: "1.25"
      B: "3"
      C: −1
      D: "5"
    answer: D
    explain:
      A: 1.25是SSE除以4的平均平方誤差。
      B: 3是絕對誤差和1+0+2+0。
      C: 殘差和1+0−2+0為−1，並不是平方和。
      D: 平方後加總1+0+4+0=5。
  - id: c2
    goal: g2
    type: choice
    prompt: 設計矩陣有截距與兩欄完全相同的特徵，最適係數和需為2。哪個處理合理？
    options:
      A: 用lstsq或偽逆取得最小範數係數1與1
      B: 直接求(XᵀX)的一般逆，因樣本有6筆
      C: 係數只能是2與0
      D: 沒有一般逆就代表不存在最小平方解
    answer: A
    explain:
      A: 兩係數和為2有多解，1與1是最小範數的一個。
      B: 重複欄造成秩不足，樣本多不能自動修復。
      C: 2與0也可能擬合，但不是唯一解。
      D: 秩不足仍存在最小平方解，只是不唯一。
  - id: c3
    goal: g3
    type: choice
    prompt: 六筆資料含截距，最小平方殘差是(1,0,−2,0,0,1)。下列何者符合投影解釋？
    options:
      A: 殘差每一格都必須為0
      B: 殘差與設計矩陣每個欄向量內積為0
      C: 把三維輸入點投到任意平面即可得到OLS
      D: 單一離群值變大也不影響平方和
    answer: B
    explain:
      A: 最小平方允許無法消除的殘差。
      B: 正交條件是Xᵀr=0，殘差和也因截距而為0。
      C: 投影對象是觀測目標y，空間由設計矩陣欄向量張成。
      D: 平方會放大大殘差的影響。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

知道模型的線性形式後，還要決定參數。最小平方估計（OLS，Ordinary Least Squares）尋找一組參數，讓觀測值與預測值之差的平方總和最小。

本頁專談如何求解與理解投影。完整線性模型的假設、推論與選用，另見線性迴歸。

## 直覺

最小平方也能從投影理解：讓模型可表示的預測靠近觀測，留下不能消除的差異。

![目標y分成可表示的預測與垂直殘差，這是觀測空間的示意截面。](figure:l23102-ordinary-least-squares-projection)

:::supplement[來源：MIT Lecture 16]
把六筆觀測目標排成一個六維向量。模型只能用設計矩陣的欄向量組出部分六維向量，OLS便在這個可表示空間內，找最接近目標的位置。

圖中的空間由設計矩陣的直欄張成，以下稱「欄空間」。指引的投影敘述應精確理解為目標 $y$ 投到此空間，不是把輸入特徵點任意壓到一個平面。
:::

## 定義與公式

指引以觀測與預測之差的平方和定義最小平方。以下補充矩陣記法，讓每筆殘差與整批求解對應起來。

:::supplement[來源：MIT Lecture 16]
為了和原資料 $X$ 區分，含截距的設計矩陣記為 $D\in\mathbb R^{n\times p}$；$n$ 是觀測筆數，$p$ 是參數個數。

$$
\widehat y=D\beta,\quad r=y-D\beta,\quad
\widehat\beta=\arg\min_{\beta}\sum_{i=1}^{n}(y_i-(D\beta)_i)^2
$$

$y$ 是觀測目標，$\beta$ 是參數，$\widehat y$ 是預測，$r$ 是殘差。平方和稱SSE；相同資料下除以 $n$ 得到MSE，兩者的最小化參數相同。
:::

### 什麼時候能求逆（補充）

$$
\widehat\beta=(D^\top D)^{-1}D^\top y
$$

只有 $D$ 的每個欄向量線性獨立，也就是滿欄秩，$D^\top D$ 才可逆。本頁固定「橫列是樣本、直欄是參數」，避免行列譯名混淆。

$$
\widehat\beta=D^+y
$$

$D^+$ 是Moore–Penrose偽逆。當欄位共線而解不唯一時，它選出最小平方解中參數L2範數最小的一個。

### 正交條件（補充）

$$
D^\top r=D^\top(y-\widehat y)=0
$$

此式說殘差與每個設計欄向量正交。若將設計矩陣記為 $X$，同一條件就是 $X^\top r=0$；它適用於未加限制、未加懲罰的普通最小平方。

## 算一次（補充）

沿用六筆製程資料的中心化欄位 $t,t,z$，加截距後因兩欄重複而共線。先只取一欄 $t$，組成 $D=[\mathbf1,t,z]$，形狀為 $6\times3$。

目標 $y=(4,11,5,13,15,12)^\top$，代表耗材量指數。它是固定的教學目標，不是由PCA產生的座標。

### 逐筆加平方（補充）

取參數 $\beta=(10,2,3)^\top$，模型為 $\widehat y_i=10+2t_i+3z_i$。前四筆先算：

| 樣本 | 觀測 $y_i$ | 預測 $\widehat y_i$ | 殘差平方 |
|---|---|---|---|
| 01 | 4 | 3 | 1 |
| 02 | 11 | 11 | 0 |
| 03 | 5 | 7 | 4 |
| 04 | 13 | 13 | 0 |

前四筆SSE是 $1+0+4+0=5$。最後兩筆預測為15與11，再加 $0+1$，六筆總SSE為6，MSE為 $6/6=1$。

### 求解與驗正交（補充）

本例的設計欄彼此正交，因此：

$$
D^\top D=\operatorname{diag}(6,10,6),\qquad D^\top y=(60,20,18)^\top
$$

diag表示對角矩陣。分別相除，得到參數 $(60/6,20/10,18/6)=(10,2,3)$。

殘差是 $(1,0,-2,0,0,1)^\top$。與截距欄的內積是 $1-2+1=0$；與 $t$ 是 $-2+2=0$；與 $z$ 是 $-1+2-1=0$。

因此滿足 $D^\top r=0$，這組參數確實是最小平方解，而不是只挑了一個看起來合理的模型。

### 共線時仍有解（補充）

若保留兩個相同的 $t$ 欄，設計改為 $D_c=[\mathbf1,t,t,z]$。只要兩欄係數和為2，預測都相同，例如 $(10,2,0,3)$ 與 $(10,1,1,3)$。

$D_c^\top D_c$ 不可逆；偽逆選最小範數解 $(10,1,1,3)$。預測仍為 $(3,11,7,13,15,11)^\top$，解不唯一不代表預測也不唯一。

## 程式（補充）

程式中的常數直接取自共用JSON，方便在獨立環境執行；欄位與列序維持相同。

```python
import numpy as np
X = np.array([
    [8,18,4], [9,19,6], [10,20,4],
    [10,20,6], [11,21,6], [12,22,4]])
Xc, y = X-X.mean(axis=0), np.array([4,11,5,13,15,12])
D = np.column_stack([np.ones(len(X)), Xc[:, 0], Xc[:, 2]])
beta = np.linalg.lstsq(D, y, rcond=None)[0]
r = y-D@beta
Dc = np.column_stack([np.ones(len(X)), Xc])
print("參數", beta.round(4).tolist())
print("殘差", np.where(abs(r)<1e-10, 0, r).round(4).tolist())
print("SSE與正交", round(float(r@r), 4), np.allclose(D.T@r, 0))
print("共線解", (np.linalg.pinv(Dc)@y).round(4).tolist())
```
```text
參數 [10.0, 2.0, 3.0]
殘差 [1.0, 0.0, -2.0, 0.0, 0.0, 1.0]
SSE與正交 6.0 True
共線解 [10.0, 1.0, 1.0, 3.0]
```

:::tip[讀碼重點]
用lstsq或pinv求解，無須先形成一般逆矩陣。截距是全1欄；只在輸出時把很小的浮點殘差顯示成0，驗算仍用原值。
:::

## 怎麼用、怎麼判讀

OLS常用於銷售、房價、醫療成本與多變數行為建模。平方會放大大殘差，因此離群觀測可能明顯拉動擬合結果。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 銷售與房價 | 連續目標及多個特徵 | 看預測誤差與離群值 |
| 醫療風險／成本 | 指引列出的醫療數值目標 | 成本可直接用連續模型 |
| 行為建模 | 同時控制多個輸入條件 | 係數需連同尺度理解 |
| 製程耗材（補充） | 六筆固定目標 | 殘差正交但不全為零 |
| 能源用量（補充） | 面積、溫度、使用時數 | 共線欄位影響參數唯一性 |

:::supplement[來源：MIT Lecture 16；NumPy lstsq]
若某筆殘差由1變為10，它對SSE的貢獻由1增為100；重新擬合時可能因此改變參數。醫療患病機率則需另外考慮輸出範圍與模型，OLS不自動保證0到1。
:::

:::supplement[來源：NIST 統計手冊4.1.4.1]
若輸入超出訓練資料涵蓋的範圍，就是外推。即使訓練殘差很小，範圍外的關係仍可能改變；用房屋大小、廣告支出或醫療指數預測時，都要另外確認適用範圍。
:::

## 常見誤解

- OLS必須讓每筆誤差為零：只要求總平方和最小。
- 樣本數比參數多就可逆：重複欄仍會秩不足。（補充）
- 正交殘差保證預測好：它只是訓練資料上的最小化條件，還要獨立驗證。（補充）

## 進階

### 投影與因果不同（補充）

醫療資料沿用同樣的 $t,z$ 與殘差，只有目標截距由10改為30。若保留 $t,2t$ 兩欄，最小範數係數為0.4與0.8；不同係數仍組成同樣的 $2t$。

這是共線性下的數學求解，不是年齡或血壓的因果效果。完整模型假設與不確定性另由線性迴歸單元說明。

### 參考來源

- 科目3學習指引3-16～3-17（guide-3:3-16、guide-3:3-17）：平方誤差、投影、離群影響與應用領域；投影對象在本頁作精確化補充。
- [NumPy lstsq](https://numpy.org/doc/stable/reference/generated/numpy.linalg.lstsq.html)：最小平方、最小範數與程式。
- [MIT Lecture 16](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/198bde3a6536b62989b6cc09495575c1_MIT18_06SCF11_Ses2.3sum.pdf)：目標式、正規方程與投影幾何的講解方式。
- [Deep Learning 2.9](https://www.deeplearningbook.org/contents/linear_algebra.html)：偽逆與最小平方的連結。
- [NIST 統計手冊4.1.4.1](https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm)：外推與離群值的限制。

## 小結

- 固定資料下，最小化SSE與MSE得到相同參數。
- 一般逆需要設計欄向量獨立，共線時可用偽逆選最小範數解。
- OLS將目標向量投影到設計矩陣欄空間，殘差與該空間正交。
- 平方會放大離群殘差，訓練最小化不等於泛化保證。
