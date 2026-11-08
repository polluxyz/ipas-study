---
id: word2vec
title: Word2Vec：CBOW 與 Skip-gram
kind: model
codes: [L21101]
aliases: [CBOW, Skip-gram]
summary: CBOW 用附近詞猜中間詞；Skip-gram 反過來猜附近詞。
goals:
  - id: g1
    text: 依固定視窗建立 CBOW 的上下文到中心詞樣本，說明效率條件
  - id: g2
    text: 用相同語料建立 Skip-gram 詞對，比較低頻詞與運算量的取捨
requires: [word-embedding]
guide_refs: [guide-1:3-20, guide-1:3-21]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 句子為「我／不／要／訂／明天／的／票」，中心詞是訂，固定左右各 2 詞且不跨句。CBOW 的輸入與目標是什麼？
    options:
      A: "以「訂」為輸入，依序預測「不、要、明天、的」四個周邊詞"
      B: "以整句 7 個詞為輸入，重建相同的 7 個詞作為目標"
      C: "我、票作輸入，訂作目標"
      D: "不、要、明天、的作輸入，訂作目標"
    answer: D
    explain:
      A: "用中心詞預測周邊詞是 Skip-gram 的方向，與本題 CBOW 相反。"
      B: "本題 CBOW 以指定視窗預測一個中心詞，並非整句重建。"
      C: "我與票距中心各三個位置，超出左右各二詞的指定範圍。"
      D: "半徑二涵蓋左邊的不、要與右邊的明天、的，目標是中心詞訂。"
  - id: c2
    goal: g2
    type: choice
    prompt: 同一個中心詞訂的固定視窗有 4 個周邊詞。不做抽樣時，標準 Skip-gram 正樣本有幾個，以及方向為何？
    options:
      A: 1 個，四詞合起來預測訂
      B: 4 個，訂各自預測一個周邊詞
      C: 4 個，每個周邊詞各自預測訂
      D: 16 個，周邊詞彼此全部配對
    answer: B
    explain:
      A: 合併上下文預測中心是 CBOW 的方向。
      B: 每個中心到周邊的有向詞對形成一個正樣本。
      C: 這把中心與目標反過來，並非此處的 Skip-gram。
      D: 此任務不把周邊詞彼此兩兩組成目標。
  - id: c3
    goal: g2
    type: choice
    prompt: 某領域有 100 萬詞，少數專有詞只出現 3 次，團隊比較 CBOW 與 Skip-gram。哪個判斷較合理？
    options:
      A: Skip-gram 保證只出現一次的詞也有完美語意
      B: 兩者一定有相同數目的預測目標與耗時
      C: Skip-gram 可給少見中心詞多個周邊預測訊號，但需評估成本與資料量
      D: CBOW 只適用少於 100 萬詞的資料
    answer: C
    explain:
      A: 資料過少仍可能學不到可靠關係。
      B: 固定視窗下兩者組織預測任務的方式不同，成本還受實作影響。
      C: 這是長尾詞與計算量的取捨，需以相同資料驗證。
      D: CBOW 沒有這種硬性詞數上限。
---

## 為什麼需要

要讓電腦學到詞義，不必替每個詞手填一組數字。Word2Vec 會從訓練用的文字學到這組數字。做法是讓模型用詞與附近詞的關係，練習預測詞語。

用附近的詞猜中間的詞。這叫連續詞袋模型（Continuous Bag of Words，CBOW）。Skip-gram 則用中間的詞，分別猜附近的詞。

## 直覺

CBOW 先讀中間詞附近的文字，再猜中間缺哪個詞。Skip-gram 則讀中間的詞，再分別預測附近會出現哪些詞。

![兩列使用相同的「訂」與四個附近詞。箭頭從模型讀到的詞，指向模型要猜的詞。](figure:l21101-word2vec-direction)

模型用附近的詞練習，學到每個詞對應的一組數字。這叫靜態詞嵌入：訓練後，同一個詞都取用同一組數字。語境型詞嵌入則不同：每次會依句子重新產生這組數字。

## 定義與公式

CBOW 合併周邊詞的表示，預測中心詞。Skip-gram 由中心詞預測各個周邊詞；同一中心可以產生多個有向詞對。

### 本組的視窗約定（補充）

視窗半徑固定為 2，左右各最多兩詞；不跨文件、不補邊界詞，也不抽掉高頻詞。句首與句尾的周邊較少，不能一律當成四詞。

CBOW 的基本合併不區分這些周邊詞的排列；Skip-gram 基本詞對也不額外標記左右位置。因此別把局部預測等同於完整保留語序。

## 走一次流程

沿用交通語料 T02「我／不／要／訂／明天／的／票」。選「訂」作中心，周邊依原序是「不、要、明天、的」。

| 架構 | 輸入 | 目標 |
|---|---|---|
| CBOW | 不、要、明天、的合併 | 訂 |
| Skip-gram | 訂 | 不 |
| Skip-gram | 訂 | 要 |
| Skip-gram | 訂 | 明天 |
| Skip-gram | 訂 | 的 |

### 把中心移到句首（補充）

中心移到「我」時，只看得到右方的「不、要」。此時 CBOW 有一個上下文到中心的樣本；Skip-gram 有「我到不」與「我到要」兩個正樣本。

