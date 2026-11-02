---
id: classification-model-selection
title: 二元與多類別模型選用
kind: technique
codes: [L23202]
aliases: []
requires: [classification-regression]
summary: 依類別定義、邊界形狀、資料規模與解釋需求比較分類模型
goals:
  - id: g1
    text: 區分二元與多類別任務，依線性邊界、高維資料及解釋需求比較候選模型
guide_refs: [guide-3:4-25, guide-3:4-26, guide-3:4-27, guide-3:4-29, guide-3:4-31, guide-3:4-33]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠有90筆已標註資料，每筆只屬於正常、壓力異常、振動異常之一。哪項任務與輸出安排正確？
    options:
      A: 定為二元分類，將三個類別編成0、1、2後直接用一個閾值
      B: 定為連續迴歸，將三個類別編成0、1、2後直接解釋數值差
      C: 定為三類分類，保留三個互斥標籤並使用能處理多類別的模型
      D: 定為無監督分群，將三個既有標籤刪除後保證群號對應原類別
    answer: C
    explain:
      A: 標籤有三種互斥結果，整數編碼不會把它變成二元任務。
      B: 類別代碼的數值差沒有自動獲得連續量意義。
      C: 三個互斥結果屬於多類別分類，需有相應輸出或多類別策略。
      D: 刪除標籤後群號的語意不再受到原分類目標監督。
  - id: c2
    goal: g1
    type: choice
    prompt: 醫療團隊先用20個檢查特徵預測是否患病，關係近似線性且需要說明係數。哪個初始方案合理？
    options:
      A: 先試邏輯迴歸，檢查共線性並用保留資料驗證
      B: 先試最大深度不限的樹，宣稱每條規則必有因果
      C: 先試RBF核SVM，宣稱核函數必能解釋每個係數
      D: 先試KNN且保留原單位，宣稱距離不會受尺度影響
    answer: A
    explain:
      A: 近似線性且需係數說明，適合把邏輯迴歸列為可驗證的基準。
      B: 深樹有過擬合風險，規則也不等於因果。
      C: 核SVM可處理複雜邊界，但通常不提供原特徵的簡單係數說明。
      D: KNN依距離決策，尺度會影響近鄰排序。
  - id: c3
    goal: g1
    type: choice
    prompt: 同18筆驗證資料中，模型甲答對17筆、模型乙16筆；乙較快且能提供簡短規則。接下來哪個結論合理？
    options:
      A: 甲比乙多答對1筆，所以甲對任何新族群都一定較佳
      B: 乙能提供簡短規則，所以乙的規則不必再查核穩定性
      C: 改用最後18筆測試資料反覆調參，直到模型甲完全答對
      D: 依錯誤成本及部署需求再比較，單次小樣本無法保證排名
    answer: D
    explain:
      A: 一次切分的微小差距不能證明跨族群或未來表現。
      B: 可解釋不代表穩定或正確，仍須檢查泛化與規則可靠性。
      C: 反覆使用測試集挑參數會污染最終評估。
      D: 選型需同時滿足預測、成本與解釋需求，並評估結果波動。
---

## 為什麼需要

分類模型都能輸出類別，卻用不同方式畫邊界。金融希望說明風險原因，工廠可能更在意少漏掉瑕疵，選型條件不會完全相同。

指引比較邏輯迴歸的簡單性、SVM的高維能力，以及集成模型的表現與解釋取捨。這些是候選方向，不能代替資料驗證。

## 直覺

先問「有幾種互斥結果」，再問「如何分開」。二元分類在兩個結果間選一個；多類別分類則在三個以上結果間選一個。

:::supplement[來源：scikit-learn Logistic regression；INRIA Linear models for classification]
若一筆產品可以同時有兩種瑕疵，那是多標籤需求。不能直接套用本頁「每筆只屬於一類」的輸出假設。
:::

## 定義與公式

### 固定類別意義

| 任務 | 共用例子的標籤 | 輸出與限制 |
|---|---|---|
| 金融二元分類（補充） | 未違約、違約 | 兩類擇一；機率需確認正類 |
| 金融三類分類（補充） | 低、中、高風險 | 三類擇一；不能把編碼當機率 |
| 製造二元分類（補充） | 正常、瑕疵 | 合併兩種異常，資訊較粗 |
| 製造三類分類（補充） | 正常、壓力異常、振動異常 | 類別互斥，需先訂重疊處理規則 |

:::supplement[來源：本組教學合成資料；scikit-learn Logistic regression]
同為三類輸出，也不表示風險等級與故障種類有同樣的順序意義。製造版若兩種異常同時出現，固定歸為振動異常，這是教學標註規則。
:::

### 從條件挑候選

| 候選 | 優先考慮的條件 | 主要取捨 |
|---|---|---|
| 邏輯迴歸 | 關係近似線性、需解釋係數 | 原始特徵的邊界較簡單 |
| 支持向量機 | 中小資料、高維或需核邊界 | 核與參數增加成本 |
| 分類決策樹 | 要短規則、非線性與交互作用 | 深樹易過擬合、不穩定 |
| K 最近鄰 | 低維、相似樣本局部分布清楚 | 尺度、K與查詢成本 |
| 樸素貝氏 | 需要快速機率分類基準 | 給定類別的條件獨立假設 |

