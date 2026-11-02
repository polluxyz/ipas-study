// 對話壓縮後補回現況（SessionStart hook，matcher 為 compact）。
//
// 壓縮只留摘要，Run id、終端機 handle 這類精確值可能失真。這裡直接向 orca 查，
// 輸出會加進壓縮後的 context，讓協調者以系統狀態為準。改編自 pollux 的同名 hook；
// 本專案還沒有 git repo，所以不查分支與 PR。見 docs/orca-multi-agent.md 第 6 節。
//
// 任何一項查不到（Orca 沒開、沒有 Run）就略過，不讓 hook 失敗。

import { execFileSync } from "node:child_process";

const ORCA = "C:/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca";

function runJson(args) {
  try {
    const text = execFileSync(ORCA, [...args, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15000,
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function main() {
  const lines = ["壓縮後的現況（hook 從 orca 查得，精確值以此為準）：", "- 交接：docs/handoff.md；派工與交接規則：docs/orca-multi-agent.md"];
  const activeRun = runJson(["orchestration", "run-current"])?.result?.run;
  if (activeRun) {
    lines.push(`- Orca run：${activeRun.id}「${activeRun.objective}」，coordinator ${activeRun.coordinator_handle}`);
    // 已結束的 dispatch 不用再盯，只列還沒收尾的。
    const settled = new Set(["completed", "failed", "abandoned", "stopped", "cancelled", "released"]);
    const workers = runJson(["orchestration", "worker-list"])?.result?.workers ?? [];
    const active = workers.filter((w) => !settled.has(w.dispatchStatus) && !w.released);
    for (const w of active) lines.push(`- worker：dispatch ${w.dispatchId}（${w.workerState}／${w.dispatchStatus}），terminal ${w.agentTerminalHandle}`);
    if (active.length === 0) lines.push("- 沒有進行中的 worker");
  }
  console.log(lines.join("\n"));
}

main();
