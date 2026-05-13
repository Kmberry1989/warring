const $ = (selector) => document.querySelector(selector);

const SIGNALING_BASE =
  window.WARRING_SIGNALING_BASE ||
  document.querySelector('meta[name="warring-signaling-base"]')?.content ||
  "/api";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const TOTAL_ROUNDS = 9;
const SOLO_LIVES = 10;
const HOST_POLL_MS = 1000;
const ROUND_PREP_MS = 3000;
const ROUND_RESULT_MS = 2200;
const DEFAULT_GAME_MS = 12000;
const LONG_GAME_MS = 16000;
const REACTION_SET = ["🔥", "😂", "👏", "😱"];

const refs = {
  app: $("#app"),
  lobby: $("#lobby"),
  game: $("#game"),
  gameArea: $("#gameArea"),
  soloBtn: $("#soloBtn"),
  hostBtn: $("#hostBtn"),
  joinBtn: $("#joinBtn"),
  hostPanel: $("#hostPanel"),
  joinPanel: $("#joinPanel"),
  createRoomBtn: $("#createRoomBtn"),
  hostResetBtn: $("#hostResetBtn"),
  joinResetBtn: $("#joinResetBtn"),
  copyCodeBtn: $("#copyCodeBtn"),
  copyLinkBtn: $("#copyLinkBtn"),
  joinRoomBtn: $("#joinRoomBtn"),
  connectedPanel: $("#connectedPanel"),
  connectedTitle: $("#connectedTitle"),
  chatLog: $("#chatLog"),
  chatInput: $("#chatInput"),
  chatSendBtn: $("#chatSendBtn"),
  startMatchBtn: $("#startMatchBtn"),
  leaveRoomBtn: $("#leaveRoomBtn"),
  roomCodeDisplay: $("#roomCodeDisplay"),
  joinLinkDisplay: $("#joinLinkDisplay"),
  roomCodeInput: $("#roomCodeInput"),
  stat: $("#stat"),
  hudLeft: $("#hud-left"),
  hudMid: $("#hud-mid"),
  hudRight: $("#hud-right"),
  myScore: $("#ms"),
  roundNumber: $("#rn"),
  oppScore: $("#os"),
};

const appState = {
  signalingBase: SIGNALING_BASE,
  roomCode: null,
  joinUrl: null,
  pendingRole: null,
  chatHistory: [],
};

const audio = (() => {
  let actx;
  let bgmGain;
  let sfxGain;
  let bgmTempo = 220;
  let bgmStep = 0;
  let bgmTimer = 0;

  function init() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = actx.createGain();
    bgmGain.gain.value = 0.04;
    bgmGain.connect(actx.destination);
    sfxGain = actx.createGain();
    sfxGain.gain.value = 0.15;
    sfxGain.connect(actx.destination);
    playBgmLoop();
  }

  function playBgmLoop() {
    if (!actx) return;
    clearTimeout(bgmTimer);
    const notes = [220, 261.63, 329.63, 392, 440, 523.25];
    const tick = () => {
      if (!actx) return;
      if (actx.state === "suspended") actx.resume();
      const oscillator = actx.createOscillator();
      const gain = actx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = notes[bgmStep % notes.length];
      if (Math.random() > 0.9) oscillator.frequency.value *= 1.5;
      gain.gain.setValueAtTime(1, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.15);
      oscillator.connect(gain);
      gain.connect(bgmGain);
      oscillator.start();
      oscillator.stop(actx.currentTime + 0.15);
      bgmStep += 1;
      bgmTimer = window.setTimeout(tick, bgmTempo);
    };
    tick();
  }

  function playSfx(freq, durationMs, volume = 1, type = "square") {
    try {
      if (!actx) init();
      if (actx.state === "suspended") actx.resume();
      const oscillator = actx.createOscillator();
      const gain = actx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(volume, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + durationMs / 1000);
      oscillator.connect(gain);
      gain.connect(sfxGain);
      oscillator.start();
      oscillator.stop(actx.currentTime + durationMs / 1000);
    } catch (_error) {
      // Audio failure is non-fatal for gameplay.
    }
  }

  document.addEventListener("pointerdown", init, { once: true });

  return {
    setTempo(nextTempo) {
      bgmTempo = nextTempo;
    },
    click() {
      playSfx(600, 50, 0.5, "sine");
    },
    win() {
      playSfx(800, 100, 0.8, "square");
      setTimeout(() => playSfx(1200, 200, 0.8, "square"), 100);
    },
    lose() {
      playSfx(300, 200, 0.8, "sawtooth");
      setTimeout(() => playSfx(250, 300, 0.8, "sawtooth"), 150);
    },
    round() {
      playSfx(800, 70, 0.5, "sine");
    },
    note(freq, duration, volume, type) {
      playSfx(freq, duration, volume, type);
    },
  };
})();

const fx = (() => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999;";
  refs.app.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const particles = [];

  function resize() {
    canvas.width = refs.app.offsetWidth;
    canvas.height = refs.app.offsetHeight;
  }

  function spawn(x, y, isWin, options = {}) {
    const config =
      typeof options === "string"
        ? { color: options }
        : options;
    const colors = ["#FFD400", "#7B2CF5", "#00E676", "#FF1744", "#00B0FF", "#FFFFFF"];
    const amount = config.amount ?? (isWin ? 60 : 20);
    for (let i = 0; i < amount; i += 1) {
      particles.push({
        x: x ?? canvas.width / 2,
        y: y ?? canvas.height / 2,
        vx: (Math.random() - 0.5) * (isWin ? 25 : 15),
        vy: (Math.random() - 0.5) * (isWin ? 25 : 15) - (isWin ? 8 : 2),
        color: config.color ?? colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * (config.sizeMax ?? 8) + (config.sizeMin ?? 5),
        life: 1,
        type: isWin ? "fw" : "conf",
      });
    }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.type === "fw" ? 0.5 : 0.2;
      particle.life -= 0.015;
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      if (particle.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  loop();

  window.setInterval(() => {
    if (refs.lobby.classList.contains("active")) {
      spawn(Math.random() * canvas.width, Math.random() * canvas.height * 0.7, Math.random() > 0.5);
    }
  }, 1200);

  return {
    canvas,
    spawn,
  };
})();

function setStatus(message, tone = "") {
  refs.stat.textContent = message;
  refs.stat.className = tone;
}

function setLobbyMode(mode) {
  refs.hostPanel.classList.toggle("active", mode === "host");
  refs.joinPanel.classList.toggle("active", mode === "join");
  refs.connectedPanel.classList.toggle("active", mode === "connected");
  refs.hostBtn.classList.toggle("hidden", mode !== null);
  refs.joinBtn.classList.toggle("hidden", mode !== null);
  refs.soloBtn.classList.toggle("hidden", mode !== null);
}

function resetLobbyUi() {
  setLobbyMode(null);
  refs.roomCodeDisplay.textContent = "------";
  refs.joinLinkDisplay.textContent = "Create a room first.";
  refs.roomCodeInput.value = "";
  appState.roomCode = null;
  appState.joinUrl = null;
  appState.pendingRole = null;
  appState.chatHistory = [];
  refs.chatLog.replaceChildren();
  refs.chatInput.value = "";
}

function showScreen(name) {
  refs.lobby.classList.toggle("active", name === "lobby");
  refs.game.classList.toggle("active", name === "game");
}

async function copyText(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setStatus(successMessage, "success");
  } catch (_error) {
    setStatus("Copy failed. Long-press and copy manually.", "warn");
  }
}

function appendChatMessage(sender, text, me = false, kind = "") {
  const row = document.createElement("div");
  row.className = `chat-msg${me ? " me" : ""}${kind ? ` ${kind}` : ""}`;
  row.innerHTML = `<span class="chat-name">${sender}</span>${text}`;
  refs.chatLog.appendChild(row);
  refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
}

function showConnectedLobby(role) {
  showScreen("lobby");
  setLobbyMode("connected");
  refs.connectedTitle.innerHTML =
    role === "host"
      ? "<b>ROOM READY</b><br>Chat, taunt, then start the match."
      : "<b>CONNECTED</b><br>Chat while you wait for the host to start.";
  refs.startMatchBtn.classList.toggle("hidden", role !== "host");
  refs.chatInput.disabled = false;
  refs.chatSendBtn.disabled = false;
  refs.leaveRoomBtn.disabled = false;
}

function showReactionBurst(emoji, side = "right") {
  const burst = document.createElement("div");
  burst.textContent = emoji;
  burst.style.cssText =
    `position:absolute;${side === "left" ? "left" : "right"}:8%;top:20%;font-size:16cqw;z-index:145;` +
    "filter:drop-shadow(0 6px 0 #000);animation:reactionFloat 1.4s ease-out forwards;pointer-events:none";
  refs.gameArea.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}

function randomId(length) {
  let value = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function parseRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  return room ? room.toUpperCase() : "";
}

function updateHud(mode, state) {
  if (mode === "solo") {
    refs.hudLeft.innerHTML = `WINS <b id="ms">${state.myScore}</b>`;
    refs.hudMid.innerHTML =
      'SPD<br><b id="spd" style="color:#fff;font-size:18px">' +
      (state.lastTime ? state.lastTime.toFixed(2) : "--") +
      "</b>s";
    refs.hudRight.innerHTML = `LIVES <b id="os">${state.oppScore}</b>`;
    refs.myScore = $("#ms");
    refs.oppScore = $("#os");
    return;
  }
  refs.hudLeft.innerHTML = `YOU <b id="ms">${state.myScore}</b>`;
  refs.hudMid.innerHTML = `R<b id="rn">${state.round}</b>/${TOTAL_ROUNDS}`;
  refs.hudRight.innerHTML = `OPP <b id="os">${state.oppScore}</b>`;
  refs.myScore = $("#ms");
  refs.roundNumber = $("#rn");
  refs.oppScore = $("#os");
}

class SignalingClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(this.baseUrl + path, {
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch (_error) {
      throw new Error("signaling_unreachable");
    }

    if (!response.ok) {
      let error = "Request failed";
      try {
        const data = await response.json();
        error = data.error || error;
      } catch (_error) {
        if (response.status === 404) error = "signaling_missing";
        else if (response.status >= 500) error = "signaling_failed";
        else error = response.statusText || error;
      }
      throw new Error(error);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async createRoom(offer) {
    return this.request("/rooms", {
      method: "POST",
      body: JSON.stringify({ offer }),
    });
  }

  async getOffer(roomId) {
    return this.request(`/rooms/${roomId}`);
  }

  async submitAnswer(roomId, answer) {
    return this.request(`/rooms/${roomId}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
  }

  async waitForAnswer(roomId) {
    return this.request(`/rooms/${roomId}/answer`);
  }
}

class PeerTransport {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
  }

  async host({ signaling, roomReady, status }) {
    this.cleanup();
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.dc = this.pc.createDataChannel("warring");
    this.bindChannel(this.dc);
    status("creating room");
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce();
    const created = await signaling.createRoom(this.pc.localDescription.toJSON());
    roomReady(created);
    status("waiting for player");
    await this.pollForAnswer(signaling, created.roomId, status);
  }

  async join({ signaling, roomId, status }) {
    this.cleanup();
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ondatachannel = (event) => this.bindChannel(event.channel);
    status("joining");
    const payload = await signaling.getOffer(roomId);
    await this.pc.setRemoteDescription(payload.offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIce();
    await signaling.submitAnswer(roomId, this.pc.localDescription.toJSON());
    status("connecting");
  }

  bindChannel(channel) {
    this.dc = channel;
    this.dc.onopen = () => this.onopen?.();
    this.dc.onclose = () => this.onclose?.();
    this.dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.onmessage?.(parsed);
      } catch (_error) {
        // Ignore malformed packets.
      }
    };
  }

  async pollForAnswer(signaling, roomId, status) {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, HOST_POLL_MS));
      try {
        const payload = await signaling.waitForAnswer(roomId);
        if (payload?.answer) {
          status("connecting");
          await this.pc.setRemoteDescription(payload.answer);
          return;
        }
      } catch (error) {
        if (error.message === "waiting_for_player") {
          status("waiting for player");
          continue;
        }
        throw error;
      }
    }
  }

  async waitForIce() {
    if (!this.pc || this.pc.iceGatheringState === "complete") return;
    await new Promise((resolve) => {
      const handler = () => {
        if (this.pc.iceGatheringState === "complete") {
          this.pc.removeEventListener("icegatheringstatechange", handler);
          resolve();
        }
      };
      this.pc.addEventListener("icegatheringstatechange", handler);
    });
  }

  send(message) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(message));
    }
  }

  cleanup() {
    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onmessage = null;
      this.dc.onclose = null;
      try {
        this.dc.close();
      } catch (_error) {
        // Ignore close errors.
      }
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (_error) {
        // Ignore close errors.
      }
    }
    this.dc = null;
    this.pc = null;
  }
}

function createRoundScope(area) {
  const disposers = [];
  const addDisposer = (fn) => {
    disposers.push(fn);
    return fn;
  };

  return {
    area,
    addCleanup(fn) {
      addDisposer(fn);
    },
    setTimeout(fn, ms) {
      const id = window.setTimeout(fn, ms);
      addDisposer(() => clearTimeout(id));
      return id;
    },
    setInterval(fn, ms) {
      const id = window.setInterval(fn, ms);
      addDisposer(() => clearInterval(id));
      return id;
    },
    onPointerMove(target, handler) {
      target.addEventListener("pointermove", handler);
      addDisposer(() => target.removeEventListener("pointermove", handler));
    },
    onPointerUp(target, handler) {
      target.addEventListener("pointerup", handler);
      target.addEventListener("pointercancel", handler);
      addDisposer(() => {
        target.removeEventListener("pointerup", handler);
        target.removeEventListener("pointercancel", handler);
      });
    },
    dispose() {
      while (disposers.length) {
        const disposer = disposers.pop();
        disposer();
      }
      area.replaceChildren();
    },
  };
}

function finishOnce(scope, resolve) {
  let done = false;
  return (result) => {
    if (done) return;
    done = true;
    scope.dispose();
    resolve(result);
  };
}

function createGameContext(runtime, round, scope) {
  return {
    area: refs.gameArea,
    round,
    scope,
    audio,
    fx,
    randomId,
    setHtml(html) {
      refs.gameArea.innerHTML = html;
    },
    css(element, styles) {
      Object.assign(element.style, styles);
    },
    buttonBurst(event, element) {
      const rect = element.getBoundingClientRect();
      fx.spawn(event.clientX - rect.left + element.offsetLeft, event.clientY - rect.top + element.offsetTop, false);
    },
    click() {
      audio.click();
    },
    note(freq, duration, volume, type) {
      audio.note(freq, duration, volume, type);
    },
    runtime,
  };
}

function createGames() {
  const games = {};

  games.fly = {
    id: "fly",
    prompt: "SWAT!",
    hint: "DROP THE SWATTER",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div class="fly">🪰</div>' +
          '<div id="swatter" style="position:absolute;left:50%;top:18%;font-size:28cqw;transform:translate(-50%,-180%) rotate(-18deg) scale(1.4);' +
          'filter:drop-shadow(0 6px 0 rgba(0,0,0,0.32));pointer-events:none;opacity:0;transition:transform 0.16s ease, opacity 0.08s ease">🩴</div>';
        const fly = ctx.area.firstElementChild;
        const swatter = $("#swatter");
        const move = () => {
          fly.style.left = Math.random() * 72 + 8 + "%";
          fly.style.top = Math.random() * 54 + 22 + "%";
        };
        const swing = (event) => {
          const rect = ctx.area.getBoundingClientRect();
          swatter.style.opacity = "1";
          swatter.style.left = event.clientX - rect.left + "px";
          swatter.style.top = event.clientY - rect.top - 14 + "px";
          swatter.style.transform = "translate(-50%,-50%) rotate(8deg) scale(0.98)";
          ctx.scope.setTimeout(() => {
            swatter.style.opacity = "0";
            swatter.style.transform = "translate(-50%,-180%) rotate(-18deg) scale(1.4)";
          }, 110);
        };
        move();
        ctx.scope.setInterval(move, 520);
        fly.onpointerdown = (event) => {
          swing(event);
          ctx.click();
          const areaRect = ctx.area.getBoundingClientRect();
          ctx.fx.spawn(event.clientX - areaRect.left, event.clientY - areaRect.top, false);
          done({ won: true });
        };
        ctx.area.onpointerdown = (event) => swing(event);
        ctx.scope.addCleanup(() => {
          fly.onpointerdown = null;
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 14000);
      });
    },
  };

  games.dont = {
    id: "dont",
    prompt: "DON'T!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML = '<div class="dontbtn" style="background:var(--r)">DON\'T</div>';
        let safe = true;
        ctx.area.onpointerdown = () => {
          safe = false;
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: safe }), 10000);
      });
    },
  };

  games.pop = {
    id: "pop",
    prompt: "POP!",
    hint: "POP 5 BALLOONS",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let popped = 0;
        for (let i = 0; i < 5; i += 1) {
          const balloon = document.createElement("div");
          balloon.className = "balloon";
          balloon.textContent = "🎈";
          balloon.style.left = 8 + i * 17 + "%";
          balloon.style.bottom = "-20%";
          balloon.style.animationDelay = i * 0.45 + "s";
          balloon.style.animationDuration = "5.8s";
          balloon.onclick = () => {
            ctx.click();
            balloon.style.transform = "scale(0)";
            balloon.remove();
            popped += 1;
            if (popped >= 5) done({ won: true });
          };
          ctx.area.appendChild(balloon);
        }
        ctx.scope.setTimeout(() => done({ won: popped >= 5 }), 12000);
      });
    },
  };

  games.catch = {
    id: "catch",
    prompt: "CATCH!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML = '<div style="position:absolute;bottom:20px;font-size:15cqw;left:50%;transform:translateX(-50%)">🧺</div>';
        const basket = ctx.area.firstElementChild;
        let x = 50;
        let caught = 0;
        const move = (event) => {
          const point = event.touches ? event.touches[0] : event;
          const rect = ctx.area.getBoundingClientRect();
          x = ((point.clientX - rect.left) / rect.width) * 100;
          basket.style.left = x + "%";
        };
        ctx.area.onpointermove = move;
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
        });
        const drop = () => {
          const toast = document.createElement("div");
          toast.textContent = "🍞";
          toast.style.cssText = `position:absolute;font-size:12cqw;left:${Math.random() * 70 + 15}%;top:0%`;
          ctx.area.appendChild(toast);
          let y = 0;
          const fall = ctx.scope.setInterval(() => {
            y += 2.5;
            toast.style.top = y + "%";
            if (y > 75 && Math.abs(parseFloat(toast.style.left) - x) < 15) {
              clearInterval(fall);
              toast.remove();
              caught += 1;
              ctx.click();
              if (caught >= 3) done({ won: true });
            }
            if (y > 95) {
              clearInterval(fall);
              toast.remove();
            }
          }, 30);
        };
        drop();
        ctx.scope.setInterval(drop, 700);
        ctx.scope.setTimeout(() => done({ won: caught >= 3 }), 14000);
      });
    },
  };

  games.dodge = {
    id: "dodge",
    prompt: "DODGE!",
    hint: "DON'T GET BONKED",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;bottom:24px;font-size:14cqw;left:50%;transform:translateX(-50%)">🏃</div>';
        const player = ctx.area.firstElementChild;
        let playerX = 0;
        let hit = false;
        const move = (event) => {
          const point = event.touches ? event.touches[0] : event;
          const rect = ctx.area.getBoundingClientRect();
          playerX = Math.max(0, Math.min(rect.width, point.clientX - rect.left));
          player.style.left = (playerX / rect.width) * 100 + "%";
        };
        ctx.area.onpointermove = move;
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
        });
        const drop = () => {
          const banana = document.createElement("div");
          banana.textContent = "🍌";
          banana.style.cssText = `position:absolute;font-size:11cqw;left:${Math.random() * 80 + 10}%;top:0%`;
          ctx.area.appendChild(banana);
          let y = 0;
          const fall = ctx.scope.setInterval(() => {
            y += 3;
            banana.style.top = y + "%";
            const playerRect = player.getBoundingClientRect();
            const bananaRect = banana.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(playerRect.right, bananaRect.right) - Math.max(playerRect.left, bananaRect.left));
            const overlapY = Math.max(0, Math.min(playerRect.bottom, bananaRect.bottom) - Math.max(playerRect.top, bananaRect.top));
            if (overlapX > Math.min(playerRect.width, bananaRect.width) * 0.28 && overlapY > Math.min(playerRect.height, bananaRect.height) * 0.18) {
              hit = true;
            }
            if (y > 100) {
              clearInterval(fall);
              banana.remove();
            }
          }, 30);
        };
        const areaRect = ctx.area.getBoundingClientRect();
        playerX = areaRect.width * 0.5;
        ctx.scope.setInterval(drop, 500);
        ctx.scope.setTimeout(() => done({ won: !hit }), 14000);
      });
    },
  };

  games.swipe = {
    id: "swipe",
    prompt: "SWIPE!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const dirs = [
          ["→", "right"],
          ["←", "left"],
          ["↑", "up"],
          ["↓", "down"],
        ];
        const direction = dirs[Math.floor(Math.random() * dirs.length)];
        ctx.area.innerHTML = `<div class="instr" style="font-size:clamp(60px,30cqw,150px)">${direction[0]}</div>`;
        let sx = 0;
        let sy = 0;
        ctx.area.onpointerdown = (event) => {
          sx = event.clientX;
          sy = event.clientY;
        };
        ctx.area.onpointerup = (event) => {
          const dx = event.clientX - sx;
          const dy = event.clientY - sy;
          let dir = "";
          if (Math.abs(dx) > Math.abs(dy)) dir = dx > 30 ? "right" : "left";
          else dir = dy > 30 ? "down" : "up";
          done({ won: dir === direction[1] });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
          ctx.area.onpointerup = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 10000);
      });
    },
  };

  games.triple = {
    id: "triple",
    prompt: "CLICK!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div class="dontbtn" style="background:var(--b);display:flex;flex-direction:column;gap:8px">' +
          '<span style="font-size:0.22em;letter-spacing:0.18em">CLICKS LEFT</span><span id="tripleCount">3</span></div>';
        const btn = ctx.area.firstElementChild;
        const countLabel = $("#tripleCount");
        let remaining = 3;
        btn.onclick = () => {
          if (remaining <= 0) return;
          remaining -= 1;
          ctx.click();
          countLabel.textContent = String(remaining);
          btn.style.transform = `translate(-50%, -50%) scale(${1 - (3 - remaining) * 0.05})`;
          if (remaining === 0) done({ won: true });
        };
        ctx.scope.setTimeout(() => done({ won: remaining === 0 }), 10000);
      });
    },
  };

  games.hold = {
    id: "hold",
    prompt: "HOLD!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div class="dontbtn" style="background:#0a0;overflow:hidden"><div id="hf" style="position:absolute;bottom:0;left:0;width:100%;height:0%;background:rgba(255,255,255,0.4);transition:height 1.8s linear;pointer-events:none"></div><span id="ht" style="z-index:2">HOLD</span></div>';
        const button = ctx.area.firstElementChild;
        const fill = $("#hf");
        const label = $("#ht");
        let start = 0;
        let timer = 0;
        const down = () => {
          if (start) return;
          start = Date.now();
          ctx.click();
          fill.style.height = "100%";
          timer = window.setTimeout(() => {
            label.textContent = "LET GO!";
            button.style.transform = "translate(-50%, -50%) scale(1.15)";
            ctx.note(1200, 100, 0.6, "sine");
          }, 1800);
        };
        const up = () => {
          if (!start) return;
          clearTimeout(timer);
          done({ won: Date.now() - start > 1800 });
          start = 0;
        };
        button.onpointerdown = down;
        button.onpointerup = up;
        button.onpointerleave = up;
        ctx.scope.addCleanup(() => {
          clearTimeout(timer);
          button.onpointerdown = null;
          button.onpointerup = null;
          button.onpointerleave = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 11000);
      });
    },
  };

  games.mash = {
    id: "mash",
    prompt: "MASH!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML = '<div class="dontbtn" style="background:var(--p)">0</div>';
        const btn = ctx.area.firstElementChild;
        let count = 0;
        btn.onclick = () => {
          count += 1;
          ctx.click();
          btn.textContent = String(count);
          btn.style.transform = `translate(-50%, -50%) scale(${1 + count * 0.04})`;
          if (count >= 12) done({ won: true });
        };
        ctx.scope.setTimeout(() => done({ won: count >= 12 }), 11000);
      });
    },
  };

  games.trace = {
    id: "trace",
    prompt: "TRACE!",
    hint: "FOLLOW THE SHAPE",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<canvas id="cv" width="320" height="320" style="position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);max-width:90cqw;max-height:90cqw;touch-action:none"></canvas>';
        const canvas = $("#cv");
        const draw = canvas.getContext("2d");
        const shapes = [
          [
            { x: 54, y: 208 },
            { x: 96, y: 106 },
            { x: 160, y: 56 },
            { x: 228, y: 112 },
            { x: 266, y: 206 },
          ],
          [
            { x: 52, y: 164 },
            { x: 104, y: 100 },
            { x: 160, y: 152 },
            { x: 214, y: 98 },
            { x: 270, y: 160 },
            { x: 218, y: 222 },
            { x: 160, y: 180 },
            { x: 98, y: 228 },
          ],
          [
            { x: 74, y: 244 },
            { x: 96, y: 126 },
            { x: 160, y: 74 },
            { x: 224, y: 126 },
            { x: 246, y: 244 },
          ],
        ];
        const points = shapes[Math.floor(Math.random() * shapes.length)];
        draw.lineWidth = 16;
        draw.lineJoin = "round";
        draw.lineCap = "round";
        draw.strokeStyle = "rgba(255,255,255,0.45)";
        draw.setLineDash([12, 10]);
        draw.beginPath();
        draw.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => draw.lineTo(point.x, point.y));
        draw.stroke();
        draw.setLineDash([]);
        draw.lineWidth = 8;
        draw.strokeStyle = "rgba(255,244,184,0.98)";
        draw.beginPath();
        draw.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => draw.lineTo(point.x, point.y));
        draw.stroke();
        points.forEach((point, index) => {
          draw.fillStyle = index === 0 ? "#8cffb2" : "#ffffff";
          draw.beginPath();
          draw.arc(point.x, point.y, index === 0 ? 10 : 7, 0, Math.PI * 2);
          draw.fill();
        });
        let dragging = false;
        let progress = 0;
        let strokes = 0;
        const handle = (event) => {
          if (!dragging || progress >= points.length) return;
          const rect = canvas.getBoundingClientRect();
          const point = event.touches ? event.touches[0] : event;
          const x = ((point.clientX - rect.left) * 320) / rect.width;
          const y = ((point.clientY - rect.top) * 320) / rect.height;
          draw.fillStyle = "rgba(255,255,255,0.42)";
          draw.beginPath();
          draw.arc(x, y, 7, 0, Math.PI * 2);
          draw.fill();
          strokes += 1;
          const next = points[progress];
          if (Math.hypot(x - next.x, y - next.y) < 24) {
            progress += 1;
            ctx.note(560 + progress * 70, 70, 0.45, "sine");
            const areaRect = ctx.area.getBoundingClientRect();
            ctx.fx.spawn((x / 320) * areaRect.width, (y / 320) * areaRect.height, false);
            if (progress >= points.length) done({ won: true });
          } else if (strokes % 8 === 0) {
            ctx.click();
          }
        };
        canvas.onpointerdown = (event) => {
          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) * 320) / rect.width;
          const y = ((event.clientY - rect.top) * 320) / rect.height;
          dragging = Math.hypot(x - points[0].x, y - points[0].y) < 28;
        };
        canvas.onpointerup = () => {
          dragging = false;
        };
        canvas.onpointermove = handle;
        ctx.scope.addCleanup(() => {
          canvas.onpointerdown = null;
          canvas.onpointerup = null;
          canvas.onpointermove = null;
        });
        ctx.scope.setTimeout(() => done({ won: progress >= points.length }), 15000);
      });
    },
  };

  games.match = {
    id: "match",
    prompt: "PAIR!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const items = ["🍎", "🍎", "🍌", "🍌", "🍇", "🍇"].sort(() => Math.random() - 0.5);
        let open = null;
        let found = 0;
        items.forEach((value, index) => {
          const item = document.createElement("div");
          item.className = "find-item";
          item.textContent = "❓";
          item.style.cssText =
            `left:${12 + (index % 3) * 29}%;top:${18 + Math.floor(index / 3) * 35}%;` +
            "width:23%;height:28%;display:flex;align-items:center;justify-content:center;" +
            "font-size:13cqw;border-radius:18px;border:2px solid rgba(255,255,255,0.78);" +
            "background:linear-gradient(180deg,rgba(255,255,255,0.24) 0%,rgba(145,110,52,0.26) 100%);" +
            "box-shadow:0 12px 18px rgba(21,27,52,0.22);backdrop-filter:blur(6px)";
          item.flipped = false;
          item.val = value;
          item.onclick = () => {
            if (item.flipped) return;
            item.flipped = true;
            ctx.click();
            item.style.transition = "transform 0.18s ease-in, filter 0.18s ease-in";
            item.style.transform = "scaleX(0.08) rotateY(90deg)";
            item.style.filter = "brightness(1.18)";
            ctx.scope.setTimeout(() => {
              item.textContent = value;
              item.style.transition = "transform 0.18s ease-out, filter 0.18s ease-out";
              item.style.transform = "scaleX(1) rotateY(0deg)";
              item.style.filter = "brightness(1)";
            }, 180);
            if (!open) {
              open = item;
              return;
            }
            if (open.val === value) {
              found += 1;
              item.style.background = "linear-gradient(180deg,rgba(180,255,212,0.94) 0%,rgba(104,195,136,0.92) 100%)";
              open.style.background = "linear-gradient(180deg,rgba(180,255,212,0.94) 0%,rgba(104,195,136,0.92) 100%)";
              open = null;
              if (found === 3) ctx.scope.setTimeout(() => done({ won: true }), 300);
              return;
            }
            const other = open;
            open = null;
            ctx.scope.setTimeout(() => {
              item.style.transition = "transform 0.18s ease-in";
              item.style.transform = "scaleX(0.08) rotateY(90deg)";
              other.style.transition = "transform 0.18s ease-in";
              other.style.transform = "scaleX(0.08) rotateY(90deg)";
              ctx.scope.setTimeout(() => {
                item.textContent = "❓";
                other.textContent = "❓";
                item.flipped = false;
                other.flipped = false;
                item.style.transition = "transform 0.18s ease-out";
                item.style.transform = "scaleX(1) rotateY(0deg)";
                other.style.transition = "transform 0.18s ease-out";
                other.style.transform = "scaleX(1) rotateY(0deg)";
              }, 180);
            }, 700);
          };
          ctx.area.appendChild(item);
        });
        ctx.scope.setTimeout(() => done({ won: found === 3 }), 24000);
      });
    },
  };

  games.avoid = {
    id: "avoid",
    prompt: "GREEN!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let safe = true;
        let greens = 0;
        for (let i = 0; i < 12; i += 1) {
          const green = Math.random() > 0.7;
          if (green) greens += 1;
          const item = document.createElement("div");
          item.className = "find-item";
          item.textContent = green ? "🟢" : "🔴";
          item.style.cssText = `left:${Math.random() * 75 + 5}%;top:${Math.random() * 65 + 10}%`;
          item.onclick = () => {
            ctx.click();
            if (!green) {
              safe = false;
              done({ won: false });
              return;
            }
            item.remove();
            greens -= 1;
            if (greens <= 0) done({ won: safe });
          };
          ctx.area.appendChild(item);
        }
        ctx.scope.setTimeout(() => done({ won: safe && greens <= 0 }), 10000);
      });
    },
  };

  games.pump = {
    id: "pump",
    prompt: "PUMP!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="font-size:20cqw;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.6)">🎈</div>';
        const balloon = ctx.area.firstElementChild;
        let size = 0.6;
        ctx.area.onclick = () => {
          ctx.click();
          size += 0.12;
          balloon.style.transform = `translate(-50%,-50%) scale(${size})`;
          if (size > 1.8) done({ won: true });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onclick = null;
        });
        ctx.scope.setTimeout(() => done({ won: size > 1.8 }), 10000);
      });
    },
  };

  games.whack = {
    id: "whack",
    prompt: "WHACK!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let hits = 0;
        for (let i = 0; i < 9; i += 1) {
          const hole = document.createElement("div");
          hole.style.cssText =
            `position:absolute;width:24%;height:22%;left:${8 + (i % 3) * 30}%;top:${10 + Math.floor(i / 3) * 28}%;` +
            "background:#630;border-radius:50%";
          ctx.area.appendChild(hole);
        }
        const spawn = () => {
          const hole = ctx.area.children[Math.floor(Math.random() * 9)];
          hole.innerHTML =
            '<div style="font-size:14cqw;cursor:pointer;text-align:center;margin-top:10%">🐹</div>';
          hole.firstElementChild.onclick = () => {
            ctx.click();
            hits += 1;
            hole.innerHTML = "";
            if (hits >= 3) done({ won: true });
          };
          ctx.scope.setTimeout(() => {
            hole.innerHTML = "";
          }, 800);
        };
        ctx.scope.setInterval(spawn, 600);
        ctx.scope.setTimeout(() => done({ won: hits >= 3 }), 12000);
      });
    },
  };

  games.stop = {
    id: "stop",
    prompt: "STOP!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:10%;top:45%;width:80%;height:30px;background:#444;border:3px solid #000">' +
          '<div style="position:absolute;left:40%;width:20%;height:100%;background:#0f0"></div>' +
          '<div id="pt" style="position:absolute;left:0%;width:10px;height:40px;background:#fff;top:-5px"></div></div>';
        const pointer = $("#pt");
        let x = 0;
        let direction = 1;
        const ticker = ctx.scope.setInterval(() => {
          x += direction * 2;
          if (x > 100 || x < 0) direction *= -1;
          pointer.style.left = x + "%";
        }, 20);
        ctx.area.onclick = () => {
          clearInterval(ticker);
          done({ won: x > 38 && x < 62 });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onclick = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 10000);
      });
    },
  };

  games.drag = {
    id: "drag",
    prompt: "DRAG!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="board" style="position:absolute;left:70%;top:30%;font-size:16cqw">🎯</div>' +
          '<div id="st" style="position:absolute;left:20%;top:60%;font-size:14cqw;cursor:pointer;touch-action:none">📍</div>';
        const star = $("#st");
        const board = $("#board");
        let dragging = false;
        const move = (event) => {
          if (!dragging) return;
          const rect = ctx.area.getBoundingClientRect();
          const point = event.touches ? event.touches[0] : event;
          const x = point.clientX - rect.left;
          const y = point.clientY - rect.top;
          star.style.left = x - 30 + "px";
          star.style.top = y - 30 + "px";
          const targetRect = board.getBoundingClientRect();
          if (
            Math.hypot(
              point.clientX - (targetRect.left + targetRect.width / 2),
              point.clientY - (targetRect.top + targetRect.height / 2)
            ) < 50
          ) {
            dragging = false;
            done({ won: true });
          }
        };
        const up = () => {
          dragging = false;
        };
        star.onpointerdown = () => {
          dragging = true;
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        ctx.scope.addCleanup(() => {
          star.onpointerdown = null;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        });
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.scratch = {
    id: "scratch",
    prompt: "SCRATCH!",
    hint: "USE THE COIN",
    duration: 16000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;inset:25%;background:linear-gradient(180deg,#fffef7 0%,#f8f0db 100%);display:flex;align-items:center;justify-content:center;font-size:12cqw;border:3px solid rgba(255,255,255,0.8);border-radius:24px;box-shadow:0 16px 32px rgba(46,67,118,0.15)">💎</div>' +
          '<canvas id="sc" width="320" height="320" style="position:absolute;inset:25%;width:50%;height:50%;touch-action:none"></canvas>' +
          '<div id="coin" style="position:absolute;left:50%;top:50%;font-size:15cqw;z-index:8;pointer-events:none;filter:drop-shadow(0 5px 0 rgba(0,0,0,0.3))">🪙</div>';
        const canvas = $("#sc");
        const coin = $("#coin");
        const draw = canvas.getContext("2d");
        draw.fillStyle = "#b9c0c8";
        draw.fillRect(0, 0, 320, 320);
        draw.fillStyle = "rgba(255,255,255,0.1)";
        for (let x = 0; x < 320; x += 24) {
          for (let y = 0; y < 320; y += 24) {
            draw.beginPath();
            draw.arc(x + 10, y + 12, 7, 0, Math.PI * 2);
            draw.fill();
          }
        }
        draw.globalCompositeOperation = "destination-out";
        let scratching = false;
        let lastSampleAt = 0;
        const revealRatio = () => {
          const image = draw.getImageData(0, 0, 320, 320).data;
          let clear = 0;
          for (let i = 3; i < image.length; i += 24) {
            if (image[i] < 60) clear += 1;
          }
          return clear / (image.length / 24);
        };
        const scratch = (event) => {
          if (!scratching) return;
          const rect = canvas.getBoundingClientRect();
          const areaRect = ctx.area.getBoundingClientRect();
          coin.style.left = event.clientX - areaRect.left - 24 + "px";
          coin.style.top = event.clientY - areaRect.top - 24 + "px";
          const x = ((event.clientX - rect.left) * 320) / rect.width;
          const y = ((event.clientY - rect.top) * 320) / rect.height;
          draw.beginPath();
          draw.arc(x, y, 22, 0, Math.PI * 2);
          draw.fill();
          if (Date.now() - lastSampleAt > 110) {
            ctx.fx.spawn(event.clientX - areaRect.left, event.clientY - areaRect.top, false, {
              color: "#c7ced6",
              amount: 6,
              sizeMin: 2,
              sizeMax: 4,
            });
          }
          if (Date.now() - lastSampleAt > 220) {
            lastSampleAt = Date.now();
            ctx.click();
            if (revealRatio() > 0.55) done({ won: true });
          }
        };
        canvas.onpointerdown = (event) => {
          scratching = true;
          scratch(event);
        };
        canvas.onpointerup = () => {
          scratching = false;
        };
        canvas.onpointerleave = () => {
          scratching = false;
        };
        canvas.onpointermove = scratch;
        ctx.scope.addCleanup(() => {
          canvas.onpointerdown = null;
          canvas.onpointerup = null;
          canvas.onpointerleave = null;
          canvas.onpointermove = null;
        });
        ctx.scope.setTimeout(() => done({ won: revealRatio() > 0.55 }), 16000);
      });
    },
  };

  games.find = {
    id: "find",
    prompt: "FIND!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const emojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣"];
        const base = emojis[Math.floor(Math.random() * emojis.length)];
        let odd = base;
        while (odd === base) odd = emojis[Math.floor(Math.random() * emojis.length)];
        const oddIndex = Math.floor(Math.random() * 12);
        for (let i = 0; i < 12; i += 1) {
          const item = document.createElement("div");
          item.className = "find-item";
          item.textContent = i === oddIndex ? odd : base;
          item.style.cssText = `left:${10 + (i % 4) * 22}%;top:${20 + Math.floor(i / 4) * 22}%`;
          item.onclick = () => done({ won: i === oddIndex });
          ctx.area.appendChild(item);
        }
        ctx.scope.setTimeout(() => done({ won: false }), 14000);
      });
    },
  };

  games.feed = {
    id: "feed",
    prompt: "FEED!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="m" style="position:absolute;right:10%;top:40%;font-size:16cqw">😮</div>' +
          '<div id="f" style="position:absolute;left:10%;top:40%;font-size:12cqw;cursor:pointer;touch-action:none">🍔</div>';
        const food = $("#f");
        const mouth = $("#m");
        let dragging = false;
        const move = (event) => {
          if (!dragging) return;
          const rect = ctx.area.getBoundingClientRect();
          const point = event.touches ? event.touches[0] : event;
          food.style.left = point.clientX - rect.left - 30 + "px";
          food.style.top = point.clientY - rect.top - 30 + "px";
          const mouthRect = mouth.getBoundingClientRect();
          if (
            Math.hypot(
              point.clientX - (mouthRect.left + mouthRect.width / 2),
              point.clientY - (mouthRect.top + mouthRect.height / 2)
            ) < 60
          ) {
            mouth.textContent = "😋";
            dragging = false;
            done({ won: true });
          }
        };
        const up = () => {
          dragging = false;
        };
        food.onpointerdown = () => {
          dragging = true;
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        ctx.scope.addCleanup(() => {
          food.onpointerdown = null;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        });
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.order = {
    id: "order",
    prompt: "1-2-3!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let current = 1;
        const zones = [
          { x: 15, y: 20 },
          { x: 65, y: 45 },
          { x: 25, y: 70 },
        ].sort(() => Math.random() - 0.5);
        for (let i = 1; i <= 3; i += 1) {
          const btn = document.createElement("div");
          btn.style.cssText =
            `position:absolute;left:${zones[i - 1].x}%;top:${zones[i - 1].y}%;width:20cqw;height:20cqw;` +
            "background:var(--y);border:4px solid #000;border-radius:50%;display:flex;align-items:center;" +
            "justify-content:center;font-size:10cqw;font-weight:900;cursor:pointer";
          btn.textContent = String(i);
          btn.onclick = () => {
            ctx.click();
            if (i === current) {
              btn.style.background = "#0E6";
              current += 1;
              if (current > 3) done({ won: true });
            } else {
              done({ won: false });
            }
          };
          ctx.area.appendChild(btn);
        }
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.jump = {
    id: "jump",
    prompt: "JUMP!",
    hint: "HOP THE CAR",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="p" style="position:absolute;left:20%;bottom:20%;font-size:14cqw">🧍</div>' +
          '<div id="o" style="position:absolute;left:100%;bottom:20%;font-size:12cqw">🚕</div>';
        const player = $("#p");
        const obstacle = $("#o");
        let velocity = 0;
        let y = 20;
        let ox = 100;
        let jumping = false;
        let speed = 0.92;
        const loop = ctx.scope.setInterval(() => {
          speed = Math.min(2.2, speed + 0.012);
          ox -= speed;
          obstacle.style.left = ox + "%";
          if (jumping) {
            y += velocity;
            velocity -= 0.58;
          }
          if (y <= 20) {
            y = 20;
            velocity = 0;
            jumping = false;
          }
          player.style.bottom = y + "%";
          if (ox < 32 && ox > 9 && y < 38) done({ won: false });
          if (ox < -20) done({ won: true });
        }, 30);
        ctx.area.onpointerdown = () => {
          if (!jumping) {
            jumping = true;
            velocity = 9.2;
            ctx.click();
          }
        };
        ctx.scope.addCleanup(() => {
          clearInterval(loop);
          ctx.area.onpointerdown = null;
        });
      });
    },
  };

  games.slice = {
    id: "slice",
    prompt: "SLICE!",
    hint: "CUT EVERY PIECE",
    duration: 16000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="sliceBoard" style="position:absolute;inset:0;touch-action:none"></div>' +
          '<div id="sliceStatus" style="position:absolute;top:10%;width:100%;text-align:center;color:#fff;font-size:5.8cqw;' +
          '-webkit-text-stroke:1px rgba(30,38,73,0.45);text-shadow:0 6px 16px rgba(35,47,95,0.35)">1 OF 3</div>';
        const board = $("#sliceBoard");
        const status = $("#sliceStatus");
        const stages = [
          [{ left: 50, top: 50, size: 20, emoji: "🍉" }],
          [
            { left: 36, top: 48, size: 15, emoji: "🍉" },
            { left: 64, top: 52, size: 15, emoji: "🍉" },
          ],
          [
            { left: 28, top: 42, size: 12, emoji: "🍉" },
            { left: 46, top: 58, size: 12, emoji: "🍉" },
            { left: 60, top: 40, size: 12, emoji: "🍉" },
            { left: 74, top: 58, size: 12, emoji: "🍉" },
          ],
        ];
        let stageIndex = 0;
        let dragging = false;
        const renderStage = () => {
          board.replaceChildren();
          status.textContent = `${stageIndex + 1} OF ${stages.length}`;
          stages[stageIndex].forEach((piece, index) => {
            const node = document.createElement("div");
            node.dataset.sliceIndex = String(index);
            node.style.cssText =
              `position:absolute;left:${piece.left}%;top:${piece.top}%;transform:translate(-50%,-50%);` +
              `font-size:${piece.size}cqw;transition:transform 0.16s ease, opacity 0.16s ease;filter:drop-shadow(0 5px 0 rgba(0,0,0,0.28))`;
            node.textContent = piece.emoji;
            board.appendChild(node);
          });
        };
        const advanceStage = () => {
          stageIndex += 1;
          if (stageIndex >= stages.length) {
            done({ won: true });
            return;
          }
          renderStage();
        };
        renderStage();
        ctx.area.onpointerdown = () => {
          dragging = true;
        };
        ctx.area.onpointermove = (event) => {
          if (!dragging) return;
          const target = document.elementFromPoint(event.clientX, event.clientY);
          if (target?.dataset?.sliceIndex) {
            const rect = target.getBoundingClientRect();
            const areaRect = ctx.area.getBoundingClientRect();
            ctx.note(780, 90, 0.5, "triangle");
            ctx.fx.spawn(rect.left - areaRect.left + rect.width / 2, rect.top - areaRect.top + rect.height / 2, false);
            target.style.transform = "translate(-50%,-50%) scale(0.72) rotate(-12deg)";
            target.style.opacity = "0.35";
            target.removeAttribute("data-slice-index");
            ctx.scope.setTimeout(() => {
              target.remove();
              if (!board.querySelector("[data-slice-index]")) advanceStage();
            }, 80);
          }
        };
        ctx.area.onpointerup = () => {
          dragging = false;
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
          ctx.area.onpointermove = null;
          ctx.area.onpointerup = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 16000);
      });
    },
  };

  games.scrub = {
    id: "scrub",
    prompt: "SCRUB!",
    hint: "MOVE THE SPONGE",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.style.cursor = "none";
        const sponge = document.createElement("div");
        sponge.textContent = "🧽";
        sponge.style.cssText =
          "position:absolute;left:50%;top:50%;font-size:17cqw;z-index:8;pointer-events:none;filter:drop-shadow(0 5px 0 rgba(0,0,0,0.3))";
        ctx.area.appendChild(sponge);
        let dirtCount = 8 + Math.floor(ctx.round / 3);
        for (let i = 0; i < dirtCount; i += 1) {
          const dirt = document.createElement("div");
          dirt.className = "dirt";
          dirt.textContent = "🟤";
          dirt.style.cssText =
            `position:absolute;left:${Math.random() * 80 + 10}%;top:${Math.random() * 70 + 15}%;font-size:${Math.random() * 5 + 9}cqw;` +
            "transform:translate(-50%,-50%) rotate(-8deg);filter:drop-shadow(0 3px 0 rgba(0,0,0,0.35))";
          ctx.area.appendChild(dirt);
        }
        ctx.area.onpointermove = (event) => {
          const rect = ctx.area.getBoundingClientRect();
          sponge.style.left = event.clientX - rect.left - 28 + "px";
          sponge.style.top = event.clientY - rect.top - 28 + "px";
          const target = document.elementFromPoint(event.clientX, event.clientY);
          if (target?.classList.contains("dirt")) {
            ctx.fx.spawn(event.clientX - rect.left, event.clientY - rect.top, false);
            target.remove();
            dirtCount -= 1;
            if (dirtCount % 3 === 0) ctx.click();
            if (dirtCount <= 0) done({ won: true });
          }
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
          ctx.area.style.cursor = "";
        });
        ctx.scope.setTimeout(() => done({ won: false }), 15000);
      });
    },
  };

  games.math = {
    id: "math",
    prompt: "SOLVE!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const n1 = Math.floor(Math.random() * 5) + 1;
        const n2 = Math.floor(Math.random() * 5) + 1;
        const answer = n1 + n2;
        const options = [answer, answer + 1, answer - 1].sort(() => Math.random() - 0.5);
        ctx.area.innerHTML = `<div style="text-align:center;font-size:15cqw;margin-top:20%">${n1}+${n2}</div>`;
        options.forEach((value, index) => {
          const bubble = document.createElement("div");
          bubble.style.cssText =
            `position:absolute;left:${15 + index * 28}%;bottom:25%;width:20cqw;height:20cqw;` +
            "background:var(--b);border-radius:50%;display:flex;align-items:center;" +
            "justify-content:center;font-size:10cqw;cursor:pointer";
          bubble.textContent = String(value);
          bubble.onclick = () => done({ won: value === answer });
          ctx.area.appendChild(bubble);
        });
        ctx.scope.setTimeout(() => done({ won: false }), 15000);
      });
    },
  };

  games.shoot = {
    id: "shoot",
    prompt: "SHOOT!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="tg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:15cqw">👾</div>';
        const target = $("#tg");
        let x = 50;
        let direction = 1;
        const loop = ctx.scope.setInterval(() => {
          x += direction * 3;
          if (x > 80 || x < 20) direction *= -1;
          target.style.left = x + "%";
        }, 30);
        target.onpointerdown = (event) => {
          event.stopPropagation();
          clearInterval(loop);
          done({ won: true });
        };
        ctx.area.onpointerdown = () => {
          clearInterval(loop);
          done({ won: false });
        };
        ctx.scope.addCleanup(() => {
          target.onpointerdown = null;
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.simon = {
    id: "simon",
    prompt: "SIMON!",
    hint: "REPEAT THE COLORS",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const colors = ["#F14", "#0E6", "#0BF"];
        const sequence = Array.from({ length: 3 }, () => Math.floor(Math.random() * 3));
        let step = 0;
        let listening = false;
        const buttons = [];
        const status = document.createElement("div");
        status.style.cssText =
          "position:absolute;left:0;right:0;top:16%;text-align:center;color:#fff;font-size:8cqw;" +
          "-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000";
        status.textContent = "WATCH";
        ctx.area.appendChild(status);
        for (let i = 0; i < 3; i += 1) {
          const item = document.createElement("div");
          item.style.cssText =
            `position:absolute;left:${15 + i * 25}%;top:40%;width:20cqw;height:20cqw;` +
            `background:${colors[i]};border-radius:15px;opacity:0.3;border:4px solid #000;box-shadow:0 6px 0 #000;transition:transform 0.08s, opacity 0.08s, filter 0.08s`;
          const pulse = () => {
            item.style.opacity = "1";
            item.style.transform = "scale(0.94)";
            item.style.filter = "brightness(1.25)";
            ctx.scope.setTimeout(() => {
              item.style.opacity = listening ? "0.82" : "0.3";
              item.style.transform = "scale(1)";
              item.style.filter = "brightness(1)";
            }, 140);
          };
          item.onclick = () => {
            if (!listening) return;
            ctx.note(400 + i * 200, 150, 0.5);
            pulse();
            if (i === sequence[step]) {
              step += 1;
              status.textContent = `${step}/${sequence.length}`;
              if (step === sequence.length) done({ won: true });
            } else {
              status.textContent = "NOPE";
              done({ won: false });
            }
          };
          buttons.push(item);
          ctx.area.appendChild(item);
        }
        let flash = 0;
        const show = ctx.scope.setInterval(() => {
          if (flash >= sequence.length) {
            clearInterval(show);
            listening = true;
            status.textContent = "REPEAT";
            buttons.forEach((button) => {
              button.style.opacity = "0.82";
            });
            return;
          }
          const btn = buttons[sequence[flash]];
          btn.style.opacity = "1";
          btn.style.transform = "scale(0.94)";
          btn.style.filter = "brightness(1.25)";
          ctx.note(400 + sequence[flash] * 200, 150, 0.5);
          ctx.scope.setTimeout(() => {
            btn.style.opacity = "0.3";
            btn.style.transform = "scale(1)";
            btn.style.filter = "brightness(1)";
          }, 200);
          flash += 1;
        }, 450);
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.rhythm = {
    id: "rhythm",
    prompt: "BEAT!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:120px;height:120px;border:8px solid #0E6;border-radius:50%"></div>' +
          '<div id="rr" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:400px;height:400px;border:6px solid #fff;border-radius:50%;transition:all 2s linear"></div>';
        ctx.scope.setTimeout(() => {
          const ring = $("#rr");
          if (ring) {
            ring.style.width = "20px";
            ring.style.height = "20px";
          }
        }, 50);
        ctx.area.onpointerdown = () => {
          const width = $("#rr").getBoundingClientRect().width;
          done({ won: width > 90 && width < 150 });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 10000);
      });
    },
  };

  games.mug = {
    id: "mug",
    prompt: "GRAB!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:0;top:70%;width:100%;height:10px;background:#743;border-top:4px solid #000"></div>' +
          '<div style="position:absolute;right:10%;top:63%;width:15cqw;height:5px;background:#0E6"></div>' +
          '<div id="mug" style="position:absolute;left:-20%;top:50%;font-size:15cqw">🍺</div>';
        const mug = $("#mug");
        let x = -20;
        const move = ctx.scope.setInterval(() => {
          x += 3 + ctx.round * 0.1;
          mug.style.left = x + "%";
          if (x > 110) done({ won: false });
        }, 20);
        ctx.area.onpointerdown = () => {
          clearInterval(move);
          done({ won: x > 72 && x < 88 });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
        });
      });
    },
  };

  games.spy = {
    id: "spy",
    prompt: "FOLLOW!",
    hint: "TRACK THE THIEF",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="thief" style="position:absolute;font-size:12cqw;transition:all 0.45s linear;left:50%;top:50%;filter:drop-shadow(0 4px 0 #000)">🕵️</div>' +
          '<div id="overlay" style="position:absolute;inset:0;background:radial-gradient(circle 185px at 50% 50%, rgba(255,255,255,0.1), rgba(8,16,30,0.28) 56%, rgba(8,16,30,0.5) 100%);pointer-events:none"></div>' +
          '<div id="spyScore" style="position:absolute;top:10%;width:100%;text-align:center;color:#fff;font-size:7cqw;-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000">0</div>';
        const thief = $("#thief");
        const overlay = $("#overlay");
        const scoreEl = $("#spyScore");
        let tx = 50;
        let ty = 50;
        let px = 50;
        let py = 50;
        let score = 0;
        const moveThief = () => {
          tx = 10 + Math.random() * 80;
          ty = 10 + Math.random() * 70;
          thief.style.left = tx + "%";
          thief.style.top = ty + "%";
        };
        const watch = (x, y) => {
          const rect = ctx.area.getBoundingClientRect();
          px = ((x - rect.left) / rect.width) * 100;
          py = ((y - rect.top) / rect.height) * 100;
          overlay.style.background =
            `radial-gradient(circle 160px at ${px}% ${py}%, rgba(255,255,255,0.12), rgba(8,16,30,0.28) 60%, rgba(8,16,30,0.5) 100%)`;
        };
        const move = (event) => {
          const point = event.touches ? event.touches[0] : event;
          watch(point.clientX, point.clientY);
        };
        moveThief();
        ctx.scope.setInterval(moveThief, 600);
        ctx.area.onpointermove = move;
        ctx.scope.setInterval(() => {
          const lockedOn = Math.hypot(px - tx, py - ty) < 28;
          if (lockedOn) {
            score += 1;
            thief.style.transform = "scale(1.16)";
            thief.style.filter = "drop-shadow(0 6px 0 rgba(0,0,0,0.28)) brightness(1.18)";
          } else {
            thief.style.transform = "scale(1)";
            thief.style.filter = "drop-shadow(0 4px 0 rgba(0,0,0,0.24))";
          }
          scoreEl.textContent = String(score);
        }, 100);
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
        });
        ctx.scope.setTimeout(() => done({ won: score >= 18 }), 14000);
      });
    },
  };

  games.stack = {
    id: "stack",
    prompt: "STACK!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="stackBase" style="position:absolute;left:20%;right:20%;bottom:10%;height:12px;background:#fff;border:3px solid #000"></div>' +
          '<div id="stackMover" style="position:absolute;top:18%;left:0;width:22%;height:28px;background:var(--b);border:4px solid #000"></div>';
        const mover = $("#stackMover");
        let block = 0;
        let direction = 1;
        let x = 0;
        let width = 22;
        const placed = [];
        const animate = ctx.scope.setInterval(() => {
          x += direction * 2.2;
          if (x < 0 || x + width > 100) direction *= -1;
          mover.style.left = x + "%";
          mover.style.width = width + "%";
        }, 20);
        ctx.area.onpointerdown = () => {
          const base = block === 0 ? { left: 39, width: 22 } : placed[placed.length - 1];
          const overlapLeft = Math.max(x, base.left);
          const overlapRight = Math.min(x + width, base.left + base.width);
          const overlap = overlapRight - overlapLeft;
          if (overlap < 10) {
            done({ won: false });
            return;
          }
          const next = {
            left: overlapLeft,
            width: overlap,
          };
          placed.push(next);
          const piece = document.createElement("div");
          piece.style.cssText =
            `position:absolute;left:${next.left}%;bottom:${10 + block * 8}%;width:${next.width}%;height:24px;` +
            "background:var(--g);border:4px solid #000";
          ctx.area.appendChild(piece);
          block += 1;
          width = overlap;
          x = 0;
          direction = 1;
          mover.style.top = 18 - block * 2 + "%";
          if (block >= 4) done({ won: true });
        };
        ctx.scope.addCleanup(() => {
          clearInterval(animate);
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 16000);
      });
    },
  };

  games.balance = {
    id: "balance",
    prompt: "BALANCE!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:8%;right:8%;top:48%;height:20px;background:#333;border:4px solid #000">' +
          '<div id="balanceZone" style="position:absolute;left:38%;width:24%;top:-4px;height:20px;background:var(--g)"></div>' +
          '<div id="balanceMarker" style="position:absolute;left:48%;top:-10px;width:18px;height:38px;background:#fff;border:3px solid #000"></div></div>';
        const zone = $("#balanceZone");
        const marker = $("#balanceMarker");
        let zoneX = 38;
        let markerX = 48;
        let direction = 1;
        let heldMs = 0;
        ctx.area.onpointermove = (event) => {
          const rect = ctx.area.getBoundingClientRect();
          markerX = ((event.clientX - rect.left) / rect.width) * 100;
          marker.style.left = markerX + "%";
        };
        ctx.scope.setInterval(() => {
          zoneX += direction * 1.4;
          if (zoneX < 12 || zoneX > 64) direction *= -1;
          zone.style.left = zoneX + "%";
          const inZone = markerX > zoneX && markerX < zoneX + 24;
          heldMs = inZone ? heldMs + 100 : Math.max(0, heldMs - 100);
          if (heldMs >= 2000) done({ won: true });
        }, 100);
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 16000);
      });
    },
  };

  games.sort = {
    id: "sort",
    prompt: "SORT!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:8%;bottom:8%;width:24%;height:24%;background:#ffe0e0;border:4px solid #000;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:10cqw">🍎</div>' +
          '<div style="position:absolute;left:38%;bottom:8%;width:24%;height:24%;background:#fff6cc;border:4px solid #000;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:10cqw">🍌</div>' +
          '<div style="position:absolute;left:68%;bottom:8%;width:24%;height:24%;background:#efe0ff;border:4px solid #000;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:10cqw">🍇</div>';
        const bins = [
          { emoji: "🍎", left: 8, right: 32 },
          { emoji: "🍌", left: 38, right: 62 },
          { emoji: "🍇", left: 68, right: 92 },
        ];
        const items = ["🍎", "🍌", "🍇"];
        let doneCount = 0;
        items.forEach((emoji, index) => {
          const item = document.createElement("div");
          item.textContent = emoji;
          item.style.cssText =
            `position:absolute;left:${18 + index * 24}%;top:18%;font-size:12cqw;touch-action:none;cursor:pointer`;
          let dragging = false;
          const move = (event) => {
            if (!dragging) return;
            const rect = ctx.area.getBoundingClientRect();
            item.style.left = ((event.clientX - rect.left) / rect.width) * 100 + "%";
            item.style.top = ((event.clientY - rect.top) / rect.height) * 100 + "%";
          };
          const up = (event) => {
            if (!dragging) return;
            dragging = false;
            const rect = ctx.area.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            const match = bins.find((bin) => bin.emoji === emoji && x > bin.left && x < bin.right && y > 66);
            if (match) {
              item.remove();
              doneCount += 1;
              if (doneCount === 3) done({ won: true });
            }
          };
          item.onpointerdown = () => {
            dragging = true;
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          ctx.scope.addCleanup(() => {
            item.onpointerdown = null;
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          });
          ctx.area.appendChild(item);
        });
        ctx.scope.setTimeout(() => done({ won: false }), 16000);
      });
    },
  };

  games.zap = {
    id: "zap",
    prompt: "CHEESE!",
    hint: "DRAG 🐭 TO 🧀. AVOID 🐱",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:0;right:0;top:6%;text-align:center;color:#fff;font-size:6cqw;' +
          '-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000;z-index:2">DRAG THE MOUSE TO THE CHEESE</div>' +
          '<canvas id="zapCanvas" width="320" height="420" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>';
        const canvas = $("#zapCanvas");
        const draw = canvas.getContext("2d");
        const start = { x: 50, y: 80 };
        const end = { x: 270, y: 340 };
        const blockers = [
          { x: 130, y: 170, r: 28, emoji: "🐱" },
          { x: 210, y: 250, r: 32, emoji: "🐱" },
          { x: 110, y: 290, r: 28, emoji: "🐱" },
        ];
        const render = (path = []) => {
          draw.clearRect(0, 0, canvas.width, canvas.height);
          draw.font = "38px system-ui";
          draw.textAlign = "center";
          draw.textBaseline = "middle";
          draw.fillText("🐭", start.x, start.y);
          draw.fillText("🧀", end.x, end.y);
          blockers.forEach((blocker) => {
            draw.fillText(blocker.emoji, blocker.x, blocker.y);
          });
          if (path.length) {
            draw.strokeStyle = "#fff7a8";
            draw.lineWidth = 12;
            draw.beginPath();
            draw.moveTo(path[0].x, path[0].y);
            path.slice(1).forEach((point) => draw.lineTo(point.x, point.y));
            draw.stroke();
          }
        };
        let path = [];
        let started = false;
        const toCanvas = (event) => {
          const rect = canvas.getBoundingClientRect();
          return {
            x: ((event.clientX - rect.left) * canvas.width) / rect.width,
            y: ((event.clientY - rect.top) * canvas.height) / rect.height,
          };
        };
        render();
        canvas.onpointerdown = (event) => {
          const point = toCanvas(event);
          if (Math.hypot(point.x - start.x, point.y - start.y) < 30) {
            started = true;
            path = [point];
            ctx.note(720, 80, 0.5, "sine");
          }
        };
        canvas.onpointermove = (event) => {
          if (!started) return;
          const point = toCanvas(event);
          path.push(point);
          render(path);
          if (blockers.some((blocker) => Math.hypot(point.x - blocker.x, point.y - blocker.y) < blocker.r + 8)) {
            done({ won: false });
            return;
          }
          if (Math.hypot(point.x - end.x, point.y - end.y) < 30) {
            ctx.note(980, 120, 0.5, "triangle");
            done({ won: true });
          }
        };
        canvas.onpointerup = () => {
          started = false;
        };
        ctx.scope.addCleanup(() => {
          canvas.onpointerdown = null;
          canvas.onpointermove = null;
          canvas.onpointerup = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  games.bounce = {
    id: "bounce",
    prompt: "BOUNCE!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:10%;right:10%;bottom:20%;height:6px;background:#f33"></div>' +
          '<div id="bounceBall" style="position:absolute;left:46%;bottom:45%;font-size:12cqw">🏀</div>' +
          '<div id="bounceCount" style="position:absolute;top:10%;width:100%;text-align:center;font-size:10cqw">0/6</div>';
        const ball = $("#bounceBall");
        const count = $("#bounceCount");
        let height = 45;
        let velocity = -1.4;
        let beats = 0;
        const loop = ctx.scope.setInterval(() => {
          height += velocity;
          velocity -= 0.18;
          if (height <= 20) done({ won: false });
          ball.style.bottom = height + "%";
        }, 30);
        ctx.area.onpointerdown = () => {
          velocity = 3.8;
          beats += 1;
          ctx.note(600 + beats * 40, 80, 0.5, "sine");
          count.textContent = `${beats}/6`;
          if (beats >= 6) {
            clearInterval(loop);
            done({ won: true });
          }
        };
        ctx.scope.addCleanup(() => {
          clearInterval(loop);
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 16000);
      });
    },
  };

  games.decoy = {
    id: "decoy",
    prompt: "DECOY!",
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        const decoySet = [
          { real: "🙂", decoy: "😊" },
          { real: "😃", decoy: "😀" },
          { real: "😉", decoy: "😊" },
          { real: "😮", decoy: "😯" },
          { real: "😎", decoy: "🤓" },
        ];
        const pair = decoySet[Math.floor(Math.random() * decoySet.length)];
        const realIndex = Math.floor(Math.random() * 8);
        for (let i = 0; i < 8; i += 1) {
          const item = document.createElement("div");
          item.className = "find-item";
          item.textContent = i === realIndex ? pair.real : pair.decoy;
          item.style.cssText = `left:${10 + (i % 4) * 22}%;top:${18 + Math.floor(i / 4) * 30}%`;
          const drift = () => {
            item.style.transform = `translate(${Math.random() * 16 - 8}px,${Math.random() * 16 - 8}px) rotate(${Math.random() * 20 - 10}deg)`;
          };
          ctx.scope.setInterval(drift, 280 + i * 30);
          item.onclick = () => done({ won: i === realIndex });
          ctx.area.appendChild(item);
        }
        ctx.scope.setTimeout(() => done({ won: false }), 12000);
      });
    },
  };

  return games;
}

