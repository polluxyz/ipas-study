---
id: silhouette-score
title: 輪廓係數
kind: metric
codes: [L23201]
aliases: [Silhouette Score]
summary: 輪廓係數比較同群與鄰群的平均距離，檢查樣本的分群歸屬
goals:
  - id: g1
    text: 計算單點與平均輪廓係數，判斷方向、群數條件及單點群限制
requires: [unsupervised-learning]
guide_refs: [guide-3:4-8]
textbook: v2
author: codex
status: draft
formula_groups:
  - id: euclidean-distance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-B
  - id: distance-silhouette
    source: https://scikit-learn.org/stable/modules/clustering.html#silhouette-coefficient
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某位顧客到同群其他人的平均距離 a=2，到最近另一群所有人的平均距離 b=6。單點輪廓係數是多少？
    options:
      A: 約 0.667，表示這個點與本群較相近
      B: 約 0.333，因為只要計算 a 除以 b
      C: 等於 2，因為用 b 減 a 再除以 a
      D: 約 −0.667，表示本群平均距離較小時要給負值
    answer: A
    explain:
      A: 使用差距除以兩個平均距離的最大值，得到 4 除以 6。
      B: 只算距離比值沒有完成輪廓係數的差距計算。
      C: 分母應是 a 與 b 中較大的值，不能任選較小者。
      D: 同群距離較小會使 b 減 a 為正，因此不是負分。
  - id: c2
    goal: g1
    type: choice
    prompt: 四筆資料的候選群為 [0,0,0,1]，最後一群只有一筆。使用 scikit-learn 計算時，何者正確？
    options:
      A: 單點群沒有內部差距，所以該點一定得 1
      B: 因為有單點群，整批四筆的輪廓係數一定不能算
      C: 實際群數為 2，整批可算；單點群的該點以 0 處理
      D: 先把每筆改成不同群，會讓指標最容易計算
    answer: C
    explain:
      A: 沒有同群其他點不能被當作完美分離，實作約定給 0。
      B: 實際群數符合 2 到 n 減 1 的條件，可以包含單點群。
      C: 兩群且四筆符合群數條件，scikit-learn 對單點群設該點輪廓為 0。
      D: 四筆各自一群會讓群數等於樣本數，超出可用條件。
  - id: c3
    goal: g1
    type: choice
    prompt: 顧客到其他兩群的距離分別為 [1,9] 與 [4,4]；同群平均距離 a=2。應用哪個 b，能否直接與改用另一種特徵尺度的分數比較？
    options:
      A: b=1，取最近的外群單點；改尺度後須檢查距離結構再比較
      B: b=4，先平均各群再取最小；改尺度後須重新解讀比較基準
      C: b=4.5，將四個外群點合併平均；改尺度後須檢查距離結構再比較
      D: b=5，固定取第一個外群；改尺度後須重看距離基準
    answer: B
    explain:
      A: 1 是最近外群單點的距離，b 要比較各外群的平均距離，不能只看最近一人。
      B: 兩個外群的平均距離為 5 與 4，取較小的 4；尺度改變可能改變距離結構，須重看比較基準。
      C: 4.5 是把所有外群點合併後的平均，沒有依群分別求平均再選最近外群。
      D: 第一群平均為 5，但第二群平均為 4 更近，鄰群由距離決定，不能按群順序指定。
---

## 為什麼需要

分群後，有些點位於群內，有些落在兩群交界。只看群數，無法知道每個點是否真的比較接近自己所屬的群。

指引將輪廓係數（Silhouette Score）列為不需真實標籤的內部評估方法。以下公式、距離算例與限制，是把指引名稱展開成可操作的補充。

## 直覺（補充）

對某一個點，先問它離「同群其他點」平均多遠，再問它離「最近的另一群」平均多遠。同群近、鄰群遠，分群歸屬就比較清楚。

![E01 的同群距離只看 E02，鄰群平均則同時計入 E09 與 E10，不能只挑最近的一點。](figure:l23201-silhouette-score-distances)

