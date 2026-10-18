"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { connectDesktop, launchDesktop } = require("../scripts/desktop_startup.cjs");
const runtime = { config: "unused", desktop: "unused" };
const failure = (code) => Object.assign(new Error(code), { code });
const broker = { dispose() {} };
const instant = { platform: "win32", sleep: async () => {} };
test("ready desktop is reused without process check or launch", async () => {
  const r = await connectDesktop(runtime, async () => broker, undefined, {
    ...instant, isRunning: () => assert.fail(), launch: () => assert.fail(),
  });
  assert.equal(r.broker, broker); assert.equal(r.desktop_started, false);
});
test("installed stopped desktop launches once then waits for proxy", async () => {
  let calls = 0, launches = 0;
  const r = await connectDesktop(runtime, async () => {
    if (++calls < 3) throw failure("E_DISCOVERY_MISSING"); return broker;
  }, undefined, { ...instant, isRunning: async () => false, launch: async () => launches++ });
  assert.equal(launches, 1); assert.equal(calls, 3); assert.equal(r.desktop_started, true);
});
test("already running but initializing desktop is not launched again", async () => {
  let calls = 0;
  const r = await connectDesktop(runtime, async () => {
    if (++calls < 2) throw failure("E_SOCKET_UNAVAILABLE"); return broker;
  }, undefined, { ...instant, isRunning: async () => true, launch: () => assert.fail() });
  assert.equal(r.desktop_started, false);
});
for (const code of ["E_ENDPOINT_UNTRUSTED", "E_POLICY_DENIED", "E_TICKET_INVALID", "E_PROTOCOL_ERROR", "E_CONSENT_REQUIRED"]) {
  test("does not relaunch on " + code, async () => {
    await assert.rejects(connectDesktop(runtime, async () => { throw failure(code); }, undefined,
      { ...instant, isRunning: () => assert.fail(), launch: () => assert.fail() }), { code });
  });
}
test("startup wait has finite budget", async () => {
  await assert.rejects(connectDesktop(runtime, async () => { throw failure("E_DISCOVERY_MISSING"); }, undefined,
    { platform: "win32", timeoutMs: 30, isRunning: async () => true }), { code: "WORKBUDDY_START_TIMEOUT" });
});
test("aborted task does not launch desktop", async () => {
  const c = new AbortController(); c.abort();
  await assert.rejects(connectDesktop(runtime, () => assert.fail(), c.signal,
    { ...instant, launch: () => assert.fail() }), { code: "E_CANCELLED" });
});
test("launch failure is surfaced without infinite retry", async () => {
  await assert.rejects(connectDesktop(runtime, async () => { throw failure("E_DISCOVERY_MISSING"); }, undefined,
    { ...instant, isRunning: async () => false, launch: async () => { throw failure("WORKBUDDY_START_FAILED"); } }),
    { code: "WORKBUDDY_START_FAILED" });
});
test("process check failure does not blindly launch", async () => {
  await assert.rejects(connectDesktop(runtime, async () => { throw failure("E_DISCOVERY_MISSING"); }, undefined,
    { ...instant, isRunning: async () => { throw failure("WORKBUDDY_PROCESS_CHECK_FAILED"); }, launch: () => assert.fail() }),
    { code: "WORKBUDDY_PROCESS_CHECK_FAILED" });
});
test("does not launch missing or relative executable", async () => {
  await assert.rejects(launchDesktop("relative.exe", new AbortController().signal), { code: "WORKBUDDY_DESKTOP_NOT_FOUND" });
});
test("non-Windows fails before attempting connection", async () => {
  await assert.rejects(connectDesktop(runtime, () => assert.fail(), undefined, { platform: "linux" }), { code: "WINDOWS_REQUIRED" });
});
