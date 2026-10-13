# Launch kit

Ready-to-paste copy for launching Paperclip Studio. Plain text, no emojis. Times are Pacific. Replace anything in [brackets] before posting.

Links used below:

- Demo: https://paperclip-studio-drab.vercel.app
- Repo: https://github.com/soniAnkur/paperclip-studio
- GIF to attach: docs/media/hero.gif (or docs/media/linkedin.gif for LinkedIn)

Before you start: Paperclip's site and README name the team and the account @papercliping, not an individual creator. Tag that account. If you know the founder's personal handle, add it.

---

## 1. Paperclip Discord (today)

Server: https://discord.gg/m4HZY7xNG3. Post in the channel for community projects or showcases. Read the channel pinned rules first.

```
I built a small read-only 3D view for Paperclip companies. One character per agent, plain-English status (working, up next, waiting, free), workstream progress, and a live activity feed.

It only reads from your Paperclip API. It never writes anything back. Zero dependencies.

Live demo (sample data, no install): https://paperclip-studio-drab.vercel.app
Repo: https://github.com/soniAnkur/paperclip-studio

Not affiliated with Paperclip, just a tool I wanted for my own company. Feedback welcome, especially what you would want to see at a glance.
```

## 2. GitHub Discussion on the Paperclip repo (today)

Go to https://github.com/paperclipai/paperclip/discussions and start a new discussion. Pick the category for showing projects if one exists, otherwise General.

Title:

```
Paperclip Studio: a read-only 3D dashboard for your company
```

Body:

```
I built an independent, read-only dashboard for Paperclip companies and wanted to share it.

What it shows: who is working, who is free, workstream progress, and a live activity feed, with one 3D character per agent.

How it works: it polls the /companies, /agents, /issues, /activity and /heartbeat-runs endpoints and renders them. There is no create, update or delete path anywhere. Zero dependencies, runs with `npm start`, and falls back to sample data if no Paperclip is reachable.

Demo: https://paperclip-studio-drab.vercel.app
Repo: https://github.com/soniAnkur/paperclip-studio

This is a community project and is not affiliated with or endorsed by Paperclip. If anything about how it uses the API looks wrong, tell me and I will fix it.
```

## 3. X post (today)

Attach docs/media/hero.gif.

```
I built Paperclip Studio: a read-only 3D view of your Paperclip company.

One character per agent. See who is working, who is free, and what ships next, in plain English. Works on your phone.

Live demo, no install: https://paperclip-studio-drab.vercel.app

@papercliping independent community project, MIT licensed.
```

Reply to your own post with the repo link:

```
Repo: https://github.com/soniAnkur/paperclip-studio
Zero dependencies, never writes to your Paperclip. Star to follow, new feature every few days.
```

## 4. LinkedIn post (today)

Attach docs/media/linkedin.gif.

```
If you run AI agents, you have probably asked: who is doing what right now, and who is stuck?

I use Paperclip to run a company of agents. The data is all there, but I wanted to see it at a glance, so I built Paperclip Studio.

It turns a Paperclip company into a calm 3D studio. One character per agent. Plain-English status. Workstream progress. A live activity feed.

It is read-only (it never writes to Paperclip), has zero dependencies, and works on a phone.

Try the live demo, no install needed: https://paperclip-studio-drab.vercel.app
Code (MIT): https://github.com/soniAnkur/paperclip-studio

I am shipping a new feature every few days. If you want to follow along, star the repo. What would you want to see at a glance about your agents?
```

## 5. Show HN (tomorrow, Wednesday, 8:00 to 10:00 am US Eastern = 5:00 to 7:00 am Pacific)

Submit at https://news.ycombinator.com/submit. Use the repo URL as the link (HN prefers the code over a landing page), and put the demo in the first comment.

Title (74 characters):

```
Show HN: Paperclip Studio, a read-only 3D dashboard for your AI agent team
```

URL:

```
https://github.com/soniAnkur/paperclip-studio
```

First comment (post it right after submitting):

