# 題庫擴充與每日 50 題：任務清單

| 任務 | Ownership | 驗收條件 | 狀態 |
|---|---|---|---|
| T1 `origin` 與批次門檻工具 | `demo/src/content.config.ts`、`QuestionCard`、檢查器與 fixture、`scripts/tools/` 新工具 | 正反 fixture 通過；有 `origin` 的題目頁顯示作者、來源、授權、修改摘要 | 待派 |
| T2 `/daily/` | `demo/src/pages/daily*`、`demo/src/lib/daily*`、`attempts.ts` 新增函式、導覽入口 | 規格第 6 節每條都有測試；隔離瀏覽器實測 | 待派 |
| T3a zero2005x 科1 58 題 | `content/questions/mock/external/zero2005x/Z-L21*`、該目錄 `LICENSE.md` | 第 9 節規則；檢查通過；留原文對照 | 待派 |
| T3b zero2005x 科3 76 題 | `content/questions/mock/external/zero2005x/Z-L23*` | 同上 | 待派 |
| T4a 科1 試行批 20 題 | `content/questions/mock/M-*` 新檔 | 第 9 節規則 | 待派 |
| T4b 科3 試行批 20 題 | `content/questions/mock/M-*` 新檔 | 第 9 節規則；含程式題 | 待派 |
| R 每批非作者盲解與全審 | `tmp/question-bank/<批次>/` | 盲解答案先落檔，再讀含答案檔 | 依批次 |
| C 每批 Claude 主審 | 主工作區 | 不一致題全審、其餘抽審；高中度問題清零 | 依批次 |
| W 後續批次（至每科 550） | `content/questions/mock/M-*` 新檔 | 依第 5 節日期 | 待試行批 |
