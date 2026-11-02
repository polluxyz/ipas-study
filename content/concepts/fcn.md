---
id: fcn
title: 全卷積網路
kind: model
codes: [L21102, L23203]
aliases: [Fully Convolutional Network]
requires: [cnn, image-segmentation]
contrasts:
  - target: u-net
    note: FCN 以全卷積和上採樣建立密集輸出；U-Net 以對稱編解碼和同尺度特徵串接保留定位線索
    source: [guide-1:3-51]
summary: 全卷積網路保留空間特徵，透過上採樣產生與影像對齊的像素類別輸出
goals:
  - id: g1
    text: 沿輸入、低解析度特徵與上採樣輸出，說明 FCN 如何完成像素級分類
formula_groups:
  - id: upsample-shape
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.interpolate.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: FCN 的三類分數張量為（1,3,2,2），以 NCHW 排列。只把高寬各上採樣 4 倍，輸出形狀是什麼？
    options:
      A: （1,12,2,2）
      B: （1,3,8,8）
      C: （4,3,2,2）
      D: （1,3,4,4）
    answer: B
    explain:
      A: 上採樣作用於高寬，不會把三個類別通道變成十二個。
      B: 批次與通道不變，高寬由二各乘四變成八。
      C: 批次大小不因空間上採樣增加。
      D: 高寬變四是乘二，與題目各乘四的設定不同。
  - id: c2
    goal: g1
    type: choice
    prompt: 工程師把 2×2 病灶分數圖放大成 8×8，便宣稱所有小病灶細節都已恢復。應如何判斷？
    options:
      A: 正確，格數增加就代表補回全部病灶細節
      B: 正確，只要輸出尺寸對齊就無須比對標註
      C: 不正確，上採樣會把每一格都改成同類別
      D: 不正確，尺寸對齊仍須驗證病灶邊界品質
    answer: D
    explain:
      A: 空間格數增加不保證已遺失的定位資訊重新出現。
      B: 尺寸一致只是對齊條件，仍要和真實遮罩比較。
      C: 上採樣按輸入與方法擴大空間，不會必然讓所有格同類。
      D: 上採樣提供密集輸出，品質仍由特徵、訓練與標註比對確認。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-50, guide-1:3-51]
---

## 為什麼需要

影像分類最後只交付整圖類別。若想知道道路或病灶的每個像素在哪一類，就要把輸出保留在空間位置上。

全卷積網路（Fully Convolutional Network，FCN）將特徵轉成密集的類別分數，再以適當的上採樣（Upsampling）恢復輸出解析度，支援語意分割。

## 直覺

卷積特徵仍有高與寬，但經過下採樣後，格子比原圖少。上採樣把低解析度特徵對應成較密的輸出位置，讓每個像素都能得到分類結果。

![沿高寬由 8×8 縮為 2×2 再回到 8×8；通道數與空間解析度是分開控制的。](figure:l21102-fcn-resolution)

## 定義與公式

FCN 可端到端學習像素級分類。相較把特徵展平成整圖向量的分類頭，它保留空間對應，輸出與原影像對齊的類別圖。指引也強調它的靈活性。

:::supplement[來源：Fully Convolutional Networks 原始論文第 3.3、4.2–4.3 節；Dive into Deep Learning 14.11]
不使用固定長度的全連接分類頭，便可處理不同高寬的輸入，輸出尺寸隨之調整；仍須符合各層的尺寸限制。

常見做法用 1×1 卷積，把各位置的特徵轉成每類分數。三類任務可輸出三個分數通道，再上採樣，最後沿類別軸挑出最高分的類別。

上採樣可用固定插值，或以轉置卷積（Transposed Convolution）學習放大方式。原始 FCN 的中間上採樣層以雙線性插值初始化後學習，最末層則固定插值；本頁的例子採固定插值。

「全卷積」不表示只能用卷積算子；網路仍可有激活、池化與上採樣。重點是避免把空間結構壓成只對整張圖預測的固定全連接頭。
:::

### 本例上採樣形狀（補充）

只改變空間解析度、採用整數縮放倍率時：

$$
H_o=sH_f,\qquad W_o=sW_f.
$$

$H_f$、$W_f$ 是輸入特徵圖的高寬，$H_o$、$W_o$ 是上採樣後的高寬，$s$ 是正整數倍率。批次 N 與通道 C 不變；這裡不討論非整數倍率的取整規約。