:::supplement[來源：scikit-learn Logistic regression、SVM、Decision Trees、Nearest Neighbors、Naive Bayes]
多類別支援方式也要核對。分類樹、KNN與樸素貝氏能直接輸出多類；邏輯迴歸可改用多項（multinomial）形式，SVC則在內部組合兩兩分類器。
:::

## 走一次流程

### 固定條件比較（補充）

先固定金融與製造各90筆的標籤版本、四個特徵及54／18／18切分。比較時只用54筆擬合；縮放器也只從這54筆估計統計量。

五個候選用同18筆驗證。下表是答對筆數，示範在相同條件下比較；不代表任何領域的正式排名。

| 模型 | 金融二元 | 金融三類 | 製造二元 |
|---|---|---|---|
| 邏輯迴歸 | 16／18 | 18／18 | 17／18 |
| RBF SVM | 17／18 | 17／18 | 18／18 |
| 深度3分類樹 | 16／18 | 15／18 | 18／18 |
| KNN，K=5 | 17／18 | 16／18 | 18／18 |
| GaussianNB | 13／18 | 17／18 | 16／18 |

再檢查漏報與誤報、時間及解釋需求。小樣本出現18／18，只代表這18筆全對；正式選參數宜在訓練部分做交叉驗證，最後測試集不參與挑選。

## 程式（補充）

先匯入五種模型。下列三段依序執行，重建JSON的金融資料與同一切分。

```python
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
print("候選模型數", 5)
```
```text
候選模型數 5
```

```python
i = np.arange(90)
a, b = i % 9, i // 9
X = np.column_stack((20+10*a, 100*b, 16+8*a+(i%3-1), 90*b+2*(i%4)))
r = b-a-1
labels = [(r >= 0).astype(int), np.where(r < -1, 0, np.where(r < 2, 1, 2))]
hand = [10, 28, 11, 38, 12, 48]
rest = np.array([j for j in i if j not in hand])
order = np.random.default_rng(42).permutation(rest)
train, val = np.r_[hand, order[:48]], order[48:66]
print("金融資料", X.shape, "訓練/驗證", len(train), len(val))
```
```text
金融資料 (90, 4) 訓練/驗證 54 18
```

```python
for y in labels:
    models = [LogisticRegression(max_iter=1000, random_state=42),
              SVC(C=1, kernel="rbf", gamma=0.5, random_state=42),
              DecisionTreeClassifier(max_depth=3, min_samples_leaf=3, random_state=42),
              KNeighborsClassifier(n_neighbors=5), GaussianNB()]
    correct = []
    for m in models:
        model = m if isinstance(m, DecisionTreeClassifier) else make_pipeline(StandardScaler(), m)
        model.fit(X[train], y[train])
        correct.append(int((model.predict(X[val]) == y[val]).sum()))
    print("類別數", len(np.unique(y)), "驗證答對", correct)
```
```text
類別數 2 驗證答對 [16, 17, 16, 17, 13]
類別數 3 驗證答對 [18, 17, 15, 16, 17]
```

:::tip[讀碼重點]
表中的樹用Gini、深度3；分類決策樹頁的路徑圖用熵、深度2。參數改變後，不能直接沿用另一設定的分數。
:::

## 怎麼用、怎麼判讀

沒有一種模型能對所有資料都最好。先把需要解釋、資料維度、非線性程度與資料量寫成條件，再用共同評估流程檢查候選。

### 換個場景

| 場景 | 任務 | 選型判讀 |
|---|---|---|
| 垃圾郵件、客戶流失 | 二元分類 | 兩類定義與錯誤成本 |
| 文件、疾病、影像、語音類別 | 多類別分類 | 類別數與多類支援方式 |
| 金融、醫療 | 需可說明的預測 | 係數或規則是否足夠清楚 |
| 製造瑕疵（補充） | 二元或互斥三類 | 漏報成本及感測尺度 |
| 物流案件（補充） | 延遲原因分類 | 類別定義與上線可得資訊 |

## 常見誤解

- 類別編成0、1、2就變成迴歸：數字只是代碼，輸出語意仍是類別。（補充）
- SVM適合高維，所以對任意大資料也一定最快：高維與樣本量是不同條件。
- 規則能看懂就不會過擬合：單棵樹仍會受噪聲與微小資料變化影響。

## 進階

### 參考來源

- 科目3指引4.2，guide-3:4-25～4-34（版本未標示）：支持分類任務、候選條件與原有場景。
- [scikit-learn Logistic regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression)：核對二元／多類輸出。
- [scikit-learn SVM](https://scikit-learn.org/stable/modules/svm.html)、[Decision Trees](https://scikit-learn.org/stable/modules/tree.html)、[Nearest Neighbors](https://scikit-learn.org/stable/modules/neighbors.html)、[Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)：核對五模型API與限制。
- [INRIA Cross-validation framework](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_train_test.html)：參考相同資料比較與保留測試的教學流程。

## 小結

- 先定義每筆資料可以屬於幾個類別。
- 候選模型的優勢都附帶資料與成本條件。
- 同資料、同切分比較，再檢查錯誤類型與部署要求。
