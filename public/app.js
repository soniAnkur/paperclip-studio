// Paperclip Studio: a white "keynote" stage with one character per agent of any
// Paperclip company, plus plain-language panels. Data: /api/state (read-only).
import * as THREE from "three";
import { makeCharacter, kitFor, KIT_COLOR } from "./characters.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let S = null; // latest /api/state snapshot
const POLL_MS = 4000;
const ROBOT_HEIGHT = 2.25; // character height incl. scale
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Company to show: /c/<PREFIX> or ?company=<prefix|id>. None -> the company picker.
const COMPANY = decodeURIComponent((location.pathname.match(/^\/c\/([^/]+)/) || [])[1] || new URLSearchParams(location.search).get("company") || "");
const STATUS_COLOR = { working: "#30d158", ready: "#0a84ff", waiting: "#ff9f0a", free: "#d1d1d6", error: "#ff3b30", paused: "#ff3b30" };
const STATE_WORDS = { working: "Working", ready: "Up next", waiting: "Waiting", free: "Free", error: "Needs attention", paused: "Paused" };
// Accent per agent: its kit's colour; a second, different agent with the same kit gets a hue shift.
const ACCENTS = new Map();
const accent = (n) => ACCENTS.get(n) || "#8e8e93";
function assignAccents(list) {
  const used = {};
  for (const a of list) {
    if (ACCENTS.has(a.name)) continue;
    if (a.group !== a.name && ACCENTS.has(a.group)) {
      ACCENTS.set(a.name, ACCENTS.get(a.group));
      continue;
    }
    const kit = kitFor(a);
    const k = (used[kit] = (used[kit] ?? -1) + 1);
    const c = new THREE.Color(KIT_COLOR[kit] || "#8e8e93");
    if (k) c.offsetHSL(((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.07), 0, 0);
    ACCENTS.set(a.name, "#" + c.getHexString());
  }
}
// Stage labels need to stay short enough that crowded org charts don't collide. Prefer the
// most specific part of a name ("Persona · Maren Okafor, Partner (fictional)" -> "Maren Okafor"),
// then hard-cap the rest.
const shortName = (n) => {
  n = String(n || "");
  const seg = n.includes(" · ") ? n.split(" · ").pop().trim() : n;
  let s = seg.replace(/\s*\([^)]*\)\s*$/, "").split(",")[0].trim();
  s = s.replace(/^([A-Z][a-z]+)(?=[A-Z])/, ""); // "IntentGuardian" -> "Guardian"
  return clipText(s || n, 20);
};

// ---------------------------------------------------------------- utils
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function since(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const ago = (iso) => {
  const t = since(iso);
  return t === "just now" ? t : `${t} ago`;
};
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- 3D stage
const canvas = $("#stage");
if (matchMedia("(hover: none)").matches) $("#hint").textContent = "Tap an agent to turn it around";
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const BG = new THREE.Color("#f5f5f7");
scene.background = BG;
scene.fog = new THREE.Fog(BG, 26, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e9ee, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-6, 14, 9);
key.castShadow = true;
key.shadow.mapSize.set(1536, 1536);
key.shadow.camera.left = -14;
key.shadow.camera.right = 14;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -8;
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
rim.position.set(8, 6, -10);
scene.add(rim);

// Infinite white cyclorama
const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 96), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.09 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Shared geometry
const pedestalGeo = new THREE.CylinderGeometry(0.78, 0.84, 0.16, 64);
const pedestalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 });
const ringGeo = new THREE.TorusGeometry(0.86, 0.022, 12, 96);
const hitGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.3, 16);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

const agents = new Map(); // name -> view

let narrow = false;
const VIEW = { w: 1, h: 1 }; // canvas size, cached on resize so the frame loop never forces layout
let stageHalf = 10.4; // fitted to the team size

// Replicas (Builder, Builder2, ...) share one slot, stacked like a deck to read as parallel copies.
function squads(list) {
  const out = [];
  for (const a of list) {
    const role = a.group || a.name;
    const s = out.find((x) => x.role === role);
    if (s) s.members.push(a);
    else out.push({ role, members: [a] });
  }
  return out;
}
// Replica squads (the same agent run N times in parallel) fan out side by side in a shallow
// crescent, the lead copy centered and most forward — never one body hidden directly behind
// another, the way a single-file queue would.
function replicaOffset(j, total) {
  if (total <= 1) return new THREE.Vector3(0, 0, 0);
  const t = j - (total - 1) / 2;
  const spacing = total > 5 ? 0.42 : 0.56;
  return new THREE.Vector3(t * spacing, 0, -Math.abs(t) * 0.22);
}
const squadScale = (total) => Math.max(0.78, 1 - Math.max(0, total - 1) * 0.05);

function layoutPositions(n) {
  if (narrow) {
    // Phones: tiered 3-column grid, back rows raised like risers.
    const cols = 3, gapX = 2.3, gapZ = 3.7;
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      return new THREE.Vector3((c - (cols - 1) / 2) * gapX, 0, -r * gapZ + gapZ);
    });
  }
  // Desktop: gentle amphitheatre arc that faces the camera.
  const R = Math.max(13, n * 1.35);
  const spread = THREE.MathUtils.degToRad(Math.min(72, 10.5 * (n - 1)) * (13 / R));
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const a = t * spread;
    return new THREE.Vector3(R * Math.sin(a), 0, R * (1 - Math.cos(a)) * 0.9);
  });
}
function fitStage(pos) {
  const half = Math.max(6, ...pos.map((p) => Math.abs(p.x))) + 1.9;
  if (Math.abs(half - stageHalf) > 0.05) {
    stageHalf = half;
    fitCamera();
  }
}

