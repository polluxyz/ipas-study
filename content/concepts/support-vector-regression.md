---
id: support-vector-regression
title: 支援向量迴歸
kind: model
codes: [L23202]
aliases: [SVR, ε 容忍帶]
requires: [support-vector-machine]
guide_refs: [guide-3:4-17, guide-3:4-18, guide-3:4-19]
summary: 在ε容忍帶內不計預測誤差，以帶外代價和函數平滑程度共同決定迴歸模型
goals:
  - id: g1
    text: 由容忍帶圖、模型式與C、ε、核函數判斷SVR行為及使用成本
formula_groups:
  - id: svr-loss
    source: guide-3:4-17
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-A
  - id: svr-kernel
    source: guide-3:4-18
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某房屋的SVR候選預測75、實際60，ε=5。這筆資料對ε不敏感損失的貢獻為多少？
    options:
      A: "0"
      B: "15"
      C: "225"
      D: "10"
    answer: D
    explain:
      A: 誤差15超出容忍半寬5，所以不能忽略。
      B: 15是絕對誤差，帶內的5不應計入損失。
      C: 225是平方誤差，並非本頁的帶外線性損失。
      D: max(0,15−5)=10，只計算超出容忍帶的部分。
  - id: c2
    goal: g1
    type: choice
    prompt: 用相同60筆已縮放資料、相同核函數和ε訓練SVR，將C由1改成100。最合理的描述是什麼？
    options:
      A: 帶外誤差代價提高，可能更貼資料，也需留意過擬合
      B: 容忍帶半寬變100倍，所有點都更容易落入容忍帶
      C: 核函數自動轉成線性，所以模型解釋性一定會提高
      D: 帶外誤差代價降低，模型必定只留下截距作為預測
    answer: A
    explain:
      A: C乘在帶外誤差上，增加後更重視降低此項，但不保證泛化改善。
      B: 容忍半寬由ε決定，C並不直接改變它。
      C: 核函數必須明確設定，調整C不會自動換核。
      D: C增加是提高帶外誤差代價，不是降低。
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊有80筆能源樣本、4個數值欄，關係彎曲。下一步如何比較核SVR較合適？
    options:
      A: 全部80筆先fit縮放，再以測試結果選C和γ並回報
      B: 先留測試列，訓練內縮放並驗證C、ε與核參數
      C: 不做任何縮放，因為核函數會自動消除欄位單位
      D: 只提高γ到極大，因為曲線越彎測試誤差必定越低
    answer: B
    explain:
      A: 全資料縮放與反覆使用測試選參數，會破壞獨立評估。
      B: 非線性核是可比較的候選，參數與前處理需放在訓練內驗證。
      C: 核距離仍受尺度影響，不能假設單位自動消失。
      D: 過大的γ可能造成過度局部的擬合，仍須驗證。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

預測能源消耗時，有些小誤差可以接受，未必值得為它們把曲線彎得很複雜。支援向量迴歸（SVR，Support Vector Regression）以ε容忍帶表達這個取捨。

它是支援向量機的迴歸延伸，不把每個殘差都平方，而是重視超出容忍帶的部分。配合核函數，可處理原始輸入與目標之間的非線性關係。

## 直覺

把預測函數上下各留ε的空間。點落在帶內，誤差項不付代價；點超出邊界，只對超出的距離付代價。

![教學候選線上下各留5個價格單位；H09與H21超出帶各10，恰好在邊界的點損失為0。](figure:l23202-support-vector-regression-tube)

:::supplement[來源：scikit-learn SVR核函數比較教學]
圖只用六筆房屋的面積與目標，畫出候選函數 $f(a)=2a+15$；沒有使用屋齡，也不宣稱是訓練後的最適SVR。
:::

## 定義與公式

線性輸入時，預測函數為 $f(x)=w^\top x+b$。$x$是特徵向量，$w$是權重，$b$是截距；使用核函數時可改寫為特徵映射$\phi(x)$上的線性函數。

