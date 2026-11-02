---
id: reinforcement-learning-training
title: 強化學習訓練與成效驗證
kind: technique
codes: [L23201]
aliases: [Episode, 累積報酬]
summary: 訓練以互動與更新反覆改進，驗證則固定策略檢查整段任務表現
requires: [markov-decision-process]
goals:
  - id: g1
    text: 追蹤互動、更新與獨立評估循環，核算兩段episode的回報與成功率並辨認指標錯配
formula_groups:
  - id: episode-return
    source: https://spinningup.openai.com/en/latest/spinningup/rl_intro.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-D
  - id: episode-aggregation
    source: https://stable-baselines3.readthedocs.io/en/master/_modules/stable_baselines3/common/evaluation.html#evaluate_policy ; https://stable-baselines3.readthedocs.io/en/master/_modules/stable_baselines3/common/callbacks.html#EvalCallback
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23201-D
  - id: fixed-policy-expectation
    source: https://spinningup.openai.com/en/latest/spinningup/rl_intro.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 同一起點與五步上限，兩次倉儲測試回饋為[-1,-1,10]與[-1,-1,-1,-1,-1]，只有第一段交付成功。平均未折扣累積報酬及成功率為何？
    options: {A: '3分、100%', B: '1.5分、50%', C: '6.2分、50%', D: '-0.5分、0%'}
    answer: B
    explain:
      A: 兩段總和是8與-5，平均不是3，且有一段失敗。
      B: 每段先加總再平均得到(8-5)除以2等於1.5，成功1次除以2為50%。
      C: 6.2是成功段的折扣回報，不能代替兩段未折扣平均。
      D: -0.5不是兩段總和的平均，也忽略第一段成功。
  - id: c2
    goal: g1
    type: choice
    prompt: 系統只獎勵每次成功抓取8分；策略甲抓一次並交付，策略乙抓兩次卻未交付。甲得8、乙得16。怎麼判讀？
    options:
      A: 乙得16分是甲的兩倍，代表交付能力也是兩倍
      B: 乙得16分已足以選模，應刪除交付成功率指標
      C: 乙未交付卻得16分，顯示抓取獎勵與目標錯配
      D: 乙得16分只是折扣問題，改成1就能對準交付
    answer: C
    explain:
      A: 未交付的高分可能是獎勵漏洞，不能推論交付能力。
      B: 成功率正好能揭露分數與任務目標的落差。
      C: 同一獎勵規則下，未完成反而高分，顯示評估需檢查目標錯配。
      D: 此例8與16已是不折扣結果，改折扣不會修正給分目標。
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊每更新1000步，就在同一組測試環境繼續改權重，最後挑最高分模型，稱為獨立測試。主要問題是什麼？
    options:
      A: 每1000步做評估過於頻繁，強化學習只容許訓練結束後測試
      B: 每1000步應只看單步獎勵，累積報酬不適合用來挑選模型
      C: 測試環境應移除所有隨機性，才可以邊測試邊更新權重
      D: 測試已參與更新與選模，須另留最終環境並凍結學習
    answer: D
    explain:
      A: 可以定期驗證，問題是把測試混入學習與挑選流程。
      B: 評估要看整段長期表現與成功率。
      C: 隨機環境可評估，但需要重複並記錄設定。
      D: 保留最終測試且凍結更新，才能區分學習與驗證的角色。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-11]
---

## 為什麼需要

分類模型常在固定測試表上預測；強化學習的動作卻會改變後續遇到的資料。看某一步得幾分，無法知道整段任務做得如何。

指引要求用模擬或實際環境測試長期表現，觀察平均累積報酬、任務成功率、策略穩定性與收斂速度。

## 直覺

先給策略或價值函數一個起點，再互動、收集回饋、更新，接著重複。代理人不是先拿到全部正確動作標籤，才開始學習。

![訓練循環不斷更新；評估分支固定策略，讓成績對應同一個待測版本。](figure:l23201-reinforcement-learning-training-loop)

:::supplement[來源：Stable Baselines3 RL Tips 的 How to evaluate an RL algorithm]
一次從重設到結束的互動稱為一段episode。訓練時可以更新；驗證時固定權重、回饋規則與起點條件，記錄是否仍保留隨機選動作。
:::

