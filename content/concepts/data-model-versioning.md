---
id: data-model-versioning
title: 資料、程式與模型版本追溯
kind: technique
codes: [L21302]
aliases: [DVC, Data Versioning]
requires: [experiment-tracking]
summary: 版本追溯把資料、程式、模型與訓練紀錄連起來，找得回每份產物的來源
goals:
  - id: g1
    text: 區分 MLflow 與 DVC 的追蹤用途，建立資料、程式與模型的來源紀錄
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 三個人都把資料稱為 retail-d1，但其中一人的資料少了 10 列。若要確認哪份資料曾用來訓練 rec-v3，哪項紀錄最有用？
    options:
      A: 權重檔名包含 best，代表一定用了正確資料
      B: 模型驗證準確率 95%，所以資料必定相同
      C: 來源實驗綁定資料指紋、切分及取回位置
      D: 三個人的資料夾名稱一樣，不必再確認
    answer: C
    explain:
      A: 檔名是可修改的標記，不能證明資料來源。
      B: 不同資料也可能得到相同分數，指標不能當作資料身分。
      C: 內容指紋與來源連結能辨識版本，取回位置則讓資料可實際重建。
      D: 名稱相同不保證內容相同，尤其已有列數差異。
  - id: c2
    goal: g1
    type: choice
    prompt: 團隊用 MLflow 記下 20 次訓練的參數和指標，現在要管理 50 GB 資料及模型檔的版本。哪個理解最合適？
    options:
      A: DVC 管大檔版本，連回 MLflow 實驗
      B: 有 MLflow 的準確率，就不需要保存任何資料或權重
      C: DVC 專門量測線上延遲，不能追蹤模型檔
      D: Git 有程式 commit，就能自動重建未被保存的資料
    answer: A
    explain:
      A: 實驗紀錄和大檔版本可分工，再用識別碼串成可追溯的來源鏈。
      B: 指標是結果摘要，不能取代來源資料與模型內容。
      C: DVC 可追蹤資料集與模型版本，並不是線上延遲監控工具。
      D: 程式版本不包含未保存的資料內容，仍須管理資料版本及儲存位置。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-19]
---

## 為什麼需要

只有 `model-final` 檔名，無法回答它用了哪份資料、哪次訓練。指引建議追蹤訓練參數、資料版本與模型成果，讓團隊可以回查與重做。

版本追溯（Lineage）把來源和成果串起來。實驗追蹤記錄「做了什麼、結果如何」，版本管理則讓每份輸入與輸出的身分更明確。

## 直覺

從線上的模型往回走：先找模型成果，再找來源實驗，最後找到資料與設定。不能只保留每一類檔案，卻不知道它們彼此怎麼對應。

![從模型往來源實驗回查，再找到資料與設定；程式、切分與雜湊值是補充的追溯欄位。](figure:l21302-data-model-versioning-lineage)

## 定義與公式

指引把 MLflow 與 DVC 列為模型版本控管工具。下表是本頁的主要分工；工具能力有重疊，不表示只能負責其中一件事。

| 工具或紀錄 | 主要保存內容 | 回答的問題 |
|---|---|---|
| MLflow | 參數、指標與成果；也支援模型版本管理及部署 | 哪次訓練產生結果、如何交付？ |
| DVC | 資料集與模型檔版本 | 當時用的是哪份內容？ |
| Git（補充） | 程式及版本描述檔 | 當時執行哪版邏輯？ |

本頁先看 MLflow 的實驗紀錄，登錄版本與發布狀態的細節見模型登錄與版本狀態。

### 內容指紋與可取回性（補充）

內容雜湊值（Content Hash）是由內容算出的指紋，可用來檢查檔案是否一致。它不能取代檔案備份，也不能單獨證明來源可信；仍要保留實際物件、存取權限與追溯紀錄。

DVC 可將資料指標檔交由 Git 管理，檔案內容放在快取或遠端儲存。本組用 SHA-256 示範指紋，不代表 DVC 每一種資料來源都使用這個雜湊算法。

## 走一次流程

用 MLflow 保存訓練設定與成果，搭配 DVC 保存資料及模型版本，再把紀錄連在一起。模型更新時留下舊版來源，才能比較及回查。

### rec-v3 的來源清單（補充）

共用 `L21302-D-releases.json`。零售三版的資料與切分相同，模型與程式描述各有不同指紋，內容皆為教學替身。

