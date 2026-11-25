const {
  DEFAULT_THEME,
  getStorageMode,
  readState,
  writeState,
  setCorsHeaders,
} = require("./_store");

function isValidHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function isValidPreset(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,40}$/.test(value.trim());
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const expectedPin = process.env.ADMIN_PIN || "raceys2026";
  const providedPin = String(req.headers["x-admin-pin"] || "");

  if (!providedPin || providedPin !== expectedPin) {
    return res.status(401).json({ error: "Invalid admin PIN" });
  }

  try {
    const state = await readState();

    if (req.method === "GET") {
      return res.status(200).json({
        entries: state.entries,
        theme: state.theme,
        storageMode: getStorageMode(),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (body.action === "refresh") {
      state.entries = {};
      const saved = await writeState(state);
      return res.status(200).json({
        ok: true,
        entries: saved.entries,
        theme: saved.theme,
      });
    }

    if (body.action === "release") {
      const num = Number(body.number);
      if (!Number.isInteger(num) || num < 1 || num > 45) {
        return res.status(400).json({ error: "Invalid ball number" });
      }
      delete state.entries[String(num)];
      const saved = await writeState(state);
      return res.status(200).json({
        ok: true,
        entries: saved.entries,
        theme: saved.theme,
      });
    }

    if (body.action === "theme") {
      const incoming = body.theme || {};
      const preset = isValidPreset(incoming.preset)
        ? incoming.preset.trim()
        : "emerald";

      state.theme = {
        preset,
        backgroundHex: isValidHex(incoming.backgroundHex)
          ? incoming.backgroundHex.trim().toLowerCase()
          : DEFAULT_THEME.backgroundHex,
        surfaceHex: isValidHex(incoming.surfaceHex)
          ? incoming.surfaceHex.trim().toLowerCase()
          : DEFAULT_THEME.surfaceHex,
        accentHex: isValidHex(incoming.accentHex)
          ? incoming.accentHex.trim().toLowerCase()
          : DEFAULT_THEME.accentHex,
      };

      const saved = await writeState(state);
      return res.status(200).json({
        ok: true,
        entries: saved.entries,
        theme: saved.theme,
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch {
    return res.status(500).json({ error: "Admin operation failed" });
  }
};
