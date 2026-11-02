---
id: q-learning-dqn
title: Q-learning 與 DQN
kind: model
codes: [L21301]
aliases: [DQN, Q-learning]
summary: Q-learning學動作的長期價值，DQN用神經網路近似這些Q值
requires: [reinforcement-learning-methods, exploration-exploitation]
goals:
  - id: g1
    text: 比較Q表與神經網路近似，辨認小型狀態及高維影像的表示需求
  - id: g2
    text: 完成一次Q值更新，說明探索選動作、最大值目標及離散動作限制
formula_groups:
  - id: q-update
    source: https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-5-model-free-control-.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 倉儲觀測從4種狀態改成影像，但仍只有前進、抓取兩個動作。Q表與DQN的比較何者正確？
    options:
      A: DQN用網路近似Q值，適合表格難以列舉的高維觀測；動作仍是離散
      B: DQN必須先預測所有下一狀態的機率，才算無模型
      C: 影像輸入會自動把兩個動作變成連續動作
      D: Q表中的4分表示該動作有400%機率被選
    answer: A
    explain:
      A: 改變的是Q值的表示方式，觀測維度與動作形式是不同條件。
      B: DQN的Q網路估計價值，不必先建立環境轉移模型。
      C: 動作集合仍是兩選一，與像素是否連續無關。
      D: Q值是長期回報的估計，沒有機率的0到1限制。
  - id: c2
    goal: g2
    type: choice
    prompt: 原Q(B,抓取)=1，抓取後獎勵-1、到C；C的兩個Q值為4與2，α=0.5、γ=0.9，尚未終止。新Q值多少？
    options: {A: '2.6', B: '1.0', C: '1.8', D: '0.8'}
    answer: C
    explain:
      A: 2.6是更新目標，尚未與原Q值按學習率混合。
      B: 有非零的估計誤差，更新後不會仍是1。
      C: 目標-1加0.9乘4等於2.6，再以1加0.5乘1.6得1.8。
      D: 0.8是此次增量，還要加回原Q值1。
  - id: c3
    goal: g2
    type: choice
    prompt: C交付後真正進入終止狀態D，獎勵10、原Q=4、α=0.5。即使程式殘留D的Q值100，正確更新應為？
    options: {A: '52', B: '7', C: '10', D: '94'}
    answer: B
    explain:
      A: 52把終止後殘留的Q值100錯誤折扣進目標。
      B: 真正終止不再接續價值，所以4加0.5乘(10-4)等於7。
      C: 10是目標，學習率0.5不會一次完全替換舊值。
      D: 94把終止後的Q值仍折扣加入舊值，且漏掉回饋與學習率。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-11, guide-3:4-10]
---

## 為什麼需要

代理人看到現在得-1分，還要知道這個動作是否讓之後更容易拿10分。Q-learning把「先做這個動作，往後有多好」存成Q值，再用它決策。

狀態少時可以查表；若狀態是影像，逐張列一列難以擴充。深度Q網路（Deep Q Network，DQN）改用神經網路近似Q值，讓高維感知也能接上值方法。

## 直覺

Q表的每格對應一組狀態與動作。DQN則把狀態表示送進網路，輸出各個可選動作的Q估計；兩者學的都是價值，不是動作標籤。

| 表示 | 四格倉儲 | 影像倉儲 |
|---|---|---|
| 表格式Q-learning | 列出A至D與兩個動作 | 每種影像各一列不實用 |
| DQN | 可用，但未必需要 | 網路從影像近似各動作Q值 |

![上半比較查表與網路的表示；下半把舊Q值往更新目標移動，而非直接換成獎勵。](figure:l23201-q-learning-dqn-value-update)

:::supplement[來源：PyTorch DQN Tutorial 的 Q-network；Spinning Up Kinds of RL Algorithms]
網路輸出值可為負，也不必加總為1。標準DQN的離散動作輸出頭，與直接輸出動作機率的策略網路不同。
:::

## 定義與公式

Q-learning是價值學習：估計狀態與動作的長期回報，利用時選最大Q值的動作。DQN以深度神經網路近似此函數，指引以高維影像及Atari遊戲說明用途。

### 一步更新（補充）

