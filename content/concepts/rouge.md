---
id: rouge
title: ROUGE 摘要評估
kind: metric
codes: [L21101, L21103, L21104]
aliases: [ROUGE-L, ROUGE-N, ROUGE-S]
summary: ROUGE 比較摘要與參考的片段及序列，檢查關鍵內容覆蓋程度
goals:
  - id: g1
    text: 分辨 ROUGE-N、ROUGE-L、ROUGE-S 的匹配單位及摘要召回用途
  - id: g2
    text: 計算 ROUGE-1 的匹配、漏失、精確率與召回率，標出 LCS 並算 F1
guide_refs: [guide-1:3-66, guide-1:3-67]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: overlap-prf
    source: https://huggingface.co/learn/llm-course/en/chapter7/5
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-C
  - id: lcs-prf
    source: https://aclanthology.org/W04-1013.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 摘要評估要比較連續兩詞、最長順序序列，以及允許中間隔詞的詞對。應依序選哪3種變體？
    options:
      A: ROUGE-L、ROUGE-S、ROUGE-2，依序比較片段、序列及詞對
      B: ROUGE-S、ROUGE-2、ROUGE-L，依序比較片段、序列及詞對
      C: ROUGE-2、ROUGE-S、ROUGE-L，依序比較片段、序列及詞對
      D: ROUGE-2、ROUGE-L、ROUGE-S，依序比較片段、序列及詞對
    answer: D
    explain:
      A: ROUGE-L看最長公共子序列，並非指定的連續兩詞。
      B: ROUGE-S看跳躍詞對，ROUGE-2看連續兩詞，前兩項配錯。
      C: 最長順序序列應配ROUGE-L，跳躍詞對應配ROUGE-S。
      D: 三者分別使用連續詞片段、最長公共子序列與跳躍詞對。
  - id: c2
    goal: g2
    type: choice
    prompt: 參考6個固定詞，候選5個詞全部匹配，沒有其他重複。ROUGE-1的精確率、召回率及F1約為多少？
    options:
      A: 精確率1.0000、召回率0.8333、F1為0.9091
      B: 精確率0.8333、召回率1.0000、F1為0.9091
      C: 精確率1.0000、召回率1.0000、F1為1.0000
      D: 精確率0.8333、召回率0.8333、F1為0.8333
    answer: A
    explain:
      A: 精確率五除以五，召回率五除以六，調和平均為十除以十一。
      B: 候選與參考的分母對調了。
      C: 參考仍有一詞未覆蓋，召回率不能是滿分。
      D: 候選只有五詞且全匹配，精確率應為一。
  - id: c3
    goal: g2
    type: choice
    prompt: 參考「甲 乙 丙 丁」，候選「丁 甲 乙 丙」，每詞只出現1次。哪個LCS判讀正確？
    options:
      A: 長度4，因為四個詞都出現，不需要考慮先後順序
      B: 長度1，因為移動一個詞後，其餘連續片段都失效
      C: 長度3，可取甲乙丙，保留先後且允許跳詞
      D: 長度0，因為兩句的首詞不同，無法構成任何子序列
    answer: C
    explain:
      A: LCS需要維持順序，不能把移到前面的丁算在甲乙丙之後。
      B: 甲乙丙仍按相同順序出現，可以形成三詞子序列。
      C: 甲乙丙是可對應的最長順序序列，長度為三。
      D: 首詞不同不會阻止後面的詞形成公共子序列。
---

## 為什麼需要

摘要寫得短，不代表保留了重要資訊。ROUGE強調候選對參考內容的覆蓋，適合輔助比較自動摘要、內容生成與問答結果。

它是一組指標，不是單一分數。使用時應說明比較的片段或序列，以及回報的是召回率、精確率還是F1分數。

## 直覺

BLEU偏向問「候選寫出的片段有多少匹配」，ROUGE的召回方向則問「參考中的內容找回多少」。分母一換，問題也跟著改變。

ROUGE-N比較n-gram，ROUGE-L看最長公共子序列（Longest Common Subsequence，LCS），ROUGE-S看跳躍詞對（Skip-bigram）。

![沿連線保持由左到右的順序；申請移到句首後，無法再接在回覆後面。](figure:l21103-rouge-lcs)

:::supplement[來源：Lin（2004）§2–3]
LCS可以跳過詞，但不能把詞序倒轉。圖中的單詞都存在，仍只有五詞能組成一條保持先後的最長配對路徑。
:::

