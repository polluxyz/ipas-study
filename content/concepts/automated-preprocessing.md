---
id: automated-preprocessing
title: 自動前處理與目標編碼
kind: technique
codes: [L21301]
aliases: [自動編碼與填補]
requires: [target-encoding]
summary: 依欄位型態組合填補與編碼，並把估計所需資訊留在訓練範圍內
goals:
  - id: g1
    text: 依數值與類別條件選擇填補、One-hot或目標編碼，串成前處理
  - id: g2
    text: 畫出目標編碼的訓練內估計邊界，辨認標籤洩漏路徑
guide_refs: [guide-1:5-3, guide-1:5-4, guide-1:5-6]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 35筆製造訓練資料包含缺值溫度、振動與兩種無序班別。某欄設備編號雖為整數，卻只代表身分。哪種自動處理安排合理？
    options:
      A: 整數設備編號當連續量，班別按字典順序當高低，缺值用驗證平均填補
      B: 所有欄都做目標編碼，使用完整資料標籤建立對照，再切出訓練與驗證
      C: 溫度用訓練內統計填補，班別比較One-hot，設備編號另按語意判斷
      D: 缺值溫度全部改成0，設備編號和班別都按大小排序，省去後續驗證比較
    answer: C
    explain:
      A: 設備編號不帶連續大小，無序班別也沒有高低，驗證資料不應參與填補估計。
      B: 非所有欄都適合目標編碼，切分前使用完整標籤會引入洩漏。
      C: 型態只供分派起點，語意和訓練內擬合邊界仍須人工確認。
      D: 0與排序都可能引入錯誤含義，省去驗證無法確認處理是否合適。
  - id: c2
    goal: g2
    type: choice
    prompt: 一個類別在訓練資料只出現1次，該列標籤為1。工程師用含該列自身答案的類別平均編碼訓練列，再用測試標籤補齊未知類別。問題在哪？
    options:
      A: 只有類別太少的問題，加入更多未知類別就能保證不會洩漏
      B: 只有輸出不是整數的問題，將平均四捨五入即可安全訓練
      C: 只有測試集少於訓練集的問題，兩份資料等量就能安全估計
      D: 訓練列讀到自身答案且測試答案參與編碼，需隔離兩條路徑
    answer: D
    explain:
      A: 類別數量不是核心，關鍵是答案流入該列表示及測試資訊流入訓練。
      B: 更換數值表示不會移除答案資訊，四捨五入仍然可能保留洩漏。
      C: 筆數相等不能保證估計獨立，測試答案仍不得用於編碼。
      D: 訓練表示需用不含自身標籤的估計，測試只套用訓練學到的映射。
---

## 為什麼需要

同一張表可能同時含數值、類別與缺值。手動逐欄寫處理容易漏掉欄位，也容易讓訓練和上線採用不同規則。

自動前處理把欄位分派到合適的填補與編碼程序。它能節省重複操作，但不能替代業務語意與資料使用邊界的檢查。

## 直覺

數值欄與類別欄走不同支線，再合成模型輸入。先判斷欄位的意思，再讓工具依已確認的型態分派；整數設備編號未必是連續數值。

:::supplement[來源：scikit-learn Column Transformer with Mixed Types]
自動化處理的是「按規則分派與重複執行」。哪些欄位允許進入模型、填補是否合理、類別有沒有順序，仍由人確認。
:::

## 定義與公式

### 依資料條件建立候選

| 條件 | 處理候選 | 如何比較 |
|---|---|---|
| 數值有缺漏 | 均值填補 | 簡單、易重現的起點 |
| 缺值可由其他欄預測 | 模型填補 | 需要更多訓練與檢查 |
| 無序類別 | One-hot編碼 | 每類別以指示欄表示 |
| 高基數類別（補充） | 比較目標編碼（Target Encoding） | 兼顧維度、稀有類別與洩漏 |

指引列出這些方法作為自動選擇的候選，沒有保證工具一定選對。填補細節見缺失值處理，類別表示見類別特徵編碼；目標編碼的統計與平滑見Target Encoding 與折外統計。

### 擬合邊界（補充）

均值、類別詞彙表及目標編碼映射都屬於「從資料學到的設定」。先切分，再只用訓練資料擬合；驗證和測試資料使用同一組設定轉換。

目標編碼另有一層限制：訓練列的表示也不應直接包含自身答案。類別只有1筆時，直接用自身標籤的平均，相當於把答案放回特徵。

## 走一次流程

### 1. 選擇各支線

製造例子用溫度、振動和班別。先排除重送與禁止輸入欄位；溫度缺值可先試均值填補，兩種無序班別先試One-hot。

零售同理：金額與互動次數走數值支線，通路走類別支線。若有大量通路類別，可比較目標編碼，而非把名稱任意排成高低。

:::supplement[來源：scikit-learn Imputation of missing values、TargetEncoder；本組選擇情境]
以下是共用例子的**假設變體**，不宣稱原資料已符合這些條件。原例的兩種班別先用One-hot；35筆訓練資料的缺值先用均值填補，作為比較起點。

| 假設資料條件 | 選擇案例與理由 | 決定方式 |
|---|---|---|
| 零售通路擴為40種，多數少於3筆 | 比較目標編碼，控制One-hot欄數；稀有類需平滑與折外估計 | 固定時間驗證，確認品質與未知通路處理 |
| 製造溫度可由振動與班別預測 | 比較模型填補，利用其他可用欄的關係；不使用故障答案 | 在訓練內遮蔽已知值比較填補誤差，再比較下游驗證 |

