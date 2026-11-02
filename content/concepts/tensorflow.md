---
id: tensorflow
title: TensorFlow 的執行與部署
kind: tool
codes: [L23203]
aliases: [Eager Execution, TensorFlow Serving]
summary: TensorFlow 提供張量運算與多平台工具，連接模型開發和部署
requires: [deep-learning]
guide_refs: [guide-3:4-90]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 區分早期圖模式、即時執行與各平台生態工具的用途
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工程師用 TensorFlow 2 檢查客服模型中間張量，再把穩定的運算包成 tf.function。哪個理解正確？
    options:
      A: 一般操作可即時求值，tf.function 可把適合的運算追蹤成圖
      B: 一般操作只建立靜態圖，tf.function 才能第一次算出張量
      C: 一般操作無法計算梯度，tf.function 才會啟用自動微分
      D: 一般操作只適用於 CPU，tf.function 才能使用 GPU 運算
    answer: A
    explain:
      A: TensorFlow 2 預設即時執行，tf.function 提供圖執行的路徑。
      B: 這把早期先建圖再執行的模式套在 TensorFlow 2 的預設行為上。
      C: 即時模式也能用 GradientTape 求梯度，不以 tf.function 為前提。
      D: 即時與圖模式都可使用支援的硬體，不能這樣區分 CPU 和 GPU。
  - id: c2
    goal: g1
    type: choice
    prompt: 客服系統要經伺服器 API 提供模型推論，另一個製造展示頁要在瀏覽器執行。對應指引生態工具，哪個配對合理？
    options:
      A: 客服用 TensorFlow.js；瀏覽器用 TensorFlow Serving
      B: 客服用 TensorFlow Lite Micro；瀏覽器用 TensorFlow Serving
      C: 客服用 TensorFlow Serving；瀏覽器用 TensorFlow.js
      D: 客服用 TensorFlow Serving；瀏覽器用 TensorFlow Lite Micro
    answer: C
    explain:
      A: Serving 服務伺服器推論，TensorFlow.js 才是 JavaScript 生態工具。
      B: Lite Micro 定位微控制器，Serving 也不是瀏覽器執行工具。
      C: 伺服器服務與瀏覽器推論是兩種部署環境，這個配對符合用途。
      D: 前半合理，但 Lite Micro 不是此處瀏覽器需求的對應工具。
---

## 為什麼需要

模型開發時要方便看中間結果，上線時則要考慮硬體、執行環境與服務接口。TensorFlow 連接張量計算、模型建構與不同平台的部署工具。

同一套數學模型，不代表能直接在所有平台使用。部署規劃要先問運算在哪裡執行，再選相應工具。

## 直覺

開發模式回答「現在怎麼執行這個運算」，部署工具回答「交給哪個環境提供推論」。兩個問題可以分開決定。

![先選執行方式，再依伺服器、瀏覽器或裝置分流；選擇工具後仍需做相容性驗證。](figure:l23203-tensorflow-execution-deployment)

## 定義與公式

| 執行方式 | 怎麼工作 | 開發特性 |
|---|---|---|
| 早期圖模式 | 先描述運算，再送資料執行 | 可由整體圖做優化 |
| TensorFlow 2 即時執行 | 呼叫操作就取得結果 | 便於逐步檢查與除錯 |
| `tf.function`（補充） | 追蹤適合的函式形成圖 | 重用圖並減少部分 Python 開銷 |

:::supplement[來源：TensorFlow Better performance with tf.function]
即時執行（Eager Execution）與圖執行可在同一程式共存。`tf.function` 不保證每次都更快；追蹤有成本，輸入形狀或型別變動也可能觸發新的圖。
:::

### 硬體與部署用途

| 環境或工具 | 主要用途 | 要先確認 |
|---|---|---|
| CPU／GPU／TPU | 執行受支援的計算 | 硬體、驅動與運算支援 |
| TensorFlow Serving | 伺服器上的模型服務 | 模型接口與部署版本 |
| TensorFlow.js | JavaScript、網頁環境 | 模型轉換與瀏覽器環境 |
| Lite／Lite Micro | 行動、邊緣及微控制器 | 裝置資源與運算支援 |
| TFX | 機器學習流程管理 | 資料、訓練與發布流程 |

:::supplement[來源：Google AI Edge LiteRT]
指引用 TensorFlow Lite 與 Lite Micro 的名稱。現行端側推論文件也使用 LiteRT；閱讀時先對應「端側推論」定位，再核對實際版本和裝置支援，不把改名當成模型必須重訓。
:::

## 走一次流程（補充）

