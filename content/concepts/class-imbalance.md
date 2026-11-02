---
id: class-imbalance
title: 類別不平衡
aliases: [Class Imbalance, 不平衡資料, Imbalanced Data, 資料不平衡]
kind: problem
codes: [L23301, L23303, L23304]
guide_refs: [guide-3:5-10, guide-3:5-25, guide-3:5-48, guide-3:5-49]
gaps:
  - ref: guide-3:5-25
    level: covered
    ability: 指引已說明 Accuracy 會誤導，以及類別權重、SMOTE、異常偵測三種做法
  - ref: guide-3:5-48
    level: missing
    ability: 指引沒有提到重採樣只能對訓練資料做、測試集要維持原始比例；先重採樣再切分會造成資料洩漏
author: codex
status: draft
textbook: v2
summary: 類別不平衡會讓多數類別掩蓋少數類別的訓練與評估問題
goals:
  - id: g1
    text: 用少數類別指標評估，並說明類別權重如何改變訓練損失
  - id: g2
    text: 走完一次 SMOTE 鄰居插值，安排只在訓練摺內重採樣
  - id: g3
    text: 區分 Isolation Forest 與 One-Class SVM 的思路、資料條件及限制
formula_groups:
  - id: weighted-loss
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.log_loss.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: smote-interpolation
    source: https://imbalanced-learn.org/stable/over_sampling.html
    status: verified
    checked_by: ctx_ce650b18e31c
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 篩檢有 100 位受檢者、5 位患病，全部預測健康得到準確率 95%。接著最應查看什麼？
    options:
      A: 患病類別的召回率，這個全判健康模型為 0
      B: 只要 95% 就可判斷篩檢有效
      C: 增加健康樣本，讓準確率更接近 100%
      D: 把測試集複製成正負各半，消除原有比例
    answer: A
    explain:
      A: 5 位患者全被漏掉，召回率為 0/5，可揭露高準確率的問題。
      B: 高準確率可能只反映健康者很多，沒有證明能找出疾病。
      C: 增加多數類別只會讓總體準確率更掩蓋漏診。
      D: 評估集應代表使用情境，改成各半會扭曲精確率等指標。
  - id: c2
    goal: g2
    type: choice
    prompt: 已切出訓練與驗證摺，訓練摺少數類別鄰居是 (2,4)、(4,6)。取插值比例 0.25，哪個做法正確？
    options:
      A: 合成 (3,5)，並同步加入驗證摺
      B: 用驗證摺鄰居決定方向，合成點僅放訓練摺
      C: 合成 (2.5,4.5)，只加入訓練摺
      D: 合成 (6,10)，因為 SMOTE 要把兩點相加
    answer: C
    explain:
      A: (3,5) 是比例 0.5 的中點，且合成點不應加入驗證摺。
      B: 即使點只放訓練摺，用驗證資料挑鄰居仍造成資料洩漏。
      C: 由起點加上四分之一的差向量，得到 (2.5,4.5)，並留在訓練摺。
      D: SMOTE 在鄰居間插值，並非直接把座標相加。
  - id: c3
    goal: g3
    type: choice
    prompt: 工廠只有大量正常設備資料，想學出正常範圍後辨識未見故障。哪個描述正確？
    options:
      A: "One-Class SVM 需正常、故障各半，才可學出正常邊界"
      B: "Isolation Forest 以正常類別機率當作異常分數，機率越高就越應判為故障"
      C: "One-Class SVM 可只學正常資料；凡是訓練未見的故障，預測時都會落在邊界外"
      D: "One-Class SVM 可學正常邊界；故障若落在邊界內仍可能漏掉"
    answer: D
    explain:
      A: "單類新穎性偵測可用正常資料建立邊界，不以先蒐集正負各半資料為必要條件。"
      B: "Isolation Forest 以隨機切分下的隔離難易度辨識異常，不以正常類別機率為核心。"
      C: "只用正常資料訓練可行，但故障可能在特徵空間與正常資料重疊，未見不等於必在邊界外。"
      D: "正常資料可用來學正常範圍；資料表示與邊界仍可能讓某些故障落在範圍內，形成漏報。"
  - id: c4
    goal: g1
    type: choice
    prompt: 訓練資料有 5 位患者、95 位健康者，各筆未加權損失皆為 0.2。患者權重設 19、健康者設 1，哪項正確？
    options:
      A: "患者因權重 19，原始筆數實際增至 95 筆"
      B: "兩類加權損失總和各為 19，評估集仍保留原始比例"
      C: "兩類加權損失總和各為 19，因此患者召回率必達 100%"
      D: "兩類加權損失相等，評估集也應複製患者至 95 筆，才與訓練目標一致"
    answer: B
    explain:
      A: "權重改變各筆損失的貢獻，不會把原來的 5 筆患者真的增加成 95 筆。"
      B: "患者為 5×19×0.2=19，健康者為 95×1×0.2=19；評估集仍應反映原始使用情境。"
      C: "加權損失貢獻相等只改變學習取捨，不能保證患者全部被辨識。"
      D: "訓練加權不要求評估集也重抽樣；複製患者會改變評估比例，扭曲精確率等指標。"
