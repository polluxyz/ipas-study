---
id: train-val-test-split
title: 訓練集、驗證集與測試集切分
aliases: [資料切分, Train/Validation/Test Split, Holdout]
kind: technique
codes: [L23303]
guide_refs: [guide-3:5-17, guide-3:5-18]
textbook: v2
summary: 把資料分開用：訓練模型、挑選設定，最後檢查模型處理新資料的表現
goals:
  - id: g1
    text: 說得出三份資料各自能參與的決策，配對分類與迴歸指標，走完訓練、選模到最後測試
  - id: g2
    text: 做出可重現的切分，指出前處理、時間與群組造成的洩漏風險
formula_groups:
  - id: split-size
    source: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊用 6 筆交易訓練、2 筆驗證、2 筆測試。比較三組設定並選好之後，下列哪個是較常見且保留獨立測試的流程？
    options:
      A: 依測試分數反覆調整超參數，再回報同一測試集成績
      B: 保留最佳設定的模型，以原本 6 筆訓練成績回報最終效能
      C: 固定設定，以 8 筆開發資料重訓，再評估測試集
      D: 將全部 10 筆合併重訓，再回報模型對這 10 筆的成績
    answer: C
    explain:
      A: 測試分數參與挑選後，就失去獨立評估的角色。
      B: 模型已學過這 6 筆，訓練成績可能高估泛化表現。
      C: 設定先固定，最後評估使用一直未參與開發的測試資料。
      D: 用同一份資料訓練並評估，無法檢查對未見資料的泛化。
  - id: c2
    goal: g2
    type: choice
    prompt: 工廠要辨識從未見過的新零件，每個零件有 8 張近乎相同的照片。應優先如何切分？
    options:
      A: 依零件 ID 分組，同一零件不跨資料集
      B: 每個零件各抽 6 張訓練、1 張驗證、1 張測試
      C: 只維持三份資料的瑕疵比例，允許同一零件跨資料集
      D: 先用所有照片選出最佳特徵，再隨機切成三份資料
    answer: A
    explain:
      A: 依零件分組才能模擬模型遇到全新零件的情境。
      B: 相近照片跨資料集會讓模型在評估時遇到熟悉的零件。
      C: 分層只顧類別比例，沒有阻止同一零件的資訊跨集合。
      D: 特徵選取會學習資料，先看全部照片已引入評估資訊。
  - id: c3
    goal: g1
    type: choice
    prompt: 10 筆資料先留出 2 筆測試，剩餘 8 筆再留出 2 筆驗證。第二次切分若用比例參數，驗證占這次輸入資料的比例是多少？
    options:
      A: '0.20'
      B: '0.60'
      C: '0.80'
      D: '0.25'
    answer: D
    explain:
      A: 0.20 是驗證占原始 10 筆的比例，第二次的分母已變成 8。
      B: 0.60 是最終訓練占全部資料的比例。
      C: 0.80 是第一次留下的開發資料占比。
      D: 第二次切分輸入 8 筆，2 除以 8 得 0.25。
  - id: c4
    goal: g2
    type: choice
    prompt: 用 36 個月的交通資料預測未來流量，特徵需要標準化。哪個做法能同時避免時間與前處理的資訊洩漏？
    options:
      A: 將全部月份洗牌切分，再只用訓練集擬合標準化
      B: 按時間切分，只用訓練集擬合標準化
      C: 按時間切分，先用全部 36 個月擬合標準化
      D: 將全部月份洗牌切分，先用全部資料擬合標準化
    answer: B
    explain:
      A: 洗牌會讓較晚月份進入訓練，無法模擬預測未來。
      B: 訓練月份早於驗證與測試，轉換參數也只從訓練資料學得。
      C: 全部月份參與標準化擬合，未來資料的統計量已進入開發流程。
      D: 同時引入較晚月份與評估資料的統計量，兩種洩漏都存在。
  - id: c5
    goal: g1
    type: choice
    prompt: 團隊同時做盜刷分類與出貨箱數預測，測試集已封存。哪種指標與選模安排合理？
    options:
      A: 分類用 MAE；箱數用 Accuracy；反覆比較測試集來挑設定
      B: 分類依漏報成本看 Recall；箱數看 MAE；用驗證比較設定、測試留最後
      C: 分類只看整體 Accuracy；箱數只看 AUC；用訓練分數代替最終測試
      D: 分類依漏報成本看 Recall；箱數看 MAE；每次調參後都看測試再決定
    answer: B
    explain:
      A: 兩種任務的指標配錯，且測試參與挑設定後便不再獨立。
      B: 分類關注漏報可看召回率，數量誤差可看平均絕對誤差；資料分工也正確。
      C: AUC 衡量分類排序，訓練分數也不能取代未見資料評估。
      D: 指標配對合理，但把測試結果拿來挑設定仍破壞最後評估的界線。
