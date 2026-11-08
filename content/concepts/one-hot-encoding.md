---
id: one-hot-encoding
title: One-hot 編碼與高基數成本
kind: technique
codes: [L23301, L21101]
aliases: [High Cardinality, One-hot Encoding, One-hot 獨熱編碼, 獨熱編碼]
is_a: [categorical-encoding]
requires: [categorical-encoding]
summary: 每個類別各用一欄，避免誤判高低，並留意欄數與未見過的類別
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-15, guide-1:3-16, guide-1:5-4, guide-3:5-8]
goals:
  - id: g1
    text: 依固定四詞詞彙表建立One-hot，核算加詞後的維度與儲存差異
  - id: g2
    text: 計算多欄獨熱與高基數成本，選擇未知值規則及稀疏儲存
formula_groups:
  - id: indicator-and-width
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: dense-storage
    source: https://numpy.org/doc/stable/reference/generated/numpy.ndarray.nbytes.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 固定詞彙表順序為「車站、公車、商品、折扣」，只表示單一詞。商品的One-hot是哪個向量？
    options:
      A: "[0, 0, 1, 0]"
      B: "[0, 1, 0, 0]"
      C: "[1, 1, 1, 0]"
      D: "[0, 0, 0, 1]"
    answer: A
    explain:
      A: 商品是詞彙表第3個位置，所以只有第3格為1。
      B: 第2格對應公車，並非商品。
      C: 多格同為1不是本題的單詞One-hot表示。
      D: 第4格對應折扣，並非商品。
  - id: c2
    goal: g1
    type: choice
    prompt: 原有4詞、各1筆單詞向量。離線加入第5詞退貨，重建詞彙表並把5筆全部重編，完整保留各類，不刪欄。新維度與稠密值數為何？
    options:
      A: 維度4，5筆共20個稠密值
      B: 維度5，5筆共20個稠密值
      C: 維度5，5筆共25個稠密值
      D: 維度4，5筆共25個稠密值
    answer: C
    explain:
      A: 加入新的獨立詞位置後維度應增加，不能仍保留4維。
      B: 5筆各5維共25個值，20是4筆各5維。
      C: 每詞一位置，共5維，5列乘5欄為25個稠密值。
      D: 維度與值數對不上，5筆各4維只能有20個值。
  - id: c3
    goal: g2
    type: choice
    prompt: 10,000筆單一類別欄有5,000類，不合併或刪欄，稠密float32每值4 bytes。只計值本體，需多少bytes？
    options:
      A: "20,000,000 bytes；稀疏表示仍保留5,000維"
      B: "200,000,000 bytes；稀疏表示仍保留5,000維"
      C: "200,000,000 bytes；稀疏表示降為1維"
      D: "20,000,000 bytes；稀疏表示降為1維"
    answer: B
    explain:
      A: 10,000乘5,000再乘4為200,000,000，少算了一個10倍。
      B: 數量計算正確，稀疏儲存減少保存的零值，並不改變特徵維度。
      C: 記憶體算對，但稀疏是儲存格式，不是降成一個特徵。
      D: 同時少算記憶體，並誤把稀疏儲存當成降維。
---

## 為什麼需要

把飲品、食品、日用品編成0、1、2，可能讓模型誤以為類別有高低。每個類別改用各自的欄位，就能避免這種誤解。這叫獨熱編碼（One-hot Encoding）。

詞彙也能用同一個規則轉成數字。詞彙表有多少詞，每個詞就用多少個數字位置。這種按固定順序排列的數字串，稱為向量。

詞彙表很大時，每個向量會有很多位置，這叫高維。向量的大多數位置都填0，這叫稀疏。

## 直覺

每一欄回答「這筆是不是某一類」。一筆只屬於一個已知類別時，只有符合的那欄填1。其他欄都填0；這裡完整保留所有類別的欄位。

| 商品類型 | 飲品欄 | 食品欄 | 日用品欄 |
|---|---:|---:|---:|
| 飲品 | 1 | 0 | 0 |
| 食品 | 0 | 1 | 0 |
| 日用品 | 0 | 0 | 1 |

表格已列出各類別對應的欄位，所以本頁不另加示意圖。三種商品的向量只用來區分類別。數字沒有「日用品最大」的意思。

## 定義與公式

### 指示位置與總欄數（補充）

$$
v_k=\mathbf{1}[c=k],\qquad d=\sum_{j=1}^{p}K_j
$$

$c$是類別位置，$v_k$是向量第$k$格，相同時為1，否則0。$p$是原始類別欄數，$K_j$是第$j$欄的類別數，$d$是串接後總維度。

欄數公式假設不合併稀有類、不刪基準類。例：商品3類加廣告來源4類，得到3+4=7欄；不是3×4=12欄，後者是另外建立交互類別的問題。

### 稠密與稀疏的成本（補充）

$$
M_{\mathrm{dense}}=n\times d\times b
$$

$n$是樣本數，$d$是輸入維度，$b$是每值的bytes，$M$只計稠密值本體。稀疏格式另存非零值與位置索引，還有格式開銷，不能用同一式子精確估算。

例如單欄10,000列、5,000類，float32每值4 bytes，稠密值本體為200,000,000 bytes，即200 MB，約190.7 MiB。稀疏儲存不改變$d$。

此處明確指定float32；`OneHotEncoder`預設是float64，每值8 bytes，不能直接沿用4 bytes的估算。

## 算一次

### 四詞詞彙表

共用JSON固定詞序為車站、公車、商品、折扣。每列表示一個詞，不是整份文件的詞頻。

| 詞 | 向量，依固定詞序 |
|---|---|
| 車站 | [1, 0, 0, 0] |
| 公車 | [0, 1, 0, 0] |
| 商品 | [0, 0, 1, 0] |
| 折扣 | [0, 0, 0, 1] |

