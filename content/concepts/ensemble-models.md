---
id: ensemble-models
title: 集成模型
kind: model
codes:
  - L23202
aliases:
  - Ensemble Models
  - 集成學習模型
summary: 結合多個基學習器，藉互補的預測改善泛化與穩定性
goals:
  - id: g1
    text: 辨識集成模型族，區分組合方法與Random Forest、GBDT等具體模型
guide_refs:
  - guide-3:4-36
  - guide-3:4-37
textbook: v2
author: codex
status: draft
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 團隊比較30棵樹的Random Forest與30輪GBDT。哪個模型族關係正確？
    options:
      A: Random Forest屬Boosting；GBDT屬Bagging
      B: 兩者都是投票名稱，不能用在連續值預測
      C: Random Forest屬Bagging系；GBDT屬Boosting系
      D: 兩者都屬單棵決策樹，只有訓練輪數不同
    answer: C
    explain:
      A: 兩個主要策略的對應顛倒。
      B: 兩者都有迴歸版本，且是具體模型族。
      C: 前者靠多棵隨機樹整合，後者逐輪修正。
      D: 多個基學習器的組合不等於單棵樹。
  - id: c2
    goal: g1
    type: choice
    prompt: 三個模型對同6筆客服各錯2筆，而且錯的是完全相同的兩筆。哪個結論合理？
    options:
      A: 把模型擴為30個相同副本，錯誤會自然降為零
      B: 票數增加必然校準機率，所以應只看模型數量
      C: 三個模型有不同名稱，就足以證明錯誤互補
      D: 應檢查錯誤重疊與驗證表現，整合未必有改善
    answer: D
    explain:
      A: 相同副本沒有增加互補資訊。
      B: 模型數量不保證校準。
      C: 不同名稱不保證不同錯誤。
      D: 相關錯誤會限制整合的收益。
---

## 為什麼需要

單一模型可能對資料變動很敏感，也可能能力不足。集成模型（Ensemble Models）把多個基學習器的輸出合起來，希望讓預測更穩定、泛化更好。

「多個模型」不是品質保證。若所有模型在同一批樣本上犯相同錯誤，整合仍可能保留這些錯誤。

## 直覺

先分清兩個問題：基模型怎麼產生，以及最後怎麼整合。Bagging與Boosting描述前者的重要策略；投票與機率整合則著重輸出如何合併。

![先區分組合策略，再把Random Forest與GBDT放回各自的模型族](figure:l23202-ensemble-models-family)

## 定義與公式

本頁不用單一公式概括整個模型族。分類基模型可輸出類別或各類機率，迴歸基模型則輸出連續值；合併規則須與輸出相容。

| 方法或模型 | 在族譜中的角色 | 主要做法 |
|---|---|---|
| Bagging | 組合方法 | 重抽資料，分別訓練再整合 |
| Random Forest | 具體模型族 | 多棵隨機樹，屬Bagging系 |
| Boosting | 組合方法 | 逐輪針對既有不足修正 |
| GBDT | 具體模型族 | 以樹逐輪修正目標損失 |
| XGBoost、LightGBM | 梯度提升樹演算法與實作 | 各有訓練與效率設計 |

指引以Bagging降低變異、Boosting降低偏差作為理解起點。它們的實際效果仍受資料、模型容量與設定影響，不能當成每次都成立的改善保證。

:::supplement[來源：scikit-learn Ensembles；INRIA Introductory example to ensemble models]
Random Forest除重抽資料外，也在分裂時引入特徵隨機性。Bagging的各模型可分別訓練，不表示它們的預測在統計上完全獨立；Boosting則有前後輪的相依關係。
:::

## 走一次流程

### 先驗證，再整合（補充）

沿用六筆三類分數資料，郵件可分促銷／工作／私人，客服可分帳務／技術／物流。兩領域使用相同教學數字，不把類名混用。

1. 固定六筆索引、類別欄序0／1／2及各模型的示意輸出。
2. 先看每個模型在同一批樣本的預測，不換資料來宣稱優劣。
3. 第一筆中甲乙選類0，丙選類1；若用等權硬投票，類0得2票、類1得1票，所以選類0。
4. 檢查錯誤重疊與整合結果；詳細算例見投票與機率整合。

這六筆是人工指定的輸出，不是模型訓練成績。改用真實訓練時才需固定隨機種子與模型設定；若正式調權重，要用另外的開發資料，不能在這六筆調完又拿相同六筆宣稱泛化改善。

## 怎麼用、怎麼判讀

指引指出Random Forest、Gradient Boosting、XGBoost及LightGBM可用於分類，也有迴歸用途。應先訂任務與評估指標，再選模型族與合併方式。

### 換個場景

| 場景 | 資料或任務條件 | 判讀重點 |
|---|---|---|
| 分類 | 基模型輸出類別或機率 | 決策整合方式須一致 |
| 迴歸 | 預測連續數值 | 不是以類別多數票判決 |
| 客服分流（補充） | 三類且少數緊急案重要 | 不只看整體準確率 |
| 製造品質（補充） | 感測值隨批次波動 | 檢查新批次的穩定性 |

:::supplement[來源：scikit-learn Ensembles；INRIA Introductory example to ensemble models]
模型更多會增加儲存與推論成本。比較時同時記錄表現、延遲和可說明程度；若小幅增益換來無法接受的成本，單模型仍可能較合適。
:::

## 常見誤解

- Random Forest是模型族，Bagging是組合方法，兩個名稱不能直接互換。
- 集成不只適用分類，也能做迴歸。
- 多數決是合併選項之一，並非每個集成模型都只收類別票。
- 模型數量增加不保證錯誤互補。（補充）

## 進階

### 族譜不是全部分類法（補充）

本頁族譜只聚焦本單元的核心方法。還有以另一個模型學習如何整合的Stacking；它需要防止整合器讀到過度樂觀的訓練內預測，不在此展開實作。

### 參考來源

- 科目3學習指引（2025-12檔案版），`guide-3:4-36`～`guide-3:4-37`：支持集成模型族、分類與迴歸、策略和具體模型名稱的區分。
- [scikit-learn Ensembles](https://scikit-learn.org/stable/modules/ensemble.html)：支持模型族、基學習器與整合的補充界線。
- [INRIA集成入門課程](https://inria.github.io/scikit-learn-mooc/python_scripts/ensemble_introduction.html)：參考由單模型不穩定性引入集成的教學方式，支持驗證與錯誤互補的說明。

## 小結

- 集成把多個基學習器組成一個預測系統。
- 方法描述如何組合，具體模型還有自己的建構規則。
- 先固定比較條件，再看整合是否有實際收益。（補充）
