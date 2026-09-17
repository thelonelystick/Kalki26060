import { createClient } from "@supabase/supabase-js";
import localDataset from "./assets/polaris-dataset.json";
import infrastructureDataset from "./assets/infrastructure-dataset.json";
import utilitiesDataset from "./assets/utilities-dataset.json";
import transferDataset from "./assets/data-transfer-dataset.json";
import alertsDataset from "./assets/alerts-dataset.json";

const publicSupabaseUrl = "https://alymfzfgpqcvbcptwafg.supabase.co";
const publicSupabasePublishableKey =
  "sb_publishable_-9n6AAFZlqfbLplrBfNo2w_bT7QnD9v";
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof window !== "undefined" && window.__ENV__?.SUPABASE_URL) ||
  publicSupabaseUrl;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== "undefined" && window.__ENV__?.SUPABASE_PUBLISHABLE_KEY) ||
  publicSupabasePublishableKey;
let supabaseClient;
/* ==========================================================================
   CLIENT-SIDE BEHAVIOUR — NO FABRICATED TELEMETRY
   ==========================================================================
   This frontend deliberately does not generate, randomize, or simulate
   operational data. Connect the marked data hooks to authoritative APIs,
   station telemetry, approved forecasts, and authenticated backends.
   ========================================================================== */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, "0");
const domPath = (module, path) => `data-dataset-path="${module}.${path}"`;
const MODEL_URL = new URL(
  ((typeof window !== "undefined" && window.__ENV__?.MODEL_URL) || "assets/landscape.glb"),
  document.baseURI
).href;
const DATASET_URL = new URL("assets/polaris-dataset.json", document.baseURI);
let telemetryPoll;

const themeToggles = $$('[data-theme-toggle]');
function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggles.forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    toggle.setAttribute("title", `Switch to ${isDark ? "light" : "dark"} mode`);
    const label = toggle.querySelector(".theme-toggle-label");
    if (label) label.textContent = isDark ? "Light" : "Dark";
  });
  localStorage.setItem("polaris-theme", isDark ? "dark" : "light");
  window.dispatchEvent(new CustomEvent("polaris:theme-change", { detail: { isDark } }));
}
setTheme(localStorage.getItem("polaris-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
themeToggles.forEach((toggle) => toggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")));

const loginForm = $("#loginForm");
const loginStatus = $("#loginStatus");
const adminStatus = $("#adminStatus");
const googleLoginButton = $("#googleLoginButton");
let currentSession = { role: "visitor", token: "" };

function toast(title, msg, kind="") {
  const el=document.createElement("div"); el.className="toast "+kind;
  const heading = document.createElement("b");
  heading.textContent = title;
  el.append(heading, document.createTextNode(msg));
  $("#toasts").appendChild(el);
  setTimeout(()=>el.remove(),4200);
}

function setLoginMessage(msg, kind="") {
  if (!loginStatus) return;
  loginStatus.textContent = msg;
  loginStatus.className = "login-status" + (kind ? ` ${kind}` : "");
}

function setUserSession(role = "visitor", token = "") {
  localStorage.setItem("polaris-login-state", "authenticated");
  localStorage.setItem("polaris-user-role", role);
  if (token) localStorage.setItem("polaris-admin-token", token);
  currentSession = { role, token };
  document.body.classList.add("logged-in");
  document.body.dataset.role = role;
  applyAccessRole(role);
  window.dispatchEvent(new Event("polaris:login-state"));
}

function applyAccessRole(role) {
  const visitor = role === "visitor";
  const admin = role === "admin";
  $$("#modnav .tab").forEach(tab => {
    const allowed = tab.dataset.mod === "admin" ? admin : !visitor || tab.dataset.mod === "m1";
    tab.hidden = !allowed;
    if (!allowed) tab.setAttribute("aria-selected", "false");
  });
  const activeModule = admin && $("#admin")?.classList.contains("active") ? "admin" : visitor ? "m1" : ($$(".module.active")[0]?.id || "m1");
  $$(".module").forEach(module => {
    const isAdminModule = module.id === "admin";
    module.hidden = isAdminModule && !admin;
    module.classList.toggle("active", module.id === activeModule && (!isAdminModule || admin));
  });
  if (admin) $("#admin")?.removeAttribute("hidden");
  else $("#admin")?.setAttribute("hidden", "");
  document.body.dataset.role = role;
}

async function restoreSession() {
  const { data: { session } = {} } = await getSupabaseClient().auth.getSession().catch(() => ({ data: {} }));
  if (session?.user) {
    setUserSession("visitor");
    return;
  }
  if (localStorage.getItem("polaris-login-state") === "authenticated") {
    setUserSession(localStorage.getItem("polaris-user-role") || "visitor", localStorage.getItem("polaris-admin-token") || "");
    return;
  }
  document.body.classList.remove("logged-in");
  delete document.body.dataset.role;
}

googleLoginButton?.addEventListener("click", async () => {
  try {
    setLoginMessage("Opening Google sign-in…");
    const configuredRedirect = import.meta.env.VITE_SUPABASE_REDIRECT_URL;
    const redirectTo = configuredRedirect && new URL(configuredRedirect, window.location.origin).origin === window.location.origin
      ? new URL(configuredRedirect, window.location.origin).href
      : `${window.location.origin}/`;
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) throw error;
  } catch (error) {
    const message = error.message || "Google sign-in failed.";
    const providerDisabled = /unsupported provider|provider is not enabled/i.test(message);
    const redirectMismatch = /redirect_uri_mismatch/i.test(message);
    setLoginMessage(
      providerDisabled
        ? "Google sign-in is not enabled yet. Enable Google under Supabase Authentication > Providers, then try again."
        : redirectMismatch
          ? "Google redirect settings do not match this site. Add the Supabase callback URL from the setup guide in Google Cloud."
        : message,
      "error"
    );
  }
});

async function validateAdminCredentials(username, password) {
  const response = await fetch("/api/auth/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error(payload.error || "Administrator login failed.");
  return payload;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`The administrator API is unavailable (${response.status}). Deploy the /api/auth/admin function and configure its environment variables.`);
  }
  return response.json();
}

function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before login.");
  }
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return supabaseClient;
}

