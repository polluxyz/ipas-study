---
id: keras
title: Keras 的模組化建模
kind: tool
codes: [L23203]
aliases: [Sequential, model.summary, tf.keras]
summary: Keras 用可組合的模組描述網路，並設定與執行訓練
requires: [output-loss-contract, mlp]
guide_refs: [guide-3:4-90, guide-3:4-91]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 分辨層、激活、損失與優化器，說明 compile、fit 和後端的角色
  - id: g2
    text: 手算 Dense 參數數並對照 summary，驗證輸入輸出形狀
formula_groups:
  - id: dense-parameters
    source: https://keras.io/api/layers/core_layers/dense/
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊完成 4→5→3 的客服模型後，只呼叫 compile 設定 SGD 與損失，尚未提供資料。此時最合理的說法是？
    options:
      A: compile 已讀完 12 筆訓練資料，fit 只負責列印每輪結果
      B: compile 已完成全部權重更新，fit 只負責保存最後的權重
      C: compile 已設定訓練規則，fit 才依資料進行批次權重更新
      D: compile 已計算驗證集損失，fit 才建立輸入與輸出層結構
    answer: C
    explain:
      A: compile 沒有收到訓練資料，不能替 fit 走完訓練。
      B: 設定優化器不等於已依資料算梯度並更新權重。
      C: compile 決定損失與優化方式，fit 接資料後執行訓練。
      D: 結構由建模步驟定義，驗證損失也要實際提供驗證資料才算。
  - id: c2
    goal: g2
    type: choice
    prompt: 4 維輸入接 Dense(5) 再接 Dense(3)，兩層均含偏置。第一層、第二層與總參數數是哪一組？
    options:
      A: 第一層 25，第二層 18，合計 43
      B: 第一層 20，第二層 15，合計 35
      C: 第一層 25，第二層 15，合計 40
      D: 第一層 24，第二層 20，合計 44
    answer: A
    explain:
      A: 第一層有 4×5＋5，第二層有 5×3＋3，合計 43。
      B: 這只計矩陣權重，漏掉兩層各輸出節點的偏置。
      C: 第一層正確，但第二層漏掉三個偏置。
      D: 偏置應按輸出維度計數，不能按輸入維度加。
---

## 為什麼需要

Keras 是高階神經網路 API，讓層、激活函數、損失與優化器各自有明確接口。更換其中一個模組，就能測試不同組合，適合快速建立原型。

## 直覺

客服向量先通過隱藏層，再交給三類輸出層。層決定資料如何轉換；激活函數加入非線性；損失比較答案；優化器更新參數。

![客服資料沿單一路徑由四維變成五維再到三類；訓練規則在 compile 設定，fit 才接資料執行。](figure:l23203-keras-modules)

## 定義與公式

| 模組 | 負責的事 | 本例 |
|---|---|---|
| 層 | 計算新的表示 | 兩個 Dense |
| 激活函數 | 對層輸出做轉換 | 隱藏層 ReLU |
| 損失函數 | 比較預測與標籤 | 多類交叉熵 |
| 優化器 | 依梯度改參數 | SGD |

### 建模與訓練接口（補充）

先把架構和訓練規則分開，讀程式時就能判斷一行改的是模型表示、誤差算法，還是參數更新方式。

`Sequential` 適合單輸入、單輸出的直線堆疊。多輸入、分支或共享層，通常改用 Functional API；直線指路徑，並非運算都線性。

`compile` 設定損失、優化器及監測指標；`fit` 接資料反覆訓練。`summary` 列結構與參數，不能直接證明分類品質。

對輸入維度 $d$、輸出節點數 $h$ 的 Dense，若每個輸出含一個偏置：

$$
P=dh+h=(d+1)h.
$$

$P$ 是可學習參數數；$d,h$ 均為正整數。依 Dense 官方文件的 kernel 與 bias 形狀計數，權重有 $d\times h$ 個，偏置有 $h$ 個。

兩者相加推得上式；批次有幾筆不影響數量。

### 版本與後端

指引介紹 TensorFlow 2 整合的 `tf.keras`，也提到 Keras 曾支援多後端。這是理解指引版本背景的線索。

:::supplement[來源：Keras 3 Multi-backend deep learning]
Keras 3 支援 TensorFlow、JAX、PyTorch 後端，另有僅供推論的 OpenVINO 後端。本頁實測 Keras 3.15.1 搭配 TensorFlow 2.21.0。
:::

## 算一次（補充）

共用客服資料共 18 筆，每筆四維。索引 0–11 是訓練集，12–14 是驗證集，15–17 是最後測試集，本例訓練不讀測試集。

第一層代入 $d=4,h=5$，得 $(4+1)\times5=25$；第二層代入 $d=5,h=3$，得 $(5+1)\times3=18$。總參數為 43，與模型摘要逐層對照。

| 階段 | 一批輸出形狀 | 參數 |
|---|---|---|
| 輸入 | N×4 | 0 |
| Dense＋ReLU | N×5 | 25 |
| Dense logits | N×3 | 18 |

