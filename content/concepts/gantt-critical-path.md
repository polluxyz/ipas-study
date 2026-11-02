---
id: gantt-critical-path
title: 甘特圖與關鍵路徑
kind: technique
codes: [L21202]
aliases: []
summary: 甘特圖呈現時程，關鍵路徑找出決定最早完工的相依鏈
requires: [work-breakdown-structure]
goals:
  - id: g1
    text: 從日期、前置與資源配置辨認可並行的工作及瓶頸
  - id: g2
    text: 用含責任資源的里程碑判讀延誤對交付的影響
  - id: g3
    text: 順推逆推最早與最晚時間、計算總浮時，說明緩衝與資源限制
formula_groups:
  - id: forward-pass
    source: https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21202-B
  - id: backward-float
    source: https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21202-B
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: A做2日；B、C都等A，分別做3、4日；D等B做2日；E等C、D做3日；F等E做1日。人力不衝突，哪個安排正確？
    options:
      A: B與C可並行，E在第6日邊界開始，全案第10日邊界完成
      B: B與C須串行，E在第9日邊界開始，全案第13日邊界完成
      C: B與C可並行，E在第7日邊界開始，全案第11日邊界完成
      D: B與D可並行，E在第6日邊界開始，全案第10日邊界完成
    answer: C
    explain:
      A: E還要等第7日邊界才完成的D，不能只看C。
      B: 在資源足夠的題設中，B與C沒有彼此前置，可以並行。
      C: D在第7日邊界完成，E到第10日邊界，F到第11日邊界。
      D: D以前置B完成為開始條件，兩者不能在這個網路中同時開始。
  - id: c2
    goal: g2
    type: choice
    prompt: 基準M1在E完成的第10日邊界，M2在F完成的第11日邊界。只有D增加2日，其餘不變且無額外緩衝，兩個里程碑如何變動？
    options:
      A: M1移到第12日邊界，M2移到第13日邊界
      B: M1留在第10日邊界，M2移到第13日邊界
      C: M1移到第11日邊界，M2移到第12日邊界
      D: M1留在第10日邊界，M2留在第11日邊界
    answer: A
    explain:
      A: D在關鍵路徑上，增加2日會把E、F及兩個里程碑都後移2日。
      B: E也要等待D，因此M1不會留在原來的時間。
      C: C的1日浮時不能吸收另一條關鍵鏈上D的延誤。
      D: 題設未加緩衝，也未安排趕工，無法維持原日期。
  - id: c3
    goal: g3
    type: choice
    prompt: C的最早開始與完成是2、6，最晚開始與完成是3、7。若C單獨延長2日，其餘固定，哪個判讀正確？
    options:
      A: C有2日浮時，因為最早開始是2，延長2日不影響完工
      B: C有4日浮時，因為本身工期是4，延長2日不影響完工
      C: C有0日浮時，因為最早完成是6，延長2日使完工晚2日
      D: C有1日浮時，因為3減2是1，延長2日使完工晚1日
    answer: D
    explain:
      A: 最早開始是時間位置，不能直接當作浮時。
      B: 工期與可延後的餘裕不同，不能拿工期當浮時。
      C: 最晚完成7比最早完成6多1日，並非零浮時。
      D: C可吸收1日延長，超出的1日會讓E、F後移。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:4-18, guide-1:4-19, guide-1:4-27]
---

## 為什麼需要

任務都列出來，還不知道什麼時候能交付。資料、模型與介面各自有進度，整合卻必須等到必要前置全部完成。

甘特圖（Gantt Chart）把工作放到時間軸上。關鍵路徑（Critical Path）進一步指出哪些相依工作決定完工時間，讓資源調整有明確對象。

## 直覺

橫條對應工作區間；上下兩條重疊，表示計畫上安排了並行。圖中另外標出負責人、資源與里程碑，便於跨部門核對。

![橫軸為2026年11月工作日；粗框星號是關鍵工作，菱形標出原型與試用決議兩個完成節點。](figure:l21202-gantt-critical-path-calendar)

:::supplement[來源：PMI「Critical path method calculations」]
先讀相依，再看長度。最長的相依鏈限制最早完工；只看最長的一根橫條，找不到這條鏈。
:::

## 定義與公式

甘特圖以時間為橫軸、任務為縱軸。里程碑（Milestone）標記重要完成或決策節點，可以搭配責任歸屬與資源安排一起呈現。

### 最早時間：順推（補充）

本例只用「完成到開始」相依，沒有額外間隔。從時間0起算，以工作日邊界表示時間，不把開始日與結束日都重複加算。

$$
\mathrm{ES}_i=\max_{j\in P_i}\mathrm{EF}_j,\qquad
\mathrm{EF}_i=\mathrm{ES}_i+d_i
$$

