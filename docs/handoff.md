# 全站教材交接

本文件更新至21碼整合完成的main快照 5dd99a87b59450d91b165c789ee6dd6b962ea010；接手時仍以tmp/scratch/coordinator-current-state.json、tmp/scratch/continuation-20261102-current.md及實際Orca/GitHub收據為準。全站已核可工作持續執行，不等舊協調者，也不重問遷移或是否繼續。正式根D:/ipas-study。

## 已整合與仍在進行

- 85／85 寫作組已合併；main 有 485 個概念、200 題考古題與 1 題既有模擬題。涵蓋 920／920 目標；976 個有效映射列中 947 complete、29 partial。這些數字不等於全站驗收完成。M4-A–E、D01–D04、C7、CNN 與 C10 已合併；C10 前置關係刪 33、增 3，冗餘 32→0，原 partial 與缺少直接來源的 pending 不升級。
- 學習路線與速查各21／21均已合併main，含PCA純補充列標示修正。整合時查真正的 head、內容審查、父頁差異、QA 與 CI，勿用舊隊列或白名單代替最新審查。歷史盤點 `tmp/rollout/coord-assist/final-integration/report.md` 是當時快照，不是現況或全站簽章。
- 最終 21 碼：科目 1 為 L21101、L21102、L21103、L21104、L21201、L21202、L21203、L21301、L21302；科目 3 為 L23101、L23102、L23103、L23201、L23202、L23203、L23301、L23302、L23303、L23304、L23401、L23402。每碼均需路線及速查，按固定版本核內容與連結後整合。
- 例子切換的參數澄清 PR #42 已合併，閱讀不同例子時應明確而簡短地交代資料或設定切換。題目 Markdown renderer PR #58 已合併；協調者在真 Q49 驗到題幹五段程式、三表、選項公式、鍵盤選答、答後及 Storage。D04三處selector修補PR #62亦已通過非空成功CI合併。其 522 項是離線工具回歸，不代表完整真 UI 已驗收。
- 148 頁 owner-first 只改 metadata 的版本，協調者已採三位非作者片段建立 360 列真實簽章沿用鏈，保留原 reviewer 與 note；這不是重新進行全頁語意主審。此批已由協調者273測試、976有效列、742頁含型別檢查驗收，PR #67取得非空成功CI後合併。main全部485頁的首碼現在都符合總表owner。逐頁 SHA 與證據在對應 `tmp/rollout/owner-order/` 報告及 coordinator-integration proof。

## 兩項待使用者決定

1. C12：原成功條件仍有 8 頁缺題庫引用或有類型關係，目前核可例外 0。固定八頁的有條件閱讀入口例外仍是提案，見 `tmp/advisor/c12-approval-proposal.md` 和 `c12-eight-final.md`；未核可前不套用、不造關係、不改 spec。分報原始缺口、已核可且當版有效例外及剩餘缺口。
2. 分析 CSV：新關係表頭與欄位映射提案尚待核可，見 `tmp/advisor/export-approval-proposal.md` 與 `export-contract.md`。不要自行定格式或手改衍生 CSV；其他已核可工作繼續。

## 最終驗收與交付

固定最終 main 後依正式規格完成 R0–R10，不以局部 review 代簽：R0 凍結來源與正式 build receipt；R1 全路由、內鏈、錨點；R2 320px、375px、桌面各深淺主題六格的資產與人工視覺；R3 21 碼章序與主責導覽；R4 公式、表格、程式、圖、局部捲動及答後；R5 補充、檢核、逐選項理由與鍵盤；R6 單元／階段題池、作答與計分；R7 錯題備份還原、去重及統計；R8 Storage 故障與歷史保全；R9 Pagefind 60 次真 UI 查詢；R10 地圖、21 份速查、六格與列印。真舊正整數題目 revision 樣本尚未適用，不能以新版本替代冒稱完成。另須更新常駐 preview 並驗其版本，目前仍是舊 build，勿關常駐終端。

原 `site/`、指引章末 70 題、額外模擬題與外部部署不在本輪範圍。部署或資料格式等 Ask first 事項仍需使用者同意。

## 接手操作

Run為run_0668a2365727，現協調者term_5dfd834e-12b7-4ecf-8fd6-22838bb9a21f、generation7；新Orca repo為555621aa-2814-4352-83be-7ccb05ac7de4。真正新接管先run-use並核實新handle/generation，壓縮延續不重綁。預覽http://127.0.0.1:4321/的常駐終端term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f勿關，最後須核HTTP與served bytes。Windows固定C:/Program Files/Git/bin/bash.exe，PS1為UTF8 BOM，中文JSON指定UTF8。

最終工具仍有figures建置收據/雙context監測補強及額外owner導覽/Q49六格/人工收件探針在審，收信前查實際狀態避免重派。未取得最終同SHA真R0–R10及人工證據前，不稱整站驗收完成。


- 維持 Orca 既有 Run、派工與收件紀錄；先查實際 worker／dispatch／收據避免重派，unknown 或 timeout 不代表已退出。只有真正更換協調者 session 才做 `run-use`；context 壓縮不是換綁理由。完成後照 `docs/orca-multi-agent.md` 驗收、release、關閉完成終端並 ack。
- PR #41 已記錄模型選擇：中等任務可用 Terra／xhigh；root 與深度審查用 Sol／xhigh。本輪 Claude 額度用完後，採非作者、不同 session 的 Codex 審查，報告與 PR 如實標明同 provider，不冒稱跨 provider。工作者與協調者按既有額度限制與最新 Orca 狀態派工。
- 每個 worktree 在根目錄先執行 `pnpm --dir demo install --frozen-lockfile`。Python 共用環境設 `UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv`、`UV_NO_SYNC=1`；PDF runtime 為 `D:/ipas-study/tmp/pdf_runtime`，來源資料讀各自工作樹。歷史 plan 中舊路徑僅為當時紀錄，不作現在命令。
- 協調者自行看固定版 diff、檢查、測試、build 與實際審查證據；PR 合併前確認正確分支、head 與非空成功 CI，再按既有流程 squash。不要修改官方 PDF／`text/` 或替 pending 公式放寬直接來源門檻。
