var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../.codex/skills/workbuddy-worker/scripts/vendor/entry.ts
var entry_exports = {};
__export(entry_exports, {
  connectWorkbuddyBroker: () => connectWorkbuddyBroker,
  loadWorkbuddyModelConfig: () => loadWorkbuddyModelConfig
});
module.exports = __toCommonJS(entry_exports);

// ../../.codex/skills/workbuddy-worker/scripts/vendor/workbuddyBroker.ts
var fs = __toESM(require("fs"));
var net = __toESM(require("net"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var import_crypto = require("crypto");
var MAX_FRAME = 1024 * 1024;
var failure = (code) => Object.assign(new Error(`WorkBuddy \u672C\u5730\u4EE3\u7406\u9519\u8BEF\uFF08${code}\uFF09`), { code });
var remoteCodes = /* @__PURE__ */ new Set([
  "E_TICKET_INVALID",
  "E_REVOKED",
  "E_ENDPOINT_UNTRUSTED",
  "E_PROTOCOL_MISMATCH",
  "E_PIPE_UNKNOWN",
  "E_METHOD_UNKNOWN",
  "E_METHOD_KIND_MISMATCH",
  "E_NOT_DECLARED",
  "E_CONSENT_REQUIRED",
  "E_NOT_CONNECTED",
  "E_POLICY_DENIED",
  "E_UPSTREAM",
  "E_BUSY",
  "E_CHANNEL_UNKNOWN",
  "E_BAD_REQUEST",
  "E_CANCELLED",
  "E_PAYLOAD_TOO_LARGE",
  "E_TIMEOUT",
  "E_INTERNAL"
]);
var hash = (value, length) => (0, import_crypto.createHash)("sha1").update(value).digest("hex").slice(0, length);
function owned(target, kind, mode) {
  const stat = fs.lstatSync(target), unix = process.platform !== "win32";
  if (stat.isSymbolicLink() || !(kind === "file" ? stat.isFile() : kind === "socket" ? stat.isSocket() : stat.isDirectory()) || unix && (process.getuid && stat.uid !== process.getuid() || mode !== void 0 && (stat.mode & 511) !== mode)) {
    throw failure("E_ENDPOINT_UNTRUSTED");
  }
  return stat;
}
function runtimeDirectory(configDir) {
  const key = hash(configDir, 12), uid = process.getuid?.();
  const writable = (dir) => {
    try {
      if (!fs.statSync(dir).isDirectory())
        return false;
      fs.accessSync(dir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  };
  if (process.platform === "linux") {
    const xdg = process.env.XDG_RUNTIME_DIR?.trim();
    if (xdg && writable(xdg))
      return path.join(xdg, "workbuddy", key);
    if (uid !== void 0 && writable(`/run/user/${uid}`))
      return path.join(`/run/user/${uid}`, "workbuddy", key);
  }
  return path.join(os.tmpdir().trim(), uid === void 0 ? "wb" : `wb-${hash(String(uid), 6)}`, key);
}
function discover(configDir) {
  let fd, raw, metadata;
  try {
    if (!path.isAbsolute(configDir))
      throw failure("E_ENDPOINT_UNTRUSTED");
    owned(configDir, "directory");
    const dir = path.join(configDir, "wbipc");
    owned(dir, "directory", 448);
    const file = path.join(dir, "endpoint.json"), before = owned(file, "file", 384);
    if (before.size < 1 || before.size > 4096)
      throw failure("E_ENDPOINT_UNTRUSTED");
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const after = fs.fstatSync(fd);
    if (!after.isFile() || after.ino !== before.ino || after.dev !== before.dev || after.size !== before.size || process.platform !== "win32" && (process.getuid && after.uid !== process.getuid() || (after.mode & 511) !== 384)) {
      throw failure("E_ENDPOINT_UNTRUSTED");
    }
    raw = fs.readFileSync(fd);
    let parsed;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {
      throw failure("E_ENDPOINT_UNTRUSTED");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw failure("E_ENDPOINT_UNTRUSTED");
    metadata = parsed;
    const endpoint = metadata.endpoint, ticket = metadata.ticket;
    if (typeof endpoint !== "string" || typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket))
      throw failure("E_ENDPOINT_UNTRUSTED");
    if (process.platform === "win32") {
      if (!/^\\\\\.\\pipe\\wbipc-[a-f0-9]+$/.test(endpoint))
        throw failure("E_ENDPOINT_UNTRUSTED");
    } else {
      const runtime = runtimeDirectory(configDir), socketDir = path.join(runtime, "wbipc");
      owned(runtime, "directory", 448);
      owned(socketDir, "directory", 448);
      if (!path.isAbsolute(endpoint) || !/^b-[a-f0-9]+\.sock$/.test(path.basename(endpoint)) || fs.realpathSync(path.dirname(endpoint)) !== fs.realpathSync(socketDir))
        throw failure("E_ENDPOINT_UNTRUSTED");
      owned(endpoint, "socket", 384);
    }
    return { endpoint, ticket: Buffer.from(ticket) };
  } catch (error) {
    if (error.code === "E_ENDPOINT_UNTRUSTED")
      throw error;
    if (["ENOENT", "ESRCH"].includes(error.code ?? ""))
      throw failure("E_DISCOVERY_MISSING");
    throw failure("E_DISCOVERY_FAILED");
  } finally {
    if (fd !== void 0)
      fs.closeSync(fd);
    raw?.fill(0);
    if (metadata)
      metadata.ticket = "";
  }
}
function proof(ticket, side, endpoint, clientNonce, serverNonce) {
  const chunks = [];
  for (const value of [side === "server" ? "wbipc-s" : "wbipc-c", "1", endpoint, clientNonce, serverNonce]) {
    const bytes = Buffer.from(value), length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    chunks.push(length, bytes);
  }
  return (0, import_crypto.createHmac)("sha256", ticket).update(Buffer.concat(chunks)).digest("base64url");
}
var BrokerConnection = class {
  constructor(endpoint, onDisconnect) {
    this.onDisconnect = onDisconnect;
    this.socket = net.createConnection(endpoint);
    this.socket.on("error", (error) => this.close(failure(!this.available && ["ECONNREFUSED", "ENOENT"].includes(error.code ?? "") ? "E_SOCKET_UNAVAILABLE" : "E_DISCONNECTED")));
    this.socket.on("close", () => this.close(failure("E_DISCONNECTED")));
    this.socket.on("data", (chunk) => {
      try {
        let start = 0;
        while (!this.closed && start < chunk.length) {
          const end = chunk.indexOf(10, start), part = chunk.subarray(start, end < 0 ? chunk.length : end);
          if (this.buffer.length + part.length > MAX_FRAME)
            throw failure("E_PAYLOAD_TOO_LARGE");
          this.buffer = Buffer.concat([this.buffer, part]);
          if (end < 0)
            break;
          const line = this.buffer;
          this.buffer = Buffer.alloc(0);
          if (line.length)
            this.receive(JSON.parse(line.toString("utf8")));
          start = end + 1;
        }
      } catch (error) {
        this.close(failure(error.code === "E_PAYLOAD_TOO_LARGE" ? "E_PAYLOAD_TOO_LARGE" : "E_PROTOCOL_ERROR"));
      }
    });
  }
  socket;
  pending = /* @__PURE__ */ new Map();
  handshakeFrames = [];
  waiter;
  buffer = Buffer.alloc(0);
  closed;
  rpcReady = false;
  available = false;
  maxInflight = 8;
  id = 0;
  settle(id, error, result) {
    const entry = this.pending.get(id);
    if (!entry)
      return;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener("abort", entry.abort);
    if (error)
      entry.reject(error);
    else
      entry.resolve(result);
  }
  close(error, notify = true) {
    if (this.closed)
      return;
    this.closed = error;
    this.waiter?.reject(error);
    this.waiter = void 0;
    for (const id of this.pending.keys())
      this.settle(id, error);
    this.handshakeFrames.length = 0;
    this.buffer.fill(0);
    this.buffer = Buffer.alloc(0);
    this.socket.destroy();
    if (notify && this.available) {
      try {
        this.onDisconnect?.(error);
      } catch {
      }
    }
  }
  dispose() {
    this.close(failure("E_CLOSED"), false);
  }
  send(frame) {
    if (this.closed)
      throw this.closed;
    const text2 = JSON.stringify(frame);
    if (Buffer.byteLength(text2) > MAX_FRAME)
      throw failure("E_PAYLOAD_TOO_LARGE");
    this.socket.write(text2 + "\n");
  }
  receive(frame) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame))
      throw failure("E_PROTOCOL_ERROR");
    if (frame.type === "pipe_revoked") {
      this.close(failure("E_REVOKED"));
      return;
    }
    if (!this.rpcReady) {
      if (frame.type === "session_hello_error")
        throw failure("E_PROTOCOL_ERROR");
      if (this.waiter) {
        this.waiter.resolve(frame);
        this.waiter = void 0;
      } else {
        if (this.handshakeFrames.length >= 4)
          throw failure("E_PROTOCOL_ERROR");
        this.handshakeFrames.push(frame);
      }
      return;
    }
    if (frame.jsonrpc !== "2.0" || !Number.isSafeInteger(frame.id))
      throw failure("E_PROTOCOL_ERROR");
    const id = frame.id;
    if (!this.pending.has(id))
      return;
    if (frame.error) {
      const code = frame.error.code;
      this.settle(id, failure(typeof code === "string" && remoteCodes.has(code) ? code : "E_REMOTE_ERROR"));
    } else if (Object.prototype.hasOwnProperty.call(frame, "result"))
      this.settle(id, void 0, frame.result);
    else
      throw failure("E_PROTOCOL_ERROR");
  }
  nextHandshake() {
    if (this.closed)
      return Promise.reject(this.closed);
    if (this.handshakeFrames.length)
      return Promise.resolve(this.handshakeFrames.shift());
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
  }
  rpc(method, params, mode, signal) {
    if (this.closed)
      return Promise.reject(this.closed);
    if (signal?.aborted)
      return Promise.reject(failure("E_CANCELLED"));
    if (this.pending.size >= this.maxInflight)
      return Promise.reject(failure("E_BUSY"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const cancel = (code) => {
        const entry2 = this.pending.get(id);
        if (!entry2)
          return;
        if (entry2.sent) {
          try {
            this.send({ jsonrpc: "2.0", method: "$/cancel", params: { id } });
          } catch {
            this.close(failure("E_DISCONNECTED"));
            return;
          }
        }
        this.settle(id, failure(code));
      };
      const entry = {
        resolve,
        reject,
        signal,
        sent: false,
        abort: () => cancel("E_CANCELLED"),
        timer: setTimeout(() => cancel("E_TIMEOUT"), 55e3)
      };
      this.pending.set(id, entry);
      signal?.addEventListener("abort", entry.abort, { once: true });
      if (signal?.aborted) {
        entry.abort();
        return;
      }
      try {
        this.send({ jsonrpc: "2.0", id, method, params, ...mode ? { mode } : {} });
        entry.sent = true;
      } catch (error) {
        this.settle(id, failure(error.code === "E_PAYLOAD_TOO_LARGE" ? "E_PAYLOAD_TOO_LARGE" : "E_INVALID_PARAMS"));
      }
    });
  }
  async initialize(endpoint, ticket, signal) {
    const abort = () => this.close(failure("E_CANCELLED"), false);
    const deadline = setTimeout(() => this.close(failure("E_HANDSHAKE_TIMEOUT"), false), 5e3);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) {
        abort();
        throw failure("E_CANCELLED");
      }
      const clientNonce = (0, import_crypto.randomBytes)(16).toString("base64url");
      this.send({
        type: "session_hello",
        protocol_min: 1,
        protocol_max: 1,
        client_nonce: clientNonce,
        ticket_id: (0, import_crypto.createHash)("sha256").update(ticket).digest("hex").slice(0, 16),
        client: { kind: "workbuddian", id: "workbuddian", version: "1" }
      });
      const challenge = await this.nextHandshake();
      if (challenge.type !== "session_challenge" || challenge.protocol !== 1 || typeof challenge.server_nonce !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(challenge.server_nonce) || typeof challenge.server_proof !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge.server_proof))
        throw failure("E_PROTOCOL_ERROR");
      const expected = Buffer.from(proof(ticket, "server", endpoint, clientNonce, challenge.server_nonce)), actual = Buffer.from(challenge.server_proof);
      const verified = expected.length === actual.length && (0, import_crypto.timingSafeEqual)(expected, actual);
      expected.fill(0);
      actual.fill(0);
      challenge.server_proof = "";
      if (!verified)
        throw failure("E_SERVER_PROOF_INVALID");
      this.send({ type: "session_prove", client_proof: proof(ticket, "client", endpoint, clientNonce, challenge.server_nonce) });
      const ack = await this.nextHandshake();
      ticket.fill(0);
      if (ack.type !== "session_hello_ack" || ack.protocol !== 1 || !Array.isArray(ack.pipes) || !ack.pipes.includes("wb.request"))
        throw failure("E_REQUEST_PIPE_UNAVAILABLE");
      if (this.handshakeFrames.length || !Number.isSafeInteger(ack.max_inflight) || ack.max_inflight < 1)
        throw failure("E_PROTOCOL_ERROR");
      this.maxInflight = Math.min(8, ack.max_inflight);
      this.rpcReady = true;
      const pipe = await this.rpc("broker/GetPipe", { pipe: "wb.request" });
      if (pipe?.channel !== "c:wb.request" || !Array.isArray(pipe.methods) || !pipe.methods.includes("http.fetch"))
        throw failure("E_REQUEST_PIPE_UNAVAILABLE");
      if (this.closed)
        throw this.closed;
      this.available = true;
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
    }
  }
  async requestFetch(params, signal) {
    if (!params || typeof params !== "object" || Array.isArray(params))
      throw failure("E_INVALID_PARAMS");
    const result = await this.rpc("c:wb.request/http.fetch", params, "call", signal);
    if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 || !result.headers || typeof result.headers !== "object" || Array.isArray(result.headers) || Object.values(result.headers).some((value) => typeof value !== "string") || typeof result.body_b64 !== "string" || result.body_b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.body_b64)) {
      this.close(failure("E_PROTOCOL_ERROR"));
      throw failure("E_PROTOCOL_ERROR");
    }
    return { status: result.status, headers: { ...result.headers }, body_b64: result.body_b64 };
  }
};
async function connectWorkbuddyBroker(configDir, signal, onDisconnect) {
  if (signal?.aborted)
    throw failure("E_CANCELLED");
  const { endpoint, ticket } = discover(configDir);
  let connection;
  try {
    connection = new BrokerConnection(endpoint, onDisconnect);
    await connection.initialize(endpoint, ticket, signal);
    const ready = connection;
    return { requestFetch: (params, requestSignal) => ready.requestFetch(params, requestSignal), dispose: () => ready.dispose() };
  } catch (error) {
    connection?.dispose();
    const code = error.code;
    throw failure(remoteCodes.has(code) || [
      "E_SOCKET_UNAVAILABLE",
      "E_DISCONNECTED",
      "E_SERVER_PROOF_INVALID",
      "E_REQUEST_PIPE_UNAVAILABLE",
      "E_PROTOCOL_ERROR",
      "E_HANDSHAKE_TIMEOUT",
      "E_INVALID_PARAMS"
    ].includes(code) ? code : "E_CONNECT_FAILED");
  } finally {
    ticket.fill(0);
  }
}

