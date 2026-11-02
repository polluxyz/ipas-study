---
id: net-present-value
title: 淨現值 NPV
kind: metric
codes: [L21201]
aliases: []
requires: [ai-total-cost]
contrasts:
  - target: payback-period
    note: NPV 折現評估期間內的全部現金流；一般回收期只看何時收回初投入，沒有折現
    source: [guide-1:4-6]
guide_refs: [guide-1:4-5, guide-1:4-6]
summary: NPV 把未來各期淨現金流折成現在的價值，再扣掉初投入
goals:
  - id: g1
    text: 說明折現假設、逐期計算 NPV，並依折現率及完整現金流判讀正負值
formula_groups:
  - id: discounted-cashflows
    source: guide-1:4-6
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21201-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某物流 AI 在第 0 年投入 100 萬元，之後兩年年底各有淨流入 60 萬元，年折現率 10%，沒有其他現金流。NPV 約多少？
    options: { A: 20.00 萬元, B: 9.09 萬元, C: 4.13 萬元, D: −0.83 萬元 }
    answer: C
    explain:
      A: 這是 120 減 100，忽略兩期的折現。
      B: 這是把兩筆合計 120 都只折現一年，第二年應再多折一期。
      C: 60 除以 1.1 加 60 除以 1.1 平方，再減 100，約為 4.13。
      D: 這是把兩筆合計 120 都放在第二年折現，移錯了第一年的時點。
  - id: c2
    goal: g1
    type: choice
    prompt: 零售 AI 四年 NPV 在 8% 折現率下是 45.61 萬元，但保守情境重估後為 −41.03 萬元。哪個結論合理？
    options:
      A: 財務結論依賴收益、成本與折現假設，應確認保守情境及資源條件再決策
      B: 初次 NPV 為正，就保證四年都不會缺現金
      C: NPV 是模型辨識能力，轉負表示準確率低於 50%
      D: 只要一般回收期短，NPV 就不能為負
    answer: A
    explain:
      A: NPV 是在指定假設下的折現結果，假設改變時需要重新評估。
      B: NPV 沒有保證每年資金充裕，也不是對未來收益的保證。
      C: NPV 的單位是金額，和模型準確率沒有固定換算關係。
      D: 一般回收期沒有折現，不能排除折現後價值不足的情況。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

AI 專案通常先付開發費，之後才逐年得到效益。把所有年度的錢直接相加，會忽略收到時間不同。

淨現值（Net Present Value，NPV）先把未來的現金流折回現在，再與初投入比較。指引把它用於長期專案的價值評估。

## 直覺

折現率越高，同樣一筆未來收入折回今天的價值越少。時間越遠，也要經過更多次折現。

:::supplement[來源：OpenStax《Principles of Finance》16.2 NPV Calculation]
共用零售例子今天支出 120，之後每年年底淨流入 50。圖上 50 是扣除當年維運與培訓後的金額，初投入只在第 0 年扣一次。
:::

![先看第0年的流出，再把第1至4年年底的淨流入各自折現](figure:l21201-net-present-value-cashflow)

## 定義與公式

$$
\mathrm{NPV}=-I_0+\sum_{t=1}^{n}\frac{\mathrm{CF}_t}{(1+r)^t}
$$

$I_0$ 是第 0 年初投入的正數金額，$\mathrm{CF}_t$ 是第 $t$ 年淨現金流，$r$ 是年折現率，$n$ 是評估年數。NPV 和現金流同單位；本例皆為新臺幣萬元。

### 先把口徑固定（補充）

適用假設是各期現金流與折現期間一致。第 0 年的錢不再折現；第 2 年的錢要除以 $(1+r)^2$，不能只除一次。

本組收益減維運、減追加培訓後才是 $\mathrm{CF}_t$。零售每年為 $70-15-5=50$，因此不把營運成本在 NPV 外再扣一次。

本例採四個年末、固定年折現率 8%，不另計稅、通膨、融資、殘值或第 4 年後的價值。真實專案如有其他新增收支，必須補入相應時點，並讓金額與折現率口徑一致。

## 算一次（補充）

共用資料 `L21201-B-cashflows.json` 的零售案，逐年把淨流入折回第 0 年：

| 年 $t$ | 淨現金流 | 折現除數 | 現值（萬元） |
|---|---|---|---|
| 0 | −120 | 1 | −120.0000 |
| 1 | 50 | 1.080000 | 46.2963 |
| 2 | 50 | 1.166400 | 42.8669 |
| 3 | 50 | 1.259712 | 39.6916 |
| 4 | 50 | 1.360489 | 36.7515 |

