# 固定25頁閱讀入口例外

2026-11-03，使用者在確認8頁例外與CSV匯出格式後回覆「核可」。本規格落實該提案，不代表8頁已驗收完成。

2026-11-04，使用者要求將目前內容整合到正式版。
原話：「先幫我將目前所有東西都弄到正式版 我要看完整的網頁」。
Root 按既有推薦採 C17，新增下列固定17個ID。
固定上限由8增為25，保留354題及84模擬題。
沿用版本1的證據格式，不以核可代替同版逐頁驗收。

## 固定範圍與目的

| ID | 入口的學習目的 |
|---|---|
| ai-team-capability | 導入評估後盤點推動與維護能力 |
| cyclic-time-features | 日曆欄位需要保留首尾相鄰 |
| multimodal-privacy-security | 人臉應用接續敏感資料保護 |
| ndcg | 推薦任務區分排序品質與收益 |
| open-weight-models | 選模型後查部署與授權條件 |
| text-generation-platforms | 選工具前分清模型與產品 |
| development-toolchain | 先懂工具分工，再追蹤實驗 |
| text-generation-workflow | 安排來源、草稿與人工驗收 |
| color-space-conversion | 依顏色線索需求選 RGB、灰階或 HSV |
| data-consistency | 區分新事件與重送，選正確去重鍵 |
| data-types-time-parsing | 辨認數值、日期解析失敗及時間差 |
| feedback-loop | 區分回報、成熟真值及可用訓練素材；對應g2 |
| financial-regulatory-sandbox | 確認受控實驗的申請、範圍與評估前提 |
| generative-quality-metrics | 判讀 IS、FID 方向及不能證明的品質 |
| high-availability | 串起單點故障的偵測、備援與導流 |
| image-resizing | 依尺寸選縮放、裁切或補邊並核座標 |
| machine-translation | 辨認術語錯譯及人工覆核條件 |
| medical-device-regulation | 列出醫療 AI 用途、風險與上市待查項目 |
| privacy-regulations | 區分法域、適用範圍及跨境查核 |
| scrum | 將需求排序、短衝活動及完成增量對到責任 |
| speech-recognition-pipeline | 定位 ASR、理解、任務及 TTS 的錯誤 |
| telecom-regulation | 列出通訊服務的資安、資料與消保查核點 |
| video-frame-sampling | 比較事件持續時間、取樣間隔與漏失風險 |
| virginia-cdpa | 確認州別、適用條件與敏感資料待查事項 |
| visual-tracking | 說明追蹤訊號如何接互動及失效後果 |

一般規則仍要求題目引用或進出有類型關係。只對上述25個固定ID，允許另一個已整合、實際渲染且有明確目的的概念正文或代碼學習路線入口替代。
搜尋、自動目錄、品牌列舉、來源名稱、同名誤連、頁內self_check不能替代。不得補假關係或新題目來降低數字。

## 每頁的證據與失效條件

保留目標與入口來源的完整SHA、指引或已核可範圍的依據、題目及5型關係的近鄰排除理由、實際href、來源段落／stage與轉讀目的。
非作者獨立複審同一版。協調者另驗真實渲染及整合，最終commit由當次執行報告記錄，避免在版控資料內建立自我雜湊循環。
實作以 `docs/acceptance/concept-entry-exceptions.json` 保存固定證據，以 `demo/scripts/check-concept-entries.mjs` 驗證來源及建置產物。教學目的與近鄰排除仍須人工主審，工具不能取代語意審查。
入口或目標內容變更時重新核對。後來有合法題目引用或有類型關係，就回到一般規則，該頁例外不再生效。清單不能自動擴張。

每次分列：C12原始結構警告、原強條件缺口、核可上限、當版有效例外、尚未豁免缺口。不得把原始8頁缺口改報0；其他成功條件仍須驗收。

本輪來源基準為b976e857的完整值，以作者報告記錄。
原C12的8頁警告仍分列，不能報成強缺口歸零。
當版強缺口24，原名單7頁與新增17頁各自驗證。
cyclic-time-features已有合法題目引用，回一般規則。
該ID仍留在固定25名單，不列入有效例外數。
feedback-loop採已校準的g2素材辨識目的。
不把該入口誤稱為評量g1的日、週、月節奏。

## 界線與測試

- Always：保留原8頁證據及固定25頁真實來源；逐頁核對來源SHA、目標SHA、stage／正文與實際href；同版非作者複審。
- Ask first：增加ID、更換例外條件、改資料格式或關係種類、用新題目補缺口。
- Never：補假關係、把自動列表當教學入口、把核可當作逐頁已驗證、抹掉原始缺口。

正反fixture需涵蓋真入口、來源或目標變更、缺href、無學習目的、自動列表、未知或重複例外ID。新增合法題目／關係時必須回一般規則。實測當前全站，逐頁保存同版來源與實際渲染；完整QA與非作者審查通過後才合併。
