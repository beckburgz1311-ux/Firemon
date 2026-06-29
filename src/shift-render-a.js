function drawPixelText(text, x, y, size = 8, color = PALETTE.ink, align = "left") {
  gameCtx.fillStyle = color;
  gameCtx.font = `bold ${size}px monospace`;
  gameCtx.textAlign = align;
  gameCtx.textBaseline = "top";
  gameCtx.fillText(text, x, y);
}

function drawWrapped(text, x, y, width, lineHeight = 7, color = PALETTE.ink) {
  gameCtx.font = "bold 6px monospace";
  gameCtx.fillStyle = color;
  gameCtx.textAlign = "left";
  gameCtx.textBaseline = "top";
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (gameCtx.measureText(test).width > width && line) {
      gameCtx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
  }
  if (line) gameCtx.fillText(line, x, yy);
}

function drawTitleScreen() {
  gameCtx.fillStyle = PALETTE.light;
  gameCtx.fillRect(0, 0, GW, GH);
  for (let y = 0; y < GH; y += 8) {
    gameCtx.fillStyle = y % 16 ? "rgba(36,71,53,.08)" : "rgba(238,242,194,.08)";
    gameCtx.fillRect(0, y, GW, 4);
  }
  gameCtx.fillStyle = PALETTE.dark;
  gameCtx.fillRect(8, 10, 144, 42);
  gameCtx.fillStyle = PALETTE.paper;
  gameCtx.fillRect(11, 13, 138, 36);
  drawPixelText("SHIFT", 80, 16, 20, PALETTE.ink, "center");
  drawPixelText("DECK", 80, 34, 14, PALETTE.dark, "center");
  drawPixelText("HOSPITALITY CARD BATTLE", 80, 56, 7, PALETTE.ink, "center");
  drawPortrait({ id: "server", role: "FOH" }, 22, 70, 3, false);
  drawPortrait({ id: "chef", role: "BOH" }, 112, 70, 3, true);
  drawPixelText("WORKERS VS CUSTOMERS", 80, 111, 7, PALETTE.dark, "center");
  drawPixelText("PRESS START SHIFT", 80, 126 + Math.floor(Math.sin(state.frame / 16) * 2), 8, PALETTE.ink, "center");
}

function drawBattleScreen() {
  gameCtx.fillStyle = PALETTE.light;
  gameCtx.fillRect(0, 0, GW, GH);
  drawVenueFloor();
  drawSideHeader(state.rival, 3, 3, false);
  drawSideHeader(state.player, 3, 76, true);
  drawBench(state.rival, 4, 17, false);
  drawBench(state.player, 108, 91, true);

  if (state.rival.active) drawActiveCard(state.rival.active, 86, 19, 68, 51, true, state.rival.status.guard);
  else drawEmptySlot(86, 19, 68, 51, "NO STAFF");

  if (state.player.active) drawActiveCard(state.player.active, 7, 88, 68, 51, false, state.player.status.guard);
  else drawEmptySlot(7, 88, 68, 51, "NO STAFF");

  drawTurnMarker();
  drawMessageBar();
  drawFloaters();
  drawFlash();
}

function drawVenueFloor() {
  gameCtx.fillStyle = "#a7bf70";
  gameCtx.fillRect(0, 0, GW, GH);
  gameCtx.fillStyle = "rgba(36,71,53,.12)";
  for (let x = -20; x < GW + 20; x += 16) {
    gameCtx.fillRect(x + (state.frame % 16), 0, 1, GH);
  }
  for (let y = 0; y < GH; y += 12) gameCtx.fillRect(0, y, GW, 1);
  gameCtx.fillStyle = "rgba(238,242,194,.25)";
  gameCtx.fillRect(76, 14, 2, 126);
}

function drawSideHeader(side, x, y, player) {
  gameCtx.fillStyle = PALETTE.ink;
  gameCtx.fillRect(x, y, 154, 11);
  drawPixelText(player ? "YOUR VENUE" : "RIVAL VENUE", x + 3, y + 2, 6, PALETTE.paper);
  drawPixelText(`TIP ${side.tips}/${TIP_TARGET}`, x + 92, y + 2, 6, PALETTE.gold);
  drawPixelText(`SP ${side.shift}`, x + 132, y + 2, 6, PALETTE.light);
}

function drawActiveCard(card, x, y, w, h, enemy, guard) {
  const roleColor = ROLE_COLORS[card.role] || PALETTE.mid;
  gameCtx.fillStyle = PALETTE.ink;
  gameCtx.fillRect(x, y, w, h);
  gameCtx.fillStyle = PALETTE.paper;
  gameCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
  gameCtx.fillStyle = roleColor;
  gameCtx.fillRect(x + 3, y + 3, w - 6, 9);
  drawPixelText(card.name.toUpperCase().slice(0, 16), x + 5, y + 5, 6, PALETTE.ink);
  drawPortrait(card, x + (enemy ? 7 : 37), y + 15, 2, enemy);
  const textX = enemy ? x + 37 : x + 4;
  drawPixelText(card.role, textX, y + 17, 6, PALETTE.dark);
  drawPixelText(`${card.currentComposure}/${card.maxComposure}`, textX, y + 25, 6, PALETTE.ink);
  drawHealthBar(card, textX, y + 34, 27);
  if (guard > 0) drawPixelText(`GUARD ${guard}`, textX, y + 41, 5, PALETTE.blue);
}

function drawHealthBar(card, x, y, w) {
  const ratio = Math.max(0, card.currentComposure / card.maxComposure);
  gameCtx.fillStyle = PALETTE.ink;
  gameCtx.fillRect(x, y, w, 5);
  gameCtx.fillStyle = ratio > .5 ? PALETTE.mid : ratio > .25 ? PALETTE.gold : PALETTE.red;
  gameCtx.fillRect(x + 1, y + 1, Math.floor((w - 2) * ratio), 3);
}

function drawEmptySlot(x, y, w, h, label) {
  gameCtx.fillStyle = PALETTE.dark;
  gameCtx.fillRect(x, y, w, h);
  gameCtx.fillStyle = PALETTE.light;
  gameCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
  drawPixelText(label, x + w / 2, y + h / 2 - 3, 7, PALETTE.ink, "center");
}

function drawBench(side, x, y, player) {
  drawPixelText("BENCH", x, y, 5, PALETTE.dark);
  for (let i = 0; i < 2; i++) {
    const card = side.bench[i];
    const bx = x + i * 33;
    const by = y + 7;
    gameCtx.fillStyle = PALETTE.ink;
    gameCtx.fillRect(bx, by, 29, 27);
    gameCtx.fillStyle = card ? PALETTE.paper : PALETTE.mid;
    gameCtx.fillRect(bx + 2, by + 2, 25, 23);
    if (card) {
      drawPortrait(card, bx + 5, by + 4, 1, !player);
      drawPixelText(`${card.currentComposure}`, bx + 19, by + 16, 5, PALETTE.ink, "center");
    }
  }
}
