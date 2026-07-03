import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildHermesArgs, buildHermesPrompt, hermesProfile, hermesProfileHome, hermesRuntimeEnv, parseHermesSessionId } from "./hermesRuntime.js";
import { discoverHermesProfilesFromRoots } from "./listModels.js";

test("Hermes profile comes from runtimeConfig first, then model, then default", () => {
  assert.equal(hermesProfile("codex", { profile: "alpha-helper" }), "alpha-helper");
  assert.equal(hermesProfile("gemini", {}), "gemini");
  assert.equal(hermesProfile("default", {}), "default");
  assert.equal(hermesProfile(undefined, null), "default");
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

test("Hermes profile discovery reads profile dirs with default first, then alphabetical", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-"));
  try {
    mkdirSync(path.join(root, "zeta-helper"));
    writeFileSync(path.join(root, "zeta-helper", "SOUL.md"), "# Zeta\n");
    mkdirSync(path.join(root, "alpha-helper"));
    writeFileSync(path.join(root, "alpha-helper", "profile.yaml"), "display_name: Alpha Profile\n");
    mkdirSync(path.join(root, "misc-helper"));
    writeFileSync(path.join(root, "misc-helper", "config.yaml"), "name: Misc Helper\n");
    mkdirSync(path.join(root, "not-a-profile"));

    const profiles = discoverHermesProfilesFromRoots([root]);
    assert.deepEqual(profiles.map((p) => p.id), ["default", "alpha-helper", "misc-helper", "zeta-helper"]);
    assert.equal(profiles[0]?.label, "Default profile");
    assert.equal(profiles[0]?.default, true);
    assert.equal(profiles[1]?.label, "Alpha Profile");
    assert.equal(profiles[2]?.label, "Misc Helper");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Hermes profile home resolves named profiles without changing global defaults", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-home-"));
  try {
    mkdirSync(path.join(root, ".hermes", "profiles", "alpha-helper"), { recursive: true });
    assert.equal(hermesProfileHome("alpha-helper", root), path.join(root, ".hermes", "profiles", "alpha-helper"));
    assert.equal(hermesProfileHome("missing", root), null);
    assert.equal(hermesProfileHome("default", root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Hermes runtime default profile clears inherited profile env", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-env-"));
  try {
    const inheritedHome = path.join(root, "old-home");
    const { env, profile } = hermesRuntimeEnv({ HERMES_HOME: inheritedHome, HERMES_PROFILE: "old-profile" }, root, "default", root);
    assert.equal(profile, "default");
    assert.equal(env.HERMES_HOME, undefined);
    assert.equal(env.HERMES_PROFILE, undefined);
    assert.equal(env.PWD, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Hermes runtime resolves profiles from HERMES_PROFILE_DIR as well as ~/.hermes/profiles", () => {
  const root = mkdtempSync(path.join(tmpdir(), "open-tag-hermes-profile-dir-"));
  try {
    const customProfiles = path.join(root, "custom-profiles");
    mkdirSync(path.join(customProfiles, "custom-helper"), { recursive: true });
    const { env, profile } = hermesRuntimeEnv({ HERMES_PROFILE_DIR: customProfiles }, root, "custom-helper", root);
    assert.equal(profile, "custom-helper");
    assert.equal(env.HERMES_HOME, path.join(customProfiles, "custom-helper"));
    assert.equal(env.HERMES_PROFILE, "custom-helper");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
