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
    text: 比較固定、階梯、指數、平臺調降與預熱，算出指定輪次步長
  - id: g2
    text: 依監控方向、門檻與容忍次數，判定平臺調降的觸發輪次
  - id: g3
    text: 分辨調整前後的使用時序，並與早停、批次大小配合
formula_groups:
  - id: gradient-step
    source: https://d2l.ai/chapter_optimization/lr-scheduler.html
    status: verified
    checked_by: ctx_81ecdebd9e83
  - id: step-decay
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.StepLR.html（封閉式由每隔固定輪數乘衰減比例的規則展開）
    status: verified
    checked_by: ctx_81ecdebd9e83
  - id: exponential-warmup
    source: https://d2l.ai/chapter_optimization/lr-scheduler.html（指數式由固定比例遞推展開；線性預熱公式為本頁明訂）
    status: verified
    checked_by: ctx_81ecdebd9e83
  - id: plateau
    source: https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.ReduceLROnPlateau.html
    status: verified
    checked_by: ctx_81ecdebd9e83
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

## 怎麼用、怎麼判讀

固定值可當簡單基準；已知訓練階段可用階梯或指數；改善時間不確定時可監控驗證表現。預熱處理起步階段，不能代替後期策略。

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

本頁沒有圖：目標是比較明確規則與觸發時點，六輪表格及程式輸出已能逐項驗算，不要求曲線形狀的視覺推理。

### 參考來源

- 學習指引科目 3，3-27、5-19～5-20、5-31～5-33（支持：自適應學習率、五種策略、適用場景與步長風險）。
- [PyTorch StepLR](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.StepLR.html)（支持：階梯公式與呼叫時序）。
- [PyTorch ReduceLROnPlateau](https://docs.pytorch.org/docs/2.9/generated/torch.optim.lr_scheduler.ReduceLROnPlateau.html)（支持：門檻、計數、下限與程式）。
- [Dive into Deep Learning 12.11](https://d2l.ai/chapter_optimization/lr-scheduler.html)（支持：更新直覺、衰減與預熱算例）。

## 小結

- 學習率控制步長，調整策略控制步長何時改變。
- 區分預定衰減、驗證停滯觸發與起步預熱。
- 本例 Plateau 在第 7 輪結束調降，第 8 輪才使用 0.05。
- 指定方向、絕對或相對門檻，並與早停分別驗算。
