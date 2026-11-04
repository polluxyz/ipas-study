---
id: differential-privacy
title: 差分隱私
kind: technique
codes: [L23401, L21203]
aliases: [DP, Differential Privacy]
requires: [probabilistic-modeling]
guide_refs: [guide-3:6-12]
summary: 差分隱私限制增加或移除一人的資料，能使輸出機率改變多少
goals:
  - id: g1
    text: 定位差分隱私的資料保護用途，區分指引提名與形式保證
  - id: g2
    text: 辨認鄰近資料集，核算計數敏感度、epsilon、加噪尺度與組合預算
formula_groups:
  - id: dp-bound
    source: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-226.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23401-C
  - id: laplace-count
    source: https://programming-dp.com/chapter5/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23401-C
  - id: sequential-budget
    source: https://programming-dp.com/chapter4/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23401-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊把 12 人的統計結果加上固定的 0.8，稱為差分隱私；文件沒有保護單位、敏感度或 epsilon。哪個判斷合理？
    options:
      A: 已成立，任何非零誤差都會把十二人的結果變成差分隱私
      B: 已成立，只要不公開姓名就不需要定義敏感度與保護單位
      C: 未能成立，固定偏移可被扣回，也沒有機制與預算的證據
      D: 未能成立，刪除一人後真實計數改變，兩表輸出必須完全相同
    answer: C
    explain:
      A: 非零誤差本身不能滿足機率界；固定偏移也不是隨機機制。
      B: 姓名是否公開不能取代正式的隱私保證與鄰近關係定義。
      C: 固定常數不能提供本頁的隨機輸出保護，仍須完整界定與驗證機制。
      D: 差分隱私限制兩表的輸出機率差異，不要求每次輸出完全相同。
  - id: c2
    goal: g2
    type: choice
    prompt: 醫療表一人一列，D 有 12 人；刪除一位氣喘者得到 D′，氣喘計數由 6 變 5。採新增或刪除一人的鄰近定義，epsilon=0.5，Laplace 尺度應是多少？
    options:
      A: 尺度 2，因計數敏感度為 1，再除以 0.5
      B: 尺度 0.5，因計數敏感度為 1，再乘以 0.5
      C: 尺度 12，因原表共有十二人，所以用全表人數
      D: 尺度 6，因原表共有六位氣喘者，所以用正例人數
    answer: A
    explain:
      A: 一人最多改變計數一，尺度是全域敏感度除以 epsilon，得到二。
      B: 校準公式是除以 epsilon；較小 epsilon 需要較大噪聲尺度。
      C: 一人對計數的最大影響不等於原表總人數。
      D: 正例總數是查詢值，並非一人對查詢造成的最大變動。
  - id: c3
    goal: g2
    type: choice
    prompt: 同一批人依序接受兩次有效的純差分隱私查詢，各耗 epsilon=0.5 與 0.3；總預算上限為 1。用基本循序組合上界，還可分配多少？
    options:
      A: 可再分配 0.5，因為兩次查詢只須取較大的 epsilon
      B: 可再分配 0.7，因為第二次查詢會取代第一次的預算
      C: 可再分配 0.85，因為兩次 epsilon 應先相乘再扣除
      D: 可再分配 0.2，因為兩次 epsilon 相加後已分配 0.8
    answer: D
    explain:
      A: 同人循序查詢不能用互斥人群的平行組合規則。
      B: 後一次釋出不會抹除外界已看到的前一次結果。
      C: 基本循序組合加總 epsilon，不是相乘。
      D: 0.5 加 0.3 是 0.8，再從上限一扣除，剩下 0.2。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

資料要用於模型發布、研究共享或第三方合作時，需要平衡隱私與效用。科目 3 指引 6-12 把差分隱私（Differential Privacy，DP）列為可考慮的保護選項。

:::supplement[來源：NIST SP 800-226 第 2.1 節]
只隱藏姓名或任意加噪，無法說明一人的參與會多透露多少資訊。差分隱私改為約束產生輸出的隨機機制，以數學條件量化這個影響。

指引沒有展開鄰近資料集、epsilon 或機率界。以下形式定義、算例與程式都是補充，不把「指引提到此名稱」當成已有完整保證。
:::

## 直覺（補充）

比較兩個世界：同一份醫療表，一個有 M01，一個沒有 M01。兩邊都執行同一個隨機機制；看到輸出後，不應很容易判斷 M01 是否參與。

![右邊僅刪去 M01，其餘十一人不變；保護比較的是兩邊可能輸出的機率分布。](figure:l23401-differential-privacy-neighbors)