```
Hi HN. I run a small company of AI agents on Paperclip (paperclip.ing). The data about who is working, who is blocked and what shipped is all there, but I kept wanting a view I could glance at, including from my phone, without reading issue lists and logs.

So I built Studio. It renders each agent as a 3D character on a stage, with plain-English status, workstream progress and a live activity feed. Hover or tap an agent to see what it is doing and what comes next.

Some choices that might interest you:

- Read-only. It polls the Paperclip API with GET requests only. There is no write path in the client or the server.
- Zero dependencies. A small Node server plus three.js vendored in the repo. `npm start` and you are running.
- Characters are drawn in code with three.js, no model files.
- If no Paperclip is reachable it shows a fictional sample company, so you can try it without setting anything up.

Live demo (sample data): https://paperclip-studio-drab.vercel.app

It is an independent project, not affiliated with Paperclip. Next up: a "needs attention" panel (stalled agents, long-blocked issues, failed runs), webhook alerts, and an overnight replay. I would love to hear what you would want from a view like this.
```

## 6. Reddit

Read each subreddit's rules and check its self-promotion policy before posting. Do not post the same text in all four. Reply to every comment in the first two hours.

### r/AI_Agents

Title:

```
I built a read-only 3D dashboard to see what my AI agent team is doing at a glance
```

Body:

```
I run a company of agents on Paperclip and got tired of reading issue lists to answer "who is working, who is blocked, what ships next."

Paperclip Studio shows each agent as a character with a plain-English status, plus workstream progress and a live activity feed. It is read-only (GET requests only), zero dependencies, MIT.

Demo with sample data, no install: https://paperclip-studio-drab.vercel.app
Code: https://github.com/soniAnkur/paperclip-studio

Question for people running multiple agents: what is the one thing you check first each morning? I am building a "needs attention" panel next (stalled agents, long-blocked issues, failed runs) and want to get it right.
```

### r/LocalLLaMA

This sub cares about local, open and self-hosted. Lead with that, and be upfront that it is a dashboard, not a model.

Title:

```
Zero-dependency, self-hosted dashboard for watching a team of agents (read-only, MIT)
```

Body:

```
Not a model, a tool for people who run agent teams on their own box. Paperclip Studio is a small self-hosted dashboard for Paperclip (the open source agent orchestrator).

It runs with `npm start`, binds to localhost by default, talks only to your own Paperclip API, never writes anything back, and has no telemetry and no dependencies (three.js is vendored). Each agent is a 3D character with a plain-English status, plus workstream progress and an activity feed.

Demo on sample data: https://paperclip-studio-drab.vercel.app
Code: https://github.com/soniAnkur/paperclip-studio

If you run agents on local models and want something added to the view (model name, run failures, idle time), tell me.
```

### r/threejs

Lead with the craft, not the product.

Title:

```
Characters drawn entirely in code for a three.js agent dashboard (no model files)
```

Body:

```
I made a dashboard where each AI agent is a little 3D character, all built from primitives in code, no glTF files. They change pose by state (working, waiting, free), turn around on hover, and the camera reframes for phones.

Things I enjoyed solving: keeping labels from colliding on crowded stages, fanning out replicas so none hides behind another, and warming all shaders up front so nothing hitches mid-animation.

Live demo: https://paperclip-studio-drab.vercel.app
Source (MIT, zero dependencies, three.js vendored): https://github.com/soniAnkur/paperclip-studio

Happy to answer questions about the character rig or the mobile camera.
```

### r/SideProject

Title:

```
I built a 3D dashboard so I can check on my AI agents from my phone
```

Body:

```
I run a small company of AI agents and wanted a calm way to see who is working and who is stuck without opening a pile of logs. So I built Paperclip Studio.

It is read-only, has zero dependencies, and works on a phone. You can try it with sample data, no install: https://paperclip-studio-drab.vercel.app

Code: https://github.com/soniAnkur/paperclip-studio

I am launching it this week and shipping a feature every few days. Honest feedback on what is confusing or missing would help a lot.
```

## 7. Reply templates

Is it affiliated with Paperclip?

```
No. It is an independent community project and is not affiliated with or endorsed by paperclip.ing. I use Paperclip daily and wanted this view for myself.
```

Does it write data?

```
No. It is read-only. The server only makes GET requests to your Paperclip API (/companies, /agents, /issues, /activity, /heartbeat-runs). There is no create, update or delete path anywhere in the client or server, so if you can see it in Studio, it already happened in Paperclip.
```

How do I run it locally?

