---
id: temporal-text-features
title: 時間與文字欄位的特徵設計
kind: technique
codes: [L21301, L23301]
aliases: [Temporal Features, 時間特徵]
requires: [train-val-test-split]
summary: 把時間戳拆成日曆欄位，把原文字轉成可供模型使用的數值表示
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-5, guide-1:3-12, guide-1:3-13, guide-3:5-9]
goals:
  - id: g1
    text: 用星期與工作日表示時間，走完文字轉數值流程，並比較TF-IDF與詞向量用途
formula_groups:
  - id: smoothed-idf
    source: https://scikit-learn.org/stable/modules/feature_extraction.html#tfidf-term-weighting
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23301-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 零售資料有週日與週一各1筆18:00曝光，另有當時已知的廣告短句。星期一編0、星期日編6，工作日暫定週一至五；數對順序為(星期索引,工作日旗標)。哪種表示合理？
    options:
      A: 週日記為(6,1)、週一為(0,0)，短句用未來購買與否取代文字
      B: 週日記為(0,0)、週一為(6,1)，短句用字元編碼總和代表語意
      C: 週日記為(6,0)、週一為(0,1)，短句依固定規則轉成數值特徵
      D: 週日記為(6,0)、週一為(0,1)，短句一律直接當成連續數值輸入
    answer: C
    explain:
      A: 工作日旗標顛倒，未來購買也是標籤，不能替代當時文字輸入。
      B: 星期索引不符合約定，字元編碼總和也沒有穩定語意距離。
      C: 星期與工作日符合約定，文字再用可重現的數值表示處理。
      D: 一般表格數值模型無法直接把任意短句當成連續數值，仍需文字處理。
  - id: c2
    goal: g1
    type: choice
    prompt: 工程師要讓含「免運」的廣告有可檢查的詞彙權重，另要讓「便宜」與「划算」的語意接近有機會被表示。哪組起點合理？
    options:
      A: 前者比較TF-IDF，後者比較合適詞向量，只用訓練估計再驗證
      B: 前者比較TF-IDF，後者比較合適詞向量，合併全部文本估計再驗證
      C: 前者比較TF-IDF，後者比較任意詞號，把詞號差當作語意距離
      D: 前者比較詞向量，後者比較TF-IDF，把向量各維直接視為詞項
    answer: A
    explain:
      A: TF-IDF提供詞項權重，合適詞向量可表達語意結構，實際效果仍需驗證。
      B: 方法組合雖合理，但合併驗證文本估計IDF等參數，會讓驗證資訊參與前處理。
      C: TF-IDF可提供詞項權重，但任意詞號的數值距離不表示近義關係。
      D: 詞向量各維通常不是獨立詞項，而TF-IDF也不會自動表示近義詞的語意接近。
  - id: c3
    goal: g1
    type: choice
    prompt: TF-IDF在26筆訓練短句上fit，固定4詞；6筆驗證短句出現新詞「限時」。哪個流程能保持評估與欄位一致？
    options:
      A: 合併32筆重算IDF，再保留舊模型，宣稱驗證仍完全獨立
      B: 遇新詞即加第5欄，再保留舊模型，宣稱輸入維度仍為4
      C: 各驗證句自行fit，再保留舊模型，宣稱權重仍來自訓練
      D: 沿用訓練IDF與4欄，驗證只transform，並記錄未收錄詞
    answer: D
    explain:
      A: 驗證文本參與IDF估計，評估流程已使用驗證分布資訊。
      B: 新增欄位會改變模型輸入形狀，不能直接配用原本4欄的模型。
      C: 固定詞表保留四欄語意，但重新fit會改變IDF，也讓驗證文本參與權重估計。
      D: 固定表示後只轉換驗證資料，未知詞依原規則處理，不改模型欄位。
---

## 為什麼需要

「2026-10-11 18:00」與「優惠 免運」各含有資訊，但一般表格式數值模型不能直接理解它們。時間與文字欄位的特徵設計，是把資訊轉成模型可用的表示。

時間戳可拆成星期、上午／下午、工作日／週末；文字可抽取關鍵詞，或轉成TF-IDF與詞向量。兩種欄位都先問要保留什麼訊息，再選表示。

## 直覺

時間拆解回答「何時發生」，文字表示回答「說了什麼」。例如同樣寫免運的廣告，在週末與工作日可能有不同反應；模型需要看得懂兩種資訊才能比較。

![時間拆成日曆欄，文字轉成固定詞彙欄，最後按同一列索引合併。](figure:l23301-temporal-text-features-matrix)

:::supplement[來源：scikit-learn文字分類教學；本組資料契約]
本頁共用資料把廣告短句設定為曝光前已知。購買後才新增的客服文字不能回填成曝光時的特徵，即使它也叫「文字欄位」。
:::

