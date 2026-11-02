# L23202-A 共用房屋與能源資料

本組七頁共用兩份教學合成資料，各80筆，並非市場資料、實際基準或時間序列。房屋目標是價格（十萬元）；能源目標是耗電（kWh）。兩領域共用輸入數值及索引，能源目標固定為房屋目標的3倍加100，方便核對尺度改變。

## 欄位與固定規則

| 房屋欄位 | 能源欄位 | 單位／意義 |
|---|---|---|
| area | production | 坪／產量單位，第一個數值特徵 |
| area_copy | production_copy | 完全相同的副本，刻意建立共線性 |
| age | temperature | 年／攝氏度，第二個實質特徵 |
| irrelevant | irrelevant | 教學無關欄，未參與目標生成 |
| price | consumption | 十萬元／kWh，連續目標 |

索引從0起，ID從1起；例如索引8是H09或E09。所有模型固定使用train_indices的60筆與test_indices的20筆，兩者互斥且合計80筆。索引除以4餘3者為測試；資料以算術生成，不用亂數；有隨機步驟的樹固定random_state=23202。

以i表示0–79的索引，先產生面積10+(7*i)%51、屋齡5+(3*i)%21、無關欄(11*i)%17-8。房屋價格為20+2*area-age+20*(area>35)+(13*i)%9-4，再以以下六筆固定教學值覆寫。副本在覆寫後複製面積。

| 手算索引／ID | 面積 | 屋齡 | 價格 |
|---|---:|---:|---:|
| 0／H01 | 10 | 5 | 40 |
| 4／H05 | 20 | 10 | 50 |
| 8／H09 | 30 | 5 | 60 |
| 12／H13 | 40 | 10 | 100 |
| 16／H17 | 50 | 5 | 110 |
| 20／H21 | 60 | 10 | 120 |

這六筆皆屬訓練資料。手算子模型只用於展示，不另切一套測試集，不把六筆訓練擬合當作80筆的泛化成績。

## 頁面使用與參考數值

- linear-regression：雙特徵候選式20+2a−z，六筆預測35、50、75、90、115、130；SSE475。完整80筆固定切分的OLS測試MSE為33.455816944。
- adjusted-r-squared：六筆平均80、SST5800；面積與屋齡OLS的SSE300，R²0.9482758621、調整後0.9137931034。共用無關欄在此子集為−18+0.15×面積+1.7×屋齡，加入後秩仍3、調整值不變。
- `L23202-A-adjusted-r2.json`：同六筆另設u=[1,−1,0,0,−1,1]，加入面積、屋齡與截距後秩由3變4，SSE仍300，調整後0.8706896552。此欄只用於六筆教學對照，未修改兩份80筆JSON；所有子模型都排除面積副本。
- lasso、ridge-regression：同60筆訓練列的四欄先標準化，再使用SSE版λ清單12、120、600、1200、6000。Lasso API的alpha為λ/120，Ridge API的alpha為λ；不能把兩個模型的懲罰尺度混為一談。
- support-vector-regression：完整80筆用相同切分。另以單特徵候選f(a)=2a+15、ε5展示六筆帶外損失，總20；C2時目標42。不是宣稱該候選式是已擬合SVR。
- regression-tree：六筆只用面積，35坪切分的葉平均50與110、SSE400；要求每葉至少2筆，深度1停止。
- decision-tree：以價格至少80衍生高價標籤（能源以340衍生高耗電標籤）；分類標籤不用作特徵。三樹硬票高價／高價／一般與迴歸輸出100／110／120是明列的教學假設，存於demonstrations，不是訓練好的森林。

同領域的模型比較固定資料、切分、欄位與種子；手算示範若只取面積或只取兩個特徵，頁面另行明示。標準化只fit訓練列；候選λ與模型參數是教學設定，不以測試集調選。

## 重建與核算

在worktree根目錄執行，使用主checkout既有Python環境，不新增套件：

```powershell
$env:UV_PROJECT_ENVIRONMENT='D:/AI_test/tools/python/.venv'
$env:UV_NO_SYNC='1'
$env:PYTHONIOENCODING='utf-8'
uv run --project tools/python python tmp/rollout/groups/W-L23202-A/figure-scripts/build-data.py
uv run --project tools/python python tmp/rollout/groups/W-L23202-A/figure-scripts/build-figures.py
uv run --project tools/python python tmp/rollout/groups/W-L23202-A/verify-examples.py
```

第一步重建資料；第二步重建六張SVG並加入教學集成假設。第三步以NumPy最小平方、Ridge方程與Lasso KKT條件獨立核算，結果記在同資料夾的examples-check.md。

六張圖ID：l23202-linear-regression-line-step、l23202-lasso-coefficient-path、l23202-ridge-regression-coefficient-path、l23202-support-vector-regression-tube、l23202-regression-tree-split、l23202-decision-tree-branch-vote。
