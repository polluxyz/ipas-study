---
id: information-gain
title: 資訊增益
kind: metric
codes: [L23202, L21301]
aliases: [Information Gain]
requires: [conditional-probability]
summary: 資訊增益用分割前後的加權熵差，衡量特徵或條件減少多少不確定性
goals:
  - id: g1
    text: 用有用與無用的切分說明資訊增益如何篩選有辨識力的特徵
  - id: g2
    text: 計算父子加權熵與增益排名，辨識高基數偏好及適用限制
formula_groups:
  - id: label-entropy
    source: https://developers.google.com/machine-learning/decision-forests/binary-classification
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: information-gain
    source: https://developers.google.com/machine-learning/decision-forests/binary-classification
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
guide_refs: [guide-1:5-5, guide-3:4-31]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同6筆金融資料，切分甲讓左右兩群仍各半違約，切分乙則讓一群全違約、另一群3未違約1違約。哪個判斷正確？
    options:
      A: 甲較有用，因為兩群比例相同代表分辨能力更穩定
      B: 乙沒有增益，因為仍有一群同時包含違約與未違約
      C: 兩者都一樣，因為父節點總共都是6筆且類別相同
      D: 乙有正增益，甲未降低熵，但結論限於這個切分
    answer: D
    explain:
      A: 子群比例都不變，表示該切分沒有減少標籤不確定性。
      B: 資訊增益不要求所有子群完全純，只要加權熵下降即可。
      C: 父節點相同才適合比較，子節點分布仍可產生不同增益。
      D: 乙的子群分布更具辨識力，但不能直接宣稱特徵在所有資料都較好。
  - id: c2
    goal: g2
    type: choice
    prompt: 父熵1 bit。特徵甲切成4筆熵0.811278、2筆熵0；特徵乙切成2筆熵1、4筆熵1。兩者資訊增益依序約多少？
    options:
      A: "甲約0.5944 bit；乙約0.0000 bit"
      B: "甲約0.4591 bit；乙約0.0000 bit"
      C: "甲約0.1887 bit；乙約0.0000 bit"
      D: "甲約0.4591 bit；乙約1.0000 bit"
    answer: B
    explain:
      A: 0.5944忽略4筆與2筆的權重差異。
      B: 甲為1減4／6乘0.811278；乙的加權子熵仍為1。
      C: 0.1887只用父熵減左子熵，少了加權步驟。
      D: 乙兩邊都維持各半，並沒有消除全部不確定性。
  - id: c3
    goal: g2
    type: choice
    prompt: 6筆客戶各有唯一編號。若按編號做6個分支，每個子群只有1筆，訓練資訊增益達1 bit。接下來怎麼判斷？
    options:
      A: 編號一定是最佳特徵，因為1 bit足以保證新客戶全部分類正確
      B: 編號沒有任何風險，因為分支數量越多就一定具有更強因果
      C: 高基數可能靠記住訓練樣本取高分，應查泛化與切分限制
      D: 增益一定算錯，因為任何特徵的資訊增益都不可能達父熵
    answer: C
    explain:
      A: 新客戶的編號沒有見過，訓練純度不保證泛化。
      B: 分支數與因果沒有必然關係，反而可能過擬合識別碼。
      C: 這是原始資訊增益偏好高基數的典型警訊，需要額外驗證。
      D: 當所有子群純時，子熵為零，增益可等於父熵。
---

## 為什麼需要

特徵多時，並不是每一欄都能幫助辨識類別。科目1指引用資訊增益（Information Gain）衡量特徵對預測提供多少資訊，作為特徵選擇的方法。

分類樹也需要同樣的問題：知道某個條件成立與否後，標籤是否更容易猜？若切完兩群仍和原先一樣混雜，這個條件就沒帶來辨識力。

## 直覺

原本六位客戶有三位違約，只知道他們都在同一節點，仍難分辨。若某個條件把兩位違約者集中到一邊，知道分支後就多了一些線索。

相反地，若切完每一邊仍各半違約，知道分支也沒有幫助。資訊增益就是比較切分前後的這種不確定性。

![看切分後的類別比例，而非只看有幾個分支；負債條件有改善，這個收入條件沒有。](figure:l23202-tree-impurity-splits)

## 定義與公式

本頁子群內的類別比例，是已知分支後的條件機率；分割後的熵須依各分支所占比例加權。

科目1指引將它用於挑選有辨識力的特徵；科目3指引說明它衡量熵的下降。以下數學展開及高基數限制屬補充。

### 先量標籤熵（補充）

$$
H(S)=-\sum_{k=1}^{K}p_k\log_2p_k
$$

$S$是非空樣本集合，$K$是類別數，$p_k$是第$k$類比例。以2為底，單位是bit；零比例採$0\log_2 0=0$的極限約定，實作略過零項。

本例3正3負，兩類比例都是0.5，因此$H(S)=-2(0.5\log_2 0.5)=1$。若全部同類，熵為0。

### 分割後按筆數加權（補充）

$$
\mathrm{IG}(S,A)=H(S)-\sum_{v=1}^{m}\frac{|S_v|}{|S|}H(S_v)
$$

$A$是候選特徵及其分割規則，$S_v$是第$v$個非空子集，$m$為子集數，豎線表示筆數。子集合須完整分割父集合，各權重加總為1。

先算每群熵，再乘上所占筆數，最後由父熵扣掉加總。

## 算一次

### 有用與無用的兩個條件（補充）

