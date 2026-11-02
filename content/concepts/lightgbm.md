---
id: "lightgbm"
title: "LightGBM"
kind: "model"
codes: ["L23202"]
aliases: ["Light Gradient Boosting Machine"]
requires: ["gradient-boosted-trees"]
guide_refs: ["guide-3:4-22", "guide-3:4-23", "guide-3:4-24", "guide-3:4-25", "guide-3:4-40"]
summary: "以直方圖與葉優先分裂加速梯度提升，並以葉數、深度及葉樣本數控制複雜度"
goals:
  - id: "g1"
    text: "比較同葉數下的生長差異，解釋直方圖效率與小資料過擬合風險"
  - id: "g2"
    text: "比較XGBoost及LightGBM分類輸出、結構設定、延遲及泛化"
is_a: ["gradient-boosted-trees"]
contrasts:
  - target: "xgboost"
    note: "LightGBM採葉優先；XGBoost的depthwise或lossguide依樹方法與設定，兩者效率須實測"
    source: ["guide-3:4-23", "guide-3:4-40"]
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "兩棵樹都限定4葉；一棵深度2較平衡，另一棵單側深度3。哪個結論合理？"
    options:
      A: "4葉必然都是深度2，因此第二棵樹的結構無效"
      B: "葉優先可能形成不均深度，仍應限制容量並驗證"
      C: "只要4葉相同，兩棵樹的驗證損失就必然一樣"
      D: "深度3必然較準確，100筆資料也不需設定限制"
    answer: "B"
    explain:
      A: "4葉可以排列成不平衡結構。"
      B: "葉優先可反覆分裂高增益分支，深度未必均勻。"
      C: "相同葉數不保證學到相同切分或相同泛化。"
      D: "較深仍可能過擬合，小資料更需留意。"
  - id: "c2"
    goal: "g1"
    type: "choice"
    prompt: "60筆訓練資料切成少數小葉，驗證損失上升。何者是合理調整？"
    options:
      A: "增加num_leaves並降低葉樣本數，以保證泛化"
      B: "只降低執行緒數，所有樹的容量就自然變小"
      C: "適度降低葉數並提高葉樣本數，再比較驗證損失"
      D: "把驗證個案加入訓練，繼續回報原本驗證分數"
    answer: "C"
    explain:
      A: "這會增加切分細緻度，不能保證泛化。"
      B: "執行緒數主要改變計算資源，不是直接容量控制。"
      C: "葉數與葉內最小資料量都影響模型複雜度。"
      D: "驗證資料參與訓練後，不再是原本的保留驗證。"
  - id: "c3"
    goal: "g2"
    type: "choice"
    prompt: "3類風險評分要每筆3個機率，還需在相同驗證資料比較XGBoost。何者合理？"
    options:
      A: "兩者設定多類別機率目標，並實測延遲及驗證損失"
      B: "兩者都用平方誤差迴歸，三個輸出就會總和為一"
      C: "LightGBM一定較快較準，僅比較模型檔名就足夠"
      D: "XGBoost只能逐層生長，因此不需記錄其設定值"
    answer: "A"
    explain:
      A: "任務目標、輸出及公平比較條件都須明確。"
      B: "連續迴歸輸出不會自動成為機率向量。"
      C: "速度與準確度受資料、設定與硬體影響。"
      D: "XGBoost也有lossguide，須記錄grow_policy及tree_method。"
textbook: "v2"
author: "codex"
status: "draft"
---

## 為什麼需要

LightGBM（Light Gradient Boosting Machine）適用大型表格資料。直方圖減少分裂搜尋工作，葉優先則集中處理改善較大的位置。

## 直覺

:::supplement[來源：LightGBM Features §Optimization in Speed and Memory Usage]
先把連續數值分到有限個箱，再累積各箱資訊。搜尋切分時，主要沿箱的邊界比較，不必每次把所有原始數值當成獨立候選。
:::

