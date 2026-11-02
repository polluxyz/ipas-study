/** T7/T8 的正反 fixture、遷移門檻與單元分布邊界都以離線資料驗證。 */
import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkConcept } from './concept.mjs';
import { checkT7, checkUnitAnswers } from './self-check.mjs';
import { checkTextbook } from './index.mjs';
import { extractPythonExamples } from './python.mjs';

const fixture = (name) => readFile(new URL(`fixtures/${name}.md`, import.meta.url), 'utf8');
const issuesFor = (source, rule) => checkConcept(source, 'sample.md').filter((issue) => issue.rule === rule);

describe('T7 檢核小題', () => {
  it('通過 fixture 涵蓋所有目標、四個選項、2/3 占比與不同正解', async () => {
    expect(issuesFor(await fixture('T7-pass'), 'T7')).toEqual([]);
  });
  it('順序 fixture：簡答夾在中間為錯誤；選擇在前且 ID 不連號仍通過', async () => {
    expect(issuesFor(await fixture('T7-order-fail'), 'T7')).toEqual([
      expect.objectContaining({ severity: 'error', line: 7, message: expect.stringContaining('short 出現在 choice 之前') }),
    ]);
    expect(issuesFor(await fixture('T7-order-pass'), 'T7')).toEqual([]);
  });
  it('每個違規 short 定位到原項目，開頭簡答也報錯，尾端簡答與空陣列不誤報', () => {
    const orderIssues = (types) => {
      const issues = [];
      checkT7({ textbook: 'v2', self_check: types.map((type) => ({ type })) }, (path) => 10 + (path[1] ?? 0), (rule, line, message) => {
        if (message.includes('short 出現在 choice 之前')) issues.push({ rule, line });
      });
      return issues;
    };
    expect(orderIssues(['short', 'choice', 'short', 'choice', 'short'])).toEqual([{ rule: 'T7', line: 10 }, { rule: 'T7', line: 12 }]);
    for (const types of [[], ['short'], ['short', 'short'], ['choice'], ['choice', 'choice', 'short']]) expect(orderIssues(types)).toEqual([]);
  });
  it('失敗 fixture 回報漏目標、錯選項與解析、禁用選項、同頁同答案與占比', async () => {
    const issues = issuesFor(await fixture('T7-fail'), 'T7');
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(7);
    expect(issues.filter((issue) => issue.severity === 'warning')).toHaveLength(1);
    expect(issues.find((issue) => issue.message.includes('目標 g2')).line).toBe(4);
  });
  it('舊格式不新增 T7/T8 診斷；既有 SELF_CHECK 仍驗證', async () => {
    expect(issuesFor((await fixture('T7-fail')).replace('textbook: v2', 'kind: metric'), 'T7')).toEqual([]);
    expect(issuesFor((await fixture('T8-fail')).replace('textbook: v2', 'kind: tool'), 'T8')).toEqual([]);
    expect(issuesFor(await fixture('self-check-fail'), 'SELF_CHECK').length).toBeGreaterThan(0);
  });
  it('缺少整個 self_check 仍指出每個未涵蓋目標；一題選擇題不報同頁同答案', async () => {
    const source = await fixture('T7-pass');
    expect(issuesFor(source.replace(/self_check:[\s\S]*?---/, '---'), 'T7')).toHaveLength(2);
    expect(issuesFor(source.replace(/  - \{ id: c2[^\n]*\n/, ''), 'T7').some((issue) => issue.message.includes('正解全為'))).toBe(false);
  });
  it('空白理由與非 A–D 鍵均報錯，逐項對應不能用多餘鍵替代', async () => {
    const source = (await fixture('T7-pass')).replace('D: 丁', 'E: 丁').replace('D: 理由', 'D: ""');
    expect(issuesFor(source, 'T7').filter((issue) => issue.severity === 'error')).toHaveLength(2);
  });
  const page = (answers, ownerCode = 'L23303', textbook = 'v2') => ({ data: { textbook, self_check: answers.map((answer) => ({ type: 'choice', answer })) }, ownerCode, file: 'sample.md', fieldLine: () => 4 });
  it('單元少於8題不警告，8題以上超過40%才警告；短答不進分母', () => {
    expect(checkUnitAnswers([page(['A', 'A', 'A', 'A', 'B', 'C', 'D'])])).toEqual([]);
    expect(checkUnitAnswers([page(['A', 'A', 'A', 'A']), page(['B', 'B', 'C', 'D'])])).toHaveLength(1);
    expect(checkUnitAnswers([page(['A', 'A', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'])])).toEqual([]);
    expect(checkUnitAnswers([page(['A', 'A', 'A', 'A']), page(['B', 'B', 'C', 'D'], 'L21302')])).toEqual([]);
    expect(checkUnitAnswers([page(Array(10).fill('A'), 'L23303', 'legacy')])).toEqual([]);
  });
  it('整合掃描以 concept-index 的 owner_code 分組，不能依跨科 codes 重複計算', async () => {
    const folder = await mkdtemp(join(tmpdir(), 't7-owner-'));
    try {
      await mkdir(join(folder, 'concepts'));
      const template = await fixture('T7-pass');
      for (const id of ['one', 'two', 'three', 'four']) await writeFile(join(folder, `concepts/${id}.md`), template.replace('summary:', `id: ${id}\ncodes: [L23303, L21302]\nsummary:`));
      await writeFile(join(folder, 'concept-index.csv'), 'id,owner_code\none,L23303\ntwo,L23303\nthree,L23303\nfour,L23303\n');
      const report = await checkTextbook({ contentDir: folder });
      expect(report.summary.rules.T7).toEqual({ errors: 0, warnings: 2 });
      expect(report.issues.filter((issue) => issue.rule === 'T7').every((issue) => issue.message.includes('4/8'))).toBe(true);
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});

describe('T8 Python 與輸出配對', () => {
  it('通過 fixture 接受空白與一段說明，保留原始行號', async () => {
    const source = await fixture('T8-pass');
    expect(issuesFor(source, 'T8')).toEqual([]);
    expect(extractPythonExamples(source).map((row) => row.line)).toEqual([4, 15]);
  });
  it('失敗 fixture 不跨標題、不跨兩段說明，不忽略缺輸出', async () => {
    const issues = issuesFor(await fixture('T8-fail'), 'T8');
    expect(issues).toHaveLength(3);
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);
  });
  it('不讀註解、其他 fenced code 與 frontmatter 內的假 Python', () => {
    const source = '---\nnote: |\n  ```python\n---\n<!--\n```python\nprint(0)\n```\n-->\n````md\n```python\nprint(1)\n```\n````\n```python\nprint(2)\n```\n```text\n2\n```';
    expect(extractPythonExamples(source)).toHaveLength(1);
    expect(extractPythonExamples(source)[0].expected).toBe('2');
  });
  it('未閉合 fence、清單、提示框、圖、表與公式均不得當成一段說明', () => {
    for (const gap of ['- 項目', ':::tip[重點]', '![圖](x)', '| A |', '$$x$$', '> 引文']) {
      expect(extractPythonExamples('```python\nprint(1)\n```\n' + gap + '\n```text\n1\n```')[0].expected).toBeNull();
    }
    expect(extractPythonExamples('```python\nprint(1)')[0].expected).toBeNull();
    expect(extractPythonExamples('```python\nprint(1)\n```\n```text\n1')[0].expected).toBeNull();
  });
});

it('T3 讀碼重點不計入一頁三個提示框上限，其他標題照常計算', () => {
  const body = Array(3).fill(':::tip[重點]\n重點。\n:::').join('\n\n');
  expect(issuesFor(body + '\n\n:::tip[讀碼重點]\n讀碼。\n:::', 'T3')).toEqual([]);
  expect(issuesFor(body + '\n\n:::tip[其他]\n說明。\n:::', 'T3')).toHaveLength(1);
});
