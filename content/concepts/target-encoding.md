---
id: target-encoding
title: Target Encoding 與折外統計
kind: technique
codes: [L23301]
aliases: [Mean Encoding, Out-of-fold Encoding, Target Encoding]
is_a: [categorical-encoding]
requires: [categorical-encoding, data-leakage, k-fold-cross-validation]
summary: 用類別的標籤統計壓縮表示，訓練列必須由其他摺提供統計
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-8]
goals:
  - id: g1
    text: 計算類別頻數與轉換率，解釋高基數時和獨熱欄數的差異
  - id: g2
    text: 區分外層評估與內層摺外估計，計算平滑並設定稀有及未知類回退
formula_groups:
  - id: category-mean
    source: https://scikit-learn.org/stable/modules/preprocessing.html#target-encoder
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
  - id: smoothing
    source: https://scikit-learn.org/stable/modules/preprocessing.html#target-encoder
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 20筆零售訓練曝光共8次轉換，其中小站只有1筆且轉換。以α=2把類別平均拉向整體平均，小站平滑值是多少？
    options:
      A: "0.4"
      B: "0.8"
      C: "1.0"
      D: "0.6"
    answer: D
    explain:
      A: 0.4是整體8/20的先驗，完全忽略了小站已有的1筆資料。
      B: 0.8只取α乘先驗，未加入類別成功數並除以總權重。
      C: 1.0是小站未平滑平均，尚未加入先驗的收縮。
      D: (1+2×0.4)/(1+2)=0.6，但這份全訓練統計不能拿來編碼小站自己的訓練列。
  - id: c2
    goal: g2
    type: choice
    prompt: 資料先固定20筆訓練、8筆驗證；訓練內再分4摺。哪個安排可避免每列標籤回流到自己的目標編碼？
    options:
      A: 先以全部28筆估計編碼，再留8筆計分並用20筆訓練模型
      B: 先以其餘15筆編留出5筆，再用全20筆的表轉換8筆驗證
      C: 先以全部20筆編訓練20筆，再用8筆驗證自己的表做轉換
      D: 先以留出5筆編其餘15筆，再把8筆驗證標籤補入編碼表
    answer: B
    explain:
      A: 全部28筆包含驗證標籤，外層評估已洩漏。
      B: 每筆訓練特徵由其他摺估計，驗證只用外層訓練統計，兩層界線都保留。
      C: 訓練列參與自己的平均，而且驗證標籤也不應用於轉換。
      D: 內層方向顛倒，補入驗證標籤又破壞外層評估。
  - id: c3
    goal: g2
    type: choice
    prompt: 第4內摺留出小站唯一1筆；其他15筆有5次轉換且完全沒見過小站。此輪小站回退值應用哪個？
    options:
      A: "其餘摺先驗：5/15≈0.333"
      B: "全訓練先驗：8/20=0.400"
      C: "小站自身平均：1/1=1.000"
      D: "合併自身先驗：6/16=0.375"
    answer: A
    explain:
      A: 未知類必須回退到本輪來源15筆的先驗，不能讀留出摺標籤。
      B: 全訓練先驗包含本輪留出5筆的標籤，不是嚴格摺外估計。
      C: 留出小站自己的標籤不可用，否則唯一類別會直接暴露答案。
      D: 加回小站自身標籤仍然有自我洩漏。
  - id: c4
    goal: g1
    type: choice
    prompt: 單一廣告欄有5,000類，標籤為是否購買的二元值，採每類一個平均值。相比完整獨熱，其輸出欄數為何？
    options:
      A: 獨熱1欄、平均5000欄；兩者都不需要讀取標籤
      B: 獨熱5000欄、平均2欄；兩者都不需要讀取標籤
      C: 獨熱5000欄、平均1欄；平均編碼需要讀取標籤
      D: 獨熱1欄、平均2欄；平均編碼需要讀取標籤
    answer: C
    explain:
      A: 欄數方向顛倒，而且平均編碼須用標籤估計。
      B: 本題每類只用一個二元標籤平均，輸出不是兩欄。
      C: 完整獨熱每類一欄，二元平均編碼每原始特徵一欄，但需要安全估計。
      D: 完整獨熱不是1欄，本題指定的平均表示也不是兩欄。
---

## 為什麼需要

廣告來源可能有數千類，完整獨熱會產生數千欄。若來源與購買有關，可以改用各來源的歷史轉換率，讓模型收到少量且帶目標資訊的數值。

目標編碼（Target Encoding，也稱平均編碼）以類別的標籤統計取代身分。指引也列出均值、中位數等統計；本頁聚焦二元標籤平均，也就是轉換率。

## 直覺

獨熱回答「這是哪個來源」，目標編碼回答「這個來源在可用資料裡，通常有多少轉換」。類別很多且和目標有關時，可用一欄摘要這種關係。

