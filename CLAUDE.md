# iPAS AI 應用規劃師（中級）備考專案

本檔是 Claude Code 與 Codex 在此專案工作的權威指引。與通用做法衝突時，以本檔為準。
第 9–15 節的開發規則參考 `D:\Projects\pollux\CLAUDE.md` 改寫。

本專案用來分析 iPAS AI 應用規劃師中級的考試內容與歷屆考題，並建立學習網站。
使用者報考 **科目 1 + 科目 3**，目標是取得「AI 應用規劃師（機器學習）」證書。
所有分析、筆記、回答一律用繁體中文。

---

## 1. 考試規則（來源：115 年度官方簡章 115.01 版）

| 項目 | 內容 |
|---|---|
| 科目組合 | 科目 1 必考，科目 2 或科目 3 擇一。本專案只處理科目 1、科目 3 |
| 證書 | 科目 1 與科目 3 都達 70 分 → AI 應用規劃師（機器學習） |
| 及格 | 每科 100 分，四捨五入取整數，70 分及格。中級沒有平均分補救 |
| 題型 | 單選題，電腦化測驗。實際每科 50 題（每題 2 分） |
| 時間 | 科目 1：13:30–15:00（90 分鐘）；科目 3：15:30–17:00（90 分鐘） |
| 115 年場次 | 第一次 115/05/23；第二次 115/11/14，成績公告 115/11/25 |
| 成績保留 | 單科 70 分以上，自應考日起保留 3 個年度 |
| 證書效期 | 5 年；換證需 5 年內累積 48 小時 AI 相關訓練 |
| 抵免 | 已有初級機器學習工程師證書，可抵免科目 3（詳見簡章 4.2 節） |

- 自 114 年第二次考試起，科目 3 加入程式題（Python 讀碼、程式片段判斷）。
- 簡章規則以 `text/brochure_115.txt` 為準。網路文章資訊只當參考。

---

## 2. 評鑑範圍（官方代碼）

### 科目 1：L21 人工智慧技術應用與規劃

| 評鑑主題 | 評鑑內容 | 學習指引章節 |
|---|---|---|
| L211 AI 相關技術應用 | L21101 自然語言處理技術與應用 | 3.1 |
| | L21102 電腦視覺技術與應用 | 3.2 |
| | L21103 生成式 AI 技術與應用 | 3.3 |
| | L21104 多模態人工智慧應用 | 3.4 |
| L212 AI 導入評估規劃 | L21201 AI 導入評估 | 4.1 |
| | L21202 AI 導入規劃 | 4.2 |
| | L21203 AI 風險管理 | 4.3 |
| L213 AI 技術應用與系統部署 | L21301 數據準備與模型選擇 | 5.1 |
| | L21302 AI 技術系統集成與部署 | 5.2 |

### 科目 3：L23 機器學習技術與應用

| 評鑑主題 | 評鑑內容 | 學習指引章節 |
|---|---|---|
| L231 機器學習基礎數學 | L23101 機率/統計之機器學習基礎應用 | 3.1 |
| | L23102 線性代數之機器學習基礎應用 | 3.2 |
| | L23103 數值優化技術與方法 | 3.3 |
| L232 機器學習與深度學習 | L23201 機器學習原理與技術 | 4.1 |
| | L23202 常見機器學習演算法 | 4.2 |
| | L23203 深度學習原理與框架 | 4.3 |
| L233 機器學習建模與參數調校 | L23301 數據準備與特徵工程 | 5.1 |
| | L23302 模型選擇與架構設計 | 5.2 |
| | L23303 模型訓練、評估與驗證 | 5.3 |
| | L23304 模型調整與優化 | 5.4 |
| L234 機器學習治理 | L23401 數據隱私、安全與合規 | 6.1 |
| | L23402 演算法偏見與公平性 | 6.2 |

注意：學習指引把 L23303、L23304 誤印成 L22303、L22304。一律使用簡章的 L233xx 代碼。

---

## 3. 檔案清單

