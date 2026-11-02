---
id: detection-map
title: 物件偵測的 AP 與 mAP
kind: metric
codes: [L21102, L23303]
aliases: [AP, Mean Average Precision, mAP, 平均精確率]
requires: [object-detection, intersection-over-union, precision, recall]
summary: AP 彙整單類別的排序品質，mAP 再平均同一評測約定下的各類別 AP
goals:
  - id: g1
    text: 區分 IoU 匹配、信心閾值與跨類別平均，並算出小型 AP 與 mAP
formula_groups:
  - id: ranked-pr
    source: https://github.com/cocodataset/cocoapi/blob/master/PythonAPI/pycocotools/cocoeval.py
    status: pending
    checked_by: null
  - id: envelope-ap-map
    source: https://raw.githubusercontent.com/rafaelpadilla/Object-Detection-Metrics/master/lib/Evaluator.py
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一張圖只有 1 個刮痕真值，兩個刮痕預測框的 IoU 都是 0.9，信心為 0.95、0.80。IoU 門檻 0.5，一對一匹配，結果為何？
    options:
      A: 先框記 TP、後框記 FP，真值只用一次
      B: 兩框各記一個 TP，真值可重複使用
      C: 兩框各記一個 FP，重複就全部作廢
      D: 先框記 FP、後框記 TP，優先低信心
    answer: A
    explain:
      A: 高信心框先匹配，後來重複框無法再占用同一真值。
      B: 真值重複使用會把一個物件當成兩次成功。
      C: 重複不會使已成功的第一框失效。
      D: 本題按信心降序匹配，不優先低信心框。
  - id: c2
    goal: g1
    type: choice
    prompt: 同一測試集的 2 類 AP 為 0.8、0.4；團隊將它們平均得到 0.6。這個數字代表什麼？
    options:
      A: 每個預測框的 IoU 平均，並未看類別排序
      B: 固定信心閾值的召回率，並未看框的位置
      C: 同評測約定的類別 AP 平均，兩類各占一半
      D: 所有影像的分類正確率，每張影像各占一票
    answer: C
    explain:
      A: IoU 參與匹配，但 mAP 不是把每框 IoU 直接平均。
      B: AP 彙整排序形成的多個操作點，不是單點召回率。
      C: 兩類的 AP 等權平均為 0.6，前提是評測約定一致。
      D: 偵測評分以物件匹配為基礎，不是整張影像分類。
  - id: c3
    goal: g1
    type: choice
    prompt: 同一組預測框，IoU 匹配門檻從 0.5 改為 0.75，信心閾值維持 0.3。哪項解讀正確？
    options:
      A: 信心為 0.6 的框會被刪掉，因為 0.6 小於 0.75
      B: IoU 為 0.6 的框不能匹配，保留預測的信心規則不變
      C: IoU 為 0.6 的框仍可匹配，因為 0.6 大於 0.3
      D: 信心為 0.6 的框改成 TP，因為門檻已經變高
    answer: B
    explain:
      A: 0.75 約束框的重疊，不是信心的篩選值。
      B: 提高 IoU 門檻要求更貼合真值，信心篩選仍用 0.3。
      C: 信心閾值不能代替 IoU 匹配門檻。
      D: 提高重疊要求不會自動把較低信心框變成成功匹配。
textbook: v2
author: codex
status: draft
guide_refs: [guide-1:3-51, guide-1:3-52]
---

## 為什麼需要

一個瑕疵被框出三次，不能算找到三個瑕疵。物件偵測除了位置重疊，還要處理漏框、錯類別、重複框與信心排序。

:::supplement[來源：COCO 官方評測程式；核心延伸：IoU 在偵測評分中的角色]
AP（Average Precision）彙整單類別的排序，mAP（Mean Average Precision）再跨類別平均。兩者評估一批預測的品質，而非單框是否重疊。
:::

## 直覺

IoU 像「框有沒有貼到物件」的尺。把尺訂成 0.5，表示匹配時要求達到該重疊程度；它與模型自評「多有把握」的信心分數不同。

:::supplement[來源：COCO 官方評測程式；Stanford CS231n Lecture 9]
把預測按信心排隊，再讓每框找同影格、同類別且尚未被占用的真值。成功者記 TP，失敗者記 FP；重複框即使 IoU 很高，仍可能是 FP。

![先固定匹配規則，才沿信心排序累計 PR；mAP 在最後平均類別 AP。](figure:l21102-detection-map-flow)
:::

## 定義與公式

### 匹配規則（補充）

