---
id: embedded-feature-selection
title: Embedded 特徵選擇
kind: technique
codes: [L23301]
aliases: [Embedded, Feature Importance]
summary: Embedded 在模型訓練時取得選欄依據，但權重縮小不等於刪欄
goals:
  - id: g1
    text: 區分 Lasso 歸零、Ridge 收縮與樹重要性的篩選意義及閾值前提
requires: [lasso, decision-tree]
contrasts:
  - target: filter-feature-selection
    note: Embedded 依特定模型的訓練結果選欄，Filter 用模型之外的統計量初篩
    source: [guide-3:5-5]
  - target: wrapper-feature-selection
    note: Embedded 把選欄機制放進模型訓練，Wrapper 另外搜尋並反覆擬合候選集合
    source: [guide-3:5-5]
guide_refs: [guide-3:5-5, guide-3:5-6, guide-3:4-16, guide-1:5-5]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 縮放後的四欄迴歸係數，Lasso 為 (1.4,0,0.2,0)，Ridge 為 (0.8,0.3,0.2,0.1)。哪個判讀合理？
    options:
      A: 兩者都保留四欄，因為懲罰只影響驗證分數
      B: 兩者都刪除兩欄，因為懲罰方法必產生稀疏
      C: Ridge 自動刪兩欄，因較小的係數必等於零
      D: Lasso 可按零係數刪兩欄，Ridge 尚未刪欄
    answer: D
    explain:
      A: Lasso 這組係數有兩個零，可據此精簡輸入。
      B: Ridge 通常收縮係數，並不自動產生稀疏集合。
      C: 0.3 與 0.1 仍非零，額外設門檻才會變成選欄規則。
      D: 零係數與小係數要分開；這組 Ridge 係數仍使用全部四欄。
  - id: c2
    goal: g1
    type: choice
    prompt: 一棵樹的四欄重要性為 (0.7,0.2,0.1,0)。工程師要留下重要性至少 0.15 的欄位，如何解讀？
    options:
      A: 保留兩欄，且 0.15 是所有樹模型的通用門檻
      B: 保留兩欄，但門檻仍需以開發資料檢查效益
      C: 保留三欄，且任何非零值都必須大於 0.15
      D: 保留四欄，因有重要性就表示全部欄有因果
    answer: B
    explain:
      A: 門檻取決於模型、資料與需求，不能視為通用常數。
      B: 0.7 與 0.2 通過門檻，這是額外明定的篩選決策。
      C: 0.1 小於 0.15，非零不代表達到指定門檻。
      D: 重要性不是因果證明，零重要性也不能證明永遠無用。
  - id: c3
    goal: g1
    type: choice
    prompt: 假設另一次訓練使用 24 筆授信開發資料，年收入恰為月收入的 12 倍。若 Lasso 只留月收入，接下來應如何處理？
    options:
      A: 據此判定年收入無因果，停止追蹤資料品質
      B: 據此判定月收入最穩定，省略後續驗證程序
      C: 檢查換摺後名單穩定度，再比較泛化與成本
      D: 把年收入重新命名加入，視為新增獨立訊號
    answer: C
    explain:
      A: 共線欄可以互相替代，不能由一次歸零推斷因果。
      B: 高度相關的欄位可能輪流被選中，仍需驗證穩定性。
      C: 名單穩定、泛化表現與取得成本都是挑欄時的實際考量。
      D: 改名沒有改變數值關係，不會創造獨立訊號。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

Wrapper 要反覆訓練許多欄位集合，成本可能太高。Embedded 特徵選擇（Embedded Feature Selection）在模型訓練時，就用懲罰或分裂機制形成選欄依據。

這種依據和模型綁在一起。換模型、懲罰強度或樹深度，選中清單可能改變，不能視為資料本身永遠固定的排名。

## 直覺

Lasso 會讓部分係數歸零；樹模型則在建立分支時，逐步決定哪些特徵能改善分裂。兩者都在學預測時取得欄位使用資訊。

Ridge 通常把係數縮小，沒有直接把欄位拿掉。指引 5-5 把它和 Lasso 並列，但同一本指引 4-16 已指出 Ridge 不會自動完成特徵選擇。

