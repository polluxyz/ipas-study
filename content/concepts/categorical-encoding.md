---
id: categorical-encoding
title: 類別特徵編碼
kind: technique
codes: [L21301, L23301]
aliases: [Label Encoding, Ordinal Encoding, ordinal-encoding, 有序類別編碼, 類別編碼]
requires: [train-val-test-split]
summary: 先辨認類別有無順序，再選擇模型能理解且不扭曲語意的表示
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-4, guide-1:5-5, guide-3:5-7, guide-3:5-8]
goals:
  - id: g1
    text: 依類別是否有序選擇整數或One-hot，並寫出轉換後矩陣
  - id: g2
    text: 比較高基數的欄數成本，為未知類別設定不改欄位的處理規則
  - id: g3
    text: 以教育與商品例說明虛假距離，區分LabelEncoder與OrdinalEncoder
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售表有3種店級「基本＜進階＜尊榮」，也有3類商品「飲品、食品、日用品」。模型把輸入數字當連續量，哪組編碼起點合理？
    options:
      A: 店級依字典順序編碼；商品依產品單價編成0、1、2
      B: 店級任意編成0、2、1；商品按中文排序編成0、1、2
      C: 店級指定順序編碼；商品用三欄One-hot表示身分
      D: 店級用轉換率排序；商品用中文筆畫總數表示身分
    answer: C
    explain:
      A: 字典順序未必符合店級高低，單價也不能當商品類型本身的順序。
      B: 任意打亂會破壞店級順序，商品的中文排序則加入無根據的大小關係。
      C: 店級具有業務順序，商品無序；仍需留意有序整數是否暗示等距。
      D: 目標統計與文字筆畫都不是這兩欄固有的有序語意。
  - id: c2
    goal: g2
    type: choice
    prompt: 10,000筆曝光有5,000種廣告來源，模型已固定輸入欄位；上線遇到第5,001種來源。哪個方向合理？
    options:
      A: 整數表示成第5001級，並宣稱與其他來源的差值有真實意義
      B: 預設未知值處理規則，再比較稀疏獨熱或安全估計的目標編碼
      C: 臨時新增第5001欄，並沿用只接受5000欄的原模型權重
      D: 全部來源重新排序，再保留用舊編碼所訓練的原模型參數
    answer: B
    explain:
      A: 來源無序，整數差值不能憑編號就解讀成距離。
      B: 先固定未知值規則，再比較維度與洩漏風險，才有一致的訓練推論流程。
      C: 新增欄位會改變模型輸入形狀，原權重不能直接沿用。
      D: 重排會改變舊欄位或代碼的意思，原模型參數不再對應相同表示。
  - id: c3
    goal: g3
    type: choice
    prompt: 工程師把教育程度高中、學士、碩士當輸入X，購買與否當標籤y。使用scikit-learn時，哪種分工正確？
    options:
      A: X用LabelEncoder指定業務順序，y用OrdinalEncoder建立連續距離
      B: X用LabelEncoder指定等距關係，y用OneHotEncoder判斷教育高低
      C: X用OrdinalEncoder自動保證等距，y用LabelEncoder預測購買機率
      D: X用OrdinalEncoder指定順序，y可用LabelEncoder建立類別代碼
    answer: D
    explain:
      A: LabelEncoder不提供指定特徵業務順序的介面，OrdinalEncoder也不是標籤距離估計器。
      B: 編碼器不會驗證等距，購買標籤也不能用來決定教育高低。
      C: 指定順序不保證教育等距，LabelEncoder只轉代碼而不預測機率。
      D: OrdinalEncoder用於特徵，LabelEncoder用於目標標籤；兩者都只是表示轉換。
---

## 為什麼需要

城市、商品與服務等級都是類別。邏輯迴歸、一般SVM及神經網路通常需要數值輸入，但把文字換成數字之前，要先保住它原本的意思。

類別特徵編碼（Categorical Encoding）依類別順序、基數、資料量與模型需求選擇表示。編碼省空間，不代表它對模型的數學含義也正確。

