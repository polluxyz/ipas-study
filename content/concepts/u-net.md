---
id: u-net
title: U-Net 編解碼分割
kind: model
codes: [L21102, L23203]
aliases: [UNet, 編解碼分割]
requires: [fcn]
summary: U-Net 用編解碼結構與同尺度跳接，同時保留語意特徵與定位細節
goals:
  - id: g1
    text: 說明編碼器、解碼器與跳接如何支援小病灶定位，並辨認不平衡仍需另行處理
formula_groups:
  - id: concat-channels
    source: https://arxiv.org/abs/1505.04597
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: U-Net 的上採樣張量是（1,8,8,8），同尺度跳接是（1,4,8,8），均採 NCHW。沿通道串接後形狀為何？
    options:
      A: （1,8,8,12）
      B: （1,4,12,8）
      C: （1,12,8,8）
      D: （2,12,8,8）
    answer: C
    explain:
      A: 這錯把增加量放進寬度，沿通道串接不會改變空間高寬。
      B: 這錯把增加量放進高度，且只保留跳接通道數。
      C: 通道八加四為十二，批次與空間高寬維持不變。
      D: 通道雖為十二，批次卻不應因通道串接而變成兩張。
  - id: c2
    goal: g1
    type: choice
    prompt: 醫療示意 H01 有 64 格，其中 5 格病灶。團隊改用 U-Net，如何處理病灶少於背景的問題？
    options:
      A: 跳接保留細節，仍需另查病灶取樣與分割指標
      B: 跳接會把類別比例改成各半，再用整圖準確率驗收
      C: 跳接已保留細節，因此只看整圖準確率即可驗收
      D: 改用更深的編碼器，就能補足 5 格病灶的取樣不足
    answer: A
    explain:
      A: 架構能提供定位線索，但不會自動改寫類別比例或保證小病灶結果。
      B: 跳接傳遞特徵，不會把原資料的五格病灶改成三十二格。
      C: 即使跳接保留細節，整圖準確率仍可能掩蓋小病灶漏分。
      D: 增加編碼器深度不會增加病灶樣本，取樣不足仍須獨立處理。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-51, guide-1:3-54]
---

## 為什麼需要

病灶可能只占影像的一小塊。深層特徵有助理解內容，但反覆下採樣會使位置變粗，單靠放大輸出不容易找回精細邊界。

U-Net 原為醫療影像分割設計，以編碼器（Encoder）提取特徵，再用解碼器（Decoder）恢復空間資訊。

## 直覺

U 形左側逐步縮小高寬，右側逐步放大。跳躍連接（Skip Connections，以下簡稱跳接）把較高解析度特徵直接送到相對應的解碼層，提供定位線索。

![沿 U 形看下採樣與上採樣，再看虛線如何把同尺度特徵送到解碼側。](figure:l21102-u-net-skip)

## 定義與公式

編碼器學習影像的特徵與上下文，解碼器逐步恢復分割輸出。左右對稱指解析度路徑相互對應，並不表示兩邊共享完全相同的權重。

:::supplement[來源：U-Net 原始論文第 2 節]
原始 U-Net 將編碼側特徵與上採樣特徵沿通道串接（Concatenation）。這保留兩邊的資訊，交給後續卷積整合；不能直接當成 ResNet 的逐元素相加。

串接前須確認空間位置及尺寸對齊。原論文使用有效卷積並裁切跳接特徵；本頁示意採已對齊的同尺寸張量，沒有照搬原論文的所有層規格。
:::

### 串接後的通道（補充）

$$
C_{\mathrm{joined}}=C_{\mathrm{up}}+C_{\mathrm{skip}}.
$$

三個符號都表示通道數：

- $C_{\mathrm{up}}$：上採樣特徵的通道數。
- $C_{\mathrm{skip}}$：編碼側跳接特徵的通道數。
- $C_{\mathrm{joined}}$：串接後的通道數。

使用條件是兩邊批次、高、寬一致，並沿通道軸串接。

代入共用規格，上採樣 8 通道加上跳接 4 通道，得到 12 通道。（1,8,8,8）與（1,4,8,8）串成（1,12,8,8），高寬沒有相加。

## 走一次流程（補充）

固定醫療 H01：8×8 的圖中，兩個病灶各占 2 格與 3 格，共 5 格。這是教學合成圖，不是診斷影像。