:::supplement[來源：scikit-learn SVM User Guide 1.4.7.2]
把指引的鬆弛變數形式，寫成等價的ε不敏感損失：

$$
\begin{aligned}
\ell_\varepsilon(y,f(x))&=\max(0,|y-f(x)|-\varepsilon),\\
\min_{w,b}\quad &\frac12\|w\|^2+C\sum_{i=1}^{n}\ell_\varepsilon(y_i,f(x_i))
\end{aligned}
$$

$n$是訓練筆數，$y_i$是目標，$C>0$是帶外損失權重，$\varepsilon\ge0$是容忍帶的半寬。$\|w\|^2$限制函數的複雜度；截距不在此懲罰中。

指引的 $\xi_i,\xi_i^*$ 分別記錄兩個方向的帶外距離。最適時兩者合計等於上式的$\ell_\varepsilon$，並不是把所有殘差都算進去。
:::

### 核函數預測

指引把核模型寫成支援樣本的加權和：

$$
f(x)=\sum_{i=1}^{n}a_iK(x_i,x)+b
$$

$x_i$是訓練樣本，$K$是核函數，$a_i$是該樣本的組合係數，$b$是截距。線性核處理線性關係，RBF等核可表達非線性；不是所有核都一定產生彎曲預測。

:::supplement[來源：scikit-learn SVM User Guide 1.4.7.2]
精確地說，$a_i=\alpha_i-\alpha_i^*$；非支援向量的係數為0，所以只需加總支援向量。這裡的$a_i$不是Lasso API的alpha懲罰強度。
:::

## 算一次（補充）

取圖中的候選函數 $f(a)=2a+15$、ε=5。六筆房屋的預測是35、55、75、95、115、135，實際40、50、60、100、110、120。

絕對誤差為5、5、15、5、5、15，扣掉帶內的5再取非負值，得到0、0、10、0、0、10。帶外損失總和為20。

C=2、w=2時，目標值為 $\frac12\times2^2+2\times20=42$。若C=10，同一函數的代價變202；重新訓練時可能改變函數以降低帶外代價。

核式也能算同一函數：取面積10、係數0.2、核 $K(u,v)=uv$、截距15。新面積20時，$f(20)=0.2\times200+15=55$。

這只展示一般核展開，不代表訓練所得的SVR對偶係數。標準含自由截距的SVR要求係數和為0；這個單項候選例不滿足該限制，也未宣稱最適。

能源目標固定放大3倍加100時，同一圖示的預測與容忍半寬也需換單位：ε由5變15，總帶外距離由20變60。這是單位換算；實際重新訓練還要重新驗證C等參數。

## 程式（補充）

重建與其他迴歸模型相同的80筆資料。固定60筆訓練、20筆測試，縮放與SVR包在同一Pipeline。

```python
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.metrics import mean_squared_error

i = np.arange(80)
a, z, v = (10+7*i%51).astype(float), (5+3*i%21).astype(float), 11*i%17-8
y = 20+2*a-z+20*(a>35)+(13*i%9-4)
h = [0,4,8,12,16,20]
a[h], z[h], y[h] = [10,20,30,40,50,60], [5,10,5,10,5,10], [40,50,60,100,110,120]
X = np.column_stack([a,a,z,v]); tr, te = i[i%4!=3], i[i%4==3]
print("筆數", len(tr), len(te))
```
```text
筆數 60 20
```

```python
m = make_pipeline(StandardScaler(), SVR(C=100, epsilon=5, kernel="rbf", gamma="scale"))
m.fit(X[tr], y[tr])
print("測試MSE", round(mean_squared_error(y[te], m.predict(X[te])), 3))
print("手算帶外總和", np.maximum(0, np.abs(y[h]-(2*a[h]+15))-5).sum())
```
```text
測試MSE 37.715
手算帶外總和 20.0
```

