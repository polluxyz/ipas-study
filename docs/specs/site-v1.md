# 學習網站 v1 規格（草稿 v2）

2026-10-30。狀態：**草稿，待使用者核可**。

- v1：Claude 起草。
- v2：依 advisor（Codex）審查修正，審查原文在 `tmp/advisor/site-v1-review.md`。修正項目見第 8 節。

概念之間的關係另見 [concept-relations.md](concept-relations.md)（已核可）。本規格定義其餘部分：目錄、資料格式、ID、題庫、網站功能、驗收條件。

---

## 0. 假設清單（待使用者確認）

1. v1 只在本機看，用 `npm run dev` 或 `npm run preview` 開啟。不支援直接雙擊 HTML 檔開啟。不部署到公開網址，部署另寫規格。
2. Repo 是 GitHub private repo。PDF 與 `text/` 進版控，讓每個 worktree 都拿得到原始資料。Repo 不得改成公開。
3. 科目 1 與科目 3 一起做，不分先後。
4. 概念頁、解析、模擬題由 Claude worker 撰寫；網站程式、資料檢查、盲解、交叉審查由 Codex worker 負責。同一份內容的作者與審查者不能是同一個 provider。
5. 關係圖等使用者看過清單與表格版本後才做（依 concept-relations.md 第 6 節）。
6. 作答紀錄只存在瀏覽器（localStorage），提供匯出／匯入。沒有後端。

---

## 1. 範圍與成功條件

### v1 範圍

| 內容 | 數量 |
|---|---|
| 評鑑代碼頁 | 21 頁（科1 9 個、科3 12 個） |
| 概念頁 | 估計 120–180 頁，以概念總表為準 |
| 考古題 | 200 題（114-2、115-1 各 2 卷 × 50 題） |
| 指引練習題 | 約 89 題（科1 約 43、科3 約 46，以實際抽出為準） |
| 模擬題 | 每個評鑑代碼 4 題，共 84 題 |
| 網站功能 | 代碼頁、概念頁、題目頁、測驗模式、錯題本、搜尋 |

### 可驗證的成功條件

1. `npm run check:final` 0 個錯誤（見第 5 節）。
2. 200 題考古題的 `review.status` 都是 `verified` 或 `disputed`，沒有 `draft`。
3. 每題考古題與指引練習題的 `review.answer_checked` 都記錄了核對的 PDF 頁序與核對者。
4. 每題考古題都有 Codex 的盲解答案。盲解與官方答案不同的題目，全部列在 `analysis/disputed.md`，附雙方依據與最後判定。
5. 21 個評鑑代碼頁都存在，每頁至少連到 3 個概念頁。
6. 84 題模擬題齊全（每個代碼 4 題），每題都經過非作者 provider 審查。
7. 一般規則：每個概念頁至少被1題YAML的concepts引用，或有1條進出有類型關係。2026-11-03使用者核可固定8頁條件例外：僅允許 `ai-team-capability`、`cyclic-time-features`、`multimodal-privacy-security`、`ndcg`、`open-weight-models`、`text-generation-platforms`、`development-toolchain`、`text-generation-workflow`，以另一個已整合、實際渲染且有明確學習目的的概念正文或代碼學習路線入口替代。逐頁同版驗證與非作者複審通過才生效；完整條件見 [概念入口例外](concept-entry-exceptions.md)。原始強條件缺口仍列8，另列核可數、當版有效數與未豁免數。C12結構警告依concept-relations原定義另報，不再視為本條同義數字。新增ID仍須核可；有合法題目引用或有類型關係時回到一般規則。
8. 照抄檢查：所有概念頁、解析、模擬題，與學習指引文字版沒有連續 25 字以上相同的片段（Q11）。題幹、選項、指引練習題原文不在檢查範圍。
9. 搜尋驗收：6.4 的 10 組查詢，目標頁都出現在前 3 筆結果。
10. 測驗流程：選代碼 → 作答 10 題 → 看解析 → 錯題出現在錯題本 → 匯出 → 清除瀏覽器資料 → 匯入 → 錯題本恢復。另測：題目 `rev` 加 1 後，舊紀錄標示「題目已更新」。先由 smoke test 腳本跑過，再由使用者實際操作一次。
11. 關係一致性重測（新的 16 對）≥ 85%，依 concept-relations.md 第 1 節。

