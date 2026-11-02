---
id: cross-entropy-loss
title: 交叉熵損失
kind: theory
codes: [L23103, L23201]
aliases: [Binary Cross-Entropy, Categorical Cross-Entropy, Cross-Entropy Loss]
summary: 用真實標籤衡量模型分配的機率，真類機率越低，交叉熵越大
goals:
  - id: g1
    text: 依輸入與目標區分交叉熵、對比損失與 Focal Loss
  - id: g2
    text: 計算二元及多類交叉熵，對齊機率、logits 與標籤格式
  - id: g3
    text: 比較相同標籤下兩種預測信心的損失，說明分類學習方向
requires: [bernoulli-binomial]
guide_refs: [guide-3:3-22, guide-3:4-4, guide-3:4-62]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: binary-cross-entropy
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: categorical-cross-entropy
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.CrossEntropyLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: logits-probability
    source: https://keras.io/api/layers/activations/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 三個任務分別有六筆疾病標籤與機率、三對照片的同人標籤、十萬個多數已易分類的背景框。哪種損失搭配最合理？
    options:
      A: 三者都只需要重建原始輸入
      B: 疾病用對比、照片用交叉熵、背景框用排序
      C: 疾病用 Focal 時，一定只降低最難樣本的權重
      D: 疾病可用交叉熵、照片配對可用對比、背景框可考慮 Focal
    answer: D
    explain:
      A: 這三項目標分別是分類、配對關係與難易樣本權重，不是複製輸入。
      B: 疾病機率與配對距離的資料語意被混用，排序也未處理容易背景占比。
      C: Focal 主要降低容易樣本的相對貢獻，以凸顯困難樣本。
      D: 三種輸入與學習目標不同，應先依任務選擇合適損失。
  - id: c2
    goal: g2
    type: choice
    prompt: 三類互斥分類的 logits 形狀為 (1,3)，真類是第三類。使用 PyTorch CrossEntropyLoss 的整數標籤版本，哪個輸入正確？
    options:
      A: "直接傳 logits，標籤用形狀 (1,) 的 long 張量 [3]"
      B: 直接傳 logits，標籤用形狀 (1,) 的 long 張量 [2]
      C: "直接傳 logits，標籤用形狀 (1,) 的浮點張量 [2.0]"
      D: "直接傳 logits，標籤用形狀 (1,1) 的 long 張量 [[2]]"
    answer: B
    explain:
      A: "三類的索引為0、1、2，第三類應填2，索引3超出範圍。"
      B: 一筆三類 logits 配一個零起算類別索引，形狀與資料型別都對齊。
      C: "整數標籤版本要求long型別的類別索引，即使2.0數值等於2也不能用浮點張量取代。"
      D: "輸入logits為(1,3)時，整數標籤須為(1,)，額外的單一維度會使標籤形狀不符。"
  - id: c3
    goal: g3
    type: choice
    prompt: 同一位真實正類個案，兩模型分別給正類機率 0.9 與 0.2。用自然對數計算單筆二元交叉熵，何者正確？
    options:
      A: 約 0.105 與 1.609，給真類較高機率的損失較小
      B: 約 1.609 與 0.105，低機率表示較謹慎所以較好
      C: 都是 0，因為兩個值都不是整數標籤
      D: 都是 1，因為真實標籤同為 1
    answer: A
    explain:
      A: 真類是正類時，損失分別為 −ln(0.9) 與 −ln(0.2)。
      B: 真類機率低代表模型把信心分給錯類，應有較大損失。
      C: 交叉熵就是用機率評價標籤，不要求輸出為整數。
      D: 標籤固定仍能區分機率信心，損失不等於標籤值。
---

## 為什麼需要

模型都判成正類時，給 0.51 與給 0.99 的信心不同。只看最後類別，會丟掉機率資訊。

交叉熵損失（Cross-Entropy Loss）用真實標籤檢查預測機率分佈。指引把它用於分類，讓訓練朝提高真類機率的方向前進。

## 直覺

交叉熵把模型分給真實類別的機率轉成懲罰，讓分類訓練能利用預測信心。

