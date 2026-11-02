---
id: api-access-security
title: API 驗證與權限管理
kind: technique
codes: [L21302]
aliases: [API Gateway, JWT, OAuth2]
requires: [inference-service-api]
summary: API 存取要分開處理身分驗證、動作授權、傳輸保護、流量限制與稽核紀錄
goals:
  - id: g1
    text: 畫出驗證到授權流程，說明 OAuth2、JWT、Gateway、日誌及限速的用途
  - id: g2
    text: 區分 token、TLS 與最小權限，說明 JWT 簽章不等於內容加密
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: r04 的 token 已驗證有效，但只有 read:report，卻要求呼叫 predict。入口也有每分鐘 60 次限速。哪個處理正確？
    options:
      A: token 有效就讓它執行所有模型操作
      B: 拒絕越權並留紀錄；限速另行處理
      C: 只要沒有超過 60 次就不必檢查權限
      D: 把 token 寫到公開日誌，請其他使用者幫忙判斷
    answer: B
    explain:
      A: 身分或憑證有效不代表允許所有動作，仍需授權。
      B: 驗證、授權與限速各有責任，有效憑證不能跨過權限檢查。
      C: 限速只控制量，不會授予本來沒有的 predict 權限。
      D: 憑證不應公開，日誌應記必要的主體識別與拒絕原因。
  - id: c2
    goal: g2
    type: choice
    prompt: 團隊在簽章 JWT 的 payload 放入客戶身分資料，宣稱有簽章就不能被讀到，也不用 HTTPS。哪項修正最正確？
    options:
      A: 把 token 加長並混入隨機字元，就能讓 payload 的身分資料變得不可讀
      B: 把 token 移到 URL，便能由瀏覽器自動加密
      C: 驗簽成功後，給所有使用者重訓與匯出資料的權限
      D: 簽章主要保護完整性；應減少敏感內容、使用 TLS 並限制權限
    answer: D
    explain:
      A: 長度不能代替加密或妥善的資料最小化。
      B: URL 位置不提供加密，還可能出現在歷史紀錄與日誌中。
      C: 這違反最小權限，驗簽不代表有管理或資料匯出權限。
      D: 簽章 JWT 通常可讀內容，傳輸保密與動作授權必須另外安排。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:5-15, guide-1:5-17]
---

## 為什麼需要

推論服務接到請求時，不能只看輸入能否運算。它還要確認誰在呼叫、能否執行這個動作，以及請求是否超出允許流量。

尤其涉及個資、商業機密或金融資料，錯誤權限可能讓使用者讀到別人的結果，或執行原本只允許管理者進行的重訓。

## 直覺

驗證問「憑證與主體是否可信」，授權問「這個主體能做什麼」。API 閘道（API Gateway）可統一執行入口政策、記錄存取日誌並管理流量。

![依序分辨通道保護、憑證驗證與動作授權，失敗請求不進入模型推論。](figure:l21302-api-access-security-gates)

:::supplement[來源：OWASP「REST Security」的 HTTPS、Access Control、JWT]
TLS 保護傳輸中的通道；它不會自動決定使用者能讀哪些資料。即使入口已驗證，後端仍要按實體或資料歸屬限制存取。
:::

## 定義與公式

### 驗證、授權與入口管理

指引將 OAuth2 與 JWT 列為身分驗證和授權的常見工具，並要求按角色限制操作。Gateway 則負責存取紀錄與流量管理；各工具的安全界線還要分清楚。

:::supplement[來源：RFC 6749 第 1 節；OpenID Connect Core 1.0 第 1 節；OWASP「REST Security」的 JWT；FastAPI JWT 教學]
OAuth2 是委派授權框架，並不是單獨定義登入身分的協定；若要標準化登入身分，常另用 OpenID Connect。JWT 是可承載宣告的 token 格式，不是完整的登入或授權系統。

OAuth2 的存取 token 可以採 JWT，也可以是不透明字串。使用簽章 JWT 時，服務要驗證簽章及相關宣告，不能只把 payload 解碼出來就信任。
:::

### 不同機制的安全界線

| 機制 | 主要用途 | 本身不保證（補充） |
|---|---|---|
| 驗證憑證／JWT 驗簽 | 確認可信來源與宣告完整性 | 內容已加密、所有動作獲准 |
| 授權與最小權限 | 限制角色、動作及資料範圍 | 傳輸保密或流量一定正常 |
| HTTPS／TLS（補充） | 保護傳輸機密性與完整性 | 呼叫者有權重訓或匯出 |
| 限速 | 限制呼叫頻率或配額 | 授予原本沒有的權限 |
| 稽核日誌 | 追查主體、動作、結果 | 自動阻止所有攻擊 |

:::supplement[來源：OWASP「REST Security」的 JWT]
一般簽章 JWT 的 header 與 payload 可被讀取，簽章防的是未被偵測的修改。JWT 也有加密表示法，但不能看到「JWT」就假設內容保密。
:::

## 走一次流程

### 固定請求怎麼通過入口

先驗證呼叫者的存取依據，再依角色授權動作。Gateway 配合記錄存取與控制流量，讓推論與管理操作有各自限制。

:::supplement[來源：OWASP「REST Security」的 HTTPS、Access Control、JWT、Audit logs；教學合成資料 L21302-A]
共用資料 `L21302-A-requests.json` 的 r01 與 m01 都具有有效憑證和 predict 權限。以下固定順序讓錯誤能重現，實際限速可以在不同層分工。

