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
