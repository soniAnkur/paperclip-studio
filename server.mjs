#!/usr/bin/env node
// Paperclip Studio: a calm, 3D, human view of any Paperclip company.
// Bolts onto a running Paperclip server. Read-only, zero dependencies.
//   node server.mjs                     -> http://127.0.0.1:4300  (company picker)
//   http://127.0.0.1:4300/c/PAP          -> one company, by issue prefix or id
// Env: PAPERCLIP_API (default http://127.0.0.1:3100/api), STUDIO_PORT, STUDIO_HOST
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_COMPANY, DEMO_SUMMARY, demoState } from "./mockData.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const API = (process.env.PAPERCLIP_API || "http://127.0.0.1:3100/api").replace(/\/$/, "");
const PORT = Number(process.env.STUDIO_PORT || 4300);
const HOST = process.env.STUDIO_HOST || "127.0.0.1";
const DEMO_FORCED = process.env.STUDIO_DEMO === "1";

// One quiet retry: a busy Paperclip (backups, many live runs) can drop a request.
async function get(p, tries = 2) {
  try {
    const r = await fetch(API + p, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`${p} -> ${r.status}`);
    return await r.json();
  } catch (e) {
    if (tries > 1) {
      await new Promise((ok) => setTimeout(ok, 400));
      return get(p, tries - 1);
    }
    throw e;
  }
}
const list = (d) => (Array.isArray(d) ? d : d?.items || d?.data || []);
const clip = (s, n) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};
const base = (p) => (p ? String(p).split("/").filter(Boolean).pop() : "a file");
const firstSentence = (s) => {
  s = String(s || "").replace(/[`*_#>]/g, "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.{20,180}?[.!?])(\s|$)/);
  return clip(m ? m[1] : s, 170);
};
// "[slug] S3 Build" -> "S3 Build";  "Paper — GeoAI Heat Twin" -> "GeoAI Heat Twin"
const cleanTitle = (t) => String(t || "").replace(/^\[[^\]]+\]\s*/, "").replace(/^[A-Z][\w-]{1,14}\s[—–]\s/, "").trim();
const shortCode = (t) => {
  const m = String(t || "").replace(/^\[[^\]]+\]\s*/, "").match(/^([A-Z]{1,6}[-]?\d+[a-z]?(?:-[a-z]+)?)\b/);
  return m ? m[1] : null;
};
const prettyModel = (m) => {
  if (!m) return null;
  const x = String(m).match(/claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?/i);
  if (x) return `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2]}${x[3] && x[3].length < 3 ? "." + x[3] : ""}`;
  return String(m).replace(/^.*\//, "");
};
// Replicas: "Builder2", "Producer 3" -> base name, if that base names a sibling or shares its title.
const replicaBase = (name) => String(name).replace(/\s*\d+$/, "");

// ---------------------------------------------------------------- run logs -> plain sentences
function humanizeTool(name, input = {}) {
  if (name === "Bash") {
    if (input.description) return clip(input.description, 90);
    const cmd = String(input.command || "").trim().split(/\s+/)[0] || "a command";
    return `Running ${base(cmd)}`;
  }
  if (name === "Read") return `Reading ${base(input.file_path)}`;
  if (name === "Write") return `Writing ${base(input.file_path)}`;
  if (name === "Edit" || name === "MultiEdit" || name === "NotebookEdit") return `Editing ${base(input.file_path || input.notebook_path)}`;
  if (name === "Grep" || name === "Glob") return "Searching the code";
  if (name === "WebSearch") return `Searching the web for “${clip(input.query, 60)}”`;
  if (name === "WebFetch") return "Reading a web page";
  if (name === "Task" || name === "Agent") return `Delegating: ${clip(input.description || "a sub-task", 70)}`;
  if (name === "TodoWrite" || name === "ToolSearch") return null;
  if (name.startsWith("mcp__playwright__")) return "Checking the interface in a browser";
  if (/^mcp__paperclip/i.test(name)) return "Updating the task board";
  if (name.startsWith("mcp__")) return `Using ${name.split("__")[1] || "a tool"}`;
  return `Using ${name}`;
}
const runCache = new Map();
async function describeRun(run) {
  const seq = run.lastOutputSeq ?? 0;
  const hit = runCache.get(run.id);
  if (hit && hit.seq === seq) return hit.value;
  const value = { doing: null, thought: null, steps: [] };
  try {
    const offset = Math.max(0, (run.lastOutputBytes || 0) - 90000);
    const d = await get(`/heartbeat-runs/${run.id}/log?offset=${offset}&limitBytes=90000`);
    const actions = [];
    for (const line of String(d.content || "").split("\n")) {
      let chunk;
      try {
        chunk = JSON.parse(JSON.parse(line).chunk);
      } catch {
        continue;
      }
      if (chunk?.type !== "assistant") continue;
      for (const b of chunk.message?.content || []) {
        if (b.type === "tool_use") {
          const h = humanizeTool(b.name, b.input);
          if (h) actions.push({ kind: "do", text: h });
        } else if (b.type === "text" && b.text?.trim()) actions.push({ kind: "say", text: firstSentence(b.text) });
      }
    }
    const dos = actions.filter((a) => a.kind === "do");
    value.doing = dos.at(-1)?.text || null;
    value.thought = actions.filter((a) => a.kind === "say").at(-1)?.text || null;
    const seen = new Set();
    value.steps = dos.slice(-12).reverse().filter((a) => (seen.has(a.text) ? false : seen.add(a.text))).slice(0, 4).map((a) => a.text);
  } catch {
    /* log unavailable */
  }
  runCache.set(run.id, { seq, value });
  if (runCache.size > 400) runCache.delete(runCache.keys().next().value);
  return value;
}

// ---------------------------------------------------------------- issue detail (blocks / reviewers)
const detailCache = new Map(); // id -> { updatedAt, value }
async function issueDetail(i) {
  const hit = detailCache.get(i.id);
  if (hit && hit.updatedAt === i.updatedAt) return hit.value;
  let value = null;
  try {
    value = await get(`/issues/${i.id}`);
  } catch {
    /* ignore */
  }
  detailCache.set(i.id, { updatedAt: i.updatedAt, value });
  return value;
}
const STATUS_GROUP = { done: "done", cancelled: "done", in_progress: "active", in_review: "review", todo: "ready", blocked: "waiting", backlog: "waiting" };

// A short, human error line from Paperclip's raw failure text.
const cleanError = (e) => clip(String(e || "").replace(/^Claude run failed:\s*(subtype=\w+:\s*)?/i, "").trim(), 140);
const STUCK_WINDOW_MS = 90 * 60 * 1000; // a run that keeps dying and retrying in this window reads as "stuck", not "working"
function stuckOf(agentId, runs) {
  const cutoff = Date.now() - STUCK_WINDOW_MS;
  const recent = (runs || []).filter((r) => new Date(r.startedAt || 0).getTime() > cutoff).sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || ""));
  const fails = recent.filter((r) => r.status === "failed");
  if (fails.length < 3) return null;
  // A run that has been alive a couple of minutes without failing again is a recovery,
  // not a loop still in progress — don't keep flagging it once it's actually working.
  const latest = recent.at(-1);
  const recovered = latest?.status === "running" && Date.now() - new Date(latest.startedAt).getTime() > 2 * 60 * 1000;
  if (recovered) return null;
  const last = fails.at(-1);
  return { count: fails.length, error: cleanError(last.error), code: last.errorCode || null, since: fails[0].startedAt };
}

// ---------------------------------------------------------------- companies
let companiesCache = { at: 0, value: null };
async function companies() {
  if (companiesCache.value && Date.now() - companiesCache.at < 30000) return companiesCache.value;
  try {
    const value = list(await get("/companies"));
    companiesCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    if (companiesCache.value) return companiesCache.value; // stale beats broken
    throw e;
  }
}
async function resolveCompany(key) {
  const all = await companies();
  const k = String(key || "").toLowerCase();
  return all.find((c) => c.id === key || (c.issuePrefix || "").toLowerCase() === k) || null;
}

async function summaries() {
  const all = await companies();
  return Promise.all(
    all.map(async (c) => {
      let agents = [], live = [];
      try {
        [agents, live] = await Promise.all([get(`/companies/${c.id}/agents`).then(list), get(`/companies/${c.id}/live-runs`).then(list)]);
      } catch {
        /* unreachable company */
      }
      const working = new Set(live.filter((r) => r.status === "running").map((r) => r.agentId)).size;
      return {
        id: c.id,
        prefix: c.issuePrefix,
        name: c.name,
        status: c.status,
        description: c.description || null,
        agents: agents.length,
        working,
        paused: agents.filter((a) => a.status === "paused").length,
        names: agents.map((a) => ({ name: a.name, role: a.role, title: a.title })),
      };
    }),
  );
}

// ---------------------------------------------------------------- the snapshot
function feedItem(a, issueById, nameById) {
  const who = a.actorType === "agent" ? nameById[a.actorId] || "An agent" : a.actorType === "user" ? "Board" : "System";
  const d = a.details || {};
  const iss = issueById[a.entityId];
  const rawTitle = d.issueTitle || iss?.title || "";
  const title = cleanTitle(rawTitle) || "a task";
  const base = { ts: a.createdAt, who, ident: d.identifier || iss?.identifier, group: iss ? iss.__group : null };
  if (a.action === "issue.comment_added") {
    const s = String(d.bodySnippet || "").trim();
    if (/^(PASS|APPROVED?)\b/i.test(s)) return { ...base, tone: "good", text: `${who} approved ${title}` };
    if (/^(FAIL|REJECT|CHANGES REQUESTED)\b/i.test(s)) return { ...base, tone: "warn", text: `${who} sent ${title} back for fixes` };
    if (/HANDOFF/i.test(s)) return { ...base, tone: "info", text: `${who} handed off ${title}` };
    if (who === "Board") return { ...base, tone: "info", text: `Board note on ${title}: ${clip(s.replace(/^Board:\s*/i, ""), 90)}` };
    return { ...base, tone: "info", text: `${who} commented on ${title}` };
  }
  if (a.action === "issue.updated" && d.changes?.status) {
    const to = d.changes.status.to;
    const verb = { done: "finished", in_progress: "started", in_review: "sent for review", blocked: "is now waiting", todo: "is ready", cancelled: "was cancelled" }[to];
    if (verb) return { ...base, tone: to === "done" ? "good" : "info", text: `${title} ${verb}` };
  }
  if (a.action === "issue.updated" && d.changes?.assigneeAgentId?.to) return { ...base, tone: "info", text: `${title} assigned to ${nameById[d.changes.assigneeAgentId.to] || "an agent"}` };
  if (a.action === "issue.created") return { ...base, tone: "info", text: `New task: ${title}` };
  if (a.action === "approval.approved") return { ...base, tone: "good", text: `${who} approved a request` };
  if (a.action === "agent.hire_created" || a.action === "agent.created") return { ...base, tone: "info", text: "A new agent joined the team" };
  return null;
}

async function buildState(company) {
  const CID = company.id;
  const [agents, live, issues, activity, projects, recentRuns] = await Promise.all([
    get(`/companies/${CID}/agents`).then(list),
    get(`/companies/${CID}/live-runs`).then(list),
    get(`/companies/${CID}/issues`).then(list),
    get(`/companies/${CID}/activity?limit=150`).then(list).catch(() => []),
    get(`/companies/${CID}/projects`).then(list).catch(() => []),
    get(`/companies/${CID}/heartbeat-runs?limit=300`).then(list).catch(() => []),
  ]);
  const runsByAgent = {};
  for (const r of recentRuns) (runsByAgent[r.agentId] ||= []).push(r);
  const nameById = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const issueById = Object.fromEntries(issues.map((i) => [i.id, i]));
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const liveByAgent = {};
  for (const r of live) if (r.status === "running" || r.status === "queued") liveByAgent[r.agentId] ||= r;

  // ---- workstreams: top-level parent issues with >= 3 children; else projects
  const children = {};
  for (const i of issues) if (i.parentId && issueById[i.parentId]) (children[i.parentId] ||= []).push(i);
  const topOf = (i) => {
    let x = i, guard = 0;
    while (x.parentId && issueById[x.parentId] && guard++ < 8) x = issueById[x.parentId];
    return x;
  };
  let streams = Object.entries(children)
    .filter(([pid, kids]) => !issueById[pid].parentId && kids.length >= 3 && issueById[pid].status !== "cancelled")
    .map(([pid, kids]) => ({ key: pid, title: cleanTitle(issueById[pid].title), ident: issueById[pid].identifier, kids }));
  const streamIds = new Set(streams.map((s) => s.key));
  if (!streams.length)
    streams = projects
      .map((p) => ({ key: p.id, title: p.name, ident: null, kids: issues.filter((i) => i.projectId === p.id && i.status !== "cancelled") }))
      .filter((s) => s.kids.length);
  for (const i of issues) {
    const t = topOf(i);
    i.__group = streamIds.has(t.id) ? cleanTitle(t.title) : projectById[i.projectId]?.name || null;
  }
  const workstreams = streams.map((s) => {
    const kids = s.kids.filter((k) => k.status !== "cancelled").sort((a, b) => (a.issueNumber || 0) - (b.issueNumber || 0));
    const steps = kids.map((k, n) => ({
      key: shortCode(k.title) || String(n + 1),
      name: cleanTitle(k.title).replace(/^([A-Z]{1,6}[-]?\d+[a-z]?(?:-[a-z]+)?)\s+/, ""),
      ident: k.identifier,
      status: STATUS_GROUP[k.status] || "waiting",
      owner: nameById[k.assigneeAgentId] || (k.assigneeUserId ? "Board" : null),
    }));
    const done = steps.filter((x) => x.status === "done").length;
    const current = steps.find((x) => x.status === "active" || x.status === "review") || steps.find((x) => x.status === "ready");
    const last = kids.reduce((m, k) => (k.updatedAt > m ? k.updatedAt : m), "");
    return { key: s.key, title: s.title, ident: s.ident, steps, done, total: steps.length, shipped: steps.length > 0 && done === steps.length, current: current || null, updatedAt: last };
  });
  workstreams.sort((a, b) => Number(a.shipped) - Number(b.shipped) || b.updatedAt.localeCompare(a.updatedAt));

  // ---- agents
  const names = new Set(agents.map((a) => a.name));
  const titleOf = Object.fromEntries(agents.map((a) => [a.name, a.title]));
  const rank = (i) => ({ in_progress: 0, in_review: 1, todo: 2, blocked: 3, backlog: 4 })[i.status] ?? 9;
  const out = [];
  for (const a of agents) {
    const run = liveByAgent[a.id];
    const mine = issues.filter((i) => i.assigneeAgentId === a.id && !["done", "cancelled"].includes(i.status)).sort((x, y) => rank(x) - rank(y) || (x.issueNumber || 0) - (y.issueNumber || 0));
    const focus = (run && issueById[run.issueId]) || mine[0] || null;
    const stuck = stuckOf(a.id, runsByAgent[a.id]);
    let state = "free";
    if (a.status === "paused" || a.status === "terminated") state = "paused";
    else if (stuck) state = "stuck"; // crash-looping reads as its own state, not plain "working"
    else if (a.status === "error" || a.errorReason) state = "error";
    else if (run) state = "working";
    else if (mine.some((i) => ["todo", "in_progress", "in_review"].includes(i.status))) state = "ready";
    else if (mine.length) state = "waiting";

    // where the work goes next: reviewers (execution policy) then the issues it unblocks
    let next = null;
    if (focus) {
      const det = await issueDetail(focus);
      const reviewers = [];
      for (const st of det?.executionPolicy?.stages || focus.executionPolicy?.stages || [])
        for (const p of st.participants || []) if (p.agentId && nameById[p.agentId] && !reviewers.includes(nameById[p.agentId])) reviewers.push(nameById[p.agentId]);
      const unlocks = (det?.blocks || [])
        .filter((b) => !["done", "cancelled"].includes(b.status))
        .map((b) => {
          const bi = issueById[b.id] || b;
          const t = bi.title || b.title;
          return { key: shortCode(t) || b.identifier, name: cleanTitle(t).replace(/^([A-Z]{1,6}[-]?\d+[a-z]?(?:-[a-z]+)?)\s+/, ""), owner: nameById[bi.assigneeAgentId] || null, ident: b.identifier };
        });
      const up = det?.parentId && issueById[det.parentId];
      next = reviewers.length || unlocks.length ? { reviewers, unlocks, parent: up ? cleanTitle(up.title) : null } : null;
    }
    const rb = replicaBase(a.name);
    const replicaOf = rb !== a.name && (names.has(rb) || agents.some((x) => x.name !== a.name && replicaBase(x.name) === rb && x.title === a.title)) ? rb : null;
    const desc = run ? await describeRun(run) : null;
    out.push({
      id: a.id,
      name: a.name,
      title: a.title,
      role: a.role,
      about: a.capabilities || null,
      model: prettyModel(a.adapterConfig?.model) || prettyModel(a.runtimeConfig?.model) || null,
      reportsTo: nameById[a.reportsTo] || null,
      group: replicaOf || a.name,
      state,
      since: run ? run.startedAt : a.lastHeartbeatAt,
      lastSeen: run?.lastOutputAt || a.lastHeartbeatAt,
      task: focus ? { ident: focus.identifier, title: cleanTitle(focus.title), code: shortCode(focus.title), stream: focus.__group } : null,
      queue: mine.length,
      doing: desc?.doing || (run ? "Getting started" : null),
      thought: desc?.thought || null,
      steps: desc?.steps || [],
      error: a.errorReason || a.pauseReason || null,
      stuck,
      next,
    });
  }
  // replicas get their base sibling's title if theirs is empty
  for (const a of out) if (!a.title && titleOf[a.group]) a.title = titleOf[a.group];
  // order: org chart (leaders first), keep replicas together
  const depth = (a, g = 0) => (a.reportsTo && g < 8 ? 1 + depth(out.find((x) => x.name === a.reportsTo) || {}, g + 1) : 0);
  // Deterministic order (org depth, then hire date) so the stage never reshuffles between polls.
  const hired = Object.fromEntries(agents.map((a) => [a.name, a.createdAt || ""]));
  out.sort((x, y) => depth(x) - depth(y) || (hired[x.group] || "").localeCompare(hired[y.group] || "") || x.name.localeCompare(y.name, undefined, { numeric: true }));

  const feed = [];
  for (const a of activity) {
    const f = feedItem(a, issueById, nameById);
    if (!f || feed.at(-1)?.text === f.text) continue;
    feed.push(f);
    if (feed.length >= 14) break;
  }
  const count = (s) => out.filter((a) => a.state === s).length;
  return {
    generatedAt: new Date().toISOString(),
    company: { id: company.id, name: company.name, prefix: company.issuePrefix, status: company.status, description: company.description || null },
    summary: { total: out.length, working: count("working"), free: count("free"), ready: count("ready"), waiting: count("waiting"), paused: count("paused"), attention: count("error") + count("stuck") },
    agents: out,
    workstreams,
    feed,
  };
}

// Stale-while-revalidate: answer instantly with the last snapshot and refresh in the
// background, so a busy Paperclip (it can take tens of seconds under load) never freezes the page.
const stateCache = new Map(); // companyId -> { at, value, pending }
function refresh(company) {
  const c = stateCache.get(company.id) || {};
  if (c.pending) return c.pending;
  c.pending = buildState(company)
    .then((v) => (stateCache.set(company.id, { at: Date.now(), value: v, pending: null }), v))
    .catch((e) => {
      console.warn(new Date().toISOString(), company.issuePrefix, "state build failed:", e.message);
      stateCache.set(company.id, { ...stateCache.get(company.id), pending: null });
      if (c.value) return c.value;
      throw e;
    });
  stateCache.set(company.id, c);
  return c.pending;
}
async function state(company) {
  const c = stateCache.get(company.id);
  if (!c?.value) return refresh(company); // first visit: wait for real data
  if (Date.now() - c.at > 2500) refresh(company);
  const age = Date.now() - c.at;
  return age > 30000 ? { ...c.value, stale: true } : c.value;
}

// The picker refreshes the same way.
let summaryCache = { at: 0, value: null, pending: null };
function refreshSummaries() {
  if (!summaryCache.pending)
    summaryCache.pending = summaries()
      .then((v) => (summaryCache = { at: Date.now(), value: v, pending: null }).value)
      .catch((e) => {
        summaryCache.pending = null;
        if (summaryCache.value) return summaryCache.value;
        throw e;
      });
  return summaryCache.pending;
}
async function cachedSummaries() {
  if (!summaryCache.value) return refreshSummaries();
  if (Date.now() - summaryCache.at > 10000) refreshSummaries();
  return summaryCache.value;
}

// ---------------------------------------------------------------- http
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname === "/api/companies") {
        if (DEMO_FORCED) return send(res, 200, DEMO_SUMMARY);
        try {
          return send(res, 200, await cachedSummaries());
        } catch {
          // No reachable Paperclip and nothing cached yet: show the demo company
          // rather than an error, so a fresh clone always renders something.
          return send(res, 200, DEMO_SUMMARY);
        }
      }
      if (url.pathname === "/api/state") {
        if (DEMO_FORCED) return send(res, 200, demoState());
        try {
          const company = await resolveCompany(url.searchParams.get("company"));
          if (!company) return send(res, 404, { error: "No such company" });
          return send(res, 200, await state(company));
        } catch {
          return send(res, 200, demoState());
        }
      }
    } catch (e) {
      return send(res, 503, { error: "Paperclip is not reachable", detail: String(e.message || e) });
    }
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p === "/" || p.startsWith("/c/")) p = "/index.html"; // client-side routes
    const file = path.join(PUBLIC, p);
    if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, "Not found", "text/plain");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(buf);
    });
  })
  .listen(PORT, HOST, () => console.log(`Paperclip Studio → http://${HOST}:${PORT}   (Paperclip API: ${API})`));
