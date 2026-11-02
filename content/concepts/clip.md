---
id: clip
title: CLIP 圖文共享表示
kind: model
codes:
  - L21104
  - L21102
aliases:
  - CLIP 圖文對比與零樣本分類
  - Contrastive Language-Image Pre-Training
  - 圖文對比學習
summary: CLIP 用圖文對比學習建立共享表示，可做匹配、檢索與候選零樣本分類
goals:
  - id: g1
    text: 說明圖文雙編碼器、正負配對與兩個對比方向
  - id: g2
    text: 讀相似度矩陣完成圖文匹配並核算零樣本候選
  - id: g3
    text: 區分檢索、零樣本分類與需要解碼器的圖說生成及限制
requires:
  - cross-modal-alignment
  - transformer
guide_refs:
  - guide-1:3-44
  - guide-1:3-75
  - guide-1:3-76
textbook: v2
author: codex
status: draft
formula_groups:
  - id: clip-similarity
    source: https://proceedings.mlr.press/v139/radford21a/radford21a.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21104-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一個 CLIP 教學批次含 3 對不同商品的圖文。每張圖對 3 段文字比較，再把每段文字對 3 張圖比較。哪個訓練描述正確？
    options:
      A: 圖與文各自編碼，在兩個方向提高已知配對相對於批內錯配的分數
      B: 圖先生成一段新描述，再把新描述與原圖拼成像素後一起分類
      C: 圖文都只進同一文字編碼器，因此所有圖片必須先人工轉寫
      D: 只把 3 個正配對都拉成零向量，便能讓餘弦相似度達到最大值
    answer: A
    explain:
      A: 雙編碼器提供可比較表示，兩個方向都用已知配對作為目標。
      B: 標準 CLIP 的核心訓練不是先生成圖說再分類。
      C: CLIP 有圖片與文字分支，不必先把圖片轉成文字。
      D: 零向量無法計算餘弦相似度，也不能區分批內候選。
  - id: c2
    goal: g2
    type: choice
    prompt: 零售 R01 對「紅杯、背包、雨傘」的相似度為 0.8、0、0.6，凍結模型並以這三個文字候選分類。何者合理？
    options:
      A: 選雨傘，因為候選相似度 0.6 低於 0.8，代表分類損失較小
      B: 選紅杯，因為此候選分數最高，但不能把 0.8 直接當正確率
      C: 選紅杯，因為最高分 0.8 已證明紅杯的材質與產地都正確
      D: 不分類，因為三個相似度總和 1.4，不符合機率加總等於 1
    answer: B
    explain:
      A: 相似度越高越匹配，這裡不是選最小損失。
      B: 零樣本分類比較候選描述，分數不等於任務正確率。
      C: 候選比較沒有驗證材質或產地等事實。
      D: 原始餘弦相似度不要求總和為 1，仍可做排序。
  - id: c3
    goal: g3
    type: choice
    prompt: 相簿已有 12 段描述，系統要替新照片寫出第 13 段未出現過的圖說。只有標準 CLIP，哪個判斷最恰當？
    options:
      A: 先把候選全刪除，CLIP 的圖片編碼器就會逐詞輸出新圖說
      B: 先從 12 段挑最高分，再把選出的既有文字視為已生成新句子
      C: 需接文字生成模組，CLIP 的表示或匹配可協助整個生成流程
      D: 無法使用 CLIP 表示，任何文字解碼器都只能接受原始文字
    answer: C
    explain:
      A: 圖片編碼器輸出表示，刪候選不會替它新增生成能力。
      B: 挑選既有描述是檢索，沒有產生新的第 13 段句子。
      C: 標準 CLIP 沒有逐詞文字解碼器，生成新圖說需額外模組。
      D: 文字生成模型可透過適當介面接收影像或跨模態表示。
---

## 為什麼需要

