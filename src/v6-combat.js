function fire() {
  if (state.paused || state.battle) return;
  if (state.player.ammo <= 0) { notify("EMPTY. Find ammo crates in a later build."); return; }
  state.player.ammo--; state.muzzle = 1;
  let hit = null, bestDist = Infinity;
  for (const m of state.monsters) {
    if (!m.alive) continue;
    const dx = m.x - state.player.x, dy = m.y - state.player.y;
    const dist = Math.hypot(dx, dy), angle = Math.abs(normAngle(Math.atan2(dy, dx) - state.player.angle));
    const tolerance = .08 + .18 / Math.max(1, dist);
    if (angle < tolerance && dist < bestDist && hasLineOfSight(state.player.x, state.player.y, m.x, m.y)) { hit = m; bestDist = dist; }
  }
  if (hit) {
    const damage = 5 + Math.floor(Math.random() * 5);
    hit.hp = Math.max(1, hit.hp - damage); hit.hit = 1; hit.stagger = .35;
    state.damageNumbers.push({ x: hit.x, y: hit.y, value: damage, life: .9, maxLife: .9, rise: 0, critical: damage >= 9 });
    notify(`${species[hit.species].name} -${damage} HP`);
    for (let i=0;i<6;i++) state.particles.push({x:hit.x,y:hit.y,vx:(Math.random()-.5),vy:(Math.random()-.5),life:.25});
  }
  updateHud(); acquireTarget();
}

function quickCapture() {
  if (state.paused || state.battle) return;
  const m = state.target;
  if (!m) { notify("AIM AT A FIREMON."); return; }
  if (state.player.caps <= 0) { notify("NO CAPTURE CAPSULES."); return; }
  const ratio = m.hp / m.maxHp;
  if (ratio > .4) { notify("WEAKEN IT FIRST."); return; }
  state.player.caps--;
  const chance = .35 + (1 - ratio) * .55;
  if (Math.random() < chance) captureMonster(m, false);
  else { notify("IT BROKE FREE!"); m.cooldown = .2; }
  updateHud(); saveGame(false);
}

function startBattle() {
  if (state.paused || state.battle) return;
  const m = state.target;
  if (!m) { notify("AIM AT A NEARBY FIREMON."); return; }
  if (Math.hypot(m.x - state.player.x, m.y - state.player.y) > 5) { notify("GET CLOSER TO DUEL."); return; }
  const ally = state.team[state.activeIndex];
  if (!ally || ally.hp <= 0) { notify("NO BATTLE-READY FIREMON."); return; }
  state.battle = { enemy: m, ally, busy: false, guarding: false };
  state.paused = true;
  ui.battleOverlay.classList.remove("hidden");
  ui.battleLog.textContent = `Wild ${species[m.species].name} challenges ${ally.name}!`;
  renderBattleSprites(); updateBattleUI();
}

function battleMove(kind) {
  const b = state.battle;
  if (!b || b.busy) return;
  if (kind === "flee") { endBattle("You escaped the duel."); return; }
  if (kind === "capture") {
    if (state.player.caps <= 0) { ui.battleLog.textContent = "No capture capsules!"; return; }
    b.busy = true; state.player.caps--;
    const ratio = b.enemy.hp / b.enemy.maxHp;
    const chance = Math.min(.92, .2 + (1-ratio)*.72);
    ui.battleLog.textContent = "Capsule launched...";
    setTimeout(() => {
      if (Math.random() < chance) captureMonster(b.enemy, true);
      else { ui.battleLog.textContent = `${species[b.enemy.species].name} broke free!`; setTimeout(enemyBattleTurn, 650); }
      updateHud();
    }, 800);
    return;
  }

  b.busy = true;
  if (kind === "guard") {
    b.guarding = true; ui.battleLog.textContent = `${b.ally.name} braces for impact.`;
    setTimeout(enemyBattleTurn, 650); return;
  }

  const allySpec = species[b.ally.species], enemySpec = species[b.enemy.species];
  const mult = kind === "skill" ? effectiveness(allySpec.type, enemySpec.type) : 1;
  const damage = Math.max(2, Math.floor((allySpec.power + b.ally.level * .7 + Math.random()*4) * (kind === "skill" ? 1.25 : 1) * mult));
  b.enemy.hp = Math.max(0, b.enemy.hp - damage);
  const moveName = kind === "skill" ? allySpec.skill : "RIP CLAW";
  ui.battleLog.textContent = `${b.ally.name} used ${moveName}! ${damage} damage${mult>1?" — SUPER!":mult<1?" — resisted.":"."}`;
  updateBattleUI(); flashBattle(ui.enemyBattleSprite);
  if (b.enemy.hp <= 0) setTimeout(battleVictory, 750); else setTimeout(enemyBattleTurn, 850);
}

