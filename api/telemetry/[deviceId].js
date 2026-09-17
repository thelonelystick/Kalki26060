const latestReadings = new Map();

function suppliedKey(request) {
  const header = request.headers?.["x-api-key"] || request.headers?.authorization || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header.trim();
}

function deviceAuthorized(request, deviceId) {
  const configured = (process.env.POLARIS_IOT_DEVICE_KEYS || "")
    .split(",")
    .map(pair => pair.trim().split(":"))
    .filter(pair => pair.length === 2);
  if (!configured.length) return true;
  return configured.some(([configuredDevice, key]) => configuredDevice === deviceId && key === suppliedKey(request));
}

export default function handler(request, response) {
  const deviceId = String(request.query?.deviceId || "");
  if (!deviceId) return response.status(400).json({ error: "Device ID is required" });

  if (request.method === "GET") {
    return response.status(200).json({ deviceId, reading: latestReadings.get(deviceId) || null });
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!deviceAuthorized(request, deviceId)) return response.status(401).json({ error: "Invalid IoT device key" });

  const readings = request.body;
  if (!readings || typeof readings !== "object" || Array.isArray(readings)) {
    return response.status(400).json({ error: "Telemetry payload must be an object" });
  }
  const reading = { deviceId, receivedAt: new Date().toISOString(), readings };
  latestReadings.set(deviceId, reading);
  return response.status(202).json({ accepted: true, reading });
}