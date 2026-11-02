/**
 * 全站回歸只讀凍結內容與既有 build；瀏覽器需協調者顯式安排，所有紀錄限新建 context。
 * 協調者在 repo 根目錄指定 --output tmp/<獨立目錄> --sha <HEAD> --build-sha <建置SHA>
 * --build-time <收據 finished> --build-receipt <JSON>；預設僅讀盤點，加 --execute 才啟動瀏覽器。
 * 協調者在真實 build 前用 --capture-build-source <新JSON>，build 後用
 * --write-build-receipt <新JSON> --source-snapshot <前述JSON>；本工具不執行 build／preview。
 * 先後串行執行原 smoke／map／figures／cheatsheet 後，可傳 --smoke-report、--map-report、
 * --figures-report、--cheatsheets-report 的 JSON 路徑；舊腳本需 SMOKE_OUTPUT／Q2_OUTPUT 與 BUILD_RECEIPT。
 * figures 不在本任務 ownership，協調者需以 {sha,buildSha,receiptDigest,report: 原報告} 封套
 * 留實際執行的 completed/browserErrors/externalRequests/assetFailures 證據，不可補造成功旗標。
 * 產物一律寫指定輸出目錄；未做人工看圖、缺舊版樣本或缺既有報告都保留未執行，不冒稱通過。
 * 純函式 fixtures：node demo/scripts/rollout-smoke.mjs --self-test（不連網、不開瀏覽器）。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import { chromium } from 'playwright';

export const TARGETS = Object.freeze({ concepts: 485, codes: 21, cheatsheets: 21, exam: 200 });
export const CELLS = [320, 375, 1440].flatMap((width) => ['light', 'dark'].map((theme) => ({ width, height: width === 1440 ? 1050 : 812, theme })));
export const EXPECTED_CODES = ['L21101', 'L21102', 'L21103', 'L21104', 'L21201', 'L21202', 'L21203', 'L21301', 'L21302', 'L23101', 'L23102', 'L23103', 'L23201', 'L23202', 'L23203', 'L23301', 'L23302', 'L23303', 'L23304', 'L23401', 'L23402'];
const root = resolve(import.meta.dirname, '../..');
const searchCases = [
  ['資料洩漏', 'data-leakage'], ['資料泄漏', 'data-leakage'], ['ROC', 'roc-auc'], ['AUC', 'roc-auc'], ['LoRA', 'lora'],
  ['過擬合', 'overfitting'], ['StratifiedKFold', 'stratified-k-fold'], ['梯度裁剪', 'gradient-clipping'],
  ['Statistical Parity', 'statistical-parity'], ['NIST AI RMF', 'nist-ai-rmf'],
];

/** 遞迴排序後讀取，讓清單／雜湊能重現；不產生內容或 Astro 索引。 */
async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesAt(resolve(directory, entry.name)) : [resolve(directory, entry.name)]));
  return groups.flat().sort();
}
export async function loadContent(repo = root) {
  const result = {};
  for (const kind of ['concepts', 'codes', 'cheatsheets', 'questions']) {
    result[kind] = [];
    for (const file of await filesAt(resolve(repo, 'content', kind))) {
      if (!(kind === 'questions' ? /\.ya?ml$/ : /\.md$/).test(file)) continue;
      const raw = await readFile(file, 'utf8');
      const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      assert.ok(kind === 'questions' || match, `缺少 frontmatter：${file}`);
      const data = parse(kind === 'questions' ? raw : match[1]);
      result[kind].push({ ...data, body: kind === 'questions' ? '' : raw.slice(match[0].length), file: relative(repo, file).split(sep).join('/'), fileSha256: hash(raw) });
    }
  }
  return result;
}

/** 固定門檻獨立於當前載入數，缺碼／缺題會留下具體 ID，模擬題不併入 exam。 */
export function contentProblems(content, revisions) {
  const problems = [];
  const concepts = new Set(content.concepts.map((item) => item.id));
  for (const [kind, expected] of Object.entries(TARGETS)) {
    const actual = kind === 'exam' ? content.questions.filter((q) => q.source === 'exam').length : content[kind].length;
    if (actual !== expected) problems.push(`${kind}：${actual}/${expected}`);
  }
  const expectedCodes = ['L21101', 'L21102', 'L21103', 'L21104', 'L21201', 'L21202', 'L21203', 'L21301', 'L21302', 'L23101', 'L23102', 'L23103', 'L23201', 'L23202', 'L23203', 'L23301', 'L23302', 'L23303', 'L23304', 'L23401', 'L23402'];
  for (const code of expectedCodes) for (const kind of ['codes', 'cheatsheets']) {
    if (content[kind].filter((item) => item.code === code).length !== 1) problems.push(`${kind} 缺少或重複 ${code}`);
  }
  for (const kind of ['concepts', 'codes', 'cheatsheets', 'questions']) {
    const ids = content[kind].map((item) => item.id ?? item.code);
    if (new Set(ids).size !== ids.length) problems.push(`${kind} 含重複 ID`);
  }
  for (const route of content.codes) {
    for (const id of route.concepts) if (!concepts.has(id)) problems.push(`${route.code} 缺概念 ${id}`);
    if (route.stages) {
      const ids = route.stages.flatMap((stage) => stage.concepts.map((item) => item.id));
      if (JSON.stringify(ids) !== JSON.stringify(route.concepts)) problems.push(`${route.code} 階段攤平順序不符`);
      if (new Set(route.stages.map((stage) => stage.id)).size !== route.stages.length) problems.push(`${route.code} 重複 stage ID`);
    }
  }
  const questions = new Map(content.questions.map((q) => [q.id, q]));
  for (const session of ['114-2', '115-1']) for (const subject of [1, 3]) for (let n = 1; n <= 50; n++) {
    const id = `${session}-S${subject}-Q${String(n).padStart(2, '0')}`;
    const q = questions.get(id);
    if (!q || q.source !== 'exam' || q.session !== session || q.subject !== subject || q.number !== n) problems.push(`缺考古題或場次資料錯誤 ${id}`);
  }
  for (const q of content.questions) {
    if (revisions[q.id] !== q.rev) problems.push(`${q.id} revisions ${revisions[q.id] ?? '缺'}/${q.rev}`);
    if (q.source === 'exam' && (!['verified', 'disputed'].includes(q.review?.status) || !q.review?.answer_checked?.by || !q.review?.answer_checked?.pdf_page || !q.review?.blind_answer)) problems.push(`${q.id} 缺審查證據`);
  }
  if (!questions.has('M-L23303-001')) problems.push('既有模擬題 M-L23303-001 遺失');
  return problems;
}

/** URL 限同一個 loopback origin；外部文獻可留作連結，但禁止請求。 */
export function localUrl(value, base) {
  const url = new URL(value, base);
  assert.equal(new URL(base).hostname, '127.0.0.1', 'origin 必須是 127.0.0.1');
  assert.equal(url.origin, new URL(base).origin, `禁止非本機同源請求 ${url.href}`);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.username + url.password, '');
  return url;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
export function chapterLabel(index, title) {
  const n = index + 1, digits = '零一二三四五六七八九';
  assert.ok(n > 0 && n < 100, '章節序號須介於 1–99');
  return `${n < 10 ? digits[n] : `${n < 20 ? '' : digits[Math.floor(n / 10)]}十${n % 10 ? digits[n % 10] : ''}`}、${title}`;
}

/** APIRequestContext 不受 browser route 保護，所以一律拒絕 redirect。 */
export async function localGet(request, value, base) {
  const response = await request.get(localUrl(value, base).href, { maxRedirects: 0 });
  assert.equal(response.status(), 200, `HTTP 非 200：${value}`);
  return response;
}

// 每個 context 的封口狀態只在明確安裝時建立，import 不觸發 I/O。
const buildContexts = new WeakMap();
function buildContextState(context) {
  if (!buildContexts.has(context)) buildContexts.set(context, { accepting: true, routes: new Set(), failures: [], expected: [] });
  return buildContexts.get(context);
}
/** 唯一容許的故障回應：舊 smoke 明確探測不存在的教材 fixture；不放寬其他 404。 */
export function expectedTextbook404(response, base) {
  return response.status() === 404 && localUrl(response.url(), base).pathname === '/test-fixtures/textbook/';
}
/** 先驗 URL、status 與收據 bytes 才 fulfill；封口後不再發出新 HTTP，並追蹤整個 handler。 */
export async function routeLocalOnly(context, base, external, failures) {
  const state = buildContextState(context);
  await context.route('**/*', (route) => {
    const value = route.request().url();
    const task = (async () => {
      if (!state.accepting) return route.abort(); // 封口是同步狀態轉換，沒有下一次 fetch 的空窗。
      if (!/^https?:/i.test(value)) return route.continue(); // data／blob 不會產生 HTTP 出站。
      let response;
      try {
        try { localUrl(value, base); } catch (error) { external.push(value); throw error; }
        response = await route.fetch({ maxRedirects: 0 });
        localUrl(response.url(), base);
        assert.ok(response.status() < 300 || response.status() >= 400, `禁止 redirect HTTP ${response.status()}：${value} → ${response.headers().location ?? ''}`);
        if (response.status() !== 200) {
          assert.ok(state.allowTextbook404 && expectedTextbook404(response, base), `HTTP 非 200：${response.status()} ${value}`);
          state.expected.push({ url: response.url(), status: response.status(), phase: 'route' });
        } else if (state.binding) await verifyResponseBytes(response, state.binding, base);
        await route.fulfill({ response });
      } catch (error) {
        failures.push({ url: value, error: String(error) });
        state.failures.push(String(error));
        await route.abort().catch(() => undefined);
      } finally { await response?.dispose(); }
    })().catch((error) => { failures.push({ url: value, error: String(error) }); state.failures.push(String(error)); });
    state.routes.add(task);
    task.finally(() => state.routes.delete(task));
    return task;
  });
}

/** 輸出使用獨立新目錄，避免覆寫上一輪成功或失敗證據。 */
export async function freshOutput(directory, repo = root) {
  const destination = resolve(directory), inside = relative(resolve(repo, 'tmp'), destination);
  assert.ok(inside && !inside.startsWith('..') && !inside.includes(':'), '輸出須為本 worktree tmp 子目錄');
  await mkdir(resolve(destination, '..'), { recursive: true });
  await mkdir(destination); // EEXIST 必須停止，不能合併舊證據。
  return destination;
}

