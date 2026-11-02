# L23201-A 共用例子

本組 7 頁使用客服郵件與設備紀錄各 120 筆教學合成資料，非真實觀測、因果關係或效能基準。資料不沿用前置組的數字；只承接其每列一筆、每欄一特徵的表示方式。

## 欄位與固定規則

- `index`：0～119 的固定樣本索引；兩領域共用索引、種子與切分。
- `features`：郵件依序為急迫詞、退款詞次數；設備依序為溫度 °C、振動 mm/s。
- `class_label`：郵件 0 一般、1 優先；設備 0 正常、1 需檢修。供完整監督範例使用。
- `numeric_target`：郵件為回覆分鐘，設備為剩餘運作小時；與分類目標分開儲存。
- `split`：固定訓練 72、驗證 24、測試 24；三者不重疊，合起來涵蓋 120 筆。
- `seed_labeled_indices`：72 筆訓練索引每隔 3 筆取一筆，共 24 筆；人工標籤預算的教學設定。
- `unlabeled_train_view`：其餘 48 筆訓練樣本只保留索引與特徵；`all_unlabeled_view` 則為完整 120 筆的無標籤視圖。兩者都不含目標。

對索引 i，先令 u=i%12、v=i//12。郵件特徵為 [u,v]；設備為 [40+5u,0.2v]。類別原由 u+v≥10 決定，再對 i 是 19 的倍數者翻轉，刻意加入 7 筆規則外變異；這不是實際標籤錯誤率。

兩領域在每個索引的類別編碼完全相同；設備特徵只是郵件座標換單位與平移，沒有增加分類資訊。網格安排方便手算，不能代表真實資料分布。

回覆分鐘是 5+2u+3v，剩餘小時是 240−4u−6v。兩領域皆不把這個數值目標拿來當分類輸入。數值目標只是用於辨別任務，未據此宣稱真實預測能力。

切分使用 `np.random.default_rng(42).permutation(120)`：前 72、接續 24、末 24。此處沒有時間與群組相依；實務有相依時須換合適的切分方式。

## 關鍵參考數值

| 項目 | 參考值 |
|---|---|
| 全部類別數量 | 0：56；1：64 |
| 郵件索引 27、99、88 | [3,2]、[3,8]、[4,7]；分鐘 17、35、34 |
| 設備索引 27、99 | [55,0.4]、[55,1.6]；小時 216、180 |
| 郵件 27→99 距離 | 6；設備原距離 1.2，依 [5,0.2] 縮放後為 6 |
| 三模型訓練／驗證答對數 | 線性 67/72、22/24；樹深3為65/72、18/24；網路69/72、20/24 |
| 半監督自動流程 | 24 人工；第 1、2 輪加入 28、6 筆偽標籤，共 34 筆；14 仍未知；基準與半監督驗證同為 21/24 |

完整核算與 Python 版本記錄位於本組 `tmp/rollout/groups/W-L23201-A/examples-check.md`，不把數字寫進全站衍生 CSV。

## 使用頁面與圖

- `learning-paradigms`：同資料切換監督訊息；強化式情境另外需要互動紀錄。
- `feature-space`：兩領域座標、維度、原始／縮放距離；`l23201-feature-space-mail`。
- `classification-regression`：同一筆資料選不同目標。
- `supervised-learning`：配對表、監督流程與標籤品質。
- `supervised-learning-workflow`：72/24/24 資料角色、驗證回饋；`l23201-supervised-learning-workflow-dataflow`。
- `hypothesis-space`：相同索引的三模型邊界與比較；`l23201-hypothesis-space-boundaries`。
- `semi-supervised-learning`：24 有標籤／48 未標籤訓練視圖；`l23201-semi-supervised-learning-label-flow`。

目前數據圖由 `figure-scripts/rebuild_reviewed_figures.py` 直接讀取 JSON 產生；初版例子入口 `build_examples.py` 也委派給此腳本重畫。流程圖由 `figure-scripts/build_flows.cjs` 讀 JSON 筆數產生。腳本均位於 `tmp/rollout/groups/W-L23201-A/`，不修改圖表 schema 或網站程式。
