---
id: cost-sensitive-loss
title: 損失設計與錯誤成本
kind: technique
codes: [L23103]
aliases: [Cost-sensitive Learning, 加權損失]
summary: 把不同錯誤的代價寫進損失，讓訓練方向對齊任務風險
goals:
  - id: g1
    text: 依漏報與誤報成本選擇加權方向，區分訓練損失與決策閾值
requires: [confusion-matrix]
guide_refs: [guide-3:3-21, guide-3:3-22]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: weighted-bce
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: decision-cost
    source: https://ubc-stat.github.io/stat-406/schedule/lectures/lecture_03_learning_procedure_classification.html#how-prediction-loss-affect-decisions
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某篩檢任務把漏報成本訂為 8、誤報成本訂為 1，正類表示需要追蹤。要讓模型更重視漏報，哪個訓練方向合理？
    options:
      A: "漏報代價是誤報的8倍，應將正類損失權重降為原來的八分之一以補償差異"
      B: 提高正類損失的相對權重，再用驗證資料檢查實際成本
      C: "正類表示需要追蹤，應只把正常樣本的損失權重提高8倍以減少漏報"
      D: "維持原訓練，只把準確率乘以8來反映錯誤成本"
    answer: B
    explain:
      A: "降低正類相對權重會減輕正類錯誤的懲罰，與提高漏報重視程度的方向相反。"
      B: 正類預測機率過低時會受到較重懲罰，但結果仍須驗證。
      C: "正常樣本是負類，只加重負類損失較偏向減少誤報，不能作為提高漏報懲罰的做法。"
      D: "整體準確率乘常數沒有區分漏報與誤報，也不會改變原訓練的模型參數。"
  - id: c2
    goal: g1
    type: choice
    prompt: 六筆固定機率在閾值 0.5 時有 1 次漏報、1 次誤報；降到 0.2 後有 0 次漏報、2 次誤報。漏報成本 5、誤報成本 1，哪個判斷正確？
    options:
      A: 兩種閾值的成本都是 2，因為各有兩筆錯誤
      B: 降閾值後必定已重新訓練模型
      C: 成本由 6 降為 2，這個比較只改決策規則
      D: 閾值下降一定使所有資料的交叉熵下降
    answer: C
    explain:
      A: 錯誤筆數相同，但漏報與誤報的單次成本不同。
      B: 固定機率也能改閾值，模型參數不必改動。
      C: 原成本為 5 加 1，新成本為 2 乘 1，沒有更動預測機率。
      D: 交叉熵用機率與標籤計算，固定機率下不受決策閾值影響。
---

## 為什麼需要

模型錯兩筆，可能是漏掉兩位需要追蹤的人，也可能是多請兩位正常者檢查。只數錯幾筆，無法表達兩種後果的差別。

指引把損失函數視為風險偏好的數值表達。假陰性（漏報）與假陽性（誤報）可以有不同權重，訓練便會朝不同方向調整。

## 直覺

先定義正類，再談哪種錯誤更貴。不同的風險偏好，會讓同樣的錯誤筆數代表不同後果。

:::supplement[來源：scikit-learn 成本敏感範例；決策閾值指引]
以下是教學假設，成本點只用來比較方案，不代表實際醫療或金融政策。

| 任務與正類 | 漏報成本 | 誤報成本 | 優先方向 |
|---|---|---|---|
| 醫療：需追蹤者 | 5 | 1 | 減少漏掉需追蹤者 |
| 金融：疑似詐騙 | 2 | 4 | 降低錯攔正常交易 |

成本敏感學習（Cost-sensitive Learning）把這種差別帶入訓練。另一個可調位置是決策閾值：相同機率，仍能採取不同的行動。
:::

## 定義與公式（補充）

### 加權目標（補充）

用加權二元交叉熵作例子：

$$
J=-\frac1n\sum_{i=1}^{n}\left[w_1y_i\ln p_i+w_0(1-y_i)\ln(1-p_i)\right]
$$

$n$ 是樣本數；$y_i$ 是 0 或 1 的真實標籤，$p_i$ 是預測正類機率。$w_1,w_0>0$ 分別加權正、負類，$\ln$ 是自然對數。

漏報較貴時，可提高 $w_1/w_0$，讓正類的低機率受到較重懲罰。誤報較貴時則朝相反方向調整；這是訓練偏好，不能保證每次錯誤都減少。

本頁平均分母固定為 $n$。有些函式用權重總和正規化，數值尺度會不同；比較損失前必須先對齊定義。

### 決策成本（補充）

固定閾值後，觀察到的總成本為：

$$
C=C_{\rm FN}\,\mathrm{FN}+C_{\rm FP}\,\mathrm{FP}
$$

$\mathrm{FN},\mathrm{FP}$ 是混淆矩陣中的漏報、誤報次數，$C_{\rm FN},C_{\rm FP}$ 是單次成本。此式假設判對的成本為 0，和連續的訓練損失不同。

以下把 UBC 決策理論課程的固定錯誤成本，推廣為本頁的兩種正成本。

若 $p$ 是校準後的真實正類機率，判正的期望成本為 $C_{\rm FP}(1-p)$，判負則為 $C_{\rm FN}p$。比較兩者，可得：

$$
\text{判正若}\quad p\geq\frac{C_{\rm FP}}{C_{\rm FN}+C_{\rm FP}}
$$

