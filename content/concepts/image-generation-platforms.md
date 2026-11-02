---
id: image-generation-platforms
title: 圖像生成平台與介面選擇
kind: tool
codes: [L21103]
aliases: [Adobe Firefly, Canva AI, Midjourney, Stable Diffusion WebUI]
summary: 依創作流程、控制需求與運算資源選擇圖像生成介面
requires: [controlled-image-generation]
guide_refs: [guide-1:3-67, guide-1:3-68]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 從提示走到雲端圖像交付，處理素材並查核平台機制的資訊界線
  - id: g2
    text: 分辨本機介面、基底模型、LoRA 與 ControlNet，盤點資源需求
  - id: g3
    text: 依專業編修或快速製圖需求，安排 Firefly 與 Canva 的流程位置
formula_groups:
  - id: array-and-weight-capacity
    source: https://numpy.org/doc/stable/reference/generated/numpy.ndarray.nbytes.html
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊要用雲端平台做 4 張新品概念圖，手上有未公開瓶身照。哪個流程合理？
    options:
      A: 上傳完整照片再生成，4 張符合美感就保證能公開交付
      B: 直接猜平台內部架構，4 張符合美感就保證能公開交付
      C: 省略所有素材與版本紀錄，4 張生成後直接當正式商品照
      D: 先查素材上傳條件，4 張生成後驗收並保留設定與修訂
    answer: D
    explain:
      A: 美感無法證明素材可上傳或結果可交付，應先檢查資料與權利條件。
      B: 內部架構不能靠輸出外觀推定，也不決定素材可否公開。
      C: 缺少版本與來源紀錄不利回溯，概念圖也不應直接當成商品實拍。
      D: 先處理素材條件，再生成、驗收與留存紀錄，才涵蓋完整交付流程。
  - id: c2
    goal: g2
    type: choice
    prompt: 本機流程已有 1 個基底模型，還要控制姿態並套用既有風格適配權重。何種分工合理？
    options:
      A: WebUI 是模型；ControlNet 管風格；LoRA 管每張姿態
      B: WebUI 是介面；ControlNet 管結構；LoRA 套適配權重
      C: WebUI 是模型；ControlNet 管檔案；LoRA 管顯示版面
      D: WebUI 是介面；ControlNet 管檔案；LoRA 管每張姿態
    answer: B
    explain:
      A: WebUI 是操作介面，ControlNet 的結構控制也不應與風格權重交換。
      B: 三者分別負責操作、空間條件與低秩適配權重，仍須確認彼此相容。
      C: 基底模型才執行生成，控制元件與適配權重也不是檔案及版面工具。
      D: ControlNet 使用結構條件，不是檔案管理器；LoRA 不直接指定逐張姿態圖。
  - id: c3
    goal: g3
    type: choice
    prompt: 甲要精修 1 張商品主視覺且保留圖層，乙要快速做 6 張社群貼文並套版。按指引定位，何種安排較合適？
    options:
      A: 甲先評估 Firefly 搭專業編修；乙先評估 Canva 生成再套版
      B: 甲先評估 Canva 且禁止後製；乙先評估 Firefly 且禁止套版
      C: 甲先評估 Firefly 且免驗收；乙先評估 Canva 且免檢查排版
      D: 甲先評估 Canva 且免驗收；乙先評估 Firefly 且免檢查排版
    answer: A
    explain:
      A: 專業編修整合與輕量設計符合指引定位，實際功能仍要查核與驗收。
      B: 禁止後製與套版沒有需求依據，且交換了指引強調的流程位置。
      C: 選對工具仍需查核商品細節與貼文排版，不能免除驗收。
      D: 兩種工具都不能省略驗收，安排也未對應各自最直接的流程需求。
---

## 為什麼需要

圖像生成工具可能是雲端創作服務、本機模型的操作介面，或既有設計軟體中的功能。同樣輸入一句提示，後面的資料路徑、可調設定與編修流程可能不同。

選擇時先問要探索概念、精修成品，還是快速排版。工具名稱不能取代交付要求，也不能直接當成生成模型的架構名稱。

## 直覺

把流程分成「提出需求、生成、修改、驗收、交付」。不同平台主要幫忙的環節不一樣；操作方便，也不代表所有生成條件都開放調整。

