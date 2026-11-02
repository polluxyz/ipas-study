---
id: fasttext
title: FastText 子詞詞向量
kind: model
codes: [L21101]
aliases: []
summary: FastText 重用子詞的向量，替整詞與未登錄詞組合表示。
goals:
  - id: g1
    text: 列出完整子詞並組合向量，說明未登錄詞的可用條件與限制
requires: [word2vec, n-gram]
guide_refs: [guide-1:3-21, guide-1:3-22]
formula_groups:
  - id: subword-composition
    source: guide-1:3-22
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21101-C
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 把未登錄地名「霧嶼坪」加上首尾記號，成為 <霧嶼坪>，固定字元 n=3。完整子詞清單為何？
    options:
      A: '<霧嶼、霧嶼坪、嶼坪>，共 3 段'
      B: '<霧、霧嶼、嶼坪、坪>，共 4 段'
      C: '<霧嶼、嶼坪>，共 2 段'
      D: '霧、嶼、坪，合為 3 段'
    answer: A
    explain:
      A: 在五個字元上逐格移動三字元視窗，正好得到三段。
      B: 這些是長度二的子詞，與指定的 n=3 不符。
      C: 漏掉中間的霧嶼坪，並非完整的重疊切片。
      D: 這是單字元切分，既忽略邊界也不符合長度三。
  - id: c2
    goal: g1
    type: choice
    prompt: 上述 3 段的已學向量依序為 (1,0)、(0,2)、(2,1)，沒有整詞專屬向量。採子詞平均時，結果為何？
    options:
      A: (3,3)，把三段相加後直接取出
      B: (1,0)，只保留開頭子詞的向量
      C: (1,1)，把三段相加後除以段數
      D: (0,2)，只保留中間子詞的向量
    answer: C
    explain:
      A: 這是加總表示，尚未依題意除以三。
      B: 平均要納入三段，不能只取開頭。
      C: 兩維加總各為三，再各除以三得到一。
      D: 中間子詞只是三個輸入之一，不是平均結果。
  - id: c3
    goal: g1
    type: choice
    prompt: 客服遇到 1 個新地名，子詞可重用；同時有 2 句 bank 分別指銀行與河岸。使用標準靜態 FastText 查詞向量，哪個判斷恰當？
    options:
      A: 新地名只要能組出非零向量，就可保證辨認地點
      B: 新地名可組合子詞向量，bank 仍需另做語境處理
      C: bank 的字元相同，FastText 就會依句子換詞義
      D: 新地名只要不在整詞詞表，就完全無法產生表示
    answer: B
    explain:
      A: 可組合數值不保證已掌握新地名的真實語意。
      B: 子詞處理詞內結構，標準靜態查表不會依當次句子變換詞義。
      C: 子詞相同時仍組合相同表示，沒有加入當次上下文。
      D: 未登錄整詞仍可利用有用的子詞表示，不必有整詞專屬列。
---

## 為什麼需要

純整詞查表遇到未登錄詞（Out-of-Vocabulary，OOV），可能沒有可取用的專屬向量。少見地名與新造詞尤其容易遇到這個問題。

FastText 把詞拆成子詞（字元片段），讓不同詞共享子詞向量。即使整詞沒見過，也可能利用已學子詞組合出表示。

## 直覺

共用例子在銀行分行查詢與河川測量中，都出現虛構地名「霧嶼坪」。先把它當成一個詞，再觀察詞內字元；這與把整句切成詞是不同層次。

![視窗每次右移一字元，相鄰子詞重疊兩字元；首尾記號也參與切片，三段共同形成詞向量。](figure:l21101-fasttext-subwords)

子詞在這裡指字元 n-gram，不要求每段都有獨立意思。圖中「嶼坪」附近的字元可重用，不代表模型真的認得這個地名。

## 定義與公式

FastText 在詞向量學習中加入字元 n-gram。指引列出常用長度 3～6，並以子詞向量的加總或平均表示整詞。

對未登錄整詞，本頁明定只用子詞向量：

$$
v_{\mathrm{sum}}(w)=\sum_{g\in G(w)}z_g,\qquad
v_{\mathrm{avg}}(w)=\frac{1}{|G(w)|}\sum_{g\in G(w)}z_g
$$

$w$ 是詞，$G(w)$ 是本次列出的子詞清單，$z_g$ 是子詞 $g$ 的同維向量；$|G(w)|$ 是子詞數。平均要求至少有一段，不能除以零。

:::supplement[來源：Bojanowski 等人第 3.2 節；fastText Word representations]
原模型在詞首尾加入 `<`、`>`，並為已登錄整詞保留專屬表示；未登錄整詞沒有這一項。完整工具還會以雜湊桶儲存子詞，不能把本頁的小字典當成完整實作。

有用的子詞必須從訓練得到足夠訊號。桶內有數字、或能算出非零向量，不等於這個子詞的語意可靠。
:::

## 算一次

本組固定 n=3，在 `<霧嶼坪>` 上逐字滑動。完整結果是 `<霧嶼`、`霧嶼坪`、`嶼坪>`；首尾記號各算一個字元。

