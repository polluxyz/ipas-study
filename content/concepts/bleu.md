---
id: bleu
title: BLEU 文本評估
kind: metric
codes: [L21101, L21103]
aliases: [Brevity Penalty]
summary: BLEU 比較候選與參考的連續詞片段重疊，再修正過短輸出的分數
goals:
  - id: g1
    text: 解釋 BLEU 的匹配方向、短句懲罰、翻譯用途及語意限制
  - id: g2
    text: 以固定 token 計算裁切精確率及簡化 BLEU，說明平滑與語料彙整前提
contrasts:
  - target: rouge
    note: BLEU 以候選詞片段的精確率搭配長度修正；ROUGE 強調參考摘要的內容召回
    source: [guide-1:3-66, guide-1:3-67]
guide_refs: [guide-1:3-66]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: clipped-precision
    source: https://aclanthology.org/P02-1040.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-C
  - id: bp-bleu
    source: https://aclanthology.org/P02-1040.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 翻譯候選只輸出參考中的1個詞，這個詞確實匹配。為何不能只用單詞精確率判為滿分？
    options:
      A: 還要考慮長度修正，過短輸出可能漏掉內容
      B: 單詞匹配就能代表整篇完整，可直接給滿分
      C: 單詞精確率已計入參考所有漏詞，不需再使用短句懲罰或高階片段
      D: 長度修正只會獎勵比參考短的輸出，應靠它把這個候選加分到滿分
    answer: A
    explain:
      A: 短句可能以少量匹配詞取得高精確率，BLEU另用長度修正處理。
      B: 一個匹配詞無法證明整篇內容都已表達。
      C: 精確率分母是候選片段，不會直接計入全部參考漏詞。
      D: 短句懲罰對過短輸出減分，不是額外獎勵。
  - id: c2
    goal: g2
    type: choice
    prompt: 參考只有1次「客服」，候選為「客服 客服 客服」。依裁切計數，單詞精確率是多少？
    options:
      A: 3/3，因為三次出現都可以使用同一次參考匹配
      B: 1/1，因為只留下不同詞種，候選的重複次數不入分母
      C: 1/3，分子最多使用參考的一次，分母仍是三個候選詞
      D: 0/3，因為一旦出現重複詞，全部匹配都必須取消
    answer: C
    explain:
      A: 同一次參考出現不能無限重用，匹配次數須裁切。
      B: 分母仍是候選出現的三個單詞，不是唯一詞種數。
      C: 裁切分子為一次，候選分母為三次，所以是三分之一。
      D: 重複會降低分數，但不會取消那一次有效匹配。
  - id: c3
    goal: g2
    type: choice
    prompt: 固定BLEU-2、不平滑，候選長度5、參考長度6，且單詞與雙詞精確率都是1。分數約多少？
    options:
      A: '1.0000，因為兩種精確率都是1，所以不需要長度修正'
      B: '0.8187，因為長度修正為exp(1−6/5)'
      C: '0.8333，因為BLEU直接用候選長度除以參考長度'
      D: '0.2000，因為應將長度比減1當作最後的BLEU分數'
    answer: B
    explain:
      A: 過短候選仍要乘上短句懲罰。
      B: 精確率幾何平均為1，再乘上exp(-0.2)約0.8187。
      C: 五除以六是長度比例，不是BLEU使用的指數懲罰。
      D: 長度差的線性運算不是BLEU的計算方式。
---

## 為什麼需要

翻譯常有多個候選，逐一人工比較很花時間。BLEU（Bilingual Evaluation Understudy）比較候選與參考的連續詞片段，提供快速且可重複計算的指標。

它主要用於機器翻譯，也可協助文本生成評估。分數反映字面相似程度，不能直接當成事實正確率。

## 直覺

先把文字固定成詞單位（Token），再數連續一詞、兩詞等片段，稱為 n-gram。候選有多少片段與參考相同，是精確率方向的問題。

![先看單詞的連線，再看相鄰雙詞；期限錯誤仍可能保留多數字面匹配。](figure:l21103-bleu-matching)

只輸出參考中的少數詞，可能讓精確率很高。短句懲罰（指引稱簡短懲罰；Brevity Penalty，BP）因此對過短輸出減分，避免只靠刪短句子取得好分數。

