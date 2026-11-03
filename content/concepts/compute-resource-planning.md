---
id: compute-resource-planning
title: 算力與訓練推論資源配置
kind: technique
codes: [L21202]
aliases: []
requires: [it-readiness]
summary: 算力配置依訓練與推論工作、容量、延遲及隱私條件分配硬體
goals:
  - id: g1
    text: 比較雲端與地端資源，核對訓練推論的記憶體、延遲與容量，辨認不必用 GPU 的情境
formula_groups:
  - id: memory-budget
    source: https://openstax.org/books/precalculus-2e/pages/11-4-series-and-their-notations
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21202-A
  - id: serial-latency-budget
    source: https://openstax.org/books/precalculus-2e/pages/11-4-series-and-their-notations
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21202-A
  - id: serving-node-count
    source: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/#algorithm-details
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21202-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 製造案的影像不得出廠，訓練需 12 GiB 顯示記憶體，簡化後的 CPU 推論已在指定負載下達門檻。哪個配置最合理？
    options:
      A: 只買 8 GiB GPU，因為平均用量可能較低
      B: 訓練與推論都必須傳到外部 GPU，資料限制之後再處理
      C: 所有 AI 工作都只能用 GPU，因此取消 CPU 測試結果
      D: 訓練規劃可容納預算的地端 GPU，推論依 CPU 壓測與容量另配資源
    answer: D
    explain:
      A: 已知預算超過容量，不能以未驗證的平均值取代峰值及配置檢查。
      B: 這不符合本案資料邊界，也沒有證明外部 GPU 是必要條件。
      C: 硬體要依模型和服務需求判斷，AI 推論不必然需要 GPU。
      D: 訓練與推論分開評估，並同時符合容量、隱私與服務條件。
  - id: c2
    goal: g1
    type: choice
    prompt: 零售尖峰為每秒 60 次請求，單節點在指定延遲條件下壓測可處理每秒 40 次，規劃只用其 75% 能力。先不計故障冗餘，至少需幾個節點？
    options:
      A: 2 個，因為每節點規劃承接 30 次／秒
      B: 1 個，因為單節點 40 次／秒已接近 60
      C: 3 個，因為把 60 除以 40 後直接再加 1.5
      D: 40 個，因為每秒請求數就是節點數
    answer: A
    explain:
      A: 40 乘 0.75 為 30，60 除以 30 為 2，之後仍需整體壓測。
      B: 以規劃負載只有 30 次／秒，無法承接 60 次／秒。
      C: 節點數應依規劃能力相除後向上取整，不能任意增加小數。
      D: 單節點可處理多個請求，兩種單位不能直接等同。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:4-18]
---

## 為什麼需要

模型訓練要跑完，線上服務則要及時回應。只寫「需要一台 GPU」沒有交代記憶體夠不夠、服務流量多大，也沒有處理資料能否離開現場。

指引列出 GPU、雲端運算與儲存、本地設備三類資源。配置要配合任務、人力及時程，不是按設備名稱判斷專案成熟度。

## 直覺

:::supplement[來源：Google「Production ML systems」；「Static versus dynamic inference」]
訓練（Training）是用資料調整模型；推論（Inference）是拿已訓練模型產生預測。兩種工作可使用不同硬體，資源也要分別盤點。
:::

![模型經審查才交給推論區；請看訓練設備與線上節點分開，不把一台訓練機當成全部服務容量。](figure:l21202-compute-resource-planning-training-serving)

:::supplement[來源：Google「Static versus dynamic inference」；Google Cloud「Best practices for implementing machine learning」]
本圖的訓練與服務分區是補充設計。訓練可以容許較長耗時，線上推論要關注每次請求的完整路徑；小模型可能用 CPU 就達標，應以實測選擇。
:::

## 定義與公式

### 先比較資源選項

| 資源 | 指引列出的適用條件 | 配置要問什麼 |
|---|---|---|
| GPU | 深度學習訓練、推論；影像或自然語言任務 | 哪一段需要加速 |
| 雲端儲存及計算 | 大資料量、即時處理、彈性擴展 | 資料與運算能否按需求調度 |
| 本地工作站或伺服器 | 小型試辦、敏感資料；如病患資料 | 本地資源能否支撐任務 |

指引以 NVIDIA A100 舉例說明 GPU 加速深度學習運算，不代表所有任務都必須採用這款硬體。

### 記憶體預算（補充）

