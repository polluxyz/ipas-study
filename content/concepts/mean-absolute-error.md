---
id: mean-absolute-error
title: 平均絕對誤差
aliases:
  - MAE
  - Mean Absolute Error
kind: metric
codes:
  - L23303
  - L23103
contrasts:
  - target: mean-squared-error
    note: MSE 先平方，大誤差被放大、對離群值敏感；MAE 取絕對值，每筆誤差線性計入，較穩健
    source:
      - guide-3:3-23
      - guide-3:5-23
      - 115-1-S3-Q02
      - 114-2-S3-Q38
  - target: root-mean-squared-error
    note: 兩者單位都和目標變數相同；RMSE 仍會放大大誤差，MAE 不會。同一組預測的 RMSE 一定不小於 MAE
    source:
      - guide-3:5-23
      - 115-1-S1-Q42
guide_refs:
  - guide-3:5-23
  - guide-3:3-22
  - guide-3:3-23
  - guide-3:4-13
gaps:
  - ref: guide-3:5-23
    level: shallow
    ability: 指引只說 MAE 對異常值較不敏感；考題要比較 MSE、MAE、Huber 對梯度的影響，並指出「改用 MAE」不能解決整體指標掩蓋少數群體誤差的問題
author: codex
status: draft
summary: 平均絕對誤差平均每筆差距的大小，單位與預測目標相同
goals:
  - id: g1
    text: 逐筆計算 MAE，區分絕對誤差與有方向的偏差
  - id: g2
    text: 用共用資料比較 MAE 與 MSE 對離群值的反應
  - id: g3
    text: 依錯誤成本選用 MAE、MSE 或 RMSE，理解 MAE 損失的梯度特性與零點次梯度界線
formula_groups:
  - id: mae
    source: guide-3:5-23
    status: verified
    checked_by: task_438e98e2097f
  - id: mae-gradient
    source: https://web.stanford.edu/class/ee364b/lectures/subgradients_notes.pdf
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某網店八筆出貨預測前七筆各差 1 箱，最後一筆少估 20 箱。平均絕對誤差是多少？
    options:
      A: 2.375 箱
      B: 20 箱
      C: 3.375 箱
      D: 50.875 箱平方
    answer: C
    explain:
      A: 2.375 是這批有正負方向的殘差平均，不能替代逐筆絕對值平均。
      B: 20 只代表最後一筆差距，未把其他樣本一起平均。
      C: 絕對誤差和為 7＋20＝27，除以八筆得到 3.375 箱。
      D: 50.875 使用平方後平均，屬於 MSE。
  - id: c2
    goal: g2
    type: choice
    prompt: 在上述資料中，最後一筆占絕對誤差約 74%，占平方誤差約 98%。何種解讀合理？
    options:
      A: MAE 比 MSE 較不敏感，但仍可能受少數大誤差主導
      B: MAE 不會受到最後一筆影響
      C: 74% 是模型預測正確的比例
      D: MAE 一定會比任何模型的 RMSE 小
    answer: A
    explain:
      A: 最後一筆仍占 MAE 分子的多數，只是沒有被平方放大到 400。
      B: 最後一筆提供 20 的絕對誤差，並未被 MAE 忽略。
      C: 74% 是絕對誤差的貢獻比例，與猜對幾筆無關。
      D: RMSE 與 MAE 的大小關係須固定同一批預測及權重，不能跨模型套用。
  - id: c3
    goal: g3
    type: choice
    prompt: 四個負載時段，甲的殘差是 0、0、0、8 MW，乙是 3、3、3、3 MW。若每偏差 1 MW 的成本固定，優先選哪個？
    options:
      A: 乙，因為它的 MAE 是 2
      B: 乙，因為 RMSE 較小一定符合所有成本
      C: 甲，因為它的 RMSE 是 2
      D: 甲，因為 MAE 是 2，小於乙的 3
    answer: D
    explain:
      A: 乙的絕對誤差和是 12，MAE 為 3。
      B: 平方型指標不必然符合線性成本，這裡應以 MAE 比較。
      C: 甲的 RMSE 是 √(64/4)＝4，不能把 MAE 當成 RMSE。
      D: 固定單位偏差成本對應絕對誤差，甲的平均成本較低。
  - id: c4
    goal: g3
    type: choice
    prompt: 同一批八筆等權重資料，殘差為實際減預測。某筆殘差為 +20 箱，另有一筆恰好預測正確；哪個 MAE 梯度敘述正確？
    options:
      A: 大殘差處導數為 −5；零點的左右斜率都等於 0，因此存在一般導數
      B: 大殘差處導數為 −0.125；零點次梯度可取 [−0.125,0.125]
      C: 大殘差處導數為 +0.125；零點的次梯度可以任選整個實數軸的值
      D: 大殘差處導數為 −1；零點次梯度仍為 [−1,1]，完全不需按樣本數再縮放
    answer: B
    explain:
      A: −5 是同批 MSE 導數；MAE 零點左右斜率不同，一般導數不存在。
      B: 正殘差使對預測的導數為負；八筆平均也把零點合法區間縮成正負八分之一。
      C: 對預測值微分的符號與殘差相反；零點仍有有限的合法次梯度區間。
      D: −1 是單筆絕對損失的斜率；本題平均損失必須除以八。
