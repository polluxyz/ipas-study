/** 從唯讀來源建立分析表；先完整驗證，再一起發布兩表，避免失敗留下半套結果。 */
import * as fs from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const QUESTION_HEADER = ['場次', '科目', '題號', '答案', '代碼', '題型', '關鍵概念', '指引頁碼'];
const RELATION_HEADER = ['from_id', 'type', 'to_id', 'note', 'source_refs'];
const RELATION_TYPES = ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GUIDE = /^guide-[13]:\d+-\d+$/;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function requireValue(condition, location, message) {
  if (!condition) throw new Error(`${location}: ${message}`);
}
function text(value, location) {
  requireValue(typeof value === 'string' && value.trim().length > 0, location, '必須是非空字串');
  return value;
}
function strings(value, location, { optional = false, nonempty = false } = {}) {
  if (value === undefined && optional) return [];
  requireValue(Array.isArray(value) && (!nonempty || value.length > 0), location, '必須是字串陣列');
  return value.map((entry, index) => text(entry, `${location}[${index}]`));
}
function yaml(document, frontmatter = false) {
  let source = document.text;
  if (frontmatter) {
    const match = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    requireValue(match, document.path, '缺少或未閉合的 frontmatter');
    source = match[1];
  }
  let data;
  try { data = parse(source); }
  catch (error) { throw new Error(`${document.path}: YAML 解析失敗：${error.message}`, { cause: error }); }
  requireValue(data && typeof data === 'object' && !Array.isArray(data), document.path, 'YAML 必須是物件');
  return data;
}

/** 嚴格解析 CSV，保留引號內的換行與空白，拒絕會造成錯欄的引號語法。 */
export function parseCsv(input) {
  const source = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', state = 'plain';
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (state === 'quoted') {
      if (char !== '"') field += char;
      else if (source[index + 1] === '"') { field += '"'; index++; }
      else state = 'closed';
      continue;
    }
    if (char === ',') { row.push(field); field = ''; state = 'plain'; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(field); rows.push(row); row = []; field = ''; state = 'plain';
    } else if (char === '"' && state === 'plain' && field === '') state = 'quoted';
    else {
      requireValue(state !== 'closed' && char !== '"', 'concept-index.csv', 'CSV 引號格式錯誤');
      field += char;
    }
  }
  requireValue(state !== 'quoted', 'concept-index.csv', 'CSV 引號未閉合');
  if (row.length || field.length || state === 'closed') { row.push(field); rows.push(row); }
  return rows;
}

