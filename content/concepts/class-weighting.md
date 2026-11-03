---
id: class-weighting
title: 類別權重
kind: technique
codes: [L23304, L23301, L23402]
aliases: [Class Weighting, 類別重加權]
requires: [class-imbalance, cross-entropy-loss]
mitigates:
  - target: class-imbalance
    note: 增加少數類損失的相對貢獻，權重過大可能過度補償
    source: [guide-3:5-49]
contrasts:
  - target: oversampling
    note: 類別權重改每筆損失貢獻，過採樣改樣本出現次數
    source: [guide-3:5-48, guide-3:5-49]
summary: 類別權重依真實類別調整損失貢獻，保留原本的樣本數
goals:
  - id: g1
    text: 計算加權損失，比較採樣並辨識過度補償
  - id: g2
    text: 用標籤乘群體交叉表，區分類別加權與群體重加權
formula_groups:
  - id: weighted-average
    source: https://numpy.org/doc/stable/reference/generated/numpy.average.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23304-D
  - id: balanced-class-weight
    source: https://scikit-learn.org/stable/modules/generated/sklearn.utils.class_weight.compute_class_weight.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-D
  - id: group-label-reweight
    source: https://github.com/Trusted-AI/AIF360/blob/main/aif360/sklearn/preprocessing/reweighing.py
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-D
guide_refs: [guide-3:5-25, guide-3:5-49, guide-3:6-30]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 訓練有114筆正常、6筆瑕疵，各筆原損失皆0.2，正常權重1、瑕疵19。哪個敘述正確？
    options:
      A: 正常貢獻22.8、瑕疵貢獻1.2，資料仍120筆
      B: 正常貢獻22.8、瑕疵貢獻22.8，資料增為228筆
      C: 正常貢獻22.8、瑕疵貢獻22.8，資料仍120筆
      D: 正常貢獻1.2、瑕疵貢獻22.8，資料仍120筆
    answer: C
    explain:
      A: 瑕疵應乘19，6乘19乘0.2等於22.8。
      B: 權重不會建立複本，原始筆數仍是120筆。
      C: 兩類加權總和相等，調整的是損失貢獻而非筆數。
      D: 正常仍有114筆，乘權重1與損失0.2得到22.8。
  - id: c2
    goal: g2
    type: choice
    prompt: 訓練A群有5筆陽性、55筆陰性，B群有1筆陽性、59筆陰性。陽性一律加權19，能否推出兩群召回率相等？
    options:
      A: 不能；權重只按標籤設定，還需分群評估漏報
      B: 能夠；陽性都乘相同權重，分群漏報率必相等
      C: 不能；權重只按群體設定，完全沒有處理標籤
      D: 能夠；陽性加權總和相等，便能推得預測相同
    answer: A
    explain:
      A: 標籤平衡沒有約束群體的預測結果，不能推出召回率相等。
      B: 相同標籤權重不能消除樣本量、特徵與模型誤差差異。
      C: 題目正是依標籤給權重，並非只按群體設定。
      D: A陽性總權重95、B只有19，且總權重也不決定預測結果。
  - id: c3
    goal: g1
    type: choice
    prompt: 正常114筆、瑕疵6筆，先把瑕疵複製到114筆，又套原權重正常1、瑕疵19。各筆原損失皆0.2，何者正確？
    options:
      A: 正常22.8、瑕疵22.8，兩次調整仍維持相等貢獻
      B: 正常433.2、瑕疵22.8，應檢查正常類的過度補償
      C: 正常1.2、瑕疵433.2，原本正常筆數已減少十九倍
      D: 正常22.8、瑕疵433.2，應檢查瑕疵類的過度補償
    answer: D
    explain:
      A: 複製已使兩類各114筆，再乘19會讓瑕疵總貢獻大十九倍。
      B: 權重19給瑕疵，正常的貢獻仍為114乘0.2。
      C: 過採樣沒有刪除正常品，其筆數仍是114。
      D: 瑕疵為114乘19乘0.2等於433.2，兩種平衡手段疊加可能過度補償。
---

## 為什麼需要

少數類資料有限，又不方便刪除或合成個案時，可以改變每筆損失的重要程度。類別權重（Class Weighting）讓指定類別對訓練目標有較大貢獻，樣本數維持不變。

指引5-49提醒權重太小可能無效，太大可能過度補償。權重是需要驗證的設定，並不保證少數類辨識一定改善。

## 直覺