// ../../.codex/skills/workbuddy-worker/scripts/vendor/workbuddyModels.ts
var failure2 = "WorkBuddy \u539F\u8D26\u53F7\u6A21\u578B\u76EE\u5F55\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u5BBF\u4E3B\u767B\u5F55\u72B6\u6001\u540E\u91CD\u8BD5\uFF1B\u672A\u53D1\u9001\u7528\u6237\u6D88\u606F\u3002";
var variants = ["lite", "builtin-lite", "reasoning", "vision", "longContext", "subagent"];
var efforts = ["minimal", "low", "medium", "high", "xhigh", "max"];
var numericFields = ["maxInputTokens", "maxOutputTokens", "maxAllowedSize", "temperature", "top_p", "top_k", "repetition_penalty"];
var booleanFields = ["supportsImages", "supportsReasoning", "supportsToolCall", "onlyReasoning", "disabledMultimodal", "canDisableThinking"];
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(failure2);
  return value;
}
function text(value, limit = 256) {
  if (typeof value !== "string" || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value))
    throw new Error(failure2);
  return value;
}
function modelId(value) {
  const id = text(value, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id))
    throw new Error(failure2);
  return id;
}
function number(value, positive = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || (positive ? value <= 0 : value < 0))
    throw new Error(failure2);
  return value;
}
function boolean(value) {
  if (typeof value !== "boolean")
    throw new Error(failure2);
  return value;
}
function nested(value) {
  const result = object(value);
  if (JSON.stringify(result).length > 4096)
    throw new Error(failure2);
  return result;
}
function definition(value) {
  const source = object(value), result = { id: modelId(source.id), name: text(source.name) };
  if (source.vendor !== void 0)
    result.vendor = text(source.vendor);
  for (const field of numericFields)
    if (source[field] !== void 0)
      result[field] = number(source[field], field.startsWith("max"));
  for (const field of booleanFields)
    if (source[field] !== void 0)
      result[field] = boolean(source[field]);
  if (source.credits !== void 0)
    result.credits = typeof source.credits === "number" ? number(source.credits) : text(source.credits, 64);
  if (source.reasoning !== void 0) {
    const sourceReasoning = nested(source.reasoning), reasoning = {};
    for (const field of ["effort", "defaultEffort"])
      if (sourceReasoning[field] !== void 0) {
        const effort = text(sourceReasoning[field]);
        if (!efforts.includes(effort))
          throw new Error(failure2);
        reasoning[field] = effort;
      }
    if (sourceReasoning.summary !== void 0)
      reasoning.summary = text(sourceReasoning.summary, 64);
    if (sourceReasoning.canDisableThinking !== void 0)
      reasoning.canDisableThinking = boolean(sourceReasoning.canDisableThinking);
    if (sourceReasoning.supportedEfforts !== void 0) {
      const values = sourceReasoning.supportedEfforts;
      if (!Array.isArray(values) || values.length > efforts.length || values.some((value2) => !efforts.includes(value2)))
        throw new Error(failure2);
      reasoning.supportedEfforts = [...values];
    }
    result.reasoning = reasoning;
  }
  if (source.contextWindow !== void 0) {
    const sourceWindow = nested(source.contextWindow), window = {};
    if (sourceWindow.defaultLength !== void 0)
      window.defaultLength = number(sourceWindow.defaultLength, true);
    if (sourceWindow.supportedLengths !== void 0) {
      const values = sourceWindow.supportedLengths;
      if (!Array.isArray(values) || values.length > 16)
        throw new Error(failure2);
      window.supportedLengths = values.map((value2) => number(value2, true));
    }
    result.contextWindow = window;
  }
  if (source.relatedModels !== void 0) {
    const sourceRelated = nested(source.relatedModels), related = {};
    for (const variant of variants)
      if (sourceRelated[variant] !== void 0)
        related[variant] = modelId(sourceRelated[variant]);
    result.relatedModels = related;
  }
  return result;
}
async function loadWorkbuddyModelConfig(broker, product, signal) {
  try {
    const response = await broker.requestFetch({
      method: "GET",
      path: "/console/enterprises/personal/models",
      headers: { Accept: "application/json" }
    }, signal);
    if (response.status !== 200 || typeof response.body_b64 !== "string" || response.body_b64.length > 1048576)
      throw new Error(failure2);
    const bytes = Buffer.from(response.body_b64, "base64");
    if (bytes.length > 655360)
      throw new Error(failure2);
    const root = object(JSON.parse(bytes.toString("utf8"))), data = object(root.data);
    if (root.code !== 0 || !Array.isArray(data.models) || data.models.length > 512 || !Array.isArray(data.agents))
      throw new Error(failure2);
    const accountCli = data.agents.map(object).find((agent) => agent.name === "cli");
    if (!accountCli || !Array.isArray(accountCli.models) || !accountCli.models.length || accountCli.models.length > 256)
      throw new Error(failure2);
    const listedIds = accountCli.models.map(modelId), accountModels = /* @__PURE__ */ new Map();
    for (const value of data.models) {
      const source = object(value), id = modelId(source.id);
      if (accountModels.has(id))
        throw new Error(failure2);
      accountModels.set(id, source);
    }
    if (listedIds.some((id) => !accountModels.has(id)))
      throw new Error(failure2);
    const ids = listedIds.filter((id) => accountModels.get(id)?.disabled !== true);
    if (!ids.length)
      throw new Error(failure2);
    if (!Array.isArray(product.models) || !Array.isArray(product.agents))
      throw new Error(failure2);
    const models = new Map(JSON.parse(JSON.stringify(product.models)).map((value) => {
      const model = object(value);
      return [modelId(model.id), model];
    }));
    const agents = JSON.parse(JSON.stringify(product.agents)).map(object);
    const installedCli = agents.find((agent) => agent.name === "cli");
    if (!installedCli)
      throw new Error(failure2);
    for (const [id, source] of accountModels)
      if (source.disabled !== true)
        models.set(id, { ...models.get(id), ...definition(source) });
    installedCli.models = ids;
    return { models: [...models.values()], agents };
  } catch {
    throw new Error(failure2);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  connectWorkbuddyBroker,
  loadWorkbuddyModelConfig
});
