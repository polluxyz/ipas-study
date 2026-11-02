---
id: feature-space
title: 特徵空間與資料表示
kind: theory
codes:
  - L23201
aliases:
  - Feature Space
summary: 特徵空間用固定的座標意義，表示每筆樣本的位置與彼此關係
goals:
  - id: g1
    text: 把表格、文字與影像轉成特徵向量，判讀維度、點位與尺度影響
requires:
  - vector-inner-product
guide_refs:
  - guide-3:4-3
  - guide-3:4-33
  - guide-3:5-7
textbook: v2
author: codex
status: draft
formula_groups:
  - id: representation
    source: https://scikit-learn.org/stable/getting_started.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-A
  - id: scaled-distance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 120 封郵件各以固定 2 個詞的次數表示，另存優先類別。輸入矩陣的正確形狀是什麼？
    options:
      A: 2×120，因為每列必須是詞
      B: 120×3，標籤一定要加進特徵
      C: 120×2，標籤另存
      D: 120 維，每筆樣本是一個座標軸
    answer: C
    explain:
      A: 本頁固定每列一筆、每欄一特徵的表示。
      B: 預測目標另存，不能把答案當成可用輸入。
      C: 120 列對應樣本，2 欄對應固定詞彙，類別不增加輸入維度。
      D: 樣本數和單筆特徵維度是不同的數量。
  - id: c2
    goal: g1
    type: choice
    prompt: 設備的溫度用 °C 記錄，振動用 mm/s；只把溫度改記成毫度，直接算歐氏距離會怎樣？
    options:
      A: 溫度差的距離貢獻被放大，須重新檢查縮放
      B: 距離只看順序，因此不變
      C: 所有模型的預測一定相同
      D: 特徵數從 2 變成 1000
    answer: A
    explain:
      A: 單位改變會放大該軸的數值差與平方差。
      B: 歐氏距離使用數值差，並非只使用大小次序。
      C: 距離或正則化相關方法可能受影響，不能保證所有模型不變。
      D: 換單位不會增加座標軸數量。
---
## 為什麼需要

資料可能是一張表、一封郵件或一張圖片。模型需要一致的表示，才能讓同一欄數字在每筆樣本中有相同意思。

特徵空間（Feature Space）把每個樣本放成一個點。點的分布與可分邊界，會影響分類、迴歸與分群能否順利學習。

## 直覺

只取「急迫詞次數、退款詞次數」，就得到二維空間。增加第三個詞是增加一個維度；增加一封郵件只是多一個點。

### 看同批郵件的位置

每筆樣本的位置由兩個特徵決定；圓與三角表示觀察類別，不是第三個特徵。

:::supplement[來源：本組教學合成資料與生成規則]
本組 120 封郵件刻意排成 12×10 網格，方便手算；每點座標都不同，不代表真實資料也如此整齊。

索引是 19 的倍數的 7 筆被刻意翻轉類別，因此有些標籤與周圍混雜。單一直線無法完全分開這批標籤，不能由此推論相同座標有不同答案。
:::

![橫軸與縱軸分別是兩種詞的次數；先看點的位置，再看形狀所代表的標籤。](figure:l23201-feature-space-mail)

## 定義與公式（補充）

採每列一筆樣本的慣例，可寫成：

$$
x_i=(x_{i1},\ldots,x_{id}),\qquad X\in\mathbb R^{n\times d}
$$

$i$ 是樣本索引，$d$ 是特徵數，$n$ 是樣本數，$x_{ij}$ 是第 $i$ 筆的第 $j$ 個特徵。

這是實數特徵表示；原始字串須先轉換。

| 輸入 | 一筆的表示例 | 120 筆的形狀 |
|---|---|---|
| 表格感測器 | 溫度、振動，共 2 維 | $120\times2$ |
| 文字 | 固定 2 詞的計數，共 2 維 | $120\times2$ |
| 灰階影像 | $8\times8$ 像素攤平成 64 維 | $120\times64$ |

影像也可保留高、寬、通道的張量排列。攤平是理解維度的例子，不表示所有影像模型都該丟掉空間結構。

## 算一次

:::supplement[來源：scikit-learn Euclidean distances；本組教學合成資料]

郵件 mail-027、mail-099、mail-088 的向量依序為 $(3,2)$、$(3,8)$、$(4,7)$。前兩筆只在退款詞軸不同。

兩點的歐氏距離，以及先依指定尺度縮放後的距離為：

