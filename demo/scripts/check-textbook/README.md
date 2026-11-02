# 教材檢查器 T1–T10

只讀取 `content/`，不修改教材、涵蓋表或圖檔。不需新增套件，使用 demo 已有的 `yaml` 與 Vitest。

```powershell
node demo/scripts/check-textbook/cli.mjs
node demo/scripts/check-textbook/cli.mjs --summary
node demo/scripts/check-textbook/cli.mjs --json
pnpm --dir demo test scripts/check-textbook
```

`--content <目錄>` 可改用其他內容根目錄；預設路徑相對於程式檔案，與目前工作目錄無關。結束碼為：0 無錯誤（可有警告）、1 內容有錯誤、2 執行或參數錯誤。

文字報告的診斷格式固定為：

```text
[錯誤] T1 content/concepts/example.md:42: 教材正文含考題 ID、題號或場次引用。
```

每筆都有規則、等級、檔案與原始行號；最後列每條規則的錯誤／警告數。JSON 報告的 `version` 為 1，含 `concepts`、`issues`、`summary`、`coverage`。

| 規則 | 檢查內容 |
| --- | --- |
| T1 | 概念頁正文的考題 ID、阿拉伯／中文題號、場次引用；frontmatter 不查，相關考題連結區只豁免純連結列 |
| T2 | summary、goals、goals 的 id/text、合法二級標題與順序；`textbook: v2` 列錯誤，其他頁列警告 |
| T3 | 一段超過 90 字或 4 句、一頁超過 3 個提示框（「讀碼重點」除外）、表格超過 4 欄或 6 列資料、程式區塊超過 15 行；均列警告 |
| T4 | 區塊公式的開頭／結尾 `$$` 必須獨立成行；區塊公式需要 formula_groups；每組有 id/source/status/checked_by，verified 必須有核對者，pending 可為 null |
| T5 | Markdown figure 引用的圖 ID 有同名 JSON 或 SVG，圖說／替代文字不可空白 |
| T6 | 兩張涵蓋表的規格欄位、欄數、主題 ID、範圍、涵蓋狀態與概念頁版本雜湊；分開報告兩種比例與映射列審查 |
| T7 | 每個 goal 至少一題；choice 恰有 A–D 四個非空白選項與對應 explain；選項禁用「以上皆是／以上皆非」；同頁至少兩題 choice 且答案全同為錯誤；short 出現在任何 choice 之前為錯誤，定位在該 short 項目；choice 比例低於 2/3 為警告；單元至少 8 題 choice 時任一正解字母超過 40% 為警告 |
| T8 | 每個 python fence 後須接已閉合的 text 輸出 fence，中間僅可有空白與至多一段一般說明文字；不可跨標題、清單、提示框、圖、表或公式 |
| T9 | 補充開頭須為 `:::supplement[來源：具體來源]` 且有對應結尾 `:::`；缺中括號、前綴錯誤、來源空白、未閉合或「參考來源（補充）」均為錯誤；在補充小節內再包補充區塊為警告 |
| T10 | `cheatsheets/` 的 code/title、僅有且依序排列的「公式／指標怎麼選／診斷」二級標題；每個連結的概念與小節存在；沿用 T1 禁止考題引用，速查沒有相關考題豁免區 |
| SELF_CHECK | choice 選項、答案與逐選項解析；short 關鍵點；goal 指向本頁 goals；小題 id 與題幹 |
| PARSE | YAML 語法、frontmatter 型別與未閉合分隔線 |

正文標題忽略 fenced code、區塊公式與獨立 HTML 註解。T3 的字數為移除部分 Markdown 標記與空白後的 Unicode 字元近似值，表格列數不含欄名與分隔列；這些都是供人工審查的試行警告。流程例子接受「走一次流程」，標題可加「（補充）」。規格未列出各 `kind` 的必要節清單，因此不自行增訂必寫小節。

T5 檢查檔案存在與引用文字；不驗證圖資料計算是否正確或可重建。T4 的來源與核對欄位也是結構檢查，無法代替公式內容審查。

