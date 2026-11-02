---
id: batch-normalization
title: 批次正規化
kind: component
codes: [L23203, L23103]
aliases: [BN, Batch Normalization, BatchNorm]
summary: 批次正規化調整中間特徵的尺度，訓練與推論使用不同統計來源
goals:
  - id: g1
    text: 說明中間特徵正規化的作用，區分輸入標準化與 Dropout 並指出小批次限制
  - id: g2
    text: 沿特徵軸算出訓練輸出，區分當批統計、移動統計與推論輸出
requires: [descriptive-statistics, artificial-neuron]
guide_refs: [guide-3:3-27, guide-3:4-81, guide-3:5-34]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: bn-statistics-transform
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.BatchNorm1d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
  - id: bn-running-statistics
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.BatchNorm1d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫療網路已將原始兩欄輸入標準化，團隊想在兩個隱藏層間加入 BN。哪個說法正確？
    options:
      A: BN 調整中間特徵，與先處理原始輸入的角色不同
      B: BN 隨機刪除一半中間單元，與 Dropout 角色相同
      C: BN 只修改最終預測標籤，與機率校準的角色相同
      D: BN 保證每個批次都有相同輸出，與資料排序無關
    answer: A
    explain:
      A: 原始輸入標準化與層間特徵調整發生在不同位置，兩者可以共存。
      B: 隨機遮蔽單元是 Dropout 的典型動作，BN 不以此運作。
      C: BN 作用於特徵張量，不是修改最終標籤的程序。
      D: 訓練時輸出依賴當批統計，批次組成可影響結果。
  - id: c2
    goal: g2
    type: choice
    prompt: 客服某特徵的四筆中間輸出為 1、3、5、7，BN 用這四筆作當批統計。均值與正規化所用變異依序為何？
    options:
      A: 均值 4、變異 20，因為平方離差直接相加
      B: 均值 4、變異 6.6667，因為當批分母固定為三
      C: 均值 4、變異 5，因為平方離差總和二十除以四
      D: 均值 16、變異 5，因為均值使用四筆數值總和
    answer: C
    explain:
      A: 平方離差總和二十還要除以批次筆數四。
      B: PyTorch 的當批正規化採分母四，移動變異更新才採不偏估計。
      C: 均值為四，平方離差九加一加一加九除以四得到五。
      D: 十六是總和，均值還要除以四。
  - id: c3
    goal: g2
    type: choice
    prompt: 四筆特徵為 1、3、5、7，訓練時計得均值 4、變異 5，γ=2、β=−1、ε=0.00001。第一筆訓練輸出約為何？
    options:
      A: "−1.3416"
      B: "−3.6833"
      C: "−2.2000"
      D: "−6.3666"
    answer: B
    explain:
      A: 這只有標準化，尚未乘二與減一。
      B: 二乘以一減四再除以根號五加 ε，最後減一，約為負 3.6833。
      C: 這把除以標準差誤算成除以變異五。
      D: 這相當於錯用 γ=4，沒有依給定縮放係數計算。
  - id: c4
    goal: g1
    type: choice
    prompt: 客服模型訓練時每批 4 筆，推論時改成每次 1 筆，使用預設會追蹤移動統計的 PyTorch BN。哪個安排合理？
    options:
      A: 維持 train 模式，以單筆重新估計變異並更新移動統計
      B: 維持 train 模式，以驗證標籤重新估計均值並更新縮放
      C: 設為 eval 模式，以單筆重新估計變異並覆寫移動統計
      D: 設為 eval 模式，以已存移動統計轉換且不再更新統計
    answer: D
    explain:
      A: 單筆特徵缺乏可靠的當批變異，這種二維輸入在訓練模式也可能被框架拒絕。
      B: BN 的均值來自中間特徵而非驗證標籤，推論也不應更新模型。
      C: 此設定的 eval 使用儲存統計，不以單筆重新估計或覆寫。
      D: 切換到推論統計能避免單筆重估，仍需確保已存統計代表訓練分布。
---

## 為什麼需要

