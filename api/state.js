const { readState, toPublicEntries, setCorsHeaders } = require("./_store");

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const state = await readState();
    return res.status(200).json({
      entries: toPublicEntries(state.entries),
      theme: state.theme,
    });
  } catch {
    return res.status(500).json({ error: "Failed to load draw state" });
  }
};
