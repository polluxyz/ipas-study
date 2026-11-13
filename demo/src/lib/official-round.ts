/** 考古題輪次只計算畫面資料；失效題不改已固定的交卷內容與成績。 */
import type { Attempt, Choice } from './attempts';
import type { DailyQuestion, DailySubject } from './daily';
import { officialMode, officialProgress, type OfficialQuestion } from './official';

export interface OfficialRoundQuestionSource {
  id: string; rev: number; choice: Choice | null; unsure: boolean; ms: number; correct?: boolean;
}

/** 結構型別可直接接受儲存層的輪次，不依賴儲存層新增型別的時序。 */
export interface OfficialRoundSource {
  id: string; seq: number; setId: string; subject: DailySubject; number: number;
  createdAt: string; attemptMode: string; status: 'open' | 'submitting' | 'submitted' | 'retired';
  position: number; questions: readonly OfficialRoundQuestionSource[];
  submission?: { total: number; correct: number; ts: string };
}
export type OfficialRoundCatalogQuestion = OfficialQuestion & Pick<DailyQuestion, 'rev' | 'review'>;
export interface OfficialRoundSetSource {
  id: string; session: string; subject: DailySubject; questions: readonly OfficialRoundCatalogQuestion[];
}
export interface OfficialRoundScore {
  total: number; correct: number; points: number | null;
  answerText: string; scoreText: string | null; summary: string;
}
export type OfficialRoundAction =
  | { kind: 'resume'; roundId: string; label: '繼續作答 →' }
  | { kind: 'start'; label: '開始作答' | '重新開始' };
export interface OfficialRoundRow {
  id: string; status: 'submitted' | 'retired'; createdAt: string; startedText: string;
  ariaLabel: string; statusText: '已交卷' | '未交卷'; resultText: string; score: OfficialRoundScore | null;
}
export interface OfficialRoundList {
  action: OfficialRoundAction; rows: OfficialRoundRow[];
}
export interface OfficialRoundCard extends OfficialRoundList {
  progressText: string | null; submittedCount: number; latestScore: OfficialRoundScore | null;
  latestSubmittedId: string | null; historyText: string | null; legacyText: string | null;
}

export function officialRoundMode(id: string, subject: DailySubject): string {
  return `official-round:${id}:S${subject}`;
}

/** 同時核對題目來源與 ID，避免錯置的題庫資料混進另一份考卷。 */
export function availableOfficialQuestion(q: { id: string; rev: number }, catalog: readonly OfficialRoundCatalogQuestion[], round: Pick<OfficialRoundSource, 'setId' | 'subject'>): boolean {
  const set = round.setId.match(/^(114-2|115-1)-S([13])$/);
  if (!set || Number(set[2]) !== round.subject || !q.id.startsWith(round.setId) || !/^-Q\d+$/.test(q.id.slice(round.setId.length))) return false;
  return catalog.some((item) => item.id === q.id && item.rev === q.rev && item.subject === round.subject &&
    item.source === 'exam' && item.session === set[1] && ['verified', 'disputed'].includes(item.review.status));
}

/** 目前題仍有效時保持該題；失效時向後找，末題失效才退回最後一題。 */
export function reconcileOfficialRound<T extends OfficialRoundSource>(round: T, catalog: readonly OfficialRoundCatalogQuestion[]): { round: T; skipped: number; unavailable: string[] } {
  const kept = round.questions.map((q, index) => ({ q, index })).filter(({ q }) => availableOfficialQuestion(q, catalog, round));
  const available = new Set(kept.map(({ q }) => q.id));
  const unavailable = round.questions.filter((q) => !available.has(q.id)).map((q) => q.id);
  if (round.status !== 'open') return { round, skipped: 0, unavailable };
  if (!unavailable.length) return { round, skipped: 0, unavailable: [] };
  const next = kept.findIndex(({ index }) => index >= round.position);
  return {
    round: { ...round, questions: kept.map(({ q }) => q), position: next < 0 ? Math.max(0, kept.length - 1) : next },
    skipped: unavailable.length, unavailable: [],
  };
}

export function canSubmitOfficialRound(round: Pick<OfficialRoundSource, 'status' | 'questions'>): boolean {
  return round.status === 'open' && round.questions.length > 0 && round.questions.every((q) => q.choice !== null);
}

/** 題庫缺題時仍從 ID 取原題號，不用略過後的陣列位置編號。 */
export function officialQuestionNumber(id: string, catalog: readonly OfficialQuestion[]): number | null {
  return catalog.find((q) => q.id === id)?.number ?? (/-Q(\d+)$/.test(id) ? Number(id.match(/-Q(\d+)$/)![1]) : null);
}

