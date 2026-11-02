# L21103-E：工具、查證、轉派與內容審查

`L21103-E-agent-tasks.json` 是教學合成資料，旅運 TR01–TR10、供應商整理 SP01–SP10 各 10 任務。來源識別碼、告示、規格表、時間及交期皆為假資料，不可據此規劃真實行程或採購。

## 欄位與固定規則

- `as_of_date` 固定為 2026-11-02；`request_date` 是查詢的適用日 2026-11-03。兩者不能混用。
- `query_key`、`tool_input`、`allowed_tools`、`trusted_sources` 指定對象、輸入與工具權限；工具只讀，不會訂票或下單。
- `primary`、`backup` 是各代理依序取得的固定回傳。`status=timeout` 不含可用事實；`source_date` 是更新日，`effective_for` 是適用日。
- `acceptance` 必須全數滿足才接納工具證據；日期、對象、來源及值都要檢查。`memory` 區分當次條件與跨次偏好，偏好不覆蓋新查到的事實。
- `max_retries_per_worker=1` 指首次失敗後最多再試一次，每代理最多兩次；`max_calls_total=4` 包含轉派後呼叫。每任務最多轉派一次。
- `handoff_to`、`human_owner`、`human_trigger` 是轉派及人工接手契約。`expected_tool_outcome` 只表示查證結果，不代表草稿已可對外發布。
- `drafts` 對照依據與候選；`unsupported_fact`、`group_stereotype`、`operation_permission` 必須攔下，不能由工具查詢成功推定內容審查通過。
- `missing_evidence` 表示沒有有效回傳：`grounded=null`，候選只保留值為 `null` 的欄位，不附來源、不生成內容草稿，直接交人工補查；`none` 表示本組未預設草稿風險。
- 每領域 01–05 為練習索引，06–10 為核對索引；不訓練、不估泛化效能，四頁共用完整 20 筆。種子固定 42，但此資料不使用亂數。

## 關鍵核對數值

- TR02：09:30 為有效回傳，舊資料 08:30 的更新日為 2026-10-01；兩次查詢後接納。SP02 同型：12 日與舊資料 17 日。
- TR03、SP03：主代理兩次逾時，備援第一次成功，共 3 次呼叫。
- TR08、SP08：主代理及備援各兩次逾時，共 4 次後交人工。
- 各領域初次有問題的任務為 02、03、08；每領域查證可接納 9 筆、交人工 1 筆，合計 18 與 2，總呼叫 32 次。
- 查證可接納的 18 筆中，05 是草稿事實錯誤、06 是群體刻板印象、10 是操作權限問題；每領域各 3 筆需人工處理。加上 08 無證據，每領域 4 筆需人工，兩域合計 8 筆；這是測試安排，不是風險發生率估計。

## 使用頁面

- `ai-agent`：TR01 感知、元件與操作界線；SP01 作第二領域。
- `react-agent-loop`：TR02 過期修正，TR03/TR08 的停止；SP02 日期類比。
- `multi-agent-orchestration`：TR03/SP03 轉派成功；TR08/SP08 上限及人工接手。
- `generative-output-risk`：TR05/SP05 事實錯誤、TR06/SP06 偏見、TR10/SP10 權限與事前／輸出審查。
