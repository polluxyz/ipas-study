#!/bin/bash
# worker 驗收通過後收尾：release → 關終端機 → ack（CLAUDE.md 第 13 節第 8 條）。
# 用法：bash scripts/orca/done.sh <dispatchId> <deliveryId> [run_id]
ORCA=/c/Users/Administrator/AppData/Local/Programs/orca/resources/bin/orca
RUN=${3:-$($ORCA orchestration run-current --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).result.run.id))")}
H=$($ORCA orchestration worker-list --json 2>&1 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const x of JSON.parse(s).result.workers)if(x.dispatchId==='$1')console.log(x.terminal||x.agentTerminalHandle||'')})")
$ORCA orchestration worker-release --dispatch $1 --json 2>&1 | grep -Eq '"ok": ?true' && echo released
[ -n "$H" ] && $ORCA terminal close --terminal $H --json 2>&1 | grep -Eq '"ok": ?true' && echo "closed $H"
$ORCA orchestration check --run $RUN --ack $2 --json 2>&1 | grep -Eq '"ok": ?true' && echo acked
