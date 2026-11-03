---
id: hypothesis-testing
title: 假設檢定與顯著性
kind: technique
codes: [L23101]
aliases: [Hypothesis Testing, p 值, 型一錯誤, 檢定力, 顯著水準]
requires: [statistical-inference]
summary: 假設檢定先訂主張與門檻，再衡量資料對虛無假設的反證
goals:
  - id: g1
    text: 依資料與主張完成假設、統計量、預設門檻及決策的五步流程
  - id: g2
    text: 比較 p 值與顯著水準，正確說出條件在虛無假設下的語意
  - id: g3
    text: 區分型一錯誤、型二錯誤與檢定力，說明未拒絕不等於證實
formula_groups:
  - id: test-decision
    source: guide-3:3-7
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-B
  - id: error-power
    source: https://openstax.org/books/introductory-statistics-2e/pages/9-2-outcomes-and-the-type-i-and-type-ii-errors
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23101-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠要比較甲乙兩組各 500 件的真瑕疵率，已打算使用列聯表獨立性檢定。哪個流程正確？
    options:
      A: 先訂組別與真值獨立的虛無假設，預設 α=0.05，再用真值計數計算統計量及 p 值
      B: 先用真值計數算 p 值，再選一個比它大的 α，完成檢定與顯著性判斷
      C: 先訂組別與真值獨立的虛無假設，預設 α=0.05，再用警示計數求 p 值
      D: 先訂組別與真值獨立的虛無假設，預設 α=0.05；真值檢定顯著即證明甲組造成瑕疵
    answer: A
    explain:
      A: 假設、統計量及門檻都與研究問題相符，且門檻在觀察結果前設定。
      B: 以真值計數符合研究問題，但看過p值後才選門檻，無法維持事前設計的錯誤風險控制。
      C: 假設與門檻雖已預設，警示計數仍包含誤報，不能代替真瑕疵計數。
      D: 預設假設及門檻不能讓關聯變成因果；即使檢定顯著，也不足以證明甲組造成瑕疵。
  - id: c2
    goal: g2
    type: choice
    prompt: 一項事先設 α=0.05 的雙側檢定得到 p=0.03。哪個結論正確？
    options:
      A: 拒絕虛無假設；p=0.03表示虛無假設為真的機率為3%，小於預設的5%門檻
      B: 拒絕虛無假設；p=0.03表示這次拒絕決策有97%機率正確
      C: 拒絕虛無假設；p=0.03小於α=0.05，已證明對立假設必然為真
      D: 拒絕虛無假設；若虛無假設及模型成立，得到至少同樣極端統計量的機率為 3%
    answer: D
    explain:
      A: 拒絕的決策正確，但p值以虛無假設成立為前提，不是虛無假設為真的後驗機率。
      B: 拒絕的決策正確，但1減p值不能解讀成這次決策正確的機率。
      C: 與預設門檻比較後可拒絕，但拒絕仍有錯誤風險，不能證明對立假設必然為真。
      D: 0.03 小於預設門檻所以拒絕，機率的條件仍是虛無假設與模型成立。
  - id: c3
    goal: g3
    type: choice
    prompt: 教學示意中，H0 為真時做 1,000 次檢定，50 次拒絕；指定 H0 為假的情況做 1,000 次，200 次未拒絕。兩種錯誤率及檢定力依序為何？
    options:
      A: 型一 20%、型二 5%、檢定力 95%
      B: 型一 5%、型二 20%、檢定力 95%
      C: 型一 5%、型二 20%、檢定力 80%
      D: 型一 5%、型二 80%、檢定力 20%
    answer: C
    explain:
      A: 50 除以 1,000 屬於 H0 為真的錯誤，不能交換兩個條件母群。
      B: 檢定力為 1 減型二錯誤率，並非 1 減型一錯誤率。
      C: 兩種錯誤率為 50 除以 1,000 與 200 除以 1,000，檢定力為 800 除以 1,000。
      D: H0 為假時未拒絕的 200 次才是型二錯誤，其餘 800 次是檢出。
  - id: c4
    goal: g3
    type: choice
    prompt: 另一工廠樣本檢定得到 p=0.08，事前門檻為 0.05。分析者說「未拒絕，故兩組完全相同」。應如何修正？
    options:
      A: 把門檻改為 0.10，原先就算完成證明
      B: 未拒絕表示本次證據不足，仍可能存在未能檢出的差異
      C: p=0.08 表示兩組有 92% 機率完全相同
      D: 未拒絕表示型二錯誤率必為 0
    answer: B
    explain:
      A: 看結果後更改門檻不能維持原設計的決策解讀。
      B: 樣本量或效果太小時可能檢不出差異，未拒絕不等於證實相同。
      C: p 值或其補數都不是兩組相同的後驗機率。
      D: 未拒絕可能正是型二錯誤，無法據此宣稱其機率為零。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:3-6, guide-3:3-7, guide-3:3-8]
