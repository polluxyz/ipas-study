---
id: disparate-impact
title: 不利影響比
kind: metric
codes:
  - L21203
  - L23402
aliases:
  - 80% Rule
  - Disparate Impact
requires:
  - statistical-parity
summary: 不利影響比以指定群體的選取率除以參照群選取率，方向必須先說清楚
goals:
  - id: g1
    text: 計算指定參照群的不利影響比，辨認零分母及八成規則的法域界線
formula_groups:
  - id: reference-selection-ratio
    source: https://www.eeoc.gov/laws/guidance/questions-and-answers-clarify-and-provide-common-interpretation-uniform-guidelines
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23402-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: A/B 各 20 位申請人，選中 10 與 14 位。以 B 為參照，A 的不利影響比與判讀是？
    options:
      A: (14/20)/(10/20)＝1.4，應據此認定 A 通過八成篩檢
      B: (14/20)−(10/20)＝0.2，代表 A 只有 B 兩成的選取機會
      C: (10/20)/(14/20)＝0.8，足以證明所有法域都已合規
      D: (10/20)/(14/20) 約 0.7143，應依用途與法域查核
    answer: D
    explain:
      A: 1.4 是交換方向後的 B 除以 A。
      B: 0.2 是選取率差的絕對值，並非比值。
      C: 本例比值並非 0.8，八成也不是通用合規證明。
      D: 50% 除以 70% 約 0.7143，仍須按適用脈絡調查。
  - id: c2
    goal: g1
    type: choice
    prompt: 兩群各有 20 人但都沒有被選中，以 B 為參照時應如何報不利影響比？
    options:
      A: (0/20)/(0/20) 無定義，保留兩群零選取率與各 20 人
      B: (0/20)/(0/20) 應填 1，因兩群零選取表示完全沒有公平風險
      C: (0/20)/(0/20) 應填 0，因零選取已足以證明存在違法歧視
      D: (0/20)/(0/20) 應填 0.8，以固定門檻補值即可繼續公平比較
    answer: A
    explain:
      A: 分母為零，0 除以 0 沒有定義。
      B: 人數相同不讓零分母產生有效比值。
      C: 無定義不等於零，也不能直接推出法律結果。
      D: 任意填門檻會隱藏資料界線。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-3:6-19
---

## 為什麼需要

某群面試通過率比另一群低，除了相差幾個百分點，也可以問「前者只有後者的幾成」。不利影響比（Disparate Impact）用相對比例呈現這個差距。

## 直覺

先找比較對象，再寫清楚「誰除以誰」。同一對選取率交換分子與分母，會得到不同數字，不能只寫一個比值而省略參照群。

![A選取率50%、B為70%，以B參照時應算50%除以70%，而非倒過來。](figure:l23402-disparate-impact-reference)

## 定義與公式

指引以獲得正向結果的群體比例比較不利影響。單一比值不能指出來源偏差、標註或模型設計是哪一項造成。

指引的八成判準是：某群的正向結果比例若低於比較群的 80%，就需留意間接歧視或不利待遇。這是篩檢警訊，法律上的歧視仍須依制度、證據及適用法域認定。

### 指定參照方向（補充）

$$
\mathrm{DI}_{A:B}=\frac{s_A}{s_B},\qquad
s_g=\frac{n_{g,+}}{n_g}
$$

$s_g$ 是群體 $g$ 的有利選取率；$n_{g,+}$ 為被選中人數，$n_g$ 為全群人數。本頁指定 A 為待檢查群、B 為參照群。

兩群都需非空，且參照群 $s_B>0$。若 B 選取率為零，比值無定義；若 A 為零、B 大於零，比值才是零。兩群都零也不能填成 1。

### 八成門檻的用途（補充）

美國 EEOC 就業甄選指引的八成經驗規則，以最高選取率群為參照。低於 0.8 通常需要進一步查不利影響；它不是違法的完整定義。

此規則有特定法域與用途，不能直接視為臺灣、各國或所有貸款制度的合規標準。高於門檻仍可能有問題，小樣本也可能讓比值很不穩定。

## 算一次（補充）

共用招聘資料每群 20 人：A 選 10 人，B 選 14 人。兩群之中 B 的選取率較高，因此本例也符合上述就業篩檢的參照選法。

