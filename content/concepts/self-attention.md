---
id: self-attention
title: 自注意力與多頭注意力
kind: component
codes:
  - L23203
  - L21101
aliases:
  - Key
  - Query
  - Value
  - 自注意力與 Q、K、V
summary: 自注意力讓每個位置參考同一句的其他位置，按相關程度取用內容
goals:
  - id: g1
    text: 以 QKV 與權重說明同序列遠距詞元如何交換資訊
  - id: g2
    text: 計算縮放點積、Softmax 與輸出，區分單頭和多頭的職責
requires: [softmax, matrix-operations]
guide_refs:
  - guide-1:3-25
  - guide-3:4-78
  - guide-3:4-79
  - guide-3:4-80
textbook: v2
author: codex
status: draft
part_of:
  - transformer
formula_groups:
  - id: qkv-projections
    source: https://arxiv.org/html/1706.03762v7
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-G
  - id: scaled-dot-product
    source: https://d2l.ai/chapter_attention-mechanisms-and-transformers/attention-scoring-functions.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 四詞客服句的「他」要參考開頭的「客戶」。下列哪項最能說明自注意力的作用？
    options:
      A: 把「他」固定改成「客戶」，任何句子都使用同一規則
      B: 讓「他」對本句位置分配權重，再整合那些位置的值
      C: 把四詞先壓成同一個值，之後不再保留位置的差異
      D: 只讀「他」後方的詞元，前方詞元一律無法供它查詢
    answer: B
    explain:
      A: 自注意力是學習的加權表示，不是保證正確的字詞替換規則。
      B: 查詢對鍵配分，依權重整合值，可直接讀取遠距位置。
      C: 注意力通常仍為各查詢位置產生各自表示。
      D: 是否可見取決於遮罩，一般全自注意力也能讀前方。
  - id: c2
    goal: g2
    type: choice
    prompt: 兩詞元的 Q、K、V 都是 2×2 單位矩陣，鍵寬度是 2，沒有遮罩。第一列權重最接近哪組？
    options:
      A: （0.7311，0.2689），先略過根號二縮放
      B: （0.5000，0.5000），把不同分數直接平均
      C: （0.6698，0.3302），沿同一查詢的兩鍵轉換
      D: （1.0000，0.0000），直接用最大分數當硬選擇
    answer: C
    explain:
      A: 這對應分數一與零，漏掉除以根號二。
      B: 第一個鍵分數較高，Softmax 不會自動改成平均。
      C: 分數為約零點七零七與零，逐列轉換得到所列權重。
      D: Softmax 是連續權重，並非取最大值後的獨熱向量。
  - id: c3
    goal: g2
    type: choice
    prompt: 第一列分數為 0.7071、0，第二個鍵是填補。正確處理及結果為何？
    options:
      A: 將第二分數設成 0；兩個權重仍約 0.6698、0.3302
      B: 先算兩個權重再刪一個；剩下的總和保持 0.6698
      C: 將第二個值向量設成 0；兩個鍵的權重自動成 1、0
      D: 在 Softmax 前遮掉第二鍵；兩個權重成為 1、0
    answer: D
    explain:
      A: 原分數本來就是零，沒有真正排除填補鍵。
      B: 先刪機率但不重新正規化，已不符合該列權重總和一。
      C: 值向量不參與這個配分步驟，不會自行修正權重。
      D: 把被遮分數設成負無限大，指數為零，只剩有效鍵。
---

## 為什麼需要

看這句話：「客戶提交文件，經過核對與等待後，他要求退款」。「他」要連回較遠的「客戶」。模型讓每個位置直接參考同一句的其他位置。

這稱為自注意力（Self-Attention），不必逐詞傳遞資訊。

## 直覺

描述目前位置想找什麼資訊的一組數字，稱為查詢向量（Query，Q）。供其他位置比對是否相關的一組數字，稱為鍵向量（Key，K）。

實際提供內容讓其他位置讀取的一組數字，稱為值向量（Value，V）。Q 與 K 決定各位置的內容要讀多少，V 決定讀到什麼。各位置的內容要讀多少，稱為權重。

