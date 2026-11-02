---
id: incremental-learning
title: 增量學習與特徵空間變動
kind: technique
codes: [L23302]
aliases: [Incremental Learning]
requires: [feature-space]
summary: 增量學習分批更新既有模型，但新樣本與新增特徵是不同的變動
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-47]
goals:
  - id: g1
    text: 區分新樣本與新特徵，選擇固定欄位或固定維度雜湊，並檢查漂移與遺忘
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 耗電模型已用氣溫、氣溫平方兩欄做 partial_fit。第二批 20 筆多了一欄濕度，想接續更新，哪個判斷正確？
    options:
      A: 筆數同為 20，直接輸入三欄時舊模型會自動擴成三維
      B: 新欄只有一個，將名稱改成舊欄就能保留原特徵語意
      C: 欄位維度改變，應先固定表示或建立新版模型再驗證
      D: partial_fit 會重學全部歷史資料，所以欄位可以任意換
    answer: C
    explain:
      A: 新樣本筆數與特徵維度不同，SGDRegressor 不會自動擴充輸入維度。
      B: 改名稱不能讓濕度變成氣溫，會破壞欄位與權重的語意。
      C: 先處理表示契約，才能安全比較接續更新或版本重建。
      D: partial_fit 只看這次提供的批次，不會自動保存並重跑全部歷史。
  - id: c2
    goal: g1
    type: choice
    prompt: 客服文字每批都有新詞，系統從第一批起使用固定 1024 維特徵雜湊。哪個敘述正確？
    options:
      A: 新詞可映入原有 1024 維，但不同詞可能碰撞到同欄
      B: 新詞會各占新的欄位，因此每批輸入維度都隨之增加
      C: 固定維度就不會遺忘，舊任務的表現不必再留樣檢查
      D: 雜湊保存完整反向字典，所有權重都可還原為唯一詞
    answer: A
    explain:
      A: 固定輸出維度能處理未見過的詞，但雜湊碰撞會讓不同詞共用欄位。
      B: 雜湊維度固定，新詞映入既有欄，不會自動新增維度。
      C: 表示維度固定不保證模型記住舊任務，仍需檢查歷史留樣。
      D: 雜湊不維護唯一反向字典，碰撞也使權重無法逐一還原。
  - id: c3
    goal: g1
    type: choice
    prompt: 兩批製程資料共 40 筆，增量更新後新批驗證 MSE 下降，舊批留樣 MSE 卻從 2 升到 9。應如何處理？
    options:
      A: 只報新批下降結果，因為增量學習的目標不含舊資料
      B: 將舊批留樣拿來訓練，再用同一批數字證明模型改善
      C: 立即接受新版模型，因為欄位維度固定就不可能遺忘
      D: 檢查漂移與遺忘，再比較重播舊資料或重建模型版本
    answer: D
    explain:
      A: 若舊情境仍在服務範圍，忽略其退步會造成實際品質風險。
      B: 留樣一旦參與訓練，就不能仍作獨立驗證其改善的證據。
      C: 固定維度只處理表示契約，不保證舊知識不被新更新破壞。
      D: 先釐清分布是否改變及舊能力是否退步，再依服務需求比較策略。
---

## 為什麼需要（補充）

製程資料分批抵達，每次把全部資料重訓可能太慢。增量學習（Incremental Learning）讓模型保留目前狀態，用下一批樣本接續更新。

本頁處理批次更新與特徵表示的選擇。線上與增量學習另說明串流到達後的營運監控；這裡先把「多了幾列」與「多了一欄」分清楚。

## 直覺（補充）

同一張表新增 20 列，模型仍看到相同欄位，可以由支援的方法接續學習。若多了一欄濕度，輸入的特徵空間就改變了，既有權重不會自動多出對應位置。

![先問新增的是樣本還是欄位；只有表示契約一致，才能直接送進既有增量模型。](figure:l23302-incremental-learning-schema)

## 定義與公式（補充）