textbook: v2
---

## 為什麼需要

平均絕對誤差（MAE，英文全名為 Mean Absolute Error）直接平均每筆差距的大小。向倉儲主管說明「平均差多少箱」，比平方誤差容易理解。

和均方誤差相比，MAE 對大誤差採線性計入，不會再平方放大。資料有偏態或少量極端值時，可以用它觀察一般誤差水準。

## 直覺

少估 1 箱與多估 1 箱，絕對誤差都是 1 箱。兩筆相加是 2 箱，而不是 0；因此正負方向不會抵銷。

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
共用出貨資料前七筆各差 1 箱，最後一筆少估 20 箱。MAE 把最後一筆計為 20，MSE 則計為 400；這是「較不敏感」的意思。

但 20 仍比前七筆合計的 7 大，MAE 仍會受到離群值拉動。
:::

## 定義與公式

逐筆取實際值與預測值之差的絕對值，再平均：

$$
\mathrm{MAE}=\frac{1}{n}\sum_{i=1}^{n}|y_i-\hat y_i|
$$

- $n$ 是樣本筆數，須大於 0；$i$ 是樣本索引。
- $y_i$ 是實際值，$\hat y_i$ 是同一筆預測值。
- $|\cdot|$ 表示絕對值；殘差 $y_i-\hat y_i$ 為正代表低估。

:::supplement[來源：scikit-learn mean_absolute_error API；本站 L23303 網店出貨量教學模擬資料]
本頁用單一目標、每筆等權重的版本。兩組值須等長、逐筆對齊、單位一致且都是有限數字；缺值須先處理。

代入八筆出貨資料：$\mathrm{MAE}=(1+1+1+1+1+1+1+20)/8=27/8=3.375$ 箱。它是這八筆的平均絕對差距，不是每一天都差 3.375 箱。

MAE 非負，完全預測正確才等於 0，單位與目標相同。它不記錄方向，因此不能單憑 MAE 判定模型習慣少估還是多估。
:::

## 算一次

:::supplement[來源：本站 L23303 網店出貨量教學模擬資料]
使用 `content/examples/L23303-regression.json`，按樣本順序核對每筆絕對值：

| 樣本 | 殘差（箱） | 絕對誤差（箱） | 平方誤差（箱平方） |
|---|---|---|---|
| 1、2 | −1；+1 | 1；1 | 1；1 |
| 3、4 | −1；+1 | 1；1 | 1；1 |
| 5、6 | −1；+1 | 1；1 | 1；1 |
| 7 | −1 | 1 | 1 |
| 8 | +20 | 20 | 400 |

