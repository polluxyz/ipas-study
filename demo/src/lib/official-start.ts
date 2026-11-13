/** 目錄與全部紀錄共用開新作答，衝突時重新讀取另一頁已建立的紀錄。 */
import { DailyConflictError, openOfficialRound, readOfficialRounds } from './attempts';
import { availableOfficialQuestion, type OfficialRoundCatalogQuestion, type OfficialRoundSource } from './official-round';

function activeRound(setId: string, rounds: readonly OfficialRoundSource[]): OfficialRoundSource | undefined {
  return rounds.find((round) => round.setId === setId && (round.status === 'open' || round.status === 'submitting'));
}

export function startOfficialRound(
  set: { id: string; subject: 1 | 3; questions: readonly OfficialRoundCatalogQuestion[] },
  randomId: () => string, now: () => string,
): { roundId: string; resumed: boolean } {
  const current = activeRound(set.id, readOfficialRounds().rounds);
  if (current) return { roundId: current.id, resumed: true };
  const questions = set.questions.filter((q) => availableOfficialQuestion(q, set.questions, { setId: set.id, subject: set.subject }));
  if (!questions.length) throw new Error('這份考古題目前沒有可作答的題目。');
  const id = randomId();
  const createdAt = now();
  try {
    const round = openOfficialRound(set.id, questions, id, createdAt);
    return { roundId: round.id, resumed: false };
  } catch (error) {
    if (error instanceof DailyConflictError) {
      const existing = activeRound(set.id, readOfficialRounds().rounds);
      if (existing) return { roundId: existing.id, resumed: true };
    }
    throw error;
  }
}
