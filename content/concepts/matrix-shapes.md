---
id: matrix-shapes
title: 矩陣形狀與維度對齊
kind: theory
codes:
  - L23102
aliases:
  - Matrix Shape
  - 矩陣維度
summary: 先標清樣本、特徵與輸出軸，才能判斷矩陣能否相乘
goals:
  - id: g1
    text: 標示樣本軸、特徵軸與輸出軸，判斷矩陣乘積形狀
  - id: g2
    text: 依輸入與輸出維度計算全連接層參數量，區分批次大小
requires:
  - vector-inner-product
guide_refs:
  - guide-3:3-10
textbook: v2
author: codex
status: draft
formula_groups:
  - id: matrix-product-shape
    source: https://numpy.org/doc/stable/reference/generated/numpy.matmul.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-A
  - id: dense-parameter-count
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一批 4 筆能源資料各 3 個特徵，權重 W 是 3×2。XW 與 X(Wᵀ) 的結果如何？
    options:
      A: 兩者都是 4×2
      B: XW 是 3×3，X(Wᵀ) 是 4×4
      C: XW 是 4×2，X(Wᵀ) 因內側 3 與 2 不同而不能乘
      D: XW 是 4×3，轉置不影響形狀
    answer: C
    explain:
      A: 轉置把權重變成 2×3，內側維度不再對齊。
      B: 外側尺寸是 4 與 2，不是 3 與 3。
      C: 前者的 3 與 3 對齊，後者內側維度不符。
      D: 權重把特徵軸 3 轉為輸出軸 2。
  - id: c2
    goal: g2
    type: choice
    prompt: 一個帶偏差的全連接層從 3 維輸入到 2 維輸出。批次從 4 筆改為 8 筆，參數量怎麼變？
    options:
      A: 維持 8 個
      B: 從 8 個變 16 個
      C: 維持 6 個
      D: 從 24 個變 48 個
    answer: A
    explain:
      A: 權重 3×2 加 2 個偏差為 8，對所有樣本共用。
      B: 批次變大只增加輸出筆數，不複製參數。
      C: 6 個只計權重，漏了 2 個偏差。
      D: 把輸入或輸出元素數當成參數量了。
---

## 為什麼需要

矩陣乘法之前，先弄清楚每個軸代表什麼。即使程式沒有報錯，誤把樣本軸當成特徵軸，也可能做出不符合任務的運算。

指引採用每個橫列放一筆樣本的特徵矩陣。以下固定使用這個排列，並以「橫列／直欄」避免行列用語混淆。

## 直覺

能源與授信各有 4 筆、每筆 3 特徵。資料矩陣的第一軸沿著樣本往下數，第二軸沿著特徵向右數；權重則把 3 個特徵合成 2 個輸出。

![X 的 3 個特徵對齊 W 的 3 個輸入位置，樣本數 4 與輸出數 2 留在結果外側。](figure:l23102-matrix-shapes-alignment)

## 定義與公式

指引的 $X\in\mathbb R^{n\times d}$ 表示 $n$ 筆資料、每筆 $d$ 個實數特徵；$W\in\mathbb R^{d\times k}$ 對應 $k$ 個輸出。

:::supplement[來源：NumPy matmul]
相乘時內側維度相同，結果保留外側維度：

$$
\underbrace{X}_{n\times d}\underbrace{W}_{d\times k}
=\underbrace{Z}_{n\times k}
$$

$Z$ 是輸出矩陣，每個橫列屬於同一筆樣本，每個直欄是一個輸出。這裡討論二維矩陣，沒有混用高階陣列的批次廣播。
:::

### 全連接層參數量（補充）

每個輸出需要 $d$ 個權重與一個偏差，因此：

$$
P=dk+k
$$

$P$ 是可學習參數總數，$d$ 是輸入維度，$k$ 是輸出維度。這只計一層帶偏差的全連接層；沒有偏差時只有 $dk$。

## 算一次（補充）

共用能源矩陣 $X$ 為 $4\times3$，兩組候選權重 $W_1,W_2$ 均為 $3\times2$。因此兩者輸出均為 $4\times2$，可在相同樣本索引上比較。

若拿 $W_1^\top$ 直接放右邊，它是 $2\times3$，內側成為 3 對 2，不能計算。不能靠隨意 reshape 改掉這個語意錯誤。

| 輸入維度→輸出維度 | 權重數 | 偏差數 | 總數 |
|---|---|---|---|
| $3\to2$ | 6 | 2 | 8 |
| $9\to10$ | 90 | 10 | 100 |
| $10\to10$ | 100 | 10 | 110 |

對第一層，4 筆輸出共有 8 個數，8 筆輸出共有 16 個數；兩種批次都只有同一套 8 個參數。授信的特徵數也是 3，故採同樣的層尺寸時參數量相同。

## 程式（補充）

```python
import numpy as np
import torch
torch.manual_seed(42)
X = np.array([[1, 2, 3], [2, 1, 0], [0, 1, 2], [3, 0, 1]])
W = np.array([[1, 0], [2, 1], [-1, 2]])
print("形狀", X.shape, W.shape, (X @ W).shape)
layer = torch.nn.Linear(3, 2)
print("參數", sum(p.numel() for p in layer.parameters()))
for n in (4, 8):
    print("批次", n, "輸出", tuple(layer(torch.zeros(n, 3)).shape))
```
```text
形狀 (4, 3) (3, 2) (4, 2)
參數 8
批次 4 輸出 (4, 2)
批次 8 輸出 (8, 2)
```

:::tip[讀碼重點]
Linear 的參數是輸入與輸出維度。PyTorch 內部權重存成 (2,3)，前向計算會用其轉置；不能只看儲存形狀就說公式矛盾。
:::

## 怎麼用、怎麼判讀

先標軸，再檢查相乘位置。指引的多類別輸出可有 $k$ 個分數，但單靠矩陣乘法不保證它們是合法機率；後續輸出轉換另由模型定義。

### 換個場景

| 場景 | 資料條件 | 對齊重點 |
|---|---|---|
| 多類別分類 | 每筆有 $d$ 特徵、$k$ 個分數 | 樣本軸保留，特徵軸轉輸出軸 |
| 線性迴歸、神經網路 | 批次資料與共用權重 | 固定每列是一筆 |
| 能源雙輸出（補充） | 每棟預測兩種用電分數 | 結果每列兩個數 |
| 授信雙輸出（補充） | 每人預測兩個額度分數 | 不把人數當成輸入維度 |
| 影像特徵（補充） | 每張圖先轉成特徵向量 | 展平後的維度才是 $d$ |

## 常見誤解

- 資料有 4 筆，不代表模型需要 4 個輸入權重。（補充）
- 轉置會交換軸，reshape 只重排形狀，兩者不能任意互換。（補充）
- 參數量是模型共用的數量，不是本批次輸出元素數。（補充）

## 進階

### 參考來源

- 科目 3 指引 3.2，guide-3:3-10（版本未標示）：支持矩陣軸、多類別與前向運算場景。
- [NumPy matmul](https://numpy.org/doc/stable/reference/generated/numpy.matmul.html)：支持形狀與程式。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html)：支持參數量、權重儲存形狀與批次行為。
- [Dive into Deep Learning 2.3](https://d2l.ai/chapter_preliminaries/linear-algebra.html)：參考以軸解釋運算的安排。

## 小結

- $n\times d$ 乘 $d\times k$ 得 $n\times k$。
- 每個軸要有明確的樣本或特徵語意。
- 帶偏差全連接層有 $dk+k$ 個參數，與批次大小無關。（補充）
