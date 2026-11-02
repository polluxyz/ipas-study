---
id: quantization
title: 模型量化
kind: technique
codes: [L23304, L21301, L21302]
aliases: [FP32, INT8, PTQ, QAT, model-quantization, 模型量化與邊緣加速, 量化感知訓練]
summary: 模型量化用較少位元表示數值，容量縮減與實際加速須分開驗收
goals:
  - id: g1
    text: 核算低精度容量，區分量化、剪枝、蒸餾與推論引擎的角色
  - id: g2
    text: 判斷量化誤差、硬體與算子支援，以及效果和延遲的驗收條件
  - id: g3
    text: 比較 PTQ、校準與 QAT 的資料需求、成本及效果下降處置
requires: [model-resource-costs]
guide_refs: [guide-3:5-51, guide-1:3-81]
formula_groups:
  - id: bit-storage
    source: https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23304-E
  - id: affine-quantization
    source: https://huggingface.co/docs/optimum/concept_guides/quantization
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 35 個權重由 FP32 改為 INT8，另有 8 個偏置仍為 FP32。排除尺度與檔頭，原始張量容量變為多少？
    options:
      A: 43 bytes，因為全部 43 個數值都已改成 INT8
      B: 140 bytes，因為偏置不需任何額外儲存空間
      C: 67 bytes，因為權重 35 bytes 加偏置 32 bytes
      D: 172 bytes，因為權重位元改變不影響儲存容量
    answer: C
    explain:
      A: 題目明定偏置仍用 FP32，不能把它當成一 byte。
      B: 140 是原來 35 個 FP32 權重的容量，也漏算偏置。
      C: 35×1＋8×4＝67，只對指定張量作容量盤點。
      D: 172 是全部用 FP32 的基準，改權重位元後會減少。
  - id: c2
    goal: g2
    type: choice
    prompt: 同裝置、batch=1 的教學卡：FP32 延遲 20 ms，INT8 若算子回退則 23 ms。哪個判斷合理？
    options:
      A: 權重可縮小，回退與轉換卻可能使延遲增加
      B: 權重可縮小，所以 23 ms 必然是計時單位錯誤
      C: 延遲有增加，所以 INT8 每個值仍占 32 位元
      D: 延遲有增加，所以更換校準資料必然加速成功
    answer: A
    explain:
      A: 位元容量與執行效能不同，算子支援和轉換都有影響。
      B: 缺乏原生低精度路徑時，縮小權重不保證加速。
      C: 速度不能反推每個數值的儲存位元。
      D: 校準主要影響數值範圍與誤差，不能補上缺失的硬體算子。
  - id: c3
    goal: g3
    type: choice
    prompt: 60 筆影像已固定為訓練 36、驗證 12、測試 12；要做靜態 INT8 PTQ。哪個資料安排合適？
    options:
      A: 用最後 12 筆測試資料選尺度，再用同批資料挑效果最佳方案
      B: 用最前 12 筆訓練資料當測試，把原測試資料改作 QAT 微調
      C: 用最後 12 筆測試資料做微調，把訓練資料改成最終驗收集
      D: 用具代表性的訓練子集校準，用驗證集選方案並保留測試集
    answer: D
    explain:
      A: 用測試資料調整尺度與方案會污染最終驗收。
      B: 這改變既定切分，也把保留測試資料拿來訓練。
      C: 最終測試資料不應用於微調，重新命名不能消除洩漏。
      D: 校準、選方案與最終驗收分工明確，仍須檢查子集代表性。
  - id: c4
    goal: g3
    type: choice
    prompt: 靜態 PTQ 後準確率未達 90% 門檻，已確認校準涵蓋正常與罕見輸入；團隊可再訓練。哪個處置合理？
    options:
      A: 只把檔名由 INT8 改成 FP32，再保留相同權重直接釋出
      B: 訓練時模擬量化誤差微調，再轉換並重新驗收效果與延遲
      C: 只把整體準確率門檻改成 80%，再沿用原有測試報告釋出
      D: 訓練時刪掉所有量化誤差，再假定轉換後結果完全不變
    answer: B
    explain:
      A: 重新命名不會恢復已丟失的數值資訊。
      B: QAT 讓模型在訓練時適應模擬誤差，轉換後仍要驗證。
      C: 降低需求不等於解決品質問題，也不能沿用舊結論。
      D: 量化誤差不會因為訓練時忽略它而消失。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

邊緣設備可能有足夠的模型效果，卻放不下權重或無法即時回應。模型量化（Quantization）以低精度格式表示數值，例如把 32 位元浮點數（FP32）改成 8 位元整數（INT8）。

位元變少可減少儲存與搬移負擔；支援低精度的硬體還可能加速。代價是量化誤差，可能降低預測表現，而且各層受影響不同。