### 原始 PDF（根目錄，不要移動或改名）

| 簡稱 | 檔案 | 內容 |
|---|---|---|
| 114-2 科1 | `114年第二梯次中級AI應用規劃師第一科…pdf` | 114/11/08 公告試題，50 題附答案 |
| 114-2 科3 | `114年第二梯次中級AI應用規劃師第三科…pdf` | 同上；第 38–50 題為附圖程式題 |
| 115-1 科1 | `115年第一次中級AI應用規劃師_第一科…pdf` | 115/05/23 公告試題，50 題附答案 |
| 115-1 科3 | `115年第一次中級AI應用規劃師_第三科…pdf` | 第 1–39 題選擇題，第 40–50 題程式題 |
| 指引 科1 | `AI應用規劃師(中級)-學習指引-科目1…pdf` | 官方學習指引，含各節練習題與解析 |
| 指引 科3 | `AI應用規劃師(中級)-學習指引-科目3…pdf` | 同上 |

### 文字版（`text/`）

PDF 轉出的純文字，用來搜尋與分析。檔名對應上表：

- `text/exam_114-2_科目1.txt`、`text/exam_114-2_科目3.txt`
- `text/exam_115-1_科目1.txt`、`text/exam_115-1_科目3.txt`
- `text/guide_科目1.txt`、`text/guide_科目3.txt`
- `text/brochure_115.txt`（115 年度官方簡章）

### 分析結果（`analysis/`）

- `analysis/教材覆蓋分析.md`：主報告。考題與學習指引的逐項比對，分為已涵蓋／有提及但深度不足／未明確教授／教材表述需校正。
- `analysis/教材涵蓋度比較.md`：Codex 的比較報告，保留作為比對來源，不再修改。
- `analysis/questions.csv`、`analysis/relations.csv`：由 `pnpm run export` 從 `content/` 產生，不手改。

### PDF 頁面圖檔（`pdf-pages/`）

從原始 PDF 渲染的頁面 PNG，給讀程式題、圖表題使用。檔名規則見 `pdf-pages/README.md`。

### 學習網站（見第 9 節）

- `docs/handoff.md`：**換 session 先讀這份**。目前進度、下一步、待核可事項。
- `docs/orca-multi-agent.md`：派工、交接、省 token。`scripts/orca/`：等待與收尾腳本。
- `tools/python/`：教材程式的實測環境（uv）。
- `docs/site-v1-summary.md`：網站計畫的一頁摘要，給使用者看。
- `docs/specs/`：規格。`docs/specs/site-v1.md`、`docs/specs/concept-relations.md`。
- `tasks/`：進行中的 plan 與 todo（做完移到 `tasks/archive/`）。
- `content/`：網站內容（題目 YAML、概念頁、評鑑代碼頁、概念總表）。
- `demo/`：Codex 做的 demo 網站（只含 L23303）。正式網站建立前，先在這裡試做。
- `site/`：正式網站程式（尚未建立）。
- `scripts/`：檢查、匯出、合併、PDF 截圖工具（Node）。`scripts/tools/compare-sources.cjs` 用來在指引與考卷文字版裡找關鍵字，並標出印刷頁碼。
- `tmp/`：暫存檔，不進版控。`tmp/advisor/` 放 advisor 的審查意見；`tmp/demo-shots/` 放 demo 截圖；`tmp/pdf_runtime/` 是 PyMuPDF 套件（205 MB，渲染 PDF 頁面用）。

---

## 4. 處理 PDF 的已知問題

1. 轉文字必須加 `-enc UTF-8`。沒加的話中文字會全部消失。
   ```bash
   pdftotext -enc UTF-8 -layout "<檔案>.pdf" "text/<輸出>.txt"
   ```
2. 程式題的程式碼、圖表、混淆矩陣都是圖片，文字版看不到。
   本機沒有 `pdftoppm`，所以 Read 工具加 `pages` 參數讀 PDF 會失敗（2026-10-31 實測）。
   改讀 `pdf-pages/` 的 PNG。需要的頁面不在裡面時，先渲染成 PNG 再讀。
