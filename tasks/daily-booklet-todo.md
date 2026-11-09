# 每日題本：任務清單

規格：`docs/specs/daily-booklet.md`。每個 worker 只做 1 列，範圍不重疊。

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| D0 文件 | `docs/specs/daily-booklet.md`、`docs/specs/daily-exam-mode.md`、`docs/specs/question-bank-expansion.md`、`tasks/daily-booklet-*`、`docs/handoff.md` | 使用者核可；CI 全綠並合併 | 完成（#188） |
| R0 規格審查 | `tmp/advisor/daily-booklet-spec-review.md` | 每項意見附 `檔案:行號`；協調者處理完高中度問題 | 完成（3 輪；第 3 輪高 0、中 1，已修進規格） |
| M1 版面 mockup | 分支 `polluxyz/daily-booklet-mockup` 的 `demo/src/pages/dev/`、`demo/src/styles/`；截圖放 `tmp/demo-shots/daily-booklet-mockup/` | 涵蓋規格第 8 節 6 個畫面；1440、390、320 寬度；亮暗色；不接真資料；不合併 | 完成（`f671540`，只在本機分支，協調者已看截圖） |
| U1 使用者看 mockup | 使用者 | 使用者回覆核可或修改意見 | 完成（2026-11-07 回覆「核可」） |
| I1 題本儲存 | `demo/src/lib/attempts.ts`、`demo/src/lib/booklet-store.test.ts` | 規格第 6.2、6.4 節：新鍵讀寫、驗證器、衝突檢查、重新讀後合併寫入、`retired`、交卷寫入與重試、清除；遷移要用的讀寫介面 | 完成（`5125a9e`） |
| I1b 21 本實測 | `demo/scripts/booklet-store-bench.mjs` | 21 本的資料量與 Chromium 連續保存 50 次的 p95，對照第 10 節門檻 | 完成（p95 0.9 ms，326,501 字元） |
| I2 遷移 | `demo/src/lib/booklet-migration.ts`、`demo/src/lib/booklet-migration.test.ts` | 規格第 6.3 節每一列與第 10 節遷移來源、遷移交錯都有測試；4 種失敗下舊鍵除草稿 `seq` 外不變；舊 `Attempt` 逐筆不變 | 完成（`f0a9abf`） |
| I3a 同題群組 | `content/question-duplicates.yaml`、`demo/src/lib/question-duplicates.ts`、`demo/src/lib/question-duplicates-load.ts`、`demo/src/lib/question-duplicates.test.ts` | 規格第 5.3 節：4 組群組；未列入群組或 `distinct` 的配對會讓測試失敗 | 完成（`4bc57e3`） |
| I3b 不重複抽題 | `demo/src/lib/daily.ts`、`demo/src/lib/daily.test.ts` | 規格第 5.1、5.2 節：4 項排除各有失敗與通過案例；實際題數等於 `min(50, F)`；代碼權重用完整題庫；官方題仍排除 | 完成（`9210497`） |
| I4 題本純邏輯 | `demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts` | 建立題本、固定 `attemptMode` 與 `assignedQids`、失效題略過、下一本與結束判斷、第 4.4 節進度數字、第 4.5 節舊紀錄彙整；第 5.4 節程式題提示 | 完成（`9d71529`） |
| I5 每日頁 | `demo/src/pages/daily.astro`、`demo/src/lib/daily-client.ts`、每日頁樣式 | 規格第 4.1–4.5、7 節；版面符合核可的 mockup；開頁不抽題；開頁完成兩科 `submitting`；回看只讀指定題本 | 完成（`78fd781`） |
| I5-fix 行為修正 | `demo/src/lib/daily-client.ts`、`demo/src/pages/daily.astro`、`demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts` | 交卷後同科還有未交卷題本時先看這本成績；不足 50 題提示寫對原因；開本與結束失敗訊息正確；沒有已交卷題本時不提回看 | 完成（`0a420ec`） |
| I6 文字 | `demo/src/lib/sidebar.ts`、`demo/src/lib/sidebar.test.ts`、`demo/src/pages/official/index.astro`、`demo/src/pages/quiz.astro`、`demo/src/pages/wrong-book.astro` | 規格第 4.6、6.4 節；只改顯示文字，連結不變 | 完成（`d6d7a72`） |
| I5-fix2 作答紀錄損壞時可接續 | `demo/src/lib/daily-client.ts`、`demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts` | 規格第 7 節最後一列；作答紀錄正常時行為不變 | 完成 `f0528dc` |
| I5-fix3 開頁與無改動時不寫入 | `demo/src/lib/daily-client.ts` | 規格第 420 行；`daily-booklet-smoke-multi.mjs` 11/11 通過 | 完成 `daf7224` |
| I7a 更新作答畫面測試 | `demo/scripts/daily-exam-smoke.mjs` | 原案例逐條對照後改到新鍵與新流程，不刪案例；版面量測門檻不放寬；全部通過 | 完成 `fa781df`；衝突案例前提修正 `f7f6136`，最後驗收 122 案全過 |
| I7b 更新舊流程測試 | `demo/src/lib/daily-smoke.mjs`、`demo/src/lib/daily-cache.test.ts` | 原案例逐條對照後改到題本流程，不刪案例；官方題回歸保留；全部通過 | 完成 `e8f9154` |
| I8a 新瀏覽器測試：主流程 | `demo/scripts/daily-booklet-smoke.mjs` | 開本、跨日、舊流程、連開 3 本、用完、交卷中斷、清單與進度全過；截圖 3 種寬度與亮暗色 | 完成 `6dd0028` |
| I8b 新瀏覽器測試：多分頁與回歸 | `demo/scripts/daily-booklet-smoke-multi.mjs` | 2 分頁、真實鎖、清除、備份往返、損壞資料、官方題、一般測驗、單題頁、錯題本全過 | 完成 `57037be`；第 3 案在 I5-fix3 後通過，最後驗收 11/11 |
| R1 非作者審查 | `tmp/advisor/daily-booklet-review.md` | 高中度問題清零 | 完成：高 0 中 2 低 3，全部由 I5-fix4、fix5、fix6 修正並通過第 2 次最後驗收。 |
| I5-fix4 空題本開頁不寫入、提示並存 | `demo/src/lib/daily-client.ts`、`demo/scripts/daily-exam-smoke.mjs` | R1 M1、L1 | 完成：worker `d3d4238`，併入 `b65649c`。修改前新斷言失敗（seq 2→3），修改後通過。單元 1178/1178、exam smoke 125 案 success、booklet 10/10、multi 11/11。 |
| I5-fix5 兩科交卷恢復分開處理 | `demo/src/lib/daily-client.ts`、`demo/scripts/daily-booklet-smoke-multi.mjs` | R1 M2；規格第 248 行 | 完成：worker `73e9df6`，併入 `5bfc9f7`。修改前 multi 13/16（新案 12、14、16 失敗），修改後 16/16。單元 1178/1178、booklet 10/10、exam smoke 71 案 success。觀察：他科交卷恢復失敗時，該科卡片仍寫「作答中」，點進去顯示錯誤與重試，不影響資料。 |
| I5-fix6 清單列文字、匯入後更新題量 | `demo/src/lib/daily-client.ts`、`demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts`、`demo/scripts/daily-booklet-smoke.mjs` | R1 L2、L3 | 完成：worker `cbc1d7b`，併入 `19dcba6`。單元 1180/1180、booklet smoke 12/12、multi 11/11、exam smoke 71 案 success。建議（由 Codex 判斷）：320 暗色「結束這本」按鈕對比偏低，修正前已存在。 |
| V1 協調者驗收 | 主工作區 | 規格第 12 節逐條有證據；親看截圖 | 完成：第 1–11 條有證據（見 plan 實作紀錄），第 12 條待 P1。 |
| P1 上線 | PR、4321、`docs/handoff.md` | CI 全綠；4321 重建；隔離瀏覽器走完一輪 | 完成：PR #190 合併為 `ad359b6`，4321 已更新，隔離瀏覽器走查全過（見 plan）。 |

