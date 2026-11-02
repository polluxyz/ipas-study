---
id: efficient-cnn
title: MobileNet 與 EfficientNet 的效率策略
kind: model
codes: [L23203]
aliases: [Depthwise Separable Convolution, EfficientNet, MobileNet]
summary: MobileNet 拆分卷積工作，EfficientNet 協調模型縮放，以符合品質與資源限制
is_a: [cnn]
requires: [convolution-layer]
guide_refs: [guide-3:4-72, guide-1:3-58, guide-1:3-81]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 比較 MobileNet 與 EfficientNet 的效率策略，依行動端限制判讀配置
  - id: g2
    text: 核算小張量的深度可分離卷積與參數，分辨理論成本和實際延遲
formula_groups:
  - id: separable-cost
    source: https://arxiv.org/pdf/1704.04861
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
  - id: compound-scaling
    source: https://proceedings.mlr.press/v97/tan19a/tan19a.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 路側裝置每張影像有 30 毫秒回應預算。團隊比較 MobileNet 與 EfficientNet，哪個說明合理？
    options:
      A: MobileNet 省參數便保證低於 30 毫秒；EfficientNet 搜尋三軸比例，仍量品質
      B: MobileNet 拆開空間與通道運算；EfficientNet 只放大解析度，便免測 30 毫秒預算
      C: MobileNet 只做逐通道便完成通道混合；EfficientNet 搜尋比例，仍測 30 毫秒預算
      D: MobileNet 拆開空間與通道運算；EfficientNet 搜尋縮放比例，皆測 30 毫秒預算
    answer: D
    explain:
      A: 參數較少不能保證裝置延遲，仍須量測是否低於 30 毫秒。
      B: EfficientNet 協調深度、寬度與解析度，也不能免除裝置量測。
      C: 逐通道卷積沒有混合不同通道，還需要逐點卷積。
      D: 兩種策略分別調整局部運算與整體配置，品質及回應預算都要驗證。
  - id: c2
    goal: g2
    type: choice
    prompt: 不計偏置，3×3 卷積由 3 通道輸入產生 2 通道輸出。深度可分離版本每輸入通道只用一個空間核，參數各為多少？
    options:
      A: 標準為 54，分離為 27；只需計逐通道核，不計跨通道混合
      B: 標準為 54，分離為 33；分離版包含 27 個空間及 6 個混合權重
      C: 標準為 18，分離為 33；標準版每個輸出不必讀取三個通道
      D: 標準為 56，分離為 38；兩種版本都應將偏置一併列入結果
    answer: B
    explain:
      A: 27 只涵蓋逐通道卷積，仍缺 1×1 通道混合的 6 個權重。
      B: 9×3×2 為 54，9×3+3×2 為 33，兩者都符合無偏置條件。
      C: 標準卷積每個輸出通道讀取全部輸入通道，不能漏算輸入通道數。
      D: 這些數字包含偏置，與題目的排除條件不一致。
  - id: c3
    goal: g2
    type: choice
    prompt: 產線控制器換成較少 MAC 的輕量模型，尚未量過裝置延遲；影像串流每 40 毫秒來一張。下一步最合理的是什麼？
    options:
      A: 實測前處理與推論的整體時間，並檢查品質及串流是否積壓
      B: 依 MAC 比例直接推定整體時間，無須量測前處理或資料搬移
      C: 只看訓練 GPU 的高使用率，即可判定控制器不會發生積壓
      D: 將影像解析度加倍再直接上線，因為輕量架構不會增加成本
    answer: A
    explain:
      A: 串流是否跟得上取決於目標流程的服務能力，也要確認模型品質。
      B: MAC 不包含資料搬移與其他流程，不能直接換算整體延遲。
      C: 訓練環境與部署控制器不同，使用率不足以證明串流容量。
      D: 解析度增加會提高運算與記憶體需求，不能跳過驗證。
---

## 為什麼需要

行動裝置與邊緣攝影機有算力、記憶體與功耗限制。模型即使分類正確，若每張處理太慢，影像串流仍可能持續積壓。

MobileNet 與 EfficientNet 都以效率為重要目標。前者的代表設計是深度可分離卷積，後者關注如何安排模型縮放；它們提供不同層次的資源配置思路。

## 直覺

對資源受限裝置，可以從局部卷積設計或整體網路配置尋找效率。

MobileNet 以深度可分離卷積為代表；EfficientNet 則自動搜尋合適的網路縮放比例。這分別從卷積設計與整體配置安排效率，選用時仍要看裝置限制。

:::supplement[來源：MobileNets 3.1；EfficientNet 3–4]
標準卷積同時查看空間鄰域並混合輸入通道。深度可分離卷積（Depthwise Separable Convolution）把這兩項工作分開，減少局部運算需求。

MobileNet v1 可想成先讓每個通道各自看鄰域，再用 1×1 卷積交換通道資訊。EfficientNet 的複合縮放則同時考慮網路多深、多寬，以及輸入解析度多高。

兩者並不互斥：EfficientNet-B0 的主要區塊 MBConv 本身就含逐通道卷積。這裡比較各自代表策略，不表示兩個模型族只能用一種元件。
:::