---

## 2. 目錄結構

```text
D:\AI_test\
├── *.pdf                  原始 PDF（不動）
├── text/                  PDF 轉出的文字（不動）
├── analysis/              分析報告；questions.csv、relations.csv 由程式匯出
│   └── blind/             盲解結果 CSV
├── docs/specs/            規格
├── tasks/                 plan 與 todo
├── content/               內容層：只有資料，沒有畫面程式
│   ├── codes/             L21101.md … L23402.md
│   ├── concepts/          <concept-id>.md
│   ├── concept-index.csv  概念總表（建立概念頁前先定）
│   ├── concept-redirects.csv  概念合併或拆分後，舊 ID → 新 ID
│   ├── questions/
│   │   ├── exam/<場次>/<question-id>.yaml
│   │   ├── guide/<question-id>.yaml
│   │   └── mock/<question-id>.yaml
│   └── assets/questions/  題目圖片與 manifest.csv
├── site/                  Astro + Starlight 網站程式
└── scripts/               檢查、匯出、合併、PDF 截圖等工具（Node）
```

內容層與畫面層分開：改題目只動 `content/`；改版面只動 `site/`。

---

## 3. ID 規則

ID 一旦合併進 `main` 就不能改。

| 對象 | 格式 | 例子 |
|---|---|---|
| 考古題 | `<場次>-S<科目>-Q<兩位題號>` | `115-1-S3-Q44` |
| 指引練習題 | `G<科目>e<版次>-<印刷頁碼>-Q<兩位序號>` | `G3e1-5-20-Q01` |
| 模擬題 | `M-<評鑑代碼>-<三位序號>` | `M-L23303-001` |
| 概念 | 英文小寫加連字號 | `data-leakage` |
| 評鑑代碼 | 官方代碼 | `L23303` |

- 檔名等於 ID。
- 指引版次：目前的學習指引（2025-12-22 版）是 `e1`。官方改版時用 `e2`，舊題保留。
- 題目有 `rev`（版本號，從 1 開始）。題幹、選項或答案有實質修改時加 1。作答紀錄會記 `rev`。
- 概念合併或拆分時，舊 ID 不刪，寫進 `concept-redirects.csv`（欄位 `old_id,new_id`）。網站把舊網址轉到新頁。
- 指引頁碼一律用印刷頁碼，寫法 `guide-<科目>:<頁碼>`，例如 `guide-3:5-20`。

---

## 4. 資料格式

### 4.1 題目（YAML）

```yaml
id: 115-1-S3-Q44
rev: 1
source: exam            # exam | guide | mock
session: 115-1          # 只有 exam 有
subject: 3
number: 44              # exam 與 guide 有
pdf_file: 115年第一次中級AI應用規劃師_第三科_機器學習技術與應用_公告試題_20260615003428.pdf
pdf_page: 15            # PDF 閱讀器的頁序，從 1 開始
type: 程式              # 觀念 | 情境 | 計算 | 程式 | 圖表
codes: [L23303]         # 主要代碼在第一個
concepts: [data-leakage, cross-validation]
stem: |
  題幹原文
code: |                 # 選填。程式題把圖片中的程式手打成文字
  ...
code_lang: python
image: 115-1-S3-Q44.png # 選填。由整合腳本依 manifest 回填，worker 不手寫
options:
  A: …
  B: …
  C: …
  D: …
answer: B               # 官方答案；也是計分用的答案
explanation:
  summary: 一句話講這題考什麼
  correct: 正確選項為什麼對
  wrong:
    A: …
    C: …
    D: …
guide_refs: [guide-3:5-20]
author: claude          # 解析的作者 provider：claude | codex
review:
  status: draft         # draft | verified | disputed
  answer_checked:       # 對照原 PDF 後填；未核對時為 null
    pdf_page: 15
    by: E8
  blind_answer: null    # 由 merge-blind 腳本寫入，worker 不手寫
  dispute: null         # disputed 時寫雙方依據與判定
```

