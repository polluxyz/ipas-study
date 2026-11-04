---
id: logistic-regression
title: 邏輯迴歸
kind: model
codes: [L23202, L21301]
aliases: [Logistic Regression, 羅吉斯迴歸]
requires: [classification-regression, conditional-probability]
contrasts:
  - target: support-vector-machine
    note: 邏輯迴歸將線性分數轉成機率；SVM以間隔決定邊界，核方法可表達非線性
    source:
      - guide-3:4-25
      - guide-3:4-26
      - guide-3:4-28
summary: 邏輯迴歸把線性分數轉成類別機率，再依閾值做分類
goals:
  - id: g1
    text: 由線性分數得到二元機率，依閾值判斷類別並區分多類別輸出
  - id: g2
    text: 代入sigmoid與log-odds，解釋線性邊界及係數的限制
formula_groups:
  - id: sigmoid
    source: guide-3:4-26
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: logit
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.logit.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23202-B
  - id: threshold-boundary
    source: https://staff.fnwi.uva.nl/r.vandenboomgaard/MachineLearning/LectureNotes/Classification/LogisticRegression/LogRegrModel.html
    status: pending
    checked_by: null
guide_refs: [guide-1:5-8, guide-3:4-26, guide-3:4-27, guide-3:4-28]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 金融模型對某客戶給出線性分數z=1，正類為違約。依sigmoid，閾值從0.5提高為0.8，類別如何改變？
    options:
      A: 機率約0.731，原判違約，調高後判未違約
      B: 機率約0.269，原判違約，調高後判未違約
      C: 機率約0.731，原判未違約，調高後判違約
      D: 機率等於1.000，兩次都判違約且不會出錯
    answer: A
    explain:
      A: 1除以1加e的負一次方約0.731，介於兩個閾值之間。
      B: 0.269對應分數負1，並非這裡的正類機率。
      C: 提高正類閾值不會讓這筆原本的負類轉成正類。
      D: 有限分數1不會產生機率1，也沒有完全正確的保證。
  - id: c2
    goal: g2
    type: choice
    prompt: 指定模型z=−1−x₁+x₂，收入座標x₁=2、負債座標x₂=4。log-odds與odds分別為何？
    options:
      A: log-odds約0.731，odds約2.718
      B: log-odds等於1.000，odds約0.731
      C: log-odds等於1.000，odds約2.718
      D: log-odds約2.718，odds等於1.000
    answer: C
    explain:
      A: 0.731是機率，不是勝算的自然對數。
      B: 0.731是機率，勝算為機率除以一減機率。
      C: 線性分數等於log-odds為1，取指數後odds為e。
      D: 這把取對數之前與之後的量顛倒。
  - id: c3
    goal: g1
    type: choice
    prompt: 製造資料有正常、壓力異常、振動異常三個互斥標籤，每筆只屬於一類。要延伸邏輯迴歸，何者合理？
    options:
      A: 用單一sigmoid輸出，再宣稱一個機率已代表三類
      B: 用多項邏輯迴歸輸出三類機率，或採一對其餘策略
      C: 用標籤0、1、2的平均值，當作每筆的三類機率
      D: 用三個未正規化分數，直接宣稱它們總和必為1
    answer: B
    explain:
      A: 單一二元機率只描述一個事件及其互補事件。
      B: 多項（multinomial）邏輯迴歸可用softmax，一對其餘則組合多個二元問題。
      C: 類別代碼的平均不會形成每類的機率分布。
      D: 分數需經相應轉換，不能直接宣稱符合機率總和。
---

## 為什麼需要

銀行想知道客戶是否違約，也想知道模型認為違約有多可能。直接用線性迴歸預測0或1，輸出可能超出機率範圍。

邏輯迴歸（Logistic Regression）先算線性分數，再轉成0到1之間的機率。名稱有「迴歸」，本頁的任務卻是分類。

## 直覺