訓練中前面層的權重會改變，中間特徵的尺度也會跟著變。Batch Normalization（批次正規化，BN）在層間調整中間輸出，有助於訓練穩定與收斂。

指引 3-27 將它列為穩定訓練策略。本頁先分清中間特徵的調整位置，再計算訓練與推論使用的統計。

指引 5-34 把 BN、適當初始化與殘差連接列為深層網路緩解梯度消失的手段。應搭配架構與訓練條件評估，不能只靠增加層數。

## 直覺

BN 先看中間特徵的中心與尺度，再調整數值。下圖用四筆兩特徵的教學資料，呈現這個層間動作。

![沿每個直欄的四筆樣本計算統計；推論改用已存統計，不能把兩個特徵混成一組。](figure:l23203-batch-normalization-statistics-axes)

:::supplement[來源：PyTorch BatchNorm1d 官方文件；Dive into Deep Learning 8.5]
圖示為二維張量：列是樣本、欄是特徵。訓練時使用當批統計並更新移動統計；推論通常使用儲存值，因此同一筆輸入在兩種模式下可能得到不同輸出。
:::

## 定義與公式

BN 是中間特徵的正規化層。它與在模型前處理原始資料不同，統計作用的位置與更新時機都要分清楚。

### 當批統計與仿射轉換（補充）

對二維輸入的每個特徵欄分別計算：

$$
\begin{aligned}
\mu_B&=\frac1n\sum_{i=1}^{n}x_i,\\
v_B&=\frac1n\sum_{i=1}^{n}(x_i-\mu_B)^2,\\
\hat{x}_i&=\frac{x_i-\mu_B}{\sqrt{v_B+\epsilon}},\\
y_i&=\gamma\hat{x}_i+\beta.
\end{aligned}
$$

$n$ 是批次樣本數，$i$ 是樣本索引，$x_i$ 是某一特徵值。$\mu_B$ 與 $v_B$ 為該欄當批均值與變異；每欄獨立計算，分母採 $n$。

$\epsilon>0$ 是加在變異上的小常數，避免除以零；$\hat{x}_i$ 是標準化值。$\gamma$ 與 $\beta$ 是該特徵可學習的縮放與平移參數，$y_i$ 是最終輸出。

加上 $\epsilon$ 後，標準化值的變異只是接近一。再乘 $\gamma$、加 $\beta$ 後，輸出也不必維持均值零、變異一。

### 移動統計與推論（補充）

本頁採 PyTorch、追蹤移動統計且 $n>1$ 的慣例：

$$
\begin{aligned}
\mu_r'&=(1-a)\mu_r+a\mu_B,\\
v_r'&=(1-a)v_r+a\frac{n}{n-1}v_B,\\
y_i^{\mathrm{eval}}&=\gamma\frac{x_i-\mu_r'}{\sqrt{v_r'+\epsilon}}+\beta.
\end{aligned}
$$

$\mu_r,v_r$ 是更新前的移動均值與變異，撇號表示更新後。$a$ 是新批次的權重，即此 API 的 `momentum`；$n/(n-1)$ 將當批變異轉為不偏估計後再更新移動變異。

$y_i^{\mathrm{eval}}$ 是更新後切到推論模式的輸出。Keras 的 `momentum` 是舊統計的權重，變異更新細節也不可直接套這組 PyTorch 式子。

## 算一次（補充）

共用資料指定醫療 M01–M04 的 4×2 中間激活如下。客服 S01–S04 另給相同矩陣，用來換景核對；這是給定的中間激活，不需要從原始特徵算出。

| 樣本 | 特徵 1 | 特徵 2 |
|---|---|---|
| 1 | 1 | 10 |
| 2 | 3 | 14 |
| 3 | 5 | 18 |
| 4 | 7 | 22 |

第一欄均值為 $(1+3+5+7)/4=4$，變異為 $(9+1+1+9)/4=5$。第二欄均值 16，變異 $(36+4+4+36)/4=20$。

指定 $\gamma=(2,0.5)$、$\beta=(-1,1)$、$\epsilon=0.00001$。第一筆的兩欄輸出為：

