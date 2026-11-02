---
id: power-transforms
title: 對數與冪次轉換
kind: technique
codes: [L21301, L23301]
aliases: [Box-Cox, Log Transform, Power Transform, Yeo-Johnson]
requires: [feature-scaling]
summary: 以非線性轉換調整偏態與間距，選法先看分布及數值定義域
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-7, guide-3:3-8]
goals:
  - id: g1
    text: 比較縮放與對數轉換，從右偏及對稱欄位判斷是否值得轉換
  - id: g2
    text: 依零值、負值與偏態選擇對數、根號、Box-Cox或Yeo-Johnson
formula_groups:
  - id: log-and-log1p
    source: https://numpy.org/doc/stable/reference/generated/numpy.log1p.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: square-root
    source: https://numpy.org/doc/stable/reference/generated/numpy.sqrt.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: cube-root
    source: https://numpy.org/doc/stable/reference/generated/numpy.cbrt.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一批20筆距離大多在0–8公里，另有2筆64公里；另一舒適分數欄以5分左右對稱。哪個處理方向合理？
    options:
      A: 兩欄都Z-score，並以平均0證明長尾已轉成常態
      B: 距離比較log1p，分數保留原值作同切分驗證基準
      C: 兩欄都取對數，並以輸出有限證明預測已經改善
      D: 距離只除以64，分數取對數以保證兩欄保持對稱
    answer: B
    explain:
      A: Z-score不改變分布形狀，不能消除右偏長尾。
      B: 右偏欄可比較壓縮尾端的轉換，對稱欄不必跟著套用，最後仍要驗證。
      C: 能計算不代表模型更好，而且距離含0，普通對數並不適用。
      D: 除以64仍保留右偏，對稱正值取對數也可能變成左偏。
  - id: c2
    goal: g2
    type: choice
    prompt: 某零售欄位含−4、0、3件；希望直接保留正負值、不任意平移，再由訓練資料估計冪次參數。哪個候選符合條件？
    options:
      A: 普通自然對數，允許負值與零值直接進入實數計算
      B: Box-Cox轉換，允許負值與零值直接估計冪次參數
      C: 平方根轉換，允許負值與零值直接估計冪次參數
      D: Yeo-Johnson，允許負值與零值參與冪次參數估計
    answer: D
    explain:
      A: 實數自然對數只接受正值，零與負值均有問題。
      B: Box-Cox要求所有輸入嚴格大於0。
      C: 實數平方根不接受負值，也沒有自動估計的冪次參數。
      D: Yeo-Johnson可處理負值、零與正值，但仍只用訓練資料估計參數。
  - id: c3
    goal: g2
    type: choice
    prompt: 非負銷售件數為0、3、15、63，採ln(1+x)，其中0與63的結果約為何？
    options:
      A: "0與4.159"
      B: "1與4.159"
      C: "0與4.143"
      D: "1與4.143"
    answer: A
    explain:
      A: ln(1+0)=0，ln(1+63)=ln64約4.159。
      B: 加1是在取對數之前，不是最後輸出加1。
      C: 約4.143是ln63，漏掉了括號中的加1。
      D: 同時把零的結果與63的輸入處理錯了。
---

## 為什麼需要

銷售額或收入可能多數很小，少數特別大，形成右偏長尾。線性縮放只換中心與尺度，無法改變這種形狀。

對數轉換（Log Transform）與冪次轉換（Power Transform）改變數值間距，讓大值受到較強壓縮。指引以收入、銷售額說明右偏，並列出平方根、立方根與自動選參數的方法。

## 直覺

對數會把大數之間的差距壓得更緊；根號常用來較溫和地處理中度偏態。選哪個要看資料條件，不能只因為它是數值欄就轉換。

![上兩格顯示距離長尾被壓縮；下兩格顯示原本對稱的舒適分數取對數後不再對稱。](figure:l23301-power-transforms-distribution)

上圖每點代表一筆原始訓練值。相同的對數規則對右偏與對稱欄位產生不同效果，所以必須逐欄比較轉換前後，不能把「壓縮尾端」當成「一定變好」。

