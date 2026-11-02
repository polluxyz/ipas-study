---
id: debiasing-strategies
title: 去偏策略三階段
kind: technique
codes: [L23402, L21101, L21102]
aliases: [Pre-processing/In-processing/Post-processing, 去偏策略]
requires: [algorithmic-bias, statistical-parity]
summary: 先找群體落差，再依資料、重訓與推論條件選擇介入階段
goals:
  - id: g1
    text: 從分群選取率與錯誤率診斷問題，安排改善與復評
  - id: g2
    text: 將抽樣、權重與閾值歸入三階段，依操作限制選方案
mitigates:
  - target: algorithmic-bias
    note: 三階段提供不同介入位置，仍須以固定資料復評群體差距
    source: [guide-3:6-20, guide-3:6-21, guide-3:6-22]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩群各20人、各10位具資格者；A為TP8/FP2，B為TP8/FP6。團隊應如何解讀並安排後續？
    options:
      A: TPR同為80%、FPR為20%與60%，查來源後用固定稽核集復評
      B: 選取率為50%與70%、TPR也相差20點，先補足B群正例
      C: TPR同為80%、FPR也相同，維持模型並只追蹤總體準確率
      D: 選取率為50%與70%、B群表現較佳，直接刪除A群的資料
    answer: A
    explain:
      A: 正負例各10人，TPR相同但FPR差40個百分點，需追查並復評。
      B: 選取率的分母是全群，不能把它的差值當成TPR差值。
      C: B有6個假陽例，FPR是60%，不能由相同TPR推論FPR相同。
      D: 選取較多不代表較正確，刪除另一群也不能修正誤檢來源。
  - id: c2
    goal: g2
    type: choice
    prompt: 招聘系統可取得受控訓練群體欄位並重訓，但上線推論禁用群體欄位。以下哪個方案符合此條件？
    options:
      A: 保留原模型，按每位申請者群體套用0.5或0.7的不同閾值
      B: 保留原模型，先用郵遞區號猜群體再套用不同群體的閾值
      C: 只將訓練資料重抽樣成各32筆，直接部署未重訓的舊模型
      D: 用訓練群體約束重訓，部署僅以一般特徵推論的預測器
    answer: D
    explain:
      A: 分群閾值必須在推論時知道群體，與題目限制不符。
      B: 用代理欄猜群體不能視為已符合禁用群體的限制。
      C: 抽樣改了訓練輸入，舊模型權重不會因此自動更新。
      D: 可選推論不需敏感欄位的約束方法，並在部署前核查輸入。
  - id: c3
    goal: g2
    type: choice
    prompt: 視覺辨識專案提出三項改動：訓練前固定樣本權重、訓練中依公平差距更新權重、模型完成後調整閾值。分類何者正確？
    options:
      A: 依序是訓練中、前處理、後處理，因樣本權重都在fit使用
      B: 依序是前處理、訓練中、後處理，依介入機制判斷階段
      C: 依序是前處理、後處理、訓練中，因閾值會改變預測結果
      D: 依序是後處理、訓練中、前處理，因模型完成仍可改資料
    answer: B
    explain:
      A: 訓練前決定的資料權重仍可屬前處理，不能只看fit呼叫。
      B: 固定輸入、依公平回饋改訓練、修正輸出是三種不同機制。
      C: 閾值在模型完成後套用，不會因此變成權重訓練。
      D: 修改輸出規則和修改訓練資料的時點及作用不同。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-36, guide-1:3-37, guide-1:3-57, guide-1:3-58, guide-3:6-20, guide-3:6-21, guide-3:6-22, guide-3:6-23]
---

## 為什麼需要

招聘模型讓兩群符合資格者都有八成獲選，仍可能對其中一群錯放更多不符合者。先說清楚要改善哪種落差，才能選對去偏策略。

指引將介入分成資料前處理（Pre-processing）、訓練中處理（In-processing）、模型後處理（Post-processing）。分類依據是改動發生在哪裡。

## 直覺

把模型流程想成備料、烹調與出餐。資料不足要補料，目標錯誤要改烹調方式，成品已有分數則可調整出餐規則。

![前處理改訓練輸入、訓練中改學習目標、後處理改輸出規則；三條路都要回到分群復評。](figure:l23402-debiasing-strategies-stages)

:::supplement[來源：Fairlearn，Mitigations]
三階段可以搭配使用，但每次比較先只改一項，才看得出哪個改動帶來差異。
:::

## 定義與公式

| 階段 | 主要改什麼 | 例子 | 主要限制（補充） |
|---|---|---|---|
| 前處理 | 訓練資料或表示 | 重抽樣、特徵去偏 | 平衡數量不保證結果公平 |
| 訓練中 | 學習目標或更新方式 | 公平約束、對抗式去偏 | 需重訓，可能有效能取捨 |
| 後處理 | 固定模型之後的輸出 | 分群閾值、分群體校準 | 只能修正可取得的輸出資訊 |

:::supplement[來源：Fairlearn，Mitigations、Reductions、Postprocessing]
前處理改了資料，仍要重訓才會改變模型。分群閾值通常需要推論時的敏感欄位；某些約束訓練則只在訓練時使用它。

固定樣本權重可視為前處理；若公平約束演算法在訓練迭代中調整權重，則屬訓練中處理。不要只憑「加權」兩字分類。
:::

## 走一次流程

### 先看同一批人的差距（補充）

沿用前置組招聘與信貸各40筆固定稽核集。每群20筆，其中10筆符合資格；有利決策為面試或核准。

