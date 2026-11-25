const fs = require("fs");
const path = require("path");

const STATE_KEY = "raceys_lotto_state_v1";
const LOCAL_DATA_FILE =
  process.env.STATE_FILE || path.join(__dirname, "..", "data", "state.json");
const TMP_FILE = path.join("/tmp", "raceys-lotto-state.json");

const DEFAULT_THEME = {
  preset: "emerald",
  backgroundHex: "#0f3b2a",
  surfaceHex: "#154634",
  accentHex: "#f4c430",
};

function createDefaultState() {
  return {
    entries: {},
    theme: { ...DEFAULT_THEME },
  };
}

let memoryState = null;

function getKvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (url && token) {
    return { url: url.replace(/\/+$/, ""), token };
  }
  return null;
}

function getStorageMode() {
  if (getKvConfig()) return "kv";
  if (process.env.VERCEL) return "memory";
  return "file";
}

function normalizeState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    entries:
      raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)
        ? raw.entries
        : {},
    theme:
      raw.theme && typeof raw.theme === "object"
        ? {
            preset:
              typeof raw.theme.preset === "string"
                ? raw.theme.preset
                : DEFAULT_THEME.preset,
            backgroundHex:
              typeof raw.theme.backgroundHex === "string"
                ? raw.theme.backgroundHex
                : DEFAULT_THEME.backgroundHex,
            surfaceHex:
              typeof raw.theme.surfaceHex === "string"
                ? raw.theme.surfaceHex
                : DEFAULT_THEME.surfaceHex,
            accentHex:
              typeof raw.theme.accentHex === "string"
                ? raw.theme.accentHex
                : DEFAULT_THEME.accentHex,
          }
        : { ...DEFAULT_THEME },
  };
}

function getCandidateFiles() {
  return process.env.VERCEL
    ? [TMP_FILE]
    : [LOCAL_DATA_FILE, TMP_FILE];
}

async function readState() {
  const kv = getKvConfig();
  if (kv) {
    const res = await fetch(`${kv.url}/get/${encodeURIComponent(STATE_KEY)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.result) {
        const parsed =
          typeof json.result === "string"
            ? JSON.parse(json.result)
            : json.result;
        return normalizeState(parsed);
      }
      return createDefaultState();
    }
  }

  if (memoryState) return normalizeState(memoryState);

  for (const filePath of getCandidateFiles()) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        memoryState = normalizeState(JSON.parse(content));
        return memoryState;
      }
    } catch {
      // Try next file location
    }
  }

  memoryState = createDefaultState();
  return memoryState;
}

async function writeState(nextState) {
  const normalized = normalizeState(nextState);
  const kv = getKvConfig();

  if (kv) {
    const res = await fetch(`${kv.url}/set/${encodeURIComponent(STATE_KEY)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(normalized)),
    });
    if (!res.ok) {
      throw new Error(`KV write failed with status ${res.status}`);
    }
    return normalized;
  }

  memoryState = normalized;
  for (const filePath of getCandidateFiles()) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
      break;
    } catch {
      // Try fallback path
    }
  }
  return normalized;
}

function toPublicEntries(entries) {
  const out = {};
  for (const [key, item] of Object.entries(entries || {})) {
    if (item && typeof item === "object") {
      out[key] = {
        firstName: item.firstName || "Player",
        claimedAt: item.claimedAt || null,
      };
    }
  }
  return out;
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-pin");
}

module.exports = {
  DEFAULT_THEME,
  getStorageMode,
  readState,
  writeState,
  toPublicEntries,
  setCorsHeaders,
};
