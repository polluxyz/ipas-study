/** 教材規則只讀概念頁；骨架採漸進遷移，其他資料錯誤不因舊版教材而被隱藏。 */
import { markdownBlocks, parseConcept, tableCells, isTableSeparator } from './markdown.mjs';
import { checkT7 } from './self-check.mjs';
import { extractPythonExamples } from './python.mjs';
import { checkSupplements } from './supplement.mjs';

function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function checkConcept(source, file, figureIds = new Set()) {
  const parsed = parseConcept(source);
  const { data, body, fieldLine } = parsed;
  const issues = [];
  const add = (rule, line, message, severity = 'error') => issues.push({ rule, severity, file, line, message });
  for (const error of parsed.errors) add('PARSE', error.line, error.message);
  if (parsed.errors.length) return issues;
  const blocks = markdownBlocks(body);
  checkSupplements(blocks.prose, add);
  for (const row of blocks.formulaDelimiters) add('T4', row.line, '區塊公式的 $$ 分隔符必須獨立成行，不可與公式內容寫在同一行。');

  let relatedDepth = 0;
  for (const row of body) {
    const heading = row.text.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading && relatedDepth && heading[1].length <= relatedDepth) relatedDepth = 0;
    if (heading && /^(相關考古題|相關考題)(?:連結)?$/.test(heading[2])) relatedDepth = heading[1].length;
    // 只豁免連結區內的純連結；不能把解析文字藏到「相關考題」標題下。
    if (relatedDepth && /^\s*(?:[-*+]\s*)?\[[^\]]+\]\([^\s)]+\)\s*$/.test(row.text)) continue;
    if (/\b\d{3}-\d+-S[13]-Q\d{1,3}\b|第\s*(?:\d+(?:\s*[–—~～至、,\-]\s*\d+)*|[一二三四五六七八九十百]+)\s*題|\b\d{3}\s*[-－]\s*\d+\s*科(?:目)?\s*[13]/u.test(row.text)) add('T1', row.line, '教材正文含考題 ID、題號或場次引用。');
  }

  const severity = data.textbook === 'v2' ? 'error' : 'warning';
  if (!text(data.summary)) add('T2', fieldLine(['summary']), '缺少非空白 summary。', severity);
  if (!Array.isArray(data.goals) || !data.goals.length) add('T2', fieldLine(['goals']), '缺少非空白 goals。', severity);
  const goalIds = new Set();
  if (Array.isArray(data.goals)) data.goals.forEach((goal, i) => {
    if (!object(goal) || !text(goal.id) || !text(goal.text)) add('T2', fieldLine(['goals', i]), 'goals 每項必須有 id 與 text。', severity);
    else if (goalIds.has(goal.id)) add('T2', fieldLine(['goals', i, 'id']), `goals id 重複：${goal.id}。`, severity);
    else goalIds.add(goal.id);
  });
  const names = ['為什麼需要', '直覺', '定義與公式', '算一次', '程式', '怎麼用、怎麼判讀', '常見誤解', '進階', '小結'];
  let previous = -1;
  for (const row of blocks.prose) {
    const heading = row.text.match(/^ {0,3}##\s+(.+?)\s*#*$/);
    if (!heading) continue;
    const name = heading[1].replace(/\s*（補充）$/, '');
    const order = names.indexOf(name === '走一次流程' ? '算一次' : name);
    if (order < 0) add('T2', row.line, `不允許的二級標題：${heading[1]}。`, severity);
    else {
      if (order <= previous) add('T2', row.line, `二級標題重複或順序錯誤：${heading[1]}。`, severity);
      previous = Math.max(previous, order);
    }
  }

  checkReadability(blocks, add);
  if (blocks.formulas.length && (!Array.isArray(data.formula_groups) || !data.formula_groups.length)) add('T4', blocks.formulas[0].line, '有區塊公式卻沒有非空白 formula_groups。');
  if (data.formula_groups !== undefined && !Array.isArray(data.formula_groups)) add('T4', fieldLine(['formula_groups']), 'formula_groups 必須是陣列。');
  const formulaIds = new Set();
  if (Array.isArray(data.formula_groups)) data.formula_groups.forEach((group, i) => {
    const line = fieldLine(['formula_groups', i]);
    if (!object(group) || !text(group.id) || !text(group.source)) { add('T4', line, '每個公式群必須有非空白 id 與 source。'); return; }
    if (formulaIds.has(group.id)) add('T4', line, `公式群 id 重複：${group.id}。`);
    formulaIds.add(group.id);
    if (!['pending', 'verified'].includes(group.status)) add('T4', line, '公式群 status 必須是 pending 或 verified。');
    if (!Object.hasOwn(group, 'checked_by') || (group.status === 'verified' && !text(group.checked_by))) add('T4', line, '公式群必須記錄 checked_by；verified 時不可空白。');
  });

  for (const row of blocks.prose) {
    for (const match of row.text.matchAll(/!\[([^\]]*)\]\(figure:([^\s)]*)(?:\s+"[^"]*")?\)/g)) {
      if (!match[1].trim()) add('T5', row.line, 'figure 圖說／替代文字不可空白。');
      if (!figureIds.has(match[2])) add('T5', row.line, `找不到圖 ID：${match[2] || '（空白）'}。`);
    }
  }
  checkSelfCheck(data.self_check, goalIds, fieldLine, add);
  checkT7(data, fieldLine, add);
  if (data.textbook === 'v2') for (const example of extractPythonExamples(source)) {
    if (example.expected === null) add('T8', example.line, 'python 區塊後必須接 text 輸出區塊，中間僅可有空白與一段說明文字。');
  }
  return issues;
}

