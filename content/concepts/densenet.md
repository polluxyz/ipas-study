---
id: densenet
title: DenseNet 與特徵拼接
kind: model
codes: [L23203]
aliases: [Dense Connection]
summary: DenseNet 在密集區塊內拼接先前特徵，讓後層重用資訊並逐層增加通道
is_a: [cnn]
requires: [residual-connections]
contrasts:
  - target: residual-connections
    note: ResNet 將相容特徵逐項相加；DenseNet 在密集區塊沿通道拼接先前特徵
    source: [guide-3:4-71, guide-3:4-72]
guide_refs: [guide-3:4-71, guide-3:4-72]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 用同一輸入比較 DenseNet 拼接與 ResNet 相加，核對通道及特徵重用
formula_groups:
  - id: dense-concatenation
    source: https://arxiv.org/pdf/1608.06993
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
  - id: toy-layer-cost
    source: https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html
    status: verified
    checked_by: codex-gpt-6.1-sol:CK-W-L23203-E
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 製造小張量左上兩通道為 (1,4)，主分支為 (0.5,2)。ResNet 相加與 DenseNet 首次拼接的結果為何？
    options:
      A: 相加為 (1,4,0.5,2)，拼接為 (1.5,6)，通道數分別 4 與 2
      B: 相加為 (1.5,6)，拼接為 (1,4,0.5,2)，通道數分別 2 與 4
      C: 相加為 (1.5,6)，拼接為 (1.5,6)，通道數都維持原本的 2
      D: 相加為 (0.5,2)，拼接為 (1,4)，兩者都只保留較早的特徵
    answer: B
    explain:
      A: 把逐項相加與沿通道拼接的結果對調了。
      B: 相加合成兩個數；拼接保留原本與新增特徵，共四個通道。
      C: 拼接不把對應數值加在一起，因此不會只剩兩通道。
      D: 兩種運算都使用主分支資訊，並非各自丟掉其中一組。
  - id: c2
    goal: g1
    type: choice
    prompt: 密集區塊輸入有 2 通道，每層新增 2 通道，連做兩層且高寬保持 2×2。下列敘述何者合理？
    options:
      A: 最終有 4 通道；第二層只能讀第一層新產生的 2 通道
      B: 最終有 2 通道；兩層所有特徵要相加以保持輸出寬度
      C: 最終有 6 通道；第二層可讀原輸入與首層新增的特徵
      D: 最終有 8 通道；所有先前特徵都要重新計算並複製兩次
    answer: C
    explain:
      A: 第二層會讀取累積的 4 通道，並再新增 2 通道。
      B: 這是誤套相加的規則，Dense 區塊會保留並拼接特徵。
      C: 2+2+2 為 6，這個連接方式讓原輸入和較早特徵都可被重用。
      D: 拼接不要求重算舊特徵，通道也不是每層翻倍。
---

## 為什麼需要

深層網路不一定要讓每一層重新建立所有特徵。DenseNet 讓後層讀到更早的特徵，使已有資訊能被重用，也提供較短的訊號傳遞路徑。

它與 ResNet 都重視跨層資訊，但接法不同。先分清「把數值相加」和「把特徵保留下來拼接」，才能讀懂通道數與後續成本。

## 直覺

ResNet 將兩組相容特徵合成同一組；DenseNet 在密集區塊保留較早的特徵，加入新特徵後再交給下一層。後層因此能直接使用較早的線索。

![相同輸入與主分支，相加維持兩通道，拼接先變四通道；再新增兩通道後累積為六通道。](figure:l23203-densenet-add-concat)

圖的上下路徑使用同一組製造小張量。通道是同一位置上的不同特徵，不是圖片的高寬；看起來都叫「連接」，形狀卻會不同。

## 定義與公式

DenseNet 的核心是把先前層的特徵供後續層重用。指引強調三項效益：特徵重用、緩解梯度消失，以及減少參數量；仍不能推論所有配置都比其他模型省資源。

