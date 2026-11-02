---
id: shap
title: SHAP 特徵貢獻與輸出尺度
kind: technique
codes: [L21203, L23302]
aliases: [SHAP 特徵貢獻解釋, SHAP值, SHapley Additive exPlanations]
requires: [explainable-ai, logistic-regression]
summary: SHAP 把單筆模型輸出相對基準的差異分攤給特徵，解讀時須先確認尺度
goals:
  - id: g1
    text: 加總基準與單筆特徵貢獻，區分機率及log-odds尺度
  - id: g2
    text: 區分單筆正負貢獻、整體重要性及因果影響
  - id: g3
    text: 說明背景集及相關特徵如何影響貢獻分配
formula_groups:
  - id: additive-output
    source: https://arxiv.org/html/1705.07874v2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-B
  - id: linear-attribution
    source: https://shap.readthedocs.io/en/latest/generated/shap.LinearExplainer.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-B
  - id: sigmoid-scale
    source: https://scikit-learn.org/stable/modules/linear_model.html#binary-case
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-B
  - id: global-absolute
    source: https://christophm.github.io/interpretable-ml-book/shap.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 違約模型解釋的是log-odds，基準−0.4、三欄貢獻0.8、1.2、0.2。正確解讀為何？
    options:
      A: 總分2.2；三欄相加後，機率為Sigmoid(2.2)約0.9002
      B: 總分1.8；三欄相加後，機率直接等於1.8亦即180%
      C: 總分1.8；機率等於Sigmoid(−0.4)再加2.2約2.6013
      D: 總分1.8；含基準加總，機率為Sigmoid(1.8)約0.8581
    answer: D
    explain:
      A: 三欄相加2.2還沒加基準−0.4。
      B: log-odds不是機率，需經Sigmoid轉換。
      C: 不能把log-odds的貢獻直接加到機率基準。
      D: 同尺度加總得到1.8，再整體轉換得到約0.8581。
  - id: c2
    goal: g2
    type: choice
    prompt: 同80筆資料，收入平均絕對SHAP為0.60、年齡為0.24；某個案收入貢獻為−0.80。哪個判斷合理？
    options:
      A: 個案收入降低相對基準的分數；整體收入平均影響幅度較年齡大
      B: 個案收入降低相對基準的分數；整體收入對每個人的方向都為負
      C: 個案收入降低相對基準的分數；替所有人加薪就會消除違約風險
      D: 個案收入降低相對基準的分數；年齡在每一個案都必定比收入小
    answer: A
    explain:
      A: 正負號描述個案方向，平均絕對值描述整體幅度。
      B: 絕對值彙總已去掉方向，不能推出每個人的正負。
      C: 模型歸因沒有證明加薪的因果效果。
      D: 平均大小不能保證每一筆的大小關係。
  - id: c3
    goal: g3
    type: choice
    prompt: 同一位申請者、同一模型，背景從80名一般客戶改為80名高收入客戶，收入貢獻改變。應如何處理？
    options:
      A: 宣稱原模型一定已更新；相同輸入只要換背景就會改變原預測
      B: 宣稱兩份解釋一定有錯；任何SHAP都應與背景資料完全無關
      C: 記錄參考人口與遮蔽假設；核對各自加總仍重建同一模型輸出
      D: 合併兩份基準後取最大；所有背景就能共用完全相同的歸因
    answer: C
    explain:
      A: 背景可改變基準及歸因，原模型預測本身可以維持相同。
      B: SHAP需要定義缺少特徵時的參考方式，背景是解釋的一部分。
      C: 比較解釋必須保存背景與假設，並檢查加總的一致性。
      D: 任意合併基準與貢獻會破壞同一解釋內的加總關係。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-15]
---

## 為什麼需要

指引建議在醫療、金融等高風險應用搭配SHAP（SHapley Additive exPlanations）。

:::supplement[來源：SHAP原始論文]
SHAP以Shapley值的分攤思想解釋預測：相對於參考基準，這筆輸出的差異分攤給哪些特徵？特徵加入不同組合可能有不同貢獻，不能只按原始值排大小。
:::

