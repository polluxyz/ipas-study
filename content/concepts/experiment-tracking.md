---
id: experiment-tracking
title: 實驗追蹤
aliases: [TensorBoard, MLflow, WandB, Weights & Biases, 訓練紀錄]
kind: tool
codes: [L23303, L21302]
guide_refs: [guide-3:5-20, guide-1:5-19, guide-1:5-20]
gaps:
  - ref: guide-1:5-19
    level: missing
    ability: 指引已介紹實驗記錄與模型版本追蹤（MLflow、DVC），但沒有單獨定義 Model Registry 的角色與職責；考題要選出「集中管理模型版本、訓練紀錄與部署狀態」的角色
  - ref: guide-1:5-20
    level: shallow
    ability: 指引分系統、應用、業務三層指標，沒有說哪些屬於訓練階段的實驗紀錄；考題要把學習率曲線、超參數軌跡歸到離線實驗追蹤，把延遲、漂移歸到線上監控
author: claude
status: draft
textbook: v2
summary: 實驗追蹤把每次訓練的輸入與結果存成可查的紀錄，讓結果能重現、比較、回溯
goals:
  - id: g1
    text: 說得出重現一次訓練所需記錄的資料、程式、環境、隨機種子與模型版本
  - id: g2
    text: 讀得懂兩次實驗的訓練與驗證損失曲線，並用可追溯的紀錄選出較好的一次
  - id: g3
    text: 判讀 GPU、CPU、記憶體與耗時紀錄反映的資源瓶頸，也說得出單看使用率的限制
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊只保存了訓練好的權重檔與最後的準確率。三週後要重做同一次訓練，卻得到不同的曲線。以下哪一項最可能是缺少的紀錄？
    options:
      A: "資料集版本、程式的 Git commit、環境版本與隨機種子"
      B: "GPU 型號；硬體相同就足以重現原本曲線"
      C: "訓練完成後的使用者回饋與滿意度；以這些結果反推當時採用的訓練設定"
      D: "每輪損失與準確率的曲線截圖；已有完整曲線，就足以取代資料版本和隨機種子"
    answer: A
    explain:
      A: "對。資料、程式、環境與種子是重做訓練所需的輸入紀錄，僅有權重及最終指標不足以追查差異。"
      B: "GPU 資訊有助記錄環境，但相同硬體不能排除資料、程式或種子改變，仍需保存這些輸入。"
      C: "使用者回饋是模型使用後的結果，無法從中唯一還原當時的資料、程式與訓練設定。"
      D: "曲線是訓練輸出；即使逐輪保存，也不能取代產生曲線所用的資料版本與隨機種子。"
  - id: c2
    goal: g2
    type: choice
    prompt: run-x 的最佳驗證損失是 0.32（第 5 輪），run-y 是 0.30（第 2 輪）。兩者的資料版本、程式版本與隨機種子都不同，也沒有確認驗證集與損失算法是否一致。可以直接說 run-y 較好嗎？
    options:
      A: "可以，run-y 的 0.30 低於 run-x 的 0.32；既然兩者都叫驗證損失，就可直接比較"
      B: "不行，不同 run 的驗證損失一律不能用來選模"
      C: "不行，應反覆用同一測試集挑出較好的 run，再將該測試分數當最終成績"
      D: "不行，先確認驗證集與損失算法一致，再比較 0.30 與 0.32"
    answer: D
    explain:
      A: "指標名稱相同不代表計算基準相同；驗證樣本或算法改變，都可能造成數值差異。"
      B: "在驗證集與算法一致的條件下，驗證損失可作為比較不同 run 的依據。"
      C: "用測試集反覆挑 run 會讓測試資訊參與選模，該分數便失去獨立最終評估的角色。"
      D: "對。先確認相同驗證集與損失算法，差值才可解讀；若要歸因於某項設定，還需控制其他條件。"
  - id: c4
    goal: g2
    type: choice
    prompt: 工廠的瑕疵檢測團隊把 run-1 改成 run-2 時，同時調高了學習率、加了資料增強。兩次都用同一份固定的驗證集與同一種損失算法評估，run-2 的驗證損失較低。主管問：進步是不是資料增強的功勞？以下哪一種回答最合適？
    options:
      A: "可歸因於資料增強；驗證集與損失算法都固定，便已排除學習率對結果的影響"
      B: "可歸因於學習率；兩次使用相同驗證集，就能單獨量出學習率造成的改善"
      C: "只能說這次 run-2 整體較好；要歸因，需固定其他條件、各自只改一項再比較"
      D: "可判定兩項改動各自有效；合用後驗證損失較低，足以證明分開使用也會改善"
    answer: C
    explain:
      A: "固定評估基準有助比較整體設定，但沒有排除同時變動的學習率，仍無法單獨歸因給資料增強。"
      B: "同一驗證集只能固定評估條件；資料增強也同時改變，不能直接量出學習率的個別貢獻。"
      C: "對。這次可比較整體設定的驗證結果；要辨識個別改動的影響，需控制其餘條件，並用多個種子重複比較。"
      D: "兩項合用的改善不表示兩者各自有效；可能只有其中一項有效，也可能存在交互作用。"
  - id: c3
    goal: g3
    type: short
    prompt: 某個 run 每輪耗時很長，紀錄顯示 GPU 使用率平均只有 30%、CPU 使用率接近 100%。你會先懷疑哪裡？為什麼不能只看使用率就下結論？
    key_points:
      - 先懷疑資料讀取或前處理（CPU 端）太慢，GPU 在等資料
      - 可以檢查資料載入的工作程序數量或前處理的寫法
      - 使用率是取樣時間內有沒有在工作，不代表算力被有效利用
      - 平均值會蓋住尖峰，要搭配耗時、記憶體尖峰與取樣間隔一起看