各來源的差異：

| 欄位 | exam | guide | mock |
|---|---|---|---|
| `session` | 必填 | 無 | 無 |
| `number`、`pdf_file`、`pdf_page` | 必填 | 必填 | 無 |
| `answer_checked` | 必填 | 必填 | 不適用 |
| `blind_answer` | 必填（final） | 選填 | 無 |
| 審查 | 盲解 | 盲解（選做） | 非作者 provider 審查 |

- 程式題的 `code` 照原圖逐字轉錄，不修正原圖的錯誤。原圖有錯時，在 `explanation` 說明。
- 爭議題：`answer` 永遠保留官方答案，計分照官方答案。題目頁同時顯示「官方答案」與「爭議說明」。
- 指引練習題照指引原文抽出。網站只在本機看，所以可以收錄原文（見假設 1）。

### 4.2 概念頁（Markdown）

frontmatter 依 concept-relations.md 4.1，另加：

```yaml
codes: [L23303]               # 第一個是負責的代碼（owner）
guide_refs: [guide-3:5-20]
gaps:                          # 指引不足之處，逐項記錄
  - ref: guide-3:5-20
    level: shallow             # covered | shallow | missing | erratum
    ability: 指引只寫定義，考題要判斷 Pipeline 放在交叉驗證哪一層
author: claude
status: draft                  # draft | reviewed
```

正文固定 5 節，沒有內容的節省略：

1. `## 重點`：考前 3 分鐘複習版，3–6 條。
2. `## 原理`：用自己的話解釋，可附 Mermaid 圖或 SVG。
3. `## 細節與常見誤解`：考題常見的陷阱。
4. `## 延伸`：指引沒寫、考卷有考的內容。
5. `## 教材勘誤`：指引寫法會誤導的地方。

正文的 `[[連結]]` 寫概念 ID 或別名。別名對到多個概念時，檢查器報錯，要求改寫成 ID。

### 4.3 評鑑代碼頁（Markdown）

```yaml
code: L23303
subject: 3
title: 模型訓練、評估與驗證
guide_section: "5.3"
concepts: [train-val-test-split, cross-validation, …]  # 依建議閱讀順序
```

正文只寫學習路線說明與這個代碼的出題重點。題數、占比、題目清單由程式從題庫算出來，不手寫。

**學習階段 `stages`**（2026-10-31 新增，隨本規格待核可）：把 `concepts` 分成幾個階段，每個概念附一句學習目標。路線頁依此分段顯示，階段小測驗從該階段概念被引用的題目抽題。

```yaml
stages:
  - id: split-and-validate       # 階段 ID，英文小寫加連字號，同一代碼內唯一
    title: 切分資料與交叉驗證
    concepts:
      - id: train-val-test-split
        goal: 說得出三份資料各自的用途，以及測試集為什麼只能在最後用一次
```

- 有 `stages` 時，所有階段的概念依序攤平後，必須和 `concepts` 完全相同（同樣的 ID、同樣的順序）。檢查器驗這一條。
- `goal` 用「說得出／判斷得出／算得出……」開頭，寫考生讀完要會的事，一句話，不超過 40 字。

### 4.4 概念總表 `content/concept-index.csv`

欄位：`id,title,kind,owner_code,codes,aliases`。`codes` 與 `aliases` 用 `;` 分隔。

- 建立概念頁之前先定好總表。概念頁 worker 只能建立總表裡、`owner_code` 屬於自己任務的概念。
- 需要新概念時回報協調者，由協調者加進總表。

### 4.5 作答紀錄（瀏覽器）

```json
{
  "version": 1,
  "attempts": [
    {"id": "b3f1…", "qid": "115-1-S3-Q44", "rev": 1, "choice": "B", "correct": true,
     "ts": "2026-10-30T10:00:00Z", "mode": "code:L23303", "ms": 42000}
  ]
}
```

