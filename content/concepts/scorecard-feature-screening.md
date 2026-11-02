---
id: scorecard-feature-screening
title: 信用評分卡的分箱、IV 與 PSI
kind: technique
codes: [L23301]
aliases: [Binning, IV, Information Value]
summary: 分箱建立表示，IV 比較類別區別力，PSI 比較參考與當期分佈
goals:
  - id: g1
    text: 區分分箱、IV 篩選與 PSI 監測的輸入輸出，並解釋沒有通用門檻
requires: [classification-regression]
formula_groups:
  - id: information-value
    source: https://support.sas.com/documentation/cdl/en/emcsgs/66024/HTML/default/p1k9g3rmke3kezn1b2q56wvwqamm.htm
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-D
  - id: stability-role
    source: https://arxiv.org/html/2509.09855v1
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 某銀行有 12 筆已知違約結果的開發資料，以及 12 筆尚無結果的當期申請。要區分流程角色，何者正確？
    options:
      A: 分箱建立區間，PSI 比較好壞客群，IV 監測當期
      B: 分箱建立標籤，IV 產生違約結果，PSI 預測損失
      C: 分箱建立區間，IV 比較好壞客群，PSI 比較時期
      D: 分箱刪除違約，IV 提高當期占比，PSI 校準機率
    answer: C
    explain:
      A: IV 比較已知標籤的兩類分箱分佈，PSI 才比較參考與當期分佈。
      B: 分箱不生成結果標籤，IV 與 PSI 也不是違約或損失預測器。
      C: 三者分別處理特徵表示、開發時的區別力及分佈變動。
      D: 分箱不應刪除違約者，兩個指標也不會主動改占比或校準機率。
  - id: c2
    goal: g1
    type: choice
    prompt: 三箱開發資料的未違約計數為 (1,2,3)，違約計數為 (3,2,1)，兩類各 6 筆。低收入箱的未違約分佈比例是多少？
    options:
      A: 1/6，分母用全部未違約者
      B: 1/4，分母用低收入箱筆數
      C: 1/12，分母用全部開發筆數
      D: 3/6，分子用低收入箱違約
    answer: A
    explain:
      A: IV 中每類的分佈分母是該類總筆數，所以為 1 除以 6。
      B: 1/4 是箱內未違約率，不是未違約者的跨箱分佈。
      C: 1/12 是占全體開發資料的比例，混用了類別分母。
      D: 3/6 是違約者落在低收入箱的比例。
  - id: c3
    goal: g1
    type: choice
    prompt: 固定三箱的參考比例為 (1/3,1/3,1/3)，當期比例為 (1/2,1/3,1/6)，PSI 約 0.1831，但尚無當期標籤。可得何種結論？
    options:
      A: 當期分佈已有變動，因此可證明違約預測必定下降
      B: 當期分佈已有變動，仍需查原因並等待標籤評估
      C: 當期分佈已有變動，因此可用 0.1831 取代 AUC
      D: 當期分佈已有變動，應立即改分箱使 PSI 歸零
    answer: B
    explain:
      A: 沒有當期結果，不能由邊際分佈變化證明預測成效下降。
      B: PSI 是分佈警訊，可查來源或群體改變；成效需等標籤驗證。
      C: PSI 與排序指標 AUC 回答不同問題，不能互相替代。
      D: 重新按當期分箱會改變比較基準，可能掩蓋變化。
textbook: v2
author: codex
status: draft
---

## 為什麼需要（補充）

分箱建立表示，資訊價值（Information Value，IV）看兩類差異；族群穩定性指數（Population Stability Index，PSI）看兩期差異。

本頁是信用評分流程的核心延伸。兩本指引未完整教授這三者的流程角色，以下依 SAS 官方文件與研究文獻補充，不建立完整金融模型。

## 直覺（補充）

先把收入分成幾個區間，再看每箱在未違約與違約者中各占多少，這是 IV 的比較。上線後沿用箱界，觀察新申請者落在哪些箱，這是 PSI 的比較。

