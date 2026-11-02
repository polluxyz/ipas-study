---
id: pr-auc
title: PR 曲線與 PR-AUC
aliases: [PR 曲線, Precision-Recall Curve, AUPRC]
kind: metric
codes: [L23303]
requires: [precision, recall, roc-auc]
contrasts:
  - target: roc-auc
    note: ROC 以假正率為橫軸、真正率為縱軸；PR 以召回率為橫軸、精確率為縱軸，兩種曲線的座標不可混用
    source: [guide-3:5-22, 115-1-S1-Q08]
guide_refs: [guide-3:5-25]
gaps:
  - ref: guide-3:5-25
    level: missing
    ability: 指引處理類別不平衡時只談重加權、SMOTE、異常偵測，未說明 PR 曲線的兩軸、正類比例基準，以及 AP 與梯形面積的差別
author: codex
status: draft
textbook: v2
summary: PR 曲線描繪不同閾值下，抓到多少正類及警報有多可信
goals:
  - id: g1
    text: 找出 PR 曲線的兩軸與閾值點，處理同分與無警報的端點
  - id: g2
    text: 區分平均精確率 AP 與梯形 PR AUC，從同一批分數核算
  - id: g3
    text: 以正類比例判讀基準線，說明與 ROC-AUC 的差異
formula_groups:
  - id: pr-coordinates
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: ap
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: trapezoid
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: prevalence
    source: https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html
    status: verified
    checked_by: ctx_ce650b18e31c
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一個模型在固定閾值下有 TP=6、FP=4、FN=2，PR 曲線上的點（橫軸，縱軸）為何？
    options: { A: '（0.60，0.75）', B: '（0.40，0.75）', C: '（0.75，0.60）', D: '（0.75，0.40）' }
    answer: C
    explain:
      A: 這是把精確率放在橫軸，兩軸對調。
      B: 橫軸不是誤報占警報的比例，而是召回率。
      C: 橫軸召回率為 6/8，縱軸精確率為 6/10。
      D: 縱軸 0.40 是誤報占警報比例，非精確率。
  - id: c2
    goal: g2
    type: choice
    prompt: 團隊用相同標籤與分數算出 AP=0.79、梯形 PR AUC=0.77，哪種解釋正確？
    options:
      A: 兩者必須相等，程式一定有錯
      B: 兩者採用不同積分規則，應寫清楚算法再比較模型
      C: AP 是精確率的無權重平均，與召回率無關
      D: 梯形 PR AUC 永遠大於 AP，所以兩者必然標反
    answer: B
    explain:
      A: AP 按召回率增量加權，梯形法使用端點平均，數字可以不同。
      B: 算法不同會影響數字，先統一算法才有共同比較基準。
      C: AP 的權重就是召回率增量，非無權重平均。
      D: 梯形法可能偏樂觀，但沒有永遠較大的保證。
  - id: c3
    goal: g3
    type: choice
    prompt: 某設備故障預警資料有 2% 正類，應如何判讀 PR 的無資訊基準線？
    options:
      A: 一律是 0.5，與 ROC-AUC 相同
      B: 一律是 1，因為所有故障都可被找出
      C: 只取決於使用的模型，不需知道類別比例
      D: 水平參考值是 0.02，跨資料集比較要留意比例差異
    answer: D
    explain:
      A: 0.5 是 ROC 隨機排序的 AUC 基準，PR 基準取決於正類比例。
      B: 全判正類的召回率為 1，但精確率僅等於正類比例。
      C: 正類比例是 PR 基準的重要條件，不能省略。
      D: 正類比例為 0.02，提供無資訊模型的水平參考。
---

## 為什麼需要（補充）

在盜刷或故障預警中，誤報太多會淹沒調查人員。ROC-AUC 能看正負類排序，卻不直接回答「收到的警報有多少是真的」。

PR 曲線（Precision-Recall Curve）比較「多抓一些」與警報可信度。PR 曲線、平均精確率等中文名稱為本站用詞。

學習指引只要求不平衡資料搭配多項指標；本頁是理解 ROC 限制的核心延伸，整頁內容屬補充。

## 直覺（補充）

