---
id: learning-rate-schedule
title: 學習率排程
aliases:
  - 學習率調整
  - Learning Rate Schedule
  - Step Decay
  - Exponential Decay
  - ReduceLROnPlateau
  - Warmup
  - 學習率預熱
kind: technique
codes:
  - L23303
  - L23304
guide_refs:
  - guide-3:3-27
  - guide-3:5-19
  - guide-3:5-20
  - guide-3:5-31
  - guide-3:5-32
gaps:
  - ref: guide-3:5-19
    level: shallow
    ability: 指引只用一行各介紹遞減、動態調整、預熱，沒有公式與參數（衰減係數、patience、下限）；考題目前只考學習率過大的現象、微調用小學習率、學習率屬於超參數
author: codex
status: draft
textbook: v2
summary: 學習率調整依訓練進度或驗證表現改變參數更新的步長
goals:
  - id: g1
    text: 比較固定、階梯、指數、餘弦、平臺調降與預熱，算出指定輪次步長
  - id: g2
    text: 依監控方向、門檻與容忍次數，判定平臺調降的觸發輪次
  - id: g3
    text: 分辨調整前後的使用時序，並與早停、批次大小配合，以同一目標的三條軌跡比較步長
formula_groups:
  - id: gradient-step
    source: https://d2l.ai/chapter_optimization/gd.html#multivariate-gradient-descent（式12.3.7直接列負梯度更新；修正來源後待非作者重簽）
    status: verified
    checked_by: task_e3bba14a08df
  - id: step-decay
    source: https://github.com/pytorch/pytorch/blob/v2.9.1/torch/optim/lr_scheduler.py#L483-L487
    status: verified
    checked_by: task_e3bba14a08df
  - id: exponential-warmup
    source: https://d2l.ai/chapter_optimization/lr-scheduler.html（支持比例遞推及預熱概念；未直接列本頁從t+1起算、預熱後固定的完整式，來源待補）
    status: pending
    checked_by: null
  - id: plateau
    source: https://github.com/pytorch/pytorch/blob/v2.9.1/torch/optim/lr_scheduler.py#L1238-L1288
    status: verified
    checked_by: task_e3bba14a08df
  - id: cosine-schedule
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.CosineAnnealingLR.html
    status: verified
    checked_by: task_e3bba14a08df
  - id: controlled-objective
    source: https://d2l.ai/chapter_optimization/gd.html（支持負梯度更新；八筆平方目標及其遞推解為本頁自行設定與推導）
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 起始學習率 0.1，每完成 2 輪乘 0.5。第 5 輪開始時學習率為何？
    options:
      A: "0.025"
      B: "0.050"
      C: "0.00625"
      D: "0.100"
    answer: A
    explain:
      A: 對。已完成兩次調降，0.1×0.5²=0.025。
      B: 錯。0.050 是只調降一次。
      C: 錯。0.00625 是每輪指數衰減的結果。
      D: 錯。此策略並非固定學習率。
  - id: c2
    goal: g2
    type: choice
    prompt: PyTorch Plateau 採 min、abs threshold=0.02、patience=1，最佳 0.58，接著為 0.575、0.570。何時調降？
    options:
      A: "0.575 那輪結束就調降，因第一次未達門檻就已超過 patience=1"
      B: "0.575 與 0.570 都低於前輪，兩輪均重設未改善計數而不調降"
      C: "0.570 那輪結束調降，下一輪使用新步長"
      D: "等第三次未達門檻才調降"
    answer: C
    explain:
      A: "錯。第一次未達門檻時計數為 1，還沒有超過 patience=1。"
      B: "錯。min 模式且絕對門檻為 0.02，必須低於 0.58−0.02=0.56 才算改善，僅低於前輪並不夠。"
      C: "對。兩輪都未達門檻，第二次的計數 2 超過 patience=1，輪末調降後於下一輪使用。"
      D: "錯。計數 2 就已超過 1，無須再等第三次未達門檻。"
  - id: c3
    goal: g3
    type: choice
    prompt: 原本每輪呼叫 StepLR 一次，改成每批一次，而每輪有 20 批，最先要注意什麼？
    options:
      A: 模型會自動補償
      B: 學習率不受呼叫次數影響
      C: 只要種子相同就完全等價
      D: 衰減的時間尺度改變，可能太快降低步長
    answer: D
    explain:
      A: 錯。排程器不會自動推測原本時間單位。
      B: 錯。呼叫次數就是此設定的排程進度。
      C: 錯。種子不能抵銷更新時序改變。
      D: 對。每輪呼叫次數大增，需重新設定衰減間隔。
  - id: c4
    goal: g3
    type: choice
    prompt: 同一平方目標的參數在零點兩側交替，但每步損失下降。哪個說法合理？
    options:
      A: 已能確定梯度爆炸，必須把梯度裁剪後才可繼續
      B: 參數震盪仍可能收斂，應一併看振幅及實際損失
      C: 已能確定過擬合，必須立刻還原上一輪的權重
      D: 損失下降表示步長必定最佳，不需再作其他對照
    answer: B
    explain:
      A: 錯。跨零本身不能證明梯度失控，也不能直接決定裁剪。
      B: 對。縮小的振幅與下降的損失支持收斂，不能只看符號。
      C: 錯。此觀察未提供訓練與未見資料的泛化落差。
      D: 錯。尚須比較相同預算、其他步長及任務驗證表現。