class MatchController {
  constructor({ games, transport }) {
    this.games = games;
    this.transport = transport;
    this.reset();
  }

  reset() {
    this.mode = "solo";
    this.role = "host";
    this.round = 1;
    this.lastGameId = "";
    this.gameQueue = [];
    this.currentScope = null;
    this.currentRound = null;
    this.pendingLocal = new Map();
    this.pendingRemote = new Map();
    this.resolvedRounds = new Set();
    this.myScore = 0;
    this.oppScore = 0;
    this.times = [];
    this.ended = false;
    this.gameTimer = 0;
    this.localRematchRequested = false;
    this.remoteRematchRequested = false;
    this.currentGameId = null;
  }

  enterSolo() {
    this.reset();
    this.mode = "solo";
    this.myScore = 0;
    this.oppScore = SOLO_LIVES;
    updateHud("solo", this.currentHudState());
    showScreen("game");
    window.setTimeout(() => this.beginHostedRound(), 800);
  }

  attachVersus(role) {
    this.reset();
    this.mode = "versus";
    this.role = role;
    updateHud("versus", this.currentHudState());
    showScreen("game");
    if (role === "host") {
      window.setTimeout(() => this.beginHostedRound(), 800);
    }
  }

  currentHudState() {
    return {
      round: this.round,
      myScore: this.myScore,
      oppScore: this.oppScore,
      lastTime: this.times[this.times.length - 1] || 0,
    };
  }

