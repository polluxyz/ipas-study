---
id: "bagging"
title: "Bagging 策略"
kind: "technique"
codes: ["L23202"]
aliases: ["Bootstrap Aggregating"]
requires: ["ensemble-models"]
guide_refs: ["guide-3:4-36", "guide-3:4-37"]
summary: "對訓練資料有放回重抽樣，分別建模後平均或投票，降低預測變動"
goals:
  - id: "g1"
    text: "解釋重抽樣、分別訓練與整合，並辨認樹相關性對降低變異的限制"
contrasts:
  - target: "boosting"
    note: "Bagging重抽後分別擬合；Boosting依既有模型的不足逐輪修正"
    source: ["guide-3:4-37"]
formula_groups:
  - id: "mean"
    source: "https://scikit-learn.org/stable/modules/ensemble.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK-W-L23202-E"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "團隊有60筆訓練資料，為3個模型各有放回抽60次。哪個流程符合Bagging？"
    options:
      A: "三份子集可有重複，分別訓練後平均連續預測"
      B: "三份子集互不重複，依上輪殘差接續訓練"
      C: "每輪只留錯誤資料，再以最後一個模型預測"
      D: "每輪修改驗證標籤，再以驗證正確率作權重"
    answer: "A"
    explain:
      A: "有放回抽樣後分別建模、整合預測，符合此策略。"
      B: "互斥分割與逐輪殘差都不是這裡的重抽樣流程。"
      C: "Bagging不要求每輪只訓練錯誤樣本。"
      D: "驗證標籤不能為了模型而改寫。"
  - id: "c2"
    goal: "g1"
    type: "choice"
    prompt: "3棵樹對一房屋預測100、110、120；對一授信案硬類別為違約、違約、正常。等權整合結果是？"
    options:
      A: "房價120、違約；只取最大值與最多票"
      B: "房價110、正常；平均價格並取少數票"
      C: "房價110、違約；平均價格並取多數票"
      D: "房價100、正常；只取最小值與最少票"
    answer: "C"
    explain:
      A: "迴歸等權整合用平均，不選最大價格。"
      B: "兩票違約多於一票正常。"
      C: "價格平均110，分類硬投票選違約。"
      D: "最小價格與少數票都不是指定整合規則。"
  - id: "c3"
    goal: "g1"
    type: "choice"
    prompt: "把3個完全相同的房價模型複製成30個，所有房屋的誤差仍完全相同。何者合理？"
    options:
      A: "模型數成為10倍，驗證誤差必降到原來十分之一"
      B: "副本沒有互補誤差，平均後仍保留相同的預測"
      C: "模型數超過訓練筆數前，平均預測都不合法"
      D: "副本改用不同名稱，彼此誤差就會統計獨立"
    answer: "B"
    explain:
      A: "模型數量不能保證按比例降低實際驗證誤差。"
      B: "完全相同的數值取平均仍是原數值。"
      C: "模型數不受這種筆數上限限制。"
      D: "名稱不改變誤差相關性。"
textbook: "v2"
author: "codex"
status: "draft"
---

## 為什麼需要

一棵很深的樹可能因幾筆訓練資料換掉，就長出不同分支。Bagging策略（Bootstrap Aggregating）以多次重抽樣建立不同模型，再整合預測，減少這類變動。

它著重降低變異，而非保證消除所有誤差。若模型共同漏掉同一種規律，平均仍可能預測不準。

## 直覺

先固定訓練資料，再各自抽出一份訓練版本。每個模型看的是不同版本，可以分別訓練；彼此不必等待上一個模型的答案。

![同一訓練集分成三條重抽樣與訓練路徑，最後才整合；路徑之間沒有逐輪修正箭頭。](figure:l23202-bagging-parallel)

:::supplement[來源：INRIA Bagging課程]
有放回表示抽到的樣本放回後仍可再抽。抽60次不等於抽到60個不同樣本，也不會自動產生新的真實個案。
:::

## 定義與公式

Bagging包含「重抽樣建立基模型」和「整合輸出」兩個步驟。分類可作多數投票；迴歸則平均連續數值。

:::supplement[來源：scikit-learn Ensembles §Bagging meta-estimator]
等權迴歸的整合式為：