## 定義與公式

平均累積報酬先把每段回饋累計，再跨段平均；成功率則檢查是否達成預定任務。兩者評估不同面向，不能互相取代。

### 單段與多段的數字（補充）

$$
R_i=\sum_{t=0}^{T_i-1}r_{i,t+1},\qquad
G_i=\sum_{t=0}^{T_i-1}\gamma^t r_{i,t+1}
$$

$i$ 是episode索引，$T_i$ 是這段步數，$r_{i,t+1}$ 是第 $t+1$ 步回饋。$R_i$ 不折扣，$G_i$ 以折扣因子 $\gamma$ 衡量延後獎勵；第一筆乘1。

$$
\overline R=\frac1N\sum_{i=1}^N R_i,\qquad
S=\frac1N\sum_{i=1}^N z_i
$$

$N$ 是有效測試段數，須為正整數；沒有任何有效 episode 時，兩項指標都未定義，不報為0。$z_i$ 在成功時為1、否則為0，$S$ 是成功比例。若改用折扣回報平均，須明確另標，不能混用不同尺度。

### 固定策略的期望（補充）

若轉移規則已知，可列舉所有結果，算有限步的期望回報：

$$
\begin{aligned}
V_0^\pi(s)&=0\\
V_h^\pi(s)&=\sum_{s',r}p(s',r\mid s,\pi(s))
\left[r+\gamma V_{h-1}^\pi(s')\right]
\end{aligned}
$$

$\pi$ 是此例固定的確定性策略，$h$ 是剩餘步數，$p$ 是下一狀態與回饋的機率。$V_h^\pi$ 是期望，與某次抽中的軌跡不同；任務終止後的價值定為0。

## 走一次流程

1. 初始化策略或價值估計。
2. 與環境互動，記下狀態、動作、回饋與下一狀態。
3. 依回饋更新策略或價值。
4. 重複訓練，觀察決策是否改善。
5. 另在固定評估條件下測試，凍結學習並保存結果。（補充）

### 同表重播兩段紀錄（補充）

倉儲沿用A起點、最多五步、進D立即結束。兩段記錄是教學指定軌跡，不是隨機測試得到的代表樣本。

| episode與轉移索引 | 未折扣總和 | 折扣0.9回報 | 成功 |
|---|---:|---:|---|
| 交付：W01、W05、W07 | 8 | 6.2 | 是 |
| 重複抓取：W01、W05、W09、W05、W09 | -5 | -4.0951 | 否 |

兩段平均未折扣報酬為 $(8-5)/2=1.5$，成功率為 $1/2=50\%$。折扣平均則為 $(6.2-4.0951)/2=1.05245$。

若改成「每次抓取給8，其他0」，交付段總和8、未交付段16，分數反而偏好失敗行為。這是在同一錯配規則內比較，提醒要另看成功率與獎勵設計。

### 再核對固定策略（補充）

為了能手算列舉，這裡把同一環境的觀察窗縮為前三步，轉移規則不變。

倉儲策略是A前進、B抓取、C交付；C剩一步時，期望 $0.9\times10+0.1\times(-1)=8.9$，成功一次的10分不能代替它。

從A出發，三步預期回饋為-1、-1、5.336，故 $V_3^\pi(A)=-1-0.9+0.81\times5.336=2.42216$。成功軌跡的6.2只是其中一種結果。

能源策略為E3放電、其餘充電。三步預期回饋3.2、-0.96、2.368，回報 $3.2-0.864+1.91808=4.25408$；這只核算期望，沒有泛化結論。

## 程式（補充）

自足片段摘錄固定策略會用到的轉移，再列舉三步結果並加權。每個三元組依序為機率、下一狀態、回饋；D的空清單表示終止。沒有隨機抽樣，不需要亂數種子。

```python
from functools import lru_cache
worlds = {
    "warehouse": ("A", {
        "A": [(0.8, "B", -1), (0.2, "A", -1)],
        "B": [(0.8, "C", -1), (0.2, "B", -1)],
        "C": [(0.9, "D", 10), (0.1, "C", -1)], "D": []}),
    "energy": ("E3", {
        "E0": [(0.8, "E1", -2), (0.2, "E0", -1)],
        "E1": [(0.8, "E2", -2), (0.2, "E1", -1)],
        "E2": [(1.0, "E3", -2)],
        "E3": [(0.8, "E2", 4), (0.2, "E3", 0)]})}
for name, (start, transitions) in worlds.items():
    @lru_cache(None)
    def value(state, steps):
        if steps == 0:
            return 0.0
        return sum(p * (r + 0.9 * value(next_state, steps - 1))
                   for p, next_state, r in transitions[state])
    print(f"{name}: {value(start, 3):.4f}")
```
```text
warehouse: 2.4222
energy: 4.2541
```

:::tip[讀碼重點]
轉移清單已固定選動作，再對該動作的所有結果加權。倉儲D會終止，能源E0仍可充電；三步觀察窗不代表兩種環境都有終止狀態。
:::

## 怎麼用、怎麼判讀

平均報酬回答「每段拿多少分」，成功率回答「多少段真的完成」。指引也列出策略穩定性與收斂速度。

:::supplement[來源：Stable Baselines3 RL Tips 的 General advice、How to evaluate an RL algorithm]
穩定性可觀察分數是否大幅波動；收斂速度可觀察達到指定表現用了多少互動。

訓練、選模型與最終測試分開安排環境種子或情境。固定步數、起點分布、成功定義與獎勵尺度，再跨多個訓練種子重複，避免只報最好的一次。

上表兩段指定紀錄只用來核算，不能據50%推估實際成功率。已知小環境的精確期望，也不能代替真實場景測試。
:::

### 換個場景

| 場景與條件 | 長期報酬之外 | 驗證重點 |
|---|---|---|
| 遊戲或對弈 | 勝率 | 不用單步得分代替終局表現 |
| 機器人與物流 | 到達或交付成功率 | 看整段操作是否完成 |
| 推薦與廣告 | 長期使用者價值 | 避免只看即時反饋 |
| 儲能調度（補充） | 缺電與保留電量 | 固定觀察窗，電量0不一定終止 |
| 客服流程（補充） | 問題解決率 | 結案分數升高仍可能未解決 |

:::supplement[來源：Stable Baselines3 RL Tips；本頁指標配對示例]
遊戲、機器人與推薦等場景來自指引；表內的指標配對與驗證重點是本頁補充，須依實際任務定義。
:::

## 常見誤解

- 平均累積報酬不是每一步回饋的平均；不同長度episode要先各自加總。（補充）
- 任務高分與成功可能不同向，尤其獎勵規則沒有對準目標時。
- 評估中繼續更新，無法把整批結果歸給同一個策略版本。（補充）
- 環境停止要分清任務終止與外部截斷，後者不代表後續價值為0。（補充）

## 進階

### 參考來源

- 科目3指引 `guide-3:4-11`：支持訓練循環、長期績效、成功率、穩定性與場景。
- [Spinning Up Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html)：支持「定義與公式」的回報、價值與期望核算。
- [Stable Baselines3 RL Tips](https://stable-baselines3.readthedocs.io/en/master/guide/rl_tips.html)：支持平均評估、獨立環境與多次實驗；參考其分開訓練與驗證的教法。
- [SB3 evaluate_policy原始碼](https://stable-baselines3.readthedocs.io/en/master/_modules/stable_baselines3/common/evaluation.html#evaluate_policy)：支持跨episode平均報酬的公式。
- [SB3 EvalCallback原始碼](https://stable-baselines3.readthedocs.io/en/master/_modules/stable_baselines3/common/callbacks.html#EvalCallback)：支持把每段成功旗標取平均，前提是每段都有成功紀錄。
- [David Silver Lecture 5](https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-5-model-free-control-.pdf)：支持先定策略、再估計價值的教學對照。
- [Gymnasium Handling Time Limits](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/)：支持「常見誤解」的終止與截斷區分。

## 小結

- 互動、收集、更新、重複，構成訓練循環。
- 整段報酬、成功率與穩定性一起判讀，才不容易把得分當成完成。
- 固定策略的期望與單次軌跡不同，評估時也要凍結學習。（補充）
