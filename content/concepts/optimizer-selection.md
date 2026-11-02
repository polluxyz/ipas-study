---
id: optimizer-selection
title: 優化器選擇
kind: technique
codes: [L23304, L23103, L23203]
aliases: [Optimizer, 優化器比較]
summary: 依梯度特性、驗證表現與狀態記憶體選優化器，沒有通用贏家
goals:
  - id: g1
    text: 依梯度特性與狀態記憶體比較四種優化器，並說明選用限制
requires: [adagrad, adam]
guide_refs: [guide-3:5-37, guide-3:5-38, guide-3:5-39, guide-3:5-40, guide-3:5-41, guide-3:5-42]
formula_groups:
  - id: optimizer-state-memory
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adam.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某客服分類器有100萬個FP32參數，只剩6 MB可存優化器狀態，不含權重、梯度及工作區。以下哪個敘述正確？
    options:
      A: Adam保存兩份等長狀態，共4 MB，因此符合6 MB上限
      B: 動量法保存一份等長狀態，共4 MB，因此符合6 MB上限
      C: Adagrad保存兩份等長狀態，共8 MB，因此超過6 MB上限
      D: 基本SGD保存一份等長狀態，共4 MB，因此符合6 MB上限
    answer: B
    explain:
      A: 兩份100萬個FP32值共8 MB，超過預算。
      B: 動量向量需100萬乘4位元組，即4 MB。
      C: 基本Adagrad保存一份平方累積，共4 MB。
      D: 無動量的基本SGD沒有等長歷史狀態。
  - id: c2
    goal: g1
    type: choice
    prompt: 能源模型的梯度連續12輪震盪；客服模型有稀疏詞特徵。團隊固定資料切分後，要選兩個優先比較的候選，哪項理由合理？
    options:
      A: 能源先試Adagrad以平均歷史方向，客服先試SGD以保證稀疏特徵收斂
      B: 能源先試Adam以免調整學習率，客服先試動量法以保證每詞相同步長
      C: 能源先試SGD以消除梯度噪聲，客服先試Adam以保證找到全域最低點
      D: 能源先試動量法以平滑方向，客服先試Adagrad並監看後期步長
    answer: D
    explain:
      A: Adagrad累積平方尺度，不是方向平均，SGD也沒有此收斂保證。
      B: Adam仍需設定學習率，動量法也不保證所有特徵相同步長。
      C: SGD不會消除噪聲，Adam也不保證非凸全域解。
      D: 方向累積與逐參數縮放各有用途，仍需用驗證確認效果。
  - id: c3
    goal: g1
    type: choice
    prompt: 兩步固定梯度重播後Adam的參數是[0.8600,-1.1932]，SGD是[0.8,-1.6]，尚未評估任何留樣。哪個結論成立？
    options:
      A: 兩者更新規則有差別，還需同預算訓練與留樣驗證
      B: Adam的移動距離較短，已證明其驗證準確率較高
      C: SGD的移動距離較長，已證明其訓練損失較低
      D: 兩組參數都已算出，因此兩者皆達全域最小值
    answer: A
    explain:
      A: 重播只核對更新器，沒有提供收斂或泛化證據。
      B: 參數移動距離無法推出未量測的準確率。
      C: 梯度是指定序列，沒有重新計算兩條路徑的損失。
      D: 能算出參數不表示已達到任何最小值。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

相同模型與資料，更新方式不同，收斂速度、震盪及記憶體需求也會不同。優化器（Optimizer）利用梯度調整參數，選擇時要同時看學習效果與資源。

指引提醒，學習率仍會影響大多數優化器。把SGD換成Adam，不能省掉學習率設定、驗證及過擬合檢查。

## 直覺

先問要保留哪些歷史。基本SGD只用當前梯度；動量法保留方向；Adagrad記錄累積平方；Adam同時保留方向平均與平方尺度平均。

方向歷史有助於平滑震盪，平方歷史用來逐參數調整尺度。這些狀態都要佔記憶體，不是額外增加可訓練權重。

## 定義與公式