  nextGameId() {
    if (!this.gameQueue.length) {
      this.gameQueue = Object.keys(this.games).sort(() => Math.random() - 0.5);
      if (this.gameQueue[0] === this.lastGameId && this.gameQueue.length > 1) {
        const first = this.gameQueue.shift();
        this.gameQueue.push(first);
      }
    }
    const id = this.gameQueue.shift();
    this.lastGameId = id;
    return id;
  }

  beginHostedRound(options = {}) {
    if (this.ended) return;
    if (this.mode === "solo") {
      if (this.oppScore <= 0) {
        this.endSolo();
        return;
      }
      if (this.round > 1) {
        updateHud("solo", this.currentHudState());
      }
      const gameId = options.gameId || this.nextGameId();
      this.currentGameId = gameId;
      this.playRound({ round: this.round, gameId });
      return;
    }

    if (this.myScore >= 5 || this.oppScore >= 5 || this.round > TOTAL_ROUNDS) {
      this.endVersus();
      return;
    }

    const gameId = options.gameId || this.nextGameId();
    this.currentGameId = gameId;
    this.transport.send({ type: "round:start", round: this.round, gameId });
    this.playRound({ round: this.round, gameId });
  }

  playRound({ round, gameId }) {
    audio.setTempo(Math.max(90, 220 - round * 8));
    if (this.currentScope) {
      this.currentScope.dispose();
      this.currentScope = null;
    }
    window.clearTimeout(this.gameTimer);
    refs.gameArea.replaceChildren();
    const intro = document.createElement("div");
    intro.className = "instr";
    intro.style.transition = "opacity 0.45s ease, transform 0.45s ease, filter 0.45s ease";
    intro.innerHTML =
      `<div class="instr-card"><span class="instr-title">${this.games[gameId].prompt}</span>` +
      `<span class="instr-hint">${this.games[gameId].hint || "GET READY"}</span></div>`;
    refs.gameArea.appendChild(intro);
    if (this.mode === "versus") {
      refs.roundNumber.textContent = String(round);
    }
    this.gameTimer = window.setTimeout(() => {
      intro.style.opacity = "0";
      intro.style.transform = "translateY(-14px) scale(0.96)";
      intro.style.filter = "blur(8px)";
      setTimeout(() => intro.remove(), 450);
      const scope = createRoundScope(refs.gameArea);
      this.currentScope = scope;
      const game = this.games[gameId];
      const context = createGameContext(this, round, scope);
      this.mountWick(scope, game.duration || DEFAULT_GAME_MS);
      const startedAt = Date.now();
      game.start(context).then((result) => {
        const withTime = { ...result, time: (Date.now() - startedAt) / 1000 };
        this.handleLocalResult(round, withTime);
      });
    }, ROUND_PREP_MS);
  }

