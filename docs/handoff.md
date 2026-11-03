# 全站教材交接：已恢復篩選修正與分支收尾

**2026-11-03 使用者已明確指示「請繼續，並且用完的分支請記得幫我收掉」。已解除暫停，接續未完成的篩選控制列複審與修正；已完成分支先核對合併證據、保存工作樹內的審查資料，再清理。** 待核可事項仍維持原邊界，不自動開下一個協調者 session。

先讀本檔、`tmp/scratch/coordinator-current-state.json`、`tmp/scratch/continuation-20261103-current.md`，以實際 Git／Orca 收據為準。暫停快照及報告副本在 `tmp/handoff/20261103-paused/`。工作樹與原證據均保留，不刪檔。

## 本次恢復進度（優先於下方暫停時快照）

- 使用者要求用完的分支收掉。已逐一核對 PR、來源與未追蹤題圖，移除 **87 個舊本機分支及 84 個舊 worktree**；目前只保留 main、本文件分支 `docs/resume-and-cleanup-20261103`、作者與複審分支。遠端只剩 main。刪除前保存 **14,022 檔／815,088,111 bytes** 與可還原分支的 Git bundle，逐檔 SHA 與 bundle verify 通過；完整路徑映射與收據在 `tmp/branch-cleanup/20261103/`，不提交公開庫。舊工作樹原路徑已失效，需按 archive-manifest.json 查證據新位置。
- 692 非作者複審已完成：高0／中1／低0，確認全域深色 CSS 讓 `dev/supplement` 深底深字（1.297／2.755）；不是可合併版本。作者已修到 **32710f47f0a06c556fff143f937643c6c9834805**，只將淡底覆寫限於 `.study-content`，保留 helper 的九類強門檻。作者與協調者分別完成380 tests／976有效列／照抄0／760頁；Root 1734來源前後同 `59a040d35953e2d862b63cf03e5a11bc608fe91edbf09c7498088cfc6d6091c5`。新非作者複審 `ctx_789624deb126` 仍在進行，未push／無PR／未上預覽。
- 作者、692複審均已release／關終端／ack。最新非作者工作樹仍為 `qa-filter-control-review`，新輸出為 `tmp/rollout/filter-control-scoped-final-review/`；舊692報告保留在 `filter-control-reading-review/resumed-20261103/`。這些均為獨立Codex session同provider，不冒稱跨provider。
- `dev/supplement-render` 深色示範表頭對比1.203732為既有問題；對照移除新增規則後不變。另案保留，不將控件通過擴稱整個示範頁全綠。
- 三項既有待決已送使用者：C12固定八頁條件例外、CSV最小匯出契約、一般「精確率」分詞漏失的修復或接受限制。尚未收到回答，維持未核可，不依時間推定同意。

## 身份、分支與預覽

- 根目錄 `D:/ipas-study`；Orca repo `555621aa-2814-4352-83be-7ccb05ac7de4`；公開庫僅 `polluxyz/ipas-study`，node `R_kgDOVfp2dg`。GitHub 與本機遷移、舊 setup／舊協調者關閉均已完成，不再重做；舊檔案及私人離線備份不可刪除或提交。
- Run `run_0668a2365727`，本協調者 `term_6ae72750-d3f9-4a36-aba6-625e8ac3b453`，consumer generation **8**。context 壓縮不 run-use；真正新 session 才重新綁定。使用者本次已明確恢復；暫停前證據維持歷史版本。
- 產品 main `edb46afcac60737439e227e72b9a6bf36c4411c3`，最後合併 PR **#87**。根目錄文件分支 `docs/resume-and-cleanup-20261103` 保存此次恢復進度；後續依實際 PR 收據更新。禁止直接 push main。
- 常駐預覽 `http://127.0.0.1:4321/`，終端 `term_05c14a9a-1fb2-4990-9b03-4db3dcc64a4f`，**勿關**。暫停時 HTTP 200，提供候選 **I** 的 dist；不是未合併的 692b2c2 修正。交接文件寫入後，I 是當時固定版本的歷史收據，不得重綁現在 dirty source。

## 已整合成果