介面固定如下，由 F2 實作，F3 等其他元件只透過它讀寫：

```ts
// site/src/lib/attempts.ts
saveAttempt(a: Omit<Attempt, "id">): Attempt
getAttempts(filter?: { qid?: string }): Attempt[]
getWrongBook(): { qid: string; lastAttempt: Attempt; outdated: boolean }[]
exportAttempts(): string            // JSON 字串
importAttempts(json: string): { added: number; skipped: number; invalid: number }
```

- `id` 是隨機產生的唯一值。匯入時依 `id` 去重。
- 匯入時 `version` 不認得、或單筆欄位不合格式，該筆計入 `invalid`，不中斷整個匯入。
- 錯題本：某題「目前 `rev`」最近一次作答答錯，就在錯題本裡。只有舊 `rev` 的作答紀錄時，該題標示 `outdated`（題目已更新），不判定對錯。

---

## 5. 檢查規則

### 5.1 兩種模式

| 指令 | 用途 | 跨批缺項 |
|---|---|---|
| `npm run check` | 每個 PR 的局部檢查 | 警告 |
| `npm run check:final` | 全部完成後的最終檢查 | 錯誤 |

跨批缺項是指「因為其他任務還沒合併而缺」的項目：Q5 考卷未滿 50 題、C1 關係目標概念頁還沒建立（但已在總表）、C9 `source` 指向還沒建立的題目。其他錯誤在兩種模式都是錯誤。

### 5.2 題庫檢查（Q1–Q12）

| 編號 | 規則 | 違反時 |
|---|---|---|
| Q1 | ID 唯一，且與檔名相同，符合第 3 節格式 | 錯誤 |
| Q2 | 欄位符合 4.1 與各來源差異表；`answer` 是 A–D；`options` 剛好 A–D 四個 | 錯誤 |
| Q3 | `codes` 都是 21 個官方代碼之一 | 錯誤 |
| Q4 | `concepts` 都存在於概念總表 | 錯誤 |
| Q5 | 每份考卷剛好 50 題，題號 1–50 不重複 | 跨批缺項 |
| Q6 | exam、guide 題目 `status: verified` 時，`answer_checked` 不能是 null；所有來源 `verified` 時 `explanation` 必須完整（`wrong` 有 3 個選項） | 錯誤 |
| Q7 | `status: disputed` 必須有 `dispute` | 錯誤 |
| Q8 | `image` 指向的檔案存在 | 錯誤 |
| Q9 | `blind_answer` 與 `answer` 不同，但 `status` 不是 `disputed` | 錯誤 |
| Q10 | `guide_refs` 頁碼格式錯誤 | 錯誤 |
| Q11 | 概念頁正文、解析、模擬題與指引文字版有連續 25 字以上相同 | 警告（final 為錯誤） |
| Q12 | exam 題目 `blind_answer` 為空；模擬題不足每代碼 4 題 | 只在 final 檢查，錯誤 |

### 5.3 其他

- 概念關係 C1–C13 依 concept-relations.md 第 5 節。
- `[[連結]]` 指向不存在的概念或歧義別名：錯誤。
- 檢查器每條規則都有一個會失敗、一個會通過的測試資料（fixture）。
- `pnpm --dir demo run export` 產生 `analysis/questions.csv` 與 `analysis/relations.csv`，prebuild也呼叫同一匯出器。欄位及來源保留規則見[分析CSV匯出規格](analysis-export.md)。CSV只由程式產生，不手改。
- `npm run export:blind` 產生盲解用的題目檔，只含 ID、題幹、程式、圖片路徑、選項；不含答案、解析、review。

---

## 6. 網站功能

### 6.1 頁面

| 頁面 | 內容 |
|---|---|
| 首頁 | 兩科的代碼清單、各代碼題數、作答進度 |
| 評鑑代碼頁 | 學習路線（概念依序列出）、歷屆題數與占比、本代碼的題目清單、「練這個代碼」按鈕 |
| 概念頁 | 正文 5 節；建議先讀；對策表；比較表；分類路徑；考過的題目；連到這頁的概念 |
| 題目頁 | 題幹、程式、圖片、選項、作答後顯示答案與解析、相關概念；爭議題顯示爭議說明 |
| 測驗 | 依科目、代碼、概念、來源（考古／指引／模擬）、只練錯題篩選出題 |
| 錯題本 | 錯題清單、各代碼正確率、匯出／匯入 |

