---
id: speech-quality-metrics
title: 語音品質、WER 與延遲
kind: metric
codes:
  - L21103
  - L21104
aliases:
  - MOS
  - WER
  - Word Error Rate
  - 語音延遲
summary: 語音評估分別檢查聽感、轉寫錯誤及等待時間，三者不能互相取代
goals:
  - id: g1
    text: 依自然度、轉寫錯誤與即時性選指標，明確指定量測對象與起訖
  - id: g2
    text: 計算 MOS、WER 及延遲，說明空參考與錯誤率超過百分之百的限制
requires:
  - text-to-speech
guide_refs:
  - guide-1:3-70
formula_groups:
  - id: wer
    source: https://huggingface.co/spaces/evaluate-metric/wer/blob/main/README.md
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-F
  - id: mos
    source: https://www.itu.int/rec/T-REC-P.800.1-201607-I/en
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L21103-F
  - id: latency
    source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-lower-speech-synthesis-latency
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21103-F
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服旁白的模擬 MOS 為 4.2，但回覆把 300 元讀成 3000 元。哪個判讀最合理？
    options:
      A: 高自然度可抵銷金額錯誤，品質門檻通過即可發布
      B: 高自然度等於來源真實，內容錯誤可由使用者修正
      C: 自然度與內容各自檢查，金額錯誤仍須修正再驗收
      D: 自然度高代表辨識無誤，只需把延遲再縮短便可用
    answer: C
    explain:
      A: 聽感分數不能抵銷關鍵業務內容錯誤。
      B: 自然度評分不檢驗來源或事實真偽。
      C: MOS 回答指定的聽感問題，內容是否正確仍須另行檢查。
      D: 自然度無法保證辨詞或事實正確，延遲也不能修正金額。
  - id: c2
    goal: g2
    type: choice
    prompt: 參考有 10 詞，最少編輯對齊得到 S=1、D=1、I=1；五個模擬評分是 4、4、5、3、4。結果是？
    options:
      A: WER 為 3%，MOS 為 4.0 分，錯誤數先除以百分之一
      B: WER 為 30%，MOS 為 3.0 分，採五個評分中的最低值
      C: WER 為 20%，MOS 為 4.0 分，插入詞不列入錯誤數
      D: WER 為 30%，MOS 為 4.0 分，分別按參考詞數及人數平均
    answer: D
    explain:
      A: 三次錯誤除以十個參考詞是 0.3，換成百分比是 30%。
      B: MOS 是平均分，總分二十分除以五人是四分，不取最低值。
      C: 插入同樣計入 WER，不能只計替換和刪除。
      D: WER 的分母為十個參考詞；MOS 的分母為五個評分。
  - id: c3
    goal: g2
    type: choice
    prompt: 兩批轉寫：甲的參考為空；乙的參考只有「好」，輸出為「好 謝謝 您」。使用一般 WER 手算式應如何處理？
    options:
      A: 甲設成 0%，乙設成 100%；超出上限部分全部捨去
      B: 甲不定義並另記規則，乙有兩次插入所以為 200%
      C: 甲設成 100%，乙只留正確詞所以錯誤率為 0%
      D: 甲乙都改除以輸出詞數，便可直接沿用同一個 WER
    answer: B
    explain:
      A: 空參考不能直接除，WER 也沒有百分之百的上限。
      B: 甲的分母為零，需另訂空參考政策；乙的兩次插入除以一詞是兩倍。
      C: 甲不能任意指派一般公式的數值；乙仍須計入額外的詞。
      D: 改用輸出詞數會改變指標定義，不能冒充同一種 WER。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

語音聽起來自然，可能仍讀錯時間；每個詞都對，也可能讓使用者等太久。指引把平均意見分數、詞錯誤率與生成延遲並列，就是要分開看三種問題。

本頁用教學文字及數字核算，沒有音檔與真人評分。範例中的 MOS 只能示範平均算法，不能當成任何模型的聽感成績。

## 直覺

平均意見分數（Mean Opinion Score，MOS）問人「聽感如何」；詞錯誤率（Word Error Rate，WER）比較參考文字與轉寫；延遲則問等了多久。

:::supplement[來源：Hugging Face WER 指標文件；Hugging Face TTS 評估課程]
WER 常用於自動語音辨識（ASR）。若先用 ASR 轉寫合成聲音，測到的是「TTS → ASR」整條鏈，錯誤不一定全由 TTS 造成。

自然度與可懂度仍要分開測；ASR 正好轉寫正確，也不保證真人在噪音中聽得清楚。
:::

## 定義與公式

