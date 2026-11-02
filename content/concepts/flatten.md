---
id: flatten
title: Flatten 與分類頭的形狀銜接
kind: component
codes: [L23203]
aliases: [展平, 攤平]
summary: Flatten 把每筆特徵圖重排為向量，保留批次與全部數值，方便銜接分類頭
guide_refs: [guide-1:3-48, guide-3:4-69]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 追蹤含 batch 的展平形狀與順序，區分展平、池化及全連接
formula_groups:
  - id: flatten-shape
    source: https://keras.io/api/layers/reshaping_layers/flatten/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 四張製造照片的池化輸出為 (4,2,3,3)，依序是 NCHW。保留 batch 的 Flatten 後接二類 Linear，形狀應如何變化？
    options:
      A: 展平成 (1,72)，Linear 輸入 72、輸出 2
      B: 展平成 (4,18)，Linear 輸入 18、輸出 2
      C: 展平成 (4,2)，Linear 輸入 2、輸出 18
      D: 展平成 (4,9)，Linear 輸入 9、輸出 2
    answer: B
    explain:
      A: 把四筆資料合成一筆會破壞樣本與標籤對應。
      B: 每張有二乘三乘三共十八個數值，四筆各自接二類分類頭。
      C: 二是通道數，不能只保留二值而仍稱為展平。
      D: 九只計空間位置，漏掉第二個通道。
  - id: c2
    goal: g1
    type: choice
    prompt: 交通特徵圖有 3×3×2＝18 個數值。團隊比較 Flatten 與每通道全域平均池化，何者正確？
    options:
      A: 展平變成 2 個摘要，平均池化保留 18 值
      B: 展平與平均池化都保留 18 值，只改順序
      C: 展平與平均池化都變成 2 值，沒有資訊損失
      D: 展平保留 18 個值，平均池化變成 2 個摘要
    answer: D
    explain:
      A: 兩種操作的結果對調了，展平不取平均。
      B: 全域平均池化會將每個通道縮成一個值。
      C: 展平保留所有數值，全域平均則會丟失位置細節。
      D: 展平只重排，全域平均把每通道九個值摘要成一個。
---

## 為什麼需要

卷積與池化之後，每張照片仍有高、寬、通道三個維度。若分類頭要接收固定長度的向量，需要先約定這些值如何排列。

展平（Flatten）把每張圖的數值依固定順序排成一列，再交給全連接層（Dense Layer）組合成分類分數。展平與學習分類權重是兩個不同步驟。

## 直覺

把每個通道的格子依序排成一列，圖上的數值不會因展平而被取平均或刪除。分類頭仍能學某個位置的權重，只是三維位置不再直接寫在向量的軸上。

![先逐列排列第一通道，再排列第二通道；每筆資料各自展平，批次不混合。](figure:l23203-flatten-order)

:::supplement[來源：Keras Flatten；PyTorch Neural Networks 教學]
上圖採 NCHW 的邏輯順序。若換成 NHWC 排列，展平後的長度相同，元素順序可能不同；訓練與推論必須維持同一個軸約定。
:::

## 定義與公式（補充）

本頁的輸入有批次軸，展平時只合併其後的特徵軸：

$$
(N,C,H,W)\longrightarrow(N,d),\qquad d=CHW.
$$

$N$ 是批次張數，$C$ 是通道數，$H,W$ 是特徵圖高寬，$d$ 是每筆向量長度。NHWC 的長度同樣是 $HWC$，但須另外核對元素順序。

Flatten 本身沒有可訓練權重，不做降採樣。後接的全連接層才會將 $d$ 個特徵線性組合成指定數目的輸出。

## 算一次

共用例子的四張 8×8×3 照片，先經 3×3 valid 卷積與 2×2、stride 2 池化。單張變為 3×3×2，展平後有 $d=3\times3\times2=18$ 個值。

:::supplement[來源：Keras Flatten；PyTorch Linear]
下表以 NCHW 表示批次、通道、高、寬；框架的軸順序須與程式一致。
:::

| 階段 | 含 batch 的形狀 | 每筆值數 |
|---|---|---|
| 池化後 | (4,2,3,3) | 18 |
| 保留 batch 展平 | (4,18) | 18 |
| 二類 Linear | (4,2) | 2 個 logits |

向量長度是 18，不能把四張相乘變成 72 維再配四個標籤。Linear 的輸入設 18、輸出設 2，分別對應每筆特徵及兩個類別分數。

### 追蹤元素順序（補充）

另取共用例子的兩張 2×2 通道：第一通道依序 1、2、3、4，第二通道依序 10、20、30、40。按 CHW 展平成 [1,2,3,4,10,20,30,40]。

