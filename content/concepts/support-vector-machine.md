---
id: support-vector-machine
title: 支持向量機
kind: model
codes: [L23202, L21301]
aliases: [SVM, Support Vector Machine, 支援向量機]
requires: [classification-regression, vector-norm-linear-combination]
summary: 支持向量機以支持向量決定分類邊界，兼顧間隔與訓練違規
goals:
  - id: g1
    text: 依資料邊界、維度與規模選擇SVM，說明核方法及尺度限制
  - id: g2
    text: 用超平面、間隔與支持向量解釋分類，判讀C與gamma的取捨
formula_groups:
  - id: hyperplane
    source: guide-3:4-28
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: kernel-decision
    source: guide-3:4-28
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
  - id: geometric-margin
    source: https://cs229.stanford.edu/notes2020spring/cs229-notes3.pdf#page=15
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23202-B
  - id: rbf
    source: https://scikit-learn.org/stable/modules/svm.html#kernel-functions
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23202-B
guide_refs: [guide-1:5-8, guide-1:5-9, guide-3:4-28, guide-3:4-29, guide-3:4-30]
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 有300筆已標註文件、2000個詞特徵，想比較分類邊界；另有300萬筆交易需頻繁重訓。哪個判斷合理？
    options:
      A: 兩者都只選RBF SVM，因為高維資料保證核模型訓練最快
      B: 兩者都排除所有SVM，因為特徵多於樣本就無法分類
      C: 前者只選KNN且不縮放，因為高維不會影響近鄰距離
      D: 前者可列SVM為候選，後者需另查樣本量帶來的訓練成本
    answer: D
    explain:
      A: 高維能力不代表大樣本的核矩陣與優化成本低。
      B: SVM可以處理特徵數大於樣本數的情況，仍需正則化與驗證。
      C: KNN仍受高維與尺度影響，不能用這個理由排除SVM。
      D: 維度與樣本量是不同條件，應分別比較合適性與資源成本。
  - id: c2
    goal: g2
    type: choice
    prompt: 指定線性SVM為f(x)=−x₁+x₂−1，兩側間隔線是f=−1與f=1。兩條線的垂直總寬為何？
    options:
      A: "總寬為1／√2，這是兩條間隔線之間的距離"
      B: "總寬為2／√2，約1.414個座標距離單位"
      C: "總寬為2，因為兩條線的分數差正好是2"
      D: "總寬為4／√2，約2.828個座標距離單位"
    answer: B
    explain:
      A: 1除以權重範數是單側寬度，不是兩側總寬。
      B: 權重範數為√2，總間隔寬度為2除以√2。
      C: 分數差要除以權重範數，才是幾何距離。
      D: 這把已含兩側的總間隔再乘2，多算了一倍。
  - id: c3
    goal: g2
    type: choice
    prompt: 同54筆金融訓練資料，RBF SVM的C=10、gamma=10時訓練54筆全對，驗證僅12／18。怎麼判讀？
    options:
      A: 訓練54筆全對，足以證明驗證結果較差只是標籤都錯
      B: gamma越大影響範圍越廣，所以模型一定比低gamma平滑
      C: 模型可能過度追隨局部樣本，應在訓練內比較較平滑設定
      D: 改用最後測試資料調整C，直到測試分數也達到全部正確
    answer: C
    explain:
      A: 訓練滿分不能證明驗證標籤有錯，也不能保證泛化。
      B: RBF的gamma越大，單點的影響範圍通常越局部。
      C: 高C與高gamma可能形成細碎邊界，應用驗證流程檢查取捨。
      D: 測試集不能反覆參與參數選擇。
---

## 為什麼需要

能把兩類分開的直線可能有很多條。支持向量機（SVM，英文為Support Vector Machine）還會比較邊界附近的空間，盡量留下較寬的間隔（margin）。

實際資料有重疊或噪聲時，也要容許部分違規。指引把SVM列為高維與中小型資料的候選，同時提醒大樣本的計算成本。

## 直覺

先看一個問題：能把兩類分開的直線，通常不只一條。

![A、B、C都分得開；C離兩類最近的點都最遠，這就是SVM要的線。](figure:l23202-support-vector-machine-candidates)

貼著某一類畫的線，新資料只要稍微偏一點就會被分錯。SVM的想法是在兩類之間鋪一條道路，並讓道路盡量寬；分類邊界就是道路的中線。

道路能鋪多寬，只看最靠近道路的那幾個點，這些點叫支持向量。其他點離道路夠遠，稍微移動也不會改變道路。

![兩個黑圈點碰到道路邊緣；雙箭頭垂直於邊界，量出道路寬度約1.41。](figure:l23202-support-vector-machine-margin)

上圖的兩個支持向量就是下方「算一次」用的F020與F028；其他點是教學合成點。道路寬度要沿著垂直於邊界的方向量，不是看圖上上下差多少。