## 定義與公式

### 對數與零值（補充）

$$
t_{\log}(x)=\ln(x),\quad x>0;\qquad
t_{1}(x)=\ln(1+x),\quad x>-1
$$

$x$是依固定單位記錄的數值，$t$是轉換結果，$\ln$為自然對數。非負件數可用`log1p`保留0；但−4仍不在定義域內，不能因為「加1」就任意處理負值。

固定單位也是轉換的一部分。例如公里改成公尺後再加1，不會得到同一組相對間距；訓練與推論必須保持一致。

### 根號與立方根（補充）

$$
t_{\sqrt{}}(x)=\sqrt{x},\quad x\geq0
$$

$x$為原始數值，$t_{\sqrt{}}$為非負平方根。64轉成8，0仍是0；大於1的數值被壓縮，但不是線性縮放。

$$
t_{\mathrm{cbrt}}(x)=\sqrt[3]{x},\quad x\in\mathbb{R}
$$

$t_{\mathrm{cbrt}}$為實數立方根，可保留負號。例如64轉成4，−4轉成約−1.587。兩式的$x$都須以同一固定單位記數。

### 自動選冪次的方法

Box-Cox與Yeo-Johnson會從資料估計轉換參數，目標是降低偏態、改善分布形狀。這是候選前處理方法，並非已知的最佳預測模型。

:::supplement[來源：scikit-learn PowerTransformer]
Box-Cox只接受嚴格正值；Yeo-Johnson可接受負值、0與正值。參數只在訓練集估計，再套用驗證集；兩者都不保證任何資料一定變成常態。
:::

:::caution[注意]
科目3指引5-7稱線性迴歸輸入需近似常態，這點需校正：一般最小平方法不要求每個特徵常態；常態誤差假設主要影響部分統計推論。是否轉換還要看關係形狀、殘差與驗證表現。（補充）
:::

## 算一次

### 交通：同一長尾換兩把尺（補充）

共用JSON的訓練索引固定0–19。距離0、8、64公里的Min-Max分別為0、0.125、1，8到64仍占大部分範圍。

| 原距離 | ln(1+x) | 平方根 | 立方根 |
|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 |
| 8 | 2.197 | 2.828 | 2 |
| 64 | 4.174 | 8 | 4 |

log1p把0到8的差距改成約2.197，8到64改成約1.977；兩段差距變接近。Z-score只會讓兩段同除以一個標準差，比例仍為8比56。

### 零售：零值與負值不能混談（補充）

銷售件數訓練值為0、1、3、7、15、31、63、127、255、511，各2筆；做log1p後依序為0、ln2、ln4，直到ln512，間距相等。

例如63件變成ln64≈4.159，0件變成0；同份資料的淨件數卻含−4，不能直接用log1p。此時可比較實數立方根或Yeo-Johnson，不要為了跑得動就任意補正常數。

### 對稱欄位的反例（補充）

舒適分數1、2、3、4、5、5、6、7、8、9各重複2次，原本以5對稱。取對數後，1到5的距離是ln5≈1.609，5到9只有ln(9/5)≈0.588，低分端被拉得更長。

這是「不必每欄都轉」的數值反例，並非聲稱對稱分布一定最適合所有模型。最後要用相同驗證列比較預測，而非只看圖是否漂亮。

## 程式（補充）

### 明確檢查定義域

```python
import numpy as np
from sklearn.preprocessing import PowerTransformer
x = np.array([0., 8., 64.])
print("log1p:", np.round(np.log1p(x), 3).tolist())
print("平方根:", np.round(np.sqrt(x), 3).tolist())
print("立方根:", np.round(np.cbrt(x), 3).tolist())
net = np.tile([-4., -3., -2., -1., 0., 0., 1., 2., 3., 4.], 2).reshape(-1, 1)
pt = PowerTransformer(method="yeo-johnson", standardize=False).fit(net)
print("Yeo-Johnson新值有限:", np.isfinite(pt.transform([[-2.], [0.], [3.]])).all().item())
try:
    PowerTransformer(method="box-cox").fit(net)
except ValueError:
    print("Box-Cox: 拒絕非正值")
print("普通對數可用:", (x > 0).tolist(), "log1p可用:", (np.array([-4., 0., 3.]) > -1).tolist())
```
```text
log1p: [0.0, 2.197, 4.174]
平方根: [0.0, 2.828, 8.0]
立方根: [0.0, 2.0, 4.0]
Yeo-Johnson新值有限: True
Box-Cox: 拒絕非正值
普通對數可用: [False, True, True] log1p可用: [False, True, True]
```