## 定義與公式

ROUGE的核心是比較候選摘要與參考摘要的重疊。指引列出三種常見變體：

| 變體 | 匹配單位 |
|---|---|
| ROUGE-N | 連續$n$詞片段 |
| ROUGE-L | 最長公共子序列 |
| ROUGE-S | 跳躍詞對 |

### 三種單位的小例子（補充）

CS04的參考為「客服／於／兩日／內／回覆／申請」。ROUGE-2的片段如「客服／於」，必須相鄰；ROUGE-S的詞對如「客服／回覆」，中間可隔詞，但要保留先後。

若候選將「申請」移到句首，「客服／申請」的順序就不再匹配。ROUGE-S還可設定最大跳躍距離，報告時應註明限制；它不是把任意兩個詞無序配對。

### ROUGE-1與F1（補充）

先數單詞的重疊次數，每種詞的匹配以兩邊次數的較小者為限。令匹配總數為$M$、參考詞數為$r$、候選詞數為$c$：

$$
P=\frac{M}{c},\qquad R=\frac{M}{r},\qquad F_1=\frac{2PR}{P+R}=\frac{2M}{r+c}
$$

$P$是候選的精確率，$R$是參考的召回率，$F_1$是兩者的調和平均。這裡只處理單一參考、固定詞單位，沒有詞幹化或語意匹配。

參考必須非空；空參考不能用來評估內容召回。候選為空時，本教學約定$P=R=F_1=0$；兩邊無匹配時也回傳0，避免$0/0$。

### 句級ROUGE-L（補充）

把單詞重疊數$M$換成LCS長度$L$，可得句級的精確率、召回率及本頁採用的等權F1：

$$
P_L=\frac{L}{c},\qquad R_L=\frac{L}{r},\qquad F_{1,L}=\frac{2L}{r+c}
$$

其中$r,c$仍是參考與候選長度。本頁採等權F1；原始ROUGE-L可調整精確率與召回率的權重，且多句摘要另有彙整方式，不能直接套用本頁句級設定。

## 算一次

:::supplement[來源：Hugging Face 摘要課程；本組教學合成資料]

沿用 `L21103-C-generation.json` 的 CS01，與BLEU頁比較同一候選。參考有6詞；A保留前5詞，B有6詞但把三日改為一日。

| ROUGE-1項目 | 候選 A | 候選 B |
|---|---|---|
| 匹配、漏失 | 5、1個參考詞未匹配 | 5、1個參考詞未匹配 |
| 精確率$P$ | $5/5=1$ | $5/6=0.8333$ |
| 召回率$R$ | $5/6=0.8333$ | $5/6=0.8333$ |
| F1 | $10/11=0.9091$ | $10/12=0.8333$ |

A漏的是「申請」，B漏掉「三日」並寫成錯誤的「一日」。兩者召回率相同，業務影響卻不同；匹配數不會替每種事實的重要性加權。
:::

### LCS標註（補充）

CS04的參考是「**客服／於／兩日／內／回覆**／申請」，A是「申請／**客服／於／兩日／內／回覆**」。粗體五詞保持相同順序，為一條LCS。

兩邊各6詞，全部單詞都重疊，因此ROUGE-1的$P,R,F_1$都是1。LCS卻只有5詞，故$P_L=R_L=5/6$、$F_{1,L}=10/12=0.8333$；這能看見詞序改變。

### 第二領域的對照（補充）

ED01的A以「舉行」替換「進行」，B以「實體」替換「線上」。兩邊都是6詞、匹配5詞，因此兩者ROUGE-1的$P,R,F_1$都是0.8333；只有B改錯事實。

## 程式（補充）

以下只讀固定token，分別核對單詞重疊與LCS。從repo根目錄執行，或設定`IPAS_REPO_ROOT`；本頁不使用多句摘要的`rougeLsum`。

```python
import json, os
from collections import Counter
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
rows = json.loads((root / "content/examples/L21103-C-generation.json").read_text(encoding="utf-8"))["examples"]
def prf(matched, ref_count, cand_count):
    if ref_count <= 0: raise ValueError("參考不可為空")
    p = matched / cand_count if cand_count else 0.0
    return p, matched / ref_count, 2 * matched / (ref_count + cand_count)
s = next(x for x in rows if x["id"] == "CS01")
ref = s["reference"]["tokens"]
for key, item in s["candidates"].items():
    cand = item["tokens"]
    matched = sum((Counter(ref) & Counter(cand)).values())
    print(key, matched, *(f"{v:.6f}" for v in prf(matched, len(ref), len(cand))))
```
```text
A 5 1.000000 0.833333 0.909091
B 5 0.833333 0.833333 0.833333
```