| 指引中的工具 | 流程位置 | 適合先評估的需求 |
|---|---|---|
| Midjourney | 雲端提示與概念探索 | 藝術風格及創意靈感 |
| Stable Diffusion WebUI | 本機生成介面與設定 | 模型、參數及控制自訂 |
| Adobe Firefly | 生成結合設計軟體編修 | 專業影像或視覺素材製作 |
| Canva AI | 生成素材接平台設計 | 輕量製圖及快速內容應用 |

這是指引 3-67～3-68 的定位，不是產品排名。功能、帳號方案與介面會變，正式採用前要看當時的官方說明。

## 定義與公式

Stable Diffusion 是模型家族；WebUI 是讓人操作模型的介面。LoRA 是低秩適配方法，ControlNet 則把姿態、邊緣等結構條件接入生成流程。

:::supplement[來源：AUTOMATIC1111 WebUI「Features」；Diffusers「ControlNet」]
載入既有 LoRA 權重與訓練新的 LoRA 是兩個工作。換 WebUI 外觀不會自動訓練模型，載入風格適配權重也不等於取得每張圖的姿態控制。

本機使用仍需確認模型、適配權重與擴充元件的版本相容性。介面支援某個功能，不表示每個模型版本都能直接使用。
:::

### 先算陣列與權重容量（補充）

固定資料型別、未壓縮陣列的元素容量可寫成：

$$
M_{\mathrm{array}}=H\times W\times C\times b,
\qquad M_{\mathrm{weights}}=P\times b_w.
$$

$H$、$W$ 是陣列高度與寬度，$C$ 是通道數，$b$ 是每元素的 byte 數。$P$ 是權重參數個數，$b_w$ 是每權重的 byte 數；兩個 $M$ 都以 bytes 計。

這只能估元素或權重本身，不包含物件管理、推論中間結果及工作空間。圖片壓縮檔案大小與浮點陣列不同，不能直接互換。

## 走一次流程

雲端創作可從自然語言提示開始，挑選候選圖再修改。專業編修則把生成當成一個步驟，之後仍須修圖、排版及交付檢查。

### 共用卡走雲端流程（補充）

1. **處理素材。** 取商品 P01 的提示與留白需求；上傳照片前檢查是否含未公開設計、他人肖像或無權使用的素材。
2. **生成候選。** 在 Midjourney 等服務的可用介面輸入主體、色彩與構圖，保存實際可取得的設定；平台未開放的參數不要假裝已控制。
3. **修訂與驗收。** 依卡片檢查瓶身輪廓、品牌色及文字；有問題回到編輯或傳統修圖，確認輸出尺寸後交付。
4. **換成遊戲。** G01 用相同流程探索山城風格；指定輪廓若無法由介面控制，就改用支援結構條件的管線。

### 本機 WebUI 與容量卡（補充）

先確認模型來源及版本，再載入相容模型、需要的 LoRA 或 ControlNet。輸入提示、種子、取樣器、步數與引導強度，生成後保存設定，依相同卡片驗收。

共用容量卡的像素陣列為 512×512×3，每元素 4 bytes，得 3,145,728 bytes。空間各縮小 8 倍後，64×64×4 的潛在陣列為 65,536 bytes，相差 48 倍。

另設玩具模型 1,000,000 個權重、每個 2 bytes，僅權重需 2,000,000 bytes。這三個數字不能相加就當成真實平台的最低顯示記憶體需求。

要盤點的還有模型檔與擴充檔磁碟空間、系統記憶體、顯示記憶體、批次與解析度。若同時加控制模型或增加批次，須重新量測尖峰用量。

### 專業編修與輕量製圖

Firefly 的指引定位是生成與 Photoshop、Illustrator 等專業設計流程整合。Canva AI 則把提示生成的素材接進平台編輯，降低輕量設計的操作門檻。

:::supplement[來源：Adobe「Photoshop Generative Fill」；Canva「Use Magic Media」]
商品主視覺可在專業編修中選區、生成候選，再以圖層與既有素材修正；精確標誌另行處理。社群貼文則可先生成背景，再套版、安排標題與檢查裁切，最後匯出需要的尺寸。
:::

## 程式（補充）

在專案根目錄先設 `$env:IPAS_REPO_ROOT=(Get-Location).Path`。這段只核算容量，不會載入模型或測量顯示記憶體。

