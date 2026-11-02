---
id: variational-autoencoder
title: 變分自編碼器 VAE
kind: model
codes: [L21103, L21301, L21302, L23203]
aliases: [VAE, Variational Autoencoder, 變分自編碼器]
summary: VAE 學習潛在變數的分布，從中取樣再解碼成資料
requires: [autoencoder, generative-discriminative-models]
guide_refs: [guide-1:3-61, guide-1:3-62, guide-1:3-63, guide-1:5-12, guide-1:5-13]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 走過編碼、潛在分布取樣與重建，說明下界用途及細節取捨
  - id: g2
    text: 比較重建、對抗與去噪機制，以及品質、多樣性和速度的限制
  - id: g3
    text: 分辨生成分布與分類邊界，設計低標註資料的選模比較
formula_groups:
  - id: latent-reparameterization
    source: https://arxiv.org/html/1312.6114v11
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 商品模型對某張圖輸出 μ=[1,-1]、σ=[0.5,0.25]，取 ε=[0.4,-0.8]。依逐維取樣公式，z 是哪一個向量？
    options: { A: '[1.4,-1.8]', B: '[1.2,-1.2]', C: '[0.7,-0.45]', D: '[1.1,-1.05]' }
    answer: B
    explain:
      A: 這是直接把 ε 加到 μ，漏掉標準差縮放。
      B: 兩維分別為 1+0.5×0.4 與 -1+0.25×(-0.8)。
      C: 這是把 μ 與 ε 相加後才乘 σ，運算順序不同。
      D: 這是把 σ 平方後當成縮放量，誤把變異數用作標準差。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊比較 2 個 VAE 設定，後者下界提高且重建輪廓平順。主管想據此核准所有品牌細節，哪個判斷合理？
    options:
      A: 下界提高表示 2 個設定的像素細節都已通過驗收
      B: 輪廓平順表示 2 個設定的分類準確率都必然提升
      C: 輪廓平順表示 2 個設定的新樣式都已有足夠覆蓋
      D: 下界有助訓練，2 個設定仍須分別檢查品牌細節
    answer: D
    explain:
      A: 下界是機率建模的訓練依據，沒有逐項檢驗品牌細節。
      B: 重建品質與分類能力不同，不能從輪廓平順推得分類改善。
      C: 輪廓平順不代表新樣式已被充分取樣，仍須檢查整批輸出的覆蓋。
      D: 訓練目標的改善不能取代交付條件，需另外看細節與任務效果。
  - id: c3
    goal: g2
    type: choice
    prompt: 遊戲團隊有 3 種生成方案：甲做潛在分布重建、乙以真偽對抗訓練、丙多步去噪。哪個比較合理？
    options:
      A: 甲屬 VAE、乙屬 GAN、丙屬擴散，仍需各測品質與耗時
      B: 甲屬 VAE、乙屬 GAN、丙屬擴散，三者必然自帶圖文對齊
      C: 甲屬 GAN、乙屬擴散、丙屬 VAE，仍需各測品質與耗時
      D: 甲屬 GAN、乙屬擴散、丙屬 VAE，三者必然自帶圖文對齊
    answer: A
    explain:
      A: 三個學習機制相符，但品質、多樣性與速度還受模型和資料影響。
      B: 圖文對齊還要有配對資料與條件機制，模型家族名稱本身不保證。
      C: 真偽對抗是 GAN，多步去噪是擴散，模型對應已顛倒。
      D: 除了機制對應錯誤，跨模態對齊也不能由生成模型名稱直接推出。
  - id: c4
    goal: g3
    type: choice
    prompt: 零件照片的標註預算依序降成 40、20、10 張。要判斷 VAE 表示是否比直接分類有利，哪種安排合理？
    options:
      A: 每個預算重選 1 份真實測試集，分數高便採用生成表示
      B: 每個預算保留 1 份合成測試集，分數高便視為真實成效
      C: 每個預算固定 1 份真實測試集，完成驗證選模後比較結果
      D: 每個預算檢視 1 份生成樣本集，圖片逼真便保證分類成效
    answer: C
    explain:
      A: 測試資料跟著預算改變會混入樣本差異，無法公平比較。
      B: 合成測試資料可能重複生成器的偏差，不能代表真實環境。
      C: 固定評估資料並在驗證階段選設定，才可比較各標註預算的效果。
      D: 逼真只涉及生成外觀，不能證明下游決策邊界正確。
---

## 為什麼需要

普通自編碼器能把圖壓成向量再重建，卻不保證任意向量都能解碼成合理內容。變分自編碼器（VAE，Variational Autoencoder）學習潛在分布，為取樣提供機率依據。

它適合思考隱含因素、重建與異常偵測。代價是生成結果可能偏平滑，細小文字或紋理不一定保留得好。

## 直覺

編碼器讀入圖像，描述這張圖的潛在分布；取樣後，解碼器將潛在向量還原成圖像。重建時有原圖可比較，從先驗生成新品時則沒有指定原圖。

![重建先讀入圖像再取樣，新生成則從先驗取樣；兩條路都使用解碼器。](figure:l21103-variational-autoencoder-latent)

