---
id: tf-idf
title: 詞頻與逆文件頻率
kind: technique
codes: [L21101]
aliases: [Term Frequency-Inverse Document Frequency]
summary: TF-IDF 結合文件內詞頻與跨文件稀有度，凸顯較具區別力的詞。
goals:
  - id: g1
    text: 依指定的 TF、IDF 與正規化規則算出權重，解釋文件長度與零分母界線
requires: [bag-of-words]
guide_refs: [guide-1:3-17, guide-1:3-18]
formula_groups:
  - id: guide-tf-idf
    source: guide-1:3-17
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21101-B
  - id: sklearn-tf-idf
    source: https://scikit-learn.org/stable/modules/feature_extraction.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21101-B
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 文件集有 100 篇，「電池」出現在 10 篇。某篇有 20 詞，其中電池 2 次。指定 TF 為次數除以總詞數，IDF 為 log10(N/df)，TF-IDF 是多少？
    options:
      A: "1"
      B: "0.1"
      C: "2"
      D: "0.01"
    answer: B
    explain:
      A: 這只有算出逆文件頻率，尚未乘上詞頻。
      B: 詞頻為 2/20，逆文件頻率為 log10(10)=1，乘積為 0.1。
      C: 這是未除文件長度的次數，並非指定權重。
      D: 此值把逆文件頻率錯當成了文件比例。
  - id: c2
    goal: g1
    type: choice
    prompt: 某篇有 40 詞，「座位」出現 2 次。固定原文件集的 IDF 為 2，在文件後加 40 個其他詞後，使用詞數比例 TF 的座位權重如何改變？
    options:
      A: "權重增為兩倍，因為總詞數由 40 變 80，TF 也加倍"
      B: "權重不變，因為座位的次數與 IDF 都沒變"
      C: "權重歸零，因為新增的 40 個詞都不含座位，稀釋了原來詞頻"
      D: "權重減半，因為次數與 IDF 不變、總詞數加倍"
    answer: D
    explain:
      A: "總詞數在詞數比例 TF 的分母，加倍會使權重下降而不是上升。"
      B: "次數與 IDF 固定仍不足以維持權重，總詞數這個分母已改變。"
      C: "原有兩次座位仍在文件中，IDF 又固定為 2，加入其他詞不會使權重歸零。"
      D: "原權重為 (2/40)×2=0.1，新權重為 (2/80)×2=0.05，因此減半。"
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊有 24 篇文件，手算用 log10(N/df)；套件卻用 ln((1+N)/(1+df))+1 再做 L2 正規化。對同一詞得到不同數字，應先如何處理？
    options:
      A: 直接把手算結果改成官方答案
      B: 判定套件一定算錯
      C: 核對 TF、對數底、平滑與最終正規化，分開報告兩套定義
      D: 宣稱平滑只在 df=0 時才改變數字
    answer: C
    explain:
      A: 數值差異要先回到定義，不能只換結果。
      B: 套件可能使用另一套合法的權重約定。
      C: 兩套定義的差異足以造成不同結果，須連同設定交代。
      D: 平滑也會改變正的文件頻率所對應的 IDF。
---

## 為什麼需要

詞袋只計次數，常見詞可能掩蓋較具辨識力的詞。TF-IDF 結合文件內頻率與跨文件稀有度，調整各詞的相對權重。

它適合文件檢索與簡單文本分類。

:::supplement[來源：scikit-learn Feature extraction]
少見不等於重要；罕見錯字也可能得到高權重，仍需檢查資料品質。
:::

## 直覺

同一篇裡多次提到一個詞，通常提高它的權重；若每篇都出現，它對區分文件的幫助就有限。

詞頻（Term Frequency，TF）看單一文件，逆文件頻率（Inverse Document Frequency，IDF）看整個集合。文件頻率數含詞的篇數，同篇只計一次。

## 定義與公式

本頁先用指引的詞數比例 TF（次數除以文件總詞數）與未平滑 IDF。為對齊指引算例，明定對數底為 10：

$$
\begin{aligned}
\mathrm{TF}(t,d)&=\frac{c(t,d)}{L_d}\\
\mathrm{IDF}(t)&=\log_{10}\frac{N}{\mathrm{df}(t)}\\
w(t,d)&=\mathrm{TF}(t,d)\mathrm{IDF}(t)
\end{aligned}
$$

$t$ 是詞，$d$ 是文件；$c(t,d)$ 是出現次數，$L_d$ 是文件總詞數，$N$ 是文件篇數。$\mathrm{df}(t)$ 是含該詞的篇數，$w(t,d)$ 是本套定義的權重。

### 適用界線（補充）

上式要求文件不為空，且目標詞至少出現在一篇文件中。沒有平滑時，df 為零不能直接代入；不能把除以零算成零，也不能對空文件計算詞數比例 TF。

換成其他大於 1 的對數底，未平滑 IDF 會按固定比例改變。換底、平滑、加常數或做向量正規化，是不同操作，須分別交代。

## 算一次

共用例子有 24 篇完整文件，不把顯示詞表切片當成文件總詞數。評論 R02 有 6 詞，「書」出現 1 次；全語料有 4 篇含「書」。

$$
\mathrm{TF}=\frac16,\quad
\mathrm{IDF}=\log_{10}\frac{24}{4}\approx0.778151,\quad
w\approx0.129692
$$

這裡 $N=24$、$L_d=6$、$c=1$、df 為 4。交通 T03 有 8 詞，「票」出現 1 次、df 為 5，故權重是 $(1/8)\log_{10}(24/5)\approx0.085155$。

