# 同名公開遷移驗收

依使用者決定，從完整 tracked 快照建立新歷史，最後只保留 `polluxyz/ipas-study`；舊 GitHub repo 在新庫驗收後刪除，本機私有備份保留。

## 檔案與身分

- 來源快照有 1,332 個 tracked 檔案、55,225,760 bytes；初始新 Git tree 的 path、mode、blob 與來源完全相同。
- 6 份原始 PDF、7 份 text、教材、ID 與官方答案保持原位元組；新根提交與舊提交沒有交集，沒有 alternates／shared object store。
- 已知個人 email 與秘密字串命中 0；主機 CLI 安裝路徑逐檔分類為工具／文件參照。
- PDF／PNG 檢查涵蓋 457 頁、1,691 個解壓 streams、92 張 PNG metadata 與像素解碼，命中及解析錯誤為 0；未做像素 OCR，不宣稱能撤回他人的既有副本。

## 允許差異與驗收依據

教材與原始資料維持一致。遷移 PR 只更新規範、驗收、交接文件與 hook／Orca 協調腳本的工作根路徑；完整差異由 PR 展示。

本機已驗證：教材檢查 0 錯誤、801/801 映射列有效、照抄 0 片段、230/230 測試通過、472 頁建置成功；50 條既有 T3 警告照實保留。新 repo 的 PR／main CI 也必須全綠後才公開。實際 runs、node ID、來源對照、備份與刪舊收據留在本機私有驗收包；即時階段以本機 control.json 與 GitHub 回應為準。

舊 PR／Actions 及私人 metadata 不匯入。12 組未合併交稿從本機檔案差異恢復，繼續獨立審查與 PR，不能把舊歷史合併回新庫。
