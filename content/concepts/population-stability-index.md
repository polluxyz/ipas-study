---
id: population-stability-index
title: 族群穩定性指數
kind: metric
codes: [L21302]
aliases: [PSI, Population Stability Index]
requires: [data-drift]
summary: PSI用相同分箱比較新舊占比，量化單一變數的分布改變
goals:
  - id: g1
    text: 以固定分箱計算PSI，處理零比例並說明警報與門檻的限制
formula_groups:
  - id: psi
    source: https://documentation.sas.com/api/docsets/mdlmgrug/v_016/content/mdlmgrug.pdf?locale=en
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-E
  - id: additive-smoothing
    source: https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 參考期1000筆的三箱計數為500、300、200；本期也是1000筆，三箱為200、300、500。使用自然對數，PSI最接近哪項？
    options:
      A: 0.000，因為兩期總樣本數都是1000筆
      B: 0.300，只計第一箱的占比差額便足夠
      C: 0.550，固定三箱後加總各箱差額乘對數比
      D: 0.900，將各箱差額的絕對值直接相乘
    answer: C
    explain:
      A: 總數相同不代表每箱占比相同。
      B: PSI必須加總全部箱的貢獻，還要乘上自然對數比例。
      C: 第一和第三箱各約0.274887，中間箱為0，加總約0.549774。
      D: PSI不是占比差額的乘積，這個算法沒有使用對數比。
  - id: c2
    goal: g1
    type: choice
    prompt: 本期PSI為0.55，超過團隊教學警戒線0.25，但授信真值要30天後才到。應提出哪個結論？
    options:
      A: 已證明準確率下降55%，可以直接下架模型
      B: 已證明長尾群不公平，可以直接重寫其標籤
      C: 已證明概念關係改變，可以取消後續真值回收
      D: 已發現分布變化線索，先查管線並保留效能判斷
    answer: D
    explain:
      A: PSI數值不是準確率降幅，也不獨立決定下架。
      B: PSI比較變數分布，不提供群內錯誤或公平性的直接證據。
      C: 沒有真值不能確認輸入與結果的條件關係。
      D: 警報可啟動調查，效能與原因仍需要其他證據。
  - id: c3
    goal: g1
    type: choice
    prompt: 兩箱參考計數0、10，本期5、5；事先約定每箱加1後各自重新正規化。哪個處理正確？
    options:
      A: 參考改1/12、11/12，本期改6/12、6/12，再算PSI
      B: 參考改1/10、11/10，本期改6/10、6/10，再算PSI
      C: 參考改0/10、10/10，本期改5/10、5/10，把對數零當零
      D: 參考刪去第一箱，本期保留兩箱，再對各自占比算PSI
    answer: A
    explain:
      A: 分子加偽計數後分母也要增加，各自比例和才維持為1。
      B: 分母未同步增加，比例和大於1，已不是可比較分布。
      C: 原式含對數零及除以零，不能任意把該項當0。
      D: 新舊必須使用相同箱集合，不能只在其中一邊刪箱。
textbook: v2
author: codex
status: draft
---

## 為什麼需要（補充）

資料漂移能用圖看，也需要一個可追蹤的摘要。族群穩定性指數（Population Stability Index，PSI）比較同一變數在參考期與監控窗的分箱占比；本頁的計算屬補充。

這裡的「族群」指兩批觀測資料的分布，不是專指受保護群體。要查長尾失準，仍須另做群體效能監控。

## 直覺（補充）

箱界先固定，再把兩期資料倒進相同格子。某箱占比從 20% 變 50%，另有箱從 50% 變 20%，PSI 會把這些搬動累加；樣本總數相同仍可能有大幅改變。

![促銷前後使用相同金額箱界；PSI比較每箱占比，不比較兩期總筆數是否相同。](figure:l21302-model-monitoring-promotion)

## 定義與公式（補充）

$$
\mathrm{PSI}=\sum_{i=1}^{k}(q_i-p_i)\ln\frac{q_i}{p_i}
$$

$k$ 是固定箱數，$p_i$ 是參考期第 $i$ 箱占比，$q_i$ 是監控窗同箱占比，$\ln$ 是自然對數。比例用 0–1，兩邊各自加總為 1；原式要求每箱比例皆大於 0。

占比差與對數比同號，因此各項非負，分箱占比完全相同時為 0。它沒有百分比單位，也不是統計檢定的 p 值。

### 零箱與平滑（補充）

若某箱為零，先確認是否真沒樣本、資料中斷或新類別。不能把對數零直接設為零；一個可事先固定的教學方案是加偽計數後重新正規化。

$$
\tilde p_i=\frac{a_i+\alpha}{N_p+k\alpha},\qquad
\tilde q_i=\frac{b_i+\alpha}{N_q+k\alpha}
$$

$a_i,b_i$ 為各期箱計數；$N_p,N_q$ 為各期總數；$\alpha>0$ 是每箱加入的偽計數。將平滑後比例代回 PSI；這是實作選擇，須保存 $\alpha$，不是 PSI 唯一標準。

沿用前置零箱例子：計數0／10與5／5。各箱加1後，參考為1／12、11／12，本期為6／12、6／12，PSI約0.999123；平滑會影響小樣本結果，來源見頁尾。

## 算一次（補充）

使用本組四期授信資料，固定 W0 為參考。三箱是申請前近 30 日消費低於 1,000 元、1,000 至未滿 3,000 元、至少 3,000 元。

