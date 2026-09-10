import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.API_PORT || 8787);
const configuredKeys = (process.env.POLARIS_DATASET_API_KEYS || "")
  .split(",")
  .map(key => key.trim())
  .filter(Boolean);

const datasetFiles = {
  polaris: "polaris-dataset.json",
  infrastructure: "infrastructure-dataset.json",
  utilities: "utilities-dataset.json",
  "data-transfer": "data-transfer-dataset.json",
  alerts: "alerts-dataset.json"
};

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

function authorized(request) {
  if (!configuredKeys.length) return true;
  const header = request.headers["x-api-key"] || request.headers.authorization || "";
  const key = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header.trim();
  return configuredKeys.includes(key);
}

async function datasetResponse(response, requestedModule) {
  const moduleName = requestedModule === "transfer" ? "data-transfer" : requestedModule;
  const filename = datasetFiles[moduleName];
  if (!filename) {
    json(response, 404, { error: "Unknown dataset", available: Object.keys(datasetFiles) });
    return;
  }

  const contents = await readFile(resolve(root, "assets", filename), "utf8");
  json(response, 200, {
    module: moduleName,
    data: JSON.parse(contents),
    dom: true,
    domAttributes: {
      module: "data-dataset",
      item: "data-dataset-item",
      path: "data-dataset-path"
    }
  }, { "cache-control": "public, max-age=60" });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  response.setHeader("access-control-allow-origin", process.env.CORS_ORIGIN || "http://localhost:5173");

  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-headers": "authorization, x-api-key, content-type", "access-control-allow-methods": "GET, OPTIONS" });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    json(response, 405, { error: "Method not allowed" }, { allow: "GET, OPTIONS" });
    return;
  }

  if (!authorized(request)) {
    json(response, 401, { error: "API key required", hint: "Use x-api-key or Authorization: Bearer <key>." }, { "www-authenticate": "Bearer" });
    return;
  }

  try {
    if (url.pathname === "/api/health") {
      json(response, 200, { ok: true, service: "polaris-ops-api", timestamp: new Date().toISOString() });
      return;
    }

    const match = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
    if (match) {
      await datasetResponse(response, decodeURIComponent(match[1]));
      return;
    }

    json(response, 404, { error: "Route not found" });
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "Unable to load dataset" });
  }
});

server.listen(port, () => {
  console.log(`Polaris Ops API listening on http://localhost:${port}`);
});