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
export const AGENT_REPLY_STREAM_TICK_MS = 18;
export const AGENT_REPLY_CHARS_PER_TICK = 1;

export interface AgentReplyPreviewMsg extends Msg {
  streamTargetContent?: string;
  streamDone?: boolean;
  streamError?: boolean;
  streamFinalMessage?: Msg;
}

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
    const current = messages[idx] as AgentReplyPreviewMsg;
    const target = (current.streamTargetContent ?? current.content) + (e.text || "");
    if ((current.content || target).trim()) {
      return messages.map((m, i) => i === idx ? { ...m, streamTargetContent: target, streamDone: e.op === "done", streamError: e.op === "error" } as AgentReplyPreviewMsg : m);
    }
    return messages.filter((m) => m.id !== id);
  }
  if (idx >= 0) {
    if (e.op === "delta" && e.text) return messages.map((m, i) => {
      if (i !== idx) return m;
      const current = m as AgentReplyPreviewMsg;
      return { ...m, streamTargetContent: (current.streamTargetContent ?? current.content) + e.text } as AgentReplyPreviewMsg;
    });
    return messages;
  }
  const preview: AgentReplyPreviewMsg = {
    id,
    seq: Number.MAX_SAFE_INTEGER,
    channelId: e.channelId,
    senderType: "agent",
    senderId: e.agentId,
    senderName: senderNameFor(e, agent),
    content: "",
    messageType: AGENT_REPLY_PREVIEW_TYPE,
    createdAt: new Date().toISOString(),
    streamTargetContent: e.op === "delta" ? e.text || "" : "",
  };
  return [...messages, preview];
}

export function dropAgentReplyPreviewsForMessage(messages: Msg[], msg: Msg): Msg[] {
  if (msg.senderType !== "agent" || !msg.senderId) return messages;
  return messages.filter((m) => !(m.messageType === AGENT_REPLY_PREVIEW_TYPE && m.channelId === msg.channelId && m.senderId === msg.senderId));
}

export function absorbPersistedAgentMessagePreview(messages: Msg[], msg: Msg): { messages: Msg[]; consumed: boolean } {
  if (msg.senderType !== "agent" || !msg.senderId) return { messages, consumed: false };
  const idx = messages.findIndex((m) => m.messageType === AGENT_REPLY_PREVIEW_TYPE && m.channelId === msg.channelId && m.senderId === msg.senderId);
  if (idx < 0) return { messages, consumed: false };
  return {
    consumed: true,
    messages: messages.map((m, i) => i === idx
      ? { ...m, streamTargetContent: msg.content, streamDone: true, streamFinalMessage: msg } as AgentReplyPreviewMsg
      : m),
  };
}

export function hasStreamingAgentReplyPreview(messages: Msg[]): boolean {
  return messages.some((m) => {
    if (m.messageType !== AGENT_REPLY_PREVIEW_TYPE) return false;
    const preview = m as AgentReplyPreviewMsg;
    return (preview.streamTargetContent ?? "").length > m.content.length;
  });
}

export function tickAgentReplyPreviews(messages: Msg[], charsPerTick = AGENT_REPLY_CHARS_PER_TICK): { messages: Msg[]; changed: boolean } {
  let changed = false;
  const next = messages.map((m) => {
    if (m.messageType !== AGENT_REPLY_PREVIEW_TYPE) return m;
    const preview = m as AgentReplyPreviewMsg;
    const target = preview.streamTargetContent ?? "";
    if (target.length <= m.content.length) {
      if (preview.streamFinalMessage && preview.streamDone) {
        changed = true;
        return preview.streamFinalMessage;
      }
      return m;
    }
    changed = true;
    const content = target.slice(0, Math.min(target.length, m.content.length + charsPerTick));
    if (content.length >= target.length && preview.streamFinalMessage && preview.streamDone) {
      return { ...preview.streamFinalMessage, content };
    }
    return { ...m, content } as AgentReplyPreviewMsg;
  });
  return { messages: next, changed };
}
