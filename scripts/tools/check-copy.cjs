#!/usr/bin/env node
// 照抄檢查（規格 Q11 的簡易版）：找出內容檔與學習指引文字版之間「連續 25 字相同」的片段。
// 比對前先拿掉所有空白，因為指引文字版是排版轉出的，換行與空格位置不可靠。
// 只檢查正文與解析；frontmatter 的 id、aliases 這類短欄位不會長到 25 字，不特別排除。
// 題目 YAML 的 stem、options、code 是考卷原文，不在檢查範圍，所以 YAML 只取 explanation 區塊。
// 正式檢查器（T01a）完成後，以檢查器為準。
//
// 用法：node scripts/tools/check-copy.cjs <檔案或資料夾> [...]
// 結束碼：有照抄片段時為 1。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GUIDES = ['text/guide_科目1.txt', 'text/guide_科目3.txt'];
const N = 25;

// 指引的項目符號轉出來是私用區字元（U+E000–U+F8FF）或 ●○■ 這類符號，夾在句子之間會讓比對漏掉，一併拿掉。
function normalize(s) {
  return s.replace(/[\s-●○■□◆◇▪•]+/g, '');
}

// 全是英數符號的片段多半是 API 名稱（例如 LinearDiscriminantAnalysis），不算照抄。
function hasCjk(s) {
  return /[一-鿿]/.test(s);
}

function buildIndex() {
  const grams = new Set();
  for (const g of GUIDES) {
    const t = normalize(fs.readFileSync(path.join(ROOT, g), 'utf8'));
    for (let i = 0; i + N <= t.length; i++) grams.add(t.slice(i, i + N));
  }
  return grams;
}

// YAML 題目只檢查 explanation 之後、guide_refs 之前的文字（解析是自己寫的部分）。
function checkedText(file, raw) {
  if (!file.endsWith('.yaml')) return raw;
  const m = raw.match(/^explanation:[\s\S]*?(?=^\S)/m);
  return m ? m[0] : '';
}

function listFiles(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  return fs.readdirSync(p).flatMap((f) => listFiles(path.join(p, f)))
    .filter((f) => /\.(md|ya?ml)$/.test(f));
}

function main(args) {
  if (args.length === 0) {
    console.error('用法：node scripts/tools/check-copy.cjs <檔案或資料夾> [...]');
    return 2;
  }
  const grams = buildIndex();
  let hits = 0;
  for (const f of args.flatMap(listFiles)) {
    const text = normalize(checkedText(f, fs.readFileSync(f, 'utf8')));
    let i = 0;
    while (i + N <= text.length) {
      if (grams.has(text.slice(i, i + N)) && hasCjk(text.slice(i, i + N))) {
        // 往後延伸，印出整段相同的片段，而不是一次只印 25 字。
        let j = i + N;
        while (j < text.length && grams.has(text.slice(j - N + 1, j + 1))) j++;
        console.log(`${path.relative(ROOT, f)}: ${text.slice(i, j)}`);
        hits++;
        i = j;
      } else {
        i++;
      }
    }
  }
  console.log(hits === 0 ? '照抄檢查通過：0 個片段' : `照抄檢查：${hits} 個片段`);
  return hits === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
