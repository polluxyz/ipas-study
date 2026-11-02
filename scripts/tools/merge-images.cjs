#!/usr/bin/env node
// 依 content/assets/questions/manifest.csv 把圖片檔名寫回題目 YAML 的 image 欄位。
// 規格 site-v1.md 規定 image 只能由腳本回填，worker 不手寫；正式版是 T01c 的 merge-images，
// 這支是 L23303 範例單元先用的簡易版。圖片檔不存在時報錯、不寫入。
// 用 parseDocument 修改再輸出，保留原檔格式。
//
// 用法：node scripts/tools/merge-images.cjs [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const YAML = require(path.join(ROOT, 'demo', 'node_modules', 'yaml'));
const ASSETS = path.join(ROOT, 'content', 'assets', 'questions');

// 只取前兩欄（id、file）；後面的 note 可能含逗號，這裡用不到。
function readManifest() {
  return fs.readFileSync(path.join(ASSETS, 'manifest.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map((line) => {
    const [id, file] = line.split(',').map((s) => s.replace(/^"|"$/g, ''));
    return { id, file };
  });
}

function main(args) {
  const dry = args.includes('--dry-run');
  let errors = 0;
  for (const { id, file } of readManifest()) {
    if (!fs.existsSync(path.join(ASSETS, file))) {
      console.error(`${id}：找不到圖片 ${file}`);
      errors++;
      continue;
    }
    const qfile = path.join(ROOT, 'content', 'questions', 'exam', id.slice(0, 5), `${id}.yaml`);
    const doc = YAML.parseDocument(fs.readFileSync(qfile, 'utf8'));
    if (doc.get('image') === file) continue;
    doc.set('image', file);
    console.log(`${id}：image = ${file}`);
    if (!dry) fs.writeFileSync(qfile, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
  }
  return errors ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
