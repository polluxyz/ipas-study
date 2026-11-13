# 考古題 v2：任務清單

規格：`docs/specs/official-exam-mode.md` v2。plan：`tasks/official-exam-v2-plan.md`（第 2 節是共用介面）。每個 worker 只做 1 列，範圍不重疊。

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| R0 規格審查 | `tmp/advisor/official-exam-v2.md` | 決定 10–13 與用詞逐題回答，附各方案壞處與漏掉的風險 | 完成：修改後照做，已依意見修訂 |
| D0 文件 | `docs/specs/official-exam-mode.md`、`tasks/official-exam-v2-*` | 使用者核可；CI 全綠並合併 | 使用者已核可 |
| W1 儲存層 | `demo/src/lib/attempts.ts`、`demo/src/lib/official-round-store.test.ts` | plan 第 2.1 節；規格第 6.2 節 v2 驗證與寫入規則；第 10 節 store 的 v2 單元測試全過（含交卷拒絕 `retired`、`latest.seq` 不符拒絕、混合容量量測）；v1 形狀資料照常讀取；錯誤訊息無「輪」字；自己的檔案 `tsc` 無錯（呼叫端的錯由 W4 處理） | 完成：5ace461，tsc 0 錯；容量 50 筆交卷 1,063,321 字元 |
| W2 純邏輯與開輪共用 | `demo/src/lib/official-round.ts`、`demo/src/lib/official-round.test.ts`、`demo/src/lib/official-start.ts`（新）、`demo/src/lib/official-start.test.ts`（新） | plan 第 2.2、2.3 節；目錄卡片 5 種狀態、全部紀錄列、檢討頁按鈕、未交卷摘要；文字無「輪」字；`startOfficialRound` 衝突時回傳既有輪、只在建立時取 ID 與時間；最近交卷取 `number` 最大的 `submitted`；時間到秒與同時間序號；單元測試全過 | 完成：9a68a3d |
| W3 目錄 | `demo/src/lib/official-index-client.ts`、`demo/src/lib/official-index-client.test.ts`、`demo/src/pages/official/index.astro` | 規格第 4.2 節 5 種狀態；「開始作答」「重新開始」按下才寫入、同頁連按只開 1 輪；開輪失敗留在目錄顯示錯誤；開頁不寫入；頁首與備份說明 v2 文字；可見文字無「輪」字 | 完成：1aad793，已整合 |
| W4 作答與全部紀錄頁 | `demo/src/lib/official-round-client.ts`、`demo/src/lib/official-round-client.test.ts`、`demo/src/pages/official/[id].astro`、考古題頁樣式 | 規格第 4.1、4.3、4.4、4.6、7 節；作答中重新開始保留成未交卷紀錄且併入最新答案；未交卷紀錄唯讀、可跳任一題、不計時、不揭露答案（另寫唯讀導覽，不偽裝成 `submitted`）；全部紀錄頁；「本次用時」；開輪改用 `startOfficialRound`；可見文字無「輪」字 | 完成：c39ff78，已整合；全套測試 51 檔 1586 個通過 |
| W6 錯題本文字 | `demo/src/pages/wrong-book.astro` | 備份說明「考古題輪次」改「考古題的紀錄清單與未交卷答案」，其他不動。在 W3、W4 整合時一起做 | 完成（協調者）：cc12299 |
| W5a 主流程 smoke | `demo/scripts/official-round-smoke.mjs` | 規格第 10 節 v2 瀏覽器案例：目錄 5 種狀態、查看上次作答、目錄重新開始、作答中重新開始保留紀錄、未交卷紀錄唯讀不揭露（含 0 題）、v1 三狀態混合資料、舊網址回看唯讀、「輪」字掃描（含錯誤與朗讀文字）；原案例保留目的與數量，「刪掉原輪」的斷言改成「原輪變 `retired`、新輪 `open`」；連跑 2 次全過 | 進行中：worker 已派 |
| W5b 多分頁 smoke | `demo/scripts/official-round-smoke-multi.mjs` | 原 13 案保留目的與數量，改新文字與新斷言；一頁重新開始另一頁改唯讀；同頁連按只建 1 輪；另一頁先開輪後本頁按開始導向既有那輪；不驗 2 頁真正同時按；連跑 2 次全過 | 進行中：worker 已派 |
| R1 非作者審查 | `tmp/advisor/official-exam-v2-review.md` | 高中度問題清零 | 待做 |
| V1 協調者驗收 | 驗收工作樹 | 規格第 12 節逐條有證據（含條件 14：v1 建置讀到 `retired` 保存失敗、store 不變）；截圖交使用者 | 待做 |
| P1 上線 | PR、4321、`docs/handoff.md` | CI 全綠；4321 重建；隔離瀏覽器走完目錄回看、重新開始、未交卷紀錄 | 待做 |

W1、W2 可平行。W3、W4 要等 W1、W2 整合，兩者可平行。全專案 `tsc` 只在 W1–W4、W6 都整合後要求 0 錯。W5a、W5b 要等 W3、W4，可平行。

## 驗收命令

```bash
pnpm --dir demo test
pnpm --dir demo exec tsc --noEmit
node demo/scripts/check-textbook/cli.mjs --summary
node scripts/tools/check-copy.cjs content/concepts content/questions content/cheatsheets
pnpm --dir demo run build --force
node demo/scripts/daily-exam-smoke.mjs
node demo/src/lib/daily-smoke.mjs
node demo/scripts/daily-booklet-smoke.mjs
node demo/scripts/daily-booklet-smoke-multi.mjs
node demo/scripts/official-round-smoke.mjs
node demo/scripts/official-round-smoke-multi.mjs
```

建置與 smoke 一律在獨立工作樹跑，不在主工作目錄跑（4321 直接讀 `demo/dist`）。
