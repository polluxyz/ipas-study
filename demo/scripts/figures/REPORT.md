# S1 交付與驗證紀錄

日期：2026-10-31。已完成公式、圖引用、五個數據圖模板與正文進階小節收合；未修改 `content/`、package／鎖檔或其他 worker 的檔案。

## 作者語法與 schema

- 行內公式 `$...$`、獨立區塊 `$$`；多字母量 `\mathrm{TP}`。
- 圖引用 `![替代文字兼圖說](figure:圖-id)`，圖資放根目錄 `content/figures/圖-id.json` 或 `.svg`；找不到時建置失敗並列出正文來源與預期圖檔。
- `## 進階`／`## 進階（補充）` 預設收合，包含三級標題，到下一個一級／二級標題結束。
- 五模板 `roc`、`pr`、`learning-curve`、`residual`、`confusion-matrix` 的資料 schema 均在 `demo/src/lib/figures/README.md`；執行期驗證器為相鄰 `schema.mjs`；各自黃金範例在 `examples/<kind>.json`。
- `/dev/figures/` 是唯一新增頁面，不列側欄。五個範例只讀 `examples/`，正式外掛預設讀根目錄 `content/figures/`。

## 驗證結果

| 驗證 | 結果 |
| --- | --- |
| S1 單元／管線測試 | 31 項通過：四筆 ROC AUC=0.75、AP=5/6、混淆矩陣、殘差、同分、單一類別、零分母、無效圖資料、缺圖、SVG、公式、進階收合與 wiki-links |
| `npm --prefix demo test` | 全站 6 個測試檔、94 項通過 |
| 獨立建置 | 在 `demo` 執行 `node scripts/astro.mjs build --outDir ../tmp/textbook/build-s1`；Astro check 56 檔、0 錯誤／警告／提示；69 頁建置成功並產生 Pagefind |
| S1 Chromium 驗證 | 5 圖、3 公式、3 MathML；Pagefind 找得到周圍中文；預設收合與數值表可展開；375px 無整頁橫向溢出；無 JS 仍有 5 圖與 3 MathML |
| 字型與離線 | 2 個實際載入的 KaTeX woff2 都來自本機；外部請求 0、失敗請求 0、瀏覽器錯誤 0 |
| 深色圖說對比 | 13.28:1；圖與文字已目視檢查 |
| 既有 Chromium smoke | 15 頁、46 連結、30 組概念前後導覽、6 章側欄；錯題／備份／測驗／中文搜尋與五種手機頁面通過 |

截圖：`tmp/textbook/shots/s1-desktop.png`、`s1-mobile.png`、`s1-dark.png`；機器可讀證據：同目錄 `s1-verification.json`。驗證腳本為 `demo/scripts/figures/verify.mjs`，接受 `DEMO_URL` 與 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`。

## 環境與限制

`demo/dist` 與協調者的 4321 preview 均未變動。Astro preview 預設拒絕同專案第二個實例；查本機 CLI 發現 `--ignore-lock` 能安全共存，已短暫用於首輪驗證，收到協調者後續指示後改以 `tmp/textbook/serve-s1.mjs` 在 4322 提供獨立建置並重跑驗收，結束時關閉自己的服務。

原型既有導覽固定淺色；深色驗證透過 `data-theme=dark` 切換圖表及展示頁教材區，不改全站主題選擇器。沒有新增相依或部署。建置既有非致命提示包括 docs／i18n 空集合、未設定 sitemap site、Mermaid 大 chunk。