async function validateLoginCredentials(identifier, password) {
  const input = String(identifier || "").trim();
  if (!input || !password) {
    throw new Error("Email or username and password are required.");
  }

  const { data, error } = await getSupabaseClient().rpc("verify_login", {
    login_identifier: input,
    login_password: password
  });
  if (error || !data?.[0]) throw new Error("Invalid email, username, or password.");
  return data[0];
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;
  const signInMethod = $("#loginRole").value;
  if (!email || !password) {
    setLoginMessage("Please enter both your email and password.", "error");
    return;
  }

  setLoginMessage("Checking credentials…");

  try {
    const user = signInMethod === "admin"
      ? await validateAdminCredentials(email, password)
      : await validateLoginCredentials(email, password);
    let role = "visitor";
    if (signInMethod === "admin") {
      role = user.role === "admin" ? "admin" : "visitor";
      if (role !== "admin") throw new Error("Administrator access was not granted.");
    } else {
        const roleResponse = await fetch("/api/auth/account-role", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, fallbackRole: user.role || "researcher" })
      });
        const assignedRole = roleResponse.ok ? ((await readJsonResponse(roleResponse)).role || user.role || "visitor") : (user.role || "visitor");
      role = ["visitor", "researcher", "admin"].includes(assignedRole) ? assignedRole : "visitor";
      if (role !== signInMethod) throw new Error(`This account is assigned ${role} access.`);
    }
    setLoginMessage(`Welcome, ${user.name || user.username || user.email}.`, "success");
    setUserSession(role, user.token || "");
    if (role === "admin") loadAccountLog().catch(error => setAdminMessage(error.message, "error"));
    toast("Login successful", "Redirecting to the operations console.");
    setTimeout(() => {
      document.body.classList.add("logged-in");
      loginForm.reset();
      setLoginMessage("");
    }, 500);
  } catch (error) {
    const msg = error.message || "Login failed.";
    setLoginMessage(msg, "error");
    toast("Login failed", msg, "bad");
  }
});

$("#logoutButton")?.addEventListener("click", () => {
  getSupabaseClient().auth.signOut().catch(() => {});
  localStorage.removeItem("polaris-login-state");
  localStorage.removeItem("polaris-user-role");
  localStorage.removeItem("polaris-admin-token");
  currentSession = { role: "visitor", token: "" };
  document.body.classList.remove("logged-in");
  delete document.body.dataset.role;
  $("#admin")?.setAttribute("hidden", "");
  toast("Signed out", "Your session has ended.");
});

/* Module navigation */
$$("#modnav .tab").forEach(tab=>tab.addEventListener("click",()=>{
  $$("#modnav .tab").forEach(t=>t.setAttribute("aria-selected",String(t===tab)));
  $$(".module").forEach(module => {
    const active = module.id === tab.dataset.mod;
    module.classList.toggle("active", active);
    if (module.id === "admin") module.toggleAttribute("hidden", !active || currentSession.role !== "admin");
  });
  window.scrollTo({top:0,behavior:"smooth"});
}));

/* ==========================================================================
   LIVE DATA HOOKS
   ========================================================================== */
function markUnavailable(){
  ["vDrs","vHf","vKp","vTemp","vWind","vVis","vPbl","vDay","kOrbits","kData","kLink","wSpd","wPres","wPresTrend","rTemp","lAer","lVal","bioScore"].forEach(id=>{
    const el=$("#"+id); if(el) el.textContent="—";
  });
  ["passList","stormAlerts","opsWindows","siteRows","heritageCards","kpBars","timeline","threads"].forEach(id=>{
    const el=$("#"+id); if(el) el.innerHTML='<div class="row"><span class="pill">NO DATA</span><div class="txt"><b>Awaiting connected source</b><span>No operational record is displayed until an authoritative feed is connected.</span></div></div>';
  });
  const pillMap={trackPill:"NO DATA",stormPill:"NO DATA",rainPill:"NO DATA"};
  Object.entries(pillMap).forEach(([id,text])=>{const el=$("#"+id);if(el)el.textContent=text;});
  ["kLinkBar","rTempBar","bioBar"].forEach(id=>{const el=$("#"+id);if(el)el.style.width="0%";});
}

function setText(id, value) {
  const el = $("#" + id);
  if (el) el.textContent = value;
}

function renderStationData(data) {
  const station = data.station;
  const stationFields = {
    vDrs: [station.drs, "drs"], vHf: [station.hf, "hf"], vKp: [station.kp, "kp"],
    vTemp: [`${station.temperature}°C`, "temperature"], vWind: [`${station.wind} kt`, "wind"],
    vHumidity: [station.humidity == null ? "—" : `${station.humidity}%`, "humidity"],
    vVis: [`${station.visibility} km`, "visibility"], vPbl: [`${station.pbl} m`, "pbl"],
    vDay: [station.winterOverDay, "winterOverDay"], kOrbits: [station.orbits, "orbits"],
    kData: [station.dataCapturedTb.toFixed(1), "dataCapturedTb"], kLink: [station.linkAvailability, "linkAvailability"]
  };
  Object.entries(stationFields).forEach(([id, [value, path]]) => {
    setText(id, value);
    $(`#${id}`)?.setAttribute("data-dataset-path", `polaris.station.${path}`);
  });
  const linkBar = $("#kLinkBar");
  if (linkBar) linkBar.style.width = `${station.linkAvailability}%`;
  setText("trackPill", `${data.passes.length} WINDOWS`);
  $("#trackPill")?.classList.replace("ok", "info");
}

function applyTelemetryToDom(data) {
  const paths = {
    "polaris.station.temperature": data.station.temperature == null ? "—" : `${data.station.temperature}°C`,
    "polaris.station.humidity": data.station.humidity == null ? "—" : `${data.station.humidity}%`
  };
  Object.entries(paths).forEach(([path, value]) => {
    $$(`[data-dataset-path="${path}"]`).forEach(element => { element.textContent = value; });
  });
}

