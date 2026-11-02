---
id: "optimization-problem"
title: "最佳化目標與決策變數"
kind: "theory"
codes:
  - "L23103"
aliases:
  - "Decision Variables"
  - "Objective Function"
  - "目標函數"
summary: "目標函數規定解的優劣，決策變數是求解時要調整的數值"
goals:
  - id: "g1"
    text: "依迴歸、分類與排序任務區分樣本損失、平均損失、加權與正則項"
  - id: "g2"
    text: "辨識權重、偏差、機率參數與超參數，追蹤一次參數更新"
requires:
  - "optimization-for-models"
guide_refs:
  - "guide-3:3-18"
  - "guide-3:3-19"
  - "guide-3:3-21"
  - "guide-3:3-22"
textbook: "v2"
author: "codex"
status: "draft"
formula_groups:
  - id: "training-objective"
    source: "https://www.deeplearningbook.org/contents/optimization.html ; https://numpy.org/doc/stable/reference/generated/numpy.average.html ; https://www.deeplearningbook.org/contents/regularization.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK2-W-L23103-A"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "房價模型在 6 筆資料上的平方誤差總和為 12；總體目標定義為平均資料損失加 0.3 的正則項，所有樣本權重相同。總體目標是多少？"
    options:
      A: "12.3"
      B: "2.0"
      C: "2.3"
      D: "0.3"
    answer: "C"
    explain:
      A: "此處資料損失採平均，須先用 12 除以 6。"
      B: "2.0 只包含平均資料損失。"
      C: "平均損失為 2，加正則項後為 2.3。"
      D: "正則項之外仍要計入資料損失。"
  - id: "c2"
    goal: "g2"
    type: "choice"
    prompt: "能源模型目前 (w,b)=(0,0)，梯度為 (−8/3,−2)，學習率為 0.25。一般的一次訓練更新會發生什麼？"
    options:
      A: "權重變 2/3、偏差變 1/2，學習率仍為 0.25"
      B: "權重變 −2/3、偏差變 −1/2"
      C: "溫度資料各減 0.25，參數不變"
      D: "把學習率學成 2/3，權重仍為 0"
    answer: "A"
    explain:
      A: "以參數減去學習率乘梯度，超參數在這次更新中固定。"
      B: "最小化時要減梯度，負梯度分量會使參數增加。"
      C: "固定的觀測輸入不是這次求解的決策變數。"
      D: "學習率控制更新大小，這次並未把它當成可訓練參數。"
---

## 為什麼需要

房價預測希望數值接近成交價，分類希望真實類別獲得合理機率，排序希望相關項目排得較前。先把「好」寫清楚，求解程序才有方向。

目標函數（Objective Function）回答如何評分；決策變數（Decision Variables）回答哪些數可以調。兩者缺一，都還不是完整的最佳化問題。

## 直覺

固定六筆能源觀測，換一組權重與偏差就會得到另一批預測。目標把每筆預測的好壞彙整成一個數，讓兩組參數能比較。

指引有時把目標函數與損失函數合稱。本頁用「樣本損失」指一筆的誤差，用「總體目標」指訓練真正最小化的整體數值。

| 任務 | 指引列出的搭配 | 關注的對象 |
|---|---|---|
| 迴歸 | 均方誤差 | 連續數值的偏離 |
| 分類 | 交叉熵損失 | 標籤對應的預測機率 |
| 排序／配對 | 排序損失、對比損失 | 項目次序或表示的相近程度 |

:::supplement[來源：Deep Learning 第 8.1 節]
對比損失常學相似與不相似配對的距離，排序損失則直接處理相對順序；不能把所有配對目標都當成同一種排名公式。
:::

## 定義與公式（補充）

本頁把 NumPy average 的加權平均，與 Deep Learning 7.1 的加法正則項組合為總體目標：

$$
\ell_i(\theta)=\ell(f_\theta(x_i),y_i),\qquad
J(\theta)=\frac{\sum_{i=1}^{n}a_i\ell_i(\theta)}{\sum_{i=1}^{n}a_i}+\lambda R(\theta)
$$

$x_i,y_i$ 是第 $i$ 筆輸入與答案，$f_\theta$ 是模型，$\theta$ 是待學參數。$a_i$ 是非負樣本權重，且總和須大於零。

$R$ 是正則項，$\lambda\geq0$ 控制其強度。改變 $\lambda$ 會改變資料擬合與參數偏好的取捨。

全部 $a_i=1$ 時，前項就是 $n$ 筆損失的平均。加權指定樣本重要性，正則項表達對參數的偏好。

## 算一次

### 共用資料與目標比較（補充）

共用模型是 $\hat y=wx+b$，其中 $w$ 為權重、$b$ 為偏差。六筆輸入是 $(-1,0,1,-1,0,1)$，答案是 $(-1,1,3,-1,1,3)$。

