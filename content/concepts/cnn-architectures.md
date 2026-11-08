---
id: cnn-architectures
title: 經典 CNN 架構的演進與選用
kind: model
codes: [L23203, L21102]
aliases: [AlexNet, AlexNet、VGG 與 Inception 架構比較, GoogLeNet, Inception, LeNet, VGG, VGG16, VGGNet, classic-cnn-architectures, 經典 CNN 架構的演進與取捨]
summary: 不同 CNN 架構改變層的組法，影響影像辨識與運算成本
requires: [cnn]
guide_refs: [guide-1:3-43, guide-1:3-49, guide-3:4-71, guide-3:4-72]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 沿演進順序辨識六種架構，說明自動學特徵的資料與算力需求
  - id: g2
    text: 依手寫辨識、大型分類及資源條件，比較 LeNet、AlexNet 與 VGG
  - id: g3
    text: 分辨 AlexNet、VGG 與 Inception 的設計，核對堆疊及分支的成本
formula_groups:
  - id: small-kernel-cost
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23203-E
  - id: branch-channels
    source: https://d2l.ai/chapter_convolutional-modern/googlenet.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊把人工紋理特徵改成從像素訓練 CNN，目前只有 16 張標註圖。下列規劃何者合理？
    options:
      A: 以自動特徵取代標註，16 張圖皆不必指定類別
      B: 盤點標註與算力缺口，另用獨立資料驗證泛化
      C: 以 GPU 取代驗證資料，16 張訓練圖全對即可
      D: 依新架構名稱選模型，層數最多就能避免過擬合
    answer: B
    explain:
      A: 監督式分類仍需要標註，自動學特徵不等於自動提供答案。
      B: 特徵學習轉由模型承擔，資料量、算力與泛化評估仍是必要條件。
      C: GPU 加快運算，不能證明模型在未見資料上的表現。
      D: 更深模型仍可能過擬合，架構名稱不足以決定品質。
  - id: c2
    goal: g2
    type: choice
    prompt: 甲辨識手寫數字，乙有 GPU 與大量自然影像，想以 3×3 堆疊加深至 19 層。比較三種架構，何者合理？
    options:
      A: 甲用 LeNet；乙用 AlexNet 的 19 層小核堆疊，另量記憶體
      B: 甲用 VGG；乙用 LeNet 的 19 層小核堆疊，另量記憶體
      C: 甲用 LeNet；乙用 VGG 並以 GPU 免除驗證及記憶體評估
      D: 甲用 LeNet；乙用 VGG 小核堆疊，另查記憶體及泛化表現
    answer: D
    explain:
      A: 指引列 AlexNet 為 8 層，19 層與重複小核是 VGG 的辨識點。
      B: LeNet 是早期簡單分類代表，不是題意要求的 19 層堆疊設計。
      C: GPU 加速運算，不能代替泛化驗證或保證記憶體足夠。
      D: LeNet 符合甲的定位，VGG 符合乙的設計；仍要核對整網資源與品質。
  - id: c3
    goal: g3
    type: choice
    prompt: 某區塊各層皆維持 2 通道，兩層路徑為 2→2→2，不計偏置。比較一層 5×5 與兩層 3×3，何者正確？
    options:
      A: 權重分別為 100 與 72；加上中間 ReLU 後函數不必相同
      B: 權重分別為 100 與 36；加上中間 ReLU 後函數必定相同
      C: 權重分別為 50 與 72；兩者都必須有四條平行分支
      D: 權重分別為 50 與 36；兩者的理論感受野必定不同
    answer: A
    explain:
      A: 5×5×2×2 為 100，兩次 3×3×2×2 為 72，非線性又改變可表示的函數。
      B: 36 只算一層 3×3，中間的非線性也不能忽略。
      C: 50 漏算輸出通道，小卷積堆疊本身不要求平行分支。
      D: 在步幅及膨脹率為 1 時，兩層 3×3 的理論感受野可達 5×5。
  - id: c4
    goal: g3
    type: choice
    prompt: Inception 教學區塊四分支保留 6×6，高寬相同，輸出通道分別 2、2、1、1。拼接結果為何？
    options:
      A: 12×12×2，因為四條分支要按空間位置排成大圖
      B: 6×6×2，因為四條分支的對應通道要逐項相加
      C: 6×6×6，因為各分支特徵沿通道軸接在一起
      D: 6×6×4，因為輸出通道數必須等於分支數量
    answer: C
    explain:
      A: 這個模組沿通道拼接，不是把高寬排成新的大圖。
      B: 逐項相加不是 Inception 此處整合分支的方式。
      C: 高寬保留，通道為 2+2+1+1，合計 6。
      D: 每條分支可有不同通道數，不能只數分支條數。
