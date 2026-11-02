---
id: deep-learning-framework-landscape
title: JAX、MXNet 與 PaddlePaddle 框架定位
kind: tool
codes: [L23203]
aliases: [Apache MXNet, Hybrid Programming, JAX, JAX 的數值轉換定位, MXNet 的程式風格定位, PaddlePaddle, PaddlePaddle 的框架定位, grad, jit, mxnet, vmap, 飛槳]
summary: 比較框架時先看數值轉換、建模生態與版本狀態，再對應工作需求
requires: [deep-learning]
guide_refs: [guide-3:4-92]
textbook: v2
author: codex
status: draft
goals:
  - id: g1
    text: 說明 JAX 的 NumPy 風格、微分及加速定位，區分 grad、jit、vmap
  - id: g2
    text: 區分 MXNet 命令式、符號式與混合風格，並核對多語言和退役背景
  - id: g3
    text: 依官方來源說明 PaddlePaddle 的定位、版本與應用情境
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 研究員要把客服損失函式求梯度、對 18 筆樣本批次映射，再編譯穩定運算。JAX 的三種轉換如何配對？
    options:
      A: jit 求梯度，grad 做批次映射，vmap 做即時編譯
      B: grad 求梯度，vmap 做批次映射，jit 做即時編譯
      C: vmap 求梯度，jit 做批次映射，grad 做即時編譯
      D: grad 求梯度，jit 做批次映射，vmap 做即時編譯
    answer: B
    explain:
      A: jit 對應編譯，不是梯度；其餘兩個角色也被錯置。
      B: 三者分別把函式轉成梯度、批次化與編譯執行的版本。
      C: vmap 負責批次映射，不能把它當成梯度轉換。
      D: 第一項正確，但 jit 和 vmap 的角色對調了。
  - id: c2
    goal: g2
    type: choice
    prompt: 維護舊 MXNet 1.9.1 系統的團隊先逐步除錯，再用 hybridize 處理相容的模型。哪個說明最完整？
    options:
      A: 它把所有 Python 行為轉為符號圖，且 Apache 仍持續維護新版本
      B: 它把符號圖改為逐步執行，且 Apache 已承諾持續提供安全更新
      C: 它只更換 Python 為 Java 語法，且模型可以免驗證直接搬到新平台
      D: 它結合命令式開發與符號圖執行，且需記錄專案已退役的版本背景
    answer: D
    explain:
      A: 混合化有支援限制，且 Apache 已將 MXNet 移至 Attic。
      B: 轉換方向與官方教學不同，也沒有持續更新承諾可據此成立。
      C: hybridize 處理執行風格，不是自動把 Python 翻成 Java。
      D: 這同時交代混合程式設計的用途及既有系統的維護背景。
  - id: c3
    goal: g3
    type: choice
    prompt: 團隊想用 PaddlePaddle 生態辨識工廠單據。對照指引與官方資料，哪項記錄合理？
    options:
      A: 指引只有標題列名；補充參考 PaddlePaddle 3.x 與 PaddleOCR 的版本相容
      B: 指引已有完整訓練碼；直接套用 PaddlePaddle 3.x 就可保證辨識品質
      C: 指引已說明數值編譯；把 PaddleOCR 當成 JAX 的 jit 指令即可訓練
      D: 指引已定義多語言綁定；把 PaddlePaddle 當成 MXNet 的改名即可部署
    answer: A
    explain:
      A: 原指引缺少功能正文，官方框架定位與 OCR 例子需明確標為補充。
      B: 指引並沒有該框架的完整程式，版本也不能保證資料上的品質。
      C: PaddleOCR 是應用工具生態，不能等同 JAX 的函式轉換。
      D: 三者是不同專案，不能把 PaddlePaddle 說成 MXNet 的改名。
---

## 為什麼需要

指引把幾個框架放在同一節，並不表示它們提供完全相同的功能。選框架前，先分清楚需要的是數值函式轉換、完整建模工具，還是維護既有程式。

JAX 著重數值運算與函數式轉換；MXNet 的特色包含多語言與混合程式設計。PaddlePaddle 在指引只有標題，本頁另以官方資料補足最低限度定位。

## 直覺

同一份客服四維向量可由不同框架處理，但需要自己完成的工作不同。JAX 提供轉換數值函式的工具；較高階的建模接口則把層、訓練與保存等流程包在一起。

:::supplement[來源：JAX Key concepts；Keras 3]
「數值運算庫」不代表不能訓練神經網路。它表示層、優化器或訓練管理未必由核心接口完整包辦，可搭配上層函式庫；Keras 3 也能選 JAX 作後端。
:::

## 定義與公式

### JAX：轉換數值函式

JAX 使用接近 NumPy 的陣列操作，結合自動微分與 CPU、GPU、TPU 加速。指引把它定位為數值計算與機器學習轉換工具，而非傳統完整端到端建模框架。

:::supplement[來源：JAX Key concepts；Automatic differentiation]
`grad` 把適合的純量輸出函式轉成求梯度的函式；`vmap` 沿指定軸把函式批次化；`jit` 追蹤並編譯適合的數值計算。這些轉換可組合，卻各有不同作用。

例如客服自訂損失要梯度，先看 grad；同一運算要套到多筆，才看 vmap。能否有效加速還要看形狀、編譯成本、運算與硬體，不能只看名稱。
:::