## 直覺

### 從基準走到個案（補充）

本組授信參考模型已凍結，正類為違約，分數尺度是對數勝算（log-odds）。先看基準，再沿各項貢獻走到個案分數；正值推高輸出，負值拉低它。

![先加基準與各項log-odds貢獻，再把總分轉成機率；不能在兩種尺度間直接相加。](figure:l23302-shap-waterfall)

## 定義與公式

### 加法分解與線性小例子（補充）

$$
f(x)=\phi_0+\sum_{j=1}^{M}\phi_j(x)
$$

$f(x)$是被解釋的輸出，$\phi_0$是基準，$\phi_j(x)$是第$j$項貢獻，$M$是特徵數。所有項必須在相同輸出尺度；近似演算法可能有數值誤差。

本例$f$選擇log-odds。代入$-0.4+0.8+1.2+0.2=1.8$，可重建個案分數；正類若改成「不違約」，方向的意思也要重新確認。

對線性輸出，使用以背景邊際分布替換缺失欄位的解釋方式時：

$$
\begin{aligned}
f(x)&=b+\sum_j\beta_jx_j\\
\phi_0&=b+\sum_j\beta_j\mu_j\\
\phi_j(x)&=\beta_j(x_j-\mu_j)
\end{aligned}
$$

$b$是截距、$\beta_j$是係數、$x_j$是個案特徵、$\mu_j$是背景平均。這是本例特定假設下的簡式；考慮特徵相關的條件式解釋，分配方式可能不同。

80筆背景三欄平均均0。截距−0.4、係數[−0.8,1.2,0.4]，個案編碼[−1,1,0.5]，收入貢獻為$(-0.8)(-1-0)=0.8$；另兩欄依序1.2與0.2。

### 把總分轉成機率（補充）

$$
p=\sigma(z)=\frac{1}{1+e^{-z}}
$$

$z$是log-odds，$p$是違約機率，$\sigma$是Sigmoid。$z=1.8$得$p\approx0.858149$；基準−0.4轉換後約0.401312。

0.8不代表增加80個百分點。若改解釋機率，基準與貢獻都須重算；本例平均機率約0.423758，不等於Sigmoid(−0.4)。

## 算一次

### 個案與整體使用同80筆（補充）

授信個案是月收入40千元、負債比0.6、55歲；編碼規則見共用例子README。

收入係數為負，且本個案收入低於背景平均；兩個負號相乘，所以收入貢獻為正，推高違約分數。

| 欄位 | 個案編碼 | 係數 | 單筆貢獻 |
|---|---|---|---|
| 收入 | −1 | −0.8 | ＋0.8 |
| 負債比 | 1 | 1.2 | ＋1.2 |
| 年齡 | 0.5 | 0.4 | ＋0.2 |

再把每一筆的貢獻取絕對值後平均：

$$
I_j=\frac{1}{n}\sum_{i=1}^{n}|\phi_j(x_i)|
$$

$I_j$是欄位$j$的幅度，$n$是筆數，$x_i$是第$i$筆。收入平均絕對編碼0.75，故$I_1=0.8\times0.75=0.60$；負債0.90、年齡0.24。

![整體平均絕對貢獻保留幅度、去掉方向；不能用這張圖宣稱收入對每個人都有相同作用。](figure:l23302-shap-global)

## 程式（補充）

以下使用SHAP實際核對線性輸出的簡式；解釋的是已指定係數的參考模型，不是搜尋後重新擬合的候選模型。

