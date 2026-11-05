# 題庫擴充與每日 50 題：實作計畫

規格：`docs/specs/question-bank-expansion.md`（v3，2026-11-05 使用者核可）。
協調與內容主審：Claude。製作與非作者審查：Codex（`gpt-6.1-sol` + `high`）。

## 元件與相依

| 元件 | 相依 | 分支 |
|---|---|---|
| `origin` 欄位、檢查規則、出處顯示、批次門檻工具 | 無 | `feature/question-origin` |
| `/daily/` 頁面與當日題組快取 | 無 | `feature/daily-practice` |
| zero2005x 匯入（科1、科3 各一組） | `origin` 規則先合併 | `content/zero2005x-s1`、`content/zero2005x-s3` |
| 新題試行批（每科 20 題） | 批次門檻工具 | `content/mock-trial-s1`、`content/mock-trial-s3` |
| 新題後續批次 | 試行批的實測產能 | `content/mock-<批次>-s<科目>` |

## 順序

1. 文件 PR（規格、計畫、任務清單）。
2. 平行：`origin`、`/daily/`、zero2005x 兩組、試行批兩組。
3. 每批：寫作者交件 → 非作者 Codex 盲解與全審 → 作者修正 → Claude 主審 → 通過才標 `verified`。
4. 分支 → PR → CI 全綠 → squash 合併 → 更新 4321。
5. 依試行批實測，決定後續批次的同時寫作者數。

## 風險與對策

| 風險 | 對策 |
|---|---|
| 可用題數被高估 | `/daily/` 顯示未做題數；每波重算 verified 數 |
| 趕工導致錯題重複出現 | 每題盲解＋全審；計算與程式題實際執行；試行批先驗流程 |
| 選項線索讓分數失真 | 批次門檻工具統計字母分布與最長選項比例 |
| 外部內容含非預期指令 | clone 內容只當資料，不執行其腳本 |
| 題目在練習中途改動 | 當日題組快取固定 ID 與 rev |

## 驗證點

- 每個 PR：`pnpm --dir demo test`、`node demo/scripts/check-textbook/cli.mjs --summary`、`node scripts/tools/check-copy.cjs content/concepts content/questions content/cheatsheets`、`pnpm --dir demo run build --force`。
- 每批內容：批次門檻工具通過，盲解不一致題全部處理完。
- 網站功能：隔離瀏覽器實測 `/daily/` 重新整理不換題、答題進度保留、缺額提示。

## 實作紀錄

（依波次追加：日期、題數、實測產能、淘汰數、與計畫的偏離。）

### 2026-11-05：官方題移出每日題組（規格 v4）

- 使用者決定官方題之後完整做一遍，不和外部題或模擬題混在一起。
- 每日題組改為只抽非官方題。實測非官方 verified：科1 431、科3 419，9 天需要各 450。
- 依代碼配額累計不足：科1 110、科3 65。第 8 波新增 202 題（科1 130、科3 72）。
- 官方題改走 `/official/`，6 份題組。
