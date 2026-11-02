---
id: dropout
title: Dropout
kind: technique
codes: [L23203, L23304]
aliases: [隨機失活, 隨機屏蔽]
requires: [regularization]
is_a: [regularization]
mitigates:
  - target: overfitting
    note: 訓練時隨機屏蔽神經元輸出，降低對固定路徑的依賴；丟棄率太高會妨礙學習。
    source: [guide-3:4-64, guide-3:5-45, guide-3:5-46]
summary: Dropout 在訓練時隨機把部分輸出設為零，降低神經元對固定搭配的依賴
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-64, guide-3:4-71, guide-3:5-45, guide-3:5-46, guide-1:3-49]
goals:
  - id: g1
    text: 用遮罩說明 Dropout 如何減少固定依賴，並分辨暫時屏蔽與永久刪除
  - id: g2
    text: 比較訓練與推論的行為，辨認丟棄過多造成的副作用
  - id: g3
    text: 核算保留率、丟棄率與兩種縮放慣例，讀懂 NumPy 及框架的訓練推論結果
formula_groups:
  - id: bernoulli-mask
    source: https://d2l.ai/chapter_multilayer-perceptrons/dropout.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
  - id: inverted-expectation
    source: https://docs.pytorch.org/docs/stable/generated/torch.nn.Dropout.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23304-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 客服網路有 64 個隱藏單元，每次訓練隨機屏蔽約 16 個單元。某個單元這次被屏蔽，下次又參與運算。哪個說明合理？
    options:
      A: 暫時遮罩會換位置，促使後續層不要只依賴固定搭配
      B: 永久刪除會換位置，促使模型逐批減少可訓練參數量
      C: 暫時遮罩固定位置，促使後續層永遠只靠其他單元學習
      D: 永久刪除固定位置，促使推論只使用最後一次留下的單元
    answer: A
    explain:
      A: 不同訓練呼叫可使用不同遮罩，單元並未被永久移除。
      B: Dropout 不會逐批刪除參數，屏蔽的是當次輸出。
      C: 固定位置永久不參與運算，不是本題隨機換遮罩的行為。
      D: 一般推論會使用完整網路，不沿用最後一次訓練遮罩。
  - id: c2
    goal: g2
    type: choice
    prompt: 影像網路採 PyTorch inverted dropout，丟棄率從 0.2 改成 0.9 後，訓練與驗證都變差。哪項處置較適合？
    options:
      A: 比較較低丟棄率，並在一般驗證與推論時再乘保留率
      B: 比較較低丟棄率，並在一般驗證與推論時繼續抽遮罩
      C: 比較較低丟棄率，並在一般驗證與推論時切換為 eval
      D: 比較更高丟棄率，並在一般驗證與推論時保留 train
    answer: C
    explain:
      A: inverted dropout 在訓練時已完成縮放，推論不應再乘保留率。
      B: 降低丟棄率仍需驗證；一般驗證與推論應關閉隨機遮罩，才能一致比較模型。
      C: 丟棄太多可能妨礙學習，較低比例需驗證，評估時則使用完整網路。
      D: 更高丟棄率可能加劇訊號不足，保留訓練模式也會讓評估繼續抽遮罩。
  - id: c3
    goal: g3
    type: choice
    prompt: 某輸出 h 為 6，保留率 q 為 0.75。採 inverted dropout 時，單次訓練的可能輸出、其期望及一般推論輸出各為何？
    options:
      A: 訓練為 0 或 4.5，期望 3.375，推論為 6
      B: 訓練為 0 或 8，期望 6，推論為 6
      C: 訓練為 0 或 6，期望 4.5，推論為 4.5
      D: 訓練為 0 或 24，期望 18，推論為 4.5
    answer: B
    explain:
      A: inverted dropout 應除以保留率，並非把保留的輸出乘上保留率。
      B: 保留時輸出為 6 除以 0.75 得 8，機率加權後期望為 6，推論直接回傳 6。
      C: 這是未在訓練縮放、改於推論縮放的另一種慣例，並非題目指定的 inverted dropout。
      D: 24 是誤除丟棄率 0.25，推論再乘 0.75 也混用了兩種慣例。
---

## 為什麼需要

神經網路可能只靠幾個固定神經元配合，就把訓練樣本記熟。Dropout 在訓練時暫時屏蔽部分輸出，讓網路學會透過其他路徑取得資訊。

目的是降低過擬合風險。丟棄過多也會讓模型難以學習，並不是比例越高越好。

## 直覺

每次遮掉的單元可以不同，就像暫時抽出一個子網路來訓練。單元仍然存在；下一次可能重新參與，並不是固定刪除某幾個神經元。

