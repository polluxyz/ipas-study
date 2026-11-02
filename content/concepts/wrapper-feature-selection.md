---
id: wrapper-feature-selection
title: Wrapper 與 RFE
kind: technique
codes: [L23301]
aliases: [RFE, Sequential Feature Selection, Wrapper]
summary: Wrapper 反覆訓練模型挑欄位，RFE 依模型重要性逐輪淘汰
goals:
  - id: g1
    text: 比較前向、後向與 RFE 的回饋方式、固定驗證規則及搜尋成本
requires: [train-val-test-split]
guide_refs: [guide-3:5-5]
formula_groups:
  - id: search-fit-count
    source: https://github.com/scikit-learn/scikit-learn/blob/afe5bcd80/sklearn/feature_selection/_sequential.py
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊有 6 欄特徵，想做前向選擇並保留 2 欄。每個候選集合都做 3 摺驗證，不含最後重訓，共需擬合幾次？
    options:
      A: 18 次：只比較第一輪 6 個候選
      B: 15 次：只比較第二輪 5 個候選
      C: 33 次：依序比較 6 加 5 個候選
      D: 36 次：每一輪都比較 6 個候選
    answer: C
    explain:
      A: 18 只計第一輪，漏掉加入第二欄時的比較。
      B: 15 只計第二輪，漏掉第一輪的六個候選。
      C: 第一輪 6 個、第二輪 5 個，每個都做 3 摺，共 33 次。
      D: 第二輪已有一欄固定保留，只剩五個可新增欄位。
  - id: c2
    goal: g1
    type: choice
    prompt: 工程師對 6 欄模型重複訓練，每輪刪除絕對係數最小的一欄，直到剩 2 欄。這是哪種流程？
    options:
      A: RFE：依當輪模型重要性反覆淘汰
      B: 前向：依當輪候選驗證分數新增
      C: Filter：依單欄統計量一次排名
      D: Embedded：由一次訓練的零係數選欄
    answer: A
    explain:
      A: 反覆擬合並依模型重要性刪欄是 RFE。
      B: 前向從少量或空集合出發，以候選集合表現新增欄位。
      C: 此流程反覆擬合模型，並非模型外的一次統計篩選。
      D: 這裡有額外淘汰與重訓迴圈，不能只稱為一次內建篩選。
  - id: c3
    goal: g1
    type: choice
    prompt: 同一份 24 筆開發資料上比較 20 組欄位集合，最佳驗證 AUC 為 0.92。12 筆測試尚未使用，哪個回報方式合理？
    options:
      A: 把 0.92 當最終成績，因已比較足夠多組
      B: 先固定集合與流程，再以保留測試評估
      C: 改以測試分數挑集合，再回報該測試值
      D: 把 20 組驗證值平均，取代最終測試值
    answer: B
    explain:
      A: 反覆搜尋會對開發資料產生選擇偏差，最高值未必可泛化。
      B: 先固定決策，保留測試才能評估未參與搜尋的資料。
      C: 測試集若也挑集合，便失去獨立評估的角色。
      D: 候選流程的平均分數不是所選最終流程的泛化估計。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

單欄統計分數無法完整反映多欄合用的效果。Wrapper 特徵選擇（Wrapper Feature Selection）把模型放進搜尋迴圈，觀察不同欄位集合是否適合這個模型。

代價是反覆訓練。只要一直嘗試，連驗證集的偶然波動也可能被挑中，所以需要固定比較規則與獨立的最終評估。

## 直覺

每次換一份欄位清單，重新訓練模型並取得回饋，再決定下一步保留什麼。它能反映特徵搭配，但效果取決於模型是否學得出那種關係。

![候選清單先送進指定模型，再以回饋決定下一份清單；測試集不回流到搜尋。](figure:l23301-wrapper-feature-selection-search)

## 定義與公式

指引列出前向、後向與遞迴特徵消除（RFE）。以下把三種方法的執行步驟與成本展開。

