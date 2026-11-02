---
id: "convergence-criteria"
title: "收斂與停止判準"
kind: "technique"
codes:
  - "L23103"
aliases:
  - "Convergence Criteria"
  - "停止條件"
summary: "停止條件決定何時結束計算，停止原因要與已收斂的證據分開記錄"
goals:
  - id: "g1"
    text: "用同一訓練紀錄區分損失差值、驗證表現、梯度範數與預算四種停止證據"
requires:
  - "gradient-descent"
  - "train-val-test-split"
guide_refs:
  - "guide-3:3-26"
textbook: "v2"
author: "codex"
status: "draft"
formula_groups:
  - id: "loss-delta-threshold"
    source: "https://raw.githubusercontent.com/pytorch/pytorch/v2.15.0/torch/optim/lbfgs.py ; https://nlopt.readthedocs.io/en/latest/NLopt_Reference/#stopping-criteria"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK2-W-L23103-A"
  - id: "gradient-norm-threshold"
    source: "https://docs.scipy.org/doc/scipy/reference/optimize.minimize-bfgs.html"
    status: "verified"
    checked_by: "codex-gpt-6.1-sol:CK-W-L23103-A"
self_check:
  - id: "c1"
    goal: "g1"
    type: "choice"
    prompt: "能源模型第 6 步因預算用完停止，訓練損失 0.0208，梯度範數 0.2362，設定的梯度閾值為 0.05。哪個回報最準確？"
    options:
      A: "已達全域最小，因為步數用完"
      B: "梯度閾值通過，因為損失低於 0.05"
      C: "預算停止；梯度閾值尚未通過，不能僅因此宣稱收斂"
      D: "模型必定過擬合，因為不是零損失"
    answer: "C"
    explain:
      A: "預算是計算限制，與解是否最優沒有必然關係。"
      B: "梯度範數 0.2362 高於閾值，不能用損失代替。"
      C: "應分開記錄停止原因與尚未達成的數值證據。"
      D: "過擬合要比較泛化表現，不能由非零訓練損失判定。"
  - id: "c2"
    goal: "g1"
    type: "choice"
    prompt: "能源模型驗證損失第 5、6、7 步為 0.300、0.305、0.310；越低越好，patience=2、min_delta=0.001，先前最佳在第 5 步。哪個決策合理？"
    options:
      A: "第7步可停止並回復第5步權重，但無法據此判定梯度為零"
      B: "第6、7步驗證損失連續上升，應以第7步最新權重當成泛化最佳模型"
      C: "把0.300、0.305、0.310改由測試集計算，再依同一patience=2條件決定停止"
      D: "第6步驗證損失惡化時將等待計數歸零，第7步再算第一次未改善"
    answer: "A"
    explain:
      A: "第6、7步都未改善，已達patience＝2，可回復驗證損失最低的第5步；這不提供梯度為零的證據。"
      B: "驗證損失越低越好，第5步的0.300優於第7步的0.310，最新權重不代表最佳泛化。"
      C: "停止條件應由驗證資料控制，反覆用測試集選擇停止步數會破壞最終獨立評估。"
      D: "未改善時應累加等待計數，第6、7步分別是1與2，不能因損失惡化而歸零。"
---

## 為什麼需要

迭代更新不會自動知道何時夠好。沒有停止條件，可能在平坦區浪費算力，也可能因時間用完而留下尚未收斂的參數。

先看程序是否符合收斂判準，再決定是否停止計算。英文 Convergence Criteria 指這些判準；預算條件也能要求停止，理由應分別報告。

## 直覺

指引列出四種觀察：訓練損失變化很小、驗證集不再改善、梯度接近零，以及步數或時間到上限。它們回答不同問題。

| 判準 | 觀察什麼 | 不能直接推出什麼 |
|---|---|---|
| 損失差值 | 連續多次迭代的損失差是否低於設定的閾值 $\varepsilon$ | 一定達全域最小 |
| 驗證表現 | 新資料表現是否還在改善 | 梯度一定為零 |
| 梯度範數 | 當前局部斜率是否很小 | 一定不是鞍點 |
| 預算 | 時間或更新步數是否用完 | 數值解已收斂 |

:::supplement[來源：Deep Learning 第 8.1 節；SciPy BFGS Options]
表中「不能直接推出」是對停止證據的界線說明。尤其驗證持平可能來自抽樣波動或設定不佳，不能宣稱模型已達所有可能的泛化上限。
:::

## 定義與公式（補充）

本頁以正閾值 $\varepsilon_J,\varepsilon_g$ 檢查損失與梯度：

$$
\Delta_t=|J(\theta_t)-J(\theta_{t-1})|<\varepsilon_J,
\qquad \lVert\nabla J(\theta_t)\rVert_2<\varepsilon_g
$$

$t$ 是更新步數，$\theta_t$ 是當步參數，$J$ 是相同定義的訓練目標。$\Delta_t$ 是相鄰步的絕對差；L2 範數把所有梯度分量的平方加總後開根號。

絕對相鄰差參照 PyTorch LBFGS 的停止判斷，NLopt 也提供目標絕對變化門檻。本頁自行採全量梯度更新、差值連續兩步通過，沒有實作 LBFGS。

差值很小也可能只是學習率太小，不能僅此宣告找到谷底。

## 算一次（補充）

