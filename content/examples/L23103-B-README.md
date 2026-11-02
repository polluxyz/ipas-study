# L23103-B 共用損失算例

`L23103-B-losses.json` 全為教學合成資料。房價六筆與醫療風險六筆各保留固定索引 0–5，所有頁面重算同一預測，不另切資料、不擬合模型。種子固定為 23103；目前所有運算都是確定性核算，不需要抽樣。

- `housing.actual`、`prediction`：單位百萬元，殘差固定為實際值減預測值，依序為 −1、0、1、2、3、10。
- `medical.label`：1 為需進一步檢查，0 為不需；`probability` 是預測正類機率。`continuous_target` 是另一個連續風險目標，只供迴歸換景，不能當成二元標籤。
- `medical.cost`、`finance_cost`：漏報、誤報與正確決策的假設成本，單位皆為教學成本點。兩領域成本不可當實務政策。
- `pairs`：二維嵌入向量與相似標籤，1 是相似，0 是不相似，margin 為 1。P01 與 P02 的幾何相同但監督目標不同。
- `medical.ranking_pairs`：較優先樣本索引在前；沿用醫療機率作教學排序分數，分數差不等於機率差的校準品質。
- `medical.reconstruction_*`：兩個標準化生理特徵的輸入與重建值，不是機率；同維度逐項比較。
- `multiclass`：三類機率、one-hot 標籤與零起算索引。`huber_probe_residuals`、`focal`、`plot` 固定邊界驗算及繪圖範圍。

關鍵值：房價平方誤差總和 115、絕對誤差總和 17、δ=1 的 Huber 總和 14.5，平均各為 19.166667、2.833333、2.416667。三個配對損失為 0.04、0.64、0；三類交叉熵為 −ln(0.7)=0.356675。重建均方誤差為 0.5。

五頁都使用本檔：`cost-sensitive-loss` 看成本與加權二元分類；`huber-loss` 看連續誤差；`cross-entropy-loss` 看同一醫療機率及三類範例；`contrastive-loss` 看配對與同機率的 Focal 核算；`ranking-reconstruction-loss` 看固定排序對與重建向量。

圖由 `tmp/rollout/groups/W-L23103-B/figure-scripts/generate.mjs` 讀本 JSON 產生；重建命令為 `node tmp/rollout/groups/W-L23103-B/figure-scripts/generate.mjs`。該腳本及完整獨立核算記錄隨工作報告交協調者保留，沒有另建圖表 schema。
