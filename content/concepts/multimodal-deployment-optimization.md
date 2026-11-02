---
id: multimodal-deployment-optimization
title: 多模態部署優化與加速
kind: technique
codes:
  - L21302
  - L21104
  - L23304
aliases:
  - OpenVINO
  - TensorRT
  - 多模態部署
  - 雲邊分工
summary: 先定位容量、運算或傳輸瓶頸，再選模型、端雲分工及推論加速
goals:
  - id: g1
    text: 依瓶頸區分輕量架構、LoRA、雲邊分工與推論引擎
  - id: g2
    text: 核算權重位元容量，區分延遲、吞吐及完整記憶體
requires:
  - model-resource-costs
guide_refs:
  - guide-1:3-81
formula_groups:
  - id: storage-budget
    source: https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.nbytes.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21302-B
  - id: throughput-window
    source: https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html#metrics
    status: verified
    checked_by: codex-gpt-6.1-sol:CK3-W-L21302-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 摘要模型有四億個基底參數與兩百萬個 FP16 LoRA 參數。哪個說法符合更新量與部署容量的差別？
    options:
      A: 更新量為 4 MB，所以部署時全部模型必定只需 4 MB
      B: 更新量為 4 MB，所以四億基底參數將在推論時消失
      C: 更新量為 4 MB，部署仍需基底與其他推論記憶體
      D: 更新量為 4 MB，所以傳輸與排隊延遲都會歸零
    answer: C
    explain:
      A: 更新檔只包含部分參數，不代表完整推論模型。
      B: LoRA 凍結基底，並未刪除推論所需的基底。
      C: 兩百萬乘兩 bytes 為 4 MB，基底及執行用量仍存在。
      D: 更新量減少不能消除網路與排程成本。
  - id: c2
    goal: g2
    type: choice
    prompt: 八千萬參數的 FP32 權重為 320 MB，其他推論用量固定 120 MB。全部權重改 INT8 後，何者正確？
    options:
      A: 總量為 110 MB，因權重與其他用量都必定除以四
      B: 總量為 80 MB，因激活與工作區不需要額外空間
      C: 總量為 440 MB，因低精度不會影響權重儲存量
      D: 總量為 200 MB，仍須重新驗證品質與實際延遲
    answer: D
    explain:
      A: 只有權重被指定換位元，其他用量不隨之除以四。
      B: 80 MB 只計權重，漏了題目指定的 120 MB。
      C: 440 MB 是 FP32 加其他用量的原始總量。
      D: 80 加 120 為 200 MB，低精度的品質與速度仍要實測。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

多模態服務可能要處理影像、聲音與文字，容量與計算負擔都較高。把模型放進記憶體，只完成了部署條件的一部分。

傳輸慢、模型算得慢、排隊太久，各需要不同處置。先辨識瓶頸，才能選對模型優化或執行方式。

## 直覺

模型層可考慮輕量架構與壓縮，系統層可分配端雲工作，執行層可選推論引擎。它們處理的資源負擔不同，也能搭配使用。

![先分容量、傳輸與運算瓶頸，再選對應方法；每條路最後都要回到品質與服務驗收。](figure:l21302-multimodal-deployment-optimization-bottlenecks)

## 定義與公式

### 四種方法各改什麼

| 方法 | 主要改動 | 應用時要分清楚 |
|---|---|---|
| MobileNet 等輕量架構 | 以較精簡網路處理視覺任務 | 要符合所需模態與輸出 |
| 低秩適應（LoRA） | 用少量更新參數適應任務 | 不會自動刪掉基底模型（補充） |
| 雲邊分工 | 近端處理關鍵工作，雲端處理複雜工作 | 升級路徑仍有傳輸與隱私成本 |
| TensorRT、OpenVINO | 優化推論執行 | 相容性與加速須驗證（補充） |

指引把 LoRA 與輕量架構並列為降低負擔的策略。兩者影響的參數範圍不同，不能把少量可訓練參數當作完整部署大小。

:::supplement[來源：LoRA 原論文；NVIDIA「How TensorRT Works」；OpenVINO「Optimizing for Latency」]
LoRA 凍結原模型，訓練低秩更新；可合併更新後部署，但基底權重仍需存在。它主要減少微調與任務更新負擔，並非自動縮小整個基底。

TensorRT 為目標 NVIDIA GPU 建立推論引擎；OpenVINO 可為其支援裝置編譯及配置推論。使用前需確認模型算子、硬體與精度支援，不能只換工具名稱就保證加速。
:::

### 容量與吞吐（補充）

密集儲存的權重容量是：

$$
B_w=Nb/8,\qquad B_{\mathrm{total}}=B_w+B_{\mathrm{other}}.
$$

$N$ 是參數數，$b$ 是每值位元；式中容量皆用 bytes。$B_{\mathrm{other}}$ 包含激活、快取與工作區，不必與權重同步縮小。

GenAI-Perf 將請求吞吐定義為完成回應數除以觀測時間。本頁沿用此定義，限定同一後端視窗，並把毫秒換成秒：

$$
H=n/(D/1000).
$$

$n$ 是完成請求數，$D$ 是視窗長度、單位 ms，$H$ 單位 req/s。單筆延遲則量一筆請求從送出到完成的時間，不能用 $D/n$ 取代每位使用者的等待。

$D>0$；本例視窗從首筆到達後端至最後一筆完成，$n$ 計同一視窗內完成的請求。除另註明外，吞吐顯示至小數二位；門檻判斷使用未捨入值。

## 算一次

### 權重位元與完整用量（補充）

