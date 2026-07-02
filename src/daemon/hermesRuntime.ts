// Hermes runtime: one-shot `hermes chat -q <prompt> -Q --source open-tag` per turn.
//
// Hermes owns provider credentials and profile configuration. OpenTag only selects a Hermes profile
// (temporarily stored in agent.model) and passes the OpenTag system prompt + message into an isolated
// agent workspace. This keeps secrets in Hermes/AgentKB config, not in the OpenTag database.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Runtime, StartOpts, RuntimeCallbacks, RuntimeSession } from "./runtime.js";

const MAX = 4000;
const clip = (s: unknown) => String(s ?? "").slice(0, MAX);

export function hermesProfile(model: string | undefined, runtimeConfig: Record<string, unknown> | null | undefined): string {
  const configured = runtimeConfig?.profile;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  if (model && model !== "default") return model;
  return "codex-spark";
}

export function buildHermesPrompt(message: string, opts: Pick<StartOpts, "cwd" | "systemPrompt">): string {
  return [
    "[OpenTag runtime context]",
    `You are running as an OpenTag agent in this isolated workspace: ${opts.cwd}`,
    "Follow this OpenTag system prompt for collaboration, @mentions, and reporting:",
    opts.systemPrompt,
    "",
    "[OpenTag message]",
    message,
  ].join("\n");
}

export function buildHermesArgs(prompt: string, sessionId?: string | null): string[] {
  const args = ["chat", "-q", prompt, "-Q", "--source", "open-tag"];
  if (sessionId) args.push("--resume", sessionId);
  return args;
}

export function parseHermesSessionId(stderr: string): string | null {
  const matches = [...stderr.matchAll(/^session_id:\s*(\S+)\s*$/gm)];
  return matches.length ? matches[matches.length - 1]![1]! : null;
}

function isMissingHermesSession(stderr: string): boolean {
  return /Session not found:/i.test(stderr);
}

export function hermesProfileHome(profile: string, home = homedir()): string | null {
  if (!profile || profile === "default") return null;
  const dir = path.join(home, ".hermes", "profiles", profile);
  return existsSync(dir) ? dir : null;
}

class HermesRun {
  private queue: string[] = [];
  private turnBusy = false;
  private stopped = false;
  private proc: ChildProcess | null = null;
  private everSucceeded = false;
  private readonly env: NodeJS.ProcessEnv;
  private readonly profile: string;
  private sessionId: string | null;

  constructor(private readonly opts: StartOpts, private readonly cb: RuntimeCallbacks) {
    this.env = { ...opts.env, PWD: opts.cwd };
    delete this.env.NODE_OPTIONS;
    this.profile = hermesProfile(opts.model, opts.runtimeConfig);
    const profileHome = hermesProfileHome(this.profile);
    if (profileHome) {
      this.env.HERMES_HOME = profileHome;
      this.env.HERMES_PROFILE = this.profile;
    }
    this.sessionId = opts.sessionId ?? null;
    if (this.sessionId) cb.onSession(this.sessionId);
    if (opts.initialPrompt.trim()) this.enqueue(opts.initialPrompt);
  }

  enqueue(text: string): void {
    if (this.stopped || !text.trim()) return;
    this.queue.push(text);
    this.pump();
  }

  private pump(): void {
    if (this.stopped || this.turnBusy || this.queue.length === 0) return;
    this.runTurn(this.queue.shift()!);
  }

  private runTurn(message: string): void {
    this.turnBusy = true;
    this.cb.onActivity("working", `hermes/${this.profile}`);
    const prompt = buildHermesPrompt(message, this.opts);
    const args = buildHermesArgs(prompt, this.sessionId);
    const proc = spawn("hermes", args, { cwd: this.opts.cwd, stdio: ["ignore", "pipe", "pipe"], env: this.env });
    this.proc = proc;
    let stdout = "";
    const errTail: string[] = [];
    let errLen = 0;
    proc.stdout?.on("data", (c: Buffer) => {
      if (this.stopped) return;
      if (stdout.length < MAX) stdout += c.toString();
    });
    proc.stderr?.on("data", (c: Buffer) => {
      const t = c.toString();
      errTail.push(t);
      errLen += t.length;
      while (errLen > 16_384 && errTail.length > 1) errLen -= errTail.shift()!.length;
    });
    proc.on("error", (e) => {
      this.proc = null;
      this.turnBusy = false;
      if (this.stopped) return;
      this.cb.log.error("hermes spawn failed", { detail: String((e as any)?.message ?? e) });
      this.cb.onActivity("offline", "hermes not found");
      if (!this.everSucceeded) this.cb.onExit(1);
      else this.pump();
    });
    proc.on("exit", (code) => {
      this.proc = null;
      if (this.stopped) return;
      const out = stdout.trim();
      const tail = errTail.join("").trim();
      if (code === 0) {
        this.everSucceeded = true;
        const nextSessionId = parseHermesSessionId(tail);
        if (nextSessionId && nextSessionId !== this.sessionId) {
          this.sessionId = nextSessionId;
          this.cb.onSession(nextSessionId);
        }
        if (out) this.cb.onTrajectory([{ kind: "text", text: clip(out) }]);
        this.cb.onActivity("online", "");
        this.turnBusy = false;
        this.pump();
        return;
      }
      if (this.sessionId && isMissingHermesSession(tail)) {
        this.cb.log.warn("hermes resume session missing; retrying fresh", { sessionId: this.sessionId });
        this.sessionId = null;
        this.cb.onSession(null);
        this.queue.unshift(message);
        this.turnBusy = false;
        this.pump();
        return;
      }
      const last = tail.split("\n").filter(Boolean).pop() || `hermes exited ${code ?? "signal"}`;
      this.cb.onTrajectory([{ kind: "text", text: "[hermes error] " + clip(tail || last).slice(0, 800) }]);
      this.cb.onActivity("error", last.slice(0, 200));
      this.turnBusy = false;
      if (!this.everSucceeded) {
        this.cb.onExit(code ?? 1);
        return;
      }
      this.pump();
    });
  }

  stop(): void {
    this.stopped = true;
    const p = this.proc;
    this.proc = null;
    if (p) {
      try { p.kill("SIGTERM"); } catch { /* */ }
    }
  }
}

export const hermesRuntime: Runtime = {
  name: "hermes",
  experimental: true,
  start(opts: StartOpts, cb: RuntimeCallbacks): RuntimeSession {
    const run = new HermesRun(opts, cb);
    return { deliver: (text) => run.enqueue(text), stop: () => run.stop() };
  },
};
