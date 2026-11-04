# 17頁學習入口補齊提案

狀態：2026-11-04 已授權正式整合，採 C17。
使用者指示：「先幫我將目前所有東西都弄到正式版 我要看完整的網頁」。
Root 依既有推薦採 C17，授權補齊固定 17 個閱讀例外。
固定名單由 8 增為 25，題目維持 354 題。
模擬題維持 84 題，不採 B17 新增題目。
本提案的假設：保留原354題與每代碼4題的84題配額。
6個既有題目標籤修正已由PR114合併。
整合候選為485概念、21單元、582關係、354題。
強入口缺口24，其中7個位於原固定8頁名單。
另外17頁已有明確目的路線及頁內檢核，尚缺題庫入口。
這17頁已獲固定名單核可，逐頁驗收仍須另行完成。

## 選項及推薦

| 方案 | 題量與名單 | 代價 |
|---|---|---|
| C17：精確閱讀例外（建議） | 題目維持354題、模擬題84題；固定名單8→25頁 | 17頁仍無獨立題庫練習，只能稱閱讀入口。每頁來源、目的及真渲染須非作者同版複審。 |
| B17：新增17題原創練習 | 模擬題84→101、總題354→371；固定例外仍8頁 | 要調整每代碼4題條件。新增來源實讀、唯一答案、逐題主審及計算核算。 |

advisor與協調者均推薦C17，本輪按此方案實作。
理由是保留原題量平衡，並使用已存在的有目的路線。
協調者另核17頁都已有頁內檢核。
這些檢核不因此升格成一般強入口。
B17仍可增加獨立題庫練習，但不屬目前核可題量。
沒有選項可以透過假前置、背景標籤或任意比較消除缺口。

## C17的精確範圍

只允許下列17個既有ID新增例外。
原8個ID保持不變，名單不可自動擴張。

| 既有概念ID | 既有單元路線 | 轉讀目的 |
|---|---|---|
| color-space-conversion | /codes/L21102/#stage-prepare-images | 依顏色線索需求選 RGB、灰階或 HSV |
| data-consistency | /codes/L21301/#stage-prepare-inputs | 判斷得出合法新事件與重送，選出正確的去重鍵 |
| data-types-time-parsing | /codes/L23301/#stage-inspect-and-record | 判斷得出數值及日期的解析失敗與時間差 |
| feedback-loop | /codes/L21302/#stage-monitor-and-improve | 判斷得出回報、成熟真值與可用訓練素材的差別 |
| financial-regulatory-sandbox | /codes/L21203/#stage-sector-and-license-review | 說得出受控實驗的申請、範圍與評估前提 |
| generative-quality-metrics | /codes/L23203/#stage-reconstruction-and-generation | 說得出 IS、FID 的方向及不能證明的品質 |
| high-availability | /codes/L21302/#stage-service-capacity | 說得出單點故障如何經偵測、備援與導流處理 |
| image-resizing | /codes/L21102/#stage-prepare-images | 依尺寸限制選縮放、裁切或補邊並核對座標 |
| machine-translation | /codes/L21101/#stage-task-outputs | 判斷得出專業術語錯譯及需人工覆核的內容 |
| medical-device-regulation | /codes/L21203/#stage-sector-and-license-review | 說得出醫療 AI 用途、風險與上市查核項目 |
| privacy-regulations | /codes/L21203/#stage-privacy-foundations | 說得出法域、適用範圍與跨境條件的查核差別 |
| scrum | /codes/L21202/#stage-work-and-schedule | 將需求排序、短衝活動與完成增量對到責任 |
| speech-recognition-pipeline | /codes/L21103/#stage-speech-delivery-and-evaluation | 判斷得出 ASR、理解、任務與 TTS 的錯誤位置 |
| telecom-regulation | /codes/L21203/#stage-sector-and-license-review | 說得出通訊服務的資安、資料與消保查核點 |
| video-frame-sampling | /codes/L21102/#stage-prepare-images | 依事件持續時間比較取樣間隔與漏失風險 |
| virginia-cdpa | /codes/L21203/#stage-personal-data-rights | 判斷得出州別、適用條件與敏感資料待查事項 |
| visual-tracking | /codes/L21102/#stage-vision-systems | 說明追蹤訊號如何接互動及失去追蹤的後果 |

feedback-loop的所列入口對應g2素材辨識。
不能稱該入口已評量g1日、週、月節奏。
其他頁也只按所列閱讀目的驗收，不宣稱全部目標有題庫覆蓋。

