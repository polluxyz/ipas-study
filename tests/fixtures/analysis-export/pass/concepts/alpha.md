---
id: alpha
is_a: [zeta]
part_of: [beta]
requires: [problem, beta]
guide_refs: [guide-1:3-99]
mitigates:
  - target: problem
    note: "保留,逗號與\"引號\"\n第二行"
    source: [guide-3:5-21, 114-2-S1-Q08, guide-1:3-48, guide-3:5-21]
contrasts:
  - target: beta
    note: '  保留前後空白  '
    source: [114-2-S1-Q08, guide-3:5-21]
---
正文 [[zeta]] 不輸出。