$$
\hat y(x)=\frac{1}{B}\sum_{b=1}^{B}h_b(x)
$$

$x$是同一筆輸入，$B$是模型數，$h_b(x)$是第$b$個模型的預測。三個示意模型給100、110、120時，平均為$(100+110+120)/3=110$。
:::

## 走一次流程

### 房價與授信的共用資料（補充）

本組房價與授信各100筆，固定索引0–99與種子23202。索引除以5的餘數0、1、2作訓練，餘數3作驗證，餘數4保留測試，共60／20／20筆。

1. 只從60筆訓練資料有放回抽60次，重複三遍。
2. 各自擬合一棵深度最多2的樹，不讀驗證目標來擬合。
3. 對同一驗證房屋，三樹輸出約102.929、100.250、56.296；完整精度平均為86.492。
4. 換成授信分類，若三個硬類別為違約、違約、正常，多數票選違約。

授信票數沿用前置教材的示意規則；86.492是本組實際訓練結果。示意投票不冒充實測模型輸出。

## 程式（補充）

以下重建共用房價資料；區域以0、1、2作教學編碼，價格單位為教學價格點。

```python
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import BaggingRegressor
i = np.arange(100)
a, g, z = 10+i*7 % 51, 5+i*3 % 21, i//10 % 3
X = np.column_stack([a, g, z])
y = 3*a-g+20*z+25*(a>35)+(i*5 % 9-4)
tr, va = i[i % 5 < 3], i[i % 5 == 3]
m = BaggingRegressor(DecisionTreeRegressor(max_depth=2),
    n_estimators=3, random_state=23202, n_jobs=1).fit(X[tr], y[tr])
print("驗證前三筆", np.round(m.predict(X[va[:3]]), 3).tolist())
print("抽樣位置", m.estimators_samples_[0][:10].tolist())
```
```text
驗證前三筆 [86.492, 56.219, 176.843]
抽樣位置 [25, 17, 1, 31, 44, 26, 17, 10, 44, 31]
```

:::tip[讀碼重點]
`estimators_samples_`是訓練陣列中的位置，不是原始100筆索引。位置17重複出現，直接展示有放回抽樣；`n_jobs=1`固定實測條件，不代表策略不能並行。
:::

## 怎麼用、怎麼判讀

適合把容易隨樣本變動的基模型整合。指引以隨機森林作代表，但Bagging不限定基模型一定是樹。

:::supplement[來源：INRIA Bagging課程；scikit-learn Ensembles]
模型可以分別訓練，不等於預測誤差在統計上獨立。誤差越相似，平均可抵銷的部分越少；強烈偏差也不會因副本增加而自然消失。
:::

### 換個場景

| 場景／資料條件 | 如何整合 | 判讀重點 |
|---|---|---|
| 分類、基模型不穩定 | 多數投票或機率整合 | 觀察變異是否降低 |
| 房價（補充） | 連續價格平均 | 固定相同驗證房屋 |
| 授信（補充） | 違約類別或機率整合 | 少數違約不能只看準確率 |
| 製造瑕疵（補充） | 多個檢測器整合 | 共犯錯誤仍會保留 |

## 常見誤解

- 重抽樣是重新使用訓練資料，不是切成互斥的三份。（補充）
- 「分別建模」不代表統計獨立，也不保證每個模型錯在不同地方。（補充）
- 分類投票與迴歸平均的輸出意義不同。
- 降低變異是傾向，仍須用未參與訓練的資料驗證。（補充）

## 進階

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-36`～`guide-3:4-37`：支持集成分類、Bagging及降低變異的定位。
- [scikit-learn Ensembles](https://scikit-learn.org/stable/modules/ensemble.html)：支持平均公式、基模型與API。
- [INRIA Bagging課程](https://inria.github.io/scikit-learn-mooc/python_scripts/ensemble_bagging.html)：參考由單樹波動引入重抽樣的教學順序，支持相關性限制。

## 小結

- 先重抽樣、分別建模，最後才整合。
- 迴歸平均數值，分類可投票。
- 模型彼此太相似時，增加數量的收益有限。（補充）