$N$ 是本批樣本數；摘要中的 `None` 表示這個維度可變。增加批次大小會改變張量大小，不會複製一套新權重。

## 程式（補充）

本段在 Keras 3.15.1、TensorFlow 2.21.0 後端實測，使用 CPU。

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

run-code 會切換暫存目錄，也須保留這項設定。

以下兩段接續執行，直接讀共用 JSON。先看訓練前的摘要，避免把後來建立的優化器狀態混進模型參數。

```python
import json, os
from pathlib import Path
import numpy as np
import keras
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-C-frameworks.json').read_text(encoding='utf-8'))
keras.utils.set_random_seed(d['seed'])
x = np.array([r['x'] for r in d['service']['rows']], dtype='float32')
y = np.array([r['label'] for r in d['service']['rows']], dtype='int32')
model = keras.Sequential([keras.Input((4,)), keras.layers.Dense(5,activation='relu',name='hidden'), keras.layers.Dense(3,name='head')], name='service')
model.summary(line_length=54)
print('摘要核對:', [(l.name,l.count_params()) for l in model.layers])
print('總參數與輸出:', model.count_params(), tuple(model(x).shape))
```
```text
Model: "service"
┌───────────────────────┬─────────────────┬──────────┐
│ Layer (type)          │ Output Shape    │  Param # │
├───────────────────────┼─────────────────┼──────────┤
│ hidden (Dense)        │ (None, 5)       │       25 │
├───────────────────────┼─────────────────┼──────────┤
│ head (Dense)          │ (None, 3)       │       18 │
└───────────────────────┴─────────────────┴──────────┘
 Total params: 43 (172.00 B)
 Trainable params: 43 (172.00 B)
 Non-trainable params: 0 (0.00 B)
摘要核對: [('hidden', 25), ('head', 18)]
總參數與輸出: 43 (18, 3)
```

```python
model.compile(optimizer=keras.optimizers.SGD(0.05),loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True))
before = [v.numpy().copy() for v in model.trainable_weights]
t, v = d['split']['train'], d['split']['validation']
history = model.fit(x[t],y[t],validation_data=(x[v],y[v]),epochs=1,batch_size=4,shuffle=False,verbose=0)
changed = any(not np.array_equal(a,b.numpy()) for a,b in zip(before,model.trainable_weights))
print('訓練／驗證筆數:', len(t), len(v))
print('權重已更新:', changed, '有限損失:', bool(np.isfinite(history.history['loss']).all()))
```
```text
訓練／驗證筆數: 12 3
權重已更新: True 有限損失: True
```

:::tip[讀碼重點]
`summary` 的兩層參數可與 `count_params()` 互相核對。輸出層未放 Softmax，所以損失明確用 `from_logits=True`。
:::

## 怎麼用、怎麼判讀

Keras 適合想快速替換模組、驗證架構的團隊。先看每層輸出維度，再核對參數與損失；摘要能查形狀，不能代替驗證資料上的評估。

:::supplement[來源：Keras Sequential model；Training & evaluation with the built-in methods]
Keras 與 PyTorch 頁固定同一種子、資料和切分，但初始化規則不同；相同種子不保證兩框架同一權重。本組只核對形狀與訓練流程，不用損失數字判定哪個框架較好。
:::

### 換個場景

| 場景 | 資料或開發條件 | 判讀重點 |
|---|---|---|
| 快速原型 | 反覆換層、激活或損失 | 模組接口須相容 |
| 製造影像（補充） | 18 張 8×8×3 | 輸入形狀改了，Dense 計數也可能改 |
| 金融風險（補充） | 多個輸入分支 | 改看 Functional API 是否合適 |
| 客服路由（補充） | 四維向量、三類單選 | 每筆輸出三個 logits |

## 常見誤解

- 「compile 會把資料訓練一次」：它設定訓練規則，fit 才接資料。（補充）
- 「參數等於輸入數乘輸出數」：有偏置時還要加輸出數。（補充）
- 「模型可組合就表示任意模組都相容」：仍要核對張量形狀與任務語意。

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-90`、`guide-3:4-91`：模組化、高階 API、原型開發與歷史後端。
- [Keras Sequential model](https://keras.io/guides/sequential_model/)：單一路徑限制、建模與摘要示例。
- [Keras Dense](https://keras.io/api/layers/core_layers/dense/)：kernel、bias 的運算與形狀；正文依元素數推得參數計數式。
- [Keras Training & evaluation](https://keras.io/guides/training_with_built_in_methods/)：compile、fit 與驗證資料的分工。
- [Keras 3](https://keras.io/keras_3/)：現行多後端定位。

## 小結

- 層、激活、損失與優化器各自負責一部分。
- compile 設規則，fit 執行訓練。（補充）
- Dense 的偏置數等於輸出節點數。（補充）
- 摘要與實際輸出形狀要相互核對。（補充）