```python
import itertools
import numpy as np
import shap
X = np.array(list(itertools.product([-1., -.5, .5, 1.], [-1., -.5, .5, 1.], [-1., -.5, 0., .5, 1.])))
beta, b = np.array([-.8, 1.2, .4]), -.4
x = np.array([[-1., 1., .5]])
masker = shap.maskers.Independent(X, max_samples=80)
result = shap.LinearExplainer((beta, b), masker)(x)
z = float(result.base_values[0] + result.values[0].sum())
print("基準", round(float(result.base_values[0]), 6))
print("貢獻", np.round(result.values[0], 6).tolist())
print("分數與機率", round(z, 6), round(float(1/(1+np.exp(-z))), 6))
print("整體幅度", np.round(np.abs((X-X.mean(0))*beta).mean(0), 6).tolist())
```
```text
基準 -0.4
貢獻 [0.8, 1.2, 0.2]
分數與機率 1.8 0.858149
整體幅度 [0.6, 0.9, 0.24]
```

:::tip[讀碼重點]
`Independent`固定背景遮蔽方式，`max_samples=80`保留全部背景。`LinearExplainer`接收係數與截距，這裡輸出是線性分數；最後才用Sigmoid轉機率。
:::

## 怎麼用、怎麼判讀

醫療與金融的複雜模型可用SHAP輔助理解依賴關係。

### 背景與相關特徵（補充）

先確認解釋的是哪個類別、哪種輸出，再看基準與正負貢獻。

把一般客戶換成高收入客戶當背景，相同申請人的收入相對位置會改變。因此基準與貢獻可能改變，原模型預測卻不必改變。

收入與資產若高度相關，獨立替換可能產生少見組合；條件式解釋又可能把貢獻分攤給相關欄位。比較兩份解釋時，必須保存背景人口與處理相關性的假設。

貢獻大不代表容易介入。例如區號貢獻大，可能來自歷史偏差或代理關係；不能直接推論改區號會降低真實風險。

### 換個場景

| 場景／資料條件 | 解釋用途 | 判讀重點 |
|---|---|---|
| 醫療、金融、法規敏感模型 | 理解特徵依賴 | 先確認類別及受眾 |
| 醫療合成個案（補充） | 收縮壓、檢驗、年齡貢獻 | 同例基準−0.4、總分1.8 |
| 設備維修（補充） | 找到個案異常的主要依據 | 相關感測器的貢獻分攤 |
| 客戶流失（補充） | 比較個案與整體依賴 | 平均幅度不能推出方向 |

## 常見誤解

- 正SHAP只表示推高被解釋輸出，不等於特徵本身是好事。（補充）
- log-odds貢獻不能直接加到機率。（補充）
- 多筆平均絕對SHAP不是單筆因果效果。（補充）
- SHAP值不是脫離背景與模型後仍固定不變的個人屬性。（補充）

## 進階

### 不同演算法的成本（補充）

SHAP包含不同估算方法。樹模型可採專用演算法；一般黑箱的取樣估算可能需要更多預測呼叫，不能一概宣稱一定快於或慢於LIME。

### 參考來源

- 科目3指引（本機2025-12檔案版），`guide-3:5-15`：支持方法定位與應用領域；加總、尺度及彙總為補充。
- [SHAP原始論文](https://arxiv.org/html/1705.07874v2)：支持加法分解及演算法區別。
- [LinearExplainer](https://shap.readthedocs.io/en/latest/generated/shap.LinearExplainer.html)：支持線性公式、背景及相關特徵限制。
- [SHAP標準化特徵範例](https://shap.readthedocs.io/en/latest/example_notebooks/tabular_examples/linear_models/Explaining%20a%20model%20that%20uses%20standardized%20features.html)：參考線性模型程式及加總核對的安排。
- [scikit-learn二元邏輯迴歸](https://scikit-learn.org/stable/modules/linear_model.html#binary-case)：支持Sigmoid及機率輸出公式。
- [Molnar：SHAP](https://christophm.github.io/interpretable-ml-book/shap.html)：參考個案到整體的圖解順序，支持平均絕對貢獻公式。

## 小結

- 指引把SHAP列為高風險模型的解釋工具。
- 基準與貢獻先在同一尺度加總。（補充）
- 單筆看方向，多筆平均絕對值看幅度。（補充）
- 背景、相關性與輸出類別都是解釋的一部分。（補充）