85／85 寫作組、485 概念、200 考古題及 1 既有模擬題、21 路線與 21 速查已整合。920／920 目標有涵蓋；976 有效映射為 947 complete、29 partial。148 頁 owner-first 與 360 責任列採用鏈主要是 metadata 修整，不稱重新語意主審。公式 pending、直接來源門檻及 partial 不擅自升級。

側欄 PR **#86** 已上預覽且使用者看過桌面／行動實圖：當前學習路線在前、兩科分組在後，21 個代碼直達路線，練習從路線進入。PR **#87** 同步驗收為真點路線頁的練習連結，保留原題目與作答統計檢查。兩 PR 均經固定 head、非空成功 CI、match-head squash 合併。

重複 K-fold 的兩個例子已明寫「本例 R=2、K=5，共10次；指引另例 R=5、K=10，共50次」；簡短點明切換例子的規則已於 PR #68 寫入 CLAUDE.md 第11節。模型選擇已於 PR #41 記入 docs/orca-multi-agent.md：中等難度且清楚的工作可用 Terra xhigh；協調者仍 Sol xhigh。Claude／Gemini 本輪額度停用，不同 Codex session 如實註明同 provider。

## 候選 I：自動階段通過，但人工中項阻止 master

目錄 `tmp/rollout/final-browser-20261103-i/`，固定 edb46af；receipt 檔 SHA `355ae8dcb33d41f2c4940faccbad9ce27f2c9f9a4671613d14152bde7f0cc45a`，canonical digest `214c69641e67349f7e00aeb56e22a607a54ece1958937356e22406c818878542`。

- Root 完整 **380／380 tests**、976 映射、照抄 0、760 頁，1734 來源前後同 digest `84b06e870597001539eec8aea829011088e400d7443122bea71b01b19db640c8`；served **24／24** 真 HTTP bytes 相同。H 曾有兩個本機 timeout；I 只用 Vitest `maxWorkers=2` 執行旗標跑同一完整 suite，未改 timeout／測試／斷言／CI。
- smoke、figures、map、sheets、supplement 五個 command 都退出 **0**；sheets 為 21／21、自動 147 張圖，補充 probe 保留原148頁及Q49等範圍。不要把 command 0 當人工全站通過。
- I 的 30 張 smoke／figures 人工為 24 新讀＋6 張 F 全 PNG 同 bytes 具名採用，**高0／中1／低1**。M1：深色「只看指引內容」標籤 1.18952:1，說明／狀態 1.86301:1；Root 另以真 HTTP 四格量測並親讀原圖確認，舊正文對比採樣漏掉 #concept-body 外的控件。L1 僅 S1 展示頁側欄仍舊配置，未納入這次修正。
- 已寫 `hold-before-rollout.json`；master **未啟動**。父程序 **81884 已退出1並收妥**，是人工 M1 的刻意停止，不是五個自動 stage 失敗。不得重跑相同輸出或改 raw 全綠。

人工與附加證據：`smoke-figures-root-disposition.json`、`filter-control-probe/report.json`／`root-manual.json`、`manual-map-root.json`、`c12-root-raw-check.json`／`c12-root-manual.json`。Root 已親讀 C12 16 張段落原圖，核14來源／14同版HTML、8真點擊、24模式、52 sealed contexts；原強缺口 **8／核可0／剩8** 不變。人臉入口位於「進階」；只看指引會隱藏工具鏈入口及 NDCG／開放權重的指定補充承接。

ROC 右端獨立人工報告在 `tmp/handoff/20261103-paused/i-roc-right-report.md`／JSON：新增可見右端高0中0低0，M1/L1不清零；保留固定導覽遮擋的未驗狀態，以及375px場景寬表兩端間約146px未拍中段。JSON該U2一句有問號亂碼，MD完整，不能篡改原件。21張I列印PNG曾與 PR83非作者簽章逐檔比較 **21／21全bytes相同**；尚未另寫正式沿用鏈，不能稱I147張已全人工通過。

## 未合併修正與被暫停的非作者複審

