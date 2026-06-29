"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const $ = id => document.getElementById(id);
const ui = {
  hp: $("hpText"), ammo: $("ammoText"), caps: $("capsText"),
  targetBox: $("targetBox"), targetName: $("targetName"), targetBar: $("targetBar"),
  message: $("message"), battleOverlay: $("battleOverlay"), battleTitle: $("battleTitle"),
  enemyBattleName: $("enemyBattleName"), enemyBattleLevel: $("enemyBattleLevel"),
  enemyBattleBar: $("enemyBattleBar"), enemyBattleHp: $("enemyBattleHp"),
  allyBattleName: $("allyBattleName"), allyBattleLevel: $("allyBattleLevel"),
  allyBattleBar: $("allyBattleBar"), allyBattleHp: $("allyBattleHp"),
  enemyBattleSprite: $("enemyBattleSprite"), allyBattleSprite: $("allyBattleSprite"),
  battleLog: $("battleLog"), teamOverlay: $("teamOverlay"), teamList: $("teamList"),
  helpOverlay: $("helpOverlay")
};

const W = canvas.width;
const H = canvas.height;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 18;
const SAVE_KEY = "firemon-v5-save";
const MAX_AMMO = 30;
const SAFE_SPAWN = { x: 1.5, y: 1.5, angle: 0 };

const map = [
  "1111111111111111",
  "1000000000000001",
  "1022200111110001",
  "1000200100010001",
  "1000200100010001",
  "1000000100010001",
  "1110111100011101",
  "1000100000000001",
  "1000103330110001",
  "1000000030010001",
  "1011111030010001",
  "1000000030000001",
  "1000111111101101",
  "1000000000000001",
  "1000000000000001",
  "1111111111111111"
];

const species = {
  cinderling: { name: "CINDERLING", type: "FIRE", maxHp: 34, power: 7, skill: "EMBER FANG", colors: ["#35100d", "#8c291f", "#f05b35", "#ffb342", "#fff1bc"] },
  ashmaw: { name: "ASHMAW", type: "FIRE", maxHp: 28, power: 6, skill: "ASH BITE", colors: ["#281312", "#63332d", "#b64934", "#ef7d43", "#ffcf83"] },
  mossfiend: { name: "MOSSFIEND", type: "GROVE", maxHp: 36, power: 5, skill: "THORN LASH", colors: ["#102317", "#245232", "#438653", "#8bbf5c", "#e0ef9d"] },
  tidejaw: { name: "TIDEJAW", type: "TIDE", maxHp: 31, power: 6, skill: "RIP CURRENT", colors: ["#0b1c2a", "#153f5b", "#24789a", "#5fc7c9", "#d8ffff"] },
  voltusk: { name: "VOLTUSK", type: "VOLT", maxHp: 27, power: 8, skill: "ARC RUSH", colors: ["#29200b", "#6f5a13", "#c89d21", "#ffd74a", "#fff9b0"] },
  stonehorn: { name: "STONEHORN", type: "STONE", maxHp: 42, power: 5, skill: "FAULT CHARGE", colors: ["#1d1b1a", "#4c4945", "#77736d", "#aaa297", "#e0d5c2"] },
  sporeimp: { name: "SPOREIMP", type: "SPORE", maxHp: 29, power: 6, skill: "DREAM DUST", colors: ["#211125", "#562a60", "#954a93", "#d77cab", "#ffd1db"] }
};

const typeChart = {
  FIRE: { GROVE: 1.5, TIDE: 0.7, STONE: 0.8 },
  GROVE: { TIDE: 1.5, FIRE: 0.7, SPORE: 0.8 },
  TIDE: { FIRE: 1.5, GROVE: 0.7, VOLT: 0.7 },
  VOLT: { TIDE: 1.5, STONE: 0.6 },
  STONE: { VOLT: 1.5, FIRE: 1.2 },
  SPORE: { GROVE: 1.3 }
};

const state = {
  player: { x: SAFE_SPAWN.x, y: SAFE_SPAWN.y, angle: SAFE_SPAWN.angle, hp: 100, maxHp: 100, ammo: 30, caps: 3 },
  move: { x: 0, y: 0 }, keys: new Set(),
  monsters: [], projectiles: [], particles: [], damageNumbers: [], depth: new Float32Array(W),
  team: [{ species: "cinderling", name: "CINDERLING", level: 5, xp: 0, hp: 46, maxHp: 46 }],
  activeIndex: 0, target: null, battle: null, paused: false, last: performance.now(), time: 0,
  muzzle: 0, hurtFlash: 0, bob: 0, dangerTimer: 0,
  regen: { hp: 0, ammo: 0 }
};