| 指標 | 指引中的用途 | 方向 | 需要的證據 |
|---|---|---|---|
| MOS | 人工評估自然度，1–5 分 | 通常越高越好 | 實際聽評與題目 |
| WER | 語音內容的錯誤程度 | 越低越好 | 參考文字與轉寫 |
| 生成延遲 | 文字輸入到語音輸出的時間 | 依即時性需求判斷 | 起訖時間與單位 |

### WER 的分母與對象

:::supplement[來源：Hugging Face WER 指標文件；Hugging Face ASR 評估課程]

$$
\mathrm{WER}=\frac{S+D+I}{N}
$$

$S$ 是替換詞數、$D$ 是刪除詞數、$I$ 是插入詞數；$N$ 是參考文字的詞數，須大於零。先以最少編輯次數對齊，再計數，不能逐位置硬比。

E01 的 $S=1,D=1,I=1,N=10$，所以 $\mathrm{WER}=3/10=30\%$。中文先固定斷詞、標點與數字格式；改用字元計數就是字錯誤率，不能混稱 WER。

空參考時此式未定義，工具若另訂規則必須揭露。參考只有「好」，輸出「好 謝謝 您」，兩次插入除以一詞就是 200%；WER 不受 100% 上限限制。
:::

### MOS 的平均

指引以 1–5 分的人工自然度評分取平均。這能整理指定聽評問題的回答，但仍須交代評分方式。

:::supplement[來源：ITU-T P.800.1（07/2016）第 7.1.1 節；Hugging Face TTS 評估課程]

$$
\mathrm{MOS}=\frac{1}{K}\sum_{k=1}^{K}r_k
$$

$K$ 是有效評分數，必須大於零；$r_k$ 是第 $k$ 個評分者依同一問題給的 1–5 分。E01 五個模擬評分為 4、4、5、3、4，所以 $\mathrm{MOS}=20/5=4.0$。

| 分數 | 本例自然度問卷的文字錨點 |
|---|---|
| 1 | 很不自然 |
| 2 | 不太自然 |
| 3 | 普通 |
| 4 | 自然 |
| 5 | 很自然 |

這是本例問卷錨點，不宣稱為標準認證測試。正式比較須保留相同問題、聽音設備、音量及評分者條件，並報告樣本數與分數分布；MOS 不驗證事實、來源或授權。
:::

### 延遲的量測端點

:::supplement[來源：Microsoft Speech SDK 延遲文件；共用教學資料 L21103-F-speech.json]

$$
L_{\mathrm{first}}=t_{\mathrm{first}}-t_0,\qquad
L_{\mathrm{complete}}=t_{\mathrm{complete}}-t_0
$$

$t_0$：送出請求；$t_{\mathrm{first}}$：收到首段可播放音訊；$t_{\mathrm{complete}}$：收到完整音訊。使用同一用戶端時鐘，單位毫秒（ms）。

E01 時刻依序是 1000、1260、2200 ms；首段 $1260-1000=260$ ms，完成 $2200-1000=1200$ ms。

首位元組抵達不一定已可播放，報告須寫清楚端點。
:::

![先對齊替換、刪除、插入，再看延遲量的是首段音訊或完整音訊](figure:l21103-speech-quality-metrics-alignment)

本圖是評估鏈與端點示意；圖中範例沿用 E01，未繪製或測量聲音。

## 算一次

三種指標各有用途，先對照轉寫、評分及生成時間，再分別計算。下面沿用相同資料，檢查教材與客服的差異。

### 用相同規則比較兩個領域

:::supplement[來源：共用教學資料 L21103-F-speech.json；Hugging Face WER 指標文件；ITU-T P.800.1 第 7.1.1 節；Microsoft Speech SDK 延遲文件]

E01 的參考中「九點」被轉成「十點」，「堂」遺失，最後多出「謝謝」。最少編輯對齊得到三次錯誤，並非兩段文字長度相同就沒有錯。

| 紀錄 | WER 核算 | MOS 核算 | 首段／完成延遲 |
|---|---|---|---|
| 教材 E01 | (1+1+1)/10=30% | (4+4+5+3+4)/5=4.0 | 260／1200 ms |
| 客服 C01 | (2+0+0)/10=20% | (3+4+4+4+5)/5=4.0 | 180／800 ms |

客服的兩個替換是「三點」變成「四點」、「訂單」變成「帳單」。MOS 相同不會消除這些錯誤；WER 較低也不能證明業務風險較小，要另外看錯在哪些詞。

若彙總多段 WER，先加總各段錯誤數再除以總參考詞數。不同長度句子的 WER 直接平均會得到另一種加權方式，必須說清楚。

本組 20 段合計 12 次錯誤、102 個參考詞，因此合併 WER 為 $12/102\approx11.76\%$。逐句等權平均則為 10.5%；兩者的權重不同。
:::