作者工作樹 `E:/orca/workspaces/ipas-study/fix-filter-control`，分支 `fix/filter-control-reading`，固定 **692b2c202cf7b04855ee9d9efe84e8734cb1b973**。僅3檔：supplement-reading.css、prose-contrast.mjs 及其 test。修配色並新增 filterLabel／filterDescription／filterStatus 真採樣及非空／4.5門檻，原六類保留。作者離線四格正例與負例完成；Root 獨立完整380 tests／976／照抄0／760頁／1734來源前後同 `06077d2a8e852b4698ed7bf91ffc41d873398c82fe676c742ba36b93c8e0d9dd`，exec **86143 已完成退出0並收妥**。作者已release／關所有終端／ack，**未push、無PR、未合併、未上預覽**。

非作者工作樹 `E:/orca/workspaces/ipas-study/qa-filter-control-review`，報告 `tmp/rollout/filter-control-reading-review/report.md`／`review.json`；Root 副本在 `tmp/handoff/20261103-paused/filter-control-review-checkpoint.*`。已驗固定3檔、獨立380 tests／760頁與合成guards，未完成真DOM四格、新原圖、六個瀏覽器負例及其他call sites。首跑是審查腳本未展開details，缺figureHeaders樣本，**不能當產品回退**。

待核實風險：全域 `[data-theme='dark'] .supplement-filter` 強制深字，可能讓 `dev/supplement` 的深底控制列回退；已核實CSS／呼叫點，尚未render或量測。恢復時先驗此點，再決定是否需同scope修正。

使用者暫停後 worker 主動保存 checkpoint，以 **outcome failed（user pause／未完成，非產品拒絕）** 收尾。Task `task_1a4dc0f1c958`／Dispatch `ctx_cbeab46f1b5a` 已 release、全部終端關閉、ack。若恢復且仍驗同692版本，依Orca規則對該failed Task使用明確 `--retry-of` 與worktree；不要假裝原複審已通過。未完成時不送PR。正常合併後才以新目錄凍結新候選，不能把 I 證據改名沿用。

## 地圖：資料已擴充，畫面尚未全站化

使用者問的是目前進度，已坦白回答：關係資料有485概念、**680條正式關係**（561 requires、32 is_a、7 part_of、24 mitigates、56 contrasts），127概念跨兩科；`/map/` 仍 **L23303／30節點／38正式關係／21正文輔助線**，6階段，只具階段／概念／類型篩選，沒有兩科／21單元切換或每頁1–2步局部圖。Root親讀I五張圖及21105點命中掃描零差異，只簽此原型scope。

唯讀第二意見 `tmp/handoff/20261103-paused/map-current-scope.md`／evidence.json：原規格 concept-relations.md §6.1 已核可先做小型全域原型、方向確認後做局部圖；未找到後續方向確認文件，標未知，不能重問已核可功能或捏造新核可。建議先兩科可篩選原型、展示真跨科線與圖外關係入口；現有產生器會略去兩端不在L23303圖內的關係。**尚未派原型實作、未修改圖譜、未建立新spec／plan**；暫停期間不開工。

## 待決與恢復邊界

1. C12 固定八頁條件例外仍是提案，原缺口8、有效核可0；不得造requires或題目補條件。
2. 分析CSV／export契約仍待核可；不手改兩分析CSV或自行改格式。
3. 一般中文「精確率」Pagefind分詞漏失仍待決；「召回率」見證不替代此問題。

正式使用者試讀／測驗驗收未完成；使用者確實已操作並回報側欄、也看過新排版圖片，不能說完全未互動。site/、指引章末70題、新模擬題、外部部署不在本輪範圍。

所有 worker 均已收妥；歷史 retained 計數不等於活躍。現有runtime、來源、報告與工作樹保留；常駐預覽及協調者終端不關。派工只用 Orca，Windows Bash 固定 C:/Program Files/Git/bin/bash.exe；PowerShell ps1 UTF8 BOM，中文JSON指定UTF8。Python 固定 UV_PROJECT_ENVIRONMENT=D:/ipas-study/tools/python/.venv、UV_NO_SYNC=1；PDF runtime tmp/pdf_runtime。私人備份、API與account收據不可提交。
