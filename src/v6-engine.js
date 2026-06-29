function update(dt) {
  state.time += dt;
  state.muzzle = Math.max(0, state.muzzle - dt * 8);
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2.5);
  state.particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; });
  state.particles = state.particles.filter(p => p.life > 0);
  state.damageNumbers.forEach(n => { n.life -= dt; n.rise += dt * .42; });
  state.damageNumbers = state.damageNumbers.filter(n => n.life > 0);
  state.dangerTimer = Math.max(0, state.dangerTimer - dt);
  if (state.paused || state.battle) return;

  let forward = state.move.y * -1;
  let strafe = state.move.x;
  if (state.keys.has("w")) forward += 1;
  if (state.keys.has("s")) forward -= 1;
  if (state.keys.has("a")) strafe -= 1;
  if (state.keys.has("d")) strafe += 1;
  if (state.keys.has("arrowleft")) state.player.angle -= dt * 1.7;
  if (state.keys.has("arrowright")) state.player.angle += dt * 1.7;

  const mag = Math.hypot(forward, strafe);
  if (mag > .01) {
    forward /= Math.max(1, mag); strafe /= Math.max(1, mag);
    const speed = 2.2 * dt;
    const dx = Math.cos(state.player.angle) * forward * speed + Math.cos(state.player.angle + Math.PI / 2) * strafe * speed;
    const dy = Math.sin(state.player.angle) * forward * speed + Math.sin(state.player.angle + Math.PI / 2) * strafe * speed;
    if (!blocked(state.player.x + dx, state.player.y)) state.player.x += dx;
    if (!blocked(state.player.x, state.player.y + dy)) state.player.y += dy;
    state.bob += dt * 11;
  }

  for (const m of state.monsters) {
    if (!m.alive) continue;
    m.hit = Math.max(0, m.hit - dt * 5);
    m.stagger = Math.max(0, m.stagger - dt);
    const dx = state.player.x - m.x, dy = state.player.y - m.y;
    const dist = Math.hypot(dx, dy);
    m.cooldown -= dt;
    if (dist < 7 && hasLineOfSight(m.x, m.y, state.player.x, state.player.y)) {
      state.dangerTimer = Math.max(state.dangerTimer, 1.5);
      if (dist > 1.6 && m.stagger <= 0) {
        const step = .25 * dt;
        const nx = m.x + dx / dist * step, ny = m.y + dy / dist * step;
        if (!blocked(nx, m.y, .2)) m.x = nx;
        if (!blocked(m.x, ny, .2)) m.y = ny;
      }
      if (m.cooldown <= 0 && dist < 5.5) {
        enemyFieldAttack(m, dist);
        m.cooldown = 2.2 + Math.random() * 1.5;
      }
    }
  }

  state.projectiles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (wallAt(p.x, p.y) !== "0") p.life = 0;
    if (Math.hypot(p.x - state.player.x, p.y - state.player.y) < .28) {
      p.life = 0; hurtPlayer(p.damage);
    }
  });
  state.projectiles = state.projectiles.filter(p => p.life > 0);

  if (state.dangerTimer <= 0) {
    state.regen.hp += dt;
    state.regen.ammo += dt;
    let changed = false;
    if (state.regen.hp >= 7 && state.player.hp < state.player.maxHp) {
      state.regen.hp -= 7;
      state.player.hp += 1;
      changed = true;
    }
    if (state.regen.ammo >= 5 && state.player.ammo < MAX_AMMO) {
      state.regen.ammo -= 5;
      state.player.ammo += 1;
      changed = true;
    }
    if (changed) updateHud();
  } else {
    state.regen.hp = Math.min(state.regen.hp, 6.5);
    state.regen.ammo = Math.min(state.regen.ammo, 4.5);
  }

  acquireTarget();
}

