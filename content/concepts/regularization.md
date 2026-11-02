---
id: regularization
title: 正則化方法選用
kind: technique
codes: [L23203, L23302, L23304]
aliases: [L1, L2, 正則化, 正規化懲罰]
requires: [bias-variance-tradeoff]
mitigates:
  - target: overfitting
    note: 限制權重或訓練行為可降低過擬合風險；限制過強會造成欠擬合。
    source: [guide-3:5-42, guide-3:5-43]
summary: 正則化限制模型的擬合能力，讓訓練同時顧及預測誤差與模型限制
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-63, guide-3:4-64, guide-3:5-42, guide-3:5-43]
goals:
  - id: g1
    text: 依稀疏選取、權重收縮與相關特徵需求，比較三種懲罰方法
  - id: g2
    text: 計算固定權重的正則化目標，判斷正則化強度過強與過弱的風險
formula_groups:
  - id: penalized-objective
    source: guide-3:5-42
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
  - id: data-loss-convention
    source: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 房價模型有 80 個欄位，團隊希望保留少數欄位，也希望高度相關的面積欄位較穩定地共同保留。哪個起點最合理？
    options:
      A: 只採用純 L1 懲罰，並用單次訓練的稀疏名單確認相關面積欄位必定共同保留
      B: 比較 Elastic Net，並以驗證分數與重訓權重檢查是否符合需求
      C: 採用純 L2 懲罰，因為權重縮小就表示大部分欄位已被精確刪除
      D: 移除所有懲罰項，因為保留全部欄位就能保證權重對重訓穩定
    answer: B
    explain:
      A: 純 L1 可促進稀疏，但相關欄位之間的選取可能不穩定。
      B: 混合懲罰兼顧稀疏與收縮，仍須用實際驗證與穩定性證據選用。
      C: 純 L2 主要收縮權重，不以產生大量精確零值為目標。
      D: 不加限制並不能解決共線性，權重仍可能隨資料變動。
  - id: c2
    goal: g2
    type: choice
    prompt: 某固定權重的資料損失為 0.8，懲罰量為 3.5。只把 lambda 從 0.2 改成 0.4，尚未重新訓練，兩個總目標依序是多少？
    options:
      A: 0.96 與 1.12，並可斷定重新訓練後驗證誤差會下降
      B: 1.50 與 2.20，並可斷定重新訓練後驗證誤差會下降
      C: 0.96 與 1.12，但尚不能判定重新訓練後驗證誤差
      D: 1.50 與 2.20，但尚不能判定重新訓練後驗證誤差
    answer: D
    explain:
      A: λ 應乘上 3.5，且固定權重的目標不足以預測驗證表現。
      B: 目標加總正確，但模型重訓後的泛化表現仍須驗證。
      C: 這組數字把 0.8 誤作懲罰量，沒有依題意計算。
      D: 兩者為 0.8 加 0.7 與 0.8 加 1.4，並未提供重訓驗證結果。
  - id: c3
    goal: g2
    type: choice
    prompt: 同一切分下，lambda 從 0.02 增至 2，訓練 MSE 由 1.53 升至 2.86，驗證 MSE 由 1.27 升至 2.76，全部斜率變為 0。應如何判讀？
    options:
      A: 限制可能過強，應比較較小 λ 並檢查欠擬合
      B: 限制已經足夠，應只用零權重判定泛化最佳
      C: 限制仍然不足，應繼續增大 λ 以消除誤差
      D: 限制沒有作用，應只憑訓練變差判定過擬合
    answer: A
    explain:
      A: 訓練與驗證都變差且僅剩常數預測，支持檢查限制過強。
      B: 零權重代表強限制，不能取代驗證集上的預測表現。
      C: 更大的限制可能繼續壓抑有效訊號，沒有證據支持這項調整。
      D: 訓練與驗證同時變差並不是訓練很好而泛化失敗的典型樣貌。
---

## 為什麼需要

