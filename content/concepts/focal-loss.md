---
id: focal-loss
title: Focal Loss 焦點損失
kind: theory
codes: [L23304, L23103]
aliases: [Focal Loss]
requires: [cross-entropy-loss, class-imbalance]
summary: Focal Loss 降低容易樣本的相對損失貢獻，讓訓練更關注難例
goals:
  - id: g1
    text: 依資料輸入與任務區分交叉熵、對比損失和Focal Loss
  - id: g2
    text: 計算配對margin損失與Focal Loss，區分標籤及超參數作用
formula_groups:
  - id: binary-focal
    source: https://arxiv.org/html/1708.02002v2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-D
  - id: pairwise-margin-recap
    source: https://keras.io/examples/vision/siamese_contrastive/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23304-D
guide_refs: [guide-3:3-22]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 甲有200筆疾病類別與機率，乙有20對同人／異人照片，丙有大量易分背景框。哪組搭配符合三種監督訊息？
    options:
      A: 甲用對比學機率，乙用交叉熵學距離，丙用Focal降易例
      B: 甲用交叉熵學分類，乙用對比學相似，丙用Focal降易例
      C: 甲用交叉熵學分類，乙用對比學相似，丙用Focal只增易例
      D: 甲用重建學分類，乙用排序學相似，丙用Focal只刪背景
    answer: B
    explain:
      A: 配對相似監督與單筆分類機率的用途被顛倒。
      B: 交叉熵評價分類、對比損失評價配對，Focal降低容易樣本的相對貢獻。
      C: Focal的調節方向是降低容易樣本的相對貢獻，而非只增加容易樣本。
      D: Focal改變損失權重，沒有把背景樣本直接從資料中刪除。
  - id: c2
    goal: g2
    type: choice
    prompt: 負類樣本的正類機率p=0.8，α=0.25、γ=2，採本頁二元α約定。真類機率、類別係數、Focal損失為何？
    options:
      A: 真類0.8、係數0.75、損失約0.006694
      B: 真類0.2、係數0.25、損失約0.257510
      C: 真類0.2、係數0.75、損失約1.207078
      D: 真類0.2、係數0.75、損失約0.772530
    answer: D
    explain:
      A: 負類的真類機率是1減p，不能直接使用正類機率0.8。
      B: 負類應取1減α即0.75，不是正類係數0.25。
      C: 這是加權交叉熵，漏乘難易係數0.8平方。
      D: 0.75乘0.8平方乘負ln0.2，得到約0.772530。
  - id: c3
    goal: g2
    type: choice
    prompt: 兩筆都是陽性，正類機率0.9與0.2，α固定0.25；γ由2調為0。哪個敘述正確？
    options:
      A: 兩筆各自回到未加權交叉熵，α也會自動消失
      B: 兩筆各自維持原Focal損失，γ只影響負類樣本
      C: 兩筆各自回到加權交叉熵，α仍然保留在式中
      D: 兩筆各自損失都變成零，因任何數的零次方是零
    answer: C
    explain:
      A: γ為0只移除難易係數，類別係數α仍然存在。
      B: γ作用於所有樣本的真類機率，並非只對負類生效。
      C: 難易係數變成1，剩下0.25乘各筆交叉熵。
      D: 非零數的零次方為1，不能把調節係數當成0。
---

## 為什麼需要

分類資料不平衡時，大量容易樣本可能占據訓練注意力。指引以Focal Loss說明另一種損失選擇：強化難分類樣本的學習。

:::supplement[來源：Focal Loss原論文第3節]
焦點損失（Focal Loss）在交叉熵外加難易調節，讓已經分得很好的樣本貢獻下降更多。資料不會被刪除或複製，難易程度由模型當下預測決定。
:::

## 直覺

:::supplement[來源：Focal Loss原論文第3節]
難分類不等於少數類。少數類可以已分得很準，多數類也可能很難；Focal Loss關注的是分類難度。

對同一真實類別，模型給真類0.9很容易，給0.2則很困難。難易係數在前者下降得更多，讓後者的相對影響提高。
:::

![真類機率越高，γ大於零的難易係數越小；γ等於零的水平線表示不區分難易。](figure:l23304-focal-loss-modulation)

:::supplement[來源：Focal Loss原論文第3節]
本組製造與醫療各200筆、10筆正類，保留相同切分與分數。圖只畫難易係數，沒有乘類別權重，也不是模型學習曲線。
:::

## 定義與公式（補充）

本頁用二元分類約定：$y=1$為正類，$p$為模型給正類的機率。先依標籤取出真類機率與類別係數：

$$
\begin{aligned}
p_t&=\begin{cases}p,&y=1\\1-p,&y=0\end{cases},\quad
\alpha_t=\begin{cases}\alpha,&y=1\\1-\alpha,&y=0\end{cases},\\
\ell_{\mathrm{focal}}&=-\alpha_t(1-p_t)^\gamma\ln p_t
\end{aligned}
$$

