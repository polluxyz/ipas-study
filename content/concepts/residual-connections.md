---
id: residual-connections
title: 殘差連接與 ResNet
kind: component
codes: [L23203, L21102]
aliases: [ResNet, Residual Connection, Skip Connection]
summary: 殘差連接把輸入沿捷徑加回子層輸出，讓深層訊號有較直接的傳遞路徑
requires: [backpropagation]
guide_refs: [guide-1:3-49, guide-3:4-71, guide-3:4-81]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 分辨普通堆疊與殘差路徑，說明深層訓練的改善與限制
  - id: g2
    text: 用小張量算殘差相加，檢查形狀並解釋梯度捷徑
  - id: g3
    text: 辨識 Transformer 注意力及前饋子層的殘差相加路徑
formula_groups:
  - id: residual-addition
    source: guide-3:4-81
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
  - id: projection
    source: https://arxiv.org/pdf/1512.03385
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
  - id: local-gradient
    source: https://arxiv.org/pdf/1603.05027
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊將 20 層普通網路加深至 60 層，訓練誤差反而升高。殘差設計的合理說明為何？
    options:
      A: 捷徑把標籤直接送到輸出，可省去 60 層的反向傳播
      B: 捷徑在推論時刪除主分支，可保證 60 層都不耗算力
      C: 捷徑保留較直接的訊號路徑，有助緩解深層最佳化困難
      D: 捷徑自動增加未見資料，可保證 60 層不會發生過擬合
    answer: C
    explain:
      A: 捷徑傳的是特徵，不是標籤，主分支仍需要反向傳播。
      B: 標準殘差網路推論時仍會計算主分支，沒有自動刪層。
      C: 相加路徑有助訊號與梯度傳遞，但不保證消除所有訓練問題。
      D: 架構不會產生新的獨立資料，也不保證泛化。
  - id: c2
    goal: g2
    type: choice
    prompt: NCHW 輸入為 1×2×2×2，主分支變成 1×3×1×1。要做殘差相加，何者正確？
    options:
      A: 以 1×1、stride 2 的 2→3 卷積調整捷徑，再逐項相加
      B: 沿通道直接拼接兩者，輸出仍保持 1×3×1×1 的形狀
      C: 將輸入展平後直接相加，框架必會保留原本通道語意
      D: 只將輸入改成 3 通道，無須核對其高寬及各位置對應
    answer: A
    explain:
      A: 這組投影把捷徑也變為 1×3×1×1，才符合本例的逐項相加條件。
      B: 兩者高寬不同，不能直接沿通道拼接，拼接也不是殘差相加。
      C: 展平不能自動修正元素數及特徵對應，框架不保證語意正確。
      D: 通道與高寬都必須相容，只調整其中一項仍不足。
  - id: c3
    goal: g3
    type: choice
    prompt: Transformer 子層輸入為 2×4×8，分別代表批次、詞元、特徵。注意力子層輸出也為 2×4×8，殘差路徑為何？
    options:
      A: 將輸入改作標籤，與子層輸出比較後得到 2×4×8 的類別
      B: 將輸入與子層輸出拼接，保持特徵軸 8 並跳過所有加法
      C: 將輸入沿詞元軸加總，再複製到各位置以取代子層計算
      D: 將輸入與子層輸出逐項相加，保留批次、詞元與特徵形狀
    answer: D
    explain:
      A: 子層輸入是特徵表示，不是訓練標籤或最終類別。
      B: 沿特徵軸拼接會變成 16 維，也沒有實作殘差相加。
      C: 殘差保留位置對應，不是先把不同詞元的資訊全部加在一起。
      D: 逐項相加保留 2×4×8，前饋子層也可使用相同的殘差形式。
---

## 為什麼需要

普通深層網路把訊號一層層轉換；層數增加，不一定更容易學好。ResNet 的殘差連接（Residual Connection）加入捷徑，讓原特徵能跨過部分運算再與結果相加。

這有助訓練更深的網路，但資料不足、初始化或其他訓練設定仍可能造成問題。

## 直覺

普通堆疊只有主分支；殘差區塊多一條送回原輸入的路。看圖時，先找輸入分岔，再找兩條路在哪裡相加。

![普通堆疊只經主分支，殘差另加捷徑；實線向前計算，虛線表示梯度沿捷徑回傳。](figure:l23203-residual-connections-paths)

