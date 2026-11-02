/** 分組補充小節並辨認表格／清單的尾端註記；有序清單固定原始序號，篩選後仍可對照正文步驟。 */
function text(node) { return node.type === 'text' ? node.value : (node.children ?? []).map(text).join(''); }
function itemText(node) { return node.type === 'element' && ['ul', 'ol'].includes(node.tagName) ? '' : node.type === 'text' ? node.value : (node.children ?? []).map(itemText).join(''); }
function depth(node) { return node.type === 'element' && /^h[1-6]$/.test(node.tagName) ? Number(node.tagName[1]) : 0; }
function mark(node, kind) { node.properties ??= {}; node.properties['data-supplement'] = ''; node.properties['data-supplement-kind'] = kind; }
function preserveNumbers(list) {
  if (list.type !== 'element' || list.tagName !== 'ol') return;
  const items = list.children.filter((child) => child.type === 'element' && child.tagName === 'li');
  if (!items.some((item) => item.properties?.['data-supplement-kind'] === 'list-item')) return;
  const reversed = list.properties?.reversed === true || list.properties?.reversed === '';
  let number = Number(list.properties?.start ?? (reversed ? items.length : 1));
  for (const item of items) {
    if (item.properties?.value !== undefined) number = Number(item.properties.value);
    item.properties ??= {}; item.properties.value = number;
    number += reversed ? -1 : 1;
  }
}
export function supplementSections() {
  return (tree) => {
    const visit = (parent) => {
      if (!parent.children) return;
      const output = [], children = parent.children;
      for (let i = 0; i < children.length; i++) {
        const node = children[i], level = depth(node), title = text(node).trim();
        if (level && /^(?:參考來源)(?:（補充）)?$/.test(title)) { output.push(node); continue; }
        if (level >= 2 && level <= 4 && title.endsWith('（補充）')) {
          const body = [node];
          while (i + 1 < children.length) {
            const next = children[i + 1], nextLevel = depth(next);
            if (nextLevel && (nextLevel <= level || /^參考來源(?:（補充）)?$/.test(text(next).trim()))) break;
            body.push(children[++i]);
          }
          const wrapper = { type: 'element', tagName: 'section', properties: { className: ['textbook-supplement-section'], 'data-supplement': '', 'data-supplement-kind': 'section' }, children: body };
          output.push(wrapper);
        } else {
          const firstCell = node.type === 'element' && node.tagName === 'tr' ? node.children.find((cell) => cell.type === 'element' && cell.tagName === 'td') : undefined;
          if (firstCell && text(firstCell).trim().endsWith('（補充）')) mark(node, 'row');
          if (node.type === 'element' && node.tagName === 'li' && itemText(node).trim().endsWith('（補充）')) mark(node, 'list-item');
          visit(node); output.push(node);
        }
      }
      parent.children = output;
      preserveNumbers(parent);
    };
    visit(tree);
  };
}
