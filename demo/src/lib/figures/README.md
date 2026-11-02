# 公式與圖資作者契約

公式行內用 `$...$`，區塊用獨立行的 `$$`；多字母符號用 `\mathrm{TP}`，長式用 `aligned`。KaTeX 產生 HTML 與 MathML，CSS 與字型均由本機套件打包。搜尋保留公式前後的解釋，略過公式排版 DOM。

正文寫 `![看圖時要注意的結論](figure:圖-id)`。引用對應根目錄 `content/figures/圖-id.json` 或 `.svg`，兩者擇一；缺檔、無替代文字、無效資料會帶正文來源檔名令建置失敗。SVG 示意圖必須有 `<title>` 與 `<desc>`，以自足圖片載入，不得引用遠端資產。

## JSON 共用欄位

執行期 schema 是 [schema.mjs](schema.mjs) 的 `validateFigure`，以下是作者用的宣告規格。未知欄位一律拒絕，不能手填 TP、FP、AUC、ROC 點或 Precision／Recall。

| 欄位 | 型別與限制 |
| --- | --- |
| `id` | 小寫英文／數字以 `-` 分隔；與檔名一致 |
| `kind` | `roc`、`pr`、`learning-curve`、`residual`、`confusion-matrix` |
| `title`、`description` | 必填非空文字；description 說明圖意 |
| `source` | `{ "type": "synthetic" 或 "external", "note": "教學模擬說明或真實來源" }`；note 必填 |

圖說／替代文字由 Markdown 的 `![...]` 提供，與圖資料的 description 一起成為可存取說明。數值保留至小數第 4 位，內部計算不提前取整。圖表 SVG 只在建置時產生，瀏覽器不載入 D3。

## 五種模板的資料宣告 schema

| kind | 專用欄位 | 黃金範例 |
| --- | --- | --- |
| `roc` | `samples: {label: 0或1, score: 有限數字}[]`；可選 `thresholds: 有限數字[]` 標點 | [examples/roc.json](examples/roc.json) |
| `pr` | 與 ROC 相同 | [examples/pr.json](examples/pr.json) |
| `confusion-matrix` | 同上 `samples`；必填 `threshold: 有限數字` | [examples/confusion-matrix.json](examples/confusion-matrix.json) |
| `learning-curve` | `metric: 非空文字`、`unit: 非空文字`、`points: {epoch, train, validation}[]`；三者皆有限數字，epoch 非負且嚴格遞增，至少兩點；可選 `earlyStopping: 資料中存在的epoch` | [examples/learning-curve.json](examples/learning-curve.json) |
| `residual` | `unit: 非空文字`、`samples: {actual: 有限數字, predicted: 有限數字}[]`；非空 | [examples/residual.json](examples/residual.json) |

正例固定 `label=1`，score 越高越像正例，`score >= threshold` 判為正例；score 不限定機率。ROC／PR 必須同時有正負樣本；同分樣本整組加入，ROC 用直線連接實際點，AUC 用梯形積分。PR 為階梯圖，以 `(Recall=0, Precision=1)` 作無預測正例的繪圖端點；平均精確率 AP 用 `Σ ΔRecall × Precision`，不是梯形 PR AUC。閾值大於最大 score 的真實 Precision 未定義，PR 不接受該標點。

混淆矩陣依原始樣本計數；分母為零的 Precision／Recall／F1 顯示「未定義」，不以 0 冒充。ROC 基準線為對角線，PR 基準線為正例比例。學習曲線的停止點是作者指定的已觀察輪次，不自動推定 patience 或最佳化方向；訓練用實線圓點，驗證用虛線方點。殘差固定 `actual - predicted`，顯示零殘差基準線。

黃金範例只放 `examples/`，不作正式教材內容。`/dev/figures/` 使用同一條 Markdown 管線讀這個隔離資料夾示範；正式圖引用一律讀根目錄 `content/figures/`。

正文 `## 進階` 或 `## 進階（補充）` 會預設收合，直到下一個一級／二級標題；三級標題與提示框仍留在進階區塊內。
