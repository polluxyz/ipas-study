---
id: leave-one-out-cv
title: 留一法交叉驗證
aliases: [LOOCV, Leave-One-Out, 留一法, LeaveOneOut]
kind: technique
codes: [L23303]
is_a: [k-fold-cross-validation]
contrasts:
  - target: stratified-k-fold
    note: 留一法每一摺只有 1 筆驗證資料，沒有類別比例可以維持；要讓每摺比例一致，要用分層 K-fold
    source: [114-2-S3-Q34]
guide_refs: [guide-3:5-28]
gaps:
  - ref: guide-3:5-28
    level: shallow
    ability: 指引寫了留一法的成本與適用場景，沒有說它無法分層；114-2 科3 第34題的選項出現「分層留一法」
  - ref: guide-3:5-28
    level: erratum
    ability: 指引把重複 K-fold 的特性放在留一法的適用場景底下，容易讀成留一法也會隨機重切
textbook: v2
summary: 留一法每次留一筆驗證，其餘全部訓練；珍貴小樣本用得多，成本也隨筆數增加
goals:
  - id: g1
    text: 排出逐筆留一的輪替流程，彙整預測並指出單摺指標的限制
  - id: g2
    text: 比較留一法與一般 K-fold 的資料量、擬合次數與估計變異
formula_groups:
  - id: loo-size-cost
    source: guide-3:5-28
    status: verified
    checked_by: ctx_2f4741389715
  - id: pooled-accuracy
    source: https://scikit-learn.org/stable/modules/cross_validation.html
    status: verified
    checked_by: ctx_2f4741389715
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 10 筆交易做留一法，第 4 輪留 S04 驗證。這一輪的訓練資料應是哪一些？
    options:
      A: 只有 S01–S03，共 3 筆
      B: 只有 S05–S10，共 6 筆
      C: 除 S04 以外的全部 9 筆
      D: S01–S10 全部 10 筆
    answer: C
    explain:
      A: 留一法每輪用其餘全部 9 筆，不只用較早的資料。
      B: 留一法不只使用驗證樣本後面的資料。
      C: 留出當輪唯一的驗證樣本後，其餘 9 筆都參與訓練。
      D: 把 S04 也拿來訓練，就沒有留下未見樣本驗證。
  - id: c2
    goal: g2
    type: choice
    prompt: 12 位病人每人一筆資料，比較留一法與 3-fold，只算一組設定、不加最後重訓。何者正確？
    options:
      A: 留一法訓練 3 次，每次 11 筆；3-fold 訓練 12 次，每次 8 筆
      B: 留一法訓練 12 次，每次 11 筆；3-fold 訓練 3 次，每次 8 筆
      C: 兩種方法都訓練 12 次，每次 11 筆
      D: 留一法訓練 11 次，每次 11 筆；3-fold 訓練 3 次，每次 8 筆
    answer: B
    explain:
      A: 兩種方法的擬合次數對調了，留一法次數等於樣本數。
      B: 留一法每輪少 1 筆，3-fold 每輪用其中 2 摺，共 8 筆。
      C: 3-fold 每組設定只做 3 次訓練，不會逐筆留一。
      D: 12 筆必須各驗證一次，留一法應訓練 12 次；3-fold 的次數與筆數則正確。
  - id: c3
    goal: g1
    type: choice
    prompt: 二元分類做留一法，每摺驗證只有一筆。哪一種評估方式最合理？
    options:
      A: 合併全部留出預測，計算整體準確率
      B: 對每個單筆驗證摺計算 ROC AUC，再取所有摺的平均
      C: 對每個單筆驗證摺計算決定係數 R²，再取所有摺的平均
      D: 將每筆參與訓練時的預測合併，再計算整體準確率
    answer: A
    explain:
      A: 每筆都有一次未參與訓練的預測，合併後可計算整體準確率。
      B: 單筆不可能同時包含正負類，ROC AUC 沒有定義。
      C: 單筆資料無法建立計算決定係數所需的變異基準。
      D: 訓練時的預測不是當輪留出樣本的預測，會混入樂觀估計。
author: codex
status: draft
---

## 為什麼需要

珍貴的小樣本研究，固定留一大塊驗證集，會讓每輪訓練少掉不少資料。留一法交叉驗證（Leave-One-Out Cross-Validation，LOOCV）讓每次訓練只少一筆。

建議先讀 K-fold 交叉驗證。本頁沿用 $n$（樣本數）與 $K$（摺數），把 $K$ 推到 $n$；重點是資料利用、計算成本與單筆評估的限制。

## 直覺

每輪讓一筆資料離開訓練，當一次驗證樣本。下一輪換另一筆；全部輪過後，每筆恰好驗證一次，其餘輪次都參與訓練。

