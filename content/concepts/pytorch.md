---
id: pytorch
title: PyTorch、Autograd 與訓練模式
kind: tool
codes: [L23203]
aliases: [Autograd, eval, no_grad, train, zero_grad]
summary: PyTorch 即時計算張量，Autograd 追蹤運算以取得參數梯度
requires: [backpropagation, output-loss-contract]
guide_refs: [guide-3:4-91, guide-3:4-92]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 解釋動態計算圖、自動微分的條件與視覺語音生態用途
  - id: g2
    text: 排出訓練迴圈步驟，追蹤權重、梯度及漏清零的累積
  - id: g3
    text: 區分 train、eval、no_grad 與 requires_grad 並核對模式切換結果
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服模型用可微分張量運算算損失，其中權重 requires_grad=True，且未關閉梯度紀錄。關於動態圖，何者正確？
    options:
      A: 前向只建立未執行的圖，讀到下一筆客服訊息時才計算結果
      B: 前向會即時計算，任何 Python 整數運算都能自動反傳梯度
      C: 前向會即時計算，backward 會連同優化器一起更新模型權重
      D: 前向會即時計算，backward 沿已記錄的運算路徑累積梯度
    answer: D
    explain:
      A: 一般 eager 前向在運算時就得到張量，不是延到下一筆才執行。
      B: 自動微分依賴支援的運算與圖，並不涵蓋任意 Python 整數運算。
      C: backward 計算梯度，更新權重仍要優化器 step。
      D: 梯度從損失沿圖回傳到需要梯度的葉張量，供後續更新使用。
  - id: c2
    goal: g2
    type: choice
    prompt: 一個單參數探針初值 1、損失為參數平方，SGD 學習率 0.1。第一次 backward 後梯度 2，step 後參數 0.8；未清梯度又重算平方並 backward，梯度變多少？
    options:
      A: 梯度 1.6，因為每次 backward 都會自動覆蓋舊值
      B: 梯度 3.6，因為新梯度 1.6 加上先前留下的 2
      C: 梯度 2.0，因為 step 只改權重，之後不再反傳
      D: 梯度 0.0，因為 step 已將上一批梯度自動清除
    answer: B
    explain:
      A: 新梯度確實是 1.6，但 backward 的預設行為是累加。
      B: step 不清除 .grad，所以舊的 2 加上新的 1.6 得 3.6。
      C: step 之後仍可重新前向並反傳，梯度不會停在原值。
      D: step 不代替 zero_grad，題目也明示未清梯度。
  - id: c3
    goal: g3
    type: choice
    prompt: 模型含 Dropout 與預設追蹤統計的 BatchNorm。驗證時要停用隨機失活、使用移動統計且不建立反向圖，應如何安排？
    options:
      A: model.train()，並在 torch.no_grad() 內進行前向
      B: model.eval()，並在一般梯度開啟環境進行前向
      C: model.eval()，並在 torch.no_grad() 內進行前向
      D: model.train()，並將所有參數 requires_grad 設 False
    answer: C
    explain:
      A: no_grad 停止記錄梯度，但 train 仍使 Dropout 和 BatchNorm 採訓練行為。
      B: eval 改變層行為，卻不會自動停用 Autograd。
      C: eval 控制層模式，no_grad 控制反向圖紀錄，兩者都要處理。
      D: 凍結參數不改層模式，Dropout 仍隨機失活且統計仍可能更新。
---

## 為什麼需要

PyTorch 用接近一般 Python 的方式操作張量（Tensor，多維數值陣列）。動態計算圖（以下簡稱動態圖）在執行時形成，適合快速實驗與逐步查看中間結果。

自動微分（Autograd）替模型沿運算路徑計算梯度，讓開發者不必逐層手寫反向傳播。它負責求梯度，優化器負責更新參數。

## 直覺

前向把客服四維向量變成三類分數，損失再與正確類別比較。反向沿剛才的路徑回頭，算出每個參數對損失的影響。

![前向產生損失，反向填入梯度，step 才更改參數；下一批開始前清理舊梯度。](figure:l23203-pytorch-gradient-flow)

:::supplement[來源：PyTorch Autograd mechanics]
一般梯度模式下，至少一個輸入需要梯度，且運算支援自動微分時，才會記錄相關路徑。整數張量、離開張量系統的計算或被切斷的圖，不能期待自動接回。
:::