---

## 為什麼需要

醫療篩檢中，健康者通常比患者多。如果模型偏向健康者，整體準確率可能很高，卻沒有找出真正需要後續處理的人。

類別不平衡（Class Imbalance）指類別樣本數明顯懸殊。它同時影響模型學習及成績判讀，不能只把資料補成各半，就認為問題解決。

## 直覺

本頁用獨立的醫療教學模擬資料：100 位受檢者中，5 位患病、95 位健康。患病固定是正類，不代表真實疾病盛行率。

若全部判健康，準確率仍有 95%，但五位患者全漏掉。換成會抓到患者的模型，可能多一些複檢，也可能稍降準確率；這不表示它比較沒有用。

## 定義與公式

### 類別權重改的是訓練

類別權重（Class Weights）讓少數類別的錯誤在損失函數中更有影響。重採樣改變訓練資料的組成；權重則保留原始資料列，調整各筆損失的份量。

### 加權損失的算例（補充）

$$
L_w=\frac{\sum_{i=1}^{n}w_{y_i}\ell_i}{\sum_{i=1}^{n}w_{y_i}}
$$

$n$ 是訓練筆數，$y_i$ 是標籤，$w_{y_i}$ 是該類權重，$\ell_i$ 是單筆損失。本頁以權重總和正規化；不同框架的 reduction 約定應另外確認。

另假設一份獨立訓練資料也有 5 位患者、95 位健康者，每筆損失暫定相同為 0.2。未加權時，兩類的損失總和分別為 1 與 19，患者只占 5%。

把患者權重設為 19、健康者設為 1，兩類的加權損失總和各為 19。代入得到 $L_w=(19+19)/(5\times19+95\times1)=0.2$，患者的貢獻提升為 50%。

這不是模型成績提升的證據，而是「訓練時更重視患者」的示範。權重及類別頻率只依訓練資料設定，再用驗證集選擇合適取捨。

## 走一次流程

### 先診斷，再選處理層次

先列各類數量及混淆矩陣，除了準確率，也看患者的召回率與精確率。當少數類別資料不足時，可以考慮過採樣；資料極端懸殊時，也可評估異常偵測。

| 方法 | 動哪裡 | 主要代價 |
|---|---|---|
| 複製式過採樣 | 增加少數類別的重複樣本 | 可能過擬合，沒有增加獨立資訊 |
| SMOTE | 在少數類別鄰居間合成樣本 | 合成點不一定合理 |
| 欠採樣 | 減少多數類別的樣本 | 可能丟掉有用資訊 |
| 類別權重 | 調整各類損失的影響 | 過大可能過度補償、增加誤報；過小可能無法改善不平衡 |

SMOTE（Synthetic Minority Over-sampling Technique）以少數類別合成樣本，避免只是反覆複製同一點。

:::supplement[來源：imbalanced-learn User Guide：Over-sampling]
合成樣本不能保證保留所有真實結構，也不能保證避免過擬合，仍須驗證其效果。
:::

### SMOTE 的一小步（補充）

$$
\boldsymbol{x}_{\mathrm{new}}=
\boldsymbol{x}+\lambda(\boldsymbol{x}_{\mathrm{neighbor}}-\boldsymbol{x}),
\quad 0\le\lambda\le1
$$

$\boldsymbol{x}$ 是起點，$\boldsymbol{x}_{\mathrm{neighbor}}$ 是同類近鄰，$\lambda$ 是沿線比例。