## 定義與公式

### 兩條表示路線

| 欄位 | 要保留的訊息 | 表示方向 | 限制 |
|---|---|---|---|
| 時間戳 | 日曆與時段位置 | 星期、工作日、上午／下午 | 整數未必保留循環距離 |
| 文字關鍵詞 | 詞項出現與重要性 | 關鍵詞指示、TF-IDF | 一般不直接理解語序 |
| 文字語意 | 詞與詞的語意結構 | 詞向量 | 靜態與語境型的能力不同 |

TF-IDF（Term Frequency–Inverse Document Frequency）是詞項權重，結合篇內詞頻與跨文件普遍程度。固定文件數時，越常見的詞，IDF越低。

詞向量（Word Embeddings）用多個數值共同表示詞的語意結構。靜態詞向量通常一詞一向量；語境型表示則可隨上下文改變，較能處理同詞異義。

### 時間欄位的約定（補充）

本例採台北時間，星期一0到星期日6。工作日旗標暫以週一至五為1，週六日為0；這是教學簡化，正式業務若受國定假日與補班影響，需接上正確日曆。

TF-IDF的詞彙順序、分詞規則與IDF估計也要固定。它不是把文字隨意編成整數；換了一份詞彙表，同一欄就可能代表另一個詞。

## 走一次流程

### 1. 先拆時間

共用零售資料中的10月11日18:00是星期日，星期索引6、下午、工作日0。10月12日18:00是星期一，星期索引0、下午、工作日1。

:::supplement[來源：本組資料契約]
本例以12:00為分界，將12:00至23:59統一記為「下午」。這是二元時段旗標的簡化，包含日常會稱為傍晚或晚上的18:00，不是通用時段定義。
:::

需要首尾相鄰的表示時，再接日期拆解與週期編碼。需要昨天點擊或近期平均時，改看Lag、Rolling與特徵可用時間；日曆位置與歷史行為不是同一類資訊。

### 2. 再把原文字變成數值

以「優惠 免運」為例，先保留原文，依固定規則切成「優惠」、「免運」，再用固定詞彙順序建立欄位。詞項權重可用TF-IDF估計；語意任務則可比較合適詞向量。

:::supplement[來源：scikit-learn Feature extraction；TfidfVectorizer]
本例使用平滑IDF，且不做向量正規化：

$$
\mathrm{idf}(v)=\ln\frac{1+n}{1+\mathrm{df}(v)}+1,\qquad
w_{i,v}=\mathrm{tf}_{i,v}\,\mathrm{idf}(v)
$$

| 符號 | 意義 |
|---|---|
| $v$ | 詞項 |
| $n$ | 訓練文件總數 |
| $\mathrm{df}(v)$ | 含該詞的訓練文件數 |
| $\mathrm{tf}_{i,v}$ | 文件$i$內的原始詞次數 |
| $w_{i,v}$ | 未正規化的詞項權重 |

此式對應`smooth_idf=True`與`sublinear_tf=False`，文件數$n>0$，文件頻率介於0與$n$之間。

詞欄依序是優惠、免運、原價、到店。26篇訓練原文中，前兩詞各出現在14篇，後兩詞各出現在12篇。

- 優惠、免運：$\ln(27/15)+1\approx1.5878$。
- 原價、到店：$\ln(27/13)+1\approx1.7309$。

首句「優惠 免運」詞頻為`[1,1,0,0]`。逐欄乘IDF後，得到`[1.5878,1.5878,0,0]`；出現於更多文件的詞，IDF較低。

固定詞表仍須在訓練文本fit IDF，驗證與測試只transform；「限時」不增欄。本例用空白分詞，真實中文需另選分詞或字元規則。
:::

### 3. 按索引合併

把每筆的星期、工作日與文字數值欄合成一列，對齊同一筆未來24小時購買標籤。兩組欄位的資料列不能各自排序後直接拼接，否則會把別人的短句配到這筆時間。

### 4. 換到能源例（補充）

能源資料沿用相同日期、實體索引與資料分割，只把短句改成「節能 排程」等設備備註。星期仍代表日曆位置，詞欄則改用能源的固定詞彙表；不能沿用零售詞欄的語意。

## 程式

### 時間拆解與工作日旗標（補充）

在專案根目錄可直接執行；若用隔離目錄，先將環境變數`IPAS_REPO_ROOT`設為專案根路徑。

