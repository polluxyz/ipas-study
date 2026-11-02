---
id: semi-supervised-learning
title: 半監督學習
kind: technique
codes:
  - L21102
  - L23201
  - L23301
aliases:
  - Semi-supervised Learning
  - 偽標籤
summary: 半監督學習結合少量有標籤與大量未標籤資料，效果取決於資料假設與品質
goals:
  - id: g1
    text: 用資料流區分半監督與全監督訓練
  - id: g2
    text: 安排偽標籤與人工抽查，處理低信心及錯誤回饋
requires:
  - supervised-learning
guide_refs:
  - guide-1:3-46
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 72 筆訓練資料只有 24 筆經人工給類別，48 筆只提供特徵；另留 24 筆人工標籤資料作驗證。何者是半監督安排？
    options:
      A: 只用 24 筆人工標籤訓練，將 48 筆未標籤資料留作推論
      B: 把另留的 24 筆驗證標籤併入訓練，仍用同一批驗證成效
      C: 同時使用 24 筆標籤訊息與 48 筆未標籤資料學習
      D: 隱藏 24 筆標籤後，只用特徵分群
    answer: C
    explain:
      A: 未標籤資料只拿來推論，沒有參與學習，仍是只使用 24 筆標籤的監督式基準。
      B: 這只增加監督式訓練標籤，而且把驗證答案用於學習，破壞獨立比較。
      C: 有標籤與未標籤的訓練資料共同參與學習，符合題目設定的半監督方式。
      D: 隱藏所有標籤後僅探索特徵結構，沒有利用那 24 筆監督訊息。
  - id: c2
    goal: g2
    type: choice
    prompt: 第一輪 48 筆未標籤資料中，28 筆信心大於 0.8，但事後查核發現其中 4 筆錯誤。怎麼處理最合理？
    options:
      A: 保留全部，信心超標就是正確
      B: 把 4 筆錯誤也當真實答案，以保持數量
      C: 提高迭代次數，保證會自動修正
      D: 複核並修正來源，回到乾淨標籤重訓，再用獨立驗證比較
    answer: D
    explain:
      A: 模型信心不是正確保證，尤其機率未校準時。
      B: 這會將已知錯誤當作監督訊息擴散。
      C: 重複訓練可能強化原錯誤，而非保證修正。
      D: 須中止錯誤回饋並檢查假設，讓驗證資料衡量是否改善。
  - id: c3
    goal: g2
    type: choice
    prompt: 人工預算只夠再查 6 筆。哪些安排較完整？
    options:
      A: 只抽查信心最高的 6 筆，據此推定其餘高信心偽標籤皆正確
      B: 優先查疑難樣本，也抽查高信心樣本並保留驗證標籤獨立
      C: 先讀測試標籤來選出 6 筆最難樣本，再用同一測試集回報成效
      D: 低信心就標成正常，省下 6 筆查核額度
    answer: B
    explain:
      A: 只查最有信心的 6 筆既會漏掉疑難區域，也不足以保證其餘偽標籤全數正確。
      B: 疑難樣本可補足模型尚未掌握的區域，高信心抽查可發現自信錯誤，獨立驗證則保留比較基準。
      C: 讀取測試答案來選查核樣本，會讓測試資料參與開發，不能再作獨立成效評估。
      D: 低信心不代表正常，任意填成正常會引入單方向的錯標，沒有完成實質查核。
---
## 為什麼需要

影像通常容易蒐集，可靠標籤卻要花時間。半監督學習（semi-supervised learning）把少量有標籤資料與大量未標籤資料一起用於訓練，降低對人工標籤量的依賴。

指引把它與主動學習一起放在標籤不足的脈絡：半監督利用兩類資料共同學習；主動學習則選出值得請人給標籤的樣本。

## 直覺

:::supplement[來源：scikit-learn Semi-supervised learning 1.14]
有標籤樣本提供「哪一類」的線索，未標籤樣本提供資料分布的線索。兩者必須對同一個任務有幫助，才能期待改善。
:::

### 資料怎麼流

![有標籤資料先建立模型，未標籤資料的候選答案經篩選與查核後回到訓練，驗證資料獨立保留。](figure:l23201-semi-supervised-learning-label-flow)

## 定義與公式

同樣只有少量人工標籤時，全監督基準只用這些配對資料。半監督額外使用未標籤資料的特徵，但不會因此把它們變成已確認的人工答案。

### 偽標籤是一種做法（補充）

自我訓練（Self-training）先用真實標籤建立分類器，再替未標籤樣本預測候選答案，選取部分結果作為偽標籤（Pseudo-label）重訓。

也有依樣本相似關係傳播標籤等方法。半監督不等於每一種方法都必須產生硬類別偽標籤；本頁只走自我訓練流程。

## 走一次流程

:::supplement[來源：scikit-learn SelfTrainingClassifier；本組教學合成資料]

客服與設備資料各 120 筆，兩者都固定保留 72 筆訓練、24 筆驗證、24 筆測試。從訓練索引每隔 3 筆取 1 筆，只開放 24 筆人工標籤。

| 資料角色 | 筆數 | 學習時可讀什麼 |
|---|---|---|
| 有標籤訓練 | 24 | 特徵與人工標籤 |
| 未標籤訓練 | 48 | 只讀特徵 |
| 驗證 | 24 | 預測後才對照人工標籤 |
| 測試 | 24 | 鎖定流程後才最終評估 |

### 從候選到查核（補充）

