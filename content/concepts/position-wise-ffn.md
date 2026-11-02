---
id: position-wise-ffn
title: 逐位置前饋網路
kind: component
codes:
  - L23203
aliases:
  - Feed-forward Network
  - Position-wise FFN
summary: 逐位置前饋網路對每個詞元套用同一組兩層非線性轉換
goals:
  - id: g1
    text: 區分逐位置 FFN 的特徵轉換與注意力的跨位置整合
requires:
  - relu
guide_refs:
  - guide-3:4-81
textbook: v2
author: codex
status: draft
part_of:
  - transformer
formula_groups:
  - id: position-wise-transform
    source: https://arxiv.org/html/1706.03762v7#S3.SS3
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 輸入是批次 2、長度 4、特徵 8，FFN 隱藏寬度 16、輸出寬度 8。標準逐位置運算正確的是？
    options:
      A: 每位置各有一組參數；四個位置可學四套不同的轉換
      B: 先把四位置接成一列；再用同一個 Softmax 跨詞加權
      C: 每位置共用同組參數；各自把 8 維轉 16 維再轉回 8 維
      D: 先把兩筆批次求平均；再把八維特徵分給四個位置
    answer: C
    explain:
      A: 逐位置的相同是共享參數，不是為每一個位置各建一套。
      B: 這不是逐位置 FFN，而是混入位置軸的其他運算。
      C: 兩個線性層與中間非線性作用於特徵軸，保留批次與長度。
      D: FFN 不以批次平均取代每筆每個位置的表示。
  - id: c2
    goal: g1
    type: choice
    prompt: 四詞句中的「退款」表示要直接讀取「客戶」位置的資料。單獨使用標準逐位置 FFN，哪項判斷正確？
    options:
      A: 可以直接查詢其他位置，因為兩層線性會自動建立注意力
      B: 可以依所有鍵做 Softmax，因為 ReLU 會產生四詞權重
      C: 不能處理任何上下文，即使輸入本來已有上下文也會刪除
      D: 不直接跨位置讀取，但能轉換前一注意力層已整合的表示
    answer: D
    explain:
      A: 兩層特徵轉換沒有新增跨位置的查詢與配分。
      B: ReLU 不是跨鍵的 Softmax。
      C: FFN 不直接混合位置，卻可使用輸入裡已有的上下文。
      D: 注意力負責混合位置，FFN 再對各位置表示做非線性轉換。
---

## 為什麼需要

注意力先整合跨位置資訊，再由逐位置前饋網路（Position-wise Feed-forward Network，FFN）非線性轉換各位置特徵。

## 直覺

四個位置各自經過同一個網路，彼此不在 FFN 裡交換資料。「同一個」指共享權重；輸入不同，輸出仍可不同。

![看四條位置路徑互不交叉，但每條都使用同一組線性、ReLU、線性參數。](figure:l23203-position-wise-ffn-axes)

## 定義與公式

原始 Transformer 的 FFN 為兩個線性層，中間接 ReLU。各位置獨立計算，與注意力的跨位置加權分工不同。

### 帶形狀的兩層轉換（補充）

$$
\operatorname{FFN}(x)=\max(0,xW_1+b_1)W_2+b_2
$$

- $x$ 為單一位置的 $1\times d$ 向量，$d$ 是模型寬度，$m$ 是隱藏寬度。
- $W_1$ 為 $d\times m$，$b_1$ 為 $m$ 維偏置。
- $W_2$ 為 $m\times d$，$b_2$ 為 $d$ 維偏置；$\max$ 逐項執行，輸出回到 $d$ 維。

批次與序列軸保留，只有最後的特徵軸被轉換。不同深度層通常各有自己的參數。

## 算一次（補充）

沿用客服 S01 的「客戶／退款」兩位置向量 $X=I_2$。隱藏寬度三，兩組偏置皆零，參數取共用 JSON 的 ffn 欄位。

$$
W_1=\begin{bmatrix}1&-1&0\\0&1&1\end{bmatrix},\qquad
W_2=\begin{bmatrix}1&0\\0&1\\1&1\end{bmatrix}
$$

$W_1,W_2$ 分別是上節兩個線性層的權重。首位置 $(1,0)$ 先得到 $(1,-1,0)$，經 ReLU 變成 $(1,0,0)$；再乘 $W_2$ 得 $(1,0)$。

第二位置 $(0,1)$ 先得到 $(0,1,1)$，ReLU 後不變，再投影成 $(1,2)$。因此兩列輸出為 $(1,0)$、$(1,2)$，沒有從另一列偷取任何值。

醫療「病人／疼痛」的兩列輸入也為 $I_2$，使用同一組 FFN 後，同樣輸出 $(1,0)$、$(1,2)$。若先經注意力整合，FFN 的輸入已有上下文；「不跨位置」不代表丟棄上下文。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))
ids = np.array(d["service"][0]["token_id"])[d["probe"]["positions"]]
x = np.array(d["embedding"], dtype=float)[ids]
f = {k: np.array(v) for k, v in d["ffn"].items()}
h = np.maximum(0, x @ f["W1"] + f["b1"])
y = h @ f["W2"] + f["b2"]
changed = x.copy(); changed[1] = [9, 9]
y2 = np.maximum(0, changed @ f["W1"] + f["b1"]) @ f["W2"] + f["b2"]
print("隱藏:", h.tolist(), "輸出:", y.tolist())
print("只改次列，首列不變:", np.array_equal(y[0], y2[0]))
```
```text
隱藏: [[1.0, 0.0, 0.0], [0.0, 1.0, 1.0]] 輸出: [[1.0, 0.0], [1.0, 2.0]]
只改次列，首列不變: True
```

:::tip[讀碼重點]
矩陣乘法沿最後的特徵軸進行。改次列不影響首列，正好驗證此 FFN 不直接跨位置混合；若前面重算注意力，其他位置則可能一起變。
:::

## 怎麼用、怎麼判讀

看到跨詞的權重配對，想到注意力；看到每個位置共用兩層線性加非線性，想到 FFN。原始設計讓輸出寬度回到輸入寬度，方便與殘差分支相加。

### 換個場景

| 場景 | 運算需求 | 判讀重點 |
|---|---|---|
| 注意力後的序列表示 | 進一步轉換提取的資訊 | 各位置同網路、獨立計算 |
| 客服詞元（補充） | 轉換意圖相關特徵 | 不直接向其他詞查詢 |
| 醫療詞元（補充） | 轉換已有的症狀上下文 | 相同權重可有不同輸出 |

## 常見誤解

- 「逐位置代表每個位置有不同權重。」實際是同一個子層的權重套到各位置。
- 「FFN 能取代注意力建立任意詞元關聯。」它處理各位置特徵，並未直接跨位置讀取。
- 「兩個線性層拿掉中間激活也相同。」拿掉後只能合成另一個線性轉換，表達能力不同。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-81`：支持兩線性層、ReLU 與逐位置共享的定義。
- [原始論文 3.3](https://arxiv.org/html/1706.03762v7)：核對原始 FFN 形式。
- [Dive into Deep Learning 11.7.2](https://d2l.ai/chapter_attention-mechanisms-and-transformers/transformer.html#positionwise-feed-forward-networks)：支持形狀、計算與逐位置教學安排。

## 小結

- FFN 對每個位置套同一組特徵轉換。
- 注意力跨位置整合，FFN 逐位置加工。
- 中間的非線性讓兩層轉換不只是另一個線性層。（補充）