1. 絕對值加總為 $7\times1+20=27$ 箱，除以 8 得 MAE＝3.375 箱。
2. 平方加總為 $7\times1+400=407$ 箱平方，MSE＝50.875 箱平方。
3. 開平方根後，RMSE 約 7.133 箱；它比 MAE 更受團購日的大誤差影響。

只看前七筆時，MAE 與 RMSE 都是 1 箱。加入第八筆後，兩者分別變成 3.375 與約 7.133 箱；這個對照顯示反應差異，不是刪除離群值的理由。

最後一筆占絕對誤差 $20/27\approx74.07\%$，仍超過一半。不能把「相較 MSE 較穩健」記成「不受極端值影響」。
:::

## 程式

:::supplement[來源：scikit-learn mean_absolute_error API]
以絕對值平均核對套件輸出，同時保留殘差以觀察方向：

```python
import numpy as np
from sklearn.metrics import mean_absolute_error
y_true = np.array([10, 20, 30, 40, 50, 60, 70, 100])
y_pred = np.array([11, 19, 31, 39, 51, 59, 71, 80])
residual = y_true - y_pred
print("絕對誤差:", np.abs(residual).tolist())
print(f"絕對值和: {np.abs(residual).sum()}")
print(f"手算 MAE: {np.abs(residual).mean():.3f}")
print(f"套件 MAE: {mean_absolute_error(y_true, y_pred):.3f}")
```
```text
絕對誤差: [1, 1, 1, 1, 1, 1, 1, 20]
絕對值和: 27
手算 MAE: 3.375
套件 MAE: 3.375
```
:::

:::tip[讀碼重點]
`np.abs(residual).mean()` 先逐筆去掉正負號，再平均。`abs(residual.mean())` 先讓正負誤差抵銷，是另一個量。
:::

## 怎麼用、怎麼判讀

資料偏態或有少數極端值，又不希望平方懲罰主導時，可優先報 MAE。若極端失準的成本特別大，則搭配 MSE 或 RMSE，而非只選較小的數字。

### 換個場景

| 場景 | 判讀重點 |
|---|---|
| 偏態資料或少量極端值 | 指引列出的資料條件；MAE 相較平方誤差較不受極端值牽動 |
| 電力負載（補充） | 一般調度偏差可看 MAE，大幅少估可能造成缺電時須加看 RMSE 與方向 |
| 房價估算（補充） | 以萬元說明平均差距，並分開報告一般住宅與豪宅 |
| 交通流量（補充） | 用每小時車輛數解釋差距，另查尖峰時段，避免日平均掩蓋壅塞 |

### 電力負載：兩種成本會選出不同模型（補充）

教學資料 `L23303-B-electricity.json` 的實際負載為 100、102、98、100 MW。甲前三筆正確，最後少估 8 MW；乙每筆少估 3 MW。

| 模型 | 四筆殘差（MW） | MAE（MW） | RMSE（MW） |
|---|---|---|---|
| 甲 | 0、0、0、8 | 2 | 4 |
| 乙 | 3、3、3、3 | 3 | 3 |

甲的絕對誤差和為 8，MAE＝2；平方和為 64，RMSE＝4。乙的絕對誤差和為 12，MAE＝3；平方和為 36，RMSE＝3。

同批 MSE 分別是甲 $64/4=16$、乙 $36/4=9$ MW平方，因此 MSE 與 RMSE 都偏好乙，MAE 則偏好甲。兩者差別在錯誤的計價方式，不是挑數字看起來最小的指標。

若每偏差 1 MW 的成本大致固定，MAE 偏好甲。若大幅少估會增加緊急備援成本，RMSE 偏好乙；若低估與高估代價不同，還需另訂有方向的成本指標。

### 當 MAE 作為訓練損失（補充）

在殘差非零處，MAE 對單筆預測值的導數為：

$$
\frac{\partial\mathrm{MAE}}{\partial\hat y_i}
=\frac{1}{n}\operatorname{sign}(\hat y_i-y_i)
$$

$\operatorname{sign}$ 只取正負方向，正數為 +1、負數為 −1；其餘符號沿用主公式。誤差不為 0 時，導數絕對值為 $1/n$，不隨誤差放大。

