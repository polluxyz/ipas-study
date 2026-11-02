# L23301-C 共用例子

`L23301-C-transport-retail.json` 是教學合成資料，含交通旅次、零售曝光各28筆。五頁均用相同列順序，不能為了某個方法另切容易的驗證列。

- `split.train`：索引0–19；`split.validation`：20–27，皆從0起算。
- `inner_folds`：四組各5列，每組輪流留出；其餘15列估計目標編碼。
- `random_state=42`是本組的共用種子；這份表與分割直接列舉，不依賴亂數生成。
- 時間欄僅為示例識別資訊，未拿來估計時間效果；本組假設樣本獨立。若同一旅客、使用者重複出現或要預測未來，須另採群組或時間切分。

| 欄位 | 領域／單位 | 固定規則 |
|---|---|---|
| distance、fare | 交通／公里、元 | 訓練距離0–8及64各重複2次；fare=50+10×distance |
| comfort_score | 交通／分 | 正值、左右對稱的反例欄位；不是標籤 |
| sales、price | 零售／件、元 | 訓練sales為2的0–9次方減1，各重複2次；price=10×(1+distance) |
| net_units | 零售／件 | 含負值與0，用於檢查轉換定義域 |
| vehicle_class、store_tier | 兩領域／有序類別 | 基本＜進階＜尊榮，索引20出現未知「企業」 |
| route、ad_source | 兩領域／無序類別 | 訓練頻數8、6、5、1；驗證含未見過的環線／新平台 |

`product_type`是無序商品類型，三類為飲品、食品、日用品，索引20出現未知「服務」。`late`與`converted`為二元標籤，1分別表示延誤、購買轉換；`constant=7`是常數欄。`id/index/date/hour/weekday`不作本組模型輸入。

## 關鍵核對數字

- 交通訓練distance：平均10、母體式標準差√330≈18.165902、中位數4.5、Q1=2、Q3=7、IQR=5；分位數採NumPy預設線性插值。
- 零售訓練price：平均110、標準差10√330、中位數55、IQR=50；線性單位轉換後三種縮放與distance相同。
- 零售廣告來源：搜尋4/8、社群2/6、郵件1/5、小站1/1；全訓練轉換率8/20=0.4。
- 平滑權重α=2：搜尋0.48、小站0.6、驗證未知來源回退0.4；第4內摺留出R20時，來源摺先驗5/15=1/3，所以R20折外值為1/3。
- 交通路線延誤：東線2/8、西線3/6、南線3/5、山線1/1，訓練先驗9/20=0.45。
- 詞彙表四詞；加入「退貨」並重建表示後維度4→5。舊模型推論不能臨時加欄。
- 高基數假設：10,000列×5,000類×4 bytes=200,000,000 bytes，為float32稠密值本體，不含索引及其他開銷。

## 使用頁面與重建

- `feature-scaling`：distance、price、constant、zero_iqr、pixel_values。
- `power-transforms`：distance、comfort_score、sales、net_units。
- `categorical-encoding`：vehicle_class、store_tier、product_type及教育順序。
- `one-hot-encoding`：product_type、route、ad_source、四詞詞彙表及成本情境。
- `target-encoding`：ad_source/converted與route/late、外層索引及內層折。

資料建立腳本：`tmp/rollout/groups/W-L23301-C/make-examples.mjs`。數據圖重建腳本：`tmp/rollout/groups/W-L23301-C/figure-scripts/distributions.mjs`。核算紀錄：同資料夾的`examples-check.md`，由協調者接收整個工作資料夾。
