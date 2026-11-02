---
id: multi-agent-orchestration
title: 多代理協作與容錯
kind: technique
codes: [L21103, L21104, L21302]
aliases: [Multi-Agent, Orchestrator Agent, Worker Agent]
summary: 多代理由協調者分工並驗收，對失敗設定重試、轉派與人工接手
goals:
  - id: g1
    text: 設計協調者與工作代理的驗收、拒收、重試上限、轉派及人工接手流程
requires: [ai-agent]
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-64]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 供應商代理回報完成12份整理，協調者抽查發現其中2份沒有來源日期。契約要求每份都附日期，應怎麼處理？
    options:
      A: 接受全部12份，因為工作代理已經自行宣告完成
      B: 拒收缺漏的2份，記錄原因並在預算內要求補查
      C: 刪除缺漏的2份，仍把原任務紀錄成12份皆成功
      D: 接受缺漏的2份，把協調者今天的日期當更新日
    answer: B
    explain:
      A: 自行宣告完成沒有證明每份符合驗收條件，仍需核對證據。
      B: 拒收應指出具體缺漏，讓後續重試或轉派知道要補什麼。
      C: 刪除失敗項會扭曲完成範圍，也讓後續無法追查缺漏。
      D: 查核日不是來源更新日，不能用填入今天來補造來源證據。
  - id: c2
    goal: g1
    type: choice
    prompt: 主代理首次逾時後最多重試1次，備援也相同；任務總上限4次。主代理已逾時2次，現在應如何處理？
    options:
      A: 讓主代理繼續第3次，備援只用來保存錯誤紀錄
      B: 直接宣告整體成功，因為已遵守主代理重試上限
      C: 將錯誤與查詢條件轉給備援，最多再做2次查詢
      D: 轉給備援並重置總計數，之後仍可無限次轉回主代理
    answer: C
    explain:
      A: 主代理已用完首次加重試的2次額度，不能繼續同一輪呼叫。
      B: 達到上限只代表停止該代理，沒有取得證據就不構成成功。
      C: 備援保留原任務及失敗資訊，且剩餘總額度是2次。
      D: 轉派不能抹去已花費的呼叫，否則總預算失去作用。
  - id: c3
    goal: g1
    type: choice
    prompt: 主代理與備援共查詢4次都逾時，仍缺路線班表。哪份交接最有助人工接手？
    options:
      A: 任務路線與日期、4次失敗紀錄、缺漏證據及接手人
      B: 最後一句「暫時失敗」、推測班次與預計完成的口頭承諾
      C: 主代理寫的流暢摘要、成功標記及刪除過的工具回傳
      D: 備援代理的名稱、工具清單及未保留日期的猜測班次
    answer: A
    explain:
      A: 條件、歷程、缺漏與責任人齊全，人工才能延續查核而不必猜測。
      B: 推測與承諾不能補上班表，也沒有保存完整失敗原因。
      C: 查無證據卻標成功會誤導接手人，刪除回傳又降低可追溯性。
      D: 只有名稱與工具清單仍不清楚查過什麼、缺什麼及由誰處理。
---

## 為什麼需要（補充）

旅運查詢可分查班表、票價與無障礙資訊；供應商整理可分查規格、交期與來源。子任務交給不同代理，讓各角色專注處理一部分。

多代理（Multi-Agent）也帶來新問題：有人重複查、有人漏查，或把別人的錯誤照抄成結論。因此，分工之外還需要驗收與失敗處理。

## 直覺（補充）

像一位組長分派調查工作：同事交回報告後，組長要核對是否回答原問題。缺證據就退回補查；同事做不下去，要能轉給別人或清楚交接。

![驗收失敗先判斷能否修正；重試及轉派都有上限，最後仍無證據就交人工。](figure:l21103-multi-agent-orchestration-states)

## 定義與公式（補充）

協調者代理（Orchestrator Agent）拆工並驗收；工作代理（Worker Agent）處理限定子任務。兩者可共用模型，重點在角色、權限與狀態分開。

| 契約 | 必須說清楚 | 共用例子 |
|---|---|---|
| 目標與輸入 | 查誰、哪天、要回什麼 | `route-3`、2026-11-03 |
| 驗收與證據 | 來源、日期及欄位 | 來源更新日有效、適用日相同 |
| 資源與權限 | 工具、呼叫預算及操作界線 | 每代理2次、總計4次，只讀 |
| 失敗與責任 | 錯誤紀錄、轉派、人工接手 | 主代理後轉備援，再交旅運客服 |

容錯是讓局部失敗能被辨識、隔離及接續處理。它不保證原任務一定成功；交人工也是合法的終止狀態，不能為了成功率改寫成完成。

本例最多轉派一次，總呼叫最多4次。首次加1次重試是2次，不是只准呼叫1次；轉派後不重置全任務的累計額度。

## 走一次流程（補充）

### 驗收與拒收

使用同一份 `L21103-E-agent-tasks.json`。協調者先寫明來源、更新日、適用日與查詢對象；工作代理回傳時，逐項驗收。

TR02 第一次取得更新日2026-10-01 的08:30。即使代理聲稱「已查到班表」，協調者仍拒收，記下「來源過期」；第二次取得11月2日更新的09:30才接納。

### 轉派成功與人工接手

