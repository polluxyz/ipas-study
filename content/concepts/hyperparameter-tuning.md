---
id: hyperparameter-tuning
title: 超參數調校
kind: technique
codes: [L21301, L23304]
aliases: [Hyperparameter Tuning, 超參數搜尋]
summary: 用驗證結果選訓練設定，固定流程後才以測試集評估
goals:
  - id: g1
    text: 分辨權重、梯度、批次大小與學習率的角色及設定來源
  - id: g2
    text: 規劃搜尋空間、對數尺度、指標、預算及獨立測試的調校流程
requires: [train-val-test-split]
guide_refs: [guide-3:5-30, guide-3:5-31, guide-3:5-32, guide-3:5-33, guide-3:5-34, guide-3:5-42, guide-3:4-5, guide-3:4-6]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊把批次大小設為 32、初始學習率設為 0.01，訓練後得到權重 0.72，某步梯度為 -0.4。哪個分類正確？
    options:
      A: 32 與 0.72 都是訓練學得的參數，0.01 與 -0.4 都是超參數
      B: 32 與 0.01 是超參數，0.72 是學得參數，-0.4 是計算的更新訊號
      C: 0.01 與 -0.4 都是學得參數，32 與 0.72 都是預先設定的超參數
      D: 四個數值都是超參數，因為每一個都能影響模型的訓練結果
    answer: B
    explain:
      A: 批次大小是訓練配置，梯度則由損失與當下權重計算。
      B: 超參數控制訓練配置，權重由擬合取得，梯度不是另一組可學權重。
      C: 學習率通常由配置或排程決定，0.72 則是訓練後的權重。
      D: 影響結果不代表都是超參數，來源與用途才是分類依據。
  - id: c2
    goal: g2
    type: choice
    prompt: 有 240 筆違約資料與 20 組候選預算，使用五摺驗證。哪個安排保留最終評估的獨立性？
    options:
      A: 對全部 240 筆先學標準化，再留下 48 筆測試並開始調校
      B: 每組都在 48 筆測試打分，用其中最高者作為最後模型
      C: 五摺每次改用不同指標，選出任何一摺最高的候選設定
      D: 先留 48 筆測試，192 筆內用固定五摺與 AUC 選設定後重訓
    answer: D
    explain:
      A: 測試資料已影響標準化的均值與變異，評估角色被破壞。
      B: 測試結果參與挑選後，不能再當獨立的最終評分。
      C: 指標與比較基準不一致，也沒有使用完整的五摺平均。
      D: 訓練摺內擬合前處理與模型，驗證選設定，測試最後才使用。
  - id: c3
    goal: g2
    type: choice
    prompt: 要在 0.001 到 10 之間試正則化相關設定，預算只有 5 個值，希望每個數量級都有代表。哪組最符合目的？
    options:
      A: 0.001、0.01、0.1、1、10，依倍數擴張涵蓋各個數量級
      B: 0.001、2.50075、5.0005、7.50025、10，依等差擴張涵蓋線性距離
      C: 6、7、8、9、10，集中高端以保證所有小值區間都不重要
      D: 0.001、0.002、0.003、0.004、0.005，集中低端以保證找到全域最好
    answer: A
    explain:
      A: 相鄰值相差十倍，能用少數候選涵蓋多個數量級。
      B: 這是線性等距，幾乎沒有代表低值的多個數量級。
      C: 沒有驗證依據可以保證低值區間不重要。
      D: 搜尋範圍沒有涵蓋原先設定的高值區間，也不能保證最優。
---

## 為什麼需要

同一資料與模型，改變學習率、批次大小或正則化強度，可能得到不同的穩定性與泛化結果。超參數調校（英文：Hyperparameter Tuning）用有計畫的比較來選設定。

訓練集學參數，驗證集選設定，測試集做最後評估。三種資料角色不能因為想提高分數而混用。

## 直覺

模型權重像每次練習學到的內容；超參數像安排練習的方法。把學習率從 0.01 改成 0.001，是改學習配置，之後仍須重新訓練權重。

下圖把資料的角色分開。五摺會輪流換驗證資料，但保留的 48 筆測試始終在搜尋之外。

![二十組候選都只能使用開發資料的五摺驗證，固定設定並重訓後才開啟測試集。](figure:l23304-hyperparameter-tuning-validation)

## 定義與公式

參數由訓練資料的擬合過程學得；超參數控制模型結構或訓練方式。不能因為兩個數值都影響結果，就把它們歸為同一類。

| 量 | 角色 | 來源 |
|---|---|---|
| 權重、偏置 | 可學習參數 | 訓練更新 |
| 梯度（補充） | 更新訊號 | 對當下損失微分 |
| 批次大小 | 超參數 | 人工設定或搜尋 |
| 初始學習率 | 超參數 | 人工設定或搜尋 |
| SVC 的 C、γ（補充） | SVC 超參數 | 決定候選後重新擬合 |

:::supplement[來源：scikit-learn Tuning the hyper-parameters 3.2；INRIA Set and get hyperparameters]
指引 5-30 把超參數描述成手動指定。本頁補足：自動搜尋也能根據驗證結果選超參數；「不是單次訓練直接學出的權重」不等於只能手調。
:::

## 走一次流程

訓練、驗證與測試的分工沿用指引。下面的候選空間、預算與摺內前處理是完整實作的補充。

### 規劃同一個調校實驗（補充）