這個加號是逐項相加，不是把特徵排成更長的向量。DenseNet 與特徵拼接會用相同小張量對照另一種接法。

:::caution[注意]
指引以「解決梯度消失和模型退化」描述 ResNet；應理解為緩解深層訊號傳遞與最佳化困難，不是保證所有梯度都正常，也不是過擬合的保證解方。
:::

## 定義與公式

殘差相加的基本形式是：

$$
Y=X+F(X)
$$

$X$ 是區塊輸入，$F$ 是主分支的轉換，$F(X)$ 是其輸出，$Y$ 是相加結果。Transformer 中也可把 $F$ 換成注意力或前饋子層。

逐項相加前，兩者必須有相同形狀，且各位置對應相同語意。CNN 常用批次、通道、高、寬四軸；元素數相同卻排列不同，仍不足以直接相加。

:::supplement[來源：ResNet 原論文 3.2；D2L 8.6 ResNet]
主分支學習相對輸入的調整，而非每次都從頭建立整個映射。例如理想結果接近原輸入時，主分支可往接近零的調整學習。

若捷徑也須改變通道或空間尺寸，可以使用投影：

$$
Y=P(X)+F(X)
$$

$P$ 是對捷徑做形狀調整的轉換，例如 1×1 卷積；$P(X)$ 必須與 $F(X)$ 同形。恆等捷徑本身沒有可訓練參數，投影捷徑通常有。

原始 ResNet 區塊在相加後還有 ReLU。本頁的 $Y$ 專指加號出口；不能把這個式子當作所有版本的完整區塊。
:::

### 梯度多了一條路（補充）

只看單一元素、相加後暫無其他運算，令 $y=x+f(x)$，則：

$$
\frac{\mathrm{d}y}{\mathrm{d}x}=1+f'(x)
$$

$x$、$y$ 是輸入與輸出的純量，$f'$ 是主分支的導數。加上的 1 來自恆等捷徑，表示梯度不只經過主分支。

若 $f(x)=0.5x$，普通分支導數是 0.5，殘差相加則為 $1+0.5=1.5$。這是局部算例；其他激活、相消或多層交互作用仍會影響整體梯度。

## 算一次（補充）

共用製造小張量為 NCHW=1×2×2×2；每個位置有兩個通道。交通頁面換景也使用同樣運算與種子 23203，完整數值在 `L23203-E-tensors.json`。

### 恆等捷徑

主分支為對角權重 0.5 的無偏置 1×1 卷積，所以 $F(X)=0.5X$。

| 左上位置的量 | 通道 1 | 通道 2 |
|---|---:|---:|
| 輸入 $X$ | 1 | 4 |
| 主分支 $F(X)$ | 0.5 | 2 |
| 相加 $Y$ | 1.5 | 6 |

代入 $Y=X+F(X)$，左上為 $(1+0.5,4+2)=(1.5,6)$。右上則由 $(2,3)$ 變成 $(3,4.5)$；輸出仍為兩通道。

這個 1×1 主分支有 $2\times2=4$ 個權重。恆等捷徑無權重，但逐項相加仍有運算成本，不能說完全沒有運算。

### 需要投影時

若主分支改為 1×3×1×1，捷徑可用無偏置 1×1、stride 2 的 2→3 卷積。它有 $1\times1\times2\times3=6$ 個權重，輸出同為 1×3×1×1 才相加。

這裡的 4 與 6 是不同設定的局部成本，不是 ResNet 全模型參數。形狀不合時也不可只依賴框架的廣播規則掩蓋設計錯誤。

## 程式（補充）

先將 `IPAS_REPO_ROOT` 設為 repo 根目錄。程式只測相加與局部梯度，使用一層線性主分支，沒有宣稱這是完整 ResNet 或已完成訓練。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-E-tensors.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor(d['manufacturing']['x'], dtype=torch.float32, requires_grad=True)
f = torch.nn.Conv2d(2, 2, 1, bias=False)
with torch.no_grad():
    f.weight.copy_(torch.tensor(d['residual']['weights']).reshape(2,2,1,1))
