---
id: l2-regularization
title: L2 正則化與 Ridge
kind: technique
codes: [L23202, L23304]
aliases: [L2 Regularization, 權重衰減]
requires: [regularization]
is_a: [regularization]
mitigates:
  - target: overfitting
    note: 平方和懲罰限制權重大小；過強仍可能造成欠擬合。
    source: [guide-3:5-44]
summary: L2 正則化以權重平方和限制大權重，主要效果是收縮與穩定
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-15, guide-3:4-16, guide-3:5-44, guide-3:5-45]
goals:
  - id: g1
    text: 計算 L2 懲罰，說明共線性下的權重收縮及與稀疏選取的差別
formula_groups:
  - id: squared-penalty
    source: guide-3:5-44
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
  - id: isotropic-ball
    source: https://pmc.ncbi.nlm.nih.gov/articles/PMC9410599/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 房價模型的權重為 [2, -1, 0.5]，資料損失為 0.8。以 lambda 為 0.2 乘權重平方和，懲罰與總目標是多少？
    options:
      A: 懲罰 0.70，總目標 1.50
      B: 懲罰 1.05，總目標 1.85
      C: 懲罰 0.65，總目標 1.45
      D: 懲罰 5.25，總目標 6.05
    answer: B
    explain:
      A: 0.70 是絕對值總和乘 0.2，沒有使用平方和。
      B: 平方和為 4 加 1 加 0.25，共 5.25；懲罰為 1.05，總目標為 1.85。
      C: 負權重平方仍為正，不能把負權重的平方當負數抵銷。
      D: 5.25 是尚未乘上 λ 的平方和。
  - id: c2
    goal: g1
    type: choice
    prompt: 另一份房價資料有兩個高度相關的面積欄位，Ridge 為兩者分配了非零權重；另有無關欄位的權重恰為 0。哪個解釋最恰當？
    options:
      A: Ridge 會保證每個權重都不等於零，因此這個模型必然訓練失敗
      B: Ridge 會自動把大多數權重變成零，因此這個模型已完成特徵選擇
      C: Ridge 主要收縮並穩定權重，個別權重為零仍不違反這項作用
      D: Ridge 主要增加所有權重的絕對值，因此這個模型應改用更大懲罰
    answer: C
    explain:
      A: L2 不促進一般的稀疏選取，不等於數學上排除任何零權重。
      B: 個別零權重不代表大量稀疏化，也不表示模型已完成特徵選取。
      C: L2 的重點是平方和限制與收縮，零值可能由資料對稱或無關性產生。
      D: 增加 L2 懲罰通常更強地限制整體權重大小，並非增加所有絕對值。
---

## 為什麼需要

高度相關的特徵能互相替代，普通最小平方法的權重可能很不穩定。L2 正則化（L2 Regularization）對大權重加較重的懲罰，讓模型避免靠極大的權重配合抵銷。

嶺迴歸（Ridge Regression）是平方誤差加上 L2 懲罰的模型。本頁說明通用懲罰，模型的完整用法接嶺迴歸。

## 直覺

權重 2 的平方是 4，權重 1 的平方是 1。權重只變成兩倍，平方懲罰卻變成四倍，因此特別抑制過大的權重。

![三種限制使用同一座標尺度；中間的 L2 區域呈圓形，反映各方向受到相同平方和限制。](figure:l23304-l1-regularization-constraints)

:::supplement[來源：Hastie（2020）Ridge Regularization 第 1 節與圖 1]
圖中是權重座標的等向限制。圓滑的邊界有助理解「共同縮小」與 L1 在座標軸上產生稀疏的差異，不能只憑形狀判斷預測勝負。
:::

## 定義與公式

$$
J_2(\mathbf w)=D(\mathbf w)+\lambda\sum_{j=1}^{d}w_j^2
$$

$D$ 是資料損失，$d$ 是受懲罰權重數，$w_j$ 是第 $j$ 個權重，$\lambda\geq0$ 是限制強度。負權重平方也是正值，不能互相抵銷。

增加 $\lambda$ 會更重視小權重，太大可能欠擬合。與 L1 的稀疏選取相比，L2 主要用來收縮與穩定權重。

:::supplement[來源：Hastie（2020）Ridge Regularization；scikit-learn Ridge API]
指引 4-15 使用殘差平方和（SSE）加懲罰。本頁改用半 MSE；整個目標同除以訓練筆數的兩倍後，指引的 λ 也要除以相同倍數，才有相同最優解。

「通常不促進稀疏」不等於「任何權重都不可能為零」。指引的絕對說法需加此限制；資料沒有相關訊號時，個別權重仍可能恰為零。
:::

### 幾何條件的校正（補充）

等向平方和的限制可寫為：

$$
\sum_{j=1}^{d}w_j^2\leq c
$$

$c\geq0$ 是懲罰預算；在原始權重座標中，這是半徑 $\sqrt c$ 的球，二維時是圓。它並非一般的橢球。

例如 $c=1$，$[1,0]$ 的平方和為 1，位於邊界；$[0.5,0.5]$ 為 0.5，位於內部。若使用不同方向的權重限制，才可能得到橢球。

指引的橢圓說法容易和資料損失的等高線混用。這裡只在校正懲罰區域，並未把兩種圖形當成相同東西。

