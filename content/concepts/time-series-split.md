---
id: time-series-split
title: 時間序列切分與滾動驗證
aliases: [TimeSeriesSplit, 時間序列交叉驗證, 滾動窗口驗證, Rolling Window Validation, Walk-forward Validation, 滑動視窗驗證]
kind: technique
codes: [L23303, L23301]
requires: [train-val-test-split]
mitigates:
  - target: data-leakage
    note: 避免用較晚的樣本訓練、較早的樣本驗證所造成的洩漏；仍須只在訓練區段 fit 前處理，並確認特徵與標籤在預測當下可取得，必要時用 gap 隔開邊界
    source: [115-1-S3-Q27]
guide_refs: [guide-3:5-26]
gaps:
  - ref: guide-3:5-26
    level: missing
    ability: 指引列出的交叉驗證方法沒有時間序列切分；考題要判斷資料有時間先後、行為隨時間改變時，改用依時間往後滾動的驗證
textbook: v2
summary: 時間序列交叉驗證沿時間往後切，每輪只能用過去資料預測較晚資料
goals:
  - id: g1
    text: 用十天資料判斷切分是否保持過去訓練、未來驗證
  - id: g2
    text: 比較擴張與固定長度窗口，讀出 TimeSeriesSplit 的切分索引
  - id: g3
    text: 檢查預測時可取得的資訊、標籤延遲與最終測試邊界
formula_groups: []
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 要模擬第 7 日之前訓練、預測第 7–8 日。哪個切法符合這個任務？
    options:
      A: 第 1–6、9–10 日訓練，第 7–8 日驗證
      B: 第 1–6 日訓練，第 7–8 日驗證
      C: 第 7–8 日訓練，第 1–6 日驗證
      D: 將十天洗牌後任選八天訓練
    answer: B
    explain:
      A: 錯。第 9–10 日在預測當下尚未發生，不能放入訓練。
      B: 對。所有訓練資料都早於驗證資料，符合部署方向。
      C: 錯。它用較晚資料預測過去，和目標方向相反。
      D: 錯。洗牌沒有保證所有訓練日期都早於驗證日期。
  - id: c2
    goal: g2
    type: choice
    prompt: 十筆日資料設定 n_splits=3、test_size=2、max_train_size=4、gap=0。最後一摺訓練與驗證的日索引為何？
    options:
      A: 訓練 1–8，驗證 9–10
      B: 訓練 3–6，驗證 7–8
      C: 訓練 6–9，驗證 9–10
      D: 訓練 5–8，驗證 9–10
    answer: D
    explain:
      A: 錯。這是沒有設定最大訓練長度的擴張窗口。
      B: 錯。這是第二摺，尚未移到最後的驗證區段。
      C: 錯。第 9 日同時出現在訓練與驗證，兩者不可重疊。
      D: 對。最後驗證是第 9–10 日，訓練保留之前最近四筆。
  - id: c3
    goal: g3
    type: choice
    prompt: 每日樣本要預測未來三天累積銷量，標籤到第三天結束才完整。依日期切好後，下列哪個做法符合預測當下只能使用已知資訊的原則？
    options:
      A: 邊界訓練樣本的標籤是否在當次建模時已完整可得，必要時留間隔
      B: 只要日期排序正確，就不需檢查標籤
      C: 用包含前後各一天實際銷量的置中移動平均，作為當日預測特徵
      D: 將最後測試期每次調參後都測一次，以便選設定
    answer: A
    explain:
      A: 對。日期較早不代表其未來累積標籤已知，須按可取得時間檢查。
      B: 錯。訓練標籤延伸到未來時，單純排序仍可能帶入未來資訊。
      C: 錯。置中移動平均包含次日實際銷量，當日預測時尚未知，已使用未來資訊。
      D: 錯。反覆以最後測試期選設定，會破壞其最終評估角色。
author: codex
status: draft
---

