---
id: fairness-postprocessing
title: 後處理門檻調整
kind: technique
codes: [L23402]
aliases: [Post-processing, Threshold Adjustment]
requires: [debiasing-strategies, equalized-odds]
is_a: [debiasing-strategies]
summary: 固定模型分數，調整決策閾值前先確認群體資訊在推論時可用
goals:
  - id: g1
    text: 用同一分數比較分群閾值的選取率與錯誤變化
  - id: g2
    text: 依推論能否取得敏感欄位判斷分群閾值是否可執行
formula_groups:
  - id: group-threshold-decision
    source: https://fairlearn.org/main/user_guide/mitigation/postprocessing.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23402-B
contrasts:
  - target: group-calibration
    note: 閾值調整改決策界線，校準改分數與實際發生率的對應
    source: [guide-3:6-22, guide-3:6-23]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: A閾值維持0.5；B從0.5升到0.7。B的4筆0.6分皆為負例，其餘不變；原B為TP8/FN2/FP6/TN4。結果為何？
    options:
      A: B成為TP4/FN6/FP6/TN4，選取率50%、FPR60%、TPR40%
      B: B成為TP8/FN2/FP6/TN4，選取率70%、FPR60%、TPR80%
      C: B成為TP8/FN2/FP2/TN8，選取率50%、FPR20%、TPR80%
      D: B成為TP10/FN0/FP6/TN4，選取率80%、FPR60%、TPR100%
    answer: C
    explain:
      A: 被拒的4筆都是負例，不會使真陽例減少。
      B: 0.6低於新閾值，這4筆的決策會從選取改為拒絕。
      C: 4個假陽例轉成真陰例，正例決策不變，因此TPR不變。
      D: 提高閾值不會把原本未選的正例變成選取。
  - id: c2
    goal: g2
    type: choice
    prompt: 外部API提供連續分數，模型不能重訓；部署端只允許一般特徵，無法取得或推知個案群體。能否直接執行A用0.5、B用0.7？
    options:
      A: 可以，連續分數可識別群體並自動選用所需的閾值
      B: 不可直接執行分群閾值，需改可用方案或取得允許的輸入
      C: 可以，將分數低於0.7者全部當成B群即可維持原本的公平保證
      D: 不可使用任何後處理，因為模型不能重訓時連統一閾值都不能改
    answer: B
    explain:
      A: 分數不會自動攜帶可用的群體識別，仍缺套用規則的輸入。
      B: 分群規則依賴群體資訊，部署端必須有合法且允許的取得方式。
      C: 用分數自行定義群體已改變原本的比較群，不能沿用公平結論。
      D: 模型不能重訓仍可調統一閾值，但它不保證符合原分群公平目標。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:6-22]
---

## 為什麼需要

模型權重已凍結，但輸出仍有連續分數時，可以在模型之後修改決策規則。這種閾值調整英文為Threshold Adjustment，改的是「分數多少才通過」。

指引也稱門檻，本頁統一寫閾值。不同群體可用不同閾值，但這種做法是否能部署，取決於推論時能否知道個案所屬群體。

## 直覺

同樣0.6分，若閾值是0.5就通過，若是0.7就不通過。模型給的分數沒有變，變的是將分數轉成行動的界線。

:::supplement[來源：Fairlearn，Postprocessing]
提高閾值通常會減少選取；被移出的若是正例，就會增加漏選，若是負例，就會減少誤選。
:::

## 定義與公式

分群閾值在固定模型輸出後，依群體使用各自的通過界線。指引以司法風險評估與貸款核准閾值說明這種介入。

### 分數到決策（補充）

$$
\hat y_i=\mathbf{1}[s_i\geq t_{g_i}].
$$

$s_i$是第$i$筆的分數，$g_i$是其群體，$t_{g_i}$是對應閾值。條件成立時指示函數$\mathbf{1}$為1，表示本例的有利決策。

同為$s_i=0.6$，A用$t_A=0.5$會選取，B用$t_B=0.7$會拒絕。分數恰好等於閾值也選取，前後須使用同一規則。

分數不必是已校準機率，但須先確認方向。本頁高分代表較符合資格；若高分代表高風險，不能直接把預測正類稱為有利核准。

## 算一次

### 固定人、分數與模型版本

:::supplement[來源：Fairlearn，Postprocessing；本組教學合成資料]
保留前置組40筆索引與真值，另造細分分數版本：B的6個假陽例中，有4個改為0.6，其餘高分仍0.8。這不是把原0.8分直接改閾值就能分開的結果。

