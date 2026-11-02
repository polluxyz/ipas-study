# L23304-D 採樣與損失共用例子

`L23304-D-imbalance.json`是教學合成資料，不代表真實產線、患者、模型訓練結果或醫療建議。製造與醫療各200筆，固定10筆正類；四頁不以採樣或損失數字宣稱實際預測提升。

- `domains.manufacturing`：`sensor_a`是壓力座標、`sensor_b`是振動座標，皆為教學刻度；`label=1`為瑕疵。`domains.medical`的`age`為歲、`marker`為教學檢驗刻度，`label=1`為篩檢目標陽性。
- 每個領域都有`index`（0–199）、`id`、`label`、`group`、`split`、`score`、`subtype`、`class_weight`。`score`是指定的正類機率，不是由特徵擬合產生；所有頁面共用它，避免把模型差異混入採樣比較。
- 每隔20筆有一筆正類。索引0–119為訓練（負114、正6），120–159為驗證（38、2），160–199為測試（38、2）；本例視為彼此獨立個案。真實資料仍須依患者、時間、設備等結構切分。
- 訓練正類索引0、20、40、60給正類機率0.9，80、100給0.2。負類索引1–6給0.8，其餘給0.1。驗證與測試亦有固定的容易與困難樣本，不參與比例或權重估計。
- `subtype=rare-normal`為訓練索引7–11：製造是壓力4.0–4.4但合格的5筆，醫療是75–79歲、marker 4.0–4.4的5筆陰性；其餘型態不作此標記。
- 製造`group=A/B`對應兩產線，醫療為教學合成群體。訓練交叉格A陰55陽5、B陰59陽1；各群60筆。群體符號不是額外預測特徵，也不代表真實人口或法律分類。
- `sampling.over_indices`保留全部120筆，種子23304以NumPy `default_rng`有放回補抽108筆少數類，得到114比114。`under_indices`保留6筆少數類，另以相同種子從多數類無放回抽6筆：65、30、109、75、94、14。
- `weights.relative`為負1正19；`equal_loss=0.2`只用於拆解「數量乘權重」的假想比較圖，不是固定分數的實際交叉熵。`overcompensation`為負1正361，供過度補償對照；`group_label`為群體標籤聯合重加權，與類別平衡目標不同。
- `focal`的α=0.25、γ=2沿用前置組；六筆醫療與配對數字直接讀既有`content/examples/L23103-B-losses.json`，本檔不複製它。`plot_gamma`及`plot_true_probability`為難易係數曲線的輸入。

關鍵參考值：過採樣228筆、欠採樣12筆、原始獨立正類仍6筆；欠採樣移除108筆負類、罕見正常保留0筆。固定120筆未加權交叉熵平均0.205632；加權總和90.201603、權重總和228、加權平均0.395621。Focal六筆平均與120筆平均分開核算，不能跨資料集比較。

使用頁面：`oversampling`、`undersampling`比較同一索引的訓練計數；`class-weighting`算原始120筆損失與群體交叉格；`focal-loss`用同一120筆，並引用前置六筆核對公式。

圖由`tmp/rollout/groups/W-L23304-D/figure-scripts/generate.mjs`讀本JSON重建：`node tmp/rollout/groups/W-L23304-D/figure-scripts/generate.mjs`。輸出圖ID為`l23304-oversampling-distribution`、`l23304-class-weighting-contribution`、`l23304-focal-loss-modulation`；完整腳本與數字核算報告交協調者保留。
