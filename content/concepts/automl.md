---
id: automl
title: 自動化機器學習
kind: technique
codes: [L23302]
aliases: []
requires: [train-val-test-split, random-forest]
summary: 自動化機器學習替人搜尋特徵、模型與參數組合，目標、驗證及核可仍需人工負責
goals:
  - id: g1
    text: 依人力、時程、客製化與成本隱私條件判斷AutoML適用性
  - id: g2
    text: 設計固定搜尋與獨立測試流程，辨識反覆選模的樂觀偏誤
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 甲有2人、2週做零售POC，可用核可雲端；乙需客製架構且敏感資料限內網。哪個建議合理？
    options:
      A: 甲乙都直接使用公有雲；AutoML會自動消除兩組資料的隱私風險
      B: 甲可評估現成AutoML；乙先查內網可用性、客製支援與長期成本
      C: 甲乙都直接自行開發；只有完整自建才能做出任何可驗證的POC
      D: 甲可略過所有資料檢查；乙可略過架構需求直接接受搜尋勝出者
    answer: B
    explain:
      A: 自動搜尋不會自動排除雲端資料處理的隱私限制。
      B: 現成工具可降低門檻，但仍須核對實際需求與資源限制。
      C: POC可以使用現成工具，不必把完整自建當成唯一方式。
      D: 資料品質及客製化需求都不會因搜尋自動化而消失。
  - id: c2
    goal: g2
    type: choice
    prompt: 80筆先封存20筆，60筆內3摺比較三候選；工程師每看一次測試結果就換候選。哪項修正合理？
    options:
      A: 候選只依開發摺選；規格凍結重訓後，測試僅作最終獨立評估
      B: 候選只依測試分數選；測試反覆使用越多，泛化估計就越公正
      C: 候選只依訓練誤差選；不必保留開發摺，也不必進行獨立評估
      D: 候選先看全部測試標籤；只要種子固定，就不會有資訊回流風險
    answer: A
    explain:
      A: 選模留在開發資料內，才能保留最終測試的獨立角色。
      B: 反覆依測試挑模型會讓測試參與選擇，估計可能過度樂觀。
      C: 訓練誤差可能反映過擬合，無法取代開發與獨立評估。
      D: 固定種子只能重現程序，不能修復測試資訊回流。
  - id: c3
    goal: g2
    type: choice
    prompt: 同60筆開發資料，邏輯迴歸3摺平均Logloss為0.630642、森林0.633683；以較低者選模。下一步為何？
    options:
      A: 森林數值較大，依規則選森林，再以測試資料調整它的樹深
      B: 迴歸數值較低，保證未來必勝，因此取消所有最終測試流程
      C: 迴歸數值較低，先定案重訓；差距小仍需保留不確定性與測試
      D: 森林樹數較多，忽略兩個分數，直接宣稱森林取得最佳驗證結果
    answer: C
    explain:
      A: Logloss越低越好，並且不能用測試集繼續挑樹深。
      B: 這次開發分數較低不保證在未來資料必然勝出。
      C: 依預先規則選定後獨立評估，並照實承認小樣本差異。
      D: 模型規模不是最佳驗證分數的判準。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:4-24, guide-1:4-26, guide-1:5-5, guide-1:5-6, guide-1:5-7]
---

## 為什麼需要

當人力有限、時程很短，逐一手動處理特徵、比較模型與參數會耗費時間。自動化機器學習（Automated Machine Learning，AutoML）把部分重複工作交給搜尋程序。

指引提到它能自動產生及篩選特徵，降低操作門檻，並加快原型驗證。提高效率是用途，並不保證每份資料都會比人工方法準確。

## 直覺

AutoML可以替團隊試很多組設定，但「什麼算好」仍要先講清楚。目標是降低漏報、改善機率品質或降低耗時，會影響要搜尋及比較的內容。

| 工作 | 可自動化的部分 | 人工仍要決定 |
|---|---|---|
| 特徵處理 | 生成、編碼、補值及篩選 | 欄位是否合理與可取得 |
| 模型與參數（補充） | 在候選空間內搜尋 | 指標、預算與可用模型 |
| 原型驗證 | 快速建立初步方案 | 業務價值與成功條件 |