| 金額箱 | W0計數／占比 | 促銷W1計數／占比 | PSI貢獻 |
|---|---|---|---|
| 低於1000元 | 500／0.5 | 200／0.2 | 約0.274887 |
| 1000至未滿3000元 | 300／0.3 | 300／0.3 | 0 |
| 至少3000元 | 200／0.2 | 500／0.5 | 約0.274887 |

- 第一箱：$(0.2-0.5)\ln(0.2/0.5)\approx0.274887$。
- 第三箱：$(0.5-0.2)\ln(0.5/0.2)\approx0.274887$。

兩項相加得0.549774，顯示分箱占比變動；中間箱占比相同，貢獻為0。

W2 使用同一分布，因此對 W0 的 PSI 也為 0.549774。若改跟 W1 比便得到 0，會漏掉相對原參考的變化；比較基準必須一起報。

W3 對 W0 約 0.016425。視覺資料的 W2 則回到參考亮度分布，PSI 為 0，但長尾錯誤率仍為 30%；相同單變數分布不能保證預測品質相同。

## 程式（補充）

本例使用共用 JSON 的固定計數。第一段計算四個授信窗；沒有隨機抽樣，也不寫檔。

```python
from math import log
def psi_counts(reference, current, alpha=0):
    if len(reference) != len(current) or not reference:
        raise ValueError("必須使用相同且非空的箱集合")
    if alpha < 0 or min(reference + current) < 0:
        raise ValueError("計數與偽計數不可為負")
    rp, cq = [x + alpha for x in reference], [x + alpha for x in current]
    if min(rp + cq) <= 0:
        raise ValueError("零箱須先訂平滑或合箱規則")
    p, q = [x / sum(rp) for x in rp], [x / sum(cq) for x in cq]
    return sum((b - a) * log(b / a) for a, b in zip(p, q))
for name, counts in [("W0", [500, 300, 200]), ("W1", [200, 300, 500]),
                     ("W2", [200, 300, 500]), ("W3", [450, 300, 250])]:
    print(name, f"{psi_counts([500, 300, 200], counts):.6f}")
```
```text
W0 0.000000
W1 0.549774
W2 0.549774
W3 0.016425
```

第二段沿用前段函式，確認零箱處理。實務還要把缺值或新類別列入既定箱規則，避免計算時悄悄丟掉異常資料。

```python
try:
    psi_counts([0, 10], [5, 5])
except ValueError as error:
    print(error)
print("加1後：", f"{psi_counts([0, 10], [5, 5], alpha=1):.6f}")
```
```text
零箱須先訂平滑或合箱規則
加1後： 0.999123
```

:::tip[讀碼重點]
箱界須在呼叫函式前已固定。新舊資料各自正規化，不能把本期箱界重切成自己的分位數，否則可能把漂移洗掉。
:::

## 怎麼用、怎麼判讀（補充）

本組用 0.25 作「啟動調查」的教學門檻，不是及格線或通用標準。PSI 大小受箱數、箱界、樣本量、季節與平滑影響；應用歷史正常窗及已知事故驗證誤報、漏報，再定門檻。

PSI 不需真值，適合真值延遲時先追輸入；它不能單獨證明準確率下降、概念漂移或變化原因。單變數 PSI 也可能看不見多個特徵的聯合關係變化。

### 換個場景（補充）

學習指引未展開 PSI 計算與適用場景，以下皆為補充。

| 場景 | 比較對象 | 仍需另外查 |
|---|---|---|
| 授信促銷 | 新舊申請金額分箱 | 到期真值及客群成績 |
| 視覺檢測 | 同相機亮度分布 | 光源、畫質及人工複驗 |
| 客服意圖 | 同一意圖分類的占比 | 新產品詞彙及答覆品質 |

## 常見誤解（補充）

- 「PSI 0.55 就是錯誤率 55%。」它是分布差異摘要，沒有這個換算。
- 「每期重新等頻分箱較公平。」這會失去固定箱比較的意義。
- 「PSI 為 0，模型就沒問題。」同箱分布相同仍可能有關係或群體效能變化。
- 「超過 0.25 就自動換模型。」先調查，再用獨立資料驗證候選。

## 進階

### 平滑與分箱的紀錄（補充）

保存特徵定義、箱界、缺值規則、參考窗及偽計數。監控規格改動應另記版本，避免把不同算法的 PSI 串成一條可直接比較的趨勢。

### 參考來源

- [SAS Model Manager User’s Guide 2023.06，Population Stability，印刷164頁](https://documentation.sas.com/api/docsets/mdlmgrug/v_016/content/mdlmgrug.pdf?locale=en)：支持固定箱占比及PSI公式。
- [du Pisanie等人的原始研究，第3.2節與4.2.1節](https://arxiv.org/html/2303.01227v1)：支持PSI限制、零箱問題及門檻須審慎使用，並參考其數值比較教法。
- [scikit-learn Multinomial Naive Bayes的平滑公式](https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes)：支持計數加偽計數並重新正規化的代數形式；將它用於PSI零箱及加1強度，都是本頁明示的教學選擇。
- [CMU SEI 漂移教學](https://www.sei.cmu.edu/blog/expecting-the-unexpected-monitoring-for-drift-in-ml-systems/)：支持分布差異與實測品質的區分。
- 前置教學資料 `content/examples/L21203-C-drift.json`：支持零箱算例；四期金額與亮度則取自本組獨立資料。

## 小結（補充）

- 固定箱界，以各期占比計算PSI，不能只比總筆數。
- 遇到零箱先查原因，再使用已約定並記錄的修正規則。
- 門檻要用情境證據驗證，PSI本身不能證明效能或因果。
