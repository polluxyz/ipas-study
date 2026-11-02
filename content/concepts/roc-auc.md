---
id: roc-auc
title: ROC 曲線與 AUC
aliases: [ROC, AUC, ROC-AUC, ROC 曲線, AUROC]
kind: metric
codes: [L23303]
requires: [confusion-matrix]
guide_refs: [guide-3:5-22, guide-3:4-27, guide-3:5-25, guide-3:5-21]
gaps:
  - ref: guide-3:5-22
    level: shallow
    ability: 指引只寫兩軸名稱與「AUC 越接近 1 越好」；考題要判斷 ROC 的座標意義、為什麼無法由單一混淆矩陣算出，以及 AUC 高不等於線上成效好
author: claude
status: draft
textbook: v2
summary: ROC 曲線把每個閾值下的真正率與假正率連成線，AUC 是這條線下的面積
goals:
  - id: g1
    text: 算得出指定閾值下的 TPR 與 FPR，並在 ROC 座標上標出該點
  - id: g2
    text: 把一批分數掃過所有閾值畫出 ROC、算出 AUC，並處理同分
  - id: g3
    text: 比較 AUC、固定閾值指標與 PR 曲線在正類很少時各自看得到什麼
formula_groups:
  - id: tpr-fpr
    source: https://doi.org/10.1016/j.patrec.2005.10.010
    status: verified
    checked_by: coordinator-term_b08e717c
  - id: auc-area
    source: https://scikit-learn.org/stable/modules/model_evaluation.html
    status: verified
    checked_by: coordinator-term_b08e717c
  - id: auc-pairs
    source: https://doi.org/10.1016/j.patrec.2005.10.010
    status: verified
    checked_by: coordinator-term_b08e717c
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某模型在閾值 0.6 下，對 10 筆實際盜刷抓到 7 筆，對 90 筆實際正常誤報 9 筆。這個閾值在 ROC 座標上的點（橫軸，縱軸）是什麼？
    options:
      A: （0.70，0.10）
      B: （0.09，0.70）
      C: （0.10，0.70）
      D: （0.90，0.70）
    answer: C
    explain:
      A: 兩軸對調了。橫軸是 FPR（9/90 = 0.10），縱軸是 TPR（7/10 = 0.70）。
      B: FPR 的分母要用實際為正常的 90 筆，不是全部 100 筆；9 ÷ 100 = 0.09 是分母用錯。
      C: 正確。FPR = 9 ÷ 90 = 0.10，TPR = 7 ÷ 10 = 0.70，點是（0.10，0.70）。
      D: 0.90 是 81 ÷ 90，也就是正常交易中沒被誤報的比例。橫軸要放被誤報的比例，不是沒被誤報的比例。
  - id: c2
    goal: g2
    type: choice
    prompt: 3 筆盜刷的分數是 0.9、0.6、0.4，2 筆正常的分數是 0.6、0.3。AUC 是多少？
    options:
      A: "0.75"
      B: "0.67"
      C: "0.83"
      D: "0.50"
    answer: A
    explain:
      A: 正確。6 對中 4 對盜刷較高、1 對同分、1 對盜刷較低，（4 + 0.5）÷ 6 = 0.75。
      B: 這是把同分的那一對（0.6 對 0.6）當成輸，4 ÷ 6。同分要算半對，不是 0。
      C: 這是把同分的那一對當成贏，5 ÷ 6。同分只算半對。
      D: 0.50 是亂猜的水準。這批分數裡，盜刷的分數多半排在正常交易前面，不會是亂猜。
  - id: c3
    goal: g3
    type: choice
    prompt: 盜刷只占全部交易的 1%，某模型的 ROC-AUC 是 0.95。下列哪個結論最恰當？
    options:
      A: "ROC-AUC 為 0.95 就表示警報命中率是 95%，因此每 100 次警報中，平均約有 95 次是真盜刷"
      B: "正類僅占 1%，ROC 的 FPR 也以這些正類為分母，故負類太多會使曲線無法計算"
      C: 正類只占 1%，這個 AUC 是被高估的數字，實際要打折
      D: AUC 只反映排序，要知道警報有多少是真的，還要看固定閾值下的 Precision 或 PR 曲線
    answer: D
    explain:
      A: "AUC 衡量排序，無法推出每百次警報有幾次是真的；警報命中率是固定閾值下的 Precision。"
      B: "FPR 的分母是實際負類數，TPR 的分母才是實際正類數；題目兩類都有資料，正類少並不使 ROC 無法計算。"
      C: 各類內的分數分布不變時，AUC 不會因正類變少而變小或變大。它沒有被高估，只是回答的不是警報品質的問題。
      D: 正確。AUC 與閾值無關，所以不能直接說明警報品質，要搭配 Precision 或 PR 曲線。
  - id: c4
    goal: g2
    type: choice
    prompt: 3 筆盜刷的分數是 0.9、0.6、0.4，2 筆正常的分數是 0.6、0.3，分數大於或等於閾值就判為盜刷。閾值從 0.7 降到 0.6，ROC 上的點怎麼移動？
    options:
      A: 垂直上移，從（0，0.33）到（0，0.67），只多抓到 1 筆盜刷
      B: "斜向移動，從（0，0.33）到（0.5，0.67），同分兩筆同時納入"
      C: "水平右移，從（0，0.33）到（0.5，0.33），新增正常交易的誤報，盜刷抓到的筆數不變"
      D: 不動，因為 0.7 到 0.6 之間沒有其他分數
    answer: B
    explain:
      A: 閾值 0.6 時，分數 0.6 的盜刷和分數 0.6 的正常都達到閾值。誤報不會維持 0，FPR 也要跟著變。
      B: "正確。閾值 0.7 時 TP=1、FP=0，點是（0，1/3）；降到 0.6 時同分的一正一負都納入，TP=2、FP=1，點是（1/2，2/3）。"
      C: "分數 0.6 的盜刷也達到新閾值，TP 由 1 增至 2，TPR 會由 0.33 升至 0.67，不能只增加誤報。"
      D: 判斷規則是大於或等於閾值。分數剛好等於 0.6 的兩筆，在閾值降到 0.6 的那一刻就被納入，所以點會移動。
  - id: c5
    goal: g1
    type: choice
    prompt: 某癌症篩檢模型的 ROC 曲線上有三個點（FPR，TPR）：甲（0.05，0.80）、乙（0.12，0.95）、丙（0.30，0.99）。醫院規定敏感度至少 95%，在這個前提下盡量減少誤報。該選哪個點對應的閾值？
    options:
      A: 甲，因為 FPR 最低，誤報最少
      B: 乙，TPR 剛好達標，且是達標的點中 FPR 最小的
      C: 丙，因為 TPR 最高，漏診最少
      D: 三個都可以，因為它們在同一條曲線上，AUC 相同
    answer: B
    explain:
      A: 甲的 TPR 只有 0.80，每 100 位病人漏掉 20 位，沒有達到 95% 的規定。
      B: 正確。乙的 TPR 0.95 達標，FPR 0.12 是達標點中最小的。
      C: 丙也達標，但 FPR 0.30 比乙多出 0.18，每 100 位健康者多 18 位被誤報，違反「盡量減少誤報」。
      D: 同一條曲線上的點 AUC 相同，但每個點對應不同的閾值，漏報與誤報的數量不同。規定的是 TPR 下限，點不能隨便選。
