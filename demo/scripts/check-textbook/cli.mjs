/** 命令列只負責參數與結束碼，匯入本模組不會讀檔或寫入輸出。 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkTextbook, formatReport } from './index.mjs';

export async function main(args = process.argv.slice(2), io = process) {
  let contentDir;
  let json = false;
  let summaryOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--summary') summaryOnly = true;
    else if (args[i] === '--content' && args[i + 1]) contentDir = resolve(args[++i]);
    else if (args[i] === '--help') { io.stdout.write('用法：node demo/scripts/check-textbook/cli.mjs [--content <目錄>] [--summary] [--json]\n結束碼：0 無錯誤（可有警告）；1 內容錯誤；2 執行或參數錯誤。\n'); return 0; }
    else { io.stderr.write(`未知或不完整參數：${args[i]}\n`); return 2; }
  }
  try {
    const report = await checkTextbook(contentDir ? { contentDir } : {});
    io.stdout.write(json ? JSON.stringify(report, null, 2) + '\n' : formatReport(report, { summaryOnly }));
    return report.summary.errors ? 1 : 0;
  } catch (error) { io.stderr.write(`教材檢查執行失敗：${error.message}\n`); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