指引把早期 RNN 編解碼與 VAE 放在同一演進階段。RNN 編碼器把輸入序列整理成表示，解碼器依序產生輸出；VAE 則描述潛在分布，取樣後再解碼。

指引 3-62 列出早期階段的品質波動與收斂困難：梯度傳遞或運算負擔可能妨礙訓練。這是該階段的限制概述，不能推成每個 VAE 都會梯度消失；VAE 生成時仍須查細節與品質穩定性。

:::supplement[來源：Kingma 與 Welling「Auto-Encoding Variational Bayes」第 2–3 節]
RNN 是序列網路結構，VAE 是潛在變數建模方式，兩者不是互斥的同一種分類。

常用的高斯 VAE 讓編碼器輸出平均與尺度，而不是只給唯一座標。訓練時也約束潛在分布與先驗的差距，使解碼器不只會還原零散的訓練點。
:::

## 定義與公式

指引指出 VAE 透過最大化變分下界訓練，並可用於隱含變數建模。

:::supplement[來源：Kingma 與 Welling「Auto-Encoding Variational Bayes」第 2.2 節]
下界是可最佳化的訓練目標，間接改善對資料分布的描述。它把「能否重建」與「潛在分布是否受約束」一起考慮，不等於影像美感分數。
:::

### 逐維取樣（補充）

對角高斯設定下，可用重參數化（Reparameterization）把隨機性與可訓練參數分開：

$$
\epsilon\sim\mathcal{N}(0,I),\qquad
z=\mu+\sigma\odot\epsilon.
$$

$\mu$ 是編碼器給的平均向量，$\sigma$ 是逐維標準差，$\epsilon$ 是標準常態亂數，$I$ 是單位矩陣。$\odot$ 表示逐維相乘，$z$ 是送入解碼器的潛在向量。

這裡標準差須為正；實作若輸出對數變異數，應先轉成標準差。取樣公式不是把平均與變異數直接相加。

## 算一次（補充）

共用資料 `L21103-B-image-cards.json` 的商品 P01 與遊戲 G01 共用二維原型。它們是兩種領域的示意座標，並非真實 VAE 的輸出。

![灰點是八群教學原型，橢圓標出指定分布的尺度，十字是一次取樣而非新的真實照片。](figure:l21103-variational-autoencoder-space)

設 $\mu=[1,-1]$、$\sigma=[0.5,0.25]$。種子 42 取出的 $\epsilon$ 約為 [0.30471708,-1.03998411]。

| 維度 | 平均 | 尺度乘噪聲 | 相加後的取樣值 |
|---|---|---|---|
| 第一維 | 1 | 0.5 × 0.30471708 | 1.15235854 |
| 第二維 | -1 | 0.25 × (-1.03998411) | -1.25999603 |

這是給定輸入後的分布取樣，不能當成不讀輸入的先驗取樣。

玩具解碼器把第一維乘 2 作第一輸出、兩維相加作第二輸出，得到約 [2.30471708,-0.10763749]。這只驗證資料流；沒有訓練過的線性映射不能證明商品圖或場景圖逼真。

## 程式（補充）

在專案根目錄執行前，先設 PowerShell 環境變數 `$env:IPAS_REPO_ROOT=(Get-Location).Path`。程式每次重新初始化亂數產生器，讀入同一組取樣設定。

```python
import json, os
from pathlib import Path
import numpy as np
path = Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L21103-B-image-cards.json'
p = json.loads(path.read_text(encoding='utf-8'))['vae_probe']
rng = np.random.Generator(np.random.PCG64(p['seed']))
epsilon = rng.standard_normal(2)
z = np.array(p['mu']) + np.array(p['sigma']) * epsilon
restored = z @ np.array(p['decoder'])
print('epsilon:', np.round(epsilon, 8).tolist())
print('z:', np.round(z, 8).tolist())
print('toy_decode:', np.round(restored, 8).tolist())
```
```text
epsilon: [0.30471708, -1.03998411]
z: [1.15235854, -1.25999603]
toy_decode: [2.30471708, -0.10763749]
```

:::tip[讀碼重點]
`sigma * epsilon` 使用標準差。`decoder` 是事先指定的矩陣，不是經過訓練的影像解碼器；固定種子也不代表已經學會生成。
:::

## 怎麼用、怎麼判讀

簡單圖像重建可看輪廓是否保留；語音重建可檢查原訊號的內容與細節。異常偵測可將不易重建的樣本列為待查，但低誤差不能證明絕對正常。

### 和 GAN、擴散怎麼選

![三條路分別對照重建目標、真假回饋及噪聲目標，文字提示需另有條件入口。](figure:l21103-variational-autoencoder-mechanisms)

| 模型 | 核心學習訊號 | 指引列出的取捨 | 生成速度觀察（補充） |
|---|---|---|---|
| VAE | 重建與潛在分布約束 | 結果偏平滑，細節可能不足 | 常以一次解碼生成 |
| GAN | 判別器的真偽回饋 | 訓練易失衡，可能缺漏模式 | 訓練後常一次前向生成 |
| 擴散 | 受擾資料的去噪目標 | 圖像品質佳，多步生成成本高 | 通常要多步網路運算 |