---

## 為什麼需要

學習率（Learning Rate）控制參數每次更新的步長。過大可能震盪或發散，過小可能學得很慢；同一個值未必適合整段訓練。

學習率調整（英文 Learning Rate Scheduling；也稱學習率排程）讓步長依進度或驗證表現改變。它是訓練者設定的策略，並非模型權重。

## 直覺

早期以適當步長快速下降，後期把步長縮小，才有機會細緻收斂。預熱則先用小步長起步，再逐漸升到目標值，指引特別提到 Transformer。

| 策略 | 觸發條件 | 用途 |
|---|---|---|
| 固定值 | 全程不變 | 簡單任務與比較基準 |
| 階梯衰減（Step Decay） | 每隔固定輪數 | 按預定進度調降 |
| 指數衰減（Exponential Decay） | 每輪按比例下降 | 逐輪平滑縮小 |
| 平臺調降（ReduceLROnPlateau） | 驗證表現停滯 | 依實際學習情況調整 |
| 預熱（Warmup） | 開始的幾輪 | 降低初期更新不穩的風險 |

觸發條件的延伸細節依 PyTorch StepLR、ReduceLROnPlateau 與 d2l 12.11 補充；五種策略的名稱與用途來自指引 5-19。

## 定義與公式

### 更新式與排程公式（補充）

以最基本的梯度下降表示：

$$
\theta_{t+1}=\theta_t-\eta_t g_t
$$

$\theta_t$ 是第 $t$ 次更新前的參數，$g_t$ 是當次梯度，$\eta_t$ 是學習率。例如參數 1、梯度 2、學習率 0.1，更新後為 $1-0.1\times2=0.8$。

下式改以「輪次」設定排程：令 $t=0$ 表示第 1 輪，$\eta_0$ 是初始或目標學習率，$s$ 是階梯間隔，$\gamma$ 是衰減比例。

$$
\begin{aligned}
\eta_t^{\mathrm{constant}}&=\eta_0\\
\eta_t^{\mathrm{step}}&=\eta_0\gamma^{\lfloor t/s\rfloor}\\
\eta_t^{\mathrm{exp}}&=\eta_0\gamma^t
\end{aligned}
$$

$\lfloor\cdot\rfloor$ 表示向下取整。衰減時取 $0<\gamma<1$、$s$ 為正整數；以下算例採 $\eta_0=0.1$、$s=2$、$\gamma=0.5$。

線性預熱可明訂為：

$$
\eta_t^{\mathrm{warm}}=\eta_0\min\left(\frac{t+1}{w},1\right)
$$

$w$ 是預熱輪數，本例為 3；第 1 輪是 $0.1/3\approx0.033333$。這裡預熱後固定在 0.1；實務也能再接衰減。

### 餘弦排程的輪次定義（補充）

餘弦退火（Cosine Annealing）按預定進度平滑調整，不讀驗證損失。本例初始步長 0.1，`T_max=10`、`eta_min=0.0125`；$t$ 為已完成的輪末呼叫次數：

$$
\eta_t=\eta_{\min}+\frac{\eta_0-\eta_{\min}}{2}
\left(1+\cos\frac{\pi t}{T_{\max}}\right)
$$

$\eta_0$ 為初始值，$\eta_{\min}$ 為下限，$T_{\max}$ 為下降區段長度。第 6 輪 $t=5$，餘弦為 0，得到 $0.0125+0.0875/2=0.05625$。

