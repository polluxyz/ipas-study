---
id: model-comparison
title: 模型比較與綜合評估
aliases: [模型比較, 多指標評估, Boxplot, Mean Rank Plot, 成本矩陣, 離線評估與線上評估]
kind: technique
codes: [L23303, L23302]
guide_refs: [guide-3:5-24, guide-3:5-25, guide-3:5-26, guide-1:5-20, guide-1:5-21]
gaps:
  - ref: guide-3:5-26
    level: missing
    ability: 指引講用多指標與多輪驗證比較模型，沒有講怎麼設計實驗才算公平，例如用不同標註比例比較資料利用效率；考題要選出這種實驗設計
  - ref: guide-1:5-20
    level: shallow
    ability: 指引 5-20 已要求技術指標與業務指標並看（雙軌制），但沒有用離線 AUC 對線上 CTR 的落差示範；考題要辨認只看離線 AUC 的結論有缺口
  - ref: guide-1:5-21
    level: shallow
    ability: 指引 5-21 只在模型版本管理段落用一句話提到金絲雀部署，沒有說明它如何用小流量量測真實業務指標
author: codex
status: draft
textbook: v2
summary: 模型比較要同時查看多項指標、錯誤成本與驗證波動
goals:
  - id: g1
    text: 在相同評估條件下，綜合分類與迴歸指標、標註量及部署資源限制判斷模型取捨
  - id: g2
    text: 由四格計數算出誤判成本與自訂淨收益，說明業務假設
  - id: g3
    text: 算出配對多輪驗證的平均與波動，判讀箱型圖及平均排名圖
formula_groups:
  - id: total-cost
    source: https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html
    status: pending
    checked_by: null
  - id: custom-profit
    source: https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html
    status: pending
    checked_by: null
  - id: mean-spread
    source: https://numpy.org/doc/stable/reference/generated/numpy.std.html
    status: pending
    checked_by: null
  - id: mean-rank
    source: https://jmlr.org/papers/volume7/demsar06a/demsar06a.pdf
    status: verified
    checked_by: task_28ef2491f268
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同批 8 天出貨預測中，甲的 MAE=3.375、RMSE=7.133，乙兩項皆為 4。倉庫最怕單日大幅低估，哪個判斷較合適？
    options:
      A: "甲的 MAE 較小，因此單日低估風險也較低"
      B: "乙的 RMSE 為 4，低於甲的 7.133，足以判定乙每天的絕對誤差都比甲小"
      C: "甲的 MAE 與 RMSE 數字不同，表示兩者單位不同，不能用這批資料逐項比較甲乙"
      D: "乙的 RMSE 較小；仍須檢查殘差方向及單日誤差"
    answer: D
    explain:
      A: "MAE 較小只表示平均絕對誤差較小，不能據此判定單日大幅低估的風險也較低。"
      B: "RMSE 是整批誤差的彙總，較低不表示每一天都比較準。"
      C: "MAE 與 RMSE 都與預測目標同單位；在相同資料上可逐項比較甲乙，只是指標側重不同。"
      D: "較低 RMSE 提供大誤差風險的比較線索，但沒有保留高估或低估方向，仍須核對個別殘差。"
  - id: c2
    goal: g2
    type: choice
    prompt: 瑕疵模型有 TP=4、FP=4、FN=0、TN=12；漏放成本每件 1000 元、誤攔每件 50 元，判對成本為零。總誤判成本多少？
    options: {A: '200 元', B: '400 元', C: '4000 元', D: '4200 元'}
    answer: A
    explain:
      A: 4 件誤攔乘 50 元，沒有漏放，總計 200 元。
      B: 400 元是把全部 8 次攔檢都收 50 元，但題意只對誤攔計成本。
      C: 4000 元是把抓對的瑕疵當成漏放，混淆 TP 與 FN。
      D: 4200 元把抓對瑕疵也算成漏放，超出成本定義。
  - id: c3
    goal: g3
    type: choice
    prompt: 五輪配對驗證的平均 F1 都是 0.80，甲標準差 0.057、乙 0.014，兩模型平均名次都 1.5。可得什麼結論？
    options:
      A: "乙標準差 0.014 小於甲的 0.057，足以證明乙的真實平均 F1 顯著較高"
      B: "乙在這五輪的 F1 波動較小，尚不能據此聲稱顯著勝出"
      C: "平均名次同為 1.5，表示每輪同分"
      D: "甲的標準差 0.057 大於乙的 0.014，表示甲的平均 F1 不可能也是 0.80"
    answer: B
    explain:
      A: "標準差描述所觀察分數的波動，不能單靠它證明真實平均能力顯著較高，也未處理摺間相依。"
      B: "標準差較小只說明這五輪的分數較集中，尚需適當推論程序才能判斷顯著差異。"
      C: "各輪互有領先也可能得到相同平均名次，不能據此認定逐輪分數相同。"
      D: "平均與標準差描述不同面向；相同平均 0.80 可以搭配不同的分數波動。"
  - id: c4
    goal: g1
    type: choice
    prompt: 要比較兩種模型在標註資料只剩 20% 時的能力，哪個設計較公平？
    options:
      A: 兩模型各抽不同測試集，只要筆數相同
      B: 只縮小其中一個模型的訓練集，另一個維持全部資料
      C: 同時使用相同的 20% 訓練子集，固定評估資料與預算
      D: 邊看測試 F1 邊調參，讓兩模型都達到最好測試分數
    answer: C
    explain:
      A: 不同測試集的難度差異會混入模型差異。
      B: 訓練資料量不同，無法公平比較相同低資源條件。
      C: 固定資料條件與預算，才能把差異較合理歸於模型方案。
      D: 反覆用測試集調參會造成對測試集的選擇偏差。
  - id: c5
    goal: g1
    type: choice
    prompt: 固定訓練池 2000 筆，團隊只負擔 200 筆訓練標註，成果檔上限 32 KiB。甲乙共用切分與搜尋預算，驗證 F1 都達標；甲檔案 30 KiB、乙 68 KiB。哪個判斷較合適？
    options:
      A: "200 筆是 20%；乙 F1 達標即可直接忽略儲存上限"
      B: "200 筆是 10%；先讓符合儲存限制的甲進入部署量測"
      C: "200 筆是 10%；只要成果小於上限就能保證推論記憶體"
      D: "200 筆是 20%；各模型換自己的測試集即可公平比較"
    answer: B
    explain:
      A: "2000 筆的 20% 是 400 筆，且效能過關不能取代儲存限制。"
      B: "比例與資源限制都須符合；甲仍需在目標設備實測記憶體與延遲。"
      C: "磁碟成果大小不等於載入後的記憶體，更不能涵蓋推論尖峰。"
      D: "比例算錯，且不同測試集會把資料難度混入模型差異。"
