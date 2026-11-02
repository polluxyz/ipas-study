---
id: nonlinear-embedding
title: t-SNE 與 UMAP 非線性嵌入比較
kind: technique
codes:
  - L21301
  - L23202
  - L23301
aliases:
  - Nonlinear Embedding
  - Perplexity
  - UMAP
  - UMAP 降維
  - Uniform Manifold Approximation and Projection
  - nonlinear-dimensionality-reduction
  - t-SNE
  - t-SNE 與 UMAP 的嵌入用途
  - t-SNE 與 UMAP 視覺化降維
  - t-SNE 視覺化
summary: t-SNE 與 UMAP 把鄰近結構嵌入低維，讀圖須保留距離與新樣本限制
requires:
  - feature-scaling
  - neighbor-search-index
guide_refs:
  - guide-1:5-5
  - guide-3:4-45
  - guide-3:4-46
  - guide-3:4-47
  - guide-3:5-6
goals:
  - id: g1
    text: 比較 t-SNE 鄰近機率／KL 與 UMAP 鄰域圖機制
  - id: g2
    text: 以同資料多設定判讀群形及局部、全域結構限制
  - id: g3
    text: 區分視覺探索、樣本外 transform 與重新擬合的建模條件
formula_groups:
  - id: tsne-kl
    source: https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一對點在高維鄰近機率 p=0.4，低維 q=0.1。t-SNE 的主要目標與判讀何者正確？
    options:
      A: 直接令所有高低維歐氏距離完全相等，以免群形改變
      B: 最小化分類交叉熵，讓參考弧形標籤的準確率最高
      C: 以 KL 衡量分布差異，原本鄰近的點分太開會有代價
      D: 以固定半徑生成群號，沒有歸群的點一律標成雜訊
    answer: C
    explain:
      A: 嵌入不能保證所有距離相等。
      B: 無標籤 t-SNE 不以分類標籤訓練。
      C: p 相對大、q 太小會增加 KL 中該配對的代價。
      D: 這是密度分群的輸出思路。
  - id: c2
    goal: g1
    type: choice
    prompt: UMAP 在 120 筆資料中建局部鄰域並給邊連結強度，下一步的主要機制為何？
    options:
      A: 取三個變數的平均，形成固定線性投影
      B: 切出兩個中心，再讓各點靠最近中心
      C: 保留所有點對原距離，禁止嵌入變形
      D: 調低維座標，使模糊鄰域連結較一致
    answer: D
    explain:
      A: UMAP 不是取平均的線性投影。
      B: 它不以 K-means 中心作目標。
      C: 低維不能保證保留全部原距離。
      D: 以高低維模糊圖的交叉熵目標調整連結結構。
  - id: c3
    goal: g2
    type: choice
    prompt: 固定同一資料與種子，把 t-SNE perplexity 從 5 改 30，圖上兩群空白變大。能下什麼結論？
    options:
      A: 只能先看鄰域穩定性，空白不等於原空間群間距離
      B: 可以直接說原始客群距離變大，資料本身已有變化
      C: 可以直接說分類準確率提升，因兩群在圖上更清楚
      D: 可以直接說真實群數增加，因參數代表指定群個數
    answer: A
    explain:
      A: 圖形受設定影響，須回原空間或獨立評估核對。
      B: 原始資料固定，改的是低維布局。
      C: 嵌入圖不是獨立分類評估。
      D: perplexity 不是指定群數。
  - id: c4
    goal: g3
    type: choice
    prompt: UMAP 只用正常 80 筆 fit，再對未知 40 筆 transform，實測舊座標最大變化為 0。哪種解讀合適？
    options:
      A: 模型已把 40 筆學進訓練圖，下次可保證完全相同
      B: 新點放進既有表示，這一步未更新原訓練點座標
      C: 資料漂移已自動消除，因此不必再檢查輸入分布
      D: 它等同於對 120 筆重新 fit，連舊點都重新安排
    answer: B
    explain:
      A: transform 並未等同模型更新。
      B: 這是樣本外轉換；不等於加入訓練圖後重新學習。
      C: 新分布不一定能被既有表示合理涵蓋。
      D: 重新 fit 會重新安排整體表示。
  - id: c5
    goal: g3
    type: choice
    prompt: 要用 3 欄特徵的 2D 嵌入訓練分類器，部署還會收到新資料。哪項設計較合理？
    options:
      A: 先用全資料 fit t-SNE，分類器驗證時直接引用全圖
      B: 每批新資料另 fit UMAP，分類器沿用舊平面座標
      C: 在訓練摺 fit 可轉換表示，再用同模型轉換驗證與新資料
      D: 只要 2D 圖分得開，就可省略分類驗證與測試切分
    answer: C
    explain:
      A: 全資料 fit 會讓驗證資料參與表示學習。
      B: 分開 fit 的座標系不可直接沿用舊分類器。
      C: 還須比較原特徵／PCA 基準並用獨立資料評估。
      D: 視覺分離不等於預測泛化成功。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

