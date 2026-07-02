import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AgentManager, type AgentConfig } from "./agentManager.js";
import type { Runtime, RuntimeCallbacks, StartOpts } from "./runtime.js";

const baseConfig = (agentId: string): AgentConfig => ({
  agentId,
  name: "agent",
  displayName: "Agent",
  description: "test agent",
  runtime: "fake",
  model: "default",
  serverUrl: "http://localhost:7777",
  serverId: "server-1",
  agentToken: "test-token",
});

test("deliver received during async start is flushed to runtime session", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-agent-manager-"));
  const delivered: string[] = [];
  const fakeRuntime: Runtime = {
    name: "fake",
    start(_opts: StartOpts, cb: RuntimeCallbacks) {
      cb.onSession("fake-session");
      return { deliver: (text) => delivered.push(text), stop: () => {} };
    },
  };

  try {
    const mgr = new AgentManager(() => {}, {
      dataDir: root,
      binDir: root,
      deliverDebounceMs: 0,
      runtimeResolver: () => fakeRuntime,
    });
    const start = mgr.start("agent-1", baseConfig("agent-1"));
    mgr.deliver("agent-1", "Pinkqaq", "dm:agent-1", true, { targetName: "dm:Agent", msgShort: "m1" });
    await start;
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(delivered.length, 1);
    assert.match(delivered[0]!, /Pinkqaq/);
    assert.match(delivered[0]!, /dm:Agent/);
    mgr.stopAll();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent starts for the same agent are idempotent", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-agent-manager-"));
  let startCount = 0;
  const fakeRuntime: Runtime = {
    name: "fake",
    start(_opts: StartOpts, cb: RuntimeCallbacks) {
      startCount++;
      cb.onSession("fake-session");
      return { deliver: () => {}, stop: () => {} };
    },
  };

  try {
    const mgr = new AgentManager(() => {}, {
      dataDir: root,
      binDir: root,
      runtimeResolver: () => fakeRuntime,
    });
    await Promise.all([
      mgr.start("agent-2", baseConfig("agent-2")),
      mgr.start("agent-2", baseConfig("agent-2")),
    ]);

    assert.equal(startCount, 1);
    mgr.stopAll();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
