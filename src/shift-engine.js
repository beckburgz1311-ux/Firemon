"use strict";

const gameCanvas = document.getElementById("game");
const gameCtx = gameCanvas.getContext("2d", { alpha: false });
gameCtx.imageSmoothingEnabled = false;

const q = id => document.getElementById(id);
const handEl = q("hand");
const toastEl = q("toast");
const playerStatusEl = q("playerStatus");
const rivalStatusEl = q("rivalStatus");
const playBtn = q("playBtn");
const moveOneBtn = q("moveOneBtn");
const moveTwoBtn = q("moveTwoBtn");
const endTurnBtn = q("endTurnBtn");
const newShiftBtn = q("newShiftBtn");
const helpBtn = q("helpBtn");
const collectionBtn = q("collectionBtn");
const helpModal = q("helpModal");
const collectionModal = q("collectionModal");
const collectionList = q("collectionList");

const GW = gameCanvas.width;
const GH = gameCanvas.height;
const SAVE_KEY = "shift-deck-meta-v1";
const TIP_TARGET = 3;

const PALETTE = {
  ink: "#14261e",
  dark: "#244735",
  mid: "#6f8f50",
  light: "#c5d884",
  paper: "#eef2c2",
  gold: "#e0b64b",
  red: "#a83b36",
  blue: "#3d6684"
};

const ROLE_COLORS = {
  FOH: "#789b5b",
  BAR: "#5b8298",
  BOH: "#9a6e49",
  LEAD: "#8f657e"
};

const state = {
  screen: "title",
  player: null,
  rival: null,
  turn: "player",
  selectedHand: -1,
  busy: false,
  message: "",
  winner: null,
  frame: 0,
  floaters: [],
  flash: null,
  meta: loadMeta()
};

function loadMeta() {
  try {
    return Object.assign({ wins: 0, losses: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"));
  } catch {
    return { wins: 0, losses: 0 };
  }
}

function saveMeta() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.meta));
}