沿用共同 20 筆交易，盜刷有 8 筆、正常有 12 筆。把閾值逐步降低，警報清單就逐步加長，召回率不會下降，精確率卻可能上下移動。

例如閾值從 0.65 降到 0.5，只多納入一筆盜刷，精確率反而由 $5/7$ 升為 $6/8$。所以不能把「閾值降低」背成「精確率一定降低」。

![橫軸是召回率、縱軸是精確率，閾值 0.5 對應 (0.75,0.75)，水平基準線是 0.4](figure:l23303-pr-auc-shared)

圖使用教學模擬資料；階梯高度代表該段召回率所對應的精確率，面積採 AP 規則。

## 定義與公式（補充）

### 兩軸與端點

$$
R=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}},\qquad
P=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FP}}
$$

$R$ 是橫軸召回率，$P$ 是縱軸精確率。TP 為命中正類，FN 為漏報，FP 為誤報。閾值 0.5 時兩者分別是 $6/(6+2)=0.75$，點為 $(0.75,0.75)$。

沒有預測正類時，精確率是 0/0，沒有定義。圖上另加 $(R=0,P=1)$ 是繪圖慣例，不代表真的算出精確率 1，也不對應一個有限閾值。

本頁要求評估資料同時有正負類；沒有真實正類時召回率沒有定義，不能將套件回傳的數字當成一般 AP 解讀。

### 平均精確率與梯形面積

把閾值由高掃到低，召回率 $R_k$ 依序不減；$P_k$ 是每個閾值的精確率，$R_0=0$。相同分數的樣本必須整批加入。

$$
\mathrm{AP}=\sum_{k=1}^{m}(R_k-R_{k-1})P_k
$$

$m$ 是不同分數產生的狀態數。平均精確率（Average Precision，AP）將新增召回率當權重，使用新增樣本之後的精確率，沒有直線插值。

例如召回率從 $4/8$ 增到 $5/8$，精確率變為 $5/7$，該段貢獻為 $(1/8)\times(5/7)=5/56$。

$$
\mathrm{AUC}_{\mathrm{PR,trap}}=
\sum_{k=1}^{m}(R_k-R_{k-1})\frac{P_{k-1}+P_k}{2}
$$

$P_{k-1}$ 是前一個點的精確率，繪圖起點取 $P_0=1$。梯形 PR AUC 把相鄰點連成直線，使用兩端精確率的平均，與 AP 不同。

同一段寬為 1/8，兩端高度為 4/5 與 5/7，梯形面積約 0.09464；AP 該段則約 0.08929。報告須說明採用哪個算法。

### 基準線

$$
\pi=\frac{n_+}{n_++n_-}
$$

$\pi$ 是正類比例，$n_+$ 與 $n_-$ 是正、負樣本數。共同資料的 $\pi=8/(8+12)=0.4$，可作為 PR 的無資訊水平參考。

這是無資訊排序的母體參考，不保證有限樣本的每次隨機排序都恰好得到 AP=0.4。把所有交易都報警時，召回率為 1，精確率也回到 0.4。

## 算一次（補充）

先列出會增加召回率的閾值；只新增正常交易時，召回率不變，對 AP 的貢獻為零，但仍會影響下一段梯形的起點。

| 閾值 | 新增後召回率 | 新增後精確率 |
|---|---:|---:|
| 0.95、0.90 | 1/8、2/8 | 1、1 |
| 0.80、0.75 | 3/8、4/8 | 3/4、4/5 |
| 0.65、0.50 | 5/8、6/8 | 5/7、3/4 |
| 0.35、0.20 | 7/8、8/8 | 7/10、8/13 |

每次召回率都增加 1/8，因此可直接把八個精確率相加後除以八：

$$
\mathrm{AP}=\frac18\left(1+1+\frac34+\frac45+\frac57+
\frac34+\frac7{10}+\frac8{13}\right)\approx0.79121
$$

式中的八項分別是八筆盜刷加入警報時的精確率；同分 0.65 的盜刷與正常一起加入，所以該項為 5/7，不是 5/6。

使用全部閾值點，包括召回率不變的點及繪圖端點，梯形積分得到約 0.78191。兩個值來自同一份資料，差異來自面積規則。

## 程式（補充）

下例使用相同的 20 筆分數，`average_precision_score` 計算 AP，`auc` 則對 PR 座標做梯形積分。

