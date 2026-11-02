# 學習網站 v1 任務清單（v2）

計畫：[site-v1-plan.md](site-v1-plan.md)。每個任務的完整 Task spec 在派工時寫，本檔只列範圍、相依與驗收。

所有任務共通的驗收：

- 只改 Ownership 內的檔案。
- T01a 合併後：`npm run check` 0 錯誤（跨批缺項只算警告）。
- 不改 `package.json`、鎖檔。需要新相依時回報協調者。

## W0 地基

| ID | 角色 | 相依 | Ownership | 驗收 |
|---|---|---|---|---|
| T00 | 協調者 | — | `.gitignore`、`CLAUDE.md`、`package.json`、黃金範例 3 份（`content/concepts/data-leakage.md`、`content/questions/exam/115-1/115-1-S3-Q44.yaml`、`content/codes/L23303.md`）、`content/concept-index.csv`（只含範例概念） | repo 推上 GitHub；黃金範例符合兩份規格 |
| T01a | `site` | T00 | `scripts/check/`、`scripts/lib/`、`tests/fixtures/` | `check` 與 `check:final` 跑 C1–C13、Q1–Q12、`[[連結]]`；每條規則有失敗與通過的 fixture 測試 |
| T01b | `site` | T00 | `site/`（全部，到合併為止） | Astro + Starlight 讀 `../content`；`[[連結]]` 外掛；3 份黃金範例能顯示；`npm run build` 成功 |
| T01c | `site` | T00 | `scripts/export/`、`scripts/merge/` | `export`、`export:blind`、`merge-blind`、`merge-images`、`set-status` 五個指令，各有 fixture 測試 |
| T02 | `site` | T00 | `scripts/render-pdf/` | 輸入 PDF、頁序、裁切範圍，輸出 PNG；用 115-1 科3 第44題實測 |
| T03a | `writer` | T00 | `content/_drafts/concepts-S1.csv` | 科1 9 個代碼的概念候選，含 id、title、kind、owner_code、aliases、來源頁碼 |
| T03b | `writer` | T00 | `content/_drafts/concepts-S3a.csv` | 科3 L231、L232（6 個代碼） |
| T03c | `writer` | T00 | `content/_drafts/concepts-S3b.csv` | 科3 L233、L234（6 個代碼） |
| T04 | 協調者 | T03a–c | `content/concept-index.csv`、`docs/specs/site-v1.md` 6.4 | 去重、跨科共用概念只有一個 owner；C13 重複別名逐筆確認；搜尋驗收的目標 ID 換成實際 ID |

黃金範例的移交：

- `data-leakage.md`、`L23303.md` 在 T00 合併後移交給 C11。C11 可以修改，但格式要保持範例的樣子。
- `115-1-S3-Q44.yaml` 在 T00 合併後移交給 E8（抽取）與 X8（解析）。

## W1 題庫抽取（與 W0 同時開始）

輸出：`content/questions/exam/<場次>/` 或 `guide/` 下的 YAML。填 `stem`、`options`、`answer`、`pdf_page`、`type`、`codes`、`answer_checked`；`concepts`、`explanation` 留空；`status: draft`。不寫 `image`、`blind_answer`。

| ID | 角色 | 範圍 | 備註 |
|---|---|---|---|
| E1 | `extract` | 114-2 科1 第1–25題 | |
| E2 | `extract` | 114-2 科1 第26–50題 | |
| E3 | `extract` | 114-2 科3 第1–37題 | |
| E4 | `writer` | 114-2 科3 第38–50題 | 程式題：讀 PDF 頁面轉錄程式碼 |
| E5 | `site` | 115-1 科1 第1–25題 | 答案欄錯位，逐題對 PDF |
| E6 | `site` | 115-1 科1 第26–50題 | 同上 |
| E7 | `site` | 115-1 科3 第1–39題 | 同上 |
| E8 | `writer` | 115-1 科3 第40–50題 | 程式題 |
| E9 | `site` | 指引科1 練習題 | 先試抽一節，協調者看過再抽全部 |
| E10 | `site` | 指引科3 練習題 | 同上 |
| IMG | `extract` | 需要圖片的題目 | 相依 T02、E4、E8。只輸出 PNG 與 `content/assets/questions/manifest.csv`；YAML 由 `merge-images` 回填 |

