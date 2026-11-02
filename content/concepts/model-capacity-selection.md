---
id: model-capacity-selection
title: 資料規模與模型容量
kind: technique
codes: [L23302]
aliases: [模型容量, 模型複雜度]
summary: 依有效樣本、特徵與成本選模型容量，再以驗證判斷增加容量是否值得
goals:
  - id: g1
    text: 比較小中大資料的容量與擴展性，核算參數並辨識同筆數的不同條件
requires: [overfitting, train-val-test-split]
guide_refs: [guide-3:5-13, guide-3:5-14]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: dense-parameters
    source: https://wiredspace.wits.ac.za/server/api/core/bitstreams/fd18261d-c81a-41ad-9b8e-38c0b3d0d704/content
    status: verified
    checked_by: task_96b06ca84f70
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 第一摺有 52 週，取前 8 週預測下一週。某單隱藏層網路輸入 8 維、隱藏寬度 4、輸出 1 維，兩層都有偏差。哪項核算正確？
    options:
      A: 訓練目標 52 筆，參數 32 個，依原始週數與輸入權重計算
      B: 訓練目標 44 筆，參數 36 個，依可用視窗與第一層計算
      C: 訓練目標 45 筆，參數 40 個，依當週輸出與全部權重計算
      D: 訓練目標 44 筆，參數 41 個，依下一週目標與兩層計算
    answer: D
    explain:
      A: 前八週尚無完整輸入視窗，且參數不只有輸入權重。
      B: 36 只包含第一層的 32 個權重與 4 個偏差，漏了輸出層。
      C: 此任務預測下一週而非重建當週，且兩層偏差都需計入。
      D: 目標為第 9–52 週共 44 筆，參數為 32＋4＋4＋1＝41。
  - id: c2
    goal: g1
    type: choice
    prompt: 兩個團隊各有 104 筆資料：能源是同一設備連續週資料、8 個落後特徵；影像是不同物件、每筆上萬像素。哪項建議合理？
    options:
      A: 原始筆數相同，因此兩者採相同參數數就有相同風險
      B: 同時評估相依、維度與先驗，再各自比較容量及驗證效果
      C: 影像維度更高，因此直接從零訓練最大模型最能降低風險
      D: 能源有多個視窗，因此當成獨立新增樣本就能保證泛化
    answer: B
    explain:
      A: 相依性、特徵維度與任務結構不同，筆數不能單獨決定風險。
      B: 有效資訊量與先驗不同，即使筆數相同也可能需要不同策略。
      C: 高維小樣本從零訓練大模型可能過擬合，需評估預訓練或較簡單方案。
      D: 重疊視窗高度相關，不是憑空增加獨立資訊。
---

## 為什麼需要

模型太簡單，可能學不到真正關係；模型容量提高，也可能把有限資料的偶然變動一起記住。資料規模與模型容量要一起選，還要顧到訓練與部署成本。

模型容量（Model Capacity）可理解為模型能表達多少種關係。指引以樣本規模提供候選方向，但筆數區間不是能自動選出最佳模型的硬性門檻。

## 直覺

同樣一份資料，訓練誤差下降不代表未來一定改善。先保留簡單基準，再增加深度、寬度或樹的複雜程度，檢查驗證是否跟著受益。

![候選卡的訓練誤差下降時，仍要分開讀取驗證誤差與兩者差距。](figure:l23302-model-capacity-selection-gap)

:::supplement[來源：scikit-learn Validation curves；本站 L23302-A 教學合成資料]
圖用共用模擬卡，訓練 MAE 為 6、2、1，三摺驗證平均為 8、7、6 kWh。差距從線性的 2 kWh 增為 GRU 與 TCN 的 5 kWh，後兩者相同。

不能只由一個差距判定高變異，或宣稱複雜模型一定過擬合。
:::

## 定義與公式

### 指引的規模起點

| 規模 | 候選方向 | 容量與成本的重點 |
|---|---|---|
| 數百至數千筆 | 線性、邏輯迴歸、決策樹、Lasso、Ridge | 控制複雜度，重視前處理、特徵與較強先驗假設 |
| 數千至數十萬筆 | 隨機森林、XGBoost、LightGBM | 可比較集成與調參，仍需算訓練成本 |
| 百萬級以上 | 深度模型，尤其影像、語音、文字 | 檢查 GPU、多機、分散式架構、調校效率及資料流程擴展性 |

:::caution[注意]
這些區間有重疊，是經驗方向。104 週比表列小型資料更少，先用簡單基準仍合理；有預訓練表示時，小資料也可能使用深度模型，不必從零學全部參數。（補充）
:::

### 算參數作為容量線索（補充）

考慮輸入 p 維、單隱藏層寬度 H、輸出 1 維的全連接網路，兩層都有偏差：

$$
P=pH+H+H+1=H(p+2)+1
$$

$P$ 是可訓練參數總數，$pH$ 是第一層權重，第一個 H 是隱藏層偏差，第二個 H 是輸出層權重，1 是輸出偏差。激活函數假設沒有額外可訓練參數。

來源界線：依 PyTorch Linear 的 `weight`、`bias` 形狀分兩層計數再相加，是本頁的自行推導；該文件沒有直接列出整個網路的完整計數式。Hirschowitz 的原始研究報告第 2.2.2 節、印刷第 9 頁另直接列出同一完整總數式；原文以小寫 `h` 表示本頁的隱藏寬度，輸入仍為 `p`，含兩層偏差與單一輸出。該式只支持這個架構的參數計數，不能推成任意深度、多輸出或含可訓練激活參數的通式。

