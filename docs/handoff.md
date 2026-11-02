# 交接：新根已接管，85組教材已合併

即時進度以本機 `tmp/scratch/coordinator-current-state.json`、`tmp/rollout/handles.txt`、Orca與GitHub實際收據為準。完整所有權已交給新協調者，不等舊協調者，不重問已核可工作是否繼續。

## 位置與接管

- 正式根 **D:/ipas-study**；Orca repo **555621aa-2814-4352-83be-7ccb05ac7de4**。唯一公開GitHub仍為 **polluxyz/ipas-study**，node **R_kgDOVfp2dg**。公開遷移已完成，舊GitHub已刪除，不重做建庫、改名、公開或刪庫。
- Run **run_0668a2365727**；本輪協調者 **term_5dfd834e-12b7-4ecf-8fd6-22838bb9a21f**，consumer generation **7**。下一協調者先 `orca orchestration run-use --id run_0668a2365727 --json`，核對自己handle與新generation，以實際CLI收據接管。
- 使用者要求整個資料夾遷移、舊的關掉，已完成：最後舊協調者終端已關，舊setup **570d4390-9695-4278-96b3-3d05d3962a51** 已從Orca移除，repo list／project setups／terminal list已驗證。D:/AI_test、舊工作樹及private-backups檔案保留離線備份，不再使用舊根執行環境。
- 新根預覽 **http://127.0.0.1:4321/**，HTTP 200；常駐終端 **term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f**，勿關。舊setup移除曾讓前一預覽失效，現已重建並確認程序來自新根。這是static preview；main更新後須重新build才看得到新內容。
- Windows只用 **C:/Program Files/Git/bin/bash.exe**，PATH的bash可能指WSL。PS1用UTF8 BOM，中文JSON讀取指定UTF8。
- Python固定 **UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv、UV_NO_SYNC=1、PYTHONIOENCODING=utf-8**，建議加PYTHONDONTWRITEBYTECODE=1、MLFLOW_DISABLE_AGENT_HINT=1。uv在C:/Users/Administrator/.local/bin/uv.exe；原鎖檔138套件、13套件匯入已驗證。PDF runtime唯讀共用D:/ipas-study/tmp/pdf_runtime；來源資料讀各工作樹。
- 私有收據／API／帳號／敏感字串／舊歷史不提交。`tmp/migration/public-push-guard.cjs`從frozen私有備份讀政策，已不依賴舊根。每次push前敏感命中0、舊歷史交集0；公開provider noreply歸因不是私人email。

## 教材與公式

依已核可 `tasks/full-site-plan.md` v3及 `docs/specs/textbook.md`。正式分組表為本機 **tmp/rollout/merged/writing-groups.csv**，85組；merged/v1是舊盤點，不可復活已整併的組。

- **85/85寫作組已合併main**。本輪新庫內容PR #3、#4、#5、#6、#8至#15全部取得非空成功CI後squash；文件PR #7亦已合併。#5曾空checks，調查取得真實成功CI後才合併。main本輪里程碑 **6e126391485a0a00b43ab9efd4c3d9c8ca725fab**；其純教材快照另經協調者230測試、914/914映射、照抄0及529頁build驗證。
- 最後W-L21302-B／PR #15：協調者230/230 tests、899/899映射列、教材錯誤0、照抄0、build完成、public guard兩項0；CI **41405447897** SUCCESS後合併。RR4 14/14列固定版本SHA已獨立核對；CK3由協調者再跑99/99核算、2/2程式輸出。
- PDP/marginal-average及AP/mAP已經CK2獨立核算、實質複審並簽核，隨PR #10/#11合併；不要把M4較早快照的stale數字當成現在main損壞。multimodal-deployment-optimization/throughput-window亦已CK3複簽。
- 仍pending的5群：lora/parameter-budget、optimizer-selection/optimizer-state-memory、network-capacity/dense-layer-count、edge-inference/serial-latency、gpu-inference-scheduling/schedule-window。數字算對但來源沒有直接列完整式，不能放寬規則；補直接來源再非作者複簽，或保留pending及自行推導說明。
- **85組不代表全站完成**：目前完整投影874/920目標，剩46個屬已核可M4補強，分母不可縮。原13列partial保留實際性質。

## M4既有25頁補強

盤點與五份精確Task在 `tmp/rollout/m4/`，本次共通說明 `tmp/rollout/specs/M4-live-common.md`優先。原63涵蓋列及1處外部引用受改頁影響，須實質重審，不能機械rehash。

