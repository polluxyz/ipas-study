---
id: missing-value-imputation
title: 缺失值處理
kind: technique
codes: [L23301, L21301]
aliases: [Imputation, Mean Imputation, Median Imputation, Missing Value, Missing Values, simple-imputation, 刪除與簡單補值]
requires: [descriptive-statistics, missingness-mechanisms, train-val-test-split]
summary: 依型態、缺失原因與時間邊界選擇刪除或補值，並檢查資訊損失
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-3, guide-3:5-2, guide-3:5-3]
goals:
  - id: g1
    text: 比較列欄刪除、均值、中位數與眾數補值，說明變異縮小及偏誤風險
  - id: g2
    text: 切分後只以訓練集fit填補規則，結合缺失原因辨認評估洩漏
  - id: g3
    text: 比較前後填補與插值，判斷未來資訊、連續缺口及外插限制
formula_groups:
  - id: observed-mean
    source: https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-A
  - id: variance-shrink
    source: https://numpy.org/doc/stable/reference/generated/numpy.var.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-A
  - id: linear-interpolation
    source: https://dlmf.nist.gov/3.3#i
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23301-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 6筆訓練溫度為10、20、30、80、缺、缺，類別欄有A、A、缺、A、B、B。簡單補值的數值何者正確？
    options:
      A: 均值25、中位35、類別補B
      B: 均值35、中位25、類別補A
      C: 均值35、中位30、類別補A
      D: 均值140、中位25、類別補1.5
    answer: B
    explain:
      A: 四個已觀測數值平均35、中位25，類別眾數是A，這組三項都對不上。
      B: 140除以4是35，中央20與30平均25，A出現最多次。
      C: 偶數筆的中位數要取中央兩筆平均，不能只取30。
      D: 140是總和而非平均，名目型A與B不能補成算術平均。
  - id: c2
    goal: g2
    type: choice
    prompt: 24筆訓練列的16個已觀測溫度平均35，8筆驗證列另有6個已觀測值。應如何處理驗證缺值？
    options:
      A: 用全部22個已觀測值重新fit，因為沒有用標籤
      B: 訓練維持16個觀測的均值35，驗證另用6個觀測fit自己的均值後再補值
      C: 保留訓練fit所得35，驗證只transform
      D: 先用8筆驗證真值挑出誤差最低的填補數字，再回填24筆訓練列的缺值
    answer: C
    explain:
      A: 即使沒有標籤，全表fit仍讓驗證分佈影響學到的轉換。
      B: 驗證另外估參數會改變轉換規則，與訓練流程不一致。
      C: 訓練資料估參數，其餘資料只套用，才保有評估邊界。
      D: 驗證真值只能用來評估，不能回流建立填補值。
  - id: c3
    goal: g3
    type: choice
    prompt: 每分鐘溫度為10、缺、缺、40、缺；第1分鐘當下要做預測，只有第0分鐘10°C可用。哪項做法符合時間邊界？
    options:
      A: 在短時間持平假設下沿用10，並保留缺失旗標
      B: 後填成40，因為第3分鐘的40已存在整份離線表，預測第1分鐘也能讀取
      C: 插值成20，因為不使用訓練標籤，參考第0與第3分鐘便不會造成時間洩漏
      D: 讀取第4分鐘教學真值50並回推第1分鐘，將計算結果當成當下的已觀測值
    answer: A
    explain:
      A: 前填只用當時已知值，但仍需限制陳舊程度並保留缺失資訊。
      B: 第3分鐘的40在預測當下尚未出現，後填會偷用未來。
      C: 20需要未來右端點40才能內插，沒有標籤也會造成時間洩漏。
      D: 教學真值不是當下觀測，不能成為合法輸入。
  - id: c4
    goal: g1
    type: choice
    prompt: 24筆訓練列中溫度缺8筆、備註缺18筆。已觀測溫度的母體式變異725，補均值後為483.333。何者正確？
    options:
      A: 刪備註欄等於刪掉其中18個空白，會連帶清除溫度欄的8個缺值，仍保有24筆完整資料
      B: 刪掉溫度缺值列只會少8個特徵，樣本仍是24筆；刪備註欄則使樣本變成6筆
      C: 變異由725降至483.333代表填入數值更接近真值，因此不必再檢查缺失原因及分佈
      D: 刪列會剩16筆，刪備註欄仍有24筆；補均值會壓縮離散程度
    answer: D
    explain:
      A: 刪備註欄只拿掉該特徵，不會改變另一欄的空白。
      B: 列代表樣本，刪掉8列會減少8筆訓練資料。
      C: 填入相同中心值本來就會降低變異，不能據此證明復原正確。
      D: 列欄刪除損失不同，均值補值保留列數但不保證保留分佈。
