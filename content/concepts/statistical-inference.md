---
id: statistical-inference
title: 統計推論與參數估計
kind: theory
codes: [L23101]
aliases: [Parameter Estimation, Statistical Inference, 信賴區間]
summary: 統計推論由樣本估計母體，並把數值、不確定性與主張檢驗分開呈現
goals:
  - id: g1
    text: 比較同一樣本的點估計、區間估計與檢定，正確解讀信賴區間及使用條件
formula_groups:
  - id: sample-proportion
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某篩檢樣本 1,000 人中有病者 100 人，估計比例 10%，95% 信賴區間約為 8.21% 至 12.03%。哪個解讀正確？
    options:
      A: 95% 的個別病人有病機率介於 8.21% 至 12.03%
      B: 已算出的這個區間內含有 95% 的受檢者
      C: 固定抽樣及建構方法重做時，區間涵蓋固定母體比例的長期頻率由信賴水準描述
      D: 母體比例每次抽樣都會隨機改變，因此區間才會變動
    answer: C
    explain:
      A: 信賴區間估計母體比例，不是描述每一位個人的風險範圍。
      B: 這是參數的區間，不是把樣本中的人排進區間。
      C: 重複抽樣時隨機的是區間，母體參數固定，精確二項方法也可能較保守。
      D: 母體比例在這個重複抽樣模型中固定，變動的是樣本及估計結果。
  - id: c2
    goal: g1
    type: choice
    prompt: 工廠資料共 1,000 件，其中 20 件瑕疵。分析者要估計未來同製程的真瑕疵率，而不只描述這批產品。哪一項最需要先確認？
    options:
      A: 是否能把這 1,000 件複製成 10,000 件以縮小區間
      B: 抽樣是否代表目標製程，以及觀測是否符合所用機率模型
      C: 是否只要樣本夠大就可忽略抽樣方式
      D: 是否能把警示率直接當成真瑕疵率
    answer: B
    explain:
      A: 複製既有資料不會增加獨立資訊，不能據此縮小不確定性。
      B: 母體推論依賴代表性與模型條件，樣本中的 2% 本身不足以保證可推廣。
      C: 大樣本可減少某些抽樣波動，無法自動修正選樣偏差。
      D: 警示還包含誤報，不能取代真實瑕疵標籤。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-6, guide-3:3-7]
---

## 為什麼需要

某批資料的平均數或比例，描述的是樣本。統計推論再向前一步，用樣本估計母體或判斷主張，同時說明不確定性。

指引把參數估計與假設檢定列為兩個分支。前者回答「大約多少」，後者回答「是否有足夠證據拒絕某個主張」。

## 直覺

點估計提供一個數字，區間估計則提供參數可能落在的範圍。

:::supplement[來源：NIST e-Handbook 7.1.4 What are confidence intervals?]
像從一鍋湯舀一匙試味道：點估計是這匙的鹹度，區間估計表達推估整鍋時的不確定性。若只舀到尚未拌勻的一角，再精密的計算也不能保證代表整鍋。

本組醫療樣本 1,000 人中有病 100 人。下面把這一份樣本分別交給點估計、區間估計與假設檢定，觀察三種輸出。
:::

## 定義與公式

母體參數是要估計的固定未知量；樣本統計量是從抽到的資料算出的數字。參數估計包含單一數字的點估計，以及附信賴水準的區間估計。

:::supplement[來源：SciPy binomtest；BinomTestResult.proportion_ci]
對獨立、同一有病機率的二元觀測，可用樣本比例估計母體比例：

$$
\widehat{\theta}=\frac{x}{n}
$$

$\theta$ 是目標族群的有病比例，$\widehat{\theta}$ 是點估計；$x$ 是樣本中有病人數，$n$ 是樣本總人數。本例為 $100/1000=0.10$。

本頁使用 Clopper–Pearson 精確二項方法建構兩側 95% 信賴區間。它依二項尾端機率找上下界，不強求區間以點估計為對稱中心。
:::

:::tip[重點]
點估計、區間與檢定回答不同問題。只說「有病率估計為 10%」，還沒有交代估計精度或某個指定主張的檢定結果。
:::

## 算一次（補充）

沿用同一份醫療資料，以真值計數，不能把 135 位陽性者當成 135 位有病者。

| 方法 | 輸出 | 回答什麼 |
|---|---|---|
| 點估計 | $100/1000=10\%$ | 有病率大約多少 |
| 兩側 95% 區間 | 約 $[8.21\%,12.03\%]$ | 估計的不確定性 |
| 單側精確二項檢定 | $p\approx0.013482$ | 對 $\theta=8\%$ 是否有向上的反證 |

檢定事先設定虛無假設為 $\theta=0.08$，對立假設為 $\theta>0.08$，顯著水準為 0.05。因此這次拒絕虛無假設，但仍應保留估計比例與區間。

