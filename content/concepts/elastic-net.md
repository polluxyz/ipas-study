---
id: elastic-net
title: Elastic Net
kind: technique
codes: [L23202, L23304]
aliases: [L1加L2, 彈性網路]
requires: [l1-regularization, l2-regularization]
is_a: [regularization]
mitigates:
  - target: overfitting
    note: 混合懲罰可同時限制稀疏性與權重大小，兩項強度仍須驗證。
    source: [guide-3:5-45]
contrasts:
  - target: l1-regularization
    note: 混合懲罰在 L1 的稀疏效果之外加入 L2，可改善相關特徵的共同保留。
    source: [guide-3:5-45]
  - target: l2-regularization
    note: 混合懲罰保有 L1 的稀疏效果，純 L2 則不以特徵選取為目標。
    source: [guide-3:5-44, guide-3:5-45]
summary: Elastic Net 混合絕對值與平方和懲罰，兼顧稀疏選取與相關特徵的權重穩定
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-16, guide-3:4-64, guide-3:5-45]
goals:
  - id: g1
    text: 算出混合懲罰，依稀疏與相關特徵需求比較 L1、L2 和 Elastic Net
formula_groups:
  - id: mixed-penalty
    source: guide-3:5-45
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
  - id: sklearn-mapping
    source: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.ElasticNet.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 權重 [2, -1, 0.5] 的資料損失為 0.8，絕對值項 λ₁ 為 0.12，平方項 λ₂ 為 0.08。混合懲罰與總目標是多少？
    options:
      A: 混合懲罰 0.42，總目標 1.22
      B: 混合懲罰 0.70，總目標 1.50
      C: 混合懲罰 1.05，總目標 1.85
      D: 混合懲罰 0.84，總目標 1.64
    answer: D
    explain:
      A: 0.42 只計入其中一項，另一項平方和懲罰也要相加。
      B: 0.70 是把絕對值和乘上 0.2，沒有依兩個強度分別計算。
      C: 1.05 是把平方和乘上 0.2，沒有加入指定的絕對值項。
      D: 兩項分別為 0.12 乘 3.5 與 0.08 乘 5.25，合計 0.84。
  - id: c2
    goal: g1
    type: choice
    prompt: 客服情緒模型有 300 個相似文字特徵，希望剔除部分特徵，又讓相關詞組較容易一起保留。哪個評估方式較適合？
    options:
      A: 只比較純 L1，因為只要稀疏就能確保相關詞組共同保留
      B: 比較混合懲罰，並記錄驗證誤差、稀疏程度與重訓的穩定性
      C: 只比較純 L2，因為只要縮小就能確保無關特徵全部精確歸零
      D: 移除兩種懲罰，並只根據訓練誤差決定是否保留相關詞組
    answer: B
    explain:
      A: 純 L1 可能只選相關詞組中的部分成員，不能保證共同保留。
      B: 混合懲罰符合兩種需求，但是否達成仍需三類證據共同評估。
      C: L2 的收縮效果不等於把所有無關特徵精確歸零。
      D: 不加限制且只看訓練誤差，無法評估泛化或選取穩定性。
---

## 為什麼需要

L1 正則化能做稀疏選取，L2 正則化能限制大權重。遇到多個高度相關的特徵時，常希望同時取得兩種效果。

Elastic Net（彈性網路）把兩種懲罰放進同一個目標。它的代價是多了一項強度要調整，不能直接套用某個固定比例就當作最佳方案。

## 直覺

絕對值項負責推動部分權重變零，平方項則鼓勵較穩定的小權重。指引特別把多重共線性列為適用條件。

![最下方的混合區域介於菱形與圓形之間，仍保有座標軸尖角，並加入平滑彎曲的限制。](figure:l23304-l1-regularization-constraints)

:::supplement[來源：scikit-learn Linear Models 1.1.5；Lasso, Lasso-LARS, and Elastic Net paths]
圖的三個區域使用相同截軸點，方便只比較形狀。混合項不是先跑一次 Lasso，再接著跑 Ridge；訓練時兩項同時作用。

相關特徵較容易共同保留是一種傾向，並非每個相關欄位一定入選。資料損失、懲罰比例與整體強度仍會影響答案。
:::

## 定義與公式

$$
J_E(\mathbf w)=D(\mathbf w)+\lambda_1\sum_{j=1}^{d}|w_j|
+\lambda_2\sum_{j=1}^{d}w_j^2
$$

$D$ 是資料損失，$d$ 是受懲罰權重數，$w_j$ 是各權重。$\lambda_1\geq0$ 控制絕對值項，$\lambda_2\geq0$ 控制平方項。

兩項同時非零時，會同時鼓勵稀疏與收縮。要調整兩個強度，因此比只調一項更費工。

:::supplement[來源：scikit-learn ElasticNet API]
固定 $D$ 後，$\lambda_2=0$ 就只剩 L1；$\lambda_1=0$ 就只剩 L2。減少其中一項不代表另一項會自動增加，必須說清楚調整規則。
:::

## 算一次（補充）

房價與客服共用權重 $[2,-1,0.5]$，$D=0.8$。本次設定 $\lambda_1=0.12$、$\lambda_2=0.08$。

1. 絕對值和為 $3.5$，第一項懲罰為 $0.12\times3.5=0.42$。
2. 平方和為 $5.25$，第二項懲罰為 $0.08\times5.25=0.42$。
3. 相加得 $J_E=0.8+0.42+0.42=1.64$。