另一個選擇是「接著分哪個葉」。葉優先會優先分裂預期損失改善最大的葉，可能沿同一側一直長深，而不平均擴張每層。

固定相同葉數時，葉優先通常能更有效地降低訓練損失。指引也列出分裂搜尋的並行效率優勢，但小資料仍需防過擬合；實際速度要依資料、設定與硬體比較。

![兩棵樹都只有四個葉；逐層生長較均勻，葉優先可能在同一側更深，葉數相同不代表深度相同。](figure:l23202-lightgbm-growth)

## 定義與公式

本頁不用額外公式重複梯度提升。LightGBM仍以新樹逐輪修正模型；直方圖處理候選分裂的計算，葉優先決定下一個擴張位置，兩者解決不同問題。

| 設計 | 做法 | 判讀限制 |
|---|---|---|
| 直方圖 | 降低分裂搜尋的計算成本 | 速度仍依資料與設定驗證 |
| 葉優先 | 先分最大增益的葉 | 可能形成局部很深的樹 |
| 葉數與深度限制 | 限制深度等條件以約束節點增長 | 小資料尤其要防過擬合 |
| 缺值處理 | 內建辨識缺漏 | 不取代資料品質判斷 |

:::supplement[來源：LightGBM Features；LightGBM Parameters Tuning]
直方圖可累積梯度與Hessian資訊，減少重複掃描與候選數。`num_leaves`限制最大葉數，`max_depth`限制深度；即使設深度限制，生長仍是葉優先，不會因此改成逐層。

分箱近似可能忽略箱內的細緻切點。容量限制過強也可能欠擬合，須與驗證損失一起調整。
:::

## 走一次流程

### 同葉數比較

先讓根分成左、右兩葉，再追蹤下一步：

1. 逐層示意把左右葉都分開，得到左左、左右、右左、右右，共四葉。
2. 葉優先示意先分增益較高的左葉，得到左左、左右、右三葉。
3. 若左左仍有較大增益，再分成左左左、左左右，總共四葉；右側仍只有一葉。

兩棵都四葉，第二棵最深路徑卻更長。這說明小資料上若只增加葉數，容易產生只描述少量樣本的分支，需要深度與葉內樣本限制。

### 把資料走過直方圖（補充）

在微型房價例中，面積20、25、40、45可依示意邊界30分成兩箱。第一輪殘差−50、−30、30、50，兩箱和為−80與80，箱內各兩筆。

以半平方損失看，梯度和為80與−80，Hessian和各2。這些是展示如何累積的教學箱，不宣稱是實際LightGBM在100筆資料上學得的分箱邊界。

### 共用三模型資料（補充）

沿用各100筆資料、60／20／20切分與種子23202。XGBoost頁三模型表共用驗證資料；本模型授信前三筆機率為0.100600、0.602218、0.066903。

缺值版對索引為13倍數的第二欄、17倍數的第一欄放入缺值。模型重新訓練後，前三筆機率為0.246082、0.244346、0.573501，顯示能處理缺值不等於預測完全不變。

## 程式（補充）

```python
import numpy as np
from lightgbm import LGBMClassifier
i = np.arange(100)
u, d, a = 30+i*11 % 91, (i*7 % 61)/100, 22+i*3 % 40
X = np.column_stack([u, d, a]).astype(float)
y = ((d>.35) & (u<90) | (u<45)).astype(int)
tr, va = i[i % 5 < 3], i[i % 5 == 3]
for missing in [False, True]:
    Z = X.copy()
    if missing:
        Z[i % 13 == 0, 1], Z[i % 17 == 0, 0] = np.nan, np.nan
    m = LGBMClassifier(n_estimators=3, max_depth=2, num_leaves=4,
        min_child_samples=5, learning_rate=.5, random_state=23202,
        n_jobs=1, verbosity=-1, deterministic=True, force_col_wise=True).fit(Z[tr], y[tr])
    print("缺值版", missing, np.round(m.predict_proba(Z[va[:3]])[:, 1], 6).tolist())
```
```text
缺值版 False [0.1006, 0.602218, 0.066903]
缺值版 True [0.246082, 0.244346, 0.573501]
```