async function loadLatestTelemetry(data) {
  try {
    const response = await fetch("/api/telemetry/station-01");
    if (!response.ok) return;
    const payload = await response.json();
    const readings = payload.reading?.readings || {};
    const temperature = Number(readings.temperatureC);
    const humidity = Number(readings.humidityPct);
    if (Number.isFinite(temperature)) data.station.temperature = temperature;
    if (Number.isFinite(humidity)) data.station.humidity = humidity;
    if (Number.isFinite(temperature) || Number.isFinite(humidity)) {
      renderStationData(data);
      applyTelemetryToDom(data);
    }
  } catch (error) {
    console.warn("Live telemetry unavailable; keeping the dataset values.", error);
  }
}

function renderPasses(passes) {
  const list = $("#passList");
  const traces = $("#traces");
  if (!list || !traces) return;
  list.innerHTML = passes.map(pass => `
    <button class="passcard ${pass.status === "SCHEDULED" ? "sel" : ""}" data-pass-id="${pass.id}" type="button">
      <i class="swatch" style="background:${pass.color}"></i>
      <span class="txt"><b>${pass.satellite}</b><span>${pass.window} · ${pass.elevation}° max elevation</span></span>
      <span class="pill ${pass.status === "SCHEDULED" ? "ok" : "info"}">${pass.status}</span>
    </button>`).join("");
  traces.innerHTML = passes.map(pass => {
    const angle = pass.azimuth * Math.PI / 180;
    const radius = 90 * (1 - pass.elevation / 90);
    const x = 100 + radius * Math.sin(angle);
    const y = 100 - radius * Math.cos(angle);
    return `<circle class="sat" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" fill="${pass.color}" data-pass-id="${pass.id}" data-dataset-path="polaris.passes.${passes.indexOf(pass)}"/>`;
  }).join("");
  $$("#passList .passcard").forEach(card => card.addEventListener("click", () => {
    $$("#passList .passcard").forEach(item => item.classList.remove("sel"));
    card.classList.add("sel");
    toast("Capture window selected", `${card.querySelector("b").textContent} is ready for scheduling.`);
  }));
}

function renderStorm(storm) {
  setText("stormPill", storm.level);
  $("#stormPill")?.setAttribute("data-dataset-path", "polaris.storm.level");
  const bars = $("#kpBars");
  const alerts = $("#stormAlerts");
  if (bars) bars.innerHTML = storm.forecast.map((level, index) => `<div data-lvl="${level >= 6 ? "high" : level >= 4 ? "mid" : "low"}" data-dataset-item="polaris.storm.forecast.${index}" data-dataset-path="polaris.storm.forecast.${index}" style="height:${Math.max(22, level * 12)}px"></div>`).join("");
  if (alerts) alerts.innerHTML = storm.alerts.map((alert, index) => `<div class="row" data-dataset-item="polaris.storm.alerts.${index}"><span class="pill ${alert.severity === "WARN" ? "warn" : "info"}">${alert.severity}</span><div class="txt"><b>${alert.title}</b><span>${alert.detail}</span></div></div>`).join("");
}

function renderTimeline(phases) {
  const timeline = $("#timeline");
  if (!timeline) return;
  timeline.innerHTML = phases.map((phase, index) => `<button class="step ${index === 0 ? "active" : ""}" data-phase-index="${index}" data-dataset-item="data-transfer.phases.${index}" type="button">${phase.month}</button>`).join("");
  const renderPhase = index => {
    const phase = phases[index];
    setText("phaseTitle", `${phase.month} · ${phase.label}`);
    setText("phaseSub", phase.phase);
    setText("phasePill", phase.status);
    setText("phaseDesc", phase.description);
    ["phaseTitle", "phaseSub", "phasePill", "phaseDesc"].forEach((id, fieldIndex) => {
      const field = ["month", "phase", "status", "description"][fieldIndex];
      const element = $(`#${id}`);
      if (element) element.setAttribute("data-dataset-path", `data-transfer.phases.${index}.${field}`);
    });
    const gauges = $("#phaseGauges");
    const actions = $("#phaseActions");
    if (gauges) gauges.innerHTML = phase.gauges.map((gauge, gaugeIndex) => `<div class="gauge-row" data-dataset-item="data-transfer.phases.${index}.gauges.${gaugeIndex}"><span ${domPath("data-transfer", `phases.${index}.gauges.${gaugeIndex}.label`)}>${gauge.label}</span><div class="bar"><i style="width:${gauge.value}%"></i></div><b>${gauge.value}%</b></div>`).join("");
    if (actions) actions.innerHTML = phase.actions.map((action, actionIndex) => `<div class="row" data-dataset-item="data-transfer.phases.${index}.actions.${actionIndex}"><span class="pill info">${action.type}</span><div class="txt"><b>${action.title}</b><span>${action.detail}</span></div></div>`).join("");
  };
  $$("#timeline .step").forEach(step => step.addEventListener("click", () => {
    $$("#timeline .step").forEach(item => item.classList.remove("active"));
    step.classList.add("active");
    renderPhase(Number(step.dataset.phaseIndex));
  }));
  renderPhase(0);
}

function renderAlerts(data) {
  const siteRows = $("#siteRows");
  const heritageCards = $("#heritageCards");
  if (siteRows) siteRows.innerHTML = data.sites.map((site, index) => `<tr data-dataset-item="alerts.sites.${index}"><td ${domPath("alerts", `sites.${index}.name`)}>${site.name}</td><td><span class="pill ${site.access === "OPEN" ? "ok" : "warn"}">${site.access}</span></td><td class="mono">${site.meltwater}</td><td class="mono">${site.delay}</td><td>${site.route}</td></tr>`).join("");
  if (heritageCards) heritageCards.innerHTML = data.heritage.map((item, index) => `<div class="row" data-dataset-item="alerts.heritage.${index}"><span class="pill ${item.kind}" ${domPath("alerts", `heritage.${index}.kind`)}>${item.kind.toUpperCase()}</span><div class="txt"><b>${item.title}</b><span>${item.detail}</span></div></div>`).join("");
  const restricted = data.sites.filter(site => site.access !== "OPEN").length;
  const structural = data.heritage.filter(item => item.kind === "bad").length;
  setText("sitePill", `${restricted} sites restricted`);
  setText("heritagePill", `${structural} structural alert${structural === 1 ? "" : "s"}`);
}

