/** 建置時從當版集合衍生一份圖；來源行號及簽章可回查，正文不進資產。 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getData } from './content';
import { aggregateEdges } from './graph3d-model';
import { TYPES, type BodyEdge, type FormalEdge, type GraphData, type GraphNode, type GraphUnit, type Origin } from './graph3d-types';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function relationLine(lines: string[], start: number, end: number, target: string): number {
  // ID須符合完整純量，避免cnn誤指向較早出現的cnn-architectures。
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`(?:^\\s*-\\s*(?:target:\\s*)?|\\[\\s*|,\\s*)["']?${escaped}["']?(?=\\s*(?:[,\\]#]|$))`);
  const offset = lines.slice(start, end).findIndex((line) => exact.test(line));
  return (offset < 0 ? start : start + offset) + 1;
}
export async function buildGraphData(input: Awaited<ReturnType<typeof getData>>, root: string, head: string): Promise<GraphData> {
  const files = new Map<string, string>(), sources: Origin[] = [];
  const origin = async (path: string): Promise<Origin> => {
    const raw = await readFile(resolve(root, path), 'utf8'); files.set(path, raw);
    const source = { path, line: 1, sha256: hash(raw) }; sources.push(source); return source;
  };
  const exceptionPath = 'docs/acceptance/concept-entry-exceptions.json';
  const exceptionRaw = await readFile(resolve(root, exceptionPath), 'utf8'); files.set(exceptionPath, exceptionRaw);
  const exceptions = new Set((JSON.parse(exceptionRaw) as { entries: { id: string }[] }).entries.map((entry) => entry.id));
  const units: GraphUnit[] = [];
  for (const { data } of [...input.codes].sort((a, b) => a.data.code.localeCompare(b.data.code))) units.push({ id: data.code, title: data.title, subject: data.subject, concepts: data.concepts, stages: data.stages ?? [], source: await origin(`content/codes/${data.code}.md`), ownedCount: 0, memberCount: 0 });
  const unitById = new Map(units.map((unit) => [unit.id, unit])), concepts: GraphNode[] = [], formalEdges: FormalEdge[] = [];
  const sorted = [...input.concepts].sort((a, b) => a.data.id.localeCompare(b.data.id));
  for (const entry of sorted) {
    const d = entry.data, source = await origin(`content/concepts/${d.id}.md`), raw = files.get(source.path)!;
    concepts.push({ id: d.id, title: d.title, aliases: d.aliases, kind: d.kind, codes: d.codes, owner: d.codes[0], summary: d.summary ?? '', subjects: [...new Set(d.codes.map((code) => unitById.get(code)?.subject).filter((subject): subject is number => subject !== undefined))], guideRefs: d.guide_refs, source, typedDegree: 0, exception: false });
    const lines = raw.split('\n');
    for (const type of TYPES) {
      const start = lines.findIndex((line) => new RegExp(`^${type}:`).test(line));
      let end = start + 1; while (end < lines.length && !/^(?:[A-Za-z_][\w-]*:|---)/.test(lines[end])) end++;
      for (const relation of d[type]) {
        const target = typeof relation === 'string' ? relation : relation.target;
        formalEdges.push({ id: `${type}:${d.id}:${target}`, source: d.id, target, type, ...(typeof relation !== 'string' && relation.note !== undefined ? { note: relation.note } : {}), sources: typeof relation === 'string' ? [] : relation.source, origin: { ...source, line: relationLine(lines, start, end, target) }, directed: type !== 'contrasts' });
      }
    }
  }
  const byId = new Map(concepts.map((node) => [node.id, node]));
  for (const edge of formalEdges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) throw new Error(`圖譜未知端點：${edge.id}`);
    byId.get(edge.source)!.typedDegree++; byId.get(edge.target)!.typedDegree++;
  }
  const questionConcepts = new Set(input.questions.flatMap((question) => question.concepts));
  for (const node of concepts) { node.exception = exceptions.has(node.id) && node.typedDegree === 0 && !questionConcepts.has(node.id); if (!unitById.has(node.owner)) throw new Error(`圖譜未知單元：${node.id}`); }
  for (const unit of units) { unit.ownedCount = concepts.filter((node) => node.owner === unit.id).length; unit.memberCount = concepts.filter((node) => node.codes.includes(unit.id)).length; }
  const pair = (a: string, b: string) => [a, b].sort().join('|'), typedPairs = new Set(formalEdges.map((edge) => pair(edge.source, edge.target)));
  const aliases = new Map<string, Set<string>>();
  for (const node of concepts) for (const label of [node.id, node.title, ...node.aliases]) { const ids = aliases.get(label) ?? new Set<string>(); ids.add(node.id); aliases.set(label, ids); }
  const bodyPairs = new Map<string, BodyEdge>();
  for (const entry of sorted) {
    const source = byId.get(entry.data.id)!.source, raw = files.get(source.path)!;
    // 使用原文行位移保留證據；刪程式碼時以空白補齊，避免行號移位。
    const bodyStart = raw.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0].length ?? 0;
    const body = raw.slice(bodyStart).replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1[^\n]*/g, (s) => s.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, (s) => ' '.repeat(s.length));
    for (const match of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const candidates = aliases.get(match[1]); if (candidates?.size !== 1) continue;
      const target = [...candidates][0], sourceId = entry.data.id, key = pair(sourceId, target);
      if (target === sourceId || typedPairs.has(key)) continue;
      const row = bodyPairs.get(key) ?? { id: `body:${key}`, source: [sourceId, target].sort()[0], target: [sourceId, target].sort()[1], type: 'body', origins: [] };
      row.origins.push({ source: sourceId, target, origin: { ...source, line: raw.slice(0, bodyStart + match.index!).split('\n').length } }); bodyPairs.set(key, row);
    }
  }
  const references = input.questions.map((question) => ({ id: question.id, concepts: [...question.concepts].sort() })).sort((a, b) => a.id.localeCompare(b.id));
  const sourceHash = hash([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, raw]) => `${path}\0${hash(raw)}\n`).join('') + `question-references\0${hash(JSON.stringify(references))}`);
  return { format: 1, head, sourceHash, concepts, units, formalEdges, bodyEdges: [...bodyPairs.values()], unitAggregation: aggregateEdges(formalEdges, new Map(concepts.map((node) => [node.id, node.owner]))), sources };
}
let pending: Promise<GraphData> | undefined;
export function getGraphData(): Promise<GraphData> {
  return pending ??= (async () => { const root = resolve(process.cwd(), '..'); return buildGraphData(await getData(), root, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()); })();
}
export const graphAssetVersion = (data: GraphData) => `${data.head}-${data.sourceHash}`;
export const graphAssetUrl = (data: GraphData) => `/graph/${graphAssetVersion(data)}.json`;
