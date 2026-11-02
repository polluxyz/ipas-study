---
id: payback-period
title: 投資回收期
kind: metric
codes: [L21201]
aliases: []
requires: [ai-total-cost]
guide_refs: [guide-1:4-5, guide-1:4-6]
summary: 投資回收期是累積淨現金流收回初投入所需的時間
goals:
  - id: g1
    text: 計算等額淨流入的回收期，以逐年累積處理不等額並說明未回收與時間價值限制
formula_groups:
  - id: constant-payback
    source: guide-1:4-6
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21201-B
  - id: uneven-payback
    source: https://openstax.org/books/principles-managerial-accounting/pages/11-2-evaluate-the-payback-and-accounting-rate-of-return-in-capital-investment-decisions
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21201-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售客服第 0 年投入 120 萬元，每年收益 70、維運 15、追加培訓 5 萬元。假設淨流入全年均勻發生，簡單回收期是多少？
    options: { A: 1.71 年, B: 2.40 年, C: 4.00 年, D: 6.00 年 }
    answer: B
    explain:
      A: 120 除以 70 把收益當淨流入，漏扣維運與培訓。
      B: 每年淨流入為 50，120 除以 50 得 2.40 年。
      C: 四年是評估期間，並不代表剛好在期末收回。
      D: 120 除以 20 把年度支出當流入，分母用錯。
  - id: c2
    goal: g1
    type: choice
    prompt: 製造 AI 初投入 150 萬元，四年淨流入為 25、50、70、80 萬元，年內均勻發生。另案初投入 120，四年淨流入為 0、−5、10、20 萬元。哪個判斷正確？
    options:
      A: 製造用 150 除以第一年 25，回收期為 6 年
      B: 另案平均仍有正流入，所以保證四年內回收
      C: 製造回收約 3.06 年，故所有風險都比回收 4 年的專案低
      D: 製造約 3.06 年；另案未於四年內回收，皆未折現
    answer: D
    explain:
      A: 逐年流入不同，不能把第一年的 25 假設為往後固定流入。
      B: 另案四年累積只流入 25，尚未收回初投入 120。
      C: 回收快只反映資金回收時間，不能涵蓋技術、合規或回收後的損失。
      D: 製造前三年收回 145，還差 5，以第四年 80 插值為 3 加 5 除以 80。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

即使 AI 專案預期有收益，企業仍想知道資金要等多久才能回來。投資回收期（Payback Period）用時間回答這個問題。

它計算簡單，但指引也提醒它沒有考慮金錢的時間價值。因此評估時要搭配淨現值 NPV。

## 直覺

每年的淨流入先補回初投入。累積補足的那一刻，就是一般所說的簡單回收期，不做折現。

:::supplement[來源：OpenStax《Principles of Accounting, Volume 2》11.2 Partial year payback]
零售例子每年回收 50，第二年底已補回 100，距離初投入 120 還差 20。若第三年均勻流入 50，再等該年的 20/50，就得到約 2.4 年。
:::

![零售在第2與第3年之間補足初投入，製造則到第4年才跨過零](figure:l21201-payback-period-cumulative)

## 定義與公式

指引給的回收期簡式如下：

$$
P=\frac{I_0}{A}
$$

$P$ 是回收期，$I_0$ 是初投入，$A$ 是每年的淨現金流。以萬元除以萬元／年，單位為年；零售代入 $120/50=2.4$ 年。

### 先確認成立條件（補充）

簡式須以每年相同且為正的淨流入為前提，這是指引未展開的成立條件。小數年另假設年內均勻流入；若只在年底一次收款，零售須到第 3 年年底才足額，2.4 年是均勻流入下的估計。

$A$ 必須扣除年度維運等支出。若 $A\leq0$，固定流入模型不會收回正的初投入；即使 $A>0$，也要確認專案存續期間足夠。

### 不等額時逐年累積（補充）

先找出跨過回收門檻的年度，再對該年插值：

$$
P=k+\frac{I_0-S_k}{\mathrm{CF}_{k+1}}
$$

$k$ 是跨門檻前已過的完整年數，$S_k$ 是前 $k$ 年累積淨流入，$\mathrm{CF}_{k+1}$ 是跨門檻那年的正淨流入。只有該年內均勻流入時，分數年才有此意義。

製造例子前三年 $S_3=25+50+70=145$，初投入 150。第四年淨流入 80，所以 $P=3+(150-145)/80=3.0625$ 年。

## 算一次（補充）

共用資料 `L21201-B-cashflows.json` 的兩案，用同一個四年觀察期間。表內為「累積淨流入減初投入」，單位新臺幣萬元。

