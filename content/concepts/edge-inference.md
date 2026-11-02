---
id: edge-inference
title: 即時視覺與邊緣推論
kind: technique
codes:
  - L21102
  - L21103
  - L21104
  - L21301
  - L21302
aliases:
  - Edge AI
  - Edge Computing
  - Edge Vision
  - edge-generative-inference
  - edge-vision-inference
  - 多階段推論
  - 影像串流延遲
  - 端側生成
  - 端側生成與資源預算
  - 自適應推論
  - 邊緣推論
summary: 把推論移近資料來源，並同時驗收回應時限、容量與品質
goals:
  - id: g1
    text: 依隱私、延遲、頻寬與容量選端側或雲端路徑
  - id: g2
    text: 核算串流預算，說明逐影格結果如何形成產線事件及零售彙整
  - id: g3
    text: 依資源瓶頸選輕量模型及自適應或多階段推論
requires:
  - inference-service-api
  - model-resource-costs
guide_refs:
  - guide-1:3-53
  - guide-1:3-55
  - guide-1:3-58
  - guide-1:3-72
  - guide-1:3-81
  - guide-1:3-83
  - guide-1:5-18
formula_groups:
  - id: serial-latency
    source: https://docs.nvidia.com/deeplearning/tensorrt/11.4.1/performance/benchmarking.html#reported-performance-metrics
    status: pending
    checked_by: null
  - id: weight-budget
    source: https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.nbytes.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 影像端側總耗時 40 ms、公有雲 80 ms，門檻 50 ms，且原圖不得外送。哪個選擇符合兩項要求？
    options:
      A: 選公有雲 80 ms，因較快 kernel 足以抵銷外送限制
      B: 選端側的 40 ms，仍需確認模型品質及裝置容量
      C: 選公有雲 80 ms，因已加密便能自動取消權限
      D: 選端側的 40 ms，因此不必再檢查更新及品質
    answer: B
    explain:
      A: 端到端時間超標，而且外送不被允許。
      B: 端側符合這兩項條件，還需驗收其他資源及品質限制。
      C: 加密不會自動取得資料外送權限。
      D: 部署位置與延遲不能取代品質及更新管理。
  - id: c2
    goal: g2
    type: choice
    prompt: 監控流程攝影 10、傳輸 2、前處理 6、排隊 0、推論 18、回應 4 ms。門檻 50 ms，何者正確？
    options:
      A: 總計 24 ms，因只需加前處理與推論的時間
      B: 總計 30 ms，因攝影不屬於使用者等待時間
      C: 總計 40 ms，從攝影到回應都在預算範圍
      D: 總計 50 ms，因驗收門檻就是實際處理時間
    answer: C
    explain:
      A: 24 只涵蓋前處理與推論，漏掉攝影、傳輸及回應。
      B: 30 排除攝影，與本題端到端範圍不符。
      C: 六段相加為 40，小於 50 ms。
      D: 門檻是允許上限，不是已量得耗時。
  - id: c3
    goal: g3
    type: choice
    prompt: 相機每 25 ms 到一張圖，單序列每張服務時間 40 ms，不能重疊也不丟影格。哪個判斷合理？
    options:
      A: 每張都低於 50 ms，所以長時間一定不會積壓
      B: 每張都能啟動模型，所以只要增加排隊就會加速
      C: 每張推論只占 18 ms，所以不必計入其他處理
      D: 到達快於服務速度，需降負載或改變處理配置
    answer: D
    explain:
      A: 單筆時間過關不代表能承受持續流量。
      B: 增加排隊空間不能提高處理速率。
      C: 指定服務時間包含其他處理，不能只拿 kernel 比較。
      D: 每秒到達 40 張、最多完成 25 張，佇列會增長。
  - id: c4
    goal: g2
    type: choice
    prompt: 零售系統有 24 筆逐影格的位置與停留秒數，要做店內熱點圖；產線同時要通知瑕疵。哪個安排合理？
    options:
      A: 零售依區域累加停留，產線把判定組成帶工件 ID 的事件
      B: 零售只存最新一張圖，產線把所有影格都當成不同瑕疵
      C: 零售把影格數當停留秒，產線把通知次數當成模型準確率
      D: 零售只算模型參數量，產線等每日結束才發即時警示
    answer: A
    explain:
      A: 彙整圖與即時事件的目的不同，需各自接上相應回饋流程。
      B: 單影格不能表達整段動線，重複通知也會扭曲事件數。
      C: 影格數不等於秒數，通知次數也不是品質指標。
      D: 參數量不是動線，每日批次通知不符合即時回饋。
  - id: c5
    goal: g3
    type: choice
    prompt: 6 筆困難摘要中有 2 筆禁止外送；端側小模型只處理簡單輸入。哪個多階段配置合理？
    options:
      A: 把 6 筆全上公有雲，事後再刪掉 2 筆敏感輸入
      B: 把 4 筆升級公有服務，其餘 2 筆轉受控服務或人工
      C: 把 6 筆留在小模型，無論品質如何都回傳高信心
      D: 把 2 筆受限輸入加密，便可不用查權限直接外送
    answer: B
    explain:
      A: 事後刪除不能抵銷未授權外送。
      B: 困難度與外送權限分開判斷，替代路徑也維持權限。
      C: 困難樣本不能為了省資源而偽造信心。
      D: 加密保障傳輸，不代表資料已獲准外送。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

