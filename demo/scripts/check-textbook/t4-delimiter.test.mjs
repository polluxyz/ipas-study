/** 配對 fixture 鎖住公式分隔行與原始行號，避免 aligned 的首行被當成資訊而遺失。 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { checkConcept } from './concept.mjs';
const fixture = (name) => readFile(new URL(`./fixtures/T4-delimiter-${name}.md`, import.meta.url), 'utf8');
function issues(source) { return checkConcept(source, 'formula.md').filter((issue) => issue.rule === 'T4' && issue.message.includes('分隔符')); }
describe('T4 區塊公式分隔行', () => {
  it('獨立的 $$、行內公式、行內程式、fenced code 與註解均通過', async () => {
    expect(issues(await fixture('pass'))).toEqual([]);
  });
  it('開頭、結尾、單行公式與正文混寫均報錯，保留來源行號', async () => {
    const result = issues(await fixture('fail'));
    expect(result.map((issue) => issue.line)).toEqual([1, 3, 5, 8, 10]);
    expect(result.every((issue) => issue.severity === 'error')).toBe(true);
  });
  it('frontmatter 不查，縮排的獨立分隔行通過，補充內混寫仍查', () => {
    expect(issues('---\nsummary: "$$x=1$$"\n---\n  $$  \nx=1\n  $$')).toEqual([]);
    expect(issues(':::supplement[來源：文件]\n$$x=1$$\n:::').map((issue) => issue.line)).toEqual([2]);
  });
});