增量更新要求演算法支援接續學習，例如 scikit-learn 的 `partial_fit`。一般 `fit`、熱啟動（Warm Start）與增量學習不能視為完全相同的保證。

`SGDRegressor.partial_fit` 每呼叫一次，在提供的批次上走一輪更新。它不替你判斷已收斂，也不自動保留所有舊樣本；需要多輪時，要自行安排。

| 變動 | 既有表示是否改變 | 處理方向 |
|---|---|---|
| 新樣本、原欄位 | 不變 | 支援時接續更新 |
| 同欄但順序或單位不同 | 語意改變 | 先統一欄位契約 |
| 新增感測欄位 | 維度可能改變 | 固定表示或建立新版 |
| 新詞／新類別特徵值 | 字典可能變大 | 固定字典或雜湊 |
| 新的目標類別 | 輸出空間改變 | 另查分類器支援條件 |

固定特徵雜湊（Feature Hashing）把名稱映到固定數量的欄位，新名稱仍能使用相同輸出維度。代價是碰撞與較弱的可解釋性，不是把資訊無損壓入固定大小。

分類器第一次 `partial_fit` 常需透過 `classes` 指定完整目標類別。能接受新詞，不表示也能隨意新增輸出類別；這是另一份契約。

## 走一次流程（補充）

沿用容量頁的兩領域資料，每份 60 筆。原 40 筆訓練資料依固定索引分為舊批與新批各 20 筆；另 20 筆始終保留驗證，批次順序是教學安排，沒有宣稱真實時間關係。

1. 舊批用標準化設定值及其平方，欄位固定為 `x`、`x_squared`。
2. 新批仍用兩欄，沿用模型呼叫 `partial_fit`；核對權重確實改變。
3. 新批若再加入 `extra_feature`，變成三欄，原兩維模型會拒絕。
4. 若一開始採固定 8 維雜湊，舊批與新批的字典可有不同名稱，輸出仍為 8 欄。
5. 若需保留每欄解釋，建立欄位字典 v2，對齊舊新資料後重訓與驗證新版模型。

驗證資料不能參與特徵字典學習、縮放估計或更新。若重播歷史樣本以保留舊能力，重播資料也要與歷史留樣分開。

## 程式（補充）

執行前把 `IPAS_REPO_ROOT` 設成專案根目錄的絕對路徑。同頁各段接續執行；這段只驗證更新與形狀，不把一輪結果當最佳模型。

### 固定兩欄分批更新（補充）

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.linear_model import SGDRegressor
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23302-C-capacity-batches.json').read_text(encoding='utf-8'))
r = d['domains']['manufacturing']['rows']
z = np.array([v['x'] for v in r]); X = np.column_stack([z, z*z])
y = np.array([v['target'] for v in r])
old, new = d['batches']['old'], d['batches']['new']
m = SGDRegressor(random_state=23302, shuffle=False, penalty=None, learning_rate='constant', eta0=0.01)
m.partial_fit(X[old], y[old]); before = m.coef_.copy()
m.partial_fit(X[new], y[new])
print('兩批形狀:', X[old].shape, X[new].shape)
print('維度／已見樣本:', m.n_features_in_, int(m.t_-1))
print('權重已改變:', not np.array_equal(before, m.coef_))
```
```text
兩批形狀: (20, 2) (20, 2)
維度／已見樣本: 2 40
權重已改變: True
```

### 新增欄位不是新增列（補充）

```python
extra = np.array([v['extra_feature'] for v in r])
X3 = np.column_stack([X, extra])
try:
    m.partial_fit(X3[new], y[new])
except ValueError:
    print('既有兩維模型拒絕三欄輸入:', X3[new].shape)
