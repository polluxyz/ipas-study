# 完整網站整合交接

2026-11-04。使用者要求的既有成果已整合到正式分支與4321網站。
產品合併為ea10480f6bb6ccfa90a48ea2ff626604701aee56（PR116）。
後續文件提交的HEAD以Git為準。網站程式仍在demo/。

## 使用者最新規則

- 新派worker最高使用gpt-6.1-sol high。xhigh只在主工作區使用。
- 審查也受此上限限制。同供應商不同工作階段不得稱跨供應商審查。
- 本次只更新既有本機網站，沒有新的外部部署。
- 水平右拖時圖正面跟著往右。普通箭頭已淡化，hover保留高亮。

派工細節見docs/orca-multi-agent.md。先執行orca skills get orchestration，依當版指令操作。目前plain check會自動確認訊息；不輪詢，不執行舊等待腳本。worker回報後通常自動關閉。不要傳送無需回覆的訊息給已完成worker，以免啟動新任務。

## 目前可看的網站

- 完整網站：http://127.0.0.1:4321/。
- 全站3D：http://127.0.0.1:4321/map/。
- 485個概念、21個單元、354題（200考古／70指引／84模擬）。
- 582條正式關係、47組正文輔助配對。每個概念頁各1個預設收合的局部3D面板。
- 正式關係保留方向與來源。正文連線預設關閉。無JS仍可沿文字入口閱讀。
- 作答與已讀沿用原attempts介面，沒有新增資料格式。

## 本輪已完成

PR115校正135份概念頁的關係，新增C17閱讀入口。固定核可名單25項，當版有效24項；cyclic-time-features已有合法題目而適用一般規則。Claude完成原內容主審。最後1項中度、4項低度問題另由作者修正，再由非作者Codex high複查。Root重算263筆SHA，976筆教材映射有效、920個目標已對應，照抄0。原8列證據及未變教學內容保留。

PR116完成全站與全部概念頁的3D整合。非作者重讀24檔，13項資料檢查、582條來源行、485頁結構及7項繪圖檢查通過，最後H0/M0/L0。3項中度問題均已關閉。保留載入、取消、重試、BFCache及文字降級的正反例。

Root獨立通過699項測試、913頁建置、1942份來源前後檢查。作者與Root的1779份來源及2193份產物逐檔相同。固定建置為c573ba431da643a389b481167654e6879cb249b6；Root收據為a772655a87bc6619e1d8c47629098de19f045c3b9c5ade7d2b8d7c860de8a15d。

完整Chromium156實測3種BFCache皆命中。4倍CPU的全站draw p95為11.4／8.7ms，局部首次可操作為166.8／169.5ms。沒有放寬16／200／100ms門檻。觸控是模擬，沒有實體手機驗收。

Root在320／375／1440寬度實際操作並親讀6張候選畫面。正式4321再驗3寬度；4張像素相同，另2張親讀。瀏覽器錯誤0，無水平溢出。正式更新核對912個頁面、125個資產回應及全部2193份產物，包含共用圖JSON與所有建置JavaScript。這些範圍不代表逐485頁人工看圖。

## 證據與未完成驗收

- 最新協調狀態：tmp/acceptance-20261103/state.json的liveCheckpoint。
- 正式更新：tmp/production-integration-20261104/full-3d-main-4321-r1/report.json。
- Root技術簽收：同目錄front-root-technical-accepted.json；原生驗證在front-native-root-r1與front-native-live-4321-r1。
- 非作者報告：同目錄front-peer-final-accepted/final-report.md。作者及歷史失敗證據仍保留在前端工作樹tmp/。
- 已完成計畫在tasks/archive/，含full-site-3d與concept-entry-completion的plan／todo。

R6獨立新16對的原分數仍是12/16，低於14/16門檻。沒有重選或改算原標註。後續規格釐清及新一輪一致性測試屬另一項工作。

舊N全站驗收因heap OOM失敗，不能寫成通過。PR108已修測試驅動器的記憶體處理，後續如需完整R0–R10須另做新的同版驗收。真人10題及匯出／清除／匯入驗收也未完成。本輪完成的是正式網站與3D整合，不是全站或真人驗收簽署。

## 環境保護與後續工作

- Root為D:/ipas-study；GitHub僅polluxyz/ipas-study。不要重做公開遷移。
- 本輪Run為run_0668a2365727，generation9。Root attested handle為term_3f83725a-88e3-4d1e-a1bd-1be5289ec446。不要使用舊term_35573d0f作--from。
- 使用者問答term_0edc63bb-1d4d-44fb-b56d-7551f2581f26及user-feedback-fixes工作樹不可關閉或重派。term_80ebf0cf-a74c-41a9-97dd-ea4fda13a398也由使用者接管。
- 審查終端term_e9507943-6bc8-4a5f-abb9-d7ed536bf64f已由使用者接管。worker-release回覆user_takeover，沒有關閉進程。保留此終端與full-site-3d工作樹，不再沿用本輪已完成Dispatch。
- 4321常駐term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f、候選4336常駐term_f62857d4-39d6-4517-a805-729c1d3baa1d均勿關。4334與舊原型／失敗N服務也保留，完整清單見協調checkpoint。
- 前端工作樹為E:/orca/workspaces/ipas-study/full-site-3d-production-20261104。內容工作樹為同根relations-semantic-corrections。兩者仍供受保護預覽使用，不刪工作樹或強制刪本機分支。
- 新工作不得復用已完成的Task／Dispatch。修改教材仍需非作者主審；不改PDF/text、官方答案、既有ID或手改分析CSV。

本輪worker均已回報。新需求另開session，先讀本檔與當版Orca guide。未獲使用者要求，不新增外部部署或自行重跑歷史驗收。
