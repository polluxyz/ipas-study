---
id: multi-head-attention
title: 多頭注意力
kind: component
codes:
  - L23203
aliases:
  - Multi-head Attention
summary: 多頭注意力在不同投影空間各算權重，再拼接並投影回模型寬度
goals:
  - id: g1
    text: 核對多頭的子空間、獨立計算、拼接維度與輸出投影
requires:
  - self-attention
guide_refs:
  - guide-3:4-80
textbook: v2
author: codex
status: draft
part_of:
  - transformer
formula_groups:
  - id: multi-head-output
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.MultiheadAttention.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 批次 1、長度 4、模型寬度 8，設 2 頭且每頭值寬度 4。拼接後再投影的形狀正確的是？
    options:
      A: 每頭 1×4×4；拼接 1×4×8；輸出仍為 1×4×8
      B: 每頭 1×2×8；拼接 1×4×8；輸出仍為 1×4×8
      C: 每頭 1×4×8；拼接 1×4×8；輸出仍為 1×4×8
      D: 每頭 1×4×4；拼接 1×8×4；輸出仍為 1×8×4
    answer: A
    explain:
      A: 拆的是特徵子空間，拼接恢復八維，再經輸出投影。
      B: 這把頭數用來切序列長度，與標準多頭分工不同。
      C: 若每頭八維，兩頭拼接會是十六維，不是八維。
      D: 拼接沿最後的特徵軸，不能把序列長度加倍。
  - id: c2
    goal: g1
    type: choice
    prompt: 模型寬度固定 64，把 1 頭改成 8 頭，其他投影配置保持標準設計。哪項判斷最恰當？
    options:
      A: 每頭都會學到固定語法；因此部署延遲一定下降
      B: 頭數增加就少掉投影；因此參數量一定減為八分之一
      C: 各頭各算關聯再整合；是否更快需依實測確認
      D: 先把八頭權重平均一次；然後只需執行一組加權
    answer: C
    explain:
      A: 沒有指定每頭必學哪種關係，也不能保證加速。
      B: 標準多頭仍有投影，固定總寬度時不會自動大幅減參。
      C: 多頭增加不同子空間的表達機會，效能與速度仍須驗證。
      D: 標準做法為各頭分別加權值向量，再拼接輸出。
---

## 為什麼需要

一個詞可能同時需要參考主詞、動詞和遠距背景。多頭注意力（Multi-head Attention）用多組投影處理不同關聯，再整合成每個位置的新表示。

## 直覺

同一份輸入送到多個頭，各頭在自己的表示子空間算注意力。最後沿特徵軸拼接；它不是把句子切成互不相見的幾段。

![看特徵寬度如何拆成兩頭再合回：詞元數始終不變，末端還有輸出投影。](figure:l23203-multi-head-attention-split)

## 定義與公式

每頭有自己的 Q、K、V 投影，獨立計算權重和加權輸出，再拼接與線性轉換。不同頭可以學到不同關係，但不保證頭與頭必定有不同功能。

### 帶維度的表示（補充）

$$
H_r=\operatorname{Attention}(XW_{Q,r},XW_{K,r},XW_{V,r}),\qquad
Y=\operatorname{Concat}(H_1,\ldots,H_h)W_O
$$

- $r$ 是頭索引，$h$ 是頭數；$X$ 有 $L$ 個位置及 $d$ 維特徵。
- $d_v$ 是每頭值寬度；$H_r$ 為 $L\times d_v$，拼接後為 $L\times hd_v$。
- $W_O$ 為 $hd_v\times d$；輸出 $Y$ 回到 $L\times d$。

常用配置令每頭 $d_k=d_v=d/h$，因此 $d$ 須可被 $h$ 整除。這是固定總寬度的設計，不是把每頭都設成完整的 $d$ 維。

## 算一次（補充）

沿用客服 S01 位置 0、3 的 $X=I_2$。本例總寬度二、兩頭，所以每頭寬度一；合併的 QKV 投影仍取單位矩陣，每頭分別取一欄。

| 查詢位置 | 頭 1 的輸出 | 頭 2 的輸出 | 拼接 |
|---|---|---|---|
| 0 | 0.731059 | 0.500000 | （0.731059，0.5） |
| 3 | 0.500000 | 0.731059 | （0.5，0.731059） |

