// Canned sample data so Paperclip Studio has something to show the moment
// it's started, with no real Paperclip instance behind it. Entirely fictional.
const now = () => new Date();
const iso = (minsAgo) => new Date(now() - minsAgo * 60000).toISOString();

export const DEMO_COMPANY = {
  id: "demo-launchpad",
  issuePrefix: "LNP",
  name: "Launchpad (demo)",
  status: "active",
  description: "A fictional startup shipping a public beta. Sample data — point STUDIO at a real Paperclip instance to see your own company.",
};

export const DEMO_SUMMARY = [
  {
    id: DEMO_COMPANY.id,
    prefix: DEMO_COMPANY.issuePrefix,
    name: DEMO_COMPANY.name,
    status: DEMO_COMPANY.status,
    description: DEMO_COMPANY.description,
    agents: 6,
    working: 2,
    paused: 0,
    names: [
      { name: "Vega", role: "ceo", title: "CEO" },
      { name: "Orion", role: "manager", title: "Engineering Lead" },
      { name: "Atlas", role: "engineer", title: "Builder" },
      { name: "Nova", role: "engineer", title: "Builder" },
      { name: "Juno", role: "researcher", title: "Researcher" },
      { name: "Echo", role: "worker", title: "QA" },
    ],
  },
];

function workstream(key, title, ident, steps, minsAgo) {
  const done = steps.filter((s) => s.status === "done").length;
  const current = steps.find((s) => s.status === "active" || s.status === "review") || steps.find((s) => s.status === "ready");
  return { key, title, ident, steps, done, total: steps.length, shipped: steps.length > 0 && done === steps.length, current: current || null, updatedAt: iso(minsAgo) };
}

export function demoState() {
  const workstreams = [
    workstream("ws-1", "Public Beta Launch", "LNP-1", [
      { key: "LNP-2", name: "Landing page", ident: "LNP-2", status: "done", owner: "Nova" },
      { key: "LNP-3", name: "Signup flow", ident: "LNP-3", status: "done", owner: "Atlas" },
      { key: "LNP-4", name: "Onboarding emails", ident: "LNP-4", status: "active", owner: "Atlas" },
      { key: "LNP-5", name: "Load test", ident: "LNP-5", status: "review", owner: "Nova" },
      { key: "LNP-6", name: "Launch announcement", ident: "LNP-6", status: "ready", owner: "Juno" },
    ], 4),
    workstream("ws-2", "Pricing Research", "LNP-7", [
      { key: "LNP-8", name: "Competitor survey", ident: "LNP-8", status: "done", owner: "Juno" },
      { key: "LNP-9", name: "Draft pricing tiers", ident: "LNP-9", status: "waiting", owner: "Juno" },
      { key: "LNP-10", name: "Board review", ident: "LNP-10", status: "waiting", owner: "Vega" },
    ], 45),
  ];

  const agents = [
    { id: "a-vega", name: "Vega", title: "CEO", role: "ceo", about: "Sets priorities, approves hires and budget.", model: "Opus 5.5", reportsTo: null, group: "Vega", state: "waiting", since: iso(200), lastSeen: iso(12), task: null, queue: 1, doing: null, thought: null, steps: [], error: null, stuck: null, next: null },
    { id: "a-orion", name: "Orion", title: "Engineering Lead", role: "manager", about: "Coordinates the build team, reviews engineering work.", model: "Sonnet 5", reportsTo: "Vega", group: "Orion", state: "ready", since: iso(90), lastSeen: iso(8), task: { ident: "LNP-5", title: "Load test", code: "LNP-5", stream: "Public Beta Launch" }, queue: 2, doing: null, thought: null, steps: [], error: null, stuck: null, next: { reviewers: ["Vega"], unlocks: [], parent: "Public Beta Launch" } },
    { id: "a-atlas", name: "Atlas", title: "Builder", role: "engineer", about: "Backend and infra.", model: "Sonnet 5", reportsTo: "Orion", group: "Atlas", state: "working", since: iso(6), lastSeen: iso(0), task: { ident: "LNP-4", title: "Onboarding emails", code: "LNP-4", stream: "Public Beta Launch" }, queue: 1, doing: "Writing the welcome-email template", thought: "Wiring the drip sequence to the signup webhook.", steps: ["Reading signup.ts", "Writing welcome-email.html", "Editing mailer.ts"], error: null, stuck: null, next: { reviewers: ["Orion"], unlocks: [{ key: "LNP-6", name: "Launch announcement", owner: "Juno", ident: "LNP-6" }], parent: "Public Beta Launch" } },
    { id: "a-nova", name: "Nova", title: "Builder", role: "engineer", about: "Frontend and performance.", model: "Sonnet 5", reportsTo: "Orion", group: "Nova", state: "working", since: iso(3), lastSeen: iso(0), task: { ident: "LNP-5", title: "Load test", code: "LNP-5", stream: "Public Beta Launch" }, queue: 1, doing: "Running the load test against staging", thought: "1200 req/s steady, watching p99 latency.", steps: ["Running k6 script", "Reading staging logs", "Writing results.md"], error: null, stuck: null, next: { reviewers: ["Orion"], unlocks: [], parent: "Public Beta Launch" } },
    { id: "a-juno", name: "Juno", title: "Researcher", role: "researcher", about: "Market and pricing research.", model: "Sonnet 5", reportsTo: "Vega", group: "Juno", state: "free", since: iso(500), lastSeen: iso(40), task: { ident: "LNP-9", title: "Draft pricing tiers", code: "LNP-9", stream: "Pricing Research" }, queue: 2, doing: null, thought: null, steps: [], error: null, stuck: null, next: null },
    { id: "a-echo", name: "Echo", title: "QA", role: "worker", about: "Manual and automated testing.", model: "Haiku 4.5", reportsTo: "Orion", group: "Echo", state: "paused", since: iso(1000), lastSeen: iso(300), task: null, queue: 0, doing: null, thought: null, steps: [], error: null, stuck: null, next: null },
  ];

  const feed = [
    { ts: iso(0), who: "Atlas", ident: "LNP-4", group: "Public Beta Launch", tone: "info", text: "Atlas started Onboarding emails" },
    { ts: iso(5), who: "Nova", ident: "LNP-5", group: "Public Beta Launch", tone: "info", text: "Nova commented on Load test" },
    { ts: iso(20), who: "Orion", ident: "LNP-3", group: "Public Beta Launch", tone: "good", text: "Orion approved Signup flow" },
    { ts: iso(35), who: "Vega", ident: "LNP-8", group: "Pricing Research", tone: "info", text: "Board note on Competitor survey: good breadth, add two more comps" },
    { ts: iso(60), who: "Juno", ident: "LNP-8", group: "Pricing Research", tone: "good", text: "Competitor survey finished" },
  ];

  return {
    generatedAt: now().toISOString(),
    demo: true,
    company: DEMO_COMPANY,
    summary: { total: agents.length, working: 2, free: 1, ready: 1, waiting: 1, paused: 1, attention: 0 },
    agents,
    workstreams,
    feed,
  };
}