## 程式（補充）

以下直接代入共用 JSON 中 E01、C01 的對齊計數、評分與時間戳。不下載模型、不合成聲音；本組核算報告另驗證這些數字與原資料一致。

```python
def wer(s, d, i, n):
    return None if n == 0 else (s + d + i) / n
rows = [("E01", 1, 1, 1, 10, [4, 4, 5, 3, 4], 1000, 1260, 2200),
        ("C01", 2, 0, 0, 10, [3, 4, 4, 4, 5], 2000, 2180, 2800)]
for name, s, d, i, n, scores, start, first, complete in rows:
    error = wer(s, d, i, n)
    mos = sum(scores) / len(scores)
    print(f'{name}: WER={error:.0%}, MOS={mos:.1f}, 首段={first-start} ms, 完成={complete-start} ms')
print("空參考:", wer(0, 0, 1, 0))
print(f"插入過多: {wer(0, 0, 2, 1):.0%}")
```
```text
E01: WER=30%, MOS=4.0, 首段=260 ms, 完成=1200 ms
C01: WER=20%, MOS=4.0, 首段=180 ms, 完成=800 ms
空參考: None
插入過多: 200%
```

:::tip[讀碼重點]
- 分母來自參考詞數 N；空參考回傳 None，表示本式未定義。
- MOS 的五個值及時間戳都是模擬值，輸出不能當成模型排名。
:::

## 怎麼用、怎麼判讀

先寫要回答的問題，再選證據。教材主要問自然度與內容，客服還要問回應是否及時；一個合成流程可以同時需要三種指標。

:::supplement[來源：Hugging Face WER 指標文件；Hugging Face TTS 評估課程；Microsoft Speech SDK 延遲文件]
比較時固定參考文字、ASR 版本、斷詞規則與量測端點。自然度評分只支持聽感，WER 只支持該轉寫鏈的詞級錯誤，延遲只支持指定端點的等待時間。

語音對話還有收音、辨識、理解與回覆生成等時間。TTS 請求至音訊的延遲，不能直接當作從使用者說完到系統回話的總延遲。
:::

### 換個場景

| 場景 | 指引對應需求 | 判讀重點 |
|---|---|---|
| 教材、有聲書 | 長段語音自然度 | MOS 與內容分開檢查 |
| 語音客服、家居回饋 | 即時互動 | 生成延遲與回應內容 |
| 多語言、方言 | 不同語言品質一致 | 各語種分組評估 |
| 工廠警報（補充） | 噪音下辨明指令 | 不能只看安靜環境 MOS |
| 醫療口述（補充） | 藥名及劑量轉寫 | 逐項核對關鍵詞錯誤 |

## 常見誤解

- 「MOS 高就代表聲音的事實正確。」自然度與真偽不同。（補充）
- 「WER 是 TTS 自然度。」它需要參考與轉寫，回答的是另一個問題。（補充）
- 「WER 最多 100%。」插入次數可以超過參考詞數。（補充）
- 「收到第一段音訊，就表示全句生成完了。」串流與完成端點不同。（補充）

## 進階

### 參考來源

- 科目 1 指引 3.3（版本未標示），guide-1:3-70：支持 MOS、WER 與生成延遲的用途及語音應用場景；公式與邊界為補充。
- [Hugging Face WER 指標文件](https://huggingface.co/spaces/evaluate-metric/wer/blob/main/README.md)：支持 WER 的定義、分母與超過 100% 的情況。
- [Hugging Face ASR 評估課程](https://huggingface.co/learn/audio-course/en/chapter5/evaluation)：參考詞級編輯及文字正規化的講法，支持對齊、斷詞與比較條件。
- [Hugging Face TTS 評估課程](https://huggingface.co/learn/audio-course/en/chapter6/evaluation)：支持主觀聽評、MOS 與一對多輸出限制。
- [ITU-T P.800.1（07/2016）](https://www.itu.int/rec/T-REC-P.800.1-201607-I/en)第 7.1.1 節（印刷頁 5／PDF 第 11 頁）：MOS-LQS 採五點主觀評分的算術平均，支持平均公式。
- [Microsoft Speech SDK 延遲文件](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-lower-speech-synthesis-latency)：支持區分首段／完成及用戶端／服務端端點；本例可播放端點為教學約定。
- 共用例子：`content/examples/L21103-F-speech.json`，支持全部模擬算例與程式。

## 小結

- MOS 看自然度，WER 看轉寫錯誤，延遲看等待時間。
- WER 使用參考詞數；空參考另記政策，插入過多可超過 100%。（補充）
- MOS 不證明內容正確、來源真實或已獲授權。（補充）
- 延遲先寫起訖、單位及是否包含網路，再比較。（補充）