1. 先以 24 筆建立監督式基準，驗證答對 21/24。
2. 第一輪有 28 筆未知樣本的最大類別機率大於 0.8；其餘先不加入，不隨便填「正常」。
3. 第 1 輪加入 28 筆，第 2 輪再加 6 筆，共 34 筆偽標籤；第 3 輪沒有新增而停止，14 筆仍未知。驗證仍為 21/24，沒有改善。
4. 實務補上人工抽查：高信心與疑難樣本都查；錯誤時回看標籤定義與樣本來源，修正後重訓。

這份合成資料有保留答案供事後核算，第一輪 28 筆中有 4 筆其實錯誤。這些隱藏答案沒有交給模型；範例用它們示範為何信心高也可能擴散錯誤。
:::

## 程式（補充）

以下使用與 JSON 相同的資料；自動版沒有執行人工查核。人工查核屬於上面的作業步驟，不能由機率閾值取代。

```python
import numpy as np
i = np.arange(120)
X = np.column_stack((i % 12, i // 12))
y = (X.sum(axis=1) >= 10).astype(int)
y[i % 19 == 0] = 1 - y[i % 19 == 0]
order = np.random.default_rng(42).permutation(120)
train, val, test = order[:72], order[72:96], order[96:]
print("資料形狀", X.shape, "切分", len(train), len(val), len(test))
```
```text
資料形狀 (120, 2) 切分 72 24 24
```

標籤 -1 是這個 scikit-learn API 表示「未知」的值，並非新增一個類別。

監督式基準的縮放與分類器都只擬合 24 筆有標籤資料。半監督流程則以 72 筆訓練特徵估計縮放，再交給自我訓練；兩者都不擬合驗證或測試資料。

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.semi_supervised import SelfTrainingClassifier
scale = StandardScaler().fit(X[train])
xt, xv = scale.transform(X[train]), scale.transform(X[val])
mask = np.full(len(train), -1); mask[::3] = y[train[::3]]
base = make_pipeline(StandardScaler(), LogisticRegression(random_state=42))
base.fit(X[train][mask != -1], mask[mask != -1])
model = SelfTrainingClassifier(LogisticRegression(random_state=42), threshold=.8, max_iter=5)
model.fit(xt, mask)
print("初始人工標籤", int((mask != -1).sum()))
print("累計偽標籤", int((model.labeled_iter_ > 0).sum()))
print("仍未知", int((model.transduction_ == -1).sum()))
print("基準與半監督驗證", int((base.predict(X[val]) == y[val]).sum()),
      int((model.predict(xv) == y[val]).sum()))
```
```text
初始人工標籤 24
累計偽標籤 34
仍未知 14
基準與半監督驗證 21 21
```

:::tip[讀碼重點]
mask 只保留每隔 3 筆的標籤。基準 Pipeline 接收原始特徵；半監督模型接收由訓練池縮放的特徵。

模型選取最大類別機率大於 0.8 的樣本；labeled_iter_ 大於 0 表示後來加入。
:::

## 怎麼用、怎麼判讀

應維持可靠的人工標籤與品管，避免把自動結果直接視為已確認答案。

### 失敗條件（補充）

標籤不足不代表任何未標籤資料都能幫忙。未標籤資料若來自不同領域，或相似樣本未必同類，學習假設可能不成立。

機率未校準時，信心 0.9 不表示其中正好 90% 正確。

錯誤偽標籤若被反覆學習，會形成確認偏誤。

可暫停加入、檢查來源、修訂準則與人工複核；最後仍以獨立驗證和相同標籤預算的監督式基準比較。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 影像標籤不足 | 少量可靠標籤、大量未標籤影像 | 指引列出的使用契機 |
| 客服郵件（補充） | 少量人工類別、許多未處理郵件 | 留意新業務詞彙造成的分布改變 |
| 製造設備（補充） | 少量確認故障、大量感測紀錄 | 高信心正常也需抽查 |
| 醫療影像（補充） | 不同院所來源混用 | 相似外觀不保證同一疾病 |

## 常見誤解

- 未標籤樣本沒有現成答案，不代表它的特徵沒有資訊。
- 信心越高，偽標籤就一定正確：機率校準與資料來源仍會影響可靠性。（補充）
- 主動學習請人補答案，半監督學習利用未標籤資料；兩者可搭配，但不是同一件事。

## 進階

### 參考來源

- 科目 1 指引 3.2，guide-1:3-46（版本未標示）：支持兩類訓練資料、影像標籤不足場景、主動學習與品質查核。
- [scikit-learn Semi-supervised learning](https://scikit-learn.org/stable/modules/semi_supervised.html)：支持自我訓練、相似關係方法與資料分布假設。
- [StandardScaler API](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)：支持程式中縮放統計的擬合範圍，區分 24 筆基準與 72 筆半監督訓練池。
- [SelfTrainingClassifier API](https://scikit-learn.org/stable/modules/generated/sklearn.semi_supervised.SelfTrainingClassifier.html)：支持未知值、閾值、迭代屬性與程式。
- [Effect of varying threshold for self-training](https://scikit-learn.org/stable/auto_examples/semi_supervised/plot_self_training_varying_threshold.html)：參考比較信心篩選與獨立評估的教學安排，支持高信心不等於有效改善。

## 小結

- 半監督同時使用少量有標籤與大量未標籤訓練資料。
- 偽標籤是模型候選答案，品質需要查核。（補充）
- 與相同標籤預算的基準比較，改善並無保證。（補充）