- M4-A：6頁資料切分／洩漏／Pipeline／巢狀驗證；M4-B：5頁更新、學習率、曲線、早停、過擬合；M4-C：2頁實驗追蹤、模型比較。A／B／C作者已交稿，協調者已凍結SHA並驗舊goal／檢核／公式保全；涵蓋提案分別30／26／14列，正跑非作者主審，CK-M4-A已派。
- M4-D：4頁迴歸指標／殘差；M4-E：8頁分類指標／IoU，均進行中。E曾遇Windows argv過長而未建立Dispatch，改用明列SHA的本地完整Task附件，要求不變，已正常開工。查Run、handles與啟動收據避免重派；UNCONFIRMED或start_unknown不是未派工證據。
- 作者不commit/build。協調者看diff及實測、凍結版本後，依頁面實際author安排非作者provider主審，另由非作者Codex核算。完全未改的sufficient頁不湊量重寫，但新映射仍須非作者讀實際證據。

## 200題考古題

既有29題之外，**171題原題草稿全交齊且抽取契約已驗**。E1–E8依序22、21、28、10、23、25、34、8題；協調者另回原卷目視抽查40題，證據在 `tmp/rollout/exams/coordinator-spotchecks.json`。草稿不等於解析完成或可發布。

- 全新盲解程序實體cwd固定 **E:/orca/workspaces/ipas-study/blind-e<n>**，無Git、教材、官方答案，只給id/stem/options/code/code_lang及核准乾淨圖。Orca關聯EX工作樹僅管理生命週期，不授權讀那裡的檔案；盲解禁止讀CLAUDE／handoff／PDF／text／題庫／作者報告。
- 必讀技能與CLI生命週期操作說明可以讀，不能作判答資料。BL-E3因舊Task白名單過嚴而自報failed；確認只額外讀操作規範、沒讀答案後，CSV原樣接受並保留failed生命週期與例外，不能假報成功。launcher已明確說明此界線。
- E1–E8共 **171題盲解已全部接受**，原樣CSV複製到各EX工作樹tmp。114-2-S3-Q37盲C／官方B；同字母題仍須處理語義瑕疵，不手改CSV。
- X-E1、X-E2、X-E3、X-E4共 **81題解析已交稿**，協調者核對原題保全與完整性。E1／E2 Claude RV已交，仍有修正與爭議判定；CK-E2已派非作者Codex，比較作者與RV對Q26／49／50等分歧的一手依據，未照R1/R2直接抹去限制。CK-E1待派。RV-E3、RV-E4已交，仍有少量用語修正；CK-E1、CK-E4進行中，CK-E3待派。
- X-E5、X-E6、X-E7、X-E8均進行中。X-E6首次模型容量錯誤且未開工，依Orca實際收據abandon後，以同Task和同模型retry為ctx_ff94ab457a7b，現已正常工作；勿重派。作者不兼盲解。
- E4只Q46需要PNG；E5只115-1-S1-Q19表格；E8只115-1-S3-Q47 CNN分區圖。均已由協調者看原頁與乾淨圖、核准SHA、登記既有manifest並dry-run，0答案標記洩漏。純程式已完整轉錄者不重複圖。E5／E8白名單包各帶1圖，兩批全新盲解已驗收。
- YAML image仍待既有merge-images正式回填，不手填。**不要提前跑merge-blind.cjs**，它會把同答案draft直接升verified。先完成解析、Claude RV＋非作者Codex CK、必要FX／非作者複核，再先處置真正disputed，最後用腳本寫blind_answer。官方answer永不改。
- 自足Task草稿在 `tmp/rollout/remaining/task-drafts/`；共通補充在specs。流程EX→必要IMG及協調者核准→白名單匯出→全新BL→原樣CSV驗收→X→RV＋CK→FX／複核→協調者整合。

## 後續與操作

- 除M4與考古題，尚須 **20份代碼學習路線＋20份速查**、既定CNN關係、最後閱讀／鍵盤／320與375與桌面深淺主題／搜尋／作答與錯題本回歸。已有72份Task草稿，不重做整份盤點。
- 正式site/、70題指引章末題、模擬題與部署仍待核可；本次不自行納入。新依賴、格式／ID規則／關係類型或workflow仍Ask first。
- 派波先查orca account list；含協調者Codex≤10、Claude≤6。只用Orca，先取版本相符skill，按docs/orca-multi-agent.md兩段式。新worktree先frozen-lockfile安裝。
- 收信用tmp/migration/settle-mail.ps1，自己驗收完整報告／diff／實測後明列Accept dispatch，再release、關完成終端、ack整批。question或escalation需處置後人工ack；unknown、timeout不是死亡證據，不重派。
- helper在tmp/rollout/coord；dispatch-safe在tmp/migration。land-pr會pull根，主checkout保持main及乾淨，文件工作另用工作樹。guide-coverage三方衝突按key合併、保留舊列並重跑驗收。
- PR須協調者教材／照抄、230 tests、build、diff驗收；CI非空全SUCCESS、head不變、分支正確、--match-head-commit才squash。禁止直接push main。