## 定義與公式

MobileNet 以深度可分離卷積支援資源受限部署；EfficientNet 自動搜尋網路縮放比例，尋找效率與品質的平衡。不能只從模型名稱判定是否符合裝置預算。

![上半把空間卷積與通道混合拆開；下半提醒複合縮放同時調整深度、寬度與解析度。](figure:l23203-efficient-cnn-strategies)

### 拆開空間與通道運算（補充）

逐通道卷積（depthwise convolution）讓每個輸入通道各用一個空間核；逐點卷積（pointwise convolution）再以 1×1 核混合通道。

固定一個輸入通道只產生一個 depthwise 通道、無偏置時：

$$
\begin{aligned}
P_{\mathrm{std}}&=K^2MN\\
P_{\mathrm{sep}}&=K^2M+MN
\end{aligned}
$$

$K$ 是正方形核的邊長，$M$、$N$ 是輸入及輸出通道數。$P_{\mathrm{std}}$ 是標準卷積權重數，$P_{\mathrm{sep}}$ 包含逐通道核與通道混合權重。

本例單張卷積的乘加次數（Multiply-Accumulate，MAC）為：

$$
\mathrm{MAC}=H_oW_oP
$$

$H_o,W_o$ 是輸出高寬，$P$ 是對應卷積權重數。此式不含偏置、激活、正規化與資料搬移。

### 複合縮放的意思（補充）

EfficientNet 將深度、寬度與解析度倍率協調增加。對一般卷積主導的成本，可用下式理解近似關係：

$$
R_{\mathrm{cost}}\approx d\,w^2r^2
$$

$d$ 是層數倍率，$w$ 是通道寬度倍率，$r$ 是輸入高與寬各自的倍率；$R_{\mathrm{cost}}$ 是相對運算成本。寬度影響輸入與輸出通道，解析度影響面積，所以兩者為平方。

本式用於理解取捨，並非完整 EfficientNet 的精確計數。實際層數及通道要取整，不同區塊與硬體也會改變成本及延遲。

## 算一次（補充）

共用資源卡沿用製造與交通兩域的 8×8×3 輸入規格。為公平比較，兩種卷積都用 3×3、stride 1、valid、3→2 通道，並關掉偏置。

### 同一輸入的參數與 MAC

輸出高寬為 6×6。代入標準式為 $3^2\times3\times2=54$ 個權重；分離式為 $3^2\times3+3\times2=27+6=33$ 個。

| 局部設計 | 權重數 | 單張 MAC | 輸出形狀 CHW |
|---|---:|---:|---|
| 標準 3×3 | 54 | 6×6×54＝1944 | 2×6×6 |
| 逐通道＋逐點 | 33 | 6×6×33＝1188 | 2×6×6 |

分離版使用 $33/54\approx61.1\%$ 的權重及卷積 MAC。輸出形狀相同，不代表任意權重下輸出數值相同；分解限制了局部表示方式。

前置組原卷積含偏置，為 56 個參數；本表為無偏置 54 個。核對時先確認排除項，不把不同設定的數字混在一起。

### 小張量算出輸出

另用共用的 3×3×3 小張量，三通道總和為 45、9、−9。逐通道的 3×3 核全為 1，因此中間輸出就是這三個數。

逐點卷積兩組權重為 $(1,1,1)$、$(1,0,-1)$，輸出分別為 $45+9-9=45$ 與 $45+0+9=54$。輸出為 NCHW=1×2×1×1。

### 縮放不會免費

資源卡以 $d=1.2,w=1.1,r=1.15$ 示範。代入得 $1.2\times1.1^2\times1.15^2=1.92027$，約 1.92 倍理論成本，不是 1.2 倍。

這三個數值來自原論文為基礎網路搜尋的縮放係數，本例取整體縮放係數 $\phi=1$，所以倍率等於各係數。約 1.92 倍符合論文約兩倍成本的搜尋條件。

這是連續倍率的教學估算，沒有建立整數化模型。製造控制器與交通裝置都要再以自己的品質、功耗與回應限制驗證。

## 程式（補充）

先將 `IPAS_REPO_ROOT` 設為 repo 根目錄。以下只執行局部小張量，權重固定，不下載或訓練完整模型。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-E-tensors.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
z = torch.tensor(d['lightweight']['x'], dtype=torch.float32)
std = torch.nn.Conv2d(3,2,3,bias=False)
dw, pw = torch.nn.Conv2d(3,3,3,groups=3,bias=False), torch.nn.Conv2d(3,2,1,bias=False)
with torch.no_grad():
    dw.weight.fill_(d['lightweight']['depthwise_weight'])
    pw.weight.copy_(torch.tensor(d['lightweight']['pointwise_weights']).reshape(2,3,1,1))