分數像一條風險刻度：越大越偏正類。Sigmoid把很小的分數壓近0、很大的分數壓近1，分數0則對應機率0.5。

![看橫軸的分數如何轉成縱軸機率；分數1對應約0.731，並不是機率1。](figure:l23202-logistic-regression-sigmoid)

機率與決策要分開。相同機率可以因閾值不同而得到不同類別；正類在本例固定為違約。

## 定義與公式

### 線性分數與sigmoid

$$
z=\beta_0+\sum_{j=1}^{d}\beta_jx_j,\qquad
p=P(y=1\mid x)=\frac{1}{1+e^{-z}}
$$

$x_j$是第$j$個特徵，$d$是特徵數，$\beta_j$是係數，$\beta_0$是截距。$z$為線性分數，$p$是給定特徵後的正類機率；有限$z$對應$0<p<1$。

指引用對數勝算（log-odds，指引稱對數勝率）的線性關係說明假設。勝算odds是正類機率除以負類機率，不是機率本身。指引只給文字定義，下方式子為補充。

:::supplement[來源：SciPy scipy.special.logit]

$$
\log\frac{p}{1-p}=z,\qquad \frac{p}{1-p}=e^z
$$

$\log$在這裡是自然對數。若$z=1$，勝算為$e\approx2.718$，機率仍只有約0.731。
:::

### 閾值與線性邊界（補充）

約定$p\ge t$判正類。以下假設閾值$0<t<1$，且特徵係數向量$(\beta_1,\ldots,\beta_d)\ne0$。

基礎定義參考SciPy logit；邊界式為本頁推導。令$p=t$，由sigmoid反解得到：

$$
\beta_0+\sum_{j=1}^{d}\beta_jx_j=\log\frac{t}{1-t}
$$

$t=0.5$時右邊為0；$t=0.8$時為$\log4\approx1.386$。在上述條件下，固定係數改閾值會使超平面平行平移，不會讓它突然彎曲。

二維時，只有在$\beta_2\ne0$時，才能解成$x_2=(\log(t/(1-t))-\beta_0-\beta_1x_1)/\beta_2$。

## 算一次

### 金融共用座標（補充）

金融90筆的收入座標為「收入減20，再除以10」，負債座標為「負債除以100」，原值皆以千元表示。這是固定單位換算，並非用全資料估計標準化。

手算指定$\beta_0=-1$、收入係數$-1$、負債係數$1$。這組係數用來拆解概念，不是後面四特徵模型擬合出的係數。

| 樣本 | 收入、負債座標 | 分數與機率 |
|---|---|---|
| F011 | 2、1 | $z=-2$，$p\approx0.1192$ |
| F020 | 2、2 | $z=-1$，$p\approx0.2689$ |
| F038 | 2、4 | $z=1$，$p\approx0.7311$ |

例如F038的$z=-1-2+4=1$，代入得到$p=1/(1+e^{-1})\approx0.7311$。閾值0.5時判違約；提高至0.8後判未違約，模型機率沒有因此改變。

![實線與虛線都是直線；提高正類閾值後，需要更高負債座標才會判為違約。](figure:l23202-logistic-regression-boundary)

## 程式（補充）

先重算手算分數。這段的係數固定，不做擬合。

```python
import numpy as np
X = np.array([[2., 1.], [2., 2.], [2., 4.]])
z = -1 + X @ np.array([-1., 1.])
p = 1 / (1 + np.exp(-z))
print("分數", z.tolist())
print("正類機率", np.round(p, 4).tolist())
print("閾值0.5", (p >= 0.5).astype(int).tolist())
print("閾值0.8", (p >= 0.8).astype(int).tolist())
print("log-odds", np.round(np.log(p / (1-p)), 4).tolist())
```
```text
分數 [-2.0, -1.0, 1.0]
正類機率 [0.1192, 0.2689, 0.7311]
閾值0.5 [0, 0, 1]
閾值0.8 [0, 0, 0]
log-odds [-2.0, -1.0, 1.0]
```

