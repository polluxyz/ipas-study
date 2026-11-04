/** 正式地圖入口執行全站與局部3D驗證，不沿用舊L23303原型的驗收欄位。 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from './graph3d-smoke.mjs';
export { main };
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.BUILD_RECEIPT) throw new Error('正式map-smoke需要當版BUILD_RECEIPT；作者探索可直接執行graph3d-smoke。');
  console.log(JSON.stringify(await main(), null, 2));
}
