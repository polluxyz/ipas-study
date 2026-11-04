---
id: temporal-features
title: Lag、Rolling 與特徵可用時間
kind: technique
codes: [L23301]
aliases: [Lag, Point-in-time, Rolling Mean, Sliding Window]
requires: [data-leakage]
summary: 時間特徵要對齊預測截止點，過去發生且已可讀的資料才可使用
textbook: v2
author: codex
status: draft
guide_refs: [guide-3:5-10]
goals:
  - id: g1
    text: 用連續時間列計算lag、移動平均、事件次數與時間間隔，對齊未來目標
  - id: g2
    text: 先檢查可用時間再shift與移動平均，並檢查資料分割邊界與標籤成熟
formula_groups:
  - id: lag-and-rolling
    source: https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23301-G
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 週四18:00要預測未來24小時購買，顧客前三天已入庫的點擊為2、4、6，週四點擊8次在18:10入庫。lag1與前3天移動平均各是多少？
    options:
      A: lag1為8、移動平均為6，取最近三天4、6、8作為歷史
      B: lag1為6、移動平均為4，取已知三天2、4、6作為歷史
      C: lag1為4、移動平均為3，取最早兩天2、4作為完整歷史
      D: lag1為2、移動平均為4，取最早一天替代昨天作為歷史
    answer: B
    explain:
      A: 當期8次尚不可用，而且移動平均混入了預測截止後才入庫的值。
      B: 昨天是6，前三天平均為4，兩者都在預測截止點前可讀。
      C: 少取一天且lag不是昨天，不能稱為指定的lag1與前3天移動平均。
      D: 平均恰好相同，但lag1應是前一日6，不能任意改成最早一天。
  - id: c2
    goal: g2
    type: choice
    prompt: 週五18:00建特徵，週四的8次點擊延至週五19:00入庫，週三6次已知；資料保留每日格點，前3天移動平均要求滿3筆。哪個處理合理？
    options:
      A: lag1保留8、移動平均補入8，因事件日期在週五之前
      B: lag1改成6、移動平均往前移，並維持名稱為昨天數值
      C: lag1保留8、移動平均改成0，因入庫延遲不影響lag
      D: lag1設缺值、移動平均設缺值，並記錄晚到資料的狀態
    answer: D
    explain:
      A: 發生在過去仍不代表當時可讀，19:00的資料不能回填18:00快照。
      B: 6是前天，若要用最近可用值應另命名，不能冒充昨天。
      C: lag同樣受可用時間限制，移動平均缺資料也不代表點擊為0。
      D: 昨天值不可用，完整3筆視窗不成立；缺值保留真實可用狀態。
  - id: c3
    goal: g2
    type: choice
    prompt: 模型於10月19日18:00 fit，兩列10月18日的未來24小時標籤在19日18:10才定案，歷史點擊在18日18:10已入庫。哪個邊界處理合理？
    options:
      A: 兩列不供監督訓練；已入庫點擊可供19日預測的歷史特徵
      B: 兩列先當負例訓練；已入庫點擊可供19日預測的歷史特徵
      C: 兩列可直接供訓練；歷史點擊則必須等標籤成熟才能使用
      D: 兩列不供監督訓練；19日預測也一律刪除所有18日歷史
    answer: A
    explain:
      A: 標籤與觀察值各有可用時間，未成熟標籤不能訓練，但已知歷史可作輸入。
      B: 尚未定案不等於沒有購買，提前編負例會污染監督標籤。
      C: 未成熟標籤不能用於當下訓練，觀察值也不必等待另一欄的標籤。
      D: 資料分割不代表合法歷史必須清空，是否可用應按時間與預測協議判斷。
---

## 為什麼需要

10月8日18:00預測時，同一位顧客昨天點了6次，前3天平均4次。這些數字描述過去行為，與日期的「第幾天」不同。指引把滯後值、移動平均、事件次數與時間間隔列為動態特徵。

:::supplement[來源：Feast Point-in-time joins；scikit-learn Lagged features教學]
建模時還要還原「當時看得到什麼」。若把事後補齊的資料放回過去，離線結果可能很好，上線卻拿不到同樣的特徵。
:::

## 直覺

滯後值（Lag）取指定過去位置的觀察；移動平均（Rolling Mean）摘要近期一段觀察。兩者都要對齊同一個實體與預測目標，不能讓顧客B的昨天接到顧客A。

固定長度的時間窗沿時間往前移，逐窗取出資料，就是滑動視窗（Sliding Window）。計算移動平均就是一種用法。

