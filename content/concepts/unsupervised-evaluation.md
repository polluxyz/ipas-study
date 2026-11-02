---
id: unsupervised-evaluation
title: 非監督學習的評估方法
kind: technique
codes: [L23201]
aliases: [Adjusted Mutual Information, Rand Index, 分群評估, 重建誤差]
summary: 依可用標籤與學習目標選擇結構、標籤一致性或重建品質的評估
goals:
  - id: g1
    text: 安排縮放與擬合，選擇內部、外部及重建評估，辨識投影限制
requires: [unsupervised-learning]
guide_refs: [guide-3:4-8, guide-3:4-9]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 24 位顧客都沒有客群答案，團隊比較兩種分群；另有六人經人工確認類別。哪個安排正確？
    options:
      A: 把模型群編號當成全部 24 人的真實答案，算準確率
      B: 全體可看輪廓係數與 DB，六人子集另用 Rand 或 AMI 比較參考標籤
      C: 沒有完整標籤，所以任何評估都不能做
      D: 對所有樣本算 Rand，只要把未知答案填成 0 即可
    answer: B
    explain:
      A: 群編號不是經確認的類別，拿輸出當真值會形成自我驗證。
      B: 內部指標不需參考答案，外部指標則只比較同一批有標籤樣本。
      C: 無標籤時仍可檢查幾何結構或重建品質。
      D: 未知不是類別 0，這會把缺答案的人錯當同類。
  - id: c2
    goal: g1
    type: choice
    prompt: 候選甲的輪廓係數 0.72、DB 0.38；候選乙是 0.60、0.48。兩者使用相同 24 筆資料、尺度與距離。何者正確？
    options:
      A: 乙的 DB 為 0.48，大於甲的 0.38，因此兩項指標都支持乙
      B: 甲的輪廓係數為 0.72，代表採用甲就能使行銷收益提高 72%
      C: 兩項幾何指標都支持甲，仍須查核群組用途與穩定性
      D: 把輪廓係數與 DB 相加，總分越高就越好
    answer: C
    explain:
      A: DB 越低越好，甲的 0.38 優於乙的 0.48；輪廓係數也是甲較高。
      B: 0.72 描述幾何分離與緊密程度，不能換算成行銷收益增加的比例。
      C: 資料、尺度與距離相同時，甲的輪廓係數較高且 DB 較低，但用途與穩定性仍須另查。
      D: 兩項指標的方向與量尺不同，沒有約定轉換或權重時不能直接相加取最大。
  - id: c3
    goal: g1
    type: choice
    prompt: 要把 16 筆設備紀錄當訓練集、4 筆驗證、4 筆測試，日後替新設備分群。哪個流程最合理？
    options:
      A: 先對全部 24 筆擬合縮放，再切開以免浪費資料
      B: 只要 2D 圖上分得開，就不用檢查原特徵或其他指標
      C: 每次看完測試結果都調群數，最後仍稱為獨立測試
      D: 訓練集學縮放與群中心，驗證集挑設定，測試集最後檢查
    answer: D
    explain:
      A: 測試資料會影響縮放參數，與評估新設備的目標不符。
      B: 投影可能遺失或改變距離結構，不能單靠圖形判定原空間品質。
      C: 測試結果參與選設定後，就不再是獨立的最終評估。
      D: 前處理與擬合限制在訓練資料，可保留後續資料的評估角色。
---

## 為什麼需要

沒有標籤時，不能直接問「模型答對幾筆」。但仍能問：群內是否相近？壓縮後能還原多少資訊？少量參考標籤與分群是否一致？

這些問題需要不同評估方法。評估訊號若與任務不相符，即使數字漂亮，也可能沒有回答使用者真正關心的問題。

## 直覺

內部評估使用特徵、模型輸出或重建結果。外部評估則把同一批樣本的分群與參考標籤比較，不能把缺少的答案當作正常類別。

內部方法有輪廓係數、Davies–Bouldin 與重建誤差；外部則有 Rand Index、調整後互資訊（Adjusted Mutual Information，AMI）。

## 定義與公式

指引列出方法名稱；以下補足用途與方向。本頁先學選用，輪廓係數的距離與公式另見該頁。

### 五種訊號回答什麼

方法名稱與內部／外部分類沿用指引；表內的方向與問題說明依 scikit-learn 文件補充。

