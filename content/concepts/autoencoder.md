---
id: autoencoder
title: 自編碼器與重建
kind: model
codes: [L23203]
aliases: [AE, Denoising Autoencoder]
summary: 自編碼器把輸入編成受限表示，再解碼回原來的資料維度
requires: [output-loss-contract]
contrasts:
  - target: gan
    note: 傳統自編碼器對照輸入做重建，GAN 透過生成器與判別器競爭學習生成
    source: [guide-3:4-86, guide-3:4-87]
guide_refs: [guide-3:4-85, guide-3:4-86, guide-3:4-87]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 追蹤編碼、瓶頸與解碼的形狀，依輸入資料選擇重建目標與損失
  - id: g2
    text: 依壓縮、去噪及異常偵測判讀重建結果，說明潛在採樣與漏報限制
formula_groups:
  - id: reconstruction-map-mse
    source: https://www.tensorflow.org/tutorials/generative/autoencoder ; https://docs.pytorch.org/docs/2.9/generated/torch.nn.MSELoss.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-I
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠把每筆 4 個連續感測值壓成 2 個值，再重建 4 個值。標準自編碼器的訓練安排何者合理？
    options:
      A: 輸入 4 值，目標為 2 個故障類別，採用分類交叉熵
      B: 輸入 4 值，目標為原來的 4 值，採用重建均方誤差
      C: 輸入 2 值，目標為真假資料標籤，採用二元交叉熵
      D: 輸入 4 值，目標為隨機抽出的 4 值，採用重建均方誤差
    answer: B
    explain:
      A: 分類標籤不等於輸入重建目標，瓶頸的兩個值也不是兩類標籤。
      B: 連續值以原輸入為重建目標，均方誤差衡量各感測值的差距。
      C: 真偽分類是 GAN 判別器的任務，沒有描述四維輸入的重建。
      D: 任意換目標會破壞每筆輸入與自身目標的配對關係。
  - id: c2
    goal: g1
    type: choice
    prompt: 某固定編碼器把第 1、3 值及第 2、4 值各取平均再還原。輸入 [1,2,3,2] 的四值平均重建 MSE 是多少？
    options: { A: '2.00', B: '1.00', C: '0.50', D: '0.25' }
    answer: C
    explain:
      A: 2 是平方誤差總和，還沒有除以四個感測值。
      B: 1 是只除以瓶頸維度，MSE 分母應為比較的四個值。
      C: 重建為 [2,2,2,2]，平方誤差和為 2，除以 4 得 0.5。
      D: 0.25 把分母擴大到八個值，與本題定義不同。
  - id: c3
    goal: g2
    type: choice
    prompt: 團隊用正常資料訓練重建模型，驗證門檻為 0.1；新設備重建 MSE 為 0.02。最恰當的處置是？
    options:
      A: 目前未超過門檻，仍查核模型是否會重建某些故障
      B: 已證明設備正常，直接取消所有後續的故障查核
      C: 可換算故障機率，依 2% 的風險設定保養排程
      D: 應一律判定故障，因為任何非零誤差都代表異常
    answer: A
    explain:
      A: 低誤差只表示模型能重建這筆資料，仍可能有沿正常結構的漏報。
      B: 異常也可能重建良好，未超門檻不能證明絕對正常。
      C: MSE 的單位與定義是重建平方誤差，不是校準的故障機率。
      D: 正常雜訊也會產生誤差，需要經驗證的判定規則。
  - id: c4
    goal: g2
    type: choice
    prompt: 商品影像模型要濾除固定幅度的感測雜訊。以下哪種輸入與訓練目標配對最符合去噪用途？
    options:
      A: 輸入乾淨圖，目標為另一商品圖，強迫模型改換商品
      B: 輸入含噪圖，目標為同一含噪圖，強迫模型保留雜訊
      C: 輸入乾淨圖，目標為隨機噪聲圖，強迫模型製造雜訊
      D: 輸入含噪圖，目標為對應乾淨圖，讓模型學習去除雜訊
    answer: D
    explain:
      A: 更換商品破壞對應，沒有提供去噪後應保留的內容。
      B: 這是含噪資料的自身重建，並未明確要求去除雜訊。
      C: 目標噪聲會教模型產生噪聲，方向與去噪相反。
      D: 受擾與乾淨版本配對，讓重建損失懲罰殘留雜訊。
