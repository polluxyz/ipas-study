---
id: early-stopping
title: 早停
aliases:
  - Early Stopping
  - 早期停止
  - 提早停止
  - Patience
kind: technique
codes:
  - L23303
  - L23304
requires:
  - train-val-test-split
mitigates:
  - target: overfitting
    note: 驗證損失連續多個 epoch 沒改善就停止訓練，不必改模型架構；patience 設太小會停得太早而欠擬合
    source:
      - guide-3:4-64
      - guide-3:5-46
      - 114-2-S3-Q26
guide_refs:
  - guide-3:3-27
  - guide-3:4-64
  - guide-3:5-19
  - guide-3:5-20
  - guide-3:5-46
gaps:
  - ref: guide-3:5-46
    level: shallow
    ability: 指引只說監控驗證集，沒有明講不能用測試集當早停依據，也沒寫停止後要還原最佳權重；114-2 科3 第31題把「用哪個資料集監控」當成選項
author: codex
status: draft
textbook: v2
summary: 早停監控驗證表現，連續未達改善門檻時結束訓練
goals:
  - id: g1
    text: 套用最小改善幅度與容忍次數，找出停止輪次與應保留的權重
  - id: g2
    text: 比較先降學習率再早停的時序，以及等待時間長短的取捨
  - id: g3
    text: 區分驗證決策與測試評估，確認停止後是否還原權重
formula_groups:
  - id: improvement
    source: https://keras.io/api/callbacks/early_stopping/；https://github.com/keras-team/keras/blob/v3.15.1/keras/src/callbacks/monitor_callback.py
    status: verified
    checked_by: ctx_81ecdebd9e83
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 最佳參考損失 0.58，min_delta=0.02、patience=3，接著為 0.575、0.570、0.610，嚴格小於門檻才算改善。何時停止？
    options:
      A: "0.575 比 0.58 小，首輪即更新參考值並重設計數，第三輪仍不停止"
      B: "0.570 比前輪小，第二輪即更新參考值並重設計數，第三輪仍不停止"
      C: "第三輪停止，保留最新 0.610 的權重"
      D: "三輪都未低於 0.56，第三輪後停止並保留 0.58 的權重"
    answer: D
    explain:
      A: "錯。改善須嚴格小於 0.58−0.02=0.56，0.575 雖較小仍不能重設計數。"
      B: "錯。比較基準仍是 0.58，0.570 未低於 0.56，第二輪也應累計未改善。"
      C: "錯。三輪都未達改善門檻，不能以最後一輪 0.610 的權重取代最佳參考權重。"
      D: "對。連續三次未改善，計數達 patience=3，參考值與對應權重仍是 0.58。"
  - id: c2
    goal: g2
    type: choice
    prompt: Plateau patience=1，次數超過 1 才調降；早停 patience=3，次數達 3 就停。其餘門檻相同，連續三輪沒改善時會怎樣？
    options:
      A: "第一輪結束先調降，第二輪用新步長，第三輪再由早停結束訓練"
      B: "第二輪結束調降，第三輪用新步長，輪末早停"
      C: "調降會重設早停計數，第三輪不停止"
      D: "第三輪結束才調降，同時因早停計數達 3 而停止"
    answer: B
    explain:
      A: "錯。Plateau 要未改善次數超過 1，首輪次數僅為 1，還不會調降。"
      B: "對。第二輪未改善次數為 2，先調降；第三輪使用新步長，但仍未改善，早停計數達 3。"
      C: "錯。調降學習率不代表驗證表現改善，也不會依題意自動重設另一個早停計數器。"
      D: "錯。這把早停的門檻套給 Plateau；Plateau 第二輪結束就應先調降。"
  - id: c3
    goal: g3
    type: choice
    prompt: 早停結束後要回到較早的模型，並保留可信的最終成績，哪種做法合理？
    options:
      A: 只用停止輪次權重，宣稱它必定最佳
      B: 用測試損失反覆選停止點
      C: 明確還原保存的最佳權重，再以未參與決策的測試集評估
      D: 把驗證集併入訓練後仍沿用舊驗證分數
    answer: C
    explain:
      A: 錯。停止輪次可能已落後較早權重。
      B: 錯。測試集參與決策就不再獨立。
      C: 對。權重還原與獨立測試分別處理選模及評估。
      D: 錯。資料角色已改變，舊分數不能代表新模型。
