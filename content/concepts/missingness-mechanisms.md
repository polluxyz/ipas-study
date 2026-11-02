---
id: missingness-mechanisms
title: 缺失機制與缺失指標
kind: theory
codes: [L23301]
aliases: [MAR, MCAR, MNAR, Missing Indicator]
requires: []
summary: 先問值為何不見，再用指標保留缺失訊號，避免把補值誤當真值
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-2, guide-3:5-3]
goals:
  - id: g1
    text: 建立缺失指標，解釋感測失效與人工漏填的來源及不保證去偏的限制
  - id: g2
    text: 區分MCAR、MAR、MNAR，說明刪除偏誤與僅靠觀測資料難以確證機制
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 4筆溫度原為10、缺、30、缺，先補成10、20、30、20。原始缺失指標應為哪一列？
    options: { A: '0、0、0、0', B: '1、0、1、0', C: '0、1、0、1', D: '10、20、30、20' }
    answer: C
    explain:
      A: 這是補完後才檢查缺值，原始缺失資訊已消失。
      B: 本頁約定缺失為1、已觀測為0，這列把意義反過來。
      C: 原本第2與第4筆缺失，所以指標在這兩筆為1。
      D: 這是補值後的數值欄，不能表示哪些數字原本缺失。
  - id: c2
    goal: g2
    type: choice
    prompt: 工廠32筆資料中，記錄已知為「維護時段」的10筆封包全部未入庫；假設缺失只由已觀測時段決定，不再依賴未觀測溫度。哪個機制最合適？
    options: { A: MAR, B: MCAR, C: MNAR, D: 完全沒有缺失機制 }
    answer: A
    explain:
      A: 缺失由已觀測時段決定，給定時段後不再依賴未觀測溫度，符合MAR假設。
      B: 缺失機率依時段而異，不符合與資料值無關的MCAR條件。
      C: 題目已排除給定時段後仍依賴未觀測溫度，不能據此稱為MNAR。
      D: 值不見的規則正是機制，不會因規則已知就不存在。
  - id: c3
    goal: g2
    type: choice
    prompt: 某儀器在真實溫度高於40°C時漏記，32筆只看到較低溫。分析者刪掉缺值列，再新增一個缺失旗標。哪項判斷合理？
    options:
      A: 缺值比例低就能保證均值不偏
      B: 缺失旗標會自動還原每筆高溫
      C: 只要觀測到的溫度近似常態，就證明MCAR
      D: 屬MNAR風險，刪列可能低估高溫，旗標無法取回被刪資料
    answer: D
    explain:
      A: 偏誤取決於缺失原因及目標量，比例本身不能保證無偏。
      B: 旗標只記是否缺失，不含未觀測溫度的實際大小。
      C: 留下來的分佈形狀不能證明缺失與未觀測值無關。
      D: 高溫本身促成漏記，刪除會選擇性失去高溫，需另查量測與來源。
---

## 為什麼需要

感測器失效、人工漏填與系統錯誤，都可能產生空白。空白看起來相同，留下的樣本卻可能不同；只看缺值比例，容易選錯處理方式。

缺失指標（Missing Indicator）把「原本是否缺值」另存為欄位，讓模型能利用這個訊號。它不會直接告訴我們空白的原因。

## 直覺

溫度沒記到，可能是隨機掉封包，也可能是高溫使儀器超量程。後者若只留下有值列，看到的世界就會偏冷。

:::supplement[來源：van Buuren 1.2 Concepts of MCAR, MAR and MNAR]
三種機制分的是缺失機率依賴哪些資訊。圖中箭頭代表生成假設，不能只憑缺值的排列方式確認因果。
:::

![比較缺值依賴隨機抽樣、已觀測時段，或未觀測真值；指標只記錄是否缺失。](figure:l23301-missingness-mechanisms-causes)

## 定義與公式

缺失指標通常約定：原欄位缺失記1，原本有值記0。它與補好的數值欄一起輸入模型，保留原先空白的位置。

### 三種缺失機制（補充）

| 機制 | 缺失機率的條件 | 製造溫度的生成假設 |
|---|---|---|
| 完全隨機缺失（MCAR） | 與已觀測、未觀測值都無關 | 獨立隨機抽8個封包遮住 |
| 隨機缺失（MAR） | 給定已觀測資訊後，不再依賴未觀測值 | 只依已記錄維護時段漏記 |
| 非隨機缺失（MNAR） | 給定已觀測資訊後，仍依賴未觀測值 | 未量到的高溫造成超量程 |

MAR的「隨機」不表示每筆缺失機率一樣。主例給定已觀測時段後，缺失不再依賴未觀測溫度，才符合MAR；若仍依賴，就不符合這項假設。

僅靠留下的資料，通常無法確證MAR或排除MNAR。要結合設備日誌、表單流程、補訪或不同假設的敏感度分析。

## 走一次流程

### 先留指標，再補值

:::supplement[來源：scikit-learn MissingIndicator；SimpleImputer]
共用資料`L23301-A-missing-data.json`的製造溫度，先看固定訓練列中的6筆小例。M01–M06的原值為10、20、30、80、缺、缺。

| 列ID | 原溫度°C | 補成均值後°C | 原缺失指標 |
|---|---:|---:|---:|
| M01 | 10 | 10 | 0 |
| M02 | 20 | 20 | 0 |
| M03 | 30 | 30 | 0 |
| M04 | 80 | 80 | 0 |
| M05 | 缺 | 35 | 1 |
| M06 | 缺 | 35 | 1 |

