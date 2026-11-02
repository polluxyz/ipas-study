---
id: mlp
title: 多層感知機
kind: model
codes:
  - L23203
aliases:
  - Fully Connected Neural Network
  - 全連接網路
summary: 多層感知機以全連接隱藏層組合特徵，再依分類或迴歸任務安排輸出
goals:
  - id: g1
    text: 依任務安排輸入、全連接隱藏與輸出層，走完一次訓練流程
  - id: g2
    text: 比較表格、影像與序列輸入的參數成本及結構限制
requires:
  - backpropagation
guide_refs:
  - guide-3:4-64
  - guide-3:4-65
  - guide-3:4-66
  - guide-3:4-67
textbook: v2
author: codex
status: draft
formula_groups:
  - id: dense-parameters
    source: https://essay.utwente.nl/fileshare/file/87314/87314_Wesselink_BA_EEMCS.pdf
    status: verified
    checked_by: task_96b06ca84f70
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售模型接收 2 欄輸入，先用 8 個 ReLU 隱藏單元，再預測互斥的 3 種會員狀態。輸出安排何者合適？
    options:
      A: 只輸出 1 個 Sigmoid 就同時代表三類
      B: 隱藏層要改成 3，才能有三類輸出
      C: 輸入層要增加成 3，因為有三個類別
      D: 輸出 3 個分數，再接 Softmax
    answer: D
    explain:
      A: 單一二元機率不足以表達三個互斥類別的分佈。
      B: 隱藏寬度與類別數沒有必須相等的規定。
      C: 輸入寬度由特徵數決定，不是由類別數決定。
      D: 三個輸出對應三類，Softmax 形成同一筆的類別機率分佈。
  - id: c2
    goal: g2
    type: choice
    prompt: 表格的 2 個特徵與 32×32×3 影像都接到 32 單元全連接層，含偏置。哪個參數比較正確？
    options:
      A: 表格 64 個，影像 98304 個
      B: 表格 2 個，影像 3072 個
      C: 表格 96 個，影像 98336 個
      D: 表格 66 個，影像 101376 個
    answer: C
    explain:
      A: 兩者都只算權重，漏掉 32 個偏置。
      B: 這只算輸入維度，漏掉每個輸入到 32 個單元的權重及偏置。
      C: 輸入維度乘 32 再加 32 個偏置；展平影像的第一層參數較多。
      D: 這把偏置數當成輸入維度，實際應為每個輸出單元各一個偏置。
  - id: c3
    goal: g2
    type: choice
    prompt: 某 MLP 同時接收 30 天、每天 2 個感測值，展平成 60 維；溫度與壓力明顯相關。何者正確？
    options:
      A: 兩欄可相關，但展平不自帶時間共享機制
      B: 兩欄若相關，就違反 MLP 的統計獨立假設
      C: 展平會抹去天數順序，調換任意兩天都不影響輸出
      D: 固定兩欄就能輸入任意天數，不必調整輸入寬度
    answer: A
    explain:
      A: 全連接層可組合相關特徵，卻不自帶序列模型的結構。
      B: MLP 不要求特徵統計獨立；指引 4-67 的獨立說法需校正，見本頁「怎麼用、怎麼判讀」。
      C: 固定索引連到不同權重，調換位置一般會改變輸出。
      D: 一般全連接層輸入寬度固定，變長序列需額外設計。
---

## 為什麼需要

單一感知器只能形成線性邊界。多層感知機（Multilayer Perceptron，MLP）讓隱藏單元先組合特徵，再由後層使用這些非線性表示做預測。

指引把它定位為基本的前饋神經網路。結構化資料的分類與迴歸，或其他模型抽取特徵後的預測部分，都可使用 MLP。

## 直覺

全連接（Fully Connected）表示每個單元都接收前層的全部輸出。輸入層對應特徵數，隱藏層形成表示，輸出層配合任務；預測路徑沒有返回上一層的迴圈。

![兩個隱藏單元都接兩個輸入，輸出單元又接全部隱藏單元；各單元另外保有自己的偏置。](figure:l23203-mlp-structure)

## 定義與公式

MLP 至少有輸入、一個隱藏層與輸出層。輸入層通常只接收資料；隱藏層進行加權、偏置與非線性激活。談「幾層」時，要先說清楚是否把輸入層算進去。

