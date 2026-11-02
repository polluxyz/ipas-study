---
id: recurrent-gradients
title: BPTT 與梯度消失、爆炸
kind: problem
codes: [L23203]
aliases: [BPTT, Exploding Gradient, Vanishing Gradient]
summary: BPTT 沿時間反傳，局部導數連乘可能讓遠處梯度衰減或放大
goals:
  - id: g1
    text: 以時間展開與連乘例子解釋長期依賴難學，辨認串行及梯度限制
requires: [rnn, backpropagation]
guide_refs: [guide-3:4-73, guide-3:4-74, guide-3:3-27, guide-3:4-75]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: gradient-product
    source: https://d2l.ai/chapter_recurrent-neural-networks/bptt.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工程師用純量鏈模擬長序列反傳，末端梯度為 1，每段局部導數固定 0.5。經四段後，傳回起點的梯度是多少？
    options: { A: "0.0625", B: "0.2500", C: "2.0000", D: "4.0000" }
    answer: A
    explain:
      A: 1 連乘四次 0.5，得到 0.5 的四次方 0.0625。
      B: 0.25 只乘了兩次 0.5，少算兩段。
      C: 2 是把四個導數相加，鏈式法則在單一路徑要連乘。
      D: 4 沒有反映每段導數小於一而衰減的效果。
  - id: c2
    goal: g1
    type: choice
    prompt: 語音模型讀 400 步特徵後梯度偶爾暴增。團隊加梯度裁剪，並聲稱長期資訊從此完全不會遺失。哪個判讀正確？
    options:
      A: 裁剪會把過小梯度放大，因而恢復所有遠距離訊號
      B: 裁剪會讓全部時間步獨立，因而取消串行計算限制
      C: 裁剪能限制過大梯度，但仍要處理遠距離訊號衰減
      D: 裁剪會增加時間步權重，因而讓各步記住完整歷史
    answer: C
    explain:
      A: 裁剪主要限制過大梯度，並不把已衰減的遠距離訊號恢復。
      B: 裁剪沒有移除狀態對前一步的依賴，因此時間軸仍有串行限制。
      C: 爆炸和消失是不同問題，抑制大梯度不代表解決小梯度。
      D: 裁剪不會增加模型參數，也不會提供無限記憶。
---

## 為什麼需要

若現在的損失要教會模型利用很久以前的訊息，梯度必須沿狀態傳遞的路徑回去。路徑越長，遠處訊號越可能太小，或被放大到使訓練失穩。

時間反向傳播（BPTT，英文為 Backpropagation Through Time）把 RNN 依時間展開，再用鏈式法則反傳。它是訓練方法；梯度消失與爆炸是過程中可能遇到的問題。

## 直覺

前向計算由早到晚更新狀態；反向則由損失沿相反方向回傳。每跨一步，訊號都受那一步的局部導數影響。

![實線往後傳狀態，虛線往前傳梯度；越早的狀態要經過越多段反傳。](figure:l23203-recurrent-gradients-path)

:::supplement[來源：Dive into Deep Learning 9.7]
共享權重在展開圖中出現多次，來自各位置的梯度貢獻最後要加總，再更新同一組參數。不能把每步都當成彼此獨立的一層，各自學一套權重。
:::

## 定義與公式

梯度消失使早期狀態收到很弱的學習訊號，難以學到長期依賴；梯度爆炸則可能使更新過大。兩者都可能出現在很長的反傳路徑。

### 單一路徑的連乘（補充）

$$
g_0=g_T\prod_{t=1}^{T}a_t
$$

- $T$ 是跨越的狀態轉換數；$g_T$ 是末端梯度，$g_0$ 是傳回起點的梯度。
- $a_t=\partial h_t/\partial h_{t-1}$ 是第 $t$ 段的局部導數。

這是純量鏈且只看末端損失的簡化例。

若各段均為同一個 $a$，式子成為 $g_0=g_Ta^T$。真實向量 RNN 用雅可比矩陣連乘；不能只看遞迴權重的一個數，就斷言所有方向都爆炸或消失。

## 算一次（補充）