```python
import json, os
from pathlib import Path
path = Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21103-B-image-cards.json'
p = json.loads(path.read_text(encoding='utf-8'))['capacity']
pixels = p['height'] * p['width'] * p['pixel_channels'] * p['bytes_per_value']
latent = (p['height']//p['downsample']) * (p['width']//p['downsample']) * p['latent_channels'] * p['bytes_per_value']
weights = p['weights_parameters'] * p['weights_bytes_per_parameter']
print('pixel bytes:', pixels)
print('latent bytes:', latent)
print('ratio:', pixels // latent)
print('toy weight bytes:', weights)
```
```text
pixel bytes: 3145728
latent bytes: 65536
ratio: 48
toy weight bytes: 2000000
```

## 怎麼用、怎麼判讀

藝術發想先看提示迭代與候選挑選；本機控制先看模型相容性及資源；成品交付則先看能否接續編修。專業工作與快速製圖是流程需求，不能簡化成哪個產品永遠比較好。

### 換個場景

| 場景或條件 | 流程選擇 | 驗收重點 |
|---|---|---|
| 藝術創作 | 雲端提示與候選圖探索 | 風格與創意方向 |
| 自訂模型或控制參數 | 本機 WebUI 串接元件 | 相容性與資源負擔 |
| 專業設計 | 生成接影像與向量編修 | 圖層、細節與交付格式 |
| 輕量社群設計 | 生成素材接套版 | 可讀性、比例與裁切 |
| 教育海報（補充） | 快速製圖後另查文字 | 知識內容不能由美感保證 |
| 展場提案（補充） | 探索概念後交專業編修 | 尺度、材質與實作可行性 |

### 平台內部機制的查核（補充）

指引 3-67 提及 Midjourney 背後的擴散與風格機制。本次查閱的官方入門與提示文件說明操作及輸入，未提供足以核對完整內部架構的細節，因此不能把該說法當成已獨立證實的技術規格。

可查證的流程與未確認的實作應分開。記錄查閱日期 2026-11-02、服務版本及官方來源；若需求依賴特定內部機制，應向供應者取得足夠文件再決策。

## 常見誤解

- 「WebUI 就是 Stable Diffusion 模型。」介面負責操作，模型權重與管線才執行生成。
- 「有 LoRA 就保證每張姿態相同。」LoRA 的適配與逐張結構條件不同。（補充）
- 「算出權重容量，就知道機器能跑。」還要計入其他元件與執行時尖峰。（補充）
- 「雲端輸出好看，就能確認內部架構。」操作結果不能證實未公開的實作。（補充）

## 進階

### 可重現性的交付紀錄（補充）

本機可保存模型雜湊、元件版本、提示、種子與取樣設定；雲端則保存能取得的版本、輸入與修改紀錄。服務更新後即使提示相同也可能不同，不能承諾跨版本完全重現。

### 參考來源

- 科目 1 指引（版本未標示），guide-1:3-67～3-68：支持四工具定位、本機自訂與專業／輕量流程；平台內部機制在本文保留查核界線。
- [Midjourney：Getting Started Guide](https://docs.midjourney.com/hc/en-us/articles/33329261836941-Getting-Started-Guide)、[Prompt Basics](https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics)：官方操作定義及提示教學，支持雲端流程；未據此推定內部架構。
- [AUTOMATIC1111 WebUI：Features](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Features)：支持本機介面與模型、LoRA 功能的區分。
- [Diffusers：ControlNet](https://huggingface.co/docs/diffusers/using-diffusers/controlnet)、[Reduce memory usage](https://huggingface.co/docs/diffusers/optimization/memory)：支持結構控制及執行時資源盤點。
- [Adobe：Photoshop Generative Fill](https://www.adobe.com/products/photoshop/generative-fill.html)、[Canva：Use Magic Media](https://www.canva.com/help/using-magic-media/?query=magic+media)：官方教學的選區編修與生成後加入設計，支持兩種交付流程。
- [NumPy：ndarray.nbytes](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.nbytes.html)：支持元素數乘每元素容量及不含管理成本的定義。
- 共用合成資料 `content/examples/L21103-B-image-cards.json`：支持商品、遊戲卡及玩具容量核算，不是硬體採購規格。

## 小結

- 平台、介面、模型與控制元件先分清楚，再選工作流程。
- 雲端創作、本機自訂、專業編修與快速製圖各有適合的環節。
- 容量小例只計元素與權重，真實運行仍須量測尖峰。（補充）
- 交付前查素材條件、版本與驗收結果；未知架構不靠外觀猜測。（補充）
