---
id: root-mean-squared-error
title: 均方根誤差
aliases:
  - RMSE
  - Root Mean Squared Error
kind: metric
codes:
  - L23303
requires:
  - mean-squared-error
guide_refs:
  - guide-3:5-23
  - guide-3:4-13
gaps:
  - ref: guide-3:5-23
    level: missing
    ability: 指引只寫 RMSE 是 MSE 的平方根與適用情境；考題把整體 RMSE 放在線上監控情境，要判斷它會掩蓋占比小的子群誤差
author: codex
status: draft
summary: 均方根誤差將 MSE 開根號，回到原單位並保留對大誤差的敏感性
goals:
  - id: g1
    text: 依平方、平均、開根號的順序算出 RMSE
  - id: g2
    text: 比較 RMSE、MSE 與 MAE 的單位、排序及大小關係
  - id: g3
    text: 依領域成本與分群結果解讀 RMSE，按樣本數合併平方誤差，辨認整體平均的限制
formula_groups:
  - id: rmse
    source: guide-3:5-23
    status: verified
    checked_by: task_438e98e2097f
  - id: rmse-mae
    source: https://scikit-learn.org/stable/modules/model_evaluation.html
    status: pending
    checked_by: null
  - id: group-rmse
    source: https://scikit-learn.org/stable/modules/model_evaluation.html#mean-squared-error
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 八筆出貨預測平方誤差和為 407 箱平方，正確的 RMSE 計算是什麼？
    options:
      A: "√(407/8)，約 7.133 箱，先平均再開根號"
      B: "407/8，等於 50.875 箱平方，平方誤差平均後即得 RMSE"
      C: "√407/8，約 2.522 箱，先開根號再平均"
      D: "√(407/7)，約 7.625 箱，以樣本數減一作為平均分母"
    answer: A
    explain:
      A: "正確。平方誤差和先除以八筆平均，再開平方根，√(407/8) 約為 7.133 箱。"
      B: "平方誤差平均為 50.875 箱平方，這是 MSE；還須開根號才是 RMSE。"
      C: "根號只包平方和而未包平均，先開根號再除以八筆不符合 RMSE 定義。"
      D: "RMSE 的平均分母是八筆樣本，不是樣本數減一；這裡不採樣本變異數的不偏校正。"
  - id: c2
    goal: g2
    type: choice
    prompt: 同一批單一目標、相同樣本權重的預測，關於 RMSE 哪句正確？
    options:
      A: RMSE 與 MSE 的模型排序一定相反
      B: RMSE 必定大於 MAE，沒有相等的情況
      C: RMSE 不小於 MAE，且與 MSE 的模型排序相同
      D: RMSE 與 MAE 都用原單位，所以對大誤差反應相同
    answer: C
    explain:
      A: 對非負的 MSE 開根號是遞增運算，不會反轉排序。
      B: 每筆絕對誤差相同時，RMSE 與 MAE 相等。
      C: 固定資料與權重後有均方根不小於算術平均的關係，開根號也保留 MSE 排序。
      D: 同單位不代表同計價方式，RMSE 仍先平方放大大誤差。
  - id: c3
    goal: g3
    type: choice
    prompt: 電力模型整體 RMSE 連續兩期相同，尖峰時段只占 5%。想確認尖峰是否惡化，下一步最適合做什麼？
    options:
      A: 只改報 MAE，保證找出尖峰問題
      B: 分開計算尖峰與離峰指標，連同樣本數及殘差方向檢查
      C: 直接認定尖峰表現也沒有改變
      D: 把所有殘差先加總再平方，避免群組差異
    answer: B
    explain:
      A: 換另一個整體平均仍會彙總各群，不能保證找出尖峰惡化。
      B: 分群能看出改善與惡化是否在整體數字中互相掩蓋。
      C: 整體固定不代表每個群組固定，其他群組可能同時改善。
      D: 先加總會讓正負誤差抵銷，既不是 RMSE，也無助定位群組。
  - id: c4
    goal: g3
    type: choice
    prompt: 同十戶估價中，一般住宅九戶 RMSE＝2 萬元，高價住宅一戶 RMSE＝30 萬元。整體 RMSE 與正確解讀是哪一個？
    options:
      A: √((9×2²＋1×30²)/10)≈9.675 萬元；仍須另查高價群
      B: (2＋30)/2＝16 萬元；兩群等權即可代表所有十戶
      C: (9×2＋30)/10＝4.8 萬元；按樣本數平均各群 RMSE 就能代表整體
      D: √((2²＋30²)/10)≈9.508 萬元；各群平方只需計一次
    answer: A
    explain:
      A: 各群 RMSE 平方乘樣本數可還原平方誤差和，總和936除以十後再開根號。
      B: 這是群組指標的等權平均，沒有還原每戶平方誤差，並非整體 RMSE。
      C: 平均各群 RMSE 即使按人數加權也不等於先平均平方誤差再開根號。
      D: 一般群有九筆，少乘九會漏算八戶的平方誤差。
