---
id: pca
title: 主成分分析
kind: technique
codes:
  - L23102
  - L21301
  - L23202
  - L23301
aliases:
  - PCA 投影與重建
  - Principal Component Analysis
  - inverse_transform
  - n_components
  - principal-component-analysis
summary: 把中心化資料投影到最大變異的正交方向，衡量壓縮與資訊損失
guide_refs:
  - guide-1:5-5
  - guide-1:5-10
  - guide-3:3-12
  - guide-3:3-15
  - guide-3:3-16
  - guide-3:4-44
  - guide-3:4-45
  - guide-3:5-6
requires: [descriptive-statistics, eigenvalue-decomposition]
goals:
  - id: g1
    text: 走完中心化、協方差分解與投影，判斷何時先縮放
  - id: g2
    text: 用特徵值計算累積解釋變異、選擇維度並辨認任務資訊的取捨
  - id: g3
    text: 以fit、transform與重建比較壓縮、視覺化和去噪的用途及限制
formula_groups:
  - id: pca-covariance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: pca-projection
    source: https://www.deeplearningbook.org/contents/linear_algebra.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
  - id: explained-variance
    source: https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23102-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 醫院三個特徵的量級為1、1000、0.01，卻希望三者在PCA前有相近尺度。最合適的做法是？
    options:
      A: 只中心化，因PCA一定會除以各欄標準差
      B: 先把每筆的三個值加總
      C: 用訓練資料估計各欄縮放，再做PCA
      D: 先看測試資料的分布再一起擬合
    answer: C
    explain:
      A: PCA會中心化，但不自動把每欄縮成單位變異。
      B: 加總會提前失去各特徵的獨立表示。
      C: 縮放由需求決定，且統計量只能從訓練資料估計。
      D: 測試資料參與擬合會讓評估失去獨立性。
  - id: c2
    goal: g2
    type: choice
    prompt: 協方差特徵值由大到小為6、3、1，要至少保留90%變異，最少留幾維？
    options:
      A: 2維
      B: 1維
      C: 3維
      D: 無法由特徵值判斷
    answer: A
    explain:
      A: 前兩維(6+3)/10=90%，正好達標。
      B: 一維只保留60%。
      C: 三維保留100%，但不是達標所需最少維數。
      D: 特徵值就是各主方向變異，可用來計算比例。
  - id: c3
    goal: g3
    type: choice
    prompt: 製程資料秩為2。保留3維後inverse_transform的誤差接近0，改留1維後SSE為6。哪項判讀正確？
    options:
      A: 保留3維代表已移除全部雜訊
      B: SSE為6證明少掉的全是雜訊
      C: inverse_transform會精確找回被丟掉的方向
      D: 保留1維丟掉部分資訊，需另查它是雜訊還是訊號
    answer: D
    explain:
      A: 近零誤差表示幾乎原樣重建，沒有藉截斷去噪。
      B: 重建誤差無法判定資訊是不是雜訊。
      C: 截斷後被捨棄的座標無法由投影自動還原。
      D: 重建只衡量壓縮差異，任務訊號需另外驗證。
  - id: c4
    goal: g1
    type: choice
    prompt: 製程中心化後某筆為(-2,-2,-1)，第一單位方向為(1,1,0)/√2。第一個投影座標是多少？
    options:
      A: −1
      B: −2√2
      C: −4
      D: √2
    answer: B
    explain:
      A: −1是第三欄，本方向第三個權重為0。
      B: 內積為(-2−2)/√2=−2√2。
      C: 這是除以方向長度之前的加總。
      D: 投影方向與原點位置給出的符號為負。
  - id: c5
    goal: g3
    type: choice
    prompt: 兩筆資料的t都是0、振動偏差分別為−1與1，標籤正好相反。只留依t變化的第一主成分，可能發生什麼？
    options:
      A: 兩筆會自動分到不同群
      B: PCA會依標籤改選方向
      C: 兩筆投影相同，原本可區分類別的資訊被刪掉
      D: 只要保留76.9%變異，分類一定不受影響
    answer: C
    explain:
      A: PCA產生座標，並不自動分群。
      B: PCA方向沒有使用標籤。
      C: 投影同為0，但第三欄的標籤訊號已丟失。
      D: 保留變異與保留分類訊息是不同要求。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

相關特徵可能重複表達同一種變動。主成分分析（PCA，Principal Component Analysis）把它們重組為正交的新座標，優先留下變異大的方向。

指引用它壓縮高維特徵、加快建模與視覺化。選擇保留多少維，同時也在決定願意捨棄哪些資料變化。

## 直覺

製程的溫度與壓力同升同降，兩欄只提供一個共同方向；振動則有另一種變動。主成分是原始特徵的組合，並非直接挑出其中一欄。

先看一團教學合成點（本例12筆溫度與壓力偏差，和「算一次」的6筆不同）。從某個方向打光，每個點都會在一條穿過平均值的直線上留下影子。

![比較兩條線上影子散開的程度：散得最開的方向就是第一主成分。](figure:l23102-pca-shadow)