---

## 為什麼需要

設備每次上傳很多感測值，其中可能有重複資訊。自編碼器（Autoencoder，AE）用受限的中間表示保留結構，再檢查能否還原輸入。

它能做壓縮、去噪與特徵學習。異常偵測則利用正常資料通常較容易重建的差異，將大誤差當成待查訊號。

## 直覺

編碼器（Encoder）先把資料轉成潛在表示，解碼器（Decoder）再把它轉回原維度。瓶頸層（Bottleneck Layer）限制可保留的資訊，促使模型找出可重用的關係。

標準自編碼器不需人工類別標籤，以輸入本身作訓練目標，屬非監督式學習。

![注意中間只有兩個值，但輸出仍回到四個感測值，重建目標不變成分類標籤。](figure:l23203-autoencoder-bottleneck)

傳統自編碼器主要學習重建；生成對抗網路則以真偽對抗學習產生樣本。普通自編碼器的潛在空間未受生成分布約束，任意取一點解碼，不保證得到合理資料。

重建任務也未必學到生成新資料所需的分布特性，因此直接用來生成的品質可能有限。

## 定義與公式

標準重建以輸入本身作目標。連續感測值常用均方誤差；二元像素可採二元交叉熵，輸出格式要與損失函數配對。

### 重建映射與逐值平均（補充）

$$
z=f_\theta(x),\qquad \hat{x}=g_\phi(z),\qquad
e(x)=\frac{1}{d}\sum_{j=1}^{d}(x_j-\hat{x}_j)^2.
$$

$x$ 是輸入、$z$ 是瓶頸、$\hat{x}$ 是重建；$\theta$、$\phi$ 是網路參數。$d=4$ 是輸入值數，$j$ 是特徵索引，$e(x)$ 是該筆 MSE。

各特徵先採可比較尺度，否則大單位欄位可能主導誤差。這裡每筆對四值取平均；批次再平均才是整批損失，不能把瓶頸維度當分母。

## 算一次（補充）

共用檔 `L23203-I-reconstruction-generation.json` 有設備讀值與商品圖。此處以預設矩陣驗證重建機制，並未訓練故障偵測器。

設備探針 $x=[1,2,3,2]$，編碼器將第一與第三、第二與第四各取平均，得 $z=[2,2]$。解碼器重複兩值，得到 $\hat{x}=[2,2,2,2]$。

代入公式，$e(x)=(1+0+1+0)/4=0.5$。正常探針 [1,2,1,2] 能完全重建，誤差為 0；含噪探針 [1.2,2,0.8,2] 的自身重建誤差為 0.02。

本例的配對擾動是 +0.2 與 −0.2，取平均後恰好抵消。一般雜訊未必抵消，若兩值同向偏移，平均後仍會留下偏差。

將門檻暫設 0.1，偏離關係探針會被標記；門檻尚未經驗證校準。讀值 [4,4,4,4] 符合配對關係，但第一感測值超出正常資料的 1～3 範圍。

若現場把超範圍讀值視為異常，此模型會漏報，因為它仍能完全重建這筆資料。

## 程式（補充）

在專案根目錄的 PowerShell 設 `$env:IPAS_REPO_ROOT=(Get-Location).Path`。程式讀共用 JSON，以固定矩陣重建。

