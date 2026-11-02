---
id: online-learning
title: 線上與增量學習
kind: technique
codes: [L21302, L21301]
aliases: [Online Learning]
summary: 隨新資料到達延續模型狀態更新，仍須驗證、控制污染並保留回復點
requires: [feedback-loop]
goals:
  - id: g1
    text: 區分 AutoML 搜尋與線上持續更新，說明離線重訓及在線更新的用途
  - id: g2
    text: 用成熟標籤、驗證回放及人工門檻控制污染、遺忘與格式變動風險
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 促銷需求每天改變，團隊甲每週搜尋20組模型配置，團隊乙把每5筆成熟樣本接續更新原模型。哪個說法正確？
    options:
      A: 甲是線上更新，乙是AutoML搜尋；兩者均不需額外品質驗證
      B: 甲是線上推論，乙是離線測試；兩者均只輸出預測而不學習
      C: 甲偏AutoML選配置，乙偏增量更新；兩者仍要驗證候選品質
      D: 甲是增量更新，乙是AutoML搜尋；兩者均會自動變更特徵欄數
    answer: C
    explain:
      A: 搜尋配置與延續模型狀態是不同任務，兩者都不能省略驗證。
      B: 搜尋與更新都可能涉及訓練，不能只稱為輸出預測或測試。
      C: AutoML可協助配置搜尋，持續分批更新則延續既有學習狀態。
      D: 新樣本不代表新特徵，欄位維度也不會由這兩種機制自動相容。
  - id: c2
    goal: g2
    type: choice
    prompt: 舊模型吃f1的2欄，新串流多出地區欄成為f2的3欄；另4筆結果未成熟。哪項處理較合適？
    options:
      A: 隔離未成熟資料，停止將f2送入舊版；另建相容候選再驗證
      B: 將4筆預測改成真值，直接補成3欄；由舊版自行學會新維度
      C: 保留未成熟資料，以隨機刪欄湊成2欄；省略特徵意義的核對
      D: 將4筆都視為負類，立即覆寫舊版；只要呼叫成功便完成發布
    answer: A
    explain:
      A: 標籤與特徵契約都要先核對，格式改變需另驗證候選與回復相容性。
      B: 預測不是真值，一般固定維度估計器也不會自動擴充欄數。
      C: 欄數相同不代表語意相同，隨意刪欄會破壞原來的輸入定義。
      D: 未成熟不能當負類，訓練成功也不能替代候選品質與發布驗證。
  - id: c3
    goal: g2
    type: choice
    prompt: 新候選在近期4筆驗證錯0筆，歷史4筆回放錯3筆；教學門檻為兩邊各最多錯1筆。下一步應如何？
    options:
      A: 正式擴量，因近期錯0筆；刪除4筆歷史回放以避免舊情境干擾
      B: 正式擴量，因兩邊共錯3筆；用8筆平均遮住歷史情境的退步
      C: 立即覆寫，因更新呼叫成功；上線後再建立第一個可回復版本
      D: 暫緩發布，保留舊版與更新紀錄；調查歷史情境退步再驗證
    answer: D
    explain:
      A: 歷史回放超過門檻，刪除不利證據無法處理遺忘風險。
      B: 門檻分別套用於兩個情境，整體平均不能抵銷歷史退步。
      C: 呼叫成功只表示更新執行，回復版本必須事先準備。
      D: 新舊情境都要守住門檻，未過先調查，不把候選直接推成正式版本。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-21]
---

## 為什麼需要

需求變化快或資料量很大時，單靠很久以前訓練好的模型，可能跟不上新情境。指引提出自動化機器學習（AutoML）與線上學習，作為持續優化的可選方法。

持續用新資料調整模型，是為了讓預測品質跟上環境變動；是否維持準確，仍要回收結果確認。

:::supplement[來源：scikit-learn Strategies to scale computationally，Incremental learning]
線上學習（Online Learning）接續新資料更新既有狀態，不必每次從頭重跑全部歷史資料。若只即時回傳預測、參數沒有改變，屬於線上推論。
:::

## 直覺

資料回收與人工回饋循環提供更新素材，線上學習則安排如何持續更新。

:::supplement[來源：Google ML pipelines，Capturing ground truth]
資料到達與答案成熟可能不同步；先留下當時預測，等可靠結果出現，才能判斷要學什麼。
:::

![沿資料到達、成熟、候選更新與驗證追蹤狀態；風險門控屬補充，更新完成仍未等於正式發布。](figure:l21302-online-learning-update)

## 定義與公式

指引把 AutoML 與線上學習列在持續優化機制中，適用條件是資料規模大或變化快。本頁以流程區分角色，不另設更新公式。

