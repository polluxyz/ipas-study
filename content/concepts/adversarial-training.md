---
id: adversarial-training
title: 對抗訓練與防禦邊界
kind: technique
codes: [L23401, L21203]
aliases: []
requires: [adversarial-examples]
mitigates:
  - target: adversarial-examples
    note: 用有害擾動樣本更新模型，但效果限於受測的攻擊與擾動範圍
    source: [114-2-S1-Q24]
summary: 對抗訓練以刻意誤導的輸入更新模型，穩健性仍須在指定威脅下驗證
goals:
  - id: g1
    text: 依攻擊面比較對抗訓練、輸入檢查、規則與防火牆，說出各自限制和代價
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 合法登入者傳入 2 張刻意修改的產品圖，格式及尺寸均正確，模型卻漏判。哪個措施最直接針對模型對小擾動的脆弱性？
    options:
      A: 只調整防火牆連接埠，維持原模型與原輸入
      B: 只驗證圖檔寬高格式，維持原模型與原權重
      C: 用受限對抗輸入更新模型，再獨立評估穩健性
      D: 只增加登入密碼長度，維持原模型與原輸入
    answer: C
    explain:
      A: 連接埠限制主要控制網路通路，沒有改變模型的分類邊界。
      B: 合法尺寸內仍能存在有害擾動，格式檢查不等於抗擾動能力。
      C: 對抗訓練直接更新模型對這類輸入的反應，但仍須驗證範圍。
      D: 登入保護有其用途，卻不會讓已登入者的影像一定可信。
  - id: c2
    goal: g1
    type: choice
    prompt: 新模型在幅度 0.02 的兩張保留圖皆判對，幅度 0.25 卻兩張皆錯。以下哪個上線說明合理？
    options:
      A: 通過本次 0.02 測試，較大幅度失敗仍須列為限制
      B: 通過所有擾動測試，0.25 已超過所有真實攻擊能力
      C: 通過所有網路測試，分類結果足以證明帳密未被盜用
      D: 通過所有隱私測試，分類結果足以證明原圖不會外洩
    answer: A
    explain:
      A: 測試只能支持已測條件，較大幅度的失敗不能省略。
      B: 教學幅度不是現實攻擊能力的通用上限。
      C: 分類測試沒有檢查登入、權限與網路入侵。
      D: 分類測試沒有檢查資料下載及保存路徑。
  - id: c3
    goal: g1
    type: choice
    prompt: 團隊用 8 張圖訓練，再用同一批攻擊圖反覆挑版本，最後只報這 8 張的成功結果。哪個修正最重要？
    options:
      A: 把訓練圖複製 10 次，便能把重複圖視為新測試
      B: 用另一批保留圖重做攻擊，同時報原圖與攻擊表現
      C: 只報原圖準確率即可，便能省略攻擊設定與擾動幅度
      D: 將攻擊圖改成原標籤，便能把所有誤判都改記為正確
    answer: B
    explain:
      A: 重複資料沒有增加獨立測試證據。
      B: 保留資料與針對新模型重算的攻擊，較能檢查是否只記住已見擾動。
      C: 原圖表現不能取代攻擊條件下的評估。
      D: 任意更改真實標籤會破壞評估依據。
textbook: v2
author: codex
status: draft
---

## 為什麼需要

:::supplement[來源：Madry 等，Towards Deep Learning Models Resistant to Adversarial Attacks]
對抗訓練把有意誤導的輸入納入學習，英文名為 Adversarial Training。目標是降低指定攻擊條件下的錯誤，不是保證模型從此不會被騙。

它與對抗式去偏模型的目的不同：前者處理輸入擾動，後者希望降低敏感群體特徵對預測的影響。
:::

## 直覺

:::supplement[來源：對抗穩健性課程第 4 章]
一般訓練看原圖會不會判對；對抗訓練還問「附近哪個輸入最容易讓目前模型判錯」，再拿它更新模型。模型改了，攻擊也要隨之重算。

![依攻擊面找控制點：防火牆守網路，輸入檢查守格式，對抗訓練改模型，低信心結果再交覆核。](figure:l23401-adversarial-training-controls)
:::

## 走一次流程

### 步驟 1：固定資料與防禦目標（補充）

