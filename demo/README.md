# AI 學習手札：L23303 互動原型

本機 Astro + Starlight demo，供確認版面與學習流程。讀取 `../content/`，沒有改寫內容，也沒有部署。

## 啟動與入口

在專案根目錄 `D:\AI_test`：

```powershell
pnpm --dir demo install --frozen-lockfile
pnpm --dir demo run build
pnpm --dir demo run preview
```

開啟 **http://127.0.0.1:4321/**。建議用 preview 檢視完整原型，**Pagefind 搜尋只在建置後的 preview 可用**；開發模式用 `npm --prefix demo run dev`，網址相同。請勿同時啟動兩個服務占用 4321；若被占用，Astro 可能改用其他埠，以終端顯示的網址為準。

| 入口 | 路徑 |
|---|---|
| 首頁與兩科代碼目錄 | `/` |
| 分階段路線、考試頻率、閱讀與作答進度 | `/codes/L23303/` |
| 資料洩漏概念 | `/concepts/data-leakage/` |
| 程式題與提交後解析 | `/questions/115-1-S3-Q44/` |
| 爭議題 | `/questions/114-2-S3-Q34/` |
| 整個單元測驗（全部題目） | `/quiz/?code=L23303` |
| 防止資料洩漏階段小測驗（最多抽 5 題） | `/quiz/?code=L23303&stage=prevent-leakage` |
| 錯題、作答及閱讀備份與匯入 | `/wrong-book/` |

執行環境：本次使用 Node **24.22.1**、npm **11.19.1**。專案根目錄目前沒有 `.node-version`，demo 未建立或修改根目錄設定。套件版本由 `demo/package-lock.json` 固定，全部只安裝在 `demo/node_modules/`。

## 結構

```text
demo/
  astro.config.mjs           Starlight、側欄、Markdown 與中文搜尋
  plugins/wiki-links.mjs    [[概念 ID／唯一別名]] 轉換
  src/content.config.ts     外部內容集合與 Zod schema
  src/pages/                首頁、代碼、概念、考題、測驗、錯題本
  src/components/           共用版面、作答元件、來源與流程圖
  src/lib/attempts.ts        唯一的 localStorage 存取介面
  src/lib/attempts.test.ts   紀錄、版本與匯入邏輯測試
  src/lib/content.ts         閱讀順序、分類路徑與內容查詢
  src/lib/learning-route.ts  階段驗證、引用頻率、目前版本進度與抽題
  src/lib/learning-route.test.ts 階段、頻率與進度測試
  src/data/revisions.json    從題庫產生的版本索引
  src/styles/custom.css     閱讀版面與手機樣式
  scripts/prepare.mjs        產生版本索引、複製題目圖片到 demo
  scripts/astro.mjs          啟動 Astro，固定停用遙測
  scripts/smoke.mjs          Playwright 驗收與截圖
```

內容更新後請重新執行 build，或重新啟動 dev，讓題目版本索引及側欄閱讀順序一起更新。原始 Markdown 與 YAML 由 content collections 直接讀取；沒有另外保存一份 demo 題庫。索引與圖片副本只寫入 `demo/`。

## 設計決定