:::supplement[來源：PyTorch BCEWithLogitsLoss]
真實標籤是正類，模型卻只給正類 0.2，就比給 0.9 受到更大懲罰。評價的是「給真類多少機率」，不是信心越高就一律越好。
:::

![真實類別機率越接近零，單筆交叉熵越陡；橫軸是真類機率，不是固定的正類機率。](figure:l23103-cross-entropy-loss-confidence)

## 定義與公式（補充）

### 二元交叉熵（補充）

$$
\ell_{\rm BCE}(y,p)=-y\ln p-(1-y)\ln(1-p)
$$

$y\in\{0,1\}$ 是真實標籤，$p$ 是正類機率，$\ln$ 是自然對數。$y=1$ 時只留下 $-\ln p$，$y=0$ 時則只留下 $-\ln(1-p)$。

在 $0<p<1$ 內可直接代入。真類機率為 1 時損失為 0；真類機率趨近 0 時損失趨近無限大，不能直接用含 $0\ln0$ 的浮點運算代替極限。

### 多類交叉熵（補充）

$$
\ell_{\rm CE}(y,p)=-\sum_{c=1}^{C}y_c\ln p_c
$$

$C$ 是互斥類別數，$y_c$ 與 $p_c$ 是第 $c$ 類的標籤權重與機率，兩組皆非負、各自加總為 1。單一真類的 one-hot 標籤只在真類位置為 1，其餘為 0。

因此 one-hot 情況就是取真類機率的負對數。多標籤任務可同時屬於多類，通常改用逐類的二元交叉熵，不強迫所有輸出加總為 1。

### logits 如何變成機率（補充）

Logits 是尚未轉成機率的原始分數。二元一個分數 $z$ 用 sigmoid，多類分數向量用 softmax：

$$
p=\frac1{1+e^{-z}},\qquad
p_c=\frac{e^{z_c}}{\sum_{j=1}^{C}e^{z_j}}
$$

$e$ 是自然指數底數，$z_c,z_j$ 是類別分數。二元以 $z=\ln4$ 得到 $p=0.8$。三類將 $(0.1,0.2,0.7)$ 逐項取對數作 logits，softmax 後回到原機率。

## 算一次（補充）

共用醫療資料的 M01 是正類、機率 0.9，M03 也是正類、機率 0.2。損失分別是 $-\ln0.9=0.105361$、$-\ln0.2=1.609438$。

M02 是負類，正類機率卻為 0.8，故損失是 $-\ln(1-0.8)=1.609438$。負類的正類機率越高，表示越有信心地預測錯誤。

取全六筆平均得到 0.690491。另以正類機率 0.8 示範 BCE，$-\ln0.8=0.223144$；這兩個數字分別是整批平均與另一個單筆算例，不能混比。

三類範例的標籤是 $(0,0,1)$，機率是 $(0.1,0.2,0.7)$。逐類乘加後只留下 $-\ln0.7=0.356675$；整數標籤版本以索引 2 代表第三類。

## 程式（補充）

### 二元與極端分數（補充）

```python
import torch
# 固定種子沿用本組約定；本段無隨機運算，結果不受種子影響。
torch.manual_seed(23103)
p = torch.tensor([.9, .8, .2, .3, .7, .1], dtype=torch.float64)
y = torch.tensor([1., 0., 1., 0., 1., 0.], dtype=torch.float64)
bce = torch.nn.BCEWithLogitsLoss()(torch.logit(p), y)
single = torch.nn.BCEWithLogitsLoss()(
    torch.logit(torch.tensor([.8], dtype=torch.float64)),
    torch.ones(1, dtype=torch.float64))
print(f"六筆 {bce.item():.6f} 單筆 {single.item():.6f}")
extreme = torch.nn.functional.binary_cross_entropy_with_logits(
    torch.tensor([1000., -1000.]), torch.tensor([0., 1.]), reduction="none")
print("極端錯誤", extreme.tolist())
```
```text
六筆 0.690491 單筆 0.223144
極端錯誤 [1000.0, 1000.0]
```

### 多類的兩種標籤（補充）