## 為什麼需要

指引 5.3 的交叉驗證方法包含 K-fold、分層、留一法與重複 K-fold。本頁承接資料分割與 K-fold 交叉驗證，處理「要預測未來」的限制。

:::supplement[來源：scikit-learn TimeSeriesSplit；Inria Non i.i.d. data]
時間序列交叉驗證（Time Series Cross-Validation）讓訓練在前、驗證在後。指引 5.3 未介紹這種切法，以下各節都是補充。

假設用一月資料預測二月，訓練時就不可能取得三月紀錄。一般 K-fold 即使不洗牌，仍可能把驗證摺後面的資料放進訓練。
:::

## 直覺（補充）

把時間軸當作不可逆的方向。每輪選一個建模時間點，只用當時已知的資料訓練，再往後驗證；下一輪才加入更多已發生資料。

![十天資料依序向右驗證；擴張窗口保留歷史，固定長度窗口只留最近四天](figure:l23303-time-series-split-ten-days)

本例一天一筆，日期等距。圖上的每列是一輪，不是十天同時各自訓練一個模型；初始四天只供訓練，不一定都要被驗證。

## 定義與公式（補充）

本頁沒有額外公式。核心限制是：每一輪訓練資料及其標籤，必須在該輪建模時間點以前可取得。

| 名稱 | 訓練區段如何改變 | 取捨 |
|---|---|---|
| 擴張窗口（expanding window） | 留住全部過去資料，逐輪加長 | 資料多，但舊模式可能影響新環境 |
| 固定長度窗口（rolling window） | 只留最近固定筆數，向後平移 | 較貼近近期模式，但訓練樣本較少 |
| 間隔（gap） | 訓練末端與驗證起點之間留空 | 依標籤確認時間或重疊預測區間設定 |

`TimeSeriesSplit` 預設擴張；設定 `max_train_size` 才限制長度。`test_size`、`max_train_size`、`gap` 都以樣本筆數為單位。

## 走一次流程（補充）

沿用 `L23303-splits.json` 的 S01–S10：2026 年 1 月 1–10 日，每日一筆交易。標籤假設當日即可確認，沒有額外延遲。

1. 初始用第 1–4 日訓練，第 5–6 日驗證。
2. 加入已發生的第 5–6 日，用第 1–6 日訓練，第 7–8 日驗證。
3. 再往後移，用第 1–8 日訓練，第 9–10 日驗證。

| 摺 | 擴張窗口訓練 | 固定四筆訓練 | 驗證 |
|---|---|---|---|
| 1 | 1–4 | 1–4 | 5–6 |
| 2 | 1–6 | 3–6 | 7–8 |
| 3 | 1–8 | 5–8 | 9–10 |

驗證區段每次兩天、共三摺，只有六筆接受驗證。第 5–6 日皆為盜刷，該摺沒有負類，不能計算 ROC-AUC。

本例十天都是開發資料，最後兩天仍屬輪流驗證的一部分。若另留最終測試集，應放在開發期之後，且不參與上述調參。

## 程式（補充）

先看預設擴張窗口。陣列索引加一後，和表中的第 1–10 日相同；這段只驗證切法，不訓練交易分類器。

```python
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
days = np.arange(1, 11)
expanding = TimeSeriesSplit(n_splits=3, test_size=2)
for k, (tr, va) in enumerate(expanding.split(days), start=1):
    print(k, "訓練", days[tr].tolist(), "驗證", days[va].tolist())
```
```text
1 訓練 [1, 2, 3, 4] 驗證 [5, 6]
2 訓練 [1, 2, 3, 4, 5, 6] 驗證 [7, 8]
3 訓練 [1, 2, 3, 4, 5, 6, 7, 8] 驗證 [9, 10]
```

再限制窗口為四筆，並另示範留一筆間隔。第二個切法第一輪只剩三筆訓練，並非永遠都有四筆。