function makeAgentView(a) {
  const color = accent(a.name);
  const group = new THREE.Group(); // positioned on the stage
  const lift = new THREE.Group(); // hover lift
  const turn = new THREE.Group(); // turntable spin
  group.add(lift);
  lift.add(turn);

  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.08;
  pedestal.castShadow = pedestal.receiveShadow = true;
  turn.add(pedestal);

  const ringMat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR.free, transparent: true, opacity: 0.9, toneMapped: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.165;
  lift.add(ring);

  const char = makeCharacter(a, color);
  char.root.position.y = 0.16;
  char.root.scale.setScalar(1.15);
  char.root.traverse((o) => o.isMesh && (o.castShadow = true));
  turn.add(char.root);

  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.y = 1.2;
  hit.userData.name = a.name;
  group.add(hit);
  scene.add(group);

  return {
    name: a.name,
    group, lift, turn, ring, ringMat, hit, char,
    data: a,
    hover: 0,
    spin: 0,
    targetPos: new THREE.Vector3(),
    lastGesture: 0,
    gesture(name) {
      const now = performance.now();
      if (now - this.lastGesture < 3500) return;
      this.lastGesture = now;
      this.char.gesture(name);
    },
  };
}

let squadOf = new Map(); // name -> { role, members, index }
function syncAgents(list) {
  assignAccents(list);
  const groups = squads(list);
  const pos = layoutPositions(groups.length);
  if (!narrow) timed("fitStage", () => fitStage(pos));
  squadOf = new Map();
  let wi = 0;
  groups.forEach((g, si) => {
    g.members.forEach((a, j) => {
      squadOf.set(a.name, { ...g, index: j });
      const p = pos[si].clone().add(replicaOffset(j, g.members.length));
      let v = agents.get(a.name);
      if (!v) {
        v = timedValue("make:" + a.name, () => makeAgentView(a));
        v.group.position.copy(p);
        v.phase = Math.random() * Math.PI * 2;
        agents.set(a.name, v);
      }
      v.targetPos.copy(p);
      v.liftScale = squadScale(g.members.length);
      v.group.rotation.y = narrow ? 0 : Math.atan2(-pos[si].x * 0.6, 22);
      const prev = v.data?.state;
      v.data = a;
      v.ringMat.color.set(STATUS_COLOR[a.state] || STATUS_COLOR.free);
      v.stagger = a.state === "working" ? (wi++ % 2) * 0.55 : 0;
      v.char.setState(a.state === "ready" ? "free" : a.state);
      if (prev && prev !== a.state && a.state === "working") v.gesture("nod");
      if (prev === "working" && a.state !== "working") v.gesture("cheer");
    });
  });
  for (const [name, v] of agents)
    if (!list.find((a) => a.name === name)) {
      scene.remove(v.group);
      agents.delete(name);
    }
  timed("flows", syncFlows);
}

// ---------------------------------------------------------------- where work goes next
// A route per agent: its reviewers in order, then whoever picks up the unlocked stage.
const flows = new Map(); // agent name -> { obj, curve, dots, sig, nodes }
const flowGroup = new THREE.Group();
scene.add(flowGroup);
const dotGeo = new THREE.SphereGeometry(0.055, 16, 16);
function routeOf(a) {
  if (!a.next) return [];
  const steps = a.next.reviewers.map((r) => ({ to: r, label: `reviews ${a.task?.code || ""}`.trim() }));
  for (const u of a.next.unlocks) if (u.owner) steps.push({ to: u.owner, label: `next · ${clipText(`${u.key} ${u.name}`, 34)}`, next: true });
  // Merge consecutive steps that land on the same agent.
  return steps.filter((s, i) => agents.has(s.to) && !(i && steps[i - 1].to === s.to && !s.next));
}
function syncFlows() {
  const want = new Set();
  for (const v of agents.values()) {
    const a = v.data;
    const route = routeOf(a);
    if (!route.length || !(a.state === "working" || focus === a.name)) continue;
    want.add(a.name);
    const pts = [v.targetPos.clone().setY(v.targetPos.y + 1.25), ...route.map((s) => { const t2 = agents.get(s.to).targetPos; return t2.clone().setY(t2.y + 1.25); })];
    const sig = JSON.stringify(pts.map((p) => [p.x.toFixed(2), p.z.toFixed(2)])) + route.map((s) => s.label).join("|");
    const f = flows.get(a.name);
    if (f && f.sig === sig) continue;
    if (f) flowGroup.remove(f.obj);
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y = 2.5 + p0.distanceTo(p1) * 0.14;
      mid.z += 0.8;
      path.add(new THREE.QuadraticBezierCurve3(p0, mid, p1));
    }
    const color = new THREE.Color(accent(a.name));
    const obj = new THREE.Group();
    const tubeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false });
    obj.add(new THREE.Mesh(new THREE.TubeGeometry(path, 220, 0.012, 6), tubeMat));
    const dotMat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true });
    const dots = [0, 1, 2].map(() => {
      const d = new THREE.Mesh(dotGeo, dotMat);
      obj.add(d);
      return d;
    });
    const ends = route.map((s, i) => ({ ...s, at: pts[i + 1] }));
    flowGroup.add(obj);
    flows.set(a.name, { obj, path, dots, sig, tubeMat, dotMat, ends, from: a.name });
  }
  for (const [name, f] of flows)
    if (!want.has(name)) {
      flowGroup.remove(f.obj);
      flows.delete(name);
    }
  renderFlowChips();
}
function updateFlows(t) {
  for (const f of flows.values()) {
    const on = !focus || focus === f.from;
    f.tubeMat.opacity = damp3(f.tubeMat.opacity, on ? (focus ? 0.55 : 0.28) : 0.06);
    f.dotMat.opacity = on ? 1 : 0.15;
    f.dots.forEach((d, i) => {
      const u = (t * 0.07 + i / 3) % 1;
      d.position.copy(f.path.getPointAt(u));
      d.scale.setScalar(0.6 + 0.4 * Math.sin(u * Math.PI));
    });
  }
}
const damp3 = (a, b) => a + (b - a) * 0.08;
const clipText = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// Camera: keynote-style slow drift; eases toward a hovered/pinned agent.
const camBase = { pos: new THREE.Vector3(0, 4.4, 24), look: new THREE.Vector3(0, 1.2, 1.4) };
const camPos = new THREE.Vector3().copy(camBase.pos);
const camLook = new THREE.Vector3().copy(camBase.look);
let focus = null; // name of hovered/pinned agent
let pinned = null;

