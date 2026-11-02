# 教材改版計畫與實作紀錄

規格：`docs/specs/textbook.md`（v1.1 核可，之後依使用者回饋到 v1.5，修正紀錄在規格第 12 節）。本檔記錄執行過程；現況與下一步看 `docs/handoff.md`。

## 1. 起因（使用者 2026-10-31）

1. 學習指引的內容全部要有，沒寫但重要的要補。要做成完整教材，重點整理另外拉出來給快速複習。
2. 公式用 LaTeX 精確呈現。
3. 要有圖輔助。
4. 文字不要太密。
5. 考古題和教材分開。
6. 可以上網參考別人怎麼教，可以和 Codex 討論。

## 2. 階段與狀態

| 階段 | 內容 | 狀態 |
|---|---|---|
| 研究 | RS1–RS5、INV-S1、INV-S3（`tmp/research/`），advisor 意見 `tmp/advisor/textbook-spec.md` | 完成 |
| 規格 | `docs/specs/textbook.md` v1.1 核可（含 4 個新套件） | 完成 |
| 第一波 | KaTeX 與 figure 管線、路線分流、檢查器 T1–T6、用詞表、涵蓋表、共用例子 | 完成 |
| 代表頁 | roc-auc、k-fold-cross-validation、experiment-tracking，加上新頁 ndcg | 完成，經 R1–R3 審查 |
| 補充標示 C 版 | 正式頁實作 `:::supplement`、只看指引開關；4 個代表頁補段落層標示 | 完成 |
| 其餘 27 頁 | 6 組平行改寫（分組見 handoff） | 完成 |
| 收尾 | 速查頁、涵蓋率非作者審查、使用者試讀 | 速查頁與審查完成；試讀待做 |

## 3. 實作紀錄

### 2026-10-31：代表頁第一版
- 3 頁依 v1.1 重寫，Codex 審查 R1（`tmp/textbook/review-r1.md`）找到 6 項錯誤、13 項建議，已修。
- 29 題考古題補 `explanation.rule`（Q1）。路線頁加階段導讀；考古題移到 `/practice/L23303/`。
- F2：提示框外掛、表格欄寬、整齊刻度。

### 2026-10-31 晚：使用者看完代表頁（v1.2）
- 回饋：專有名詞連結不一致；K-fold 的程式考試會考嗎；選擇題答案集中在 B。
- 考試確實考程式：115-1 科3 第44、45 題，114-2 科3 第47 題考交叉驗證程式。指引完全沒教程式。
- 決定：連結顯示中文標題並自動連結；檢核小題每個目標至少 1 題、選擇題占多數、正解分散；程式段落加讀碼重點，不加說明句；輸出改實測（使用者提議用 uv）。
- 工具：`tools/python/`（uv，Python 3.12，numpy／pandas／scikit-learn／torch CPU／mlflow）；`scripts/tools/run-code.mjs` 同頁程式依序在同一行程執行並比對輸出。
- F3 自動連結（30 頁 160 個）、C1 檢查器 T7／T8、W1 改 3 頁、W2 新增 ndcg、R2 審查（3 錯誤 9 建議）、W3／W4 修正。
- 踩到的問題：
  - `[[recall]]（召回率）` 改成顯示標題後，變成「召回率（召回率）」，改成 `（Recall）`。
  - Astro 會沿用舊的 Markdown 快取，重建要加 `--force`。
  - 實驗追蹤頁的程式要接續前一段執行，所以 run-code 改成同頁共用一個行程。

### 2026-10-31 深夜：例子多樣化（v1.3、v1.3.1）
- 使用者：盜刷例子不錯，但要舉不同領域的例子；簡答題放在選擇題後。
- 4 頁加「### 換個場景（補充）」。F4：T7 排序規則，網站顯示一律選擇題在前。R3 審查找到 1 項錯誤（K-fold 客服工單把分層與分組混用，應改用 `StratifiedGroupKFold`）、4 項建議，協調者已修。
- 查指引：適用場景多半只在括號列領域名稱，或寫資料條件。決定「換個場景」先寫指引列出的場景，再補其他領域；指引列出的場景不標補充。

