  games.pop = {
    id: "pop",
    prompt: "POP!",
    hint: "POP 5 BALLOONS",
    duration: 17000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let popped = 0;
        for (let i = 0; i < 5; i += 1) {
          const balloon = document.createElement("div");
          balloon.className = "balloon";
          balloon.textContent = "🎈";
          balloon.style.left = 7 + i * 18 + "%";
          balloon.style.bottom = "-24%";
          balloon.style.animationDelay = i * 0.72 + "s";
          balloon.style.animationDuration = "8.6s";
          balloon.style.fontSize = "14cqw";
          balloon.onpointerdown = (event) => {
            event.stopPropagation();
            if (!balloon.isConnected) return;
            ctx.click();
            const areaRect = ctx.area.getBoundingClientRect();
            const rect = balloon.getBoundingClientRect();
            ctx.fx.spawn(rect.left - areaRect.left + rect.width / 2, rect.top - areaRect.top + rect.height / 2, false);
            balloon.style.transition = "transform 0.16s ease, opacity 0.16s ease";
            balloon.style.transform = "scale(0.1) rotate(12deg)";
            balloon.style.opacity = "0";
            ctx.scope.setTimeout(() => balloon.remove(), 120);
            popped += 1;
            if (popped >= 5) done({ won: true });
          };
          ctx.area.appendChild(balloon);
        }
        ctx.scope.setTimeout(() => done({ won: popped >= 5 }), 17000);
      });
    },
  };

  games.catch = {
    id: "catch",
    prompt: "CATCH!",
    hint: "CATCH 3 TOASTS",
    duration: 17000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="catchScore" style="position:absolute;top:9%;width:100%;text-align:center;color:#fff;font-size:7cqw;-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000">0 / 3</div>' +
          '<div style="position:absolute;bottom:18px;font-size:20cqw;left:50%;transform:translateX(-50%);filter:drop-shadow(0 5px 0 rgba(0,0,0,0.28))">🧺</div>';
        const score = $("#catchScore");
        const basket = ctx.area.lastElementChild;
        let x = 50;
        let caught = 0;
        const move = (event) => {
          const point = event.touches ? event.touches[0] : event;
          const rect = ctx.area.getBoundingClientRect();
          x = Math.max(8, Math.min(92, ((point.clientX - rect.left) / rect.width) * 100));
          basket.style.left = x + "%";
        };
        ctx.area.onpointermove = move;
        ctx.area.onpointerdown = move;
        ctx.scope.addCleanup(() => {
          ctx.area.onpointermove = null;
          ctx.area.onpointerdown = null;
        });
        const drop = () => {
          const toast = document.createElement("div");
          const startX = Math.random() * 66 + 17;
          toast.textContent = "🍞";
          toast.style.cssText =
            `position:absolute;font-size:12cqw;left:${startX}%;top:-8%;filter:drop-shadow(0 4px 0 rgba(0,0,0,0.24));`;
          ctx.area.appendChild(toast);
          let y = -8;
          const fall = ctx.scope.setInterval(() => {
            y += 1.65;
            toast.style.top = y + "%";
            const toastX = parseFloat(toast.style.left);
            if (y > 72 && y < 91 && Math.abs(toastX - x) < 23) {
              clearInterval(fall);
              const areaRect = ctx.area.getBoundingClientRect();
              const rect = toast.getBoundingClientRect();
              ctx.fx.spawn(rect.left - areaRect.left + rect.width / 2, rect.top - areaRect.top + rect.height / 2, false);
              toast.remove();
              caught += 1;
              score.textContent = `${caught} / 3`;
              ctx.click();
              if (caught >= 3) done({ won: true });
            }
            if (y > 104) {
              clearInterval(fall);
              toast.remove();
            }
          }, 30);
        };
        drop();
        ctx.scope.setInterval(drop, 1050);
        ctx.scope.setTimeout(() => done({ won: caught >= 3 }), 17000);
      });
    },
  };

  games.pump = {
    id: "pump",
    prompt: "PUMP!",
    hint: "STEADY TAPS",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="pumpHint" style="position:absolute;top:10%;width:100%;text-align:center;color:#fff;font-size:6cqw;-webkit-text-stroke:1px rgba(0,0,0,0.45);text-shadow:0 4px 0 rgba(0,0,0,0.25)">Make it big and gentle</div>' +
          '<div style="font-size:20cqw;position:absolute;left:50%;top:54%;transform:translate(-50%,-50%) scale(0.6);filter:drop-shadow(0 8px 0 rgba(0,0,0,0.22));transition:transform 0.12s ease">🎈</div>';
        const balloon = ctx.area.lastElementChild;
        let size = 0.6;
        ctx.area.onclick = () => {
          ctx.click();
          size += 0.08;
          balloon.style.transform = `translate(-50%,-50%) scale(${size})`;
          if (size > 2.05) done({ won: true });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onclick = null;
        });
        ctx.scope.setTimeout(() => done({ won: size > 2.05 }), 14000);
      });
    },
  };

  games.whack = {
    id: "whack",
    prompt: "WHACK!",
    hint: "TAP 4 POP-UPS",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        let hits = 0;
        let activeToken = 0;
        const score = document.createElement("div");
        score.style.cssText =
          "position:absolute;left:0;right:0;top:7%;text-align:center;color:#fff;font-size:7cqw;-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000;z-index:4";
        score.textContent = "0 / 4";
        ctx.area.appendChild(score);
        const holes = [];
        for (let i = 0; i < 9; i += 1) {
          const hole = document.createElement("div");
          hole.style.cssText =
            `position:absolute;width:24%;height:20%;left:${8 + (i % 3) * 30}%;top:${18 + Math.floor(i / 3) * 24}%;` +
            "background:radial-gradient(ellipse at center,#8d5a2b 0%,#5a3019 58%,#2a160b 100%);border-radius:50%;box-shadow:inset 0 10px 12px rgba(0,0,0,0.38),0 8px 0 rgba(0,0,0,0.18);overflow:hidden";
          holes.push(hole);
          ctx.area.appendChild(hole);
        }
        const spawn = () => {
          activeToken += 1;
          const token = activeToken;
          holes.forEach((hole) => {
            hole.innerHTML = "";
            hole.dataset.activeToken = "";
          });
          const hole = holes[Math.floor(Math.random() * holes.length)];
          hole.dataset.activeToken = String(token);
          hole.innerHTML =
            '<div style="font-size:15cqw;cursor:pointer;text-align:center;margin-top:4%;transform:translateY(8%);filter:drop-shadow(0 4px 0 rgba(0,0,0,0.25));transition:transform 0.12s ease">🐹</div>';
          const mole = hole.firstElementChild;
          mole.onpointerdown = (event) => {
            event.stopPropagation();
            if (hole.dataset.activeToken !== String(token)) return;
            ctx.click();
            hits += 1;
            score.textContent = `${hits} / 4`;
            const areaRect = ctx.area.getBoundingClientRect();
            const rect = mole.getBoundingClientRect();
            ctx.fx.spawn(rect.left - areaRect.left + rect.width / 2, rect.top - areaRect.top + rect.height / 2, false);
            hole.innerHTML = "";
            hole.dataset.activeToken = "";
            if (hits >= 4) done({ won: true });
          };
          ctx.scope.setTimeout(() => {
            if (hole.dataset.activeToken === String(token)) {
              hole.innerHTML = "";
              hole.dataset.activeToken = "";
            }
          }, 950);
        };
        spawn();
        ctx.scope.setInterval(spawn, 820);
        ctx.scope.setTimeout(() => done({ won: hits >= 4 }), 14000);
      });
    },
  };

  games.drag = {
    id: "drag",
    prompt: "DRAG!",
    hint: "PLACE THE PIN",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="board" style="position:absolute;left:68%;top:30%;width:22cqw;height:22cqw;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,0.52);border:3px solid rgba(255,255,255,0.85);box-shadow:0 12px 28px rgba(35,47,95,0.18);font-size:14cqw">🎯</div>' +
          '<div id="st" style="position:absolute;left:20%;top:60%;font-size:15cqw;cursor:pointer;touch-action:none;filter:drop-shadow(0 5px 0 rgba(0,0,0,0.28));transition:transform 0.12s ease">📍</div>';
        const star = $("#st");
        const board = $("#board");
        let dragging = false;
        const move = (event) => {
          if (!dragging) return;
          const rect = ctx.area.getBoundingClientRect();
          const point = event.touches ? event.touches[0] : event;
          const x = point.clientX - rect.left;
          const y = point.clientY - rect.top;
          star.style.left = x - 34 + "px";
          star.style.top = y - 34 + "px";
          const targetRect = board.getBoundingClientRect();
          const distance = Math.hypot(
            point.clientX - (targetRect.left + targetRect.width / 2),
            point.clientY - (targetRect.top + targetRect.height / 2)
          );
          if (distance < Math.max(68, targetRect.width * 0.42)) {
            dragging = false;
            board.style.transform = "scale(1.12)";
            done({ won: true });
          }
        };
        const up = () => {
          dragging = false;
          star.style.transform = "scale(1)";
        };
        star.onpointerdown = (event) => {
          event.preventDefault();
          dragging = true;
          star.style.transform = "scale(1.1)";
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        ctx.scope.addCleanup(() => {
          star.onpointerdown = null;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        });
        ctx.scope.setTimeout(() => done({ won: false }), 14000);
      });
    },
  };

  games.jump = {
    id: "jump",
    prompt: "JUMP!",
    hint: "LOW HOP THE CAR",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:0;right:0;bottom:18%;height:7px;background:rgba(255,255,255,0.72);border-top:3px solid rgba(0,0,0,0.22)"></div>' +
          '<div id="p" style="position:absolute;left:20%;bottom:20%;font-size:14cqw;transition:filter 0.12s ease">🧍</div>' +
          '<div id="o" style="position:absolute;left:100%;bottom:20%;font-size:12cqw;filter:drop-shadow(0 4px 0 rgba(0,0,0,0.24))">🚕</div>';
        const player = $("#p");
        const obstacle = $("#o");
        let velocity = 0;
        let y = 20;
        let ox = 100;
        let jumping = false;
        let speed = 1.28;
        const loop = ctx.scope.setInterval(() => {
          speed = Math.min(2.85, speed + 0.014);
          ox -= speed;
          obstacle.style.left = ox + "%";
          if (jumping) {
            y += velocity;
            velocity -= 0.34;
          }
          if (y <= 20) {
            y = 20;
            velocity = 0;
            jumping = false;
            player.style.filter = "";
          }
          player.style.bottom = y + "%";
          if (ox < 32 && ox > 9 && y < 31) done({ won: false });
          if (ox < -20) done({ won: true });
        }, 30);
        ctx.area.onpointerdown = () => {
          if (!jumping) {
            jumping = true;
            velocity = 4.8;
            player.style.filter = "brightness(1.12)";
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

  games.shoot = {
    id: "shoot",
    prompt: "SHOOT!",
    hint: "3 MISSES OK",
    duration: 14000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="shootHud" style="position:absolute;top:9%;width:100%;text-align:center;color:#fff;font-size:6cqw;-webkit-text-stroke:1px rgba(0,0,0,0.45);text-shadow:0 4px 0 rgba(0,0,0,0.25)">Misses: 0 / 3</div>' +
          '<div id="tg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:15cqw;filter:drop-shadow(0 6px 0 rgba(0,0,0,0.28));cursor:crosshair">👾</div>' +
          '<div id="reticle" style="position:absolute;width:9cqw;height:9cqw;border:3px solid rgba(255,255,255,0.8);border-radius:999px;pointer-events:none;opacity:0;transform:translate(-50%,-50%);box-shadow:0 0 0 2px rgba(0,0,0,0.18)"></div>';
        const hud = $("#shootHud");
        const target = $("#tg");
        const reticle = $("#reticle");
        let x = 50;
        let y = 50;
        let direction = 1;
        let bob = 0;
        let misses = 0;
        const loop = ctx.scope.setInterval(() => {
          x += direction * 2.65;
          bob += 0.12;
          y = 50 + Math.sin(bob) * 9;
          if (x > 82 || x < 18) direction *= -1;
          target.style.left = x + "%";
          target.style.top = y + "%";
        }, 30);
        const showShot = (event) => {
          const rect = ctx.area.getBoundingClientRect();
          reticle.style.left = event.clientX - rect.left + "px";
          reticle.style.top = event.clientY - rect.top + "px";
          reticle.style.opacity = "1";
          reticle.style.transform = "translate(-50%,-50%) scale(1.2)";
          ctx.scope.setTimeout(() => {
            reticle.style.opacity = "0";
            reticle.style.transform = "translate(-50%,-50%) scale(0.82)";
          }, 150);
        };
        target.onpointerdown = (event) => {
          event.stopPropagation();
          clearInterval(loop);
          showShot(event);
          ctx.note(920, 90, 0.55, "triangle");
          done({ won: true });
        };
        ctx.area.onpointerdown = (event) => {
          showShot(event);
          misses += 1;
          hud.textContent = `Misses: ${misses} / 3`;
          ctx.note(260, 70, 0.28, "sine");
          if (misses >= 3) {
            clearInterval(loop);
            done({ won: false });
          }
        };
        ctx.scope.addCleanup(() => {
          target.onpointerdown = null;
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: false }), 14000);
      });
    },
  };

  games.simon = {
    id: "simon",
    prompt: "SIMON!",
    hint: "WATCH, THEN REPEAT",
    duration: 15000,
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
            `background:${colors[i]};border-radius:15px;opacity:0.28;border:4px solid #000;box-shadow:0 6px 0 #000;transition:transform 0.12s, opacity 0.12s, filter 0.12s`;
          const pulse = (manual = false) => {
            item.style.opacity = "1";
            item.style.transform = "scale(0.94)";
            item.style.filter = "brightness(1.25)";
            ctx.scope.setTimeout(() => {
              item.style.opacity = listening ? "0.82" : "0.28";
              item.style.transform = "scale(1)";
              item.style.filter = "brightness(1)";
            }, manual ? 160 : 260);
          };
          item.onclick = () => {
            if (!listening) return;
            ctx.note(400 + i * 200, 150, 0.5);
            pulse(true);
            if (i === sequence[step]) {
              step += 1;
              status.textContent = `${step}/${sequence.length}`;
              if (step === sequence.length) done({ won: true });
            } else {
              status.textContent = "TRY AGAIN";
              done({ won: false });
            }
          };
          buttons.push(item);
          ctx.area.appendChild(item);
        }
        const pulseButton = (buttonIndex) => {
          const btn = buttons[buttonIndex];
          btn.style.opacity = "1";
          btn.style.transform = "scale(0.94)";
          btn.style.filter = "brightness(1.25)";
          ctx.note(400 + buttonIndex * 200, 170, 0.5);
          ctx.scope.setTimeout(() => {
            btn.style.opacity = "0.28";
            btn.style.transform = "scale(1)";
            btn.style.filter = "brightness(1)";
          }, 300);
        };
        const showStep = (index) => {
          if (index >= sequence.length) {
            ctx.scope.setTimeout(() => {
              listening = true;
              status.textContent = "REPEAT";
              buttons.forEach((button) => {
                button.style.opacity = "0.82";
              });
            }, 340);
            return;
          }
          const colorIndex = sequence[index];
          pulseButton(colorIndex);
          ctx.scope.setTimeout(() => showStep(index + 1), 650);
        };
        ctx.scope.setTimeout(() => showStep(0), 350);
        ctx.scope.setTimeout(() => done({ won: false }), 15000);
      });
    },
  };

  games.mug = {
    id: "mug",
    prompt: "GRAB!",
    hint: "TAP IN THE GLOW",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:0;top:70%;width:100%;height:10px;background:#743;border-top:4px solid #000;box-shadow:0 -8px 18px rgba(0,0,0,0.12)"></div>' +
          '<div style="position:absolute;right:7%;top:59%;width:31cqw;height:15cqw;border-radius:999px;background:radial-gradient(circle,rgba(0,230,118,0.45) 0%,rgba(0,230,118,0.2) 58%,transparent 72%);border:2px solid rgba(255,255,255,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:4.5cqw;font-weight:900;text-shadow:0 2px 0 rgba(0,0,0,0.25)">TAP ZONE</div>' +
          '<div id="mug" style="position:absolute;left:-20%;top:50%;font-size:15cqw;filter:drop-shadow(0 5px 0 rgba(0,0,0,0.25))">☕</div>';
        const mug = $("#mug");
        let x = -20;
        const move = ctx.scope.setInterval(() => {
          x += 1.62 + ctx.round * 0.035;
          mug.style.left = x + "%";
          if (x > 112) done({ won: false });
        }, 20);
        ctx.area.onpointerdown = () => {
          clearInterval(move);
          done({ won: x > 62 && x < 96 });
        };
        ctx.scope.addCleanup(() => {
          ctx.area.onpointerdown = null;
        });
      });
    },
  };

  games.sort = {
    id: "sort",
    prompt: "SORT!",
    hint: "MATCH EVERY BIN",
    duration: 22000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="sortScore" style="position:absolute;top:7%;left:0;right:0;text-align:center;color:#fff;font-size:6.5cqw;-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000;z-index:3">0 / 6</div>';
        const score = $("#sortScore");
        const bins = [
          { type: "fruit", label: "FRUIT", emoji: "🍎", left: 5, color: "#ffe0e0" },
          { type: "snack", label: "SNACK", emoji: "🧁", left: 38, color: "#fff6cc" },
          { type: "toy", label: "TOY", emoji: "🧸", left: 71, color: "#efe0ff" },
        ];
        bins.forEach((bin) => {
          const node = document.createElement("div");
          node.dataset.bin = bin.type;
          node.style.cssText =
            `position:absolute;left:${bin.left}%;bottom:7%;width:24%;height:25%;background:${bin.color};` +
            "border:4px solid #000;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
            "font-size:8cqw;color:#1b1f35;font-weight:900;box-shadow:0 9px 0 rgba(0,0,0,0.18);";
          node.innerHTML = `<span style="font-size:9cqw">${bin.emoji}</span><span style="font-size:3.8cqw">${bin.label}</span>`;
          ctx.area.appendChild(node);
        });
        const itemDefs = [
          { emoji: "🍎", type: "fruit" },
          { emoji: "🍇", type: "fruit" },
          { emoji: "🧁", type: "snack" },
          { emoji: "🍪", type: "snack" },
          { emoji: "🧸", type: "toy" },
          { emoji: "🪀", type: "toy" },
        ].sort(() => Math.random() - 0.5);
        let doneCount = 0;
        itemDefs.forEach((def, index) => {
          const item = document.createElement("div");
          item.textContent = def.emoji;
          item.dataset.type = def.type;
          const home = {
            left: 12 + (index % 3) * 28,
            top: 19 + Math.floor(index / 3) * 17,
          };
          item.style.cssText =
            `position:absolute;left:${home.left}%;top:${home.top}%;font-size:11cqw;touch-action:none;cursor:pointer;` +
            "filter:drop-shadow(0 5px 0 rgba(0,0,0,0.24));transition:transform 0.14s ease, filter 0.14s ease;";
          let dragging = false;
          const setPosition = (event) => {
            const rect = ctx.area.getBoundingClientRect();
            item.style.left = ((event.clientX - rect.left) / rect.width) * 100 + "%";
            item.style.top = ((event.clientY - rect.top) / rect.height) * 100 + "%";
          };
          const snapHome = () => {
            item.style.left = home.left + "%";
            item.style.top = home.top + "%";
            item.style.transform = "translateY(-6px) scale(1.05)";
            ctx.scope.setTimeout(() => {
              item.style.transform = "translateY(0) scale(1)";
            }, 140);
          };
          const move = (event) => {
            if (!dragging) return;
            setPosition(event);
          };
          const up = (event) => {
            if (!dragging) return;
            dragging = false;
            item.style.zIndex = "2";
            item.style.filter = "drop-shadow(0 5px 0 rgba(0,0,0,0.24))";
            const target = document.elementFromPoint(event.clientX, event.clientY);
            const bin = target?.closest?.("[data-bin]");
            if (bin?.dataset.bin === def.type) {
              item.remove();
              doneCount += 1;
              score.textContent = `${doneCount} / ${itemDefs.length}`;
              ctx.click();
              if (doneCount === itemDefs.length) done({ won: true });
              return;
            }
            ctx.note(240, 80, 0.25, "sine");
            snapHome();
          };
          item.onpointerdown = (event) => {
            event.preventDefault();
            dragging = true;
            item.style.zIndex = "9";
            item.style.filter = "drop-shadow(0 9px 0 rgba(0,0,0,0.28)) brightness(1.08)";
            setPosition(event);
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
        ctx.scope.setTimeout(() => done({ won: doneCount === itemDefs.length }), 22000);
      });
    },
  };

  games.zap = {
    id: "zap",
    prompt: "CHEESE!",
    hint: "GUIDE MOUSE TO CHEESE",
    duration: 15000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div style="position:absolute;left:8%;right:8%;top:6%;text-align:center;color:#1b1f35;font-size:4.4cqw;font-weight:900;' +
          'background:rgba(255,255,255,0.62);border:1px solid rgba(255,255,255,0.82);border-radius:999px;padding:8px 10px;box-shadow:0 10px 24px rgba(37,55,107,0.15);z-index:2">Guide the mouse to the cheese</div>' +
          '<canvas id="zapCanvas" width="320" height="420" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>';
        const canvas = $("#zapCanvas");
        const draw = canvas.getContext("2d");
        const start = { x: 54, y: 100 };
        const end = { x: 266, y: 340 };
        const blockers = [
          { x: 142, y: 178, r: 22, emoji: "🐱" },
          { x: 218, y: 254, r: 24, emoji: "🐱" },
          { x: 112, y: 300, r: 22, emoji: "🐱" },
        ];
        const render = (path = []) => {
          draw.clearRect(0, 0, canvas.width, canvas.height);
          draw.fillStyle = "rgba(255,255,255,0.26)";
          draw.fillRect(24, 62, 272, 322);
          draw.strokeStyle = "rgba(255,255,255,0.62)";
          draw.lineWidth = 18;
          draw.lineCap = "round";
          draw.lineJoin = "round";
          draw.beginPath();
          draw.moveTo(start.x, start.y);
          draw.bezierCurveTo(96, 130, 92, 232, 152, 232);
          draw.bezierCurveTo(216, 232, 210, 322, end.x, end.y);
          draw.stroke();
          draw.strokeStyle = "rgba(35,47,95,0.12)";
          draw.lineWidth = 4;
          draw.stroke();
          draw.font = "38px system-ui";
          draw.textAlign = "center";
          draw.textBaseline = "middle";
          draw.fillText("🐭", start.x, start.y);
          draw.fillText("🧀", end.x, end.y);
          blockers.forEach((blocker) => {
            draw.fillStyle = "rgba(255,80,112,0.18)";
            draw.beginPath();
            draw.arc(blocker.x, blocker.y, blocker.r + 13, 0, Math.PI * 2);
            draw.fill();
            draw.fillStyle = "#000";
            draw.fillText(blocker.emoji, blocker.x, blocker.y);
          });
          if (path.length) {
            draw.strokeStyle = "#fff7a8";
            draw.lineWidth = 11;
            draw.lineCap = "round";
            draw.lineJoin = "round";
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
          if (Math.hypot(point.x - start.x, point.y - start.y) < 42) {
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
          if (blockers.some((blocker) => Math.hypot(point.x - blocker.x, point.y - blocker.y) < blocker.r + 3)) {
            done({ won: false });
            return;
          }
          if (Math.hypot(point.x - end.x, point.y - end.y) < 42) {
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
        ctx.scope.setTimeout(() => done({ won: false }), 15000);
      });
    },
  };

  games.bounce = {
    id: "bounce",
    prompt: "PONG!",
    hint: "RETURN 5 BALLS",
    duration: 16000,
    start(ctx) {
      return new Promise((resolve) => {
        const done = finishOnce(ctx.scope, resolve);
        ctx.area.innerHTML =
          '<div id="pongScore" style="position:absolute;top:8%;left:0;right:0;text-align:center;font-size:8cqw;color:#fff;-webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000">0 / 5</div>' +
          '<div style="position:absolute;right:5%;top:16%;bottom:10%;width:8px;background:rgba(255,255,255,0.62);border-radius:999px"></div>' +
          '<div id="pongPaddle" style="position:absolute;left:7%;top:44%;width:5cqw;height:26%;background:var(--b);border:4px solid #000;border-radius:999px;box-shadow:0 6px 0 rgba(0,0,0,0.2)"></div>' +
          '<div id="pongBall" style="position:absolute;left:48%;top:48%;font-size:9cqw;filter:drop-shadow(0 4px 0 rgba(0,0,0,0.25))">🏀</div>';
        const scoreEl = $("#pongScore");
        const paddle = $("#pongPaddle");
        const ball = $("#pongBall");
        let paddleY = 44;
        let ballX = 48;
        let ballY = 48;
        let vx = -1.45;
        let vy = 1.0;
        let returns = 0;
        const movePaddle = (event) => {
          const rect = ctx.area.getBoundingClientRect();
          const point = event.touches ? event.touches[0] : event;
          paddleY = Math.max(14, Math.min(72, ((point.clientY - rect.top) / rect.height) * 100 - 13));
          paddle.style.top = paddleY + "%";
        };
        ctx.area.onpointermove = movePaddle;
        ctx.area.onpointerdown = movePaddle;
        const loop = ctx.scope.setInterval(() => {
          ballX += vx;
          ballY += vy;
          if (ballY < 17 || ballY > 86) {
            vy *= -1;
            ballY = Math.max(17, Math.min(86, ballY));
          }
          if (ballX > 86) {
            vx *= -1;
            ballX = 86;
          }
          const paddleTop = paddleY;
          const paddleBottom = paddleY + 26;
          if (ballX < 13 && ballX > 6 && ballY > paddleTop - 4 && ballY < paddleBottom + 4 && vx < 0) {
            vx = Math.min(2.5, Math.abs(vx) + 0.12);
            vy += (ballY - (paddleTop + 13)) * 0.035;
            returns += 1;
            scoreEl.textContent = `${returns} / 5`;
            ctx.note(600 + returns * 55, 80, 0.5, "sine");
            if (returns >= 5) done({ won: true });
          }
          if (ballX < -6) done({ won: false });
          ball.style.left = ballX + "%";
          ball.style.top = ballY + "%";
        }, 30);
        ctx.scope.addCleanup(() => {
          clearInterval(loop);
          ctx.area.onpointermove = null;
          ctx.area.onpointerdown = null;
        });
        ctx.scope.setTimeout(() => done({ won: returns >= 5 }), 16000);
      });
    },
  };

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
    this.showRoundVerdict(localWins ? "WIN!" : "SO CLOSE", localWins);

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
    this.showRoundVerdict(result.won ? "WIN!" : "TRY AGAIN", result.won);
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
      `<div class="instr" style="font-size:clamp(40px,16cqw,90px)">GOOD RUN<br>` +
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
      `<div class="instr" style="font-size:clamp(40px,16cqw,90px)">${victory ? "VICTORY" : "GOOD GAME"}<br>` +
      `<span style="font-size:clamp(30px,10cqw,60px)">${finalMy}-${finalOpp}</span></div>`;
    if (victory) {
      const show = window.setInterval(() => {
        fx.spawn(Math.random() * fx.canvas.width, Math.random() * fx.canvas.height * 0.6 + fx.canvas.height * 0.2, true);
      }, 350);
      window.setTimeout(() => clearInterval(show), 3500);
    }
    this.renderPostMatchActions();
  }
