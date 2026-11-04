/** 圖資料只保存閱讀所需欄位；來源簽章不包含教材原文。 */
export const TYPES = ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts'] as const;
export type FormalType = typeof TYPES[number];
export type EdgeType = FormalType | 'body';
export const LABELS: Record<EdgeType, string> = { is_a: '是一種', part_of: '屬於', requires: '建議先懂', mitigates: '用來處理', contrasts: '易混淆', body: '正文提到' };
export const COLORS: Record<EdgeType, string> = { is_a: '#3973aa', part_of: '#8a6ca8', requires: '#687d3f', mitigates: '#ac632d', contrasts: '#a94c73', body: '#849389' };
export interface Origin { path: string; line: number; sha256: string; }
export interface GraphNode { id: string; title: string; aliases: string[]; kind: string; codes: string[]; owner: string; summary: string; subjects: number[]; guideRefs: string[]; source: Origin; typedDegree: number; exception: boolean; }
export interface GraphUnit { id: string; title: string; subject: number; concepts: string[]; stages: { id: string; title: string; concepts: { id: string; goal: string }[] }[]; source: Origin; ownedCount: number; memberCount: number; }
export interface FormalEdge { id: string; source: string; target: string; type: FormalType; note?: string; sources: string[]; origin: Origin; directed: boolean; }
export interface BodyEdge { id: string; source: string; target: string; type: 'body'; origins: { source: string; target: string; origin: Origin }[]; }
export type GraphEdge = FormalEdge | BodyEdge;
export interface Aggregate { id: string; source: string; target: string; type: FormalType; count: number; edgeIds: string[]; }
export interface GraphVersion { format: number; head: string; sourceHash: string; }
export interface GraphData extends GraphVersion { concepts: GraphNode[]; units: GraphUnit[]; formalEdges: FormalEdge[]; bodyEdges: BodyEdge[]; unitAggregation: Aggregate[]; sources: Origin[]; }
export interface SharedState { selected: string; hops: 1 | 2; body: boolean; }
export interface GraphState { center: string; inspected: string; hops: number; body: boolean; subject: string; unit: string; outside: boolean; mode: 'concept' | 'unit'; enabled: Set<FormalType>; }
export type Vec3 = [number, number, number];
export interface Camera { yaw: number; pitch: number; zoom: number; center: Vec3; extent: number; }
