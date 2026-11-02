---
id: markov-decision-process
title: 馬可夫決策過程與報酬
kind: theory
codes: [L23201]
aliases: [MDP, Markov Decision Process]
summary: 馬可夫決策過程用狀態、動作與轉移描述長期決策
requires: [reinforcement-learning, probabilistic-modeling]
goals:
  - id: g1
    text: 讀懂MDP元素圖與三步紀錄，區分策略、價值與單步獎勵
  - id: g2
    text: 用轉移機率與折扣回報比較短期和長期，說明有限及無限期條件
formula_groups:
  - id: markov-transition
    source: https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-2-mdp.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-C
  - id: return
    source: https://spinningup.openai.com/en/latest/spinningup/rl_intro.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-C
  - id: value
    source: https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-2-mdp.pdf
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23201-C
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 倉儲在C時「選交付」是一條規則，收到10分是一次結果，從C開始的平均後續回報是8.9分（只剩一步）。三者依序是什麼？
    options:
      A: 價值、策略、單步獎勵
      B: 策略、單步獎勵、價值
      C: 狀態、環境、動作
      D: 單步獎勵、價值、策略
    answer: B
    explain:
      A: 選動作的規則是策略，平均後續回報才是價值。
      B: 三個量分別描述如何選、這次得幾分、未來平均得幾分。
      C: 題目是在描述決策規則與兩種回饋數量，沒有列三個互動元素。
      D: 決策規則不是單次得分，平均回報也不是選動作的規則。
  - id: c2
    goal: g2
    type: choice
    prompt: C交付以0.9機率進D得10分，以0.1機率留C扣1分；只剩一步。期望回報是多少？
    options: {A: '10', B: '9', C: '6.2', D: '8.9'}
    answer: D
    explain:
      A: 10忽略了交付失敗的可能。
      B: 9只保留成功分數的加權項，漏掉失敗成本。
      C: 6.2是從A經三次指定成功轉移的折扣回報。
      D: 0.9×10+0.1×(-1)=8.9，第一步獎勵不另折扣。
  - id: c3
    goal: g2
    type: choice
    prompt: 同一條三步倉儲軌跡獎勵-1、-1、10。折扣因子從0.9改成0.2，且仍從第一步計算，哪個說法正確？
    options:
      A: 回報由6.2變成-0.8，晚到的10分權重降低
      B: 回報仍是6.2，折扣只改變機率
      C: 回報變成8，有限步數不能用折扣
      D: 回報變成-1，因為0.2等於完全忽略未來
    answer: A
    explain:
      A: -1-0.2+0.04×10=-0.8，晚到獎勵被折得更多。
      B: 折扣改變未來獎勵的權重，不改變環境轉移機率。
      C: 有限步數也可使用折扣，8是折扣因子為1的總和。
      D: 完全只看第一步對應折扣因子0，0.2仍保留未來項。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:4-9, guide-3:4-10, guide-3:4-11]
---

## 為什麼需要

只說「讓機器人拿高分」，還不知道如何描述它能做什麼、動作後會去哪裡。馬可夫決策過程（MDP，英文為Markov Decision Process）把這些規則整理成可比較策略的問題。

## 直覺

共用倉儲例子用四個狀態表示作業進度。代理人選動作，環境決定下一狀態與報酬；策略決定怎麼選，價值函數衡量長期獎勵的期望值。

![順著A、B、C到D看一次交付；抓取後也能放回，留在原地代表作業失敗或無效動作。](figure:l23201-markov-decision-process-states)

:::supplement[來源：David Silver的Markov Decision Processes課程之Markov Property]
圖中B包含「貨物在地面」、C包含「車上有貨」。不是只用位置表示狀態，否則同一位置有沒有載貨，能做的事與結果可能不同。
:::

## 定義與公式

MDP用以下七個角色描述決策問題，倉儲對照如下：

