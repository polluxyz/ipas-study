---
id: model-pruning
title: 模型剪枝
kind: technique
codes: [L21302, L23304]
aliases: [Pruning, 結構化剪枝, 非結構化剪枝]
summary: 模型剪枝移除部分連線或單元，實際省多少取決於結構與執行方式
goals:
  - id: g1
    text: 比較通道剪枝與零散權重剪枝的參數、密集儲存和實際加速條件
requires: [model-resource-costs]
guide_refs: [guide-3:5-50, guide-3:5-51, guide-1:3-81]
formula_groups:
  - id: pruning-budget
    source: https://docs.pytorch.org/tutorials/intermediate/pruning_tutorial.html#global-pruning ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html ; https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 4→5→3 分類頭有 43 個 FP32 參數；只把第一層 8 個權重置零，仍用原形狀密集張量存檔。排除遮罩與檔頭後，容量是多少？
    options:
      A: 140 bytes；只需存下 35 個非零值
      B: 172 bytes；仍需存下 43 個數值位置
      C: 108 bytes；隱藏層已由 5 個單元變成 3 個
      D: 43 bytes；零值會把每個參數改成 8 位元
    answer: B
    explain:
      A: 這只有非零值的容量，密集格式仍儲存零的位置。
      B: 43×4＝172，置零本身沒有縮小張量形狀。
      C: 題目沒有移除隱藏單元，不能套用結構化後的容量。
      D: 剪枝不會自動改變數值精度。
  - id: c2
    goal: g1
    type: choice
    prompt: 同一分類頭移除 2 個隱藏單元及下一層對應輸入，變成 4→3→3，兩層都有偏置。參數與延遲應怎麼判斷？
    options:
      A: 共 33 個參數；第一層變小但第二層仍保留全部欄位
      B: 共 27 個參數；任何裝置上的延遲都必定同比例降低
      C: 共 35 個參數；只需扣除被移除單元的兩個偏置
      D: 共 27 個參數；形狀縮小後仍要在目標裝置量測延遲
    answer: D
    explain:
      A: 下一層對應輸入也應移除，不能保留失去來源的欄位。
      B: 參數數對，但資料搬移與算子效率使延遲不保證同比縮短。
      C: 移除單元還包含其輸入權重及下一層的相應權重。
      D: 兩層為 15 與 12 個參數，實際加速仍受硬體與實作影響。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

部署模型時，部分權重或單元可能對任務幫助不大。模型剪枝（Pruning）移除其中一部分，嘗試降低容量與運算需求，同時保留可接受的效果。

剪太多會傷害準確度。即使留下的非零權重變少，硬體也未必能把這種稀疏性轉成速度。

## 直覺

結構化剪枝（Structured pruning）以神經元、通道或層為單位刪除。非結構化剪枝（Unstructured pruning）則分散刪除個別連線。

前者比較容易形成較小的密集運算，後者需要能利用稀疏性的執行方式。

![整排移除會改變後續輸入寬度，零散置零則可能保留原矩陣形狀。](figure:l23304-model-pruning-patterns)

:::supplement[來源：PyTorch Pruning Tutorial；prune.remove API]
很多剪枝工具先用遮罩把數值變零，沒有真的縮小層。判斷是否結構化壓縮成功，要看匯出後的形狀，不能只看遮罩。
:::

## 定義與公式（補充）

有偏置的兩層密集網路，輸入 $d$ 維、隱藏 $h$ 個單元、輸出 $c$ 類：

$$
P=(d+1)h+(h+1)c,\qquad B=4P.
$$

$P$ 是全部權重與偏置的位置數，$B$ 是 FP32 原始密集容量，單位 bytes；每個數值 4 bytes。此式由前置頁的層參數計數相加，不包含檔頭、遮罩或稀疏索引。

依 PyTorch Linear 文件的權重與偏置形狀，兩層分別有 $dh+h$ 與 $hc+c$ 個值，相加整理便得到上式。

Tensor.nbytes 將密集張量容量定義為元素數乘每元素 bytes；FP32 每值 4 bytes，因此容量為 $4P$。這是依文件自行計數與換算，不是剪枝教學直接列出的容量公式。

若全部 $P$ 個原位置中有 $P_{\mathrm{nz}}$ 個非零值，稀疏率為：

$$
s=1-\frac{P_{\mathrm{nz}}}{P}.
$$

$s$ 越高代表零值越多；$P>0$ 才可相除。這是數值比例，不是壓縮率或延遲改善率。

## 算一次（補充）

沿用共用檔的 4→5→3 分類頭，$P=(4+1)5+(5+1)3=43$。固定張量原本沒有零值，因此基準是 43 個非零值、172 bytes。

非結構化版本只把第一層最小的 8 個權重置零。非零值剩 35，整體稀疏率為 $8/43\approx18.60\%$；第一層權重自己的稀疏率才是 $8/20=40\%$。

結構化版本保留 3 個隱藏單元，也移除下一層對應輸入。新的參數數為 $(4+1)3+(3+1)3=27$，FP32 原始容量為 108 bytes。

