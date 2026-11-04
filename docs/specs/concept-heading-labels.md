# 概念小節的顯示名稱

本次核可範圍以 task_e6792e5b8cc3 為準。
概念頁的「直覺」小節顯示為「概念說明」。
「（補充）」等括號後綴保留。
本文標題與目錄使用相同名稱。

來源 Markdown、既有標題 ID、涵蓋表與引用語意不變。
既有 `#直覺`、`#直覺補充` 仍是實際目的地。
一般正文中的「直覺」及其他集合不轉換。
本次不變更 `textbook.md` 或其教材證據。

## 建置契約

已檢查安裝版本 Astro 7.4.4、Starlight 0.42.8 與
`@astrojs/markdown-remark` 7.3.5 的程式。

1. `unified().createRenderer()` 將設定交給 `createMarkdownProcessor()`。
2. 使用者的 rehype 外掛先執行。
3. Starlight 將自己的外掛附加到使用者外掛之後。
4. Astro 最後執行 `rehypeHeadingIds()`，同時擷取標題文字。
5. 概念路由將 `render(entry).headings` 傳給 `StudyPage`。
6. Starlight 的 `generateToC()` 沿用文字與 slug。

共用外掛先用 Astro 的既有擷取器固定原標題 ID。
然後只改概念來源中完整符合名稱的標題文字。
最後的內建擷取仍保留 ID，並取得新的顯示名稱。
轉換在建置時完成，不依賴瀏覽器程式或 CSS。

## 驗證

測試涵蓋一般／補充標題、巢狀格式、既有 ID、重複標題、
不相關標題、一般正文、其他來源及重複執行。
完整建置前後逐頁比較 485 頁的 ID、標題及目錄。
除核可名稱以外，HTML 必須完全相同。
另核對來源雜湊、涵蓋表連結與共用 3D 資料。
不啟動服務；本機 4321 更新由協調者負責。
