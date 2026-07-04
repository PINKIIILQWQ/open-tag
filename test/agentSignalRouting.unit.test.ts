import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string): string {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("daemon agent activity detail is forwarded to socket clients", () => {
  const wsSrc = read("../src/server/ws.ts");
  const socketSrc = read("../src/server/socketio.ts");

  assert.match(wsSrc, /detail:\s*msg\.detail \?\? ""/, "daemon activity detail should survive the server realtime publish");
  assert.match(socketSrc, /detail:\s*event\.detail \?\? ""/, "socket.io agent:activity should include the detail field");
});

test("composer treats missing runtime on an online machine as unreachable", () => {
  const src = read("../web/src/views/Composer.tsx");

  assert.match(src, /machine\?\.status !== "online"/, "composer should still flag offline machines");
  assert.match(src, /!\(machine\.runtimes \?\? \[\]\)\.includes\(a\.runtime\)/, "composer should flag agents whose runtime is not advertised by their online machine");
});

test("global agent activity events do not overwrite the channel subtitle", () => {
  const src = read("../web/src/views/Chat.tsx");

  assert.doesNotMatch(src, /e\.type === "agent"\)[\s\S]{0,140}setSub/, "channel subtitle should stay channel-owned, not server-wide agent activity");
});
