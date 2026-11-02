---
id: diffusion-model
title: 擴散模型與取樣
kind: model
codes: [L21102, L21103, L21301, L23203]
aliases: [CFG, DDPM, Diffusion Model, Diffusion Models, Stable Diffusion, 擴散模型]
summary: 擴散模型學習去噪，生成時從噪聲逐步形成符合條件的資料
requires: [generative-discriminative-models]
guide_refs: [guide-1:3-63, guide-1:3-64, guide-1:3-67, guide-1:5-13]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 描述加噪訓練、去噪取樣與文字條件的位置，辨識代表模型用途
  - id: g2
    text: 固定條件比較步數、取樣器及 CFG，判讀品質、多樣性與耗時
  - id: g3
    text: 依影像、語音文本與資料補全需求，評估生成流程和成本
formula_groups:
  - id: forward-noising
    source: https://arxiv.org/html/2006.11239v2
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-B
  - id: cfg-noise-prediction
    source: https://github.com/huggingface/diffusers/blob/main/src/diffusers/pipelines/stable_diffusion/pipeline_stable_diffusion.py
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某二維原型 x0=[1,-1]，累積訊號比例為 0.64，指定 ε=[0.5,-0.5]。依加噪公式，xt 應為何？
    options: { A: '[1.1,-1.1]', B: '[0.82,-0.82]', C: '[1.3,-1.3]', D: '[0.8,-0.8]' }
    answer: A
    explain:
      A: 訊號係數為 0.8、噪聲係數為 0.6，因此兩維是 0.8+0.3 與 -0.8-0.3。
      B: 這是把 0.64 與 0.36 直接當係數，漏掉平方根。
      C: 這是讓原始訊號不衰減，只把 0.6 倍噪聲加上去。
      D: 這是只保留衰減訊號，沒有加入指定噪聲。
  - id: c2
    goal: g2
    type: choice
    prompt: 商品團隊想比較 20 與 40 步的影響，先固定 3 個種子。還應採用哪個安排？
    options:
      A: 更換模型與提示，固定 CFG 後比較 3 組圖片
      B: 更換輪廓與取樣器，固定 CFG 後比較 3 組圖片
      C: 固定模型與條件，只改步數再比較 3 組圖片
      D: 固定模型與條件，同改 CFG 再比較 3 組圖片
    answer: C
    explain:
      A: 模型與提示同時改變，無法單獨判斷步數的影響。
      B: 輪廓與取樣器也是生成條件，改變後會混入其他因素。
      C: 控制其他設定並逐種子配對，較能辨識步數造成的差異。
      D: 同時變更 CFG，只能比較整體設定，不能單獨歸因於步數。
  - id: c3
    goal: g3
    type: choice
    prompt: 遊戲要大量產出 512×512 場景草稿，另一專案要補全語音缺段。哪種規劃合理？
    options:
      A: 兩案共用 20 步文生圖管線，只驗收場景美感與語音音量
      B: 兩案各選適配管線，以步數比例推算耗時且省略品質驗收
      C: 兩案各選適配管線，將步數直接當成所有硬體的固定秒數
      D: 兩案各選適配管線，量測生成耗時並查核各自的補全品質
    answer: D
    explain:
      A: 文生圖模型不會因指定語音任務就具備語音補全能力，音量也不足以驗收內容。
      B: 不同模型的每步成本未必相同，只按比例推算且省略品質檢查不足以規劃。
      C: 步數是運算流程設定，不是跨硬體固定的時間單位。
      D: 選用適合資料表示與條件的模型，再量測實際成本和任務品質才合理。
---

## 為什麼需要

想畫一座從未拍攝過的山城，沒有一張固定原圖可以直接重建。擴散模型（Diffusion Model）學習如何從受擾資料移除噪聲，生成時反覆運用這個能力形成新樣本。

指引以高品質影像生成說明它的價值，也提醒多步生成的速度與運算成本。規劃時要同時問畫得如何、等多久，以及能否遵守提示。

## 直覺

訓練方向從乾淨資料逐步加入噪聲，模型學習反方向的去噪。生成方向則從隨機噪聲開始，逐步形成圖像；有文字條件時，文字資訊參與去噪決策。

![上方是已知的加噪方向，下方是學得的去噪方向；文字條件進入去噪器。](figure:l21103-diffusion-model-denoising)

DDPM 是以擴散機率過程生成影像的代表。指引也列 Stable Diffusion、DALL·E 2、Imagen 為文字生成影像的例子。

:::supplement[來源：Hugging Face「The Annotated Diffusion Model」；Diffusers「Text-to-image」]
Stable Diffusion 以潛在表示進行擴散，再解碼回圖像。