  handleLocalResult(round, result) {
    if (this.ended) return;
    if (this.mode === "solo") {
      this.resolveSoloRound(result);
      return;
    }

    this.pendingLocal.set(round, result);
    this.transport.send({
      type: "round:result",
      round,
      won: result.won,
      time: result.time,
    });
    this.tryResolveVersusRound(round);
  }

  handleRemoteMessage(message) {
    if (message.type === "match:rematch") {
      this.remoteRematchRequested = true;
      if (this.ended) {
        this.renderPostMatchActions();
        if (this.localRematchRequested) this.startRematch();
      }
      return;
    }

    if (message.type === "match:lobby") {
      this.returnToLobby({ remoteTriggered: true });
      return;
    }

    if (message.type === "round:reaction") {
      showReactionBurst(message.emoji, "left");
      return;
    }

    if (this.ended) return;
    if (message.type === "round:start") {
      this.round = message.round;
      updateHud("versus", this.currentHudState());
      this.playRound({ round: message.round, gameId: message.gameId });
      return;
    }

    if (message.type === "round:result") {
      this.pendingRemote.set(message.round, {
        won: Boolean(message.won),
        time: message.time || 0,
      });
      this.tryResolveVersusRound(message.round);
      return;
    }

    if (message.type === "match:end") {
      this.endVersus({
        myScore: message.myScore,
        oppScore: message.oppScore,
        remoteTriggered: true,
      });
    }
  }

