---
id: transfer-learning
title: 遷移學習與預訓練模型選擇
kind: technique
codes: [L23302, L21301, L21302, L23203]
aliases: [Feature Extraction, Transfer Learning, requires_grad, 凍結層, 遷移學習, 遷移學習、凍結與微調, 遷移學習與微調]
summary: 遷移學習沿用已學得的表示，再依新任務的資料與成本決定更新範圍
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-8, guide-1:3-9, guide-1:3-22, guide-1:3-26, guide-3:4-82]
goals:
  - id: g1
    text: 依標註量、領域差異與成本，比較從頭訓練、固定特徵萃取及微調
  - id: g2
    text: 讀懂凍結、換分類頭與優化器的先後，核對逐參數的實際更新
  - id: g3
    text: 安排解凍的學習率與優化器，區分參數凍結及 BatchNorm 狀態
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠只有 500 張已標註 RGB 工件影像，預算只能先跑少量實驗。已有相近影像的預訓練骨幹，哪個起點合理？
    options:
      A: 從頭訓練更大的骨幹，將全部標註與算力投入第一輪
      B: 先凍結骨幹訓練新頭，再按驗證結果決定是否解凍
      C: 直接沿用原分類頭，因為輸入同為 RGB 就不必換類別
      D: 全面微調且提高骨幹學習率，保證少量資料也能泛化
    answer: B
    explain:
      A: 小標註量與算力限制下，從頭訓練大模型的成本與過擬合風險較高。
      B: 相近表示可作起點，先限制可訓練參數，再用驗證結果決定下一步。
      C: 原任務類別可能不同，輸入通道相同不保證輸出頭能沿用。
      D: 全面微調沒有保證，大學習率也可能破壞原有表示。
  - id: c2
    goal: g2
    type: choice
    prompt: PyTorch 模型先把所有舊參數 requires_grad 設 False，再以新建的 3→2 Linear 取代分類頭，最後用可訓練參數建優化器。哪些參數會更新？
    options:
      A: 骨幹與新頭都更新，因為新建優化器會重新開啟所有梯度
      B: 骨幹與新頭都不更新，因為舊模型凍結會套用到新建層
      C: 只有舊頭的參數更新，因為換層後優化器仍追蹤舊頭
      D: 只有新頭的參數更新，因為新建層預設仍需要梯度
    answer: D
    explain:
      A: 優化器不會自動把凍結參數改回需要梯度。
      B: 新建 Linear 有自己的參數，不繼承被取代舊層的凍結設定。
      C: 優化器是在換頭後才建立，收進的是新頭而非已移除的舊頭。
      D: 新頭預設可訓練，舊骨幹維持凍結，依題述只有新頭被優化器選中。
  - id: c3
    goal: g3
    type: choice
    prompt: 原優化器只含新頭的 8 個參數。現在將骨幹最後層的 15 個參數解凍，想以 0.001 微調骨幹、0.01 更新新頭，怎麼做較正確？
    options:
      A: 只改最後層 requires_grad，沿用原優化器與原參數清單
      B: 只改 model.train 模式，兩組參數就會自動取得各自學習率
      C: 更新優化器的參數群組，明確指定兩組參數及其學習率
      D: 只將原優化器學習率降低，已排除的骨幹參數也會加入
    answer: C
    explain:
      A: 解凍只讓梯度可被計算，原優化器不會自動收進未登錄參數。
      B: train 控制層行為，不代替優化器選參與學習率配置。
      C: 可重建優化器或加入參數群組，但必須核對成員與狀態保留方式。
      D: 更改原群組的學習率，不會改變該群組有哪些參數。
  - id: c4
    goal: g1
    type: choice
    prompt: 同有 500 張標註影像，甲是與來源相似的工件照片，乙是不同模態的熱影像。應如何選擇遷移策略？
    options:
      A: 檢查兩者表示相容性，再各自比較固定特徵與微調
      B: 兩者筆數相同就用同策略，不必檢查來源任務差異
      C: 乙的領域差異較大就加大學習率，保證能消除負遷移
      D: 甲與來源相近就直接免驗證，預訓練必定優於從頭學
    answer: A
    explain:
      A: 標註量之外還要看模態與表示，使用一致切分驗證是否有幫助。
      B: 筆數不能代表領域相似度、輸入契約或特徵可遷移程度。
      C: 領域不合可能負遷移，提高學習率並不能保證修正。
      D: 相近只增加可用的可能性，仍須驗證效果與成本。
  - id: c5
    goal: g3
    type: choice
    prompt: 骨幹含預設追蹤移動統計的 BatchNorm，參數均已凍結。訓練分類頭時，哪個安排能同時保留骨幹權重與移動統計？
    options:
      A: 骨幹採 train 模式，並只把其參數排除於優化器之外
      B: 骨幹採 train 模式，並在骨幹前向外層使用 no_grad
      C: 骨幹採 eval 模式，另維持參數凍結且只更新分類頭
      D: 骨幹採 train 模式，並將分類頭的學習率調成較小
    answer: C
    explain:
      A: 排除參數不會停止 BatchNorm 在訓練模式更新移動統計。
      B: no_grad 只控制梯度紀錄，訓練模式的移動統計仍可改變。
      C: eval 固定預設 BatchNorm 的統計行為，參數凍結另控制權重梯度。
      D: 分類頭學習率與骨幹 BatchNorm 是否更新統計無關。
