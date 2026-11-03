---
id: transformer-encoder-decoder
title: Transformer 編碼器與解碼器
kind: component
codes:
  - L23203
aliases:
  - Causal Mask
  - Cross-Attention
  - Decoder
  - Encoder
summary: 編碼器整理來源序列，解碼器結合來源表示與目標前綴逐步生成
goals:
  - id: g1
    text: 追蹤編碼器、遮罩自注意力與跨注意力的 Q、K、V 來源
requires:
  - self-attention
guide_refs:
  - guide-3:4-77
  - guide-3:4-78
  - guide-3:4-79
  - guide-3:4-83
textbook: v2
author: codex
status: draft
part_of:
  - transformer
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服輸入有 4 詞，解碼前綴有 3 詞。跨注意力的 Q、K、V 來自哪裡？
    options:
      A: Q 來自來源四詞；K、V 來自目標三詞
      B: Q、K 來自目標三詞；V 來自來源四詞
      C: Q、K、V 都來自來源；目標只拿來算損失
      D: Q 來自目標三詞；K、V 來自來源四詞
    answer: D
    explain:
      A: 來源提供被查詢內容，跨注意力的查詢應由生成端提出。
      B: 鍵和值必須對應相同來源位置，不能把目標鍵配來源值。
      C: 解碼器的當前狀態參與查詢，不是只用於損失。
      D: 目標端查詢來源的鍵和值，分數矩陣可為三乘四。
  - id: c2
    goal: g1
    type: choice
    prompt: 訓練輸入依序是「起始、客戶、提交、退款」，標籤是「客戶、提交、退款、結束」。位置 2（從 0 起算）可看哪些目標輸入？
    options:
      A: 可看位置 0、1、2；位置 3 仍被遮住
      B: 可看位置 0、1、2、3；已有完整標籤
      C: 只可看位置 0、1；對角線也必須遮住
      D: 只可看位置 2、3；其餘屬於較舊資訊
    answer: A
    explain:
      A: 右移輸入後位置二可讀自身輸入提交，但不可讀下一格退款。
      B: 訓練雖知道標籤，仍須避免未來輸入洩漏。
      C: 對角線是已知前綴的一部分，可以保留。
      D: 因果方向相反，不能讀未來而排除過去。
---

## 為什麼需要

翻譯與摘要的輸入、輸出可能長度不同。編碼器（Encoder）先整理來源資訊，解碼器（Decoder）再根據這些表示和已知目標前綴產生輸出。

## 直覺

編碼器內的詞元互相讀取來源內容；解碼器先處理目標前綴，再到來源表示尋找相關資訊。兩個步驟的注意力資料來源不同。

![沿來源與目標兩路閱讀，跨注意力從編碼器取得鍵和值，每個子層另有殘差與正規化。](figure:l23203-transformer-encoder-decoder-stacks)

## 定義與公式

本頁的標準結構指2017年原始Transformer，包含編碼器與解碼器堆疊；只含編碼器或解碼器的變體另依其架構判斷。

標準編碼器每層有多頭自注意力和逐位置前饋網路。標準解碼器在遮罩自注意力之後，多一個跨注意力（Cross-Attention）子層，再接前饋網路。

用 Q、K、V 追蹤時，「自」表示三者來自同一序列；「跨」表示生成端的查詢去讀來源端的鍵和值。

| 注意力所在處 | Q 的來源 | K、V 的來源 |
|---|---|---|
| 編碼器自注意力 | 來源端該層輸入 | 同一份來源表示 |
| 解碼器遮罩自注意力 | 目標端該層輸入 | 同一份目標表示 |
| 解碼器跨注意力 | 遮罩子層後的目標表示 | 編碼器最終輸出 |

表格對照指引 4-77～4-79 的編解碼角色與同序列投影。

:::supplement[來源：Attention Is All You Need，第 3.2.3 節]
查詢與鍵的特徵寬度須能計算配對，鍵和值的位置數須相同。
:::

## 走一次流程

共用客服 S01 的四格來源先進編碼器。假設要生成「客戶／提交／退款／結束」，生成端從起始符號開始，讀來源表示後逐步輸出。