function enemyBattleTurn() {
  const b = state.battle;
  if (!b) return;
  const enemySpec = species[b.enemy.species], allySpec = species[b.ally.species];
  const mult = effectiveness(enemySpec.type, allySpec.type);
  let damage = Math.max(1, Math.floor((enemySpec.power + b.enemy.level*.55 + Math.random()*3) * mult));
  if (b.guarding) damage = Math.max(1, Math.floor(damage * .45));
  b.ally.hp = Math.max(0, b.ally.hp - damage);
  ui.battleLog.textContent = `${enemySpec.name} used ${enemySpec.skill}! ${damage} damage.`;
  b.guarding = false; updateBattleUI(); flashBattle(ui.allyBattleSprite);
  if (b.ally.hp <= 0) {
    setTimeout(() => {
      ui.battleLog.textContent = `${b.ally.name} was defeated. You were forced back.`;
      state.player.hp = Math.max(1, state.player.hp - 15);
      setTimeout(() => endBattle("Retreat! Choose another Firemon."), 900);
    }, 650);
  } else b.busy = false;
}

function battleVictory() {
  const b = state.battle;
  if (!b) return;
  const gain = 8 + b.enemy.level * 3;
  b.ally.xp += gain; b.enemy.alive = false;
  if (b.ally.xp >= b.ally.level * 18) {
    b.ally.xp = 0; b.ally.level++; b.ally.maxHp += 5; b.ally.hp = b.ally.maxHp;
    ui.battleLog.textContent = `${b.ally.name} won and reached LV ${b.ally.level}!`;
  } else ui.battleLog.textContent = `${b.ally.name} won the duel and gained ${gain} XP.`;
  setTimeout(() => endBattle("Victory."), 1000);
}

function captureMonster(m, fromBattle) {
  const s = species[m.species];
  if (state.team.length >= 6) {
    if (fromBattle) endBattle("TEAM FULL — THE FIREMON ESCAPED.");
    else notify("TEAM FULL — CHOOSE YOUR SIX.");
    return;
  }
  state.team.push({ species: m.species, name: s.name, level: m.level, xp: 0, hp: m.maxHp, maxHp: m.maxHp });
  m.alive = false;
  if (fromBattle) {
    ui.battleLog.textContent = `${s.name} WAS CAPTURED!`;
    setTimeout(() => endBattle(`${s.name} joined your team.`), 1000);
  } else notify(`${s.name} CAPTURED!`);
  renderTeam(); saveGame(false);
}

function effectiveness(attacking, defending) {
  return (typeChart[attacking] && typeChart[attacking][defending]) || 1;
}

function endBattle(message) {
  ui.battleOverlay.classList.add("hidden");
  state.battle = null; state.paused = false;
  notify(message); updateHud(); renderTeam(); saveGame(false);
}

function renderBattleSprites() {
  const b = state.battle;
  if (!b) return;
  drawSpriteTo(ui.enemyBattleSprite, b.enemy.species, false);
  drawSpriteTo(ui.allyBattleSprite, b.ally.species, true);
}

function drawSpriteTo(canvasEl, id, back) {
  const g = canvasEl.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0,0,96,96);
  g.drawImage(buildMonsterSprite(id, back), 0, 0, 96, 96);
}