$$
\begin{aligned}
y_{1,1}&=2\frac{1-4}{\sqrt{5+0.00001}}-1\approx-3.683279,\\
y_{1,2}&=0.5\frac{10-16}{\sqrt{20+0.00001}}+1\approx0.329180.
\end{aligned}
$$

$y_{1,1}$、$y_{1,2}$ 分別是第一筆的兩個特徵輸出。其餘三筆沿各欄同一套統計轉換，程式會列出全部結果。

訓練前移動均值設為 $(2,12)$、移動變異為 $(4,16)$，新批權重 $a=0.25$。第一欄移動均值更新成 $0.75(2)+0.25(4)=2.5$。

第一欄移動變異更新成 $0.75(4)+0.25(4/3)(5)=14/3$。第二欄同算得均值 13、變異 $56/3$，所以移動統計尚未等於當批統計。

立刻切到推論，第一筆改用剛更新的移動統計：

$$
\begin{aligned}
y_{1,1}^{\mathrm{eval}}&=2\frac{1-2.5}{\sqrt{14/3+0.00001}}-1\approx-2.388729,\\
y_{1,2}^{\mathrm{eval}}&=0.5\frac{10-13}{\sqrt{56/3+0.00001}}+1\approx0.652818.
\end{aligned}
$$

兩式分別是第一筆兩欄的推論輸出，與當批訓練輸出不同。

## 程式（補充）

先用 NumPy 依公式核對當批輸出。沒有隨機抽樣，也不寫入模型權重。

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
b = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))["batch_norm"]
x = np.array(b["X"], dtype=float)
mu, v = x.mean(axis=0), x.var(axis=0)
y = np.array(b["gamma"]) * (x-mu) / np.sqrt(v+b["epsilon"]) + b["beta"]
print("均值/變異:", mu.tolist(), v.tolist())
print("訓練輸出:", np.round(y, 6).tolist())
```
```text
均值/變異: [4.0, 16.0] [5.0, 20.0]
訓練輸出: [[-3.683279, 0.32918], [-1.894426, 0.776393], [-0.105574, 1.223607], [1.683279, 1.67082]]
```

再用同一份資料測試 PyTorch 的訓練與推論。初值皆手動指定，BN 的預設仿射初始化不會引入隨機數。

```python
import json, os, torch
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
b = json.loads((root / "content/examples/L23203-B-activations.json").read_text(encoding="utf-8"))["batch_norm"]
x = torch.tensor(b["X"], dtype=torch.float64)
bn = torch.nn.BatchNorm1d(2, eps=b["epsilon"], momentum=b["momentum"]).double()
with torch.no_grad():
    bn.weight.copy_(torch.tensor(b["gamma"]))
    bn.bias.copy_(torch.tensor(b["beta"]))
    bn.running_mean.copy_(torch.tensor(b["initial_mean"]))
    bn.running_var.copy_(torch.tensor(b["initial_var"]))
