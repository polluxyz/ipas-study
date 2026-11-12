/** 指引題組只開放已確認作答的題與第 1 個未答題；位置一律用從 0 開始的索引。 */
export interface GuideTimer {
  elapsed: number;
  questionMs: Readonly<Record<string, number>>;
  active: { qid: string; started: number } | null;
}

/** 結算可見片段時，同步累加題組與單題用時，避免保存後重整改變累計。 */
export function settleGuideTimer(timer: GuideTimer, now: number): GuideTimer {
  if (timer.active === null) return timer;
  const { qid, started } = timer.active;
  const ms = Math.max(0, Math.round(now - started));
  return {
    elapsed: timer.elapsed + ms,
    questionMs: { ...timer.questionMs, [qid]: (timer.questionMs[qid] ?? 0) + ms },
    active: null,
  };
}

export function guideNumbers(confirmed: readonly boolean[]): number[] {
  const firstUnanswered = confirmed.indexOf(false);
  return confirmed.flatMap((answered, position) => answered || position === firstUnanswered ? [position] : []);
}

/** 未確認時停在原題；確認後前往下一個已開放的題號。 */
export function guideNext(confirmed: readonly boolean[], position: number): number {
  if (!confirmed[position]) return position;
  return guideNumbers(confirmed).find((target) => target > position) ?? position;
}

/** 網址使用從 1 開始的題號；不合法或未開放的位置回到第 1 個未答題。 */
export function guidePosition(confirmed: readonly boolean[], requested: string | null): number {
  const firstUnanswered = confirmed.indexOf(false);
  const fallback = firstUnanswered < 0 ? 0 : firstUnanswered;
  if (requested === null || !/^\d+$/.test(requested)) return fallback;
  const position = Number(requested) - 1;
  return Number.isSafeInteger(position) && guideNumbers(confirmed).includes(position) ? position : fallback;
}