author: codex
status: draft
---

## 為什麼需要

模型可以把看過的資料記得很好，卻不會處理新資料。因此，要把學習、挑設定與最後評估用的資料分開。

這叫資料分割（Train/Validation/Test Split）。我們要看模型處理新資料的能力，稱為泛化（Generalization）。不只看模型記住多少訓練資料。

## 直覺

- 訓練集（Training Set）用來讓模型從資料學習參數。參數是模型從資料學到的數值。
- 驗證集（Validation Set）用來挑超參數。超參數（Hyperparameter）是人事先選定的訓練設定。也用驗證集監控訓練時的表現。
- 測試集（Test Set）留到開發結束後才用。用來檢查模型處理新資料的表現。

![先看三份資料各做什麼，再看開發時如何配合。設定固定後，才用測試集評估。](figure:l23303-train-val-test-split-roles)

:::supplement[來源：Google Machine Learning Crash Course：Datasets: Dividing the original dataset]
若用測試成績挑設定，測試資訊就會影響模型。即使沒讓模型用測試資料學參數，也一樣。此後要換一份未用過的資料，才能重新檢查處理新資料的能力。
:::

## 定義與公式

| 資料 | 可以做什麼 |
|---|---|
| 訓練集（Training Set） | 學習模型參數 |
| 驗證集（Validation Set） | 調超參數、監控訓練與泛化表現 |
| 測試集（Test Set） | 設定固定後做最後評估 |

:::supplement[來源：scikit-learn train_test_split API；Google Machine Learning Crash Course：Datasets: Dividing the original dataset]
三份資料互不重疊。訓練與驗證合稱本頁的「開發資料」；比例沒有通用標準，要考慮總量、少數類別數與實際預測對象。

訓練分數不能單獨證明泛化良好。驗證成績可以用來選模型、決定早停，但反覆挑選後的最佳成績不算獨立評估；測試集則不參與選特徵、調閾值或選模型。

$$
n=n_{\mathrm{train}}+n_{\mathrm{val}}+n_{\mathrm{test}}
$$

$n$ 是總筆數，三個下標依序表示訓練、驗證、測試筆數。共用例子有 10 筆，切成 6、2、2，驗算是 $10=6+2+2$。

若分兩次切，第二次比例的分母是剩下的開發資料。要留 2 筆驗證，比例為 $2/(10-2)=0.25$，不是 0.20。
:::

## 走一次流程

### 三份資料如何配合

1. 用訓練集學習模型參數。
2. 用驗證集調整超參數，並監控訓練過程與泛化表現。
3. 選定設定後，可合併訓練與驗證資料，重新擬合前處理與模型。（補充）
4. 模型訓練完成後，用測試集做最後評估，模擬面對未知資料的表現。

### 用十天交易資料走完開發（補充）

沿用 `L23303-splits.json`：S01–S10，標籤 1 是盜刷，正負各 5 筆。下例只示範獨立樣本的隨機切分；日期仍保留，但不拿來預測未來。

| 角色 | 樣本 ID | 負類／正類 |
|---|---|---|
| 訓練 | S02、S03、S05、S06、S08、S09 | 3／3 |
| 驗證 | S01、S04 | 1／1 |
| 測試 | S07、S10 | 1／1 |