沿用同一批影像與圖文摘要紀錄，MB 採十進位。八千萬參數的視覺模型，FP32 為 $80000000\times32/8=320000000$ bytes，即 320 MB。

改成 INT8 時權重為 80 MB，確實是原權重的四分之一。其他用量固定 120 MB，所以完整用量從 440 變 200 MB，不是 110 MB。

圖文摘要的四億參數基底若用 FP16，權重為 800 MB。兩百萬 LoRA 更新也是 FP16 時，更新檔僅 4 MB；不合併時單是兩者權重就有 804 MB，尚未計執行快取。

### 批次改善與單筆改善分開看（補充）

GPU 推論排程與批次頁沿用 24 個影像索引，另做同時到達後端的固定壓測。單筆執行全部完成需 288 ms，四筆合批需 120 ms。

吞吐分別是 $24/(288/1000)\approx83.33$ req/s，與 $24/(120/1000)=200$ req/s；83.33 為近似值。

這是後端視窗的完成率，不包含固定外圍 30 ms。

第一筆使用者的等待卻從 $30+12=42$ ms 變為 $30+20=50$ ms。整批完成更快，不表示每一筆延遲都變短，尤其低流量時還可能等候湊批。

## 程式（補充）

固定紀錄只做數值核算，不執行 TensorRT 或 OpenVINO；因此輸出不能當作硬體加速倍率。

```python
for bits in (32, 8):
    weights = 80_000_000 * bits / 8 / 1_000_000
    print(f"{bits} bits: weights={weights:.0f} MB, total={weights + 120:.0f} MB")
base = 400_000_000 * 16 / 8 / 1_000_000
update = 2_000_000 * 16 / 8 / 1_000_000
print(f"FP16 base={base:.0f} MB, update={update:.0f} MB")
for duration in (288, 120):
    print(f"24/{duration} ms: {24 / (duration / 1000):.2f} req/s")
```
```text
32 bits: weights=320 MB, total=440 MB
8 bits: weights=80 MB, total=200 MB
FP16 base=800 MB, update=4 MB
24/288 ms: 83.33 req/s
24/120 ms: 200.00 req/s
```

:::tip[讀碼重點]
位元先除以 8 換 bytes；ms 先除以 1000 換秒。權重容量、更新量、完整記憶體與 req/s 是四個不同量。
:::

## 怎麼用、怎麼判讀

先量整條路徑。若原圖傳輸占大半時間，雲端 kernel 再快也未必過關；可評估邊緣推論。若權重放不下，則先評估壓縮與模型選擇。

:::supplement[來源：OpenVINO「Optimizing for Latency」「Optimizing for Throughput」]
固定輸入大小、硬體、版本與精度後，比較品質、記憶體、單筆延遲和持續吞吐。推論引擎可能改善運算，卻無法消除資料準備、網路及等待成本。
:::

### 換個場景

| 場景 | 可考慮的方式 | 驗收焦點 |
|---|---|---|
| 影像、語音多模態訓練 | GPU／TPU 及模型優化 | 訓練時間、硬體成本與容量 |
| 邊緣多模態服務 | 壓縮、輕量模型、雲邊分工 | 容量、延遲與隱私 |
| 交通標誌加語音提示（補充） | 近端視覺與回應 | 即時性及辨識品質 |
| 展覽圖文摘要（補充） | 摘要模型與批次服務 | 每筆等待及尖峰吞吐 |

指引以數週、數十萬元硬體成本說明多模態訓練的可能量級。這是資源規劃的提醒；不同模型與資料的工期、費用仍須個別估算。

## 常見誤解

- **LoRA 只訓練少量參數，所以推論只存那些參數？** 基底仍需參與運算。（補充）
- **INT8 代表完整記憶體除以四？** 只有指定換位元的張量能套用此比例。（補充）
- **吞吐翻倍等於每筆等待減半？** 批次可能增加個別請求的等待。（補充）

## 進階

### 精度變動要重新驗收（補充）

壓縮或低精度轉換後，須用原先固定的驗證索引挑方案，再以留出測試確認。模態之一的品質下降，可能被整體平均掩蓋，應依任務檢查。

### 參考來源

- guide-1:3-81：多模態部署的壓縮、MobileNet、LoRA、混合部署及推論引擎方向。
- [LoRA 原論文](https://arxiv.org/abs/2106.09685)：支援更新參數與基底的區分。
- [TensorRT：How TensorRT Works](https://docs.nvidia.com/deeplearning/tensorrt/latest/architecture/how-trt-works.html)：支援引擎及記憶體界線。
- [PyTorch：Tensor.nbytes](https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.nbytes.html)：支援參數數乘每元素容量的核算。
- [OpenVINO：延遲優化](https://docs.openvino.ai/2025/openvino-workflow/running-inference/optimize-inference/optimizing-latency.html)、[吞吐優化](https://docs.openvino.ai/2025/openvino-workflow/running-inference/optimize-inference/optimizing-throughput.html)：支援測量範圍及兩種優化目標。
- [NVIDIA GenAI-Perf：Metrics](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html#metrics)：直接定義請求吞吐；本頁僅沿用請求指標，不移用 token 排程假設。
- [NVIDIA Triton：Optimization](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/optimization.html)：教學參考，支援同工作負載下比較吞吐與延遲。

## 小結

- 模型架構、更新方法、部署位置與推論引擎各處理不同負擔。
- 先定位容量、傳輸或運算瓶頸，再選改善方法。
- 權重縮小比例不代表完整推論記憶體比例。（補充）
- 單筆延遲與整批吞吐要分開驗收。（補充）