想用「紅色跑車」找圖片，或用照片找最合適的描述，需要先讓圖與文可以比較。CLIP 的核心是學這種共享表示，不必為每個新查詢重訓一個分類器。

CLIP 全名為 Contrastive Language-Image Pre-Training。它用大量配對圖文預訓練，將相符描述與圖片的分數提高。

## 直覺

一邊讀圖片，一邊讀文字，兩邊先各自形成向量，再做候選比較。訓練時已知哪一對原本相配，推論時則用學好的表示搜尋或選類別。

![兩個編碼器形成圖片列與文字欄，對角線是已知正配對；找圖對文讀一列，找文對圖讀一欄。](figure:l21104-clip-matrix)

## 定義與公式

OpenAI 於 2021 年提出 CLIP，以約 4 億對圖文進行預訓練。這是原模型的訓練規模，本頁的三維合成向量只用於演算。

圖片編碼器可採 ResNet 或 Vision Transformer（ViT），文字編碼器採 Transformer。兩路表示進入共同向量空間，再以對比損失共同學習。

:::supplement[來源：CLIP 原論文第 2.2 節與 Figure 3]
訓練固定一張圖，目標是從同批文字找出其配對；再固定一段文字，反向找配對圖片。正配對是學習目標，其他批內配對是對照。
:::

### 相似度怎麼算（補充）

依原論文，先將非零圖片向量 $\mathbf{x}_i$ 與文字向量 $\mathbf{t}_j$ 各自除以長度，再計算：

$$
S_{ij}=\frac{\mathbf{x}_i^{\mathsf T}\mathbf{t}_j}{\|\mathbf{x}_i\|_2\|\mathbf{t}_j\|_2}
$$

$S_{ij}$ 是圖 $i$ 對文 $j$ 的餘弦相似度；$\|\cdot\|_2$ 是長度，$\mathsf T$ 表轉置。

R01 的圖 $(1,0,0)$ 對文 $(0.8,0.6,0)$，長度皆為 1，內積為 $1\times0.8=0.8$，代入得 $S_{11}=0.8$。

原模型還會用可學習的尺度形成對比 logits。本頁只核算餘弦與排序，不把相似度當成已校準的機率，也不假裝完整重現訓練。

## 算一次

:::supplement[來源：CLIP 原論文第 2.2 節與 Figure 3]

共用例子的零售首組矩陣由兩路向量算出：

| 圖片＼文字 | 紅杯 R01 | 背包 R02 | 雨傘 R03 |
|---|---|---|---|
| 紅杯 R01 | 0.8 | 0 | 0.6 |
| 背包 R02 | 0.6 | 0.8 | 0 |
| 雨傘 R03 | 0 | 0.6 | 0.8 |

固定紅杯圖片讀第一列，0.8 最高，匹配紅杯文字。固定背包文字讀第二欄，最高值在第二列；對角線共 3 個正配對、其餘 6 個是本批假設的負配對。
:::

指引列出零樣本學習：預訓練後可用於新任務，不必先以該任務標籤重訓。

:::supplement[來源：CLIP 原論文第 2.5 節；CLIP 官方候選分類範例]
零樣本分類（Zero-shot Classification）把類別寫成描述，如「一張紅色杯子的照片」。固定模型參數取得圖片與候選表示，再選最匹配者；本例選紅杯，無須用紅杯標籤重訓。

製造首組把候選換成裂痕齒輪、磨損軸承、完整螺栓，同一計算規則選 M01 的裂痕齒輪。向量全是人工教學設定，不能從這裡推估真實零樣本準確率。

相似度高只支持相對匹配，不證明零件故障原因或商品材質。
:::

## 程式（補充）

每個領域都讀同一份三維向量與候選，直接核算首張圖片的零樣本選擇。候選向量代表教學中已完成的編碼，沒有真正載入 CLIP。

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L21104-A-pairs.json").read_text(encoding="utf-8"))
for domain in d["domains"]:
    x = np.array(domain["pairs"][0]["image_vector"], dtype=float)
    t = np.array([c["vector"] for c in domain["candidates"]], dtype=float)
    x /= np.linalg.norm(x)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    scores = t @ x
    winner = domain["candidates"][int(scores.argmax())]["label"]
    print(domain["id"], scores.round(3).tolist(), winner)