---

## 為什麼需要

一個模型少漏瑕疵，另一個少誤攔良品，不能只憑單一分數宣布誰比較好。模型比較（Model Comparison）要把指標、錯誤代價及驗證穩定性放在同一個判斷流程。

## 直覺

先問三件事：「在哪批資料比較？」「什麼錯誤最不能接受？」「換切分後表現穩不穩？」

分類可合看準確率、F1 分數、ROC-AUC 與混淆矩陣；迴歸可合看平均絕對誤差、均方根誤差與決定係數（R²）。這些指標提供不同角度，不能互相取代。

:::supplement[來源：scikit-learn User Guide：Cross-validation；Custom refit strategy of a grid search]
比較前固定評估資料、正類定義、指標算法與訓練預算。閾值可各自在驗證資料依同一規則選定，但不能為了勝出而反覆看測試集調閾值。
:::

## 定義與公式

### 用成本矩陣指定錯誤代價

醫療漏診、瑕疵漏放及誤報的損失可能不同，應先依業務風險訂出誤判代價。

:::supplement[來源：scikit-learn 教學：Post-tuning the decision threshold for cost-sensitive learning]
成本矩陣先替每種結果定價，再依混淆矩陣數量計總成本。

本頁主例子是製造品檢的教學模擬資料：同一批 20 件產品中，4 件瑕疵、16 件良品。正類固定為瑕疵，兩模型皆以分數大於或等於 0.5 判正類。

| 實際＼決策 | 攔下檢查 | 放行 |
|---|---|---|
| 瑕疵 | TP：0 元 | FN：1000 元 |
| 良品 | FP：50 元 | TN：0 元 |

這是本例的錯誤代價假設：漏放一件損失 1000 元，誤攔一件花 50 元，正確決策成本設零；不是通用產業定價。
:::

### 總成本的計算（補充）

$$
C=c_{\mathrm{TP}}\mathrm{TP}+c_{\mathrm{FP}}\mathrm{FP}
+c_{\mathrm{FN}}\mathrm{FN}+c_{\mathrm{TN}}\mathrm{TN}
$$

$C$ 是總成本，$c$ 是每件成本，TP、FP、FN、TN 是件數。模型 A 的四格為 3、2、1、14，故 $C_A=50\times2+1000\times1=1100$ 元。

此式由本例四格定價加總而得，要求每一格內的單件成本固定。scikit-learn 教學提供矩陣逐格乘積加總的程式，沒有直接列出這個一般四項符號式；直接式來源仍待補核。若每筆交易代價不同，不能只用四格件數乘固定價格。

### 收益指標必須先定義（補充）

指引提及 Profit Score，但它沒有一個放諸各業皆準的公式。另訂一個收益方案：每攔到一件瑕疵回收 500 元價值，每次攔檢花 50 元；未攔到與放行良品的收益設零。

$$
\Pi=500\mathrm{TP}-50(\mathrm{TP}+\mathrm{FP})
$$

$\Pi$ 是本例淨收益，單位為元；$\mathrm{TP}+\mathrm{FP}$ 是全部攔檢件數。模型 A 得 $500\times3-50\times(3+2)=1250$ 元。

這個收益方案與上一個誤判成本方案是兩個獨立假設，不可相加後重複計入損失。預期收益、成本及評估期間都需先由業務定義。

這是依本頁單價自訂的定義；外部教學支持自訂業務指標的方法，並未給出此處 500／50 元的精確式。其直接來源核對保留待確認，不把自行代入算對當成外部來源已驗證。

## 算一次

### 分類：分數較高不等於成本較低

下表的四格依同批原始分數與閾值計算；ROC-AUC 用全部分數計算，不是從單一混淆矩陣推出。

| 觀察項目 | 模型 A | 模型 B |
|---|---:|---:|
| TP、FP、FN、TN | 3、2、1、14 | 4、4、0、12 |
| 準確率 | 17/20=0.85 | 16/20=0.80 |
| 精確率、召回率 | 3/5=0.60、3/4=0.75 | 4/8=0.50、4/4=1.00 |
| F1 | 6/9≈0.667 | 8/12≈0.667 |
| ROC-AUC | 61/64≈0.953 | 55/64≈0.859 |

