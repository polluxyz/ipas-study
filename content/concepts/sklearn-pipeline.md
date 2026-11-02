---
id: sklearn-pipeline
title: scikit-learn Pipeline
aliases: [Pipeline, 管線]
kind: tool
codes: [L23303, L23301]
mitigates:
  - target: data-leakage
    note: 把前處理和模型包成一個物件；交叉驗證時每一摺只用訓練摺 fit 前處理
    source: [115-1-S3-Q44]
textbook: v2
summary: Pipeline 把前處理與模型串成一個物件，交叉驗證時每摺一起重新擬合
goals:
  - id: g1
    text: 說明 Pipeline 在訓練與預測時各步驟的 fit、transform 與 predict
  - id: g2
    text: 對照切分前選特徵與摺內 Pipeline，找出資料洩漏並修正
  - id: g3
    text: 用步驟名加雙底線指定參數，並說明 Pipeline 無法自動處理的限制
formula_groups: []
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: Pipeline 包含標準化與分類器。某一摺驗證時，標準化步驟應如何運作？
    options:
      A: 只在驗證資料 fit_transform，讓平均回到零
      B: 把訓練與驗證合併 fit，再拆開預測
      C: 跳過標準化，直接把原始驗證值送進分類器
      D: 沿用該摺訓練資料學得的平均與尺度，只對驗證資料 transform
    answer: D
    explain:
      A: 錯。驗證資料不能重新決定尺度，否則兩側轉換規則也不同。
      B: 錯。驗證資訊會影響前處理的學習，造成資料洩漏。
      C: 錯。分類器需要與訓練時一致的特徵轉換。
      D: 對。前處理在訓練時學習，驗證時只套用已學得的規則。
  - id: c2
    goal: g2
    type: choice
    prompt: 工程師先做 selected=selector.fit_transform(X,y)，再把分類器交給五摺交叉驗證。哪項修改能處理這次前處理洩漏？
    options:
      A: "保留切分前選出的 selected，只把分類器換成更複雜的模型，以提高每摺的擬合能力"
      B: 把 selector 與分類器放進 Pipeline，讓交叉驗證接收原始 X、y
      C: "保留切分前選出的 selected，將五摺改成十摺，用更細的資料切分消除特徵選擇洩漏"
      D: "保留切分前選出的 selected，在每摺訓練資料上標準化後再評估"
    answer: B
    explain:
      A: "錯。改變分類器複雜度沒有重新選特徵，驗證資訊仍已透過 selected 進入訓練流程。"
      B: 對。交叉驗證會逐摺擬合整個 Pipeline，選特徵也只使用訓練摺。
      C: "錯。十摺仍使用切分前選出的特徵，增加摺數不會撤回特徵選擇已用過的驗證資訊。"
      D: "錯。標準化限制在訓練摺是合理的，但 selected 仍由全資料選出，原本的特徵選擇洩漏未修復。"
  - id: c3
    goal: g3
    type: choice
    prompt: Pipeline 的分類器步驟命名為 model，要搜尋其 C 參數；資料每位病人含多張影像。哪個搭配合理？
    options:
      A: 使用 C 作為頂層參數，Pipeline 會自動依病人分組
      B: 使用 model_C，並在 Pipeline 中加入病人編號即可自動隔離
      C: 使用 model__C，另外明確設定依病人分組的切分器
      D: 使用 model__C，只要有 Pipeline 就不需要檢查切分
    answer: C
    explain:
      A: 錯。巢狀參數需指定步驟名稱，且 Pipeline 不替你決定群組邊界。
      B: 錯。參數分隔符號是雙底線，加入病人編號不等於依病人分組。
      C: 對。參數用雙底線定位步驟，資料群組則由切分策略另外控制。
      D: 錯。Pipeline 管理前處理與模型，不能自動防止同病人跨摺。
author: codex
status: draft
---

## 為什麼需要（補充）

K-fold 交叉驗證要求每摺重新訓練。若標準化、補值或特徵選擇留在交叉驗證外面，它們不會跟著每摺重學，可能造成資料洩漏。

Pipeline（scikit-learn Pipeline；也稱管線）把這些步驟串成一個物件，讓交叉驗證管理整條流程。此處不是泛指資料搬運的資料管線。

學習指引 5.3 沒有介紹此工具，本頁全部為補充。這裡假設已讀資料洩漏與 K-fold 的流程，不再重講分摺方法。

## 直覺（補充）