攝影機發現瑕疵後，若結果晚到，工件可能已離開處理位置。即時視覺需要低延遲，還要把結果接到操作員或控制系統。

邊緣推論（Edge Inference）在接近資料來源的位置執行模型。它能減少傳輸與頻寬負擔，但裝置容量、算力及更新能力都有上限。

## 直覺

近端推論少走網路往返；雲端可能有較快的運算資源，卻多了傳輸與排隊。比較時要從輸入取得一路算到回應，不能只比模型 kernel。

![端側減少傳輸時間；雲端 kernel 雖只有 8 ms，傳輸與排隊仍使整條路徑超過 50 ms。](figure:l21302-edge-inference-stream-budget)

圖是固定合成紀錄的串行加總，不是實機測速。預算定義從攝影開始，到回應完成為止。

## 定義與公式

### 端雲資源的差別

| 面向 | 雲端 | 邊緣 |
|---|---|---|
| 算力 | 可集中 GPU／TPU 等資源 | 依裝置可用的加速器與算力 |
| 容量 | 較易增加運算與儲存資源 | 受裝置可用容量限制 |
| 延遲與頻寬 | 需傳輸資料，可能多一次往返 | 可減少原始資料外送 |
| 隱私與更新 | 須審查資料處理位置 | 資料可留近端，但更新同步較難 |

多模態訓練可能需要較多 GPU 或 TPU；部署到裝置時，可考慮模型剪枝、模型量化或知識蒸餾。

:::supplement[來源：OpenVINO Quick Start Guide「Model Compression with NNCF」]
剪枝減少部分結構，量化降低數值位元，蒸餾則訓練較小學生模型。選哪個方法仍要看硬體支援與任務品質。
:::

### 時間與容量預算（補充）

TensorRT 文件示範分段加總延遲，並區分推論與應用的測量邊界。本頁依串行不重疊假設，自行將攝影到回應的六段相加；以下不是文件原有的同名公式：

$$
T=C+X+(P+Q+K)+R.
$$

$C$ 是攝影，$X$ 是整段傳輸，$P$ 是前處理，$Q$ 是等待，$K$ 是模型推論，$R$ 是回應處理，單位皆 ms。四段預算中的「推論段」包含 $P+Q+K$。

只計密集權重時，所需容量為：

$$
M_w=Nb/8,\qquad M_{\mathrm{total}}=M_w+M_{\mathrm{other}}.
$$

$N$ 是參數數，$b$ 是每值位元，$M_w$ 單位 bytes。$M_{\mathrm{other}}$ 包含激活、快取及工作區等其他用量；本例固定此值，MB 採十進位。

## 算一次

### 影像串流四段預算（補充）

資料來自 L21302-B-deployment.json，兩領域各 24 筆，固定切分與索引。影像逐筆走同一條路徑時，時間如下：

| 預算段 | 端側 ms | 私有 ms | 公有 ms |
|---|---|---|---|
| 攝影 $C$ | 10 | 10 | 10 |
| 傳輸 $X$ | 2 | 6 | 40 |
| 推論 $P+Q+K$ | 6+0+18=24 | 6+8+20=34 | 6+12+8=26 |
| 回應 $R$ | 4 | 4 | 4 |
| 合計 | 40 | 54 | 80 |

端側是 $10+2+24+4=40$ ms，符合 50 ms 門檻；其他兩條未過關。公有雲的 kernel 只有 8 ms，仍被傳輸與等待抵銷。

### 放得下還要跟得上（補充）