實作時，每個合成點各自隨機抽取 λ，不把它當固定的調校參數。本例固定為 0.25，是為了手算。

本例假設兩項特徵事先已標準化，避免單位較大的特徵主導距離。SMOTE 依輸入特徵計算距離，本身不會自動標準化。

取 $\boldsymbol{x}=(2,4)$、鄰居 $(4,6)$、$\lambda=0.25$，合成點為 $(2,4)+0.25(2,2)=(2.5,4.5)$，位於兩點之間。

![合成點在兩個少數類別訓練點的連線上四分之一處，沒有使用驗證資料](figure:l23303-class-imbalance-smote-step)

圖是插值機制的教學示意，不代表這個合成患者在醫學上合理。邊界重疊、離群值及特徵型態都可能使合成結果失真。

### 先切分，再處理（補充）

1. 先保留最終測試集，再於開發資料做交叉驗證。
2. 每一摺只用訓練部分挑鄰居、合成樣本及估類別權重。
3. 驗證摺維持原始比例，用來比較方案及選閾值。
4. 選定方案後重新訓練，最終測試集只作最後評估。

先對整份資料做 SMOTE 才切分，可能讓驗證點參與訓練合成，造成資料洩漏。把驗證集也補成各半，還會改變精確率所代表的真實警報品質。

### 極端不平衡時考慮異常偵測

若故障很少、正常行為相對集中，可把稀有事件當異常來辨識。這是換一種建模角度，不是把每個少數類別都預設成離群值。

:::supplement[來源：scikit-learn User Guide：Novelty and Outlier Detection]
| 方法 | 核心思路 | 訓練資料與限制 |
|---|---|---|
| Isolation Forest | 隨機切特徵與切點；容易用少量切分隔離的點較可疑 | 可用以正常為主、含少量異常的資料；群聚異常未必容易隔離 |
| One-Class SVM | 學出正常樣本占據的邊界，辨識落在邊界外的新點 | 新穎性偵測通常用正常資料擬合；對尺度與污染敏感 |

例如只有正常機台紀錄時，可試 One-Class SVM；資料混有少量未知異常時，可評估 Isolation Forest。若故障與正常在特徵上完全重疊，兩者都可能漏掉。
:::

## 程式

:::supplement[來源：imbalanced-learn User Guide：Over-sampling；scikit-learn API：log_loss]
以下只重現加權算例與一次指定比例的插值，沒有訓練分類器，也不是完整的 SMOTE 實作。所有數字對應本頁專用 JSON，沒有隨機步驟。

```python
import numpy as np
n_pos, n_neg, loss = 5, 95, 0.2
w_pos, w_neg = 19, 1
pos = n_pos * w_pos * loss
neg = n_neg * w_neg * loss
print(f"未加權患者貢獻={n_pos/(n_pos+n_neg):.0%}")
print(f"加權患者貢獻={pos/(pos+neg):.0%}")
print(f"加權平均損失={(pos+neg)/(n_pos*w_pos+n_neg*w_neg):.2f}")
x, neighbor = np.array([2., 4.]), np.array([4., 6.])
new = x + 0.25 * (neighbor - x)
print("合成點：", new.tolist())
```
```text
未加權患者貢獻=5%
加權患者貢獻=50%
加權平均損失=0.20
合成點： [2.5, 4.5]
```
:::

### 自動計算類別權重（補充）

scikit-learn 的 `class_weight="balanced"` 依訓練類別頻率設權重。本例正類為 10、負類約 0.52632，比值仍為 19，與手設 19 比 1 只有整體尺度不同。

不同估計器的權重正規化及正則化約定仍須分開確認，不能據此保證兩種設定訓練出的模型完全相同。

```python
from sklearn.utils.class_weight import compute_class_weight
train_y = np.array([0] * 95 + [1] * 5)
weights = compute_class_weight("balanced", classes=np.array([0, 1]), y=train_y)
print(f"負類權重={weights[0]:.5f}")
print(f"正類權重={weights[1]:.5f}")
print(f"正負權重比={weights[1] / weights[0]:.1f}")
```
```text
負類權重=0.52632
正類權重=10.00000
正負權重比=19.0
```

## 怎麼用、怎麼判讀