## 直覺

「高中＜學士＜碩士」有順序，「飲品、食品、日用品」只有不同身分。前者可以指定有序整數；後者若任意編成0、1、2，模型可能誤以為日用品比食品高一級。

:::supplement[來源：Google Vocabulary and one-hot encoding；scikit-learn Comparing Target Encoder with Other Encoders]
對距離模型而言，0到2的差是0到1的兩倍。商品類型本身沒有這種距離；即使把編號改成10、20、30，也只是換單位，沒有消除虛假關係。
:::

## 定義與公式

### 有序與無序

| 類別性質 | 例子 | 表示方向 | 要留意的事 |
|---|---|---|---|
| 有序 | 教育程度、服務等級 | 依指定順序編整數 | 高低不等於等距 |
| 無序 | 城市、產品類型 | One-hot編碼 | 類別越多，欄位越多 |
| 高基數 | 大量廣告來源 | 比較目標編碼 | 需要標籤統計與風險控制 |

基數是欄位中的不同類別數，不是樣本筆數。指引的教育與服務等級例子有自然高低；商品名稱與城市沒有。

### Label與Ordinal的名稱差異（補充）

兩科指引用Label Encoding泛稱把有序特徵轉成整數。讀概念時抓住「依真實順序表示」；讀scikit-learn程式時，必須再區分實際API。

| API | 主要對象 | 能做什麼 |
|---|---|---|
| LabelEncoder | 標籤y | 把目標類別換成類別代碼 |
| OrdinalEncoder | 特徵X | 每個特徵一個整數欄，可明確指定類別順序 |
| OneHotEncoder | 特徵X | 用各類別指示欄表示無序身分 |

`LabelEncoder`不是用來指定教育程度的業務順序。`OrdinalEncoder`即使能輸出整數，也不會替你判斷那個順序是否合理。

## 走一次流程

### 1. 先寫出順序表

用教育與共用資料的服務等級，先由業務定義順序，而非讓字母或中文排序決定。

| 整數 | 教育程度 | 店級／車種服務等級 |
|---:|---|---|
| 0 | 高中 | 基本 |
| 1 | 學士 | 進階 |
| 2 | 碩士 | 尊榮 |

整數保留高低，但不能據此推論高中到學士的效果等於學士到碩士。若模型會把整數當等距連續量，仍應比較其他表示。

### 2. 無序商品改用指示欄

共用JSON零售前3筆的商品依序是飲品、食品、日用品。不加排序含義的矩陣如下：

| 商品 | 飲品欄 | 食品欄 | 日用品欄 |
|---|---:|---:|---:|
| 飲品 | 1 | 0 | 0 |
| 食品 | 0 | 1 | 0 |
| 日用品 | 0 | 0 | 1 |

這三列不表示飲品最低、日用品最高。完整欄數與詞彙表的計算接著看One-hot編碼與高基數成本。

### 3. 再處理基數與未知值

類別越多，獨熱新增的欄位與記憶體用量越大。整數編碼只用一欄，但用於無序類別時，可能讓模型誤解出不存在的順序。

:::supplement[來源：NumPy ndarray.nbytes；scikit-learn OrdinalEncoder、OneHotEncoder]
10,000列、5,000類的獨熱共50,000,000個值。以稠密float32每值4 bytes計，需200,000,000 bytes。

共用資料的訓練索引0–19沒有店級「企業」，驗證索引20才出現。預先以−1標未知是明確約定，但−1不代表比基本更低；距離模型不宜直接把它當連續等級。

可比較未知指示欄、獨熱的全0規則，或在訓練時就定義其他類。不能在驗證時重排所有代碼，也不能臨時增加原模型沒看過的輸入欄。
:::

## 程式（補充）

### 指定順序，標記未知

陣列對應共用資料前3筆，以及驗證的未知店級。下段另用購買標籤示範LabelEncoder的用途。

