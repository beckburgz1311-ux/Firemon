"use strict";

const SHIFT_BASIC_SP_COST = 1;
const SHIFT_SPECIAL_TIP_COST = 1;

const SHIFT_ATTACK_UPGRADES = {
  server: [
    { name: "Check Back", damage: 11, text: "A quick, reliable service check." },
    { name: "Perfect Upsell", damage: 24, draw: 1, text: "Heavy stress and draw a card." }
  ],
  bartender: [
    { name: "Clean Pour", damage: 13, text: "Fast bar pressure with no waste." },
    { name: "Flaming Finish", damage: 31, guard: 4, text: "Big stress and a small guard." }
  ],
  chef: [
    { name: "Call The Pass", damage: 15, text: "Keep the whole kitchen moving." },
    { name: "Send The Rail", damage: 36, text: "A full-force special from the pass." }
  ],
  host: [
    { name: "Warm Welcome", damage: 9, heal: 4, text: "Stress plus composure recovery." },
    { name: "Perfect Table Turn", damage: 25, draw: 1, text: "Strong pressure and draw a card." }
  ],
  runner: [
    { name: "Hands Full", damage: 14, text: "Fast pressure from the pass." },
    { name: "Clear And Reset", damage: 22, draw: 2, text: "Stress plus two drawn cards." }
  ],
  kp: [
    { name: "Pot Wash", damage: 9, guard: 6, text: "Stress plus guard." },
    { name: "Deep Clean", damage: 28, heal: 6, text: "Heavy stress and recovery." }
  ],
  supervisor: [
    { name: "Section Check", damage: 13, text: "Reliable leadership pressure." },
    { name: "Rally The Floor", damage: 23, heal: 12, text: "Damage and recover composure." }
  ],
  manager: [
    { name: "De-escalate", damage: 8, heal: 10, text: "Calm the situation and recover." },
    { name: "Service Recovery", damage: 33, guard: 10, text: "Big pressure and strong guard." }
  ]
};

Object.entries(SHIFT_ATTACK_UPGRADES).forEach(([id, moves]) => {
  if (!SHIFT_CARD_LIBRARY[id]) return;
  SHIFT_CARD_LIBRARY[id].moves = moves.map((move, index) => ({
    ...move,
    cost: SHIFT_BASIC_SP_COST,
    special: index === 1
  }));
});

const shiftV3OriginalStartNewShift = startNewShift;
startNewShift = function startNewShiftV3() {
  shiftV3OriginalStartNewShift();
  state.player.turnsPlayed = 1;
  state.rival.turnsPlayed = 0;
  setMessage("Every third turn earns a Tip.");
  renderHand();
  updateControls();
};

function turnsUntilTip(side) {
  const turns = side && Number.isFinite(side.turnsPlayed) ? side.turnsPlayed : 0;
  const remainder = turns % 3;
  return remainder === 0 && turns > 0 ? 3 : 3 - remainder;
}

function awardScheduledTip(side, isPlayer) {
  side.turnsPlayed = (side.turnsPlayed || 0) + 1;
  if (side.turnsPlayed % 3 !== 0) return false;
  side.tips += 1;
  setMessage(`${isPlayer ? "You gain" : "The rival gains"} 1 Tip for three completed turns.`);
  if (side.tips >= TIP_TARGET) {
    finishGame(isPlayer ? "player" : "rival", `${side.name} collected ${TIP_TARGET} Tips.`);
  }
  return true;
}

beginTurn = function beginTurnV3(side, isPlayer) {
  if (state.winner) return;
  side.maxShift = Math.min(6, side.maxShift + 1);
  side.shift = side.maxShift;
  drawCard(side, 1);
  if (!side.active) promoteWorker(side);

  if (side.deckOut && !side.active && !side.bench.length && !side.hand.some(card => card.kind === "worker")) {
    finishGame(isPlayer ? "rival" : "player", `${side.name} ran out of staff.`);
    return;
  }

  const earnedTip = awardScheduledTip(side, isPlayer);
  if (state.winner) return;
  if (!earnedTip) {
    const wait = turnsUntilTip(side);
    setMessage(isPlayer
      ? `Your turn — ${side.shift} SP. Tip in ${wait} turn${wait === 1 ? "" : "s"}.`
      : "The rival venue is making a move...");
  }
  renderHand();
  updateControls();
};