| 方法 | 梯度處理重點 | 指引的選用線索 | 主要限制 |
|---|---|---|---|
| 基本SGD | 使用當前梯度 | 小模型、小資料、記憶體有限 | 噪聲與學習率敏感 |
| 動量法 | 累積帶符號方向 | 深層、梯度震盪 | 另調動量係數 |
| Adagrad | 累積逐參數平方 | 稀疏文字、特徵分布不均 | 後期步長可能太小 |
| Adam | 方向與平方衰減平均 | 深度模型、噪聲或稀疏梯度 | 狀態多、泛化仍要量 |

非凸損失中，優化過程可能停滯於局部最小值或鞍點，不能只看收斂速度。指引列動量係數常用0.5～0.9；累積方向有助減少震盪，也可能幫助越過局部低谷，但不保證跳脫。

指引把Adam列為初學者可先試的通用選擇，也提醒某些情境的泛化可能略遜SGD。「萬用」是候選範圍廣，不是每個任務都最佳。

:::supplement[來源：PyTorch torch.optim及各優化器API]
本頁依各優化器的狀態張量形狀與每元素位元組數推得下式，並非API文件直接列式。只估「與參數等長的歷史狀態」時：

$$
M_{\mathrm{state}}=sPb
$$

$P$是可更新參數個數，$b$是每個狀態元素的位元組數，$s$是等長狀態份數。基本SGD、動量法、Adagrad、Adam的$s$分別為0、1、1、2。

此式不含權重、梯度、激活值、步數純量、配置器與暫存工作區。假設狀態都是FP32，$b=4$；混合精度訓練也不能直接假定狀態只佔2位元組。
:::

## 算一次（補充）

沿用前置組的初值[1,-1]、學習率0.1及兩步梯度[3,4]、[-1,2]。各方法狀態從零開始；固定重播只核對更新，不是兩種模型的訓練成績。

| 方法 | 第一步參數 | 第二步參數 | 狀態份數 |
|---|---|---|---|
| 基本SGD | [0.7,-1.4] | [0.8,-1.6] | 0 |
| 動量法 | [0.7,-1.4] | [0.53,-1.96] | 1 |
| Adagrad | [0.9,-1.1] | [0.9316,-1.1447] | 1 |
| Adam | [0.9,-1.1] | [0.8600,-1.1932] | 2 |

動量係數0.9；Adam兩個衰減係數0.9與0.999；自適應分母用極小值0.00000001。更新細節見各優化器頁，這裡比較保存的資訊。

若有100萬個FP32參數，一份狀態為4 MB，Adam兩份共8 MB。MB採十進位；若可用狀態預算只有6 MB，基本Adam不符合此估算。

## 程式（補充）

執行前將`IPAS_REPO_ROOT`設為repo絕對路徑。第一段讀共同梯度，第二段另估100萬參數的狀態；兩段依序執行。

### 核對固定梯度的兩步結果（補充）

```python
import json, os
from pathlib import Path
import torch
torch.manual_seed(23103)
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23103-C-updates.json').read_text(encoding='utf-8'))
factories = {'SGD': lambda p: torch.optim.SGD([p], lr=.1),
             'Momentum': lambda p: torch.optim.SGD([p], lr=.1, momentum=.9),
             'Adagrad': lambda p: torch.optim.Adagrad([p], lr=.1, eps=1e-8),
             'Adam': lambda p: torch.optim.Adam([p], lr=.1, eps=1e-8)}
for name, make in factories.items():
    p = torch.nn.Parameter(torch.tensor(d['initial'], dtype=torch.float64))
    opt = make(p)
    for g in d['replay']:
        opt.zero_grad(); p.grad = torch.tensor(g, dtype=p.dtype); opt.step()
    print(name, [round(v, 4) for v in p.tolist()])
```
```text
SGD [0.8, -1.6]
Momentum [0.53, -1.96]
Adagrad [0.9316, -1.1447]
Adam [0.86, -1.1932]
```

### 核對狀態位元組（補充）