1. 留測試：授信 240 筆先保留 48 筆，192 筆開發資料固定五摺索引；各摺都含兩類。
2. 定空間：RBF 核支援向量分類器（SVC）的 C 從 0.01 到 10，γ 從 0.001 到 10。
3. 定尺度：C 可試 0.01、0.1、1、10；γ 可試 0.001、0.01、0.1、1、10。以十倍間距採對數尺度（Log Scale）。
4. 定比較：每組均以五摺平均 ROC AUC 評分，20 組共 100 次擬合；標準化每次只學訓練摺。
5. 定收尾：依驗證選設定，對 192 筆重訓一次，最後才在 48 筆測試。測試結果不可回頭挑 C 或 γ。

對數尺度用相同倍數跨越各數量級。若改成線性等差切分，大部分候選會落在高值端，小值的數量級較難各有代表。

C 控制誤差懲罰，γ 控制 RBF 相似度的作用範圍。這裡先學如何安排調校，不展開 SVC 原理。

## 程式（補充）

重建共用授信資料與固定切分。收入單位為千元／月，負債比無單位，都是教學數值；分組欄位一人一筆，不送入模型。

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
X, y = make_classification(n_samples=240, n_features=2, n_informative=2,
    n_redundant=0, n_clusters_per_class=2, class_sep=.9, flip_y=.08, random_state=17)
X = np.column_stack([np.round(80+12*X[:,0], 4), np.round(.4+.07*X[:,1], 6)])
dev, test = train_test_split(np.arange(240), test_size=48, stratify=y, random_state=42)
cv = list(StratifiedKFold(5, shuffle=True, random_state=42).split(X[dev], y[dev]))
model = make_pipeline(StandardScaler(), SVC(kernel="rbf", random_state=42))
print(len(dev), len(test), len(set(dev) & set(test)))
```
```text
192 48 0
```

接著只傳開發資料給搜尋器。`refit=True` 在選定設定後，用傳入的 192 筆開發資料重訓。

```python
space = {"svc__C": [.01, .1, 1, 10], "svc__gamma": [.001, .01, .1, 1, 10]}
search = GridSearchCV(model, space, cv=cv, scoring="roc_auc", refit=True)
search.fit(X[dev], y[dev])
print(search.best_params_)
print(f"驗證 AUC={search.best_score_:.4f}")
print(f"測試仍保留={len(test)} 筆")
```
```text
{'svc__C': 1, 'svc__gamma': 1}
驗證 AUC=0.9203
測試仍保留=48 筆
```

:::tip[讀碼重點]
`StandardScaler` 放進 Pipeline，避免先看驗證摺。`best_score_` 是選參數用的驗證成績，沒有對測試集評分；測試要等整個選模流程固定後才做。
:::

## 怎麼用、怎麼判讀

指引列出的學習率與批次大小，適合用來調整梯度訓練的速度、穩定性和記憶體使用。容量與正則化設定則會影響擬合與泛化。

:::supplement[來源：INRIA Nested cross-validation；scikit-learn Common pitfalls 12.2]
搜尋次數越多，越可能挑到對目前驗證資料碰巧有利的設定。需要估計整個調參程序的表現時，使用巢狀交叉驗證，或另保留完全不參與選擇的測試資料。

同一人的多筆資料或先後相依的時序，不能直接照搬本例隨機分摺。要依使用情境改成群組或時間切分。
:::

### 換個場景

指引 5-31～5-33 提到 CNN、RNN、Transformer 及使用梯度方法的傳統模型；資料條件是需調整收斂、穩定性與資源的訓練，不限特定產業。

| 場景 | 可調設定 | 驗證注意 |
|---|---|---|
| CNN、RNN、Transformer | 學習率、批次大小 | 看收斂與記憶體限制 |
| 授信（補充） | C、γ 或類別權重 | 先隔離客戶，再確認評分方向 |
| 製造（補充） | 模型設定與特徵配置 | 同批多件時先隔離批次 |
| 交通（補充） | 正則化強度與視窗長度 | 訓練時間必須早於驗證 |

## 常見誤解

- 權重與學習率都會影響結果，所以都是超參數：要看它們由哪個過程產生。
- 超參數只能人工決定：自動搜尋也能用驗證結果選擇。（補充）
- `refit=True` 代表把測試集一起訓練：只使用傳給 `fit` 的資料。（補充）

## 進階

### 參考來源

- 科目 3 指引（版本未標示），guide-3:5-30～5-34、5-42、4-5～4-6：支持訓練設定、批次記憶體限制、容量、正則化、資料角色與梯度模型場景。
- [SVC API](https://scikit-learn.org/stable/modules/generated/sklearn.svm.SVC.html)：支持 C 的正則化角色與 γ 的核函數係數角色。
- [scikit-learn 調參指南 3.2](https://scikit-learn.org/stable/modules/grid_search.html)：支持自動調參及搜尋空間。
- [INRIA 設定與取得超參數課程](https://inria.github.io/scikit-learn-mooc/python_scripts/parameter_tuning_manual.html)：支持參數來源及從設定走到擬合的教法。
- [GridSearchCV API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GridSearchCV.html)：支持程式與 refit 的資料範圍。
- [INRIA 巢狀驗證課程](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_nested.html)、[Common pitfalls 12.2](https://scikit-learn.org/stable/common_pitfalls.html)：支持選優偏差與前處理界線。

## 小結

- 權重由擬合學得；批次大小與初始學習率控制訓練設定。
- 驗證挑設定，測試做最後評估。
- 先固定空間、尺度、指標與預算，再開始搜尋。（補充）