4詞各4維，稠密表示共16個值，但只有4個非零值。它沒有直接表達車站與公車的語意關係，也沒有加入前後文；需語意表示時再看詞嵌入。

### 加一個詞的差異（補充）

離線加入「退貨」並重建表示後，每詞變5維；舊詞在尾端補0，新詞為[0, 0, 0, 0, 1]。連新詞共5列，稠密值數變25，非零值數為5。

float32的稠密值本體由16×4=64 bytes變25×4=100 bytes，尚未計格式開銷。若維持同樣4筆舊詞、只擴欄，則是4×5=20值，不能混用兩種計數。

這是重建詞彙表的比較。既有模型上線遇到新詞時，須沿用原本的未知詞規則；不能自行把4欄改成5欄，再套原本4欄的模型。

### 兩個領域的相同核算（補充）

共用零售訓練20列：商品3類、廣告來源4類，完整獨熱為20×7。每列兩個1，非零值40；交通路線4類則為20×4，每列一個1，非零值20。

驗證索引20含未知商品「服務」與未知廣告「新平台」。若事先設`handle_unknown="ignore"`，這兩欄的獨熱區塊都變全0，但總欄數仍是7。

## 程式（補充）

### 欄數、稀有類與未知類

資料與共用JSON的20筆零售訓練列一致。稀有類以訓練次數判斷，未知類是訓練完全沒看過，兩者不同。

```python
import numpy as np
from sklearn.preprocessing import OneHotEncoder
products = ["飲品", "食品", "日用品"]
ads = ["搜尋"] * 8 + ["社群"] * 6 + ["郵件"] * 5 + ["小站"]
train = np.array([[products[i % 3], ads[i]] for i in range(20)])
enc = OneHotEncoder(handle_unknown="ignore").fit(train)
matrix = enc.transform(train)
unknown = enc.transform([["服務", "新平台"]])
print("訓練形狀與非零數:", matrix.shape, matrix.nnz)
print("未知列形狀與非零數:", unknown.shape, unknown.nnz)
group = OneHotEncoder(min_frequency=6, handle_unknown="infrequent_if_exist")
group.fit(np.array(ads).reshape(-1, 1))
print("合併後來源欄數:", group.transform([["新平台"]]).shape[1])
print("未知來源:", group.transform([["新平台"]]).toarray().astype(int).tolist())
```
```text
訓練形狀與非零數: (20, 7) 40
未知列形狀與非零數: (1, 7) 0
合併後來源欄數: 3
未知來源: [[0, 0, 1]]
```

:::tip[讀碼重點]
`min_frequency=6`保留搜尋與社群，把郵件及小站合成一欄。`infrequent_if_exist`需訓練時已建稀有類欄，才能將未知值放入；沒有時仍可能全0。
:::

## 怎麼用、怎麼判讀

無序且類別不多時，獨熱是清楚的起點。城市、產品類型符合這種語意；若類別很多，先估算欄數、記憶體與訓練成本，再決定表示。

:::supplement[來源：scikit-learn OneHotEncoder；Google Vocabulary and one-hot encoding]
稀疏輸出能省下大量零值，前提是下游模型也接受稀疏格式。合併稀有類會減少欄數，但失去個別身分；合併門檻要在訓練內決定。
:::

### 換個場景

| 場景／資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 城市名稱、產品類型 | 每類一個指示欄 | 避免虛假高低 |
| 簡單文本分類、語言模型 | 固定詞彙位置 | 不直接表示語意或上下文 |
| 類別或詞彙表很大 | 先評估維度成本 | 稀疏不等於低維 |
| 交通路線（補充） | 固定4類路線欄 | 新環線沿用未知值策略 |
| 零售廣告來源（補充） | 稀有類合併作候選 | 合併不能讀驗證標籤 |

## 常見誤解

- **獨熱會保留詞義相近程度。** 不同詞只是不同位置，沒有直接加入語意與上下文。
- **稀疏矩陣就是降維。** 欄數不變，只改儲存方式。（補充）
- **多個類別欄的欄數要相乘。** 串接獨熱區塊是相加，除非另建交互特徵。（補充）
- **未知值全0代表所有類別的平均。** 全0只是預先約定的表示，模型如何預測需另看。（補充）

## 進階

### 刪除一個基準類（補充）

有截距的某些線性模型，可能刪一類來避免完全共線。那時3類只剩2欄；本頁所有完整編碼算例均採`drop=None`，不可把兩種欄數混在一起。

### 參考來源

- 科目1指引3.1，`guide-1:3-15`～`guide-1:3-16`：詞彙表示、稀疏性、語意限制與文本用途。
- 科目1指引5.1，`guide-1:5-4`，及科目3指引5.1，`guide-3:5-8`：無序商品／城市、高基數與成本。
- [OneHotEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html)：指示公式、欄數前提、未知類、稀有類及程式。
- [NumPy ndarray.nbytes](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.nbytes.html)：稠密元素數乘每值bytes的公式，不含非元素屬性的開銷。
- [Google詞彙與獨熱課程](https://developers.google.com/machine-learning/crash-course/categorical-data/one-hot-encoding)：固定詞彙表、稀疏儲存與成本比較思路。
- [不同編碼器比較教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder.html)：高基數表示與下游模型的取捨。

## 小結

- 完整獨熱每類占一位置，無序類別不必假裝有大小。
- 固定詞彙表決定向量維度，詞義與上下文不會自動出現。
- 欄數相加，稠密成本依列數、欄數與資料型別估算。（補充）
- 稀疏儲存保留維度；未知值與稀有類規則須預先定好。（補充）