:::supplement[來源：Keras「Variational AutoEncoder」；Google「What is a Generative Model?」；Diffusers「Text-to-image」]
表格是常見設計的取捨，不是跨模型排名。三者都不能只因為會生成，就自動完成文字與圖像的跨模態對齊；仍要配對資料、條件編碼或相關訓練。
:::

### 低標註選模（補充）

生成式模型學資料分布 $p(x)$；鑑別式分類器學給定資料的類別機率 $p(y\mid x)$ 或決策邊界。$x$ 是資料，$y$ 是類別；VAE 表示可接分類器，重建卻不會自動提供標籤。

1. 商品群組 P01–P04 作訓練、P05–P06 作驗證、P07–P08 作最終測試。中心作標註候選，每群三個偏移點保留作無標籤輸入；整群不跨切分。
2. 教學標籤依中心第一維正負定義：正為 1、負為 0。P01、P04、P05、P08 為 1，其餘為 0；這是合成分類目標，不是商品品質。
3. 巢狀預算先標 P01–P04 共 4 筆，再縮成 P01、P02 共 2 筆，每次均有兩類。兩條路共用標籤，以邏輯斯迴歸比較原始座標與 VAE 平均向量表示。
4. VAE 只讀訓練群的中心與偏移點，無須使用類別標籤。即使 4 個中心全標，仍有 12 個偏移點未標；兩條路的標準化也只在訓練資料擬合。
5. 驗證與測試中心及其標籤固定，不供 VAE 訓練；只用驗證資料選設定，最後才比較測試成績。遊戲 G01–G08 沿用索引、標籤與預算。

這裡不安排單筆預算：邏輯斯迴歸需要至少兩類訓練樣本。中心與偏移點是同群相關資料，不能把偏移點當成新增獨立評估樣本；少量合成資料只用來演練流程。

生成的合成資料可作訓練候選，不能取代獨立真實評估。共用檔沒有填成績，不能預先宣稱 VAE 在低標註下一定較好。

### 換個場景

| 場景或條件 | 用途 | 判讀重點 |
|---|---|---|
| 簡單圖像、手寫數字 | 重建與潛在表示 | 平滑不代表細節完整 |
| 基礎文本生成 | 早期序列生成的應用 | RNN 依序輸出，VAE 另建模潛在分布 |
| 異常偵測 | 將難重建者列待查 | 誤差不是異常機率 |
| 語音重建 | 從潛在表示還原訊號 | 另檢查清晰度與細節 |
| 商品設計（補充） | 用表示探索瓶身變化 | 細字與品牌色另驗收 |
| 遊戲場景（補充） | 比較不同山形的表示 | 多樣性不能只看單張圖 |

## 常見誤解

- 「VAE 就是任何編碼器加解碼器。」還要有潛在機率分布與對應的變分訓練。
- 「VAE 和 RNN 只能選一個。」前者是潛在變數建模方式，後者是序列網路結構，可在適當架構中結合。（補充）
- 「低重建誤差就代表分類準確。」表示對重建有用，不保證保留類別差異。（補充）

## 進階

### 下界的用途與界線（補充）

資料的機率常難以直接最佳化，變分下界提供可訓練的替代目標。指引要求掌握這個用途，不必從積分開始推導。

下界的重建項鼓勵模型解釋輸入，分布約束項限制近似後驗偏離先驗。兩項的取捨會影響表示與細節；只求逐像素還原，未必得到好取樣的空間。

### 參考來源

- 科目 1 指引（版本未標示），guide-1:3-61～3-63、guide-1:5-12～5-13：支持演進、編解碼、下界、場景與生成機制取捨。
- [Kingma 與 Welling：Auto-Encoding Variational Bayes](https://arxiv.org/html/1312.6114v11)，第 2–3 節：支持逐維取樣、下界及先驗／輸入後取樣的差別。
- [Keras：Variational AutoEncoder](https://keras.io/examples/generative/vae/)：參考二維潛在空間的教法，支持機制比較及程式設計。
- [TensorFlow：Convolutional Variational Autoencoder](https://www.tensorflow.org/tutorials/generative/cvae)：參考取樣與重建分開呈現的流程，支持先驗生成的說明。
- [Google：What is a Generative Model?](https://developers.google.com/machine-learning/gan/generative)：支持分布與分類邊界的比較；低標註流程是本頁教學設計，沒有實測優劣。
- [scikit-learn：LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)：支持低標註流程的分類器選擇；兩類訓練條件另經本組核算腳本實測。
- 共用合成資料 `content/examples/L21103-B-image-cards.json`：支持兩領域取樣、條件卡及標註預算流程。

## 小結

- VAE 用潛在分布取樣再解碼，重建與從先驗生成要分清楚。
- 變分下界服務機率建模，不能取代細節或任務驗收。
- 重建、真偽對抗與多步去噪是不同的學習機制。（補充）
- 低標註選模要固定評估資料，合成資料不能代替真實測試。（補充）
