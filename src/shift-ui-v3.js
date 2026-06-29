"use strict";

(function installShiftV3Panels() {
  const statusRow = document.querySelector(".status-row");
  if (statusRow && !document.getElementById("turnMeter")) {
    const meter = document.createElement("div");
    meter.id = "turnMeter";
    meter.className = "turn-meter";
    statusRow.insertAdjacentElement("afterend", meter);
  }

  const helpCard = document.querySelector("#helpModal .modal-card");
  if (helpCard) {
    helpCard.innerHTML = `
      <h2>How to play</h2>
      <p><strong>Cards:</strong> Cost 1–4 Shift Points. Play as many as you can afford.</p>
      <p><strong>Shift Points:</strong> Start at 1 and increase each turn up to 6.</p>
      <p><strong>Blue move:</strong> Costs 1 SP and ends your turn.</p>
      <p><strong>Red special:</strong> Costs 1 SP plus 1 Tip and ends your turn.</p>
      <p><strong>Tips:</strong> Gain one every third turn and whenever an opposing worker is Sent on Break. Reach three Tips to win, but spending one on a special delays victory.</p>
      <p><strong>Bench:</strong> Tap a benched worker to swap them active before attacking.</p>
      <button class="game-btn gold" data-close-modal>BACK TO SHIFT</button>`;
  }
})();

const turnMeter = document.getElementById("turnMeter");

function miniRoleColour(role) {
  return ROLE_COLORS[role] || PALETTE.mid;
}

function drawWorkerMini(canvas, worker) {
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / 24;
  const px = (x, y, w, h, colour) => {
    g.fillStyle = colour;
    g.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
  };
  const uniform = miniRoleColour(worker.role);
  const skin = "#d9b274";
  const hair = worker.id === "chef" ? "#eef2c2" : worker.id === "manager" ? "#202b24" : "#5a3824";

  px(7, 2, 10, 3, hair);
  px(6, 5, 12, 8, skin);
  px(5, 12, 14, 9, uniform);
  px(7, 21, 4, 3, PALETTE.ink);
  px(14, 21, 4, 3, PALETTE.ink);
  px(8, 8, 2, 2, PALETTE.ink);
  px(14, 8, 2, 2, PALETTE.ink);
  px(11, 11, 3, 1, PALETTE.dark);

  if (worker.id === "chef") { px(6, 0, 12, 4, PALETTE.paper); px(9, -2, 6, 3, PALETTE.paper); }
  if (worker.id === "bartender") { px(18, 12, 4, 2, PALETTE.paper); px(20, 9, 2, 7, PALETTE.blue); }
  if (worker.id === "server") { px(18, 13, 5, 1, PALETTE.ink); px(20, 10, 2, 3, PALETTE.paper); }
  if (worker.id === "host") { px(18, 10, 4, 7, PALETTE.paper); px(19, 12, 2, 1, PALETTE.ink); }
  if (worker.id === "runner") { px(18, 14, 5, 2, PALETTE.paper); px(19, 11, 3, 3, PALETTE.gold); }
  if (worker.id === "kp") { px(2, 13, 4, 7, PALETTE.gold); px(18, 13, 4, 7, PALETTE.gold); }
  if (worker.id === "supervisor") { px(3, 6, 3, 8, PALETTE.ink); px(2, 7, 2, 3, PALETTE.paper); }
  if (worker.id === "manager") { px(11, 13, 2, 7, PALETTE.red); px(8, 1, 8, 2, PALETTE.ink); }
}

function effectSummary(move) {
  const extras = [];
  if (move.heal) extras.push(`HEAL ${move.heal}`);
  if (move.draw) extras.push(`DRAW ${move.draw}`);
  if (move.guard) extras.push(`GUARD ${move.guard}`);
  return extras.length ? extras.join(" · ") : "PURE STRESS";
}