---

## 為什麼需要

調參時，同一個模型常跑幾十次。每次可能改學習率、批次大小或資料。

沒有紀錄，過幾天就說不清楚哪一次最好、當時用了什麼設定。最好的那一次也可能再也做不出來。

實驗追蹤（Experiment Tracking，也稱訓練紀錄）把每次訓練的設定與結果存在一起。它帶來三個好處：

- 可重現：照紀錄能重做同一次訓練，得到相近的結果。
- 可比較：多次訓練放在同一張表或同一張圖上，差異一眼看得出。
- 可回溯：模型上線後出問題，能查出它用哪份資料、哪一版程式訓練出來。

## 直覺

:::supplement[來源：MLflow 官方文件「MLflow Tracking」的 Concepts、Tracking Runs 章節]
一次完整的訓練叫一個 run（一次訓練的完整紀錄，各有唯一編號）。

一個 run 像一頁實驗筆記：上半寫「我怎麼做的」，下半寫「結果如何」。追蹤工具不改變訓練本身，只負責把兩半寫到固定的地方，並替每個 run 編號。
:::

| 半邊 | 要記的內容 |
|---|---|
| 輸入：我怎麼做的 | 資料版本、超參數（Hyperparameter） |
| 輸出：結果如何 | 損失與指標、權重（Weight）檔、資源用量 |

:::supplement[來源：MLflow 官方文件「MLflow Tracking」；PyTorch 官方文件「Reproducibility」]
輸入還包括程式版本、環境與隨機種子；輸出可逐個 epoch（整份訓練資料看過一輪）記錄，也包括耗時。
:::

:::tip[重點]
追蹤的是「輸入」加「輸出」兩半。只存最後的模型，沒有輸入那一半，就無法重做同一次訓練。（補充）
:::

## 走一次流程

以共用例子的信用卡盜刷偵測為例（正類是盜刷）。下面走完一個叫 run-a 的訓練。run-a 的設定與損失是教學模擬資料。

### 步驟 1：訓練前，寫下輸入