每一摺都複製一條新的流程：先在訓練摺學前處理，再訓練模型。評估時，驗證資料沿著同樣步驟前進，但只套用已學得的轉換。

`fit` 從資料學規則，`transform` 套用學到的規則；`fit_transform` 則先學規則，再轉換訓練資料。

![同一摺的驗證資料只沿用訓練時學得的轉換，下一摺重新擬合整條 Pipeline](figure:l23303-sklearn-pipeline-fold-fit)

資料不能跳過中間步驟。例如分類器是在標準化後的特徵上訓練，預測時也必須使用相同尺度，而不是直接輸入原始值。

## 定義與公式（補充）

本工具重點是呼叫順序，沒有額外數學公式。Pipeline 依序執行多個估計器，中間步驟需能 `fit` 與 `transform`；最後一步可放分類器或迴歸器。

| 呼叫 | 前處理步驟 | 最後模型 |
|---|---|---|
| `pipe.fit(X_train, y_train)` | 依序擬合並轉換訓練資料 | 在轉換後資料擬合 |
| `pipe.predict(X_valid)` | 依序套用先前學得的轉換 | 輸出預測 |
| 交叉驗證中的每一摺 | 複製流程，只在該摺訓練部分擬合 | 該摺驗證部分用於評分 |

`Pipeline([("select", ...), ("model", ...)])` 可自行命名步驟。`make_pipeline(...)` 則自動命名；兩者都能把完整流程交給交叉驗證。

參數名稱用「步驟名＋雙底線＋參數名」。`select__k` 指保留特徵數；`model__C` 指邏輯迴歸的 `C`，不是整條流程的共同參數。

`C` 是正則化強度的倒數：`C` 越大，正則化越弱；`C` 越小，正則化越強。

## 走一次流程（補充）

沿用資料洩漏頁的醫療模擬資料：100 位受試者、300 項無訊號檢測值，標籤兩類各 50 位。原始值與生成規則存於 `L23303-C2-medical-noise.json`。

1. 先決定五摺切法，不在全資料上擬合任何前處理。
2. 某摺的 80 位受試者先學平均與尺度，再轉換。
3. 用轉換後的 80 人及標籤選十個特徵，再訓練分類器。
4. 另 20 人沿用同一尺度與特徵清單，輸入分類器評分。
5. 下一摺複製全新流程，重新學尺度、特徵清單與分類器。

這裡每人只有一列，才能用一般分層切法。若每人有多列紀錄，就還要依病人分組；Pipeline 不會替你完成這件事。

## 程式（補充）

先重建相同的原始資料。兩個流程使用相同分摺與相同分類器，只改標準化和特徵選擇發生的位置。

```python
import numpy as np
from sklearn.feature_selection import SelectKBest
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
rng = np.random.default_rng(23)
X = rng.normal(size=(100, 300)).round(6)
y = np.repeat([0, 1], 50)
rng.shuffle(y)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=17)
model = LogisticRegression(solver="liblinear", random_state=0)
print(X.shape, np.bincount(y).tolist())
```
```text
(100, 300) [50, 50]
```

錯誤流程先在全部資料上擬合兩個前處理。分類器仍有逐摺訓練，但已無法阻止先前的驗證資訊流入。

```python
scaled = StandardScaler().fit_transform(X)
selected = SelectKBest(k=10).fit_transform(scaled, y)
wrong = cross_val_score(model, selected, y, cv=cv, scoring="accuracy")
pipe = Pipeline([("scale", StandardScaler()),
                 ("select", SelectKBest(k=10)), ("model", model)])
right = cross_val_score(pipe, X, y, cv=cv, scoring="accuracy")
print("錯誤各摺", wrong.round(3))
print("正確各摺", right.round(3))
print(f"錯誤平均={wrong.mean():.3f}，正確平均={right.mean():.3f}")
```
```text
錯誤各摺 [0.9 0.7 0.6 0.7 0.8]
正確各摺 [0.2  0.65 0.65 0.4  0.6 ]
錯誤平均=0.740，正確平均=0.500
```

再讀出參數名稱並修改設定。此段示範 API，不執行額外調參，也不把外層驗證分數拿來挑設定。

```python
pipe.set_params(select__k=5, model__C=0.5)
print("保留特徵數", pipe.get_params()["select__k"])
print("模型 C", pipe.get_params()["model__C"])
```
```text
保留特徵數 5
模型 C 0.5
```