模型 A 的準確率與排序較好，兩模型 F1 卻相同；模型 B 的誤報較多，但沒有漏放瑕疵。只看其中一欄會忽略這個取捨。

:::supplement[來源：scikit-learn 教學：Post-tuning the decision threshold for cost-sensitive learning]
- 模型 A 總誤判成本：$2\times50+1\times1000=1100$ 元。
- 模型 B 總誤判成本：$4\times50+0\times1000=200$ 元。
- 獨立收益方案下，模型 B 為 $4\times500-8\times50=1600$ 元，高於模型 A 的 1250 元。

在這兩個明訂假設下都會偏向模型 B，但不能因此說 B 在所有風險偏好下都最好。若誤攔比漏放更昂貴，選擇可能改變。
:::

### 迴歸：平均小誤差與單次大誤差

沿用網店出貨量 8 天的實際值與模型 A 預測，再增加模型 B：每天都少估 4 箱。這是另一份教學模擬比較，不與品檢資料混算。

模型 A 前七天各差 1 箱，最後一天少估 20 箱。絕對誤差和為 27，平方誤差和為 407；模型 B 分別為 32 與 128。

| 指標 | 模型 A | 模型 B |
|---|---:|---:|
| MAE（箱） | 27/8=3.375 | 32/8=4 |
| RMSE（箱） | √(407/8)≈7.133 | √(128/8)=4 |
| R² | 1−407/5950≈0.932 | 1−128/5950≈0.978 |

MAE 看平均絕對偏差，模型 A 較小；RMSE 對大誤差較敏感，模型 B 較小。若倉庫最怕單日缺貨，應進一步看殘差方向與最大低估量。

:::supplement[來源：scikit-learn User Guide：Metrics and scoring；scikit-learn API：r2_score]
同批實際值平均 47.5 箱，離均差平方和 5950，是兩個 R² 共用的常數平均基準。模型 B 的八筆殘差都為 +4，代表持續低估；高 R² 並沒有保證誤差沒有方向。

若兩模型各用不同難度的日期，MAE、RMSE 和 R² 差異會混入資料差異。

R² 定義為 $1-\mathrm{SSE}/\mathrm{SST}$，SSE 是殘差平方和，SST 是實際值的離均差平方和，要求 SST>0。

它只比較預測值與實際值，不限定模型是否線性，也不要求特徵標準化。這與指引 5-24 所寫的限制不同。

同批實際值非常數時，永遠預測其平均值的 R² 為 0；比此基準更差時，R² 可為負。
:::

### 多輪驗證：平均之外也看波動

以下是開發資料上另外五輪配對驗證的 F1，不是前面 20 件產品的評估分數。每輪兩模型使用相同切分，F1 越高越好。

| 輪次 | 模型 A | 模型 B |
|---|---:|---:|
| 1 | 0.72 | 0.78 |
| 2 | 0.76 | 0.79 |
| 3 | 0.80 | 0.80 |
| 4 | 0.84 | 0.81 |
| 5 | 0.88 | 0.82 |

:::supplement[來源：NumPy：mean、std]
$$
\bar s=\frac{1}{m}\sum_{j=1}^{m}s_j,\qquad
\sigma_{\mathrm{desc}}=\sqrt{\frac{1}{m}\sum_{j=1}^{m}(s_j-\bar s)^2}
$$

$s_j$ 是第 $j$ 輪分數，$m$ 是輪數；$\sigma_{\mathrm{desc}}$ 是本頁用分母 $m$ 的描述性標準差，不是以 $m-1$ 估計的樣本標準差。

