#!/usr/bin/env node
// 把盲解結果寫回題目 YAML 的 review.blind_answer，並依規則更新 review.status。
// 規格 site-v1.md 規定 blind_answer 只能由腳本寫入，worker 不手寫；正式版是 T01c 的 merge-blind，
// 這支是 L23303 範例單元先用的簡易版，規則相同：
//   - 盲解與官方答案一致，且 answer_checked 已記錄頁序 → status 從 draft 改成 verified。
//   - 不一致 → status 改成 disputed，並列在輸出裡交給人判定（dispute 欄位由人寫，腳本不寫）。
//   - 已經是 disputed 的題目只寫 blind_answer，不改 status。
// 用 parseDocument 修改再輸出，保留原檔的區塊字串與註解格式。
//
// 用法：node scripts/tools/merge-blind.cjs <盲解 CSV> [--dry-run]
// CSV 欄位：id,blind_answer,...（第一列是標題）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// 正式網站建立前，yaml 套件只裝在 demo/ 底下。
const YAML = require(path.join(ROOT, 'demo', 'node_modules', 'yaml'));

// 只取前兩欄；後面的理由欄可能含逗號與引號，這裡用不到。
function readBlind(csvFile) {
  return fs.readFileSync(csvFile, 'utf8').trim().split(/\r?\n/).slice(1).map((line) => {
    const m = line.match(/^"?([^",]+)"?,"?([A-D])"?/);
    if (!m) throw new Error(`無法解析：${line}`);
    return { id: m[1], blind: m[2] };
  });
}

function questionPath(id) {
  // 考古題 ID 的前 5 碼是場次，例如 115-1-S3-Q44 → exam/115-1/
  return path.join(ROOT, 'content', 'questions', 'exam', id.slice(0, 5), `${id}.yaml`);
}

function main(args) {
  const csv = args.find((a) => !a.startsWith('--'));
  const dry = args.includes('--dry-run');
  if (!csv) {
    console.error('用法：node scripts/tools/merge-blind.cjs <盲解 CSV> [--dry-run]');
    return 2;
  }
  const counts = { verified: 0, disputed: 0, unchanged: 0 };
  for (const { id, blind } of readBlind(csv)) {
    const file = questionPath(id);
    const doc = YAML.parseDocument(fs.readFileSync(file, 'utf8'));
    const answer = doc.get('answer');
    const status = doc.getIn(['review', 'status']);
    const checked = doc.getIn(['review', 'answer_checked', 'pdf_page']) != null;
    doc.setIn(['review', 'blind_answer'], blind);
    let next = status;
    if (status === 'draft' && blind === answer && checked) next = 'verified';
    else if (status !== 'disputed' && blind !== answer) next = 'disputed';
    if (next !== status) doc.setIn(['review', 'status'], next);
    if (next === 'disputed' && status !== 'disputed') console.log(`${id}：盲解 ${blind} ≠ 官方 ${answer}，改成 disputed，需補 dispute 說明`);
    counts[next === status ? 'unchanged' : next]++;
    if (!dry) fs.writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
  }
  console.log(`verified ${counts.verified}、disputed ${counts.disputed}、status 不變 ${counts.unchanged}${dry ? '（dry run，未寫檔）' : ''}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