## 定義與公式（補充）

### 先固定距離

本例用二維歐氏距離（Euclidean distance）：

$$
d(i,j)=\sqrt{(x_{i1}-x_{j1})^2+(x_{i2}-x_{j2})^2}
$$

$i,j$ 是樣本索引；$x_{i1},x_{i2}$ 是樣本 $i$ 的兩個特徵，$j$ 亦同。$d(i,j)$ 表示兩點距離，特徵必須使用固定量尺。

### 同群、鄰群與單點分數

令 $C_i$ 為樣本 $i$ 所在的群，$C$ 為某個其他群，$|C|$ 是群內筆數。非單點群的兩種平均距離定義為：

$$
\begin{aligned}
a(i)&=\frac{\sum_{j\in C_i,\,j\ne i}d(i,j)}{|C_i|-1}\\
b(i)&=\min_{C\ne C_i}\frac{\sum_{j\in C}d(i,j)}{|C|}
\end{aligned}
$$

$a(i)$ 排除自己；$b(i)$ 先對每個其他群算平均，再取其中最小者。它不是最近單點距離，也不是到群中心的距離。

$$
s(i)=\frac{b(i)-a(i)}{\max\{a(i),b(i)\}},\qquad
\bar{s}=\frac1n\sum_{i=1}^{n}s(i)
$$

$s(i)$ 是單點輪廓係數，$n$ 是樣本數，$\bar{s}$ 是整批逐點平均。距離非負且分母非零時，單點分數介於 −1 與 1；值越高，歸屬越清楚。

### 可用條件與邊界

實際形成的群數 $k$ 必須滿足 $2\le k\le n-1$。只有一群找不到鄰群；每筆各一群則沒有同群其他點。

單點群沒有可用的同群平均，scikit-learn 約定其分數為 0，不能把它當成完美群。兩種平均距離都為 0 時，該實作也回傳 0。

## 算一次（補充）

從 24 筆電商資料抽 E01、E02、E09、E10 作獨立手算子集。前兩筆一群，後兩筆另一群；這四筆的結果不等於完整 24 筆的結果。

| 樣本 | 特徵：次數、金額換算值 | 候選群 |
|---|---|---|
| E01 | (1,1) | 0 |
| E02 | (1,3) | 0 |
| E09 | (7,1) | 1 |
| E10 | (7,3) | 1 |

對 E01，先代入歐氏距離：到 E02 是 $\sqrt{0^2+(-2)^2}=2$；到 E09 是 $\sqrt{(-6)^2+0^2}=6$。

到 E10，平方差合計 40，距離 $\sqrt{40}\approx6.3246$。同群平均為 2，鄰群平均為 $(6+\sqrt{40})/2\approx6.1623$。

單點輪廓係數為：

$$
s(\mathrm{E01})=\frac{6.1623-2}{6.1623}\approx0.6754
$$

運算時保留完整精度，這裡只在呈現時取小數。其他三點因位置對稱也都是 0.6754，所以四點平均 $\bar{s}=0.6754$。

若錯用最近外群點距離 6，會得到約 0.6667。這不是本例正確的鄰群平均距離算法。

## 程式（補充）

先算距離矩陣，再分別核對手算與 API。資料固定，不需要亂數。

```python
import numpy as np
from sklearn.metrics import pairwise_distances, silhouette_samples, silhouette_score
X = np.array([[1,1], [1,3], [7,1], [7,3]])
labels = np.array([0, 0, 1, 1])
D = pairwise_distances(X, metric="euclidean")
a, b = D[0, 1], D[0, 2:].mean()
print("E01 距離", np.round(D[0], 4).tolist())
print(f"a={a:.4f} b={b:.4f} s={(b-a)/max(a,b):.4f}")
print("逐點", np.round(silhouette_samples(X, labels), 4).tolist())
print(f"平均={silhouette_score(X, labels):.4f}")
```
```text
E01 距離 [0.0, 2.0, 6.0, 6.3246]
a=2.0000 b=6.1623 s=0.6754
逐點 [0.6754, 0.6754, 0.6754, 0.6754]
平均=0.6754
```

