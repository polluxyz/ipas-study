---
id: react-agent-loop
title: ReAct 工具查證迴圈
kind: technique
codes: [L21103, L21104]
aliases: [ReAct, Reasoning and Acting, Thought-Action-Observation]
summary: ReAct 交替選擇工具與核對觀察，依查證結果修正下一步
goals:
  - id: g1
    text: 追蹤即時查詢的工具操作、日期與來源驗證，設定錯誤及停止條件
requires: [ai-agent]
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-64]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 查核日為11月2日，要查11月3日班表；工具回傳適用日正確，但更新日是10月1日。契約只收11月1日至2日的更新，下一步該怎麼做？
    options:
      A: 接受舊班表並標最新，因為適用日已符合要求
      B: 以模型印象修改時間，因為已經有路線與日期
      C: 拒收舊版本並在上限內重查，保留日期不符紀錄
      D: 將舊更新日改為今日，保留其餘欄位後再回覆
    answer: C
    explain:
      A: 適用日與更新日是兩個條件，只通過其中一項仍不符合契約。
      B: 模型印象不是最新班表的證據，不能替代新來源。
      C: 應依觀察拒收過期結果，於上限內重查並保留原因；不一定要更換來源。
      D: 修改日期會偽造來源的新鮮度，不能使舊內容通過查核。
  - id: c2
    goal: g1
    type: choice
    prompt: 假工具最多呼叫2次，第1次逾時、第2次仍逾時，兩次都沒有班表值。符合停止契約的做法是什麼？
    options:
      A: 停止查詢並交人工，保留兩次逾時與缺漏欄位
      B: 繼續查詢直到成功，刪除先前的兩次逾時紀錄
      C: 直接使用上週記憶，把舊值標為本次查到的值
      D: 回覆大概的出發時間，把肯定語氣當完成條件
    answer: A
    explain:
      A: 已達上限且缺證據，應明確停止並留下人工可追查的狀態。
      B: 無限重試會違反呼叫預算，也不能保證服務終將恢復。
      C: 舊記憶沒有通過本次來源與日期查核，不能冒充新觀察。
      D: 語氣與猜測都不會補上缺少的有效工具證據。
  - id: c3
    goal: g1
    type: choice
    prompt: 助理說「我應該查詢供應商」，卻沒有任何呼叫紀錄；最後列出交期12日。哪項紀錄最能支持這個結果？
    options:
      A: 寫下打算查詢的工具名，沿用12日並省略日期
      B: 複製另一代理的結論，沿用12日並省略供應商
      C: 保存模型肯定的語句，沿用12日並省略來源值
      D: 保存實際查詢的輸入，核對12日的來源與日期
    answer: D
    explain:
      A: 表達打算不等於工具已執行，仍缺回傳證據。
      B: 他人的結論仍需核對對象、來源及日期，不能直接接納。
      C: 肯定語句無法證明外部資料含有12日這個值。
      D: 實際輸入及回傳可用來核對對象、值與時效，形成查證紀錄。
---

## 為什麼需要（補充）

即時查詢常遇到過期資料、逾時或查錯對象。一次生成答案無法保證取得今天需要的證據；工具回傳後，系統還得判斷能不能用。

ReAct 結合推理與行動，讓下一步受環境觀察影響。本頁只呈現簡短決策依據、工具輸入與觀察，不要求逐字展開模型內部思考。

## 直覺（補充）

查路線像查一份會更新的班表：先確定要查哪天，再讀回傳；發現是舊版本，就改查新資料。若一直查不到，應停下來說明缺少什麼。

![工具輸出先經查核，再走向完成、修正查詢或停止；逾時不會直接產生可用答案。](figure:l21103-react-agent-loop-cycle)

## 定義與公式（補充）

ReAct 的名稱來自推理與行動的結合。重點是用簡短依據安排操作，讓觀察修正後續行動，而非先想完所有步驟才一次輸出答案。

ReAct 軌跡常以 Thought → Action → Observation（思考 → 行動 → 觀察）反覆交替。這裡的 Thought 只記錄可核對的簡短決策依據，不要求公開模型內部思考。

| 環節 | 本頁要記錄什麼 | TR02 範例 |
|---|---|---|
| 思考 Thought | 缺什麼可查資訊 | 需要指定路線的明日班表 |
| 行動 Action | 工具名與實際輸入 | 查 `route-2`、2026-11-03 |
| 觀察 Observation | 工具回傳及錯誤 | 回傳08:30，但更新日過舊 |
| 修正或停止 | 通過哪些條件、還缺什麼 | 改查新版本；上限內查不到就停 |

本例每個代理最多呼叫2次，包含首次及1次重試。這是教學契約，不是 ReAct 固有的次數；真實系統另應限制總耗時與成本。

成功要同時符合：工具成功、查詢對象正確、來源可信、更新日有效、適用日正確、值完整。任何一項未過，都不能把回傳當最終依據。

## 走一次流程（補充）

### 一次過期資料修正

使用共用資料的 TR02。查核日是2026-11-02，需求是2026-11-03 的 `route-2`；驗收更新日介於2026-11-01與查核日之間。

| 次數 | 行動與簡短依據 | 工具觀察 | 查核及下一步 |
|---|---|---|---|
| 1 | 查指定路線與日期 | 08:30；更新日10月1日 | 過期，要求新版本 |
| 2 | 帶相同條件取下一份回傳 | 09:30；更新日11月2日 | 來源及適用日均符，停止查詢 |

兩次回傳的來源識別碼相同，也不能因此跳過日期檢查。最後只能回覆「依11月2日更新、適用11月3日的資料，出發時間09:30」，不能宣稱已訂票。

SP02 同樣先取得過期的17日交期，再取得有效的12日交期。兩頁共用對象、切分與日期規則；不以不同設定製造比較差異。

