---
id: adversarial-debiasing
title: 對抗式去偏
kind: technique
codes: [L23402]
aliases: [Adversarial Debiasing, Adversarial Fairness]
requires: [fairness-constrained-training]
is_a: [debiasing-strategies]
summary: 讓對手努力猜敏感群體，主模型則保留任務能力並降低可被猜出的資訊
goals:
  - id: g1
    text: 沿雙模型訊息流說明主模型與敏感屬性預測器的相反更新方向
  - id: g2
    text: 用獨立群體辨識檢查與任務指標評估殘留偏見
formula_groups:
  - id: alternating-adversarial-directions
    source: https://proceedings.mlr.press/v37/ganin15.pdf#page=4
    status: verified
    checked_by: codex-gpt-6.1-sol:CK2-W-L23402-B
mitigates:
  - target: algorithmic-bias
    note: 降低表示或輸出中的敏感資訊，弱對手與有限樣本仍可能漏掉殘留偏見
    source: [guide-3:6-22]
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 招聘主模型預測資格，對手從主模型輸出猜A/B群體。對手損失0.60，團隊要繼續對抗訓練，哪個方向正確？
    options:
      A: 對手提高群體損失；主模型同時降低任務與群體損失
      B: 對手降低資格損失；主模型只提高敏感群體辨識率
      C: 對手提高資格損失；主模型只降低敏感群體辨識率
      D: 對手降低群體損失；主模型兼顧任務並抵抗群體辨識
    answer: D
    explain:
      A: 對手要努力猜對群體，主模型不能跟著幫它猜得更準。
      B: 對手的監督目標是敏感群體，不是資格標籤。
      C: 任務預測仍須保留，不能只破壞資格預測能力。
      D: 對手改善群體辨識，主模型則在任務與抵抗辨識之間取捨。
  - id: c2
    goal: g2
    type: choice
    prompt: 新模型讓某對手在平衡的40人保留集上只猜對20人，但任務TPR群差仍有0.20。該怎麼判讀？
    options:
      A: 目前對手接近50%基準，仍須查更強辨識器與任務群體差距
      B: 對手只有50%正確，已證明所有敏感資訊消失而且完全公平
      C: 對手只有50%正確，應把任務標籤刪除並只追蹤辨識器損失
      D: 任務仍有0.20差距，應改用訓練集評估以證明差距不存在
    answer: A
    explain:
      A: 單一對手可能能力不足，且殘留TPR差已表明仍有待處理問題。
      B: 只能描述這個對手的表現，不能證明所有表示都不含敏感資訊。
      C: 刪除任務標籤就無法檢查任務能力及群體錯誤。
      D: 改成訓練集不能推翻保留集的差距，也不能作為改善證據。
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:6-22]
---

## 為什麼需要

履歷裡沒有性別欄，學校、社團或用語仍可能透露敏感資訊。對抗式去偏（Adversarial Debiasing）在訓練時加入一個專門找這些資訊的對手。

主模型仍要預測資格；對手則試著從它的表示或輸出猜敏感群體。兩者目標不同，不能把兩個損失一起朝相同方向最小化。

## 直覺

像一位出題者不斷找線索，另一位努力保留內容卻去除線索。對手必須認真猜，才會逼主模型學著減少可辨識的群體資訊。

![對手用真實群體標籤學著猜群體；主模型保留資格預測，並沿反方向減少群體線索。](figure:l23402-adversarial-debiasing-two-models)

## 定義與公式

主模型接收任務特徵並預測目標；對手接收指定的表示或輸出，使用敏感群體作監督訊號。訓練主模型時，要抵抗對手的群體辨識能力。

### 相反的損失方向（補充）

$$
\begin{aligned}
\text{固定主模型，更新對手：}&\quad\min_\phi L_{\mathrm{adv}}(\theta,\phi),\\
\text{固定對手，更新主模型：}&\quad\min_\theta
\bigl[L_{\mathrm{task}}(\theta)-\alpha L_{\mathrm{adv}}(\theta,\phi)\bigr].
\end{aligned}
$$

$\theta$、$\phi$分別是主模型、對手的參數；$\alpha\geq0$調整抵抗力道。

$L_{\mathrm{task}}$衡量資格預測錯誤，$L_{\mathrm{adv}}$衡量群體預測錯誤。

固定對手的一步中，任務損失0.50、對手損失0.60，且$\alpha=0.5$，主模型目標為$0.50-0.5\times0.60=0.20$。

若任務損失仍0.50、對手損失升至0.70，目標降為0.15，說明主模型傾向讓對手更難猜。對手自己的更新方向恰好相反。

這是借用Ganin與Lempitsky的任務損失減辨識損失形式，將「領域辨識」改為「敏感群體辨識」的教學特化，不是原論文的領域適應實驗。

Fairlearn採用的具體更新還有梯度投影項；不能把此式或下方程式當成該套件的完整重現。

## 走一次流程

### 用招聘與信貸辨認資訊流

招聘主模型學資格，對手學申請者群體。兩邊共用主模型產出的訊號，但各自有不同監督標籤。

1. 先準備一般特徵、任務標籤與受控的群體標籤。
2. 主模型產生表示或分數，對手以此猜群體。
3. 更新對手，讓它更會辨識群體。
4. 更新主模型，兼顧任務並減少對手可用線索。
5. 在保留資料重新檢查任務能力與群體落差。（補充）

### 如何檢查對手是否真的失去線索（補充）