  tryResolveVersusRound(round) {
    if (this.resolvedRounds.has(round)) return;
    const local = this.pendingLocal.get(round);
    const remote = this.pendingRemote.get(round);
    if (!local || !remote) return;

    let localWins = false;
    if (local.won && remote.won) {
      const delta = Math.abs(local.time - remote.time);
      if (delta < 0.12) {
        this.showRoundVerdict("TOO CLOSE!", false);
        window.setTimeout(() => {
          if (this.ended) return;
          if (this.role === "host") this.beginHostedRound({ gameId: this.currentGameId });
        }, ROUND_RESULT_MS);
        return;
      }
      localWins = local.time < remote.time;
    } else if (local.won || remote.won) {
      localWins = local.won && !remote.won;
    } else {
      this.showRoundVerdict("RETRY!", false);
      window.setTimeout(() => {
        if (this.ended) return;
        if (this.role === "host") this.beginHostedRound({ gameId: this.currentGameId });
      }, ROUND_RESULT_MS);
      return;
    }

    this.resolvedRounds.add(round);
    this.pendingLocal.delete(round);
    this.pendingRemote.delete(round);

    if (localWins) this.myScore += 1;
    else this.oppScore += 1;

    updateHud("versus", this.currentHudState());
    this.showRoundVerdict(localWins ? "WIN!" : "LOSE", localWins);

    window.setTimeout(() => {
      if (this.ended) return;
      if (this.role === "host") {
        this.round += 1;
        this.beginHostedRound();
      }
    }, ROUND_RESULT_MS);
  }