T4 的分隔行規則拒絕 `$$公式$$`、`$$\begin{aligned}` 及 `\end{aligned}$$`，附原始行號；請把開頭與結尾的 `$$` 各放一行。這能避免 Markdown 把公式首行誤當 fence 的資訊而略過。行內 `$...$`、行內反引號範例、fenced code、frontmatter 與 HTML 註解不受影響。`fixtures/T4-delimiter-{pass,fail}.md` 及 `t4-delimiter.test.mjs` 覆蓋通過／失敗情形。

補充段落使用 `:::supplement[來源：來源甲；來源乙]`，獨立一行 `:::` 結束。T9 用與 T2–T5 相同的非程式、非公式、非 HTML 註解行掃描，保留原始行號；巢狀提示框會各自配對。`fixtures/T9-{source,close,reference,duplicate}-{pass,fail}.md` 成對覆蓋四組規則。

補充區塊不是提示框，不增加 T3 的提示框數；分隔行及來源不計入段落字數。區塊內正文仍接受 T2 標題、T3 段落／表格／程式長度、T4 公式與 T5 圖資檢查。T8 的程式輸出必須在同一個補充區塊內，不能越過 `:::` 配對。`t9.test.mjs` 鎖住這些邊界。

小題順序用 `fixtures/T7-order-pass.md` 與 `fixtures/T7-order-fail.md` 驗證；錯誤範例把 short 夾在兩題 choice 中間。通過範例只調整順序、不修改小題 ID；同類型內順序由教材維持，網站顯示時另做穩定排序。開頭 short、連續 short、尾端 short、單一類型與空陣列也有邊界測試。

漸進遷移沿用 T2 的 `textbook: v2` 判別。T7、T8 只對新版頁面啟用，舊格式完全跳過這兩條新增規則，避免尚未改寫的 27 頁產生大量新診斷；原有 T1–T6 與 SELF_CHECK 行為保留。新版若缺少整個 self_check，T7 仍逐一回報未涵蓋的 goal。T7 的單元依 `content/concept-index.csv` 的 `owner_code` 彙總，不依可能跨科的 `codes` 重複計算；分母為新版頁面中 answer 合法的 choice 題，short 不計。索引不存在或查無 owner 時不假造單元，仍執行單頁檢查。單元警告每個超標字母只列一筆，定位在該單元第一頁的小題欄位。

涵蓋率採使用者 2026-11-01 核可的規格第 8 節第 10 條：`guide-topics.csv` 每個 `topic_id` 是學習目標，`parent_topic_id` 是父主題，分母只含合法且 `in_scope` 的目標。一個目標有多列仍只計一次；範圍外目標不計。已對應要求存在合法涵蓋列、`coverage_state` 非 `unmapped`，且 `concept_id` 與 `section_anchor` 齊全。表格未齊備或分母為零時，比例列 N/A。

有效審查要求 `reviewer` 非空，且 `reviewed_revision` 等於 `concept_id` 對應概念頁原始位元組的 `sha256:<hex>`（保留 BOM 與換行）。概念頁不存在、缺版本或雜湊不符均為無效；有 reviewer 的無效列會收到 T6 警告，指出概念頁 ID 並提示重審。`complete` 列缺 `reviewer`／`reviewed_revision` 仍為錯誤。

審查完整須同時滿足：至少一列合法且有效審查的 `complete`；沒有 `unmapped`／`mentioned` 列；每一列皆合法且審查有效。已審有效的 `partial` 支援列可照實保留。`evidence_refs` 合起來是否滿足全部 `required_evidence` 由 reviewer 判斷，程式不檢驗教學深度。`goal_id` 與 `evidence_refs` 留白仍列警告，不自行降低比例。

文字與 JSON 報告另列「映射列審查」，統計涵蓋表全部資料列（包含範圍外列）的有效審查列數／總列數，以及 `unmapped`、`mentioned`、`partial`、`complete` 各自列數。JSON 位於 `coverage.mappingReviews`，欄位為 `valid`、`total`、`states`。映射列的有效審查只代表 reviewer 與主概念頁版本相符，資料結構錯誤另由 T6 診斷並阻擋該目標完整率。

