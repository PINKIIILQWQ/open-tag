// Rich message rendering (react-markdown + remark-gfm + remark-breaks + rehype-sanitize).
// Internal links are encoded as markdown-link [label](tag:type:args) instead of raw <a> injection —
// same effect without dangerouslySetInnerHTML (safer, no XSS).
// Raw HTML in a body is shown as LITERAL TEXT (remarkHtmlAsText), never rendered and never dropped —
// react-markdown's default would silently swallow it, turning an all-HTML message into an empty bubble.
import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// sanitize allows only http/https/mailto by default; also allow our internal tag: protocol (token links)
export const markdownSchema = { ...defaultSchema, protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? ["http", "https", "mailto"]), "tag"] } };

type NameItem = { name?: string; id?: string };
type MentionItem = { type?: string; id?: string; name?: string };
type Nav = (type: string, args: string[]) => void;
const lc = (x?: string) => (x ?? "").toLowerCase();

function textFromReact(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReact).join("");
  if (typeof node === "object" && "props" in node) return textFromReact((node as { props?: { children?: ReactNode } }).props?.children);
  return "";
}

function languageFromReact(node: ReactNode): string | null {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const lang = languageFromReact(child);
      if (lang) return lang;
    }
    return null;
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { className?: string; children?: ReactNode } }).props;
    const match = props?.className?.match(/(?:^|\s)language-([^\s]+)/);
    if (match?.[1]) return match[1];
    return languageFromReact(props?.children);
  }
  return null;
}

