---
id: interaction-features
title: 交互與聚合特徵
kind: technique
codes: [L23301]
aliases: [Aggregation, Feature Cross, Interaction Features]
summary: 把同列欄位的組合與同群歷史的統計，轉成有業務意義的輸入
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-10]
goals:
  - id: g1
    text: 由單價數量建立乘積，並按顧客與預測截止點聚合歷史點擊
formula_groups:
  - id: product
    source: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PolynomialFeatures.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-G
  - id: window-sum
    source: https://pandas.pydata.org/docs/user_guide/groupby.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 兩份報價的單價都是30元，意向數量分別為2件與5件。工程師要加入交互特徵表示報價總額，哪組結果合理？
    options:
      A: 分別得到60元與150元，表示兩欄共同決定的報價總額
      B: 分別得到32元與35元，表示兩欄直接相加的報價總額
      C: 分別得到15元與6元，表示單價除以數量的報價總額
      D: 分別得到900元與900元，表示單價平方的報價總額
    answer: A
    explain:
      A: 單價乘以數量得到報價總額，數量改變也會改變這個特徵。
      B: 元／件與件不能直接相加來代表總額。
      C: 除法不是總額計算，且單位也不對。
      D: 平方只使用單價，沒有表示單價與數量的共同作用。
  - id: c2
    goal: g1
    type: choice
    prompt: 週一18:00預測顧客購買，前7天的點擊數依序為2、4、6、8、10、2、4，均已入庫；當天另有6次點擊將於18:10入庫。哪個7天歷史特徵正確？
    options:
      A: 用前7天加當天得到42次，表示截止前已知的歷史行為
      B: 用最後6天得到34次，表示截止前已知的完整7天行為
      C: 用前7天得到36次，表示截止前已知的完整7天行為
      D: 用最後一天得到4次，表示截止前已知的完整7天行為
    answer: C
    explain:
      A: 當天點擊尚未入庫，而且加入後也超出定義的前7天視窗。
      B: 少算了視窗第一天的2次，只代表6天。
      C: 依指定的7天與可用時間加總，得到36次。
      D: 只保留昨天的4次，沒有完成7天聚合。
---

## 為什麼需要

單價30元與數量2件各是一個欄位，但顧客看到的是總額60元。同樣地，單次點擊只描述一個時點；一週的點擊總數才能反映近期活動程度。

特徵工程可以合成原始欄位，也可以把多列行為彙整成群體統計。指引以總價和使用者近期點擊為例，重點是讓新欄位對應可解釋的業務問題。

## 直覺

交互特徵（Interaction Features）合併同列欄位；聚合特徵（Aggregation）彙整同群多列。後者需先定義群組與範圍。

![乘積合併同列欄位，聚合則先圈出同一顧客的歷史資料。](figure:l23301-interaction-features-construction)

## 定義與公式

### 先把來源與衍生欄位對起來

| 來源欄位 | 操作 | 衍生欄位 | 業務意義 |
|---|---|---|---|
| 單價、意向數量 | 同列相乘 | 報價總額 | 此次預計支出 |
| 顧客、時間、點擊次數 | 按顧客與前7天加總 | 近期點擊數 | 近期活動程度 |
| 計畫功率、運轉時數（補充） | 同列相乘 | 計畫用電 | 預計能源需求 |

### 乘積與聚合的數學表示（補充）

數值乘積可以寫成：

$$
z_i=p_iq_i
$$

$i$表示目前列，$p_i$是單價，$q_i$是意向數量，$z_i$是報價總額。元／件乘以件得到元；報價不等於未來成交金額。

對顧客$u$，在預測截止點$t$的7天點擊總數為：

$$
C_{u,t}=\sum_{j\in H(u,t)}c_j
$$

$c_j$是歷史點擊；$H(u,t)$限定同一顧客、$[t-7\text{天},t)$且已入庫的列。空窗總和為0，須另記涵蓋天數，區分無資料與零活動。

## 算一次

### 同一份零售資料的兩種新欄位

共用資料R01的單價為30元、意向數量為2件，因此報價總額是30×2=60元。這不需要讀取其他顧客，也不需要購買標籤。

顧客A在10月12日18:00的前7天點擊依序是2、4、6、8、10、2、4次。加總為36次；日期與顧客相同的各頁都用這個視窗。

