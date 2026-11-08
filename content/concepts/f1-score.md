---
id: f1-score
title: F1 分數
aliases: [F1, F1-score, F1 Score, Macro F1, Micro F1]
kind: metric
codes: [L23303]
requires: [precision, recall]
guide_refs: [guide-3:5-21, guide-3:4-27, guide-3:5-25]
gaps:
  - ref: guide-3:5-21
    level: shallow
    ability: 指引只給公式與一句適用情境；考題要實際算出 F1 數值，並判斷調和平均為何對較小值敏感
  - ref: guide-3:5-21
    level: missing
    ability: 指引沒有提到多分類的 macro、micro 平均；考題用 macro F1 描述情境，也考過多分類時 scoring="f1" 不能用
author: codex
status: draft
textbook: v2
summary: F1 分數同時看警報有多準，以及實際盜刷有多少被抓到
goals:
  - id: g1
    text: 由精確率、召回率或四格計數算出 F1，並處理零分母，對照醫療與瑕疵的錯誤成本
  - id: g2
    text: 說明調和平均對較小值的敏感性，以及不使用 TN 的限制，辨別零售任務的指標邊界
  - id: g3
    text: 區分二元 F1、macro 與 micro 平均，選對多分類設定，並逐類比較跨語言落差
formula_groups:
  - id: harmonic
    source: guide-3:5-21
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: count-form
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: multiclass
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
  - id: m4-language-and-domain
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html
    status: verified
    checked_by: task_5bbc5b6241d1
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一個瑕疵模型有 TP=9、FP=3、FN=6、TN=82，F1 約為多少？
    options: {A: '0.91', B: '0.667', C: '0.675', D: '0.75'}
    answer: B
    explain:
      A: 0.91 是準確率，F1 不把 TN 加進分子。
      B: 以計數式計算 18/(18+3+6)=0.667。
      C: 0.675 是精確率 0.75 與召回率 0.6 的算術平均。
      D: 0.75 只算精確率，尚未兼顧漏報。
  - id: c2
    goal: g2
    type: choice
    prompt: 甲模型精確率 0.9、召回率 0.1；乙模型兩項都是 0.5。哪個判斷正確？
    options:
      A: 兩模型 F1 都是 0.5
      B: 甲的精確率高，所以 F1 必較高
      C: 不知道 TN，因此不能算 F1
      D: 甲的 F1 為 0.18，乙為 0.5
    answer: D
    explain:
      A: 兩模型算術平均相同，調和平均卻不同。
      B: 甲的低召回率會拉低 F1，不能只看精確率。
      C: F1 不使用 TN，已有精確率與召回率即可計算。
      D: 調和平均會反映短板，代入後分別得到 0.18 與 0.5。
  - id: c3
    goal: g3
    type: choice
    prompt: 客服有 6 種互斥案件類別，各類數量差很多，希望每類同樣重要，應如何評估 F1？
    options:
      A: 使用 macro，先算每類 F1 再等權平均
      B: 使用 micro，因為它對每個類別等權
      C: 使用預設二元 F1，不需另選平均方式
      D: 使用 weighted，保證稀有類別影響最大
    answer: A
    explain:
      A: macro 讓每類各占相同權重，符合目標。
      B: micro 先合併計數，樣本多的類別影響較大。
      C: 預設二元設定不適用於六類互斥標籤。
      D: weighted 按類別樣本數加權，稀有類別權重較小。
  - id: c4
    goal: g3
    type: short
    prompt: 中文與英文各20句、每類10句，macro F1 分別約0.850與0.697。能否認定英文語言本身造成差距？若 F1 由0.8降至2/3，能否斷定 Recall 下降？
    key_points: ["兩語言逐類P、R、F1需分開看；合成例不能作語言因果", "樣本難度、標註一致性、領域與訓練覆蓋需另查", "同一下降可由P降到4/7且R維持0.8，或P升到1而R降到0.5造成"]
---

## 為什麼需要

把每筆交易都列為警報，就能抓到全部盜刷。調查人員也會收到很多誤報。只報最可疑的一筆，又可能漏掉其餘盜刷。