1. 查到 rec-v3 的來源實驗 `retail-run-2`。
2. 讀取資料版本 retail-d1、資料雜湊值與程式雜湊值。
3. 核對切分：訓練索引 0～599、驗證 600～799、保留 800～999；種子固定為 21302。
4. 核對模型內容指紋，連回驗證答對 190／200、20／20 測試與離線效能報告。
5. 發布清單 `retail-release-2` 綁定上述紀錄，線上觀測再連回此清單。

先確認資料與切分相同，才能比較 rec-v2 和 rec-v3。重跑訓練還須環境與完整設定；指紋不能還原未保存的檔案。

## 程式（補充）

下面將共用檔 rec-v3 的模型描述與指紋取出，做成可獨立執行的最小例子。它驗證的是教學替身，不是實際權重；不用讀專案檔，也不連線或部署。

JSON 固定鍵序與緊湊序列化，避免空白或鍵序造成差異。第一次核對原內容，第二次故意改一個權重描述，再看指紋是否仍相同。

```python
import hashlib, json
payload = {"kind": "teaching-stub", "weights": [2, 2, 3], "domain": "retail"}
record = {"version": "rec-v3", "run": "retail-run-2",
          "model_sha256": "25649f2873c8694235b66b7f4e814039b0003997557d54b51a5dd3718a526e20"}
def sha(obj):
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()
print("原內容相符:", sha(payload) == record["model_sha256"])
payload["weights"][0] = 99
print("改動後相符:", sha(payload) == record["model_sha256"])
print("來源:", record["version"], record["run"])
```
```text
原內容相符: True
改動後相符: False
來源: rec-v3 retail-run-2
```

:::tip[讀碼重點]
模型名稱與來源實驗未變，內容卻已不同。指紋失配時要調查，不可只改紀錄中的指紋就宣稱驗證成功。
:::

## 怎麼用、怎麼判讀

指引場景是持續更新模型、需要追蹤訓練參數與資料版本的專案。比較時看實驗結果，追查時則沿資料版本與模型成果回走，兩件事需要互相連結。

### 換個場景

| 場景 | 想回答的問題 | 需要的紀錄 |
|---|---|---|
| 指引：模型持續更新 | 每次訓練用了什麼？ | 參數、資料版本、模型成果 |
| 零售推薦（補充） | 哪批商品資料產生此版本？ | 資料指紋與來源實驗 |
| 製造檢驗（補充） | 換相機後為何表現不同？ | 影像版本、特徵規則與程式 |
| 金融風控（補充） | 某次決策來自哪版模型？ | 請求時間、部署版與發布清單 |

## 常見誤解

- **「MLflow 和 DVC 是同一件事。」** 可搭配使用，但實驗結果與資料版本的追查目的不同。
- **「保存指標就能重現。」** 還需要當時的資料與模型成果。
- **「指紋就是備份。」** 指紋能比對內容，不能憑空還原檔案。（補充）
- **「種子相同就保證完全一致。」** 環境、硬體及非決定性運算仍可能影響結果。（補充）

## 進階

### 兩個領域不要混用版本（補充）

inspect-v4 來自 `manufacturing-run-2`，資料為 manufacturing-d1。兩領域雖共用 f1 與種子，資料內容不同，指紋不可混用。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-19）：支持 MLflow、DVC 的用途及參數、資料、成果追蹤。
- [DVC：.dvc Files](https://doc.dvc.org/user-guide/project-structure/dvc-files)，資料描述與雜湊欄位：支持內容指標與檔案分開保存的補充。
- [DVC 官方教學：Get Started](https://doc.dvc.org/start)：提供資料版本取回與團隊協作的教學思路。
- [MLflow：Tracking](https://mlflow.org/docs/latest/ml/tracking/)，Runs、Tracking Runs：支持來源實驗與產物紀錄的分工。
- [Google Cloud：MLOps 自動化架構](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)，Metadata management：支持資料、程式及模型來源鏈的補充。
- [PyTorch：Reproducibility](https://docs.pytorch.org/docs/2.15/notes/randomness.html)：支持環境、硬體與非決定性運算的重現限制。

## 小結

- 版本追溯連起訓練參數、資料版本與模型成果。
- MLflow 的實驗紀錄與 DVC 的大檔版本可互相連結。
- 程式、切分與環境也要留下可核對的來源。（補充）
- 指紋檢查一致性，真正重建仍要取得原內容。（補充）