1. 編碼路徑從 8×8 依序降至 4×4、2×2，取得較大範圍的特徵。
2. 解碼路徑逐步恢復高寬，最後回到 8×8。
3. 每個對應尺度的跳接補入較細定位線索，協助描述小病灶邊界。
4. 輸出病灶語意遮罩，再比對人工標註，檢查兩處病灶是否都保留下來。

換到交通 T01，同樣可恢復道路、建築、行人的逐像素輸出。若需要分開兩名行人，還得額外設計個體輸出，不能只依 U 形外觀判定任務。

## 程式（補充）

先設定 `IPAS_REPO_ROOT`。以下從共用形狀規格建立特徵，只核對上採樣與串接，不訓練完整 U-Net。

```python
import json, os, torch
from pathlib import Path
from torch.nn import functional as F
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21102-B-scenes.json').read_text(encoding='utf-8'))
s = d['shapes']['unet']
skip, decoder = torch.zeros(s['skip']), torch.ones(s['decoder'])
up = F.interpolate(decoder, size=skip.shape[-2:], mode='nearest')
joined = torch.cat([up, skip], dim=1)
print('上採樣:', tuple(up.shape), '跳接:', tuple(skip.shape))
print('串接:', tuple(joined.shape))
```
```text
上採樣: (1, 8, 8, 8) 跳接: (1, 4, 8, 8)
串接: (1, 12, 8, 8)
```

:::tip[讀碼重點]
`size=skip.shape[-2:]` 對齊高寬，`dim=1` 指定 NCHW 的通道軸。改成相加時，八通道與四通道無法直接逐元素對應。
:::

## 怎麼用、怎麼判讀

醫療影像中的腫瘤、病灶定位是指引列出的用途；指引也指出它在類別像素數差距很大的資料上表現不錯。評估時要檢查細小區域與邊界，而非只看全圖像素答對多少。

:::supplement[來源：U-Net 原始論文第 3 節；必要前置：避免把架構誤當不平衡保證]
不過架構本身不會自動平衡類別。原論文還結合資料增強與加權訓練；實務仍需檢查取樣、損失設計與各類別分割結果。

H01 若全判為非病灶，64 格答對 59 格，準確率約 92.2%，卻漏掉全部 5 格病灶。跳接不能取代對這類失敗的獨立檢查。
:::

### 換個場景

| 場景或資料條件 | 判讀重點 |
|---|---|
| 醫療腫瘤、病灶分割 | 恢復定位細節，標註需專業校對 |
| 病灶與背景比例懸殊 | 不平衡仍須由資料、訓練與評估處理 |
| 衛星道路（補充） | 細長區域是否中斷，不能只查大面積背景 |
| 製造微小裂紋（補充） | 高解析度線索是否留下裂紋邊界 |
| 農作物病斑（補充） | 葉片與病斑的標註定義須保持一致 |

## 常見誤解

- **對稱就表示兩邊權重一樣。** 對稱是路徑結構對應，不代表參數共享。（補充）
- **U-Net 跳接就是殘差相加。** 原始 U-Net 主要以通道串接結合對應尺度特徵。（補充）
- **換成 U-Net 就不怕病灶很少。** 架構能保留線索，仍需處理類別比例與漏報。（補充）

## 進階

### 參考來源

- 科目 1 學習指引 `guide-1:3-51`、`guide-1:3-54`：編解碼器、跳接與醫療病灶用途。
- [U-Net 原始論文](https://arxiv.org/abs/1505.04597)：串接公式、裁切、原始架構與加權訓練。
- [作者的 U-Net 圖解](https://lmb.informatik.uni-freiburg.de/people/ronneber/u-net/)：對照收縮與擴張路徑的圖解思路。
- [Dive into Deep Learning FCN 教學](https://d2l.ai/chapter_computer-vision/fcn.html)：比較密集預測中的解析度與特徵融合。
- [PyTorch interpolate](https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.interpolate.html)：程式的尺寸對齊參數。
- [PyTorch cat](https://docs.pytorch.org/docs/2.9/generated/torch.cat.html)：程式的串接軸與其他軸需一致的條件。

## 小結

- 編碼器學特徵，解碼器恢復空間解析度。
- 同尺度跳接提供高解析度定位線索。
- 通道串接增加通道，不增加空間高寬。（補充）
- 不平衡、小病灶漏報與標註品質仍需獨立處理。（補充）
