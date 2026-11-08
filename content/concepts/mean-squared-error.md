---
id: mean-squared-error
title: 均方誤差
aliases:
  - MSE
  - Mean Squared Error
kind: metric
codes:
  - L23303
  - L23103
contrasts:
  - target: root-mean-squared-error
    note: RMSE 是 MSE 開根號，單位回到目標變數本身；MSE 的單位是平方，不能直接拿來說「平均差多少」
    source:
      - guide-3:5-23
      - 114-2-S3-Q38
guide_refs:
  - guide-3:5-22
  - guide-3:5-23
  - guide-3:3-22
  - guide-3:3-23
gaps:
  - ref: guide-3:5-22
    level: shallow
    ability: 指引只給 MSE 公式與文字說明；考題要從一行程式碼（差值平方、加總、除以筆數）辨認出它是 MSE，不是 MAE 或 RMSE
author: codex
status: draft
summary: 均方誤差把每筆預測的差距平方後平均，讓大誤差更影響評分
goals:
  - id: g1
    text: 逐筆算出 MSE，說明樣本數、平方加總與平均，並與同批殘差的 MAE 對照
  - id: g2
    text: 判讀平方單位、離群值影響與模型比較條件
  - id: g3
    text: 分清 MSE 的評估與訓練角色，理解大誤差的梯度影響，對照 MAE 導數與零點次梯度
formula_groups:
  - id: mse
    source: guide-3:5-22
    status: verified
    checked_by: task_438e98e2097f
  - id: mse-gradient
    source: https://d2l.ai/chapter_linear-regression/linear-regression.html
    status: pending
    checked_by: null
  - id: mse-mae-gradient-comparison
    source: https://web.stanford.edu/class/ee364b/lectures/subgradients_notes.pdf
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某網店八筆出貨預測的殘差為 −1、1、−1、1、−1、1、−1、20 箱，MSE 是多少？
    options:
      A: 3.375 箱
      B: 50.875 箱平方
      C: 407 箱平方
      D: 7.133 箱
    answer: B
    explain:
      A: 3.375 是絕對誤差和 27 除以 8，算的是 MAE。
      B: 平方和為 7＋400＝407，再除以八筆得到 50.875 箱平方。
      C: 407 是平方誤差和，尚未除以八筆。
      D: 7.133 是平方平均再開根號，算的是 RMSE。
  - id: c2
    goal: g2
    type: choice
    prompt: 工廠將同一批預測的目標單位由毫米改成公分，實際值與預測值都除以 10，MSE 會如何改變？
    options:
      A: 不變，因為樣本數不變
      B: 變成原來的十分之一
      C: 變成原來的十倍
      D: 變成原來的百分之一
    answer: D
    explain:
      A: 每筆差距已縮小，固定樣本數不會抵銷單位變化。
      B: 差距雖縮成十分之一，MSE 還要平方。
      C: 單位換算讓數值縮小，平方誤差不會放大十倍。
      D: 每筆差距除以 10 後，平方誤差就除以 100，這不是模型變準。
  - id: c3
    goal: g3
    type: choice
    prompt: 八筆等權重資料的 MSE 中，第八筆實際值 100、預測值 80。若直接更新這個預測值，導數及更新方向為何？
    options:
      A: −5，梯度下降會推動這個預測值增加
      B: +5，因為殘差是 +20
      C: −20，直接等於殘差取負
      D: −0.25，把導數大小視為每筆固定
    answer: A
    explain:
      A: 導數是 2×(80−100)/8＝−5，更新式為「預測值 − 學習率 × 梯度」；學習率為正、梯度為負，所以預測值增加。
      B: MSE 對預測值的導數使用預測減實際，符號與殘差相反。
      C: 導數還包含係數 2 與筆數 8，不能只取負殘差。
      D: −0.25 是把第一筆 MSE 導數 +0.25 反號，不能代表第八筆的導數；MSE 的導數大小會隨誤差改變。
  - id: c4
    goal: g3
    type: choice
    prompt: 八筆等權重的平均損失，殘差定義為實際減預測。某筆殘差由 +1 變成 +20，並另查零殘差的邊界，哪個判讀正確？
    options:
      A: MSE 導數皆固定為 −0.125；MAE 零點次梯度可直接取未縮放的區間 [−1,1]
      B: MSE 導數由 −0.25 變 −5；MAE 零點導數就是 0
      C: MSE 導數由 −0.25 變 −5；MAE 零點次梯度在 [−0.125,0.125]
      D: MSE 導數由 +0.25 變 +5；MAE 零點次梯度只能取正端點 +0.125
    answer: C
    explain:
      A: 固定大小的是非零處 MAE 導數；平均損失的次梯度區間也須除以八。
      B: 零點左右斜率不同，MAE 的一般導數不存在；0 只是合法次梯度之一。
      C: MSE 對預測值導數為負二倍殘差除以八；MAE 零點保留整個縮放區間。
      D: 實際減預測為正時，對預測值的導數為負；零點合法次梯度也不限於正端點。
