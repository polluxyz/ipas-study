# 單一同名公開 repo 遷移

## 目標與使用者決定

2026-11-02 使用者確認：移除個人 email 後公開；搬移完成後刪除舊 GitHub repo；最後只保留一個 `polluxyz/ipas-study`。公開歷史以驗收過的完整 tracked 檔案快照開始，舊 Git 物件、PR、Actions 資料保留本機私有備份，不匯入公開庫。此決定取代舊版「不得公開」與「另留永久 private GitHub repo」的規則。

## 結構與影響

- 教材、官方 PDF、`text/`、ID、官方答案及既有套件選型保持原位元組；來源固定於切換時驗收過的 main commit。
- 新 GitHub repo 先用暫名、private 狀態建立；驗收後取得正式名稱 `ipas-study`，公開後刪除已更名的舊 repo。
- 新 `.git` 與來源 object database 隔離；新 clone/worktree 不繼承舊分支、PR refs、reflog、alternates 或設定中的個人 email。
- 已交稿未合併的內容與本機審查資料先保全；若未併入來源快照，只以檔案差異在新歷史重建，重新走既有審查。不能 merge 舊歷史。
- 舊 PR 編號、Actions、簽章與開發歷史不會成為新公開庫的記錄；必要稽核紀錄留本機備份。
- Orca 與協調腳本須核對實際 repo ID、工作路徑及 GitHub node ID；同名 URL 不能作為新舊身分證明。

## 界線

### Always

- 先備份、先驗收新庫，再切換與刪除舊庫；每一步記錄新舊 GitHub node ID。
- 新庫所有提交採公開 noreply 身分；檢查 author、committer、完整訊息與所有實際公開 refs、檔案及 Actions 資料。
- 既有 CI、檢查器、230 項測試與建置在最終候選重新通過；公開前從新遠端 fresh clone 重查。
- 只搬 tracked 檔案；排除 `.git`、tmp、個人設定、環境、密鑰與不必要的備份。
- 初始化新 main 只有本次快照首筆提交；之後恢復分支、PR、CI、squash 流程。

### Ask first

- 更改使用者指定的最終 repo 名稱、公開範圍，或改為保留第二個 GitHub repo。
- 新增工具／相依、改 workflows、force push、改寫既有遠端歷史、刪除本機備份或原始內容。
- 部署網站仍需另行核可。

### Never

- 新庫尚未驗收就刪除舊庫，或以舊庫的 CI 結果代替新庫驗收。
- 對含舊 object database 的 clone 執行 mirror／all refs push 到新庫。
- 把個人 email、舊 PR／Actions 原始匯出或私有備份送到公開 repo。
- 改動官方 PDF／text，或為通過檢查而修改檢查器與官方答案。

## 成功條件與測試策略

1. 最後唯一正式 GitHub repo 是 `polluxyz/ipas-study`，visibility 為 PUBLIC，node ID 與舊庫不同；舊庫 ID 已刪除，暫名已清空。
2. 遠端只有核定的新歷史與 refs；對已知個人 email 的 metadata／檔案掃描為 0；新 CI metadata／logs 無未處理命中。
3. 與固定來源的 path、mode、blob manifest 相同，核可的規範文件與協調腳本根路徑差異另列；官方 PDF／text 雜湊相同。
4. 既有教材檢查 0 錯、照抄 0 片段、測試與建置成功；保留既有警告基準與實際結果。
5. 未登入可讀新公開庫，已知舊污染 SHA 在新庫無法取得；失敗／限流直接記為未驗證。
6. 新工作環境能正常建立分支與 PR；未合併成果及私有備份具備可讀清單，沒有資料遺失。

本規格只授權既有 repo 的資料搬移與同名替換；不宣稱已撤回他人的 clone，也不宣稱已證明 GitHub 後端物理清除。