1. 先封存測試集的 S07、S10，所有開發決策都不查看它們的成績。
2. 每組候選設定只用 6 筆訓練資料學參數，再用同一份 2 筆驗證資料比較。
3. 標準化、補值與特徵選取也只在訓練集擬合，使用相同轉換處理驗證集。
4. 選定設定後，可用 8 筆開發資料重新擬合前處理與模型。
5. 最後才轉換並評估 2 筆測試資料，回報成績與評估限制。

測試集只有 2 筆，準確率只能是 0、0.5 或 1。這足以教流程，卻不足以支持可靠的金融風險結論；資料漂移也可能讓日後表現改變。

### 三份資料共用同一任務指標

先定義「預測什麼、錯了有何代價」，再固定評估指標。分類的輸出是類別或分數，迴歸的輸出是數值；不能把迴歸數量硬當成分類正確率。

| 分類指標 | 看什麼 | 教材 |
|---|---|---|
| Accuracy | 整體判對比例；類別懸殊時可能掩蓋漏報 | [[accuracy]] |
| Precision | 判為正類者有多少真的為正，關注誤報 | [[precision]] |
| Recall | 真正正類有多少被找出，關注漏報 | [[recall]] |
| F1 | 同時考慮 Precision 與 Recall 的平衡 | [[f1-score]] |
| AUC（此處指 ROC-AUC） | 分類分數對正負樣本的排序能力 | [[roc-auc]] |

:::supplement[來源：scikit-learn Metrics and scoring；Google ML Crash Course 分類指標]
二元分類的 Accuracy、Precision、Recall、F1 通常針對固定閾值；AUC 看跨閾值排序，不保證漏報可接受。評估資料只有單一類別時，不能定義二元 ROC-AUC。
:::

| 迴歸指標 | 看什麼 | 教材 |
|---|---|---|
| MAE | 平均絕對誤差，和目標同單位，越小越好 | [[mean-absolute-error]] |
| MSE | 平均平方誤差，大誤差代價較重，單位平方 | [[mean-squared-error]] |
| RMSE | 平方誤差平均後開根號，回到目標單位 | [[root-mean-squared-error]] |
| R² | 相對於以評估資料平均值作常數預測的比較 | [[r-squared]] |

:::supplement[來源：scikit-learn Metrics and scoring；Google ML Crash Course 分類指標]
盜刷偵測可優先比較驗證 Recall，並監看 Precision；出貨箱數可用驗證 MAE 選設定。指標、正類、閾值與報告規則在開發階段決定，最後對測試集沿用。

測試成績不能再拿來挑指標或重調閾值。MAE、MSE、RMSE 越小越好；R² 可為負，目標為常數時另有定義問題，詳見指標頁。
:::

## 程式

### 分兩次留出資料（補充）

`train_test_split` 每次只切兩份，因此先留出測試集，再從開發資料切驗證集。以下標籤逐筆對應共用資料；索引從 1 起算。

```python
import numpy as np
from sklearn.model_selection import train_test_split

ids = np.arange(1, 11)
y = np.array([0, 0, 0, 1, 1, 1, 0, 1, 0, 1])
dev, te = train_test_split(ids, test_size=2, stratify=y, random_state=42)
tr, va = train_test_split(dev, test_size=2, stratify=y[dev-1], random_state=42)
for name, part in [("訓練", tr), ("驗證", va), ("測試", te)]:
    counts = np.bincount(y[part-1], minlength=2).tolist()
    print(name, sorted(part.tolist()), "負/正", counts)
```
```text
訓練 [2, 3, 5, 6, 8, 9] 負/正 [3, 3]
驗證 [1, 4] 負/正 [1, 1]
測試 [7, 10] 負/正 [1, 1]
```

:::tip[讀碼重點]
- `test_size=2` 是留出 2 筆，不是留出 2%；第二次仍明確留 2 筆。
- `stratify` 依標籤盡量維持比例，不會按病人或客戶分組。
- `y[dev-1]` 讓第二次的標籤對齊剩下的 ID；ID 不能直接當作從 0 開始的陣列位置。
- `random_state=42` 固定切分；模型若有隨機步驟，仍須另外固定種子。
:::

## 怎麼用、怎麼判讀