textbook: v2
---

## 為什麼需要

預測出貨量時，差 1 箱與差 20 箱都算「沒猜中」。兩者造成的損失卻可能差很多。

先把每筆差距平方，也就是把差距乘以自己。再算這些結果的平均。這就是均方誤差（Mean Squared Error，MSE）。大誤差會更影響這個分數。

若任務特別不能接受嚴重偏差，MSE 能凸顯這類錯誤。MSE 越小，這批資料的平方誤差就越少。

## 直覺

誤差先平方，正負號就不會抵消。差距變成 2 倍，平方誤差會變成 4 倍。因此，少數幾筆大誤差就可能讓分數大幅增加。

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
八天的出貨量預測中，前七天各差 1 箱。最後一天因團購而少估 20 箱。前七天的平方誤差合計只有 7 箱平方。最後一天卻有 400 箱平方。

這批資料的 MSE 主要因團購日少估而變大。不能據此認為每天都差很多。
:::

## 定義與公式

對同一批連續目標與預測值，先逐筆相減、平方，再取平均：

$$
\mathrm{MSE}=\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat y_i)^2
$$

- $n$：樣本筆數，必須大於 0；$i$：第幾筆樣本。
- $y_i$：第 $i$ 筆實際值；$\hat y_i$：同一筆的預測值。
- $y_i-\hat y_i$：殘差，正號代表模型低估，負號代表高估。

:::supplement[來源：scikit-learn mean_squared_error API；本站 L23303 網店出貨量教學模擬資料]
本頁採單一目標、每筆等權重的版本。實際值與預測值須逐筆配對、使用相同單位，且均為有限數字；缺值須先處理。

代入八筆資料，$n=8$，殘差為 $-1,1,-1,1,-1,1,-1,20$，所以 MSE 為 $407/8=50.875$ 箱平方。分母是樣本數 8，不是估計誤差變異數時可能使用的自由度。

MSE 非負，只有每筆預測都正確時才等於 0。目標以「箱」計，MSE 就以「箱平方」計；不能說平均每筆差 50.875 箱。
:::

## 算一次

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
資料取自 `content/examples/L23303-regression.json`。八列是不同營業日，廣告費欄位不是時間索引；本例直接評估既有預測，不重新訓練。

| 樣本 | 實際／預測（箱） | 殘差（箱） | 平方誤差（箱平方） |
|---|---|---|---|
| 1、2 | 10／11；20／19 | −1；+1 | 1；1 |
| 3、4 | 30／31；40／39 | −1；+1 | 1；1 |
| 5、6 | 50／51；60／59 | −1；+1 | 1；1 |
| 7 | 70／71 | −1 | 1 |
| 8 | 100／80 | +20 | 400 |

1. 平方後加總：$1+1+1+1+1+1+1+400=407$。
2. 除以八筆：$407/8=50.875$ 箱平方。
3. 最後一筆占平方誤差 $400/407\approx98.28\%$，值得優先查原因。

同一批資料的平均絕對誤差是 $27/8=3.375$ 箱，均方根誤差約 7.133 箱。它們的單位不同，不能因 MSE 數字較大就說它比較差。

最後一筆占絕對誤差 $20/27\approx74.07\%$，相較於平方誤差的約98.28%較低，但仍超過七成。
:::

## 程式

:::supplement[來源：scikit-learn mean_squared_error API]
用與上表相同的八筆資料，對照手算與套件結果：