影像模型有八千萬參數。FP32 權重為 $80000000\times32/8=320000000$ bytes，即 320 MB，加其他 120 MB 共 440 MB，超出裝置 256 MB。

INT8 權重為 80 MB，加其他 120 MB 共 200 MB，才低於容量。實際算子、量化誤差及動態記憶體仍要驗收，不能據此承諾速度。

每 25 ms 到一張圖，相當於每秒 40 張。若整條服務每張占 40 ms、單序列且不重疊，最多每秒完成 25 張，會持續積壓。

### 輕量模型的固定紀錄

MobileNet 是高效率卷積架構，可用於影像分類；輕量 YOLO（指引舉 YOLOv5-Nano）用於物件偵測，能輸出目標位置。先看任務要分類還是定位，不能只比模型名稱。

:::supplement[來源：MobileNets 原論文；教學合成紀錄 L21302-B]
| 合成配置 | kernel ms | 峰值 MB | 同索引品質 |
|---|---|---|---|
| MobileNet 分類頭 | 12 | 62 | 分類正確 22/24 |
| 輕量 YOLO 偵測器 | 18 | 200 | 找回目標 21/24 |
| 雲端偵測器 | 8 | 900 | 找回目標 23/24 |

這是可重播的教學紀錄表，不是 MobileNet 或 YOLO 的硬體實測。分類與偵測的品質指標不同，不能直接排名。

| 合成配置 | 驗證索引 13–18 | 測試索引 19–24 |
|---|---|---|
| MobileNet 分類頭 | 分類正確 6/6 | 分類正確 5/6 |
| 輕量 YOLO 偵測器 | 找回目標 6/6 | 找回目標 4/6 |
| 雲端偵測器 | 找回目標 6/6 | 找回目標 5/6 |

挑方案看驗證索引，最後只用測試索引回報；不以測試表現反覆挑選配置。
:::

### 摘要服務與多階段路由

:::supplement[來源：教學合成紀錄 L21302-B]
圖文摘要的四億參數模型，INT8 權重 400 MB，加其他 240 MB 共 640 MB。個人電腦本例預算 768 MB 可容納；手機預算 384 MB 放不下，IoT 的 64 MB 更不足。

手機改用一億二千萬參數的小摘要模型，INT8 120 MB 加其他 160 MB 為 280 MB。固定紀錄的端側摘要回應為 $0+0+20+0+260+20=300$ ms，低於本例 350 ms 門檻。
:::

指引列出自適應推論及多階段處理，作為低資源部署的發展方向。

:::supplement[來源：Singh 等「On the Impact of Black-box Deployment Strategies for Edge AI」；教學合成紀錄 L21302-B]
自適應推論依難度或資源調整處理方式。多階段策略可先用小模型處理簡單請求，再升級困難請求；各階段仍要驗收品質與時間。

本例每領域 18 筆簡單、6 筆困難。困難的 4、8、12、16 可走公有服務；20、24 禁止外送，只能升級受控私有服務或人工處理，不能拿隱私換算力。
:::

## 程式（補充）

以下摘出同一資料檔的固定六段時間，重算延遲與容量。程式不呼叫模型，也不需要 GPU。

```python
routes = {"edge": (10, 2, 6, 0, 18, 4),
          "private": (10, 6, 6, 8, 20, 4),
          "public": (10, 40, 6, 12, 8, 4)}
for name, stages in routes.items():
    total = sum(stages)
    print(f"{name}: {total} ms, pass={total <= 50}")
for bits in (32, 8):
    total_mb = 80_000_000 * bits / 8 / 1_000_000 + 120
    print(f"{bits} bits: {total_mb:.0f} MB, fit={total_mb <= 256}")
```
```text
edge: 40 ms, pass=True
private: 54 ms, pass=False
public: 80 ms, pass=False
32 bits: 440 MB, fit=False
8 bits: 200 MB, fit=True
```

:::tip[讀碼重點]
時間要加全部六段；容量則是權重加其他用量。兩個 pass 各回答一項條件，不能取代品質驗收。
:::

## 怎麼用、怎麼判讀

### 把逐影格結果接回業務

產線的近端判定要接到能執行的回饋流程：

1. 攝影機取得工件影像。
2. 近端模型逐影格判定是否有瑕疵。
3. 把同一工件的判定合併成事件，附上工件 ID、時間與模型版。（補充）
4. 通知操作員需要處理的工件與問題。
5. 操作員據此調整產線或設備。