影子擠在一起，表示沿這條線看，各點幾乎沒差別；影子散得越開，這條線保留的資料變化越多。PCA的第一主成分，就是讓影子散得最開的方向。

![第一主成分沿點雲拉得最長的方向，第二主成分與它垂直。](figure:l23102-pca-axes)

第二主成分必須和第一主成分垂直，再從剩下的變化裡找最大的。兩支新軸合起來，等於把原本的座標旋轉一個角度。本例第一主成分約為0.74×溫度＋0.68×壓力，代表兩欄一起變；它單獨就占全部變化的97.3%。

回到「算一次」的製程6筆。溫度和壓力完全同步，所以第一主成分描述兩欄一起偏高或偏低，第二主成分剛好是振動。

![只留第一主成分，就是把每個點垂直壓到橫線上；03與04變成同一點。](figure:l23102-pca-projection)

壓下去之後，振動的上下差異全部消失。03與04原本振動一負一正，現在落在同一點；這個代價在「變異大不等於任務重要」會再談。

### 中心化與縮放

先減去各欄均值，讓投影描述相對平均值的變化。若量級差異源於單位、且希望各特徵權重可比，通常還要先標準化；保留原量級有業務理由時則不一定。

:::supplement[來源：scikit-learn PCA]
scikit-learn的PCA會中心化，不會自動除以各欄標準差。本頁三欄是刻意保留原尺度的教學指數，不把大數值方向自動視為更重要的任務訊號。
:::

## 定義與公式

PCA先找協方差矩陣的特徵方向，再取最大幾個特徵值對應的方向投影。新座標在這批資料上互不相關。

:::supplement[來源：scikit-learn PCA；Deep Learning 2.12]
互不相關不表示在機率上獨立。以下將指引的中心化、協方差及投影流程寫成公式。

對 $n>1$ 筆、$d$ 個特徵的資料：

$$
X_c=X-\mathbf1\mu^\top,\qquad C=\frac{X_c^\top X_c}{n-1}
$$

$\mu$ 是各欄平均值，$\mathbf1$ 是長度 $n$ 的全1向量，$C$ 是 $d\times d$ 樣本協方差矩陣。它的對角線是各欄變異，非對角線反映共同變化。

$$
Z=X_cV_k,\qquad \widehat X=ZV_k^\top+\mathbf1\mu^\top
$$

$V_k$ 的 $k$ 欄是最大特徵值對應的正交單位方向，$Z$ 是 $n\times k$ 的投影座標。$\widehat X$ 是回到原欄位的近似重建，通常不等於 $X$。

$$
\rho_i=\frac{\lambda_i}{\sum_{j=1}^{d}\lambda_j},\qquad
R_k=\sum_{i=1}^{k}\rho_i
$$

$\lambda_i$ 是由大到小的協方差特徵值，$\rho_i$ 是單一解釋變異比例，$R_k$ 是累積比例。總變異為零時，這個比例沒有定義。
:::

## 算一次（補充）

沿用六筆製程資料，均值 $(10,20,5)$。第一筆 $(8,18,4)$ 中心化後是 $(-2,-2,-1)$；各欄偏差依序為 $t,t,z$。

### 協方差與第一筆投影（補充）

六筆資料的 $\sum t^2=10$、$\sum z^2=6$、$\sum tz=0$，因此：

$$
C=\begin{bmatrix}2&2&0\\2&2&0\\0&0&1.2\end{bmatrix}
$$

例如左上格是 $10/5=2$，右下格是 $6/5=1.2$。特徵值為4、1.2、0；前兩個方向可選 $(1,1,0)^\top/\sqrt2$ 與 $(0,0,1)^\top$。

第一筆投影為 $z_{11}=(-2-2)/\sqrt2=-2\sqrt2$，第二座標為 $z_{12}=-1$。三維變兩維，資料從 $6\times3$ 改為 $6\times2$。

### 選維度與重建（補充）

本例第一維比例為 $4/(4+1.2)=10/13\approx76.9231\%$，兩維累積100%。若門檻是90%，至少保留兩維。

![直條是各主成分的比例，折線是累積比例；累積跨過90%才夠。](figure:l23102-pca-variance)

第一筆只留第一維，重建偏差為 $(-2,-2,0)$，加回均值得 $(8,18,5)$。保留兩維則重建為 $(8,18,4)$，與原資料一致。

![只留一個主成分時，振動回填平均5；留兩個就完全還原。](figure:l23102-pca-reconstruction)

另一組一般協方差的特徵值若是6、3、1，比例依序為60%、30%、10%，累積兩維90%。這個例子存在variance_demo，不是製程矩陣的特徵值，也未宣稱每欄已標準化。

### 換尺度會怎樣（補充）

醫療資料均值為 $(50,100,20)$，偏差為 $t,2t,z$。第二欄放大後，特徵值變為10、1.2、0，第一比例提高為 $10/11.2\approx89.2857\%$。

