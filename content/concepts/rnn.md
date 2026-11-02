---
id: rnn
title: 遞迴神經網路與序列狀態
kind: model
codes: [L23203]
aliases: [Recurrent Neural Network, 隱藏狀態]
summary: RNN 以共享權重逐步更新隱藏狀態，讓目前計算帶有先前資訊
goals:
  - id: g1
    text: 追蹤時間步的輸入、隱藏狀態與共享權重，讀懂小序列形狀
  - id: g2
    text: 依文字、語音、感測與影片任務選擇序列到標籤或序列的形式
requires: [activation-functions]
guide_refs: [guide-3:4-72, guide-3:4-73, guide-3:4-74, guide-3:4-75, guide-1:3-7, guide-1:3-8, guide-1:5-10]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: state-update
    source: https://docs.pytorch.org/docs/2.12/generated/torch.nn.RNN.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源模型用一層 RNN，輸入維度 1、隱藏寬度 2，沒有偏差及輸出頭。視窗從 4 步改成 8 步，參數數如何變化？
    options:
      A: 從 6 變成 12，因時間步增加一倍
      B: 從 6 維持 6，因各步共享同組權重
      C: 從 6 變成 24，因每步各需一組權重
      D: 從 6 變成 8，因狀態數等於視窗長度
    answer: B
    explain:
      A: 輸入及遞迴權重依特徵維度配置，不會因多走四步而複製。
      B: 輸入權重有 2 個、遞迴權重有 4 個，各時間步重用這 6 個參數。
      C: 展開後的單元共用權重，不能把它們當成四套獨立參數。
      D: 視窗長度決定處理步數，不決定隱藏寬度或參數數。
  - id: c2
    goal: g2
    type: choice
    prompt: 系統讀取 4 時點心率，只在收齊第 4 點後預測第 5 點心率。哪種輸入輸出安排符合需求？
    options:
      A: 一筆心率輸入，輸出四個相互獨立標籤
      B: 四筆心率打散，輸出四個無順序的預測
      C: 五筆心率輸入，輸出第五時點的同一值
      D: 四步序列輸入，最後狀態接一個回歸輸出
    answer: D
    explain:
      A: 任務需要讀取四步歷史，不能只看單點並改成四個標籤。
      B: 打散順序會失去時序資訊，而且任務只要求下一點的預測。
      C: 第五點是尚未取得的預測目標，放進輸入會洩漏答案。
      D: 四步依序更新狀態，最後接回歸頭，可產生下一點的單一數值。
---

## 為什麼需要

同樣的數字，放在上升序列或下降序列裡，意義可能不同。逐筆獨立處理會丟掉順序，也無法直接把上一刻的計算接到下一刻。

遞迴神經網路（RNN，英文為 Recurrent Neural Network）把先前資訊壓在隱藏狀態中。每來一筆輸入，就用它與舊狀態產生新狀態，可處理不同長度的序列。

## 直覺

:::supplement[來源：Dive into Deep Learning 9.4]
隱藏狀態像一份持續更新的摘要。第 3 步讀到的是第 3 筆輸入，加上前兩步留下的摘要；它沒有把整段歷史原封不動存起來。
:::

![三步沿時間向右更新，圖中的三個單元重用同一組權重。](figure:l23203-rnn-state)

:::tip[重點]
時間展開畫出多個單元，是同一層重複運算。增加時間步不等於新增一層獨立參數。
:::

## 定義與公式

每個時間步先把當下輸入與上一個狀態加權結合，再經非線性激活函數，得到新的隱藏狀態。需要預測時，還要由狀態接上輸出層。

指引列出 Tanh 或 ReLU 作為狀態轉換，本頁用 Tanh。

### 寫成更新式（補充）

$$
h_t=\tanh(W_xx_t+W_hh_{t-1}+b)
$$

$t$ 是時間索引，$x_t$ 是輸入向量，$h_t$ 是新狀態；$W_x$、$W_h$ 分別是輸入與遞迴權重，$b$ 是偏差。所有時間步使用相同的三項參數。

此處把輸入與狀態寫成直立向量（column vector）。輸入寬度為 $d$、狀態寬度為 $H$ 時，$W_x$ 形狀為 $H\times d$，$W_h$ 為 $H\times H$。

初始狀態 $h_0$ 必須指定，本例用零。

## 算一次（補充）

共用檔 `L23203-F-sequences.json` 有能源與醫療各 20 時點。能源前四天為 100、110、120、130 kWh；減 100 再除以 100，得到 0、0.1、0.2、0.3。

