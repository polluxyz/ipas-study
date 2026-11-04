---
id: image-resizing
title: 影像尺寸與幾何前處理
kind: technique
codes: [L23301, L21102]
aliases: [Crop, Padding, Resize, 縮放, 裁切, 補邊]
summary: 尺寸前處理把影像送進固定輸入，同時取捨形狀、邊界與物件保留
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-46, guide-1:3-47]
goals:
  - id: g1
    text: 依模型輸入尺寸選擇縮放、補邊或裁切，說明長寬比與物件保留的代價
formula_groups:
  - id: spatial-scale
    source: https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23301-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠將寬8、高4的瑕疵圖送入8×8模型，要求保留整條刮痕及原長寬比。哪種處理符合條件？
    options:
      A: 保持原圖8×4，上下各補2列，模型收到8×8影像
      B: 直接拉成8×8，橫向維持1倍，縱向則放大2倍
      C: 中央裁成4×4，再等比例放大，模型收到8×8影像
      D: 先將寬度裁半，再拉回8×8，讓刮痕占比更一致
    answer: A
    explain:
      A: 上下補邊不會改變物件形狀，也不會裁掉原圖中的刮痕。
      B: 橫縱比例不同會把刮痕拉長，不符合保留長寬比的條件。
      C: 裁切可能移除部分刮痕，本例中央視窗只留下一半目標像素。
      D: 裁掉半張原圖會遺失視野，拉回原尺寸也無法復原內容。
  - id: c2
    goal: g1
    type: choice
    prompt: M01的8×4視圖內有8個瑕疵像素，中央裁切4×4只剩4個，再以最近鄰放大為8×8。哪個判讀合理？
    options:
      A: 輸出目標像素會變16個，因此已找回原先被裁掉的另一半瑕疵
      B: 輸出目標像素維持4個，因此最近鄰放大只增加周圍背景像素
      C: 輸出目標像素會變16個，但增加的是複製格子，被裁內容仍遺失
      D: 輸出目標像素會變8個，因此輸入與輸出的物件資訊完全相同
    answer: C
    explain:
      A: 像素格子增加來自複製，並沒有重建視窗外被移除的內容。
      B: 寬高各放大2倍時，每個保留的目標像素會複製成4格。
      C: 保留的4格各變4格得到16格，但被裁掉的一半刮痕寬度仍無法復原。
      D: 原始8格與輸出16格的計數不同，且像素數相同也不能證明資訊相同。
---

## 為什麼需要

相機拍出的影像大小不一，模型卻可能要求固定尺寸。影像尺寸前處理先統一輸入，還要避免把重要形狀拉歪，或把辨識目標裁掉。

指引列出縮放、補邊與裁切；三者都能參與尺寸統一，但對視野與物件形狀的影響不同。

## 直覺

縮放（Resize）改變整張圖的取樣格數，補邊（Padding）在外圍增加空間，裁切（Crop）只留下指定視窗。先想清楚「目標必須完整嗎」，再選擇操作。

### 同一長方圖的三種結果

本組資料從M01的8×8原圖取出寬8、高4的視圖，刮痕仍完整。以下三種策略都輸出8×8，卻不能視為同一種資料。

![同一長方視圖分別拉伸、補邊與中央裁切，注意刮痕形狀及保留範圍。](figure:l23301-image-resizing-strategies)

## 定義與公式

### 尺寸、座標與比例

統一寬高不代表保留形狀。直接拉伸、補邊與裁切，對長寬比及物件完整性的影響不同。

:::supplement[來源：OpenCV resize；Pillow Image.resize]

令來源寬、高為$W,H$，輸出為$W',H'$。四個尺寸都用像素計，都是正整數；空影像不適用，所以分母不會是0。直接縮放的橫向、縱向倍率為：

$$
s_x=\frac{W'}{W},\qquad s_y=\frac{H'}{H}
$$

$s_x,s_y$是兩個像素長度相除，沒有單位，分別表示兩個方向放大多少；兩者相等才保留長寬比。這裡把影像寬度看成左邊界0到右邊界8的一段長度，不是一格一格的像素編號。

實際縮放還要指定插值方法，也就是新格子的顏色如何從原圖取樣。
:::

| 策略 | 長寬比 | 物件與視野 |
|---|---|---|
| 直接指定寬高 | 倍率不同時改變 | 保留整體視野，形狀可能變形 |
| 等比例縮放加補邊 | 保留 | 保留整體視野，加入邊界區 |
| 裁切再等比例縮放 | 保留剩餘區的比例 | 視窗外資訊永久移除 |

:::supplement[來源：Pillow Image.resize、Image.crop]
補邊不是所有情境的最佳解；大量空白可能壓縮物件在輸入中的占比。裁切也可能合理，例如已知目標區域且確認不會切斷物件時。
:::

## 算一次

### 從8×4送進8×8