function checkReadability(blocks, add) {
  const rows = blocks.prose;
  const callouts = rows.filter((row) => /^\s*:::(tip|caution|note)(?:\[|\s|$)/.test(row.text) && !/^\s*:::(tip|caution|note)\[讀碼重點\]\s*$/.test(row.text));
  if (callouts.length > 3) add('T3', callouts[3].line, `一頁有 ${callouts.length} 個提示框，超過 3 個。`, 'warning');
  for (const block of blocks.code) if (block.rows.length > 15) add('T3', block.line, `程式區塊有 ${block.rows.length} 行，超過 15 行。`, 'warning');
  let paragraph = [];
  function flush() {
    if (!paragraph.length) return;
    const value = paragraph.map((row) => row.text).join(' ').replace(/!?(\[([^\]]+)\])\([^)]*\)/g, '$2').replace(/[`*_>#]/g, '').trim();
    const characters = [...value.replace(/\s/g, '')].length;
    const sentences = value.split(/[。！？!?]+|\.(?:\s+|$)/).filter((part) => part.trim()).length;
    if (characters > 90 || sentences > 4) add('T3', paragraph[0].line, `段落約 ${characters} 字、${sentences} 句（試行上限 90 字、4 句）。`, 'warning');
    paragraph = [];
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i + 1 < rows.length && isTableSeparator(rows[i + 1].text) && row.text.includes('|')) {
      flush();
      let columns = tableCells(row.text).length;
      let count = 0;
      let j = i + 2;
      while (j < rows.length && rows[j].text.trim() && rows[j].text.includes('|')) { columns = Math.max(columns, tableCells(rows[j].text).length); count++; j++; }
      if (columns > 4 || count > 6) add('T3', row.line, `表格有 ${columns} 欄、${count} 列資料，超過 4 欄或 6 列。`, 'warning');
      i = j - 1; continue;
    }
    if (!row.text.trim() || /^\s*(?:#{1,6}\s|:::|(?:[-*_]\s*){3,}$|!\[)/.test(row.text)) { flush(); continue; }
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(row.text)) flush();
    paragraph.push(row);
  }
  flush();
}

function checkSelfCheck(checks, goalIds, fieldLine, add) {
  if (checks === undefined) return;
  if (!Array.isArray(checks)) { add('SELF_CHECK', fieldLine(['self_check']), 'self_check 必須是陣列。'); return; }
  const ids = new Set();
  checks.forEach((check, i) => {
    const line = fieldLine(['self_check', i]);
    const report = (message) => add('SELF_CHECK', line, message);
    if (!object(check)) { report('檢核小題必須是物件。'); return; }
    if (!text(check.id) || ids.has(check.id)) report('檢核小題 id 必須非空白且不可重複。');
    ids.add(check.id);
    if (!text(check.prompt)) report('檢核小題必須有非空白 prompt。');
    if (!goalIds.has(check.goal)) report(`檢核小題 goal 不存在：${check.goal ?? '（空白）'}。`);
    if (check.type === 'choice') {
      if (!object(check.options) || Object.keys(check.options).length < 2 || !Object.values(check.options).every(text)) { report('choice 題 options 至少有兩個非空白選項。'); return; }
      if (!text(check.answer) || !Object.hasOwn(check.options, check.answer)) report('choice 題 answer 必須是 options 中的鍵。');
      if (!object(check.explain) || !Object.keys(check.options).every((key) => text(check.explain[key]))) report('choice 題 explain 必須涵蓋每個選項且不可空白。');
    } else if (check.type === 'short') {
      if (!Array.isArray(check.key_points) || !check.key_points.length || !check.key_points.every(text)) report('short 題必須有非空白 key_points 陣列。');
    } else report('檢核小題 type 必須是 choice 或 short。');
  });
}