兩個成本皆正，且不計容量限制時才採此簡化規則。加權訓練的原始輸出未必仍是校準機率，不能直接把權重當成此閾值。

## 算一次（補充）

共用資料 `L23103-B-losses.json` 的醫療標籤是 `[1,0,1,0,1,0]`，機率為 `[0.9,0.8,0.2,0.3,0.7,0.1]`。所有比較保留相同六筆索引。

M03 是正類、$p=0.2$，未加權損失為 1.609438，正類權重設為 5 後變成 8.047190。M02 是負類、$p=0.8$，負類權重為 1，損失仍是 1.609438。

將六筆相加再除以 6，未加權平均為 0.690491，加權平均為 2.071473。這是同一組固定預測的重新計分，不表示模型已經改善。

這組資料的正、負類未加權損失總和恰好相等。加權平均因此碰巧等於正類損失總和，換一組機率就不一定成立。

| 閾值，含等號判正 | 漏報 | 誤報 | 醫療成本 |
|---|---|---|---|
| 0.5 | 1 | 1 | $5+1=6$ |
| 0.2 | 0 | 2 | $0+2=2$ |

校準機率的簡化成本閾值是 $1/(5+1)=1/6$，此資料下與 0.2 產生相同分類。金融成本換成漏報 2、誤報 4 時，閾值升到 $4/(2+4)=2/3$，需要更高的機率才判正。

## 程式（補充）

```python
import torch
# 固定種子沿用本組約定；本段無隨機運算，結果不受種子影響。
torch.manual_seed(23103)
y = torch.tensor([1., 0., 1., 0., 1., 0.], dtype=torch.float64)
p = torch.tensor([.9, .8, .2, .3, .7, .1], dtype=torch.float64)
z = torch.logit(p)
base = torch.nn.functional.binary_cross_entropy_with_logits(z, y)
weighted = torch.nn.functional.binary_cross_entropy_with_logits(
    z, y, pos_weight=torch.tensor(5., dtype=torch.float64))
print(f"未加權 {base.item():.6f} 加權 {weighted.item():.6f}")
for threshold in [.5, .2]:
    pred = p >= threshold
    fn = int(((y == 1) & ~pred).sum())
    fp = int(((y == 0) & pred).sum())
    print(threshold, fn, fp, 5 * fn + fp)
```
```text
未加權 0.690491 加權 2.071473
0.5 1 1 6
0.2 0 2 2
```

:::tip[讀碼重點]
`pos_weight=5` 只加重正類項；`p >= threshold` 則只改固定預測的決策。兩者分別作用在訓練目標與行動規則。
:::

## 怎麼用、怎麼判讀

指引提醒，損失會決定哪些誤差被放大、哪些可容忍。先把正類與錯誤後果寫清楚，才能選擇權重方向。

:::supplement[來源：scikit-learn 決策閾值指引；Keras 不平衡分類教學]
保留驗證資料，比較成本、漏報與誤報，並檢查機率校準。成本加權與依類別數量加權的目的不同；少數類不一定是成本最高的類別。
:::

### 換個場景

| 場景 | 先確認 | 判讀重點 |
|---|---|---|
| 不同錯誤型態的風險取捨 | 假陽性、假陰性代價不同 | 決定相對權重 |
| 醫療追蹤（補充） | 漏掉需追蹤者的後果 | 可容忍的誤報與追蹤容量 |
| 金融攔阻（補充） | 正常交易被攔的損失 | 不應只追求抓到更多疑案 |
| 製造報廢（補充） | 退貨與錯殺良品的成本 | 用成本而非件數選方案 |

## 常見誤解

- 準確率相同，不代表風險相同；要看錯在什麼類型。
- 調權重會影響學習目標，調閾值則可在固定機率上進行。（補充）
- 把正類權重提高五倍，不等於模型輸出仍可直接當原始風險機率。（補充）

## 進階

### 參考來源

- 科目 3 學習指引（版本未標示；本機快照）`guide-3:3-21`、`guide-3:3-22`：支持風險偏好與假陽性、假陰性權重方向；未提供醫療金融成本表。
- [PyTorch BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.BCEWithLogitsLoss.html)：支持加權目標與 `pos_weight` 程式。
- [scikit-learn 決策閾值](https://scikit-learn.org/stable/modules/classification_threshold.html)：支持分開預測與行動、驗證閾值；期望成本閾值由本頁假設推算。
- [scikit-learn 成本敏感範例](https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html)：支持以混淆矩陣的次數乘單次成本，再加總為決策成本；本頁取成本為正的約定。
- [UBC Stat406 決策理論](https://ubc-stat.github.io/stat-406/schedule/lectures/lecture_03_learning_procedure_classification.html#how-prediction-loss-affect-decisions)：支持兩個行動的條件期望損失比較；本頁將其固定成本例推廣為任意正成本，得到簡化成本閾值。
- [Google 分類閾值課程](https://developers.google.com/machine-learning/crash-course/classification/thresholding)：參考固定機率改閾值的教法。
- [Keras 不平衡分類教學](https://keras.io/examples/structured_data/imbalanced_classification/)：參考類別權重與多種指標並看，並非本頁成本數值來源。

## 小結

- 正類定義、錯誤成本與損失權重要一起看。
- 權重改變訓練偏好；較貴的錯誤應獲得較多關注。
- 固定機率改閾值後，成本可能改變，交叉熵不會跟著變。（補充）