:::tip[讀碼重點]
`min_child_samples`對應核心參數`min_data_in_leaf`，限制葉內樣本數。本例只有60筆訓練資料，設定用來展示流程，不是大型資料的建議值。
:::

## 怎麼用、怎麼判讀

大型、高維資料可優先比較訓練時間與記憶體；小型資料則要留意葉優先的過擬合。指引說明效率優勢，應視為常見情況，而非必定勝過XGBoost的定律。

:::supplement[來源：LightGBM Parameters；XGBoost Parameters]
| 項目 | LightGBM | XGBoost |
|---|---|---|
| 二元機率 | `objective=binary` | `objective=binary:logistic` |
| K類機率 | `multiclass`、`num_class=K` | `multi:softprob`、`num_class=K` |
| 生長 | 葉優先，可限制深度 | `depthwise`或`lossguide`，依樹方法 |
| 容量 | 葉數、深度、葉資料量 | 深度、葉數、Hessian及正則化 |

二元可由Sigmoid給正類機率，多類別可用Softmax給每類機率。sklearn介面通常以`predict`回類別、`predict_proba`回機率；不要把兩者混用。
:::

比較兩者時，應固定資料、切分與硬體，分開記錄訓練時間、單筆或批次推論延遲、模型大小及驗證損失。本組未測硬體延遲，不從三模型分數表推論誰較快。

### 換個場景

| 場景／資料條件 | 用途 | 判讀重點 |
|---|---|---|
| 金融、電商、醫療 | 分類及迴歸 | 目標、輸出與可解釋性 |
| 大量樣本、高維特徵 | 分箱與分裂搜尋 | 實測時間與記憶體 |
| 小資料、局部深樹 | 葉優先訓練 | 限制葉數及深度 |
| 農業（補充） | 多區域產量預測 | 新區域的泛化誤差 |
| 能源（補充） | 用電異常分類 | 少數異常與推論延遲 |

## 常見誤解

- 直方圖與葉優先分別處理搜尋效率與生長位置，不是同一件事。
- 葉數相同仍可能有不同最大深度。
- 設定`max_depth`不會把LightGBM改成逐層生長。（補充）
- 不能用「XGBoost沒有直方圖或正則化較少」作固定選型規則。（補充）

## 進階

### 參考來源

- 科目3指引（2025-12檔案版），`guide-3:4-22`～`guide-3:4-25`、`guide-3:4-40`：支持葉優先、直方圖、應用、分類及小資料風險。
- [LightGBM Features](https://lightgbm.readthedocs.io/en/stable/Features.html)：支持分箱累積、相同葉數比較與深度限制；參考原圖以生長順序對照的教法。
- [LightGBM Parameters Tuning](https://lightgbm.readthedocs.io/en/stable/Parameters-Tuning.html)：支持葉數、深度、葉內樣本的取捨。
- [LightGBM Python教學](https://lightgbm.readthedocs.io/en/stable/Python-Intro.html)：支持訓練、輸出與驗證流程。
- [LightGBM Parameters](https://lightgbm.readthedocs.io/en/stable/Parameters.html)、[XGBoost Parameters](https://xgboost.readthedocs.io/en/stable/parameter.html)：支持分類輸出與設定比較。
- [Ke等人LightGBM論文](https://proceedings.neurips.cc/paper_files/paper/2017/hash/6449f44a102fde848669bdd9eb6b76fa-Abstract.html)：支持高維與大型資料的效率背景，不將論文特定實驗速度當成本例成績。

## 小結

- 直方圖減少候選分裂計算，葉優先先分高增益葉。
- 葉數相同，不代表深度與泛化相同。
- 小資料需留意葉數、深度與葉內最小樣本。
- 分類輸出及速度比較，要看任務、設定與實測條件。（補充）
