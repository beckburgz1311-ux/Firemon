"use strict";

const SHIFT_CARD_COSTS = {
  server: 2, bartender: 3, chef: 4, host: 2, runner: 1, kp: 2, supervisor: 3, manager: 4,
  regular: 1, birthday: 2, critic: 3, influencer: 2, allergy: 2, walkin: 2,
  bottomless: 4, complaint: 3, lovelycouple: 2, largeparty: 4, latearrival: 1, noshow: 2
};
const SHIFT_ATTACK_COST = 1;

Object.values(SHIFT_CARD_LIBRARY).forEach(card => {
  card.cost = SHIFT_CARD_COSTS[card.id] || 1;
  if (card.kind === "worker") card.moves.forEach(move => { move.cost = SHIFT_ATTACK_COST; });
});

(function installShiftDeckV2UI() {
  const controls = document.querySelector(".controls");
  const handWrap = document.querySelector(".hand-wrap");
  if (controls && handWrap && !document.getElementById("benchPanel")) {
    const wrap = document.createElement("section");
    wrap.className = "bench-wrap";
    wrap.innerHTML = '<div class="bench-title"><span>YOUR LINE-UP</span><span>Tap a benched worker to swap</span></div><div id="benchPanel" class="bench-panel"></div>';
    controls.insertBefore(wrap, handWrap);
  }

  if (!document.querySelector('link[href*="shift-rules-v2.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "shift-rules-v2.css?v=4";
    document.head.appendChild(link);
  }

  const helpCard = document.querySelector("#helpModal .modal-card");
  if (helpCard) {
    helpCard.innerHTML = `
      <h2>How to play</h2>
      <p><strong>Workers</strong> are your battlers. Composure is their HP and Stress is damage.</p>
      <p>Every card costs <strong>1–4 Shift Points</strong>. You may play as many cards as you can afford.</p>
      <p>Your Shift Points start at 1 and increase by 1 each turn, up to 6.</p>
      <p>Every attack costs <strong>1 Shift Point</strong> and ends your turn. If you spend every Shift Point on cards, your turn ends automatically because you cannot attack.</p>
      <p>Tap a worker on your bench to swap them with the active worker for free before attacking.</p>
      <p>Workers reduced to zero Composure are <strong>Sent on Break</strong>. First venue to collect three Tips wins.</p>
      <button class="game-btn gold" data-close-modal>BACK TO SHIFT</button>`;
  }
})();

const benchPanel = document.getElementById("benchPanel");

resetTurnFlags = function resetTurnFlagsV2() {};

beginTurn = function beginTurnV2(side, isPlayer) {
  if (state.winner) return;
  side.maxShift = Math.min(6, side.maxShift + 1);
  side.shift = side.maxShift;
  drawCard(side, 1);
  if (!side.active) promoteWorker(side);
  if (side.deckOut && !side.active && !side.bench.length && !side.hand.some(card => card.kind === "worker")) {
    finishGame(isPlayer ? "rival" : "player", `${side.name} ran out of staff.`);
    return;
  }
  setMessage(isPlayer ? `Your turn — ${side.shift} Shift Points available.` : "The rival venue is making a move...");
  renderHand();
  updateControls();
};

playSelectedCard = function playSelectedCardV2() {
  if (state.turn !== "player" || state.busy || state.selectedHand < 0) return;
  playCard(state.player, state.rival, state.selectedHand, true);
};

playCard = function playCardV2(side, opponent, handIndex, isPlayer) {
  const card = side.hand[handIndex];
  if (!card) return false;
  const cost = card.cost || 1;
  if (side.shift < cost) {
    if (isPlayer) toast(`You need ${cost} Shift Points to play ${card.name}.`);
    return false;
  }

  if (card.kind === "worker" && side.active && side.bench.length >= 3) {
    if (isPlayer) toast("Your active slot and three bench spaces are full.");
    return false;
  }

  side.shift -= cost;
  side.hand.splice(handIndex, 1);

  if (card.kind === "worker") {
    if (!side.active) side.active = card;
    else side.bench.push(card);
    setMessage(`${side.name} rostered ${card.name} for ${cost} SP.`);
  } else {
    side.discard.push(card);
    applyCustomer(card, side, opponent);
  }

  if (isPlayer) state.selectedHand = -1;
  renderHand();
  updateControls();

  if (isPlayer && side.shift <= 0 && !state.winner) {
    setMessage("No Shift Points left — your turn ends.");
    state.busy = true;
    setTimeout(() => endActionTurn(true), 700);
  }
  return true;
};

applyCustomer = function applyCustomerV2(card, side, opponent) {
  const active = side.active;
  const enemy = opponent.active;
  switch (card.effect) {
    case "heal":
      if (active) healWorker(active, card.value);
      setMessage(`${card.name}: ${active ? active.name : "the team"} recovered composure.`);
      break;
    case "draw_shift":
      drawCard(side, 1);
      side.shift = Math.min(6, side.shift + card.value);
      setMessage(`${card.name}: draw a card and gain ${card.value} SP.`);
      break;
    case "stress":
      if (enemy) damageActive(opponent, side, card.value, card.name);
      break;
    case "draw":
      drawCard(side, card.value);
      setMessage(`${card.name}: draw ${card.value} cards.`);
      break;
    case "surcharge":
      opponent.status.surcharge = Math.max(opponent.status.surcharge, card.value);
      setMessage(`${card.name}: the rival's next attack costs extra.`);
      break;
    case "drain":
      opponent.shift = Math.max(0, opponent.shift - card.value);
      setMessage(`${card.name}: the rival loses ${card.value} Shift Points.`);
      break;
    case "spread":
      if (opponent.active) damageWorker(opponent.active, card.value, opponent === state.player ? "player" : "rival");
      opponent.bench.forEach(worker => damageWorker(worker, card.value, opponent === state.player ? "player" : "rival"));
      setMessage(`${card.name}: chaos spreads across the rival line-up.`);
      resolveKnockouts(opponent, side);
      break;
    case "silence":
      opponent.status.silence = Math.max(opponent.status.silence, card.value);
      setMessage(`${card.name}: the rival cannot use their second move next turn.`);
      break;
    case "heal_draw":
      if (active) healWorker(active, card.value);
      drawCard(side, 1);
      setMessage(`${card.name}: heal ${card.value} and draw a card.`);
      break;
    case "both_stress":
      if (side.active) damageWorker(side.active, card.value, side === state.player ? "player" : "rival");
      if (opponent.active) damageWorker(opponent.active, card.value, opponent === state.player ? "player" : "rival");
      setMessage(`${card.name}: both active workers take ${card.value} stress.`);
      resolveKnockouts(side, opponent);
      resolveKnockouts(opponent, side);
      break;
    case "shift":
      side.shift = Math.min(6, side.shift + card.value);
      setMessage(`${card.name}: gain ${card.value} Shift Points.`);
      break;
  }
  renderHand();
  updateControls();
};

function triggerAttackShake() {
  const shell = document.querySelector(".screen-shell");
  if (!shell) return;
  shell.classList.remove("attack-shake");
  void shell.offsetWidth;
  shell.classList.add("attack-shake");
  setTimeout(() => shell.classList.remove("attack-shake"), 340);
}

useMove = function useMoveV2(side, opponent, index, isPlayer) {
  const worker = side.active;
  if (!worker || !worker.moves[index]) return false;
  if (index === 1 && side.status.silence > 0) {
    if (isPlayer) toast("A complaint has locked your second move this turn.");
    return false;
  }

  const move = worker.moves[index];
  const tax = side.status.surcharge > 0 ? side.status.surcharge : 0;
  const cost = SHIFT_ATTACK_COST + tax;
  if (side.shift < cost) {
    if (isPlayer) toast(`You need ${cost} Shift Point${cost === 1 ? "" : "s"} to attack.`);
    return false;
  }

  side.shift -= cost;
  side.status.surcharge = 0;
  state.busy = true;
  const roleBonus = roleMultiplier(worker.role, opponent.active ? opponent.active.role : "");
  const damage = Math.max(0, Math.round(move.damage * roleBonus));
  const label = roleBonus > 1 ? " SUPER EFFECTIVE!" : "";
  setMessage(`${worker.name} used ${move.name}!${label}`);

  setTimeout(() => {
    triggerAttackShake();
    if (opponent.active) damageActive(opponent, side, damage, move.name);
    if (move.heal) healWorker(worker, move.heal);
    if (move.draw) drawCard(side, move.draw);
    if (move.guard) side.status.guard += move.guard;
    renderHand();
    updateControls();
    setTimeout(() => endActionTurn(isPlayer), 650);
  }, 360);
  return true;
};

function swapPlayerBench(index) {
  if (state.turn !== "player" || state.busy || state.winner) return;
  if (!state.player.active || !state.player.bench[index]) return;
  const outgoing = state.player.active;
  state.player.active = state.player.bench[index];
  state.player.bench[index] = outgoing;
  setMessage(`${state.player.active.name} swaps in. ${outgoing.name} moves to the bench.`);
  renderHand();
  updateControls();
}

function renderBench() {
  if (!benchPanel) return;
  if (!state.player || state.screen === "title") {
    benchPanel.innerHTML = '<div class="bench-empty">Start a shift to see your line-up.</div>';
    return;
  }

  const active = state.player.active;
  const activeHtml = active
    ? `<article class="lineup-card active-card"><span class="lineup-label">ACTIVE</span><strong>${active.name}</strong><small>${active.role} · ${active.currentComposure}/${active.maxComposure} CP</small></article>`
    : '<article class="lineup-card active-card"><span class="lineup-label">ACTIVE</span><strong>EMPTY</strong></article>';

  const benchHtml = [0, 1, 2].map(index => {
    const worker = state.player.bench[index];
    if (!worker) return `<article class="lineup-card empty-card"><span class="lineup-label">BENCH ${index + 1}</span><strong>EMPTY</strong></article>`;
    return `<button class="lineup-card bench-card" data-bench-swap="${index}"><span class="lineup-label">BENCH ${index + 1} · TAP TO SWAP</span><strong>${worker.name}</strong><small>${worker.role} · ${worker.currentComposure}/${worker.maxComposure} CP</small></button>`;
  }).join("");

  benchPanel.innerHTML = activeHtml + benchHtml;
  benchPanel.querySelectorAll("[data-bench-swap]").forEach(button => button.addEventListener("click", () => swapPlayerBench(Number(button.dataset.benchSwap))));
}

renderHand = function renderHandV2() {
  if (!state.player || state.screen === "title") {
    handEl.innerHTML = "";
    renderBench();
    return;
  }
  handEl.innerHTML = state.player.hand.map((card, index) => {
    const selected = index === state.selectedHand ? " selected" : "";
    const typeClass = card.kind === "worker" ? "worker" : "customer";
    const unaffordable = state.player.shift < (card.cost || 1) ? " unaffordable" : "";
    const detail = card.kind === "worker"
      ? `${card.role} · ${card.currentComposure}/${card.maxComposure} CP<br>${card.moves[0].name} / ${card.moves[1].name}`
      : `${card.category}<br>${card.text}`;
    return `<button class="hand-card ${typeClass}${selected}${unaffordable}" data-hand="${index}"><span class="cost">${card.cost || 1}</span><span class="kind">${card.kind.toUpperCase()}</span><h3>${card.name}</h3><p>${detail}</p></button>`;
  }).join("");
  handEl.querySelectorAll("[data-hand]").forEach(button => button.addEventListener("click", () => selectHand(Number(button.dataset.hand))));
  renderBench();
};

updateControls = function updateControlsV2() {
  const battle = state.screen === "battle" && !state.winner;
  const playerTurn = battle && state.turn === "player" && !state.busy;
  const selected = state.player && state.player.hand[state.selectedHand];
  const selectedCost = selected ? selected.cost || 1 : 0;
  const workerSlotAvailable = !selected || selected.kind !== "worker" || !state.player.active || state.player.bench.length < 3;
  playBtn.disabled = !playerTurn || !selected || selectedCost > state.player.shift || !workerSlotAvailable;
  playBtn.textContent = selected ? `PLAY ${selected.name} (${selectedCost})` : "PLAY CARD";

  const active = state.player && state.player.active;
  const moveOne = active && active.moves[0];
  const moveTwo = active && active.moves[1];
  const tax = state.player ? state.player.status.surcharge : 0;
  const attackCost = SHIFT_ATTACK_COST + tax;
  moveOneBtn.textContent = moveOne ? `${moveOne.name} (${attackCost})` : "MOVE 1";
  moveTwoBtn.textContent = moveTwo ? `${moveTwo.name} (${attackCost})` : "MOVE 2";
  moveOneBtn.disabled = !playerTurn || !moveOne || state.player.shift < attackCost;
  moveTwoBtn.disabled = !playerTurn || !moveTwo || state.player.shift < attackCost || state.player.status.silence > 0;
  endTurnBtn.disabled = !playerTurn;

  if (state.screen === "title") newShiftBtn.textContent = "START SHIFT";
  else if (state.winner) newShiftBtn.textContent = "NEW SHIFT";
  else newShiftBtn.textContent = "RESTART SHIFT";

  if (state.player) {
    playerStatusEl.innerHTML = `<strong>YOU</strong> · Tips ${state.player.tips}/${TIP_TARGET} · Shift ${state.player.shift}/${state.player.maxShift} · Deck ${state.player.deck.length}`;
    rivalStatusEl.innerHTML = `<strong>RIVAL</strong> · Tips ${state.rival.tips}/${TIP_TARGET} · Shift ${state.rival.shift}/${state.rival.maxShift} · Deck ${state.rival.deck.length}`;
  } else {
    playerStatusEl.innerHTML = `<strong>CAREER</strong> · Wins ${state.meta.wins}`;
    rivalStatusEl.innerHTML = `<strong>RECORD</strong> · Losses ${state.meta.losses}`;
  }
  renderBench();
};

function chooseAiAffordableCard(reserveAttack = true) {
  const side = state.rival;
  const budget = side.shift - (reserveAttack ? SHIFT_ATTACK_COST : 0);
  if (budget <= 0) return -1;
  const options = [];
  side.hand.forEach((card, index) => {
    const cost = card.cost || 1;
    if (cost > budget) return;
    if (card.kind === "worker" && side.active && side.bench.length >= 3) return;
    let score = card.kind === "worker" ? 3 : 2;
    if (card.kind === "worker" && side.bench.length < 2) score += 4;
    if (card.effect === "heal" && side.active && side.active.currentComposure < side.active.maxComposure * .55) score += 8;
    if (card.effect === "heal_draw" && side.active && side.active.currentComposure < side.active.maxComposure * .75) score += 7;
    if (card.effect === "stress" && state.player.active && state.player.active.currentComposure <= card.value + 8) score += 10;
    if (card.effect === "spread" && state.player.bench.length) score += 6;
    if (card.effect === "draw" && side.hand.length < 4) score += 5;
    if (card.effect === "shift" || card.effect === "draw_shift") score += 4;
    options.push({ index, score: score - cost * .3 });
  });
  options.sort((a, b) => b.score - a.score);
  return options.length ? options[0].index : -1;
}

runAiTurn = function runAiTurnV2() {
  if (state.winner || state.turn !== "rival") return;
  state.busy = true;
  if (!state.rival.active) promoteWorker(state.rival);

  if (state.rival.active && state.rival.bench.length && state.rival.active.currentComposure < state.rival.active.maxComposure * .35) {
    const healthiestIndex = state.rival.bench.reduce((best, worker, index, arr) => worker.currentComposure > arr[best].currentComposure ? index : best, 0);
    const outgoing = state.rival.active;
    state.rival.active = state.rival.bench[healthiestIndex];
    state.rival.bench[healthiestIndex] = outgoing;
    setMessage(`${state.rival.active.name} swaps in for the rival venue.`);
  }

  let plays = 0;
  while (plays < 3 && state.rival.shift > SHIFT_ATTACK_COST && !state.winner) {
    const index = chooseAiAffordableCard(true);
    if (index < 0) break;
    if (!playCard(state.rival, state.player, index, false)) break;
    plays += 1;
  }

  setTimeout(() => {
    const worker = state.rival.active;
    if (!worker || state.rival.shift < SHIFT_ATTACK_COST) {
      state.busy = false;
      endActionTurn(false);
      return;
    }
    const legal = worker.moves
      .map((move, index) => ({ move, index }))
      .filter(item => !(item.index === 1 && state.rival.status.silence > 0))
      .sort((a, b) => b.move.damage - a.move.damage);
    state.busy = false;
    if (legal.length) useMove(state.rival, state.player, legal[0].index, false);
    else endActionTurn(false);
  }, 650);
};

openCollection = function openCollectionV2() {
  collectionList.innerHTML = Object.values(SHIFT_CARD_LIBRARY).map(card => {
    const info = card.kind === "worker"
      ? `${card.role} · ${card.composure} Composure · Card cost ${card.cost} SP · Attacks cost 1 SP`
      : `${card.category} · Card cost ${card.cost} SP · ${card.text}`;
    return `<article><strong>${card.name}</strong><br>${card.kind.toUpperCase()} · ${info}</article>`;
  }).join("");
  collectionModal.classList.remove("hidden");
};
