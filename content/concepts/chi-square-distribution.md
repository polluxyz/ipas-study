---
id: chi-square-distribution
title: 卡方分佈與檢定用途
kind: theory
codes: [L23101]
aliases: [Chi-square Distribution, 自由度]
requires: [normal-uniform-distributions]
summary: 卡方分佈源自獨立標準常態的平方和，可作為多種檢定的參考分佈
goals:
  - id: g1
    text: 說明卡方平方和與自由度，區分適合度及列聯表獨立性檢定
formula_groups:
  - id: chi-square-sum
    source: https://www.itl.nist.gov/div898/handbook/eda/section3/eda3666.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-B
  - id: pearson-independence
    source: https://www.itl.nist.gov/div898/handbook/prc/section4/prc45.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23101-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 四個互相獨立的標準常態變數，一次觀察值為 2、−1、0、0。平方和及其所屬卡方分佈的自由度依序為何？
    options:
      A: 1、4
      B: 5、3
      C: 4、5
      D: 5、4
    answer: D
    explain:
      A: 1 是原始值的總和，卡方構成要先平方再相加。
      B: 平方和為 5，但此處未估計平均值，自由度不需由項數扣一。
      C: 4 是獨立項數，5 是平方和，不能交換這兩個量。
      D: 平方和為 4 加 1 加 0 加 0 等於 5，四個獨立標準常態項對應自由度 4。
  - id: c2
    goal: g1
    type: choice
    prompt: 工廠比較兩組各 500 件的真實瑕疵狀態，甲組 15 件瑕疵、乙組 5 件瑕疵，要檢查組別與瑕疵是否有關聯。哪個任務與自由度搭配正確？
    options:
      A: 2×2 列聯表獨立性檢定，自由度為 1
      B: 單一類別分佈適合度檢定，自由度固定為 3
      C: 兩組平均數的變異數分析，自由度固定為 1
      D: 三個獨立標準常態平方和，自由度為 2，因為項數要減一
    answer: A
    explain:
      A: 組別與真值是兩個類別變數，2×2 表的自由度為一乘一。
      B: 問題沒有指定單一變數的目標分佈，而是比較兩個變數的關聯。
      C: 這裡觀察的是類別計數，不能直接當作一般連續平均數問題。
      D: 三個獨立標準常態的平方和對應自由度 3，不能機械地減一；本題也不是這種構成任務。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-4]
---

## 為什麼需要

看到兩組瑕疵比例不同，還要問：差距是否可能只是抽樣波動？卡方分佈（Chi-square Distribution）提供某些統計量的參考分佈，幫助我們進行假設檢定與顯著性判斷。

指引列出卡方適合度檢定、列聯表獨立性檢定及變異數分析。先分清楚「一種分佈」與「使用這種分佈的檢定」，才能選對方法。

## 直覺

把多個獨立標準常態變數先平方，再加起來，就得到卡方變數。平方後負值也變成非負，所以總和不會小於 0。

:::supplement[來源：NIST e-Handbook 1.3.6.6.6 Chi-Square Distribution]
像把數個偏離中心的距離平方後累加：偏離越大，累計值通常越大。自由度（Degrees of Freedom，df）決定這個平方和分佈的形狀。
:::

![自由度增加時密度位置向右且相對偏斜減弱；縱軸是密度，不是單點機率。](figure:l23101-chi-square-distribution-density)

## 定義與公式

:::supplement[來源：NIST e-Handbook 1.3.6.6.6 Chi-Square Distribution]
$$
Q=\sum_{i=1}^{k}Z_i^2\sim\chi_k^2
$$

$Z_i$ 是第 $i$ 個標準常態變數，彼此獨立；$k$ 是項數，也是此構成的自由度；$Q$ 是平方和。標準常態要求平均數 0、變異數 1。

三個獨立變數的一次觀察為 1、−1、0 時，$Q=1^2+(-1)^2+0^2=2$，自由度仍是 3。不能因平方和等於 2，就把自由度改成 2。
:::

不同檢定會因估計參數或表格限制而有不同自由度。不能把原始樣本數直接代入上述的 $k$。

### 兩種常見任務

| 任務 | 資料長什麼樣 | 要回答什麼 |
|---|---|---|
| 適合度檢定 | 單一變數在各類別的計數 | 是否符合指定分佈 |
| 獨立性檢定 | 兩個類別變數的交叉計數 | 兩個變數是否有關聯 |

:::supplement[來源：NIST e-Handbook 7.4.5 Contingency Table；OpenStax 11.3 Test of Independence]
獨立性檢定的 Pearson 統計量與期望頻數為：

$$
\begin{aligned}
E_{ij}&=\frac{R_i C_j}{n},\\
X^2&=\sum_{i,j}\frac{(O_{ij}-E_{ij})^2}{E_{ij}},\\
\mathrm{df}&=(r-1)(c-1).
\end{aligned}
$$

$O_{ij}$ 是觀察頻數，$E_{ij}$ 是獨立假設下的期望頻數；$R_i$、$C_j$ 是該列與該欄的合計，$n$ 是總數，$r$、$c$ 是列數與欄數。

這裡的卡方參考分佈通常是大樣本近似，不表示原始計數本身服從標準常態。每筆觀測應獨立，期望頻數也要足夠大。

常用經驗規則是每格期望頻數至少 5；這是檢查近似是否合適的起點，不能取代觀測獨立等條件。本例各格為 10 或 490，通過此門檻。
:::

## 算一次（補充）

沿用 1,000 件工廠資料，這次改按「組別×真值」彙總，並非「真值×警示」表。

| 組別 | 真瑕疵 | 真正常 | 合計 |
|---|---|---|---|
| 甲組 A | 15 | 485 | 500 |
| 乙組 B | 5 | 495 | 500 |
| 合計 | 20 | 980 | 1,000 |

