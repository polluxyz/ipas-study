---
id: secure-communication
title: 安全通訊與密碼技術分工
kind: technique
codes: [L23401, L21203, L21302]
aliases: [Digital Signature, 對稱加密, 防重放, 非對稱加密]
summary: 安全通訊須結合保密、金鑰建立、身分認證、完整性與防重放
goals:
  - id: g1
    text: 將加密、金鑰交換、認證與防重放配到正確目的，辨認單純雜湊的不足
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 銀行把計數 4 與其 SHA-256 摘要一起傳送，兩者都無認證保護。攻擊者可改兩個欄位，哪種判斷正確？
    options:
      A: 摘要長度固定，因此可直接證明訊息來自銀行
      B: 攻擊者可改成 5 並重算摘要，須另加認證保護
      C: 摘要不可逆轉，因此可保證原始計數不會外洩
      D: 接收端比對相同，因此可直接證明訊息未重送
    answer: B
    explain:
      A: 任何人都能計算公開雜湊，長度固定不能證明來源。
      B: 攻擊者若能同時替換訊息與摘要，單純比對不能辨認偽造。
      C: 原始計數已用明文傳送，雜湊也不會替它加密。
      D: 完全相同的合法訊息也可能被重送，雜湊不檢查新鮮度。
  - id: c2
    goal: g1
    type: choice
    prompt: 甲院的第 1 輪更新已通過 HMAC，接收端又收到相同 nonce 的同一封訊息。要避免更新被聚合兩次，應採取哪個處理？
    options:
      A: 既然 HMAC 仍正確，就將更新再聚合一次
      B: 只把 nonce 換成新值，再把原更新聚合一次
      C: 只檢查內容未變動，不保存接收與處置狀態
      D: 驗證輪次與認證後，依已用 nonce 紀錄拒絕
    answer: D
    explain:
      A: 合法訊息的認證仍可有效，不能因此允許重複執行。
      B: 接收端自行換 nonce 不能證明這是新的授權更新。
      C: 不保存已處理狀態，就無法排除相同更新再次執行。
      D: 認證與重複處理檢查分工，已接收的訊息不能再次聚合。
textbook: v2
author: codex
status: draft
---

## 為什麼需要（補充）

跨院傳回模型更新時，可能被偷看、竄改、冒名或重送。這四種問題不同，不能只說「已加密」就視為完成安全通訊。

本頁全篇為指引外補充，承接指引雜湊與加密的背景。先沿用 API 驗證與權限管理的分工，再補上訊息層的完整性與新鮮度。

## 直覺（補充）

保密問「誰能讀」，認證問「能否信任對方與訊息」，防重放則問「這是不是已處理過的舊訊息」。金鑰交換讓兩端建立通道祕密，也必須確認交換對象。

![依序看身分、金鑰建立、通道保護與重放檢查，每一步有不同責任。](figure:l23401-secure-communication-flow)

## 定義與公式（補充）

這裡不推導密碼演算法，先把保護目的配到機制。實際通訊通常由成熟協定組合完成，例如 TLS 使用經認證的握手與流量保護。

| 機制 | 主要工作 | 單獨使用的界線 |
|---|---|---|
| 加密 | 隱藏訊息內容 | 一般加密未必含完整性保護 |
| 經認證的金鑰交換 | 建立祕密並綁定對方身分 | 未認證的交換可能遭冒名 |
| MAC／HMAC | 共享金鑰下驗證訊息 | 不隱藏內容，也非公開簽章 |
| 數位簽章 | 私鑰簽署、公鑰驗證 | 不自動加密或排除重送 |
| nonce／序號及狀態 | 辨認訊息新鮮度與重複 | 欄位須受認證，不能任意改 |

對稱加密（Symmetric Encryption）用共享祕密；非對稱加密（Asymmetric Encryption）用公私鑰。簽章也用公私鑰，但不是「私鑰加密」。

HMAC 是帶金鑰的訊息認證碼（Hash-based Message Authentication Code）。未持有共享祕密的攻擊者不能像公開雜湊那樣，直接替改過的訊息產生有效認證碼。

### 金鑰與大量資料怎麼分工（補充）

混合設計常用非對稱機制完成經認證的金鑰建立或簽章，再用對稱金鑰加密大量資料。以 TLS 1.3 憑證模式為例，簽章驗證握手身分，金鑰交換建立共同祕密，再導出對稱流量金鑰。

單向雜湊常參與數位簽章：簽章演算法結合雜湊與簽署私鑰，再以可信公鑰驗證。公開雜湊本身不提供來源認證，也不能把安全簽章簡化成任意摘要的「私鑰加密」。

傳送模型更新或同態密文時，通道保護仍須建立在可信身分上。完整的簽署與保存流程見不可否認性與簽章稽核。

## 走一次流程（補充）

共用例子的更新訊息含 sender、receiver、payload、key_owner、nonce、round。先固定欄位編碼，確保雙方認證相同的位元組。

1. 核對甲方身分與可信公鑰或憑證，以非對稱機制完成經認證的金鑰建立。
2. 使用建立的對稱流量金鑰保護資料傳輸。實務可採認證加密，一起保護機密性與完整性。
3. 接收端驗證訊息，並核對接收者、輪次與允許的發送方。
4. 查 nonce 是否已使用；通過才記錄並處理更新，再次送達則拒絕。

