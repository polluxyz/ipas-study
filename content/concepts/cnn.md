---
id: cnn
title: 卷積神經網路
kind: model
codes: [L23203, L21102, L21301]
aliases: [Convolutional Neural Network, convolutional-neural-network]
summary: 卷積神經網路逐層學習局部模式並組合特徵，供影像等有結構資料的預測使用
requires: [convolution-layer, backpropagation]
guide_refs: [guide-1:3-48, guide-1:3-49, guide-1:5-10, guide-1:5-11, guide-3:4-69, guide-3:4-70, guide-3:4-71]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 說明五類層的分工，走過 CNN 前向、損失、反向與更新流程
  - id: g2
    text: 依局部與層次特徵需求，判斷影像、文字與頻譜的使用方式
  - id: g3
    text: 依標註量、變形與算力限制，判讀 CNN 的優點和風險
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 二類 CNN 已前向產生四筆、每筆兩個 logits。下一步要用標籤學習權重，流程應為何？
    options:
      A: 計算損失後直接更新，接著用 Softmax 產生梯度
      B: 對 logits 做最大池化，再讓 Flatten 學習分類權重
      C: 計算損失後反向求梯度，再由優化器更新可訓練參數
      D: 計算損失後更換標籤，再由優化器更新輸出特徵圖
    answer: C
    explain:
      A: 優化器需要先有梯度，Softmax 本身不是反向流程的替代品。
      B: 分類分數不應以池化代替損失，Flatten 也沒有可學權重。
      C: 損失比較預測與標籤，反向求梯度，優化器才據此更新權重與偏置。
      D: 標籤是監督依據，模型學習時應更新參數而非竄改標籤。
  - id: c2
    goal: g2
    type: choice
    prompt: 三個任務分別是產線刮痕影像、語音頻譜、短語情感分類。如何判斷是否可用 CNN？
    options:
      A: 三者都有局部模式，可選相應表示與卷積軸建模
      B: 只有影像有局部模式，頻譜和文字都無法用卷積
      C: 三者都須先任意打亂位置，才能符合權重共享要求
      D: 三者都須轉為相同 RGB 影像，才能進行卷積運算
    answer: A
    explain:
      A: 影像鄰域、時間頻率鄰域及詞語短片段都可提供局部線索。
      B: 指引也列出語音頻譜和文字局部特徵的用途。
      C: 任意打亂位置會破壞局部關係，不是共享權重的必要條件。
      D: 通道與卷積軸應配合資料，文字和頻譜不必偽裝成 RGB。
  - id: c3
    goal: g3
    type: choice
    prompt: 團隊只有 16 張已標註影像，想把小 CNN 加深到 100 層並直接部署。下列判讀何者合理？
    options:
      A: 共享權重已排除過擬合，只需比較訓練準確率
      B: 小資料仍可能過擬合，應驗證泛化及裝置推論成本
      C: 池化已保證旋轉不變，只需比較模型的層數
      D: 訓練使用 GPU 即可保證部署速度，只需保存權重
    answer: B
    explain:
      A: 共享降低參數需求，但沒有排除資料不足造成的過擬合。
      B: 深度不是品質保證，獨立資料表現與目標裝置成本都要核對。
      C: 池化不保證大幅旋轉或尺度變化都能正確辨識。
      D: 訓練硬體與部署硬體、批次及運算流程可能不同。
---

## 為什麼需要

辨識一張產品照片，可能先看邊緣，再看紋理與零件組合。卷積神經網路（CNN）用多層運算，把局部回應逐步組成預測所需的特徵。

CNN 的英文全名是 Convolutional Neural Network，意思是以卷積為核心的神經網路。

這減少逐項手工設計影像特徵的需求，但不免除資料整理、標註與評估。資料太少或場景改變，模型仍可能只記住訓練樣本。

## 直覺

卷積層找局部模式；激活函數加入非線性；池化縮小空間特徵。後段再組合特徵，產生分類或迴歸結果。