| 類別 | run-a 的紀錄 | 缺了會怎樣 |
|---|---|---|
| 資料版本與切分 | 交易資料集 v3 | 資料被改過也不知道，驗證損失不能比 |
| 程式版本（補充） | Git commit 3f2a9c1，無未提交的修改 | 不知道當時的前處理與訓練寫法 |
| 環境（補充） | Python 3.11、PyTorch 2.4、CUDA 12.1、1 張 GPU | 套件升級後，結果可能對不上 |
| 隨機種子（補充） | 42 | 初始權重與資料洗牌順序不同，曲線會不一樣 |
| 超參數與訓練設定 | 學習率（Learning Rate）0.001、批次大小（Batch Size）32、最多 8 個 epoch、優化器 Adam、損失函數交叉熵 | 不知道是哪個設定造成差異 |
| 模型結構 | 兩個隱藏層，各 64 與 32 個節點 | 同樣的超參數可能對應不同的模型 |

:::supplement[來源：MLflow 官方文件「MLflow Tracking」的 Concepts、Tracking Runs 章節；PyTorch 官方文件「Reproducibility」的 Controlling sources of randomness 章節]
資料版本還可加內容雜湊值（Hash，由內容算出的指紋）；訓練／驗證切分的索引清單另存，也算雜湊，以確認資料或切分是否被改過。

隨機種子（Random Seed）是亂數產生器的起點。權重初始值、資料洗牌與 Dropout 都靠亂數。種子固定，這些隨機選擇才會每次相同。

程式版本要確認「沒有未提交的修改」。有的話，commit 編號描述的不是實際跑過的程式。
:::

### 步驟 2：訓練中，每個 epoch 寫一筆

訓練時記下以下數值：

- 訓練損失與驗證損失，兩條都要。只有一條，看不出過擬合。
- GPU、CPU、記憶體的使用量，數字旁要帶單位（%、GB）。
- 該輪耗時（秒）。（補充）

:::supplement[來源：MLflow Python API 的 mlflow.log_metric 頁面]
每個 epoch 結束時，用 epoch 編號當橫軸寫入數值。
:::

### 步驟 3：訓練後，存結果

:::supplement[來源：Keras 官方文件 ModelCheckpoint 的 save_best_only 參數]
訓練中，每當驗證損失創新低，就存一份權重檔。run-a 跑完 8 輪，最低的是第 6 輪（0.35），所以保留第 6 輪的權重。要看完第 7、8 輪才知道它最低，所以它是最佳輪次，不是停止時間。
:::

早停（Early Stopping）才決定何時停止。假設耐心值（patience）是 2，連續 2 輪沒創新低就停。

run-a 會在第 8 輪停下，run-b 在第 5 輪。這是教學假設，細節見 [[early-stopping]]。

:::supplement[來源：Keras 官方文件 EarlyStopping 的 restore_best_weights 參數]
若設定取回最佳權重，兩者各取回第 6、3 輪的權重。
:::

:::supplement[來源：MLflow 官方文件「MLflow Tracking」的 Concepts → Runs 章節]
同名的 `best_epoch6.pt` 在不同 run 是不同的檔案。用「run 編號 + 檔案路徑」或檔案雜湊值指認模型，不要只靠檔名。
:::

選定 run-a 之後，才用共用例子的 20 筆留出樣本評估一次，並把結果寫回 run-a 的紀錄：

- 閾值 0.5 時，TP=6、FP=2、FN=2、TN=10。
- 精確率與召回率都是 6/8 = 0.75。
- ROC AUC 約 0.859。

這一步的順序很重要：用驗證損失選 run，留出樣本只在選定後用一次。

### 步驟 4：重現這個 run（補充）

1. 用 run 編號找到紀錄。
2. 切到紀錄裡的 Git commit。
3. 取回紀錄裡的資料版本與切分清單，確認雜湊值相同。
4. 建立同樣的環境，設定同一個隨機種子與超參數。
5. 重跑，把曲線與最終指標跟原紀錄對照。

結果應該很接近，但不保證逐位相同，原因見進階。若要從中途的檢查點接著訓練，還要另外存優化器與學習率排程器的狀態。

