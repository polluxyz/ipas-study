---
id: gan
title: 生成對抗網路
kind: model
codes: [L21103, L21301, L23203]
aliases: [Discriminator, Generative Adversarial Network, Generator, WGAN, generative-adversarial-network, 生成對抗網路 GAN]
summary: 生成對抗網路透過生成器造樣本、判別器辨真偽的競爭學習資料分布
requires: [output-loss-contract, backpropagation]
guide_refs: [guide-1:3-62, guide-1:3-63, guide-1:5-12, guide-1:5-13, guide-3:4-87, guide-3:4-88, guide-3:4-89]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 追蹤噪聲、真偽兩路及梯度，指出交替訓練時各自更新哪些參數
  - id: g2
    text: 辨認多樣性不足，解釋 WGAN、critic 與梯度懲罰的改善方向及限制
  - id: g3
    text: 依多樣性、訓練穩定性及控制需求比較 GAN、VAE 與擴散模型
formula_groups:
  - id: adversarial-binary-loss
    source: https://developers.google.com/machine-learning/gan/loss
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-I
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊每批取 12 張真圖與 12 張生成圖，先訓練判別器，再訓練生成器。何者符合交替更新？
    options:
      A: 判別階段只更新判別器；生成階段經固定判別器把梯度傳回生成器
      B: 判別階段同時更新兩者；生成階段把判別器運算整段設成無梯度
      C: 判別階段只更新生成器；生成階段則對真圖的分類結果更新判別器
      D: 判別階段固定兩組權重；生成階段直接用新噪聲向量取代模型權重
    answer: A
    explain:
      A: 兩階段分別更新各自參數，生成階段仍需判別器對輸入的導數。
      B: 同時更新不符合本題分工，生成階段整段關梯度會切斷學習路徑。
      C: 此安排把兩個階段的更新對象對調，生成器也沒得到假樣本回饋。
      D: 兩階段需要以損失更新模型參數，新噪聲只是輸入而非權重。
  - id: c2
    goal: g2
    type: choice
    prompt: 24 張商品生成圖都很清楚，卻只有橫紋與直紋，沒有訓練資料中的十字。改用 WGAN-GP 最合理的期待是？
    options:
      A: 改為三類分類損失，就能保證每類產出 8 張而完全不重複
      B: 移除評分網路的限制，就能保證生成圖覆蓋所有正常模式
      C: 改善分布差異的學習訊號，但仍需查核模式覆蓋與訓練穩定性
      D: 只保留重建誤差作目標，就能保證任意噪聲解碼成合理新品
    answer: C
    explain:
      A: WGAN-GP 並非直接換成三類分類，也沒有平均產量或不重複的保證。
      B: critic 需要受約束，任意移除限制會失去這項方法的依據。
      C: Wasserstein 方向與梯度懲罰可改善學習條件，不能取代輸出驗證。
      D: 純重建目標不同於 WGAN-GP，也不保證隨機潛在點都合理。
  - id: c3
    goal: g3
    type: choice
    prompt: 某公司需要 3 種商品風格且能依文字指定樣式。GAN、VAE、擴散候選尚未用同一資料比較，應如何選擇？
    options:
      A: 只比較幾張最漂亮的圖，直接把視覺最銳利的模型當成完整方案
      B: 同時查覆蓋、穩定性與條件遵循，再比較生成品質和推論成本
      C: 只比較訓練輪數的多寡，直接把輪數最多的模型當成完整方案
      D: 只比較模型名稱的類型，直接把採用擴散的模型當成完整方案
    answer: B
    explain:
      A: 精選樣本無法呈現缺漏模式，也未驗證文字條件是否被遵守。
      B: 需求包含多樣性與可控性，需要相同條件的實測才能決定取捨。
      C: 輪數不是跨架構可比的品質或成本單位，還缺少需求驗證。
      D: 架構名稱不能證明條件控制有效，也不能替代成本與品質比較。
  - id: c4
    goal: g1
    type: choice
    prompt: 設判別器的輸出是為真的機率。更新生成器時，假圖的輸出從 0.25 升為 0.5；以負自然對數為損失，應如何判讀？
    options:
      A: 損失由 0.288 升至 0.693，表示生成器更難騙過判別器
      B: 損失由 1.386 升至 2.773，表示生成器更難騙過判別器
      C: 損失由 0.250 降至 0.125，表示生成器已學會完整分布
      D: 損失由 1.386 降至 0.693，表示此批更能騙過固定判別器
    answer: D
    explain:
      A: 這是對一減機率取負對數，屬於另一個目標，與題目的生成損失不同。
      B: 負對數在機率變大時會下降，2.773 不是負對數 0.5 的結果。
      C: 負對數不是直接除二的機率，單一批次改善也不能證明完整覆蓋。
      D: 負對數 0.25 約 1.386，負對數 0.5 約 0.693，生成目標有所改善。
