---
id: text-classification
title: 文字分類
kind: technique
codes:
  - L21101
aliases:
  - Text Classification
  - 文本分類
summary: 文字分類依預先定好的標籤，將郵件、評論或客服文字分派到類別。
goals:
  - id: g1
    text: 依郵件、評論與客服派單需求定義文字分類輸入、標籤及端到端輸出
requires:
  - text-representation
guide_refs:
  - guide-1:3-30
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服每天收到800句訊息，須分成退款、配送、詢問、客訴。某句同時說「服務很好，但包裹破損」。哪種標註規劃較合理？
    options:
      A: 先訂派單優先規則，主意圖與情感分開標
      B: 主意圖與情感分開標，但多需求時由標註者各自選
      C: 先把客訴固定視為負面，兩種任務只存同一個標籤
      D: 先把模型預測當作標準，再刪掉人工判斷不同的資料
    answer: A
    explain:
      A: 派單問題與評價態度不同，混合意圖還需一致的優先規則。
      B: 任務雖分開，多需求卻沒有共同優先規則，仍可能標得不一致。
      C: 不滿態度與處理部門不能合併成同一套互斥類別。
      D: 直接依預測排除異議會使驗收失去獨立標準。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊有16句合成客服文字，留出4句測試。以下哪個特徵學習流程適當？
    options:
      A: 先以16句學詞表，再以12句訓練分類模型
      B: 先用4句測試挑詞，再以12句訓練分類模型
      C: 先以12句學詞表，再用同一詞表轉換4句
      D: 先以4句另學詞表，再讓兩份向量直接比較
    answer: C
    explain:
      A: 詞表與IDF也屬學習結果，不應由保留測試資料決定。
      B: 使用測試標準挑特徵會把測試資訊帶進訓練。
      C: 只在訓練資料fit，對測試資料僅transform，才維持評估分工。
      D: 兩個獨立詞表的同一維不保證代表相同字詞。
  - id: c3
    goal: g1
    type: choice
    prompt: 郵件標成垃圾或正常，評論標成正面或負面，客服標成4個部門。對這3項服務的說法何者恰當？
    options:
      A: 三者應共用一套標籤，才算相同的文字分類
      B: 三者都輸出類別，但類別意義由任務各自定義
      C: 三者都輸出摘要，因此可共用同一份摘要規則
      D: 三者只要都用TF-IDF，就應沿用相同類別意義
    answer: B
    explain:
      A: 任務相同不表示標籤意義相同。
      B: 三者都是文本到預定標籤的映射，標籤規則必須分開。
      C: 分類回傳標籤，摘要回傳文字，輸出契約不同。
      D: 特徵表示相同，不代表郵件性質、情感與部門標籤意義相同。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

每天幾百封郵件或客服訊息，逐句看完再派單很費時。文字分類（英文：Text Classification）把一段文字分配到預先定好的類別，讓後續流程知道要交給誰。

分類前先問「這個標籤要協助哪個決策」。垃圾郵件要判垃圾或正常；商品評論可判正面、負面、中立；客服請求則要辨退款、詢問或投訴等需求。

## 直覺

同一句「訂單A101尚未出貨，請取消並退款300元」，可以有不同任務。派單標籤是退款，情感可標中立，摘要則是一段保留需求的短文。

類別不是文字天然附帶的答案，而是任務先定義好的輸出。把「退款」與「負面」放在同一套互斥標籤裡，會混淆處理需求與評價態度。

## 定義與公式

輸入是待判斷的文本，輸出是預定類別。標籤規則要讓相同需求得到一致結果；多樣語言與複雜意圖會增加辨識難度。

### 標籤契約（補充）

本組採單一主要意圖：退款、配送、詢問、客訴。明確要求取消退款標退款；查物流標配送；問規格標詢問；表達不滿並要求處理標客訴。混合需求另依人工訂定的優先規則判斷。

多標籤任務可讓同一句同時有幾個標籤，單標籤任務則只能選一個。開始標註前就決定，避免訓練資料要求一種格式、驗收卻要求另一種。

## 走一次流程

共用資料有16句電商客服，四個主要意圖各4句。以E01為例，文字先進入分類，再依「退款」交給退款處理流程；這不表示系統已完成退款。

### 從原句到派單

1. 輸入E01全文，先辨認「取消並退款」是待處理需求。
2. 依預定標籤，把主要意圖分為「退款」。
3. 將這個標籤交給退款處理部門，不把分類結果當成退款已完成。

:::supplement[來源：scikit-learn文字特徵與評估範例；本組合成資料]
程式固定訓練12句、測試4句；測試索引為E04、E08、E12、E16。只用訓練文字學詞表及權重，再轉換保留文字，核對預測與人工參考。
:::