本頁用同影格、同類別的一對一貪婪匹配：按信心降序，選尚未使用且 IoU 最大的真值；IoU ≥ 0.5 才記 TP。沒有匹配的框記 FP，未匹配真值是漏檢。

沒有 crowd 或忽略區域；同分按事件 ID、預測 ID 升序。每個類別的真值數固定，不因提高信心閾值而變少。來源：COCO 官方評測程式的排序與匹配步驟，這裡採簡化資料條件。

### 排名形成 PR（補充）

$$
P_j=\frac{\mathrm{TP}_j}{\mathrm{TP}_j+\mathrm{FP}_j},\qquad
R_j=\frac{\mathrm{TP}_j}{N_{\mathrm{gt}}}
$$

$j$ 是排名，$P_j$、$R_j$ 是精確率與召回率。$\mathrm{TP}_j$、$\mathrm{FP}_j$ 為累計成功與失敗框；$N_{\mathrm{gt}}$ 為該類真值數。

納入 3 框，若累計 TP = 2、FP = 1，且有 2 個真值，則 $P_3=2/3$、$R_3=2/2=1$。尚未納入任何框時精確率未定義；沒有該類真值時不硬填 AP 為 0。來源：COCO 官方評測程式。

### AP 約定與類別平均（補充）

本頁採「全點精確率包絡積分」：在每次召回率增加時，使用該點及其右方的最高精確率。這是明確的教學約定，不能直接當成 COCO 的評測結果。

$$
\begin{aligned}
\widehat P_j&=\max_{\ell\ge j}P_\ell,\\
\mathrm{AP}&=\sum_j(R_j-R_{j-1})\widehat P_j,\\
\mathrm{mAP}&=\frac1C\sum_{c=1}^{C}\mathrm{AP}_c
\end{aligned}
$$

$\widehat P_j$ 是精確率包絡，$R_0=0$；$\ell$ 是後續排名。$C$ 是類別數，$\mathrm{AP}_c$ 是第 $c$ 類 AP；召回率未覆蓋部分貢獻為 0。

兩類 AP 是 $5/6$、$2/3$，則 $\mathrm{mAP}=(5/6+2/3)/2=3/4$。來源：Padilla 等人的偵測指標實作。

## 算一次（補充）

共用檔 `L21102-C-events.json` 的製造測試事件是 M09–M12：刮痕、凹痕各有 2 個真值。座標以 `[x1,y1,x2,y2]` 表示，右下邊界不含。以下未先刪掉低信心框。

| 刮痕排序 | 對應事件／信心 | 匹配結果 | 累計 P／R |
|---|---|---|---|
| 1 | M09／0.95 | 首框 TP | 1／0.5 |
| 2 | M09／0.90 | 重複 FP | 0.5／0.5 |
| 3 | M10／0.80 | 新真值 TP | 2/3／1 |

召回率只有兩次各增加 0.5；對應包絡精確率為 1、2/3。因此刮痕 AP = $0.5\times1+0.5\times2/3=5/6$。

凹痕依信心排序為 M11 偏框、M11 正框、M12 正框，結果為 FP、TP、TP。PR 點為 $(0,0)$、$(0.5,0.5)$、$(1,2/3)$，順序是召回率、精確率。

凹痕包絡為 2/3，AP = $0.5\times2/3+0.5\times2/3=2/3$。兩類 mAP = 0.75；交通 T09–T12 獨立評分，同規則也得 0.75。

![實線真值與虛線偏框的交集只有 4；另一種失敗是正框重複占用同一真值。](figure:l21102-detection-map-match)

若只看信心 ≥ 0.8 的凹痕框，留下 1 TP、1 FP，精確率為 1/2、召回率為 1/2。這個單點不是前面用完整排序算出的 AP。算例延伸自 Padilla 指標實作；所有數字來自教學資料。

## 程式（補充）

以下三段依序執行，共享變數，核對共用檔中製造測試集的六個預測。不載入模型，也不使用分類用的 `average_precision_score` 取代框匹配。

### 固定框與重疊

```python
gt = {e: [0, 0, 4, 4] for e in ["M09", "M10", "M11", "M12"]}
pred = {"刮痕": [("M09", .95, gt["M09"]),
                 ("M09", .90, gt["M09"]), ("M10", .80, gt["M10"])],
        "凹痕": [("M11", .94, [3, 0, 7, 4]),
                 ("M11", .85, gt["M11"]), ("M12", .75, gt["M12"])]}
def iou(a, b):
    w = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    h = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = lambda z: (z[2] - z[0]) * (z[3] - z[1])
    return w * h / (area(a) + area(b) - w * h)
print(f"偏框 IoU={iou(pred['凹痕'][0][2], gt['M11']):.6f}")
```
```text
偏框 IoU=0.142857
```