$P_i$ 是任務 $i$ 的直接前置集合，$d_i$ 是工期；ES、EF 分別是最早開始與最早完成。沒有前置時，ES設為0。

E的前置C、D分別在6、7完成，所以ES取較晚的7；再加E的3日工期，EF為10。

### 最晚時間與總浮時：逆推（補充）

先以最早可行完工時間作為專案終點，再往回算：

$$
\begin{aligned}
\mathrm{LF}_i&=\min_{k\in S_i}\mathrm{LS}_k, &
\mathrm{LS}_i&=\mathrm{LF}_i-d_i\\
\mathrm{TF}_i&=\mathrm{LS}_i-\mathrm{ES}_i
             =\mathrm{LF}_i-\mathrm{EF}_i
\end{aligned}
$$

$S_i$ 是直接後續集合，LS、LF 是最晚開始與最晚完成，TF是總浮時。沒有後續時，LF設為專案終點；總浮時表示不延後終點的可延遲量。

E的LS為7，C的LF便是7；C工期4，LS為3。C的ES為2，所以總浮時是1日；同樣可用7減6得到1日。

## 算一次

### 六工作包順推逆推（補充）

共用客服案與維護案使用相同相依及工期，各自獨立計算。工期是固定教學假設；資料版本、切分索引與種子42也固定，不因改排程重抽樣本。

![E同時等待C與D；A到B到D到E到F以粗線相接，C所在支線有1日總浮時。](figure:l21202-gantt-critical-path-network)

先由A向F順推，再由F回到A逆推。下表每一對時間依序為開始、完成，單位是工作日邊界。

| 任務／工期 | ES／EF | LS／LF | 總浮時 |
|---|---|---|---|
| A／2日 | 0／2 | 0／2 | 0日 |
| B／3日 | 2／5 | 2／5 | 0日 |
| C／4日 | 2／6 | 3／7 | 1日 |
| D／2日 | 5／7 | 5／7 | 0日 |
| E／3日 | 7／10 | 7／10 | 0日 |
| F／1日 | 10／11 | 10／11 | 0日 |

A→B→D→E→F共11日，A→C→E→F共10日。前者是關鍵路徑；C單獨多花1日仍可準時接上E，多花2日就讓全案晚1日。

### 對回日期、責任與資源

指引要求把里程碑、責任與資源一起呈現。下表以教學合成的M1、M2示範；通過條件是本例補充。

:::supplement[來源：PMI「Critical path method calculations」；本組教學合成工作包]
本例自2026/11/02開始，只計週一至週五，不另扣假日。E在11/13結束時完成M1，F在11/16結束時完成M2；圖中的星號與粗框共同標出關鍵工作。
:::

| 節點 | 主責／資源 | 通過條件（補充） | 基準日期 |
|---|---|---|---|
| M1 可用原型 | 李／整合環境 | 固定驗證至少16/20；20項整合全過，存取及說明完成 | 11/13日終 |
| M2 試用決議 | 周／決議文件 | 記錄試用範圍、負責人與未結風險 | 11/16日終 |

:::supplement[來源：PMI「Critical path method calculations」；本組教學合成工作包]
D若增加2日，M1改為11/17，M2改為11/18。維護案換成設備狀態判斷，同樣依20筆固定驗證與整合證據核對，不能只把里程碑圖示改成完成。
:::

### 緩衝與資源衝突

指引的資源調整，是先發現哪些工作重疊，再確認人力是否足以支援。本例用B、C是否同人執行，具體檢查這項限制。

:::supplement[來源：PMI「Critical path method calculations」；Asana「Critical path method」的 Resolve resource shortages]

C的1日浮時來自相依結構。另在F後預留2日，才是額外安排的完工緩衝；若對外承諾11/18，便有這2日餘裕，不能同時宣稱承諾日是11/16。

假設B、C改由同一位只能串行的人處理。先做B再做C，C改到5–9，E改到9–12，F改到12–13，全案至少需13日，基準11日不再可行。

可改派另一位介面人員恢復並行，前提是技能與交接到位。增加人力是否縮短工期要另估；關鍵路徑法本身不會自動解掉資源衝突。
:::

## 程式（補充）

先把環境變數 `TEXTBOOK_REPO_ROOT` 設為教材repo根目錄。三段依序執行；讀共用JSON，工期沒有亂數，資料種子固定42。

第一段建立拓樸順序，確保每個前置都先處理；若有循環就中止。

