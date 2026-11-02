---
id: grad-cam
title: Grad-CAM 影像解釋
kind: technique
codes: [L21102, L21203]
aliases: []
requires: [cnn, backpropagation, image-dataset-preparation]
summary: Grad-CAM以目標分數對卷積特徵的梯度，標出支持該分數的粗略影像區域
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 追蹤梯度到熱區的流程，依影像區域與延遲需求選用並說明解釋限制
formula_groups:
  - id: gradient-weighted-map
    source: https://arxiv.org/html/1610.02391v4
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21102-D
  - id: display-normalization
    source: https://keras.io/examples/vision/grad_cam/
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L21102-D
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 一個2×2卷積特徵圖四格對目標分數的梯度都是0.25，特徵為[[0.2,0.2],[0.2,0.4]]。加權後再除以最大值，熱圖為何？
    options:
      A: "[[0.05,0.05],[0.05,0.10]]；各格乘上平均梯度後，就已完成題目指定的相對顯示轉換"
      B: "[[0.25,0.25],[0.25,0.25]]；這是空間平均梯度展開後的熱圖"
      C: "[[0.2,0.2],[0.2,0.4]]；因加權後的數值不需再按顯示規則轉換"
      D: "[[0.5,0.5],[0.5,1.0]]；每格加權結果都再除以該圖最大值0.10"
    answer: D
    explain:
      A: 這是原始加權圖，還沒完成題目要求的顯示正規化。
      B: 梯度平均是通道權重，不能直接拿來代替特徵與權重的組合。
      C: 本例加權與除最大值後右下應為1，其餘為0.5。
      D: 權重0.25使加權圖為0.05與0.10，除以0.10便得到所列結果。
  - id: c2
    goal: g1
    type: choice
    prompt: 工廠CNN可取得卷積特徵與梯度，解釋要標出影像區域，單件總預算30毫秒。哪個決策較合理？
    options:
      A: 直接承諾Grad-CAM固定只需1毫秒，並省略裝置與前處理實測
      B: 優先評估Grad-CAM並實測總延遲，超出預算時考慮抽樣離線解釋
      C: 直接承諾300次擾動一定較快，並以呼叫次數代替裝置耗時量測
      D: 優先選任意熱圖並只看畫面漂亮，超出預算時刪掉原始輸入紀錄
    answer: B
    explain:
      A: 需要前向與梯度計算，耗時依模型與硬體，不存在固定通用毫秒值。
      B: 可用梯度與區域需求符合方法條件，但是否能即時使用仍須量測。
      C: 多次擾動通常涉及多次推論，呼叫次數不等於實際毫秒成本。
      D: 解釋需可追溯且反映模型行為，視覺外觀不能作為唯一選擇條件。
  - id: c3
    goal: g1
    type: choice
    prompt: MD01做中值與Gamma後，右下熱度為1，其他三格為0.5。團隊說右下有100%機率是瑕疵，該如何判讀？
    options:
      A: 接受此說法，因每張熱圖的最大值都能直接當作該區瑕疵機率
      B: 接受此說法，因用梯度得到的區域必定等同人工分割的真實邊界
      C: 拒絕此說法，因1是相對縮放結果，仍須核對目標分數與任務證據
      D: 拒絕此說法，因所有大於0的熱度都只能表示背景而不能表示物件
    answer: C
    explain:
      A: 除以每張圖的最大值會把峰值設為1，沒有機率校準的含義。
      B: Grad-CAM是特徵尺度上的粗定位，不是像素真值或完整物件分割。
      C: 需確認解釋的是哪個分數、模型如何建構，以及結果是否符合獨立證據。
      D: 正熱度表示對指定分數的正向支持線索，可能落在物件也可能落在背景。
---

## 為什麼需要（補充）

分類器說「異常」，可能只看到亮點。Grad-CAM（Gradient-weighted Class Activation Mapping）標出一次預測的粗略區域，協助追查依據。

兩本科目的指引都沒有提到此方法，因此本頁正文是補充。它延伸卷積神經網路與反向傳播，並連回影像資料準備的品質檢查。

## 直覺（補充）

卷積特徵圖保留空間位置；梯度則描述指定分數對這些特徵變化的局部敏感度。Grad-CAM先把梯度摘要成各通道的權重，再用權重組合特徵圖。

目標類別改變，梯度與熱區也可能改變。熱區對應的是「這次選定分數的支持區域」，不是模型固定擁有的一張通用注意力圖。

![由同一個目標分數反向求卷積特徵梯度，再組合特徵圖；全程不更新模型權重。](figure:l21102-grad-cam-gradient-flow)

