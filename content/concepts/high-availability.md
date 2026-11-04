---
id: high-availability
title: 高可用與故障切換
kind: technique
codes:
  - L21302
aliases:
  - Failover
  - Redundancy
summary: 高可用透過冗餘與切換，減少單一元件故障造成的服務中斷
goals:
  - id: g1
    text: 找出單點故障，設計健康檢查、備援容量與流量切換流程
formula_groups:
  - id: time-availability
    source: https://sre.google/sre-book/service-level-objectives/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 製造服務有 3 個推論副本，卻都在同一台實體機。該機斷電時，哪個判斷最合理？
    options:
      A: 3 個副本彼此是完整的跨機備援
      B: 只要增加同機副本到 6 個，就能承受斷電
      C: API 回傳格式一致，所以服務不會中斷
      D: 實體機仍是共同單點，應分散至不同故障範圍
    answer: D
    explain:
      A: 副本共用電源及主機，無法隔離主機故障。
      B: 更多同機副本仍會隨同一台機器停機。
      C: 資料格式相容不會供應電力或替代節點。
      D: 把副本分散到獨立節點才有機會承受這次故障。
  - id: c2
    goal: g1
    type: choice
    prompt: 12 秒教學視窗中，A 在第 2 秒故障，第 4 秒改導健康的 B，之後一直可用。時間可用率是多少？
    options:
      A: 50%，因為兩個節點只有一個接流量
      B: 83.33%，因為 12 秒中有 2 秒無法服務
      C: 100%，因為最後已修復
      D: 90%，因為另一份快照有 27/30 次成功
    answer: B
    explain:
      A: 節點使用比例與服務可用時間是不同量。
      B: 可用時間 10 秒除以總時間 12 秒約為 83.33%。
      C: 修復不能抹除先前已發生的服務空窗。
      D: 另一個請求快照不能替代本次故障視窗的時間量測。
textbook: v2
author: codex
status: draft
guide_refs:
  - guide-1:5-17
---

## 為什麼需要

推論節點可能因程序異常、硬體或網路問題停機。如果所有請求只能送到它，單一故障就會變成整個服務的中斷。

高可用（High Availability）設計安排多節點冗餘，並在故障時切換到備援節點。指引把高變動流量與嚴格可靠性需求列為採用條件。

## 直覺

備援不是只多放一份程式。要有另一個能接手的節點，也要有機制發現故障並改送流量。

![上方的單節點失效會斷路；下方先檢查狀態，再把新請求轉到健康備援。](figure:l21302-high-availability-failover)

## 定義與公式

| 設計 | 意義 | 要確認的事 |
|---|---|---|
| 冗餘部署（Redundancy） | 多節點保留服務能力 | 是否仍有共同單點 |
| 故障切換（Failover，指引稱容錯切換） | 異常時改由備援服務 | 入口何時改送流量 |

### 時間可用率（補充）

$$
A_t=\frac{T-D}{T}\times100\%
$$

$T$ 是約定觀察總秒數，$D$ 是其中無法滿足服務條件的秒數，$A_t$ 是時間可用率。定義需先約定服務範圍、維護時間與判定方式，不能事後改分母。

本例視窗 12 秒，中斷 2 秒，$A_t=(12-2)/12\times100\%\approx83.33\%$。這是短時間教學示範，不能據此宣稱長期營運水準。

這是服務可用率的時間版本；依請求計算的版本見「推論延遲、吞吐與可用率」中的請求成功比例。

## 走一次流程

先用多節點部署降低單點風險，故障時再切到可服務的備援。接手與修復可以同時進行，不必等原節點完全修好才恢復入口。

### 十二秒內發生了什麼（補充）

共用資料 content/examples/L21302-C-incidents.json 有 12 筆逐秒觀測。每列代表從 time_s 起的 1 秒區間，客服與製造用同一時間軸重播。

| 時間區間 | 節點 A／B | 新請求路徑 | 服務狀態 |
|---|---|---|---|
| 0–2 秒 | 都健康 | A | 可用 |
| 2–4 秒 | A 故障、B 健康 | 尚未切換 | 中斷 |
| 4–8 秒 | A 故障、B 健康 | B | 可用 |
| 8–12 秒 | A 已恢復、B 健康 | 維持 B | 可用 |

健康檢查偵測異常後，將 A 移出可接流量名單，再導向已就緒的 B。觀察錯誤與延遲確認恢復，接著調查 A；不要未驗證就立即切回。

:::caution[注意]
備援還要有接手容量。本組需求每秒 3 筆；若只剩 1 個副本，實際上限每秒 2 筆、目標容量 1.5 筆都不夠，切換成功仍會過載。（補充）
:::

## 程式（補充）

以下摘出故障資料的等長區間規則。以實際路由到的節點能否服務計時；不能只問「是否還有某個健康節點」。

```python
events = range(12)
available_seconds = 0
for t in events:
    a_ok, b_ok = t < 2 or t >= 8, True
    route = "a" if t < 4 else "b"
    available_seconds += int(a_ok if route == "a" else b_ok)
print("可用秒數", available_seconds)
print(f"時間可用率 {available_seconds / 12:.2%}")
```
```text
可用秒數 10
時間可用率 83.33%
```

## 怎麼用、怎麼判讀

指引的嚴格可靠性場景，要同時檢查冗餘與切換。只列出兩台機器，沒有偵測與導流流程，不足以說明故障後怎麼繼續服務。

:::supplement[來源：Microsoft Azure「Designing for redundancy」「Health Endpoint Monitoring pattern」]
同一主機、機房、入口或資料庫都可能是共同故障範圍。先列出端到端依賴，再把重要副本分散；健康檢查要能反映實際提供服務的能力。
:::

### 換個場景

| 場景 | 可用性需求 | 接手時要確認什麼 |
|---|---|---|
| 指引：流量變動且可靠性要求高 | 多節點與自我修復 | 切換後能持續服務 |
| 客服（補充） | 晚間也能回應 | 備援是否載入正確知識版本 |
| 製造（補充） | 檢驗服務不中斷 | 接手後不遺失工件追蹤 |
| 金融風控（補充） | 決策路徑可追溯 | 同筆事件重送是否重複執行 |

## 常見誤解

- **「多副本就消除了全部單點。」** 副本可能仍共用同一主機或入口。（補充）
- **「備份等於即時備援。」** 備份要經還原，未必能立刻處理流量。（補充）
- **「節點在線就能接手。」** 模型、相依服務與剩餘容量也須符合服務條件。（補充）

## 進階

### 有狀態操作的切換（補充）

無狀態推論較容易換節點；涉及工單更新、扣款或工件放行時，還要保留作業狀態並避免重複執行。計算副本增加，不能取代資料一致性與事件去重設計。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-17）：支持冗餘、多節點與故障切換及適用條件。
- [Google SRE：Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)，Indicators in Practice：支持可用率量測與服務範圍。
- [Microsoft Azure：Designing for redundancy](https://learn.microsoft.com/en-us/azure/well-architected/reliability/redundancy)，Design strategies：支持故障分散、容量餘裕與成本限制。
- [Microsoft Learn：Health Endpoint Monitoring](https://learn.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring)，Example：支持健康檢查到流量導向的流程教學。

## 小結

- 冗餘提供替代節點，切換讓它真正接到流量。
- 健康檢查、導流與接手容量要一起驗證。（補充）
- 副本需要分散共同故障風險。（補充）
- 時間可用率與請求成功比例要分開報告。（補充）