```python
for name, make in factories.items():
    p = torch.nn.Parameter(torch.zeros(1_000_000, dtype=torch.float32))
    opt = make(p)
    p.grad = torch.ones_like(p); opt.step()
    states = [v for v in opt.state[p].values()
              if isinstance(v, torch.Tensor) and v.shape == p.shape]
    size = sum(v.numel() * v.element_size() for v in states)
    print(name, '等長狀態 MB:', f'{size / 1_000_000:.1f}')
```
```text
SGD 等長狀態 MB: 0.0
Momentum 等長狀態 MB: 4.0
Adagrad 等長狀態 MB: 4.0
Adam 等長狀態 MB: 8.0
```

:::tip[讀碼重點]
第一段直接指定梯度，沒有假裝跑完整能源或客服模型。第二段先更新一次，讓需要延後建立的狀態出現；排除步數純量，數字不代表整體訓練記憶體峰值。
:::

## 怎麼用、怎麼判讀

先依模型與梯度特性挑候選，再檢查記憶體是否容許。指引把單純SGD列為較不適合深層模型的選擇；Adam也不一定每次勝出。

:::supplement[來源：Dive into Deep Learning第12章；PyTorch torch.optim]
實務上，SGD搭配動量與學習率排程仍可用來訓練深層模型。要區分基本SGD與加入穩定策略後的配置，再看實際驗證結果。

能源與客服各128筆沿用同領域的固定索引與種子。每次先只換優化器，固定批次與12輪預算，記錄損失及驗證值；之後為每種方法各自公平調學習率，再比較達標耗時與驗證表現。

相同學習率能隔離更新規則，卻不代表每種方法都處在最佳配置。選定前用多個種子確認差異，最後才對保留測試集做一次評估。
:::

### 換個場景

| 場景 | 梯度或資料條件 | 判讀重點 |
|---|---|---|
| 深度網路、SGDClassifier | 使用梯度學參數 | 優化器也見於部分傳統模型 |
| 文字／NLP | 稀疏、特徵分布不均 | Adagrad有用途，但留意衰減 |
| 深層模型 | 梯度震盪、希望加速 | 比較動量法與學習率 |
| 能源預測（補充） | 需求特徵尺度不同 | 先固定縮放再比更新器 |
| 客服意圖（補充） | 少見詞與噪聲標註 | 不用收斂速度代替留樣分數 |
| 行動影像（補充） | 狀態記憶體緊 | 另量工作區與訓練峰值 |

## 常見誤解

- **自適應優化器不用設學習率。** 仍需設定初始值，不會自動找到最佳值。
- **二階矩就是Hessian矩陣。** 它記錄平方梯度的統計量，不是二階導數。（補充）
- **狀態少就一定訓練最快。** 還要看硬體、批次與達標步數。（補充）
- **換成Adam或動量法就能找到全域解。** 非凸模型沒有這項保證。

## 進階

### 參考來源

- 科目3指引`guide-3:5-37`～`guide-3:5-42`：支持優化器用途、適用條件、資源與學習率限制。
- [PyTorch torch.optim](https://docs.pytorch.org/docs/2.9/optim.html)：支持狀態、程式及比較前提；詳細公式另見SGD、動量法、Adagrad、Adam頁。
- [PyTorch SGD](https://docs.pytorch.org/docs/2.9/generated/torch.optim.SGD.html)、[Adagrad](https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adagrad.html)、[Adam](https://docs.pytorch.org/docs/2.9/generated/torch.optim.Adam.html)：支持等長狀態份數與基本配置；本頁位元組式由元素數乘元素大小估算。
- [PyTorch Tensor.element_size](https://docs.pytorch.org/docs/2.9/generated/torch.Tensor.element_size.html)：提供每元素位元組數，與狀態張量形狀共同作為本頁記憶體公式的推導依據。
- [Dive into Deep Learning 12.6](https://d2l.ai/chapter_optimization/momentum.html)、[12.10](https://d2l.ai/chapter_optimization/adam.html)：支持方向平滑、平方尺度及逐步比較的教學順序。

## 小結

- 依梯度特性與資源挑候選，再以驗證決定。
- 歷史狀態有成本；基本Adam的等長狀態是兩份。（補充）
- 固定梯度重播驗算更新器，不評判模型品質。（補充）
- 學習率、泛化與非凸限制仍需處理。
