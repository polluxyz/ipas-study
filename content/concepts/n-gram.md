---
id: n-gram
title: N-gram 文字片段與語言模型
kind: model
codes:
  - L21101
aliases:
  - Bigram
  - N-gram Language Model
  - N-grams
  - Trigram
summary: N-gram 擷取連續 n 個字或詞，保留局部順序並可用來估計下一詞。
goals:
  - id: g1
    text: 列出字或詞的 bigram、trigram，核對索引並判斷短記憶與稀疏性的取捨
requires:
  - tokenization
guide_refs:
  - guide-1:3-7
  - guide-1:3-18
  - guide-1:3-19
formula_groups:
  - id: window
    source: guide-1:3-18
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21101-A
  - id: bigram-frequency
    source: https://web.stanford.edu/~jurafsky/slp3/3.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21101-A
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 評論已切成「這／本／書／很／實用」，不加句界、不跨句。詞級 trigram 有幾個？
    options:
      A: "2"
      B: "3"
      C: "4"
      D: "5"
    answer: B
    explain:
      A: 2 不是長度 5 的序列在三詞窗口下的起點數。
      B: 起點依序為 1、2、3，共三個窗口。
      C: 4 是同一句的 bigram 數。
      D: 5 是 unigram 數，不能每個位置都放完整三詞窗口。
  - id: c2
    goal: g1
    type: choice
    prompt: 語料只有 12 句，工程師把詞級 bigram 改為 5-gram。最合理的預期是什麼？
    options:
      A: "12 句的 bigram 都已見過，因此組成的每個 5-gram 也都已見過"
      B: "5-gram 會共享各句的全部詞，因此局部片段就能捕捉無限長語境"
      C: "每句固定產生 5 個窗口，與該句有多少詞無關"
      D: "片段保留較長局部語境，但未見片段與稀疏問題可能增加"
    answer: D
    explain:
      A: "看過短片段不代表看過它們的每種長片段組合，小語料尤其難覆蓋。"
      B: "每個 5-gram 仍只涵蓋連續五詞，不會因共享詞彙而取得無限長語境。"
      C: "5 是窗口長度，窗口數還取決於句子詞數；不補邊界時為 max(m−5+1, 0)。"
      D: "較大窗口能看更多局部詞，同時需要更多資料支持較長片段的統計。"
  - id: c3
    goal: g1
    type: choice
    prompt: 某句只有 2 個詞，設定 n=3，不加邊界符號。應輸出什麼？
    options:
      A: 空清單，因為放不下完整三詞窗口
      B: 自動重複最後一詞補成 3 個
      C: 把相鄰下一句的首詞接進來
      D: 把 n 改成 2 後仍稱 trigram
    answer: A
    explain:
      A: 本例不補齊也不跨句，因此沒有合法起點。
      B: 補齊需要額外規則，本題明定不加邊界。
      C: 跨句會製造不存在於原句的片段。
      D: 兩詞窗口是 bigram，不能仍稱 trigram。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

只看單一詞，容易忽略「不／喜歡」這樣的局部關係。N-gram 直接保留一小段連續順序，讓短語也能成為特徵。

同一批片段還能統計後續詞的出現規律，建立簡單語言模型。但片段本身與下一詞機率是不同層次，不能混為一談。

## 直覺

把固定大小的窗口放到詞序列上，每次向右移一格。窗口寬 2 是 bigram，寬 3 是 trigram；每個窗口裡的詞必須連續。

![窗口每次只移一個位置；五個詞可放四個雙詞窗口，不能把句尾單詞當成完整窗口。](figure:l21101-n-gram-window)

## 定義與公式

對長度為 $m$ 的序列 $S=(w_1,\ldots,w_m)$，一次擷取從第 $i$ 個位置開始的 $n$ 個連續單位：

$$
G_i=(w_i,w_{i+1},\ldots,w_{i+n-1}),\quad 1\le i\le m-n+1
$$

$w_i$ 是第 $i$ 個字或詞，$G_i$ 是該窗口；$m$ 是序列長度，$n$ 是正整數窗口寬。本式不跨句、不補句界，當 $m<n$ 時沒有合法窗口。

代入 R03「這／本／書／很／實用」，$m=5,n=2$，合法起點是 1 到 4。第一個 $G_1$ 是「這／本」，最後一個 $G_4$ 是「很／實用」。

:::supplement[來源：Jurafsky 與 Martin Speech and Language Processing 第 3 章]
若要估計下一詞，可計算 bigram 的相對頻率：

$$
\widehat P(v\mid u)=\frac{C(u,v)}{C_{\mathrm{out}}(u)}
$$

