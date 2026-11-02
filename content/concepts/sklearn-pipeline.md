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
    text: 說明含補值、縮放與 LDA 的 Pipeline 在每摺訓練與預測時各步驟的 fit、transform 與 predict
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
  - id: c4
    goal: g1
    type: choice
    prompt: SimpleImputer→StandardScaler→LDA→分類器放入三摺交叉驗證。哪一組資料使用方式正確？
    options:
      A: 每摺用訓練 X、y 擬合全流程；驗證 X 只轉換與預測，驗證 y 只評分
      B: 每摺先用訓練 X 補值縮放，再用驗證 X、y 擬合 LDA，最後分類
      C: 先以全部 X 補值縮放；每摺再以訓練 X、y 擬合 LDA 與分類器
      D: 每摺以訓練 X、y 擬合全流程；驗證端重學補值縮放，再沿用 LDA
    answer: A
    explain:
      A: 對。LDA 使用訓練標籤學方向；驗證只沿用前處理與方向，不參與擬合。
      B: 錯。驗證特徵與答案影響判別方向，已越過當摺訓練邊界。
      C: 錯。切摺前的補值與尺度已使用驗證分布，後段正確仍不能撤回洩漏。
      D: 錯。驗證端重學前處理同樣越界，也改變了分類器所預期的座標。
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

### 補值、縮放與 LDA 的逐摺順序

另用資料洩漏頁的十二列設備合成資料，完整值存於 `L23303-M4-A-fold-boundaries.json`。不是前面百人醫療資料的新成效；三個特徵的單位任意，各列視為獨立設備。

![第一摺八列訓練資料學各轉換；四列驗證只能沿用，PCA 與 LDA 都遵守相同邊界](figure:l23303-m4-a-fit-boundaries)

1. `SimpleImputer` 只在訓練 X 學各欄平均，補好訓練空白。
2. `StandardScaler` 只在補好的訓練 X 學平均與尺度，再轉換訓練資料。
3. `LDA` 用轉換後的訓練 X **及同摺訓練 y** 學判別方向，再轉換訓練資料。
4. 分類器用降維後的訓練 X 與訓練 y 擬合。
5. 驗證 X 依序只做補值、縮放、LDA 的 `transform`，再 `predict`；驗證 y 只拿來評分。

Pipeline 會將 `fit(X_train, y_train)` 的訓練 y 傳給需要它的步驟。LDA 雖然也能當分類器，本例將它放在中間作監督式降維；二元標籤最多只產生一個判別成分。

下一摺重新複製整條流程，上一摺學得的補值、尺度、方向與模型都不沿用。若改用 PCA，改的是降維方法，不能改成全資料 fit。

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

### 最小的補值、縮放、LDA 實測

下列是與 JSON 完全相同的十二列數值。第二欄索引 1、7 缺值，`np.nan` 不代表 0；標籤前六列為 0、後六列為 1。

```python
from sklearn.impute import SimpleImputer
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis as LDA
from sklearn.model_selection import cross_validate
num_X = np.array([[1,10,2],[2,np.nan,4],[3,12,1],[4,9,5],
    [5,11,3],[6,13,2],[8,20,8],[9,np.nan,7],
    [10,19,9],[11,24,6],[12,22,10],[18,30,5]], dtype=float)
num_y = np.repeat([0, 1], 6)
numeric_pipe = Pipeline([("impute", SimpleImputer(strategy="mean")),
    ("scale", StandardScaler()), ("lda", LDA(n_components=1)),
    ("model", LogisticRegression(solver="liblinear", random_state=0))])
folds = list(StratifiedKFold(n_splits=3, shuffle=True,
                            random_state=17).split(num_X, num_y))
print(num_X.shape, np.bincount(num_y).tolist())
```
```text
(12, 3) [6, 6]
```

真正交給交叉驗證的是原始 `num_X`、`num_y` 與完整流程。`return_estimator=True` 取回每摺新擬合的模型，輸出其索引和參數；不是先在全資料 fit 再把結果切摺。

