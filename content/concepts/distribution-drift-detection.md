---
id: distribution-drift-detection
title: KL、PSI 與 KS 漂移偵測
kind: technique
codes: [L21203]
aliases: []
requires: [data-drift, hypothesis-testing]
summary: KL與PSI比較同箱比例，KS比較累積分布，警報仍須調查
goals:
  - id: g1
    text: 用同一分箱算KL與PSI，說明方向、零比例平滑及門檻限制
  - id: g2
    text: 由ECDF差距算KS，分清樣本量、多重比較與無真值警報的界線
formula_groups:
  - id: kl-direction
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21203-C
  - id: psi-symmetric
    source: https://www.mathworks.com/help/risk/risk.validation.populationstabilityindex.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21203-C
  - id: ks-ecdf
    source: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21203-C
  - id: count-smoothing
    source: https://scikit-learn.org/stable/modules/naive_bayes.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21203-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 固定兩箱，參考P=(0.5,0.5)、當期Q=(0.2,0.8)，用自然對數計算。哪組KL(P||Q)與PSI正確？
    options:
      A: KL約0.223，PSI約0.416
      B: KL約0.193，PSI約0.416
      C: KL約0.223，PSI約0.030
      D: KL約0.416，PSI約0.223
    answer: A
    explain:
      A: 以P加權算KL約0.223，兩方向KL相加得到PSI約0.416。
      B: 0.193是反方向KL(Q||P)，不是題目指定方向。
      C: PSI是兩方向KL的和，不是相減。
      D: 兩個統計量的數值被交換了。
  - id: c2
    goal: g1
    type: choice
    prompt: 兩期各10筆、固定兩箱；參考計數(0,10)，當期(5,5)。採每箱加1平滑後，應使用哪兩組比例？
    options:
      A: 參考(1/10,11/10)，當期(6/10,6/10)
      B: 參考(1/11,10/11)，當期(5/10,5/10)
      C: 參考(1/12,11/12)，當期(6/12,6/12)
      D: 參考(0/12,10/12)，當期(5/12,5/12)
    answer: C
    explain:
      A: 加入兩個偽計數後分母也要增加，不能仍除以10。
      B: 這只替零箱加1，與每箱加1的指定規則不同。
      C: 每期兩箱各加1，分母都是10加2，兩期比例各自合計1。
      D: 只改分母而沒加偽計數，比例未合計1也未解決零比例。
  - id: c3
    goal: g2
    type: choice
    prompt: 參考量測(1,2,3,4,5)、當期(2.5,3.5,4.5,5.5,6.5)，最大ECDF差距0.4。哪項回報正確？
    options:
      A: KS的p值為0.4，代表概念有40%機率漂移
      B: KS的D值為0.4，單憑它不能確認效能衰退
      C: KS的D值為0.4，代表模型有40%預測錯誤
      D: KS的p值為0.4，代表兩期分布已確定相同
    answer: B
    explain:
      A: ECDF最大差距是D統計量，且p值不是概念漂移的機率。
      B: D只量輸入的累積差距，沒有真值就不能直接算效能。
      C: D的分母與預測對錯無關，不能解讀成錯誤率。
      D: D不是p值；即使檢定未拒絕，也不能證明完全相同。
  - id: c4
    goal: g2
    type: choice
    prompt: 每日同時測100欄、每欄α=0.05，出現一個小p值且真值延遲。最合適的處理為何？
    options:
      A: 宣告概念漂移，立即把該欄永久移除
      B: 宣告效能衰退，直接用預測當成真值
      C: 忽略所有警報，因為多欄比較必定錯
      D: 查幅度及多重比較，待真值後再評分
    answer: D
    explain:
      A: 單欄分布檢定未直接檢驗條件關係，也不能支持永久刪欄。
      B: 沒有真值不能確認實際效能，用預測自評會失去意義。
      C: 多重比較增加誤報風險，但不表示所有差異都不存在。
      D: 同時考慮效果大小與多次檢查的誤報，再補足有真值的分析。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:4-42, guide-1:5-19, guide-3:4-46]
---

## 為什麼需要

指引要求監測輸入分布及異常比例；圖看得出不同，還需要一致的數值比較規則，才方便追蹤多個欄位。

科目3指引4-46在t-SNE中提到KL散度。把KL展開成漂移計算，以及PSI、KS、平滑與警報設計，都是本頁補充。

## 直覺（補充）

三種方法都把兩批分布的差異濃縮成數字。KL與PSI先固定共同分箱，KS則直接比較原始量測的累積比例。

- KL散度（Kullback–Leibler Divergence）：比較同一組箱的比例，須指定方向。
- 母體穩定性指標（Population Stability Index，PSI）：也比較同箱比例，交換兩期後數值不變。
- KS統計量（Kolmogorov–Smirnov Statistic）：沿數值軸比較累積比例，取最大差距。

下面是兩份各5筆、單位為毫米的量測；實線與虛線越遠，累積比例差距越大。KS取最大的垂直差距，不計算兩線之間的總面積。