```
```text
retail [0.8, 0.0, 0.6] 紅色杯子
manufacturing [0.8, 0.0, 0.6] 裂痕齒輪
```

:::tip[讀碼重點]
最高分只在目前候選中選出一個。更換候選描述會改變比較結果；若候選缺了正確類別，仍可能被迫選出一個不合適的標籤。
:::

## 怎麼用、怎麼判讀

圖文匹配比較是否相符；圖文檢索從既有候選找項目。指引也列出零樣本學習能力。

:::supplement[來源：CLIP 原論文第 2.5 節]
零樣本分類把類別寫成文字候選，與檢索共用表示，但比較的是類別提示。應先確認候選與任務定義，再解讀最高分。
:::

### 圖說生成的校正

指引 3-76 將圖片標題生成列為 CLIP 功能。

:::supplement[來源：CLIP 原論文第 2.2 節；BLIP 原論文；DALL·E 2 論文]
標準 CLIP 只有編碼與匹配，沒有逐詞產生新圖說的文字解碼器。要寫出新描述，需另外接文字生成模組；從既有 12 段描述中選一段仍屬檢索。

指引 3-76 也把 CLIP 稱為後續 DALL·E 等生成模型的基礎。具體例子是 DALL·E 2：先由文字產生 CLIP 圖片表示，再由額外解碼器產生圖片，生成能力來自整套架構。
:::

指引提醒複雜場景細節與資料偏見會限制表現。需要辨識微小缺陷或公平性敏感的分類時，應另用領域資料檢驗，不能只因共享表示便推定可靠。

### 換個場景

| 場景 | 輸入與交付 | 判讀重點 |
|---|---|---|
| 圖文匹配 | 貓在草地的圖與描述 | 比較圖文是否相符 |
| 文字搜圖 | 紅色跑車查詢與圖片庫 | 對圖片候選排序 |
| 零售（補充） | 商品照與類別提示 | 候選措辭及類別是否完整 |
| 製造（補充） | 瑕疵照與缺陷標籤 | 細微裂紋另需驗證 |

## 常見誤解

- 零樣本表示從未訓練：它已用大量圖文預訓練，只是未用目標任務標籤重訓。（補充）
- 高相似度代表描述事實無誤：匹配分數不提供事實或因果保證。（補充）
- CLIP 可以直接寫新圖說：標準結構沒有文字生成解碼器，需額外模組。（補充）

## 進階

### 參考來源

- 科目 1 學習指引，guide-1:3-44、3-75～3-76：支持雙編碼器、檢索場景、零樣本及細節偏見限制。
- [CLIP 原論文](https://proceedings.mlr.press/v139/radford21a/radford21a.pdf)：PMLR 版第 2.1～2.3 節與 Figure 3 支持資料規模、架構、相似度及雙向對比；第 2.5 節支持候選分類。
- [CLIP 官方程式](https://github.com/openai/CLIP)：支持向量正規化與候選核算。
- [CMU 多模態教學](https://multicomp.cs.cmu.edu/mmml-tutorial/schedule/)：Representation 的對比表示教學支持本頁矩陣讀法。
- [BLIP 論文](https://arxiv.org/abs/2201.12086)：支持圖說生成需生成能力的比較。
- [DALL·E 2 論文](https://arxiv.org/abs/2204.06125)：支持 CLIP 表示與額外圖片生成模組的分工。

## 小結

- 圖片與文字各自編碼，再以雙向配對學共享表示。
- 檢索與零樣本分類都比較候選，先辨明矩陣方向。
- CLIP 本身不寫新圖說，細節與偏見仍須領域驗證。
