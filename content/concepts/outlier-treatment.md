---
id: outlier-treatment
title: 異常值的保留與修正
kind: technique
codes: [L23301]
aliases: [Winsorization, 截尾, 異常標記]
requires: [outlier-detection]
summary: 依錯誤證據與任務價值決定修正、移除、限界、轉換或標記保留
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-3, guide-3:5-4, guide-3:5-56]
goals:
  - id: g1
    text: 依通訊錯誤或有效罕見樣本選擇移除、限界、轉換與保留，留下處理紀錄
formula_groups:
  - id: log1p-transform
    source: https://numpy.org/doc/stable/reference/generated/numpy.log1p.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 製造快照32筆，去除2份已確認重送後有30筆；其中1筆999為通訊錯誤且無法還原。若只排除該筆錯誤列，還剩多少筆？
    options:
      A: 留下28筆，因去重後還應把999與同組的一筆有效讀值一起排除
      B: 留下30筆，因通訊錯誤只要改成0就可當成真實低溫保留
      C: 留下29筆，並保存999原值、事件識別及排除的查證依據
      D: 留下32筆，因重送與錯誤碼只要能轉成數字就都無須處理
    answer: C
    explain:
      A: 沒有證據支持排除另一筆有效讀值，應只處理已確認的錯誤列。
      B: 改0會捏造低溫，並未還原未知的原始量測。
      C: 去重後30筆再排除1筆為29筆，留下紀錄才能追查原始事件。
      D: 轉型成功無法排除重送與語意錯誤，保留會污染統計與訓練。
  - id: c2
    goal: g1
    type: choice
    prompt: 80°C已確認為真實升溫，超過IQR上界48.75°C；任務是預警高溫故障。哪種處置最值得先保留作比較？
    options:
      A: 將80改成48.75並刪去原值，讓高溫故障樣本與邊界值完全相同
      B: 保留80及候選標記，再評估這項訊號對高溫故障預警的價值
      C: 將80所在列直接刪除，再以乾淨資料集證明模型不會遇到高溫
      D: 將80改成均值28.125並刪去原值，讓高溫故障樣本回到多數區間
    answer: B
    explain:
      A: 限界可能壓掉任務重視的高溫強度，刪原值又無法回溯。
      B: 真實罕見升溫可能正是目標訊號，保留後再驗證有助避免誤刪。
      C: 刪除高溫資料不代表部署時不會再遇到高溫，還會失去訓練機會。
      D: 無證據把有效量測改均值，會抹掉可能與故障有關的差異。
  - id: c3
    goal: g1
    type: choice
    prompt: 零售800元已確認為有效金額，團隊想降低右偏影響。關於log1p與限界，何者正確？
    options:
      A: 兩者都能證明800是輸入錯誤，因此轉換後可丟棄原始交易與金額
      B: log1p會刪除800那筆交易，限界會新增一筆邊界交易補足原始列數
      C: log1p可把任何負值變成有限數，限界可自動還原未知的真實金額
      D: log1p改變數值尺度，限界會壓平超界值，兩者都需記錄轉換規則
    answer: D
    explain:
      A: 轉換方法處理表達或影響程度，不能提供輸入錯誤的事實證據。
      B: 本例兩者都保留原列數，差別在改變數值的方式。
      C: log1p有定義域限制，限界也不會找回原本未知的真值。
      D: 方法的資訊損失與後續判讀不同，原值與規則都應保留。
---

## 為什麼需要

同樣被標記的80°C與999錯誤碼，不該得到同一種處置。錯值會污染模型；有效的罕見升溫卻可能是故障預警最需要的訊號。

離群值偵測與處置中的「偵測」提供候選。本頁接著依證據與任務選擇處置，並保留原值及調整依據。

## 直覺

先把「資料是否可信」和「它會不會影響模型」分成兩個問題。資料不可信時先查來源；資料可信卻影響很大時，再比較限界、轉換或標記保留。

截尾在本頁依指引用法，指把超界數值限制在邊界內，仍保留該列。這和直接刪掉尾端觀測不同。

