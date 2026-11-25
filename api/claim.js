const { readState, writeState, setCorsHeaders } = require("./_store");

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const num = Number(body.number);
    if (!Number.isInteger(num) || num < 1 || num > 45) {
      return res.status(400).json({ error: "Number must be between 1 and 45" });
    }

    const name = String(body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const mobile = String(body.mobile || "").trim();
    const digits = mobile.replace(/\D/g, "").length;

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: "Please enter your name" });
    }

    if (!/^\+?[0-9 \-]{7,20}$/.test(mobile) || digits < 7 || digits > 15) {
      return res.status(400).json({ error: "Enter a valid mobile number" });
    }

    const state = await readState();
    const key = String(num);
    if (state.entries[key]) {
      return res
        .status(409)
        .json({ reason: "taken", error: "Number already taken" });
    }

    const firstName = name.split(" ")[0];
    const entry = {
      name,
      firstName,
      mobile,
      claimedAt: new Date().toISOString(),
    };
    state.entries[key] = entry;
    await writeState(state);

    return res.status(200).json({
      number: num,
      firstName,
      claimedAt: entry.claimedAt,
    });
  } catch {
    return res.status(500).json({ error: "Failed to claim number" });
  }
};