零售的輸出則是彙整圖，不是每張影格各發一次通知：

1. 追蹤位置，取得移動路徑與停留時間。
2. 將停留時間歸入對應店內區域。
3. 用熱點圖呈現各區停留差異。
4. 依動線與熱區檢視店鋪配置。

![區域 0 的累積停留最久；圖中深淺表示停留秒數，不代表模型準確率。](figure:l21302-edge-inference-retail-heatmap)

:::supplement[來源：AWS「Pattern 3: Real-time inference at the edge」；教學合成紀錄]
產線把同一工件的影格判定組成一個帶工件 ID、時間及模型版的瑕疵事件，再送通知或控制系統。重複看到同一缺陷時，要避免把每張圖都當新事件。

零售將店內劃為區域（cell）。本例同 24 筆影格，每區 6 筆；逐筆停留時間相加，區域 0 為 30 秒、區域 1 為 18 秒、區域 2 為 15 秒、區域 3 為 9 秒，合計 72 秒。

圖只是合成彙整示範；真正動線還需處理追蹤、遮擋、重複計時及隱私，不能直接把影格數當停留秒數。
:::

### 換個場景

| 場景 | 為何考慮近端 | 還要確認什麼 |
|---|---|---|
| 監控、產線與零售 | 即時辨識、回饋及動線分析 | 串流積壓與事件品質 |
| 車聯網、智慧城市 | 減少往返延遲與頻寬 | 斷線、裝置更新及同步 |
| 手機、電腦、IoT 生成 | 運算資源及資料隱私需求 | 模型大小與可用容量 |
| 農業巡檢（補充） | 遠端網路不穩 | 離線時的品質與替代操作 |
| 校園字幕（補充） | 近端處理聲音及影像 | 模態同步與回應時限 |

## 常見誤解

- **kernel 快就一定即時？** 傳輸、排隊及回應都屬於使用者等待。
- **單筆過關就不會積壓？** 還要比較連續到達速率與整體服務能力。（補充）
- **端側會自動保護隱私？** 紀錄、更新與升級路由仍需權限管理。（補充）

## 進階

### 更新也是部署成本（補充）

裝置斷線或可用空間不足時，更新可能失敗。發布時一起核對模型與前處理版本，保留可回復的版本；不能只確認模型檔下載完成。

### 參考來源

- guide-1:3-53、guide-1:3-55、guide-1:3-58：監控即時性、產線回饋、零售熱點圖與輕量視覺模型。
- guide-1:3-72、guide-1:3-81、guide-1:3-83、guide-1:5-18：端側生成、資源壓縮、自適應及多階段方向、裝置更新限制。
- [AWS IoT Greengrass：機器學習推論](https://docs.aws.amazon.com/greengrass/v2/developerguide/perform-machine-learning-inference.html)：近端執行與雲端訓練的官方說明。
- [AWS：即時邊緣推論模式](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-serverless/pattern-real-time-inference.html)：架構教學參考，支援事件、前處理及回饋流程。
- [OpenVINO：延遲優化](https://docs.openvino.ai/2025/openvino-workflow/running-inference/optimize-inference/optimizing-latency.html)：支援延遲優化的背景與首次推論成本。
- [TensorRT：效能指標與測量邊界](https://docs.nvidia.com/deeplearning/tensorrt/11.4.1/performance/benchmarking.html#reported-performance-metrics)：支援分段核算思路；六段式依本例串行假設自行加總。
- [TensorRT：執行與記憶體](https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/how-trt-works.html)：支援權重以外的推論記憶體。
- [PyTorch：Tensor.nbytes](https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.nbytes.html)：支援元素數乘每元素容量的位元核算。
- [OpenVINO Quick Start Guide](https://docs.openvino.ai/2025/_static/download/OpenVINO_Quick_Start_Guide.pdf)：第 2 頁支援剪枝、量化與蒸餾的差異。
- [Edge AI 部署策略研究](https://arxiv.org/abs/2403.17154)：支援依資源與品質取捨安排分層處理。
- [MobileNets 論文](https://arxiv.org/abs/1704.04861)：支援輕量架構及延遲、品質取捨。

## 小結

- 邊緣減少傳輸負擔，仍須驗收容量、品質與回應時間。
- 串流看整條路徑，也看連續流量是否積壓。
- 產線把判定接成事件，零售把位置與停留彙整成圖。
- 困難請求可多階段升級，升級路徑仍受權限限制。（補充）