:::supplement[來源：Microsoft Azure What is automated ML?；Google Managing ML Projects，ML pipelines；scikit-learn Strategies to scale computationally，Incremental learning]
| 做法 | 改什麼 | 常見輸出 |
|---|---|---|
| AutoML 搜尋 | 模型或超參數配置 | 待驗證的候選配置 |
| 離線重訓 | 用固定資料版重新訓練 | 完整候選產物 |
| 線上／增量更新 | 用新樣本延續模型狀態 | 更新後的候選狀態 |

兩種優化可搭配：先用 AutoML 找配置，再決定如何更新。搜尋配置不表示模型已從串流學習，增量更新也不保證找到最佳配置。

線上更新可逐筆或分小批執行。增量學習與特徵空間變動另教批次及表示選型；本頁聚焦串流營運、污染檢查與發布門控。
:::

## 走一次流程

### 依變動速度選更新路徑

資料快速改變時，可以評估持續更新。指引也提供模型重訓與版本管理的做法；更新路徑需配合資料條件，而不是只選名稱較新的技術。

:::supplement[來源：Google ML pipelines，Updating the model；scikit-learn Incremental learning；本組教學資料]
本組銷售與客服各 24 筆互動，沿用相同索引與種子。每領域通過品質檢查的 TR 有 10 筆，固定分成兩批各 5 筆；兩個領域的標籤意義不同，分開更新模型。

- **離線路徑**：凍結成熟資料版，重新訓練或搜尋配置，驗證後才交付候選。
- **在線路徑**：先預測並記版本，等真值成熟，檢查許可與覆核，再接續更新候選。

兩條路都接上候選驗證及核准發布。月評可決定改用離線重訓；不必為了維持在線更新而接受不可靠標籤。
:::

### 污染、遺忘與回復（補充）

本組先排除未成熟 4 筆，再隔離未許可及覆核未決各 1 筆。來源不明、點擊冒充成交、重複入批，都可能污染更新；每批記下來源與處理狀態。

更新候選後，先看固定驗證集（VA）的 4 筆，再回放另一批歷史 4 筆。近期改善、歷史退步，可能是遺忘或情境取捨；本例要求兩邊各至多錯 1 筆，未過就保留舊版。

歷史回放也用於初始化，只能檢查已知情境有沒有退步，不能當成獨立的泛化成績。VA 才是這次沒有加入更新的驗證資料。

VA 第一欄固定為 −0.8、−0.3、0.3、0.8；歷史回放為 −1、−0.6、0.6、1，取值與 ID 都分開。兩者仍遵循同一個簡化標籤規則，即使兩邊都通過門檻，也不能證明跨情境抗遺忘。

通過後仍由模型與風險負責人核准，資訊部門小量發布，另收新流量及成熟結果。若異常，停更新並回復相容版本；保留失敗批次，查清原因再續跑。

本組原版觀察集（OBS）的 4 筆是更新前 v0 的紀錄，不能冒稱新候選的線上成績。新版規劃另收 4 筆、最多錯 1 筆示範門控；本資料沒有新版線上已過的紀錄。

本例筆數很小，門檻只用來演示決策。不能把通過這幾筆當成真實上線充分證據，也不能反覆用 OBS 調參後仍稱它獨立。

### 新特徵到達時（補充）

f1 固定兩欄：客服問題複雜度或銷售興趣分數，加上一個保留欄。若 f2 新增地區而變成三欄，先停止把 f2 送入舊模型，不讓欄數碰巧相容就通過。

資料人員定義新欄位及可用時刻，模型人員另建相容候選，工程同時保存 f1／f2 路徑和回復點。具體表示法與演算法選型，接續增量學習與特徵空間變動。

## 程式（補充）

兩段接續執行，節錄客服 TR 的 10 筆及固定驗證、歷史回放特徵。它們與例子檔一致，僅示範候選更新，不會修改正式服務。

```python
from copy import deepcopy
from sklearn.linear_model import SGDClassifier
X = [[-1, 0], [-0.6, 0], [0.6, 0], [-1, 0], [-0.6, 0],
     [0.6, 0], [-1, 0], [-0.6, 0], [0.6, 0], [1, 0]]
y = [0, 0, 1, 0, 0, 1, 0, 0, 1, 1]
replay = [[-1, 0], [-0.6, 0], [0.6, 0], [1, 0]]
replay_truth = [0, 0, 1, 1]
valid, truth = [[-0.8, 0], [-0.3, 0], [0.3, 0], [0.8, 0]], [0, 0, 1, 1]
model = SGDClassifier(loss="log_loss", random_state=21302, shuffle=False,
                      learning_rate="constant", eta0=0.1)
model.partial_fit(replay, replay_truth, classes=[0, 1])
log = []
print("初始化歷史樣本", len(replay), "特徵欄數", model.n_features_in_)
```
```text
初始化歷史樣本 4 特徵欄數 2
```

第二段先複製候選再更新，沒有直接改動正式版。兩個門檻分開檢查；實際核准、小量觀察與回復由前述工作流執行。

