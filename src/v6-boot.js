function setupStick() {
  const pad = $("movePad");
  const stick = $("moveStick");
  let pointerId = null;

  const move = event => {
    if (event.pointerId !== pointerId) return;
    const rect = pad.getBoundingClientRect();
    let dx = event.clientX - rect.left - rect.width / 2;
    let dy = event.clientY - rect.top - rect.height / 2;
    const max = rect.width * .27;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > max) {
      dx = dx / magnitude * max;
      dy = dy / magnitude * max;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    state.move.x = dx / max;
    state.move.y = dy / max;
  };

  const end = event => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    state.move.x = 0;
    state.move.y = 0;
    stick.style.transform = "translate(0, 0)";
  };

  pad.addEventListener("pointerdown", event => {
    pointerId = event.pointerId;
    pad.setPointerCapture(pointerId);
    move(event);
  });
  pad.addEventListener("pointermove", move);
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
}

function setupLook() {
  let pointerId = null;
  let lastX = 0;

  canvas.addEventListener("pointerdown", event => {
    pointerId = event.pointerId;
    lastX = event.clientX;
    canvas.setPointerCapture(pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (event.pointerId !== pointerId || state.paused) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    state.player.angle += dx * .008;
  });
  const end = event => { if (event.pointerId === pointerId) pointerId = null; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

function bindControls() {
  setupStick();
  setupLook();

  $("fireBtn").addEventListener("pointerdown", fire);
  $("duelBtn").addEventListener("click", startBattle);
  $("quickCaptureBtn").addEventListener("click", quickCapture);
  $("saveBtn").addEventListener("click", () => saveGame(true));

  $("teamBtn").addEventListener("click", () => {
    state.paused = true;
    renderTeam();
    ui.teamOverlay.classList.remove("hidden");
  });
  $("teamCloseBtn").addEventListener("click", () => {
    ui.teamOverlay.classList.add("hidden");
    state.paused = false;
  });

  $("helpBtn").addEventListener("click", () => {
    state.paused = true;
    ui.helpOverlay.classList.remove("hidden");
  });
  $("helpCloseBtn").addEventListener("click", () => {
    ui.helpOverlay.classList.add("hidden");
    state.paused = false;
  });

  $("attackBtn").addEventListener("click", () => battleMove("attack"));
  $("skillBtn").addEventListener("click", () => battleMove("skill"));
  $("guardBtn").addEventListener("click", () => battleMove("guard"));
  $("captureBtn").addEventListener("click", () => battleMove("capture"));
  $("fleeBtn").addEventListener("click", () => battleMove("flee"));
  $("battleCloseBtn").addEventListener("click", () => battleMove("flee"));

  addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    state.keys.add(key);
    if (key === " ") { event.preventDefault(); fire(); }
    if (key === "e") startBattle();
    if (key === "c") quickCapture();
    if (key === "t") $("teamBtn").click();
  });
  addEventListener("keyup", event => state.keys.delete(event.key.toLowerCase()));
  addEventListener("blur", () => state.keys.clear());
}

function gameLoop(now) {
  const dt = Math.min(.035, (now - state.last) / 1000);
  state.last = now;
  update(dt);
  castScene();
  requestAnimationFrame(gameLoop);
}

function initFiremon() {
  seedMonsters();
  loadGame();
  ensureSafePlayerPosition();
  bindControls();
  renderTeam();
  updateHud();
  updateTargetHud();
  notify("MOVE WITH THE STICK. DRAG THE VIEW TO TURN.");
  window.__firemonStarted = true;
  requestAnimationFrame(gameLoop);
}

initFiremon();