---

## 為什麼需要

兩個特徵看似相關，或兩個模型成績不同，可能來自真正差異，也可能來自抽樣波動。假設檢定（Hypothesis Testing）用明確的主張與機率模型，檢查資料是否足以拒絕虛無假設。

## 直覺

先提出假設，再用樣本資料判斷是否有足夠理由拒絕它。

:::supplement[來源：NIST e-Handbook 7.1.3 What are statistical tests?]
像先假設一枚硬幣公平，再問目前連續出現的結果有多不尋常。先固定參考規則，才有辦法衡量資料；不能看到結果後再挑最有利的規則。

工廠例子先假設「組別與真瑕疵狀態獨立」。看到甲組 15 件、乙組 5 件瑕疵後，再衡量這個差距相對於隨機波動是否夠大。
:::

## 定義與公式

虛無假設（Null Hypothesis，$H_0$）是要接受反證檢查的主張。

對立假設（Alternative Hypothesis，$H_1$）是與它競爭、研究者想找證據支持的主張；依設計可為單側或雙側。

顯著水準（Significance Level，$\alpha$）在檢定前設定，用來控制 $H_0$ 為真卻遭拒絕的型一錯誤（Type I Error）風險。

p 值（P-value）由樣本計算，用來衡量資料與虛無假設的相容程度；數值越小，資料相對於該假設越不尋常。

:::supplement[來源：NIST e-Handbook 7.1.3.1 Critical values and p values]
精確地說，p 值是在 $H_0$ 與所選模型成立下，統計量至少和目前一樣極端的機率。「極端」往哪一側看，由事先指定的對立假設決定。
:::

$$
\text{決策}=\begin{cases}
\text{拒絕 }H_0,&p\le\alpha\\
\text{未拒絕 }H_0,&p>\alpha
\end{cases}
$$

$p$ 是資料算出的 p 值，$\alpha$ 是預設門檻。本頁約定相等時也拒絕；判斷前使用未四捨五入的 p 值。

代入 $p=0.03$、$\alpha=0.05$，因 0.03 小於 0.05 而拒絕。若 $p=0.08$，同一門檻下就未拒絕。

:::caution[注意]
p 值的條件在 $H_0$ 下。它不是「$H_0$ 為真的機率」，也不是「這次判斷出錯的機率」。（補充）
:::

## 走一次流程

五步都要完成，不能只報一個 p 值。圖中的順序對應指引的假設、方法、門檻、計算與決策。

![先設定假設、檢定及門檻，再計算和決策；看到結果後不回頭調門檻。](figure:l23101-hypothesis-testing-flow)

1. **訂主張**：指定虛無假設與對立假設。
2. **選方法**：依資料型態與設計選統計量。
3. **訂門檻**：在檢定前設定顯著水準。
4. **算結果**：由樣本求統計量及 p 值。
5. **作決策**：比較門檻，說明拒絕或未拒絕。

