# 全站教材計畫：科目 1 與科目 3 其餘 20 個評鑑代碼

2026-11-01 建立，同日改 v2（依 advisor 意見 `tmp/advisor/full-site.md`），再改 v3（M1 概念清單與 advisor `tmp/advisor/m1-decisions.md`）。狀態：**使用者 2026-11-01 核可**（全部照建議）。
第 0 階段設計與合併只寫 `tmp/rollout/`；併入正式表走 PR。
依據：使用者 2026-11-01 指示「教材品質維持最高標準；多派 agent 平行；先把科目 1、3 都完成」。考試是 115/11/14（2026-11-14）。
規格沿用 `docs/specs/textbook.md` v1.9（第 11 節第 7 步「全站」已核可），不另寫新規格。本計畫只處理規模、順序、平行、擁有權與交付方式。

## 1. 目標與完成定義

- 總目標不變：科目 1、科目 3 全部 21 個代碼都有完整教材。
- 考前改成**滾動交付**：一個單元驗收完就通知使用者可以讀，不等全站完成。
- 「完整單元」的條件：已審概念頁、每個學習目標有檢核、必要例子與圖、涵蓋表有效複審、考古題 YAML 已核對、代碼頁（學習路線）、速查頁。協調者在固定版本跑檢查、測試、建置，並看主要瀏覽流程。
- 頁面先交、但代碼還有缺頁時，明列缺項，不稱為完整單元。
- 涵蓋率分母維持全站。不用 `in_scope=false` 排除還沒寫的指引目標。另列「本批承諾」與「已交付」兩個數字。

## 2. 規模（M1 合併＋M3 整併後，使用者核可）

| 項目 | 數字 |
|---|---|
| 評鑑代碼 | 已完成 1（L23303），其餘 20 |
| 學習目標 | 本輪 876 個 in_scope；全站分母 920（既有 44＋本輪 876，PR #6 實測） |
| 概念頁 | 全站 485 頁＝新建 454＋沿用已發布 31。M1 原為 492（新建 461），4 項整併少 7 頁 |
| 沿用頁補強 | 31 頁中 25 頁有新責任，盤點後依 advisor 三段補強（12＋9＋4） |
| 考古題 | 200 題，主碼見 `tmp/rollout/questions-map.csv`；L23303 已做 29 題，其餘 171 題 |

- 492／485 頁是核可當下的快照。之後新增或拆分只送差異清單。
- 4 項整併：風險處置 4 頁→`risk-response-strategies`；關聯規則 3 頁→`association-rule-metrics`；`simple-imputation` 併入 `missing-value-imputation`；`data-drift-monitoring` 併入 `model-monitoring`。
- `time-complexity`（114-2 科3 第33題）缺負責頁，由 M3 決定承接方式。
- 13 天內全部完成**沒有把握**。新建 454 頁約需每天 40 頁以上驗收完成。開寫後 24 小時量實際產能，最遲 11/03 回報完工區間。

## 3. 品質流程（不降級）

每個寫作組（4–8 頁），寫完一組就接審，不等整波：
1. writer（Codex，`--search`）依 `W-common` 寫頁、例子 JSON、涵蓋表片段。
2. 非作者審查：事實、公式獨立核算、程式實測、照抄、補充標示、涵蓋深度。同一 reviewer 可一次審內容與涵蓋，兩份結果分開列。主審用 Claude Opus 5.5 或 Gemini 4 Argon；公式核算與程式實測由非作者 Codex 負責（第 8 節第 2 項）。
3. 原 writer 修正；非作者複核受影響部分，簽最後版本雜湊。
4. 協調者驗收：`verify-group.sh`（檢查器、check-copy、run-code）、抽查數字、看 diff。

每個代碼另有：考古題 YAML（抽題 → 盲解 → 解析 → 審查）、代碼頁、速查頁。
- 盲解用全新、沒看過答案的 session。9 個設計 worker 與解析作者都看過答案，不擔任盲解。
- 引用頁、例子 JSON、圖改動時，列出受影響頁面人工安排重審（雜湊只保護主頁）。