### 2026-11-01 凌晨：上網參考與補充標示（v1.4、v1.5）
- v1.4：writer 動筆前上網查官方文件，參考 1–2 篇教學文章，不照抄，附網址；reviewer 以 `--search` 啟動。理由：使用者認為參考別人的文章，內容會更完整、更好懂。
- 補充標示：F5 做對比頁 `/dev/supplement/`（A 現狀、B 明顯、C 低調加開關）。
- F6 修正：連續的補充內容原本被拆成 3 個框，改成合併為 1 個框，並新增 `demo/src/lib/supplement-blocks.ts`。原因是協調者的派工單逐項列出補充內容。
- 使用者選 C。另要求 worker 優先用 Codex。
- 查 pollux 的交接與省 token 做法後，套用到本專案：`docs/orca-multi-agent.md`、`.claude/settings.json`（15 萬壓縮與 compact hook）、`settings.local.json`、`CLAUDE.md` 瘦身到 11,000 字以下、`scripts/orca/`。

### 2026-11-01 上午：補充標示正式化與 27 頁改寫同時派工
- 為了速度，原定「先補充標示、再改 27 頁」改成同時派：Markdown 寫法先定案為 `:::supplement[來源：…]`，writer 照寫，T9 之後由協調者重跑。
- S4（Codex site）：正式頁補充區塊、「只看指引內容」開關（不存 localStorage）、檢查器 T9。W7（Codex writer）：4 個代表頁段落層標示。W8-A1～D（Codex writer，6 組）：其餘 27 頁，共同規則 `tmp/textbook/specs/W-common.md` v1.5。
- handle 與 dispatchId 記在 `tmp/textbook/handles3.txt`。派工腳本 `tmp/textbook/dispatch.sh`、看畫面 `tmp/textbook/peek.sh`。
- 4321 的 preview 已不在（常駐終端機消失），S4 合入後再重開。
- A1 回報：指引 5-21（`guide3_155.png`）把 Recall 分母誤印成 TP+FP。頁面採 TP/(TP+FN) 並加注意框。收尾時要補進 `analysis/教材覆蓋分析.md` 的「教材表述需校正」。
- F7（Codex terra xhigh）：IoU 框重疊 SVG，需求 `tmp/textbook/figure-request-A1.md`。之後各組的示意圖需求，到了就各派一個做圖 worker。
- F7 驗收通過（數字與 JSON 一致，深淺色與 390px 可讀），已收尾。F9（Codex terra xhigh）：C1 的 4 張切分示意圖，協調者已驗算索引與類別計數。
- 問題：writer 先在正文放 `figure:<圖ID>`，圖檔還沒做時 demo 建置會失敗（S4 卡在 train-val-test-split-roles）。檢查器的 T5 可以放行，但建置不行。處理方式：做圖 worker 優先做被卡住的圖，S4 先用 dev 頁驗收。
- W7 驗收：檢查都過，但為了標示拆表（k-fold、experiment-tracking 各一張表拆成兩張）、拆編號清單、刪句、改順序。規格 8.5 加 v1.6 可讀性規則：表格與清單不拆；表格補充列在第一欄結尾加「（補充）」，清單補充項在句尾加「（補充）」；不刪句。W-common 升 v1.6，廣播給仍在寫的 A2、C2，並請 S4 讓開關也隱藏這兩種標示。W7 在原終端機改派 W7b（spec `tmp/textbook/specs/W7b-fix-marks.md`），以 `tmp/textbook/w7/before/` 為內容基準。
- C1、A1、B、D 驗收通過（協調者自跑：19 頁檢查器 0 錯誤 0 警告、照抄 0 片段、18 段程式全過；表格與清單沒被拆）。各派 writer-claude（sonnet-5-5 high）非作者審查：RV-C1、RV-A1、RV-B、RV-D，spec 在 `tmp/textbook/specs/RV-*.md`，結果寫 `tmp/textbook/review-<組>.md`。原 writer 終端機保留，審查回來後原 writer 修正。驗收腳本 `tmp/textbook/verify-group.sh <組> <頁…>`。
- F10（Codex）：C2 的 4 張示意圖，需求 `tmp/textbook/figure-request-C2.md`，先做 data-leakage-preprocessing（S4 建置卡在這張）。
- S4 驗收：demo 178 測試全過，T9 上線，dev 頁 smoke 通過；正式建置被 C2 缺圖擋住。開關只隱藏表格列（且整列含「（補充）」就隱藏，比規格寬），沒處理清單項。原終端機改派 S4b（`tmp/textbook/specs/S4b-list-items.md`）：清單項隱藏、表格只看第一欄、F10 圖到齊後跑完整建置與 smoke。