| 任務 | 輸出寬度 | 常見輸出處理 | 意義 |
|---|---|---|---|
| 二元分類 | 1 | Sigmoid | 正類機率 |
| $K$ 類互斥分類 | $K$ | Softmax | 每類機率 |
| $q$ 維連續迴歸 | $q$ | 線性 | 各連續目標值 |

$K$ 是類別數，$q$ 是要預測的連續變數數量。隱藏層寬度不必等於 $K$ 或 $q$，輸入寬度則由實際特徵決定。

### 參數成本（補充）

一個輸入寬度為 $d$、輸出寬度為 $h$ 的全連接層，含偏置時參數數量為：

$$
P=dh+h
$$

$P$ 是可訓練純量參數個數；$dh$ 是權重數，$h$ 是每個輸出單元各一個偏置。多層網路把各層的數量相加；輸入層本身不另產生權重。

來源界線：依 PyTorch Linear 的 `weight`、`bias` 形狀逐項計數，是本頁的自行推導；該文件沒有直接列出完整參數計數式。多層網路逐層相加也是本頁自行延伸，並非 Wesselink 單層式的原文。完整單層式另見 Wesselink 的原始研究論文第 2.2.2 節、印刷第 12 頁式（2.6）；原文的 `N`、`M` 分別對應本頁輸入寬度與輸出寬度，包含權重與每個輸出的偏置。這個計數只涵蓋全連接層，不含額外模組的可訓練參數。

## 算一次（補充）

用零售共用資料預測流失。每筆只有到訪與消費兩欄，固定轉換後送進 2→2→1 網路；參數沿用前向與反向頁。