---

## 為什麼需要

空白不是0，也不是可以直接交給任何模型的數字。刪掉它會失去樣本或欄位，補上它則會帶入估計誤差。

缺失值處理（Imputation在此指填補）要同時看欄位型態、缺失比例、缺失機制與模型需求。比例只是線索，不能單獨決定哪種方法正確。

## 直覺

刪列是拿掉整筆樣本，刪欄是放棄一項特徵。補值保住表格形狀，但「表格完整」不等於「資訊完整」。

![刪溫度缺值列只剩16個樣本，刪備註欄仍有24列且溫度缺口仍在。](figure:l23301-missing-value-imputation-deletion)

均值補值把空白拉到同一個中心。若原本缺的是高溫，補成平常溫度就可能抹掉風險；原因不同，偏誤也不同。

## 定義與公式

### 基本方法怎麼選

| 方法 | 適合的資料條件 | 主要代價 |
|---|---|---|
| 刪列 | 缺失極少、樣本足且缺失分佈無偏 | 整筆樣本消失 |
| 刪欄 | 缺失太多且資訊價值不足 | 整項特徵消失 |
| 均值 | 數值欄，用中心當簡單基準 | 受極端值影響、可能降變異 |
| 中位數 | 數值欄偏態或含極端值 | 仍可能改變分佈與關係 |
| 眾數 | 類別欄，以最常出現值補入 | 多數類別可能更集中 |

不設定「少於某百分比就一定刪除」的通則。若漏記集中在重要族群，少量缺值也可能造成選擇偏誤。

### 從已觀測值求中心（補充）

對單一欄，先排除缺值，再求平均：

$$
\bar{x}_{O}=\frac{1}{n_O}\sum_{i\in O}x_i
$$

$O$是訓練集中該欄有值的列集合，$n_O$是其筆數，$x_i$是觀測值；至少要有一筆。不是把缺值當0，也不是除以含缺值的總列數。

中位數取排序後的中央值，偶數筆取中央兩值平均；眾數取次數最多的類別。全欄都缺或眾數同票時，須另訂明確規則，不能假裝已學到可靠中心。

### 均值補值為何縮小變異（補充）

本頁用母體式分母描述這批資料。令$S$是已觀測值相對其平均的離差平方和：

$$
S=\sum_{i\in O}(x_i-\bar{x}_O)^2,\qquad
v_{\mathrm{before}}=\frac{S}{n_O},\qquad
v_{\mathrm{after}}=\frac{S}{n_O+m}
$$

$m$是填補筆數。每個新值等於平均，離差為0，所以平方和不變，分母卻變大。此結論比較「已觀測子集」與「填補後資料」，不代表知道完整真值的變異。

### 時間填補與插值

前值填補沿用較早的觀測；後值填補取較晚的觀測。插值用缺口兩側的數值推估中間；適用於有順序且短缺口變化可合理近似的資料。

![三種方法沿用不同端點；圓點是原觀測，方點是填補，尾端可能仍缺。](figure:l23301-missing-value-imputation-time)

:::supplement[來源：NIST DLMF 3.3(i)，公式3.3.1–3.3.2取n=1；pandas Working with missing data]
NIST的Lagrange插值公式只取兩個節點，整理後即為下式。線性插值依時間距離分配兩端的變化量：

$$
\hat{x}(t)=x_a+\frac{t-t_a}{t_b-t_a}(x_b-x_a),\qquad t_a<t<t_b
$$

$t_a,t_b$是兩個已觀測時刻，$x_a,x_b$是對應數值，$t$是缺值時刻。兩端時間須不同且已知；不等距時間要用實際時間差，不能直接按列位置平均。
:::

## 算一次

### 均值、中位數與眾數（補充）

共用資料`L23301-A-missing-data.json`的製造訓練前6筆：10、20、30、80、缺、缺，這個觀測模式重複4次。

| 欄位 | 有值部分 | 手算 | 缺口填入 |
|---|---|---|---|
| 溫度均值 | 10、20、30、80 | 140÷4=35°C | 35、35 |
| 溫度中位數 | 10、20、30、80 | (20+30)÷2=25°C | 25、25 |
| 類別眾數 | A、A、A、B、B | A出現3次 | A |

