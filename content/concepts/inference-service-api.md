---
id: inference-service-api
title: 推論服務與 API 介接
kind: technique
codes: [L21302]
aliases: [REST API, Webhook, gRPC, 模型服務化]
requires: [data-pipeline-integration]
summary: 推論服務把模型包成有輸入輸出契約的介面，讓其他系統能可靠呼叫
goals:
  - id: g1
    text: 依互動方式選 REST、gRPC 或 Webhook，並指出容錯、快取與負載管理位置
  - id: g2
    text: 為影像上傳選 POST 與合適的請求本文格式，說明 GET query 的限制
  - id: g3
    text: 說明模型封裝、版本、驗證限速與推論日誌如何接成完整服務
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 工廠每次檢驗工作約 30 秒，前端不想一直輪詢；工作完成後才需通知 MES。哪個安排最合適？
    options:
      A: 把 Webhook 當成永久雙向連線傳遞每個像素
      B: 只換成 gRPC 名稱，取消所有逾時處理
      C: 每 1 毫秒呼叫查詢介面，直到拿到結果
      D: 先提交工作並取得 ID，完成後用 Webhook 發送事件通知
    answer: D
    explain:
      A: Webhook 是事件觸發的回呼請求，並非永久雙向通道。
      B: gRPC 仍有網路與逾時問題，協定名稱不會消除故障。
      C: 高頻輪詢浪費請求，不符合希望完成後才通知的互動需求。
      D: 提交與完成通知分開，符合較長工作完成後回報的模式。
  - id: c2
    goal: g2
    type: choice
    prompt: 檢驗端要送一張 3 MB 影像並附工件 ID，API 契約接受檔案加欄位。哪個請求設計最適當？
    options:
      A: 使用 HTTPS GET，將影像、工件 ID 與 token 放入 query，靠日誌保留請求內容
      B: 用 HTTPS POST 與 multipart/form-data，在本文傳檔案及工件欄位
      C: 只改用 POST，但把影像與 token 仍放在 URL
      D: 宣告 application/json，本文卻直接放未編碼的影像位元組
    answer: B
    explain:
      A: 大型影像不適合放 URL，且 token 可能暴露於日誌等位置。
      B: multipart 能分開承載檔案與欄位，仍需遵守服務端大小及內容驗證。
      C: POST 方法不會自動把 URL 資料移到本文，也不會避免 URL 洩漏。
      D: Content-Type 必須符合實際編碼，原始影像不是有效 JSON。
  - id: c3
    goal: g3
    type: choice
    prompt: r01 回傳成功，但系統只記 API 版本 v1，沒有記 rec-v2。團隊下週換模型後要查同一輸入為何得不同結果，該補什麼？
    options:
      A: 記錄關聯 ID、模型及特徵版本、狀態與耗時
      B: 每次回應只保留 HTTP 200，不記任何版本
      C: 將 API 版本視為模型權重版本，兩者永遠相同
      D: 把使用者完整 token 與影像全部寫進公開日誌
    answer: A
    explain:
      A: 實際模型及特徵版本配合關聯 ID，才能追查不同結果的來源。
      B: 成功狀態不足以找出使用哪個模型或前處理規則。
      C: API 契約與模型權重可獨立更新，必須分別記錄。
      D: 完整憑證與敏感輸入不應任意寫入日誌，且不會取代版本追蹤。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-15, guide-1:5-17]
---

## 為什麼需要

模型權重放在硬碟裡，網站、App 或製造系統仍不知道怎麼呼叫。它們需要固定的輸入、輸出、錯誤處理與版本約定。

推論服務把前處理與模型計算包成應用程式介面（API）。呼叫端送出約定格式，服務回傳結果，讓模型能接入應用與企業流程。

## 直覺

先分清楚「提出請求」「實際運算」「回傳與紀錄」三部分。安全檢查與流量管理放在入口，模型則透過明確版本被載入與呼叫。

![由入口看到 HTTP 回應，留意模型版本與推論日誌都在服務流程內。](figure:l21302-inference-service-api-path)

Flask 與 FastAPI 可用來撰寫 API 包裝層。TensorFlow Serving 則是服務模型的專用工具；三者都能參與服務化，但職責與適用模型不完全一樣。

## 定義與公式

### 三種互動方式

| 方式 | 基本互動 | 適合的本例需求 |
|---|---|---|
| REST API | 對資源發出 HTTP 請求並取得回應 | App 取得一次推薦 |
| gRPC | 呼叫明確定義的遠端方法 | 內部服務交換推論資料 |
| Webhook | 事件發生後，向接收端發出通知 | 檢驗完成後通知 MES |

![REST 常用一問一答，gRPC 可提供串流，Webhook 則在事件完成後另送通知。](figure:l21302-inference-service-api-modes)