![對照輸入、遮罩與訓練輸出：標示為 0 的位置暫時關閉；推論恢復完整輸出，縮放位置則取決於使用慣例。](figure:l23304-dropout-mask)

圖沿用共用例子的四個隱藏輸出與固定遮罩，方便核算。不同訓練呼叫可換遮罩；圖中同一位置反覆出現，只是為了比較兩種縮放。

## 定義與公式

指引把 $p$ 定義成**保留率**，並描述「訓練屏蔽、推論按保留率縮放」的慣例。以下改用 $q$ 表示保留率，避免和框架參數混淆。

:::supplement[來源：Dive into Deep Learning 5.6 Dropout；PyTorch Dropout；Keras Dropout layer]
令丟棄率為 $r=1-q$，並假設 $0<q\leq1$。每個輸出以獨立的 Bernoulli 遮罩處理：

$$
m_j\sim\operatorname{Bernoulli}(q),\qquad
P(m_j=1)=q,\quad P(m_j=0)=1-q
$$

$m_j$ 是第 $j$ 個輸出的遮罩，1 表示保留、0 表示丟棄；$q$ 是保留機率。對未縮放的訓練輸出：

$$
z_j=m_jh_j,\qquad E[z_j]=qh_j
$$

$h_j$ 是固定的單元輸出，$z_j$ 是屏蔽後輸出，$E$ 表示對遮罩取期望。若 $h_j=2$、$q=0.75$，可能輸出 2 或 0，期望為 1.5。
:::

### 兩種縮放位置

指引採推論時縮放：訓練只屏蔽，推論使用完整網路，再將通往下一層的權重按保留率調整。

| 慣例 | 訓練時 | 一般推論時 |
|---|---|---|
| 指引的推論縮放 | 保留值不放大 | 完整網路，輸出按保留率縮放 |
| inverted dropout（補充） | 保留值除以保留率 | 完整網路，不額外縮放 |

:::supplement[來源：PyTorch Dropout；Keras Dropout layer；Dive into Deep Learning 5.6]
Inverted dropout 把縮放提前到訓練：

$$
\tilde h_j=\frac{m_jh_j}{q},\qquad
E[\tilde h_j]=q\frac{h_j}{q}+(1-q)0=h_j
$$

$\tilde h_j$ 是訓練時的縮放輸出，其餘符號同前。$h_j=2$、$q=0.75$ 時，保留值是 $8/3$，期望回到 2；推論直接輸出 2。

這個期望等式針對固定輸入的單一 Dropout 層。經過後續非線性運算後，不能據此宣稱整個網路的期望預測完全相同。

PyTorch 的 `p` 與 Keras 的 `rate` 都表示丟棄率。若保留率是 0.75，兩個框架應傳入的都是 0.25。
:::

## 算一次（補充）

房價與客服網路共用隱藏輸出 $[2,-1,0.5,3]$，$q=0.75$、$r=0.25$。先固定一次遮罩為 $[1,0,1,0]$。

1. 不在訓練縮放：屏蔽後為 $[2,0,0.5,0]$。
2. 使用 inverted dropout：保留值除以 0.75，得 $[2.6667,0,0.6667,0]$。
3. 一般推論不抽遮罩：inverted 慣例回傳 $[2,-1,0.5,3]$。
4. 若採指引慣例，推論的等效縮放輸出為 $[1.5,-0.75,0.375,2.25]$。

兩種慣例的訓練尺度不同，不能把其中一種的訓練輸出接上另一種的推論縮放。四個單元中這次只保留兩個，也不違反保留率 0.75；機率不保證每次保留固定個數。

以第一個值 2 看期望：未縮放時為 $0.75\times2=1.5$；inverted 時為 $0.75\times(2/0.75)=2$。單次輸出不一定等於期望。

## 程式（補充）

執行前把環境變數 `IPAS_REPO_ROOT` 設為專案根目錄的絕對路徑。五頁程式都由它讀取共用例子，不依賴執行器的暫存工作目錄。

NumPy 範例同時核算固定遮罩，並枚舉全部 16 種遮罩驗證期望。