### 密集區塊內的拼接（補充）

$$
X_\ell=H_\ell([X_0,X_1,\ldots,X_{\ell-1}])
$$

$X_0$ 是區塊輸入，$X_\ell$ 是第 $\ell$ 層新增的特徵，$H_\ell$ 是該層轉換。中括號表示沿通道拼接，不是逐項相加；其他軸須一致。

各層若固定新增 $k$ 個通道，稱為成長率（growth rate）。經過 $L$ 層後，區塊保留的總通道數是：

$$
C_{\mathrm{total}}=C_0+Lk
$$

$C_0$ 是輸入通道數，$L$ 是新增特徵的層數，$k$ 是每層新增通道數。這個式子限於沒有中途壓縮的密集區塊內，不能直接套到整個 DenseNet。

### 本例的權重數（補充）

本頁用無偏置 1×1 卷積作最小轉換：

$$
P=C_{\mathrm{in}}C_{\mathrm{new}}
$$

$P$ 是權重數，$C_{\mathrm{in}}$ 是這一層讀取的通道數，$C_{\mathrm{new}}$ 是新增通道數。本例每層新增 2 通道；此式沒有計入其他卷積、正規化或分類頭。

## 算一次（補充）

使用殘差頁相同的製造張量 $X_0$：1×2×2×2。第一層也用相同的對角權重 0.5，故新增特徵 $X_1=0.5X_0$。

### 左上位置的相加與拼接

輸入為 $(1,4)$，新增特徵為 $(0.5,2)$。ResNet 相加得 $(1.5,6)$；Dense 拼接得 $(1,4,0.5,2)$，保留了四個數。

第二層讀取這四個通道，以兩組全為 0.5 的 1×1 權重新增兩通道。每個新通道的左上值為 $0.5(1+4+0.5+2)=3.75$。

本例刻意讓兩組權重相同，因此新增通道數值相同。實際訓練可學到不同權重，讓各通道取用不同的舊特徵；本例只驗證「能讀到哪些特徵」。

最後保留 $[X_0,X_1,X_2]$，左上六通道為 $(1,4,0.5,2,3.75,3.75)$。代入通道式得 $C_{\mathrm{total}}=2+2\times2=6$。

### 通道與資源一起增加

| 階段 | 保留通道 | 本層權重 | 輸出特徵值數 |
|---|---:|---:|---:|
| 原輸入 | 2 | 0 | 8 |
| 第一層拼接後 | 4 | 2×2＝4 | 16 |
| 第二層拼接後 | 6 | 4×2＝8 | 24 |

兩層共有 $4+8=12$ 個權重。最後特徵若以 FP32 儲存，占 $24\times4=96$ bytes；這只是一份輸出張量，不是完整訓練峰值。

換成交通小張量，仍是 2→4→6 通道；左上輸入 $(0,2)$，首次拼接為 $(0,2,0,1)$。數值換了，通道規則沒有改變。

## 程式（補充）

先將 `IPAS_REPO_ROOT` 設為 repo 根目錄。這兩層只驗證拼接與參數，不是完整 DenseNet，也沒有下載模型。

```python
import json, os, torch
from pathlib import Path
d = json.loads((Path(os.environ['IPAS_REPO_ROOT']) / 'content/examples/L23203-E-tensors.json').read_text(encoding='utf-8'))
torch.manual_seed(d['seed'])
x = torch.tensor(d['manufacturing']['x'], dtype=torch.float32)
h1, h2 = torch.nn.Conv2d(2,2,1,bias=False), torch.nn.Conv2d(4,2,1,bias=False)
with torch.no_grad():
    h1.weight.copy_(torch.tensor(d['dense']['first_weights']).reshape(2,2,1,1))
    h2.weight.copy_(torch.tensor(d['dense']['second_weights']).reshape(2,4,1,1))
a = torch.cat((x, h1(x)), dim=1)
y = torch.cat((a, h2(a)), dim=1)
print('拼接形狀:', tuple(a.shape), tuple(y.shape))
print('左上六通道:', y[0,:,0,0].detach().tolist())
print('兩層參數:', sum(p.numel() for m in (h1,h2) for p in m.parameters()))
```
```text
拼接形狀: (1, 4, 2, 2) (1, 6, 2, 2)
左上六通道: [1.0, 4.0, 0.5, 2.0, 3.75, 3.75]
兩層參數: 12
```

