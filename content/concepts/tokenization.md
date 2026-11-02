---
id: tokenization
title: 斷詞與子詞切分
kind: technique
codes:
  - L21101
aliases:
  - BPE
  - 分詞
summary: 斷詞把文字切成輸入單位；字、詞與子詞的邊界各不相同。
goals:
  - id: g1
    text: 比較中文與中英混合句的詞級切分、子詞切分及未登錄詞處理
  - id: g2
    text: 核對字、詞、子詞的 token 數，走完小型 BPE 合併並判斷長度取捨
requires:
  - nlp
guide_refs:
  - guide-1:3-9
  - guide-1:3-10
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 混合句「我用books訂位」採用詞級切分時有 4 個詞。字典沒有 books，哪個策略較合理？
    options:
      A: 將整句刪除以維持詞彙表
      B: 宣稱所有方法都一定輸出同一個未知符號
      C: 依模型既定切分器，將少見詞拆成已知子詞
      D: 先移除所有英文字母
    answer: C
    explain:
      A: 刪句會丟失其他有效訊息。
      B: 未登錄詞的處理取決於切分方法與基本符號覆蓋。
      C: 子詞能重用已學片段，但要與模型原有詞彙表一致。
      D: 刪除英文會失去書籍或服務名稱等資訊。
  - id: c2
    goal: g2
    type: choice
    prompt: 某教學切分器把「我用books訂位」切成「我／用／book／s／訂／位」。不加特殊符號時，token 數是多少？
    options:
      A: "4"
      B: "6"
      C: "9"
      D: "12"
    answer: B
    explain:
      A: 4 是本例人工詞級切分的數量。
      B: 列出的六個片段各算一個 token。
      C: 9 是原句不含空白的字元數。
      D: 此處沒有補任何邊界或特殊符號。
  - id: c3
    goal: g2
    type: choice
    prompt: BPE 訓練詞為 books、books、booking、booked。首輪從字元開始，相鄰 b+o 共出現 4 次，k+s 共出現 2 次。以下哪個敘述正確？
    options:
      A: 一定先合併 k+s，因為片段較短
      B: 合併可以跨越任何兩個原始詞
      C: 第一輪後 books 必定已成為單一 token
      D: 先按頻率及固定同分規則合併；之後重新計數
    answer: D
    explain:
      A: 合併依相鄰 pair 的頻率，並非較短者優先。
      B: 本例明定不跨詞邊界合併。
      C: 第一輪只完成一種 pair 合併，尚未學到完整 books。
      D: 每輪的符號已改變，需重新計數後選下一個 pair。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

中文句子通常沒有空白，「訂位」要當一個詞還是兩個字，必須先決定。英文雖有空白，少見詞與詞形變化仍可能不在詞彙表中。

斷詞（Tokenization，指引亦稱分詞）把文字變成可編號的輸入單位；一個單位稱為 token。切分不同，後面的詞性、特徵與模型輸入也跟著不同。

## 直覺

字級切分顆粒細，詞級切分較接近詞彙意義。子詞把常見片段合起來，少見詞則由較小單位組成。

![同一句在三列保留相同字元位置；比較 books 與訂位的邊界，不把 token 等同於中文字數。](figure:l21101-tokenization-alignment)

## 定義與公式

中文可以依字典或模型找詞邊界。切錯時，「訂位」可能失去一個完整動作的表示，後續分類也可能看不到原先的詞特徵。

:::supplement[來源：Hugging Face LLM Course Byte-Pair Encoding tokenization]
未登錄詞是整個詞不在既有詞彙表中的情形。子詞切分能重用已知片段；能否完整處理新字元，仍取決於基本字元或位元組是否有覆蓋，不能保證任何子詞方法都沒有未知符號。

位元組配對編碼（BPE，英文 Byte-Pair Encoding）反覆合併訓練語料中高頻相鄰符號。下面採用「字元起始、不可跨詞」的簡化版，並非特定模型的正式 tokenizer。
:::

## 走一次流程

共用交通語料 T12「我用books訂位」是人工合成的混合句。詞級字典在此明定把 books 當一個詞，方便比較三種顆粒。

| 顆粒 | 切分結果 | token 數 |
|---|---|---|
| 字元 | 我／用／b／o／o／k／s／訂／位 | 9 |
| 詞 | 我／用／books／訂位 | 4 |
| 本例子詞 | 我／用／book／s／訂／位 | 6 |

