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
    text: 在相同評估條件下，綜合分類與迴歸指標判斷模型取捨
  - id: g2
    text: 由四格計數算出誤判成本與自訂淨收益，說明業務假設
  - id: g3
    text: 算出配對多輪驗證的平均與波動，判讀箱型圖及平均排名圖
formula_groups:
  - id: total-cost
    source: https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: custom-profit
    source: https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: mean-spread
    source: https://numpy.org/doc/stable/reference/generated/numpy.std.html
    status: verified
    checked_by: ctx_ce650b18e31c
  - id: mean-rank
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.rankdata.html
    status: verified
    checked_by: ctx_ce650b18e31c
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
    options: { A: '200 元', B: '400 元', C: '4000 元', D: '4200 元' }
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

### 收益指標必須先定義（補充）

指引提及 Profit Score，但它沒有一個放諸各業皆準的公式。另訂一個收益方案：每攔到一件瑕疵回收 500 元價值，每次攔檢花 50 元；未攔到與放行良品的收益設零。

$$
\Pi=500\mathrm{TP}-50(\mathrm{TP}+\mathrm{FP})
$$

$\Pi$ 是本例淨收益，單位為元；$\mathrm{TP}+\mathrm{FP}$ 是全部攔檢件數。模型 A 得 $500\times3-50\times(3+2)=1250$ 元。

這個收益方案與上一個誤判成本方案是兩個獨立假設，不可相加後重複計入損失。預期收益、成本及評估期間都需先由業務定義。

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

:::supplement[來源：NumPy：std]
$$
\bar s=\frac{1}{m}\sum_{j=1}^{m}s_j,\qquad
\sigma_{\mathrm{desc}}=\sqrt{\frac{1}{m}\sum_{j=1}^{m}(s_j-\bar s)^2}
$$

$s_j$ 是第 $j$ 輪分數，$m$ 是輪數；$\sigma_{\mathrm{desc}}$ 是本頁用分母 $m$ 的描述性標準差，不是以 $m-1$ 估計的樣本標準差。

兩者平均皆為 4/5=0.80。A 的離均差平方和為 0.016，除以 5 再開根號得 0.05657；B 為 0.001，依樣計算得 0.01414。
:::

## 程式

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

## 怎麼用、怎麼判讀

### 箱型圖與平均排名圖

箱型圖呈現各輪分數分布，平均排名圖則呈現各輪相對先後。前者看波動與分數範圍，後者讓不同模型的勝負次序容易比較。

:::supplement[來源：NumPy：percentile；SciPy：rankdata]
本頁箱體下緣、中央線、上緣分別是第 25、50、75 百分位，記為 Q1、中位數、Q3。四分位距 IQR 是 Q3−Q1；鬚延伸至 1.5 IQR 內最外的觀察值。

模型 A 的箱體為 0.76～0.84，模型 B 為 0.79～0.81；中位數都是 0.80，模型 B 的分數比較集中。

本例兩模型都沒有超出鬚界線的離群點，因此鬚恰好延伸到最小與最大值；其他資料不一定如此。

每輪由高分到低分排第 1、2 名，同分就各取平均名次 1.5，再跨輪平均：

$$
\bar r=\frac{1}{m}\sum_{j=1}^{m}r_j
$$

$r_j$ 是該模型第 $j$ 輪的名次，$m=5$。模型 A 為 $(2+2+1.5+1+1)/5=1.5$，模型 B 也為 1.5；平均排名相同不代表每輪分數相同。
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

### 固定資料才能看資料效率（補充）

若研究標註資料不足的影響，可讓兩模型分別在相同的 100%、50%、20% 訓練子集比較。評估資料保持固定，訓練預算及選模規則也保持一致，才較能辨認資料利用效率。

### 離線評估與線上確認

科目 1 指引 5-20 要求同時追蹤技術與業務指標，5-21 提及金絲雀部署以降低更新風險。因此離線比較之後，仍需要確認真實使用情境的表現。

:::supplement[來源：Google：Rules of Machine Learning；Microsoft Learn：Safe rollout for online endpoints]
例如推薦模型離線排序改善後，可用有限流量觀察點擊、轉換及服務延遲。影子模式不改變使用者看到的清單，無法直接量出新清單的購買效果；金絲雀擴量也不等於已完成因果比較。

觀察到業務指標變動時，還要確認流量族群、期間及外部活動是否相近，不能只把所有變化歸因於模型。
:::

### 參考來源

- 學習指引科目 3，5-24～5-26；科目 1，5-20～5-21（支持：多指標組合、業務成本、多輪視覺化、換個場景及雙軌評估）。
- [scikit-learn：成本敏感決策教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_cost_sensitive_learning.html)（支持：總成本、業務自訂收益及分類算例）。
- [scikit-learn：多指標選模教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_digits.html)（支持：固定評估規則、多指標取捨）。
- [scikit-learn：交叉驗證](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：公平比較、相依性與保留測試資料）。
- [Google 機器學習速成課程：資料集切分](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)（支持：固定評估條件，避免反覆以測試集選模）。
- [scikit-learn：模型評估指標](https://scikit-learn.org/stable/modules/model_evaluation.html)（支持：迴歸比較與 R² 的限制校正）。
- [scikit-learn：r2_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.r2_score.html)（支持：R² 定義、常數基準與負值的解讀）。
- [scikit-learn：模型統計比較教學](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_stats.html)（支持：交叉驗證相依性與修正 t 檢定的選讀方向）。
- [NumPy：std](https://numpy.org/doc/stable/reference/generated/numpy.std.html)、[percentile](https://numpy.org/doc/stable/reference/generated/numpy.percentile.html)（支持：描述性標準差、四分位數與程式）。
- [SciPy：rankdata](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.rankdata.html)（支持：同分名次與平均排名）。
- [Google：Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml)（支持：離線指標與實際產品成效的差異）。
- [Microsoft Learn：安全釋出線上端點](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-safely-rollout-online-endpoints?view=azureml-api-2)（支持：小流量驗證與影子流量的限制）。

## 小結

- 同一批資料上並列多項指標，才能看到錯誤型態與任務風險。
- 成本矩陣與收益指標先定義業務假設，再由四格件數計算。
- 多輪驗證同時看平均、波動及相對名次，不只挑最好的一輪。
- 配對與保留測試集是公平比較的前提；分布圖不能單獨證明顯著差異。（補充）