![由局部特徵走向分類，前向產生預測；標籤形成損失後，反向更新卷積與分類頭。](figure:l23203-cnn-training-flow)

前幾層常學到較簡單的邊緣與紋理，後續層能整合更大的範圍。這是多層特徵的直覺，不能保證每個通道都有固定、可命名的語意。

## 走一次流程

使用共用例子的製造瑕疵資料：16 張 8×8×3，標籤分直向與橫向。

### 五類層各做什麼

| 層 | 本例輸入→輸出 | 分工 |
|---|---|---|
| 卷積 | 8×8×3→6×6×2 | 學兩組局部模式回應 |
| 激活 | 6×6×2→6×6×2 | ReLU 加入非線性 |
| 池化 | 6×6×2→3×3×2 | 區域摘要、縮小高寬 |
| 全連接 | 展平 18 維→2 維 | 組合特徵成類別分數 |
| 輸出轉換 | 2 個分數→2 個機率 | Softmax 便於判讀比例 |

:::supplement[來源：PyTorch Neural Networks；Keras GlobalAveragePooling2D]
表中尺寸是標準卷積與池化設定的補充實算。Flatten 只把 3×3×2 重排成 18 維，不是全連接層本身；CNN 也可以使用全域平均池化等頭部設計，並非一定要接全連接。
:::

### 訓練到評估

1. 收集並標註影像，統一大小，保留訓練、驗證與測試資料。
2. 前向依序抽取局部特徵，分類頭產生分數，再與真實標籤計算損失。
3. 反向傳播求各層梯度；優化器更新卷積核、全連接權重及偏置。
4. 用驗證資料選設定；完成後再評估保留的測試資料。（補充）

:::supplement[來源：PyTorch Neural Networks；共用例子 L23203-D-images.json]
PyTorch `CrossEntropyLoss` 接收 logits，展示機率時才另做 Softmax。詳細搭配見輸出層、標籤與損失函數的搭配。

交通標誌資料的尺寸與索引相同，可照這些步驟另建模型；本頁程式只走製造資料的一步更新，不混用兩個領域的標籤。

這份玩具資料有重複影像；驗證、測試影像都能在訓練集中找到相同像素。因此這個切分只示範索引，不能用來獨立評估；實際評估前須依影像內容去重後重新切分。
:::

## 程式（補充）

