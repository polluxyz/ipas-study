# 單一同名公開 repo 遷移計畫

範圍：使用者 2026-11-02 明確指定「只留一個 repo、移動後刪舊、同名 ipas-study」。使用者決策取代前次保留 private GitHub repo 的提案；顧問複核與實作結果在本計畫持續記錄。

## 元件、順序與驗收點

1. **決策與規範**：核對同名替換順序、既有 queue／分支／工作樹；以正常 docs PR 同步規則、規格與交接。
2. **保全來源**：先讓正在執行的 push／merge 到自然邊界；固定 main SHA S、manifest、所有未合併分支與 tmp 審查資料。Git bundle 與 GitHub 管理資料只存本機，驗證可讀。
3. **隔離候選**：在乾淨目錄由 S 的 tracked 快照建立新 `.git`、noreply 身分與乾淨初始訊息；不引入舊 refs。候選資料與 S 逐檔比對。
4. **本機驗收**：對最終候選查個人 email／秘密、實際二進位 metadata，跑既有 check／tests／copy／build；實際數字記錄到本機驗收報告。
5. **private staging**：以不衝突暫名建立獨立空 repo，只推新的 main；核對 node ID、refs、fresh clone、所有新 CI 結果與 metadata。
6. **同名切換**：停止舊庫網路寫入；舊庫改成唯一備份暫名，新庫取得 `ipas-study`。每次更名前比對 node ID，避免舊 URL redirect 導致誤操作。舊 worktree 的 remote 與腳本目的地先明確隔離。
7. **公開與刪舊**：正式新 URL 的 CI、clone、身分與隱私驗收通過後公開；以舊庫精確名稱及 node ID 核對後刪除舊 GitHub repo。最終只保留新 `polluxyz/ipas-study`。
8. **恢復開發**：核對 Orca 新 clone、base ref、工作樹與協調腳本；未合併內容只套檔案差異，採 noreply 新提交；更新交接與結果。

## 風險與對策

| 風險 | 對策 |
|---|---|
| 同名 URL 在更名後改指新庫 | 用 GitHub node ID 核對身分；舊 remote 先改指備份名，舊寫入流程收斂後才換名 |
| 尚未合併內容遺失 | bundle、逐分支 patch、tracked manifest 與 tmp 審查資料本機備份，重建後逐檔比對 |
| 舊 email 經 Git objects／訊息回流 | 全新 `.git`、明確 main push、禁止 mirror／舊史 merge；fresh clone 後重掃 |
| 快照之後仍有新提交 | 切換前固定 S；來源變更即重新產生與驗收候選 |
| 二進位掃描工具不足 | 先用現有本機工具；必要新增相依屬 Ask first，不以 raw 字串未命中假裝完全掃描 |
| Orca 同名註冊不明 | 用實際 CLI receipt 驗證，不改底層資料庫，不關協調者自身；未知時保留資料繼續查證 |
| 舊 PR／Actions 刪除 | 依使用者授權刪舊庫，先本機匯出作稽核，不另留第二個 GitHub repo |

## 實作紀錄

- 2026-11-02：前次 advisor 建議快照新庫；使用者指定僅留同名新庫並刪舊。本機 user.email 已設 GitHub noreply；author／committer／完整訊息及 Actions 的歷史 email 命中已確認。
- 協調者已啟動既有內容審查與核算，並讓已驗收的 6 組合併 queue 繼續執行；遷移不得遺失這些工作。
- 同名／刪舊順序的唯讀複核：`tmp/advisor/public-repo-single.md`；詳細私有盤點與備份不進版控。