醫療前四點為 60、62、64、66 次／分；減 60 再除以 20，也得到同一序列。這是事先指定的換算，兩領域刻意同形，方便看運算。

取純量權重 $W_x=1$、$W_h=0.5$、$b=0$、$h_0=0$：

| 步 | 當下輸入 | 激活函數前的值 | 新狀態 |
|---|---|---|---|
| 1 | 0 | 0 | 0 |
| 2 | 0.1 | 0.1 | 0.0997 |
| 3 | 0.2 | 0.2＋0.5×0.099668 | 0.2448 |
| 4 | 0.3 | 0.3＋0.5×0.244763 | 0.3989 |

每步以未四捨五入的狀態繼續計算。第 3 步的 $h_3=\tanh(0.2+0.5\times0.099668)\approx0.2448$；最後的 0.3989 是狀態，還不是 kWh 預測。

## 程式（補充）

兩領域各放一個四步視窗，批次大小為 2。這裡只驗證狀態更新，沒有訓練模型。

```python
import json, os
from pathlib import Path
import torch
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
torch.manual_seed(d["seed"])
x = torch.tensor(d["first_windows"])
m = torch.nn.RNN(1, 1, bias=False, batch_first=True)
with torch.no_grad():
    m.weight_ih_l0.fill_(d["rnn"]["input_weight"])
    m.weight_hh_l0.fill_(d["rnn"]["recurrent_weight"])
    y, h = m(x)
print("狀態:", [round(v, 4) for v in y[0, :, 0].tolist()])
print("形狀:", tuple(y.shape), tuple(h.shape))
```
```text
狀態: [0.0, 0.0997, 0.2448, 0.3989]
形狀: (2, 4, 1) (1, 2, 1)
```

:::tip[讀碼重點]
`batch_first=True` 使 `y` 依序是「批次、時間、特徵」。`h` 仍是「層數乘方向數、批次、隱藏寬度」。`y` 是最後一層每一步的狀態，`h` 是每層最後一步的狀態。
:::

## 怎麼用、怎麼判讀

先辨認資料是否有順序，再問每一步都要輸出，還是讀完整段才輸出。序列到一個標籤可用於情感分析，逐步輸出可用於命名實體辨識；文字生成則依已讀前綴逐步預測。

### 換個場景

| 場景 | 輸入 | 輸出安排 |
|---|---|---|
| 文字：翻譯、生成、情感、實體辨識 | 有語序的詞向量 | 一標籤或文字／標記序列 |
| 語音辨識 | 依時間排列的聲學特徵 | 對應文字序列 |
| 股價、天氣、感測、醫療趨勢 | 歷史時間步量測 | 下一點或一段未來值 |
| 影片動作、內容理解 | 逐幀特徵 | 影片標籤或逐幀標記 |
| 零售補貨（補充） | 每日銷量 | 下一天需求 |
| 交通管理（補充） | 逐分鐘車流 | 下一時段流量 |

:::supplement[來源：PyTorch RNN 文件；Dive into Deep Learning 9.4]
語音與翻譯的輸入、輸出長度可不同，需要合適的解碼或對齊設計；單一 RNN 層不會自動完成整個系統。感測預測只能用截止點前可取得的資料，不能混入下一時點量測。
:::

## 常見誤解

- 「四步視窗就是四層網路。」時間步共享權重，堆疊層通常各有自己的參數。
- 「狀態能永遠完整記得每筆輸入。」長序列仍有長期依賴及梯度問題。
- 「RNN 的最後狀態就是原單位預測。」還要接輸出頭並處理單位換算。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-72`～`guide-3:4-75`：支持結構、權重共享、可變長度及四類應用；已回看 PDF 110～113 頁。
- 科目 1 指引 `guide-1:3-7`～`guide-1:3-8`、`guide-1:5-10`：支持序列模型、前一步資訊與結構說明。
- [PyTorch RNN](https://docs.pytorch.org/docs/2.12/generated/torch.nn.RNN.html)：支持更新式、程式與形狀。
- [Dive into Deep Learning 9.4](https://d2l.ai/chapter_recurrent-neural-networks/rnn.html)：支持狀態摘要、輸出層與展開的教學安排。

## 小結

- 每一步把當下輸入與先前狀態結合。
- 權重跨時間共享，參數數不隨步數成長。
- 輸出可以是一個標籤，也可以是一串結果。
- 長期依賴仍可能難學，狀態也不等於最終預測。
