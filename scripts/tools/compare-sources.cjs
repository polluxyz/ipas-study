const fs = require('fs');
const [mode, subject, ...args] = process.argv.slice(2);
const file = subject.startsWith('guide') ? `text/${subject}.txt` : `text/exam_${subject}.txt`;
const source = fs.readFileSync(file, 'utf8');
const pages = source.split('\f');
function label(p) {
  return [...p.matchAll(/^\s*(\d+-\d+)\s*$/gm)].map(m => m[1]).join(',') || '?';
}
if (mode === 'scan') {
  for (const term of args) {
    const re = new RegExp(term, 'i');
    const found = [];
    pages.forEach((p, i) => {
      const compact = p.replace(/\s+/g, '');
      const m = re.exec(compact);
      if (m) found.push(`PDF ${i+1} / ${label(p)}: ${compact.slice(Math.max(0,m.index-45),m.index+140)}`);
    });
    console.log(`\n[${term}] ${found.length} pages\n${found.slice(0,6).join('\n')}`);
  }
} else if (mode === 'find') {
  for (const term of args) {
    const re = new RegExp(term, 'i');
    const found = [];
    pages.forEach((p, i) => {
      const lines = p.split(/\r?\n/);
      lines.forEach((line, j) => {
        if (re.test(line)) found.push(`PDF ${i+1} / ${label(p)}: ${lines.slice(Math.max(0,j-1),j+3).join(' ').replace(/\s+/g,' ').trim()}`);
      });
    });
    console.log(`\n[${term}] ${found.length} hits\n${found.join('\n')}`);
  }
} else if (mode === 'pages') {
  for (const p of pages) if (args.includes(label(p))) console.log(p);
} else if (mode === 'questions') {
  const cleaned = source.replace(/\f/g,'\n');
  const matches = [...cleaned.matchAll(/^\s*[A-DＡ-Ｄ]?\s*(\d{1,2})\.\s*([^\n].*)/gm)];
  const limit = Number(args[0] || 280);
  for (let i=0;i<matches.length;i++) {
    const start = matches[i].index;
    const end = matches[i+1]?.index ?? cleaned.length;
    const block = cleaned.slice(start,end).replace(/\s+/g,' ').trim();
    console.log(block.slice(0,limit));
  }
}