OpenStax 第 11.4 節把有限項加總記為 $\sum_{i=1}^{n}a_i=a_1+\cdots+a_n$。

將 $a_i$ 對應到本例的分項額度 $m_i$，定義總預算；容量由已分配與餘裕組成，移項即可求餘裕。

這是本例依加總定義建立的規劃式，不是外部文件提供的記憶體模型。$n$ 是分項數，各項須同單位且不重複。

$$
M_{\mathrm{plan}}=\sum_{i=1}^{n}m_i,\qquad M_{\mathrm{cap}}=M_{\mathrm{plan}}+H,\qquad H=M_{\mathrm{cap}}-M_{\mathrm{plan}}
$$

$m_i$ 是分項額度，$M_{\mathrm{plan}}$ 是總額，$M_{\mathrm{cap}}$ 是容量，$H$ 是餘裕，單位皆為 GiB。顯示記憶體與主記憶體各算一份。

製造訓練：權重、梯度及優化器 4，加活化值 6、工作區 2，共 12 GiB。容量 16，餘裕 4 GiB；若餘裕為負就不符合預算，真實峰值仍需量測。

### 串行路徑的延遲預算（補充）

沿用 OpenStax 的有限項加總，將 $a_i$ 對應到串行路徑第 $i$ 段的時間額度 $b_i$，$n$ 是段數。按本例定義，總預算是各段額度之和；再檢查是否超過業務上限。

$$
L_{\mathrm{plan}}=\sum_{i=1}^{n}b_i\leq L_{\mathrm{limit}}
$$

$b_i$ 是第 $i$ 段配置的時間額度，$L_{\mathrm{plan}}$ 是總額，$L_{\mathrm{limit}}$ 是業務上限，單位皆為 ms。輸入段含本例分配給傳輸與排隊的額度。

製造案配置輸入 8、前處理 12、模型 20、回應 5，共 45 ms，小於 50 ms。這些是同一路徑的預算；不同段量測的 p95 相加，不是端到端 p95。

### 依流量估節點數（補充）

Kubernetes 的基本副本數公式，是目前副本數乘上「目前指標／目標指標」，再向上取整。

將目前副本數對應為 $N_0$、每單位平均請求率為 $\lambda/N_0$、目標請求率為 $q u$，即可化簡：

$$
N=\left\lceil N_0\frac{\lambda/N_0}{q\,u}\right\rceil=\left\lceil\frac{\lambda}{q\,u}\right\rceil
$$

$N_0>0$ 是推導用的目前副本數。本例再假設每個等規格節點承接一個服務副本，才把結果解讀為節點數；Pod 通常不等於實體節點，也沒有在此實作完整自動擴展控制器。

$\lambda$ 是尖峰請求數／秒，$q$ 是指定條件下的單節點壓測能力，$u$ 是規劃負載比例，$N$ 為整數節點數；向上取整以免容量不足。

使用時 $q>0$、$0<u\leq1$。本例計算正流量；零流量時也可能為可用性保留節點，不能只按此式決定常駐數量。

製造案代入：

$$
N=\lceil25/(16\times0.8)\rceil=\lceil1.953125\rceil=2
$$

此式假設負載能均衡分配、能力近似相加，不含節點故障冗餘，還要用完整服務驗證。

## 算一次

### 共用兩案核對（補充）

數字來自 `L21202-A-projects.json`，都是規劃假設。訓練與推論記憶體各算一次，不能把訓練 GPU 的餘裕拿來抵推論節點不足。

| 項目 | 製造地端檢測 | 零售推薦 |
|---|---|---|
| 訓練記憶體／容量 | 4+6+2=12／16 GiB | 2+4+2=8／16 GiB |
| CPU 推論記憶體／容量 | 1+2+1=4／8 GiB | 1+2+1=4／8 GiB |
| 延遲預算／上限 | 8+12+20+5=45／50 ms | 15+25+50+10=100／120 ms |
| 節點數 | 向上取整 25÷12.8=2 | 60÷(40×0.75)=2 |

零售小型模型以 CPU 為起點，是「不必然需 GPU」的反例。假設單節點含四個工作程序，才有表列的 40 次／秒能力；不能換成單程序後沿用同一數字。

## 程式（補充）

先將環境變數 `TEXTBOOK_REPO_ROOT` 設為本教材 repo 的根目錄。以下兩段接著執行，只讀共用 JSON，不使用亂數，也不啟動服務。