---

## 為什麼需要

訓練損失可能一直下降，驗證表現卻已惡化。早停（Early Stopping；也稱早期停止）用驗證集決定何時結束，減少過擬合風險與不必要的計算。

指引 5-19 提出容忍次數與最小改善幅度。兩者要一起用：微小變化是否算進步，會影響連續未改善的計數。

## 直覺

不因一次沒進步就立即放棄，也不因極小改善就一直等。先訂出「進步多少才算」與「願意等幾輪」，再照規則執行。

### 停止點不等於最佳點（補充）

![第 8 輪才觸發早停；按最小改善幅度 0.02 選出的權重在第 5 輪](figure:l23303-early-stopping-patience)

圖與學習曲線、過擬合共用同一份紀錄。第 6、7 輪雖略降，卻沒有超過改善門檻；到第 8 輪累計三次未改善，才停止。

## 定義與公式

- 監控驗證損失時，越低越好；監控準確率等分數時，方向相反。
- 容忍次數（patience）決定連續未改善幾次後停止。
- 最小改善幅度（min_delta）排除過小的進步。

### 把判定寫清楚（補充）

本頁採 Keras 式的損失最小化判定。將最佳參考值初始化為無限大，等價於第一輪必算改善；Keras 實作的初值是 `None`。每輪比較：

$$
L_e<b-\delta
$$

$L_e$ 是本輪驗證損失，$b$ 是上次達到改善門檻的最佳參考值，$\delta$ 是非負的最小改善幅度。

依 Keras 原始碼的實作，這裡用嚴格小於；剛好等於門檻也不算改善。

成立就把 $b$ 更新為 $L_e$、計數歸零並保存權重；否則計數加一。計數達到 patience 就停止，本例 patience 為 3。

例：$b=0.58$、$\delta=0.02$，需要 $L_e<0.56$。第 6 輪的 0.575 沒達門檻，所以 $b$ 仍是 0.58。

## 走一次流程

### 套用兩個參數（補充）

使用共用影像曲線，設定 `mode="min"`、`min_delta=0.02`、`patience=3`。第 1 至 4 輪每次下降 0.08，都算改善。

| 輪次 | 驗證損失 | 達門檻的最佳值／輪次 | 未改善計數 |
|---|---|---|---|
| 4 | 0.660 | 0.660／4 | 0 |
| 5 | 0.580 | 0.580／5 | 0 |
| 6 | 0.575 | 0.580／5 | 1 |
| 7 | 0.570 | 0.580／5 | 2 |
| 8 | 0.610 | 0.580／5 | 3，停止 |

若設定還原最佳權重，會回到第 5 輪。它是本規則認定的最佳輪，並非所有已觀察數字中的絕對最低點；後者在第 7 輪。

最終測試集不參與上述決策。它在模型與策略選定後才用於獨立評估，見資料分割。

## 程式

### 先驗證停止邏輯（補充）

以下只模擬驗證紀錄與 checkpoint 輪次，不訓練影像模型。在真正訓練迴圈中，保存的是該輪完整權重快照，不只是輪次。

```python
validation = [0.90, 0.82, 0.74, 0.66, 0.58, 0.575, 0.570, 0.610, 0.650, 0.690]
best, wait, best_epoch = float("inf"), 0, None
for epoch, loss in enumerate(validation, 1):
    if loss < best - 0.02:
        best, wait, best_epoch = loss, 0, epoch
    else:
        wait += 1
    if epoch >= 5:
        print(epoch, f"{loss:.3f}", best_epoch, wait)
    if wait >= 3:
        break
print("停止", epoch, "保留", best_epoch)
```
```text
5 0.580 5 0
6 0.575 5 1
7 0.570 5 2
8 0.610 5 3
停止 8 保留 5
```

