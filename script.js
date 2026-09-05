import { createClient } from "@supabase/supabase-js";

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
const MODEL_URL = new URL(
  ((typeof window !== "undefined" && window.__ENV__?.MODEL_URL) || "assets/landscape.glb"),
  document.baseURI
).href;

const loginForm = $("#loginForm");
const loginStatus = $("#loginStatus");

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

function setUserSession() {
  localStorage.setItem("polaris-login-state", "authenticated");
  document.body.classList.add("logged-in");
  window.dispatchEvent(new Event("polaris:login-state"));
}

async function restoreSession() {
  if (localStorage.getItem("polaris-login-state") === "authenticated") {
    setUserSession();
    return;
  }
  document.body.classList.remove("logged-in");
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

  if (!email || !password) {
    setLoginMessage("Please enter both your email and password.", "error");
    return;
  }

  setLoginMessage("Checking credentials…");

  try {
    const user = await validateLoginCredentials(email, password);
    setLoginMessage(`Welcome, ${user.name || user.username || user.email}.`, "success");
    setUserSession();
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
  localStorage.removeItem("polaris-login-state");
  document.body.classList.remove("logged-in");
  toast("Signed out", "Your session has ended.");
});

/* Module navigation */
$$("#modnav .tab").forEach(tab=>tab.addEventListener("click",()=>{
  $$("#modnav .tab").forEach(t=>t.setAttribute("aria-selected",String(t===tab)));
  $$(".module").forEach(m=>m.classList.toggle("active",m.id===tab.dataset.mod));
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
  $("#maintList").innerHTML=MAINT.map(([t,s],i)=>`<label class="row check ${maintState[i]?"done":""}"><input type="checkbox" data-i="${i}" ${maintState[i]?"checked":""}/><div class="txt"><b>${t}</b><span class="mono">${s}</span></div></label>`).join("");
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
  const el=$("#obsAsset"); if(el)el.innerHTML='<option value="">Select an asset</option><option>Research site</option><option>Historic installation</option><option>Runway / access route</option>';
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

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const modelStage = document.querySelector("#modelStage");
const modelPreview = document.querySelector("#modelPreview");
const modelStatus = document.querySelector("#modelStatus");
const modelPill = document.querySelector("#modelPill");
const openModelButton = document.querySelector("#modelOpen");
const resetModelButton = document.querySelector("#modelReset");
const closeModelButton = document.querySelector("#modelClose");

if (modelStage && modelPreview && modelStatus && modelPill && openModelButton) {
  let activeViewer;

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
  scene.background = new THREE.Color("#dceff5");
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
    camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
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
    if (!("caches" in window)) return MODEL_URL;

    const cache = await caches.open("polaris-model-v1");
    const cached = await cache.match(MODEL_URL);
    if (cached) {
      modelStatus.textContent = "Loading cached landscape model…";
      modelObjectUrl = URL.createObjectURL(await cached.blob());
      return modelObjectUrl;
    }

    modelStatus.textContent = "Downloading landscape model for first use…";
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Model request failed (${response.status})`);
    await cache.put(MODEL_URL, response.clone());
    modelObjectUrl = URL.createObjectURL(await response.blob());
    return modelObjectUrl;
  }

  getCachedModelUrl().then((modelUrl) => gltfLoader.load(
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
      modelStatus.classList.remove("loading");
      modelStatus.textContent = "3D model loaded.";
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
      console.error("Unable to load landscape model", error);
      modelStatus.textContent = "Unable to load the landscape model. Check the asset path and network connection.";
      modelStatus.classList.remove("loading");
      modelStatus.classList.add("error");
      modelPill.textContent = "UNAVAILABLE";
      modelPill.className = "pill bad";
    }
  )).catch((error) => {
    if (disposed) return;
    console.error("Unable to prepare cached landscape model", error);
    modelStatus.textContent = "Unable to load the landscape model. Check the asset path and network connection.";
    modelStatus.classList.remove("loading");
    modelStatus.classList.add("error");
    modelPill.textContent = "UNAVAILABLE";
    modelPill.className = "pill bad";
    openModelButton.disabled = false;
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

  openModelButton.addEventListener("click", () => {
    openModel();
  });
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
