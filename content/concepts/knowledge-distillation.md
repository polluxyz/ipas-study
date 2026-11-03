---
id: knowledge-distillation
title: 知識蒸餾
kind: technique
codes: [L23304, L21103, L21302]
aliases: [Knowledge Distillation, 教師學生模型]
summary: 知識蒸餾用教師的輸出教學生，換取較小模型的部署成本
goals:
  - id: g1
    text: 安排教師與學生的訓練流程，辨識額外成本和偏誤傳遞
  - id: g2
    text: 計算溫度軟目標與混合損失，說明硬標籤沒有提供的類別關係
requires: [output-loss-contract, model-resource-costs]
guide_refs: [guide-3:5-49, guide-3:5-50, guide-3:5-57, guide-1:3-81]
formula_groups:
  - id: temperature-softmax
    source: https://arxiv.org/html/1503.02531v1
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-E
  - id: distillation-loss
    source: https://docs.pytorch.org/tutorials/beginner/knowledge_distillation_tutorial.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊已有教師，教學分類頭為 43 個參數；準備訓練 19 個參數的學生。下列哪項成本安排合理？
    options:
      A: 部署只需學生，但建置須計教師推論及學生訓練
      B: 部署只需學生，因此建置不需任何額外運算
      C: 部署必須保留教師，所以學生無法節省運算
      D: 部署必須合併權重，才能省略學生的訓練程序
    answer: A
    explain:
      A: 蒸餾增加離線建置成本，部署可單獨使用學生。
      B: 教師產生目標與學生學習都需要運算。
      C: 完成蒸餾後，學生推論通常不必再呼叫教師。
      D: 蒸餾是訓練學生，不是把兩個不同架構的權重直接合併。
  - id: c2
    goal: g2
    type: choice
    prompt: 三類教師 logits 為 [4,2,0]，真實類別為 0；溫度設為 2。哪個目標保留了非正解類別的相似程度？
    options:
      A: 用硬標籤 [1,0,0]，保留類別 1 比類別 2 更接近的訊息
      B: 用硬標籤 [0,1,0]，保留類別 1 比類別 2 更接近的訊息
      C: 用軟目標約 [0.665,0.245,0.090]，保留兩個次要類別的差異
      D: 用軟目標約 [0.333,0.333,0.333]，保留三類原有的分數差異
    answer: C
    explain:
      A: 硬標籤把兩個非正解類別都記為零，沒有保留其相對差異。
      B: 這除了沒有保留類別關係，也把真實類別改錯。
      C: 對 logits 除以 2 再做 softmax，非正解機率仍有大小之分。
      D: 完全均勻的機率不再反映這組有限溫度下的教師偏好。
  - id: c3
    goal: g1
    type: choice
    prompt: 行動影像的教師在夜間影像特別容易誤判；學生整體準確率已達 92%。下一步應怎麼驗收？
    options:
      A: 只查平均延遲，因為 92% 已證明各場景都可靠
      B: 分日夜檢查錯誤，因為學生可能沿用教師的偏誤
      C: 只查模型大小，因為參數減少就表示偏誤已降低
      D: 改用教師標籤驗收，因為教師輸出必然等於真相
    answer: B
    explain:
      A: 整體準確率會掩蓋特定場景的錯誤。
      B: 蒸餾可能傳遞教師偏誤，需用獨立真實標籤分群驗證。
      C: 模型尺寸與偏誤是不同問題。
      D: 教師會錯，不能把模仿教師的程度當作對真實答案的正確率。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

行動裝置可能放不下大型模型，也等不了每次推論。知識蒸餾（Knowledge distillation）讓較小的學生學教師，目標是在部署成本下降時保住效果。

它仍需要訓練學生。省下的是後續部署的負擔，蒸餾本身會增加時間與運算成本。

## 直覺

教師對同一輸入產生輸出，學生根據這些訊息學習。教師有偏誤時，學生也可能學到；教師表現好，也不保證較小的學生模型能完全重現。

![訓練時教師提供學習訊息，部署時只留下學生；教師的錯誤也可能沿箭頭傳下去。](figure:l23304-knowledge-distillation-flow)

:::supplement[來源：Hinton 等人 Distilling the Knowledge in a Neural Network 第 2 節]
硬標籤只說「這張是貓」。軟目標還能表達「比起汽車，它更像狗」，讓學生學到非正解類別之間的差異。
:::