## 定義與公式（補充）

令$y^c$為類別$c$的Softmax前分數，$A^k_{ij}$為第$k$通道在$(i,j)$的卷積特徵。圖高$H$、寬$W$，位置數$Z=HW$。

### 梯度權重與區域圖

先對空間梯度取平均，得到通道權重：

$$
\alpha_k^c=\frac{1}{Z}\sum_i\sum_j
\frac{\partial y^c}{\partial A^k_{ij}}
$$

$\alpha_k^c$表示第$k$通道對目標$c$的局部權重。它不是把特徵值平均，也不是直接把分類機率當權重。

接著組合通道，並用ReLU保留非負部分：

$$
L^c_{ij}=\max\left(0,\sum_k\alpha_k^c A^k_{ij}\right)
$$

$L^c_{ij}$是原始熱度。通常選較後面的卷積層，兼顧語意與空間位置；輸出解析度取決於所選層，放大顯示不會新增真實細節。

### 顯示尺度與零圖

本頁為了比較同圖位置，使用以下顯示轉換：

$$
\widehat L^c_{ij}=
\begin{cases}
L^c_{ij}/\max_{u,v}L^c_{uv}, & \max_{u,v}L^c_{uv}>0\\
0, & \text{其餘情形}
\end{cases}
$$

$u,v$遍歷整張熱圖，$\widehat L$是0到1的相對熱度。全零時保留零圖，不能除以0；非零圖的峰值會變成1，不能跨圖片把峰值大小當信心高低。

## 算一次（補充）

### 從MD01到四格特徵

沿用畫質頁的MD01，先中值，再做Gamma為0.5的轉換，最後除255。固定小模型使用2×2卷積、步幅2、四個權重皆0.25且無偏置，得到一張2×2特徵圖。

| 位置 | 特徵值 | 梯度 | 原始熱度 |
|---|---|---|---|
| 左上 | 0.25049 | 0.25 | 0.06262 |
| 右上 | 0.25049 | 0.25 | 0.06262 |
| 左下 | 0.25049 | 0.25 | 0.06262 |
| 右下 | 0.50098 | 0.25 | 0.12524 |

模型的目標分數是四個特徵的平均，因此每格梯度都是1÷4，也就是0.25。通道權重再平均四個梯度，仍是0.25；左上原始熱度為0.25×0.25049，約0.06262。

以最大原始熱度約0.12524去除，左上相對熱度是0.5，右下是1。若改解釋負的平均分數，權重變成負值，ReLU後會得到全零熱圖。

### 同圖前後不能只比顏色

![原圖的孤立亮點讓左上最熱，處理後右下最熱；每張熱圖皆依自己的最大值縮放。](figure:l21102-grad-cam-hotspots)

原圖左上2×2平均為75.75，比右下64亮，所以原圖熱區落在左上。中值去除亮點後，熱區才回到右下固定區域；零售RD01把區域放在左上，可用同一流程換景。

此模型沒有訓練，權重刻意固定，只計算亮度分數。它不是已學會封口或瑕疵分類的模型；熱區移回指定區域，只證明這次數值流程符合設定。

## 程式（補充）

### 準備同一張圖與固定卷積

先設定`IPAS_REPO_ROOT`為repo絕對路徑。以下使用CPU與固定權重，沒有下載模型，也沒有更新權重。

```python
import json, os, torch, numpy as np
from pathlib import Path
torch.manual_seed(21102)
d = json.loads((Path(os.environ["IPAS_REPO_ROOT"]) / "content/examples/L21102-D-vision.json").read_text(encoding="utf-8"))
raw = np.array(d["domains"]["manufacturing"]["images"][0]["pixel_array"], dtype=float)
p = np.pad(raw, 1, mode="edge")
windows = np.lib.stride_tricks.sliding_window_view(p, (3, 3))
processed = np.sqrt(np.median(windows, axis=(-2, -1)) / 255)
x = torch.tensor(processed, dtype=torch.float32)[None, None]
conv = torch.nn.Conv2d(1, 1, 2, stride=2, bias=False)
with torch.no_grad():
    conv.weight.fill_(0.25)
conv.eval()
print("輸入:", tuple(x.shape), "特徵:", tuple(conv(x).shape))
```
```text
輸入: (1, 1, 4, 4) 特徵: (1, 1, 2, 2)
```

### 取得梯度並組合熱圖

接續上一段，分別解釋未處理、已處理的正向亮度分數。`autograd.grad`取得相對於特徵的梯度，不呼叫優化器。