零售有頻次、金額、退貨率，設備有振動、溫度、電流；欄位更多時更難直接觀察。非線性嵌入（nonlinear embedding）把樣本放到低維座標，幫助探索鄰近結構。

t-SNE 與 UMAP 都常用於視覺探索。圖形分離，還不是分類成功的證據。

英文全名分別是 t-distributed Stochastic Neighbor Embedding 與 Uniform Manifold Approximation and Projection。

## 直覺

t-SNE 把高維相似性變成鄰近機率，再移動低維座標，讓兩邊的機率分布較一致。UMAP 先建立帶連結強度的局部鄰域圖，再調整低維點位去近似這張圖。

![兩條路都從高維鄰近出發：t-SNE 比較機率分布，UMAP 比較模糊鄰域連結。](figure:l23202-nonlinear-embedding-mechanism)

![上圖看甲乙由近到遠造成的機率差；下圖的邊取自八點 UMAP 鄰域圖，圓周布局只為方便看連結。](figure:l23202-nonlinear-embedding-neighbors)

保留局部鄰近，不等於保留所有群間距離。把原空間壓進平面可能改變群形、大小與空白；UMAP 也不能被當成保證全域距離的等比例地圖。

## 定義與公式

t-SNE 在高維使用高斯相似性，在低維使用較重尾的 t 分布相似性，以 Kullback–Leibler（KL）散度作為調整目標。重尾有助於緩和許多近鄰擠在低維狹小區域的問題。

UMAP 建立局部連結及模糊強度，並以高低維模糊圖的交叉熵目標調整座標。連結強度不等於分類機率，兩種方法也不是同一個損失函數。

### t-SNE 的機率與 KL（補充）

$$
\begin{aligned}
p_{j|i}&=\frac{\exp(-\lVert x_i-x_j\rVert^2/(2\sigma_i^2))}
{\sum_{k\ne i}\exp(-\lVert x_i-x_k\rVert^2/(2\sigma_i^2))}\\
p_{ij}&=\frac{p_{j|i}+p_{i|j}}{2n}\\
q_{ij}&=\frac{(1+\lVert y_i-y_j\rVert^2)^{-1}}
{\sum_{k\ne l}(1+\lVert y_k-y_l\rVert^2)^{-1}}\\
\mathrm{KL}(P\Vert Q)&=\sum_{i\ne j}p_{ij}\ln\frac{p_{ij}}{q_{ij}}
\end{aligned}
$$

$x_i$ 是高維點，$y_i$ 是低維點，n 為樣本數；$\sigma_i$ 是高維局部帶寬。i≠j 且對角設 0；$p_{ij},q_{ij}$ 都對有方向的非自身配對正規化，總和各為 1。

$p_{j|i}$ 是給定點 i 時選到點 j 的條件鄰近機率；$P,Q$ 分別是由 $p_{ij},q_{ij}$ 組成的聯合配對分布。這裡要求 $n\geq2$ 且每個 $\sigma_i>0$。