:::supplement[來源：scikit-learn RFE、SequentialFeatureSelector API]
| 方法 | 起點與每一步 | 回饋依據 |
|---|---|---|
| 前向選擇 | 從空集合逐次加一欄 | 比較新增各候選的模型表現 |
| 後向選擇 | 從全部欄位逐次刪一欄 | 比較刪除各候選的模型表現 |
| 遞迴特徵消除 RFE | 擬合後刪最不重要欄位，再重訓 | 係數或樹重要性等模型權重 |

標準 RFE 不會自動替每個刪欄候選做交叉驗證；它依當輪重要性淘汰。RFECV 另外用交叉驗證選保留欄數。這和前向、後向逐個比較候選集合不同。

以下依官方實作的候選迴圈自行推導成本，並非 API 直接列出的公式。已選 r 欄時，還有 p−r 個新增候選；每個候選做 K 摺驗證，這一輪就擬合 K(p−r) 次。

前向從空集合挑到 k 欄，要累加 r＝0 到 k−1 的各輪成本：

$$
N_{\mathrm{fit}}=K\sum_{r=0}^{k-1}(p-r)
$$

p 是原始欄數，k 是最後保留欄數，r 是已選欄數，K 是摺數。這裡不含調參、最終重訓，也假設每一步只加一欄且不中途停止。
:::

## 走一次流程

### 共用授信資料（補充）

沿用 Filter 的 36 筆、六欄與固定切分：24 筆開發、12 筆測試。正類固定為違約；搜尋統一採三摺分層驗證、種子 17、ROC AUC。

1. 前向從空集合開始，比較六種單欄模型；本例負債比提供明顯訊號。
2. 若規定保留兩欄，就固定第一欄，再各加五個剩餘欄位比較。
3. 後向則先有六欄，第一輪比較六種「刪掉一欄」的五欄模型。
4. RFE 每輪看模型重要性，刪掉較低者後重訓，直到設定欄數。

代入上式，前向選兩欄需 3×(6+5)=33 次擬合。RFE 若每輪刪一欄到兩欄，依序擬合 6、5、4、3、2 欄，共 5 次；這 5 次本身沒有三摺驗證。

這些都是貪婪搜尋，不保證找到所有組合裡的最佳集合。高度相關欄可互相替代，名單也可能隨資料或同分規則變動。

## 程式（補充）

先用 Filter 頁相同算術建立六欄與索引；本頁重列讓程式可獨立執行。

```python
import numpy as np
i = np.arange(36); j = i // 2; y = i % 2
income = 50 + 5 * (2 * (j % 6) - 5)
ratio = .5 + .1 * (2 * y - 1) + .02 * (j // 6 - 1)
age, tenure, noise = 25 + 7*j%17, 1 + 5*j%9, 11*j%13
X = np.column_stack([income, 12*income, ratio, age, tenure, noise])
tr, te = j%3 != 2, j%3 == 2
names = np.array(["月收入", "年收入", "負債比", "年齡", "年資", "雜訊"])
print("訓練與測試", X[tr].shape, X[te].shape)
```
```text
訓練與測試 (24, 6) (12, 6)
```

這裡只選一欄，對照 RFE 與前向選擇；上面的 33 次則是「選兩欄」的成本算例。

```python
from sklearn.feature_selection import RFE, SequentialFeatureSelector
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import StratifiedKFold
Z = StandardScaler().fit_transform(X[tr])
rfe = RFE(LogisticRegression(random_state=17), n_features_to_select=1)
rfe.fit(Z, y[tr])
base = make_pipeline(StandardScaler(), LogisticRegression(random_state=17))
cv = StratifiedKFold(3, shuffle=True, random_state=17)
sfs = SequentialFeatureSelector(base, n_features_to_select=1, scoring="roc_auc", cv=cv)
sfs.fit(X[tr], y[tr])
print("RFE", names[rfe.get_support()].tolist())
print("前向", names[sfs.get_support()].tolist())
```
```text
RFE ['負債比']
前向 ['負債比']
```