```python
from sklearn.metrics import precision_recall_curve, average_precision_score, auc
y = [1,1,0,1,1,1,0,1,0,1,0,0,1,0,0,0,0,0,0,0]
s = [.95,.90,.85,.80,.75,.65,.65,.50,.40,.35,
     .30,.25,.20,.18,.15,.12,.10,.08,.05,.02]
precision, recall, thresholds = precision_recall_curve(y, s)
print(f"AP={average_precision_score(y, s):.5f}")
print(f"梯形PR AUC={auc(recall, precision):.5f}")
print(f"基準線={sum(y)/len(y):.2f}")
i = list(thresholds).index(0.5)
print(f"t=0.5: R={recall[i]:.2f}, P={precision[i]:.2f}")
```
```text
AP=0.79121
梯形PR AUC=0.78191
基準線=0.40
t=0.5: R=0.75, P=0.75
```

:::tip[讀碼重點]
`precision_recall_curve` 回傳的召回率由大到小，`auc` 能處理這個方向。最後的繪圖端點沒有對應閾值，因此 `thresholds` 比另外兩個陣列少一項。
:::

## 怎麼用、怎麼判讀（補充）

正類稀少且警報需要人工處理時，先用 PR 檢查精確率，再依可接受的漏報與工作量選閾值。不能只因 AP 高就推論上線效益好。

### 正常交易變多會怎樣

把共同資料中每筆正常交易重複 10 次，盜刷仍維持 8 筆。各類內分數分布不變，ROC 曲線及 ROC-AUC 也不變。

但正類比例從 40% 變成 $8/128=6.25\%$；閾值 0.5 下 TP=6、FP=20，精確率成為 $6/26\approx0.231$，召回率仍為 0.75。

![只放大正常交易筆數，基準線降為 0.0625，閾值 0.5 的精確率降為約 0.231](figure:l23303-roc-pr-imbalance)

這是既有圖的思想實驗，不代表現實盜刷率。跨資料集比較 AP，要同時報告正類比例；也不要將 AP 與 ROC-AUC 的數字直接比高低。

### 換個場景（補充）

| 場景 | 使用理由 | 判讀重點 |
|---|---|---|
| 醫療篩檢 | 疾病少見、複檢有負擔 | 在高召回率區間看精確率，不用 AP 取代漏診限制 |
| 製造故障預警 | 故障少、每次停機檢查昂貴 | 先限定可承受警報量，再選閾值 |
| 客服高風險案件 | 稀有急件需要優先處理 | 報告正類比例與固定閾值下的工作量 |

## 常見誤解（補充）

- **PR 的基準線一律是 0.5**：水平基準是正類比例，本例為 0.4。
- **AP 就是梯形面積**：兩者的插值與加權規則不同，本例結果分別約 0.79121、0.78191。
- **PR 曲線精確率一定單調**：新增的正、負類次序不同，精確率可能上下變動。
- **繪圖端點的精確率為 1 代表沒有誤報**：沒有任何警報時，精確率其實未定義。

## 進階（補充）

### 面積規則與比較前提

梯形法的直線插值可能對某些 PR 形狀過度樂觀，但不是每份資料都高於 AP；本例就是 AP 較高。要比較模型，必須固定資料、正類、面積算法及同分規則。

### 參考來源

- [scikit-learn：precision_recall_curve](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html)（支持：兩軸與端點、程式）。
- [scikit-learn：average_precision_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html)（支持：AP 與梯形積分、算一次、進階）。
- [scikit-learn：Precision-Recall 教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html)（支持：直覺、基準線、換個場景）。
- [Google 機器學習速成課程：ROC 與 AUC](https://developers.google.com/machine-learning/crash-course/classification/roc-and-auc)（支持：正類稀少時比較 ROC 與 PR 的判讀）。

## 小結（補充）

- PR 的橫軸是召回率，縱軸是精確率；共同資料在閾值 0.5 時為 $(0.75,0.75)$。
- AP 按新增召回率加權，不能與梯形 PR AUC 混稱。
- 無資訊水平基準是正類比例；比例不同時 AP 不宜直接比較。
- 保留分數與標籤，才能重建各閾值的曲線。
