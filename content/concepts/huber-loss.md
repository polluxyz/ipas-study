---
id: huber-loss
title: Huber 損失
kind: theory
codes: [L23103]
aliases: [Huber Loss]
summary: 小誤差用平方、大誤差用線性懲罰，兼顧平滑與抗離群值
goals:
  - id: g1
    text: 依誤差大小與 δ 解釋 Huber、平方與絕對損失的取捨
  - id: g2
    text: 計算 Huber 損失與殘差導數，核對分段邊界的連續性
requires: [mean-squared-error, mean-absolute-error]
guide_refs: [guide-3:3-22, guide-3:3-23]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: huber-piecewise
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.HuberLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: huber-gradient
    source: https://www.statsmodels.org/stable/generated/statsmodels.robust.norms.HuberT.psi.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 房價模型大多數誤差小於 1 百萬元，少數誤差達 10 百萬元。選 δ=1 的 Huber 損失，主要數值特徵是什麼？
    options:
      A: "誤差超過1百萬元的樣本會被排除，避免10百萬元誤差干擾模型訓練"
      B: "大誤差改為線性成長後，對殘差的導數也會繼續隨誤差線性增大"
      C: 小誤差附近平滑，大誤差的損失仍增加但斜率受限
      D: "δ=1代表誤差最多只會有1百萬元"
    answer: C
    explain:
      A: "Huber不會刪除大誤差樣本，超過δ後仍以線性成長的損失納入訓練。"
      B: "線性損失區對殘差的導數大小固定為δ，不會再隨誤差線性增大。"
      C: 平方區與線性區在邊界接上，大誤差不會產生無限增長的殘差導數。
      D: "δ是平方區與線性區的切換位置，不是預測誤差的上限。"
  - id: c2
    goal: g2
    type: choice
    prompt: 定義殘差 r=實際值−預測值，δ=1。當 r=3 時，單筆 Huber 損失與對 r 的導數分別是多少？
    options:
      A: 2.5 與 1
      B: 4.5 與 3
      C: 3 與 1
      D: 2.5 與 −1
    answer: A
    explain:
      A: 使用線性段，損失為 1×(3−0.5)，對正殘差的導數為 1。
      B: 這是把平方段延伸到整個範圍，沒有使用 δ 的切換條件。
      C: 3 是絕對誤差，漏掉銜接分段所需的常數。
      D: −1 是此時對預測值的導數，題目問的是對殘差的導數。
---

## 為什麼需要

均方誤差會放大大誤差，少數極端樣本可能主導模型調整。平均絕對誤差對極端誤差比較不敏感。

Huber 損失（Huber Loss）結合兩者的特性。指引把它放在迴歸任務，作為穩定學習與抵抗雜訊的折衷。

## 直覺

Huber 結合平方與絕對懲罰的特性，在穩定學習與抗雜訊之間取捨。

:::supplement[來源：PyTorch HuberLoss；CMU 統計計算課程]
絕對損失在零點有尖角，非零殘差的導數幅度固定為 1，接近零時不會逐漸變小。Huber 則在小誤差附近平滑，用正數門檻 $\delta$ 決定何時轉成線性懲罰。
:::

![上圖比較單筆平方、絕對與 Huber 損失，下圖看對殘差的導數；Huber 在正負 δ 外的斜率不再增大。](figure:l23103-huber-loss-shape)

:::supplement[來源：PyTorch HuberLoss]
圖中的平方損失是 $r^2$，Huber 小誤差段則是 $r^2/2$。因此圖高低也受尺度影響，不能只憑較低的曲線宣稱方法較好。
:::

## 定義與公式（補充）

### 分段損失（補充）

$$
\ell_\delta(r)=
\begin{cases}
\frac12r^2,& |r|\leq\delta,\\
\delta\left(|r|-\frac12\delta\right),& |r|>\delta.
\end{cases}
$$

$r=y-\hat y$ 是實際值減預測值的殘差，$\delta>0$ 與殘差使用相同單位。$|r|$ 表示絕對值；整批可把每筆 $\ell_\delta$ 加總後除以樣本數。

$\delta$ 較大時，更多誤差落在平方段；較小時，更多誤差落在線性段。改用元或百萬元會改變殘差尺度，$\delta$ 也要相應調整。

### 導數與接點（補充）

把上式對 $r$ 微分：

$$
\frac{d\ell_\delta}{dr}=
\begin{cases}
r,& |r|\leq\delta,\\
\delta\operatorname{sign}(r),& |r|>\delta.
\end{cases}
$$

$\operatorname{sign}(r)$ 在正數時是 1、負數時是 −1。因 $r=y-\hat y$，對預測值的導數要再乘 −1；若使用平均損失，每筆貢獻還要除以樣本數。

statsmodels 的 `HuberT.psi` 直接列出這個導數；其符號 $t$ 對應本頁的 $\delta$，$z$ 對應本頁的 $r$。

在正邊界，兩段損失皆為 $\delta^2/2$，導數皆為 $\delta$。負邊界的損失相同，導數皆為 $-\delta$，所以一階導數連續。

## 算一次（補充）

