function drawPortrait(card, x, y, scale = 2, mirrored = false) {
  const role = card.role || "FOH";
  const base = ROLE_COLORS[role] || PALETTE.mid;
  const px = (xx, yy, ww, hh, color) => {
    const drawX = mirrored ? x + (18 - xx - ww) * scale : x + xx * scale;
    gameCtx.fillStyle = color;
    gameCtx.fillRect(drawX, y + yy * scale, ww * scale, hh * scale);
  };
  px(5, 2, 8, 7, "#d9b274");
  px(4, 8, 10, 8, base);
  px(3, 15, 4, 3, PALETTE.ink);
  px(11, 15, 4, 3, PALETTE.ink);
  px(6, 5, 2, 2, PALETTE.ink);
  px(10, 5, 2, 2, PALETTE.ink);
  if (card.id === "chef") {
    px(4, 0, 10, 3, PALETTE.paper); px(6, -2, 6, 3, PALETTE.paper);
  } else if (card.id === "bartender") {
    px(13, 9, 4, 2, PALETTE.paper); px(15, 7, 2, 6, PALETTE.blue);
  } else if (card.id === "server") {
    px(13, 9, 5, 1, PALETTE.ink); px(15, 7, 2, 2, PALETTE.paper);
  } else if (card.id === "host") {
    px(13, 8, 4, 6, PALETTE.paper); px(14, 9, 2, 1, PALETTE.ink);
  } else if (card.id === "runner") {
    px(13, 10, 5, 2, PALETTE.paper); px(14, 8, 3, 2, PALETTE.gold);
  } else if (card.id === "kp") {
    px(2, 10, 3, 5, PALETTE.gold); px(13, 10, 3, 5, PALETTE.gold);
  } else if (card.id === "supervisor") {
    px(3, 3, 2, 6, PALETTE.ink); px(2, 4, 2, 2, PALETTE.paper);
  } else if (card.id === "manager") {
    px(8, 9, 2, 6, PALETTE.red); px(6, 0, 6, 2, PALETTE.ink);
  }
}

function drawTurnMarker() {
  const y = state.turn === "player" ? 82 : 72;
  gameCtx.fillStyle = state.turn === "player" ? PALETTE.gold : PALETTE.red;
  gameCtx.beginPath();
  gameCtx.moveTo(80, y);
  gameCtx.lineTo(76, y - 4);
  gameCtx.lineTo(84, y - 4);
  gameCtx.closePath();
  gameCtx.fill();
}

function drawMessageBar() {
  gameCtx.fillStyle = PALETTE.ink;
  gameCtx.fillRect(77, 91, 79, 48);
  gameCtx.fillStyle = PALETTE.paper;
  gameCtx.fillRect(79, 93, 75, 44);
  drawWrapped(state.message || "Choose an action.", 82, 96, 68, 7, PALETTE.ink);
}

function drawFloaters() {
  state.floaters.forEach(f => {
    const baseX = f.side === "player" ? 40 : 121;
    const baseY = f.side === "player" ? 78 : 16;
    gameCtx.globalAlpha = Math.max(0, f.life / 50);
    drawPixelText(f.text, baseX, baseY - f.rise, 10, f.color, "center");
    gameCtx.globalAlpha = 1;
  });
}

function drawFlash() {
  if (!state.flash) return;
  const target = state.flash.side === "player" ? { x: 5, y: 84, w: 72, h: 58 } : { x: 83, y: 16, w: 73, h: 57 };
  gameCtx.fillStyle = state.flash.life % 4 < 2 ? "rgba(238,242,194,.45)" : "rgba(168,59,54,.35)";
  gameCtx.fillRect(target.x, target.y, target.w, target.h);
}

function drawResultScreen() {
  drawBattleScreen();
  gameCtx.fillStyle = "rgba(20,38,30,.86)";
  gameCtx.fillRect(12, 36, 136, 72);
  gameCtx.fillStyle = PALETTE.paper;
  gameCtx.fillRect(16, 40, 128, 64);
  const won = state.winner === "player";
  drawPixelText(won ? "SHIFT WON!" : "SHIFT LOST", 80, 48, 15, won ? PALETTE.dark : PALETTE.red, "center");
  drawWrapped(state.message, 27, 70, 106, 8, PALETTE.ink);
  drawPixelText(`CAREER ${state.meta.wins}W ${state.meta.losses}L`, 80, 92, 7, PALETTE.dark, "center");
}

function updateAnimation() {
  state.frame += 1;
  state.floaters.forEach(f => { f.life -= 1; f.rise += .22; });
  state.floaters = state.floaters.filter(f => f.life > 0);
  if (state.flash) {
    state.flash.life -= 1;
    if (state.flash.life <= 0) state.flash = null;
  }
}

function renderGame() {
  updateAnimation();
  if (state.screen === "title") drawTitleScreen();
  else if (state.screen === "result") drawResultScreen();
  else drawBattleScreen();
  requestAnimationFrame(renderGame);
}

function openCollection() {
  collectionList.innerHTML = Object.values(SHIFT_CARD_LIBRARY).map(card => {
    const info = card.kind === "worker"
      ? `${card.role} · ${card.composure} Composure · ${card.moves.map(m => `${m.name} (${m.cost})`).join(" / ")}`
      : `${card.category} · ${card.text}`;
    return `<article><strong>${card.name}</strong><br>${card.kind.toUpperCase()} · ${info}</article>`;
  }).join("");
  collectionModal.classList.remove("hidden");
}

newShiftBtn.addEventListener("click", startNewShift);
playBtn.addEventListener("click", playSelectedCard);
moveOneBtn.addEventListener("click", () => usePlayerMove(0));
moveTwoBtn.addEventListener("click", () => usePlayerMove(1));
endTurnBtn.addEventListener("click", endPlayerTurn);
helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
collectionBtn.addEventListener("click", openCollection);
document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", () => button.closest(".modal").classList.add("hidden")));

updateControls();
renderHand();
requestAnimationFrame(renderGame);
