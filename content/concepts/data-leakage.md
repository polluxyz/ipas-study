---
id: data-leakage
title: 資料洩漏
aliases: [Data Leakage, 資料泄漏, 數據洩漏]
kind: problem
codes: [L23303, L23301]
requires: [train-val-test-split]
guide_refs: [guide-3:5-18]
gaps:
  - ref: guide-3:5-18
    level: missing
    ability: 指引只說明資料切分，沒有提到資料洩漏；考題要判斷前處理放在交叉驗證內或外
textbook: v2
summary: 資料洩漏讓驗證資訊或預測時拿不到的資訊參與建模，扭曲評估
goals:
  - id: g1
    text: 找出前處理（含詞彙表、IDF、補值、縮放、PCA 與 LDA）、事後特徵與切分方式造成的資料洩漏
  - id: g2
    text: 解釋切分前選特徵為何高估成效，並以 Pipeline 改正
  - id: g3
    text: 區分只在訓練資料 fit 與在驗證資料 transform 的角色
formula_groups:
  - id: train-only-standardization
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html
    status: verified
    checked_by: task_a68af11027de
  - id: train-only-idf
    source: https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfTransformer.html
    status: verified
    checked_by: task_a68af11027de
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服模型要在工單建立時預測是否升級處理。下列哪個欄位最明確不應作為輸入？
    options:
      A: 建立工單時已填寫的問題類別
      B: 建立工單前的歷史客服次數
      C: 工單結案後才填寫的升級處理結果
      D: 建立工單時選擇的聯絡管道
    answer: C
    explain:
      A: 錯。問題類別若當下已知，可作為候選特徵，仍須檢查品質。
      B: 錯。只使用建立前已知的歷史資料，符合預測時點限制。
      C: 對。結案後的結果在預測時拿不到，使用它會形成目標資訊洩漏。
      D: 錯。聯絡管道在工單建立時已知，並非這裡的事後資訊。
  - id: c2
    goal: g2
    type: choice
    prompt: 100 筆模擬資料的特徵與標籤獨立，切分前用全部標籤選出十個特徵，再做交叉驗證得到 0.73。哪項解釋最合適？
    options:
      A: 特徵選擇已看過驗證標籤，可能挑出全資料的偶然相關
      B: 只保留十個特徵已降低過擬合，因此 0.73 可直接代表真實成效
      C: 分類器沒有用驗證標籤訓練，因此先前的特徵選擇不影響評估
      D: 100 筆資料太少，因此任何交叉驗證分數都不可信
    answer: A
    explain:
      A: 對。分類器雖只在訓練摺擬合，特徵清單卻已受驗證摺影響。
      B: 錯。減少特徵數不會撤回已使用的驗證資訊，仍不能據此推論真實成效。
      C: 錯。特徵選擇也會從資料學習，分類器之前的資訊越界同樣會扭曲評估。
      D: 錯。小樣本會增加分數波動，但不能一概否定交叉驗證，仍須檢查資訊邊界。
  - id: c3
    goal: g3
    type: choice
    prompt: 第一摺訓練數值為 1、3，驗證數值為 8、10。若需標準化，哪個做法正確？
    options:
      A: "合併 1、3、8、10 算平均與尺度，固定參數後再拆回訓練和驗證"
      B: "只由 1、3 算平均與尺度，再用同一規則轉換 8、10"
      C: "由 1、3 與 8、10 各自算平均與尺度，讓兩邊都轉成平均為零"
      D: "只將 1、3 標準化，8、10 保留原值再送進同一模型"
    answer: B
    explain:
      A: "錯。合併後才固定參數，仍讓驗證數值影響平均與尺度，已造成資料洩漏。"
      B: "對。只在訓練資料擬合，再套用到驗證資料，既守住資訊邊界也保持同一轉換。"
      C: "錯。驗證自行擬合使用了驗證分布，也讓兩邊採不同的座標規則。"
      D: "錯。模型訓練與預測必須使用一致的特徵轉換，不能一邊標準化、一邊保留原單位。"
  - id: c4
    goal: g1
    type: choice
    prompt: 資料先分訓練與驗證。下列哪條資訊路徑仍會讓驗證資料影響學得的轉換？
    options:
      A: 只用訓練文字學詞彙表和 IDF，再轉換驗證文字
      B: 只用訓練 X、y 學 LDA，再轉換驗證特徵
      C: 只用訓練數值學補值與 PCA，再轉換驗證特徵
      D: 不讀驗證標籤，卻合併兩份文字學詞彙表和 IDF
    answer: D
    explain:
      A: 錯。詞彙與權重都由訓練語料決定，驗證只套用規則。
      B: 錯。LDA 需要標籤，但這裡只使用訓練標籤，邊界正確。
      C: 錯。無標籤轉換也只在訓練資料擬合，沒有使用驗證分布。
      D: 對。驗證用詞與出現篇數參與估計，不讀標籤仍會越界。