## 程式（補充）

下面用 MLflow 寫完整的 run-a，再讀回來驗證。三段程式接在同一個檔案裡執行。損失數值與圖相同，是教學模擬。

範例會寫檔，所以全部放進 `tempfile.mkdtemp()` 建立的暫存資料夾 `work`。待上傳的檔案、MLflow 資料庫（`mlflow.db`）與附件都在裡面，執行目錄不會多出任何檔案。

第一段準備輸入：種子、損失紀錄、模型權重、切分清單。權重檔是示意用的新模型；真實專案要存訓練程式在第 6 輪保存的那一份。

```python
import hashlib, json, random, tempfile
from pathlib import Path
import numpy as np, torch, mlflow
SEED = 42; random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
work = Path(tempfile.mkdtemp(prefix="tracking-"))   # 之後所有檔案都放在這裡
out = work / "files"; out.mkdir()
history = [(0.68, 0.70), (0.52, 0.55), (0.41, 0.45), (0.33, 0.39),
           (0.27, 0.36), (0.22, 0.35), (0.18, 0.37), (0.14, 0.41)]
model = torch.nn.Sequential(torch.nn.Linear(10, 64), torch.nn.ReLU(),
                            torch.nn.Linear(64, 32), torch.nn.ReLU(), torch.nn.Linear(32, 2))
torch.save(model.state_dict(), out / "best_epoch6.pt")
split = {"train": list(range(800)), "val": list(range(800, 1000))}
(out / "split.json").write_text(json.dumps(split))
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:12]
print("已準備:", sorted(p.name for p in out.iterdir()))
```

輸出如下：

```text
已準備: ['best_epoch6.pt', 'split.json']
```

:::tip[讀碼重點]
- 看 `random.seed`、`np.random.seed`、`torch.manual_seed` 三行：三個函式庫各有自己的亂數，要各設一次。
- 看 `work = Path(tempfile.mkdtemp(...))`：它在系統暫存目錄下新建一個隨機名稱的資料夾，後面的檔案與資料庫都以它為基準。
- `sha(path)` 把檔案內容算成指紋，之後用它確認切分清單沒被改過。
- 這段只準備檔案，還沒寫任何紀錄；`mlflow` 在這裡只是先匯入。
:::

第二段寫入紀錄。重點是三件事：輸入記成標籤與參數、逐輪數值記成帶 `step` 的指標、權重與切分清單記成附件。

標籤分兩組。`sim_` 開頭是教學的假設值（commit、資料版本、訓練環境），不是這次執行的環境。`replay_` 開頭是這次重播實際用的 Python 與 PyTorch 版本。真實專案要寫入實際的 commit 與資料版本。

```python
import platform
mlflow.set_tracking_uri(f"sqlite:///{(work / 'mlflow.db').as_posix()}")   # 資料庫放在 work 內
exp_id = mlflow.create_experiment("tracking-demo", artifact_location=(work / "artifacts").as_uri())
with mlflow.start_run(run_name="run-a", experiment_id=exp_id) as run:
    mlflow.set_tags({"sim_git_commit": "3f2a9c1", "sim_data": "v3",
                     "sim_training_env": "py3.11 torch2.4 cuda12.1",
                     "replay_python": platform.python_version(), "replay_torch": torch.__version__})
    mlflow.log_params({"lr": 0.001, "batch_size": 32, "seed": SEED, "optimizer": "Adam",
                       "loss": "cross_entropy", "hidden": "64-32", "split_sha": sha(out / "split.json")})
    for epoch, (tr, va) in enumerate(history, start=1):
        mlflow.log_metric("train_loss", tr, step=epoch)
        mlflow.log_metric("val_loss", va, step=epoch)
    mlflow.log_metric("best_val_loss", min(va for _, va in history))
    mlflow.log_artifacts(str(out)); run_id = run.info.run_id
print("已寫入:", run.info.run_name, len(history), "輪")
```