  resolveSoloRound(result) {
    if (result.won) {
      this.myScore += 1;
      this.times.push(result.time);
      audio.win();
      fx.spawn(fx.canvas.width / 2, fx.canvas.height / 2 + 50, true);
    } else {
      this.oppScore -= 1;
      audio.lose();
    }
    updateHud("solo", this.currentHudState());
    this.showRoundVerdict(result.won ? "WIN!" : "FAIL!", result.won);
    window.setTimeout(() => {
      if (this.oppScore <= 0) {
        this.endSolo();
        return;
      }
      this.round += 1;
      this.beginHostedRound();
    }, ROUND_RESULT_MS);
  }

  showRoundVerdict(text, isWin) {
    if (isWin) {
      fx.spawn(fx.canvas.width / 2, fx.canvas.height / 2 + 50, true);
      audio.win();
    } else {
      audio.lose();
    }
    const verdict = document.createElement("div");
    verdict.className = "instr";
    verdict.style.fontSize = "clamp(40px,18cqw,100px)";
    verdict.textContent = text;
    refs.gameArea.appendChild(verdict);
    if (this.mode === "versus") {
      const tray = document.createElement("div");
      tray.style.cssText =
        "position:absolute;left:0;right:0;bottom:8%;display:flex;gap:10px;justify-content:center;z-index:140";
      REACTION_SET.forEach((emoji) => {
        const button = document.createElement("button");
        button.className = "btn yellow";
        button.style.cssText = "max-width:64px;padding:10px 0;font-size:28px;line-height:1";
        button.textContent = emoji;
        button.onclick = () => {
          showReactionBurst(emoji, "right");
          this.transport.send({ type: "round:reaction", emoji });
        };
        tray.appendChild(button);
      });
      refs.gameArea.appendChild(tray);
      window.setTimeout(() => tray.remove(), ROUND_RESULT_MS - 150);
    }
    window.setTimeout(() => verdict.remove(), ROUND_RESULT_MS - 300);
  }

