---
id: image-segmentation
title: 語意分割與實例分割
kind: technique
codes: [L21102]
aliases: [Instance Segmentation, Semantic Segmentation, 語義分割]
requires: [computer-vision-tasks]
summary: 語意分割替像素判類別，實例分割另外區分同類的不同個體
goals:
  - id: g1
    text: 用同一張街景的類別圖與個體遮罩，分辨語意、實例分割及背景處理差異
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 街景有 2 名行人，類別圖將他們的像素全部標成 1。下列判讀何者合理？
    options:
      A: 類別值是 1，表示畫面中剛好只有一名行人
      B: 類別值是 1，表示兩名行人一定互相連通
      C: 類別值是行人，仍無法單靠它判定個體歸屬
      D: 類別值是行人，就已經提供每名行人的獨立身分
    answer: C
    explain:
      A: 類別編號是名稱的代碼，不是畫面中的數量。
      B: 相同類別可分布於不相連的像素區域。
      C: 語意值只標類別，同類個體的像素仍可能無法分開。
      D: 類別沒有提供每個個體的歸屬，需額外的實例資訊。
  - id: c2
    goal: g1
    type: choice
    prompt: 交通 T01 有道路、建築及 2 名行人。若只交 2 份行人實例遮罩，還缺少哪種資訊？
    options:
      A: 每名行人的可見輪廓，因為遮罩只能畫矩形
      B: 未被行人覆蓋的像素，究竟是道路還是建築
      C: 每份遮罩的個體歸屬，因為兩份就必屬同人
      D: 所有行人的整體範圍，因為遮罩無法取聯集
    answer: B
    explain:
      A: 像素遮罩可表示非矩形輪廓，並不限於框。
      B: 實例遮罩描述個體範圍，通常不再區分背景中的道路與建築。
      C: 兩份遮罩可各有獨立 ID，不因同類就合成同一個人。
      D: 各遮罩可以取聯集得到所有行人的像素範圍。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-45, guide-1:3-46, guide-1:3-50]
---

## 為什麼需要

物件框能指出人在哪裡，卻會包含框內背景。想量可行走區域、描出病灶邊界或分開重疊物件，需要像素級輸出。

影像分割（Image Segmentation）處理像素區域。先決定要類別還是個體，才知道該準備哪種遮罩（Mask）標註。

## 直覺

語意分割（Semantic segmentation）回答「這格是什麼類別」。實例分割（Instance segmentation）再回答「這格屬於哪一個物件」。

指引把實例分割視為結合物件偵測與語意分割：既區分個體，也交付各自的像素範圍。

下圖共用交通 T01。上圖的 1 都指行人；中圖的 1、2 則是兩個個體 ID。數字相同不代表兩張圖使用相同意義。

![先分清數值代表類別還是個體；語意圖保留道路與建築，行人實例圖只保留個體範圍。](figure:l21102-image-segmentation-three-outputs)

## 定義與公式

| 輸出 | 每格記什麼 | 同類個體 | 背景 |
|---|---|---|---|
| 語意分割 | 類別值 | 共用類別值 | 可細分道路、建築等類別 |
| 實例分割 | 個體遮罩與對應類別 | 每個物件獨立 | 通常不細分非物件像素 |

類別值是資料規約，不是固定數字。本組的交通類別是 0 道路、1 行人、2 建築；醫療的 0、1、2 則是一般組織、病灶、器官區，不能混用名稱。

:::supplement[來源：TorchVision 偵測教學的 Defining the Dataset；Dive into Deep Learning 14.9]
實例結果可存成「多份二元遮罩＋類別清單」，不一定壓成一張 ID 矩陣。本例用互不重疊的可見個體圖方便讀碼；一般實例預測的遮罩也可能重疊。
:::

## 走一次流程（補充）