`index.mjs` 讀檔時計算雜湊表，再由 `checkCoverage()` 第五參數注入 `Map<concept_id, sha256>`；未提供版本表時，不接受任何審查為有效。跨頁引用只核對主概念頁，引用頁改動仍須人工安排重審。

2026-11-01 前的舊算法是所有列 complete，當時結果 39/44；新舊數字差異是算法調整，不代表新增教材。

`index.mjs` 的 `checkTextbook()` 與 `formatReport()` 可供其他工具呼叫；`cli.mjs` 的 `main()` 只在直接執行時啟動，匯入各模組不掃描、不輸出、不寫檔。

T10 用 Astro Markdown 處理器取得概念頁的實際標題 ID，接受實際 ID 或標題去掉空白、標點後的錨點（英文不分大小寫）。標題中的「補充」文字保留。網站在速查輸出時把契約錨點轉回實際 ID，並移除只有頁首目的地的自動詞彙連結；作者指定的小節連結保留。通過 fixture 為 `fixtures/cheatsheets/L23303.md`，失敗 fixture 為 `fixtures/T10-fail.md`，測試為 `t10.test.mjs`。JSON 報告另含 `cheatsheets` 頁數。

速查瀏覽器驗證沿用已啟動的 preview，不開關服務。先在 `demo/` 用 `$env:TEXTBOOK_TEST_FIXTURES='1'; npm run build` 建置，再於根目錄執行 `$env:Q2_MODE='fixture'; node demo/scripts/check-textbook/verify-cheatsheet.mjs`；必要時設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`。工具比對建置 HTML 的 `href`／目標 `id`、逐一點擊、檢查 320／375／1440px 深淺主題、鍵盤橫向捲動及列印，證據放在 `tmp/textbook/q2/`。正式驗證先移除 `TEXTBOOK_TEST_FIXTURES` 並重新建置，再設定 `Q2_MODE='real'` 執行同一工具。

## 程式實測工具（人工執行，不加入 CI）

```powershell
node scripts/tools/run-code.mjs content/concepts/k-fold-cross-validation.md content/concepts/experiment-tracking.md --out tmp/textbook/run-code-c1.md
```

`--timeout <秒>` 預設 120，為每頁共用行程的時間上限。`--out` 必填，可指定 Markdown 報告位置；不可覆寫輸入教材。結束碼：0 全部通過或沒有 Python、1 輸出不符或執行失敗、2 參數或讀寫錯誤。

依協調者 2026-10-31 的 C1 補充，同頁所有 Python 區塊依序在同一行程執行（類似 notebook），後段可使用前段變數與產物；各頁互不共用。工具用唯一標記與 JSON 紀錄分離各段 stdout/stderr，不把教材輸出誤認成分隔符。某段發生例外時，該段及後續段落標為執行失敗；單純輸出不符仍繼續執行。即使缺少 text 配對仍執行該段，但標為不符並註明無法核對。

每頁產生獨立系統暫存目錄，程式檔與工作目錄都在其中；呼叫 `uv run --project <repo>/tools/python python <暫存檔>`，帶入 `PYTHONIOENCODING=utf-8`、`MLFLOW_DISABLE_AGENT_HINT=1`，完成後清理暫存產物，避免 MLflow 寫進 repo。Windows 的逾時會終止 uv 與其子行程。標準輸出與錯誤合計上限為 8 MiB。

比對只去除每行末尾空白、統一 CRLF，並忽略最後一個行終止換行；不移除行首空白、不忽略空白列、不替換浮點數。報告逐段列檔案、原始 Python fence 行號、通過／不符／執行失敗、逐行差異、實際 stdout 與 stderr 前 12 行（最多 2,400 字元）。T8 與實測工具共用純文字掃描器 `python.mjs`，支援 backtick／tilde fence，略過 frontmatter、註解與其他程式 fence 裡的假語法。工具與測試沒有新增套件，測試透過注入執行器驗證，不啟動 uv。