```python
import numpy as np
from sklearn.metrics import mean_squared_error
y_true = np.array([10, 20, 30, 40, 50, 60, 70, 100])
y_pred = np.array([11, 19, 31, 39, 51, 59, 71, 80])
residual = y_true - y_pred
manual = np.mean(residual ** 2)
print("殘差:", residual.tolist())
print(f"平方和: {np.sum(residual ** 2)}")
print(f"手算 MSE: {manual:.3f}")
print(f"套件 MSE: {mean_squared_error(y_true, y_pred):.3f}")
```
```text
殘差: [-1, 1, -1, 1, -1, 1, -1, 20]
平方和: 407
手算 MSE: 50.875
套件 MSE: 50.875
```
:::

:::tip[讀碼重點]
`residual ** 2` 是逐筆平方，`np.mean` 才負責加總與除以筆數。若把平方改成絕對值，算出的就是 MAE。
:::

## 怎麼用、怎麼判讀

需要放大嚴重偏差時，MSE 是合適的選項；若想以目標原單位報告結果，可同時提供 RMSE。少量離群值不該主導評價時，則搭配 MAE。

指引3-23的「分類使用迴歸損失無效」不是絕對規則。機率與0/1標籤的平方誤差可作布萊爾分數（Brier score）；須按輸出與決策目的選損失，不能由名稱判定不收斂。

### 換個場景

| 場景 | 為何採用或搭配 MSE |
|---|---|
| 金融風險預測 | 指引列出的用途：讓嚴重偏離實際損失的預測更影響評分 |
| 製程品質監控 | 指引列出的用途：特別關注大幅偏離品質目標的預測 |
| 電力負載（補充） | 若大偏差會增加備轉成本，搭配 RMSE 檢查嚴重失準 |
| 房價估算（補充） | 豪宅離群值可能主導平方誤差，須與 MAE、價格分群一起看 |

### 比較前先固定評估條件（補充）

要比較模型，須固定評估樣本、目標單位與權重。把出貨量改成十箱為一單位，MSE 數字會縮成原來的百分之一，模型並沒有進步。

訓練時用 MSE 當損失函數，評估時也能用同一公式。前者指引模型更新，後者應在未參與擬合的資料上衡量泛化，兩者的資料角色不同。

### 同一殘差下的兩種導數（補充）

沿用殘差 $e_i=y_i-\hat y_i$，因此對預測值微分時，方向與殘差相反。以下皆為八筆等權重的**平均**損失，不是單筆損失或損失總和。

$$
\frac{\partial\mathrm{MSE}}{\partial\hat y_i}=-\frac{2e_i}{n},\qquad
\frac{\partial\mathrm{MAE}}{\partial\hat y_i}=-\frac{\operatorname{sign}(e_i)}{n}\quad(e_i\ne0)
$$

$n$ 為筆數，$\operatorname{sign}(e_i)$ 在殘差正／負時為 +1／−1。兩式由損失公式微分；D2L的平方損失含 $1/2$，本頁未含，故導數有 2。

| 同批出貨資料 | 殘差（箱） | MSE 對預測的導數 | MAE 對預測的導數 |
|---|---|---|---|
| 第 1 筆：實際10、預測11 | −1 | +0.25 | +0.125 |
| 第 2 筆：實際20、預測19 | +1 | −0.25 | −0.125 |
| 第 8 筆：實際100、預測80 | +20 | −5 | −0.125 |

殘差由 +1 增至 +20，MSE 導數大小增為 20 倍，MAE 仍為 1/8。重點是各損失如何隨誤差改變；兩種損失的量綱不同，不能單靠跨損失的導數數字決定學習率。

MAE 在 $e_i=0$ 處左右斜率不同，**一般導數不存在**。次梯度（Subgradient）允許用一組合法斜率描述凸函數的尖點；本頁以 $s_i$ 表示其中一個可選值：

$$
e_i=0:\quad s_i\in\left[-\frac1n,\frac1n\right]
\quad\Longrightarrow\quad n=8:\ s_i\in[-0.125,0.125]
$$

這是依 Stanford 次梯度講義第1節的絕對值例子、第3.1～3.3節的縮放、加總與仿射變換規則，將預測減實際代入絕對值，按平均係數 $1/n$ 縮放零點區間 $[-1,1]$。

可取 0，但不能說一般導數等於 0，也不能在八筆平均時選 0.5；MSE 在零點的導數則確實是 0。

上述平均導數對照與零點區間是本頁自行推導，講義未直接列出這組完整式。