類別欄的缺值在第3列，與溫度欄的第5、6列不同。上表只列各欄有值的部分，不能把兩欄的空白位置混為一談。

整個訓練欄有16個數值，總和560，平均仍為35°C，中位數仍為25°C。類別欄另有20個觀測，A有12、B有8，眾數也是A。

### 補完後的分佈

簡單補值可能降低變異，不能只看平均是否保住。

:::supplement[來源：NumPy var]
已觀測溫度的母體式變異為725°C²，補均值後降為483.333°C²。

24筆的離差平方和是11600：補前除以16得725，補後除以24得483.333。若改採樣本式分母，則是11600÷15與11600÷23；兩者也下降，但不能混用分母比較。
:::

![八個缺口都填35°C，新增點堆在中心，母體式變異由725降至483.333。](figure:l23301-missing-value-imputation-variance)

### 訓練與驗證的界線（補充）

主表缺值由已記錄維護時段造成，符合此教學生成規則下的MAR。若改成溫度超過40°C才漏記，就有MNAR風險；同樣的均值補值不能保證消除偏誤。

先用JSON的同一批32筆製造真值比較替代遮罩：總和1240，完整均值1240÷32=38.75°C。這是機制示範的核算基準，不是補值器可用的輸入。

| 遮罩規則 | 刪列後筆數 | 觀測均值°C | 與38.75的差°C |
|---|---:|---:|---:|
| MCAR：隨機遮8列 | 24 | 36.875 | −1.875 |
| MNAR：超過40°C漏記 | 20 | 24 | −14.75 |

MCAR這次仍有有限樣本差異；不能把「不系統性偏向低溫」誤讀為每次均值完全相同。MNAR遮罩專門去掉高溫，留下的均值更低。

以下回到主表的MAR遮罩與原切分；替代遮罩的32筆真值不參與fit。

正確流程是「固定訓練0–23、驗證24–31 → 訓練fit得35 → 兩邊transform」。錯誤流程是「全表fit → 才切分」，會把均值改成850÷22=38.636。

沒有用標籤也可能資料洩漏。驗證只接受已學轉換；若用驗證結果挑補值方法，最後還要保留獨立測試集。

### 同一時間缺口的三種結果

:::supplement[來源：pandas Working with missing data；共用例子time_series]
另取JSON的5分鐘序列：10、缺、缺、40、缺。已觀測端點在第0及第3分鐘。

| 方法 | 第1分鐘 | 第2分鐘 | 第4分鐘 |
|---|---:|---:|---:|
| 前填 | 10 | 10 | 40 |
| 後填 | 40 | 40 | 仍缺 |
| 線性插值，只補內部 | 20 | 30 | 仍缺 |

線性插值第1分鐘：10加上全程30°C變化的三分之一，得到20°C。第2分鐘取得三分之二，得到30°C。

第1分鐘要即時預測時，40尚未發生。先用整條序列後填或插值，再切訓練與驗證，仍然偷用了未來；只做train-only fit並不能阻止這類洩漏。

先按機台或實體分組、依時間排序，再檢查當下可用資訊。前填也要限制連續缺口與有效期限；序列起點缺值時，沒有先前值可沿用。
:::

前後填補沿用單一端點，插值則參考缺口兩側。方法應配合資料的時間性及缺失程度選擇。

## 程式（補充）

### 統計量只從訓練集學

下段陣列與JSON的32筆製造資料一致。固定切分，不需要重新抽樣。

```python
import numpy as np
from sklearn.impute import SimpleImputer
train = np.tile([10., 20., 30., 80., np.nan, np.nan], 4).reshape(-1, 1)
valid = np.array([30., 40., 50., 100., np.nan, np.nan, 30., 40.]).reshape(-1, 1)
for strategy in ["mean", "median"]:
    imp = SimpleImputer(strategy=strategy).fit(train)
    print(strategy, imp.statistics_.tolist(), imp.transform(valid)[4:6, 0].tolist())
imp = SimpleImputer().fit(train)
filled = imp.transform(train)
print(f"變異: {np.nanvar(train):.3f} -> {np.var(filled):.3f}")
wrong = SimpleImputer().fit(np.vstack([train, valid]))
print(f"錯誤全表均值: {wrong.statistics_[0]:.3f}")
cat = np.array(["A", "A", np.nan, "A", "B", "B"], dtype=object).reshape(-1, 1)
print("眾數:", SimpleImputer(strategy="most_frequent").fit(cat).statistics_.tolist())
```
```text
mean [35.0] [35.0, 35.0]
median [25.0] [25.0, 25.0]
變異: 725.000 -> 483.333
錯誤全表均值: 38.636
眾數: ['A']
```