| 方法 | 分類與需要的資料 | 方向（補充） | 回答的問題（補充） |
|---|---|---|---|
| 輪廓係數 | 內部：特徵／距離、群編號 | 越高越好 | 點與本群是否比鄰群更相近 |
| Davies–Bouldin 指數（DB） | 內部：特徵、群編號 | 越低越好 | 群內散布相對於群中心間距是否小 |
| 重建誤差 | 內部：原資料與還原資料 | 同條件下越低越好 | 壓縮或編碼丟掉多少資訊 |
| Rand Index | 外部：參考標籤、群編號 | 越接近 1 越一致 | 每對樣本的同群／異群關係是否一致 |
| AMI | 外部：參考標籤、群編號 | 越接近 1 越一致 | 扣除偶然一致後，兩種分組共享多少資訊 |

:::supplement[來源：scikit-learn Clustering 2.3.11；MSE API]
Rand Index 介於 0 與 1，但沒有扣除偶然一致。AMI 的隨機分組期望值接近 0，也可能為負；兩者都不受群編號重新命名影響。

重建誤差不是分群專用指標。例如把輸入壓成低維，再還原回原欄位，用同一量尺比較差距；它不直接表示群分得好，也不保證分類準確。
:::

## 走一次流程

1. 決定要探索目前這批資料，還是把學到的結構套到未來資料。（補充）
2. 準備特徵；依尺度選擇縮放或中心化。
3. 設定模型與超參數，例如群數；以固定條件擬合。
4. 若模型依賴初始化，重複擬合並觀察結果。
5. 依標籤有無與學習目標，選內部、外部或重建評估。
6. 加上 2D／3D 視覺檢視，查核群組與異常。

:::supplement[來源：scikit-learn Common pitfalls 12.2]
若目標是評估未來資料，先做資料分割。只讓訓練集學縮放參數與模型，驗證、測試集沿用相同轉換；測試集不能參與挑群數。

若只是描述手上這批資料，可以對全批擬合，但結果只代表本批結構，不能宣稱已驗證未來表現。
:::

### 若改成預測新設備（補充）

共用製造資料另備 16／4／4 的固定訓練、驗證、測試索引。先只用 16 筆學縮放與群中心，再替 4 筆驗證設備指派群，測試資料最後才使用。

送入 StandardScaler 的工程換算座標，其訓練集均值為 (4.5625, 4.8125)，不是原始溫度與振動的均值。

三群 KMeans（`n_init=10`、`random_state=42`）將驗證 M15、M23、M03、M05 分為 1、2、0、0；群編號仍不代表故障。

這段展示資料角色，與下一段對全體 24 筆人工候選的描述性比較不同。四筆測試樣本仍保留，不拿它們挑群數。

### 用同一批顧客比較（補充）

共用電商資料有 24 筆固定座標。以下候選群是人為指定，目的是比較評估訊號，不是宣稱某演算法已成功找回真相。

| 候選 | 群大小 | 輪廓係數 | DB |
|---|---|---:|---:|
| 分開三群 | 8、8、8 | 0.7167 | 0.3814 |
| 合併前兩群 | 16、8 | 0.6019 | 0.4829 |
| 交錯混成兩群 | 12、12 | -0.0444 | 7.8205 |

在相同座標與歐氏距離下，三群候選的幾何品質較好。揭開教學參考群後，合併候選的 Rand Index 為 0.7681、AMI 為 0.7183；分開三群則都是 1。

外部評估使用的參考群沒有進入擬合。如果只有部分人有答案，只能在該子集對齊索引後比較，也須注意它是否代表全體。

## 程式（補充）

重建 JSON 的相同 24 筆電商座標。第一段只用特徵與候選群，沒有讀入參考標籤。

```python
import numpy as np
from sklearn.metrics import silhouette_score, davies_bouldin_score
offset = np.array([[0,0], [0,2], [1,0], [1,2], [0,1], [1,1], [0,3], [1,3]])
X = np.vstack([offset + [c, 1] for c in [1, 7, 13]])
candidates = [np.repeat([0,1,2], 8), np.repeat([0,0,1], 8),
              np.tile([0,1,0,1,0,1,0,1], 3)]
for name, labels in zip(["分開", "合併", "交錯"], candidates):
    s = silhouette_score(X, labels, metric="euclidean")
    db = davies_bouldin_score(X, labels)
    print(f"{name} 輪廓={s:.4f} DB={db:.4f}")
```
```text
分開 輪廓=0.7167 DB=0.3814
合併 輪廓=0.6019 DB=0.4829
交錯 輪廓=-0.0444 DB=7.8205
```