bn.train()
y_train = bn(x)
bn.eval()
y_eval = bn(x)
print("訓練首筆:", [round(v, 6) for v in y_train[0].tolist()])
print("移動均值:", bn.running_mean.tolist())
print("移動變異:", [round(v, 6) for v in bn.running_var.tolist()])
print("推論首筆:", [round(v, 6) for v in y_eval[0].tolist()])
```
```text
訓練首筆: [-3.683279, 0.32918]
移動均值: [2.5, 13.0]
移動變異: [4.666667, 18.666667]
推論首筆: [-2.388729, 0.652818]
```

:::tip[讀碼重點]
NumPy 的 `axis=0` 沿樣本列計算每欄統計；`var` 預設分母為批次筆數。`eval()` 切換統計來源，並不關閉 Autograd；`no_grad()` 本身也不替 BN 切換模式。
:::

## 怎麼用、怎麼判讀

BN 對中間特徵做調整，以改善訓練穩定性。指引 4-81 則比較 BN 與 LayerNorm：後者不依賴批次大小，適合序列模型。

### 三種動作的分工（補充）

| 方法 | 作用位置 | 執行的動作 |
|---|---|---|
| 輸入標準化 | 模型前的原始特徵 | 用訓練集估計的固定尺度轉換 |
| BN | 網路中間特徵 | 當批或移動統計，加可學習縮放平移 |
| Dropout | 網路單元或表示 | 訓練時隨機遮蔽部分值 |

常見層間順序是線性層、BN、激活，再到下一層；具體架構也可能採其他順序。BN 不等於 Dropout，不能把它的主要用途寫成隨機刪除單元。

### 小批次與統計軸（補充）

批次太小或樣本高度相關時，當批統計可能不穩定。本例二維輸入若訓練批次只剩一筆，每欄無法取得有用的樣本間變異，框架也可能直接拒絕。

追蹤移動統計時，推論可用儲存值處理單筆二維輸入；分布改變後仍需檢查適用性。若設 `track_running_stats=False`，eval 也用當批統計，是本例以外的設定。

二維 BN 沿每個特徵欄的樣本計算；LayerNorm 則通常沿同一筆的特徵計算。卷積 BN 會把同通道的批次與空間位置一起納入，不能只憑樣本數一就一概斷言無法訓練。

### 換個場景

| 場景 | 使用或比較條件 | 判讀重點 |
|---|---|---|
| 深層網路訓練 | 中間特徵尺度隨更新改變 | 有助穩定，不保證必然加速 |
| 自然語言序列模型 | 與 LayerNorm 比較 | 留意批次依賴與統計軸 |
| 醫療中間表示（補充） | 四筆兩特徵的本例 | 兩欄分別算，不跨欄混合 |
| 客服單筆推論（補充） | 追蹤移動統計的 BN | 先切 eval，再用儲存值 |

## 常見誤解

- 「有輸入標準化就不可能需要 BN。」中間表示還會隨權重更新改變。（補充）
- 「BN 最終輸出一定均值零、變異一。」$\gamma$、$\beta$ 與 $\epsilon$ 都會改變這個結論。（補充）
- 「`no_grad()` 等於切換推論模式。」它控制梯度追蹤，不切換 BN 統計來源。（補充）
- 「BN 保證防止過擬合。」本頁的主要用途是訓練尺度與穩定性，泛化仍需驗證。（補充）

## 進階

### 不把歷史解釋當唯一原因

指引 4-81 在 LayerNorm 段落介紹內部協變偏移（ICS），並比較它與 BN 對批次大小的依賴。

:::supplement[來源：Santurkar 等，How Does Batch Normalization Help Optimization?]
原始 BN 研究以內部協變偏移解釋動機；後續研究指出優化地形的平滑也很重要。不能把「分布比較穩定」說成所有 BN 效益唯一且已證明的原因。
:::

### 參考來源

- 科目 3 指引 `guide-3:3-27`：支持中間輸出標準化、穩定訓練與收斂用途；未教公式及移動統計。
- 科目 3 指引 `guide-3:4-81`：支持序列場景與 LayerNorm 的批次依賴對比；統計軸細節為補充。
- 科目 3 指引 `guide-3:5-34`：支持為什麼需要中的深層網路梯度消失與訓練手段。
- [PyTorch BatchNorm1d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.BatchNorm1d.html)：支持當批與移動變異、公式、算一次、train/eval 程式與例外設定。
- [Keras BatchNormalization](https://keras.io/api/layers/normalization_layers/batch_normalization/)：支持定義與公式中的 `momentum` 慣例差別。
- [Dive into Deep Learning 8.5](https://d2l.ai/chapter_convolutional-modern/batch-norm.html)：支持統計軸、層間流程與和 Dropout 的區分；本頁模式切換依 PyTorch 官方 API，不照用書中簡化控制。
- [Santurkar 等，How Does Batch Normalization Help Optimization?](https://arxiv.org/abs/1805.11604)：支持進階的歷史解釋界線。

## 小結

- BN 調整中間特徵，有助訓練穩定與收斂。
- 每個特徵獨立計算統計，縮放與平移參數可以學習。（補充）
- 預設訓練用當批統計，推論用移動統計。（補充）
- 小批次、分布改變與模式設定都會影響結果。（補充）
