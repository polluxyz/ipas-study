// 協調者等待 Orca 訊息：heartbeat 自動 ack，遇到 worker_done／question／escalation 就印出並結束。
// 結束時不 ack，留給協調者驗收後用 done.sh 處理。用法：node scripts/orca/wait.cjs [run_id]
// 不給 run_id 時，從 `orca orchestration run-current` 取目前綁定的 Run。
const { execFileSync } = require('child_process');
const ORCA = 'C:/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca';

function orca(args) {
  const out = execFileSync(ORCA, [...args, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return JSON.parse(out).result;
}

function main() {
  const run = process.argv[2] || orca(['orchestration', 'run-current']).run.id;
  const deadline = Date.now() + 50 * 60 * 1000;
  let ack = null;
  while (Date.now() < deadline) {
    const args = ['orchestration', 'check', '--run', run, '--wait', '--types', 'worker_done,escalation,question', '--timeout-ms', '600000'];
    if (ack) args.push('--ack', ack);
    const r = orca(args); ack = null;
    const d = r && (r.delivery || r);
    const msgs = (d && d.messages) || [];
    if (!d || !d.deliveryId || msgs.length === 0) continue;
    const real = msgs.filter((m) => m.type !== 'heartbeat');
    if (real.length === 0) { ack = d.deliveryId; continue; }
    console.log('DELIVERY', d.deliveryId);
    for (const m of real) console.log(JSON.stringify({ id: m.id, type: m.type, from: m.from_handle, payload: m.payload, body: m.body }));
    return;
  }
  if (ack) orca(['orchestration', 'check', '--run', run, '--ack', ack]);
  console.log('TIMEOUT');
}

main();