:::tip[讀碼重點]
NCHW 的 `dim=1` 是通道軸。第二層輸入是累積的 `a`，因此能讀到原輸入及第一層的新特徵；若只傳 `h1(x)`，就沒有這個密集重用路徑。

權重已固定，種子只為與共用例子一致，不影響本例輸出。
:::

## 怎麼用、怎麼判讀

當題意強調每層重用先前特徵，可辨識 DenseNet；強調原輸入與主分支逐項相加，則看殘差連接。不要只看到「跳接」就判定運算相同。

:::supplement[來源：DenseNet 原論文 3；D2L 8.7 DenseNet]
DenseNet 通常分成多個密集區塊，區塊間以過渡層（transition layer）壓縮通道或縮小高寬。不是整個網路的所有層都能不顧形狀直接拼接。

特徵重用可在適當設計下節省參數，但保留、拼接中間特徵仍有記憶體與資料搬移成本。本例最後張量從 8 增為 24 個值，不能把參數效率當成記憶體最省的保證。
:::

### 換個場景

指引把 DenseNet 放在影像辨識的 CNN 演進中，強調特徵重用與深層訊號傳遞，沒有另列某種產業一定最適合它。

| 場景或資料條件 | 可比較的需求 | 判讀重點 |
|---|---|---|
| 深層影像辨識 | 重用較早的特徵 | 分辨拼接與殘差相加 |
| 製造瑕疵（補充） | 早期細紋與後期組合線索 | 檢查特徵儲存成本 |
| 交通標誌（補充） | 局部邊緣與較大形狀 | 檢查解析度與裝置容量 |
| 參數預算緊、記憶體較寬裕（補充） | 可試 DenseNet 並與 ResNet 比較 | 記憶體緊時，累積特徵可能先成瓶頸 |

## 常見誤解

- 「DenseNet 是每層相加」：密集區塊沿通道拼接，與 ResNet 的相加不同。（補充）
- 「每層讀到舊特徵就要全部重算」：重用的是已有的特徵輸出。（補充）
- 「特徵重用保證任何模型都更省」：效率要連同層寬、通道與實作條件判讀。
- 「Dense Connection 就是全連接層」：此處描述跨層連接，不是在命名 Dense 分類層。（補充）

## 進階

### 為何每層只新增少量特徵（補充）

後層已有較早特徵可用，未必需要每層都產生很寬的新表示。成長率用來控制新增量，過渡層再控制區塊間的大小；仍須以實際品質與資源核對配置。

### 參考來源

- 科目 3 指引 `guide-3:4-71`～`guide-3:4-72`：CNN 演進、特徵重用與梯度傳遞；核對 PDF 頁 109、110。
- [DenseNet 原論文 3](https://arxiv.org/pdf/1608.06993)：密集區塊、通道拼接、成長率與過渡層。
- [D2L 8.7 DenseNet](https://d2l.ai/chapter_convolutional-modern/densenet.html)：同一輸入對照相加與拼接的教學思路及記憶體限制。
- [PyTorch cat](https://docs.pytorch.org/docs/2.15/generated/torch.cat.html)：程式的拼接軸與形狀契約。
- [PyTorch Conv2d](https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html)：無偏置 1×1 卷積的權重核算。

## 小結

- DenseNet 以跨層特徵重用支援深層學習。
- 拼接保留特徵，相加則合成對應數值。（補充）
- 固定成長率時，區塊通道依新增量累積。（補充）
- 參數效率與中間特徵記憶體成本要分開判讀。（補充）