---

## 為什麼需要

想產生新商品圖時，通常沒有一張指定的正確圖片可逐像素比對。生成對抗網路的英文是 Generative Adversarial Network，簡稱 GAN；它改用另一個網路提供真偽回饋。

生成器（Generator）把噪聲轉成資料，判別器（Discriminator）學會辨認真資料與生成資料。兩者交替改善，目標是讓生成分布接近真實分布。

## 直覺

生成器看的是噪聲向量；判別器看的是資料樣本。訓練判別器時，真資料與生成資料分成兩路；訓練生成器時，則透過固定判別器取得修改輸出的方向。

![注意第二階段仍讓梯度穿過判別器，只固定它的參數，並未切斷回到生成器的路。](figure:l23203-gan-alternating)

普通自編碼器用輸入作重建目標；GAN 用真偽競爭提供學習訊號。能欺騙判別器的個別樣本，仍可能只有少數類型，這是 GAN 模式崩潰要處理的問題。

## 定義與公式

| 階段 | 輸入與目標 | 更新參數 | 固定參數 |
|---|---|---|---|
| 訓練判別器 | 真資料標 1，生成資料標 0 | 判別器 | 生成器 |
| 訓練生成器 | 生成資料希望被判為真 | 生成器 | 判別器 |

判別器是二元分類器。生成器的資料維度取決於任務，例如四個感測值或一張影像；不能把它的輸出誤當真偽機率。

### 一個常用的損失版本（補充）

以一真一假為例，採判別器兩路等權平均，以及非飽和生成損失：

$$
\begin{aligned}
L_D&=-\tfrac12\left[\log D(x)+\log(1-D(G(z)))\right],\\
L_G&=-\log D(G(z)).
\end{aligned}
$$

$x$ 是真資料、$z$ 是噪聲，$G$ 是生成器，$D$ 是判別器。$D$ 輸出「為真」的機率；$L_D$、$L_G$ 分別由兩個優化器最小化，對數為自然對數。

機率先取在零與一之間；實作以 logits 搭配穩定交叉熵避免直接算 log(0)。前面的二分之一是本頁平均約定，不是所有 GAN 都採同一個縮放。

真資料評分為 0.8、假資料為 0.25 時，判別損失是 −（ln 0.8＋ln 0.75）÷2，約 0.255413；生成損失是 −ln 0.25，約 1.386294。

這是固定機率的算值示範。真正更新生成器時，還要從該機率的梯度追到生成器參數。

## 走一次流程

:::supplement[來源：本組共用例子；PyTorch DCGAN 教學]
共用例子有 24 筆設備資料與 24 張商品圖，每個模式前四筆屬訓練集。程式只從中各取一筆 S01、S09、S17，示範一輪更新。

切分固定後，才用驗證資料調整設定；以下兩階段均不使用驗證或測試資料更新參數。
:::

1. 從簡單分布抽取噪聲，送入生成器取得候選資料。
2. 真設備讀值及生成讀值分別送入判別器；以真 1、假 0 的目標，只更新判別器。
3. 固定判別器參數，重新讓生成讀值經過它；以被判為真的方向，只更新生成器。
4. 重複交替，檢查結果是否逼真及是否缺漏模式。

:::supplement[來源：本組共用例子；Google GAN 課程 Common Problems]
商品對照刻意抽出 12 張橫紋、12 張直紋、0 張十字，展示多樣性不足。它們不是上述小網路的訓練成果；增加訓練步數也不保證達成平衡。
:::

## 程式（補充）

先在 PowerShell 設 `$env:IPAS_REPO_ROOT=(Get-Location).Path`。三段依序執行，使用 CPU、固定種子，只核對一輪參數更新，不要求生成樣本已收斂。