function enemyFieldAttack(m, dist) {
  const s = species[m.species];
  const dx = state.player.x - m.x, dy = state.player.y - m.y;
  if (dist < 1.7) {
    hurtPlayer(5 + Math.floor(s.power / 2));
    notify(`${s.name} struck you!`);
  } else {
    const d = Math.hypot(dx, dy);
    state.projectiles.push({ x: m.x, y: m.y, vx: dx / d * 2.7, vy: dy / d * 2.7, life: 3, damage: 4 + Math.floor(s.power / 2), color: s.colors[3] });
  }
}

function hurtPlayer(damage) {
  state.player.hp = Math.max(0, state.player.hp - damage);
  state.hurtFlash = 1;
  state.dangerTimer = 8;
  triggerScreenShake();
  if (state.player.hp <= 0) {
    state.player.hp = state.player.maxHp;
    moveToSafeSpawn();
    state.team.forEach(t => t.hp = Math.max(1, Math.floor(t.maxHp * .6)));
    notify("You blacked out and returned to the gate.");
  }
  updateHud();
}

function castScene() {
  const horizon = H / 2 + Math.sin(state.bob) * 1.2;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#16080b"); sky.addColorStop(1, "#5a211b");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
  const floor = ctx.createLinearGradient(0, horizon, 0, H);
  floor.addColorStop(0, "#3a211a"); floor.addColorStop(1, "#090606");
  ctx.fillStyle = floor; ctx.fillRect(0, horizon, W, H - horizon);

  const travel = (state.player.x + state.player.y) * 7;
  for (let y = Math.ceil(horizon) + 4; y < H; y += 6) {
    const perspective = (y - horizon) / Math.max(1, H - horizon);
    const offset = (travel / Math.max(.14, perspective)) % 12;
    ctx.fillStyle = `rgba(229,126,66,${.018 + perspective * .035})`;
    ctx.fillRect(0, y + offset * .12, W, 1);
  }

  for (let x = 0; x < W; x += 2) {
    const rayAngle = state.player.angle - HALF_FOV + (x / W) * FOV;
    const sin = Math.sin(rayAngle), cos = Math.cos(rayAngle);
    let depth = .02, tile = "1";
    while (depth < MAX_DEPTH) {
      const rx = state.player.x + cos * depth, ry = state.player.y + sin * depth;
      tile = wallAt(rx, ry);
      if (tile !== "0") break;
      depth += .025;
    }
    const corrected = depth * Math.cos(rayAngle - state.player.angle);
    state.depth[x] = state.depth[x + 1] = corrected;
    const wallH = Math.min(H * 1.7, H / Math.max(.01, corrected));
    const y = horizon - wallH / 2;
    const shade = Math.max(.2, 1 - corrected / MAX_DEPTH);
    const base = tile === "2" ? [103, 54, 32] : tile === "3" ? [74, 61, 59] : [126, 52, 38];
    const hitX = state.player.x + cos * depth;
    const hitY = state.player.y + sin * depth;
    const fx = hitX - Math.floor(hitX), fy = hitY - Math.floor(hitY);
    const verticalSide = Math.min(fx, 1 - fx) < Math.min(fy, 1 - fy);
    const texturePos = verticalSide ? hitY : hitX;
    const mortar = Math.floor(texturePos * 8) % 8 === 0 || Math.floor((y / Math.max(1, wallH)) * 16) % 8 === 0;
    const stripe = mortar ? .58 : ((Math.floor(texturePos * 4) & 1) ? .82 : 1);
    const sideShade = verticalSide ? .82 : 1;
    ctx.fillStyle = `rgb(${base[0] * shade * stripe * sideShade},${base[1] * shade * stripe * sideShade},${base[2] * shade * stripe * sideShade})`;
    ctx.fillRect(x, y, 2, wallH);
    if (corrected < 5) {
      ctx.fillStyle = `rgba(255,170,90,${Math.max(0,.12-corrected*.018)})`;
      ctx.fillRect(x, y, 2, wallH);
    }
  }

  drawWorldSprites(horizon);
  drawFloatingDamageNumbers(horizon);
  drawWeapon();
  drawRadar();
  drawCompass();
  if (state.hurtFlash > 0) { ctx.fillStyle = `rgba(180,0,0,${state.hurtFlash * .35})`; ctx.fillRect(0,0,W,H); }
  ctx.fillStyle = "rgba(0,0,0,.07)";
  for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
}

