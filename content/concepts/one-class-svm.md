---
id: one-class-svm
title: 單類別支援向量機
kind: model
codes:
  - L23202
aliases:
  - One-Class SVM
summary: 單類別支援向量機以正常資料學習接受邊界，再找出偏離者
requires: [unsupervised-learning]
guide_refs:
  - guide-3:4-52
  - guide-3:4-53
goals:
  - id: g1
    text: 以正常訓練及未知測試說明核函數、ν、γ 與成本限制
formula_groups:
  - id: rbf-similarity
    source: https://scikit-learn.org/stable/modules/svm.html#kernel-functions
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 有 80 筆已確認正常設備資料、40 筆未知資料，採 RBF One-Class SVM。流程如何安排？
    options:
      A: 在 120 筆上先縮放，再把 40 筆設為異常標籤訓練
      B: 先把 40 筆分成兩群，再把較小群當成故障標籤
      C: 用 80 筆與 40 筆一起調參，再把同 40 筆當獨立測試
      D: 只用正常 80 筆擬合縮放與邊界，再判斷未知 40 筆
    answer: D
    explain:
      A: 未知資料沒有可用的異常標籤，且縮放含測試資訊。
      B: 小群不等於故障，也改變單類別訓練問題。
      C: 調參資料不能再宣稱是獨立最終測試。
      D: 正常資料學接受域，未知資料沿用相同縮放。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊設定 ν=0.1、γ=0.5。以下哪種解讀合理？
    options:
      A: ν 管訓練容錯與支持向量比例，γ 管 RBF 影響範圍
      B: ν 保證測試剛好一成異常，γ 指定群數恰為兩群
      C: ν 是邊界外樣本機率，γ 是模型輸出的故障機率
      D: ν 指定支持向量恰十筆，γ 指定每點最近鄰數量
    answer: A
    explain:
      A: 理論上 ν 是訓練錯誤比例上界與支持向量比例下界；γ 控制核尺度。
      B: ν 不保證測試異常率，γ 不是群數。
      C: 兩者都是超參數，並非校準後故障機率。
      D: 比例不等於固定支持向量筆數，γ 也不是鄰居數。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

正常運轉紀錄很多、故障案例卻很少時，可用單類別支援向量機（One-Class SVM）學正常資料的接受區域，再判斷新樣本是否偏離。

## 直覺

它利用核函數把正常資料放進另一個特徵空間，在那裡學習將資料與原點分隔的超平面。回到原空間後，接受域可以是非線性的，並非只能畫一個圓。

![藍圓是正常訓練，橘叉是未知資料；底色表示模型接受域，不是故障機率。](figure:l23202-one-class-svm-boundary)

:::supplement[來源：本站 L23202-C 教學合成資料]
圖用設備切分的兩維工程座標示範邊界。正文程式則將三個原始欄位標準化；兩模型的分數不可混用。
:::

## 定義與公式

One-Class SVM 不需要同時收集兩類標籤。正常訓練資料應涵蓋預期的正常模式；混入異常值、漏掉合法負載或縮放失當，都可能使邊界失準。

### 核函數、ν、γ（補充）

| 參數 | 角色 | 常見判讀錯誤 |
|---|---|---|
| kernel | 定義特徵空間的相似性 | RBF 不是只能產生圓形邊界 |
| ν（nu） | 訓練錯誤比例上界、支持向量比例下界 | 不等於測試集固定異常率 |
| γ（gamma） | RBF 相似性的衰減尺度 | 越大不代表一定越準 |

ν 的界限是最佳化問題的理論性質，有限樣本與求解容差下不要當作精確筆數承諾。γ 大時單點影響較局部，可能形成較曲折的接受域；必須驗證，不宜只看訓練是否包得緊。

$$
K(x,z)=\exp(-\gamma\lVert x-z\rVert^2)
$$

$x,z$ 是採同一縮放的兩個向量，$\gamma>0$ 控制衰減。這是 RBF 核的相似度，不是最後的異常分數或故障機率。

