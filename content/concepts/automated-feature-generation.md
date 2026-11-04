---
id: automated-feature-generation
title: 自動特徵產生與交互作用
kind: technique
codes: [L21301]
aliases: [Auto Feature Generation]
summary: 依規則建立日期、轉換與組合候選，再由驗證決定哪些值得保留
goals:
  - id: g1
    text: 辨認日期、多項式與滯後候選，說明平台與人工檢查的分工
  - id: g2
    text: 由兩欄建立交互候選，並說明組合搜尋與驗證的順序
formula_groups:
  - id: polynomial-candidates
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PolynomialFeatures.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21301-A
guide_refs: [guide-1:5-5, guide-1:5-6]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 60筆製造資料每列屬於不同設備視窗，時間依日排序。工程師要自動產生星期、溫度平方與上一列溫度，哪項判斷正確？
    options:
      A: 星期與平方可列為候選；上一列不屬同一序列，不能直接當設備滯後值
      B: 三欄都可直接採用；只要依日期排序，上一列必定屬於同一設備的歷史
      C: 三欄都應直接刪除；只要不是原始資料欄位，自動產生就必定造成洩漏
      D: 只採用下一列溫度；未來溫度較接近故障結果，因此可取代當時可用資料
    answer: A
    explain:
      A: 日期與平方可由當時輸入計算，滯後則需確認同一實體的時間歷史。
      B: 時間排序不能消除設備或序列的邊界。
      C: 可得資訊的確定轉換不必然洩漏，仍需檢查用途與驗證。
      D: 未來才取得的溫度不能用於較早時點的預測。
  - id: c2
    goal: g2
    type: choice
    prompt: m000溫度60、振動1.0；m010溫度60、振動1.4。自動搜尋提出兩欄相乘的候選。哪個解讀合理？
    options:
      A: 兩筆交互值相同，因為溫度都是60；因此不用再比較驗證結果
      B: 兩筆交互值為61與61.4，因為交互作用一律表示兩欄加總
      C: 兩筆交互值為60與84，可表達共同變動，但是否保留仍須驗證
      D: 兩筆交互值為60與84，因此已證明溫度與振動共同造成故障
    answer: C
    explain:
      A: 相乘候選還包含振動，不能只看溫度是否相同。
      B: 本題候選是乘積，交互作用也不是一律定義為加法。
      C: 相乘保留兩欄共同狀態，但效用與泛化仍需透過驗證檢查。
      D: 數值運算與預測改善都不能單獨證明因果關係。
---

## 為什麼需要

原始欄位未必直接表達目標需要的關係。日期可能藏著週期，兩個欄位共同變動，也可能比各自的數值更有辨識力。

自動特徵產生（Automated Feature Generation）依轉換規則建立候選，讓後續程序比較。產生成功只代表得到新表示，還沒有證明它有用。

## 直覺

先限制允許的輸入與運算，再產生一小批候選。每個候選都要能解釋來源、時間與意義，接著交給自動特徵篩選與驗證回饋。

![先確認可用欄位，再產生候選與驗證；不合理的候選回到規則檢查。](figure:l21301-automated-feature-generation-candidates)

## 定義與公式

### 常見候選

| 類型 | 例子 | 要檢查什麼 |
|---|---|---|
| 日期拆解 | 年、月、星期、工作日 | 是否保留有用週期 |
| 數學轉換 | 加總、乘積、對數 | 定義域與欄位語意 |
| 多項式 | 平方、兩欄相乘 | 維度及過擬合 |
| 滯後與滯後交互 | 同一序列前一期值 | 歷史是否可得 |

指引舉Google AutoML、H2O.ai、AutoKeras、TPOT等工具，說明自動特徵工程的定位。具體支援哪些轉換會隨產品與版本不同，使用時須查該工具文件。

### 最小多項式候選組（補充）

兩個數值欄的二次展開可寫成：

$$
\phi(x_1,x_2)=(x_1,x_2,x_1^2,x_1x_2,x_2^2)
$$

$x_1$、$x_2$是兩個有限數值輸入，$\phi$是轉換後的五欄表示。這裡不含常數欄；乘積與平方的單位也會改變，不能直接當作原量測。

製造m000以溫度60、振動1.0代入，得到60、1、3600、60、1。m010的振動改為1.4時，乘積候選為84；兩列原本相同的溫度因而能配合不同振動表示。

更一般的設計見交互與聚合特徵；本頁重點是讓自動程序提出候選並保留檢查路徑。

## 走一次流程

### 1. 從共用資料提出候選

| 製造紀錄 | 溫度 | 振動 | 相乘候選 |
|---|---:|---:|---:|
| m000 | 60 | 1.0 | 60 |
| m009 | 87 | 1.0 | 87 |
| m010 | 60 | 1.4 | 84 |
| m020 | 60 | 1.8 | 108 |

日期也能拆成星期：例如m010在2026-01-11，對應星期日。零售同樣可由金額與互動次數提出組合，不能假設製造有效的組合在零售也有效。

