---
id: automated-feature-selection
title: 自動特徵篩選與驗證回饋
kind: technique
codes: [L21301]
aliases: [Auto Feature Selection]
requires: [automated-feature-generation, train-val-test-split]
summary: 用重要性與去冗餘提出精簡特徵組，再由驗證回饋決定是否採用
goals:
  - id: g1
    text: 比較森林重要性與L1篩選，讀出篩選前後欄位及去冗餘效果
  - id: g2
    text: 走完候選、訓練與驗證循環，說明省時優勢與效果限制
guide_refs: [guide-1:5-5, guide-1:5-6, guide-1:5-7]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 候選含溫度、振動、溫度複本、兩欄乘積與常數。工具移除常數，再以森林重要性提出只留乘積。應如何解讀？
    options:
      A: 重要性最高代表乘積是故障原因，因此可免驗證直接發布
      B: 這是模型提出的精簡候選，仍需比較驗證與相關欄位的影響
      C: 溫度複本的重要性較低代表溫度完全無用，因此來源可永久刪除
      D: 只要改用L1就會保留完全相同的欄位，因此不需核對模型設定
    answer: B
    explain:
      A: 預測重要性不能證明因果，也不能取代泛化驗證。
      B: 重要性依資料、模型和其他欄位而變，精簡組合仍須驗證。
      C: 相同或相關欄位會分攤重要性，不能由單欄低分推論來源永久無用。
      D: 森林與L1的選擇機制不同，可能產生不同保留集合。
  - id: c2
    goal: g2
    type: choice
    prompt: 同一12筆驗證資料上，全部5欄答對11筆，篩成1欄後答對10筆。這次自動化最合理的結論是什麼？
    options:
      A: 篩選已省下4欄，所以必定同時提升預測品質並消除過擬合
      B: 只要反覆查看12筆測試答案，就能找到可當最終成績的最佳欄位
      C: 篩選只剩1欄，所以應忽略11筆與10筆的差異並保證它較佳
      D: 自動化省去重複操作，但此精簡組驗證未勝出，應回到候選比較
    answer: D
    explain:
      A: 欄位少能減少輸入，不能保證品質改善或消除過擬合。
      B: 測試答案不能用來反覆選特徵，否則最終評估不再獨立。
      C: 複雜度是取捨因素，但不能忽略已觀察到的品質差異。
      D: 本次精簡組較小卻少答對1筆，應依品質與資源要求進一步比較。
---

## 為什麼需要

自動特徵產生可能帶來大量候選，其中有重複、常數與低貢獻欄位。全部保留會增加處理成本，也可能增加模型學到雜訊的機會。

自動特徵篩選（Automated Feature Selection）先提出精簡方案，再用訓練與驗證回饋比較。省去的是重複操作，不是對結果負責的判斷。

## 直覺

「選得少」和「預測得好」是兩個觀察。先看篩選依據，再把精簡組合與原組合放在相同條件下比較，才能決定是否採用。

![驗證結果回到下一輪特徵候選；最終測試留到方案固定後。](figure:l21301-automated-feature-selection-feedback)

## 定義與公式

### 重要性與去冗餘

| 方法 | 怎麼提出保留欄位 | 主要限制 |
|---|---|---|
| 隨機森林重要性 | 依模型使用特徵的貢獻排序 | 取決於資料與樹模型 |
| L1正則化 | 使部分係數縮至零，再選非零欄 | 取決於懲罰強度與表示 |
| 去冗餘 | 移除重複或低貢獻的資訊 | 要再比較是否失去效用 |

指引把森林與L1列為自動篩選方法。森林能評估非線性分支中的特徵貢獻；L1常用於線性模型，藉稀疏係數提出保留集合。

指引5-5另列資訊增益與皮爾森相關係數。以欄位統計作初篩的定位見Filter 特徵篩選；把選擇放進模型訓練的定位見Embedded 特徵選擇。