真實資料常有離群點。若硬要全部分對，道路會被擠得很窄。參數C決定模型多在意這些違規。

![同一批點：C小時道路寬、容許1點分錯；C大時邊界斜過去遷就那1點，道路變窄。](figure:l23202-support-vector-machine-soft-margin)

:::supplement[來源：scikit-learn SVM Mathematical formulation]
軟間隔下，支持向量也可能落在間隔內，甚至分錯類。不能把「支持向量」一律定義成剛好位於兩條邊線上的點。
:::

## 定義與公式

### 線性邊界

$$
f(x)=w^\top x+b,\qquad w^\top x+b=0
$$

$x$是輸入，$w$是權重，$b$是截距，$f$為分數。第二式為超平面；$f$正值判正類、負值判負類，零分另訂規則。

### 間隔寬度（補充）

採支持邊線$f=\pm1$的標準化表示時：

$$
d(x,\text{邊界})=\frac{|f(x)|}{\lVert w\rVert_2},\qquad
\text{總間隔}=\frac{2}{\lVert w\rVert_2}
$$

$d$是垂直距離，$\lVert w\rVert_2$是非零權重的歐幾里得範數。分數本身不是距離。兩條支持邊線各距中線$1/\lVert w\rVert_2$，合起來才是總間隔。

### 核化決策

$$
f(x)=\sum_{i\in S}\alpha_i y_i K(x_i,x)+b
$$

$S$為支持點索引，$x_i$是點，$y_i$為$-1,+1$標籤，$\alpha_i$是係數，$K$為核。核可直接算隱含空間內積，不必列出所有高維座標。

### RBF與參數

指引列出RBF核，並提醒C與gamma會影響成效；下方展開核公式與參數方向。

:::supplement[來源：scikit-learn SVM Kernel functions；RBF SVM parameters]

$$
K(u,v)=\exp\left(-\gamma\lVert u-v\rVert_2^2\right)
$$

$u,v$是輸入向量，$\gamma>0$控制衰減速度。平方距離2時，gamma=0.5得exp(−0.5×2)≈0.3679；gamma=2得exp(−2×2)≈0.0183。

固定其他設定時，較大gamma使影響更局部。C則控制違反間隔的懲罰：較大C更重視減少訓練違規，較小C更容許違規以換取較簡單的邊界。
:::

## 算一次

### 同一金融座標的分數與寬度（補充）

沿用金融的收入、負債座標，指定$w=(-1,1)$、$b=-1$。F020為$(2,2)$、負類；F028為$(1,3)$、正類，分數分別為$-1$與$1$。

權重範數為√2。代入間隔公式，單側約0.7071、總寬約1.4142：

$$
\lVert w\rVert_2=\sqrt{(-1)^2+1^2}=\sqrt2,\qquad
\text{總間隔}=\frac{2}{\sqrt2}\approx1.4142
$$

這是指定的幾何例子，不是完整資料擬合出的支持點清單。

「直覺」一節道路圖裡的其他點是教學合成點。若把完整90筆畫上去，部分正類點會落在$f=0$中線，所以那條道路不是完整資料的分隔結果。

取兩個支持點的$\alpha$皆為1、線性核為內積。對F038的$(2,4)$，兩個核值為12與14，所以$f=-12+14-1=1$，與直接代入$-2+4-1$一致。

### 換成非線性資料

製造例子的低壓力區與高振動區都標為瑕疵，原座標的一條直線難以完整描述兩區。核方法可表達更複雜邊界；指引列出線性、多項式、RBF與sigmoid等核。

先看一個最小的例子：同一批點在數線上切不開，多加一個座標後就分得開。

![同一批9個點：數線上切不開；把x²當第二個座標後，一條水平線就分開了。](figure:l23202-support-vector-machine-kernel)

核函數做的事等同這種「換到新座標再找直線」。差別是它直接算兩點在新座標裡的相似度，不必真的把新座標列出來。

:::supplement[來源：scikit-learn SVM Kernel functions]
能使用核不表示保證完美分隔。核、尺度及C要一起驗證；即使原資料可分，追求零訓練錯誤也未必對新資料最好。
:::

## 程式（補充）

先核對幾何例子的分數、總寬與RBF值。

```python
import numpy as np
support = np.array([[2., 2.], [1., 3.]])
y_support = np.array([-1., 1.])
w, bias = y_support @ support, -1.
q = np.array([2., 4.])
print("權重", w.tolist(), "決策分數", float(w @ q + bias))
print("核式分數", float(y_support @ (support @ q) + bias))
print("總間隔", round(2 / np.linalg.norm(w), 4))
print("RBF", [round(float(np.exp(-g * 2)), 4) for g in [0.5, 2]])
```
```text
權重 [-1.0, 1.0] 決策分數 1.0
核式分數 1.0
總間隔 1.4142
RBF [0.3679, 0.0183]
```

