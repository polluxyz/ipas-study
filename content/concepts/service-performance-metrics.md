---
id: service-performance-metrics
title: 推論延遲、吞吐與可用率
kind: metric
codes:
  - L21302
aliases:
  - Latency
  - P50
  - P95
  - P99
  - RPS
  - Throughput
  - Uptime
requires:
  - inference-service-api
summary: 延遲看等多久，吞吐看完成多少，可用率看服務是否持續達標
goals:
  - id: g1
    text: 依單位與工作負載區分延遲、吞吐、可用率及資源用量
  - id: g2
    text: 計算 P50、P95、P99 與 RPS，分辨併發、批次處理及單筆等待
formula_groups:
  - id: latency-percentile
    source: https://numpy.org/doc/stable/reference/generated/numpy.quantile.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
  - id: service-ratios
    source: https://sre.google/sre-book/service-level-objectives/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
  - id: little-law
    source: https://web.mit.edu/2.810/www/files/lectures/lec1-intro-2019.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: GPU 記憶體使用 6/8 GiB，請求 P95 卻從 100 ms 升至 800 ms。哪個判斷最合理？
    options:
      A: 記憶體使用率 75% 就等於 GPU 計算效率 75%
      B: 資源占用與使用者延遲不同，應再查排隊、計算及下游耗時
      C: 記憶體尚未用滿，所以延遲紀錄一定錯誤
      D: 只看吞吐，不必看失敗請求
    answer: B
    explain:
      A: 記憶體容量占用不等於計算單元有效工作比例。
      B: 不同指標回答不同問題，需沿端到端路徑定位。
      C: 網路、排隊或下游都可能在記憶體未滿時拖慢服務。
      D: 錯誤可能很快或很慢，都應另外觀察。
  - id: c2
    goal: g2
    type: choice
    prompt: 10 筆延遲排序為 10、20、30、40、50、60、70、80、90、200 ms。採最近秩定義，P95 是多少？
    options:
      A: 90 ms
      B: 95 ms
      C: 150.5 ms
      D: 200 ms
    answer: D
    explain:
      A: 90 ms 只涵蓋前 9 筆，也就是 90% 的觀測。
      B: 百分位不是把百分比直接當成毫秒數。
      C: 這是採另一種插值算法的可能結果，並非題目指定的方法。
      D: 向上取整 10×0.95 得第 10 筆，為 200 ms。
  - id: c3
    goal: g2
    type: choice
    prompt: 一次批次處理 8 筆模型運算花 40 ms，最早到達的請求還等了 30 ms 才湊批。哪個說法正確？
    options:
      A: 該筆至少等 70 ms 才完成模型階段，不能用 40/8 當延遲
      B: 每筆端到端延遲一定只有 5 ms
      C: 每秒一定能成功完成 200 筆，不需量測其他成本
      D: P95 一定等於平均併發數乘以 RPS
    answer: A
    explain:
      A: 等待 30 ms 加上批次運算 40 ms，還未計其他介接成本。
      B: 40/8 是攤提成本，請求仍要等待整批完成。
      C: 200 是只算這項批次運算的理想吞吐，忽略其他時間與錯誤。
      D: 平均併發關係使用平均時間，不能直接換成 P95。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-20
---

## 為什麼需要

模型離線分數很好，使用者仍可能遇到等待、錯誤或服務中斷。部署後要另外觀察系統指標，知道服務是否能持續承接實際工作。

指引列出推論延遲、吞吐量、服務可用率與資源使用率。它們回答不同問題，不能只挑一個漂亮數字代表全部。

## 直覺

先問一筆要等多久，再問一段時間完成多少，最後確認是否持續可用、資源用在哪裡。量測時要寫清楚時間窗與工作負載。

### 多數很快，少數很慢（補充）

共用客服資料有 30 筆端到端耗時。大部分很快，但少數失敗回應拖到 300 到 1000 ms，平均值會把這些差異壓在一起。