兩筆35是估計，不是量測結果。先補值再判斷是否缺失，六個指標都會變0，來源資訊就不見了。
:::

因此，缺失指標與補值欄要分開保留：一欄表示原本有沒有量到，另一欄才是交給模型的數值。

### 同一欄位換三種原因（補充）

JSON的`mechanism_scenarios`保留同一真值欄的替代遮罩，沒有把三種機制混在一起。主表用已觀測維護時段造成的MAR遮罩。

MNAR替代情境不提供能精準還原真值的輔助欄。分類要依當時可觀測的資訊集合判斷，不能一邊知道完整真值關係，一邊宣稱它仍不可觀測。

1. **MCAR情境**：用固定種子獨立抽8列。刪除後樣本較少；在此假設下，不會系統性只留下低溫。
2. **MAR情境**：維護時段漏記。直接刪除會失去這些時段，不能只憑「知道原因」就宣稱整體平均無偏。
3. **MNAR情境**：超過40°C就漏記。留下的溫度最高只有40°C，刪列可能低估高溫風險；補上旗標也無法重建真值。

零售同欄的換景是金額：隨機同步遺漏、已記錄通路的同步規則、或高額訂單本身未被登錄。三者須依蒐集規則分辨，不能由空白直接猜。

## 程式（補充）

下段用共用資料前6筆驗證指標保留位置。明確指定`features="all"`，輸出欄位不會只取fit時曾缺值的欄。

```python
import numpy as np
from sklearn.impute import MissingIndicator, SimpleImputer
x = np.array([10., 20., 30., 80., np.nan, np.nan]).reshape(-1, 1)
flag = MissingIndicator(features="all").fit_transform(x).astype(int)
filled = SimpleImputer().fit_transform(x)
print("補值:", filled.ravel().tolist())
print("原指標:", flag.ravel().tolist())
print("補後才建:", np.isnan(filled).astype(int).ravel().tolist())
```
```text
補值: [10.0, 20.0, 30.0, 80.0, 35.0, 35.0]
原指標: [0, 0, 0, 0, 1, 1]
補後才建: [0, 0, 0, 0, 0, 0]
```

:::tip[讀碼重點]
先從原始`x`取指標，再另做補值。`features="all"`保留全部輸入欄；在多欄情況下，須確認指標與原欄位的對應。
:::

## 怎麼用、怎麼判讀

缺失指標常搭配樹模型，讓模型分開看原有值與補值。指標有預測力時，仍應回頭檢查缺失來源，避免模型依賴偶然的蒐集流程。

:::supplement[來源：van Buuren 1.2；scikit-learn MissingIndicator]
指標不保證消除選擇偏誤。若部署時更換設備或表單，缺失訊號與目標的關係也可能改變；要在符合部署情境的驗證資料檢查。

同一資料的M03類別欄因人工漏填而空白，類別指標應記1；即使補成眾數A，也不能當成原本填了A。指標保留漏填訊號，人工原因本身卻不能直接證明MCAR或MAR。
:::

### 換個場景

| 場景／資料條件 | 應追查的來源 | 指標的用途或限制 |
|---|---|---|
| 感測失效 | 超量程、斷線或系統錯誤 | 保留未量到的訊號 |
| 人工漏填 | 表單規則與填寫負擔 | 分辨缺填和真實數值 |
| 樹模型含缺值欄 | 模型是否利用缺失模式 | 指標是額外資訊，不是答案 |
| 零售高額訂單（補充） | 金額是否影響漏記 | 避免低估高額交易 |
| 醫療追蹤（補充） | 症狀是否影響回診 | 未回診不等於已康復 |

## 常見誤解

- **缺失就是0。** 0可能是真實溫度或金額；用它代缺值會混淆兩種意義。
- **MAR等於完全隨機。** MAR允許依已觀測資訊改變缺失機率。（補充）
- **旗標保證去偏。** 它沒有增加未觀測真值，也沒有找回已刪樣本。（補充）

## 進階

### 哪些資訊在上線時取得（補充）

缺失指標應由預測當下的欄位產生。事後調查才知道的「原因」與教學真值，可以用來稽核，但不可直接當成線上可用特徵。

### 參考來源

- 科目3指引5.1，`guide-3:5-2`～`guide-3:5-3`：感測、人工與系統來源、缺失指標與樹模型。
- [van Buuren：MCAR、MAR與MNAR](https://stefvanbuuren.name/fimd/sec-MCAR.html)：三機制定義、生成例子及敏感度分析。
- [van Buuren：Ad-hoc solutions](https://stefvanbuuren.name/fimd/sec-simplesolutions.html)：刪除與指標法的偏誤限制。
- [MissingIndicator](https://scikit-learn.org/stable/modules/generated/sklearn.impute.MissingIndicator.html)：程式與欄位選取。
- [SimpleImputer](https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html)：先留指標再補值的算例。
- [scikit-learn缺值處理](https://scikit-learn.org/stable/modules/impute.html)：指標搭配補值與模型。
- [scikit-learn Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：進階的預測可用時間邊界。

## 小結

- 先追查感測、人工與系統來源，再決定處理方式。
- 缺失指標保留原先空白的位置，應在補值前建立。
- MCAR、MAR、MNAR取決於缺失依賴的資訊，外觀通常不能確證。（補充）
- 旗標與刪除都不能保證去偏。（補充）