### 2. 擋下不合條件的滯後（補充）

共用主資料每列屬於不同實體，沒有同一設備的前一期。直接取上一列會把其他設備的量測誤當歷史，所以JSON把滯後候選標成不允許。

另看同設備小例：設備甲在1月1日為60、1月2日為63，則1月2日可用的前期值為60。設備乙只有1月2日的70，沒有前期紀錄；不能借用設備甲的63。

### 3. 固定比較方式

產生候選後，檢查是否出現無意義的識別碼運算、過大欄數或不可得資訊。再用相同切分比較特徵組合，不要只挑訓練分數最高的那組。

工具對每組候選訓練模型，測試各組合對驗證預測的影響，再把較有用的組合送入下一輪。自動特徵篩選與驗證回饋的比較表，就把原始組、全部組與精簡組放在同一條件下比較。

:::supplement[來源：scikit-learn Common pitfalls 12.2；Google AutoML Benefits and limitations]
需要估計的填補或篩選只在訓練資料學得。日期與乘積雖是固定運算，輸入本身仍必須在預測時可得；可運算不代表可使用。
:::

## 程式（補充）

### 重建數值與切分

程式沿用前處理頁的製造規則、訓練索引與缺值位置。填補也只從相同35筆訓練資料估計。

```python
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import PolynomialFeatures
i = np.arange(60)
X = np.column_stack((60 + 3 * (i % 10), 1 + .4 * ((i // 10) % 3)))
X[[1, 2], 0] = np.nan
train = np.array([j for j in range(36) if j != 5])
fill = SimpleImputer(strategy="mean").fit(X[train])
poly = PolynomialFeatures(degree=2, include_bias=False)
generated = poly.fit_transform(fill.transform(X))
print("欄名:", poly.get_feature_names_out(["temperature", "vibration"]).tolist())
print("首列:", generated[0].tolist())
```
```text
欄名: ['temperature', 'vibration', 'temperature^2', 'temperature vibration', 'vibration^2']
首列: [60.0, 1.0, 3600.0, 60.0, 1.0]
```

:::tip[讀碼重點]
`include_bias=False`不產生常數1欄。這個展開不使用標籤或樣本統計；前面的`fill.fit`才會學到均值，因此它必須留在訓練集內。
:::

### 先分實體，再取前期值

```python
import pandas as pd
history = pd.DataFrame({"device": ["A", "A", "B"],
                        "time": ["2026-01-01", "2026-01-02", "2026-01-02"],
                        "temperature": [60, 63, 70]})
history = history.sort_values(["device", "time"])
history["lag1"] = history.groupby("device")["temperature"].shift(1)
print(history["lag1"].fillna(-1).astype(int).tolist())
```
```text
[-1, 60, -1]
```

輸出的−1只是印出「沒有前期值」的代碼，不是建議把缺值都填成−1。若預測時會一次預測多期，還要確認中間各期的實際值是否已取得。

## 怎麼用、怎麼判讀

候選的價值取決於模型、資料與任務。人工先定可用範圍，自動程序再比較組合，最後仍要保留每欄的來源與處理規則。

### 換個場景

| 場景／資料條件 | 可提候選 | 人工檢查點 |
|---|---|---|
| 日期欄、數值欄、時間序列 | 日期、多項式、滯後 | 型態與時間條件 |
| 製造（補充） | 溫度與振動乘積 | 同設備、單位與可得性 |
| 零售（補充） | 金額與互動次數組合 | 視窗與會員定義 |
| 農業（補充） | 日照與灌溉組合 | 時間窗與因果解讀 |

## 常見誤解

- **欄位越多，表現一定越好。** 冗餘與雜訊可能使模型更難泛化。
- **自動工具能保證找出真正因果。** 交互候選只提供新的預測表示。（補充）
- **排序後上一列就是滯後。** 還要確認實體、觀測間隔與可用時間。（補充）

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-5～5-6：支持平台定位、日期、數學、多項式、滯後與交互候選。
- [PolynomialFeatures](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PolynomialFeatures.html)：支持展開公式與程式。
- [scikit-learn前處理指南](https://scikit-learn.org/stable/modules/preprocessing.html#generating-polynomial-features)：支持多項式的功能與限制。
- [Google交叉特徵課程](https://developers.google.com/machine-learning/crash-course/categorical-data/feature-crosses)：參考組合表示與維度風險的教學思路；類別交叉與數值乘積仍有不同表示。
- [Google AutoML優缺點課程](https://developers.google.com/machine-learning/crash-course/automl/benefits-limitations)：支持人工限制與自動搜尋分工。
- [scikit-learn常見錯誤](https://scikit-learn.org/stable/common_pitfalls.html)：支持候選流程的擬合邊界。

## 小結

- 日期、數學、多項式與滯後都能成為候選。
- 交互作用表示兩欄共同狀態，並非因果證明。（補充）
- 自動產生之後，仍須檢查語意、時間與驗證結果。
- 滯後必須來自相同實體且當時可得的歷史。（補充）