/** 不完整考卷只顯示題數，不把剩餘題目換算成 100 分。 */
export function officialRoundScore(submission: { total: number; correct: number }): OfficialRoundScore {
  const { total, correct } = submission;
  const complete = total === 50;
  const points = complete ? correct * 2 : null;
  const answerText = `答對 ${correct}／${total} 題${complete ? '' : '・不是正式考試換算'}`;
  return { total, correct, points, answerText, scoreText: complete ? `${points} 分／100 分` : null,
    summary: complete ? `${points} 分` : answerText };
}

function unfinishedRound(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundSource | undefined {
  return rounds.find((round) => round.setId === setId && (round.status === 'open' || round.status === 'submitting'));
}

/** 用固定時區與完整秒數，避免不同瀏覽器語系改變時間格式。 */
function startedTime(createdAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23' }).formatToParts(new Date(createdAt));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}

function answeredText(round: Pick<OfficialRoundSource, 'questions'>): string {
  return `已答 ${round.questions.filter((q) => q.choice !== null).length}／${round.questions.length}`;
}

/** 歷史包含已交卷與未交卷紀錄；同秒的紀錄依內部編號辨識。 */
export function officialRoundList(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundList {
  const current = unfinishedRound(setId, rounds);
  const history = rounds.filter((round) => round.setId === setId &&
    ((round.status === 'submitted' && round.submission) || round.status === 'retired'))
    .sort((a, b) => b.number - a.number);
  const action: OfficialRoundAction = current
    ? { kind: 'resume', roundId: current.id, label: '繼續作答 →' }
    : { kind: 'start', label: rounds.some((round) => round.setId === setId &&
      (round.status === 'submitted' || round.status === 'retired')) ? '重新開始' : '開始作答' };
  const times = new Map(history.map((round) => [round.id, startedTime(round.createdAt)]));
  const counts = new Map<string, number>();
  for (const time of times.values()) counts.set(time, (counts.get(time) ?? 0) + 1);
  const ranks = new Map<string, number>();
  const startedTexts = new Map<string, string>();
  for (const round of [...history].reverse()) {
    const time = times.get(round.id)!;
    const rank = (ranks.get(time) ?? 0) + 1;
    ranks.set(time, rank);
    startedTexts.set(round.id, counts.get(time)! > 1 ? `${time}・同時間第 ${rank} 筆` : time);
  }
  const rows = history.map((round): OfficialRoundRow => {
    const status = round.status === 'submitted' ? 'submitted' : 'retired';
    const score = status === 'submitted' ? officialRoundScore(round.submission!) : null;
    const statusText = status === 'submitted' ? '已交卷' : '未交卷';
    const resultText = score ? score.summary : answeredText(round);
    const startedText = startedTexts.get(round.id)!;
    return { id: round.id, status, createdAt: round.createdAt, startedText, statusText, resultText, score,
      ariaLabel: `查看 ${startedText} ${statusText} ${resultText}` };
  });
  return { action, rows };
}

export function officialLegacyText(set: OfficialRoundSetSource, attempts: readonly Attempt[]): string | null {
  const progress = officialProgress(set.questions, attempts, officialMode(set.session, set.subject));
  return progress.done ? `舊紀錄（即時解析）：已答 ${progress.done}／${progress.total}・答對 ${progress.correct}` : null;
}

/** 目錄不恢復交卷或寫入；作答中的有效題數只在回傳資料中調整。 */
export function officialRoundCard(set: OfficialRoundSetSource, rounds: readonly OfficialRoundSource[], attempts: readonly Attempt[]): OfficialRoundCard {
  const list = officialRoundList(set.id, rounds);
  const current = unfinishedRound(set.id, rounds);
  const resolved = current ? reconcileOfficialRound(current, set.questions).round : undefined;
  const progressText = resolved ? `作答中・${answeredText(resolved)}` : null;
  const submitted = list.rows.filter((row) => row.status === 'submitted');
  const latestScore = submitted[0]?.score ?? null;
  return { ...list, progressText, submittedCount: submitted.length, latestScore,
    latestSubmittedId: submitted[0]?.id ?? null,
    historyText: latestScore ? `已交卷 ${submitted.length} 次・最近 ${latestScore.summary}` : null,
    legacyText: officialLegacyText(set, attempts) };
}

export function officialRoundReviewAction(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundAction {
  const action = officialRoundList(setId, rounds).action;
  return action.kind === 'resume' ? action : { kind: 'start', label: '重新開始' };
}

/** 未交卷紀錄保留原題數與已答數，不因題庫更新計分或刪題。 */
export function officialRetiredSummary(round: OfficialRoundSource): string {
  return `未交卷・${answeredText(round)}・不計分`;
}