$$
\begin{aligned}
y&=r+\gamma(1-d)\max_{a'}Q(s',a')\\
Q_{\mathrm{new}}(s,a)&=Q(s,a)+\alpha\left[y-Q(s,a)\right]
\end{aligned}
$$

$s,a$ 是本次狀態與動作，$s'$ 是觀察到的下一狀態，$r$ 是本步回饋。$a'$ 遍歷下一狀態的合法動作，$y$ 是目標值。

$\alpha$ 是學習率，本頁取 $0<\alpha\leq1$；小於1時部分移向目標，等於1時直接替換。

$\gamma$ 是折扣因子，沿用馬可夫決策過程與報酬頁的條件：有限期可取0至1；無限期且獎勵有界時，取0至小於1。

$d$ 在真正終止時為1，否則為0。單次經驗不等於完整的期望價值。

真正終止後不再累積獎勵，故目標只剩 $r$。外部時間截斷不能直接當作終止；有限任務本身的截止時間，則須連同剩餘時間一起建模。

## 算一次（補充）

### 倉儲：抓取後到交接格

使用 `L23201-D-warehouse.json` 的舊快照：B抓取為1；C交付為4、放回為2。抽中的W05從B抓取到C，獎勵-1，並未終止。

| 項目 | 代入 | 結果 |
|---|---|---:|
| 下一狀態最佳估計 | max(4,2) | 4 |
| 更新目標 | -1+0.9×4 | 2.6 |
| 估計誤差 | 2.6-1 | 1.6 |
| 新Q值 | 1+0.5×1.6 | 1.8 |

探索時可能在C選放回，但此次Q-learning目標仍用最大值4，不跟著抽中的下一個動作改成2。行為可以探索，學習目標則朝向貪婪決策。

若改看W07交付，C交付的舊Q值4、獎勵10且進D終止，更新為 $4+0.5(10-4)=7$。不再接續D的價值。

### 能源：同公式換回饋

能源E07是E2充電到E3，回饋-2；舊Q為1，E3最大Q為4。目標 $-2+0.9\times4=1.6$，新值 $1+0.5(1.6-1)=1.3$。

這三次更新各自使用原快照，不把前一個算例的新值偷偷帶入下一個。Q值都是教學設定，沒有宣稱訓練已收斂。

## 程式（補充）

自足片段摘錄同一快照的舊Q、本步回饋、下一狀態Q值與終止旗標。終止例故意保留錯誤的100，檢查程式是否排除後續價值。

```python
cases = [("warehouse", 1, -1, [4, 2], False),
         ("energy", 1, -2, [0, 4], False),
         ("真正終止", 4, 10, [100, 100], True)]
for name, old, reward, next_q, done in cases:
    future = 0 if done else max(next_q)
    target = reward + 0.9 * future
    new = old + 0.5 * (target - old)
    print(f"{name}: 目標={target:.2f}, 新Q={new:.2f}")
```
```text
warehouse: 目標=2.60, 新Q=1.80
energy: 目標=1.60, 新Q=1.30
真正終止: 目標=10.00, 新Q=7.00
```

:::tip[讀碼重點]
`max` 查的是下一狀態的全部合法動作，並非目前狀態。`future=0` 只用於真正終止；每列各用原快照，不會因算例順序改變結果。
:::

## 怎麼用、怎麼判讀

小型離散狀態可先用Q表確認任務。若狀態是影像或其他高維表示，可考慮DQN；換網路並不自動解決探索不足與獎勵錯配。

### DQN的穩定機制（補充）

經驗回放（Experience Replay）儲存轉移，再抽小批次訓練，降低樣本相關性。目標網路（Target Network）提供慢變的價值目標，減少追逐變動目標的震盪。

DQN以損失函數讓目前預測靠近目標，再對網路權重做梯度更新，不是把網路中的一個格子改成1.8。使用神經網路後，也不能直接套用表格式方法的收斂保證。

### 換個場景

| 場景與資料條件 | 適合的表示 | 判讀 |
|---|---|---|
| 小型離散環境 | Q表 | 狀態與動作可列舉 |
| Atari等遊戲影像 | DQN | 高維觀測，動作仍可列舉 |
| 智慧倉儲 | 依狀態大小選表或網路 | 搬運序列影響交付 |
| 儲能檔位控制（補充） | 小表或值網路 | 充一格、放一格是離散選項 |
| 灌溉閥門檔位（補充） | 值方法候選 | 先確認檔位有限與回饋可取得 |

### 連續動作的界線

指引 `guide-1:5-11` 將Q-learning用於動作可列舉、規模較小的環境。

:::supplement[來源：Spinning Up Kinds of RL Algorithms]
標準DQN比較離散動作的Q值，不能直接列舉任意轉向角或功率。可考慮連續動作策略，或評估離散化的代價。
:::

## 常見誤解

- Q值不是下一步的獎勵，而是含後續決策的長期價值估計。
- 探索改變蒐集到的動作，不會把Q-learning目標中的最大值改成隨機抽樣。（補充）
- DQN學的是Q函數，不因使用網路就變成環境模型。（補充）
- 經驗回放與目標網路用來改善訓練，並不保證一定穩定或全域最佳。（補充）

## 進階

### 參考來源

- 科目1指引 `guide-1:5-11`：支持Q表、神經近似、小型離散環境與高維影像場景；科目3 `guide-3:4-10` 支持價值學習分類。
- [David Silver Lecture 5，Q-Learning](https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-5-model-free-control-.pdf)：支持更新式、探索行為與最大值目標的區分，並參考其一步更新的講法。
- [PyTorch DQN Tutorial](https://docs.pytorch.org/tutorials/intermediate/reinforcement_q_learning.html)：支持「直覺」的輸出、經驗回放及目標網路；本頁程式只實作表格更新。
- [Gymnasium Handling Time Limits](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/)：支持「定義與公式」的終止與截斷。
- [Spinning Up Kinds of RL Algorithms](https://spinningup.openai.com/en/latest/spinningup/rl_intro2.html)：支持連續動作限制與神經近似的限制。

## 小結

- Q表與DQN的表示不同，但都估計動作價值。
- 一次更新把舊值移向「本步回饋加後續最大估計」。（補充）
- 高維觀測適合神經近似，動作是否可列舉仍須另外檢查。