共用例子的能源與醫療都有四步視窗。這裡另取四次狀態轉換的梯度探針，由初始狀態 $h_0$ 到 $h_4$；末端梯度固定為 1。

每段導數 0.5 與 1.5 是教學用的固定值，並非「遞迴神經網路與序列狀態」頁 Tanh 例子的實際導數。

| 跨過幾段 | 每段導數 0.5 | 每段導數 1.5 |
|---|---|---|
| 1 | 0.5 | 1.5 |
| 2 | 0.25 | 2.25 |
| 3 | 0.125 | 3.375 |
| 4 | 0.0625 | 5.0625 |

第一種由 $1\times0.5^4=0.0625$ 衰減；第二種由 $1\times1.5^4=5.0625$ 放大。四段已出現差距；更長的鏈會把這種差距拉大。

## 程式（補充）

用自動微分核對兩種連乘，沒有訓練模型，也不需隨機資料。

```python
import json, os
from pathlib import Path
import torch
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L23203-F-sequences.json").read_text(encoding="utf-8"))
p = d["gradient_probe"]
for a in p["local_derivatives"]:
    h0 = torch.tensor(1.0, requires_grad=True)
    h = h0
    for _ in range(p["steps"]):
        h = a * h
    h.backward()
    print(a, "起點梯度:", round(h0.grad.item(), 4))
```
```text
0.5 起點梯度: 0.0625
1.5 起點梯度: 5.0625
```

## 怎麼用、怎麼判讀

長句、長音訊、長感測紀錄都可能讓梯度跨越許多時間步。即使運用 GPU，下一步狀態仍依賴上一步；序列內的時間計算有先後限制。

梯度裁剪用來限制過大梯度，降低發散或數值不穩定的風險。LSTM、GRU 的門控則改善長期資訊的保留。

:::supplement[來源：Dive into Deep Learning 9.7；10.1]
裁剪與門控都不保證任意長度下完全沒有梯度問題。

截斷 BPTT 只反傳有限步，可減少記憶體與計算負擔，代價是較遠的依賴不再經這段梯度直接學習。批次中的不同序列仍可平行處理，與時間軸依賴並不矛盾。
:::

### 換個場景

| 場景 | 要跨越的依賴 | 觀察重點 |
|---|---|---|
| 長文字、語音 | 早期詞語或音節影響後段 | 長序列的梯度與串行負擔 |
| 股票、天氣、感測、醫療趨勢 | 早期變化影響後來預測 | 記憶距離與可用歷史 |
| 影片動作辨識 | 多幀累積的動作訊息 | 長片段的時間成本 |
| 零售旺季需求（補充） | 很早的促銷影響後續銷量 | 四步視窗可能根本未涵蓋依賴 |
| 交通壅塞預測（補充） | 上游較早的車流影響下游 | 分辨視窗不足與學不到 |

## 常見誤解

- 「梯度爆炸代表輸入資料一定很大。」局部導數反覆連乘也能放大訊號。（補充）
- 「時間步各有一套獨立權重。」BPTT 對同一組共享參數彙整梯度。
- 「裁剪梯度就能修復消失。」裁剪不會還原已衰減的訊號。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-73`～`guide-3:4-74`：支持展開反傳、長期依賴與串行限制；已回看 PDF 111～112 頁。
- 科目 3 指引 `guide-3:3-27`、`guide-3:4-75`：支持梯度裁剪限制過大梯度，以及門控改善長期依賴。
- [Dive into Deep Learning 9.7](https://d2l.ai/chapter_recurrent-neural-networks/bptt.html)：支持連乘、權重貢獻加總、截斷與裁剪。
- [Dive into Deep Learning 10.1](https://d2l.ai/chapter_recurrent-modern/lstm.html)：支持門控改善長期資訊路徑的補充。

## 小結

- BPTT 將 RNN 沿時間展開，再反傳梯度。
- 多段局部導數連乘可能衰減或放大遠處訊號。
- 狀態相依使時間軸不能任意同時計算。
- 裁剪、門控與截斷各有作用及限制。（補充）
