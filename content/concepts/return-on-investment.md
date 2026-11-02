---
id: return-on-investment
title: 投資報酬率 ROI
kind: metric
codes: [L21201]
aliases: []
requires: [ai-total-cost]
summary: ROI 用淨回報除以投資成本，表示指定期間每投入一元帶來多少回報
goals:
  - id: g1
    text: 對齊期間與成本收益口徑後計算 ROI，說明負值、零成本與時間限制
formula_groups:
  - id: project-roi
    source: guide-1:4-6
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21201-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售客服 AI 四年收益合計 280 萬元，初投入 120 萬元，另有四年維運 60 萬元與追加培訓 20 萬元。採四年總成本口徑的 ROI 是多少？
    options: { A: 133.33%, B: 140%, C: 66.67%, D: 40% }
    answer: D
    explain:
      A: 這是只以初投入當成本，漏掉維運與培訓的結果。
      B: 280 除以 200 是收益成本比，尚未扣成本，不能直接稱為 ROI。
      C: 80 除以 120 使用了四年淨回報，分母卻只放初投入，口徑不一致。
      D: 四年成本共 200，淨回報 80，80 除以 200 得 40%。
  - id: c2
    goal: g1
    type: choice
    prompt: 甲案一年 ROI 20%，乙案四年 ROI 40%；丙案報稱收益 10 萬元且所有成本皆為零。以下哪個判斷正確？
    options:
      A: 乙的年報酬率一定是甲的兩倍
      B: 甲乙須對齊期間；丙的 ROI 未定義
      C: 丙的 ROI 是 0%，因為沒有成本
      D: 乙的 ROI 為正，代表任何折現率下 NPV 都為正
    answer: B
    explain:
      A: 20% 與 40% 涵蓋不同期間，不能當作同一年報酬比較。
      B: 同期間比較才有共同基準，零成本不能進行 ROI 除法，還應查有無漏列成本。
      C: 分母為零不是除出零，這個比率沒有定義。
      D: ROI 沒有折現，折現率改變可能讓 NPV 轉負。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:4-5, guide-1:4-6]
---

## 為什麼需要

投入 200 萬元得到 80 萬元淨回報，與投入 2,000 萬元得到同樣回報，資金使用效率不同。投資報酬率（Return on Investment，ROI）把淨回報換成相對成本的百分比。

指引用 ROI 量化 AI 專案效益，並提醒納入營運成本、效率改善與時間節省。計算前要先說清楚「收益」扣過哪些支出。

## 直覺

ROI 為 40%，表示在指定的成本與期間下，每投入 1 元得到 0.4 元淨回報。這個百分比不是模型準確率，也不是收益總額。

:::supplement[來源：Nova Scotia Securities Commission〈How do you calculate return on investment (ROI)?〉；BDC〈Return on investment (ROI)〉]
ROI 本身沒有標示持有多久。一年 40% 與四年 40% 回報速度不同；本頁的四年 ROI 也不是每年都賺 40%。
:::

## 定義與公式

指引先從投資回報扣掉投資成本，再除以成本計算 ROI：

$$
\mathrm{ROI}=\frac{B-C}{C}\times100\%
$$

$B$ 代表公式中的投資回報，$C$ 代表投資成本，$B-C$ 是淨回報。結果以百分比表示，金額須採相同單位。

營運成本不能漏掉。下例先把初投入、四年維運與培訓加成 $C$，再相減；若輸入已經是淨回報，就不能再扣同一筆成本。

### 邊界與成本口徑（補充）

依公式結構，本頁將 $B$ 理解為尚未扣除本案成本的總收益，$C$ 是同期間總成本；這是計算口徑的說明。採正成本模型時須有 $C>0$，才能用此比例評估投入效率。

當 $B<C$，ROI 是負數，代表該期間回報不足以抵成本。若 $C=0$，ROI 未定義；應直接報收益金額並查漏列成本，不填 0% 或無限大。

企業報表也可能用淨收益除以投入資本等口徑。比較報表前要核對分子、分母與期間；不能僅因都標 ROI 就直接排序。

## 算一次（補充）

共用教學資料 `L21201-B-cashflows.json` 評估四年，單位為新臺幣萬元。收益已排除原本就會發生的營收，但尚未扣本案成本。