輸出如下。MLflow 3.17.2 第一次建立資料庫時，還會把兩行 INFO 訊息印到標準錯誤，不在這裡。

```text
已寫入: run-a 8 輪
```

:::tip[讀碼重點]
- 看 `set_tracking_uri` 與 `artifact_location` 兩行：沒設的話，MLflow 會把資料庫和附件寫在執行目錄下。這兩行把它們都導向 `work`。
- 看 `log_metric(..., step=epoch)`：省略 `step` 時，每筆都記成 step=0，多筆值不能按 epoch 對齊。每筆仍有時間戳，但要以 epoch 為橫軸，必須寫 `step=epoch`。
- `log_params` 的值會被當成字串存下來，讀回來的 `p["lr"]` 是 `'0.001'`，不是數字。
- `log_metric("best_val_loss", ...)` 沒帶 `step`，只存一個最終值，適合放摘要。
- `log_artifacts` 傳的是資料夾，整個資料夾的檔案都會變成附件。
:::

第三段用 run 編號讀回來驗證。`get_run` 的指標只是摘要，要取整條曲線得用 `get_metric_history`。`list_artifacts` 只證明檔名存在；要確認內容沒變，得下載附件再比對指紋。

```python
client = mlflow.MlflowClient()
r = client.get_run(run_id); p = r.data.params
(work / "back").mkdir()
back = client.download_artifacts(run_id, "split.json", dst_path=str(work / "back"))
print("run_id 長度:", len(run_id))
print("best_val_loss:", r.data.metrics["best_val_loss"])
print("val_loss 歷史:", [(m.step, m.value) for m in client.get_metric_history(run_id, "val_loss")])
print("lr/seed:", p["lr"], p["seed"])
print("附件內容相同:", sha(back) == p["split_sha"])
print("標籤:", sorted(k for k in r.data.tags if not k.startswith("mlflow.")))
print("附件:", sorted(a.path for a in client.list_artifacts(run_id)))
```

輸出如下。`run_id` 每次不同，所以只印長度。

```text
run_id 長度: 32
best_val_loss: 0.35
val_loss 歷史: [(1, 0.7), (2, 0.55), (3, 0.45), (4, 0.39), (5, 0.36), (6, 0.35), (7, 0.37), (8, 0.41)]
lr/seed: 0.001 42
附件內容相同: True
標籤: ['replay_python', 'replay_torch', 'sim_data', 'sim_git_commit', 'sim_training_env']
附件: ['best_epoch6.pt', 'split.json']
```

之後用同一個 `run_id`，就能取回參數、曲線與權重檔。

`work` 在程式結束後仍會留著。要清理，等程式結束後自己刪除那個資料夾；範例不在程式內刪，因為執行中資料庫檔被占用，Windows 上刪不掉。要長期保留紀錄，改用固定的資料夾，不用 `mkdtemp`。

:::tip[讀碼重點]
- 看 `get_metric_history(run_id, "val_loss")`：回傳 8 筆，每筆有 `step` 與 `value`。`r.data.metrics` 只有最後一筆摘要，畫曲線要用歷史。
- 看 `download_artifacts` 與 `sha(back) == p["split_sha"]`：下載回來的檔案內容，和訓練前記下的指紋相同，才算驗證附件沒被換掉。
- `list_artifacts` 只列檔名，不會告訴你內容對不對。
:::

TensorBoard 用 `SummaryWriter` 寫入，WandB 用 `wandb.log`。寫法不同，做的是同一件事：存下輸入與逐輪數值。

## 怎麼用、怎麼判讀

### 比較兩個 run（補充）

run-b 與 run-a 只差一個設定：學習率從 0.001 改成 0.01。資料版本、程式版本、隨機種子都相同，所以差異主要來自學習率。每個設定只跑 1 次，要確認結論，得換幾個種子重複。

![run-a：驗證線的最低點在第 6 輪（最佳輪次，不是停止時間），之後回升；兩張圖縱軸範圍相同，可以直接比高低。](figure:l23303-tracking-run-a)