### 6.2 技術

- Astro + Starlight。內容用 content collections，從 `../content` 讀取，schema 用 zod 定義。
- 測驗、錯題本是 Starlight 頁面內的互動元件。
- Mermaid 圖在建置時轉成 SVG。
- `[[連結]]` 由建置時的外掛轉成概念頁連結。

### 6.3 新增相依（Ask first，隨本規格一起核可）

- `astro`、`@astrojs/starlight`：網站框架。
- `yaml`、`csv-parse`：檢查與匯出腳本讀資料用。
- 測試框架：Vitest。
- Mermaid 轉圖套件：由實作 worker 選一個，選完回報。
- PDF 截圖工具：由實作 worker 選一個 Node 套件，選完回報。

`package.json` 與鎖檔只由協調者修改。worker 需要新相依時回報，由協調者加入。

### 6.4 搜尋驗收

| 查詢 | 目標頁（概念 ID 依總表，暫定） |
|---|---|
| `資料洩漏` | `data-leakage` |
| `資料泄漏` | `data-leakage` |
| `ROC` | `roc-auc` |
| `AUC` | `roc-auc` |
| `LoRA` | `lora` |
| `過擬合` | `overfitting` |
| `StratifiedKFold` | `stratified-k-fold` |
| `梯度裁剪` | `gradient-clipping` |
| `Statistical Parity` | `statistical-parity` |
| `NIST AI RMF` | `nist-ai-rmf` |

T04 定稿總表後，協調者把暫定 ID 換成實際 ID。判定方式：用 Playwright 在 `npm run preview` 的網站上輸入查詢，讀前 3 筆結果的網址。

---

## 7. 界線

- **Always**：答案改動要對照原 PDF 頁面，並更新 `answer_checked`。
- **Always**：worker 只改自己 Ownership 內的檔案。
- **Ask first**：新增概念到總表（由協調者加）；新增相依；修改 ID 規則或資料格式。
- **Never**：改原始 PDF 與 `text/`。
- **Never**：手改 `analysis/questions.csv`、`analysis/relations.csv`、`review.blind_answer`、`image`。
- **Never**：把 repo 改成公開，或把網站部署到公開網址。
- **Never**：在 `answer` 欄位寫入自己判斷的答案。官方答案有疑義時，`answer` 保留官方答案，`status` 改成 `disputed`。
- **Never**：盲解 worker 讀 `content/questions/` 或 `text/exam_*`。只能讀 `export:blind` 的輸出。

---

## 8. v1 → v2 修正紀錄（依 Codex 審查）

| 項目 | 修正 |
|---|---|
| 指引題 ID | 加版次 `e1`，避免指引改版後撞號 |
| 概念改名 | 新增 `concept-redirects.csv` |
| 題目欄位 | 依來源分欄位要求；模擬題不套 PDF 核對 |
| 爭議題 | 計分照官方答案，另顯示爭議說明 |
| PDF 核對 | 從 `true/false` 改成記錄頁序與核對者 |
| 作答紀錄 | 加 `id`；定義匯入格式錯誤與舊 `rev` 的處理；固定介面 |
| 檢查模式 | 分成局部 `check` 與最終 `check:final`，避免分批 PR 被跨批缺項擋住 |
| 盲解 | 盲解結果由腳本寫回；盲解 worker 只能讀無答案版本 |
| 照抄判準 | 新增 Q11：連續 25 字相同 |
| 搜尋驗收 | 每組查詢指定目標頁與判定方式 |
| 相依 | `package.json` 與鎖檔只由協調者改 |
| 開啟方式 | 定義為 `npm run dev`／`preview` |
| 別名 | 依已核可規格，跨概念重複別名是警告；`[[連結]]` 遇到歧義別名才報錯 |