## 4. 驗收數字（2026-11-01 收工時）

- demo：159 測試、建置 71 頁、smoke 通過。
- 4 個代表頁：檢查器 0 錯誤、照抄 0、run-code 6 段全過。
- 全站：T1 錯誤 100 個（其餘 27 頁的舊格式），改寫時清掉。
- 涵蓋：L23303-T14-G02 complete（唯一經非作者審查的目標），其餘待審。
- W7b 驗收通過（4 頁 0 錯誤、照抄 0、程式全過；對照 before 只多標示）。派 RV-W7 審補充分類（`tmp/textbook/specs/RV-W7.md`）。
- C2 驗收通過（4 頁 0 錯誤、照抄 0、程式 10 段全過）。派 RV-C2。
- F10 驗收通過：4 張 SVG，全站 T5 歸 0；時間序列圖 6 組窗口與 `L23303-splits.json`（1-based index）一致；資料洩漏圖畫出驗證資料只 transform。已收尾。
- A2 驗收通過（f1-score、pr-auc、class-imbalance、model-comparison：0 錯誤、照抄 0、程式 6 段全過）。全站檢查器 31 頁 0 錯誤、63 警告（T3 29、T6 34）。派 RV-A2。
- RV-B 交回：0 錯誤 5 建議，8 組公式群可改 verified。原 writer 終端機改派 B-fix（`tmp/textbook/specs/W8-B-fix.md`），含自查 v1.6 可讀性（審查沒查這項）。RV-B 已收尾。
- S4b 正式建置被 KaTeX 擋下：`$$` 與公式寫在同一行時，remark-math 把第一行當 fence 資訊。learning-rate-schedule 因此建置失敗；mini-batch 兩處沒報錯，但第一行公式會默默消失。協調者已把 3 處 `$$` 改成獨立一行，檢查器 0 錯誤、run-code 過。已請 S4b 在檢查器加偵測規則（含 fixture 與測試）後重跑建置。
- RV-A1（0 錯誤 17 建議）、RV-C1（0 錯誤 22 建議）交回並收尾。原 writer 終端機改派 A1-fix、C1-fix（`tmp/textbook/specs/W8-{A1,C1}-fix.md`）。協調者決定：IoU 正文照指引寫「大於」；IoU topic 等使用者決定；box-intersection 沒實測，維持 pending；涵蓋證據放在補充內容可接受，但指引有寫的流程步驟不能整節標補充。
- RV-C2 交回（0 錯誤 10 建議，3 組公式可 verified）並收尾；原 writer 終端機改派 C2-fix。S4b 正式建置 73 頁成功，`$$` 獨立成行檢查併入 T4。
- B-fix 驗收通過：5 頁 0 錯誤、照抄 0、程式 5 段全過，8 組公式改 verified（checked_by RV-B）。B 組 writer 已收尾。
- S4b 把「$$ 獨立成行」併入 T4 後，全站多出 19 個錯誤（單行 `$$…$$`）。沒有 writer 在改的 5 頁（early-stopping、k-fold、learning-curve、learning-rate-schedule、mini-batch）由協調者機械修正 9 處，run-code 全過。C1、C2 頁面的 10 處請 C1-fix、C2-fix 一併修。
- 下午：A1-fix（採納 16、暫緩 IoU 映射 1）、C2-fix（採納 10、README 文案交協調者，存 `tmp/textbook/C2/README-additions.md`）驗收通過並關閉；9 頁 0 錯誤、照抄 0、程式全過，公式 A1 6 組＋C2 3 組 verified（box-intersection 仍 pending）。全站檢查器 31 頁錯誤 0。
- RV-D（0 錯誤 17 建議）→ D-fix ctx_287e85b39be3。決定：evidence_refs 不指 `tmp/`；overfitting 無獨立 topic，g2、g3 先標 unmapped（與 IoU 同列待使用者決定）；五策略表移回正文，不新增「整欄標補充」寫法；8 組公式 verified。
- RV-W7（錯誤 4、建議 30）→ W7-fix ctx_1fe9ce18d017。決定：科目 1 指引也算「學習指引」，其內容不標補充；混合項處理原則是「只看指引內容」模式下指引內容不可被藏、剩餘文字要讀得通（無序清單拆項、有序步驟把新增部分移到清單後、引導句不寫死數量）；「換個場景」先補指引場景。experiment-tracking 巢狀 `:::caution` 經建置結果確認渲染正確。
- RV-A2（ctx_ce650b18e31c）收尾。報告 `tmp/textbook/review-a2.md`：0 錯誤、15 建議、13 組公式可 verified。派 A2-fix ctx_4af04345b9fe（spec `tmp/textbook/specs/W8-A2-fix.md`）。pr-auc `contrasts.note` 的考題 ID 會渲染在對照表，要求改成概念層描述。
- D-fix（ctx_287e85b39be3）驗收通過並關閉：採納 17、不採納 0；5 頁 0 錯誤 0 警告、照抄 0、程式 4 段全過；8 組公式 verified；overfitting g2、g3 改 unmapped（待使用者決定是否新增 topic 映射）。
- 協調者合入：
  - `analysis/教材覆蓋分析.md` 新增 3.4 Recall 分母勘誤（5-21，已看 `guide3_155.png`）、3.5 R² 範圍勘誤（4-13 與 5-24 矛盾）；結論改為 5 處；補充資源加 recall_score、r2_score。
  - `content/examples/L23303-README.md` 新增「各頁專用例子」：A2 三份、C2 兩份 JSON。A2 迴歸數字協調者手算核對；`verify-numbers.mjs` 36 項通過；照抄 0；全站檢查器 0 錯誤。
  - glossary 提案（A2、B、D）都不需改 `glossary.csv`。D 組的候選概念（underfitting、regularization、dropout、bias-variance-tradeoff）列入後續單元評估。
  - 尚未說明的例子 JSON：A1-iou、B 三份、C1 兩份、D 兩份。README 是否補齊另議。
