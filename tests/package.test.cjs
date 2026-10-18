"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { install } = require("../scripts/install.cjs"),
  { build, crc32 } = require("../scripts/package_skill.cjs"),
  { files } = require("../scripts/payload.cjs");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "wb-release-test-"));
process.on("exit", () => {
  if (
    !path.isAbsolute(temporary) ||
    !path.basename(temporary).startsWith("wb-release-test-")
  )
    throw Error("Unsafe cleanup target");
  fs.rmSync(temporary, { recursive: true, force: true });
});
test("payload excludes local jobs, Git and caches", () => {
  const f = files();
  assert.ok(f.includes("SKILL.md"));
  assert.ok(f.includes("scripts/vendor/LICENSE"));
  assert.equal(
    f.some(
      (x) =>
        x.includes("workbuddy-jobs") ||
        x.startsWith(".git/") ||
        x.startsWith("dist/"),
    ),
    false,
  );
});
test("install copies a complete skill and reuses identical content", () => {
  const dest = path.join(temporary, "installed");
  assert.equal(install(dest).reused, false);
  assert.equal(install(dest).reused, true);
  assert.ok(fs.existsSync(path.join(dest, "scripts/vendor/workbuddy.cjs")));
});
test("install refuses modified destination without overwrite", () => {
  const dest = path.join(temporary, "modified");
  install(dest);
  const p = path.join(dest, "SKILL.md");
  fs.writeFileSync(p, "keep me");
  assert.throws(() => install(dest));
  assert.equal(fs.readFileSync(p, "utf8"), "keep me");
});
test("ZIP is deterministic with valid headers and CRC", () => {
  const a = build(),
    b = build();
  assert.ok(a.equals(b));
  assert.equal(a.readUInt32LE(0), 0x04034b50);
  assert.equal(a.readUInt32LE(a.length - 22), 0x06054b50);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});
test("public files have no personal machine paths or runtime credentials", () => {
  for (const rel of files()) {
    const text = fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    assert.doesNotMatch(
      text,
      /C:[\\/]Users[\\/]\d{3,}[\\/]|acheck\.vip|47\.103\.126\.206/,
      rel,
    );
    assert.doesNotMatch(
      text,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/]{20}/,
      rel,
    );
  }
});