合成資料 `L23303-M4-D-loss-gradients.json` 保留原八筆預測，另列零點邊界，**不加入原平均**。以下重算八筆導數，不訓練模型。

```python
import json, os
from pathlib import Path
import numpy as np
data = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) /
    "content/examples/L23303-M4-D-loss-gradients.json").read_text(encoding="utf-8"))
e = np.array([r["y_true"] - r["y_pred"] for r in data["samples"]])
n = len(e)
print("MSE 導數:", (-2 * e / n).tolist())
print("MAE 非零處導數:", (-np.sign(e) / n).tolist())
print("MAE 零點次梯度區間:", [-1/n, 1/n])
```
```text
MSE 導數: [0.25, -0.25, 0.25, -0.25, 0.25, -0.25, 0.25, -5.0]
MAE 非零處導數: [0.125, -0.125, 0.125, -0.125, 0.125, -0.125, 0.125, -0.125]
MAE 零點次梯度區間: [-0.125, 0.125]
```

資料無隨機抽樣（seed=null），索引1–8不是時間，沒有訓練或切分。[平均絕對誤差](/concepts/mean-absolute-error/#當-mae-作為訓練損失補充)從 MAE 的角度解釋同一對照；[梯度下降](/concepts/gradient-descent/)接續說明如何更新參數。

## 常見誤解

- **「平方會消除離群值的影響。」** 平方會放大大誤差的貢獻，效果相反。
- **「MSE 是平均差幾箱。」** 它的單位是箱平方；平均絕對差距看 MAE。
- **「少估與多估能互相抵銷。」** 殘差相加可能抵銷，平方後再加不會。（補充）
- **「刪掉團購日就能證明模型更好。」** 真實的高需求日仍是任務的一部分，應查資料與需求，再決定如何建模。（補充）

## 進階

### 為什麼大誤差會帶來較大的梯度（補充）

MSE 作為訓練損失時，對單筆預測值的導數是：

$$
\frac{\partial\mathrm{MSE}}{\partial\hat y_i}
=\frac{2}{n}(\hat y_i-y_i)
$$

$\partial/\partial\hat y_i$ 表示只改動第 $i$ 筆預測值時，損失變化的斜率；其餘符號沿用主公式。殘差越大，這個導數的絕對值越大。

此式由本頁 MSE 定義逐項微分得到。D2L 第3.1.1.2節的式(3.1.5)、(3.1.6)含 $1/2$，第3.1.1.3節式(3.1.8)則對模型權重微分。

它們提供推導依據，未直接列出本頁不含 $1/2$、對單筆預測的平均導數完整式。

八筆資料中，第八筆的導數是 $2(80-100)/8=-5$，第一筆是 $2(11-10)/8=0.25$。這是對預測值的導數；更新模型參數還須使用鏈鎖律，不能直接視為參數更新量。

### 參考來源

- 學習指引科目 3，5.3、5-22～5-23；3.3（支持：定義與公式、適用場景、訓練損失角色）。
- [scikit-learn：mean_squared_error](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_squared_error.html)（支持：公式前提、程式、非負值）。
- [scikit-learn：Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html#mean-squared-error)（支持：平方誤差定義、大誤差及分類的 Brier score 例子）。
- [Hyndman、Athanasopoulos：Forecasting: Principles and Practice，第 5 章](https://otexts.com/fpp3/toolbox.html#scale-dependent-errors)（支持：原單位指標比較、換個場景的選擇思路）。
- [Dive into Deep Learning 3.1](https://d2l.ai/chapter_linear-regression/linear-regression.html)（支持：平方損失微分；本頁自行去除其1/2係數並改寫為對單筆預測值的導數）。
- [Boyd 等：Subgradients，1、3.1～3.3節](https://web.stanford.edu/class/ee364b/lectures/subgradients_notes.pdf)（支持：絕對值次梯度、縮放、加總與仿射變換規則；平均導數對照由本頁推導，非來源直接列式）。

## 小結

- MSE 是逐筆平方誤差的平均，單位為目標單位的平方。
- 同一批出貨資料得到 50.875 箱平方，第八筆貢獻約 98.28%。
- 大誤差平方放大；與 MAE、RMSE 合看，才能區分一般偏差與少數嚴重失準。
- 比模型前固定資料、單位及權重，並用留出資料確認泛化。