## 4. 階段

| 階段 | 內容 | 產出 |
|---|---|---|
| 0 設計 | 9 組 Codex：學習目標、概念清單、寫作分組、例子提案、考題對應 | `tmp/rollout/design/<組>/` |
| 0 合併 | 協調者用 `tmp/rollout/merge-design.mjs` 合併、去重、定 owner；**暫存，不先併入正式表** | `tmp/rollout/merged/` |
| 0 核可 | 使用者核可概念清單 → 協調者併入 `concept-index.csv`、`guide-topics.csv` → 放行對應寫作組 | 正式表 |
| 0 考題 | 沿用 `tmp/l23303/classify/` 的 200 題分類，對照各組 `exams.csv`，補核分歧。驗 200 個唯一 ID、每題一個主碼、29 題不重抽 | `tmp/rollout/questions-map.csv` |
| 0 網站驗證 | 用 demo 加一個科目 1 單元，確認多代碼路由、學習路線、搜尋、題庫、速查。治理類速查若需不同欄目，先提最小規格修改 | 驗證報告 |
| 1… 寫作 | 流水作業：寫、審、修、考題、圖穿插 | 可讀單元 |

概念核可順序：**暫存提案 → 使用者核可 → 協調者併入 → 放行**。

## 5. 優先順序

排序原則：先做直接前置概念與已發布單元的缺口，再依「尚未支援的考古題數、跨科重用、基礎價值」對總成本排序。考前分主隊列與第二隊列。歷屆題數只是觀察資料，不換算成下次出題機率。

**首批 16 組（95 頁）**，協調者與 advisor 各自排序後比對，15 組相同，採 advisor 的 W-L23201-A（紀錄：`tmp/rollout/coord/batch1-mine.md` 末尾）：

1. 第一段：W-L23102-A、W-L23101-A、W-L21302-A、W-L21101-A、W-L21201-A。
2. 第二段：W-L23101-C、W-L23103-A、W-L23103-B、W-L23201-A、W-L21302-D、W-L21203-A。
3. 第三段：W-L23301-A、W-L23301-C、W-L23203-A、W-L23203-B、W-L23203-C。

**第二批優先**：W-L23203-D（14 題）、W-L21302-C、分類與特徵、W-L23304-A（調參）、CNN、漂移監控、NLP 表示。

**沿用頁補強**（advisor D08）：
1. 第一段 12 頁：data-leakage、sklearn-pipeline、train-val-test-split、mean-squared-error、mean-absolute-error、mini-batch-gradient-descent、learning-curve、learning-rate-schedule、early-stopping、overfitting、experiment-tracking、model-comparison。
2. 第二段 9 頁：accuracy、confusion-matrix、precision、recall、f1-score、roc-auc、class-imbalance、k-fold-cross-validation、nested-cross-validation。
3. 第三段 4 頁，隨相關單元：intersection-over-union、residual-analysis、time-series-split、root-mean-squared-error。

每頁同一時間只有一個修改者。補強後重審受影響的 `guide-coverage.csv` 列。

## 6. 平行與擁有權

- 所有 agent（含 advisor、盲解、工具）合計 Codex 不超過 10 個。起跑配置：4 寫作、3 審查、2 考題或圖、1 機動。
- 待審量達一天產能時，暫停新增寫作組，先清審查與整合。
- repo 已建（`polluxyz/ipas-study`）。依 CLAUDE.md 第 13 節：**一個寫作組 = 一個 worktree = 一個分支 = 一個 PR**。版本邊界由 git 管，不再靠同資料夾的口頭擁有權。

