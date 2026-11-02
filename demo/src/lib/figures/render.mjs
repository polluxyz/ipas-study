/** 在 Node 建置階段產生可存取的靜態圖與數值表；線型、標記與文字同時區分資料系列。 */
import { line, curveLinear, curveStepBefore } from 'd3-shape';
import { classificationCurve, confusion } from './metrics.mjs';
import { validateFigure } from './schema.mjs';

export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function formatNumber(value) { return value === null ? '未定義' : value === Infinity ? '+∞' : Number(value.toFixed(4)).toString(); }
const e = escapeHtml, f = formatNumber;
function label(x, y, text, extra = '') { return `<text x="${x}" y="${y}" ${extra}>${e(text)}</text>`; }
function table(headers, rows, caption) {
  return `<details class="figure-values"><summary>展開數值表</summary><div class="figure-scroll" tabindex="0" role="region" aria-label="${e(caption)}數值表"><table><caption>${e(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${e(typeof cell === 'number' || cell === null ? f(cell) : cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
function range(values, zero = false) {
  let min = Math.min(...values, ...(zero ? [0] : [])), max = Math.max(...values, ...(zero ? [0] : []));
  if (min === max) { min -= 1; max += 1; }
  return [min, max];
}
/** 用 1、2、5 的十進位倍數擴展座標範圍，避免把邊界小數當成刻度。 */
export function niceAxis(bounds, integer = false) {
  const raw = (bounds[1] - bounds[0]) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(integer ? 1 : 0, ([1, 2, 5, 10].find((factor) => factor * power >= raw) ?? 10) * power);
  const first = Math.floor(bounds[0] / step + 1e-10), last = Math.ceil(bounds[1] / step - 1e-10);
  const ticks = Array.from({ length: last - first + 1 }, (_, index) => Number(((first + index) * step).toPrecision(12)));
  return { range: [ticks[0], ticks.at(-1)], ticks };
}
function plot(xBounds, yBounds, xLabel, yLabel, integerX = false) {
  const xAxis = niceAxis(xBounds, integerX), yAxis = niceAxis(yBounds);
  const xRange = xAxis.range, yRange = yAxis.range;
  const x = (v) => 86 + (v - xRange[0]) / (xRange[1] - xRange[0]) * 472;
  const y = (v) => 330 - (v - yRange[0]) / (yRange[1] - yRange[0]) * 248;
  let svg = '';
  for (const value of xAxis.ticks) {
    svg += `<path class="fig-grid" d="M${x(value)},82V330"/>`;
    svg += label(x(value), 352, value.toString(), 'text-anchor="middle" class="fig-tick fig-tick-x"');
  }
  for (const value of yAxis.ticks) {
    svg += `<path class="fig-grid" d="M86,${y(value)}H558"/>`;
    svg += label(75, y(value) + 5, value.toString(), 'text-anchor="end" class="fig-tick fig-tick-y"');
  }
  svg += '<path class="fig-axis" d="M86,82V330H558"/>';
  svg += label(322, 387, xLabel, 'text-anchor="middle"');
  svg += label(22, 206, yLabel, `text-anchor="middle" transform="rotate(-90 22 206)"${yLabel.length > 18 ? ' textLength="226" lengthAdjust="spacingAndGlyphs"' : ''}`);
  return { x, y, svg, xRange };
}
function path(points, x, y, style = 'fig-primary', curve = curveLinear) {
  return `<path class="${style}" d="${line().x((p) => x(p[0])).y((p) => y(p[1])).curve(curve)(points)}"/>`;
}
function mark(x, y, text) {
  const anchor = x > 420 ? 'end' : 'start', offset = x > 420 ? -10 : 10;
  return `<circle class="fig-marker" cx="${x}" cy="${y}" r="6"/>${label(x + offset, y < 115 ? y + 23 : y - 12, text, `text-anchor="${anchor}" class="fig-annotation"`)}`;
}

export function renderFigure(input, alt = input.description) {
  const data = validateFigure(input);
  if (typeof alt !== 'string' || !alt.trim()) throw new Error(`圖 ${data.id} 缺少替代文字／圖說`);
  let chart = '', values = '', summary = '';
  if (data.kind === 'roc' || data.kind === 'pr') {
    const result = classificationCurve(data.samples), roc = data.kind === 'roc';
    const p = plot([0, 1], [0, 1], roc ? '假陽率 FPR（比例）' : '召回率 Recall（比例）', roc ? '真陽率 TPR（比例）' : '精確率 Precision（比例）');
    chart = p.svg;
    chart += path(roc ? [[0, 0], [1, 1]] : [[0, result.prevalence], [1, result.prevalence]], p.x, p.y, 'fig-reference');
    chart += path(result.points.map((point) => [roc ? point.fpr : point.recall, roc ? point.tpr : point.precision]), p.x, p.y, 'fig-primary', roc ? curveLinear : curveStepBefore);
    chart += result.points.map((point) => `<circle class="fig-point" cx="${p.x(roc ? point.fpr : point.recall)}" cy="${p.y(roc ? point.tpr : point.precision)}" r="3"/>`).join('');
    for (const threshold of data.thresholds ?? []) {
      const c = confusion(data.samples, threshold);
      if (!roc && c.precision === null) throw new Error(`圖 ${data.id}：閾值 ${threshold} 無預測正例，精確率未定義，不能標點`);
      chart += mark(p.x(roc ? c.fpr : c.recall), p.y(roc ? c.recall : c.precision), `閾值 ${f(threshold)}`);
    }
    summary = roc ? `AUC = ${f(result.auc)}` : `平均精確率 AP = ${f(result.averagePrecision)}（階梯積分）`;
    values = table(['閾值（score ≥）', roc ? 'FPR' : 'Recall', roc ? 'TPR' : 'Precision'], result.points.map((point) => [point.threshold, roc ? point.fpr : point.recall, roc ? point.tpr : point.precision]), data.title);
    if (!roc) summary += '；無預測正例的起點採繪圖慣例 Precision = 1';
    summary += '；虛線為參考基準';
  } else if (data.kind === 'learning-curve') {
    const p = plot(range(data.points.map((v) => v.epoch)), range(data.points.flatMap((v) => [v.train, v.validation]), true), '訓練輪次 Epoch（輪）', `${data.metric}（${data.unit}）`, true);
    chart = p.svg + path(data.points.map((v) => [v.epoch, v.train]), p.x, p.y) + path(data.points.map((v) => [v.epoch, v.validation]), p.x, p.y, 'fig-secondary');
    for (const point of data.points) {
      chart += `<circle class="fig-point" cx="${p.x(point.epoch)}" cy="${p.y(point.train)}" r="3"/><rect class="fig-square" x="${p.x(point.epoch) - 3}" y="${p.y(point.validation) - 3}" width="6" height="6"/>`;
    }
    if (data.earlyStopping !== undefined) {
      const point = data.points.find((v) => v.epoch === data.earlyStopping);
      chart += mark(p.x(point.epoch), p.y(point.validation), `停止點：第 ${point.epoch} 輪`);
    }
    summary = '實線＋圓點：訓練；虛線＋方點：驗證';
    values = table(['Epoch（輪）', `訓練 ${data.metric}`, `驗證 ${data.metric}`], data.points.map((v) => [v.epoch, v.train, v.validation]), data.title);
  } else if (data.kind === 'residual') {
    const rows = data.samples.map((v) => [v.predicted, v.actual, v.actual - v.predicted]);
    const p = plot(range(rows.map((v) => v[0])), range(rows.map((v) => v[2]), true), `預測值（${data.unit}）`, `殘差（${data.unit}）`);
    const [minimum, maximum] = p.xRange;
    chart = p.svg + path([[minimum, 0], [maximum, 0]], p.x, p.y, 'fig-reference');
    chart += rows.map((v) => `<circle class="fig-scatter" cx="${p.x(v[0])}" cy="${p.y(v[2])}" r="5"/>`).join('');
    summary = '殘差 = 實際值 − 預測值；虛線為零殘差';
    values = table([`預測值（${data.unit}）`, `實際值（${data.unit}）`, `殘差（${data.unit}）`], rows, data.title);
  } else {
    const c = confusion(data.samples, data.threshold);
    chart = label(342, 96, '預測類別', 'text-anchor="middle"') + label(244, 127, '正例（1）', 'text-anchor="middle"') + label(440, 127, '負例（0）', 'text-anchor="middle"');
    chart += label(53, 235, '實際類別', 'text-anchor="middle" transform="rotate(-90 53 235)"') + label(139, 204, '正例（1）', 'text-anchor="end"') + label(139, 299, '負例（0）', 'text-anchor="end"');
    [[c.tp, 'TP'], [c.fn, 'FN'], [c.fp, 'FP'], [c.tn, 'TN']].forEach(([value, name], i) => {
      const x = 153 + i % 2 * 196, y = 143 + Math.floor(i / 2) * 95;
      chart += `<rect class="fig-cell" x="${x}" y="${y}" width="184" height="83" rx="8"/>${label(x + 92, y + 34, name, 'text-anchor="middle"')}${label(x + 92, y + 62, `${value} 筆`, 'text-anchor="middle" class="fig-count"')}`;
    });
    summary = `閾值 ${f(data.threshold)}（score ≥）；Precision = ${f(c.precision)}；Recall = ${f(c.recall)}；F1 = ${f(c.f1)}；Accuracy = ${f(c.accuracy)}`;
    values = table(['實際／預測', '正例（1）', '負例（0）'], [['正例（1）', c.tp, c.fn], ['負例（0）', c.fp, c.tn]], `${data.title}（單位：筆）`);
  }
  const source = `${data.source.type === 'synthetic' ? '教學模擬資料' : '資料來源'}：${data.source.note}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 410" role="img" aria-label="${e(data.title)}：${e(alt)} ${e(data.description)} ${e(summary)}" data-pagefind-ignore><title>${e(data.title)}</title><desc>${e(alt)} ${e(data.description)} ${e(summary)}</desc>${label(322, 40, data.title, 'text-anchor="middle" class="fig-title"')}${chart}</svg>`;
  return `<figure class="textbook-figure" data-figure="${e(data.id)}"><div class="figure-scroll" tabindex="0" role="region" aria-label="${e(data.title)}">${svg}</div><figcaption>${e(alt)}</figcaption><p class="figure-metrics">${e(summary)}</p><p class="figure-source">${e(source)}</p>${values}</figure>`;
}
