# 學習網站 v1 實作計畫（v2）

2026-10-30。狀態：**待使用者核可**。依據：[site-v1 規格](../docs/specs/site-v1.md)、[概念關係規格](../docs/specs/concept-relations.md)。任務清單：[site-v1-todo.md](site-v1-todo.md)。v2 依 advisor（Codex）審查修正，原文在 `tmp/advisor/site-v1-review.md`。

## 1. 策略

目標是最短完成時間。做法：

1. 先由協調者定好「共用契約」：ID 規則、資料格式、作答紀錄介面、3 份黃金範例、概念總表。所有 worker 照同一份契約做，平行時才不會各寫各的。
2. 地基拆小。檢查器、網站骨架、匯出工具分成 3 個任務（T01a–c），不讓一個大任務擋住全部。
3. 每個任務只擁有一組不重疊的檔案。同一個檔案不會有兩個 worker 同時改。
4. 會改同一批題目檔的工作，改成「輸出到獨立檔案，再由腳本合併」。盲解寫 CSV、圖片寫 manifest，再由腳本寫回 YAML。
5. 分批 PR 用局部檢查 `npm run check`。跨批缺項只算警告，不擋合併。全部完成後才跑 `check:final`。
6. 不必等的就不等。題庫抽取不需要概念總表，所以和地基同時開始。

## 2. 波次與相依

```text
W0 ─ T00 協調者 ─┬─ T01a 檢查器 ───────────────┬─ W2 概念頁 C1–C12 ── W5 模擬題 M1–M6 ── RM ── MF
                 ├─ T01b 網站骨架 ── W4 F1–F5  │
                 ├─ T01c 匯出合併工具 ──────────┼─ B1–B4 盲解 ─┐
                 ├─ T02 PDF 截圖 ── IMG         │              ├─ S1 合併判定 ── R5 爭議
                 └─ T03a–c 概念候選 ── T04 總表 ┴─ X1–X10 解析 ┘
W1 E1–E10 題庫抽取（與 W0 同時開始）── X、B、IMG
W6 R1–R4 審查 ── RF1–RF4 修正 ── R6、FIN ── U1 使用者驗收
```

## 3. 角色與模型

沿用 pollux 的角色表做法。Task spec 只寫角色名。

| 角色 | 啟動方式 | 用在 |
|---|---|---|
| `site` | Codex 兩段式，`gpt-6.1-sol` + `high` | 網站程式、檢查器、需要判斷的資料工作 |
| `extract` | Codex 兩段式，`gpt-6.1-terra` + `xhigh` | 單純的題目抽取、圖片產生 |
| `writer` | 一行，`--agent claude --model claude-sonnet-5-5 --effort high` | 概念頁、題目解析、模擬題、讀 PDF 圖片的程式題轉錄 |
| `reviewer` | Codex 兩段式，`gpt-6.1-sol` + `high` | 盲解、交叉審查 |

分工理由：內容由 Claude 寫、由 Codex 審，兩邊互相獨立。程式題的程式碼在 PDF 圖片裡，Claude 能直接讀 PDF 頁面，所以轉錄給 `writer`。

## 4. 並行上限與額度

| provider | 同時執行上限 | 理由 |
|---|---|---|
| Codex | 10 | 有多個帳號，週用量 0–16% |
| Claude（`writer`） | 6 | 和協調者共用額度，要保留協調者自己的額度 |

- 一個任務完成就補派下一個（滾動補位），不等整波結束。
- 每次派工前跑 `orca account list --json`。
- Claude 的 5 小時 `session` 用量超過 80% 時，暫停派 `writer`，改派 `site`（Codex）。這時內容的作者是 Codex，審查改派 Claude worker，避免自己審自己。作者記在 `author` 欄位。
- Codex 某帳號用完時換帳號重派。
- 2026-10-30 派工前用量：Claude session 4%、weekly 22%；Codex weekly 0–16%。

## 5. 整合

- 一個任務 = 一個 worktree = 一個分支 = 一個 PR。
- 合併順序：T00 → T01a → 其他任務依完成順序合併。T01a 合併前，其他 PR 先不合併，因為還沒有檢查器。
- 每個 PR 合併前，協調者自己跑 `npm run check` 與 `npm run build`。worker 回報「全部通過」不算數。
- 驗收時看完整的 `git diff`。動到 Ownership 以外檔案的 PR 一律退回。
- `package.json` 與鎖檔只由協調者改。worker 回報需要的相依，協調者在 `main` 上加入後，worker 再 rebase。
- CI：GitHub Actions 在每個 PR 跑 `npm ci`、`npm run check`、`npm run build`（Ask first，隨本計畫核可）。CI 先擋掉明顯錯誤，減少協調者重跑。

## 6. 風險與對策

| 風險 | 對策 |
|---|---|
| 115-1 答案欄錯位，抽錯答案 | E5–E7 用 `site` 角色；每題記錄核對頁序；B1–B4 盲解再比對一次 |
| 概念總表品質不好，後面全部受影響 | 總表由協調者合併、去重；C 任務發現缺概念時回報，不自己加 |
| 12 個 writer 寫出來風格不一致 | 3 份黃金範例；R1–R4 審查時檢查格式 |
| 協調者驗收數十個 PR 變成瓶頸 | CI 預檢；檢查器輸出固定格式報告；分批整合 |
| Claude 額度不夠 | 第 4 節的上限與換層規則 |
| 共用設定檔衝突 | T01b 合併後 `site/` 依 todo 的移交表分配；表外檔案由協調者改 |

## 7. 時程估計

未實測。粗估：W0 + W1 約 1–2 小時，W2 + W3 約 2–3 小時，W5 + W6 約 2 小時。協調者驗收與合併會是瓶頸。

## 8. 實作紀錄

（實作時記錄偏離計畫的地方）

- 2026-10-31：使用者先看 demo（`demo/`，L23303）。看完認為學習路線內容太少，同意先把 L23303 做成完整範例單元，再決定是否核可全站計畫。細節見 `docs/handoff.md`。
- 2026-10-31（L23303 單元）：
  - 4 份考卷 200 題先由 Codex 分類代碼並對 PDF 頁面圖核對答案，結果在 `tmp/l23303/classify/`。之後抽全站題庫時可直接用。
  - L23303 範圍定為「主要代碼是 L23303 的題目」共 29 題。次要代碼含 L23303 的題目，等它們的主要代碼單元建立時再抽。
  - 概念總表從 6 個加到 30 個。`overfitting`（L23201）、`class-imbalance`（L23301）、`intersection-over-union`（L21102）的 owner 不是 L23303，先建立是因為 L23303 的題目與關係要用到。
  - 代碼頁新增 `stages` 欄位（分階段與學習目標），已寫進 `docs/specs/site-v1.md` 4.3，隨規格待核可。
  - 本次 Claude worker 數到上限 6 個，所以考古題解析改由 Codex 寫（`author: codex`），之後由 Claude 審查；概念頁由 Claude 寫、Codex 審查。依第 4 節「作者與審查者不同 provider」的原則。
  - 全部考卷頁面已渲染到 `pdf-pages/`（借用 Codex 自帶的 Python 執行 `tmp/pdf_runtime/` 的 PyMuPDF）。
  - 新增 `scripts/tools/check-copy.cjs`：正式檢查器完成前，給 worker 自查照抄（Q11 簡易版）。
