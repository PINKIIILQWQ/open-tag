import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string): string {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("agent wake delivery targets the bound machine and records unavailable failures", () => {
  const src = read("../src/server/core.ts");

  assert.match(src, /import \{ isMachineConnected, sendToMachine \} from "\.\/daemonHub\.js"/, "core should use targeted machine delivery");
  assert.doesNotMatch(src, /broadcastToDaemons\(opts\.serverId,\s*\{ type: "agent:start"/, "message wake should not broadcast agent:start to every daemon");
  assert.doesNotMatch(src, /broadcastToDaemons\(opts\.serverId,\s*\{ type: "agent:deliver"/, "message wake should not broadcast agent:deliver to every daemon");
  assert.match(src, /const startSent = sendToMachine\(target\.machineId,[\s\S]*?const deliverSent = startSent && sendToMachine\(target\.machineId/, "start and deliver should both target the same bound machine");
  assert.match(src, /await markAgentUnavailable\(opts\.serverId, mem\.id, "machine offline"\)/, "failed wake delivery should flip the agent out of working state");
  assert.match(src, /runtime unavailable: \$\{runtime\}/, "online machines missing a runtime should be reported as unavailable");
});

test("agent lifecycle commands target one machine instead of broadcasting", () => {
  const src = read("../src/server/core.ts");
  const routes = read("../src/server/routes-api/agents.ts");

  assert.match(src, /async function agentControlTarget/, "stop/reset/profile should resolve the bound machine");
  assert.match(src, /sendToMachine\(target\.machineId, \{ type: "agent:stop"/, "stop should only go to the agent machine");
  assert.match(src, /sendToMachine\(target\.machineId, \{ type: "agent:reset"/, "reset should only go to the agent machine");
  assert.match(src, /sendToMachine\(target\.machineId, \{ type: "agent:profile"/, "profile sync should only go to the agent machine");
  assert.doesNotMatch(src, /broadcastToDaemons\(serverId, \{ type: "agent:(stop|reset|profile)"/, "lifecycle commands should not be server-wide broadcasts");
  assert.match(routes, /await syncAgentProfile/, "async targeted profile sync should be awaited by the API route");
});
