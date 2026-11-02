---
id: contrastive-loss
title: 對比損失
kind: theory
codes: [L23103]
aliases: [Contrastive Loss]
summary: 依配對標籤拉近相似向量、分開不相似向量，學習可比較的距離
goals:
  - id: g1
    text: 依資料輸入與目標區分交叉熵、對比與 Focal Loss 的用途
  - id: g2
    text: 計算 margin 對比損失與 Focal Loss，解釋各自超參數的作用
requires: [vector-norm-linear-combination, cross-entropy-loss]
guide_refs: [guide-3:3-22, guide-1:3-76]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: pairwise-margin-loss
    source: https://keras.io/examples/vision/siamese_contrastive/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: focal-objective
    source: https://arxiv.org/html/1708.02002v2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某系統有 300 對人臉照片，每對標示是否同一人，希望同人向量接近、異人向量分開。哪個描述最符合對比損失？
    options:
      A: 只要輸出每張照片的房價金額
      B: 根據配對標籤，對兩向量的距離給不同懲罰
      C: 將每對照片強迫重建成完全相同的像素
      D: 不必有配對關係，任意把所有向量拉到同一點
    answer: B
    explain:
      A: 連續金額預測與人臉配對目標無關。
      B: 相似與不相似配對需要不同的距離目標。
      C: 像素重建不是比較向量距離，相同身份也不要求照片像素相同。
      D: 全部重合會讓不相似配對無法分開。
  - id: c2
    goal: g2
    type: choice
    prompt: 本頁以 y=1 表示相似，損失不乘二分之一，margin=1。三對資料依序為相似且距離 0.2、不相似且距離 0.2、不相似且距離 1.2，損失依序是多少？
    options:
      A: 0.64、0.04、1.44
      B: 0.02、0.32、0
      C: 0.04、0.64、0.04
      D: 0.04、0.64、0
    answer: D
    explain:
      A: 相似與不相似標籤的懲罰方向被顛倒。
      B: 這組數字額外乘了二分之一，與題目採用的版本不同。
      C: 不相似距離已超過 margin 時，截斷後損失為零。
      D: 相似用距離平方，不相似用距離不足 margin 的正部平方。
  - id: c3
    goal: g2
    type: choice
    prompt: 兩筆正類的真類機率為 0.9 與 0.2，Focal 設 α=0.25、γ=2。乘在交叉熵前面的權重依序是多少？
    options:
      A: 0.81 與 0.04
      B: 0.025 與 0.2
      C: 0.0025 與 0.16
      D: 0.25 與 0.25
    answer: C
    explain:
      A: 這是機率平方，沒有使用一減真類機率，也漏了 α。
      B: 這是只乘一次一減真類機率，沒有套 γ=2。
      C: 分別為 0.25×0.1 的平方與 0.25×0.8 的平方，容易樣本相對降權更多。
      D: 只有 γ=0 時才會消除難易調節因子。
---

## 為什麼需要

人臉辨識可能要回答「兩張照片是不是同一人」，語意匹配要回答「兩段文字是否相近」。學會固定類別名稱，未必足以比較新樣本。

對比損失（Contrastive Loss）用樣本配對的相似關係學習表示。指引也以圖文編碼器共同學習，說明這種配對思路。

## 直覺

相似的樣本要學出接近的表示，不相似的樣本則要能區分。

:::supplement[來源：Keras Siamese 對比損失教學]
先把每筆資料轉成嵌入向量，再比較兩個向量的距離。相似配對希望接近，不相似配對希望至少隔開指定距離。

圖中的二維數值只是教學表示。向量空間的距離並非原始照片的像素差，也不是疾病正類機率。
:::

![相同距離在不同配對標籤下會受到不同懲罰；不相似配對超出 margin 後不再被這個版本繼續推遠。](figure:l23103-contrastive-loss-pair-geometry)

## 定義與公式

先依指引區分配對關係與分類樣本的難易，再用以下補充公式展開計算。

### 一種 margin 版本（補充）

$$
\begin{aligned}
D&=\lVert a-b\rVert_2,\\
\ell_{\rm pair}&=yD^2+(1-y)\max(0,m-D)^2
\end{aligned}
$$

$a,b$ 是同維度嵌入向量，$D$ 是歐氏距離。本頁約定 $y=1$ 表示相似、$y=0$ 表示不相似，$m>0$ 是間隔（margin）。

相似配對的最小值在 $D=0$；不相似配對在 $D\geq m$ 時損失為 0。增加 $m$ 會要求不相似配對隔得更遠，但效果取決於向量尺度。