再重建共用金融90筆；模型使用四個原始特徵，並只在訓練集擬合標準化。

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
i = np.arange(90)
a, b = i % 9, i // 9
X = np.column_stack((20+10*a, 100*b, 16+8*a+(i%3-1), 90*b+2*(i%4)))
y = (b-a-1 >= 0).astype(int)
hand = [10, 28, 11, 38, 12, 48]
order = np.random.default_rng(42).permutation([j for j in i if j not in hand])
train, val = np.r_[hand, order[:48]], order[48:66]
print("切分", len(train), len(val))
```
```text
切分 54 18
```

```python
for c, gamma in [(0.1, 0.1), (10, 0.1), (0.1, 10), (10, 10)]:
    model = make_pipeline(StandardScaler(), SVC(C=c, gamma=gamma))
    model.fit(X[train], y[train])
    fit_ok = int((model.predict(X[train]) == y[train]).sum())
    val_ok = int((model.predict(X[val]) == y[val]).sum())
    print(f"C={c} gamma={gamma} 訓練={fit_ok}/54 驗證={val_ok}/18")
```
```text
C=0.1 gamma=0.1 訓練=44/54 驗證=14/18
C=10 gamma=0.1 訓練=53/54 驗證=17/18
C=0.1 gamma=10 訓練=31/54 驗證=9/18
C=10 gamma=10 訓練=54/54 驗證=12/18
```

:::tip[讀碼重點]
核SVM對尺度敏感；`StandardScaler`要和模型放在同一Pipeline。這四個設定示範參數影響，正式調參應在訓練部分做交叉驗證，測試集保留到最後。
:::

## 怎麼用、怎麼判讀

先考慮中小資料、高維特徵，以及邊界清晰或需非線性分界的問題。樣本非常多時，核SVM會花很多時間和記憶體。它能處理特徵很多的資料，但不代表算得快。

:::supplement[來源：scikit-learn SVM Complexity、Tips on Practical Use]
核SVM訓練時，要反覆計算樣本兩兩之間的相似度。scikit-learn說明，訓練成本約隨樣本數的平方到三次方成長：筆數變10倍，時間可能變100到1000倍。

樣本很多時，先試線性SVM（LinearSVC）；它的成本幾乎隨樣本數線性成長，可處理到百萬筆。

標準化後再選C與gamma。`decision_function`提供分類分數，並非直接提供校準過的機率；不能把分數0.8解釋成80%機率。
:::

### 換個場景

| 場景或條件 | 候選方式 | 判讀重點 |
|---|---|---|
| 郵件、診斷、流失、金融風險 | 科目1列出的分類共用場景 | 仍需依SVM條件驗證 |
| 中小資料、特徵維度高 | 線性或核SVM | 樣本量與維度分開評估 |
| 原座標邊界複雜 | RBF或其他核 | 尺度與參數共同影響邊界 |
| 高維文件（補充） | 先比較線性SVM基準 | 不預設核越複雜越好 |
| 製造感測（補充） | 核SVM比較不同運作區域 | 單位換算與異常成本 |
| 交通事件（補充） | 比較正常與異常運作邊界 | 事件數與重訓成本 |

## 常見誤解

- 所有支持向量都恰好落在間隔邊線：軟間隔允許間隔內與分錯的支持點。（補充）
- C與gamma都越大越好：可能提高訓練擬合，卻降低驗證表現。
- 用核一定要真的儲存每個高維座標：核技巧可直接算內積或相似度。

## 進階

### 參考來源

- 科目1指引5.1，guide-1:5-8～5-9；科目3指引4.2，guide-3:4-28～4-30（版本未標示）：支持超平面、核決策式、分類共用場景、適用條件與成本限制。
- [scikit-learn SVM](https://scikit-learn.org/stable/modules/svm.html)：支持軟間隔、尺度、RBF定義與訓練成本（Complexity一節）。
- [Stanford CS229講義，印刷頁15](https://cs229.stanford.edu/notes2020spring/cs229-notes3.pdf#page=15)：支持點到超平面的幾何距離推導。
- [scikit-learn SVM Margins Example](https://scikit-learn.org/stable/auto_examples/svm/plot_svm_margin.html)：直接以權重範數計算單側間隔；本頁總間隔為兩側相加。
- [scikit-learn RBF SVM parameters教學](https://scikit-learn.org/stable/auto_examples/svm/plot_rbf_parameters.html)：參考固定資料比較C／gamma的教法。
- [INRIA Preprocessing for numerical features](https://inria.github.io/scikit-learn-mooc/python_scripts/02_numerical_pipeline_scaling.html)：參考把尺度與模型放入同一流程的方式。

## 小結

- SVM用支持向量限制分類邊界，兼顧間隔與違規。
- 分數除以權重範數才是幾何距離。
- C、gamma與尺度共同影響模型，必須用新資料驗證。