---

## 為什麼需要

分類模型通常先給每筆資料一個分數，再用閾值（Threshold，分數達到多少就判為正類）切成兩類。換一個閾值，[[confusion-matrix]] 的四格就會跟著變。

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 4 節]
只看一個閾值，分不出是模型排序差，還是閾值選得不好。
:::

ROC 曲線（全名是 Receiver Operating Characteristic curve，譯為接收者操作特徵曲線）把所有閾值的結果畫在同一張圖上，AUC（Area Under the Curve，曲線下面積）再把它壓成一個數字。

## 直覺（補充）

本頁用一批信用卡盜刷偵測的教學模擬資料。盜刷是正類，分數越高越像盜刷，分數大於或等於閾值就判為盜刷。

| 類別 | 筆數 | 編號與分數（由高到低） |
|---|---|---|
| 盜刷（正類） | 8 | C01 0.95、C02 0.90、C04 0.80、C05 0.75、C06 0.65、C08 0.50、C10 0.35、C13 0.20 |
| 正常（負類） | 12 | C03 0.85、C07 0.65、C09 0.40、C11 0.30、C12 0.25、C14 0.18、C15 0.15、C16 0.12、C17 0.10、C18 0.08、C19 0.05、C20 0.02 |

把閾值想成煙霧警報器的靈敏度。調得越靈敏，真火災幾乎都偵測得到，但煮菜的油煙也會觸發警報。