## 定義與公式

動態圖反映這一次前向實際走過的運算路徑。Python 條件分支改了，下一次前向可形成不同路徑；不必預先把所有分支寫成固定圖。

:::supplement[來源：PyTorch Autograd mechanics；Automatic Differentiation with torch.autograd]
指引說自動微分能算「任何運算」的梯度，應限縮為框架支援且符合微分規則的運算。ReLU 在零點等情況採框架規定的梯度；這不表示任意操作都有數學導數。
:::

### 四種開關（補充）

| 接口 | 控制什麼 | 不替代什麼 |
|---|---|---|
| `train()` | Dropout、BatchNorm 等採訓練行為 | 不執行訓練迴圈 |
| `eval()` | Dropout 停用；預設 BN 用移動統計 | 不關閉梯度紀錄 |
| `no_grad()` | 區塊內不記錄反向圖 | 不改變層模式 |
| `requires_grad` | 葉張量是否需要累積梯度 | 不凍結 BN 的移動統計 |

BatchNorm 若設 `track_running_stats=False`，驗證時也使用當批統計；上表指預設追蹤統計的情況。參數凍結後，若輸入仍需梯度，仍可追蹤輸入的運算路徑。

## 算一次（補充）

共用客服例子以 12 筆訓練資料走一次完整小批次更新。模型為 4→5→3，隱藏層 ReLU，三類 logits 配整數標籤。

1. `zero_grad` 清掉上批梯度，參數暫不改。
2. 前向產生 12×3 logits，與 12 個 long 標籤算損失。
3. `backward` 計算並累積梯度，參數仍未改。
4. `step` 使用梯度更新權重，梯度不會自動消失。
5. 驗證改成 `eval` 並搭配 `no_grad`，下輪訓練再切回 `train`。

### 漏清零探針（補充）

另用單參數的平方損失隔離梯度累積，不把它當成客服分類損失。學習率 0.1，每次都重新前向再反傳。

| 時點 | 參數值 | .grad | 解讀 |
|---|---|---|---|
| 初值 | 1.0 | 無 | 尚未反傳 |
| 第一次反傳 | 1.0 | 2.0 | 尚未更新 |
| 第一次更新 | 0.8 | 2.0 | 舊梯度仍在 |
| 不清零再反傳 | 0.8 | 3.6 | 新梯度 1.6 加上 2.0 |

若刻意累積多批梯度，可延後清零，但要明確安排損失縮放與更新頻率；不要把漏清零當作同一批的正確梯度。

## 程式（補充）

本段在 PyTorch 2.15.0+cpu 實測，使用 CPU。

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