指引將 gRPC、Webhooks 列為效能與雙向通訊需求下的介接選項。實際選擇時，還要分辨同步回應、持續串流與完成通知。

:::supplement[來源：gRPC「Core concepts, architecture and lifecycle」；GitHub Docs「About webhooks」]
gRPC 可一問一答，也可用雙向串流；不是每次 gRPC 都一定較快。Webhook 通常用獨立 HTTP 請求推送事件，本身不是雙向串流協定。
:::

### 封裝與管理

模型服務化要安排版本管理、使用者驗證、速率限制，以及推論結果的日誌與監控。容錯、快取與負載管理也要放進整體介接設計。

:::supplement[來源：FastAPI「Request Body」；TensorFlow「Serving Models」「Serving Configuration」；Microsoft Learn「Microservices architecture style」]
Flask 需自行撰寫輸入檢查；FastAPI 可依宣告的資料結構驗證。專用模型伺服器則提供模型載入及推論介面，仍需另配企業權限和業務流程。

TensorFlow Serving 提供 REST 與 gRPC 介面，也能依設定同時保留多個模型版本。新舊版可在切換時並存，要提供哪些版本需由政策明確指定。

API 版本描述介面契約，模型版本描述實際權重。API 維持 v1 時，仍可能從 rec-v2 更新為 rec-v3，因此回應與日誌應記實際模型版。
:::

## 走一次流程

### 固定請求走到回應

先讓應用送出請求，再由服務呼叫模型並回應；同時安排入口管理、容錯、快取及負載分配，維持介接穩定。

:::supplement[來源：Microsoft Learn「Microservices architecture style」；教學合成資料 L21302-A]
資料檔：`content/examples/L21302-A-requests.json`（教學合成資料）。

r01 以 POST 呼叫推薦端點，本文包含實體 ID 與特徵。入口核可後，服務依 f1 準備輸入，再呼叫 rec-v2。

成功回應包含 request_id、model_version 與 score。m01 則走 `/v1/inspect`，實際模型為 inspect-v3；前處理規則要與該模型配套。
:::

| 配置位置 | 責任 | 限制（補充） |
|---|---|---|
| Gateway／入口 | 驗證、授權、限速與存取日誌 | 服務端仍要限制資料權限 |
| 負載平衡層 | 把流量送到健康的推論副本 | 不會修好模型錯誤 |
| 特徵／結果快取 | 重用允許重用的資料或結果 | 鍵需考慮實體、版本及權限 |
| 呼叫端／介接層 | 逾時、有限重試、替代處理 | 寫入作業需避免重複執行 |
| 推論服務 | 輸入驗證、前處理、模型與日誌 | 不任意記錄憑證或敏感原文 |

:::supplement[來源：Microsoft Learn「Microservices architecture style」；OWASP「REST Security」]
表格是這些機制的一種配置方式。快取結果若跨使用者共用，可能洩漏資料；版本改了卻沿用舊快取，也可能回傳舊預測。
:::

### 影像要放在哪裡（補充）

製造端若同時傳影像與工件 ID，可約定 POST 與 multipart/form-data。每個部分各自承載檔案或文字欄位；boundary 由用戶端函式庫產生，以下省略檔案實際位元組。

```http
POST /v1/inspect-image HTTP/1.1
Host: api.example.invalid
Content-Type: multipart/form-data; boundary=demo

--demo
Content-Disposition: form-data; name="part_id"

part-1
--demo
Content-Disposition: form-data; name="image"; filename="part.png"
Content-Type: image/png

（影像位元組）
--demo--
```

若契約只收單一二進位本文，也能用 `POST` 配 `application/octet-stream`，再依約定傳工件 ID。不是看到影像就一定只能用 multipart。

```http
POST /v1/inspect-image HTTP/1.1
Host: api.example.invalid
Content-Type: application/octet-stream
Part-Id: part-1

（依契約約定格式的影像位元組）
```

GET query 可能受瀏覽器、代理或伺服器 URL 長度限制，也可能留在存取日誌中，不適合放大型影像或憑證。POST 本文同樣有大小限制，還需要 HTTPS、影像內容及資源用量檢查。

## 程式

### 本機驗證與回應替身（補充）

以下只模擬 JSON 契約，沒有啟動 HTTP 服務。`credential` 是「上游已驗證的結果」替身，不能直接相信用戶端傳這個欄位；真正驗證見 API 驗證與權限管理。

先用 r08 的必要欄位檢查媒體型別拒絕分支：憑證與權限通過，仍因 text/plain 而回傳 415。