const sourcePaths = ['content', 'demo/src', 'demo/public', 'demo/plugins', 'demo/scripts', 'demo/astro.config.mjs', 'demo/tsconfig.json', 'demo/package.json', 'demo/pnpm-lock.yaml', 'package.json', 'pnpm-lock.yaml', '.node-version'];
export async function sourceSnapshot(repo = root) {
  const git = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  assert.equal(git(['diff', '--name-only', 'HEAD', '--', ...sourcePaths]), '', '建置來源有未提交變動');
  assert.equal(git(['ls-files', '--others', '--exclude-standard', '--', ...sourcePaths]), '', '建置來源有未追蹤檔');
  const files = git(['ls-files', '-z', '--', ...sourcePaths]).split('\0').filter(Boolean).sort();
  const sources = await Promise.all(files.map(async (path) => ({ path, sha256: hash(await readFile(resolve(repo, path))) })));
  return { sha: git(['rev-parse', 'HEAD']), sources, sourceDigest: hash(JSON.stringify(sources)) };
}
export async function distSnapshot(repo = root) {
  const dist = resolve(repo, 'demo/dist');
  const files = await filesAt(dist);
  assert.ok(files.length, 'dist 不可空白');
  const inventory = await Promise.all(files.map(async (file) => ({ path: relative(dist, file).split(sep).join('/'), sha256: hash(await readFile(file)), bytes: (await stat(file)).size })));
  return { inventory, distDigest: hash(JSON.stringify(inventory)) };
}
export function validateReceipt(receipt, snapshot, dist) {
  assert.equal(receipt.version, 1);
  assert.equal(receipt.sha, snapshot.sha);
  assert.deepEqual(receipt.sources, snapshot.sources, '完整凍結來源已改變');
  assert.equal(receipt.sourceDigest, snapshot.sourceDigest);
  assert.deepEqual(receipt.inventory, dist.inventory, 'dist 與建置收據不符');
  assert.equal(receipt.distDigest, dist.distDigest);
  assert.ok(Number.isFinite(Date.parse(receipt.started)) && Date.parse(receipt.finished) >= Date.parse(receipt.started) && Date.parse(receipt.finished) <= Date.now(), '建置時間不合法');
  return hash(JSON.stringify(receipt));
}
export async function readBuildReceipt(path = process.env.BUILD_RECEIPT, repo = root) {
  assert.ok(path, '需 BUILD_RECEIPT／--build-receipt；由協調者真實 build 前後產出，不接受手填 SHA');
  const receipt = JSON.parse(await readFile(resolve(path), 'utf8'));
  const digest = validateReceipt(receipt, await sourceSnapshot(repo), await distSnapshot(repo));
  return { receipt, receiptDigest: digest };
}
export async function verifyBuildReceipt(binding, repo = root) {
  assert.equal(validateReceipt(binding.receipt, await sourceSnapshot(repo), await distSnapshot(repo)), binding.receiptDigest);
}
/** 建置前留來源快照、建置後留產物收據；此工具不替協調者執行 build。 */
export async function captureBuild(path, before, repo = root) {
  const snapshot = await sourceSnapshot(repo);
  if (!before) {
    await writeFile(path, JSON.stringify({ ...snapshot, started: new Date().toISOString() }, null, 2), { flag: 'wx' });
  } else {
    const initial = JSON.parse(await readFile(before, 'utf8'));
    assert.deepEqual(snapshot, { sha: initial.sha, sources: initial.sources, sourceDigest: initial.sourceDigest }, 'build 前後來源不一致');
    const dist = await distSnapshot(repo);
    assert.ok((await stat(resolve(repo, 'demo/dist/index.html'))).mtimeMs >= Date.parse(initial.started), 'dist 早於本輪 build 起點');
    const receipt = { version: 1, ...snapshot, ...dist, started: initial.started, finished: new Date().toISOString() };
    validateReceipt(receipt, snapshot, dist);
    await writeFile(path, JSON.stringify(receipt, null, 2), { flag: 'wx' });
  }
}
/** companion 也比對真正收到的本機產物，避免把同 HEAD 的另一個 preview 當此 build。 */
export async function verifyResponseBytes(response, binding, base) {
  const url = localUrl(response.url(), base);
  assert.equal(response.status(), 200, `回應不是 200：${url.href}`);
  const path = decodeURIComponent(url.pathname).replace(/^\//, '') + (url.pathname.endsWith('/') ? 'index.html' : '');
  const expected = binding.receipt.inventory.find((entry) => entry.path === path);
  assert.ok(expected, `回應不在 dist 收據：${url.pathname}`);
  assert.equal(hash(await response.body()), expected.sha256, `preview 不是收據產物：${url.pathname}`);
  return path;
}
export function watchBuildResponses(context, binding, base, options = {}) {
  const state = buildContextState(context);
  assert.ok(!state.binding, '同一 context 不得重複安裝建置 watcher');
  state.binding = binding; state.allowTextbook404 = options.allowTextbook404 === true;
  const pending = new Set(), failures = [], seen = new Set();
  let sealed = false, finalized = false, finalizing, snapshot;
  const listener = (response) => {
    if (finalized) { failures.push(`封口後出現回應：${response.url()}`); return; }
    const task = (async () => {
      if (!/^https?:/.test(response.url())) return; // 行內 data／blob 圖不會出站，另由圖片解碼與來源核對。
      localUrl(response.url(), base);
      if (response.status() !== 200) {
        assert.ok(state.allowTextbook404 && expectedTextbook404(response, base), `HTTP 非 200：${response.status()} ${response.url()}`);
        state.expected.push({ url: response.url(), status: response.status(), phase: 'response' });
        return;
      }
      seen.add(await verifyResponseBytes(response, binding, base));
    })().catch((error) => failures.push(String(error)));
    pending.add(task); task.finally(() => pending.delete(task));
  };
  context.on('response', listener);
  const drain = async () => { while (pending.size) await Promise.all([...pending]); };
  const assertComplete = () => {
    assert.equal(state.routes.size, 0, 'route handler 尚未排空');
    assert.equal(pending.size, 0, 'response body 尚未排空');
    assert.equal(sealed, true, 'context 尚未確認關閉封口');
    assert.deepEqual([...state.failures, ...failures], []);
    assert.ok(seen.has('index.html') || [...seen].some((path) => path.endsWith('/index.html')), '沒有核對 HTML 回應');
  };
  const evidence = () => ({ seen: [...seen].sort(), failures: [...state.failures, ...failures], pending: pending.size, routes: state.routes.size, sealed, expectedNon200: state.expected.map((entry) => ({ ...entry })) });
  const close = context.close.bind(context);
  const finish = async () => {
    // 只共用進行中的收尾；已完成後仍重新斷言，不能快取成功掩蓋晚到失敗。
    if (finalized) { assertComplete(); return snapshot; }
    if (finalizing) return finalizing;
    state.accepting = false;
    finalizing = (async () => {
      const errors = [];
      try {
        while (state.routes.size) await Promise.all([...state.routes]);
        await drain();
        await verifyBuildReceipt(binding); // 這段非同步期間 listener 持續有效。
        await drain();
      } catch (error) { errors.push(error); }
      // context.close 是事件來源的封口屏障；關閉前後的 body 都要核對到完成。
      try { await close(); sealed = true; } catch (error) { failures.push(`context 關閉失敗：${error}`); errors.push(error); }
      while (state.routes.size) await Promise.all([...state.routes]);
      await drain();
      // 關閉後再核來源／產物收據；即使這段非同步複驗期間才交付 body，也要再次排空。
      try { await verifyBuildReceipt(binding); } catch (error) { errors.push(error); }
      while (state.routes.size) await Promise.all([...state.routes]);
      await drain();
      finalized = true;
      try { assertComplete(); } catch (error) { errors.push(error); }
      if (errors.length) failures.push(...errors.map(String));
      snapshot = evidence();
      Object.freeze(snapshot.seen); Object.freeze(snapshot.failures);
      snapshot.expectedNon200.forEach(Object.freeze); Object.freeze(snapshot.expectedNon200); Object.freeze(snapshot);
      if (errors.length) throw new AggregateError(errors, '建置回應收尾失敗');
      return snapshot;
    })();
    try { return await finalizing; } finally { finalizing = undefined; }
  };
  // 留實際成功路徑與失敗原因；回應不在收據內也不能默默略過。
  finish.evidence = () => snapshot ?? evidence();
  return finish;
}

/** 所有 rollout context 共用監測，先等 body 雜湊完成才關閉，包含備份與故障 context。 */
export function guardBuildContext(context, binding, base, report) {
  const finish = watchBuildResponses(context, binding, base);
  const entry = { context: report.buildResponses.length, seen: [], failures: [], pending: 0 };
  report.buildResponses.push(entry);
  const drain = async () => {
    try { await finish(); }
    catch (error) { report.assetFailures.push({ context: entry.context, error: String(error) }); throw error; }
    finally { if (!Object.isFrozen(entry)) { Object.assign(entry, finish.evidence()); Object.freeze(entry); } }
  };
  context.close = drain;
  // 結尾一併關閉仍開啟的 context，不能在核對之後留下繼續接收回應的頁面。
  return context.close;
}

/** 從 Markdown 原文建立應有內容；不使用已渲染 DOM 的數量作期望。 */
function tableSeparator(line) {
  const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim());
  return line.includes('|') && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}