:::supplement[來源：scikit-learn Feature selection 1.13.4]
樹的內建重要性可能偏好可切割點多的欄位；相關欄位也可能分攤重要性。L1在相關欄位間可能擇一，且應檢查尺度與懲罰強度；兩種方法不保證選到相同集合。
:::

## 走一次流程

### 1. 固定比較條件

延續製造60筆資料，排除重送後使用相同35筆訓練、12筆驗證。模型與特徵程序都固定種子42，避免把切分差異誤當成特徵效果。

### 2. 查看篩選前後欄位

| 階段 | 保留欄位 | 依據 |
|---|---|---|
| 篩選前 | 溫度、振動、溫度複本、乘積、常數 | 共5欄候選 |
| 去常數後（補充） | 溫度、振動、溫度複本、乘積 | 常數沒有樣本間差異 |
| 森林門檻後（補充） | 乘積 | 重要性達到剩餘欄平均門檻 |

:::supplement[來源：scikit-learn Feature selection，VarianceThreshold與SelectFromModel]
本例森林重要性依序約0.125、0.223、0.092、0.560。四欄平均是0.250；SelectFromModel保留重要性大於或等於門檻的欄，本例只有乘積超過。

這是該模型的建議，不是通用的最佳特徵集合。
:::

### 3. 用相同驗證資料回饋

以下是程式實測；每組都使用標準化加邏輯迴歸，填補值只從訓練資料估計。

| 特徵組 | 欄數 | 驗證答對 | 故障召回率（補充） |
|---|---:|---:|---:|
| 原始溫度、振動 | 2 | 10／12 | 0／2＝0 |
| 全部候選 | 5 | 11／12 | 1／2＝0.5 |
| 自動篩選後 | 1 | 10／12 | 0／2＝0 |

:::supplement[來源：scikit-learn分類評估指標；本組同切分程式實測]
驗證有10筆未故障、2筆故障，永遠猜未故障也能答對10／12。原始與精簡組正是全猜未故障；全部候選則抓到2筆故障中的1筆。

故障召回率見上表，指標讀法見召回率。

品質優先時，先保留全部候選再查核，不能把少抓到故障只當成少答對一筆。若資源要求精簡，仍須確認漏報代價可接受，不能只因欄位少就採用。
:::

### 4. 修訂候選，再訓練驗證

自動程序可反覆提出特徵組、訓練模型、讀取驗證結果，再調整下一輪。指引5-7列出三項優勢：加速資料科學流程、降低技術門檻，以及透過組合搜尋追求高模型效能。

:::supplement[來源：scikit-learn Common pitfalls 12.2；Google AutoML Benefits and limitations]
高模型效能是目標，不是保證；搜尋範圍、資料品質與指標仍會限制成效。本例精簡組就沒有勝過全部候選。

本例只有12筆驗證資料，差1筆不足以證明穩定優勢。若反覆查看同一驗證集，選模也可能逐漸迎合它；最終測試不參與這個回饋循環。
:::

## 程式（補充）

### 重建共同候選

先重建與前兩頁一致的數值、缺值、標籤與切分。只用訓練資料擬合填補；常數與溫度複本是刻意加入的教學候選。

```python
import numpy as np
from sklearn.impute import SimpleImputer
i = np.arange(60)
raw = np.column_stack((60 + 3 * (i % 10), 1 + .4 * ((i // 10) % 3)))
y = (raw.prod(axis=1) >= 110).astype(int)
y[i % 23 == 0] = 1 - y[i % 23 == 0]
raw[[1, 2], 0] = np.nan
train = np.array([j for j in range(36) if j != 5]); val = np.arange(36, 48)
values = SimpleImputer().fit(raw[train]).transform(raw)
X = np.column_stack((values, values[:, 0], values.prod(axis=1), np.ones(60)))
names = np.array(["temperature", "vibration", "temp_copy", "interaction", "constant"])
print("候選欄數:", X.shape[1])
```
```text
候選欄數: 5
```

### 訓練內篩選

