# 考古題 v2：目錄回看、直接重新開始、保留未交卷紀錄（plan）

規格：`docs/specs/official-exam-mode.md` v2（第 1.1 節、A9–A11、決定 6、10–13、第 4.2–4.6、6.2、7、10–12 節）。
任務清單：`tasks/official-exam-v2-todo.md`。

## 1. 範圍

- 資料：`OfficialRound.status` 加 `'retired'`。store 維持 `version: 1`。
- 作答中重新開始：舊輪改 `retired`，同一次寫入建立新輪。不再刪輪次。
- 目錄卡片：依 5 種狀態顯示按鈕與連結（規格第 4.2 節）。
- 全部紀錄頁 `/official/<id>/`：列出已交卷與未交卷紀錄。
- 未交卷紀錄的唯讀畫面（規格第 4.6 節）。
- 使用者看得到的文字拿掉「輪」字。

不做：備份格式、指引練習題、每日題本、舊即時紀錄。

## 2. 共用介面（W1、W2 先照這份寫，W3、W4 照這份用）

### 2.1 `demo/src/lib/attempts.ts`（W1）

```ts
export interface OfficialRound {
  // 欄位不變，只改 status
  status: 'open' | 'submitting' | 'submitted' | 'retired';
}

// 簽名改變：多收畫面上最新的輪次內容 latest。
// latest 必須是同一輪（id、setId、subject、number、createdAt、attemptMode 相同）、status 為 'open'、seq 等於 expected.seq，
// 不帶 correct、submission。重讀到的輪次也必須仍是 open。
// 同一次寫入：舊輪 = { ...latest, status: 'retired', seq: 目前 seq + 1 }，加入新 open 輪。
// 新輪 number = 同題組最大值 + 1。回傳新輪。
export function restartOfficialRound(
  expected: OfficialRoundRef, latest: OfficialRound, newId: string, createdAt: string,
  questions?: readonly { id: string; rev: number }[],
): OfficialRound;
```

其他行為：

- 驗證：`retired` 照 `open` 的內容規則（不帶 `correct`、`submission`，答案可不完整）；「最多 1 輪未完成」只算 `open`、`submitting`。
- `saveOfficialRound`：目標是 `retired` 一律拒絕；不能把 `open` 存成 `retired`。
- `openOfficialRound`：簽名不變。衝突只看 `open`、`submitting`。
- `submitOfficialRound`：收到 `retired` 拒絕，不寫 `Attempt`。
- 容量量測補 50 交卷加 50 未交卷（含 0 題）的混合資料。
- 錯誤訊息不含「輪」字。

### 2.2 `demo/src/lib/official-round.ts`（W2）

```ts
export interface OfficialRoundSource { status: 'open' | 'submitting' | 'submitted' | 'retired'; /* 其他不變 */ }

export type OfficialRoundAction =
  | { kind: 'resume'; roundId: string; label: '繼續作答 →' }
  | { kind: 'start'; label: '開始作答' | '重新開始' };   // 題組有任何 submitted 或 retired 時是「重新開始」；目錄與全部紀錄頁同一規則

export interface OfficialRoundRow {
  id: string;
  status: 'submitted' | 'retired';
  createdAt: string;              // 原始值，給 <time datetime>
  startedText: string;            // 台北時間 'YYYY-MM-DD HH:mm:ss'；與其他列相同時加 '・同時間第 k 筆'
  ariaLabel: string;              // 「查看 →」的朗讀文字：時間、狀態、結果
  statusText: '已交卷' | '未交卷';
  resultText: string;             // 已交卷：score.summary；未交卷：'已答 A／T'
  score: OfficialRoundScore | null;   // 未交卷是 null
}
export interface OfficialRoundList { action: OfficialRoundAction; rows: OfficialRoundRow[]; } // rows 不含 open、submitting；依 number 新的在上

export interface OfficialRoundCard extends OfficialRoundList {
  progressText: string | null;    // '作答中・已答 A／T'
  submittedCount: number;         // 只算 submitted
  latestScore: OfficialRoundScore | null;      // 取 number 最大的 submitted，不是 rows[0]
  latestSubmittedId: string | null;   // 「查看上次作答」的目標，同上
  historyText: string | null;     // '已交卷 N 次・最近 X'
  legacyText: string | null;
}

export function officialRoundReviewAction(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundAction; // 沒有作答中時是 start「重新開始」
export function officialRetiredSummary(round: OfficialRoundSource): string;  // '未交卷・已答 A／T・不計分'
```

### 2.3 `demo/src/lib/official-start.ts`（W2，新檔）

```ts
// 目錄與全部紀錄頁共用的開新輪流程。只在按下按鈕時呼叫。
// 已有 open 或 submitting 的輪次（另一頁剛開）時，不建立新輪，回傳那一輪。
export function startOfficialRound(
  set: { id: string; subject: 1 | 3; questions: readonly OfficialRoundCatalogQuestion[] },
  randomId: () => string, now: () => string,
): { roundId: string; resumed: boolean };
```

- 同步、只做資料操作，不改網址。錯誤丟給呼叫端（W3、W4）顯示。
- 先查既有 `open` 或 `submitting`：有就回傳那一輪，不因目錄無有效題而拒絕續答。
- 真的要建立時才呼叫 `randomId`、`now`。題目篩選沿用 `availableOfficialQuestion`。沒有可作答題目時丟錯。

### 2.4 W4 自己負責的部分

