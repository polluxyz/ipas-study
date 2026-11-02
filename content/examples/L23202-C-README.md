# L23202-C 共用教學資料

本例是合成教材，不是實際顧客或設備紀錄。唯一資料檔是 L23202-C-shared.json；本組未修改其他例子。

| 欄位 | 意義 |
|---|---|
| seed | 42；資料、模型與切分設定均固定 |
| domains.retail.raw | 120×3：平滑購買頻率指標、30日金額（元）、退貨率 |
| domains.equipment.raw | 120×3：振動（mm/s）、溫度（°C）、電流（A） |
| teaching_uv | 120×2；前兩個原始欄位依固定工程基準平移及除尺度 |
| reference_arc | 只供繪圖核對的合成弧形：0、1；遠點 −1，不傳入模型 |

固定資料規則：

- sklearn.make_moons 每領域產生112筆（兩弧各56筆），shuffle=False、noise=0.035；零售種子42、設備43。
- 加入同樣8個遠點後，共120筆。第三個工程特徵是 0.35×u＋0.2×sin(2v)；三欄各依 offsets、scales 轉為不同量綱，保留9位小數。
- 零售購買頻率是連續平滑指標，不是必須為整數的交易次數。
- normal train 以 default_rng(42) 在兩弧各抽40筆，排序後共80筆；剩餘32個弧形樣本與8個遠點為未知40筆。索引從0起，兩領域共用同一切分。
- 訓練正常身分是合成情境的假設，不由測試結果倒推；參考弧形沒有用於分群或嵌入擬合。
- 分群圖使用 teaching_uv；非線性嵌入使用 raw 三欄 StandardScaler。全資料探索時可對120筆縮放；樣本外與異常實驗只以訓練80筆 fit 縮放。
- DBSCAN 小鄰域 eps=0.31、MinPts=4，大弧形 eps=0.23、MinPts=4；含自身且含等半徑。六點查詢全部使用相同歐氏距離。
- t-SNE：random_state=42、init=random、learning_rate=100、max_iter=1000、perplexity=5/30；UMAP：random_state=42、transform_seed=42、n_jobs=1、min_dist=0.1、n_epochs=300、n_neighbors=5/30。
- 樣本外UMAP的n_neighbors=15，保留相同訓練縮放；比較transform與80＋40筆重新fit，沒有拿重擬合結果當獨立測試。
- one-class-svm 圖以 teaching_uv 的2D邊界教直覺；正文異常程式則在 raw 的3D標準化資料上擬合，不混用分數。

小算例欄位：

| 欄位 | 資料與用途 |
|---|---|
| kmeans_small | 0、2、3、8、10、12，起始中心0與3；兩輪分派 |
| hierarchical_small | 甲乙丙丁在0、1、4、9；連結距離與三點KL機制 |
| neighborhood_small | 六點0、0.1、0.2、0.3、0.6、2；鄰域與三種索引核對 |
| path_small | 0、1、2、3、9；指定合法切點5、1.5、0.5的示意樹 |

關鍵參考數值：

- K-means 六點兩輪中心：(0,7)→(5/3,10)，最終平方和38/3。
- 平均連結合併高度1、3.5、22/3；切高3得3群、切高5得2群。
- DBSCAN六點鄰域計數4、4、4、5、2、1；核心索引0–3，戊邊界、己雜訊。
- 零售弧形：K-means兩群62/58；DBSCAN兩群56/56、雜訊8。
- 全配對 n=4/8/16：有方向排除自身12/56/240；對稱去重6/28/120。
- t-SNE零售KL：perplexity5為0.190526、30為0.145852。
- UMAP零售圖非零有方向項：n_neighbors5為562、30為4198；不是去重邊數。
- UMAP樣本外transform：新點40×2，舊座標最大變化0；重新fit對齊後差異0.052568。
- 版本：scikit-learn1.9.1、umap-learn0.5.12、NumPy2.5.4、SciPy1.18.1。

頁面對應：k-means、hierarchical-clustering、dbscan、neighbor-search-index、isolation-forest、one-class-svm、nonlinear-embedding 七頁均使用本檔。

重建腳本與完整座標在本組交付報告列出的 tmp/rollout/groups/W-L23202-C/figure-scripts/generate.py、embedding-coordinates.json。SVG 是由資料與模型輸出產生的自足圖；沒有用手繪點位代替 t-SNE／UMAP。
