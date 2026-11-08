---
id: output-loss-contract
title: 輸出層、標籤與損失函數的搭配
kind: technique
codes: [L23203]
aliases: [BCEWithLogitsLoss, Categorical Crossentropy, CrossEntropyLoss, Logits]
summary: 先確認要預測什麼、正確答案怎麼存，再搭配模型輸出與損失函數
requires: [softmax, sigmoid, cross-entropy-loss]
guide_refs: [guide-3:4-61, guide-3:4-62, guide-3:4-65, guide-3:4-66]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 依連續值、二元與單標籤多類任務配對輸出及損失，區分損失與優化器
  - id: g2
    text: 配對 PyTorch logits 的形狀、標籤型別及二元和多類損失
  - id: g3
    text: 依整數或獨熱標籤與 from_logits 設定選 Keras 損失
formula_groups:
  - id: categorical-contract
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.CrossEntropyLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-C
  - id: binary-contract
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html ; https://keras.io/api/losses/probabilistic_losses/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠分別預測明日用電量、是否瑕疵及三種互斥缺陷。三個輸出頭最合適的安排是？
    options:
      A: 連續值用 Softmax；是否瑕疵用 Sigmoid；三類配錯只要更換優化器
      B: 連續值用線性輸出；是否瑕疵用 Sigmoid；三類用 Softmax 配類別交叉熵
      C: 連續值用 Sigmoid；是否瑕疵用 Softmax；三類用線性輸出配平均絕對誤差
      D: 連續值用線性輸出；是否瑕疵用 ReLU；三類用 Sigmoid 配二元交叉熵
    answer: B
    explain:
      A: Softmax 不適合無界用電量，優化器更新參數也不能修正輸出與標籤的錯配。
      B: 這三組分別對應連續值、二元機率與互斥類別機率的任務語意。
      C: Sigmoid 限制連續輸出範圍，且三類單選不能靠絕對誤差直接配對。
      D: ReLU 不保證二元機率落在零到一，三類獨立 Sigmoid 也未表達單選。
  - id: c2
    goal: g2
    type: choice
    prompt: PyTorch 客服模型每批 12 筆、3 類單選，標籤是 0、1、2。哪個 CrossEntropyLoss 輸入符合本頁契約？
    options:
      A: 12×3 機率與 12 個 long 標籤，先沿類別做 Softmax
      B: 12×3 logits 與 12 個 float 標籤，把整數存成小數
      C: 12×1 logits 與 12 個 long 標籤，只保留最高分數
      D: 12×3 logits 與 12 個 long 標籤，直接傳入損失函數
    answer: D
    explain:
      A: 此 API 把輸入當 logits，先變機率會再被轉換一次。
      B: 整數索引模式的標籤應用 long，小數張量不是這個模式。
      C: 三類需要每筆三個 logits，只保留最高分會丟掉類別軸。
      D: 每筆三個未正規化分數，對應一個 long 類別索引，形狀與型別皆相符。
  - id: c3
    goal: g3
    type: choice
    prompt: Keras 三類輸出為 18×3 logits，標籤為 18×3 獨熱向量。要保持這組輸出與標籤，應選哪項？
    options:
      A: CategoricalCrossentropy，設定 from_logits=True
      B: CategoricalCrossentropy，設定 from_logits=False
      C: SparseCategoricalCrossentropy，設定 from_logits=True
      D: SparseCategoricalCrossentropy，設定 from_logits=False
    answer: A
    explain:
      A: 獨熱標籤選 categorical，未轉機率的 logits 要設 True。
      B: False 代表輸入機率，與題目的原始 logits 不一致。
      C: sparse 版本對應整數標籤，不能保留題目的獨熱格式。
      D: 此設定同時把獨熱誤當整數，也把 logits 誤當機率。
---

## 為什麼需要

客服每封訊息只選查詢、退款、變更其中一類。若退款與客訴可以同時成立，模型交出的結果就要跟著改。後者是多標籤任務（允許同一筆資料同時屬於多個類別）。

損失函數（計算預測與正確答案差距的方法）負責比較結果。優化器（根據損失的變化調整模型參數的工具）負責更新模型。選對優化器，也不能補救輸出和正確答案配錯的問題。

## 直覺

要讓三者的資料格式配合，可依序檢查：

1. 核對輸出層（交出模型預測結果的最後一層）的結果。
2. 核對標籤（資料中用來記錄正確答案的內容）的存法。
3. 確認損失函數能比較這兩種格式的資料。

![先依任務選輸出，再核對標籤的資料排列。需要原始分數的損失函數，會自行把分數轉成機率。](figure:l23203-output-loss-contract-flow)