此式不乘 $1/2$。Keras 參考教學用 0 表示相似，與本頁相反；對照時必須把標籤轉換，不能只複製公式符號。

### Focal Loss 與對比損失的差別

指引把對比損失用於配對關係，把 Focal Loss 用於不平衡分類中較難分類的樣本。兩者選用前，要先區分資料提供的是相似標籤還是類別標籤。

:::supplement[來源：Focal Loss 原論文第 3 節]
對比損失改的是配對距離目標；Focal Loss 改的是分類樣本的相對權重。以下二元版沿用交叉熵損失的 $y=1$ 正類、$y=0$ 負類。

$$
\begin{aligned}
p_t&=\begin{cases}p,&y=1\\1-p,&y=0\end{cases},\quad
\alpha_t=\begin{cases}\alpha,&y=1\\1-\alpha,&y=0\end{cases},\\
\ell_{\rm focal}&=-\alpha_t(1-p_t)^\gamma\ln p_t
\end{aligned}
$$

$p$ 是正類機率，$p_t$ 是真類機率，$0<\alpha<1$ 調整類別相對權重，$\gamma\geq0$ 調整難易樣本差異。$\ln$ 是自然對數。

$\gamma=0$ 回到加權交叉熵；移除 $\alpha_t$ 才是未加權版本。$\gamma>0$ 時，真類機率高的容易樣本被降權更多，並非把困難樣本的權重降得更低。
:::

## 算一次（補充）

### 固定三個配對（補充）

共用資料的向量起點皆為 $(0,0)$，終點依序為 $(0.2,0)$、$(0.2,0)$、$(1.2,0)$，故距離為 0.2、0.2、1.2。設定 $m=1$。

| 配對 | 標籤與距離 | 代入 | 損失 |
|---|---|---|---|
| P01 | 相似，0.2 | $0.2^2$ | 0.04 |
| P02 | 不相似，0.2 | $(1-0.2)^2$ | 0.64 |
| P03 | 不相似，1.2 | $\max(0,1-1.2)^2$ | 0 |

P01 與 P02 的幾何完全相同，但監督目標不同。若把 $m$ 改成 2，P03 變成 $(2-1.2)^2=0.64$，P01 則不受 $m$ 影響。

### 同一醫療分類的 Focal（補充）

取 M01 與 M03，兩筆都是真正類，$p_t$ 分別為 0.9 與 0.2。設 $\alpha=0.25,\gamma=2$，先算調節權重，再乘交叉熵。

| 樣本 | 交叉熵 | 調節權重 | Focal |
|---|---|---|---|
| M01，較容易 | 0.105361 | $0.25\times0.1^2=0.0025$ | 0.000263 |
| M03，較困難 | 1.609438 | $0.25\times0.8^2=0.16$ | 0.257510 |

負類 M02 的正類機率為 0.8，真類機率是 0.2，$\alpha_t=0.75$。因此權重為 $0.75\times0.8^2=0.48$，Focal 為 0.772530。

![固定同一真類機率軸與類別權重，γ 增大時容易樣本的曲線下降更多；圖中數值採正類 α=0.25。](figure:l23103-contrastive-loss-focal-shape)

## 程式（補充）

### 配對標籤與 margin（補充）

```python
import torch
# 固定種子沿用本組約定；本段無隨機運算，結果不受種子影響。
torch.manual_seed(23103)
a = torch.zeros((3, 2), dtype=torch.float64)
b = torch.tensor([[.2, 0.], [.2, 0.], [1.2, 0.]], dtype=torch.float64)
y_pair = torch.tensor([1., 0., 0.], dtype=torch.float64)
d = torch.linalg.vector_norm(a-b, dim=1)
loss = y_pair*d.square() + (1-y_pair)*(1-d).clamp_min(0).square()
print("距離", [round(v, 2) for v in d.tolist()])
print("損失", [round(v, 2) for v in loss.tolist()])
edge_d = torch.tensor([0., 1., 1.2])
print("不相似邊界", (1-edge_d).clamp_min(0).square().tolist())
```
```text
距離 [0.2, 0.2, 1.2]
損失 [0.04, 0.64, 0.0]
不相似邊界 [1.0, 0.0, 0.0]
```

### 同機率核算 Focal（補充）