:::tip[讀碼重點]
比較對象是上次達門檻的 `best`，不是上一輪損失。真正用 Keras 時，要明確設 `restore_best_weights=True`；預設值是 `False`。
:::

## 怎麼用、怎麼判讀

容忍次數太小可能提早結束、形成欠擬合；太大則可能浪費時間或持續擬合雜訊。指引建議搭配學習率調整，讓模型有機會先以較小步長改善。

### 先降學習率，再決定停止（補充）

同一序列搭配 PyTorch `ReduceLROnPlateau`，起始學習率 0.1，明訂以下設定：

- `mode="min"`、`threshold_mode="abs"`、`threshold=0.02`。
- `patience=1`、`factor=0.5`、`cooldown=0`、`min_lr=0.0125`。

1. 第 5 輪建立參考值 0.58。
2. 第 6、7 輪各一次未改善；Plateau 在次數**超過 1**時觸發，因此第 7 輪結束調降至 0.05。
3. 第 8 輪可以用 0.05 訓練；若驗證仍如紀錄為 0.61，早停計數達 3，結束並還原第 5 輪。

這是對固定觀察序列演練規則，不代表調降後一定產生相同損失。若希望調降後多觀察幾輪，要加長早停等待時間或另訂重設規則。

兩個 patience 的 API 語意不同，不能只看同名參數就認為會同時觸發。最小改善門檻、冷卻期與監控方向也必須明訂。

### 換個場景

| 場景或條件 | 怎麼使用 | 注意事項 |
|---|---|---|
| 訓練過久、驗證不再進步 | 監控驗證指標並提前結束 | 指引場景；不需改模型架構 |
| 製造影像分類（補充） | 用驗證交叉熵早停 | 同零件影像不跨集合 |
| 需求預測（補充） | 用較晚時段的驗證損失 | 別把時間洩漏當成泛化 |
| 醫療風險預測（補充） | 監控與業務目標一致的指標 | 小驗證集波動大，容忍時間需評估 |

## 常見誤解

- 「早停保證比較準」：它是控制訓練時間的策略，不保證最佳泛化。
- 「等越久越安全」：等待過長仍可能過擬合。

:::supplement[來源：Keras EarlyStopping API；scikit-learn User Guide：Validation curves]
不能用訓練損失最低點代替泛化監控，也不能拿最終測試集反覆決定何時停。停止後若沒有還原權重，得到的就是停止輪次模型，不會自動變成較早的最佳模型。
:::

## 進階

### 權重快照與續訓（補充）

若只要推論，還原模型權重即可。若要從較早輪次接續訓練，還須保存優化器、排程器與隨機狀態，否則不等於完整恢復那次訓練。

### 參考來源

- 學習指引科目 3，5-19～5-20、5-46（支持：目的、兩參數、搭配學習率與適用條件）。
- [Keras EarlyStopping](https://keras.io/api/callbacks/early_stopping/)（支持：嚴格改善判定、停止計數與還原權重）。
- [Keras v3.15.1 MonitorCallback 原始碼](https://github.com/keras-team/keras/blob/v3.15.1/keras/src/callbacks/monitor_callback.py)（支持：第一輪必算改善與嚴格不等式的實作）。
- [PyTorch ReduceLROnPlateau](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.ReduceLROnPlateau.html)（支持：先降再停的逐輪規則）。
- [Dive into Deep Learning 5.5.3](https://d2l.ai/chapter_multilayer-perceptrons/generalization-deep.html)（支持：直覺與標籤雜訊下限制訓練時間的理由）。
- [scikit-learn：Validation curves](https://scikit-learn.org/stable/modules/learning_curve.html)（支持：驗證選模與獨立測試界線）。

## 小結

- 同時訂出監控方向、最小改善幅度與容忍次數。
- 本例第 8 輪停止，達門檻的最佳權重在第 5 輪。
- 還原最佳權重要明確設定，停止模型不會自動等於最佳模型。
- 先降學習率可保留改善機會，兩個 patience 要分開驗算。
