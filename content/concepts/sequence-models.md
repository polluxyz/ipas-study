---
id: sequence-models
title: RNN、LSTM 與 GRU 的選用比較
kind: model
codes: [L21101, L21301, L23203]
aliases: [RNN、LSTM 與 GRU, RNN、LSTM 與 GRU 序列模型, recurrent-neural-network]
summary: 選序列模型要一起看狀態、門控、依賴距離與資源，並以相同資料驗證
goals:
  - id: g1
    text: 比較 RNN、LSTM、GRU 的狀態、門控、長期依賴與計算取捨
  - id: g2
    text: 依語音、感測與金融任務的依賴及部署限制選擇待比較模型
requires: [rnn, lstm, gru]
guide_refs: [guide-1:3-24, guide-1:5-10, guide-1:5-11, guide-3:4-74, guide-3:4-75]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一能源序列要比較三種單層、單向模型，輸入寬度 1、隱藏寬度 2，皆無偏差及輸出頭。哪組參數數正確？
    options:
      A: RNN 6、GRU 12、LSTM 18
      B: RNN 6、GRU 24、LSTM 18
      C: RNN 6、GRU 18、LSTM 18
      D: RNN 6、GRU 18、LSTM 24
    answer: D
    explain:
      A: GRU 除兩門還有候選變換，LSTM 除三門也有候選變換。
      B: GRU 為三組變換，LSTM 為四組，兩者數量被對調。
      C: LSTM 需要四組變換，不能只數三種門。
      D: 每組輸入與遞迴權重共 2＋4＝6，三模型各需一、三、四組。
  - id: c2
    goal: g2
    type: choice
    prompt: 醫療感測裝置以 4 點歷史預測下一點，要求延遲低於 10 毫秒。團隊發現基本 RNN 驗證誤差偏高，下一步哪項比較方式合理？
    options:
      A: 換成 LSTM 並取消延遲量測，以門控保證滿足部署需求
      B: 比較 GRU 與 LSTM 的時間驗證誤差，再量測裝置延遲
      C: 換成 GRU 並取消時間驗證，以兩門保證誤差一定較低
      D: 比較含未來資料的完整序列，以較長上下文保證公平
    answer: B
    explain:
      A: 門控不保證延遲達標，部署條件仍需量測。
      B: 同一歷史輸入與切分下比較誤差，再量測目標裝置，可同時檢查兩個需求。
      C: 兩門的精簡結構不保證預測誤差較低，不能省略驗證。
      D: 加入決策時不可得的未來量測會洩漏資訊，不能構成公平比較。
---

## 為什麼需要

語音、文字與感測資料都有順序，但「有順序」不足以決定用哪個模型。還要問重要資訊相隔多遠、可用多少計算資源，以及是否需要逐點輸出。

RNN、LSTM 與 GRU 都逐步傳遞狀態。後兩者加入門控以改善長期依賴，代價是更複雜的單步運算；它們也保留時間軸的先後依賴。

## 直覺

把同一段輸入各走一次三種單元，差異主要在每一步如何管理記憶。基本 RNN 直接更新一份狀態，LSTM 以三門管理細胞記憶，GRU 用兩門精簡更新。

![三模型讀同一段序列，比較狀態與門控設計，不把不同視窗的結果混在一起。](figure:l23203-sequence-models-compare)

## 定義與公式

本頁只作結構與選用對照。逐步數值運算分別見遞迴神經網路與序列狀態、LSTM 的細胞狀態與門控、GRU 的更新門與重置門。

| 模型 | 跨步狀態 | 門控 | 優點與限制 |
|---|---|---|---|
| 基本 RNN | 隱藏狀態 | 無顯式門控 | 結構簡單；梯度消失使長期依賴難學，訓練可能不穩定 |
| LSTM | 隱藏及細胞狀態 | 輸入、遺忘、輸出 | 較能保留長距離依賴；結構複雜，訓練較耗時 |
| GRU | 隱藏狀態 | 更新、重置 | 運算通常較快，效果常接近 LSTM；長序列仍有限制 |

梯度如何跨時間步衰減或放大，見 BPTT 與梯度消失、爆炸。門控改善長期依賴，仍不能把整段歷史無限存起來。

三者的循環更新仍有時間依賴。序列變長時，訓練所需的中間狀態增加，時間與記憶體負擔也需納入比較。

## 走一次流程（補充）

共用資料有能源與醫療各 20 時點。每個模型都以同一種四步視窗預測下一點，先在能源領域走完，再用醫療領域換景，不把兩領域混在同一場效能比較。

