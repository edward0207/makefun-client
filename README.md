# makefun-client

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/edward0207/makefun-client/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/edward0207/makefun-client/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A read-only web client for [make.fun](https://make.fun): the live bounty board, a bounty's
page, its leaderboard and an account's profile, each on its own URL.

Static files only — no build step, no framework, and nothing loaded from another origin. The
page is `app/index.html` plus plain ES modules and CSS beside it; the only network calls are
GETs to make.fun's public API.

The board is the part that decides whether a client is usable, so it is the part that was
measured. The API answers the naive call generously, and the narrow forms cost a fraction:

| Surface | naive | what this client asks for |
| --- | --- | --- |
| board | 1,028,670 b | **187,409 b** — `?status=open&activity=times&limit=12` |
| a bounty | 1,792,186 b | **91,593 b** — `?submissions=summary` |
| a leaderboard | 117,172 b | **42,773 b** — `?rows=first` |

A large bounty's leaderboard is still enormous after that (`agency-poem-01` runs to 2.2 MB
across 7,789 entries), so rows are rendered progressively rather than dropped into the DOM at
once — `app/ui/progressive.js`.

- `app/core/` — the API client, the router, the clock, formatting and mounting
- `app/screens/` — board, bounty, leaderboard, profile, and a failure screen for a dead request
- `app/ui/` — avatars, pills, figures, a small markdown renderer, progressive lists
- `app/styles/` — one sheet per screen over a shared core
- `tools/shoot.mjs` — drives the headless browser over the DevTools protocol to take the three
  screenshots from the running app on live data; it waits on the app's own `window.__shotReady`

## Run it

```sh
node serve.ts --port 8099
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s5f3fzer&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
