---
id: "gradient-boosted-trees"
title: "梯度提升與 XGBoost"
kind: "model"
codes: ["L23202", "L21301"]
aliases: ["GBDT", "Gradient Boosting", "Gradient Boosting Decision Tree", "gradient-boosting", "梯度提升決策樹"]
requires: ["boosting", "regression-tree"]
guide_refs: ["guide-1:5-8", "guide-1:5-9", "guide-3:4-22", "guide-3:4-39"]
summary: "梯度提升讓新樹沿損失的負梯度修正分數，XGBoost是其高效實作之一"
goals:
  - id: "g1"
    text: "比較森林平均與提升修正，辨認學習率、樹深及XGBoost的泛化控制"
  - id: "g2"
    text: "用兩輪平方損失殘差追蹤弱學習器更新"
  - id: "g3"
    text: "由分類分數轉機率並計算Logloss，說明早停用途"
is_a: ["ensemble-models"]
formula_groups:
  - id: "square-gradient"
    source: "https://scikit-learn.org/stable/modules/ensemble.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK-W-L23202-E"
  - id: "binary-logloss"
    source: "https://scikit-learn.org/stable/modules/linear_model.html#binary-case"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK2-W-L23202-E"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "同一批60筆訓練資料，比較森林30棵樹和GBDT30輪。哪個選擇理由合理？"
    options:
      A: "森林依前輪殘差訓練，GBDT把30個房價直接平均"
      B: "森林沒有資源成本，GBDT的缺值一律必須補零"
      C: "兩者只差模型名稱，調整樹深都不會影響泛化"
      D: "森林各樹可分別擬合，GBDT需兼顧學習率與輪數"
    answer: "D"
    explain:
      A: "這把森林與梯度提升的訓練分工對調。"
      B: "森林也消耗資源，缺值策略則依實作。"
      C: "樹深影響模型容量與過擬合風險。"
      D: "輪次相依與更新幅度是實際選型及調參差異。"
  - id: "c2"
    goal: "g2"
    type: "choice"
    prompt: "一屋真值100，起點150；第一樹−40、第二樹−20，兩輪學習率均0.5。最終預測為何？"
    options:
      A: "120；150依序加入−20與−10"
      B: "90；150依序加入−40與−20"
      C: "−10；只保留第二樹的一半值"
      D: "180；150依序減去−20與−10"
    answer: "A"
    explain:
      A: "150−20−10=120，原模型與兩輪修正都保留。"
      B: "這是學習率1而不是0.5。"
      C: "這只算最後一輪修正量。"
      D: "對負修正再次相減，會反向提高預測。"
  - id: "c3"
    goal: "g3"
    type: "choice"
    prompt: "一筆實際違約標籤1，模型分數由0提高到0.5，使用Sigmoid與自然對數。哪個結果合理？"
    options:
      A: "機率由0.5降至約0.378，單筆損失由約0.693升至0.974"
      B: "機率由0.5升至約0.622，單筆損失由約0.693降至0.474"
      C: "機率由0.5升至約0.750，單筆損失由約0.693降至0.288"
      D: "機率由0.5維持在0.500，單筆損失由約0.693維持0.693"
    answer: "B"
    explain:
      A: "這相當於分數降至−0.5，把題設更新方向反轉了。"
      B: "Sigmoid(0.5)約0.622459，負對數約0.474077。"
      C: "把機率用線性方式增加0.25不符合指定的Sigmoid轉換。"
      D: "分數由0升至0.5，Sigmoid機率及正類損失都會改變。"
textbook: "v2"
author: "codex"
status: "draft"
---

## 為什麼需要

隨機森林讓很多棵樹各猜各的，最後取平均。梯度提升（Gradient Boosting）換個做法：一次只加一棵小樹，專門補前面還沒猜準的部分。每棵小樹都是決策樹時，常簡稱 GBDT。

一棵淺樹只抓得到粗略規律。一棵接一棵補下去，合起來就能學到較複雜的關係。

本頁講共同原理。XGBoost 是梯度提升的一種實作，另外加了防止過擬合的懲罰與缺值處理，細節見 XGBoost 頁。兩個名稱不要當成同一套演算法。

## 直覺

用猜房價來想。第一步，每間房都先猜全體平均。接著看每間房「還差多少」：猜太高是負的，猜太低是正的。

下一棵樹不直接猜房價，只學這份「還差多少」。學到的修正先乘上學習率，每次只補一部分，再加回原本的預測。加完重算一次還差多少，交給下一棵樹。

