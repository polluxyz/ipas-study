---
id: l1-regularization
title: L1 正則化與 Lasso
kind: technique
codes: [L23304, L23202, L23301]
aliases: [L1 Regularization, L1 正則化]
requires: [regularization]
is_a: [regularization]
mitigates:
  - target: overfitting
    note: 絕對值懲罰可促進稀疏；過強會刪掉有效訊號而欠擬合。
    source: [guide-3:5-43, guide-3:5-44]
contrasts:
  - target: l2-regularization
    note: L1 可產生精確零權重，L2 主要平滑收縮，不以稀疏選取為目標。
    source: [guide-3:5-43, guide-3:5-44]
summary: L1 正則化懲罰權重的絕對值總和，促進稀疏，但相關特徵的選取可能不穩定
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-15, guide-3:4-16, guide-3:4-17, guide-3:5-43, guide-3:5-44]
goals:
  - id: g1
    text: 算出 L1 懲罰，解釋稀疏選取與 λ 過大造成欠擬合的風險
  - id: g2
    text: 用相關特徵的重抽樣權重，判斷選取穩定性並比較替代方法
formula_groups:
  - id: absolute-penalty
    source: guide-3:5-43
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服模型的權重為 [2, -1, 0.5]，資料損失為 0.8，lambda 為 0.2。依權重絕對值總和計算，懲罰項與總目標為何？
    options:
      A: 懲罰項 0.30，總目標 1.10
      B: 懲罰項 1.05，總目標 1.85
      C: 懲罰項 0.70，總目標 1.50
      D: 懲罰項 0.80，總目標 1.60
    answer: C
    explain:
      A: 0.30 是直接加帶符號權重後再乘 λ，負權重不能抵銷正權重的懲罰。
      B: 1.05 是平方和懲罰，屬於本組 L2 的計算。
      C: 絕對值加總為 3.5，乘 0.2 得 0.7，再加 0.8 得 1.5。
      D: 0.8 是題目給的資料損失，並不是權重的絕對值懲罰。
  - id: c2
    goal: g2
    type: choice
    prompt: 兩個面積欄位的相關係數約 0.9999。Lasso 在 5 次重抽樣中，分別保留第一、第二、第一、第二、第一欄。哪個結論較合理？
    options:
      A: 欄位選取不穩定，應搭配驗證誤差比較 Ridge 或 Elastic Net
      B: 第一欄出現較多次，因此足以斷定第一欄對房價具有因果效果
      C: 第二欄出現較少次，因此應視為量測錯誤並從原始資料中刪除
      D: 每次只選一欄，因此能保證任何重抽樣都選出相同的預測規律
    answer: A
    explain:
      A: 相似欄位可互相替代，重抽樣選取名單的變動應與預測表現分別檢查。
      B: 被選取次數只是這個訓練流程的統計，不能直接識別因果效果。
      C: 相關欄位較少入選不表示資料錯誤，需另查量測與業務意義。
      D: 相同稀疏程度不代表相同欄位或相同預測，仍須實際比較。
  - id: c3
    goal: g1
    type: choice
    prompt: 固定 72 筆訓練與 24 筆驗證資料，lambda 為 2 時三個斜率都變為零，兩邊 MSE 都高於 lambda 為 0.02 時。下一步較合理的是什麼？
    options:
      A: 刪除全部驗證資料，因為零斜率已證明不再過擬合
      B: 繼續提高 λ，因為零斜率表示特徵選取不足
      C: 直接用測試集調參，因為驗證結果已經失去比較價值
      D: 比較較小 λ，因為限制可能已壓掉有效訊號
    answer: D
    explain:
      A: 驗證資料仍是比較泛化表現的證據，不能因斜率變零而丟棄。
      B: 斜率已全為零，增強限制缺乏改善依據。
      C: 反覆用測試集選參數會破壞最後評估的獨立性。
      D: 訓練與驗證共同變差，應檢查 λ 過大造成的欠擬合。
---

## 為什麼需要

特徵很多時，不一定每個欄位都值得保留。L1 正則化（L1 Regularization）用權重的絕對值作懲罰，可讓部分權重變為零，得到較稀疏的模型。

Lasso 迴歸是把這種懲罰加入平方誤差的具體模型。本頁專看懲罰與選取限制，完整迴歸流程可接著讀 Lasso 迴歸。

## 直覺

