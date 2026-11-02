---
id: embedding-representation
title: 嵌入與低維表示
kind: component
codes:
  - L23102
aliases:
  - Embedding Representation
  - 嵌入表示
summary: 嵌入用向量表示資料，類別查表、線性投影與非線性編碼各有條件
goals:
  - id: g1
    text: 由 one-hot 查表算例區分類別嵌入、LDA 投影與 Autoencoder 編碼
requires:
  - affine-layer
guide_refs:
  - guide-3:3-12
  - guide-3:3-13
textbook: v2
author: codex
status: draft
formula_groups:
  - id: embedding-lookup
    source: https://microsoft.github.io/CNTK-R/reference/Embedding.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23102-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源設備有 4 種類別，嵌入表 E 的四列是 (1,0)、(0,1)、(1,1)、(−1,1)。乙型索引為 1（從 0 起），one-hot 是 (0,1,0,0)，查表輸出為何？
    options:
      A: (0,1)
      B: (1,0)
      C: (1,1)
      D: (0,0,0,0)
    answer: A
    explain:
      A: one-hot 只選中第二列，與索引 1 查表結果一致。
      B: 這是甲型索引 0 的向量。
      C: 這是丙型索引 2 的向量。
      D: 輸出維度由表格欄數決定，這裡為 2 維。
  - id: c2
    goal: g1
    type: choice
    prompt: 授信團隊有 3 維連續特徵和 2 類標籤，想用 LDA 壓成 1 維；另有帶非線性激活的 Autoencoder。哪個比較正確？
    options:
      A: LDA 與 Autoencoder 都只按類別索引查表
      B: LDA 與 Autoencoder 都只做純線性投影
      C: LDA 線性投影；Autoencoder 可非線性
      D: LDA 與 Autoencoder 的座標必有清楚語意
    answer: C
    explain:
      A: 連續向量映射與類別索引查表是不同輸入形式。
      B: 加入非線性激活後通常不是單一線性映射。
      C: LDA 與重建式編碼的訓練目的不同，也都不同於純查表。
      D: 學出的座標不保證對應單一語意。
---

## 為什麼需要

設備型號、字詞等離散類別，不適合直接把編號大小當成距離。嵌入（Embedding）讓每個類別有一個可用於模型計算的連續向量。

指引也介紹線性判別分析（LDA，全名為 Linear Discriminant Analysis）與自編碼器（Autoencoder）；兩者的訓練目的與線性條件不同。

## 直覺

把嵌入表看成每個類別各占一列的表格。輸入類別索引時，取出對應的一列；索引只是地址，不是數值特徵的大小。

:::supplement[來源：Microsoft CNTK Embedding]
one-hot（獨熱編碼）用只有一個位置為 1、其餘為 0 的向量表示類別。它乘上嵌入表，就選出 1 所在位置對應的橫列。
:::

:::supplement[來源：PyTorch Embedding；Google Embeddings: Obtaining embeddings]
以下表格是教學手設，不是訓練後的語意結果。真正的嵌入值可透過任務損失學習，因此距離能否代表有用的相似性，仍需依任務驗證。
:::

![同一個乙型類別可用索引 1 查表，或用 one-hot 選中第二列，兩條路徑都輸出 (0,1)。](figure:l23102-embedding-representation-lookup)

## 定義與公式

嵌入層把離散類別對應到連續向量。指引提到這是特定矩陣的查詢與轉換，以下展開查表的矩陣形式。

### one-hot 與查表（補充）

若共有 $V$ 個類別，每個表示有 $q$ 維：

$$
e_i=o_iE,\qquad o_i\in\mathbb R^{1\times V},\quad E\in\mathbb R^{V\times q}
$$

$i$ 是類別索引，$o_i$ 只在位置 $i$ 為 1，$E$ 是嵌入表，$e_i$ 是該列向量。通常取 $q<V$ 來降維，但查表本身沒有這個限制。

實作可以直接查列，不必真的建立長度 $V$ 的稀疏 one-hot 向量。整數索引的前後大小，不代表取出的向量距離。

## 算一次（補充）

共用例子的類別為甲、乙、丙、丁型，索引依序從 0 到 3。能源領域可把它們當設備型號；授信換景可把它們當申請管道代碼。

$$
E=\begin{bmatrix}1&0\\0&1\\1&1\\-1&1\end{bmatrix},\qquad
(0,1,0,0)E=(0,1)
$$

