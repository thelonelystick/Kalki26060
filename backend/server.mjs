import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.API_PORT || 8787);
const dataDir = resolve(root, process.env.POLARIS_DATA_DIR || "backend/data");
const assetsDir = resolve(root, "assets");
const adminUsername = process.env.POLARIS_ADMIN_USERNAME || "admin";
const adminPassword = process.env.POLARIS_ADMIN_PASSWORD || "";
const adminApiKey = process.env.POLARIS_ADMIN_API_KEY || "";
const configuredKeys = (process.env.POLARIS_DATASET_API_KEYS || "").split(",").map(value => value.trim()).filter(Boolean);
const deviceKeys = new Map((process.env.POLARIS_IOT_DEVICE_KEYS || "").split(",").map(pair => pair.trim().split(":")).filter(pair => pair.length === 2));
const adminTokens = new Set();
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const useSupabase = Boolean(supabaseUrl && supabaseServiceKey);

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}
function token(request) {
  const value = request.headers["x-api-key"] || request.headers.authorization || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : value.trim();
}
function authorized(request) { return !configuredKeys.length || configuredKeys.includes(token(request)); }
function adminAuthorized(request) { return (adminApiKey && token(request) === adminApiKey) || adminTokens.has(token(request)); }
function deviceAuthorized(request, deviceId) { return deviceKeys.size === 0 || deviceKeys.get(deviceId) === token(request); }
async function body(request) { let value = ""; for await (const chunk of request) value += chunk; return value ? JSON.parse(value) : {}; }
async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}`, "content-type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function assetMap() {
  const files = (await readdir(assetsDir)).filter(file => file.endsWith("-dataset.json"));
  return Object.fromEntries(files.map(file => [file.replace(/-dataset\.json$/, ""), file]));
}
async function readDataset(moduleName) {
  const files = await assetMap();
  const filename = files[moduleName === "transfer" ? "data-transfer" : moduleName];
  if (!filename) throw Object.assign(new Error("Unknown dataset"), { status: 404, available: Object.keys(files) });
  if (useSupabase) {
    const rows = await supabaseRequest(`datasets?module=eq.${encodeURIComponent(moduleName)}&select=data`);
    if (rows[0]?.data) return rows[0].data;
  }
  const stored = resolve(dataDir, filename);
  try { return JSON.parse(await readFile(stored, "utf8")); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const fixture = JSON.parse(await readFile(resolve(assetsDir, filename), "utf8"));
    await mkdir(dataDir, { recursive: true });
    await writeFile(stored, JSON.stringify(fixture, null, 2) + "\n");
    if (useSupabase) await supabaseRequest("datasets", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ module: moduleName, data: fixture }) });
    return fixture;
  }
}
async function writeJson(name, value) { await mkdir(dataDir, { recursive: true }); await writeFile(resolve(dataDir, name), JSON.stringify(value, null, 2) + "\n"); }
async function appendLocal(name, value) { let entries = []; try { entries = JSON.parse(await readFile(resolve(dataDir, name), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; } entries.push(value); await writeJson(name, entries); return value; }
function setPath(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean); if (!parts.length) throw new Error("A dataset path is required.");
  let current = target;
  parts.forEach((part, index) => { if (index === parts.length - 1) { current[Array.isArray(current) ? Number(part) : part] = value; return; } current = current[Array.isArray(current) ? Number(part) : part]; if (current === undefined || current === null) throw new Error("Invalid dataset path."); });
}
async function persistRequest(record) {
  if (useSupabase) return (await supabaseRequest("access_requests", { method: "POST", body: JSON.stringify(record), headers: { Prefer: "return=representation" } }))[0];
  return appendLocal("access-requests.json", record);
}
async function listRequests() {
  if (useSupabase) return supabaseRequest("access_requests?select=*&order=created_at.desc");
  try { return JSON.parse(await readFile(resolve(dataDir, "access-requests.json"), "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  response.setHeader("access-control-allow-origin", process.env.CORS_ORIGIN || "http://localhost:5173");
  if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-headers": "authorization, x-api-key, content-type", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS" }); return response.end(); }
  if (!["GET", "POST", "PATCH"].includes(request.method)) return json(response, 405, { error: "Method not allowed" });
  if (url.pathname === "/api/auth/admin" && request.method === "POST") {
    const credentials = await body(request);
    if (!adminPassword || credentials.username !== adminUsername || credentials.password !== adminPassword) return json(response, 401, { error: "Invalid administrator credentials" });
    const value = randomBytes(32).toString("hex"); adminTokens.add(value); return json(response, 200, { role: "admin", token: value });
  }
  const telemetryMatch = url.pathname.match(/^\/api\/telemetry\/([^/]+)$/);
  if (telemetryMatch && request.method === "POST") {
    const deviceId = decodeURIComponent(telemetryMatch[1]);
    if (!deviceAuthorized(request, deviceId)) return json(response, 401, { error: "Invalid IoT device key" });
    const payload = await body(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(response, 400, { error: "Telemetry payload must be an object" });
    const reading = { deviceId, receivedAt: new Date().toISOString(), readings: payload };
    if (useSupabase) await supabaseRequest("sensor_readings", { method: "POST", body: JSON.stringify(reading) }); else await writeJson(`telemetry-${deviceId}.json`, reading);
    return json(response, 202, { accepted: true, reading });
  }
  const isPublicDatasetRead = request.method === "GET" && /^\/api\/datasets(?:\/|$)/.test(url.pathname);
  if (url.pathname.startsWith("/api/") && !isPublicDatasetRead && !authorized(request) && !(url.pathname === "/api/access-requests" && adminAuthorized(request))) return json(response, 401, { error: "API key required" });
  if (url.pathname === "/api/health") return json(response, 200, { ok: true, service: "polaris-ops-api", timestamp: new Date().toISOString() });
  if (url.pathname === "/api/datasets" && request.method === "GET") return json(response, 200, { datasets: Object.keys(await assetMap()), dom: true, domAttributes: { module: "data-dataset", item: "data-dataset-item", path: "data-dataset-path" } });
  const datasetMatch = url.pathname.match(/^\/api\/datasets\/([^/]+)$/);
  if (datasetMatch) {
    const moduleName = decodeURIComponent(datasetMatch[1]); const dataset = await readDataset(moduleName);
    if (request.method === "PATCH") { if (!adminAuthorized(request)) return json(response, 403, { error: "Administrator session required" }); const payload = await body(request); setPath(dataset, payload.path, payload.value); if (useSupabase) await supabaseRequest("datasets", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ module: moduleName, data: dataset, updated_by: "admin" }) }); else { const files = await assetMap(); await writeJson(files[moduleName], dataset); } return json(response, 200, { module: moduleName, data: dataset, path: payload.path, persisted: true }); }
    return json(response, 200, { module: moduleName, data: dataset, dom: true, domAttributes: { module: "data-dataset", item: "data-dataset-item", path: "data-dataset-path" } }, { "cache-control": "public, max-age=60" });
  }
  if (url.pathname === "/api/access-requests") {
    if (!adminAuthorized(request)) return json(response, 403, { error: "Administrator session required" });
    if (request.method === "GET") return json(response, 200, { requests: await listRequests() });
    const payload = await body(request); const table = String(payload.table || "").trim(); const requester = String(payload.requester || "").trim(); const access = String(payload.access || "read");
    if (!table || !requester || !["read", "write", "admin"].includes(access)) return json(response, 400, { error: "table, requester, and valid access are required" });
    const record = { id: randomBytes(12).toString("hex"), table_name: table, requester, access, reason: String(payload.reason || "").trim(), status: "pending", created_at: new Date().toISOString() };
    return json(response, 201, { request: await persistRequest(record) });
  }
  return json(response, 404, { error: "Route not found" });
}
const server = createServer((request, response) => handle(request, response).catch(error => { console.error(error); json(response, error.status || 500, { error: error.status === 404 ? error.message : "Internal server error", available: error.available }); }));
server.listen(port, () => console.log(`Polaris Ops API listening on http://localhost:${port}`));
