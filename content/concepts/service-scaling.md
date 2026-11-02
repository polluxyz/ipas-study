---
id: service-scaling
title: 推論服務擴縮與負載平衡
kind: technique
codes:
  - L21302
aliases:
  - Autoscaling
  - Load Balancing
  - 水平擴展
requires:
  - container-orchestration
summary: 擴縮調整副本數，負載平衡把請求送往可服務的副本
goals:
  - id: g1
    text: 分辨擴縮、負載平衡與滾動更新，依容量與就緒條件安排流量
formula_groups:
  - id: replica-capacity
    source: '本頁按同規格副本、均分工作量及無共用瓶頸假設，由 nqu≥λ 推導最小整數副本數；HPA 控制背景：https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/#algorithm-details'
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服穩定需求是每秒 3 筆；單副本每秒可處理 2 筆，目標負載不超過容量的 75%。忽略其他瓶頸，正常至少要幾個副本？
    options:
      A: 2 個，以 3÷(2×0.75) 向上取整
      B: 1 個，把 3÷2 的結果向下取整
      C: 1.5 個，以 3÷2 計算；75% 只是監控門檻，不影響容量
      D: 3 個，將每秒 3 筆需求直接當作副本數
    answer: A
    explain:
      A: 3 除以每副本可用容量 1.5，向上取整是 2。
      B: 不但漏掉目標負載，向下取整也會低估需求；一個副本不夠。
      C: 75% 是規劃時要保留的負載餘裕，不能忽略；副本數也必須是整數。
      D: 需求流率不能直接當作副本數，還需除以每副本的目標容量。
  - id: c2
    goal: g1
    type: choice
    prompt: 2 個舊副本要逐步換成新版，新模型需暖機 40 秒。哪個方案最有助維持服務？
    options:
      A: 先停掉 2 個舊副本，新副本完成 40 秒暖機後再一次接流量
      B: 新增 2 個新副本後立即接流量，40 秒內只靠提高副本上限保護
      C: 保留 2 個舊副本，新副本完成 40 秒暖機且就緒後接流量，再排空舊請求
      D: 讓 2 個舊副本與未完成 40 秒暖機的新副本輪流接流量，不檢查狀態
    answer: C
    explain:
      A: 先移除全部舊副本會留下沒有可用模型的空窗。
      B: 副本上限不會證明新模型已能服務。
      C: 更新順序、就緒檢查與剩餘容量共同降低中斷風險。
      D: 未就緒的副本仍可能收到請求而失敗。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-16
---

## 為什麼需要

客服尖峰讓請求排隊，單純換一個更準的模型不會增加服務容量。推論服務需要依流量調整資源，也要讓多個節點分攤請求。

更新模型又是另一個問題：要替換運行版本，同時維持服務。把擴縮、負載平衡與滾動更新分清楚，才知道該改哪個環節。

## 直覺

自動擴縮（Autoscaling）改變容器數量；負載平衡（Load Balancing）分配請求；滾動更新（Rolling Update）分批替換版本。三者可以合作，但不能互相代替。

![看三條路徑的差異：增加副本、分配請求、分批換版各有不同目的。](figure:l21302-service-scaling-flow)

## 定義與公式

| 機制 | 改變什麼 | 主要用途 |
|---|---|---|
| 自動擴縮 | 運行副本數 | 因應負載升降 |
| 負載平衡 | 請求目的地 | 讓多個推論節點分擔工作 |
| 滾動更新 | 新舊版本比例 | 逐步替換容器版本 |

### 先估需要多少副本（補充）

同規格副本均分相同工作量，而且沒有共用瓶頸時，可用總目標容量至少承接需求來規劃：

$$
nqu\ge\lambda\quad\Longrightarrow\quad
n_{\min}=\left\lceil\frac{\lambda}{qu}\right\rceil
$$

$n$ 是非負整數副本數，$n_{\min}$ 是滿足需求的最小值。$\lambda\ge0$ 是每秒需求，$q>0$ 是單副本每秒容量，$0<u\le1$ 是目標負載比例。

每副本目標容量為 $qu$，所以總量為 $nqu$；除以正數 $qu$ 後，再向上取整。

這是本頁在上述假設下的推導，與 HPA 依目前副本數及指標比值調整的控制式不同。

本例 $\lambda=3$、$q=2$、$u=0.75$，所以 $n_{\min}=\lceil3/1.5\rceil=2$。

