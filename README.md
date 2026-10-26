# Turbo Rush 3D
Static HTML + vanilla JS + Three.js r160 (pinned jsDelivr import map). No build step, no backend.

## Run locally (ES modules need HTTP, not file://)
    python3 -m http.server 8000   # then open http://localhost:8000

## Deploy to Vercel
Push the folder to a Git repo and import it in Vercel as "Other" (no build command, output = root), or run `npx vercel --prod` inside it.

## Notes
- Cars, scenery, sky, particles and audio are all generated in code, so no third-party assets or attribution are used. Three.js is MIT-licensed.
- `assets/` folders are empty placeholders for future GLB/HDRI/audio files.
- Not yet included: GLTF model loading, bridges/tunnels, credits/privacy/terms/contact pages and ad slots.

## Damage, gearbox and levels (v2)
- `vehicle.js`: Health, CollisionDamage, Performance, Gearbox, EngineAudio, DamageVisuals, VehicleHUD.
- Every mode starts at 100% health, and damage is on in all of them. A new run restores it; repair (coins) is offered after a level and in the Free Drive pause menu.
- Levels: Time Attack, Traffic Challenge and Free Drive end at a finish line; Endless never ends. Traffic tier rises every `TIER_M` metres (1,250), and hazards appear from tier 2.
- Shift points (km/h): 60, 125, 170, 210, 250 (six gears). Press `G` to shift up manually; the gearbox automatically shifts down when speed falls. Audio is generated with Web Audio, with no external audio files or licences involved.
