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

test("status colors are centralized and reused by sidebar and avatar dots", () => {
  assert.match(css, /--status-blue:#92B6FF/);
  assert.match(css, /--status-green:hsl\(137 36% 64%\)/);
  assert.match(css, /--status-orange:hsl\(46 66% 50%\)/);
  assert.match(css, /--status-red:#c36a6a/);

  assert.match(rule(".dot.online,.dot.active"), /background:\s*var\(--status-green\)/);
  assert.match(rule(".dot.working,.dot.thinking"), /background:\s*var\(--status-orange\)/);
  assert.match(rule(".dot.sleeping"), /background:\s*var\(--status-blue\)/);
  assert.match(rule(".dot.error"), /background:\s*var\(--status-red\)/);

  assert.match(rule(".av-status.online,.av-status.active"), /background:\s*var\(--status-green\)/);
  assert.match(rule(".av-status.working,.av-status.thinking"), /background:\s*var\(--status-orange\)/);
  assert.match(rule(".av-status.sleeping"), /background:\s*var\(--status-blue\)/);
  assert.match(rule(".av-status.error"), /background:\s*var\(--status-red\)/);

  assert.match(rule(".msg-activity.online,.msg-activity.active"), /color:\s*var\(--status-green\)/);
  assert.match(rule(".msg-activity.working,.msg-activity.thinking"), /color:\s*var\(--status-orange\)/);
  assert.match(rule(".msg-activity.sleeping"), /color:\s*var\(--status-blue\)/);
  assert.match(rule(".msg-activity.error"), /color:\s*var\(--status-red\)/);
});

test("working dots pulse everywhere except the live bar's existing pip implementation", () => {
  assert.match(rule(".dot.working:not(.live-bar__pip)"), /position:\s*relative/);
  assert.match(rule(".dot.working:not(.live-bar__pip)::after"), /animation:\s*lb-ping 1\.9s/);
  assert.match(rule(".av-status.working::after"), /animation:\s*lb-ping 1\.9s/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.live-bar__pip::after,\.dot\.working:not\(\.live-bar__pip\)::after,\.av-status\.working::after\{animation:none;opacity:0\}/);
});