![開發期用標籤計算 IV，監測期沿用固定箱界計算 PSI；當期標籤成熟後才能評估成效。](figure:l23301-scorecard-feature-screening-lifecycle)

## 定義與公式（補充）

| 步驟 | 輸入 | 輸出 | 用途 |
|---|---|---|---|
| 分箱 | 特徵值；監督式分箱另需標籤 | 箱界、箱編碼 | 建立較粗的表示 |
| IV | 固定箱內的未違約／違約計數 | 一欄的區別力摘要 | 開發期初篩候選特徵 |
| PSI | 固定箱內的參考／當期計數 | 分佈差異摘要 | 比較族群或時期的變動 |

### IV 比較兩類

約定未違約為好客群、違約為壞客群；只是此處公式的類別名稱，不是對人的價值評斷。對第 b 箱，定義：

$$
g_b=\frac{G_b}{G},\qquad
h_b=\frac{H_b}{H},\qquad
\mathrm{IV}=\sum_{b=1}^{B}(g_b-h_b)\ln\frac{g_b}{h_b}
$$

$G_b,H_b$ 是該箱未違約、違約筆數，G、H 是兩類各自的總筆數，B 是箱數。$g_b,h_b$ 是「該類的人有多少比例落在這箱」，不是箱內違約率。

ln 是自然對數；式中的兩種比例都要大於 0。IV 越大，表示該分箱下兩類分佈差異越大；不表示加入模型後一定能提高預測力。

### PSI 比較兩批資料

$$
\mathrm{PSI}=\sum_{b=1}^{B}(a_b-e_b)\ln\frac{a_b}{e_b}
$$

$e_b$ 是參考資料落在第 b 箱的比例，$a_b$ 是當期比例，B 是共同箱數。這次分母是各批總筆數，無須當期違約標籤。

IV 與 PSI 的式子相似，但比較對象不同。兩者都需要相容箱界與正比例；若有零箱，須事先制定合箱或平滑規則並對兩批一致使用，不能把無限值當成完美證據。

## 算一次（補充）

獨立的 12 筆授信教學資料，收入單位為千元。固定箱界為 40、60：低箱小於 40，中箱至少 40 且小於 60，高箱至少 60。

| 收入箱 | 未違約筆數 | 違約筆數 | 當期申請筆數 |
|---|---:|---:|---:|
| 低 | 1 | 3 | 6 |
| 中 | 2 | 2 | 4 |
| 高 | 3 | 1 | 2 |
| 合計 | 6 | 6 | 12 |

開發期兩類各 6 人，所以低箱的比例是 g＝1/6、h＝3/6。低箱 IV 貢獻為 (1/6−3/6)×ln((1/6)/(3/6))，約 0.366204。

中箱的兩類比例相同，貢獻為 0；高箱貢獻同為 0.366204。三箱相加，IV 約為 0.732408。

開發資料每箱各 4 人，參考比例為 1/3、1/3、1/3。當期為 6、4、2 人，比例 1/2、1/3、1/6。

PSI 三項貢獻約為 0.067578、0、0.115525；以未四捨五入的值加總，PSI 約為 0.183102。若先取捨分項再相加，末位可能不同。

這 12 筆只展示分母與角色，不能用來認證風控效能。IV 和 PSI 的箱界、樣本量及資料期間都會影響判讀。

## 程式（補充）

依 JSON 原始記錄分箱後計數，不直接把 IV 或 PSI 寫成常數。第一段建立開發期三箱的兩類計數。

```python
import numpy as np
income = np.array([25,30,32,35,42,45,50,55,62,65,70,75])
y = np.array([0,1,1,1,0,0,1,1,0,0,0,1])
bin_id = np.searchsorted([40,60], income, side="right")
counts = np.zeros((3,2), dtype=int)
np.add.at(counts, (bin_id,y), 1)
g, h = counts[:,0]/sum(y==0), counts[:,1]/sum(y==1)
iv = np.sum((g-h)*np.log(g/h))
print("未違約、違約", counts.tolist())
print("IV", round(float(iv),6))
```
```text
未違約、違約 [[1, 3], [2, 2], [3, 1]]
IV 0.732408
```

