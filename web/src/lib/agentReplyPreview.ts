import type { Agent, Msg } from "../store.tsx";

export interface AgentReplyEvent {
  type: "agent:reply";
  agentId: string;
  channelId: string;
  op: "start" | "delta" | "done" | "error";
  streamId: string;
  name?: string;
  text?: string;
}

export const AGENT_REPLY_PREVIEW_TYPE = "agent_reply_preview";

export function agentReplyPreviewId(agentId: string, streamId: string): string {
  return `agent-reply:${agentId}:${streamId}`;
}

function senderNameFor(e: AgentReplyEvent, agent?: Agent): string {
  return e.name || agent?.displayName || agent?.name || "Agent";
}

export function applyAgentReplyPreview(messages: Msg[], e: AgentReplyEvent, agent?: Agent): Msg[] {
  if (!e.agentId || !e.channelId || !e.streamId) return messages;
  const id = agentReplyPreviewId(e.agentId, e.streamId);
  const idx = messages.findIndex((m) => m.id === id);
  if (e.op === "done" || e.op === "error") {
    if (idx < 0) return messages;
    if ((messages[idx]?.content || e.text || "").trim()) {
      return messages.map((m, i) => i === idx ? { ...m, content: m.content + (e.text || "") } : m);
    }
    return messages.filter((m) => m.id !== id);
  }
  if (idx >= 0) {
    if (e.op === "delta" && e.text) return messages.map((m, i) => i === idx ? { ...m, content: m.content + e.text } : m);
    return messages;
  }
  const preview: Msg = {
    id,
    seq: Number.MAX_SAFE_INTEGER,
    channelId: e.channelId,
    senderType: "agent",
    senderId: e.agentId,
    senderName: senderNameFor(e, agent),
    content: e.op === "delta" ? e.text || "" : "",
    messageType: AGENT_REPLY_PREVIEW_TYPE,
    createdAt: new Date().toISOString(),
  };
  return [...messages, preview];
}

export function dropAgentReplyPreviewsForMessage(messages: Msg[], msg: Msg): Msg[] {
  if (msg.senderType !== "agent" || !msg.senderId) return messages;
  return messages.filter((m) => !(m.messageType === AGENT_REPLY_PREVIEW_TYPE && m.channelId === msg.channelId && m.senderId === msg.senderId));
}
