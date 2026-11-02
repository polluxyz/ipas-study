/** 呈現前整併連續的同來源補充，保留指引邊界與內容順序，避免編寫時的拆段變成重複標示。 */
export type ReadingBlock<T> =
  | { kind: 'guide'; parts: readonly T[] }
  | { kind: 'supplement'; sources: readonly string[]; parts: readonly T[] };

export function mergeSupplementBlocks<T>(blocks: readonly ReadingBlock<T>[]): ReadingBlock<T>[] {
  const merged: ReadingBlock<T>[] = [];
  for (const block of blocks) {
    const previous = merged.at(-1);
    const sources = block.kind === 'supplement' ? [...new Set(block.sources)] : [];
    // 多來源的列出順序不影響同一性；輸出仍沿用第一塊的來源順序。
    const sameSources = previous?.kind === 'supplement'
      && sources.length > 0
      && sources.length === previous.sources.length
      && sources.every((source) => previous.sources.includes(source));
    if (block.kind === 'supplement' && previous?.kind === 'supplement' && sameSources) {
      merged[merged.length - 1] = { ...previous, parts: [...previous.parts, ...block.parts] };
    } else {
      merged.push(block.kind === 'supplement'
        ? { ...block, sources, parts: [...block.parts] }
        : { ...block, parts: [...block.parts] });
    }
  }
  return merged;
}