export function serializeCsv(rows) {
  return rows.map(row => row.map(value => {
    const cell = String(value);
    return /[,"\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }).join(',')).join('\n') + '\n';
}

/** 純函式只接收來源文字；不依 review 狀態篩題，也不推導或去重任何宣告。 */
export function buildAnalysis({ conceptIndex, questions, concepts }) {
  const [header = [], ...indexRows] = parseCsv(conceptIndex);
  for (const name of ['id', 'title']) requireValue(header.filter(field => field === name).length === 1, 'concept-index.csv', `缺少或重複欄位 ${name}`);
  const titles = new Map();
  for (const [index, row] of indexRows.entries()) {
    const location = `concept-index.csv 第${index + 2}列`;
    requireValue(row.length === header.length, location, '欄數不符');
    const id = text(row[header.indexOf('id')], `${location} id`);
    const title = text(row[header.indexOf('title')], `${location} title`);
    requireValue(ID.test(id) && !titles.has(id), location, `無效或重複概念 ID ${id}`);
    requireValue(!title.includes(';'), location, '概念標題不得含分號');
    titles.set(id, title);
  }
  const questionIds = new Set();
  const parsedQuestions = questions.map(document => {
    const data = yaml(document);
    const id = text(data.id, `${document.path} id`);
    requireValue(!questionIds.has(id), document.path, `重複題目 ID ${id}`);
    questionIds.add(id);
    requireValue(['exam', 'mock', 'guide'].includes(data.source), document.path, '缺少或無效的 source');
    return { data, location: document.path };
  });
  const parsedConcepts = concepts.map(document => ({ data: yaml(document, true), location: document.path }));
  const conceptIds = new Set();
  for (const { data, location } of parsedConcepts) {
    const id = text(data.id, `${location} id`);
    requireValue(ID.test(id) && !conceptIds.has(id), location, `無效或重複概念 ID ${id}`);
    requireValue(titles.has(id), location, `概念總表沒有 ID ${id}`);
    conceptIds.add(id);
  }
  function knownConcept(id, location) {
    requireValue(titles.has(id) && conceptIds.has(id), location, `未知概念 ${id}`);
  }
  const excluded = new Map(), sessions = new Map(), conceptCountExceptions = [];
  const examQuestions = [];
  for (const { data, location } of parsedQuestions) {
    if (data.source !== 'exam') { excluded.set(data.source, (excluded.get(data.source) ?? 0) + 1); continue; }
    requireValue(typeof data.session === 'string' && /^\d+-\d+$/.test(data.session), location, '缺少或無效的 session');
    requireValue([1, 3].includes(data.subject), location, 'subject 必須是 1 或 3');
    requireValue(Number.isSafeInteger(data.number) && data.number > 0, location, 'number 必須是正整數');
    requireValue(data.id === `${data.session}-S${data.subject}-Q${String(data.number).padStart(2, '0')}`, location, '題目 ID 與場次、科目、題號不符');
    requireValue(['A', 'B', 'C', 'D'].includes(data.answer), location, '缺少或無效的 answer');
    requireValue(['觀念', '情境', '計算', '程式', '圖表'].includes(data.type), location, '缺少或無效的 type');
    const codes = strings(data.codes, `${location} codes`, { nonempty: true });
    requireValue(codes.every(code => /^L2[13]\d{3}$/.test(code)), location, '無效的評鑑代碼');
    const ids = strings(data.concepts, `${location} concepts`, { nonempty: true });
    ids.forEach(id => knownConcept(id, location));
    const refs = strings(data.guide_refs, `${location} guide_refs`, { optional: true });
    requireValue(refs.every(ref => GUIDE.test(ref)), location, '無效的 guide_refs');
    if (ids.length < 2 || ids.length > 4) conceptCountExceptions.push(data.id);
    const sessionKey = `${data.session}-S${data.subject}`;
    sessions.set(sessionKey, (sessions.get(sessionKey) ?? 0) + 1);
    examQuestions.push({ data, row: [data.session, data.subject, data.number, data.answer, codes.join(';'), data.type, ids.map(id => titles.get(id)).join(';'), refs.join(';')] });
  }
  examQuestions.sort((a, b) => {
    const [ay, at] = a.data.session.split('-').map(Number), [by, bt] = b.data.session.split('-').map(Number);
    return ay - by || at - bt || a.data.subject - b.data.subject || a.data.number - b.data.number;
  });
  const relations = [];
  for (const { data, location } of parsedConcepts) {
    for (const type of RELATION_TYPES) {
      if (data[type] === undefined) continue;
      requireValue(Array.isArray(data[type]), location, `${type} 必須是陣列`);
      const targets = new Set();
      for (const entry of data[type]) {
        let target, note = '', refs = [];
        if (RELATION_TYPES.indexOf(type) < 3) target = text(entry, `${location} ${type}`);
        else {
          requireValue(entry && typeof entry === 'object' && !Array.isArray(entry), location, `${type} 必須使用物件`);
          target = text(entry.target, `${location} ${type} target`);
          if (type === 'contrasts') note = text(entry.note, `${location} ${type} note`);
          else if (entry.note !== undefined) {
            requireValue(typeof entry.note === 'string', location, `${type} note 必須是字串`);
            note = entry.note;
          }
          refs = strings(entry.source, `${location} ${type} source`, { nonempty: true });
          requireValue(refs.every(ref => GUIDE.test(ref) || questionIds.has(ref)), location, `${type} source 指向無效來源`);
        }
        knownConcept(target, location);
        requireValue(!targets.has(target), location, `${type} 重複宣告 ${target}`);
        targets.add(target);
        relations.push([data.id, type, target, note, refs.join(';')]);
      }
    }
  }
  relations.sort((a, b) => compare(a[0], b[0]) || RELATION_TYPES.indexOf(a[1]) - RELATION_TYPES.indexOf(b[1]) || compare(a[2], b[2]));
  return {
    questionsCsv: serializeCsv([QUESTION_HEADER, ...examQuestions.map(q => q.row)]),
    relationsCsv: serializeCsv([RELATION_HEADER, ...relations]),
    summary: {
      questions: examQuestions.length, relations: relations.length,
      sessions: Object.fromEntries([...sessions].sort(([a], [b]) => compare(a, b))),
      excluded: Object.fromEntries([...excluded].sort(([a], [b]) => compare(a, b))),
      conceptCountExceptions: conceptCountExceptions.sort(compare),
    },
  };
}

async function documents(folder, extension) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return documents(path, extension);
    return extension.test(entry.name) ? [{ path, text: await fs.readFile(path, 'utf8') }] : [];
  }));
  return nested.flat().sort((a, b) => compare(a.path, b.path));
}