沿用金融小節點的六筆及二元標籤，與樹節點不純度頁使用同一組六筆。第一個條件為負債≤350千元，第二個為收入≤35千元。

負債條件左邊4筆：3筆未違約、1筆違約；右邊2筆都違約。左熵為$-(3/4)\log_2(3/4)-(1/4)\log_2(1/4)\approx0.811278$，右熵為0。

$$
H_{\mathrm{after}}=\frac46(0.811278)+\frac26(0)
\approx0.540852,\qquad
\mathrm{IG}=1-0.540852\approx0.459148
$$

$H_{\mathrm{after}}$表示加權子熵，資訊增益的單位仍為bit。不能把0.811278與0直接平均，因為子節點分別有4筆與2筆。

收入條件左邊1負1正、右邊2負2正；兩個子熵都是1。加權子熵$(2/6)1+(4/6)1=1$，資訊增益$1-1=0$。

| 條件 | 子集合筆數 | 加權子熵：bit | 增益排名 |
|---|---|---|---|
| 負債≤350 | 4、2 | 0.540852 | 第1，增益0.459148 |
| 收入≤35 | 2、4 | 1.000000 | 第2，增益0 |

在這個節點，先選負債條件。不代表收入永遠無用，也不代表換一個收入切點仍是0；比較結論受樣本與分割規則限制。

## 程式（補充）

以下用相同 6 筆的換算座標與標籤重算特徵排名，和手算對照。

每列為 $(a,b)$：收入為 $20+10a$ 千元，負債為 $100b$ 千元。因此收入≤35 千元對應 $a≤1.5$，負債≤350 千元對應 $b≤3.5$。

```python
from math import log2
X = [(1, 1), (1, 3), (2, 1), (2, 4), (3, 1), (3, 5)]
y = [0, 1, 0, 1, 0, 1]
def entropy(labels):
    p = [labels.count(c) / len(labels) for c in [0, 1]]
    return -sum(v * log2(v) for v in p if v > 0)
for name, j, threshold in [("負債", 1, 3.5), ("收入", 0, 1.5)]:
    left = [label for row, label in zip(X, y) if row[j] <= threshold]
    right = [label for row, label in zip(X, y) if row[j] > threshold]
    after = sum(len(g) / len(y) * entropy(g) for g in [left, right])
    print(f"{name} 子熵={after:.6f} 增益={entropy(y)-after:.6f}")
```
```text
負債 子熵=0.540852 增益=0.459148
收入 子熵=1.000000 增益=0.000000
```

## 怎麼用、怎麼判讀

特徵工程可以用資訊增益先篩選與標籤有關的欄位；分類樹則用它選當前節點的分割條件。前者在選輸入，後者在建構路徑，用途不同但都在看標籤不確定性的下降。

### 高基數與驗證界線（補充）

唯一客戶編號若允許每個值各建一個分支，六筆就能切成六個純子集，訓練增益達1 bit。新客戶卻是新編號，這種「高分」可能只在記憶資料。

這是多分支的高基數示例，不是宣稱CART用編號的一個二元閾值就必定得到六個葉。實務可限制葉筆數、分割複雜度，並用未參與篩選的資料確認效果。

特徵選擇必須放在訓練或每個訓練摺內。即使只是先算資訊增益，若用測試標籤決定留下哪些欄位，也會造成資料洩漏。

### 換個場景

| 場景或資料條件 | 使用方式 | 判讀重點 |
|---|---|---|
| 特徵多、需先挑輸入 | 依標籤資訊篩選候選特徵 | 同時檢查冗餘欄位 |
| 分類樹的候選分裂 | 比較熵的下降 | 固定父節點與加權規則 |
| 製造瑕疵（補充） | 比較感測條件能否分辨瑕疵 | 關聯不是故障因果 |
| 醫療分類（補充） | 比較檢查結果帶來的線索 | 不以增益代替臨床成本 |
| 客服欄位（補充） | 篩選案件類型的輸入欄位 | 排除事後處理結果與編號 |

## 常見誤解

- 增益0就是特徵永遠無用：它只針對目前集合與分割規則。（補充）
- 子熵相加後除以子節點數就好：節點大小不同時要按筆數加權。（補充）
- 增益較高必定有因果關係：資訊增益描述與標籤的關聯，不是介入效果。（補充）

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-5；科目3指引4.2，guide-3:4-31（版本未標示）：支持特徵選擇與熵下降的用途；完整公式、算例及高基數限制為補充。
- [Google Decision Forests：Exact splitter](https://developers.google.com/machine-learning/decision-forests/binary-classification)：支持熵、加權資訊增益；參考好壞切分的教學圖解。
- [scikit-learn Decision Trees](https://scikit-learn.org/stable/modules/tree.html)：支持多分支／CART二元切分、複雜度與泛化限制。
- [scikit-learn Feature importances with a forest of trees](https://scikit-learn.org/stable/auto_examples/ensemble/plot_forest_importances.html)：補充支持以不純度下降評估特徵時，高基數可能造成偏好的限制。
- [scikit-learn Feature selection](https://scikit-learn.org/stable/modules/feature_selection.html)：支持在模型流程內處理特徵篩選。

## 小結

- 資訊增益是父熵減去按筆數加權的子熵。
- 同一資料的候選特徵與切點，才有一致的比較基準。
- 高基數可能帶來虛高訓練增益，特徵選擇仍需獨立驗證。