---

## 為什麼需要

早期辨識影像時，常先由人挑出邊緣、紋理等特徵。特徵就是模型用來判斷影像內容的線索。分類器再根據這些線索，判斷影像屬於哪一類。

深度 CNN（逐層從影像學出辨識線索的模型）能減少人工設計。模型先學簡單的局部線索，再逐步組合出較複雜的線索。

模型自行學特徵，仍需要足夠的標註資料與運算資源。少量照片不一定能訓練出可靠模型。模型越深，越要注意訓練與實際使用時的成本。

## 直覺

比較各種架構：AlexNet 讓較深的模型能用在大型分類。VGG 反覆接上小卷積，每次查看影像的一小塊區域。GoogLeNet 的 Inception 在同一階段查看不同大小的區域。

![沿演進順序比較：先看人工挑特徵與模型自行學特徵。再看小卷積、不同大小的區域，以及相加與拼接。](figure:l23203-cnn-architectures-evolution)

ResNet 讓輸入繞過部分層，再與那些層的輸出相加。DenseNet 讓後面的層沿用前面各層的特徵。運算與尺寸詳見「殘差連接與 ResNet」及「DenseNet 與特徵拼接」。

### 四種設計的辨識點

| 架構 | 指引所列深度 | 核心策略 | 主要提醒 |
|---|---|---|---|
| LeNet | 5 層 | 早期、結構較簡單的 CNN | 手寫數字等簡單分類代表 |
| AlexNet | 8 層 | ReLU、GPU、Dropout | 大型分類也要防過擬合 |
| VGG | 最多 19 層 | 多次 3×3 卷積形成深層區塊 | 結構規律不等於整網便宜 |
| GoogLeNet | 本表不另列 | 多尺度卷積與池化平行後拼接 | 各分支共同決定成本 |

以上層數沿用科目 1 指引 3-49，可幫助辨識架構。

:::supplement[來源：D2L 8.1 AlexNet；8.2 VGG]
比較不同版本的層數時，須先確認是否計入池化等無權重層，不能只用數字大小判斷架構能力。
:::

ReLU 是激活函數，讓模型能學到非直線的關係。Dropout 是正則化方法，用來降低模型太依賴訓練資料的風險。GPU 用來加快運算。三者的工作不能互相替代。

## 定義與公式

VGG 強調以小卷積堆疊增加深度與非線性。Inception 則以不同大小的卷積及池化分支，同時擷取不同尺度的線索，再把輸出拼接。

![VGG 沿同一路徑堆疊；Inception 將相同輸入分給多尺度分支，保持高寬後沿通道拼接。](figure:l23203-cnn-architectures-blocks)

### 小卷積的局部成本（補充）

以下係數依一般卷積的權重形狀自行推得，並非 VGG 論文直接列出的比較。

限定 groups=1、無偏置、各層皆為 $C$ 個輸入與輸出通道，步幅與膨脹率均為 1：

$$
P_{5}=25C^2,\qquad P_{3+3}=18C^2
$$

$P_5$ 是一層 5×5 的權重數，$P_{3+3}$ 是兩層 3×3 的權重總數，$C$ 是每層通道數。兩層 3×3 的理論感受野邊長為 $3+(3-1)=5$。

這只比較同寬局部區塊。中間插入 ReLU 後，兩種區塊不必實作相同函數；也不能由此推論整個 VGG 的參數或延遲一定較低。

### 分支的輸出通道（補充）

高寬一致的分支沿通道軸拼接時：

$$
C_{\mathrm{out}}=\sum_{b=1}^{B}C_b
$$

$B$ 是分支數，$C_b$ 是第 $b$ 條分支的輸出通道，$C_{\mathrm{out}}$ 是拼接後通道數。拼接不要求各分支通道相等，但其他軸必須相容。

## 算一次（補充）

共用例子沿用 `L23203-D-images.json`：製造、交通各 16 張 8×8×3，種子 23203；原卷積輸出為 6×6×2。

本頁配置見 `L23203-E-tensors.json` 的 `resource_cards`，只比較教學區塊。

### 同一輸入，兩種組法

VGG 風格區塊令通道維持 2。一層 5×5 需 $25\times2^2=100$ 個權重，兩層 3×3 需 $18\times2^2=72$ 個；適當 padding 保持空間尺寸。

