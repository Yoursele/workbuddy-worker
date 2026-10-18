"use strict";
// 仅负责启动桌面宿主并等待本地代理；不读取登录数据库，不发送模型消息。
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const RETRYABLE = new Set([
  "E_DISCOVERY_MISSING", "E_SOCKET_UNAVAILABLE", "E_DISCONNECTED",
  "E_HANDSHAKE_TIMEOUT", "E_NOT_CONNECTED",
]);
function error(code) {
  return Object.assign(new Error(code), { code });
}
async function desktopRunning(signal) {
  // 固定系统工具与参数，不经过 shell，不采集其他进程命令行或环境。
  const exe = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tasklist.exe");
  return new Promise((resolve, reject) => {
    cp.execFile(exe, ["/FI", "IMAGENAME eq WorkBuddy.exe", "/FO", "CSV", "/NH"],
      { windowsHide: true, timeout: 3000, maxBuffer: 256 * 1024, signal },
      (e, stdout) => e ? reject(error("WORKBUDDY_PROCESS_CHECK_FAILED")) :
        resolve(/^"WorkBuddy\.exe",/im.test(stdout)));
  });
}
async function launchDesktop(executable, signal) {
  if (signal.aborted) throw error("E_CANCELLED");
  if (!path.isAbsolute(executable) || !fs.existsSync(executable) ||
      !fs.statSync(executable).isFile() || fs.lstatSync(executable).isSymbolicLink())
    throw error("WORKBUDDY_DESKTOP_NOT_FOUND");
  await new Promise((resolve, reject) => {
    const child = cp.spawn(executable, ["--start-minimized"], {
      cwd: path.dirname(executable), detached: true, windowsHide: true, stdio: "ignore",
    });
    child.once("error", () => reject(error("WORKBUDDY_START_FAILED")));
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}
async function connectDesktop(runtime, connect, signal, deps = {}) {
  if ((deps.platform || process.platform) !== "win32") throw error("WINDOWS_REQUIRED");
  const local = new AbortController();
  const budget = setTimeout(() => local.abort(), deps.timeoutMs || 25000);
  const combined = signal ? AbortSignal.any([signal, local.signal]) : local.signal;
  let launched = false;
  const cancelled = () => {
    if (combined.aborted) throw error(signal?.aborted ? "E_CANCELLED" : "WORKBUDDY_START_TIMEOUT");
  };
  const attempt = async () => {
    cancelled();
    // 每次握手有界，且仍受任务/启动总预算约束。
    const broker = await connect(runtime.config, AbortSignal.any([combined, AbortSignal.timeout(3000)]));
    if (combined.aborted) {
      broker.dispose();
      cancelled();
    }
    return broker;
  };
  try {
    try {
      return { broker: await attempt(), desktop_started: false };
    } catch (e) {
      cancelled();
      if (!RETRYABLE.has(e.code) && e.code !== "E_CANCELLED") throw e;
    }
    cancelled();
    const running = await (deps.isRunning || desktopRunning)(combined);
    cancelled();
    if (!running) {
      await (deps.launch || launchDesktop)(runtime.desktop, combined);
      launched = true;
    }
    while (true) {
      cancelled();
      await (deps.sleep || delay)(500, undefined, { signal: combined });
      try {
        const broker = await attempt();
        return { broker, desktop_started: launched };
      } catch (e) {
        cancelled();
        // 信任/协议/授权错误不能通过重启绕过。
        if (!RETRYABLE.has(e.code) && e.code !== "E_CANCELLED") throw e;
      }
    }
  } catch (e) {
    cancelled();
    throw e;
  } finally {
    clearTimeout(budget);
  }
}
module.exports = { connectDesktop, desktopRunning, launchDesktop };