![從同一份輸入 X 算出 Q、K、V。Q 和 K 決定權重，再按權重取用 V 的內容。](figure:l23203-self-attention-qkv)

長句中的「他」可以給遠處的名詞較大權重，多參考那個位置的內容。

:::supplement[來源：Jain 與 Wallace，Attention is not Explanation]
權重較大，不保證模型就能判對「他」指的是誰。只看一張顯示各位置權重的注意力圖，也無法完整說明模型做決定的原因。
:::

## 定義與公式

三次線性投影都從同一份輸入取得資料；跨注意力則改由另一個序列提供鍵和值。

### 投影與縮放點積（補充）

$$
Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V
$$

- $X$ 為 $L\times d$；$L$ 是詞元數，$d$ 是輸入寬度。
- $W_Q,W_K$ 為 $d\times d_k$；$W_V$ 為 $d\times d_v$。
- $d_k,d_v$ 是鍵和值的寬度，皆為正整數。

$$
S=\frac{QK^{\mathsf T}}{\sqrt{d_k}}+M,\quad
A_{ij}=\frac{\exp(S_{ij})}{\sum_{t=1}^{L}\exp(S_{it})},\quad O=AV
$$

$S$ 是配對分數，$M$ 是加法遮罩：可讀位置為零，遮住位置為負無限大。$A$ 是 $L\times L$ 的權重；$i$ 是查詢列，$j,t$ 是鍵欄；$O$ 為 $L\times d_v$ 的輸出。

每列至少要有一個可讀鍵；否則整列皆為負無限大，這個 Softmax 公式無法形成有效分配。縮放因子取鍵的寬度，不是序列長度；Softmax 沿鍵欄正規化。

## 算一次（補充）

客服 S01 抽位置 0、3：「客戶／退款」。本例設 $X=I_2$，三個投影也都為二階單位矩陣 $I_2$，所以 $Q=K=V=I_2$。真實投影不必相同。

第一列分數約 $(0.707107,0)$，取指數約 $(2.028115,1)$。總和 $3.028115$，相除得 $(0.669762,0.330238)$。

輸出為 $0.669762(1,0)+0.330238(0,1)=(0.669762,0.330238)$。第二列則為 $(0.330238,0.669762)$；兩列各自加總為一。

若第二鍵被遮住，第一列變成 $(0.707107,-\infty)$，權重為 $(1,0)$，輸出回到 $(1,0)$。填補值設零不會達到同樣效果，因為它仍可能分走權重。

![只畫探針位置 0、3：左圖兩鍵可讀，右圖因果遮罩排除第一列的未來鍵，每列權重總和一。](figure:l23203-self-attention-weights)

醫療 M01 取「病人／疼痛」的向量也為 $(1,0)$、$(0,1)$，可重算相同結果。相同玩具向量不代表兩領域真實語意相同。

### 接回指代句

保留 S01 四個位置，用位置 2「他」查詢全句，仍沿用固定嵌入與投影。它對「客戶／提交／他／退款」的權重依序約為 0.334881、0.165119、0.334881、0.165119。

![看位置 2「他」直接讀位置 0「客戶」，中間不必逐詞轉傳；四個鍵都列出，權重合計一。](figure:l23203-self-attention-coreference)

「他」可直接取得遠處「客戶」的值，但本例也同樣關注自身，尚未學到可靠指代。這串權重只示範資訊路徑，不能當成已理解「他」指誰的證明。