:::tip[讀碼重點]
- 正確呼叫把原始 `X` 交給 `cross_val_score`，不是把 `selected` 交進去。
- `Pipeline` 中間步驟需要轉換能力；一般分類器通常放在最後。
- `set_params` 只改設定，不會自動重新擬合；正式使用新設定前要再訓練。
:::

## 怎麼用、怎麼判讀（補充）

本例故意沒有疾病訊號，正確流程的分數應在隨機基準附近波動。切分前的特徵選擇看過全部標籤，才會出現好看的假象。

錯誤流程每摺答對 18、14、12、14、16 人，共 74 人；正確流程答對 4、13、13、8、12 人，共 50 人。因此平均準確率分別為 0.740 與 0.500。

這裡同時移動標準化與特徵選擇，所以不能把全部分差歸因於標準化。要分辨各步驟影響，需一次只移動一個步驟另做對照。

固定資料與種子方便重現，換套件版本仍可能有細微差異。驗收的是擬合資料的邊界；不能以「兩個分數相同」斷定流程沒有洩漏。

### 接上調參與最終模型

把整條 Pipeline 交給 `GridSearchCV`，即可一起搜尋前處理與模型設定。每組參數、每個訓練摺都會重新擬合相關步驟。

若還要估計調參後的成效，接上巢狀交叉驗證或使用獨立測試集。選定流程後，在全部開發資料重新 `fit`，再以整條 Pipeline 預測新資料。

`cross_val_score` 回傳的是分數，不會把外部原本的 `pipe` 訓練好。直接拿未擬合的 `pipe` 呼叫 `predict` 仍會報錯。

### 換個場景（補充）

指引 5.3 沒有 Pipeline 的專屬適用場景；下列是同一工具的延伸用法。

| 場景 | 可放進 Pipeline 的步驟 | 仍需另管的限制 |
|---|---|---|
| 醫療診斷 | 補值、標準化、選檢測項目、分類器 | 同病人資料不可跨群組邊界 |
| 金融交易 | 標準化、降維、交易分類器 | 預測未來時要用時間序列交叉驗證 |
| 零售出貨量 | 補值、尺度轉換、迴歸模型 | 特徵必須在預測當下已知 |

## 常見誤解（補充）

- 「用了 Pipeline 就完全沒有洩漏」：放進去之前已洩漏的特徵不會被修復。
- 「Pipeline 會選正確的切分方式」：分層、時間與群組限制要由切分器設定。
- 「驗證時也會重新 `fit` 前處理」：正常預測只套用已學得的轉換。
- 「交叉驗證完就有最終模型」：逐摺模型用來評分，交付前仍須重新訓練。

## 進階（補充）

### 不同欄位要做不同轉換

連續值與類別欄位常需要不同前處理，可先用 `ColumnTransformer` 分欄轉換，再接最後模型。這仍需整體放在交叉驗證內，原則沒有改變。

### 參考來源

- [scikit-learn：Pipelines and composite estimators](https://scikit-learn.org/stable/modules/compose.html)（支持：直覺、流程、調參、分欄處理）。
- [scikit-learn：Pipeline API](https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.Pipeline.html)（支持：呼叫順序、步驟限制、雙底線參數）。
- [scikit-learn：Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)（支持：洩漏對照、常見誤解）。
- [Inria 課程：Preprocessing for numerical features](https://inria.github.io/scikit-learn-mooc/python_scripts/02_numerical_pipeline_scaling.html)（支持：fit 與 transform 的直覺、訓練與預測流程）。
- [Inria 課程：Benefits of using feature selection](https://inria.github.io/scikit-learn-mooc/python_scripts/feature_selection_introduction.html)（支持：將特徵選擇納入流程、模擬資料對照）。
- [scikit-learn：交叉驗證](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：交叉驗證回傳分數、群組與時間限制）。
- [scikit-learn：LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)（支持：定義與公式中的 C 與正則化強度關係）。
- [scikit-learn：API 詞彙表](https://scikit-learn.org/stable/glossary.html#term-fit)（支持：直覺中的 fit、transform 與 fit_transform 說明）。

## 小結（補充）

- 前處理與模型一起放進 Pipeline，再交給交叉驗證。
- 每摺只用訓練資料學轉換，驗證只套用同一規則。
- 步驟參數以雙底線指定，修改後仍須重新擬合。
- 切分方式、事後特徵與最終測試邊界仍需另外檢查。
