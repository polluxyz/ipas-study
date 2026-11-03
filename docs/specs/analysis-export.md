# 分析 CSV 匯出規格

2026-11-03 使用者回覆「核可」。核可範圍為既有最小格式提案；不增加題庫來源、概念關係或相依套件。

## 目標與入口

從 `content/` 重建 `analysis/questions.csv`、`analysis/relations.csv`，供人工分析與審查。
沿用 demo 的 Node ESM 與既有 yaml。入口為 `pnpm --dir demo run export`，既有 prebuild 也明確呼叫同一匯出函式。
不新增根 package、正式 site/ 或 GitHub workflow。CSV 是衍生檔，只能由程式產生。

## questions.csv

固定表頭：`場次,科目,題號,答案,代碼,題型,關鍵概念,指引頁碼`。

| 欄位 | 來源與處理 |
|---|---|
| 場次、科目、題號、答案、題型 | 依序取 session、subject、number、answer、type；官方答案原樣保留 |
| 代碼 | codes 依來源順序，以分號串接；第1個仍是主碼 |
| 關鍵概念 | concepts 依來源順序查 concept-index.csv 的 id→title，以分號串接；不取 aliases、不增刪或去重 |
| 指引頁碼 | guide_refs 保留完整 guide-1／guide-3 token及原順序，以分號串接；未提供或空陣列留空 |

本輪只輸出 source=exam 的200題，不按審查狀態過濾。既有1題mock不輸出，摘要列出排除來源及題數。
概念數不在2–4的題目仍完整保留；本版89題差異另報，不由匯出器改題庫。概念標題若含分號，報錯，不發明欄內跳脫。
排序依場次的數值對、subject、number升冪；欄內陣列保持原序。

## relations.csv

固定表頭：`from_id,type,to_id,note,source_refs`。
只匯出 frontmatter 的 is_a、part_of、requires、mitigates、contrasts，每條來源宣告1列。
from_id 是宣告所在頁的ID；to_id 是字串目標或物件target。物件note原樣保留；source的完整token依來源順序以分號串接。
前3種ID清單沒有逐關係note與source，留空；不得以頁面的guide_refs補上。
不產生反向關係、傳遞關係、正文連結或圖上推斷。contrasts方向照來源，不由匯出器修正。
缺少必填欄位、無效目標、重複宣告或解析錯誤須報錯，不靜默修復或去重。
列排序依from_id、上列5型的固定順序、to_id；ID採固定字元序，不依系統語系。

## 編碼、界線與驗證

UTF-8無BOM，逗號分隔、LF換行、檔尾1個LF。含逗號、雙引號或換行的儲存格使用CSV引號規則；雙引號重複跳脫。
不得加入執行時間、絕對路徑等不確定內容。同輸入重跑須逐byte相同。
先驗證來源，再寫輸出；匯入模組本身不得讀寫檔案。以函式與CLI分離，便於離線測試。

- Always：保留原資料與全部引用；透過函式或CLI重建兩檔；新增正反fixture及離線測試。
- Ask first：更換欄位、來源範圍、欄內編碼、相依、官方答案或關係種類。
- Never：手改輸出CSV、改原PDF/text、靜默漏題、為輸出改概念或關係。

成功條件：四卷各50題共200題；關係與固定來源逐條相等（目前680條）；跨科引用與多來源不遺失；逗號／引號／換行可往返；來源不變；連跑2次輸出相同；prebuild真的產出兩檔；完整檢查、測試及建置通過。這不代表全部C1–C13已實作。
