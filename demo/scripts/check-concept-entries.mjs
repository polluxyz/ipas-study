/**
 * 固定25頁只提供成功條件7的技術證據；C12另計，教學目的與排除理由須非作者主審。
 * 純檢查不讀寫檔案；CLI才載入凍結來源及真建置收據，不開伺服器或修改內容。
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APPROVED_IDS = Object.freeze([
  'ai-team-capability', 'cyclic-time-features', 'multimodal-privacy-security', 'ndcg',
  'open-weight-models', 'text-generation-platforms', 'development-toolchain', 'text-generation-workflow',
  'color-space-conversion', 'data-consistency', 'data-types-time-parsing', 'feedback-loop',
  'financial-regulatory-sandbox', 'generative-quality-metrics', 'high-availability', 'image-resizing',
  'machine-translation', 'medical-device-regulation', 'privacy-regulations', 'scrum',
  'speech-recognition-pipeline', 'telecom-regulation', 'video-frame-sampling', 'virginia-cdpa', 'visual-tracking',
]);
export const RELATION_TYPES = Object.freeze(['is_a', 'part_of', 'requires', 'mitigates', 'contrasts']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const shaPattern = /^[a-f0-9]{64}$/;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalize = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const nodeText = (node) => node?.type === 'text' ? node.value : (node?.children ?? []).map(nodeText).join('');

function authoredNodes(root, tags, { excludeLists = false } = {}) {
  const result = [];
  const visit = (node) => {
    const properties = node.properties ?? {};
    if (['nav', 'pre', 'code', 'script', 'style', 'template'].includes(node.tagName) || properties.role === 'navigation'
      || (excludeLists && ['ol', 'ul'].includes(node.tagName))) return;
    if (tags.includes(node.tagName)) result.push(node);
    node.children?.forEach(visit);
  };
  if (root) visit(root);
  return result;
}

/** 沿用Astro已安裝的HTML解析器；只有呼叫時才載入，匯入本模組沒有掃描副作用。 */
function htmlTools() {
  const require = createRequire(import.meta.resolve('@astrojs/markdown-remark'));
  return { ...require('hast-util-from-html'), ...require('hast-util-select') };
}