![比較同一域的 P50、P95、P99，長尾明顯高於典型請求；兩域工作負載不同，不能據此宣稱模型優劣。](figure:l21302-service-performance-metrics-percentiles)

## 定義與公式

| 指標 | 問什麼 | 單位與條件 |
|---|---|---|
| 推論延遲（Inference Latency） | 一筆從送出到回應要多久 | ms；明確界定是否含排隊及網路 |
| 吞吐量（Throughput） | 單位時間完成多少工作 | 筆／秒；說明是否只計成功 |
| 服務可用率（Uptime） | 約定時間是否能提供服務 | %；先定義可用條件 |
| 資源使用率 | CPU、GPU、記憶體等用多少 | % 或 GiB；各自的採樣條件 |

### 分位數與比率（補充）

本頁使用最近秩，等同等權重經驗分布的反函數。將 $n$ 筆延遲由小到大排成 $x_{(1)},\ldots,x_{(n)}$，對 $0<p\le1$ 定義：

$$
P_{100p}=x_{(\lceil np\rceil)}
$$

$p$ 是欲涵蓋比例，例如 0.95；$\lceil np\rceil$ 是向上取整的序位。30 筆的 P50、P95、P99 分別取第 15、29、30 筆，結果在「算一次」。

$$
\begin{aligned}
R&=N/T,& R_{\mathrm{ok}}&=N_{\mathrm{ok}}/T\\
A_r&=G/M,& A_t&=(T-D)/T
\end{aligned}
$$

- $N$、$N_{\mathrm{ok}}$：視窗內全部回應數與主服務成功回應數。
- $M$、$G$：同批合格請求總數與成功數；逾時未回應也要納入失敗。
- $T$、$D$：觀測總秒數與無法服務秒數。
- $R$、$R_{\mathrm{ok}}$：全部與成功吞吐，單位為筆／秒。
- $A_r$、$A_t$：請求成功比例與時間可用率。

同一個「可用率」名稱可能用不同定義。時間窗沒有請求時 $A_r$ 無法計算，不能填成 100%；$T=0$ 時時間比率也沒有定義。

吞吐按完成時間計數，請求成功比例按同批合格請求結算。請求跨視窗時要保留追蹤，不能只留下已回應的請求，否則漏掉卡住的失敗。

### RPS 與併發（補充）

每秒請求數（Requests Per Second，RPS）是流率；併發是同時仍在系統內的請求數。穩定系統且量測邊界一致時，平均值滿足 Little 定律：

$$
L=\lambda W
$$

$L$ 是平均在途數，$\lambda$ 是每秒流率，$W$ 是平均停留秒數。持續每秒 100 筆、平均 0.1 秒，則 $L=100\times0.1=10$ 筆；P95 不能代替平均值。

## 算一次（補充）

使用 content/examples/L21302-C-requests.json。每域 30 筆在 10 秒內全部回應，前 7.5 秒固定每秒送 4 筆，其餘時間排空；這個快照不是穩態容量測試。

| 領域 | P50 | P95 | P99 |
|---|---|---|---|
| 客服 | 第 15 筆：120 ms | 第 29 筆：500 ms | 第 30 筆：1000 ms |
| 製造 | 第 15 筆：72 ms | 第 29 筆：300 ms | 第 30 筆：600 ms |

本表兩域的 P95、P99 取到的都是失敗回應。若只看 27 筆主服務成功回應，P95 取第 26 筆：客服為 175 ms，製造為 105 ms；這與混合全部回應的分位數回答不同問題。

每域全部回應吞吐為 30/10=3 筆／秒；主服務成功 27 次，所以成功吞吐 2.7 筆／秒、請求成功比例 90%。失敗回應也有耗時，應另外呈現成功與失敗的延遲分布。

時間可用率使用另一份故障資料：12 秒有 2 秒中斷，為 10/12≈83.33%。它與 30 筆快照的 90% 不同，兩個視窗不能混在一起算。

GPU 記憶體使用 6/8 GiB，容量占用是 75%。這個值不能當作 GPU 計算利用率，也不能證明沒有排隊。

## 程式（補充）

