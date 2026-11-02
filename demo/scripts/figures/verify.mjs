/** 驗證自己的隔離建置與離線輸出，留下桌面、窄螢幕、深色截圖及可重查的數字。 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { freshOutput, localUrl, readBuildReceipt, verifyBuildReceipt, guardBuildContext, routeLocalOnly, gotoSettled } from '../rollout-smoke.mjs';

// KaTeX 被排除後空白可能改變；只忽略空白，並要求原句中的每個查詢字都被 Pagefind 標記。
export function formulaWitness(result, base) {
  const sentence = '精確率與召回率的調和平均稱為F1分數。';
  const normalize = (text) => text.replace(/\s/gu, '');
  const figure = result.figures.find((page) => {
    const url = new URL(page.url, base);
    return url.origin === base && url.pathname === '/dev/figures/';
  });
  if (!figure || !normalize(figure.content).includes(sentence)) return false;
  return figure.sub_results.some((section) => {
    const url = new URL(section.url, base);
    if (url.origin !== base || url.pathname !== '/dev/figures/' || decodeURIComponent(url.hash) !== '#公式與搜尋' || section.anchor?.id !== '公式與搜尋' || section.title !== '公式與搜尋') return false;
    const chars = Array.from(section.text, (char, index) => ({ char, marked: section.marked[index] })).filter(({ char }) => !/\s/u.test(char));
    const text = chars.map(({ char }) => char).join('');
    const start = text.indexOf(sentence);
    if (start < 0) return false;
    const hit = start + sentence.indexOf('召回率');
    return chars.slice(hit, hit + 3).length === 3 && chars.slice(hit, hit + 3).every(({ marked }) => marked === true);
  });
}

export async function verify() {
  assert.ok(process.env.FIGURES_OUTPUT, '請指定獨立 FIGURES_OUTPUT');
  const output = await freshOutput(resolve(process.env.FIGURES_OUTPUT));
  const errors = [], external = [], failed = [], assets = [], fontRequests = [];
  const report = { completed: false, figures: 0, formulas: 0, mathml: 0, searchable: false, formulaSearchWitness: { query: '召回率', status: '未執行' }, generalChineseSearchPrecision: { query: '精確率', status: '未執行', limitation: '此診斷不代表一般中文搜尋限制已修復或獲接受。' }, collapsed: false, mobileWidth: 0, fonts: fontRequests, errors, external, failed, browserErrors: errors, externalRequests: external, assetFailures: assets, buildResponses: [] };
  const checks = [];
  let browser, page, binding, failure;
  const setupContext = async (options, base) => {
    const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
    checks.push(guardBuildContext(context, binding, base, report));
    context.on('page', (target) => target.on('pageerror', (error) => errors.push(error.message)));
    context.on('requestfailed', (request) => {
      failed.push(request.url());
      assets.push({ url: request.url(), error: request.failure()?.errorText ?? 'request failed' });
    });
    context.on('request', (request) => { if (/\.(woff2?|ttf)(?:\?|$)/.test(request.url())) fontRequests.push(request.url()); });
    await routeLocalOnly(context, base, external, assets);
    return context;
  };
  const screenshot = async (name) => {
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
  };
  try {
    assert.ok(process.env.DEMO_URL, '請指定 DEMO_URL');
    const base = localUrl(process.env.DEMO_URL, process.env.DEMO_URL).origin;
    assert.ok(process.env.BUILD_RECEIPT, '請指定 BUILD_RECEIPT');
    binding = await readBuildReceipt(process.env.BUILD_RECEIPT);
    report.sha = binding.receipt.sha; report.buildSha = binding.receipt.sha; report.receiptDigest = binding.receiptDigest;
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
    const context = await setupContext({ viewport: { width: 1440, height: 1000 } }, base);
    page = await context.newPage();
    await gotoSettled(page, `${base}/dev/figures/`);
    await page.evaluate(async () => { await document.fonts.ready; });
    report.figures = await page.locator('.textbook-figure').count(); assert.equal(report.figures, 5);
    report.formulas = await page.locator('.katex').count(); assert.equal(report.formulas, 3);
    report.mathml = await page.locator('math').count(); assert.equal(report.mathml, 3);
    assert.equal(await page.locator('.katex[data-pagefind-ignore]').count(), 3);
    assert.equal(await page.locator('.textbook-figure svg[role="img"] title').count(), 5);
    assert.equal(await page.locator('.textbook-figure figcaption').count(), 5);
    report.collapsed = await page.locator('.textbook-advanced').evaluate((el) => !el.open); assert.ok(report.collapsed);
    await page.locator('.textbook-advanced > summary').click();
    assert.ok(await page.getByText('同分樣本一起跨過閾值').isVisible());
    await page.locator('.textbook-advanced > summary').click();
    await page.locator('.figure-values > summary').first().click();
    assert.ok(await page.locator('.figure-values table').first().isVisible());
    await page.locator('.figure-values > summary').first().click();
    const searchQuery = async (query) => page.evaluate(async (term) => {
      const pagefind = await import('/pagefind/pagefind.js');
      const result = await pagefind.search(term);
      const pages = await Promise.all(result.results.map((r) => r.data()));
      const figures = pages.filter((p) => new URL(p.url, location.origin).origin === location.origin && new URL(p.url, location.origin).pathname === '/dev/figures/').map((p) => ({
        url: p.url, content: p.content,
        sub_results: p.sub_results.map((s) => {
          const template = document.createElement('template'); template.innerHTML = s.excerpt;
          const text = [], marked = [];
          const visit = (node, hit = false) => {
            if (node.nodeType === Node.TEXT_NODE) for (const char of node.textContent) { text.push(char); marked.push(hit); }
            else for (const child of node.childNodes) visit(child, hit || node.nodeName === 'MARK');
          };
          visit(template.content);
          return { title: s.title, url: s.url, anchor: s.anchor, locations: s.locations, excerpt: s.excerpt, text: text.join(''), marked };
        }),
      }));
      return { total: result.results.length, urls: pages.map((p) => p.url), figures, ...(term === '精確率' ? { pages } : {}) };
    }, query);
    let diagnosticError;
    try {
      const precision = await searchQuery('精確率');
      Object.assign(report.generalChineseSearchPrecision, { status: precision.figures.length ? '找到展示頁' : '未找到展示頁', result: precision });
    } catch (error) {
      diagnosticError = error;
      Object.assign(report.generalChineseSearchPrecision, { status: '查詢錯誤', error: String(error) });
    }
    const search = await searchQuery('召回率');
    report.searchable = formulaWitness(search, base);
    Object.assign(report.formulaSearchWitness, { status: report.searchable ? '通過' : '未通過', result: search });
    assert.ok(report.searchable, 'Pagefind 的公式小節須命中原句中的召回率');
    if (diagnosticError) throw diagnosticError;
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await screenshot('s1-desktop.png');
    await page.setViewportSize({ width: 375, height: 812 });
    report.mobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(report.mobileWidth, 375);
    assert.ok(await page.locator('.textbook-figure .figure-scroll').first().evaluate((el) => el.scrollWidth > el.clientWidth));
    await screenshot('s1-mobile.png');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    const contrast = await page.locator('.textbook-figure').first().evaluate((el) => {
      const luminance = (color) => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const style = getComputedStyle(el), fg = luminance(style.color), bg = luminance(style.backgroundColor);
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    });
    report.darkTextContrast = contrast; assert.ok(contrast >= 4.5, '深色圖說文字對比');
    await screenshot('s1-dark.png');
    assert.ok(fontRequests.some((url) => url.includes('KaTeX')));
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failed, []);
    const noJs = await setupContext({ javaScriptEnabled: false }, base);
    const staticPage = await noJs.newPage(); await gotoSettled(staticPage, `${base}/dev/figures/`);
    assert.equal(await staticPage.locator('.textbook-figure svg').count(), 5);
    assert.equal(await staticPage.locator('math').count(), 3);
    await noJs.close();
  } catch (error) { failure = error; }
  finally {
    const results = await Promise.allSettled(checks.map((finish) => finish()));
    const closeErrors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (browser) { try { await browser.close(); } catch (error) { closeErrors.push(error); } }
    if (binding) { try { await verifyBuildReceipt(binding); } catch (error) { closeErrors.push(error); } }
    try { assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failed, []); assert.deepEqual(assets, []); }
    catch (error) { closeErrors.push(error); }
    if (closeErrors.length) failure = new AggregateError([...(failure ? [failure] : []), ...closeErrors], 'figures 驗收或收尾失敗');
    if (failure) report.failure = String(failure) + (failure.errors ? '\n' + failure.errors.map(String).join('\n') : '');
    else report.completed = true;
    await writeFile(resolve(output, 's1-verification.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  }
  if (failure) throw failure;
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await verify();