再揭開教學參考群，對合併候選作外部比較。重建例則只保留第二軸，把第一軸填回平均值，是刻意簡化的壓縮，不是 PCA。

```python
from sklearn.metrics import rand_score, adjusted_mutual_info_score
reference = np.repeat([0, 1, 2], 8)
merged = candidates[1]
print(f"Rand={rand_score(reference, merged):.4f}")
print(f"AMI={adjusted_mutual_info_score(reference, merged):.4f}")
reconstructed = X.astype(float).copy()
reconstructed[:, 0] = X[:, 0].mean()
print(f"兩欄平均重建平方誤差={np.mean((X-reconstructed)**2):.4f}")
```
```text
Rand=0.7681
AMI=0.7183
兩欄平均重建平方誤差=12.1250
```

:::tip[讀碼重點]
`labels` 是候選分群輸出，不是讓模型學習的真實類別。兩欄平均的重建誤差與只平均第一欄會不同，回報時須固定欄位與量尺。
:::

## 怎麼用、怎麼判讀

### 圖形只能輔助

指引用 2D／3D 投影輔助理解高維結果。下圖用本來就有的兩個特徵，示範丟掉一軸會發生什麼事。

![保留金額軸卻刪除訂單次數軸後，原本分開的三群重疊，投影不保證保留原空間距離。](figure:l23201-unsupervised-evaluation-projection)

:::supplement[來源：scikit-learn PCA API 的 transform、inverse_transform]
E01 與 E09 在原座標相距 6，投影後都位於金額換算值 1。刪除資訊可以改變鄰近關係；高維降成 2D 也須回原特徵或適當距離驗證。
:::

### 換個場景

指引的資料條件是「無標籤」或「只有部分標籤」，並列出群結構、重建與視覺化評估；沒有替每項指標限定產業。

| 場景 | 評估訊號 | 判讀重點 |
|---|---|---|
| 顧客探索（補充） | 輪廓係數、DB，另查活動回應 | 幾何分群好不保證行銷有效 |
| 製造壓縮（補充） | 固定感測欄位的重建誤差 | 特徵尺度與重要訊號是否一致 |
| 文件分群（補充） | 有標籤子集的 Rand／AMI | 子集是否代表全體，距離是否適合文字 |

### 比較前固定條件（補充）

同一資料、特徵、尺度與距離下比較候選，才容易解讀差異。換成別的表示，分數改善可能來自幾何改變，不能只歸功於分群演算法。

也要看各群大小、每群分數與不同初始化的穩定性。輪廓係數與 DB 偏好緊密分離的群，不一定公平評價彎曲或密度型群集。

## 常見誤解

- 沒有答案就不能檢查品質：內部與重建評估仍可提供訊號。
- AMI 的 0 就是完全不一致：它的基準是扣除偶然一致後的水準。（補充）
- 投影圖漂亮就證明原空間分群好：資訊與距離可能已改變。（補充）

## 進階

### 參考來源

- 科目 3 指引（版本未標示），guide-3:4-8、4-9：支持前處理到擬合流程、五個評估名稱與投影輔助用途。
- [scikit-learn Clustering 2.3.11](https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation)：支持內外部指標用途、方向與群形限制。
- [Rand API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.rand_score.html)、[AMI API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.adjusted_mutual_info_score.html)：支持值域、偶然一致修正與編號置換不變性。
- [scikit-learn Common pitfalls 12.2](https://scikit-learn.org/stable/common_pitfalls.html)：支持新資料評估時的前處理隔離。
- [KMeans API](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html)：支持新設備例子的群數、初始化次數與固定種子設定。
- [PCA API](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)、[MSE API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_squared_error.html)：支持低維轉換／還原角色與平方重建誤差量尺。
- [輪廓分析教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_silhouette_analysis.html)、[偶然一致修正教學](https://scikit-learn.org/stable/auto_examples/cluster/plot_adjusted_for_chance_measures.html)：參考同資料比較候選、同時看群大小與分數的教法。

## 小結

- 無標籤看內部或重建品質，有參考標籤再加外部比較。
- 輪廓係數越高、DB 越低，表示相同幾何條件下分群較清楚。（補充）
- 投影只作輔助，評估目標、量尺與資料角色要固定。（補充）
