/** 內容使用去標點的穩定錨點；輸出時對照 Astro 真正產生的標題，保留既有概念頁網址。 */

/** @param {string} heading */
export function cheatsheetAnchor(heading) {
  return heading.replace(/[\s\p{P}]/gu, '').toLowerCase();
}

/** @param {string} href */
export function conceptSection(href) {
  const match = href.match(/^\/concepts\/([a-z0-9-]+)\/#(.+)$/);
  if (!match) return undefined;
  try { return { id: match[1], anchor: decodeURIComponent(match[2]) }; }
  catch { return undefined; }
}

/** @typedef {{ slug: string, text: string }} Heading */
/** @param {string} html @param {Map<string, Heading[]>} headings */
export function normalizeCheatsheetLinks(html, headings) {
  // 速查每條已有作者指定的小節入口；不再插入只到概念頁頂端的自動詞彙連結。
  const explicit = html.replace(/<a\b(?=[^>]*\bdata-auto-concept-link(?:[=\s>]))[^>]*>([\s\S]*?)<\/a>/g, '$1');
  return explicit.replace(/href="([^"]*)"/g, (attribute, href) => {
    const target = conceptSection(href);
    if (!target) return attribute;
    const candidates = (headings.get(target.id) ?? []).filter((heading) => heading.slug === target.anchor || cheatsheetAnchor(heading.text) === target.anchor.toLowerCase());
    if (candidates.length !== 1) throw new Error(`速查連結找不到唯一小節：${href}`);
    return `href="/concepts/${target.id}/#${candidates[0].slug}"`;
  });
}