- 代理人（Agent）：選動作並從經驗改善決策的主體；本例是倉儲機器人。
- 環境（Environment）：與代理人互動、產生作業結果的外部系統；本例是倉儲系統。
- 狀態（State）：目前作業情況的資訊；B表示在取貨格且貨物在地面。
- 動作（Action）：代理人當下能做的選擇；例如抓取並搬運。
- 報酬（Reward）：環境對一次動作的回饋，用來引導學習；本組算例也稱「單步獎勵」。
- 策略（Policy）：依目前狀態選動作的規則；例如在C選交付。
- 價值函數（Value Function）：衡量狀態或狀態與動作的長期獎勵期望；不同於一次交付的得分。

:::supplement[來源：Spinning Up Part 2 的 Model-Free vs Model-Based RL]
代理人可不知道轉移規則；「環境可用MDP描述」不等於「學習方法已持有環境模型」。
:::

### 轉移規則（補充）

在馬可夫假設下，給定目前狀態與動作，預測下一狀態不必再查更早的歷史：

$$
P(s_{t+1}\mid s_t,a_t,\text{過去歷史})=P(s_{t+1}\mid s_t,a_t)
$$

$s_t$是第$t$步狀態，$a_t$是所選動作，$P$是條件機率。它要求狀態保留相關資訊，不表示相鄰狀態互相獨立。

以C的交付為例，下一狀態D的機率0.9、留C的機率0.1，合計1。若交付是否成功還取決於未記錄的載貨資訊，這個狀態表示就不夠。

無論由A→B→C到達，或放回後再次到C，在相同完整狀態C選交付，成功機率都為0.9。這就是把公式代入本例後的意思。

### 回報與折扣（補充）

$$
G_t=\sum_{k=0}^{T-t-1}\gamma^k r_{t+k+1}
$$

$G_t$是回報，$T$是結束步數，$r_{t+k+1}$是往後第$k+1$次回饋，$\gamma$是折扣因子。第一個獎勵乘1，隔一步才乘$\gamma$。

從起點$t=0$開始算時，就是強化學習的任務與獎勵頁使用的$G_0$；$k$只是在數往後第幾步。

三步獎勵-1、-1、10：折扣0.9時，$G_0=-1-0.9+8.1=6.2$；折扣0.2時，$G_0=-1-0.2+0.4=-0.8$，較重視眼前成本。

- 有限期：$0\leq\gamma\leq1$都可定義此和；$\gamma=1$就是不折扣。
- 無限期：獎勵有界且$0\leq\gamma<1$時收斂。$\gamma=1$須另有終止等條件，不能一律保證有限。

### 價值是平均，不是單次分數（補充）

$$
V_h^{\pi}(s)=\mathbb{E}_{\pi}[G_t\mid s_t=s,\text{剩餘}h\text{步}]
$$

$\pi$是策略，$V_h^{\pi}(s)$是從狀態$s$出發、剩$h$步時依策略行動的期望回報。期望會把可能的轉移與動作依機率加權；有限期的價值也取決於剩餘步數。

若在C只剩一步，策略選交付，則$V_1^{\pi}(C)=0.9\times10+0.1\times(-1)=8.9$。它不同於一次成功交付拿到的10分。

## 算一次（補充）

### 先看同一份轉移表

`L23201-C-warehouse.json`的12列涵蓋每個狀態、動作的所有可能結果。這裡摘出交付策略會用到的三組；其他組包含放回、無效動作與終止狀態。

| 狀態、動作 | 可能下一狀態 | 機率 | 獎勵 |
|---|---|---:|---:|
| A，前進 | B／A | 0.8／0.2 | -1／-1 |
| B，抓取搬運 | C／B | 0.8／0.2 | -1／-1 |
| C，交付 | D／C | 0.9／0.1 | 10／-1 |

成功軌跡W01→W05→W07是A→B→C→D，回報6.2。在指定動作下，這三次結果的聯合機率為$0.8\times0.8\times0.9=0.576$。

| 要辨認的物件 | 這條軌跡中的意思 |
|---|---|
| 策略 | A前進、B抓取、C交付的選擇規則 |
| 單步獎勵 | 每一次互動的-1、-1、10 |
| 軌跡回報 | 這次三步的折扣總和6.2 |
| 價值 | 包含失敗與停留結果後，依策略的平均回報 |