- 以紙張白、低彩度綠與固定淺色主題減少長篇閱讀負擔；桌面左側保留學習路線，概念頁右側是本文目錄，手機改為選單。
- 首頁聚焦目前可學的 L23303；另外 20 個官方代碼標為「尚未建立」。概念數與題數隨 `content/` 更新，不代表正式題庫已完成。
- 概念正文依來源顯示「重點、原理、細節與常見誤解、延伸、教材勘誤」；來源沒有的節不造內容。前置閱讀採遞迴拓撲順序；分類路徑採 `is_a` 全部上層路徑。本文後集中顯示雙向對策、比較表、組成／種類、後續閱讀與正文反向連結，保留 note 與來源。
- 指引來源顯示科目與印刷頁碼；考題來源直接連題目頁。不偽造未提供的 PDF 頁面錨點。Mermaid 圖由本機套件按需載入並轉成 SVG，不使用轉圖服務。
- 題幹與選項先完整顯示，提交後揭露官方答案、正解理由、三個干擾選項理由與概念入口。爭議題依官方答案計分，解析另列爭議說明；模擬題保留待審查提示。
- 代碼題數、題型與清單從 YAML 算出；場次占比以「同場次、同科目範例題庫」為分母，頁面明示不是整卷出題比例。
- 路線依代碼頁 `stages` 排成階段，每個概念附 `goal`；沒有 `stages` 時維持平面清單。尚無概念頁時顯示「撰寫中」，不產生閱讀連結，側欄也略過缺頁。攤平後的 ID 或順序和 `concepts` 不符時，建置印出警告並繼續。
- 採用小標籤呈現考試頻率，區分場次及科目；只計 `source: exam`，同階段內一題只算一次。跨階段的題目各自引用，因此階段數字不宜直接相加當全單元題數。
- 閱讀採手動「標記為已讀」及取消標記。階段進度顯示已讀數、做過的不同題數與答對數；作答只認目前 `rev` 的最近一次答案，包含從單題頁、完整測驗與階段測驗留下的紀錄。
- 採用 `/quiz/?code=...&stage=...`，階段題庫依概念引用篩選，包含考古題、模擬題及指引題；每次隨機抽最多 5 題，沿用作答、解析、錯題本與測驗結果。「再練一次」保留階段參數。無題目時顯示「尚無題目」，不提供測驗入口；錯誤的網址參數顯示空狀態。未採用長條頻率圖，標籤已能清楚比較。
- 作答介面完全依 `site-v1.md` §4.5：`saveAttempt`、`getAttempts`、`getWrongBook`、`exportAttempts`、`importAttempts`。儲存 key 是 `ipas-attempts-v1`，JSON 為 `{version:1, attempts:[...]}`；匯入按 ID 去重，無效項逐筆計數。只有舊 rev 時標示「題目已更新」，較新的舊版紀錄不蓋過目前 rev 的結果。
- 所有閱讀儲存也只經 `attempts.ts`：`getReadings()`、`setConceptRead(id, boolean)`，獨立 key 為 `ipas-reading-v1`，值為 `{version:1, readings:[{conceptId, ts}]}`。匯出沿用 version 1，增加 `readings`；舊備份沒有此欄仍可匯入並保留現有閱讀紀錄。匯入按概念 ID 合併，較新時間覆蓋較舊時間；取消標記只作用於目前裝置，不會透過合併刪除另一裝置的已讀紀錄。新增／略過／無效筆數合計作答與閱讀紀錄。
- 錯題答對後離開待複習清單，歷史作答仍保留。匯入正式網站的其他題目紀錄會保留，但未在範例題庫中的題目沒有重新作答連結。正確率以目前版本全部作答次數計算。
- demo 無後端，答案存在靜態網站檔案；這是自學練習的揭露互動，不是防作弊的考試平台。紀錄依網址 origin 分開，請固定使用同一個 host 與埠，換裝置前先匯出。

## 驗證

```powershell
pnpm --dir demo test
pnpm --dir demo run build
# 先在另一個終端啟動 preview，再執行：
pnpm --dir demo run test:e2e
```