模型把訓練資料記得很細，未必能預測新資料。正則化（Regularization）讓學習過程付出「模型太複雜」的代價，減少過擬合的機會。

限制也有成本。若原本就欠擬合，再壓縮權重，可能連重要規律都學不到。

## 直覺

L1 正則化鼓勵部分權重變零；L2 正則化主要讓權重收縮。Elastic Net 同時使用這兩種限制，兼顧稀疏與穩定。

Dropout 則在訓練時隨機屏蔽輸出，早停限制訓練持續的時間。它們都可用來抑制過擬合，但操作的對象不同。

:::supplement[來源：Dive into Deep Learning 3.7 Weight Decay]
權重受到限制，不代表網路一定少了幾層。可以維持相同架構，改變這個架構實際能擬合資料的程度。
:::

## 定義與公式

帶懲罰的訓練目標為：

$$
J(\mathbf w)=D(\mathbf w)+\lambda R(\mathbf w)
$$

$\mathbf w$ 是權重向量，$D$ 是原始資料損失，$R$ 是懲罰量，$\lambda\geq0$ 控制限制強度。訓練要找使 $J$ 較小的權重。

| 懲罰方法 | 懲罰量 | 主要用途 |
|---|---|---|
| L1 正則化 | 權重絕對值加總 | 促進稀疏與特徵選擇 |
| L2 正則化 | 權重平方加總 | 收縮權重、提高穩定性 |
| Elastic Net | 兩項各乘對應強度後加總 | 兼顧選取與穩定性 |

同一種 $R$ 下，增大 $\lambda$ 會強化限制；減小則放寬限制。λ 太大可能欠擬合，太小則可能仍有過擬合。

![同一資料與切分下，λ 增大後兩領域的訓練與驗證 MSE 都可能變差，不能只追求更強的限制。](figure:l23304-regularization-lambda)

圖用原始合成資料重新擬合得到；測試集沒有參與挑選。這組結果只是示範，不能推成所有資料都應選 0.02。

:::supplement[來源：scikit-learn Lasso、Ridge、ElasticNet API]
本組的迴歸資料損失統一用「一半的均方誤差（Mean Squared Error，MSE）」：

$$
D=\frac{1}{2n}\sum_{i=1}^{n}(y_i-\hat y_i)^2
$$

$n$ 是訓練筆數，$y_i$ 是實際值，$\hat y_i$ 是預測值。截距另估、不加入懲罰；後面的 MSE 表則使用完整均方誤差。

共用檢查點的 72 筆訓練殘差平方和為 115.2，因此 $D=115.2/(2\times72)=0.8$。

不同套件可能用平方誤差總和，或替懲罰加上二分之一。必須先對齊公式，才能比較正則化強度；參數都叫 `alpha` 也不代表強度相同。
:::

## 算一次（補充）

共用教學資料有房價與客服各 120 筆，固定切成訓練 72、驗證 24、測試 24 筆。兩領域都含兩個高度相關欄位，標準化只由訓練資料估計。

固定權重為 $[2,-1,0.5]$ 時，兩領域的 $D$ 都是 0.8。先固定這個權重比較懲罰，尚未重新訓練：

| 方法 | 懲罰計算 | 目標 $J$ |
|---|---|---:|
| L1，λ＝0.2 | $0.2(2+1+0.5)=0.7$ | 1.50 |
| L2，λ＝0.2 | $0.2(4+1+0.25)=1.05$ | 1.85 |
| 混合，λ₁＝0.12、λ₂＝0.08 | $0.12(3.5)+0.08(5.25)=0.84$ | 1.64 |

例如 L1 的目標是 $0.8+0.7=1.5$。三種目標定義不同，不能因為 1.50 最小，就宣布 L1 的預測最好。

重新訓練後，房價 Lasso 在 λ＝0.02、0.2、2 下的驗證 MSE 分別為 1.2685、1.3352、2.7610。最後一組全部斜率為零，顯示過強限制的代價。

