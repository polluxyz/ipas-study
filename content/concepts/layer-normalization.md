---
id: layer-normalization
title: LayerNorm 與 BatchNorm 比較
kind: component
codes:
  - L23203
aliases:
  - Layer Normalization
  - LayerNorm
summary: LayerNorm 在單筆表示內計算統計，Batch Normalization 則依指定批次軸統計
goals:
  - id: g1
    text: 比較 LayerNorm 與 Batch Normalization 的統計軸、批次依賴和序列適用條件
requires: []
guide_refs:
  - guide-3:4-81
textbook: v2
author: codex
status: draft
part_of:
  - transformer
formula_groups:
  - id: feature-normalization
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.LayerNorm.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 輸入形狀為批次 2×長度 4×特徵 8，使用 LayerNorm(8)。計算一組平均與變異時會用哪些數值？
    options:
      A: 固定位置及特徵，跨兩筆樣本的同一欄數值
      B: 固定樣本及位置，使用該詞元的八個特徵值
      C: 固定樣本及特徵，跨該句四個詞元的數值
      D: 跨兩筆四詞八維，將全部六十四個值合併
    answer: B
    explain:
      A: 這跨了樣本軸，不是此處最後一軸的 LayerNorm。
      B: normalized_shape 指定八維，統計只在各詞元內沿特徵軸計算。
      C: 這沿序列長度算，與 LayerNorm(8) 的設定不同。
      D: 這會混合不同樣本與位置，並非此設定的統計範圍。
  - id: c2
    goal: g1
    type: choice
    prompt: 模型每次推論一則三詞訊息，訓練批次也很小。對 LayerNorm 與預設追蹤移動統計的 Batch Normalization，何者正確？
    options:
      A: 兩者都要推論批次平均，因此單筆輸入都無法計算
      B: LayerNorm 必須保存訓練移動平均，推論才能處理
      C: Batch Normalization 一律不能單筆推論，即使已存移動統計
      D: LayerNorm 依當筆特徵算；Batch Normalization 推論可用已存統計
    answer: D
    explain:
      A: LayerNorm 不需要跨樣本；預設 BN 推論也不是重新算批次平均。
      B: LayerNorm 在訓練與推論都從當前輸入的指定軸取得統計。
      C: 有已存統計且模式正確時，預設 BN 可以單筆推論。
      D: 兩者的統計來源與批次依賴不同，不能只看正規化名稱。
---

## 為什麼需要

LayerNorm（Layer Normalization）調整單筆表示的特徵尺度，有助穩定訓練。它不靠其他樣本的批次統計，適合序列與小批次條件。

## 直覺

張量有樣本、位置、特徵三條軸。典型 Transformer 的 LayerNorm 固定樣本和位置，沿詞元特徵統計；Batch Normalization 要另外核對排列。

![橫框表示同一詞元內的 LayerNorm 統計；縱框示範二維 Batch Normalization 跨樣本統計，兩者軸向不同。](figure:l23203-layer-normalization-axes)

上圖是指引批次依賴比較的軸向展開；確切的 normalized_shape 與卷積統計範圍屬以下補充。

## 定義與公式

原始Transformer在各注意力與前饋子層的殘差相加後使用LayerNorm；此處的組成關係依該標準結構，其他變體另查。

指引強調 LayerNorm 不依賴批次大小，能穩定序列模型的中間表示。這是正規化，不是用來限制權重大小的正則化。

### 沿最後特徵軸計算（補充）

$$
\mu=\frac1d\sum_{j=1}^{d}x_j,\quad
v=\frac1d\sum_{j=1}^{d}(x_j-\mu)^2,\quad
y_j=\gamma_j\frac{x_j-\mu}{\sqrt{v+\epsilon}}+\beta_j
$$

- $x$ 是詞元的 $d$ 維表示，$d$ 是正整數，$j$ 是特徵索引。
- $\mu,v$ 為同一詞元的平均與變異，$\epsilon>0$ 防止分母為零。
- $\gamma_j,\beta_j$ 是可學習的縮放與平移，$y_j$ 是輸出。

這裡用分母 $d$ 的變異。PyTorch 的 LayerNorm(8) 對最後八維計算；若指定多個軸，統計範圍也會改變，不能一概說 LayerNorm 永遠只正規化一條軸。

## 算一次（補充）

共用資料 norm 的兩筆表示為 $(1,3)$ 與 $(5,7)$。這是用來隔離統計軸的探針，不是另外訓練出的詞嵌入；縮放皆一、平移皆零，$\epsilon=10^{-5}$。

第一筆平均二，變異為 $[(-1)^2+1^2]/2=1$，輸出約 $(-0.999995,0.999995)$。第二筆平均六、變異一，輸出相同。

對同一矩陣做二維 BN，兩欄平均 $(3,5)$、變異 $(4,4)$，首筆約為 $(-0.999999,-0.999999)$。此處只比較統計軸，不能比較準確率。

