"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const { ROOT, files, hash } = require("./payload.cjs");
function install(destination) {
  const target = path.resolve(destination),
    parent = path.dirname(target),
    entries = files();
  if (target === ROOT || target.startsWith(ROOT + path.sep))
    throw Error("Cannot install inside source");
  if (fs.existsSync(target)) {
    if (
      fs.lstatSync(target).isSymbolicLink() ||
      !fs.statSync(target).isDirectory()
    )
      throw Error("Destination is not a normal directory");
    const identical = entries.every((rel) => {
      try {
        const p = path.join(target, rel);
        return (
          !fs.lstatSync(p).isSymbolicLink() &&
          hash(fs.readFileSync(p)) ===
            hash(fs.readFileSync(path.join(ROOT, rel)))
        );
      } catch {
        return false;
      }
    });
    if (!identical)
      throw Error(
        "Destination exists with different content; no files overwritten",
      );
    return {
      installed: true,
      reused: true,
      destination: target,
      files: entries.length,
    };
  }
  fs.mkdirSync(parent, { recursive: true });
  const stage = path.join(
    parent,
    ".workbuddy-worker-install-" + crypto.randomUUID(),
  );
  fs.mkdirSync(stage);
  try {
    for (const rel of entries) {
      const p = path.join(stage, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.copyFileSync(path.join(ROOT, rel), p, fs.constants.COPYFILE_EXCL);
    }
    fs.renameSync(stage, target);
  } finally {
    if (fs.existsSync(stage)) {
      if (
        path.dirname(path.resolve(stage)) !== path.resolve(parent) ||
        !path.basename(stage).startsWith(".workbuddy-worker-install-")
      )
        throw Error("Invalid staging cleanup path");
      fs.rmSync(stage, { recursive: true, force: false });
    }
  }
  return {
    installed: true,
    reused: false,
    destination: target,
    files: entries.length,
  };
}
module.exports = { install };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === "--dest"))
    throw Error("Usage: node scripts/install.cjs [--dest destination]");
  const destination =
    args[1] ||
    path.join(
      process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
      "skills",
      "workbuddy-worker",
    );
  try {
    console.log(JSON.stringify(install(destination)));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
