---
id: reinforcement-learning-methods
title: 強化學習方法分類
kind: technique
codes: [L23201]
aliases: [Model-Based RL, Model-Free RL]
summary: 分類強化學習方法時，分開看學什麼與是否用環境模型
requires: [markov-decision-process]
goals:
  - id: g1
    text: 用兩個分類軸辨認策略式、價值式、有模型與無模型方法，避免把經驗回放當必要條件
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊用12條倉儲經驗直接更新每個狀態與動作的Q值，再依Q值選動作；沒有預測下一狀態的模型。如何分類？
    options:
      A: 策略式、有模型
      B: 價值式、有模型
      C: 價值式、無模型
      D: 策略式、無模型
    answer: C
    explain:
      A: 直接更新的是Q值，且沒有使用轉移預測模型。
      B: 有資料或Q表不代表持有環境轉移模型。
      C: 學動作價值並據此選擇，且未用環境模型規劃，符合此配對。
      D: 由Q值導出選擇規則，不等於直接最佳化策略參數。
  - id: c2
    goal: g1
    type: choice
    prompt: 另一團隊直接更新兩個動作的選擇機率，每輪只用剛收集的經驗，沒有經驗回放池，也沒有轉移模型。哪個判斷合理？
    options:
      A: 沒有經驗回放，所以不算強化學習
      B: 可屬策略式、無模型方法
      C: 只要輸出機率就一定是有模型方法
      D: 策略式方法不能同時估計價值
    answer: B
    explain:
      A: 經驗回放是部分演算法的機制，不是強化學習的定義。
      B: 直接改善選動作的規則，且未使用環境模型，符合這兩個分類軸。
      C: 動作機率是策略輸出，與預測環境轉移的模型不同。
      D: Actor-Critic可同時學策略與價值，兩者可以配合。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-10, guide-1:5-11, guide-1:5-12]
---

## 為什麼需要

「策略式、價值式、有模型、無模型」看似四種互斥方法，實際上回答不同問題。分錯分類軸，就會誤以為學Q值一定得先學會預測環境。

## 直覺

沿用四格倉儲。知道「在C選交付」、估計「交付長期可得幾分」、預測「交付後會到D或留C」，是三種不同資訊。

| 物件 | 回答的問題 | 共用例子的對應 |
|---|---|---|
| 策略 | 現在選什麼動作？ | 在C選作業前進 |
| 價值 | 這樣做長期有多好？ | C剩一步時，交付期望8.9分 |
| 環境模型 | 做了之後會怎樣？ | 交付成功機率0.9，失敗0.1 |
| 獎勵 | 單次結果給幾分？ | 成功交付10分，失敗-1分 |

:::supplement[來源：Spinning Up Part 2 的 What to Learn]
表中8.9來自同一轉移表的加權計算，不是另一組訓練結果。這種比較只說明物件角色，還沒有實作學習演算法。
:::

## 定義與公式

第一軸看主要學習對象：

- 策略學習（Policy Learning，本頁也稱策略式）：直接改善選動作的規則。
- 價值學習（Value-Based，本頁也稱價值式）：估計狀態或狀態與動作的長期價值，再據此選動作。

第二軸看是否使用環境模型：

- 模型式學習（Model-Based RL，本頁也稱有模型）：利用環境轉移與回饋機制改善決策。
- 模型無關學習（Model-Free RL，本頁也稱無模型）：從互動經驗學習，不必先建立環境預測模型。

:::supplement[來源：Spinning Up Part 2 的 Model-Free vs Model-Based RL、What to Learn]
兩軸可組合，並不是互斥的四個盒子。有模型方法可用已知規則，也可學一個預測模型；重點是是否用模型推演結果或規劃。
:::

| 是否用環境模型 | 主要學策略 | 主要學價值 |
|---|---|---|
| 無模型 | REINFORCE等策略梯度方法 | 表格式Q-learning、DQN |
| 有模型 | 用模型規劃，再改善策略 | 用模型推演結果，更新價值 |

