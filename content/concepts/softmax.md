---
id: softmax
title: Softmax
kind: component
codes: [L21102, L23203, L23304]
aliases: [正規化指數函數]
summary: Softmax 把同一筆資料的多類分數轉成總和為一的機率向量
goals:
  - id: g1
    text: 算出三類 Softmax，區分單選與多標籤並配對 logits 損失契約
requires: [activation-functions]
guide_refs: [guide-3:5-35, guide-3:5-36, guide-3:4-65, guide-1:3-48]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: softmax-probabilities
    source: https://d2l.ai/chapter_linear-classification/softmax-regression.html#the-softmax
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-B
  - id: softmax-stable
    source: https://d2l.ai/chapter_linear-classification/softmax-regression-concise.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服系統只能把訊息分到查詢、退款、變更其中一類，logits 依序為 −1、0、1。Softmax 輸出最接近哪組？
    options:
      A: （0.2689、0.5000、0.7311）
      B: （0.3333、0.3333、0.3333）
      C: （0.6652、0.2447、0.0900）
      D: （0.0900、0.2447、0.6652）
    answer: D
    explain:
      A: 這是逐項 Sigmoid，總和 1.5，不是三類 Softmax。
      B: 三個 logits 不相等，輸出不會平均分配。
      C: 這把最大與最小分數的類別次序顛倒。
      D: 指數值除以共同總和，最大分數一對應約 0.6652。
  - id: c2
    goal: g1
    type: choice
    prompt: 一個 PyTorch 模型輸出形狀為 24×3 的 logits，標籤為 24 個整數類別。團隊採用 CrossEntropyLoss，哪個安排正確？
    options:
      A: 先把 24×3 logits 轉成機率，再當 logits 傳給該損失
      B: 直接把 24×3 logits 傳入損失，顯示機率時才轉換
      C: 沿 24 筆樣本做 Softmax，讓每個類別欄的總和為一
      D: 先把 24 個標籤改成小數機率，再傳成整數類別索引
    answer: B
    explain:
      A: 該 API 需要未正規化分數，預先 Softmax 會重複轉換並改變損失。
      B: 整數標籤配 logits 即符合這組 API 契約，推論顯示才另算機率。
      C: 分類機率要在同一樣本的三類之間正規化，不能跨樣本。
      D: 題目採整數類別索引，不能把小數機率誤當索引。
---

## 為什麼需要

多類單選需要把同一筆資料的各類分數放在一個分配裡比較。Softmax（正規化指數函數）把這些分數轉成總和為一的機率向量。

它常用於多類別單標籤的輸出層，一筆資料最後選一個類別。

:::supplement[來源：Dive into Deep Learning 4.1]
任務須先定義類別互斥，不能靠函數讓現實中的重疊事件變得互斥。例如客服路由若採三類單選，就須先決定複合需求的標註規則。
:::

## 直覺

同一筆資料的分數先各自取指數，再分配共同的一份總量。分數較高的類別取得較多，其他類別仍保留非零機率。

![客服三類分數的假設對照：粗條 Softmax 總和一，細條逐項 Sigmoid 總和 1.5；這不是 Sigmoid 頁的多標籤欄位。](figure:l23203-softmax-class-axis)

:::supplement[來源：Keras Layer activation functions]
正規化沿「類別軸」進行，不能沿樣本軸把不同人的輸出混在一起。每筆資料各有自己的一組分母。
:::

## 定義與公式

$$
p_i=\frac{e^{z_i}}{\sum_{j=1}^{K}e^{z_j}}
$$

$z_i$ 是第 $i$ 類未正規化分數（logit），$K$ 是同一筆資料的類別數，$j$ 遍歷所有類別，$p_i$ 是轉換後機率，$e$ 是自然指數的底數。這裡 $K$ 為正整數，各 $z_j$ 為有限實數；因為 $e^{z_j}>0$，共同分母一定大於零，可以安心相除。

各類共用分母，機率總和為一。用最大機率選最終類別時，仍是在原先定義的單選任務裡做決策。

:::supplement[來源：Dive into Deep Learning 4.1.1.2；Keras Layer activation functions]
指引 5-35 分母內的索引誤印為 $z_i$，應為遍歷各類的 $z_j$。本頁依上述來源校正；若照誤植計算，各類都會變成 $1/K$，失去分數間的差異。
:::

### 穩定計算（補充）

$$
m=\max_j z_j,\qquad
p_i=\frac{e^{z_i-m}}{\sum_{j=1}^{K}e^{z_j-m}}
$$

$m$ 是這筆資料的最大 logit。所有分數同減 $m$ 不改變結果，卻能避免直接對很大的正數取指數；極小項在浮點數中仍可能下溢為零。

## 算一次（補充）

客服 S01 的三類 logits 是 $(-1,0,1)$，依序為查詢、退款、變更。本次取同份資料的互斥單選欄位，不是 Sigmoid 頁的多標籤欄位。