本例 p＝8，H＝4 時 $P=4(8+2)+1=41$；H＝32 時 $P=32(8+2)+1=321$。這只是同架構內的容量線索，不能把不同模型的參數數當成通用效果排名。

## 算一次

:::supplement[來源：依 PyTorch Linear 形狀自行計數；本站 L23302-A 教學合成資料]

共用能源與製造都只有 104 週。第一摺只用前 52 週，八週輸入預測下一週，可用目標是第 9–52 週，共 44 筆；不能拿全 104 週當成第一摺的訓練量。

兩個全連接候選共用這 44 個目標，隱藏寬度從 4 增為 32，參數從 41 增為 321，約增為 7.83 倍。視窗高度重疊，44 筆也不等於 44 份彼此獨立的歷史。

| 候選 | 參數數 | 只存 float32 參數 | 還缺哪些成本 |
|---|---|---|---|
| 寬度 4 | 41 | 164 bytes | 中間張量、梯度與執行環境 |
| 寬度 32 | 321 | 1,284 bytes | 中間張量、梯度與執行環境 |

每個 float32 用 4 bytes，所以 41×4＝164、321×4＝1,284。這不是訓練或推論的峰值記憶體，也不能與共用候選卡的 MiB 數字混為一談；兩者是不同的教學模型。
:::

## 程式（補充）

兩領域都是八週輸入，因此參數核算相同。這段用實際網路核對公式，沒有訓練，也不量測延遲。

```python
import json, os, torch
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23302-A-weekly.json").read_text(encoding="utf-8"))
p = d["capacity"]["input_width"]
for width in d["capacity"]["hidden_widths"]:
    model = torch.nn.Sequential(torch.nn.Linear(p, width), torch.nn.ReLU(), torch.nn.Linear(width, 1))
    count = sum(v.numel() for v in model.parameters())
    size = sum(v.numel() * v.element_size() for v in model.parameters())
    print(f"寬度 {width}: {count} 個參數，{size} bytes")
```
```text
寬度 4: 41 個參數，164 bytes
寬度 32: 321 個參數，1284 bytes
```

:::tip[讀碼重點]
`numel()` 數元素，`element_size()` 看實際型別的 bytes。這裡模型預設為 float32；變更型別會改變儲存量，不會改變參數數。
:::

## 怎麼用、怎麼判讀

先看樣本與特徵能否支持候選，再看驗證改善是否值得額外成本。資料增加時，也要檢查前處理、載入、記憶體與訓練時間是否一起撐得住，不能只看 GPU 型號。

### 同筆數的反例（補充）

同為 104 筆，單一設備的連續週觀測與不同物件的高維影像，資訊結構不同。前者有時間相依，後者可能需要圖像先驗或預訓練；兩者不能由筆數直接配相同寬度。

即使都是 104 週，兩個量測穩定且訊號清楚的欄位，也與數百個含噪欄位不同。應同時記錄維度、噪聲、標註品質、相依及先驗；本組週資料用相同的時間序列交叉驗證比較容量。

### 換個場景

| 場景 | 選型與限制 |
|---|---|
| 小型資料、有限標註 | 簡單或正則化模型先行，特徵品質更重要 |
| 中型表格資料 | 集成與調參可嘗試，訓練預算需保留 |
| 大型影像、語音、文字 | 深度模型具潛力，須支援硬體與資料擴展 |
| 能源與製造週資料（補充） | 計算有效目標數，避免把重疊視窗當獨立樣本 |
| 小型農業影像（補充） | 比較預訓練與簡單基準，避免直接從零堆容量 |

## 常見誤解

- 「超過某個筆數就必須換神經網路。」規模是線索，還有資料結構與成本。
- 「參數比樣本多就一定不能泛化。」這不是跨模型通用定律。（補充）
- 「加大容量只要看訓練效果。」驗證與資源成本才決定是否值得。
- 「參數檔大小等於峰值記憶體。」執行還需要其他張量與框架空間。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-13`～`guide-3:5-14`：支持小中大資料、候選與擴展性；已看 PDF 147～148 頁。
- [PyTorch Linear](https://docs.pytorch.org/docs/2.12/generated/torch.nn.Linear.html)：直接支持權重與偏差形狀；逐層計數加總為本頁自行推導，文件未列整個網路的完整式。
- [Hirschowitz，The interaction of sampling ratio and modelling method in prediction of binary target with rare target class](https://wiredspace.wits.ac.za/server/api/core/bitstreams/fd18261d-c81a-41ad-9b8e-38c0b3d0d704/content)：University of the Witwatersrand 碩士研究報告，第 2.2.2 節、印刷第 9 頁直接列完整總數式；只採用單隱藏層、單輸出且兩層含偏差的計數，不引申其分類實驗結論。
- [scikit-learn Validation curves](https://scikit-learn.org/stable/modules/learning_curve.html)：支持分開讀取訓練、驗證與複雜度。
- [scikit-learn 欠擬合與過擬合範例](https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html)：參考以同資料比較容量的教學安排。
- [Dive into Deep Learning 5.5](https://d2l.ai/chapter_multilayer-perceptrons/generalization-deep.html)：支持容量與泛化之間的條件性限制。

## 小結

- 資料規模區間是候選方向，不能單獨決定模型。
- 核對有效目標數、特徵維度與資料相依。
- 參數數與儲存量可核算，峰值成本還需另量。
- 增加容量後，同時看驗證改善、穩定性與擴展成本。
