// Unit regression for Markdown readability CSS in chat messages and Workspace .md preview.
// Run: npx tsx --test --test-force-exit test/markdownCss.unit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const messageRenderSrc = fs.readFileSync(new URL("../web/src/messageRender.tsx", import.meta.url), "utf8");
const membersSrc = fs.readFileSync(new URL("../web/src/views/Members.tsx", import.meta.url), "utf8");

function selectorList(prelude: string): string[] {
  return prelude.split(",").map((selector) => selector.trim());
}

function ruleBodies(selector: string): string[] {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const bodies: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    if (selectorList(match[1]!).includes(selector)) bodies.push(match[2]!);
  }
  assert.ok(bodies.length > 0, `missing CSS rule for ${selector}`);
  return bodies;
}

function assertDecl(selector: string, prop: string, value: string): void {
  const bodies = ruleBodies(selector);
  const decl = new RegExp(`${prop}\\s*:\\s*${value}(?:;|$)`);
  assert.ok(bodies.some((body) => decl.test(body)), `expected ${prop}:${value} in ${selector}:\n${bodies.join("\n---\n")}`);
}

test("chat Markdown styles cover rich GFM elements beyond paragraphs and code", () => {
  assertDecl(".msg", "margin", "0 auto 12px");
  assert.match(css, /--link-blue:#7097F1/);
  assertDecl(".md a", "color", "var\\(--link-blue\\)");
  assert.match(css, /\.md\{[^}]*font-size:15px[^}]*line-height:1\.6/);
  assertDecl(".md", "margin-left", "0");
  assertDecl(".md", "margin-right", "auto");
  assertDecl(".md p + p", "margin-top", "\\.72em");
  assertDecl(".color-token", "display", "inline-flex");
  assertDecl(".color-token", "align-items", "center");
  assertDecl(".color-token-text", "font-family", "var\\(--mono\\)");
  assertDecl(".color-chip", "width", "1em");
  assertDecl(".color-chip", "height", "1em");
  assertDecl(".md code", "border-radius", "4px");
  assertDecl(".md-codeblock", "background", "var\\(--surface-strong\\)");
  assertDecl(".md pre", "background", "transparent");
  assertDecl(".md pre", "border", "0");
  assertDecl(".md pre", "padding", "12px 16px");
  assertDecl(".md-codeblock", "position", "relative");
  assertDecl(".md-codeblock", "margin", "\\.7em 0");
  assertDecl(".md-codeblock", "overflow", "hidden");
  assertDecl(".md-codebar", "height", "32px");
  assertDecl(".md-codebar", "justify-content", "space-between");
  assertDecl(".md-code-lang", "font-family", "var\\(--mono\\)");
  assertDecl(".md-code-lang", "text-transform", "uppercase");
  assertDecl(".md-code-copy", "width", "26px");
  assertDecl(".md blockquote", "border-left", "4px solid var\\(--hair-strong\\)");
  assertDecl(".md blockquote", "padding", "8px 18px");
  assertDecl(".md blockquote", "color", "var\\(--quote-text\\)");
  assertDecl(".md blockquote.github-alert", "border-left-color", "var\\(--alert-color\\)");
  assertDecl(".md blockquote.github-alert::before", "content", "attr\\(data-alert\\)");
  assertDecl(".md blockquote.github-alert::before", "text-transform", "uppercase");
  assertDecl(".md blockquote.github-alert-note", "--alert-color", "var\\(--alert-note\\)");
  assertDecl(".md blockquote.github-alert-tip", "--alert-color", "var\\(--alert-tip\\)");
  assertDecl(".md blockquote.github-alert-important", "--alert-color", "var\\(--alert-important\\)");
  assertDecl(".md blockquote.github-alert-warning", "--alert-color", "var\\(--alert-warning\\)");
  assertDecl(".md blockquote.github-alert-caution", "--alert-color", "var\\(--alert-caution\\)");
  assertDecl(".md table", "border-collapse", "collapse");
  assertDecl(".md table", "background", "transparent");
  assertDecl(".md td", "overflow-wrap", "anywhere");
  assertDecl(".md th", "background", "var\\(--surface-strong\\)");
  assertDecl(".md img", "max-width", "min\\(100%,640px\\)");
  assertDecl(".md hr", "border-top", "1px solid var\\(--hair-strong\\)");
  assertDecl(".md h4", "font-size", "1em");
  assertDecl(".md h4", "margin", "1\\.15em 0 \\.55em");
  assertDecl(".md > h1:first-child", "margin-top", "\\.35em");
  assertDecl(".md kbd", "font-family", "var\\(--mono\\)");
  assertDecl(".md mark", "background", "var\\(--mention\\)");
  assertDecl(".md ul", "padding-left", "1\\.1em");
  assertDecl(".md ul", "list-style", "none");
  assertDecl(".md li", "position", "relative");
  assertDecl(".md li", "padding-left", "1\\.38em");
  assertDecl(".md ul > li:not(.task-list-item)::before", "position", "absolute");
  assertDecl(".md ul > li:not(.task-list-item)::before", "top", "\\.79em");
  assertDecl(".md ul > li:not(.task-list-item)::before", "width", "\\.38em");
  assertDecl(".md ul > li:not(.task-list-item)::before", "height", "\\.38em");
  assertDecl(".md ul > li:not(.task-list-item)::before", "border-radius", "9999px");
  assertDecl(".md ul > li:not(.task-list-item)::before", "transform", "translateY\\(-50%\\)");
  assertDecl(".md ul ul > li:not(.task-list-item)::before", "background", "transparent");
  assertDecl(".md ul ul > li:not(.task-list-item)::before", "border", "1\\.5px solid currentColor");
  assertDecl(".md ul ul ul > li:not(.task-list-item)::before", "border-radius", "2px");
  assertDecl(".md ul ul ul > li:not(.task-list-item)::before", "background", "currentColor");
  assertDecl(".md ul ul ul ul > li:not(.task-list-item)::before", "background", "transparent");
  assertDecl(".md ul ul ul ul > li:not(.task-list-item)::before", "border", "1\\.5px solid currentColor");
  assertDecl(".md ol", "counter-reset", "md-ol");
  assertDecl(".md ol > li", "counter-increment", "md-ol");
  assertDecl(".md ol > li::before", "content", "counter\\(md-ol\\) \"\\.\"");
  assertDecl(".md ol > li::before", "width", "1\\.05em");
  assertDecl(".md ol > li::before", "height", "1\\.6em");
  assertDecl(".md ol > li::before", "justify-content", "center");
  assertDecl(".md ul.contains-task-list", "padding-left", "1\\.1em");
  assertDecl(".md li.task-list-item", "margin-left", "0");
  assertDecl(".md li.task-list-item input[type=\"checkbox\"]", "position", "absolute");
  assertDecl(".md li.task-list-item input[type=\"checkbox\"]", "left", "\\.025em");
  assertDecl(".md li.task-list-item input[type=\"checkbox\"]", "top", "\\.42em");
  assertDecl(".md del", "color", "var\\(--done-text\\)");
  assertDecl(".md del", "text-decoration-color", "var\\(--done-text\\)");
  assertDecl(".md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "color", "var\\(--done-text\\)");
  assertDecl(".md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "text-decoration", "line-through");
  assertDecl(".md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "text-decoration-color", "var\\(--done-text\\)");
  assertDecl(".mention", "color", "var\\(--ink-2\\)");
  assertDecl(".mention", "text-decoration", "none");
  assertDecl(".md .ref-chan", "background", "var\\(--channel-mention\\)");
  assertDecl(".md .ref-chan", "color", "var\\(--ink-2\\)");
});

test("Workspace Markdown preview keeps parity with chat for rich GFM elements", () => {
  assert.match(messageRenderSrc, /export function CodeBlock/);
  assert.match(messageRenderSrc, /function languageFromReact/);
  assert.match(messageRenderSrc, /language-\(\[\^\\s\]\+\)/);
  assert.match(messageRenderSrc, /<span className="md-code-lang">\{lang\}<\/span>/);
  assert.match(messageRenderSrc, /navigator\.clipboard\?\.writeText/);
  assert.match(messageRenderSrc, /pre\(\{ children \}\)\s*\{\s*return <CodeBlock>\{children\}<\/CodeBlock>/);
  assert.match(membersSrc, /import \{ CodeBlock, ColorSwatch, colorValueFromTag, markdownSchema, remarkColorSwatches, remarkGithubAlerts \} from "\.\.\/messageRender\.tsx"/);
  assert.match(messageRenderSrc, /export function remarkColorSwatches/);
  assert.match(messageRenderSrc, /export function remarkGithubAlerts/);
  assert.match(messageRenderSrc, /tag:color:\$\{encodeURIComponent\(token\)\}/);
  assert.match(membersSrc, /remarkPlugins=\{\[remarkGfm, remarkBreaks, remarkGithubAlerts, remarkColorSwatches\]\}/);
  assert.match(membersSrc, /rehypePlugins=\{\[\[rehypeSanitize, markdownSchema\]\]\}/);
  assert.match(membersSrc, /ColorSwatch value=\{color\}/);
  assert.match(membersSrc, /pre: \(\{ children \}\) => <CodeBlock>\{children\}<\/CodeBlock>/);
  assertDecl(".ws-md a", "color", "var\\(--link-blue\\)");
  assertDecl(".ws-md img", "max-width", "min\\(100%,640px\\)");
  assert.match(css, /\.ws-md\{[^}]*font-size:15px[^}]*line-height:1\.64/);
  assertDecl(".ws-md p + p", "margin-top", "\\.76em");
  assertDecl(".ws-md code", "border-radius", "4px");
  assertDecl(".ws-md pre", "background", "var\\(--surface-strong\\)");
  assertDecl(".ws-md pre", "border", "0");
  assertDecl(".ws-md pre", "padding", "14px 18px");
  assertDecl(".ws-md blockquote", "border-left", "4px solid var\\(--hair-strong\\)");
  assertDecl(".ws-md blockquote", "padding", "9px 19px");
  assertDecl(".ws-md blockquote", "color", "var\\(--quote-text\\)");
  assertDecl(".ws-md blockquote.github-alert", "border-left-color", "var\\(--alert-color\\)");
  assertDecl(".ws-md h4", "font-size", "1em");
  assertDecl(".ws-md h4", "margin", "1\\.45em 0 \\.62em");
  assertDecl(".ws-md kbd", "font-family", "var\\(--mono\\)");
  assertDecl(".ws-md mark", "background", "var\\(--mention\\)");
  assertDecl(".ws-md ul", "padding-left", "1\\.05em");
  assertDecl(".ws-md ul", "list-style", "none");
  assertDecl(".ws-md li", "position", "relative");
  assertDecl(".ws-md li", "padding-left", "1\\.36em");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "position", "absolute");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "top", "\\.82em");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "width", "\\.38em");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "height", "\\.38em");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "border-radius", "9999px");
  assertDecl(".ws-md ul > li:not(.task-list-item)::before", "transform", "translateY\\(-50%\\)");
  assertDecl(".ws-md ul ul > li:not(.task-list-item)::before", "background", "transparent");
  assertDecl(".ws-md ul ul > li:not(.task-list-item)::before", "border", "1\\.5px solid currentColor");
  assertDecl(".ws-md ul ul ul > li:not(.task-list-item)::before", "border-radius", "2px");
  assertDecl(".ws-md ul ul ul > li:not(.task-list-item)::before", "background", "currentColor");
  assertDecl(".ws-md ul ul ul ul > li:not(.task-list-item)::before", "background", "transparent");
  assertDecl(".ws-md ul ul ul ul > li:not(.task-list-item)::before", "border", "1\\.5px solid currentColor");
  assertDecl(".ws-md ol", "counter-reset", "ws-md-ol");
  assertDecl(".ws-md ol > li", "counter-increment", "ws-md-ol");
  assertDecl(".ws-md ol > li::before", "content", "counter\\(ws-md-ol\\) \"\\.\"");
  assertDecl(".ws-md ol > li::before", "width", "1\\.05em");
  assertDecl(".ws-md ol > li::before", "height", "1\\.64em");
  assertDecl(".ws-md ol > li::before", "justify-content", "center");
  assertDecl(".ws-md ul.contains-task-list", "padding-left", "1\\.05em");
  assertDecl(".ws-md li.task-list-item", "margin-left", "0");
  assertDecl(".ws-md li.task-list-item input[type=\"checkbox\"]", "position", "absolute");
  assertDecl(".ws-md li.task-list-item input[type=\"checkbox\"]", "left", "\\.025em");
  assertDecl(".ws-md li.task-list-item input[type=\"checkbox\"]", "top", "\\.46em");
  assertDecl(".ws-md del", "color", "var\\(--done-text\\)");
  assertDecl(".ws-md del", "text-decoration-color", "var\\(--done-text\\)");
  assertDecl(".ws-md li.task-list-item", "list-style", "none");
  assertDecl(".ws-md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "color", "var\\(--done-text\\)");
  assertDecl(".ws-md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "text-decoration", "line-through");
  assertDecl(".ws-md li.task-list-item:has(input[type=\"checkbox\"]:checked)", "text-decoration-color", "var\\(--done-text\\)");
});