比較醫療模擬資料的兩個方案。候選模型以分數大於或等於 0.5 判患者；全部判健康則是固定基準，不需模型分數。

| 觀察項目 | 全判健康 | 候選模型 |
|---|---:|---:|
| TP、FP | 0、0 | 4、5 |
| FN、TN | 5、95 | 1、90 |
| 準確率 | 95/100=95% | 94/100=94% |
| 召回率 | 0/5=0% | 4/5=80% |
| 精確率 | 無警報，未定義 | 4/9≈44.4% |

候選模型少漏四位患者，但要複查五位健康者。選哪個方案取決於漏診風險與複檢量，不能只因準確率下降一個百分點就否定它。

### 閾值是決策層的調整（補充）

調低閾值可增加召回率，但可能多出誤報；它不會新增訓練資料。先固定模型，在驗證集依風險及容量選閾值，再保留測試集作最後檢驗。

F1 分數或 PR 曲線能補充正類表現，但換指標本身不會修好模型。訓練使用類別權重，也不等於評估時可以省略原始四格。

### 換個場景

| 場景 | 資料條件 | 評估與處理重點 |
|---|---|---|
| 醫療診斷 | 患者遠少於健康者 | 看漏診與複檢負擔，不能只報準確率 |
| 欺詐偵測 | 少數類別資料不足 | 評估加權與過採樣，觀察精確率和召回率 |
| 設備故障預測 | 極端不平衡、正常資料較多 | 評估異常建模是否符合特徵分布 |
| 客服緊急案件（補充） | 急件罕見、人工處理量有限 | 以急件召回率及警報量評估閾值 |
| 內容違規偵測（補充） | 違規類別少且標籤可能有雜訊 | 檢查錯標，避免過採樣反覆放大雜訊 |

## 常見誤解

:::supplement[來源：imbalanced-learn User Guide：Common pitfalls；scikit-learn User Guide：Novelty and Outlier Detection]
- **必須把兩類補成各半**：平衡比例是候選設定，應由驗證結果決定，不是固定目標。
- **SMOTE 保證保留真實分布**：它只在近鄰間插值，可能跨越不合理區域。
- **異常偵測都只能用純正常資料訓練**：不同方法的資料條件不同，Isolation Forest 可容許少量污染。
- **少數類別就是異常點**：少數類別可能與多數類別重疊，必須先檢查特徵是否有辨識力。
:::

## 進階

### 指引表述需校正

指引 5-25 對 SMOTE 的結構保留效果說得過強；也把兩種異常模型概括成僅學正常資料。應保留處理方向，並依前述限制判斷是否適用。

### 參考來源

- 學習指引科目 3，5-10、5-25、5-48～5-49（支持：不平衡、權重、重採樣與指引場景）。
- [Google 機器學習速成課程：類別不平衡](https://developers.google.com/machine-learning/crash-course/overfitting/imbalanced-datasets)（支持：為什麼需要、訓練與評估的區別）。
- [scikit-learn：log_loss](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.log_loss.html)（支持：樣本加權與正規化損失算例）。
- [scikit-learn：compute_class_weight](https://scikit-learn.org/stable/modules/generated/sklearn.utils.class_weight.compute_class_weight.html)（支持：自動平衡權重的頻率規則與實測算例）。
- [imbalanced-learn：過採樣](https://imbalanced-learn.org/stable/over_sampling.html)（支持：SMOTE 插值公式、程式與合成點限制）。
- [imbalanced-learn：常見陷阱](https://imbalanced-learn.org/stable/common_pitfalls.html)（支持：先切分再重採樣、保留評估比例）。
- [scikit-learn：新穎性與離群偵測](https://scikit-learn.org/stable/modules/outlier_detection.html)（支持：兩種異常模型的機制與資料條件）。
- [scikit-learn：調整分類閾值](https://scikit-learn.org/stable/modules/classification_threshold.html)（支持：閾值的決策層調整）。

## 小結

- 類別不平衡會讓高準確率掩蓋少數類別漏報，要搭配精確率、召回率與四格。
- 類別權重調損失，重採樣調資料；兩者都需要保留資料上的評估。
- SMOTE 只在訓練摺找鄰居，不能先看驗證資料。（補充）
- 異常模型的資料條件不同，少數類別也不一定是離群值。（補充）