### 錯誤與停止

- 暫時逾時：保留錯誤，在剩餘次數內再試。
- 過期或對象不符：保留拒收原因，修正來源或查詢條件。
- 缺使用者必要條件、來源互相衝突或要求越權：停止自動處理，交人工澄清。
- 有效證據齊全：立即完成；已達預算仍缺證據：明確停止。

## 程式（補充）

以下用本機固定回傳示範查核與停止，不載入模型、不連網。這是 ReAct 的控制流程示意，並未實作由模型動態選擇工具。

第一段讀同一份例子，定義假工具與驗收。日期以固定長度的 ISO 格式比較，`source_date` 是更新日，`effective_for` 是適用日。

預設從專案根目錄讀取例子；若在其他目錄執行，先將環境變數 `IPAS_EXAMPLE_FILE` 設為該JSON檔的絕對路徑。

驗收工具 `run-code.mjs` 會切到暫存目錄執行，因此使用它時也須先設定 `IPAS_EXAMPLE_FILE`，指向目前 worktree 的例子檔絕對路徑。

```python
import json, os
from pathlib import Path
file = Path(os.environ.get("IPAS_EXAMPLE_FILE", "content/examples/L21103-E-agent-tasks.json"))
data = json.loads(file.read_text(encoding="utf-8"))
tasks = {t["task_id"]: t for t in data["tasks"]}
def fake_tool(task, worker, attempt):
    return task[worker][attempt]
def valid(task, result):
    return (result.get("status") == "ok"
            and result.get("query_key") == task["query_key"]
            and result.get("source") in task["trusted_sources"]
            and task["min_source_date"] <= result.get("source_date", "") <= data["as_of_date"]
            and result.get("effective_for") == task["request_date"]
            and bool(result.get("value")))
print("任務數:", len(tasks))
```
```text
任務數: 20
```

第二段連接執行。`range` 明確限制單一代理的呼叫次數；成功即 `return`，失敗則留下錯誤供人工接續。

```python
def query(task):
    failures = []
    for attempt in range(task["max_retries_per_worker"] + 1):
        result = fake_tool(task, "primary", attempt)
        if valid(task, result):
            return "完成", attempt + 1, result["value"], failures
        reason = result["status"] if result["status"] != "ok" else "日期或證據不符"
        failures.append(reason)
    return "交人工", len(failures), None, failures
for task_id in ["TR02", "TR03", "TR08"]:
    print(task_id, query(tasks[task_id]))
```
```text
TR02 ('完成', 2, '09:30', ['日期或證據不符'])
TR03 ('交人工', 2, None, ['timeout', 'timeout'])
TR08 ('交人工', 2, None, ['timeout', 'timeout'])
```

:::tip[讀碼重點]
- `valid` 檢查回傳是否符合本次需求，不能只看工具沒有拋出例外。
- `+ 1` 把首次呼叫算進去，重試1次代表最多2次呼叫。
- 這三筆只含可重試的過期與逾時；權限拒絕、來源衝突等不可重試情況應先分流，不套用這個最小迴圈。
:::

## 怎麼用、怎麼判讀（補充）

需要外部新資料，且必須依回傳決定下一步時，可採 ReAct。固定資料能一次回答的任務，可先用較簡單的查詢流程。

可在 System Prompt（系統提示，開發者預先設定的規則）中明訂：即時問題先呼叫查詢工具，核對來源與日期後才回答。

只刪掉 Thought 欄位不能補上查證；仍需決定選哪個工具及如何處理觀察。第一輪就呼叫全部工具也會耗用預算，且沒有利用先前觀察篩選下一步。

ReAct 能補進外部觀察，仍可能查錯來源或誤讀結果。應沿紀錄核對每個主張由哪次回傳支持，不能只看工具呼叫次數。

### 換個場景（補充）

指引3-64列出工具整合與行程安排，但未教授 ReAct 的專屬場景或資料條件。以下是將該整合方向落地的延伸案例。

| 場景 | 資料條件 | 查核重點 |
|---|---|---|
| 旅運查詢 | 班表有更新日與適用日 | 日期相符後才使用班次 |
| 供應商整理 | 各廠交期與版本不同 | 核對廠商、規格與交期單位 |
| 教育課表 | 課程通知可能改版 | 查公告原文，不用舊記憶補空白 |

## 常見誤解（補充）

- 「說要查就等於已查。」實際行動需要工具執行紀錄與回傳。
- 「多想幾輪就會變新。」資料更新需要外部證據，不能靠推測刷新。
- 「每次失敗都再試。」缺條件、越權與預算耗盡應走停止或人工處理。

## 進階

### ReAct 與多代理的分工（補充）

ReAct 描述單一代理如何讓操作與觀察交替。多代理協作與容錯則安排誰負責子任務、誰驗收及如何轉派；每個工作代理都可能有自己的工具迴圈。

### 參考來源

- 科目1指引 `guide-1:3-64`：只支持工具整合背景，未展開 ReAct；本頁迴圈與控制細節為補充。
- [ReAct 原論文專案頁](https://react-lm.github.io/)：支持推理、行動、觀察的交替及其限制。
- [Google Research：ReAct 教學](https://research.google/blog/react-synergizing-reasoning-and-acting-in-language-models/)：支持操作後修正方向的解說，參考其軌跡對照教法。
- [LangGraph：Thinking in LangGraph](https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph)：支持將暫時故障、可修正錯誤及人工介入分流的教學。

## 小結（補充）

- 先選工具，讀取實際觀察，再決定修正或停止。
- 即時查詢要同時核對來源、更新日、適用日及對象。
- 達上限仍缺證據，留下失敗紀錄並交人工。