下一段逐格計算最長序列。詞相同時接上左上格；不同時保留上方或左方較長的結果，代表跳過其中一詞。

```python
def lcs(x, y):
    dp = [[0] * (len(y) + 1) for _ in range(len(x) + 1)]
    for i, a in enumerate(x, 1):
        for j, b in enumerate(y, 1):
            dp[i][j] = dp[i-1][j-1] + 1 if a == b else max(dp[i-1][j], dp[i][j-1])
    return dp[-1][-1]
s = next(x for x in rows if x["id"] == "CS04")
ref, cand = s["reference"]["tokens"], s["candidates"]["A"]["tokens"]
length = lcs(ref, cand)
print("LCS:", length)
print("P R F1:", *(f"{v:.6f}" for v in prf(length, len(ref), len(cand))))
```
```text
LCS: 5
P R F1: 0.833333 0.833333 0.833333
```

最後用教育文本核對：相同匹配數不代表相同事實品質。

```python
s = next(x for x in rows if x["id"] == "ED01")
ref = s["reference"]["tokens"]
for key, item in s["candidates"].items():
    cand = item["tokens"]
    matched = sum((Counter(ref) & Counter(cand)).values())
    print("ED01", key, *(f"{v:.6f}" for v in prf(matched, len(ref), len(cand))))
```
```text
ED01 A 0.833333 0.833333 0.833333
ED01 B 0.833333 0.833333 0.833333
```

:::tip[讀碼重點]
召回率分母來自參考，精確率分母來自候選。LCS程式算的是可跳詞的子序列，不是要求連續的最長共同子字串。
:::

## 怎麼用、怎麼判讀

ROUGE適合快速檢查摘要或問答是否覆蓋參考資訊，但無法單靠分數判定創新性或事實正確。要改善哪種內容，應回頭看漏掉的詞所代表的主張。

### 固定比較設定（補充）

至少記錄分詞、變體、回報的P／R／F1、是否詞幹化、句子邊界及參考數。本組逐筆計算後等權平均，沒有把所有文本串成一句；也不把ROUGE的平均方式套到BLEU。

只看召回率可能偏好冗長輸出，應一起看精確率或F1。單一參考漏寫的正確資訊也可能被視為未匹配，因此還要看來源與人工評估。

### 換個場景

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 自動摘要、問答 | 有參考內容要保留 | 看關鍵資訊覆蓋及匹配單位 |
| 客服摘要（補充） | 時限與條件不可漏 | 不能只平均詞數而忽略重要性 |
| 教育改寫（補充） | 正確同義說法很多 | 低匹配未必代表教錯內容 |

## 常見誤解

- 「ROUGE就是一個分數。」需先指明N、L、S等變體與回報方式。
- 「ROUGE高就代表摘要有創意。」覆蓋程度不能衡量創新性。
- 「ROUGE-L要求每個詞都相鄰。」LCS允許跳過詞，但要保留先後。（補充）
- 「高召回表示所有重要事實都正確。」相同漏詞數可能有不同影響，仍需查核。（補充）

## 進階

### 教學版本的界線（補充）

這裡示範單一參考、句級LCS與等權F1。不同套件的多參考合併、句子切分與摘要級LCS可能不同；重現研究時應使用相同實作與版本。

### 參考來源

- 科目1指引 `guide-1:3-66`、`guide-1:3-67`：支持摘要召回、三類變體與用途；已查看PDF第73頁並對照第74頁文字。
- [Lin的ROUGE原始論文](https://aclanthology.org/W04-1013.pdf) §2–3、§5：支持ROUGE-N、句級LCS及跳躍詞對的補充。
- [Hugging Face摘要課程](https://huggingface.co/learn/llm-course/en/chapter7/5)：支持精確率、召回率及F1公式；參考手算對照教法，LCS定義以原始論文為準。

## 小結

- ROUGE重點是參考資訊的覆蓋，適合摘要與問答評估。
- N看連續片段，L看最長公共子序列，S看跳躍詞對。
- 計算時分清候選與參考的分母。（補充）
- 字面覆蓋相同，關鍵事實仍可能一對一錯。（補充）