精確率（Precision）看警報中有多少是真的。召回率（Recall）看實際盜刷有多少被抓到。

F1 分數（F1 Score）把精確率與召回率合成一個分數。適合盜刷這類目標稀少，又要兼顧誤報與漏報的分類任務。

## 直覺

F1 要精確率與召回率都高，分數才會高。只有其中一項很高，仍無法得到高 F1。

:::supplement[來源：Google Machine Learning Crash Course：Accuracy, recall, precision, and related metrics]
直接把兩項相加除以二，可能看不出其中一項很差。這種算法叫算術平均。

例如一項 0.9、另一項 0.1，算術平均仍有 0.5。但 F1 只有 0.18。因此，「兼顧兩者」不是把兩數直接相加除以二。
:::

## 定義與公式

### 調和平均

$$
F_1=\frac{2PR}{P+R}
$$

$P$ 是精確率，$R$ 是召回率，兩者須針對同一正類、同一批資料及同一閾值計算。當 $P+R>0$ 時可直接代入。

共同交易資料的 $P=R=0.75$，所以 $F_1=2\times0.75\times0.75/(0.75+0.75)=0.75$。

### 四格計數與零分母（補充）

$$
F_1=\frac{2\mathrm{TP}}{2\mathrm{TP}+\mathrm{FP}+\mathrm{FN}}
$$

TP 是抓對的正類，FP 是誤報，FN 是漏報。共同資料代入為 $2\times6/(2\times6+2+2)=12/16=0.75$；TN 是判對的負類，不在公式內。

這個式子要求分母大於零。有正類卻全部漏報時，TP=FP=0、FN>0，F1=0；此時精確率沒有定義，應用計數式，不能硬算調和平均。

若真實與預測都只有負類，TP=FP=FN=0，F1 的分母為零，數學上沒有定義。套件可依 `zero_division` 回傳 0、1 或 NaN；報告要交代慣例，不能把它說成完美辨識正類。

## 算一次

沿用 20 筆信用卡交易的教學模擬資料，盜刷固定是正類。分數大於或等於 0.5 就發警報，因此分數恰為 0.50 的交易也算正類預測。

| 實際情況 | 發出警報 | 不發警報 |
|---|---:|---:|
| 8 筆盜刷 | TP=6 | FN=2 |
| 12 筆正常 | FP=2 | TN=10 |

1. 精確率：6 次命中 ÷ 8 次警報 = 0.75。
2. 召回率：6 次命中 ÷ 8 筆盜刷 = 0.75。
3. F1：$2\times0.75\times0.75/1.5=0.75$。

### 為何對較小值敏感（補充）

當精確率為 0.9、召回率為 0.1，$F_1=2\times0.9\times0.1/(0.9+0.1)=0.18$。因為漏掉九成正類，不能靠高精確率把整體說得很好。

兩者相等時，F1 等於這個共同數值；兩者落差愈大，F1 愈低於算術平均。這個比較是在固定兩數的前提下，不能用來斷言換閾值後 F1 一定上升。

### 同批四指標與成本（補充）

沿用 C01–C20、正類盜刷、分數 ≥ 0.5 的同一批資料。