本例 nonce 是應用訊息的唯一代號，不是實作加密演算法所需的 nonce。真正協定須另外滿足所用演算法的唯一性或隨機性要求。

### 單純雜湊為什麼不夠（補充）

若傳送「計數 4＋它的摘要」，攻擊者可換成「計數 5＋重新計算的摘要」。接收端會看到兩者相符，卻沒有證據證明來源可信。

要防這種替換，需以可信通道、MAC 或數位簽章保護。仍須檢查 nonce 與處理狀態，因為舊的合法訊息也能通過完整性檢查。

## 程式（補充）

### 只測訊息認證與重複處理（補充）

以下摘出共用表甲院第 1 輪更新，使用固定教學金鑰。範例綁定 hospital／甲院／通道金鑰角色，核對認證成功、重送及竄改；沒有加密、交換金鑰或實作 TLS。

```python
import json, hmac
m = dict(domain="hospital", sender="A", receiver="coordinator", payload="local-update-A-v0",
         key_owner="A+coordinator:channel", nonce="hospital-A-update-1", round=1)
key, seen = b"teaching-key-not-for-production", set()
allowed = ("hospital", "A", "A+coordinator:channel")
def tag(message):
    raw = json.dumps(message, sort_keys=True, separators=(",", ":")).encode()
    return hmac.digest(key, raw, "sha256")
print("MAC bytes", len(tag(m)))
```
```text
MAC bytes 32
```

HMAC-SHA256 認證碼固定為 32 位元組，與訊息長度無關。接著沿用相同的 `m`、`key` 與 `seen`，測試接收端是否接受訊息。

```python
def receive(message, supplied):
    if (message["domain"], message["sender"], message["key_owner"]) != allowed:
        return "reject: identity context"
    if not hmac.compare_digest(tag(message), supplied):
        return "reject: authentication"
    token = (message["sender"], message["receiver"], message["round"], message["nonce"])
    if message["receiver"] != "coordinator" or message["round"] != 1 or token in seen:
        return "reject: context or replay"
    seen.add(token)
    return "accept"
mac = tag(m)
print(receive(m, mac))
print(receive(m, mac))
print(receive({**m, "payload": "changed-update"}, mac))
```
```text
accept
reject: context or replay
reject: authentication
```

:::tip[讀碼重點]
nonce、輪次、接收者也納入 HMAC。只在認證成功後寫入 `seen`，避免未認證資料先占用代號；正式服務還要把狀態持久化並原子更新，不能照抄這個記憶體集合當成上線協議。

`allowed` 把唯一教學金鑰綁到指定領域、發送方與金鑰角色；其他組合即使帶有效 MAC 也拒絕。正式服務須由可信設定選取各發送方的金鑰，不能只相信訊息自報的 `key_owner`。
:::

## 怎麼用、怎麼判讀（補充）

看到安全設計先逐項盤點保密、認證、完整性與新鮮度。若目標還包含不可否認性，須再評估簽章及證據保存，因為共享 MAC 金鑰的雙方都能產生認證碼。

### 換個場景（補充）

指引未替「安全通訊技術組合」列專屬場景；下列是接續指引雜湊與加密背景的自編應用。

| 場景 | 風險 | 檢查重點 |
|---|---|---|
| 跨院更新 | 舊更新再被聚合 | 身分、輪次與訊息代號 |
| 銀行風控 | 冒名提交風險計數 | 可信金鑰與完整性 |
| 工廠指令 | 同一指令重複執行 | 處理狀態與重試規則 |
| 電商付款 | 合法請求被重送 | 通道保護及業務冪等性 |

## 常見誤解（補充）

- **雜湊相符就證明發送者身分**：未受保護的訊息與雜湊可被一起替換。
- **金鑰交換自然認得對方**：還要有可信的身分綁定，避免中間人冒名。
- **nonce 存在就能防重放**：須受認證，且接收端確實檢查並記錄。
- **TLS 會排除所有業務重複請求**：應用仍要管理重試與重複處理。

## 進階

### 訊息與通道的邊界（補充）

通道可能在閘道終止，之後轉送到其他服務。需畫清每一段誰解密、誰驗證及誰可讀內容；經通道認證不會自動讓每個後端都有完整稽核證據。

### 參考來源

- [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)，第 2、4、5、8 節：支持 TLS 1.3 的認證、通道保護及重放界線；此處引用協定原理，不作最新部署版本建議。
- [NIST FIPS 186-5：Digital Signature Standard](https://csrc.nist.gov/pubs/fips/186-5/final)：支持公私鑰簽章的分工，以及來源認證與內容完整性的界線。
- [RFC 2104：HMAC](https://www.rfc-editor.org/rfc/rfc2104)，第 1–3 節：支持帶金鑰認證與共享祕密的分工。
- [Python 3.12 hmac](https://docs.python.org/3.12/library/hmac.html)：支持程式的 `digest` 與 `compare_digest`。
- [MDN：TLS 教學](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Transport_Layer_Security)：教學參考，支持保密、完整性與認證的分段說法。
- [Cryptography：Ed25519 簽章教學](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ed25519/)：支持簽署與公鑰驗證的分工，不在本頁安裝或執行。

## 小結（補充）

- 加密、金鑰建立、認證與防重放各有責任。
- 公開雜湊不能單獨對抗訊息與摘要一起被替換。
- nonce 須受認證，接收端也須保存已處理狀態。
- HMAC 核算示例不等於完成安全通訊部署。
