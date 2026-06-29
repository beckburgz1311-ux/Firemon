# Firemon

A mobile-first pixel FPS / monster-catching prototype.

## Current loop

- Explore a low-resolution ray-cast maze.
- Aim and shoot wild Firemon in real time.
- Weaken them to improve capture odds.
- Enter turn-based duels with Attack, Skill, Guard, Capture and Flee.
- Catch Firemon and swap your active team member.
- Survive enemy attacks outside battle.
- Save progress locally in the browser.

## Controls

### Phone
- Left thumb pad: move and strafe
- Drag the game view: aim
- Fire: shoot
- Duel: enter turn-based battle with the aimed target
- Cap: throw a quick capture capsule at a weakened target
- Team: view and swap captured Firemon

### Keyboard
- WASD: move
- Arrow keys: aim
- Space: fire
- E: duel
- C: quick capture
- T: team

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

All monsters, names and visuals are original placeholders created for Firemon.
