/** 每條 T9 規則都有成對 fixture，並鎖住 T2、T3、T4、T8 對補充正文的既有檢查。 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { checkConcept } from './concept.mjs';
const fixture = (name) => readFile(new URL(`./fixtures/${name}.md`, import.meta.url), 'utf8');
const only = (source, rule) => checkConcept(source, 'fixture.md').filter((issue) => issue.rule === rule);
describe('T9 補充標示', () => {
  for (const [name, count, severity] of [['source', 3, 'error'], ['close', 1, 'error'], ['reference', 1, 'error'], ['duplicate', 1, 'warning']]) {
    it(`${name} 有通過與失敗 fixture，且保留行號與等級`, async () => {
      expect(only(await fixture(`T9-${name}-pass`), 'T9')).toEqual([]);
      const issues = only(await fixture(`T9-${name}-fail`), 'T9');
      expect(issues).toHaveLength(count);
      expect(issues.every((issue) => issue.severity === severity && issue.line > 0)).toBe(true);
    });
  }
  it('不把程式字串、註解和公式內的 ::: 當作補充標記', () => {
    expect(only('~~~text\n:::supplement\n### 參考來源（補充）\n~~~\n<!--\n:::supplement\n-->\n$$\n:::supplement\n$$', 'T9')).toEqual([]);
  });
  it('T2 不把來源當標題，T3 不把補充當提示框，也不計入來源字數', () => {
    const source = `---\nsummary: 摘要\ngoals: [{ id: g1, text: 目標 }]\n---\n## 直覺\n${Array.from({ length: 4 }, () => `:::supplement[來源：${'長'.repeat(120)}]\n短段落。\n:::`).join('\n\n')}`;
    expect(only(source, 'T2')).toEqual([]); expect(only(source, 'T3')).toEqual([]);
    expect(only(source.replace('短段落。', '字'.repeat(91)), 'T3')).toHaveLength(1);
    expect(only(source.replaceAll(':::supplement', ':::note'), 'T3')).toHaveLength(1);
  });
  it('補充正文仍檢查 T2 標題、T4 公式與 T8 輸出，不跨補充邊界配對', () => {
    expect(only(':::supplement[來源：文件]\n## 未知標題\n:::', 'T2').some((issue) => issue.message.includes('未知標題'))).toBe(true);
    expect(only(':::supplement[來源：文件]\n$$\nx=1\n$$\n:::', 'T4')).toHaveLength(1);
    const fields = '---\ntextbook: v2\n---\n';
    expect(only(fields + ':::supplement[來源：文件]\n~~~python\nprint(1)\n~~~\n~~~text\n1\n~~~\n:::', 'T8')).toEqual([]);
    expect(only(fields + ':::supplement[來源：文件]\n~~~python\nprint(1)\n~~~\n:::\n~~~text\n1\n~~~', 'T8')).toHaveLength(1);
  });
});
