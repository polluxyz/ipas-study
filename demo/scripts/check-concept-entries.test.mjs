/** 以離線固定來源及HTML測試正反例；不啟動瀏覽器或連外網。 */
import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { APPROVED_IDS, RELATION_TYPES, checkConceptEntries, main, sha256 } from './check-concept-entries.mjs';
const fixturePath = resolve(import.meta.dirname, '../../tests/fixtures/concept-entries/valid.json');
const fixture = async () => JSON.parse(await readFile(fixturePath, 'utf8'));
const codes = (report) => report.issues.map((issue) => issue.code);
const first = (input) => input.evidence.entries[0];
const route = (input) => input.content.codes[0];
const routeHtml = (input) => input.rendered[route(input).file];
const mutateHtml = (input, change) => { input.rendered[route(input).file] = change(routeHtml(input)); };

describe('固定概念閱讀入口', () => {
  it('固定名單與已核可的8個ID完全一致，fixture保留兩種原始計數', async () => {
    expect(APPROVED_IDS).toEqual(['ai-team-capability', 'cyclic-time-features', 'multimodal-privacy-security', 'ndcg', 'open-weight-models', 'text-generation-platforms', 'development-toolchain', 'text-generation-workflow']);
    const report = checkConceptEntries(await fixture());
    expect(report.issues).toEqual([]);
    expect(report.counts).toMatchObject({ concepts: 10, questions: 1, codes: 1, relations: 1, c12Warnings: 8, rawStrongGaps: 8, approvedLimit: 8, technicallyValidExceptions: 8, technicallyUnexempted: 0 });
    expect(report.semanticReview).toContain('pending');
    expect(report.finalAcceptance).toContain('pending');
    expect(report.renderedHashes).toHaveProperty('content/codes/L00001.md');
    const input = await fixture(), before = JSON.stringify(input);
    checkConceptEntries(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    ['來源SHA變更', (x) => { route(x).fileSha256 = sha256('來源已變更'); }, 'HASH'],
    ['目標SHA變更', (x) => { x.content.concepts[0].fileSha256 = sha256('目標已變更'); }, 'HASH'],
    ['來源位元組變更', (x) => { x.sourceFiles[route(x).file] += '修改'; }, 'HASH'],
    ['目標位元組變更', (x) => { x.sourceFiles[x.content.concepts[0].file] += '修改'; }, 'HASH'],
    ['不完整SHA', (x) => { first(x).target.sha256 = '1234567'; }, 'HASH'],
    ['核可依據SHA變更', (x) => { x.sourceFiles['docs/specs/fixture-approval.md'] += '修訂'; }, 'BASIS_HASH'],
    ['近鄰SHA變更', (x) => { first(x).exclusions.questions[0].sha256 = sha256('另版題目'); }, 'NEIGHBOR_HASH'],
    ['缺href', (x) => mutateHtml(x, (s) => s.replace('href="/concepts/ai-team-capability/"', '')), 'RENDER_ENTRY'],
    ['只有字串但沒有anchor', (x) => mutateHtml(x, (s) => s.replace('<a class="route-concept" href="/concepts/ai-team-capability/">', '<div class="route-concept">').replace('</a>', '</div>')), 'RENDER_ENTRY'],
    ['錯誤href', (x) => { first(x).href = '/concepts/ndcg/'; }, 'HREF'],
    ['無學習目的', (x) => { first(x).purpose = ' '; }, 'PURPOSE'],
    ['stage來源無goal', (x) => { route(x).stages[0].concepts[0].goal = ''; }, 'STAGE_SOURCE'],
    ['渲染goal消失', (x) => mutateHtml(x, (s) => s.replace(/<p class="route-goal">[^<]+<\/p>/, '')), 'RENDER_ENTRY'],
    ['stage文字不符', (x) => mutateHtml(x, (s) => s.replace('先確認問題，再讀各頁解釋及例子。', '自動目錄')), 'RENDER_ENTRY'],
    ['自動列表無stage目的', (x) => mutateHtml(x, (s) => s.replaceAll('route-goal', 'automatic-title').replaceAll('stage-intro', 'automatic-list')), 'RENDER_ENTRY'],
    ['缺目標建置頁', (x) => { delete x.rendered[x.content.concepts[0].file]; }, 'TARGET_RENDER'],
    ['缺來源建置頁', (x) => { delete x.rendered[route(x).file]; }, 'RENDER_MISSING'],
    ['目標缺正文容器', (x) => { x.rendered[x.content.concepts[0].file] = '<main>空白頁</main>'; }, 'TARGET_RENDER'],
    ['無指引依據', (x) => { first(x).basis = []; }, 'BASIS'],
    ['無題目排除理由', (x) => { first(x).exclusions.questions[0].reason = ''; }, 'EXCLUSIONS'],
    ['未知ID', (x) => { x.evidence.entries.push({ ...first(x), id: 'unapproved-ninth-id' }); }, 'UNKNOWN_ID'],
    ['重複ID', (x) => { x.evidence.entries.push(structuredClone(first(x))); }, 'DUPLICATE_ID'],
    ['缺固定ID', (x) => { x.evidence.entries.pop(); }, 'MISSING_ID'],
  ])('%s會拒絕', async (_label, mutate, expected) => {
    const input = await fixture(); mutate(input);
    expect(codes(checkConceptEntries(input))).toContain(expected);
  });

  it.each(RELATION_TYPES)('每一型%s都須有近鄰及排除理由', async (type) => {
    const input = await fixture();
    expect(codes(checkConceptEntries(input))).not.toContain('EXCLUSIONS');
    delete first(input).exclusions.relations[type];
    expect(codes(checkConceptEntries(input))).toContain('EXCLUSIONS');
  });

  it('新增第9個強缺口時保持失敗，不會擴張核可清單', async () => {
    const input = await fixture();
    const extra = { ...input.content.concepts[0], id: 'new-isolated-page', file: 'content/concepts/new-isolated-page.md' };
    input.content.concepts.push(extra); input.rendered[extra.file] = '<div id="concept-body"><p>新頁</p></div>';
    const report = checkConceptEntries(input);
    expect(report.counts.rawStrongGaps).toBe(9);
    expect(report.counts.technicallyValidExceptions).toBe(8);
    expect(report.technicallyUnexempted).toEqual(['new-isolated-page']);
    expect(codes(report)).toContain('UNEXEMPTED');
  });

  it.each(['question', ...RELATION_TYPES])('新增正式%s引用後回一般規則，停用舊例外', async (kind) => {
    const input = await fixture(), id = first(input).id;
    if (kind === 'question') input.content.questions[0].concepts.push(id);
    else {
      const parent = input.content.concepts.find((c) => c.id === 'fixture-parent');
      parent.kind = kind === 'mitigates' ? 'problem' : 'technique';
      input.content.concepts[0].kind = 'technique';
      input.content.concepts[0][kind] = [kind === 'mitigates' || kind === 'contrasts' ? { target: parent.id, note: '新主審接受的fixture關係', source: ['fixture-question'] } : parent.id];
    }
    // 新關係／引用可能伴隨目標版本變更；一般規則不受失效的舊例外證據阻擋。
    input.content.concepts[0].fileSha256 = sha256('新版合法內容');
    first(input).purpose = ''; first(input).source.sha256 = 'old';
    const report = checkConceptEntries(input);
    expect(report.issues).toEqual([]);
    expect(report.results.find((item) => item.id === id).status).toBe('general-rule');
    expect(report.counts).toMatchObject({ rawStrongGaps: 7, technicallyValidExceptions: 7, technicallyUnexempted: 0 });
  });

  it('正文入口須有同一行來源、實際段落、href與目的；自我、搜尋及自動目錄不能替代', async () => {
    const input = await fixture(), record = first(input);
    const source = input.content.concepts.find((c) => c.id === 'fixture-child');
    const quote = '比較工具前，先讀 [[ai-team-capability]] 確認技能缺口。';
    source.body = quote;
    input.sourceFiles[source.file] = `---\nid: fixture-child\n---\n${quote}\n`;
    source.fileSha256 = sha256(input.sourceFiles[source.file]);
    record.source = { file: source.file, sha256: source.fileSha256 };
    record.location = { kind: 'body', line: 4, sourceQuote: quote, renderedContext: '比較工具前，先讀人才盤點確認技能缺口。' };
    const paragraph = '<p>比較工具前，先讀<a href="/concepts/ai-team-capability/">人才盤點</a>確認技能缺口。</p>';
    input.rendered[source.file] = `<div id="concept-body">${paragraph}</div>`;
    const pass = checkConceptEntries(input);
    expect(pass.issues).toEqual([]);
    expect(pass.counts).toMatchObject({ rawStrongGaps: 8, c12Warnings: 7, technicallyValidExceptions: 8 });
    for (const bad of [
      `<nav>${paragraph}</nav><div id="concept-body"></div>`,
      `<div id="concept-body"><nav>${paragraph}</nav></div>`,
      `<div id="concept-body"><ul><li><a href="/concepts/ai-team-capability/">人才盤點</a></li></ul></div>`,
      `<div id="concept-body"><pre>${paragraph}</pre></div>`,
      `<div id="concept-body"><p>比較工具前，先讀人才盤點確認技能缺口。</p></div>`,
    ]) {
      input.rendered[source.file] = bad;
      expect(codes(checkConceptEntries(input))).toContain('RENDER_ENTRY');
    }
    input.rendered[source.file] = `<div id="concept-body">${paragraph}</div>`;
    record.location.line = 5;
    expect(codes(checkConceptEntries(input))).toContain('BODY_SOURCE');
    record.location.line = 4; record.source = record.target;
    expect(codes(checkConceptEntries(input))).toContain('SELF_ENTRY');
  });

  it('C12只計其他概念正文入鏈，不借用路線、self_check或頁尾關係', async () => {
    const input = await fixture(), source = input.content.concepts.find((c) => c.id === 'fixture-child');
    const link = '<a href="/concepts/ai-team-capability/">人才盤點</a>';
    input.rendered[source.file] = `<div id="concept-body"><p>正文</p></div><section id="self-check">${link}</section><nav>${link}</nav>`;
    expect(checkConceptEntries(input).counts.c12Warnings).toBe(8);
    input.rendered[source.file] = `<div id="concept-body"><p>${link}</p></div>`;
    expect(checkConceptEntries(input).counts.c12Warnings).toBe(7);
  });

  it('CLI支援離線fixture，拒絕缺收據、未知參數與混用模式', async () => {
    const stdout = [], stderr = [], io = { stdout: { write: (s) => stdout.push(s) }, stderr: { write: (s) => stderr.push(s) } };
    expect(await main(['--input', fixturePath], io)).toBe(0);
    expect(JSON.parse(stdout.pop()).counts.technicallyValidExceptions).toBe(8);
    expect(await main(['--input', resolve(fixturePath, '../missing-link.json')], io)).toBe(1);
    expect(JSON.parse(stdout.pop()).technicallyUnexempted).toEqual(['ai-team-capability']);
    expect(await main([], io)).toBe(2);
    expect(await main(['--input', fixturePath, '--root', '.'], io)).toBe(2);
    expect(await main(['--root'], io)).toBe(2);
    expect(await main(['--invalid'], io)).toBe(2);
    expect(await main(['--input', 'missing-fixture.json'], io)).toBe(2);
    expect(await main(['--help'], io)).toBe(0);
  });

  it('匯入模組不掃描cwd、不讀題庫、不寫檔或執行CLI', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'concept-entry-import-'));
    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./check-concept-entries.mjs', import.meta.url).href)}); process.stdout.write('imported');`], { cwd: directory, encoding: 'utf8' });
      expect(result.status).toBe(0); expect(result.stdout).toBe('imported'); expect(result.stderr).toBe('');
    } finally { await rm(directory, { recursive: true }); }
  });
});