author: codex
status: draft
---

## 為什麼需要

指引 5.3 將訓練、驗證與測試分開，測試資料留作最後評估。本頁接續資料分割，檢查的不只是模型在哪些列訓練，還包括前處理看過哪些資訊。

:::supplement[來源：scikit-learn Common pitfalls 12.2 Data leakage]
資料洩漏（Data Leakage）發生在不該參與建模的資訊進入流程時。例如先用全部資料選特徵，再切摺，驗證資料其實已影響訓練。

這通常讓評估偏樂觀，卻不能代表上線後的能力。指引 5.3 沒有介紹這個機制，以下各節都是補充。
:::

## 直覺（補充）

不必直接把答案交給分類器才算洩漏。若選特徵的人先看了驗證答案，即使分類器只看訓練列，驗證資訊仍會透過特徵清單流入模型。

`fit` 從資料學規則，`transform` 套用學到的規則；`fit_transform` 則先學規則，再轉換訓練資料。

![錯誤流程先用全部標籤選特徵；正確流程先切摺，驗證資料只套用轉換](figure:l23303-data-leakage-preprocessing)

因此要追蹤整個學習流程。標準化學平均與尺度，補值學填補數值，特徵選擇學保留清單，都必須遵守訓練邊界。

### 四種轉換共用一條邊界

有沒有使用標籤，與會不會洩漏，是兩個問題。下圖把同一批設備數值分成訓練與驗證；錯誤路徑讓驗證 X 影響前三種轉換，也讓驗證 X、y 影響 LDA。

![錯誤以全部十二列擬合；正確只以第一摺八列訓練資料學補值、縮放及降維，另四列只能轉換](figure:l23303-m4-a-fit-boundaries)

| 轉換 | 從訓練資料學什麼 | 驗證時可做什麼 |
|---|---|---|
| 均值補值 | 各欄已觀測值的平均，不用 y | 用固定平均補空白 |
| 標準化 | 各欄平均與尺度，不用 y | 套用同一尺度 |
| PCA | 中心、主方向與解釋變異，不用 y | 投影到固定主方向 |
| LDA | 使用 X、y 學類別中心與判別方向 | 沿固定方向投影，不讀驗證 y |

PCA 與 LDA 在此是兩種替代降維路線，不是必須依序串接。前者只看 X 仍可能越界，後者用 y 也能在守住訓練邊界時合法使用。

## 定義與公式（補充）

### 三種常見入口

| 入口 | 例子 | 修正 |
|---|---|---|
| 前處理越界 | 全資料標準化或選特徵後才交叉驗證 | 每摺只在訓練資料擬合 |
| 事後資訊 | 用出院後結果預測入院時風險 | 依預測時間檢查每個欄位 |
| 切分不符部署 | 同一病人的影像跨摺，或用未來訓練過去 | 按病人分組，或保持時間方向 |

### 標準化也在學習

以 `StandardScaler` 的一般設定為例，某一個特徵的轉換是：

$$
z=\frac{x-\mu_{\mathrm{train}}}{\sigma_{\mathrm{train}}}
$$

$x$ 是待轉換數值，$z$ 是轉換結果；$\mu_{\mathrm{train}}$ 與 $\sigma_{\mathrm{train}}$ 只由當輪訓練資料計算。

訓練數值為 1、3 時，平均為 2。平方偏差平均為 $[(1-2)^2+(3-2)^2]/2=1$，標準差為 1。驗證值 8 會轉為 $(8-2)/1=6$。

這裡標準差用分母 $n$，和 `StandardScaler` 相同。若訓練特徵為常數，套件把尺度設為 1，不能直接除以零。

驗證值轉換後超過常見範圍不代表做錯，可能表示驗證分布與訓練不同。不可為了讓數字好看而重新在驗證資料擬合。

### 文字轉換也會學習

詞彙表決定「有哪些輸入欄位」，IDF 決定「每個詞的跨文件權重」。兩者都從語料估計；不讀標籤也不能先看驗證文件再學。

本例採 scikit-learn 的平滑設定，和指引的未平滑、以 10 為底版本分開：