textbook: v2
---

## 為什麼需要

均方根誤差（RMSE，英文全名為 Root Mean Squared Error）在 MSE 外開平方根，把結果帶回目標變數的原單位，較容易溝通。

它保留平方懲罰的效果，適合用於模型精度報告與模型比較。若要用「箱、萬元、MW」說明整體失準程度，RMSE 比 MSE 直覺。

## 直覺

計算順序是「平方 → 平均 → 開根號」。大誤差先被平方放大，最後開根號不會把這個影響撤銷。

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
出貨預測前七筆各差 1 箱，最後一筆少估 20 箱。八筆的 MAE＝3.375 箱，RMSE 約 7.133 箱，兩者有明顯差距。

這表示誤差大小不均勻，值得找出大誤差來看。不能把 RMSE 解讀成每天固定差 7.133 箱。
:::

## 定義與公式

先算平方誤差的平均，再取平方根：

$$
\mathrm{RMSE}=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat y_i)^2}
=\sqrt{\mathrm{MSE}}
$$

- $n$ 是樣本筆數，須大於 0；$i$ 是樣本索引。
- $y_i$ 是實際值，$\hat y_i$ 是同一筆預測值。
- $y_i-\hat y_i$ 是殘差，正值代表低估；根號涵蓋整個平均平方誤差。

:::supplement[來源：scikit-learn root_mean_squared_error API；本站 L23303 網店出貨量教學模擬資料]
本頁採單一目標、各筆等權重。實際值與預測值須配對且單位一致，數字須有限；缺值要先處理。

出貨資料的平方誤差和是 407、筆數是 8，得到 $\mathrm{RMSE}=\sqrt{407/8}=\sqrt{50.875}\approx7.133$ 箱。完全預測正確時為 0。
:::

### 與 MAE 的大小關係（補充）

對同一批樣本、同一權重與同一目標尺度：

$$
\mathrm{RMSE}\ge\mathrm{MAE}
$$

兩個符號分別代表均方根誤差與平均絕對誤差。只有每筆絕對誤差都相同時，兩者才相等。

本關係由定義自行推導：把各筆絕對誤差視為一組數，其平方平均減去平均的平方非負，因此得到上述不等式；差值為零恰對應所有絕對誤差相同。

scikit-learn 的 MAE／MSE 段提供指標定義與 RMSE 開根號關係，未直接列出這個不等式及等號條件。

本例 $7.133\ge3.375$；若只看前七筆，每筆絕對誤差都是 1 箱，兩者就都等於 1 箱。不同資料、不同權重或不同尺度的數字不能套用這個比較。

## 算一次

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
從 `content/examples/L23303-regression.json` 取得八筆預測，先核對每一筆：

| 樣本 | 實際／預測（箱） | 殘差（箱） | 平方誤差（箱平方） |
|---|---|---|---|
| 1、2 | 10／11；20／19 | −1；+1 | 1；1 |
| 3、4 | 30／31；40／39 | −1；+1 | 1；1 |
| 5、6 | 50／51；60／59 | −1；+1 | 1；1 |
| 7 | 70／71 | −1 | 1 |
| 8 | 100／80 | +20 | 400 |

1. 平方加總：$1+1+1+1+1+1+1+400=407$ 箱平方。
2. 平均：$407/8=50.875$ 箱平方，這是 MSE。
3. 開根號：$\sqrt{50.875}\approx7.133$ 箱，這才是 RMSE。

