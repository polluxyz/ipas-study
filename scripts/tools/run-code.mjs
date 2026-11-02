/** 在獨立暫存目錄實測教材 Python，逐行核對 stdout；匯入本模組不執行程式或寫檔。 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractPythonExamples } from '../../demo/scripts/check-textbook/python.mjs';

export function normalizeOutput(value) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  // stdout 最後一個換行是行終止符；保留額外空白列與所有行首空白。
  if (lines.at(-1) === '') lines.pop();
  return lines.map((line) => line.replace(/\s+$/u, ''));
}

export function compareOutput(expected, actual) {
  const wanted = normalizeOutput(expected);
  const received = normalizeOutput(actual);
  const differences = [];
  for (let i = 0; i < Math.max(wanted.length, received.length); i++) {
    if (wanted[i] !== received[i]) differences.push({ line: i + 1, expected: wanted[i] ?? null, actual: received[i] ?? null });
  }
  return { passed: differences.length === 0, differences };
}

export async function executePython(code, { projectDir, timeout = 120, uv = 'uv' }) {
  const folder = await mkdtemp(join(tmpdir(), 'textbook-python-'));
  try {
    const script = join(folder, 'example.py');
    await writeFile(script, code, 'utf8');
    return await new Promise((done) => {
      const child = spawn(uv, ['run', '--project', projectDir, 'python', script], {
        cwd: folder, windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', MLFLOW_DISABLE_AGENT_HINT: '1' },
      });
      let stdout = ''; let stderr = ''; let timedOut = false; let failure = '';
      function stop() {
        if (process.platform === 'win32' && child.pid) {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.on('error', () => child.kill('SIGKILL'));
        } else child.kill('SIGKILL');
      }
      const timer = setTimeout(() => { timedOut = true; stop(); }, timeout * 1000);
      const capture = (target) => (chunk) => {
        if (target === 'stdout') stdout += chunk; else stderr += chunk;
        if (stdout.length + stderr.length > 8 * 1024 * 1024 && !failure) { failure = '輸出超過 8 MiB 上限'; stop(); }
      };
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', capture('stdout')); child.stderr.on('data', capture('stderr'));
      child.on('error', (error) => { failure = error.message; });
      child.on('close', (exitCode, signal) => {
        clearTimeout(timer);
        done({ stdout, stderr, exitCode, signal, timedOut, failure });
      });
    });
  } finally { await rm(folder, { recursive: true, force: true }); }
}

export async function runFiles(paths, { timeout = 120, projectDir = resolve(import.meta.dirname, '../../tools/python'), execute = executePython } = {}) {
  const results = [];
  for (const path of paths) {
    const file = resolve(path);
    const examples = extractPythonExamples(await readFile(file, 'utf8'));
    if (!examples.length) results.push({ file, line: null, status: '無程式', stderr: '', diff: '' });
    if (!examples.length) continue;
    const { code, marker } = buildPageProgram(examples);
    let execution;
    try { execution = await execute(code, { projectDir, timeout }); }
    catch (error) { execution = { exitCode: null, failure: error.message, stdout: '', stderr: '' }; }
    const records = new Map();
    for (const line of execution.stdout.split(/\r?\n/)) {
      if (!line.startsWith(marker)) continue;
      try { const record = JSON.parse(line.slice(marker.length)); records.set(record.index, record); } catch { /* 不完整紀錄視為未完成區塊。 */ }
    }
    let previousFailed = false;
    const processFailed = execution.exitCode !== 0 || execution.timedOut || execution.failure;
    for (const [index, example] of examples.entries()) {
      const record = records.get(index);
      const failed = previousFailed || !record || record.failed || (index === examples.length - 1 && processFailed);
      const actual = record?.stdout ?? '';
      const comparison = example.expected === null ? null : compareOutput(example.expected, actual);
      const diff = comparison?.differences.map((row) => `@@ 第 ${row.line} 行 @@\n- ${row.expected === null ? '（無此行）' : row.expected}\n+ ${row.actual === null ? '（無此行）' : row.actual}`).join('\n') ?? '';
      results.push({ ...example, ...execution, stdout: actual, stderr: (record?.stderr ?? '') + (index === 0 || failed ? execution.stderr : ''), file, status: failed ? '執行失敗' : comparison?.passed ? '通過' : '不符', diff,
        failure: failed ? previousFailed ? '前一段執行失敗，後續未執行。' : execution.failure || (record?.failed ? 'Python 區塊發生例外。' : '行程未完成此區塊。') : '',
        note: example.expected === null ? '缺少緊接的 text 輸出區塊，無法核對；本段仍參與同頁依序執行。' : '' });
      previousFailed ||= Boolean(failed);
    }
  }
  return results;
}