- 派 R1-readme ctx_d7041228be91（新 Codex 終端機）：補齊 README 中 8 份例子 JSON 的說明。
- A2-fix（ctx_4af04345b9fe）驗收通過並關閉：採納 14、保留 1（model-comparison 不搬小節）。4 頁 0 錯誤 0 警告、照抄 0、程式 7 段全過。12 組公式 verified；multiclass 新增 weighted 算例，協調者手算（0.75×0.4+0.833×0.6=0.8；micro 32/40=0.8）並對照 sklearn 實測後改 verified。pr-auc 的 note 已改成概念層；`source` 保留 `115-1-S1-Q08`，依 concept-relations 4.1 允許，顯示在關係表來源欄，不屬正文。
- W7-fix（ctx_1fe9ce18d017）驗收通過並關閉：採納 33、不採納 1（連續收尾符號，協調者已確認渲染正確）。4 頁 0 錯誤、照抄 0（兩科指引）、程式 6 段全過；29 則 T3 試行警告。RV-W7 未核算數字，協調者自行重算後把 roc-auc（tpr-fpr、auc-area、auc-pairs：AUC 82.5/96=0.859375，梯形同值）與 k-fold（fold-mean 0.70、fold-spread 0.245、fit-count 60/61/120/121）6 組改 verified，checked_by 填 coordinator-term_b08e717c。
- R1-readme（ctx_d7041228be91）驗收通過並關閉：README 補齊 8 份 JSON，`verify.mjs` 160 個數字一致、結束碼 0；照抄 0；小節外內容不變。協調者抽查 B 電力例子 R² −7／−3.5 正確。回報的頁面差異：IoU JSON 用「大於或等於」、頁面正文用「大於」（頁面補充已說明）；部分頁面未寫 JSON 檔名（不影響數字）。
- 協調者合併涵蓋表（`tmp/textbook/merge-coverage.mjs`，備份 `tmp/textbook/guide-coverage.before-merge.csv`）：31 份 writer CSV 共 78 列，73 列進 `content/guide-coverage.csv`，取代全部 47 列舊表。規則：舊列的 sha256 都對不上現行頁面，審查已過期；writer 自評 complete 一律降 partial、reviewer 留白並註明待非作者複審（沿用 k-fold、roc-auc 先例）；被取代的舊列若有 reviewer，在新列備註「曾審舊版」；刪除 T14-G02 的 model-comparison 舊列與 T14-G03 的 unmapped 佔位列；IoU 3 列、overfitting g2／g3 共 5 列 topic_id 空白，不進表，等使用者決定。結果：已對應率 100%（44/44），審查完整率 0%（0/44，原 5/44 都是舊版審查）；T6 警告歸 0，全站 31 頁錯誤 0、警告 29（T3 試行）。
- C1 EXAMPLE-1 收尾：`L23303-C1-medical-small.json` 補 `splitter`（StratifiedKFold，3 摺，不洗牌），用 scikit-learn 實測驗證 ID 與 JSON 相同。
- 收尾驗收：`npm --prefix demo test` 191 通過；正式建置 `--force` 73 頁成功；常駐終端機「demo-preview（常駐，勿關）」重開於 4321；完整 smoke 結束碼 0（截圖在 `tmp/textbook/shots/final-smoke/`）。
- 2026-11-01 新 session（協調者 term_60657fd5）接手。派涵蓋表非作者複審三組：RV-COV-a ctx_bc6f26f2ff00（10 頁）、RV-COV-b ctx_1ef64a9d5549（7 頁）、RV-COV-c ctx_8721c1a26b92（12 頁），spec `tmp/textbook/specs/RV-COV-{a,b,c}.md`，結果寫 `tmp/textbook/rv-cov/`，由協調者合併並重算 sha256。同時派 advisor ctx_7731ec870974 審 5 項待決（`tmp/advisor/textbook-decisions-ask.md`）。
- 使用者核可 advisor 後的 4 項決定（4 題都選建議方案）：IoU 與 overfitting g2、g3 不新增主題、不計入本輪 44 個目標；D 組 4 頁等各自單元（underfitting、bias-variance-tradeoff 歸 L23302；regularization、dropout 歸 L23304）；關係表不顯示考題 ID（只改網站顯示）；科目 1 指引算指引內容，以原文教學深度為界。寫進 `docs/specs/textbook.md` v1.7 第 8 節第 5、7、8、9 條，`docs/specs/concept-relations.md` 第 6 節同步一句。
- RV-COV-a、b、c 驗收通過並關閉。三組都沒有事實錯誤。b 建議 `experiment-tracking.md` 讀資源紀錄一句改精確（「忙在記憶體搬移」），不屬錯誤，留待下輪修訂。
- 協調者合併複審（`tmp/textbook/merge-review.mjs --write`，備份 `tmp/textbook/guide-coverage.before-review.csv`）：73/73 列已審；現有引用判定 complete 30、partial 43；套用 33 列改引用後 complete 60、partial 13。再用 `tmp/textbook/lineref-to-anchor.mjs` 把剩下 10 列行號引用換成小節錨點（每列對照 reviewer 備註的小節名一致；ndcg 那列行號已漂移，改用 reviewer c 給的 4 個錨點）。行號引用 0 列，143 個錨點全部可解析。
- 檢查器結果：31 頁錯誤 0、警告 29（T3 試行）；已對應率 100%（44/44）；審查完整率 88.64%（39/44）。沒達到的 5 個目標（T01-G02、T02-G01、T16-G01、T16-G02、T17-G02）都已有主責頁的 complete 列；partial 13 列全是次要頁的支援映射。檢查器要求目標的每一列都 complete，比規格第 1 節嚴。徵詢 advisor ctx_7873fef99e3e（`tmp/advisor/coverage-metric-ask.md`），結果交使用者決定。
- 派 S1 ctx_91c090e5db64（Codex，spec `tmp/textbook/specs/S1-relation-sources.md`）：關係表隱藏考題 ID、移到考古題區；開關旁加說明；欄名由 Codex 判斷。
- 派速查頁：Q1 ctx_7811b9b60000（writer，`content/cheatsheets/L23303.md`，spec `tmp/textbook/specs/Q1-cheatsheet-content.md`）、Q2 ctx_99dc714e789c（前端，速查路由與檢查規則，spec `tmp/textbook/specs/Q2-cheatsheet-site.md`）。契約由協調者定：3 個固定二級標題（公式／指標怎麼選／診斷），每條連 `/concepts/<id>/#<錨點>`，補充用「（補充）」標在第一欄。
- S1 驗收通過（2026-11-01）：新增 `demo/src/lib/relation-sources.ts` 與 7 項測試；關係表「來源」只顯示指引頁碼，只有考題時顯示「見考古題區」；考題併入頁尾收合區並去重；欄名改「關鍵差異」；開關旁加「僅篩正文；頁首目標、關係表與檢核小題照常顯示。」。實測 13 個來源頁 17 條關係、連反向共 20 頁受影響；31 頁 21 表 36 列無考題資訊。3 題（114-2-S3-Q26、115-1-S3-Q02、115-1-S1-Q42）demo 題庫未收錄，頁尾標「題目尚未收錄」。dist 檢查待 Q1、Q2 完成後重跑 `tmp/textbook/s1/verify.mjs`。
- Q1 驗收通過（2026-11-01）：`content/cheatsheets/L23303.md` 公式 18、指標怎麼選 12、診斷 21 條，59 個連結涵蓋 30/30 頁；協調者重跑 check-links 錯誤 0、check-copy 0 片段、考題字樣 0。
- advisor 審查完整率意見（`tmp/advisor/coverage-metric.md`）推薦方案 1 加護欄，協調者同意，無分歧。使用者核可方案 1（2026-11-01）：目標至少一列 complete 且無 unmapped／mentioned 即算完整；13 列 partial 保留；73 列都須有效審查紀錄並核對版本雜湊。待 Q2 完成後派 worker 改檢查器、README、測試，協調者改規格。
- Q2 驗收通過（2026-11-01）：路由 `/codes/<code>/cheatsheet/`，入口在學習路線頁摘要下方；契約錨點在速查輸出時正規化為 Astro 實際 slug（Astro 會把部分空白留成 `-`），找不到或不唯一就中止建置；新規則 T10 含正反 fixture 與 6 項測試。協調者重跑：204 測試、74 頁建置、31 概念頁＋1 速查 0 錯誤 29 警告；59 個正式連結逐一點擊比對通過（`tmp/textbook/q2/real-verification.json`）。S1 dist 檢查在正式建置上重跑：違規 0。
- 規格 v1.8：第 8 節第 10 條寫新算法（有效審查＝reviewer＋雜湊等於現頁；審查完整＝至少一列有效 complete、無 unmapped／mentioned、全部列審查有效），T6 改寫，補記 T9、T10。13 列 partial 的 review_note 加「（支援列：…完整證據在 X 的 complete 列。）」（`tmp/textbook/annotate-partial.mjs`，備份 `tmp/textbook/guide-coverage.before-annotate.csv`）。舊算法結果 39/44（88.64%）。
- 派 C1 ctx_18cb796ba080（檢查器改新算法，spec `tmp/textbook/specs/C1-coverage-metric.md`）。
- C1（ctx_18cb796ba080）派工時提示詞未送出，2026-11-01 下午新 session 補按 Enter 後開工。驗收通過並關閉：改 `coverage.mjs`、`index.mjs`（讀原始位元組算 sha256 傳入）、測試新增 16 案、`coverage-pass.csv` 換成真實雜湊、README 寫新算法並保留舊算法 39/44 一句。協調者重跑：220 測試通過；`--force` 建置 74 頁；檢查器錯誤 0、警告 29（T3）；已對應率 44/44、審查完整率 44/44、映射列審查 73/73 有效（complete 60、partial 13）。雜湊護欄在副本實測：改 1 字後審查完整掉到 42/44，出 2 則重審警告（`tmp/textbook/c1/hash-guard.json`）。