### MXNet：混合程式風格

命令式程式逐步執行操作，方便查看中間值；符號式先描述計算關係，再執行整個圖。MXNet 提供兩種風格與多種語言綁定，讓既有系統有不同整合方式。

:::supplement[來源：MXNet 1.9.1 Hybridize；MXNet C++ API inference tutorial；Apache Attic MXNet]
Gluon 的 HybridBlock 可先用命令式開發，再透過 `hybridize` 將受支援的路徑轉成符號圖執行。它不是把任意 Python 程式無條件轉成圖。

例如研究端用 Python 訓練客服分類器，工廠既有的 C++ 服務則載入匯出的模型做推論。MXNet 1.9.1 提供 C++ 綁定，這裡用具體語言說明跨系統整合的用途。

整合前須核對模型匯出格式、算子和各語言綁定版本；不能假設它們同步支援。Python／C++ 是語言選擇，命令式／符號式是執行風格，兩者不可混為一談。

這裡描述 MXNet 1.9.1 文件的功能。專案於 2023 年退役，2024 年完成移入 Apache Attic；維護舊程式仍需版本背景，不能把歷史介紹當成現行維護承諾。
:::

### PaddlePaddle：框架與應用生態（補充）

飛槳（PaddlePaddle）是提供模型開發與部署能力的深度學習框架。本頁以官方 3.x 文件為定位範圍，應用套件的相容版本仍需分別核對。

PaddleOCR 是其文件與影像文字辨識生態的一個例子：工廠單據可先做文字偵測、辨識，再整理成欄位。這比只看框架名稱更能說明實際用途，但品質仍要用自己的單據驗證。

## 走一次流程（補充）

拿共用例子的客服 18 筆四維向量與製造 18 張影像，固定索引和輸出三類標籤，先寫需求，再判斷工具定位。

1. 要研究客服自訂損失的微分與批次化：評估 JAX 的函式轉換，另安排訓練管理。
2. 要維護工廠既有 MXNet 程式：辨認命令式、符號式及語言綁定，保留原版本記錄。
3. 要建立製造單據 OCR：查 PaddlePaddle 與 PaddleOCR 的功能及版本相容，再準備適合文字辨識的資料。

本組 8×8 合成影像只有形狀與標籤，不含可辨識單據，不能拿它宣稱 OCR 效果。環境未安裝這三個框架，本頁沒有程式實測或跨框架效能排名。

## 怎麼用、怎麼判讀

先比較任務、程式風格與既有生態，再看硬體與版本。名稱同在框架清單，並不代表可直接互換 API、權重或部署流程。

### 換個場景

| 場景 | 定位或資料條件 | 判讀重點 |
|---|---|---|
| 數值研究 | NumPy 風格、自動微分 | JAX 轉換函式 |
| 多語言既有系統 | 需要語言綁定與混合風格 | MXNet 的歷史定位 |
| 金融模擬（補充） | 自訂可微目標、多次批次計算 | 區分求梯度和批次映射 |
| 工廠單據（補充） | 文字偵測、辨識與結構化 | PaddleOCR 生態與相容版本 |
| 客服原型（補充） | 希望高階接口快速組層 | 另比較 Keras 等建模工具 |

## 常見誤解

- 「JAX 只是 NumPy，不能訓練模型」：它提供微分及函式轉換，可組成訓練流程。（補充）
- 「混合風格指同時用 Python 和 Java」：這裡指命令式與符號式；語言綁定是另一個特色。
- 「指引列 PaddlePaddle 就代表已教完整功能」：該頁只有標題，本頁功能說明屬補充。（補充）

## 進階

### 參考來源

- 科目 3 指引 `guide-3:4-92`：JAX、MXNet 的定位；PaddlePaddle 僅在標題列名的缺口。
- [JAX Key concepts](https://docs.jax.dev/en/latest/key-concepts.html)、[自動微分教學](https://docs.jax.dev/en/latest/automatic-differentiation.html)：轉換角色與依函式需求選工具的教學思路。
- [MXNet Hybridize 教學](https://mxnet.apache.org/versions/1.9.1/api/python/docs/tutorials/packages/gluon/blocks/hybridize.html)：命令式、符號式與混合開發流程。
- [MXNet 1.9.1 C++ 推論教學](https://mxnet.apache.org/versions/1.9.1/api/cpp/docs/tutorials/cpp_inference)：C++ 綁定與載入模型推論的補充場景；與 Python 訓練端整合仍須核對版本。
- [Apache Attic](https://attic.apache.org/projects/mxnet.html)：退役狀態與日期。
- [PaddlePaddle 官方指南](https://www.paddlepaddle.org.cn/documentation/docs/en/guides/index_en.html)、[PaddleOCR 官方庫](https://github.com/PaddlePaddle/PaddleOCR)：框架與單據處理的補充定位。
- [Keras 3](https://keras.io/keras_3/)：高階建模接口與 JAX 後端的關係。

## 小結

- JAX 著重數值運算、自動微分與加速轉換。
- MXNet 的混合風格與語言綁定是不同面向。
- MXNet 的退役狀態須和歷史功能一起讀。（補充）
- PaddlePaddle 的功能與應用定位由官方文件補足。（補充）