---

## 為什麼需要

標註有限時，從頭學所有表示可能需要很多資料與算力。遷移學習（Transfer Learning）沿用來源任務學得的表示，再適應目標任務。

指引以 BERT、GPT 為背景：先從大量文字學習，再針對特定任務微調。既有表示可被沿用，不必每個任務都從隨機權重重新學起。

:::supplement[來源：PyTorch Transfer Learning tutorial；Stanford CS231n Transfer Learning]
沿用不代表保證更好。要檢查來源與目標的模態、內容及輸入處理是否相容，再比較目標任務的驗證效果與成本。
:::

## 直覺

把模型分成產生表示的骨幹與完成任務的輸出部分。文字預訓練模型可保留已學語言表示，再改成目標任務需要的輸出。

:::supplement[來源：PyTorch Transfer Learning tutorial]
影像二分類可換一個輸出兩個分數的分類頭。先固定骨幹，只訓練新頭；若效果不足，再比較解凍部分骨幹，讓表示一起適應新任務。

![由上往下看三個階段，先固定骨幹換頭，再解凍最後層；可訓練範圍與優化器成員要一起核對。](figure:l23302-transfer-learning-freezing)
:::

## 定義與公式

預訓練模型（Pretrained Model）先在來源資料學得參數。微調（Fine-tuning）在目標資料接續訓練；本頁處理更新範圍，任務分工見預訓練、下游微調與提示的分工。

### 四種起點與成本

| 策略 | 更新範圍 | 常見起點 | 代價與限制 |
|---|---|---|---|
| 從頭訓練 | 隨機初始化的全模型 | 資料足夠、來源不合 | 通常需較多訓練資源 |
| 固定特徵萃取（補充） | 只更新新頭 | 小資料、來源相近 | 骨幹難適應新差異 |
| 部分微調（補充） | 新頭及部分骨幹 | 需調整高層表示 | 多出梯度與調參成本 |
| 全面微調 | 新頭與全部骨幹 | 資料較足且驗證支持 | 成本及過擬合風險增 |

:::supplement[來源：PyTorch Transfer Learning tutorial；Stanford CS231n Transfer Learning]
固定特徵萃取（Feature Extraction）仍要執行骨幹前向，不代表推論模型變小。只更新少數參數，主要節省反向運算及訓練狀態。

小資料且來源差很多時，先找更接近的預訓練模型或比較其他表示；不能把「全面解凍」當唯一答案。沿用不合適的表示而變差，稱為負遷移（Negative Transfer）。
:::

### 參數與狀態是兩件事（補充）

| 開關 | 直接控制 | 不能保證 |
|---|---|---|
| `requires_grad=False` | 不累積該參數的新梯度 | BatchNorm 統計不變 |
| 優化器參數清單 | `step` 可更新哪些參數 | 層自動切換訓練模式 |
| `eval()` | Dropout、BatchNorm 等行為 | 停止全部梯度紀錄 |
| `no_grad()` | 區塊內不建立反向圖 | 停止移動統計更新 |

BatchNorm 的移動平均／變異是緩衝值（Buffers），不是可訓練權重。預設追蹤統計時，骨幹設 `eval()` 可沿用來源統計；刻意適應新領域時則另設策略並驗證。

## 走一次流程（補充）

教學案例是 500 張已標註工件影像。從頭訓練需自行學表示；若有相近來源模型，可先用固定特徵建立基準，再依驗證結果試部分微調。

1. 核對來源模型的任務、輸入通道、尺寸、縮放與目標資料；先留出驗證資料。
2. 正式流程載入來源權重，凍結骨幹，再以二分類頭取代舊頭。
3. 換頭後列出可訓練參數，建立優化器，確認只有新頭被選中。
4. 用一批資料更新，比對每個參數的前後值，再評估驗證資料。
5. 需要時解凍末段，將新參數加入優化器，骨幹使用較小學習率。