function drawWorldSprites(horizon) {
  const items = [];
  for (const m of state.monsters) {
    if (!m.alive) continue;
    const dx = m.x - state.player.x, dy = m.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const rel = normAngle(Math.atan2(dy, dx) - state.player.angle);
    if (Math.abs(rel) < HALF_FOV + .3 && hasLineOfSight(state.player.x, state.player.y, m.x, m.y)) items.push({ kind: "monster", ref: m, dist, rel });
  }
  for (const p of state.projectiles) {
    const dx = p.x - state.player.x, dy = p.y - state.player.y;
    const dist = Math.hypot(dx, dy), rel = normAngle(Math.atan2(dy, dx) - state.player.angle);
    if (Math.abs(rel) < HALF_FOV + .2) items.push({ kind: "projectile", ref: p, dist, rel });
  }
  items.sort((a,b)=>b.dist-a.dist);

  for (const item of items) {
    const screenX = (0.5 + item.rel / FOV) * W;
    if (item.dist <= .1) continue;
    if (item.kind === "monster") {
      const size = Math.min(150, 105 / item.dist);
      const left = Math.floor(screenX - size / 2);
      const top = Math.floor(horizon - size * .55);
      const center = Math.max(0, Math.min(W - 1, Math.floor(screenX)));
      if (item.dist > state.depth[center] + .25) continue;
      const sprite = buildMonsterSprite(item.ref.species);
      ctx.save();
      if (item.ref.hit > 0) ctx.globalAlpha = .45 + Math.sin(state.time * 45) * .35;
      ctx.drawImage(sprite, left, top, size, size);
      ctx.restore();
      if (item.ref.hp / item.ref.maxHp <= .35) {
        ctx.fillStyle = "#fff17c"; ctx.font = "bold 6px monospace"; ctx.textAlign = "center";
        ctx.fillText("STAGGER", screenX, top - 3);
      }
    } else {
      const size = Math.min(18, 9 / item.dist);
      if (item.dist > state.depth[Math.max(0,Math.min(W-1,Math.floor(screenX)))] + .2) continue;
      ctx.fillStyle = item.ref.color; ctx.fillRect(screenX-size/2, horizon-size/2, size, size);
      ctx.fillStyle = "#fff4b0"; ctx.fillRect(screenX-size/4, horizon-size/4, size/2, size/2);
    }
  }
}