權重變零後，該欄位在這個線性預測式中不再貢獻預測。這是特徵選擇的效果，與所有權重只是變小有所不同。

![三個限制區域共用相同座標尺度；L1 在座標軸上有尖角，L2 則是圓，混合限制兼有彎曲與尖角。](figure:l23304-l1-regularization-constraints)

:::supplement[來源：Hastie（2020）Ridge Regularization 第 1 節與圖 1；scikit-learn Linear Models 1.1.3、1.1.5]
圖比較兩個權重的限制形狀。L1 的菱形在座標軸上有尖角，幫助理解為何最佳化可能得到其中一個權重恰為零。

形狀只說明限制，不單獨決定答案；還要看資料損失。不能看到菱形就斷言一定刪掉某個特徵。
:::

## 定義與公式

$$
J_1(\mathbf w)=D(\mathbf w)+\lambda\sum_{j=1}^{d}|w_j|
$$

$D$ 是資料損失，$d$ 是受懲罰權重數，$w_j$ 是第 $j$ 個權重，$\lambda\geq0$ 是限制強度。絕對值使正負權重都產生非負懲罰。

增大 $\lambda$ 會更重視稀疏與小權重。若重要欄位也被壓到零，訓練與新資料都可能預測不好，形成欠擬合。

:::supplement[來源：scikit-learn Lasso API；Preprocessing data 8.3.1]
指引 4-15 使用殘差平方和（SSE）加懲罰。本頁改用半 MSE；整個目標同除以訓練筆數的兩倍後，指引的 λ 也要除以相同倍數，才有相同最優解。

本組使用一半的均方誤差（Mean Squared Error，MSE）作 $D$，截距不懲罰。特徵先以訓練資料的平均與標準差做標準化，避免單位大小左右懲罰效果。

稀疏解需要合適的求解方式；單靠固定步長的一般梯度下降，不能保證每個微小權重都精確變零。
:::

## 算一次

:::supplement[來源：scikit-learn Lasso API；L1-based models for Sparse Signals]

房價與客服沿用同一組固定權重 $[2,-1,0.5]$，資料損失都是 0.8，$\lambda=0.2$。

1. 取絕對值：$[2,1,0.5]$。
2. 加總得 $3.5$，懲罰是 $0.2\times3.5=0.7$。
3. 總目標為 $J_1=0.8+0.7=1.5$。

負權重也要付代價，所以不能把 $2-1+0.5$ 當成懲罰量。這是在固定權重上核算，不是套公式就能得到重訓後權重。

### 強度太大會怎樣（補充）

房價資料共 120 筆，固定用 72 筆訓練、24 筆驗證，其餘保留。重新訓練 Lasso 後：

| $\lambda$ | 斜率向量 | 訓練 MSE | 驗證 MSE |
|---|---|---:|---:|
| 0.02 | [0, 1.1191, 0.2615] | 1.5294 | 1.2685 |
| 0.2 | [0, 0.9247, 0.0671] | 1.6149 | 1.3352 |
| 2 | [0, 0, 0] | 2.8621 | 2.7610 |

λ＝2 讓模型只剩截距，訓練與驗證都變差。這是限制壓掉訊號的反例；欄位少不等於模型好。

驗證集只有 24 筆，樣本組成與雜訊會影響 MSE，數值可能低於訓練集。應比較同一切分下的變化，不能把兩者大小當成正則化的必然效果。
:::

### 共線欄位的重訓比較

指引 4-16 已提醒：高度相關的變數可能只保留其中一個。以下用補充的重抽樣實驗觀察選取是否穩定。

:::supplement[來源：scikit-learn Linear Models 1.1.3、1.1.5；L1-based models for Sparse Signals]

同一房價訓練集的兩個面積欄位相關係數約 0.9999。固定標準化與 $\lambda=0.2$，只在 72 筆訓練資料內重抽樣，每次仍抽 72 筆、允許重複。

| 抽樣種子 | 面積權重 | 總面積權重 | 屋齡權重 |
|---|---:|---:|---:|
| 11 | 0.4346 | 0 | 0 |
| 22 | 0 | 0.9593 | 0 |
| 33 | 0.9129 | 0 | 0.1123 |
| 44 | 0 | 0.9162 | 0.0759 |
| 55 | 0.7464 | 0 | 0.0017 |

同樣是稀疏解，留下的面積欄位會切換。不能因為某次權重為零，就說該欄位完全沒有資訊。

