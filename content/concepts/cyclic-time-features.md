---
id: cyclic-time-features
title: 日期拆解與週期編碼
kind: technique
codes: [L23301]
aliases: [Cyclic Encoding, Weekday, sin/cos]
requires: []
summary: 先拆解日期，再用成對sin與cos保留週期首尾相鄰的關係
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-9, guide-1:5-5]
goals:
  - id: g1
    text: 從日期拆出年月日、星期與時段，比較整數表示與圓周表示的首尾關係
  - id: g2
    text: 以星期一為0代入sin/cos公式，算出星期日到星期一的圓周座標與距離
formula_groups:
  - id: cyclic-pair
    source: https://scikit-learn.org/stable/auto_examples/applications/plot_cyclical_feature_engineering.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-G
  - id: cyclic-distance
    source: https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售模型把星期一至日編成0至6，並以數字差比較接近程度。星期日到下一個星期一只過1天，原表示有什麼問題？
    options:
      A: 整數差為0，模型會把兩天完全當作同一時間位置
      B: 整數差為1，模型已完整保留首尾相鄰的週期位置
      C: 整數差為7，模型會把兩天解讀成跨了七個星期
      D: 整數差為6，模型難以從數值距離看出首尾相鄰
    answer: D
    explain:
      A: 0與6不是相同數字，整數差不會是0。
      B: 原始數字0與6的差是6，尚未表示循環相鄰。
      C: 差值不是7，且一天的索引差也不代表七個星期。
      D: 直線整數把首尾放遠，圓周表示可保留它們相鄰的結構。
  - id: c2
    goal: g2
    type: choice
    prompt: 固定星期一d=0、星期日d=6，週期P=7，座標順序為(sin,cos)。下列哪組近似座標正確？
    options:
      A: 星期一(1,0)，星期日(0.6235,−0.7818)，由d除以6求角度
      B: 星期一(0,1)，星期日(0,1)，由d除以6讓首尾完全重合
      C: 星期一(0,1)，星期日(−0.7818,0.6235)，由d除以7求角度
      D: 星期一(0,0)，星期日(−0.7818,−0.7818)，由單一sin複製兩欄
    answer: C
    explain:
      A: 本頁順序是sin在前、cos在後，且週期為7而不是最大索引6。
      B: 除以6會把兩個不同星期位置重合，破壞七天的表示。
      C: 代入0與12π/7，分別得到列出的成對座標。
      D: cos(0)為1，複製sin也會失去完整角度資訊。
  - id: c3
    goal: g2
    type: choice
    prompt: 週期7的成對座標中，星期日到星期一的弦長約0.8678，星期一到星期二也約0.8678。哪個判讀合理？
    options:
      A: 兩組弦長相同，所以兩組日期也必須具有相同的銷售量
      B: 兩組均是相鄰一天，編碼保留相同的週期位置接近程度
      C: 兩組弦長都小於1，所以這兩個特徵已經完成標準化處理
      D: 兩組都是相鄰一天，所以只留sin一欄仍能保證全部位置唯一
    answer: B
    explain:
      A: 位置接近不保證需求相同，目標值仍受其他因素影響。
      B: 相鄰位置具有相同弦長，首尾也遵守相同的圓周幾何關係。
      C: 週期轉換不是依訓練資料估計均值與標準差的標準化。
      D: 單一sin通常會把不同角度混在一起，無法一般性保證位置唯一。
---

## 為什麼需要

銷售高峰可能在假日或下班時段。把完整時間戳拆成年、月、日、星期與時段，模型才有機會學到不同時間位置的模式。

星期一到星期日又回到星期一。若只編成0到6，數字差會把星期日與星期一放得很遠；週期編碼（Cyclic Encoding）用圓周保留這個首尾相鄰關係。

## 直覺

先想一週七個位置繞成一圈，而不是排成一條線。星期日和星期一是圓周上相鄰的位置，與星期一和星期二同樣相隔一天。