let featureParser;
export function normalizeTex(value) { return value.replace(/\r\n/g, '\n').trim().replace(/\s+/g, ' '); }
export function normalizeCell(value) { return value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim(); }
export function normalizeCode(value) { return value.replace(/\r\n/g, '\n').replace(/\n+$/, ''); }
export function normalizeLanguage(value) {
  const language = (value ?? '').toLowerCase();
  return ({ py: 'python', js: 'javascript', ts: 'typescript', plaintext: 'text', txt: 'text', '': 'text' })[language] ?? language;
}
/** 使用 Astro 已安裝的 unified／GFM 與既有 remark-math；延遲初始化避免 import 讀檔。 */
export function parseFeatureBlocks(markdown, concepts = []) {
  if (!featureParser) {
    const astroRequire = createRequire(import.meta.resolve('@astrojs/markdown-remark'));
    const ownRequire = createRequire(import.meta.url);
    featureParser = astroRequire('unified').unified().use(astroRequire('remark-parse').default).use(astroRequire('remark-gfm').default).use(ownRequire('remark-math').default).use(astroRequire('remark-smartypants').default);
  }
  const tree = featureParser.runSync(featureParser.parse(markdown)), formulas = [], tables = [], codes = [], diagrams = [];
  const text = (node) => {
    if (node.type === 'html') return node.value.replace(/<[^>]*>/g, '');
    // 手動 wiki link 顯示概念標題，仍由凍結來源取得，不能拿 DOM 文字作期望。
    if (node.type === 'text') return node.value.replace(/\[\[([^\]]+)\]\]/g, (token, key) => concepts.find((concept) => [concept.id, concept.title, ...(concept.aliases ?? [])].some((value) => value.toLowerCase() === key.toLowerCase()))?.title ?? token);
    return node.value ?? node.alt ?? (node.children ?? []).map(text).join('');
  };
  const visit = (node) => {
    if (node.type === 'math' || node.type === 'inlineMath') formulas.push(node.value);
    if (node.type === 'table') tables.push(node.children.map((row) => row.children.map(text)));
    if (node.type === 'code') {
      const code = { language: normalizeLanguage(node.lang), text: normalizeCode(node.value) };
      if (code.language === 'mermaid') diagrams.push(code); else codes.push(code);
    }
    node.children?.forEach(visit);
  };
  visit(tree); return { formulas, tables, codes, diagrams };
}
/** 題目分欄取期望，答後解析不可提前拿來補選前缺失；一般正文避開自動關係表。 */
export function featureBlocks(item, phase = 'before', concepts = []) {
  const fields = item.stem === undefined
    ? [{ key: 'body', selector: '#concept-body, .cheatsheet-body, main .prose', text: item.body ?? '' }]
    : [
      { key: 'stem', selector: '.question-stem', text: item.stem },
      ...Object.entries(item.options ?? {}).map(([choice, text]) => ({ key: `option:${choice}`, selector: `[data-option="${choice}"] > span:not([class])`, text })),
      ...(phase === 'after' ? [
        { key: 'summary', selector: '.explanation-summary', text: typeof item.explanation === 'string' ? item.explanation : item.explanation?.summary },
        { key: 'correct', selector: '[data-explanation] > p:not([class])', text: item.explanation?.correct },
        ...['A', 'B', 'C', 'D'].filter((choice) => choice !== item.answer).map((choice, index) => ({ key: `wrong:${choice}`, selector: `.wrong-reasons > div:nth-child(${index + 1}) dd`, text: item.explanation?.wrong?.[choice] })),
        { key: 'rule', selector: '.judgment-rule p', text: item.explanation?.rule },
      ] : []),
    ];
  const blocks = fields.map(({ text, ...field }) => ({ ...field, ...parseFeatureBlocks(text ?? '', concepts) }));
  if (item.stem !== undefined && item.code) blocks.push({ key: 'code', selector: '.question-code', formulas: [], tables: [], diagrams: [], codes: [{ language: normalizeLanguage(item.code_lang ?? 'python'), text: normalizeCode(item.code) }] });
  return blocks;
}
export function sourceFeatures(item = {}, phase = 'before', concepts = []) {
  const body = item.body ?? '', prose = body.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
  const blocksExpected = featureBlocks(item, phase, concepts);
  return {
    blocks: blocksExpected,
    formula: blocksExpected.some((block) => block.formulas.length),
    tables: blocksExpected.reduce((n, block) => n + block.tables.length, 0),
    code: blocksExpected.reduce((n, block) => n + block.codes.length, 0),
    diagrams: blocksExpected.reduce((n, block) => n + block.diagrams.length, 0),
    figures: [...prose.matchAll(/!\[([^\]]+)\]\(figure:([^)]+)\)/g)].map((m) => ({ alt: m[1], id: m[2] })),
    images: [...prose.matchAll(/!\[([^\]]*)\]\((?!figure:)([^)]+)\)/g)].map((m) => ({ alt: m[1], src: m[2] })),
    questionImage: item.image ? `/question-assets/${item.image}` : null,
  };
}
export function assertFeatureInventory(actual, expected) {
  assert.equal(actual.errors, 0); assert.equal(actual.katex, actual.mathml);
  for (const block of expected.blocks ?? []) {
    const rendered = actual.blocks?.find((value) => value.key === block.key);
    if (!rendered && !block.formulas.length && !block.tables.length && !block.codes?.length && !block.diagrams?.length) continue;
    assert.ok(rendered, `缺來源區塊 ${block.key}`);
    assert.deepEqual(rendered.formulas.map(normalizeTex), block.formulas.map(normalizeTex), `${block.key} 公式數量／TeX 不符`);
    assert.equal(rendered.katex, block.formulas.length, `${block.key} KaTeX 數量不符`);
    assert.equal(rendered.mathml, block.formulas.length, `${block.key} MathML 數量不符`);
    assert.deepEqual(rendered.tables.map((table) => table.map((row) => row.map(normalizeCell))), block.tables.map((table) => table.map((row) => row.map(normalizeCell))), `${block.key} 表格列／cell 數量或文字不符`);
    assert.deepEqual((rendered.codes ?? []).map((code) => ({ language: normalizeLanguage(code.language), text: normalizeCode(code.text) })), block.codes ?? [], `${block.key} 程式數量／語言／文字不符`);
    if (block.diagrams?.length) assert.equal(rendered.diagrams, block.diagrams.length, `${block.key} Mermaid 數量不符`);
  }
  if (expected.formula) assert.ok(actual.katex > 0, '原文公式消失');
  assert.ok(actual.tables >= expected.tables, '原文表格消失');
  assert.ok(actual.code >= expected.code, '原文程式消失');
  if (expected.diagrams) assert.ok(actual.diagrams >= expected.diagrams, '原文流程圖消失');
  assert.equal(actual.figures.length, expected.figures.length, '原文 figure 消失');
  assert.deepEqual(actual.figures.map((f) => f.alt), expected.figures.map((f) => f.alt));
  assert.ok(actual.figures.every((f) => f.alt && f.loaded));
  for (const [index, figure] of expected.figures.entries()) {
    if (figure.kind === 'svg') assert.equal(actual.figures[index].assetSha256, figure.assetSha256, 'figure SVG 必須符合來源資產');
    if (figure.kind === 'json') assert.equal(actual.figures[index].id, figure.id, 'figure JSON 圖 ID 必須符合來源');
  }
  for (const image of expected.images) assert.ok(actual.images.some((i) => i.src === image.src && i.alt === image.alt && i.loaded), `圖片消失 ${image.src}`);
  if (expected.questionImage) assert.ok(actual.images.some((i) => i.src === expected.questionImage && i.loaded && i.alt), '題目核准附圖消失／資產錯誤');
}
export function assertExactLinks(actual, expected) {
  assert.deepEqual(actual.map(decodeURI).sort(), expected.map(decodeURI).sort(), '教材連結數量／路徑／重複次數不一致');
}
export function supplementCounts(body) {
  const prose = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  const clean = (s) => s.replace(/<[^>]*>|[*_`]/g, '').trim();
  let rows = 0, inTable = false;
  for (const line of prose.split('\n')) {
    if (tableSeparator(line)) { inTable = true; continue; }
    if (!line.includes('|')) { inTable = false; continue; }
    if (inTable && clean(line.replace(/^\s*\|/, '').split(/(?<!\\)\|/)[0]).endsWith('（補充）')) rows++;
  }
  return {
    rows,
    lists: prose.split('\n').filter((line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line) && clean(line).endsWith('（補充）')).length,
    paragraph: /^\s*:::supplement\[來源：/m.test(prose),
  };
}

export function finalizeCoverage(checks) {
  for (const check of Object.values(checks)) {
    check.pending = check.pending.filter((p) => p.name !== 'coverage');
    const visited = new Set(check.visited ?? []), missing = (check.expectedUnits ?? []).filter((unit) => !visited.has(unit));
    if (missing.length) check.pending.push({ name: 'coverage', status: '未執行', reason: '前置失敗或未執行，不能縮小分母', missing });
    check.coverage = { expected: check.expectedUnits?.length ?? 0, visited: (check.expectedUnits ?? []).filter((unit) => visited.has(unit)).length, missing };
    check.status = check.failed ? '失敗' : check.pending.length || !check.total ? '未執行' : '通過';
  }
}
export function assertSearchSummaries(results) {
  assert.ok(results.length > 0);
  for (const { summary, html } of results) {
    assert.ok(summary.trim(), '搜尋摘要缺失');
    assert.ok(!/(?:\\(?:frac|mathrm|begin|end|sqrt)\b|\$\$|(?<!\\)\$[^$]+\$|annotation\s+encoding|application\/x-tex|<\/?(?:math|mrow|mi|mo|mn)\b|katex-mathml)/i.test(summary + html), '公式／MathML 污染搜尋摘要');
  }
}

/** 從瀏覽器真正的 Tab 起點移動；逾限視為失敗，不用 focus 跳過鍵盤路徑。 */
export async function tabTo(page, locator, key = 'Tab', limit = 160) {
  for (let count = 0; count < limit; count++) {
    await page.keyboard.press(key);
    if (await locator.evaluate((element) => element === document.activeElement)) return count + 1;
  }
  assert.fail(`自然 ${key} 路徑無法到達 ${await locator.toString()}`);
}
export async function exportUiBackup(page, output, name) {
  const pending = page.waitForEvent('download'); await page.locator('#export-attempts').click();
  const file = resolve(output, name); await (await pending).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
export function answerPlan(content, ids) {
  return ids.map((id, index) => {
    const q = content.questions.find((item) => item.id === id); assert.ok(q);
    return { qid: id, rev: q.rev, choice: index === 0 ? ['A', 'B', 'C', 'D'].find((c) => c !== q.answer) : q.answer, correct: index !== 0 };
  });
}
export function assertSavedPlan(attempts, plan, mode) {
  assert.equal(attempts.length, plan.length);
  for (const expected of plan) {
    const matches = attempts.filter((a) => a.qid === expected.qid); assert.equal(matches.length, 1);
    for (const field of ['qid', 'rev', 'choice', 'correct']) assert.equal(matches[0][field], expected[field], `${expected.qid} ${field}`);
    assert.equal(matches[0].mode, mode);
  }
}
export function stageCollisions(content) {
  const stages = content.codes.flatMap((route) => (route.stages ?? []).map((stage) => ({ code: route.code, stage: stage.id, pool: poolFor(content, route.code, stage).map((q) => q.id).sort() })));
  return stages.flatMap((a, index) => stages.slice(index + 1).filter((b) => b.code !== a.code && b.stage === a.stage).map((b) => ({ a, b })));
}
export async function protectedState(page) {
  return page.locator('.learning-goals, .relation-table, [data-self-check]').evaluateAll((elements) => elements.map((e) => ({ text: e.textContent, visible: e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0' })));
}
export function assertProtectedState(actual, before) { assert.deepEqual(actual, before, '補充切換不能改保護區塊的數量、可見性與文字'); }
export function assertHistory(payload, expected) { assert.deepEqual(payload, expected, '備份必須完整保留既有作答與閱讀內容'); }
/** 只在測試自己的 context 內安裝；session flag 可解除，且導航不會重寫種子歷史。 */
export function installStorageFault() {
  const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
  Storage.prototype.getItem = function (key) {
    if (key.startsWith('ipas-') && sessionStorage.getItem('rollout-fault') === 'unavailable') throw new DOMException('blocked', 'SecurityError');
    return get.call(this, key);
  };
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('ipas-') && ['quota', 'unavailable'].includes(sessionStorage.getItem('rollout-fault'))) throw new DOMException('full', 'QuotaExceededError');
    return set.call(this, key, value);
  };
}

export function assertCompanion(name, envelope, binding, content) {
  const r = envelope.report ?? envelope;
  assert.equal(envelope.sha, binding.receipt.sha); assert.equal(envelope.buildSha, binding.receipt.sha);
  assert.equal(envelope.receiptDigest, binding.receiptDigest, 'companion build 收據不同');
  assert.equal(r.completed ?? (name === 'figures' ? envelope.completed : false), true, '缺完整執行旗標'); assert.ok(!r.failure);
  for (const field of ['browserErrors', 'externalRequests', 'assetFailures']) {
    // figures 原程式只輸出 errors／external，封套必須提供缺少的監測證據。
    const value = r[field] ?? envelope[field]; assert.ok(Array.isArray(value), `缺 ${field}`); assert.deepEqual(value, []);
  }
  for (const field of ['errors', 'external', 'failed']) if (r[field] !== undefined) assert.deepEqual(r[field], [], `既有 ${field} 不能忽略`);
  if (name === 'smoke') {
    for (const flag of ['wrongBook', 'exportImport', 'quiz', 'readingProgress', 'readingBackup', 'stageQuiz', 'selfCheck']) assert.equal(r[flag], true, flag);
    assert.equal(r.stages, content.codes.find((c) => c.code === 'L23303').stages.length);
    assert.equal(r.selfCheckOrdering?.conceptPages, content.codes.find((c) => c.code === 'L23303').concepts.length);
    assert.equal(r.supplementS4b?.mobile, true); assert.ok(r.mobile?.length >= 5); assert.ok(r.links > 0); assert.ok(r.searchFirst?.includes('/concepts/data-leakage/'));
  } else if (name === 'map') {
    for (const flag of ['mobilePan', 'bodyOptIn', 'bodyHiddenByDefault', 'canvasLayersAligned', 'nodeNavigation', 'readingMark', 'edgeHasNoTooltip', 'zoom']) assert.equal(r[flag], true, flag);
    const route = content.codes.find((c) => c.code === 'L23303'), nodes = route.stages.flatMap((s) => s.concepts).length;
    assert.equal(r.concepts, nodes); assert.equal(r.nodeBottomHover, nodes); assert.equal(r.completeRelationPanels, nodes);
    assert.equal(r.filters?.length, route.stages.length); assert.equal(r.gridScans?.length, 3);
    assert.deepEqual(r.filters.map((s) => [s.stage, s.nodes]), route.stages.map((s) => [s.id, s.concepts.length]));
    const included = new Set(route.concepts);
    const typed = content.concepts.filter((c) => included.has(c.id)).flatMap((c) => ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'].flatMap((type) => (c[type] ?? []).filter((e) => included.has(typeof e === 'string' ? e : e.target)).map(() => type)));
    assert.equal(r.typedRelations, typed.length);
    assert.deepEqual(r.relationTypes.map((r) => [r.type, r.actual, r.expected]), ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'].map((type) => [type, typed.filter((t) => t === type).length, typed.filter((t) => t === type).length]));
    assert.deepEqual(r.gridScans.map((s) => [s.viewport.width, s.viewport.height, s.scrollY]), [[1440, 900, 0], [1920, 1080, 0], [1440, 900, 300]]);
    for (const scan of r.gridScans) { assert.equal(scan.mismatches, 0); assert.ok(scan.points > 0 && scan.nodePoints > 0 && scan.blankPoints > 0); }
  } else if (name === 'figures') {
    assert.equal(r.figures, 5); assert.equal(r.formulas, 3); assert.equal(r.mathml, 3); assert.equal(r.searchable, true); assert.equal(r.mobileWidth, 375); assert.ok(r.darkTextContrast >= 4.5);
  } else if (name === 'cheatsheets') {
    assert.equal(r.mode, 'real'); assert.equal(r.pages?.length, 21);
    assert.deepEqual(r.pages.map((p) => p.code).sort(), [...EXPECTED_CODES].sort());
    for (const p of r.pages) {
      assert.equal(p.status, '通過'); assert.equal(p.path, `/codes/${p.code}/cheatsheet/`);
      assert.deepEqual(p.viewports?.map((cell) => [cell.width, cell.height, cell.theme]).sort(), CELLS.map((cell) => [cell.width, cell.height, cell.theme]).sort());
      assert.equal(p.print?.verified, true); assert.equal(p.print.button, 'none'); assert.ok(p.print.document <= p.print.viewport); assert.ok(p.print.navigation?.length > 0 && p.print.navigation.every((v) => v === 'none'));
      assert.ok(p.links?.length > 0 && p.links.every((link) => link.builtId && link.clicked));
      assertExactLinks(p.links.map((link) => canonicalLink(link.href)), sourceConceptLinks(content.cheatsheets.find((sheet) => sheet.code === p.code).body).map(canonicalLink));
      const expected = supplementCounts(content.cheatsheets.find((sheet) => sheet.code === p.code).body);
      assert.equal(p.supplementRows?.actual, expected.rows); assert.equal(p.supplementLists?.actual, expected.lists);
      for (const cell of p.viewports) {
        assert.ok(cell.screenshot && cell.features); assert.ok(cell.dimensions.document <= cell.width && cell.dimensions.body <= cell.width);
        assertFeatureInventory(cell.features, sourceFeatures(content.cheatsheets.find((sheet) => sheet.code === p.code), 'before', content.concepts));
        assert.deepEqual(cell.features.contrast.failed, []); assert.deepEqual(cell.features.singleColumns, []);
        assert.ok(cell.dimensions.overflow.every((v) => !['hidden', 'clip'].includes(v)));
      }
    }
  } else assert.fail(`未知 companion ${name}`);
}
export function sourceConceptLinks(body) { return [...body.replace(/```[\s\S]*?```|`[^`\n]*`/g, '').matchAll(/(?<!!)\[[^\]]*\]\((\/concepts\/[^)]+)\)/g)].map((m) => m[1]); }
export function canonicalLink(href) { const url = new URL(href, 'http://127.0.0.1'); assert.ok(url.hash); return `${url.pathname}#${decodeURIComponent(url.hash.slice(1)).replace(/[\s\p{P}]/gu, '').toLowerCase()}`; }
export function hasMath(body) {
  const prose = body.replace(/```[\s\S]*?```|`[^`\n]*`/g, '');
  return /(?:^|\n)\s*\$\$|(?<!\\)\$[^\n$]+(?<!\\)\$/.test(prose);
}
function primaryPaths(content) {
  return [...new Set(['/', '/catalog/', '/map/', '/quiz/', '/self-check/', '/wrong-book/',
    ...content.concepts.map((c) => `/concepts/${c.id}/`), ...content.questions.map((q) => `/questions/${q.id}/`),
    ...content.codes.flatMap((c) => [`/codes/${c.code}/`, `/practice/${c.code}/`]), ...content.cheatsheets.map((c) => `/codes/${c.code}/cheatsheet/`)])].sort();
}
function poolFor(content, code, stage) {
  return content.questions.filter((q) => stage ? q.concepts.some((id) => stage.concepts.some((c) => c.id === id)) : q.codes.includes(code));
}
export function sourceStageChecks(content, stage) {
  const checks = [...new Set(stage.concepts.map((c) => c.id))].flatMap((id) => (content.concepts.find((c) => c.id === id)?.self_check ?? []).map((check) => ({ ...check, id: `${id}:${check.id}` })));
  return [...checks.filter((c) => c.type === 'choice'), ...checks.filter((c) => c.type === 'short')];
}

/** 純邏輯的正／負 fixtures，不啟動瀏覽器、不連網、不改檔。 */
export function selfTest() {
  assert.equal(localUrl('/codes/L23303/', 'http://127.0.0.1:4321').pathname, '/codes/L23303/');
  for (const value of ['https://example.com/', '//localhost:4321/', 'http://127.0.0.1:9999/', 'file:///C:/secret']) assert.throws(() => localUrl(value, 'http://127.0.0.1:4321'));
  const content = { concepts: [{ id: 'a' }, { id: 'b' }], codes: [{ code: 'L23303', concepts: ['a', 'b'], stages: [{ id: 's', concepts: [{ id: 'a' }, { id: 'b' }] }] }], cheatsheets: [], questions: [
    { id: 'mock', source: 'mock', rev: 2, codes: ['L23303'], concepts: ['a'] },
    { id: 'cross', source: 'exam', rev: 1, codes: ['L21101'], concepts: ['a'] },
  ] };
  assert.deepEqual(poolFor(content, 'L23303').map((q) => q.id), ['mock']);
  assert.deepEqual(poolFor(content, 'L23303', content.codes[0].stages[0]).map((q) => q.id), ['mock', 'cross']);
  const revisions = { mock: 2, cross: 1 };
  assert.ok(!contentProblems(content, revisions).some((p) => /順序不符|缺概念|revisions/.test(p)));
  const broken = structuredClone(content); broken.codes[0].stages[0].concepts.reverse(); broken.codes[0].concepts.push('missing');
  const failures = contentProblems(broken, { mock: 1 });
  for (const pattern of [/順序不符/, /缺概念 missing/, /mock revisions 1\/2/, /cross revisions 缺\/1/, /exam：1\/200/, /concepts：2\/485/, /codes：1\/21/]) assert.ok(failures.some((p) => pattern.test(p)), String(pattern));
  assert.equal(CELLS.length, 6);
  assert.equal(hasMath('公式 $x+y$ 與文字'), true); assert.equal(hasMath('$$\nx+y\n$$'), true);
  assert.equal(hasMath('`$code$`\n```python\nprint("$var$")\n```'), false); assert.equal(hasMath('售價 \\$50 與 \\$60'), false);
  const codes = ['L21101', 'L21102', 'L21103', 'L21104', 'L21201', 'L21202', 'L21203', 'L21301', 'L21302', 'L23101', 'L23102', 'L23103', 'L23201', 'L23202', 'L23203', 'L23301', 'L23302', 'L23303', 'L23304', 'L23401', 'L23402'];
  const complete = { concepts: Array.from({ length: 485 }, (_, i) => ({ id: `c-${i}` })), codes: codes.map((code) => ({ code, concepts: ['c-0'], stages: [{ id: 's', concepts: [{ id: 'c-0' }] }] })), cheatsheets: codes.map((code) => ({ code })), questions: [] };
  for (const session of ['114-2', '115-1']) for (const subject of [1, 3]) for (let n = 1; n <= 50; n++) complete.questions.push({ id: `${session}-S${subject}-Q${String(n).padStart(2, '0')}`, session, subject, number: n, source: 'exam', rev: 1, review: { status: 'verified', answer_checked: { by: 'fixture', pdf_page: 1 }, blind_answer: 'A' } });
  complete.questions.push({ id: 'M-L23303-001', source: 'mock', rev: 1 });
  const index = Object.fromEntries(complete.questions.map((q) => [q.id, q.rev]));
  assert.deepEqual(contentProblems(complete, index), [], '完整 fixture 應通過固定門檻');
  const invalid = structuredClone(complete); invalid.questions[0].review.status = 'draft'; invalid.codes[0].stages.push(invalid.codes[0].stages[0]); invalid.concepts[1].id = invalid.concepts[0].id;
  const rejected = contentProblems(invalid, index);
  for (const pattern of [/缺審查證據/, /重複 stage ID/, /concepts 含重複 ID/]) assert.ok(rejected.some((p) => pattern.test(p)), String(pattern));
  return { fixtures: { pass: ['同源 URL', '單元題池', '跨碼階段題池', '順序與版本', '完整 485/21/21/200'], fail: ['四種非同源 URL', '缺概念', '階段反序', '版本不符', '固定分母缺項', 'draft 審查', '重複 stage', '重複 concept'] }, browserExecuted: false };
}

export async function runRollout(options) {
  const output = resolve(options.output);
  assert.ok(relative(resolve(root, 'tmp'), output) && !relative(resolve(root, 'tmp'), output).startsWith('..') && !relative(resolve(root, 'tmp'), output).includes(':') , '輸出須為本 worktree tmp 的獨立子目錄');
  const base = localUrl(options.base ?? 'http://127.0.0.1:4321/', options.base ?? 'http://127.0.0.1:4321/').origin;
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(options.sha, sha, '凍結 SHA 與本工作樹不同');
  assert.equal(options.buildSha, sha, 'build SHA 需由協調者提供並符合凍結 SHA');
  assert.ok(Number.isFinite(Date.parse(options.buildTime)), '需協調者提供 build 時間');
  assert.ok(Date.parse(options.buildTime) <= Date.now() + 300000, 'build 時間不可在未來');
  const binding = await readBuildReceipt(options.buildReceipt);
  assert.equal(binding.receipt.sha, sha);
  assert.equal(binding.receipt.finished, options.buildTime, 'build-time 須等於實際收據時間');
  const dist = resolve(root, 'demo/dist');
  const content = await loadContent();
  const revisions = JSON.parse(await readFile(resolve(root, 'demo/src/data/revisions.json'), 'utf8'));
  const paths = primaryPaths(content);
  const builtFiles = await filesAt(dist);
  const expectedPaths = [...paths];
  const builtPaths = builtFiles.filter((file) => file.endsWith(`${sep}index.html`)).map((file) => '/' + relative(dist, file).split(sep).slice(0, -1).join('/') + '/').map((path) => path === '//' ? '/' : path).filter((path) => path === '/' || /^\/(?:concepts|questions|codes|practice|catalog|map|quiz|self-check|wrong-book)\//.test(path));
  for (const path of builtPaths) if (!paths.includes(path)) paths.push(path);
  paths.sort();
  const buildInventory = await Promise.all(builtFiles.map(async (file) => ({ path: relative(dist, file).split(sep).join('/'), sha256: hash(await readFile(file)), bytes: (await stat(file)).size })));
  const report = { sha, buildSha: binding.receipt.sha, buildTime: binding.receipt.finished, receiptDigest: binding.receiptDigest, buildProvenance: '真實 build 前後收據：完整來源／dist 雜湊；HTTP 回應逐檔比對。不代替內容主審或 build 命令紀錄',
    started: new Date().toISOString(), base, targets: TARGETS, counts: { concepts: content.concepts.length, codes: content.codes.length, cheatsheets: content.cheatsheets.length, exam: content.questions.filter((q) => q.source === 'exam').length, mock: content.questions.filter((q) => q.source === 'mock').length, questions: content.questions.length },
    contentFiles: Object.fromEntries(Object.entries(content).map(([kind, items]) => [kind, items.map((c) => ({ id: c.id ?? c.code, file: c.file, sha256: c.fileSha256 }))])), paths, buildInventory,
    cells: CELLS, sixCellTotal: paths.length * CELLS.length, themeMethod: '每次導航後 DOM 注入並斷言 data-theme；不代表產品有使用者深色切換',
    checks: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`R${i}`, { status: '未執行', passed: 0, failed: 0, total: 0, pending: [], evidence: [] }])), failures: [], screenshots: [], manualReview: { status: '未執行', note: '截圖僅供協調者目視；不自動宣稱無遮擋或 SVG 未裁切' }, browserErrors: [], externalRequests: [], assetFailures: [], search: [], routes: [], geometry: [] };
  await freshOutput(output);
  const save = () => { finalizeCoverage(report.checks); return writeFile(resolve(output, 'rollout-verification.json'), JSON.stringify(report, null, 2) + '\n'); };
  const scopes = {
    R0: { unit: '固定內容門檻', expected: TARGETS },
    R1: { unit: '主要頁面，另加去重後發現的內鏈', expected: paths.length },
    R2: { unit: '主要頁面 × 六格', expected: paths.length * CELLS.length },
    R3: { unit: '代碼首中尾與目前章節', expected: 21 },
    R4: { unit: '主要頁面 × 六格的實際公式／表格／圖／程式＋figures報告', expected: paths.length * CELLS.length + 1 },
    R5: { unit: '逐碼檢核／閱讀＋四種補充代表 × 六格＋既有 smoke', expected: 21 + 4 * CELLS.length + 1 },
    R6: { unit: '代碼題池情境（含單元與所有階段）＋無效參數', expected: 21 + 3, requiredCodes: 21 },
    R7: { unit: '跨科作答／備份／版本／首頁及逐碼統計完整情境', expected: 1 },
    R8: { unit: 'quota／禁用／損壞 JSON／錯版／部分無效匯入', expected: 5 },
    R9: { unit: '10 查詢 × 六格', expected: 60 },
    R10: { unit: '既有地圖報告＋全部速查報告', expected: 2, requiredCheatsheets: 21 },
  };
  for (const [key, scope] of Object.entries(scopes)) report.checks[key].scope = scope;
  const units = {
    R0: ['資料與產物'], R1: paths,
    R2: paths.flatMap((path) => CELLS.map((cell) => `${path} ${cell.width}/${cell.theme}`)),
    R3: EXPECTED_CODES,
    R4: [...paths.flatMap((path) => CELLS.map((cell) => `${path} ${cell.width}/${cell.theme}`)), 'figures'],
    R5: [...EXPECTED_CODES.map((code) => `${code} 教材檢核與已讀`), ...['paragraph', 'row', 'list', 'none'].flatMap((kind) => CELLS.map((cell) => `補充 ${kind} ${cell.width}/${cell.theme}`)), 'smoke'],
    R6: [...EXPECTED_CODES.map((code) => `${code} practice/quiz`), '/quiz/?code=invalid', '/quiz/?code=L23303&stage=invalid', '/self-check/?code=invalid&stage=invalid'],
    R7: ['跨科作答／備份／舊rev／未知qid'], R8: ['quota', 'unavailable', 'corrupt-json', 'wrong-version', 'partial-import'],
    R9: CELLS.flatMap((cell) => searchCases.map(([query]) => `${query} ${cell.width}/${cell.theme}`)), R10: ['map', 'cheatsheets'],
  };
  for (const [key, expectedUnits] of Object.entries(units)) Object.assign(report.checks[key], { expectedUnits, visited: [] });
  function result(key, ok, evidence) { const check = report.checks[key]; check.total++; check[ok ? 'passed' : 'failed']++; check.evidence.push(evidence); if (evidence?.label) check.visited.push(evidence.label); check.status = check.failed ? '失敗' : check.pending.length ? '未執行' : '通過'; }
  const sourceChanges = [execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...sourcePaths], { cwd: root, encoding: 'utf8' }), execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...sourcePaths], { cwd: root, encoding: 'utf8' })].join('\n').split(/\r?\n/).filter(Boolean);
  result('R0', sourceChanges.length === 0, { sourceChanges, note: '凍結 SHA 對應的內容及產品程式不可含未提交變動' });
  for (const problem of contentProblems(content, revisions)) result('R0', false, problem);
  for (const path of builtPaths) if (!expectedPaths.includes(path)) result('R0', false, { unexpectedBuiltPath: path, reason: 'build 主要路由未出現在目前內容清單，可能是過期產物' });
  for (const [kind, target] of Object.entries(TARGETS)) result('R0', report.counts[kind] === target, { kind, actual: report.counts[kind], target });
  for (const path of paths) result('R0', builtFiles.includes(resolve(dist, '.' + path, 'index.html')), { builtPath: path });
  report.checks.R0.visited.push('資料與產物');
  report.checks.R2.pending.push({ name: 'manual-six-cell-review', status: '未執行', reason: '主要文字／按鈕遮擋與 SVG 文字裁切需協調者對照代表及特殊內容截圖目視；不能以幾何尺寸代替' });
  await save();
  if (!options.execute) return report;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const buildChecks = [];
  report.buildResponses = [];
  report.apiBuildResponses = [];
  async function context() {
    const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, deviceScaleFactor: 1 });
    buildChecks.push(guardBuildContext(ctx, binding, base, report));
    ctx.on('page', (page) => { page.on('pageerror', (error) => report.browserErrors.push({ url: page.url(), error: error.message })); });
    await routeLocalOnly(ctx, base, report.externalRequests, report.assetFailures);
    ctx.on('response', (response) => { if (response.status() !== 200) report.assetFailures.push({ url: response.url(), status: response.status() }); });
    ctx.on('requestfailed', (request) => report.assetFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    return ctx;
  }
  async function navigate(page, path, cell = CELLS[4]) {
    await page.setViewportSize({ width: cell.width, height: cell.height });
    const response = await page.goto(localUrl(path, base).href, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, `${path} HTTP`);
    await page.evaluate(async (theme) => {
      document.documentElement.dataset.theme = theme;
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    }, cell.theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), cell.theme);
    return response;
  }
  async function shot(page, label, cell) {
    const name = `${label.replace(/[^a-zA-Z0-9-]/g, '_')}-${cell.width}-${cell.theme}.png`;
    await page.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
    report.screenshots.push({ file: name, url: page.url(), ...cell, review: '未執行' });
    return name;
  }
  async function attempt(key, label, page, body) {
    try { const value = await body(); result(key, true, { label, value }); return value; }
    catch (error) {
      const failure = { label, url: page.url(), width: page.viewportSize()?.width, theme: await page.locator('html').getAttribute('data-theme').catch(() => null), error: String(error) };
      if (key === 'R2' && !report.checks.R4.visited.includes(label)) report.checks.R4.pending.push({ name: `blocked:${label}`, status: '未執行', reason: `R2 前置失敗：${failure.error}`, label });
      failure.screenshot = await shot(page, `failure-${report.failures.length}`, { width: failure.width, theme: failure.theme }).catch(() => null);
      report.failures.push(failure); result(key, false, failure);
    }
  }
  const ctx = await context(); const page = await ctx.newPage(); page.setDefaultTimeout(10000);
  const representatives = new Set(['/', '/catalog/', '/map/', '/quiz/', '/self-check/', '/wrong-book/', '/codes/L23303/', '/practice/L23303/', '/questions/115-1-S3-Q44/', '/questions/114-2-S3-Q34/', '/concepts/roc-auc/', '/concepts/lora/', '/concepts/nist-ai-rmf/', '/concepts/statistical-parity/']);
  for (const code of ['L21101', 'L21203', 'L23203', 'L23402']) representatives.add(`/codes/${code}/`);
  // 以實際最長內容補足數學、表格、程式、圖與附圖的代表，沒有就記缺項。
  for (const pattern of [/likelihood|maximum-likelihood/, /convolution|cnn/, /\$\$|\\\[/, /!\[|:::figure/, /```python/, /\|.*\|/]) {
    const candidate = [...content.concepts].filter((c) => pattern.test(c.id + '\n' + c.body)).sort((a, b) => b.body.length - a.body.length)[0];
    if (candidate) representatives.add(`/concepts/${candidate.id}/`);
  }
  for (const q of content.questions.filter((q) => q.image)) representatives.add(`/questions/${q.id}/`);
  if (content.cheatsheets.length) representatives.add(`/codes/${content.cheatsheets[0].code}/cheatsheet/`);
  try {
    const links = new Map(); const targets = new Map();
    for (const path of paths) {
      await attempt('R1', path, page, async () => {
        const response = await navigate(page, path);
        assert.equal(hash(await response.body()), hash(await readFile(resolve(dist, '.' + path, 'index.html'))), 'preview 與此 build 的 HTML 不同');
        assert.equal(await page.locator('h1').count(), 1);
        targets.set(path, await page.locator('[id]').evaluateAll((elements) => elements.map((e) => e.id)));
        for (const href of await page.locator('a[href]').evaluateAll((anchors) => anchors.map((a) => new URL(a.getAttribute('href'), location.href).href))) {
          const url = new URL(href);
          if (url.origin === base) links.set(url.href, path);
        }
        return { sha256: hash(await response.body()) };
      });
    for (const cell of CELLS) await attempt('R2', `${path} ${cell.width}/${cell.theme}`, page, async () => {
        await navigate(page, path, cell);
        const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, overflow: [document.documentElement, document.body].map((e) => getComputedStyle(e).overflowX), brokenImages: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src) }));
        report.geometry.push({ path, ...cell, ...geometry });
        assert.ok(geometry.document <= cell.width && geometry.body <= cell.width, JSON.stringify(geometry));
        assert.ok(geometry.overflow.every((o) => !['hidden', 'clip'].includes(o)), '不可用全頁 overflow 隱藏溢出');
        assert.deepEqual(geometry.brokenImages, []);
        if (path === '/' && cell.width < 1440) {
          const search = await page.locator('site-search button[data-open-modal]').boundingBox(); const menu = await page.locator('.sl-menu-button').boundingBox();
          assert.ok(search && menu && search.x + search.width <= menu.x, '手機搜尋與選單重疊');
        }
        const source = content.concepts.find((c) => path === `/concepts/${c.id}/`) ?? content.cheatsheets.find((c) => path === `/codes/${c.code}/cheatsheet/`) ?? content.codes.find((c) => path === `/codes/${c.code}/`) ?? content.questions.find((q) => path === `/questions/${q.id}/`) ?? {};
        const expected = sourceFeatures(source, 'before', content.concepts);
        if (source.image) {
          const asset = resolve(root, 'content/assets/questions', source.image), built = resolve(dist, 'question-assets', source.image);
          assert.equal(hash(await readFile(built)), hash(await readFile(asset)), '題目附圖必須是核准來源資產');
        }
        if (representatives.has(path)) await shot(page, path === '/' ? 'home' : path, cell);
        await attempt('R4', `${path} ${cell.width}/${cell.theme}`, page, async () => {
          const before = await verifyFeatures(page, expected);
          if (source.stem !== undefined) {
            assert.equal(await page.locator('[data-explanation]').isVisible(), false, '選前解析必須隱藏');
            await page.locator(`input[value="${source.answer}"]`).check();
            await page.getByRole('button', { name: '確認作答' }).click();
            await page.locator('[data-explanation]:visible').waitFor();
            const after = await verifyFeatures(page, sourceFeatures(source, 'after', content.concepts));
            if (representatives.has(path)) await shot(page, `${path}-answered`, cell);
            return { before, after };
          }
          return before;
        });
        return geometry;
      });
    }
    for (const [href, from] of links) await attempt('R1', `${from} → ${href}`, page, async () => {
      const url = localUrl(href, base); url.search = '';
      if (!targets.has(url.pathname)) {
        // 所有主要頁已逐頁 GET；其他內鏈只 GET 一次。停用 HTTP redirect，避免 API 請求繞過瀏覽器的同源限制。
        const response = await page.request.get(localUrl(url.pathname, base).href, { maxRedirects: 0 }); assert.equal(response.status(), 200, href);
        report.apiBuildResponses.push(await verifyResponseBytes(response, binding, base));
        const html = await response.text();
        targets.set(url.pathname, /text\/html/i.test(response.headers()['content-type'] ?? '') ? await page.evaluate((html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('[id]')].map((e) => e.id), html) : []);
      }
      if (url.hash) assert.equal(targets.get(url.pathname).filter((id) => id === decodeURIComponent(url.hash.slice(1))).length, 1, `目標錨點不存在或不唯一 ${href}`);
      return { href, from, httpVerified: true };
    });
    for (const route of content.codes) {
      await attempt('R3', route.code, page, async () => {
        await navigate(page, `/codes/${route.code}/`);
        assert.deepEqual(await page.locator('[data-stage]').evaluateAll((items) => items.map((item) => item.dataset.stage)), (route.stages ?? []).map((s) => s.id));
        const summaries = await page.locator('.sidebar-content summary').allTextContents();
        const chapters = summaries.map((s) => s.trim()).filter((s) => /^(?:[一二三四五六七八九十百]+|\d+)、/.test(s));
        assert.equal(chapters.length, route.stages?.length ?? 0);
        assert.deepEqual(chapters, (route.stages ?? []).map((stage, i) => chapterLabel(i, stage.title)));
        for (const other of content.codes) assert.ok(await page.locator(`.sidebar-content a[href="/codes/${other.code}/"]`).count() > 0);
        for (const entry of ['/', '/catalog/']) { await navigate(page, entry); assert.ok(await page.locator(`a[href="/codes/${route.code}/"]`).count() > 0, `${entry} 缺路線入口`); }
        const order = route.stages?.flatMap((s) => s.concepts.map((c) => c.id)) ?? route.concepts;
        const samples = [...new Set([0, Math.floor(order.length / 2), order.length - 1])];
        const navigation = [];
        for (const i of samples) {
          const concept = content.concepts.find((c) => c.id === order[i]);
          await navigate(page, `/concepts/${order[i]}/`);
          if (concept.codes[0] !== route.code) { navigation.push({ id: concept.id, owner: concept.codes[0], reason: '跨碼概念，依主責路線另驗' }); continue; }
          for (const [rel, neighbor] of [['prev', order[i - 1]], ['next', order[i + 1]]]) {
            const link = page.locator(`.concept-pagination a[rel="${rel}"]`);
            assert.equal(await link.count(), neighbor ? 1 : 0);
            if (neighbor) assert.equal(await link.getAttribute('href'), `/concepts/${neighbor}/`);
          }
          navigation.push({ id: concept.id, index: i });
        }
        report.routes.push({ code: route.code, stages: route.stages?.length ?? 0, navigation });
        return report.routes.at(-1);
      });
      await attempt('R6', `${route.code} practice/quiz`, page, async () => {
        await navigate(page, '/wrong-book/');
        const beforeQuiz = await exportUiBackup(page, output, `quiz-before-${route.code}.json`);
        await navigate(page, `/practice/${route.code}/`);
        assert.ok(await page.locator(`a[href="/quiz/?code=${route.code}"]`).count() > 0);
        const catalog = JSON.parse(await page.locator('#practice-progress-catalog').textContent());
        for (const stage of route.stages ?? []) assert.deepEqual(catalog.find((s) => s.id === stage.id).questions.map((q) => q.id).sort(), poolFor(content, route.code, stage).map((q) => q.id).sort());
        const pools = [];
        let completedStage = false;
        for (const stage of [undefined, ...(route.stages ?? [])]) {
          const path = `/quiz/?code=${route.code}${stage ? `&stage=${stage.id}` : ''}`;
          await navigate(page, path);
          const expected = poolFor(content, route.code, stage).map((q) => q.id);
          const ids = await page.locator('[data-question]').evaluateAll((cards) => cards.map((c) => c.dataset.qid));
          assert.equal(ids.length, stage ? Math.min(5, expected.length) : expected.length);
          assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every((id) => expected.includes(id)));
          if (ids.length) { assert.equal(await page.locator('#next-question').isDisabled(), true); assert.equal(await page.locator('[data-question]:visible').getAttribute('data-mode'), stage ? `code:${route.code}:stage:${stage.id}` : `code:${route.code}`); }
          else assert.equal(await page.locator('#quiz-empty').isVisible(), true);
          assert.equal(await page.locator('#quiz-retry').getAttribute('href'), path);
          pools.push({ stage: stage?.id ?? null, expected, sampled: ids });
          if (stage && ids.length && !completedStage) {
            const plan = answerPlan(content, ids);
            for (let i = 0; i < ids.length; i++) {
              const card = page.locator('[data-question]:visible'); const expectedAnswer = plan.find((p) => p.qid === ids[i]);
              assert.equal(await card.getAttribute('data-qid'), expectedAnswer.qid);
              assert.equal(await card.getAttribute('data-answer'), content.questions.find((q) => q.id === expectedAnswer.qid).answer);
              const answer = expectedAnswer.choice;
              await card.locator(`input[value="${answer}"]`).check(); await card.getByRole('button', { name: '確認作答' }).click(); await card.locator('[data-explanation]:visible').waitFor();
              assert.equal(await card.getAttribute('data-saved'), 'true'); await page.locator('#next-question').click();
            }
            const correct = plan.filter((p) => p.correct).length;
            await page.locator('#quiz-summary:visible').waitFor(); assert.equal(await page.locator('#final-score').innerText(), `${correct} / ${ids.length} 題答對・${Math.round(correct / ids.length * 100)} 分`);
            await navigate(page, '/wrong-book/');
            const exported = await exportUiBackup(page, output, `quiz-after-${route.code}.json`);
            const oldIds = new Set(beforeQuiz.attempts.map((a) => a.id));
            const saved = exported.attempts.filter((a) => !oldIds.has(a.id));
            const mode = `code:${route.code}:stage:${stage.id}`;
            assertSavedPlan(saved, plan, mode);
            pools.at(-1).completed = { mode, plan, score: `${correct}/${ids.length}`, exported: saved }; completedStage = true;
          }
        }
        return pools;
      });
      const stage = route.stages?.find((s) => s.concepts.some((c) => content.concepts.find((item) => item.id === c.id)?.self_check?.length));
      await attempt('R5', `${route.code} 教材檢核與已讀`, page, async () => {
        assert.ok(stage, '此碼沒有可驗證的教材檢核階段');
        const expected = [...new Set(stage.concepts.map((c) => c.id))].flatMap((id) => (content.concepts.find((c) => c.id === id)?.self_check ?? []).map((check) => `${id}:${check.id}`));
        await navigate(page, `/self-check/?code=${route.code}&stage=${stage.id}`);
        const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
        const cards = page.locator('[data-check-stage]:visible [data-self-check]');
        const ids = await cards.evaluateAll((items) => items.map((item) => item.dataset.checkId));
        assert.equal(ids.length, Math.min(5, expected.length)); assert.ok(ids.every((id) => expected.includes(id)));
        const types = await cards.evaluateAll((items) => items.map((item) => item.dataset.checkType));
        assert.deepEqual(types, [...types.filter((t) => t === 'choice'), ...types.filter((t) => t === 'short')]);
        assert.equal(await cards.locator('[data-check-feedback]:visible').count(), 0, '選答之前全部理由須隱藏');
        const choiceCard = cards.filter({ has: page.locator('input') }).first();
        if (await choiceCard.count()) {
          const feedback = choiceCard.locator('[data-check-feedback]'); assert.equal(await feedback.isVisible(), false);
          const checkId = await choiceCard.getAttribute('data-check-id');
          const [conceptId, localId] = checkId.split(':');
          const check = content.concepts.find((c) => c.id === conceptId)?.self_check.find((c) => c.id === localId); assert.ok(check);
          const choice = choiceCard.locator('input').first(); await choice.focus(); await page.keyboard.press('Space'); assert.equal(await feedback.isVisible(), true);
          assert.deepEqual(await feedback.locator('dd').allTextContents(), Object.keys(check.options).sort().map((key) => check.explain[key]));
          assert.ok((await feedback.innerText()).includes(`參考答案：${check.answer}`));
        }
        const short = cards.locator('summary').first();
        if (await short.count()) { await short.focus(); await page.keyboard.press('Enter'); assert.equal(await short.locator('..').getAttribute('open'), ''); }
        assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), before);
        await navigate(page, `/concepts/${stage.concepts[0].id}/`);
        const button = page.locator('[data-reading-toggle] button');
        await button.focus(); if (await button.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('Space');
        await page.reload(); assert.equal(await button.getAttribute('aria-pressed'), 'true');
        await navigate(page, `/codes/${route.code}/`);
        assert.match(await page.locator(`[data-stage="${stage.id}"] [data-stage-reading]`).innerText(), /已讀 [1-9]/);
        return { stage: stage.id, expected, sampled: ids };
      });
    }
    for (const path of ['/quiz/?code=invalid', '/quiz/?code=L23303&stage=invalid', '/self-check/?code=invalid&stage=invalid']) await attempt('R6', path, page, async () => { await navigate(page, path); assert.equal(await page.locator(path.startsWith('/quiz') ? '#quiz-empty' : '#check-empty').isVisible(), true); });
    report.sameStagePairs = stageCollisions(content);
    report.sameStagePairBoundary = report.sameStagePairs.length ? '兩碼同 stage 的題池已由逐碼 practice/quiz 逐一對照' : '真實來源無兩碼同 stage；不冒稱瀏覽器已驗，另由離線正反 fixture 驗證隔離';
    for (const cell of CELLS) for (const [query, id] of searchCases) await attempt('R9', `${query} ${cell.width}/${cell.theme}`, page, async () => {
      await navigate(page, '/', cell);
      const open = page.locator('site-search button[data-open-modal]'); const openTabs = await tabTo(page, open); await page.keyboard.press('Enter');
      const input = page.locator('.pagefind-ui__search-input'); await input.waitFor({ state: 'visible' }); assert.equal(await input.evaluate((e) => document.activeElement === e), true, '開搜尋後須自然聚焦輸入欄'); await input.fill(query);
      await page.locator('.pagefind-ui__result-link').first().waitFor();
      const top = (await page.locator('.pagefind-ui__result-link').evaluateAll((links) => links.slice(0, 3).map((a) => new URL(a.href).pathname)));
      const summaries = await page.locator('.pagefind-ui__result').evaluateAll((items) => items.slice(0, 3).map((item) => { const excerpt = item.querySelector('.pagefind-ui__result-excerpt'); return { summary: excerpt?.textContent ?? '', html: excerpt?.innerHTML ?? '' }; }));
      assert.equal(summaries.length, top.length); assertSearchSummaries(summaries);
      report.search.push({ query, ...cell, top, summaries, openTabs });
      assert.ok(top.includes(`/concepts/${id}/`), JSON.stringify(top));
      const link = page.locator('.pagefind-ui__result-link').first();
      const resultTabs = await tabTo(page, link); await page.keyboard.press('Shift+Tab'); const returnTabs = await tabTo(page, link);
      await page.keyboard.press('Enter'); await page.waitForURL((url) => url.pathname === top[0]);
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, cell.theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'), cell.theme);
      const reopenTabs = await tabTo(page, open); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); assert.equal(await page.locator('.pagefind-ui__search-input').isVisible(), false);
      assert.equal(await open.evaluate((e) => document.activeElement === e), true, 'Escape 後焦點須回搜尋按鈕');
      return { query, top, summaries, keyboard: { openTabs, resultTabs, returnTabs, reopenTabs }, ...cell };
    });
    await supplementRegression({ content, page, navigate, attempt });
    await storageRegression({ content, context, navigate, attempt, result, report, output });
    // 深度既有回歸由協調者串行執行，再以證據檔匯入；沒有檔案不能冒稱通過。
    for (const [name, key] of [
      ['smoke', 'R5'], ['map', 'R10'], ['figures', 'R4'], ['cheatsheets', 'R10'],
    ]) {
      if (!options.evidence?.[name]) { report.checks[key].pending.push({ name, status: '未執行', reason: '未提供此凍結 build 的既有回歸報告；需協調者另行串行執行' }); report.checks[key].status = report.checks[key].failed ? '失敗' : '未執行'; continue; }
      const evidence = JSON.parse(await readFile(resolve(options.evidence[name]), 'utf8'));
      // figures 腳本不屬本 Task ownership，故其 SHA 由協調者提供旁證封套。
      const data = evidence.report ?? evidence;
      let failure;
      try { assertCompanion(name, evidence, binding, content); } catch (error) { failure = String(error); }
      result(key, !failure, { label: name, file: options.evidence[name], evidence, failure });
    }
    for (const finish of buildChecks) try { await finish(); } catch { /* 詳情由監測器記入 assetFailures。 */ }
    result('R2', report.browserErrors.length === 0, { browserErrors: report.browserErrors });
    result('R2', report.externalRequests.length === 0, { externalRequests: report.externalRequests });
    result('R2', report.assetFailures.length === 0, { assetFailures: report.assetFailures });
  } finally {
    for (const finish of buildChecks) try { await finish(); } catch (error) { result('R2', false, { buildResponseFailure: String(error) }); }
    await browser.close();
    const finalSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    result('R0', finalSha === sha, { finalSha, frozenSha: sha });
    try { await verifyBuildReceipt(binding); result('R0', true, { frozenSources: binding.receipt.sourceDigest, dist: binding.receipt.distDigest }); } catch (error) { result('R0', false, { failure: String(error) }); }
    for (const items of Object.values(content)) for (const item of items) result('R0', hash(await readFile(resolve(root, item.file))) === item.fileSha256, { file: item.file, note: '回歸前後內容雜湊一致' });
    report.finished = new Date().toISOString(); await save();
  }
  return report;
}