## 算一次（補充）

沿用房價與客服的固定權重 $[2,-1,0.5]$，$D=0.8$，$\lambda=0.2$。

1. 各自平方：$[4,1,0.25]$，平方和為 $5.25$。
2. 懲罰是 $0.2\times5.25=1.05$。
3. 目標 $J_2=0.8+1.05=1.85$。

這裡用的是平方和，不是開根號後的向量長度。也不能先加總權重再平方，兩者會得到不同結果。

在相同房價資料與切分上重訓，L2 得到 $[0.4722,0.4727,0.1921]$，L1 得到 $[0,0.9247,0.0671]$。

前兩欄高度相關，L2 在此分攤權重，L1 只保留其中一欄。這裡比較的是整組權重的分配方式。

客服資料的 L2 權重則為 $[0.3964,0.4077,0.3129]$。兩領域都未出現精確零值，但這只是這次資料的結果，並非零值不可能發生的證明。

## 程式（補充）

執行前把環境變數 `IPAS_REPO_ROOT` 設為專案根目錄的絕對路徑。五頁程式都由它讀取共用例子，不依賴執行器的暫存工作目錄。

下面先核算平方懲罰，再檢查一個特徵與目標恰好無關的邊界例子。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23304-C-penalties-dropout.json").read_text(encoding="utf-8"))
from sklearn.linear_model import Ridge
w = np.array(d["weights"], dtype=float)
penalty = d["lambda"] * np.square(w).sum()
print(f"penalty={penalty:.2f}, objective={d['data_loss_at_weights']+penalty:.2f}")
X = np.array([[-1.0], [1.0]])
y = np.array([3.0, 3.0])
model = Ridge(alpha=1.0).fit(X, y)
print("zero-signal coefficient:", model.coef_.tolist())
```
```text
penalty=1.05, objective=1.85
zero-signal coefficient: [0.0]
```

:::tip[讀碼重點]
這個邊界例子的目標值固定為 3，截距已能完全解釋資料，因此斜率為零。它直接反駁「L2 下權重永遠不等於零」。
:::

## 怎麼用、怎麼判讀

指引特別指出多重共線性情境：如果想保留相關欄位的資訊並限制大權重，可比較 L2。它不以刪除大量欄位為主要目標。

:::supplement[來源：scikit-learn Ridge、Lasso API；Preprocessing data 8.3.1]
先標準化再比較權重；只用訓練資料估計尺度。本組使用一半均方誤差，所以 72 筆訓練資料、lambda 為 0.2 時，對應 `Ridge(alpha=28.8)`。

28.8 來自 $2\times72\times0.2$，因為 Ridge API 使用平方誤差總和。直接把 `alpha=0.2` 與 Lasso 的同名參數比較，會混用不同損失尺度。
:::

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 多重共線性 | 限制權重過度放大，觀察重訓穩定性 |
| 房價估計（補充） | 面積欄位相關，檢查分攤後的權重與誤差 |
| 客服情緒（補充） | 相似文字特徵可一起保留，不靠零值篩選 |
| 製程預測（補充） | 多個同步感測器仍可能各帶雜訊，不盲目刪欄 |

## 常見誤解

- **L2 是權重總和的平方。** 應把每個權重分別平方再加總。
- **L2 能保證泛化更好。** 限制太強仍可能欠擬合。
- **每個權重的絕對值都必然隨 λ 增大而單調下降。** 相關欄位會互相分攤，應區分整體平方和與個別權重。（補充）

## 進階

### 權重衰減的名稱界線（補充）

在一般梯度下降、尺度對齊時，L2 懲罰可產生每步收縮權重的效果，因此常與權重衰減一起談。使用自適應優化器時，解耦權重衰減與損失中的 L2 項可能不同。

讀到 AdamW 的 `weight_decay` 時，應回到其更新規則，不能直接把數值當成本頁公式的 lambda。

### 參考來源

- 科目 3 學習指引，版本未標示、本機快照：`guide-3:5-44`～`guide-3:5-45`；支持平方和及欠擬合風險，絕對零值與橢球說法在正文校正。
- 同指引 `guide-3:4-15`～`guide-3:4-16`：支持嶺迴歸的共線性用途。
- [scikit-learn Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)：支持目標尺度與邊界程式。
- [Dive into Deep Learning 3.7.1](https://d2l.ai/chapter_linear-regression/weight-decay.html)：支持權重收縮直覺。
- [Hastie（2020），Ridge Regularization，第 1 節與圖 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC9410599/)：支持等向平方和的圓形區域與幾何校正。
- [scikit-learn Lasso](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html)、[Preprocessing data](https://scikit-learn.org/stable/modules/preprocessing.html)：支持尺度比較與標準化。
- [Loshchilov 與 Hutter，Decoupled Weight Decay Regularization](https://arxiv.org/abs/1711.05101)：支持進階的解耦權重衰減界線。

## 小結

- L2 使用權重平方和，特別限制大權重。
- 主要用途是權重收縮與穩定，不是稀疏選取。
- 等向平方和的限制區域是球；個別權重仍可能為零。（補充）
- 套件參數要先對齊資料損失與懲罰尺度。（補充）