### 工廠完整例子（補充）

沿用相同的 1,000 件資料，將五步填成具體內容：

1. $H_0$：組別與真瑕疵獨立；$H_1$：兩者有關聯。
2. 兩組各 500 件，用「組別×真值」的 2×2 表，選未校正 Pearson 卡方獨立性檢定。
3. 事先設定 $\alpha=0.05$。
4. 用表格 `[[15,485],[5,495]]`，得到統計量約 5.102041、自由度 1、p 值約 0.023898。
5. 因 0.023898 小於 0.05，拒絕獨立假設；資料支持組別與真瑕疵有關聯。

期望頻數為 `[[10,490],[10,490]]`，最小值為 10。統計量公式與代入細節見卡方分佈與檢定用途。

若觀測來自同批強烈相依的產品，就需重估檢定設計；總數 1,000 件本身不足以保證觀測獨立。

### 錯誤與檢定力

指引說明：虛無假設為真卻遭拒絕，就是型一錯誤。它的條件是 $H_0$ 為真，和資料的 p 值不同。

:::supplement[來源：OpenStax《Introductory Statistics 2e》9.2 Outcomes and the Type I and Type II Errors]

真實狀態和決策要分兩軸看，未拒絕也可能犯錯：

| 真實狀態 | 拒絕 $H_0$ | 未拒絕 $H_0$ |
|---|---|---|
| $H_0$ 為真 | 型一錯誤 | 正確決策 |
| $H_0$ 為假 | 正確檢出 | 型二錯誤 |

$$
\begin{aligned}
\alpha_{\mathrm{actual}}&=P(\text{拒絕 }H_0\mid H_0\text{ 真}),\\
\beta&=P(\text{未拒絕 }H_0\mid H_0\text{ 假}),\\
\mathrm{Power}&=1-\beta.
\end{aligned}
$$

$\alpha_{\mathrm{actual}}$ 是實際型一錯誤率，設計目標是由名目 $\alpha$ 控制；$\beta$ 是型二錯誤率。

檢定力（Power）是檢出差異的機率。它與型二錯誤率都需指定某個實際效果大小。

另設長期結果示意：$H_0$ 真時，1,000 次中 50 次拒絕，實際型一錯誤率為 $50/1000=0.05$。

在指定 $H_0$ 假的情況，1,000 次中 200 次未拒絕，$\beta=0.20$，檢定力為 $1-0.20=0.80$。

這是另一份檢定決策計數，不是前述 1,000 件產品。若某次 $p=0.08$ 而未拒絕，也可能只是檢定力不足，不能說兩組完全相同。
:::

## 程式（補充）

同時核對完整工廠檢定、兩個門檻例子，以及另設的錯誤計數。

```python
from scipy.stats import chi2_contingency
table = [[15, 485], [5, 495]]
result = chi2_contingency(table, correction=False)
print(f"工廠 p={result.pvalue:.6f} 拒絕={result.pvalue <= 0.05}")
for p in [0.03, 0.08]:
    print(f"p={p:.2f}：{'拒絕' if p <= 0.05 else '未拒絕'}")
null_true = {"reject": 50, "not_reject": 950}
null_false_specific_effect = {"reject": 800, "not_reject": 200}
alpha = null_true["reject"] / sum(null_true.values())
beta = null_false_specific_effect["not_reject"] / sum(null_false_specific_effect.values())
print(f"示意錯誤率 alpha={alpha:.2f} beta={beta:.2f} power={1-beta:.2f}")
```
```text
工廠 p=0.023898 拒絕=True
p=0.03：拒絕
p=0.08：未拒絕
示意錯誤率 alpha=0.05 beta=0.20 power=0.80
```

:::tip[讀碼重點]
`correction=False` 與手算版本一致。`null_true`、`null_false_specific_effect` 是不同條件母群，型一與型二錯誤率不能一起除以 2,000。
:::

