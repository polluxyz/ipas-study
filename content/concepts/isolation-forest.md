---
id: isolation-forest
title: 孤立森林
kind: model
codes:
  - L23202
aliases:
  - Isolation Forest
summary: 孤立森林以隨機切割的平均路徑，找出較容易被孤立的樣本
requires:
  - unsupervised-learning
guide_refs:
  - guide-3:4-50
  - guide-3:4-51
  - guide-3:4-52
goals:
  - id: g1
    text: 由短路徑解釋異常分數，區分排序方向與 contamination 門檻
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一棵示意樹對 0、1、2、3、9 先在 5 切割，9 一次被孤立，0 要三次。應如何判讀？
    options:
      A: 0 的路徑較長，因此在所有森林必定最異常
      B: 9 的路徑較短，因此它已被證明是設備故障
      C: 9 較容易被孤立，森林仍須平均多棵樹判讀
      D: 0 的路徑較長，因此應先把 0 從訓練集刪除
    answer: C
    explain:
      A: 較短路徑才是異常直覺。
      B: 異常候選仍須查核故障原因。
      C: 一棵樹教直覺，森林降低隨機切割偶然性。
      D: 不能依單一路徑自動刪資料。
  - id: c2
    goal: g1
    type: choice
    prompt: 同一訓練資料、種子與 100 棵樹，contamination 由 0.05 改 0.15。scikit-learn 哪種說法合理？
    options:
      A: 樹的切割全改，score_samples 較大就更異常
      B: 樹的切割相同，主要改門檻；較小分數更異常
      C: 測試必有 15% 異常，因為參數指定了真實比例
      D: 門檻永遠不變，因為 contamination 只改樹數
    answer: B
    explain:
      A: contamination 主要設定 offset，不設定隨機切割。
      B: score_samples 越低越異常；門檻與排序不同。
      C: 測試分布未必等於訓練比例。
      D: 樹數由 n_estimators 決定。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

設備故障、網路入侵與詐欺可能沒有足夠的已知標籤。孤立森林（Isolation Forest）從樣本容易被分開的程度找異常候選，不必先算每對樣本的距離。

## 直覺

隨機選一欄，再在該欄範圍內隨機切一刀。偏遠且少見的點往往幾刀就單獨成一區；密集區內的點通常需要較多次切割。

![同一棵示意樹中，9 經一次切割被分開，0 要經三次；真正森林會平均多棵樹。](figure:l23202-isolation-forest-path)

一條短路徑只是直覺示範。實際森林使用不同隨機切割並整合結果，降低單棵樹偶然分法的影響。

## 定義與公式

孤立樹的路徑長度，是從根走到終止葉節點的切割步數。孤立森林以多棵樹的平均路徑形成標準化異常分數；較短路徑代表較容易被孤立。

指引說「分數越高越異常」，使用的是將短平均路徑對應到較高分的異常程度指標。讀 API 時要先查其定義，不能只看函式名稱。

### scikit-learn 的方向與門檻（補充）

原論文把標準化平均路徑轉成異常分數：路徑越短，分數越接近 1。scikit-learn 的 score_samples 使用原論文分數的負值，所以方向相反。

| 輸出 | 怎麼讀 | 用途 |
|---|---|---|
| score_samples | 越低越異常 | 排序候選 |
| offset_ | 訓練資料決定的切點 | 對應 contamination 設定 |
| decision_function | score_samples 減 offset_ | 小於 0 為異常側 |
| predict | +1 正常側、−1 異常側 | 套用目前門檻 |

contamination 是用來設定切點的訓練異常比例假設，不是模型學到的故障機率。固定資料、種子與其他參數時，改它主要改切點，不會讓隨機樹改用另一種切割目標。

## 走一次流程

### 五點走過同一棵示意樹（補充）

共用 JSON 的 path_small 保存 0、1、2、3、9。示意切點依序為 5、1.5、0.5，都是各節點當下數值範圍內可抽到的切點。

1. 在 5 切，9 立即單獨成葉，路徑長 1。
2. 左側 {0,1,2,3} 再於 1.5 切，留下 {0,1}。
3. 在 0.5 切，0 單獨成葉，路徑長 3。
4. 換其他隨機樹重複，再整合；一棵樹的路徑不是完整森林分數。

### 設備 80／40 的用途（補充）

設備資料總共 120 筆。正常訓練 80 筆來自兩段弧形，未知測試 40 筆包含正常模式與教學遠點；只有訓練 80 筆參與縮放與建樹。

模型輸出異常候選後，再查負載、感測器校正與維修紀錄。沒有獨立故障標籤時，不能把「被標出幾筆」當成偵測準確率。

## 程式

### 同資料比較兩種 contamination（補充）

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
x = np.array(data["domains"]["equipment"]["raw"])
tr, te = data["train_indices"], data["test_indices"]
scaler = StandardScaler().fit(x[tr])
train, test = scaler.transform(x[tr]), scaler.transform(x[te])
a = IsolationForest(n_estimators=100, contamination=0.05, random_state=42).fit(train)
b = IsolationForest(n_estimators=100, contamination=0.15, random_state=42).fit(train)
print("排序分數相同", np.allclose(a.score_samples(test), b.score_samples(test)))
print("測試異常數", int(sum(a.predict(test) == -1)), int(sum(b.predict(test) == -1)))
print("offset", round(a.offset_, 6), round(b.offset_, 6))
```
```text
排序分數相同 True
測試異常數 11 17
offset -0.554201 -0.531977
```

:::tip[讀碼重點]
固定 random_state 才能在此比較門檻作用。兩模型 score_samples 相同，而 offset 不同；predict 的異常筆數不必等於測試筆數乘 contamination。
:::

## 怎麼用、怎麼判讀

孤立森林可用於大規模或高維異常探索，不依賴顯式距離度量。若異常與正常混在一起、不容易被分開，短路徑假設就可能辨認不出來。

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 設備故障、網路入侵、欺詐 | 排出異常候選 | 科3 4-50～4-52；異常不等於已確認事件 |
| 大量、高維資料 | 用隨機切割避免全距離計算 | 科3 4-51；仍受特徵品質影響 |
| 零售罕見退貨模式（補充） | 人工複查清單 | 合法少見客群也可能被標出 |
| 能源耗用突變（補充） | 篩出待查時段 | 極端天氣可能是真實正常負載 |

## 常見誤解

- 單一路徑短就是故障：模型提供異常候選，故障原因要查核。
- 所有 API 都越大越異常：scikit-learn 的 score_samples 方向相反。（補充）
- contamination 就是新資料真實異常率：它設定訓練切點，不保證未知分布比例。（補充）

## 進階

### 參考來源

- guide-3:4-50、guide-3:4-51、guide-3:4-52：隨機切割、平均路徑、場景與限制。
- [IsolationForest API](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)：分數方向、offset 與 predict。
- [Novelty and Outlier Detection](https://scikit-learn.org/stable/modules/outlier_detection.html)：訓練與新樣本角色。
- [Isolation Forest 教學例](https://scikit-learn.org/stable/auto_examples/ensemble/plot_isolation_forest.html)：分數與邊界分開觀察的思路。

## 小結

- 少見且偏遠的樣本通常更容易被隨機切割孤立。
- 森林整合多棵樹，減少單一切割的偶然性。
- 先查分數方向，再分清排序、門檻與真實事件。