function fitCamera() {
  const w = (VIEW.w = canvas.clientWidth), h = (VIEW.h = canvas.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wasNarrow = narrow;
  narrow = camera.aspect < 0.9;
  const halfWidth = narrow ? 3.7 : stageHalf;
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  if (narrow) {
    const dist = Math.max(14, halfWidth / Math.tan(hfov / 2));
    camBase.pos.set(0, dist * 0.78, dist * 0.92);
    camBase.look.set(0, -0.6, -1.6);
  } else {
    const dist = Math.max(22, halfWidth / Math.tan(hfov / 2));
    camBase.pos.set(0, 3.6 + dist * 0.07, dist + 1.4);
    camBase.look.set(0, 3.9, 1.4);
  }
  camera.updateProjectionMatrix();
  if (wasNarrow !== narrow && S) syncAgents(S.agents);
}
addEventListener("resize", fitCamera);
fitCamera();

// Pointer / hover
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointerInside = false;
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...agents.values()].map((v) => v.hit));
  return hits[0]?.object.userData.name || null;
}
let dragging = null;
canvas.addEventListener("pointermove", (e) => {
  pointerInside = true;
  if (dragging && pinned) {
    const v = agents.get(pinned);
    v.spin += (e.clientX - dragging) * 0.012;
    dragging = e.clientX;
    return;
  }
  const name = pick(e);
  canvas.classList.toggle("pointing", !!name);
  if (pinned) return;
  // Debounce leaving so moving between robots doesn't flicker the card and camera.
  clearTimeout(leaveTimer);
  if (name) setFocus(name);
  else leaveTimer = setTimeout(() => !pinned && setFocus(null), 220);
});
let leaveTimer;
canvas.addEventListener("pointerleave", () => {
  pointerInside = false;
  if (!pinned) setFocus(null);
});
canvas.addEventListener("pointerdown", (e) => {
  const name = pick(e);
  if (name && name === pinned) dragging = e.clientX;
});
addEventListener("pointerup", () => (dragging = null));
canvas.addEventListener("click", (e) => {
  const name = pick(e);
  if (name) {
    pinned = name;
    setFocus(name);
  } else {
    pinned = null;
    setFocus(null);
  }
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") (pinned = null), setFocus(null);
});

function setFocus(name) {
  if (focus === name) return;
  const prev = focus && agents.get(focus);
  focus = name;
  const v = name && agents.get(name);
  if (v) v.gesture("wave");
  if (S) syncFlows();
  $("#hint").style.opacity = name ? 0 : 1;
  if (S) renderLabels();
  document.body.classList.toggle("focused", !!name);
  renderCard();
}