出貨例子第一筆導數為 +1/8，第八筆為 −1/8；雖然誤差大小相差 20 倍，導數絕對值相同。在誤差為 0 處一般導數不存在，優化工具可用次梯度處理。

固定 $e_i=y_i-\hat y_i$，正值表示低估，上式也等於 $-\operatorname{sign}(e_i)/n$。以下用同八筆資料，皆對**預測值**微分，含平均係數。

| 殘差（箱） | MSE 導數 $-2e_i/8$ | MAE 非零處導數 | 判讀 |
|---|---|---|---|
| −1（第1筆） | +0.25 | +0.125 | 梯度下降將預測往下推 |
| +1（第2筆） | −0.25 | −0.125 | 梯度下降將預測往上推 |
| +20（第8筆） | −5 | −0.125 | MSE 隨誤差增大；MAE 大小固定 |

在 $e_i=0$ 處，單筆絕對損失可取的次梯度是 $[-1,1]$。平均損失須乘上 $1/n$，所以以 $s_i$ 表示所選次梯度時：

$$
s_i\in[-1/n,1/n],\qquad n=8\Rightarrow s_i\in[-0.125,0.125]
$$

端點與區間內的值都合法；0 是常用選擇之一，不代表一般導數存在。未除以八的 $[-1,1]$ 不適用於這個平均版本；例如 0.5 已超出合法範圍。

上述非零處導數與零點區間，由本頁依 Stanford 講義第1節的絕對值例子、第3.1～3.3節的縮放、加總與仿射變換規則自行推導：以預測減實際代入絕對值，再乘平均係數 $1/n$。

講義未直接列出這個平均 MAE 對預測的完整式。[均方誤差](/concepts/mean-squared-error/#同一殘差下的兩種導數補充)提供共用JSON的八筆程式輸出；零點案例獨立檢查，不改原平均。

這個比較是對預測值的導數；模型參數的更新還取決於模型結構及優化器。

MSE 的量綱是箱平方、MAE 是箱，兩種導數的量綱也不同。這裡比較的是各自隨殘差增大的反應，不表示換成 MAE 後可以沿用相同學習率而保證收斂。

## 常見誤解

- **「MAE 對離群值完全免疫。」** 大誤差仍線性累加，共用例子的團購日就占絕對誤差約 74%。
- **「MAE 小就沒有嚴重失準。」** 平均會合併不同樣本，仍須檢查殘差與高風險群組。
- **「MAE 與 RMSE 一定選出同一模型。」** 電力例子中兩者排序相反，因為對大誤差的計價不同。（補充）
- **「MAE 是有方向的平均偏差。」** 絕對值已去掉正負號，不能用來辨認低估。（補充）

## 進階

### 參考來源

- 學習指引科目 3，5.3、5-23；3.3（支持：MAE 定義、偏態與極端值場景）。
- [scikit-learn：mean_absolute_error](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_absolute_error.html)（支持：程式、非負值與等權重設定）。
- [scikit-learn：Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html#mean-absolute-error)（支持：絕對誤差損失與評估；次梯度另據下列 Stanford 講義）。
- [Hyndman、Athanasopoulos：Forecasting: Principles and Practice，第 5 章](https://otexts.com/fpp3/toolbox.html#scale-dependent-errors)（支持：MAE 與 RMSE 選擇、原單位判讀）。
- [Boyd 等：Subgradients，1、3.1～3.3節](https://web.stanford.edu/class/ee364b/lectures/subgradients_notes.pdf)（支持：絕對值次梯度、縮放、加總與仿射變換規則；平均導數及符號方向由本頁推導，非來源直接列式）。

## 小結

- MAE 是逐筆絕對誤差的平均，單位與目標相同。
- 共用資料絕對誤差和 27 箱，MAE＝3.375 箱。
- MAE 較不受離群值影響，仍可能由少數大誤差主導。
- MAE 與 RMSE 可能選出不同模型，應依錯誤成本與分群結果判斷。