3. 115-1 試卷的答案欄排在每頁左側一整列，不在題號前面。
   文字版裡多數題目的答案會跟題目分開（科1 第 5–16、23–50 題；科3 第 6–37 題）。
   對答案時要回 PDF 確認。
4. 系統 PATH 上沒有 `python`（指令會跳到 Microsoft Store）。臨時腳本用 Node 寫，放在 `scripts/` 或 scratchpad。
   教材程式的實測用 uv（`~/.local/bin/uv`）管理的專案環境 `tools/python/`：`uv run --project tools/python python <檔案>`。
   套件只加在 `tools/python/pyproject.toml`（協調者改，屬新增相依），不要 `pip install` 到其他地方。2026-10-31 使用者同意。

---

## 5. 已觀察到的出題特徵

這是初步觀察，正式分析完成後要更新本節。

- 情境題為主。題幹多以「某企業／某工程師……」開頭，問「最適合」「主要原因」「最正確」。
- 115-1 題幹比 114-2 長，常帶具體數字（樣本數、延遲毫秒、AUC 值）。
- 科目 1 會考很多 ML 觀念（ROC、混淆矩陣、DBSCAN、XGBoost、超參數調校）。
  這部分與科目 3 重疊，一起準備可以省時間。
- 科目 1 在 115-1 出現新主題：LoRA、SFT、Multi-Agent、ReAct、NIST AI RMF、SHAP、
  漸進式部署、模型漂移監控、邊緣推論、混合雲。
- 科目 3 程式題以 PyTorch、Keras、scikit-learn 為主。
  常見考點：輸出層與損失函數搭配、資料洩漏、StratifiedKFold、遷移學習凍結層、
  梯度裁剪位置、資料增強的副作用、過擬合曲線判讀。
- 科目 3 的公平性題目會考 Statistical Parity、去偏策略分類（前處理／訓練中／後處理）。

---

## 6. 分析工作流程

### 6.1 建立題庫表

題庫的權威資料是 `content/questions/` 下的 YAML（格式見 `docs/specs/site-v1.md` 4.1）。
`analysis/questions.csv`（UTF-8）由 `pnpm run export` 從 YAML 產生，不手改。CSV 欄位：

| 欄位 | 說明 | 範例 |
|---|---|---|
| 場次 | 114-2、115-1 | 115-1 |
| 科目 | 1 或 3 | 3 |
| 題號 | 1–50 | 44 |
| 答案 | A–D | B |
| 代碼 | 對應的評鑑內容代碼 | L23303 |
| 題型 | 觀念、情境、計算、程式、圖表 | 程式 |
| 關鍵概念 | 2–4 個關鍵字，用 `;` 分隔 | 資料洩漏;LDA;交叉驗證 |
| 指引頁碼 | 學習指引中的對應頁碼 | 5-20 |

- 一題只給一個主要代碼。真的跨兩個主題，用 `;` 加第二個。
- 代碼判斷依據是「這題要考生會什麼」，不是題幹提到什麼產業。

### 6.2 產出分析報告

存在 `analysis/` 底下，用 Markdown：

1. `analysis/科目1_分析.md`、`analysis/科目3_分析.md`
   - 各評鑑內容的題數與占比，比較 114-2 與 115-1 的變化
   - 高頻概念排行
   - 學習指引沒有寫、但考卷出現的主題（缺口清單）
2. `analysis/重疊主題.md`：科目 1 與科目 3 共同的考點
3. `analysis/程式題整理.md`：每題考的 API、陷阱、正確寫法

### 6.3 筆記與複習

- 依代碼整理重點筆記，存在 `notes/<代碼>_<主題>.md`。
- 錯題或不熟的題目，記到 `notes/錯題本.md`，寫出為什麼其他選項錯。

---

## 7. 回答與解題規則