function renderInfrastructure(data) {
  const list = $("#deviceList");
  if (!list) return;
  list.innerHTML = data.devices.map((device, index) => `<div class="row" data-dataset-item="infrastructure.devices.${index}"><span class="pill ${device.status === "TRUSTED" ? "ok" : "warn"}" ${domPath("infrastructure", `devices.${index}.status`)}>${device.status}</span><div class="txt"><b>${device.name}</b><span>${device.type} · ${device.lastSeen}</span></div></div>`).join("");
}

function renderUtilities(data) {
  const energyPercent = Math.round((data.energy.usedKwh / data.energy.budgetKwh) * 100);
  setText("energyUsed", data.energy.usedKwh);
  $("#energyUsed")?.setAttribute("data-dataset-path", "utilities.energy.usedKwh");
  setText("energyTrend", `${data.energy.trend} · budget ${data.energy.budgetKwh.toLocaleString()} kWh`);
  $("#energyTrend")?.setAttribute("data-dataset-path", "utilities.energy.trend");
  const energyBar = $("#energyBar");
  if (energyBar) {
    energyBar.style.width = `${Math.min(energyPercent, 100)}%`;
    energyBar.setAttribute("data-dataset-path", "utilities.energy.usedKwh");
  }
  const shipment = data.shipment;
  const shipmentStatus = $("#shipmentStatus");
  if (shipmentStatus) shipmentStatus.innerHTML = `<span class="pill ok" ${domPath("utilities", "shipment.status")}>${shipment.status}</span><div class="txt"><b><span ${domPath("utilities", "shipment.name")}>${shipment.name}</span></b><span ${domPath("utilities", "shipment.note")}>${shipment.note}</span></div>`;
  const bioList = $("#bioList");
  if (!bioList) return;
  bioList.innerHTML = data.biosecurity.map((item, index) => `<label class="row check ${item.complete ? "done" : ""}" data-dataset-item="utilities.biosecurity.${index}"><input type="checkbox" data-index="${index}" ${item.complete ? "checked" : ""}/><div class="txt"><b>${item.label}</b><span>${item.detail}</span></div></label>`).join("");
  const updateBioScore = () => {
    const complete = $$("#bioList input").filter(input => input.checked).length;
    const score = Math.round((complete / data.biosecurity.length) * 100);
    setText("bioScore", score);
    const bioBar = $("#bioBar");
    if (bioBar) bioBar.style.width = `${score}%`;
  };
  $$("#bioList input").forEach(input => input.addEventListener("change", () => {
    input.closest(".check")?.classList.toggle("done", input.checked);
    updateBioScore();
  }));
  updateBioScore();
}

function renderTransfer(data) {
  setText("transferQueueSummary", `${data.queue.queuedFiles} files · ${data.queue.queuedGb} GB queued · next window ${data.queue.nextWindow} · ${data.queue.protocol}`);
  $("#transferQueueSummary")?.setAttribute("data-dataset-path", "data-transfer.queue");
  renderTimeline(data.phases);
}

function renderAllModuleData(data = {}) {
  renderInfrastructure(data.infrastructure || infrastructureDataset);
  renderUtilities(data.utilities || utilitiesDataset);
  renderTransfer(data.transfer || transferDataset);
  renderAlerts(data.alerts || alertsDataset);
}

async function loadBackendDatasets() {
  const sources = {
    infrastructure: infrastructureDataset,
    utilities: utilitiesDataset,
    transfer: transferDataset,
    alerts: alertsDataset
  };
  await Promise.all(Object.keys(sources).map(async moduleName => {
    try {
      const apiModuleName = moduleName === "transfer" ? "data-transfer" : moduleName;
      const response = await fetch(`/api/datasets/${apiModuleName}`);
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.data) sources[moduleName] = payload.data;
    } catch (error) {
      console.warn(`Backend dataset unavailable: ${moduleName}`, error);
    }
  }));
  return sources;
}

async function adminRequest(moduleName, path, value) {
  if (currentSession.role !== "admin" || !currentSession.token) throw new Error("Administrator session required.");
  const response = await fetch(`/api/datasets/${moduleName}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", Authorization: `Bearer ${currentSession.token}` },
    body: JSON.stringify({ path, value })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset update failed.");
  return payload;
}

function setAdminMessage(message, kind = "success") {
  if (!adminStatus) return;
  adminStatus.textContent = message;
  adminStatus.className = `login-status ${kind}`;
}

function renderAccountLog(accounts = []) {
  const log = $("#accountLog");
  if (!log) return;
  if (!accounts.length) {
    log.innerHTML = '<div class="row"><span class="pill">EMPTY</span><div class="txt"><b>No account assignments</b><span>Assign access to an email or username above.</span></div></div>';
    return;
  }
  log.innerHTML = accounts.map(account => `<div class="row account-log-row"><span class="pill ${account.role === "admin" ? "bad" : account.role === "researcher" ? "info" : "ok"}">${account.role.toUpperCase()}</span><div class="txt"><b>${account.email || account.username}</b><span>${account.name || "Station account"}</span></div><button class="btn ghost sm account-role-button" type="button" data-account="${account.email || account.username}">Set role</button></div>`).join("");
}

async function loadAccountLog() {
  if (currentSession.role !== "admin" || !currentSession.token) return;
  const response = await fetch("/api/accounts", { headers: { Authorization: `Bearer ${currentSession.token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Unable to load account log.");
  renderAccountLog(payload.accounts);
}

$("#accountRoleForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    const response = await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json", Authorization: `Bearer ${currentSession.token}` },
      body: JSON.stringify({ identifier: form.get("identifier"), role: form.get("role") })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Account access update failed.");
    setAdminMessage(`${payload.identifier} now has ${payload.role} access.`);
    formElement.reset();
    await loadAccountLog();
  } catch (error) { setAdminMessage(error.message, "error"); }
});

$("#refreshAccounts")?.addEventListener("click", () => loadAccountLog().catch(error => setAdminMessage(error.message, "error")));

$("#accountLog")?.addEventListener("click", event => {
  const button = event.target.closest(".account-role-button");
  if (!button) return;
  $("#accountIdentifier").value = button.dataset.account;
  $("#accountIdentifier").focus();
});