| 任務 | 主代理 | 備援代理 | 終點 |
|---|---|---|---|
| TR03 | 2次逾時 | 第1次取得10:30 | 3次呼叫後接納 |
| SP03 | 2次逾時 | 第1次取得13日 | 3次呼叫後接納 |
| TR08、SP08 | 各2次逾時 | 各2次逾時 | 各4次後交人工 |

轉派時帶上原始目標、已花額度、查過的輸入及錯誤，讓備援接續未完成部分。人工交接另列缺少的證據與接手人，不把「未知」填成推估值。

全組20任務有18筆通過工具查證、2筆交人工，共32次呼叫。這是固定案例的控制流程核對，不是多代理比單代理更好的實驗證據。

## 程式（補充）

以下是協調者的固定狀態流程示意，不呼叫模型。第一段讀取假工具回傳，驗收規則與 ReAct 工具查證迴圈相同。

預設從專案根目錄讀取例子；若在其他目錄執行，先將環境變數 `IPAS_EXAMPLE_FILE` 設為該JSON檔的絕對路徑。

```python
import json, os
from pathlib import Path
file = Path(os.environ.get("IPAS_EXAMPLE_FILE", "content/examples/L21103-E-agent-tasks.json"))
data = json.loads(file.read_text(encoding="utf-8"))
tasks = {t["task_id"]: t for t in data["tasks"]}
def accepted(t, r):
    return (r.get("status") == "ok" and r.get("query_key") == t["query_key"]
            and r.get("source") in t["trusted_sources"]
            and t["min_source_date"] <= r.get("source_date", "") <= data["as_of_date"]
            and r.get("effective_for") == t["request_date"] and bool(r.get("value")))
print("總呼叫上限:", tasks["TR03"]["max_calls_total"])
```
```text
總呼叫上限: 4
```

第二段依序派給主代理與備援，每次失敗留下紀錄。呼叫數在轉派後繼續累計，任一有效結果通過後立即停止。

```python
def coordinate(t):
    calls, failures = 0, []
    for worker in ["primary", "backup"]:
        for attempt in range(t["max_retries_per_worker"] + 1):
            if calls >= t["max_calls_total"]:
                return "human", calls, None, failures
            r = t[worker][attempt]
            calls += 1
            if accepted(t, r):
                return "accepted", calls, r["value"], failures
            reason = r["status"] if r["status"] != "ok" else "證據不符"
            failures.append((worker, attempt + 1, reason))
    return "human", calls, None, failures
print("TR03:", coordinate(tasks["TR03"])[:3])
print("TR08:", coordinate(tasks["TR08"]))
```
```text
TR03: ('accepted', 3, '10:30')
TR08: ('human', 4, None, [('primary', 1, 'timeout'), ('primary', 2, 'timeout'), ('backup', 1, 'timeout'), ('backup', 2, 'timeout')])
```

:::tip[讀碼重點]
- 外層換工作代理，內層限制該代理的首次與重試；`calls` 在兩個代理之間共用。
- 假工具陣列依序回傳固定資料，並非無限產生可用答案。
- 範例只示範可重試的逾時與過期；權限拒絕、衝突或缺使用者條件須先轉人工，不能盲目轉派。
:::

## 怎麼用、怎麼判讀（補充）

子任務可分開查證、各有清楚交付物時，適合分工。若每一步都必須等待上一位決定，加入代理可能只增加傳遞資訊的成本。

驗收不能只問「做完了嗎」。應核對子任務證據，再確認合併後沒有日期矛盾、重複項目或範圍缺漏；多數代理同意，也可能只是共用同一個錯誤來源。

### 換個場景（補充）

指引3-64提到任務導向協作與工具整合，但未展開多代理容錯的專屬場景或資料條件。以下延伸用角色與交付物判斷是否值得分工。

| 場景 | 分工條件 | 驗收與接手 |
|---|---|---|
| 旅運查詢 | 班表與票價可獨立查證 | 統一路線與日期，缺證據交客服 |
| 製造採購 | 規格與交期可分開整理 | 統一廠商版本，衝突交採購專員 |
| 教育素材 | 撰稿、查核、排版可分工 | 查核未過的段落不進入交付稿 |

## 常見誤解（補充）

- 「代理越多就越可靠。」共用錯誤資料仍可能一起出錯，還會增加成本。
- 「轉派就是重來。」原條件、已花預算與錯誤紀錄都要接續。
- 「工作代理回報完成便可發布。」協調者仍須驗收，內容與操作權限也另查。

## 進階

### 工具查證和內容驗收分開（補充）

TR05 可查到有效班表，草稿卻改寫成06:00。工具成功不會替錯誤草稿背書；生成內容的不確定性風險頁會接著處理事實、偏見及人工審查。

### 參考來源

- 科目1指引 `guide-1:3-64`：只支持任務導向協作背景；本頁協調者、驗收與容錯細節為補充。
- [Anthropic：多代理研究系統](https://www.anthropic.com/research/multi-agent-research-system)：支持協調者與專責代理的架構、評估及可靠性限制，參考其以失敗模式解釋設計的教法。
- [LangGraph：Thinking in LangGraph](https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph)：支持錯誤分類、重試與人工介入的流程教學。
- [Anthropic：長時間代理的執行環境](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)：支持保留進度與可接續狀態的補充。

## 小結（補充）

- 先訂交付物與驗收條件，再分派給工作代理。
- 拒收要留下原因，重試與轉派都受整體預算限制。
- 查不到證據可以交人工，不能靠成功宣告填補缺漏。