```python
import numpy as np
from sklearn.preprocessing import OrdinalEncoder, OneHotEncoder, LabelEncoder
order = ["基本", "進階", "尊榮"]
train = np.array([[v] for v in order])
enc = OrdinalEncoder(categories=[order], handle_unknown="use_encoded_value", unknown_value=-1)
enc.fit(train)
print("店級:", enc.transform(train).ravel().tolist())
print("未知店級:", enc.transform([["企業"]]).ravel().tolist())
products = np.array([[v] for v in ["飲品", "食品", "日用品"]])
oh = OneHotEncoder(categories=[["飲品", "食品", "日用品"]], sparse_output=False)
print("商品矩陣:", oh.fit_transform(products).astype(int).tolist())
le = LabelEncoder()
print("標籤代碼:", le.fit_transform(["未轉換", "轉換", "未轉換"]).tolist())
```
```text
店級: [0.0, 1.0, 2.0]
未知店級: [-1.0]
商品矩陣: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
標籤代碼: [0, 1, 0]
```

:::tip[讀碼重點]
`categories=[order]`直接指定高低，避免自動排序。`unknown_value=-1`只是一個識別碼；它是否適合模型，仍需另外決定，不能當成業務上的最低級。
:::

## 怎麼用、怎麼判讀

先問有沒有順序，再問模型是否把代碼當連續量。最後才評估基數與儲存成本；同一類別欄在不同模型下，最適表示可能不同。

:::supplement[來源：scikit-learn Comparing Target Encoder with Other Encoders]
高基數可以比較稀疏獨熱與目標編碼。後者壓成少數欄位，卻引入標籤估計與資料洩漏風險，需依Target Encoding與折外統計安排流程。
:::

### 換個場景

| 場景／資料條件 | 表示起點 | 判讀重點 |
|---|---|---|
| 教育程度、服務等級 | 有序整數 | 先指定高低，不假設等距 |
| 城市、產品類型 | One-hot | 不把身分編成連續大小 |
| 高基數且與標籤相關 | 比較目標編碼 | 維度與過擬合一併考慮 |
| 交通車種等級（補充） | 基本＜進階＜尊榮 | 未知企業級不自行插入排序 |
| 製造錯誤代碼（補充） | 無序表示 | 代碼數字大不代表故障更嚴重 |

## 常見誤解

- **文字都能直接編成0、1、2。** 無序類別可能因此被誤解為有大小與距離。
- **有順序就一定等距。** 教育等級高低不能證明每一級的預測效果相等。
- **LabelEncoder與OrdinalEncoder只是兩個名字。** 在scikit-learn中，主要處理對象分別是y與X。（補充）
- **遇到未知類別就重新fit。** 重新編碼可能改變舊代碼語意，原模型不能直接沿用。（補充）

## 進階

### 編碼的效果與模型有關（補充）

有些模型提供原生類別處理；有些模型會把任何整數都當數值。應查實際模型介面，並固定切分比較，不能只由欄位型態或編碼器名稱推定效果。

### 參考來源

- 科目1指引5.1，`guide-1:5-4`～`guide-1:5-5`：無序獨熱、有序整數與教育例。
- 科目3指引5.1，`guide-3:5-7`～`guide-3:5-8`：模型用途、教育／服務等級、商品／城市、基數與順序風險。
- [OrdinalEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OrdinalEncoder.html)：指定順序、未知值約定與程式。
- [LabelEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.LabelEncoder.html)：標籤y用途與名稱校正。
- [OneHotEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html)：矩陣與固定類別表示。
- [NumPy ndarray.nbytes](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.nbytes.html)：基數與未知值小節的稠密儲存成本算例。
- [Google類別表示課程](https://developers.google.com/machine-learning/crash-course/categorical-data/one-hot-encoding)：整數身分與數學距離的教學思路。
- [不同編碼器比較教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder.html)：模型相依、基數與編碼取捨。

## 小結

- 先辨認有序、無序，再選表示，避免引入虛假距離。
- 有序整數只保留高低，不自動證明等距。
- 基數影響欄位、記憶體與訓練成本。
- 區分X與y的編碼器，未知值規則在訓練時定好。（補充）