- 未交卷紀錄的唯讀導覽寫在 `official-round-client.ts`：題號全開、顯示不確定標記、不顯示交卷、不計時。不改 `daily-exam.ts` 的 `dailyNumbers`、`dailyNext`，也不把 `retired` 偽裝成 `submitted`。

## 3. 順序

1. R0 advisor 審規格（唯讀）→ 依意見修規格 → 使用者核可。
2. W1、W2 平行（照第 2 節介面）。
3. 協調者整合 W1、W2，跑兩者的單元測試。此時呼叫端還沒改，全專案 `tsc` 預期有錯，不擋。
4. W3、W4 平行（檔案不重疊）。
5. 協調者整合 W1–W4 與 W6（錯題本文字），此時才要求全專案 `tsc` 0 錯、全套測試通過；另開驗收工作樹建置。中途的提交不單獨合併 `main`。
6. W5a、W5b 平行（2 支 smoke，共用驗收工作樹的建置產物）。
7. R1 非作者審查 diff（唯讀）→ 有高中度問題再派修正。
8. V1 驗收（含 v1 建置讀到 `retired` 的實測，見規格成功條件 14）→ PR → CI → 合併 → 部署 4321 → 隔離瀏覽器實走 → 截圖給使用者，並提醒重新載入所有考古題分頁 → 更新 handoff。

## 4. 風險與對策

| 風險 | 對策 |
|---|---|
| 使用者瀏覽器已有 v1 的 `open` 輪次 | v1 資料不轉換即合法；成功條件 13 用 v1 形狀的資料測讀取與重新開始 |
| 退回 v1 程式，或部署前開著的 v1 分頁，看不懂 `retired` | v1 顯示損壞錯誤且不覆寫，4 份都受影響。V1 用 v1 建置實測；部署後提醒使用者重新載入考古題分頁 |
| 2 頁真正同時開輪互相覆蓋 | 規格已知限制，不加跨分頁鎖定；只驗同頁連按與另一頁先完成 |
| 重新開始時沒併入畫面上最新答案 | `restartOfficialRound` 收 `latest`；smoke 比對確認前後答案 |
| 目錄按鈕連按建立 2 輪 | `startOfficialRound` 遇衝突回傳既有輪；按鈕按下即停用；smoke 驗連按 |
| 未交卷紀錄洩漏答案 | 唯讀畫面不顯示答案標示與解析；smoke 檢查可見畫面與朗讀文字（題卡 HTML 原有答案屬性，不在範圍） |
| 「輪」字殘留 | smoke 掃描各頁可見文字 |
| 長期累積 `retired` 輪次 | 規格不自動刪除；用 v1 的容量量測數字估算，記入實作紀錄 |
| 考試日 2026-11-14 | 只做規格內容；任何新想法記到「待使用者決定」 |

## 5. 驗證點

- 每個 worker：自己的單元測試全過、`tsc --noEmit` 0 錯。
- 整合後：`pnpm --dir demo test`（`--maxWorkers=1`）、`tsc`、check-textbook、照抄檢查、建置頁數、6 支 smoke。
- 基準：測試 50 檔 1476 項以上、建置 1895 頁、教材 920／920、照抄 0。

## 6. 實作紀錄

2026-11-13 完成，PR #213（`1cd50b9`）。

- 分工：W1–W4、W6 實作，W5a、W5b 瀏覽器 smoke，R1 非作者審查，都是 Codex worker；V1 由協調者做。
- 容量（W1 實測）：50 筆已交卷 1,063,321 字元，連存 50 次 288 ms；已交卷 50 筆加未交卷 50 筆 1,210,169 字元，381 ms。
- R1：高 0、中 1、低 0。中度 R1-01：從作答頁按返回時，瀏覽器的返回快取保留了已停用的開始按鈕。修法是目錄在 `pageshow` 且 `persisted` 時重新載入（`e5db730`）。
- 「輪」字掃描只掃介面文字。題幹、選項、解析、爭議說明屬教材內容，其中「本輪梯度」等是機器學習用語，不改。
- 計畫外：`daily-smoke.mjs`、`daily-booklet-smoke-multi.mjs` 還在找 v1 字樣（「開始第 1 輪」等），已改成 v2 字樣。兩支題本 smoke 預設讀已刪除的工作樹，執行時要設 `DAILY_BOOKLET_DIST`。
- 條件 14：除了儲存層測試，也用 4321 上的 v1 建置實測。v1 目錄與作答頁都顯示無法讀取、沒有可作答的選項，store 逐字不變；換回 v2 可繼續作答。證據在 `tmp/official-exam/v2-condition14-evidence.md`。
- 驗收：測試 51 檔 1587 項；建置 1895 頁；official-round-smoke 27 案、multi 18 案各連跑 2 次全過；3 支每日 smoke 與 daily-exam-smoke 全過；截圖 42 張（7 種畫面 × 3 寬度 × 亮暗色）。
- 部署：main 與建置時的樹只差未被頁面匯入的 `daily-smoke.mjs`，所以直接 robocopy 驗收工作樹的 `demo/dist`。隔離瀏覽器走查 4321：開始、50 題交卷 80 分、目錄顯示「已交卷 1 次・最近 80 分」、查看上次作答、重新開始、作答中重新開始留下未交卷紀錄、未交卷紀錄不揭露答案；頁面錯誤 0，介面沒有「輪」字。截圖 `tmp/demo-shots/official-v2-deploy/`。
- 已知小問題（未修）：全部紀錄頁有「繼續作答 →」時，狀態列仍寫「按下開始按鈕才會開始作答。」。
