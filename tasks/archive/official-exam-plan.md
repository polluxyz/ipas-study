# 考古題題本格式：實作計畫

規格：`docs/specs/official-exam-mode.md`（v1，已核可）。協調與驗收：Claude。前端設計與實作：Codex（`gpt-6.1-sol` + `high`）。

## 元件與相依

| 元件 | 相依 | 分支 |
|---|---|---|
| 規格、計畫、任務清單、既有規格修改 | 使用者核可 | `docs/official-exam-mode` |
| 整合分支 | 文件 PR 合併 | `feature/official-exam-mode` |
| 輪次儲存、輪次純邏輯、共用樣式 | 整合分支 | 各 worker 自己的分支，併入整合分支 |
| 考古題輪次頁、目錄、指引版面、文字 | 儲存與純邏輯 | 同上 |
| 瀏覽器測試 | 全部畫面 | 同上 |

全部完成才從整合分支開 1 個 PR 到 `main`。半套上線會讓考古題同時有兩種流程。

## 順序

1. 使用者核可規格、plan、任務清單。（2026-11-12 完成）
2. D0：修改既有規格，文件 PR 合併。開整合分支。
3. 平行：O1 輪次儲存、O2 輪次純邏輯、O3 共用樣式。
4. O1、O2、O3 併入後：平行做 O4 考古題輪次頁、O5 目錄、O7 文字。
5. O4 併入後：O6 指引版面（與 O4 共用 `[id].astro`，所以排在後面）。
6. O4–O7 併入後：平行做 T0 更新既有 smoke、T1 主流程 smoke、T2 多分頁與指引 smoke。
7. R1：非作者 Codex 審查整包差異。
8. V1：協調者跑全部檢查與瀏覽器測試，看差異與截圖。截圖給使用者看。
9. P1：PR、CI 全綠、squash 合併、重建 4321、更新 `docs/handoff.md`。

## 契約（O1、O2 先定，O4–O6 照用）

- `attempts.ts` 新增：`OFFICIAL_ROUND_KEY`、`OfficialRoundStore`、`OfficialRound`、`OfficialRoundQuestion`、`readOfficialRounds()`、`openOfficialRound(setId, questions)`、`saveOfficialRound(round)`、`restartOfficialRound(ref)`、`submitOfficialRound(...)`；`clearStudyData` 加移除新鍵。確切簽名由 O1 定，寫進本節實作紀錄後才派 O4。
- `demo/src/lib/official-round.ts`（新）：有效題判斷、`open` 輪次的失效略過、原題號、成績文字、目錄卡片資料、輪次清單列、檢討頁按鈕（「再考一次」或「繼續第 N 輪」）。只放純函式。
- `demo/src/lib/official-round-client.ts`（新）：輪次頁的畫面流程。用 `question-set-client.ts` 的導覽與 `daily-exam.ts` 的題號、計數函式，不 import `daily-client.ts`。

## 風險與對策

| 風險 | 對策 |
|---|---|
| 考前時間緊，上線弄壞每日題本 | 全部完成才合併 `main`；O3 改共用樣式後跑每日 3 支 smoke；合併後才重建 4321 |
| 共用每日的有效題函式，把官方題全判失效 | 規格第 7 節明訂另寫；O2 有爭議題與已驗證題的測試 |
| 舊頁在重新考或清除後復活舊輪 | 保存只替換 `id` 與 `seq` 相符的輪次；重新考成功先停計時；T2 有案例 |
| 既有 smoke 綁定 `/official/` 即時解析 | T0 改用指引練習題，逐條對照，不刪案例 |
| 使用者在上線前後正在做考古題 | 舊即時紀錄不搬不改；新流程從新鍵開始，不需遷移 |
| 2 頁同時寫入互相覆蓋 | 規格已寫明不處理，和每日題本相同 |

## 驗證點