| 檔案 | 誰能寫 |
|---|---|
| `content/concepts/<id>.md` | 該頁所屬寫作組的 writer。跨科共用頁只有一位 writer |
| `content/examples/<code>-*.json`、圖資 | 該寫作組，檔名含代碼與 ID |
| `guide-topics.csv`、`guide-coverage.csv`、`concept-index.csv`、`glossary.csv` | 只有協調者。worker 交片段到 `tmp/rollout/<組>/`，協調者用腳本合併 |
| `content/questions/`、`content/codes/`、`content/cheatsheets/` | 依實際檔案清單指定，不以整個目錄派工 |
| `demo/` 程式 | 只有網站 worker，一次一個 |
| 建置、preview | 只有協調者。正式閱讀版只含驗收完成的頁面與其相依 |

## 7. 檢查點（已核可）

- 第一個 24 小時：量一組計算／程式頁、一組非計算頁的寫、審、修、整合耗時。之後每天回報：驗收完成頁、目標、題目、單元、待審量、估計剩餘工期區間、兩科缺口。
- 11/03 前：回報完工區間。
- 11/06、11/09：依實際剩餘量檢查範圍。
- 11/11 前：主要交付。
- 11/12–13：穩定、複習、修錯。
- 做不完時：先提延後非必要延伸（額外模擬題、進階補充），再列考後單元與影響，由使用者決定。品質門檻不降。

## 8. 已決事項（使用者 2026-11-01）

1. 本計畫與 M1 的 D01–D08：全部照 advisor 建議核可（D01 一次核可全清單、分期承諾；D05 nonlinear-embedding 合一頁，但保留多設定實測與樣本外使用；D06 深度照原案、排程分期；D08 先盤點 25 頁）。
2. 審查方式：混合審查。主審用 Claude Opus 5.5 或 Gemini 4 Argon（不用 Sonnet）；公式核算與程式實測由非作者 Codex 負責。已統一寫進 `docs/orca-multi-agent.md` 第 1、4 節與 `docs/specs/textbook.md` 4.0 節。
3. Python 套件 8 項分兩批，已全部裝入 `tools/python/`（PR #3、#4）：xgboost、imbalanced-learn、shap、statsmodels、tensorflow（Windows 版即 CPU）、lightgbm、umap-learn、lime。
4. CI：精簡版 GitHub Actions 已加（PR #2）：demo 測試、檢查器、照抄檢查、建置。
5. `regulation`、`tool` 已在 concept-relations 2.2 節的 8 種內，使用不算新增種類。
6. 仍待定：指引章末練習題 70 題、模擬題、正式 `site/` 是否納入本次範圍。

## 9. 風險與對策

| 風險 | 對策 |
|---|---|
| Codex 額度用完 | 派工前 `orca account list`；多帳號輪替；先做高優先代碼 |
| 跨組概念重複 | 合併腳本列跨組同 ID、owner 衝突、名稱與別名撞名，協調者定唯一 owner |
| 寫多讀少（待審堆積） | 第 6 節待審上限 |
| 科目 1 治理類頁面沒有 L23303 的範例 | 首波選一組治理或導入頁試做，看截圖與學習流程 |
| Python 環境缺套件 | 設計階段先彙整實測需求，送相依核可；不拿 PyTorch 結果冒充 Keras |
| 協調者 context 爆掉 | 每波結束更新 handoff、換 session；驗收看報告與檢查器 |
| 派工提示詞沒送出 | `scripts/orca/dispatch.sh` 自動補 Enter 並確認 `Working` |
| 考前來不及讀 | 滾動交付；速查只連向已審教材，不當教材完成 |

## 10. 實作紀錄