$$
\mathrm{DI}_{A:B}=\frac{10/20}{14/20}=\frac57\approx0.7143
$$

A 的選取率約為 B 的 71.43%，低於 80%，是進一步調查的訊號，不可直接下違法結論。兩群資格與錯誤分布仍須另外檢查。

$$
\mathrm{DI}_{B:A}=\frac{14/20}{10/20}=1.4
$$

交換方向後是 1.4，不能拿這個倒數說 A 已通過八成篩檢。統計均等頁的 A 減 B 則是負 20 個百分點，與比值是不同單位。

## 程式（補充）

重建同一批資料，明確傳入待檢查群與參照群。零參照回傳 None，保留無法評估的狀態。

```python
data = [(g, int(i < 10), int(i < 8 or 10 <= i < end))
        for g, end in [("A", 12), ("B", 16)] for i in range(20)]
def selection(rows, group):
    ps = [p for g, y, p in rows if g == group]
    return sum(ps) / len(ps) if ps else None
def ratio(rows, target, reference):
    a, b = selection(rows, target), selection(rows, reference)
    return a / b if a is not None and b is not None and b > 0 else None
print(f"A:B={ratio(data,'A','B'):.6f}")
print(f"B:A={ratio(data,'B','A'):.6f}")
print("零參照:", ratio([("A", 1, 1), ("B", 1, 0)], "A", "B"))
```
```text
A:B=0.714286
B:A=1.400000
零參照: None
```

:::tip[讀碼重點]
參數 reference 決定分母。None 不是 0，不能讓報表把無定義比值誤判為低於門檻。
:::

## 怎麼用、怎麼判讀

指引列出招聘及公平貸款等審查場景。可以用比值描述群體結果差距；是否採八成門檻、如何認定法律後果，則必須另外查適用規則。

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 招聘法律合規審查 | 指明參照群、母群範圍與選取階段 |
| 公平貸款法律合規審查 | 比值描述核准差距，法律門檻另查 |
| 升學獎助（補充） | 分母是申請者，不能改成全校人數 |
| 員工培訓（補充） | 先區分有資格申請者與實際受邀者 |

:::supplement[來源：EEOC，UGESP Questions and Answers，11–12、20–22]
報告應附各群申請人數、選取人數、參照規則與觀察期間。相同比值不代表相同證據強度。

以下為教學小例子，A 是待查群、B 是參照群：

| 批次 | A 選中／申請 | B 選中／申請 | DI |
|---|---|---|---|
| 小批次 | 3／4 | 4／4 | (3/4)/(4/4)＝0.75 |
| 大批次 | 300／400 | 400／400 | (300/400)/(400/400)＝0.75 |

兩批比值相同，但支持它的申請人數不同。判讀時仍須保留各群原始人數，不能只留下 0.75。
:::

## 常見誤解

- 比值只描述結果差距，不能單憑它確定偏見成因。
- 0.8 是相對比例，不是兩群差 20 個百分點。（補充）
- 超過八成不代表各法域自動合規，低於八成也不是單獨的違法判決。（補充）
- 參照群零選取率時，比值無定義，不能當成零或通過。（補充）

## 進階

### 多群體與固定比較（補充）

美國就業篩檢慣用最高選取率群作分母；研究或監控也可能事先指定固定參照群。報告需寫選法及各群原始比例，避免跨期換分母造成表面改善。

### 參考來源

- 科目 3 學習指引（2025-12 版）`guide-3:6-19`：支持結果比例、應用場景及無法推知原因的限制；原文的八成說法需加法域界線。
- [EEOC：UGESP Questions and Answers，11–12、20–22](https://www.eeoc.gov/laws/guidance/questions-and-answers-clarify-and-provide-common-interpretation-uniform-guidelines)：支持最高選取率參照、八成經驗規則與小樣本限制。
- [Fairlearn：Common fairness metrics](https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html)：支持差與比的區分，以及八成規則誤用的教學警示。

## 小結

- 先指定待查群與參照群，再算選取率之比。（補充）
- 本例 0.7143 是比例，不是百分點差。（補充）
- 八成規則有特定法域與用途，須配合其他證據。（補充）
- 比值無法直接指出偏見的成因。