先在[混淆矩陣](../confusion-matrix/#算一次補充)核對 TP=6、FP=2、FN=2、TN=10，再讀[準確率](../accuracy/#算一次補充)的 16/20=0.80、[精確率](../precision/#算一次補充)與[召回率](../recall/#算一次補充)的 6/8=0.75，最後讀[F1](../f1-score/#四格計數與零分母補充)的 12/16=0.75。

誤報成本高，先查 Precision 及 FP；漏報成本高，先查 Recall 及 FN；要兼顧兩者可並列 F1，但成本不等時仍看實際代價。

Accuracy 包含 TN，適合作整體摘要，無法替代前述取捨。

資料索引與唯讀來源版本記在 `L23303-M4-E-metric-cases.json`。

### 醫療與瑕疵共用案例（補充）

兩領域各自是一批固定的合成評估資料，不能合併成一批：醫療沿用 `L23303-A2-screening.json` 的 M001–M100。

製造沿用 `L23303-A2-manufacturing.json` 的 D01–D20。

兩者正類分別為疾病個案、瑕疵品，都採分數 ≥ 0.5；本批 JSON 只存來源索引及成本約定。

| 固定資料／方案 | TP、FP、FN、TN | Precision、Recall | F1、Accuracy |
|---|---|---|---|
| 醫療候選 | 4、5、1、90 | 4/9≈0.444、4/5=0.800 | 8/14≈0.571、94/100=0.940 |
| 瑕疵 A | 3、2、1、14 | 3/5=0.600、3/4=0.750 | 6/9≈0.667、17/20=0.850 |
| 瑕疵 B | 4、4、0、12 | 4/8=0.500、4/4=1.000 | 8/12≈0.667、16/20=0.800 |

醫療的 TP 是患者被轉介、FP 是健康者多做複檢、FN 是患者未被轉介、TN 是健康者正確不轉介；製造則依序是攔到瑕疵、誤攔良品、瑕疵流出、良品放行。同樣的四格名稱，實際損害不同。

醫療若假設一次 FP 為 1 負擔點、一次 FN 為 20 點，候選共 5×1+1×20=25 點，全判健康則為 5×20=100 點。

點數只是教學假設，不是臨床建議。

製造沿用原檔的 FP 每件 50 元、FN 每件 1000 元：A 為 1100 元，B 為 200 元；B 雖 Precision 較低，卻在此成本假設下較合適。

全判健康的醫療基準有 Accuracy=95%，Recall=0、F1=0；全判良品的製造基準有 Accuracy=80%，Recall=0、F1=0。

兩者 Precision 都因沒有正類預測而未定義。

高 Accuracy 不能證明少數類能被偵測，相同 F1 也不能代替錯誤成本。

### 兩語言逐類與 macro F1（補充）

資料為 `L23303-M4-E-multilingual-f1.json`：中文 ZH01–ZH20、英文 EN01–EN20，各 10 句正向、10 句負向。

全部是人工合成評估標籤，無訓練、無抽樣，不是翻譯配對或語言能力實驗。

兩表列均為實際、欄均為預測，次序正向、負向。

| 語言 | 實際正向：預測正／負 | 實際負向：預測正／負 |
|---|---|---|
| 中文 | 8／2 | 1／9 |
| 英文 | 6／4 | 2／8 |

每次輪一個類別當正類，用本頁計數式及 [[precision]]、[[recall]] 的公式。

以中文正向為例，TP=8、FP=1、FN=2，所以 P=8/9、R=8/10、F1=16/19。

| 語言／當正類的標籤 | Precision | Recall | F1 |
|---|---|---|---|
| 中文／正向 | 8/9≈0.889 | 8/10=0.800 | 16/19≈0.842 |
| 中文／負向 | 9/11≈0.818 | 9/10=0.900 | 18/21≈0.857 |
| 英文／正向 | 6/8=0.750 | 6/10=0.600 | 12/18≈0.667 |
| 英文／負向 | 8/12≈0.667 | 8/10=0.800 | 16/22≈0.727 |

中文 macro F1=(16/19+18/21)/2≈0.850；英文為 (12/18+16/22)/2≈0.697。

macro 是逐類 F1 的平均，不是先平均 P、R 再算 F1。

英文正向 Recall=0.6 值得追查，但兩種語言的樣本難度、領域、標註一致性與訓練覆蓋尚未控制，不能用語言名稱解釋因果。

### 同樣的 F1 下降，原因不同（補充）

以下三方案各 20 筆，真實正負各 10。基準四格為 TP=8、FP=2、FN=2、TN=8，P=R=F1=0.8。

| 方案 | TP、FP、FN、TN | P、R | F1 |
|---|---|---|---|
| 誤報增加 | 8、6、2、4 | 4/7≈0.571、0.8 | 16/24=2/3 |
| 漏報增加 | 5、0、5、10 | 1、0.5 | 10/15=2/3 |

兩者 F1 都由 0.8 降為 2/3；前者 Recall 未降、Precision 降，後者 Precision 反升、Recall 降。

F1 不能唯一還原 P／R，更不能證明語言造成錯誤。

真實評估若更換樣本或標註規則，也會改變四格；要回查同樣本與標註後才能歸因。

公式與平均規則依 scikit-learn f1_score，以上數字為本站推算的反例。

## 程式

:::supplement[來源：scikit-learn API：f1_score]
以下完整列出共同資料的標籤與分數，先把分數轉成類別再算 F1。資料與閾值固定，本例沒有隨機步驟。

```python
import numpy as np
from sklearn.metrics import f1_score, precision_score, recall_score
y = [1,1,0,1,1,1,0,1,0,1,0,0,1,0,0,0,0,0,0,0]
scores = np.array([.95,.90,.85,.80,.75,.65,.65,.50,.40,.35,
                   .30,.25,.20,.18,.15,.12,.10,.08,.05,.02])
pred = scores >= 0.5
print(f"Precision={precision_score(y, pred):.3f}")
print(f"Recall={recall_score(y, pred):.3f}")
print(f"F1={f1_score(y, pred):.3f}")
print("全負類：", f1_score([0, 0], [0, 0], zero_division=np.nan))
```
```text
Precision=0.750
Recall=0.750
F1=0.750
全負類： nan
```

:::tip[讀碼重點]
- `f1_score` 接的是預測類別，不是原始連續分數。
- `zero_division=np.nan` 需 scikit-learn 1.3 以上；它保留未定義情況，不會把「有正類卻全漏掉」的 F1=0 改成 NaN。
:::
:::

## 怎麼用、怎麼判讀

在類別不平衡、需要平衡精確率與召回率時，可以用 F1 比較模型。但仍要並列兩項原始指標，確認提高 F1 是否犧牲了重要的漏報控制。

:::supplement[來源：scikit-learn API：f1_score；scikit-learn User Guide：Tuning the decision threshold]
F1 評估一個閾值下的決策；ROC-AUC 與 PR 曲線評估多個閾值下的排序。選閾值用驗證集，選定後才評估測試集。

F1 不使用 TN，不能表達「正常交易被正確放行」的價值；它也沒有直接設定誤報與漏報的金錢成本。成本差距很大時，應搭配模型比較中的成本矩陣。
:::

### 換個場景

| 場景 | 何時適用 | 判讀重點 |
|---|---|---|
| 正負類數量懸殊，且須兼顧誤報與漏報 | 指引列出的資料條件 | 不讓多數類別的高準確率掩蓋正類表現 |
| 客服緊急案件辨識（補充） | 漏接急件與誤報都耗費資源 | F1 外仍看急件召回率 |
| 產線瑕疵攔截（補充） | 要攔瑕疵也要少報廢良品 | 用固定正類和閾值比較，另查錯誤成本 |

### 零售任務的指標導讀

沿用[多模態零售的同一案例](../multimodal-application-evaluation/#零售讓每個輸出有對應物件)：影像、銷售用來比較動線熱區與配置，先定義區域再用[IoU](../intersection-over-union/#從框座標求交集補充)。

交易、評論產生推薦清單，先定相關性與清單長度再看[Precision](../precision/#定義與公式)。

評論、社群做情感分類，固定類別與平均方式後看[F1](../f1-score/#多分類的平均方式補充)。

BI 整合影像、POS、評論，應分別驗收各項輸出。

顧客隱私、來源噪聲及處理時效也須另驗：遮蔽或噪聲可能影響區域及分類，離線分數高仍可能回應太慢。

IoU 不能評推薦命中，F1 不能取代幾何定位，Precision 也不能代表整個儀表板品質。

完整跨模態選用由責任頁承接，本頁只是指標導讀；案例索引存於 `L21104-M4-E-metric-links.json`。

## 常見誤解

:::supplement[來源：scikit-learn API：f1_score；Google Machine Learning Crash Course：Accuracy, recall, precision, and related metrics]
- **F1 是算術平均**：它是調和平均；0.9 和 0.1 的 F1 是 0.18，不是 0.5。
- **F1 高就代表所有類別都好**：二元正類 F1 看不到 TN，也可能掩蓋某些族群的錯誤。
- **F1 下降一定是召回率下降**：精確率下降也會造成相同現象，須分開查看。
- **把分數傳給 F1 就能比較排序**：先指定閾值產生類別；多閾值排序要看 AUC 類指標。
:::

## 進階

### 想偏重其中一項時（補充）

Fβ 允許調整精確率與召回率的相對重要性，F1 是 β=1 的特例。β>1 偏重召回率，β<1 偏重精確率；scikit-learn 提供 `fbeta_score` 計算。

### 多分類的平均方式（補充）

多分類先輪流把每一類當正類，再決定如何合併。以下仍用共同交易資料，把「盜刷」與「正常」各當一次正類示範平均規則。

若有六種互斥案件類別，就讓每類各做一次「一對其餘」，得到六個 F1，再依下表合併。

| 平均方式 | 怎麼合併 | 要留意什麼 |
|---|---|---|
| macro | 每類先算 F1，再等權平均 | 少數類別與多數類別同樣重要 |
| micro | 先合併各類 TP、FP、FN，再算 F1 | 樣本多的類別影響較大 |
| weighted | 每類 F1 按真實樣本數加權 | 少數類別表現差可能被掩蓋 |

$$
F_{1,\mathrm{macro}}=\frac{1}{K}\sum_{k=1}^{K}F_{1,k}
$$

$K$ 是類別數，$F_{1,k}$ 是該類 F1。盜刷為 0.75，正常為 $20/24=5/6$，macro 為 $(0.75+5/6)/2\approx0.792$。

$$
F_{1,\mathrm{micro}}=
\frac{2\sum_k\mathrm{TP}_k}{2\sum_k\mathrm{TP}_k+\sum_k\mathrm{FP}_k+\sum_k\mathrm{FN}_k}
$$

$\mathrm{TP}_k$ 等是第 $k$ 類的一對其餘計數。兩類合計 TP=16、FP=4、FN=4，因此 micro 為 $32/(32+4+4)=0.8$。

按真實類別比例加權，weighted F1 為 $0.75\times0.4+(5/6)\times0.6=0.8$。比例 0.4 與 0.6 分別來自 8 筆盜刷、12 筆正常交易。

只有在單標籤分類、納入全部類別時，micro F1 才等於準確率。多分類的 `scoring="f1"` 預設二元設定不合用，須明確選 `f1_macro`、`f1_micro` 或 `f1_weighted`。

### 參考來源

- 科目 1 學習指引，3-79：支持零售的任務／指標與限制，完整案例見[多模態應用與評估設計](../multimodal-application-evaluation/)。
- L23303-M4-E-metric-cases.json：保存既有醫療／瑕疵資料索引。
- L23303-M4-E-multilingual-f1.json：本站合成跨語言與反例計數，非外部研究成果。
- 學習指引科目 3，5-21、5-25：調和平均公式、嚴重不平衡時兼顧精確率與召回率（支持：定義與公式、換個場景）。
- [scikit-learn：f1_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html)（支持：計數公式、零分母、程式、多分類）。
- [scikit-learn：fbeta_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.fbeta_score.html)（支持：Fβ 的相對重要性與 F1 特例）。
- [Google 機器學習速成課程：分類指標](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)（支持：直覺、常見誤解）。
- [scikit-learn：調整分類閾值](https://scikit-learn.org/stable/modules/classification_threshold.html)（支持：怎麼用、怎麼判讀）。

## 小結

- F1 用調和平均兼顧精確率與召回率；共同交易資料在閾值 0.5 時為 0.75。
- 需要同一正類、資料與閾值，才可比較。
- 計數式不使用 TN，分母全為零時須報告未定義或套件慣例。（補充）
- 多分類先選平均方式，不能直接沿用預設二元設定。（補充）