p 大的配對若在平面被分太開，q 變小，就提高該項代價。perplexity（困惑度）影響局部帶寬及有效鄰域尺度，不是指定群數；本例會實算三點的機率與 KL。

代入 x=(0,1,4)、y=(0,3,4)、三個帶寬皆為 1：第一對的 p≈0.330244、q≈0.075893。六個有方向配對的機率各自加總為 1，整體 KL≈0.674510。

### 設定如何改變圖

| 設定 | 影響 | 不應解讀成 |
|---|---|---|
| t-SNE perplexity | 局部與較廣鄰近的尺度 | 預設的群數 |
| UMAP n_neighbors（補充） | 建鄰域圖的範圍 | 真實類別數 |
| UMAP min_dist（補充） | 低維點可聚緊的程度 | 原始資料的最短距離 |
| random_state | 隨機過程的重現條件 | 所有版本或設定都同圖 |

## 走一次流程

### 同一份資料，只改一項設定（補充）

共用 JSON 各有零售、設備 120×3 筆數值。先對各自三欄標準化，兩方法使用完全相同的矩陣；本段只探索全體結構，沒有宣稱獨立預測評估。

兩法都固定種子 42、2D 與歐氏距離。其餘設定如下，各自只改一個參數：

| 方法 | 固定設定 | 變動參數 |
|---|---|---|
| t-SNE | random 初始化、learning_rate=100、1000 輪 | perplexity=5／30 |
| UMAP | min_dist=0.1、300 輪 | n_neighbors=5／30 |

![零售同一矩陣的四次實際嵌入：先比較同色近鄰是否連在一起，不比較各圖的空白距離。](figure:l23202-nonlinear-embedding-retail)

圖色僅供核對原始教學弧形，沒有提供給模型。每幅圖的軸均無物理單位，且各自縮放；不能看圖上兩群相距幾公分就推論原空間距離。

![設備也用相同設定做四次嵌入：小鄰域可能碎裂，大鄰域改變整體布局，結果依資料而定。](figure:l23202-nonlinear-embedding-equipment)

零售 t-SNE 在 perplexity 5／30 的 KL 約為 0.190526／0.145852。目標機率也隨 perplexity 改變，不能直接以這兩個損失選分類器。

### 新樣本要放進哪張圖（補充）

第二個實驗只以正常 80 筆擬合縮放及 UMAP，再轉換未知 40 筆。另一路固定相同縮放，把 120 筆一起重新 fit；這是方法比較，不拿未知資料重擬合後當作獨立測試。

![transform 在既有表示加入新點；重新 fit 會重新安排全體，不能沿用舊圖上的分類器。](figure:l23202-nonlinear-embedding-new)

本機實測 transform 前後舊訓練座標的最大變化為 0。重新 fit 的舊點，即使對齊平移、旋轉與尺度仍有差異；不能只比較未對齊的原始座標差。

## 程式

### 先算鄰近機率與 KL（補充）

三點高維一維切片用共用例子的甲、乙、丙 0、1、4，低維暫放在 0、3、4。此段固定帶寬 1，目的是核對機制，不是假裝完成 perplexity 搜尋或完整 t-SNE 最佳化。

```python
import numpy as np
x, y = np.array([0., 1., 4.]), np.array([0., 3., 4.])
d2 = (x[:, None] - x[None, :]) ** 2
weights = np.exp(-d2 / 2)
np.fill_diagonal(weights, 0)
conditional = weights / weights.sum(axis=1, keepdims=True)
p = (conditional + conditional.T) / (2 * len(x))
q = 1 / (1 + (y[:, None] - y[None, :]) ** 2)
np.fill_diagonal(q, 0)
q /= q.sum()
mask = ~np.eye(len(x), dtype=bool)
kl = np.sum(p[mask] * np.log(p[mask] / q[mask]))
print("p01/q01", round(p[0, 1], 6), round(q[0, 1], 6))
print("p02/q02", round(p[0, 2], 6), round(q[0, 2], 6))
print("總和", round(p.sum(), 6), round(q.sum(), 6), "KL", round(kl, 6))
```
```text
p01/q01 0.330244 0.075893
p02/q02 0.004978 0.044643
總和 1.0 1.0 KL 0.67451
```