:::supplement[來源：pandas Group by；Feast Point-in-time joins]
10月8日那筆8次點擊雖曾延遲，但10月9日19:00已入庫，所以在10月12日的快照可用。10月12日當天的點擊18:10才入庫，不能加入18:00的特徵。

能源例E01的計畫功率2kW乘3小時，得到計畫用電6kWh。同索引的7天實測用電為10、20、30、40、50、10、20，總和180kWh；兩種特徵的資料角色不同。
:::

## 程式

### 從固定快照建立乘積與聚合（補充）

程式讀本組JSON，時間一律解析成帶時區的時間戳。`available_time`是點擊計數的可用時間；價格與意向數量在報價預測截止點已知。

在專案根目錄可直接執行；若用隔離目錄，先將環境變數`IPAS_REPO_ROOT`設為專案根路徑。

```python
import json, os
from pathlib import Path
import pandas as pd
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
df = pd.DataFrame(data["rows"])
for col in ["event_time", "available_time"]:
    df[col] = pd.to_datetime(df[col], utc=True)
t = pd.Timestamp("2026-10-12T18:00:00+08:00")
mask = (df.entity == "A") & (df.event_time >= t - pd.Timedelta(days=7))
mask &= (df.event_time < t) & (df.available_time <= t)
df["quoted_total"] = df.price * df.quantity
print("首筆報價:", int(df.loc[0, "quoted_total"]))
print("歷史筆數/點擊:", int(mask.sum()), int(df.loc[mask, "clicks"].sum()))
```
```text
首筆報價: 60
歷史筆數/點擊: 7 36
```

:::tip[讀碼重點]
遮罩同時限制顧客、事件視窗與可用時間。直接對40列做`groupby("entity").sum()`會把未來資料一起加進歷史特徵。
:::

## 怎麼用、怎麼判讀

先說清楚新欄位的業務意義，再檢查單位與來源。乘積表示兩欄共同作用；總和、平均、次數各回答不同問題。

:::supplement[來源：Google Feature crosses；scikit-learn PolynomialFeatures]
能計算不代表都該加入模型，應依任務選擇，再用相同資料分割比較。

數值乘積與類別交叉要分清楚。後者可把「商品類別×時段」變成組合類別，再編碼；不能把任意類別代碼相乘當成有意義的數值。大量組合也會增加稀疏與過擬合風險，需在固定資料分割下比較效果。
:::

### 換個場景

| 場景／資料條件 | 新特徵 | 判讀重點 |
|---|---|---|
| 零售單價與數量 | 總價 | 同列計算，單位合理 |
| 使用者近7天點擊 | 群體行為統計 | 指定使用者與時間範圍 |
| 能源運轉計畫（補充） | 功率×時數 | 計畫量與實測量分開 |
| 製造批次量測（補充） | 批次內歷史平均 | 只能用截止前已知量測 |

## 常見誤解

- **相乘就是找到因果。** 乘積只是新的表示，預測是否有用仍需評估。（補充）
- **聚合只要指定顧客就好。** 歷史行為還要指定時間窗與入庫限制。（補充）
- **報價總額就是已成交金額。** 本例數量是意向，衍生欄位仍是報價。（補充）
- **聚合後沒有資料洩漏。** 聚合若混入未來，資料列變少也不會使它安全。（補充）

## 進階

### 線性模型為何可能受益（補充）

只給單價與數量時，線性模型分別給兩者固定係數。加入乘積後，模型可以表達單價的影響隨數量改變；樹模型也能捕捉部分交互作用，但顯式加入是否有幫助仍要驗證。

### 參考來源

- 科目3指引5.1，`guide-3:5-10`：原始欄位合成、總價與7天點擊場景；未展開數學式與快照實作。
- [PolynomialFeatures](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.PolynomialFeatures.html)：乘積表示與進階的模型解釋。
- [pandas Group by](https://pandas.pydata.org/docs/user_guide/groupby.html)：分組聚合的定義與程式。
- [Google Feature crosses課程](https://developers.google.com/machine-learning/crash-course/categorical-data/feature-crosses)：類別交叉、數值乘積的區別及組合風險。
- [Feast Point-in-time joins](https://docs.feast.dev/getting-started/concepts/point-in-time-joins)：預測截止點快照的核心延伸；晚到雙時間檢查是本例明示的資料契約。

## 小結

- 欄位合成看共同作用，聚合看群體歷史。
- 總價與近期點擊各有不同的業務意義。
- 歷史聚合要同時限制群組、視窗與可用時間。（補充）