function cloneCard(id) {
  const base = SHIFT_CARD_LIBRARY[id];
  const card = JSON.parse(JSON.stringify(base));
  card.uid = `${id}-${Math.random().toString(36).slice(2, 9)}`;
  if (card.kind === "worker") {
    card.maxComposure = card.composure;
    card.currentComposure = card.composure;
  }
  return card;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeSide(name, deckList) {
  return {
    name,
    deck: shuffle(deckList.map(cloneCard)),
    hand: [],
    active: null,
    bench: [],
    discard: [],
    tips: 0,
    maxShift: 0,
    shift: 0,
    workerPlayed: false,
    customerPlayed: false,
    status: { guard: 0, surcharge: 0, silence: 0 },
    deckOut: false
  };
}

function drawCard(side, count = 1) {
  for (let i = 0; i < count; i++) {
    if (!side.deck.length) {
      const recycle = side.discard.filter(card => card.kind === "customer");
      if (recycle.length) {
        side.deck = shuffle(recycle);
        side.discard = side.discard.filter(card => card.kind !== "customer");
      }
    }
    if (!side.deck.length) {
      side.deckOut = true;
      continue;
    }
    side.hand.push(side.deck.pop());
  }
}

function guaranteeWorker(side) {
  if (side.hand.some(card => card.kind === "worker")) return;
  const index = side.deck.findIndex(card => card.kind === "worker");
  if (index >= 0) {
    const replacement = side.deck.splice(index, 1)[0];
    side.deck.unshift(side.hand.pop());
    side.hand.push(replacement);
  }
}

function autoSetOpeningWorker(side) {
  const activeIndex = side.hand.findIndex(card => card.kind === "worker");
  if (activeIndex >= 0) side.active = side.hand.splice(activeIndex, 1)[0];
  const benchIndex = side.hand.findIndex(card => card.kind === "worker");
  if (benchIndex >= 0) side.bench.push(side.hand.splice(benchIndex, 1)[0]);
}

function startNewShift() {
  state.player = makeSide("YOUR VENUE", SHIFT_PLAYER_DECK);
  state.rival = makeSide("RIVAL VENUE", SHIFT_AI_DECK);
  drawCard(state.player, 6);
  drawCard(state.rival, 6);
  guaranteeWorker(state.player);
  guaranteeWorker(state.rival);
  autoSetOpeningWorker(state.player);
  autoSetOpeningWorker(state.rival);
  state.screen = "battle";
  state.turn = "player";
  state.selectedHand = -1;
  state.busy = false;
  state.winner = null;
  state.floaters = [];
  state.flash = null;
  state.player.maxShift = 1;
  state.player.shift = 1;
  state.rival.maxShift = 0;
  state.rival.shift = 0;
  resetTurnFlags(state.player);
  setMessage("The doors are open. Your shift begins!");
  renderHand();
  updateControls();
}

function resetTurnFlags(side) {
  side.workerPlayed = false;
  side.customerPlayed = false;
}

function beginTurn(side, isPlayer) {
  if (state.winner) return;
  side.maxShift = Math.min(5, side.maxShift + 1);
  side.shift = side.maxShift;
  resetTurnFlags(side);
  drawCard(side, 1);
  if (!side.active) promoteWorker(side);
  if (side.deckOut && !side.active && !side.bench.length && !side.hand.some(c => c.kind === "worker")) {
    finishGame(isPlayer ? "rival" : "player", `${side.name} ran out of staff.`);
    return;
  }
  setMessage(isPlayer ? "Your turn — plan the service." : "The rival venue is making a move...");
  renderHand();
  updateControls();
}

function selectHand(index) {
  if (state.screen !== "battle" || state.turn !== "player" || state.busy) return;
  state.selectedHand = state.selectedHand === index ? -1 : index;
  renderHand();
  updateControls();
}

function playSelectedCard() {
  if (state.turn !== "player" || state.busy || state.selectedHand < 0) return;
  playCard(state.player, state.rival, state.selectedHand, true);
}

function playCard(side, opponent, handIndex, isPlayer) {
  const card = side.hand[handIndex];
  if (!card) return false;

  if (card.kind === "worker") {
    if (side.workerPlayed) {
      if (isPlayer) toast("You can roster only one worker each turn.");
      return false;
    }
    if (side.active && side.bench.length >= 2) {
      if (isPlayer) toast("Your active slot and bench are full.");
      return false;
    }
    side.hand.splice(handIndex, 1);
    if (!side.active) side.active = card;
    else side.bench.push(card);
    side.workerPlayed = true;
    setMessage(`${side.name} rostered ${card.name}.`);
  } else {
    if (side.customerPlayed) {
      if (isPlayer) toast("Only one customer card can be handled each turn.");
      return false;
    }
    side.hand.splice(handIndex, 1);
    side.discard.push(card);
    side.customerPlayed = true;
    applyCustomer(card, side, opponent);
  }

  if (isPlayer) state.selectedHand = -1;
  renderHand();
  updateControls();
  return true;
}

function applyCustomer(card, side, opponent) {
  const active = side.active;
  const enemy = opponent.active;
  switch (card.effect) {
    case "heal":
      if (active) healWorker(active, card.value);
      setMessage(`${card.name}: ${active ? active.name : "the team"} recovered composure.`);
      break;
    case "draw_shift":
      drawCard(side, 1);
      side.shift = Math.min(7, side.shift + card.value);
      setMessage(`${card.name}: an energetic table lifts the whole shift.`);
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
      setMessage(`${card.name}: the rival's next move costs extra.`);
      break;
    case "drain":
      opponent.shift = Math.max(0, opponent.shift - card.value);
      setMessage(`${card.name}: the rival loses ${card.value} Shift Points.`);
      break;
    case "spread":
      if (opponent.active) damageWorker(opponent.active, card.value, "rival");
      opponent.bench.forEach(worker => damageWorker(worker, card.value, "rival"));
      setMessage(`${card.name}: chaos spreads across the rival team.`);
      resolveKnockouts(opponent, side);
      break;
    case "silence":
      opponent.status.silence = Math.max(opponent.status.silence, card.value);
      setMessage(`${card.name}: the rival cannot use their second move next turn.`);
      break;
    case "heal_draw":
      if (active) healWorker(active, card.value);
      drawCard(side, 1);
      setMessage(`${card.name}: good vibes restore the team.`);
      break;
    case "both_stress":
      if (side.active) damageWorker(side.active, card.value, side === state.player ? "player" : "rival");
      if (opponent.active) damageWorker(opponent.active, card.value, side === state.player ? "rival" : "player");
      setMessage(`${card.name}: both venues take ${card.value} stress.`);
      resolveKnockouts(side, opponent);
      resolveKnockouts(opponent, side);
      break;
    case "shift":
      side.shift = Math.min(7, side.shift + card.value);
      setMessage(`${card.name}: gain ${card.value} Shift Points.`);
      break;
  }
  renderHand();
  updateControls();
}

function healWorker(worker, amount) {
  worker.currentComposure = Math.min(worker.maxComposure, worker.currentComposure + amount);
  addFloater(worker === state.player.active ? "player" : "rival", `+${amount}`, PALETTE.light);
}

function usePlayerMove(index) {
  if (state.turn !== "player" || state.busy) return;
  useMove(state.player, state.rival, index, true);
}

function useMove(side, opponent, index, isPlayer) {
  const worker = side.active;
  if (!worker || !worker.moves[index]) return false;
  if (index === 1 && side.status.silence > 0) {
    if (isPlayer) toast("A complaint has locked your second move this turn.");
    return false;
  }
  const move = worker.moves[index];
  const tax = side.status.surcharge > 0 ? side.status.surcharge : 0;
  const cost = move.cost + tax;
  if (side.shift < cost) {
    if (isPlayer) toast(`You need ${cost} Shift Points.`);
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
    if (opponent.active) damageActive(opponent, side, damage, move.name);
    if (move.heal) healWorker(worker, move.heal);
    if (move.draw) drawCard(side, move.draw);
    if (move.guard) side.status.guard += move.guard;
    renderHand();
    updateControls();
    setTimeout(() => endActionTurn(isPlayer), 650);
  }, 420);
  return true;
}