![KS取最大垂直差距0.4；這是D統計量，不能當成p值或預測錯誤率。](figure:l21203-distribution-drift-detection-ecdf)

## 定義與公式（補充）

### KL與PSI

先固定同一特徵、單位、箱界及缺值規則。設共有$K$箱，參考比例$p_i$、當期比例$q_i$各自非負且合計1；本算例全部為正，使用自然對數$\ln$。

$$
\begin{aligned}
D_{\mathrm{KL}}(P\Vert Q)&=\sum_{i=1}^{K}p_i\ln\frac{p_i}{q_i},\\
\mathrm{PSI}(P,Q)&=\sum_{i=1}^{K}(q_i-p_i)\ln\frac{q_i}{p_i}\\
&=D_{\mathrm{KL}}(P\Vert Q)+D_{\mathrm{KL}}(Q\Vert P).
\end{aligned}
$$

$P$與$Q$是兩份分箱分布，$i$是箱的索引。KL方向有差異，PSI在共同分箱下交換兩期不變。

兩者非負，但沒有通用上限，也不是百分比。

KL中$p_i=0$的項以極限值0處理；若$p_i>0$而$q_i=0$，則KL為無限大。PSI只有一側為零時也會發散，不能把除零後的無效數字當成0。

### 零計數平滑

若採用每箱加入偽計數的規則，必須同時改分子及分母：

$$
\tilde p_i=\frac{n_i+\lambda}{N+K\lambda}
$$

$n_i$是參考期第$i$箱計數，$N$為該期總數，$\lambda>0$是每箱加的偽計數。當期也用相同規則，並換成當期計數與總數；平滑會改變估計，需事先記錄。

例如參考計數(0,10)、兩箱、每箱加1，得到(1/12,11/12)；當期(5,5)變成(6/12,6/12)。不是只把零換成1，還沿用原分母10。

### KS與ECDF

經驗累積分布函數（Empirical Cumulative Distribution Function，ECDF）是小於等於某數值的樣本比例：