共用房價殘差是 `[-1,0,1,2,3,10]`，單位百萬元。取 $\delta=1$，先看平方段、邊界與線性段。

| 殘差 $r$ | 使用的段 | 損失 | 對 $r$ 的導數 |
|---|---|---|---|
| 0.5 | 平方段 | $0.5\times0.5^2=0.125$ | 0.5 |
| 1 | 兩段接點 | $0.5\times1^2=0.5$ | 1 |
| 3 | 線性段 | $1\times(3-0.5)=2.5$ | 1 |

六筆 Huber 損失依序為 `[0.5,0,0.5,1.5,2.5,9.5]`。固定同一批殘差，再比較三種平均：

| 損失 | 總和 | 六筆平均 |
|---|---|---|
| 平方 | 115 | 19.166667 |
| 絕對 | 17 | 2.833333 |
| Huber | 14.5 | 2.416667 |

平方欄沒有乘 $1/2$；若改用 $r^2/2$，六筆平均是 9.583333。比較曲線時須分開看係數尺度與大誤差段的形狀。

最後一筆 $r=10$ 對平方損失的導數是 20，對 Huber 的導數是 1。這才是「限制單筆大誤差拉力」的數值依據；損失較小本身並不是準確度提升的證據。

## 程式（補充）

```python
import torch
# 固定種子沿用本組約定；本段無隨機運算，結果不受種子影響。
torch.manual_seed(23103)
r = torch.tensor([.5, 1., 3., -1.], requires_grad=True)
loss = torch.nn.HuberLoss(delta=1., reduction="none")(r, torch.zeros_like(r))
loss.sum().backward()
print("損失", loss.detach().tolist())
print("殘差導數", r.grad.tolist())
batch = torch.tensor([-1., 0., 1., 2., 3., 10.])
value = torch.nn.HuberLoss(delta=1.)(batch, torch.zeros_like(batch))
print(f"六筆平均 {value.item():.6f}")
boundary = torch.tensor([-1., 1.], dtype=torch.float64)
left = .5 * boundary.square()
right = boundary.abs() - .5
print("邊界損失相等", torch.equal(left, right))
```
```text
損失 [0.125, 0.5, 2.5, 0.5]
殘差導數 [0.5, 1.0, 1.0, -1.0]
六筆平均 2.416667
邊界損失相等 True
```

:::tip[讀碼重點]
程式把殘差當可微分輸入，故 `r.grad` 就是對殘差的導數。使用 `sum()` 檢查單筆導數，避免平均造成額外的除數。
:::

## 怎麼用、怎麼判讀

指引將 Huber 用於連續數值預測，希望兼顧穩定與抗雜訊。大誤差特別重要時，均方誤差的強烈懲罰也可能符合任務目的。

:::supplement[來源：PyTorch HuberLoss]
先確認離群值是資料錯誤還是真實罕見事件，再決定是否降低其影響。用驗證資料選 $\delta$；Huber 限制對殘差的導數，並不保證整個神經網路的參數梯度一定很小。
:::

### 換個場景

| 場景 | 適用條件 | 判讀重點 |
|---|---|---|
| 迴歸的穩定與抗雜訊折衷 | 輸出為連續數值 | 不只看大誤差，也看學習平穩程度 |
| 房價預測（補充） | 大多數誤差小、少數很大 | 百萬元與元要用不同 δ |
| 醫療風險分數迴歸（補充） | 標籤是真實連續風險目標 | 別把二元類別標籤誤當連續目標 |
| 設備壽命（補充） | 含少數感測雜訊 | 真實故障極端值仍可能重要 |

## 常見誤解

- 抗雜訊不是不處理大誤差，而是改變大誤差的影響方式。
- 小誤差段是半平方，不等於未縮放的整個均方誤差。（補充）
- $\delta=1$ 時 Huber 與 Smooth L1 一致，其他相同門檻下兩者相差 $\delta$ 倍，不能只比函式名稱。（補充）

## 進階

### 參考來源

- 科目 3 學習指引（版本未標示；本機快照）`guide-3:3-22`、`guide-3:3-23`：支持迴歸取捨與雜訊情境，未列 Huber 分段式。
- [PyTorch HuberLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.HuberLoss.html)：支持公式、δ、程式與 Smooth L1 尺度差異。
- [Keras 迴歸損失](https://keras.io/api/losses/regression_losses/)：獨立核對分段公式；導數與連續性由該式推算。
- [statsmodels HuberT.psi](https://www.statsmodels.org/stable/generated/statsmodels.robust.norms.HuberT.psi.html)：直接支持分段導數；來源的 t、z 分別對應本頁 δ、r。
- [CMU 統計計算課程](https://www.stat.cmu.edu/~ryantibs/statcomp-F15/lectures/functions.html)：參考逐個誤差代入分段的教法；該課版本是本頁 δ=1 損失的兩倍。

## 小結

- Huber 在迴歸中折衷平方懲罰與線性懲罰。
- δ 決定切換位置，必須配合誤差單位。（補充）
- 邊界的損失與一階導數接合，大誤差的殘差導數幅度受限。（補充）