![驗證格沿對角線逐筆移動，每列只有一筆驗證，其餘九筆訓練；最後彙整十筆預測](figure:l23303-leave-one-out-cv-rotation)

:::supplement[來源：scikit-learn LeaveOneOut API]
這不是逐日向前預測。圖中驗證 S01 時，S02–S10 也在訓練中；因此十天交易資料在此只示範獨立樣本切法，預測未來應用時間序列交叉驗證。
:::

## 定義與公式

留一法等同於 $K=n$。每輪訓練、驗證筆數與一組設定的擬合次數為：

$$
n_{\mathrm{train}}=n-1,\qquad n_{\mathrm{val}}=1,\qquad N_{\mathrm{fit}}=n
$$

| 符號 | 含義 | 代入共用 10 筆資料 |
|---|---|---|
| $n$ | 全部樣本數 | 10 |
| $n_{\mathrm{train}}$ | 每輪訓練筆數 | $10-1=9$ |
| $n_{\mathrm{val}}$ | 每輪驗證筆數 | 1 |
| $N_{\mathrm{fit}}$ | 一組設定的擬合次數 | 10 |

:::supplement[來源：scikit-learn User Guide 3.1.2.1.3 Leave One Out]
每輪都從頭擬合模型與前處理，最終測試集不參與這 $n$ 輪。分類任務還要檢查：留出某筆後，訓練資料是否仍包含模型需要的類別。

一個驗證摺只有一筆，不可能同時有正負類，也不能維持整體類別比例。因此不能用「分層留一法」解決類別不平衡；可考慮較少摺的分層 K-fold 交叉驗證。
:::

## 走一次流程

### 十天交易：輪替與彙整（補充）

1. 從 `L23303-splits.json` 取 S01–S10，最終測試集假設已在外部另留。
2. 第 1 輪訓練 S02–S10，預測 S01；第 2 輪訓練除 S02 外的 9 筆，預測 S02。
3. 持續輪替到第 10 輪，以 S01–S09 訓練，預測 S10。
4. 按原樣本 ID 收集 10 筆留出預測，再計算適合合併的指標。

示範一個永遠預測負類的基準模型。它對全部 5 筆負類答對、對 5 筆正類答錯，10 次留出預測的整體準確率是：

$$
\mathrm{Accuracy}_{\mathrm{LOO}}=\frac{\text{留出預測答對筆數}}{n}=\frac{5}{10}=0.50
$$

$\mathrm{Accuracy}_{\mathrm{LOO}}$ 是合併留出預測後的準確率，$n$ 是資料筆數。這裡的基準模型沒有學到盜刷規則，只方便核對輪替與計數。

### 醫療小樣本：訓練量與成本（補充）

`L23303-C1-medical-small.json` 有 12 位病人、每人一筆。留一法每次用 11 人訓練；3-fold 每次用 8 人，驗證 4 人。

| 資料與方法 | 擬合次數 | 每輪訓練 | 每輪驗證 |
|---|---|---|---|
| 10 筆交易，5-fold | 5 | 8 | 2 |
| 10 筆交易，留一法 | 10 | 9 | 1 |
| 12 位病人，3-fold | 3 | 8 | 4 |
| 12 位病人，留一法 | 12 | 11 | 1 |

每輪多用資料，代價是重訓更多次。表中只算一組設定；有多組候選參數時，每一組都要完整做一次，最後的全開發資料重訓另計。

## 程式

### 留出預測放回原來位置（補充）

`cross_val_predict` 為每筆資料產生一次留出預測，並按輸入順序回傳。下例用固定負類的基準模型，特徵只放佔位數字。

```python
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import LeaveOneOut, cross_val_predict

X = np.arange(10).reshape(-1, 1)
y = np.array([0, 0, 0, 1, 1, 1, 0, 1, 0, 1])
cv = LeaveOneOut()
pred = cross_val_predict(DummyClassifier(strategy="constant", constant=0), X, y, cv=cv)
print("擬合次數", cv.get_n_splits(X))
print("留出預測", pred.tolist())
print(f"整體準確率 {np.mean(pred == y):.3f}")
```
```text
擬合次數 10
留出預測 [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
整體準確率 0.500
```

:::tip[讀碼重點]
- `LeaveOneOut()` 沒有洗牌與 `random_state` 參數；留哪一筆的集合已完全確定。
- `cross_val_predict` 會逐摺重新擬合，不是把某個已訓練模型的訓練預測拿來拼接。
- 本例基準模型沒有隨機步驟；換成有隨機性的模型，要在模型本身固定種子。
:::

## 怎麼用、怎麼判讀

### 先釐清指引表述

指引 5-28 把「重新隨機分摺」列在留一法適用場景下，該說明實際屬於重複 K-fold。留一法是逐筆留出的固定集合，不會隨機改變驗證組合。