調低閾值，更多交易被判成盜刷：抓到的盜刷變多，誤報的正常交易也變多。調高閾值則相反。每個閾值對應圖上一個點，閾值從高掃到低，點從左下角走到右上角。

![閾值 0.5 的點在（0.167，0.750）；閾值降低時點往右上移動，虛線對角線代表亂猜。](figure:l23303-roc)

:::tip[重點]
閾值往下掃時，抓到的盜刷與誤報的正常交易都只增不減，所以曲線只會往右或往上走，不會回頭。
:::

## 定義與公式

ROC 曲線（ROC curve）上的每個點，是一個閾值的 (FPR, TPR)：

- 縱軸：真正率（True Positive Rate，TPR；也稱真陽率、敏感度）。
- 橫軸：假正率（False Positive Rate，FPR；也稱假陽率）。

真正率與 [[recall]] 使用相同的比率：

$$
\mathrm{TPR}=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}}
$$

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 2 節]
$$
\mathrm{FPR}=\frac{\mathrm{FP}}{\mathrm{FP}+\mathrm{TN}}
$$
:::

符號都來自指定閾值下的混淆矩陣：

- TP（True Positive）：實際盜刷，也判為盜刷。
- FN（False Negative）：實際盜刷，卻判為正常。
- FP（False Positive）：實際正常，卻判為盜刷。
- TN（True Negative）：實際正常，也判為正常。

TPR 就是 [[recall]]（Recall）：實際盜刷中抓到幾成。

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 2 節]
FPR 是實際正常中被誤報的比例。兩者的分母都在各自的類別內。
:::

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 2–7 節；scikit-learn 官方文件 roc_curve API 頁面]
模型與各類內的分數分布不變、只改兩類的筆數比例時，這兩個比率都不變。

代入閾值 0.5 的混淆矩陣（TP = 6、FN = 2、FP = 2、TN = 10）：

$$
\mathrm{TPR}=\frac{6}{6+2}=0.75,\qquad
\mathrm{FPR}=\frac{2}{2+10}\approx 0.167
$$

所以閾值 0.5 在圖上是點 (0.167, 0.75)。
:::

:::caution[注意]
TPR 的分母是實際正類的筆數，FPR 的分母是實際負類的筆數。資料裡沒有正類時 TPR 沒有定義，沒有負類時 FPR 沒有定義，兩者都不能當成 0，ROC 與 AUC 也算不出來。（補充）
:::

### AUC 的兩種讀法

AUC（Area Under the Curve）是 ROC 曲線下的面積，範圍在 0 到 1。

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 5、7 節]
曲線上的點很多時，用梯形法把相鄰兩點圍出的面積加起來：

$$
\mathrm{AUC}\approx\sum_{k}\left(\mathrm{FPR}_k-\mathrm{FPR}_{k-1}\right)\cdot\frac{\mathrm{TPR}_k+\mathrm{TPR}_{k-1}}{2}
$$

$k$ 是曲線上由左到右的第 $k$ 個點。每項是一個梯形：寬是 FPR 的增加量，高是兩端 TPR 的平均。

垂直段的寬是 0，面積也是 0。下一節會逐項加總這份資料的 12 個寬度。

AUC 還有一種不用畫圖的讀法：隨機各抽一筆盜刷與一筆正常，盜刷分數較高的機率，加上兩筆同分的機率的一半。