function roleMultiplier(attackerRole, defenderRole) {
  const chart = {
    FOH: { LEAD: 1.2 },
    BAR: { FOH: 1.2 },
    BOH: { BAR: 1.2 },
    LEAD: { BOH: 1.2 }
  };
  return (chart[attackerRole] && chart[attackerRole][defenderRole]) || 1;
}

function damageActive(targetSide, sourceSide, amount, sourceName) {
  if (!targetSide.active) return;
  let finalDamage = amount;
  if (targetSide.status.guard > 0) {
    const blockedAmount = Math.min(finalDamage, targetSide.status.guard);
    finalDamage -= blockedAmount;
    targetSide.status.guard -= blockedAmount;
  }
  damageWorker(targetSide.active, finalDamage, targetSide === state.player ? "player" : "rival");
  setMessage(`${sourceName} caused ${finalDamage} stress.`);
  resolveKnockouts(targetSide, sourceSide);
}

function damageWorker(worker, amount, sideKey) {
  if (!worker || amount <= 0) return;
  worker.currentComposure = Math.max(0, worker.currentComposure - amount);
  addFloater(sideKey, `-${amount}`, PALETTE.red);
  state.flash = { side: sideKey, life: 14 };
}

function addFloater(side, text, color) {
  state.floaters.push({ side, text, color, life: 50, rise: 0 });
}

function resolveKnockouts(targetSide, sourceSide) {
  targetSide.bench = targetSide.bench.filter(worker => {
    if (worker.currentComposure > 0) return true;
    targetSide.discard.push(worker);
    return false;
  });

  if (targetSide.active && targetSide.active.currentComposure <= 0) {
    const defeated = targetSide.active;
    targetSide.discard.push(defeated);
    targetSide.active = null;
    sourceSide.tips += 1;
    setMessage(`${defeated.name} was SENT ON BREAK! ${sourceSide.name} gains a Tip.`);
    if (sourceSide.tips >= TIP_TARGET) {
      finishGame(sourceSide === state.player ? "player" : "rival", `${sourceSide.name} collected ${TIP_TARGET} Tips.`);
      return;
    }
    promoteWorker(targetSide);
    if (!targetSide.active) {
      finishGame(sourceSide === state.player ? "player" : "rival", `${targetSide.name} ran out of available workers.`);
    }
  }
}

function promoteWorker(side) {
  if (side.bench.length) {
    side.active = side.bench.shift();
    setMessage(`${side.active.name} steps in from the bench.`);
    return true;
  }
  const handIndex = side.hand.findIndex(card => card.kind === "worker");
  if (handIndex >= 0) {
    side.active = side.hand.splice(handIndex, 1)[0];
    setMessage(`${side.active.name} is called onto the shift.`);
    return true;
  }
  return false;
}

function endPlayerTurn() {
  if (state.turn !== "player" || state.busy || state.winner) return;
  state.busy = true;
  endActionTurn(true);
}

function endActionTurn(wasPlayer) {
  if (state.winner) return;
  const endingSide = wasPlayer ? state.player : state.rival;
  if (endingSide.status.silence > 0) endingSide.status.silence -= 1;
  if (endingSide.status.surcharge > 0) endingSide.status.surcharge = 0;
  state.turn = wasPlayer ? "rival" : "player";
  state.busy = false;
  state.selectedHand = -1;
  renderHand();
  updateControls();
  if (state.turn === "rival") {
    beginTurn(state.rival, false);
    setTimeout(runAiTurn, 750);
  } else {
    beginTurn(state.player, true);
  }
}

