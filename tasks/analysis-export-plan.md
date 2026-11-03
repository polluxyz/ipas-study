# 分析CSV匯出實作計畫

2026-11-03：使用者核可最小格式提案。規格見 `docs/specs/analysis-export.md`。

1. 協調者固定規格與套件指令。Ownership：協調者，`docs/specs/analysis-export.md`、本plan、todo、`demo/package.json`。
2. Codex實作純匯出函式、CLI、prebuild接線、正反fixture與測試，程式生成兩份CSV。Ownership：worker，`demo/scripts/export-analysis.mjs`、對應test、`tests/fixtures/analysis-export/`、`demo/scripts/prepare.mjs`、兩個analysis CSV。
3. 非作者核對格式、來源、失敗案例、確定性與建置接線。協調者再跑完整QA、看diff、開PR、CI全綠後合併。

風險：跨科引用遺失、概念被截斷、source漏值、CSV跳脫、輸出半完成。對策：先驗證全部來源，逐欄獨立對照；負fixture；完整保留原陣列；重跑byte比對。不得用匯出器修內容或放寬檢查器。

Root舊L候選固定到邊界停止；本功能在獨立worktree完成。整合後新候選驗最終契約，不改綁L原始證據。

## 實作紀錄

### Codex worker，2026-11-03

- 實作 `demo/scripts/export-analysis.mjs` 的純轉換、CLI 與先驗證後發布流程。`prepare.mjs` 的 main 明確呼叫同一函式；兩個模組匯入時不讀寫檔案。
- 兩份 CSV 均由真 CLI 生成。獨立解碼器逐欄重算：4 卷各 50 題、共 200 題；排除 mock 1 題。89 題概念數差異完整保留，不依 review 篩題。
- 固定來源的 680 條關係逐宣告相等：is_a 32、part_of 7、requires 561、mitigates 24、contrasts 56。680 是本次來源重算結果，不是程式內常數。
- 跨科 `114-2-S1-Q08` 保留 `guide-1:3-48;guide-3:4-69;guide-3:5-35`。連跑 2 次逐 byte 相同。把兩表移到本工作樹 tmp 後，真 prebuild 重建的 bytes 也相同。
- 正例與 27 組負 fixture 涵蓋 CSV 跳脫、完整來源、缺欄、未知 ID、重複關係、解析失敗。另測試暫存寫入失敗、發布回復及備份保留。選填的 mitigates note 允許空字串。
- 最終完整測試 489/489（28 檔）。教材檢查 485 頁、21 份速查，錯誤 0、警告 85；照抄 0。1,451 個 content/text/根目錄 PDF 的來源雜湊不變。原始日誌與各輪來源快照分別留在 `tmp/analysis-export/`。
- 最後版本完整建置 760 頁，退出 0。最後測試與建置使用相同 scripts／fixtures bytes。建置後兩表仍逐 byte 相同。完整命令、來源快照、差異與限制見 `tmp/analysis-export/report.md`。
- 未改相依、CI、content、PDF、text、其他驗收工具或畫面。沒有計畫外的格式變更。本 worker 不簽全站驗收；非作者複核、協調者 QA 與 PR 由原負責者執行。
