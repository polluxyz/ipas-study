---
id: vision-transformer
title: 視覺 Transformer
kind: model
codes:
  - L21102
  - L23203
aliases:
  - Patch
  - ViT
  - Vision Transformer
  - Vision Transformer 的區塊序列
summary: 視覺 Transformer 把影像切成區塊序列，再以注意力整合區塊資訊
goals:
  - id: g1
    text: 比較 ViT 的區塊序列與 CNN 的局部卷積輸入處理
  - id: g2
    text: 畫出帶尺寸的切塊、展平、投影及位置資訊資料流
  - id: g3
    text: 計算 patch 和含分類詞元的序列長度，判斷成本及資料條件
requires:
  - transformer
  - convolution-layer
guide_refs:
  - guide-1:3-44
  - guide-3:4-84
textbook: v2
author: codex
status: draft
formula_groups:
  - id: patch-shapes
    source: https://arxiv.org/html/2010.11929v2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-H
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一批 8×8 病葉影像，哪項正確比較基本 ViT 與 CNN？
    options:
      A: ViT 先做局部池化；CNN 先將所有像素接成句子
      B: ViT 先切成區塊序列；CNN 以局部卷積擷取特徵
      C: ViT 先移除全部位置；CNN 只讀最後一個像素
      D: ViT 先生成文字標籤；CNN 不需要影像作為輸入
    answer: B
    explain:
      A: 基本 ViT 的起點是區塊表示，CNN 也不先把像素當文字句。
      B: 區塊序列送進注意力，卷積則在局部視窗重用權重。
      C: 位置有助保留空間關係，卷積不只讀最後像素。
      D: 標籤是輸出，不能取代兩者的影像輸入。
  - id: c2
    goal: g2
    type: choice
    prompt: 單張 8×8×3 影像以不重疊 4×4 區塊切分，投影寬度為 6。加入分類詞元後形狀為何？
    options:
      A: 四塊各 16 維，投影後共四個 6 維詞元
      B: 十六塊各 12 維，投影後共十七個 6 維詞元
      C: 四塊各 48 維，投影後共五個 6 維詞元
      D: 四塊各 48 維，投影後共五個 48 維詞元
    answer: C
    explain:
      A: 忽略了三通道，也沒有計入分類詞元。
      B: 每邊只有兩塊，不能算成十六個影像區塊。
      C: 每塊四乘四乘三為四十八，加一分類詞元得五。
      D: 線性投影的輸出寬度由設定的六維決定。
  - id: c3
    goal: g3
    type: choice
    prompt: 保留 4×4 區塊、含一個分類詞元，把 8×8 影像改成 16×16。每頭密集注意力配對格數如何變？
    options:
      A: 由 16 格變 64 格，因為只算原始像素的一邊
      B: 由 25 格變 81 格，因為每邊區塊都只多一個
      C: 由 64 格變 256 格，因為區塊數等於影像寬度
      D: 由 25 格變 289 格，因為序列長度由 5 變 17
    answer: D
    explain:
      A: 配對應由詞元數平方計算，不是單邊像素。
      B: 十六乘十六配四乘四區塊會有十六塊，不是八塊。
      C: 詞元數由高寬和區塊尺寸共同決定，且有分類詞元。
      D: 四塊加一為五，十六塊加一為十七，平方即配對格數。
---

## 為什麼需要

同一張病葉圖，CNN 以局部卷積逐層擷取特徵；視覺 Transformer（Vision Transformer, ViT）則把圖像轉成區塊序列，交由 Transformer 處理。

兩者都能做影像分類，差異在如何組織輸入與交換資訊。理解資料流，才不會把影像區塊誤當成已經完成分類的特徵。

## 直覺

把影像依固定格線切開，每個影像區塊（Patch）成為序列的一個位置。自注意力可以整合不同區塊的關聯，例如病斑與附近葉脈的關係。

:::supplement[來源：ViT 3.1；Dive into Deep Learning 11.8]
各區塊先展平並經相同的線性投影，變成等寬的詞元向量。加上位置資訊後，模型才能辨識區塊位於左上或右下；展平本身不會告訴注意力這個位置。
:::

![先看 8×8 影像的四個 4×4 區塊，再追蹤 48 維展平到 6 維詞元的路徑。](figure:l23203-vision-transformer-patch-flow)

## 定義與公式

ViT 將固定尺寸的影像區塊當作序列輸入。這保留了 Transformer 接收一列表示向量的介面，但每個位置代表影像區域，不是自然語言的字詞。

### 尺寸與分類詞元（補充）

對高寬可被區塊邊長整除、無重疊且不補邊的影像：

$$
N=\frac{H}{P}\frac{W}{P},\qquad d_p=P^2C,\qquad L=N+1.
$$

