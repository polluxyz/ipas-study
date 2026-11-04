/** 獨立核對當版產物與原MD；所有預算沿用r2，不讀原型驗收值。 */
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadContent } from './rollout-smoke.mjs';
const types = ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'];
const root = resolve(import.meta.dirname, '../..'), dist = resolve(root, 'demo/dist');
const gz = (value) => gzipSync(value, { level: 9 }).length;
export function moduleRefs(text, dynamic = true) {
  const pattern = dynamic ? /["'`](\.\.?\/[^"'`]+\.js)["'`]/g : /(?:from\s*|import\s*)["'`](\.\.?\/[^"'`]+\.js)["'`]/g;
  return [...text.matchAll(pattern)].map((match) => match[1]);
}
export function removePanel(html) {
  const start = html.indexOf('<details class="graph3d"'); assert.ok(start >= 0);
  const tags = /<details\b[^>]*>|<\/details>/g; tags.lastIndex = start; let depth = 0, end = 0;
  for (let match; (match = tags.exec(html));) { depth += match[0].startsWith('</') ? -1 : 1; if (!depth) { end = tags.lastIndex; break; } }
  assert.ok(end > start); return html.slice(0, start) + html.slice(end);
}
export async function auditGraph(output) {
  const content = await loadContent(), files = (await readdir(resolve(dist, 'graph'))).filter((f) => f.endsWith('.json')); assert.equal(files.length, 1, '同版只能1份圖資產');
  const bytes = await readFile(resolve(dist, 'graph', files[0])), data = JSON.parse(bytes);
  assert.equal(files[0], `${data.head}-${data.sourceHash}.json`, 'URL必須含所有payload版本欄');
  assert.deepEqual(data.concepts.map((n) => n.id).sort(), content.concepts.map((n) => n.id).sort());
  assert.equal(new Set(data.concepts.map((n) => n.id)).size, content.concepts.length); assert.equal(data.units.length, content.codes.length);
  const expected = content.concepts.flatMap((c) => types.flatMap((type) => (c[type] ?? []).map((r) => ({ id: `${type}:${c.id}:${typeof r === 'string' ? r : r.target}`, source: c.id, target: typeof r === 'string' ? r : r.target, type, note: typeof r === 'string' ? null : r.note ?? null, sources: typeof r === 'string' ? [] : r.source, directed: type !== 'contrasts' })))).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(data.formalEdges.map(({ origin, ...e }) => ({ ...e, note: e.note ?? null })).sort((a, b) => a.id.localeCompare(b.id)), expected);
  const rawFiles = new Map();
  for (const source of data.sources) { const raw = await readFile(resolve(root, source.path)); assert.equal(createHash('sha256').update(raw).digest('hex'), source.sha256); rawFiles.set(source.path, raw.toString()); }
  for (const edge of data.formalEdges) assert.ok(rawFiles.get(edge.origin.path).split('\n')[edge.origin.line - 1].includes(edge.target), `正式來源行：${edge.id}`);
  for (const edge of data.bodyEdges) for (const mention of edge.origins) assert.match(rawFiles.get(mention.origin.path).split('\n')[mention.origin.line - 1], /\[\[/);
  assert.deepEqual(data.unitAggregation.flatMap((r) => { assert.equal(r.count, r.edgeIds.length); return r.edgeIds; }).sort(), expected.map((e) => e.id).sort());
  const approved = JSON.parse(await readFile(resolve(root, 'docs/acceptance/concept-entry-exceptions.json'), 'utf8')).entries.map((e) => e.id);
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  const inputHashes = [...data.sources.map((source) => [source.path, source.sha256]), ['docs/acceptance/concept-entry-exceptions.json', sha(await readFile(resolve(root, 'docs/acceptance/concept-entry-exceptions.json')))]];
  const references = content.questions.map((question) => ({ id: question.id, concepts: [...question.concepts].sort() })).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(data.sourceHash, sha(inputHashes.sort(([a], [b]) => a.localeCompare(b)).map(([path, digest]) => `${path}\0${digest}\n`).join('') + `question-references\0${sha(JSON.stringify(references))}`), '來源簽章必須包含當版MD、例外清單及題目引用');
  const questionIds = new Set(content.questions.flatMap((q) => q.concepts));
  for (const n of data.concepts) { const d = expected.filter((e) => e.source === n.id || e.target === n.id).length; assert.equal(n.typedDegree, d); assert.equal(n.exception, approved.includes(n.id) && d === 0 && !questionIds.has(n.id)); }
  const pages = [], graphReference = `/graph/${files[0]}`;
  for (const concept of content.concepts) {
    const html = await readFile(resolve(dist, 'concepts', concept.id, 'index.html'), 'utf8');
    assert.equal((html.match(/data-graph3d(?:\s|>)/g) ?? []).length, 1, `${concept.id}恰好1面板`); assert.ok(html.includes(`data-local="${concept.id}"`)); assert.ok(html.includes(graphReference));
    assert.ok(html.includes(`data-head="${data.head}"`) && html.includes(`data-hash="${data.sourceHash}"`));
    assert.ok(!html.includes('"formalEdges":') && !html.includes('"unitAggregation":'), '頁面不可內嵌全圖');
    for (const id of ['concept-body', 'connections']) assert.ok(html.includes(`id="${id}"`), `${concept.id}原錨點${id}`);
    const without = removePanel(html).replace(/<script[^>]*src="[^"]*ConceptGraph3D[^\"]*"[^>]*><\/script>/g, '').replace(/<link[^>]*href="[^"]*ConceptGraph3D[^\"]*"[^>]*>/g, '');
    pages.push({ id: concept.id, gzip: gz(html), withoutPanelGzip: gz(without), delta: gz(html) - gz(without) });
  }
  const mapHtml = await readFile(resolve(dist, 'map/index.html'), 'utf8'); assert.equal((mapHtml.match(/data-catalog-id=/g) ?? []).length, content.concepts.length);
  const boot = [...mapHtml.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).find((p) => p.includes('ConceptGraph3D')); assert.ok(boot);
  const chunks = new Map();
  async function collect(url) { if (chunks.has(url)) return; const text = await readFile(resolve(dist, url.replace(/^\//, '')), 'utf8'); chunks.set(url, { bytes: text.length, gzip: gz(text) }); for (const reference of moduleRefs(text)) await collect(new URL(reference, `https://local${url}`).pathname); }
  await collect(boot);
  const initial = new Set();
  async function collectInitial(url) { if (initial.has(url)) return; initial.add(url); const text = await readFile(resolve(dist, url.slice(1)), 'utf8'); for (const reference of moduleRefs(text, false)) await collectInitial(new URL(reference, `https://local${url}`).pathname); }
  await collectInitial(boot);
  const css = (await readdir(resolve(dist, '_astro'))).filter((f) => /^ConceptGraph3D.*\.css$/.test(f)); assert.equal(css.length, 1); const cssBytes = await readFile(resolve(dist, '_astro', css[0]));
  const maxPage = pages.reduce((a, b) => a.delta > b.delta ? a : b), budgets = { js: { actual: [...chunks.values()].reduce((sum, c) => sum + c.gzip, 0), limit: 32 * 1024 }, boot: { actual: [...initial].reduce((sum, url) => sum + chunks.get(url).gzip, 0), limit: 2 * 1024 }, data: { actual: gz(bytes), limit: 224 * 1024 }, html: { actual: maxPage.delta, limit: 4 * 1024 }, css: { actual: gz(cssBytes), limit: 6 * 1024 } };
  const report = { format: 'graph3d-audit-v1', head: data.head, sourceHash: data.sourceHash, concepts: data.concepts.length, units: data.units.length, formal: expected.length, body: data.bodyEdges.length, effectiveExceptions: data.concepts.filter((n) => n.exception).map((n) => n.id), formalByType: Object.fromEntries(types.map((t) => [t, expected.filter((e) => e.type === t).length])), pages, maxPage, chunks: Object.fromEntries(chunks), budgets, methodology: '同版每頁HTML移除面板及其新增CSS/啟動器引用後，逐頁比較level9 gzip；不把舊內容HEAD頁當基準。', failures: Object.entries(budgets).filter(([, v]) => v.actual > v.limit).map(([key]) => key) };
  if (output) { await mkdir(output, { recursive: true }); await writeFile(resolve(output, 'graph3d-audit.json'), JSON.stringify(report, null, 2)); }
  assert.deepEqual(report.failures, [], '正式預算超標'); return { report, data, content };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify((await auditGraph(resolve(root, process.env.SMOKE_OUTPUT ?? 'tmp/full-site-3d-audit'))).report.budgets, null, 2));