// Labels projected from 3D
const labelsEl = $("#labels");
const labelEls = new Map();
function ensureLabel(name) {
  let el = labelEls.get(name);
  if (!el) {
    el = { tag: document.createElement("div"), bubble: document.createElement("div") };
    el.tag.className = "tag";
    el.bubble.className = "bubble";
    labelsEl.append(el.tag, el.bubble);
    labelEls.set(name, el);
  }
  return el;
}
function renderLabels() {
  for (const [name, v] of agents) {
    const a = v.data;
    const el = ensureLabel(name);
    const sq = squadOf.get(name);
    let short = a.state === "working" && a.task ? clipText(`${a.task.code || ""} ${a.task.stream ? "· " + a.task.stream : a.task.code ? "" : a.task.title}`.trim(), 34) : STATE_WORDS[a.state];
    let title = shortName(name);
    let dots = `<i class="dot ${a.state}"></i>`;
    if (sq && sq.members.length > 1) {
      // One tag for the whole replica stack.
      const n = sq.members.length, busy = sq.members.filter((m) => m.state === "working").length;
      title = `${sq.role} ×${n}`;
      dots = sq.members.map((m) => `<i class="dot ${m.state}"></i>`).join("");
      short = busy === n ? `All ${n} working in parallel` : busy ? `${busy} of ${n} working in parallel` : `${n} replicas · ${STATE_WORDS[a.state].toLowerCase()}`;
    }
    el.tag.hidden = !!(sq && sq.index > 0);
    const html = `<span class="nm">${dots}${esc(title)}</span><span class="st">${esc(short)}</span>`;
    if (el.tag.dataset.h !== html) (el.tag.innerHTML = html), (el.tag.dataset.h = html);
    const say = a.state === "working" ? a.doing : null;
    const bh = say ? `<span class="k">Now</span><span class="t">${esc(say)}</span>` : "";
    if (el.bubble.dataset.h !== bh) (el.bubble.innerHTML = bh), (el.bubble.dataset.h = bh);
    el.bubble.style.display = say && (!narrow || focus === name) ? "" : "none";
  }
}
const chipEls = new Map();
function renderFlowChips() {
  const want = new Map();
  for (const f of flows.values())
    for (const e of f.ends) {
      const k = `${e.to}|${e.label}`;
      if (!want.has(k)) want.set(k, { ...e, from: [f.from] });
      else want.get(k).from.push(f.from);
    }
  for (const [k, e] of want) {
    let el = chipEls.get(k);
    if (!el) {
      el = document.createElement("div");
      el.className = "flowchip";
      labelsEl.append(el);
      chipEls.set(k, el);
    }
    el.className = `flowchip${e.next ? " next" : ""}`;
    el.innerHTML = `<span>${esc(e.label)}</span>`;
    el._e = e;
  }
  for (const [k, el] of chipEls) if (!want.has(k)) el.remove(), chipEls.delete(k);
}
const tmp = new THREE.Vector3();
const setStyle = (el, k, v) => {
  if (el["_" + k] !== v) (el["_" + k] = v), (el.style[k] = v);
};
function placeLabels() {
  const W = VIEW.w, H = VIEW.h;
  const px = (v) => Math.round(v * 10) / 10;
  const stack = new Map();
  for (const el of chipEls.values()) {
    const e = el._e;
    const v = agents.get(e.to);
    if (!v) continue;
    const n = stack.get(e.to) || 0;
    stack.set(e.to, n + 1);
    v.group.getWorldPosition(tmp);
    tmp.y = v.group.position.y + ROBOT_HEIGHT + 0.5;
    tmp.project(camera);
    setStyle(el, "transform", `translate(-50%, -100%) translate(${px(((tmp.x + 1) / 2) * W)}px, ${px(((1 - tmp.y) / 2) * H - n * 30)}px)`);
    setStyle(el, "opacity", !focus || e.from.includes(focus) ? "1" : "0.15");
    setStyle(el, "visibility", v.group.visible && (v.show ?? 1) > 0.5 && !(narrow && !focus) ? "visible" : "hidden");
  }
  for (const [name, v] of agents) {
    const el = labelEls.get(name);
    if (!el) continue;
    v.group.getWorldPosition(tmp);
    tmp.y = v.group.position.y - 0.05;
    tmp.project(camera);
    setStyle(el.tag, "transform", `translate(-50%, 0) translate(${px(((tmp.x + 1) / 2) * W)}px, ${px(((1 - tmp.y) / 2) * H + 6)}px)`);
    v.group.getWorldPosition(tmp);
    tmp.y = v.group.position.y + ROBOT_HEIGHT + 0.55 + v.lift.position.y + (v.stagger || 0);
    tmp.project(camera);
    setStyle(el.bubble, "transform", `translate(-50%, -100%) translate(${px(((tmp.x + 1) / 2) * W)}px, ${px(((1 - tmp.y) / 2) * H)}px)`);
    const dim = !!(focus && focus !== name);
    if (el.tag._dim !== dim) (el.tag._dim = dim), el.tag.classList.toggle("dim", dim);
    const vis = v.group.visible && v.show > 0.5 ? "visible" : "hidden";
    setStyle(el.tag, "visibility", vis);
    setStyle(el.bubble, "visibility", vis);
    setStyle(el.bubble, "opacity", dim ? "0.25" : "1");
  }
}

// Render loop
const clock3 = new THREE.Clock();
function frame() {
  const dt = Math.min(clock3.getDelta(), 0.05);
  const t = clock3.elapsedTime;
  for (const v of agents.values()) {
    v.char.update(dt, t);
    const isFocus = focus === v.name;
    v.hover += ((isFocus ? 1 : 0) - v.hover) * Math.min(1, dt * 6);
    v.lift.position.y = v.hover * 0.22;
    v.curScale = v.curScale === undefined ? v.liftScale ?? 1 : v.curScale + ((v.liftScale ?? 1) - v.curScale) * Math.min(1, dt * 4);
    v.lift.scale.setScalar(v.curScale);
    // 360° turntable while hovered; ease back to facing forward otherwise.
    if (isFocus && !dragging) v.spin += dt * (REDUCED ? 0.6 : 1.5);
    else if (!isFocus) v.spin += (Math.round(v.spin / (Math.PI * 2)) * Math.PI * 2 - v.spin) * Math.min(1, dt * 2.5);
    v.turn.rotation.y = v.spin;
    const st = v.data.state;
    const pulse = st === "working" ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.4 + v.phase)) : st === "waiting" ? 0.75 + 0.15 * Math.sin(t * 1.2 + v.phase) : 0.85;
    v.ringMat.opacity = pulse;
    v.ring.scale.setScalar(1 + v.hover * 0.06);
    v.group.position.lerp(v.targetPos, Math.min(1, dt * 3));
    // Phones: spotlight the focused agent; the rest step away.
    const show = narrow && focus && !isFocus ? 0 : 1;
    v.show = (v.show ?? 1) + (show - (v.show ?? 1)) * Math.min(1, dt * 5);
    v.group.scale.setScalar(Math.max(0.001, v.show));
    v.group.visible = v.show > 0.02;
  }

  // Camera
  const f = focus && agents.get(focus);
  const drift = REDUCED ? 0 : 1;
  const want = new THREE.Vector3().copy(camBase.pos);
  const look = new THREE.Vector3().copy(camBase.look);
  want.x += Math.sin(t * 0.08) * 1.6 * drift;
  want.y += Math.sin(t * 0.11) * 0.25 * drift;
  if (f) {
    const p = f.group.position;
    if (narrow) {
      // The detail sheet covers the lower half on phones, so frame the robot up high.
      want.set(p.x, 7.5, p.z + 16);
      look.set(p.x, -1.9, p.z);
    } else {
      want.lerp(new THREE.Vector3(p.x * 0.85, 2.4, p.z + 9.5), 0.55);
      look.lerp(new THREE.Vector3(p.x, 1.05, p.z), 0.75);
    }
  }
  camPos.lerp(want, Math.min(1, dt * 1.8));
  camLook.lerp(look, Math.min(1, dt * 2.2));
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  updateFlows(t);
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- HTML panels

