---
id: ranking-reconstruction-loss
title: 排序與重建損失
kind: theory
codes: [L23103]
aliases: [Ranking Loss, Reconstruction Loss]
summary: 排序要求相對次序正確，重建要求輸出保留輸入的內容
goals:
  - id: g1
    text: 區分排序配對與輸入重建的流程、任務條件與損失數值
requires: [mean-squared-error, vector-inner-product]
guide_refs: [guide-3:3-19, guide-3:3-22]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: pairwise-ranking
    source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.MarginRankingLoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
  - id: reconstruction-error
    source: https://keras.io/api/losses/regression_losses/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 推薦系統已知某人偏好商品甲勝過乙，模型分數為 0.7 與 0.2，使用 margin=1 的成對排序損失。下列何者正確？
    options:
      A: 損失為 0.5；即使順序正確，間隔仍可能不足
      B: 損失為 0；只要甲比乙高就滿足 margin=1
      C: 損失為 0.7；只要看較優商品的分數即可
      D: 損失為 0.2；低分商品的分數就是錯誤量
    answer: A
    explain:
      A: 1−0.7+0.2 等於 0.5，分數差 0.5 還未達到指定的 1。
      B: 順序正確只表示差值大於零，與達到 margin=1 不同。
      C: 排序損失需要同一配對兩個分數，不能只看較優者。
      D: 低分本身不是錯誤量，要比較配對差值與 margin。
  - id: c2
    goal: g1
    type: choice
    prompt: 自編碼器輸入兩個標準化特徵 [1,2]，重建成 [0,2]。用每特徵平均平方誤差計算重建損失，哪個說法正確？
    options:
      A: 損失為 1，因為只除以出錯特徵的數目
      B: 損失為 0，因為兩個輸出仍維持由小到大的順序
      C: 損失為 2，因為輸入共有兩個特徵
      D: 損失為 0.5，必須逐個對齊特徵比較
    answer: D
    explain:
      A: 本題平均涵蓋全部兩個特徵，不只涵蓋出錯的一個。
      B: 重建要保留特徵數值，只有順序相同並不足夠。
      C: 維度決定平均的分母，不是直接作為損失值。
      D: 平方差為 1 與 0，相加除以 2 得 0.5。
---

## 為什麼需要

搜尋引擎需要把較相關的結果排前面，自編碼器則要從壓縮表示還原輸入。兩者都能定義損失，但「做得好」的意思不同。

排序損失（Ranking Loss）看相對順序；重建損失（Reconstruction Loss）看輸入與重建輸出的差距。指引分別以搜尋推薦、自編碼器及生成模型說明用途。

## 直覺

| 任務 | 先備訊息 | 模型輸出 | 比較對象 |
|---|---|---|---|
| 排序 | 同一情境下誰應排前面 | 每個候選的分數 | 較優與較劣的分數差 |
| 重建 | 要保留的原始輸入 | 與目標對齊的向量或像素 | 同位置的輸入與輸出 |

:::supplement[來源：PyTorch MarginRankingLoss；Keras 迴歸損失]
排序時，所有候選一起加 10 分通常不改相對次序。重建時，所有像素一起加 10 卻會改變內容，不能當成同樣好的還原。
:::

## 定義與公式（補充）

### 一種成對排序損失（補充）

$$
\ell_{\rm rank}=\max(0,m-s_++s_-)
$$

$s_+$ 是應排前面的候選分數，$s_-$ 是應排後面的分數，$m>0$ 是希望保留的間隔。兩個分數必須屬於同一查詢或同一比較情境。

損失為零表示 $s_+-s_-\geq m$。順序已對、但間隔不足時仍有損失；本頁採用的是 hinge 型成對版本，不是所有排序損失的唯一形式。

### 一種均方重建損失（補充）

$$
\ell_{\rm recon}=\frac1d\sum_{j=1}^{d}(x_j-\hat x_j)^2
$$

$x$ 是原始輸入，$\hat x$ 是重建輸出，$d$ 是對齊的特徵或像素總數。$j$ 表示同一個位置；兩向量的維度、位置與單位必須一致。

此式適用於以平方差衡量保真度的連續數值目標。重建也能依資料性質改用其他損失，並非所有生成模型都只使用均方誤差。

## 算一次（補充）

### 排序：先定配對，再看差值（補充）

共用醫療資料以正類個案比負類優先作教學排序，配對索引固定為 `(0,1)`、`(2,3)`、`(4,5)`。這是示範排序訊號，不代表實際醫療排程。

1. 每筆先產生分數；此處沿用同一組風險機率。
2. 依配對表找出 $s_+$、$s_-$，計算分數差。
3. 用 $m=1$ 減去差值，負數截為零，再平均三對。

| 配對 | $s_+,s_-$ | 差值 | 排序損失 |
|---|---|---|---|
| M01、M02 | 0.9、0.8 | 0.1 | 0.9 |
| M03、M04 | 0.2、0.3 | −0.1 | 1.1 |
| M05、M06 | 0.7、0.1 | 0.6 | 0.4 |