/** 用實際 DOM 找公式／局部捲動／表格／對比，無此類內容的頁不強求有圖或公式。 */
export async function verifyFeatures(page, expected) {
  if (expected.diagrams) await page.waitForFunction((count) => document.querySelectorAll('main figure.study-diagram svg').length >= count, expected.diagrams);
  for (const figure of expected.figures) {
    try { figure.assetSha256 = hash(await readFile(resolve(root, 'content/figures', `${figure.id}.svg`))); figure.kind = 'svg'; }
    catch (error) { if (error.code !== 'ENOENT') throw error; const data = JSON.parse(await readFile(resolve(root, 'content/figures', `${figure.id}.json`), 'utf8')); assert.equal(data.id, figure.id); figure.kind = 'json'; }
  }
  const features = await page.evaluate((blocks) => {
    const visible = (element) => element.getClientRects().length > 0;
    const katex = [...document.querySelectorAll('.katex')];
    const imageInfo = (i) => ({ src: i.getAttribute('src'), alt: i.alt.trim(), loaded: i.complete && i.naturalWidth > 0 });
    const figures = [...document.querySelectorAll('main figure.textbook-figure')].map((figure) => {
      const img = figure.querySelector('img'), svg = figure.querySelector('svg');
      return { id: figure.dataset.figure ?? null, alt: figure.querySelector('figcaption')?.textContent.trim() ?? '', loaded: img ? img.complete && img.naturalWidth > 0 && !!img.alt.trim() : !!(svg?.querySelector('title') && svg?.querySelector('desc') && svg.getAttribute('role') === 'img'), encodedAsset: img?.getAttribute('src') ?? null };
    });
    const images = [...document.querySelectorAll('main img')].filter((img) => !img.closest('figure.textbook-figure')).map(imageInfo);
    const singleColumns = [];
    for (const cell of document.querySelectorAll('main .textbook-table-scroll :is(th,td)')) {
      if (!visible(cell)) continue;
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT); const lines = new Map();
      while (walker.nextNode()) for (let i = 0; i < walker.currentNode.textContent.length; i++) {
        if (/\s/.test(walker.currentNode.textContent[i])) continue;
        const range = document.createRange(); range.setStart(walker.currentNode, i); range.setEnd(walker.currentNode, i + 1);
        const rect = range.getBoundingClientRect(); if (rect.width) { const y = Math.round(rect.y); lines.set(y, (lines.get(y) ?? 0) + 1); }
      }
      if (lines.size > 1 && Math.max(...lines.values()) <= 1) singleColumns.push(cell.textContent);
    }
    const rgba = (color) => { const channels = color.match(/[\d.]+/g)?.map(Number); return channels?.length >= 3 ? [channels[0], channels[1], channels[2], channels[3] ?? 1] : null; };
    const luminance = (channels) => channels.map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const contrast = [];
    for (const element of document.querySelectorAll('main pre, main pre span, main figcaption, main .starlight-aside__title, main .supplement-source')) {
      if (!visible(element) || !element.textContent.trim() || (element.tagName === 'SPAN' && element.children.length)) continue;
      const foreground = rgba(getComputedStyle(element).color); if (!foreground) continue;
      const ancestors = []; for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
      let background = [255, 255, 255];
      for (const ancestor of ancestors) { const c = rgba(getComputedStyle(ancestor).backgroundColor); if (c) background = background.map((v, i) => c[i] * c[3] + v * (1 - c[3])); }
      const fg = luminance(foreground.slice(0, 3).map((c, i) => c * foreground[3] + background[i] * (1 - foreground[3]))), bg = luminance(background);
      contrast.push({ text: element.textContent.trim().slice(0, 100), ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) });
    }
    const sourceBlocks = blocks.map(({ key, selector }) => {
      // 多個 selector 命中同一正文只取一次；一般正文與自動關係表分開。
      const roots = [...document.querySelectorAll(selector)].filter((element, index, all) => !all.some((other, j) => j !== index && other.contains(element)));
      const select = (query) => roots.flatMap((element) => [...element.querySelectorAll(query)]);
      const cellText = (cell) => {
        const copy = cell.cloneNode(true);
        for (const math of copy.querySelectorAll('.katex')) math.replaceWith(math.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? '');
        for (const image of copy.querySelectorAll('img')) image.replaceWith(image.alt);
        return copy.textContent;
      };
      const codes = select('pre').filter((pre) => !pre.closest('figure.study-diagram')).map((pre) => {
        const code = pre.querySelector('code');
        const language = pre.getAttribute('data-language') ?? code?.getAttribute('data-language') ?? /(?:^|\s)language-([^\s]+)/.exec(code?.className ?? pre.className ?? '')?.[1] ?? pre.closest('.question-code')?.querySelector('.code-label')?.firstChild?.textContent.trim() ?? '';
        return { language, text: (code ?? pre).textContent };
      });
      return { key, codes, diagrams: select('figure.study-diagram svg').length, formulas: select('.katex').map((element) => element.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? ''), katex: select('.katex').length, mathml: select('.katex math').length, tables: select('table').map((table) => [...table.rows].map((row) => [...row.cells].map(cellText))) };
    });
    return { blocks: sourceBlocks, katex: katex.length, mathml: document.querySelectorAll('.katex math').length, errors: document.querySelectorAll('.katex-error').length, tables: document.querySelectorAll('main table').length, code: document.querySelectorAll('main pre').length, diagrams: document.querySelectorAll('main figure.study-diagram svg').length, figures, images, singleColumns, contrast: { total: contrast.length, minimum: contrast.length ? Math.min(...contrast.map((c) => c.ratio)) : null, failed: contrast.filter((c) => c.ratio < 4.5) } };
  }, expected.blocks ?? []);
  for (const figure of features.figures) { if (figure.encodedAsset?.startsWith('data:image/svg+xml;base64,')) figure.assetSha256 = hash(Buffer.from(figure.encodedAsset.split(',')[1], 'base64')); delete figure.encodedAsset; }
  assertFeatureInventory(features, expected);
  features.sourceExpected = expected;
  assert.deepEqual(features.singleColumns, [], '表格不能變成單字直排'); assert.deepEqual(features.contrast.failed, [], '程式／圖說／提示／來源對比需達 4.5');
  features.keyboardScroll = [];
  const wrappers = page.locator('main .textbook-table-scroll');
  for (let i = 0; i < await wrappers.count(); i++) {
    const wrapper = wrappers.nth(i);
    if (!await wrapper.isVisible()) continue;
    const info = await wrapper.evaluate((e) => ({ client: e.clientWidth, scroll: e.scrollWidth, tabIndex: e.tabIndex }));
    if (info.scroll <= info.client) continue;
    assert.equal(info.tabIndex, 0); await wrapper.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); assert.equal(await wrapper.evaluate((e) => document.activeElement === e), true);
    await page.keyboard.press('ArrowRight'); await page.waitForFunction((i) => document.querySelectorAll('main .textbook-table-scroll')[i].scrollLeft > 0, i);
    await wrapper.evaluate((e) => { e.scrollLeft = 0; e.blur(); }); features.keyboardScroll.push(info);
  }
  return features;
}

