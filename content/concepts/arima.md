---
id: arima
title: ARIMA 時間序列模型
kind: model
codes: [L23302]
aliases: [自迴歸整合移動平均]
summary: ARIMA 以差分處理趨勢，再用歷史值與歷史誤差描述序列相依
goals:
  - id: g1
    text: 說明 p、d、q，計算一次差分，並檢查平穩性、殘差與季節性界線
requires: [sequence-model-selection]
guide_refs: [guide-3:5-13]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: difference
    source: https://otexts.com/fpp3/arima.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-A
  - id: arima-step
    source: https://otexts.com/fpp3/arima.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23302-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 能源前六週耗電為 100、103、105、108、110、113 kWh。做一次差分後，哪個結果與判讀合理？
    options:
      A: 得到 3、5、8、10、13，表示平穩性已被證明
      B: 得到 100、3、2、3、2、3，表示仍有六個差分
      C: 得到 3、2、3、2、3，表示仍要檢查交替結構
      D: 得到 3、2、3、2、3，表示季節性已全部消失
    answer: C
    explain:
      A: 這是各週減第一週，並非相鄰週的一次差分。
      B: 第一個 100 是原始值，不是有效的一次差分。
      C: 相鄰週相減後剩五個值，交替模式仍提示有剩餘結構。
      D: 一次差分沒有保證消除所有季節性或自相關。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊用 ARIMA(1,1,1) 預測，另發現每 52 週有固定季節模式。哪項說明正確？
    options:
      A: p 管落後值、d 管差分、q 管誤差；季節項仍須另外設定
      B: p 管差分、d 管落後值、q 管誤差；季節項已由 d 代替
      C: p 管落後值、d 管差分、q 管平均；季節項已由 q 代替
      D: p 管資料量、d 管輸入維、q 管誤差；季節項還要另設
    answer: A
    explain:
      A: 三個非季節階數有不同角色，固定週期可用 SARIMA 季節設定表達。
      B: p 與 d 的意義互換了，一般差分也不能自動取代季節項。
      C: MA 使用過去隨機誤差，不是對觀測值取一般移動平均。
      D: p 不是資料筆數，d 也不是特徵維度。
---

## 為什麼需要

少量有順序的觀測，也可能有可利用的短期相依。指引把 ARIMA 列為短期、資料量不大且週期明顯時的統計候選。

:::supplement[來源：Forecasting: Principles and Practice 第 9 章]
自迴歸整合移動平均簡稱 ARIMA（Autoregressive Integrated Moving Average）。先處理水準變化，再描述剩餘相依。

本頁補充差分與模型運算，讓「資料少可先試統計模型」有可操作的判斷步驟。
:::

## 直覺

### 先看每週改變多少（補充）

耗電從 100 升到 113，可能很難直接拿固定平均描述。先改看「這週減上週」，便能把水準與變動分開；但差分後仍可能有季節與其他相依。

![原值持續上升，差分剩下三與二交替，不能只因趨勢變弱就宣布問題都解決。](figure:l23302-arima-difference)

## 定義與公式

### p、d、q 的角色（補充）

| 階數 | 控制什麼 | 不能混淆成什麼 |
|---|---|---|
| p：AR | 差分後序列的落後值項 | 原始資料筆數 |
| d：I | 相鄰差分的次數 | 輸入特徵維度 |
| q：MA | 過去隨機誤差項 | 最近 q 筆觀測值的平均 |

一次差分定義為：

$$
z_t=y_t-y_{t-1}
$$

$y_t$ 是原始觀測，$z_t$ 是第 t 點與前一點的差；單位仍與原始值相同。n 筆連續觀測做一次差分，會留下 n−1 個值；不是把首筆原值補成第一個差。

本例 $z_2=103-100=3$ kWh，$z_3=105-103=2$ kWh。一次差分對應 d＝1；差分次數不宜只為讓曲線更平而持續增加。

### 最小的一步運算（補充）

為了看清 AR 與 MA，取 ARIMA(1,1,1) 的示範形式：

$$
z_t=c+\phi z_{t-1}+\theta\varepsilon_{t-1}+\varepsilon_t
$$

$c$ 是差分方程常數，$\phi$ 是落後差分係數，$\theta$ 是前期誤差係數，$\varepsilon_t$ 是新誤差。此式用加號慣例，軟體常數與趨勢設定需另看文件。

本式假設新誤差均值為零、變異有限且沒有序列相關。預測下一點時，尚未發生的新誤差以條件期望 0 處理。

AR 不是直接取上一值，MA 也不是已知所有誤差；實務上係數與誤差需由訓練資料估計。

## 算一次

:::supplement[來源：Forecasting: Principles and Practice 第 9 章；本站 L23302-A 教學合成資料]

從共用資料取前幾週，相鄰相減；兩領域保留自己的原始單位。

