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

## 規格 v4：官方題與每日題組分開（2026-11-05）

| 任務 | 內容 | Ownership | 驗收 |
|---|---|---|---|
| T-daily-official | 每日題組只抽非官方題；新增 `/official/` | `demo/src/lib/daily*`、`official*`、頁面、側欄 | 每日題組官方題 0 題；6 份題組頁題數等於內容題數；真瀏覽器測試通過 |
| T8 | 11 批 202 題非官方新題（科1 130、科3 72） | 各批分配的 YAML | 第 4 節品質門檻；非作者盲解與全審；主審 |
| T-dup-s1、T-dup-s3 | 重寫 43 題同科目重複題 | 清單內 YAML | 非作者盲解與全審；主審；`rev` 加 1 |

## 狀態（2026-11-05，main 為 b992705）

上方 T1–T8、T-daily-official、T-dup 都已合併，第一張表的「待派」已過時。

| 項目 | 科目 1 | 科目 3 | 需求 |
|---|---|---|---|
| verified 模擬題 | 560 | 491 | 各 450 |
| 程式或圖表題 | 0 | 192 | — |
| disputed 模擬題 | 2 | 4 | — |

- 依代碼缺口只剩科目 3 的 L21101、L21203 各 -9。規格決定不寫。
- 跨科目近似題本輪未比對。上一輪 31 題清單在 `tmp/question-bank/review/dup-w3/cross/duplicates.json`。
- 每日題組改成交卷後檢討，另見 `tasks/daily-exam-mode-todo.md`。
