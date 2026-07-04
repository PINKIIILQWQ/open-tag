import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { absorbPersistedAgentMessagePreview, applyAgentReplyPreview, dropAgentReplyPreviewsForMessage, tickAgentReplyPreviews, hasStreamingAgentReplyPreview, AGENT_REPLY_PREVIEW_TYPE } from "../web/src/lib/agentReplyPreview.ts";
import type { Msg } from "../web/src/store.tsx";

test("agent reply preview streams text into an ephemeral chat message", () => {
  const start = applyAgentReplyPreview([], {
    type: "agent:reply",
    op: "start",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    name: "Xiaos",
  });

  assert.equal(start.length, 1);
  assert.equal(start[0]?.messageType, AGENT_REPLY_PREVIEW_TYPE);
  assert.equal(start[0]?.senderName, "Xiaos");
  assert.equal(start[0]?.content, "");

  const withDelta = applyAgentReplyPreview(start, {
    type: "agent:reply",
    op: "delta",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    text: "hello",
  });

  assert.equal(withDelta.length, 1);
  assert.equal(withDelta[0]?.content, "", "delta text should not be dumped into the preview all at once");
  assert.equal((withDelta[0] as any)?.streamTargetContent, "hello");

  assert.equal(hasStreamingAgentReplyPreview(withDelta), true);
  const oneTick = tickAgentReplyPreviews(withDelta, 1);
  assert.equal(oneTick.changed, true);
  assert.equal(oneTick.messages[0]?.content, "h");
  assert.equal((oneTick.messages[0] as any)?.streamTargetContent, "hello");

  const finished = tickAgentReplyPreviews(oneTick.messages, 10);
  assert.equal(finished.messages[0]?.content, "hello");
  assert.equal(hasStreamingAgentReplyPreview(finished.messages), false);
});

test("agent reply preview done appends final text to the stream target instead of bypassing typing", () => {
  const start = applyAgentReplyPreview([], {
    type: "agent:reply",
    op: "start",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    name: "Xiaos",
  });

  const done = applyAgentReplyPreview(start, {
    type: "agent:reply",
    op: "done",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    text: "final",
  });

  assert.equal(done.length, 1);
  assert.equal(done[0]?.content, "", "done text should still reveal through the typewriter path");
  assert.equal((done[0] as any)?.streamTargetContent, "final");
  assert.equal((done[0] as any)?.streamDone, true);
});

test("real persisted agent message replaces the ephemeral preview", () => {
  const preview = applyAgentReplyPreview([], {
    type: "agent:reply",
    op: "delta",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    name: "Xiaos",
    text: "draft",
  });
  const real: Msg = {
    id: "msg-1",
    seq: 1,
    channelId: "chan-1",
    senderType: "agent",
    senderId: "agent-1",
    senderName: "Xiaos",
    content: "final",
  };

  assert.deepEqual(dropAgentReplyPreviewsForMessage(preview, real), []);
});

test("persisted agent message streams through the preview before replacing it", () => {
  const preview = applyAgentReplyPreview([], {
    type: "agent:reply",
    op: "start",
    agentId: "agent-1",
    channelId: "chan-1",
    streamId: "stream-1",
    name: "Xiaos",
  });
  const real: Msg = {
    id: "msg-1",
    seq: 1,
    channelId: "chan-1",
    senderType: "agent",
    senderId: "agent-1",
    senderName: "Xiaos",
    content: "final",
  };

  const absorbed = absorbPersistedAgentMessagePreview(preview, real);
  assert.equal(absorbed.consumed, true);
  assert.equal(absorbed.messages[0]?.messageType, AGENT_REPLY_PREVIEW_TYPE);
  assert.equal(absorbed.messages[0]?.content, "");
  assert.equal((absorbed.messages[0] as any)?.streamTargetContent, "final");

  const oneTick = tickAgentReplyPreviews(absorbed.messages, 1);
  assert.equal(oneTick.messages[0]?.id, preview[0]?.id);
  assert.equal(oneTick.messages[0]?.content, "f");

  const finished = tickAgentReplyPreviews(oneTick.messages, 10);
  assert.equal(finished.messages[0]?.id, "msg-1");
  assert.equal(finished.messages[0]?.messageType, undefined);
  assert.equal(finished.messages[0]?.content, "final");
});

test("main chat and thread panel both consume agent reply preview events", () => {
  const chatSrc = fs.readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");

  assert.match(chatSrc, /e\.type === "agent:reply" && e\.channelId === cur\?\.id/);
  assert.match(chatSrc, /e\.type === "agent:reply" && e\.channelId === channelId/);
  assert.match(chatSrc, /hasStreamingAgentReplyPreview\(msgs\)/, "main chat should run the typewriter loop while a preview has pending text");
  assert.match(chatSrc, /tickAgentReplyPreviews/, "thread panel should use the same preview typewriter loop");
  assert.match(chatSrc, /dropAgentReplyPreviewsForMessage\(m, e\.message\), e\.message/);
});

test("server starts agent reply previews as soon as a message wakes an agent", () => {
  const coreSrc = fs.readFileSync(new URL("../src/server/core.ts", import.meta.url), "utf8");
  assert.match(coreSrc, /const replyStreamId = agentReplyStreamId\(msg!\.id, mem\.id\);/, "createMessage should derive a stable preview stream id from trigger message + agent");
  assert.match(coreSrc, /await publish\(opts\.serverId, \{ type: "agent:reply", agentId: mem\.id, channelId: opts\.channelId, streamId: replyStreamId,[\s\S]*?op: "start"/, "createMessage should publish preview start before waiting for daemon runtime output");
  assert.match(coreSrc, /streamId: replyStreamId/, "agent:deliver payload should pass the same stream id through to the daemon");
});

test("daemon reply preview can reuse a server-provided stream id", () => {
  const daemonSrc = fs.readFileSync(new URL("../src/daemon/agentManager.ts", import.meta.url), "utf8");
  const indexSrc = fs.readFileSync(new URL("../src/daemon/index.ts", import.meta.url), "utf8");
  assert.match(daemonSrc, /streamId\?: string/, "deliver metadata should accept a stable stream id");
  assert.match(daemonSrc, /streamId:\s*streamId \?\? `\$\{Date\.now\(\)\}-\$\{\+\+this\.replySeq\}`/, "daemon should prefer the server stream id and fall back only for older servers");
  assert.match(indexSrc, /streamId: msg\.streamId/, "daemon websocket bridge should forward agent:deliver streamId into AgentManager");
});
