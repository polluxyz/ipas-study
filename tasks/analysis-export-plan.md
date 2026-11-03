# 分析CSV匯出實作計畫

2026-11-03：使用者核可最小格式提案。規格見 `docs/specs/analysis-export.md`。

1. 協調者固定規格與套件指令。Ownership：協調者，`docs/specs/analysis-export.md`、本plan、todo、`demo/package.json`。
2. Codex實作純匯出函式、CLI、prebuild接線、正反fixture與測試，程式生成兩份CSV。Ownership：worker，`demo/scripts/export-analysis.mjs`、對應test、`tests/fixtures/analysis-export/`、`demo/scripts/prepare.mjs`、兩個analysis CSV。
3. 非作者核對格式、來源、失敗案例、確定性與建置接線。協調者再跑完整QA、看diff、開PR、CI全綠後合併。

風險：跨科引用遺失、概念被截斷、source漏值、CSV跳脫、輸出半完成。對策：先驗證全部來源，逐欄獨立對照；負fixture；完整保留原陣列；重跑byte比對。不得用匯出器修內容或放寬檢查器。

Root舊L候選固定到邊界停止；本功能在獨立worktree完成。整合後新候選驗最終契約，不改綁L原始證據。

## 實作紀錄

待worker與協調者依實際結果補記，不預填通過。