在相同五組抽樣下，Ridge 與 Elastic Net 都保留兩個面積欄位。這支持比較穩定性；不保證它們在其他資料上一定比較準。
:::

## 程式（補充）

執行前把環境變數 `IPAS_REPO_ROOT` 設為專案根目錄的絕對路徑。五頁程式都由它讀取共用例子，不依賴執行器的暫存工作目錄。

下列程式直接讀共用資料與已保存的抽樣索引。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.linear_model import Lasso
from sklearn.preprocessing import StandardScaler
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23304-C-penalties-dropout.json").read_text(encoding="utf-8"))
r = d["domains"]["housing"]; tr = d["split"]["train"]
X = np.array([[v[k] for k in r["features"]] for v in r["rows"]])
y = np.array([v["target"] for v in r["rows"]])
Z = StandardScaler().fit(X[tr]).transform(X)
for seed, ix in d["bootstrap_indices"].items():
    model = Lasso(alpha=0.2, max_iter=100000, tol=1e-10)
    model.fit(Z[ix], y[ix])
    print(seed, np.round(model.coef_, 4).tolist())
```
```text
11 [0.4346, 0.0, 0.0]
22 [0.0, 0.9593, 0.0]
33 [0.9129, 0.0, 0.1123]
44 [0.0, 0.9162, 0.0759]
55 [0.7464, 0.0, 0.0017]
```

:::tip[讀碼重點]
`alpha` 對應本頁的 lambda。固定原訓練集的標準化，是為了讓各次權重使用同一座標；這段隔離觀察抽樣影響，並非完整交叉驗證。
:::

## 怎麼用、怎麼判讀

指引把高維度、特徵多與自動特徵選擇列為主要用途。先看稀疏程度是否符合需求，再檢查驗證誤差；重要特徵被過度刪除時應降低限制。

:::supplement[來源：scikit-learn Linear Models 1.1.5；L1-based models for Sparse Signals]
若特徵高度相關，重抽樣比較選取名單、權重和預測誤差。需要保留相關資訊而不求稀疏時可比較 L2；兼顧稀疏與共同保留時可比較 Elastic Net。
:::

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 高維度、特徵數多 | 用稀疏性簡化模型，同時檢查欠擬合 |
| 房價估計（補充） | 面積與總面積可替代，檢查多次選取名單 |
| 客服情緒（補充） | 相似詞特徵不應只憑一次零權重刪除 |
| 製造感測（補充） | 精簡感測輸入前，保留驗證與穩定性證據 |

## 常見誤解

- **負權重可以抵銷正權重。** 絕對值使兩者都受到懲罰。
- **選得越少越好。** 過大的懲罰會把有效特徵一併壓掉。
- **零權重證明沒有因果作用。** 它只反映這份資料與模型的選取結果。（補充）
- **固定種子就解決選取不穩。** 可重現一次抽樣，不代表換資料也穩定。（補充）

## 進階

### 參考來源

- 科目 3 學習指引，版本未標示、本機快照：`guide-3:5-43`～`guide-3:5-44`；支持絕對值懲罰、特徵選擇與 λ 過大風險。
- 同指引 `guide-3:4-15`～`guide-3:4-17`：支持損失尺度、相關欄位可能只留其一，以及驗證選參數。
- [scikit-learn Lasso](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html)：支持目標尺度、截距與程式 API。
- [scikit-learn Linear Models 1.1.5](https://scikit-learn.org/stable/modules/linear_model.html#elastic-net)、[L1-based models for Sparse Signals](https://scikit-learn.org/stable/auto_examples/linear_model/plot_lasso_and_elasticnet.html)：支持相關特徵的比較與重訓教學設計。
- [Dive into Deep Learning 3.7.1](https://d2l.ai/chapter_linear-regression/weight-decay.html)：支持 L1 與 L2 限制差異的直覺。
- [Hastie（2020），Ridge Regularization，第 1 節與圖 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC9410599/)：支持菱形、圓形與零權重直覺。
- [scikit-learn Preprocessing data](https://scikit-learn.org/stable/modules/preprocessing.html)：支持先對齊特徵尺度。

## 小結

- L1 懲罰是絕對值加總，正負權重都計入。
- 它可產生稀疏權重，太強則可能欠擬合。
- 高度相關的欄位可能在重訓中輪流入選。（補充）
- 稀疏、穩定與預測誤差，需要分開檢查。（補充）
