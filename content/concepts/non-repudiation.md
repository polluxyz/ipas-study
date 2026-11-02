---
id: non-repudiation
title: 不可否認性與簽章稽核
kind: technique
codes: [L21203, L23401]
aliases: []
requires: [secure-communication]
summary: 數位簽章結合可信金鑰與稽核紀錄，支持事後追查誰簽了哪些內容
goals:
  - id: g1
    text: 區分雜湊、數位簽章與存取紀錄的保證，建立輸入到輸出的簽章證據鏈
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 跨院平台只存模型輸出與 SHA-256，日誌由同一位管理員任意覆寫。三個月後要向第三方說明哪家醫院提交第 1 輪更新，最合理的補強是？
    options:
      A: 只增加摘要長度，仍讓同一管理員任意改寫身分紀錄
      B: 只保存輸出副本，刪除輸入版本與接收者的相關欄位
      C: 簽署完整清單，核對金鑰身分並保護接收與處置紀錄
      D: 將摘要換成共享 HMAC，宣稱接收方無法產生相同證據
    answer: C
    explain:
      A: 更長摘要仍不能綁定提交者，也未處理可覆寫日誌的問題。
      B: 缺少版本與訊息情境會斷開輸入、輸出和提交事件之間的關係。
      C: 簽章、可信身分綁定與受保護紀錄一起支持可追查的提交證據。
      D: 共享金鑰的接收方也能產生 HMAC，不能當成只有發送方能建立的簽章證據。
  - id: c2
    goal: g1
    type: choice
    prompt: 某筆更新驗簽成功，但 signer_key_id 是從訊息內自報取得，未核對院方身分，也不知私鑰是否失陷。現在能下哪項結論？
    options:
      A: 已證明院方授權這次更新，可省略金鑰來源與撤銷檢查
      B: 僅支持該公鑰對內容的驗證，還須查身分綁定與金鑰狀態
      C: 已證明模型輸出醫學正確，可省略資料版本與品質審查
      D: 已證明簽署時間精確可信，可省略時間證據與接收紀錄
    answer: B
    explain:
      A: 公鑰若未可靠連到院方，就不能把驗簽成功直接歸給院方授權。
      B: 數學驗簽是必要證據的一部分，身分與私鑰控制條件仍需確認。
      C: 簽章不判斷模型內容是否正確，更不提供醫學有效性保證。
      D: 簽章本身不會產生可信時間來源，時間仍需要其他證據。
textbook: v2
author: codex
status: draft
---

## 為什麼需要（補充）

三個月前的模型更新出了問題，平台只找到一個雜湊值，卻無法說明誰提交、用了哪版模型。完整性指紋有用，但事後歸責還需要來源與處置證據。

不可否認性（Non-repudiation）指向能向第三方提出的簽署證據。它需要數位簽章（Digital Signature）、可信的身分與金鑰綁定，以及可追查的紀錄共同支持。

本頁全篇為指引外補充，承接雜湊背景，延伸到簽章與稽核證據的分工。

## 直覺（補充）

先把輸入版本、模型版本、輸出摘要與訊息情境組成一份清單，再簽署這份清單。接收端核對簽署者與內容，並保存自己何時收到、接受或拒絕了什麼。

![從輸入版本追到輸出摘要、私鑰簽署、公鑰驗證與接收紀錄，不能只保留最後一個摘要。](figure:l23401-non-repudiation-audit)

簽署私鑰留在發送方，驗證者使用可信公鑰。簽章沒有把內容藏起來，也沒有替內容的真實性背書。

## 定義與公式（補充）

本頁不推導簽章演算法，先分清各種證據能回答什麼問題。一般摘要是內容指紋，簽章把內容連到特定金鑰，日誌則把事件接進處理流程。

| 證據 | 支持的判斷 | 必要前提／限制 |
|---|---|---|
| 雜湊摘要 | 與可信基準比對內容 | 基準須可信；不能單獨證明身分 |
| 數位簽章 | 驗證被簽內容及簽署金鑰 | 公鑰綁定可信、私鑰受控 |
| HMAC | 共享金鑰者的訊息認證 | 雙方可產生，難單獨歸責其中一方 |
| 存取與處置日誌 | 追查誰何時做了什麼 | 日誌須受保護，身分來源須可信 |

不可否認性是上述條件下的證據能力，不是「任何人永遠不能否認」的絕對承諾。私鑰遭竊、帳號共用或綁定錯誤，都會削弱歸責依據。

## 走一次流程（補充）

### 沿用更新訊息的欄位（補充）

共用例子的六筆 `signature_evidence` 列出待簽清單摘要、金鑰 ID 與簽章代號，狀態均為「未生成簽章、未執行驗簽」。

這是待建證據的欄位範例，並非已完成的簽章稽核紀錄。以甲院第 1 輪更新為例，應依序完成：

1. 固定輸入資料版本 teaching-v0、共同模型版本 v0，連到此次更新工件。
2. 把發送者、接收者、round=1、nonce 與輸出摘要編入待簽清單。
3. 由甲院受控簽署私鑰簽署，保存清單原始位元組與簽章。
4. 接收端核對公鑰身分及有效狀態，再驗簽、檢查輪次與重放。
5. 保存接受或拒絕的處置，將接受的更新連到聚合後模型版本 v1。