本例只走 $0\le t\le10$ 的下降區段，不含重新啟動。第 10 輪用的是 $t=9$；輪末才到 $t=10$ 的下限。若超過設定長度繼續呼叫，要再查實作行為，不能假設會永遠固定下限。

### 平臺調降的判定（補充）

損失最小化、絕對門檻模式下，只有本輪驗證損失小於「最佳參考值減 threshold」才算改善。未改善次數超過 patience 才調降。

$$
\eta_{\mathrm{next}}=\max(\eta_{\min},\ f\eta_{\mathrm{current}})
$$

$f$ 是調降比例，$\eta_{\min}$ 是下限。例如目前 0.1、$f=0.5$、下限 0.0125，調降後是 $\max(0.0125,0.05)=0.05$。

PyTorch 預設 threshold 是相對門檻；若要用上述絕對差值，必須設 `threshold_mode="abs"`。還須指定 `mode="min"`、冷卻期與最小變化量。

PyTorch 另有 `eps=1e-8` 的最小調降幅度判斷，變化太小就不更新。本例每次調降都遠大於此值，因此不會觸發忽略更新的條件。

## 走一次流程

### 排出下一輪的步長（補充）

`L23303-D-rate-schedules.json` 保存六輪設定。以下都是該輪**開始訓練時**使用的值，沒有把輪末調整誤當成本輪已用的值。

| 輪次 | 固定值 | 階梯／指數 | 線性預熱後固定 |
|---|---|---|---|
| 1 | 0.100 | 0.100／0.100 | 0.033333 |
| 2 | 0.100 | 0.100／0.050 | 0.066667 |
| 3 | 0.100 | 0.050／0.025 | 0.100000 |
| 4 | 0.100 | 0.050／0.0125 | 0.100000 |
| 5 | 0.100 | 0.025／0.00625 | 0.100000 |
| 6 | 0.100 | 0.025／0.003125 | 0.100000 |

例如第 5 輪的 $t=4$：階梯為 $0.1\times0.5^{\lfloor4/2\rfloor}=0.025$，指數為 $0.1\times0.5^4=0.00625$。

平臺策略共用影像曲線：第 5 輪最佳參考值為 0.58。設定絕對門檻 0.02、patience=1，則 0.575、0.570 都不算改善，第 7 輪結束才首次調降。

### 同一輪軸看三種排程（補充）

新增紀錄在 `L23303-M4-B-controlled-training.json` 的 `scheduler_api_only`，各設定沿用本頁定義：

- Step：間隔 2 輪、比例 0.5。
- Cosine：下降區段 10 次呼叫、下限 0.0125。
- Plateau：絕對門檻 0.02、patience=1、比例 0.5、下限 0.0125、cooldown=0。

![三條線只畫該epoch實際使用的學習率；Step與Cosine依輪次，Plateau依固定人工驗證序列](figure:l23303-m4-b-scheduler-timeline)

呼叫時序如下，輪末調整留給下一輪：

1. 讀本輪學習率，執行訓練的 `optimizer.step()`。
2. 評估驗證資料。
3. Step、Cosine 呼叫 `step()`；Plateau 呼叫 `step(validation_loss)`。

下表每格為「本輪使用 → 輪末改完、下輪使用」，保留六位小數：

| epoch | Step | Cosine | Plateau |
|---|---|---|---|
| 1 | 0.100000→0.100000 | 0.100000→0.097859 | 0.100000→0.100000 |
| 2 | 0.100000→0.050000 | 0.097859→0.091644 | 0.100000→0.100000 |
| 3 | 0.050000→0.050000 | 0.091644→0.081966 | 0.100000→0.100000 |
| 4 | 0.050000→0.025000 | 0.081966→0.069769 | 0.100000→0.100000 |
| 5 | 0.025000→0.025000 | 0.069769→0.056250 | 0.100000→0.100000 |

接續相同實驗的後五輪：

| epoch | Step | Cosine | Plateau |
|---|---|---|---|
| 6 | 0.025000→0.012500 | 0.056250→0.042731 | 0.100000→0.100000 |
| 7 | 0.012500→0.012500 | 0.042731→0.030534 | 0.100000→0.050000 |
| 8 | 0.012500→0.006250 | 0.030534→0.020856 | 0.050000→0.050000 |
| 9 | 0.006250→0.006250 | 0.020856→0.014641 | 0.050000→0.025000 |
| 10 | 0.006250→0.003125 | 0.014641→0.012500 | 0.025000→0.025000 |