### 文件長度與套件約定（補充）

固定 IDF，把 R02 全句重複一次，詞數變 12、「書」變 2 次，TF 仍為 1/6。只加 6 個其他詞時，「書」仍 1 次，TF 變成 1/12，權重約 0.064846。

scikit-learn 預設用原始次數乘上平滑 IDF，再做 L2 正規化：

$$
s_t=\ln\frac{1+N}{1+\mathrm{df}(t)}+1,\qquad
u_t=c(t,d)s_t,\qquad
\widehat u_t=\frac{u_t}{\sqrt{\sum_j u_j^2}}
$$

$s_t$ 是套件 IDF，$u_t$ 是正規化前權重，$j$ 遍歷詞表，$\widehat u_t$ 是輸出座標。這個除法用於非零向量，和先除文件詞數不同。

R02 的「書」得到 $s_t=\ln(25/5)+1\approx2.609438$；次數為 1，故 $u_t$ 相同。

完整文件向量的 L2 長度約 5.920944。用這個長度正規化，輸出約為 $2.609438/5.920944=0.440713$。

## 程式（補充）

先實作指引約定。從 repo 根目錄執行；實測器以 `IPAS_REPO_ROOT` 指定 repo，讀取同一份 24 篇文件。

```python
import json, os, math
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L21101-B-vectors.json").read_text(encoding="utf-8"))
docs = data["documents"]
for doc_id, term in [("R02", "書"), ("T03", "票")]:
    tokens = next(d["tokens"] for d in docs if d["id"] == doc_id)
    tf = tokens.count(term) / len(tokens)
    df = sum(term in d["tokens"] for d in docs)
    idf = math.log10(len(docs) / df)
    print(doc_id, term, f"TF={tf:.6f} IDF={idf:.6f} 權重={tf*idf:.6f}")
```
```text
R02 書 TF=0.166667 IDF=0.778151 權重=0.129692
T03 票 TF=0.125000 IDF=0.681241 權重=0.085155
```

以下接續使用 `docs`。指定切分器和大小寫規則，避免套件預設忽略單字元中文詞。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
texts = [" ".join(d["tokens"]) for d in docs]
vec = TfidfVectorizer(tokenizer=str.split, token_pattern=None, lowercase=False)
X = vec.fit_transform(texts)
j = vec.vocabulary_["書"]
print("套件 IDF", f"{vec.idf_[j]:.6f}")
print("R02 正規化後", f"{X[1, j]:.6f}")
```
```text
套件 IDF 2.609438
R02 正規化後 0.440713
```

:::tip[讀碼重點]
兩段的 TF、對數底、平滑與正規化設定不同，所以數字不同。smooth_idf=False 仍保留外面的加 1，不能只關閉平滑就宣稱等同指引公式。
:::

## 怎麼用、怎麼判讀

高權重表示依目前文件集與定義，該詞較能區分文件；它不是詞義正確率，也不是任務重要性的保證。TF-IDF 仍無法直接解決同義詞與多義詞。

:::supplement[來源：scikit-learn TfidfVectorizer API]
用於離線評估時，只在訓練文件 fit 詞表和 IDF，再 transform 驗證與測試文件。本頁用全 24 篇算術示範，不回報模型評估分數。
:::

### 換個場景

| 場景 | 使用方式 | 判讀重點 |
|---|---|---|
| 文件檢索 | 找出查詢與文件共同的重要詞 | 相同字面詞彙有利比對 |
| 簡單文本分類 | 加權後交給分類器 | 常見詞影響降低，但語意限制仍在 |
| 製造維修紀錄（補充） | 凸顯較少見的零件或錯誤碼 | 罕見拼字錯誤不能當故障證據 |
| 圖書推薦（補充） | 比對簡介中的特色詞 | 沒有共同詞的近義簡介可能被漏掉 |

## 常見誤解

- 「df 就是詞在全語料出現的總次數」：它數篇數，同一篇只計一次。
- 「常見詞必定是無意義詞」：在本套未平滑公式，所有文件都有的詞權重為零；但否定詞可能仍對任務重要。
- 「所有 TF-IDF 都給一樣的數字」：先確認對數底、TF 定義與正規化。（補充）

## 進階

### 指引公式核對

指引 3-17 的 PDF 確認 IDF 是文件篇數除以含詞篇數。3-18 的例子把 log(100) 算成 2，可判定該算例採常用對數；本頁據此明寫底數。

### 參考來源

- 科目 1 學習指引 3-17～3-18（已對照 PDF）：支持 TF、IDF、乘積、算例深度與領域用途。
- [scikit-learn 1.9 Feature extraction 8.2.3.5 Tf–idf term weighting](https://scikit-learn.org/1.9/modules/feature_extraction.html#tfidf-term-weighting)：支持平滑、自然對數、L2 正規化與差異算例。
- [TfidfVectorizer API](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html)：支持切分設定、fit／transform 與邊界處理。
- [Jurafsky 與 Martin 第 5 章](https://web.stanford.edu/~jurafsky/slp3/5.pdf)：支持從詞頻過渡到詞項權重的教學脈絡。

## 小結

- TF 看文件內次數與長度，df 看含詞的文件篇數。
- 未平滑公式遇到 df 為零或空文件，不能直接代入。（補充）
- 算數字前先固定對數底、平滑與正規化規則。（補充）
- 權重是統計訊號，不能代替語意與任務判斷。