I1、I3a、I3b 可平行。I1b、I2、I4 要等 I1。I5 要等 I2、I3a、I3b、I4。I5-fix、I6 要等 I5，可平行。I7a、I7b、I8a、I8b 要等 I5-fix 與 I6，因為測試會斷言修正後的文字與側欄名稱；這 4 項可平行，共用 `booklet-verify` 工作樹的建置產物。

## 第 3 版任務（2026-11-09）

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| D1 放棄邏輯 | `demo/src/lib/attempts.ts`、`demo/src/lib/daily-exam.ts`、`demo/src/lib/booklet-store.test.ts`、`demo/src/lib/daily-exam.test.ts` | 規格第 4.7、6.2 節與第 10 節「放棄資格／刪除／回池／題號與遷移／衝突」各案；`pnpm --dir demo test` 全過；`tsc --noEmit` 0 錯 | 完成 |
| D2a 題本清單連結 | `demo/src/lib/daily-client.ts`、`demo/src/pages/daily.astro`、每日頁樣式、`demo/scripts/daily-booklet-smoke.mjs` | 規格第 4.3 節；作答中清單收起、點連結展開與收起；`expectAnswerFocus` 改寫；booklet smoke 全過 | 完成 |
| D2b 放棄畫面 | 同 D2a 的檔案 | 規格第 4.7 節畫面規則、第 7 節 3 列、第 10 節「放棄」瀏覽器案例；截圖 3 種寬度與亮暗色 | 完成 |
| V2 驗收上線 | 主工作區、PR、4321 | 規格第 12 節第 1、2、8、13 條有證據；CI 全綠；4321 重建；親看截圖 | 驗收通過（build、tsc、1223 測試、booklet 19/19、multi 18/18、exam 成功）；PR 與部署進行中 |

