---
textbook: v2
summary: 用小例子理解分類評估。
goals:
  - id: g1
    text: 能說明正類與負類。
formula_groups:
  - id: ratio
    source: guide-3:5-22
    status: pending
    checked_by: null
self_check:
  - id: c1
    goal: g1
    type: choice
    prompt: 正類由誰定義？
    options: { A: 業務情境, B: 固定為數字一, C: 固定為負類, D: 任意決定 }
    answer: A
    explain: { A: 依要辨識的目標定義。, B: 編碼不決定業務意義。, C: 負類不是辨識目標。, D: 應依業務目標定義。 }
  - id: c2
    goal: g1
    type: choice
    prompt: 數字編碼是否決定正類？
    options: { A: 一定決定, B: 依業務定義, C: 只依樣本量, D: 只依成本 }
    answer: B
    explain: { A: 編碼不代表業務意義。, B: 正確，要先定義辨識目標。, C: 樣本量無法定義目標。, D: 成本不是唯一依據。 }
  - id: c3
    goal: g1
    type: short
    prompt: 定義正類時需要說明什麼？
    key_points: [目標事件, 業務意義]
guide_refs: [115-1-S3-Q44]
---
## 為什麼需要

比較 A 模型與 B 模型時，先定義正類。

## 直覺

![觀察正類與負類的分布](figure:sample)

:::tip[重點]
先看目標事件。
:::

## 定義與公式

$$
p=\frac{1}{2}
$$

## 算一次

一半的樣本是正類。

## 程式

```python
# ## 不是正文標題
p = 1 / 2
print(p)
```

```text
0.5
```

## 怎麼用、怎麼判讀

| 方法 | 目標 |
| --- | --- |
| A | 正類 |
| B | 負類 |

## 常見誤解

數字編碼不代表業務意義。

## 進階（補充）

多類別時，也要清楚定義各類。

## 小結

先定義目標，再解讀指標。
