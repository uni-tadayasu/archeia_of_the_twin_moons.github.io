/* Riftfall Arena battle diagnostics + performance protection V11 (2026-11-09).
 * Drop-in replacement for battle-crash-diagnostics.js.
 * Preserves gameplay, AI, damage, hit detection, saves and audio.
 * Restricts GPU MSAA, DPR, dynamic shadows and visual-only FX.
 */
(() => {
  'use strict';
  if (window.__rfPerformancePatchV11) return;
  window.__rfPerformancePatchV11 = true;

  const KEY = 'rf-battle-v9-last-state';
  const HISTORY_KEY = 'rf-battle-v9-errors';
  const now = () => Date.now();
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
  const save = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const previous = read(KEY);
  const errors = Array.isArray(read(HISTORY_KEY)) ? read(HISTORY_KEY) : [];
  const report = (message, phase = 'error') => {
    const info = { time: new Date().toISOString(), phase, message: String(message || '不明なエラー').slice(0, 1300) };
    errors.push(info);
    while (errors.length > 8) errors.shift();
    save(HISTORY_KEY, errors);
    save(KEY, { phase, note: info.message, at: now() });
    return info;
  };
  window.__rfMarkBattlePhase = (phase, note = '') => {
    if (phase === 'error') report(note, phase);
    else save(KEY, { phase, note: String(note).slice(0, 300), at: now() });
  };
  window.addEventListener('error', event => {
    report((event?.message || 'JavaScript error') + ' ' + (event?.filename || '') + ':' + (event?.lineno || 0));
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    report('Unhandled promise: ' + (reason?.stack || reason?.message || String(reason)));
  });
  window.addEventListener('webglcontextlost', () => {
    report('WebGL context lost (graphics memory / driver / GPU)', 'gpu-error');
  }, true);

  function showDiagnostics(caption, message) {
    if (document.getElementById('rf-battle-v9-diagnostics')) return;
    const panel = document.createElement('aside');
    panel.id = 'rf-battle-v9-diagnostics';
    panel.style.cssText = 'position:fixed;z-index:200080;left:12px;right:12px;bottom:12px;margin:auto;max-width:740px;max-height:65vh;overflow:auto;border:1px solid #d9aa68;border-radius:9px;background:rgba(17,23,28,.98);color:#f4eedf;padding:15px 16px;box-shadow:0 12px 45px #000b;font:14px/1.65 system-ui,sans-serif;pointer-events:auto;white-space:normal';
    const title = document.createElement('strong'); title.textContent = caption;
    const desc = document.createElement('div'); desc.textContent = message; desc.style.marginTop = '6px';
    const log = document.createElement('pre'); log.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:160px;overflow:auto;opacity:.9';
    const output = () => ['Riftfall Arena crash report V11', navigator.userAgent,
      ...errors.map(e => `${e.time} ${e.phase} ${e.message}`)].join('\n');
    log.textContent = output().slice(-2400);
    const buttons = document.createElement('div'); buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:9px';
    const makeButton = (label, action) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:7px 12px;background:#254a37;color:white;border:1px solid #65b985;border-radius:4px;cursor:pointer';
      b.onclick = action; buttons.append(b);
    };
    makeButton('エラー情報をコピー', () => {
      const txt = output();
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).catch(() => {});
      else { try { const a = document.createElement('textarea'); a.value = txt; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); } catch {} }
    });
    makeButton('閉じる', () => panel.remove());
    panel.append(title, desc, log, buttons); document.body.append(panel);
  }
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (previous && now() - previous.at < 300000 && ['loading', 'battle', 'error', 'gpu-error'].includes(previous.phase)) {
        showDiagnostics('前回の戦闘が正常に終了しなかった可能性があります',
          '戦闘開始時の処理落ち、GPUメモリ不足、JavaScriptエラーが考えられます。エラー情報をコピーして確認できます。');
      } else if (!window.__arkeiaBootOk && !window.__riftfallGraphicsUnavailable) {
        showDiagnostics('ゲーム初期化エラー', 'main.js の初期化を確認してください。');
      }
    }, 10000);
  }, { once: true });
  window.__rfCrashDiagnostics = { report, showDiagnostics };

  // 1. Turn off multisample antialiasing before main.js requests the WebGL context.
  // Does not intercept 2D canvas, XHR, or any network request.
  const canvasGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, options, ...rest) {
    if (typeof type === 'string' && /^(webgl2?|experimental-webgl)$/i.test(type)) {
      return canvasGetContext.call(this, type,
        { ...(options || {}), antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }, ...rest);
    }
    return canvasGetContext.call(this, type, options, ...rest);
  };

  // 2. Avoid a 4x framebuffer on HiDPI desktops. Main.js manages scaling
  // dynamically and uses window.devicePixelRatio only as the starting ceiling.
  // V45: Keep native window.devicePixelRatio intact. The renderer now sets
  // a user-selectable, bounded pixel ratio in main.js (low/standard/high).
  // Redefining DPR globally prevented high quality and conflicted with resize.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;

  // 3. Gameplay timings are untouched. These runtime hooks only reduce graphics
  // processing; all attacks, hitboxes, spells, AI and multiplayer still tick.
  // Import the existing game module only after the game's own import has finished.
  // 3. Apply combat-only reductions through the exact game.js module instance.
  // This is a visual optimization, never an override of damage/AI/skill logic.
  async function installBattleFastPath() {
    if (window.__rfBattleFastPathInstalled) return;
    try {
      const gameResource = performance.getEntriesByType('resource')
        .find(entry => /(?:^|\/)game\.js(?:\?|$)/i.test(new URL(entry.name).pathname + new URL(entry.name).search))?.name;
      const gamePath = new URL('./game.js?v=55.21', document.baseURI).href;
      const dataResource = performance.getEntriesByType('resource')
        .find(entry => /(?:^|\/)data\.js(?:\?|$)/i.test(new URL(entry.name).pathname + new URL(entry.name).search))?.name;
      const dataPath = dataResource || new URL('./data.js?v=rf-minamoto-v48-20261111', document.baseURI).href;
      const [game, THREE, data] = await Promise.all([import(gamePath), import('three'), import(dataPath)]);
      // Set the visible character definition as well as the transport redirect.
      // The transport file also covers model URL lists computed during boot.
      if (data?.FIGHTERS?.crimson) data.FIGHTERS.crimson.model = 'assets/models/kraid-lightweight.glb';
      const Battle = game.Battle;
      if (!Battle?.prototype?.add || !THREE?.Vector3 || window.__rfBattleFastPathInstalled) return;
      const proto = Battle.prototype;
      const maxVisualNodes = touch ? 22 : 34;
      const maxCallbacks = touch ? 120 : 170;
      const max3DFxNodes = touch ? 13 : 21;
      // GLTF bounds are unnecessarily computed by visiting every vertex on
      // each cloned character in the old game. Cache approximate bind-pose
      // bounds across clones of the same geometry (material and animations stay
      // untouched). Fall back to normal behavior for every other Box3 query.
      const oldSetFromObject = THREE.Box3.prototype.setFromObject;
      const boundsCache = new Map();
      THREE.Box3.prototype.setFromObject = function(object, precise = false) {
        if (precise === true && object?.isGroup && typeof object.traverse === 'function') {
          const geometryIds = [];
          object.traverse(node => { if (node.isMesh && node.geometry?.uuid) geometryIds.push(node.geometry.uuid); });
          if (geometryIds.length && geometryIds.length <= 100) {
            const key = geometryIds.join('|');
            if (boundsCache.has(key)) return this.copy(boundsCache.get(key));
            const result = oldSetFromObject.call(this, object, false);
            boundsCache.set(key, result.clone());
            return result;
          }
        }
        return oldSetFromObject.call(this, object, precise);
      };

      const originalAdd = proto.add;
      const originalDispose = proto.dispose;
      proto.add = function(...args) {
        if (!this.__rfBattleShadowsOff) {
          this.__rfBattleShadowsOff = true;
          this.__rfShadowState = [];
          this.scene?.traverse?.(o => {
            if (o.isLight && o.castShadow) {
              this.__rfShadowState.push(o);
              o.castShadow = false;
            }
          });
          // The four dynamic point lights are used only for flash visuals, but
          // still expand Three.js lighting/shader permutations at every draw.
          for (const light of this.fxLights || []) light.visible = false;
        }
        const fighter = originalAdd.apply(this, args);
        fighter?.root?.traverse?.(o => {
          if (!o.isMesh) return;
          o.castShadow = false;
          o.receiveShadow = false;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const material of mats) {
            if (!material) continue;
            for (const key of ['map','normalMap','metalnessMap','roughnessMap','aoMap','emissiveMap']) {
              if (material[key]?.isTexture && material[key].anisotropy > 1) material[key].anisotropy = 1;
            }
          }
        });
        // Move NPC skeletons at 30Hz, while their gameplay and CPU decisions
        // continue at normal speed. The controlled player keeps full animation.
        if (!fighter?.isPlayer && fighter?.mixer) {
          const mixer = fighter.mixer;
          const nativeUpdate = mixer.update.bind(mixer);
          let animationAccum = 0;
          mixer.update = (dt) => {
            animationAccum += dt;
            if (animationAccum >= 1 / 30) {
              nativeUpdate(animationAccum);
              animationAccum = 0;
            }
            return mixer;
          };
        }
        return fighter;
      };
      proto.dispose = function(...args) {
        try { return originalDispose.apply(this, args); }
        finally {
          for (const light of this.__rfShadowState || []) {
            if (light?.isLight) light.castShadow = true;
          }
          this.__rfShadowState = [];
        }
      };
      // Effects methods listed here affect visuals only. Never throttle effect
      // callbacks in Battle.update: some of those carry hit/damage timing.
      for (const method of ['fxPop', 'burstFx']) {
        const original = proto[method];
        if (typeof original !== 'function') continue;
        proto[method] = function(...args) {
          const nodes = this.fx?.children?.length || 0;
          const callbacks = this.effects?.length || 0;
          if (nodes >= maxVisualNodes || callbacks >= maxCallbacks ||
              (method === 'burstFx' && nodes >= max3DFxNodes)) {
            // Return a harmless object for the fxPop API (which normally
            // returns an Object3D), including when third-party skill code
            // keeps the return value. No hit callbacks are skipped.
            return method === 'fxPop' ? new THREE.Object3D() : undefined;
          }
          return original.apply(this, args);
        };
      }
      window.__rfBattleFastPathInstalled = true;
      console.info('[Riftfall V11] Combat optimizer installed: lower GPU cost, cached model bounds, NPC animation 30Hz, capped visual FX.');
    } catch (error) {
      console.warn('[Riftfall V11] Could not attach game optimizer:', error?.message || error);
    }
  }
  window.addEventListener('arkeia-boot-ready', installBattleFastPath, { once: true });
  if (window.__arkeiaBootOk) installBattleFastPath();
})();
