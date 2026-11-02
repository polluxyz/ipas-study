---
id: gru
title: GRU 的更新門與重置門
kind: model
codes: [L23203]
aliases: [Gated Recurrent Unit]
summary: GRU 用更新門混合新舊狀態，用重置門調節候選內容對舊資訊的使用
goals:
  - id: g1
    text: 分清更新門與重置門，與 LSTM 比較狀態數及計算取捨
requires: [rnn, sigmoid, tanh]
is_a: [rnn]
mitigates:
  - target: recurrent-gradients
    note: 更新門可保留舊狀態以改善長期依賴，但仍受序列長度與訓練條件限制
    source: [guide-3:4-75, guide-1:3-24]
contrasts:
  - target: lstm
    note: GRU 以更新及重置兩門更新單一隱藏狀態；LSTM 分別保有細胞與隱藏狀態
    source: [guide-3:4-75]
guide_refs: [guide-3:4-75, guide-1:3-24]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: gru-gates
    source: https://docs.pytorch.org/docs/2.12/generated/torch.nn.GRU.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 感測 GRU 採 h新＝z×h舊＋(1−z)×候選。舊狀態 0.5、候選 0.4，更新門 z＝0.8，新狀態是多少？
    options: { A: "0.10", B: "0.40", C: "0.42", D: "0.48" }
    answer: D
    explain:
      A: 0.10 只算了 0.2×0.5，漏掉完整的兩項混合。
      B: 0.40 是舊狀態保留項，還需要加候選的 0.08。
      C: 0.42 是把兩個混合係數互換，與題目指定公式不同。
      D: 0.8×0.5＋0.2×0.4＝0.48，更新門在此是舊狀態保留比例。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊對同一批四步序列，比較相同輸入寬度 1、隱藏寬度 2 的標準 GRU 與 LSTM。哪項結構描述正確？
    options:
      A: GRU 有三門與兩種狀態，LSTM 有兩門與一種狀態
      B: GRU 有兩門與一種狀態，LSTM 有三門與兩種狀態
      C: GRU 有兩門與兩種狀態，LSTM 有三門與一種狀態
      D: GRU 有三門與一種狀態，LSTM 有兩門與兩種狀態
    answer: B
    explain:
      A: 兩種單元的門數及狀態安排被對調了。
      B: GRU 用更新門與重置門傳遞 h，LSTM 用三門傳遞 h 及 c。
      C: GRU 沒有另外傳遞細胞狀態，LSTM 則有細胞與隱藏狀態。
      D: GRU 的門數是二，LSTM 的門數是三，與此敘述相反。
---

## 為什麼需要

LSTM 用三門和獨立細胞狀態管理記憶，結構較複雜。門控循環單元（GRU，英文為 Gated Recurrent Unit）以較精簡的兩門設計，保留處理長期依賴的能力。

GRU 有更新門（Update Gate）與重置門（Reset Gate）。

## 直覺

:::supplement[來源：PyTorch GRU 文件；Dive into Deep Learning 10.2]
GRU 不另外傳遞一份細胞狀態，而是直接更新隱藏狀態。

先問「產生新候選時，要參考多少舊資訊？」這由重置門調節。再問「這一步要留多少舊狀態，換進多少候選？」這由更新門調節。
:::

![GRU 以兩門更新一份狀態；右側 LSTM 另有獨立細胞記憶路徑。](figure:l23203-gru-state)

兩種單元都屬門控序列模型。門較少讓 GRU 結構緊湊，但不能直接據此判定哪個任務一定比較準。

## 定義與公式（補充）

本頁採 PyTorch 的重置位置與更新門方向：

$$
\begin{aligned}
r_t&=\sigma(W_{xr}x_t+b_{xr}+W_{hr}h_{t-1}+b_{hr})\\
z_t&=\sigma(W_{xz}x_t+b_{xz}+W_{hz}h_{t-1}+b_{hz})\\
n_t&=\tanh\bigl(W_{xn}x_t+b_{xn}+r_t\odot(W_{hn}h_{t-1}+b_{hn})\bigr)\\
h_t&=z_t\odot h_{t-1}+(1-z_t)\odot n_t
\end{aligned}
$$

$x_t$ 是當下輸入，$h_{t-1}$ 是舊狀態，$r_t,z_t$ 是重置門與更新門，$n_t$ 是候選，$h_t$ 是新狀態。各個 $W$ 與 $b$ 是對應輸入或舊狀態的權重與偏差。

$\sigma$ 是 Sigmoid，$\odot$ 表示逐元素相乘。在這個公式中，$z_t$ 越接近一，保留舊狀態越多；$r_t$ 越接近零，候選越少使用舊狀態的變換結果。

:::caution[注意]
有些教材把更新門定義為「新候選占比」，係數位置就相反。先看它乘在哪一項，再判斷大小；也不要把不同實作的重置位置視為完全相同。
:::