對全 24 句逐詞移動，在本組規則下共有 120 個 CBOW 樣本、336 個 Skip-gram 有向正樣本。這是樣本組織方式的數量，還不是訓練耗時或語意品質。

## 程式（補充）

只生成樣本，不訓練嵌入。從 repo 根目錄讀共用 JSON；實測器用 `IPAS_REPO_ROOT` 指定 repo，無隨機步驟。

```python
import json, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L21101-B-vectors.json").read_text(encoding="utf-8"))
sentences = [d["tokens"] for d in data["documents"]]
tokens = next(d["tokens"] for d in data["documents"] if d["id"] == "T02")
def neighbors(s, i):
    return s[max(0, i-2):i] + s[i+1:i+3]
context = neighbors(tokens, 3)
print("CBOW", context, "->", tokens[3])
print("Skip-gram", [(tokens[3], w) for w in context])
print("CBOW 總數", sum(map(len, sentences)))
print("Skip-gram 總數", sum(len(neighbors(s, i)) for s in sentences for i in range(len(s))))
```
```text
CBOW ['不', '要', '明天', '的'] -> 訂
Skip-gram [('訂', '不'), ('訂', '要'), ('訂', '明天'), ('訂', '的')]
CBOW 總數 120
Skip-gram 總數 336
```

:::tip[讀碼重點]
切片把句首與句尾自然截短。這裡的 pair 順序是中心、周邊；不要在建立標籤時反過來。
:::

## 怎麼用、怎麼判讀

指引以 CBOW 的訓練速度與 Skip-gram 的低頻詞表現作比較，也概括 Skip-gram 較能捕捉語意。低頻中心詞可對多個周邊目標提供訊號，但仍可能因資料太少而不穩。

### 效率要附條件

指引 3-20 說 CBOW 訓練較快，這句話要附下列條件才成立。

:::supplement[來源：Mikolov 等人原論文第 3 節；Mikolov 等人後續研究]
固定相同視窗與輸出計算方式時，CBOW 合併上下文後預測一次，Skip-gram 則分別預測多個周邊詞。這是分析工作量的線索，不能只按樣本數宣稱精確的耗時倍數。

實際成本還受負採樣、向量維度、高頻詞抽樣與實作影響。此處不展開負採樣推導，也不以微型語料訓練結果宣稱某架構必勝。
:::

### 換個場景

| 場景 | 使用方式 | 判讀重點 |
|---|---|---|
| 小型語料、重視速度 | 指引列出 CBOW 的適用方向 | 原始專案另以速度／低頻詞比較，見進階校正 |
| 低頻詞較重要 | 比較 Skip-gram | 關注少見詞的訊號與穩定度 |
| 類比與相似詞搜尋 | 使用學到的靜態向量 | 相近不是邏輯保證 |
| 製造維修用語（補充） | 比較專有詞與周邊零件詞 | 同設備文件重複不可誤當獨立證據 |
| 圖書評論（補充） | 以相同視窗建立評論詞對 | 否定與反義詞可能共享上下文 |

## 常見誤解

- 「CBOW 的目標是周邊詞」：目標是中心詞；Skip-gram 才由中心預測周邊。
- 「Skip-gram 就是下一詞預測」：本例左右兩側都作目標，不只右方下一詞。
- 「CBOW 只適合小資料」：指引列出小型語料用途，不是禁止它處理大語料的上限。（補充）

## 進階

### 指引表述校正

指引 3-20 把小型語料列為 CBOW 的適用條件，3-21 又概括 Skip-gram 的語意表現較佳。讀題要辨認它在比較速度、詞頻還是語意；這些描述不是所有資料上的品質排名。

:::supplement[來源：word2vec 原始專案說明 Performance]
原始專案把 CBOW 列為速度快，Skip-gram 則較慢但對罕見詞較好，沒有把小型語料列為 CBOW 的專屬優勢。實務選型應分開評估速度、詞頻與驗證成效，不能只因資料少就決定用 CBOW。
:::

### 固定視窗與正式訓練（補充）

正式工具可能隨機縮短視窗或抽掉高頻詞，所以未必得到本頁的 336 對。比較前需核對設定；資料切分與種子固定也不能替代完整的訓練參數紀錄。

### 參考來源

- 科目 1 學習指引 3-20～3-21：支持兩種預測方向、速度與低頻詞比較、類比用途。
- [Mikolov 等人（2013）原論文第 3 節](https://arxiv.org/pdf/1301.3781)：支持架構、局部上下文與計算方式。
- [Mikolov 等人後續研究](https://arxiv.org/abs/1310.4546)：支持抽樣與訓練效率的補充背景。
- [word2vec 原始專案說明](https://code.google.com/archive/p/word2vec/)：Performance 段支持速度與低頻詞的比較；封存內容可由 [Google 封存 JSON](https://storage.googleapis.com/google-code-archive/v2/code.google.com/word2vec/project.json) 的 description 欄讀取。
- [Jurafsky 與 Martin 第 5 章](https://web.stanford.edu/~jurafsky/slp3/5.pdf)：支持中心到上下文的詞對教學與視窗判讀。

## 小結

- CBOW 是上下文到中心；Skip-gram 是中心到周邊。
- 同一語料與視窗可生成兩種不同的預測任務。
- 低頻詞與效率的取捨需要附上資料和實作條件。
- 訓練利用上下文，使用時仍屬每詞固定的靜態表示。