1. 來源詞元加入位置向量，經編碼器變成四個上下文表示。
2. 解碼器只讀已知目標前綴，遮罩阻擋未來目標詞。
3. 跨注意力用目標狀態查詢四個來源表示。
4. 前饋、輸出投影與詞彙 Softmax 選出下一詞，再把它接回前綴。（補充）

### 訓練時右移一格（補充）

共用例子的訓練輸入是「起始／客戶／提交／退款」，預測標籤是「客戶／提交／退款／結束」。位置 2 讀到「提交」，任務是預測「退款」，因此不能讀輸入位置 3。

醫療 M01 也可把四格來源轉成較短的摘要；來源長度不必等於目標長度。四格來源配三格目標時，跨注意力分數為三列、四欄。來源填補遮罩與目標因果遮罩要分開設定。

## 程式（補充）

以下另把 S02「客戶／查詢／訂單／填補」當作目標端的遮罩測試序列，並非上節無填補的右移輸入。合併的是目標端自身的填補遮罩與因果遮罩；來源端的填補遮罩仍須另設。

程式只驗證可見範圍，沒有訓練語言模型。自訂 allowed 中 True 表示可讀。

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))
target_valid = np.array(d["service"][1]["valid_mask"])
length = len(target_valid)
causal = np.tril(np.ones((length, length), dtype=bool))
allowed = causal & target_valid[None, :]
print("有效鍵:", target_valid.astype(int).tolist())
print("位置2可讀:", np.flatnonzero(allowed[2]).tolist())
print("合併形狀:", allowed[None, None].shape)
print("未來可見數:", int(np.triu(allowed, 1).sum()))
```
```text
有效鍵: [1, 1, 1, 0]
位置2可讀: [0, 1, 2]
合併形狀: (1, 1, 4, 4)
未來可見數: 0
```

:::tip[讀碼重點]
此處四維形狀可廣播到批次×頭×查詢×鍵。PyTorch MultiheadAttention 的布林遮罩則以 True 表示阻擋，不能直接把本例 allowed 當作該 API 的遮罩。
:::

## 怎麼用、怎麼判讀

先問輸出能看什麼：來源完整已知，可供跨注意力讀取；目標未來尚未生成，須被因果遮罩隔開。遮住填補鍵不等於排除填補查詢的損失，兩者須各自處理。（補充）

### 換個場景

| 場景 | 輸入到輸出 | 判讀重點 |
|---|---|---|
| 機器翻譯 | 來源句到目標句 | 長度可不同 |
| 自迴歸文本生成 | 前綴到下一詞 | 不能讀未來目標 |
| 客服摘要（補充） | 對話到重點 | 跨注意力讀來源 |
| 病歷摘要（補充） | 紀錄到簡述 | 需另外核對事實 |

## 常見誤解

- 「跨注意力的三者都出自來源。」查詢來自目標端，鍵和值才來自來源。
- 「每種 Transformer 都含完整編解碼器。」BERT 採僅編碼器，GPT 採僅解碼器；詳見[BERT、GPT 與 T5 的訓練任務比較](/concepts/transformer-model-families/)。
- 「來源未來詞也必須全部遮住。」一般離線翻譯的完整來源已知；不能偷看的是未來目標。

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-77`、`guide-3:4-78`：支持編解碼子層、翻譯與生成角色。
- 科目 3 指引 `guide-3:4-79`、`guide-3:4-83`：支持同序列 QKV 投影及 BERT／GPT 的架構區別。
- [原始論文 3.1、3.2.3](https://arxiv.org/html/1706.03762v7)：支持 QKV 對照與右移目標。
- [PyTorch MultiheadAttention](https://docs.pytorch.org/docs/2.15/generated/torch.nn.MultiheadAttention.html)：支持程式後的遮罩語意提醒。
- [Dive into Deep Learning 11.7](https://d2l.ai/chapter_attention-mechanisms-and-transformers/transformer.html)：參考來源／目標兩路追蹤的教學安排。

## 小結

- 編碼器產生來源的上下文表示。
- 解碼器先處理目標前綴，再查詢來源。
- 因果遮罩限制未來目標，填補遮罩排除無效鍵。（補充）