$$
\mathrm{IDF}(t)=\ln\frac{1+N}{1+\mathrm{df}(t)}+1
$$

$N$ 是文件數，$\mathrm{df}(t)$ 是含詞篇數，$\ln$ 為自然對數。只計 fit 語料；TF 用原始次數，`norm=None` 不正規化，詞彙表須非空。

訓練四篇中「退款」出現兩篇，IDF 是 $\ln(5/3)+1$，約 1.510826。偷看兩篇驗證後變成 $\ln(7/4)+1$，約 1.559616，既有詞的權重也改變。

## 走一次流程（補充）

### 先看四筆數值

另附 `L23303-C2-scaling.json`，用四位模擬受試者的檢測值 1、3、8、10，純粹示範前處理邊界，不代表任何疾病指標。

把四筆全放進平均，會得到 5.5，標準差約 3.640。驗證值 8 因而變成約 0.687；正確的訓練限定轉換則是 6，差異已出現在模型訓練之前。

### 再看無訊號的醫療模擬資料

`L23303-C2-medical-noise.json` 有 100 位不同受試者、300 項隨機檢測值，標籤 0、1 各 50 位。特徵與標籤獨立，刻意沒有可泛化的疾病訊號。

1. 錯誤流程：先從全資料挑十個最相關特徵，再做五摺分類評估。
2. 正確流程：每摺只在 80 位訓練受試者中選特徵，再評估另 20 位。
3. 兩者使用相同原始資料、分摺、特徵數與分類器，只改特徵選擇的位置。

### 同一小語料比較詞彙表與 IDF

`L23303-M4-A-text-fit.json` 是另造的六篇客服文字，已用空白分詞；前四篇訓練、後兩篇驗證。標籤 1 表示優先處理、0 表示一般處理，僅用來教資料邊界。

| 索引 | 文字 | 角色／標籤 |
|---|---|---|
| 0 | 退款 延遲 | 訓練／1 |
| 1 | 帳單 錯誤 | 訓練／0 |
| 2 | 退款 帳單 | 訓練／1 |
| 3 | 物流 延遲 | 訓練／0 |
| 4 | 火星 退款 | 驗證／1 |
| 5 | 火星 物流 | 驗證／0 |

錯誤流程在切分前對六篇 fit，再切資料訓練分類器。正確流程先固定前四／後二的邊界，只在前四篇 fit 詞彙表與 IDF；驗證專屬詞「火星」不會成為輸入欄位。

| 詞 | 全資料 df／IDF | 訓練限定 df／IDF |
|---|---|---|
| 帳單 | 2／1.847298 | 2／1.510826 |
| 延遲 | 2／1.847298 | 2／1.510826 |
| 火星 | 2／1.847298 | 0／不在詞彙表 |
| 物流 | 2／1.847298 | 1／1.916291 |
| 退款 | 3／1.559616 | 2／1.510826 |
| 錯誤 | 1／2.252763 | 1／1.916291 |

平滑可想成多加一篇包含詞表中每個詞的文件，因此文件總數與各詞的 df 都加一，避免固定詞表中 df=0 的欄位除以零。從語料新建詞表時，既有詞的 df 原本就至少是 1；平滑不會替未見詞新增欄位。驗證篇只有未見詞時，這套文字轉換會得到全零向量；仍須事先決定如何處理，不能在驗證端重學詞彙表。

### 同一數值資料比較四種轉換

`L23303-M4-A-fold-boundaries.json` 有十二列合成設備資料，三欄單位任意，第二欄有兩個缺值。索引 0–5 標正常、6–11 為需檢查；檔案保留原值、分摺與參數。

第一摺訓練索引是 0、1、2、4、6、7、10、11，驗證是 3、5、8、9。比較的兩邊都先均值補值、再縮放，最後分別用 PCA 或 LDA 降維：

| 學得參數 | 錯誤：全部十二列 fit | 正確：僅八列訓練 fit |
|---|---|---|
| 補值平均 | [7.416667, 17, 5.166667] | [7.25, 17.5, 5] |
| 縮放尺度 | [4.698552, 6.096447, 2.793842] | [5.379359, 6.239992, 2.915476] |
| PCA 主方向 | [0.612361, 0.604795, 0.509153] | [0.605849, 0.606614, 0.514749] |
| LDA 判別方向 | [0.851306, 0.967171, 1.657743] | [1.803347, -0.154537, 1.860311] |

第一摺第二欄已知訓練值為 10、12、11、20、22、30，總和 105，平均 17.5。加進驗證的 9、13、19、24，便是十筆總和 170、平均 17；不用 y 也越界。

