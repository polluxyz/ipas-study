/** 共用 fenced code 掃描保留原始行號，讓結構檢查與實測工具採用同一個輸出配對規則。 */
export function extractPythonExamples(source) {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const frontmatterEnd = lines[0] === '---' ? lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line)) : -1;
  const blocks = [];
  let fence;
  let comment = false;
  for (let i = frontmatterEnd + 1; i < lines.length; i++) {
    const match = lines[i].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (match && match[1][0] === fence.marker[0] && match[1].length >= fence.marker.length && !match[2].trim()) {
        blocks.push({ ...fence, end: i, closed: true }); fence = undefined;
      } else fence.rows.push(lines[i]);
      continue;
    }
    if (comment) { if (lines[i].includes('-->')) comment = false; continue; }
    if (/^\s*<!--/.test(lines[i])) { comment = !lines[i].includes('-->'); continue; }
    if (match) fence = { marker: match[1], language: match[2].trim().split(/\s/)[0], start: i, rows: [] };
  }
  if (fence) blocks.push({ ...fence, end: lines.length, closed: false });
  return blocks.flatMap((block, i) => {
    if (block.language !== 'python') return [];
    const next = blocks[i + 1];
    const gap = next ? lines.slice(block.end + 1, next.start).join('\n').trim() : '';
    // 只接受一段一般說明；標題、清單、提示框、公式、圖片與表格都會中斷配對。
    const explanation = !gap || (!/\n\s*\n/.test(gap) && !/^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|:::|[>|]|!\[|<|\$\$|(?:[-*_]\s*){3,}$)/m.test(gap));
    const paired = block.closed && next?.closed && next.language === 'text' && explanation;
    return [{ line: block.start + 1, code: block.rows.join('\n'), expected: paired ? next.rows.join('\n') : null, outputLine: paired ? next.start + 1 : null }];
  });
}
