---
id: nist-ai-rmf
title: NIST AI RMF 風險治理框架
kind: regulation
codes:
  - L21203
aliases:
  - AI RMF
  - NIST AI RMF
summary: NIST AI RMF 以四個互相回饋的功能，組織全生命週期的風險管理
goals:
  - id: g1
    text: 用 Govern、Map、Measure、Manage 配置活動、責任與證據，並辨識自願框架性質
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 授信團隊每週查近期錯拒率，發現 9/100 超過 8% 門檻，再由主管決定停用自動拒貸。兩項活動最適合分別歸在哪裡？
    options:
      A: Map、Govern
      B: Manage、Measure
      C: Govern、Map
      D: Measure、Manage
    answer: D
    explain:
      A: 量測效能不是辨識情境；具體停用是處置活動。
      B: 先後兩活動的功能被對調了。
      C: 制定制度與辨識情境無法直接描述量測與停用。
      D: 量測提供風險證據，管理功能依證據採取處置，兩者互相回饋。
  - id: c2
    goal: g1
    type: choice
    prompt: 工廠已依 RMF 做完首次四功能工作，換新材料後是否要再做？
    options:
      A: 要，Govern 持續提供權責與容忍度，新情境需重新辨識、量測與管理
      B: 不用，四功能完成一次即有永久認證
      C: 只要重新跑 Measure，其他功能依法不得再改
      D: RMF 是強制全球法律，所以全部產品必須同一套門檻
    answer: A
    explain:
      A: 四功能可反覆運用於生命週期，框架本身以自願方式使用。
      B: AI RMF 不是一次性完成便永久有效的認證。
      C: 新情境也會改變用途、影響與處置，沒有這種單一功能限制。
      D: RMF 不是全球強制法律，門檻應依情境與義務訂定。
requires:
  - ai-risk-governance
textbook: v2
author: codex
status: draft
---

## 為什麼需要（補充）

風險清單有人填、模型有人測，仍可能沒有共同的決策制度。NIST AI RMF（AI Risk Management Framework）用四個功能，讓不同角色知道活動如何接到風險管理。

本頁依 AI RMF 1.0 說明，屬學習指引未完整展開的核心補充。它處理系統對個人、組織與社會的風險，範圍超過模型準確率。

## 直覺（補充）

先把四功能當成四個持續要回答的問題：誰決定、影響誰、證據如何、採取什麼行動。Govern 貫穿另外三個功能，不是做完便離開的起點。

![Govern 持續包住另外三功能；Map、Measure 與 Manage 之間可反覆回饋。](figure:l21203-nist-ai-rmf-functions)

圖中的雙向關係表示可以回頭重做。發現新材料造成漏判時，不只重測，也要重新檢查使用情境與處置。

## 定義與公式（補充）

四功能是治理（Govern）、情境辨識（Map）、衡量（Measure）與管理（Manage）。中文是本頁的功能說明，判讀時保留英文名稱。

| 功能 | 核心問題 | 活動與證據 |
|---|---|---|
| Govern | 誰負責，哪些風險不能接受？ | 權責、政策、容忍度與回報制度 |
| Map | 系統在何處使用，可能影響誰？ | 用途、利害關係人、限制及風險清單 |
| Measure | 如何知道風險與控制效果？ | 定量或定性測試、監測及不確定性紀錄 |
| Manage | 依優先序投入什麼資源與行動？ | 處置、停用、復原與殘餘風險計畫 |

AI RMF 供自願使用，不是法律、認證或可直接打勾完成的清單。組織仍須遵守適用義務，並依情境選擇活動與證據。

## 走一次流程（補充）

把授信 C4 放進四功能，以下是一次安排活動的示範，並非規定只能依此順序執行。

| 功能 | 本次活動 | 責任 | 證據 |
|---|---|---|---|
| Govern | 設錯拒 8% 門檻及停用權限 | 風險委員會 | 風險政策與核准紀錄 |
| Map | 辨識景氣變動與新申請人影響 | 業務、模型主管 | C4 清單與用途範圍 |
| Measure | 查近期 100 件覆核中 9 件錯拒 | 獨立驗證人員 | 樣本、時間與錯拒紀錄 |
| Manage | 停用自動拒貸、安排人工與重驗 | 信貸及模型主管 | 停用、資源與恢復條件 |

上線前做情境盤點與測試，上線後持續監測與處置。若人工量能不足，回 Map 檢查流程限制，再由 Govern 調整權責與資源。

製造 M4 同樣適用：新材料引出新的使用條件，100 件漏判 7 件超過 5% 門檻，就停自動放行。更換材料也要更新風險清單，不能只保存新成績。

## 怎麼用、怎麼判讀（補充）

判斷功能時看活動目的。訂監控制度偏 Govern；實際取得效能證據偏 Measure；依證據停用偏 Manage。同一工作可支援多功能，不必硬切成互斥部門。

### 換個場景（補充）

| 場景 | 風險問題 | 四功能如何接起來 |
|---|---|---|
| 製造換材料 | 原先驗證是否仍適用？ | 更新情境、量漏判、停放行，保留品保權責 |
| 臨床輔助 | 證據或覆核時間是否足夠？ | 指定醫師權限，驗證限制與安全備援 |
| 教育推薦 | 是否限縮特定學生機會？ | 盤點受影響者，收回饋並調整用途 |

## 常見誤解（補充）

- **四功能是只走一次的瀑布流程**：它們可反覆回饋，Govern 持續貫穿。
- **Measure 只算準確率**：也包含安全、公平及其他風險的定性與定量證據。
- **依框架做事便自動合法**：自願框架不取代適用法規與契約。

## 進階

### 用建議行動補足證據（補充）

Playbook 提供四功能的行動建議，可依資源與風險挑選。先記下想達到的結果、負責人與證據缺口，避免為了填文件而漏掉真正的風險。

### 參考來源

- [NIST：AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)：支持自願框架性質；本頁採 1.0 功能架構。
- [NIST：AI RMF 1.0 Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)：支持定義、四功能關係與全生命週期。
- [NIST Playbook：Govern](https://airc.nist.gov/airmf-resources/playbook/govern/)、[Map](https://airc.nist.gov/airmf-resources/playbook/map/)、[Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)、[Manage](https://airc.nist.gov/airmf-resources/playbook/manage/)：支持流程中的角色、證據及處置範例。
- [The Alan Turing Institute：Understanding AI ethics and safety](https://www.turing.ac.uk/sites/default/files/2019-06/understanding_artificial_intelligence_ethics_and_safety.pdf)：教學參考，支持把情境、驗證與使用責任接起來；數值與圖為自編。

## 小結（補充）

- Govern 持續提供權責、政策與風險容忍度。
- Map 辨識情境，Measure 提出證據，Manage 安排處置。
- 四功能反覆運作，自願框架不取代適用義務。