function avatar(name, cls = "av") {
  return `<span class="${cls}" style="background:${accent(name)}">${esc(name[0])}</span>`;
}

function renderHero() {
  const s = S.summary;
  const working = S.agents.filter((a) => a.state === "working");
  $("#eyebrow").textContent = `${S.company.name} · ${plural(s.total, "agent", "agents")}`;
  let h;
  if (s.paused === s.total && s.total) h = `The studio is <span class="grad">paused.</span>`;
  else if (s.attention) h = `${plural(s.attention, "agent needs", "agents need")} <span class="grad">a look.</span>`;
  else if (s.working === 0) h = `All quiet. <span class="grad">Everyone's free.</span>`;
  else if (s.working === s.total) h = `Everyone's <span class="grad">at work.</span>`;
  else h = `${s.working === 1 ? "One agent" : `${cap(numWord(s.working))} agents`} <span class="grad">at work.</span>`;
  if ($("#headline").innerHTML !== h) $("#headline").innerHTML = h;

  const bits = [];
  if (working.length) {
    const shown = working.slice(0, 3).map((a) => `<b>${esc(a.name)}</b> on ${esc(clipText(a.task?.stream || a.task?.title || "a task", 40))}`);
    if (working.length > 3) shown.push(`${working.length - 3} more`);
    bits.push(shown.join(", "));
  }
  const rest = [];
  if (s.ready) rest.push(`${s.ready} up next`);
  if (s.waiting) rest.push(`${s.waiting} waiting on earlier stages`);
  if (s.free) rest.push(`${s.free} free`);
  if (s.paused) rest.push(`${s.paused} paused`);
  if (rest.length) bits.push(rest.join(" · "));
  $("#subline").innerHTML = bits.join(". ") + ".";
}
const numWord = (n) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function tileHTML(a) {
  const on = a.task ? `${esc(a.task.title)}${a.task.stream ? ` · ${esc(a.task.stream)}` : ""}` : "";
  if (a.state === "working")
    return `<div class="tile working" data-name="${esc(a.name)}">
      <div class="top">${avatar(a.name)}<div><div class="nm">${esc(a.name)}</div><div class="rl">${a.title !== a.name ? esc(a.title) : esc(a.model)}</div></div><span class="el" data-since="${esc(a.since)}"></span></div>
      <div class="what">${esc(a.doing || "Working")}</div>
      <div class="on">${on}</div></div>`;
  const line =
    a.state === "waiting" ? `Waiting to start ${on}` : a.state === "ready" ? `Next: ${on}` : a.state === "free" ? `Last active ${ago(a.lastSeen)}` : esc(a.error || STATE_WORDS[a.state]);
  return `<div class="tile small" data-name="${esc(a.name)}">
    <div class="top">${avatar(a.name)}<div><div class="nm">${esc(a.name)}</div><div class="rl">${a.title !== a.name ? esc(a.title) : esc(a.model)}</div></div></div>
    <div class="on">${line}</div></div>`;
}

function renderPapers() {
  const live = S.workstreams.filter((p) => !p.shipped).slice(0, 6);
  const shipped = S.workstreams.filter((p) => p.shipped).slice(0, 8);
  const html =
    live
      .map((p) => {
        const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
        const now = p.current ? `Now: <b>${esc(clipText(`${p.current.key} ${p.current.name}`, 60))}</b>${p.current.owner ? ` with ${esc(p.current.owner)}` : ""}` : "Waiting for the next step";
        // Long workstreams become one continuous bar instead of dozens of segments.
        const track =
          p.steps.length <= 18
            ? p.steps.map((s) => `<div class="seg ${s.status}" title="${esc(s.key)} ${esc(s.name)}${s.owner ? " · " + esc(s.owner) : ""}"><div class="b"></div><div class="k">${esc(s.key)}</div></div>`).join("")
            : `<div class="seg wide"><div class="b"><span class="fill" style="width:${pct}%"></span></div><div class="k">${p.done} done · ${p.steps.filter((x) => x.status === "active" || x.status === "review").length} in progress · ${p.total - p.done} to go</div></div>`;
        return `<article class="paper"><div class="ph"><h3>${esc(p.title)}</h3><span class="pct">${pct}%</span></div><div class="now">${now} · ${p.done} of ${p.total} done</div><div class="track">${track}</div></article>`;
      })
      .join("") || `<div class="empty">Nothing in flight right now.</div>`;
  if ($("#paperList").dataset.h !== html) ($("#paperList").innerHTML = html), ($("#paperList").dataset.h = html);
  const sh = shipped.length ? `<span class="lab">Done</span>${shipped.map((p) => `<span class="chip"><span class="ck">✓</span>${esc(clipText(p.title, 44))}</span>`).join("")}` : "";
  if ($("#shipped").dataset.h !== sh) ($("#shipped").innerHTML = sh), ($("#shipped").dataset.h = sh);
}