/** 先寫暫存與備份；若任一發布失敗，還原本次已替換的檔案。io 可注入寫入失敗測試。 */
export async function writeAnalysis(outputDir, result, io = fs) {
  await io.mkdir(outputDir, { recursive: true });
  const staging = await io.mkdtemp(join(outputDir, '.analysis-export-'));
  const published = [], previous = new Set();
  let recoveryFailed = false;
  const outputs = [['questions.csv', result.questionsCsv], ['relations.csv', result.relationsCsv]];
  try {
    for (const [name, csv] of outputs) {
      try {
        const prior = await io.readFile(join(outputDir, name));
        await io.writeFile(join(staging, `${name}.old`), prior);
        previous.add(name);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await io.writeFile(join(staging, name), csv, 'utf8');
    }
    try {
      for (const [name] of outputs) {
        await io.rename(join(staging, name), join(outputDir, name));
        published.push(name);
      }
    } catch (error) {
      const recoveryErrors = [];
      for (const name of published.reverse()) {
        try {
          if (previous.has(name)) await io.rename(join(staging, `${name}.old`), join(outputDir, name));
          else await io.unlink(join(outputDir, name));
        } catch (recoveryError) { recoveryErrors.push(recoveryError); }
      }
      if (recoveryErrors.length) {
        recoveryFailed = true;
        throw new AggregateError([error, ...recoveryErrors], `發布與還原皆失敗，備份保留在 ${staging}`);
      }
      throw error;
    }
  } finally {
    if (!recoveryFailed) {
      for (const name of await io.readdir(staging)) await io.unlink(join(staging, name));
      await io.rmdir(staging);
    }
  }
}

export async function exportAnalysis({ contentDir, outputDir } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  contentDir ??= join(root, 'content');
  outputDir ??= join(root, 'analysis');
  const [conceptIndex, questions, concepts] = await Promise.all([
    fs.readFile(join(contentDir, 'concept-index.csv'), 'utf8'),
    documents(join(contentDir, 'questions'), /\.ya?ml$/),
    documents(join(contentDir, 'concepts'), /\.md$/),
  ]);
  const result = buildAnalysis({ conceptIndex, questions, concepts });
  await writeAnalysis(outputDir, result);
  return result.summary;
}

export function formatSummary(summary) {
  return `分析匯出：考古題 ${summary.questions} 題；關係 ${summary.relations} 條。\n` +
    `各卷：${Object.entries(summary.sessions).map(([key, count]) => `${key}=${count}`).join('、')}。\n` +
    `排除來源：${Object.entries(summary.excluded).map(([key, count]) => `${key}=${count}`).join('、') || '無'}。\n` +
    `概念數不在 2–4：${summary.conceptCountExceptions.length} 題（完整保留）。\n`;
}

export async function main(args = process.argv.slice(2), io = process) {
  if (args.length === 1 && args[0] === '--help') { io.stdout.write('用法：node demo/scripts/export-analysis.mjs\n'); return 0; }
  if (args.length) { io.stderr.write(`未知參數：${args.join(' ')}\n`); return 2; }
  try { io.stdout.write(formatSummary(await exportAnalysis())); return 0; }
  catch (error) { io.stderr.write(`分析匯出失敗：${error.message}\n`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
