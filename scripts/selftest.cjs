"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const w = require("./workbuddy_worker.cjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-worker-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
fs.writeFileSync(path.join(dir, "example.txt"), "alpha\n中文\nbeta");
test("显式文本任务生成稳定输入指纹", () => {
  const p = w.prepare({
    cwd: dir,
    task: "count lines",
    files: ["example.txt"],
  });
  assert.equal(p.inputs.length, 1);
  assert.equal(p.inputs[0].sha256.length, 64);
  assert.match(p.prompt, /中文/);
  assert.equal(p.model, "deepseek-v4.1-flash");
});
for (const rel of [
  "../outside.txt",
  "C:/absolute.txt",
  ".env",
  ".git/config",
  "api.key",
  "credentials.json",
  "data.sqlite",
  "a/../../b",
])
  test("拒绝路径 " + rel, () => assert.throws(() => w.safeSource(dir, rel)));
test("拒绝大文件", () => {
  fs.writeFileSync(path.join(dir, "large.txt"), "x".repeat(250 * 1024));
  assert.throws(() => w.safeSource(dir, "large.txt"));
});
test("拒绝二进制", () => {
  fs.writeFileSync(path.join(dir, "binary.txt"), Buffer.from([1, 0, 2]));
  assert.throws(() => w.safeSource(dir, "binary.txt"));
});
test("拒绝私钥内容", () => {
  fs.writeFileSync(path.join(dir, "plain.txt"), "-----BEGIN PRIVATE KEY-----");
  assert.throws(() => w.safeSource(dir, "plain.txt"));
});
test("拒绝任务缺失与过长", () => {
  assert.throws(() => w.prepare({ cwd: dir, task: "" }));
  assert.throws(() => w.prepare({ cwd: dir, task: "a".repeat(30001) }));
});
test("拒绝自动模型及无界超时", () => {
  assert.throws(() => w.prepare({ cwd: dir, task: "x", model: "auto" }));
  assert.throws(() => w.prepare({ cwd: dir, task: "x", timeout_seconds: 901 }));
});
test("退出0但error结果仍失败", () =>
  assert.equal(
    w.evaluate(
      [{ type: "result", subtype: "error_during_execution", is_error: true }],
      0,
    ).ok,
    false,
  ));
test("退出0但没有终态结果为uncertain", () =>
  assert.equal(
    w.evaluate(
      [
        {
          type: "assistant",
          message: { content: [{ type: "text", text: "partial" }] },
        },
      ],
      0,
    ).uncertain,
    true,
  ));
test("空成功结果不算完成", () =>
  assert.equal(
    w.evaluate([{ type: "result", subtype: "success", result: "" }], 0).ok,
    false,
  ));
test("成功结果保留文本与会话ID", () => {
  const v = w.evaluate(
    [
      {
        type: "result",
        subtype: "success",
        result: "hello",
        session_id: "abc",
      },
    ],
    0,
  );
  assert.equal(v.ok, true);
  assert.equal(v.text, "hello");
  assert.equal(v.session_id, "abc");
});
test("非零退出不算成功", () =>
  assert.equal(
    w.evaluate([{ type: "result", subtype: "success", result: "hello" }], 1).ok,
    false,
  ));
test("网关剥离全部工具定义", () => {
  const d = JSON.parse(
    w.textOnlyRequest(
      JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        tools: [{}],
        tool_choice: "auto",
        functions: [{}],
        function_call: "auto",
        parallel_tool_calls: true,
      }),
      "m",
    ),
  );
  for (const k of [
    "tools",
    "tool_choice",
    "functions",
    "function_call",
    "parallel_tool_calls",
  ])
    assert.equal(k in d, false);
});
test("拒绝模型替换", () =>
  assert.throws(() =>
    w.textOnlyRequest('{"model":"other","messages":[]}', "m"),
  ));
test("拒绝工具历史", () =>
  assert.throws(() =>
    w.textOnlyRequest('{"model":"m","messages":[{"role":"tool"}]}', "m"),
  ));
test("阻止非流式工具响应", () =>
  assert.throws(() =>
    w.safeModelResponse(
      Buffer.from(
        '{"choices":[{"message":{"tool_calls":[{"function":{"name":"Read"}}]}}]}',
      ),
    ),
  ));