兩項剛好都為 0.42，只是這個權重與兩項強度的結果。不能因為 λ₁、λ₂ 是 0.12 與 0.08，就認定實際懲罰占比必為六成與四成。

### 共線特徵對照（補充）

相同房價資料、72 筆訓練與固定標準化下，三種重新擬合的權重如下。L1、L2 的 λ 各為 0.2，混合項的 λ₁＝0.12、λ₂＝0.08。

| 方法 | 面積權重 | 總面積權重 | 屋齡權重 |
|---|---:|---:|---:|
| L1 | 0 | 0.9247 | 0.0671 |
| L2 | 0.4722 | 0.4727 | 0.1921 |
| Elastic Net | 0.4664 | 0.4680 | 0.1277 |

混合方法在這裡保留了兩個相關面積欄位，也比純 L2 更強地壓低屋齡權重。這不是各方法的普遍排名，強度的尺度對齊也不等於懲罰效果完全相同。

客服領域的混合權重為 $[0.3695,0.3981,0.2639]$。相似文字特徵也一起保留；要判斷有沒有達到需求，仍需同時看誤差與稀疏程度。

## 程式（補充）

執行前把環境變數 `IPAS_REPO_ROOT` 設為專案根目錄的絕對路徑。五頁程式都由它讀取共用例子，不依賴執行器的暫存工作目錄。

scikit-learn 的 `ElasticNet` 使用 `alpha` 和 `l1_ratio`。令 $a$ 表示 `alpha`、$r$ 表示 `l1_ratio`，與本頁 λ₁、λ₂ 的對應是：

$$
\lambda_1=ar,\quad \lambda_2=\frac{a(1-r)}{2}
$$

$a$ 是整體強度參數，$r\in[0,1]$ 是 API 的混合參數。平方項有二分之一，因此不能直接用兩個強度的普通比例。

本例取 $a=0.12+2(0.08)=0.28$，$r=0.12/0.28=3/7$。代回可得兩項強度為 0.12、0.08。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23304-C-penalties-dropout.json").read_text(encoding="utf-8"))
w = np.array(d["weights"], dtype=float)
lam1, lam2 = d["lambda1"], d["lambda2"]
alpha = lam1 + 2*lam2
ratio = lam1 / alpha
penalty = alpha*ratio*np.abs(w).sum()
penalty += alpha*(1-ratio)/2*np.square(w).sum()
print(f"alpha={alpha:.2f}, l1_ratio={ratio:.6f}")
print(f"penalty={penalty:.2f}, objective={d['data_loss_at_weights']+penalty:.2f}")
```
```text
alpha=0.28, l1_ratio=0.428571
penalty=0.84, objective=1.64
```

:::tip[讀碼重點]
`l1_ratio` 是公式強度的參數化，不是每次訓練後「L1 實際懲罰占總懲罰」的比例。
:::

## 怎麼用、怎麼判讀

| 需求 | 可以比較 | 主要限制 |
|---|---|---|
| 高維度，想精簡欄位 | L1 正則化 | 高度相關時可能只保留其中一個 |
| 共線欄位，希望穩定收縮 | L2 正則化 | 不以產生大量零值為目的 |
| 共線欄位，也需要稀疏 | Elastic Net | 兩項強度都要調整 |

:::supplement[來源：scikit-learn Linear Models 1.1.5；L1-based models for Sparse Signals]
用固定的交叉驗證摺，同時比較整體強度與混合比例。標準化只在每摺訓練資料內學習，再記錄驗證誤差、非零個數與多次訓練的權重。

指引說 L2 可減少過度稀疏的問題，應理解為選用上的取捨。若混合項整體太強，仍可能大量歸零，不能保證保住所有重要特徵。
:::

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 多重共線性，兼顧選取與穩定 | 比較兩項強度造成的取捨 |
| 房價估計（補充） | 相關面積欄位是否共同保留 |
| 客服情緒（補充） | 相似詞組保留程度與驗證誤差 |
| 製造感測（補充） | 成群訊號中是否保留足夠預測資訊 |

## 常見誤解

- **有兩項懲罰就不用調參。** 指引反而提醒調參較複雜。
- **混合後不可能欠擬合。** 兩項限制都過強，仍可能壓掉訊號。（補充）
- **相關欄位必定全部入選。** 共同保留是傾向，還受資料與強度影響。（補充）
- **所有框架的混合比例都同義。** 應檢查公式中的二分之一及損失尺度。（補充）

## 進階

### 參考來源

- 科目 3 學習指引，版本未標示、本機快照：`guide-3:4-16`、`guide-3:4-64`、`guide-3:5-45`；支持雙強度公式、共線性場景與調參成本。
- [scikit-learn ElasticNet](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.ElasticNet.html)：支持強度映射、端點情況與程式。
- [scikit-learn Linear Models 1.1.5](https://scikit-learn.org/stable/modules/linear_model.html#elastic-net)：支持相關特徵共同保留的條件與限制。
- [L1-based models for Sparse Signals](https://scikit-learn.org/stable/auto_examples/linear_model/plot_lasso_and_elasticnet.html)、[Lasso, Lasso-LARS, and Elastic Net paths](https://scikit-learn.org/stable/auto_examples/linear_model/plot_lasso_lasso_lars_elasticnet_path.html)：支持比較權重、稀疏程度與混合路徑的教學設計。

## 小結

- 混合懲罰同時包含絕對值和與平方和。
- 適合比較「相關特徵多、又需要稀疏」的情況。
- λ₁、λ₂ 控制不同限制，調參比單一懲罰複雜。
- 公式的強度比例不等於實際懲罰量的比例。（補充）