```python
for name, image in [("原圖", torch.tensor(raw / 255, dtype=torch.float32)[None, None]), ("處理後", x)]:
    a = conv(image)
    score = a.mean()
    grads = torch.autograd.grad(score, a)[0]
    alpha = grads.mean(dim=(2, 3), keepdim=True)
    cam = (alpha * a).sum(dim=1).relu()
    peak = cam.max()
    heat = cam / peak if peak.item() > 0 else torch.zeros_like(cam)
    print(name, "權重:", round(alpha.item(), 4))
    print("相對熱度:", np.round(heat.detach().numpy()[0].astype(float), 2).tolist())
```
```text
原圖 權重: 0.25
相對熱度: [[1.0, 0.21], [0.21, 0.84]]
處理後 權重: 0.25
相對熱度: [[0.5, 0.5], [0.5, 1.0]]
```

:::tip[讀碼重點]
`eval()`設定推論模式，不會關閉梯度；不能用`no_grad()`包住解釋的前向計算。`dim=(2,3)`只平均空間軸，接著才跨通道求和。
:::

## 怎麼用、怎麼判讀（補充）

要取得影像區域線索，而且能存取CNN特徵及梯度時，可優先評估Grad-CAM。只拿到黑箱預測API時，通常要改評估LIME等可用輸入擾動的方法。

### 成本與忠實性一起比較

| 面向 | Grad-CAM | 多次擾動解釋，例如LIME |
|---|---|---|
| 模型存取 | 特徵與目標梯度 | 可呼叫預測即可 |
| 主要計算 | 一次前向與目標的部分反向 | 多次擾動推論與替代模型擬合 |
| 區域含義 | 特徵尺度上的局部梯度摘要 | 選定擾動鄰域內的近似 |
| 需查的限制 | 層、目標、梯度與粗解析度 | 擾動合理性、種子與替代模型忠實性 |

例如規劃單件總預算30毫秒、推論已占18毫秒，剩下12毫秒必須容納解釋與其他作業。這是預算算例，並非實測承諾；要在目標裝置量測後才知道能否逐件即時解釋。

300次擾動代表許多次模型評估，但批次、快取與硬體會改變耗時，不能直接換算成固定倍數。若超出預算，可抽樣或離線檢查；較快也不代表解釋一定更忠實。

### 換個場景

兩本指引都沒有提到Grad-CAM，以下都是補充應用。

| 場景 | 區域檢查 | 需要搭配的證據 |
|---|---|---|
| 製造表面（補充） | 看刮痕或背景亮點 | 遮擋測試、錯誤案例與獨立評估 |
| 零售封口（補充） | 看封口或印刷圖案 | 更換背景、相機與包裝的測試 |
| 醫療影像（補充） | 看病灶附近或拍攝標記 | 專業覆核與獨立臨床驗證 |

## 常見誤解（補充）

- **紅色區域就是原因。** 它是局部梯度摘要，不能直接建立因果關係。
- **熱圖就是分割遮罩。** 粗定位沒有保證涵蓋完整物件或精確邊界。
- **峰值1代表機率100%。** 本頁的1來自每張熱圖自己的最大值縮放。
- **熱圖漂亮代表模型可信。** 應搭配遮擋、權重隨機化等檢查，不能只看外觀。

## 進階

### 忠實性的檢查（補充）

可比較遮住熱區與遮住其他區域後的目標分數變化，也可檢查模型權重改變時熱圖是否合理改變。遮擋本身可能產生分布外影像，單一檢查不能當成因果證明。

### 參考來源

- [Grad-CAM原論文第3節](https://arxiv.org/html/1610.02391v4)：梯度權重、加權圖、目標分數與粗解析度；第2節支持計算流程比較。
- [Keras Grad-CAM教學](https://keras.io/examples/vision/grad_cam/)：直覺、目標切換與顯示轉換的教學思路；本頁另處理零分母。
- [PyTorch autograd.grad](https://docs.pytorch.org/docs/2.15/generated/torch.autograd.grad.html)與[Conv2d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html)：程式的梯度與卷積形狀。
- [LIME原論文](https://arxiv.org/abs/1602.04938)：局部替代解釋、黑箱存取與擾動成本的比較。
- [Sanity Checks for Saliency Maps](https://arxiv.org/abs/1810.03292)：熱圖不能只憑外觀驗收，權重相依檢查的必要性。

## 小結（補充）

- 先指定目標分數，再求卷積特徵梯度、平均權重並組合熱圖。
- 熱圖是粗略支持區域，不能直接當機率、遮罩或因果。
- 解釋速度要連同前處理、推論與裝置實測，不承諾固定毫秒值。
- 固定資料與模型版本，才能把熱區問題追溯回資料流程。