沿用 `L23401-G-vision-review.json`，兩領域各 12 張、種子 42。第 1～8 張訓練、9～10 張驗證、11～12 張測試。

本例固定更新 100 次，驗證集保留不用，測試集只作最後評估。

基準模型只看左上格；新模型可看全部 16 格。單格擾動上限固定為 0.02，中央四格仍保有較明確的任務訊號。

另外加入相同 16 維架構的一般訓練對照，只移除訓練擾動；資料、初始化、學習率與更新次數均相同。這樣才能分清「多看特徵」與「改訓練方法」的差別。

### 步驟 2：重算攻擊，再更新（補充）

1. 讀取 8 張訓練圖及原標籤。
2. 依目前線性權重，選讓標籤損失增加的每格改動。
3. 將受擾動的輸入交給模型，計算二元交叉熵。
4. 反向傳播並更新權重，重複 100 次；不把測試圖加入學習。

本例線性分數對每格的方向很清楚，可直接用權重正負決定擾動。一般深度模型通常用近似搜尋，不應把一次攻擊失敗解讀為已找到所有最壞輸入。

### 步驟 3：對新模型重新攻擊（補充）

以下是每個領域各自的兩張測試圖，不是把 12 張都當測試資料。

| 模型 | 原圖判對 | 幅度 0.02 判對 | 幅度 0.25 判對 |
|---|---|---|---|
| 基準單格模型 | 2／2 | 0／2 | 0／2 |
| 16 維一般訓練：製造 | 2／2 | 2／2 | 0／2 |
| 16 維對抗訓練：製造 | 2／2 | 2／2 | 0／2 |
| 16 維一般訓練：零售 | 2／2 | 2／2 | 0／2 |
| 16 維對抗訓練：零售 | 2／2 | 2／2 | 0／2 |

每欄攻擊均依被測模型重算。兩種 16 維訓練的判對數相同，本例沒有顯示對抗訓練的額外效益；改善與可利用中央四格的訊號一致，不能歸因於對抗訓練。

幅度 0.25 時，中央格可從 0.7 降至 0.45，或從 0.3 升至 0.55，越過兩類訊號的中點 0.5。這已破壞原本的小擾動假設；抽象格網不能證明真實語意是否保留，只作範圍外壓力測試。

## 程式（補充）

先設定 `IPAS_REPO_ROOT` 為 repo 根目錄。三段依序執行，用 CPU 完成微型訓練，不下載權重。

```python
import json, os, torch
from pathlib import Path
torch.set_num_threads(1); torch.manual_seed(42)
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L23401-G-vision-review.json").read_text(encoding="utf-8"))
rows = d["domains"]["manufacturing"]
x = torch.tensor([r["pixels"] for r in rows]).flatten(1) - 0.5
y = torch.tensor([r["label"] for r in rows], dtype=torch.float32)
m = torch.nn.Linear(16, 1, bias=False); torch.nn.init.zeros_(m.weight)
opt = torch.optim.SGD(m.parameters(), lr=0.5)
tr, te = d["split"]["train"], d["split"]["test"]
print("訓練／測試張數:", len(tr), len(te))
```
```text
訓練／測試張數: 8 2
```

輸入減去 0.5 只是中心化，單格改動幅度仍是原來的 0.02。原始像素遠離 0 與 1，本例即使加減 0.25，也仍在合法像素範圍。

```python
for _ in range(100):
    delta = (1 - 2*y[tr, None]) * 0.02 * m.weight.detach().sign()
    opt.zero_grad()
    logits = m(x[tr] + delta).flatten()
    loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, y[tr])
    loss.backward(); opt.step()
print("更新次數:", 100)
```
```text
更新次數: 100
```

:::tip[讀碼重點]
標籤 1 的有害方向是降低分數，標籤 0 則是提高分數。`detach()` 固定這一步的攻擊方向，`opt.step()` 才更新模型；更新後下一輪會重算方向。

權重全零時，`sign(0)=0`，首輪以原圖更新。權重非零後，才會產生非零的有害擾動。
:::