若先對每筆平方開根號，再平均，就得到 $(1+1+1+1+1+1+1+20)/8=3.375$ 箱，也就是 MAE。兩種運算順序不能互換。
:::

## 程式

:::supplement[來源：scikit-learn root_mean_squared_error API]
對照套件、手算，以及容易寫錯的運算順序：

```python
import numpy as np
from sklearn.metrics import root_mean_squared_error
y_true = np.array([10, 20, 30, 40, 50, 60, 70, 100])
y_pred = np.array([11, 19, 31, 39, 51, 59, 71, 80])
residual = y_true - y_pred
print(f"先平均再開根號: {np.sqrt(np.mean(residual ** 2)):.3f}")
print(f"套件 RMSE: {root_mean_squared_error(y_true, y_pred):.3f}")
print(f"先開根號再平均: {np.mean(np.sqrt(residual ** 2)):.3f}")
```
```text
先平均再開根號: 7.133
套件 RMSE: 7.133
先開根號再平均: 3.375
```
:::

:::tip[讀碼重點]
看 `np.sqrt(np.mean(...))` 的括號：根號必須在平均外面。第三行輸出刻意示範另一個順序，算到的是 MAE。
:::

## 怎麼用、怎麼判讀

報告 RMSE 時要附單位，例如「7.133 箱」，並說明評估資料。較小的 RMSE 表示這批資料的平方誤差較小，但不能直接代表業務成本最低。

### 換個場景

| 場景 | 判讀重點 |
|---|---|
| 模型精度報告與比較 | 指引列出的用途：以原單位呈現整體失準程度 |
| 電力負載（補充） | 用 MW 報告，大幅失準較受重視時搭配尖峰分群 |
| 房價估算（補充） | 用萬元報告，另查高價物件是否主導結果 |
| 道路旅行時間（補充） | 用分鐘報告，與 MAE 合看，區分普遍偏差與少數大延誤 |

### 電力負載：MAE 與 RMSE 怎麼選（補充）

沿用 `L23303-B-electricity.json` 的四個時段，實際負載為 100、102、98、100 MW。

| 模型 | 殘差（MW） | MAE（MW） | RMSE（MW） |
|---|---|---|---|
| 甲 | 0、0、0、8 | 8/4＝2 | √(64/4)＝4 |
| 乙 | 3、3、3、3 | 12/4＝3 | √(36/4)＝3 |

MAE 偏好甲，RMSE 偏好乙。若大幅少估會造成昂貴的緊急備援，RMSE 能讓這種錯誤更影響比較；若成本隨差距線性增加，則優先看 MAE。

### 排序與分群限制（補充）

在同一批單一目標資料上，開根號是遞增運算，所以 MSE 與 RMSE 的模型排序相同。MAE 的計算方式不同，可能得到相反排序。

整體 RMSE 仍是彙總數字。高風險群組變差、其他群組變好時，整體結果可能不變；應同時依金額、時段或設備分群，並保留各群樣本數。

### 房屋估價：整體變好卻掩蓋小群惡化（補充）

`L23303-M4-D-group-rmse.json` 合成十戶：一般住宅九戶各1000萬元，高價住宅一戶5000萬元。同十戶兩組固定預測，未訓練或切分，seed=null。

全例的實際值、預測與殘差都用**萬元**，不混入百分比或標準化數值。一般住宅前後的殘差大小分別為10與2萬元；高價住宅則由低估20變成低估30萬元。

| 群組與樣本數 | 改前平方誤差和（萬元平方） | 改後平方誤差和（萬元平方） | RMSE 改前→改後（萬元） |
|---|---|---|---|
| 一般住宅，9戶 | 9×10²＝900 | 9×2²＝36 | 10 → 2 |
| 高價住宅，1戶 | 1×20²＝400 | 1×30²＝900 | 20 → 30 |
| 整體，10戶 | 1300 | 936 | √130≈11.402 → √93.6≈9.675 |

整體下降約1.727萬元，不能宣稱高價住宅也變準。九戶改善減少的平方誤差是864，一戶惡化增加500，合併後仍淨減364萬元平方；小群只有10%的權重。

令 $g$ 為互不重疊且合起來涵蓋全部樣本的群組，$n_g$ 是各群筆數，$N=\sum_g n_g$ 是總筆數。每筆等權重且單位相同時，由 RMSE 定義將平方誤差分群加總可得：