![run-b：下降較快，但驗證線的最低點在第 3 輪（最佳輪次），之後快速上升，與訓練線的差距越拉越大。](figure:l23303-tracking-run-b)

| 項目 | run-a | run-b |
|---|---|---|
| 學習率 | 0.001 | 0.01 |
| 最佳驗證損失（輪次） | 0.35（第 6 輪） | 0.40（第 3 輪） |
| 第 8 輪訓練損失 | 0.14 | 0.04 |
| 第 8 輪驗證損失 | 0.41 | 0.70 |
| 資料、程式、種子 | 相同 | 相同 |

用驗證損失比，run-a 較好（0.35 < 0.40）。run-b 的訓練損失降得更快，驗證損失卻越來越差，是過擬合更嚴重的形狀。判讀兩條線的方法見 [[learning-curve]]。

比較前先確認兩件事：

- 兩個 run 用同一個驗證集、同一個指標，損失的算法也相同。
- 每個結果都連回 run 編號，之後能點回完整設定。

想知道差異「為什麼」，才需要只改一項，其餘（資料、程式、種子）都相同。若同時改了好幾項，仍可以選出較好的 run，但不能把差異歸給單一設定。

要在多個候選模型間取捨，見 [[model-comparison]]。

### 讀資源紀錄

資源紀錄回答「慢在哪裡」。下表是每項要看的數字與常見意思。

:::supplement[來源：NVIDIA 官方文件 nvidia-smi「Utilization」；PyTorch 官方教學「Performance Tuning Guide」]
| 資源 | 單位 | 偏高時先檢查 | 偏低時先檢查 |
|---|---|---|---|
| GPU 使用率 | % | 運算量大；也可能忙在記憶體搬移，要分開看 | GPU 在等資料或等同步 |
| GPU 記憶體 | GB | 是否接近上限，批次大小受限，可能記憶體不足 | 還有空間，可試著放大批次 |
| CPU 使用率 | % | 資料載入或前處理吃滿 CPU | 平均低仍可能有單一核心吃滿，要看每個核心與 I/O 等待 |
| 系統記憶體 | GB | 是否一直上升：資料全載入或有洩漏 | 要搭配工作量與尖峰一起判斷 |
| 每輪耗時 | 秒 | 要和上面幾項一起找原因 | 這一項不是主要問題，仍要看其他項 |

這張表是「先查哪裡」，不是結論。

例如 run-a 的紀錄是 GPU 使用率平均 35%、CPU 接近 100%、每輪 12 秒（教學模擬）。這個組合最先該懷疑資料讀取與前處理太慢，GPU 在等資料。確認時再看每個核心的使用率。

:::caution[注意]
使用率只說明取樣時間內「有沒有在工作」，不代表算力被有效利用。平均值也會蓋住瞬間的尖峰，記憶體不足常發生在尖峰。要搭配每輪耗時、記憶體最大值與取樣間隔一起判斷。
:::
:::

### 工具的定位

三個工具都能讀出損失曲線與指標。差別在於它們的主要定位。

| 工具 | 定位 | 適合 |
|---|---|---|
| TensorBoard | 用曲線呈現訓練損失與指標 | 觀察訓練趨勢 |
| MLflow | 開源平台，含實驗追蹤與模型版本管理 | 管理實驗記錄、訓練與模型版本 |
| WandB | 記錄並呈現損失與指標 | 觀察訓練趨勢 |

:::supplement[來源：TensorBoard 官方教學「Get started with TensorBoard」；MLflow 官方文件「MLflow Tracking」「ML Model Registry」；Weights & Biases 官方頁面「Experiment Tracking」]
TensorBoard 側重即時視覺化；MLflow 可自行架設，並把 run 與模型版本串起來；WandB 提供多次實驗的模型、指標與超參數對照。

選哪個要看用途，不看名氣。工具不同，要記的輸入與輸出都一樣。
:::

### 和模型版本管理、線上監控的分工

實驗追蹤記下訓練階段的設定與結果。科目 1 指引也介紹模型版本管理，以及上線後的效能與漂移監控，可按產生紀錄的階段區分。

