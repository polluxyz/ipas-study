/** 量測概念正文可見文字的實際前景及逐層背景，避免透明色被當作黑色。 */
import assert from 'node:assert/strict';

export function collectProseSamples() {
  const root = document.querySelector('#concept-body');
  if (!root) throw new Error('缺少概念正文');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const samples = [];
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement;
    if (!node.textContent.trim() || !el || !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue;
    let kind;
    if (el.closest('.katex-html')) kind = 'formula';
    else if (el.closest('.katex')) continue; // MathML 是語意副本，並非畫面上的公式文字。
    else if (el.closest('.textbook-figure .figure-values th')) kind = 'figureHeaders';
    else if (el.closest('.textbook-figure')) continue;
    else if (el.closest('pre')) kind = el.closest('pre').dataset.language === 'text' ? 'output' : 'code';
    else if (el.closest('table')) kind = 'tables';
    else if (el.closest('.starlight-aside')) continue;
    else if (el.closest('p, li, h2, h3, h4, summary')) kind = 'prose';
    else continue;
    const layers = []; let opacity = 1;
    for (let current = el; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== 'none') throw new Error(`無法量測背景圖片：${kind}`);
      if (Number(style.opacity) !== 1) throw new Error(`不支援群組透明度：${kind}`);
      opacity *= Number(style.opacity);
      layers.push(style.backgroundColor);
    }
    samples.push({ kind, text: node.textContent.trim().slice(0, 80), foreground: getComputedStyle(el).color, layers, opacity });
  }
  return samples;
}

function rgba(value) {
  const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  assert.ok(match, `不支援的色彩 ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
}
function over(top, bottom) {
  const alpha = top[3] + bottom[3] * (1 - top[3]);
  return alpha === 0 ? [0, 0, 0, 0] : [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha).concat(alpha);
}
function luminance(color) {
  return color.slice(0, 3).map((v) => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
export function contrastOf(sample) {
  let bg = [255, 255, 255, 1];
  for (const layer of [...sample.layers].reverse()) bg = over(rgba(layer), bg);
  const fg = rgba(sample.foreground); fg[3] *= sample.opacity;
  const ink = over(fg, bg), a = luminance(ink), b = luminance(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
export function assertProseContrast(samples) {
  const result = {};
  for (const kind of ['prose', 'tables', 'figureHeaders', 'code', 'output', 'formula']) {
    const values = samples.filter((sample) => sample.kind === kind).map((sample) => ({ ...sample, ratio: contrastOf(sample) }));
    assert.ok(values.length, `${kind} 沒有可見文字`);
    const worst = values.reduce((a, b) => a.ratio < b.ratio ? a : b);
    result[kind] = { count: values.length, minimum: worst.ratio, worst };
    assert.ok(worst.ratio >= 4.5, `${kind} 對比 ${worst.ratio.toFixed(3)} < 4.5：${worst.text} (${worst.foreground})`);
  }
  return result;
}
