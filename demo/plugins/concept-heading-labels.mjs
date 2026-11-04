/** 建置時統一概念小節名稱；先固定來源錨點，讓既有引用與最後擷取的目錄保持一致。 */
import { rehypeHeadingIds } from '@astrojs/markdown-remark';

export function conceptHeadingLabels() {
  const preserveHeadingIds = rehypeHeadingIds();
  return (tree, file) => {
    const path = String(file.path ?? '').replaceAll('\\', '/');
    if (!/(?:^|\/)content\/concepts\/[^/]+\.md$/.test(path)) return;

    // Astro 在使用者外掛之後再次擷取標題；既有字串 ID 會原樣保留。
    preserveHeadingIds(tree, file);
    const visit = (node) => {
      if (node.type === 'element' && /^h[2-6]$/.test(node.tagName)) {
        const leaves = [];
        const collect = (child) => {
          if (child.type === 'text') leaves.push(child);
          else child.children?.forEach(collect);
        };
        collect(node);
        const title = leaves.map((leaf) => leaf.value).join('');
        const match = /^(\s*)直覺((?:（[^）]*）)*\s*)$/.exec(title);
        if (match) {
          // 只替換完整小節名稱；保留行內格式、連結、後綴與空白。
          const start = match[1].length, end = start + '直覺'.length;
          let offset = 0;
          for (const leaf of leaves) {
            const from = Math.max(0, start - offset);
            const to = Math.min(leaf.value.length, end - offset);
            const length = leaf.value.length;
            if (from < to) leaf.value = leaf.value.slice(0, from) + (offset <= start ? '概念說明' : '') + leaf.value.slice(to);
            offset += length;
          }
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
