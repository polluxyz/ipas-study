/** 公式保留 MathML 可存取性但不索引排版字元；進階小節包成原生 details，無 JS 仍可展開。 */
export function mathSearchPolicy() {
  return (tree, file) => {
    const visit = (node) => {
      if (node.type === 'element' && node.properties?.className?.includes('katex')) node.properties['data-pagefind-ignore'] = '';
      node.children?.forEach(visit);
    };
    visit(tree);
    for (const message of file.messages ?? []) {
      if (message.source === 'rehype-katex') throw new Error(`公式無法渲染：${message.reason}`);
    }
  };
}
function nodeText(node) { return node.type === 'text' ? node.value : (node.children ?? []).map(nodeText).join(''); }
/** 表格在自己的可聚焦區域捲動，短儲存格整行顯示，長文字保留自然換行。 */
export function readableTables() {
  return (tree) => {
    const visit = (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== 'element' || node.tagName !== 'table') { visit(node); return node; }
        const mark = (cell) => {
          if (cell.type === 'element' && ['td', 'th'].includes(cell.tagName)) {
            cell.properties ??= {};
            cell.properties.className = [...(cell.properties.className ?? []), nodeText(cell).trim().length <= 16 ? 'table-short-cell' : 'table-long-cell'];
          }
          cell.children?.forEach(mark);
        };
        mark(node);
        return { type: 'element', tagName: 'div', properties: { className: ['textbook-table-scroll'], tabIndex: 0, role: 'region', ariaLabel: '教材表格，可左右捲動' }, children: [node] };
      });
    };
    visit(tree);
  };
}
export function collapseAdvanced() {
  return (tree) => {
    const visit = (node) => {
      if (!node.children) return;
      const children = node.children, output = [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type === 'element' && child.tagName === 'h2' && /^進階(?:（補充）)?$/.test(nodeText(child).trim())) {
          const body = [];
          while (i + 1 < children.length && !(children[i + 1].type === 'element' && /^h[12]$/.test(children[i + 1].tagName))) body.push(children[++i]);
          // 把錨點保留在 details，側欄連結仍能定位；summary 保留原標題的文字與連結。
          output.push({ type: 'element', tagName: 'details', properties: { className: ['textbook-advanced'], id: child.properties?.id ?? '進階' }, children: [{ type: 'element', tagName: 'summary', properties: {}, children: child.children }, ...body] });
        } else { visit(child); output.push(child); }
      }
      node.children = output;
    };
    visit(tree);
  };
}