```python
import json, os
from pathlib import Path
from math import ceil
root = Path(os.environ["TEXTBOOK_REPO_ROOT"])
cases = json.loads((root / "content/examples/L21202-A-projects.json").read_text(encoding="utf-8"))["cases"]
for c in cases:
    train = sum(c["training"]["memory_parts_gib"].values())
    serving = sum(c["inference"]["memory_parts_gib"].values())
    print(c["label"], "訓練", train, "GiB；推論", serving, "GiB")
```
```text
製造地端檢測 訓練 12 GiB；推論 4 GiB
零售推薦 訓練 8 GiB；推論 4 GiB
```

```python
for c in cases:
    s = c["inference"]
    latency = sum(s["stage_budget_ms"].values())
    nodes = ceil(s["peak_rps"] / (s["tested_node_rps"] * s["target_fraction"]))
    print(c["label"], f"{latency}/{s['deadline_ms']} ms；{nodes} 節點")
```
```text
製造地端檢測 45/50 ms；2 節點
零售推薦 100/120 ms；2 節點
```

:::tip[讀碼重點]
`ceil` 要在最後取整；`target_fraction` 越小，規劃單節點承接量越少。程式只核算假設，沒有實測硬體速度。
:::

## 怎麼用、怎麼判讀

先確認資料位置限制，再看訓練與推論的設備需求。雲端適合彈性調度，本地設備適合小型試辦或敏感資料條件，兩者都要有足夠容量。

:::supplement[來源：Google Cloud「Best practices for implementing machine learning」；Google「Static versus dynamic inference」]
預算有餘裕只是開始。實際壓測要量端到端延遲、錯誤率及資源峰值；若特徵取得或排隊才是瓶頸，加快模型計算不一定解決問題。
:::

### 換個場景

先比較指引的運算與資料條件，再看小模型、批次與現場告警的資源差異。

| 場景 | 選擇重點 |
|---|---|
| 影像辨識、自然語言深度學習 | GPU 可加速訓練或推論 |
| 大量資料、需即時處理 | 評估雲端彈性運算與儲存 |
| 小型試辦、醫療敏感資料 | 評估本地設備及資料限制 |
| 零售小型模型（補充） | CPU 達標即可，再依尖峰配容量 |
| 夜間物流批次（補充） | 可預先計算，與即時服務分配不同窗口 |
| 交通現場告警（補充） | 將網路傳輸與備案列入完整路徑 |

## 常見誤解

- 「有 AI 就必須用 GPU」：依模型與需求選設備，CPU 也可能足夠。（補充）
- 「地端就必然安全」：資料存取與權限仍要驗證。（補充）
- 「權重放得下就能訓練」：還要考慮活化值、梯度等記憶體。（補充）
- 「分段 p95 加起來就是整體 p95」：百分位數通常不能如此相加。（補充）

## 進階

### 容量與可用性不同（補充）

兩節點剛好承接尖峰，不表示壞一台仍能承接。若要求單節點故障後服務也達標，要另列冗餘與故障測試，不能只靠本頁容量式保證可用性。

### 參考來源

- 科目 1 學習指引 `guide-1:4-18`：支持硬體選項、訓練推論用途、雲端彈性與敏感資料場景。
- [OpenStax《Precalculus 2e》11.4](https://openstax.org/books/precalculus-2e/pages/11-4-series-and-their-notations)，Using Summation Notation：提供有限項加總原式；記憶體與時間額度是本頁的符號對應及自訂定義。
- [Kubernetes「Algorithm details」](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/#algorithm-details)：提供基本副本數原式；本頁補請求率映射及一節點一副本假設。
- [Google Cloud 部署最佳實務](https://docs.cloud.google.com/architecture/ml-on-gcp-best-practices)的 Model deployment and serving：只支持硬體、輸入及擴展規劃背景，沒有本頁公式原式。
- [Google「Static versus dynamic inference」](https://developers.google.com/machine-learning/crash-course/production-ml-systems/static-vs-dynamic-inference)：支持推論延遲與批次換景；本頁數值是教學假設。
- [Google「Production ML systems」](https://developers.google.com/machine-learning/crash-course/production-ml-systems)：支持訓練、服務及其他元件需整體盤點的教學圖。

## 小結

- 訓練與推論要分開配置，GPU、雲端、本地設備各有條件。
- 記憶體、延遲與容量預算先統一單位再核算。（補充）
- 小模型可能用 CPU 達標，依實測選擇。（補充）
- 預算算得過，仍需壓測與資料存取審查。（補充）