## 結構及責任

C17沿用既有概念、題目、關係及例外證據格式。
本輪更新固定名單、既有例外資料及相關規格/fixture。
不新增概念ID、題目ID、關係類型或相依套件。
不更換網站技術，不改CI，不作外部部署。
writer不能自己當非作者主審。
Root負責最終同版建置、來源/產物綁定及既有預覽更新。

## 可觀察成功條件

1. C17只能新增本表17ID，固定上限恰25。
2. 每頁固定目標/來源原始SHA、stage、目的、真href與建置產物SHA。
3. 非作者逐頁核學習目的及近鄰排除，同版主審後才生效。
4. 來源或目標改動即失效，重新驗證前不算通過。
5. 後來有合法題目或有類型關係，該頁回一般規則。
6. 不把搜尋、自動目錄、同名列舉或self_check當替代入口。
7. 原C12結構警告保留，與強缺口、上限、有效例外分列。
8. 當前潛在有效例外24，不是已驗收24；cyclic-time-features已有真題引用。
9. 原PDF/text、官方答案、穩定ID及既有例題保持不變。
10. strict/textbook/copy/tests/build與真建置桌面/手機檢查通過。

## B17備選的新題目標

若選B17，每頁各新增1題，沿用現有YAML格式及新ID規則。
既有354題的題幹、答案、ID、rev與審查狀態不改。
每題4選項與唯一可證答案，直接評量下列目標。

| 既有概念ID | 新練習目標 |
|---|---|
| color-space-conversion | 比較只看輪廓與必須分色的2個任務，選擇表示並辨識灰階化的資訊損失。 |
| data-consistency | 給訂單明細、重送日誌與同鍵異值，選觀察單位及需保留、合併或查證的列。 |
| data-types-time-parsing | 把識別碼、金額與含時區日期分型，算事件間隔並處理1筆無效日期。 |
| feedback-loop | 安排每日服務觀測、每週錯誤回收及每月重評，遇高風險事件另採即時處理。 |
| financial-regulatory-sandbox | 辨受控金融試驗的申請、核准範圍、資料保障及擴大試驗前的查核。 |
| generative-quality-metrics | 在固定特徵與前處理下比較IS/FID方向，識別分數無法證明同類多樣性與完整覆蓋。 |
| high-availability | 分析共同單點、備援容量、健康偵測及實際路由，判斷故障後能否繼續服務。 |
| image-resizing | 長條影像須送固定方形輸入，依完整保留與長寬比條件選縮放及補邊。 |
| machine-translation | 提供商務或行政原文與候選譯文，找出術語、否定及事件狀態錯誤，安排領域覆核。 |
| medical-device-regulation | 以預期用途、風險及用途變更決定需補查的醫材屬性、品質與上市證據。 |
| privacy-regulations | 將3種法規名稱與法域配對，並辨識PDPA必須寫明國家語境。 |
| scrum | 短衝中出現新需求與資料阻礙，分清價值排序、促成排障及實作計畫的責任。 |
| speech-recognition-pipeline | 從來電到文字回覆及朗讀，按中介結果找出ASR、理解、任務或TTS的責任。 |
| telecom-regulation | 從通信服務與資料流辨識資安、通信秘密及申訴補救的待查項目。 |
| video-frame-sampling | 給固定影格時間、短事件及輸入預算，比較取樣命中與動作資訊的限制。 |
| virginia-cdpa | 在明確州別、用途與適用假設下，辨識隱私告知、權利受理及敏感資料的待查條件。 |
| visual-tracking | 辨認AR實體疊圖及VR動作映射；追蹤失效時停止採用舊姿態觸發新互動。 |

法規及工具細節須實讀現行官方來源，不照抄本站補充。
Codex出題由Claude跨provider主審，計算題另獨立核算。
不得靠多貼背景標籤減少題數，或改舊84題來湊覆蓋。

## 邊界與核可

Always：真來源、真目的、同版證據、原資料保護、非作者主審。
Ask first：超出本輪C17名單、改採B17或變更題量。
Never：假邊、任意新增ID、改官方答案、弱化檢查器湊全綠。
核可依據為專案指引第10節決策門控及第15節偏離既有規格。
C17不代替3D大量整合或全站R0–R10簽收。
本輪作者只準備證據，不簽非作者主審及Root驗收。