Plateau 第 7 輪驗證 0.570 未低於 0.56，輪末才降，第 8 輪才用 0.05。三策略只共用輪次及人工驗證輸入，不能把此圖當提升準確度的實測。

### 同一目標的三條更新軌跡（補充）

另固定八筆目標 −1、+1 交替，模型只預測常數 $w$。平均平方損失除以 2，得到自訂目標 $F(w)=(w^2+1)/2$，梯度為 $w$；參數與損失無單位。

每組初值 2、全批八筆、CPU float64，做滿 12 步。固定列序、不洗牌，不加動量、正則化或隨機層；每步後用同八筆評估。

$$
w_{k+1}=w_k-\eta w_k=(1-\eta)w_k
$$

$k$ 是更新次數，$\eta$ 是固定學習率。以 1.8 為例：第一步 $2-1.8\times2=-1.6$，第二步得到 1.28；每步損失由新參數代回 $F$，不使用人工驗證值。

![同一目標初值與12次全量更新；參數跨零不一定發散，損失縱軸使用對數尺度以容納大幅差異](figure:l23303-m4-b-learning-rate-control)

| 學習率 | 前兩步參數 | 第12步參數 | 第12步損失 |
|---|---|---|---|
| 0.25 | 1.5→1.125 | 0.063353 | 0.502007 |
| 1.8 | −1.6→1.28 | 0.137439 | 0.509445 |
| 2.2 | −2.4→2.88 | 17.832201 | 159.493694 |

此例 1.8 振幅縮小且損失下降，2.2 才發散；較大不一定較快，跨零震盪也不等於梯度爆炸。資料、初值、步數與評估固定，只改步長；不能把結果當所有模型的門檻或泛化比較。

## 程式

### 用真實 API 演練平臺調降（補充）

以下只用單一 CPU 參數更新，驗證值取自固定模擬紀錄，目的是確認 API 時序。它不是影像訓練實驗，調降後的損失也不是由這個參數算出。

```python
import torch

torch.manual_seed(7)
p = torch.nn.Parameter(torch.tensor([1.0]))
opt = torch.optim.SGD([p], lr=0.1)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    opt, mode="min", factor=0.5, patience=1, threshold=0.02,
    threshold_mode="abs", min_lr=0.0125, cooldown=0)
values = [0.90, 0.82, 0.74, 0.66, 0.58, 0.575, 0.570, 0.610, 0.650, 0.690]
for epoch, loss in enumerate(values, 1):
    used = opt.param_groups[0]["lr"]
    opt.zero_grad(); p.square().sum().backward(); opt.step()
    scheduler.step(loss)
    if epoch >= 5:
        print(epoch, f"{loss:.3f}", f"{used:.3f}", f"{opt.param_groups[0]['lr']:.3f}")
```
```text
5 0.580 0.100 0.100
6 0.575 0.100 0.100
7 0.570 0.100 0.050
8 0.610 0.050 0.050
9 0.650 0.050 0.025
10 0.690 0.025 0.025
```

:::tip[讀碼重點]
- 輸出依序是輪次、驗證損失、本輪使用值、下一輪使用值。先訓練並評估，再呼叫 `scheduler.step(loss)`；一般 StepLR 不接驗證損失。
- 調降後計數歸零；第 8、9 輪再各一次未改善，所以第 9 輪末再降到 0.025。這段輸出尚未到達 `min_lr=0.0125` 下限。
:::

### 實際跑三種排程的呼叫順序（補充）

接續上一段，沿用已匯入的 `torch` 與十輪驗證序列 `values`。以下以單一參數演練 API，驗證值仍是人工序列。

`used` 必須在輪末呼叫前取得。輸出只節錄第 1、7、10 輪，完整十輪在新 JSON。