## 直覺

原來可以表達很細差距的數值，改放到較少的格點上。接近的值可能落在同一格，超出範圍的值也可能擠到邊界。

![FP32 與 INT8 每個數值的位元預算不同；少位元的表示會失去部分細節。](figure:l23304-quantization-precision)

| 方法 | 主要改什麼 | 部署前要查什麼 |
|---|---|---|
| 模型量化 | 每個數值的表示精度 | 誤差與低精度硬體支援 |
| 模型剪枝 | 部分連線、通道或層 | 剪後效果與稀疏支援 |
| 知識蒸餾 | 訓練另一個學生模型 | 學生效果與建置成本 |
| 推論引擎，如 TensorRT、OpenVINO | 優化推論執行 | 相容性及端到端延遲 |

科目 1 指引介紹這些部署方向；上表把角色並列。

:::supplement[來源：NVIDIA TensorRT Architecture Overview]
推論引擎可用算子融合與硬體映射改善執行，也能搭配量化模型。
:::

## 定義與公式（補充）

### 位元換容量

若 $N$ 個值都用 $b$ 位元密集儲存，原始容量為：

$$
B=N\frac{b}{8}.
$$

$B$ 單位是 bytes，8 bits 為 1 byte。這只計數值，排除尺度、零點、檔頭、激活和工作區；不同格式的張量要分開加總。

Tensor.nbytes 定義容量為元素數乘每元素 bytes。此處元素數為 $N$，每元素由 $b$ bits 換算成 $b/8$ bytes，便得到上式。

### 對稱格點的例子

一般仿射量化可寫為：

$$
q=\operatorname{clip}\!\left(\operatorname{round}(w/s)+z,q_{\min},q_{\max}\right),\qquad
\hat w=s(q-z).
$$

$w$ 是原值，$s>0$ 是尺度，$z$ 是整數零點，$q$ 是儲存的整數，$\hat w$ 是還原近似值。`round` 取最近整數，`clip` 將超界值限制在 $q_{\min}$ 到 $q_{\max}$。

本頁採對稱教學格點 $[-127,127]$，$z=0$、$s=1/127$，沒有使用 INT8 的 -128 格。未飽和時只有捨入誤差；超過範圍時，截斷誤差可能大得多。

## 算一次（補充）

共用分類頭 4→5→3 有 35 個權重、8 個偏置，合計 43 個參數。原本全部 FP32，原始容量為 $43\times32/8=172$ bytes。

| 儲存假設 | 權重容量 | 偏置容量 | 合計 |
|---|---|---|---|
| 全部 FP32 | 35×4＝140 | 8×4＝32 | 172 bytes |
| 權重 INT8、偏置 FP32 | 35×1＝35 | 8×4＝32 | 67 bytes |
| 全部皆 INT8 的理想盤點 | 35 | 8 | 43 bytes |

只有「全部值都能同樣換格式」才從 172 變 43 bytes。實際偏置、尺度或部分敏感層可能使用較高精度，完整模型大小與峰值記憶體不能直接除以四。

取 $w=0.49$，乘 127 後取最近整數得 62。還原為 $62/127\approx0.488189$，絕對誤差約 0.001811。

若表示範圍只設為 [-1,1]，原值 $w=1.5$ 會飽和為 127，還原為 1，誤差成為 0.5。校準範圍不具代表性時，只看一般值的微小誤差會低估風險。

## 程式（補充）

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