本機已有 Chromium 1234，但 Playwright 1.64.1 預設尋找 1248，因此本次**沒有額外下載瀏覽器**，使用已存在的 Chromium 跑驗收：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
pnpm --dir demo run test:e2e
```

其他電腦可把同一環境變數指向已安裝且可用的 Chromium／Chrome。若已安裝 Playwright 對應的瀏覽器版本，則不需要這個環境變數。驗收腳本只允許 localhost 網路請求；不同本機埠可用 `DEMO_URL` 指定。

目前結果：

- 建置成功：16 個靜態頁面（含 404），Astro／TypeScript 診斷 **0 錯誤、0 警告、0 提示**。
- Vitest：**26 / 26** 通過，既有 7 個加新增 19 個；涵蓋 stages 順序驗證、頻率去重、目前版本進度、抽題與閱讀備份往返及舊格式相容。
- Playwright：**15 / 15** 主要頁面、**17 / 17** 不重複內部連結正常；雙中括號都已轉換。連結數會隨教材更新。
- 答錯 115-1 科3 第44題 → 錯題本收錄 → 匯出 → 清除 localStorage → 匯入恢復 → 重複匯入略過 → 重新答對移出，全部通過。
- 爭議題提交後顯示官方答案與爭議說明；5 題測驗全對顯示 **5 / 5、100 分**。
- Pagefind 實際查詢「資料洩漏」第 1 筆為 **`/concepts/data-leakage/`**。
- 390px 手機寬度：首頁、路線頁、概念頁、程式題、錯題本共 5 頁無水平溢出；搜尋與選單不重疊，選單可開關。
- 6 階段路線：已讀標記跨頁及重新整理後保留，備份清空再匯入後恢復；階段小測驗引用篩選、作答、計分與重試參數保留均通過。無題目階段不顯示測驗入口，無效階段網址顯示空狀態。
- 瀏覽器 JavaScript 錯誤 **0**、外部服務請求 **0**。

建置器另有非失敗訊息：本 demo 用自訂 StarlightPage 路由，所以標準 docs／i18n 集合為空；本機網址未設定公開 site，因此跳過 sitemap；Mermaid 按需載入的套件有大於 500 kB 的區塊提示。這些不影響建置與上述驗收，正式網站再依核可計畫整理。

截圖與機器可讀結果放在 `../tmp/demo-shots/`：

- `01-home.png`：桌面首頁。
- `02-data-leakage.png`：概念、對策、來源與關聯。
- `03-question-answered.png`：程式題作答後完整解析。
- `04-wrong-book.png`：備份匯入恢復後的錯題本。
- `05-home-mobile.png`：390px 首頁。
- `route-desktop.png`、`route-mobile.png`：桌面及 390px 完整分階段路線。
- `route-stage-desktop.png`、`route-stage-mobile.png`：首階段近照，方便檢查字級與進度。
- `verification.json`：驗收結果；`attempts-backup.json` 是測試產生的作答備份。

範圍內功能已完成。後續由使用者確認版面與功能方向，再核可完整 spec／plan；此原型不含正式內容完整性檢查器、全部 21 個單元、完整題庫與部署。

## 畫面問題複核（2026-10-31）

協調者指出的三個現象都曾出現在較早的驗收截圖；後續任務開始時，最終檔案已包含段落間距、錯誤樣式優先權及淺色語法配色的基本修正。本輪再次確認畫面，並補強成可自動驗證的修正：

| 項目 | 是否存在與原因 | 最終處理及證據 |
|---|---|---|
| Mermaid 文字垂直裁切 | 早期存在；Mermaid 的 HTML `foreignObject` 標籤移入正文後，繼承 `.prose p` 的段落間距，超出原先量測的高度。派工開始時已有清除段落間距的修正。 | 改成根層 `htmlLabels: false`，直接使用 SVG 文字，移除對 HTML 段落排版的依賴；smoke 確認 4 個標籤全部位於各自方框內，沒有 `foreignObject`，並檢查四段文字完整存在。 |
| 錯誤選項與正解同為綠框 | 早期存在；`:has(input:checked)` 的選取樣式優先權高於 `.is-wrong`。派工開始時已有較高優先權的錯誤樣式。 | 保留紅框／淡紅底的錯選 A、綠框／淡綠底的正解 B，以及文字標記；新增 smoke 直接比較提交後 A 與 B 的實際邊框和背景顏色，確認各自不同。 |
| 程式碼淡灰、對比不足 | 早期存在；Astro Code 預設的深色主題搭配強制淺底造成文字過淡，並非固定頁首遮擋導致；先前已改為淺色主題，但本輪量測一般 `github-light` 的部分 token 最低只有 3.39:1。 | 改用 `github-light-high-contrast`／`github-dark-high-contrast`，深色模式同時切換 token 與區塊底色；39 個文字／語法 token 的最低對比分別為 **4.89:1／9.23:1**，均超過 4.5:1。整站仍維持原本的淺色原型，本輪用 DOM 主題狀態驗證程式碼的深色呈現。 |

重新執行 `pnpm --dir demo run build` 成功，Astro／TypeScript 為 0 錯誤、0 警告、0 提示；既有 7 個單元測試、15 頁／14 內部連結、錯題備份還原、測驗、中文搜尋及手機 smoke 仍全部通過。非失敗的建置器提示與上節相同。

已更新 `tmp/demo-shots/02-data-leakage.png`、`03-question-answered.png`，另留 `06-code-dark.png` 作深色程式碼證據。截圖共用流程會等待字型、回到頁頂並確認 `scrollY === 0` 後再截整頁，避免固定頁首落到圖片中段；`verification.json` 新增 `visuals` 的量測值。預覽持續可由 **http://127.0.0.1:4321/** 開啟。
# 補充內容閱讀（S4）

概念頁支援 `:::supplement[來源：來源甲；來源乙]`，以獨立的 `:::` 結束。區塊內可寫一般 Markdown、表格、公式、提示框與程式碼；相鄰且來源相同的區塊會共用一個標籤與段尾來源。來源以純文字呈現。

二至四級標題以「（補充）」結尾時，該小節到下一個同級或更高級標題都屬於補充；「參考來源」永遠結束補充範圍。表格只在第一個資料儲存格去頭尾空白後以「（補充）」結尾時隱藏整列，其他欄或句中提到標示不會隱藏。清單項自己的文字（不含巢狀子清單）以「（補充）」結尾時也會隱藏；有序清單替每項設定原本的 `value` 序號，避免隱藏第 2 步後把第 3 步改編成第 2 步。清單起始編號、既有 `value` 與倒序皆保留。

「只看指引內容」預設關閉，無補充內容時不顯示。開關只影響當頁，不儲存任何偏好；目錄同步隱藏補充範圍的連結。`/dev/supplement/` C 版共用正式開關，`/dev/supplement-render/` 使用正式 Markdown 管線展示各種內容與隱藏邊界。

smoke 的完整模式會抽查正式頁與 dev fixture；設 `SMOKE_SUPPLEMENT_ONLY=1` 可只跑 F6＋S4 的 dev 頁驗收，供其他教材尚未完成時隔離檢查。無補充內容的固定對照頁為 `/dev/supplement-empty/`，截圖寫入 `tmp/textbook/shots/s4-*.png`。

