---
id: data-types-time-parsing
title: 資料型別與時間解析
kind: technique
codes: [L23301]
aliases: [Data Type, Datetime Parsing, Timestamp]
requires: [data-preparation]
summary: 依欄位意義轉換數值、類別與時間，並留下解析失敗的原因
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-4]
goals:
  - id: g1
    text: 將數值字串、類別與日期轉成適合的型別，算時間差並處理解析失敗
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售匯入的客戶碼為「001」、金額為「450.0」、等級為「A」。哪種型別策略較合理？
    options:
      A: 客戶碼轉整數1，金額保留字串，等級A改成連續數值再計算平均
      B: 客戶碼轉浮點1.0，金額保留字串，等級A依字母順序當成實際距離
      C: 客戶碼保留識別字串，金額轉為數值，等級依業務定義保留為類別
      D: 客戶碼與金額都轉整數，等級A保留字串，所有無法解析的值都補0
    answer: C
    explain:
      A: 客戶碼不需算術，金額卻需要；類別也不能任意視為連續量。
      B: 浮點客戶碼會失去原表示，名目類別的字母順序不代表量化距離。
      C: 型別依用途決定，識別碼保留前導零，金額才進入數值運算。
      D: 金額可能有小數，解析失敗補0又會把未知值偽裝成真實零值。
  - id: c2
    goal: g1
    type: choice
    prompt: 一筆時間是2026-01-01 08:00 +08:00，另一筆是同日00:30 UTC。統一UTC後，兩筆相差多久？
    options:
      A: 相差30分鐘，先後順序是08:00 +08:00在前、00:30 UTC在後
      B: 相差450分鐘，先後順序是00:30 UTC在前、08:00 +08:00在後
      C: 相差480分鐘，先後順序是08:00 +08:00在前、00:30 UTC在後
      D: 相差510分鐘，先後順序是00:30 UTC在前、08:00 +08:00在後
    answer: A
    explain:
      A: 08:00加八小時時區對應00:00 UTC，至00:30恰好經過30分鐘。
      B: 450分鐘來自直接比較鐘面數字，忽略兩者時區不同。
      C: 八小時是時區偏移，不是這兩筆事件之間的經過時間。
      D: 先後順序與間隔都應以同一時間基準計算，不能把偏移再加一次。
  - id: c3
    goal: g1
    type: choice
    prompt: 32筆時間中有一筆「2026-02-30」，轉成NaT後沒有報錯。接下來哪個做法合適？
    options:
      A: 將NaT改為1970-01-01，便可在排序後把它視為最早的一筆正常事件
      B: 將NaT改為當天日期，便可在統計後把它視為最近新增的一筆正常事件
      C: 保留NaT但刪掉原始字串，便可確定後續任何操作都能自動修回正確日期
      D: 標記該列與原始字串，查明失敗原因，再決定修正或排除哪種時間分析
    answer: D
    explain:
      A: 任意填入紀元起點會製造假的先後順序與時間間隔。
      B: 改成當天會捏造事件發生時間，並污染近期統計。
      C: NaT只是失敗標記，刪去來源會失去修正與追查依據。
      D: 先保留失敗證據，再按分析用途處理，才能避免靜默產生假時間。
---

## 為什麼需要

「450」可以是金額字串，「001」可以是顧客識別碼。兩者都由數字組成，卻不應同樣轉成可計算的量。

資料型別（Data Type）要反映欄位用途。時間若只當文字排序，也可能把不同時區的先後順序看反，讓時間差或時間序列模型出錯。

## 直覺

把轉換想成替欄位補上「能做哪些運算」的約定。溫度能算平均，類別能分組，時間能求間隔；識別碼只用來辨認對象。

時間解析（Datetime Parsing）把日期字串轉成可運算的時間。時間戳（Timestamp）表示某個時刻；「隔多久」則是時間差，兩者不可混用。

## 走一次流程

### 先保留原字串，再轉型

本組快照保存原值與單位。M01–M04沿用前置組的10、20、30、80°C；M04原始176°F先換單位，再進入數值特徵。

| 欄位／原值 | 分析型別 | 轉換後 | 檢查 |
|---|---|---|---|
| 識別碼`001` | 字串識別碼 | `001` | 前導零是否保留 |
| 金額` 450.0 ` | 數值 | 450.0元 | 空白、幣別與小數 |
| 類別`a` | 名目類別 | A | 依對照表統一 |
| 時間`…+08:00` | 含時區時間 | 統一基準的時刻 | 時區是否已知 |

指引強調數值與類別要標示正確，才能進行編碼或標準化。轉型成功也不等於資料合理：999可以成功轉為數值，但本快照的通訊紀錄已確認它是錯誤碼。

### 算時間戳與間隔

把`2026-01-01 08:00 +08:00`轉成UTC，是`2026-01-01 00:00 UTC`。另一筆是`00:30 UTC`，所以兩次事件相隔30分鐘，不能直接拿鐘面數字相減。

:::supplement[來源：pandas Time series / date functionality；pandas to_datetime]
以Unix秒表示，前一時刻是1767225600，後一時刻是1767227400，兩者差1800秒。時間戳的單位要寫清楚，秒與毫秒不可混用。

沒有時區的「08:00」需要先確認來源時區，再做轉換。`utc=True`會把沒有時區的輸入當UTC，不能拿它猜測原始資料屬於哪個地區。
:::

