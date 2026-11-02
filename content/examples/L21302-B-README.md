# L21302-B 共用部署紀錄

本組五頁共用 L21302-B-deployment.json。影像檢測、圖文摘要各 24 請求；seed=42 是共同實驗標記，紀錄依索引生成而不抽亂數。

- id、domain、index：唯一請求、領域與固定順序。每領域 1–12 校準、13–18 驗證、19–24 留出測試；方案比較不重新切分。
- public_allowed：1–18 可出公有雲，19–24 不可；hard：4 的倍數需升級。權限先於路由，不因困難而放行。
- model_version、preprocess_version：服務紀錄須一併追蹤。route_model 表示各路徑模型配置；摘要端側用 small_summary，其餘用 summary，都是版本 v2 的配置。路由欄位的毫秒是串行固定紀錄；capture 加 transfer、pre、queue、kernel、response 得端到端時間。
- models：parameters 是儲存參數數，bits 是候選位元，other_mb 是本例固定的其他推論記憶體。MB 採十進位；非實際框架峰值。
- visual_profiles：同索引任務的合成耗時與峰值記憶體；分類以標籤是否相同核算，偵測每張恰有一目標，target_found 表示預先按固定匹配規則判定找回，沒有額外偽陽性。兩任務分數不得直接排名。
- cell、dwell_seconds：零售延伸視角，同一批合成影格的區域及停留秒數。每區各 6 筆，區域 0／1／2／3 每筆固定為 5／3／2.5／1.5 秒，累積為 30／18／15／9 秒，總共 72 秒；僅示範彙整，不能當真實追蹤量測。
- gpu：同 24 個影像索引在另一壓測情境同時到達後端，排除逐影格影像路徑的 queue_ms。每批先有 host 空檔，再跑 kernel，單序列無重疊；outside_ms 是排程前後固定 30 ms。不是語言模型的連續批次。
- lora：凍結的基底與可訓練更新量，排除梯度及優化器狀態。
- costs：虛構成本單位，非雲端報價；私有容量 24／視窗，公有只計本例運算與傳輸，未涵蓋全部總持有成本。

關鍵核對：影像 edge=40、private=54、public=80 ms；摘要 edge=300、private=246、public=230 ms。vision FP32=320+120=440 MB；INT8=80+120=200 MB。summary INT8=400+240=640 MB；小摘要=120+160=280 MB。

24 筆後端：single 24 批共 288 ms，GPU active 192、host idle 96；batch4 六批共 120 ms，active 96、idle 24。後端吞吐 83.33 與 200 req/s，最慢端到端 318 與 150 ms。

適用頁：cloud-deployment-options（權限／成本）、hybrid-deployment（路由／版本）、edge-inference（串流／容量／視覺回饋）、multimodal-deployment-optimization（位元／更新量）、gpu-inference-scheduling（批次）。所有數字均為教學紀錄核算，不能據此宣稱 MobileNet、YOLO、CPU 或 GPU 的真實速度。