- 解題時，先給答案，再說明正確選項為什麼對，最後逐一說明其他選項錯在哪。
- 每題標出評鑑內容代碼，並指向學習指引章節。
- 官方答案與自己的判斷不同時，照實寫出兩者，並說明依據。不要硬套官方答案。
- 出模擬題時，模仿 115-1 的風格：情境題、4 個選項、帶具體數字、干擾選項要合理。
- 引用考卷內容時標明出處，格式：`115-1 科3 第44題`。
- 不確定的資訊（例如未公告的考試細節）要直接說不確定，並說明怎麼查證。

---

## 8. 官方資源

- 能力鑑定網站：https://ipd.nat.gov.tw/ipas/AIAP/
- iPAS 考試資訊：https://www.ipas.org.tw/certification/AIAP/exam-info
- 執行單位聯絡：ipas@itri.org.tw，電話 03-5912893

---

## 9. 學習網站：目標與技術選型

學習網站讓使用者依評鑑代碼與概念學習、練習考古題與模擬題、記錄錯題。
v1 範圍與成功條件見 `docs/specs/site-v1.md`；概念關係見 `docs/specs/concept-relations.md`。

### 設計原則

1. **答案正確第一**：寧可標「爭議」，也不要教錯。`answer` 永遠是官方答案，有疑義時標 `disputed`。
2. **原始資料不可變**：PDF 與 `text/` 不修改。CSV 等衍生資料都能從 `content/` 重新產生。
3. **ID 不改**：題目、概念、評鑑代碼的 ID 合併進 `main` 後就固定。改名只改標題。
4. **內容與畫面分開**：改內容只動 `content/`，改版面只動 `site/`。

### 技術選型（已定案，勿擅自更換）

| 層 | 技術 |
|---|---|
| 網站 | Astro + Starlight，TypeScript strict |
| 內容 | Markdown（概念頁、代碼頁）、YAML（題目）、CSV（概念總表） |
| 搜尋 | Pagefind（Starlight 內建） |
| 腳本 | Node（ESM） |
| 測試 | Vitest；端對端用 Playwright |
| 作答紀錄 | 瀏覽器 localStorage，只透過 `site/src/lib/attempts.ts` 讀寫 |

認為某項選型不適用時，先提出建議與理由，不要直接替換。

### 環境隔離

- 套件管理用 pnpm（2026-11-01 改用，版本見 `demo/package.json` 的 `packageManager`）。相依只裝在 repo 的 `node_modules`。不得 `npm install -g` 或 `pnpm add -g`。
- Node 版本由 `.node-version` 指定。
- `package.json` 與鎖檔只由協調者修改。

### 常用指令（repo 根目錄）

```bash
pnpm install --frozen-lockfile
pnpm run check         # 局部檢查（跨批缺項只算警告）
pnpm run check:final   # 最終檢查
pnpm test
pnpm run build
pnpm run export        # 產生 analysis/questions.csv、relations.csv
```

commit 前至少跑 `pnpm run check`、`pnpm test`、`pnpm run build`（與 CI 對齊）。
目前正式網站還沒建立，實際指令是 demo 版：`pnpm --dir demo install --frozen-lockfile`、`pnpm --dir demo test`、`pnpm --dir demo run build --force`。

---

## 10. 開發工作流程

核心原則：**決策要討論，執行不要停。**

1. **Specify**（使用者核可）：新功能或重大變更動工前，先在 `docs/specs/` 寫 spec：目標、對專案結構的影響、測試策略、界線（Always／Ask first／Never）、可驗證的成功條件。動筆前先列假設清單請使用者確認。
2. **Plan**（使用者核可）：實作計畫寫進 `tasks/<功能>-plan.md`：元件與相依、順序、風險與對策、驗證點。
3. **Tasks**（與 plan 一起送審）：拆成離散任務寫進 `tasks/<功能>-todo.md`，每個任務有 Ownership 與驗收條件。
4. **Implement**：依任務清單自動做到完。