## 定義與公式

本頁以Lasso歸零、Ridge收縮與樹分裂重要性比較3種訓練產物；這是本頁的閱讀範圍，不表示每種Embedded方法都使用這3種模型。

| 模型依據 | 訓練產物 | 能否直接形成刪欄名單 |
|---|---|---|
| Lasso 的 L1 懲罰 | 有些係數可等於零 | 可依零係數篩選 |
| Ridge 的 L2 懲罰 | 係數通常縮小但非零 | 通常不能自動刪欄 |
| 樹的分裂重要性 | 各欄分裂貢獻 | 依分裂判斷欄位使用 |

Lasso 與嶺迴歸頁已列完整目標式。本頁重點是把「訓練的權重」轉成「哪些欄位要留下」，不重複推導懲罰公式。

:::supplement[來源：scikit-learn SelectFromModel；Feature importances with a forest of trees]
若採絕對係數或重要性門檻，先確認尺度、重要性定義與保留方向。門檻是模型流程的一部分，應在開發資料內決定，再驗證精簡後的模型。

樹的重要性也可能偏好可切分點多的欄位。共線欄可能分攤或互相取代重要性；分裂貢獻不是獨立的因果效果。
:::

## 走一次流程

### 同一份資料，分清目標（補充）

仍用授信 36 筆、六欄與固定的 24／12 切分。為示範 Lasso、Ridge 的係數，改預測 JSON 裡的連續損失金額；樹則預測原本的違約標籤。

1. 用 24 筆開發資料估計標準化，避免年收入的大單位左右懲罰。
2. 以相同數值強度 5 分別擬合兩種迴歸，只示範收縮與歸零。
3. Lasso 保留負債比、年齡、雜訊三欄；Ridge 六欄都非零。
4. 另擬合深度最多 2 的分類樹，這次只用負債比分裂。

| 欄位群 | Lasso 係數 | Ridge 係數 |
|---|---:|---:|
| 月收入、年收入 | 0、0 | 0.4479、0.4479 |
| 負債比 | 96.4040 | 83.7717 |
| 年齡 | 5.9599 | 8.8347 |
| 年資、雜訊 | 0、7.6542 | 2.0016、8.6393 |

合成損失刻意含有雜訊欄的數值，所以它在迴歸任務會有係數。「雜訊」只描述它對違約分類的角色，不能推論它對所有目標都無用。

此目標未直接使用收入；本次 Lasso 的兩個收入係數都為零，尚未示範相關欄擇一。若收入本身有訊號，Lasso 可能只保留其中一欄；下方另用相同開發列展示。

同一數值的 alpha 在兩個 API 對應不同尺度，不能用這個表判斷誰懲罰較強。

## 程式（補充）

先重建同一份六欄資料與切分。

```python
import numpy as np
i = np.arange(36); j = i // 2; y = i % 2
income = 50 + 5 * (2 * (j % 6) - 5)
ratio = .5 + .1 * (2 * y - 1) + .02 * (j // 6 - 1)
age, tenure, noise = 25 + 7*j%17, 1 + 5*j%9, 11*j%13
X = np.column_stack([income, 12*income, ratio, age, tenure, noise])
tr, te = j%3 != 2, j%3 == 2
print("訓練與測試", X[tr].shape, X[te].shape)
```
```text
訓練與測試 (24, 6) (12, 6)
```

```python
from sklearn.linear_model import Lasso, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
Z = StandardScaler().fit_transform(X[tr])
loss = 1000*ratio + 2*age + 3*noise
for model in [Lasso(alpha=5, max_iter=100000, tol=1e-10), Ridge(alpha=5)]:
    model.fit(Z, loss[tr])
    print(type(model).__name__, model.coef_.round(4).tolist())
tree = DecisionTreeClassifier(max_depth=2, random_state=17).fit(X[tr], y[tr])
print("樹重要性", tree.feature_importances_.tolist())
```
```text
Lasso [0.0, 0.0, 96.404, 5.9599, 0.0, 7.6542]
Ridge [0.4479, 0.4479, 83.7717, 8.8347, 2.0016, 8.6393]
樹重要性 [0.0, 0.0, 1.0, 0.0, 0.0, 0.0]
```