```python
current = np.array([25,30,32,34,36,38,42,45,50,55,65,70])
current_bin = np.searchsorted([40,60], current, side="right")
e = counts.sum(axis=1)/counts.sum()
a = np.bincount(current_bin, minlength=3)/len(current)
psi = np.sum((a-e)*np.log(a/e))
print("當期比例", a.round(4).tolist())
print("PSI", round(float(psi),6))
```
```text
當期比例 [0.5, 0.3333, 0.1667]
PSI 0.183102
```

:::tip[讀碼重點]
第一段需要違約標籤，第二段只要當期收入。兩段沿用相同箱界；程式適用於本例所有比例大於 0 的條件。
:::

## 怎麼用、怎麼判讀（補充）

開發時先分開訓練、驗證與測試。監督式分箱與 IV 都會使用標籤，因此分箱、篩選要在訓練邊界內完成，再比較精簡模型的驗證表現。

PSI 可在標籤尚未成熟時提供分佈警訊。警訊可能來自申請管道、季節、族群或資料管線改變，不能單憑數值斷言模型已失效。

SAS 範例提供過 IV 的經驗分級；它是特定實務慣例，不是所有任務的通用門檻。IV 或 PSI 都應依樣本量、分箱、風險容忍與歷史波動制定判讀規則。

### 換個場景

以下都為延伸場景；指引未替本概念指定產業或通用資料門檻。

| 場景 | 可用角色 | 判讀重點 |
|---|---|---|
| 授信申請（補充） | IV 初篩、PSI 看新族群 | 高 IV 還需查洩漏與穩定性 |
| 製造瑕疵（補充） | 比較合格／瑕疵的分箱分佈 | 訊號是否能跨批次使用 |
| 客服升級（補充） | 比較不同期間工單長度 | 分佈變動未必代表分類衰退 |

## 常見誤解（補充）

- IV 不用標籤：它需要兩類的箱內計數，不能用未標記的當期申請直接替代。
- PSI 是準確率：它比較分佈，不比較預測與真實結果。
- 箱越多、IV 越高就越好：細箱可能放大抽樣波動、產生零箱或過擬合。
- PSI 高就立刻重分箱：任意換箱可能掩蓋變化，需先查原因並保留舊基準。

## 進階

### 分箱保留什麼、失去什麼（補充）

分箱讓同一區間內的原始數值共用表示，也會失去箱內細節。實務上可配合缺值箱、樣本量、業務合理性及監督式分箱，但不能用最終測試標籤修箱界。

### 參考來源

- [SAS 官方分箱與 IV 文件](https://support.sas.com/documentation/cdl/en/emcsgs/66024/HTML/default/p1k9g3rmke3kezn1b2q56wvwqamm.htm)：支持開發分箱、IV 公式、初篩角色；其分級不作本頁通用門檻。
- [SAS 作者教學：建立信用評分卡](https://blogs.sas.com/content/subconsciousmusings/2019/01/18/building-credit-scorecards-using-statistical-methods-and-business-logic/)：參考以分箱、變數篩選、模型與監測串成流程的講法。
- [Sudjianto 與 Burakov，2025，研究預印本第 2～3 節](https://arxiv.org/html/2509.09855v1)：支持 PSI 與 IV 的不同分佈對象、公式及稀疏箱限制；不沿用其延伸公平性推導。
- [Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)：支持分箱與篩選留在訓練資料邊界。

## 小結（補充）

- 分箱建立表示，IV 比較已知兩類的分箱分佈。
- PSI 比較參考與當期分佈，可以沒有當期標籤。
- 分母、共同箱界與零比例規則必須先定義。
- 沒有通用判定門檻，分佈警訊也不等於預測成效衰退。
