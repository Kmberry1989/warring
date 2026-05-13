const ROOM_TTL_MS = 15 * 60 * 1000;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...(init.headers || {}),
    },
  });
}

function parseRoomId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[2] || "";
}

function roomResponse(room, env, roomId, requestUrl) {
  const base = env.PUBLIC_BASE_URL || new URL(requestUrl).origin;
  return {
    roomId,
    joinUrl: `${base.replace(/\/$/, "")}?room=${roomId}`,
    expiresAt: room.expiresAt,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/rooms")) {
      return json({ error: "not_found" }, { status: 404 });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const body = await request.json();
      if (!body.offer) {
        return json({ error: "offer_required" }, { status: 400 });
      }
      let roomId = "";
      let retries = 0;
      while (!roomId && retries < 10) {
        retries += 1;
        const candidate = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
        const id = env.ROOM_DO.idFromName(candidate);
        const stub = env.ROOM_DO.get(id);
        const created = await stub.fetch("https://room.internal/create", {
          method: "POST",
          body: JSON.stringify({
            offer: body.offer,
            expiresAt: Date.now() + ROOM_TTL_MS,
          }),
        });
        if (created.ok) {
          roomId = candidate;
        }
      }
      if (!roomId) {
        return json({ error: "room_create_failed" }, { status: 500 });
      }
      const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
      const room = await (await stub.fetch("https://room.internal/meta")).json();
      return json(roomResponse(room, env, roomId, request.url), { status: 201 });
    }

    const roomId = parseRoomId(url.pathname);
    if (!roomId) {
      return json({ error: "room_not_found" }, { status: 404 });
    }

    const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));

    if (request.method === "GET" && url.pathname === `/api/rooms/${roomId}`) {
      return stub.fetch("https://room.internal/offer");
    }

    if (request.method === "POST" && url.pathname === `/api/rooms/${roomId}/answer`) {
      const body = await request.json();
      return stub.fetch("https://room.internal/answer", {
        method: "POST",
        body: JSON.stringify({ answer: body.answer }),
      });
    }

    if (request.method === "GET" && url.pathname === `/api/rooms/${roomId}/answer`) {
      return stub.fetch("https://room.internal/answer");
    }

    return json({ error: "not_found" }, { status: 404 });
  },
};

export class RoomState {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/create") {
      const existing = await this.state.storage.get("room");
      if (existing) {
        return json({ error: "room_exists" }, { status: 409 });
      }
      const room = await request.json();
      await this.state.storage.put("room", room, {
        expirationTtl: Math.ceil(ROOM_TTL_MS / 1000),
      });
      return json({ ok: true }, { status: 201 });
    }

    const room = await this.state.storage.get("room");
    if (!room) {
      return json({ error: "room_not_found" }, { status: 404 });
    }
    if (Date.now() > room.expiresAt) {
      await this.state.storage.delete("room");
      return json({ error: "room_expired" }, { status: 410 });
    }

    if (request.method === "GET" && url.pathname === "/meta") {
      return json(room);
    }

    if (request.method === "GET" && url.pathname === "/offer") {
      return json({ offer: room.offer, expiresAt: room.expiresAt });
    }

    if (request.method === "POST" && url.pathname === "/answer") {
      if (room.answer) {
        return json({ error: "room_full" }, { status: 409 });
      }
      const body = await request.json();
      room.answer = body.answer;
      await this.state.storage.put("room", room, {
        expirationTtl: Math.ceil((room.expiresAt - Date.now()) / 1000),
      });
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/answer") {
      if (!room.answer) {
        return json({ error: "waiting_for_player" }, { status: 404 });
      }
      return json({ answer: room.answer, expiresAt: room.expiresAt });
    }

    return json({ error: "not_found" }, { status: 404 });
  }
}
