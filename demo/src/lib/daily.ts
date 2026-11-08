/** 每日題組只使用未做的已驗證非官方題；代碼權重仍由完整考古題計算。 */
import type { Attempt, DailySet } from './attempts';

export interface DailyQuestion {
  id: string; rev: number; subject: number; source: string; codes: string[];
  type: string; review: { status: string };
}
export type DailySubject = 1 | 3;
export type DuplicateGroups = readonly (readonly string[])[];
export interface DailyExclusions {
  /** 全部題本的分配題號聯集，包含他科、未交卷與已結束題本。 */
  assignedQids: Iterable<string>;
  /** 同題群組的成員可以跨科。 */
  groups: DuplicateGroups;
}
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
    if (q.source !== 'mock' || q.subject !== subject || q.review.status !== 'verified' || done.has(q.id) || ids.has(q.id) || !q.codes[0]) return false;
    ids.add(q.id); return true;
  });
}

/** 作答與分配都按題號排除；群組成員不受科目、版本或目前題庫限制。 */
export function eligibleDailyQuestions<T extends DailyQuestion>(questions: readonly T[], attempts: readonly Attempt[], subject: DailySubject, exclusions: DailyExclusions): T[] {
  const occupied = new Set([...attempts.map((a) => a.qid), ...exclusions.assignedQids]);
  const blocked = new Set(occupied);
  for (const group of exclusions.groups) {
    if (group.some((id) => occupied.has(id))) for (const id of group) blocked.add(id);
  }
  return unseenDailyQuestions(questions, attempts, subject).filter((q) => !blocked.has(q.id));
}

/** 未列入群組的題自成一組，保留候選的出現順序供舊抽題流程使用。 */
function groupDailyQuestions<T extends DailyQuestion>(questions: readonly T[], groups: DuplicateGroups): T[][] {
  const membership = new Map(groups.flatMap((group) => group.map((id) => [id, group] as const)));
  const buckets = new Map<string | readonly string[], T[]>();
  for (const q of questions) {
    const key = membership.get(q.id) ?? q.id;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(q);
    else buckets.set(key, [q]);
  }
  return [...buckets.values()];
}

/** 可抽群組數就是 F；完整本數與最後一本題數都由 F 換算。 */
export function dailyFreeCount(questions: readonly DailyQuestion[], attempts: readonly Attempt[], subject: DailySubject, exclusions: DailyExclusions): { free: number; fullBooks: number; lastBook: number } {
  const free = groupDailyQuestions(eligibleDailyQuestions(questions, attempts, subject, exclusions), exclusions.groups).length;
  return { free, fullBooks: Math.floor(free / 50), lastBook: free % 50 };
}

export function selectDailyQuestions<T extends DailyQuestion>(questions: readonly T[], attempts: readonly Attempt[], subject: DailySubject, date: string, random: () => number, exclusions?: DailyExclusions) {
  // 先選每組代表題再計算容量，避免跨代碼的同題重複佔用名額。
  // 單題群組不消耗亂數，空群組參數因此保持原有抽題結果。
  const pool = exclusions
    ? groupDailyQuestions(eligibleDailyQuestions(questions, attempts, subject, exclusions), exclusions.groups).map((group) =>
      group.length === 1 ? group[0] : group[Math.min(group.length - 1, Math.max(0, Math.floor(random() * group.length)))])
    : unseenDailyQuestions(questions, attempts, subject);
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
  const selected: T[] = [];
  while (selected.length < size) {
    const candidates = shuffled.filter((q) => allocation[q.codes[0]] > 0 && (subject !== 3 || (special(q) ? specialQuota[q.codes[0]] > 0 : allocation[q.codes[0]] - specialQuota[q.codes[0]] > 0)));
    const q = candidates[0];
    if (!q) break;
    selected.push(q); shuffled.splice(shuffled.indexOf(q), 1); allocation[q.codes[0]]--;
    if (subject === 3 && special(q)) specialQuota[q.codes[0]]--;
  }
  // 最後洗順序，避免代碼配額影響閱讀順序。
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
    if (!q || q.source !== 'mock' || q.review.status !== 'verified' || q.subject !== set.subject || q.rev !== item.rev) skipped.push(item.id);
    else selected.push(q);
  }
  return { selected, skipped, shortage: 50 - selected.length };
}

/** 只替換舊快取的官方題；原有非官方題位置不變，候選不足就移除。 */
export function migrateDailySet(set: DailySet, catalog: readonly DailyQuestion[], attempts: readonly Attempt[], random: () => number) {
  const byId = new Map(catalog.map((q) => [q.id, q]));
  const occupied = new Set(set.questions.map((q) => q.id));
  const pool = unseenDailyQuestions(catalog, attempts, set.subject).filter((q) => !occupied.has(q.id));
  const weights = dailyWeights(catalog, set.subject);
  let replaced = 0;
  let removed = 0;
  const questions = set.questions.flatMap((item) => {
    const old = byId.get(item.id);
    if (!old || old.source === 'mock') return [item];
    replaced++;
    // 先維持主代碼；科目 3 在該代碼內優先保持程式或圖表題。
    let candidates = pool.filter((q) => q.codes[0] === old.codes[0]);
    if (!candidates.length) {
      const code = [...new Set(pool.map((q) => q.codes[0]))].sort((a, b) => weights[b] - weights[a] || a.localeCompare(b))[0];
      candidates = pool.filter((q) => q.codes[0] === code);
    }
    if (set.subject === 3 && special(old) && candidates.some(special)) candidates = candidates.filter(special);
    const replacement = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
    if (!replacement) { removed++; return []; }
    pool.splice(pool.indexOf(replacement), 1);
    return [{ id: replacement.id, rev: replacement.rev }];
  });
  return { set: replaced ? { ...set, questions } : set, replaced, removed };
}
