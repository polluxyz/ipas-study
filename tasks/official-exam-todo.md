# 考古題題本格式：任務清單

規格：`docs/specs/official-exam-mode.md`。每個 worker 只做 1 列，範圍不重疊。

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| R0 規格審查 | `tmp/advisor/official-exam-mode.md` | 問題 1–7 逐題回答，事實附 `檔案:行號` | 完成（修改後照做，已全部改進規格） |
| D0 文件 | `docs/specs/official-exam-mode.md`、`docs/specs/daily-exam-mode.md`、`docs/specs/question-bank-expansion.md`、`tasks/official-exam-*` | 使用者核可；規格第 9 節修改完成；CI 全綠並合併 | 使用者已核可；PR 進行中 |
| O1 輪次儲存 | `demo/src/lib/attempts.ts`、`demo/src/lib/official-round-store.test.ts` | 規格第 6.2、6.3 節：新鍵讀寫、驗證規則 1–5、衝突檢查、開新輪、保存、重新考、交卷三階段與重試、清除；第 10 節 store 相關單元測試全過；容量實測數字；`tsc --noEmit` 0 錯 | 待做 |
| O2 輪次純邏輯 | `demo/src/lib/official-round.ts`、`demo/src/lib/official-round.test.ts`、`demo/src/lib/official.ts`、`demo/src/lib/official.test.ts` | 規格第 4.2、4.3、7 節：有效題、依狀態的失效規則、原題號、成績文字、卡片資料、輪次清單、檢討頁按鈕；對應單元測試全過 | 待做 |
| O3 共用樣式 | `demo/src/styles/daily-exam.css`、`demo/src/pages/daily.astro`（只加 class） | `#daily-*` 選擇器改成考古題頁也能用；每日頁 DOM 結構與 id 不變；每日 3 支 smoke 全過；版面量測不放寬 | 待做 |
| O4 考古題輪次頁 | `demo/src/pages/official/[id].astro`、`demo/src/lib/official-round-client.ts`（新）、`demo/src/lib/official-client.ts`、考古題頁樣式 | 規格第 4.1、4.3、4.4、7 節；交卷前不揭露；重新考確認與失敗畫面；建置與單元測試全過 | 待做 |
| O5 目錄 | `demo/src/pages/official/index.astro`、`demo/src/lib/official-index-client.ts`（新） | 規格第 4.2 節；讀目錄不寫入、不觸發恢復；備份說明 | 待做 |
| O6 指引版面 | `demo/src/lib/question-set-client.ts`、`demo/src/pages/official/[id].astro`（指引分支）、`demo/src/lib/official-client.ts`（指引部分） | 規格第 4.5 節；仍即時解析、原 `mode`；選單只開放到第 1 個未答題；越界網址改位置 | 待做 |
| O7 文字 | `demo/src/pages/wrong-book.astro`、`demo/src/lib/sidebar.ts`、`demo/src/lib/sidebar.test.ts` | 規格第 6.3 節備份說明；只改顯示文字，連結不變 | 待做 |
| T0 更新既有 smoke | `demo/scripts/daily-exam-smoke.mjs`、`demo/scripts/daily-booklet-smoke-multi.mjs`、`demo/src/lib/daily-smoke.mjs` | `/official/115-1-S3/` 即時解析案例改用指引練習題，逐條對照不刪案例；3 支全過 | 待做 |
| T1 主流程 smoke | `demo/scripts/official-round-smoke.mjs`（新） | 規格第 10 節瀏覽器案例：開輪、作答、交卷、爭議題、離開再回來、重新考、再考一次、連按開輪、4 份交錯；截圖 3 種寬度與亮暗色 | 待做 |
| T2 多分頁與指引 smoke | `demo/scripts/official-round-smoke-multi.mjs`（新） | 規格第 10 節：2 分頁、清除後舊頁、讀目錄不恢復、指引練習題各案；全過 | 待做 |
| R1 非作者審查 | `tmp/advisor/official-exam-review.md` | 高中度問題清零 | 待做 |
| V1 協調者驗收 | 主工作區 | 規格第 12 節逐條有證據；親看截圖；截圖交使用者 | 待做 |
| P1 上線 | PR、4321、`docs/handoff.md` | CI 全綠；4321 重建；隔離瀏覽器走完開輪、交卷、回看、重新考 | 待做 |

O1、O2、O3 可平行。O4、O5、O7 要等 O1、O2、O3。O6 要等 O4（共用 `[id].astro` 與 `official-client.ts`）。T0、T1、T2 要等 O4–O7，可平行，共用同一個驗收工作樹的建置產物。

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