PCA、LDA 方向採各自的標準化座標，不能直接比較原單位角度或成效。完整程式見 scikit-learn Pipeline：只在訓練列 fit，驗證只 transform。

## 程式（補充）

先實際比較兩種標準化規則。這段僅檢查前處理參數，後面才比較分類分數。

```python
import numpy as np
from sklearn.preprocessing import StandardScaler
values = np.array([1., 3., 8., 10.]).reshape(-1, 1)
wrong_scaler = StandardScaler().fit(values)
right_scaler = StandardScaler().fit(values[:2])
for name, scaler in [("全資料", wrong_scaler), ("只用訓練", right_scaler)]:
    z8 = scaler.transform(values[2:3])[0, 0]
    print(f"{name}: 平均={scaler.mean_[0]:.3f}, "
          f"尺度={scaler.scale_[0]:.3f}, 8轉為={z8:.3f}")
```
```text
全資料: 平均=5.500, 尺度=3.640, 8轉為=0.687
只用訓練: 平均=2.000, 尺度=1.000, 8轉為=6.000
```

接著重建 JSON 相同的無訊號資料。固定種子 23 產生檢測值與標籤；種子 17 固定分摺。

```python
from sklearn.feature_selection import SelectKBest
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
rng = np.random.default_rng(23)
X = rng.normal(size=(100, 300)).round(6)
y = np.repeat([0, 1], 50)
rng.shuffle(y)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=17)
classifier = LogisticRegression(solver="liblinear", random_state=0)
print(X.shape, np.bincount(y).tolist())
```
```text
(100, 300) [50, 50]
```

錯誤流程在 `cv` 切分前呼叫 `fit_transform(X, y)`。正確流程把相同選擇器放進 Pipeline，讓每摺重新學習特徵清單。

```python
selected = SelectKBest(k=10).fit_transform(X, y)
wrong = cross_val_score(classifier, selected, y, cv=cv, scoring="accuracy")
pipe = make_pipeline(SelectKBest(k=10), classifier)
right = cross_val_score(pipe, X, y, cv=cv, scoring="accuracy")
print("錯誤各摺", wrong.round(3))
print("正確各摺", right.round(3))
print(f"錯誤平均={wrong.mean():.3f}，正確平均={right.mean():.3f}")
```
```text
錯誤各摺 [0.9  0.7  0.6  0.7  0.75]
正確各摺 [0.2  0.6  0.65 0.4  0.6 ]
錯誤平均=0.730，正確平均=0.490
```

:::tip[讀碼重點]
- `SelectKBest` 預設比較特徵與分類標籤的關聯，會用到 `y`。
- 錯誤處不是選了十個特徵，而是在切分前使用全部標籤。
- `cross_val_score(pipe, X, y, ...)` 必須接收原始特徵，不能再傳已洩漏的 `selected`。
:::

### 用相同文字核對，再包進 Pipeline

以下兩個向量器只改 fit 所看的文件範圍。詞彙依套件的欄位順序列出，與上表逐詞對應。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
docs = ["退款 延遲", "帳單 錯誤", "退款 帳單", "物流 延遲",
        "火星 退款", "火星 物流"]
labels = np.array([1, 0, 1, 0, 1, 0])
def vectorizer():
    return TfidfVectorizer(tokenizer=str.split, token_pattern=None,
                           lowercase=False, norm=None)
for name, corpus in [("全資料", docs), ("訓練限定", docs[:4])]:
    vec = vectorizer().fit(corpus)
    print(name, vec.get_feature_names_out().tolist())
    print("IDF", vec.idf_.round(6).tolist())
```
```text
全資料 ['帳單', '延遲', '火星', '物流', '退款', '錯誤']
IDF [1.847298, 1.847298, 1.847298, 1.847298, 1.559616, 2.252763]
訓練限定 ['帳單', '延遲', '物流', '退款', '錯誤']
IDF [1.510826, 1.510826, 1.916291, 1.510826, 1.916291]
```

正確流程把向量器和分類器一起封裝。`fit(docs[:4], ...)` 同時限制詞彙表、IDF 與分類器的訓練範圍；`predict` 只轉換後兩篇，再交給已訓練分類器。

```python
text_pipe = make_pipeline(vectorizer(),
    LogisticRegression(solver="liblinear", random_state=0))
