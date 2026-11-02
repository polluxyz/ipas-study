# L21104-A 共用圖文資料

全部是教學合成資料，包含零售與製造各 12 對。沒有下載模型或真實照片，三維向量不代表真實 CLIP 的維度或效能。

- `pair_id` 識別同一圖文對；`positive_text_id`、`negative_text_ids` 表示正、負配對。負配對是教學假設，實務可能遇到另一個也適切的描述。
- `image_vector`、`text_vector` 用來計算餘弦相似度；候選標籤與 `prompt`、`vector` 位於 `candidates`。每領域三組矩陣索引為 0–2、3–5、9–11。矩陣由腳本計算，不儲存手填結果。
- `split` 固定前 6／中 3／後 3 筆；`seed=42` 控制一般樣本遮罩，R01、M01 固定遮住圖塊索引 1、3 與詞元索引 2。索引一律從 0 起算。
- `image_patches` 是四個 2×2 灰階教學圖塊；`text_tokens` 是四個教學詞元。遮罩目標留在原資料，送入編碼器的輸入不得包含目標值。
- `needs_review` 的 1 代表需複核；`branch_review_probability` 為兩分支對同一正類的假設機率，融合權重 0.6、0.4，分數 ≥ 0.5 判需複核。它與商品候選分類不同。

關鍵數值：首組餘弦矩陣為 [[0.8,0,0.6],[0.6,0.8,0],[0,0.6,0.8]]；R01 與 M01 正配對均 0.8。R01 的複核融合為 0.6，串接兩個三維向量長度為 6。

使用頁：multimodal-ai、cross-modal-alignment、multimodal-fusion、clip、masked-multimodal-pretraining、vision-language-models。核算與其他矩陣見本組 examples-check.md，圖可由 figure-scripts/generate.mjs 重建。
