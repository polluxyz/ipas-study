/** 固定關閉遙測；本機原型除了安裝套件，不需要任何外部服務。 */
import { spawn } from 'node:child_process';
async function run(args) {
  const child = spawn(process.execPath, [new URL('../node_modules/astro/bin/astro.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), ...args], { stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
}
const args = process.argv.slice(2);
if (args[0] === 'build') { const code = await run(['check']); if (code) process.exit(code); }
process.exit(await run(args));
