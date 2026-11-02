---
id: multimodal-fusion
title: 多模態資料、特徵與決策融合
kind: technique
codes:
  - L21104
  - L23301
  - L23302
aliases:
  - Early Fusion
  - Feature Fusion
  - Late Fusion
  - Multimodal Fusion
summary: 融合的層級取決於合併的是原始資料、模態特徵或各分支的預測
goals:
  - id: g1
    text: 追蹤特徵串接到 SVM 或樹分類器的資料流與限制
  - id: g2
    text: 說明 CNN／RNN 雙分支、融合層及尺度處理
  - id: g3
    text: 按實際合併位置區別資料、特徵與決策融合並校正指引用語
requires:
  - multimodal-ai
guide_refs:
  - guide-1:3-74
  - guide-1:3-75
  - guide-1:3-77
textbook: v2
author: codex
status: draft
formula_groups:
  - id: decision-weighting
    source: https://numpy.org/doc/stable/reference/generated/numpy.average.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21104-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售系統取 3 維圖片特徵與 3 維文字特徵，串接後送進 SVM。哪個描述符合此資料流？
    options:
      A: SVM 先各自產生兩個類別，再把類別字串接成 6 維輸入
      B: 串接得到 6 維向量，再由 SVM 學這組特徵與標籤的關係
      C: 串接得到 3 維向量，兩模態相同維度會自動消除語意落差
      D: SVM 先把每維調成相同語意，再逐項相乘得到唯一一個特徵
    answer: B
    explain:
      A: 這段流程只有一個串接後的 SVM，尚未有兩個分支類別。
      B: 三維加三維形成六維輸入，分類器位於串接之後。
      C: 串接會增加維度，也不會自動建立語意對應。
      D: 串接不是逐項相乘，SVM 也不會先保證每維語意相同。
  - id: c2
    goal: g2
    type: choice
    prompt: 工廠用 CNN 讀照片、RNN 讀振動，再融合特徵分類。振動原始讀值的數值範圍遠大於像素值，兩路輸入前應先查什麼？
    options:
      A: 只保留數值較大的振動資料，因為數字大表示判斷較可靠
      B: 把 RNN 移到最終分類之後，讓它直接覆寫 CNN 的類別
      C: 核對配對與尺度處理，縮放參數只從訓練資料估計
      D: 先合併訓練與測試資料縮放，再以全體平均消除兩路尺度差
    answer: C
    explain:
      A: 數值大小受單位與量測範圍影響，不能代表可靠度。
      B: 這會改變資料流，並未處理兩路輸入尺度。
      C: 正確配對與適當縮放可減少尺度支配，且須避免資料洩漏。
      D: 用測試集估計縮放參數會洩漏評估資料資訊。
  - id: c3
    goal: g3
    type: choice
    prompt: 圖像分支與文字分支先各自輸出「需複核」機率 0.8、0.3，再按 0.6、0.4 加權，閾值 0.5。哪個描述正確？
    options:
      A: 這是資料層融合，分數為 0.60，因此可跳過兩個分支模型
      B: 這是特徵層融合，分數為 0.55，因此兩路還未各自做預測
      C: 這是決策層融合，分數為 0.48，因此融合後判為不需複核
      D: 這是決策層融合，分數為 0.60，因此融合後判為需要複核
    answer: D
    explain:
      A: 合併的是分支機率，不是原始資料，兩個模型已先執行。
      B: 兩路已各自輸出預測機率，且題目不是等權平均。
      C: 0.48 只計入圖片分支，漏掉文字分支的 0.12。
      D: 在各分支預測後融合，0.6×0.8+0.4×0.3=0.60，達到閾值。
---

## 為什麼需要

商品照片能顯示杯口破損，文字註記能提供品管背景。兩路資料都能用，但「在哪裡合起來」會影響模型能學到的交互關係與部署方式。

多模態融合（Multimodal Fusion）可以發生在資料、特徵或預測階段。先看流程位置，再使用早期或晚期等名稱。

## 直覺

把兩路資料一路追到輸出：還沒各自做預測就合併，和各自判完再整合，是不同做法。

![三條路徑由上到下是資料、特徵與決策融合；最後一條必須先經各分支的預測頭。](figure:l21104-multimodal-fusion-levels)

指引先介紹特徵串接接傳統分類器，再介紹 CNN、RNN 等專用分支與融合層。不同流程可處理相同任務，不能只按模型新舊判斷優劣。

## 定義與公式

| 層級 | 合併的內容 | 合併後做什麼 |
|---|---|---|
| 資料層 | 同步且格式可兼容的原始訊號 | 共同抽特徵與預測 |
| 特徵層 | 各模態抽出的向量 | 送共同分類器或融合網路 |
| 決策層（補充） | 各分支已輸出的機率或預測 | 投票、加權或再學組合 |

### 指引的名稱校正

指引 3-77 把晚期融合寫成特徵層級整合。

:::supplement[來源：Multimodal Machine Learning 綜述第 VI-A 節]
常見定義把晚期融合（Late Fusion）用於決策層：各模態先各自預測，再組合輸出。早期融合（Early Fusion）也常涵蓋抽特徵後立即串接；因此要同時寫清合併物件與位置。

資料層融合不能把任意文字直接接到像素矩陣。須先有可兼容的格式與配對規則；異質圖文通常各自編碼後才合併特徵。
:::

### 特徵層的分工

圖片可由 CNN 取形狀紋理，文字或語音可由 RNN 取序列表示。融合層接收兩路特徵，再交由分類頭。傳統方式則可把人工特徵串接後送 SVM 或決策樹。

