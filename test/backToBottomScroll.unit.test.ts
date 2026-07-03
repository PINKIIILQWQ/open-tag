import test from "node:test";
import assert from "node:assert/strict";
import { animateBackToBottom, BACK_TO_BOTTOM_SCROLL_MS } from "../web/src/views/Chat.tsx";

test("back-to-bottom scrolls over 0.8s with non-linear easing", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalPerformance = globalThis.performance;
  const frames: FrameRequestCallback[] = [];
  let now = 0;
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
  });
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: { now: () => now },
  });

  try {
    const el = { scrollTop: 100, scrollHeight: 1100 };
    let done = false;
    animateBackToBottom(el, () => { done = true; });

    assert.equal(BACK_TO_BOTTOM_SCROLL_MS, 800);
    assert.equal(frames.length, 1);

    now = BACK_TO_BOTTOM_SCROLL_MS / 2;
    frames.shift()!(now);
    assert.ok(el.scrollTop > 600, "halfway through time should move more than a linear half because easing is non-linear");
    assert.ok(el.scrollTop < 1100, "halfway through time should not jump to the end");
    assert.equal(done, false);

    now = BACK_TO_BOTTOM_SCROLL_MS;
    frames.shift()!(now);
    assert.equal(el.scrollTop, 1100);
    assert.equal(done, true);
  } finally {
    Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: originalRaf });
    Object.defineProperty(globalThis, "performance", { configurable: true, value: originalPerformance });
  }
});
