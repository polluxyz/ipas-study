---
id: overfitting
title: 過擬合
aliases:
  - 過度擬合
  - Overfitting
kind: problem
codes:
  - L23201
  - L23303
  - L23304
guide_refs:
  - guide-1:4-31
  - guide-3:4-62
  - guide-3:4-63
  - guide-3:5-16
  - guide-3:5-43
gaps:
  - ref: guide-3:4-63
    level: shallow
    ability: 指引只有定義、成因與「訓練好、驗證差」的描述，沒有教怎麼從學習曲線判斷；115-1 科3 第48題要讀圖、第30題要分辨「高變異」與「過擬合」
author: codex
status: draft
textbook: v2
summary: 過擬合是模型記住訓練細節，讓未見資料的表現落後於訓練表現
goals:
  - id: g1
    text: 從雙曲線辨認過擬合線索，區別欠擬合與高變異，並固定評估集換訓練子樣本比對
  - id: g2
    text: 依模型複雜度、資料量與訓練時間選擇改善方向
  - id: g3
    text: 排除切分與評估模式的干擾，保留獨立評估，並固定種子檢查洩漏、重複及Dropout模式
formula_groups: []
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 訓練損失持續下降，驗證損失連續多輪回升，哪個說法最精確？
    options:
      A: "驗證損失連續回升已證明分布改變，不需再核對資料即可確定漂移"
      B: "屬於高偏差的充分證據，因為驗證變差就表示模型容量不足"
      C: "是過擬合線索，仍須核對資料切分與訓練、驗證的評估模式"
      D: "驗證損失回升表示驗證集太難，應刪掉誤差最大的樣本再比較曲線"
    answer: C
    explain:
      A: "錯。曲線本身不提供分布改變的證據，還須檢查資料與評估條件。"
      B: "錯。高偏差通常也使訓練表現不佳，不能只憑驗證變差就斷定模型容量不足。"
      C: "對。訓練與驗證曲線分離是過擬合線索；切分方式與評估模式不同也可能影響觀察，仍需核對。"
      D: "錯。依誤差剔除驗證樣本會美化成績，不能用來排除過擬合或判定原驗證集不適當。"
  - id: c2
    goal: g2
    type: choice
    prompt: 影像模型在少量資料上訓練極好、驗證很差，哪個措施直接限制複雜度？
    options:
      A: "加入適度正則化懲罰，或減少模型參數以限制擬合訓練細節"
      B: "維持模型架構，只增加訓練輪次，讓更多梯度更新降低模型自由度"
      C: "提高影像輸入解析度，利用更多像素直接減少模型可學習的細節"
      D: "固定資料量並加寬隱藏層，讓參數更多以直接限制模型複雜度"
    answer: A
    explain:
      A: "對。正則化懲罰限制擬合方式，減少模型參數則降低容量，兩者都能直接限制複雜度。"
      B: "錯。增加梯度更新不會減少模型自由度，訓練更久還可能更充分擬合雜訊。"
      C: "錯。更多像素沒有直接限制模型複雜度，反而可能讓模型利用更多訓練細節。"
      D: "錯。固定資料量而增加隱藏層寬度會提高容量，方向與限制複雜度相反。"
  - id: c3
    goal: g3
    type: choice
    prompt: 需求模型在隨機切分驗證集很好，上線到未來月份卻很差。最先檢查什麼？
    options:
      A: 增加模型深度
      B: 改用時間順序驗證並檢查分布變化
      C: 把上線資料全視為訓練資料
      D: 僅把訓練輪次減半
    answer: B
    explain:
      A: 錯。應先確認評估是否模擬部署。
      B: 對。時間切分與分布變化可能解釋驗證和部署落差。
      C: 錯。這會失去獨立評估，且不一定已有標籤。
      D: 錯。任意減半無法處理錯誤切分。
  - id: c4
    goal: g3
    type: choice
    prompt: 同一個含 Dropout 的模型在固定驗證集上重複預測卻不同。哪個檢查最合理？
    options:
      A: 只呼叫 no_grad，因為關閉梯度就會關閉隨機屏蔽
      B: 每次改用新驗證樣本，因為新樣本可抵銷隨機遮罩
      C: 只保留最低損失的那次，因為偶然改善就是泛化改善
      D: 先呼叫 eval 再關閉梯度，確認同模式後再比較措施
    answer: D
    explain:
      A: 錯。no_grad 控制梯度記錄，不會把模組切成評估模式。
      B: 錯。更換驗證樣本會混入資料組成的差異。
      C: 錯。挑最低一次會美化結果，沒有排除模式干擾。
      D: 對。一般評估應關閉 Dropout，並固定資料及權重版本。
  - id: c5
    goal: g1
    type: choice
    prompt: 團隊想觀察模型對訓練資料變動的敏感度。哪種實驗最直接？
    options:
      A: 固定已訓練模型，換五份驗證集後直接稱為模型變異
      B: 只比較一次訓練與驗證差距，再直接稱為跨樣本波動
      C: 固定同一評估集，只換訓練子樣本重訓後比較各預測
      D: 同時更換資料、容量及種子，再用最低分判斷穩定性
    answer: C
    explain:
      A: 錯。這混入評估集的組成變化，沒有重新訓練。
      B: 錯。單次落差與更換訓練資料後的波動是不同證據。
      C: 對。把預測對齊相同輸入，才能觀察重訓的敏感度。
      D: 錯。多項設定同時改變，無法隔離訓練資料的作用。
