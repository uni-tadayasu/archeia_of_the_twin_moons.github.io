EMERGENCY MODEL PATCH - Riftfall Arena

This is a DELTA patch: overlay these 5 files at the game web root.
Files: index.html, main.js, game.js, field.js, model-runtime.js.

Do NOT delete assets/models/. The source project contains 20 fighter GLB
files. This patch does not include them and cannot replace missing files.

If the game shows HTTP 404 on any model, upload that exact GLB to
assets/models/ on your public hosting service. Keep filename case.
For GitHub Pages, ZIP archives are not automatically unpacked.

Restart Chrome with Ctrl+Shift+R after publishing.
No Cloudflare Worker or save-data edits are needed.