驗證集只有 24 筆，樣本組成與雜訊會影響 MSE，數值可能低於訓練集。應比較同一切分下的變化，不能把兩者大小當成正則化的必然效果。

## 程式（補充）

執行前把環境變數 `IPAS_REPO_ROOT` 設為專案根目錄的絕對路徑。五頁程式都由它讀取共用例子，不依賴執行器的暫存工作目錄。

下面核算相同權重的三種懲罰，不執行選模。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23304-C-penalties-dropout.json").read_text(encoding="utf-8"))
w = np.array(d["weights"], dtype=float)
data_loss = d["data_loss_at_weights"]
l1 = np.abs(w).sum()
l2 = np.square(w).sum()
penalties = {"L1": d["lambda"]*l1, "L2": d["lambda"]*l2,
             "Elastic Net": d["lambda1"]*l1 + d["lambda2"]*l2}
for name, penalty in penalties.items():
    print(f"{name}: penalty={penalty:.2f}, objective={data_loss+penalty:.2f}")
```
```text
L1: penalty=0.70, objective=1.50
L2: penalty=1.05, objective=1.85
Elastic Net: penalty=0.84, objective=1.64
```

## 怎麼用、怎麼判讀

先問需求：要少量特徵，考慮 L1；要保留資訊並穩定權重，考慮 L2；兩者都要，則比較 Elastic Net。選定方法後仍須調整強度。

:::supplement[來源：scikit-learn Linear Models 1.1.3、1.1.5；Preprocessing data 8.3.1]
固定資料分割與指標，在訓練資料內用交叉驗證選 λ。每摺獨立估計標準化參數，最後才用保留的測試集評估一次。

相關特徵很多時，除了驗證誤差，也應重訓比較權重與選取名單。單次選出的欄位不能直接解釋成因果因素。
:::

### 換個場景

指引列出線性迴歸、邏輯迴歸、支持向量機，以及 CNN、RNN、Transformer 等網路。共同需求是避免權重過大或太依賴少數特徵。

| 場景／條件 | 選用重點 |
|---|---|
| 線性、邏輯迴歸與支持向量機 | 確認模型實際支援的懲罰與參數定義 |
| 深度神經網路 | 權重限制可搭配 Dropout 或早停 |
| 房價估計（補充） | 面積欄位高度相關，連同權重穩定性比較 |
| 客服情緒（補充） | 相似文字特徵多，兼顧選取與驗證誤差 |
| 製造感測（補充） | 不因一次被刪除就判定感測器沒有資訊 |

## 常見誤解

- **λ 越大越好。** 限制過強可能連有效訊號也壓掉，造成欠擬合。
- **正則化就是正規化。** 前者限制模型，後者調整資料尺度。（補充）
- **訓練目標越小，跨方法一定越好。** 懲罰定義不同時，要用一致的驗證指標比較。（補充）

## 進階

### 參考來源

- 科目 3 學習指引，版本未標示、本機快照：`guide-3:4-63`～`guide-3:4-64`、`guide-3:5-42`～`guide-3:5-43`；支持方法用途、強度方向與適用模型。
- [scikit-learn Lasso](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html)、[Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)、[ElasticNet](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.ElasticNet.html)：支持資料損失、懲罰尺度與程式核算。
- [Dive into Deep Learning 3.7 Weight Decay](https://d2l.ai/chapter_linear-regression/weight-decay.html)：支持限制權重與模型容量的直覺。
- [scikit-learn Linear Models](https://scikit-learn.org/stable/modules/linear_model.html)、[Preprocessing data](https://scikit-learn.org/stable/modules/preprocessing.html)：支持相關特徵與標準化比較流程。

## 小結

- L1 促進稀疏，L2 收縮權重，Elastic Net 混合兩者。
- λ 決定限制強弱，太強可能欠擬合。
- 固定權重的懲罰計算，與重訓後的驗證表現要分開看。（補充）
- 用相同切分與指標選模，保留測試集做最後評估。（補充）