$$
\mathrm{AUC}=\frac{1}{n_+ n_-}\sum_{i\in P}\sum_{j\in N}\Big(\mathbf{1}[s_i>s_j]+\tfrac12\,\mathbf{1}[s_i=s_j]\Big)
$$

$n_+$、$n_-$ 是正類、負類的筆數，$P$、$N$ 是兩類樣本的集合，$s_i$、$s_j$ 是它們的分數。方括號為真時值是 1，否則是 0。

代入這批資料：$n_+ = 8$、$n_- = 12$，共 $8 \times 12 = 96$ 對。其中 82 對盜刷分數較高、1 對同分（0.65 對 0.65）、13 對較低：

$$
\mathrm{AUC}=\frac{82+0.5}{96}\approx 0.859
$$

:::

## 算一次（補充）

先用閾值 0.5 填出混淆矩陣。C08 的分數剛好是 0.50，依規則算判為盜刷。

| 實際＼判斷 | 判為盜刷 | 判為正常 |
|---|---|---|
| 實際盜刷 | TP = 6（C01、C02、C04、C05、C06、C08） | FN = 2（C10、C13） |
| 實際正常 | FP = 2（C03、C07） | TN = 10（其餘 10 筆） |

這張表只給出一個點 (0.167, 0.75)。要畫整條曲線，就把閾值逐步降低，每個閾值各算一次：

| 閾值（分數 ≥） | TP／FP | FPR | TPR |
|---|---|---|---|
| 高於 0.95 | 0／0 | 0 | 0 |
| 0.80 | 3／1 | 0.083 | 0.375 |
| 0.65 | 5／2 | 0.167 | 0.625 |
| 0.50 | 6／2 | 0.167 | 0.750 |
| 0.20 | 8／5 | 0.417 | 1.000 |
| 0.02 | 8／12 | 1.000 | 1.000 |

閾值高於所有分數時，沒有任何交易被判為盜刷，點落在原點 (0, 0)。閾值低於最低分時，全部判為盜刷，點落在 (1, 1)。前面 ROC 圖的下方可展開完整的閾值數值表。

同分要整組一起處理。C06（盜刷）與 C07（正常）的分數都是 0.65，不可能只納入其中一個。閾值從 0.75 降到 0.65 時，TP 與 FP 同時各加 1，曲線在這裡走一段斜線。

接著算面積。每筆正常交易對應曲線下一個寬 1/12 的長條，高度是「分數比它高的盜刷占 8 筆的比例」，同分的盜刷算半筆。

| 正常交易 | 分數 | 分數較高的盜刷數 | 長條高度 |
|---|---|---|---|
| C03 | 0.85 | 2 | 0.250 |
| C07 | 0.65 | 4.5（含同分半筆） | 0.5625 |
| C09 | 0.40 | 6 | 0.750 |
| C11、C12 | 0.30、0.25 | 7 | 0.875（各一條） |
| C14 到 C20（7 筆） | 0.18 到 0.02 | 8 | 1.000（各一條） |

12 條長條的高度加起來是 $0.25 + 0.5625 + 0.75 + 2 \times 0.875 + 7 \times 1 = 10.3125$，再乘上寬度 1/12：

$$
\mathrm{AUC}=\frac{10.3125}{12}=0.859375
$$

分數較高的盜刷數加總是 $2 + 4.5 + 6 + 7 + 7 + 56 = 82.5$，除以 96 對，與配對讀法得到同一個數。

AUC 約 0.86：隨機抽一筆盜刷與一筆正常，盜刷分數嚴格較高的機率是 82/96 ≈ 85.4%，同分的機率是 1/96。把同分的一半併入，得到 0.859。

## 怎麼用、怎麼判讀

判讀 ROC 曲線，先看它離哪條線近：

| 曲線的樣子 | 代表什麼 |
|---|---|
| 貼近左上角 | 用很低的誤報率就能抓到多數盜刷，AUC 接近 1 |
| 沿著對角線 | 分數幾乎沒有區分能力，AUC 約 0.5 |
| 落在對角線下方 | 區分表現較差 |

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 3.1、4.1、7 節]
曲線落在對角線下方時，排序方向反了；分數取負號後，AUC 變成 1 減原值。

