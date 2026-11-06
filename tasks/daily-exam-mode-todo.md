# 每日題組交卷模式：任務清單

規格：`docs/specs/daily-exam-mode.md`。

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| D0 文件 | `docs/specs/daily-exam-mode.md`、`docs/specs/question-bank-expansion.md`、`tasks/daily-exam-mode-*`、`docs/handoff.md` | CI 全綠並合併 | 完成（PR #182） |
| M1 版面 mockup | 分支 `feature/daily-exam-mockup` 的 `demo/src/pages/dev/`、`demo/src/styles/`；截圖放 `tmp/demo-shots/daily-mockup/` | 真題目呈現交卷前、確認視窗、交卷後；1440、390、320 寬度；亮暗色；不接真資料；不合併 | 完成（第 3 輪 `7744ac1`，不合併） |
| U1 使用者看 mockup | 使用者 | 使用者回覆核可或修改意見 | 完成（2026-11-06 核可） |
| I1 資料層 | `demo/src/lib/attempts.ts`、`demo/src/lib/daily.ts` 或新純邏輯檔與測試 | 規格第 4、3.4 節；第 8 節單元與故障測試 | 完成 |
| I2 題卡 | `demo/src/components/QuestionCard.astro`、題卡共用顯示函式、`question-set-client.ts` 與測試 | `reveal` 參數預設 `instant`；Enter 不提交；官方題行為不變 | 完成 |
| I3 每日頁 | `demo/src/pages/daily.astro`、`demo/src/lib/daily-client.ts`、樣式、備份與清除的說明文字 | 規格第 3、5、6 節 | 完成 |
| I4 瀏覽器測試 | `demo/scripts/daily-exam-smoke.mjs` | 第 8 節瀏覽器、多頁、回歸與版面案例；第 6.5 節按鈕位置；保留結果與截圖 | 完成 |
| R1 非作者審查 | `tmp/advisor/daily-exam-review.md` | 高中度問題清零 | 第 3 輪高 0、中 0；低度 3 項已修，第 4 輪複核見實作紀錄 |
| V1 協調者驗收 | 主工作區 | 規格第 10 節逐條有證據；親看截圖 | 待 R1 |
| P1 上線 | PR、4321 | CI 全綠；4321 重建；以真實資料走完一次交卷 | 待 V1 |

I1–I4 由同一個 worker 在同一個工作樹做，一個 PR 合併。

## 驗收命令

```bash
pnpm --dir demo test
node demo/scripts/check-textbook/cli.mjs --summary
node scripts/tools/check-copy.cjs content/concepts content/questions content/cheatsheets
pnpm --dir demo run build --force
node demo/scripts/daily-exam-smoke.mjs
```