表中的區間是兩側，檢定是單側，目的在比較輸出；不能把兩者當成相同門檻的機械換算。完整檢定流程見假設檢定與顯著性。

### 信賴區間要重複看（補充）

固定母體比例 10%，每次重新抽取 1,000 筆獨立二元資料，再用相同方法建構區間。隨機變動的是樣本與區間，母體參數在這個模型中固定。

![垂直虛線固定在母體比例 10%，橫線是各次樣本算出的區間；這 12 次恰好全部涵蓋真值。](figure:l23101-statistical-inference-intervals)

95% 描述建構方法的長期涵蓋能力，不保證每 20 次剛好有 19 個區間涵蓋。精確二項區間可能較保守；也不能把既定區間說成母體參數有 95% 機率在其中。

## 程式（補充）

這段使用實際觀測頻數算三種輸出；重複抽樣圖則另用固定種子 23101 產生教學樣本，沒有更動原始頻數。

```python
from scipy.stats import binomtest
x, n = 100, 1000
interval = binomtest(x, n).proportion_ci(confidence_level=0.95, method="exact")
test = binomtest(x, n, p=0.08, alternative="greater")
print(f"點估計={x/n:.6f}")
print(f"兩側95%區間=[{interval.low:.6f}, {interval.high:.6f}]")
print(f"單側檢定 p={test.pvalue:.6f} 拒絕={test.pvalue <= 0.05}")
```
```text
點估計=0.100000
兩側95%區間=[0.082105, 0.120288]
單側檢定 p=0.013482 拒絕=True
```

:::tip[讀碼重點]
`proportion_ci` 的 `method="exact"` 指定精確二項區間；另一個 `binomtest` 才設定方向為 `greater`。不要把單側檢定物件產生的區間誤稱兩側區間。
:::

## 怎麼用、怎麼判讀

指引以平均收入、平均體重及運動課程效果區分估計與檢定，也列出特徵關聯、模型差異與訓練穩定性。判讀時先問分析要提供數值，還是檢驗一項主張。

:::supplement[來源：NIST e-Handbook 7.1.4 What are confidence intervals?；SciPy binomtest]
推論必須先指定目標族群與抽樣單位。本頁二項方法要求固定次數、共同機率及觀測獨立；同病人的重複檢驗不能直接當成新的獨立病人。

若樣本只來自轉診個案，區間可能很窄，卻仍不能代表一般人口。提高樣本數不會自動消除抽樣偏差。
:::

### 換個場景

沿用指引的平均收入、平均體重與新運動課程例子，先辨識是在估計母體數值，還是在檢驗效果主張。

| 場景 | 估計或檢定 | 要看哪種資料條件 |
|---|---|---|
| 收入與體重 | 母體平均值及區間 | 樣本代表誰 |
| 運動效果與模型比較 | 主張是否有證據支持 | 比較方式與機率模型 |
| 特徵關聯、訓練穩定性 | 關聯或波動 | 不確定性從哪裡來 |
| 製造瑕疵（補充） | 同製程真瑕疵率 | 逐件獨立及製程穩定性 |
| 推薦點擊（補充） | 曝光後的點擊率 | 同使用者多次曝光可能相依 |

## 常見誤解

- 點估計提供一個值，不會自行附帶精度保證。
- 信賴區間是母體參數的估計範圍，不是個別樣本的分佈範圍。（補充）
- 未拒絕某個主張不等於證明它為真，可能只是資料資訊不足。（補充）
- 複製頻數表不會增加獨立樣本數，不能據此縮窄信賴區間。（補充）

## 進階

### 區間寬度還受方法影響（補充）

同一份資料可以使用不同的區間建構方法。本頁選精確二項法，讓低計數時也有明確定義；方法較保守時，實際長期涵蓋率可能高於名目的 95%。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:3-6`、`guide-3:3-7`：支持兩個分支、輸出區別與指引場景；比例公式與重複抽樣解讀為補充。
- [NIST：What are confidence intervals?](https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm)：支持區間及長期重複抽樣的解讀。
- [SciPy：binomtest](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html) 與 [proportion_ci](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats._result_classes.BinomTestResult.proportion_ci.html)：支持點估計、單側檢定及精確區間程式。
- [OpenStax：8.1 信賴區間教學](https://openstax.org/books/introductory-statistics-2e/pages/8-1-a-single-population-mean-using-the-normal-distribution)：支持點估計與區間的對照、重複抽樣圖意；本頁比例區間另依 SciPy 計算。

## 小結

- 統計推論利用樣本對母體作估計或檢定。
- 點估計給數值，區間交代不確定性，檢定評估指定主張。
- 信賴水準屬於建構方法的長期表現。（補充）
- 先核對目標族群、抽樣單位與模型條件，再看數字。（補充）