```
```text
既有兩維模型拒絕三欄輸入: (20, 3)
```

### 從起點固定雜湊表示（補充）

```python
from sklearn.feature_extraction import FeatureHasher
h = FeatureHasher(n_features=8, input_type='dict')
a = [{'x': z[i], 'x_squared': z[i]**2} for i in old]
b = [{'x': z[i], 'x_squared': z[i]**2, 'extra_feature': extra[i]} for i in new]
Ha, Hb = h.transform(a), h.transform(b)
mh = SGDRegressor(random_state=23302, shuffle=False, penalty=None, learning_rate='constant', eta0=0.01)
mh.partial_fit(Ha, y[old]); mh.partial_fit(Hb, y[new])
print('雜湊形狀:', Ha.shape, Hb.shape)
print('模型維度:', mh.n_features_in_)
```
```text
雜湊形狀: (20, 8) (20, 8)
模型維度: 8
```

:::tip[讀碼重點]
第一段的維度一直是 2，只增加已見樣本。第三段是從第一批就採 8 維的新模型，不是把既有兩維權重直接搬進 8 維後就宣稱相容。
:::

## 怎麼用、怎麼判讀

:::supplement[來源：scikit-learn 大資料策略 10.1.1；Kirkpatrick 等人的持續學習研究；Rolnick 等人的經驗重播研究]
記錄欄位名稱、順序、單位、縮放與字典版本。維度相同但把氣溫改成濕度，仍然破壞契約；不要只檢查矩陣形狀。

新批更新可能適應概念漂移，也可能讓舊情境退步，稱為災難性遺忘（Catastrophic Forgetting）。要分開評估新批與仍需支援的歷史留樣，再比較重播、更新強度或重建模型。
:::

### 換個場景

指引在 UMAP 的優點提到支援增量學習（科目 3，4-47 頁），沒有另設專節或專屬領域場景。

:::supplement[來源：scikit-learn 大資料策略 10.1.1；scikit-learn 分批文字分類教學]
下列是增量 API 與固定表示原則的應用例；不是 UMAP 的增量訓練示範。

| 場景 | 變動 | 表示與判讀重點 |
|---|---|---|
| 製程感測 | 新樣本或新感測器 | 分清新增列與欄 |
| 能源消耗 | 新批資料與濕度欄 | 保留單位及字典版本 |
| 客服文字 | 未見過的詞 | 固定字典或雜湊碰撞 |
:::

## 常見誤解（補充）

- **partial_fit 自動重學全部歷史。** 它只更新這次提供的資料，歷史重播需另安排。
- **固定欄數就等於相容。** 欄位順序、單位與語意也要一致。
- **特徵雜湊能無損接納新特徵。** 它維持維度，但可能碰撞，也不會自動學會新特徵的影響。
- **新批改善就代表整體改善。** 舊能力可能退步，需另外留樣檢查。

## 進階

### 參考來源

- 科目 3 學習指引 `guide-3:4-47`：在 UMAP 優點中提及增量學習；本頁的分批 API、特徵契約與遺忘處理為操作補深。
- [scikit-learn 大資料策略 10.1.1](https://scikit-learn.org/stable/computing/scaling_strategies.html)：支持增量估計器、固定表示及目標類別限制。
- [SGDRegressor API](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.SGDRegressor.html)：支持 partial_fit 的一輪更新與固定特徵維度。
- [scikit-learn 特徵萃取 8.2.2](https://scikit-learn.org/stable/modules/feature_extraction.html)：支持固定雜湊、碰撞及無反向字典。
- [scikit-learn 分批文字分類教學](https://scikit-learn.org/stable/auto_examples/applications/plot_out_of_core_classification.html)：支持串接分批讀入、固定雜湊與增量估計器的教學流程。
- [Kirkpatrick 等人的持續學習研究](https://arxiv.org/abs/1612.00796)：支持順序學習後舊能力可能退步的風險。
- [Rolnick 等人的經驗重播研究](https://arxiv.org/abs/1811.11682)：支持比較歷史資料重播作為保留舊能力的策略，並非任何資料都保證有效。

## 小結（補充）

- 新樣本接續更新，與新增特徵改變輸入空間，是不同問題。
- partial_fit 需演算法支援，且不自動收斂或保存全部歷史。
- 固定字典或雜湊維持表示契約，新增欄位也可另建模型版本。
- 新批與歷史留樣都要評估，避免只看到適應、忽略遺忘。