```python
import json, os, torch
from pathlib import Path
torch.manual_seed(23203)
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-I-reconstruction-generation.json').read_text(encoding='utf-8'))
q = d['gan_probe']
real = torch.tensor([r['sensors'] for r in d['devices'] if r['id'] in q['real_device_ids']], dtype=torch.float32)
z = torch.tensor(q['noise'], dtype=torch.float32)
G, D = torch.nn.Linear(2, 4), torch.nn.Linear(4, 1)
opt_g = torch.optim.SGD(G.parameters(), lr=q['learning_rate'])
opt_d = torch.optim.SGD(D.parameters(), lr=q['learning_rate'])
loss = torch.nn.BCEWithLogitsLoss()
snapshot = lambda net: [p.detach().clone() for p in net.parameters()]
changed = lambda net, old: any(not torch.equal(p, b) for p, b in zip(net.parameters(), old))
print('真資料與噪聲形狀:', tuple(real.shape), tuple(z.shape))
```
```text
真資料與噪聲形狀: (3, 4) (3, 2)
```

```python
g0, d0 = snapshot(G), snapshot(D)
opt_d.zero_grad()
real_logits, fake_logits = D(real), D(G(z).detach())
ld = (loss(real_logits, torch.ones_like(real_logits)) +
      loss(fake_logits, torch.zeros_like(fake_logits))) / 2
ld.backward()
opt_d.step()
print('判別階段 G更新／D更新:', changed(G, g0), changed(D, d0))
```
```text
判別階段 G更新／D更新: False True
```

```python
g1, d1 = snapshot(G), snapshot(D)
for p in D.parameters():
    p.requires_grad_(False)
opt_g.zero_grad()
fake_logits = D(G(z))
lg = loss(fake_logits, torch.ones_like(fake_logits))
lg.backward()
opt_g.step()
for p in D.parameters():
    p.requires_grad_(True)
print('生成階段 G更新／D更新:', changed(G, g1), changed(D, d1))
```
```text
生成階段 G更新／D更新: True False
```

:::tip[讀碼重點]
判別階段的 `detach()` 切斷到生成器的路；生成階段不可這樣切。固定判別器參數後，仍保留它對輸入的導數，梯度才回得到生成器。
:::

本例兩個網路只有線性層，沒有批次正規化的運行統計或 Dropout。大型模型還要分清參數凍結與訓練／推論模式，兩者不是同一項設定。

## 怎麼用、怎麼判讀

GAN 可用於人臉、動物、風景、藝術與動畫角色生成，也可用於資料增強、風格轉換、修復、超解析度及上色。指引還列出跨模態生成，並提醒 GAN 難以生成結構複雜的長序列。

科目 1 指引列出 DCGAN 的卷積架構、CycleGAN 的風格轉換與 StyleGAN 的高品質人臉生成。選模時要先區分目標是創造新圖，還是轉換既有影像。

:::supplement[來源：CycleGAN 原論文；StyleGAN 原論文]
CycleGAN 的重要條件是可以使用未配對的兩個影像集合，並加上循環一致性約束。StyleGAN 的分層風格控制也不等於直接理解任意文字指令。

跨模態生成需要相應的條件輸入與架構，普通噪聲輸入並不自帶文字控制能力。訓練資料與可控制的屬性仍需分別確認。
:::

### WGAN 的改善方向（補充）

原本的真偽判斷若太容易，生成器可能收到較弱的學習訊號。WGAN 改看分布搬運成本：把生成樣本的質量移到真實分布，需要多少代價。

即使兩個分布尚未重疊，Wasserstein 距離也能隨生成分布移動而連續變化。相較於飽和的真偽損失，這更可能提供有用的更新方向，仍需受約束且訓練充分的評分器。

它使用評分器（critic）給實數分數，不把輸出當真實機率；評分器還需滿足 Lipschitz 約束，限制輸入變動造成的評分變化。這項約束是距離近似的前提。

原始 WGAN 用權重截斷近似限制；WGAN-GP 改以真、假樣本之間插值點的輸入梯度懲罰，讓梯度範數靠近 1。這是對評分器「輸入梯度」的限制，與裁剪模型參數梯度不同。

兩者可改善訓練訊號與穩定性，也有助減輕多樣性問題；仍受容量、資料及優化影響。不能承諾換一個損失就消除所有模式崩潰。

### 按需求比較生成機制