## 定義與公式

BLEU 結合詞片段重疊與長度修正，常以0到1呈現；越高表示在同套評估設定下越接近參考。本頁的算例固定使用單一參考及教學分詞。

### 裁切精確率（補充）

先數每種候選片段，再把匹配次數限制在參考允許的次數。重複同一個詞，不能一直借用參考中同一次出現來得分。

$$
p_n=\frac{\sum_{g}\min\!\left(C(g),\max_j R_j(g)\right)}{\sum_g C(g)}
$$

其中，$g$是候選中的一種$n$詞片段；$C(g)$是候選次數，$R_j(g)$是第$j$份參考的次數。$p_n$的分母是全部候選片段次數，不是參考片段數。

本組只有一份參考，因此最大參考次數就是該份的次數。有多份參考時，逐片段取最大次數，不把多份的次數直接相加。

### 長度與幾何平均（補充）

候選長度$c$大於0時，使用：

$$
\mathrm{BP}=\exp\!\left(\min\left(0,1-\frac{r}{c}\right)\right),\qquad
\mathrm{BLEU}_N=\mathrm{BP}\cdot\exp\!\left(\sum_{n=1}^{N}w_n\ln p_n\right)
$$

$r$是有效參考長度，$N$是最大片段長度，$w_n$是加總為1的非負權重。標準常見設定為$N=4$、各權重$1/4$；本頁教學改用$N=2$、各權重$1/2$。

本頁的兩階設定可寫成$\mathrm{BP}\sqrt{p_1p_2}$。在不平滑設定下，任一使用的$p_n=0$，整體即為0；程式直接處理零值，避免計算$\ln 0$。

:::caution[注意]
BLEU-2、BLEU-4、句級與語料級分數不能直接混比。分詞、參考數、平滑與0–1或0–100尺度，也必須一起交代。（補充）
:::

## 算一次

:::supplement[來源：Papineni 等（2002）§2；本組教學合成資料]

使用 `L21103-C-generation.json` 的 CS01。參考為「客服／於／三日／內／回覆／申請」；A為前五詞，B把「三日」改成「一日」。斜線只標固定分詞。

| 計算項目 | 候選 A | 候選 B |
|---|---|---|
| 單詞匹配 | 5/5＝1 | 5/6＝0.8333 |
| 雙詞匹配 | 4/4＝1 | 3/5＝0.6000 |
| 候選長度$c$、參考$r$ | 5、6 | 6、6 |
| BP | $e^{1-6/5}=0.8187$ | $e^0=1$ |
| BLEU-2 | $0.8187\sqrt{1\times1}=0.8187$ | $1\sqrt{(5/6)(3/5)}=0.7071$ |

B的雙詞只匹配「客服／於」「內／回覆」「回覆／申請」。期限附近的兩個片段不匹配，其他部分仍可得分；0.7071不能解讀成事實有70.71%正確。
:::

### 重複與極短輸出（補充）

CS03參考的「客服」只出現一次，A卻輸出「客服／客服／客服」。裁切後單詞分子為1、分母為3，$p_1=1/3$；雙詞無匹配，$p_2=0/2=0$，不平滑的BLEU-2為0。

若CS01只輸出「客服」，單詞精確率為1，但BP為$e^{1-6}=e^{-5}=0.006738$。候選不足兩詞，本頁把缺少雙詞的分數約定為0，故BLEU-2仍為0。

### 第二領域的反例（補充）

教育 ED01 的 A 把「進行」改為「舉行」，事實仍正確；B把「線上」改為「實體」，事實錯誤。A的BLEU-2為0.8165，B為0.7071；同義改寫也會失去字面匹配。

## 程式（補充）

以下只用Python標準函式庫。從repo根目錄執行，或用環境變數`IPAS_REPO_ROOT`指定repo；固定讀取資料中的token，不下載模型或重新分詞。

```python
import json, math, os
from collections import Counter
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
rows = json.loads((root / "content/examples/L21103-C-generation.json").read_text(encoding="utf-8"))["examples"]
def counts(tokens, n):
    return Counter(tuple(tokens[i:i+n]) for i in range(len(tokens)-n+1))
def precision(ref, cand, n):
    r, c = counts(ref, n), counts(cand, n)
    total = sum(c.values())
    return sum((r & c).values()) / total if total else 0.0
s = next(x for x in rows if x["id"] == "CS01")
ref = s["reference"]["tokens"]
print("參考:", " / ".join(ref))
```
```text
參考: 客服 / 於 / 三日 / 內 / 回覆 / 申請
```