| 年底 | 零售累積餘額 | 製造累積餘額 |
|---|---|---|
| 0 | −120 | −150 |
| 1 | −70 | −125 |
| 2 | −20 | −75 |
| 3 | 30 | −5 |
| 4 | 80 | 75 |

零售每年固定 50，可用簡式；製造的流入不同，須逐年累積。製造若誤用四年平均 56.25，會得到約 2.67 年；但到第 3 年底才收回 145，距初投入仍差 5，所以該估計過早。

再看邊界：初投入 120，四年淨流為 0、−5、10、20，累積只有 25。應寫「四年內未回收」，不能用最後一年的流入外推，也不能從四年資料斷言永遠不回收。

## 程式（補充）

函式逐年累積，回傳第一次達門檻的插值時間；沒有達到則回傳 `None`。這是未折現的簡單回收期，資料沒有亂數。

```python
def payback(initial, flows):
    if initial < 0:
        raise ValueError("初投入不可為負")
    if initial == 0:
        return 0.0
    total = 0.0
    for year, cf in enumerate(flows, 1):
        if cf > 0 and total + cf >= initial:
            return year - 1 + (initial - total) / cf
        total += cf
    return None
print("零售／製造:", payback(120, [50] * 4), payback(150, [25, 50, 70, 80]))
print("四年未回收:", payback(120, [0, -5, 10, 20]))
print("零初投入:", payback(0, [0, 0]))
```
```text
零售／製造: 2.4 3.0625
四年未回收: None
零初投入: 0.0
```

:::tip[讀碼重點]
只在跨過門檻且當年淨流入為正時做除法。負流入會減少累積回收，不能略過。
:::

## 怎麼用、怎麼判讀

一般回收期適合初步衡量回本時間。指引的判讀是：回收所需時間較短，表示投資風險較低，並建議搭配 NPV 評估。

:::supplement[來源：OpenStax《Principles of Finance》16.1 Payback Period Method]
較快回收表示資金暴露時間較短，但回收期沒有計入後期現金流，也沒有折現。不能據此推論整體風險較低；後續大型維修或資料安全風險都不在這個時間數字內。
:::

### 換個場景

指引的通用場景是企業想快速了解多久回本，並提醒時間價值限制。沒有指定某個產業，等額淨流入的條件則是使用簡式前必要的檢查。

| 場景 | 判讀重點 |
|---|---|
| 企業初步回本評估 | 快速看資金收回時間，仍搭配 NPV |
| 零售客服（補充） | 淨流入固定時可用簡式，但註明年內時點假設 |
| 製造維護（補充） | 效益逐年爬升，不用第一年或平均流入直接除 |
| 農業灌溉（補充） | 季節性收入集中收取，分數年插值未必合理 |

## 常見誤解

- 「每年收益就是分母」：須先減當年的相關營運支出。
- 「回收快就一定比較值得」：仍要看 NPV，回收期不處理時間價值。
- 「年流入不等也能取平均直接除」：平均會抹去回收的先後順序。（補充）
- 「四年沒回收就是永不回收」：只知道觀察期間內沒有回收。（補充）

## 進階

### 只找第一次跨過門檻的限制（補充）

本例回收後都持續流入，第一次跨過零就足以表達回收時間。若後年還有大額支出，累積餘額可能再度轉負，必須另外揭露，不能讓第一次回本掩蓋後續資金缺口。

若希望把時間價值納入回收時間，可先折現各年淨流再累積，稱折現回收期。它仍會忽略門檻之後的價值，因此不能取代 NPV。

### 參考來源

- 科目 1 學習指引 `guide-1:4-5`～`guide-1:4-6`：支持定義、等額簡式、回本評估與時間價值限制；公式已核對 PDF 印刷 4-6。
- [OpenStax 管理會計 11.2](https://openstax.org/books/principles-managerial-accounting/pages/11-2-evaluate-the-payback-and-accounting-rate-of-return-in-capital-investment-decisions)，Partial year payback：直接列出未回收餘額除以當期流入，再加完整年數的算法，支持不等額公式與插值。
- [OpenStax 16.1 Payback Period Method](https://openstax.org/books/principles-finance-2e/pages/16-1-payback-period-method)：支持逐年累積及忽略後期現金流的限制，不作為本頁插值公式的直接出處。
- [OpenStax 第 16 章摘要](https://openstax.org/books/principles-finance/pages/16-summary)：支持進階的折現回收期分工。邊界與共用例子是成立條件的必要延伸。

## 小結

- 回收期回答何時收回初投入，單位是時間。
- 固定正淨流入才適合用初投入除以年淨流入。（補充）
- 不等額時逐年累積；小數年插值須註明均勻流入假設。（補充）
- 未回收要附觀察期間；一般回收期應搭配 NPV。