:::supplement[來源：SciPy winsorize；NumPy clip]
英文Winsorization常依分位數選限界值；本頁用IQR上界示範限界，並非直接呼叫分位數版`winsorize`。比較方法前要寫清楚界線怎麼定。
:::

## 定義與公式

### 四種處理策略

| 策略 | 什麼證據支持 | 改變什麼 | 本例提醒 |
|---|---|---|---|
| 移除 | 已確認錯誤且無法還原 | 分析使用的列數 | 999錯誤碼排除 |
| 限界／截尾 | 有理由限制極端影響 | 超界值被壓到邊界 | 80可能失去高溫強度 |
| 轉換 | 有效資料右偏、需改尺度 | 整個數值表達方式 | 對數不會修好錯誤碼 |
| 標記保留 | 稀有事件本身有預測價值 | 保留原值，另加候選欄 | 欺詐偵測可能需要大額訊號 |

若查到可靠原始量測，應依證據修正錯值；例如M04的176°F可依明確單位換回80°C。這種確定的修正，不等於把未知錯值猜成均值。

指引也列出Box-Cox轉換，可作為調整分布的另一種方法；它和對數轉換都不能替代錯誤來源的查證。

:::supplement[來源：SciPy boxcox；scikit-learn PowerTransformer]
Box-Cox要求輸入嚴格大於0；若有零或負值，可依欄位語意決定是否先位移，或評估能處理非正值的Yeo-Johnson。位移規則及需估計的參數都須保存，不能只求程式跑得動。
:::

### 對數轉換的具體形式（補充）

對非負金額可選擇：

$$
y=\ln(1+x)
$$

$x$為固定貨幣單位的金額數值，$y$為轉換特徵，$\ln$為自然對數。代入800得$\ln(801)\approx6.6859$，這是特徵值，不是6.6859元。

`log1p`在$x>-1$時有有限實數結果，本例只採非負輸入。若存在退貨負金額，須先釐清語意與選用別種策略，不能直接套用；單位與轉換方式也要固定。

## 走一次流程

### 通訊錯誤與有效極端值

共用快照每域32列。先依重複資料與主鍵去重的規則合併索引30、31兩份重送，剩30列，再查索引10的999錯誤碼。

1. 通訊紀錄確認999不是溫度，原始數值尚未找回；排除該列的數值建模輸入，並保存原始紀錄。
2. 另有M04的80°C已被儀表確認。若目標是高溫預警，先保留其數值與候選標記，再比較模型表現。
3. 若另做穩健的趨勢估計，可評估限界，但要記錄80被壓至48.75造成的差異。
4. 零售R04的800元也是真實交易；若用於欺詐偵測，保留罕見金額訊號，是否欺詐則由獨立標籤判定。

![保留真值與限界會產生不同的特徵，不能只看處理後是否更整齊。](figure:l23301-outlier-treatment-effects)

:::supplement[來源：NumPy clip；scikit-learn Compare the effect of different scalers on data with outliers]
圖中界線來自同八筆校準溫度的IQR上界48.75°C，並非儀器的物理上限。限界讓80減少31.25°C；若把48.75以上都改成同值，就失去它們彼此的強度差異。

兩域都是32→去重30→排除錯誤碼29列；索引12的時間解析失敗仍另標記，不影響這裡的數值欄列數。時間分析需再判斷該列能否使用，不能把29視為所有任務的共同分母。
:::

### 留下可追查的處理紀錄

| 事件／欄位 | 原值與處置 | 依據 | 保留資訊 |
|---|---|---|---|
| M04／temp | 176°F轉80°C | 明確單位與獨立儀表 | 原值、單位與規則 |
| M11／temp | 999排除數值輸入 | 通訊錯誤紀錄 | 事件鍵、原值與原因 |
| M04／候選欄 | 保留80，另記候選 | 真實升溫與任務需求 | 偵測門檻及處置理由 |
| R04／amount | 保留800元 | 有效交易憑證 | 原金額與轉換版本 |

## 程式

### 同一小例比較保留、限界及轉換（補充）

前八筆沿用離群值偵測頁的校準順序，第九筆加上M11的999。`bad_packet`來自已查證的通訊紀錄，並非看到大數字就當錯誤。

