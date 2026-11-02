/** 手動連結顯示標題；正文依二級標題分節，自動連結其他概念的首次提及並保留作者用字。 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

function readConcepts(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((name) => name.endsWith('.md')).sort().flatMap((name) => {
    const path = resolve(folder, name);
    const raw = readFileSync(path, 'utf8');
    const data = parse(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
    return data?.id && data?.title ? [{ ...data, path }] : [];
  });
}

function english(term) { return /^[\x20-\x7e]+$/.test(term) && /[a-z]/i.test(term); }
function key(term) { return term.toLowerCase(); }
function escapeRegex(term) { return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function conceptLink(id, text, automatic = false) {
  return { type: 'link', url: `/concepts/${id}/`, ...(automatic ? { data: { hProperties: { 'data-auto-concept-link': '' } } } : {}), children: [{ type: 'text', value: text }] };
}

export default function wikiLinks(options = {}) {
  // 外掛也會被 Astro 打包到 .astro/.prerender；沿用 demo 工作目錄，避免把打包位置誤當專案根目錄。
  const folder = options.folder ?? resolve('../content/concepts');
  return (tree, file = {}) => {
    const concepts = readConcepts(folder), byId = new Map(concepts.map((concept) => [concept.id, concept]));
    const lookup = new Map(), terms = new Map();
    const register = (map, term, id, automatic = true) => {
      if (typeof term !== 'string' || !term.trim()) return;
      const normalized = key(term);
      if (!map.has(normalized)) map.set(normalized, { term, ids: new Set(), automatic: false });
      map.get(normalized).ids.add(id);
      map.get(normalized).automatic ||= automatic;
    };
    for (const concept of concepts) {
      for (const term of [concept.id, concept.title, ...(concept.aliases ?? [])]) register(lookup, term, concept.id);
      register(terms, concept.title, concept.id);
      for (const term of concept.aliases ?? []) register(terms, term, concept.id, !(english(term) && term.length <= 2));
    }
    // 即使歧義詞本次沒有出現在正文，也提早阻止建置，讓所有頁面共用同一份明確詞彙表。
    const ambiguous = [...terms.values()].filter(({ ids }) => ids.size > 1);
    if (ambiguous.length) throw new Error(`概念連結詞有歧義：\n${ambiguous.map(({ term, ids }) => `「${term}」→ ${[...ids].join('、')}`).join('\n')}\n請由協調者修正 aliases。`);
    const candidates = [...terms.values()].filter(({ automatic }) => automatic).sort((a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term));
    const pattern = candidates.length ? new RegExp(candidates.map(({ term }) => {
      const literal = escapeRegex(term);
      return english(term) ? `(?<![A-Za-z0-9_])${literal}(?![A-Za-z0-9_])` : literal;
    }).join('|'), 'giu') : undefined;
    const sourcePath = file.path ? resolve(String(file.path)) : undefined;
    const current = file.data?.astro?.frontmatter?.id ?? concepts.find((concept) => concept.path === sourcePath)?.id;
    const definitions = new Map();
    const collectDefinitions = (node) => {
      if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node.url);
      node.children?.forEach(collectDefinitions);
    };
    collectDefinitions(tree);
    let seen = new Set();
    const automaticText = (text, enabled) => {
      if (!enabled || !pattern) return [{ type: 'text', value: text }];
      const output = []; let cursor = 0;
      for (const match of text.matchAll(pattern)) {
        const id = [...terms.get(key(match[0])).ids][0];
        // 已連過的長詞仍整個消耗，不能回頭把 PR-AUC 裡的 AUC 連向另一個概念。
        if (id === current || seen.has(id)) continue;
        if (match.index > cursor) output.push({ type: 'text', value: text.slice(cursor, match.index) });
        output.push(conceptLink(id, match[0], true)); seen.add(id);
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) output.push({ type: 'text', value: text.slice(cursor) });
      return output.length ? output : [{ type: 'text', value: text }];
    };
    const transformText = (text, enabled) => {
      const output = []; let cursor = 0;
      for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
        if (match.index > cursor) output.push(...automaticText(text.slice(cursor, match.index), enabled));
        const ids = [...(lookup.get(key(match[1]))?.ids ?? [])];
        if (ids.length !== 1) throw new Error(`概念連結「${match[1]}」${ids.length ? `別名有歧義：${ids.join('、')}` : '找不到目標'}，請由內容負責人確認。`);
        output.push(conceptLink(ids[0], byId.get(ids[0]).title));
        if (enabled) seen.add(ids[0]);
        cursor = match.index + match[0].length;
      }
      if (cursor < text.length) output.push(...automaticText(text.slice(cursor), enabled));
      return output.length ? output : [{ type: 'text', value: text }];
    };
    const visit = (node, enabled = true) => {
      if (node.type === 'heading' && node.depth === 2) seen = new Set();
      if (['link', 'linkReference'].includes(node.type)) {
        if (enabled) {
          const url = node.type === 'link' ? node.url : definitions.get(node.identifier.toLowerCase());
          const id = /^\/concepts\/([^/#]+)\/?(?:#.*)?$/.exec(url ?? '')?.[1];
          if (id) seen.add(id);
        }
        return;
      }
      if (!node.children || ['code', 'inlineCode', 'math', 'inlineMath', 'html'].includes(node.type)) return;
      const classes = node.data?.hProperties?.className ?? [];
      const autoEnabled = enabled && node.type !== 'heading' && !classes.includes('starlight-aside__title') && !node.data?.directiveLabel;
      // 行內 HTML 的開閉標籤是文字的兄弟節點；明確保護原生連結與程式區，避免產生巢狀連結。
      const protectedTags = [];
      node.children = node.children.flatMap((child) => {
        if (child.type === 'html') {
          for (const match of child.value.matchAll(/<(\/)?(a|code|pre|math)\b[^>]*>/gi)) {
            const tag = match[2].toLowerCase();
            if (match[1]) { if (protectedTags.at(-1) === tag) protectedTags.pop(); }
            else if (!/\/\s*>$/.test(match[0])) protectedTags.push(tag);
          }
          return [child];
        }
        if (protectedTags.length) return [child];
        if (child.type === 'text') return transformText(child.value, autoEnabled);
        visit(child, autoEnabled); return [child];
      });
    };
    visit(tree);
  };
}
