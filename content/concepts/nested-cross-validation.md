---
id: nested-cross-validation
title: 巢狀交叉驗證
aliases: [Nested Cross-Validation, 巢式交叉驗證]
kind: technique
codes: [L23303, L23304]
requires: [k-fold-cross-validation]
mitigates:
  - target: data-leakage
    note: 內層交叉驗證挑超參數，外層交叉驗證估計表現；外層的驗證摺不參與挑參數
    source: [114-2-S1-Q41]
textbook: v2
summary: 巢狀交叉驗證用內層挑設定，再用未參與挑選的外層資料估成效
goals:
  - id: g1
    text: 區分內層調參、外層評估，以同一批候選的內外分數說明最佳調參分數偏樂觀的原因與波動
  - id: g2
    text: 算出巢狀流程的擬合次數與外層平均分數
  - id: g3
    text: 把前處理放進內層，並區分流程評估與最後建模
formula_groups:
  - id: nested-fit-count
    source: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GridSearchCV.html
    status: pending
    checked_by: null
  - id: outer-mean
    source: https://mathworld.wolfram.com/ArithmeticMean.html
    status: verified
    checked_by: task_a68af11027de
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊比較 30 組參數，把最高的平均交叉驗證分數當作上線成效。哪個說明最合理？
    options:
      A: 分數已參與選參數，可能連同切分的運氣一起被選中，需額外獨立評估
      B: "30 組設定都使用相同的資料摺，選出的最高平均分便不再受選模偏差影響"
      C: "將最高分扣掉 1 個百分點，即可補償比較 30 組設定造成的選模偏差"
      D: 把內層摺數提高，就能保證完全消除選模偏差
    answer: A
    explain:
      A: 對。選出最高分也會選中部分偶然誤差，外層可評估包含調參的整個流程。
      B: "錯。共用資料摺有助公平比較，但最高分仍參與了挑選，沒有因此成為獨立成效估計。"
      C: "錯。偏差取決於資料、模型與搜尋範圍，不能僅依比較 30 組就通用扣除 1 個百分點。"
      D: 錯。增加摺數沒有分開挑選與最終評估的角色。
  - id: c2
    goal: g2
    type: choice
    prompt: 有 4 組候選設定，內層 3 摺、外層 5 摺，每個外層選完都重訓一次。暫不做全開發資料的最終搜尋，需擬合幾次？
    options: {A: '60', B: '61', C: '65', D: '75'}
    answer: C
    explain:
      A: 錯。60 只計候選設定在內層的訓練，漏掉各外層的重訓。
      B: 錯。外層有五次重訓，不能只加一次。
      C: 對。每個外層需 4×3+1 次，五個外層共 65 次。
      D: 錯。選定後只重訓最佳設定，不是替每個內層摺額外重訓。
  - id: c3
    goal: g3
    type: choice
    prompt: 研究先對全部開發資料選出 20 個特徵，再把分類器交給內外層交叉驗證。哪項修正最合適？
    options:
      A: 只把外層改為分層切分
      B: 保留全資料特徵選擇，只提高外層摺數
      C: 選出分數最高的外層模型直接當最終模型
      D: 把特徵選擇與分類器包成 Pipeline，交給內層搜尋，再由外層評估
    answer: D
    explain:
      A: 錯。維持類別比例無法移除外層資料已參與特徵選擇的資訊。
      B: 錯。更多摺不會撤回切分前發生的資料洩漏。
      C: 錯。用外層分數選模型會讓外層也成為選模依據。
      D: 對。所有會學習資料的步驟都須受內外層資料邊界約束。
  - id: c4
    goal: g1
    type: choice
    prompt: 同一批三組候選中選出的內層最佳 MAE 是 0.610 箱，該設定重訓後的獨立外層 MAE 是 10.437 箱；另一摺則是內層 7.267、外層 3.333 箱。哪個判讀合理？
    options:
      A: 第一摺可回報 0.610 作獨立成效，因為已經挑出最佳設定
      B: 內層分數用來選參數，外層評估整個流程；單次高低可因抽樣反轉
      C: 第二摺外層誤差較小，證明巢狀流程的程式一定切錯資料
      D: 將每摺內外誤差較小者平均，可以得到更準確的獨立成效
    answer: B
    explain:
      A: 錯。最佳內層誤差已參與挑選，不能再冒充獨立評估。
      B: 對。兩者角色不同，內層選優有偏差風險，但不保證每摺誤差都較小。
      C: 錯。外層可能恰好較容易預測，分數反轉本身不是切分錯誤的證據。
      D: 錯。再挑內外較好者會引入新的選擇，沒有遵守外層固定評估的規則。