在兩變數獨立的假設下，每組期望瑕疵數為 $500\times20/1000=10$，期望正常數為 $500\times980/1000=490$。

$$
\begin{aligned}
X^2&=\frac{(15-10)^2}{10}+\frac{(485-490)^2}{490}\\
&\quad+\frac{(5-10)^2}{10}+\frac{(495-490)^2}{490}\\
&\approx5.102041,\\
\mathrm{df}&=(2-1)(2-1)=1.
\end{aligned}
$$

用自由度 1 的右尾機率得到 $p\approx0.023898$。這裡使用未作連續性校正的 Pearson 版本；如何依門檻決策，接到假設檢定與顯著性頁。

若問題改成「工廠瑕疵率是否符合事先指定的 2%」，就屬單一分佈的適合度任務。這份樣本恰為 20 件瑕疵與 980 件正常，和該指定比例的期望頻數相同。

## 程式（補充）

把共用資料按組別與真值彙總後帶入最小程式，核對平方和與列聯表檢定。

```python
from scipy.stats import chi2_contingency
table = [[15, 485], [5, 495]]
result = chi2_contingency(table, correction=False)
print("標準常態平方和 =", sum(z*z for z in [1, -1, 0]))
print("觀察頻數 =", table)
print("期望頻數 =", result.expected_freq.tolist())
print(f"X2={result.statistic:.6f} df={result.dof} p={result.pvalue:.6f}")
check_values = [2, -1, 0, 0]
print("另一組平方和與自由度 =", sum(z*z for z in check_values), len(check_values))
```
```text
標準常態平方和 = 2
觀察頻數 = [[15, 485], [5, 495]]
期望頻數 = [[10.0, 490.0], [10.0, 490.0]]
X2=5.102041 df=1 p=0.023898
另一組平方和與自由度 = 5 4
```

:::tip[讀碼重點]
`table` 的兩列是甲、乙組，兩欄是真實瑕疵與真正常，並非警示與未警示。`correction=False` 讓程式與手算的未校正版本一致。
:::

## 怎麼用、怎麼判讀

先看要檢查的是指定分佈，還是兩變數的關聯，再決定檢定。指引也列出變異數分析；實際選用時，要分清楚檢驗變異程度與比較多組平均數。

:::supplement[來源：NIST e-Handbook 1.3.6.6.5 F Distribution；7.4.3.3 ANOVA table]
卡方分佈可用於常態母體變異數推論。一般比較多組平均數的 ANOVA 則使用 F 統計量。

在相應的獨立、常態等假設下，F 分佈可由兩個獨立卡方變數各除以自由度後取比構成。卡方因此也支撐 ANOVA 的分佈理論。
:::

:::caution[注意]
類別檢定使用計數，不直接把 3% 與 1% 當作觀測格。期望頻數太小或觀測相依時，不能只憑樣本總數大就套卡方近似。（補充）
:::

### 換個場景

指引明列適合度、列聯表獨立性與變異數分析。適用資料條件須依任務區分：類別計數用列聯表；標準常態平方和則是分佈構成。

| 場景 | 問題 | 判讀重點 |
|---|---|---|
| 指定分佈適合度 | 類別頻數是否符合預設比例 | 先指定參考分佈 |
| 列聯表獨立性 | 兩個類別變數是否相關 | 計數及觀測獨立性 |
| 變異數分析 | 依任務選擇統計量 | 區分變異程度與多組平均數問題 |
| 醫療分組（補充） | 兩院所的疾病比例是否不同 | 同一病人不能重複當獨立樣本 |
| 零售通路（補充） | 通路與退貨類別是否有關聯 | 稀少類別的期望頻數 |

## 常見誤解

- 卡方分佈是參考分佈；適合度與獨立性是不同的檢定任務。
- 任意變數先平方相加，不保證得到卡方分佈。
- 拒絕獨立不會自動證明組別造成瑕疵；本例沒有隨機介入設計。（補充）
- 指引的「變異數分析」須按具體檢定釐清；一般比較多組平均數的 ANOVA 常用 F 分佈。（補充）

## 進階

### 自由度不是統一扣一（補充）

獨立性檢定依列、欄邊際限制決定自由度。適合度檢定還要考慮有沒有用同一份樣本估計參數，因此不能把所有任務都當成「類別數減一」。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:3-4`：支持平方和構成及三類應用名稱；公式、自由度計算與數值檢定為補充。
- [NIST：Chi-Square Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3666.htm)：支持構成、密度圖及常態母體變異數用途。
- [NIST：Chi-Square Goodness-of-Fit Test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35f.htm)：支持指定分佈任務與估計參數對自由度的影響。
- [NIST：Contingency Table](https://www.itl.nist.gov/div898/handbook/prc/section4/prc45.htm)：支持 Pearson 統計量、期望頻數與自由度三式。
- [SciPy：chi2_contingency](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.chi2_contingency.html)：支持 API、回傳的期望頻數與校正選項。
- [OpenStax：11.3 Test of Independence](https://openstax.org/books/introductory-statistics-2e/pages/11-3-test-of-independence)：支持列聯表教學流程與使用條件。
- [NIST：ANOVA table](https://www.itl.nist.gov/div898/handbook/prc/section4/prc433.htm)：支持常見誤解中平均數 ANOVA 使用 F 統計量的釐清。
- [NIST：F Distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3665.htm)：支持卡方與 F 分佈的構成關係及 ANOVA 用途。

## 小結

- 卡方構成要求獨立、標準常態、先平方再相加。
- 適合度看指定分佈，獨立性看兩個類別變數。
- 自由度跟統計量及資料限制有關，不能直接用樣本數。（補充）
- 檢定前先核對頻數、獨立性與所用版本。（補充）