- O1–O7：協調者逐一跑該任務的驗收條件，看差異，範圍外改動退回。
- T0–T2：3 支新舊 smoke 全過，截圖親看。
- V1：規格第 12 節 10 條逐條有證據。
- P1：4321 重建後，隔離瀏覽器走完開輪、交卷、回看、重新考。

## 實作紀錄

- 2026-11-12：advisor 第二意見「修改後照做」，協調者全部採納，已改進規格（爭議題保留、失效規則依狀態、檢討頁按鈕、備份說明、多分頁界線、指引選單細節、驗收補強）。
- 2026-11-12：使用者核可規格、plan、任務清單，A7、A8 確認。
- 2026-11-12：O2 合併（`b9eff1e`）。`official-round.ts` 簽名：`officialRoundMode(id, subject)`、`availableOfficialQuestion(q, catalog, round)`、`reconcileOfficialRound(round, catalog) → { round, skipped, unavailable }`（`open` 回傳去掉失效題的新輪次；其他狀態原樣回傳並列出 `unavailable`）、`canSubmitOfficialRound(round)`、`officialQuestionNumber(id, catalog)`、`officialRoundScore(submission)`、`officialRoundList(setId, rounds) → { action, rows }`、`officialLegacyText(set, attempts)`、`officialRoundCard(set, rounds, attempts)`、`officialRoundReviewAction(setId, rounds)`。輸入用結構型別 `OfficialRoundSource`，可直接接 O1 的 `OfficialRound`。
- 2026-11-12：O1 合併（`126ea93`）。`attempts.ts` 簽名：`OFFICIAL_ROUND_KEY`、`OFFICIAL_ROUND_SETS`、`isOfficialRoundStore(value)`、`readOfficialRounds()`（損壞丟錯不覆寫）、`openOfficialRound(setId, questions, id, createdAt)`（已有未交卷輪次丟 `DailyConflictError`）、`saveOfficialRound(round, expected: OfficialRoundRef)`、`restartOfficialRound(expected, newId, createdAt)`、`submitOfficialRound(round, prepared) → { round, error? }`（`prepared` 是已固定作答 ID 的 `submitting` 輪次）。容量實測：50 輪各 50 題已交卷，輪次 JSON 643,045 字元，加作答鍵合計 1,063,321 字元；連續保存 50 次 312 ms（Node 模擬）。
- 2026-11-12：`scripts/orca/done.sh` 比對 `"ok": true` 時沒考慮 Orca 的緊湊 JSON，動作有做但不印結果；改成允許有無空格。
- 2026-11-12：O3 合併（`1a3213f`）。`daily-exam.css` 改用 `.exam-*` class，每日頁只加 class。驗收：建置 1895 頁、`tsc` 0 錯、單元測試 1388/1388、`daily-exam-smoke` 通過、`daily-booklet-smoke` 23/23、`daily-booklet-smoke-multi` 20/20（第 1 次第 6 案「匯入不改未交卷題本」失敗且無細節，重跑通過，列為不穩定）。
- 2026-11-12：O7 由協調者做（`0c45327`），只改錯題本備份說明；側欄連結文字規格沒要求，不改。O5 不動 `official-client.ts`，舊 `initOfficialIndex` 留給 O6 或 V1 清掉，避免和 O4 改同一檔。
- 2026-11-12：O4 回報 `restartOfficialRound` 照抄舊輪題目，`open` 輪次全部失效時重新考仍是失效題，與規格第 7 節「提供重新考」不符。協調者加可選第 4 參數 `questions`（`f776309`）：傳入時換成這份題目並依原題號排序，仍是同一次寫入；題目不屬於該題組則拒絕。新增 2 個單元測試，store 測試 95/95，`tsc` 0 錯。O4 改為傳入目前有效題；有效題 0 題時不呼叫重新考。
- 2026-11-12：O4 合併（`0f2d997`，整合 `14c7af6`）。協調者在整合分支實測：單元測試 1422/1422、`tsc` 0 錯；看過作答、檢討、重新考確認、輪次清單截圖。worker 回報建置 1895 頁、`daily-booklet-smoke` 23/23、`daily-booklet-smoke-multi` 19/20（唯一失敗是舊 `/official/115-1-S3/` 即時解析斷言，留給 T0）。已知小問題：重新考失敗後交卷鈕要等下一次保存才恢復，不擋合併，列入 R1 參考。
- 2026-11-12：T1 只依賴 O4，提前與 O6 平行派出；T0、T2 依賴 O6（指引練習題版面）再派。`scripts/orca/done.sh` 讀 worker 終端機欄位改成 `terminal`（舊欄位名讀不到，不會關終端機）。
- 2026-11-12：O6、T1 的工作樹開在過舊的本地 `feature/official-exam-mode`（`0c45327`），因為整合 commit 只從驗收工作樹推到 origin。已把本地分支移到 `14c7af6`，worker 以 `--ff-only` 跟上。之後每次推整合分支，同時 `git branch -f feature/official-exam-mode <commit>`。
- 2026-11-12：O6 合併（`6f117a4`，整合 `cd1c1a2`）。純函式 `guideNumbers`、`guideNext`、`guidePosition` 放 `guide-set.ts`；`initQuestionNavigation` 只加選用參數 `previousPosition`；舊 `initOfficialIndex` 刪除。協調者在 O6 工作樹實測：單元測試 1452/1452、`tsc` 0 錯；看過 1440 亮色與 390 暗色截圖，不連續紀錄的選單是 1、2、3、7，停在第 2 題。
- 2026-11-12：T1 合併（`47381e6`，整合 `6c8cf55`）。worker 連跑 2 次各 11/11、版面 24/24；協調者看過檢討頁與 320 寬作答頁截圖，斷言直接比對官方答案與 localStorage 快照。整合後單元測試 1452/1452、`tsc` 0 錯。T0、T2 從 `6c8cf55` 派出。
- 2026-11-12：R1 不等 T0、T2：產品程式 O1–O7 已全部合併，smoke 不改產品程式。R1 從 `6c8cf55` 派出（Codex xhigh，唯讀），審查結果寫 `tmp/advisor/official-exam-review.md`。
- 2026-11-12：T2 回報網站沒有清除學習資料的入口（`clearStudyData` 只在 `attempts.ts:129` 匯出，頁面不呼叫）。核可比照 `daily-booklet-smoke-multi.mjs:63`，由測試服務匯入產品函式呼叫；不補產品入口（規格沒要求）。
- 2026-11-13：T2 合併（`fc41ec4`，整合 `2bc6c42`）。worker 連跑 2 次各 13/13（目錄只讀拆 3 案、2 分頁重新考拆即時通知與延後通知 2 案、指引案例分輪次鍵不存在與既有 2 組）；`tmp/demo-shots/t2/` 的 2 張 failure 截圖早於最終 2 次執行。協調者看過目錄作答中 390 寬、指引不連續紀錄 320 暗色截圖。320 全頁截圖中黏在底部的上一題／下一題列畫在選項上方，是全頁截圖的畫法，V1 用視窗截圖複查。
- 2026-11-13：T0 回報 `daily-smoke.mjs` 在官方段落前就失敗：自 #190 後沒更新，#206 第 4 版每日目錄移除 `#daily-metrics`，是 main 既有問題。授權 T0 在同一檔把非官方段落改用 `daily-nav.mjs` 既有 helpers，不刪案例、不放寬斷言、不改門檻；舊斷言在第 4 版無對應畫面時先問。
- 2026-11-13：R1 審查完成（高 2／中 2／低 1），5 件協調者都採納，派 3 個修正 worker（基底 `2bc6c42`，範圍互不重疊）：F1 `attempts.ts`（R1 寫入前嚴格驗證整份作答鍵，任一筆損壞就丟錯不寫，對齊規格第 7 節「交卷寫入失敗時保留輪次並顯示錯誤」；`saveAttempt`、`importAttempts`、`saveAttemptBatch` 一起改，顯示用讀取維持容錯。R2 題目 ID 限定 `Q01`–`Q50`，不核對目前建置）；F2 `official-round-client.ts`（R3 重新考失敗與保存失敗分開記錄；R5 題號重建後還原焦點）；F3 `QuestionCard.astro`、`question-set-client.ts`（R4 指引用時單一來源，無外層題組的頁面與延後揭露題卡行為不變）。R1、R4 的根因在 main 既有共用程式。
- 2026-11-13：T0 合併（`07591ee`，整合 `273e600`）。看過 diff：官方段落斷言改成新流程，`daily-smoke` 非官方段落只換入口；考古題換算分數的斷言改成指引（指引沒有換算分數）。驗收工作樹重建後重跑 6 支 smoke。

