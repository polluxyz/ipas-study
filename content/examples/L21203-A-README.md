# L21203-A 共用風險例子

全部為教學合成情境，不代表銀行、醫院或工廠實際風險估計。主資料是授信 C1–C6 與製造 M1–M6 共12個事件，臨床 H1 僅作人工接手的換景案例。

- probability：同一範圍接下來30日至少發生一次的假設機率；likelihood：映射後1–3序位；impact：權益、安全、業務等最嚴重後果的1–3序位。
- owner：措施執行人；approver：放行或接受殘餘風險的核准人；affected：受影響群體。intervention、due、trigger、followup 分別是可介入時點、期限、重評條件與回報節奏。
- budget、control_cost、contract 中金額單位為萬元。控制後 residual 只是假設驗證完成的結果，未完成措施不可先用較低分數。
- probability 的低級為不超過10%，中級為超過10%至20%，高級為超過20%。score=likelihood×impact；1–2低、3–4中、6–9高；衝擊3或法律不允許另升級。這不是官方固定切點。
- C5已取消該路徑，residual各數值為null，不把它畫成低機率1分；既有資料與替代路徑仍需另外評估。
- 固定索引，不做切分或抽樣，seed與split皆為null；所有頁面、圖、查核共用這份JSON。

## 關鍵參考數值

C1控制前6、完成後假設4；C2與C5控制前皆6；C4與M4皆9；M5為4且單純保險不改事件分數；M5損失10、自負1、上限6，賠6、自留4。

授信品質盤點：100件中缺收入12、青年10而預定40、錯標4；問題可重疊，不相加。第1週缺收入仍6/100，超過5%門檻，不能結案。製造100件中缺值8、罕見瑕疵5而預定20、錯標3；新材料漏判7/100超過5%。

授信覆核15分鐘/件，每小時能處理4件，進件6件；每小時至少積壓2件（未計休息），不能宣稱人工覆核已充分。臨床決策2分鐘、覆核需5分鐘，必須另走既有急救流程。

## 用到的頁面

七頁皆引用本資料：ai-risk-governance、model-stability-risk、risk-matrix、responsible-ai-principles、nist-ai-rmf、human-in-the-loop、risk-response-strategies。風險矩陣SVG由figure-scripts/generate.mjs讀取此檔生成；治理、NIST、人工接手與四策略圖為流程示意。