共用客服輸入為每筆四維、輸出為三類 logits；製造影像則為每張 8×8×3。先固定這些接口，再討論部署地點。

1. 開發時先用即時執行，核對客服的 N×4 輸入得到 N×3 輸出。
2. 把可重用的運算用 `tf.function` 包裝，確認圖與即時結果一致。
3. 客服若由伺服器 API 提供推論，評估 TensorFlow Serving。
4. 製造展示若在瀏覽器運作，評估 TensorFlow.js 的轉換與算子支援。
5. 若搬到產線裝置，改查端側工具、記憶體與延遲預算，另做相容性驗證。

## 程式（補充）

本段在 TensorFlow 2.21.0 實測，使用 CPU。

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

run-code 會切換暫存目錄，也須保留這項設定。

這段只核對同一客服資料的即時與圖執行結果，不啟動服務。固定非零權重，先手算首筆結果，再比較兩種模式；若讀錯資料或改錯運算，斷言就能檢出。

```python
import json, os
from pathlib import Path
import tensorflow as tf
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-C-frameworks.json').read_text(encoding='utf-8'))
x = tf.constant([r['x'] for r in d['service']['rows']],dtype=tf.float32)
w = tf.reshape(tf.range(1,13,dtype=tf.float32),(4,3)) / 10
def eager(a):
    return tf.matmul(a,w)
graph = tf.function(eager,input_signature=[tf.TensorSpec([None,4],tf.float32)])
a, b = eager(x), graph(x)
tf.debugging.assert_near(a,b,atol=1e-6)
tf.debugging.assert_near(a[0],tf.constant([0.1,0.2,0.3]),atol=1e-6)
tf.debugging.assert_positive(tf.reduce_max(tf.abs(a)))
print('即時執行:', tf.executing_eagerly())
print('形狀:', tuple(a.shape), tuple(b.shape))
print('首筆輸出:', [round(float(v),3) for v in a[0]])
print('結果相近:', bool(tf.reduce_all(tf.abs(a-b) < 1e-6)))
```
```text
即時執行: True
形狀: (18, 3) (18, 3)
首筆輸出: [0.1, 0.2, 0.3]
結果相近: True
```

:::tip[讀碼重點]
`TensorSpec([None,4],...)` 固定四維特徵而容許批次變動。首筆 [1,0,0,0] 選出權重首列 [0.1,0.2,0.3]。

這段只核對本例輸出，沒有量測效能，不能由此宣稱圖模式較快。
:::

## 怎麼用、怎麼判讀

開發除錯時可先採即時執行。需要重用穩定運算或匯出服務時，再考慮圖與部署接口；伺服器、網頁、端側的工具職責不同。

### 換個場景

| 場景 | 工具方向 | 判讀重點 |
|---|---|---|
| 生產模型服務 | TensorFlow Serving | 以服務接口供應推論 |
| 網頁 | TensorFlow.js | 運算在 JavaScript 環境 |
| 行動與 IoT | Lite／Lite Micro | 裝置與算子受限制 |
| 金融批次評分（補充） | CPU 或 GPU | 用實測吞吐選硬體 |
| 醫療流程管理（補充） | TFX | 訓練發布流程與版本一致 |

## 常見誤解

- 「TensorFlow 一定先建完整靜態圖才能跑」：這是早期主要模式，TensorFlow 2 預設即時執行。
- 「Serving 負責把模型放到瀏覽器運算」：它提供伺服器服務，網頁生態另看 TensorFlow.js。
- 「支援 GPU 就保證比 CPU 快」：還需同工作負載實測資料傳輸與計算成本。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-90`：早期圖模式、即時執行、硬體與部署工具。
- [TensorFlow tf.function 指南](https://www.tensorflow.org/guide/function)：即時與圖共存、追蹤及形狀契約。
- [TensorFlow 初學教學](https://www.tensorflow.org/tutorials/quickstart/beginner)：依序檢查輸出、損失和訓練的教學思路；本頁不下載其資料集。
- [TensorFlow Serving](https://www.tensorflow.org/tfx/guide/serving)、[TensorFlow.js](https://www.tensorflow.org/js/guide)：伺服器與 JavaScript 定位。
- [Google AI Edge LiteRT](https://ai.google.dev/edge/litert)：現行端側工具名稱與定位。

## 小結

- 執行方式與部署環境是兩個選擇。
- TensorFlow 2 預設即時執行，也可使用圖。（補充）
- CPU、GPU、TPU 和網頁、端側工具各有適用條件。
- 模型轉換後仍要核對輸入輸出與結果。（補充）