```python
from sklearn.pipeline import make_pipeline
from sklearn.feature_selection import VarianceThreshold, SelectFromModel
from sklearn.ensemble import RandomForestClassifier
selector = make_pipeline(VarianceThreshold(), SelectFromModel(
    RandomForestClassifier(n_estimators=50, max_depth=3, random_state=42),
    threshold="mean"))
selector.fit(X[train], y[train])
remaining = names[selector[0].get_support()][selector[1].get_support()]
print("重要性:", selector[1].estimator_.feature_importances_.round(3).tolist())
print("保留:", remaining.tolist())
```
```text
重要性: [0.125, 0.223, 0.092, 0.56]
保留: ['interaction']
```

### 驗證是否值得保留

```python
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
groups = [("原始兩欄", X[:, :2]), ("全部候選", X),
          ("自動篩選", selector.transform(X))]
for title, features in groups:
    model = make_pipeline(StandardScaler(), LogisticRegression(random_state=42))
    model.fit(features[train], y[train])
    pred = model.predict(features[val])
    detected = int(((pred == 1) & (y[val] == 1)).sum())
    faults = int((y[val] == 1).sum())
    print(title, features.shape[1], int((pred == y[val]).sum()), "/", len(val),
          "故障抓到", detected, "/", faults)
```
```text
原始兩欄 2 10 / 12 故障抓到 0 / 2
全部候選 5 11 / 12 故障抓到 1 / 2
自動篩選 1 10 / 12 故障抓到 0 / 2
```

:::tip[讀碼重點]
`selector.fit`接收的只有訓練列及其標籤。每組使用相同驗證索引；這是固定留出比較，若換成交叉驗證，填補與selector都要在每個訓練折內重建。
:::

## 怎麼用、怎麼判讀

同時檢查驗證品質、欄數與實際運作成本。重要性低不等於來源沒價值；先查冗餘、尺度與模型依賴，再決定是否停收資料。

### 換個場景

| 場景／資料條件 | 篩選方向 | 判讀重點 |
|---|---|---|
| 多欄、低貢獻或冗餘資訊 | 森林、L1、驗證回饋 | 精簡與品質一起比較 |
| 製造（補充） | 感測欄及其組合 | 重要性分攤與感測成本 |
| 零售（補充） | 交易、互動與通路候選 | 固定會員視窗再比較 |
| 醫療（補充） | 檢查項目與衍生欄 | 預測品質與檢查負擔 |

## 常見誤解

- **自動篩選必定提高準確率。** 精簡後仍可能失去有用資訊。
- **森林重要性等同因果效果。** 它描述該模型如何使用欄位。（補充）
- **每次分數最高都能當最終成績。** 反覆選擇後仍需獨立評估。（補充）

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-5～5-7：支持森林／L1、去冗餘、反覆驗證與效率優勢。
- 科目1指引5.1，guide-1:5-5：支持資訊增益、皮爾森相關係數與L1的候選方法。
- [scikit-learn特徵選擇指南](https://scikit-learn.org/stable/modules/feature_selection.html)：支持重要性限制、VarianceThreshold及SelectFromModel。
- [SelectFromModel](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.SelectFromModel.html)：支持大於或等於門檻的保留規則。
- [scikit-learn分類評估指標](https://scikit-learn.org/stable/modules/model_evaluation.html#classification-metrics)：支持故障召回率與多數類基準的判讀。
- [模型式與循序選擇教學](https://scikit-learn.org/stable/auto_examples/feature_selection/plot_select_from_model_diabetes.html)：參考先選欄、再比較成效的教學流程。
- [scikit-learn常見錯誤](https://scikit-learn.org/stable/common_pitfalls.html)：支持篩選必須留在訓練內。
- [Google AutoML優缺點課程](https://developers.google.com/machine-learning/crash-course/automl/benefits-limitations)：支持省時、可客製程度與效果限制。

## 小結

- 重要性與去冗餘可提出精簡特徵組。
- 森林和L1機制不同，不保證選出相同欄位。
- 相同切分上的驗證回饋決定是否採用精簡結果。
- 自動化減少操作，不保證泛化或業務成效。