---

## 為什麼需要

訓練成績高不代表模型掌握了普遍規律。過擬合（Overfitting）描述的是：模型非常貼合訓練資料，面對未見資料時卻明顯退步。

指引 4-63 列出三個風險：模型太複雜、相對於容量的資料太少，以及訓練太久。檢查驗證表現，是為了在部署前發現這種落差。

## 直覺

:::supplement[來源：Google Machine Learning Crash Course：Overfitting]
模型可能學會瑕疵的共同形狀，也可能記住某批照片的背景與角度。後者在訓練集很有用，換一批照片就未必成立。
:::

### 從同一份曲線找證據（補充）

![第 8 至 10 輪驗證損失上升而訓練損失下降，顯示持續分離的趨勢](figure:l23303-overfitting-divergence)

這是製造瑕疵影像分類的教學模擬資料。第 5 輪後，訓練越來越好；驗證只有短暫微幅改善，接著持續惡化。

## 定義與公式

判斷重點是「訓練表現好，但未見資料明顯較差」，不是要求某個固定差值。本概念不需要通用的判定公式。

| 狀態 | 訓練表現 | 未見資料表現 | 優先檢查 |
|---|---|---|---|
| 欠擬合（補充） | 不理想 | 也不理想 | 模型是否過於受限、特徵是否不足 |
| 學到可泛化規律（補充） | 理想 | 也接近任務需求 | 持續用獨立資料確認 |
| 過擬合 | 很理想 | 明顯退步 | 複雜度、資料量與訓練時間 |

欠擬合（Underfitting）是連訓練規律都沒充分學到，不能因驗證差就一律歸為過擬合。

指引 5.2 把變異與過擬合並列：模型對訓練資料細微差異過於敏感，可能讓不同資料集上的表現差異很大。

:::supplement[來源：scikit-learn User Guide：Validation curves；Google Machine Learning Crash Course：Overfitting]
本頁細分兩者的證據：高變異看換訓練資料後的預測變化，過擬合看訓練與未見資料的落差。兩者常一起出現，但跨切分的波動也可能來自各摺組成不同。
:::

## 走一次流程

### 用數字確認趨勢（補充）

共用紀錄是 `content/examples/L23303-D-training-history.json`。曲線不是實際訓練成績，而是用固定規則重建的診斷練習。

| 輪次 | 訓練損失 | 驗證損失 | 判讀 |
|---|---|---|---|
| 1 | 0.80 | 0.90 | 起點，不能只看這一輪 |
| 5 | 0.56 | 0.58 | 前期兩者都改善 |
| 7 | 0.44 | 0.57 | 驗證只剩微幅改善 |
| 8 | 0.38 | 0.61 | 驗證開始回升 |
| 10 | 0.26 | 0.69 | 連續回升，落差擴大 |