## 定義與公式（補充）

### 溫度軟目標

將輸出分數 logits 記為 $z_i$，對三類使用溫度 softmax：

$$
p_i(T)=\frac{\exp(z_i/T)}{\sum_{j=0}^{2}\exp(z_j/T)},\qquad T>0.
$$

$i,j$ 是類別索引，$T$ 是溫度，$p_i(T)$ 是該類的軟目標機率。教師與學生比較時使用同一溫度；真實標籤的損失仍用學生在 $T=1$ 的機率。

溫度升高通常使分布較平滑，次要類別的差異比較容易看見。溫度過高則接近均勻分布，原有偏好會變弱，不能當成越高越好。

### 硬標籤與教師共同教

本頁採一種常見的混合損失，兩個係數相加為 1：

$$
\begin{aligned}
L_{\mathrm{hard}}&=-\ln p^{s}_{y}(1),\\
D_{\mathrm{KL}}&=\sum_i p^{t}_i(T)\ln\frac{p^{t}_i(T)}{p^{s}_i(T)},\\
L&=\alpha L_{\mathrm{hard}}+(1-\alpha)T^2D_{\mathrm{KL}}.
\end{aligned}
$$

$y$ 是真實類別，上標 $t,s$ 指教師與學生，$\ln$ 是自然對數；KL 衡量分布差異。$\alpha$ 在 0 到 1 間控制硬標籤比重；溫度平方補償梯度尺度變化。

這是單筆、對類別加總的公式；批次時再取樣本平均。教師輸出在學生訓練中當固定目標，不沿教師分支更新參數。

## 算一次（補充）

### 先盤點大小與成本（補充）

共用檔 `L23304-E-compression.json` 有行動影像、法律摘要各 60 筆。兩域都固定 36 筆訓練、12 筆驗證、12 筆測試，各策略沿用相同索引。

教學分類頭承接前置頁的 4→5→3，共 43 個參數。學生改成 4→2→3，共 19 個；這些小層表只示範分類頭容量，不能代表完整影像模型或法律摘要模型。

| 教學分類頭 | 參數數 | FP32 原始容量 | 建置時還要做什麼 |
|---|---|---|---|
| 教師 4→5→3 | 25＋18＝43 | 43×4＝172 bytes | 先取得可用教師 |
| 學生 4→2→3 | 10＋9＝19 | 19×4＝76 bytes | 教師產生目標、訓練學生 |

相同 36 筆訓練資料，若教師目標快取一次，就是 36 次樣本前向；學生訓練 5 輪則接觸 180 次樣本。這是樣本處理量，不等於 216 個相同成本的操作。

### 再算一筆軟目標（補充）

取訓練索引 0，真實類別為 0。教師 logits 為 [4,2,0]，學生為 [2,1,0]；硬標籤是 [1,0,0]。

| 分布 | 類別 0 | 類別 1 | 類別 2 |
|---|---|---|---|
| 教師，$T=1$ | 0.866813 | 0.117310 | 0.015876 |
| 教師，$T=2$ | 0.665241 | 0.244728 | 0.090031 |
| 學生，$T=2$ | 0.506480 | 0.307196 | 0.186324 |

以溫度 2 為例，分母為 $e^2+e^1+e^0$，教師第 0 類為 $e^2/(e^2+e+1)\approx0.665241$。其餘機率用相同分母，所以三類總和為 1。

學生在 $T=1$ 的第 0 類機率為 0.665241，硬損失約 0.407606。三類 KL 約 0.060269；取 $\alpha=0.5$，總損失為：

$$
L\approx0.5\times0.407606+0.5\times4\times0.060269=0.324341.
$$

本例刻意讓學生 logits 等於教師的一半，所以學生 $T=1$ 與教師 $T=2$ 的機率相同。同溫度比較時兩者仍不同，不能據此判定學生已學會教師。

## 程式（補充）

先在專案根目錄的 PowerShell 設定 `$env:IPAS_REPO_ROOT=(Get-Location).Path`，讓程式讀取本 repo 的絕對路徑。

下面讀同一筆固定資料，以 PyTorch 核對；同頁兩段接續執行。