![4 間房先都猜 150。每棵新樹學「還差多少」，乘 0.5 後加回，差距一輪比一輪小。](figure:l23202-gradient-boosted-trees-update)

### 為什麼叫「梯度」提升

「還差多少」其實是一個方向，告訴模型每筆預測該往上調還是往下調、調多少。

損失（衡量猜錯程度的分數）用平方誤差時，這個方向剛好等於損失的負梯度。梯度指向損失增加最快的方向，負梯度就是讓損失下降最快的方向。

換成其他損失，例如分類常用的 Logloss，「真值減預測」就不再是下降最快的方向。梯度提升的做法是：不管用哪種損失，都先算出負梯度，再讓新樹去學它。每棵新樹都沿著讓損失下降的方向補一步，所以叫「梯度」提升。

## 定義與公式

指引用殘差（真值減預測，也就是上面的「還差多少」）說明迴歸怎麼修正。這個寫法只在平方損失下成立；換成其他損失，新樹要改學負梯度。

### 平方損失的更新（補充）

$$
\begin{aligned}
L(y,F)&=\tfrac12(y-F)^2\\
r_{im}&=y_i-F_{m-1}(x_i)\\
F_m(x)&=F_{m-1}(x)+\eta h_m(x)
\end{aligned}
$$

$y_i$ 是第 i 筆的真值。$F_{m-1}$ 是前 m−1 輪加總後的預測。$r_{im}$ 是本輪還差多少，也就是殘差。$h_m$ 是本輪的新樹，它學的就是 $r_{im}$。$\eta$ 是學習率。

損失取平方誤差的一半時，對預測微分再加負號，正好得到殘差。不乘一半也只多出 2 倍，方向相同。

房價100、起點150、新樹−40、學習率0.5時，更新為$150+0.5(-40)=130$。半平方損失由$50^2/2=1250$降至$30^2/2=450$。

### 分類分數與Logloss（補充）

$$
p_i=\frac{1}{1+e^{-F(x_i)}},\qquad
\ell_i=-\left[y_i\ln p_i+(1-y_i)\ln(1-p_i)\right]
$$

$F$ 是還沒轉成機率的分數，$p_i$ 是正類機率，$y_i$ 只能是 0 或 1，$\ln$ 是自然對數。

二元 Logloss 對分數的負梯度是 $y_i-p_i$。例如標籤是 1 的資料，機率越低，這個值越大，新樹就把分數往上推越多。分類時新樹學的就是這個值。

若$y_i=1$，分數0時$p_i=0.5$、損失約0.693147。分數改成0.5後$p_i\approx0.622459$，損失約0.474077；不是把殘差直接當成機率。

## 算一次

### 兩輪房價修正（補充）

四筆微型房價100、120、180、200，起點150、學習率0.5，與Boosting策略頁完全相同。

| 階段 | 新樹修正值 | 更新後預測 | 均方誤差 |
|---|---|---|---|
| 起點 | 尚未加樹 | 150、150、150、150 | 1700 |
| 第一輪 | −40、−40、40、40 | 130、130、170、170 | 500 |
| 第二輪 | −20、−20、20、20 | 120、120、180、180 | 200 |

第一輪殘差為−50、−30、30、50，第二輪為−30、−10、10、30。每個葉的修正值是該葉殘差平均；第二輪後均方誤差為$(400+0+0+400)/4=200$。

### 換成授信分類（補充）

四筆標籤0、0、1、1，起始分數全0。負梯度為−0.5、−0.5、0.5、0.5；若直接擬合此方向、步幅1，分數更新為相同四個值。

前兩筆正類機率降至0.377541，後兩筆升至0.622459，Logloss由0.693147降至0.474077。這是固定步幅示例；套件可能另求葉值或步幅，結果未必相同。

## 程式（補充）

以下以實際樹擬合微型房價，另算分類分數轉機率的結果。

```python
import numpy as np
from sklearn.tree import DecisionTreeRegressor
X = np.array([20, 25, 40, 45]).reshape(-1, 1)
y = np.array([100, 120, 180, 200], dtype=float)
pred = np.full(4, y.mean())
for _ in range(2):
    h = DecisionTreeRegressor(max_depth=1, random_state=23202).fit(X, y-pred)
    pred += .5*h.predict(X)
    print("預測", pred.tolist(), "MSE", np.mean((y-pred)**2))
p = 1/(1+np.exp(-np.array([-.5, -.5, .5, .5])))
labels = np.array([0, 0, 1, 1])
print("機率", np.round(p, 6).tolist())
print("Logloss", round(float(-np.mean(labels*np.log(p)+(1-labels)*np.log(1-p))), 6))
```
```text
預測 [130.0, 130.0, 170.0, 170.0] MSE 500.0
預測 [120.0, 120.0, 180.0, 180.0] MSE 200.0
機率 [0.377541, 0.377541, 0.622459, 0.622459]
Logloss 0.474077
```