沿用同一批製造與醫療資料，各200筆、10筆正類。訓練是114筆負類與6筆正類；負類每筆權重1、正類每筆19，正類仍只有6筆。

先假設每筆原損失都相同，才能單獨看「數量乘權重」的作用。下圖以每筆0.2示範；真實預測的逐筆損失通常不同。

![先比較相同原損失下的類別總貢獻：只加權可平衡，複製後又乘原權重則會大幅偏向正類。](figure:l23304-class-weighting-contribution)

## 定義與公式

本頁加權損失的手算與程式採二元交叉熵；類別權重也可搭配其他基礎損失，請依實際模型確認。

類別權重依真實標籤選擇一個係數，再乘進樣本損失。與過採樣相比，它不建立複本，也不移除多數類資料。

### 加權平均與分母（補充）

本頁採用「除以權重總和」的加權平均：

$$
L_w=\frac{\sum_{i=1}^{N}w_{y_i}\ell_i}{\sum_{i=1}^{N}w_{y_i}},\qquad
\ell_i=-y_i\ln p_i-(1-y_i)\ln(1-p_i)
$$

$N$是訓練筆數，$y_i$是0或1標籤，$p_i$是正類機率，$w_{y_i}$是該類非負權重，$\ell_i$是單筆交叉熵。

這個直接取對數的手算式與下方NumPy程式限制$0<p_i<1$，權重總和須大於0，$\ln$為自然對數。機率端點應另以裁切或穩定的logits交叉熵處理。

權重1、19時，分母是114＋6×19＝228。某些API改除以筆數，或只對正類項加權；比較數值前要先確認分母與權重語意。

### 頻率反比的起點（補充）

scikit-learn的`balanced`採：

$$
w_c=\frac{N}{C\,n_c}
$$

$C$為類別數、$n_c$為該類訓練筆數，該類須有樣本。本例$N=120,C=2$，正常權重$120/228\approx0.526316$、瑕疵10，相對比為1比19。

兩組權重在本頁的加權平均下相同；模型若另有正則化或不同縮放規則，不可只憑比值推定訓練完全等價。頻率只從當輪訓練資料估計。

## 算一次（補充）

### 逐筆算，再加總（補充）

共用固定分數不來自模型擬合。四種樣本已列完120筆，可先算每種單筆損失，再乘出現次數。

| 訓練樣本型態 | 筆數與正類機率 | 原單筆損失 | 加權單筆損失 |
|---|---|---|---|
| 常見正常 | 108筆，0.1 | 0.105361 | 0.105361 |
| 難分正常 | 6筆，0.8 | 1.609438 | 1.609438 |
| 易分瑕疵 | 4筆，0.9 | 0.105361 | 2.001850 |
| 難分瑕疵 | 2筆，0.2 | 1.609438 | 30.579320 |

資料檔`L23304-D-imbalance.json`第1筆F001是易分瑕疵，$y=1,p=0.9$。原損失$-\ln0.9$乘19得2.001850。

第2筆F002是難分正常，$y=0,p=0.8$。應取$-\ln0.2=1.609438$，乘1不變。

全部加權總和為90.201603，除以228得0.395621。未加權平均為0.205632；兩個目標的權重不同，不能用前者較大就判定模型變差。

### 過度補償的反例（補充）

若先複製成兩類各114筆，又套原先1比19，當每筆原損失皆為0.2，正常總貢獻22.8、瑕疵433.2。平衡措施疊加後，瑕疵貢獻反而是正常的19倍。

也可能只把原始6筆瑕疵的權重調成361，得到同樣的相對偏重。這不代表任何疊加都錯；它說明需重新驗證誤報與漏報，不能自動沿用原權重。

## 程式（補充）

依共用資料重建120筆固定標籤與分數；本段所有機率嚴格介於0與1之間，用未提前四捨五入的損失加總。

```python
import numpy as np
from sklearn.utils.class_weight import compute_class_weight
idx = np.arange(120)
y = (idx % 20 == 0).astype(int)
p = np.where(y == 1, .9, .1)
p[[80, 100]] = .2
p[[1, 2, 3, 4, 5, 6]] = .8
loss = -(y * np.log(p) + (1-y) * np.log1p(-p))
w = np.where(y == 1, 19., 1.)
cw = compute_class_weight(class_weight="balanced", classes=np.array([0, 1]), y=y)
print("類別權重", np.round(cw, 6).tolist())
print(f"未加權 {loss.mean():.6f}")
print(f"加權總和 {np.dot(w, loss):.6f} 分母 {w.sum():.0f}")
print(f"加權平均 {np.average(loss, weights=w):.6f}")
```
```text
類別權重 [0.526316, 10.0]
未加權 0.205632
加權總和 90.201603 分母 228
加權平均 0.395621
```