author: codex
status: draft
---

## 為什麼需要

學習指引 5.3 把驗證集用於調整設定，把測試集留給最後評估。先讀 K-fold 交叉驗證，再看本頁如何把這兩種角色放進兩層切分。

:::supplement[來源：scikit-learn Nested versus non-nested cross-validation；Inria Nested cross-validation]
巢狀交叉驗證（Nested Cross-Validation）處理的是「調參之後，要怎麼估成效」。指引 5.3 沒有展開此流程，本頁以下各節都是補充。

每組參數的分數都含有抽樣波動。從很多組中挑最高分，容易連同好運一起選中；直接回報最高分，整體上會偏樂觀。
:::

## 直覺（補充）

把一次「前處理、調參、重訓」視為完整的建模流程。內層只替這個流程選設定；外層拿沒參與選設定的資料，評估整個流程。

圖中的 `fit` 是從資料學規則；`transform` 是套用已學得的規則。內外層都必須分清這兩種動作的資料邊界。

![外層驗證資料留在邊界外，內層只能切分外層訓練資料](figure:l23303-nested-cross-validation-boundaries)

外層每輪都重新做一次內層搜尋。不同外層選到不同參數很正常，因為它們可用的訓練資料不同。

## 定義與公式（補充）

### 計算訓練成本

完整網格搜尋中，每個候選設定都做完所有內層摺；每個外層再用最佳設定重訓一次：

$$
N_{\mathrm{fit}}=K_o(CK_i+1)
$$

$N_{\mathrm{fit}}$ 是擬合次數，$K_o$、$K_i$ 是外、內層摺數，$C$ 是候選設定數。加一代表 `refit=True` 的重訓。

例如 $C=3$、$K_i=3$、$K_o=4$，共 $4(3\times3+1)=40$ 次。這只計評估流程，不含最後用全部開發資料重新搜尋的成本。

### 平均外層分數

$$
\bar{s}_{\mathrm{outer}}=\frac{1}{K_o}\sum_{k=1}^{K_o}s_k
$$

$s_k$ 是第 $k$ 個外層驗證分數，$\bar{s}_{\mathrm{outer}}$ 是其平均。若用平均絕對誤差，每個 $s_k$ 越小越好。

若四摺的誤差是 2、4、6、8 箱，平均為 $(2+4+6+8)/4=5$ 箱。這組假設分數只示範平均，下面另列共用資料的實測值。

以上假設完整搜尋、每個外層都重訓。隨機搜尋、提前淘汰候選或額外搜尋最終模型時，次數要按實際流程另算。

## 走一次流程（補充）

用共用的網路商店八筆資料，預測廣告費對應的出貨箱數。這裡把八個營業日視為可互換的獨立樣本；廣告費 `x` 不是日期。

1. 四個外層摺各留兩筆驗證，其餘六筆供內層使用。
2. 六筆分三摺，每組候選 `alpha` 做三次訓練與驗證。
3. 依內層平均絕對誤差選 `alpha`，再用六筆重訓。
4. 在剛才留出的兩筆評分；其餘外層重做完整流程。
5. 平均四個外層分數，描述這套調參流程的成效。

原檔的 `y_pred` 是指標教材用的既定預測。本頁重新訓練 Ridge 迴歸，所以只取 `x` 與 `y_true`，不沿用那些預測。

### 把內層最佳誤差當成績會發生什麼事

`L23303-M4-A-selection-bias.json` 保留八筆原值、種子與索引。每個外層都搜尋 `alpha=[0.1,1,10]`，選定後在外層訓練資料重訓，再評估另兩筆。

![四個外層各自搜尋相同三個候選；選中的內層最佳 MAE 與獨立外層 MAE 分開列出](figure:l23303-m4-a-nested-selection)