```python
with torch.no_grad():
    for eps in [0.0, 0.02, 0.25]:
        delta = (1 - 2*y[te, None]) * eps * m.weight.sign()
        pred = (m(x[te] + delta).flatten() >= 0).long()
        correct = int((pred == y[te]).sum())
        print(f"幅度 {eps:.2f}: {correct}/{len(te)}")
```
```text
幅度 0.00: 2/2
幅度 0.02: 2/2
幅度 0.25: 0/2
```

同架構的一般訓練對照也從零開始，只在訓練時移除擾動；評估仍針對其權重重新攻擊。下段兩領域均使用各自的 8 張訓練圖。

```python
for domain, rows in d["domains"].items():
    cx = torch.tensor([r["pixels"] for r in rows]).flatten(1) - 0.5
    cy = torch.tensor([r["label"] for r in rows], dtype=torch.float32)
    control = torch.nn.Linear(16, 1, bias=False); torch.nn.init.zeros_(control.weight)
    optimizer = torch.optim.SGD(control.parameters(), lr=0.5)
    for _ in range(100):
        optimizer.zero_grad()
        loss = torch.nn.functional.binary_cross_entropy_with_logits(control(cx[tr]).flatten(), cy[tr])
        loss.backward(); optimizer.step()
    with torch.no_grad():
        counts = []
        for eps in [0.0, 0.02, 0.25]:
            delta = (1 - 2*cy[te, None]) * eps * control.weight.sign()
            pred = (control(cx[te] + delta).flatten() >= 0).long(); counts.append(int((pred == cy[te]).sum()))
    print(domain, "一般訓練判對數:", counts)
```
```text
manufacturing 一般訓練判對數: [2, 2, 0]
retail 一般訓練判對數: [2, 2, 0]
```

## 怎麼用、怎麼判讀

### 控制要對準攻擊面（補充）

| 控制 | 能處理什麼 | 限制與代價 |
|---|---|---|
| 對抗訓練 | 改善受測擾動下的模型反應 | 增加訓練成本，效果受威脅設定限制 |
| 輸入檢查 | 尺寸、範圍、格式異常 | 合法範圍內仍可能有害；過嚴會誤擋 |
| 業務規則與覆核 | 不合理結果或高風險決策 | 規則會漏情境，覆核增加人力與延遲 |
| 防火牆 | 限制網路連線與通路 | 不會直接改變分類邊界，需維護規則 |

幾種控制可並用。對抗訓練還要檢查原圖效能與資源成本，不能只報攻擊成功率下降；不同攻擊、較大預算或實體拍攝條件都應另評估。

### 換個場景（補充）

本目標屬補充，指引沒有列出獨立適用場景。

| 場景 | 防禦重點 | 殘餘風險 |
|---|---|---|
| 製造檢測 | 受限微擾訓練與放行覆核 | 漏檢代價可能高 |
| 零售盤點 | 對原圖及受擾動圖分別測試 | 光照漂移仍要另測 |
| 醫療輔助 | 在隔離環境評估攻擊與防禦 | 小資料結果不能替代臨床驗證 |

## 常見誤解（補充）

- **防火牆擋住攻擊便不必測模型**：合法連線也可能送入有害影像。
- **多放隨機雜訊等於對抗訓練**：後者會針對目前模型找不利方向。
- **保留圖全對就是穩健保證**：兩張圖不足以涵蓋未知攻擊與真實場景。

## 進階

### 參考來源

- [Madry 等原始論文](https://arxiv.org/abs/1706.06083)：支持指定威脅集合下的穩健學習與評估邊界。
- [對抗穩健性課程第 4 章](https://adversarial-ml-tutorial.org/adversarial_training/)：支持先求有害輸入、再更新模型的教學安排。
- [對抗穩健性課程第 2 章](https://adversarial-ml-tutorial.org/linear_models/)：支持線性模型的有害方向及一般／穩健訓練的比較；本例另以 0／1 標籤推導方向。
- [PyTorch 對抗樣本教學](https://docs.pytorch.org/tutorials/beginner/fgsm_tutorial.html)：支持攻擊能力與尺度設定。查閱日均為 2026-11-02。

## 小結（補充）

- 對抗訓練改模型，網路、輸入與業務控制處理其他位置的風險。
- 訓練和測試都要隨模型重算攻擊，並保留原標籤。
- 同時報原圖、攻擊條件、保留資料與成本，避免過度承諾。
