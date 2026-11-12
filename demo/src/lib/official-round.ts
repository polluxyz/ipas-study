/** 考古題輪次只計算畫面資料；失效題不改已固定的交卷內容與成績。 */
import type { Attempt, Choice } from './attempts';
import { taipeiDate, type DailyQuestion, type DailySubject } from './daily';
import { officialMode, officialProgress, type OfficialQuestion } from './official';

export interface OfficialRoundQuestionSource {
  id: string; rev: number; choice: Choice | null; unsure: boolean; ms: number; correct?: boolean;
}

/** 結構型別可直接接受儲存層的輪次，不依賴儲存層新增型別的時序。 */
export interface OfficialRoundSource {
  id: string; seq: number; setId: string; subject: DailySubject; number: number;
  createdAt: string; attemptMode: string; status: 'open' | 'submitting' | 'submitted';
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
  | { kind: 'resume'; roundId: string; number: number; label: string }
  | { kind: 'start'; number: number; label: string };
export interface OfficialRoundRow {
  id: string; number: number; label: string; submittedDate: string; score: OfficialRoundScore;
}
export interface OfficialRoundList {
  action: OfficialRoundAction; rows: OfficialRoundRow[];
}
export interface OfficialRoundCard extends OfficialRoundList {
  progressText: string | null; submittedCount: number; latestScore: OfficialRoundScore | null;
  historyText: string | null; legacyText: string | null;
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

/** 已交卷清單只讀輪次；舊作答紀錄不會產生虛構的歷史輪次。 */
export function officialRoundList(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundList {
  const current = unfinishedRound(setId, rounds);
  const next = rounds.reduce((max, round) => round.setId === setId ? Math.max(max, round.number) : max, 0) + 1;
  const action: OfficialRoundAction = current
    ? { kind: 'resume', roundId: current.id, number: current.number, label: `繼續第 ${current.number} 輪 →` }
    : { kind: 'start', number: next, label: `開始第 ${next} 輪` };
  const rows = rounds.filter((round) => round.setId === setId && round.status === 'submitted' && round.submission)
    .sort((a, b) => b.number - a.number)
    .map((round) => ({ id: round.id, number: round.number, label: `第 ${round.number} 輪`,
      submittedDate: taipeiDate(new Date(round.submission!.ts)), score: officialRoundScore(round.submission!) }));
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
  const progressText = resolved ? `第 ${resolved.number} 輪・已答 ${resolved.questions.filter((q) => q.choice !== null).length}／${resolved.questions.length}` : null;
  const latestScore = list.rows[0]?.score ?? null;
  return { ...list, progressText, submittedCount: list.rows.length, latestScore,
    historyText: latestScore ? `已交卷 ${list.rows.length} 輪・最近 ${latestScore.summary}` : null,
    legacyText: officialLegacyText(set, attempts) };
}

export function officialRoundReviewAction(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundAction {
  const action = officialRoundList(setId, rounds).action;
  return action.kind === 'resume' ? action : { ...action, label: '再考一次' };
}