```python
import itertools, json, os
from pathlib import Path
import numpy as np
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23304-C-penalties-dropout.json").read_text(encoding="utf-8"))["dropout"]
h = np.array(d["input"], dtype=float)
q = d["keep_probability"]; m = np.array(d["mask"])
masks = np.array(list(itertools.product([0, 1], repeat=len(h))))
probs = np.prod(np.where(masks == 1, q, 1-q), axis=1)
print("standard train:", np.where(m, h, 0).tolist())
print("standard eval:", (q*h).tolist())
print("inverted train:", np.round(np.where(m, h/q, 0), 4).tolist())
print("inverted mean:", np.round(probs @ (masks*h/q), 4).tolist())
```
```text
standard train: [2.0, 0.0, 0.5, 0.0]
standard eval: [1.5, -0.75, 0.375, 2.25]
inverted train: [2.6667, 0.0, 0.6667, 0.0]
inverted mean: [2.0, -1.0, 0.5, 3.0]
```

再用同一輸入測 PyTorch。種子固定供重現；框架實際抽出的遮罩可與前面的手動遮罩不同，不能要求它固定丟棄相同位置。

```python
import torch
torch.manual_seed(d["torch_seed"])
layer = torch.nn.Dropout(p=1-q)
t = torch.tensor(h, dtype=torch.float32)
layer.train()
out = layer(t)
print("train:", [round(v, 4) for v in out.tolist()])
print("scale valid:", torch.all((out == 0) | torch.isclose(out, t/q)).item())
layer.eval()
print("eval:", layer(t).tolist())
layer.train()
with torch.no_grad():
    print("no_grad keeps train:", layer.training)
```
```text
train: [2.6667, -0.0, 0.6667, 0.0]
scale valid: True
eval: [2.0, -1.0, 0.5, 3.0]
no_grad keeps train: True
```

:::tip[讀碼重點]
`train()` 啟用遮罩；`eval()` 讓本例的 Dropout 回傳輸入。`no_grad()` 只影響梯度記錄，不會替模型切換評估模式。
:::

## 怎麼用、怎麼判讀

指引把深度神經網路列為主要使用範圍。訓練時隨機屏蔽，測試時使用完整網路；若丟棄太多，可能連有效特徵都難以學習。

:::supplement[來源：PyTorch Dropout；Keras Dropout layer]
開始讀程式前先核對三件事：參數是保留率還是丟棄率、縮放放在哪一階段、目前是否為訓練模式。已採 inverted dropout，就不要在推論時再乘保留率。

$q=1$ 時沒有丟棄，輸出不變；$q=0$ 不能直接代入除法公式。框架可能另外處理全部丟棄的端點，不能靠除以零實作。
:::

### 換個場景

| 場景／條件 | 判讀重點 |
|---|---|
| 深度神經網路，擔心過度依賴固定神經元 | 比較訓練與驗證表現，避免丟棄過多 |
| AlexNet 影像分類 | 指引以 Dropout 作為其訓練特色之一 |
| 房價神經網路（補充） | 對隱藏表示施加遮罩，不等於刪除原始面積欄 |
| 客服文字分類（補充） | 檢查不同表示路徑能否支持預測 |
| 製造影像（補充） | 推論使用完整網路，核對部署端縮放慣例 |

## 常見誤解

- **Dropout 永久剪掉神經元。** 屏蔽只在當次訓練生效，架構仍保留。
- **丟棄率越高，泛化越好。** 丟棄太多會妨礙模型學習。
- **框架的 p 一定和指引同義。** 指引指保留率，PyTorch 指丟棄率。（補充）
- **關閉梯度就關閉 Dropout。** 還要切換評估模式。（補充）

## 進階

### 參考來源

- 科目 3 學習指引，版本未標示、本機快照：`guide-3:4-64`、`guide-3:5-45`～`guide-3:5-46`；支持隨機屏蔽、子網路與推論縮放。
- 科目 3 指引 `guide-3:4-71`、科目 1 指引 `guide-1:3-49`：支持 AlexNet 的影像分類場景。
- [PyTorch Dropout](https://docs.pytorch.org/docs/stable/generated/torch.nn.Dropout.html)、[Keras Dropout layer](https://keras.io/api/layers/regularization_layers/dropout/)：支持丟棄率參數、訓練縮放與推論行為。
- [Dive into Deep Learning 5.6 Dropout](https://d2l.ai/chapter_multilayer-perceptrons/dropout.html)：支持 Bernoulli 遮罩、期望計算與單層條件。
- [Srivastava 等人，Dropout](https://jmlr.org/papers/v15/srivastava14a.html)：支持減少固定依賴與子網路直覺。

## 小結

- Dropout 透過訓練時的暫時屏蔽，降低固定依賴。
- 丟棄率太高可能妨礙學習，推論通常用完整網路。
- 先分辨保留率、丟棄率，再分辨縮放放在訓練或推論。（補充）
- Inverted dropout 的單層期望維持原值，推論不再額外縮放。（補充）