兩領域的第一比例不同，部分原因是尺度。若對三欄各除以標準差，本例前兩欄仍重複，比例會改為 $2/3$、$1/3$、0。

## 程式（補充）

程式中的常數直接取自共用JSON，方便在獨立環境執行；欄位與列序維持相同。

先用完整六筆資料解說數學；這段是描述資料本身，沒有把重建誤差當成模型的獨立驗證成績。

```python
import numpy as np
from sklearn.decomposition import PCA
X = np.array([
    [8,18,4], [9,19,6], [10,20,4],
    [10,20,6], [11,21,6], [12,22,4]])
for k in (1, 2, 3):
    model = PCA(n_components=k, svd_solver="full")
    model.fit(X)
    Z = model.transform(X)
    restored = model.inverse_transform(Z)
    print("k", k, "形狀", Z.shape, "SSE", round(float(np.sum((X-restored)**2)), 4))
    if k == 2:
        print("解釋比例", model.explained_variance_ratio_.round(4).tolist())
        print("首筆重建", restored[0].round(4).tolist())
```
```text
k 1 形狀 (6, 1) SSE 6.0
k 2 形狀 (6, 2) SSE 0.0
解釋比例 [0.7692, 0.2308]
首筆重建 [8.0, 18.0, 4.0]
k 3 形狀 (6, 3) SSE 0.0
```

:::tip[讀碼重點]
n_components設定保留維數；inverse_transform把投影座標映回原欄位。全保留接近原樣重建，不代表去噪；本例秩只有2，所以保留2維也已完整。
:::

### 預測流程只擬合訓練集（補充）

若要比較下游預測，改用共用JSON的固定切分：前四筆訓練，後兩筆驗證。縮放器與PCA都只能從訓練部分學習，驗證部分沿用同一個變換。

```python
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
X = np.array([
    [8,18,4], [9,19,6], [10,20,4],
    [10,20,6], [11,21,6], [12,22,4]])
train, valid = X[:4], X[4:]
scaler = StandardScaler().fit(train)
model = PCA(n_components=2, svd_solver="full").fit(scaler.transform(train))
Zvalid = model.transform(scaler.transform(valid))
print("訓練均值", scaler.mean_.tolist())
print("驗證形狀", Zvalid.shape)
```
```text
訓練均值 [9.25, 19.25, 5.0]
驗證形狀 (2, 2)
```

## 怎麼用、怎麼判讀

PCA適合相關特徵多、希望降低維度或觀察資料結構的情況。它產生新座標，分群演算法才決定群別；把PCA散點看成現成群集會混淆兩個步驟。

### 變異大不等於任務重要（補充）

共用資料第03、04筆的 $t$ 都是0，振動 $z$ 分別為−1與1。若標籤由振動正負決定，只留第一主成分後兩筆都投影為0，原本的類別差異消失。

因此不能用「保留76.9%變異」推論「分類仍保留76.9%能力」。低變異可能是訊號，大變異也可能含離群或無關變動。

### 換個場景

| 場景 | 資料條件 | 判讀 |
|---|---|---|
| 高維壓縮 | 相關或冗餘特徵多 | 降低儲存與後續計算 |
| 視覺化探索 | 需要二維或三維呈現 | 投影失真可能遮住結構 |
| 雜訊過濾 | 捨棄方向較可能是雜訊 | 截斷仍可能刪到訊號 |
| 製程感測（補充） | 共同變動加振動 | 一維會刪掉振動資訊 |
| 醫療探索（補充） | 多量級相關指數 | 縮放與臨床意義分開判斷 |

## 常見誤解

- PCA只挑原始欄位：主成分通常混合多個欄位，會降低直觀解釋性。
- 主成分越少一定越好：可能省計算，也可能丟掉有用訊息。
- 全部重建等於成功去噪：全部保留通常也把雜訊一起帶回。（補充）

## 進階

### 使用限制

PCA主要描述線性結構，對離群值敏感。非線性形狀可能無法用少數直線方向保留，主成分也不一定有清楚的業務名稱。

### 參考來源

- 科目1學習指引5-5、5-10（guide-1:5-5、guide-1:5-10）：高維壓縮與視覺化用途。
- 科目3學習指引3-12、3-15～3-16、4-44～4-45、5-6：特徵重組、流程、縮放條件、效益與限制。
- [scikit-learn PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)：公式對應、API、中心化與重建。
- [Deep Learning 2.12](https://www.deeplearningbook.org/contents/linear_algebra.html)：投影與重建的數學觀點。
- [官方Iris PCA教學](https://scikit-learn.org/stable/auto_examples/decomposition/plot_pca_iris.html)：以低維座標探索結構的講解方式；本頁數據為自行合成。

## 小結

- 先考慮尺度，再中心化、分解協方差並投影。
- 解釋比例用特徵值算，維數依需求門檻與任務驗證決定。
- 低秩重建可壓縮，也可能刪掉低變異的預測訊號。
- fit學方向，transform投影，inverse_transform作近似重建。