![直線上0與6相距很遠；圓周上星期日與星期一仍是相鄰位置。](figure:l23301-cyclic-time-features-week-circle)

日期拆解與週期轉換是兩步：先問要取哪個日曆成分，再問它是否會循環。

:::supplement[來源：scikit-learn時間特徵教學]
年通常描述長期變化，不應因為其他欄位繞圈，就把年份也任意繞回起點。
:::

## 定義與公式

### 日期拆解與索引約定

本組採台北時間，星期一為0，依序到星期日為6。週末指星期六與星期日，工作日暫指週一到週五；正式任務應依需要加入國定假日及調班資訊。

| 原始日期時間 | 年／月／日 | 星期索引 | 時段／週末 |
|---|---|---:|---|
| 2026-10-10 18:00 | 2026／10／10 | 5 | 下午／是 |
| 2026-10-11 18:00 | 2026／10／11 | 6 | 下午／是 |
| 2026-10-12 18:00 | 2026／10／12 | 0 | 下午／否 |

:::supplement[來源：本組資料契約]
本例以12:00為分界，將12:00至23:59記為「下午」，因此18:00也歸入此旗標。這是二元時段的教學簡化，不是通用時段定義。
:::

### 成對週期座標

指引提出sin/cos轉換，用來保留週期位置的相鄰關係。

:::supplement[來源：scikit-learn時間特徵教學]
指引沒有展開算式。本頁固定橫軸為sin、縱軸為cos，採以下定義：

$$
\theta=\frac{2\pi d}{P},\qquad
(s,c)=(\sin\theta,\cos\theta)
$$

$d$是從0開始的週期位置，$P$是完整週期長度，$\theta$是弧度，$s,c$是輸出的兩欄。星期用$P=7$，不是最大索引6；小時通常用24，月份先轉成0到11再用12。

同一索引約定必須從訓練沿用到推論。sin與cos要成對保留；只留sin，某些不同角度會得到相同值，不能一般性地代表完整週期位置。
:::

### 比較兩個位置（補充）

兩點的圓周弦長可用平面距離計算：

$$
D=\sqrt{(s_1-s_2)^2+(c_1-c_2)^2}
$$

$s_1,c_1$與$s_2,c_2$是兩個位置的成對座標，$D$是無單位的直線弦長，不是經過幾天。它用來檢查編碼是否把相鄰位置放得接近。

## 算一次

### 星期日接回星期一（補充）

共用資料10月11日是星期日，$d=6$；10月12日是星期一，$d=0$。代入$P=7$，得到下表，先保留完整精度再四捨五入。

| 星期 | 角度 | sin | cos |
|---|---|---:|---:|
| 一，d=0 | 0 | 0.0000 | 1.0000 |
| 二，d=1 | 2π/7 | 0.7818 | 0.6235 |
| 日，d=6 | 12π/7 | −0.7818 | 0.6235 |

星期日到星期一的整數差為6，弦長則是：

$$
D=\sqrt{(-0.781831-0)^2+(0.623490-1)^2}\approx0.8678
$$

星期一到星期二也得到0.8678。兩組相鄰一天的圓周距離一致；能源資料使用相同日期與索引，結果完全相同，不因用電單位而改變。

## 程式

### 先處理時區，再拆解與編碼（補充）

`calendar_fixture`來自本組JSON的週六、週日與週一。下段同時計算兩組相鄰日的距離，核對首尾是否接起來。

在專案根目錄可直接執行；若用隔離目錄，先將環境變數`IPAS_REPO_ROOT`設為專案根路徑。

```python
import json, os
from pathlib import Path
import numpy as np
import pandas as pd
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
dates = pd.to_datetime(data["calendar_fixture"], utc=True).tz_convert("Asia/Taipei")
d = dates.day_of_week.to_numpy()
xy = np.column_stack([np.sin(2 * np.pi * d / 7), np.cos(2 * np.pi * d / 7)])
print("星期/週末:", d.tolist(), (d >= 5).tolist())
print("週日座標:", [round(float(x), 4) for x in xy[1]])
print("日到一弦長:", round(float(np.linalg.norm(xy[1] - xy[2])), 4))
next_day = np.array([np.sin(2 * np.pi / 7), np.cos(2 * np.pi / 7)])
print("一到二弦長:", round(float(np.linalg.norm(xy[2] - next_day)), 4))
```
```text
星期/週末: [5, 6, 0] [True, True, False]
週日座標: [-0.7818, 0.6235]
日到一弦長: 0.8678
一到二弦長: 0.8678
```