:::supplement[來源：Multimodal Machine Learning 綜述第 III、VI 節]
串接本身只保留兩串數值，不會保證語意對齊；後接非線性分類器仍能學部分交互，不能一概說完全無法處理交互。

不同分支尺度差距過大時，檢查標準化、正規化或可學投影是否適合。由資料估計的縮放參數只用訓練集，之後固定套用到驗證與測試集。
:::

### 決策加權（補充）

NumPy average 文件將加權平均定義為「乘積總和除以權重總和」。對同一正類「需人工複核」，兩路權重取 $\alpha$ 與 $1-\alpha$，總和為 1，得到特例：

$$
p=\alpha p_{\mathrm{img}}+(1-\alpha)p_{\mathrm{text}}
$$

- $p_{\mathrm{img}}$：圖片分支對正類的機率。
- $p_{\mathrm{text}}$：文字分支對相同正類的機率。
- $\alpha$：圖片權重，介於 0 與 1；$p$：融合分數。

這是加權平均的自訂應用；scikit-learn 軟投票文件也採用同類別機率的加權平均。多模態綜述則支持在分支預測後融合的方法定位。

R01 的兩路分數為 0.8、0.3，圖片權重 0.6，代入為 $0.6\times0.8+0.4\times0.3=0.60$。閾值 0.5 下判需複核，但加權值不因此自動成為已校準機率。

## 算一次

特徵串接之後才接 SVM 或決策樹；決策融合則先有各分支預測，再組合輸出。

:::supplement[來源：NumPy average 文件；Multimodal Machine Learning 綜述第 VI-A 節]

R01 的圖向量 $(1,0,0)$ 與文向量 $(0.8,0.6,0)$，串接為 $(1,0,0,0.8,0.6,0)$，共 6 維。SVM 或樹接在串接之後，本例尚未訓練這個分類器。

決策路徑則先得到 0.8、0.3，再算出 0.60。這是另一個模型流程，不能把 6 維串接向量的前三維當作分支機率。

同一複核任務的資料層方案，先遇到 R01 文字與像素格式不兼容的問題。若先轉成兩路向量，就已是特徵層；並非三種融合都適合每一份資料。

M01 製造巡檢沿用相同切分、向量與分支分數，串接長度也是 6、融合分數也是 0.60。數值只演示位置差異，不宣稱兩條路徑準確率相同。
:::

## 程式（補充）

依共用 JSON 同時驗證串接形狀與決策加權，不訓練新分類器。融合機制參考綜述第 VI-A 節。

```python
import json, os
from pathlib import Path
import numpy as np
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L21104-A-pairs.json").read_text(encoding="utf-8"))
p = d["domains"][0]["pairs"][0]
features = np.concatenate([p["image_vector"], p["text_vector"]])
w = d["fusion"]["weights"]
score = sum(w[k] * p["branch_review_probability"][k] for k in w)
print("串接形狀:", features.shape)
print("需複核分數:", f"{score:.2f}")
print("判需複核:", score >= d["fusion"]["threshold"])
```
```text
串接形狀: (6,)
需複核分數: 0.60
判需複核: True
```

:::tip[讀碼重點]
concatenate 接合特徵，沒有執行分類；加權那一行則讀取已定義為同一正類的兩個分支輸出。
:::

## 怎麼用、怎麼判讀

感測融合需要處理採樣頻率與時間戳，不能把不同時點的資料當成同一事件。多個分支也會增加運算負擔，選融合位置時要一起評估延遲與資源。

:::supplement[來源：Multimodal Machine Learning 綜述第 VI 節]
比較方案須固定任務、配對索引與資料切分。分支機率要有相同類別順序，否則加權後的數字失去意義；權重與閾值由驗證資料選定，最後才評估測試集。
:::

### 換個場景

| 場景 | 互補來源 | 融合前先查 |
|---|---|---|
| 智慧城市 | 監視影像、車流或空氣品質感測 | 時間戳與量測區域 |
| 醫療監控 | X 光／MRI、心率與血壓 | 病患及檢查時點 |
| 自駕與機器人 | 攝影機、雷達、超音波 | 座標、同步與障礙物對應 |
| 零售品管（補充） | 照片、文字註記 | 商品批號與分類定義 |
| 製造巡檢（補充） | 照片、振動訊號 | 零件編號與訊號尺度 |

## 常見誤解

- 特徵串接就已完成對齊：它只把輸入接在一起，語意關係仍須學習。
- 網路很深就是晚期融合：應看合併是否發生在各分支預測之後。（補充）
- 加權總和越大越可靠：先確認正類、尺度與校準，還要看實際驗證結果。（補充）

## 進階

### 參考來源

- 科目 1 學習指引，guide-1:3-74～3-75、3-77：支持串接、專用網路、融合層及感測場景。
- [多模態學習綜述](https://arxiv.org/html/1705.09406v2)：第 III、VI 節支持交互與晚期融合的方法定位。
- [NumPy average 文件](https://numpy.org/doc/stable/reference/generated/numpy.average.html)：加權平均定義支持「決策加權」的兩路權重特例。
- [scikit-learn 軟投票文件](https://scikit-learn.org/stable/modules/ensemble.html#weighted-average-probabilities-soft-voting)：支持相同類別機率的加權平均應用。
- [CMU 多模態教學](https://multicomp.cs.cmu.edu/mmml-tutorial/schedule/)：Representation 與 Fusion 支持本頁由位置追蹤資料流的教學方式。

## 小結

- 先辨認合併的是原始資料、特徵或預測。
- CNN／RNN 分支抽取不同結構，融合層負責整合。
- 晚期融合通常指決策融合，遇到用語不同時回到流程判讀。