程式核算位元容量與捨入，不是匯出完整量化模型；同頁兩段接續執行。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23304-E-compression.json').read_text(encoding='utf-8'))
np.random.seed(d['seed'])
layers = d['teacher_layers']
weights = sum(r['input'] * r['output'] for r in layers)
biases = sum(r['output'] for r in layers if r['bias'])
print('權重／偏置:', weights, biases)
print('全部 FP32 bytes:', (weights + biases) * 4)
print('權重 INT8、偏置 FP32 bytes:', weights + biases * 4)
print('全部 INT8 理想 bytes:', weights + biases)
```
```text
權重／偏置: 35 8
全部 FP32 bytes: 172
權重 INT8、偏置 FP32 bytes: 67
全部 INT8 理想 bytes: 43
```

```python
r = d['quantization']
w = np.array(r['probe_weights'])
q = np.clip(np.rint(w / r['scale']) + r['zero_point'], r['qmin'], r['qmax']).astype(np.int8)
restored = r['scale'] * (q.astype(np.float64) - r['zero_point'])
print('整數:', q.tolist())
print('還原:', np.round(restored, 6).tolist())
print('絕對誤差:', np.round(np.abs(w - restored), 6).tolist())
```
```text
整數: [-127, -65, 4, 62, 127, 127]
還原: [-1.0, -0.511811, 0.031496, 0.488189, 1.0, 1.0]
絕對誤差: [0.0, 0.001811, 0.001496, 0.001811, 0.0, 0.5]
```

:::tip[讀碼重點]
先 `clip` 再轉 INT8，避免超界整數轉型造成錯誤。探針值只展示誤差機制，不可由它推算模型準確率。
:::

## 怎麼用、怎麼判讀

量化感知訓練（Quantization-aware training，QAT）讓模型在訓練時適應量化誤差。硬體支援與各層敏感性仍會影響結果，不能保證完全沒有損失。

### PTQ、校準與 QAT（補充）

訓練後量化（Post-training quantization，PTQ）從既有浮點模型轉換，不先重訓。靜態整數量化用代表性資料估激活範圍；動態或只轉權重時，需求不同。

![PTQ 用代表性資料估範圍，QAT 多了模擬誤差的訓練；兩條路最後都要轉換與驗收。](figure:l23304-quantization-ptq-qat)

| 路徑 | 資料與處理 | 額外成本 |
|---|---|---|
| 靜態 PTQ | 代表性輸入校準範圍，通常不需標籤 | 執行校準與轉換 |
| QAT | 訓練時模擬量化，通常用有標籤訓練資料微調 | 反向傳播與再訓練 |
| 保留測試集 | 方案定案後檢查效果與延遲 | 不拿來調尺度或微調 |

共用影像僅以訓練索引 0–11 示範校準；實務還須涵蓋罕見亮度、類別與輸入範圍。12 筆是教學縮例，不能當成通用需求。

若效果下降，先查前處理、校準代表性與飽和，再以驗證集評估保留部分高精度或 QAT。QAT 通常使用浮點權重模擬誤差，仍須轉換成部署模型。

### 驗收表（補充）

| 要查的項目 | 固定條件 | 通過依據 |
|---|---|---|
| 預測品質 | 同測試索引、同前處理 | 準確率或任務品質仍達門檻 |
| 服務延遲 | 同裝置、batch、輸入尺寸及長度 | 暖機、同步計時後查中位數及尾端 |
| 執行路徑 | 相同執行期與算子設定 | 原生低精度，沒有意外回退 |
| 記憶體 | 同部署配置 | 分別量權重檔與執行峰值 |

共用卡假設影像單筆從 20 ms 變 12 ms，速度比是 20/12，約 1.67 倍；若算子回退變 23 ms，反而較慢。這些是教學假設；批次吞吐用筆／秒另量，不能把毫秒當吞吐。

### 換個場景

| 場景 | 條件 | 判讀重點 |
|---|---|---|
| 邊緣多模態、行動影像 | 資源受限、NPU 或 Edge TPU 支援低精度 | 位元容量、支援層與預測效果 |
| 法律摘要（補充） | 文字長度與生成長度會變 | 固定長度條件，重查事實與單篇延遲 |
| 零售需求預測（補充） | 大量批次、吞吐優先 | 查批次吞吐及小幅數值誤差的業務影響 |

## 常見誤解

- 「量化後一定快四倍」：每值位元數不等於運算時間。
- 「QAT 一定恢復全部效果」：只能改善適應程度，仍要驗收。
- 「少數探針誤差小就能釋出」：局部誤差無法取代任務品質評估。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-51`：低精度、硬體加速、逐層敏感性與 QAT；科目 1 指引 `guide-1:3-81`：邊緣壓縮與推論引擎。
- [Hugging Face 量化概念](https://huggingface.co/docs/optimum/concept_guides/quantization)：位元表示、仿射量化與硬體條件，支持公式及數值核算。
- [PyTorch Tensor.nbytes](https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.nbytes.html)：密集張量的元素數乘每元素 bytes，支持位元容量式的單位換算。
- [Google LiteRT PTQ 教學](https://developers.google.com/edge/litert/conversion/tensorflow/quantization/post_training_quantization)：不同 PTQ 路徑與代表性校準，支持流程及資料需求。
- [TensorFlow QAT 概覽](https://www.tensorflow.org/model_optimization/guide/quantization/training)：模擬量化與部署轉換，支持 QAT 說明。
- [TensorFlow QAT 完整教學](https://www.tensorflow.org/model_optimization/guide/quantization/training_comprehensive_guide)：微調與選層量化，支持效果下降處置。
- [NVIDIA TensorRT 架構概觀](https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/architecture-overview.html)：推論引擎的編譯與執行角色，支持方法對照。

## 小結

- 位元改變能省數值容量，效果與加速仍須驗證。
- 量化、剪枝、蒸餾與推論引擎各自改變不同環節。
- 靜態 PTQ 校準範圍，QAT 模擬誤差再訓練；最終測試資料須保留。（補充）
