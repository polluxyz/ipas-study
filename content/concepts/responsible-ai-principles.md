---
id: responsible-ai-principles
title: 負責任 AI 原則與治理來源
kind: regulation
codes:
  - L21203
aliases: []
summary: 負責任 AI 將公平、透明與問責化為可驗證的措施與責任
goals:
  - id: g1
    text: 把公平與問責原則連到責任人、驗證證據、錯誤修正及申訴
  - id: g2
    text: 區分國際倫理指引、合作組織、技術標準與強制法規的性質
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 銀行發現青年樣本僅 10/100，預定客群約 40/100；收到 3 件錯拒申訴。哪項最能落實公平及問責？
    options:
      A: 由產品主管公開模型名稱及準確率，以資訊揭露完成 3 件申訴結案
      B: 由資料主管刪除青年欄位再訓練，未查分群結果就宣布 3 件申訴已完成改善
      C: 由模型主管補青年樣本並分群驗證，信貸主管覆核 3 件申訴並留修正紀錄
      D: 由採購主管將 3 件申訴交供應商，銀行保留契約後不再追蹤覆核與修正結果
    answer: C
    explain:
      A: 公開名稱無法取代群體影響檢查與錯誤修正。
      B: 不使用群體欄位不代表代理變數或資料偏向已消失。
      C: 措施、責任與證據連在一起，也保留當事人的救濟路徑。
      D: 委外不會自動免除企業的選用、處置與追蹤責任。
  - id: c2
    goal: g2
    type: choice
    prompt: 跨國專案同時引用 2019 年歐盟倫理指引、OECD 原則、UNESCO 建議與 ISO/IEC 標準。最合理的說法是什麼？
    options:
      A: 文件性質不同；倫理及標準可輔助治理，仍須另查適用法律與契約
      B: 文件名稱不同但效力一致；各國企業只要列出這些名稱，就已符合所有強制法律
      C: OECD 與 ISO 同屬國際來源；遵循 OECD 原則即可自動取得 ISO 認證並免除契約查核
      D: GPAI 是全球許可機關；取得核准便免除各地法律與契約查核
    answer: A
    explain:
      A: 先辨認來源與文件性質，才能分清治理參考和必須遵守的義務。
      B: 國際原則、建議、標準與法規的效力來源不同。
      C: 原則遵循與標準認證不是同一件事。
      D: GPAI 是國際合作機制，並非全球企業的法律許可機關。
requires:
  - ai-risk-governance
guide_refs:
  - guide-1:4-38
  - guide-1:4-39
  - guide-1:4-40
textbook: v2
author: codex
status: draft
---

## 為什麼需要

團隊說「我們重視公平」，當事人仍可能遭到錯誤拒貸。原則必須接到誰檢查、如何改正與怎麼申訴，才有實際作用。

負責任 AI（Responsible AI）同時關注結果對人的影響與決策責任。指引以四項核心原則整理治理要求。

## 直覺

先說希望保護什麼，再問有沒有具體證據。公平要看群體受到的待遇；問責要找得到對選用、修正與持續追蹤負責的人。

:::supplement[來源：The Alan Turing Institute「Understanding AI ethics and safety」]
可以沿「原則→措施→證據→修正」檢查。若最後只剩一句宣言，就還無法判定原則是否真正落實。
:::

## 定義與公式

| 原則 | 轉成什麼措施 | 誰負責 | 留什麼證據 |
|---|---|---|---|
| 透明度（Transparency） | 告知 AI 用途、限制與影響 | 產品及業務主責 | 對外說明與版本 |
| 可解釋性（Explainability） | 提供可理解的個案原因 | 模型與業務主責 | 原因、輸入與覆核紀錄 |
| 公平性（Fairness） | 檢視資料及不同群體結果 | 資料與模型主責 | 分群檢查與修正驗證 |
| 問責性（Accountability） | 明定開發、部署及營運責任 | 管理層與權責主管 | 核准、事故與改善紀錄 |

透明是讓人知道系統如何被使用；可解釋性更進一步協助理解個案判斷。問責涵蓋錯誤修正與負面影響，不能只由模型的技術指標代替。

### 國際來源先看文件性質

以下是指引列出的五類來源。來源本身是組織還是文件，與文件是否具有強制效力，要分開判斷。