y = x + f(x)
print('相加形狀:', tuple(y.shape))
print('相加數值:', y.detach().tolist())
y.sum().backward()
print('輸入梯度的不同值:', x.grad.unique().tolist())
print('主分支參數:', sum(p.numel() for p in f.parameters()))
```
```text
相加形狀: (1, 2, 2, 2)
相加數值: [[[[1.5, 3.0], [4.5, 6.0]], [[6.0, 4.5], [3.0, 1.5]]]]
輸入梯度的不同值: [1.5]
主分支參數: 4
```

:::tip[讀碼重點]
`x + f(x)` 是逐項相加。`y.sum().backward()` 讓每個輸出元素的上游梯度為 1，因此可直接檢查本例輸入梯度是否為 1.5。

權重已固定，種子只為與共用例子一致，不影響本例輸出。
:::

## 怎麼用、怎麼判讀

深層網路難訓練時，殘差路徑是架構設計的方向之一。它保留較直接的特徵傳遞路徑；仍應觀察損失、梯度與未見資料表現，不能只憑層數判斷。

指引列出的效果包括緩解梯度消失、加速收斂，並支援百層以上架構，例如 ResNet-152。這些是設計效益，不保證每次訓練都更快收斂或泛化更好。

### Transformer 也有加號

注意力子層或前饋子層的輸入會加回其輸出。先找子層邊界，才能辨識哪一條是主分支、哪一條是跨過子層的捷徑。

![注意力與前饋各有捷徑，實線看前向相加，虛線看梯度沿捷徑回傳，兩路形狀須相容。](figure:l23203-residual-connections-transformer)

:::supplement[來源：Attention Is All You Need 3.1；共用例子 L23203-E-tensors.json]
例如形狀為批次 2、詞元 4、特徵 8，子層輸出也須為 2×4×8，才能按相同詞元及特徵位置相加。這裡沒有把詞元軸拼長，也沒有把兩份特徵拼成 16 維。

原始 Transformer 另在相加後做層歸一化。圖只突出相加路徑；層歸一化的位置與其他變體見「LayerNorm 與 BatchNorm 比較」，不將它們當成同一個運算。
:::

### 換個場景

| 場景或資料條件 | 殘差路徑的作用 | 要核對的界線 |
|---|---|---|
| 深層影像分類 | 協助深層訊號與梯度傳遞 | 不保證泛化或所有梯度正常 |
| Transformer 注意力、前饋子層 | 原輸入加回子層輸出 | 留意每個子層的邊界 |
| 製造瑕疵（補充） | 在較深特徵抽取器保留捷徑 | 相機差異仍須另評估 |
| 交通標誌（補充） | 組合局部與深層特徵 | 形狀相同不保證辨識品質 |

## 常見誤解

- 「殘差等於把預測誤差加回去」：這裡加回的是區塊輸入特徵，不是真實標籤與預測之差。
- 「有捷徑就可停止訓練主分支」：主分支仍要學習有用的轉換。
- 「相加與拼接都不改通道」：拼接會沿選定軸增加長度。（補充）
- 「任何捷徑都沒有參數」：恆等捷徑沒有，投影捷徑通常有。（補充）

## 進階

### 深層退化與過擬合的差別

指引將模型退化列為殘差設計處理的深層訓練問題之一。

:::supplement[來源：ResNet 原論文 3.1]
原論文討論加深普通網路後，連訓練誤差也變高的退化現象。這與訓練很好、驗證很差的過擬合不同；殘差設計主要改善前者的最佳化困難。
:::

### 參考來源

- 科目 1 指引 `guide-1:3-49`、科目 3 指引 `guide-3:4-71`：深層 CNN 與殘差定位；核對 PDF 頁 56、109。
- 科目 3 指引 `guide-3:4-81`：相加式及 Transformer 子層；核對 PDF 頁 119。
- [ResNet 原論文 3.2](https://arxiv.org/pdf/1512.03385)：定義、投影、相加後激活與退化現象。
- [Identity Mappings in Deep Residual Networks](https://arxiv.org/pdf/1603.05027)：梯度捷徑的分析；本頁只取局部純量例。
- [D2L 8.6 ResNet](https://d2l.ai/chapter_convolutional-modern/resnet.html)：普通堆疊與捷徑的教學對照。
- [Attention Is All You Need 3.1](https://arxiv.org/html/1706.03762v7)：Transformer 子層與正規化邊界。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html)：程式的通道、權重與步幅契約。

## 小結

- 殘差把原輸入沿捷徑加回主分支輸出。
- 相加要核對形狀，必要時以投影調整捷徑。（補充）
- 梯度多了較直接的路徑，但沒有保證消除所有訓練問題。
- Transformer 注意力與前饋子層也使用殘差相加。