### 再換成四種電量

能源例子同樣有12條固定轉移。從E3滿電出發，看同樣三步、相同折扣0.9：

| 指定軌跡 | 獎勵序列 | 折扣回報 |
|---|---|---:|
| E3→E2→E1→E0 | 4、4、-6 | 2.74 |
| E3→E2→E3→E2 | 4、-2、4 | 5.44 |

中途充電雖扣2分，這兩條軌跡的長期比較卻較好。這只比較已指定結果；要選整體策略，仍要把充放電失敗等其他轉移納入期望。

## 程式（補充）

以下重播同一份教學資料的固定獎勵序列；不抽樣、不訓練，也不連外網。沒有亂數，所以不需要額外設種子。

```python
def discounted(rewards, gamma):
    return sum(gamma ** t * r for t, r in enumerate(rewards))
paths = {"交付": [-1, -1, 10], "耗盡": [4, 4, -6], "保留": [4, -2, 4]}
for name, rewards in paths.items():
    print(f"{name}: {discounted(rewards, 0.9):.4f}")
print(f"C剩一步: {0.9 * 10 + 0.1 * (-1):.4f}")
```
```text
交付: 6.2000
耗盡: 2.7400
保留: 5.4400
C剩一步: 8.9000
```

:::tip[讀碼重點]
`enumerate`從0開始，所以第一筆獎勵乘1。最後一行是對可能結果加權，與上面三條指定軌跡的總和不同。
:::

## 怎麼用、怎麼判讀

指引的導航、機器人、遊戲、推薦、金融與資源配置，都涉及動作影響後續狀態。先辨認狀態，再問動作怎樣改變未來；只會預測下一個數字，尚未定義決策問題。

### 換個場景

| 場景 | 狀態與決策 | 判讀重點 |
|---|---|---|
| 物流排程 | 貨物進度，安排搬運 | 多階段決策 |
| 遊戲或導航 | 局面與位置，選下一步 | 未來結果由動作序列改變 |
| 推薦與廣告 | 使用者資訊，挑內容 | 長期價值而非一次點擊 |
| 儲能（補充） | 電量，充放電 | 目前收益與後續缺電成本 |
| 灌溉（補充） | 水分與存水，灌水量 | 狀態是否涵蓋必要歷史 |

## 常見誤解

- 單步報酬不等於價值；前者是一次回饋，後者衡量長期累積獎勵的期望。
- 馬可夫假設不是「過去完全沒影響」，而是相關過去已由目前狀態概括。（補充）
- 折扣因子不是轉移機率；調小它不會讓交付更容易失敗。（補充）
- D是任務終止，能源E0仍可充電；不能把低分狀態都當作終止。（補充）

## 進階

### 有限期與終止的差別（補充）

因五步上限被截斷，與貨物確實交付是兩件事。有限期價值用$V_h$記錄剩餘步數；若直接讓策略依剩餘時間選動作，狀態也應提供這項資訊。

### 參考來源

- 科目3指引 `guide-3:4-9`、`guide-3:4-10`：支持MDP角色與策略、價值的概念；`guide-3:4-11`支持應用場景。
- [David Silver：MDP課程](https://davidstarsilver.wordpress.com/wp-content/uploads/2025/04/lecture-2-mdp.pdf)：Markov Property、Return及Value Function支持馬可夫假設、轉移與價值公式。
- [Spinning Up：Key Concepts in RL](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html)：Reward and Return支持有限與無限期折扣條件；數字由本組資料核算。
- [Spinning Up：Kinds of RL Algorithms](https://spinningup.openai.com/en/latest/spinningup/rl_intro2.html)：支持MDP環境描述與代理人是否使用模型的補充區分。
- [Gymnasium：Basic Usage](https://gymnasium.farama.org/introduction/basic_usage/)：支持進階區分終止與截斷的用語。

## 小結

- 狀態描述當下，策略選動作，轉移描述動作後可能去哪裡。
- 單步獎勵、一次軌跡回報與期望價值是三種不同量。
- 比較長期回報前，先固定起點、折扣、步數與終止規則。