```python
import json, os
from pathlib import Path
import pandas as pd
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
time = pd.to_datetime(data["calendar_fixture"], utc=True).tz_convert("Asia/Taipei")
weekday = time.day_of_week
print("日期:", time.strftime("%Y-%m-%d").tolist())
print("星期:", weekday.tolist())
print("工作日:", (weekday < 5).astype(int).tolist())
print("下午:", (time.hour >= 12).astype(int).tolist())
```
```text
日期: ['2026-10-10', '2026-10-11', '2026-10-12']
星期: [5, 6, 0]
工作日: [0, 0, 1]
下午: [1, 1, 1]
```

### 固定詞欄，只在訓練文本fit（補充）

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
texts = [row["raw_text"] for row in data["rows"]]
train = [texts[i] for i in data["split"]["train_indices"]]
vec = TfidfVectorizer(vocabulary=data["vocabulary"], tokenizer=str.split,
                      token_pattern=None, lowercase=False, norm=None)
vec.fit(train)
print("詞欄:", vec.get_feature_names_out().tolist())
print("首句:", np.round(vec.transform([texts[0]]).toarray(), 4).tolist())
print("新詞句:", np.round(vec.transform(["限時 優惠"]).toarray(), 4).tolist())
```
```text
詞欄: ['優惠', '免運', '原價', '到店']
首句: [[1.5878, 1.5878, 0.0, 0.0]]
新詞句: [[1.5878, 0.0, 0.0, 0.0]]
```

:::tip[讀碼重點]
`vocabulary`固定欄順序，`fit(train)`只估計訓練詞權重。`norm=None`方便核對，與預設L2正規化不同；新詞不擴欄，原有「優惠」仍可提供訊號。
:::

## 怎麼用、怎麼判讀

要找明確關鍵詞訊號，可先比較詞項指示或TF-IDF；要表達近義詞、語意或上下文，可比較詞向量。TF-IDF不會因為兩詞意思相近，就自動給它們相近的語意表示。

### 合併前的檢查（補充）

先核對時間戳的業務時區，再核對文字產生時間。接著固定分詞、詞欄與訓練估計規則，最後檢查合併後每一列仍對應原本的樣本；完整流程可交給scikit-learn Pipeline管理。

### 換個場景

| 場景／資料條件 | 表示方向 | 判讀重點 |
|---|---|---|
| 含時間戳與文字的資料 | 星期、時段、關鍵詞或數值文字表示 | 依欄位性質擷取資訊 |
| 假日／下班銷售 | 日曆位置與週期欄位 | 不只用時間戳大小 |
| 能源設備備註（補充） | 星期＋備註詞欄 | 詞彙表需符合能源領域 |
| 客服來訊分流（補充） | 來訊時段＋文字表示 | 解決後才寫的摘要不可回填 |

## 常見誤解

- **文字換成詞號就有語意距離。** 識別碼不等於詞向量。
- **TF-IDF高就表示正向情緒。** 它是詞項權重，情緒方向仍需模型與標籤判斷。
- **詞向量都能處理一詞多義。** 靜態詞向量與語境型表示的能力不同。
- **固定詞表就能在全部文本fit。** 詞表固定仍須避免用驗證分布估計IDF。（補充）

## 進階

### 不在本頁重做語言模型（補充）

本頁負責選出與組合可用表示，不訓練詞向量，也不下載外部模型。正式比較還要考慮文本長度、領域詞與計算成本，並用相同資料分割驗證對任務是否有幫助。

### 參考來源

- 科目1指引5.1，`guide-1:5-5`：星期、上午／下午、工作日／週末、關鍵詞、TF-IDF與詞向量。
- 科目1指引3.1，`guide-1:3-12`～`guide-1:3-13`：TF-IDF的詞彙重要性、語序限制，以及靜態／語境型詞向量比較。
- 科目3指引5.1，`guide-3:5-9`：日曆拆解及銷售時間模式。
- [scikit-learn Feature extraction](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction)：訓練詞權重、中文分詞與數值表示流程。
- [TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html)：固定詞表、tokenizer、正規化與程式參數。
- [文字分類教學](https://scikit-learn.org/stable/auto_examples/text/plot_document_classification_20newsgroups.html)：固定表示、避免非預期文字訊號的流程思路。
- [時間特徵教學](https://scikit-learn.org/stable/auto_examples/applications/plot_cyclical_feature_engineering.html)：時間欄位與其他特徵合併的教學思路。
- [pandas Time series](https://pandas.pydata.org/docs/user_guide/timeseries.html)：帶時區的日期拆解程式。
- [pandas day_of_week](https://pandas.pydata.org/docs/reference/api/pandas.DatetimeIndex.day_of_week.html)：程式的星期索引，取代已棄用的dayofweek。

## 小結

- 時間拆解保留日曆位置，文字表示保留詞項或語意訊息。
- TF-IDF與詞向量各有用途，不能把詞號當語意距離。
- 只在訓練文本fit，按同一列索引合併時間與文字。（補充）
