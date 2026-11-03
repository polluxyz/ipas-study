# 固定8頁例外實作計畫

2026-11-03使用者已核可。依docs/specs/concept-entry-exceptions.md落實，不修改content或補關係。

1. 協調者：固定spec與界線，保留C12和原強條件的不同計數。
2. Codex worker：核對當前8頁與來源，建立同版證據、可重跑檢查器及正反fixture。以正式建置驗實際href，不用原始字串掃描代替渲染。
3. 非作者：複核入口目的、近鄰排除、SHA／渲染綁定與正反測試。協調者再跑完整QA、看diff與正常PR／CI／合併。

Ownership：Root只改spec／plan；worker改docs/acceptance/concept-entry-exceptions.json、demo/scripts/check-concept-entries.mjs與test、tests/fixtures/concept-entries/**，並補實作紀錄。不得改現有rollout門檻、content、package／lock／CI。新檢查為獨立證據，不能宣稱C1–C13全實作。

風險：把核可當驗收、舊SHA沿用、新增ID、誤用自動入口。對策：分列原始與有效數字、完整來源綁定、固定白名單、語意非作者審查及實際渲染核對。

## 實作紀錄

待依真實結果補記；8頁當版有效數目前尚未簽。