1. 透過 HTTPS 送請求，token 放在約定的授權標頭，避免放入 URL。
2. 入口驗證簽章、可信發行者、目標服務與到期時間；缺少或無效憑證則拒絕。
3. 檢查 predict 權限，以及目標會員／工件是否在允許範圍內。
4. 依身分與端點限制流量，通過內容驗證後才推論。
5. 用 request_id 記錄結果、主體識別與拒絕理由，不保存完整 token。

| 固定請求 | 檢查結果 | 本例處置 |
|---|---|---|
| r01／m01 | 有效憑證及 predict 權限 | 進入內容驗證與推論 |
| r03／m03 | 缺少憑證 | 401，未通過驗證 |
| r04／m04 | 只有 read:report | 403，不允許 predict |
| r06／m06 | 憑證已過期 | 401，重新取得有效憑證 |

本組每領域各有 2 筆 401、1 筆 403。這些是存取失敗，不是模型預測錯誤，重新訓練不會替它們增加權限。
:::

### 最小權限怎麼安排

依角色區分模型操作；只有獲授權的使用者能重訓或調參，不能讓每個使用者自動取得管理權限。

:::supplement[來源：OWASP「REST Security」的 Access Control、JWT]
前台推薦帳號只取得 predict 與必要會員範圍；報表帳號取得 read:report；模型維運帳號才可依核可流程重訓。不要為了減少設定，把三種角色全部給管理權限。

若 token 外洩，TLS 無法阻止持有它的人經由合法通道重放。仍需期限、撤銷或停權、稽核與異常偵測等配套。
:::

## 程式

### 固定授權判斷（補充）

以下使用可信驗證元件已產生的結果，摘出共用請求的 credential 與 scopes。這只測試授權分支，不解析、簽發或驗證 JWT，也不把用戶端宣告視為可信結果。

```python
def decision(verified_credential, scopes):
    if verified_credential != "valid":
        return 401
    return 200 if "predict" in scopes else 403

cases = [
    ("r01", "valid", ["predict"]),
    ("r03", "missing", ["predict"]),
    ("r04", "valid", ["read:report"]),
    ("r06", "expired", ["predict"]),
]
for request_id, credential, scopes in cases:
    print(request_id, decision(credential, scopes))
```
```text
r01 200
r03 401
r04 403
r06 401
```

:::tip[讀碼重點]
先檢查可信的驗證結果，才檢查 scopes。真正系統還要檢查資料歸屬；只會回傳這幾種狀態碼，不代表已完成完整存取安全。
:::

## 怎麼用、怎麼判讀

同一套推論平台常有一般使用者、報表人員與模型管理者。以角色設定不同權限，才能避免把推論、重訓與資料匯出混成同一種存取。

### 換個場景

| 場景 | 存取需求 | 檢查重點 |
|---|---|---|
| 指引：個資、機密與金融應用 | 控制誰能進入系統 | 驗證、授權與存取紀錄 |
| 指引：部分使用者可重訓調參 | 依角色區分操作 | 一般使用者不自動有管理權 |
| 零售推薦（補充） | 行銷帳號查必要會員 | predict 及會員範圍 |
| 製造檢驗（補充） | 廠區設備送檢驗資料 | 設備身分及工廠資料邊界 |
| 客服報表（補充） | 主管讀彙整資訊 | 報表權限不等於完整對話匯出 |

## 常見誤解

- **「有 token 就有所有權限。」** 有效憑證仍需接受動作與資料範圍授權。
- **「JWT 簽章會把 payload 藏起來。」** 簽章主要保護完整性，不能直接視為加密。（補充）
- **「開啟 HTTPS 就完成所有安全。」** TLS 不能代替授權、限速或輸入驗證。（補充）
- **「把完整 token 留在日誌最方便稽核。」** 應記必要識別與結果，避免洩漏可重放的憑證。（補充）

## 進階

### 驗簽之外還要查什麼（補充）

驗證端應使用自身設定的允許演算法與金鑰，檢查 issuer、audience 與 expiration 等宣告。即使簽章有效，簽給別的服務或已過期的 token 也不應放行。

本頁不示範手寫密碼學或真實憑證。完整實作應交給可信元件，另依系統需求測試金鑰輪替、撤銷與每種拒絕分支。

### 參考來源

- 科目 1 學習指引（版本未標示，2026-10-31 本機快照；guide-1:5-15、guide-1:5-17）：支持驗證與角色權限、Gateway 日誌流控、敏感資料與重訓場景。
- [OWASP：REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)，HTTPS、Access Control、JWT、Audit logs：支持流程、安全界線、最小權限與驗簽檢查。
- [FastAPI：OAuth2 與 JWT 教學](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)，About JWT：支持簽章與加密差異、token 期限及流程教學思路；本頁不沿用其登入流程作選型建議。
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)，15.5.2、15.5.4：支持本例 401 與 403 的語意區分。
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749)，第 1 節：支持 OAuth2 的委派授權定位。
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)，第 1 節：支持登入身分層與 OAuth2 的區分。

## 小結

- 驗證與授權分別確認可信身分及允許動作。
- Gateway 可集中日誌與流量管理，角色權限仍要明確。
- token、TLS、限速與日誌解決不同問題，不能互相取代。（補充）
- 簽章 JWT 不等於內容加密，避免放入不必要的敏感資料。（補充）