```python
p3 = torch.tensor([[.1, .2, .7]], dtype=torch.float64)
z3 = p3.log()
index = torch.tensor([2], dtype=torch.long)
one_hot = torch.tensor([[0., 0., 1.]], dtype=torch.float64)
ce = torch.nn.CrossEntropyLoss()
print("形狀", tuple(z3.shape), tuple(index.shape))
print(f"索引 {ce(z3, index).item():.6f}")
print(f"分佈 {ce(z3, one_hot).item():.6f}")
```
```text
形狀 (1, 3) (1,)
索引 0.356675
分佈 0.356675
```

:::tip[讀碼重點]
`BCEWithLogitsLoss` 和 `CrossEntropyLoss` 都接 logits，內部處理數值穩定的轉換。不要先做 sigmoid 或 softmax 再交給這兩個函式。
:::

## 怎麼用、怎麼判讀

| 損失 | 輸入與監督 | 選用理由 |
|---|---|---|
| 交叉熵 | 類別機率與真實標籤 | 評價分類分佈 |
| 對比損失 | 樣本對與相似關係 | 學習配對相似度 |
| Focal Loss | 分類機率與真實標籤 | 不平衡時凸顯難分類樣本 |

:::supplement[來源：Focal Loss 原論文第 3 節]
Focal 的難易程度由真類機率 $p_t$ 算出，不是額外輸入。相同標籤下，真類機率越高越容易，調節權重就越小；完整公式與核算見[對比損失的 Focal 延伸比較](/concepts/contrastive-loss/#focal-loss-與對比損失的差別)。
:::

### 框架輸入對照（補充）

下表限單筆分類或形狀 `(N,C)` 的多類批次。$N$ 是筆數、$C$ 是類別數；Keras 下列名稱皆指損失函式或類別。

| 函式 | 模型輸出 | 標籤 |
|---|---|---|
| PyTorch BCEWithLogitsLoss | logits；與標籤同形 | 浮點 0/1 |
| PyTorch CrossEntropyLoss | `(N,C)` logits | `(N,)` long 索引，或 `(N,C)` 浮點分佈 |
| Keras BinaryCrossentropy | 預設機率；logits 須設 from_logits=True | 同形的二元標籤 |
| Keras CategoricalCrossentropy | 預設機率；logits 須設 from_logits=True | `(N,C)` one-hot |
| Keras SparseCategoricalCrossentropy | 同上 | `(N,)` 整數索引 |

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 一般類別預測 | 互斥類別與標籤 | 提高真實類別的機率 |
| 二元與多類分類 | 是／否，或多個互斥類別 | 選對 BCE 或多類 CE |
| 醫療追蹤（補充） | 每位有 0/1 標籤 | 損失之外還要看漏報成本 |
| 房屋用途分類（補充） | 住宅、商辦、工業三類 | 不是房價金額迴歸 |
| 文件多標籤（補充） | 同時屬於科技與金融 | 每個標籤各算 BCE |

## 常見誤解

- 信心高只在給對類別時有利；有信心地分錯會受重罰。（補充）
- 交叉熵比較分佈，但不是具有對稱性等性質的幾何距離。（補充）
- 損失小不代表決策閾值合適，也不保證機率已校準。（補充）

## 進階

### 參考來源

- 科目 3 指引（版本未標示）`guide-3:3-22`、`guide-3:4-4`、`guide-3:4-62`：支持任務選擇、分佈比較及二元／多類區分；公式與 API 為補充。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html)：支持二元公式與穩定 logits 計算。
- [PyTorch CrossEntropyLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.CrossEntropyLoss.html)：支持多類公式、形狀、索引及分佈標籤。
- [Keras 機率損失](https://keras.io/api/losses/probabilistic_losses/)：支持框架格式對照。
- [Keras 啟動函數](https://keras.io/api/layers/activations/)：同頁直接列出 sigmoid 與 softmax 公式，支持 logits 轉成機率。
- [Dive into Deep Learning 4.1](https://d2l.ai/chapter_linear-classification/softmax-regression.html)：參考從分類分數走到機率與損失的教法。
- [Focal Loss 原論文](https://arxiv.org/html/1708.02002v2)：支持難易樣本的相對權重比較。

## 小結

- 交叉熵用真實標籤檢查分類機率分佈。
- 真實類別得到的機率越低，損失越大。（補充）
- 機率、logits、標籤形狀及類別索引要一起核對。（補充）
