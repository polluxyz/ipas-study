/** 驗證側欄結構、路線順序與主責上下文；實際連結另以建置後頁面驗證。 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildStudySidebar } from './sidebar';
import { resolveRouteContext } from './navigation';

const routes = [
  { code: 'L21101', subject: 1, title: '自然語言', concepts: ['first'], stages: [
    { id: 'a', title: '基礎', concepts: [{ id: 'first' }, { id: 'missing' }] },
    { id: 'b', title: '應用', concepts: [{ id: 'second' }] },
  ] },
  { code: 'L23303', subject: 3, title: '模型驗證', concepts: ['second'], stages: [
    { id: 'c', title: '評估', concepts: [{ id: 'second' }] },
  ] },
];
const titles = new Map([['first', '第一節'], ['second', '第二節']]);

describe('學習側欄', () => {
  it('首頁六個入口後只有兩個預設收合的科目，代碼直接指向路線', () => {
    const sidebar = buildStudySidebar(routes, undefined, titles);
    expect(sidebar.map(({ label }) => label)).toEqual(['學習總覽', '概念目錄', '概念地圖', '我的錯題本', '每日 50 題', '官方題完整練習', '科目 1', '科目 3']);
    expect(sidebar.slice(6)).toEqual([
      { label: '科目 1', collapsed: true, items: [{ label: 'L21101 自然語言', link: '/codes/L21101/' }] },
      { label: '科目 3', collapsed: true, items: [{ label: 'L23303 模型驗證', link: '/codes/L23303/' }] },
    ]);
  });

  it('路線與概念主責上下文的階段排在科目前，過濾缺頁但保留章節順序', () => {
    for (const location of [{ pathname: '/codes/L21101/' }, { pathname: '/practice/L21101/' }, { pathname: '/concepts/first/' }, { pathname: '/questions/q/' }]) {
      const current = resolveRouteContext(location, routes, [{ id: 'first', codes: ['L21101', 'L23303'] }], [{ id: 'q', codes: ['L21101'] }]);
      const sidebar = buildStudySidebar(routes, current, titles);
      expect(sidebar.map(({ label }) => label)).toEqual(['學習總覽', '概念目錄', '概念地圖', '我的錯題本', '每日 50 題', '官方題完整練習', 'L21101 自然語言', '科目 1', '科目 3']);
      expect(sidebar[6]).toEqual({ label: 'L21101 自然語言', items: [
        { label: '一、基礎', collapsed: true, items: [{ label: '第一節', link: '/concepts/first/' }] },
        { label: '二、應用', collapsed: true, items: [{ label: '第二節', link: '/concepts/second/' }] },
      ] });
      expect(sidebar[7]).toMatchObject({ collapsed: false });
      expect(sidebar[8]).toMatchObject({ collapsed: true });
    }
  });

  it('正式 21 條路線各出現一次，科目內順序與輸入一致', () => {
    const dir = new URL('../../../content/codes/', import.meta.url);
    const actual = readdirSync(dir).filter((name) => name.endsWith('.md')).sort().map((name) => parse(readFileSync(new URL(name, dir), 'utf8').split(/^---\s*$/m)[1]) as typeof routes[number]);
    const groups = buildStudySidebar(actual, undefined, titles).slice(6);
    expect(actual).toHaveLength(21);
    for (const [index, subject] of [1, 3].entries()) {
      expect(groups[index]).toMatchObject({ label: `科目 ${subject}`, collapsed: true, items: actual.filter((route) => route.subject === subject).map((route) => ({ label: `${route.code} ${route.title}`, link: `/codes/${route.code}/` })) });
    }
  });
});