```python
audit = cross_validate(numeric_pipe, num_X, num_y, cv=folds,
    scoring="accuracy", return_estimator=True, error_score="raise")
for k, ((tr, va), fitted) in enumerate(zip(folds, audit["estimator"]), 1):
    print("摺", k, "train", tr.tolist(), "validation", va.tolist())
    print("補值", fitted["impute"].statistics_.round(6).tolist())
    print("縮放平均", fitted["scale"].mean_.round(6).tolist())
    print("縮放尺度", fitted["scale"].scale_.round(6).tolist())
    print("LDA類別中心", fitted["lda"].means_.round(6).tolist())
    print("LDA方向", fitted["lda"].scalings_.round(6).ravel().tolist())
print("各摺準確率", audit["test_score"].tolist())
```
```text
摺 1 train [0, 1, 2, 4, 6, 7, 10, 11] validation [3, 5, 8, 9]
補值 [7.25, 17.5, 5.0]
縮放平均 [7.25, 17.5, 5.0]
縮放尺度 [5.379359, 6.239992, 2.915476]
LDA類別中心 [[-0.836531, -0.781251, -0.857493], [0.836531, 0.781251, 0.857493]]
LDA方向 [1.803347, -0.154537, 1.860311]
摺 2 train [2, 3, 4, 5, 8, 9, 10, 11] validation [0, 1, 6, 7]
補值 [8.625, 17.5, 5.125]
縮放平均 [8.625, 17.5, 5.125]
縮放尺度 [4.741769, 6.946222, 2.97647]
LDA類別中心 [[-0.869928, -0.89977, -0.797925], [0.869928, 0.89977, 0.797925]]
LDA方向 [-4.997317, 10.387304, 4.401996]
摺 3 train [0, 1, 3, 5, 6, 7, 8, 9] validation [2, 4, 10, 11]
補值 [6.375, 15.833333, 5.375]
縮放平均 [6.375, 15.833333, 5.375]
縮放尺度 [3.497767, 4.780603, 2.446298]
LDA類別中心 [[-0.893427, -0.810567, -0.868659], [0.893427, 0.810567, 0.868659]]
LDA方向 [1.390822, 0.808072, 1.517182]
各摺準確率 [1.0, 0.75, 1.0]
```

第一摺補值的第二欄平均是 17.5，和資料洩漏頁的手算一致。LDA 類別中心列依 `classes_` 的 0、1 排列，數字是標準化後的座標；方向整體反號仍可表示同一投影軸。

這裡每摺只用八列訓練、四列評分，準確率只教流程，沒有設備部署效能的意義。完整分類器參數、各筆預測與每摺 `lda_fit_y_indices` 也保存在 JSON。

### 同一數值資料改走 PCA

為核對不讀 y 的轉換，另在每摺相同補值、縮放後的訓練資料上 fit PCA。這是替代 LDA 的路線；下面只檢查投影，不另外訓練分類器。

```python
from sklearn.decomposition import PCA
for k, ((tr, va), fitted) in enumerate(zip(folds, audit["estimator"]), 1):
    pre = fitted[:2]
    pca = PCA(n_components=1, svd_solver="full").fit(pre.transform(num_X[tr]))
    projected = pca.transform(pre.transform(num_X[va]))
    print("摺", k, "PCA方向", pca.components_.round(6).ravel().tolist(),
          "驗證形狀", projected.shape)
```
```text
摺 1 PCA方向 [0.605849, 0.606614, 0.514749] 驗證形狀 (4, 1)
摺 2 PCA方向 [0.626103, 0.616412, 0.477526] 驗證形狀 (4, 1)
摺 3 PCA方向 [0.599209, 0.571736, 0.560417] 驗證形狀 (4, 1)
```

PCA 只讀訓練 X，LDA 讀訓練 X、y；兩者驗證時都只 transform。不能以「PCA 不用答案」為理由，先把全部十二列放進 PCA。

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

- [scikit-learn：SimpleImputer](https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html)、[StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)、[LDA](https://scikit-learn.org/stable/modules/generated/sklearn.discriminant_analysis.LinearDiscriminantAnalysis.html)、[PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)（支持：新增逐摺例子的參數屬性、訓練標籤與替代投影）。
- [scikit-learn：cross_validate](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.cross_validate.html)（支持：實際交叉驗證、逐摺估計器與評分輸出）。

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