CPU 使用百分比不等於流率占容量的比例；未量測單副本容量與流量，就不能直接代換。

## 走一次流程

讓多個推論節點分攤請求，再按流量調整副本；要更新版本時，分批替換。這三項工作對應不同的控制動作。

### 客服穩態容量與換版（補充）

共用資料 L21302-C-requests.json 的 load_benchmark 假定每秒 3 筆、batch=1。容量來自另設的穩態壓測條件，不是用 30 筆短視窗反推。

1. 確認輸入長度、模型、硬體與 P95 上限 600 ms，單副本容量為每秒 2 筆。
2. 依目標負載 75% 設 2 個副本，持續觀察排隊、錯誤與尾端延遲。
3. 需求增加時調高目標副本數；新副本未就緒前，不能把它算作可用容量。
4. 更新時先建立部分新版，通過就緒檢查才接流量，接著讓舊版處理完既有請求再退出。
5. 低谷再縮減副本，先移除接收新請求的資格，再等待排空。

:::caution[注意]
不中斷更新需要足夠的剩餘容量、正確健康檢查及適當退出等待。只有「滾動更新」這個名稱，不足以保證請求完全不失敗。（補充）
:::

## 程式（補充）

以下重算共用資料的容量條件。正常需求需要 2 個副本；若要求故障 1 個後仍滿足相同目標負載，則要預備 3 個。

```python
from math import ceil
target_rps, per_replica_rps, target_load = 3, 2, 0.75
normal = ceil(target_rps / (per_replica_rps * target_load))
reserve = normal + 1
print("正常副本", normal)
print("單副本故障後仍達標的總數", reserve)
```
```text
正常副本 2
單副本故障後仍達標的總數 3
```

## 怎麼用、怎麼判讀

指引以多個推論節點與流量變動為適用條件。先判斷是容量不足、分流不均還是版本替換，再選對應機制。

:::supplement[來源：Kubernetes「Horizontal Pod Autoscaling」；Google SRE「Handling Overload」]
水平擴展增加副本，垂直擴展增加單副本資源。自動擴縮有觀測與啟動延遲；若下游資料庫已飽和，增加模型副本可能只會增加下游壓力。
:::

### 換個場景

| 場景 | 需要的動作 | 判讀重點 |
|---|---|---|
| 指引：流量變動 | 自動擴縮 | 數量能否跟上需求 |
| 指引：多推論節點 | 負載平衡 | 工作是否合理分攤 |
| 客服活動（補充） | 事前暖機並保留餘裕 | 新副本啟動時間 |
| 製造換線（補充） | 逐批更新檢驗模型 | 舊請求是否排空 |
| 零售推薦（補充） | 搭配下游容量擴展 | 特徵儲存是否成瓶頸 |

## 常見誤解

- **「負載平衡會自動生出運算容量。」** 它分配工作，增加容量要靠擴展。
- **「兩個副本就能承受一個故障。」** 本例故障後只剩每秒 1.5 筆目標容量，不能滿足每秒 3 筆。（補充）
- **「CPU 沒滿，所以不用擴縮。」** 排隊可能卡在 GPU、I/O 或下游；需搭配端到端量測。（補充）

## 進階

### 避免反覆增減（補充）

短暫尖峰不一定值得立刻縮放。可依已量測的工作負載設定穩定視窗、最小副本與縮減速度，避免流量稍降就刪掉剛暖機完成的模型。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-16）：支持三項機制及適用條件。
- [Kubernetes：HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/#algorithm-details)，Algorithm details：支持擴縮控制與穩定視窗；本頁容量式另由總目標容量不小於需求推導，未將 CPU 百分比當作流率利用率。
- [Kubernetes 教學：Running Multiple Instances](https://kubernetes.io/docs/tutorials/kubernetes-basics/scale/scale-intro/)，Scaling overview：支持副本、Service 與分流教學。
- [Kubernetes 教學：Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)，Rolling updates overview：支持新舊副本逐步替換。
- [Google SRE：Handling Overload](https://sre.google/sre-book/handling-overload/)，Pitfalls of QPS：支持工作負載與共用瓶頸限制。

## 小結

- 擴縮管數量，負載平衡管分流，滾動更新管版本。
- 先固定負載條件，再估副本數。（補充）
- 新副本就緒與舊副本排空，是換版的重要條件。（補充）
- 備援容量要按故障後的剩餘資源計算。（補充）