test("阻止流式工具响应", () =>
  assert.throws(() =>
    w.safeModelResponse(
      Buffer.from(
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"arguments":"x"}}]}}]}\n\ndata: [DONE]\n',
      ),
    ),
  ));
test("允许协议空工具占位", () =>
  assert.ok(
    w.safeModelResponse(
      Buffer.from(
        '{"choices":[{"delta":{"function_call":{"name":"","arguments":""},"tool_calls":[]}}]}',
      ),
    ),
  ));
test("允许正常文本响应", () =>
  assert.ok(
    w.safeModelResponse(
      Buffer.from(
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n',
      ),
    ),
  ));
test("拒绝无法解析响应", () =>
  assert.throws(() => w.safeModelResponse(Buffer.from("not-json"))));
test("清除继承密钥环境", () => {
  process.env.WB_TEST_SECRET = "test";
  process.env.OPENAI_API_KEY = "test";
  const env = w.cleanEnv();
  assert.equal(env.WB_TEST_SECRET, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  delete process.env.WB_TEST_SECRET;
  delete process.env.OPENAI_API_KEY;
});
test("纯文本消息不携带内置工具提示词", () => {
  const d = JSON.parse(
    w.textOnlyRequest(
      '{"model":"m","messages":[{"role":"system","content":"use internal tool"}]}',
      "m",
      "TASK",
    ),
  );
  assert.equal(d.messages[1].content, "TASK");
  assert.doesNotMatch(JSON.stringify(d), /internal tool/);
});
test("工具结束标识即使空参数也拒绝", () =>
  assert.throws(() =>
    w.safeModelResponse(
      Buffer.from('{"choices":[{"finish_reason":"tool_calls"}]}'),
    ),
  ));

async function fixtureRun(cancel) {
  const id =
      "wb-offline-" + Date.now() + "-" + Math.random().toString(16).slice(2),
    job = path.join(w.ROOT, id);
  fs.mkdirSync(path.join(job, "workspace"), { recursive: true });
  const req = w.prepare({ cwd: dir, task: "offline", timeout_seconds: 5 });
  fs.writeFileSync(
    path.join(job, "request.json"),
    JSON.stringify({ ...req, request_hash: "offline" }),
  );
  fs.writeFileSync(
    path.join(job, "status.json"),
    JSON.stringify({ id, state: "queued" }),
  );
  const fake = path.join(dir, "fake_cli.cjs"),
    product = path.join(dir, "product.json");
  fs.writeFileSync(fake, "process.stdin.resume(); setInterval(()=>{},10000);");
  fs.writeFileSync(product, "{}");
  const deps = {
    locate: () => ({
      node: process.execPath,
      entry: fake,
      product,
      config: dir,
    }),
    connect: async () => ({ dispose() {} }),
    loadModels: async () => ({
      models: [],
      agents: [{ name: "cli", models: ["deepseek-v4.1-flash"] }],
    }),
  };
  try {
    const running = w.run(id, deps);
    if (cancel) {
      for (let i = 0; i < 100; i++) {
        const s = JSON.parse(
          fs.readFileSync(path.join(job, "status.json"), "utf8"),
        );
        if (s.state === "running") break;
        await new Promise((r) => setTimeout(r, 20));
      }
      await w.main(["cancel", id]);
    }
    await running;
    const result = JSON.parse(
      fs.readFileSync(path.join(job, "status.json"), "utf8"),
    );
    assert.equal(result.state, "uncertain");
    assert.equal(result.cleanup_complete, true);
    assert.equal(result.error_code, cancel ? "CANCEL_REQUESTED" : "TIMEOUT");
    assert.throws(() => process.kill(result.cli_pid, 0));
  } finally {
    assert.equal(path.dirname(job), w.ROOT);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(job, "request.json"), "utf8"))
        .request_hash,
      "offline",
    );
    fs.rmSync(job, { recursive: true, force: true });
  }
}
test("隔离CLI超时保留不确定且回收进程", () => fixtureRun(false));
test("隔离CLI取消只回收本任务进程", () => fixtureRun(true));