下面實測用兩領域各 12 張、3×8×8 的合成影像。它們與前置框架頁保持相同影像尺寸及通道，但改成二分類；不複製前置資料或其三類標籤。

骨幹為 192→4→3，新頭為 3→2。固定骨幹只訓練 8 個參數；解凍最後的 4→3 層後，更新範圍增為 23 個參數，其餘 772 個保持固定。

| 參數範圍 | 舊模型全凍結後 | 換頭後 | 部分解凍後 |
|---|---|---|---|
| 骨幹前層權重、偏置 | False | False | False |
| 骨幹末層權重、偏置 | False | False | True |
| 舊頭／新頭權重、偏置 | False（舊頭） | True（新頭） | True（新頭） |

表內是 `requires_grad` 狀態。新頭的兩個張量取代舊頭，不是把舊張量的數值或凍結設定搬過來。

本例未載入真正的預訓練權重，而以固定種子的隨機權重作控制探針。因此只驗證 API、成員與更新順序，不能據此宣稱遷移效果或準確率。

## 程式（補充）

執行前把 `IPAS_REPO_ROOT` 設成專案根目錄的絕對路徑。同頁各段依序接續，使用 CPU，不下載資料或權重。

### 建立控制模型與換頭（補充）

```python
import json, os
from pathlib import Path
from collections import OrderedDict
import torch
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23302-C-transfer-images.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed']); torch.set_num_threads(1)
r = d['domains']['manufacturing']['rows']
x = torch.tensor([v['pixels'] for v in r], dtype=torch.float32)
y = torch.tensor([v['label'] for v in r], dtype=torch.long)
backbone = torch.nn.Sequential(torch.nn.Flatten(), torch.nn.Linear(192,4), torch.nn.Tanh(), torch.nn.Linear(4,3), torch.nn.Tanh())
m = torch.nn.Sequential(OrderedDict(backbone=backbone, head=torch.nn.Linear(3,3)))
m.requires_grad_(False)
m.head = torch.nn.Linear(3,2)
print('可訓練／總參數:', sum(p.numel() for p in m.parameters() if p.requires_grad), sum(p.numel() for p in m.parameters()))
```
```text
可訓練／總參數: 8 795
```

### 核對第一批更新（補充）

```python
opt = torch.optim.SGD([p for p in m.parameters() if p.requires_grad], lr=0.01)
def update_and_report():
    old = {n: p.detach().clone() for n,p in m.named_parameters()}
    m.train(); m.backbone.eval()
    opt.zero_grad(set_to_none=True)
    loss = torch.nn.CrossEntropyLoss()(m(x[d['train']]), y[d['train']])
    loss.backward(); opt.step()
    for n,p in m.named_parameters():
        print(n, '可訓練', p.requires_grad, '已改變', not torch.equal(old[n],p))
update_and_report()
```
```text
backbone.1.weight 可訓練 False 已改變 False
backbone.1.bias 可訓練 False 已改變 False
backbone.3.weight 可訓練 False 已改變 False
backbone.3.bias 可訓練 False 已改變 False
head.weight 可訓練 True 已改變 True
head.bias 可訓練 True 已改變 True
```

### 解凍後重新選參（補充）

```python
m.backbone[3].requires_grad_(True)
members = {id(p) for g in opt.param_groups for p in g['params']}
print('原優化器包含解凍權重:', id(m.backbone[3].weight) in members)
opt = torch.optim.SGD([
    {'params': m.backbone[3].parameters(), 'lr': 0.001},
    {'params': m.head.parameters(), 'lr': 0.01}])
print('可訓練參數:', sum(p.numel() for p in m.parameters() if p.requires_grad))
print('群組學習率:', [g['lr'] for g in opt.param_groups])
update_and_report()
```
```text
原優化器包含解凍權重: False
可訓練參數: 23
群組學習率: [0.001, 0.01]
backbone.1.weight 可訓練 False 已改變 False
backbone.1.bias 可訓練 False 已改變 False
backbone.3.weight 可訓練 True 已改變 True
backbone.3.bias 可訓練 True 已改變 True
head.weight 可訓練 True 已改變 True
head.bias 可訓練 True 已改變 True
```

骨幹學習率較小，是為了避免快速破壞已學表示；0.001／0.01 是本例設定，不是通用比例。正式工作須用驗證結果選擇。

重建優化器會重設動量等狀態；也可用 `add_param_group` 保留既有群組的狀態。這裡用無動量 SGD，明確展示成員改變，沒有要保留的動量。

### 隔離 BatchNorm 緩衝值（補充）

