import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const chatSource = readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1]!;
}

test("message header moves agent activity and description to a second row", () => {
  assert.match(chatSource, /const agentLiveState = /);
  assert.match(chatSource, /const agentActivityText = /);
  assert.match(chatSource, /const agLive = agentLiveState\(ag\);/);
  assert.match(chatSource, /const agActivity = agentActivityText\(ag\);/);
  assert.match(chatSource, /<div className="msg-subhead">\s*\{agActivity \? <code className=\{"msg-activity " \+ agLive\}>/);
  assert.match(chatSource, /\{ag\.description \? <span className="msg-role">\{ag\.description\}<\/span> : null\}/);
  assert.doesNotMatch(chatSource, /ag\?\.description \? <span className="msg-role">/);
});

test("human member label uses the same second-row message header layout", () => {
  assert.match(chatSource, /\{isMember \? <div className="msg-subhead"><span className="member-badge">member<\/span><\/div> : null\}/);
  assert.doesNotMatch(chatSource, /: isMember \? <span className="member-badge">member<\/span>/);
});

test("second-row layout keeps timestamps beside names and separates message content", () => {
  assert.match(rule(".msg-head .ts"), /margin-left:\s*0/);
  assert.match(rule(".msg-head .ts"), /flex:\s*none/);
  assert.match(rule(".msg-subhead"), /display:\s*flex/);
  assert.match(rule(".msg-subhead"), /margin-top:\s*2px/);
  assert.match(rule(".msg-subhead + .mbody"), /margin-top:\s*6px/);
  assert.match(rule(".msg-role"), /flex:\s*1 1 auto/);
  assert.match(rule(".msg-activity"), /border:\s*0/);
});