export function buildPageProgram(examples) {
  const marker = `TEXTBOOK_${randomUUID()}_`;
  const encoded = Buffer.from(JSON.stringify(examples.map(({ code, line }) => ({ code, line }))), 'utf8').toString('base64');
  const code = `import base64 as _b64, contextlib as _ctx, io as _io, json as _json, traceback as _tb
_blocks = _json.loads(_b64.b64decode('${encoded}'))
_scope = {'__name__': '__main__'}
for _index, _block in enumerate(_blocks):
    _out, _err = _io.StringIO(), _io.StringIO()
    _failed = False
    with _ctx.redirect_stdout(_out), _ctx.redirect_stderr(_err):
        try:
            exec(compile(_block['code'], '<textbook-line-' + str(_block['line']) + '>', 'exec'), _scope)
        except BaseException:
            _failed = True
            _tb.print_exc()
    print('${marker}' + _json.dumps({'index': _index, 'stdout': _out.getvalue(), 'stderr': _err.getvalue(), 'failed': _failed}), flush=True)
    if _failed:
        break
`;
  return { code, marker };
}

function fenced(value, language = 'text') {
  const runs = value.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}${language}\n${value}\n${fence}`;
}

export function formatRunReport(results) {
  const counts = Object.fromEntries(['通過', '不符', '執行失敗', '無程式'].map((status) => [status, results.filter((row) => row.status === status).length]));
  const lines = ['# 教材程式實測報告', '', `通過 ${counts['通過']}；不符 ${counts['不符']}；執行失敗 ${counts['執行失敗']}；無程式 ${counts['無程式']}。`, '',
    '同頁各段在同一 Python 行程依序執行，共享變數與暫存產物；頁面之間隔離。某段失敗時，該段與後續各段標為執行失敗。只比較 stdout，保留行首空白與空白列，忽略行尾空白與最後一個行終止換行。', ''];
  for (const row of results) {
    lines.push(`## ${relative(process.cwd(), row.file).replace(/\\/g, '/')}：${row.line ?? '—'} — ${row.status}`, '');
    if (row.note) lines.push(row.note, '');
    if (row.status === '執行失敗') lines.push(`結束碼：${row.exitCode ?? '無'}；逾時：${row.timedOut ? '是' : '否'}；原因：${row.failure || row.signal || '非零結束碼'}。`, '');
    lines.push('差異（− 教材、+ 實際）：', '', row.diff ? fenced(row.diff, 'diff') : '無可列差異。', '');
    if (row.status !== '無程式') lines.push('實際 stdout：', '', fenced(row.stdout || '（空白）'), '');
    lines.push('stderr 摘要：', '', row.stderr ? fenced(row.stderr.split(/\r?\n/).slice(0, 12).join('\n').slice(0, 2400)) : '無。', '');
  }
  return lines.join('\n');
}

export async function main(args = process.argv.slice(2), io = process) {
  const paths = []; let out; let timeout = 120;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') { io.stdout.write('用法：node scripts/tools/run-code.mjs <概念頁> [更多概念頁] --out <Markdown報告> [--timeout <秒，預設120>]\n結束碼：0 全部通過；1 不符或執行失敗；2 參數或讀寫失敗。\n'); return 0; }
    if (args[i] === '--out' && args[i + 1] && !args[i + 1].startsWith('--')) out = resolve(args[++i]);
    else if (args[i] === '--timeout' && args[i + 1]) timeout = Number(args[++i]);
    else if (args[i].startsWith('--')) { io.stderr.write(`未知或不完整參數：${args[i]}\n`); return 2; }
    else paths.push(args[i]);
  }
  if (!paths.length || !out || !Number.isFinite(timeout) || timeout <= 0) { io.stderr.write('必須提供概念頁、--out，且 --timeout 必須是正秒數。\n'); return 2; }
  if (paths.some((path) => resolve(path) === out)) { io.stderr.write('報告不可覆寫輸入教材。\n'); return 2; }
  try {
    const results = await runFiles(paths, { timeout });
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, formatRunReport(results), 'utf8');
    io.stdout.write(`已寫入 ${out}；通過 ${results.filter((row) => row.status === '通過').length}；不符 ${results.filter((row) => row.status === '不符').length}；執行失敗 ${results.filter((row) => row.status === '執行失敗').length}。\n`);
    return results.some((row) => ['不符', '執行失敗'].includes(row.status)) ? 1 : 0;
  } catch (error) { io.stderr.write(`程式實測失敗：${error.message}\n`); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