下一段接著計算單詞精確率、雙詞精確率、BP及BLEU-2。沒有平滑，也沒有自動縮小最大片段長度。

```python
def bleu2(ref, cand):
    if not cand:
        return 0.0, 0.0, 0.0, 0.0
    p1, p2 = (precision(ref, cand, n) for n in (1, 2))
    bp = math.exp(min(0, 1 - len(ref) / len(cand)))
    return p1, p2, bp, bp * math.sqrt(p1 * p2)
for key, item in s["candidates"].items():
    values = bleu2(ref, item["tokens"])
    print(key, *(f"{v:.6f}" for v in values))
```
```text
A 1.000000 1.000000 0.818731 0.818731
B 0.833333 0.600000 1.000000 0.707107
```

最後核對重複輸出與教育文本，資料、分詞及指標設定都不變。

```python
for sample_id in ("CS03", "ED01"):
    item = next(x for x in rows if x["id"] == sample_id)
    for key, candidate in item["candidates"].items():
        score = bleu2(item["reference"]["tokens"], candidate["tokens"])[-1]
        print(sample_id, key, f"{score:.6f}")
```
```text
CS03 A 0.000000
CS03 B 1.000000
ED01 A 0.816497
ED01 B 0.707107
```

:::tip[讀碼重點]
`Counter`的交集取次數的較小值，所以重複詞會裁切。空候選或無高階匹配時，本教學回傳0；不要把這個約定誤認成所有套件的預設行為。
:::

## 怎麼用、怎麼判讀

BLEU適合有參考文本、需要快速重複比較的翻譯或生成任務。它會漏掉同義表達，也無法保證流暢性與事實正確，仍要搭配其他評估。

### 彙整與平滑前提（補充）

語料級BLEU先把每筆的裁切匹配數、候選片段數各自加總，再算$p_n$。長度也先加總；本組單一參考的$r$就是參考總長度，不是把句級BLEU直接平均。

有多份參考時，每筆選與候選最接近的參考長度；同樣接近時取較短者，再加總。句級短文本常有高階零匹配，可用平滑方法，但需明示方法，不能混用不同設定的分數。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 機器翻譯、文本生成 | 有候選與參考文本 | 比較詞片段重疊與長度修正 |
| 客服通知（補充） | 同一來源、固定任務與分詞 | 另查時限與承諾是否正確 |
| 教育改寫（補充） | 可有多種正確說法 | 同義字可能降低匹配分數 |

## 常見誤解

- 「BLEU高表示事實正確。」它衡量字詞片段相似程度，不做事實查核。
- 「多寫幾次相同詞就會加分。」裁切匹配會限制重複片段的得分。（補充）
- 「短句分數低一定是內容錯。」高階片段少、長度與平滑設定也會影響分數。（補充）
- 「把每句BLEU平均就是語料級BLEU。」先彙整計數與先算句分數是不同運算。（補充）

## 進階

### 參考來源

- 科目1指引 `guide-1:3-66`：支持n-gram重疊、短句懲罰、翻譯用途與語意限制；已查看PDF第73頁。
- [Papineni等人BLEU原始論文](https://aclanthology.org/P02-1040.pdf) §2.1–2.3：支持裁切計數、語料彙整及BP公式。
- [NLTK BLEU文件](https://www.nltk.org/api/nltk.translate.bleu_score.html)：支持多參考長度選擇、句級平滑及邊界處理的補充。
- [Hugging Face翻譯課程](https://huggingface.co/learn/llm-course/en/chapter7/4)：參考重複與過短輸出對照的教學思路；本頁自寫語料及程式。

## 小結

- BLEU以候選的片段匹配為基礎，並修正過短輸出。
- 重複片段要裁切，不能無限重用參考次數。（補充）
- 比較前固定分詞、片段長度、參考數、平滑與尺度。（補充）
- 字面相似不等於語意、流暢性或事實都正確。