若使用[教材程式檢查工具 run-code.mjs](https://github.com/polluxyz/ipas-study/blob/main/demo/scripts/check-textbook/README.md)，請保留 `IPAS_REPO_ROOT` 設定，讓程式在暫存目錄仍能找到資料。一般執行仍依前句設定路徑。同頁各段按順序接續執行。

先用同一份客服資料走一批，觀察梯度與參數在不同時點的狀態。固定 CPU 與種子，只核對流程，不估計真實準確率。

```python
import json, os
from pathlib import Path
import torch
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-C-frameworks.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor([r['x'] for r in d['service']['rows']])
y = torch.tensor([r['label'] for r in d['service']['rows']],dtype=torch.long)
m = torch.nn.Sequential(torch.nn.Linear(4,5),torch.nn.ReLU(),torch.nn.Linear(5,3))
opt = torch.optim.SGD(m.parameters(),lr=0.05)
old = m[0].weight.detach().clone()
m.train(); opt.zero_grad(set_to_none=True)
z = m(x[d['split']['train']])
loss = torch.nn.CrossEntropyLoss()(z,y[d['split']['train']]); loss.backward()
print('反傳後:', tuple(z.shape), m[0].weight.grad is not None, torch.equal(old,m[0].weight))
opt.step(); print('更新後權重改變:', not torch.equal(old,m[0].weight))
```
```text
反傳後: (12, 3) True True
更新後權重改變: True
```

```python
w = torch.tensor(1.,requires_grad=True)
o = torch.optim.SGD([w],lr=0.1)
o.zero_grad(set_to_none=True); w.square().backward()
print('反傳:', round(w.item(),1), round(w.grad.item(),1))
o.step(); print('更新:', round(w.item(),1), round(w.grad.item(),1))
w.square().backward()
print('漏清零:', round(w.grad.item(),1))
o.zero_grad(set_to_none=True); w.square().backward()
print('重算新梯度:', round(w.grad.item(),1))
```
```text
反傳: 1.0 2.0
更新: 0.8 2.0
漏清零: 3.6
重算新梯度: 1.6
```

下面在同一批四筆客服向量上切模式。BatchNorm 用預設移動統計；比較輸出、緩衝統計與梯度紀錄三件事，不只比較預測值。

```python
torch.manual_seed(d['seed'])
bn = torch.nn.BatchNorm1d(4)
probe = torch.nn.Sequential(bn,torch.nn.Dropout(0.5))
xb = x[:4]; start = bn.running_mean.clone()
probe.train(); a = probe(xb)
print('訓練更新統計:', not torch.equal(start,bn.running_mean))
saved = bn.running_mean.clone()
probe.eval(); b = probe(xb)
with torch.no_grad():
    c = probe(xb)
print('訓練／驗證輸出相同:', torch.allclose(a,b))
print('驗證統計未改:', torch.equal(saved,bn.running_mean))
print('eval／no_grad 需梯度:', b.requires_grad, c.requires_grad)
probe.requires_grad_(False)
print('凍結且輸入不需梯度:', probe(xb).requires_grad)
```
```text
訓練更新統計: True
訓練／驗證輸出相同: False
驗證統計未改: True
eval／no_grad 需梯度: True False
凍結且輸入不需梯度: False
```

:::tip[讀碼重點]
第一段先比權重，再呼叫 step，能確認 backward 沒偷做更新。第三段 eval 的結果仍可需要梯度，驗證不建圖要另加 no_grad。
:::

## 怎麼用、怎麼判讀

PyTorch 適合需要直接控制前向、反向與參數更新的研究及原型開發。查問題時先分清楚：資料有沒有算、圖有沒有記、梯度有沒有清、權重有沒有更新。

### 換個場景

| 場景 | 指引定位或條件 | 判讀重點 |
|---|---|---|
| 電腦視覺 | torchvision 生態 | 資料轉換與視覺模型 |
| 自然語言處理 | 指引列 torchtext | 文字資料與模型接口 |
| 語音處理 | torchaudio 生態 | 語音資料與模型工具 |
| 原型研究 | 動態路徑、即時查看 | 運算時形成圖 |
| 製造驗證（補充） | 18 張影像中的驗證索引 | eval 與 no_grad 分別設定 |
| 金融特徵模型（補充） | 部分權重不更新 | 凍結與層模式分別管理 |

### 生態工具的版本註記（補充）

torchtext 已停止開發且官方庫封存；Torchaudio 進入維護階段，影音編解碼轉向 TorchCodec。讀舊教材可辨認任務定位，選用時仍須核對版本。

## 常見誤解

- 「eval 會停止自動微分」：它控制層模式，與梯度紀錄分開。（補充）
- 「step 會清梯度」：要另行呼叫 zero_grad。（補充）
- 「所有運算都有可用梯度」：須符合自動微分條件與框架定義。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-91`、`guide-3:4-92`：動態圖、自動微分與視覺語音生態。
- [PyTorch Autograd mechanics](https://docs.pytorch.org/docs/2.9/notes/autograd.html)：微分條件、四種開關與 BatchNorm 邊界。
- [PyTorch 自動微分教學](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html)：用即時前向與反向圖解釋梯度的教學思路。
- [PyTorch 優化教學](https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html)：清梯度、反傳、更新的流程。
- [TorchText 官方庫](https://github.com/pytorch/text)、[Torchaudio 官方文件](https://docs.pytorch.org/audio/stable/index.html)：生態工具版本狀態。

## 小結

- 動態圖在前向運算時形成，Autograd 依圖求梯度。
- backward 與 step 各管梯度和參數。（補充）
- 梯度預設累加，下一批的清零時機要明確。（補充）
- eval、no_grad 與參數凍結不能互相代替。（補充）