$$
\begin{aligned}
F_n(z)&=\frac{\#\{x_j\le z\}}{n},\qquad
G_m(z)=\frac{\#\{u_j\le z\}}{m},\\
D_{n,m}&=\sup_z\left|F_n(z)-G_m(z)\right|.
\end{aligned}
$$

$x_j$與$u_j$是兩份原始數值樣本，$n$、$m$是各自筆數；$\#$表示計數，$z$是比較切點，$\sup$表示最大可能差距。有限樣本只需檢查合併後的觀測值。

$D$介於0與1。它與檢定的p值不同；常見雙樣本KS的p值校準假設獨立樣本與連續分布，類別編碼或大量同分不能直接沿用相同解讀。

## 算一次（補充）

### 同一分箱算KL與PSI

用`L21203-C-drift.json`授信P0與P1的低、高組。兩期各100筆，箱界固定負債比40%；視覺領域則以刮痕面積10 mm²分組，沿用相同計數。

| 組別 | 參考P0 | 當期P1 | 比例P／Q |
|---|---|---|---|
| 低組 | 50 | 20 | 0.5／0.2 |
| 高組 | 50 | 80 | 0.5／0.8 |

代入第一組公式：KL(P∥Q)＝0.5 ln(0.5/0.2)＋0.5 ln(0.5/0.8)≈0.223144。

反方向KL(Q∥P)≈0.192745，不相等。PSI＝(0.2−0.5) ln(0.2/0.5)＋(0.8−0.5) ln(0.8/0.5)≈0.415888，等於兩方向KL的和。

本例沒有零箱，不需要平滑。若先各自重切成當期等量箱，會破壞「同一箱代表同一範圍」的比較條件。

### 原始量測算KS

另設參考(1,2,3,4,5)、當期(2.5,3.5,4.5,5.5,6.5)，各5筆，並非從上述兩箱比例還原。

在2毫米處，參考有2/5＝0.4，當期有0/5＝0。檢查合併後所有切點，最大絕對差為0.4，所以D＝0.4；本頁不據此宣告顯著。

## 程式（補充）

摘錄共用資料P0、P1的計數，不隨機抽樣。先用標準函式庫核算兩方向KL與PSI，輸出保留6位小數；這些計數與JSON中的兩期相同。

```python
from math import log
reference, current = [50, 50], [20, 80]
p = [v / sum(reference) for v in reference]
q = [v / sum(current) for v in current]
kl_pq = sum(a * log(a / b) for a, b in zip(p, q))
kl_qp = sum(b * log(b / a) for a, b in zip(p, q))
psi = sum((b - a) * log(b / a) for a, b in zip(p, q))
print(f"KL(P||Q)={kl_pq:.6f}")
print(f"KL(Q||P)={kl_qp:.6f}")
print(f"PSI={psi:.6f}")
```
```text
KL(P||Q)=0.223144
KL(Q||P)=0.192745
PSI=0.415888
```

再從原始量測計算ECDF的最大差距，並對照SciPy的D值。

```python
from scipy.stats import ks_2samp
a = [1, 2, 3, 4, 5]
b = [2.5, 3.5, 4.5, 5.5, 6.5]
points = sorted(set(a + b))
ecdf = lambda values, z: sum(v <= z for v in values) / len(values)
distance = max(abs(ecdf(a, z) - ecdf(b, z)) for z in points)
result = ks_2samp(a, b, alternative="two-sided", method="exact")
print(f"手算D={distance:.6f}")
print(f"SciPy D={result.statistic:.6f}")
```
```text
手算D=0.400000
SciPy D=0.400000
```

:::tip[讀碼重點]
第一段的KL以`p`加權；交換參數會改方向。第二段對原始量測排序，不把類別編碼當成有順序的連續量測；本頁只核對D，沒有把它印成p值。
:::

## 怎麼用、怎麼判讀

指引要求分布出現差異時提示調查；沒有真值的輸入警報，不等於已量得錯誤率。

### 方法選擇與門檻（補充）

| 方法 | 輸入需求 | 重要限制 |
|---|---|---|
| KL | 同箱的兩份比例 | 有方向、對零箱敏感 |
| PSI | 同箱的兩份比例 | 受分箱與平滑影響 |
| KS的D | 有序數值的原始樣本 | 只看最大累積差距 |
| KS的p值 | D、樣本量與假設 | 顯著不等於業務衝擊 |

:::caution[注意]
PSI的0.1、0.25是常見經驗界線，並非所有資料的通用檢定門檻；邊界如何判定也要明定。KL沒有一個適用所有欄位的數值警戒線。

KS在大樣本時可能把很小的差距判為顯著；小樣本則可能看不出重要差異。應同時報D、樣本量、比較條件與業務影響，不能只報小p值。

同時測100欄並反覆每日檢查，至少一個誤報的機會會增加。需要預先安排多重比較控制、時間窗及警報複核；相依的重複個案也要處理。
:::

### 換個場景

| 場景 | 比較對象 | 判讀重點 |
|---|---|---|
| 促銷推薦 | 消費金額分布 | 指引要求分布監控，方法另選 |
| 無真值的上線資料 | 欄位分布與異常比例 | 先報差異，不報實測效能 |
| 授信（補充） | 負債區間或分數箱 | 固定箱界，等到期真值 |
| 視覺品管（補充） | 刮痕面積量測 | 數值可用KS，類別另處理 |
| 醫療分診（補充） | 生理量測分布 | 注意病人重複與真值延遲 |

## 常見誤解

- 資料分布警報提示調查，不代表一定需要立刻換模型。
- KL不是對稱距離，PSI也不是機率或準確率。（補充）
- KS的D不是p值；未拒絕也不代表證明相同。（補充）
- 無真值的分布比較不能確認概念漂移，更不能證明衰退的成因。（補充）

## 進階

### 平滑是估計規則（補充）

每箱加1只是本頁示範，並非漂移偵測唯一正確的做法。也可預先合併稀疏箱，但不能看到哪種算法不警報，才選那個版本。

同一特徵的參考資料、箱界、缺值箱及平滑參數要一起保存。只存最後的PSI數字，下次未必能重現相同比較。

### 參考來源

- 科目1學習指引（本機快照）`guide-1:4-42`、`guide-1:5-19`：支持監控用途、促銷與欄位分布場景；未完整教授本頁三種統計量。
- 科目3學習指引（2025-12版）`guide-3:4-46`：在t-SNE提及KL；漂移公式與算例均為補充。
- [SciPy entropy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.entropy.html)：支持KL方向、定義及自然對數。
- [MathWorks populationStabilityIndex](https://www.mathworks.com/help/risk/risk.validation.populationstabilityindex.html)：支持PSI公式與常見經驗界線；本頁以比例明確計算。
- [SciPy ks_2samp](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html)：支持雙樣本D、p值及連續獨立樣本條件。
- [SciPy 多重檢定控制](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.false_discovery_control.html)：支持多欄比較需要控制誤報、檢查相依條件的界線。
- [NIST KS教學](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35g.htm)：參考ECDF階梯圖的講解；該頁的一樣本檢定不直接套用於本頁雙樣本。
- [NannyML 方法比較教學](https://nannyml.readthedocs.io/en/stable/how_it_works/univariate_drift_comparison.html)：支持KS只看最大差距的限制。
- [scikit-learn Multinomial Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)：支持每格偽計數平滑；本頁借用相同估計形式處理兩份分箱計數。
- [CMU SEI 漂移教學](https://www.sei.cmu.edu/blog/expecting-the-unexpected-monitoring-for-drift-in-ml-systems/)：支持無真值訊號與實際效能的區分。

## 小結

- 固定共同分箱後，才能比較新舊比例。（補充）
- KL要指定方向，PSI可核對為兩方向KL的和。（補充）
- KS取ECDF最大差距；警報不能代替真值及原因調查。（補充）