兩個變體都先保留簡單方法作基準。若目標編碼不穩或模型填補未改善，就沿用One-hot或均值；方法較複雜並不是採用理由。
:::

### 2. 只在訓練部分學設定（補充）

製造35筆訓練資料的溫度填補值約72.909攝氏，振動均值約1.343。驗證12筆只套用這些設定；不得先加入驗證資料重新計算。

One-hot的兩種班別產生兩欄，再加兩個數值欄，合計4欄。輸出形狀在驗證時也維持4欄，未知班別則採預先約定的處理規則。

### 3. 目標編碼再隔離自身標籤（補充）

![外部驗證與測試標籤不進編碼；訓練列的表示由其他訓練折估計。](figure:l21301-automated-preprocessing-fit-boundary)

訓練內再切折：用其他折的特徵與標籤估計映射，轉換留出的那一折，輪流完成折外表示。外部驗證與測試則用整份訓練資料學到的映射轉換，禁止提供它們的標籤。

這是折外估計（out-of-fold）的作用。若資料有時間限制，內部估計也必須遵守時間；不能直接套用會混入未來的隨機切折。

## 程式（補充）

### 重建同一份製造資料

依共用JSON的固定規則重建，避免依賴程式執行目錄。只重建建模所需欄位；驗算已逐欄對照59筆去重資料。

```python
import numpy as np
import pandas as pd
i = np.arange(60)
df = pd.DataFrame({"temperature": 60 + 3 * (i % 10),
                   "vibration": 1 + .4 * ((i // 10) % 3),
                   "shift": np.where(i % 2 == 0, "A", "B")})
df.loc[[1, 2], "temperature"] = np.nan
train = np.array([j for j in range(36) if j != 5])
val = np.arange(36, 48)
print("訓練／驗證:", len(train), len(val))
```
```text
訓練／驗證: 35 12
```

### 按型態分派並保留同一組設定

```python
from sklearn.compose import make_column_transformer, make_column_selector
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
num = make_pipeline(SimpleImputer(strategy="mean"), StandardScaler())
cat = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
prep = make_column_transformer(
    (num, make_column_selector(dtype_include=np.number)),
    (cat, make_column_selector(dtype_exclude=np.number)))
a = prep.fit_transform(df.loc[train])
b = prep.transform(df.loc[val])
print("形狀:", a.shape, b.shape)
print("訓練均值:", prep.transformers_[0][1][0].statistics_.round(3).tolist())
```
```text
形狀: (35, 4) (12, 4)
訓練均值: [72.909, 1.343]
```

:::tip[讀碼重點]
`df`只有事先允許的三欄，沒有標籤、事件鍵或未來結果。數值以外的欄只剩班別，故可用`dtype_exclude=np.number`分派；其他資料須先排除日期、自由文字等欄。

`fit_transform`只接訓練資料；驗證使用`transform`。若進入交叉驗證，整個前處理須放在每個訓練折裡重新擬合。
:::

目標編碼的`fit_transform`包含交叉擬合；先擬合再轉換訓練列，不能視為等價。完整統計例子見Target Encoding 與折外統計。

## 怎麼用、怎麼判讀

檢查轉換後的欄數、缺值是否處理、未知類別規則，以及每個設定在哪份資料上學得。自動分派成功，只能證明規則有執行，不能證明選到最佳表示。

### 換個場景

| 場景／資料條件 | 候選處理 | 判讀重點 |
|---|---|---|
| 類別與缺失資料 | One-hot／目標編碼、均值／模型填補 | 依資料條件比較 |
| 製造感測（補充） | 數值填補、班別編碼 | 單位與識別碼語意 |
| 零售通路（補充） | 比較低、高基數表示 | 稀有類別與未知通路 |
| 交通站點（補充） | 站點編碼、流量填補 | 時間切分與未來資訊 |

## 常見誤解

- **選出型態就不必看語意。** 數字編號與數值量測可能需要不同處理。
- **目標編碼不訓練模型，所以不會洩漏。** 標籤統計本身就會傳遞答案。（補充）
- **驗證資料也可重算均值。** 這會讓驗證資訊參與擬合。（補充）

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-3、5-4、5-6：支持填補、類別編碼及自動選擇候選。
- [Column Transformer混合型態教學](https://scikit-learn.org/stable/auto_examples/compose/plot_column_transformer_mixed_types.html)：支持分支設計與程式安排。
- [make_column_selector](https://scikit-learn.org/stable/modules/generated/sklearn.compose.make_column_selector.html)：支持按型態分派API。
- [缺失值填補指南](https://scikit-learn.org/stable/modules/impute.html#multivariate-feature-imputation)：支持利用其他欄預測缺值的模型填補選擇案例。
- [TargetEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.TargetEncoder.html)：支持交叉擬合與fit_transform的差異。
- [目標編碼交叉擬合教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder_cross_val.html)：支持自身標籤洩漏的教學思路。
- [scikit-learn常見錯誤](https://scikit-learn.org/stable/common_pitfalls.html)：支持訓練內擬合邊界。

## 小結

- 先確認欄位語意，再依型態分派處理。
- 填補與編碼有多種候選，效果仍須驗證。
- 驗證與測試只套用訓練學到的設定。（補充）
- 目標編碼還要防止訓練列讀到自身答案。（補充）