這八個數值沒有少。若每通道取全域平均，則變成 [2.5,25]；那是摘要，不是展平。兩種結果不可直接接同一個輸入長度的 Linear。

## 程式（補充）

請先把環境變數 `IPAS_REPO_ROOT` 設為 repo 根目錄的絕對路徑。以下使用 CPU，固定種子；同頁兩段程式依序執行。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-D-images.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor(d['flatten_demo'], dtype=torch.float32)[None]
print('原形狀:', tuple(x.shape))
print('展平:', torch.nn.Flatten(start_dim=1)(x).tolist())
print('全域平均:', x.mean(dim=(2,3)).tolist())
```
```text
原形狀: (1, 2, 2, 2)
展平: [[1.0, 2.0, 3.0, 4.0, 10.0, 20.0, 30.0, 40.0]]
全域平均: [[2.5, 25.0]]
```

```python
rgb = torch.tensor([r['pixels'] for r in d['traffic']['rows'][:4]], dtype=torch.float32).permute(0,3,1,2)
features = torch.nn.Sequential(torch.nn.Conv2d(3,2,3),torch.nn.ReLU(),torch.nn.MaxPool2d(2))(rgb)
flat = torch.nn.Flatten(start_dim=1)(features)
head = torch.nn.Linear(18,2)
print('特徵／展平／輸出:', tuple(features.shape), tuple(flat.shape), tuple(head(flat).shape))
print('展平層參數:', sum(p.numel() for p in torch.nn.Flatten().parameters()))
```
```text
特徵／展平／輸出: (4, 2, 3, 3) (4, 18) (4, 2)
展平層參數: 0
```

:::tip[讀碼重點]
`start_dim=1` 保留第零軸的樣本數。若用 `torch.flatten(x)` 的預設值從第零軸開始，會把 batch 也混入向量。
:::

## 怎麼用、怎麼判讀

指引的典型 CNN 先抽取局部特徵，再展平接到分類或迴歸用的全連接層。先追蹤特徵圖形狀，才能決定分類頭的輸入維度。

:::supplement[來源：Keras Flatten、GlobalAveragePooling2D]
科1 指引 3-48 把整合成一維向量列在全連接層下，須拆開理解：Flatten 負責重排，全連接層學習加權組合。池化則會摘要區域，三者不能混為一談。
:::

### 換個場景

| 場景 | 銜接需求 | 要核對的條件 |
|---|---|---|
| CNN 分類或迴歸 | 多層特徵接全連接 | 向量長度符合分類頭輸入 |
| 交通標誌（補充） | 固定 8×8 影像做二類分類 | 每張 18 維，batch 獨立 |
| 製造瑕疵（補充） | 更換影像解析度 | 展平長度可能跟著改變 |
| 語音頻譜（補充） | 每筆音檔長短不同 | 先處理可變形狀再接固定頭 |

## 常見誤解

- 「展平就是全連接」：前者重排，後者用可學權重產生新組合。（補充）
- 「展平會像池化一樣刪掉值」：只合併軸時，數值總數不變。（補充）
- 「包含 batch 的所有軸都要相乘」：那會把多筆資料混成一筆。（補充）
- 「展平後一定失去位置的所有資訊」：固定順序仍對應原位置，但不再顯式保留高寬軸。（補充）

## 進階

### 分類頭也可以不用展平（補充）

有些 CNN 以全域平均池化把每個通道摘要成一個值，再產生分類分數。這可減少輸入維度，但也改變保留的資訊；不能只把 Flatten 換掉而不調整分類頭。

### 參考來源

- 科目 1 指引 `guide-1:3-48`：全連接層的簡寫說明；「怎麼用、怎麼判讀」釐清展平與加權組合的分工。
- 科目 3 指引 `guide-3:4-69`：特徵展平後接全連接做分類或迴歸；已核對 PDF 頁 107。
- [Keras Flatten](https://keras.io/api/layers/reshaping_layers/flatten/)：定義與公式、保留 batch 及形狀核對。
- [PyTorch Neural Networks](https://docs.pytorch.org/tutorials/beginner/blitz/neural_networks_tutorial.html)：程式的特徵圖到分類頭流程。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html)：分類頭輸入、輸出維度與可學權重。
- [Keras GlobalAveragePooling2D](https://keras.io/api/layers/pooling_layers/global_average_pooling2d/)：全域平均的比較與進階變體。
- [D2L 7.6 LeNet](https://d2l.ai/chapter_convolutional-neural-networks/lenet.html)：逐層追蹤形狀與連接分類頭的教學思路。

## 小結

- 展平接在特徵抽取之後，方便銜接向量分類頭。
- batch 保留，單筆長度才把高、寬、通道相乘。（補充）
- 展平沒有可學參數，也不取局部摘要。（補充）
- 訓練與推論要保持同一排列約定。（補充）
