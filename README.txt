VALGARD EXACT MODEL INTEGRATION — 2026-11-07

Updates (copy into your existing game root):
- index.html
- main.js
- data.js
- game.js
- field.js
- net.js
- social.js
- valgard-motion.js
- model-runtime.js

Use the separately provided ORIGINAL iron-warlord(1).glb, without editing it.
Rename the file to iron-warlord.glb and place it at:
    assets/models/iron-warlord.glb

Keep the existing game files: model-image-fix.js, model-transport.js,
assets/audio/valgard-theme.mp3, assets/face-valgard.webp, and others.
DO NOT replace the model with an illustration or a generated mesh.
DO NOT delete the DRACO decoder or modify the working CSP settings.

Valgard: chief-only, ice skills, single form, previous dedicated BGM.
No Gaien is registered. Model vertices, UVs, textures, and original
material parameters are preserved in this update; character motion
uses whole-model pose and existing skeleton if available.

Network chief-only validation may also require the latest compatible
Cloudflare Worker, which is intentionally NOT included in this ZIP.
Back up existing files and deploy the patch to your game host.
After deploy, close the game tab, reopen and hard refresh if necessary.