策略梯度（Policy Gradient）與Q-learning分別是指引的代表例。更完整的更新步驟見「策略梯度與 PPO」與「Q-learning 與 DQN」兩頁。

:::supplement[來源：David Silver的Policy Gradient課程；Spinning Up Part 2 的 Interpolating Between Policy Optimization and Q-Learning]
Actor-Critic同時學策略與價值：策略負責選動作，價值估計幫助更新策略。因此「有價值函數」本身不足以判成純價值式方法。
:::

## 走一次流程（補充）

用 `L23201-C-warehouse.json` 的同一份12條轉移，辨認三種做法。都沿用A起點、折扣0.9，不另編樣本或訓練分數。

1. **只拿互動紀錄更新Q表**：學的是價值；即使經驗存成表格，只要未用它預測轉移並規劃，仍可屬無模型。
2. **直接更新動作機率**：學的是策略；若只從實際互動的結果更新，可屬無模型策略式方法。
3. **把轉移表交給規劃器**：先推演交付成功與失敗的結果，再改善決策；這用了環境模型。若只有已知模型上的規劃，本身不一定含模型學習。

第三種用同表算出C剩一步的交付期望8.9；第一種則可從反覆經驗估計動作價值。目的可相同，取得資訊的方式不同。

再把表換成 `L23201-C-energy.json`：直接學各電量的充放電價值仍屬價值式；預測充電是否成功再往前推演，則使用環境模型。應用領域不會自行決定分類。

## 怎麼用、怎麼判讀

先問「更新的主要對象是策略還是價值」，再問「是否用環境模型推演」。不要用「有沒有神經網路」判斷有模型或無模型；DQN的網路近似Q值，並不因此成為環境模型。

:::supplement[來源：Spinning Up Part 2 的 What to Learn in Model-Free RL；David Silver的Policy Gradient課程]
指引把無模型學習連到試誤與經驗回放（Experience Replay），但回放並非必要。表格式Q-learning可逐步更新；REINFORCE可用當輪軌跡，不需跨輪回放池。
:::

### 換個場景

| 場景與條件 | 先辨認什麼 | 判讀重點 |
|---|---|---|
| 小型離散環境 | Q表與選動作的規則 | 指引以Q-learning為例 |
| 遊戲影像輸入 | 網路是否輸出Q值 | DQN可處理高維輸入 |
| 機器人控制 | 是否直接改善策略 | 指引列策略梯度與PPO |
| 儲能調度（補充） | 是否先預測電量轉移 | 有電池模型才能用它推演 |
| 灌溉排程（補充） | 是否模擬土壤水分 | 場景相同也可採不同兩軸組合 |

## 常見誤解

- 無模型不是「完全沒有數學模型」，而是不需要用環境轉移模型來學決策。
- 儲存經驗不等於學到轉移模型，回放經驗也不是所有無模型方法的必要步驟。（補充）
- 策略式也能搭配價值函數；要看各物件在更新中扮演什麼角色。（補充）

## 進階

### 參考來源

- 科目3指引 `guide-3:4-10`：支持四個分類名稱與Q-learning、策略梯度例子。
- 科目1指引 `guide-1:5-11`、`guide-1:5-12`：支持小型離散Q-learning、高維DQN、策略梯度與PPO的場景。
- [Spinning Up：Kinds of RL Algorithms](https://spinningup.openai.com/en/latest/spinningup/rl_intro2.html)：支持兩個分類問題、已知或學得模型、混合策略與價值方法的補充。
- [David Silver：Policy Gradient](https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-7-policy-gradient-methods.pdf)：REINFORCE與Actor-Critic課程頁支持無回放必要條件及混合方法說明。

## 小結

- 策略式與價值式問主要改善什麼；有模型與無模型問是否用環境模型。
- Q值預測長期回報，環境模型預測下一狀態與回饋，兩者用途不同。
- 經驗回放是實作選項，不能當成無模型學習的定義。
