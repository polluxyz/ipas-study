/** 在共用 Markdown 管線辨認教材提示框；保留內部 Markdown，語法錯誤附來源與行號。 */
const titles = { tip: '重點', caution: '注意', note: '例子' };
const fence = /^:::(tip|caution|note)(?:\[([^\[\]]+)\])?$/;
const supplementFence = /^:::supplement\[來源：\s*(\S.*?)\]$/u;
import { mergeSupplementBlocks } from '../src/lib/supplement-blocks.ts';
function supplementNode(source, position) {
  return { type: 'supplement', position, data: { hName: 'div', hProperties: { className: ['textbook-supplement'], 'data-supplement': '', 'data-supplement-kind': 'paragraph' } }, sources: source.split('；').map((part) => part.trim()).filter(Boolean), children: [] };
}
function finish(node, body) {
  if (node.type === 'supplement') node.children = body;
  else node.children.push({ type: 'asideContent', data: { hName: 'div', hProperties: { className: ['starlight-aside__content'] } }, children: body });
}
function asideNode(kind, title, position, titleChildren = [{ type: 'text', value: title }]) {
  return { type: 'aside', position, data: { hName: 'aside', hProperties: { className: ['starlight-aside', `starlight-aside--${kind}`], ariaLabel: title } }, children: [{ type: 'paragraph', data: { hProperties: { className: ['starlight-aside__title'] } }, children: titleChildren }] };
}