這裡的**鄰近資料集**（Neighboring datasets）是相差新增或刪除一人的表，每人最多一列。金融例同樣刪去 F01，不重新抽樣，也不更動其他人的值。

## 定義與公式（補充）

### 機率界限制什麼（補充）

本頁介紹純 epsilon 差分隱私，隱私參數須滿足 $\epsilon\ge0$：

$$
\Pr[M(D)\in S]\le e^{\epsilon}\Pr[M(D')\in S]
$$

$D$、$D'$ 為任意鄰近表，$M$ 為隨機機制，$S$ 為輸出集合。$\Pr$ 對機制的隨機性取機率；$e$ 為自然指數底數，$\epsilon$ 為隱私參數。

條件要對所有鄰近資料集、所有輸出集合成立，交換兩表也要成立。epsilon 越小，兩邊可允許的機率差越受限；它不是再識別成功率。

epsilon=0.5 時，$e^{0.5}\approx1.6487$。稍後會用「輸出至少 6」這個集合算一次，但單一集合通過不能證明整個機制合格。

### 由敏感度決定噪聲（補充）

對單一數值查詢，以下採 $\epsilon>0$、有限且正的全域敏感度 $0<\Delta f<\infty$。拉普拉斯機制（Laplace mechanism）可寫為：

$$
\Delta f=\max_{D\sim D'}|f(D)-f(D')|,\quad
b=\frac{\Delta f}{\epsilon},\quad
M(D)=f(D)+Z,\quad Z\sim\operatorname{Laplace}(0,b)
$$

$f$ 是查詢，$D\sim D'$ 表示鄰近；全域敏感度 $\Delta f$ 是鄰近表的最大查詢差。$Z$ 為中心 0、尺度 $b$ 的拉普拉斯噪聲。

若 $\Delta f=0$，查詢在任何鄰近表上都不變，可直接釋出此查詢值。若敏感度無界，不能用有限尺度套此保證；$\epsilon=0$ 也不能直接代入本式的除法。

本例查氣喘人數，一人最多使計數改變 1，故 $\Delta f=1$；epsilon=0.5 時 $b=1/0.5=2$。若每人可能出現十列，不能直接沿用敏感度 1。

## 算一次（補充）

### 固定資料，先算未加噪查詢（補充）

沿用同組偏斜版；每份表各 12 人。只移除第一個索引，不動其他資料。

| 領域與查詢 | 原表 D | 刪一人 D′ | 計數差 |
|---|---|---|---|
| 醫療：氣喘人數 | 6／12 人 | 5／11 人 | 1 |
| 金融：正常繳款人數 | 6／12 人 | 5／11 人 | 1 |

這裡查的是「人數」，不是表格中的比率；分母顯示總人數以便追蹤刪除。這組鄰近表的計數差剛好是 1；因為每人最多一列，任何鄰近表的計數差都不會超過 1。

### 核對一個輸出集合（補充）

取 $S=[6,\infty)$，也就是輸出至少 6。對尺度 2 的拉普拉斯噪聲，原表計數為 6，所以落在集合內的機率為 0.5。

刪除後計數為 5，必須噪聲至少為 1，機率為 $0.5e^{-1/2}\approx0.303265$。兩邊的機率倍數為：

$$
0.5/(0.5e^{-1/2})=e^{0.5}\approx1.6487
$$

比值約 1.6487，等於 $e^{0.5}$，剛好碰到 epsilon=0.5 允許的上限。

這是讀懂機率界的算例。拉普拉斯機制的整體保證來自校準與證明，不能用一對資料、一張圖或這個事件的實測取代。

### 算噪聲與組合預算（補充）

教學種子 42 抽出的一次噪聲約 1.587757，原表輸出約 $6+1.587757=7.587757$。這個數字只核對加法；保證針對整個隨機分布，不取決於這次誤差看起來夠不夠大。

同一批人又接受一個 epsilon=0.3 的有效純 DP 查詢，基本循序組合為：

$$
\epsilon_{\mathrm{total}}\le\epsilon_1+\epsilon_2=0.5+0.3=0.8
$$

$\epsilon_1$、$\epsilon_2$ 是各次參數，左側為聯合釋出的隱私損失上界。預算上限 1，還可分配 $1-0.8=0.2$；後一次查詢不會消掉前一次的花費。

## 程式（補充）

程式重現 JSON 的偏斜版計數、刪除第一列與固定噪聲，再核對事件機率及預算。這是數值教學，實際隱私輸出不能用公開固定種子或重用已知噪聲。

本次以 Python 3.12.13、NumPy 2.5.4 核對種子 42 的噪聲與輸出。固定種子供此環境重現；NumPy Generator 不保證跨版本產生相同亂數。

```python
import math
import numpy as np
values = [0,0,0,1,0,0,0,1,1,1,2,2]
q = sum(v == 0 for v in values)
q_neighbor = sum(v == 0 for v in values[1:])
epsilon, sensitivity = 0.5, 1
scale = sensitivity / epsilon
noise = np.random.default_rng(42).laplace(0, scale)
print("計數", q, q_neighbor, "敏感度", sensitivity, "尺度", scale)
print(f"噪聲 {noise:.6f} 輸出 {q+noise:.6f}")
print(f"事件機率 0.500000 {0.5*math.exp(-1/scale):.6f}")
print(f"機率倍數界 {math.exp(epsilon):.6f}")
print(f"組合上界 {epsilon+0.3:.1f} 剩餘 {1-epsilon-0.3:.1f}")
```
```text
計數 6 5 敏感度 1 尺度 2.0
噪聲 1.587757 輸出 7.587757
事件機率 0.500000 0.303265
機率倍數界 1.648721
組合上界 0.8 剩餘 0.2
```

:::tip[讀碼重點]
`values[1:]` 只移除一人；尺度用敏感度除以 epsilon。種子只為核對輸出，不是生產環境的隱私隨機源。
:::

## 怎麼用、怎麼判讀

指引把差分隱私放在需要對外共享、研究公開、模型發布或第三方合作的保護規劃中。目的是和其他處理選項一起平衡隱私與效用，沒有宣稱一律適用。

:::supplement[來源：NIST SP 800-226 第 2.1、2.4、3.1 節]
先問保護單位是一列還是一人，再查每人貢獻界限、鄰近關係、機制與全部釋出的預算。噪聲愈大通常讓精度降低；不能只靠「有加噪」就認定滿足 DP。

K／L／T 檢查表內群組；DP 約束產生輸出的機制。DP 也不會阻止所有由全體規律推論個人的情況，更不保證原始資料儲存或傳輸已安全。
:::

### 換個場景

| 場景 | 使用條件 | 判讀重點 |
|---|---|---|
| 研究共享、模型發布 | 指引列為需考慮保護的情境 | 先辨認選項，再確認技術條件 |
| 醫療計數（補充） | 每位病人最多一筆貢獻 | 依人界定敏感度，追蹤重複查詢 |
| 金融統計（補充） | 查客戶人數而非交易筆數 | 一人多筆交易需限制貢獻 |
| 交通分析（補充） | 一人可能留下多段軌跡 | 記錄層保護不等於整人保護 |

## 常見誤解

- **任意隨機擾動就是 DP**：還需鄰近定義、敏感度與合格機制。（補充）
- **epsilon=0.5 就有 50% 洩漏率**：epsilon 限制機率分布的變化，不是成功率。（補充）
- **重複查詢不再花預算**：不同輸出的聯合釋出仍要組合記帳。（補充）

## 進階

### 邊界：這不是完整實務機制（補充）

此頁只教單一計數的純 DP 與基本循序組合，不實作差分隱私訓練。正式系統還要處理多筆貢獻、數值實作、隨機性、存取與預算管理，不宜直接把教學片段上線。

### 參考來源

- 科目 3 學習指引，`guide-3:6-12`：支持資料保護選項與共享情境的定位；沒有教本頁的形式定義。
- [NIST SP 800-226](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-226.pdf)，第 2.1.1、2.4、3.1 節：支持機率界、保護單位、機制與限制。
- [Programming Differential Privacy：Differential Privacy](https://programming-dp.com/chapter3/)：支持兩個世界的教學直覺、機率界與拉普拉斯機制。
- [Programming Differential Privacy：Sensitivity](https://programming-dp.com/chapter5/)：支持新增／刪除鄰近關係、計數全域敏感度與噪聲尺度。
- [Programming Differential Privacy：Properties](https://programming-dp.com/chapter4/)：支持同人查詢的基本循序組合與預算例子。
- [Dwork 與 Roth](https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf)，第 3.3 節定義 3.1–3.3、定理 3.6：支持拉普拉斯機制、敏感度及校準條件。
- [NumPy Generator 官方文件](https://numpy.org/doc/stable/reference/random/generator.html)，No Compatibility Guarantee：支持程式段的跨版本重現限制。

## 小結

- 指引把差分隱私列為資料保護選項。
- 形式保證要先界定鄰近資料與保護單位。（補充）
- 噪聲依敏感度與 epsilon 校準，不靠任意加噪。（補充）
- 同人的多次釋出需管理組合預算。（補充）