:::tip[讀碼重點]
RFE 只在開發資料擬合，沒有回報泛化分數。SFS 的縮放器包在候選模型裡，內部每摺都重新估計尺度；不要先縮放全部開發資料，再交給內部交叉驗證。
:::

要評估 RFE 流程，就連同縮放器一起放進外層的交叉驗證。下段每摺都重新縮放、重新選欄，沒有沿用上段的選中清單。

```python
from sklearn.model_selection import cross_val_score
rfe_pipe = make_pipeline(StandardScaler(),
    RFE(LogisticRegression(random_state=17), n_features_to_select=1))
print("RFE三摺AUC", cross_val_score(rfe_pipe, X[tr], y[tr],
      cv=cv, scoring="roc_auc").tolist())
```
```text
RFE三摺AUC [1.0, 1.0, 1.0]
```

## 怎麼用、怎麼判讀

指引指出 Wrapper 能考量模型下的特徵互動，但計算量大，也可能過擬合。欄位數可控、訓練成本能負擔時，才適合花這個成本搜尋。

回饋指標可依任務採準確率、F1 等模型表現。

:::supplement[來源：scikit-learn Common pitfalls；Model-based and sequential feature selection 教學]
本頁的分類流程使用 ROC AUC。所有候選用相同摺分與指標，才不會把切分運氣誤當成欄位改善。若換模型或任務，也需重新驗證選中清單。

搜尋用的驗證分數已參與選擇，不宜直接當最終成績。保留測試集，或另設外層驗證；要估計整段搜尋的泛化能力時，參考巢狀交叉驗證。
:::

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 希望考量欄位搭配 | 反覆訓練與比較 | 模型也必須能學到互動 |
| 授信（補充） | 比較六欄與精簡欄位 | 收入副本不一定增加訊號 |
| 製造（補充） | 挑少量可部署感測器 | 同時記錄精度與採集成本 |
| 醫療（補充） | 比較檢查項目的組合 | 患者分組、保留獨立評估 |

## 常見誤解

- RFE 每輪一定看驗證分數：一般 RFE 依模型重要性淘汰。（補充）
- Wrapper 能找出所有互動：仍受模型表達力與貪婪搜尋限制。（補充）
- 欄位越少一定越好：刪除關鍵欄也會讓預測惡化。

## 進階

### 與 Embedded 的界線（補充）

RFE 可採用本身有 Embedded 機制的模型當評分器，但外面仍有「淘汰、重訓」迴圈。方法名稱描述選欄流程，不必把整段流程硬分成互斥工具。

### 參考來源

- 科目 3 指引 guide-3:5-5（版本未標示）：支持 Wrapper、RFE、前向後向、計算及過擬合限制；未指定產業。
- [RFE API](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.RFE.html)：支持重要性淘汰、與 RFECV 的區別。
- [SequentialFeatureSelector API](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.SequentialFeatureSelector.html)：支持候選交叉驗證的流程前提，未直接刊載本頁的成本公式。
- [scikit-learn 官方候選搜尋實作](https://github.com/scikit-learn/scikit-learn/blob/afe5bcd80/sklearn/feature_selection/_sequential.py)：支持逐輪列舉剩餘候選、每個呼叫交叉驗證；本頁據此累加擬合次數。
- [官方 model-based 與 sequential 比較教學](https://scikit-learn.org/stable/auto_examples/feature_selection/plot_select_from_model_diabetes.html)：參考不同選欄流程與耗時的比較方式。
- [Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：支持訓練邊界、測試集與前處理安排。

## 小結

- 前向逐次加欄，後向逐次刪欄，RFE 依模型重要性淘汰。
- RFE 與候選集合驗證的回饋方式不同。（補充）
- 固定模型、指標與摺分，搜尋成本才能比較。（補充）
- 搜尋可能過擬合，需要未參與選擇的最終評估。