```python
import json, os
from pathlib import Path
import torch
import torch.nn.functional as F
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23304-E-compression.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
r = d['vision'][d['distillation']['row_index']]
t = torch.tensor([r['teacher_logits_3']], dtype=torch.float64)
s = torch.tensor([r['student_logits_3']], dtype=torch.float64, requires_grad=True)
T, a = d['distillation']['temperature'], d['distillation']['hard_weight']
pt, ps = F.softmax(t / T, dim=1), F.softmax(s / T, dim=1)
print('教師 T=2:', [round(v, 6) for v in pt[0].tolist()])
print('學生 T=2:', [round(v, 6) for v in ps[0].tolist()])
```
```text
教師 T=2: [0.665241, 0.244728, 0.090031]
學生 T=2: [0.50648, 0.307196, 0.186324]
```

```python
hard = F.cross_entropy(s, torch.tensor([r['class_id']]))
kl = F.kl_div(F.log_softmax(s / T, dim=1), pt.detach(), reduction='batchmean')
loss = a * hard + (1 - a) * T**2 * kl
loss.backward()
print(f'硬損失={hard.item():.6f}, KL={kl.item():.6f}, 總損失={loss.item():.6f}')
print('教師有梯度:', t.grad is not None, '學生有梯度:', s.grad is not None)
```
```text
硬損失=0.407606, KL=0.060269, 總損失=0.324341
教師有梯度: False 學生有梯度: True
```

:::tip[讀碼重點]
`kl_div` 第一個參數接學生的對數機率，第二個接教師機率。`batchmean` 對樣本平均，與本頁對類別加總的公式一致。
:::

## 怎麼用、怎麼判讀

適合已有可用教師、部署端卻受記憶體或即時延遲限制的情況。驗收要同時看學生效果、部署成本，以及教師弱點是否延續，不能只比較大小。

:::supplement[來源：PyTorch Knowledge Distillation Tutorial；Keras Knowledge Distillation]
若要判斷蒸餾的貢獻，還應比較「同架構學生只用硬標籤」的基準，固定資料切分與訓練預算。換學生架構又換資料，無法把差異全歸給蒸餾。
:::

### 換個場景

| 場景 | 條件 | 判讀重點 |
|---|---|---|
| 行動影像、邊緣節點 | 硬體有限、要求低延遲 | 學生模型的效果是否仍可接受 |
| 法律摘要（補充） | 長文、專業事實不能遺漏 | 分開查摘要品質、事實錯誤與延遲 |
| 工廠聲音分類（補充） | 稀有異音、教師也可能錯 | 用真實標籤檢查少數異音 |

:::supplement[來源：Keras Knowledge Distillation；本組教學資料]
法律摘要卡的測試集學生平均品質為 84.5 分、延遲為 92.5 ms；假設門檻為 85 分及 100 ms，速度通過，品質仍未通過。三類影像的損失算例不能直接充當摘要生成的評估方法。
:::

## 常見誤解

- 「學生一定和教師一樣準」：學生容量與訓練條件都可能限制效果。
- 「教師準就沒有偏誤」：整體效果好，仍可能對特定群體或場景較差。
- 「軟目標就是把教師最高類別改成硬標籤」：後者會丟掉其餘類別的相對機率。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:5-49`～`guide-3:5-50`：目的、資源受限場景、額外成本與偏誤傳遞；`guide-3:5-57` 只提軟標籤名稱。
- 科目 1 指引 `guide-1:3-81`：邊緣多模態模型的壓縮需求。
- [Hinton 等人原論文第 2 節](https://arxiv.org/html/1503.02531v1)：溫度、非正解類別資訊與尺度補償，支持定義及軟目標算例。
- [PyTorch 蒸餾教學](https://docs.pytorch.org/tutorials/beginner/knowledge_distillation_tutorial.html)：混合損失、KL 方向與固定教師，支持程式及基準比較。
- [Keras 蒸餾教學](https://keras.io/examples/vision/knowledge_distillation/)：從教師到學生的分階段教法，支持流程與效果比較。

## 小結

- 蒸餾讓學生學教師，部署成本與訓練成本要分開盤點。
- 學生仍需驗證效果，也可能繼承教師偏誤。
- 溫度軟目標保留類別關係，溫度與混合權重須用驗證資料選擇。（補充）