:::supplement[來源：PyTorch CrossEntropyLoss；Keras Probabilistic losses]
模型還沒轉成機率的輸出，稱為未正規化分數（logits）。這些分數可以是任意有限實數，總和不必為一。

交叉熵（用預測機率與標籤計算差距的損失函數）也要看輸入規則。不同套件的函數名稱都可能寫交叉熵。有的要未正規化分數，有的要機率。讀碼時必須查清楚。
:::

## 定義與公式

| 任務 | 輸出意義 | 標籤 | 損失 |
|---|---|---|---|
| 連續值迴歸 | 線性輸出的數值 | 連續值 | 均方誤差或平均絕對誤差 |
| 二元分類 | Sigmoid 的正類機率 | 0 或 1 | 二元交叉熵 |
| 多類單選 | Softmax 的類別機率 | 一個類別 | 類別交叉熵 |
| 多標籤（補充） | 每標籤獨立 Sigmoid | 多個 0 或 1 | 各標籤二元交叉熵 |

分類列先用機率說明輸出語意；實作若由損失接收 logits，模型末端就保留未轉換分數。

### 多類 API 契約（補充）

設一筆有 $C$ 類，$z_c$ 是第 $c$ 類 logit，$p_c$ 是 Softmax 機率，$y$ 是正確類別索引：

$$
\ell=-\log p_y=-z_y+\log\sum_{c=1}^{C}e^{z_c}.
$$

使用自然對數，所有 logits 有限；本例不加類別權重或標籤平滑。批次損失是每筆損失的平均，$\ell$ 越小表示這個答案獲得的機率越大。

| 框架與格式 | 預測形狀／標籤形狀 | 損失與設定 |
|---|---|---|
| PyTorch 整數、logits | 浮點 N×C／long N | `CrossEntropyLoss` |
| Keras 整數、logits | N×C／N | `SparseCategoricalCrossentropy`，`from_logits=True` |
| Keras 整數、機率 | N×C／N | `SparseCategoricalCrossentropy`，`from_logits=False` |
| Keras 獨熱、logits | N×C／浮點 N×C | `CategoricalCrossentropy`，`from_logits=True` |
| Keras 獨熱、機率 | N×C／浮點 N×C | `CategoricalCrossentropy`，`from_logits=False` |

$N$ 是這批樣本數。Keras 四列都要核對 `from_logits`：logits 用 `True`，機率用 `False`。獨熱向量的正確類別為一，其餘為零。

PyTorch 也支援與預測同形狀的浮點軟標籤，但不能把形狀 N 的小數索引當成它；本頁程式採整數標籤路徑。

### 二元 API 契約（補充）

$$
\ell=-\left[y\log p+(1-y)\log(1-p)\right].
$$

$y$ 是 0 或 1，$p$ 是正類機率，本式採 $0<p<1$ 與自然對數。

這是將 PyTorch 文件中的權重取一，再以 $p=\operatorname{Sigmoid}(z)$ 改寫所得；$z$ 是有限 logit。

機率為零或一時，數學上須用極限處理零乘對數；實作應採 API 的穩定運算或截斷規則，勿直接計算 log(0)。

`BCEWithLogitsLoss` 接 logit 和同形狀浮點標籤，勿先 Sigmoid。

先算 Sigmoid 時，PyTorch 配 `BCELoss`，Keras 配 `BinaryCrossentropy(from_logits=False)`；保留 logit 則改設 True。

## 算一次（補充）

共用資料的契約探針沿用前置組客服 S01：三類 logits 為 −1、0、1，標籤為查詢（索引 0）。其 Softmax 為 0.090031、0.244728、0.665241。

以下以未捨入機率計算，顯示值取六位。代入多類公式得 $\ell\approx2.407606$；整數 0 或獨熱 [1,0,0] 描述同一答案，損失應相等。

不能因模型最高分是「變更」類，就更改原本的查詢標籤。

若把這組機率再傳入 `CrossEntropyLoss`，API 會把它們當成新的 logits。得到約 1.372401，已是另一個計算問題。

二元探針採 $z=1$、$y=1$，Sigmoid 約 0.731059。以未捨入機率代入二元公式得 $\ell\approx0.313262$，兩條正確路徑相等。

## 程式（補充）

本段在 PyTorch 2.15.0+cpu、Keras 3.15.1（TensorFlow 2.21.0 後端）實測，使用 CPU。

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