```python
bn = torch.nn.BatchNorm1d(3)
bn.requires_grad_(False)
probe = x[d['train']].mean(dim=(2,3))
old = bn.running_mean.clone()
bn.train()
with torch.no_grad():
    bn(probe)
print('凍結加 no_grad，統計仍改變:', not torch.equal(old,bn.running_mean))
saved = bn.running_mean.clone(); bn.eval()
with torch.no_grad():
    bn(probe)
print('eval 後統計保持:', torch.equal(saved,bn.running_mean))
```
```text
凍結加 no_grad，統計仍改變: True
eval 後統計保持: True
```

:::tip[讀碼重點]
先凍結再換頭，新頭預設可訓練。解凍不會自動改優化器成員；eval 不會禁止可訓練層求梯度，最後層仍能微調。

本例骨幹沒有 BatchNorm 或 Dropout，`eval()` 不影響它的輸出，只示範固定特徵時的模式安排。BatchNorm 的效果看最後一段獨立探針。
:::

## 怎麼用、怎麼判讀

少量標註的文字任務，可從適合任務的預訓練模型起步。指引的 BERT、GPT 背景說明表示可沿用，不表示兩者的原輸出或輸入處理可以任意互換。

### 模型選擇清單（補充）

先確認輸入模態、前處理與目標任務，再比較來源表示、可用標註與訓練成本。保留同一驗證切分，比較固定特徵、部分微調及全面微調是否改善。

若參數的 `.grad` 還留著舊梯度，凍結前先清成 `None`，並核對優化器的參數群組。梯度存在參數上；優化器另保存動量等狀態，使用時也要核對。

單看 `requires_grad` 不如一批更新前後比對可靠。SGD 會略過 `.grad is None` 的參數，但殘留的舊梯度仍可能讓凍結參數被更新。

### 換個場景

| 場景／資料條件 | 起點 | 需核對的差異 |
|---|---|---|
| 少量標註文字 | 預訓練後做任務微調 | 語料與下游任務 |
| BERT／GPT 大量文本預訓練 | 沿用已學語言表示 | 理解與生成的任務需求 |
| 500 張工件（補充） | 相近骨幹加新頭 | 來源類別、影像處理 |
| 能源熱影像（補充） | 比較來源是否相容 | 模態差異與負遷移 |
| 醫療影像（補充） | 比較固定特徵與微調 | 標註量與領域差距 |

## 常見誤解

- **換頭會沿用舊頭的凍結設定。** 新建層有新的參數，預設可訓練，要重新列清單。（補充）
- **解凍就會被原優化器更新。** 還要看它是否包含該參數，以及是否有可用梯度。（補充）
- **凍結就完全固定模型狀態。** BatchNorm 緩衝值與 Dropout 模式需另管。（補充）
- **預訓練模型一定勝過從頭訓練。** 來源不合、資料不足或微調設定不當，都可能變差。（補充）

## 進階

### 參考來源

- 科目 1 指引 `guide-1:3-8`、`guide-1:3-9`；科目 3 指引 `guide-3:4-82`：支持大量文本預訓練、少量標註與 BERT／GPT 下游任務背景。
- 科目 1 指引 `guide-1:3-22`：支持語境詞嵌入的預訓練模型能遷移至其他任務，減少標註與訓練資源需求。
- 科目 1 指引 `guide-1:3-26`：支持從頭訓練與預訓練後微調的策略對照。
- [PyTorch 遷移學習教學](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html)：支持固定骨幹、換頭及可訓練參數操作。
- [Keras 遷移學習指南](https://keras.io/guides/transfer_learning/)：支持微調前先訓練新頭、小學習率及 BatchNorm 狀態的教學思路。
- [Stanford CS231n 遷移學習筆記](https://cs231n.github.io/transfer-learning/)：支持資料量、領域相似度與微調範圍的策略比較。
- [PyTorch Autograd mechanics](https://docs.pytorch.org/docs/2.15/notes/autograd.html)：支持參數凍結、eval 與 no_grad 的界線。
- [PyTorch 優化器文件](https://docs.pytorch.org/docs/2.15/optim.html)：支持參數群組及解凍後的成員管理。
- [PyTorch SGD 原始碼](https://github.com/pytorch/pytorch/blob/v2.15.0/torch/optim/sgd.py)：支持以參數的 `.grad` 是否為 `None` 決定是否納入更新，以及動量狀態的保存位置。

## 小結

- 預訓練提供可沿用的表示，目標任務仍要驗證。
- 標註量、來源相似度與成本共同決定更新範圍。（補充）
- 先凍結、換頭，再建立並核對優化器參數。（補充）
- 解凍須管理學習率與優化器；BatchNorm 狀態另管。（補充）