$u,v$ 是前一詞與下一詞；$C(u,v)$ 是片段次數。$C_{\mathrm{out}}(u)$ 只計 $u$ 有後續詞的位置，且必須大於零。

這個分母加總所有前詞為 $u$ 的 bigram 次數。每句末尾補結束符號，或 $u$ 從不在句尾時，便等於一般詞的 $C(u)$；否則不可把句尾的 $u$ 算進分母。

| 語料 | 對應片段 | 「要」的後詞 |
|---|---|---|
| T01 | 我／要／訂…… | 訂 |
| T02 | 我／不／要／訂…… | 訂 |
| T03 | 我／要／查…… | 查 |

三句中「要」後接 2 次「訂」、1 次「查」，故 $\widehat P(\text{訂}\mid\text{要})=2/3$。此為指定三句的經驗估計。
:::

## 算一次

同一筆 R03 分別用兩種窗口，不能中途換切分。

| 起點（一起始） | bigram | trigram |
|---|---|---|
| 1 | 這／本 | 這／本／書 |
| 2 | 本／書 | 本／書／很 |
| 3 | 書／很 | 書／很／實用 |
| 4 | 很／實用 | 無完整窗口 |

bigram 共 4 個，trigram 共 3 個。換成 T03「我／要／查／台北／到／台南／的／票」，共 8 詞，則有 7 個 bigram、6 個 trigram。

若改用 R03 的字級序列「這／本／書／很／實／用」，同樣的 trigram 會有 4 個。單位從詞改成字後，片段與數量都會改變。

## 程式

### 固定窗口與邊界（補充）

程式保留每個位置的出現，包含重複片段；若改成集合，重複次數就會消失。

```python
def grams(tokens, n):
    if n < 1:
        raise ValueError("n 必須是正整數")
    return [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]
tokens = ["這", "本", "書", "很", "實用"]
for n in [2, 3]:
    parts = grams(tokens, n)
    print(n, len(parts), ["/".join(p) for p in parts])
print("短句", grams(["查", "票"], 3))
print("重複", grams(["票", "票", "票"], 2))
```
```text
2 4 ['這/本', '本/書', '書/很', '很/實用']
3 3 ['這/本/書', '本/書/很', '書/很/實用']
短句 []
重複 [('票', '票'), ('票', '票')]
```

:::tip[讀碼重點]
Python 索引從 0 開始，所以最後起點是 len(tokens)-n。range 的上界不包含在內，才需要再加 1。
:::

## 怎麼用、怎麼判讀

N-gram 適合保留短期語境與局部順序，也能作為簡單語言模型的基礎。窗口變大可看到較長片段，但可能片段種類更多、重複觀測更少。

要分清「單句窗口數」與「整份語料可能有的特徵種類」。同一句的窗口變寬後，窗口數反而變少；稀疏性問題說的是許多可能片段缺乏觀測。

### 換個場景

| 場景或資料條件 | 用法 | 判讀重點 |
|---|---|---|
| 短期語境依賴、簡單語言模型 | 取相鄰片段與統計 | 窗口外資訊看不到 |
| 電商評論（補充） | 保留「不喜歡」等局部詞組 | 切分與否定範圍 |
| 交通客服（補充） | 比較「要訂」「要查」 | 小語料未見組合多 |
| 文件比對（補充） | 用字元片段找局部重疊 | 重疊不代表語意完全相同 |

## 常見誤解

- 「N-gram 可跳著選詞」：標準連續片段不跳詞。
- 「n 越大，單句窗口就越多」：固定長度下，合法起點會減少。
- 「機率為零表示語法錯誤」：未平滑估計也可能只是語料沒看過。（補充）

## 進階

### 未見片段（補充）

較大的 n 會需要更多語料來估計機率。平滑可替未見片段分配機率，但不會讓固定窗口突然記住整篇長文。

### 參考來源

- 科目 1 學習指引 guide-1:3-7、guide-1:3-18、guide-1:3-19：支持窗口公式、短記憶、稀疏性與簡單語言模型用途。
- [Jurafsky、Martin：N-gram Language Models](https://web.stanford.edu/~jurafsky/slp3/3.pdf)：支持「定義與公式」的條件機率與「進階」的未見片段。
- [NLTK Book 第 5 章](https://www.nltk.org/book/ch05.html)：參考短上下文與序列標註的對照教法。

## 小結

- 先固定字或詞的單位，再逐格列出連續窗口。
- 片段抽取保留順序；語言模型另外估計後續詞的機率。
- n 較大能保留較長局部語境，也可能加重稀疏性。