```python
def serve(r):
    if r["credential"] != "valid":
        return 401, {"error": "unauthenticated"}
    if "predict" not in r["scopes"]:
        return 403, {"error": "forbidden"}
    if r["content_type"] != "application/json":
        return 415, {"error": "unsupported_media"}
    if not {"entity_id", "feature"} <= r["body"].keys():
        return 422, {"error": "invalid_body"}
    return 200, {"request_id": r["request_id"],
                 "model_version": r["model_version"],
                 "score": r["body"]["feature"]}
r08 = {"credential": "valid", "scopes": ["predict"],
       "content_type": "text/plain"}
status, payload = serve(r08)
print(status, payload["error"])
```
```text
415 unsupported_media
```

下面摘出 r01 與 r05 的最小欄位，第二筆故意缺少特徵。固定分數直接充當模型輸出，只是驗證流程的測試替身，沒有訓練模型。

```python
import json
base = {"credential": "valid", "scopes": ["predict"],
        "content_type": "application/json", "model_version": "rec-v2"}
cases = [
    {**base, "request_id": "r01", "body": {"entity_id": "member-1", "feature": 0.9}},
    {**base, "request_id": "r05", "body": {"entity_id": "member-5"}},
]
for r in cases:
    status, payload = serve(r)
    print(status, json.dumps(payload, sort_keys=True))
```
```text
200 {"model_version": "rec-v2", "request_id": "r01", "score": 0.9}
422 {"error": "invalid_body"}
```

:::tip[讀碼重點]
同頁兩段依序執行；第二段沿用 `serve`。這個最小函式只檢查必填鍵，正式契約還須檢查型別、值域、大小與模型是否存在，不能直接拿它作為安全服務。
:::

## 怎麼用、怎麼判讀

網站、App 與 BI 工具需要即時取得結果時，先約定服務介面。再依效能與互動需求選擇介接方式，不必讓前端知道模型內部的每個計算細節。

### 換個場景

| 場景 | 介接需求 | 判讀重點 |
|---|---|---|
| 指引：網站、App、BI 工具 | 即時取得模型結果 | 服務介面與穩定性 |
| 指引：效能與雙向通訊需求 | 選擇適合的互動方式 | gRPC、Webhook 的角色要分清 |
| 零售推薦（補充） | App 送 JSON 取得推薦 | 快取是否過期、模型版是否正確 |
| 製造檢驗（補充） | 上傳影像，完成後通知 | 本文格式、工作 ID 與通知重送 |
| 客服語音（補充） | 雙向持續交換訊息 | 串流與逾時條件 |

## 常見誤解

- **「服務封裝只要回傳一個分數。」** 還需要輸入契約、版本、安全與紀錄。
- **「Webhook 等於雙向串流。」** 它是事件發生後另送的通知請求。（補充）
- **「POST 就會加密。」** 傳輸保密依靠 HTTPS／TLS，HTTP 方法不提供加密。（補充）
- **「HTTP 200 表示部門已完成作業。」** 模型回應與 CRM、MES 的後續執行是不同狀態。（補充）

## 進階

### 通知也需要去重（補充）

Webhook 接收端應驗證來源，依事件 ID 處理重送，並在可接受時間內回覆。這是異步通知可靠性的延伸，不表示第一次通知一定會到達。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-15、guide-1:5-17）：支持介接、容錯快取負載、服務化工具與紀錄。
- [gRPC：Core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)，Service definition、Deadlines：支持三種互動比較及逾時限制。
- [GitHub Docs：About webhooks](https://docs.github.com/en/webhooks/about-webhooks)，Choosing webhooks or the REST API：支持事件通知的定位與選擇思路。
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)，9.3.1 GET、9.3.3 POST、17.9：支持 HTTP 方法與 URL 敏感資訊限制。
- [RFC 6648](https://www.rfc-editor.org/rfc/rfc6648.html#section-3)，第 3 節：支持示範中的新自訂標頭採 Part-Id，不使用 X- 前綴。
- [MDN：POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/POST)，Example、multipart/form-data：支持影像請求格式的教學範例。
- [TensorFlow：Serving Models](https://www.tensorflow.org/tfx/guide/serving)：支持專用模型伺服器、介面與版本定位。
- [TensorFlow：Serving Configuration](https://www.tensorflow.org/tfx/serving/serving_config)，Serving Multiple Versions of a Model：支持多版本並存與版本政策的補充。
- [FastAPI：Request Body](https://fastapi.tiangolo.com/tutorial/body/)，Results：支持以宣告的資料結構進行輸入驗證。
- [Microsoft Learn：Microservices architecture style](https://learn.microsoft.com/en-us/azure/architecture/microservices/)，API gateway、Challenges：支持配置位置與呼叫端容錯的補充。
- [OWASP：REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)，Input validation、Audit logs：支持正式服務的輸入檢查及日誌限制。

## 小結

- 推論服務要把模型計算接成可以被呼叫的介面。
- 依互動需求選 REST、gRPC 或 Webhook。
- 模型版、驗證限速、快取與推論日誌都要安排位置。
- 影像用 POST 配合約定的本文格式，傳輸保密仍要靠 TLS。（補充）
