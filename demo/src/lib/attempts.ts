/** 作答與閱讀紀錄集中經此介面進出；備份合併閱讀狀態，舊版作答備份仍可匯入。 */
import revisionIndex from '../data/revisions.json';
export type Choice = 'A' | 'B' | 'C' | 'D';
export interface Attempt { id: string; qid: string; rev: number; choice: Choice; correct: boolean; ts: string; mode: string; ms: number; }
const STORAGE_KEY = 'ipas-attempts-v1';
const READING_KEY = 'ipas-reading-v1';
export interface Reading { conceptId: string; ts: string; }
const revisions: Record<string, number> = revisionIndex;
function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return typeof a.id === 'string' && a.id.length > 0 && typeof a.qid === 'string' && a.qid.length > 0 &&
    Number.isInteger(a.rev) && (a.rev as number) >= 1 && ['A', 'B', 'C', 'D'].includes(String(a.choice)) &&
    typeof a.correct === 'boolean' && typeof a.ts === 'string' && Number.isFinite(Date.parse(a.ts)) &&
    typeof a.mode === 'string' && a.mode.length > 0 && typeof a.ms === 'number' && Number.isFinite(a.ms) && a.ms >= 0;
}
function read(): Attempt[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('attempts' in data) || !Array.isArray(data.attempts)) throw new Error('作答紀錄格式無法辨識，目前無法匯出備份。');
  return data.attempts.filter(isAttempt);
}
function write(attempts: Attempt[]): void { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, attempts })); }
export function saveAttempt(a: Omit<Attempt, 'id'>): Attempt {
  const attempt = { ...a, id: crypto.randomUUID() };
  if (!isAttempt(attempt)) throw new Error('作答紀錄欄位不完整。');
  write([...read(), attempt]); return attempt;
}
export function getAttempts(filter?: { qid?: string }): Attempt[] { return read().filter((a) => !filter?.qid || a.qid === filter.qid); }
export function getWrongBook(): { qid: string; lastAttempt: Attempt; outdated: boolean }[] {
  const grouped = new Map<string, Attempt[]>();
  for (const a of read()) grouped.set(a.qid, [...(grouped.get(a.qid) ?? []), a]);
  const result: { qid: string; lastAttempt: Attempt; outdated: boolean }[] = [];
  for (const [qid, attempts] of grouped) {
    const current = attempts.filter((a) => a.rev === revisions[qid]);
    const outdated = current.length === 0;
    const latest = (outdated ? attempts : current).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0];
    if (outdated || !latest.correct) result.push({ qid, lastAttempt: latest, outdated });
  }
  return result.sort((a, b) => Date.parse(b.lastAttempt.ts) - Date.parse(a.lastAttempt.ts));
}
function isReading(value: unknown): value is Reading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Record<string, unknown>;
  return typeof reading.conceptId === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reading.conceptId) && typeof reading.ts === 'string' && Number.isFinite(Date.parse(reading.ts));
}
export function getReadings(): Reading[] {
  const raw = localStorage.getItem(READING_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('readings' in data) || !Array.isArray(data.readings)) throw new Error('閱讀紀錄格式無法辨識。');
  return data.readings.filter(isReading);
}
function writeReadings(readings: Reading[]): void { localStorage.setItem(READING_KEY, JSON.stringify({ version: 1, readings })); }
export function setConceptRead(conceptId: string, isRead: boolean): void {
  const reading = { conceptId, ts: new Date().toISOString() };
  if (!isReading(reading)) throw new Error('概念 ID 格式不正確。');
  const readings = getReadings().filter((item) => item.conceptId !== conceptId);
  if (isRead) readings.push(reading);
  writeReadings(readings);
}
export function exportAttempts(): string { return JSON.stringify({ version: 1, attempts: read(), readings: getReadings() }, null, 2); }
export function importAttempts(json: string): { added: number; skipped: number; invalid: number } {
  const result = { added: 0, skipped: 0, invalid: 0 };
  let data: unknown;
  try { data = JSON.parse(json); } catch { return { ...result, invalid: 1 }; }
  if (!data || typeof data !== 'object' || !('attempts' in data) || !Array.isArray(data.attempts)) return { ...result, invalid: 1 };
  if (!('version' in data) || data.version !== 1) return { ...result, invalid: Math.max(1, data.attempts.length) };
  const attempts = read(); const ids = new Set(attempts.map((a) => a.id));
  for (const value of data.attempts) {
    if (!isAttempt(value)) { result.invalid++; continue; }
    if (ids.has(value.id)) { result.skipped++; continue; }
    attempts.push(value); ids.add(value.id); result.added++;
  }
  const readings = getReadings();
  if ('readings' in data) {
    if (!Array.isArray(data.readings)) result.invalid++;
    else for (const value of data.readings) {
      if (!isReading(value)) { result.invalid++; continue; }
      const index = readings.findIndex((item) => item.conceptId === value.conceptId);
      if (index >= 0 && Date.parse(readings[index].ts) >= Date.parse(value.ts)) { result.skipped++; continue; }
      if (index >= 0) readings[index] = value; else readings.push(value);
      result.added++;
    }
  }
  write(attempts); writeReadings(readings); return result;
}

/** 每日題組與作答備份分開保存；每科只保留最近一次建立的題組。 */
const DAILY_KEY = 'ipas-daily-v1';
export interface DailySet { date: string; subject: 1 | 3; questions: { id: string; rev: number }[]; }
function isDailySet(value: unknown): value is DailySet {
  if (!value || typeof value !== 'object') return false;
  const set = value as Record<string, unknown>;
  if (typeof set.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(set.date) || ![1, 3].includes(Number(set.subject)) || typeof set.subject !== 'number' || !Array.isArray(set.questions) || set.questions.length > 50) return false;
  const ids = new Set<string>();
  return set.questions.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const q = item as Record<string, unknown>;
    if (typeof q.id !== 'string' || !q.id || !Number.isInteger(q.rev) || Number(q.rev) < 1 || ids.has(q.id)) return false;
    ids.add(q.id); return true;
  });
}
function readDailySets(): DailySet[] {
  const raw = localStorage.getItem(DAILY_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('sets' in value) || !Array.isArray(value.sets) || !value.sets.every(isDailySet)) throw new Error('每日題組快取格式無法辨識，請保留現有資料並確認瀏覽器儲存狀態。');
  return value.sets;
}
export function getDailySet(date: string, subject: 1 | 3): DailySet | undefined {
  return readDailySets().find((set) => set.date === date && set.subject === subject);
}
/** 已有同日題組時回傳原題組，避免重整或其他分頁覆寫順序。 */
export function saveDailySet(set: DailySet): DailySet {
  if (!isDailySet(set)) throw new Error('每日題組欄位不完整。');
  const sets = readDailySets();
  const existing = sets.find((item) => item.date === set.date && item.subject === set.subject);
  if (existing) return existing;
  localStorage.setItem(DAILY_KEY, JSON.stringify({ version: 1, sets: [...sets.filter((item) => item.subject !== set.subject), set] }));
  return set;
}
/** 清除本機學習資料時一併移除每日題組，避免保留與作答不一致的快取。 */
export function clearStudyData(): void {
  for (const key of [STORAGE_KEY, READING_KEY, DAILY_KEY]) localStorage.removeItem(key);
}
