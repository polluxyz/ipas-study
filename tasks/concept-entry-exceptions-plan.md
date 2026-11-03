# 固定8頁例外實作計畫

2026-11-03使用者已核可。依docs/specs/concept-entry-exceptions.md落實，不修改content或補關係。

1. 協調者：固定spec與界線，保留C12和原強條件的不同計數。
2. Codex worker：核對當前8頁與來源，建立同版證據、可重跑檢查器及正反fixture。以正式建置驗實際href，不用原始字串掃描代替渲染。
3. 非作者：複核入口目的、近鄰排除、SHA／渲染綁定與正反測試。協調者再跑完整QA、看diff與正常PR／CI／合併。

Ownership：Root只改spec／plan；worker改docs/acceptance/concept-entry-exceptions.json、demo/scripts/check-concept-entries.mjs與test、tests/fixtures/concept-entries/**，並補實作紀錄。不得改現有rollout門檻、content、package／lock／CI。新檢查為獨立證據，不能宣稱C1–C13全實作。

風險：把核可當驗收、舊SHA沿用、新增ID、誤用自動入口。對策：分列原始與有效數字、完整來源綁定、固定白名單、語意非作者審查及實際渲染核對。

## 實作紀錄

2026-11-03，worker建立固定8頁JSON證據及獨立檢查器。來源和目標均重新計算完整SHA-256，未沿用舊報告的版本綁定。入口採6個路線stage及2個experiment-tracking正文位置（151、460行）。題目近鄰17列及每頁5型關係排除理由均保留版本，等待非作者語意主審。

工具純函式接受離線來源、HTML與證據。CLI正常模式必須提供真建置收據，前後核對凍結來源與dist，再檢查實際容器、目的文字和href。離線模式以`--input`讀fixture。工具只判斷技術有效性，不代簽語意或Root最終版本。

首輪探索建置掃描485概念、201題（200考古、1模擬）、21路線、680正式關係（is_a 32、part_of 7、requires 561、mitigates 24、contrasts 56）。原強條件缺口仍8，C12結構警告0，技術有效8，技術未豁免0。探索結果不作最終建置簽核；提交後另留同版收據與檢查報告。

驗證：`pnpm --dir demo test`通過28個檔案、479個測試，其中本工具40個。`node demo/scripts/check-textbook/cli.mjs --json`為485概念、21速查、0錯誤、85個既有T3警告；976列映射為947 complete、29 partial。`node scripts/tools/check-copy.cjs content/concepts content/codes content/questions content/cheatsheets`為0片段。首輪`pnpm --dir demo run build --force`成功建置760頁，Astro check為0錯誤、0警告、7提示。最終凍結建置的commit、原始命令、stdout、stderr、exit及雜湊另記`tmp/concept-entries/`當次報告，避免自我雜湊循環。

未修改content、PDF、text、package、lock、CI、前端或既有驗收程式。與原核可計畫無方向偏離。ndcg與development-toolchain的主入口位於補充內容，完整教材模式保留，指引模式會隱藏；未做HTTP、鍵盤或視覺驗收，仍待非作者語意及Root最終簽核。

2026-11-03協調者更新：PR #99已合併。Root另跑479測試、760頁、976有效映射及照抄0。非作者逐8頁入口、17題近鄰與40條關係排除接受，高0中0低1；專用40測試及另4項表格正反驗證通過。低項為fixture README宣稱表格測試，而現有產品測試只有段落；獨立4項表格檢查補足本輪行為證據，但未改README或產品測試。

Root於#100預覽同版再跑技術檢查：485概念、201題、680關係，C12原始結構警告0、原強缺口8、有效例外8、技術剩餘0。真HTTP入口、可見目的及最終新候選整合仍待完成，不把技術結果代替該步。證據在`tmp/acceptance-20261103/concept-entry-review/`、`archive/approved-concept-entries/`及`tmp/rollout/binomial-notation-preview-20261103/entries.log`。原工作樹已保全與移除。