```python
for batch, start in enumerate([0, 5], 1):
    candidate = deepcopy(model)
    candidate.partial_fit(X[start:start + 5], y[start:start + 5])
    va = sum(p != t for p, t in zip(candidate.predict(valid), truth))
    old = sum(p != t for p, t in zip(candidate.predict(replay), replay_truth))
    passed = va <= 1 and old <= 1 and candidate.n_features_in_ == 2
    log.append((batch, start, start + 5, int(va), int(old), passed))
    if passed:
        model = candidate
    print(f"批次{batch}：5筆，驗證錯{va}，回放錯{old}，保留候選={passed}")
assert [entry[1:3] for entry in log] == [(0, 5), (5, 10)]
print("批次紀錄", len(log), "；正式發布：待人工核准")
```
```text
批次1：5筆，驗證錯1，回放錯0，保留候選=True
批次2：5筆，驗證錯0，回放錯0，保留候選=True
批次紀錄 2 ；正式發布：待人工核准
```

:::tip[讀碼重點]
第一次 `partial_fit` 指定完整類別。後續沿用已學狀態；`deepcopy` 保留更新前狀態，門檻未過不取代它。兩批都只拿 TR，沒有把 VA 或 OBS 加進去。
:::

## 怎麼用、怎麼判讀

快速變動或大規模資料可考慮線上學習。

:::supplement[來源：scikit-learn SGDClassifier API，partial_fit；Strategies to scale computationally]
不是所有模型都支援增量更新；穩定、標籤回收慢的流程，也能選定期離線重評與重訓。

`partial_fit` 更新一輪不代表已收斂，學習率與停止條件仍要安排。新增樣本和新增欄位是不同問題；欄位順序、尺度及意義也必須與原版一致。
:::

### 換個場景

| 場景 | 可選做法 | 主要判斷 |
|---|---|---|
| 快變或大規模資料 | AutoML 或在線更新 | 能否持續優化 |
| 促銷銷售（補充） | 成交成熟後小批更新 | 點擊不當成交 |
| 製造檢測（補充） | 複驗後更新候選 | 舊材質回放不可退步 |
| 金融風控（補充） | 等到期結果或離線重訓 | 標籤延遲與使用許可 |

## 常見誤解

- 「AutoML 和線上學習是同一件事。」搜尋配置與接續狀態更新的角色不同。（補充）
- 「服務即時回應就是在線學習。」參數沒更新，只是在推論。（補充）
- 「新欄位加進來，舊估計器會自行理解。」一般固定維度估計器做不到。（補充）
- 「新情境比較好就可發布。」仍須檢查歷史退步、使用條件及回復證據。（補充）

## 進階

### 回放集合也要版本化（補充）

固定歷史集合有助比較更新前後，但反覆拿它挑候選也會形成選擇偏差。保存每次使用紀錄，正式晉升另取足量獨立資料；別無限重用同一小集合。

### 參考來源

- 科目 1 學習指引 `guide-1:5-21`：支持快速變化、大規模資料、AutoML 與在線學習的優化用途。
- [scikit-learn Strategies to scale computationally](https://scikit-learn.org/stable/computing/scaling_strategies.html)，Incremental learning：支持小批延續更新、適用估計器及特徵表示限制。
- [SGDClassifier API](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.SGDClassifier.html)，partial_fit：支持完整類別、每次一輪及自行控制收斂的程式說明。
- [scikit-learn 官方增量分類教學](https://scikit-learn.org/stable/auto_examples/applications/plot_out_of_core_classification.html)：參考分批更新、訓練與評估分離的教法，未使用其資料。
- [Google ML pipelines 課程](https://developers.google.com/machine-learning/managing-ml-projects/pipelines)：支持離線更新、成熟真值與驗證流程的補充。
- [Microsoft Azure What is automated ML?](https://learn.microsoft.com/en-us/azure/machine-learning/concept-automated-ml?view=azureml-api-2)：支持 AutoML 搜尋與自動建模的角色區分。
- [Kirkpatrick 等人的持續學習研究](https://arxiv.org/abs/1612.00796)：支持新任務更新可能遺忘舊任務的風險。
- [NIST AI RMF Playbook MANAGE](https://airc.nist.gov/airmf-resources/playbook/manage/)，MANAGE 4：支持發布後觀察、回饋及變更處置的補充。
- 本組教學資料 `content/examples/L21302-F-interactions.json`：支持切分、批次、門檻、回放及 f1／f2 情境。

## 小結

- 快速變動或大規模資料可評估 AutoML 與在線學習。
- 搜尋配置、延續更新與線上推論各有不同用途。（補充）
- 更新前核對標籤與格式，更新後驗證近期及歷史情境。（補充）
- 保留舊版，通過人工門檻與線上觀察後才擴量。（補充）