text_pipe.fit(docs[:4], labels[:4])
print("驗證專屬詞有入表嗎", "火星" in text_pipe[0].vocabulary_)
print("驗證預測", text_pipe.predict(docs[4:]).tolist())
```
```text
驗證專屬詞有入表嗎 False
驗證預測 [1, 0]
```

若改用交叉驗證，交給切分器的仍是原始文字與整條 `text_pipe`，每摺重新 fit。兩篇驗證預測恰好正確不代表客服成效，這裡驗收的是學習邊界。

## 怎麼用、怎麼判讀（補充）

本例每摺 20 人，錯誤流程分別答對 18、14、12、14、15 人，共 73 人；正確流程答對 4、12、13、8、12 人，共 49 人。

正確分數約為隨機基準 0.5，符合無訊號的設計。錯誤高分來自全資料的偶然關聯，不能解讀成發現疾病規律。

這些是固定模擬資料的實測，不是醫療成效。換資料種子或套件版本，分數會變；標準化洩漏也未必每次都造成明顯分差。

### 三個檢查問題

- 這個欄位在實際預測當下存在嗎？
- 哪些資料曾參與 `fit`、選特徵或挑參數？
- 驗證資料是否模擬新病人、新交易或更晚時間？

若同一組分數反覆挑超參數，還需獨立測試集或巢狀交叉驗證。Pipeline 只管理放進它的步驟，不處理全部選模偏差。

### 換個場景（補充）

指引 5.3 未列資料洩漏的專屬場景；以下從預測時點檢查不同領域。

| 場景 | 可能越界的資訊 | 應如何處理 |
|---|---|---|
| 醫療診斷 | 用所有病人標籤先挑檢測項目 | 只用訓練病人選特徵 |
| 零售銷量 | 包含下週實際銷量的移動平均 | 每個預測起點只取已知歷史 |
| 客服工單 | 結案後才產生的升級標記 | 排除事後欄位，保留建立當下資訊 |

## 常見誤解（補充）

- 「沒用標籤就不算洩漏」：全部資料的平均與補值規則也會帶入驗證資訊。
- 「驗證資料不能做轉換」：可以 `transform`，只是不能參與學習轉換規則。
- 「分數沒下降就沒有洩漏」：判斷依資訊路徑，不能只依兩個分數的差距。
- 「資料洩漏就是資安外洩」：此處談評估資訊越界，不是資料被未授權者取得。

## 進階（補充）

### 為什麼高維度容易出現假象

當無關特徵很多，總有少數會在這批資料中偶然與標籤相關。若先看全部標籤再挑選，就把驗證集的巧合也納入「規則」。

在每摺訓練資料中選特徵，可以讓驗證資料檢查這些關聯能否延續。這不保證找到訊號，只讓評估保持合理邊界。

### 參考來源

- [scikit-learn：TfidfTransformer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfTransformer.html)、[TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html)（支持：平滑 IDF 公式、訓練詞彙表與文字程式；與指引版本分開）。
- [scikit-learn：SimpleImputer](https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html)、[PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)、[LinearDiscriminantAnalysis](https://scikit-learn.org/stable/modules/generated/sklearn.discriminant_analysis.LinearDiscriminantAnalysis.html)（支持：四種轉換學得的參數與 LDA 的訓練標籤需求）。

- [scikit-learn：Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)（支持：定義、洩漏機制、前處理邊界）。
- [scikit-learn：StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)（支持：標準化公式、尺度與常數特徵）。
- [scikit-learn：SelectKBest](https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.SelectKBest.html)（支持：特徵選擇 API、讀碼重點）。
- [Inria 課程：Benefits of using feature selection](https://inria.github.io/scikit-learn-mooc/python_scripts/feature_selection_introduction.html)（支持：以可控模擬資料比較流程、程式）。
- [Inria 課程：Non i.i.d. data](https://inria.github.io/scikit-learn-mooc/python_scripts/cross_validation_time.html)（支持：時間限制、換個場景）。
- [scikit-learn：交叉驗證](https://scikit-learn.org/stable/modules/cross_validation.html)（支持：病人分組、切分不符部署的限制）。
- [scikit-learn：API 詞彙表](https://scikit-learn.org/stable/glossary.html#term-fit)（支持：直覺中的 fit、transform 與 fit_transform 說明）。

## 小結（補充）

- 檢查整個流程看過的資訊，不只看最後分類器。
- 前處理只能在訓練資料擬合，驗證資料沿用同一轉換。
- 先切摺、再用 Pipeline 學習前處理與模型。
- 高分不是沒有洩漏的證據，預測時間與群組邊界仍須另查。