### 實際執行兩方法、兩設定（補充）

完整程式分為讀資料與嵌入迴圈。兩段依序執行，共享 raw、x、TSNE 與 UMAP；輸出是固定環境的結果，套件或平台更動時浮點結果可能改變。

從專案根目錄執行。實測工具若切到暫存區，先將環境變數 IPAS_REPO_ROOT 設為專案根目錄；本組程式都讀同一個例子檔。

```python
import json, os
from pathlib import Path
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import TSNE
from umap import UMAP
root = Path(os.environ.get("IPAS_REPO_ROOT", "."))
data = json.loads((root / "content/examples/L23202-C-shared.json").read_text(encoding="utf-8"))
raw = np.array(data["domains"]["retail"]["raw"])
x = StandardScaler().fit_transform(raw)
print("共同輸入", x.shape, "種子", 42)
```
```text
共同輸入 (120, 3) 種子 42
```

```python
for perplexity in [5, 30]:
    m = TSNE(n_components=2, perplexity=perplexity, init="random",
             learning_rate=100, max_iter=1000, random_state=42)
    z = m.fit_transform(x)
    print("t-SNE", perplexity, z.shape, "KL", round(m.kl_divergence_, 6))
for neighbors in [5, 30]:
    m = UMAP(n_neighbors=neighbors, min_dist=0.1, n_components=2,
             random_state=42, transform_seed=42, n_jobs=1, n_epochs=300)
    z = m.fit_transform(x)
    print("UMAP", neighbors, z.shape, "圖邊項", m.graph_.nnz)
```
```text
t-SNE 5 (120, 2) KL 0.190526
t-SNE 30 (120, 2) KL 0.145852
UMAP 5 (120, 2) 圖邊項 562
UMAP 30 (120, 2) 圖邊項 4198
```

圖邊項計算稀疏矩陣儲存的有方向非零項，不是去重邊數。此資料的 UMAP 鄰域圖隨 n_neighbors 擴大而有更多連結；它不是 DBSCAN 的固定半徑圖。

### 實測 transform 與重新擬合（補充）

```python
from scipy.spatial import procrustes
tr, te = data["train_indices"], data["test_indices"]
scaler = StandardScaler().fit(raw[tr])
a, b = scaler.transform(raw[tr]), scaler.transform(raw[te])
settings = dict(n_neighbors=15, min_dist=0.1, random_state=42,
                transform_seed=42, n_jobs=1, n_epochs=300)
m = UMAP(**settings).fit(a)
old = m.embedding_.copy()
new = m.transform(b)
refit = UMAP(**settings).fit_transform(np.vstack([a, b]))
_, _, disparity = procrustes(old, refit[:len(a)])
print("新座標", new.shape, "舊點變化", float(np.max(np.abs(old - m.embedding_))))
print("重擬合對齊後差異", round(disparity, 6))
print("TSNE 有 transform", hasattr(TSNE(), "transform"))
print("UMAP 有 update", hasattr(m, "update"))
```
```text
新座標 (40, 2) 舊點變化 0.0
重擬合對齊後差異 0.052568
TSNE 有 transform False
UMAP 有 update True
```

:::tip[讀碼重點]
transform 映入既有表示；update 調整模型；fit 則重新學表示。本頁只檢查 update 是否存在，不把 transform 當成增量訓練。
:::

## 怎麼用、怎麼判讀

指引強調 t-SNE、UMAP 的視覺探索用途。圖上近鄰有參考價值，群間空白、群大小與群數則需回原空間、不同設定與業務資料查核。

t-SNE 樣本多時成本較高；指引指出 UMAP 通常較快，可處理較大的資料。實際速度仍受資料規模、設定及實作影響，不能把「通常」當成保證。