```python
import json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-I-reconstruction-generation.json').read_text(encoding='utf-8'))
p = d['reconstruction_probe']
encoder, decoder = np.array(p['encoder']), np.array(p['decoder'])
for name in ['clean', 'noisy', 'fault', 'unseen_normal_direction']:
    x = np.array(p[name])
    z = x @ encoder
    restored = z @ decoder
    print(name, '重建=', restored.tolist(), 'MSE=', round(float(np.mean((x-restored)**2)), 4))
restored = np.array(p['noisy']) @ encoder @ decoder
print('含噪重建對乾淨目標MSE=', round(float(np.mean((restored-np.array(p['clean']))**2)), 4))
```
```text
clean 重建= [1.0, 2.0, 1.0, 2.0] MSE= 0.0
noisy 重建= [1.0, 2.0, 1.0, 2.0] MSE= 0.02
fault 重建= [2.0, 2.0, 2.0, 2.0] MSE= 0.5
unseen_normal_direction 重建= [4.0, 4.0, 4.0, 4.0] MSE= 0.0
含噪重建對乾淨目標MSE= 0.0
```

:::tip[讀碼重點]
`x @ encoder` 是 4 值變 2 值，接著回到 4 值。最後一行改用乾淨目標，與迴圈內「對含噪輸入自身」的誤差回答不同問題。
:::

## 怎麼用、怎麼判讀

壓縮以解碼結果確認資訊損失；特徵學習把瓶頸表示交給後續分類或分群。去噪自編碼器（Denoising Autoencoder）以受擾資料為輸入、乾淨資料為目標，學習移除雜訊。

異常偵測用正常資料建立重建能力，再檢查新資料的誤差。大誤差表示與模型習得的結構有落差；不能直接把誤差解讀成故障機率。

![注意偏離配對關係的探針誤差較大，但符合關係且超出正常範圍的讀值仍可能誤差為零。](figure:l23203-autoencoder-errors)

:::supplement[來源：TensorFlow Intro to Autoencoders 的 Anomaly detection]
正常訓練集、正常驗證集與待測樣本分開；縮放參數只從訓練集取得。門檻以驗證資料及漏報、誤報代價決定，最後再評估獨立測試集。
:::

### 換個場景

| 場景或條件 | 怎麼用 | 要注意什麼 |
|---|---|---|
| 高維資料壓縮 | 編碼為緊湊表示再解碼 | 維度減少仍可能丟失重要訊息 |
| 特徵學習與預訓練 | 瓶頸表示接下游任務 | 重建良好不保證分類有效 |
| 含噪資料與離群值 | 配對去噪或查重建誤差 | 去噪目標與異常判定不同 |
| 商品攝影（補充） | 用乾淨圖監督受擾圖重建 | 不應抹掉商品的細小缺陷 |
| 穿戴式感測（補充） | 正常訊號建模後查大誤差 | 新活動型態也可能被誤報 |

## 常見誤解

- 「瓶頸有兩個值，所以模型分兩類。」瓶頸是表示維度，不是類別數。
- 「重建輸出與輸入等大，就沒有壓縮。」要看中間表示是否較緊湊。
- 「重建誤差低就一定正常。」有些異常也可能符合模型學到的重建結構。
- 「隨機抽潛在向量都能生成新品。」普通自編碼器沒有這項保證。

## 進階

### 容量與重建的取捨（補充）

網路太有能力時，可能把訓練資料近乎照搬，異常也重建得很好。瓶頸、正則化與去噪訓練會限制表示，但仍要以實際下游任務驗證。

### 參考來源

- 科目 3 學習指引 4-85～4-87：支持結構、重建損失配對、壓縮、特徵學習、去噪、異常偵測與潛在採樣限制。
- [TensorFlow：Intro to Autoencoders](https://www.tensorflow.org/tutorials/generative/autoencoder)：支持重建映射、異常流程、門檻與容量限制，作為官方定義及教學流程參考。
- [Keras：Convolutional autoencoder for image denoising](https://keras.io/examples/vision/autoencoder/)：支持受擾輸入配乾淨目標的教學設計、商品去噪換景。
- [PyTorch：MSELoss](https://docs.pytorch.org/docs/2.9/generated/torch.nn.MSELoss.html)：支持逐元素平方後取平均的補充公式與算例。

## 小結

- 標準自編碼器以輸入為目標，經瓶頸再重建。
- 壓縮、去噪、特徵學習與異常偵測有不同的判讀目的。
- 低重建誤差不能保證資料正常，也不保證下游任務有效。
- 傳統自編碼器任意潛在採樣，不保證輸出合理，生成品質也可能有限。