:::tip[讀碼重點]
迴歸段擬合`y-pred`；分類段先加分數，再通過Sigmoid。這裡的MSE是四筆訓練內誤差，與半平方損失差一個常數倍，也不是100筆資料的驗證分數。
:::

## 怎麼用、怎麼判讀

森林的每棵樹可以各自訓練；梯度提升的每棵樹要等前一輪算完才能接著學，所以更需要細調學習率與樹深。

指引提到早停：一邊加樹一邊看驗證資料的損失，加了新樹也不再變好就停止，避免模型開始記住訓練資料的雜訊。

因為要一輪接一輪訓練，傳統梯度提升通常比森林費時，樹越多、越深越明顯。損失可以依任務挑選或自訂。模型也能給出特徵重要性，幫忙查看模型靠哪些變數做判斷。

:::supplement[來源：XGBoost Parameters；XGBoost FAQ]
XGBoost在共同提升架構上加入樹複雜度懲罰，也能學習缺值分支。它的正則化不代表一般GBDT毫無泛化控制；GBDT仍可限制深度、輪數、學習率及子樣本比例。

特徵重要性與森林一樣不能證明因果；仍須檢查保留資料上的表現。
:::

早停用的是驗證集，不要拿最後才用的測試集來挑輪數。樹比較多、訓練損失比較低，都不代表在新資料上會比較準。

### 換個場景

| 場景／資料條件 | 模型用途 | 判讀重點 |
|---|---|---|
| 房價、銷售量 | 連續預測 | 森林平均與逐輪修正的成本 |
| 中大型、非線性交互作用 | 迴歸或分類 | 樹深、學習率與早停 |
| 垃圾郵件、疾病、客戶流失、金融風險 | 分類分數與機率 | Logloss及決策閾值 |
| 農業產量（補充） | 季節條件下的產量迴歸 | 依年份驗證泛化 |
| 運輸延誤（補充） | 預測延誤機率 | 未來班次與歷史資料分開 |

## 常見誤解

- 新樹修正的是目前整體模型，不只是上一棵樹。
- 新樹永遠學「真值減預測」：只有平方損失是這樣，其他損失要學負梯度。（補充）
- 分類須把更新後分數轉為機率，不能把修正量直接當機率。（補充）
- XGBoost與LightGBM有加速設計，不保證在所有資料比森林更準。

## 進階

### 指引的分類殘差用語

指引`guide-3:4-39`將過程簡述為殘差轉成機率。應理解為「先以損失的修正方向更新模型分數，再轉機率」；直接轉單棵樹殘差，會漏掉累積分數。

### 參考來源

- 科目1指引（本機版本未標示），`guide-1:5-8`～`guide-1:5-9`：支持平均與修正、應用領域及分類流程。
- 科目3指引（2025-12檔案版），`guide-3:4-22`、`guide-3:4-39`：支持逐輪迴歸、學習率、分類Logloss與早停；公式推導為補充。
- [scikit-learn Ensembles](https://scikit-learn.org/stable/modules/ensemble.html)：支持平方損失、負梯度、分類分數及泛化控制。
- [scikit-learn二元邏輯斯迴歸](https://scikit-learn.org/stable/modules/linear_model.html#binary-case)：直接列出Sigmoid與二元對數損失，支持分類公式。
- [scikit-learn log_loss](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.log_loss.html)：支持單筆二元損失及自然對數定義。
- [INRIA梯度提升課程](https://inria.github.io/scikit-learn-mooc/python_scripts/ensemble_gradient_boosting.html)：參考以兩輪殘差與新樹串接的算例安排。
- [XGBoost Parameters](https://xgboost.readthedocs.io/en/stable/parameter.html)、[XGBoost FAQ](https://xgboost.readthedocs.io/en/stable/faq.html)：支持正則化、缺值及設定比較。

## 小結

- 森林平均各樹答案；梯度提升逐輪加入修正。
- 新樹學的是損失的負梯度；平方損失時，就是「還差多少」。
- 學習率控制每棵新樹加入的幅度。
- 分類先更新分數，再轉機率與計算Logloss。（補充）
- 早停依驗證資料，最終測試集留到模型定案後。