若使用[教材程式檢查工具 run-code.mjs](https://github.com/polluxyz/ipas-study/blob/main/demo/scripts/check-textbook/README.md)，請保留 `IPAS_REPO_ROOT` 設定，讓程式在暫存目錄仍能找到資料。一般執行仍依前句設定路徑。同頁各段按順序接續執行。

以下使用共用檔的契約探針；它不是訓練後的預測。以 PyTorch 與 Keras 的實際 API 核對相同標籤的兩種表示。

```python
import json, os
from pathlib import Path
import torch
import keras
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-C-frameworks.json').read_text(encoding='utf-8'))
q = d['contract_probe']
z = torch.tensor(q['logits'], dtype=torch.float32)
y = torch.tensor(q['integer_labels'], dtype=torch.long)
p = z.softmax(dim=1)
ce = torch.nn.CrossEntropyLoss()
print('形狀:', tuple(z.shape), tuple(y.shape), y.dtype)
print('正確與重複轉換:', round(ce(z,y).item(),6), round(ce(p,y).item(),6))
```
```text
形狀: (1, 3) (1,) torch.int64
正確與重複轉換: 2.407606 1.372401
```

```python
yi = keras.ops.array(q['integer_labels'],dtype='int32')
yh = keras.ops.array(q['one_hot_labels'],dtype='float32')
zl = keras.ops.array(q['logits'],dtype='float32')
prob = keras.ops.convert_to_numpy(keras.ops.softmax(zl))
s = keras.losses.SparseCategoricalCrossentropy(from_logits=True)(yi,zl)
c = keras.losses.CategoricalCrossentropy(from_logits=True)(yh,zl)
cp = keras.losses.CategoricalCrossentropy(from_logits=False)(yh,prob)
sp = keras.losses.SparseCategoricalCrossentropy(from_logits=False)(yi,prob)
print('整數 logits／獨熱 logits／獨熱機率／整數機率:', *[round(float(v),6) for v in (s,c,cp,sp)])
bz = torch.tensor([q['binary_logit']], dtype=torch.float32)
by = torch.tensor([q['binary_label']], dtype=torch.float32)
a = torch.nn.BCEWithLogitsLoss()(bz,by)
b = torch.nn.BCELoss()(bz.sigmoid(),by)
print('二元兩條路:', round(a.item(),6), round(b.item(),6))
```
```text
整數 logits／獨熱 logits／獨熱機率／整數機率: 2.407606 2.407606 2.407606 2.407606
二元兩條路: 0.313262 0.313262
```

:::tip[讀碼重點]
`dim=1` 指每筆的類別軸。`from_logits` 描述預測值是否已轉換，`Sparse` 描述標籤格式，兩者各管一件事。
:::

## 怎麼用、怎麼判讀

先問答案能否同時屬於多類，再查標籤的形狀、型別與值域，最後看輸出是否已套激活函數。損失與優化器要分開檢查，損失低也不等於業務決策一定好。

### 換個場景

| 場景 | 任務條件 | 配對重點 |
|---|---|---|
| 連續值預測 | 答案是數量 | 依誤差需求選均方或絕對誤差 |
| 是非與多類判斷 | 答案是離散類別 | 二元和類別交叉熵分工 |
| 製造瑕疵（補充） | 正常、刮痕、缺角三類單選 | 每張一個整數或獨熱標籤 |
| 醫療共病（補充） | 多種疾病可同時成立 | 每病獨立二元輸出 |
| 客服路由（補充） | 先訂複合需求的單選規則 | 不把獨立標籤誤當互斥類別 |

## 常見誤解

- 「交叉熵前一定放 Softmax」：要依 API 看是否內含轉換。（補充）
- 「整數標籤一定配 categorical」：Keras 的整數索引用 sparse 版本。（補充）
- 「優化器負責判定輸出是不是機率」：它負責更新參數，輸入語意由模型與損失約定。

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-61`、`guide-3:4-62`、`guide-3:4-65`、`guide-3:4-66`：損失分工、任務與輸出層配對。
- [PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.CrossEntropyLoss.html)：多類公式、形狀與重複轉換反例。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html)：二元公式取權重一後改寫，以及數值穩定運算。
- [Keras Probabilistic losses](https://keras.io/api/losses/probabilistic_losses/)：標籤格式與 from_logits 的 API 規則。
- [Dive into Deep Learning 4.1](https://d2l.ai/chapter_linear-classification/softmax-regression.html)：先定義單選任務，再解釋正確類別機率的教學順序。

## 小結

- 任務與標籤決定輸出層和損失的搭配。
- logits 與機率是不同輸入格式。（補充）
- Keras 的標籤格式與 from_logits 要各自檢查。（補充）
- 同一答案改成獨熱表示，配對正確時損失不變。（補充）