| 領域 | 原值 | 一次差分 |
|---|---|---|
| 能源（kWh） | 100、103、105、108、110、113 | 3、2、3、2、3 |
| 製造（mm/s） | 1、1.03、1.04、1.07 | 0.03、0.01、0.03 |

為了手算一步，另外假設 $c=0$、$\phi=0.5$、$\theta=0.2$，第六週誤差為 −1 kWh。這些是固定教學設定，沒有對六筆資料擬合。

| 步驟 | 代入 | 結果 |
|---|---|---|
| 預測第七週差分 | 0＋0.5×3＋0.2×(−1) | 1.3 kWh |
| 加回第六週水準 | 113＋1.3 | 114.3 kWh |

這是指定係數下的示範，不是可靠的耗電預報。
:::

## 程式（補充）

程式只實測差分及上述遞迴，不宣稱完成 ARIMA 估計。即使只用純 Python，也能核對預測是否加回正確的最後水準。

```python
import json, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23302-A-weekly.json").read_text(encoding="utf-8"))
y = [r["energy"]["consumption_kwh"] for r in d["records"][:6]]
diff = [b - a for a, b in zip(y, y[1:])]
step = d["arima_step"]
next_diff = step["c"] + step["phi"] * diff[-1] + step["theta"] * step["last_error"]
print("差分:", diff)
print(f"下一步差分: {next_diff:.1f} kWh")
print(f"加回水準: {y[-1] + next_diff:.1f} kWh")
```
```text
差分: [3, 2, 3, 2, 3]
下一步差分: 1.3 kWh
加回水準: 114.3 kWh
```

:::tip[讀碼重點]
`diff[-1]` 是最近一次差分，`y[-1]` 才是最近的原始水準。混用兩者，會把 1.3 的變動誤當成耗電量本身。
:::

## 怎麼用、怎麼判讀

指引提出的短期、小資料與週期場景，可以作為統計基準的起點。適用與否仍要看資料，而不是只看筆數。

### 診斷與季節界線（補充）

1. 先看時間圖、趨勢與變異是否穩定，必要時做轉換或差分；短序列圖看似平坦，仍不等於證明平穩。
2. 檢查平穩性與可逆性：本頁一階 AR 需讓 φ 的絕對值小於 1，一階 MA 的可逆條件是 θ 的絕對值小於 1，讓新誤差可由當下及過去觀測反推；高階模型須另查多項式根，不能逐係數套用。
3. 看擬合後殘差是否仍有系統性趨勢或自相關。殘差平均接近零仍可能有序列結構，不能只查平均。
4. 用時間序列交叉驗證比較下一步誤差；有結構突變時，過往擬合好不保證新時段可靠。

固定每 m 點重複的季節性，可用 SARIMA 的季節階數 P、D、Q 及週期 m 表達。季節差分是拿當下減去 m 點前，不等於把一般差分次數 d 設成 m。

指引的「週期明顯」不能讀成一般 ARIMA 自帶全部季節項。本例差分仍交替 3、2；104 週也只有兩個年度循環，需避免以少數循環過度設定年度季節參數。

### 換個場景

| 場景 | 判讀重點 |
|---|---|
| 短期、週期明顯、資料不多 | 指引列為候選，週期部分仍需確認設定 |
| 能源週耗電（補充） | 看趨勢、氣候季節與殘差結構 |
| 製造週振動（補充） | 維修可能造成水準突變，需重看假設 |
| 零售週需求（補充） | 促銷與缺貨可能需要額外變數或別的模型 |

## 常見誤解

- 「差分一次就一定平穩。」趨勢、季節性與變異都要檢查。（補充）
- 「MA 是觀測值移動平均。」這裡 MA 描述歷史隨機誤差。（補充）
- 「d＝52 就能處理年度季節。」應分清一般差分與週期為 52 的季節差分。（補充）
- 「殘差平均為零就模型正確。」殘差仍可能自相關，還要檢查預測效果。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-13`：支持短期、小資料與週期場景；已看 PDF 147 頁，未提供 p、d、q 的操作推導。
- [Forecasting: Principles and Practice 第 9 章](https://otexts.com/fpp3/arima.html)：支持差分、AR／MA、式 9.1、平穩與季節模型；參考先畫原值再畫差分的教學方式。
- [statsmodels ARIMA](https://www.statsmodels.org/stable/generated/statsmodels.tsa.arima.model.ARIMA.html)：支持 `order` 與 `seasonal_order` 的不同角色及常數參數化界線。
- [Forecasting: Principles and Practice 第 5 章](https://otexts.com/fpp3/toolbox.html)：支持殘差檢查與向前驗證。

## 小結

- p 看落後值，d 看差分，q 看歷史隨機誤差。
- 差分後的預測要加回水準，才回到原始目標。
- 一般差分不保證處理全部季節性。
- 平穩條件、殘差結構與未來時段誤差要一起檢查。