再換成含單點群及兩種非法群數，觀察實作邊界：

```python
single = [0, 0, 0, 1]
print(f"單點群的該點={silhouette_samples(X, single)[-1]:.1f}")
for trial in [[0, 0, 0, 0], [0, 1, 2, 3]]:
    try:
        silhouette_score(X, trial)
    except ValueError:
        print(f"群數={len(set(trial))}，不可計算")
print(f"重合點={silhouette_score(np.zeros((4, 2)), labels):.1f}")
```
```text
單點群的該點=0.0
群數=1，不可計算
群數=4，不可計算
重合點=0.0
```

:::tip[讀碼重點]
`silhouette_samples` 回傳每筆分數，`silhouette_score` 回傳逐點平均。檢查的是實際群編號種類數，不只是模型設定的群數。
:::

## 怎麼用、怎麼判讀（補充）

| 分數 | 距離關係 | 解讀 |
|---|---|---|
| 接近 1 | 同群平均遠小於鄰群平均 | 該點歸屬較清楚 |
| 接近 0 | 同群、鄰群平均接近 | 可能在交界或群重疊 |
| 小於 0 | 同群平均大於鄰群平均 | 可能被放錯群，值得回看 |

負值是幾何上的提醒，不是「業務標籤錯誤」的直接證明。高分也不代表已找出真實的客群、故障類型或最佳群數。

完整 24 筆電商資料的三群候選平均為 0.7167；製造資料則為 0.7190。它們不是同一資料上的方法排名，不能因製造較高就說演算法較好。

### 換個場景

指引僅列內部評估名稱，沒有指定本指標的產業場景；以下是應用延伸。

| 場景 | 比較時固定什麼 | 判讀限制 |
|---|---|---|
| 電商客群 | 同樣的頻次、金額尺度與樣本 | 群清楚不保證促購效果 |
| 製造設備 | 相同工況特徵與距離 | 不同運轉模式未必是故障 |
| 文件語意 | 相同文字表示與距離定義 | 歐氏距離未必適合所有語意向量 |

### 公平比較的條件

同一資料與量尺下比較群數、初始化或模型，並同時查看群大小與各群分數。整體平均按樣本數加權，可能掩蓋小群的低分。

輪廓係數偏好緊密、分離的群，彎曲或密度型群可能分數較低。若分群含雜訊編號 −1，API 會把它當成一個普通群；須先決定是否排除，並回報排除比例。

## 常見誤解（補充）

- 群內平均包含自己：應排除自己，分母才是同群筆數減 1。
- 鄰群距離只看最近的人：要先算每個外群的平均距離。
- 單點群一定完美：實作約定其單點分數為 0。
- 換尺度後仍能直接排名：距離幾何可能改變，比較基準已不同。

## 進階

### 參考來源

- 科目 3 指引（版本未標示），guide-3:4-8：支持內部評估名稱；公式、例子、方向與邊界為補充。
- [scikit-learn silhouette_samples](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_samples.html)、[silhouette_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html)：支持距離、單點與平均定義、群數條件及程式 API。
- [scikit-learn 歐氏距離](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.euclidean_distances.html)、[輪廓係數實作原碼](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/metrics/cluster/_unsupervised.py)：支持二維距離，以及單點群與零分母設為 0 的實作約定。
- [scikit-learn Clustering 2.3.11.5](https://scikit-learn.org/stable/modules/clustering.html#silhouette-coefficient)：支持值域、方向與凸形群偏好。
- [scikit-learn 輪廓分析教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_silhouette_analysis.html)：參考逐群觀察與平均分數共同判讀的教法。

## 小結（補充）

- 先算同群平均 a，再選平均距離最小的外群求 b。
- 用差距除以兩者最大值；正值較清楚，負值值得回查。
- 檢查實際群數、單點群、距離尺度與群大小，再解讀平均。