若詞彙表沒有 books，整詞方法可能回退到未知符號；本例已有 book 與 s，所以可以組出 books。這六個子詞是示範規則的結果，不是對真實模型的 token 預測。

:::supplement[來源：Hugging Face LLM Course Byte-Pair Encoding tokenization]
本例預先將「我、用、訂、位」列入可用的基本字元；下面的英文語料只用來學合併規則。若基本字元表未收這些中文字，正式切分器仍可能輸出未知符號。

BPE 微型語料取 books 兩次、booking 與 booked 各一次。三輪依序合併 b+o、bo+o、boo+k，各輪最高頻率都是 4；原來 23 個字元 token，三輪後剩 11 個。

這只學到 book，沒有學到「訂位」，因此該中文詞在子詞列仍分成兩個字。分詞結果可不同於語言學上的完整詞。
:::

## 程式

### 三輪 BPE（補充）

程式只用標準函式庫，不下載字典；沒有隨機步驟。同分時用 pair 的字典序決定，避免每次得到不同的合併順序。

```python
from collections import Counter
words = [list(w) for w in ["books", "books", "booking", "booked"]]
print("起始", sum(map(len, words)))
for _ in range(3):
    counts = Counter(p for w in words for p in zip(w, w[1:]))
    pair = min(counts, key=lambda p: (-counts[p], p))
    updated = []
    for word in words:
        merged, i = [], 0
        while i < len(word):
            hit = tuple(word[i:i + 2]) == pair
            merged.append("".join(pair) if hit else word[i])
            i += 2 if hit else 1
        updated.append(merged)
    words = updated
    print("+".join(pair), counts[pair])
print(words[0], sum(map(len, words)))
```
```text
起始 23
b+o 4
bo+o 4
boo+k 4
['book', 's'] 11
```

:::tip[讀碼重點]
每輪先從目前的符號重新計數；while 從左到右合併，已合併的符號不會重複使用。這段同時保留訓練與合併，才能看出結果如何產生。
:::

## 怎麼用、怎麼判讀

中文與日文等無空白語言，不能只靠空白找到詞。先確認下游系統使用哪個字典、切分規則與詞彙表，再比較結果。

:::supplement[來源：Hugging Face LLM Course Introduction；Byte-Pair Encoding tokenization]
比較同一段文字時，字級通常較長、整詞詞彙表較大，子詞在兩者之間折衷；實際數量依語言與詞彙表而變。上下文上限以 token 計時，切得更細可能容納較少原文，也可能增加運算或計量成本。

:::

### 切分器與模型（補充）

:::caution[注意]
預訓練模型須使用原配切分器及 token ID 對照；換字典後，相同 ID 可能代表另一個片段。
:::

### 換個場景

| 場景或資料條件 | 用法 | 判讀重點 |
|---|---|---|
| 中文、日文無空白語料 | 字典或模型切詞 | 詞邊界是否符合任務 |
| 電商品名（補充） | 子詞表示新品牌 | 保留字元、避免整詞未知 |
| 交通地名（補充） | 比較詞級與子詞結果 | 站名可能跨多個 token |
| 法律長文（補充） | 使用模型原配切分器 | 截斷前先看 token 數 |

## 常見誤解

- 「token 一定是一個完整單字」：也可能是字、子詞或標點。
- 「切得越細一定越準」：覆蓋提高時，序列也可能變長。（補充）
- 「BPE 的每次合併都代表一個詞」：合併依頻率，不必符合詞義邊界。（補充）

## 進階

### 真實切分器的差異（補充）

有些 BPE 系統從位元組起始，還有正規化、預切分與特殊符號。本頁的 9、4、6 都排除了空白與特殊符號；比較真實模型時，要把這些設定一併記錄。

### 參考來源

- 科目 1 學習指引 guide-1:3-9、guide-1:3-10：支持分詞用途、中文無空白與 BPE 名稱。
- [Hugging Face：BPE 課程](https://huggingface.co/learn/llm-course/chapter6/5)：支持「走一次流程」、合併程式與覆蓋界線。
- [Hugging Face：Tokenizer Introduction](https://huggingface.co/learn/llm-course/chapter6/1)：支持「怎麼用、怎麼判讀」的原配切分器原則。
- [NLTK Book 第 3 章](https://www.nltk.org/book/ch03.html)：參考 token 與原始文字的對照教法。

## 小結

- 先決定字、詞或子詞的顆粒，再數 token。
- BPE 按相鄰符號頻率逐輪合併，結果取決於語料與規則。
- 新詞覆蓋、詞彙表大小與序列長度需要一起考量。