1. 固定 `L21102-B-scenes.json` 的 T01，整張是 8×8，共 64 格。
2. 查語意圖：類別 1 有 9 格，表示行人的總像素範圍。
3. 查個體圖：ID 1 有 5 格，ID 2 有 4 格，合計仍是 9 格。
4. 查其餘 55 格：語意圖細分成 30 格道路、25 格建築；個體圖都記為 0。第一人的外接框有 6 格，遮罩只占 5 格，排除框內 1 格建築背景。

第二領域 H01 中，病灶共 5 格，分成 2 格與 3 格的兩個個體。要量病灶總範圍可用語意圖；要分別追蹤兩處可見輪廓，需保留各自遮罩。

## 程式（補充）

先把 `IPAS_REPO_ROOT` 設成 repo 根目錄。程式讀同一份資料，不載入模型；它核對類別值和個體 ID 的意義。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21102-B-scenes.json').read_text(encoding='utf-8'))
for name in ['traffic', 'medical']:
    r = d['domains'][name]['rows'][0]
    sem, ins = np.array(r['semantic_class_map']), np.array(r['instance_map'])
    counts = [int((ins == k).sum()) for k in [1, 2]]
    print(r['image_id'], '類別1:', int((sem == 1).sum()), '個體:', counts)
    print('非物件格:', int((ins == 0).sum()), '非物件類別:', sorted(np.unique(sem[ins == 0]).tolist()))
```
```text
T01 類別1: 9 個體: [5, 4]
非物件格: 55 非物件類別: [0, 2]
H01 類別1: 5 個體: [2, 3]
非物件格: 59 非物件類別: [0, 2]
```

:::tip[讀碼重點]
`sem == 1` 選所有同類像素；`ins == 1` 只選第一個個體。個體值 0 在這裡表示非物件，並不表示那裡全是道路。
:::

## 怎麼用、怎麼判讀

道路、建築、行人等場景類別適合用語意圖表達。需要區分多輛車、每個病灶的範圍時，則須實例遮罩與個體紀錄。

:::supplement[來源：Panoptic Segmentation 原始論文第 3 節；核心延伸：背景資訊的界線]
實例遮罩沒覆蓋到的區域，不一定毫無意義。若還要知道那些像素是道路還是建築，可結合語意輸出；要求統一、無重疊的全圖結果時，進一步看全景分割。
:::

### 換個場景

| 場景 | 輸出選擇與判讀 |
|---|---|
| 道路、建築與行人街景 | 先用語意圖表達各像素類別 |
| 多輛車的可見範圍 | 要分車就保留每車的實例遮罩 |
| 醫學影像分析 | 組織類別與多個病灶的個體需求分開定義 |
| 精密製造（補充） | 同類瑕疵若要逐個量測，需區分個體 |
| 農作物估面積（補充） | 總植被面積可用語意；逐株則需個體 |

## 常見誤解

- **同類像素同值，就是同一個物件。** 語意值不攜帶個體身分。
- **實例分割一定比語意分割好。** 若只需地表類別，額外個體標記未必必要。（補充）
- **個體 ID 代表跨影格的永久身分。** 單圖 ID 不保證跨時間一致，追蹤需另外定義。（補充）

## 進階

### 參考來源

- 科目 1 學習指引 `guide-1:3-45`、`guide-1:3-46`、`guide-1:3-50`：像素標註、語意與實例定義、街景及醫療的需求。
- [TorchVision 偵測教學](https://docs.pytorch.org/tutorials/intermediate/torchvision_tutorial.html)：獨立個體遮罩的資料結構與教學設計。
- [Dive into Deep Learning 14.9](https://d2l.ai/chapter_computer-vision/semantic-segmentation-and-dataset.html)：以像素標籤比較語意與其他視覺任務。
- [Panoptic Segmentation 原始論文](https://arxiv.org/abs/1801.00868)：非物件背景與完整場景輸出的差別。

## 小結

- 語意分割記類別，實例分割另外區分同類個體。
- 遮罩表示像素範圍，不限於矩形框。
- 個體圖的背景值不代表背景只有一種類別。（補充）
- 需求是否要逐個量測，決定是否保留個體資訊。
