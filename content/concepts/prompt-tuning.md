---
id: prompt-tuning
title: 軟提示微調
kind: technique
codes: [L21101, L21103, L23304]
aliases: [Prompt Tuning, Soft Prompt, soft-prompt-tuning, 提示微調, 軟提示]
summary: 凍結語言模型，透過訓練調整加在輸入端的連續提示向量
goals:
  - id: g1
    text: 區分文字提示、可學習軟提示及模型權重微調的更新位置
  - id: g2
    text: 計算提示向量預算，說明訓練資料與推論介面的條件
requires: [pretraining-fine-tuning]
guide_refs: [guide-1:3-61, guide-1:3-72]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: prompt-budget
    source: https://arxiv.org/html/2104.08691v2
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊有 12 筆客服訓練示範，要凍結模型與詞嵌入，只學輸入端 4 個六維向量。哪項判斷正確？
    options:
      A: 屬於文字少樣本提示，四個向量不必透過損失更新
      B: 屬於完整模型微調，凍結的詞嵌入仍會被優化器更新
      C: 屬於 LoRA 微調，四個向量就是基底權重的低秩分解
      D: 屬於軟提示微調，四個向量會透過訓練損失更新
    answer: D
    explain:
      A: 題目描述可學連續向量及訓練，不是只加入文字示範。
      B: 凍結詞嵌入與基底的設定沒有要更新完整模型。
      C: LoRA 改權重旁的低秩矩陣，輸入軟提示的位置不同。
      D: Prompt Tuning 透過反向傳播學輸入提示，保留基底權重。
  - id: c2
    goal: g2
    type: choice
    prompt: 輸入端軟提示有 4 個位置，每個 6 維，以 float32 存權重；下列哪項預算與限制正確？
    options:
      A: 提示有 24 個值、權重占 96 bytes，推論仍須載入基底模型
      B: 提示有 10 個值、權重占 40 bytes，推論仍須載入基底模型
      C: 提示有 24 個值、權重占 96 bytes，全部推論記憶體只有此量
      D: 提示有 48 個值、權重占 192 bytes，所有文字介面都能直接輸入
    answer: A
    explain:
      A: 位置乘維度是二十四，每值四 bytes；提示小不會取代基底。
      B: 位置與維度要相乘，不能相加。
      C: 尚有基底、啟用值與生成快取等需求，不能只算提示。
      D: 這把提示量多算一倍，且純文字介面未必能注入連續向量。
---

## 為什麼需要

指引將提示與微調列為生成模型的應用策略，但沒有展開軟提示的訓練機制。

:::supplement[來源：Lester 等，The Power of Scale for Parameter-Efficient Prompt Tuning]
若許多任務共用同一個模型，替每個任務存一整份權重可能很昂貴。軟提示微調（Prompt Tuning）改存一小組任務向量，讓凍結的模型依向量調整輸出。
:::

## 直覺（補充）

文字提示由人寫可讀的指令；軟提示是一串可學習數值，不一定能翻回有意義的句子。訓練時，損失經過固定模型回傳到提示向量，更新位置在輸入端。

![比較三列更新位置：文字提示沒有訓練，軟提示更新輸入向量，權重微調更新模型內部。](figure:l21103-prompt-tuning-positions)

## 定義與公式（補充）

本頁採輸入端 Prompt Tuning：把提示向量接在文字嵌入前面，凍結基底與原詞嵌入。它不等同於在每層注意力加入可學前綴的 Prefix Tuning。

$$
P\in\mathbb{R}^{p\times d},\qquad
N_P=pd,\qquad S_P=bpd
$$

$P$ 是軟提示矩陣；$p$ 是提示位置數；$d$ 是詞嵌入維度。$N_P$ 是可訓練值個數；$b$ 是每值的 bytes；$S_P$ 只計提示權重的儲存量。

| 做法 | 訓練資料與更新 | 推論條件 |
|---|---|---|
| 文字提示 | 可用文字示例；不更新參數 | 送入文字及示例 |
| 軟提示 | 用任務資料；更新 P | 載入 P、匹配的基底與向量介面 |
| 權重微調 | 用任務資料；更新指定權重 | 載入對應微調權重或模組 |