// Keyed updates: a tile is only touched when its own content changes, and only brand-new
// tiles/items animate in. Avoids re-laying-out the whole board on every refresh.
function htmlToEl(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function renderBoard() {
  const board = $("#board");
  const by = (st) => S.agents.filter((a) => st.includes(a.state));
  const cols = [
    ["Working", "working", by(["working"])],
    ["Up next or waiting", "waiting", by(["ready", "waiting", "error", "paused"])],
    ["Free", "free", by(["free"])],
  ];
  if (!board.children.length) board.innerHTML = cols.map(() => `<div class="col"><h4></h4><div class="list"></div></div>`).join("");
  const tiles = (board._tiles ||= new Map());
  const keep = new Set();
  cols.forEach(([t, d, list], i) => {
    const col = board.children[i];
    const h = `<i class="dot ${d}"></i>${t} <span class="n">${list.length}</span>`;
    if (col.firstElementChild.innerHTML !== h) col.firstElementChild.innerHTML = h;
    const box = col.lastElementChild;
    box.querySelector(".empty")?.remove();
    let prev = null;
    for (const a of list) {
      keep.add(a.name);
      const html = tileHTML(a);
      let el = tiles.get(a.name);
      if (!el || el._h !== html) {
        const fresh = htmlToEl(html);
        if (!el) fresh.classList.add("enter");
        if (el) el.replaceWith(fresh);
        el = fresh;
        el._h = html;
        tiles.set(a.name, el);
      }
      const want = prev ? prev.nextElementSibling : box.firstElementChild;
      if (want !== el) prev ? prev.after(el) : box.prepend(el);
      prev = el;
    }
    if (!list.length) box.insertAdjacentHTML("beforeend", `<div class="empty">Nobody right now.</div>`);
  });
  for (const [name, el] of tiles) if (!keep.has(name)) el.remove(), tiles.delete(name);
  tickTimes();
}
function renderFeed() {
  const ul = $("#feed");
  const key = (f) => f.ts + "|" + f.text;
  const have = new Map([...ul.children].map((li) => [li._k, li]));
  const first = !ul.children.length;
  let prev = null;
  for (const f of S.feed.slice(0, 10)) {
    let li = have.get(key(f));
    if (!li) {
      li = htmlToEl(`<li class="${f.tone}${first ? "" : " enter"}"><span class="tm" data-ago="${esc(f.ts)}"></span><span class="tx"><i></i>${esc(f.text)}</span>${f.group ? `<span class="pp">${esc(clipText(f.group, 28))}</span>` : "<span></span>"}</li>`);
      li._k = key(f);
    }
    have.delete(key(f));
    const want = prev ? prev.nextElementSibling : ul.firstElementChild;
    if (want !== li) prev ? prev.after(li) : ul.prepend(li);
    prev = li;
  }
  for (const li of have.values()) li.remove();
}

function renderCard() {
  const card = $("#card");
  const v = focus && agents.get(focus);
  if (!v) {
    card.hidden = true;
    card.dataset.name = "";
    return;
  }
  const a = v.data;
  const task = a.task ? `<div class="lbl">${a.state === "working" ? "Working on" : a.state === "free" ? "Last task" : "Next up"}</div><div class="big">${esc(a.task.title)}</div><div class="muted">${esc(a.task.stream || "")}${a.task.stream && a.task.ident ? " · " : ""}${esc(a.task.ident || "")}</div>` : "";
  const doing = a.state === "working" ? `<div class="lbl">Right now</div><div class="big">${esc(a.doing || "Getting started")}</div>${a.thought ? `<div class="muted" style="margin-top:6px">“${esc(a.thought)}”</div>` : ""}` : "";
  const nx = a.next;
  const short2 = (n) => (n ? shortName(n) : "Unassigned");
  const route = nx && (nx.reviewers.length || nx.unlocks.length)
    ? `<div class="lbl">Where it goes next</div><ol class="route">${nx.reviewers.map((r) => `<li><b>${esc(short2(r))}</b> <span class="sm">reviews it</span></li>`).join("")}${nx.unlocks
        .map((u) => `<li class="nx"><b>${esc(short2(u.owner))}</b> <span class="sm">starts ${esc(u.key)} ${esc(u.name)}${u.alsoNeeds?.length ? ` · also needs ${esc(u.alsoNeeds.join(", "))}` : ""}</span></li>`)
        .join("")}</ol>`
    : "";
  const steps = a.state === "working" && a.steps.length > 1 ? `<div class="lbl">Just before</div><ul>${a.steps.slice(1).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "";
  const when = a.state === "working" ? `Working for ${since(a.since)}` : a.lastSeen ? `Last active ${ago(a.lastSeen)}` : "Not run yet";
  const html = `
    ${pinned ? `<button class="close" aria-label="Close">×</button>` : ""}
    <div class="who">${avatar(a.name)}<div><h3>${esc(a.name)}</h3>${a.title && a.title !== a.name ? `<div class="role">${esc(a.title)}</div>` : ""}</div></div>
    <div class="row"><span class="pill"><i class="dot ${a.state}"></i>${STATE_WORDS[a.state]}</span>${a.model ? `<span class="pill model ${a.model.startsWith("Opus") ? "opus" : ""}">${esc(a.model)}</span>` : ""}<span class="pill">${esc(when)}</span></div>
    ${doing}${task}${route}${steps}
    <div class="lbl">Role</div><div class="muted">${esc(a.about)}</div>`;
  if (card.dataset.h !== html) {
    card.innerHTML = html;
    card.dataset.h = html;
    card.querySelector(".close")?.addEventListener("click", () => ((pinned = null), setFocus(null)));
  }
  if (card.hidden || card.dataset.name !== a.name) {
    card.hidden = false;
    // Web Animations: replays the entrance without forcing a synchronous page layout.
    card.animate([{ opacity: 0, transform: `${narrow ? "translateY(12px)" : "translateY(-36%) scale(.97)"}` }, { opacity: 1, transform: narrow ? "none" : "translateY(-40%)" }], { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  card.dataset.name = a.name;
}

// One-line live feed under the headline: rotates through who's doing what.
let tickerLines = [], tickerIdx = 0, tickerTimer = null;
const join = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const short = (n) => shortName(n);
function renderTicker() {
  const lines = [];
  for (const a of S.agents.filter((x) => x.state === "working"))
    lines.push({ dot: "working", who: a.name, html: `<b>${esc(a.name)}</b> ${esc(lower(a.doing || "is working"))}${a.task ? ` <span class="muted">· ${esc(clipText(a.task.code || a.task.title, 40))}${a.task.stream ? ", " + esc(clipText(a.task.stream, 30)) : ""}</span>` : ""}` });
  const seenRoute = new Set();
  for (const a of S.agents.filter((x) => x.state === "working" && x.next)) {
    const n = a.next;
    const u = n.unlocks[0];
    const key = JSON.stringify([n.reviewers, u?.owner, u?.key]);
    if (seenRoute.has(key)) continue;
    seenRoute.add(key);
    const who = S.agents.filter((x) => x.state === "working" && JSON.stringify([x.next?.reviewers, x.next?.unlocks[0]?.owner, x.next?.unlocks[0]?.key]) === key).map((x) => x.name);
    const revs = n.reviewers.map(short).join(" → ");
    lines.push({ dot: "ready", html: `Next: <b>${esc(join(who))}</b>’s ${esc(clipText(a.task?.code || a.task?.title || "work", 30))} → ${revs ? `${esc(revs)} review → ` : ""}${u ? `<b>${esc(u.owner ? short(u.owner) : "someone")}</b> starts ${esc(clipText(`${u.key} ${u.name}`, 40))}` : "done"}` });
  }
  let fresh = S.feed.filter((f) => Date.now() - new Date(f.ts) < 6 * 3600e3).slice(0, 3);
  if (!fresh.length) fresh = S.feed.slice(0, 2); // a quiet company still says what happened last
  for (const f of fresh) lines.push({ dot: f.tone === "good" ? "working" : f.tone === "warn" ? "waiting" : "free", html: `${esc(f.text)} <span class="muted">· ${ago(f.ts)}</span>` });
  const waiting = S.agents.filter((a) => a.state === "waiting" || a.state === "ready").map((a) => short(a.name));
  if (waiting.length) lines.push({ dot: "waiting", html: `<b>${esc(join(waiting))}</b> ${waiting.length === 1 ? "is" : "are"} waiting on earlier stages` });
  const free = S.agents.filter((a) => a.state === "free").map((a) => short(a.name));
  if (free.length) lines.push({ dot: "free", html: `<b>${esc(join(free))}</b> ${free.length === 1 ? "is" : "are"} free` });
  const paused = S.agents.filter((a) => a.state === "paused").map((a) => short(a.name));
  if (paused.length) lines.push({ dot: "paused", html: paused.length === S.agents.length ? `<b>Everyone is paused</b> <span class="muted">· ${plural(paused.length, "agent", "agents")} on hold</span>` : `<b>${esc(join(paused))}</b> ${paused.length === 1 ? "is" : "are"} paused` });
  if (!lines.length) lines.push({ dot: "free", html: "All quiet in the studio" });
  const changed = JSON.stringify(lines) !== JSON.stringify(tickerLines);
  tickerLines = lines;
  if (!tickerTimer) {
    showTicker();
    tickerTimer = setInterval(() => {
      tickerIdx = (tickerIdx + 1) % Math.max(1, tickerLines.length);
      showTicker();
    }, 4200);
  } else if (changed && tickerLines[tickerIdx]) showTicker(true);
}
const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
function showTicker(inPlace) {
  const l = tickerLines[tickerIdx % Math.max(1, tickerLines.length)];
  const box = $("#ticker");
  if (!l) return (box.innerHTML = "");
  const next = document.createElement("span");
  next.className = "tk-line";
  next.innerHTML = `<i class="dot ${l.dot}"></i><span>${l.html}</span>`;
  const old = box.querySelector(".tk-line:not(.out)");
  if (old && inPlace) {
    // Same slot, fresher words: swap the text quietly, no re-entrance animation.
    if (old.innerHTML !== next.innerHTML) old.innerHTML = next.innerHTML;
    return;
  }
  if (old) {
    old.classList.add("out");
    setTimeout(() => old.remove(), 600);
  }
  box.append(next);
}

// Clicking a tile flies to that agent on the stage.
$("#board").addEventListener("click", (e) => {
  const t = e.target.closest(".tile");
  if (!t) return;
  pinned = t.dataset.name;
  setFocus(pinned);
  renderCard();
  scrollTo({ top: 0, behavior: "smooth" });
});

// Tick relative times without refetching.
setInterval(() => {
  tickTimes();
}, 15000);
function tickTimes() {
  document.querySelectorAll("[data-since]").forEach((el) => (el.textContent = since(el.dataset.since)));
  document.querySelectorAll("[data-ago]").forEach((el) => (el.textContent = ago(el.dataset.ago)));
}

let seenFeed = null;
let compiled = false;
// Records any UI step slower than 12 ms (window.__studio.slow) so QA can name a culprit.
const slow = [];
function timedValue(name, fn) {
  let out;
  timed(name, () => (out = fn()));
  return out;
}
function timed(name, fn) {
  const t = performance.now();
  fn();
  const d = performance.now() - t;
  if (d > 12) slow.push([name, Math.round(d), Math.round(t)]);
}
async function poll() {
  try {
    const r = await fetch(`/api/state?company=${encodeURIComponent(COMPANY)}`, { cache: "no-store" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    S = await r.json();
    document.title = `${S.company.name} · Studio`;
    $("#brandName").textContent = S.company.name;
    $("#live").classList.remove("down");
    $("#live").classList.toggle("demo", !!S.demo);
    $("#liveText").textContent = S.demo ? "Demo data · point STUDIO at a real Paperclip" : S.stale ? "Reconnecting…" : `Live · ${clock(S.generatedAt)}`;
    timed("sync", () => syncAgents(S.agents));
    if (!compiled) {
      // Compile every shader up front so nothing hitches mid-animation.
      compiled = true;
      // Include a stand-in route arc so focusing an agent later never compiles a shader mid-motion.
      const warm = new THREE.Group();
      const wc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 1, 0));
      warm.add(new THREE.Mesh(new THREE.TubeGeometry(wc, 8, 0.01, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false })));
      warm.add(new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true })));
      scene.add(warm);
      // Props that only appear while working start hidden; reveal everything for the compile.
      const hidden = [];
      scene.traverse((o) => !o.visible && (hidden.push(o), (o.visible = true)));
      await renderer.compileAsync(scene, camera).catch(() => renderer.compile(scene, camera));
      renderer.render(scene, camera);
      hidden.forEach((o) => (o.visible = false));
      scene.remove(warm);
    }
    // Celebrate fresh approvals with a thumbs-up from the reviewer.
    if (seenFeed) for (const f of S.feed) if (f.ts > seenFeed && f.tone === "good") agents.get(f.who)?.gesture("cheer");
    seenFeed = S.feed[0]?.ts || seenFeed || new Date().toISOString();
    for (const [name, fn] of [["hero", renderHero], ["labels", renderLabels], ["board", renderBoard], ["work", renderPapers], ["feed", renderFeed], ["ticker", renderTicker], ["times", tickTimes], ["card", renderCard]]) timed(name, fn);
  } catch (e) {
    console.error("poll() failed:", e);
    $("#live").classList.add("down");
    $("#liveText").textContent = S ? "Reconnecting…" : "Connecting to Paperclip…";
    if (!S) $("#headline").textContent = "Connecting to Paperclip…";
  }
  setTimeout(poll, POLL_MS);
}

if (COMPANY) {
  poll();
  requestAnimationFrame(frame);
} else showPicker();
loadSwitcher();

// ---------------------------------------------------------------- company picker + switcher
async function companiesList() {
  try {
    const d = await (await fetch("/api/companies", { cache: "no-store" })).json();
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}
async function showPicker() {
  document.body.classList.add("home");
  const list = await companiesList();
  list.sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || b.working - a.working);
  $("#picker").innerHTML = list
    .map(
      (c) => `<a class="co ${c.status !== "active" ? "archived" : ""}" href="/c/${encodeURIComponent(c.prefix || c.id)}">
        <div class="co-top"><span class="co-mark">${esc((c.prefix || c.name).slice(0, 3))}</span><span class="co-st">${c.working ? `<i class="dot working"></i>${c.working} working` : c.paused === c.agents && c.agents ? "Paused" : c.status === "active" ? "Quiet" : esc(c.status)}</span></div>
        <h3>${esc(c.name)}</h3>
        <p>${plural(c.agents, "agent", "agents")}${c.names.length ? " · " + esc(c.names.slice(0, 4).map((n) => n.name).join(", ")) + (c.names.length > 4 ? "…" : "") : ""}</p>
        <div class="co-dots">${c.names.map(() => `<i></i>`).join("")}</div>
      </a>`,
    )
    .join("");
  setTimeout(showPicker, 15000);
}
async function loadSwitcher() {
  const list = await companiesList();
  const sel = $("#switcher");
  sel.innerHTML = `<option value="">All companies</option>` + list.map((c) => `<option value="${esc(c.prefix || c.id)}" ${String(c.prefix).toLowerCase() === COMPANY.toLowerCase() || c.id === COMPANY ? "selected" : ""}>${esc(c.name)}${c.status !== "active" ? " (" + esc(c.status) + ")" : ""}</option>`).join("");
  sel.onchange = () => (location.href = sel.value ? `/c/${encodeURIComponent(sel.value)}` : "/");
}
window.__studio = {
  agents,
  camera, // exposed read-only for QA measurement (projecting world points to screen space)
  get state() { return S; },
  setFocus: (n) => ((pinned = n), setFocus(n)),
  // QA hook: preview every character in one pose (does not touch data).
  preview: (st) => agents.forEach((v) => v.char.setState(st || v.data.state)),
  gesture: (g) => agents.forEach((v) => v.char.gesture(g)),
  slow,
};