$$
d(a,b)=\sqrt{\sum_{j=1}^{d}(a_j-b_j)^2},\qquad
d_s(a,b)=\sqrt{\sum_{j=1}^{d}\left(\frac{a_j-b_j}{s_j}\right)^2}
$$

$a,b$ 是兩個同維向量；$s_j>0$ 是第 $j$ 軸的縮放尺度。未縮放時，前兩封距離為 6；後兩封為 $\sqrt2\approx1.4142$。

設備索引 27 與 99 是 $(55,0.4)$、$(55,1.6)$，原距離 1.2。每軸分別除以 5°C、0.2 mm/s，距離變成 6，與郵件的座標差一致。

這些尺度只為對齊教學座標；實務縮放方式要配合特徵與模型。不同單位的原始距離不宜直接比較。

設備資料只是把郵件座標換單位與平移，沿用完全相同的類別編碼；它提供換景練習，沒有新增分類資訊。
:::

## 程式（補充）

以下重建例子 JSON 的同一個固定網格；索引從 0 開始。

```python
import numpy as np
i = np.arange(120)
X = np.column_stack((i % 12, i // 12))
a, b, c = X[[27, 99, 88]]
equipment = np.column_stack((40 + 5 * X[:, 0], 0.2 * X[:, 1]))
delta = equipment[99] - equipment[27]
print("形狀", X.shape)
print("向量", a.tolist(), b.tolist(), c.tolist())
print("郵件距離", round(float(np.linalg.norm(a-b)), 4))
print("設備距離", round(float(np.linalg.norm(delta)), 4))
print("縮放距離", round(float(np.linalg.norm(delta / [5, .2])), 4))
```
```text
形狀 (120, 2)
向量 [3, 2] [3, 8] [4, 7]
郵件距離 6.0
設備距離 1.2
縮放距離 6.0
```

:::tip[讀碼重點]
矩陣兩欄的順序固定；標籤沒有加進 X。設備兩欄除以不同尺度，不能只把整個矩陣除以同一個數。
:::

## 怎麼用、怎麼判讀

先看每一軸的意思，再看距離與邊界。特徵表示改變時，模型看到的幾何結構也可能改變。

:::supplement[來源：scikit-learn Common pitfalls 12.1、12.2]
訓練與預測須使用相同詞彙順序、單位與轉換規則。若縮放尺度由資料估計，只能在訓練資料上擬合，再套用到驗證與新資料。
:::

### 換個場景

| 場景 | 指引列出的資料來源或用途 | 判讀 |
|---|---|---|
| 表格、文字、影像、語音與感測資料 | 轉成向量或矩陣 | 固定特徵意義與維度 |
| 分類與分群 | 點的密集程度與邊界影響學習 | 不只看原始欄數 |
| 客服郵件（補充） | 固定詞彙的計數 | 詞序不能任意換欄 |
| 製造設備（補充） | 溫度與振動單位不同 | 先決定尺度再談鄰近 |
| 醫療影像（補充） | 像素或學得的表示 | 保留必要的空間與通道意義 |

## 常見誤解

- 樣本數是點的數量，不是特徵維度。
- 二維圖看起來混雜，不代表加入其他特徵後仍不可分。（補充）
- 數值較大的軸不必然較重要；可能只是單位較大。（補充）

## 進階

### 參考來源

- 科目 3 指引 4.1，guide-3:4-3（版本未標示）：支持多種輸入與幾何結構；4.2，guide-3:4-33、5.1，guide-3:5-7：支持距離的尺度敏感性與縮放用途。
- [scikit-learn Getting Started](https://scikit-learn.org/stable/getting_started.html)：支持樣本列、特徵欄與目標另存的表示。
- [scikit-learn Feature extraction](https://scikit-learn.org/stable/modules/feature_extraction.html)：支持文字與影像轉成數值特徵。
- [scikit-learn Euclidean distances](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html)：支持兩向量距離；縮放距離是將各軸除以指定尺度後套用同一定義。
- [Google MLCC Normalization](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization)：支持縮放直覺與距離算例的必要前置。
- [scikit-learn Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：支持轉換一致與只在訓練資料估計尺度。

## 小結

- 每個特徵是一個軸，每筆樣本是一個點。
- 比較樣本前，要固定欄位順序、維度與單位。
- 距離依賴表示與尺度，不能把單位大小直接當成重要性。（補充）
