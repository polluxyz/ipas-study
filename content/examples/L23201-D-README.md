# L23201-D：探索、更新與控制

本組為教學合成資料，不代表實務成績。主例子有倉儲與儲能兩個領域，沿用前置組的狀態、動作、轉移機率與回饋；既有檔案未修改。

- `L23201-D-warehouse.json` 以 `base_file` 引用 `L23201-C-warehouse.json`。
- `L23201-D-energy.json` 以 `base_file` 引用 `L23201-C-energy.json`。

## 欄位與固定規則

- `seed=42` 承接前置組；此組主要作精確列舉及指定軌跡重播，程式沒有抽樣。
- `gamma=0.9` 與舊資料一致。`episodes[].transition_ids` 是原轉移表索引，依時間排列。
- 倉儲沿用A起點、最多五步、進D終止；能源E3起點，固定觀察三步，E0不是終止狀態。
- 倉儲的成功定義是交付到D；能源以三步內未進E0作教學用保留電量條件，不是實務供電可靠度標準。
- `q_snapshot` 是未訓練的示範舊值。`q_update` 指定一次觀察到的轉移與學習率，不抽樣、不連續寫回其他算例。
- `epsilon=0.2` 用於ε-greedy；探索從全部合法動作均勻選。最大Q值並列時均分利用機率。
- `policy_comparison` 是同狀態的舊、新機率及給定優勢。新策略不是宣稱一次PPO實跑的結果；優勢不由Q快照推導。
- `clip_epsilon=0.2` 僅屬PPO裁剪參數，和探索機率用途不同。
- `evaluation_policy` 是三步期望核算的固定確定性策略；`fixed_policy_horizon=3`。

## 關鍵參考數值

| 核對項目 | 倉儲 | 儲能 |
|---|---|---|
| 指定軌跡折扣回報 | 交付6.2；重複-4.0951 | 耗盡2.74；保留5.44 |
| 一次Q更新 | B抓取：1→1.8，目標2.6 | E2充電：1→1.3，目標1.6 |
| 固定策略三步期望 | 2.42216 | 4.25408 |
| PPO正／負優勢貢獻 | 2.4／-1.6 | 2.4／-1.6 |

倉儲C的Q值4與2，唯一最佳動作的ε-greedy機率0.9，另一動作0.1。指定兩段倉儲軌跡的平均未折扣報酬1.5、折扣平均1.05245、成功比例50%；只供驗算，不是泛化成績。

## 使用頁面與圖

五頁都使用這兩份擴充資料：`exploration-exploitation`、`reinforcement-learning-control`、`reinforcement-learning-training`、`q-learning-dqn`、`policy-gradient-ppo`。

以下三圖由 `tmp/rollout/groups/W-L23201-D/figure-scripts/build-figures.mjs` 從JSON生成，未手填計算結果：

- `l23201-exploration-exploitation-probability`
- `l23201-q-learning-dqn-value-update`
- `l23201-policy-gradient-ppo-policy-update`

同一腳本另產生動作空間與訓練循環兩張示意圖。獨立驗算與各頁程式輸出見本組工作目錄的 `examples-check.md` 與 `run-code-*.md`。
