---
id: lstm
title: LSTM 的細胞狀態與門控
kind: model
codes: [L23203]
aliases: [Forget Gate, Long Short-Term Memory]
summary: LSTM 以三種門管理細胞狀態，分開決定記住什麼與輸出什麼
goals:
  - id: g1
    text: 區分細胞狀態、隱藏狀態及輸入門、遺忘門、輸出門的角色
  - id: g2
    text: 代入門值更新細胞與隱藏狀態，判斷遺忘門大小的影響
requires: [rnn, sigmoid, tanh]
is_a: [rnn]
mitigates:
  - target: recurrent-gradients
    note: 細胞狀態提供加法記憶路徑以減輕長期依賴困難，但不保證所有梯度皆穩定
    source: [guide-3:4-75]
guide_refs: [guide-3:4-75, guide-1:3-7, guide-1:3-8, guide-1:3-24, guide-1:5-11]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: gates-and-state
    source: https://docs.pytorch.org/docs/2.12/generated/torch.nn.LSTM.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療感測 LSTM 在某步仍保留細胞資訊，卻暫時少輸出到隱藏狀態。若細胞狀態保持 0.5，哪項調整最直接做到這點？
    options:
      A: 輸入門由 0.8 降至 0.1，直接減少輸出比例
      B: 遺忘門由 0.8 降至 0.1，直接減少輸出比例
      C: 輸出門由 0.8 降至 0.1，直接減少輸出比例
      D: 重置門由 0.8 降至 0.1，直接減少輸出比例
    answer: C
    explain:
      A: 輸入門影響候選內容寫入細胞的比例，並非讀出比例。
      B: 遺忘門影響舊細胞資訊保留量，會改變記憶本身。
      C: 細胞狀態固定時，降低輸出門會直接減少輸出到隱藏狀態的比例。
      D: 重置門是 GRU 的門，不是此標準 LSTM 的三門之一。
  - id: c2
    goal: g2
    type: choice
    prompt: 能源 LSTM 的舊細胞狀態為 0.5，輸入門 0.25、候選值 0.4。只把遺忘門由 0.8 改成 0.2，新細胞狀態如何變化？
    options:
      A: 從 0.50 變為 0.20，舊記憶保留量減少
      B: 從 0.50 變為 0.50，新資訊抵銷全部差異
      C: 從 0.40 變為 0.10，候選寫入量被忽略
      D: 從 0.20 變為 0.50，遺忘門越小保留越多
    answer: A
    explain:
      A: 兩次分別為 0.8×0.5＋0.25×0.4 及 0.2×0.5＋0.25×0.4。
      B: 新資訊寫入量皆為 0.1，並不會自動補回少保留的 0.3。
      C: 新細胞還包含 0.1 的候選寫入量，不能只計舊記憶。
      D: 遺忘門在此乘上舊細胞，越小代表保留越少，方向相反。
---

## 為什麼需要

標準 RNN 每一步都重新混合舊狀態與新輸入，長期資訊可能難以保留。長短期記憶網路（LSTM，英文為 Long Short-Term Memory）另設細胞狀態，並用門控管理資訊。

三種門分工：遺忘門控制舊資訊留多少，輸入門控制新候選內容寫多少，輸出門控制目前向外提供多少。它能改善長期依賴的學習。

## 直覺

細胞狀態是持續傳遞的記憶；隱藏狀態是當下提供給下一層或輸出頭的表示。「存著」與「這一步拿出來用」可以分開。

![先保留舊細胞，再加入候選內容，最後由輸出門讀出隱藏狀態。](figure:l23203-lstm-gates)

:::supplement[來源：Dive into Deep Learning 10.1]
門通常由 Sigmoid 產生零與一之間的連續值，不是只能開或關的開關。門值要由輸入與舊隱藏狀態算出，候選內容通常由 Tanh 產生。
:::

## 定義與公式

標準 LSTM 在時間步之間傳遞細胞狀態與隱藏狀態，三種門共同決定怎麼保留、更新及讀出資訊。

### 三門與兩個狀態的更新式（補充）

$$
\begin{aligned}
i_t&=\sigma(W_i[x_t;h_{t-1}]+b_i)\\
f_t&=\sigma(W_f[x_t;h_{t-1}]+b_f)\\
o_t&=\sigma(W_o[x_t;h_{t-1}]+b_o)\\
g_t&=\tanh(W_g[x_t;h_{t-1}]+b_g)\\
c_t&=f_t\odot c_{t-1}+i_t\odot g_t\\
h_t&=o_t\odot\tanh(c_t)
\end{aligned}
$$

- 輸入：$x_t$ 是當下特徵，$h_{t-1}$ 是舊隱藏狀態，分號表示向量串接。
- 參數：$W_i,W_f,W_o,W_g$ 與各自的 $b$ 是可學習權重及偏差。
- 運算：$\sigma$ 是 Sigmoid，$\odot$ 是逐元素相乘。

$i_t,f_t,o_t$ 分別是輸入、遺忘及輸出門，$g_t$ 是候選內容；$c_{t-1},c_t$ 是舊、新細胞狀態，$h_t$ 是新隱藏狀態。本頁採無投影、無窺孔連接的標準單元。

## 算一次（補充）

共用資料的首個四步視窗，截止於第 4 點。另給此步的教學探針：舊細胞 $c_3=0.5$、輸入門 $i_4=0.25$、遺忘門 $f_4=0.8$、輸出門 $o_4=0.5$、候選 $g_4=0.4$。

