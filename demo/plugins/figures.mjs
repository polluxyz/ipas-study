/** 將受控 figure: 引用轉成建置產物；預設只讀根目錄的圖資，錯誤附上正文來源。 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderFigure, escapeHtml } from '../src/lib/figures/render.mjs';

export function loadFigure(id, alt, directory = resolve('../content/figures')) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`無效圖 ID：${id}`);
  if (!alt?.trim()) throw new Error(`圖 ${id} 缺少替代文字／圖說`);
  const json = resolve(directory, `${id}.json`), svg = resolve(directory, `${id}.svg`);
  if (existsSync(json) && existsSync(svg)) throw new Error(`圖 ${id} 同時有 JSON 與 SVG，請只保留一種`);
  if (existsSync(json)) {
    const data = JSON.parse(readFileSync(json, 'utf8'));
    if (data.id !== id) throw new Error(`${json} 的 id 與檔名不一致`);
    return renderFigure(data, alt);
  }
  if (existsSync(svg)) {
    const raw = readFileSync(svg, 'utf8');
    if (!/<svg[\s>]/.test(raw) || !/<title[\s>]/.test(raw) || !/<desc[\s>]/.test(raw)) throw new Error(`${svg} 需要 svg、title 與 desc`);
    // 以圖片載入示意圖，不執行其中腳本；所有資產必須自足，禁止外部資源。
    if (/(?:href\s*=\s*["']\s*(?:https?:|\/\/)|url\(\s*["']?\s*(?:https?:|\/\/))/i.test(raw)) throw new Error(`${svg} 不得引用外部資源`);
    return `<figure class="textbook-figure"><div class="figure-scroll"><img src="data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}" alt="${escapeHtml(alt)}" /></div><figcaption>${escapeHtml(alt)}</figcaption><p class="figure-source">示意圖</p></figure>`;
  }
  throw new Error(`找不到圖 ${id}，預期檔案：${json} 或 ${svg}`);
}

export default function figures(options = {}) {
  return (tree, file) => {
    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === 'paragraph' && child.children.some((part) => part.type === 'image' && part.url.startsWith('figure:'))) {
          const output = []; let paragraph = [];
          const flush = () => { if (paragraph.length) output.push({ ...child, children: paragraph }); paragraph = []; };
          for (const part of child.children) {
            if (part.type !== 'image' || !part.url.startsWith('figure:')) { paragraph.push(part); continue; }
            flush();
            try { output.push({ type: 'html', value: loadFigure(part.url.slice(7), part.alt, options.directory) }); }
            catch (error) { throw new Error(`${file.path ?? file.history?.[0] ?? 'Markdown'}：${error.message}`); }
          }
          flush(); return output;
        }
        visit(child); return [child];
      });
    };
    visit(tree);
  };
}
