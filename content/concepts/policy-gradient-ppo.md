---
id: policy-gradient-ppo
title: 策略梯度與 PPO
kind: model
codes: [L21301]
aliases: [Actor-Critic, PPO, Policy Gradient, REINFORCE]
summary: 策略梯度直接改善選動作的規則，PPO抑制過大的策略更新誘因
requires: [reinforcement-learning-methods, gradient-descent]
contrasts:
  - target: q-learning-dqn
    note: 值方法先估計各動作Q值再選擇；策略方法直接改善動作分布，PPO另抑制過大的更新誘因
    source: [guide-1:5-11, guide-1:5-12]
goals:
  - id: g1
    text: 比較值方法與直接學策略，說明REINFORCE、Actor-Critic與PPO的定位
  - id: g2
    text: 依離散或連續動作選擇方法，核對PPO更新幅度的示意並說明其穩定性限制
formula_groups:
  - id: ppo-clipped-surrogate
    source: https://spinningup.openai.com/en/latest/algorithms/ppo.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 控制器直接更新兩個動作的機率，另用價值網路協助判斷某個動作是否比平常好。這最符合哪個描述？
    options:
      A: Q-learning直接學動作機率，另一網路預測環境轉移
      B: 有模型方法只需策略與價值，兩網路即構成環境模型
      C: REINFORCE必須有價值網路，否則無法用完整回報更新
      D: Actor-Critic由Actor學策略，Critic提供價值評估
    answer: D
    explain:
      A: Q-learning學動作價值，並非直接學機率；題幹也未描述轉移預測。
      B: 策略和價值網路都不等於預測環境轉移的模型。
      C: REINFORCE可以用完整軌跡回報更新，不必另有價值網路。
      D: 直接學選動作的規則，並以價值估計協助，是Actor-Critic的分工。
  - id: c2
    goal: g2
    type: choice
    prompt: 倉儲交付的舊機率0.5、新機率0.8，優勢估計2，PPO-Clip的c=0.2。此樣本的裁剪目標貢獻為多少？
    options: {A: '3.2', B: '2.4', C: '0.6', D: '0.2'}
    answer: B
    explain:
      A: 3.2是未裁剪的1.6乘2，尚未與裁剪項取較小值。
      B: 機率比1.6裁至1.2，兩項3.2與2.4取較小值，得到2.4。
      C: 0.6是舊機率0.5乘1.2，並非目標貢獻。
      D: 0.2是裁剪參數，不是回報或目標值。
  - id: c3
    goal: g2
    type: choice
    prompt: 機械臂要輸出連續角度，團隊考慮PPO，並聲稱c=0.2能保證每個動作機率最多變20%且一定全域最佳。怎麼修正？
    options:
      A: PPO可用連續策略；c=0.2非硬性機率界線，也不保證全域最佳
      B: PPO只適用離散策略；c=0.2限制角度範圍，任意角度應用標準DQN
      C: PPO可用連續策略；c=0.2能保證每次回報上升，最終必達全域最佳
      D: PPO可用連續策略；c=0.2已能取代獨立評估，只要增加訓練次數
    answer: A
    explain:
      A: 要讓策略輸出匹配控制量，並用評估監測實際更新與表現。
      B: PPO能處理連續動作，c也不是角度界線；標準DQN不直接枚舉任意角度。
      C: 裁剪改變樣本目標的誘因，不能保證整體回報單調提高。
      D: 訓練增加仍可能不穩定，更新後需要獨立驗證。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-11, guide-1:5-12, guide-3:4-10]
---

## 為什麼需要

值方法先問「各動作值多少」，再挑動作。策略梯度（Policy Gradient）直接調整「在這個狀態怎麼選」，以提高長期的期望報酬。

直接改策略仍可能改過頭。近端策略優化（Proximal Policy Optimization，PPO）把更新幅度納入考慮，減少一次大改造成表現崩落的風險。

## 直覺

倉儲在C交接格，值方法比較交付與放回的Q值；策略方法則可以直接輸出兩者的機率。改善策略，就是讓較有利的選擇變得更常出現。

