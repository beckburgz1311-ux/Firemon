"use strict";

function drawPortraitV3(card, x, y, scale = 2, mirrored = false) {
  const role = card.role || "FOH";
  const uniform = ROLE_COLORS[role] || PALETTE.mid;
  const skin = card.id === "kp" ? "#b98358" : card.id === "manager" ? "#e0b786" : "#d9b274";
  const hair = card.id === "chef" ? PALETTE.paper : card.id === "host" ? "#3a281e" : card.id === "runner" ? "#2a241c" : "#593a25";
  const spriteScale = scale * .75;
  const bob = scale > 1 ? Math.round(Math.sin((state.frame + card.id.length * 5) / 15)) : 0;
  const px = (xx, yy, ww, hh, colour) => {
    const drawX = mirrored ? x + (24 - xx - ww) * spriteScale : x + xx * spriteScale;
    gameCtx.fillStyle = colour;
    gameCtx.fillRect(drawX, y + (yy + bob) * spriteScale, ww * spriteScale, hh * spriteScale);
  };

  px(6, 3, 10, 3, hair);
  px(5, 5, 12, 8, skin);
  px(4, 13, 14, 7, uniform);
  px(3, 19, 6, 3, PALETTE.ink);
  px(13, 19, 6, 3, PALETTE.ink);
  px(3, 13, 2, 5, skin);
  px(18, 13, 2, 5, skin);
  px(7, 8, 2, 2, PALETTE.ink);
  px(13, 8, 2, 2, PALETTE.ink);
  px(10, 11, 3, 1, PALETTE.dark);
  px(5, 13, 12, 1, PALETTE.paper);

  if (card.id === "chef") {
    px(5, 0, 12, 4, PALETTE.paper);
    px(8, -2, 6, 3, PALETTE.paper);
    px(18, 12, 4, 2, "#9f8b65");
  } else if (card.id === "bartender") {
    px(18, 12, 4, 2, PALETTE.paper);
    px(19, 8, 2, 7, PALETTE.blue);
    px(4, 14, 3, 1, PALETTE.gold);
  } else if (card.id === "server") {
    px(18, 13, 5, 1, PALETTE.ink);
    px(20, 9, 2, 4, PALETTE.paper);
    px(7, 14, 8, 1, PALETTE.ink);
  } else if (card.id === "host") {
    px(18, 9, 4, 8, PALETTE.paper);
    px(19, 11, 2, 1, PALETTE.ink);
    px(4, 4, 2, 6, hair);
  } else if (card.id === "runner") {
    px(18, 14, 5, 2, PALETTE.paper);
    px(19, 10, 3, 4, PALETTE.gold);
    px(6, 14, 10, 1, "#26352b");
  } else if (card.id === "kp") {
    px(1, 13, 4, 8, PALETTE.gold);
    px(18, 13, 4, 8, PALETTE.gold);
    px(8, 1, 6, 2, "#2c241e");
  } else if (card.id === "supervisor") {
    px(2, 6, 3, 8, PALETTE.ink);
    px(1, 7, 2, 3, PALETTE.paper);
    px(8, 14, 6, 1, PALETTE.gold);
  } else if (card.id === "manager") {
    px(10, 13, 2, 7, PALETTE.red);
    px(7, 1, 8, 2, PALETTE.ink);
    px(3, 14, 3, 1, PALETTE.gold);
  }
}

drawPortrait = drawPortraitV3;

drawActiveCard = function drawActiveCardV3(card, x, y, w, h, enemy, guard) {
  const roleColor = ROLE_COLORS[card.role] || PALETTE.mid;
  gameCtx.fillStyle = PALETTE.ink;
  gameCtx.fillRect(x, y, w, h);
  gameCtx.fillStyle = PALETTE.paper;
  gameCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
  gameCtx.fillStyle = roleColor;
  gameCtx.fillRect(x + 3, y + 3, w - 6, 9);
  drawPixelText(card.name.toUpperCase().slice(0, 16), x + 5, y + 5, 6, PALETTE.ink);
  drawPortrait(card, x + (enemy ? 5 : 36), y + 14, 2, enemy);
  const textX = enemy ? x + 37 : x + 4;
  drawPixelText(card.role, textX, y + 16, 6, PALETTE.dark);
  drawPixelText(`${card.currentComposure}/${card.maxComposure}`, textX, y + 24, 6, PALETTE.ink);
  drawHealthBar(card, textX, y + 33, 27);
  drawPixelText(card.moves[0].name.slice(0, 9).toUpperCase(), textX, y + 40, 4, PALETTE.blue);
  if (guard > 0) drawPixelText(`G${guard}`, x + w - 11, y + h - 8, 5, PALETTE.blue, "center");
};

function openCollectionPolished() {
  collectionList.innerHTML = Object.values(SHIFT_CARD_LIBRARY).map(card => {
    const info = card.kind === "worker"
      ? `${card.role} · ${card.composure} Composure · Card ${card.cost} SP<br>Blue: ${card.moves[0].name}, ${card.moves[0].damage} stress<br>Red: ${card.moves[1].name}, ${card.moves[1].damage} stress, 1 SP + 1 Tip`
      : `${card.category} · ${card.cost} SP · ${card.text}`;
    return `<article><strong>${card.name}</strong><br>${card.kind.toUpperCase()} · ${info}</article>`;
  }).join("");
  collectionModal.classList.remove("hidden");
}
collectionBtn.addEventListener("click", openCollectionPolished);