  endSolo() {
    this.ended = true;
    const average = this.times.length
      ? (this.times.reduce((sum, value) => sum + value, 0) / this.times.length).toFixed(2)
      : "--";
    refs.gameArea.innerHTML =
      `<div class="instr" style="font-size:clamp(40px,16cqw,90px)">GAME OVER<br>` +
      `<span style="font-size:clamp(20px,8cqw,40px)">WINS: ${this.myScore}<br>AVG TIME: ${average}s</span></div>`;
    this.renderPostMatchActions({ solo: true });
  }

  endVersus(payload = null) {
    if (this.ended) return;
    this.ended = true;
    const finalMy = payload?.myScore ?? this.myScore;
    const finalOpp = payload?.oppScore ?? this.oppScore;
    if (!payload?.remoteTriggered) {
      this.transport.send({
        type: "match:end",
        myScore: finalOpp,
        oppScore: finalMy,
      });
    }
    const victory = finalMy > finalOpp;
    refs.gameArea.innerHTML =
      `<div class="instr" style="font-size:clamp(40px,16cqw,90px)">${victory ? "VICTORY" : "DEFEAT"}<br>` +
      `<span style="font-size:clamp(30px,10cqw,60px)">${finalMy}-${finalOpp}</span></div>`;
    if (victory) {
      const show = window.setInterval(() => {
        fx.spawn(Math.random() * fx.canvas.width, Math.random() * fx.canvas.height * 0.6 + fx.canvas.height * 0.2, true);
      }, 350);
      window.setTimeout(() => clearInterval(show), 3500);
    }
    this.renderPostMatchActions();
  }

  renderPostMatchActions(options = {}) {
    const existing = document.getElementById("postMatchActions");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "postMatchActions";
    wrap.style.cssText =
      "position:absolute;left:0;right:0;bottom:8%;display:flex;gap:12px;justify-content:center;" +
      "flex-wrap:wrap;z-index:130;padding:0 16px";

    const makeButton = (label, className, onclick) => {
      const button = document.createElement("button");
      button.className = `btn ${className}`;
      button.style.maxWidth = "200px";
      button.textContent = label;
      button.onclick = onclick;
      return button;
    };

    if (options.solo) {
      wrap.appendChild(
        makeButton("PLAY AGAIN", "green", () => {
          setStatus("Solo rematch loaded.", "success");
          this.enterSolo();
        })
      );
      wrap.appendChild(
        makeButton("LOBBY", "yellow", () => {
          this.returnToLobby();
        })
      );
      refs.gameArea.appendChild(wrap);
      return;
    }

    const rematchLabel = this.localRematchRequested ? "WAITING..." : "REMATCH";
    const rematchTone = this.localRematchRequested ? "blue" : "green";
    wrap.appendChild(
      makeButton(rematchLabel, rematchTone, () => {
        if (this.localRematchRequested) return;
        this.localRematchRequested = true;
        this.transport.send({ type: "match:rematch" });
        setStatus(
          this.remoteRematchRequested ? "Rematch starting..." : "Rematch requested. Waiting for opponent.",
          this.remoteRematchRequested ? "success" : "warn"
        );
        this.renderPostMatchActions();
        if (this.remoteRematchRequested) this.startRematch();
      })
    );
    wrap.appendChild(
      makeButton("LOBBY", "yellow", () => {
        this.returnToLobby();
      })
    );
    refs.gameArea.appendChild(wrap);
  }

  startRematch() {
    this.localRematchRequested = false;
    this.remoteRematchRequested = false;
    setStatus("Rematch starting...", "success");
    this.attachVersus(this.role);
  }

  returnToLobby(options = {}) {
    window.clearTimeout(this.gameTimer);
    const wasVersus = this.mode === "versus";
    if (this.currentScope) {
      this.currentScope.dispose();
      this.currentScope = null;
    }
    const role = this.role;
    this.reset();
    if (wasVersus) {
      if (!options.remoteTriggered) this.transport.send({ type: "match:lobby" });
      showConnectedLobby(role || appState.pendingRole || "guest");
      setStatus(options.remoteTriggered ? "Opponent returned to lobby." : "Back in room lobby.", options.remoteTriggered ? "warn" : "success");
      return;
    }
    resetLobbyUi();
    showScreen("lobby");
    setStatus("");
  }

  mountWick(scope, durationMs) {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:absolute;left:8%;right:8%;top:4%;z-index:125;display:flex;align-items:center;gap:10px;pointer-events:none";
    const bar = document.createElement("div");
    bar.style.cssText =
      "flex:1;height:14px;border:3px solid #000;border-radius:999px;background:rgba(255,255,255,0.24);overflow:hidden";
    const fill = document.createElement("div");
    fill.style.cssText =
      "width:100%;height:100%;background:linear-gradient(90deg,#ffd400 0%,#ff8a00 42%,#ff1744 100%);" +
      "transform-origin:left center;transition:transform linear";
    const flame = document.createElement("div");
    flame.textContent = "🔥";
    flame.style.cssText = "font-size:24px;filter:drop-shadow(0 3px 0 #000)";
    bar.appendChild(fill);
    wrap.appendChild(flame);
    wrap.appendChild(bar);
    refs.gameArea.appendChild(wrap);
    requestAnimationFrame(() => {
      fill.style.transform = "scaleX(0)";
      fill.style.transitionDuration = `${durationMs}ms`;
    });
    scope.addCleanup(() => wrap.remove());
  }
}

const signaling = new SignalingClient(appState.signalingBase);
const transport = new PeerTransport();
const games = createGames();
const controller = new MatchController({ games, transport });

transport.onopen = () => {
  showConnectedLobby(appState.pendingRole || "guest");
  appendChatMessage("ROOM", "Connection live. Host can start when ready.", false, "room");
  setStatus("Connected. Use the room lobby to chat or start.", "success");
};

transport.onmessage = (message) => {
  if (message.type === "lobby:chat") {
    appendChatMessage("OPP", message.text, false);
    return;
  }
  if (message.type === "lobby:start") {
    controller.attachVersus("guest");
    setStatus("Host started the match.", "success");
    return;
  }
  if (message.type === "room:leave") {
    transport.cleanup();
    resetLobbyUi();
    showScreen("lobby");
    setStatus("Opponent left the room.", "warn");
    return;
  }
  controller.handleRemoteMessage(message);
};

transport.onclose = () => {
  if (!controller.ended && (refs.game.classList.contains("active") || refs.connectedPanel.classList.contains("active"))) {
    resetLobbyUi();
    showScreen("lobby");
    setStatus("Connection closed.", "error");
  }
};

refs.soloBtn.onclick = () => {
  setStatus("Solo mode loaded.", "success");
  controller.enterSolo();
};

refs.hostBtn.onclick = () => {
  setLobbyMode("host");
  setStatus("Host mode ready. Create a room.", "warn");
};

refs.joinBtn.onclick = () => {
  setLobbyMode("join");
  setStatus("Join mode ready. Enter a room code.", "warn");
  refs.roomCodeInput.focus();
};

refs.hostResetBtn.onclick = () => {
  setLobbyMode(null);
  setStatus("");
};

refs.joinResetBtn.onclick = () => {
  setLobbyMode(null);
  setStatus("");
};

refs.copyCodeBtn.onclick = () => copyText(appState.roomCode, "Room code copied.");
refs.copyLinkBtn.onclick = () => copyText(appState.joinUrl, "Join link copied.");

function sendLobbyChat() {
  const text = refs.chatInput.value.trim();
  if (!text) return;
  appendChatMessage("YOU", text, true);
  transport.send({ type: "lobby:chat", text });
  refs.chatInput.value = "";
}

function leaveConnectedRoom() {
  transport.send({ type: "room:leave" });
  transport.cleanup();
  resetLobbyUi();
  showScreen("lobby");
  setStatus("Left room.", "warn");
}

refs.chatSendBtn.onclick = sendLobbyChat;
refs.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendLobbyChat();
});
refs.startMatchBtn.onclick = () => {
  transport.send({ type: "lobby:start" });
  controller.attachVersus("host");
  setStatus("Match starting...", "success");
};
refs.leaveRoomBtn.onclick = leaveConnectedRoom;

refs.createRoomBtn.onclick = async () => {
  refs.createRoomBtn.disabled = true;
  appState.pendingRole = "host";
  try {
    await transport.host({
      signaling,
      roomReady: ({ roomId, joinUrl }) => {
        appState.roomCode = roomId;
        appState.joinUrl = joinUrl;
        refs.roomCodeDisplay.textContent = roomId;
        refs.joinLinkDisplay.textContent = joinUrl;
      },
      status: (state) => {
        const tone = state === "creating room" || state === "waiting for player" ? "warn" : "success";
        setStatus(state, tone);
      },
    });
  } catch (error) {
    setStatus(
      error.message === "room_full" ? "Room full." :
      error.message === "room_expired" ? "Expired room." :
      error.message === "room_not_found" ? "Invalid code." :
      error.message === "signaling_missing" ? "No signaling backend at /api. Run with Wrangler dev/deploy." :
      error.message === "signaling_unreachable" ? "Signaling backend unreachable." :
      error.message === "signaling_failed" ? "Signaling backend failed." :
      "Unable to create room.",
      "error"
    );
  } finally {
    refs.createRoomBtn.disabled = false;
  }
};

refs.joinRoomBtn.onclick = async () => {
  refs.joinRoomBtn.disabled = true;
  appState.pendingRole = "guest";
  const code = refs.roomCodeInput.value.trim().toUpperCase();
  refs.roomCodeInput.value = code;
  if (!code) {
    setStatus("Enter a room code.", "warn");
    refs.joinRoomBtn.disabled = false;
    return;
  }
  try {
    await transport.join({
      signaling,
      roomId: code,
      status: (state) => setStatus(state, state === "joining" ? "warn" : "success"),
    });
  } catch (error) {
    setStatus(
      error.message === "room_not_found" ? "Invalid code." :
      error.message === "room_expired" ? "Expired room." :
      error.message === "room_full" ? "Room full." :
      error.message === "signaling_missing" ? "No signaling backend at /api. Run with Wrangler dev/deploy." :
      error.message === "signaling_unreachable" ? "Signaling backend unreachable." :
      error.message === "signaling_failed" ? "Signaling backend failed." :
      "Unable to join room.",
      "error"
    );
  } finally {
    refs.joinRoomBtn.disabled = false;
  }
};

refs.roomCodeInput.addEventListener("input", () => {
  refs.roomCodeInput.value = refs.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

document.querySelectorAll(".btn").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    audio.click();
    const rect = button.getBoundingClientRect();
    fx.spawn(event.clientX - rect.left + button.offsetLeft, event.clientY - rect.top + button.offsetTop, false);
  });
});

const deeplinkRoom = parseRoomFromUrl();
if (deeplinkRoom) {
  setLobbyMode("join");
  refs.roomCodeInput.value = deeplinkRoom;
  setStatus("Join link detected. Tap JOIN CODE.", "warn");
}