K-fold 交叉驗證在資料有限時最有幫助，可以減少單次驗證集切分的偶然性。不過每組設定要擬合 $K$ 次，資料量或模型很大時，需先衡量運算成本。

### 切分要模擬將來遇到的資料（補充）

| 情況 | 選擇 | 檢查重點 |
|---|---|---|
| 獨立樣本且資料足夠 | 一次留出訓練、驗證與測試 | 評估集是否有代表性 |
| 資料少，單次驗證晃動大 | 開發資料用 K-fold 交叉驗證 | 測試集仍先留出；切摺流程見該頁 |
| 類別不平衡 | 分層切分 | 每份少數類別是否足夠 |
| 同一人或物件有多筆資料 | 依人或物件分組切分 | 同一群組不可跨集合 |
| 要預測未來 | 按時間先後切分 | 訓練資料與特徵只能來自預測當時可取得的資訊 |

本頁是 K-fold 交叉驗證的前置概念，讀完資料角色後再接該頁。K-fold 改變的是開發資料的驗證方式，測試集的角色不變。

### 換個場景（補充）

| 場景 | 如何切 | 判讀重點 |
|---|---|---|
| 醫療影像 | 以病人分組保留測試資料 | 新病人診斷要避免同一病人的影像跨集合 |
| 製造瑕疵檢測 | 以實體零件分組切照片 | 同一零件的近似照片不能當成獨立測試 |
| 交通流量預測 | 較早時段訓練，較晚時段驗證、測試 | 單次時間切分只反映該時段，可再看時間序列交叉驗證 |

## 常見誤解

:::supplement[來源：scikit-learn User Guide 3.1 Cross-validation；Google Machine Learning Crash Course：Datasets: Dividing the original dataset]
- 「固定種子就沒有洩漏」：種子只讓切法重現，不能修正同一病人跨集合或先對全資料擬合前處理。
- 「驗證集完全不能影響模型」：它本來就會影響設定與早停，只是不直接用來學訓練參數。
- 「測試準確率高就保證上線好」：切分不符未來環境、評估樣本太少或發生資料漂移，都會限制結論。
:::

## 進階

### 指引對資料量的說法不同

指引 5-18 先以資料充足描述 K-fold，隨後又強調資料有限時的價值；5-27 則將中大型資料列為適用情況。這幾處對資料量的說法不一致。

本頁採用「資料有限時最有幫助」的解釋，同時提醒反覆擬合的成本。資料多也能使用 K-fold，但是否值得，仍要看訓練代價。

### 測試後發現問題怎麼辦（補充）

可以修正模型，但若根據測試結果修改，就要把這份測試資料視為開發資訊。記下修改原因，另找未參與決策的資料進行新的最終評估。

### 參考來源

- 科目 3 學習指引 4.1，4-5（支持：分類／迴歸任務區分）；5.3，5-25（支持：分類／迴歸指標配對）；4.2 線性迴歸、5.3 模型評估（支持：RMSE 與 AUC 等指標的延伸清單）。
- [scikit-learn：Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)、[Google ML Crash Course：分類指標](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)（支持：指標用途與限制；閾值、獨立評估導讀標為補充）。

- 科目 3 學習指引 5.3，5-17～5-18（支持：為什麼需要、三份資料角色）。
- [scikit-learn train_test_split API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html)（支持：定義與公式、兩次切分程式）。
- [scikit-learn User Guide 3.1](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：怎麼選切法、前處理與時間群組限制）。
- [Google 機器學習速成課程：資料集切分](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)（支持：直覺、開發流程、常見誤解與測試後修正）。
- [Inria scikit-learn 課程：Cross-validation framework](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_train_test.html)（支持：為什麼需要；參考以未見資料檢查泛化的教學順序）。

## 小結

- 訓練集學參數，驗證集挑設定，測試集做最後評估。
- 先切分，再只用訓練資料擬合前處理；選定設定後才可以合併開發資料重訓，並非每個流程都必須重訓。
- 切分要對應未來的預測對象，並處理時間、群組與類別比例。
- 反覆用測試成績改模型，便需要新的獨立資料評估。
