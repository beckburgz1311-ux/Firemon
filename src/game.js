(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const $ = id => document.getElementById(id);
  const ui = {
    hp: $('hpText'), ammo: $('ammoText'), caps: $('capsText'),
    targetName: $('targetName'), targetBar: $('targetBar'), message: $('message'),
    battleOverlay: $('battleOverlay'), battleTitle: $('battleTitle'), battleLog: $('battleLog'),
    enemyName: $('enemyBattleName'), enemyLevel: $('enemyBattleLevel'), enemyBar: $('enemyBattleBar'), enemyHp: $('enemyBattleHp'),
    allyName: $('allyBattleName'), allyLevel: $('allyBattleLevel'), allyBar: $('allyBattleBar'), allyHp: $('allyBattleHp'),
    enemySprite: $('enemyBattleSprite'), allySprite: $('allyBattleSprite'),
    teamOverlay: $('teamOverlay'), teamList: $('teamList'), helpOverlay: $('helpOverlay')
  };

  const W = canvas.width;
  const H = canvas.height;
  const FOV = Math.PI / 3;
  const HALF_FOV = FOV / 2;
  const MAX_DEPTH = 20;
  const SAVE_KEY = 'firemon-v5-save';

  const MAP = [
    '1111111111111111',
    '1000000000000001',
    '1022200111110001',
    '1000200100010001',
    '1000200100010001',
    '1000000100010001',
    '1110111100011101',
    '1000100000000001',
    '1000103330110001',
    '1000000030010001',
    '1011111030010001',
    '1000000030000001',
    '1000111111101101',
    '1000000000000001',
    '1000000000000001',
    '1111111111111111'
  ];

  const DEX = {
    cinderling: { name: 'CINDERLING', type: 'FIRE', maxHp: 42, power: 8, skill: 'EMBER FANG', colors: ['#35100d','#8c291f','#f05b35','#ffb342','#fff1bc'] },
    ashmaw: { name: 'ASHMAW', type: 'FIRE', maxHp: 32, power: 6, skill: 'ASH BITE', colors: ['#281312','#63332d','#b64934','#ef7d43','#ffcf83'] },
    mossfiend: { name: 'MOSSFIEND', type: 'GROVE', maxHp: 40, power: 5, skill: 'THORN LASH', colors: ['#102317','#245232','#438653','#8bbf5c','#e0ef9d'] },
    tidejaw: { name: 'TIDEJAW', type: 'TIDE', maxHp: 35, power: 6, skill: 'RIP CURRENT', colors: ['#0b1c2a','#153f5b','#24789a','#5fc7c9','#d8ffff'] },
    voltusk: { name: 'VOLTUSK', type: 'VOLT', maxHp: 31, power: 8, skill: 'ARC RUSH', colors: ['#29200b','#6f5a13','#c89d21','#ffd74a','#fff9b0'] },
    stonehorn: { name: 'STONEHORN', type: 'STONE', maxHp: 46, power: 5, skill: 'FAULT CHARGE', colors: ['#1d1b1a','#4c4945','#77736d','#aaa297','#e0d5c2'] },
    sporeimp: { name: 'SPOREIMP', type: 'SPORE', maxHp: 34, power: 6, skill: 'DREAM DUST', colors: ['#211125','#562a60','#954a93','#d77cab','#ffd1db'] }
  };

  const TYPE = {
    FIRE: { GROVE: 1.5, TIDE: 0.7, STONE: 0.8 },
    GROVE: { TIDE: 1.5, FIRE: 0.7 },
    TIDE: { FIRE: 1.5, GROVE: 0.7, VOLT: 0.7 },
    VOLT: { TIDE: 1.5, STONE: 0.6 },
    STONE: { VOLT: 1.5, FIRE: 1.2 },
    SPORE: { GROVE: 1.3 }
  };

  const state = {
    player: { x: 1.5, y: 1.5, angle: 0, hp: 100, maxHp: 100, ammo: 30, caps: 3 },
    move: { x: 0, y: 0 }, keys: new Set(), monsters: [], target: null,
    team: [{ species: 'cinderling', name: 'CINDERLING', level: 5, xp: 0, hp: 57, maxHp: 57 }],
    active: 0, battle: null, paused: false, depth: new Float32Array(W),
    last: performance.now(), time: 0, muzzle: 0, hurt: 0, bob: 0, guard: false
  };

  const spriteCache = new Map();

  function wallAt(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    if (my < 0 || mx < 0 || my >= MAP.length || mx >= MAP[0].length) return '1';
    return MAP[my][mx];
  }

  function blocked(x, y, r = 0.18) {
    return wallAt(x-r,y-r) !== '0' || wallAt(x+r,y-r) !== '0' || wallAt(x-r,y+r) !== '0' || wallAt(x+r,y+r) !== '0';
  }

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function lineOfSight(ax, ay, bx, by) {
    const dx = bx-ax, dy = by-ay, d = Math.hypot(dx,dy);
    const steps = Math.max(1, Math.ceil(d * 10));
    for (let i=1;i<steps;i++) {
      const t=i/steps;
      if (wallAt(ax+dx*t, ay+dy*t) !== '0') return false;
    }
    return true;
  }

  function makeMonster(species, x, y, level) {
    const d = DEX[species];
    const maxHp = d.maxHp + level * 3;
    return { id: `${species}-${x}-${y}`, species, x, y, level, hp: maxHp, maxHp, alive: true, hit: 0, cooldown: 1 + Math.random()*2 };
  }

  function seedMonsters() {
    state.monsters = [
      makeMonster('ashmaw',5.5,2.5,2), makeMonster('mossfiend',12.5,2.5,3),
      makeMonster('tidejaw',6.5,8.5,4), makeMonster('voltusk',13.5,8.5,5),
      makeMonster('stonehorn',3.5,13.5,5), makeMonster('sporeimp',11.5,13.5,4),
      makeMonster('ashmaw',14,11,6)
    ];
  }

  function makeSprite(id, back = false) {
    const key = `${id}-${back}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const p = DEX[id].colors;
    const px = (x,y,w,h,col) => { g.fillStyle=col; g.fillRect(x,y,w,h); };
    px(7,27,18,3,'rgba(0,0,0,.45)');
    px(8,22,5,6,p[1]); px(20,22,5,6,p[1]); px(9,25,5,3,p[0]); px(19,25,6,3,p[0]);
    px(7,12,19,13,p[1]); px(9,10,15,15,p[2]); px(12,13,10,9,p[3]);
    px(8,5,17,12,p[2]); px(10,3,13,13,p[3]); px(7,2,5,7,p[1]); px(22,2,5,7,p[1]);
    px(8,1,3,5,p[4]); px(23,1,3,5,p[4]); px(12,11,10,6,p[4]); px(14,14,6,3,p[1]);
    if (!back) {
      px(11,8,4,4,'#fff8cf'); px(20,8,4,4,'#fff8cf'); px(13,9,2,3,'#130808'); px(20,9,2,3,'#130808');
      px(13,9,1,1,'#ff4f35'); px(21,9,1,1,'#ff4f35');
    }
    if (id === 'cinderling' || id === 'ashmaw') { px(15,0,4,5,'#ffdb4b'); px(16,0,2,3,'#fff7ae'); }
    if (id === 'mossfiend') { px(4,10,6,4,p[3]); px(23,9,6,5,p[3]); px(14,0,5,5,p[4]); }
    if (id === 'tidejaw') { px(3,13,7,4,p[3]); px(24,13,6,4,p[3]); px(15,0,4,6,p[4]); }
    if (id === 'voltusk') { px(4,8,7,3,p[4]); px(23,8,6,3,p[4]); px(15,0,3,6,p[4]); }
    if (id === 'stonehorn') { px(4,5,7,5,p[3]); px(23,5,6,5,p[3]); px(14,0,6,5,p[4]); }
    if (id === 'sporeimp') { px(6,2,22,7,p[3]); px(10,0,14,5,p[4]); }
    spriteCache.set(key,c);
    return c;
  }

  function update(dt) {
    state.time += dt;
    state.muzzle = Math.max(0,state.muzzle-dt*10);
    state.hurt = Math.max(0,state.hurt-dt*2.5);
    state.monsters.forEach(m=>m.hit=Math.max(0,m.hit-dt*5));
    if (state.paused) return;

    let forward = -state.move.y, strafe = state.move.x;
    if (state.keys.has('w') || state.keys.has('arrowup')) forward += 1;
    if (state.keys.has('s') || state.keys.has('arrowdown')) forward -= 1;
    if (state.keys.has('a')) strafe -= 1;
    if (state.keys.has('d')) strafe += 1;
    if (state.keys.has('arrowleft')) state.player.angle -= dt*1.9;
    if (state.keys.has('arrowright')) state.player.angle += dt*1.9;

    const mag = Math.hypot(forward,strafe);
    if (mag > 0.05) {
      forward /= Math.max(1,mag); strafe /= Math.max(1,mag);
      const speed = 2.25*dt;
      const dx = Math.cos(state.player.angle)*forward*speed + Math.cos(state.player.angle+Math.PI/2)*strafe*speed;
      const dy = Math.sin(state.player.angle)*forward*speed + Math.sin(state.player.angle+Math.PI/2)*strafe*speed;
      if (!blocked(state.player.x+dx,state.player.y)) state.player.x += dx;
      if (!blocked(state.player.x,state.player.y+dy)) state.player.y += dy;
      state.bob += dt*13;
    }

    for (const m of state.monsters) {
      if (!m.alive) continue;
      const dx=state.player.x-m.x, dy=state.player.y-m.y, dist=Math.hypot(dx,dy);
      m.cooldown -= dt;
      if (dist<7 && lineOfSight(m.x,m.y,state.player.x,state.player.y) && m.cooldown<=0) {
        m.cooldown = 2.2+Math.random()*1.5;
        if (dist<1.6) damagePlayer(5+Math.floor(DEX[m.species].power/2));
        else notify(`${DEX[m.species].name} is hunting you.`);
      }
    }
    acquireTarget();
  }

  function damagePlayer(n) {
    state.player.hp = Math.max(0,state.player.hp-n);
    state.hurt = 1;
    if (state.player.hp<=0) {
      state.player.hp=state.player.maxHp; state.player.x=1.5; state.player.y=1.5; state.player.angle=0;
      notify('YOU BLACKED OUT — RETURNED TO THE GATE.');
    }
    updateHud();
  }

  function castScene() {
    const horizon = H/2 + Math.sin(state.bob)*1.1;
    const sky = ctx.createLinearGradient(0,0,0,horizon);
    sky.addColorStop(0,'#12070a'); sky.addColorStop(1,'#5b241b');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,horizon);
    const floor=ctx.createLinearGradient(0,horizon,0,H);
    floor.addColorStop(0,'#4a291e'); floor.addColorStop(1,'#080505');
    ctx.fillStyle=floor; ctx.fillRect(0,horizon,W,H-horizon);

    for (let y=Math.ceil(horizon)+5;y<H;y+=6) {
      const p=(y-horizon)/(H-horizon);
      ctx.fillStyle=`rgba(255,154,80,${0.018+p*0.04})`;
      ctx.fillRect(0,y+((state.player.x+state.player.y)*7/p)%5,W,1);
    }

    for (let x=0;x<W;x+=2) {
      const a=state.player.angle-HALF_FOV+(x/W)*FOV;
      const sx=Math.cos(a), sy=Math.sin(a);
      let d=0.02,tile='1';
      while(d<MAX_DEPTH){ tile=wallAt(state.player.x+sx*d,state.player.y+sy*d); if(tile!=='0')break; d+=0.025; }
      const corrected=d*Math.cos(a-state.player.angle);
      state.depth[x]=state.depth[x+1]=corrected;
      const wh=Math.min(H*1.7,H/Math.max(0.01,corrected));
      const top=horizon-wh/2;
      const shade=Math.max(0.18,1-corrected/MAX_DEPTH);
      const base=tile==='2'?[108,58,34]:tile==='3'?[75,65,60]:[134,55,40];
      const hx=state.player.x+sx*d, hy=state.player.y+sy*d;
      const fx=hx-Math.floor(hx), fy=hy-Math.floor(hy);
      const side=Math.min(fx,1-fx)<Math.min(fy,1-fy);
      const tex=side?hy:hx;
      const stripe=(Math.floor(tex*4)&1)?0.78:1;
      const ss=side?0.78:1;
      ctx.fillStyle=`rgb(${base[0]*shade*stripe*ss},${base[1]*shade*stripe*ss},${base[2]*shade*stripe*ss})`;
      ctx.fillRect(x,top,2,wh);
    }

    drawMonsters(horizon);
    drawWeapon();
    drawRadar();
    drawCompass();
    if(state.hurt>0){ctx.fillStyle=`rgba(180,0,0,${state.hurt*.35})`;ctx.fillRect(0,0,W,H);}
    ctx.fillStyle='rgba(0,0,0,.08)'; for(let y=0;y<H;y+=2)ctx.fillRect(0,y,W,1);
  }

  function drawMonsters(horizon) {
    const visible=[];
    for(const m of state.monsters){
      if(!m.alive)continue;
      const dx=m.x-state.player.x,dy=m.y-state.player.y,dist=Math.hypot(dx,dy);
      const rel=normAngle(Math.atan2(dy,dx)-state.player.angle);
      if(Math.abs(rel)<HALF_FOV+0.25 && lineOfSight(state.player.x,state.player.y,m.x,m.y)) visible.push({m,dist,rel});
    }
    visible.sort((a,b)=>b.dist-a.dist);
    for(const v of visible){
      const screenX=(0.5+v.rel/FOV)*W;
      const size=Math.min(150,105/v.dist);
      const center=Math.max(0,Math.min(W-1,Math.floor(screenX)));
      if(v.dist>state.depth[center]+0.25)continue;
      ctx.save();
      if(v.m.hit>0)ctx.globalAlpha=.5+Math.sin(state.time*40)*.3;
      ctx.drawImage(makeSprite(v.m.species),screenX-size/2,horizon-size*.55,size,size);
      ctx.restore();
      if(v.m.hp/v.m.maxHp<0.35){ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#fff17c';ctx.fillText('STAGGER',screenX,horizon-size*.55-3);}
    }
  }

  function drawWeapon(){
    const bx=Math.sin(state.bob*.5)*2,by=Math.abs(Math.cos(state.bob))*2,x=W/2+bx,y=H-6+by;
    ctx.fillStyle='#130b0b';ctx.fillRect(x-27,y-36,54,36);
    ctx.fillStyle='#45251f';ctx.fillRect(x-21,y-43,42,31);
    ctx.fillStyle='#8b4430';ctx.fillRect(x-13,y-51,26,27);
    ctx.fillStyle='#d18a45';ctx.fillRect(x-7,y-58,14,16);
    ctx.fillStyle='#2a1512';ctx.fillRect(x-4,y-61,8,14);
    if(state.muzzle>0){ctx.fillStyle='#fff5a2';ctx.fillRect(x-9,y-75,18,15);ctx.fillStyle='#ff7b2d';ctx.fillRect(x-15,y-70,30,7);}
  }

  function drawRadar(){
    const size=48,scale=4,ox=5,oy=H-size-5,r=5;
    ctx.fillStyle='rgba(6,3,3,.8)';ctx.fillRect(ox,oy,size,size);ctx.strokeStyle='#7b4a38';ctx.strokeRect(ox+.5,oy+.5,size-1,size-1);
    for(let my=-r;my<=r;my++)for(let mx=-r;mx<=r;mx++){
      const t=wallAt(Math.floor(state.player.x)+mx+.5,Math.floor(state.player.y)+my+.5);
      if(t!=='0'){ctx.fillStyle=t==='2'?'#744125':t==='3'?'#5c5551':'#8b382c';ctx.fillRect(ox+size/2+mx*scale,oy+size/2+my*scale,scale,scale);}
    }
    for(const m of state.monsters){if(!m.alive)continue;const dx=m.x-state.player.x,dy=m.y-state.player.y;if(Math.abs(dx)<=r&&Math.abs(dy)<=r){ctx.fillStyle='#ffcc55';ctx.fillRect(ox+size/2+dx*scale-1,oy+size/2+dy*scale-1,3,3);}}
    const px=ox+size/2,py=oy+size/2;ctx.fillStyle='#fff4b0';ctx.beginPath();ctx.moveTo(px+Math.cos(state.player.angle)*6,py+Math.sin(state.player.angle)*6);ctx.lineTo(px+Math.cos(state.player.angle+2.45)*4,py+Math.sin(state.player.angle+2.45)*4);ctx.lineTo(px+Math.cos(state.player.angle-2.45)*4,py+Math.sin(state.player.angle-2.45)*4);ctx.fill();
  }

  function drawCompass(){
    const dirs=['E','S','W','N'],i=((Math.round(state.player.angle/(Math.PI/2))%4)+4)%4;
    ctx.fillStyle='rgba(10,5,5,.8)';ctx.fillRect(W/2-35,3,70,12);ctx.strokeStyle='#7b4a38';ctx.strokeRect(W/2-35,3,70,12);ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillStyle='#ffe099';ctx.fillText(`${dirs[i]} X${state.player.x.toFixed(1)} Y${state.player.y.toFixed(1)}`,W/2,11);
  }

  function acquireTarget(){
    let best=null,bestScore=Infinity;
    for(const m of state.monsters){
      if(!m.alive)continue;
      const dx=m.x-state.player.x,dy=m.y-state.player.y,dist=Math.hypot(dx,dy);
      const rel=Math.abs(normAngle(Math.atan2(dy,dx)-state.player.angle));
      if(dist<10&&rel<0.16&&lineOfSight(state.player.x,state.player.y,m.x,m.y)){
        const score=rel*7+dist*.02;if(score<bestScore){best=m;bestScore=score;}
      }
    }
    state.target=best; updateTargetHud();
  }

  function fire(){
    if(state.paused)return;
    if(state.player.ammo<=0){notify('OUT OF AMMO.');return;}
    state.player.ammo--;state.muzzle=1;
    if(state.target){
      const dmg=5+Math.floor(Math.random()*5);state.target.hp=Math.max(1,state.target.hp-dmg);state.target.hit=1;
      notify(`${DEX[state.target.species].name} TOOK ${dmg} DAMAGE.`);
    } else notify('SHOT MISSED.');
    updateHud();updateTargetHud();saveGame(false);
  }

  function quickCapture(){
    if(state.paused)return;
    const m=state.target;if(!m){notify('AIM AT A FIREMON FIRST.');return;}
    if(state.player.caps<=0){notify('NO CAPTURE CAPSULES.');return;}
    state.player.caps--;
    const chance=Math.min(.9,.18+(1-m.hp/m.maxHp)*.75);
    if(Math.random()<chance)captureMonster(m,'QUICK CAPTURE SUCCESS!');else notify('THE CAPSULE BROKE!');
    updateHud();saveGame(false);
  }

  function activeMon(){return state.team[state.active];}

  function startBattle(){
    if(state.paused||!state.target){notify('AIM AT A FIREMON TO DUEL.');return;}
    const ally=activeMon();if(!ally||ally.hp<=0){notify('NO HEALTHY FIREMON.');return;}
    state.battle={enemy:state.target,ally,busy:false,guard:false};state.paused=true;ui.battleOverlay.classList.remove('hidden');ui.battleLog.textContent='CHOOSE YOUR MOVE.';renderBattle();
  }

  function battleMove(kind){
    const b=state.battle;if(!b||b.busy)return;b.busy=true;
    if(kind==='flee'){endBattle('YOU ESCAPED.');return;}
    if(kind==='capture'){
      if(state.player.caps<=0){ui.battleLog.textContent='NO CAPSULES LEFT.';b.busy=false;return;}
      state.player.caps--;const chance=Math.min(.92,.25+(1-b.enemy.hp/b.enemy.maxHp)*.68);updateHud();
      ui.battleLog.textContent='CAPSULE THROWN...';setTimeout(()=>{if(Math.random()<chance)captureMonster(b.enemy,'CAPTURE SUCCESS!');else{ui.battleLog.textContent='IT BROKE FREE!';setTimeout(enemyTurn,650);}},650);return;
    }
    if(kind==='guard'){b.guard=true;ui.battleLog.textContent=`${b.ally.name} BRACES FOR IMPACT.`;setTimeout(enemyTurn,550);return;}
    const ad=DEX[b.ally.species],ed=DEX[b.enemy.species];
    const mult=(TYPE[ad.type]&&TYPE[ad.type][ed.type])||1;
    const base=ad.power+Math.floor(Math.random()*4)+(kind==='skill'?4:0);
    const dmg=Math.max(2,Math.floor(base*mult));b.enemy.hp=Math.max(0,b.enemy.hp-dmg);
    ui.battleLog.textContent=kind==='skill'?`${b.ally.name} USED ${ad.skill}! ${dmg} DAMAGE.`:`${b.ally.name} ATTACKED! ${dmg} DAMAGE.`;renderBattle();
    if(b.enemy.hp<=0){b.enemy.alive=false;gainXp(b.ally,10+b.enemy.level*3);setTimeout(()=>endBattle(`${ed.name} WAS DEFEATED.`),750);}else setTimeout(enemyTurn,700);
  }

  function enemyTurn(){
    const b=state.battle;if(!b)return;const e=DEX[b.enemy.species],a=DEX[b.ally.species];
    const mult=(TYPE[e.type]&&TYPE[e.type][a.type])||1;let dmg=Math.max(1,Math.floor((e.power+Math.random()*4)*mult));if(b.guard)dmg=Math.ceil(dmg*.4);
    b.guard=false;b.ally.hp=Math.max(0,b.ally.hp-dmg);ui.battleLog.textContent=`${e.name} USED ${e.skill}! ${dmg} DAMAGE.`;renderBattle();
    if(b.ally.hp<=0){const next=state.team.findIndex(t=>t.hp>0);if(next>=0){state.active=next;b.ally=activeMon();ui.battleLog.textContent+=` ${b.ally.name} STEPS IN!`;renderBattle();b.busy=false;}else setTimeout(()=>endBattle('YOUR TEAM WAS DEFEATED.'),800);}else b.busy=false;
  }

  function captureMonster(m,msg){
    m.alive=false;const d=DEX[m.species];
    if(state.team.length<6){state.team.push({species:m.species,name:d.name,level:m.level,xp:0,hp:m.maxHp,maxHp:m.maxHp});}
    if(state.battle)endBattle(msg);else notify(msg);renderTeam();updateTargetHud();saveGame(false);
  }

  function gainXp(mon,n){mon.xp+=n;const need=mon.level*18;if(mon.xp>=need){mon.xp-=need;mon.level++;mon.maxHp+=5;mon.hp=mon.maxHp;notify(`${mon.name} REACHED LV ${mon.level}!`);}}

  function endBattle(msg){ui.battleOverlay.classList.add('hidden');state.battle=null;state.paused=false;notify(msg);renderTeam();updateHud();saveGame(false);}

  function renderBattle(){
    const b=state.battle;if(!b)return;const ed=DEX[b.enemy.species];
    ui.battleTitle.textContent=`WILD ${ed.name}`;ui.enemyName.textContent=ed.name;ui.enemyLevel.textContent=`LV ${b.enemy.level}`;ui.enemyHp.textContent=`${b.enemy.hp} / ${b.enemy.maxHp}`;ui.enemyBar.style.width=`${b.enemy.hp/b.enemy.maxHp*100}%`;
    ui.allyName.textContent=b.ally.name;ui.allyLevel.textContent=`LV ${b.ally.level}`;ui.allyHp.textContent=`${b.ally.hp} / ${b.ally.maxHp}`;ui.allyBar.style.width=`${b.ally.hp/b.ally.maxHp*100}%`;
    drawSpriteTo(ui.enemySprite,b.enemy.species,false);drawSpriteTo(ui.allySprite,b.ally.species,true);
  }

  function drawSpriteTo(c,id,back){const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,c.width,c.height);g.drawImage(makeSprite(id,back),0,0,c.width,c.height);}

  function renderTeam(){
    ui.teamList.innerHTML=state.team.map((m,i)=>`<article class="team-card ${i===state.active?'active':''}"><canvas width="32" height="32" data-sp="${m.species}"></canvas><div><h3>${m.name}</h3><p>${DEX[m.species].type} · LV ${m.level}<br>HP ${m.hp}/${m.maxHp}</p><button class="pixel-btn small" data-i="${i}">${i===state.active?'ACTIVE':'SELECT'}</button></div></article>`).join('');
    ui.teamList.querySelectorAll('canvas').forEach(c=>{const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(makeSprite(c.dataset.sp),0,0,32,32);});
    ui.teamList.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.i);if(state.team[i].hp<=0){notify('THAT FIREMON HAS FAINTED.');return;}state.active=i;renderTeam();notify(`${state.team[i].name} IS ACTIVE.`);saveGame(false);}));
  }

  function updateHud(){ui.hp.textContent=state.player.hp;ui.ammo.textContent=state.player.ammo;ui.caps.textContent=state.player.caps;}
  function updateTargetHud(){const m=state.target;if(!m){ui.targetName.textContent='NO TARGET';ui.targetBar.style.width='0%';return;}ui.targetName.textContent=`${DEX[m.species].name} LV${m.level}`;ui.targetBar.style.width=`${m.hp/m.maxHp*100}%`;}

  let messageTimer;
  function notify(text){ui.message.textContent=text;ui.message.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>ui.message.classList.remove('show'),1800);}

  function saveGame(show=true){
    try{localStorage.setItem(SAVE_KEY,JSON.stringify({player:state.player,team:state.team,active:state.active,monsters:state.monsters.map(m=>({id:m.id,hp:m.hp,alive:m.alive}))}));if(show)notify('GAME SAVED.');}catch(e){if(show)notify('SAVE FAILED.');}
  }

  function loadGame(){
    try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;const d=JSON.parse(raw);Object.assign(state.player,d.player||{});if(blocked(state.player.x,state.player.y)){state.player.x=1.5;state.player.y=1.5;state.player.angle=0;}if(Array.isArray(d.team)&&d.team.length)state.team=d.team;state.active=Math.min(d.active||0,state.team.length-1);const sm=new Map((d.monsters||[]).map(m=>[m.id,m]));state.monsters.forEach(m=>{const s=sm.get(m.id);if(s)Object.assign(m,s);});}catch(e){console.warn(e);}
  }

  function setupStick(){
    const pad=$('movePad'),stick=$('moveStick');let pid=null;
    const move=e=>{if(e.pointerId!==pid)return;const r=pad.getBoundingClientRect();let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const max=r.width*.27,mag=Math.hypot(dx,dy);if(mag>max){dx=dx/mag*max;dy=dy/mag*max;}stick.style.transform=`translate(${dx}px,${dy}px)`;state.move.x=dx/max;state.move.y=dy/max;};
    const end=e=>{if(e.pointerId!==pid)return;pid=null;state.move.x=state.move.y=0;stick.style.transform='translate(0,0)';};
    pad.addEventListener('pointerdown',e=>{pid=e.pointerId;pad.setPointerCapture(pid);move(e);});pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);
  }

  function setupLook(){let pid=null,last=0;canvas.addEventListener('pointerdown',e=>{pid=e.pointerId;last=e.clientX;canvas.setPointerCapture(pid);});canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pid||state.paused)return;const dx=e.clientX-last;last=e.clientX;state.player.angle+=dx*.008;});const end=e=>{if(e.pointerId===pid)pid=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);}

  function bind(){
    setupStick();setupLook();
    $('fireBtn').addEventListener('pointerdown',fire);$('duelBtn').addEventListener('click',startBattle);$('quickCaptureBtn').addEventListener('click',quickCapture);
    $('teamBtn').addEventListener('click',()=>{state.paused=true;renderTeam();ui.teamOverlay.classList.remove('hidden');});$('teamCloseBtn').addEventListener('click',()=>{ui.teamOverlay.classList.add('hidden');state.paused=false;});
    $('helpBtn').addEventListener('click',()=>{state.paused=true;ui.helpOverlay.classList.remove('hidden');});$('helpCloseBtn').addEventListener('click',()=>{ui.helpOverlay.classList.add('hidden');state.paused=false;});
    $('saveBtn').addEventListener('click',()=>saveGame(true));
    $('attackBtn').addEventListener('click',()=>battleMove('attack'));$('skillBtn').addEventListener('click',()=>battleMove('skill'));$('guardBtn').addEventListener('click',()=>battleMove('guard'));$('captureBtn').addEventListener('click',()=>battleMove('capture'));$('fleeBtn').addEventListener('click',()=>battleMove('flee'));$('battleCloseBtn').addEventListener('click',()=>battleMove('flee'));
    addEventListener('keydown',e=>{const k=e.key.toLowerCase();state.keys.add(k);if(k===' '){e.preventDefault();fire();}if(k==='e')startBattle();if(k==='c')quickCapture();if(k==='t')$('teamBtn').click();});addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>state.keys.clear());
  }

  function loop(now){const dt=Math.min(.035,(now-state.last)/1000);state.last=now;update(dt);castScene();requestAnimationFrame(loop);}

  function init(){
    seedMonsters();loadGame();bind();renderTeam();updateHud();updateTargetHud();notify('MOVE WITH THE STICK. DRAG THE VIEW TO TURN.');
    window.__firemonStarted=true;
    requestAnimationFrame(loop);
  }

  init();
})();