```python
p = torch.tensor([.9, .8, .2, .3, .7, .1], dtype=torch.float64)
y = torch.tensor([1., 0., 1., 0., 1., 0.], dtype=torch.float64)
pt = torch.where(y == 1, p, 1-p)
at = torch.where(y == 1, .25, .75).to(torch.float64)
weight = at*(1-pt).square()
focal = -weight*pt.log()
print("權重", [round(v, 4) for v in weight[[0, 2, 1]].tolist()])
print("Focal", [round(v, 6) for v in focal[[0, 2, 1]].tolist()])
gamma_zero = -at*(1-pt).pow(0)*pt.log()
print("gamma=0 等於加權交叉熵", torch.allclose(gamma_zero, at*(-pt.log())))
```
```text
權重 [0.0025, 0.16, 0.48]
Focal [0.000263, 0.25751, 0.77253]
gamma=0 等於加權交叉熵 True
```

:::tip[讀碼重點]
`dim=1` 沿特徵軸計算每對距離，保留三個配對。Focal 的 `pt` 則要依正負標籤選真類機率，不能對負類也直接使用 `p`。
:::

## 怎麼用、怎麼判讀

先看資料有沒有「這兩筆是否相似」的監督訊息。對比損失適合人臉與語意匹配，分類機率的難易樣本問題則可考慮 Focal Loss。

### 三類任務怎麼選

| 損失 | 資料輸入與監督 | 選用理由 |
|---|---|---|
| 交叉熵 | 每筆類別機率與真實類別標籤 | 讓機率分佈符合分類目標 |
| 對比損失 | 兩筆表示與相似／不相似標籤 | 學習樣本間的相似關係 |
| Focal Loss | 每筆分類機率與真實類別標籤 | 不平衡時加強難分類樣本的相對影響 |

:::supplement[來源：PyTorch BCEWithLogitsLoss；Keras Siamese 教學；Focal Loss 原論文第 2–3 節]
共用醫療資料有六筆類別機率與標籤，可先算交叉熵；若容易樣本大量累積，再評估 Focal 是否合適。三個向量配對另有相似標籤，才用對比損失；只有分類機率並不足以定義配對關係。

Focal 的難易權重由真類機率算出，不必另給難易標籤。容易樣本相對降權，和把配對距離推到 margin 外，是兩種不同的調整。

配對距離需要明訂尺度與標籤約定。難分類也可能來自錯標或雜訊；Focal 讓困難樣本相對受重視，不等於自動修正雜訊或保證公平。
:::

### 換個場景

| 場景 | 資料條件 | 選用理由 |
|---|---|---|
| 人臉辨識 | 同人／異人配對 | 學相似距離 |
| 語意與圖文匹配 | 語意相近或圖文是否相符 | 讓相關表示接近 |
| 不平衡分類 | 大量容易樣本 | Focal 凸顯難分類樣本 |
| 房屋相似搜尋（補充） | 已標註的房屋配對 | 比較房型表示，不是金額誤差 |
| 醫療影像檢索（補充） | 專家定義病灶相似配對 | 配對正類與疾病正類要分開 |

## 常見誤解

- 「對比」不等於單純比較兩個分類機率；指引強調樣本相似關係。
- 不相似向量超過 margin 後，本頁版本不再要求繼續遠離。（補充）
- Focal 的 γ 調難易權重，margin 調配對距離，不能互換。（補充）
- 指引提到 CLIP 也用對比學習，不表示 CLIP 就採本頁的成對 margin 公式。（補充）

## 進階

### 參考來源

- 科目 3 學習指引（版本未標示；本機快照）`guide-3:3-22`：支持人臉、語意匹配與不平衡分類用途，未列 margin 或 Focal 公式。
- 科目 1 學習指引（版本未標示；本機快照）`guide-1:3-76`：支持圖文編碼器的對比學習場景。
- [Keras Siamese 對比損失教學](https://keras.io/examples/vision/siamese_contrastive/)：支持距離與 margin 公式；本頁反轉其標籤約定，亦參考配對圖的教學安排。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html)：支持三類任務比較中的二元分類機率與標籤契約。
- [Focal Loss 原論文第 3 節](https://arxiv.org/html/1708.02002v2)：支持 α、γ、容易樣本降權與數值核算。
- [Keras 機率損失](https://keras.io/api/losses/probabilistic_losses/)：獨立核對 Focal 的類別平衡與 γ 設定。

## 小結

- 對比損失利用配對關係學習相似度。
- 配對標籤、向量尺度與 margin 必須一起說明。（補充）
- Focal 留在分類機率上，透過降低容易樣本貢獻凸顯困難樣本。（補充）