:::tip[讀碼重點]
`day_of_week`採星期一0到星期日6。先轉到業務時區再取星期，避免跨午夜時取到UTC的另一個日期；`column_stack`保留兩欄。
:::

## 怎麼用、怎麼判讀

週期編碼適合星期、月份與每日時段等會重複的欄位。它保留位置接近程度，讓模型更容易利用循環結構，但不表示每個相鄰日的銷售量一定接近。

### 與其他表示比較（補充）

| 表示 | 優點 | 限制 |
|---|---|---|
| 0到6整數 | 一欄，容易理解 | 線性距離無法接回首尾 |
| 7欄獨熱 | 各星期可有獨立效果 | 不直接表達誰與誰相鄰 |
| 2欄sin/cos | 首尾連續且欄數固定 | 單一週期波形可能不足以表達尖銳高峰 |

比較效果要固定資料分割。線性模型只接一對sin/cos時，能表示的週期形狀有限；多個高峰可比較其他表示，不必假設三角函數一定最好。

### 換個場景

| 場景／資料條件 | 要拆的成分 | 判讀重點 |
|---|---|---|
| 假日或下班銷售高峰 | 星期、時段、假日 | 週期位置與假日標記不同 |
| 星期或月份循環 | 星期0–6、月份0–11 | 保留首尾的相鄰關係 |
| 能源需求（補充） | 時段與星期 | 上下班與週末負載可能不同 |
| 交通旅次（補充） | 每日小時 | 平滑週期未必足以描述尖峰 |

## 常見誤解

- **星期的週期是6。** 最大索引6不等於七天週期長度。（補充）
- **所有日期欄都該繞成圓。** 年份與累積經過時間通常另有趨勢意義。（補充）
- **只取sin就夠。** 單欄通常會混淆不同位置，應保留成對座標。（補充）
- **圓周接近代表需求相同。** 編碼提供時間結構，需求仍需由資料學習。（補充）

## 進階

### 日曆週期與實際經過時間（補充）

月份天數不一，用12個等距位置表示月份，表達的是月份索引循環，不是每段相隔相同小時。若任務關心實際經過多久，應另算時間差；有夏令時間的地區還要區分日曆時段與實際時長。

### 參考來源

- 科目3指引5.1，`guide-3:5-9`：年月日、星期、時段、假日／下班銷售與sin/cos保留相鄰；原頁無明列公式。
- 科目1指引5.1，`guide-1:5-5`：上午／下午、工作日／週末的欄位拆解。
- [scikit-learn時間特徵教學](https://scikit-learn.org/stable/auto_examples/applications/plot_cyclical_feature_engineering.html)：週期公式、成對座標及表示比較。
- [NVIDIA時間編碼教學](https://developer.nvidia.com/blog/three-approaches-to-encoding-time-information-as-features-for-ml-models/)：以週期幾何檢查接縫的教學思路；弦長為本頁對兩點套用平面距離的推算。
- [NumPy norm](https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html)：兩點差向量的歐氏距離與程式核對。
- [pandas Time series](https://pandas.pydata.org/docs/user_guide/timeseries.html)：日曆成分、時區與程式。
- [pandas day_of_week](https://pandas.pydata.org/docs/reference/api/pandas.DatetimeIndex.day_of_week.html)：程式的星期索引，取代已棄用的dayofweek。

## 小結

- 先拆日期成分，再選是否要保留循環結構。
- 星期日接回星期一，不能只靠原始整數距離表示。
- 固定索引、週期與時區，成對保留sin/cos。（補充）
