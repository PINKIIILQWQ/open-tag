import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1]!;
}

test("message avatar wrapper anchors the status dot to the avatar", () => {
  const avatar = rule(".msg-av");
  const clickable = rule(".msg-av.clickable");

  assert.match(avatar, /position:\s*relative/);
  assert.match(avatar, /display:\s*inline-flex/);
  assert.match(avatar, /line-height:\s*0/);
  assert.match(avatar, /flex:\s*none/);
  assert.match(avatar, /align-self:\s*flex-start/);
  assert.match(clickable, /cursor:\s*pointer/);
  assert.doesNotMatch(clickable, /display:\s*inline-block/);
});