## 算一次（補充）

嵌入維度取共用例子的 6，選 4 個提示位置，共 $4\times6=24$ 個值。float32 每值 4 bytes，提示權重為 $24\times4=96$ bytes。

1. 使用客服 S01–S12 的輸入與理想答，凍結模型及原詞嵌入。
2. 將 4×6 的 P 接到每筆文字嵌入前；同一客服任務共享這份 P。
3. 以理想答計算損失，只更新 P；用 S13–S16 挑設定。
4. 推論時仍載入基底與 P，不能只把 24 個數字當成一個完整模型。

醫療任務改用 M01–M12 訓練另一份 4×6 的 P，基底可共用。兩份提示共有 48 個值、192 bytes；這是任務模組總量，不是雙任務系統的總記憶體。

## 程式（補充）

以下只建立形狀並核對預算，不訓練或下載模型。固定種子 42，確認輸入三個詞元接上提示後，序列多出四個位置。

```python
import numpy as np
rng = np.random.default_rng(42)
prompt = rng.normal(size=(4, 6)).astype(np.float32)
text = np.zeros((3, 6), dtype=np.float32)
joined = np.concatenate([prompt, text], axis=0)
print("P:", prompt.shape, "參數:", prompt.size)
print("提示權重 bytes:", prompt.nbytes)
print("拼接後:", joined.shape)
print("兩任務提示 bytes:", 2 * prompt.nbytes)
```
```text
P: (4, 6) 參數: 24
提示權重 bytes: 96
拼接後: (7, 6)
兩任務提示 bytes: 192
```

:::tip[讀碼重點]
`axis=0` 接的是序列位置，維度仍為 6。這段沒有損失或優化器，所以只驗形狀；實際 Prompt Tuning 還要反向傳播來學 P。
:::

## 怎麼用、怎麼判讀（補充）

多任務共用凍結模型、且能存取嵌入介面時，可以評估軟提示。只有純文字 API 時，未必能注入任意向量；可讀指令不能直接當成已訓練好的 P。

提示權重小，仍要保留基底並經它前向運算。訓練也可能需保留中間啟用值，讓梯度回到 P；額外提示位置還會增加上下文與注意力成本。

### 換個場景

指引沒有列軟提示專屬領域或資料條件；下表是核心機制的應用延伸。

| 場景 | 資料條件 | 判讀重點 |
|---|---|---|
| 客服（補充） | 有輸入與理想答 | 小模組是否足以維持分類及回覆 |
| 醫療紀錄（補充） | 有忠實摘要示範 | 未知資訊是否仍被保留為未知 |
| 法律文書（補充） | 同基底、多任務格式 | 任務向量與基底版本要配對 |

## 常見誤解（補充）

- 「凍結模型就不需要訓練。」P 仍需要資料、損失和更新。
- 「軟提示就是多寫幾句指令。」它是可學的連續向量。
- 「24 個參數代表全部記憶體只需 96 bytes。」這只算提示權重。
- 「換另一個模型也能直接沿用。」嵌入維度相同也不保證表示空間相容。

## 進階

### 參考來源

- 科目 1 學習指引（本機快照，版本未標示）`guide-1:3-61`、`guide-1:3-72`：只支持提示與微調的策略背景，未教授本頁軟提示機制。
- [Prompt Tuning 原始論文第 2 節](https://arxiv.org/html/2104.08691v2)：支持輸入端 P、凍結模型及公式；由矩陣形狀推得預算算例。
- [PEFT Soft prompts](https://huggingface.co/docs/peft/main/en/conceptual_guides/prompting)：支持提示家族、更新位置及 Prefix Tuning 區別。
- [PEFT 軟提示實作教學](https://huggingface.co/docs/peft/main/en/task_guides/clm-prompt-tuning)：參考訓練與載入任務提示的流程。

## 小結（補充）

- 文字提示改輸入文字，軟提示微調學輸入端向量。
- 固定基底並不等於沒有反向傳播。
- 提示量由位置數乘嵌入維度計算。
- 儲存小模組仍須考慮基底、序列與推論介面。