![前3天視窗不含當天，lag1取昨天；未來24小時是要預測的目標。](figure:l23301-temporal-features-window)

### 發生時間與可用時間分開（補充）

事件時間（event time）是事情發生時點；可用時間（available time）是系統能讀到資料的時點，本例即入庫時間。預測截止點是這次推論的資訊邊界。

![10月8日的點擊延至10月9日19:00入庫。10月9日18:00預測時，這筆昨日點擊仍不可讀。](figure:l23301-temporal-features-availability)

## 定義與公式

指引的lag描述先前的觀察值，移動平均描述一段近期觀察的平均。事件次數則以指定時間窗累計活動，時間間隔描述距上次事件多久。

### 固定格點的公式（補充）

同一實體的每日資料先排序並保留完整日期格點。在每個預測列$t$，可寫成：

$$
\mathrm{lag}_k(t)=x_{t-k},\qquad
\mathrm{rolling}_w(t)=\frac{1}{w}\sum_{j=1}^{w}x_{t-j}
$$

$x$是每日點擊，$k$是往前幾天，$w$是視窗天數。這裡從$j=1$開始，排除當期；每個被使用的值也必須在$t$前已入庫，否則保留缺值。

本例以`rolling3`表示前3天移動平均，要求3筆完整資料；少一筆就未定義。若允許2筆計算，必須另記有效筆數，不可把它當成同樣完整的3天平均。

### 不等距資料的限制（補充）

`shift(1)`移一列，不保證移一天；`rolling(3)`是3列，不必然是3天。不等距事件需先補齊格點，或改用明確的時間窗，並約定左右端點是否包含。

## 算一次

### 先看連續列，再計算動態特徵（補充）

共用零售A每天18:00預測未來24小時購買。以下只列同一顧客，以預測截止點為列；昨日事件均發生於18:00，最後一欄是該次預測使用的特徵。

| 預測截止點 | 昨日事件／點擊 | 可用時間 | 滯後值／前3天移動平均 |
|---|---|---|---|
| 10月6日18:00 | 5日／2 | 5日18:10 | 2／缺值 |
| 10月7日18:00 | 6日／4 | 6日18:10 | 4／缺值 |
| 10月8日18:00 | 7日／6 | 7日18:10 | 6／4 |
| 10月9日18:00 | 8日／8 | 9日19:00 | 缺值／缺值 |
| 10月10日18:00 | 9日／10 | 9日18:10 | 10／8 |

10月8日的lag1是6，前3天移動平均為(2+4+6)÷3=4。10月9日18:00時，昨天的8尚未入庫，lag1與完整前3天移動平均都缺值；不能事後補成8與6。

到10月10日18:00，8已入庫，昨天為10，前三天為6、8、10，平均8。能源同索引的數值是零售A的5倍，這三個預測截止點的結果依序為30／20、缺值／缺值、50／40。

### 再加事件次數與間隔

10月12日截止前7天點擊總數36，表示活動頻率，不是7筆資料這個筆數。最近一個已知的每日觀察時點是10月11日18:00，相距24小時。

:::supplement[來源：pandas Time series；本組資料契約]
資料只記每日點擊計數，故24小時是距上次「觀察時點」，不是距上次實際點擊。若要計算距上次點擊多久，還需要逐次點擊的原始事件時間，不能從每日總數反推。
:::

## 程式

### 每個預測截止點各自遮掉晚到值（補充）

先建立當時可用的觀察，再向前位移並計算視窗；以下保留每日格點，不會因缺值把前天當成昨天。

在專案根目錄可直接執行；若用隔離目錄，先將環境變數`IPAS_REPO_ROOT`設為專案根路徑。

```python
import json, os
from pathlib import Path
import pandas as pd
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
a = pd.DataFrame(data["rows"]).query("entity == 'A'").reset_index(drop=True)
for col in ["event_time", "available_time"]:
    a[col] = pd.to_datetime(a[col], utc=True)
for k in [3, 4, 5]:
    t = a.loc[k, "event_time"]
    known = a.clicks.where(a.available_time <= t)
    lag = known.shift(1)
    rolling = known.shift(1).rolling(3, min_periods=3).mean()
    print(t.tz_convert("Asia/Taipei").strftime("%m-%d"), lag[k], rolling[k])
```
```text
10-08 6.0 4.0
10-09 nan nan
10-10 10.0 8.0
```

