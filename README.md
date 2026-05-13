# WARRING!

Touch-first local party game built as a single-screen web app with WebRTC multiplayer and a tiny room-code signaling backend.

## What It Is

`WARRING!` is a rapid-fire microgame battler:

- `Solo Mode`: survive until your lives run out and track win count plus average reaction time.
- `Host Game` / `Join Game`: two-player versus over WebRTC data channels.
- `35` microgames: quick 2-5 second challenges designed for phones and tablets.

## How It Works

- Frontend: [index.html](/Users/kyleberry/warring/index.html) + [app.js](/Users/kyleberry/warring/app.js)
- Signaling backend: [rooms-worker.js](/Users/kyleberry/warring/rooms-worker.js)
- Transport: WebRTC peer-to-peer gameplay after room setup
- Room setup: short room code and join link via `/api/rooms`

## Local Development

Run the full app with the signaling backend:

```bash
npx wrangler dev --local --port 8787
```

Then open:

```text
http://127.0.0.1:8787
```

Do not use `python -m http.server` for multiplayer testing. That only serves static files and will not provide `/api/rooms`.

## Files

- [index.html](/Users/kyleberry/warring/index.html): shell, layout, styles, lobby, HUD
- [app.js](/Users/kyleberry/warring/app.js): runtime, game registry, multiplayer, UI state
- [rooms-worker.js](/Users/kyleberry/warring/rooms-worker.js): Cloudflare Worker + Durable Object signaling
- [wrangler.toml](/Users/kyleberry/warring/wrangler.toml): local/prod worker config
- [MICROGAMES.md](/Users/kyleberry/warring/MICROGAMES.md): every game explained
- [DEPLOYMENT.md](/Users/kyleberry/warring/DEPLOYMENT.md): hosting options and requirements

## Multiplayer Hosting Summary

- `GitHub Pages`: static frontend only. Not enough by itself for multiplayer because there is no serverless `/api`.
- `Vercel`: yes, if you replace or proxy the signaling backend with a Vercel-compatible function/store.
- `Netlify`: yes, same condition as Vercel.
- `Cloudflare Workers`: yes, and it matches the current implementation directly.

The current repo is closest to production-ready on Cloudflare because the signaling code already targets Workers + Durable Objects.

## Gameplay Notes

- Match format: first to `5`, or highest score after `9` rounds.
- Solo format: play until `10` lives are gone.
- Host is authoritative for round selection and pacing.
- Room signaling is only for offer/answer exchange. Actual gameplay is peer-to-peer.

## Next Work

- Add rematch flow
- Add disconnect / reconnect handling
- Add TURN support for stricter NAT environments
- Add richer end-to-end multiplayer verification