renderBench = function renderBenchV3() {
  if (!benchPanel) return;
  if (!state.player || state.screen === "title") {
    benchPanel.innerHTML = '<div class="bench-empty">Start a shift to reveal your line-up.</div>';
    return;
  }

  const active = state.player.active;
  const activeHtml = active ? `
    <article class="lineup-card active-card">
      <span class="lineup-label">ACTIVE</span>
      <canvas class="lineup-sprite" width="32" height="32" data-lineup="active"></canvas>
      <div class="lineup-copy"><strong>${active.name}</strong><small>${active.role} · ${active.currentComposure}/${active.maxComposure} CP</small><i><b style="width:${Math.max(0, active.currentComposure / active.maxComposure * 100)}%"></b></i></div>
    </article>` : '<article class="lineup-card active-card"><span class="lineup-label">ACTIVE</span><strong>EMPTY</strong></article>';

  const benchHtml = [0, 1, 2].map(index => {
    const worker = state.player.bench[index];
    if (!worker) return `<article class="lineup-card empty-card"><span class="lineup-label">BENCH ${index + 1}</span><strong>EMPTY</strong></article>`;
    return `
      <button class="lineup-card bench-card" data-bench-swap="${index}">
        <span class="lineup-label">BENCH ${index + 1} · SWAP</span>
        <canvas class="lineup-sprite" width="32" height="32" data-lineup="${index}"></canvas>
        <div class="lineup-copy"><strong>${worker.name}</strong><small>${worker.role} · ${worker.currentComposure}/${worker.maxComposure} CP</small><i><b style="width:${Math.max(0, worker.currentComposure / worker.maxComposure * 100)}%"></b></i></div>
      </button>`;
  }).join("");

  benchPanel.innerHTML = activeHtml + benchHtml;
  const activeCanvas = benchPanel.querySelector('[data-lineup="active"]');
  if (activeCanvas && active) drawWorkerMini(activeCanvas, active);
  state.player.bench.forEach((worker, index) => {
    const canvas = benchPanel.querySelector(`[data-lineup="${index}"]`);
    if (canvas) drawWorkerMini(canvas, worker);
  });
  benchPanel.querySelectorAll("[data-bench-swap]").forEach(button => button.addEventListener("click", () => swapPlayerBench(Number(button.dataset.benchSwap))));
};

renderHand = function renderHandV3() {
  if (!state.player || state.screen === "title") {
    handEl.innerHTML = "";
    renderBench();
    return;
  }

  handEl.innerHTML = state.player.hand.map((card, index) => {
    const selected = index === state.selectedHand ? " selected" : "";
    const typeClass = card.kind === "worker" ? "worker" : "customer";
    const unaffordable = state.player.shift < (card.cost || 1) ? " unaffordable" : "";
    const picture = card.kind === "worker" ? `<canvas class="hand-sprite" width="32" height="32" data-hand-sprite="${index}"></canvas>` : `<span class="customer-icon">${card.category.slice(0, 1)}</span>`;
    const detail = card.kind === "worker"
      ? `${card.role} · ${card.currentComposure}/${card.maxComposure} CP`
      : `${card.category}<br>${card.text}`;
    return `<button class="hand-card ${typeClass}${selected}${unaffordable}" data-hand="${index}"><span class="cost">${card.cost || 1}</span>${picture}<span class="kind">${card.kind.toUpperCase()}</span><h3>${card.name}</h3><p>${detail}</p></button>`;
  }).join("");

  state.player.hand.forEach((card, index) => {
    if (card.kind !== "worker") return;
    const canvas = handEl.querySelector(`[data-hand-sprite="${index}"]`);
    if (canvas) drawWorkerMini(canvas, card);
  });
  handEl.querySelectorAll("[data-hand]").forEach(button => button.addEventListener("click", () => selectHand(Number(button.dataset.hand))));
  renderBench();
};