### 一對一匹配

```python
hits = {}
for cls, rows in pred.items():
    used, flags = set(), []
    for event, score, box in sorted(rows, key=lambda r: -r[1]):
        ok = event not in used and iou(box, gt[event]) >= .5
        flags.append(int(ok))
        if ok:
            used.add(event)
    hits[cls] = flags
    print(cls, flags)
```
```text
刮痕 [1, 0, 1]
凹痕 [0, 1, 1]
```

本例每影格僅一個該類真值，所以用事件 ID 記已匹配。一般資料必須記物件 ID，並在同影格同類別候選中找最大 IoU；不能把這個簡化直接套到多物件影像。

### 累計與 AP

```python
def ap(flags, n_gt):
    tp, precision = 0, []
    for j, hit in enumerate(flags, 1):
        tp += hit
        precision.append(tp / j)
    envelope = [max(precision[j:]) for j in range(len(flags))]
    return sum(hit / n_gt * p for hit, p in zip(flags, envelope))
values = [ap(hits[c], 2) for c in pred]
for cls, value in zip(pred, values):
    print(f"{cls} AP={value:.6f}")
print(f"mAP={sum(values) / len(values):.6f}")
```
```text
刮痕 AP=0.833333
凹痕 AP=0.666667
mAP=0.750000
```

:::tip[讀碼重點]
先以 IoU 與是否占用決定 TP／FP，再計算精確率包絡。分母 2 是該類真值數，不是預測框數；三段完整重現教學約定。
:::

## 怎麼用、怎麼判讀

指引用 IoU 衡量預測區域與真值的重疊，也提到偵測可訂不同重疊門檻。邊界模糊或物件重疊時仍需一致標註；一個高 IoU 無法顯示其他物件有沒有漏掉。

:::supplement[來源：COCO 官方評測程式]
比較 mAP 要一起寫明資料切分、類別、IoU 與 AP 約定。COCO 預設跨 0.50 至 0.95 的十個 IoU 門檻，並採 101 個召回率取樣；AP50 與這種彙整不可直接當成同一指標。
:::

### 換個場景

| 場景 | 評分或判讀重點 |
|---|---|
| 邊界模糊或區域重疊 | 指引的 IoU 場景；先確認真值與重疊定義 |
| 製造瑕疵定位（補充） | 分類別看 AP，也查看小瑕疵漏檢 |
| 交通車輛盤點（補充） | 重複框算 FP，避免同一輛車多算 |
| 農業果實偵測（補充） | 遮擋可能漏框，不能只看已找到框的 IoU |

## 常見誤解

- **IoU 0.8 就是信心 80%。** IoU 描述位置重疊，信心描述模型排序依據。
- **框越多 AP 一定越高。** 重複框與錯框會加入 FP。（補充）
- **mAP 就是每個物件的 AP 平均。** 本頁先在類別內算 AP，再跨類別平均。（補充）
- **分類 PR 的程式可以直接吃框。** 偵測必須先匹配真值；沒有預測的真值仍留在召回率分母。（補充）

## 進階

### 補充內容的範圍（補充）

本頁的 AP、mAP、排序匹配及算例是 IoU 評分的核心延伸。未展開 crowd、面積分組與所有歷史協定；報分數時應依實際評測程式說明，不能只寫「AP」。

### 參考來源

- 科目 1 學習指引 `guide-1:3-51`～`guide-1:3-52`：IoU 的重疊解讀、偵測門檻與資料條件。
- [COCO 官方評測程式](https://github.com/cocodataset/cocoapi/blob/master/PythonAPI/pycocotools/cocoeval.py)：定義與公式、匹配、COCO 約定比較。
- [Padilla 等人的偵測指標實作](https://raw.githubusercontent.com/rafaelpadilla/Object-Detection-Metrics/master/lib/Evaluator.py)：精確率包絡積分與算一次。
- [Stanford CS231n Lecture 9](https://cs231n.stanford.edu/slides/2024/lecture_9.pdf)：直覺中「定位與分類共同評分」的教學脈絡。

## 小結

- IoU 與信心分數回答不同問題。
- 同一真值只能匹配一次，重複框可能成為 FP。（補充）
- AP 彙整單類別排序，mAP 平均各類別 AP。（補充）
- 比較分數前先對齊資料、IoU 與 AP 約定。（補充）
