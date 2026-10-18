"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { hash } = require("./payload.cjs"),
  dir = path.join(__dirname, "vendor"),
  source = JSON.parse(fs.readFileSync(path.join(dir, "SOURCE.json"), "utf8"));
for (const [name, expected] of Object.entries(source.files))
  assert.equal(
    hash(fs.readFileSync(path.join(dir, name))),
    expected,
    name + " upstream hash mismatch",
  );
assert.match(fs.readFileSync(path.join(dir, "LICENSE"), "utf8"), /MIT License/);
const vendor = require("./vendor/workbuddy.cjs");
assert.equal(typeof vendor.connectWorkbuddyBroker, "function");
assert.equal(typeof vendor.loadWorkbuddyModelConfig, "function");
console.log(
  JSON.stringify({
    ok: true,
    repository: source.repository,
    commit: source.commit,
    source_files: Object.keys(source.files).length,
  }),
);