- 2026-11-01 下午：第 0 階段派 9 個設計 worker（D1–D9，spec `tmp/rollout/specs/`，handle 記在 `tmp/rollout/handles.txt`），另派 advisor（ctx_0f4bdc079b21，xhigh）審本計畫。派工腳本 `scripts/orca/dispatch.sh`。
- 同日：依 advisor 指出的錯誤，DS-common 加 v1.1 更正（★ 不決定 origin；report 要有 INV 列逐列對照），已通知 9 組。
- 同日：建 GitHub private repo `polluxyz/ipas-study`。
- 同日：D1、D2、D3、D4、D7、D9 驗收通過（`tmp/rollout/check-design.mjs`），筆記在 `tmp/rollout/merge-notes.md`。合併草稿腳本 `tmp/rollout/merge-design.mjs`。
- 同日：M1 概念去重與 M2 考題主碼驗收通過（`tmp/rollout/coord/verify-m1.mjs` 錯誤 0）。advisor 審 M1 的 8 項決策與首批排序（ctx_d8ccb9089eee）。使用者核可全部建議。
- 同日：派 M3（整併修訂，ctx_57d928a21a60）與 M4（25 頁既有頁盤點，唯讀，ctx_e2fe0c44b8af）。
- 同日：PR #2 CI、PR #3／#4 Python 套件合併。
- 同日：PR #6 匯入 454 個新概念與 879 個指引主題（in_scope 876）；PR #7 派工腳本支援 worktree（`WT=`／`WTPATH=`／`AGENT=`）與 `scripts/orca/wt-rm.sh`。
- 同日：寫作階段規格 `tmp/rollout/specs/W-common-v2.md`（writer）、`RV-common-v2.md`（主審，兩輪）、`CK-common-v2.md`（Codex 核算）、`FX-common-v2.md`（修正）；每組任務檔由 `tmp/rollout/coord/make-group-specs.mjs` 產生。
  - 每組流程：writer → 主審（Opus／Gemini）與核算（非作者 Codex）平行 → 修正 → 主審第二輪寫涵蓋列 → 協調者併涵蓋列、跑 CI、開 PR。
  - Python 在 worktree 用共用環境：`UV_PROJECT_ENVIRONMENT=D:/AI_test/tools/python/.venv UV_NO_SYNC=1`（實測可用）。
  - 寫作組 85 組。無前置組的只有 7 組，已全部派出（xhigh，`--search`）：W-L23102-A、W-L23101-A、W-L21302-A、W-L21101-A、W-L21201-A、W-L21102-A、W-L21201-B。
  - W-L21201-B 提問財務圖格式。決定：不在圖表 schema 的數據圖，用腳本從例子 JSON 產生 SVG，腳本留在組資料夾。已補進 W-common-v2。

- 2026-11-02：公開同名遷移完成後，協調者generation 7在D:/ipas-study接管；關閉最後舊終端並移除舊Orca setup，離線備份保留。新庫PR #3–#15中12個教材PR通過協調者檢查、230測試、build與非空成功CI後合併，85/85組在main（6e12639）。保留5群公式pending的直接來源門檻；171題原題草稿全交齊，續跑隔離盲解／解析／非作者複審及25頁M4補強。20份路線與20份速查仍待完成，不將85組等同全站驗收。

- 2026-11-03 00:45–00:46 台北時間查證：main `da5af31cb452c13d60c2a93ed6efbdc02309dda8` 有 485 概念、200 考古題及 1 既有模擬題，15／21 路線及速查；涵蓋 920／920 目標，976 有效列為 947 complete、29 partial。上述 11/02 草稿與待完成數均為歷史快照；合併持續進行，實際 head、數量與 CI 以最新收據為準。M4-A–E、D01–D04、C7、CNN、C10 均已合併；C10 刪 33 增 3 條前置關係，32 條冗餘降為 0，pending 來源與 partial 不升級。
- PR #42 例子參數切換澄清及 PR #58 題目 Markdown renderer 已合併。協調者真 Q49 測得五段程式、三表、選項公式、鍵盤選答、答後與 Storage；D04 selector 修補 PR #62 同時點仍 open，head 的 CI 已成功，離線 522 項不代替最終真 UI。148 頁 owner-first metadata 修正的 360 個責任列已採三片非作者簽章沿用鏈，保留原 reviewer 與 note，仍待協調者 QA、PR 和合併。
- PR #41 記錄已核可執行選擇：中等任務可用 Terra／xhigh，root 與深度審查用 Sol／xhigh；本輪 Claude 額度用完後由不同 session 的非作者 Codex 審查，如實標示同 provider。已核可全站工作持續，不因 context 壓縮重綁 Run；只有真正換協調者 session 才用 `run-use`。
- C12 固定八頁條件例外及分析 CSV 新表頭／映射均僅為待使用者決定的提案，現有 C12 原強條件仍缺 8 頁、核可例外 0；不改寫成已核可。後續仍須完成 21 碼路線及速查、固定 main 的 R0–R10 和人工六格、更新並核對常駐 preview；正式 `site/`、章末 70 題、額外模擬題、外部部署不納入本輪。上方舊環境路徑僅為歷史紀錄，目前 Python 共用環境為 `D:/ipas-study/tools/python/.venv`。