| 方法角色 | 主要學什麼 | 如何選動作 |
|---|---|---|
| Q-learning與DQN | 動作價值 | 依Q值導出選擇 |
| 策略梯度 | 動作分布的參數 | 依策略分布選擇 |
| PPO | 以受抑制的大幅更新改善策略 | 仍由策略選動作 |

:::supplement[來源：Spinning Up PPO 的 Key Equations]
以下只討論PPO-Clip。圖中的舊策略交付機率0.5，新候選0.8；裁剪減少「繼續推高好動作機率」的額外誘因，並不把新機率強制改回0.6。
:::

![交付機率從0.5到0.8時，機率比為1.6；裁剪目標已達平台，但候選策略仍可超出參考位置。](figure:l23201-policy-gradient-ppo-policy-update)

## 定義與公式

策略梯度直接學習由狀態到動作分布的規則，更新方向要提高期望報酬。

| 名稱 | 指引中的定位 |
|---|---|
| REINFORCE | 策略梯度的代表方法 |
| Actor-Critic | 指引列出的代表架構 |
| PPO | 策略梯度的改良演算法，考慮更新幅度 |

### 從回報到更新訊號（補充）

和最小化損失的梯度下降相比，最大化報酬採上升方向；實作也可把目標取負再最小化。

REINFORCE可用完整軌跡的回報更新策略，等待結束才知道好壞，估計可能波動。Actor-Critic由Actor選動作，Critic估計價值，提供更有資訊的更新訊號。

優勢估計（Advantage Estimate）衡量這次動作相對於該狀態一般表現好多少。正值鼓勵提高選擇機率，負值鼓勵降低；Critic的估計若不準，也會影響策略更新。

### PPO-Clip的單樣本目標（補充）

$$
\begin{aligned}
\rho&=\frac{\pi_{\theta}(a\mid s)}{\pi_{\mathrm{old}}(a\mid s)}\\
L&=\min\left(\rho\widehat A,
\operatorname{clip}(\rho,1-c,1+c)\widehat A\right)
\end{aligned}
$$

$\pi_{\theta}$ 是新策略，$\pi_{\mathrm{old}}$ 是收集這批資料的舊策略，$\rho$ 是同狀態同動作的新舊機率比。連續動作使用機率密度之比，分母須非零。

$\theta$ 是新策略的參數，$s$ 是狀態，$a$ 是在該狀態選取的動作。

$\widehat A$ 是優勢估計，$c$ 是裁剪參數，clip把比值截到指定區間，$L$ 是此樣本對待最大化目標的貢獻。實際訓練會平均一批樣本，並搭配價值等項目。

此處的 $c$ 不是ε-greedy的探索機率。裁剪改變最佳化誘因，不是把每個新策略機率都限制在硬邊界內。

## 算一次（補充）

### 交付與放回共用舊新策略

資料來自 `L23201-D-warehouse.json`。舊策略兩動作各0.5，新候選交付0.8、放回0.2；優勢為另給的教學訊號，不由Q頁的快照推算。

固定 $c=0.2$，比值裁剪區間為[0.8,1.2]：

| 動作 | 舊→新機率 | 優勢 | 原項／裁剪項→取小 |
|---|---|---:|---|
| 交付 | 0.5→0.8 | 2 | 3.2／2.4→2.4 |
| 放回 | 0.5→0.2 | -2 | -0.8／-1.6→-1.6 |

交付的比值是 $0.8/0.5=1.6$，原項 $1.6\times2=3.2$，裁剪項 $1.2\times2=2.4$。取小後是2.4，繼續推高該比值不再增加此樣本的這項目標。

放回的比值 $0.2/0.5=0.4$，原項-0.8，裁剪項 $0.8\times(-2)=-1.6$。取小得到-1.6；不能不看正負號就只截上界。

比值低於0.8後，此樣本的這項目標固定為-1.6。繼續壓低放回機率，不再增加這項目標。

### 換成能源控制

能源E2的舊機率充電與放電各0.5，新候選充電0.8、放電0.2，給定優勢2與-2。相同計算得到2.4與-1.6，領域不同不改變裁剪規則。

這只是在核算指定策略的樣本貢獻，沒有宣稱這個新候選是一次PPO訓練產生。也不能直接把兩列相加當作完整訓練目標，因為尚未指定批次樣本權重。

## 程式（補充）