第 5 到 10 輪訓練下降 0.30，驗證卻上升 0.11。先標為過擬合線索，再查切分、損失計算與資料品質，最後比較改善措施。

### 固定評估集，更換訓練子樣本（補充）

另用 60 筆合成製程校正資料：輸入均勻排列於 −1～1，目標是平滑訊號加標準差 0.18 的常態雜訊，NumPy 種子 31。輸入、目標與 MSE 均無單位。

完整數值及索引在 `L23303-M4-B-dropout-evaluation.json`；這份資料與原影像曲線分開，不是原模型的改善成績。

先固定 36 筆訓練池、12 筆驗證與 12 筆封存測試；列 ID 全部寫在 JSON。只從訓練池以種子 101～105 各抽 20 筆、不放回；相同 12 筆驗證輸入與標籤一直不變。

各子樣本重訓線性及九次模型，用 Ridge 的 Cholesky 求解、alpha=0.000001，沒有隨機初值。家族內只改訓練子樣本；下圖是驗證分數波動，種子不是時間。

![同12筆固定驗證集下，九次模型隨訓練子樣本的分數波動較大；連線只引導比較，並非訓練曲線](figure:l23303-m4-b-resampling-variation)

| 訓練子樣本種子 | 線性驗證MSE | 九次驗證MSE |
|---|---|---|
| 101 | 0.060910 | 0.030271 |
| 102 | 0.049045 | 0.030385 |
| 103 | 0.049284 | 0.065659 |
| 104 | 0.051476 | 0.030712 |
| 105 | 0.047614 | 0.062775 |

固定各驗證輸入，算五次預測的母體變異，再對 12 點平均：線性 0.001815，九次 0.018666。這只反映五份相依子樣本，不能外推未來，也非複雜模型必然高變異。

相對地，只看種子 103 的九次模型，訓練 MSE 0.013136、驗證 0.065659，是**單次切分落差**。它可提示過擬合，卻不能單獨提供上面的跨訓練樣本波動，也不能證明落差只由容量造成。

### 從已知訊號看模型怎麼學到雜訊（補充）

這份合成資料明訂平滑訊號為 `s(x)=0.7x+0.3sin(3x)`，觀測值是訊號加上每筆獨立抽到的常態雜訊；這些隨機偏移不是希望模型學會的製程規律。

沿用種子 103 的訓練 ID、九次特徵、alpha=0.000001 與 Cholesky 求解，重新擬合後看訓練點 ID 44（x=0.457627，計算用 JSON 完整精度）：

| 同一訓練點的對照 | 數值 |
|---|---|
| 已知平滑訊號 s(x) | 0.614483 |
| 帶雜訊觀測值 y | 0.540584 |
| 原帶雜訊標籤訓練的預測 | 0.546015 |
| 改用乾淨訊號標籤重訓的預測 | 0.614530 |

此點的雜訊是 `y−s(x)=−0.073899`；原預測相對訊號偏移 −0.068467，方向跟著雜訊往下，因而更貼近這筆觀測值。

乾淨對照保持相同 20 個 x、特徵、alpha 與求解法，只把訓練標籤換成由原生成式算出的 s(x)，沒有另抽資料。

對這 20 點的已知訊號計算預測 MSE，原模型為 0.020303，乾淨對照約為 0.00000000370；這把此固定模型因訓練標籤雜訊而產生的偏移具體呈現出來。

重算時從 JSON 的 `dataset` 取 x、y，依 `resampling.runs` 中種子 103 的 `train_ids` 選列。

以 `PolynomialFeatures(9, include_bias=False)` 展開特徵。

用 `Ridge(alpha=0.000001, solver="cholesky")` 分別擬合 y 與 s(x)，即可得到表中兩個預測。

此例原訓練 MSE 0.013136 雖低於理論雜訊變異 0.0324，但有限樣本的實現值會變，不能只靠這個比較證明雜訊擬合。

上面的已知訊號對照支持本合成例學到訓練雜訊的觀察，仍不能把所有單次訓練／驗證落差都歸因於雜訊，也不能取代前述跨子樣本波動實驗。

### 固定切分比較改善方向（補充）

沿用種子 103 的 20 筆訓練及 12 筆驗證，固定九次特徵與求解法，只改 Ridge 的 alpha。此例已用於教材診斷，並非事前登記的效能研究，也不是 Dropout 實驗。