## 第 4 版任務（2026-11-09，使用者已核可）

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| E1 網址與目錄資料 | `demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts` | plan 第 4 版契約的 2 個函式；第 10 節「網址判斷」每列 1 例；開目錄不改 store；`pnpm --dir demo test` 全過；`tsc --noEmit` 0 錯 | 完成（`87cc8c1`） |
| E2 目錄畫面 | `demo/src/lib/daily-client.ts`、`demo/src/pages/daily.astro`、每日頁樣式 | 規格第 4.1–4.3 節；契約的 DOM；清單開關與檢討頁開本按鈕移除；建置與測試全過 | 完成（`9b00892`；交卷焦點修正見 E3） |
| E3 瀏覽器測試 | `demo/scripts/daily-booklet-smoke.mjs`、`demo/scripts/daily-booklet-smoke-multi.mjs`、`demo/scripts/daily-exam-smoke.mjs` | 第 10 節第 4 版瀏覽器案例；3 支 smoke 全過；目錄與作答畫面截圖 1440、390、320 寬與亮暗色 | 完成（共用 `daily-nav.mjs` 後拆 3 個平行 worker） |
| V3 驗收上線 | 主工作區、PR、4321 | 規格第 12 節第 2、8 條有證據；CI 全綠；4321 重建；截圖給使用者看 | 驗收中 |

## 驗收命令

```bash
pnpm --dir demo test
node demo/scripts/check-textbook/cli.mjs --summary
node scripts/tools/check-copy.cjs content/concepts content/questions content/cheatsheets
pnpm --dir demo run build --force
node demo/scripts/daily-exam-smoke.mjs
node demo/src/lib/daily-smoke.mjs
node demo/scripts/daily-booklet-smoke.mjs
node demo/scripts/daily-booklet-smoke-multi.mjs
```