```
git clone https://github.com/soniAnkur/paperclip-studio.git
cd paperclip-studio && npm start
Then open http://127.0.0.1:4300. With no Paperclip running you get sample data. To see your own company: PAPERCLIP_API=http://127.0.0.1:3100/api npm start
```

What is the roadmap?

```
Next up, in this order: a "needs attention" panel (agents with no recent heartbeat, long-blocked issues, failed runs), Slack and webhook alerts, and an overnight replay of what happened while you were away. Star the repo to follow along. I am shipping something every few days.
```

Feature requests

```
Thanks, this is useful. Could you open an issue at https://github.com/soniAnkur/paperclip-studio/issues with what you would want to see and why? I read all of them. Small, read-only additions are the quickest to ship.
```

## 8. 48-hour checklist (Pacific time)

Tuesday, October 13

- 1:50 pm [phone] Open the demo on your phone. Confirm it loads straight into the studio. Wait for the Vercel deploy of main if it still shows the old picker.
- 2:15 pm [phone] Join the Paperclip Discord, read the rules, post section 1.
- 2:30 pm [phone] Post the GitHub Discussion (section 2).
- 2:45 pm [phone] Post on X (section 3) with hero.gif, then reply to yourself with the repo link.
- 3:00 pm [phone] Post on LinkedIn (section 4) with linkedin.gif.
- 3:15 to 4:30 pm [phone] Reply to every comment and reaction. Paste them to Claude for reply help.
- 6:00 pm [phone] Post on r/threejs (section 6).
- 8:30 pm [phone] Check all posts, reply, note star count. Set an alarm for 4:45 am.

Wednesday, October 14

- 4:45 am [phone] Wake up. Note star count.
- 5:30 am (8:30 am ET) [phone] Submit Show HN (section 5), then post the first comment within 2 minutes.
- 5:30 to 8:30 am [phone] Stay on the HN thread. Reply fast and plainly. Do not ask anyone for upvotes.
- 9:00 am [phone] Post on r/AI_Agents.
- 12:00 pm [phone] Post on r/SideProject.
- 1:00 pm [laptop] Create the three GitHub issues from section 9 so there is visible activity.
- 6:00 pm [phone] Review the day: stars, issues, comments. Reply to everything.

Thursday, October 15

- 8:00 am [phone] Post on r/LocalLLaMA.
- 10:00 am [phone] Post the day 2 update (the "needs attention" panel) on X, LinkedIn and the Discord thread.
- 1:30 pm [phone] Final 48-hour review: stars, issues, what worked. Decide the next feature from the replies.

If a post is not getting traction after 2 hours, do not repost it. Change the title or the first image and post it somewhere different.

## 9. Issues to open (label each: good first issue)

### Issue 1

Title:

```
Needs attention panel
```

Body:

```
Add a read-only panel that surfaces what needs a human look:

- Agents with no recent heartbeat (for example, none in the last 30 minutes)
- Issues blocked for a long time
- Failed runs

Acceptance criteria:
- Read-only, no new dependencies
- Works on the demo data (add examples to mockData.mjs)
- Shows an empty state when nothing needs attention
- Matches the existing panel style

Hint: the summary already has an `attention` count and agents already have `error` and `stuck` fields. Start in public/app.js, next to renderBoard.
```

### Issue 2

Title:

```
Slack and webhook alerts
```

Body:

```
Optionally POST a short message to a user-supplied webhook URL (Slack-compatible) when an agent starts needing attention, for example a failed run or a long-blocked issue.

Acceptance criteria:
- Off by default; enabled only with a STUDIO_WEBHOOK_URL env var
- No new dependencies (use Node's built-in fetch)
- Sends each alert once, not on every poll
- Never writes to Paperclip: outgoing alerts go only to the user's webhook
- Document the env var in the README

Hint: the polling loop and state live in server.mjs.
```

### Issue 3

Title:

```
Overnight replay
```

Body:

```
Add a "While you were away" replay that summarizes what happened since the last visit: tasks finished, agents that changed state, approvals.

Acceptance criteria:
- Read-only, built from the existing /activity feed
- Remembers the last visit with localStorage, no server storage
- Plain-English summary, similar to the existing "Lately" section
- Works on demo data

Hint: the feed is already normalized in state.feed. Start with a simple grouped list, animation can come later.
```