```python
for name, gap in [("固定四筆", 0), ("固定四筆加間隔", 1)]:
    cv = TimeSeriesSplit(n_splits=3, test_size=2,
                         max_train_size=4, gap=gap)
    for k, (tr, va) in enumerate(cv.split(days), start=1):
        print(name, k, days[tr].tolist(), "->", days[va].tolist())
```
```text
固定四筆 1 [1, 2, 3, 4] -> [5, 6]
固定四筆 2 [3, 4, 5, 6] -> [7, 8]
固定四筆 3 [5, 6, 7, 8] -> [9, 10]
固定四筆加間隔 1 [1, 2, 3] -> [5, 6]
固定四筆加間隔 2 [2, 3, 4, 5] -> [7, 8]
固定四筆加間隔 3 [4, 5, 6, 7] -> [9, 10]
```

:::tip[讀碼重點]
- `TimeSeriesSplit` 按傳入的列順序切，不會替你按日期排序。
- `max_train_size=4` 是最多四筆；資料不足時不會補出四筆。
- `gap=1` 只排除訓練末端一筆，不能自動判斷特徵是否含未來資訊。
:::

## 怎麼用、怎麼判讀（補充）

比較窗口策略時，用相同驗證時段、預測長度與指標。後面分數變差可能是資料漂移，也可能是樣本少、節日或資料品質問題，不能單靠下降就定論。

### 預測時間比列日期更重要

若在第 6 日結束時建模，訓練標籤卻需要第 7–8 日銷量才能確定，這些列仍不可使用。間隔多長要按標籤何時完整可得決定。

單純共用過去的滯後觀測不一定是洩漏。關鍵是預測當下能否取得，不能因為兩個窗口有共用歷史就一律判錯。

標準化、補值與特徵選擇仍須放入 Pipeline，每輪只在訓練區段擬合。先用全時段平均補值，再按時間切，依然會洩漏。

### 換個場景（補充）

指引 5.3 沒有時間序列交叉驗證的專屬適用場景；下列以不同預測時點延伸。

| 場景 | 預測時可用資料 | 判讀重點 |
|---|---|---|
| 金融交易 | 已發生且已確認標籤的歷史交易 | 盜刷調查若延遲，訓練標籤也要往回留空 |
| 零售銷量 | 過去銷量與預測時已知的促銷安排 | 不可把未來實際銷量算進移動平均 |
| 設備維護 | 當時已回傳的感測紀錄 | 比較不同運轉時段，留意故障標籤確認時間 |

## 常見誤解（補充）

- 「不洗牌的 K-fold 就能預測未來」：訓練摺仍可能含較晚資料。
- 「設定 `TimeSeriesSplit` 就會固定窗口」：預設保留全部過去資料。
- 「有間隔就沒有洩漏」：特徵與標籤仍要通過可取得時間的檢查。
- 「每筆都要驗證一次」：最早區段只作訓練，這與一般 K-fold 不同。

## 進階（補充）

### 等筆數不一定是等時間

一天有多筆交易或缺測時，兩筆可能隔一分鐘，也可能隔一週。若要比較相同時間跨度的誤差，先按日期設計邊界，不能把 `test_size=2` 當成兩天。

### 參考來源

- [scikit-learn：TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)（支持：定義、程式、等距與間隔限制）。
- [scikit-learn：交叉驗證](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：與一般 K-fold 的區別、最終測試界線）。
- [Inria 課程：Non i.i.d. data](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_time.html)（支持：直覺、金融場景、怎麼判讀）。
- [scikit-learn：Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)（支持：預測當下可得資訊、前處理邊界）。

## 小結（補充）

- 每輪用當時已知的過去資料預測未來。
- 擴張窗口保留歷史，固定長度窗口只留近期資料。
- 索引順序、標籤延遲與前處理都要檢查。
- 驗證期間用來選設定，最終測試仍放在更晚的保留時段。
