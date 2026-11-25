const http = require("http");
const fs = require("fs");
const path = require("path");

const stateHandler = require("./api/state");
const claimHandler = require("./api/claim");
const adminHandler = require("./api/admin");

const PORT = Number(process.env.PORT) || 10000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/jpeg",
  ".json": "application/json; charset=utf-8",
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      resolve(raw);
    });
    req.on("error", reject);
  });
}

function wrapResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(payload) {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  const wrappedRes = wrapResponse(res);

  try {
    if (
      urlPath === "/api/state" ||
      urlPath === "/api/claim" ||
      urlPath === "/api/admin"
    ) {
      if (req.method === "POST") {
        req.body = await readJsonBody(req);
      }
      if (urlPath === "/api/state") return await stateHandler(req, wrappedRes);
      if (urlPath === "/api/claim") return await claimHandler(req, wrappedRes);
      if (urlPath === "/api/admin") return await adminHandler(req, wrappedRes);
    }

    let relPath = urlPath.replace(/^\/+/, "");
    if (!relPath) relPath = "index.html";
    else if (relPath === "admin") relPath = "admin.html";
    else if (relPath === "favicon.ico") relPath = "assets/logo.jpg";

    const fullPath = path.resolve(ROOT, relPath);
    if (!fullPath.startsWith(ROOT + path.sep) && fullPath !== ROOT) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }

    fs.stat(fullPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.statusCode = 404;
        return res.end("Not Found");
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.statusCode = 200;
      res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      fs.createReadStream(fullPath).pipe(res);
    });
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Raceys backend listening on http://0.0.0.0:${PORT}`);
});