:::tip[讀碼重點]
只縮放X，故epsilon=5仍是5個原目標單位。此組參數用來示範，並非從測試集挑選；SVR本身此處無隨機種子，資料切分與其他頁相同。
:::

## 怎麼用、怎麼判讀

| 設定 | 增加時的主要作用 | 取捨 |
|---|---|---|
| C | 帶外誤差更貴 | 可能更貼訓練資料，也更易過擬合 |
| ε | 容忍帶變寬 | 可忽略更多小誤差，也可能欠擬合 |
| 核函數 | 改變可表示的關係 | 非線性核較難直觀解釋 |
| RBF的γ（補充） | 單個樣本影響範圍更局部 | 過大可能形成細碎擬合 |

SVR適合中小資料與非線性關係；大型資料或高維時需衡量訓練資源。指引也列出對離群值有一定抵抗力的使用目的。

### 模型假設

指引4-18說明SVR不要求誤差常態，也不強制輸入與目標呈線性關係；同頁另將資料「可分或近似可分」列為假設。

:::supplement[來源：scikit-learn SVM User Guide 1.4.7.2]
「可分」是分類的用語，不是SVR的必要前提。SVR以容忍帶和帶外損失處理連續目標，允許部分觀測留在帶外；仍須驗證核函數與參數是否合適。
:::

:::supplement[來源：scikit-learn SVR API；SVM User Guide 1.4.5]
帶內忽略小誤差不等於忽略離群值。遠處目標仍有帶外代價；SVR並不保證對所有離群值穩健。輸入尺度也會影響核距離，應以訓練資料縮放。

LIBSVM的核SVR訓練成本可能超過樣本數平方，實際依資料、核與設定而變；指引的平方成長宜作成本警訊，不當成精確且固定的公式。
:::

### 換個場景

| 場景／資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 中小資料、維度不過高 | 比較SVR與簡單基準 | 同時量測成本 |
| 非線性、有一定抗離群需求 | 比較核與容忍帶設定 | 不宣稱完全不受異常影響 |
| 房價估計（補充） | 以價格單位設定ε | 看可接受誤差是否符合業務 |
| 工廠能源（補充） | 以耗電單位比較C、ε | 各感測欄先縮放 |
| 醫療數值（補充） | 預測連續檢測數值 | 驗證誤差與容許範圍需對齊 |

## 常見誤解

- **ε是整條帶的寬度。** ε是上下各自的半寬，總寬為2ε。（補充）
- **C越大，正則化越強。** C越大是帶外誤差代價越高，與Ridge λ的方向不同。（補充）
- **迴歸資料必須線性可分。** 可分是分類的用語，SVR允許帶外誤差，不要求所有點都在帶內。（補充）

## 進階

### 容忍帶不是信賴區間（補充）

ε是訓練者選擇的損失容忍度，不是用95%等涵蓋機率估計出的區間。要回答預測的不確定性，需要另外的方法與評估。

### 參考來源

- 科目3指引`guide-3:4-17`～`guide-3:4-19`：預測式、鬆弛變數、參數、核、場景與限制；公式已對照PDF。
- [SVM User Guide 1.4.7.2](https://scikit-learn.org/stable/modules/svm.html#svr)：等價損失、核係數與補充校正。
- [SVR API](https://scikit-learn.org/stable/modules/generated/sklearn.svm.SVR.html)：參數、訓練成本與程式。
- [SVR核比較教學](https://scikit-learn.org/stable/auto_examples/svm/plot_svm_regression.html)：以同一批資料比較不同核的圖示思路。

## 小結

- SVR只對超出ε容忍帶的距離計算帶外損失。
- C控制帶外代價，ε控制半寬，核控制可表示的關係。
- 非線性核需評估縮放、參數與訓練成本。
- 容忍帶不是信賴區間，也不保證對所有離群值穩健。（補充）