```python
import json, os
from pathlib import Path
from graphlib import TopologicalSorter
root = Path(os.environ["TEXTBOOK_REPO_ROOT"])
data = json.loads((root / "content/examples/L21202-B-work-packages.json").read_text(encoding="utf-8"))
tasks = {t["id"]: t for t in data["cases"][0]["tasks"]}
order = list(TopologicalSorter({i: t["predecessors"] for i, t in tasks.items()}).static_order())
es, ef = {}, {}
for i in order:
    es[i] = max((ef[p] for p in tasks[i]["predecessors"]), default=0)
    ef[i] = es[i] + tasks[i]["duration_days"]
end = max(ef.values())
print("最早完工:", end, "工作日")
```
```text
最早完工: 11 工作日
```

第二段反向處理，後續開始時間取最小值，才能同時滿足所有後續限制。

```python
successors = {i: [j for j in order if i in tasks[j]["predecessors"]] for i in order}
ls, lf, total_float = {}, {}, {}
for i in reversed(order):
    lf[i] = min((ls[j] for j in successors[i]), default=end)
    ls[i] = lf[i] - tasks[i]["duration_days"]
    total_float[i] = ls[i] - es[i]
    assert total_float[i] == lf[i] - ef[i]
for i in order:
    print(i, es[i], ef[i], ls[i], lf[i], total_float[i])
```
```text
A 0 2 0 2 0
B 2 5 2 5 0
C 2 6 3 7 1
D 5 7 5 7 0
E 7 10 7 10 0
F 10 11 10 11 0
```

第三段把零浮時活動串成真正的路徑。本例只有一條；有分叉時逐條列出，不把所有零浮時節點硬接成一條。

```python
def paths(i, prefix):
    chain = prefix + [i]
    following = [j for j in successors[i] if total_float[j] == 0 and ef[i] == es[j]]
    if not successors[i]:
        print("關鍵路徑:", "→".join(chain))
    for j in following:
        paths(j, chain)
for i in order:
    if not tasks[i]["predecessors"] and total_float[i] == 0:
        paths(i, [])
```
```text
關鍵路徑: A→B→D→E→F
```

:::tip[讀碼重點]
順推用 `max` 等最後一個前置，逆推用 `min` 保住最早必須接上的後續。`default=0` 與 `default=end` 分別處理起點及終點。
:::

## 怎麼用、怎麼判讀

指引用甘特圖排列需求、資料、訓練、驗證與部署。零售案例原排三個月，看到資料準備與訓練重疊後調配資源，整體時程約縮短10%；這是指引案例的結果。

實際時長會隨資料量與模型複雜度改變。不能直接把上述10%套用到其他專案。

:::supplement[來源：PMI「Critical path method calculations」；Asana「Critical path method」的 Resolve resource shortages]
本頁11日是指定工期與無資源衝突下的最早時間，不另外扣10%。實際估計變動、前置改變或資源重新分配後，必須重算；浮時也不是每個部門都能獨自花掉的額外預算。
:::

### 換個場景

| 場景 | 判讀重點 |
|---|---|
| 零售AI跨部門導入 | 對照資料與訓練重疊，安排所需資源 |
| 資料量大、模型較複雜 | 重新估算資料與訓練工期，追蹤驗證迭代 |
| 醫療試辦（補充） | 將授權與審查窗口列為真實前置 |
| 交通告警（補充） | 現場測試設備有限時，另檢查資源衝突 |

## 常見誤解

- 「橫條重疊就一定能並行」：還要檢查資料、介面與資源限制。（補充）
- 「最長任務就是關鍵路徑」：比較的是完整相依鏈。（補充）
- 「非關鍵工作可以無限延後」：C只有1日總浮時。（補充）
- 「里程碑就是模型分數」：節點要帶日期、責任與可檢查的通過條件。（補充）

## 進階

### 多條關鍵路徑（補充）

若C工期改為5日，兩條鏈都是11日，便同時關鍵。只加快其中一條鏈，全案仍受另一條限制；不能用相依數量當作同長路徑的唯一勝負條件。

### 參考來源

- 科目1指引 `guide-1:4-18`、`guide-1:4-19`、`guide-1:4-27`：支持甘特圖用途、零售資源調整與責任資源里程碑。
- [PMI：Critical path method calculations](https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040)：支持順推、逆推、總浮時及關鍵路徑公式。
- [Asana：Critical path method](https://asana.com/resources/critical-path-method)：參考算例教學與資源限制；等長路徑採PMI定義，不採文章的相依數量取勝說法。

## 小結

- 甘特圖把日期、任務、責任、資源與里程碑放在一起。
- 前置全部完成才接下一步；順推取最大、逆推取最小。
- 總浮時描述不延後終點的餘裕，本例C有1日。
- 工期與資源假設改變時，重算排程與承諾日期。