- 2026-11-03：後續固定main 5dd99a87b59450d91b165c789ee6dd6b962ea010 已整合21／21路線及速查（PR #59–#66依各自實際head與非空全綠CI合併）；題目renderer #58及D04相容工具 #62已整合。owner-first #67完成148頁metadata-only及360列獨立沿用鏈，273測試/976有效列/947complete與29partial保全、全485頁owner第一碼不符0。figures同建置觀測及最後R0–R10/人工收件仍在執行，C12與CSV格式仍待使用者決定。

- 2026-11-03 驗收中快照：PR #69–#78 已合，受測產品 main `85769e8b0e718aa12baca800a8be44b116837bc4`；#69 同步題圖，#70 將 figures 核對綁定凍結 build，#71 澄清前置導覽，#72–#78 修補瀏覽器回應、導覽屏障、驗收工具、公式搜尋見證及速查列印與補充標記。候選 D 的正式根目錄結果為 359 測試、976 有效列（947 complete／29 partial）、照抄 0、760 頁含型別檢查；85／85 組、485 概念、200 考古題及 1 既有模擬題、920／920 目標、21 路線及 21 速查均已整合。148 頁 owner metadata 簽章是沿用鏈，不是重新語意審查。
- 候選 D 的 `source.json`、`receipt.json` 與 `figures-command.json`、`supplement-command.json` 可核對，後兩者退出碼 0；`smoke-command.json` 退出碼 1，因斷言 `data-leakage` 第一而 UI 實為第二，原成功條件 9 允許前三。`FX-search-ui-contract` 正在另一工作樹修補，未預寫已完成。S1 召回率見證不代表一般「精確率」搜尋漏失已修復；完整 map／sheets／master 與人工簽核仍待最終版本。預覽已更新 D 真 build，23 個入口 HTTP 200 且 bytes 一致，常駐終端勿關。
- C12 固定八頁例外（原缺口 8、核可例外 0）、CSV 欄位與 export 契約、自然中文精確率分詞漏失的修復或接受限制，三項均待使用者決定；提案依序見 `tmp/advisor/c12-approval-proposal.md`、`export-approval-proposal.md`、`figure-search-approval-proposal.md`。不變更公式 pending 的直接來源門檻。上述為驗收中快照，接手查 `tmp/scratch/continuation-20261103-current.md`、`tmp/scratch/coordinator-current-state.json` 及實際 Git／Orca／JSON 收據；保持產品來源凍結，已核可工作持續。

- 2026-11-03 後續驗收快照：PR #80–#84 已合，文件PR前產品 main 49b9582e002027b084e2ed4af2cfeb2fb93c90cc；預覽仍為歷史 E（3d47c48e5b7c6c1f67ce4c271fd067a1a8afb69d），五個正式階段 command 均退出 0，但人工發現問題、master 未跑，E 非全綠。c04 非作者複審高 0／中 1／低 1、不接受；d5e 新非作者離線複審高 0／中 0／低 0，Root 已獨立373測試／976有效／照抄0／760頁，PR #84非空成功CI後按固定head合；F尚未固定、正式瀏覽器驗收仍以新同版收據為準。C12 固定八頁例外（原缺口 8、已核可 0）、CSV 契約、一般「精確率」分詞三項仍待使用者決定；公式來源 pending 與 partial 不變，使用者試讀／試操作尚未執行。正式 R0–R10 與人工圖須另綁固定新版本驗收，歷史證據不重綁；正式 site、章末 70 題、新模擬題及部署仍不納入。