$("#datasetEditForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const path = String(form.get("path")).trim();
  const value = String(form.get("value"));
  const [moduleName, ...pathParts] = path.split(".");
  try {
    await adminRequest(moduleName === "transfer" ? "data-transfer" : moduleName, pathParts.join("."), value);
    setAdminMessage(`Saved ${path}. Refreshing connected data.`);
    await loadDataset();
  } catch (error) { setAdminMessage(error.message, "error"); }
});

$("#policyForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await adminRequest("data-transfer", "queue.protocol", String(form.get("protocol")));
    await adminRequest("data-transfer", "queue.nextWindow", String(form.get("nextWindow")));
    setAdminMessage("Transfer policy saved. Refreshing connected data.");
    await loadDataset();
  } catch (error) { setAdminMessage(error.message, "error"); }
});

$("#deviceForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    const response = await fetch("/api/datasets/infrastructure");
    const payload = await response.json();
    const devices = payload.data.devices || [];
    await adminRequest("infrastructure", `devices.${devices.length}`, {
      name: String(form.get("name")), type: String(form.get("type")), status: "PENDING", lastSeen: "Not yet connected"
    });
    setAdminMessage("IoT device added. Refreshing connected data.");
    formElement.reset();
    await loadDataset();
  } catch (error) { setAdminMessage(error.message, "error"); }
});

async function loadDataset() {
  try {
    const response = await fetch(DATASET_URL);
    const data = response.ok ? await response.json() : localDataset;
    renderStationData(data);
    renderPasses(data.passes);
    $("#autoSched")?.addEventListener("click", () => {
      renderPasses(data.passes.map(pass => ({ ...pass, status: "SCHEDULED" })));
      toast("Passes scheduled", `${Math.min(6, data.passes.length)} capture window(s) added to the queue.`);
    });
    renderStorm(data.storm);
    renderAllModuleData(await loadBackendDatasets());
    await loadLatestTelemetry(data);
    if (!telemetryPoll) telemetryPoll = window.setInterval(() => loadLatestTelemetry(data), 30000);
  } catch (error) {
    console.error("Unable to load Polaris dataset", error);
    renderStationData(localDataset);
    renderPasses(localDataset.passes);
    renderStorm(localDataset.storm);
    renderAllModuleData();
  }
}

/* ==========================================================================
   MAINTENANCE CHECKLIST — user-entered state only
   ========================================================================== */
const MAINT=[
  ["Antenna de-icing inspection","Enter local procedure / cadence"],
  ["Generator and fuel-system inspection","Enter local procedure / cadence"],
  ["DRS array health check","Enter local procedure / cadence"],
  ["UPS / battery temperature check","Enter local procedure / cadence"],
  ["HF antenna post-weather inspection","Post-event"],
  ["Azimuth bearing inspection","Enter local procedure / cadence"],
  ["Emergency-route clearance","Enter local procedure / cadence"]
];
let maintState=MAINT.map(()=>false);
function renderMaint(){
  $("#maintList").innerHTML=MAINT.map(([t,s],i)=>`<label class="row check ${maintState[i]?"done":""}"><input type="checkbox" data-i="${i}" ${maintState[i]?"checked":""}/><div class="txt"><b>${t}</b><span>${s}</span></div></label>`).join("");
  $("#maintPill").textContent=`${maintState.filter(Boolean).length} / ${MAINT.length}`;
  $$("#maintList input").forEach(cb=>cb.addEventListener("change",()=>{maintState[+cb.dataset.i]=cb.checked;renderMaint();}));
}
$("#signShift")?.addEventListener("click",()=>{
  const open=maintState.filter(v=>!v).length;
  toast(open?"Shift not signed":"Shift signed off",open?`${open} checklist item(s) remain open.`:"Checklist state recorded locally.",open?"warn":"");
});

/* ==========================================================================
   COMPLIANCE / DOCUMENT WORKFLOW — actual user actions only
   ========================================================================== */
let docs=[];
function appendTextRow(parent, pillText, title, detail, pillClass="") {
  const row=document.createElement("div"); row.className="row";
  const pill=document.createElement("span"); pill.className=`pill ${pillClass}`; pill.textContent=pillText;
  const text=document.createElement("div"); text.className="txt";
  const heading=document.createElement("b"); heading.textContent=title;
  const description=document.createElement("span"); description.textContent=detail;
  text.append(heading, description); row.append(pill, text); parent.append(row);
}
function renderDocs(){
  const el=$("#docList"); if(!el)return;
  el.replaceChildren();
  if (!docs.length) {
    appendTextRow(el, "EMPTY", "No documents attached", "Attach an actual EIA or Waste Management Plan to continue.");
    return;
  }
  docs.forEach(d=>appendTextRow(el, "ATTACHED", d.kind, d.name, "ok"));
}
function wireDrop(id,kind){
  const zone=$("#"+id); if(!zone)return;
  zone.addEventListener("click",()=>{
    const input=document.createElement("input"); input.type="file"; input.accept=".pdf,.doc,.docx";
    input.onchange=()=>{const f=input.files?.[0];if(!f)return;docs.push({kind,name:f.name});renderDocs();toast("Document attached",f.name);};
    input.click();
  });
}
wireDrop("dropEia","EIA"); wireDrop("dropWaste","Waste Management Plan"); renderDocs();
$("#permitForm")?.addEventListener("submit",e=>{e.preventDefault();toast("Validation pending","Connect this workflow to the competent-authority backend before submission.","warn");});
$("#saveDraft")?.addEventListener("click",()=>toast("Draft saved locally","No application has been transmitted."));

/* ==========================================================================
   WELL-BEING — educational resources + user-entered anonymous check-in
   ========================================================================== */