updateControls = function updateControlsV3() {
  const battle = state.screen === "battle" && !state.winner;
  const playerTurn = battle && state.turn === "player" && !state.busy;
  const selected = state.player && state.player.hand[state.selectedHand];
  const selectedCost = selected ? selected.cost || 1 : 0;
  const workerSlotAvailable = !selected || selected.kind !== "worker" || !state.player.active || state.player.bench.length < 3;
  playBtn.disabled = !playerTurn || !selected || selectedCost > state.player.shift || !workerSlotAvailable;
  playBtn.innerHTML = selected ? `<span>PLAY ${selected.name}</span><small>${selectedCost} SP</small>` : "PLAY CARD";

  const active = state.player && state.player.active;
  const basic = active && active.moves[0];
  const special = active && active.moves[1];
  const tax = state.player ? state.player.status.surcharge : 0;
  const attackCost = SHIFT_BASIC_SP_COST + tax;

  moveOneBtn.innerHTML = basic
    ? `<span class="attack-name">${basic.name}</span><small>${basic.damage} STRESS · ${attackCost} SP<br>${effectSummary(basic)}</small>`
    : "BASIC MOVE";
  moveTwoBtn.innerHTML = special
    ? `<span class="attack-name">${special.name}</span><small>${special.damage} STRESS · ${attackCost} SP + 1 TIP<br>${effectSummary(special)}</small>`
    : "SPECIAL MOVE";
  moveOneBtn.title = basic ? basic.text : "";
  moveTwoBtn.title = special ? special.text : "";
  moveOneBtn.disabled = !playerTurn || !basic || state.player.shift < attackCost;
  moveTwoBtn.disabled = !playerTurn || !special || state.player.shift < attackCost || state.player.tips < SHIFT_SPECIAL_TIP_COST || state.player.status.silence > 0;
  endTurnBtn.disabled = !playerTurn;

  if (state.screen === "title") newShiftBtn.textContent = "START SHIFT";
  else if (state.winner) newShiftBtn.textContent = "NEW SHIFT";
  else newShiftBtn.textContent = "RESTART SHIFT";

  if (state.player) {
    const playerWait = turnsUntilTip(state.player);
    const rivalWait = turnsUntilTip(state.rival);
    playerStatusEl.innerHTML = `<strong>YOU</strong> · Tips ${state.player.tips}/${TIP_TARGET} · SP ${state.player.shift}/${state.player.maxShift} · Deck ${state.player.deck.length}`;
    rivalStatusEl.innerHTML = `<strong>RIVAL</strong> · Tips ${state.rival.tips}/${TIP_TARGET} · SP ${state.rival.shift}/${state.rival.maxShift} · Deck ${state.rival.deck.length}`;
    if (turnMeter) turnMeter.innerHTML = `<span>YOUR NEXT TIP: <b>${playerWait} TURN${playerWait === 1 ? "" : "S"}</b></span><span>RIVAL: ${rivalWait}</span>`;
  } else {
    playerStatusEl.innerHTML = `<strong>CAREER</strong> · Wins ${state.meta.wins}`;
    rivalStatusEl.innerHTML = `<strong>RECORD</strong> · Losses ${state.meta.losses}`;
    if (turnMeter) turnMeter.textContent = "Every third turn earns one Tip";
  }
  renderBench();
};

openCollection = function openCollectionV3() {
  collectionList.innerHTML = Object.values(SHIFT_CARD_LIBRARY).map(card => {
    const info = card.kind === "worker"
      ? `${card.role} · ${card.composure} Composure · Card ${card.cost} SP<br>Blue: ${card.moves[0].name}, ${card.moves[0].damage} stress<br>Red: ${card.moves[1].name}, ${card.moves[1].damage} stress, 1 SP + 1 Tip`
      : `${card.category} · ${card.cost} SP · ${card.text}`;
    return `<article><strong>${card.name}</strong><br>${card.kind.toUpperCase()} · ${info}</article>`;
  }).join("");
  collectionModal.classList.remove("hidden");
};