export default function asides() {
  const processor = this;
  return (tree, file) => {
    const fail = (message, node) => { throw new Error(`${file.path ?? file.history?.[0] ?? 'Markdown'}:${node.position?.start?.line ?? '?'} 提示框：${message}`); };
    // 同長度的 ::: 可巢狀使用。先把分隔行換成獨立 AST 標記，避免 directive 解析器提早關閉外框，
    // 也避免清單把緊接的 ::: 吞進最後一項；程式、公式與註解裡的文字完全不動。
    const raw = String(file.value ?? '');
    const markers = [];
    if (/^ {0,3}:::supplement/m.test(raw)) {
      const lines = raw.split(/\r?\n/), normalized = [], lineMap = [];
      let code, math = false, comment = false;
      const push = (value, index) => { normalized.push(value); lineMap.push(index + 1); };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i], codeFence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (code) {
          if (codeFence && codeFence[1][0] === code[0] && codeFence[1].length >= code.length && !codeFence[2].trim()) code = undefined;
          push(line, i); continue;
        }
        if (codeFence) { code = codeFence[1]; push(line, i); continue; }
        if (comment) { if (line.includes('-->')) comment = false; push(line, i); continue; }
        if (/^\s*<!--/.test(line)) { comment = !line.includes('-->'); push(line, i); continue; }
        if (/^\s*\$\$/.test(line)) { if (!line.trim().slice(2).includes('$$')) math = !math; push(line, i); continue; }
        if (!math && /^ {0,3}:::/.test(line)) {
          push('', i); push(`<!--ipas-aside:${markers.length}-->`, i); push('', i); markers.push(line.trim());
        } else push(line, i);
      }
      const reparsed = processor.parse(normalized.join('\n'));
      const offsets = [0]; for (const line of lines) offsets.push(offsets.at(-1) + line.length + 1);
      const remap = (node) => {
        for (const point of [node.position?.start, node.position?.end]) if (point) {
          point.line = lineMap[point.line - 1] ?? lines.length;
          point.offset = offsets[point.line - 1] + Math.min(point.column - 1, lines[point.line - 1]?.length ?? 0);
        }
        node.children?.forEach(remap);
      };
      remap(reparsed); tree.children = reparsed.children;
    }
    // 分隔線可能和正文被解析成同一段；只拆文字換行，不碰 code、inlineCode 或其他行內節點。
    const split = (paragraph) => {
      const lines = [[]];
      for (const child of paragraph.children) {
        if (child.type !== 'text') { lines.at(-1).push(child); continue; }
        child.value.split('\n').forEach((value, index) => {
          if (index) lines.push([]);
          if (value) lines.at(-1).push({ ...child, value });
        });
      }
      const blocks = []; let body = [];
      const flush = () => { if (body.length) blocks.push({ ...paragraph, children: body }); body = []; };
      for (const line of lines) {
        const text = line.map((part) => part.type === 'text' ? part.value : '\0').join('').trim();
        if (text.startsWith(':::')) { flush(); blocks.push({ type: 'asideFence', value: text, position: line[0]?.position ?? paragraph.position }); }
        else { if (body.length) body.push({ type: 'text', value: '\n' }); body.push(...line); }
      }
      flush(); return blocks;
    };
    const visit = (parent) => {
      if (!parent.children || ['code', 'inlineCode'].includes(parent.type)) return;
      const output = [], stack = [];
      const append = (node) => (stack.at(-1)?.body ?? output).push(node);
      for (const child of parent.children.flatMap((node) => {
        const marker = node.type === 'html' ? /^<!--ipas-aside:(\d+)-->$/.exec(node.value.trim()) : null;
        if (marker && markers[Number(marker[1])] !== undefined) return [{ type: 'asideFence', value: markers[Number(marker[1])], position: node.position }];
        return node.type === 'paragraph' ? split(node) : [node];
      })) {
        // Starlight 會註冊 directive 解析器，但只替 docs 集合轉換樣式；其他集合仍需接手其 AST。
        if (child.type === 'containerDirective') {
          const raw = String(file.value ?? '').slice(child.position?.start?.offset, child.position?.end?.offset).trim();
          const lines = raw.split(/\r?\n/), opening = fence.exec(lines[0]), supplement = supplementFence.exec(lines[0]);
          if (child.name === 'supplement') {
            if (!supplement) fail('補充區塊請用 :::supplement[來源：具體來源]', child);
            if (lines.length < 2 || !/^:::\s*$/.test(lines.at(-1))) fail('補充區塊缺少結尾 :::', child);
            if (child.children[0]?.data?.directiveLabel) child.children.shift();
            visit(child);
            const node = supplementNode(supplement[1], child.position); finish(node, child.children); append(node); continue;
          }
          if (!opening || !Object.hasOwn(titles, child.name)) fail(`不支援或格式錯誤的「${lines[0]}」；僅支援 tip、caution、note`, child);
          if (lines.length < 2 || !/^:::\s*$/.test(lines.at(-1))) fail('缺少結尾 :::', child);
          const titleParagraph = child.children[0]?.data?.directiveLabel ? child.children.shift() : undefined;
          const title = opening[2] ?? titles[child.name];
          const node = asideNode(child.name, title, child.position, titleParagraph?.children);
          visit(child);
          node.children.push({ type: 'asideContent', data: { hName: 'div', hProperties: { className: ['starlight-aside__content'] } }, children: child.children });
          append(node); continue;
        }
        if (child.type !== 'asideFence') { visit(child); append(child); continue; }
        if (child.value === ':::') {
          if (!stack.length) fail('出現沒有開頭的結尾 :::', child);
          const { node, body } = stack.pop();
          finish(node, body);
          append(node); continue;
        }
        const supplement = supplementFence.exec(child.value);
        if (supplement) { stack.push({ node: supplementNode(supplement[1], child.position), body: [] }); continue; }
        const match = fence.exec(child.value);
        if (!match) fail(`不支援或格式錯誤的「${child.value}」；請用 :::tip[標題]、:::caution[標題] 或 :::note[標題]，並以 ::: 結尾`, child);
        const [, kind, title] = match;
        stack.push({ node: asideNode(kind, title ?? titles[kind], child.position), body: [] });
      }
      if (stack.length) fail('缺少結尾 :::', stack.at(-1).node);
      // 共用既有整併規則，直到指引內容或來源不同才切開；來源不進入內文計數。
      parent.children = mergeSupplementBlocks(output.map((node) => node.type === 'supplement'
        ? { kind: 'supplement', sources: node.sources, parts: node.children }
        : { kind: 'guide', parts: [node] })).flatMap((block) => {
        if (block.kind === 'guide') return block.parts;
        const node = supplementNode(block.sources.join('；'));
        node.children = [
          { type: 'paragraph', data: { hProperties: { className: ['supplement-label'] } }, children: [{ type: 'text', value: '補充' }] },
          ...block.parts,
          { type: 'paragraph', data: { hProperties: { className: ['supplement-source'] } }, children: [{ type: 'text', value: `來源：${block.sources.join('；')}` }] },
        ];
        return [node];
      });
    };
    visit(tree);
  };
}
