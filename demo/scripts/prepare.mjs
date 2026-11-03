/** 重建分析表與瀏覽器版本索引、圖片副本，原始內容保持唯讀。 */
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';
import { pathToFileURL } from 'node:url';
import { exportAnalysis, formatSummary } from './export-analysis.mjs';

async function files(folder) {
  try { return (await Promise.all((await readdir(folder, { withFileTypes: true })).map((entry) => entry.isDirectory() ? files(join(folder, entry.name)) : [join(folder, entry.name)]))).flat(); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
export async function main() {
  console.log(formatSummary(await exportAnalysis()).trimEnd());
  const root = resolve(import.meta.dirname, '..');
  const revisions = {};
  for (const file of await files(resolve(root, '../content/questions'))) {
    if (!/\.ya?ml$/.test(file)) continue;
    const data = parse(await readFile(file, 'utf8'));
    revisions[data.id] = data.rev;
  }
  await mkdir(resolve(root, 'src/data'), { recursive: true });
  await writeFile(resolve(root, 'src/data/revisions.json'), JSON.stringify(revisions, null, 2) + '\n');
  const assets = resolve(root, '../content/assets/questions');
  for (const file of await files(assets)) {
    if (!/\.(png|jpe?g|svg|webp)$/i.test(file)) continue;
    const destination = resolve(root, 'public/question-assets', file.slice(assets.length + 1));
    await mkdir(resolve(destination, '..'), { recursive: true }); await copyFile(file, destination);
  }
  console.log(`已更新 ${Object.keys(revisions).length} 題版本索引（未更動 content/）。`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