先在兩個候選中，以驗證結果選定 alpha=0.1、凍結兩組設定，再對原封存的 12 筆測試報分；測試不參與選擇。下表三種 MSE 都不含權重懲罰，避免把不同目標直接混比。

| 設定 | 訓練MSE | 固定驗證MSE | 凍結後測試MSE |
|---|---|---|---|
| alpha=0.000001 | 0.013136 | 0.065659 | 0.040910 |
| alpha=0.1 | 0.024171 | 0.037243 | 0.022711 |

懲罰較強後，訓練誤差上升，此例驗證與獨立測試誤差下降。這只支持此合成資料的觀察，不能保證部署成績；看過測試後不能再依它改 alpha，否則要另留新的獨立評估資料。

本例三集合 ID 交集為 0，沒有集合內或跨集合的重複輸入；前處理與模型只用訓練資料擬合，特徵不含事後資訊。這仍不能排除真實資料的語意近重複或群組洩漏，須依來源追查。

## 程式

### 重算固定切分的前後對照（補充）

把 `IPAS_REPO_ROOT` 設為目前工作樹；程式從 JSON 讀固定列 ID，兩次只改 alpha。完整子樣本與逐筆預測也在同一 JSON，方便獨立重算。

```python
import json, os, numpy as np
from pathlib import Path
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import Ridge
root = Path(os.environ["IPAS_REPO_ROOT"])
d = json.loads((root / "content/examples/L23303-M4-B-dropout-evaluation.json").read_text(encoding="utf-8"))
x = np.array([r["x"] for r in d["dataset"]])[:, None]
y = np.array([r["y"] for r in d["dataset"]])
for row in d["regularization_comparison"]["rows"]:
    tr, va, te = (np.array(row[k])-1 for k in ("train_ids", "validation_ids", "test_ids"))
    model = make_pipeline(PolynomialFeatures(9, include_bias=False), Ridge(alpha=row["alpha"], solver="cholesky"))
    model.fit(x[tr], y[tr])
    print(row["alpha"], f"{np.mean((model.predict(x[tr])-y[tr])**2):.6f}",
          f"{np.mean((model.predict(x[va])-y[va])**2):.6f}", f"{np.mean((model.predict(x[te])-y[te])**2):.6f}")
```
```text
1e-06 0.013136 0.065659 0.040910
0.1 0.024171 0.037243 0.022711
```

### Dropout 的 train 與 eval 實測（補充）

另外固定同一個 `Dropout(p=0.5)`、八個 1 的輸入與 CPU 種子 7；沒有重訓、沒有可學權重。訓練模式抽遮罩，保留的 1 會縮放為 2；評估模式則直接保留輸入。

```python
import torch
torch.manual_seed(7)
drop = torch.nn.Dropout(p=0.5)
x = torch.ones(8)
drop.train()
a, b = drop(x), drop(x)
print("train", a.tolist(), b.tolist())
drop.eval()
with torch.no_grad():
    c, d = drop(x), drop(x)
print("eval", c.tolist(), d.tolist())
print("相同輸出", torch.equal(a, b), torch.equal(c, d))
```
```text
train [2.0, 2.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0] [0.0, 0.0, 2.0, 2.0, 2.0, 2.0, 2.0, 0.0]
eval [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
相同輸出 False True
```

遮罩輸出是在 PyTorch 2.15.0+cpu 實測；相同版本與 CPU 種子可重現，跨版本或裝置不保證完全相同。一次抽到相同遮罩也有可能，不能把兩次不同當定理。

`eval()` 控制隨機層，`no_grad()` 控制梯度記錄。比較措施時，兩個模型都先切成 `eval()`，使用同一評估集與損失定義；續訓前切回 `train()`。

## 怎麼用、怎麼判讀

| 主要風險 | 可採取的方向 | 代價或限制 |
|---|---|---|
| 容量相對資料過大 | 簡化模型、適度正則化 | 限制太強可能欠擬合 |
| 樣本少或缺乏多樣性 | 收集具代表性的資料 | 更多相似重複樣本幫助有限 |
| 後期驗證持續惡化 | 使用早停 | 太早停可能尚未學好 |