:::tip[讀碼重點]
`standardize=False`讓冪次轉換和後續Z-score分開觀察。預設為True會再中心化及縮放；`fit`只讀訓練欄，沒有重新用新值估計參數。
:::

## 怎麼用、怎麼判讀

先看右偏程度、是否有0或負值，再選候選轉換。中度偏態可比較平方根或立方根；更強的右尾可比較對數，或讓冪次方法估計參數。

:::supplement[來源：scikit-learn PowerTransformer；Map data to a normal distribution]
轉換前後比較分布、欄位與標籤的關係，再以固定驗證集檢查成效。若選法依驗證表現調整，最終仍需另一份獨立測試集。
:::

### 換個場景

| 場景／資料條件 | 方法方向 | 判讀重點 |
|---|---|---|
| 收入、銷售額右偏 | 對數作候選 | 大額端受到較強壓縮 |
| 中度偏態的數值欄 | 平方根或立方根 | 避免不必要的強轉換 |
| 需自動估計冪次的偏態欄 | Box-Cox或Yeo-Johnson | 依正負值選法，轉換後看分布 |
| 含0的交通距離（補充） | 比較log1p | 0不是缺值，不可直接取ln |
| 含正負值的製造偏差（補充） | 立方根或Yeo-Johnson | 保留負號，先檢查定義域 |

## 常見誤解

- **Z-score與對數都會把偏態改好。** Z-score保留形狀；對數改間距，結果仍須觀察。（補充）
- **加1就能處理任何負值。** log1p在實數有限輸出時仍要求輸入大於−1。（補充）
- **Box-Cox與Yeo-Johnson輸入範圍相同。** 前者只接受正值，後者可含0與負值。（補充）
- **所有欄位都用同一轉換比較公平。** 原本對稱的舒適分數就是反例。（補充）

## 進階

### 轉換目標與轉換輸入的差別（補充）

本頁處理輸入特徵。若改為對銷售額標籤取對數，預測的尺度與損失意義也跟著變；不能把輸入轉換的結論直接套到目標，應另外檢查還原後的誤差。

### 參考來源

- 科目3指引5.1，`guide-3:5-7`，及3.1，`guide-3:3-8`：偏態觀察、收入／銷售額、根號與冪次轉換。
- [NumPy log1p](https://numpy.org/doc/stable/reference/generated/numpy.log1p.html)：對數公式、零值、定義域與程式。
- [NumPy sqrt](https://numpy.org/doc/stable/reference/generated/numpy.sqrt.html)、[cbrt](https://numpy.org/doc/stable/reference/generated/numpy.cbrt.html)：根號公式、實數輸入範圍與算例。
- [PowerTransformer](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PowerTransformer.html)：Box-Cox／Yeo-Johnson定義域、fit與預設標準化。
- [轉換分布教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_map_data_to_normal.html)：直覺圖的比較思路、逐欄觀察與無法保證常態的限制。
- [Google數值正規化課程](https://developers.google.com/machine-learning/crash-course/numerical-data/normalization)：比較縮放與對數的教學思路。
- [NIST：誤差分布假設](https://www.itl.nist.gov/div898/handbook/pmd/section2/pmd214.htm)：校正輸入特徵常態與誤差常態的混淆。

## 小結

- 縮放改量級，非線性轉換改數值間距。
- 右偏比較對數，中度偏態也可比較根號方法。
- 先檢查0與負值，再選轉換及估計參數。（補充）
- 同一規則未必適合每欄，預測品質仍需獨立驗證。（補充）