$p_t$是「真實類別」的機率，$\alpha_t$是該類係數，$0<\alpha<1$控制兩類相對權重；$\gamma\ge0$控制難易調節強度，$\ln$是自然對數。

手算用$0<p_t<1$，避免直接取零的對數。實作宜使用穩定的logits交叉熵，再乘調節係數；機率趨近0或1時要另注意數值精度。

### α與γ分工（補充）

本頁沿用前置組$\alpha=0.25,\gamma=2$。這是可核對的教學設定，正類係數0.25、負類0.75，不代表少數類一定該選較小係數。

同類別中，$p_t=0.9$時難易係數$0.1^2=0.01$；$p_t=0.2$時為$0.8^2=0.64$。增加γ使容易樣本下降更多，不是把難例乘上大於1的係數。

$\gamma=0$時難易係數是1，回到加權交叉熵。移除$\alpha_t$才回到未加權交叉熵；把α設成0.5仍保留整體0.5倍縮放。

## 算一次（補充）

### 沿用前置六筆醫療資料（補充）

沿用交叉熵損失與對比損失頁的六筆醫療分數。M01、M03都是真正類，M02是真負類；先逐筆核對，再看全六筆。

| 樣本 | 標籤、p、真類機率 | 類別乘難易係數 | Focal損失 |
|---|---|---|---|
| M01 | 1、0.9、0.9 | 0.25×0.01＝0.0025 | 0.000263 |
| M02 | 0、0.8、0.2 | 0.75×0.64＝0.48 | 0.772530 |
| M03 | 1、0.2、0.2 | 0.25×0.64＝0.16 | 0.257510 |
| M04 | 0、0.3、0.7 | 0.75×0.09＝0.0675 | 0.024076 |
| M05 | 1、0.7、0.7 | 0.25×0.09＝0.0225 | 0.008025 |
| M06 | 0、0.1、0.9 | 0.75×0.01＝0.0075 | 0.000790 |

M03代入$-0.25\times0.8^2\times\ln0.2=0.257510$。M02的$p=0.8$是有信心地分錯，須取$p_t=0.2$，得到0.772530。

M01的加權交叉熵是0.026340，乘0.01後剩0.000263；M03從0.402359乘0.64後剩0.257510。兩者都下降，但容易的M01相對降得更多。

### 對照配對margin算例（補充）

沿用對比損失頁與`L23103-B-losses.json`的三個向量配對，使用相同標籤約定與間隔$m=1$。這些是配對資料，與上方六筆醫療分類資料分開計算。

$$
D=\lVert a-b\rVert_2,\qquad
\ell_{\rm pair}=yD^2+(1-y)\max(0,m-D)^2
$$

$a,b$是同維度嵌入向量，$D$是歐氏距離，$m>0$是間隔。此處$y=1$表示相似、$y=0$表示不相似，並非疾病標籤；本版不乘$1/2$。

| 配對 | 標籤與距離 | 代入$m=1$ | 損失 |
|---|---|---|---|
| P01 | 相似，$D=0.2$ | $0.2^2$ | 0.04 |
| P02 | 不相似，$D=0.2$ | $(1-0.2)^2$ | 0.64 |
| P03 | 不相似，$D=1.2$ | $\max(0,1-1.2)^2$ | 0 |

把$m$改為2時，P03變為$(2-1.2)^2=0.64$，P01不變。margin控制不相似配對的距離要求；Focal的α、γ則控制分類損失權重，不能互換。

來源為Keras Siamese教學；它用0表示相似，本頁已反轉標籤以對齊前置頁。向量座標與完整推導見對比損失頁。

## 程式（補充）

### 六筆完整數值（補充）

這段以PyTorch穩定的logits交叉熵實作二元Focal公式，輸入與前置頁的六筆分數一致。

```python
import torch
torch.manual_seed(23304)
y = torch.tensor([1., 0., 1., 0., 1., 0.], dtype=torch.float64)
p = torch.tensor([.9, .8, .2, .3, .7, .1], dtype=torch.float64)
ce = torch.nn.functional.binary_cross_entropy_with_logits(torch.logit(p), y, reduction="none")
pt = torch.where(y == 1, p, 1-p)
at = torch.where(y == 1, .25, .75).to(torch.float64)
focal = at * (1-pt).pow(2) * ce
print("Focal", [round(v, 6) for v in focal.tolist()])
print(f"平均 {focal.mean().item():.6f}")
print("gamma=0 等於加權交叉熵", torch.allclose(at * (1-pt).pow(0) * ce, at * ce))
```
```text
Focal [0.000263, 0.77253, 0.25751, 0.024076, 0.008025, 0.00079]
平均 0.177199
gamma=0 等於加權交叉熵 True
```

:::tip[讀碼重點]
`pt`要看真實標籤；`at`的負類取0.75。不能先把類別權重乘入交叉熵，再以`exp(-loss)`推真類機率，否則真類機率會混入權重。
:::

### 同一120筆訓練分布（補充）

