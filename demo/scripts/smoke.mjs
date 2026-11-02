/** 以本機瀏覽器驗收讀題、作答、備份還原、中文搜尋與手機版，並留下可回看的截圖。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadContent, localUrl, localGet, routeLocalOnly, chapterLabel, freshOutput, readBuildReceipt, watchBuildResponses, expectedTextbook404, sourceStageChecks, gotoSettled, settlePage, waitForSearch, assertSearchTop3 } from './rollout-smoke.mjs';

/** 比照手動連結轉換的文字節點及排除區，保留程式、公式與既有連結的原文。 */
export function hasUnconvertedWikiLink(main) {
  const walker = main.ownerDocument.createTreeWalker(main, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode, parent = node.parentElement;
    if (!parent || parent.closest('pre, code, math, .katex, a') || !parent.checkVisibility({ visibilityProperty: true })) continue;
    if (/\[\[([^\]]+)\]\]/.test(node.textContent)) return true;
  }
  return false;
}

/** 依主責路線及實際存在的頁面求相鄰頁；跨碼路線不得接管。 */
export function expectedNavigation(id, content) {
  const concept = content.concepts.find((item) => item.id === id);
  assert.ok(concept, `缺少概念：${id}`);
  const owner = concept.codes[0];
  const route = content.codes.find((item) => item.code === owner);
  const existing = new Set(content.concepts.map((item) => item.id));
  const order = route ? (route.stages ? route.stages.flatMap((stage) => stage.concepts.map((item) => item.id)) : route.concepts).filter((item) => existing.has(item)) : [];
  const index = order.indexOf(id);
  return { owner, listed: index >= 0, previous: index > 0 ? order[index - 1] : undefined, next: index >= 0 ? order[index + 1] : undefined };
}

export async function assertNavigation(previous, next, expected, id) {
  for (const [link, target, label] of [[previous, expected.previous, '上一節'], [next, expected.next, '下一節']]) {
    assert.equal(await link.count(), target ? 1 : 0, `${id} ${label}邊界`);
    if (target) assert.equal(await link.getAttribute('href'), `/concepts/${target}/`, `${id} ${label}主責路線`);
  }
}

/** 由題庫計算單元考古題各場次科目的分子、分母及四捨五入後百分比。 */
export function expectedSessionStats(questions, code) {
  const groups = new Map();
  for (const question of questions) {
    if (question.source !== 'exam') continue;
    const key = `${question.session} 科${question.subject}`;
    const group = groups.get(key) ?? { label: key, count: 0, total: 0 };
    group.total++;
    if (question.codes.includes(code)) group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.count > 0)
    .map(({ label, count, total }) => `${label} ${count} 題／目前載入 ${total} 題（${Math.round(count / total * 100)}%）`)
    .sort();
}

/** 每格各自比較，避免漏場次、重複場次或數字混到另一格。 */
export function assertSessionStats(actual, questions, code) {
  const expected = expectedSessionStats(questions, code);
  assert.ok(expected.length >= 3, '原驗收要求至少三組場次科目');
  for (const label of ['114-2 科1', '114-2 科3']) {
    assert.ok(expected.some((text) => text.startsWith(`${label} `)), `原驗收要求 ${label}`);
  }
  assert.deepEqual(actual.map((text) => text.replace(/\s+/g, ' ').trim()).sort(), expected, `${code} 場次科目統計須與題庫一致`);
}

/** 保留主流程與收尾錯誤，再以非零結果交給呼叫端。 */
export async function runSmokeWithCleanup({ report, run, finish, evidence, save, close, onFailure }) {
  let initialError, cleanupError;
  try { await run(); }
  catch (error) {
    initialError = error; report.completed = false; report.failure = error.message ?? String(error); report.initialFailure = String(error); report.initialFailureStack = error.stack ?? null;
    await onFailure().catch(() => undefined);
  }
  try { await finish(); }
  catch (error) {
    cleanupError = error; report.completed = false; report.cleanupFailure = String(error); report.cleanupFailureStack = error.stack ?? null;
    if (!initialError) report.failure = String(error);
  }
  try { report.buildResponses = [evidence()]; await save(); }
  finally { await close(); }
  if (initialError && cleanupError) throw new AggregateError([initialError, cleanupError], '驗收主流程與收尾均失敗');
  if (initialError || cleanupError) throw initialError ?? cleanupError;
}

/** 即使頁面等待失敗，仍封口監測並保留所有收尾錯誤。 */
export async function finishSmokePages(pages, finish, settle = settlePage) {
  const failures = [];
  for (const page of pages) {
    try { await settle(page); } catch (error) { failures.push(error); }
  }
  try { await finish(); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, '頁面與建置回應收尾失敗');
}