1. 固定輸入：能源用需求量，醫療用心率；各自使用事先指定的換算。第一個視窗的輸入皆為 0、0.1、0.2、0.3，截止點是第 4 點。
2. 固定切分：目標時點 5～12 訓練、13～16 驗證、17～20 測試。各模型用相同索引、視窗與種子 23；量測不得晚於預測截止點。
3. 先比結構：輸入寬度 1、隱藏寬度 2、單層單向、無偏差。基本 RNN 需 6 個權重，GRU 需 18 個，LSTM 需 24 個；均不含輸出頭。
4. 再比任務結果：正式實驗還需相同的訓練預算、回歸頭與驗證指標，並量測延遲及記憶體。本例只核對結構，不以 20 筆資料宣稱哪個模型較準。

每組輸入與遞迴變換需 2 加 4，共 6 個權重。基本 RNN 一組、GRU 三組、LSTM 四組；門之外的候選內容也要計數。

## 程式（補充）

同一批兩個四步視窗，檢查三種單元的輸出形狀與參數數。這些模型尚未訓練，不比較它們的隨機輸出值。

```python
import json, os
from pathlib import Path
import torch
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
x = torch.tensor(d["first_windows"])
for cls in (torch.nn.RNN, torch.nn.LSTM, torch.nn.GRU):
    torch.manual_seed(d["seed"])
    m = cls(1, 2, bias=False, batch_first=True)
    y, _ = m(x)
    print(cls.__name__, sum(p.numel() for p in m.parameters()), tuple(y.shape))
```
```text
RNN 6 (2, 4, 2)
LSTM 24 (2, 4, 2)
GRU 18 (2, 4, 2)
```

:::tip[讀碼重點]
相同隱藏寬度讓三者輸出形狀一致，參數數卻不同。公平實驗也可能固定參數或運算預算再調整寬度；必須交代比較條件，不能混用兩種基準。
:::

## 怎麼用、怎麼判讀

基本 RNN 可作較簡單的序列基準；若關鍵依賴較長，可比較 LSTM 或 GRU。GRU 結構較精簡，LSTM 提供獨立細胞記憶，兩者並無對所有任務通用的勝負。

:::supplement[來源：PyTorch RNN、LSTM、GRU 文件；Dive into Deep Learning 10.1、10.2]
參數數較少不保證端到端更快；實際速度受裝置、批次及實作影響。若真正需要的歷史在四步以外，只換門控單元而不調整輸入範圍，也無法利用沒有提供的資訊。
:::

### 換個場景

| 場景 | 需求 | 選用時檢查 |
|---|---|---|
| 語音辨識、翻譯、文字生成 | 保留語序與上下文 | 依賴距離、逐步輸出與訓練成本 |
| 感測序列 | 從歷史量測預測 | 記憶需求及計算負擔 |
| 金融時序風險 | 由交易變化判別風險 | 先後資訊與長期依賴 |
| 能源需求（補充） | 有限裝置資源 | 誤差、延遲、記憶體一起量測 |
| 零售需求（補充） | 促銷影響延遲出現 | 歷史視窗是否涵蓋依賴 |

## 常見誤解

- 「有門控就一定記得任意長的歷史。」LSTM、GRU 都仍有限制。
- 「GRU 兩門，所以只需兩組權重。」候選內容還需一組變換。（補充）
- 「只報一個驗證分數就能決定部署。」還要檢查時間條件與資源需求。（補充）

## 進階

### 參考來源

- 科目 1 指引 `guide-1:3-24`、`guide-1:5-10`～`guide-1:5-11`：支持三模型取捨、語音、感測與金融場景；已回看 PDF 31、151～152 頁。
- 科目 3 指引 `guide-3:4-74`～`guide-3:4-75`：支持長期依賴、串行限制與門控差異。
- [PyTorch RNN](https://docs.pytorch.org/docs/2.12/generated/torch.nn.RNN.html)、[LSTM](https://docs.pytorch.org/docs/2.12/generated/torch.nn.LSTM.html)、[GRU](https://docs.pytorch.org/docs/2.12/generated/torch.nn.GRU.html)：支持同條件參數與形狀比較。
- [Dive into Deep Learning 10.1](https://d2l.ai/chapter_recurrent-modern/lstm.html)、[10.2](https://d2l.ai/chapter_recurrent-modern/gru.html)：支持三模型記憶設計與選用流程的教學安排。

## 小結

- 三者都用時間狀態，LSTM、GRU 另有門控。
- LSTM 有獨立細胞記憶，GRU 用兩門精簡更新。
- 長期依賴、串行計算及資源負擔需一起考量。
- 比較時固定資料條件，再驗證誤差與部署成本。（補充）