AUC 只看分數的先後，不看分數本身是否準確。把所有分數乘上正數，或對正的分數取對數，先後不變，AUC 也不變。
:::

AUC 與閾值無關，所以它不能告訴你閾值該選多少。選閾值是從曲線上挑一個點。

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 3、4 節]
例如業務最多只能接受 FPR 0.167，這批資料中最好的是閾值 0.5（TPR 0.75），比 0.65 的 TPR 0.625 高。
:::

評估時，AUC 要用沒參與訓練的資料（驗證集或測試集）計算，否則會偏樂觀。

:::supplement[來源：Google Developers「Measuring success」的 Connection between model metrics and business metrics]
AUC 衡量模型區分能力，分數好不保證業務指標也會改善。
:::

### 和 PR 曲線怎麼選（補充）

PR 曲線橫軸是 Recall、縱軸是 [[precision]]，細節見 [[pr-auc]]。差別在分母：FPR 除以全部正常交易，Precision 除以所有判為盜刷的交易。

做個思想實驗：保留 8 筆盜刷，把 12 筆正常交易各複製 10 份、分數不變，變成 120 筆正常。正類比例從 40% 降到 6.25%。

ROC 的兩個比率都在各自類別內計算，曲線與 AUC 完全不變，仍是 0.859。

閾值 0.5 時 TP = 6、FP = 2 × 10 = 20，Precision 從 0.75 掉到 $6/(6+20) \approx 0.23$：約每 4 次警報只有 1 次是真的。

![同一個模型，閾值 0.5 的點在 Recall 0.75、Precision 0.23；Recall 剛到 1 時 Precision 只有 0.14。](figure:l23303-roc-pr-imbalance)

依問題選指標：

| 你想知道的事 | 優先看 |
|---|---|
| 閾值還沒定，模型整體分得開兩類嗎 | ROC 曲線與 AUC |
| 正類很少，警報有多少是真的 | PR 曲線與 Precision |
| 閾值已定，要看抓得準不準 | 該閾值的 Precision、Recall、[[f1-score]] |

### 換個場景

指引 5-21 以詐騙與癌症偵測說明漏報的重要性，5-25 則提醒醫療應考慮漏診成本。換到這些場景，先決定正類與要避免的錯誤，再看 ROC 上的取捨。

同一條 ROC 曲線，換了領域，「正類是誰」和「哪種錯比較貴」就不同，選點的方式也跟著變。

| 場景 | 正類 | 哪種錯較貴 | 在 ROC 上怎麼用 |
|---|---|---|---|
| 詐騙偵測 | 盜刷交易 | 漏報詐騙 | 搭配召回率，觀察實際盜刷抓到幾成 |
| 癌症偵測／醫療篩檢 | 患病者 | 漏報（漏診） | 搭配召回率與漏診成本判讀 |
| 製造瑕疵檢測（補充） | 瑕疵品（以瑕疵率不到 1% 的產線為例） | 看成本：漏報會出貨，誤報要複檢或報廢 | 用 AUC 判斷分數可不可用，再看警報筆數與 Precision，評估複檢量與誤報比例 |
| 內容推薦（補充） | 使用者會點擊的項目 | 沒有固定閾值，只取前幾名 | AUC 直接對應「點擊的項目排在沒點擊的前面」的機率 |

:::supplement[來源：Fawcett（2006）〈An introduction to ROC analysis〉第 3、4.2、7 節]
醫療篩檢若先訂 TPR 的下限，可以在達標的點中找 FPR 最小者。

在盛行率低的醫療篩檢中，曲線上的點好看，不等於陽性結果可信。以下假設盛行率 1%、TPR 0.95、FPR 0.05。

每 10,000 人有 100 位患者，抓到 95 位。9,900 位健康者誤報 495 位。陽性結果中真病人的比例是 95 ÷ (95 + 495) ≈ 0.16，約每 6 個陽性只有 1 個是真的。

製造瑕疵的判讀重點與醫療相同，差別在代價。複檢有人力上限時，要看警報量與 Precision，不能只看 AUC。