| 外層 | 選出的 alpha | 內層最佳 MAE（箱） | 同設定重訓後外層 MAE（箱） |
|---|---|---|---|
| 1 | 1 | 7.267 | 3.333 |
| 2 | 1 | 7.568 | 3.061 |
| 3 | 1 | 9.499 | 3.165 |
| 4 | 0.1 | 0.610 | 10.437 |

第四摺的三組候選內層 MAE 為 0.610、5.000、17.857 箱。錯誤報告把最低的 0.610 當最終成效；正確流程固定選出的 0.1，重訓後用外層索引 4、7 評估，得到 10.437 箱。

MAE 越小越好，第四摺重用內層誤差看起來特別漂亮；前三摺卻相反。外層平均 4.999 箱小於內層最佳誤差平均的 6.236 箱；小樣本的單次高低，不能證明或否定選優偏差。

選優偏差談的是「以同一批含噪估計挑最佳，再重用其分數」的風險；它不等於每次內層都必然高分。兩層的訓練量和驗證難度也不同，內外差值不能直接當成偏差的精確估計。

## 程式（補充）

第一段準備八筆共用資料與搜尋器。`neg_mean_absolute_error` 把誤差變負，讓搜尋器仍以「越大越好」選參數。

```python
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import GridSearchCV, KFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
X = np.arange(1, 9).reshape(-1, 1)
y = np.array([10, 20, 30, 40, 50, 60, 70, 100])
inner = KFold(n_splits=3, shuffle=True, random_state=11)
outer = KFold(n_splits=4, shuffle=True, random_state=7)
pipe = make_pipeline(StandardScaler(), Ridge())
search = GridSearchCV(pipe, {"ridge__alpha": [0.1, 1, 10]},
                      cv=inner, scoring="neg_mean_absolute_error")
print(X.shape, len(y))
```
```text
(8, 1) 8
```

第二段把整個搜尋器交給外層。`return_estimator=True` 可查看各外層自行選出的設定，但不能藉外層分數反覆挑設定。

```python
result = cross_validate(search, X, y, cv=outer,
                        scoring="neg_mean_absolute_error",
                        return_estimator=True)
mae = -result["test_score"]
print("各外層 MAE", np.round(mae, 3))
print(f"平均 MAE {mae.mean():.3f} 箱")
print("各外層 alpha", [m.best_params_["ridge__alpha"]
                         for m in result["estimator"]])
```
```text
各外層 MAE [ 3.333  3.061  3.165 10.437]
平均 MAE 4.999 箱
各外層 alpha [1, 1, 1, 0.1]
```

顯示的四個誤差平均約為 4.999 箱；計算使用未四捨五入的值。八筆資料很少，換分摺或套件版本可能改變結果，不應把這個數字當成商業預測成效。

### 同一候選的內層與外層實際輸出

外層回傳的每個搜尋器都保留自己的 `best_score_`。先把負 MAE 轉回正的誤差，再和該外層的獨立評分配對；沒有另換候選或外層切法。

```python
for k, fitted in enumerate(result["estimator"], 1):
    inner_mae = -fitted.best_score_
    candidate_mae = -fitted.cv_results_["mean_test_score"]
    print("外層", k, "候選MAE", candidate_mae.round(3).tolist())
    print("選出alpha", fitted.best_params_["ridge__alpha"],
          f"內層最佳MAE={inner_mae:.3f}，外層MAE={mae[k-1]:.3f}")
print("評估擬合次數", 4 * (3 * 3 + 1))
final_search = search.fit(X, y)
print("全開發資料重搜alpha", final_search.best_params_["ridge__alpha"])
print("含最後搜尋與重訓次數", 4 * (3 * 3 + 1) + 3 * 3 + 1)
```
```text
外層 1 候選MAE [10.244, 7.267, 24.333]
選出alpha 1 內層最佳MAE=7.267，外層MAE=3.333
外層 2 候選MAE [9.23, 7.568, 19.757]
選出alpha 1 內層最佳MAE=7.568，外層MAE=3.061
外層 3 候選MAE [13.047, 9.499, 22.437]
選出alpha 1 內層最佳MAE=9.499，外層MAE=3.165
外層 4 候選MAE [0.61, 5.0, 17.857]
選出alpha 0.1 內層最佳MAE=0.610，外層MAE=10.437
評估擬合次數 40
全開發資料重搜alpha 1
含最後搜尋與重訓次數 50
```