export async function main() {
const base = localUrl(process.env.DEMO_URL ?? 'http://127.0.0.1:4321', process.env.DEMO_URL ?? 'http://127.0.0.1:4321').origin;
const output = process.env.SMOKE_OUTPUT ? resolve(process.env.SMOKE_OUTPUT) : resolve(import.meta.dirname, '../../tmp/demo-shots');
assert.ok(process.env.SMOKE_OUTPUT, '請由協調者指定獨立 SMOKE_OUTPUT，勿寫入共享截圖目錄');
assert.equal(new URL(base).hostname, '127.0.0.1', '驗收 origin 固定使用 127.0.0.1');
const binding = await readBuildReceipt();
const content = await loadContent();
const route = content.codes.find((c) => c.code === 'L23303');
assert.ok(route?.stages?.length);
const textbookShots = resolve(output, 'textbook');
await freshOutput(output);
await mkdir(textbookShots, { recursive: true });
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, acceptDownloads: true, serviceWorkers: 'block' });
const finishBuildCheck = watchBuildResponses(context, binding, base, { allowTextbook404: process.env.TEXTBOOK_TEST_FIXTURES !== '1' });
const page = await context.newPage();
const errors = []; const external = []; const assets = [];
context.on('page', (target) => target.on('pageerror', (error) => errors.push(error.message)));
page.on('pageerror', (error) => errors.push(error.message));
context.on('response', (response) => { if (response.status() !== 200 && !(process.env.TEXTBOOK_TEST_FIXTURES !== '1' && expectedTextbook404(response, base))) assets.push({ url: response.url(), status: response.status() }); });
context.on('requestfailed', (request) => assets.push({ url: request.url(), error: request.failure()?.errorText }));
await routeLocalOnly(context, base, external, assets);
const report = { pages: 0, links: 0, wrongBook: false, exportImport: false, quiz: false, stages: 0, readingProgress: false, readingBackup: false, stageQuiz: false, searchFirst: null, searchTop3: [], mobile: [], visuals: { diagramLabelsInsideNodes: 0, wrongAndCorrectDistinct: false, codeContrast: {} }, browserErrors: errors, externalRequests: external };
report.sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8' }).trim();
report.buildSha = process.env.BUILD_SHA ?? null;
report.buildSha = binding.receipt.sha; report.receiptDigest = binding.receiptDigest;
report.assetFailures = assets;
report.selfCheckOrdering = { conceptPages: 0, stagePages: 0, fixtureConcept: false, fixtureStage: false };
async function assertCheckOrder(cards, label) {
  const types = await cards.evaluateAll((elements) => elements.map((element) => element.dataset.checkType));
  assert.deepEqual(types, [...types.filter((type) => type === 'choice'), ...types.filter((type) => type === 'short')], `${label} 應先顯示所有選擇題，再顯示簡答題`);
}
async function screenshot(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
}
async function stageScreenshot(page, name) {
  // 元素近照先暫藏浮動導覽，避免 Playwright 捲動時讓頁首蓋住階段標題。
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('*')) {
      if (!(element instanceof HTMLElement) || !['fixed', 'sticky'].includes(getComputedStyle(element).position)) continue;
      element.dataset.smokeVisibility = element.style.visibility; element.style.visibility = 'hidden';
    }
  });
  try { await page.locator('[data-stage]').first().screenshot({ path: resolve(output, name), animations: 'disabled' }); }
  finally { await page.evaluate(() => { for (const element of document.querySelectorAll('[data-smoke-visibility]')) { element.style.visibility = element.dataset.smokeVisibility; delete element.dataset.smokeVisibility; } }); }
}
async function codeContrast(page, theme) {
  return page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
    const pre = document.querySelector('.question-code pre');
    function luminance(color) {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    }
    const background = getComputedStyle(pre).backgroundColor;
    const bg = luminance(background);
    const tokens = [pre, ...pre.querySelectorAll('span')].filter((element) => element.textContent.trim() && (element === pre || element.children.length === 0));
    const values = tokens.map((element) => { const fg = luminance(getComputedStyle(element).color); return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05); });
    return { minimum: Number(Math.min(...values).toFixed(2)), tokens: values.length, background };
  }, theme);
}
async function verifySupplements(checkRealPages = true) {
  await page.setViewportSize({ width: 1440, height: 1050 });
  const supplementResponse = await gotoSettled(page, base + '/dev/supplement/');
  assert.equal(supplementResponse.status(), 200, 'F6 對比頁必須可開啟');
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('[data-version]').count(), 3);
  assert.equal(await page.locator('[data-version="a"] .supplement-label').count(), 0);
  assert.equal(await page.locator('[data-version="a"] .supplement-source').count(), 0);
  for (const version of ['a', 'b', 'c']) {
    const chooseK = page.locator(`[data-version="${version}"] section`).first();
    assert.equal(await chooseK.locator('[data-supplement]').count(), 1, `${version.toUpperCase()} 的「怎麼選 K」只應有一個補充區塊`);
    const combined = chooseK.locator('[data-supplement-kind="paragraph"]');
    assert.equal(await combined.count(), 1);
    assert.match(await combined.innerText(), /偏差（bias）/);
    assert.match(await combined.innerText(), /變異（variance）/);
    assert.equal(await combined.locator('.tradeoff-table').count(), 1);
    assert.match(await combined.innerText(), /成本再看細一點/);
    assert.equal(await combined.locator('.supplement-label').count(), version === 'a' ? 0 : 1);
    assert.equal(await combined.locator('.supplement-source').count(), version === 'a' ? 0 : 1);
    if (version !== 'a') {
      assert.match(await combined.locator('.supplement-source').innerText(), /Hastie.*§7.10/);
      assert.equal(await combined.locator(':scope > :last-child').getAttribute('class'), 'supplement-source', '來源必須列在合併區塊末尾');
    }
    assert.equal(await page.locator(`[data-version="${version}"] [data-supplement-kind="section"]`).count(), 1);
    assert.match(await page.locator(`[data-version="${version}"] .scenario h3`).innerText(), /換個場景（補充）/);
  }
  // 去掉標示本身後逐字比對，確保三版展示的是同一份素材。
  const excerpts = await page.locator('[data-excerpt]').evaluateAll((elements) => elements.map((element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.supplement-label, .supplement-source').forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, '');
  }));
  assert.equal(excerpts[0], excerpts[1]); assert.equal(excerpts[1], excerpts[2]);
  const guideBefore = await page.locator('[data-version="c"] [data-guide]').innerText();
  const storageBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const guideSwitch = page.getByRole('switch', { name: '只看指引內容' });
  await guideSwitch.check();
  assert.equal(await page.locator('[data-version="c"] [data-supplement]:visible').count(), 0);
  assert.equal(await page.locator('[data-version="c"] [data-supplement][hidden]').count(), 2);
  assert.equal(await page.locator('[data-version="c"] [data-guide]').innerText(), guideBefore);
  assert.equal(await page.locator('[data-version="c"] [data-guide]').isVisible(), true);
  assert.match(guideBefore, /5 或 10/); assert.match(guideBefore, /中大型資料集/); assert.match(guideBefore, /K 次/);
  for (const version of ['a', 'b']) assert.equal(await page.locator(`[data-version="${version}"] [data-supplement]:visible`).count(), 2);
  assert.match(await page.locator('[data-filter-status]').innerText(), /僅指引內容/);
  await page.screenshot({ path: resolve(textbookShots, 'f6-desktop-guide-only.png'), fullPage: true, animations: 'disabled' });
  // 用鍵盤復原，覆蓋視覺開關的可存取操作。
  await guideSwitch.focus(); await page.keyboard.press('Space');
  assert.equal(await guideSwitch.isChecked(), false);
  assert.equal(await page.locator('[data-version="c"] [data-supplement]:visible').count(), 2);
  assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), storageBefore);
  report.supplementF6 = { versions: 3, chooseKBlocks: 1, chooseKSources: 1, identicalContent: true, hiddenBlocks: 2, otherVersionsUnaffected: true, keyboardToggle: true, contrast: {}, mobile: false };
  for (const [label, width, height, theme] of [['desktop-light', 1440, 1050, 'light'], ['desktop-dark', 1440, 1050, 'dark'], ['mobile-390', 390, 844, 'light']]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel('閱讀主題').selectOption(theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `F6 ${label} 頁面溢出`);
    const contrast = await page.locator('.supplement-label, .supplement-source').evaluateAll((elements) => {
      const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
      return Math.min(...elements.map((element) => {
        let parent = element;
        while (parent.parentElement && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
        const fg = luminance(getComputedStyle(element).color), bg = luminance(getComputedStyle(parent).backgroundColor);
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
      }));
    });
    assert.ok(contrast >= 4.5, `F6 ${label} 標示／來源最低對比 ${contrast} 未達 4.5:1`);
    report.supplementF6.contrast[label] = Number(contrast.toFixed(2));
    if (width === 390) {
      assert.equal(await page.locator('.scenario-table').first().evaluate((element) => element.parentElement.scrollWidth > element.parentElement.clientWidth), true);
      await guideSwitch.check();
      assert.equal(await page.locator('[data-version="c"] [data-supplement]:visible').count(), 0);
      await guideSwitch.uncheck(); report.supplementF6.mobile = true;
    }
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.screenshot({ path: resolve(textbookShots, `f6-${label}.png`), fullPage: true, animations: 'disabled' });
  }
  // S4 的隔離頁使用正式 Markdown 管線；先固定驗證所有隱藏界線，再抽查正式概念頁。
  await page.setViewportSize({ width: 1440, height: 1050 });
  await gotoSettled(page, base + '/dev/supplement-render/');
  const supplementSwitch = page.getByRole('switch', { name: '只看指引內容' });
  assert.equal(await supplementSwitch.isChecked(), false);
  assert.equal(await page.locator('.textbook-supplement').count(), 1, '相鄰同來源補充應合併');
  assert.equal(await page.locator('.textbook-supplement .supplement-source').count(), 1);
  assert.match(await page.locator('.supplement-source').innerText(), /Hastie.*scikit-learn/);
  assert.equal(await page.locator('.textbook-supplement .katex').count(), 2);
  assert.ok(await page.locator('.textbook-supplement a[data-auto-concept-link]').count() > 0);
  assert.equal(await page.locator('.textbook-supplement .starlight-aside').count(), 1);
  assert.equal(await page.locator('.textbook-supplement pre[data-language="python"]').count(), 1);
  const supplementItems = page.locator('#supplement-render-body li[data-supplement-kind="list-item"]');
  const orderedItems = page.locator('#supplement-render-body > ol > li');
  const listText = await supplementItems.allTextContents();
  assert.equal(listText.length, 3);
  assert.ok(listText.every((text) => text.trim().endsWith('（補充）')));
  assert.equal(await supplementItems.locator('..').evaluateAll((lists) => lists.some((list) => list.tagName === 'UL')), true);
  assert.equal(await supplementItems.locator('..').evaluateAll((lists) => lists.some((list) => list.tagName === 'OL')), true);
  assert.deepEqual(await orderedItems.evaluateAll((items) => items.map((item) => item.value)), [1, 2, 3]);
  const listShot = async (name) => {
    await page.getByRole('heading', { name: '清單閱讀篩選', exact: true }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: resolve(textbookShots, name), animations: 'disabled' });
  };
  await listShot('s4b-list-off.png');
  const s4Storage = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await page.screenshot({ path: resolve(textbookShots, 's4-desktop-light-off.png'), fullPage: true, animations: 'disabled' });
  await supplementSwitch.focus(); await page.keyboard.press('Space');
  assert.equal(await supplementSwitch.isChecked(), true);
  assert.equal(await page.locator('#supplement-render-body [data-supplement]:visible').count(), 0);
  assert.equal(await page.getByRole('heading', { name: '延伸細節' }).isVisible(), false);
  assert.equal(await page.getByRole('heading', { name: '回到指引', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('heading', { name: '繼續閱讀', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('heading', { name: '參考來源', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('cell', { name: '指引列', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('cell', { name: '延伸列（補充）', exact: true }).isVisible(), false);
  assert.equal(await page.getByRole('cell', { name: '指引說明列', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('cell', { name: '名稱（補充）仍在句中', exact: true }).isVisible(), true);
  assert.equal(await page.locator('#supplement-render-body li[data-supplement-kind="list-item"]:visible').count(), 0);
  assert.equal(await page.locator('#supplement-render-body > ul > li').filter({ hasText: '保留主項，只有子項是補充。' }).isVisible(), true);
  assert.deepEqual(await orderedItems.filter({ visible: true }).evaluateAll((items) => items.map((item) => item.value)), [1, 3]);
  await listShot('s4b-list-on.png');
  assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), s4Storage);
  await page.screenshot({ path: resolve(textbookShots, 's4-desktop-light-on.png'), fullPage: true, animations: 'disabled' });
  await supplementSwitch.uncheck();
  assert.equal(await page.locator('#supplement-render-body li[data-supplement-kind="list-item"]:visible').count(), 3);
  assert.deepEqual(await supplementItems.allTextContents(), listText);
  assert.deepEqual(await orderedItems.evaluateAll((items) => items.map((item) => item.value)), [1, 2, 3]);
  report.supplementS4 = { fixture: true, hiddenBlocks: 7, keyboard: true, storageUnchanged: true, realPages: [], withoutSupplement: null, contrast: {} };
  report.supplementS4b = { listItems: 3, visibleOrderedValues: [1, 3], restoredOrderedValues: [1, 2, 3], tableFalsePositives: 0, mobile: false };
  for (const [label, width, height, theme] of [['dark', 1440, 1050, 'dark'], ['mobile-390', 390, 844, 'light']]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `S4 ${label} 溢出`);
    const contrast = await page.locator('.textbook-supplement > .supplement-label, .textbook-supplement > .supplement-source').evaluateAll((elements) => {
      const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
      return Math.min(...elements.map((element) => { const fg = luminance(getComputedStyle(element).color), bg = luminance(getComputedStyle(element.closest('.textbook-supplement')).backgroundColor); return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05); }));
    });
    assert.ok(contrast >= 4.5, `S4 ${label} 補充標示對比 ${contrast} 未達 4.5:1`);
    report.supplementS4.contrast[label] = Number(contrast.toFixed(2));
    await page.screenshot({ path: resolve(textbookShots, `s4-${label}.png`), fullPage: true, animations: 'disabled' });
    await supplementSwitch.check(); assert.equal(await page.locator('#supplement-render-body [data-supplement]:visible').count(), 0); await supplementSwitch.uncheck();
    if (width === 390) {
      await supplementSwitch.check();
      assert.deepEqual(await orderedItems.filter({ visible: true }).evaluateAll((items) => items.map((item) => item.value)), [1, 3]);
      await listShot('s4b-mobile-390.png');
      await supplementSwitch.uncheck();
      assert.equal(await page.locator('#supplement-render-body li[data-supplement-kind="list-item"]:visible').count(), 3);
      report.supplementS4b.mobile = true;
    }
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  for (const id of checkRealPages ? ['roc-auc', 'k-fold-cross-validation', 'experiment-tracking', 'ndcg', 'accuracy', 'precision', 'recall'] : []) {
    await gotoSettled(page, base + `/concepts/${id}/`);
    const count = await page.locator('#concept-body [data-supplement]').count();
    const toggle = page.getByRole('switch', { name: '只看指引內容' });
    if (count) {
      assert.equal(await toggle.isChecked(), false);
      await toggle.check();
      assert.equal(await page.locator('#concept-body [data-supplement]:visible').count(), 0);
      const reference = page.getByRole('heading', { name: '參考來源', exact: true });
      if (await reference.count()) assert.equal(await reference.isVisible(), true);
      const hiddenToc = await page.locator('starlight-toc a[href], mobile-starlight-toc a[href]').evaluateAll((links) => links.filter((link) => {
        const target = document.getElementById(decodeURIComponent(new URL(link.href).hash.slice(1)));
        return target?.closest('[data-supplement]') && link.getClientRects().length > 0;
      }).map((link) => link.textContent));
      assert.deepEqual(hiddenToc, [], '已隱藏的小節不應留在目錄');
      report.supplementS4.realPages.push({ id, blocks: count });
    } else {
      assert.equal(await page.locator('[data-supplement-filter]:visible').count(), 0);
      report.supplementS4.withoutSupplement = id;
    }
  }
  await gotoSettled(page, base + '/dev/supplement-empty/');
  assert.equal(await page.locator('[data-supplement-filter]:visible').count(), 0, '無補充驗收頁不顯示開關');
  assert.equal(await page.getByRole('switch', { name: '只看指引內容' }).count(), 0);
  report.supplementS4.emptyFixture = true;
}
await runSmokeWithCleanup({ report, finish: async () => {
  await finishSmokePages(context.pages(), finishBuildCheck);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(assets, []);
}, evidence: () => finishBuildCheck.evidence(),
  save: () => writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2)),
  close: () => browser.close(), onFailure: () => page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }), run: async () => {
  if (process.env.SMOKE_SUPPLEMENT_ONLY === '1') {
    await verifySupplements(false);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  } else {
  await gotoSettled(page, base); await screenshot(page, '01-home.png');
  const urls = ['/', '/codes/L23303/', '/concepts/data-leakage/', '/concepts/train-val-test-split/', '/concepts/k-fold-cross-validation/', '/concepts/stratified-k-fold/', '/concepts/sklearn-pipeline/', '/concepts/nested-cross-validation/', '/questions/114-2-S1-Q41/', '/questions/114-2-S3-Q34/', '/questions/115-1-S3-Q44/', '/questions/115-1-S3-Q45/', '/questions/M-L23303-001/', '/quiz/', '/wrong-book/'];
  const links = new Set();
  for (const url of urls) {
    const response = await gotoSettled(page, base + url); assert.equal(response.status(), 200, url); report.pages++;
    assert.equal(await page.locator('h1').count(), 1, `${url} 應只有一個頁面標題`);
    assert.equal(await page.locator('main').evaluate(hasUnconvertedWikiLink), false, `${url} 未轉換概念連結`);
    for (const href of await page.locator('main a[href^="/"]').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')))) links.add(href.split('#')[0]);
  }
  for (const href of links) { await localGet(page.request, href, base); report.links++; }
  await gotoSettled(page, base + '/codes/L23303/');
  assert.equal(await page.locator('main a[href^="/questions/"]').count(), 0, '學習路線不得出現考古題連結');
  assert.equal(await page.locator('.exam-frequency, .session-stats').count(), 0, '學習路線不得出現考試頻率');
  await gotoSettled(page, base + '/practice/L23303/');
  assert.ok(await page.locator('main a[href^="/questions/"]').count() > 0);
  assert.ok(await page.locator('.exam-frequency').count() > 0);
  assert.ok(await page.locator('.sidebar-content a[href="/practice/L23303/"]').count() > 0);
  assertSessionStats(await page.locator('.session-stats > span').allTextContents(), content.questions, route.code);
  await gotoSettled(page, base + '/codes/L23303/');
  report.stages = await page.locator('[data-stage]').count(); assert.equal(report.stages, route.stages.length, '章數依原始路線');
  const stageCatalog = JSON.parse(await page.locator('#route-progress-catalog').textContent());
  assert.deepEqual(stageCatalog.map((s) => ({ id: s.id, concepts: s.concepts, checks: s.checks })), route.stages.map((s) => ({ id: s.id, concepts: s.concepts.map((c) => c.id), checks: sourceStageChecks(content, s).map((check) => check.id) })));
  const stageTitles = await page.locator('.route-stage h2').allTextContents();
  assert.deepEqual(stageTitles.map((s) => s.trim()), route.stages.map((s) => s.title));
  const readingOrder = route.stages.flatMap((stage) => stage.concepts.map((c) => c.id));
  report.conceptNavigation = 0;
  report.conceptNavigationCases = [];
  report.conceptLinks = { pages: [], totalAutomatic: 0, maximumPerPage: 0 };
  for (const id of readingOrder) {
    await gotoSettled(page, base + `/concepts/${id}/`);
    const automatic = await page.locator('.concept-prose a[data-auto-concept-link]').count();
    report.conceptLinks.pages.push({ id, automatic });
    report.conceptLinks.totalAutomatic += automatic;
    report.conceptLinks.maximumPerPage = Math.max(report.conceptLinks.maximumPerPage, automatic);
    assert.equal(await page.locator(`.concept-prose a[data-auto-concept-link][href="/concepts/${id}/"]`).count(), 0, `${id} 不應自動連回自己`);
    assert.equal(await page.locator('.concept-prose :is(h2, h3, pre, code, .katex, .starlight-aside__title) a[data-auto-concept-link]').count(), 0, `${id} 排除區域不應自動連結`);
    const previous = page.locator('.concept-pagination a[rel="prev"]');
    const next = page.locator('.concept-pagination a[rel="next"]');
    const expected = expectedNavigation(id, content);
    await assertNavigation(previous, next, expected, id);
    report.conceptNavigationCases.push({ id, owner: expected.owner, crossOwner: expected.owner !== route.code, listed: expected.listed });
    report.conceptNavigation++;
    await assertCheckOrder(page.locator('[data-self-check]'), id); report.selfCheckOrdering.conceptPages++;
  }
  await gotoSettled(page, base + '/concepts/data-leakage/');
  const chapterSummaries = page.locator('.sidebar-content summary').filter({ hasText: /^(?:[一二三四五六七八九十百]+|\d+)、/ });
  report.sidebarChapters = await chapterSummaries.count(); assert.equal(report.sidebarChapters, route.stages.length, '只列目前單元的章節');
  for (let index = 0; index < report.sidebarChapters; index++) {
    const summary = chapterSummaries.nth(index); const group = summary.locator('..');
    const label = (await summary.innerText()).trim();
    assert.equal(label, chapterLabel(index, route.stages[index].title), '側欄編號、標題與原始路線完全一致');
    const wasOpen = await group.evaluate((element) => element.open);
    await summary.click(); assert.equal(await group.evaluate((element) => element.open), !wasOpen);
    await summary.click(); assert.equal(await group.evaluate((element) => element.open), wasOpen);
  }
  await page.locator('.sidebar-pane').screenshot({ path: resolve(output, 'sidebar-chapters.png'), animations: 'disabled' });
  await page.locator('.concept-pagination').screenshot({ path: resolve(output, 'concept-prev-next.png'), animations: 'disabled' });
  assert.ok(await page.locator('[data-reading-toggle]').count());
  assert.match(await page.locator('.fine-print').innerText(), /教材對照/);
  await gotoSettled(page, base + '/codes/L23303/');
  for (const stage of stageCatalog) {
    const section = page.locator(`[data-stage="${stage.id}"]`);
    assert.equal(await section.locator('[data-stage-quiz]').count(), stage.checks.length ? 1 : 0, '無教材檢核題時不應出現測驗連結');
    if (!stage.checks.length) assert.match(await section.innerText(), /檢核小題準備中/);
  }
  assert.equal(await page.locator('a.is-pending').count(), 0, '撰寫中概念不應連到不存在的頁面');
  const leakageStage = stageCatalog.find((stage) => stage.concepts.includes('data-leakage'));
  assert.ok(leakageStage, '資料洩漏應列在學習階段');
  assert.ok(await page.locator('.route-goal').count() >= 6, '概念應顯示一句學習目標');
  assert.equal(await page.locator('.exam-frequency').count(), 0);
  assert.match(await page.locator(`[data-stage="${leakageStage.id}"] [data-stage-reading]`).innerText(), /已讀 0/);
  await gotoSettled(page, base + '/concepts/data-leakage/');
  const readingButton = page.locator('[data-reading-toggle] button'); await readingButton.click();
  assert.equal(await readingButton.getAttribute('aria-pressed'), 'true'); await page.reload(); await settlePage(page); assert.equal(await readingButton.getAttribute('aria-pressed'), 'true');
  await gotoSettled(page, base + '/codes/L23303/');
  assert.match(await page.locator(`[data-stage="${leakageStage.id}"] [data-stage-reading]`).innerText(), /已讀 1/);
  report.readingProgress = true; await screenshot(page, 'route-desktop.png');
  await stageScreenshot(page, 'route-stage-desktop.png');
  await gotoSettled(page, base + '/concepts/data-leakage/');
  assert.ok(await page.locator('.relation-table tbody tr').count() >= 2);
  if (await page.locator('.study-diagram svg').count()) {
    assert.equal(await page.locator('.study-diagram foreignObject').count(), 0, '流程圖標籤不應受正文段落樣式影響');
    const diagramLabels = await page.locator('.study-diagram .node').evaluateAll((nodes) => nodes.map((node) => {
      const label = node.querySelector('text'); const box = node.querySelector('rect'); const t = label.getBoundingClientRect(); const b = box.getBoundingClientRect();
      return { text: label.textContent, inside: t.top >= b.top - 1 && t.bottom <= b.bottom + 1 && t.left >= b.left - 1 && t.right <= b.right + 1 };
    }));
    assert.equal(diagramLabels.length, 4);
    for (const label of diagramLabels) assert.ok(label.inside, `流程圖標籤超出方框：${label.text}`);
    for (const text of ['全部資料', 'fit_transform', '交叉驗證切分', 'KNN訓練與評估']) assert.ok(diagramLabels.some((label) => label.text.replace(/\s+/g, '').includes(text)), `流程圖缺少文字：${text}`);
    report.visuals.diagramLabelsInsideNodes = diagramLabels.length;
  } else {
    // 新教材使用正式 figure 圖資，改驗證實際載入的 SVG 文字與邊界，保留舊 Mermaid 的獨立檢查。
    const image = page.locator('.concept-prose .textbook-figure img').first();
    await image.waitFor();
    assert.ok(await image.evaluate((element) => element.complete && element.naturalWidth > 0));
    assert.ok((await image.getAttribute('alt')).trim());
    const uri = await image.getAttribute('src'); assert.match(uri, /^data:image\/svg\+xml;base64,/);
    const svgPage = await context.newPage();
    try {
      await svgPage.setContent(Buffer.from(uri.split(',')[1], 'base64').toString('utf8'));
      await svgPage.evaluate(async () => { await document.fonts.ready; });
      assert.equal(await svgPage.locator('foreignObject').count(), 0);
      assert.equal(await svgPage.locator('svg > title').count(), 1); assert.equal(await svgPage.locator('svg > desc').count(), 1);
      const labels = await svgPage.locator('svg text').evaluateAll((elements) => elements.map((element) => {
        const t = element.getBoundingClientRect(), b = element.ownerSVGElement.getBoundingClientRect();
        return { text: element.textContent, inside: t.top >= b.top - 1 && t.bottom <= b.bottom + 1 && t.left >= b.left - 1 && t.right <= b.right + 1 };
      }));
      assert.ok(labels.length >= 12);
      for (const label of labels) assert.ok(label.inside, `正式 SVG 文字超出畫布：${label.text}`);
      for (const expected of ['全部資料與標籤', 'fit_transform(X, y)', '先切摺', '驗證資料', '只套用同一轉換']) assert.ok(labels.some((label) => label.text.includes(expected)), `正式 SVG 缺少文字：${expected}`);
      report.visuals.diagramLabelsWithinViewBox = labels.length;
    } finally { await svgPage.close(); }
  }
  await screenshot(page, '02-data-leakage.png');
  await gotoSettled(page, base + '/questions/115-1-S3-Q44/');
  for (const theme of ['light', 'dark']) {
    const result = await codeContrast(page, theme); report.visuals.codeContrast[theme] = result;
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    assert.ok(result.minimum >= 4.5, `${theme} 程式碼最低對比 ${result.minimum} 未達 4.5:1`);
  }
  await page.locator('.question-code').screenshot({ path: resolve(output, '06-code-dark.png'), animations: 'disabled' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  assert.equal(await page.locator('[data-explanation]').isVisible(), false);
  await page.locator('input[value="A"]').check(); await page.getByRole('button', { name: '確認作答' }).click();
  await page.locator('[data-explanation]:visible').waitFor();
  assert.match(await page.locator('[data-result-label]').innerText(), /再看一次/);
  const optionColors = await page.locator('[data-option="A"], [data-option="B"]').evaluateAll((options) => options.map((option) => ({ background: getComputedStyle(option).backgroundColor, border: getComputedStyle(option).borderColor })));
  assert.notEqual(optionColors[0].background, optionColors[1].background, '錯誤選項與正解的底色必須不同');
  assert.notEqual(optionColors[0].border, optionColors[1].border, '錯誤選項與正解的邊框必須不同');
  report.visuals.wrongAndCorrectDistinct = true;
  await screenshot(page, '03-question-answered.png');
  await gotoSettled(page, base + '/wrong-book/'); await page.locator('.wrong-item[data-qid="115-1-S3-Q44"]').waitFor(); report.wrongBook = true;
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出紀錄' }).click(); const download = await downloadEvent;
  const backup = resolve(output, 'attempts-backup.json'); await download.saveAs(backup);
  const payload = JSON.parse(await readFile(backup, 'utf8')); assert.equal(payload.version, 1); assert.equal(payload.attempts.length, 1); assert.equal(payload.readings.length, 1);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await settlePage(page); assert.equal(await page.locator('.wrong-item').count(), 0);
  await page.locator('#import-attempts').setInputFiles(backup); await page.getByRole('status').filter({ hasText: '新增 2 筆' }).waitFor(); assert.equal(await page.locator('.wrong-item').count(), 1);
  await page.locator('#import-attempts').setInputFiles(backup); await page.getByRole('status').filter({ hasText: '略過重複 2 筆' }).waitFor(); assert.equal(await page.locator('.wrong-item').count(), 1); report.exportImport = true;
  await screenshot(page, '04-wrong-book.png');
  await gotoSettled(page, base + '/codes/L23303/'); assert.match(await page.locator(`[data-stage="${leakageStage.id}"] [data-stage-reading]`).innerText(), /已讀 1/); report.readingBackup = true;
  await gotoSettled(page, base + '/questions/115-1-S3-Q44/'); await page.locator('input[value="B"]').check(); await page.getByRole('button', { name: '確認作答' }).click(); await page.locator('[data-explanation]:visible').waitFor();
  await gotoSettled(page, base + '/wrong-book/'); assert.equal(await page.locator('.wrong-item').count(), 0);
  await gotoSettled(page, base + '/questions/114-2-S3-Q34/'); assert.equal(await page.locator('.dispute').isVisible(), false); await page.locator('input[value="D"]').check(); await page.getByRole('button', { name: '確認作答' }).click(); await page.locator('.dispute:visible').waitFor(); assert.match(await page.locator('.dispute').innerText(), /官方答案 D/);
  await gotoSettled(page, base + '/quiz/'); const cards = await page.locator('[data-question]').count();
  for (let index = 0; index < cards; index++) {
    const card = page.locator('[data-question]:visible'); const answer = await card.getAttribute('data-answer'); await card.locator(`input[value="${answer}"]`).check(); await card.getByRole('button', { name: '確認作答' }).click(); await card.locator('[data-explanation]:visible').waitFor(); await page.locator('#next-question').click();
  }
  await page.locator('#quiz-summary:visible').waitFor(); assert.match(await page.locator('#final-score').innerText(), new RegExp(`${cards} / ${cards}.*100 分`)); report.quiz = true;
  await gotoSettled(page, base + '/codes/L23303/');
  for (const readyStage of stageCatalog.filter((stage) => stage.checks.length)) {
    await gotoSettled(page, base + '/codes/L23303/');
    const href = await page.locator(`[data-stage="${readyStage.id}"] [data-stage-quiz]`).getAttribute('href'); assert.match(href, /^\/self-check\//);
    await gotoSettled(page, base + href);
    const checks = page.locator('[data-check-stage]:visible [data-self-check]');
    assert.equal(await checks.count(), Math.min(5, readyStage.checks.length));
    for (const id of await checks.evaluateAll((cards) => cards.map((card) => card.dataset.checkId))) assert.ok(readyStage.checks.includes(id));
    await assertCheckOrder(checks, readyStage.id); report.selfCheckOrdering.stagePages++;
    assert.equal(await page.locator('[data-question]').count(), 0);
  }
  report.stageQuiz = true;
  await gotoSettled(page, base + '/practice/L23303/');
  assert.match(await page.locator(`[data-practice-stage="${leakageStage.id}"] [data-practice-progress]`).innerText(), /已做 [1-9]\d*.*答對 [1-9]\d* 題/);
  await gotoSettled(page, base + '/self-check/?code=L23303&stage=missing-stage'); assert.equal(await page.locator('#check-empty').isVisible(), true);
  await gotoSettled(page, base + '/concepts/roc-auc/');
  assert.equal(await page.locator('.concept-prose a').filter({ hasText: /^recall$/ }).count(), 0, '手動 [[recall]] 必須顯示概念標題');
  const definitionLinks = await page.locator('.concept-prose h2').filter({ hasText: /^定義與公式$/ }).evaluate((heading) => {
    const links = [];
    for (let node = heading.nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) {
      links.push(...[...node.querySelectorAll('a')].map((anchor) => ({ text: anchor.textContent, href: anchor.getAttribute('href') })));
    }
    return links;
  });
  assert.ok(definitionLinks.some(({ text, href }) => text === '混淆矩陣' && href === '/concepts/confusion-matrix/'), '定義與公式節的混淆矩陣必須連到概念頁');
  assert.equal(await page.locator('.past-question-links').getAttribute('open'), null);
  assert.equal(await page.locator('.question-list, .exam-frequency').count(), 0);
  report.presentationF2 = { asides: 0, tables: [], ticks: {}, contrast: {} };
  const f2 = report.presentationF2;
  for (const [size, width, height] of [['desktop', 1440, 1050], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height }); await gotoSettled(page, base + '/concepts/roc-auc/');
    const boxes = page.locator('.concept-prose .starlight-aside');
    f2.asides = await boxes.count(); assert.ok(f2.asides >= 1, 'ROC 至少有一個真正的提示框');
    assert.equal(await page.locator('.concept-prose').innerText().then((text) => /:::(tip|note|caution)/.test(text)), false);
    const cells = await page.locator('.concept-prose .textbook-table-scroll :is(th,td)').evaluateAll((elements) => elements.map((cell) => {
      // 檢查實際字元位置，能抓出 CSS 雖有寬度卻仍把中文字排成單字直欄的情況。
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT); const lines = new Map();
      while (walker.nextNode()) {
        const text = walker.currentNode;
        for (let index = 0; index < text.textContent.length; index++) {
          if (/\s/.test(text.textContent[index])) continue;
          const range = document.createRange(); range.setStart(text, index); range.setEnd(text, index + 1);
          const rect = range.getBoundingClientRect(), y = Math.round(rect.y);
          if (rect.width) lines.set(y, (lines.get(y) ?? 0) + 1);
        }
      }
      return { text: cell.textContent, singleCharacterColumn: lines.size > 1 && Math.max(...lines.values()) <= 1 };
    }));
    assert.ok(cells.length > 0); assert.deepEqual(cells.filter((cell) => cell.singleCharacterColumn), [], `${size} 表格有單字直排`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `ROC ${size} 溢出`);
    f2.tables.push({ size, cells: cells.length, singleCharacterColumns: 0 });
    if (size === 'mobile') {
      const scroll = await page.locator('.concept-prose .textbook-table-scroll').first().evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
        const result = { scrollable: element.scrollWidth > element.clientWidth, reachedRight: element.scrollLeft > 0 };
        element.scrollLeft = 0; return result;
      });
      assert.deepEqual(scroll, { scrollable: true, reachedRight: true }, '390px 表格應可局部橫捲'); f2.mobileTableScroll = scroll;
    }
    await page.locator('.concept-prose .textbook-table-scroll').first().screenshot({ path: resolve(textbookShots, `f2-roc-table-${size}.png`), animations: 'disabled' });
    for (const theme of ['light', 'dark']) {
      const contrast = await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
        const values = [...document.querySelectorAll('.concept-prose .starlight-aside')].flatMap((element) => {
          const style = getComputedStyle(element), bg = luminance(style.backgroundColor);
          if (parseFloat(style.borderInlineStartWidth) <= 0) return [0];
          return [element, element.querySelector('.starlight-aside__title')].map((part) => { const fg = luminance(getComputedStyle(part).color); return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05); });
        });
        return Math.min(...values);
      }, theme);
      assert.ok(contrast >= 4.5, `${theme} 提示框對比 ${contrast} 未達 4.5:1`); f2.contrast[theme] = Number(contrast.toFixed(2));
      await page.locator('.starlight-aside--caution').first().screenshot({ path: resolve(textbookShots, `f2-roc-aside-${size}-${theme}.png`), animations: 'disabled' });
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await gotoSettled(page, base + '/dev/figures/');
    for (const kind of ['learning-curve', 'residual']) {
      const figure = page.locator(`[data-figure="${kind}"]`);
      const xTicks = await figure.locator('.fig-tick-x').allTextContents(), yTicks = await figure.locator('.fig-tick-y').allTextContents();
      assert.ok(xTicks.length >= 2 && yTicks.length >= 2);
      if (kind === 'learning-curve') { assert.deepEqual(xTicks, ['1', '2', '3', '4', '5', '6']); assert.deepEqual(yTicks, ['0', '0.2', '0.4', '0.6', '0.8', '1']); }
      else { assert.deepEqual(xTicks, ['10', '20', '30', '40', '50']); assert.deepEqual(yTicks, ['-2', '-1', '0', '1', '2']); }
      f2.ticks[kind] = { x: xTicks, y: yTicks };
      if (size === 'mobile') assert.equal(await figure.locator('.figure-scroll').first().evaluate((element) => element.scrollWidth > element.clientWidth), true, `${kind} 應可局部橫捲`);
      await figure.screenshot({ path: resolve(textbookShots, `f2-${kind}-${size}.png`), animations: 'disabled' });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `圖表 ${size} 溢出`);
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await verifySupplements();
  const fixtureResponse = await gotoSettled(page, base + '/test-fixtures/textbook/');
  if (process.env.TEXTBOOK_TEST_FIXTURES === '1') assert.equal(fixtureResponse.status(), 200, '驗證建置必須包含假教材頁');
  if (fixtureResponse.status() === 200) {
    assert.equal(await page.locator('.concept-summary').count(), 1);
    assert.equal(await page.locator('.learning-goals li').count(), 1);
    assert.match(await page.locator('.stage-intro').innerText(), /資料各自的角色/);
    assert.match(await page.locator('.judgment-rule').innerText(), /未參與/);
    // 原 fixture 是 choice、short、choice，直接交給元件才能驗到顯示層的排序保險。
    await assertCheckOrder(page.locator('[data-self-check]'), '假教材概念頁');
    assert.deepEqual(await page.locator('[data-self-check]').evaluateAll((cards) => cards.map((card) => card.dataset.checkId)), ['c1', 'c3', 'c2']);
    report.selfCheckOrdering.fixtureConcept = true;
    const card = page.locator('[data-check-type="choice"]').first();
    assert.equal(await card.locator('[data-check-feedback]').isVisible(), false);
    const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    await card.locator('input[value="A"]').check();
    assert.equal(await card.locator('[data-check-feedback]').isVisible(), true);
    assert.equal(await card.locator('[data-check-feedback] dd').count(), 3);
    const short = page.locator('[data-short-answer]'); assert.equal(await short.getAttribute('open'), null);
    await short.locator('summary').click(); assert.equal(await short.locator('li').count(), 2);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), before, '檢核題不得寫入紀錄'); report.selfCheck = true;
    await page.setViewportSize({ width: 1440, height: 1050 }); await screenshot(page, 's2-self-check-desktop.png');
    await page.screenshot({ path: resolve(textbookShots, 's2-self-check-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot(page, 's2-self-check-mobile.png');
    await page.screenshot({ path: resolve(textbookShots, 's2-self-check-mobile.png'), fullPage: true, animations: 'disabled' });
    await gotoSettled(page, base + '/self-check/?code=L23303&stage=fixture-stage');
    const stageChecks = page.locator('[data-check-stage]:visible [data-self-check]');
    assert.equal(await stageChecks.count(), 3, '階段應只抽所屬概念檢核題');
    await assertCheckOrder(stageChecks, '假教材階段小測驗');
    assert.deepEqual(await stageChecks.evaluateAll((cards) => cards.map((card) => card.dataset.checkId)), ['fixture-concept:c1', 'fixture-concept:c3', 'fixture-concept:c2']);
    report.selfCheckOrdering.fixtureStage = true;
    assert.equal(await page.locator('[data-question]').count(), 0);
  } else {
    await gotoSettled(page, base + '/concepts/roc-auc/');
    const realCheck = page.locator('[data-check-type="choice"]').first();
    if (await realCheck.count()) { assert.equal(await realCheck.locator('[data-check-feedback]').isVisible(), false); await realCheck.locator('input').first().check(); assert.equal(await realCheck.locator('[data-check-feedback]').isVisible(), true); report.selfCheck = true; }
  }
  for (const [label, url] of [['concept', '/concepts/roc-auc/'], ['route', '/codes/L23303/'], ['practice', '/practice/L23303/']]) {
    await page.setViewportSize({ width: 1440, height: 1050 }); await gotoSettled(page, base + url);
    await screenshot(page, `s2-${label}-desktop.png`);
    await page.screenshot({ path: resolve(textbookShots, `s2-${label}-desktop.png`), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${url} 375px 溢出`);
    await screenshot(page, `s2-${label}-mobile.png`);
    await page.screenshot({ path: resolve(textbookShots, `s2-${label}-mobile.png`), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await gotoSettled(page, base); await page.locator('site-search button[data-open-modal]').click();
  const search = page.locator('.pagefind-ui__search-input');
  const snapshot = await waitForSearch(page, search, '資料洩漏');
  report.searchFirst = snapshot.results[0]?.href ?? null; report.searchTop3 = snapshot.results.map((result) => result.path);
  report.searchReady = { query: snapshot.query, count: snapshot.count, message: snapshot.message };
  assertSearchTop3(report.searchFirst, report.searchTop3, '/concepts/data-leakage/');
  await page.keyboard.press('Escape');
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/', '/codes/L23303/', '/concepts/data-leakage/', '/questions/115-1-S3-Q44/', '/wrong-book/']) {
    await gotoSettled(mobile, base + url); assert.equal(await mobile.evaluate(() => window.innerWidth), 390); const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); assert.equal(overflow, false, `${url} 手機版水平溢出`); report.mobile.push(url);
  }
  await gotoSettled(mobile, base + '/codes/L23303/'); await screenshot(mobile, 'route-mobile.png');
  await stageScreenshot(mobile, 'route-stage-mobile.png');
  await gotoSettled(mobile, base);
  const searchBox = await mobile.locator('site-search button[data-open-modal]').boundingBox(); const menuBox = await mobile.locator('.sl-menu-button').boundingBox();
  assert.ok(searchBox.x + searchBox.width <= menuBox.x, '手機搜尋與選單按鈕不應重疊');
  await mobile.locator('.sl-menu-button').click(); await mobile.locator('#starlight__sidebar:popover-open').waitFor();
  await mobile.locator('.sl-menu-button').click();
  await screenshot(mobile, '05-home-mobile.png');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(assets, []);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(assets, []); report.completed = true;
  }
  } });
console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
