import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyAgentReplyPreview, dropAgentReplyPreviewsForMessage, AGENT_REPLY_PREVIEW_TYPE } from "../web/src/lib/agentReplyPreview.ts";
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
  assert.equal(withDelta[0]?.content, "hello");
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

test("main chat and thread panel both consume agent reply preview events", () => {
  const chatSrc = fs.readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");

  assert.match(chatSrc, /e\.type === "agent:reply" && e\.channelId === cur\?\.id/);
  assert.match(chatSrc, /e\.type === "agent:reply" && e\.channelId === channelId/);
  assert.match(chatSrc, /dropAgentReplyPreviewsForMessage\(m, e\.message\), e\.message/);
});
