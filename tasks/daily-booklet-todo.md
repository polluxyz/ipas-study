# 每日題本：任務清單

規格：`docs/specs/daily-booklet.md`。每個 worker 只做 1 列，範圍不重疊。

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| D0 文件 | `docs/specs/daily-booklet.md`、`docs/specs/daily-exam-mode.md`、`docs/specs/question-bank-expansion.md`、`tasks/daily-booklet-*`、`docs/handoff.md` | 使用者核可；CI 全綠並合併 | 完成（#188） |
| R0 規格審查 | `tmp/advisor/daily-booklet-spec-review.md` | 每項意見附 `檔案:行號`；協調者處理完高中度問題 | 完成（3 輪；第 3 輪高 0、中 1，已修進規格） |
| M1 版面 mockup | 分支 `polluxyz/daily-booklet-mockup` 的 `demo/src/pages/dev/`、`demo/src/styles/`；截圖放 `tmp/demo-shots/daily-booklet-mockup/` | 涵蓋規格第 8 節 6 個畫面；1440、390、320 寬度；亮暗色；不接真資料；不合併 | 完成（`f671540`，只在本機分支，協調者已看截圖） |
| U1 使用者看 mockup | 使用者 | 使用者回覆核可或修改意見 | 完成（2026-11-07 回覆「核可」） |
| I1 題本儲存 | `demo/src/lib/attempts.ts`、`demo/src/lib/booklet-store.test.ts` | 規格第 6.2、6.4 節：新鍵讀寫、驗證器、衝突檢查、重新讀後合併寫入、`retired`、交卷寫入與重試、清除；遷移要用的讀寫介面 | 完成（`5125a9e`） |
| I1b 21 本實測 | `demo/scripts/booklet-store-bench.mjs` | 21 本的資料量與 Chromium 連續保存 50 次的 p95，對照第 10 節門檻 | 未開始 |
| I2 遷移 | `demo/src/lib/booklet-migration.ts`、`demo/src/lib/booklet-migration.test.ts` | 規格第 6.3 節每一列與第 10 節遷移來源、遷移交錯都有測試；4 種失敗下舊鍵除草稿 `seq` 外不變；舊 `Attempt` 逐筆不變 | 未開始 |
| I3a 同題群組 | `content/question-duplicates.yaml`、`demo/src/lib/question-duplicates.ts`、`demo/src/lib/question-duplicates-load.ts`、`demo/src/lib/question-duplicates.test.ts` | 規格第 5.3 節：4 組群組；未列入群組或 `distinct` 的配對會讓測試失敗 | 完成（`4bc57e3`） |
| I3b 不重複抽題 | `demo/src/lib/daily.ts`、`demo/src/lib/daily.test.ts` | 規格第 5.1、5.2 節：4 項排除各有失敗與通過案例；實際題數等於 `min(50, F)`；代碼權重用完整題庫；官方題仍排除 | 完成（`9210497`） |
| I4 題本純邏輯 | `demo/src/lib/daily-exam.ts`、`demo/src/lib/daily-exam.test.ts` | 建立題本、固定 `attemptMode` 與 `assignedQids`、失效題略過、下一本與結束判斷、第 4.4 節進度數字、第 4.5 節舊紀錄彙整；第 5.4 節程式題提示 | 未開始 |
| I5 每日頁 | `demo/src/pages/daily.astro`、`demo/src/lib/daily-client.ts`、每日頁樣式 | 規格第 4.1–4.5、7 節；版面符合核可的 mockup；開頁不抽題；開頁完成兩科 `submitting`；回看只讀指定題本 | 未開始 |
| I6 文字 | `demo/src/lib/sidebar.ts`、`demo/src/lib/sidebar.test.ts`、`demo/src/pages/official/index.astro`、`demo/src/pages/quiz.astro` | 規格第 4.6 節；只改顯示文字，連結不變 | 未開始 |
| I7 更新既有瀏覽器測試 | `demo/scripts/daily-exam-smoke.mjs`、`demo/src/lib/daily-smoke.mjs`、`demo/src/lib/daily-cache.test.ts` | 原案例逐條對照後改到新鍵與新流程，不刪案例；全部通過 | 未開始 |
| I8 新瀏覽器測試 | `demo/scripts/daily-booklet-smoke.mjs` | 規格第 10 節瀏覽器案例全部通過；截圖 3 種寬度與亮暗色放 `tmp/demo-shots/daily-booklet/` | 未開始 |
| R1 非作者審查 | `tmp/advisor/daily-booklet-review.md` | 高中度問題清零 | 未開始 |
| V1 協調者驗收 | 主工作區 | 規格第 12 節逐條有證據；親看截圖 | 未開始 |
| P1 上線 | PR、4321、`docs/handoff.md` | CI 全綠；4321 重建；隔離瀏覽器走完一輪 | 未開始 |

I1、I3a、I3b 可平行。I1b、I2、I4 要等 I1。I5 要等 I2、I3a、I3b、I4。I6、I7、I8 要等 I5，可平行。

## 驗收命令

```bash
pnpm --dir demo test
node demo/scripts/check-textbook/cli.mjs --summary
node scripts/tools/check-copy.cjs content/concepts content/questions content/cheatsheets
pnpm --dir demo run build --force
node demo/scripts/daily-exam-smoke.mjs
node demo/scripts/daily-booklet-smoke.mjs
```
