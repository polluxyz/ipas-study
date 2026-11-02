/** 保留原始行號解析教材，讓內容問題能直接定位，並避免把程式碼當作標題或段落。 */
import { LineCounter, parseDocument } from 'yaml';

export function parseConcept(source) {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const end = lines[0] === '---' ? lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line)) : -1;
  const yaml = end > 0 ? lines.slice(1, end).join('\n') : '';
  const counter = new LineCounter();
  const document = parseDocument(yaml, { lineCounter: counter });
  const errors = document.errors.map((error) => ({ line: (error.linePos?.[0]?.line ?? 1) + 1, message: error.message.split('\n')[0] }));
  if (lines[0] === '---' && end < 0) errors.push({ line: 1, message: 'frontmatter 缺少結束分隔線。' });
  let data = {};
  if (!errors.length) {
    const parsed = document.toJS();
    if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) errors.push({ line: 2, message: 'frontmatter 必須是物件。' });
    else data = parsed ?? {};
  }
  function fieldLine(path) {
    const node = document.getIn(path, true);
    return node?.range ? counter.linePos(node.range[0]).line + 1 : 1;
  }
  const body = lines.slice(end > 0 ? end + 1 : 0).map((text, i) => ({ text, line: i + (end > 0 ? end + 2 : 1) }));
  return { data, errors, fieldLine, body };
}

export function markdownBlocks(body) {
  const prose = [];
  const code = [];
  const formulas = [];
  const formulaDelimiters = [];
  let fence;
  let formula;
  let comment = false;
  for (const row of body) {
    const match = row.text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (match && match[1][0] === fence.marker[0] && match[1].length >= fence.marker.length && /^\s*$/.test(row.text.slice(match[0].length))) {
        code.push(fence); fence = undefined;
      } else fence.rows.push(row);
      continue;
    }
    if (match) { fence = { marker: match[1], line: row.line, rows: [] }; prose.push({ text: '', line: row.line }); continue; }
    if (comment) {
      if (row.text.includes('-->')) comment = false;
      continue;
    }
    if (/^\s*<!--/.test(row.text)) { comment = !row.text.includes('-->'); continue; }
    // 區塊公式的資訊列不會當成公式內容；禁止把內容接在 $$ 開頭或結尾，行內程式範例除外。
    const markerText = formula ? row.text : row.text.replace(/(`+).*?\1/g, '').replace(/<!--[\s\S]*?-->/g, '');
    if (markerText.includes('$$') && markerText.trim() !== '$$') formulaDelimiters.push(row);
    if (formula) {
      if (row.text.includes('$$')) { formulas.push(formula); formula = undefined; }
      continue;
    }
    if (/^\s*\$\$/.test(row.text)) {
      const block = { line: row.line };
      if (row.text.trim().slice(2).includes('$$')) formulas.push(block);
      else formula = block;
      prose.push({ text: '', line: row.line }); continue;
    }
    prose.push(row);
  }
  if (fence) code.push(fence);
  if (formula) formulas.push(formula);
  return { prose, code, formulas, formulaDelimiters };
}

export function tableCells(line) {
  const cells = [];
  let value = '';
  let ticks = 0;
  const input = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) { value += input[i] + input[++i]; continue; }
    if (input[i] === '`') {
      const run = input.slice(i).match(/^`+/)[0].length;
      ticks = ticks === run ? 0 : ticks || run;
      value += '`'.repeat(run); i += run - 1; continue;
    }
    if (input[i] === '|' && !ticks) { cells.push(value.trim()); value = ''; }
    else value += input[i];
  }
  cells.push(value.trim());
  return cells;
}

export function isTableSeparator(text) {
  return text.includes('|') && tableCells(text).every((cell) => /^:?-{3,}:?$/.test(cell));
}