const spriteCache = new Map();

function buildMonsterSprite(id, back = false) {
  const key = `${id}:${back}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const p = species[id].colors;
  const px = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };

  px(7, 27, 18, 3, "rgba(0,0,0,.45)");
  px(8, 22, 5, 6, p[1]); px(20, 22, 5, 6, p[1]);
  px(9, 25, 5, 3, p[0]); px(19, 25, 6, 3, p[0]);
  px(7, 12, 19, 13, p[1]); px(9, 10, 15, 15, p[2]); px(12, 13, 10, 9, p[3]);
  px(8, 5, 17, 12, p[2]); px(10, 3, 13, 13, p[3]);
  px(7, 2, 5, 7, p[1]); px(22, 2, 5, 7, p[1]);
  px(8, 1, 3, 5, p[4]); px(23, 1, 3, 5, p[4]);
  px(12, 11, 10, 6, p[4]); px(14, 14, 6, 3, p[1]);
  if (!back) {
    px(11, 8, 4, 4, "#fff8cf"); px(20, 8, 4, 4, "#fff8cf");
    px(13, 9, 2, 3, "#130808"); px(20, 9, 2, 3, "#130808");
    px(13, 9, 1, 1, "#ff4f35"); px(21, 9, 1, 1, "#ff4f35");
  } else {
    px(10, 6, 13, 5, p[1]);
  }
  if (id === "cinderling" || id === "ashmaw") { px(15, 0, 4, 5, "#ffdb4b"); px(16, 0, 2, 3, "#fff7ae"); }
  if (id === "mossfiend") { px(4, 10, 6, 4, p[3]); px(23, 9, 6, 5, p[3]); px(14, 0, 5, 5, p[4]); }
  if (id === "tidejaw") { px(3, 13, 7, 4, p[3]); px(24, 13, 6, 4, p[3]); px(15, 0, 4, 6, p[4]); }
  if (id === "voltusk") { px(4, 8, 7, 3, p[4]); px(23, 8, 6, 3, p[4]); px(15, 0, 3, 6, p[4]); }
  if (id === "stonehorn") { px(4, 5, 7, 5, p[3]); px(23, 5, 6, 5, p[3]); px(14, 0, 6, 5, p[4]); }
  if (id === "sporeimp") { px(6, 2, 22, 7, p[3]); px(10, 0, 14, 5, p[4]); }

  spriteCache.set(key, c);
  return c;
}

function newMonster(id, x, y, level) {
  const s = species[id];
  const maxHp = s.maxHp + level * 3;
  return { id: `${id}-${x}-${y}`, species: id, x, y, level, hp: maxHp, maxHp, alive: true, cooldown: 1 + Math.random() * 2, hit: 0, stagger: 0 };
}

function seedMonsters() {
  state.monsters = [
    newMonster("ashmaw", 5.5, 2.5, 2), newMonster("mossfiend", 12.5, 2.5, 3),
    newMonster("tidejaw", 6.5, 8.5, 4), newMonster("voltusk", 13.5, 8.5, 5),
    newMonster("stonehorn", 3.5, 13.5, 5), newMonster("sporeimp", 11.5, 13.5, 4),
    newMonster("ashmaw", 14.0, 11.0, 6)
  ];
}

function wallAt(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) return "1";
  return map[my][mx];
}

function blocked(x, y, radius = .18) {
  return wallAt(x - radius, y - radius) !== "0" || wallAt(x + radius, y - radius) !== "0" ||
    wallAt(x - radius, y + radius) !== "0" || wallAt(x + radius, y + radius) !== "0";
}

function moveToSafeSpawn() {
  state.player.x = SAFE_SPAWN.x;
  state.player.y = SAFE_SPAWN.y;
  state.player.angle = SAFE_SPAWN.angle;
}

function ensureSafePlayerPosition() {
  if (!Number.isFinite(state.player.x) || !Number.isFinite(state.player.y) || blocked(state.player.x, state.player.y)) {
    moveToSafeSpawn();
    return false;
  }
  return true;
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function hasLineOfSight(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (wallAt(ax + dx * t, ay + dy * t) !== "0") return false;
  }
  return true;
}
