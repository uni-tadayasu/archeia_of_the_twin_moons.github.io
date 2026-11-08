Riftfall Arena 2026-11-08 / Boss expansion and exact model character portraits

Changed/new files:
data.js
game.js
main.js
server/worker.js
model-runtime.js
index.html
gaizorg-adventure.js
arkeia-ui.js
field.js
glb-portrait.js
boss-abilities.js
exact-model-portraits.js

Features: Gaizorg fire aura 30sec no CD / burn and attack reduction 10sec / claw / projectile / hold flamethrower draining flux / original fire ultimate and ancient nova / permanent anti-stagger. Valdarion permanent anti-stagger / null circle 30sec / bound enemies released on hit / four chasing 1-hit shadow doubles without HP bars / void-element ultimate spells. Model-accurate select portraits rendered from actual GLB files using WebGL; no repaint of original textures. Preserves Valgard's final enhanced techniques and one-time HP0 second form. Adventure menu button under Choose Your Battle.

Deployment: replace only these files at the GitHub repository root while preserving directory structure. Separately upload your existing compact GLB(s) to assets/models/ with the exact path names in the model ZIPs. Also deploy server/worker.js to Cloudflare Workers. Do not delete other project files. The editor does not deploy to GitHub or Workers. Your original 3D models are NOT modified.

Caveat: runtime portraits require WebGL and may use the project's illustration as fallback. Online combat requires testing with Cloudflare/InstantDB role verification; multiplayer is not guaranteed from syntax validation alone.