```python
import numpy as np
raw = np.array([10, 20, 30, 25, 10, 20, 30, 80, 999], dtype=float)
bad_packet = np.array([False] * 8 + [True])
valid = raw[~bad_packet]
q1, q3 = np.quantile(valid, [0.25, 0.75], method="linear")
low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
flag = (valid < low) | (valid > high)
capped = np.clip(valid, low, high)
print(len(raw), len(valid))
print(float(valid[-1]), float(capped[-1]), bool(flag[-1]))
print(round(float(np.log1p(valid[-1])), 4))
```
```text
9 8
80.0 48.75 True
4.3944
```

:::tip[讀碼重點]
`valid`保留有效原值，`capped`是另一份候選特徵；`flag`只表示超界。三者分開存，才能比較處理效果與還原決策。
:::

## 怎麼用、怎麼判讀

處理策略要服務任務：估平均趨勢與偵測稀有故障，可能需要不同特徵。刪掉難以預測的案例後，不能拿變好的分數宣稱模型已改善原任務。

:::supplement[來源：scikit-learn Common pitfalls 12.2；Compare the effect of different scalers on data with outliers]
需估計的限界值與轉換參數只從訓練資料取得，驗證及上線沿用相同規則。比較策略時固定評估樣本與指標，另報被排除的比例，避免挑走難題後才比較分數。
:::

### 換個場景

| 場景／資料條件 | 可考慮的策略 | 需保留的證據 |
|---|---|---|
| 確認輸入錯誤 | 能還原就修正，否則排除 | 原始來源與錯誤原因 |
| 欺詐偵測中的有效稀有值 | 標記保留 | 候選與真實標籤分開 |
| 收入或銷售額右偏 | 評估對數轉換 | 單位及轉換規則 |
| 製造通訊錯誤（補充） | 依錯誤碼處理數值輸入 | 裝置規格與封包日誌 |
| 交通壅塞預警（補充） | 保留真實的長延遲 | 時段、事件與原始延遲 |

## 常見誤解

- **超過統計界線就修成邊界。** 界線只能標候選，處置還要看真實性與任務。
- **對數能修好999。** 對數改的是尺度，錯誤碼仍是錯誤碼。
- **標記等於已確認欺詐。** 候選旗標不能取代事件真實標籤。
- **移除後列數不變。** 限界與轉換通常保留列，移除會改變分析樣本。

## 進階

### 限界後的資訊損失（補充）

若80與100都被壓到48.75，單靠限界後的欄位無法還原原值。可以保存原欄與候選標記，評估是否需要穩健模型；不要在不可逆覆寫之後才想起要稽核。

### 參考來源

- 科目3指引`guide-3:5-3`～`guide-3:5-4`、`guide-3:5-56`：四種處理策略、欺詐與右偏場景、可追溯紀錄。
- [NIST 離群值偵測](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm)：查證後修正或排除，以及有效罕見值的處理思路。
- [SciPy winsorize](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mstats.winsorize.html)：截尾名詞與分位數限界的區分。
- [NumPy clip](https://numpy.org/doc/stable/reference/generated/numpy.clip.html)、[log1p](https://numpy.org/doc/stable/reference/generated/numpy.log1p.html)：限界、轉換公式與程式。
- [SciPy boxcox](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.boxcox.html)、[scikit-learn PowerTransformer](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PowerTransformer.html)：Box-Cox的正值限制、位移與Yeo-Johnson選擇。
- [scikit-learn 縮放與離群值教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_all_scaling.html)：處理前後保留差異、資訊損失的說明構想。
- [scikit-learn 異常偵測指南](https://scikit-learn.org/stable/modules/outlier_detection.html)：候選與資料使用範圍的區分。
- [scikit-learn 常見錯誤12.2](https://scikit-learn.org/stable/common_pitfalls.html)：訓練估計與固定評估資料的邊界。

## 小結

- 先確認資料是否錯誤，再看它對任務有什麼價值。
- 移除、限界、轉換與保留改變的資訊不同，不能互相替代。
- 本頁的截尾指限界，保留該列；刪掉尾端觀測屬於移除。
- 通訊錯誤依紀錄處理；欺詐或故障候選可能要保留。
- 保存原值、處置依據與規則，才能追查及重做。
