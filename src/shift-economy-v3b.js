useMove = function useMoveV3(side, opponent, index, isPlayer) {
  const worker = side.active;
  if (!worker || !worker.moves[index]) return false;
  const move = worker.moves[index];
  const isSpecial = index === 1;

  if (isSpecial && side.status.silence > 0) {
    if (isPlayer) toast("A complaint has locked your special move this turn.");
    return false;
  }

  const tax = side.status.surcharge > 0 ? side.status.surcharge : 0;
  const spCost = SHIFT_BASIC_SP_COST + tax;
  if (side.shift < spCost) {
    if (isPlayer) toast(`You need ${spCost} Shift Point${spCost === 1 ? "" : "s"} to attack.`);
    return false;
  }
  if (isSpecial && side.tips < SHIFT_SPECIAL_TIP_COST) {
    if (isPlayer) toast("The red special needs 1 Tip.");
    return false;
  }

  side.shift -= spCost;
  if (isSpecial) side.tips -= SHIFT_SPECIAL_TIP_COST;
  side.status.surcharge = 0;
  state.busy = true;

  const roleBonus = roleMultiplier(worker.role, opponent.active ? opponent.active.role : "");
  const damage = Math.max(0, Math.round(move.damage * roleBonus));
  const label = roleBonus > 1 ? " SUPER EFFECTIVE!" : "";
  setMessage(`${worker.name} used ${move.name}!${label}`);

  setTimeout(() => {
    if (typeof triggerAttackShake === "function") triggerAttackShake();
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

runAiTurn = function runAiTurnV3() {
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
  while (plays < 3 && state.rival.shift > SHIFT_BASIC_SP_COST && !state.winner) {
    const index = chooseAiAffordableCard(true);
    if (index < 0) break;
    if (!playCard(state.rival, state.player, index, false)) break;
    plays += 1;
  }

  setTimeout(() => {
    const worker = state.rival.active;
    if (!worker || state.rival.shift < SHIFT_BASIC_SP_COST) {
      state.busy = false;
      endActionTurn(false);
      return;
    }

    let moveIndex = 0;
    if (state.rival.tips >= SHIFT_SPECIAL_TIP_COST && state.rival.status.silence <= 0) {
      const special = worker.moves[1];
      const basic = worker.moves[0];
      const canFinish = state.player.active && state.player.active.currentComposure <= special.damage;
      if (canFinish || special.damage >= basic.damage * 1.55 || Math.random() < .35) moveIndex = 1;
    }

    state.busy = false;
    useMove(state.rival, state.player, moveIndex, false);
  }, 650);
};