- 模糊需求先轉成可驗證的成功條件。
- spec 是活文件：需求變更時先更新 spec，再改程式或內容。
- 單行修正、錯字不需完整 spec，但要先說清楚驗收條件。

### 決策門控

1. spec 與 plan 要核可才動工。
2. 核可之後一路做到完，不逐步等同意。
3. 遇到計畫外的問題：在已核可範圍內解得掉就解掉，記進 plan 的實作紀錄；會改變方向的，停下來說明。
4. Git 全自動（見第 12 節）。CI 失敗自動修並重推，修完報告原因與改動。

### 徵詢 advisor（第二意見）

要使用者拍板的事（Ask first 事項、方案取捨、偏離 spec），先問 advisor，再一起報告。

1. advisor 用 Orca 開 Codex（`gpt-6.1-sol` + `xhigh`），不用 `codex exec`，也不用 Claude Code 內建的 Agent tool。
2. 徵詢內容寫背景、要決定的問題、目前的方案。**不寫自己傾向哪一個**，避免它順著答。要它回：推薦哪個與理由、每個方案的壞處、漏掉的方案或風險。
3. advisor 唯讀，只把意見寫進 `tmp/advisor/<主題>.md`。
4. 意見不同時互相交流到定案。每輪只送還分歧的點與根據。雙方都沒有新論據時，算「保留分歧」，交給使用者決定。
5. 報告時並列：advisor 的建議、自己的建議、一致與分歧之處、最後建議。

### 報告方式

執行中不需要旁白。每個階段結束時給完整交代：做了什麼、驗證結果的實際數字、與 plan 的偏離、沒解決的問題。

---

## 11. 內容與程式規範

- 內容一律繁體中文。概念頁、解析、模擬題用自己的話寫，不照抄學習指引（檢查器 Q11 會查連續 25 字相同）。
- 題目、概念、關係的格式以兩份 spec 為準。檢查器報錯時修內容，不改檢查器去遷就內容。
- TypeScript strict，避免 `any`。
- 註解用繁體中文，語氣是「導讀＋解釋為什麼」，不逐行複述程式。每個模組一段檔頭總述。
- 模組匯入時不得有副作用：可執行的程式碼放在函式內，由 CLI 呼叫。
- 測試不連外網。檢查器的每條規則都要有會失敗與會通過的 fixture（放在 `tests/fixtures/`）。
- 新增功能一併補測試，勿事後補。

---

## 12. Git／GitHub 流程

- 使用者於 2026-11-02 核可公開與同名替換：先以完整 tracked 快照建立乾淨歷史、完成個人 email 清理與驗收，再公開新 `polluxyz/ipas-study` 並刪除舊 GitHub repo；最後只保留一個同名 repo。規格見 `docs/specs/public-migration.md`。官方 PDF 與 `text/` 仍不可修改，私有備份不進公開庫。
- `main` 永遠可建置，禁止直接 push。所有開發在分支，透過 PR 合併。
- 分支前綴：`feature/`、`content/`、`fix/`、`docs/`、`chore/`。
- Commit 遵循 Conventional Commits：`<type>: <簡述>`。一個 commit 聚焦一件事。
- PR 標題用 Conventional Commits 格式，英文。描述寫改動與原因、驗證證據。
- 必須通過 CI 才能合併，合併用 squash merge。合併前確認 `gh pr checks` 全綠。

### 自動化（不必逐次徵求同意）

開分支 → commit → `git push -u origin <branch>` → `gh pr create` → `gh pr checks --watch`（紅了自己修、重推）→ 全綠後 `gh pr merge --squash --delete-branch` → 切回 `main`、`git pull`。

- PR 編號一律從 `gh pr create` 的輸出取得，不要預測。合併前用 `gh pr view <n> --json headRefName` 確認是自己的分支。
- 合併前確認 CI 已經開始跑（先看到 `pending` 再 `--watch`）。

---

## 13. Orca 工作環境

