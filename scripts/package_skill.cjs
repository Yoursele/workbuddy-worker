"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { ROOT, files, hash } = require("./payload.cjs");
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function build() {
  const parts = [],
    central = [];
  let offset = 0;
  for (const rel of files()) {
    const name = Buffer.from(rel),
      bytes = fs.readFileSync(path.join(ROOT, rel)),
      crc = crc32(bytes),
      h = Buffer.alloc(30),
      c = Buffer.alloc(46);
    if (bytes.length > 16 * 1024 * 1024)
      throw Error("Unexpectedly large source file");
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x800, 6);
    h.writeUInt16LE(0x5c21, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(bytes.length, 18);
    h.writeUInt32LE(bytes.length, 22);
    h.writeUInt16LE(name.length, 26);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x800, 8);
    c.writeUInt16LE(0x5c21, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(bytes.length, 20);
    c.writeUInt32LE(bytes.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    parts.push(h, name, bytes);
    central.push(c, name);
    offset += h.length + name.length + bytes.length;
  }
  const cd = Buffer.concat(central),
    end = Buffer.alloc(22),
    count = files().length;
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
function write() {
  const version = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ).version,
    dist = path.join(ROOT, "dist");
  fs.mkdirSync(dist, { recursive: true });
  const filename = "workbuddy-worker-" + version + ".zip",
    bytes = build();
  fs.writeFileSync(path.join(dist, filename), bytes);
  fs.writeFileSync(
    path.join(dist, "SHA256SUMS"),
    hash(bytes) + "  " + filename + "\n",
  );
  return {
    filename,
    bytes: bytes.length,
    sha256: hash(bytes),
    files: files().length,
  };
}
module.exports = { build, crc32, write };
if (require.main === module) console.log(JSON.stringify(write()));
