# 閱讀入口離線資料

`valid.json`包含固定25頁、2個一般概念、1題與1條正式關係。25頁都有具學習目標的路線入口，但沒有概念正文入鏈。因此強條件缺口25、C12警告25、技術有效例外25、技術未豁免0同時成立。這是合成資料，不是教材內容或語意主審。

`missing-link.json`只移除人才頁的實際href。工具必須回報技術有效24、技術未豁免1及結束碼1。

測試另外從正例改動來源／目標位元組、完整SHA、核可依據、近鄰、stage目的與實際HTML。測試涵蓋正文段落、表格入口、無目的、自動列表、搜尋／頁尾／self_check、未知或重複ID及第26個強缺口。新增正式題目引用或5型關係時，例外會停止生效，回一般規則。合法性本身仍須另外審查，工具不取代內容主審。

在repo根目錄執行：

```powershell
node demo/scripts/check-concept-entries.mjs --input tests/fixtures/concept-entries/valid.json
node demo/scripts/check-concept-entries.mjs --input tests/fixtures/concept-entries/missing-link.json
pnpm --dir demo exec vitest run scripts/check-concept-entries.test.mjs
```