function flashBattle(el) {
  el.animate([{filter:"brightness(3)"},{filter:"brightness(1)"}],{duration:260});
}

function updateBattleUI() {
  const b = state.battle; if (!b) return;
  const es = species[b.enemy.species];
  ui.battleTitle.textContent = `WILD ${es.name}`;
  ui.enemyBattleName.textContent = es.name; ui.enemyBattleLevel.textContent = `LV ${b.enemy.level}`;
  ui.enemyBattleHp.textContent = `${b.enemy.hp} / ${b.enemy.maxHp}`;
  ui.enemyBattleBar.style.width = `${b.enemy.hp/b.enemy.maxHp*100}%`;
  ui.allyBattleName.textContent = b.ally.name; ui.allyBattleLevel.textContent = `LV ${b.ally.level}`;
  ui.allyBattleHp.textContent = `${b.ally.hp} / ${b.ally.maxHp}`;
  ui.allyBattleBar.style.width = `${b.ally.hp/b.ally.maxHp*100}%`;
}

function renderTeam() {
  ui.teamList.innerHTML = state.team.map((m,i)=>{
    const s=species[m.species];
    return `<article class="team-card ${i===state.activeIndex?"active":""}">
      <canvas width="32" height="32" data-sprite="${m.species}"></canvas>
      <div><h3>${m.name}</h3><p>${s.type} · LV ${m.level}<br>HP ${m.hp}/${m.maxHp} · XP ${m.xp}/${m.level*18}</p>
      <button class="pixel-btn small" data-select="${i}">${i===state.activeIndex?"ACTIVE":"SELECT"}</button></div>
    </article>`;
  }).join("");
  ui.teamList.querySelectorAll("canvas[data-sprite]").forEach(c=>{const g=c.getContext("2d");g.imageSmoothingEnabled=false;g.drawImage(buildMonsterSprite(c.dataset.sprite),0,0,32,32)});
  ui.teamList.querySelectorAll("[data-select]").forEach(btn=>btn.addEventListener("click",()=>{
    const i=Number(btn.dataset.select); if(state.team[i].hp<=0){notify("THAT FIREMON HAS FAINTED.");return;}
    state.activeIndex=i; renderTeam(); notify(`${state.team[i].name} is now active.`); saveGame(false);
  }));
}

function updateHud() {
  ui.hp.textContent = state.player.hp; ui.ammo.textContent = state.player.ammo; ui.caps.textContent = state.player.caps;
}

function updateTargetHud() {
  const m=state.target;
  if(!m){ui.targetName.textContent="NO TARGET";ui.targetBar.style.width="0%";return;}
  ui.targetName.textContent=`${species[m.species].name} LV${m.level}`;
  ui.targetBar.style.width=`${m.hp/m.maxHp*100}%`;
}

let msgTimer;
function notify(text) {
  ui.message.textContent=text;ui.message.classList.add("show");clearTimeout(msgTimer);msgTimer=setTimeout(()=>ui.message.classList.remove("show"),1700);
}

function saveGame(show=true) {
  const data={player:state.player,team:state.team,activeIndex:state.activeIndex,active:state.activeIndex,monsters:state.monsters.map(m=>({id:m.id,hp:m.hp,alive:m.alive,x:m.x,y:m.y}))};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data)); if(show)notify("GAME SAVED.");
}

function loadGame() {
  try {
    const raw=localStorage.getItem(SAVE_KEY); if(!raw)return;
    const data=JSON.parse(raw); Object.assign(state.player,data.player||{});
    ensureSafePlayerPosition();
    if(Array.isArray(data.team)&&data.team.length)state.team=data.team;
    const savedActive = Number.isInteger(data.activeIndex) ? data.activeIndex : (Number.isInteger(data.active) ? data.active : 0);
    state.activeIndex=Math.min(savedActive,state.team.length-1);
    const saved=new Map((data.monsters||[]).map(m=>[m.id,m]));
    state.monsters.forEach(m=>{const s=saved.get(m.id);if(s)Object.assign(m,s)});
  } catch(e){console.warn(e)}
}