## 定義與公式

### 類別頻數與平均（補充）

$$
n_c=\sum_{i\in S}\mathbf{1}[x_i=c],\qquad
\bar y_c=\frac{\sum_{i\in S:x_i=c}y_i}{n_c},\qquad
\mu_S=\frac{1}{|S|}\sum_{i\in S}y_i
$$

$S$是本次可用的來源列，$x_i$是廣告來源，$y_i$為購買標籤0或1，$c$是一個類別。$n_c$是類別頻數，$\bar y_c$是轉換率，$\mu_S$是來源列整體轉換率。

$S$不可為空；$n_c=0$時類別平均未定義，須回退到$\mu_S$。內層留出一摺時，連整體平均也只能由其餘摺計算。

### 平滑：少量資料往先驗靠（補充）

$$
\tilde y_c=\frac{n_c\bar y_c+\alpha\mu_S}{n_c+\alpha}
$$

$\tilde y_c$是平滑編碼，$\alpha>0$是先驗的權重。類別筆數越少，越靠近整體平均；本頁固定$\alpha=2$，不代表所有問題都該用2。

未知類別直接回退$\mu_S$，避免計算未定義的類別平均。平滑減少稀有類的波動，但不能取代摺外估計。

## 算一次

### 廣告來源的轉換率

共用JSON零售訓練索引0–19，共20筆、8次轉換。先列完整訓練統計，這張表可供外層驗證與未來推論使用。

| 廣告來源 | 次數 | 轉換次數 | 類別平均 |
|---|---:|---:|---:|
| 搜尋 | 8 | 4 | 0.500 |
| 社群 | 6 | 2 | 0.333 |
| 郵件 | 5 | 1 | 0.200 |
| 小站 | 1 | 1 | 1.000 |

類別4種，完整獨熱需要4欄；本頁的二元平均表示只需1欄。若增加到5,000種來源，完整獨熱為5,000欄，同樣的平均表示仍為1欄。

### 平滑與未知類（補充）

訓練先驗8÷20=0.4。搜尋平滑值為(4+2×0.4)/(8+2)=0.48；小站為(1+2×0.4)/(1+2)=0.6。

驗證的新平台完全未見過，回退0.4。這份全20筆統計適合編驗證列；不能把小站0.6拿來編碼產生這個統計的小站訓練列。

### 外層評估、內層交叉擬合（補充）

小站只有一筆、剛好購買，平均就是1。若把這個1回填同一筆訓練輸入，模型就收到由它自己答案產生的提示；類別越稀有，這個問題越嚴重。

外層先分訓練20筆與驗證8筆，驗證標籤封存。內層交叉擬合（Cross-fitting）再把20筆分4組，每輪只用其他15筆估計，編碼本輪留出的5筆。

![外層8筆驗證不參與估計；內層每筆訓練特徵由其他15筆的標籤統計提供。](figure:l23301-target-encoding-cross-fitting)

| 內摺 | 留出的索引 | 統計來源 | 留出用途 |
|---|---|---|---|
| 1 | 0、4、8、12、16 | 其餘15筆 | 只產生這5筆特徵 |
| 2 | 1、5、9、13、17 | 其餘15筆 | 只產生這5筆特徵 |
| 3 | 2、6、10、14、18 | 其餘15筆 | 只產生這5筆特徵 |
| 4 | 3、7、11、15、19 | 其餘15筆 | 只產生這5筆特徵 |

例如R01在第1摺，來源15筆有5次轉換，先驗1/3。來源中的搜尋有6筆、3次轉換，R01摺外值為(3+2×1/3)/(6+2)=11/24≈0.458333。

R20是小站唯一一筆，在第4摺被留出。來源15筆有5次轉換，完全沒見過小站，所以其摺外值為1/3；不能取自身1.0，也不能用全訓練平滑值0.6。

拼回20筆摺外特徵，搭配訓練標籤訓練模型。另以全20筆建立最終編碼表，轉換8筆驗證後預測，最後才用驗證標籤計分；模型訓練用的是摺外特徵，不是全訓練表的自我編碼。

## 程式（補充）

### 編碼函式只接受指定來源列

下列來源與標籤逐筆對應共用零售JSON。此段先印可供驗證使用的全訓練編碼表；下一段才建立模型訓練所需的摺外特徵。

```python
import numpy as np
ads = np.array(["搜尋"] * 8 + ["社群"] * 6 + ["郵件"] * 5 + ["小站"])
y = np.array([1,1,0,1,0,1,0,0, 1,0,0,0,1,0, 0,1,0,0,0, 1])
def encode(source, values, alpha=2):
    prior = y[source].mean()
    table = {}
    for c in np.unique(ads[source]):
        selected = source[ads[source] == c]
        table[c] = (y[selected].sum() + alpha * prior) / (len(selected) + alpha)
    return np.array([table.get(c, prior) for c in values])
all_train = np.arange(20)
print("全訓練先驗:", y.mean().item())
print("平滑與未知:", np.round(encode(all_train, ["搜尋", "小站", "新平台"]), 6).tolist())
```
```text
全訓練先驗: 0.4
平滑與未知: [0.48, 0.6, 0.4]
```