| 機制 | 學習方式 | 指引列出的取捨 | 用途例子 |
|---|---|---|---|
| GAN | 生成器與判別器對抗 | 訓練易失衡，可能缺漏模式 | 圖像、人臉與風格生成 |
| VAE | 學習潛在機率分布 | 生成較平滑，細節可能不足 | 異常偵測與語音重建 |
| 擴散模型 | 學習逐步移除噪聲 | 圖像品質佳，生成較慢且成本高 | 影像與藝術生成 |

:::supplement[來源：Keras VAE 教學；Keras 去噪擴散教學；Google GAN 課程 Common Problems]
比較多樣性與控制需求時，還要在同一資料、切分與抽樣條件下逐項驗證：

- GAN：查缺漏模式與同類重複；控制輸出需條件式架構與對應資料。
- VAE：查先驗取樣及類型覆蓋；指定屬性需把條件納入編解碼設計。
- 擴散模型：查去噪樣本與類型覆蓋；指定樣式需驗證條件與引導方式。

本組商品任務若需要三種形狀及文字指定樣式，就同時檢查覆蓋、條件遵循、品質與時間。模型名稱本身不能保證符合需求，也沒有一種架構對所有資料都最佳。
:::

### 換個場景

| 場景或條件 | 怎麼用 | 判讀重點 |
|---|---|---|
| 人臉、動物、風景、藝術與動畫 | 生成相似分布的新圖 | 真實感與樣本多樣性一起查 |
| 資料增強與圖像轉換 | 擴充訓練或修復、上色、超解析 | 不能引入錯誤語意與假細節 |
| 跨模態生成 | 以文字等條件約束輸出 | 條件式架構是否真的遵循需求 |
| 設備感測（補充） | 合成正常負載供測試 | 除了單筆合理，還查負載覆蓋 |
| 零售商品（補充） | 生成多款商品展示 | 不能只展示同款的近似複本 |

## 常見誤解

- 「判別器固定，所以把整段運算關梯度。」生成階段仍需要經它回傳到生成器。（補充）
- 「判別正確率接近一半，就證明生成完美。」模型太弱或訓練失衡也可能如此。（補充）
- 「每張都清楚，就沒有模式崩潰。」少數類型也能很逼真。
- 「WGAN 的分數是為真的機率。」critic 給的是受約束的實數評分。（補充）

## 進階

### 參考來源

- 科目 3 學習指引 4-87～4-89：支持兩個網路、交替更新、用途與訓練、多樣性、量化評估限制。
- 科目 1 學習指引 3-62～3-63、5-12～5-13：支持 DCGAN、CycleGAN、StyleGAN 的定位、人臉與風格生成，以及 VAE／擴散模型的機制、品質和成本取捨。
- [Google GAN 課程：結構](https://developers.google.com/machine-learning/gan/gan_structure)、[損失](https://developers.google.com/machine-learning/gan/loss)、[常見問題](https://developers.google.com/machine-learning/gan/problems)：支持圖、損失、梯度路徑與模式崩潰解說，作為流程與直覺的教學參考。
- [PyTorch DCGAN 教學原始碼](https://raw.githubusercontent.com/pytorch/tutorials/main/beginner_source/dcgan_faces_tutorial.py)：支持 `detach`、真假標籤與兩個優化器的程式分工。
- [WGAN 原論文第 2、3 節](https://arxiv.org/html/1701.07875v3)、[WGAN-GP 原論文第 3、4 節](https://arxiv.org/pdf/1704.00028)：支持分布距離、critic、權重截斷、輸入梯度懲罰及有限條件。
- [CycleGAN 原論文](https://arxiv.org/abs/1703.10593)、[StyleGAN 原論文](https://arxiv.org/abs/1812.04948)：支持未配對轉換與分層風格控制的補充說明。
- [TensorFlow 自編碼器教學](https://www.tensorflow.org/tutorials/generative/autoencoder)、[Keras VAE 教學](https://keras.io/examples/generative/vae/)、[Keras 去噪擴散教學](https://keras.io/examples/generative/ddim/)：支持三種生成機制比較；表格是依機制整理的選型思路，不是本組小資料的實測排名。

## 小結

- 生成器把噪聲轉成資料，判別器分辨真偽。
- 兩階段各自更新參數；生成階段仍經固定判別器傳梯度。
- 樣本逼真、模式覆蓋與條件遵循需要分別檢查。
- WGAN 改善學習條件，仍無完整多樣性保證。（補充）