平均為 $(0.9+1.1+0.4)/3=0.8$。中間配對的順序顛倒，故懲罰超過 margin；第一對順序正確，卻還沒達到指定間隔。

一般排序分數不必是機率。若將分數限制在 0 到 1，margin=1 很嚴格，本例用它展示間隔的作用；不能據此把機率校準與排序品質視為同一件事。

### 重建：編碼、解碼、對齊（補充）

共用向量 $x=(1,2)$ 是兩個標準化生理特徵。經編碼取得壓縮表示，再經解碼得到 $\hat x=(0,2)$；本例只核算輸出，不另訓練自編碼器。

| 位置 | 輸入 | 重建 | 平方差 |
|---|---|---|---|
| 第一特徵 | 1 | 0 | 1 |
| 第二特徵 | 2 | 2 | 0 |

平均重建損失是 $(1+0)/2=0.5$。排序平均 0.8 與重建平均 0.5 分別評價不同目標、不同單位，不能據此說重建模型比較好。

若輸出是影像，把表中的「特徵位置」換成固定位置的像素即可。同一位置要對同一位置，不能先任意重排像素再計算。

## 程式（補充）

```python
import torch
# 固定種子沿用本組約定；本段無隨機運算，結果不受種子影響。
torch.manual_seed(23103)
s = torch.tensor([.9, .8, .2, .3, .7, .1], dtype=torch.float64)
better, worse = s[[0, 2, 4]], s[[1, 3, 5]]
rank = torch.nn.MarginRankingLoss(margin=1., reduction="none")
values = rank(better, worse, torch.ones_like(better))
print("排序", [round(v, 1) for v in values.tolist()])
print(f"排序平均 {values.mean().item():.6f}")
x, reconstruction = torch.tensor([1., 2.]), torch.tensor([0., 2.])
print(f"重建 {torch.nn.MSELoss()(reconstruction, x).item():.6f}")
print("排序平移不變", torch.allclose(values, rank(better+10, worse+10, torch.ones_like(better))))
print("達間隔", rank(torch.tensor([1.]), torch.tensor([0.]), torch.ones(1)).item())
```
```text
排序 [0.9, 1.1, 0.4]
排序平均 0.800000
重建 0.500000
排序平移不變 True
達間隔 0.0
```

:::tip[讀碼重點]
`MarginRankingLoss` 的標籤 1 表示第一個輸入應比第二個高，與對比損失的「相似」標籤不同。`MSELoss` 則逐位置比較，預設平均所有元素。
:::

## 怎麼用、怎麼判讀

先問監督訊號是相對偏好，還是希望還原的內容。搜尋與推薦用排序目標，自編碼器與部分生成模型用重建目標。

:::supplement[來源：Dive into Deep Learning 21.5；Deep Learning 第 14 章]
排序配對必須有可信的偏好方向；「未點擊」未必真是不喜歡。重建需先對齊位置與尺度，低重建誤差也不直接證明表示能解決下游分類。
:::

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 搜尋引擎、推薦系統 | 同情境的相對偏好 | 相關項目是否排前 |
| 自編碼器、生成模型 | 有可對齊的輸入與輸出 | 是否保留指定內容 |
| 房屋推薦（補充） | 同買方偏好的一對房屋 | 預算偏好與房價誤差不同 |
| 醫療特徵壓縮（補充） | 維度及尺度已對齊 | 哪些生理特徵還原失真 |
| 工業影像去雜訊（補充） | 乾淨目標與輸出像素對齊 | 不只看候選影像的排名 |

## 常見誤解

- 排序關注相對次序，重建關注輸入與輸出的差異。
- 排序損失為零只代表本批配對滿足所設間隔，不代表所有查詢都排對。（補充）
- NDCG 是排序評估指標，不能直接視為本頁可供梯度訓練的 hinge 損失。（補充）

## 進階

### 參考來源

- 科目 3 學習指引（版本未標示；本機快照）`guide-3:3-19`、`guide-3:3-22`：支持相對次序、搜尋推薦與重建用途，未列本頁公式。
- [PyTorch MarginRankingLoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.MarginRankingLoss.html)：支持成對 hinge 公式、margin 與標籤方向。
- [Keras 迴歸損失](https://keras.io/api/losses/regression_losses/)：支持均方誤差的逐元素平均。
- [Dive into Deep Learning 21.5](https://d2l.ai/chapter_recommender-systems/ranking.html)：參考由偏好配對走到排序目標的教學安排。
- [Deep Learning 第 14 章](https://www.deeplearningbook.org/contents/autoencoders.html)：支持編碼、解碼與重建目標的條件。
- [TensorFlow 自編碼器教學](https://www.tensorflow.org/tutorials/generative/autoencoder)：參考重建與去雜訊的流程說明。

## 小結

- 排序利用相對偏好，重建比較輸入與輸出。
- 先確認比較對象，再選擇可表達任務的損失。
- 分數間隔、像素位置與平均分母不同時，損失數值不能直接互比。（補充）