- 2026-11-03 恢復與收尾：PR #88 合併固定327控件修正，產品commit f4b30c79ae39b9634ac695e2b5f6977142cffd0b。692非作者高0／中1／低0後改限.study-content；327新非作者高0／中0／低0。作者、非作者、Root各380測試／760頁；Root976有效列、照抄0、1734來源前後同59a040d3。真HTTP served核對、正式smoke、4個ROC及6個dev場景通過，8張新控件圖由Root親讀；新證據在tmp/rollout/filter-control-main-20261103。只簽控件，不代簽整站或既有示範表頭。

- 2026-11-03 繼續全站驗收：使用者要求先與Claude Code討論3項決策。兩輪唯讀討論結論保存在本機tmp/acceptance-20261103/claude-decisions/。固定8頁的有目的正文／路線入口例外、分析CSV的8／5欄格式仍待使用者核可，不把繼續工作當作核可。成功條件7的強條件與C12結構孤立警告分開解釋，不擴大固定8頁例外。
- 同輪確認搜尋修復可在原授權內完成：保留Pagefind、相依、ID、內容與索引格式，原10查詢×6格、指定頁前三、摘要及鍵盤門檻維持。以既有概念標題／別名的完整名稱入口補足斷詞漏失；不以全面逐字加空格取代原查詢。新發現AUC原結果有空摘要，只能用同站已知概念的既有summary補足，原非空摘要後到即移除補助，不改原URL、順序及計數。一般全文的不相關英字結果另列限制，不宣稱全面中文全文搜尋已修復。
- 搜尋作者候選9b82891通過408測試與隔離候選60＋24查詢。協調者接續共用驗收讀取器：先核對原完成訊息與前三列載入，再按實際DOM順序收名稱入口及全文結果的真正前三，另存原結果；可見重複入口仍占一筆，不以兩區各3或去重方式放寬門檻。拒絕舊詞、隱藏入口、搜尋失敗、未完成原列與空白／公式污染摘要。補充4詞為精確率、準確率、正確率、召回率，另列24次，不替換原60次。660個標題／別名只作診斷，不列新增必過分母。正式建置、非作者審查與整合驗收仍以最後同版證據為準。
- 同輪PR #90表頭修正與PR #91展示側欄修正均經獨立非作者審查（各高0／中0／低0，同provider不同session）、協調者完整檢查／測試／760頁建置及非空成功CI後合併。來源各1734檔前後相同；表頭382測試，側欄380測試，976有效列與照抄0。2份作者證據共379檔、19,851,299 bytes及Git bundle已逐檔驗證後保存本機tmp/acceptance-20261103/archive/，已收妥終端機、工作目錄及分支。未以這些局部修正簽全站或改寫I歷史結果。正式試讀／10題測驗與備份恢復仍須使用者本人，agent不代簽。
- 搜尋固定候選cba6380雖通過415測試與760頁建置，非作者真DOM審查仍以高0／中3／低0退回：R9鍵盤選到舊結果首筆、CSS隱藏名稱可假命中、解除綁定後排隊更新會復活入口。原報告及原始重現保存於tmp/acceptance-20261103/search-review/，不改寫通過。協調者修前2項的共用契約：開啟實際可見性選項、在收件後標記真正首筆，再走原生Tab／Shift+Tab／Enter，加入舊查詢／重複標記／目標錯配及CSS隱藏反例；第3項另派原範圍生命週期修正。修後須重綁新版本完整QA與非作者複驗，不能沿用本次被退回版本的通過宣稱。
- 使用者要求用完分支收掉。先保存14,022檔及bundle，再移除87舊分支／84舊worktree；本輪作者與複審另存440檔後收尾。保存映射與收據在tmp/branch-cleanup/20261103，不提交公開庫。舊692 Root日誌因共用runner被327覆寫，歷史摘要與兩份非作者raw保留；327 Root日誌已另存唯一目錄。3項待決已送使用者，尚未核可。
