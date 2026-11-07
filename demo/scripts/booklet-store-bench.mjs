/** 用完整交卷資料量測整包保存成本；固定資料讓每次實測可以互相比較。 */
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 不讀時間或隨機來源，讓單元測試也能建立相同且互不共用的資料。 */
export function buildBenchStore() {
  const ts = '2026-11-07T04:00:00.000Z';
  const booklets = Array.from({ length: 21 }, (_, index) => {
    const subject = index < 11 ? 1 : 3;
    const number = subject === 1 ? index + 1 : index - 10;
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const attemptMode = `booklet:${id}:S${subject}`;
    const questions = Array.from({ length: 50 }, (_, questionIndex) => ({
      id: `Z-${subject === 1 ? 'L21203' : 'L23303'}-${String((number - 1) * 50 + questionIndex + 1).padStart(3, '0')}`,
      rev: 1,
      choice: ['A', 'B', 'C', 'D'][questionIndex % 4],
      unsure: questionIndex % 5 === 0,
      ms: 120000 + questionIndex,
      correct: questionIndex % 5 !== 0,
    }));
    return {
      id, seq: 51, subject, number, createdDate: '2026-11-07', attemptMode,
      origin: 'new', status: 'submitted', position: 49,
      assignedQids: questions.map((question) => question.id),
      questions,
      submission: {
        ts, total: 50, correct: questions.filter((question) => question.correct).length,
        attempts: questions.map((question, questionIndex) => ({
          id: `11111111-0000-4000-8000-${String(index * 50 + questionIndex + 1).padStart(12, '0')}`,
          qid: question.id, rev: question.rev, choice: question.choice,
          correct: question.correct, ts, mode: attemptMode, ms: question.ms,
        })),
      },
    };
  });
  return { version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets };
}

/** 空白本機頁面提供可用的儲存來源，不需要建置網站或讀取既有瀏覽器資料。 */
async function runBench() {
  const { chromium } = await import('playwright');
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>題本保存實測</title></head><body></body></html>');
  });
  let browser;
  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolveListen);
    });
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate((store) => {
      const samples = [];
      let chars = 0;
      for (let save = 0; save < 50; save++) {
        // 同步交卷快照中的同一題，避免為了改動內容而破壞資料的一致性。
        store.booklets[0].questions[0].ms++;
        store.booklets[0].submission.attempts[0].ms++;
        const start = performance.now();
        const serialized = JSON.stringify(store);
        localStorage.setItem('ipas-daily-draft-v2', serialized);
        samples.push(performance.now() - start);
        chars = serialized.length;
      }
      samples.sort((a, b) => a - b);
      // 用最接近的上順位計算百分位，50 次中的第 48 筆就是第 95 百分位。
      return { chars, saves: samples.length, p50: samples[24], p95: samples[47], max: samples[49] };
    }, buildBenchStore());
    const pass = result.chars <= 1000000 && result.p95 <= 50;
    console.log(JSON.stringify({ ...result, chromeVersion: browser.version(), pass }));
    if (!pass) process.exitCode = 1;
  } finally {
    try {
      await browser?.close();
    } finally {
      if (server.listening) await new Promise((resolveClose, reject) => {
        server.close((error) => error ? reject(error) : resolveClose());
      });
    }
  }
}

// 匯入模組只提供測試資料；只有直接執行時才啟動伺服器與瀏覽器。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runBench().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