若一維縮放後的 x=0、z=2、γ=0.5，平方距離是 4，相似度為 exp(−2)≈0.135335。相同距離下 γ 改成 2，得到 exp(−8)≈0.000335，更快衰減。

## 走一次流程

### 80 筆正常訓練，40 筆未知（補充）

共用 JSON 的 train_indices 固定挑出設備的 80 筆正常樣本，test_indices 留出 40 筆。未知資料不先貼上故障標籤，也不加入訓練縮放統計量。

1. 檢查正常資料是否包含兩種合法運轉模式。
2. 只用 80 筆擬合 StandardScaler，再轉換訓練與未知資料。
3. 固定 RBF、ν=0.1、γ=0.5，在正常資料上擬合邊界。
4. 對未知資料 predict；+1 是接受側，−1 是異常候選。
5. 另以可用的驗證案例調參；最後評估仍需獨立資料。

第 4 步的候選判斷與第 5 步的調參，不能只靠模型輸出當真值。若維修紀錄不足，就先報候選數與人工查核結果，不宣稱偵測準確率。

## 程式

### 與孤立森林共用切分與縮放（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["domains"]["equipment"]["raw"])
tr, te = data["train_indices"], data["test_indices"]
scaler = StandardScaler().fit(x[tr])
train, test = scaler.transform(x[tr]), scaler.transform(x[te])
m = OneClassSVM(kernel="rbf", nu=0.1, gamma=0.5).fit(train)
print("訓練/未知", len(train), len(test))
print("未知異常數", int(sum(m.predict(test) == -1)))
print("前三筆分數", m.decision_function(test[:3]).round(6).tolist())
print("核相似度", round(float(np.exp(-0.5 * 4)), 6), round(float(np.exp(-2 * 4)), 6))
```
```text
訓練/未知 80 40
未知異常數 15
前三筆分數 [0.075681, -0.000353, -0.014457]
核相似度 0.135335 0.000335
```

:::tip[讀碼重點]
fit 不傳正常／故障二元標籤。decision_function 的負值在異常側；ν 與 γ 不會直接輸出異常機率。
:::

## 怎麼用、怎麼判讀

正常資料易取得、異常極難收集時，可考慮單類別邊界。核方法能表達複雜形狀，但對參數與污染敏感，大量樣本時也有較高訓練成本。

### 規模與比較（補充）

核相似度的計算與快取會耗時間和記憶體，不能把指引所說「適合高維」理解成「任意大樣本都便宜」。資料量大時，可在相同切分下比較孤立森林與其他近似方法。

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 異常案例極少、正常較多 | 從正常模式學接受邊界 | 科3 4-53；正常樣本要有代表性 |
| 複雜、非線性的正常分布 | 用核函數表示邊界 | 科3 4-52～4-53；注意參數成本 |
| 零售合法交易（補充） | 找罕見交易候選 | 新促銷可能是正常分布改變 |
| 工業設備（補充） | 查找偏離正常負載者 | 兩種合法負載均須納入訓練 |

## 常見誤解

- 只有一類訓練就不能處理新資料：學的是正常接受域，可判斷新樣本。
- ν=0.1 保證未知資料恰有 10% 異常：這不是測試比例保證。（補充）
- 邊界越複雜就越好：可能只貼合訓練點，漏掉合法新樣本。（補充）

## 進階

### 參考來源

- guide-3:4-52、guide-3:4-53：正常訓練、核映射、成本與污染限制。
- [OneClassSVM API](https://scikit-learn.org/stable/modules/generated/sklearn.svm.OneClassSVM.html)：ν、γ、輸出語意。
- [scikit-learn 核函數](https://scikit-learn.org/stable/modules/svm.html#kernel-functions)：RBF 公式。
- [RBF 單類別 SVM 教學](https://scikit-learn.org/stable/auto_examples/svm/plot_oneclass.html)：正常訓練與未知觀測分開繪圖的思路。

## 小結

- 學正常模式的邊界，不必硬造未知資料的故障標籤。
- 核函數決定相似性，γ 控制尺度，ν 控制訓練容錯條件。
- 特徵縮放、正常模式代表性與計算成本都要核對。