兩域依共用資料的固定規則重建耗時。最近秩不用插值，不可直接套用 NumPy 預設的線性插值算法。

```python
from math import ceil
support = [50 + 5*i for i in range(27)] + [300, 500, 1000]
manufacturing = [30 + 3*i for i in range(27)] + [180, 300, 600]
for name, values in [("客服", support), ("製造", manufacturing)]:
    ordered = sorted(values)
    p = [ordered[ceil(len(ordered)*q)-1] for q in (0.5, 0.95, 0.99)]
    print(name, "P50/P95/P99", p)
    successful = sorted(values[:27])  # 共用規則：前 27 筆主服務成功
    print(name, "成功回應 P95", successful[ceil(len(successful)*0.95)-1])
print(f"全部吞吐 {30/10:.1f} 成功吞吐 {27/10:.1f} 筆/秒")
print(f"主服務請求成功比例 {27/30:.0%}")
```
```text
客服 P50/P95/P99 [120, 500, 1000]
客服 成功回應 P95 175
製造 P50/P95/P99 [72, 300, 600]
製造 成功回應 P95 105
全部吞吐 3.0 成功吞吐 2.7 筆/秒
主服務請求成功比例 90%
```

## 怎麼用、怎麼判讀

服務上線後要定期回收推論效能與使用情況。固定模型版、輸入大小、硬體、批次及到達負載，再比較延遲、吞吐與資源用量。

:::supplement[來源：本頁批次教學算例；固定負載與長尾概念見 Google SRE「Monitoring Distributed Systems」「Service Level Objectives」]
批次 8 筆在 40 ms 算完，只表示這段運算平均每秒可處理 200 筆。每筆仍需等整批 40 ms；若最早一筆湊批等 30 ms，這段就至少 70 ms，尚未算其他成本。

真實基準應固定到達率並先暖機，觀察排隊是否持續增加。可完成 30 筆不代表能長時間承受同一流量；P99 在 30 筆裡等於最大值，估計也很不穩定。
:::

### 換個場景

| 場景 | 優先觀察 | 比較條件 |
|---|---|---|
| 指引：部署後持續追蹤 | 延遲、吞吐、可用與資源 | 服務範圍及回收週期 |
| 客服（補充） | 首次回應與完整回應耗時 | 問題長度與輸出長度 |
| 製造（補充） | 每件端到端等待 | 影像大小與產線節拍 |
| 推薦（補充） | 尾端延遲與錯誤 | 候選數及特徵讀取 |

## 常見誤解

- **「平均延遲快就代表所有人都快。」** 長尾會被平均值掩蓋。（補充）
- **「RPS 等於同時連線數。」** 流率與在途數不同，還要看停留時間。（補充）
- **「批次耗時除以筆數就是每筆延遲。」** 那是攤提成本，沒有包含等待整批的時間。（補充）
- **「資源用量越高越好。」** 要同時確認延遲、吞吐與可用條件。

## 進階

### 跨副本彙整（補充）

不能把各副本 P95 直接平均當全服務 P95。應合併同一視窗的觀測或可合併的分布統計，再按全部請求重算，並保留成功與失敗的分類。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-20）：支持四類系統指標與回收週期；分位數算法屬補充。
- [NumPy：quantile](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html)，Notes、inverted_cdf：支持最近秩與預設線性插值的差異。
- [Google SRE：Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)，Indicators in Practice、Aggregation：支持量測邊界、長尾與比率。
- [Google SRE：Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)，The Four Golden Signals：支持成功／錯誤延遲分開與資源飽和的教學。
- [MIT：2.810 課程](https://web.mit.edu/2.810/www/files/lectures/lec1-intro-2019.pdf)，第 56 頁 Rate and Time：支持平均在途數、流率與時間的關係。

## 小結

- 延遲、吞吐、可用率與資源用量要一起看。
- 指標一定帶單位、視窗與負載條件。
- 分位數算法與成功／失敗範圍需明確。（補充）
- 批次攤提成本不能當單筆延遲。（補充）