完整代入如下；中間不取整，表格只為閱讀顯示小數。

$$
\begin{aligned}
\mathrm{NPV}&=-120+\frac{50}{1.08}+\frac{50}{1.08^2}\\
&\quad+\frac{50}{1.08^3}+\frac{50}{1.08^4}\approx45.6063
\end{aligned}
$$

這是四年現值的淨增加，約 45.61 萬元。

製造的年流入不等額，須逐年折現 25、50、70、80，再扣初投入 150。結果約為 30.3857 萬元，不能沿用零售的固定年流入。

## 程式（補充）

用標準函式庫重算兩個專案。清單第一個數是第 1 年現金流，所以 `enumerate` 從 1 開始；初投入由函式單獨扣除。

```python
def npv(initial, cashflows, rate):
    if rate <= -1:
        raise ValueError("折現率必須大於 -100%")
    return -initial + sum(cf / (1 + rate) ** t
                          for t, cf in enumerate(cashflows, 1))
for name, initial, flows in [("零售", 120, [50] * 4),
                             ("製造", 150, [25, 50, 70, 80])]:
    print(f"{name} NPV: {npv(initial, flows, 0.08):.4f} 萬元")
print(f"零折現率 NPV: {npv(120, [50] * 4, 0):.4f} 萬元")
```
```text
零售 NPV: 45.6063 萬元
製造 NPV: 30.3857 萬元
零折現率 NPV: 80.0000 萬元
```

:::tip[讀碼重點]
`cashflows` 放扣過維運的淨額；初投入不放進這份從第 1 年開始的清單。折現率 8% 要傳 `0.08`。
:::

## 怎麼用、怎麼判讀

NPV 大於零表示預估未來淨流入的現值高於初投入；小於零則不足。這個判斷必須連同折現率、評估期間與現金流假設一起報告。

:::supplement[來源：OpenStax《Principles of Finance》16.2 NPV Profile]
NPV 等於零代表在該折現率下恰好達到要求的回報，並非沒有收益。本例未來淨流入全為正，折現率提高時 NPV 會下降；不能把正 NPV 當成不受假設影響的保證。
:::

### 換個場景

指引以企業長期投資為場景，資料條件是現金流跨期，需評估未來回收與額外價值；本節沒有指定產業。

| 場景 | 判讀重點 |
|---|---|
| 多期 AI 投資 | 依每期現金流與折現率評估現值 |
| 零售客服（補充） | 平台先付款、效益逐年發生，時點不可混用 |
| 製造維護（補充） | 效益逐年增加時，保留各年不同的淨流入 |
| 能源調度（補充） | 晚年節能收入不能當作今天已實現的錢 |

## 常見誤解

- 「只把收益折現就好」：現金流要先扣當期相關營運支出。
- 「初投入已在第 0 年，還要再折一年」：第 0 年就是比較基準，不需折現。
- 「正 NPV 保證成功」：它只是指定假設下的估算，不能保證效益實現。（補充）
- 「NPV 45.61 就是 ROI 45.61%」：前者是金額，後者是比例。（補充）

## 進階

### 折現率不是模型錯誤率（補充）

折現率是把跨期金額換到同一時點的財務假設，可以反映資金要求的回報。它不是模型誤差，也不是隨意從準確率扣掉的折扣。

比較方案時，應說明折現率如何選定，並用導入成本敏感度分析檢查合理範圍。這裡只教計算與判讀，不把 8% 當作所有企業適用的標準。

### 參考來源

- 科目 1 學習指引 `guide-1:4-5`～`guide-1:4-6`：支持定義、公式、正負值與長期企業場景；公式已對照 PDF 印刷 4-6。
- [OpenStax 16.2 NPV Method](https://openstax.org/books/principles-finance-2e/pages/16-2-net-present-value-npv-method)，NPV Calculation、NPV Profile：支持逐期表、時間軸、折現率與門檻的教法。
- [ACCA〈Investment appraisal〉](https://www.accaglobal.com/gb/en/student/exam-support-resources/prodipsust-study-resources/technical-articles/investment-appraisal.html)，Relevant/irrelevant cashflows：支持新增淨現金流及成本口徑。算例與程式為多期計算的必要延伸。

## 小結

- 每期淨現金流先折回第 0 年，再扣初投入。
- 年份、幣別、金額與折現率期間要一致。
- NPV 的正負依賴期間、折現率與完整現金流。
- NPV 是金額，不是百分比，也不是未來成功的保證。（補充）