訓練可抽一個時間步，直接構造該噪聲程度的資料，並以已知噪聲當目標。生成時沒有乾淨答案，也不知道最初噪聲對應哪張真圖，必須依模型預測逐步更新。

去噪器可用文字編碼器提供的條件，但「有去噪能力」不等於已學會圖文對齊。這還需要合適的跨模態表示與訓練。
:::

## 定義與公式

擴散模型以加噪建立訓練問題，再學習相反方向的資料轉換。取樣（Sampling）是依學得的模型與更新規則，從噪聲產生新資料的過程。

### 直接取得某步的含噪資料（補充）

在高斯加噪設定下：

$$
x_t=\sqrt{\bar\alpha_t}\,x_0+
\sqrt{1-\bar\alpha_t}\,\epsilon,
\qquad \epsilon\sim\mathcal{N}(0,I).
$$

$x_0$ 是乾淨資料，$x_t$ 是第 $t$ 步的受擾資料。$\bar\alpha_t$ 是累積訊號保留比例，介於 0 與 1；$\epsilon$ 是與資料同形狀的標準常態噪聲，$I$ 為單位矩陣。

訊號係數與噪聲係數都要開平方根。這是訓練端構造資料的公式，不是推論時把已知真圖直接減回來。

### 無分類器引導的慣例（補充）

以下採 Diffusers 的無分類器引導（Classifier-Free Guidance，CFG）參數慣例：

$$
\hat\epsilon=\epsilon_u+w(\epsilon_c-\epsilon_u).
$$

$\epsilon_u$ 是無條件的噪聲預測，$\epsilon_c$ 是有條件的預測，$w$ 是引導強度，$\hat\epsilon$ 是組合後的預測。每一項向量都要同形狀。

$w=1$ 在此寫法對應有條件預測。較大的強度通常更強調提示，但不保證品質或多樣性提高，也不是用分類器再判一次圖像。

## 算一次（補充）

共用卡 P01、G01 使用相同二維探針 $x_0=[1,-1]$。設 $\bar\alpha_t=0.64$，兩個係數便是 0.8 與 0.6。

種子 42 的噪聲約為 [0.30471708,-1.03998411]，逐維計算如下：

| 維度 | 衰減訊號 | 加入噪聲 | 含噪結果 |
|---|---|---|---|
| 第一維 | 0.8 × 1 | 0.6 × 0.30471708 | 0.98283025 |
| 第二維 | 0.8 × (-1) | 0.6 × (-1.03998411) | -1.42399046 |

加噪後的值不必落在原本資料範圍。這次噪聲恰好使第二維更負，不能把「噪聲比例增加」解讀成每個值都往零移動。

CFG 另設預測 $\epsilon_u=[0.1,0.2]$、$\epsilon_c=[0.3,0.1]$，引導強度 $w=7$。

兩預測之差為 [0.2,-0.1]，代入 $[0.1,0.2]+7[0.2,-0.1]=[1.5,-0.5]$。結果是噪聲預測，不是像素亮度。

## 程式（補充）

先在專案根目錄設 `$env:IPAS_REPO_ROOT=(Get-Location).Path`。程式僅重現加噪與引導算式，沒有訓練去噪器。

```python
import json, os
from pathlib import Path
import numpy as np
path = Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21103-B-image-cards.json'
p = json.loads(path.read_text(encoding='utf-8'))['diffusion_probe']
epsilon = np.random.Generator(np.random.PCG64(p['seed'])).standard_normal(2)
a = p['alpha_bar']
xt = np.sqrt(a) * np.array(p['x0']) + np.sqrt(1-a) * epsilon
u, c = np.array([0.1, 0.2]), np.array([0.3, 0.1])
print('x_t:', np.round(xt, 8).tolist())
print('CFG:', np.round(u + 7 * (c-u), 8).tolist())
```
```text
x_t: [0.98283025, -1.42399046]
CFG: [1.5, -0.5]
```

## 怎麼用、怎麼判讀

影像生成看輪廓、細節與條件遵循；多步運算則增加生成成本。指引提到的多模態對話還涉及理解與對齊，不能把整套系統能力都歸因於去噪模型。

### 固定條件比較取樣設定（補充）

比較前須另行固定並記錄模型版本；共用卡已記錄提示、輪廓、512×512 解析度及種子清單 42、43、44。下表是實驗計畫，尚未執行影像生成，沒有預填耗時或品質分數。

| 比較 | 基準 | 只改一項 | 要觀察的結果 |
|---|---|---|---|
| 步數 | DDIM／20 步／CFG 7 | 40 步 | 細節是否改善、耗時是否增加 |
| 取樣器 | DDIM／20 步／CFG 7 | DDPM | 輪廓、細節及實際運算量 |
| 引導強度 | DDIM／20 步／CFG 7 | CFG 12 | 提示遵循、失真與樣式覆蓋 |