/** 補充切換覆蓋段落、表列、清單與無補充頁；檢核理由與閱讀開關另由逐碼測試驗證。 */
async function supplementRegression({ content, page, navigate, attempt }) {
  const selections = [
    ['paragraph', (c) => supplementCounts(c.body).paragraph],
    ['row', (c) => /^\s*\|.*（補充）/m.test(c.body)],
    ['list', (c) => /^\s*(?:[-*]|\d+\.)\s+.*（補充）/m.test(c.body)],
    ['none', (c) => !/（補充）|:::supplement/.test(c.body)],
  ];
  for (const [kind, predicate] of selections) {
    const concept = content.concepts.find(predicate);
    for (const cell of CELLS) await attempt('R5', `補充 ${kind} ${cell.width}/${cell.theme}`, page, async () => {
      assert.ok(concept, `缺 ${kind} 代表頁`); await navigate(page, `/concepts/${concept.id}/`, cell);
      const storage = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
      const count = await page.locator('#concept-body [data-supplement]').count();
      const visibleBefore = await page.locator('#concept-body [data-supplement]:visible').count();
      if (kind === 'none') { assert.equal(count, 0); assert.equal(await page.locator('[data-supplement-filter]:visible').count(), 0); return { id: concept.id, count }; }
      assert.ok(count > 0);
      if (kind === 'paragraph') assert.ok(await page.locator('#concept-body [data-supplement-kind="paragraph"]').count() > 0);
      if (kind === 'row') assert.ok(await page.locator('tr[data-supplement-kind="row"]').count() > 0);
      if (kind === 'list') assert.ok(await page.locator('li[data-supplement-kind="list-item"]').count() > 0);
      const protectedBefore = await protectedState(page);
      const toggle = page.getByRole('switch', { name: '只看指引內容' }); await toggle.focus(); await page.keyboard.press('Space'); assert.equal(await toggle.isChecked(), true);
      assert.equal(await page.locator('#concept-body [data-supplement]:visible').count(), 0);
      const badToc = await page.locator('starlight-toc a[href], mobile-starlight-toc a[href]').evaluateAll((links) => links.filter((link) => { const target = document.getElementById(decodeURIComponent(new URL(link.href).hash.slice(1))); return target?.closest('[data-supplement]') && link.getClientRects().length; }).map((link) => link.href));
      assert.deepEqual(badToc, []); assertProtectedState(await protectedState(page), protectedBefore);
      await toggle.focus(); await page.keyboard.press('Space'); assert.equal(await toggle.isChecked(), false);
      assert.equal(await page.locator('#concept-body [data-supplement]:visible').count(), visibleBefore);
      assertProtectedState(await protectedState(page), protectedBefore);
      assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), storage);
      return { id: concept.id, count, ...cell };
    });
  }
}