:::tip[讀碼重點]
`compute_class_weight`只接訓練標籤。`np.average`除以權重總和；若改成`(w * loss).mean()`，分母會變成120，數值就不同。
:::

## 怎麼用、怎麼判讀

指引列出的條件包括資料有限、難以生成新樣本；5-25另列邏輯迴歸、樹模型與神經網路。先確認模型支援權重，再比較同一驗證分布下的誤報與漏報。

### 類別與群體要分開

指引6-30把類別重加權與少數群體的辨識連在一起。它能作為改善方向，但「正類少」與「某群體少」是不同維度，還要看兩者的交叉分布。

:::supplement[來源：AIF360 Reweighing API與官方原始碼]
醫療訓練資料的A、B為教學合成群體；同組製造資料則對應兩條產線。這裡先看訓練代表性，不把樣本平衡直接當作群體公平。

| 群體 | 陰性 | 陽性 | 陽性乘19後總權重 |
|---|---|---|---|
| A | 55 | 5 | 95 |
| B | 59 | 1 | 19 |

類別權重只按標籤，兩群陽性仍是5比1。群體與標籤聯合重加權則可用：

$$
w_{g,c}=\frac{n_g\,n_c}{N\,n_{g,c}}
$$

$n_g$是群體筆數，$n_c$是類別筆數，$n_{g,c}$是交叉格筆數，$N$是總數；四格須非空。本例每群60筆，陽性6筆、陰性114筆。

因此A陽性權重0.6、B陽性3，兩格加權總和各3；A陰性為57/55、B陰性57/59，兩格各57。這是讓加權訓練分布的群體與標籤獨立，並非把標籤變成各半。

同一固定分數、閾值0.5下，A陽性抓到4/5，B抓到0/1，召回率為0.8與0。即使設定了權重，這種預測仍可能發生；兩種重加權都不保證群體指標相等。
:::

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 少數類分類 | 資料少或難生成 | 保留樣本，以權重調整代價 |
| 群體辨識改善 | 群體與標籤分布不均 | 分開看交叉表與群體指標 |
| 製造瑕疵（補充） | 兩產線瑕疵率不同 | 相同標籤權重不代表兩線表現相同 |
| 醫療篩檢（補充） | 陽性少、漏診成本高 | 類別頻率與臨床成本分別確認 |

## 常見誤解

- 「權重19就真的多18筆」：樣本數不變，改變的是對損失的貢獻。
- 「權重越大越好」：過大的少數類權重可能帶來過度補償。
- 「按標籤平衡就解決群體公平」：群體與標籤不同，還須交叉檢查預測。（補充）

## 進階

### 參考來源

- 科目3學習指引（版本未標示）`guide-3:5-25`、`guide-3:5-49`、`guide-3:6-30`：支持類別權重用途、適用條件、過度補償與群體辨識的導讀。
- [scikit-learn log_loss](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.log_loss.html)：支持二元交叉熵及機率裁切；公式與逐筆計算為補充。
- [NumPy average](https://numpy.org/doc/stable/reference/generated/numpy.average.html)：直接支持加權平均除以權重總和，對應本頁公式與程式的分母。
- [scikit-learn compute_class_weight](https://scikit-learn.org/stable/modules/generated/sklearn.utils.class_weight.compute_class_weight.html)：支持頻率反比公式與API。
- [AIF360 Reweighing](https://aif360.readthedocs.io/en/stable/modules/generated/aif360.sklearn.preprocessing.Reweighing.html)與[官方原始碼](https://github.com/Trusted-AI/AIF360/blob/main/aif360/sklearn/preprocessing/reweighing.py)：支持群體乘標籤交叉格重加權公式及與類別加權的區分。
- [TensorFlow 不平衡分類教學](https://www.tensorflow.org/tutorials/structured_data/imbalanced_data)：參考加權與過採樣共用評估基準的教法，支持驗證與誤報漏報比較。

## 小結

- 類別權重保留樣本數，改變各類損失的相對貢獻。
- 本例正常1、正類19，先由訓練頻率得到比較起點。（補充）
- 核對分母，避免重採樣後又沿用原權重而過度補償。（補充）
- 類別與群體權重的目標不同，群體結果仍須另外驗證。（補充）