## 怎麼用、怎麼判讀

先判讀 p 值相對於預設門檻的位置，再用估計值說明差距。指引列出特徵關聯、模型表現比較與介入效果等任務，方法須配合實際設計。

:::supplement[來源：ASA 2016 Statement on Statistical Significance and P-Values；OpenStax 1.4 Experimental Design and Ethics]
本例兩組真瑕疵率為 3% 與 1%，差距 2 個百分點。p 值與顯著性不衡量效果大小，也不保證差距在業務上重要。

組別未隨機分派，其他製程因素也可能影響結果；僅有這次關聯檢定，不能認定組別造成瑕疵。
:::

### 換個場景

| 場景 | 要檢查的主張 | 判讀條件 |
|---|---|---|
| 特徵與目標關聯 | 兩變數是否相關 | 變數型態及抽樣設計 |
| 模型表現比較 | 表現差距是否有證據 | 觀測與模型比較方式 |
| 運動或新藥效果 | 是否有介入效果 | 主張方向及比較設計 |
| 製造品管（補充） | 組別與瑕疵是否獨立 | 真值與產品獨立性 |
| 推薦實驗（補充） | 改版是否增加點擊率 | 依使用者分派及群聚性 |

## 常見誤解

- 看完結果才提高顯著水準，破壞了原先設定的決策規則。
- $p=0.03$ 不是 $H_0$ 有 3% 機率為真。（補充）
- 未拒絕不代表證明相同；型二錯誤仍可能發生。（補充）
- 檢定力是 $1-\beta$，不是 $1-\alpha$。（補充）
- 多個交叉驗證摺分數彼此相關，不能直接當成獨立觀測套檢定。（補充）

## 進階

### 名目門檻與實際錯誤率（補充）

離散檢定可用的拒絕區域不連續，實際型一錯誤率可能低於名目門檻。設定 0.05 是設計限制，不保證每做 100 次就恰好錯 5 次。

同一資料反覆挑方向或挑最小 p 值，也會改變錯誤風險。先記錄主張、比較方式與停止規則，才有可解讀的門檻。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:3-6` 至 `guide-3:3-8`：支持五步流程、事前門檻、型一錯誤與指引場景；型二錯誤及檢定力為補充。
- [NIST：Critical values and p values](https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm)：支持 p 值的條件語意、事前門檻與決策。
- [NIST：What are statistical tests?](https://www.itl.nist.gov/div898/handbook/prc/section1/prc13.htm)：支持虛無與對立假設，以及單側、雙側設計的區分。
- [ASA：2016 p 值聲明原則](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf)：支持顯著性不衡量效果大小或實務重要性的界線。
- [OpenStax：1.4 Experimental Design and Ethics](https://openstax.org/books/introductory-statistics-2e/pages/1-4-experimental-design-and-ethics)：支持觀察組別差異時須考慮其他因素，不能單靠關聯檢定推斷因果。
- [SciPy：chi2_contingency](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.chi2_contingency.html)：支持工廠完整例子的統計量、自由度及未校正版本。
- [OpenStax：9.2 Outcomes and the Type I and Type II Errors](https://openstax.org/books/introductory-statistics-2e/pages/9-2-outcomes-and-the-type-i-and-type-ii-errors)：支持四格表、型二錯誤與檢定力的教學安排。
- [Bengio 與 Grandvalet（2004）](https://jmlr.org/papers/v5/grandvalet04a.html)：支持交叉驗證摺分數相關，不能直接作獨立樣本檢定的界線。

## 小結

- 先訂假設、方法與門檻，再算統計量及 p 值。
- p 值和預設顯著水準比較，得到拒絕或未拒絕的決策。
- p 值不是虛無假設為真的後驗機率。（補充）
- 型一錯誤是在真假設下誤拒絕；型二錯誤是在假假設下漏拒絕，檢定力為 $1-\beta$。（補充）