前置頁 Batch Normalization 四筆算例的首筆輸出為 $(-3.683279,0.329180)$。它使用不同資料與仿射參數，不能與本探針比大小。

數字引用該頁的 L23203-B-activations.json，沒有重編或複製前置資料。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))["norm"]
x = np.array(d["X"], dtype=float)
mu, var = x.mean(axis=-1, keepdims=True), x.var(axis=-1, keepdims=True)
y = np.array(d["gamma"]) * (x-mu) / np.sqrt(var+d["epsilon"]) + d["beta"]
bn = (x-x.mean(axis=0)) / np.sqrt(x.var(axis=0)+d["epsilon"])
changed = x.copy(); changed[1] = [50, 70]
again = (changed-changed.mean(axis=-1, keepdims=True)) / np.sqrt(changed.var(axis=-1, keepdims=True)+d["epsilon"])
print("LN均值/變異:", mu.ravel().tolist(), var.ravel().tolist())
print("LN:", np.round(y, 6).tolist())
print("當批BN:", np.round(bn, 6).tolist())
print("改次筆不影響首筆LN:", np.allclose(y[0], again[0]))
```
```text
LN均值/變異: [2.0, 6.0] [1.0, 1.0]
LN: [[-0.999995, 0.999995], [-0.999995, 0.999995]]
當批BN: [[-0.999999, -0.999999], [0.999999, 0.999999]]
改次筆不影響首筆LN: True
```

:::tip[讀碼重點]
LN 的 axis=-1 固定每列，BN 示範的 axis=0 固定每欄。這只是二維當批公式，沒有實作 BN 的移動統計；完整訓練／推論切換見 Batch Normalization 頁。
:::

## 怎麼用、怎麼判讀

序列長度與批次大小可能變動時，LayerNorm 不需要靠其他樣本取得統計。這不表示它永遠優於 Batch Normalization；仍須配合網路架構與驗證結果選擇。

### 統計與模式的對照（補充）

| 方法與設定 | 統計範圍 | 訓練與推論 |
|---|---|---|
| Transformer 的 LayerNorm(d) | 每個樣本、每個詞元的 d 維 | 都從當前輸入算 |
| 二維 BatchNorm1d(d) | 每特徵跨批次樣本 | 預設推論用移動統計 |
| 序列 BatchNorm1d(d) | N×d×L 的每通道跨 N、L | 同上，須先排對軸 |

卷積 BN 也可能跨空間軸計算；批次為一並不自動代表只有一個統計觀測值。LayerNorm 的輸出經仿射變換後，亦不必維持均值零、變異一。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| NLP 序列模型 | 不依賴批次大小 | LayerNorm 適合此條件 |
| 客服逐則推論（補充） | 一次只有一則 | 不混入其他人的特徵 |
| 醫療短序列（補充） | 批次小、長度可變 | 核對特徵軸及有效詞元 |

## 常見誤解

- 「LayerNorm 就是 Batch Normalization 的另一個名字。」兩者的統計範圍與批次依賴不同。
- 「LayerNorm(8) 會跨整個四詞句計算。」此設定只沿每詞的最後八維。（補充）
- 「套正規化必定不會過擬合。」穩定訓練不等於保證泛化，仍須獨立驗證。（補充）

## 進階

### 不把歷史解釋當唯一因果

指引 4-81 用內部協變偏移解釋正規化的訓練動機。

:::supplement[來源：Santurkar 等，How Does Batch Normalization Help Optimization?]
後續 BN 研究也討論優化地形的平滑。不能把減少分布變動當成所有正規化效益的唯一已證原因，更不能直接由此推論 LN 對任何模型都有相同收益。
:::

### 參考來源

- 科目 3 指引 `guide-3:4-81`（已核對 PDF 119 頁）：支持批次依賴、序列用途與歷史動機；未列公式及軸向實算。
- [LayerNorm 原始研究](https://arxiv.org/abs/1607.06450)：支持單筆與訓練／推論一致的統計角色。
- [PyTorch LayerNorm](https://docs.pytorch.org/docs/2.15/generated/torch.nn.LayerNorm.html)：支持公式、normalized_shape 與變異分母。
- [PyTorch BatchNorm1d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.BatchNorm1d.html)：支持統計軸、移動統計與輸入排列。
- [Dive into Deep Learning 11.7.3](https://d2l.ai/chapter_attention-mechanisms-and-transformers/transformer.html#residual-connection-and-layer-normalization)：參考軸向對照的教學安排。
- [BN 優化研究](https://arxiv.org/abs/1805.11604)：支持進階的因果界線。

## 小結

- 先確認在哪些軸上計算平均與變異。（補充）
- LN 調整表示的特徵尺度，讓訓練過程更穩定。
- LN 不依賴批次大小，適合序列模型。
- BN 的推論模式與移動統計須另外確認。（補充）
