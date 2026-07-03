// Unit regression for chat message agent header layout.
// Run: npx tsx --test --test-force-exit test/messageHeaderLayout.unit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chatSrc = fs.readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `missing CSS rule for ${selector}`);
  return m[1]!;
}

test("member badge renders on a second header line while agent status text remains", () => {
  assert.match(chatSrc, /className="msg-subhead"/);
  assert.match(chatSrc, /isMember \? <div className="msg-subhead"><span className="member-badge">member<\/span><\/div> : null/);
  assert.match(chatSrc, /const agActivity = agentActivityText\(ag\);/);
  assert.match(chatSrc, /className=\{"msg-activity "\s*\+\s*agLive\}/);
  assert.match(chatSrc, /className="msg-role"/);
  assert.doesNotMatch(chatSrc, /<div className="msg-head">[\s\S]{0,700}\{isMember \? <span className="member-badge">member<\/span> : null\}/);
});

test("message avatar is the positioning anchor for the live status dot", () => {
  const body = ruleBody(".msg-av");
  assert.match(body, /position\s*:\s*relative\b/, `avatar wrapper must anchor .av-status: ${body}`);
  assert.match(body, /align-self\s*:\s*flex-start\b/, `avatar wrapper must not stretch to message height: ${body}`);
  assert.match(body, /line-height\s*:\s*0\b/, `avatar wrapper should not add extra inline height: ${body}`);
});

test("message first line keeps name and timestamp together", () => {
  const head = ruleBody(".msg-head");
  assert.match(head, /align-items\s*:\s*baseline\b/);
  assert.match(head, /gap\s*:\s*7px\b/);
  const ts = ruleBody(".msg-head .ts");
  assert.match(ts, /margin-left\s*:\s*0\b/, `timestamp spacing should be controlled by .msg-head gap: ${ts}`);
});

test("avatar status dot covers the same agent state colors as live dots", () => {
  assert.match(css, /--status-blue:#92B6FF/i);
  assert.match(css, /--status-green:hsl\(137 36% 64%\)/);
  assert.match(css, /--status-orange:hsl\(46 66% 50%\)/);
  assert.match(css, /--status-badge-bg:rgba\(240,239,237,.4\)/);
  assert.match(css, /\.dot\.sleeping\{background:var\(--status-blue\)\}/);
  assert.match(css, /\.dot\.online,\.dot\.active\{background:var\(--status-green\)\}/);
  assert.match(css, /\.dot\.working,\.dot\.thinking\{background:var\(--status-orange\)\}/);
  assert.match(css, /\.dot\.error\{background:var\(--status-red\)\}/);
  assert.match(css, /\.av-status\.sleeping\{background:var\(--status-blue\)\}/);
  assert.match(css, /\.av-status\.offline,\.av-status\.inactive\{background:var\(--muted-soft\)\}/);
  assert.match(css, /\.av-status\.online,\.av-status\.active\{background:var\(--status-green\)\}/);
  assert.match(css, /\.av-status\.working,\.av-status\.thinking\{background:var\(--status-orange\)\}/);
  assert.match(css, /\.av-status\.error\{background:var\(--status-red\)\}/);
});

test("message body has breathing room after the second header line", () => {
  const body = ruleBody(".msg-subhead + .mbody");
  assert.match(body, /margin-top\s*:\s*6px\b/, `message body should not sit tight against the second header line: ${body}`);
});

test("agent activity badge uses a quiet code style without colored outline", () => {
  const body = ruleBody(".msg-activity");
  assert.match(body, /border\s*:\s*0\b/, `activity badge must not draw a colored outline: ${body}`);
  assert.doesNotMatch(body, /border-color\s*:/, `activity badge base rule should not set border-color: ${body}`);
  assert.match(css, /\.msg-activity\.sleeping\{color:var\(--status-blue\);background:var\(--status-badge-bg\)\}/);
  assert.match(css, /\.msg-activity\.online,\.msg-activity\.active\{color:var\(--status-green\);background:var\(--status-badge-bg\)\}/);
  assert.match(css, /\.msg-activity\.working,\.msg-activity\.thinking\{color:var\(--status-orange\);background:var\(--status-badge-bg\)\}/);
});

test("avatar status dot pulses only while the agent is working", () => {
  const working = ruleBody(".av-status.working::after");
  assert.match(working, /animation\s*:\s*lb-ping\b/, `working avatar status should reuse live-bar pulse: ${working}`);
  assert.doesNotMatch(css, /\.av-status\.thinking::after/, "thinking status should not pulse");
  assert.doesNotMatch(css, /\.av-status\.sleeping::after/, "sleeping status should not pulse");
});

test("generic working status dots reuse the live pulse without animating thinking", () => {
  const base = ruleBody(".dot.working:not(.live-bar__pip)");
  assert.match(base, /position\s*:\s*relative\b/, `generic working status dots should anchor their pulse locally: ${base}`);
  assert.doesNotMatch(css, /\.dot\.working\{position:relative\}/, "generic working rule must not override live-bar pip positioning");
  const working = ruleBody(".dot.working:not(.live-bar__pip)::after");
  assert.match(working, /animation\s*:\s*lb-ping\b/, `generic working status dots should reuse live-bar pulse: ${working}`);
  assert.doesNotMatch(css, /\.dot\.thinking::after/, "thinking status should not pulse");
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.live-bar__pip::after,\.dot\.working:not\(\.live-bar__pip\)::after,\.av-status\.working::after\{animation:none;opacity:0\}\}/);
});

test("message hover uses a subtle border instead of a filled background", () => {
  const base = ruleBody(".msg");
  assert.match(base, /transition\s*:\s*background \.1s,box-shadow \.1s\b/, `message hover transition should include box-shadow: ${base}`);

  const hover = ruleBody(".msg:hover");
  assert.match(hover, /background\s*:\s*transparent\b/, `hover must not dim or gray-fill message body: ${hover}`);
  assert.match(hover, /box-shadow\s*:\s*inset 0 0 0 1px var\(--hair\)/, `hover should be a subtle hairline border: ${hover}`);
});