這些值是固定的單步條件，沒有宣稱由前三步訓練得來。能源與醫療都用它看同一種更新。

這個探針把門與候選的權重設為零，僅用固定偏差演示激活轉換；實際訓練時，權重才會使它們依輸入與舊狀態改變。

| 變換 | 門前分數或候選前分數 | 激活後 |
|---|---|---|
| 輸入門 | ln(1/3)，約 −1.0986 | Sigmoid 得 0.25 |
| 遺忘門 | ln(4)，約 1.3863 | Sigmoid 得 0.8 |
| 輸出門 | 0 | Sigmoid 得 0.5 |
| 候選內容 | atanh(0.4)，約 0.4236 | Tanh 得 0.4 |

ln 是自然對數，atanh 是 Tanh 的反函數。以輸入門為例，把分數 −1.0986 代入 Sigmoid，就得到約 0.25，再用這些值更新記憶：

| 動作 | 代入 | 結果 |
|---|---|---|
| 保留舊資訊 | 0.8×0.5 | 0.4 |
| 寫入新內容 | 0.25×0.4 | 0.1 |
| 更新細胞 | 0.4＋0.1 | 0.5 |
| 讀出狀態 | 0.5×tanh(0.5) | 約 0.2311 |

若只把遺忘門改為 0.2，舊資訊保留變少，候選寫入仍為 0.1：

- 新細胞：$c_4=0.2\times0.5+0.25\times0.4=0.2$。
- 新隱藏狀態：$h_4=0.5\tanh(0.2)\approx0.0987$。

## 程式（補充）

先從固定的門前分數算出門值，再比較遺忘門的兩種設定。

```python
import json, math, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
p = d["lstm_probe"]
sigmoid = lambda a: 1 / (1 + math.exp(-a))
i, f, o = map(sigmoid, [p["input_logit"], p["forget_logit"], p["output_logit"]])
g = math.tanh(p["candidate_pre"])
print("門 i,f,o:", [round(v, 4) for v in (i, f, o)])
for keep in (f, p["low_forget"]):
    c = keep * p["c_previous"] + i * g
    h = o * math.tanh(c)
    print("f,c,h:", [round(v, 4) for v in (keep, c, h)])
```
```text
門 i,f,o: [0.25, 0.8, 0.5]
f,c,h: [0.8, 0.5, 0.2311]
f,c,h: [0.2, 0.2, 0.0987]
```

再用未訓練的雙單元 LSTM 驗形狀。這段只驗 API，參數與前面的純量探針不同。

```python
import torch
torch.manual_seed(d["seed"])
x = torch.tensor(d["first_windows"])
m = torch.nn.LSTM(1, 2, bias=False, batch_first=True)
y, (h, c) = m(x)
print("序列:", tuple(y.shape))
print("隱藏與細胞:", tuple(h.shape), tuple(c.shape))
```
```text
序列: (2, 4, 2)
隱藏與細胞: (1, 2, 2) (1, 2, 2)
```

:::tip[讀碼重點]
LSTM 回傳 `y, (h, c)`，不是只有一個末端狀態。這裡沒有投影，`h`、`c` 寬度相同；兩者是不同資訊，不能因形狀相同就互換。
:::

## 怎麼用、怎麼判讀

語音辨識、機器翻譯與時序風險判別，都可能需要把較早的資訊留到後面。當基本 RNN 學不到所需依賴時，可比較 LSTM，但要計入較複雜結構的計算負擔。

:::supplement[來源：Dive into Deep Learning 10.1]
指引把門控描述為解決梯度消失；較精確的理解是改善資訊與梯度的傳遞條件。若門長期偏向丟棄資訊，或視窗根本不包含所需歷史，仍可能學不到長期關係。
:::

### 換個場景

| 場景 | 使用目的 | 判讀重點 |
|---|---|---|
| 語音辨識、機器翻譯 | 整合前段語境 | 長期記憶需求與訓練成本 |
| 金融時序風險 | 利用先前交易變化 | 歷史依賴與資料可用時間 |
| 感測、醫療趨勢 | 整合跨時點訊號 | 記憶保留與輸出分工 |
| 能源需求（補充） | 由前四天預測次日 | 四天外歷史未在本例輸入中 |
| 零售需求（補充） | 延遲出現的促銷影響 | 視窗需涵蓋影響期間 |

## 常見誤解

- 「遺忘門越小，代表忘得越少。」此門乘在舊細胞上，越小保留越少。（補充）
- 「輸出門關小就會刪除細胞記憶。」輸出門管理讀出，並不直接清空細胞。（補充）
- 「LSTM 只有三套變換。」三門之外還有候選內容的變換。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-75`：支持三門、獨立細胞狀態及長期依賴；已回看 PDF 113 頁。
- 科目 1 指引 `guide-1:3-7`～`guide-1:3-8`、`guide-1:3-24`、`guide-1:5-11`：支持序列模型、語音翻譯、成本取捨與金融風險場景。
- [PyTorch LSTM](https://docs.pytorch.org/docs/2.12/generated/torch.nn.LSTM.html)：支持標準單元公式與回傳形狀。
- [Dive into Deep Learning 10.1](https://d2l.ai/chapter_recurrent-modern/lstm.html)：支持門值、記憶讀出與數值例子的教學安排。

## 小結

- 細胞狀態負責記憶，隱藏狀態提供當下表示。
- 遺忘門管舊記憶，輸入門管新內容，輸出門管讀出。
- 新細胞由保留項與寫入項相加得到。（補充）
- LSTM 改善長期依賴，但仍受資料與計算條件限制。