這裡 $V=4,q=2$。乙型 one-hot 把第二列乘 1，其餘列乘 0，故結果是 $(0,1)$，與索引 1 查表相同。

依共用順序 $(1,0,2,1)$ 查表，四筆結果依序為 $(0,1),(1,0),(1,1),(0,1)$。兩筆乙型在這個靜態表格下取出同一向量。

## 程式（補充）

```python
import numpy as np
E = np.array([[1, 0], [0, 1], [1, 1], [-1, 1]])
ids = np.array([1, 0, 2, 1])
one_hot = np.eye(4, dtype=int)[ids]
print("查表", E[ids].tolist())
print("乘法", (one_hot @ E).tolist())
print("一致", np.array_equal(E[ids], one_hot @ E))
```
```text
查表 [[0, 1], [1, 0], [1, 1], [0, 1]]
乘法 [[0, 1], [1, 0], [1, 1], [0, 1]]
一致 True
```

:::tip[讀碼重點]
E[ids] 是依索引選列，不是把 ids 當連續特徵乘權重；np.eye 在這裡只為展示 one-hot 與查表的等價性。
:::

## 怎麼用、怎麼判讀

指引中的嵌入適合離散類別的連續表示，LDA 與 Autoencoder 則用於特徵投影與空間壓縮。應先確認輸入是類別地址還是特徵值，再選方法。

### 三種表示怎麼區分

| 方法 | 接收的輸入 | 學習或取得方式 | 結果 |
|---|---|---|---|
| 類別嵌入查表（補充） | 離散索引或 one-hot | 每類一列，可由任務訓練 | 取出類別向量 |
| LDA 線性判別分析 | 連續特徵與類別標籤 | 找有利區分類別的線性方向 | 低維投影座標 |
| Autoencoder | 高維資料向量 | 特徵投影與空間壓縮 | 低維潛在表示 |

:::supplement[來源：scikit-learn LDA；TensorFlow Intro to Autoencoders]
LDA 的降維維數至多是「特徵數與類別數減一」兩者中的較小值。例如 3 特徵、2 類最多取 1 維；轉換時可能先中心化，但仍以線性方向為核心。

Autoencoder 先編碼再解碼，以重建輸入為訓練目標。若編碼器含非線性激活，整體編碼一般不能縮成單一矩陣乘法；不能只因其中有矩陣運算，就判定整個編碼器必定線性。
:::

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 離散類別嵌入 | 類別沒有自然大小順序 | 查表取得向量 |
| 特徵投影與壓縮 | 高維資料需低維表示 | 區分線性投影與非線性編碼 |
| 能源設備（補充） | 型號代碼 | 代碼相鄰不表示設備相似 |
| 授信管道（補充） | 申請管道類別 | 向量需配合任務與群體評估 |
| 商品推薦（補充） | 商品 ID 很多 | 由訓練目標學習有用的表示 |

## 常見誤解

- 嵌入維度不保證都有可讀的人類語意。（補充）
- 降維是減少表示座標，不保證對預測有幫助。（補充）
- 一般 Autoencoder 不應一律說成純線性變換。（補充）

## 進階

### 教材勘誤（補充）

指引 3-13 把 Autoencoder 放在線性變換的說明中；這只適合描述其中的矩陣運算。含非線性激活的編碼器一般無法合併成單一線性映射，須與 LDA 的線性方向分開。

### 參考來源

- 科目 3 指引 3.2，guide-3:3-12、guide-3:3-13（版本未標示）：支持嵌入、LDA 與 Autoencoder 的原有介紹。
- [PyTorch Embedding](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Embedding.html)：支持索引查表、表格維度。
- [Microsoft CNTK Embedding](https://microsoft.github.io/CNTK-R/reference/Embedding.html)：支持「one-hot 與查表」的矩陣乘法等價式。
- [scikit-learn LDA](https://scikit-learn.org/stable/modules/lda_qda.html)：支持線性方向、類別標籤與降維上限。
- [TensorFlow Intro to Autoencoders](https://www.tensorflow.org/tutorials/generative/autoencoder)：支持重建流程與非線性編碼界線。
- [Google Obtaining embeddings](https://developers.google.com/machine-learning/crash-course/embeddings/obtaining-embeddings)：參考 one-hot 到嵌入及推薦場景的教學安排。

## 小結

- 離散類別可查表取得連續向量。
- one-hot 乘嵌入表，等於選取對應的表格列。（補充）
- LDA 與 Autoencoder 都能產生低維表示，但不能當成同一種操作。（補充）
