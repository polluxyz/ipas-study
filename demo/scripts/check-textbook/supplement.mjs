/** T9 只掃描非程式、非公式與非註解行；巢狀提示框各自配對，避免提早結束補充區塊。 */
export function checkSupplements(rows, add) {
  const stack = [], sections = [];
  for (const row of rows) {
    const heading = row.text.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length, title = heading[2].trim();
      while (sections.length && sections.at(-1) >= level) sections.pop();
      if (/^參考來源（補充）$/.test(title)) add('T9', row.line, '「參考來源」不可標為補充。');
      if (/^參考來源(?:（補充）)?$/.test(title)) sections.length = 0;
      else if (level >= 2 && level <= 4 && title.endsWith('（補充）')) sections.push(level);
    }
    const value = row.text.trim();
    if (/^:::supplement(?:\[|\s|$)/.test(value)) {
      if (!/^:::supplement\[來源：\s*\S.*\]$/.test(value) || /^:::supplement\[來源：\s*\]$/.test(value)) add('T9', row.line, '補充區塊須寫成 :::supplement[來源：具體來源]，來源不可空白。');
      if (sections.length) add('T9', row.line, '已標「（補充）」的小節內不需再包補充區塊。', 'warning');
      stack.push({ supplement: true, line: row.line });
    } else if (/^:::[\w-]+(?:\[|\s|$)/.test(value)) stack.push({ supplement: false, line: row.line });
    else if (value === ':::') stack.pop();
  }
  for (const block of stack) if (block.supplement) add('T9', block.line, '補充區塊缺少對應的結尾 :::。');
}