/** 備份經 UI 匯入匯出；故障注入只作用於本次新 context，不使用共享頁或清除既有 context。 */
export async function storageRegression({ content, context, navigate, attempt, result, report, output }) {
  const ctx = await context(); const page = await ctx.newPage();
  const selected = [...new Map([
    content.questions.find((q) => q.source === 'exam' && q.subject === 1 && !q.codes.includes('L23303')),
    content.questions.find((q) => q.source === 'exam' && q.subject === 3 && !q.codes.includes('L23303')),
    content.questions.find((q) => q.id === '115-1-S3-Q44'), content.questions.find((q) => q.id === '114-2-S3-Q34'),
  ].filter(Boolean).map((q) => [q.id, q])).values()];
  const upload = async (target, payload) => {
    // 先清掉本隔離頁的舊回饋，避免第二次匯入誤把上一次的結果當新結果；不碰 storage。
    await target.locator('#import-status').evaluate((element) => { element.textContent = ''; });
    await target.locator('#import-attempts').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
    await target.locator('#import-status').filter({ hasText: /匯入/ }).waitFor();
  };
  const backup = (target, name) => exportUiBackup(target, output, name);
  try {
    await attempt('R7', '跨科作答／備份／舊rev／未知qid', page, async () => {
      assert.ok(selected.some((q) => q.subject === 1) && selected.some((q) => q.subject === 3 && !q.codes.includes('L23303')), '缺跨科代表題');
      for (const q of selected) {
        await navigate(page, `/questions/${q.id}/`);
        assert.equal(await page.locator('[data-explanation]').isVisible(), false);
        const wrong = ['A', 'B', 'C', 'D'].find((c) => c !== q.answer);
        await page.locator(`input[value="${wrong}"]`).check(); await page.getByRole('button', { name: '確認作答' }).click(); await page.locator('[data-explanation]:visible').waitFor();
        if (q.id === '114-2-S3-Q34') assert.equal(await page.locator('.dispute').isVisible(), true);
      }
      await navigate(page, '/wrong-book/');
      for (const q of selected) assert.equal(await page.locator(`.wrong-item[data-qid="${q.id}"]`).count(), 1);
      const payload = await backup(page, 'cross-subject-backup.json'); assert.equal(payload.version, 1); assert.equal(payload.attempts.length, selected.length);
      const restore = await context(); const restored = await restore.newPage();
      try {
        await navigate(restored, '/wrong-book/'); await upload(restored, payload);
        assert.match(await restored.locator('#import-status').innerText(), new RegExp(`新增 ${selected.length} 筆`));
        await upload(restored, payload); assert.match(await restored.locator('#import-status').innerText(), new RegExp(`新增 0 筆、略過重複 ${selected.length} 筆`));
        const exported = await backup(restored, 'restored-backup.json'); assert.deepEqual(exported, payload);
        const q = selected[0]; await navigate(restored, `/questions/${q.id}/`); await restored.locator(`input[value="${q.answer}"]`).check(); await restored.getByRole('button', { name: '確認作答' }).click(); await restored.locator('[data-explanation]:visible').waitFor();
        await navigate(restored, '/wrong-book/'); assert.equal(await restored.locator(`.wrong-item[data-qid="${q.id}"]`).count(), 0);
        const old = { ...payload.attempts[0], id: 'rollout-noncurrent-rev', rev: q.rev > 1 ? q.rev - 1 : q.rev + 1, correct: false, ts: '2099-01-01T00:00:00Z' };
        const unknown = { ...old, id: 'rollout-unknown', qid: 'rollout-unknown-qid' };
        const outdatedOnly = { ...old, id: 'rollout-outdated-only', qid: selected[1].id, rev: selected[1].rev > 1 ? selected[1].rev - 1 : selected[1].rev + 1 };
        await upload(restored, { version: 1, attempts: [old, unknown, outdatedOnly] });
        assert.equal(await restored.locator(`.wrong-item[data-qid="${q.id}"]`).count(), 0, '較晚非目前版本紀錄不能蓋過目前答對');
        const unknownRow = restored.locator('.wrong-item[data-qid="rollout-unknown-qid"]'); assert.match(await unknownRow.innerText(), /題目已更新/); assert.equal(await unknownRow.locator('a').count(), 0);
        const oldContext = await context(); const oldPage = await oldContext.newPage();
        try { await navigate(oldPage, '/wrong-book/'); await upload(oldPage, { version: 1, attempts: [outdatedOnly] }); assert.match(await oldPage.locator(`.wrong-item[data-qid="${selected[1].id}"]`).innerText(), /題目已更新/); } finally { await oldContext.close(); }
        const final = await backup(restored, 'mixed-revisions-backup.json'); assert.equal(final.attempts.length, selected.length + 4);
        if (q.rev === 1 || selected[1].rev === 1) report.checks.R7.pending.push({ name: 'older-positive-revision', status: '未執行', reason: '代表題目前 rev=1，沒有合法正整數舊版；本次只注入非目前 rev=2 驗證 outdated 與當前版本優先；合法舊版須另跑離線 fixtures，不引用未執行的 Vitest 結果' });
        // 依實際匯出的紀錄獨立核對首頁與錯題統計，不讀或改產品純函式。
        const byId = new Map(content.questions.map((item) => [item.id, item]));
        const current = final.attempts.filter((a) => byId.get(a.qid)?.rev === a.rev);
        const exam = content.questions.filter((item) => item.source === 'exam');
        const examIds = new Set(exam.map((item) => item.id)); const currentExam = current.filter((a) => examIds.has(a.qid));
        const accuracy = (items) => items.length ? `${Math.round(items.filter((a) => a.correct).length / items.length * 100)}%` : '—';
        await navigate(restored, '/');
        assert.equal((await restored.locator('.stat-grid > .stat-card').nth(1).locator('strong').innerText()).replace(/\s/g, ''), `${exam.length}題`);
        assert.match(await restored.locator('#home-progress').innerText(), new RegExp(`^${new Set(currentExam.map((a) => a.qid)).size}\\s*/\\s*${exam.length}\\s*題`));
        assert.ok((await restored.locator('#home-accuracy').innerText()).includes(accuracy(currentExam)));
        await navigate(restored, '/wrong-book/'); assert.equal(await restored.locator('#wrong-accuracy').innerText(), accuracy(current));
        const codeStats = [];
        for (const route of content.codes) {
          const attempts = current.filter((a) => byId.get(a.qid).codes.includes(route.code));
          const card = restored.locator('.stat-card').filter({ hasText: route.code }); assert.equal(await card.count(), 1, `缺 ${route.code} 正確率卡片`);
          assert.equal((await card.locator('strong').innerText()).trim(), accuracy(attempts)); codeStats.push({ code: route.code, total: attempts.length, correct: attempts.filter((a) => a.correct).length });
        }
        return { questionIds: selected.map((q) => q.id), restored: exported.attempts.length, nonCurrentRevision: { current: q.rev, injected: old.rev, direction: old.rev < q.rev ? '舊版' : '較新版本，不冒稱舊版' }, unknown, finalAttempts: final.attempts.length, home: { done: new Set(currentExam.map((a) => a.qid)).size, total: exam.length, accuracy: accuracy(currentExam) }, codeStats };
      } finally { await restore.close(); }
    });
    for (const fault of ['quota', 'unavailable', 'corrupt-json', 'wrong-version', 'partial-import']) {
      const broken = await context(); const target = await broken.newPage(); target.setDefaultTimeout(10000);
      try { await attempt('R8', fault, target, async () => {
        assert.ok(selected.length);
        const seed = { version: 1, attempts: [{ id: `history-${fault}`, qid: selected[0].id, rev: selected[0].rev, choice: selected[0].answer, correct: true, ts: '2026-11-01T00:00:00Z', mode: 'single', ms: 42 }], readings: [{ conceptId: 'data-leakage', ts: '2026-11-01T00:00:00Z' }] };
        await navigate(target, '/wrong-book/'); await upload(target, seed);
        assertHistory(await backup(target, `${fault}-before.json`), seed);
        const originalRaw = await target.evaluate(() => ({ attempts: localStorage.getItem('ipas-attempts-v1'), reading: localStorage.getItem('ipas-reading-v1') }));
        if (['quota', 'unavailable'].includes(fault)) {
          await broken.addInitScript(installStorageFault);
          await target.evaluate(installStorageFault);
          await target.evaluate((value) => sessionStorage.setItem('rollout-fault', value), fault);
        }
        if (['corrupt-json', 'wrong-version'].includes(fault)) await target.evaluate((value) => localStorage.setItem('ipas-attempts-v1', value), fault === 'corrupt-json' ? '{' : '{"version":99,"attempts":[]}');
        if (fault === 'partial-import') {
          const fixture = { version: 1, attempts: [{ id: 'valid-fixture', qid: selected[0].id, rev: selected[0].rev, choice: selected[0].answer, correct: true, ts: '2026-11-02T00:00:00Z', mode: 'single', ms: 1 }, { id: 'broken' }] };
          await upload(target, fixture); assert.match(await target.locator('#import-status').innerText(), /新增 1 筆、略過重複 0 筆、格式無效 1 筆/);
          await upload(target, { version: 99, attempts: fixture.attempts }); assert.match(await target.locator('#import-status').innerText(), /新增 0 筆.*格式無效 2 筆/);
          const exported = await backup(target, 'partial-import-backup.json'); assertHistory(exported, { ...seed, attempts: [...seed.attempts, fixture.attempts[0]] }); return { seed, fixture, exported };
        }
        await navigate(target, `/quiz/?code=${selected[0].codes[0]}`);
        const count = await target.locator('[data-question]').count(); assert.ok(count > 0);
        for (let i = 0; i < count; i++) {
          const card = target.locator('[data-question]:visible'); await card.locator('input').first().check(); await card.getByRole('button', { name: '確認作答' }).click();
          await card.locator('[data-explanation]:visible').waitFor(); assert.match(await card.locator('.save-error').innerText(), /未儲存/); await target.locator('#next-question').click();
        }
        assert.match(await target.locator('#final-message').innerText(), /未成功儲存/);
        await navigate(target, '/wrong-book/');
        let feedback;
        if (fault === 'quota') assertHistory(await backup(target, 'quota-backup.json'), seed);
        else {
          feedback = await target.locator('#import-status').innerText(); assert.match(feedback, /無法讀取紀錄/);
          await target.locator('#export-attempts').click(); assert.match(await target.locator('#import-status').innerText(), /匯出失敗/);
        }
        await target.evaluate(() => sessionStorage.removeItem('rollout-fault'));
        assert.equal(await target.evaluate(() => localStorage.getItem('ipas-reading-v1')), originalRaw.reading, '未損壞的閱讀 key 不能被清除或改寫');
        const afterRaw = await target.evaluate(() => localStorage.getItem('ipas-attempts-v1'));
        if (['corrupt-json', 'wrong-version'].includes(fault)) {
          assert.equal(afterRaw, fault === 'corrupt-json' ? '{' : '{"version":99,"attempts":[]}', '產品不能靜默清掉損壞 payload');
          // 僅解除測試自己注入的損壞值，閱讀 key 不動；接著用 UI 匯出核對原歷史。
          await target.evaluate((raw) => localStorage.setItem('ipas-attempts-v1', raw), originalRaw.attempts);
        } else assert.equal(afterRaw, originalRaw.attempts, '寫入故障不能改變舊歷史');
        await navigate(target, '/wrong-book/');
        const recovered = await backup(target, `${fault}-recovered.json`); assertHistory(recovered, seed);
        return { fault, feedback, answered: count, seed, recovered, readingPreserved: true, corruptionRestoredByHarness: ['corrupt-json', 'wrong-version'].includes(fault) };
      }); } finally { await broken.close(); }
    }
  } finally { await ctx.close(); }
}