多個 agent 用 Orca 平行工作。**角色表、派工指令、額度、session 交接、省 token 的細節都在 [`docs/orca-multi-agent.md`](docs/orca-multi-agent.md)，派工或交接前先讀。** 派工前執行 `orca skills get orchestration` 取得版本相符的指令說明，不要憑記憶下 flag。

1. 一個任務 = 一個 worktree = 一個分支 = 一個 PR。新 worktree 先跑 `pnpm --dir demo install --frozen-lockfile`。各 worktree 共用 pnpm 套件庫（`E:\.pnpm-store`），`node_modules` 仍各自獨立，不跨 worktree 共用。
2. **協調者是 Codex**（sol xhigh，2026-11-02 改定）：規劃、拆工、派工、驗收、合併。Claude Code 只做內容主審。協調者自己做的只有共用契約、`package.json` 與鎖檔、寫 Task spec 比自己改還久的瑣碎改動。
3. 派工走 `orca orchestration`，不用 agent 內建的子代理工具。**worker 優先用 Codex**，Claude 只在必要時派（2026-11-01 使用者要求）。
4. Task spec 五欄：Target、Change、Constraints、Ownership、Observable acceptance。worker 只拿得到 Task spec，所以要自足。
5. worker 回報「全部通過」不算數。協調者自己跑檢查、測試、建置並看 diff，範圍外的改動一律退回。
6. 驗收通過後：`worker-release` → `orca terminal close` → ack（`scripts/orca/done.sh`）。已完成的終端機不留在 Orca（2026-10-31 使用者要求）。常駐程式開在標題含「常駐，勿關」的專用終端機，worker 不自己開。
7. 不要新增 `AGENTS.md`。Orca 的 Codex 已設定讀本檔。
8. **前端設計與實作由 Codex 全權負責**（2026-10-31 使用者指定）：`site/`、`demo/` 的版面、元件、樣式與 mockup。協調者只寫 Task spec、驗收、提建議；觀察寫成「建議，由 Codex 判斷」。版面方案要使用者看過才大量實作。
9. **一件事做完就換新 session**，不等 context 滿；換之前更新 `docs/handoff.md`（上限 8,000 字）並發 Orca 交接信。

---

## 14. 程式碼檢索（codebase-memory-mcp）

- **找程式先用 MCP**：找函式、元件、呼叫鏈時，先用 `search_graph`、`trace_path`、`get_code_snippet`，不要先 grep 整個 repo。設定檔、Markdown、YAML、純文字照用 Grep／Read。
- 專案還沒索引、或新增大量程式後，先跑 `index_repository`。索引只涵蓋程式碼，`content/` 的內容檔用 Grep 找。
- 圖譜可能落後於未提交的變更。據以下結論前，看實際檔案。
- 沒有這組工具的 worker 照常 grep。MCP 不可成為建置或測試的相依。

---

## 15. 界線總表

### Ask first（先說明、取得同意才做）

> commit／push／開 PR／合併不在此列，那些是自動的（見第 12 節）。

- 變更資料格式、ID 規則、作答紀錄格式。
- 新增相依套件。
- 修改 CI 設定或 GitHub workflows。
- 新增概念關係類型或概念種類。
- 修改已發布的概念 ID 或題目 ID。
- 偏離已核可的 spec 或方案。
- 技術選型的替換建議。
- 把網站部署到任何網址。
- 破壞性或不可逆的操作：`force push`、`reset --hard`、rebase 既有歷史、改 repo 設定、刪除 `content/` 的資料。

### Never（絕不做）

- 直接 push `main`。
- 未依 `docs/specs/public-migration.md` 完成清理與驗收，就公開 repo 或刪除舊 repo。
- 修改原始 PDF 與 `text/`。
- 在 `answer` 欄位寫入官方答案以外的答案。
- 手改 `analysis/questions.csv`、`analysis/relations.csv`、`review.blind_answer`、`image` 欄位。
- 盲解 worker 讀含答案的檔案。
- 照抄學習指引原文到概念頁、解析、模擬題。
- 安裝相依到全域環境。