```python
for name in ("Step", "Cosine", "Plateau"):
    p = torch.nn.Parameter(torch.tensor([1.0], dtype=torch.float64))
    opt = torch.optim.SGD([p], lr=0.1)
    if name == "Step":
        sch = torch.optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
    elif name == "Cosine":
        sch = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=10, eta_min=0.0125)
    else:
        sch = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5,
            patience=1, threshold=0.02, threshold_mode="abs", min_lr=0.0125, cooldown=0)
    for epoch, loss in enumerate(values, 1):
        used = opt.param_groups[0]["lr"]
        opt.zero_grad(); p.square().sum().backward(); opt.step()
        if name == "Plateau":
            sch.step(loss)
        else:
            sch.step()
        if epoch in (1, 7, 10): print(name, epoch, f"{used:.6f}", f"{opt.param_groups[0]['lr']:.6f}")
```
```text
Step 1 0.100000 0.100000
Step 7 0.012500 0.012500
Step 10 0.006250 0.003125
Cosine 1 0.100000 0.097859
Cosine 7 0.042731 0.030534
Cosine 10 0.014641 0.012500
Plateau 1 0.100000 0.100000
Plateau 7 0.100000 0.050000
Plateau 10 0.025000 0.025000
```

### 重算實際軌跡而非人工驗證值（補充）

```python
for rate in (0.25, 1.8, 2.2):
    w = 2.0
    for step in range(12):
        w -= rate * w
    print(rate, f"{w:.6f}", f"{(w*w+1)/2:.6f}")
```
```text
0.25 0.063353 0.502007
1.8 0.137439 0.509445
2.2 17.832201 159.493694
```

## 怎麼用、怎麼判讀

固定值可當簡單基準；已知訓練階段可用階梯或指數；改善時間不確定時可監控驗證表現。預熱處理起步階段，不能代替後期策略。

先訂總訓練預算、希望平滑降率時，可考慮餘弦。連續發散則先查步長、尺度與梯度；若只想在驗證停滯時降率，Plateau 更直接，但小驗證集的波動會影響觸發。

學習率太大造成的震盪，與訓練持續變好、驗證持續變差的過擬合不同。要連同批次大小與學習曲線檢查，不能看一個點就斷定原因。

### 換個場景

| 場景或條件 | 可用策略 | 判讀重點 |
|---|---|---|
| 簡單任務 | 固定值 | 指引場景；後期是否停滯 |
| Transformer | 預熱再接後續策略 | 指引場景；初期是否不穩 |
| 製造影像（補充） | 驗證停滯時調降 | 對照早停等待時間 |
| 商店需求預測（補充） | 固定值與衰減做比較 | 使用同一時間切分 |
| 客服文字分類（補充） | 小步長微調並追蹤驗證 | 改善是否只來自常見類別 |

指引 5-31 也提到 CNN、RNN，以及使用梯度法的傳統線性模型。這些模型都能設定步長；不應把學習率視為所有演算法都有的參數。

## 常見誤解

- 「學習率越小越好」：可能學得太慢，未在預算內收斂。
- 「所有策略只會下降」：預熱會先升高。

指引 3-27 說明 Adam 等優化器的逐參數自適應；它與全域學習率的時間策略可以並用。

:::supplement[來源：PyTorch ReduceLROnPlateau API]
Plateau 與早停的 patience 各自計數；要留足調降後的觀察時間，不能直接套同一組數值。
:::

## 進階

### 每輪與每次更新（補充）

排程的時間單位要明訂。若把原本每輪呼叫一次的 StepLR 改成每批呼叫，衰減會加快；調整批次大小也會改變每輪的更新次數。

日程圖用來對齊輪次與本輪使用值；參數／損失圖則用實際更新核對收斂。兩者分開，避免把人工驗證輸入誤當因果實驗。

### 參考來源

- 學習指引科目 3，3-27、5-19～5-20、5-31～5-33（支持：自適應學習率、五種策略、適用場景與步長風險）。
- [PyTorch StepLR](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.StepLR.html)（支持：階梯公式與呼叫時序）。
- [PyTorch ReduceLROnPlateau](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.ReduceLROnPlateau.html)（支持：門檻、計數、下限與程式）。
- [Dive into Deep Learning 12.11](https://d2l.ai/chapter_optimization/lr-scheduler.html)（支持：更新直覺、衰減與預熱算例）。
- [PyTorch CosineAnnealingLR](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.CosineAnnealingLR.html)（支持：餘弦公式、T_max 與輪末呼叫）。
- [Dive into Deep Learning 12.3](https://d2l.ai/chapter_optimization/gd.html)（支持：負梯度法；本頁平方目標與遞推式為自行設定及推導）。

## 小結

- 學習率控制步長，調整策略控制步長何時改變。
- 區分預定衰減、驗證停滯觸發與起步預熱。
- 本例 Plateau 在第 7 輪結束調降，第 8 輪才使用 0.05。
- 指定方向、絕對或相對門檻，並與早停分別驗算。
