# 完整網站整合交接

## 目前進度（2026-11-08）

- 已上線：每日題本（PR #190，`ad359b6`）。規格`docs/specs/daily-booklet.md`，驗收與上線紀錄在`tasks/daily-booklet-plan.md`實作紀錄。4321已更新，隔離瀏覽器走查全過。
- 待使用者確認：開`/daily/`看本人資料是否已遷移成題本（使用者原有科目1的2026-11-06題組，open，作答0筆）。提醒關閉舊分頁再開。自動走查只用隔離瀏覽器造資料，未驗證實體手機、Safari、Firefox。
- 小待辦：規格第219行註解寫「沒有舊資料時`migratedAt`是null」，程式在全新環境也寫入時間。不影響資料，只改註解。
- 建議（由Codex判斷）：320暗色「結束這本」按鈕對比偏低；他科交卷恢復失敗時該科卡片仍寫「作答中」。
- 待決定（Ask first）：是否補科目3非程式題。規格第192行：第8本起程式題比例升高。
- 待清理：`booklet-*`、`daily-booklet-mockup`、`deploy-main-dist`工作樹與對應本機分支。清理前確認證據已複製到`tmp/demo-shots/`。
- Codex 0.166.0新worker用`--agent codex`會被更新提示擋住。改用`orca terminal create --command "codex ... -c check_for_update_on_startup=false"`開終端，等`tui-idle`後再`worker-start --terminal`。
- 已上線：每日題組交卷模式（PR #185，`0626fd2`），紀錄在`tasks/daily-exam-mode-plan.md`。
- 派工：使用者要求多派worker、任務細分，每個worker只做一件事。
- 題庫：main為b992705時，verified模擬題科目1有560題、科目3有491題，需求各450。狀態見`tasks/question-bank-expansion-todo.md`。
- 4321：不是常駐服務，重開機會停。雙擊桌面`AI學習手札.cmd`（repo外）啟動並開`/daily/`；加`--no-open`只啟動不開頁。該檔用`astro preview`提供`D:/ipas-study/demo/dist`，固定4321。不要換連接埠，localStorage作答紀錄跟著網址走。更新時絕不在主工作目錄建置：在獨立工作樹用main建置，再robocopy /MIR覆蓋（`tmp/daily-verify/booklet/deploy-main-dist.sh`）。
- Orca Run：run_e8563c302ab9。worker可能卡在輸入框，派工後要確認畫面有Working。
- 工作樹：main＋5個保留工作樹，遠端只剩main。清理工具`tmp/question-bank/archive-worktree.mjs`。

以下是2026-11-04以前的內容。其中的題數、唯一常駐終端與未提交草稿的敘述已過時，以本節為準。

## 2026-11-04整合紀錄

使用者要求的既有成果已整合到正式分支與4321網站。
當時最新產品合併為05cc425eec1fc8955d1a661b453ca16713103dd6（PR122）。
後續文件提交的HEAD以Git為準。網站程式仍在demo/。

## 使用者最新規則

- 新派worker最高使用gpt-6.1-sol high。xhigh只在主工作區使用。
- 審查也受此上限限制。同供應商不同工作階段不得稱跨供應商審查。
- 本次只更新既有本機網站，沒有新的外部部署。
- 只保留主要預覽4321。其他7個預覽服務已停止，不再重開。
- 任務完成後，封存證據並清理已用完的工作區與分支。使用中的工作階段與未提交修改保留。
- 水平右拖時圖正面跟著往右。普通箭頭已淡化，hover保留高亮。

派工細節見docs/orca-multi-agent.md。先執行orca skills get orchestration，依當版指令操作。目前plain check會自動確認訊息；不輪詢，不執行舊等待腳本。worker回報後通常自動關閉。不要傳送無需回覆的訊息給已完成worker，以免啟動新任務。

## 目前可看的網站

- 完整網站：http://127.0.0.1:4321/。
- 全站3D：http://127.0.0.1:4321/map/。
- 485個概念、21個單元、354題（200考古／70指引／84模擬）。
- 582條正式關係、47組正文輔助配對。每個概念頁各1個預設收合的局部3D面板。
- 正式關係保留方向與來源。正文連線預設關閉。無JS仍可沿文字入口閱讀。
- 作答與已讀沿用原attempts介面，沒有新增資料格式。
- 485個概念頁的小標與桌面、手機目錄已改成「概念說明」。補充標記與原有連結保留。
- 全站與局部圖已移除明細區及2個尾部清單。hover資訊、點選高亮與圖形操作保留。
- 側欄原「本次學習路線」已改為目前課程的代碼與原標題，例如「L23103 數值優化技術與方法」。

## 本輪已完成

PR122只改共用側欄標籤及2處既有測試斷言。Root完整讀取2檔差異，通過716項測試、教材與照抄檢查、913頁建置。Root逐頁核對側欄：902頁只改標籤與Starlight衍生的data-hash，11頁不變，涵蓋21課程。階段、連結、順序及收合屬性均相同；舊分頁的收合記憶首次可能回到原預設，還原程式與儲存格式未改。

