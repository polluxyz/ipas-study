---
id: container-orchestration
title: 容器化與 Kubernetes 編排
kind: tool
codes:
  - L21302
aliases:
  - Docker
  - K8s
  - Kubernetes
requires:
  - inference-service-api
summary: 容器封裝執行環境，編排工具管理多個容器的部署與恢復
goals:
  - id: g1
    text: 區分映像封裝、資源排程與故障恢復，走完映像到多副本部署
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服程式在開發機可跑，正式機卻缺少同版套件；公司還要在 3 個節點維持服務。哪個分工合理？
    options:
      A: Docker 固定環境並跨節點補回副本，Kubernetes 只登記容器名稱
      B: Docker 固定程式與套件環境，Kubernetes 排程並維持副本
      C: Docker 封裝程式，Kubernetes 自動改寫模型權重以提升準確率
      D: 每台機器手裝最新版套件，Kubernetes 便能保證執行環境完全一致
    answer: B
    explain:
      A: 映像封裝不會自行管理跨節點的目標副本數。
      B: 封裝與編排分別解決環境及多副本管理問題。
      C: 編排處理運行資源，不負責修改模型預測品質。
      D: 未固定版本的手動安裝容易產生環境差異。
  - id: c2
    goal: g1
    type: choice
    prompt: 製造模型要載入 40 秒，新 Pod 剛啟動就收到請求而失敗。最合適的改善為何？
    options:
      A: 載入未完成先導入流量，靠用戶端在 40 秒內重試直到模型就緒
      B: 映像下載完成就導入流量，將後續 40 秒模型載入視為已能服務
      C: 程序啟動就導入流量，用存活檢查取代 40 秒載入完成的就緒檢查
      D: 40 秒載入完成且通過就緒檢查後，才讓入口導入流量
    answer: D
    explain:
      A: 重試仍會把流量送到未備妥模型，不能取代入口的就緒判定。
      B: 映像下載完成不代表模型已載入，暖機期間仍可能無法推論。
      C: 存活檢查用來判斷是否重啟，不能代替是否能接流量的就緒檢查。
      D: 就緒檢查能避免尚未備妥的副本接到正式流量。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-16
---

## 為什麼需要

同一份推論程式換到別台機器，可能因套件版本不同而失敗。容器化把程式及相依環境一起封裝，降低部署環境不一致的問題。

容器變多後，還要決定放在哪個節點、保留多少副本，以及故障後怎麼恢復。這些是容器編排（Container Orchestration）的責任。

## 直覺

先把「可以重複啟動的封裝」與「正在運行的實例」分開。Docker 負責映像建構與容器執行，Kubernetes 負責多容器的資源安排及故障恢復。

![沿映像到多個節點的方向看，封裝一次與維持多副本是兩項工作。](figure:l21302-container-orchestration-image)

## 定義與公式

| 項目 | 負責什麼 | 不會自動做到什麼 |
|---|---|---|
| Docker | 封裝程式與環境、啟動容器 | 跨節點協調全部副本 |
| Kubernetes | 編排容器、安排資源、恢復故障 | 提升模型本身的準確率 |

### 映像與運行實例（補充）

容器映像（Container Image）是可供啟動的檔案封裝；容器是從映像啟動的隔離程序。Kubernetes 的 Pod 是部署與排程的基本單位，可以包含一個或多個容器。

叢集節點可由 containerd 等容器執行環境啟動容器，不必一定安裝 Docker Engine。

Docker 建立的標準映像仍可在相容環境執行；移除 dockershim 不等於不能使用這些映像。

部署控制器（Deployment）宣告要維持的副本數，排程器（Scheduler）替新 Pod 找資源足夠的節點。副本消失後，由控制器建立替代 Pod；不是讓已損壞的程序起死回生。

## 走一次流程

先封裝模型 API 與相依環境，再用編排工具管理多個推論副本。節點故障時，讓系統恢復所需的運行數量。

### 客服與製造部署（補充）

使用教學資料 content/examples/L21302-C-requests.json 的兩種服務。此處沒有實際啟動叢集，流程用來辨認工具責任。

1. 為客服 API 建立映像，固定程式、套件與模型載入規則。
2. 宣告客服要有 2 個 Pod，製造則使用自己的映像與資源需求。
3. 排程器找可用節點；節點需具備對應的 CPU、記憶體或 GPU。
4. 模型載入完成、就緒檢查通過後，才讓 Service 將新請求送進來。
5. 某 Pod 故障，入口先避開它，控制器再補建副本。

:::caution[注意]
固定映像能減少環境差異，仍須確認作業系統、處理器架構與 GPU 驅動相容。映像一致不保證任意硬體上的預測耗時完全相同。（補充）
:::

## 怎麼用、怎麼判讀

指引的適用條件是需要跨環境一致部署，以及需要管理大量容器。只有一項小服務時，應先評估維運成本，再決定是否導入編排平台。

:::supplement[來源：Kubernetes「Liveness, Readiness, and Startup Probes」]
就緒檢查（Readiness Probe）回答「現在能不能接流量」；存活檢查（Liveness Probe）回答「是否需要重啟」。模型尚在暖機時，不能只用程序存在當成可服務的證據。
:::

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 指引：跨環境部署 | 固定程式及依賴環境 | 封裝是否完整 |
| 指引：大量容器 | 集中排程與故障恢復 | 副本與資源是否足夠 |
| 客服（補充） | 尖峰前備妥模型 Pod | 載入完成才接流量 |
| 製造（補充） | 為影像模型安排 GPU | 節點與驅動是否相容 |
| 交通（補充） | 多站點部署辨識服務 | 節點中斷時能否補建 |

## 常見誤解

- **「容器化會壓縮模型參數。」** 它封裝運行環境，模型壓縮是另一項工作。
- **「有 Kubernetes 就保證零停機。」** 還要備足資源並設計健康檢查、故障分散與流量路徑。（補充）
- **「副本數正確就代表能推論。」** 新副本可能還在載入模型，必須確認就緒。（補充）

## 進階

### 模型檔要怎麼放（補充）

模型可放進映像，也可於啟動時從受控儲存載入。後者應記錄模型版本與完整性，並把下載、載入時間算入啟動準備；不能只固定程式映像而忽略權重版本。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-16）：支持工具分工、環境一致性、資源安排與恢復。
- [Docker：What is an image?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)，Explanation、Try it out：支持映像與實例區分，也提供封裝教學思路。
- [Kubernetes：Dockershim Removal FAQ](https://kubernetes.io/blog/2022/02/17/dockershim-faq/)，容器執行環境與映像相容性：支持 Docker 建構映像與節點實際執行容器的分工。
- [Kubernetes：Learn Kubernetes Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)，Deploy、Scale、Update：支持映像到多副本的教學流程。
- [Kubernetes：Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)，Types of probe：支持就緒、存活及啟動檢查的補充。

## 小結

- 容器封裝程式與相依環境。
- 編排負責多副本的部署、資源與恢復。
- 程序啟動與模型就緒要分開判斷。（補充）
- 映像一致仍須確認硬體與驅動相容。（補充）