:::tip[讀碼重點]
`predict_proba`欄序要查`classes_`。本例負類0、正類1；scikit-learn的二元`predict`在分數0（機率0.5）時判負類，上方`p >= 0.5`則判正類。
:::

## 怎麼用、怎麼判讀

指引推薦二元結果、關係近似線性、資料量適中，以及金融或醫療需要解釋原因的情況。特徵高度相關時，係數可能不穩定，不能只看正負號就下結論。

離群值也可能拉動係數，要先查核極端輸入與資料品質。若原始特徵與log-odds的關係很複雜，這個簡單線性模型可能不足。

多類別可用一對其餘（One-vs-Rest），或多項（multinomial）邏輯迴歸以softmax產生總和為1的類別機率。單一sigmoid不能代表三個互斥類別。

:::supplement[來源：scikit-learn Logistic regression 1.1.11]
指引4-27把log-odds線性稱為「線性可分性」，容易誤讀。線性分數不要求資料完全分得開，也不要求特徵彼此獨立；相關性主要影響估計穩定與解釋。

指引另提到「變異數穩定」，也不宜當作必要假設。二元結果的變異隨機率改變，不能直接套用線性迴歸的等變異條件。
:::

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 是否購買、是否患病 | 二元機率再做分類 | 先固定正類與閾值 |
| 金融、醫療；特徵不過多 | 建立易解釋基準 | 檢查共線性與係數穩定 |
| 原始特徵近似線性 | 用簡單邊界預測 | log-odds線性，不是機率線性 |
| 製造瑕疵（補充） | 正常／瑕疵或故障種類 | 三類版需改用多類別輸出 |
| 客服升級（補充） | 預測需不需要升級處理 | 調閾值要考慮人工容量 |

## 常見誤解

- 分數1就是機率1：sigmoid後約為0.731。
- sigmoid曲線是彎的，所以原特徵的決策邊界必彎：機率轉換非線性；當$0<t<1$且特徵係數向量非零時，固定閾值邊界仍是超平面。（補充）
- 係數為正就證明因果：係數是給定其他特徵時的模型關係，仍受共線性與資料來源影響。（補充）

## 進階

### 係數變動的讀法（補充）

固定其他特徵，某特徵增加一單位，log-odds增加該係數；勝算乘上該係數的指數。例如負債座標增加1，勝算乘$e$，機率卻不固定增加同一幅度。

### 參考來源

- 科目1指引5.1，guide-1:5-8；科目3指引4.2，guide-3:4-26～4-28（版本未標示）：支持sigmoid、log-odds概念、多類別擴展與適用條件。
- [scikit-learn Logistic regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression)：支持sigmoid、二元與多項輸出、API及假設校正。
- [SciPy logit](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.logit.html)：支持logit的基礎定義及其與sigmoid的反函數關係；一般閾值邊界式為本頁令$p=t$後的推導。
- [阿姆斯特丹大學 Logistic Regression Model 6.3.1](https://staff.fnwi.uva.nl/r.vandenboomgaard/MachineLearning/LectureNotes/Classification/LogisticRegression/LogRegrModel.html)：直接列出含截距的線性分數等於0，並指明這是機率0.5的決策邊界；亦說明平行等位面上的機率固定。
- [scikit-learn 1.9.1 LinearClassifierMixin.predict原始碼](https://github.com/scikit-learn/scikit-learn/blob/1.9.1/sklearn/linear_model/_base.py)：核對二元分數須嚴格大於0才選`classes_[1]`的邊界約定。
- [INRIA Linear models for classification](https://inria.github.io/scikit-learn-mooc/python_scripts/logistic_regression.html)：參考分數、機率、邊界分開解釋的方式。

## 小結

- 線性分數經sigmoid得到正類機率。
- log-odds等於線性分數，odds與機率不同。
- 閾值改決策，多類別改輸出方式；係數解釋仍有條件。