固定建置為ba36533a9cdc1bd74fabe091f015594b4e721cbb；Root收據為96f4e2321f0bc8345b62c32d28d6ae067acb38c2397e556e81f551f6725097fb。1781份來源與2193份產物核對後更新4321，核對912頁與125資產回應。Root以1440／375寬度驗6組標題、收合與連結操作，隔離瀏覽器及正式4321均為0錯誤。親讀4張隔離畫面；正式2張逐位元相同，另2張手機畫面重新親讀。沒有新增預覽服務。

使用者追加要求的清理已完成：停止4323、4324、4331、4332、4334、4335、4336，只保留4321且回應200。既有22個本機分支、4個遠端分支已清理；本次側欄來源分支也已另行清理。保留工作樹與證據，清理前的分支備份在tmp/preview-branch-cleanup-20261104/branches-before-cleanup.bundle。

使用者隨後追加要求清理工作區。本輪範圍為21個已完成工作樹。每個工作樹先封存原始碼、建置產物與證據，逐檔核對SHA-256後才移除。進度與實際移除結果以最新checkpoint為準。node_modules及可重建的Python環境不封存。各提交均可由既有分支備份還原。保留主工作樹、4個使用者接管的工作樹，以及1個有未提交修改的工作樹；不影響4321。

封存位於tmp/workspace-cleanup-20261104/archives/，每個tar.gz都有對應manifest.json。移除清單與回執在同目錄的removals/。較早報告中的已移除工作樹路徑，改由這些封存檔查證；不改寫舊建置收據或驗收結果。

PR120依使用者截圖，從共用圖譜元件移除「選取概念查看明細」、「目前範圍的完整文字清單」、「目前範圍的全部連線與來源」。實際刪除元件、專用事件及樣式，沒有保留空容器。點選保留高亮；鄰接範圍可切換中心。搜尋、單元模式、共享網址、原正文、關係表、來源及伺服器概念目錄仍保留。

Root以非作者身分重讀7檔差異，通過716項測試、教材與照抄檢查、913頁建置。另核對486個圖譜頁面：區域外HTML及12849個HTML ID均不變。圖資料除建置head外逐欄相同，仍是485概念、21單元、582正式關係、47組正文配對。固定建置為d739199a7a33b6b22560017bdcf8e9e2954b9026；收據為45c54232945f899609359f572a809ce5822611ee0cf55c0f4c4f1ec199532067。1781份來源及2193份產物逐檔核對後更新4321，並核對912頁與125資產回應。

同版真HTTP驗證涵蓋1440／375的全站及局部圖，共4組互動與2組文字降級案例，瀏覽器錯誤0。Root親讀4張候選畫面；正式4321另跑相同範圍，2張畫面逐位元相同，另2張重新親讀。這次沒有重跑完整smoke、BFCache或效能套件，不引用舊結果宣稱本次全套通過。

PR118修正「直覺」小標未更新的問題。共用建置外掛只轉換概念頁的顯示文字；485份Markdown原文、教材簽章、數學內容與圖譜資料不變。447個一般小標、38個補充小標及970個目錄標籤已更新。12843個既有HTML ID完整保留，3054個實際證據連結仍有效。原輔助程式誤報的6筆問題已撤回，沒有新增連結別名或修改教材資料。

非作者Codex high審查結果H0/M0/L0。Root獨立通過709項測試、913頁建置、教材與照抄檢查。1945份來源前後未變。固定建置為ddf2f2f0d429cc0a54781edde13fa0f7652b88eb；收據為567b2001982acf1c309e6fca3c7d531e7171ae49f41211bcc30be1721cc5e766。1781份建置來源與2193份產物逐檔核對後更新4321，並核對912個頁面與125個資產回應。

Root實測一般與補充概念頁，共4組桌面／手機案例。原有錨點與兩種目錄均正常，瀏覽器錯誤0。候選版親讀6張畫面與1張目錄細節；正式4321的2張桌面畫面逐位元相同，另4張手機畫面重新親讀。這是小標修正驗證，不代表全站人工驗收。

以下為較早的整合成果與當時驗證；不將舊建置收據改標成PR118。

PR115校正135份概念頁的關係，新增C17閱讀入口。固定核可名單25項，當版有效24項；cyclic-time-features已有合法題目而適用一般規則。Claude完成原內容主審。最後1項中度、4項低度問題另由作者修正，再由非作者Codex high複查。Root重算263筆SHA，976筆教材映射有效、920個目標已對應，照抄0。原8列證據及未變教學內容保留。

PR116完成全站與全部概念頁的3D整合。非作者重讀24檔，13項資料檢查、582條來源行、485頁結構及7項繪圖檢查通過，最後H0/M0/L0。3項中度問題均已關閉。保留載入、取消、重試、BFCache及文字降級的正反例。

Root獨立通過699項測試、913頁建置、1942份來源前後檢查。作者與Root的1779份來源及2193份產物逐檔相同。固定建置為c573ba431da643a389b481167654e6879cb249b6；Root收據為a772655a87bc6619e1d8c47629098de19f045c3b9c5ade7d2b8d7c860de8a15d。