async function main() {
  if (process.argv.includes('--self-test')) { console.log(JSON.stringify(selfTest())); return; }
  const args = process.argv.slice(2); const get = (key) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  if (get('--capture-build-source')) { await captureBuild(get('--capture-build-source')); return; }
  if (get('--write-build-receipt')) { assert.ok(get('--source-snapshot')); await captureBuild(get('--write-build-receipt'), get('--source-snapshot')); return; }
  assert.ok(get('--output') && get('--sha') && get('--build-sha') && get('--build-time'), '用法：node demo/scripts/rollout-smoke.mjs --output tmp/<獨立目錄> --sha <凍結SHA> --build-sha <建置SHA> --build-time <ISO> [--execute]；預設只讀盤點，瀏覽器由協調者加 --execute');
  const report = await runRollout({ output: get('--output'), sha: get('--sha'), buildSha: get('--build-sha'), buildTime: get('--build-time'), buildReceipt: get('--build-receipt'), base: get('--base'), execute: args.includes('--execute'), evidence: Object.fromEntries(['smoke', 'map', 'figures', 'cheatsheets'].map((key) => [key, get(`--${key}-report`)])) });
  console.log(JSON.stringify({ counts: report.counts, checks: Object.fromEntries(Object.entries(report.checks).map(([key, value]) => [key, { status: value.status, assertions: { passed: value.passed, total: value.total }, coverage: value.coverage }])) }, null, 2));
  if (Object.values(report.checks).some((check) => check.status !== '通過') || report.manualReview.status !== '通過') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