### 同一序列的時間填補

`limit_area="inside"`限制只補兩個已觀測端點之間，避免把最後一點也默認補成40。

```python
import pandas as pd
s = pd.Series([10., None, None, 40., None])
def show(x):
    return [None if pd.isna(v) else float(v) for v in x]
print("前填:", show(s.ffill()))
print("後填:", show(s.bfill()))
print("內插:", show(s.interpolate(limit_area="inside")))
print("只看當下前兩筆:", show(s.iloc[:2].ffill()))
```
```text
前填: [10.0, 10.0, 10.0, 40.0, 40.0]
後填: [10.0, 40.0, 40.0, 40.0, None]
內插: [10.0, 20.0, 30.0, 40.0, None]
只看當下前兩筆: [10.0, 10.0]
```

:::tip[讀碼重點]
`fit`讀取訓練統計量，`transform`沿用它。時間序列的`bfill`和`interpolate`另有未來資訊邊界；函式成功執行不表示符合預測情境。
:::

## 怎麼用、怎麼判讀

先問這欄為何缺失，再看要保留的資訊。缺得很少、樣本充足且無偏時可考慮刪列；大量缺失欄可評估刪欄或相似樣本與模型補值，仍需衡量欄位價值。

### 換個場景

| 場景／資料條件 | 方法方向 | 判讀重點 |
|---|---|---|
| 缺失極少、樣本多且無偏 | 刪除作基準 | 列數與族群組成損失 |
| 數值或類別欄位 | 均值、中位數或眾數 | 型態、極端值及變異 |
| 時間性資料的缺口 | 前後填補或插值 | 順序及資訊可用時點 |
| 製造即時告警（補充） | 期限內前填並保留旗標 | 不把陳舊讀數當新量測 |
| 零售金額（補充） | 偏態時以中位數作基準 | 高額漏記不能只靠中心復原 |

:::supplement[來源：scikit-learn Common pitfalls；van Buuren 1.3]
本組零售訓練均值350元、中位數250元，與製造同一規則但單位不同。方法比較要固定驗證列；刪除法只留下6/8列，應同時報可處理比例，不能以較容易的子集宣稱勝出。
:::

## 常見誤解

- **補均值不會改資料分佈。** 平均可能保住，離散與欄位關係仍可能改變。
- **缺得少就一定無偏。** 若缺失集中在高溫或高額交易，少量也可能改變結論。
- **前填、後填和插值隨時可互換。** 它們依賴不同時點的資訊，線上與事後分析的界線不同。
- **無標籤處理不會洩漏。** 補值參數或時間端點也會帶入評估時不該用的資訊。（補充）

## 進階

### 保留不確定性（補充）

簡單補值通常只給一個確定數字。做統計推論時，若把估計值當實測值計算信賴區間，可能低估不確定性；這與能否訓練預測模型是兩個問題。

### 參考來源

- 科目3指引5.1，`guide-3:5-2`～`guide-3:5-3`：刪除、均值／中位數／眾數、變異與偏誤。
- 科目1指引5.1，`guide-1:5-3`：前後填補、插值與高缺失欄位。
- [SimpleImputer](https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html)：中心估計與程式API。
- [NumPy var](https://numpy.org/doc/stable/reference/generated/numpy.var.html)：變異分母及縮小算例。
- [NIST DLMF 3.3(i)](https://dlmf.nist.gov/3.3#i)：線性插值公式；公式3.3.1–3.3.2取n=1、兩節點後整理為教材式。
- [NumPy interp](https://numpy.org/doc/stable/reference/generated/numpy.interp.html)：分段線性插值的API語意與端點行為。
- [pandas缺值處理](https://pandas.pydata.org/docs/user_guide/missing_data.html)：時間填補程式與限制。
- [scikit-learn Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：train-only fit與評估邊界。
- [van Buuren：Ad-hoc solutions](https://stefvanbuuren.name/fimd/sec-simplesolutions.html)：刪除、均值補值及時間延用的限制。

## 小結

- 刪列失去樣本，刪欄失去特徵；比例不能單獨決定策略。
- 均值、中位數、眾數要配合型態，補值可能壓縮變異。
- 前後填補與插值有不同的資料順序與可用時點。
- 先切分再fit；時間填補還要逐時點確認未來邊界。（補充）
