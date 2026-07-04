import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyAgentReplyPreview, tickAgentReplyPreviews, hasStreamingAgentReplyPreview, AGENT_REPLY_PREVIEW_TYPE } from "../web/src/lib/agentReplyPreview.ts";

function read(path: string): string {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("agent reply preview types text into an ephemeral message", () => {
  const start = applyAgentReplyPreview([], { type: "agent:reply", op: "start", agentId: "agent-1", channelId: "chan-1", streamId: "stream-1", name: "Xiaos" });
  assert.equal(start.length, 1);
  assert.equal(start[0]?.messageType, AGENT_REPLY_PREVIEW_TYPE);
  assert.equal(start[0]?.content, "");

  const withDelta = applyAgentReplyPreview(start, { type: "agent:reply", op: "delta", agentId: "agent-1", channelId: "chan-1", streamId: "stream-1", text: "ok" });
  assert.equal(withDelta[0]?.content, "");
  assert.equal((withDelta[0] as any)?.streamTargetContent, "ok");
  assert.equal(hasStreamingAgentReplyPreview(withDelta), true);

  const tick = tickAgentReplyPreviews(withDelta, 1);
  assert.equal(tick.changed, true);
  assert.equal(tick.messages[0]?.content, "o");
});

test("agent reply preview error remains visible without text", () => {
  const start = applyAgentReplyPreview([], { type: "agent:reply", op: "start", agentId: "agent-1", channelId: "chan-1", streamId: "stream-1", name: "Xiaos" });
  const failed = applyAgentReplyPreview(start, { type: "agent:reply", op: "error", agentId: "agent-1", channelId: "chan-1", streamId: "stream-1" });

  assert.equal(failed.length, 1);
  assert.equal(failed[0]?.messageType, AGENT_REPLY_PREVIEW_TYPE);
  assert.equal((failed[0] as any)?.streamError, true);
});

test("server and daemon share one stream id per wake", () => {
  const core = read("../src/server/core.ts");
  const daemon = read("../src/daemon/agentManager.ts");
  const index = read("../src/daemon/index.ts");
  const ws = read("../src/server/ws.ts");
  const socketio = read("../src/server/socketio.ts");

  assert.match(core, /agentReplyStreamId\(msg!\.id, mem\.id\)/, "server should derive stream id from trigger message and agent");
  assert.match(core, /type: "agent:reply"[\s\S]*op: "start"/, "server should publish preview start before runtime output");
  assert.match(core, /streamId: replyStreamId/, "server should send the stream id to the daemon deliver path");
  assert.match(index, /streamId: msg\.streamId/, "daemon bridge should forward stream id into AgentManager");
  assert.match(daemon, /streamId:\s*streamId \?\? `\$\{Date\.now\(\)\}-\$\{\+\+this\.replySeq\}`/, "daemon should prefer server stream id");
  assert.doesNotMatch(daemon, /if \(existing\?\.channelId === channelId && streamId\) return;/, "same-channel later stream ids must not be swallowed");
  assert.match(ws, /msg\.type === "agent:reply"/, "server daemon websocket should accept reply preview events");
  assert.match(socketio, /case "agent:reply"/, "reply previews should be channel-scoped socket events");
});
