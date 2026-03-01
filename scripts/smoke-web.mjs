#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDir, "..");
const artifactRoot = join(repoRoot, "output", "playwright");
const playwrightOutputDir = join(repoRoot, ".playwright-cli");

const smokeUrl = process.env.SMOKE_WEB_URL ?? "http://127.0.0.1:4173";
const smokeSession = process.env.PLAYWRIGHT_CLI_SESSION ?? "fd-smoke";
const isWindows = process.platform === "win32";
const pnpmCmd = "pnpm";
const parsedSmokeUrl = new URL(smokeUrl);
const smokeHost = parsedSmokeUrl.hostname || "127.0.0.1";
const smokePort = parsedSmokeUrl.port || "4173";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function createRunDir() {
  mkdirSync(artifactRoot, { recursive: true });
  const runDir = join(artifactRoot, timestamp());
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

function escapeForCmd(rawArg) {
  const arg = String(rawArg);
  if (!/[\s"&|<>^]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/(["^])/g, "^$1")}"`;
}

function buildSpawnSpec(command, args, shell) {
  if (isWindows && command === "pnpm") {
    const commandLine = ["pnpm", ...args].map(escapeForCmd).join(" ");
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", commandLine],
      shell: false
    };
  }

  return { command, args, shell };
}

function spawnChild(command, args, options = {}) {
  const { cwd = repoRoot, stdio = "inherit", shell = false } = options;
  const spec = buildSpawnSpec(command, args, shell);
  return spawn(spec.command, spec.args, { cwd, stdio, shell: spec.shell });
}

function spawnCommand(command, args, options = {}) {
  const { cwd = repoRoot, stdio = "inherit", shell = false } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnChild(command, args, { cwd, stdio, shell });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      resolvePromise({
        code: code ?? 1,
        stdout,
        stderr,
        pid: child.pid ?? -1
      });
    });
  });
}

async function runOrThrow(command, args, options = {}) {
  const result = await spawnCommand(command, args, options);
  if (result.code !== 0) {
    throw new Error(`命令失败: ${command} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result;
}

async function ensurePlaywrightCliInstalled() {
  const versionResult = await spawnCommand(pnpmCmd, ["exec", "playwright-cli", "--version"], {
    stdio: "pipe"
  });

  if (versionResult.code === 0) {
    process.stdout.write(`[smoke:web] playwright-cli 已可用: ${versionResult.stdout.trim()}\n`);
    return;
  }

  process.stdout.write("[smoke:web] 未检测到 playwright-cli，正在自动安装 @playwright/cli...\n");
  await runOrThrow(pnpmCmd, ["add", "-Dw", "@playwright/cli"]);

  const verifyResult = await runOrThrow(pnpmCmd, ["exec", "playwright-cli", "--version"], {
    stdio: "pipe"
  });

  process.stdout.write(`[smoke:web] playwright-cli 安装完成: ${verifyResult.stdout.trim()}\n`);
}

function wireServerLogs(child, runDir) {
  const outLogPath = join(runDir, "dev-server.out.log");
  const errLogPath = join(runDir, "dev-server.err.log");
  const outLog = createWriteStream(outLogPath, { flags: "a" });
  const errLog = createWriteStream(errLogPath, { flags: "a" });

  child.stdout?.pipe(outLog);
  child.stderr?.pipe(errLog);

  return {
    outLogPath,
    errLogPath,
    close: () => {
      outLog.end();
      errLog.end();
    }
  };
}

async function waitForHttpReady(url, timeoutMs = 90000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(url, { signal: controller.signal });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // 启动过程中请求失败是预期行为，继续重试。
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    await sleep(500);
  }

  throw new Error(`开发服务器未在 ${timeoutMs}ms 内就绪: ${url}`);
}

async function closePlaywrightSession() {
  await spawnCommand(pnpmCmd, ["exec", "playwright-cli", `-s=${smokeSession}`, "close"]);
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  if (isWindows) {
    await spawnCommand("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"], {
      stdio: "pipe"
    });
    return;
  }

  serverProcess.kill("SIGTERM");
  await sleep(300);
  if (serverProcess.exitCode === null) {
    serverProcess.kill("SIGKILL");
  }
}

function archivePlaywrightArtifacts(runDir) {
  if (!existsSync(playwrightOutputDir)) {
    return null;
  }

  const destination = join(runDir, ".playwright-cli");
  renameSync(playwrightOutputDir, destination);
  return destination;
}

async function runSmokeFlow() {
  const runDir = createRunDir();
  process.stdout.write(`[smoke:web] 本次产物目录: ${runDir}\n`);

  await ensurePlaywrightCliInstalled();

  const serverProcess = spawnChild(
    pnpmCmd,
    ["--filter", "@fd/web-client", "dev", "--host", smokeHost, "--port", smokePort],
    { cwd: repoRoot, stdio: "pipe", shell: false }
  );

  const logs = wireServerLogs(serverProcess, runDir);
  process.stdout.write("[smoke:web] 正在等待 web-client 开发服务器启动...\n");

  try {
    await waitForHttpReady(smokeUrl);
    process.stdout.write(`[smoke:web] 服务器就绪: ${smokeUrl}\n`);

    const steps = [
      ["open", smokeUrl],
      ["eval", "document.title"],
      ["snapshot"],
      ["keydown", "w"],
      ["keyup", "w"],
      ["press", "ArrowDown"],
      ["press", "Enter"],
      ["press", "Escape"],
      ["mousedown", "right"],
      ["mouseup", "right"],
      ["press", "Escape"],
      ["press", "ArrowUp"],
      ["press", "ArrowLeft"],
      ["press", "ArrowRight"],
      ["snapshot"],
      ["screenshot"],
      ["console", "warning"],
      ["network"]
    ];

    for (const step of steps) {
      await runOrThrow(pnpmCmd, ["exec", "playwright-cli", `-s=${smokeSession}`, ...step]);
    }

    const archived = archivePlaywrightArtifacts(runDir);
    if (archived) {
      process.stdout.write(`[smoke:web] Playwright 产物已归档: ${archived}\n`);
    }

    process.stdout.write(`[smoke:web] 完成，服务器日志: ${logs.outLogPath}\n`);
  } finally {
    await closePlaywrightSession();
    await stopServer(serverProcess);
    logs.close();
  }
}

runSmokeFlow().catch((error) => {
  process.stderr.write(`[smoke:web] 执行失败: ${error.message}\n`);
  process.exitCode = 1;
});