$("#submitCheckin")?.addEventListener("click",()=>{
  const mood=$("#moodRow button.on")?.dataset.v; const sleep=$("#sleepH")?.value;
  if(!mood){toast("Nothing selected","Choose a check-in value first.","warn");return;}
  $("#checkinNote").textContent="Check-in captured locally. No aggregate or clinical interpretation is generated by this page.";
  toast("Check-in recorded","Stored only in this browser session.");
});
$$("#moodRow button").forEach(b=>b.addEventListener("click",()=>{
  $$("#moodRow button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
}));
let threads=[];
function renderThreads(){
  const el=$("#threads"); if(!el)return;
  el.replaceChildren();
  if (!threads.length) {
    appendTextRow(el, "EMPTY", "No peer posts loaded", "Connect an authenticated, secure forum service to display posts.");
    return;
  }
  threads.forEach(t => {
    const thread=document.createElement("div"); thread.className="thread";
    const author=document.createElement("b"); author.textContent="Anonymous";
    const body=document.createElement("p"); body.textContent=t.body;
    const meta=document.createElement("div"); meta.className="meta"; meta.textContent="local draft · not transmitted";
    thread.append(author, body, meta); el.append(thread);
  });
}
$("#postBtn")?.addEventListener("click",()=>{
  const v=$("#postBody").value.trim(); if(!v){toast("Empty post","Write something first.","warn");return;}
  threads.unshift({body:v}); $("#postBody").value=""; renderThreads(); toast("Draft created","This page has not transmitted the post.");
});

/* Infrastructure observations are user-entered and remain local. */
let obs=[];
function renderObsSelect(){
  const el=$("#obsAsset"); if(el)el.innerHTML='<option value="">Select an asset</option><option>Research site</option><option>Historic installation</option><option>Runway / access route</option><option>Power station</option><option>Ice core lab</option>';
}
function renderObsLog(){
  const el=$("#obsLog"); if(!el)return;
  el.replaceChildren();
  if (!obs.length) {
    appendTextRow(el, "EMPTY", "No observations filed", "Create an observation when an asset requires attention.");
    return;
  }
  obs.forEach(o => {
    const row=document.createElement("div"); row.className="row";
    const pill=document.createElement("span"); pill.className="pill"; pill.textContent=o.sev.toUpperCase();
    const text=document.createElement("div"); text.className="txt";
    const heading=document.createElement("b"); heading.textContent=`${o.asset} — ${o.type}`;
    const notes=document.createElement("span"); notes.textContent=o.notes || "No notes.";
    const timestamp=document.createElement("span"); timestamp.className="mono"; timestamp.textContent=o.at;
    text.append(heading, notes, timestamp); row.append(pill, text); el.append(row);
  });
}
function renderAlertLog(){
  const el=$("#alertLog"); if(!el)return;
  el.replaceChildren();
  if (!obs.length) {
    appendTextRow(el, "CLEAR", "No alerts logged", "Connected alert events will appear here.");
    return;
  }
  obs.forEach(o => {
    const row=document.createElement("div"); row.className="row";
    const pill=document.createElement("span"); pill.className=`pill ${o.sev === "Structural alert" ? "bad" : "warn"}`; pill.textContent=o.sev.toUpperCase();
    const text=document.createElement("div"); text.className="txt";
    const heading=document.createElement("b"); heading.textContent=`${o.asset} — ${o.type}`;
    const notes=document.createElement("span"); notes.textContent=o.notes || "No notes.";
    const timestamp=document.createElement("span"); timestamp.className="mono"; timestamp.textContent=o.at;
    text.append(heading, notes, timestamp); row.append(pill, text); el.append(row);
  });
}
$("#obsSubmit")?.addEventListener("click",()=>{
  if(!$("#obsAsset").value){toast("Select an asset","Choose the asset being observed.","warn");return;}
  obs.unshift({asset:$("#obsAsset").value,type:$("#obsType").value,sev:$("#obsSev").value,notes:$("#obsNotes").value.trim(),at:new Date().toISOString()});
  $("#obsNotes").value="";renderObsLog();renderAlertLog();toast("Observation recorded locally","No external system has received this observation.");
});

function setActionStatus(id, pillText, heading, detail, kind="") {
  const el = $(`#${id}`);
  if (!el) return;
  const pill = document.createElement("span");
  pill.className = `pill ${kind}`;
  pill.textContent = pillText;
  const text = document.createElement("div");
  text.className = "txt";
  const title = document.createElement("b");
  title.textContent = heading;
  const description = document.createElement("span");
  description.textContent = detail;
  text.append(title, description);
  el.replaceChildren(pill, text);
}

$("#authenticateDevice")?.addEventListener("click", () => {
  setActionStatus("deviceStatus", "PENDING", "Device authentication requested", "Complete the station identity challenge before access is granted.", "warn");
  toast("Device authentication", "The request was recorded locally.", "warn");
});

$("#accessDevice")?.addEventListener("click", () => {
  setActionStatus("deviceStatus", "READY", "Device access is awaiting selection", "Connect the device registry to choose an approved station device.", "info");
  toast("Device access", "No device registry is connected.", "warn");
});

$("#powerModeButton")?.addEventListener("click", (event) => {
  const enabled = event.currentTarget.dataset.enabled === "true";
  event.currentTarget.dataset.enabled = String(!enabled);
  event.currentTarget.textContent = enabled ? "Enable optimisation mode" : "Disable optimisation mode";
  $("#powerModePill").textContent = enabled ? "STANDBY" : "ACTIVE";
  $("#powerModePill").className = `pill ${enabled ? "info" : "ok"}`;
  $("#powerModeText").textContent = enabled
    ? "Essential systems remain prioritised; optimisation is ready to activate."
    : "Non-essential loads are reduced while communications and safety systems remain prioritised.";
  toast("Power optimisation", enabled ? "Optimisation mode disabled." : "Optimisation mode enabled.");
});

$("#dataUpload")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setActionStatus("uploadStatus", "QUEUED", file.name, `${Math.ceil(file.size / 1024)} KB queued locally for transfer.`, "info");
  toast("Data queued", `${file.name} is ready for an authenticated transfer service.`);
});