### 固定4摺建立摺外特徵

```python
oof = np.empty(20)
for k in range(4):
    held = np.arange(k, 20, 4)
    source = np.setdiff1d(all_train, held)
    oof[held] = encode(source, ads[held])
    print("摺", k + 1, "來源/留出:", len(source), len(held))
print("R01摺外:", round(float(oof[0]), 6))
print("R20摺外:", round(float(oof[19]), 6))
valid = encode(all_train, ["新平台", "搜尋"])
print("驗證前2筆:", np.round(valid, 6).tolist())
```
```text
摺 1 來源/留出: 15 5
摺 2 來源/留出: 15 5
摺 3 來源/留出: 15 5
摺 4 來源/留出: 15 5
R01摺外: 0.458333
R20摺外: 0.333333
驗證前2筆: [0.4, 0.48]
```

:::tip[讀碼重點]
`prior`與類別平均都從`source`算，不從全資料偷取。模型訓練用`oof`；全訓練表只轉換驗證或未來列。本段只產生特徵，尚未量測模型成效。
:::

## 怎麼用、怎麼判讀

高基數且類別與標籤有關時，目標編碼能避免獨熱維度膨脹。數字是歷史統計摘要，不是類別本身的真實高低，更不是因果效果。

:::supplement[來源：scikit-learn TargetEncoder；Target Encoder’s Internal Cross fitting]
scikit-learn的`fit_transform(X, y)`會做內部交叉擬合；`fit(X, y).transform(X)`不會。

外層交叉驗證每輪也要重做內層估計。若先算全資料摺外值再切外層，來源摺可能包含外層驗證標籤。
:::

### 換個場景

| 場景／資料條件 | 統計表示 | 判讀重點 |
|---|---|---|
| 廣告來源與轉換率 | 各來源的標籤平均 | 類別多且與目標相關 |
| 高基數類別特徵 | 均值等統計摘要 | 維度與過擬合一起評估 |
| 交通路線（補充） | 延誤率 | 東線2/8，山線只有1/1 |
| 製造供應商（補充） | 歷史瑕疵率 | 稀有供應商需平滑，未知回退 |

:::supplement[來源：scikit-learn Common pitfalls；Target Encoder’s Internal Cross fitting]
交通先驗9/20=0.45，東線平滑值(2+2×0.45)/(8+2)=0.29，未知環線回退0.45。

若旅客、供應商或使用者跨列重複，或要預測未來，內外切分都需配合群組或時間限制。
:::

## 常見誤解

- **欄數少就沒有過擬合。** 稀有類的平均可能幾乎等於自身答案。（補充）
- **有平滑就不必摺外。** 平滑降低波動，仍可能保留自身標籤的影響。（補充）
- **先算全資料摺外值就能任意做外層驗證。** 內層來源可能含外層驗證標籤，必須每輪重建。（補充）
- **未知類與稀有類相同。** 前者在本輪來源沒有樣本，後者有少量樣本；回退與平滑角色不同。（補充）

## 進階

### 不只一種目標（補充）

本頁「一欄」限定二元平均或單一連續目標。多類分類可能對每個類別估計條件機率，產生多個輸出欄；不能把本頁欄數直接套到所有TargetEncoder設定。

### 參考來源

- 科目3指引5.1，`guide-3:5-8`：高基數、廣告來源轉換率、統計摘要與維度用途。
- [Preprocessing：Target encoder](https://scikit-learn.org/stable/modules/preprocessing.html#target-encoder)：類別平均、先驗與平滑公式。
- [TargetEncoder](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.TargetEncoder.html)：未知值、內部交叉擬合及多類輸出欄數。
- [內部交叉擬合教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder_cross_val.html)：稀有類自我洩漏、內外層圖與摺外流程的教學思路。
- [不同編碼器比較教學](https://scikit-learn.org/stable/auto_examples/preprocessing/plot_target_encoder.html)：高基數編碼與模型選擇的取捨。
- [Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：外層評估隔離與前處理的估計邊界。

## 小結

- 目標編碼用標籤統計摘要類別，適合比較高基數且有目標關聯的欄位。
- 平滑讓稀有類靠向來源先驗，未知類直接回退先驗。（補充）
- 訓練列由其他摺編碼，外層驗證不提供統計。（補充）
- 最終編碼表用全訓練資料建立，轉換未見資料時不讀其標籤。（補充）