## 算一次（補充）

仍用共用檔的兩領域四步視窗。另給第 4 步的純量探針：舊狀態 0.5，當下輸入 0.3；候選的輸入權重為 1、遞迴權重為 0.5，偏差皆零。

重置門與更新門在此只用固定偏差，門權重設為零。門前分數分別為 0 與 ln(4)，經 Sigmoid 得 $r_4=0.5$、$z_4=0.8$；先算候選，再混合：

- $n_4=\tanh(0.3+0.5\times0.5\times0.5)=\tanh(0.425)\approx0.4011$。
- $h_4=0.8\times0.5+0.2\times0.401134\approx0.4802$。

若只把重置門改為零，候選成為 $\tanh(0.3)\approx0.2913$；舊狀態仍能經更新門的保留路徑傳遞。重置門並不等於直接把最後狀態清零。

## 程式（補充）

```python
import json, math, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
p = d["gru_probe"]
sigmoid = lambda a: 1 / (1 + math.exp(-a))
r, z = map(sigmoid, [p["reset_logit"], p["update_logit"]])
n = math.tanh(p["input_candidate"] + r * (p["hidden_weight"] * p["h_previous"] + p["hidden_bias"]))
h = z * p["h_previous"] + (1-z) * n
print("r,z:", [round(v, 4) for v in (r, z)])
print("候選與新狀態:", [round(v, 4) for v in (n, h)])
```
```text
r,z: [0.5, 0.8]
候選與新狀態: [0.4011, 0.4802]
```

下段另用未訓練的雙單元 GRU 驗形狀，與純量探針不共用參數。

```python
import torch
torch.manual_seed(d["seed"])
x = torch.tensor(d["first_windows"])
m = torch.nn.GRU(1, 2, bias=False, batch_first=True)
y, h = m(x)
print("序列與末端:", tuple(y.shape), tuple(h.shape))
```
```text
序列與末端: (2, 4, 2) (1, 2, 2)
```

:::tip[讀碼重點]
GRU 回傳 `y, h`，沒有獨立的 `c`。更新門混合時要沿用本頁的係數方向；不要把 LSTM 的遺忘門或輸出門名稱直接套到 GRU。
:::

## 怎麼用、怎麼判讀

當需要比基本 RNN 更好的長期依賴處理，又希望結構精簡，可把 GRU 納入比較。指引指出它常能接近 LSTM 的表現，但長序列仍有限制。

| 單元 | 跨步狀態 | 門 | 計算取捨 |
|---|---|---|---|
| LSTM | 隱藏狀態、細胞狀態 | 輸入、遺忘、輸出 | 記憶管理較細，結構較複雜 |
| GRU | 僅隱藏狀態（補充） | 更新、重置 | 結構較緊湊，通常參數較少 |

:::supplement[來源：PyTorch GRU、LSTM 文件]
「參數較少」要在相同輸入寬度、隱藏寬度、層數及方向下比較。實際速度還取決於硬體、函式庫與批次安排，不能用門數直接換算加速倍數。
:::

### 換個場景

| 場景 | 使用目的 | 判讀重點 |
|---|---|---|
| 語音、文字生成、翻譯 | 捕捉序列依賴 | 長序列能力與計算負擔 |
| 感測與醫療趨勢 | 整合歷史量測 | 門控保留與狀態更新 |
| 能源端裝置（補充） | 在資源預算內預測 | 量測實際延遲及記憶體 |
| 零售需求（補充） | 比較門控模型 | 同一時間切分再比誤差 |

## 常見誤解

- 「GRU 有獨立細胞狀態。」標準 GRU 只傳遞隱藏狀態。（補充）
- 「更新門越大一定寫入越多。」本頁定義下，越大保留舊狀態越多。（補充）
- 「兩個門代表只有兩套權重變換。」候選內容還有自己的變換。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-75`、科目 1 指引 `guide-1:3-24`：支持兩門、結構取捨與序列場景；已回看 PDF 113、31 頁。
- [PyTorch GRU](https://docs.pytorch.org/docs/2.12/generated/torch.nn.GRU.html)：支持完整公式、重置位置與回傳形狀。
- [PyTorch LSTM](https://docs.pytorch.org/docs/2.12/generated/torch.nn.LSTM.html)：支持與 LSTM 的狀態及結構比較。
- [Dive into Deep Learning 10.2](https://d2l.ai/chapter_recurrent-modern/gru.html)：支持兩門分工與混合新舊資訊的教學安排；該書候選式的重置位置與本頁 PyTorch 公式不同。

## 小結

- GRU 有更新門與重置門。
- 只傳遞一份隱藏狀態，沒有獨立細胞狀態。（補充）
- 重置門調節候選對舊資訊的使用。（補充）
- 本頁更新門越大，舊狀態占比越高。（補充）
- 結構較緊湊，但效能仍需同條件驗證。