| 四年項目 | 零售客服 | 製造預測維護 |
|---|---|---|
| 總收益 $B$ | 280 | 320 |
| 初投入 | 120 | 150 |
| 維運與追加培訓 | 60＋20 | 75＋20 |
| 總成本 $C$ | 200 | 245 |
| 淨回報 $B-C$ | 80 | 75 |

零售代入 $(280-200)/200\times100\%=40\%$。製造為 $(320-245)/245\times100\%\approx30.61\%$，成本較高。

保守情境四年收益 196、成本 212，ROI 為 $(196-212)/212\times100\%\approx-7.55\%$。有收益不代表淨回報為正。

## 程式（補充）

標準函式庫即可重算。零售四筆年度資料與共用例子相同，沒有亂數；成本為零時回傳 `None`，由顯示層轉成「未定義」。

```python
def roi(benefit, cost):
    if cost < 0:
        raise ValueError("本例成本不可為負")
    return None if cost == 0 else (benefit - cost) / cost * 100
benefits, upkeep, training = [70] * 4, [15] * 4, [5] * 4
cost = 120 + sum(upkeep) + sum(training)
print(f"零售四年 ROI: {roi(sum(benefits), cost):.2f}%")
print(f"保守情境 ROI: {roi(196, 212):.2f}%")
print("零成本 ROI:", roi(10, 0))
```
```text
零售四年 ROI: 40.00%
保守情境 ROI: -7.55%
零成本 ROI: None
```

:::tip[讀碼重點]
先算完整成本再呼叫函式。`None` 保留「無法定義」的狀態，不能用 0 取代。
:::

## 怎麼用、怎麼判讀

ROI 適合回答「這份投入相對能產生多少回報」。它是比例，評估專案時仍應搭配回報金額與成本限制。

:::supplement[來源：BDC〈Return on investment (ROI)〉；OpenStax《Principles of Finance》16.2]
ROI 不反映現金流何時發生。要比較多期資金的時間價值，用淨現值 NPV；要知道何時收回初投入，再看投資回收期。
:::

### 換個場景

指引本節的場景是企業量化 AI 效益，沒有列特定產業。它要求同時考慮導入與營運支出，不能只看技術指標。

| 場景 | 判讀重點 |
|---|---|
| 企業 AI 投資比較 | 先定收益與成本範圍，再比較回報 |
| 零售客服（補充） | 節省工時須轉成可實現節省，不能只乘平均薪資就認列 |
| 製造維護（補充） | 同期比較停機損失減少與維運成本 |
| 物流排程（補充） | 節省燃料及加班支出須扣軟體使用成本 |

## 常見誤解

- 「280 除以 200 就是 ROI」：還要先扣成本，否則得到的是收益成本比。
- 「年度維運不算投資」：指引已要求考慮營運成本，不能漏列。
- 「四年 40% 等於年報酬 40%」：期間不同，不能直接換稱。（補充）
- 「負 ROI 表示完全沒有收益」：它只表示該期間收益小於成本。（補充）

## 進階

### 為何不只按 ROI 排名（補充）

零售與製造本例的 ROI 可以比較，因為兩案同為四年、同成本口徑。但資金上限、現金流時點與未量化效益仍可能影響選擇；ROI 不是完整的導入核准條件。

本組刻意不把滿意度直接換成金錢。要列入 $B$，先提出能核對的因果假設與估算依據，否則另報非財務成果。

### 參考來源

- 科目 1 學習指引 `guide-1:4-5`～`guide-1:4-6`：支持 ROI 定義、公式、營運成本與企業效益場景；公式已對照 PDF 印刷 4-6。
- [Nova Scotia Securities Commission 的 ROI 教學](https://nssc.novascotia.ca/before-you-invest/question-week-how-do-you-calculate-return-investment-roi)：支持正負值與比較期間限制。
- [BDC 的 ROI 教學](https://www.bdc.ca/en/articles-tools/entrepreneur-toolkit/financial-tools/return-on-total-assets)：支持口徑核對、投資比較與期間；本頁不用其總資產報酬公式替換指引公式。
- [OpenStax 16.2 NPV Method](https://openstax.org/books/principles-finance-2e/pages/16-2-net-present-value-npv-method)：支持與時間價值指標的分工。算例與零成本程式為自行設計的必要延伸。

## 小結

- ROI 是淨回報除以成本，結果為百分比。
- 成本須含對應期間的營運支出，已扣過的成本不再扣。
- 比較時要對齊期間；多期時間價值另看 NPV。（補充）
- 成本為零時未定義，收益小於成本時為負值。（補充）
