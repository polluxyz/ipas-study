# L23402-A 共用案例

招聘 recruitment、信貸 credit 各 40 筆教學合成資料，兩群各 20 筆；群名只為比較，不代表固定優勢或特定人口。8 頁共用同一索引、固定稽核集、閾值 0.5 與延伸種子 23402，不把這 40 筆當作訓練資料。

- record_id、group：領域內唯一識別與稽核群體。y_true 是教學規準下的資格，不是歷史決策；score 是示意分數，不宣稱校準機率。y_pred 由 score >= 0.5 產生。
- source、annotator、language、image_quality：來源追溯及分層診斷用，不視為群體差距的已證明原因。語言與畫質刻意跨兩群出現，禁止由相關性直接推因果。
- training_sample：用來獨立示範訓練來源的覆蓋偏差，A 16/B 4；母體為全 40 筆 A 20/B 20。未據此訓練任何模型。
- historical_decision、revised_decision：假設制度前後的決策，非 y_true。A 前後核准 8；B 從 4 到 8。修訂制度先按共同資格規準篩選，再依本例每群 8 人的名額與固定索引核准；每群另有 2 位具資格者未獲名額。
- redistributed_pred：同一批人的另一假想模型，總體準確率同為 70%，A/B 準確率從 80%/60% 變為 90%/50%。
- parity_only_pred：另一假想模型，兩群選取率都是 50%，TPR 80%/60%，FPR 20%/40%；只用作統計均等反例。
- label_cases：4 個獨立標註微案例；historical_label 為舊制度記錄，兩位標註者與 criterion_label 是不同欄位，不覆寫稽核集真值。L1／L2／L4 在招聘檔判職務資格、信貸檔判教學還款能力；L3 在兩檔均判語句情感，1 代表正向而非申請資格。
- visual_cases：4 個獨立影像診斷微案例；含膚色、年齡、光照、角度、解析度與分歧，不能當成人臉辨識實驗結果。

參考數值：A TP8/FN2/FP2/TN8；B TP8/FN2/FP6/TN4。選取率 0.5/0.7；TPR 0.8/0.8；FPR 0.2/0.6；準確率 0.8/0.6。統計均等有向差 A−B 為 −0.2（負 20 個百分點），指定 B 參照的比值 5/7 約 0.714286；交換方向為 1.4。

algorithmic-bias 用來源與模型反例；historical-bias 用制度欄；sampling-bias 用來源覆蓋；label-bias 用標註微案例；4 個指標頁用相同 40 筆。正文程式以本檔固定規則重建必要欄位，以便複製即跑；獨立核算腳本逐筆對照 JSON。圖由暫存資料夾 figure-scripts/build-figures.mjs 讀 JSON 重建。