完整Chromium156實測3種BFCache皆命中。4倍CPU的全站draw p95為11.4／8.7ms，局部首次可操作為166.8／169.5ms。沒有放寬16／200／100ms門檻。觸控是模擬，沒有實體手機驗收。

Root在320／375／1440寬度實際操作並親讀6張候選畫面。正式4321再驗3寬度；4張像素相同，另2張親讀。瀏覽器錯誤0，無水平溢出。正式更新核對912個頁面、125個資產回應及全部2193份產物，包含共用圖JSON與所有建置JavaScript。這些範圍不代表逐485頁人工看圖。

## 證據與未完成驗收

- 最新協調狀態：tmp/acceptance-20261103/state.json的liveCheckpoint。
- 工作區清理：tmp/workspace-cleanup-20261104/；archives-verified.json為封存總表，removals/保存逐個移除回執。
- 側欄標題：tmp/sidebar-course-title-20261104/accepted-evidence/；正式畫面在native-live-4321-r1/。
- 最新正式更新：tmp/production-integration-20261104/sidebar-course-title-main-4321-r1/report.json。
- 預覽與分支清理：tmp/preview-branch-cleanup-20261104/complete.json；本次來源分支清理另見tmp/sidebar-course-title-20261104/branch-cleanup-complete.json。
- 圖譜區域移除：tmp/graph-panel-removal-20261104/accepted-evidence/；正式畫面在native-live-4321-r1/。
- 較早圖譜更新：tmp/production-integration-20261104/graph-panel-removal-main-4321-r1/report.json。
- 小標修正：tmp/heading-labels-20261104/accepted-evidence/；正式畫面在native-live-4321-r1/。
- 較早小標更新：tmp/production-integration-20261104/heading-labels-main-4321-r1/report.json。
- 較早3D更新：tmp/production-integration-20261104/full-3d-main-4321-r1/report.json。
- Root技術簽收：同目錄front-root-technical-accepted.json；原生驗證在front-native-root-r1與front-native-live-4321-r1。
- 非作者報告：同目錄front-peer-final-accepted/final-report.md。作者及歷史失敗證據仍保留在前端工作樹tmp/。
- 已完成計畫在tasks/archive/，含full-site-3d與concept-entry-completion的plan／todo。

R6獨立新16對的原分數仍是12/16，低於14/16門檻。沒有重選或改算原標註。後續規格釐清及新一輪一致性測試屬另一項工作。

舊N全站驗收因heap OOM失敗，不能寫成通過。PR108已修測試驅動器的記憶體處理，後續如需完整R0–R10須另做新的同版驗收。真人10題及匯出／清除／匯入驗收也未完成。本輪完成的是正式網站與3D整合，不是全站或真人驗收簽署。

## 環境保護與後續工作

- Root為D:/ipas-study；GitHub僅polluxyz/ipas-study。不要重做公開遷移。
- 工作區清理Run為run_07aad1d9e1d8，由Root處理，未另派worker。較早側欄Run為run_bd70380caad0、圖譜Run為run_743fdc87220f、小標Run為run_2d14c4fc763e、整合Run為run_0668a2365727。Root attested handle為term_3f83725a-88e3-4d1e-a1bd-1be5289ec446。不要使用舊term_35573d0f作--from。
- 使用者問答term_0edc63bb-1d4d-44fb-b56d-7551f2581f26及user-feedback-fixes工作樹不可關閉或重派。term_80ebf0cf-a74c-41a9-97dd-ea4fda13a398也由使用者接管。
- 審查終端term_e9507943-6bc8-4a5f-abb9-d7ed536bf64f已由使用者接管。worker-release回覆user_takeover，沒有關閉進程。保留此終端與full-site-3d工作樹，不再沿用本輪已完成Dispatch。
- 唯一常駐為4321的term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f。候選、原型與失敗N服務均已依使用者新指示停止，較早保護這些預覽的指示已失效。使用者問答與接管的agent工作階段仍保留。
- 前端工作樹為E:/orca/workspaces/ipas-study/full-site-3d-production-20261104。內容工作樹為同根relations-semantic-corrections。兩者已停止預覽，檔案與使用者工作階段保留。
- 小標、圖譜區域移除與側欄工作樹列入本輪清理。來源提交、建置產物與證據統一由主工作樹的封存還原；移除狀態查對應回執。
- relations-reviewed-corrections工作樹有未提交的舊內容修改，分支保留。不要丟棄修改，也不要自動回套main。其餘保留分支供使用者接管的工作階段使用。
- 主工作樹的docs/specs/question-bank-expansion.md是既有未提交草稿。本次沒有編輯、提交或刪除此檔。
- 新工作不得復用已完成的Task／Dispatch。修改教材仍需非作者主審；不改PDF/text、官方答案、既有ID或手改分析CSV。

本輪worker均已回報。新需求另開session，先讀本檔與當版Orca guide。未獲使用者要求，不新增外部部署或自行重跑歷史驗收。