用這個細分版本，閾值0.5時的決策與前置組相同。新規則事前固定為A用0.5、B用0.7；這裡只核算，沒有在稽核集搜尋最佳閾值。
:::

| 同樣0.6分的個案 | 所用閾值 | 決策 |
|---|---|---|
| A群個案，同分示意（補充） | 0.5 | 選取 |
| B群個案，同分示意（補充） | 0.7 | 拒絕 |

:::supplement[來源：Fairlearn，Postprocessing；本組教學合成資料]
固定稽核資料中A沒有0.6分；第一列只解釋規則，不額外加入評估人數。

| B群指標 | 原閾值0.5 | 新閾值0.7 |
|---|---|---|
| TP／FN | 8／2 | 8／2 |
| FP／TN | 6／4 | 2／8 |
| 選取率 | 14/20＝70% | 10/20＝50% |
| TPR／FPR | 80%／60% | 80%／20% |

A保持TP8/FN2/FP2/TN8，因此新規則讓兩群在這批資料上的TPR、FPR相同。整體準確率從28/40升至32/40，即70%升至80%。
:::

![B群閾值提高後只移出4個負例，TPR維持80%、FPR由60%降為20%；這是本合成資料的特性。](figure:l23402-fairness-postprocessing-thresholds)

:::supplement[來源：Fairlearn，Postprocessing]
本例公平與準確率同時改善，不代表提高閾值必有這種好處。若移出的含符合資格者，就要承擔TPR下降的代價。
:::

## 程式（補充）

依相同細分分數規則重建資料；每個閾值都從40筆重新計數。這只是固定規則的評估，不是閾值優化器。

```python
rows = []
for g, end in [("A", 12), ("B", 16)]:
    for i in range(20):
        s = 0.8 if i < 8 or 10 <= i < end else 0.3
        s = 0.6 if g == "B" and 12 <= i < 16 else s
        rows.append((g, int(i < 10), s))
for t in [0.5, 0.7]:
    part = [(y, int(s >= t)) for g, y, s in rows if g == "B"]
    tp = sum(y == p == 1 for y, p in part)
    fp = sum(y == 0 and p == 1 for y, p in part)
    print(f"B 閾值={t:.1f} 選取率={(tp+fp)/20:.2f} "
          f"TPR={tp/10:.2f} FPR={fp/10:.2f}")
```
```text
B 閾值=0.5 選取率=0.70 TPR=0.80 FPR=0.60
B 閾值=0.7 選取率=0.50 TPR=0.80 FPR=0.20
```

## 怎麼用、怎麼判讀

:::supplement[來源：Fairlearn，Postprocessing]
分群閾值必須在部署時取得群體欄位。本組信貸示例允許這個輸入，招聘示例不允許；後者不能直接套分群規則，也不能偷偷用代理欄猜群體。

在開發資料選定規則，再用獨立資料確認表現。若某群沒有正例或負例，對應的TPR或FPR無法估計，不能填零當成達標。
:::

### 換個場景

| 場景／操作條件 | 判讀重點 |
|---|---|
| 司法風險評估 | 指標正類可能是不利結果，須先釐清方向 |
| 貸款核准閾值 | 降低界線可能同時增加正確核准與錯誤核准 |
| 醫療轉介（補充） | 降閾值提高檢出時，查各群額外檢查負擔 |
| 公共培訓初選（補充） | 先確認推論可否取得群體及名額限制 |

## 常見誤解

- 後處理不需要改主模型權重，但仍需資料來設計及驗證規則。
- 閾值調整改的是決策界線，分群體校準改的是分數意義。
- 兩群選取率相同，不代表TPR與FPR也相同。（補充）
- 一組固定閾值不一定能讓所有公平指標同時達標。（補充）

## 進階

### 固定閾值的能力有限（補充）

分數同分時，單一確定閾值不能拆開整組。某些後處理方法會隨機混合決策規則以接近公平目標；這不同於本頁的單一固定閾值算例。

### 參考來源

- 科目3學習指引 `guide-3:6-22`：支持後處理定義、閾值作用、司法與貸款場景。
- [Fairlearn：Postprocessing](https://fairlearn.org/main/user_guide/mitigation/postprocessing.html)：支持推論群體欄位要求、閾值規則及隨機化限制。
- [Fairness and Machine Learning：Classification](https://fairmlbook.org/classification.html)：支持分數與決策分離的教學安排。

## 小結

- 先固定模型分數，再修改通過界線。
- 分群規則需要推論可用的群體資訊。（補充）
- 同時檢查選取率、TPR、FPR及整體效能。（補充）
- 本例的改善來自被移出的剛好都是負例。（補充）