共用資料的區域代理欄可猜對36/40人，即90%。若兩群各20人，永遠猜A也有50%；比較時要保留這個基準。

即使訓練中的對手降至50%，仍要凍結表示，再用未參與對抗的辨識器檢查。弱對手、沒收斂或樣本不足，都可能造成「猜不出」的假象。

| 要查什麼 | 為什麼不能只看對手 |
|---|---|
| 任務準確率 | 輸出全部變常數也可能難猜群體 |
| 分群TPR／FPR | 敏感資訊降低不保證每種錯誤都一致 |
| 新辨識器與保留資料 | 避免只成功騙過訓練中的特定對手 |

## 程式（補充）

以下重建40筆分數與區域代理欄，做最小雙模型示範。先建立模型，再顯示任務與對抗損失、做一次交替更新；一次更新不代表公平已改善。

```python
import torch
torch.manual_seed(23402)
x = torch.tensor([[0.8 if i < 8 or 10 <= i < end else 0.3,
                   float((g == 1) == (i < 18))]
                  for g, end in [(0, 12), (1, 16)] for i in range(20)])
y = torch.tensor([[float(i < 10)] for g in range(2) for i in range(20)])
group = torch.tensor([[float(g)] for g in range(2) for i in range(20)])
main = torch.nn.Sequential(torch.nn.Linear(2, 1), torch.nn.Sigmoid())
adv = torch.nn.Sequential(torch.nn.Linear(1, 1), torch.nn.Sigmoid())
loss = torch.nn.BCELoss()
print("輸出形狀:", tuple(main(x).shape))
```
```text
輸出形狀: (40, 1)
```

第二段接續同一個行程。對手更新時切斷主模型梯度；主模型更新時凍結對手參數，但保留穿過對手、回到主模型的梯度。

```python
opt_main = torch.optim.SGD(main.parameters(), lr=0.01)
opt_adv = torch.optim.SGD(adv.parameters(), lr=0.01)
opt_adv.zero_grad()
loss(adv(main(x).detach()), group).backward()
opt_adv.step()
for parameter in adv.parameters():
    parameter.requires_grad_(False)
opt_main.zero_grad(); p = main(x)
task_loss, adv_loss = loss(p, y), loss(adv(p), group)
objective = task_loss - 0.5 * adv_loss
print(f"任務損失={task_loss.item():.4f} 對抗損失={adv_loss.item():.4f} 目標={objective.item():.4f}")
objective.backward(); opt_main.step()
for parameter in adv.parameters():
    parameter.requires_grad_(True)
print("已完成一次對手更新與一次主模型更新；仍需獨立評估")
```
```text
任務損失=0.7370 對抗損失=0.7292 目標=0.3724
已完成一次對手更新與一次主模型更新；仍需獨立評估
```

:::tip[讀碼重點]
`detach()`只出現在對手更新。主模型更新時若也切斷p的梯度，抵抗群體辨識的訊號就傳不回主模型。
:::

## 怎麼用、怎麼判讀

指引用履歷分析避免透露性別說明此方法。它適合檢查特徵表示或輸出是否仍帶群體資訊，但需要同時觀察主任務是否被破壞。

:::supplement[來源：Fairlearn，Adversarial Mitigation]
對手只看輸出與同時看輸出、真實標籤，對應的公平目標可能不同。訓練需要群體標籤；部署可只留下主模型，前提是主模型輸入不含必須取得的敏感欄位。
:::

### 換個場景

| 場景／資料條件 | 判讀重點 |
|---|---|
| 招聘履歷仍帶性別線索 | 對手能否從資格表示猜出性別 |
| 信貸表示學習（補充） | 保留還款預測能力並查群體錯誤 |
| 語音特徵表示（補充） | 方言線索減少後，辨識品質是否下降 |

## 常見誤解

- 對手要猜對敏感群體，主模型才有需要抵抗的訊號。
- 主模型仍有主任務，不能只把輸出全部變成常數。
- 對手猜不準不是所有群體資訊已消失的證明。（補充）
- 這裡的對手猜敏感群體，與生成對抗網路辨別真假的任務不同。（補充）

## 進階

### 群體不平衡時換基準（補充）

若A占90%，永遠猜A就有90%正確。此時不能把50%當唯一目標；需看分群辨識、基準與不確定性，也要確認對手有足夠能力。

### 參考來源

- 科目3學習指引 `guide-3:6-22`：支持雙模型方向及招聘履歷場景。
- [Ganin與Lempitsky：Domain Adaptation，第3.1～3.2節、式(1)～(6)](https://proceedings.mlr.press/v37/ganin15.pdf#page=4)：支持相反更新方向；敏感群體辨識為本頁特化。
- [Fairlearn：Adversarial Mitigation](https://fairlearn.org/main/user_guide/mitigation/adversarial.html)：支持輸入、損失方向、梯度投影與方法限制的補充。
- [AIF360：AdversarialDebiasing](https://aif360.readthedocs.io/en/v0.6.0/modules/generated/aif360.sklearn.inprocessing.AdversarialDebiasing.html)：支持訓練中去偏與敏感屬性辨識目標。
- [Fairness and Machine Learning：Classification](https://fairmlbook.org/classification.html)：支持預測表示與敏感資訊的教學安排。

## 小結

- 對手學著猜群體，主模型學著保留任務並抵抗辨識。
- 訓練兩邊時，群體損失的更新方向相反。
- 單一對手失敗，不等於所有偏見消失。（補充）
- 任務表現、分群錯誤與獨立辨識都要檢查。（補充）