Inception 風格區塊的四條分支都保留 6×6，通道為 2、2、1、1。代入通道式得 $C_{\mathrm{out}}=2+2+1+1=6$，輸出為 6×6×6。

### 資料與資源一起看

| 區塊 | 無偏置權重 | 輸出形狀 HWC |
|---|---|---|
| 一層 5×5，同寬 2 通道 | 100 | 6×6×2 |
| 兩層 3×3，同寬 2 通道 | 72 | 6×6×2 |
| Inception 四分支拼接 | 依各分支配置另算 | 6×6×6 |

前兩列以適當 padding 保持高寬。製造細線與大片缺損可比較小核及多尺度分支；換成交通標誌，仍沿用相同索引、切分及輸入規格。

遠處小標誌可能因大核或池化失去細節，可另比較小標誌子集召回率。原例有重複像素跨集，不能估計泛化；須先去重重切，再量品質、記憶體與裝置延遲。

## 怎麼用、怎麼判讀

LeNet 可幫助理解簡單手寫分類；AlexNet 展示大量標註、GPU 與深層特徵的搭配。VGG 的規律區塊容易讀懂，Inception 則處理同一層次的多尺度線索。

訓練資料少時，更深不一定更好。模型仍可能記住背景或樣本細節，必須保留泛化評估；訓練與推論的成本也要分開看。

:::supplement[來源：D2L 8.4 GoogLeNet；Going Deeper with Convolutions]
Inception 的 1×1 卷積可先壓低部分分支的通道，再做較昂貴的空間卷積。節省多少取決於配置；增加分支不表示免費取得多尺度特徵。
:::

### 換個場景

| 場景或資料條件 | 架構思路 | 判讀重點 |
|---|---|---|
| 手寫數字、簡單分類 | LeNet 的早期簡單結構 | 不必先追求極深網路 |
| 大量自然影像分類 | AlexNet、VGG 的深層特徵 | 盤點標註、GPU 與過擬合 |
| 特徵尺度多樣 | Inception 多尺度分支 | 看不同範圍的局部線索 |
| 製造瑕疵（補充） | 比較細線與大片缺損 | 防止相同產品跨集 |
| 交通標誌（補充） | 比較遠近尺度與資源 | 不用大模型名稱保證辨識 |

## 常見誤解

- 「CNN 出現後就不用人工整理資料」：資料品質、標註與評估仍要做。
- 「GPU、ReLU、Dropout 都是加速技巧」：分別處理運算、非線性與正則化。
- 「VGG 的小卷積代表整個模型必定最省」：局部權重比較不足以推論整網成本。（補充）
- 「Inception、ResNet、DenseNet 都是分支相加」：分支拼接、殘差相加與跨層拼接要分辨。（補充）

## 進階

### 從歷史定位到選用

2012 年的 AlexNet 是深度視覺發展的重要節點。後續架構各自改進深度、多尺度、訊號傳遞或特徵重用，不能把演進順序當成任何資料集上的品質保證。

### 參考來源

- 科目 1 指引 `guide-1:3-43`、`guide-1:3-49`：演進、資料與算力、手寫及大型分類定位；核對 PDF 頁 50、56。
- 科目 3 指引 `guide-3:4-71`～`guide-3:4-72`：四種架構的設計及後續重用方向；核對 PDF 頁 109、110。
- [AlexNet 原論文](https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks.pdf)：ReLU、GPU、Dropout 的不同角色。
- [VGG 原論文](https://arxiv.org/pdf/1409.1556)：小核堆疊、感受野與非線性差異。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html)：小卷積成本依 weight 形狀自行推導；限定 groups=1、無偏置。
- [GoogLeNet 原論文](https://arxiv.org/pdf/1409.4842)：多尺度與資源配置的補充說明。
- [D2L 8.1 AlexNet](https://d2l.ai/chapter_convolutional-modern/alexnet.html)、[8.2 VGG](https://d2l.ai/chapter_convolutional-modern/vgg.html)、[8.4 GoogLeNet](https://d2l.ai/chapter_convolutional-modern/googlenet.html)：架構對照的教學思路及分支通道計算。

## 小結

- 自動學特徵仍依賴資料、標註與算力。
- LeNet、AlexNet、VGG、Inception 各有不同設計重點。
- 小核堆疊與多尺度分支，要連同通道配置一起判讀成本。
- 架構演進提供選用思路，品質與裝置限制仍須驗證。