銀行使用同樣欄位，但使用各自的銀行身分與金鑰，不能沿用醫院的簽署者 ID。這能讓相同的計算流程保留不同領域的責任邊界。

### 收到一筆證據要追問什麼（補充）

| 證據欄位 | 要追問的事 |
|---|---|
| input_version／output_ref | 能否找到實際輸入與輸出工件？ |
| sender／receiver／round／nonce | 是否連到正確對象與事件？ |
| signer_key_id／signature_ref | 是否有可驗的簽章及可信公鑰？ |
| verification_status | 誰以何版本的規則驗證？ |
| 接收時間與處置 | 是否重複、失敗或遭後續修改？ |

輸入版本應指向受控清冊或資料版本，不應為了稽核把原始個資複製進日誌。需要可信簽署時間時，另加入可信時間證據，不能只信任發送者自填的時間。

## 程式（補充）

### 先辨認摘要能證明的範圍（補充）

以下摘出共用甲院訊息及既存摘要，核對原內容與修改後內容。它沒有產生或驗證數位簽章，輸出也不支持「已確認院方身分」的結論。

```python
import json, hashlib
m = dict(domain="hospital", sender="A", receiver="coordinator", payload="local-update-A-v0",
         key_owner="A+coordinator:channel", nonce="hospital-A-update-1", round=1)
m.update(input_version="teaching-v0", model_version="v0",
         output_sha256="75652c6cc738e0e7ab97ce74778928f8eaf4c5915e4b1308696f9b45c95e78ca")
expected = "b422ecea6a8b8b0af07fe43fea1c96abf994bb2867fa02e54e270416d68bc0f8"
def digest(message):
    raw = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()
print("manifest matches", digest(m) == expected)
print("changed matches", digest({**m, "payload": "changed-update"}) == expected)
print("signature", "illustrative_not_generated")
```
```text
manifest matches True
changed matches False
signature illustrative_not_generated
```

:::tip[讀碼重點]
比對需要可信的基準摘要。即使 `manifest matches` 為真，也只核對內容，沒有執行公鑰驗簽，更沒有檢查私鑰是否屬於甲院。

這裡依共用例子 README，採原欄位順序、UTF-8 及無額外空格的 JSON；順序或編碼改變，摘要也會不同。安全通訊範例另用 `sort_keys=True` 排序，兩者不能混用。
:::

## 怎麼用、怎麼判讀（補充）

先問要證明的是「內容未改」「哪個金鑰簽的」，還是「哪個人授權了這個業務動作」。這三層不能只靠一次驗簽全數推出。

私鑰應有明確保管者、使用權限、輪替與失陷處置。保存公鑰、身分綁定及金鑰狀態證據，才能事後解釋當時驗證所依據的條件。

### 換個場景（補充）

指引沒有完整教授簽章稽核鏈，也未替此目標列專屬場景。下列場景是從輸入到輸出的可追溯需求延伸。

| 場景 | 要追查的事件 | 必須連起的證據 |
|---|---|---|
| 跨院更新 | 哪院提交哪版更新 | 院方金鑰、模型版本與處置 |
| 銀行風控 | 誰提交風險結果 | 輸入版本、結果摘要與簽章 |
| 製造模型發布 | 誰核准新版模型 | 模型摘要、核准者與發布紀錄 |
| 公部門報告 | 哪個版本被簽核 | 報告原件、簽署者與時間證據 |

## 常見誤解（補充）

- **有雜湊就能證明作者**：任何人都能替相同內容算出相同摘要。
- **驗簽成功就代表內容正確**：簽章不驗證模型準確率或輸入真實性。
- **共享 HMAC 等同公開簽章證據**：知道共享祕密的雙方都可產生認證碼。
- **只存簽章就能完成稽核**：還須保存被簽內容、可信公鑰與接收處置。

## 進階

### 日誌也要被保護（補充）

限制日誌寫入與讀取權限，保留變更軌跡，並依需求使用集中保存或防竄改儲存。日誌內一串「驗簽成功」文字本身不是可重驗的簽章證據。

### 參考來源

- [NIST FIPS 186-5：Digital Signature Standard](https://csrc.nist.gov/pubs/fips/186-5/final)：支持數位簽章的來源認證、完整性與第三方證據定位。
- [NIST SP 800-57 Part 1 Rev. 5](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf)，第 5–8 節：支持身分與金鑰綁定、私鑰保護、生命週期與失陷處置。
- [NIST SP 800-92：Log Management](https://csrc.nist.gov/pubs/sp/800/92/final)：支持日誌保存、管理與保護；此處採一般稽核方法。
- [Cryptography：Ed25519 簽章教學](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/ed25519/)，Signing & Verification：教學參考，支持私鑰簽署、公鑰驗證的流程；本頁未執行簽章程式。
- [Python 3.12 hashlib](https://docs.python.org/3.12/library/hashlib.html)：支持摘要核算程式。

## 小結（補充）

- 雜湊比對內容，簽章連到金鑰，日誌連到事件流程。
- 身分綁定與私鑰控制是歸責證據的重要前提。
- 證據鏈須把輸入、輸出、訊息情境與處置連起來。
- 本例只生成清單摘要，沒有假稱驗簽通過。
