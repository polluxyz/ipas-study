/** 將既有概念整理成兩層連線；正文只補足尚無類型關係的概念配對，不改動教材。 */
export const relationTypes = ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'] as const;
export type RelationType = typeof relationTypes[number];
export const relationLabels: Record<RelationType, string> = {
  is_a: '是一種', part_of: '組成元件', requires: '建議先懂', mitigates: '用來處理', contrasts: '易混淆',
};
export const relationColors: Record<RelationType, string> = {
  is_a: '#3973aa', part_of: '#8a6ca8', requires: '#748553', mitigates: '#c0783e', contrasts: '#b15c78',
};
export const stageColors = ['#3f7f76', '#a47443', '#7d76ab', '#507eac', '#a46d82', '#6f854d'];
interface AnnotatedRelation { target: string; note?: string; source: string[]; }
export interface MapConcept {
  data: { id: string; title: string; aliases: string[]; kind: string;
    is_a: string[]; part_of: string[]; requires: string[];
    mitigates: AnnotatedRelation[]; contrasts: AnnotatedRelation[]; };
  body?: string;
}
export interface MapStage { id: string; title: string; concepts: { id: string; goal: string }[]; }
export interface MapNode { id: string; title: string; stage: string; goal: string; color: string; x: number; y: number; }
export interface MapEdge { id: string; source: string; target: string; type: RelationType | 'body'; note?: string; sources: string[]; }
export interface ConceptMapData { nodes: MapNode[]; edges: MapEdge[]; stages: { id: string; title: string; color: string }[]; questionIds?: string[]; }
export function buildConceptMap(concepts: MapConcept[], stages: MapStage[]): ConceptMapData {
  const byId = new Map(concepts.map((concept) => [concept.data.id, concept]));
  const nodes: MapNode[] = stages.flatMap((stage, stageIndex) => stage.concepts.flatMap((item, index) => {
    const concept = byId.get(item.id);
    return concept ? [{ id: item.id, title: concept.data.title, stage: stage.id, goal: item.goal,
      color: stageColors[stageIndex % stageColors.length],
      x: (stageIndex % 3) * 370 + (index % 2) * 172,
      y: Math.floor(stageIndex / 3) * 345 + Math.floor(index / 2) * 70 }] : [];
  }));
  const included = new Set(nodes.map((node) => node.id));
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  const edges: MapEdge[] = [];
  const typedPairs = new Set<string>();
  for (const { data } of concepts) {
    if (!included.has(data.id)) continue;
    for (const type of relationTypes) for (const relation of data[type]) {
      const target = typeof relation === 'string' ? relation : relation.target;
      if (!included.has(target)) continue;
      edges.push({ id: `${type}:${data.id}:${target}`, source: data.id, target, type,
        note: typeof relation === 'string' ? undefined : relation.note,
        sources: typeof relation === 'string' ? [] : relation.source });
      typedPairs.add(pair(data.id, target));
    }
  }
  const aliases = new Map<string, Set<string>>();
  for (const { data } of concepts) for (const label of [data.id, data.title, ...data.aliases]) {
    const matches = aliases.get(label) ?? new Set<string>(); matches.add(data.id); aliases.set(label, matches);
  }
  const bodyPairs = new Set<string>();
  for (const concept of concepts) {
    if (!included.has(concept.data.id)) continue;
    // 程式碼區塊與行內程式碼不會被正文連結解析器轉成連結，也不應成為地圖連線。
    const body = (concept.body ?? '').replace(/```[\s\S]*?```|`[^`\n]*`/g, '');
    for (const match of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const matches = aliases.get(match[1]);
      if (matches?.size !== 1) continue;
      const target = [...matches][0]; const source = concept.data.id;
      const key = pair(source, target);
      if (source === target || !included.has(target) || typedPairs.has(key) || bodyPairs.has(key)) continue;
      bodyPairs.add(key);
      edges.push({ id: `body:${key}`, source, target, type: 'body', sources: [] });
    }
  }
  return { nodes, edges, stages: stages.map((stage, index) => ({ id: stage.id, title: stage.title, color: stageColors[index % stageColors.length] })) };
}