最後的 `search.fit(X, y)` 用全部八筆開發資料重新搜尋與重訓，對應原有成本算例的額外十次。此時仍沒有獨立測試成績；若要另外報交付模型的最後成效，須使用事前封存的測試資料。

:::tip[讀碼重點]
- `GridSearchCV` 是內層，`cross_validate` 的 `cv=outer` 是外層。
- `ridge__alpha` 用雙底線指定 Pipeline 裡 Ridge 的參數。
- 標準化也包在搜尋器內，每個內層訓練摺都重新擬合。
:::

## 怎麼用、怎麼判讀（補充）

適合需要調參、又想評估調參流程的情況，尤其資料不足以另留可靠測試集時。資料充足時，也可用開發資料調參，再用獨立測試集評估。

外層估計的是「這套流程用較少資料訓練時」的表現，仍有抽樣誤差。它不保證每次都比內層分數低，也不是上線成效的保證。

### 最後要交付哪個模型

評估結束後，固定流程與搜尋範圍，在全部開發資料重新調參、重訓，才得到交付模型。上例會再做 $3\times3+1=10$ 次，共 50 次。

若另有事前留出的最終測試集，直到此時才使用。外層各模型用來估成效，不以最高外層分數挑一個交付。

### 換個場景（補充）

指引 5.3 未列巢狀交叉驗證的專屬場景；以下為延伸應用。

| 場景 | 為什麼需要兩層 | 邊界 |
|---|---|---|
| 醫療檢測 | 比較不同特徵數與正則化強度 | 內外層均依病人分組，避免同一病人跨界 |
| 金融風控 | 同時調整模型與前處理參數 | 預測未來時，內外層都要保留時間方向 |
| 零售出貨量 | 比較多種模型設定後回報誤差 | 保持同樣指標與搜尋流程，再看外層結果 |

## 常見誤解（補充）

- 「再做一次交叉驗證就算巢狀」：外層每一輪都必須重新執行內層搜尋。
- 「外層不參與調參就萬無一失」：切分前全資料選特徵，仍會造成資料洩漏。
- 「兩層都只能用一般 K-fold」：群組或時間限制要同時套用兩層。
- 「最佳內層分數一定高於外層」：偏樂觀是統計傾向，單次結果可能相反。

## 進階（補充）

### 外層也可能被用來過擬合

若看到外層結果後不斷換模型、增加參數範圍，外層就逐漸參與決策。應事前固定流程，必要時保留新的獨立測試資料。

八筆資料只是教學演示；少數離群樣本就足以大幅改變各摺誤差。正式報告要保留外層分數與資料限制，不只報平均。

### 參考來源

- [Wolfram MathWorld：Arithmetic Mean](https://mathworld.wolfram.com/ArithmeticMean.html) 式（1）（支持：等權平均完整式；此處以外層摺數 $K_o$ 對應來源的 $N$，外層分數 $s_k$ 對應 $x_i$，分母是外層摺數）。

- [scikit-learn：巢狀與非巢狀比較](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html)（支持：為什麼需要、直覺、常見誤解）。
- [scikit-learn：GridSearchCV](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GridSearchCV.html)（支持：擬合成本推算、程式、最後建模）。
- [Inria 課程：Nested cross-validation](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_nested.html)（支持：流程、外層平均、怎麼判讀）。
- [Cawley 與 Talbot：選模造成的評估偏差](https://www.jmlr.org/papers/v11/cawley10a.html)（支持：為什麼需要、進階）。
- [scikit-learn：API 詞彙表](https://scikit-learn.org/stable/glossary.html#term-fit)（支持：直覺中的 fit 與 transform 說明）。

## 小結（補充）

- 內層挑設定，外層評估包含調參的完整流程。
- 前處理必須放在內層，不可先看全部資料。
- 外層結果有抽樣波動，不能保證未來成效。
- 最後用全部開發資料重新搜尋與重訓，不挑最高分的外層模型。
