# L21103-C 文本生成與品質評估共用例子

`L21103-C-generation.json` 是教學合成資料：客服12筆、教育12筆，每筆有一份來源、一份參考及A／B兩個手寫候選。沒有呼叫生成服務、沒有真實個資，也沒有真實受試者；兩位評分者的分數是為教學預設。

## 固定規則

- 資料版本 `synthetic-v1`，索引 `generation-v1`。每份來源一塊，共24塊；所有頁沿用相同的來源順序與切分，沒有檢索效能比較。
- `seed=21103` 是固定資料版本標記。本例完全確定，不進行隨機抽樣或生成；匿名P／Q按 `source_index` 奇偶交換候選次序。
- 客服CS01–CS08、教育ED01–ED08是規準校準資料；各領域09–12保留作測試。不能把在校準資料看到的結果宣稱為獨立測試表現。
- 詞單位直接使用 `tokens` 陣列，不由文字重切。這是手設的教學分詞，不是平台計費或模型的子詞token。
- BLEU示範單一參考、BLEU-2、等權、不平滑、0–1尺度；空候選或缺高階片段時教學回傳0。語料級先彙整片段計數與長度，不能平均句級BLEU。
- ROUGE示範單一參考、固定詞單位、句級ROUGE-L及等權F1，不做詞幹化。若彙整多筆，逐筆計算P／R／F1後等權平均；不是摘要級 `rougeLsum`。
- 評分者先看任務、來源及候選，不看品牌或原始候選名稱；兩個維度分開記。分歧指兩人分數不同，重大分歧的教學規則為相差至少2分。
- 關鍵事實錯誤需要修正與覆核，不能以流暢度或平均總分抵銷。CS01-B刻意保留R2的錯誤評分，供教學校準，原始資料不改成覆核後結果。

## 欄位

| 欄位 | 意義 |
|---|---|
| `id`、`domain`、`source_index` | 唯一樣本、領域及固定排序索引 |
| `source_id`、`source_version`、`source`、`chunk_ids` | 合成來源、版本、全文與來源區塊識別 |
| `task`、`split` | 生成任務與校準／保留測試角色 |
| `reference`、`candidates` | 參考與兩候選的顯示文字及固定token |
| `facts`、`fact_check` | 可查事實、證據位置及候選對照結果 |
| `ratings`、`rating_note`、`anonymous_order` | 原始兩人兩維分數、分歧註記及匿名顯示順序 |

`fact_check.verdict` 的 `supported` 表示條件與來源相容，並不保證表達完整；`contradicted` 表示與來源矛盾；`insufficient` 表示缺少完成任務的必要資訊。這些都是教學標註，不是自動查證器的預測。

## 關鍵參考數值

下表由固定token核算，實際重播與核對紀錄在本組 `tmp/rollout/groups/W-L21103-C/examples-check.md`。

| 候選 | BLEU-2 | ROUGE-1：P／R／F1 | LCS長度 |
|---|---|---|---|
| CS01-A | 0.818731 | 1／0.833333／0.909091 | 5 |
| CS01-B | 0.707107 | 0.833333／0.833333／0.833333 | 5 |
| CS03-A | 0 | 0.333333／0.166667／0.222222 | 1 |
| CS04-A | 0.894427 | 1／1／1 | 5 |
| ED01-A | 0.816497 | 0.833333／0.833333／0.833333 | 5 |
| ED01-B | 0.707107 | 0.833333／0.833333／0.833333 | 5 |

CS01-A兩人流暢平均4.5、正確平均4.0；CS01-B分別為5.0與2.0。四組候選×維度有2組分歧、1組重大分歧；這不是一致性係數，也不是實驗結果。

## 使用頁面與圖

- `text-generation-platforms`：CS01客服及ED01教育輸入需求，分清產品與模型。沒有用合成候選比較品牌。
- `text-generation-workflow`、`hallucination`：CS01三日／一日、ED01線上／實體，說明驗收與事實核對。
- `bleu`：CS01短輸出與錯誤期限、CS03重複片段、ED01同義改寫及錯誤事實。
- `rouge`：CS01匹配與漏失、CS04詞序／LCS、ED01同匹配不同正確性。
- `human-generation-evaluation`：CS01兩位評分者原始分數、匿名排序、ED01跨領域規準及全組工作量。
- 圖 `l21103-text-generation-platforms-layers`、`l21103-text-generation-workflow-acceptance`、`l21103-hallucination-evidence`、`l21103-bleu-matching`、`l21103-rouge-lcs`。

生成腳本為本組暫存目錄的 `figure-scripts/generate.cjs`。匹配圖與LCS圖從本JSON讀取token及計算結果建立，自足SVG不使用遠端資產。