:::tip[讀碼重點]
迴歸預測連續金額，不能把輸出當違約機率。這段只示範訓練產物；若要比較效果，需把縮放與篩選放回每一摺驗證。
:::

### 收入有訊號時的相關欄（補充）

沿用相同 24 筆開發列與兩個收入欄，另把月收入當作教學目標，觀察完全共線的欄位如何被選中。這不是原來的損失預測，也不是實際授信任務。

```python
Z_income = StandardScaler().fit_transform(X[tr, :2])
for order in [[0, 1], [1, 0]]:
    model = Lasso(alpha=5, max_iter=100000, tol=1e-10)
    model.fit(Z_income[:, order], income[tr])
    back = np.zeros(2)
    back[order] = model.coef_
    back[np.abs(back) < 1e-8] = 0
    print("月收入、年收入係數", back.round(4).tolist())
```
```text
月收入、年收入係數 [10.8114, 0.0]
月收入、年收入係數 [0.0, 10.8114]
```

只交換輸入順序，再把係數對回月收入、年收入的原順序，就看到選中欄位互換。這個完全共線例子的預測相同，名單卻不同，不能把一次入選當成唯一重要欄位。

## 怎麼用、怎麼判讀

指引把 Embedded 定位成訓練內完成篩選，適合有支援機制的模型。Lasso 尤其適合高維、共線且希望精簡欄位的情境，但相關欄可能只留其中一個。

不要只看零係數數量。懲罰過強可能欠擬合。

:::supplement[來源：scikit-learn SelectFromModel]
樹重要性高也未保證精簡之後仍有相同表現，需重新驗證整個流程。
:::

### 換個場景

| 場景或資料條件 | 可用依據 | 判讀重點 |
|---|---|---|
| 高維、共線，希望同時篩欄 | Lasso 非零係數 | 名單可能不穩定 |
| 特定樹或正則化模型 | 訓練內的重要性或權重 | 超參數改變結果 |
| 授信（補充） | 損失迴歸或違約分類 | 不同目標要重新篩欄 |
| 製造（補充） | 少量感測器的預測貢獻 | 精簡後仍需檢查瑕疵召回 |
| 客服（補充） | 高維詞特徵的稀疏權重 | 詞彙替代性會影響名單 |

## 常見誤解

- Ridge 縮小權重就已刪掉欄位：非零係數仍會使用該欄。
- 單次歸零表示永遠無用：相關欄可能已替代它。
- 樹模型有重要性就自動產生精簡輸入：部署時仍需明定篩選、重訓與輸入契約。（補充）

## 進階

### 閾值不是標準答案（補充）

四欄重要性為 0.7、0.2、0.1、0，門檻設至少 0.15 就保留前兩欄。這只是指定規則的結果；換資料、重要性算法或門檻，集合都可能改變。

### 參考來源

- 科目 3 指引 guide-3:5-5～5-6、4-16；科目 1 guide-1:5-5（版本未標示）：支持 Embedded、Lasso、Ridge 區別及適用條件；未指定本頁產業。
- [Lasso API](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html)、[Ridge API](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)：支持係數範例與 alpha 尺度說明。
- [SelectFromModel API](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.SelectFromModel.html)：支持重要性閾值與保留規則。
- [官方樹重要性教學](https://scikit-learn.org/stable/auto_examples/ensemble/plot_forest_importances.html)：參考重要性表與偏誤限制的教法。
- [官方 model-based 與 sequential 比較教學](https://scikit-learn.org/stable/auto_examples/feature_selection/plot_select_from_model_diabetes.html)：參考訓練內依據與外部搜尋的對照。

## 小結

- Embedded 在訓練中取得篩選依據，結果依模型與超參數而變。
- Lasso 可歸零；Ridge 通常僅收縮，不能直接當自動選欄。
- 樹重要性需搭配保留規則與驗證。（補充）
- 名單簡短不等於穩定，也不等於預測更好。
