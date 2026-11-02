---
id: stacked-rnn
title: 堆疊 RNN 的分層表示
kind: model
codes: [L23203]
aliases: [Deep RNN, Stacked RNN]
summary: 堆疊 RNN 沿層數加深表示，每一層仍沿自己的時間軸更新狀態
goals:
  - id: g1
    text: 區分時間展開與層間堆疊，追蹤單層和多層的狀態流及形狀
requires: [rnn]
is_a: [rnn]
guide_refs: [guide-3:4-73, guide-3:4-76]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: layer-time-update
    source: https://d2l.ai/chapter_recurrent-modern/deep-rnn.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩層單向 RNN 正在處理第 3 時間步。第二層的新狀態直接由哪兩個狀態來源計算？
    options:
      A: 第一層第 3 步，加上第二層第 2 步
      B: 第一層第 2 步，加上第二層第 3 步
      C: 第一層第 4 步，加上第二層第 2 步
      D: 第一層第 3 步，加上第二層第 4 步
    answer: A
    explain:
      A: 同一步下層的輸出是輸入，同層前一步的狀態是遞迴記憶。
      B: 第二層第 3 步是正在求的結果，不能拿它自己當已知狀態。
      C: 第一層第 4 步是未來位置，不是此單向單元的直接輸入。
      D: 第二層第 4 步尚未算出，單向時間依賴來自第 2 步。
  - id: c2
    goal: g1
    type: choice
    prompt: PyTorch RNN 設 num_layers=2、hidden_size=2、單向、batch_first=True，批次有 2 個四步視窗。序列輸出 y 與末端 h 的形狀為何？
    options:
      A: y=(2,4,4)，h=(1,2,4)
      B: y=(4,2,2)，h=(2,2,2)
      C: y=(2,4,2)，h=(2,2,2)
      D: y=(2,2,2)，h=(2,4,2)
    answer: C
    explain:
      A: 層數增加不會把最後一層的輸出寬度自動串接成四。
      B: batch_first=True 時，y 的前兩軸應為批次二及時間四。
      C: y 是最後一層的完整序列，h 則保留兩層各自的末端狀態。
      D: y 必須保留四個時間步，h 的第二軸則是批次大小二。
---

## 為什麼需要

一層 RNN 把序列變成一串隱藏表示。若希望在這串表示上再學更複雜的時序特徵，可以把它交給另一層 RNN。

堆疊 RNN（Stacked RNN，也稱 Deep RNN）沿層數增加深度。下層的隱藏狀態作為上層輸入；每一層仍保有自己的時間狀態。

## 直覺

橫向看時間：每層都從前一步取得記憶。縱向看層數：同一時間點的下層結果交給上層，形成分層表示。

![橫向箭頭是同層的時間記憶，向上箭頭是同一步的層間輸入。](figure:l23203-stacked-rnn-axes)

:::tip[重點]
一層展開四步，仍是一層；兩層各走四步，才是兩層堆疊。時間長度與層數是兩個不同軸。
:::

## 定義與公式

每層都把自己的前一步狀態與當下輸入結合。第一層的輸入是原始特徵，第二層開始則接下層的隱藏狀態。

### 同時標出層與時間（補充）

$$
h_t^{(\ell)}=\tanh\bigl(W_{\ell}h_t^{(\ell-1)}+U_{\ell}h_{t-1}^{(\ell)}+b_{\ell}\bigr)
$$

$t$ 表示時間，$\ell$ 表示層；$h_t^{(\ell)}$ 是第 $\ell$ 層、第 $t$ 步的狀態。令 $h_t^{(0)}=x_t$，使第一層接原始輸入。

$W_{\ell}$ 是層間輸入權重，$U_{\ell}$ 是同層遞迴權重，$b_{\ell}$ 是偏差。各層通常用不同參數，同一層跨時間共享參數；本式採 Tanh、單向且無 dropout。

## 算一次（補充）

沿用能源與醫療的首個四步視窗，換算後皆為 0、0.1、0.2、0.3。先用每層寬度 1 的兩層網路，看清楚依賴來源。