:::supplement[來源：auto-sklearn官方文件]
AutoML涵蓋的流程依工具而異。某些工具包含模型選擇、超參數搜尋與集成；不能因某平台會做自動特徵工程，就假定所有平台都支援相同功能。
:::

## 定義與公式

AutoML是在指定範圍中，自動探索機器學習流程的做法。自動特徵工程可以是其中一環，例如日期拆分、多項式組合、滯後特徵或冗餘特徵篩選。

科目1指引列舉Google AutoML、H2O.ai、AutoKeras與TPOT等工具。這是指引的工具例子，各工具實際支援的功能仍須分別確認。

指引的自動特徵工程也包含交互作用檢測、依資料選擇缺失值填補方式，以及用隨機森林或L1正則化協助篩選特徵。

:::supplement[來源：scikit-learn Tuning the hyper-parameters；auto-sklearn官方文件]
一般超參數搜尋可只在一類模型內調設定；AutoML常把不同模型與前處理也納入候選。下方以三種模型的固定搜尋呈現最小流程，沒有重現完整AutoML平台的所有功能。
:::

## 走一次流程

### 固定候選、切分與評分（補充）

沿用授信80筆教學資料；其中60筆開發、20筆封存測試。標籤代表是否違約，搜尋評分指定為Logloss，越低越好。

![60筆開發資料內完成三候選比較；封存的20筆在規格定案、重訓及測試前審查後評估，上線核可再依測試結果判定。](figure:l23302-automl-search-test)

1. 固定資料索引、種子23302、3摺切分；每摺40筆訓練、20筆驗證。
2. 比較邏輯迴歸、淺層決策樹、隨機森林；每個候選用完全相同的摺。
3. 依預先指定的平均Logloss選候選，再以60筆重訓；三候選共9次摺內擬合，再加1次重訓。
4. 先做測試前審查，檢查資料來源、隱私、解釋需求及使用條件；再評估20筆封存資料，最後依測試結果與其他條件做上線核可。

| 候選 | 固定設定 | 授信平均Logloss | 醫療平均Logloss |
|---|---|---|---|
| 邏輯迴歸 | C=1 | 0.630642 | 0.576696 |
| 淺層決策樹 | 深度2、葉至少5筆 | 1.809724 | 1.813682 |
| 隨機森林 | 40棵、深度3、葉至少3筆 | 0.633683 | 0.560165 |

授信依規則選邏輯迴歸，定案後測試Logloss為0.489431；醫療則選森林，測試為0.561024。兩域各自保留相同的索引規則，沒有跨域混用分數挑模型。

這些是小樣本的教學結果，不構成模型優劣排名。授信兩個較佳候選差距很小。

決策樹某摺把部分錯誤預測得很有把握，Logloss會很大。評估不能只看正確率，Logloss會重罰過度自信的錯誤。

### 樂觀偏誤的反例（補充）

若在同一驗證集反覆試100組設定，最後挑到的最好分數可能包含偶然好運。把它當成未來表現，就可能過度樂觀；候選越多，不代表獨立證據越多。

更明顯的錯誤是看20筆測試分數後又改模型，這會讓測試資訊回流選模。需要再選模型時，回到開發程序，並另外保留真正獨立的最終評估資料。

補值、標準化、特徵選擇也只能在各訓練摺擬合，再套到驗證摺；可用Pipeline維持界線。固定種子只能重現程序，不能防止資料洩漏。

## 程式（補充）

以下重建授信資料與同一搜尋規則；純本機執行，不使用外部AutoML服務。`cross_val_score`回傳負Logloss，因此先取負號再比較最小值。