本網路第一層有 $2\times2+2=6$ 個參數，第二層有 $2\times1+1=3$ 個，總共 9 個。四個角點能分對只是固定參數的教學展示；完整資料的錯判例子見[前向傳播的算例](/concepts/forward-propagation/#算一次補充)。

若把同一筆輸入 $(1,0)$ 換回製造欄位，它代表溫度 80°C、壓力 1 bar；零售則代表到訪 10 次、消費 100 元。數值相同讓機制可比較，業務解釋仍必須分開。

## 程式（補充）

下面把共用固定參數放進真正的全連接模組，再核對手算與兩領域的輸出。初始化種子固定，之後將初始化值完整覆寫。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23203-A-neural-network.json").read_text(encoding="utf-8"))
torch.manual_seed(d["seed"])
m = torch.nn.Sequential(torch.nn.Linear(2, 2), torch.nn.ReLU(), torch.nn.Linear(2, 1), torch.nn.Sigmoid()).double()
with torch.no_grad():
    for layer, suffix in [(m[0], "1"), (m[2], "2")]:
        layer.weight.copy_(torch.tensor(d["network"]["W" + suffix], dtype=torch.float64))
        layer.bias.copy_(torch.tensor(d["network"]["b" + suffix], dtype=torch.float64))
X = torch.tensor([r["x"] for r in d["retail"]["rows"][:4]], dtype=torch.float64)
M = torch.tensor([r["x"] for r in d["manufacturing"]["rows"][:4]], dtype=torch.float64)
print("參數數:", sum(p.numel() for p in m.parameters()))
print("四筆預測:", (m(X).flatten() >= d["network"]["threshold"]).int().tolist())
print("兩領域數值相同:", torch.equal(m(X), m(M)))
```
```text
參數數: 9
四筆預測: [0, 1, 1, 0]
兩領域數值相同: True
```

:::tip[讀碼重點]
兩個 `Linear` 的寬度必須接得起來：2→2→1。`no_grad()` 只用於填入固定參數；這段程式核對架構與預測，訓練更新見反向傳播頁。
:::

## 怎麼用、怎麼判讀

前向先產生預測，損失函數再與真實標籤比較。反向傳播算出各參數梯度，優化器接著調整權重與偏置；反覆執行，直到達到停止條件。

MLP 能組合非線性特徵，但參數多、資料不足時容易過擬合。指引也指出全連接在高維輸入上的計算成本，以及決策不易直接解釋的問題。

:::supplement[來源：Dive into Deep Learning 5.1；Stanford CS231n Layer-wise organization]
指引 4-67 的獨立假設需校正：MLP 不要求特徵統計獨立。固定展平保留索引，但沒有自帶局部共享或時間結構，需要從資料學習相關模式。
:::

### 輸入變大時

科目 3 指引 4-67 指出，輸入維度或隱藏層寬度增加時，全連接權重會大量增加，推高計算成本。

:::supplement[來源：本組共用例子的 parameter_comparison；依 PyTorch Linear 形狀自行計數]
固定隱藏寬度 32，只比較第一個全連接層，權重與偏置都算入：

| 輸入 | 輸入寬度 $d$ | 第一層參數數 | 結構限制 |
|---|---|---|---|
| 兩欄表格 | 2 | 96 | 欄位順序必須固定 |
| 32×32×3 影像 | 3072 | 98336 | 沒有卷積的局部共享 |
| 30 天、每天兩欄 | 60 | 1952 | 沒有自動的跨時共享 |

三列分別代入 $2\times32+32$、$3072\times32+32$、$60\times32+32$。參數數不是完整成本，還要看中間激活、批次與優化器狀態。
:::

### 零售訓練流程

以下用零售情境串起指引 4-65 的二元分類輸出安排與 4-66 的訓練循環。

1. 固定索引 0–7 訓練、8、10 驗證、9、11 測試，兩個領域共用同一切分。（補充）
2. 輸入兩欄，隱藏層以兩個 ReLU 單元組合表示，最後以單一 Sigmoid 輸出流失機率。
3. 訓練批次先做前向與交叉熵，再反向求梯度、交給優化器更新。
4. 用驗證集比較設定或決定停止，再以保留的測試資料評估一次。（補充）

### 換個場景

| 場景 | 指引安排 | 判讀重點 |
|---|---|---|
| 客戶流失、信用評分、房價 | 結構化分類或迴歸 | 輸出配合任務，注意過擬合 |
| 特徵抽取後的預測層 | 接上游表示做分類或迴歸 | 輸入寬度由上游表示決定 |
| 簡單小型影像 | 可嘗試 MLP | 高維全連接成本，通常需與 CNN 比較 |
| 製造感測（補充） | 兩欄組合預測瑕疵 | 相關特徵不違反模型假設 |
| 能源序列（補充） | 固定視窗展平後預測 | 輸入長度與時間順序要設計清楚 |

## 常見誤解

- 「隱藏層有幾個單元，就只能分幾類。」類別數對應輸出層，不是隱藏層。
- 「MLP 要求輸入特徵獨立。」沒有這個統計假設。（補充）
- 「展平一定完全刪除位置。」固定索引仍可追溯位置，但模型沒有自動的局部共享。（補充）
- 「多加幾層就能避免過擬合。」容量增加可能更需要資料與正則化。

## 進階

### 線性輸出不會取消隱藏非線性（補充）

迴歸頭使用線性輸出，只表示最後一步沒有再壓縮範圍。前面的隱藏層若有非線性，整體輸入到輸出的映射仍可以是非線性。

### 參考來源

- 科目 3 指引 4-64～4-67：支持結構、三種任務輸出、訓練流程、應用與限制；4-67 的獨立假設與展平敘述已回 PDF 核對並校正。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html)：直接支持權重與偏置形狀；本頁依形狀自行計數，不把完整計數式歸為文件原式。
- [Wesselink，Reducing memory requirements for Neural Networks trained for Direction of Arrival Estimation](https://essay.utwente.nl/fileshare/file/87314/87314_Wesselink_BA_EEMCS.pdf)：University of Twente 學士研究論文，第 2.2.2 節、印刷第 12 頁式（2.6）直接列完整單層計數式；只採用含偏置的全連接層參數定義。
- [scikit-learn MLP 使用者指南](https://scikit-learn.org/stable/modules/neural_networks_supervised.html)：支持表格建模與訓練限制。
- [Dive into Deep Learning 5.1](https://d2l.ai/chapter_multilayer-perceptrons/mlp.html)及 [Stanford CS231n](https://cs231n.github.io/neural-networks-1/)：支持全連接表示、特徵交互與影像結構限制。

## 小結

- MLP 以全連接隱藏層組合非線性表示。
- 輸入寬度看特徵，輸出寬度與處理看任務。
- 訓練包含前向、損失、反向求梯度與優化器更新。
- 高維輸入增加全連接成本。
- MLP 不要求特徵獨立。（補充）
