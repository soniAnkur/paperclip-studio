# Paperclip Studio

A calm, 3D, human view of any [Paperclip](https://paperclip.ing) company: who's working, who's free, workstream progress, and a live activity feed.

Read-only. Zero dependencies. Bolts onto a running Paperclip instance — no setup beyond pointing it at your API.

## Quickstart

No real Paperclip instance yet? Just run it — it ships with sample data:

```bash
git clone https://github.com/soniAnkur/paperclip-studio.git
cd paperclip-studio
npm start
```

Open http://127.0.0.1:4300. If no Paperclip API is reachable, you'll see a "Demo data" banner and a fictional sample company instead of an error.

## Pointing it at your own Paperclip

```bash
PAPERCLIP_API=http://127.0.0.1:3100/api npm start
```

| Env var | Default | What it does |
|---|---|---|
| `PAPERCLIP_API` | `http://127.0.0.1:3100/api` | Your Paperclip instance's API base URL |
| `STUDIO_PORT` | `4300` | Port Studio listens on |
| `STUDIO_HOST` | `127.0.0.1` | Host Studio binds to |
| `STUDIO_DEMO` | unset | Set to `1` to force sample data, even if a real Paperclip is reachable |

Visit a specific company at `/c/<issue-prefix-or-id>`, e.g. `/c/PAP`.

## What it does (and doesn't do)

Studio polls your Paperclip API's `/companies`, `/agents`, `/issues`, `/activity`, and `/heartbeat-runs` endpoints and renders the result. It never writes anything back — there is no create, update, or delete path anywhere in the client or server. If you can see it in Studio, it already happened in Paperclip.

## Status

Not affiliated with or endorsed by paperclip.ing — an independent, community project for a tool I use daily.

## Credits

Built on [three.js](https://threejs.org) (MIT).

## License

MIT — see [LICENSE](LICENSE).
