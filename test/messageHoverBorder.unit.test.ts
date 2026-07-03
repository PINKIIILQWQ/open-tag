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

test("message hover uses a hairline border instead of a dimming fill", () => {
  const msg = rule(".msg");
  const hover = rule(".msg:hover");

  assert.match(msg, /transition:\s*background \.1s,\s*box-shadow \.1s/);
  assert.match(hover, /background:\s*transparent/);
  assert.match(hover, /box-shadow:\s*inset 0 0 0 1px var\(--hair\)/);
  assert.doesNotMatch(hover, /background:\s*var\(--canvas-soft\)/);
});