沿用六筆資料、初始 $(0,0)$、學習率 0.25，完整記錄 12 次更新。此處一步就是一次全量更新；不把它與任何小批次設定混用。

另給能源模型一組獨立的教學用驗證觀測，和訓練紀錄按步數並列。它不由這六筆訓練資料算出，也未宣稱來自另一個指定的線性驗證集。

| 判準設定 | 首次觸發 | 當時證據 |
|---|---|---|
| 差值 <0.01，連續兩步 | 第 9 步 | 第 8、9 步差值為 0.0051、0.0023 |
| 驗證改善超過 0.001，等待兩步 | 第 7 步 | 第 5 步最佳 0.300；後兩步變差 |
| 梯度範數 <0.05 | 第 10 步 | 範數約 0.0463 |
| 最多六次更新 | 第 6 步 | 範數仍約 0.2362 |

各列是對同一份完整紀錄獨立判斷。若真實程式同時啟用四條並採先到先停，第 6 步就會因預算停止，後面列出的點不會真的執行到。

第 8 步的差值為 $|0.0040751-0.0091957|\approx0.0051206$，第 9 步約為 0.0022669；連續兩次都低於 0.01。

第 10 步參數約 $(1.9653,0.9990)$，梯度約 $(-0.0462,-0.0020)$，L2 範數約 0.0463。它通過梯度閾值，但和「剛好等於最優參數」仍是不同敘述。

![同一條訓練歷程上，預算、驗證、損失差值和梯度判準的觸發位置不同，不能互換原因。](figure:l23103-convergence-criteria-stops)

## 程式（補充）

下列片段只驗算損失差值、梯度與步數三條規則；驗證等待流程可接早停教材。先記錄狀態、再檢查停止，避免輪次差一。

```python
import numpy as np
theta, previous, streak = np.zeros(2), None, 0
found = {}
for step in range(13):
    w, b = theta
    loss = 2/3*(w-2)**2 + (b-1)**2
    g = np.array([4/3*(w-2), 2*(b-1)])
    streak = streak+1 if previous is not None and abs(loss-previous)<.01 else 0
    for name, passed in [("差值", streak>=2), ("梯度", np.linalg.norm(g)<.05), ("預算", step>=6)]:
        if passed and name not in found:
            found[name] = step
    previous = loss
    theta = theta - .25*g
print("差值", found["差值"], "梯度", found["梯度"], "預算", found["預算"])
```
```text
差值 9 梯度 10 預算 6
```

:::tip[讀碼重點]
程式刻意不 break，才能在同一紀錄比較各規則第一次通過的時間。正式同時啟用時要另外定義停止順序，並存下觸發原因。
:::

## 怎麼用、怎麼判讀

資源有限時先訂預算，同時保留訓練損失、驗證指標與梯度紀錄。驗證停止可避免繼續過擬合；梯度小則提供另一種局部數值證據。

:::supplement[來源：SciPy BFGS Options]
不同損失尺度、平均或加總方式，會改變差值與梯度範數大小。比較閾值前要先固定定義，數值出現非有限值時也應記為異常停止。
:::

### 換個場景

| 場景 | 指引條件 | 判讀 |
|---|---|---|
| 訓練進入平緩期 | 連續多次損失變化極小 | 配合其他證據檢查 |
| 避免過擬合 | 驗證準確率或 F1 不再改善 | 和訓練目標分開看 |
| 局部斜率很小 | 梯度接近零 | 仍需留意平坦區與鞍點 |
| 受控訓練週期 | 時間或步數有限 | 預算停止不等於收斂 |
| 能源預測（補充） | 最多六次更新 | 回報預算原因與當時梯度 |
| 房價預測（補充） | 另取獨立的房價驗證資料 | 重記驗證曲線，不沿用能源的停止步數 |

## 常見誤解

- 損失很低與損失差值很小，是不同條件。
- 驗證停止、梯度停止與預算停止，證據不能互相替代。
- 等待次數應看連續未改善，不是任意累積的歷史次數。（補充）

## 進階

### 參考來源

- 科目 3 指引 3.3，guide-3:3-26（版本未標示）：支持四類判準及資源受限場景。
- [PyTorch 2.15 LBFGS 原始碼](https://raw.githubusercontent.com/pytorch/pytorch/v2.15.0/torch/optim/lbfgs.py)：支持「定義與公式」的絕對相鄰差判斷 `abs(loss - prev_loss) < tolerance_change`；本頁另訂全量更新及連續兩步規則。
- [NLopt Stopping criteria](https://nlopt.readthedocs.io/en/latest/NLopt_Reference/#stopping-criteria)：支持目標絕對變化門檻的意義，不代替本頁的等待次數設定。
- [SciPy BFGS Options](https://docs.scipy.org/doc/scipy/reference/optimize.minimize-bfgs.html)：支持梯度範數閾值、迭代上限與精度考量；本頁手寫判準，不宣稱使用 BFGS。
- [Deep Learning 8.1](https://www.deeplearningbook.org/contents/optimization.html)：支持泛化與數值求解目標的區分。
- [Dive into Deep Learning 12.1](https://d2l.ai/chapter_optimization/optimization-intro.html)：參考把停止點與最佳學習效果分開的教法。

## 小結

- 四類停止規則觀察不同證據。
- 預算耗盡要如實記為預算停止。
- 同一紀錄可獨立檢查多條規則，正式訓練還須定義先後。（補充）