function formatLanguage(lang: string | null): string {
  if (!lang) return "CODE";
  const aliases: Record<string, string> = {
    js: "JS",
    jsx: "JSX",
    ts: "TS",
    tsx: "TSX",
    py: "PYTHON",
    sh: "SHELL",
    bash: "SHELL",
    zsh: "SHELL",
    md: "MARKDOWN",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
  };
  return aliases[lang.toLowerCase()] ?? lang.replace(/[-_]+/g, " ").toUpperCase();
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = textFromReact(children).replace(/\n$/, "");
  const lang = formatLanguage(languageFromReact(children));
  const onCopy = async () => {
    try {
      await writeClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="md-codeblock">
      <div className="md-codebar">
        <span className="md-code-lang">{lang}</span>
        <button type="button" className="md-code-copy" aria-label={copied ? "Copied code" : "Copy code"} title={copied ? "Copied" : "Copy code"} onClick={onCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export function colorValueFromTag(href?: string | null): string | null {
  if (!href?.startsWith("tag:color:")) return null;
  try {
    return decodeURIComponent(href.slice("tag:color:".length));
  } catch {
    return null;
  }
}

export function ColorSwatch({ value }: { value: string }) {
  return (
    <span className="color-token" title={value}>
      <span className="color-token-text">{value}</span>
      <span className="color-chip" style={{ backgroundColor: value }} aria-hidden="true" />
    </span>
  );
}

// E9 simplified: code placeholder protection → token→tag: link (whitelist miss = rendered as-is) → restore code.
// @mentions are resolved from the message's own mentions[] — the server-authored message_mentions rows, already
// scoped to channel members — NOT from a workspace-wide name list. So an @name the server did not actually
// deliver (e.g. a non-member in a private channel / DM) renders as plain text, never a fake clickable mention.
// #channel / #thread / task #N still resolve against the workspace channel list.
export function processMessageContent(raw: string, ctx: { mentions: MentionItem[]; channels: NameItem[] }): string {
  if (!raw) return "";
  const codes: string[] = [];
  let s = raw
    .replace(/```[\s\S]*?```/g, (m) => `\u0000C${codes.push(m) - 1}\u0000`)   // fenced code block placeholder (protects inner @# from token pollution)
    .replace(/`[^`\n]+`/g, (m) => `\u0000C${codes.push(m) - 1}\u0000`);          // inline code placeholder
  const refs: string[] = [];
  const ref = (markdownLink: string) => `\u0000R${refs.push(markdownLink) - 1}\u0000`;
  const mMap = new Map(ctx.mentions.map((x) => [lc(x.name), x]));
  const cMap = new Map(ctx.channels.map((c) => [lc(c.name), c]));
  s = s
    .replace(/#([\p{L}\p{N}_-]+):([\da-f]{6,8})/giu, (m, name: string, short: string) => { const c = cMap.get(lc(name)); return c ? ref(`[#${name}:${short}](tag:thread:${c.id}:${short})`) : m; })  // thread reference first (prevent #channel from consuming it)
    .replace(/@([\p{L}\p{N}_-]+)/gu, (m, name: string) => { const mn = mMap.get(lc(name)); return mn ? ref(`[@${name}](tag:${mn.type === "agent" ? "agent" : "human"}:${mn.id})`) : m; })  // only @ the server actually recorded as a mention
    .replace(/(^|[^\w/])(?:task\s+)#([1-9]\d*)\b/giu, (_m, pre: string, num: string) => `${pre}${ref(`[task #${num}](tag:task:${num})`)}`)  // only "task #N" (bare #N not rendered yet: no knownTaskNumbers whitelist, avoids false positives)
    .replace(/#([\p{L}\p{N}_-]+)/gu, (m, name: string) => { const c = cMap.get(lc(name)); return c ? ref(`[#${name}](tag:channel:${c.id})`) : m; });
  return s
    .replace(/\u0000R(\d+)\u0000/g, (_m, i) => refs[+i])
    .replace(/\u0000C(\d+)\u0000/g, (_m, i) => codes[+i]);
}

// remark transform: downgrade every mdast `html` node (block or inline) to a literal `text` node, so raw
// HTML in a message is shown as its source instead of being silently dropped by react-markdown. React still
// escapes text on render, so this stays injection-safe — it never enables HTML rendering, only visibility.
export function remarkHtmlAsText() {
  const downgrade = (node: any): void => {
    if (node.type === "html") node.type = "text";
    if (Array.isArray(node.children)) node.children.forEach(downgrade);
  };
  return (tree: any): void => { downgrade(tree); };
}

const colorFunctionPattern = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/gi;
const hexColorPattern = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\p{L}\p{N}_-])/giu;

function isWordLike(ch: string): boolean {
  return /[\p{L}\p{N}_-]/u.test(ch);
}

function closingParenIndex(value: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    } else if (ch === "\n") {
      return -1;
    }
  }
  return -1;
}

function colorTokenRanges(value: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of value.matchAll(colorFunctionPattern)) {
    const start = match.index ?? 0;
    if (start > 0 && isWordLike(value[start - 1] ?? "")) continue;
    const open = start + match[0].length - 1;
    const close = closingParenIndex(value, open);
    if (close < 0) continue;
    const token = value.slice(start, close + 1);
    if (token.length > 160 || /[;{}<>]/.test(token)) continue;
    ranges.push({ start, end: close + 1 });
  }
  for (const match of value.matchAll(hexColorPattern)) {
    const start = match.index ?? 0;
    if (start > 0 && isWordLike(value[start - 1] ?? "")) continue;
    const end = start + match[0].length;
    if (ranges.some((r) => start >= r.start && end <= r.end)) continue;
    ranges.push({ start, end });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

function colorizeTextNode(node: any): any[] {
  const value = String(node.value ?? "");
  const ranges = colorTokenRanges(value);
  if (!ranges.length) return [node];
  const out: any[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) out.push({ ...node, value: value.slice(cursor, range.start) });
    const token = value.slice(range.start, range.end);
    out.push({ type: "link", url: `tag:color:${encodeURIComponent(token)}`, children: [{ type: "text", value: token }] });
    cursor = range.end;
  }
  if (cursor < value.length) out.push({ ...node, value: value.slice(cursor) });
  return out;
}

export function remarkColorSwatches() {
  const visit = (node: any): void => {
    if (!node || !Array.isArray(node.children)) return;
    if (["link", "linkReference", "image", "imageReference"].includes(node.type)) return;
    const next: any[] = [];
    for (const child of node.children) {
      if (child?.type === "text") next.push(...colorizeTextNode(child));
      else {
        visit(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return (tree: any): void => { visit(tree); };
}

export function MessageContent({ content, mentions, channels, nav }: { content: string; mentions: MentionItem[]; channels: NameItem[]; nav: Nav }) {
  const src = useMemo(() => processMessageContent(content, { mentions, channels }), [content, mentions, channels]);
  return (
    <div className="md">
      <ReactMarkdown
        urlTransform={(u) => (u.startsWith("tag:") ? u : defaultUrlTransform(u))}
        remarkPlugins={[remarkGfm, remarkBreaks, remarkHtmlAsText, remarkColorSwatches]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
        components={{
          pre({ children }) {
            return <CodeBlock>{children}</CodeBlock>;
          },
          a({ href, children }) {
            if (typeof href === "string" && href.startsWith("tag:")) {
              const color = colorValueFromTag(href);
              if (color) return <ColorSwatch value={color} />;
              const [, type, ...args] = href.split(":");
              const cls = type === "agent" || type === "human" ? "mention ref-at" : type === "channel" ? "ref-chan" : type === "thread" ? "ref-thread" : "ref-task";
              return <a className={cls} onClick={(e) => { e.preventDefault(); nav(type, args); }}>{children}</a>;
            }
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
        }}
      >{src}</ReactMarkdown>
    </div>
  );
}