```python
import itertools
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import log_loss
X = np.array(list(itertools.product([-1., -.5, .5, 1.], [-1., -.5, .5, 1.], [-1., -.5, 0., .5, 1.])))
p = 1/(1+np.exp(-(-.4+X@np.array([-.8, 1.2, .4]))))
y = (np.random.default_rng(23302).random(80) < p).astype(int)
dev, test = train_test_split(np.arange(80), test_size=20, stratify=y, random_state=23302)
cv = list(StratifiedKFold(3, shuffle=True, random_state=23302).split(X[dev], y[dev]))
models = [LogisticRegression(C=1, max_iter=1000, random_state=23302), DecisionTreeClassifier(max_depth=2, min_samples_leaf=5, random_state=23302), RandomForestClassifier(n_estimators=40, max_depth=3, min_samples_leaf=3, random_state=23302, n_jobs=1)]
losses = [-cross_val_score(m, X[dev], y[dev], cv=cv, scoring="neg_log_loss").mean() for m in models]
print("候選平均", np.round(losses, 6).tolist())
best = models[int(np.argmin(losses))].fit(X[dev], y[dev])
print("測試Logloss", round(float(log_loss(y[test], best.predict_proba(X[test])[:, 1])), 6))
```
```text
候選平均 [0.630642, 1.809724, 0.633683]
測試Logloss 0.489431
```

:::tip[讀碼重點]
先保留`test`，只把`dev`傳給搜尋。三候選共用已具體列出的`cv`；選定後才用`test`評估。套件版本改動可能讓浮點尾數不同，驗收環境固定在專案鎖檔。
:::

## 怎麼用、怎麼判讀

團隊人少、時程緊、想先驗證可行性時，可評估現成工具。若需要深度客製架構，要先確認可控制的範圍；商業服務還要評估長期費用及資料隱私。

| 條件 | 工具選擇方向 | 人工檢查 |
|---|---|---|
| 2人、2週做零售POC | 現成平台先做原型 | 成功指標與資料可用性 |
| 敏感資料、內網、特殊架構 | 評估內網工具或自建 | 客製程度、成本與隱私 |

:::supplement[來源：scikit-learn Common pitfalls；Nested versus non-nested cross-validation]
上線核可在獨立測試之後，還應檢查：是否使用預測當下拿不到的欄位、測試是否達預定門檻、失敗時由誰處理。即使平台列出最佳分數，也不能代替這些責任。
:::

### 換個場景

| 場景／資料條件 | AutoML用途 | 判讀重點 |
|---|---|---|
| 技術人力少、時程短 | 降低建模門檻 | 工具限制與長期費用 |
| 零售推薦POC | 快速確認可行性 | 同時看業務與技術結果 |
| 製造故障預測POC | 加速初步模型建立 | 資料準備到模型測試 |
| 醫療合成資料（補充） | 同規則比較三候選 | 隱私與獨立評估 |
| 農業感測（補充） | 比較特徵與模型流程 | 跨季驗證避免時間洩漏 |

## 常見誤解

- 降低技術門檻，不等於不需要資料與業務判斷。
- 現成服務不一定滿足特殊架構或內網需求。
- 最佳搜尋分數不等於獨立泛化估計。（補充）
- 搜尋自動化不等於模型會自動在線更新；持續更新要另設再訓練或線上學習流程。（補充）

## 進階

### 小樣本的搜尋預算（補充）

資料少、候選多時，可用巢狀交叉驗證，讓外層評估包含選模的整個程序。仍須先定義預算與指標；增加搜尋量同時增加計算成本及選中偶然高分的機會。

### 參考來源

- 科目1指引（版本未標示），`guide-1:4-24`、`guide-1:4-26`：支持低門檻、POC與客製、成本、隱私限制。
- 科目1指引，`guide-1:5-5`～`guide-1:5-7`：支持自動特徵工程。
- [auto-sklearn官方文件](https://automl.github.io/auto-sklearn/master/)：支持模型選擇、調參與集成的功能定位。
- [auto-sklearn分類教學](https://automl.github.io/auto-sklearn/master/examples/20_basic/example_classification.html)：參考先切資料、再設搜尋預算、最後評估的教學順序。
- [scikit-learn搜尋指引](https://scikit-learn.org/stable/modules/grid_search.html)：支持固定評分與候選搜尋。
- [scikit-learn常見錯誤](https://scikit-learn.org/stable/common_pitfalls.html)：支持前處理的訓練界線與Pipeline。
- [巢狀與非巢狀交叉驗證範例](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html)：支持搜尋樂觀偏誤與獨立評估責任。

## 小結

- AutoML可加快特徵處理與原型建立。
- 先核對人力、時程、客製、成本與隱私條件。
- 在開發資料內搜尋，獨立測試留到定案後。（補充）
- 人工仍負責目標、驗證及使用核可。（補充）