推薦系統通常只展示前幾個項目，閾值由版位數決定。整體 AUC 會把不同使用者的分數混在一起比。每位使用者的排序好不好，要另外分開看。

:::

## 常見誤解

- **「ROC 曲線上的點是不同模型。」** 不是。同一個模型、同一批資料，只是閾值不同。
- **「用一張混淆矩陣就能算出 AUC。」** 不行。一張矩陣只對應一個閾值，也就是曲線上的一個點。要有每筆資料的分數，才能掃出整條曲線。（補充）
- **「AUC 沒變，固定閾值下的表現就沒變。」** 不對。分數全部減 0.2，先後沒變，AUC 仍是 0.859。但閾值 0.5 此時等於原來的 0.7，TP 剩 4，TPR 從 0.75 掉到 0.5。（補充）
- **「AUC 高就代表上線後有成效。」** 不一定。AUC 不含誤報與漏報各自的成本，也不保證上線後的資料分布與離線時相同。要搭配線上指標一起看。（補充）
- **「AUC 是 Accuracy 的升級版。」** 兩者回答不同的問題。Accuracy 要先定閾值，AUC 把所有閾值一起看，不能互相取代。（補充）

## 進階

### AUC 與 Mann–Whitney U、同分處理（補充）

AUC 的配對讀法等同於 Mann–Whitney U 統計量除以 $n_+ n_-$（Wilcoxon 秩和檢定的同一個量）。

所以「隨機一對裡正類分數較高的機率，加上同分機率的一半」不是比喻，而是 AUC 的等價定義。沒有同分時，同分項為 0，才能簡寫成「正類分數較高的機率」。

ROC 點的取法有一個細節：同分的樣本要整組加入。這樣梯形法才會在同分處畫出斜線，並與配對讀法的「同分算一半」一致。若任意排序，會得到不同的 AUC。

### 參考來源

- 科目 3 學習指引 5-20～5-22、5-25：混淆矩陣、兩軸、曲線下面積、閾值與綜合評估。（支持：定義與公式、怎麼用、怎麼判讀）
- [Fawcett（2006）〈An introduction to ROC analysis〉](https://www.math.ucdavis.edu/~saito/data/roc/fawcett-roc.pdf) 第 2–7 節；DOI 10.1016/j.patrec.2005.10.010。（支持：為什麼需要、直覺、定義與公式、AUC 的兩種讀法、算一次、怎麼用、怎麼判讀、和 PR 曲線怎麼選、換個場景、常見誤解、小結）
- scikit-learn 使用者指南 [3.4「Metrics and scoring」的 ROC 小節](https://scikit-learn.org/stable/modules/model_evaluation.html#roc-metrics) 與 [roc_curve](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html)、[roc_auc_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_auc_score.html) API 頁面。（支持：直覺、定義與公式、AUC 的兩種讀法、算一次、怎麼用、怎麼判讀）
- [Google Developers「Measuring success」](https://developers.google.com/machine-learning/managing-ml-projects/success)，Connection between model metrics and business metrics。（支持：怎麼用、怎麼判讀的模型指標與業務成效界線、常見誤解）
- Hanley 與 McNeil（1982），〈The Meaning and Use of the Area under a Receiver Operating Characteristic (ROC) Curve〉，Radiology 143(1)，第 29–31 頁。（支持：AUC 與 Mann–Whitney U、同分處理）

## 小結

- ROC 曲線的縱軸是 TPR（Recall），橫軸是 FPR；每個點對應一個閾值。
- 把同一批分數的閾值從高掃到低，點從 (0, 0) 走到 (1, 1)，連起來就是曲線。（補充）
- AUC 是曲線下面積。
- 它也是隨機抽一正一負時，正類分數較高的機率加上同分機率的一半。這批資料的 AUC 是 0.859。（補充）
- AUC 與單一閾值無關。
- AUC 只看排序，單一混淆矩陣算不出它。（補充）
- 模型與各類內的分數分布不變、只有正類變少時，ROC 與 AUC 不變，警報中真盜刷的占比卻會掉。要用 PR 曲線與 Precision 看警報品質。（補充）
