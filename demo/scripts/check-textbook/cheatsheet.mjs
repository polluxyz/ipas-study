/** T10 以 Astro 的實際 Markdown 標題驗證速查連結，避免文字相似卻無法定位的小節通過檢查。 */
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { cheatsheetAnchor, conceptSection } from '../../src/lib/cheatsheets.mjs';
import { parseConcept } from './markdown.mjs';
import { checkConcept } from './concept.mjs';

export async function cheatsheetConceptIndex(pages) {
  const processor = await createMarkdownProcessor({ syntaxHighlight: false });
  return new Map(await Promise.all(pages.map(async ({ source }) => {
    const { data, body } = parseConcept(source);
    const rendered = await processor.render(body.map((row) => row.text).join('\n'));
    return [data.id, rendered.metadata.headings];
  })));
}

export async function checkCheatsheet(source, file, concepts) {
  const parsed = parseConcept(source);
  const issues = [];
  const add = (line, message) => issues.push({ rule: 'T10', severity: 'error', file, line, message });
  for (const error of parsed.errors) add(error.line, error.message);
  if (parsed.errors.length) return issues;
  if (!/^L2[13]\d{3}$/.test(parsed.data.code ?? '')) add(parsed.fieldLine(['code']), '速查 code 必須是有效的評鑑內容代碼。');
  if (typeof parsed.data.title !== 'string' || !parsed.data.title.trim()) add(parsed.fieldLine(['title']), '速查 title 不可空白。');
  // 沿用 T1 的全部比對與行號，但速查沒有「相關考題」豁免區。
  const examRows = checkConcept(source.replace(/^(#{1,6})\s+(相關考古題|相關考題)(?:連結)?\s*$/gm, '$1 禁止考題區'), file).filter((issue) => issue.rule === 'T1');
  for (const issue of examRows) add(issue.line, '速查不得出現考題 ID、題號或場次引用。');
  const processor = await createMarkdownProcessor({ syntaxHighlight: false });
  const rendered = await processor.render(parsed.body.map((row) => row.text).join('\n'));
  const headings = rendered.metadata.headings.filter((heading) => heading.depth === 2).map((heading) => heading.text);
  if (JSON.stringify(headings) !== JSON.stringify(['公式', '指標怎麼選', '診斷'])) add(1, '速查只能有依序排列的三個二級標題：公式、指標怎麼選、診斷。');
  for (const match of rendered.code.matchAll(/href="([^"]*)"/g)) {
    const href = match[1];
    const target = conceptSection(href);
    let decoded = href;
    try { decoded = decodeURI(href); } catch { /* 無效編碼仍會在下面回報為不合法連結。 */ }
    const sourceLine = parsed.body.find((row) => row.text.includes(href) || row.text.includes(decoded))?.line ?? 1;
    if (!target) { add(sourceLine, `速查連結必須指向概念頁小節：${href}。`); continue; }
    const headings = concepts.get(target.id);
    if (!headings) { add(sourceLine, `速查連結的概念 ID 不存在：${target.id}。`); continue; }
    const matches = headings.filter((heading) => heading.slug === target.anchor || cheatsheetAnchor(heading.text) === target.anchor.toLowerCase());
    if (matches.length !== 1) add(sourceLine, `速查連結的錨點不存在或不唯一：${href}。`);
  }
  return issues;
}
