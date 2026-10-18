"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
const ROOTS = [
  "SKILL.md",
  "README.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "SECURITY.md",
  "package.json",
  "agents",
  "scripts",
  "references",
  "examples",
  "docs",
  "tests",
];
function files(root = ROOT) {
  const result = [];
  function walk(rel) {
    const full = path.join(root, rel),
      stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Error("Payload symlinks are not allowed");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort())
        walk(path.join(rel, name));
    } else if (stat.isFile()) result.push(rel.replace(/\\/g, "/"));
    else throw Error("Invalid payload entry");
  }
  for (const rel of ROOTS) if (fs.existsSync(path.join(root, rel))) walk(rel);
  return result.sort();
}
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
module.exports = { ROOT, files, hash };
