/** 教材只保留指引頁碼，考題集中到頁尾；反向關係也需保留原始引用，避免漏掉依據。 */
interface SourceRelation { target: string; source: readonly string[]; }
interface ConceptRelations { id: string; mitigates: readonly SourceRelation[]; contrasts: readonly SourceRelation[]; }

export function splitSources(sources: readonly string[]): { guideSources: string[]; questionIds: string[] } {
  return {
    guideSources: [...new Set(sources.filter((source) => source.startsWith('guide-')))],
    questionIds: [...new Set(sources.filter((source) => /^\d{3}-\d-S[13]-Q\d{2}$/.test(source)))],
  };
}

export function relatedPastQuestionIds(
  conceptId: string,
  concepts: readonly ConceptRelations[],
  relatedQuestionIds: readonly string[] = [],
  additionalSources: readonly string[] = [],
): string[] {
  const sources = concepts.flatMap((concept) => [...concept.mitigates, ...concept.contrasts]
    .filter((relation) => concept.id === conceptId || relation.target === conceptId)
    .flatMap((relation) => relation.source));
  return [...new Set([...relatedQuestionIds, ...splitSources([...sources, ...additionalSources]).questionIds])];
}