| 候選 $(w,b)$ | 六筆平方誤差 | 平均 $J$，未加正則 |
|---|---|---|
| $(0,0)$ | $1,1,9,1,1,9$ | $22/6=11/3$ |
| $(1,1)$ | $1,0,1,1,0,1$ | $4/6=2/3$ |
| $(2,1)$ | 全部為 0 | $0$ |

令 $R=|w|+|b|$、$\lambda=0.1$，則 $(1,1)$ 的總體目標為 $2/3+0.2=0.8667$，$(2,1)$ 則是 $0+0.3=0.3$。

若把兩筆 $x=1$ 的樣本權重都改成 2，$(1,1)$ 的資料損失改為 $6/8=0.75$，加同一正則項後是 0.95。這示範了權重與分母約定會改變比較值。

### 誰被更新

| 物件 | 例子 | 這次訓練的角色 |
|---|---|---|
| 模型參數 | 線性模型與神經網路的權重、偏差 | 從資料學得 |
| 機率參數 | 一個分類條件下各結果的機率 | 從資料估計，需符合機率限制 |
| 超參數（補充） | 學習率、正則強度 | 先設定，再用驗證集選擇 |
| 觀測資料 | 溫度、成交價 | 固定的學習依據 |

:::supplement[來源：Deep Learning 第 8.1 節；Dive into Deep Learning 12.3]
初始 $(w,b)=(0,0)$ 時，梯度為 $(-8/3,-2)$。用學習率 0.25 更新，得到 $(2/3,1/2)$；原始溫度、答案與學習率在這一步都沒被學成新值。

指引把生成模型的潛在變數也列為例子。應依程序區分：某筆資料的潛在表示可能在推論時求解，不一定是所有樣本共用、訓練後保存的模型參數。
:::

## 程式（補充）

```python
import numpy as np
x = np.array([-1, 0, 1, -1, 0, 1])
y = np.array([-1, 1, 3, -1, 1, 3])
for w, b in [(0., 0.), (1., 1.), (2., 1.)]:
    loss = (w*x+b-y)**2
    weights = np.where(x == 1, 2., 1.)
    print((w, b), "平均", round(float(loss.mean()), 4),
          "加權與正則", round(float(np.average(loss, weights=weights)+.1*(abs(w)+abs(b))), 4))
```
```text
(0.0, 0.0) 平均 3.6667 加權與正則 5.0
(1.0, 1.0) 平均 0.6667 加權與正則 0.95
(2.0, 1.0) 平均 0.0 加權與正則 0.3
```

:::tip[讀碼重點]
程式每一組參數都重算相同六筆資料；加權平均的分母是權重總和 8。0.1 是正則強度，不是更新參數的學習率。
:::

## 怎麼用、怎麼判讀

先依迴歸、分類、排序或配對任務選損失，再辨認模型中要學的權重、偏差或機率參數。最後確認目標採總和還是平均，是否加權或含正則項。

### 換個場景

| 場景 | 條件 | 判讀 |
|---|---|---|
| 迴歸／分類／排序 | 指引列出的不同輸出任務 | 損失要配合學習要求 |
| 線性／神經／機率模型 | 指引列出的不同變數形式 | 列出實際更新對象 |
| 能源預測（補充） | 每筆耗電誤差採平方 | 高耗電樣本加權會改目標 |
| 房價預測（補充） | 同一模型改用萬元或元 | 先固定尺度才比較目標值 |
| 文件配對（補充） | 要學相關文件靠近 | 配對距離不等於最終排名品質 |

## 常見誤解

- 六筆資料不代表只有六個參數，參數數量由模型結構決定。
- 樣本損失、平均損失與含正則項的總體目標需分清。（補充）
- 學習率控制求解路徑，正則強度改變目標，兩者作用不同。（補充）

## 進階

### 參考來源

- 科目 3 指引 3.3，guide-3:3-18、guide-3:3-19、guide-3:3-21、guide-3:3-22（版本未標示）：支持任務搭配、變數形式及損失偏好。
- [Deep Learning 8.1](https://www.deeplearningbook.org/contents/optimization.html)：支持樣本損失、經驗平均與更新對象的區分。
- [NumPy average](https://numpy.org/doc/stable/reference/generated/numpy.average.html)：支持「定義與公式」中以權重總和為分母的加權平均。
- [Deep Learning 7.1，式 7.1](https://www.deeplearningbook.org/contents/regularization.html)：支持「定義與公式」中另加正則項；完整目標由加權平均與此項組合。
- [scikit-learn Linear Models](https://scikit-learn.org/stable/modules/linear_model.html)：支持 L1 正則目標。
- [Dive into Deep Learning 3.1](https://d2l.ai/chapter_linear-regression/linear-regression.html)：參考從單筆平方誤差逐步合成平均的教法。

## 小結

- 目標定義優劣，決策變數指定要調的數。
- 迴歸、分類、配對與排序要選合適的損失。
- 平均、樣本加權與正則項各自有不同作用。（補充）