| 來源 | 指引列出的內容 | 性質與使用方式 |
|---|---|---|
| 歐盟高級人工智慧專家小組（AI HLEG） | 2019《人工智慧倫理指導原則》（英文：Ethics Guidelines for Trustworthy AI） | 倫理指導文件，非強制法規 |
| 經濟合作與發展組織（OECD） | 《人工智慧高級準則》（英文：OECD Principles on Artificial Intelligence） | 政策建議及共同原則 |
| 聯合國／UNESCO | AI 倫理、人權與隱私 | 國際倫理建議與政策參考 |
| 全球人工智慧聯盟（指引譯名） | GPAI（Global Partnership on Artificial Intelligence）；負責任 AI 合作 | 跨國合作及實務交流 |
| ISO／IEC | AI 相關技術標準 | 依具體標準確認要求或指引 |

:::supplement[來源：歐盟委員會 AI Act；ISO/IEC 23894:2023 官方摘要]
AI Act 是法規，2019 倫理指引則是不同性質的文件。ISO/IEC 23894 提供 AI 風險管理指引；不能因看到 ISO 名稱，就認定是某地直接適用的法律或一定可認證的要求。

標準可能被法規、採購或契約引用；此時仍須查清具體條款、適用地區與角色。GPAI 在此指國際合作機制，並非 AI Act 語境的「通用型 AI 模型」。
:::

## 走一次流程

指引要求建立責任體系並及時修正錯誤。以下用授信 C2，把原則連到可執行的申訴與改善流程。

1. 資料主管發現 100 件只有 10 件青年樣本，對照預定 40 件的服務結構，提出代表性缺口。
2. 模型主管補樣並查群體錯拒情況，保留查核證據。
3. 信貸主管受理申訴，提供個案可理解的拒貸理由；指定覆核人，允許補件與更正錯誤。
4. 覆核若發現錯標，先修正個案，再由模型主管追查同版本的影響範圍並重新驗證。
5. 透過企業倫理委員會或 AI 審查流程確認改善，決定限制用途或恢復，並保留再次申訴管道。

:::supplement[來源：OECD AI 原則的透明與問責；本組共用風險事件]
樣本占比不同只能提示代表性缺口，不能單憑此宣稱已證明違法歧視。具體期限應依任務與適用要求訂定，不能用沒有根據的通用天數代替。
:::

## 怎麼用、怎麼判讀

先找原則要保護的權益，再查措施是否有證據與責任人。國際來源可協助設計治理，但不能單靠名稱推斷企業已符合全部法規。

### 換個場景

| 場景 | 原則如何落地 | 判讀重點 |
|---|---|---|
| 金融貸款 | 拒貸原因、群體檢查與覆核 | 錯誤能更正並追查 |
| 醫療、招聘 | 說明限制及決策依據 | 當事人理解影響、有人負責 |
| 不同群體待遇 | 檢視資料與結果 | 公平不是只看平均表現 |
| 製造瑕疵（補充） | M2 補罕見缺陷並保留品保責任 | 總準確率可能掩蓋漏判 |
| 教育推薦（補充） | 說明推薦用途與申訴入口 | 避免學習機會被持續限縮 |

## 常見誤解

- **倫理原則等於已經完成合規**：法規適用性仍要另行查核。（補充）
- **只要不使用群體欄位就一定公平**：其他欄位與歷史結果仍可能帶來偏向。
- **模型有解釋就可以免除責任**：問責還包括處置錯誤與持續改善。

## 進階

### 留下來源的版本（補充）

治理文件記下文件名稱、版本、適用用途及查核日期。本頁依查閱的原則與官方摘要區分文件性質，不以它代替各產業的法律適用性分析。

### 參考來源

- 科目 1 學習指引，本機快照，guide-1:4-38～guide-1:4-40：支持四原則、責任與五類國際來源。
- [歐盟：Ethics Guidelines for Trustworthy AI](https://digital-strategy.ec.europa.eu/en/library/ethics-guidelines-trustworthy-ai)、[OECD AI Principles](https://www.oecd.org/en/topics/ai-principles.html)：支持原則、對外說明及問責；文件性質對照。
- [UNESCO 倫理建議](https://www.unesco.org/en/artificial-intelligence/recommendation-ethics)、[GPAI About](https://oecd.ai/en/about/about-gpai)、[ISO/IEC 23894:2023](https://www.iso.org/standard/77304.html)：支持國際來源與用途。
- [歐盟委員會：AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)：支持倫理指引與法規的區分。
- [The Alan Turing Institute：Understanding AI ethics and safety](https://www.turing.ac.uk/sites/default/files/2019-06/understanding_artificial_intelligence_ethics_and_safety.pdf)：教學參考，支持原則轉成治理措施；流程與數值為自編。

## 小結

- 公平與問責要有措施、證據及處理錯誤的人。
- 個案說明、覆核與申訴使當事人能挑戰不當結果。
- 先辨識來源與文件性質，再查法律或契約適用性。