代入共用規格 $H_f=2$、$W_f=2$、$s=4$，輸出高寬均為 8。NCHW 的三類分數由（1,3,2,2）變成（1,3,8,8）。

## 走一次流程（補充）

以 `L21102-B-scenes.json` 的 `shapes.fcn` 走交通 T01 的示意資料流。這些是教學層規格，不是完整原始論文架構。

| 步驟 | NCHW 形狀 | 意義 |
|---|---|---|
| 輸入 | 1×3×8×8 | 一張 RGB 街景 |
| 特徵圖 | 1×4×2×2 | 四通道低解析度表示 |
| 1×1 卷積 | 1×3×2×2 | 三類的低解析度分數 |
| 上採樣 | 1×3×8×8 | 三類分數對齊原圖 |
| 類別選擇 | 1×8×8 | 每像素一個類別值 |

醫療 H01 是單通道輸入，可把輸入通道調成 1，仍輸出組織、病灶、器官區三類。若需求要分開兩個病灶，三類語意圖本身仍缺個體 ID。

## 程式（補充）

先設定 `IPAS_REPO_ROOT`。用固定種子建立最小的分數頭，只核對形狀；這段沒有訓練，因此不把隨機類別圖當作有效預測。

```python
import json, os, torch
from pathlib import Path
from torch.nn import functional as F
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21102-B-scenes.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.zeros(d['shapes']['fcn']['features'])
scores = torch.nn.Conv2d(4, 3, 1)(x)
up = F.interpolate(scores, scale_factor=4, mode='bilinear', align_corners=False)
labels = up.argmax(dim=1)
print('分數:', tuple(scores.shape), '上採樣:', tuple(up.shape))
print('類別圖:', tuple(labels.shape))
```
```text
分數: (1, 3, 2, 2) 上採樣: (1, 3, 8, 8)
類別圖: (1, 8, 8)
```

:::tip[讀碼重點]
`argmax(dim=1)` 沿類別通道選值，因此少掉 C 軸。先對分數上採樣，避免對類別代碼做雙線性插值而造出沒有意義的小數標籤。
:::

## 怎麼用、怎麼判讀

FCN 適合逐像素判類與端到端訓練。先檢查輸出高寬能否對齊原圖，再檢查分割輪廓；兩者不是同一項驗收。

:::supplement[來源：FCN 原始論文第 4 節；核心延伸：區分尺寸恢復與細節恢復]
原始 FCN 也提出融合較淺、較細特徵的跳接設計。不能把「只有 U-Net 能用跳接」當作兩者的差別；本頁的單路上採樣圖只展示最小資料流。
:::

### 換個場景

| 場景或資料條件 | 判讀重點 |
|---|---|
| 語意分割、需像素級分類 | 輸出高寬對齊原圖，每格有類別 |
| 道路與建築（補充） | 背景類別也要保留，不只看行人 |
| 醫療小病灶（補充） | 尺寸恢復後仍檢查小區域是否被抹掉 |
| 遙測土地覆蓋（補充） | 類別邊界是否對齊地物，須另行評估 |

## 常見誤解

- **上採樣回原尺寸就回復所有細節。** 格數對齊不保證原本遺失的資訊被找回。（補充）
- **FCN 只輸出一個整圖類別。** 它在此用於密集的像素分類。
- **把類別編號插值也一樣。** 類別值沒有連續大小關係，應處理分數圖或用適合標籤的取樣法。（補充）

## 進階

### 參考來源

- 科目 1 學習指引 `guide-1:3-50`～`guide-1:3-51`：FCN、上採樣與像素分類。
- [FCN 原始論文](https://arxiv.org/abs/1411.4038)：全卷積、密集輸出與跨層特徵融合。
- [Dive into Deep Learning 14.11](https://d2l.ai/chapter_computer-vision/fcn.html)：以通道與解析度分開解釋分割頭的教學思路。
- [PyTorch interpolate](https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.interpolate.html)：上採樣形狀公式、雙線性模式與程式參數。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Conv2d.html)：程式中的 1×1 卷積輸入與輸出通道。

## 小結

- FCN 保留空間對應，支援像素級分類。
- 上採樣把低解析度分數恢復成密集輸出。
- 通道是類別分數，高寬是空間位置。（補充）
- 對齊原圖尺寸之後，仍須驗證邊界品質。（補充）