每一列以同一種子配對，再用多個種子看波動。固定種子只控制隨機輸入；跨版本、裝置與取樣器仍可能不同，不能要求所有管線逐像素一致。

取樣器決定如何更新與選取時間步；同樣 20 步不保證網路評估次數或品質相同。提高 CFG 也可能犧牲樣式變化，需看整批輸出而非只挑最好一張。

DDIM 論文的少步數實驗顯示，DDPM 通常需要更多步才能維持品質。此處只比較兩者在 20 步預算下的表現，不能據此判定取樣器的整體優劣；完整選型還要各測品質與成本的取捨。

### 換個場景

| 場景或條件 | 用途 | 判讀重點 |
|---|---|---|
| 藝術創作、廣告圖文 | 文字條件生成影像 | 圖像細節與提示吻合程度 |
| 語音與文本合成 | 選適配模態的生成模型 | 非任一文生圖管線都可處理 |
| 醫療、金融、零售補全模擬 | 補缺失或構造案例 | 生成合理性與任務風險 |
| 商品原型（補充） | 同卡比較步數與引導 | 品牌色和輪廓須另外驗收 |
| 遊戲山城（補充） | 依輪廓探索場景變體 | 樣式覆蓋與批次成本 |

指引 5-13 將語音文本與資料補全列為生成模型整體的應用，語音例子另含 VAE、文本例子另含 Transformer。不能把這些例子全當成擴散模型的現成功能。

:::supplement[來源：Diffusers「Text-to-image」；「Schedulers」]
擴散也可為不同資料表示設計模型；具體能否補全語音或文字，要查模型的訓練目標與條件介面。正式規劃還要量測硬體、批次、解析度及載入成本，步數不能直接換成固定秒數。
:::

## 常見誤解

- 「去噪是在找回某張訓練圖。」生成目標是新樣本，沒有指定一張原圖供反推。（補充）
- 「步數越多一定更好。」可能改善有限，成本卻增加，須用固定條件比較。（補充）
- 「高 CFG 就有高多樣性。」它強調條件方向，不是多樣性的保證。（補充）

## 進階

### 潛在擴散和像素擴散（補充）

潛在擴散先把影像壓成較小表示，在該表示上去噪，最後解碼。VAE 可在這裡擔任影像表示與重建元件；壓縮減少空間資料量，也可能丟失細節。

因此「擴散比 VAE 好」太籠統：一套系統可能同時使用兩者，且生成成本不只由表示大小決定。

### 參考來源

- 科目 1 指引（版本未標示），guide-1:3-63～3-64、guide-1:3-67、guide-1:5-13：支持去噪、代表模型、用途與成本。語音文本屬生成模型整體場景。
- [Ho 等：DDPM 論文](https://arxiv.org/html/2006.11239v2)，第 2–3 節：支持加噪公式與訓練／生成的差異。
- [Song 等：Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502)，第 5 節：支持少步數比較的限制，不把固定 20 步結果當成整體排名。
- [Hugging Face：The Annotated Diffusion Model](https://huggingface.co/blog/annotated-diffusion)：參考雙向流程及抽時間步的教法。
- [Diffusers：Stable Diffusion Text-to-image](https://huggingface.co/docs/diffusers/api/pipelines/stable_diffusion/text2img)：支持步數、引導強度及 CFG 寫法。
- [StableDiffusionPipeline 原始碼](https://github.com/huggingface/diffusers/blob/main/src/diffusers/pipelines/stable_diffusion/pipeline_stable_diffusion.py)：支持本頁使用的 CFG 組合慣例。
- [Diffusers：Text-to-image](https://huggingface.co/docs/diffusers/using-diffusers/conditional_image_generation)：支持文字條件、潛在去噪與解碼。
- [Diffusers：Schedulers](https://huggingface.co/docs/diffusers/api/schedulers/overview)、[Reproducibility](https://huggingface.co/docs/diffusers/using-diffusers/reusing_seeds)：支持取樣器差異與固定種子的界線。
- 共用資料 `content/examples/L21103-B-image-cards.json`：支持兩領域數值與比較計畫，並非真實模型效能測量。

## 小結

- 訓練以已知加噪構造問題，生成從噪聲逐步形成資料。
- 條件資訊引導去噪，跨模態對齊仍需要相應的訓練與表示。
- 步數、取樣器與 CFG 各自影響結果，需控制變因比較。（補充）
- 多步生成有成本，資料表示、硬體與任務驗收都要列入規劃。