| 子詞 | 教學向量 | 來源位置 |
|---|---|---|
| `<霧嶼` | (1,0) | 開頭三字元 |
| `霧嶼坪` | (0,2) | 中間三字元 |
| `嶼坪>` | (2,1) | 結尾三字元 |

加總為 $(1+0+2,0+2+1)=(3,3)$；平均為 $(3/3,3/3)=(1,1)$。這些座標由人設定，只驗證組合機制，不宣稱是學到的地理語意。

:::supplement[來源：fastText Word representations；Bojanowski 等人第 3.2 節]
工具常用 n=3～6，會納入較長子詞；本例固定 n=3，只為看清每一步。已登錄詞另有整詞專屬向量，本例的未登錄地名沒有這一項，也不做雜湊。
:::

## 程式（補充）

程式從共用 JSON 讀取固定資料，只切片與組合，不下載權重。沒有隨機步驟；實測前用 `IPAS_REPO_ROOT` 指向 repo。

```python
import json, os
from pathlib import Path
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
d = json.loads((root / "content/examples/L21101-C-context.json").read_text(encoding="utf-8"))
s = d["subword_demo"]
marked = s["boundary_start"] + s["word"] + s["boundary_end"]
n = s["n"]
parts = [marked[i:i+n] for i in range(len(marked)-n+1)]
vectors = [s["fragment_vectors"][g] for g in parts]
total = [sum(col) for col in zip(*vectors)]
print("子詞:", parts)
print("加總:", total)
print("平均:", [x / len(parts) for x in total])
```
```text
子詞: ['<霧嶼', '霧嶼坪', '嶼坪>']
加總: [3, 3]
平均: [1.0, 1.0]
```

:::tip[讀碼重點]
迴圈逐格移動，子詞彼此重疊。字典缺子詞就會報錯，避免拿未學到的隨機向量假裝有語意。
:::

## 怎麼用、怎麼判讀

指引把新詞處理列為 FastText 的優勢，並以長詞中的共享子詞說明泛化。新詞若與已學詞共享有用子詞，就有機會取得比單一未知詞記號更好的表示。

但 FastText 的標準詞向量仍是靜態表示。同一模型的 bank 在銀行句與河川句中，子詞不變，組出的詞向量也相同；多義詞要另用語境型詞嵌入等方法。

### 換個場景

| 場景 | 適用條件 | 判讀重點 |
|---|---|---|
| 未見長詞、衍生詞 | 與已學子詞重疊 | 指引列出的新詞泛化用途 |
| 銀行新分行地名（補充） | 整詞未登錄、子詞有訊號 | 能組向量仍未必辨認實體 |
| 河川教育地名（補充） | 與客服使用相同字元規則 | 換領域仍須驗證語意 |
| 製造新零件編號（補充） | 編號子詞反覆出現 | 相似編號未必代表相同功能 |

## 常見誤解

- 「子詞一定是詞根或詞綴。」字元切片可能跨過語素邊界，沒有獨立意思。
- 「能處理新詞，就能分辨多義詞。」詞內子詞與句子語境處理的是不同問題。
- 「OOV 一定有可靠語意。」缺乏子詞訓練訊號時，組合品質仍可能差。（補充）

## 進階

### 指引例子的界線

指引 3-22 的 playing 例未加首尾記號，但五個三字元子詞都已列出。unhappiness 例則不能當完整清單：若固定 n=3 並加上 `<`、`>`，還要列出 `nha`、`ss>`。

同頁的 nationalization 例以 nation、-al、-ization 說明詞內意義，較接近語素拆解；去掉詞綴記號後，ization 也有七字元，超出該頁常用長度 3～6。

:::supplement[來源：Bojanowski 等人第 3.2 節；Dive into Deep Learning 14.6]
FastText 依指定字元長度取子詞，不必對齊詞根或詞綴。語素拆解可幫助建立直覺，卻不能取代完整的滑動視窗規則；BPE 的切詞合併規則也不同。
:::

### 參考來源

- 科目 1 學習指引 `guide-1:3-21`、`guide-1:3-22`：支持子詞表示、新詞條件、加總與平均；已回看 PDF 第 29 頁。
- [Bojanowski 等人原論文第 3.2 節](https://aclanthology.org/Q17-1010.pdf)：支持邊界記號、整詞項與字元切片的校正。
- [fastText 官方 Word representations](https://fasttext.cc/docs/en/unsupervised-tutorial.html)：支持未登錄詞、子詞資訊與取向量規則的限制。
- [Dive into Deep Learning 14.6](https://classic.d2l.ai/chapter_natural-language-processing-pretraining/subword-embedding.html)：支持子詞共享與 BPE 區別的教學安排；程式為本頁自製示意。

## 小結

- FastText 以重疊子詞共享詞內資訊。
- 完整清單要先固定邊界記號與 n 值。
- 能組出未登錄詞表示，不保證已掌握新詞語意。
- 標準靜態詞向量不會隨當次句子切換詞義。