/* Restore the last validated browser session, or show the login page. */
restoreSession();
markUnavailable(); renderMaint(); renderObsSelect(); renderObsLog(); renderAlertLog(); renderThreads(); renderDocs();
loadDataset();

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/* A separate ambient 3D object: it belongs to the interface, never the model. */
function startAuroraInterface() {
  const host = document.createElement("div");
  host.id = "aurora-ui";
  host.setAttribute("aria-hidden", "true");
  document.body.prepend(host);

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.set(0, 0, 12);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);

    const aurora = new THREE.Group();
    aurora.position.set(4.6, 1.6, 0);
    aurora.rotation.set(-.45, .18, -.3);
    const materials = [];
    for (let band = 0; band < 5; band += 1) {
      const points = [];
      for (let i = 0; i <= 32; i += 1) {
        const angle = (i / 32) * Math.PI * 2;
        const radius = 1.35 + Math.sin(angle * 3 + band * 1.3) * .18;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * (radius * .55), Math.sin(angle * 2 + band) * .28));
      }
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, .026 + band * .006, 7, true);
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = band * Math.PI / 5;
      mesh.userData.phase = band * .85;
      materials.push(material);
      aurora.add(mesh);
    }
    scene.add(aurora);

    const setAuroraPalette = ({ detail } = {}) => {
      const isDark = detail?.isDark ?? document.documentElement.dataset.theme === "dark";
      const palette = isDark ? ["#4fe0c0", "#6fb7ff", "#b48cff", "#4fe0c0", "#6fb7ff"] : ["#168a9b", "#247cc0", "#7560bd", "#168a9b", "#247cc0"];
      materials.forEach((material, index) => {
        material.color.set(palette[index]);
        material.opacity = isDark ? .42 : .28;
      });
    };
    setAuroraPalette();
    window.addEventListener("polaris:theme-change", setAuroraPalette);

    const resize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
      aurora.position.set(innerWidth < 720 ? 2.4 : 4.6, innerWidth < 720 ? 2.7 : 1.6, 0);
    };
    window.addEventListener("resize", resize);
    resize();
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function render() {
      requestAnimationFrame(render);
      if (!reducedMotion) {
        const time = performance.now() * .00025;
        aurora.rotation.y = time;
        aurora.children.forEach((band) => { band.rotation.x = Math.sin(time * 2 + band.userData.phase) * .18; });
      }
      renderer.render(scene, camera);
    }
    render();
  } catch (error) {
    host.remove();
    console.warn("Ambient aurora could not start", error);
  }
}
startAuroraInterface();

const modelStage = document.querySelector("#modelStage");
const modelPreview = document.querySelector("#modelPreview");
const modelStatus = document.querySelector("#modelStatus");
const modelPill = document.querySelector("#modelPill");
const openModelButton = document.querySelector("#modelOpen");
const resetModelButton = document.querySelector("#modelReset");
const closeModelButton = document.querySelector("#modelClose");