function drawFloatingDamageNumbers(horizon) {
  for (const n of state.damageNumbers) {
    const dx = n.x - state.player.x, dy = n.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const rel = normAngle(Math.atan2(dy, dx) - state.player.angle);
    if (Math.abs(rel) > HALF_FOV + .12 || dist <= .1) continue;
    const screenX = (0.5 + rel / FOV) * W;
    const center = Math.max(0, Math.min(W - 1, Math.floor(screenX)));
    if (dist > state.depth[center] + .3) continue;
    const size = Math.min(150, 105 / dist);
    const screenY = horizon - size * .65 - n.rise * 28;
    const alpha = Math.max(0, n.life / n.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#170606";
    ctx.strokeText(`-${n.value}`, screenX, screenY);
    ctx.fillStyle = n.critical ? "#fff17c" : "#ff7357";
    ctx.fillText(`-${n.value}`, screenX, screenY);
    ctx.restore();
  }
}

function triggerScreenShake() {
  const shell = document.querySelector(".viewport-shell");
  if (!shell) return;
  shell.classList.remove("shake");
  void shell.offsetWidth;
  shell.classList.add("shake");
  setTimeout(() => shell.classList.remove("shake"), 330);
}

function drawRadar() {
  const size = 48, scale = 4, ox = 5, oy = H - size - 5;
  ctx.fillStyle = "rgba(6,3,3,.78)";
  ctx.fillRect(ox, oy, size, size);
  ctx.strokeStyle = "#7b4a38";
  ctx.strokeRect(ox + .5, oy + .5, size - 1, size - 1);

  const radius = 5;
  for (let my = -radius; my <= radius; my++) {
    for (let mx = -radius; mx <= radius; mx++) {
      const wx = Math.floor(state.player.x) + mx;
      const wy = Math.floor(state.player.y) + my;
      const tile = wallAt(wx + .5, wy + .5);
      if (tile !== "0") {
        ctx.fillStyle = tile === "2" ? "#744125" : tile === "3" ? "#5c5551" : "#8b382c";
        ctx.fillRect(ox + size / 2 + mx * scale, oy + size / 2 + my * scale, scale, scale);
      }
    }
  }

  for (const m of state.monsters) {
    if (!m.alive) continue;
    const dx = m.x - state.player.x, dy = m.y - state.player.y;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
      ctx.fillStyle = "#ffcc55";
      ctx.fillRect(ox + size / 2 + dx * scale - 1, oy + size / 2 + dy * scale - 1, 3, 3);
    }
  }

  const px = ox + size / 2, py = oy + size / 2;
  ctx.fillStyle = "#fff4b0";
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(state.player.angle) * 6, py + Math.sin(state.player.angle) * 6);
  ctx.lineTo(px + Math.cos(state.player.angle + 2.45) * 4, py + Math.sin(state.player.angle + 2.45) * 4);
  ctx.lineTo(px + Math.cos(state.player.angle - 2.45) * 4, py + Math.sin(state.player.angle - 2.45) * 4);
  ctx.closePath();
  ctx.fill();
}

function drawCompass() {
  const dirs = ["E", "S", "W", "N"];
  const quarter = Math.PI / 2;
  const index = ((Math.round(state.player.angle / quarter) % 4) + 4) % 4;
  ctx.font = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(10,5,5,.8)";
  ctx.fillRect(W / 2 - 34, 3, 68, 12);
  ctx.strokeStyle = "#7b4a38";
  ctx.strokeRect(W / 2 - 34.5, 2.5, 69, 13);
  ctx.fillStyle = "#ffe099";
  ctx.fillText(`${dirs[index]}  X${state.player.x.toFixed(1)} Y${state.player.y.toFixed(1)}`, W / 2, 11);
}

function drawWeapon() {
  const bobX = Math.sin(state.bob * .5) * 2, bobY = Math.abs(Math.cos(state.bob)) * 2;
  const x = W / 2 + bobX, y = H - 6 + bobY;
  ctx.fillStyle = "#130b0b"; ctx.fillRect(x - 27, y - 36, 54, 36);
  ctx.fillStyle = "#45251f"; ctx.fillRect(x - 21, y - 43, 42, 31);
  ctx.fillStyle = "#8b4430"; ctx.fillRect(x - 13, y - 51, 26, 27);
  ctx.fillStyle = "#d18a45"; ctx.fillRect(x - 7, y - 58, 14, 16);
  ctx.fillStyle = "#2a1512"; ctx.fillRect(x - 4, y - 61, 8, 14);
  if (state.muzzle > 0) {
    ctx.fillStyle = "#fff5a2"; ctx.fillRect(x - 9, y - 75, 18, 15);
    ctx.fillStyle = "#ff7b2d"; ctx.fillRect(x - 15, y - 70, 30, 7);
  }
}

function acquireTarget() {
  let best = null, bestScore = Infinity;
  for (const m of state.monsters) {
    if (!m.alive) continue;
    const dx = m.x - state.player.x, dy = m.y - state.player.y;
    const dist = Math.hypot(dx, dy), angle = Math.abs(normAngle(Math.atan2(dy, dx) - state.player.angle));
    if (angle < .12 && dist < 7 && hasLineOfSight(state.player.x, state.player.y, m.x, m.y)) {
      const score = angle * 6 + dist * .03;
      if (score < bestScore) { best = m; bestScore = score; }
    }
  }
  state.target = best;
  updateTargetHud();
}