科3 指引 4-47 將支援增量學習列為 UMAP 的優點，但沒有指定 API。

### 視覺化與下游表示

| 方法 | 典型用途 | 新樣本與限制 |
|---|---|---|
| PCA | 線性壓縮、視覺化 | 可沿用已學線性轉換 |
| t-SNE | 局部鄰近探索 | 指引提醒新資料映射受限 |
| UMAP | 非線性鄰域探索 | 參數與隨機過程會影響圖形 |
| UMAP 下游表示（補充） | 可驗證的特徵轉換候選 | 必須 fit 於訓練資料，再 transform 驗證／新資料 |

:::supplement[來源：UMAP Transforming New Data；scikit-learn TSNE API]
科3 5-6 提醒不宜直接拿視覺化結果預測；umap-learn 則提供 transform。做下游建模時，仍須在交叉驗證內學縮放與表示，並和原特徵／PCA 比較。

新分布若偏離訓練資料，能呼叫 transform 不代表表示仍合理。重新 fit 後座標系改變，下游分類器也要依新表示重訓及重驗證。

若要把新資料納入模型更新，umap-learn 提供 update；transform 只把新點放進既有表示。

本頁只實測 transform 與重新 fit，沒有把檢查 update 存在當成更新成功的實測。
:::

### 換個場景

| 場景 | 用途 | 判讀重點 |
|---|---|---|
| 高維資料分布探索 | 找值得追查的鄰近結構 | 科1 5-5、科3 5-6；不直接宣告分類成功 |
| 複雜非線性群集 | 觀察局部關係 | 科3 4-46～4-47；參數會改變呈現 |
| 零售行為（補充） | 查客群候選與少見模式 | 圖上分開不代表流失可被預測 |
| 設備運轉（補充） | 探索負載模式 | 新負載應查分布漂移與表示穩定性 |

## 常見誤解

- 兩群相隔兩倍遠，原空間也遠兩倍：低維群間距離沒有這種比例保證。
- UMAP 必定完整保留全域結構：局部與較廣連結都受資料及參數影響。
- transform 就是在模型加入新資料學習：轉換、update 與重新 fit 是不同操作。（補充）
- 圖上看出兩群就有高分類準確率：仍需要獨立預測驗證。

## 進階

### 收錄理由與版本（補充）

機率公式、UMAP 參數與樣本外實測，是理解機制及下游限制的核心延伸。

實測版本為 scikit-learn 1.9.1、umap-learn 0.5.12、NumPy 2.5.4。改變版本或平台時，浮點結果可能不同。

### 參考來源

- guide-1:5-5；guide-3:4-45～4-47、guide-3:5-6：定義、KL／鄰域圖、探索用途與限制。
- [t-SNE 原論文](https://www.jmlr.org/papers/volume9/vandermaaten08a/vandermaaten08a.pdf)：第2～3節的高低維機率與 KL 公式。
- [TSNE API](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html)：perplexity 及樣本外 API。
- [How UMAP Works](https://umap-learn.readthedocs.io/en/latest/how_umap_works.html)：模糊鄰域圖與嵌入機制。
- [UMAP 參數教學](https://umap-learn.readthedocs.io/en/latest/parameters.html)：n_neighbors／min_dist 的對照思路。
- [UMAP 新資料教學](https://umap-learn.readthedocs.io/en/latest/transform.html)、[API](https://umap-learn.readthedocs.io/en/latest/api.html)：transform、update 與下游條件。
- [UMAP.update 實作](https://umap-learn.readthedocs.io/en/latest/_modules/umap/umap_.html#UMAP.update)：新資料納入模型更新，與 transform 分開判讀。
- [How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/)：群大小、群間空白與參數敏感的誤讀提醒。

## 小結

- t-SNE 比較高低維機率；UMAP 近似模糊鄰域連結。
- 同資料、同種子與單項設定變動，才方便理解圖形差異。
- 局部鄰近有用途，群間空白不是原空間距離尺。
- 樣本外轉換不等於更新；下游模型仍需獨立驗證。