:::tip[讀碼重點]
`where`先處理可用時間，`shift(1)`再排除當期。只排序或只shift，都不能阻止晚到資料回流；`min_periods=3`明確要求完整視窗。
:::

### 分割邊界與標籤成熟（補充）

下段區分「可供監督訓練」與「可供歷史輸入」。第一筆驗證列在10月19日18:00，模型採逐日滾動預測，不是在起點一次預測整個未來區段。

```python
import json, os
from pathlib import Path
import pandas as pd
data = json.loads((Path(os.environ.get("IPAS_REPO_ROOT", ".")) / "content/examples/L23301-G-retail.json").read_text(encoding="utf-8"))
df = pd.DataFrame(data["rows"])
for col in ["event_time", "available_time", "label_available_time"]:
    df[col] = pd.to_datetime(df[col], utc=True)
fit_time = pd.Timestamp(data["fit_cutoff"])
candidate = df.loc[data["split"]["train_candidate_indices"]]
train = candidate[candidate.label_available_time <= fit_time]
t = df.loc[28, "event_time"]
h = df[(df.entity == "A") & (df.event_time < t) & (df.available_time <= t)]
print("成熟訓練/排除:", len(train), len(candidate) - len(train))
print("邊界lag1/rolling3:", int(h.clicks.iloc[-1]), float(h.clicks.tail(3).mean()))
```
```text
成熟訓練/排除: 26 2
邊界lag1/rolling3: 8 6.0
```

:::tip[讀碼重點]
這個邊界前三天剛好全部準時可用，才可用`tail(3)`核對。一般情況仍要按日期格點取視窗，不能以最後3筆可用資料代替前3天。
:::

## 怎麼用、怎麼判讀

時間特徵適合觀察具有序列關聯、近期狀態可能影響未來的任務。選lag長度與移動平均視窗時，先說明它們要代表昨日狀態、短期平均，還是較長期活動。

### 預測協議決定合法歷史（補充）

每次只預測下一日，可在下一個預測截止點使用已入庫的新觀察，即使它位於驗證期間。若在起點一次預測未來一週，後面幾天的真實觀察仍屬未來，不能逐天偷放進特徵。

標籤也有成熟時間。訓練邊界應排除尚未定案的標籤；必要時留間隔，不能只靠「訓練日期早於驗證日期」判斷沒有資料洩漏。

### 換個場景

| 場景／資料條件 | 可用的動態特徵 | 判讀重點 |
|---|---|---|
| 具有時間與序列關聯 | lag、移動平均、事件次數 | 要對齊未來預測目標 |
| 使用者近期活動 | 點擊次數與間隔 | 觀察間隔不等於點擊間隔 |
| 能源每日用電（補充） | 昨日用電、近期平均 | 電表回傳延遲也要檢查 |
| 醫療住院監測（補充） | 最近已回報檢驗值 | 採檢時間不等於報告可讀時間 |

## 常見誤解

- **`rolling`自動只看過去。** 預設視窗可包含當列，必須配合預測對齊排除未知當期。（補充）
- **事件在過去就能用。** 晚到資料仍可能在截止時不可讀。（補充）
- **缺值表示點擊為0。** 少了紀錄與真的零次活動是兩回事。（補充）
- **時間排序就解決一切。** 還要檢查實體、標籤成熟和一次預測多久。（補充）

## 進階

### 快照可重建才容易查錯（補充）

保留原始時間戳與預測截止點，才能重現當次預測看到的資料。若來源會事後修訂，還需保存版本或歷次可用時間；只留最後更新結果，無法完整還原舊快照。

### 參考來源

- 科目3指引5.1，`guide-3:5-10`：lag、移動平均、時間間隔與事件次數；未展開公式、入庫延遲與標籤邊界。
- [Lagged features教學](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html)：公式具體化、shift後移動平均及時間驗證思路。
- [pandas shift](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.shift.html)、[rolling](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.rolling.html)：位移、視窗筆數、端點與完整筆數。
- [pandas Time series](https://pandas.pydata.org/docs/user_guide/timeseries.html)：時間差與固定頻率格點。
- [Feast Point-in-time joins](https://docs.feast.dev/getting-started/concepts/point-in-time-joins)：按預測時點還原歷史的核心延伸；雙時間與成熟契約由本組合成例明示。

## 小結

- lag取指定過去位置，移動平均摘要近期，事件次數反映活動頻率。
- 保留格點，先檢查可用時間，再shift與移動平均。（補充）
- 特徵可用與標籤成熟各自檢查，驗證方式要符合實際預測協議。（補充）