指引同頁寫「評估偏差最小」，應連同模型穩定性與訓練量理解，不能推論所有任務都比一般 K-fold 更可靠。

### 成本與變異的取捨

留一法每輪接近使用全資料，能減少因訓練樣本較少而造成的偏差，但要擬合 $n$ 次；樣本多或模型訓練昂貴時，通常不划算。

指引也提醒，留一法對訓練資料的小幅變動可能很敏感，模型表現可能出現較大波動。

:::supplement[來源：scikit-learn User Guide 3.1.2.1.3 Leave One Out]
「偏差較小」不是無條件保證，和資料量、學習曲線及模型穩定性有關。對穩定模型，少一筆的模型接近全資料模型；不穩定模型仍可能因少掉關鍵樣本而大幅變動。

任兩輪的訓練集共有 $n-2$ 筆，本例共有 8 筆，重疊程度很高。各輪模型與評估誤差相依，平均後的估計變異未必小於 5-fold 或 10-fold，不能只因訓練資料多就判定最好。
:::

### 單筆指標的限制（補充）

| 指標 | 單筆驗證能否使用 | 建議做法 |
|---|---|---|
| 準確率、逐筆平方誤差 | 可逐筆算 | 彙整全部留出預測再平均 |
| ROC AUC | 單筆沒有正負配對，未定義 | 勿逐摺計算；需要 AUC 時優先考慮分層 K-fold |
| 決定係數 R² | 單筆無法建立變異基準 | 收集迴歸留出預測後才評估，並註明算法 |
| F1 分數 | 單筆極不穩，可能遇到零分母 | 合併留出類別預測計算，事先約定零分母處理 |

合併後的 F1 或 AUC 不等於單摺指標平均。尤其不同摺的模型分數尺度可能不同，不能把跨摺合併的 AUC 當成某個最終模型的 AUC。

同一病人多筆資料要改依病人分組；前處理只在當輪訓練資料擬合。留一筆並不會自動隔離同一人的其他筆資料。

### 換個場景

| 場景 | 是否適合 | 判讀重點 |
|---|---|---|
| 臨床研究、稀有病資料 | 樣本珍貴且極少時可考慮 | 一人一筆且單次訓練便宜，仍需檢查類別數 |
| 學術研究的逐樣本檢查 | 可觀察每筆留出誤差 | 兼顧資料利用與個別樣本的精度檢查 |
| 材料製程試驗（補充） | 實驗昂貴、樣本少時可考慮 | 用簡單模型降低反覆重訓成本 |
| 大量零件影像（補充） | 通常較不合適 | 逐張重訓成本高，且同零件多圖需先分組 |

:::supplement[來源：scikit-learn User Guide 3.1.2.1.3 Leave One Out]
單筆答對不表示已估出該病人的可信度。留一法提供該筆未參與訓練時的預測；要判斷個人預測的可信程度，仍需額外的校準或不確定性分析。
:::

## 常見誤解

:::supplement[來源：scikit-learn LeaveOneOut API；User Guide 3.1.2.1.3 Leave One Out]
- 「每次只少一筆，所以一定最準」：資料利用率高，不能消除估計變異與模型不穩定。
- 「換種子可換一套留一切法」：所有逐筆留出的集合都已包含，換種子只可能改模型的隨機過程。
- 「多做一次留一法就得到新切分」：重複固定流程不會產生新切分；想研究切法波動，應看重複 K-fold 交叉驗證。
:::

## 進階

### 參考來源

- 科目 3 學習指引 5.3，5-28（支持：留一流程、成本、小樣本場景與表述校正）。
- [scikit-learn LeaveOneOut API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.LeaveOneOut.html)（支持：切分固定、程式與不能分層的界線）。
- [scikit-learn User Guide 3.1.2.1.3](https://scikit-learn.org/stable/modules/cross_validation.html#leave-one-out-loo)（支持：計算成本、偏差與變異取捨）。
- [scikit-learn User Guide 3.1.1.2](https://scikit-learn.org/stable/modules/cross_validation.html#obtaining-predictions-by-cross-validation)（支持：留出預測彙整與單摺、合併指標的區別）。
- [Inria scikit-learn 課程：Cross-validation framework](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_train_test.html)（支持：流程與判讀；參考從未見樣本誤差解釋泛化的順序）。

## 小結

- 留一法每輪訓練 $n-1$ 筆、驗證 1 筆，一組設定擬合 $n$ 次。
- 適合珍貴小樣本且訓練便宜的任務；資料多時成本高。
- 單摺只有一筆，不能算 ROC AUC 或決定係數 R²；依指標性質彙整預測。
- 固定切分不靠重複增加多樣性，也不能維持每摺的類別比例。