頭 1 首列分數 $(1,0)$，權重約 $(0.731059,0.268941)$，彙整值 $(1,0)$ 後輸出 $0.731059$。

頭 2 的首列查詢為零，兩鍵分數皆零，對兩個位置的頭 2 值 $0$ 與 $1$ 取平均，得到 $0.5$。

輸出投影矩陣如下，沿用共用 JSON 的 Wo。

$$
W_O=\begin{bmatrix}1&1\\1&-1\end{bmatrix}
$$

拼接結果右乘 $W_O$，首列為 $(1.231059,0.231059)$，次列為 $(1.231059,-0.231059)$。輸出投影整合各頭，省略會改變最終表示。

醫療「病人／疼痛」沿用相同二維向量，也能重算這兩頭；數值展示子空間差異，不是在替各頭命名醫療功能。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))
ids = np.array(d["service"][0]["token_id"])[d["probe"]["positions"]]
x = np.array(d["embedding"], dtype=float)[ids]
q, k, v = ((x @ np.array(d[w])).reshape(2, 2, 1).transpose(1, 0, 2) for w in ["Wq", "Wk", "Wv"])
s = q @ k.transpose(0, 2, 1) / np.sqrt(q.shape[-1])
e = np.exp(s - s.max(axis=-1, keepdims=True))
out = (e / e.sum(axis=-1, keepdims=True)) @ v
joined = out.transpose(1, 0, 2).reshape(2, 2)
print("每頭形狀:", q.shape, "權重形狀:", s.shape)
print("拼接:", np.round(joined, 6).tolist())
print("投影:", np.round(joined @ np.array(d["Wo"]), 6).tolist())
```
```text
每頭形狀: (2, 2, 1) 權重形狀: (2, 2, 2)
拼接: [[0.731059, 0.5], [0.5, 0.731059]]
投影: [[1.231059, 0.231059], [1.231059, -0.231059]]
```

:::tip[讀碼重點]
本例未加批次軸，形狀順序為頭×位置×每頭寬度。先移動頭軸，再 reshape 拼接；直接攤平會混掉不同位置的資料。
:::

## 怎麼用、怎麼判讀

可以讓一頭偏向局部搭配，另一頭偏向遠距關聯，但這是可能學到的模式，並非預先保證。觀察效果要回到任務驗證，不只看頭數。

:::supplement[來源：PyTorch MultiheadAttention；Attention Is All You Need，第 3.2.2 節]
固定總寬度下，增加頭數不會自動減少投影參數。運算切得更細也未必更快，需把硬體、核心實作與序列長度一起量測。
:::

### 換個場景

| 場景 | 關聯需求 | 判讀重點 |
|---|---|---|
| 序列的多種上下文 | 不同子空間並行建模 | 獨立加權後才拼接 |
| 客服訊息（補充） | 意圖詞與指代詞 | 不預設每頭的語法角色 |
| 醫療紀錄（補充） | 症狀與時間背景 | 頭多不等於醫療更可靠 |

## 常見誤解

- 「兩頭就是把四詞切成兩段。」標準多頭沿特徵子空間分工，各頭仍可讀全部可見詞元。
- 「拼接後直接平均權重就是完整輸出。」標準流程還包含輸出投影。（補充）
- 「多頭保證加速或減少參數。」它首先改變的是表示方式，速度與參數須依配置判斷。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-80`：支持多頭、獨立投影、拼接與線性轉換。
- [PyTorch MultiheadAttention](https://docs.pytorch.org/docs/2.15/generated/torch.nn.MultiheadAttention.html)：支持維度公式與實作條件。
- [原始論文 3.2.2](https://arxiv.org/html/1706.03762v7)：核對原始多頭設計。
- [Dive into Deep Learning 11.5](https://d2l.ai/chapter_attention-mechanisms-and-transformers/multihead-attention.html)：參考拆軸、合軸的教學安排。

## 小結

- 每頭有自己的投影與注意力權重。
- 拼接沿特徵軸，不改變詞元數。
- 輸出投影把多頭結果整合回模型寬度。
- 頭數與部署速度的關係需要實測。（補充）
