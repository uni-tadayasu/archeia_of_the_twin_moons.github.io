# AGENTS.md

## Project summary and core loop
近づいて斬る→技で崩す→殴り合いで奥義ゲージを溜める→奥義で一気に決める。物語では会話と戦闘を4章くり返します。

## How to play / controls
移動しながら通常攻撃（3段コンボ）で削り、灯力を使って技を、ゲージ満タンで奥義を放ちます。相手チームを全員倒せば勝ちです。
Controls: PC：WASD/矢印で移動、J・左クリックで攻撃、K・右クリックで技、Lで奥義、Shiftで防御、Spaceでジャンプ、Escで一時停止。スマホ：左スティックで移動、右の「斬・技・奥・防・跳」ボタン。

## Important files
- `/index.html` — entry point: importmap, canvas/DOM shell, script bootstrap
- `/rosebud-game-defaults.css` — project file
- `/rosebud-game-defaults.js` — game module
- `/rosie/README.md` — Rosie pre-built helper module
- `/rosie/roseblox.js` — Rosie pre-built helper module
- `/instant_db_config.js` — InstantDB multiplayer configuration
- `/instant_db.md` — project notes
- `/art_direction.md` — visual direction used for generated art
- `/sound_direction.md` — audio direction used for generated sound
- `/config.js` — game module
- `/data.js` — game module
- `/net.js` — game module
- `/game.js` — core game logic
- `/main.js` — game bootstrap and main loop

## Assets and audio
Images: `assets/arena-floor.webp`, `assets/twin-moon-sky.webp`
Models: `assets/models/brute-axe.glb`, `assets/models/hero-swordsman.glb`, `assets/models/mage-weaver.glb`, `assets/models/seraph-boss.glb`
Audio: `assets/audio/arte-burst.mp3`, `assets/audio/battle-theme.mp3`, `assets/audio/hit-impact.mp3`
Sound direction: - Music: heroic, driving orchestral battle loop with strings and brass, medium-high energy. - SFX: blade impact hit (frequent), radiant arcane burst for skills/finishers.
Playback note: reference media as `assets/...`; browsers start audio only after the first user gesture.

## Notes for future edits
main.js=描画・UI・入力・ストーリー・オンライン処理。game.js=Battle/Fighter（戦闘・AI・エフェクト。アリーナ半径13m、カメラは固定方向で戦闘全体を見る）。data.js=戦士と章のデータ。net.js=InstantDB（オンライン時のみ読み込み、受信データを検証）。config.js=運営キーのSHA-256（初期キーは"abc"、要変更）。オンラインはhitを攻撃側の端末で判定、協力モードのボスはホスト（idが小さい側）が操作。roseblox.jsは使っていない。

## Final validation status
Static: 0 blocking, 28 advisory; overall clean. Runtime behavior was not checked during generation.
Finished via the `finish` tool.