有了可運算的時間，就能取出月份、星期幾或計算距上次事件的間隔。例如2026-01-01是星期四、月份為1，可作為週期欄位的起點。

:::supplement[來源：pandas Time series / date functionality]
取星期與小時前，要先決定業務採用的時區，否則午夜附近可能被歸到另一日。pandas的`day_of_week`從星期一記為0，因此上述星期四為3。

月份直接用整數表示時，12月與1月相差11，實際卻相鄰。若模型需要表達這種週期鄰近，可用正弦／餘弦編碼。
:::

### 解析失敗怎麼辦（補充）

`2026-02-30`不是有效日期；應留下原值、列索引與錯誤原因。可暫記為缺失時間NaT，待來源確認；該列若仍有有效金額，可保留在不需要時間的分析中。

若系統約定逗號是千分位，「1,000」才能先移除逗號再轉型。若逗號可能是小數符號，應先確認地區規則；「轉得動」不能替代欄位規格。

## 程式

### 數值字串與失敗標記（補充）

前三個數字取自M01–M03；`bad`是共用解析小例刻意加入的壞字串。NumPy的`astype`適用於已確認能轉的資料；需要保留失敗列時，另用明確的解析策略。

```python
import numpy as np
import pandas as pd
raw = np.array(["10", "20", "30", "bad"])
print(raw[:3].astype(float).tolist())
values = pd.to_numeric(pd.Series(raw), errors="coerce")
print(values.tolist())
print(np.flatnonzero(values.isna()).tolist())
```
```text
[10.0, 20.0, 30.0]
[10.0, 20.0, 30.0, nan]
[3]
```

### 明示格式與時間基準（補充）

```python
import pandas as pd
raw = pd.Series([
    "2026-01-01T08:00:00+08:00",
    "2026-01-01T00:30:00Z",
    "2026-02-30T00:00:00Z",
])
t = pd.to_datetime(raw, format="ISO8601", utc=True, errors="coerce")
print(t.dt.strftime("%H:%M %z").fillna("解析失敗").tolist())
print(int(t.iloc[0].timestamp()))
print(int((t.iloc[1] - t.iloc[0]).total_seconds() / 60))
print(t[t.isna()].index.tolist())
print(int(t.dt.day_of_week.iloc[0]), int(t.dt.month.iloc[0]))
```
```text
['00:00 +0000', '00:30 +0000', '解析失敗']
1767225600
30
[2]
3 1
```

:::tip[讀碼重點]
`errors="coerce"`把失敗記成NaN或NaT，並沒有把資料修好。轉換後立即檢查失敗遮罩，原始字串也要保留。
:::

## 怎麼用、怎麼判讀

先定義型別、單位、可接受範圍與缺失表示，再轉換與驗證。類別變成數字編碼後仍可能是類別，不能因為儲存成整數就計算其平均距離。

### 換個場景

| 場景／資料條件 | 適合的操作 | 判讀重點 |
|---|---|---|
| 數值與類別混合的特徵表 | 標示型別後再編碼或縮放 | 儲存格式與語意分開看 |
| 時間序列建模 | 解析時刻、星期、月份與間隔 | 先定基準與單位 |
| 零售訂單（補充） | 金額轉數值，客戶碼保留字串 | 識別碼不可丟掉前導零 |
| 跨國物流（補充） | 含時區時間統一後算運送時間 | 避免直接相減當地鐘面 |
| 製造日誌（補充） | 解析失敗列與錯誤碼分開記錄 | NaT是失敗標記；999雖可轉數值，已確認為錯誤碼 |

## 常見誤解

- **都是數字就用同一型別。** 識別碼、類別碼與測量值的用途不同。
- **NaT表示事件沒有發生。** 它只表示缺失或無法解析，不能當作業務結論。
- **轉UTC就不必知道來源時區。** 無時區輸入仍需要來源規則。（補充）

## 進階

### 時區與曆法邊界（補充）

日光節約時間切換可能使當地鐘面時間重複或不存在。遇到無偏移資訊的歷史時間，應查來源地區與時間規則，不能一律假設每天都是相同的鐘面時段。

### 參考來源

- 科目3指引`guide-3:5-4`：數值與類別型別、時間戳、週期欄位及時間差。
- [pandas 時間序列教學](https://pandas.pydata.org/docs/user_guide/timeseries.html)：時間語意、時區與進階曆法邊界。
- [pandas day_of_week](https://pandas.pydata.org/docs/reference/api/pandas.Series.dt.day_of_week.html)：星期一為0的週期欄位慣例。
- [scikit-learn 週期特徵教學](https://scikit-learn.org/stable/auto_examples/applications/plot_cyclical_feature_engineering.html)：月份首尾相鄰的編碼思路。
- [pandas to_datetime](https://pandas.pydata.org/docs/reference/api/pandas.to_datetime.html)：ISO格式、UTC與失敗處理的程式。
- [pandas to_numeric](https://pandas.pydata.org/docs/reference/api/pandas.to_numeric.html)：數值解析與NaN標記。
- [NumPy astype](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.astype.html)：已知合法字串的型別轉換。
- [NumPy 入門教學](https://numpy.org/doc/stable/user/absolute_beginners.html)：陣列型別與最小讀碼例子的寫法。

## 小結

- 型別依欄位意義與運算用途決定，識別碼不當測量值。
- 時間戳表示時刻，時間差表示經過多久。
- 解析失敗要留下原值、索引與原因，再決定如何處理。
- 時區與時間單位明示後，才比較先後與間隔。（補充）
