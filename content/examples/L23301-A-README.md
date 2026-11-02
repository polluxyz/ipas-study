# L23301-A：缺值處理共用例子

`L23301-A-missing-data.json` 是製造與零售各32筆的教學合成資料，沒有真實個資。四頁共同使用：data-preparation、missingness-mechanisms、missing-value-imputation、advanced-imputation。

## 欄位與固定規則

- `index` 是0起算的固定列索引；`id` 是唯一列識別。`time` 為含時區的逐小時時間，不能把ID當連續測量值。
- `split.train` 固定0–23；`split.validation` 固定24–31；種子23301。所有方法使用相同列與切分，不重抽有利樣本。
- `observed.value`：製造的溫度temp（°C）、零售的金額amount（元）；零售值為製造數值10倍。`observed.aux`：製造的pressure（bar）、零售的basket_score（教學分數），兩域均完整可用。
- `observed.category` 是名目型A/B；A/B不可取算術平均。`sparse_note` 只用來展示整欄刪除，與主數值欄獨立判斷。
- `capture_window` 是已觀測的蒐集時段類別；每6筆的後2筆為maintenance，這兩筆數值未入庫。它只是記錄缺失原因，主補值模型限定使用aux，避免直接帶入人工規則。
- `truth` 是教學生成時保留的真值；`missing_reason` 是事後核算註記；`target` 是溫度45°C以上／金額450元以上的示範標籤。三者都不得當補值輸入，驗證真值只供算補值誤差。
- `field_types` 保留欄位型態。JSON null表示缺值，不表示0；value與aux為連續數值，time為datetime，id為identifier。

## 生成方式與小例

訓練列每6筆重複真值10、20、30、80、25、45；後兩筆遮住。驗證列在相同規則上加20。製造原始單位修正與零售千分位解析存於`quality_fixture`；主表的observed已是統一單位後的資料，不是原始字串。

`mechanism_scenarios` 是同一真值欄的三種替代遮罩，不能將三種遮罩同時套進主表。MCAR只依種子抽8筆；MAR依已記錄capture_window；MNAR依未觀測真值超量程。MNAR情境特別設定`aux_available=false`，不提供能精準還原value的輔助欄，以免給定完整aux後其實已符合MAR。主表採MAR遮罩，生成規則已知不代表實務可由缺值外觀辨認機制。

`time_series` 是獨立的等間隔5分鐘小例，不是主表前5列：真值10、20、30、40、50；觀測10、缺、缺、40、缺。前填／後填／插值均使用這一條序列；插值只補內部缺口，最後一點不外插。

## 關鍵參考數值

- 製造訓練：24列、數值缺8列；已觀測16筆總和560，均值35°C、中位數25°C。類別觀測20筆，A有12、B有8，眾數A；備註缺18列。
- 零售訓練：均值350元、中位數250元。變異隨倍數平方放大，不是乘10。
- 製造已觀測母體式變異725°C²；均值填補後24筆為483.333333°C²。六筆小例的樣本式變異由2900/3降至2900/5；真值本身的變異為516.666667°C²。
- 驗證缺值列索引28、29：製造真值45、65；均值補35、35，缺口MAE20；中位數補25、25，MAE30；KNN（uniform、k=8）補25、55，MAE15；線性模型補45、65，MAE0。
- 刪除法保留驗證6/8列，不能與保留全部8列的方法只比一個誤差。表中的MAE僅對共同的2個人工缺口核算；刪除法在這2列無結果。
- 故意錯誤的全表fit：22個已觀測值總和850，均值38.636364；正確訓練fit為560/16=35。

## 重建與核算

生成資料和六張SVG：`tmp/rollout/groups/W-L23301-A/figure-scripts/build_examples.py`。獨立核算、方法比較與版本記錄在同資料夾的`examples-check.md`；程式區塊保留與JSON相同的最小陣列，方便在隔離暫存目錄執行，不依賴機器絕對路徑。

## 修正後新增的核算

- 單位錯置沿用主表M01–M04與`quality_fixture`，不另編溫度：漏轉176°F使四筆平均由35°C升到59°C，差24°C。
- 以`mechanism_scenarios`的MCAR與MNAR替代遮罩核算32筆真值：完整均值38.75°C；刪列後分別為36.875°C、24°C，與完整均值差−1.875°C、−14.75°C。替代情境只做機制比較，不改主表或原切分。
- `L23301-A-distance-scale.json`另存製造領域的兩供體尺度小例，供advanced-imputation使用。壓力、維護費是距離輸入，溫度不參與距離；固定單位尺度1bar、1000元使平方距離由250001／4變成1.25／4，最近供體由乙改為甲。
- 上述三項皆由`tmp/rollout/groups/W-L23301-A/check_examples.py`直接讀JSON重算；公式審查狀態亦由目前frontmatter讀取，避免報告留著舊的pending記錄。