$H,W$ 是影像高寬，$P$ 是正方形區塊邊長，$C$ 是通道數；$N$ 是區塊數，$d_p$ 是各塊展平維度。$L$ 是另加一個分類詞元後的序列長度。

線性投影把每塊的 $d_p$ 維轉成指定的 $D$ 維。加入可學的分類詞元與位置向量後，單張輸入形狀為 $L\times D$；分類頭讀分類詞元的最終表示。

若影像不能整除，須先規定縮放、裁切或補邊方式；若架構改用平均池化、不加分類詞元，序列長度就是 $N$，不能固定加一。

## 算一次

共用例子 A01 是 $8\times8\times3$ 的病葉合成影像，區塊邊長為 4。每邊切兩塊，共 $N=(8/4)(8/4)=4$ 塊。

:::supplement[來源：ViT 3.1]
每塊展平為 $d_p=4^2\times3=48$ 維。投影寬度指定為 $D=6$，四塊便成為 $4\times6$；再加入分類詞元與位置向量，得到 $5\times6$。

若高寬改成 16，區塊仍為 4，就有 16 塊、17 個詞元。每頭密集分數矩陣由 $5^2=25$ 格增至 $17^2=289$ 格；這只是注意力配對量，不是整個模型延遲。
:::

## 程式（補充）

用編號陣列代替影像值，只核對切塊與展平形狀。分類詞元是後續加的向量，不是從影像多切出的一塊。

```python
import numpy as np
image = np.arange(8 * 8 * 3).reshape(8, 8, 3)
p, width = 4, 6
patches = image.reshape(2, p, 2, p, 3).transpose(0, 2, 1, 3, 4)
flat = patches.reshape(4, -1)
print("區塊矩陣:", flat.shape)
print("含分類詞元的預期形狀:", (len(flat) + 1, width))
for side in (8, 16):
    length = (side // p) ** 2 + 1
    print(f"邊長 {side}: {length} 詞元, {length ** 2} 配對")
```
```text
區塊矩陣: (4, 48)
含分類詞元的預期形狀: (5, 6)
邊長 8: 5 詞元, 25 配對
邊長 16: 17 詞元, 289 配對
```

:::tip[讀碼重點]
transpose 把兩條區塊索引軸移到前面，再展平塊內高、寬、通道。若直接把影像 reshape 成四列，列的內容不會等於四個二維區塊。
:::

## 怎麼用、怎麼判讀

指引把 ViT 放在電腦視覺的架構選項中，可用於影像分類。切成序列的做法，讓它沿用 Transformer 整合跨區域資訊。

:::supplement[來源：ViT 3.1、4.3]
CNN 內建局部連結與卷積權重共享等先驗；基本 ViT 的空間先驗較少，更依賴資料與預訓練。資料少時不要直接假定從零訓練 ViT 一定勝過 CNN，應固定切分比較。

較小的區塊保留較細的空間資訊，但會增加詞元與注意力成本。分類與病斑定位也不是同一輸出，定位需要對應的任務頭及標籤。
:::

### 換個場景

| 場景 | 輸入與任務 | 判讀重點 |
|---|---|---|
| 影像分類 | 區塊序列交給 Transformer | 區塊代表局部影像區域 |
| 法律文件頁面（補充） | 掃描頁分類 | 文字小，區塊尺寸影響細節 |
| 製造表面檢查（補充） | 瑕疵影像分類 | 小瑕疵別在縮放時消失 |

## 常見誤解

- 「ViT 輸入的是文字。」輸入可為影像區塊的向量表示。
- 「區塊數等於像素數。」區塊高寬決定序列長度。（補充）
- 「序列位置已自帶二維座標。」仍需設計位置資訊。（補充）
- 「ViT 不用卷積，所以資料少也必勝。」模型先驗與預訓練條件仍影響結果。（補充）

## 進階

### 參考來源

- 科目 1 指引 guide-1:3-44、科目 3 指引 guide-3:4-84（版本未標示，本機快照）：支持 ViT 定位及影像區塊序列；科目 3 已教切塊，並非全屬新增內容。
- [ViT 3.1、4.3](https://arxiv.org/html/2010.11929v2)：支持尺寸、投影、分類詞元、位置資訊及資料需求。
- [Dive into Deep Learning 11.8](https://d2l.ai/chapter_attention-mechanisms-and-transformers/vision-transformer.html)：參考帶尺寸切塊圖與程式教學。

## 小結

- ViT 把影像區塊轉成 Transformer 的輸入序列。
- 本例四塊各 48 維，投影並加入分類詞元後為五個 6 維向量。（補充）
- 位置資訊、區塊尺寸及資料條件都要一起考慮。（補充）
