# Deployment

## What Multiplayer Needs

Multiplayer is not pure static hosting. The game needs:

- a static frontend
- an `/api/rooms` signaling endpoint
- short-lived room state

After signaling finishes, gameplay itself runs peer-to-peer over WebRTC.

## Current Implementation

The current repo ships a Cloudflare-first signaling backend:

- [rooms-worker.js](/Users/kyleberry/warring/rooms-worker.js)
- [wrangler.toml](/Users/kyleberry/warring/wrangler.toml)
- Durable Object binding: `ROOM_DO`

That means the simplest production path is Cloudflare Workers.

## Platform Answers

### GitHub Pages

Frontend only.

- Good for serving the static page
- Not enough for multiplayer by itself
- You would need a separate signaling backend on another platform and point `WARRING_SIGNALING_BASE` at it

Verdict: `single-player yes`, `multiplayer not by itself`

### Vercel

Possible, but not with the current backend unchanged.

- Static frontend is easy
- The current Worker + Durable Object backend is Cloudflare-specific
- You would need to rewrite signaling to Vercel Functions plus a state store such as KV/Redis/Postgres, or host the signaling worker elsewhere

Verdict: `yes with backend adaptation`

### Netlify

Same tradeoff as Vercel.

- Static frontend is easy
- The current backend is not Netlify-native
- You need a Netlify Function plus a state store, or use Cloudflare for signaling

Verdict: `yes with backend adaptation`

### Cloudflare Workers

Best fit for the current code.

- The current signaling backend already targets this runtime
- Durable Objects match the room-state model well
- One deploy can serve both the frontend and `/api`

Verdict: `best current option`

## Local Run

```bash
npx wrangler dev --local --port 8787
```

Open:

```text
http://127.0.0.1:8787
```

## Production Concerns Still Worth Doing

- add TURN support for harder NAT/firewall cases
- add disconnect handling and player-facing retry states
- add room cleanup / metrics / abuse limits
- add rematch and return-to-lobby flow
- add explicit production `PUBLIC_BASE_URL`
- add end-to-end multiplayer smoke tests

## Minimal Static + External Backend Option

If you want the frontend on GitHub Pages, Vercel, or Netlify while keeping signaling elsewhere:

1. Deploy the signaling backend separately.
2. Set `window.WARRING_SIGNALING_BASE` before loading [app.js](/Users/kyleberry/warring/app.js), or change the meta tag in [index.html](/Users/kyleberry/warring/index.html).
3. Ensure CORS is allowed from the frontend origin.

