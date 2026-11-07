/** 驗證人工判定的同題資料，並以題幹字組找出尚待判定的配對。 */
export interface QuestionDuplicates {
  groups: { ids: string[]; note: string }[];
  distinct: { ids: [string, string]; reason: string }[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pairKey(ids: readonly string[]): string {
  return JSON.stringify([...ids].sort());
}

/** 格式不符就丟錯，避免無效群組使抽題排除失效。 */
export function parseQuestionDuplicates(value: unknown): QuestionDuplicates {
  if (!record(value) || value.version !== 1) throw new Error('同題資料 version 必須是 1');
  if (!Array.isArray(value.groups) || !Array.isArray(value.distinct)) {
    throw new Error('同題資料 groups 與 distinct 必須是陣列');
  }
  const usedIds = new Set<string>();
  const groups = value.groups.map((group: unknown, index: number) => {
    if (!record(group) || !Array.isArray(group.ids) || group.ids.length < 2 || !group.ids.every(nonempty)) {
      throw new Error(`groups[${index}] 至少需要 2 個非空白 ID`);
    }
    if (!nonempty(group.note)) throw new Error(`groups[${index}] 缺少 note`);
    const ids: string[] = group.ids;
    for (const id of ids) {
      if (usedIds.has(id)) throw new Error(`同題群組 ID 重複：${id}`);
      usedIds.add(id);
    }
    return { ids: [...ids], note: group.note };
  });
  const distinct = value.distinct.map((pair: unknown, index: number) => {
    if (!record(pair) || !Array.isArray(pair.ids) || pair.ids.length !== 2 || !pair.ids.every(nonempty)
      || pair.ids[0] === pair.ids[1]) {
      throw new Error(`distinct[${index}] 需要 2 個不同的非空白 ID`);
    }
    if (!nonempty(pair.reason)) throw new Error(`distinct[${index}] 缺少 reason`);
    const ids: [string, string] = [pair.ids[0], pair.ids[1]];
    return { ids, reason: pair.reason };
  });
  return { groups, distinct };
}

/** 去掉空白、Unicode 分隔字元、標點與符號，再轉成小寫。 */
export function normalizeStem(stem: string): string {
  return stem.replace(/[\s\p{Z}\p{P}\p{S}]/gu, '').toLowerCase();
}

/** 相鄰 2 個 code point 組成字組，同題內重複的字組只保留 1 次。 */
export function stemBigrams(stem: string): Set<string> {
  const points = Array.from(normalizeStem(stem));
  const bigrams = new Set<string>();
  for (let index = 0; index + 1 < points.length; index += 1) {
    bigrams.add(points[index] + points[index + 1]);
  }
  return bigrams;
}

function similarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let intersection = 0;
  for (const bigram of a) if (b.has(bigram)) intersection += 1;
  const union = a.size + b.size - intersection;
  // 沒有字組時無法判斷同題，避免把空題幹都視為同題。
  return union === 0 ? 0 : intersection / union;
}

/** 共同字組數除以聯集字組數，不四捨五入。 */
export function stemSimilarity(a: string, b: string): number {
  return similarity(stemBigrams(a), stemBigrams(b));
}

/** 每題只切組 1 次，回傳相似度達 0.75 的不重複配對。 */
export function findSimilarPairs(items: readonly { id: string; stem: string }[]): { ids: [string, string]; score: number }[] {
  const indexed = items.map((item) => ({ id: item.id, bigrams: stemBigrams(item.stem) }));
  const pairs: { ids: [string, string]; score: number }[] = [];
  const seen = new Set<string>();
  for (let left = 0; left < indexed.length; left += 1) {
    for (let right = left + 1; right < indexed.length; right += 1) {
      const a = indexed[left];
      const b = indexed[right];
      if (a.id === b.id) continue;
      const score = similarity(a.bigrams, b.bigrams);
      if (score < 0.75) continue;
      const ids: [string, string] = [a.id, b.id];
      const key = pairKey(ids);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ ids, score });
    }
  }
  return pairs;
}

/** 回傳未列入同一群組、也未列入人工區分清單的配對。 */
export function uncoveredPairs(pairs: readonly { ids: [string, string] }[], data: QuestionDuplicates): { ids: [string, string] }[] {
  const groupById = new Map<string, number>();
  data.groups.forEach((group, index) => group.ids.forEach((id) => groupById.set(id, index)));
  const distinct = new Set(data.distinct.map((pair) => pairKey(pair.ids)));
  return pairs.filter(({ ids }) => {
    const group = groupById.get(ids[0]);
    return !(group !== undefined && group === groupById.get(ids[1])) && !distinct.has(pairKey(ids));
  }).map(({ ids }) => ({ ids: [...ids] }));
}