三種策略的輸出尺寸相同，仍需分別查形狀、視野和目標是否完整。

:::supplement[來源：OpenCV resize；Pillow Image.resize、Image.crop]

共用例子的M01長方視圖，瑕疵框為`[1,0,3,4]`；框用左上、右下邊界，右與下不含。原目標占2欄×4列，共8格。

1. 直接縮放：橫向倍率8÷8=1，縱向倍率8÷4=2；框成`[1,0,3,8]`，刮痕被拉長。
2. 保留原尺寸再補邊：上下各補2列；框整體往下移，成`[1,2,3,6]`，形狀與視野都保留。
3. 中央裁切：只取橫向邊界2到6，剩1欄×4列的瑕疵。再各向放大2倍，雖有16格目標，仍只保留原刮痕的一半寬度，高度未裁掉。

零售R01的F字若經相同策略，也會面臨拉歪筆畫或切斷字形的問題。不能只確認輸出是8×8，就認定前處理成功。
:::

## 程式

### 明確指定尺寸順序與插值（補充）

以下陣列與M01長方視圖相同。為方便逐格核對，使用最近鄰插值；真實照片通常還要比較適合的平滑與抗鋸齒設定。

```python
import numpy as np
from PIL import Image, ImageOps
pixels = np.full((4, 8, 3), 32, dtype=np.uint8)
pixels[:, 1:3] = [255, 0, 0]
im = Image.fromarray(pixels)
stretch = im.resize((8, 8), Image.Resampling.NEAREST)
pad = ImageOps.expand(im, border=(0, 2, 0, 2), fill=0)
center = im.crop((2, 0, 6, 4)).resize((8, 8), Image.Resampling.NEAREST)
print(im.size, stretch.size, pad.size, center.size)
for view in [im, stretch, pad, center]:
    a = np.asarray(view)
    print(int(((a[:, :, 0] == 255) & (a[:, :, 1] == 0)).sum()))
```
```text
(8, 4) (8, 8) (8, 8) (8, 8)
8
16
8
16
```

:::tip[讀碼重點]
Pillow的`size`是寬、高；NumPy的`shape`前兩軸是高、寬。目標像素計數會隨放大改變，不能當作保留資訊的證明。
:::

## 怎麼用、怎麼判讀

指引的使用條件是配合模型輸入，並降低變形或資訊流失。尺寸統一後，還要抽看物件是否完整、形狀是否合理。

:::supplement[來源：Pillow Image.resize、Image.crop；Torchvision Resize]
框要同步縮放、平移及裁切；分割遮罩的類別編號通常用最近鄰處理，避免插出不存在的類別。縮小照片時也要留意細小裂痕與字體筆畫可能消失。
:::

### 換個場景

| 場景 | 選擇依據 | 要查什麼 |
|---|---|---|
| 固定模型輸入尺寸 | 指引列出三種幾何處理 | 尺寸、變形與資訊流失 |
| 製造刮痕（補充） | 長度與細線是判斷訊號 | 補邊後細線是否仍可見 |
| 零售OCR（補充） | 筆畫和字串必須完整 | 裁切是否切掉字首字尾 |
| 醫療病灶（補充） | 病灶比例可能重要 | 是否改變形態或視野 |

## 常見誤解

### 三個容易混淆的判斷

- **寬高一致就沒有變形。** 輸出雖是正方形，來源若非正方形仍可能被拉伸。
- **放大能補回裁掉的內容。** 放大只增加取樣格子，沒有取得視窗外的資訊。
- **影像改完就好。** 幾何改變後，框與遮罩若不跟著改，訓練資料就不再對齊。（補充）

## 進階

### API的尺寸參數不是通用約定（補充）

Torchvision `Resize`使用兩個尺寸時順序是高、寬；只給一個整數則按短邊縮放，通常保留長寬比。跨函式庫搬程式時，需重新核對介面，不能照抄Pillow的參數順序。

### 參考來源

- 科目1學習指引，版本未標示、2026-10-31本機快照，`guide-1:3-46`、`guide-1:3-47`：尺寸統一的目的與三種處理。
- [OpenCV resize](https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html)：定義與公式的橫縱倍率，對應參數fx與fy。
- [Pillow Image](https://pillow.readthedocs.io/en/stable/reference/Image.html)：算例與程式的尺寸、插值及裁切座標。
- [Pillow教學](https://pillow.readthedocs.io/en/stable/handbook/tutorial.html)：直覺圖與幾何操作的呈現思路。
- [Torchvision Resize](https://docs.pytorch.org/vision/stable/generated/torchvision.transforms.Resize.html)：插值、尺寸順序與進階的單整數規則。

## 小結

- 先確定輸入尺寸，再決定形狀與視野哪些必須保留。
- 直接縮放可能變形；補邊保留視野；裁切可能切掉物件。
- 核對來源座標與標註同步，不能只看輸出像素數。（補充）