| 群體 | TP／FN | FP／TN | 選取率／TPR／FPR |
|---|---|---|---|
| A | 8／2 | 2／8 | 50%／80%／20% |
| B | 8／2 | 6／4 | 70%／80%／60% |

A選中10人、B選中14人，所以選取率差20個百分點。兩群TPR相同；B的FPR較高40個百分點，不能說所有公平指標都相同。

共用資料的區域欄可猜對36/40人的群體。另設「只讓區域甲通過」的規則，完全不用群體欄：A選取18/20＝90%，B僅2/20＝10%，選取率仍差80個百分點。

這是沿用同一批人的另一條示意規則，不是上表模型的輸出。它直接展示：刪掉群體欄，代理特徵仍可能造成群體落差。

### 診斷、分工、復評

先由資料人員查群體來源與標註，再由模型人員檢查目標及分群表現。視覺任務還須查拍攝條件；不能只把群體名稱當成誤差原因。

| 措施 | 誰負責／改什麼 | 改善後查什麼（補充） |
|---|---|---|
| 過採樣、欠採樣 | 資料人員調整訓練樣本數 | 原分布下的群體錯誤 |
| 資料增強 | 資料人員增加合理變化 | 標籤是否保真、低畫質表現 |
| 重加權 | 資料或模型人員調整樣本影響 | 權重定義與各群受益情形 |
| 後處理閾值 | 模型及部署人員修正決策規則 | 選取率、TPR與FPR是否同時改善 |

:::supplement[來源：Google Machine Learning Crash Course，Fairness: Mitigating bias；Fairlearn，Postprocessing]
招聘部署禁止使用群體欄位，就不能直接套用分群閾值。若可改資料並重訓，可先補代表性，或選推論不需群體欄的約束訓練。

信貸示例假設可使用群體欄位且模型權重凍結，才考慮後處理。兩種部署條件都只是教學設定，不代表產業通則。
:::

:::supplement[來源：Google Machine Learning Crash Course，Mitigating bias；Fairlearn，Postprocessing]
改善後，在未重抽樣的固定稽核集重算分群指標，並查整體效能。記錄資料與模型版本；若用稽核結果再調參，它就成了開發資料，需另留最終測試集。
:::

## 程式（補充）

以下依前置組規則重建40筆，從計數核算差距。這是診斷程式，尚未執行去偏訓練。

```python
rows = [(g, int(i < 10), int(i < 8 or 10 <= i < end))
        for g, end in [("A", 12), ("B", 16)] for i in range(20)]
for g in "AB":
    part = [(y, p) for group, y, p in rows if group == g]
    tp = sum(y == p == 1 for y, p in part)
    fp = sum(y == 0 and p == 1 for y, p in part)
    print(f"{g}: 選取率={sum(p for y,p in part)/20:.2f} "
          f"TPR={tp/10:.2f} FPR={fp/10:.2f}")
```
```text
A: 選取率=0.50 TPR=0.80 FPR=0.20
B: 選取率=0.70 TPR=0.80 FPR=0.60
```

## 怎麼用、怎麼判讀

NLP可先檢查不同語言的資料覆蓋及分類落差；視覺模型可分群檢查誤檢、漏檢，再選補資料或模型修正。

:::supplement[來源：Google Machine Learning Crash Course，Mitigating bias]
改善措施要回到相同評估條件復查，才能比較改動前後的群體表現。
:::

### 換個場景

| 場景／資料條件 | 優先判讀 |
|---|---|
| 招聘、銀行信用評分 | 查群體代表性、代理特徵與決策差距 |
| 少數語言NLP、不同拍攝條件的視覺模型 | 查語料覆蓋與誤檢漏檢差異 |
| 醫療影像、工業瑕疵 | 分別確認誤檢與漏檢的代價 |
| 培訓名額分配（補充） | 同時查獲選機會與符合資格者的漏選 |
| 交通補助審核（補充） | 先確認可改資料、重訓與部署輸入 |

## 常見誤解

- 前處理不是部署前做過的所有操作，要看是否改訓練輸入。
- 群體樣本數相等，不代表標註與來源已沒有偏見。
- 同TPR仍可能有不同FPR，不能只選一個好看的指標。（補充）
- 把群體欄位刪掉，仍可能留下能猜出群體的代理特徵。

## 進階

### 沒有單一最佳階段（補充）

先列出可操作條件：可否取得資料、可否重訓、可否在推論使用敏感欄。再比較可行方案的效能與公平差距，保留未改善的指標。

### 參考來源

- 科目1學習指引 `guide-1:3-36`～`guide-1:3-37`、`guide-1:3-57`～`guide-1:3-58`：支持NLP、視覺的診斷、平衡及復評場景。
- 科目3學習指引 `guide-3:6-20`～`guide-3:6-23`：支持三階段定義與方法分類。
- [Fairlearn：Mitigations](https://fairlearn.org/main/user_guide/mitigation/index.html)、[Reductions](https://fairlearn.org/main/user_guide/mitigation/reductions.html)、[Postprocessing](https://fairlearn.org/main/user_guide/mitigation/postprocessing.html)：支持操作條件與加權分類的補充。
- [Google機器學習課程：Mitigating bias](https://developers.google.com/machine-learning/crash-course/fairness/mitigating-bias)：支持由資料問題與損失設計選介入方式的教學安排。

## 小結

- 先診斷群體落差，再決定要改哪個階段。
- 前處理改輸入、訓練中改學習、後處理改輸出。
- 可否重訓與取得敏感欄位，會限制方案。（補充）
- 固定資料、只改一項，再用多項指標復評。（補充）