| 類別 | logit | 指數值 | 機率 |
|---|---|---|---|
| 查詢 | −1 | 0.367879 | 0.090031 |
| 退款 | 0 | 1.000000 | 0.244728 |
| 變更 | 1 | 2.718282 | 0.665241 |

分母約 4.086161，變更類為 $2.718282/4.086161\approx0.665241$。三值相加為一，但這不是跨樣本的正確率。

改用穩定式，$m=1$，指數輸入變成 $(-2,-1,0)$。變更類為 $1/1.503215\approx0.665241$，結果相同。

四函數共用向量 $(-4,-1,0,1,4)$，若整組視為一筆五類 logits，得到：

$$
p\approx(0.000312,0.006267,0.017035,0.046306,0.930080).
$$

$p$ 是依原向量次序排列的五類機率，與 ReLU、Sigmoid、Tanh 的逐項轉換不同。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))
z = np.array(d["service"]["rows"][0]["logits_3"], dtype=float)
def softmax(a):
    e = np.exp(a - a.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)
p = softmax(z)
print("三類:", np.round(p, 6).tolist(), "總和:", round(float(p.sum()), 6))
print("平移後:", np.allclose(p, softmax(z + 1000)))
print("五類:", np.round(softmax(np.array(d["probes"])), 6).tolist())
```
```text
三類: [0.090031, 0.244728, 0.665241] 總和: 1.0
平移後: True
五類: [0.000312, 0.006267, 0.017035, 0.046306, 0.93008]
```

:::tip[讀碼重點]
`axis=-1` 是本例的類別軸；`keepdims=True` 保留可相除的形狀。若輸入改成 24×3，仍是每一列的三類各自正規化。
:::

## 怎麼用、怎麼判讀

單標籤多類分類用 Softmax，把一個樣本的類別視為一份分配；多標籤用逐項 Sigmoid，允許多個標籤同時成立。不能僅因兩者輸出都介於零與一，就互相替換。

### 與損失 API 配對（補充）

| 任務與輸出 | 損失安排 | 是否先轉機率 |
|---|---|---|
| PyTorch 三類 logits | `CrossEntropyLoss`＋整數標籤 | 不先做 Softmax |
| Keras 三類 logits | categorical 系列，`from_logits=True` | 不先做 Softmax |
| Keras 三類機率 | categorical 系列，`from_logits=False` | 已經轉好 |

Keras 的 `SparseCategoricalCrossentropy` 配整數類別，`CategoricalCrossentropy` 配獨熱標籤。

PyTorch 也支援其他標籤形式，本表只列整數類別契約。完整損失讀碼見[[cross-entropy-loss]]。

### 換個場景

| 場景 | 任務條件 | 判讀重點 |
|---|---|---|
| 多類別單選 | 每筆一個類別 | 同筆各類總和一 |
| 影像分類的輸出層 | 類別數等於輸出數 | 機率軸是類別軸 |
| 客服路由（補充） | 每則只分派一個主類 | 複合需求須先定標註規則 |
| 醫療分級（補充） | 每人一個互斥分級 | 不拿總和一當校準證明 |

## 常見誤解

- 「總和為一表示各類統計獨立。」這是機率分配約束，互斥類別也不是統計獨立。（補充）
- 「最大機率 0.99 保證預測正確。」模型可能過度自信，需評估資料與機率校準。（補充）
- 「所有交叉熵 API 都要先 Softmax。」要先查它接收 logits 還是機率。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-35`、`guide-3:5-36`、`guide-3:4-65`：支持 Softmax 的輸出層與多類單選用途；PDF 169 頁的分母索引誤植見定義與公式的校正。
- 科目 1 指引 `guide-1:3-48`：支持影像分類輸出層的場景。
- [Keras 激活函數文件](https://keras.io/api/layers/activations/)：支持定義、類別軸與圖中的逐項比較。
- [Dive into Deep Learning 4.1.1.2](https://d2l.ai/chapter_linear-classification/softmax-regression.html#the-softmax)：支持公式、分母索引校正與機率解釋，並供算一次的教學安排參考。
- [Dive into Deep Learning 4.5.2](https://d2l.ai/chapter_linear-classification/softmax-regression-concise.html)：支持穩定計算、平移算例與 logits 契約。
- [PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/2.15/generated/torch.nn.CrossEntropyLoss.html)：支持損失 API 表與檢核小題的 logits 契約。
- [Keras 機率損失文件](https://keras.io/api/losses/probabilistic_losses/)：支持 categorical／sparse、`from_logits` 配對。

## 小結

- Softmax 在同一筆資料的類別之間分配機率，總和一。
- 單選與多標籤的任務語意決定輸出形式。
- 同減最大分數可穩定計算，結果不變。（補充）
- 訓練前確認損失接收 logits 還是機率。（補充）