function runAiTurn() {
  if (state.winner || state.turn !== "rival") return;
  state.busy = true;

  if (!state.rival.active) promoteWorker(state.rival);

  const workerIndex = state.rival.hand.findIndex(card => card.kind === "worker");
  if (!state.rival.workerPlayed && workerIndex >= 0 && (!state.rival.active || state.rival.bench.length < 2)) {
    playCard(state.rival, state.player, workerIndex, false);
  }

  const customerIndex = chooseAiCustomer();
  if (customerIndex >= 0) playCard(state.rival, state.player, customerIndex, false);

  setTimeout(() => {
    const worker = state.rival.active;
    if (!worker) {
      state.busy = false;
      endActionTurn(false);
      return;
    }
    const legal = worker.moves
      .map((move, index) => ({ move, index, cost: move.cost + state.rival.status.surcharge }))
      .filter(item => item.cost <= state.rival.shift && !(item.index === 1 && state.rival.status.silence > 0))
      .sort((a, b) => b.move.damage - a.move.damage);
    state.busy = false;
    if (legal.length) useMove(state.rival, state.player, legal[0].index, false);
    else endActionTurn(false);
  }, 700);
}

function chooseAiCustomer() {
  if (state.rival.customerPlayed) return -1;
  const hand = state.rival.hand;
  const priorities = [];
  hand.forEach((card, index) => {
    if (card.kind !== "customer") return;
    let score = 1;
    if (card.effect === "heal" && state.rival.active && state.rival.active.currentComposure < state.rival.active.maxComposure * .55) score = 9;
    if (card.effect === "heal_draw" && state.rival.active && state.rival.active.currentComposure < state.rival.active.maxComposure * .75) score = 8;
    if (card.effect === "stress" && state.player.active && state.player.active.currentComposure <= card.value + 8) score = 10;
    if (card.effect === "spread" && state.player.bench.length) score = 7;
    if (card.effect === "draw" && state.rival.hand.length < 4) score = 6;
    if (card.effect === "draw_shift" || card.effect === "shift") score = 5;
    if (card.effect === "silence" || card.effect === "surcharge") score = 4;
    priorities.push({ index, score });
  });
  priorities.sort((a,b)=>b.score-a.score);
  return priorities.length && priorities[0].score >= 4 ? priorities[0].index : -1;
}

function finishGame(winner, reason) {
  state.winner = winner;
  state.busy = false;
  state.screen = "result";
  if (winner === "player") state.meta.wins += 1;
  else state.meta.losses += 1;
  saveMeta();
  setMessage(reason);
  renderHand();
  updateControls();
}

function setMessage(text) {
  state.message = text;
  toast(text);
}

let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1900);
}

function renderHand() {
  if (!state.player || state.screen === "title") {
    handEl.innerHTML = "";
    return;
  }
  handEl.innerHTML = state.player.hand.map((card, index) => {
    const selected = index === state.selectedHand ? " selected" : "";
    const typeClass = card.kind === "worker" ? "worker" : "customer";
    const detail = card.kind === "worker"
      ? `${card.role} · ${card.currentComposure}/${card.maxComposure} CP<br>${card.moves[0].name} / ${card.moves[1].name}`
      : `${card.category}<br>${card.text}`;
    const cost = card.kind === "worker" ? "W" : "C";
    return `<button class="hand-card ${typeClass}${selected}" data-hand="${index}"><span class="cost">${cost}</span><span class="kind">${card.kind.toUpperCase()}</span><h3>${card.name}</h3><p>${detail}</p></button>`;
  }).join("");
  handEl.querySelectorAll("[data-hand]").forEach(button => button.addEventListener("click", () => selectHand(Number(button.dataset.hand))));
}

function updateControls() {
  const battle = state.screen === "battle" && !state.winner;
  const playerTurn = battle && state.turn === "player" && !state.busy;
  const selected = state.player && state.player.hand[state.selectedHand];
  playBtn.disabled = !playerTurn || !selected;
  playBtn.textContent = selected ? `PLAY ${selected.kind === "worker" ? "WORKER" : "CUSTOMER"}` : "PLAY CARD";

  const active = state.player && state.player.active;
  const moveOne = active && active.moves[0];
  const moveTwo = active && active.moves[1];
  const tax = state.player ? state.player.status.surcharge : 0;
  moveOneBtn.textContent = moveOne ? `${moveOne.name} (${moveOne.cost + tax})` : "MOVE 1";
  moveTwoBtn.textContent = moveTwo ? `${moveTwo.name} (${moveTwo.cost + tax})` : "MOVE 2";
  moveOneBtn.disabled = !playerTurn || !moveOne || state.player.shift < moveOne.cost + tax;
  moveTwoBtn.disabled = !playerTurn || !moveTwo || state.player.shift < moveTwo.cost + tax || state.player.status.silence > 0;
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
}