自足片段摘錄共用JSON的舊、新機率與優勢，核對兩種符號；不訓練策略，也沒有抽樣。

```python
policies = {"warehouse": [("advance", 0.5, 0.8, 2), ("handle", 0.5, 0.2, -2)],
            "energy": [("charge", 0.5, 0.8, 2), ("discharge", 0.5, 0.2, -2)]}
for domain, rows in policies.items():
    for action, old, new, advantage in rows:
        ratio = new / old
        clipped = min(1.2, max(0.8, ratio))
        objective = min(ratio * advantage, clipped * advantage)
        print(f"{domain}/{action}: 比值={ratio:.1f}, 貢獻={objective:.1f}")
```
```text
warehouse/advance: 比值=1.6, 貢獻=2.4
warehouse/handle: 比值=0.4, 貢獻=-1.6
energy/charge: 比值=1.6, 貢獻=2.4
energy/discharge: 比值=0.4, 貢獻=-1.6
```

:::tip[讀碼重點]
先算同一動作的新舊機率比，再裁剪，最後才乘優勢並取小。負優勢的大小次序會反轉，所以不能把公式改成一律取較小比值。
:::

## 怎麼用、怎麼判讀

指引以遊戲與機器人說明PPO的用途。它試圖平衡策略變動與學習效率，但更新後仍應驗證回報、成功率與穩定性。

### 依動作空間選擇（補充）

| 任務介面 | 值方法候選 | 策略方法候選 |
|---|---|---|
| 四格倉儲、兩個選項 | 小型Q表 | 離散動作策略 |
| 影像觀測、有限按鍵 | DQN | 影像輸入的離散策略 |
| 任意角度或功率 | 標準DQN不能直接枚舉 | 可用匹配控制量的連續策略 |

PPO可搭配離散或連續策略，不能只看方法名稱就跳過輸出設計。它通常使用近期策略收集的資料，不是把任意年代的回放資料直接混在一起就可照用。

裁剪不能保證所有狀態的機率變動都小，也不保證每次回報上升或全域最佳。有些實作另監測新舊策略差異並提早停止更新，仍需實際評估。

### 換個場景

| 場景與條件 | 策略輸出 | 判讀重點 |
|---|---|---|
| 遊戲 | 按鍵機率 | 改善整局結果 |
| 機器人與車輛 | 指令或控制量 | 匹配離散與連續介面 |
| 智慧倉儲與資源配置 | 搬運或分配規則 | 看多步效率與限制 |
| 儲能功率（補充） | 連續充放電量 | 改介面時重新設定動作分布 |
| 灌溉（補充） | 閥門檔位或水量 | 檢查更新後用水與任務結果 |

## 常見誤解

- Actor-Critic同時估價值，不會因此失去直接學策略的性質。
- PPO-Clip的0.2是機率比參考範圍，不是新機率固定加減0.2。（補充）
- 目標裁剪不等於硬性限制每個參數或每個動作機率。（補充）
- 連續策略可以處理連續動作，但穩定或最佳仍須驗證。（補充）

## 進階

### 參考來源

- 科目1指引 `guide-1:5-11`、`guide-1:5-12`：支持策略方法定位與PPO控制更新幅度；科目3 `guide-3:4-10` 支持分類。
- [Spinning Up PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)：支持裁剪公式、正負優勢的解讀與非硬性限制；參考其分正負兩種情況的教法。
- [PPO原論文](https://arxiv.org/abs/1707.06347)：支持PPO以互動資料與替代目標反覆更新的定位。
- [David Silver Lecture 7](https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-7-policy-gradient-methods.pdf)：支持REINFORCE、Actor-Critic與優勢的教學延伸。
- [Spinning Up Policy Optimization](https://spinningup.openai.com/en/latest/spinningup/rl_intro3.html)：支持最大化期望回報、回報估計與價值基線的角色。
- [Stable Baselines3 RL Tips](https://stable-baselines3.readthedocs.io/en/master/guide/rl_tips.html)：支持依動作空間選型與更新後驗證。

## 小結

- 值方法估計動作價值，策略方法直接改善選擇規則。
- PPO抑制過大的更新誘因，降低訓練崩落風險。
- 裁剪不是硬性機率界線，也不保證單調改善或全域最佳。（補充）