$$
\mathrm{RMSE}_{\mathrm{all}}=
\sqrt{\frac{\sum_g n_g\,\mathrm{RMSE}_g^2}{N}}
$$

這由平方誤差定義自行分組推導，scikit-learn 的 MSE 段未直接列出此群組合併完整式。各群 RMSE 平方乘 $n_g$ 還原該群平方誤差和，完整分群才能加成總和。

改後代入 $\sqrt{(9\times2^2+1\times30^2)/10}=\sqrt{93.6}$。若有樣本權重，改用各群權重總和。

**不能直接平均群組 RMSE**：$(2+30)/2=16$，連按人數平均 $(9\times2+30)/10=4.8$ 也不是9.675。先還原各群平方誤差和，再除總筆數、開根號。

高價群只有一戶，這裡能定位該戶惡化，卻不足以估計整個高價市場的長期誤差。監控須同報群組定義、筆數與觀察期間；群組占比不同時，整體數字還會受組成改變影響。

```python
import json, os
from pathlib import Path
data = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) /
    "content/examples/L23303-M4-D-group-rmse.json").read_text(encoding="utf-8"))
for stage in ["before", "after"]:
    for group in ["一般住宅", "高價住宅", "整體"]:
        rows = [r for r in data["samples"] if group == "整體" or r["group"] == group]
        sse = sum((r["y_true"] - r["pred_" + stage]) ** 2 for r in rows)
        print(stage, group, "n=", len(rows), "SSE=", sse,
              "RMSE=", round((sse / len(rows)) ** 0.5, 3))
```
```text
before 一般住宅 n= 9 SSE= 900 RMSE= 10.0
before 高價住宅 n= 1 SSE= 400 RMSE= 20.0
before 整體 n= 10 SSE= 1300 RMSE= 11.402
after 一般住宅 n= 9 SSE= 36 RMSE= 2.0
after 高價住宅 n= 1 SSE= 900 RMSE= 30.0
after 整體 n= 10 SSE= 936 RMSE= 9.675
```

程式的 SSE 是平方誤差和，單位為萬元平方；輸出的 RMSE 單位是萬元。它重算固定資料的兩組預測，不代表實際部署後的改善。

## 常見誤解

- **「開根號後就不重視大誤差了。」** 平方階段的放大仍在，RMSE 對大誤差仍敏感。
- **「RMSE＝7 表示平均絕對差距是 7。」** 平均絕對差距要算 MAE，兩者不能互換。
- **「RMSE 一定比任何 MAE 大。」** 大小關係只對同一資料、同一權重與同一尺度成立。（補充）
- **「整體 RMSE 沒變，所有群組都穩定。」** 群組改善與惡化可能相抵，需分開監控。（補充）

## 進階

### 跨摺平均與合併預測（補充）

交叉驗證可以平均各摺 RMSE，也可以把全部留出預測合併後算一次 RMSE。因開根號是非線性運算，即使各摺大小相同，這兩個數字也不一定相等。

比較模型時要固定彙整方法，報告清楚是「各摺平均」還是「合併預測」。若各摺筆數不同，還要留意每筆樣本實際受到的權重。

### 參考來源

- 學習指引科目 3，5.3、5-23（支持：定義與公式、原單位、精度報告場景）。
- [scikit-learn：root_mean_squared_error](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.root_mean_squared_error.html)（支持：程式、樣本權重與聚合方式）。
- [scikit-learn：Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html#mean-squared-error)（支持：MAE／MSE 定義與 RMSE 開根號關係；大小不等式及群組合併由本頁推導，非來源直接列式）。
- [Hyndman、Athanasopoulos：Forecasting: Principles and Practice，第 5 章](https://otexts.com/fpp3/toolbox.html#scale-dependent-errors)（支持：原單位誤差、指標選擇）。

## 小結

- RMSE 先平方、再平均、最後開根號，單位回到目標本身。
- 共用出貨資料 RMSE 約 7.133 箱，MSE＝50.875 箱平方。
- 同資料同權重下，RMSE 不小於 MAE，與 MSE 的模型排序相同。
- 平均指標仍可能掩蓋重要子群，需搭配殘差分析與分群評估。