| 版本 | 第一層參數 | 第二層參數 | FP32 密集容量 |
|---|---|---|---|
| 原始 4→5→3 | 25 | 18 | 172 bytes |
| 零散置零 8 個 | 25 個位置 | 18 個位置 | 172 bytes |
| 改成 4→3→3 | 15 | 12 | 108 bytes |

稀疏格式可以只存非零值，但要加位置索引。這個小例子若用每值 4 bytes 加每索引 4 bytes，35 組就要 280 bytes，尚未計其他 metadata；稀疏不一定省空間。

## 程式（補充）

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

固定種子與張量；第一段以 PyTorch 置零並移除遮罩的重參數化，第二段真的裁出較小形狀。

```python
import json, os
from pathlib import Path
import torch
from torch.nn.utils import prune
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23304-E-compression.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
n = d['network']
layer = torch.nn.Linear(4, 5)
with torch.no_grad():
    layer.weight.copy_(torch.tensor(n['W1']))
prune.l1_unstructured(layer, 'weight', amount=d['pruning']['unstructured_remove_count'])
prune.remove(layer, 'weight')
print('第一層權重形狀:', tuple(layer.weight.shape))
print('第一層權重非零數:', int(torch.count_nonzero(layer.weight)))
print('第一層權重密集 bytes:', layer.weight.numel() * layer.weight.element_size())
```
```text
第一層權重形狀: (5, 4)
第一層權重非零數: 12
第一層權重密集 bytes: 80
```

```python
keep = d['pruning']['keep_hidden']
w1, w2 = torch.tensor(n['W1'])[keep], torch.tensor(n['W2'])[:, keep]
b1, b2 = torch.tensor(n['b1'])[keep], torch.tensor(n['b2'])
p = sum(t.numel() for t in (w1, b1, w2, b2))
print('結構化後兩層權重:', tuple(w1.shape), tuple(w2.shape))
print('參數數:', p, 'FP32 bytes:', p * 4)
print(f'零散置零後整體稀疏率={8 / 43:.2%}')
```
```text
結構化後兩層權重: (3, 4) (3, 3)
參數數: 27 FP32 bytes: 108
零散置零後整體稀疏率=18.60%
```

:::tip[讀碼重點]
`prune.remove` 把遮罩結果固定到權重，不會刪掉矩陣列。結構化示範同時切第一層的列、偏置及第二層的欄，才保持維度相容。
:::

## 怎麼用、怎麼判讀

裝置以密集算子為主時，優先評估能縮小形狀的方案。若硬體支援稀疏運算，還要確認它接受的稀疏模式；零值很多但模式不符，效益仍有限。

剪枝後須重查效果。可以和模型量化等方法搭配，但一次先改一項，才知道品質下降或延遲改變來自哪裡。

:::supplement[來源：PyTorch Pruning Tutorial；TensorFlow Pruning in Keras example]
可用訓練資料微調、驗證資料選剪枝程度，最後在保留測試集驗收。共用影像卡假設原始 20 ms、零散置零且用密集算子仍 20 ms、縮形後 16 ms；這些是教學假設，沒有當成硬體實測。
:::

### 換個場景

| 場景 | 條件 | 判讀重點 |
|---|---|---|
| 行動與 IoT 邊緣模型 | 儲存、能源、計算資源有限 | 剪後效果與裝置是否利用稀疏 |
| 法律摘要（補充） | 要保留專業事實與長文能力 | 微調後重查品質，不能只查參數 |
| 工業聲音警報（補充） | 依靠低延遲觸發動作 | 移除通道後量測完整前處理與推論 |

## 常見誤解

- 「剪一半就快一倍」：裝置支援與資料搬移仍影響速度。
- 「零散剪枝沒價值」：支援的稀疏格式與算子可帶來效益，但須實測。
- 「權重變零就自動縮檔」：密集格式仍保留零值位置，遮罩也有開銷。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-50`～`guide-3:5-51`：兩類剪枝、效果損失與稀疏硬體限制。
- 科目 1 指引 `guide-1:3-81`：邊緣多模態壓縮場景。
- [PyTorch 剪枝教學的 Global pruning](https://docs.pytorch.org/tutorials/intermediate/pruning_tutorial.html#global-pruning)：零值數除以總元素數的稀疏率計算，支持稀疏率公式與遮罩程式。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Linear.html)：權重與偏置形狀，支持兩層參數數的逐項推導。
- [PyTorch Tensor.nbytes](https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html)：密集張量的元素數乘每元素 bytes，支持容量換算與置零不縮檔的判讀。
- [prune.remove API](https://docs.pytorch.org/docs/2.15/generated/torch.nn.utils.prune.remove.html)：移除重參數化不會還原或縮小權重形狀，支持直覺與讀碼重點。
- [TensorFlow 剪枝教學](https://www.tensorflow.org/model_optimization/guide/pruning/pruning_with_keras)：從微調到匯出的教學流程與儲存處理，支持判讀節。

## 小結

- 結構化剪枝改單元或通道，非結構化剪枝改零散連線。
- 稀疏率、儲存量與延遲是三個不同結果。
- 剪枝後重查效果，在目標硬體確認加速是否成立。