q = dw(z)
y = pw(q)
print('逐通道輸出:', q.flatten().detach().tolist())
print('最終形狀與數值:', tuple(y.shape), y.flatten().detach().tolist())
print('標準／分離參數:', std.weight.numel(), dw.weight.numel()+pw.weight.numel())
```
```text
逐通道輸出: [45.0, 9.0, -9.0]
最終形狀與數值: (1, 2, 1, 1) [45.0, 54.0]
標準／分離參數: 54 33
```

:::tip[讀碼重點]
`groups=3` 配合三個輸入與三個輸出通道，實作本例逐通道卷積。後面的 `pw` 才把三通道混成兩通道；只算 `dw` 會漏掉參數與功能。

實際參與輸出的權重已固定，種子只為與共用例子一致；標準卷積僅用來計參數，未使用其隨機輸出。
:::

## 怎麼用、怎麼判讀

先列裝置限制，再比較模型。行動端及邊緣裝置可考慮輕量架構；影像串流除了單張推論，也要檢查是否來得比處理得快。

:::supplement[來源：MobileNets 3；EfficientNet 3；共用資源卡]
若瓶頸是卷積運算，可比較深度可分離區塊；若要調整整體容量，則同時看深度、通道與解析度。縮小解析度可能抹掉細小瑕疵或遠處標誌，效率與品質要一起確認。

較少 MAC 不保證更低延遲。裝置對算子的支援、資料搬移及前後處理都會影響結果；本頁沒有以計數冒充裝置時間實測。
:::

### 效率策略對照

| 代表策略 | 改變什麼 | 比較時看什麼 |
|---|---|---|
| MobileNet 深度可分離卷積 | 以輕量卷積設計安排效率 | 資源受限裝置的品質與成本 |
| EfficientNet 自動搜尋縮放比例 | 以網路縮放配置安排效率 | 行動端的品質與資源預算 |
| MobileNet v1 分解細節（補充） | 拆開空間與通道運算 | 兩步成本都要計入 |
| EfficientNet 複合縮放細節（補充） | 協調深度、寬度與解析度 | 整體成本與品質一起看 |

這是局部算子與整體容量的不同切入點。兩者可以搭配，最後仍以目標裝置實測確認是否達到預算。

### 換個場景

| 場景或資料條件 | 可以比較的策略 | 核對項目 |
|---|---|---|
| 行動設備、資源受限環境 | 輕量架構與縮放配置 | 品質及資源是否符合預算 |
| 智慧監控、影像串流 | MobileNet 等輕量選項 | 延遲是否造成持續積壓 |
| 製造控制器（補充） | 調整局部卷積及輸入尺度 | 細瑕疵、記憶體、回應時間 |
| 路側交通裝置（補充） | 調整深寬及解析度 | 小標誌、功耗及處理容量 |

## 常見誤解

- 「輕量名稱保證任何硬體都即時」：仍要在目標流程量測串流容量。
- 「MobileNet 只是換個模型名稱」：指引的辨識點是深度可分離卷積。
- 「EfficientNet 的縮放比例完全由人隨意指定」：指引強調自動搜尋網路縮放比例。
- 「深度可分離卷積不需要通道混合」：逐點卷積正是混合通道的步驟。（補充）
- 「EfficientNet 只把網路加深」：複合縮放協調深度、寬度與解析度。（補充）
- 「參數較少代表推論值完全相同」：分解是架構選擇，並非任意卷積的等價替換。（補充）

## 進階

### 基礎架構搜尋與縮放分開看

EfficientNet 的縮放比例來自搜尋，不是只把網路加深。

:::supplement[來源：EfficientNet 原論文 3.3–4]
先以架構搜尋取得基礎網路 B0，再在 B0 上以小型網格搜尋找出深度、寬度及解析度係數 α、β、γ。其值為 1.2、1.1、1.15；這是搜尋結果，不是通用最佳常數。

固定這三個係數後，才改變整體縮放係數 φ，將三軸一起擴展成模型族。不是每次部署都重做搜尋，也不是把倍率當成新的卷積運算。
:::

### 參考來源

- 科目 3 指引 `guide-3:4-72`：兩模型族的效率定位與資源受限部署；核對 PDF 頁 110。
- 科目 1 指引 `guide-1:3-58`、`guide-1:3-81`：監控設備、串流延遲與輕量架構場景。
- [MobileNets 原論文 3.1](https://arxiv.org/pdf/1704.04861)：深度可分離卷積、參數及卷積成本。
- [EfficientNet 原論文 3–4](https://proceedings.mlr.press/v97/tan19a/tan19a.pdf)：複合縮放、近似成本及基礎架構搜尋。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html)：程式的 groups 與卷積形狀。
- [Keras EfficientNet 教學](https://keras.io/examples/vision/image_classification_efficientnet_fine_tuning/)：先固定輸入與比較條件的教學思路；本頁未執行其下載流程。
- [TensorFlow 遷移學習教學](https://www.tensorflow.org/tutorials/images/transfer_learning)：MobileNet 作為影像特徵抽取器的教學脈絡；本頁只取局部運算例。

## 小結

- 兩個模型族都關注品質與資源限制。
- MobileNet 的代表策略是深度可分離卷積。
- EfficientNet 透過自動搜尋安排網路縮放比例。
- 參數、MAC、記憶體與實際延遲要分開確認。（補充）
