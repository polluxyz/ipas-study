/** 靜態圖資產以當版來源簽章命名；全部概念頁與全站只共用這一份。 */
import type { APIRoute } from 'astro';
import { getGraphData, graphAssetVersion } from '../../lib/graph3d-build';
import type { GraphData } from '../../lib/graph3d-types';
export async function getStaticPaths() { const graph = await getGraphData(); return [{ params: { version: graphAssetVersion(graph) }, props: { graph } }]; }
export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.graph as GraphData), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