正則化（Regularization）用額外限制降低記住雜訊的機會；Dropout 在訓練時隨機屏蔽部分神經元。它們與早停處理的面向不同，參數仍需用驗證資料選擇。

:::supplement[來源：Keras FAQ；scikit-learn User Guide：Validation curves]
改善前先確認：兩線是否用同樣損失與推論模式；資料是否按部署對象切分；是否有重複樣本或資料洩漏。長期反覆用同一驗證集挑設定，也可能逐漸對驗證集過擬合。
:::

### 換個場景

科目 3 指引列容量大、資料少、訓練太久；科目 1 的 4-31 舉製造瑕疵辨識失準。仍須區分記住訓練細節或產線改動造成分布／關係變化，不能只憑上線退步就認定過擬合。

| 場景或條件 | 可能問題 | 處理方向 |
|---|---|---|
| 模型複雜且樣本不足 | 記住訓練細節 | 限制容量與補足多樣資料 |
| 製造瑕疵辨識 | 記住原資料細節或產線改動 | 先核對樣本代表性與分布變化 |
| 商店需求預測（補充） | 記住短期促銷事件 | 依時間驗證，檢查不同季節 |
| 客服文字分類（補充） | 記住少量客戶的用語 | 以新客戶驗證，檢查樣本代表性 |

## 常見誤解

- 「多訓練一定更好」：可能只讓訓練損失更低。
- 「只有深度模型會發生」：任何容量相對資料過大的模型都有風險。
- 「限制越強越好」：太強會讓訓練規律也學不到。

:::supplement[來源：scikit-learn User Guide：Validation curves；Nested versus non-nested cross-validation]
驗證分數高不能保證最終泛化。用於挑模型的資料已經參與決策，最後仍須用保留的測試集，或用巢狀交叉驗證評估完整選模流程。
:::

## 進階

### 落差的其他來源（補充）

資料分布不同也可能造成落差。若未來月份的需求規律改變，單純簡化模型未必能解決；要另外檢查資料代表性與分布變化。

### 參考來源

- 學習指引科目 3，4-62～4-64、5-16、5-43～5-46（支持：定義、成因、對策與適用條件）。
- 學習指引科目 1，4-31（支持：過擬合與製造瑕疵辨識情境；同頁另列概念漂移，兩者須分開查證）。
- [Google Machine Learning Crash Course：Overfitting](https://developers.google.com/machine-learning/crash-course/overfitting/overfitting)（支持：曲線診斷與資料代表性）。
- [scikit-learn：Validation curves](https://scikit-learn.org/stable/modules/learning_curve.html)（支持：高變異區別與選模限制）。
- [scikit-learn：Nested versus non-nested cross-validation](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html)（支持：常見誤解中的巢狀交叉驗證可評估完整選模流程）。
- [Keras FAQ](https://keras.io/getting_started/faq/#why-is-my-training-loss-much-higher-than-my-testing-loss)（支持：評估模式與時點）。
- [scikit-learn：Bias-variance decomposition](https://scikit-learn.org/stable/auto_examples/ensemble/plot_bias_variance.html)（支持：固定輸入比較重訓預測的變異；本頁資料及五份子樣本自行合成）。
- [scikit-learn Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)（支持：alpha 控制權重懲罰與確定性求解設定）。
- [PyTorch Dropout](https://docs.pytorch.org/docs/2.9/generated/torch.nn.Dropout.html)（支持：訓練遮罩、保留值縮放與評估行為）。
- [PyTorch Reproducibility](https://docs.pytorch.org/docs/2.9/notes/randomness.html)（支持：種子與跨版本可重現限制）。
- [Dive into Deep Learning 5.5](https://d2l.ai/chapter_multilayer-perceptrons/generalization-deep.html)（支持：泛化診斷及單次觀察的限制）。

## 小結

- 過擬合關心訓練與未見資料的落差，欠擬合連訓練都沒學好。
- 本例驗證後期連續回升，訓練仍持續進步，構成警訊。
- 限制複雜度、改善資料與早停，分別處理不同風險。
- 先核對評估條件，再比較措施，最後保留獨立評估。
