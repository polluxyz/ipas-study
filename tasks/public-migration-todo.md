# 單一同名公開 repo 遷移任務

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| 同名／刪舊順序複核 | Codex advisor，唯讀 | 新舊 node ID、名稱轉換、資料保全與 Orca 處理可執行 | 進行中 |
| 規範與規格 PR | 協調者 | 正常 PR，既有檢查／測試／建置與 CI 通過 | 進行中 |
| 來源與未合併成果保全 | 協調者 | S、manifest、bundle、patch 與本機管理資料備份可讀 | 待辦 |
| 建立隔離候選及本機驗收 | 協調者 | 原始資料一致、email／秘密檢查與所有必要驗收通過 | 待辦 |
| 新 private repo 與 fresh clone 驗收 | 協調者 | 獨立 node ID、乾淨 refs、新 CI 全綠 | 待辦 |
| 同名切換、公開、刪舊 | 協調者，依使用者明示授權 | 唯一 PUBLIC ipas-study，舊 node ID 已刪除 | 待辦 |
| Orca 與未合併工作恢復 | 協調者／既有 worker | 正常新分支／PR；資料無遺失；交接已更新 | 待辦 |
