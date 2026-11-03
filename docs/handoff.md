# 篩選控件修正與分支清理交接

2026-11-03 使用者要求繼續工作，並清理用完的分支。本輪控件修正已合併，預覽已更新。下一輪先處理下方3項待決。使用者尚未回答，不能推定核可。

## 工作環境與收尾規則

- 根目錄 D:/ipas-study；Orca repo 555621aa-2814-4352-83be-7ccb05ac7de4；GitHub僅 polluxyz/ipas-study。遷移與舊協調者清理已完成，不重做。
- Run run_0668a2365727；本協調者 term_6ae72750-d3f9-4a36-aba6-625e8ac3b453；generation 8。真正新session才run-use，確認自己的handle與generation增加。context壓縮不重綁。
- 本輪3個worker均已完成、release、關閉所有終端、ack。原版複審與修正曾平行執行。使用者問多工是否停用，已回答後續獨立任務仍用Orca多工。
- 常駐預覽 http://127.0.0.1:4321/；term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f，勿關。只保留協調者、常駐預覽及原有根目錄shell。
- 不自動開新協調者session。換session前依docs/orca-multi-agent.md發交接信。使用者已更新回答風格：短句、一句一事、術語先解釋。回報完整驗收數字，不把已授權工作退回使用者。

## 本輪修正與驗證

PR #88 已合併，產品commit f4b30c79ae39b9634ac695e2b5f6977142cffd0b。原作者head為32710f47f0a06c556fff143f937643c6c9834805。僅3檔：supplement-reading.css、prose-contrast.mjs及其test。

原I深色控件在淡底上使用淡字。692修正雖改善概念頁，卻讓獨立深底示範頁變成深字。692非作者複審為高0／中1／低0，原拒絕結論保留。327把淡底覆寫限於.study-content，保留獨立示範頁的淡字。

- 作者、非作者、協調者各自完成380／380 tests及760頁build。Root確認976有效映射、照抄0；1734來源前後同59a040d35953e2d862b63cf03e5a11bc608fe91edbf09c7498088cfc6d6091c5。
- 327非作者為新Codex Sol xhigh獨立session。高0／中0／低0；四格九類、6個dev場景、6個真DOM負例均通過。37張新圖親讀；原六類及4.5門檻未弱化。這是同provider，非跨provider。
- Root新預覽build760頁，served-check的24／24真HTTP逐bytes相同。正式smoke退出0。附加真HTTP探針通過4個ROC場景及6個dev場景、10個sealed context，保存8張新控件PNG；Root另親讀新圖。標籤最低11.1443、說明與狀態最低5.24796；深底示範為12.1524／7.75923。
- 新證據在tmp/rollout/filter-control-main-20261103/。source.json、receipt.json、served-check.json、smoke-command.json與filter-final-http/report.json綁定同版。後續文件變更不重綁這份收據；重做全站驗收要另凍結新候選。
- 本次只簽控件範圍。新smoke自動通過，不代表所有smoke圖片已人工簽核。既有dev/supplement-render深色表頭對比1.203732另案保留，移除本次規則後不變。

327 Root獨立日誌另存在tmp/rollout/filter-control-327-rootqa/。原runner沿用共用目錄，覆寫了692 Root日誌。692 Root只保留歷史摘要，不能再稱原始日誌可驗。692未完成的審查checkpoint與恢復後完整複審均保留。歷史I原始證據也保留。

## 已清理分支與證據位置

先核對PR與來源，再清理87個舊本機分支及84個舊worktree。未追蹤題圖逐一與main比對相同。清理前保存14,022檔、815,088,111 bytes與Git bundle；逐檔SHA及bundle verify通過。

作者與複審worktree也已另存440檔、29,258,363 bytes與bundle。這2個worktree及分支隨本輪合併收掉。文件分支經PR合併後刪除，最後只留main。以實際Git／Orca狀態為準，不重建已完成分支。

- 舊工作樹路徑已失效。tmp/branch-cleanup/20261103/archive-manifest.json記原路徑與保存路徑，removal-log.json記87筆收尾。
- 本輪作者及複審映射在tmp/branch-cleanup/20261103/final-filter/manifest.json。其下fix-filter-control與qa-filter-control-review保留原tmp結構。
- 327非作者報告：final-filter/qa-filter-control-review/tmp/rollout/filter-control-scoped-final-review/report.md及review.json。
- 692本次複審：同保存工作樹的tmp/rollout/filter-control-reading-review/resumed-20261103/。父目錄原暫停checkpoint也保留。
- 全部備份只留本機tmp，不提交公開庫。舊scratch腳本若寫死已刪worktree，先依manifest改用保存路徑。特別是補充probe所需owner-order writer-evidence/manifest.json。

## 全站成果與尚未完成的驗收

85／85寫作組、485概念、200考古題、1既有模擬題、21路線與21速查已整合。920／920目標有涵蓋。976映射為947 complete、29 partial。148頁owner-first及360責任列主要是metadata修整，不稱重新語意主審。公式pending與直接來源門檻不升級。

歷史候選I在tmp/rollout/final-browser-20261103-i/，固定edb46af。五個自動階段均退出0，但人工為高0／中1／低1，master未啟動。本輪修正只用新證據消除控件問題，不改寫I的原始結果。I的L1/S1舊側欄、147張速查圖的完整人工沿用鏈、ROC固定導覽遮擋及375px寬表中段未驗範圍都保留。

全站master與正式使用者試讀／測驗驗收未完成。使用者已操作側欄，也看過桌面／手機實圖，不能說完全未互動。

地圖資料有485概念、680條正式關係、127跨科共用概念。/map/仍是L23303原型：30節點、38正式關係、21正文輔助線、6階段。沒有兩科／21單元切換或每頁局部圖。唯讀建議在tmp/handoff/20261103-paused/map-current-scope.md；既有spec核可小型全域原型，但後續方向確認文件未找到。未派新原型，不稱全站圖譜完成。

## 待使用者決定

本輪已透過3個文字選項詢問。使用者後續只更新回答風格、詢問多工，尚未回答選項。

1. C12固定8頁條件例外。原缺口8、核可0、剩8。advisor與協調者均建議只對固定8頁，以有學習目的的正文／路線入口替代，逐頁驗證後生效。提案tmp/advisor/c12-approval-proposal.md。
2. 分析CSV匯出契約。題庫保留8欄、200題；關係採from_id,type,to_id,note,source_refs。advisor與協調者建議此最小格式。提案tmp/advisor/export-approval-proposal.md。不手改兩份分析CSV。
3. 一般「精確率」分詞漏失。advisor建議先保留S1「召回率」見證，再由使用者決定限制。協調者建議修復列為完成條件，先提spec／plan。提案tmp/advisor/figure-search-approval-proposal.md。原60查詢不能替換，不將換詞稱修好搜尋。

收到核可後先更新既有spec／plan，再派工作。正式site/、章末70題、新模擬題與外部部署不在本輪範圍。Python固定UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv、UV_NO_SYNC=1；PDF runtime在tmp/pdf_runtime。原PDF與text/不修改，私人備份與account／API收據不提交。
