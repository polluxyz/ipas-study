---
id: positional-encoding
title: 位置編碼
kind: component
codes:
  - L23203
aliases:
  - Positional Encoding
  - 位置資訊
summary: 位置編碼把順序線索加入詞元表示，讓相同詞彙在不同位置可以區分
goals:
  - id: g1
    text: 以交換詞序反例說明位置向量和詞義向量的分工
requires: [embedding-representation]
guide_refs:
  - guide-3:4-80
  - guide-3:4-81
textbook: v2
author: codex
status: draft
part_of:
  - transformer
formula_groups:
  - id: sinusoidal-position
    source: https://d2l.ai/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩個句子只有「客戶、退款」的順序相反。模型完全沒有位置訊息，注意力也沒有遮罩。下列何者正確？
    options:
      A: 詞元 ID 已自帶位置，因此兩句一定得到不同的句級表示
      B: 多加兩個注意力頭，就能從相同詞向量保證還原原始詞序
      C: Softmax 會自動重排詞元，因此兩句會先被排成同一個順序
      D: 詞向量不直接編入次序，需加入位置訊息供模型區分詞序
    answer: D
    explain:
      A: 詞元 ID 指的是字詞身份，不代表它在句中的位置。
      B: 投影頭沒有新增位置來源，不能保證從無到有恢復順序。
      C: Softmax 轉換分數為權重，不是排序演算法。
      D: 沒有位置資訊時，輸入換序，輸出也只會跟著換序；位置向量提供額外順序線索。
  - id: c2
    goal: g1
    type: choice
    prompt: 二維正弦位置向量取（sin p，cos p）。退款的詞向量是（0，1），放在位置 1（從 0 起算）後最接近哪個表示？
    options:
      A: （0.0000，2.0000），把它當作位置 0 的向量相加
      B: （0.8415，1.5403），把位置 1 的向量逐維相加
      C: （0.0000，0.5403），把位置 1 的向量逐維相乘
      D: （0.8415，0.5403），只留下位置 1 而刪掉詞義
    answer: B
    explain:
      A: 位置零才對應零與一，題目指定位置一。
      B: 位置一的正弦約零點八四一五，餘弦約零點五四零三。
      C: 原始加法位置編碼做相加，不是逐項乘法。
      D: 這只剩位置向量，沒有保留退款的詞向量。
---

## 為什麼需要

「甲協助乙」與「乙協助甲」使用相同詞彙，角色卻不同。單靠詞元的內容表示不足以直接交代順序；位置編碼（Positional Encoding）把位置線索送入模型。

## 直覺

同一個詞的嵌入表達內容，位置向量表達它放在哪一格。原始 Transformer 將兩者逐維相加，維度必須一致。

![看同一個詞移到另一格時加入不同位置向量，詞義與位置兩種訊息一起進入模型。](figure:l23203-positional-encoding-order)

:::supplement[來源：Dive into Deep Learning 11.6]
沒有位置訊息、遮罩或其他順序線索的自注意力，交換輸入詞元會讓輸出依同樣方式交換。這叫置換等變性（permutation equivariance），不等於每個位置輸出完全相同。

若再做不看順序的池化，兩句可得到相同結果。
:::

## 定義與公式

指引介紹把正弦、餘弦形式的位置向量加入詞嵌入。詞元的位置由資料排列決定，並非詞彙 ID 的大小。

### 原始正弦版本（補充）

$$
P_{p,2i}=\sin\left(\frac{p}{10000^{2i/d}}\right),\qquad
P_{p,2i+1}=\cos\left(\frac{p}{10000^{2i/d}}\right),\qquad Z=E+P
$$

- $p$ 從零起算；$d$ 是正偶數表示寬度，$i=0,\ldots,d/2-1$ 標示成對特徵。
- $E,P,Z$ 為詞嵌入、位置矩陣與合成表示，皆為 $L\times d$；$L$ 是配置長度。

這是原始架構的一種設計。位置也可用可學習向量或其他方式表達，不應把所有 Transformer 都說成只能用這條式子。

## 算一次（補充）

客服 S01 抽出「客戶／退款」後，示範重新編為位置 0、1。詞向量為 $(1,0)$、$(0,1)$；二維位置向量為 $(\sin p,\cos p)$。

| 位置 | 詞元與嵌入 | 位置向量 | 相加後 |
|---|---|---|---|
| 0 | 客戶（1，0） | （0，1） | （1，1） |
| 1 | 退款（0，1） | （0.841471，0.540302） | （0.841471，1.540302） |

把兩詞順序交換後，退款在位置 0 成為 $(0,2)$；客戶在位置 1 成為 $(1.841471,0.540302)$。位置跟著格子，詞嵌入跟著詞。

醫療「病人／疼痛」也能套相同位置向量。改變詞元內容時，位置向量仍由格子決定，不會把「病人」編成「第一格」這個詞。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))
ids = np.array(d["service"][0]["token_id"])[d["probe"]["positions"]]
x = np.array(d["embedding"], dtype=float)[ids]
p = np.arange(len(x))
pe = np.stack([np.sin(p), np.cos(p)], axis=-1)
print("位置:", np.round(pe, 6).tolist())
print("原序:", np.round(x + pe, 6).tolist())
print("換序:", np.round(x[::-1] + pe, 6).tolist())
print("詞集合未變:", np.array_equal(x.sum(axis=0), x[::-1].sum(axis=0)))
```
```text
位置: [[0.0, 1.0], [0.841471, 0.540302]]
原序: [[1.0, 1.0], [0.841471, 1.540302]]
換序: [[0.0, 2.0], [1.841471, 0.540302]]
詞集合未變: True
```

:::tip[讀碼重點]
反轉的是詞向量列，pe 保持位置 0、1 的順序。這展示位置注入，沒有宣稱單純把相加結果再求和就能辨識詞序；模型還須用後續運算利用位置線索。
:::

## 怎麼用、怎麼判讀

看模型是否已取得順序線索，再看位置如何注入。位置編碼告訴模型「在哪裡」，因果遮罩則告訴它「可以讀哪裡」；兩者分工不同。（補充）

### 換個場景

| 場景 | 順序需求 | 判讀重點 |
|---|---|---|
| 無循環結構的文字序列 | 相同詞彙可有不同次序 | 注入格子的位置訊息 |
| 客服處理順序（補充） | 先退款或先查詢有差異 | 詞向量不等於位置向量 |
| 醫療紀錄（補充） | 用藥前後的症狀不同 | 位置不自動等於實際時間 |

## 常見誤解

- 「ID 較大表示詞出現較晚。」詞彙編號與序列位置是不同欄位。（補充）
- 「位置編碼取代原本詞義。」本例將兩者相加，並未只保留位置。
- 「有位置向量便能看未來。」能否讀取仍由遮罩和可用資料決定。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-80`、`guide-3:4-81`：支持順序不足、正弦餘弦與相加的概念。
- [Dive into Deep Learning 11.6](https://d2l.ai/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.html)：支持公式、換序反例與教學安排。
- [原始論文 3.5](https://arxiv.org/html/1706.03762v7)：核對原始位置編碼設計。

## 小結

- 詞嵌入表達內容，位置向量提供順序。
- 位置跟格子走，詞嵌入跟詞走。
- 原始版本相加，二者寬度須一致。
- 有位置訊息仍須正確設定遮罩。（補充）