- 2026-11-13：F1 的 R2 嚴格驗證使 `official-index-client.test.ts` 的合成 ID（`Q1`–`Q9`）被拒，4 項失敗。授權 F1 只改該行成兩位數，納入 Ownership。
- 2026-11-13：F2 合併（`0fb8000`，整合 `668cd27`）。`failures = { save, restart }`，交卷只看 `save`；題號重建前記住焦點題號、重建後還原。worker 實測：重新考 QuotaExceededError 後取消可交卷、50 筆作答；15 秒保存後焦點仍在第 2 題按鈕。
- 2026-11-13：F1 合併（`1ff6b80`，整合 `aef7230`）。新增 `readForWrite()`，3 個寫入路徑改用；R2 題號正規式 `0[1-9]|[1-4][0-9]|50` 且長度固定 2。worker 單執行緒 1466／1466、建置 1895 頁。
- 2026-11-13：F3 合併（`77fff18`，整合 `9c8b47f`）。題卡保存前發 `question-time-request`，題組回傳該題已結算的可見用時；沒有題組的頁面沿用題卡計時。worker 實測：確認後 5 秒、存 5000 ms、重整後 5 秒。
- 2026-11-13：V1 驗收（`9c8b47f`，驗收工作樹 `tmp/v1/`）。單元測試 50 檔 1476／1476（單執行緒）；tsc 0；教材對應 920／920；照抄 0 片段；建置 1895 頁；daily-exam-smoke 結束碼 0（74 案例）、daily-smoke 0、每日題本多分頁 20／20、每日題本 23／23、考古題主流程 11／11（版面 24／24）、多分頁與指引 13／13（截圖 54）。規格第 12 節：1–5 對 T1 案例 1–11 與 `official-round.test.ts` 失效題測試；6 對 T1 案例 11；7 對 T2 指引案例；8 對每日 4 支 smoke 與 F3 單題、小測驗實測。
- 2026-11-13：看截圖時發現暗色模式頁首搜尋按鈕是淺色背景。隔離實測：`main` 的建置在 `/official/` 各頁同樣是 `rgb(247, 249, 243)`，只有每日題本有暗色覆寫。屬既有問題，不在本次範圍，另報使用者。
- 2026-11-13：P1 上線。PR #210 CI 全綠（3 分 23 秒），squash 合併為 `ef097f8`。`main` 與驗收 commit `ad6bff1` 的樹相同，所以直接把驗收工作樹的 `demo/dist` 用 robocopy 複製到主工作目錄（結束碼 3），6 個網址回 200。隔離 Playwright context 在 4321 實走：讀目錄不寫入；作答 3 題不揭露、不寫作答；重新整理後停在第 4 題；重新考換新輪次；50 題交卷得 15／50、30 分，寫入 50 筆 `official-round:<id>:S3` 作答；重新整理仍是唯讀檢討；目錄顯示「已交卷 1 輪・最近 30 分」；頁面錯誤 0。截圖 `tmp/demo-shots/official-p1/`。驗收工作樹的截圖與紀錄已複製到 `tmp/demo-shots/official-t1/`、`official-t2/`、`tmp/official-exam/v1/`，14 個工作樹與分支已移除。
