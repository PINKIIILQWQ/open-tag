import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildHermesArgs, buildHermesPrompt, hermesProfile, hermesProfileHome, parseHermesSessionId } from "./hermesRuntime.js";
import { discoverHermesProfilesFromRoots } from "./listModels.js";

test("Hermes profile comes from runtimeConfig first, then model, then codex-spark", () => {
  assert.equal(hermesProfile("codex", { profile: "qoder" }), "qoder");
  assert.equal(hermesProfile("gemini", {}), "gemini");
  assert.equal(hermesProfile("default", {}), "codex-spark");
  assert.equal(hermesProfile(undefined, null), "codex-spark");
});

test("Hermes CLI args use quiet chat mode for OpenTag", () => {
  assert.deepEqual(buildHermesArgs("hello"), ["chat", "-q", "hello", "-Q", "--source", "open-tag"]);
});

test("Hermes CLI args resume the captured native Hermes session", () => {
  assert.deepEqual(buildHermesArgs("hello", "20260702_221211_1991f1"), ["chat", "-q", "hello", "-Q", "--source", "open-tag", "--resume", "20260702_221211_1991f1"]);
});

test("Hermes session id is parsed from quiet stderr", () => {
  assert.equal(parseHermesSessionId("noise\nsession_id: 20260702_221211_1991f1\n"), "20260702_221211_1991f1");
  assert.equal(parseHermesSessionId("session_id: old\nmore\nsession_id: new"), "new");
  assert.equal(parseHermesSessionId("Session not found: missing"), null);
});

test("Hermes prompt carries OpenTag system prompt, cwd, and user message", () => {
  const prompt = buildHermesPrompt("please help", { cwd: "/tmp/open-tag-agent", systemPrompt: "use open-tag cli" });
  assert.match(prompt, /isolated workspace: \/tmp\/open-tag-agent/);
  assert.match(prompt, /use open-tag cli/);
  assert.match(prompt, /please help/);
});

test("Hermes profile discovery reads profile dirs and prioritizes common profiles", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-"));
  try {
    mkdirSync(path.join(root, "qoder"));
    writeFileSync(path.join(root, "qoder", "SOUL.md"), "# Qoder\n");
    mkdirSync(path.join(root, "codex-spark"));
    writeFileSync(path.join(root, "codex-spark", "profile.yaml"), "display_name: Spark Profile\n");
    mkdirSync(path.join(root, "misc-helper"));
    writeFileSync(path.join(root, "misc-helper", "config.yaml"), "name: Misc Helper\n");
    mkdirSync(path.join(root, "not-a-profile"));

    const profiles = discoverHermesProfilesFromRoots([root]);
    assert.deepEqual(profiles.map((p) => p.id), ["codex-spark", "qoder", "misc-helper"]);
    assert.equal(profiles[0]?.label, "Spark Profile");
    assert.equal(profiles[0]?.default, true);
    assert.equal(profiles[2]?.label, "Misc Helper");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Hermes profile home resolves named profiles without changing global defaults", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-home-"));
  try {
    mkdirSync(path.join(root, ".hermes", "profiles", "codex-spark"), { recursive: true });
    assert.equal(hermesProfileHome("codex-spark", root), path.join(root, ".hermes", "profiles", "codex-spark"));
    assert.equal(hermesProfileHome("missing", root), null);
    assert.equal(hermesProfileHome("default", root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
