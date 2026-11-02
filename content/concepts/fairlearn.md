---
id: fairlearn
title: Fairlearn
kind: tool
codes:
  - L23402
aliases:
  - MetricFrame
  - Microsoft Fairlearn
summary: Fairlearn 用分群指標找落差，並以公平約束協助重訓與比較候選模型
goals:
  - id: g1
    text: 用相同資料安排分群評估、約束重訓及復評，分辨與 AIF360 的定位
requires:
  - fairness-constrained-training
guide_refs:
  - guide-3:6-20
formula_groups:
  - id: between-group-gap
    source: https://fairlearn.org/main/api_reference/generated/fairlearn.metrics.MetricFrame.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一40筆上，middle-v2的準確率65%、TPR差10點、FPR差10點；strict-v3為60%、兩差皆0。門檻為準確率至少65%、兩差皆至多10點，應如何選？
    options:
      A: 保留middle-v2，因它同時符合兩項預設門檻
      B: 保留strict-v3，因公平差距歸零就可忽略效能
      C: 保留base-v1，因準確率70%就可忽略公平差距
      D: 三版全部拒絕，因公平差距必須嚴格小於10點
    answer: A
    explain:
      A: 65%與10點均符合包含等號的門檻，仍須獨立驗證。
      B: 60%低於最低效能，不能只看公平差距。
      C: base-v1的FPR差40點，不符合公平門檻。
      D: 至多10點包含10點，不能事後更改條件。
  - id: c2
    goal: g1
    type: choice
    prompt: 工程師用MetricFrame算出兩群TPR相同，想以EqualizedOdds重訓。下一步何者較恰當？
    options:
      A: 略過FPR檢查，以TPR相同認定均衡機率已成立
      B: 改用測試集訓練，以取得最接近測試分數的模型
      C: 先查FPR與傷害，再用訓練資料及群體欄設約束
      D: 先加SHAP圖示，以特徵貢獻相近取代群體復評
    answer: C
    explain:
      A: 均衡機率也涉及FPR，TPR相同不足以判定。
      B: 測試資料不應參與約束訓練與候選搜尋。
      C: 先確認目標，再在訓練階段設定約束並以獨立資料評估。
      D: 特徵歸因與群體差距回答的問題不同。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

兩個模型的總體準確率接近，可能對不同群體造成不同的漏選或誤選。Fairlearn把分群衡量與降低落差接在一起，協助團隊比較公平性和預測效能。

指引介紹Fairlearn可計算群體指標，並支援公平約束下的模型再訓練。它與scikit-learn生態相容，適合接入既有機器學習流程。

## 直覺

分群評估像把總成績拆成各組成績單。約束訓練則是先訂接受條件，再找可用模型；成績單本身不會改模型。

![分群評估與約束訓練是兩個步驟；訓練與選擇候選之後，仍須用獨立資料復評。](figure:l23402-fairlearn-workflow)

## 定義與公式

Fairlearn的核心工作包括評估群體落差，以及在指定公平約束下訓練候選。公平目標不同，適用的約束也不同。

### 從群體表到差距（補充）

先逐筆對齊真值、預測及敏感欄位，再交給`MetricFrame`。`by_group`列各群結果；預設`difference()`取純量指標的最高群減最低群。

$$
D_m=\max_g m_g-\min_g m_g
$$

$m_g$是群體$g$的指定純量指標，$D_m$是群體間極差。先固定指標及群體定義；它沒有正負方向，分母為零的群體須另標未定義，不能當成零差距。

沿用招聘例，選取率為0.50與0.70，代入為0.70−0.50＝0.20。FPR為0.20與0.60，差為0.40；不能因TPR差為0，就說所有群體表現相同。

## 走一次流程

### 用同一40筆重核（補充）

兩頁工具共用前置組招聘、信貸各40筆、相同索引與種子23402。以下是固定候選輸出算出的分群表，沒有使用Fairlearn訓練或挑選模型。

| 版本 | A選取率／TPR／FPR | B選取率／TPR／FPR | 準確率 |
|---|---|---|---|
| base-v1 | 50%／80%／20% | 70%／80%／60% | 70% |
| middle-v2 | 50%／70%／30% | 50%／60%／40% | 65% |
| strict-v3 | 50%／60%／40% | 50%／60%／40% | 60% |

教學政策要求準確率至少65%，TPR與FPR兩種差距都至多10個百分點。base-v1的FPR差40點而不合格；strict-v3雖無這兩種差距，準確率仍不合格。

middle-v2兩種差距都是10點，準確率65%，因此通過這份候選表的門檻。這只說明指定資料與政策下的選擇，不代表真實世界已全面公平。

### 實際重訓時怎麼安排

Fairlearn可依指定公平約束再訓練，並與既有Python機器學習流程整合。

