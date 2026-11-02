/** 以真實滑鼠逐點驗收方格提示歸屬，並檢查完整關係面板、篩選與觸控操作。 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

async function main() {
  const base = process.env.DEMO_URL ?? 'http://127.0.0.1:4321';
  const output = process.env.SMOKE_OUTPUT ? resolve(process.env.SMOKE_OUTPUT) : resolve(import.meta.dirname, '../../tmp/demo-shots');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = []; const external = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  const report = {
    browserErrors: errors, externalRequests: external,
    previousSmokeGap: '上一輪只驗證節點下緣的 focused class，未驗證方格提示內容；正式連線提示反而被斷言為成功，且未掃描穿越方格與空白處的命中歸屬。',
    interactionFix: '停用所有連線事件，使用方格 renderedBoundingBox 統一判斷真實滑鼠位置；固定邊框寬度避免 hover 改變命中範圍，提示概念名稱、中文章節與 goal，選取後面板保留所有關係 note 與來源。',
    gridScanMethod: '整張畫布每 10px 一點，以 page.mouse.move 逐點移動；獨立監聽器立即比對節點 renderedBoundingBox 與提示內容，未露出的列先捲入視窗，不略過任何畫布網格點。',
  };
  const page = await context.newPage();
  async function ready(target = page) { await target.locator('#concept-map[data-ready="true"]').waitFor(); await target.evaluate(() => document.fonts.ready); }
  async function shot(target, name) {
    await target.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await target.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
  }
  // 透過畫布的註冊實例取得繪圖座標，之後仍由瀏覽器送出真實滑鼠與觸控事件。
  async function graph(target, action, id = '') {
    await target.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return target.evaluate(({ action, id }) => {
      const cy = document.querySelector('#map-canvas')._cyreg.cy;
      const canvas = document.querySelector('#map-canvas').getBoundingClientRect();
      const node = cy.getElementById(id);
      if (action === 'position' || action === 'bottom') { const point = node.renderedPosition(); return { x: canvas.x + point.x, y: canvas.y + point.y + (action === 'bottom' ? node.renderedOuterHeight() * .35 : 0) }; }
      if (action === 'edge') { const point = node.renderedMidpoint(); return { x: canvas.x + point.x, y: canvas.y + point.y }; }
      if (action === 'beside-edge') {
        const point = node.renderedMidpoint(); const source = node.renderedSourceEndpoint(); const target = node.renderedTargetEndpoint();
        const dx = target.x - source.x; const dy = target.y - source.y; const length = Math.hypot(dx, dy);
        return { x: canvas.x + point.x - dy / length * 6, y: canvas.y + point.y + dx / length * 6 };
      }
      if (action === 'body-space') {
        const boxes = cy.nodes(':visible').map((node) => node.renderedBoundingBox({ includeLabels: false, includeOverlays: false, includeUnderlays: false }));
        const edge = cy.edges('[type="body"]:visible').find((edge) => {
          const p = edge.renderedMidpoint();
          return p.x > 20 && p.y > 20 && p.x < canvas.width - 20 && p.y < canvas.height - 20
            && boxes.every((b) => p.x < b.x1 - 5 || p.x > b.x2 + 5 || p.y < b.y1 - 5 || p.y > b.y2 + 5);
        });
        if (!edge) throw new Error('找不到經過空白處的正文連線');
        const point = edge.renderedMidpoint(); return { x: canvas.x + point.x, y: canvas.y + point.y, id: edge.id() };
      }
      if (action === 'crossing') {
        const nodes = cy.nodes(':visible'); const pan = cy.pan(); const zoom = cy.zoom();
        // 用實際繪圖路徑找出穿越第三個方格的連線，不把來源或目標當作穿越案例。
        for (const preferred of ['overfitting', '']) for (const edge of cy.edges(':visible')) {
          const start = edge.renderedSourceEndpoint(); const end = edge.renderedTargetEndpoint();
          const controls = (edge.controlPoints() ?? []).map((p) => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }));
          let from = start;
          for (let segment = 0; segment < Math.max(1, controls.length); segment++) {
            const control = controls[segment]; const next = controls[segment + 1];
            const to = next ? { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 } : end;
            for (let step = 1; step < 100; step++) {
              const t = step / 100; const u = 1 - t;
              const p = control ? { x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y }
                : { x: u * from.x + t * to.x, y: u * from.y + t * to.y };
              const crossed = nodes.find((node) => {
                if (preferred && node.id() !== preferred) return false;
                if ([edge.data('source'), edge.data('target')].includes(node.id())) return false;
                const box = node.renderedBoundingBox({ includeLabels: false, includeOverlays: false, includeUnderlays: false });
                return p.x > box.x1 + 3 && p.x < box.x2 - 3 && p.y > box.y1 + 3 && p.y < box.y2 - 3;
              });
              if (crossed) return { x: canvas.x + p.x, y: canvas.y + p.y, node: crossed.id(), title: crossed.data('title'), edge: edge.id() };
            }
            from = to;
          }
        }
        throw new Error('找不到穿越第三個方格的連線');
      }
      if (action === 'layers') return [...document.querySelectorAll('#map-canvas canvas')].map((layer) => {
        const box = layer.getBoundingClientRect(); return { x: box.x - canvas.x, y: box.y - canvas.y, width: box.width - canvas.width, height: box.height - canvas.height };
      });
      return { nodes: cy.nodes(':visible').length, edges: cy.edges(':visible').length, faded: cy.elements('.faded').length, focused: cy.nodes('.focused').map((node) => node.id()), zoom: cy.zoom(), pan: cy.pan(), read: cy.nodes('.read').map((node) => node.id()), hidden: cy.edges('.filtered').length };
    }, { action, id });
  }
  async function gridScan(viewport, scrollY) {
    const scan = await context.newPage(); await scan.setViewportSize(viewport);
    try {
      await scan.goto(base + '/map/'); await ready(scan);
      // 正文連線也一起打開，避免網格只測到預設隱藏正文的狀態。
      await scan.locator('#map-body').check();
      await scan.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scrollY);
      await graph(scan);
      const region = await scan.evaluate(() => {
        const canvas = document.querySelector('#map-canvas'); const box = canvas.getBoundingClientRect();
        const cy = canvas._cyreg.cy; const tooltip = document.querySelector('#map-tooltip');
        const result = { points: 0, nodePoints: 0, blankPoints: 0, mismatches: 0, examples: [] };
        const listener = (event) => {
          const current = canvas.getBoundingClientRect();
          const x = event.clientX - current.x; const y = event.clientY - current.y;
          const node = cy.nodes(':visible').find((node) => {
            const b = node.renderedBoundingBox({ includeLabels: false, includeOverlays: false, includeUnderlays: false });
            return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
          });
          const visible = !tooltip.hidden && getComputedStyle(tooltip).display !== 'none';
          const text = tooltip.textContent; result.points++;
          if (node) result.nodePoints++; else result.blankPoints++;
          const matches = node ? visible && text.includes(node.data('title')) && text.includes(node.data('goal')) : !visible;
          if (!matches) {
            result.mismatches++;
            if (result.examples.length < 12) result.examples.push({ x: event.clientX, y: event.clientY, expected: node?.data('title') ?? null, visible, text });
          }
        };
        // 監聽器在應用程式之後註冊，只觀察每次真實 pointermove 的結果，不派送 Cytoscape 事件。
        document.addEventListener('pointermove', listener);
        window.mapSmokeScan = { result, listener };
        const rows = [];
        // 保留畫布原點的完整 10px 網格；視窗外的列稍後先捲進視窗，再送真實滑鼠事件。
        for (let y = 5; y < box.height; y += 10) {
          const points = [];
          for (let x = 5; x < box.width; x += 10) points.push({ x: box.x + x, y: box.y + window.scrollY + y });
          rows.push(points);
        }
        return { rows, canvas: { x: box.x, y: box.y, width: box.width, height: box.height }, scrollY: window.scrollY };
      });
      const scrollOffsets = new Set([region.scrollY]);
      for (const row of region.rows) {
        const offset = await scan.evaluate((y) => {
          // 各情境保留起始捲動位置；只有尚未露出的畫布列需要額外捲動。
          if (y - window.scrollY >= innerHeight - 1) window.scrollTo({ top: y - innerHeight + 40, behavior: 'instant' });
          if (y - window.scrollY < 90) window.scrollTo({ top: Math.max(0, y - 100), behavior: 'instant' });
          return window.scrollY;
        }, row[0].y);
        scrollOffsets.add(offset);
        for (const point of row) await scan.mouse.move(point.x, point.y - offset);
      }
      const result = await scan.evaluate(() => {
        const { result, listener } = window.mapSmokeScan;
        document.removeEventListener('pointermove', listener);
        delete window.mapSmokeScan; return result;
      });
      assert.equal(result.points, region.rows.flat().length, '每個網格點都必須收到真實滑鼠事件');
      const record = { viewport, scrollY: region.scrollY, scrollOffsets: [...scrollOffsets], step: 10, canvas: region.canvas, ...result };
      report.gridScans ??= []; report.gridScans.push(record);
      console.log('grid-scan', JSON.stringify(record));
      assert.equal(result.mismatches, 0, JSON.stringify(result.examples));
      assert.ok(result.nodePoints > 0 && result.blankPoints > 0);
    } finally { await scan.close(); }
  }
  try {
    const response = await page.goto(base + '/map/'); assert.equal(response.status(), 200); await ready();
    const data = JSON.parse(await page.locator('#concept-map-data').textContent());
    assert.equal(data.nodes.length, 30); assert.equal(data.edges.filter((edge) => edge.type !== 'body').length, 37);
    assert.equal(data.stages.length, 6); report.concepts = data.nodes.length;
    report.typedRelations = data.edges.filter((edge) => edge.type !== 'body').length;
    report.bodyLinks = data.edges.filter((edge) => edge.type === 'body').length;
    assert.equal((await graph(page)).nodes, 30); assert.equal((await graph(page)).edges, 37);
    assert.equal(await page.locator('#map-body').isChecked(), false); report.bodyHiddenByDefault = true;
    for (const layer of await graph(page, 'layers')) assert.deepEqual(layer, { x: 0, y: 0, width: 0, height: 0 }, '繪圖層與命中座標必須對齊');
    report.canvasLayersAligned = true;
    await shot(page, 'map-desktop.png');
    await page.locator('#map-focus').selectOption('data-leakage');
    let state = await graph(page); assert.deepEqual(state.focused, ['data-leakage']); assert.ok(state.faded > 0);
    assert.match(await page.locator('#map-detail-title').innerText(), /資料洩漏/);
    assert.ok(await page.locator('#map-detail-relations .map-relation-card').count() > 0);
    assert.match(await page.locator('#map-detail-relations').innerText(), /來源/);
    await shot(page, 'map-selected.png');
    // 即使關係在圖上被篩掉，選取任一概念仍要完整保留 note、來源與正文連結。
    report.completeRelationPanels = 0;
    for (const node of data.nodes) {
      await page.locator('#map-focus').selectOption(node.id);
      const edges = data.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
      const cards = page.locator('#map-detail-relations .map-relation-card');
      assert.equal(await cards.count(), edges.length, `${node.title} 必須列出所有關係`);
      for (const [index, edge] of edges.entries()) {
        const text = await cards.nth(index).innerText();
        if (edge.note) assert.ok(text.includes(edge.note));
        for (const source of edge.sources) assert.ok(text.includes(source));
      }
      report.completeRelationPanels++;
    }
    await page.locator('#map-body').check(); assert.equal((await graph(page)).edges, data.edges.length); report.bodyOptIn = true;
    // 只留下正文線，真實滑過線的中點也不能出現提示，點擊後移到空白處亦然。
    for (const control of await page.locator('[data-map-relation]').all()) await control.uncheck();
    await page.locator('#map-canvas').scrollIntoViewIfNeeded();
    const bodyPoint = await graph(page, 'body-space');
    await page.mouse.move(bodyPoint.x, bodyPoint.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false);
    await page.mouse.click(bodyPoint.x, bodyPoint.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false);
    const surface = await page.locator('#map-canvas').boundingBox();
    await page.mouse.move(surface.x + 10, surface.y + surface.height - 10);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false); report.bodyHasNoTooltip = bodyPoint.id;
    await page.locator('#map-reset').click(); assert.equal(await page.locator('#map-body').isChecked(), false);
    for (const type of ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts']) {
      const control = page.locator(`[data-map-relation][value="${type}"]`);
      await control.uncheck();
      assert.equal((await graph(page)).edges, 37 - data.edges.filter((edge) => edge.type === type).length);
      await control.check();
    }
    report.filters = [];
    for (const stage of data.stages) {
      await page.locator('#map-stage').selectOption(stage.id);
      const state = await graph(page); const count = data.nodes.filter((node) => node.stage === stage.id).length;
      assert.equal(state.nodes, count); report.filters.push({ stage: stage.id, nodes: count });
    }
    await page.locator('#map-reset').click();
    await page.locator('#map-canvas').scrollIntoViewIfNeeded();
    // 從空白處移入各節點高度 85% 的位置，避免只驗文字附近的中心點。
    for (const node of data.nodes) {
      await page.mouse.move(surface.x + 10, surface.y + 10);
      const lower = await graph(page, 'bottom', node.id);
      await page.mouse.move(lower.x, lower.y);
      assert.deepEqual((await graph(page)).focused, [node.id], `${node.title} 下緣應觸發 hover`);
      assert.equal(await page.locator('#map-tooltip').isVisible(), true);
      const text = await page.locator('#map-tooltip').innerText();
      assert.ok(text.includes(node.title)); assert.ok(text.includes(node.goal));
      const stageIndex = data.stages.findIndex((stage) => stage.id === node.stage);
      assert.ok(text.includes(`${['一', '二', '三', '四', '五', '六'][stageIndex]}、${data.stages[stageIndex].title}`));
    }
    report.nodeBottomHover = data.nodes.length;
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    const early = await graph(page, 'position', 'early-stopping');
    await page.mouse.move(early.x, early.y);
    assert.match(await page.locator('#map-tooltip').innerText(), /早停/);
    await page.screenshot({ path: resolve(output, 'map-hover-node.png'), animations: 'disabled' });
    await page.mouse.move(300, 150);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false, '離開方格與畫布必須立即隱藏提示');
    const crossing = await graph(page, 'crossing');
    await page.mouse.move(crossing.x, crossing.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), true);
    assert.ok((await page.locator('#map-tooltip').innerText()).includes(crossing.title));
    await page.screenshot({ path: resolve(output, 'map-hover-edge-crossing.png'), animations: 'disabled' });
    report.crossingNodeHover = crossing;
    const point = await graph(page, 'bottom', 'data-leakage');
    await page.mouse.click(point.x, point.y);
    assert.match(await page.locator('#map-detail-title').innerText(), /資料洩漏/);
    assert.equal(await page.locator('#map-focus').inputValue(), 'data-leakage');
    await page.locator('#map-open-concept').click(); await page.waitForURL('**/concepts/data-leakage/');
    await page.locator('[data-reading-toggle] button').click();
    await page.goto(base + '/map/'); await ready(); assert.ok((await graph(page)).read.includes('data-leakage'));
    report.nodeNavigation = true; report.readingMark = true;
    await page.locator('#map-body').uncheck();
    for (const type of ['is_a', 'part_of', 'requires', 'mitigates']) await page.locator(`[data-map-relation][value="${type}"]`).uncheck();
    const comparison = data.edges.find((edge) => edge.type === 'contrasts');
    await page.locator('#map-canvas').scrollIntoViewIfNeeded();
    const edgePoint = await graph(page, 'edge', comparison.id);
    await page.mouse.move(edgePoint.x, edgePoint.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false); report.edgeHasNoTooltip = true;
    await page.mouse.click(edgePoint.x, edgePoint.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false);
    const beside = await graph(page, 'beside-edge', comparison.id);
    await page.mouse.move(beside.x, beside.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false, '距線 6px 的空白處不可顯示提示');
    await page.mouse.move(edgePoint.x, edgePoint.y);
    assert.equal(await page.locator('#map-tooltip').isVisible(), false, '回到正式連線上也不可顯示提示');
    const beforeZoom = (await graph(page)).zoom; await page.locator('#map-zoom-in').click(); assert.ok((await graph(page)).zoom > beforeZoom);
    report.zoom = true;
    await gridScan({ width: 1440, height: 900 }, 0);
    await gridScan({ width: 1920, height: 1080 }, 0);
    await gridScan({ width: 1440, height: 900 }, 300);
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    mobileContext.on('page', (mobile) => mobile.on('pageerror', (error) => errors.push(error.message)));
    await mobileContext.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.href); return route.abort(); }
      return route.continue();
    });
    const mobile = await mobileContext.newPage(); await mobile.goto(base + '/map/'); await ready(mobile);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot(mobile, 'map-mobile.png');
    await mobile.locator('#map-zoom-in').tap(); const zoomed = await graph(mobile);
    await mobile.locator('#map-canvas').scrollIntoViewIfNeeded();
    const box = await mobile.locator('#map-canvas').boundingBox();
    const session = await mobileContext.newCDPSession(mobile);
    const start = { x: box.x + box.width * .4, y: box.y + box.height * .55 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 5; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - step * 14, y: start.y - step * 12 }] });
      await mobile.evaluate(() => new Promise(requestAnimationFrame));
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notDeepEqual((await graph(mobile)).pan, zoomed.pan); report.mobilePan = true;
    await mobile.locator('#map-stage').selectOption('prevent-leakage'); assert.equal((await graph(mobile)).nodes, 3);
    report.mobileOverflow = false;
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await writeFile(resolve(output, 'map-verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } catch (error) { await shot(page, 'map-failure.png'); await writeFile(resolve(output, 'map-verification.json'), JSON.stringify({ ...report, failure: error.message }, null, 2)); throw error; }
  finally { await browser.close(); }
}
await main();
