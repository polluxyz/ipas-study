# L23203-C 框架與資源的共用例子

`L23203-C-frameworks.json` 為教學合成資料，客服與製造各 18 筆，不用來推論真實模型品質。

- `seed=23203`；兩領域均以索引 0–11 訓練、12–14 驗證、15–17 測試。每份切分均包含三類；框架頁不重新洗牌。
- `service.rows`：`x` 為四維示意向量，前三維用 `index % 3` 決定，第四維為 `floor(index/3)/5`。`label` 是查詢／退款／變更的整數 0／1／2，`one_hot` 是同一標籤的獨熱向量。
- 客服標籤與前三維同由 `index % 3` 決定，可從特徵直接讀出標籤；只用來核對形狀與流程，不用來估計模型的真實能力。
- `manufacturing.rows`：`pixels` 為 8×8×3，值為 `(row+column+index+channel)%8/7`，排列為 NHWC；不是實拍影像。`label` 是正常／刮痕／缺角索引，與合成紋理不保證有可學關係。
- `dense_layers`：4→5→3，兩層均有偏置，隱藏層用 ReLU，輸出層留 logits。Keras 與 PyTorch 共用資料與架構，但初始化演算法不同，種子相同不代表權重相同，不比較兩者損失高低。
- `vision_layers`：3×3、3→2 通道、stride 1、無 padding、groups 1，輸出 6×6×2；展平 72 維接 3 類 Dense。Keras 用 NHWC，PyTorch 先換成 NCHW。
- `contract_probe` 沿用前置組 `L23203-B-activations.json` 客服第一筆的 logits 與整數標籤。前置檔在該組 worktree 唯讀核對；本組新增的是明列來源的契約測試欄，未複製前置檔或其 24 筆資料。該組的索引及切分不等於本組的 18 筆資料。
- `resource`：批次 4、FP32 每值 4 bytes、1 MAC 算 2 FLOPs；僅計權重乘加，排除偏置加法、激活、損失、資料搬移與反向運算。

關鍵值：Dense 參數 25＋18＝43，MAC 20＋15＝35／筆；影像參數 56＋219＝275，MAC 1944＋216＝2160／張。影像網路 FP32 權重 1100 bytes；權重、梯度、Adam 一二階矩合計 4400 bytes（不含 step scalar 與激活等）。

使用頁：output-loss-contract、keras、pytorch、tensorflow、deep-learning-framework-landscape、model-resource-costs。生成規則與核算紀錄在本組 `tmp/rollout/groups/W-L23203-C/`；程式由 `IPAS_REPO_ROOT` 讀取本檔。