:::supplement[來源：Fairlearn Reductions；GridSearch with Census Data]
先在訓練資料施加約束，用驗證資料比較候選，最後以未參與選擇的資料確認公平性與效能。

以`EqualizedOdds`表示均衡機率目標，可搭配`ExponentiatedGradient`或`GridSearch`；基礎模型須支援擬合、預測及樣本權重。

訓練呼叫提供`X_train`、`y_train`及`sensitive_features`。以此類約束方法產生的預測器可不在推論接收群體；仍須核對具體方法，後處理可能有不同要求。

若演算法含隨機預測，保存設定及預測種子。報告的10點是本例自行定義的群體間差距，不能未查API定義就把同一數字直接填成`eps`或其他參數。
:::

## 程式（補充）

以下以NumPy直接核對群體計數，展示`MetricFrame`應呈現的基準值。沒有呼叫Fairlearn，也不把預設候選誤稱為約束演算法的訓練結果。

```python
import numpy as np
tp = np.array([[8, 8], [7, 6], [6, 6]])
fp = np.array([[2, 6], [3, 4], [4, 4]])
for k, name in enumerate(["base-v1", "middle-v2", "strict-v3"]):
    tpr, fpr = tp[k]/10, fp[k]/10
    accuracy = (tp[k].sum() + (10-fp[k]).sum())/40
    gap = max(np.ptp(tpr), np.ptp(fpr))
    print(f"{name}: acc={accuracy:.2f} gap={gap:.2f}")
```
```text
base-v1: acc=0.70 gap=0.40
middle-v2: acc=0.65 gap=0.10
strict-v3: acc=0.60 gap=0.00
```

:::tip[讀碼重點]
每列是一個候選、每欄是一個群體。`np.ptp`算最大值減最小值；`gap`取TPR、FPR差距的較大者，準確率則合計兩群正確筆數再除以40。
:::

## 怎麼用、怎麼判讀

指引將AI Fairness 360定位為多指標、三階段方法的工具包；Fairlearn則強調分群衡量、公平約束重訓及Python流程整合。選工具時看所需方法和輸入，不只比較功能數量。

:::supplement[來源：Fairlearn Performing a Fairness Assessment；Reductions]
分群表有助定位哪群承受更多傷害，並不是特徵貢獻解釋器。指引提到可解釋性分析，應理解為協助解讀群體結果，不能把Fairlearn等同SHAP。

也不能把「適合中小型專案」當成大型專案的硬性禁令。仍應依版本、方法、訓練成本及部署需求測試可行性。
:::

### 換個場景

| 場景／資料條件 | 使用重點 |
|---|---|
| 既有scikit-learn流程 | 接分群評估及約束重訓 |
| 中小型、輕量化試驗 | 先確認需要的方法及成本 |
| 招聘篩選（補充） | 查資格者被漏選的比例 |
| 信貸決策（補充） | 比較有利決策與錯誤代價 |
| 語音轉文字（補充） | 可用適合任務的錯誤指標分群 |

## 常見誤解

- `MetricFrame`產生分群結果，不會自動修正模型。（補充）
- 約束訓練需要重新學習，不能只替舊模型貼上公平標籤。
- 一種公平差距改善，其他指標仍可能變差。（補充）
- 訓練約束達標，不保證新的測試資料也達標。（補充）

## 進階

### 為什麼不能只挑零差距（補充）

本例strict-v3的準確率僅60%。如果只追求群體數字相同，可能讓兩群一起失去可用服務；公平目標應連到實際傷害，並與最低效能共同審查。

### 參考來源

- 科目3學習指引，本機快照，`guide-3:6-20`：支持Fairlearn分群評估、約束重訓與工具比較。
- [Fairlearn Performing a Fairness Assessment](https://fairlearn.org/main/user_guide/assessment/perform_fairness_assessment.html)：支持分群輸入、純量極差及傷害導向判讀。
- [Fairlearn MetricFrame API](https://fairlearn.org/main/api_reference/generated/fairlearn.metrics.MetricFrame.html)：支持純量極差公式及預設介面。
- [Fairlearn Reductions](https://fairlearn.org/main/user_guide/mitigation/reductions.html)：支持約束物件、基礎估計器與訓練／推論介面的補充。
- [Fairlearn GridSearch教學](https://fairlearn.org/main/auto_examples/plot_grid_search_census.html)：教學參考，支持候選取捨及獨立評估安排。
- 共用教學資料`content/examples/L23402-C-audit.json`及B組兩領域資料：支持三個固定候選的計數及門檻。

## 小結

- 分群評估先找差距，公平約束再引導重訓。
- 使用相同資料及指標，才能比較候選。（補充）
- 公平門檻與最低效能應共同驗收。（補充）
- 工具定位、介面及操作成本都要確認。