## 程式（補充）

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-G-attention.json").read_text(encoding="utf-8"))
ids = np.array(d["service"][0]["token_id"])[d["probe"]["positions"]]
x = np.array(d["embedding"], dtype=float)[ids]
q, k, v = (x @ np.array(d[w]) for w in ["Wq", "Wk", "Wv"])
s = q @ k.T / np.sqrt(k.shape[-1])
e = np.exp(s - s.max(axis=-1, keepdims=True))
a = e / e.sum(axis=-1, keepdims=True)
print("分數:", np.round(s, 6).tolist())
print("權重:", np.round(a, 6).tolist())
print("輸出:", np.round(a @ v, 6).tolist())
print("列和:", np.round(a.sum(axis=-1), 6).tolist())
full_x = np.array(d["embedding"], dtype=float)[d["service"][0]["token_id"]]
full_q, full_k = (full_x @ np.array(d[w]) for w in ["Wq", "Wk"])
pronoun_s = full_q[2] @ full_k.T / np.sqrt(full_k.shape[-1])
pronoun_e = np.exp(pronoun_s - pronoun_s.max())
print("他對四鍵:", np.round(pronoun_e / pronoun_e.sum(), 6).tolist())
```
```text
分數: [[0.707107, 0.0], [0.0, 0.707107]]
權重: [[0.669762, 0.330238], [0.330238, 0.669762]]
輸出: [[0.669762, 0.330238], [0.330238, 0.669762]]
列和: [1.0, 1.0]
他對四鍵: [0.334881, 0.165119, 0.334881, 0.165119]
```

:::tip[讀碼重點]
先核對 QK 轉置的形狀，再看 Softmax 的 axis=-1；它讓同一查詢在所有鍵間分配權重。程式只計算兩詞元單頭，其他頁沿用相同索引。
:::

## 怎麼用、怎麼判讀

若只使用一組權重，某些關聯可能被混在同一個表示裡。多頭注意力讓模型並行使用不同投影；拆分、拼接與輸出投影見該專頁。

單頭用一張權重表彙整各位置；多頭則在不同特徵子空間各算一張，再將各頭輸出拼接、線性轉換。頭數增加不表示把一句話切成幾段。

:::supplement[來源：PyTorch MultiheadAttention；本組共用算例]
同一個兩位置輸入，單頭首位置輸出為（0.669762，0.330238）；拆成兩個一維頭時，首位置分別輸出 0.731059 與 0.5。

各頭可給不同權重，拼接與輸出投影的完整計算見多頭注意力頁。
:::

判讀權重時先找列的查詢、欄的鍵，再檢查哪些鍵可讀。跨注意力的查詢與鍵數可不同，不必是方陣。（補充）

### 換個場景

| 場景 | 關聯需求 | 判讀重點 |
|---|---|---|
| 語言的長距離依賴 | 遠距名詞與動詞或代名詞 | 看直接連結而非只看相鄰詞 |
| 同序列上下文整合 | 任一詞元參考其他可見詞元 | 三次投影共用來源 |
| 客服意圖（補充） | 連結客戶與退款要求 | 高權重不保證分類正確 |
| 病歷整理（補充） | 連結病人與症狀 | 注意填補與否定詞 |

## 常見誤解

- 「Q、K、V 是三份不同句子。」自注意力的三者來自同一份序列，只是投影角色不同。
- 「權重是分類答案的機率。」這裡是在鍵位置之間分配，不是在意圖類別間分配。（補充）
- 「每個頭就是固定一種語法功能。」不同投影提供表達空間，沒有指定頭必學到哪種規則。（補充）

## 進階

### 參考來源

- 科目 1 指引 `guide-1:3-25`：支持遠距詞語關聯的動機。
- 科目 3 指引 `guide-3:4-78`～`guide-3:4-80`：支持 QKV、三次投影與上下文整合；未展開縮放點積算式。
- [原始論文 3.2.1](https://arxiv.org/html/1706.03762v7)：支持投影、縮放與遮罩。
- [Dive into Deep Learning 11.3](https://d2l.ai/chapter_attention-mechanisms-and-transformers/attention-scoring-functions.html)：支持縮放點積公式、遮罩與逐列算例的教學安排。
- [PyTorch MultiheadAttention](https://docs.pytorch.org/docs/2.15/generated/torch.nn.MultiheadAttention.html)：支持單頭與多頭的子空間及輸出整合對照。
- [Attention is not Explanation](https://aclanthology.org/N19-1357/)：支持直覺節對注意力權重解釋能力的界線。

## 小結

- Q 配 K 決定權重，權重再彙整 V。
- 自注意力的三者來自同一個序列。
- 每列沿可讀鍵做 Softmax；至少留一個有效鍵。（補充）
- 多頭的拆合與投影接著讀多頭注意力頁。