兩層都設 $W_{\ell}=1$、$U_{\ell}=0.5$、$b_{\ell}=0$，初始狀態皆為零。這是刻意選相同數值的兩套參數，不表示不同層必須共享權重。

第 1 步兩層皆為零。第 2 步依序算下層，再算上層：

- 下層：$h_2^{(1)}=\tanh(0.1)\approx0.0997$。
- 上層：$h_2^{(2)}=\tanh(0.099668+0.5\times0)\approx0.0993$。

第 3 步，上層要接下層第 3 步與上層第 2 步，不是把下層第 2 步再送一次。這就是圖中橫向與縱向箭頭相遇的地方。

## 程式（補充）

先核對兩層第 2 步的計算，後段再用寬度 2 驗回傳形狀。

```python
import json, math, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
lower, upper = 0.0, 0.0
for value in d["normalized"][:2]:
    lower = math.tanh(value + 0.5 * lower)
    upper = math.tanh(lower + 0.5 * upper)
print("第2步下層與上層:", round(lower, 4), round(upper, 4))
```
```text
第2步下層與上層: 0.0997 0.0993
```

```python
import torch
torch.manual_seed(d["seed"])
x = torch.tensor(d["first_windows"])
m = torch.nn.RNN(1, 2, num_layers=2, bias=False, batch_first=True)
y, h = m(x)
print("序列與末端:", tuple(y.shape), tuple(h.shape))
print("參數數:", sum(p.numel() for p in m.parameters()))
```
```text
序列與末端: (2, 4, 2) (2, 2, 2)
參數數: 14
```

:::tip[讀碼重點]
`y` 只回傳最後一層的全序列。`h[0]`、`h[1]` 分別是第一、第二層的末端狀態；`batch_first` 沒有把 `h` 的第一軸改為批次。
:::

## 怎麼用、怎麼判讀

堆疊的用途是增加表示能力，而不是增加看得到的未來資訊。同樣的序列可先用單層建立基準，再視複雜度需求增加層數。

:::supplement[來源：Dive into Deep Learning 10.3；PyTorch RNN 文件]
相同寬度下，多層通常增加參數及中間狀態的儲存負擔。上述第一層有 6 個權重，第二層有 8 個，共 14 個；不應把「四個時間步」乘進參數數。

層數多不保證泛化更好，仍要看時間驗證結果與資源限制。堆疊也可用 LSTM 或 GRU，並可和雙向設計組合；層數與方向數仍須分開讀。
:::

### 換個場景

| 場景 | 輸入條件 | 分層的目的 |
|---|---|---|
| 複雜時序特徵 | 先由下層產生序列表示 | 上層再整合下層表示 |
| 能源需求（補充） | 多日量測 | 比較單層與兩層驗證結果 |
| 醫療感測（補充） | 多時點訊號 | 增加表示能力並檢查過擬合 |
| 交通車流（補充） | 逐時段特徵 | 評估加深後的延遲成本 |

## 常見誤解

- 「把四步畫開就是四層。」那是時間展開，同一層共享權重。
- 「第二層只接第一層的最後狀態。」標準堆疊接的是下層各時間步的序列。
- 「兩層就會自動變成雙向。」方向與深度是不同設定。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-73`、`guide-3:4-76`：支持共享權重的時間展開與多層分工；已回看 PDF 111、114 頁。
- [PyTorch RNN](https://docs.pytorch.org/docs/2.12/generated/torch.nn.RNN.html)：支持 `num_layers`、形狀與參數實測。
- [Dive into Deep Learning 10.3](https://d2l.ai/chapter_recurrent-modern/deep-rnn.html)：支持雙軸、更新式與分層流程的教學安排。

## 小結

- 時間軸沿同層傳遞，層軸在同一步往上傳遞。
- 各層可有自己的參數，同層各步共享參數。
- 上層接下層的序列，學習更複雜的時序表示。
- 加深不保證更準，也不會自動變成雙向。（補充）