/** 所有期望均來自傳入的來源與固定證據；不從渲染結果倒推學習目的。 */
export function checkConceptEntries({ content, evidence, rendered, sourceFiles = {} }) {
  const issues = [];
  const add = (code, id, message) => issues.push({ code, id, message });
  const { fromHtml, select, selectAll } = htmlTools();
  const concepts = new Map(content.concepts.map((item) => [item.id, item]));
  const questions = new Map(content.questions.map((item) => [item.id, item]));
  const sources = new Map([...content.concepts, ...content.codes].map((item) => [item.file, item]));
  for (const [kind, list] of Object.entries({ concepts: content.concepts, questions: content.questions, codes: content.codes })) {
    if (new Set(list.map((item) => item.id ?? item.code)).size !== list.length) add('CONTENT_DUPLICATE', kind, '來源有重複ID');
  }
  const trees = new Map();
  const renderedHashes = {};
  for (const item of sources.values()) {
    const html = rendered[item.file];
    if (!nonempty(html)) { add('RENDER_MISSING', item.id ?? item.code, '缺少實際建置頁面'); continue; }
    trees.set(item.file, fromHtml(html));
    renderedHashes[item.file] = sha256(html);
    if (item.id && !select('#concept-body', trees.get(item.file))) add('BODY_MISSING', item.id, '缺少概念正文容器');
  }
  const edges = content.concepts.flatMap((item) => RELATION_TYPES.flatMap((type) => (item[type] ?? []).map((edge) => ({ from: item.id, type, to: typeof edge === 'string' ? edge : edge.target }))));
  for (const edge of edges) if (!concepts.has(edge.to)) add('RELATION_TARGET', edge.from, `關係目標不存在：${edge.to}`);
  for (const question of questions.values()) for (const id of question.concepts ?? []) if (!concepts.has(id)) add('QUESTION_TARGET', question.id, `題目概念不存在：${id}`);
  const incoming = new Map([...concepts.keys()].map((id) => [id, new Set()]));
  for (const concept of concepts.values()) {
    const body = select('#concept-body', trees.get(concept.file) ?? { type: 'root', children: [] });
    for (const anchor of authoredNodes(body, ['a'])) {
      // C12只取其他概念的正文入鏈，路線、搜尋、頁尾關係與self_check不列入。
      const match = String(anchor.properties?.href ?? '').match(/^\/concepts\/([a-z0-9-]+)\/(?:#[^?]*)?$/);
      if (match && match[1] !== concept.id) incoming.get(match[1])?.add(concept.id);
    }
  }
  const states = [...concepts.keys()].sort().map((id) => ({
    id,
    questionIds: content.questions.filter((q) => (q.concepts ?? []).includes(id)).map((q) => q.id),
    edges: edges.filter((edge) => edge.from === id || edge.to === id),
    bodyIncoming: [...incoming.get(id)].sort(),
  }));
  const strongGaps = states.filter((item) => !item.questionIds.length && !item.edges.length);
  const c12Warnings = strongGaps.filter((item) => !item.bodyIncoming.length).map((item) => item.id);
  if (evidence?.version !== 1) add('EVIDENCE_VERSION', 'manifest', '證據版本必須為1');
  const records = Array.isArray(evidence?.entries) ? evidence.entries : [];
  const recordIds = records.map((item) => item.id);
  for (const id of new Set(recordIds)) {
    if (!APPROVED_IDS.includes(id)) add('UNKNOWN_ID', id, '不在核可的固定25頁清單');
    if (recordIds.filter((candidate) => candidate === id).length > 1) add('DUPLICATE_ID', id, '例外ID重複');
  }
  for (const id of APPROVED_IDS) if (!recordIds.includes(id)) add('MISSING_ID', id, '缺少核可頁面的證據列');
  const basisFiles = evidence?.basisFiles;
  if (!Array.isArray(basisFiles) || !basisFiles.length) add('BASIS', 'manifest', '缺少核可範圍及指引版本');
  for (const file of basisFiles ?? []) {
    if (!shaPattern.test(file.sha256 ?? '') || sourceFiles[file.file] === undefined || sha256(sourceFiles[file.file]) !== file.sha256) add('BASIS_HASH', file.file, '核可範圍或指引SHA不符');
  }
  const manifestValid = !issues.some((issue) => ['BASIS', 'BASIS_HASH', 'EVIDENCE_VERSION'].includes(issue.code));
  const results = [];
  for (const record of records) {
    const id = record.id;
    if (!APPROVED_IDS.includes(id) || recordIds.filter((candidate) => candidate === id).length !== 1) continue;
    const state = states.find((item) => item.id === id);
    if (!state) { add('TARGET_MISSING', id, '核可的概念頁不存在'); continue; }
    // 有題目或正式關係時，不再啟用例外，也不因舊例外SHA失效而阻擋一般規則。
    if (state.questionIds.length || state.edges.length) { results.push({ id, status: 'general-rule', ...state }); continue; }
    const start = issues.length;
    const target = concepts.get(id);
    const source = sources.get(record.source?.file);
    const verifyHash = (proof, actual, label) => {
      if (!actual || proof?.file !== actual.file || !shaPattern.test(proof?.sha256 ?? '') || proof.sha256 !== actual.fileSha256
        || sourceFiles[actual.file] === undefined || sha256(sourceFiles[actual.file]) !== proof.sha256) add('HASH', id, `${label}完整SHA或路徑不符`);
    };
    verifyHash(record.target, target, '目標');
    verifyHash(record.source, source, '入口來源');
    if (!trees.has(target.file) || !select('#concept-body', trees.get(target.file))) add('TARGET_RENDER', id, '目標缺少已建置的概念正文');
    if (source?.id === id) add('SELF_ENTRY', id, '不能用目標本身當入口');
    if (!nonempty(record.purpose)) add('PURPOSE', id, '缺少學習目的');
    if (!Array.isArray(record.basis) || !record.basis.length || record.basis.some((basis) => !nonempty(basis.ref) || !nonempty(basis.reason) || !(target.guide_refs ?? []).includes(basis.ref))) add('BASIS', id, '缺少目標頁可核對的指引依據');
    if (!Array.isArray(record.exclusions?.questions) || !record.exclusions.questions.length) add('EXCLUSIONS', id, '缺少題目近鄰排除理由');
    const checkCandidate = (candidate, pool) => {
      const actual = pool.get(candidate.id);
      if (!actual || !shaPattern.test(candidate.sha256 ?? '') || candidate.sha256 !== actual.fileSha256) add('NEIGHBOR_HASH', id, `近鄰不存在或SHA不符：${candidate.id}`);
    };
    for (const candidate of record.exclusions?.questions ?? []) {
      checkCandidate(candidate, questions);
      if (!nonempty(candidate.reason)) add('EXCLUSIONS', id, '題目近鄰缺少排除理由');
    }
    for (const type of RELATION_TYPES) {
      const exclusion = record.exclusions?.relations?.[type];
      if (!nonempty(exclusion?.reason) || !Array.isArray(exclusion?.candidates) || !exclusion.candidates.length) add('EXCLUSIONS', id, `缺少${type}近鄰排除理由`);
      for (const candidate of exclusion?.candidates ?? []) checkCandidate(candidate, concepts);
    }
    const href = `/concepts/${id}/`;
    if (record.href !== href) add('HREF', id, '入口href必須精確指向目標概念頁');
    const tree = source && trees.get(source.file);
    const location = record.location ?? {};
    let matched = false;
    if (location.kind === 'stage' && source?.code) {
      const stage = source.stages?.find((candidate) => candidate.id === location.stageId);
      const item = stage?.concepts?.find((candidate) => candidate.id === id);
      if (!stage || !item || !nonempty(item.goal) || !nonempty(stage.intro) || location.goal !== item.goal || location.intro !== stage.intro) add('STAGE_SOURCE', id, 'stage或學習目標與來源不符');
      const sections = tree ? selectAll('section[data-stage]', tree).filter((node) => node.properties.dataStage === location.stageId) : [];
      const rows = sections.length === 1 ? selectAll('li[data-route-concept]', sections[0]).filter((node) => node.properties.dataRouteConcept === id) : [];
      const anchor = rows.length === 1 ? select('a.route-concept', rows[0]) : undefined;
      matched = !!anchor && anchor.properties.href === href && normalize(nodeText(select('.route-goal', anchor))) === normalize(location.goal)
        && normalize(nodeText(select('.stage-intro', sections[0]))) === normalize(location.intro);
    } else if (location.kind === 'body' && source?.id) {
      const raw = sourceFiles[source.file];
      if (!Number.isSafeInteger(location.line) || !nonempty(location.sourceQuote) || raw?.split(/\r?\n/)[location.line - 1] !== location.sourceQuote || !source.body.includes(location.sourceQuote)) add('BODY_SOURCE', id, '正文行號或引句與來源不符');
      const body = tree && select('#concept-body', tree);
      // 只接受正文段落或表格列；目錄、搜尋、code、self_check不能冒充教學入口。
      const blocks = authoredNodes(body, ['p', 'tr'], { excludeLists: true });
      matched = nonempty(location.renderedContext) && blocks.some((node) => normalize(nodeText(node)) === normalize(location.renderedContext)
        && selectAll('a[href]', node).some((anchor) => anchor.properties.href === href && nonempty(nodeText(anchor))));
    } else add('LOCATION', id, '入口必須為概念正文或含學習目標的代碼stage');
    if (!matched) add('RENDER_ENTRY', id, '指定範圍未渲染出目的文字與實際href');
    const problemCount = issues.length - start + (manifestValid ? 0 : 1);
    results.push({ ...state, status: problemCount ? 'invalid-exception' : 'technically-valid-exception', href, source: record.source, target: record.target, location: record.location, problems: problemCount });
  }
  const validIds = results.filter((item) => item.status === 'technically-valid-exception').map((item) => item.id);
  const unexempted = strongGaps.filter((item) => !validIds.includes(item.id)).map((item) => item.id);
  for (const id of unexempted) add('UNEXEMPTED', id, '原強條件缺口沒有有效的固定例外技術證據');
  return {
    version: 1,
    counts: { concepts: content.concepts.length, questions: content.questions.length, examQuestions: content.questions.filter((q) => q.source === 'exam').length, codes: content.codes.length, relations: edges.length, byType: Object.fromEntries(RELATION_TYPES.map((type) => [type, edges.filter((edge) => edge.type === type).length])), c12Warnings: c12Warnings.length, rawStrongGaps: strongGaps.length, approvedLimit: APPROVED_IDS.length, technicallyValidExceptions: validIds.length, technicallyUnexempted: unexempted.length },
    c12Warnings, rawStrongGaps: strongGaps.map((item) => item.id), technicallyUnexempted: unexempted, results, issues, renderedHashes,
    semanticReview: 'pending-independent-non-author-review', finalAcceptance: 'pending-root-final-version-signoff',
    scope: '僅驗結構、版本與已建置入口；不驗排除理由的語意，不代表整站或其他成功條件通過。',
  };
}

/** CLI讀取實際位元組，先後核對既有建置收據；不接受只有來源字串的假渲染。 */
export async function checkBuiltConceptEntries({ root = resolve(import.meta.dirname, '../..'), evidencePath = resolve(root, 'docs/acceptance/concept-entry-exceptions.json'), buildReceipt }) {
  const { loadContent, readBuildReceipt, verifyBuildReceipt } = await import('./rollout-smoke.mjs');
  const binding = await readBuildReceipt(buildReceipt, root);
  const content = await loadContent(root);
  const evidenceBytes = await readFile(evidencePath);
  const evidenceSha256 = sha256(evidenceBytes);
  const evidence = JSON.parse(evidenceBytes.toString('utf8'));
  const rendered = {}, sourceFiles = {};
  const safeRead = async (file) => {
    if (typeof file !== 'string' || isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`不合法的來源路徑：${file}`);
    return readFile(resolve(root, file));
  };
  for (const item of [...content.concepts, ...content.codes, ...content.questions]) {
    const raw = await safeRead(item.file);
    if (sha256(raw) !== item.fileSha256) throw new Error(`讀取期間來源改變：${item.file}`);
    sourceFiles[item.file] = raw.toString('utf8');
  }
  for (const file of evidence.basisFiles ?? []) sourceFiles[file.file] = await safeRead(file.file);
  for (const item of [...content.concepts, ...content.codes]) {
    const path = `${item.id ? 'concepts' : 'codes'}/${item.id ?? item.code}/index.html`;
    try { rendered[item.file] = await readFile(resolve(root, 'demo/dist', path), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const report = checkConceptEntries({ content, evidence, rendered, sourceFiles });
  await verifyBuildReceipt(binding, root);
  if (sha256(await readFile(evidencePath)) !== evidenceSha256) throw new Error('檢查期間例外證據已改變');
  return { ...report, evidenceSha256, build: { sha: binding.receipt.sha, sourceDigest: binding.receipt.sourceDigest, distDigest: binding.receipt.distDigest, receiptDigest: binding.receiptDigest, started: binding.receipt.started, finished: binding.receipt.finished } };
}

export async function main(args = process.argv.slice(2), io = process) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--help') { io.stdout.write('用法：node demo/scripts/check-concept-entries.mjs --build-receipt <JSON> [--root <repo>] [--evidence <JSON>]\n離線fixture：--input <JSON>（content/evidence/rendered/sourceFiles）。結束碼0技術檢查無錯誤；1檢查失敗；2參數或讀取失敗。語意複審與Root簽核另行完成。\n'); return 0; }
    const name = { '--root': 'root', '--evidence': 'evidencePath', '--build-receipt': 'buildReceipt', '--input': 'input' }[key];
    if (!name || !args[i + 1] || args[i + 1].startsWith('--')) { io.stderr.write(`未知或不完整參數：${key}\n`); return 2; }
    options[name] = resolve(args[++i]);
  }
  if ((options.input && Object.keys(options).length !== 1) || (!options.input && !options.buildReceipt)) { io.stderr.write('實際建置須提供--build-receipt；離線--input不可混用建置參數。\n'); return 2; }
  try {
    const report = options.input ? checkConceptEntries(JSON.parse(await readFile(options.input, 'utf8'))) : await checkBuiltConceptEntries(options);
    io.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return report.issues.length ? 1 : 0;
  } catch (error) { io.stderr.write(`入口檢查執行失敗：${error.message}\n`); return 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