[NumPy mean 的 Notes](https://numpy.org/doc/stable/reference/generated/numpy.mean.html)直接說明加總後除以個數；[std 的 Notes](https://numpy.org/doc/stable/reference/generated/numpy.std.html)給出平方差加總、分母與開根號，並區分 ddof=0 與 1。本頁五個有限實數只作描述，不假設五輪獨立。

兩者平均皆為 4/5=0.80。A 的離均差平方和為 0.016，除以 5 再開根號得 0.05657；B 為 0.001，依樣計算得 0.01414。
:::

### 固定資料才能看資料效率（補充）

任務是把客服訊息或製造工單分成「優先處理」與「一般處理」。兩領域各有 1500 筆**教學合成文字**，共 3000 筆；每筆索引唯一、文字不重複，並以約 10% 語意翻轉模擬歧義。

這些文字由共用模板生成，不代表真實客戶對話，也沒有驗證未知句型或大型語言模型的能力。

以下實測三條 NLP 建模路線，NLP 指自然語言處理。先懂資料如何轉成特徵，再比較分類器；向量化細節見詞頻與逆文件頻率，分類決策見邏輯迴歸。

| 路線 | 文字表示 | 分類與預測規則 |
|---|---|---|
| 詞級 TF-IDF＋邏輯迴歸 | 合成文字已用空白斷詞，取單詞與相鄰雙詞 | liblinear，最多 1000 次迭代，原生 predict |
| 字元 TF-IDF＋線性支持向量機（SVM） | 取長度 2～4 的連續字元片段，不另斷詞 | LinearSVC，dual=False，最多 2000 次迭代，原生 predict |
| 詞級 TF-IDF＋多項式朴素貝氏（NB） | 與詞級邏輯迴歸同樣的單詞及相鄰雙詞 | MultinomialNB，類別先驗與條件特徵模型，原生 predict |

朴素貝氏以類別條件分布 P(x\|y) 及先驗 P(y) 建模，再依貝氏規則分類，屬生成式分類路線；這裡 x 是 TF-IDF 特徵，不是直接生成自然語句。邏輯迴歸直接建模 P(y\|x)，屬鑑別式；線性 SVM 則學分類邊界，也屬鑑別式，但不直接輸出校準機率。

本例可比較生成式分類與鑑別式分類在少標註條件下的取捨，**不能替代 VAE、BERT 或生成式 AI 微調的實測**。遷移到 VAE／BERT 時，只借用「同比例子集、同評估條件」的設計，不把 NB 的分數當作它們的成績。

分類方法依據見 [Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)及 [Logistic regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression)。

TF-IDF 只在該輪訓練子集擬合，min_df=1，其餘用 scikit-learn 1.9.1 預設；不可先用全部文字建詞彙表或算 IDF。比較的是整條路線，不能把差異單獨歸因給分類器。

#### 把實驗條件先鎖住

| 控制項 | 本例固定值 | 防止哪種混淆 |
|---|---|---|
| 原始訓練池 | 2000 筆；客服／製造各 1000，類別各半 | 分母改變卻仍宣稱相同比例 |
| 留出資料 | 驗證 400、測試 600 筆；兩領域與兩類各半，索引全程固定 | 用測試選參數或偷偷換難度 |
| 訓練量 | 2000／1000／200 筆，即 100%／50%／10% | 20% 實為 400 筆，不是 200 筆 |
| 重複抽樣 | 種子 11、22、33、44、55，共 5 輪；按領域×類別分層，子集逐級包含 | 三路線抽到不同的訓練例子 |
| 調參預算 | 每路線、每筆數、每種子各試三格；LR／SVM 為 C=0.1、1、10，NB 為 alpha=0.1、1、10；只用驗證 macro-F1 選一次，同分取前者 | 一邊多試設定取得不公平優勢 |
| 指標與閾值 | labels=[0,1]、average="macro"、zero_division=0；不在測試調閾值 | 混用正類 F1、加權平均與類別比例 |

macro-F1 先各算一個類別的 F1 再等權平均，不是先平均精確率與召回率。正類 1 是優先處理，所有條件共用測試樣本；JSON 保存資料、抽樣索引、參數與逐筆預測供回算。

生成種子為 2330304。選定參數後保留該模型，不把驗證併回重訓，訓練標註量也不包含驗證 400 筆；先固定整個比較設計，最後彙報全部測試結果，不再據排名追加搜尋。

C 控制 LR／SVM 的正則化強度（數值越小，正則化越強），alpha 控制 NB 平滑；三格搜尋次數相同，不代表參數意義或計算成本相同。

三路線×三筆數×五種子共 45 組、135 次 fit。[完整重現程式](https://github.com/polluxyz/ipas-study/blob/main/content/examples/L23303-M4-C-README.md)從教材內的 records、base_split、subsets 重訓全部條件，並建立可回讀的新 MLflow run。

#### 三種資料量的實測

| 訓練筆數／占訓練池 | 詞級＋邏輯迴歸 macro-F1 | 字元＋線性 SVM macro-F1 | 詞級＋朴素貝氏 macro-F1 |
|---|---|---|---|
| 2000／100% | 0.8767 ± 0.0000 | 0.8767 ± 0.0000 | 0.8767 ± 0.0000 |
| 1000／50% | 0.8740 ± 0.0029 | 0.8707 ± 0.0039 | 0.8753 ± 0.0012 |
| 200／10% | 0.8000 ± 0.0291 | 0.7929 ± 0.0243 | 0.8380 ± 0.0169 |

表中是五輪平均 ± 描述性標準差，分母用 5，不是信賴區間。各輪訓練集重疊、測試也相同，不能當成五組獨立證據。

2000 筆時每輪都用完整訓練池，三個確定性路線各自預測相同，標準差因此為零。這沒有量到新資料、時間漂移或部署環境的不確定性。

![三條 NLP 路線在相同測試集上的標註量曲線；圓點為詞級 LR、方點為字元 SVM、三角為詞級 NB；短線為描述性標準差，並非信賴區間](figure:l23303-m4-c-label-efficiency)

本例從 200 增到 1000 筆改善較明顯，再增到 2000 筆的增幅較小。這只適用於本組資料、路線及預算，不能推論增加標註必定有效，也不能外推生成式模型微調的成效。

NB 在本例 200 筆時的平均較高、波動較小；不是所有小樣本都必定適合 NB，也不能由相依的五輪分數宣稱顯著勝出。完整程式會重新訓練 NB 的 45 次 fit，再核對全部三路線預測；不是只讀歷史平均當作重訓結果。

#### 成本與分數要一起讀

**以下單價是假設，秒數是原作者當次本機歷史量測。** 假設每筆訓練標註新臺幣 2 元、運算每分鐘 0.5 元；運算費依未取整的歷史搜尋秒數計，與正式雲端帳單不同。重跑不要求秒數逐位相同，也不替換原紀錄。

| 訓練標註費（三路線共用） | 詞級 LR：搜尋耗時／假設運算費 | 字元 SVM：搜尋耗時／假設運算費 | 詞級 NB：搜尋耗時／假設運算費 |
|---|---|---|---|
| 2000 筆：4000 元 | 0.121 秒／0.001009 元 | 0.481 秒／0.004009 元 | 0.107 秒／0.000892 元 |
| 1000 筆：2000 元 | 0.077 秒／0.000642 元 | 0.271 秒／0.002257 元 | 0.076 秒／0.000633 元 |
| 200 筆：400 元 | 0.026 秒／0.000213 元 | 0.068 秒／0.000564 元 | 0.026 秒／0.000218 元 |

耗時是五輪每輪平均，包含三次訓練與驗證預測，不含最終測試及計時探測。每輪從頭執行，五輪合計運算費是表中金額的五份；三路線共用的標註不重複收費。

標註費是取得**單份 n 筆子集**的假設，不是五輪不同子集的總價。本例 200／1000 筆的五輪聯集各有 831／1935 筆，依假設需 1662／3870 元；合成文字沒有實際標註支出。

按此單價，固定驗證另需 800 元、測試另需 1200 元，所有條件共用；未含收集、開發與維運。前面品檢的誤判成本是業務風險，與標註、訓練及部署資源分開計算。

來源：[scikit-learn 文字分類教學](https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html)、[F1 API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html)及 [Google 資料切分課程](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)。本批合成實測記錄：`L23303-M4-C-label-efficiency.json`。

### 把需求限制對回三個候選

科目 3 指引 5-11 起要求一起考慮任務、資料、解釋與資源；科目 1 指引 5-2 的「數據準備與模型選擇」也要求兼看實際用途。分數過門檻後，還須確認模型能在預定設備運行；先建立候選的方法見任務辨識與模型選擇。

#### 本例需求（補充）

以下是用實測結果演示選型的**教學需求假設**，並非產品驗收計畫。實務上應先訂需求再選模，不能為了特定候選通過而改門檻；三者均使用上節的同資料與預算流程。

成果檔占用磁碟；行程常駐記憶體（Resident Set Size，RSS）則是載入與執行時占用的記憶體。p95 是延遲的第 95 百分位；本例 KiB、MiB 分別以 1024、1048576 位元組計。

| 面向 | 需求限制 | 驗證方法 |
|---|---|---|
| 效能 | 驗證平均 macro-F1 至少 0.87；凍結後測試檢查至少 0.85 | 五輪配對平均，另看 Accuracy 與優先類 Recall |
| 資料 | 每輪最多使用 1000 筆訓練標註，另留固定驗證與測試；五輪聯集需 1935 筆 | 共用四層抽樣索引，禁止擬合留出文字 |
| 解釋 | 能列出完整詞或詞組的貢獻 | 檢查特徵與係數／條件機率；不當成因果證明 |
| 複雜度 | 單層線性分類器或條件機率基線，無 GPU | 看實際結構與特徵維度，不只看演算法名稱 |
| 記憶體及儲存 | 共享行程取樣 RSS 不超過 512 MiB；序列化成果不超過 32 KiB | 看五輪最差值；兩者不可互相代替 |
| 延遲與訓練 | 單筆端到端 predict 的 p95 不超過 5 ms；每輪搜尋不超過 5 秒 | 同設備單執行緒，包含文字向量化 |

#### 三候選的效能（補充）

這裡取上節三條路線各用 1000 筆的結果。朴素貝氏沿用詞級特徵，alpha 只試 0.1、1、10，以相同驗證規則選參數，並共用每輪的訓練索引。

此處 1000 筆是**單輪使用上限**，不是全專案總標註預算：五輪共需 1935 筆不同訓練標註。若專案總共只能取得 1000 筆，三候選的這個五輪設計全都不符合，不能沿用下方選型結論。資源 JSON 的 `train_labels_max=1000` 亦按這個每輪定義解讀。

| 1000 筆候選 | 驗證／測試 macro-F1 | 測試 Accuracy／優先類 Recall |
|---|---|---|
| 詞級 TF-IDF＋邏輯迴歸 | 0.8774／0.8740 | 0.8740／0.8780 |
| 字元 TF-IDF＋線性 SVM | 0.8759／0.8707 | 0.8707／0.8740 |
| 詞級 TF-IDF＋多項式朴素貝氏 | 0.8795／0.8753 | 0.8753／0.8787 |

1000 筆時，詞級路線在客服／製造的平均 F1 為 0.8940／0.8540，字元路線為 0.8947／0.8467。混合分數會掩蓋領域差異；若要求各領域都達標，須另訂門檻。

這是五輪平均，0.001 等級差距不能直接當成顯著優勢。macro-F1 看兩類的平衡，Recall 看是否漏掉優先訊息；若改求高召回，須用驗證資料重訂門檻及誤判代價。

#### 結構、解釋與資源（補充）

| 候選 | 特徵與複雜度 | 解釋需求的判斷 |
|---|---|---|
| 詞級＋邏輯迴歸 | 約 798 個詞／雙詞特徵；一組線性係數 | 能列出完整詞組的加分或扣分；相關特徵會影響係數解讀 |
| 字元＋線性 SVM | 約 2222 個字元片段；一組線性係數 | 能解釋片段權重，卻不直接滿足本例完整詞組要求 |
| 詞級＋朴素貝氏 | 約 798 個詞／雙詞特徵；兩類條件機率 | 可列出詞的類別傾向；獨立性假設可能失真 |

下表採五輪最差觀測值。成果大小是 pickle protocol 5 的完整 pipeline；RSS 是同一量測行程每 5 ms 取樣，含函式庫與之前配置，並非隔離後單模型記憶體需求。

| 候選 | 成果 KiB／行程 RSS MiB | 單筆 p95 ms／搜尋秒 |
|---|---|---|
| 詞級 TF-IDF＋邏輯迴歸 | 30.0／170.9 | 1.21／0.082 |
| 字元 TF-IDF＋線性 SVM | 67.6／174.2 | 1.29／0.277 |
| 詞級 TF-IDF＋多項式朴素貝氏 | 48.6／170.9 | 0.99／0.081 |

單筆預測含向量化與分類，暖身 20 筆後，量固定測試的前 100 筆取 p95。重跑的時間、RSS 與延遲會變，不能用模型檔大小推算記憶體。

量測環境是 Windows 11，CPU 為 Intel Family 6 Model 151（24 個邏輯核心）。Python 3.12.13、scikit-learn 1.9.1，BLAS 單執行緒且無 GPU。

先讓詞級＋邏輯迴歸進入隔離部署驗收：效能足夠、完整詞特徵符合解釋要求且成果最小。朴素貝氏雖略高分，卻超過 32 KiB；字元 SVM 也超標，解釋單位亦不符。

共享行程量測不能保證部署達標，須在目標容器量冷啟動、真正記憶體尖峰、併發與含網路的服務延遲。放寬儲存或改用不同文字分布後，應重新比較。

需求與數值另存於 `content/examples/L23303-M4-C-candidate-resources.json`，供重算核對。

來源：[scikit-learn 多指標選模教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_digits.html)、[文字分類與計算資源比較](https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html)及本批合成實測；需求門檻由本例自行設定。


## 程式

前三段沿用同一個 Python 執行環境，依序執行以共用 NumPy。後兩段各自列出匯入與 JSON 載入；完整 135 次 fit 與新 run 的獨立入口見 [M4-C README](https://github.com/polluxyz/ipas-study/blob/main/content/examples/L23303-M4-C-README.md)。

### 從同批品檢分數算到成本（補充）

下列標籤及分數完整對應專用製造資料 JSON。成本與收益公式都使用剛算出的四格，不從表格複製結果。

```python
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, confusion_matrix
y = [1]*4 + [0]*16
a = [.95,.85,.70,.40,.65,.55,.45,.35,.30,.28,
     .25,.22,.20,.18,.15,.12,.10,.08,.05,.02]
b = [.90,.80,.60,.50,.85,.75,.70,.65,.30,.28,
     .25,.22,.20,.18,.15,.12,.10,.08,.05,.02]
for name, scores in [("A", a), ("B", b)]:
    pred = np.array(scores) >= 0.5
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0,1]).ravel()
    print(f"{name}: TP/FP/FN/TN={tp}/{fp}/{fn}/{tn}")
    print(f"Acc={accuracy_score(y,pred):.3f}, F1={f1_score(y,pred):.3f}, AUC={roc_auc_score(y,scores):.3f}")
    print(f"成本={50*fp+1000*fn}, 淨收益={500*tp-50*(tp+fp)}")
```
```text
A: TP/FP/FN/TN=3/2/1/14
Acc=0.850, F1=0.667, AUC=0.953
成本=1100, 淨收益=1250
B: TP/FP/FN/TN=4/4/0/12
Acc=0.800, F1=0.667, AUC=0.859
成本=200, 淨收益=1600
```

### 重算迴歸比較（補充）

```python
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
actual = np.array([10,20,30,40,50,60,70,100])
reg_a = [11,19,31,39,51,59,71,80]
reg_b = actual - 4
for name, pred in [("A", reg_a), ("B", reg_b)]:
    mae = mean_absolute_error(actual, pred)
    rmse = np.sqrt(mean_squared_error(actual, pred))
    print(f"{name}: MAE={mae:.3f}, RMSE={rmse:.3f}, R2={r2_score(actual,pred):.3f}")
```
```text
A: MAE=3.375, RMSE=7.133, R2=0.932
B: MAE=4.000, RMSE=4.000, R2=0.978
```

### 重算多輪摘要（補充）

```python
v = np.array([[.72,.78],[.76,.79],[.80,.80],[.84,.81],[.88,.82]])
for k, name in enumerate(["A", "B"]):
    print(f"{name}: mean={v[:,k].mean():.3f}, std={v[:,k].std(ddof=0):.5f}")
    print("Q1/中位/Q3：", np.percentile(v[:,k], [25,50,75], method="linear").tolist())
ranks = np.empty_like(v)
for j, (left, right) in enumerate(v):
    ranks[j] = [1.5,1.5] if left == right else ([1,2] if left > right else [2,1])
print("A各輪名次：", ranks[:,0].tolist())
print("B各輪名次：", ranks[:,1].tolist())
print("平均名次：", ranks.mean(axis=0).tolist())
```
```text
A: mean=0.800, std=0.05657
Q1/中位/Q3： [0.76, 0.8, 0.84]
B: mean=0.800, std=0.01414
Q1/中位/Q3： [0.79, 0.8, 0.81]
A各輪名次： [2.0, 2.0, 1.5, 1.0, 1.0]
B各輪名次： [1.0, 1.0, 1.5, 2.0, 2.0]
平均名次： [1.5, 1.5]
```

:::tip[讀碼重點]
`ddof=0` 明定描述性標準差的分母；`method="linear"` 明定四分位數算法。排名是每輪內比較，不能先把兩欄各自排序後再配對。
:::

### 重算資料效率的配對分數（補充）

下面從 JSON 的逐筆預測重算 F1，需把 IPAS_REPO_ROOT 指向專案根目錄。它核對實測輸出，沒有重新訓練；同檔保存切分、參數與預測，可供另行重訓。

```python
import os, json
import numpy as np
from pathlib import Path
from sklearn.metrics import f1_score
root = Path(os.environ["IPAS_REPO_ROOT"])
data = json.loads((root / "content/examples/L23303-M4-C-label-efficiency.json").read_text(encoding="utf-8"))
truth = [data["records"][i]["label"] for i in data["base_split"]["test"]]
for n in [2000, 1000, 200]:
    means = []
    for route in ["word-lr", "char-svm", "word-nb"]:
        runs = [r for r in data["runs"] if r["n"] == n and r["route"] == route]
        scores = [f1_score(truth, r["test_predictions"], average="macro", labels=[0,1], zero_division=0) for r in runs]
        means.append(f"{np.mean(scores):.4f}±{np.std(scores, ddof=0):.4f}")
    print(n, *means)
```
```text
2000 0.8767±0.0000 0.8767±0.0000 0.8767±0.0000
1000 0.8740±0.0029 0.8707±0.0039 0.8753±0.0012
200 0.8000±0.0291 0.7929±0.0243 0.8380±0.0169
```

### 重訓一輪 NLP 路線（補充）

下段重新載入相同 JSON，重訓 n=1000、種子 11 的兩路線。所需 np、data、f1_score 都在本段建立，不依賴前段變數；IPAS_REPO_ROOT 仍須指向 repo 根目錄。資料索引、三個 C 與驗證選參數都明寫；各路線用原生 predict，不用測試選模型。NB 與全部條件的重訓在 README。

```python
import os, json
import numpy as np
from pathlib import Path
from sklearn.metrics import f1_score
from sklearn.pipeline import make_pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from threadpoolctl import threadpool_limits
root = Path(os.environ["IPAS_REPO_ROOT"])
data = json.loads((root / "content/examples/L23303-M4-C-label-efficiency.json").read_text(encoding="utf-8"))
ids = data["subsets"]["11"]["1000"]
texts = [r["text"] for r in data["records"]]; labels = np.array([r["label"] for r in data["records"]])
val_ids = data["base_split"]["val"]; test_ids = data["base_split"]["test"]
with threadpool_limits(limits=1):
    for route in ["word-lr", "char-svm"]:
        trials = []
        for c in [0.1, 1., 10.]:
            vector = TfidfVectorizer(tokenizer=str.split, token_pattern=None, ngram_range=(1,2)) if route == "word-lr" else TfidfVectorizer(analyzer="char", ngram_range=(2,4))
            model = LogisticRegression(C=c, solver="liblinear", max_iter=1000, random_state=11) if route == "word-lr" else LinearSVC(C=c, dual=False, max_iter=2000, random_state=11)
            pipe = make_pipeline(vector, model).fit([texts[i] for i in ids], labels[ids])
            score = f1_score(labels[val_ids], pipe.predict([texts[i] for i in val_ids]), average="macro", labels=[0,1], zero_division=0)
            trials.append((score, c, pipe))
        best_val, c, pipe = max(trials, key=lambda row: row[0])
        test = f1_score(labels[test_ids], pipe.predict([texts[i] for i in test_ids]), average="macro", labels=[0,1], zero_division=0)
        print(f"{route} C={c:.1f} val={best_val:.6f} test={test:.6f}")
```
```text
word-lr C=1.0 val=0.874950 test=0.871663
char-svm C=0.1 val=0.877462 test=0.873332
```

:::tip[讀碼重點]
三個 C 各自重建整條 pipeline，詞彙表與 IDF 不會碰到驗證或測試資料。`max` 只看驗證分數，同分保留先出現的參數；完整兩路線控制流程保留在同一段，供逐步核對。
:::

## 怎麼用、怎麼判讀

### 箱型圖與平均排名圖

箱型圖呈現各輪分數分布，平均排名圖則呈現各輪相對先後。前者看波動與分數範圍，後者讓不同模型的勝負次序容易比較。

:::supplement[來源：NumPy：percentile；SciPy：rankdata；Demšar 2006 §3.2.2]
本頁箱體下緣、中央線、上緣分別是第 25、50、75 百分位，記為 Q1、中位數、Q3。四分位距 IQR 是 Q3−Q1；鬚延伸至 1.5 IQR 內最外的觀察值。

前述 A／B 五輪配對驗證中，模型 A 的箱體為 0.76～0.84，模型 B 為 0.79～0.81；中位數都是 0.80，模型 B 的分數比較集中。

本例兩模型都沒有超出鬚界線的離群點，因此鬚恰好延伸到最小與最大值；其他資料不一定如此。

每輪由高分到低分排第 1、2 名，同分就各取平均名次 1.5，再跨輪平均：

$$
\bar r=\frac{1}{m}\sum_{j=1}^{m}r_j
$$

$r_j$ 是該模型第 $j$ 輪的名次，$m=5$。模型 A 為 $(2+2+1.5+1+1)/5=1.5$，模型 B 也為 1.5；平均排名相同不代表每輪分數相同。

[Demšar 2006，§3.2.2、印刷第 11 頁](https://jmlr.org/papers/volume7/demsar06a/demsar06a.pdf)直接列出平均名次為各次名次加總除以次數，並規定最佳排 1、同分平均。原論文跨多個資料集作檢定；本頁相依的五輪只借用描述排名，不套用其 Friedman／Nemenyi 顯著性結論。
:::

![兩模型平均 F1 相同，模型 B 箱體較窄；平均名次同為 1.5，圖不提供顯著性結論](figure:l23303-model-comparison-box-rank)

:::supplement[來源：scikit-learn User Guide：Cross-validation；Statistical comparison of models using grid search]
交叉驗證的訓練資料互相重疊，多輪分數並非獨立樣本。較小標準差只支持「這幾輪比較集中」，不能直接用標準差除以根號輪數就宣稱顯著勝出。

若要進一步做統計比較，可參考 Nadeau 與 Bengio 的修正 t 檢定；使用前仍須確認驗證設計與假設適合，不能直接套在任意五個分數上。

用這些驗證結果選候選方案後，仍需保留最終測試資料；否則比較過的模型愈多，愈容易選到碰巧適合驗證資料的方案。
:::

### 換個場景

| 場景或資料條件 | 指標與比較方式 | 看見什麼取捨 |
|---|---|---|
| 醫療等高風險任務 | 誤判成本矩陣 | 漏診和誤報的代價不同 |
| 推薦、行銷任務 | NDCG 與 Profit Score | 排序品質與實際收益分開判斷 |
| 小樣本或高變異任務 | 多輪交叉驗證與分布圖 | 少量資料下單次高分可能不穩 |
| 製造品檢（補充） | 四格、F1、漏放成本 | 少誤攔與少漏放的取捨 |
| 網店出貨量（補充） | MAE、RMSE、R² 與殘差 | 日常小偏差與少數大低估的取捨 |

### 排序與收益分開量（補充）

NDCG 用相關度增益、名次折扣及理想排序基準評估清單，詳細公式、同分與零分母情況見 NDCG 頁。它不會自動把點擊換成收入。

Profit Score 則必須先定義收益與成本。本頁已示範一個具體淨收益式，換到行銷時，優惠金額、轉換收入及原本就會購買者的影響都需重新界定。

## 常見誤解

:::supplement[來源：scikit-learn User Guide：Cross-validation；Post-tuning the decision threshold for cost-sensitive learning]
- **F1 一樣代表模型等價**：前例 F1 相同，漏放與誤報組合仍不同。
- **ROC-AUC 高就應直接上線**：排序不包含成本，也不能證明真實使用下的業務成效。
- **五輪平均較高就證明顯著較好**：還須考慮波動、相依性與選模流程。
- **收益指標有固定通式**：必須明定收益成本及適用期間，不能套用別人的金額。
:::

## 進階

### 離線評估與線上確認

科目 1 指引 5-20 要求同時追蹤技術與業務指標，5-21 提及金絲雀部署以降低更新風險。因此離線比較之後，仍需要確認真實使用情境的表現。

:::supplement[來源：Google：Rules of Machine Learning；Microsoft Learn：Safe rollout for online endpoints]
例如推薦模型離線排序改善後，可用有限流量觀察點擊、轉換及服務延遲。影子模式不改變使用者看到的清單，無法直接量出新清單的購買效果；金絲雀擴量也不等於已完成因果比較。

觀察到業務指標變動時，還要確認流量族群、期間及外部活動是否相近，不能只把所有變化歸因於模型。
:::

### 參考來源

- 學習指引科目 3，5-24～5-26；科目 1，5-20～5-21（支持：多指標組合、業務成本、多輪視覺化、換個場景及雙軌評估）。
- [scikit-learn：成本敏感決策教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html)（支持：矩陣加總算法與自訂收益的方法；不直接提供本頁一般四項式或 500／50 元精確式）。
- 學習指引科目 3，5-11 起；科目 1，5-2（支持：按任務、資料及資源選型）。
- [scikit-learn：文字分類與計算資源比較](https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html)、[F1 API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html)（支持：比較設計與 macro-F1，非本例合成實測的原始資料）。
- [scikit-learn：Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)、[Logistic regression](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression)（支持：先驗與條件模型、鑑別式條件機率模型）。
- [scikit-learn：多指標選模教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_digits.html)（支持：固定評估規則、多指標取捨）。
- [scikit-learn：交叉驗證](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：公平比較、相依性與保留測試資料）。
- [Google 機器學習速成課程：資料集切分](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)（支持：固定評估條件，避免反覆以測試集選模）。
- [scikit-learn：模型評估指標](https://scikit-learn.org/stable/modules/model_evaluation.html)（支持：迴歸比較與 R² 的限制校正）。
- [scikit-learn：r2_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.r2_score.html)（支持：R² 定義、常數基準與負值的解讀）。
- [scikit-learn：模型統計比較教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_stats.html)（支持：交叉驗證相依性與修正 t 檢定的選讀方向）。
- [NumPy：mean](https://numpy.org/doc/stable/reference/generated/numpy.mean.html)、[std](https://numpy.org/doc/stable/reference/generated/numpy.std.html)、[percentile](https://numpy.org/doc/stable/reference/generated/numpy.percentile.html)（支持：平均、描述性標準差與四分位數）。
- [SciPy：rankdata](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.rankdata.html)（支持：同分取平均名次）；[Demšar 2006 §3.2.2，p.11](https://jmlr.org/papers/volume7/demsar06a/demsar06a.pdf)（直接支持跨次平均排名式；本頁只作描述）。
- [Google：Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)（支持：離線指標與實際產品成效的差異）。
- [Microsoft Learn：安全釋出線上端點](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-safely-rollout-online-endpoints?view=azureml-api-2)（支持：小流量驗證與影子流量的限制）。

## 小結

- 同一批資料上並列多項指標，才能看到錯誤型態與任務風險。
- 成本矩陣與收益指標先定義業務假設，再由四格件數計算。
- 多輪驗證同時看平均、波動及相對名次，不只挑最好的一輪。
- 配對與保留測試集是公平比較的前提；分布圖不能單獨證明顯著差異。（補充）