請先把環境變數 `IPAS_REPO_ROOT` 設為 repo 根目錄的絕對路徑。以下用 CPU 只跑一個訓練步驟，確認資料流與梯度，不用四張影像的結果宣稱模型品質。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-D-images.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
rows = [d['manufacturing']['rows'][i] for i in d['split']['train'][:4]]
x = torch.tensor([r['pixels'] for r in rows], dtype=torch.float32).permute(0,3,1,2)
y = torch.tensor([r['label'] for r in rows])
m = torch.nn.Sequential(torch.nn.Conv2d(3,2,3),torch.nn.ReLU(),torch.nn.MaxPool2d(2),torch.nn.Flatten(1),torch.nn.Linear(18,2))
opt = torch.optim.SGD(m.parameters(),lr=0.01)
opt.zero_grad(); logits = m(x)
torch.nn.CrossEntropyLoss()(logits,y).backward()
print('logits／標籤:', tuple(logits.shape), tuple(y.shape))
print('各組參數有梯度:', [p.grad is not None for p in m.parameters()])
opt.step()
print('機率和:', logits.softmax(1).sum(1).detach().round().tolist())
```
```text
logits／標籤: (4, 2) (4,)
各組參數有梯度: [True, True, True, True]
機率和: [1.0, 1.0, 1.0, 1.0]
```

:::tip[讀碼重點]
四組梯度分別來自卷積權重、卷積偏置、Linear 權重與 Linear 偏置。ReLU、池化與 Flatten 沒有可訓練參數，但梯度仍可沿它們的運算路徑往前傳。
:::

## 怎麼用、怎麼判讀

有鄰近關係與重複局部模式時，CNN 是可考慮的模型。影像是空間鄰域，頻譜是時間與頻率鄰域，文字則可用相鄰詞語組成短片段。

### 資料、變形與資源限制

只有本例的 16 張影像，即使訓練全對，也無法證明能辨識新相機或新產線。增加網路深度可能讓記憶訓練資料更容易；共享權重不會自動消除過擬合。

大型 CNN 的訓練要反覆前向、反向與更新，常需較多資料及 GPU 資源。推論則使用已學權重產生預測，仍有運算與記憶體成本；兩個階段應分開估計。

對小幅移動可能較穩健，不代表對大角度旋轉、尺度變化或任意位置都不變。重要變形要用合適資料、資料增強與獨立評估驗證。

:::supplement[來源：Stanford CS231n 卷積網路]
科1 指引 5-10 用位置不變性概括 CNN 的特性，不能理解為嚴格保證。共享讓相同偵測規則能移到別處；即使只是小幅移動，邊界、步幅與分類頭也可能使預測改變。
:::

### 換個場景

| 場景 | 局部資料結構 | 使用方式與限制 |
|---|---|---|
| 物體、人臉、手寫字分類 | 邊緣、紋理、部件 | 組合成整張類別，仍需標註 |
| 醫療、產線、自駕 | 病灶、瑕疵、道路物件 | 留意細節、變形與場景差異 |
| 圖像分割 | 每個像素的鄰域 | 需保留或恢復空間解析度 |
| 文字分類、情感分析 | 相鄰詞語的短片段 | 局部線索不等於任意長距依賴 |
| 語音頻譜 | 時間與頻率鄰域 | 先選對表示與卷積方向 |

以上場景都由指引列出。第二列合併醫療、產線、自駕，分別對應影像診斷、工業檢測與道路感知。

| 其他場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 農業葉片（補充） | 局部斑點、拍攝光線多變 | 不把背景顏色當病害線索 |
| 遙測土地（補充） | 多光譜通道、尺度不同 | 輸入通道與解析度須一致 |

## 常見誤解

- 「CNN 只能用於照片」：指引也列文字局部特徵與語音頻譜。
- 「自動抽特徵代表不需整理資料」：品質、標註與切分仍影響結果。
- 「池化能保證任意旋轉都不影響預測」：穩健性有範圍，仍須驗證。
- 「所有 CNN 都必須有全連接層」：分類頭可以採其他結構。（補充）

## 進階

### 從小網路到多層抽象

本例只用一個卷積區塊，目的是看清資料流。深層 CNN 可堆疊更多區塊，逐步組合特徵；經典 CNN 架構與殘差連接再處理更深網路的設計問題。

### 參考來源

- 科目 1 指引 `guide-1:3-48`～`guide-1:3-49`：五類層、影像分類、自動特徵與小資料限制。
- 科目 1 指引 `guide-1:5-10`～`guide-1:5-11`：局部空間特徵、醫療、工業檢測與自駕。
- 科目 3 指引 `guide-3:4-69`～`guide-3:4-71`：前後向、應用情境、算力與變形限制；已核對 PDF 頁 107–109。
- [PyTorch Neural Networks](https://docs.pytorch.org/tutorials/beginner/blitz/neural_networks_tutorial.html)：補充程式、logits 搭配損失及梯度流程。
- [Keras GlobalAveragePooling2D](https://keras.io/api/layers/pooling_layers/global_average_pooling2d/)：不一定使用展平及全連接分類頭的補充設計。
- [D2L 7.6 LeNet](https://d2l.ai/chapter_convolutional-neural-networks/lenet.html)：直覺圖與逐層追蹤的教學思路。
- [Stanford CS231n 卷積網路](https://cs231n.github.io/convolutional-networks/)：局部特徵到分類的架構思路。

## 小結

- 卷積、激活、池化與分類頭各有分工。
- 前向產生預測，損失引導反向求梯度與參數更新。
- CNN 適合有局部結構的資料，也能處理文字及頻譜。
- 共享權重不免除標註、算力、泛化與變形限制。