再回到本組200筆資料的訓練子集。四種固定分數與類別權重頁相同，只把損失逐項換成Focal，不改採樣或測試比例。

```python
import numpy as np
idx = np.arange(120)
label = (idx % 20 == 0).astype(int)
prob = np.where(label == 1, .9, .1)
prob[[80, 100]] = .2
prob[[1, 2, 3, 4, 5, 6]] = .8
true_prob = np.where(label == 1, prob, 1-prob)
alpha_t = np.where(label == 1, .25, .75)
values = -alpha_t * (1-true_prob)**2 * np.log(true_prob)
print(f"120筆Focal平均 {values.mean():.6f}")
print("標籤計數", np.bincount(label).tolist())
```
```text
120筆Focal平均 0.043638
標籤計數 [114, 6]
```

:::tip[讀碼重點]
`true_prob`依標籤取真類機率，`alpha_t`再區分類別。2筆難分瑕疵各貢獻0.257510，合計約占總損失9.8%；6筆難分正常各貢獻0.772530，合計約占88.5%。
:::

## 怎麼用、怎麼判讀

三種損失的第一個分界是監督訊息。指引3-22將一般分類、樣本配對與不平衡難例分開，並列人臉辨識、語意匹配作為配對任務。

| 損失 | 輸入與監督 | 選用理由 |
|---|---|---|
| 交叉熵損失 | 單筆機率與類別標籤 | 評價分類機率分布 |
| 對比損失 | 兩筆表示與相似標籤 | 學習配對相似關係 |
| Focal Loss | 單筆機率與類別標籤 | 凸顯較難分類樣本 |

:::supplement[來源：Focal Loss原論文第3節；Keras Siamese對比教學]
對比損失另須定義距離、相似標籤與margin；完整的配對公式與P01–P03算例見[對比損失的定義](/concepts/contrastive-loss/#定義與公式)。只有單筆疾病標籤，不能直接當作樣本對的相似監督。

類別權重對同類樣本給相同係數；Focal再依每筆當下預測調節難易。調α、γ時保留相同驗證資料，以精確率、召回率與PR-AUC比較，不能只比兩種損失的絕對數字。

若難例來自錯標或雜訊，聚焦難例也可能放大其相對影響。先檢查資料品質，再評估損失；Focal不會自動修正錯誤標籤。
:::

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 不平衡分類 | 部分樣本難以分類 | 以難度調整相對學習貢獻 |
| 密集物件偵測（補充） | 大量容易背景框 | 檢查背景是否淹沒難例 |
| 製造瑕疵（補充） | 正常多、部分難例錯標 | 先查標籤品質再調γ |
| 醫療篩檢（補充） | 少數陽性有難有易 | 別把難例等同所有陽性 |

## 常見誤解

- 「Focal就是過採樣」：它改逐筆損失，不增加資料筆數。（補充）
- 「難例一定是少數類」：難度由真類機率決定，多數類也可能分錯。（補充）
- 「γ越大一定越好」：容易樣本可能被壓得過低，應用驗證集選設定。（補充）
- 「γ為0就是原始交叉熵」：仍保留α，應稱加權交叉熵。（補充）

## 進階

### 參考來源

- [Keras Siamese對比損失教學](https://keras.io/examples/vision/siamese_contrastive/)：支持配對margin對照式；本頁反轉其標籤以沿用前置資料。
- 科目3學習指引（版本未標示）`guide-3:3-22`：支持三種損失的用途與不平衡難例；未列Focal公式。
- [Focal Loss原論文](https://arxiv.org/html/1708.02002v2)第3節：支持α、γ、真類機率、容易樣本降權及密集偵測用途。
- [Torchvision sigmoid_focal_loss原始碼](https://docs.pytorch.org/vision/main/_modules/torchvision/ops/focal_loss.html)：支持logits交叉熵、正負類係數與逐筆計算。
- [Torchvision sigmoid_focal_loss API](https://docs.pytorch.org/vision/main/generated/torchvision.ops.sigmoid_focal_loss.html)：支持α、γ與reduction的參數語意。
- [Keras BinaryFocalCrossentropy](https://keras.io/api/losses/probabilistic_losses/#binaryfocalcrossentropy-class)：獨立核對真類機率、難易係數及類別平衡的分工。
- [Keras Siamese對比教學](https://keras.io/examples/vision/siamese_contrastive/)：參考配對監督與單筆分類的對照教法；配對標籤約定以本站前置頁為準。
- [TensorFlow 不平衡分類教學](https://www.tensorflow.org/tutorials/structured_data/imbalanced_data)：參考固定切分與驗證指標比較；支持相同評估基準的安排。

## 小結

- Focal Loss用於不平衡分類中的難例學習。
- 真類機率依標籤選取，負類要取1減正類機率。（補充）
- α調兩類相對貢獻，γ調容易樣本被降低的程度。（補充）
- γ為0仍保留α；損失較小也不直接代表任務效果較好。（補充）