if (modelStage && modelPreview && modelStatus && modelPill && openModelButton) {
  let activeViewer;
  openModelButton.addEventListener("click", openModel);

  function createReferenceLandscapeModel() {
    const group = new THREE.Group();

    const islandGeometry = new THREE.SphereGeometry(4.35, 120, 120);
    const islandPositions = islandGeometry.attributes.position;
    for (let i = 0; i < islandPositions.count; i += 1) {
      const x = islandPositions.getX(i);
      const y = islandPositions.getY(i);
      const z = islandPositions.getZ(i);
      const radial = Math.hypot(x, z);
      const ridge = Math.sin((radial * 9.5) - 1.7) * 0.42 + Math.cos((x * 6.2) + (z * 4.8)) * 0.22 + Math.sin((y * 11) + 2.4) * 0.16;
      const plateau = Math.max(0, y) * 1.45 + ridge;
      islandPositions.setXYZ(i, x * 1.18, plateau * 0.8, z * 1.18);
    }
    islandGeometry.computeVertexNormals();

    const terrain = new THREE.Mesh(
      islandGeometry,
      new THREE.MeshStandardMaterial({ color: "#edf5fb", roughness: 1, metalness: 0.02 })
    );
    terrain.rotation.x = Math.PI;
    terrain.rotation.z = Math.PI * 0.17;
    terrain.scale.set(1.2, 0.7, 1.2);
    terrain.position.y = -0.15;
    group.add(terrain);

    const lakeGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.22, 96);
    const lake = new THREE.Mesh(
      lakeGeometry,
      new THREE.MeshStandardMaterial({ color: "#a7d9f3", transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.1 })
    );
    lake.rotation.x = Math.PI / 2;
    lake.position.y = 0.3;
    group.add(lake);

    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.52, 0.8),
      new THREE.MeshStandardMaterial({ color: "#c6d0db", roughness: 0.85 })
    );
    platform.position.set(0.3, 0.8, 0.1);
    group.add(platform);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.45, 4),
      new THREE.MeshStandardMaterial({ color: "#8a99a8", roughness: 0.9 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0.3, 1.35, 0.1);
    group.add(roof);

    const snowCaps = [
      { x: -1.7, y: 1.2, z: 1.0, r: 0.75 },
      { x: 1.8, y: 1.1, z: -0.8, r: 0.7 },
      { x: 1.2, y: 1.5, z: 1.6, r: 0.9 },
      { x: -1.9, y: 1.35, z: -1.2, r: 0.8 },
      { x: 0.4, y: 1.7, z: 1.9, r: 0.7 },
    ];
    snowCaps.forEach((peak) => {
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(peak.r, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: "#2f3a42", roughness: 0.95, metalness: 0.02 })
      );
      rock.position.set(peak.x, peak.y, peak.z);
      rock.rotation.z = Math.PI * 0.2;
      group.add(rock);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(peak.r * 0.72, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: "#f3f7fb", roughness: 1 })
      );
      cap.position.set(peak.x, peak.y + 0.5, peak.z);
      group.add(cap);
    });

    const iceRings = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.7 + i * 0.32, 0.05, 10, 60),
        new THREE.MeshStandardMaterial({ color: "#dfeef7", roughness: 0.8, metalness: 0.05 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.14 + i * 0.02;
      iceRings.add(ring);
    }
    group.add(iceRings);

    group.rotation.set(-0.6, 0.6, 0);
    group.position.y = -0.35;
    return group;
  }

  function openModel() {
    if (activeViewer) return;
    activeViewer = true;
    modelPreview.hidden = true;
    modelStage.hidden = false;
    openModelButton.hidden = true;
    if (closeModelButton) closeModelButton.hidden = false;
    resetModelButton.disabled = true;
    modelStatus.hidden = false;
    modelStatus.classList.remove("error");
    modelStatus.classList.add("loading");
    modelStatus.textContent = "Starting 3D viewer…";

    let renderer;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#60728a");
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
      camera.position.set(3, 2.4, 4.5);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      modelStage.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 0.2;
      controls.maxDistance = 2000;

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/libs/draco/");
      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);

      scene.add(new THREE.HemisphereLight("#ffffff", "#7895a2", 2.2));
      const keyLight = new THREE.DirectionalLight("#ffffff", 2.6);
      keyLight.position.set(4, 8, 6);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight("#9fdcff", 1.1);
      fillLight.position.set(-5, 3, -4);
      scene.add(fillLight);

      let model;
      let initialCamera;
      let animationFrame;
      let modelObjectUrl;
      let disposed = false;
      const applyViewerTheme = ({ detail } = {}) => {
        const isDark = detail?.isDark ?? document.documentElement.dataset.theme === "dark";
        scene.background = new THREE.Color(isDark ? "#26384f" : "#60728a");
      };
      window.addEventListener("polaris:theme-change", applyViewerTheme);
      applyViewerTheme();
      function resizeModel() {
        const width = modelStage.clientWidth;
        const height = modelStage.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      function frameModel(object) {
        const bounds = new THREE.Box3().setFromObject(object);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z) || 1;
        const distance = largestDimension * 1.7;
        controls.target.copy(center);
        camera.position.set(center.x + distance * .65, center.y + distance * 1.2, center.z + distance * 1.25);
        camera.near = Math.max(largestDimension / 1000, 0.01);
        camera.far = Math.max(largestDimension * 100, 1000);
        camera.updateProjectionMatrix();
        controls.update();
        initialCamera = { position: camera.position.clone(), target: controls.target.clone() };
      }

      function resetModelView() {
        if (!initialCamera) return;
        camera.position.copy(initialCamera.position);
        controls.target.copy(initialCamera.target);
        controls.update();
      }

      resetModelButton?.addEventListener("click", resetModelView);
      const resizeObserver = new ResizeObserver(resizeModel);
      const handleResize = () => resizeModel();
      window.addEventListener("resize", handleResize);
      window.addEventListener("polaris:login-state", handleResize);
      resizeObserver.observe(modelStage);
      resizeModel();

      async function getCachedModelUrl() {
        if ("caches" in window) {
          const cache = await caches.open("polaris-model-v1");
          const cached = await cache.match(MODEL_URL);
          if (cached) {
            modelStatus.textContent = "Loading cached landscape model…";
            modelObjectUrl = URL.createObjectURL(await cached.blob());
            return modelObjectUrl;
          }
        }

        try {
          modelStatus.textContent = "Downloading landscape model for first use…";
          const response = await fetch(MODEL_URL);
          if (!response.ok) throw new Error(`Model request failed (${response.status})`);
          if ("caches" in window) {
            const cache = await caches.open("polaris-model-v1");
            await cache.put(MODEL_URL, response.clone());
          }
          modelObjectUrl = URL.createObjectURL(await response.blob());
          return modelObjectUrl;
        } catch (error) {
          console.warn("GLB asset unavailable; using the built-in reference landscape instead.", error);
          return null;
        }
      }

      getCachedModelUrl().then((modelUrl) => {
        if (!modelUrl) {
          model = createReferenceLandscapeModel();
          scene.add(model);
          frameModel(model);
          resizeModel();
          resetModelButton.disabled = false;
          modelStatus.remove();
          modelPill.textContent = "READY";
          modelPill.className = "pill ok";
          return;
        }

        gltfLoader.load(
          modelUrl,
          (gltf) => {
            if (disposed) return;
            model = gltf.scene;
            scene.add(model);
            frameModel(model);
            resizeModel();
            modelStatus.remove();
            modelPill.textContent = "READY";
            modelPill.className = "pill ok";
            resetModelButton.disabled = false;
          },
          (event) => {
            if (event.total) {
              const percent = Math.round((event.loaded / event.total) * 100);
              modelStatus.textContent = `Loading landscape model… ${percent}%`;
            }
          },
          (error) => {
            if (disposed) return;
            console.warn("GLB failed to load; building the reference landscape instead.", error);
            model = createReferenceLandscapeModel();
            scene.add(model);
            frameModel(model);
            resizeModel();
            modelStatus.remove();
            modelPill.textContent = "READY";
            modelPill.className = "pill ok";
            resetModelButton.disabled = false;
          }
        );
      }).catch((error) => {
        if (disposed) return;
        console.warn("Unable to prepare cached landscape model. Building the reference landscape instead.", error);
        model = createReferenceLandscapeModel();
        scene.add(model);
        frameModel(model);
        resizeModel();
        modelStatus.remove();
        modelPill.textContent = "READY";
        modelPill.className = "pill ok";
        resetModelButton.disabled = false;
      });

      function disposeMaterial(material) {
        Object.values(material).forEach((value) => {
          if (value && typeof value === "object" && "isTexture" in value) value.dispose();
        });
        material.dispose();
      }

      function closeModel() {
        if (!activeViewer) return;
        disposed = true;
        cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("polaris:login-state", handleResize);
        window.removeEventListener("polaris:theme-change", applyViewerTheme);
        resetModelButton?.removeEventListener("click", resetModelView);
        controls.dispose();
        scene.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(disposeMaterial);
        });
        renderer.dispose();
        renderer.domElement.remove();
        dracoLoader.dispose();
        if (modelObjectUrl) URL.revokeObjectURL(modelObjectUrl);
        model = null;
        activeViewer = null;
        modelPreview.hidden = false;
        modelStage.hidden = true;
        modelStage.replaceChildren(modelStatus);
        modelStatus.classList.add("loading");
        modelStatus.classList.remove("error");
        modelStatus.textContent = "Loading landscape model…";
        modelPill.textContent = "PREVIEW";
        modelPill.className = "pill info";
        openModelButton.hidden = false;
        resetModelButton.disabled = true;
        closeModelButton.hidden = true;
      }
      closeModelButton?.addEventListener("click", closeModel);

      function renderModel() {
        animationFrame = requestAnimationFrame(renderModel);
        controls.update();
        renderer.render(scene, camera);
      }
      renderModel();
    } catch (error) {
      activeViewer = null;
      modelPreview.hidden = false;
      modelStage.hidden = true;
      openModelButton.hidden = false;
      modelStatus.hidden = false;
      modelStatus.textContent = "3D viewer could not start in this browser.";
      modelStatus.classList.add("error");
      console.error("Unable to start 3D viewer", error);
    }
  }
}
