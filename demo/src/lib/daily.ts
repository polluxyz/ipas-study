/** 每日題組只使用未做的已驗證題；配額、來源與程式題限制均由目前題庫計算。 */
import type { Attempt, DailySet } from './attempts';

export interface DailyQuestion {
  id: string; rev: number; subject: number; source: string; codes: string[];
  type: string; review: { status: string };
}
export type DailySubject = 1 | 3;
export function taipeiDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function dailyMode(date: string, subject: DailySubject): string { return `daily:${date}:S${subject}`; }
const special = (q: DailyQuestion) => q.type === '程式' || q.type === '圖表';

/** 最大餘數法先分整數，再依小數餘額分剩餘名額；代碼排序讓同分結果固定。 */
export function apportion(weights: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(weights).sort();
  const sum = keys.reduce((n, key) => n + weights[key], 0);
  if (!keys.length) return {};
  const raw = keys.map((key) => ({ key, value: total * (sum ? weights[key] / sum : 1 / keys.length) }));
  const result = Object.fromEntries(raw.map(({ key, value }) => [key, Math.floor(value)]));
  const left = total - Object.values(result).reduce((a, b) => a + b, 0);
  raw.sort((a, b) => {
    const difference = (b.value % 1) - (a.value % 1);
    return Math.abs(difference) < 1e-10 ? a.key.localeCompare(b.key) : difference;
  });
  for (const { key } of raw.slice(0, left)) result[key]++;
  return result;
}
export function dailyWeights(questions: readonly DailyQuestion[], subject: DailySubject): Record<string, number> {
  const all = questions.filter((q) => q.subject === subject && q.codes[0]);
  const codes = [...new Set(all.map((q) => q.codes[0]))].sort();
  const exams = all.filter((q) => q.source === 'exam');
  return Object.fromEntries(codes.map((code) => [code, .8 * (exams.length ? exams.filter((q) => q.codes[0] === code).length / exams.length : 1 / codes.length) + .2 / codes.length]));
}
export function unseenDailyQuestions<T extends DailyQuestion>(questions: readonly T[], attempts: readonly Attempt[], subject: DailySubject): T[] {
  const done = new Set(attempts.map((a) => a.qid));
  const ids = new Set<string>();
  return questions.filter((q) => {
    if (q.subject !== subject || q.review.status !== 'verified' || done.has(q.id) || ids.has(q.id) || !q.codes[0]) return false;
    ids.add(q.id); return true;
  });
}

export function selectDailyQuestions<T extends DailyQuestion>(questions: readonly T[], attempts: readonly Attempt[], subject: DailySubject, date: string, random: () => number) {
  const pool = unseenDailyQuestions(questions, attempts, subject);
  const weights = dailyWeights(questions, subject);
  const quotas = apportion(weights, 50);
  const codes = Object.keys(weights);
  const size = Math.min(50, pool.length);
  const capacity = Object.fromEntries(codes.map((code) => [code, pool.filter((q) => q.codes[0] === code).length]));
  const allocation = Object.fromEntries(codes.map((code) => [code, Math.min(quotas[code], capacity[code])]));
  // 容量不足時重新按權重分缺額；小容量代碼耗盡後繼續分，直到無缺額。
  while (Object.values(allocation).reduce((a, b) => a + b, 0) < size) {
    const left = size - Object.values(allocation).reduce((a, b) => a + b, 0);
    const available = Object.fromEntries(codes.filter((code) => allocation[code] < capacity[code]).map((code) => [code, weights[code]]));
    const extra = apportion(available, left);
    for (const code of Object.keys(extra)) allocation[code] += Math.min(extra[code], capacity[code] - allocation[code]);
  }
  const specials = Object.fromEntries(codes.map((code) => [code, pool.filter((q) => q.codes[0] === code && special(q)).length]));
  const normals = Object.fromEntries(codes.map((code) => [code, capacity[code] - specials[code]]));
  const availableSpecial = Object.values(specials).reduce((a, b) => a + b, 0);
  const availableNormal = pool.length - availableSpecial;
  const target = subject === 3 ? Math.max(size - availableNormal, Math.min(12, availableSpecial, size)) : 0;
  // 程式題不足時只移動必要的代碼名額；其餘名額仍沿用代碼配額。
  if (subject === 3) for (const [capacities, required] of [[specials, target], [normals, size - target]] as const) {
    while (codes.reduce((n, code) => n + Math.min(allocation[code], capacities[code]), 0) < required) {
      const receiver = codes.filter((code) => allocation[code] < capacities[code]).sort((a, b) => weights[b] - weights[a])[0];
      const donor = codes.filter((code) => allocation[code] > capacities[code]).sort((a, b) => weights[a] - weights[b])[0];
      if (!receiver || !donor) break;
      allocation[donor]--; allocation[receiver]++;
    }
  }
  const specialQuota = Object.fromEntries(codes.map((code) => [code, subject === 3 ? Math.max(0, allocation[code] - normals[code]) : 0]));
  if (subject === 3) while (Object.values(specialQuota).reduce((a, b) => a + b, 0) < target) {
    const code = codes.filter((key) => specialQuota[key] < Math.min(allocation[key], specials[key])).sort((a, b) => weights[b] / (specialQuota[b] + 1) - weights[a] / (specialQuota[a] + 1))[0];
    if (!code) break;
    specialQuota[code]++;
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sourceTargets: Record<string, number> = { exam: 10, guide: 5, mock: 35 };
  const sourceCounts: Record<string, number> = {};
  const selected: T[] = [];
  while (selected.length < size) {
    const candidates = shuffled.filter((q) => allocation[q.codes[0]] > 0 && (subject !== 3 || (special(q) ? specialQuota[q.codes[0]] > 0 : allocation[q.codes[0]] - specialQuota[q.codes[0]] > 0)));
    candidates.sort((a, b) => ((sourceTargets[b.source] ?? 0) - (sourceCounts[b.source] ?? 0)) - ((sourceTargets[a.source] ?? 0) - (sourceCounts[a.source] ?? 0)));
    const q = candidates[0];
    if (!q) break;
    selected.push(q); shuffled.splice(shuffled.indexOf(q), 1); allocation[q.codes[0]]--;
    if (subject === 3 && special(q)) specialQuota[q.codes[0]]--;
    sourceCounts[q.source] = (sourceCounts[q.source] ?? 0) + 1;
  }
  // 最後再洗順序，避免來源目標造成模擬題都排在前面。
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }
  return { date, subject, selected, shortage: 50 - selected.length, remaining: pool.length, quotas };
}

/** 快取仍使用原順序；失效或改版題目略過，避免拿新版內容冒充當天原題。 */
export function resolveDailySet<T extends DailyQuestion>(set: DailySet, questions: readonly T[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const skipped: string[] = [];
  const selected: T[] = [];
  for (const item of set.questions) {
    const q = byId.get(item.id);
    if (!q || q.review.status !== 'verified' || q.subject !== set.subject || q.rev !== item.rev) skipped.push(item.id);
    else selected.push(q);
  }
  return { selected, skipped, shortage: 50 - selected.length };
}