| E01的任務 | 輸入 | 人工參考輸出 |
|---|---|---|
| 派單分類 | 原句全文 | 退款 |
| 情感分類 | 原句全文 | 中立 |
| 摘要（補充） | 原句全文 | A101未出貨，申請取消及退款300元 |

這張表的後兩列用來比較任務，並非下面分類程式的輸出。

:::supplement[來源：NLTK Book第6章；本組合成資料]
醫療行政M03「周晴向青禾醫院申請掛號證明」若用來派單，需另訂行政類標籤，不能硬套電商四類。
:::

## 程式（補充）

以下是離線小型基準，用字元片段的詞頻與逆文件頻率，再接邏輯斯迴歸。中文不用空白斷詞即可演示，正式語料仍須比較表示方法；這16句只驗證流程。

```python
import json, os
from pathlib import Path
from sklearn.pipeline import make_pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L21101-E-service-documents.json").read_text(encoding="utf-8"))
train = [r for r in d["customer"] if r["split"] == "train"]
test = [r for r in d["customer"] if r["split"] == "test"]
model = make_pipeline(TfidfVectorizer(analyzer="char", ngram_range=(1, 2)),
                      LogisticRegression(random_state=d["seed"], max_iter=500))
model.fit([r["text"] for r in train], [r["intent"] for r in train])
pred = model.predict([r["text"] for r in test])
for r, label in zip(test, pred):
    print(r["id"], "參考:", r["intent"], "預測:", label)
```
```text
E04 參考: 退款 預測: 退款
E08 參考: 配送 預測: 配送
E12 參考: 詢問 預測: 詢問
E16 參考: 客訴 預測: 客訴
```

:::tip[讀碼重點]
`fit`只接觸12句訓練資料；`predict`沿用已學好的詞表。若先拿全部16句學IDF，保留文字就已參與前處理的學習，形成資料洩漏。
:::

## 怎麼用、怎麼判讀

判斷需求先看輸出：預定標籤屬分類；新短文屬生成；原文的範圍與類型屬命名實體辨識。不要因為三者都讀文字，就把驗收標準混在一起。

### 評估與例外（補充）

用混淆矩陣看哪些部門常互相誤派，再看各類召回率與F1分數。分類分數不等於退款成功率；驗收還要核對下游是否接受該類工單。

本例只有固定訓練／測試，沒有另外調參。正式選型須保留驗證資料；若同一客戶或同一對話有多句，切分時應避免跨集合重複。

### 換個場景

| 場景或資料條件 | 輸入與標籤 | 判讀重點 |
|---|---|---|
| 大量郵件 | 信件；垃圾／正常 | 不同寄件風格仍要辨識 |
| 商品評論 | 評論；正面／負面／中立 | 標情感而非商品名稱 |
| 客服請求 | 訊息；退款／詢問／投訴 | 意圖要能對應處理部門 |
| 醫療行政（補充） | 文件請求；掛號／證明／補件 | 重訂領域標籤，不沿用電商類別 |
| 製造維修（補充） | 維修單；設備／耗材需求 | 行話與多需求須有標註規則 |

## 常見誤解

- 「出現謝謝就屬正面，也應交正面部門。」禮貌語不決定主要意圖；部門與情感是不同標籤。
- 「分類為退款就代表已退費。」標籤只表示處理需求，不是交易結果。
- 「沒有訓練過的領域也能直接用原標籤。」新領域可能連類別意義都不同，需重新驗證。（補充）

## 進階

### 為什麼此頁不畫數據圖（補充）

本目標要核對輸入、標籤與派單結果，用同文不同任務表即可。四句測試不足以支持效能曲線，分類指標的計算見既有指標頁。

### 參考來源

- 科目1指引`guide-1:3-30`：支持「為什麼需要」「定義與公式」與郵件、評論、客服三種場景。
- [scikit-learn TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html)及[LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)：支持程式的字元片段、擬合與分類API。
- [scikit-learn文字特徵與評估範例](https://scikit-learn.org/stable/auto_examples/model_selection/plot_grid_search_text_feature_extraction.html)：支持離線基準與特徵／分類串接；未沿用範例數據。
- [NLTK Book第6章](https://www.nltk.org/book/ch06.html)：參考先定標籤、再取特徵與評估的教法，支持「標籤契約」。

## 小結

- 先決定分類要支援的決策，再訂輸入與標籤。
- 郵件、評論與客服都可分類，但各自的類別意義不同。
- 特徵只從訓練資料學習；輸出標籤還要交給下游流程。（補充）