驗收：每份考卷 50 題、題號連續；協調者每份考卷抽 5 題對 PDF 確認。

## W2 概念頁（相依 T04、T01a）

每個任務寫自己 owner 的概念頁與評鑑代碼頁，照黃金範例。

| ID | 代碼 | ID | 代碼 |
|---|---|---|---|
| C1 | L21101、L21104 | C7 | L23101、L23102、L23103 |
| C2 | L21102 | C8 | L23201、L23202 |
| C3 | L21103 | C9 | L23203 |
| C4 | L21201、L21202 | C10 | L23301、L23302 |
| C5 | L21203 | C11 | L23303、L23304 |
| C6 | L21301、L21302 | C12 | L23401、L23402 |

角色：`writer`。驗收：C1–C13、Q11 在局部檢查 0 錯誤；`mitigates`、`contrasts` 都有 `source`。

## W3 題目解析與盲解

| ID | 角色 | 相依 | 範圍 | 驗收 |
|---|---|---|---|---|
| X1–X8 | `writer` | 對應的 E1–E8、T04 | 範圍與 E1–E8 一一對應 | 填 `concepts`、`explanation`、`guide_refs`、`author`；`status` 保持 `draft` |
| X9–X10 | `writer` | E9、E10、T04 | 指引練習題科1、科3 | 同上 |
| B1–B4 | `reviewer` | E1–E8、T01c | 4 份考卷，只讀 `export:blind` 的輸出 | 輸出 `analysis/blind/<考卷>.csv`（題號、盲解答案、理由） |
| S1 | 協調者 | X1–X8、B1–B4 | 執行 `merge-blind` 再執行 `set-status` | 盲解與官方一致且已核對 PDF → `verified`；不一致 → `disputed` 並交 R5 |

## W4 網站功能（相依 T01b，與 W2、W3 同時）

T01b 合併後，`site/` 依下表移交。表外的 `site/` 檔案由協調者負責。

| ID | 角色 | Ownership | 內容 |
|---|---|---|---|
| F1 | `site` | `site/src/components/concept/` | 建議先讀、對策表、比較表、分類路徑、反向連結、考過的題目 |
| F2 | `site` | `site/src/components/quiz/`、`site/src/lib/attempts.ts`、`site/src/pages/quiz/`、`site/src/pages/review/` | 題目頁、測驗、錯題本、匯出／匯入；匯入往返與 `rev` 更新的測試 |
| F3 | `site` | `site/src/components/code/`、`site/src/pages/index.astro` | 代碼頁統計、首頁進度。只透過 4.5 的介面讀作答紀錄；F2 合併前用暫時實作 |
| F4 | `site` | `site/astro.config.mjs`、`site/src/plugins/` | 搜尋設定；Mermaid 轉 SVG；概念轉址 |
| F5 | `site` | `scripts/smoke/` | Playwright smoke test：搜尋 10 組查詢、測驗流程（規格成功條件 9、10） |

## W5 模擬題（相依 W2）

| ID | 角色 | 內容 |
|---|---|---|
| M1–M6 | `writer` | 依 C 任務分組合併成 6 批，每個代碼 4 題。模仿 115-1 風格：情境題、帶數字、干擾選項合理 |
| RM1–RM2 | `reviewer` | 審查模擬題（科1、科3）：答案唯一、干擾選項合理、沒有超出評鑑範圍。輸出審查清單 |
| MF | `writer` | 依 RM1–RM2 修正 |

## W6 交叉審查與收尾（相依 W2、W3）

| ID | 角色 | 內容 |
|---|---|---|
| R1–R4 | `reviewer` | 概念頁事實錯誤與規格符合度（科1、科3 各 2 批）。輸出審查清單，不直接改檔 |
| RF1–RF4 | `writer` | 依 R1–R4 修正；修完由原 reviewer 複驗 |
| R5 | `reviewer` | 盲解不一致題目，整理成 `analysis/disputed.md`，附雙方依據；`writer` 回應後協調者判定 |
| R6 | 協調者 | 關係一致性重測（新的 16 對） |
| FIN | 協調者 | `npm run check:final` 0 錯誤；`npm run export`；F5 smoke test 通過；寫本機啟動說明 |
| U1 | 使用者 | 測驗流程實際操作；決定要不要做關係圖 |