| 階段 | 管什麼 | 例子 |
|---|---|---|
| 實驗追蹤（離線） | 每次訓練的輸入與結果 | 學習率曲線、超參數、損失曲線 |
| Model Registry（模型登錄）（補充） | 哪個模型版本通過驗證、可以上線，現在部署在哪 | 版本 3 標為「可上線」 |
| 線上持續監控 | 上線後的服務與資料狀態 | API 延遲、特徵分佈變化、預測分佈 |

:::supplement[來源：MLflow 官方文件「ML Model Registry」]
Model Registry 的名稱與用法參考 [MLflow 官方文件的 Model Registry 章節](https://mlflow.org/docs/latest/ml/model-registry/)。MLflow 同時有追蹤與登錄兩個元件，所以看到 MLflow 不能直接當成登錄。

判斷一項指標屬於哪邊，問兩件事：它在訓練時產生，還是上線後才產生；它要即時警示，還是事後分析就夠。

:::

### 換個場景（補充）

主例子是信用卡盜刷偵測。換到其他領域，「輸入要多記什麼」與「比較 run 時盯什麼」會跟著變。

| 場景 | 輸入要多記什麼 | 比較 run 時盯什麼 |
|---|---|---|
| 醫療影像輔助診斷 | 影像來源院所、標註者與標註版本；切分清單依病人分，同一位病人的影像不能同時出現在訓練與驗證 | 漏診代價高，除了損失，還要看召回率。需要稽核時，要能從上線的模型查回當初的資料與標註版本 |
| 製造瑕疵檢測 | 產線、相機與光源設定、資料增強的參數 | 瑕疵樣本少，驗證集要固定且含足夠的瑕疵樣本。資料增強與學習率不要同時改，否則無法歸因 |
| 推薦系統 | 訓練資料的時間範圍；切分依時間，用較早的資料訓練、較晚的資料驗證 | 損失之外，要記排序指標（見 [[ndcg]]）。資料常更新，資料版本沒隨 run 記下來，過幾週就無法重做 |

三個場景要記的欄位不同，原則相同：輸入加輸出，每筆結果連回 run 編號。

## 常見誤解

- 「只存最後的模型就夠了。」不夠。還要保留資料版本與超參數，才能回溯訓練設定。
- 重做實驗還需要程式版本與種子等紀錄。（補充）
- 「同一份程式跑兩次結果會完全一樣。」不保證。GPU 運算與套件版本都可能造成微小差異，只能期待接近。（補充）
- 「挑 run 用測試資料最準。」不對。用測試資料挑，測試成績就不再是獨立的評估。選 run 用驗證集。
- 「使用率 100% 代表跑得最有效率。」不一定。使用率只表示忙不忙，不表示有沒有在做有用的運算。（補充）
- 「MLflow 就是模型登錄。」不一定。它的追蹤與登錄是兩個元件，要看這次用的是哪一個。（補充）
- 「實驗追蹤包含線上監控。」不對。延遲與資料漂移（Data Drift）是上線後才有的，屬於線上持續監控。

## 進階（補充）

### 為什麼重現只能「接近」

即使固定種子，結果仍可能微小不同。GPU 上有些運算的執行順序不固定，浮點數加法的順序不同，結果就有微小差異。不同的函式庫版本、CUDA 版本也會改變運算。

[PyTorch 官方文件的 Reproducibility 章節](https://docs.pytorch.org/docs/stable/notes/randomness.html)說明：不同版本與不同平台之間，不保證完全重現。

它也提供要求確定性演算法的設定，代價是速度可能變慢。實務上把容許的差異範圍寫進驗收，不要求逐位相同。

### 使用率的定義

[NVIDIA 的 nvidia-smi 文件](https://docs.nvidia.com/deploy/nvidia-smi/index.html)把 GPU 使用率定義為：取樣期間內，GPU 上至少有一個 kernel（在 GPU 上執行的一段運算程式）在執行的時間比例。

所以 35% 的意思是 35% 的時間有東西在跑，不是用掉 35% 的算力。這個 kernel 不是 CPU 或 CUDA 的運算核心。這是單看使用率會誤判的原因。

## 小結

- 實驗追蹤記下資料版本、超參數，以及曲線、指標、權重與資源。
- 輸入還要記程式、環境與種子。（補充）
- 記錄的目的是可重現、可比較、可回溯。
- 每個 run 有唯一編號。（補充）
- 比較兩個 run，先確認用同一個驗證集與指標；要歸因於某一項設定，才需要只改一項，並用多個種子重複。（補充）
- 資源紀錄用來觀察效能瓶頸。
- 使用率不等於效率，要連同耗時與尖峰一起判斷。（補充）
- TensorBoard、MLflow、WandB 都能記錄訓練曲線與指標；延遲與資料漂移則屬於上線後的監控。
- Model Registry 的版本登錄職責需要另外區分。（補充）

### 參考來源

- 科目 1 學習指引 5-19、5-20：資料版本、MLflow、模型版本與線上效能／漂移監控。（支持：直覺、步驟 1、工具的定位、和模型版本管理、線上監控的分工、常見誤解、小結）
- 科目 3 學習指引 5-17～5-20：驗證與測試分工、早停、曲線與超參數／結構／權重紀錄、資源追蹤。（支持：為什麼需要、步驟 1、步驟 2、步驟 3、讀資源紀錄、工具的定位）
- [MLflow 官方文件「MLflow Tracking」](https://mlflow.org/docs/latest/ml/tracking/) 的 Concepts、Tracking Runs 章節與 [Python mlflow API](https://mlflow.org/docs/latest/api_reference/python_api/mlflow.html)、[MlflowClient API](https://mlflow.org/docs/latest/api_reference/python_api/mlflow.client.html)。（支持：直覺、步驟 1～4、程式、比較兩個 run、工具的定位、換個場景、常見誤解、小結）
- [PyTorch 官方文件「Reproducibility」](https://docs.pytorch.org/docs/stable/notes/randomness.html) 的 Controlling sources of randomness、Avoiding nondeterministic algorithms 章節與 [Saving And Loading A General Checkpoint 教學](https://docs.pytorch.org/tutorials/recipes/recipes/saving_and_loading_a_general_checkpoint.html)。（支持：步驟 1、步驟 4、程式、比較兩個 run、為什麼重現只能「接近」、常見誤解、小結）
- [NVIDIA 官方文件 nvidia-smi 的 Utilization 章節](https://docs.nvidia.com/deploy/nvidia-smi/index.html) 與 [PyTorch 官方教學「Performance Tuning Guide」](https://docs.pytorch.org/tutorials/recipes/recipes/tuning_guide.html)。（支持：讀資源紀錄、使用率的定義、常見誤解、小結）
- [TensorBoard 官方教學「Get started with TensorBoard」](https://www.tensorflow.org/tensorboard/get_started)、[Weights & Biases 官方頁面「Experiment Tracking」](https://wandb.ai/site/experiment-tracking/)、[MLflow 官方文件「ML Model Registry」](https://mlflow.org/docs/latest/ml/model-registry/)。（支持：工具的定位、和模型版本管理、線上監控的分工）
- [scikit-learn 使用者指南 3.1「Cross-validation」](https://scikit-learn.org/stable/modules/cross_validation.html)。（支持：步驟 3 的留出樣本評估、換個場景的群組與時間切分）
- [Fawcett（2006）第 2–7 節](https://www.math.ucdavis.edu/~saito/data/roc/fawcett-roc.pdf)。（支持：步驟 3 的 ROC AUC 解讀）
- [Keras ModelCheckpoint](https://keras.io/api/callbacks/model_checkpoint/) 的 save_best_only 與 [EarlyStopping](https://keras.io/api/callbacks/early_stopping/) 的 restore_best_weights。（支持：步驟 3 的最佳權重儲存與取回）
