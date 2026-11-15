/** One battle-owned CG presentation. No hit tests, damage, timing or network writes. */
import * as THREE from './vendor/three/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finitePoint = p => p && [p.x, p.y ?? 0, p.z].every(Number.isFinite);
const palette = [0xff9658, 0xa5e7ff, 0xd0aeff, 0x95edc0, 0xe9ae6a, 0xffe9af, 0xa38cfd, 0x67c7ff, 0xb4e885, 0xff7e90];
const live = new Set();
const totals = { swing: 0, cast: 0, impact: 0, projectile: 0, heal: 0, ultimate: 0, shockwave: 0, burst: 0 };
const WHITE = new THREE.Color(0xfff4dd);
const _camera = new THREE.Vector3(), _direction = new THREE.Vector3(), _side = new THREE.Vector3();

export function combatEffectBudget({ quality = 'high', profile, mobile = false, reducedMotion = false, disabled = false } = {}) {
  if (reducedMotion || disabled) return { emitters: mobile ? 8 : 12, particles: 0, segments: 8, layers: 1, lighting: false, reduced: true };
  if (quality === 'low' || profile === 'economy') return { emitters: mobile ? 8 : 12, particles: mobile ? 24 : 40, segments: 10, layers: 1, lighting: false, reduced: false };
  if (quality === 'standard' || profile === 'balanced') return { emitters: mobile ? 16 : 24, particles: mobile ? 64 : 112, segments: 14, layers: 2, lighting: !mobile, reduced: false };
  return { emitters: mobile ? 22 : 36, particles: mobile ? 96 : 192, segments: 20, layers: mobile ? 2 : 3, lighting: true, reduced: false };
}
function environment() {
  return { quality: globalThis.RF45Performance?.getQuality?.() || 'high', profile: globalThis.RF556Graphics?.profile?.(),
    mobile: !!globalThis.matchMedia?.('(pointer: coarse)').matches || (globalThis.navigator?.maxTouchPoints || 0) > 0,
    reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    disabled: !!globalThis.document?.body?.classList.contains('rf558-no-effects'), hidden: !!globalThis.document?.hidden };
}

// Read-only diagnostics: callers cannot trigger effects or obtain a Battle/Fighter.
export function getCombatFXDiagnostics() {
  const instances = [...live].map(fx => ({ emitters: fx.active.length + (fx.special?.active.length || 0), particles: fx.particles.length,
    budget: { ...fx.budget }, pooled: [...fx.pools.values()].reduce((sum, pool) => sum + pool.length, 0) }));
  return { activePresentations: instances.length, activeEmitters: instances.reduce((n, x) => n + x.emitters, 0),
    activeParticles: instances.reduce((n, x) => n + x.particles, 0), emitted: { ...totals }, instances };
}

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const arcFragment = `
  varying vec2 vUv; uniform vec3 tint; uniform float opacity;
  void main(){
    float ends=smoothstep(0.,.14,vUv.x)*(1.-smoothstep(.82,1.,vUv.x));
    float edge=pow(max(0.,sin(vUv.y*3.14159265)),1.3);
    float spine=pow(max(0.,1.-abs(vUv.y-.76)*7.),3.);
    vec3 color=mix(tint,vec3(1.,.96,.86),spine*.92);
    gl_FragColor=vec4(color,ends*edge*opacity);
  }`;
const ringFragment = `
  varying vec2 vUv; uniform vec3 tint; uniform float opacity;
  void main(){
    vec2 p=vUv-.5; float r=length(p);
    float ring=exp(-pow((r-.432)*90.,2.));
    float echo=exp(-pow((r-.39)*110.,2.))*.28;
    float haze=exp(-pow((r-.43)*25.,2.))*.14;
    gl_FragColor=vec4(tint,(ring+echo+haze)*opacity);
  }`;
function luminous(fragment, color = 0xffffff) {
  return new THREE.ShaderMaterial({ uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: 1 } }, vertexShader: vertex,
    fragmentShader: fragment, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false });
}
function ribbonGeometry() {
  const vertices = [], uv = [], indices = [], segments = 36;
  for (let i = 0; i <= segments; i++) {
    const progress = i / segments, angle = -.96 + progress * 2.45;
    // The head is narrow and bright; the curved body follows the blade sweep.
    const outer = 1, inner = .58 + .35 * Math.pow(progress, 3);
    for (const radius of [inner, outer]) vertices.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    uv.push(progress, 0, progress, 1);
    if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}
function particleMesh() {
  const geometry = new THREE.BufferGeometry();
  for (const [name, width] of [['position', 3], ['color', 3], ['alpha', 1], ['size', 1]]) {
    geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(192 * width), width).setUsage(THREE.DynamicDrawUsage));
  }
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec3 color;attribute float alpha;attribute float size;varying vec3 vColor;varying float vAlpha;
      void main(){vColor=color;vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*320./max(1.,-p.z),1.,22.);}`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float r=length(p);float a=exp(-r*r*24.)*(1.-smoothstep(.34,.5,r));gl_FragColor=vec4(vColor,a*vAlpha);}` });
  const mesh = new THREE.Points(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = 'Celestial light motes';
  return mesh;
}

export class CelestialCombatFX {
  constructor(battle, options = {}) {
    this.battle = battle; this.readEnvironment = options.environment || environment;
    this.loader = options.loader || new THREE.TextureLoader(); this.specialFactory = options.specialFactory || battle.createBespokePresentation;
    this.group = new THREE.Group(); this.group.name = 'Celestial combat presentation'; battle.scene.add(this.group);
    this.plane = new THREE.PlaneGeometry(1, 1); this.arc = ribbonGeometry();
    this.active = []; this.particles = []; this.pools = new Map(); this.textures = new Map(); this.releasedTextures = new WeakSet(); this.recent = new Map();
    this.particleMesh = particleMesh(); this.group.add(this.particleMesh);
    this.clock = 0; this.sequence = 0; this.disposed = false; this.budget = combatEffectBudget(this.readEnvironment());
    live.add(this);
  }
  texture(kind) {
    if (!this.textures.has(kind)) {
      const asset = kind === 'seal' ? './celestial/spell-seal.webp' : './rf558/luminous-flare.webp';
      const texture = this.loader.load(new URL(asset, import.meta.url).href, loaded => { if (this.disposed) this.releaseTexture(loaded); });
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(kind, texture);
    }
    return this.textures.get(kind);
  }
  canEmit(pos) {
    if (this.disposed || !finitePoint(pos) || this.readEnvironment().hidden) return false;
    this.budget = combatEffectBudget(this.readEnvironment()); return true;
  }
  mark(kind) { totals[kind] = (totals[kind] || 0) + 1; }
  reserve(priority) {
    const limit = this.budget.emitters - (this.special?.active.length || 0);
    while (this.active.length >= limit) {
      if (limit <= 0) return false;
      let victim = -1, lowest = priority + .01;
      for (let i = 0; i < this.active.length; i++) if (this.active[i].priority < lowest) { lowest = this.active[i].priority; victim = i; }
      if (victim < 0) return false;
      this.recycle(this.active.splice(victim, 1)[0]);
    }
    return true;
  }
  create(kind) {
    let object;
    if (kind === 'arc') object = new THREE.Mesh(this.arc, luminous(arcFragment));
    else if (kind === 'ring') object = new THREE.Mesh(this.plane, luminous(ringFragment));
    else if (kind === 'trail') {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(20 * 6), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(20 * 4), 2).setUsage(THREE.DynamicDrawUsage));
      const indices = []; for (let i = 0; i < 19; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geometry.setIndex(indices); geometry.setDrawRange(0, 0);
      object = new THREE.Mesh(geometry, luminous(arcFragment)); object.frustumCulled = false; object.userData.ownedGeometry = true;
    } else if (kind === 'seal') object = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ map: this.texture('seal'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    else object = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture('flare'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    object.name = `Celestial ${kind}`; object.renderOrder = kind === 'seal' || kind === 'ring' ? 3 : 5;
    return object;
  }
  emit(kind, pos, color, size, life, options = {}) {
    if (!Number.isFinite(size) || !Number.isFinite(life) || life <= 0) return null;
    if (kind.startsWith('tenshi-') && this.specialFactory && this.canEmit(pos)) {
      this.special ||= this.specialFactory();
      return this.special.emit(kind, pos, color, size, life, options);
    }
    if (!this.canEmit(pos) || !this.reserve(options.priority ?? 1)) return null;
    const pool = this.pools.get(kind) || []; this.pools.set(kind, pool);
    const object = pool.pop() || this.create(kind);
    object.position.set(pos.x, pos.y ?? 0, pos.z); object.rotation.set(0, 0, 0); object.scale.set(1, 1, 1);
    const shade = color ?? 0xffedc5;
    if (object.material.uniforms) object.material.uniforms.tint.value.set(shade);
    else object.material.color.set(shade);
    const entry = { object, kind, age: -(options.delay || 0), life: Math.max(.06, life), priority: options.priority ?? 1,
      size: clamp(size || 1, .02, 26), color: shade, opacity: (options.opacity ?? .82) * (this.budget.reduced ? .62 : 1),
      from: options.from ?? .65, to: options.to ?? 1.45, yaw: options.yaw || 0, spin: this.budget.reduced ? 0 : options.spin || 0,
      tilt: options.tilt || 0, rise: this.budget.reduced ? 0 : options.rise || 0, stretch: options.stretch ?? 1, originY: pos.y ?? 0, dead: false };
    object.visible = entry.age >= 0;
    this.active.push(entry); this.group.add(object); this.paint(entry, 0); return entry;
  }
  paint(entry, progress) {
    const object = entry.object;
    const eased = 1 - Math.pow(1 - progress, 3), size = entry.size * (entry.from + (entry.to - entry.from) * eased);
    const fade = entry.opacity * Math.pow(1 - progress, entry.kind === 'ring' ? 1.1 : 1.65);
    if (object.material.uniforms) object.material.uniforms.opacity.value = fade;
    else object.material.opacity = fade;
    object.position.y = entry.originY + entry.rise * Math.max(0, entry.age);
    if (entry.kind === 'arc') { object.scale.set(size, size, size * entry.stretch); object.rotation.set(0, entry.yaw + entry.spin * Math.max(0, entry.age), entry.tilt); }
    else if (entry.kind === 'seal' || entry.kind === 'ring') { object.rotation.set(-Math.PI / 2, 0, entry.yaw + entry.spin * Math.max(0, entry.age)); object.scale.set(entry.kind === 'seal' ? size * 1.5 : size, size, 1); }
    else { object.scale.set(size, size * entry.stretch, 1); object.material.rotation = entry.yaw; }
  }
  motes(pos, color, power = 1, options = {}) {
    if (!this.canEmit(pos) || this.budget.particles === 0) return;
    const count = Math.min(options.count || Math.ceil(8 * power), this.budget.particles - this.particles.length);
    const tint = new THREE.Color(color ?? 0xffffff).lerp(WHITE, .28);
    const phase = ++this.sequence * 2.399963;
    const direction = options.direction;
    for (let i = 0; i < count; i++) {
      const angle = phase + i * 2.399963, speed = (.75 + (i % 5) * .35) * power, heal = options.heal;
      const radius = heal ? (.35 + (i % 4) * .18) * power : .05;
      this.particles.push({ x: pos.x + Math.sin(angle) * radius, y: (pos.y || 0) + (heal ? (i % 3) * .15 : 0), z: pos.z + Math.cos(angle) * radius,
        vx: (heal ? .08 : Math.sin(angle) * speed) + (direction?.x || 0) * speed * .45,
        vy: heal ? 1.2 + (i % 5) * .22 : .8 + (i % 4) * .55,
        vz: (heal ? .08 : Math.cos(angle) * speed) + (direction?.z || 0) * speed * .45,
        gravity: heal ? 0 : -4.5, age: -(options.delay || 0), life: heal ? .95 : .36 + (i % 5) * .065,
        size: (heal ? .11 : .085) * Math.sqrt(power), color: tint });
    }
  }
  unique(kind, pos, interval = .055) {
    const key = `${kind}:${Math.round(pos.x * 2)}:${Math.round(pos.z * 2)}`;
    if (this.clock - (this.recent.get(key) ?? -Infinity) < interval) return false;
    this.recent.set(key, this.clock);
    if (this.recent.size > 80) this.recent.delete(this.recent.keys().next().value);
    return true;
  }
  bespoke(fighter, method, ...args) {
    if (fighter.key !== 'tenshi' || !this.specialFactory) return false;
    this.special ||= this.specialFactory(); this.special[method](fighter, ...args); return true;
  }
  swing(fighter) {
    const pos = { x: fighter.pos.x, y: .9 + (fighter.y || 0), z: fighter.pos.z };
    if (!this.canEmit(pos)) return;
    if (this.bespoke(fighter, 'swing')) { this.mark('swing'); return; }
    const attack = fighter.def.light, color = attack.color ?? fighter.def.color, combo = (fighter.combo || 0) % 3;
    const range = clamp(Number(attack.range) || 2.2, 1.1, 6), side = combo % 2 ? -1 : 1;
    const entry = this.emit('arc', pos, color, range * 1.05, this.budget.reduced ? .24 : .30, { priority: 3, from: .92, to: 1.03, yaw: fighter.facing - .12 * side, spin: side * 1.2, tilt: combo === 2 ? -.3 : side * .13, opacity: .94 });
    if (!entry) return; this.mark('swing');
    if (attack.spin) this.emit('ring', { ...pos, y: .11 }, color, range * 2.1, .38, { priority: 2, from: .75, to: 1.1, opacity: .62 });
    else if (this.budget.layers > 1) this.emit('arc', { ...pos, y: pos.y + .025 }, 0xfff3d8, range * .95, .22, { priority: 2, from: .94, to: 1, yaw: fighter.facing + .08, tilt: side * .14, opacity: .48, stretch: .95 });
    const direction = { x: Math.sin(fighter.facing), z: Math.cos(fighter.facing) };
    this.motes({ x: pos.x + direction.x * range * .8, y: pos.y, z: pos.z + direction.z * range * .8 }, color, .75, { count: combo === 2 ? 9 : 4, direction });
  }
  cast(fighter, color, spec = {}, strong = false) {
    const pos = { x: fighter.pos.x, y: .075, z: fighter.pos.z };
    if (!this.canEmit(pos)) return;
    const ultimate = strong || spec === fighter.def.over || spec === fighter.def.hi || spec.hi;
    if (this.bespoke(fighter, 'cast', color, spec, ultimate)) { this.mark(ultimate ? 'ultimate' : 'cast'); return; }
    const shade = color ?? palette[spec.elem] ?? 0xc5dfff;
    const entry = this.emit('seal', pos, shade, ultimate ? 7.2 : 3.8, ultimate ? 1.05 : .66,
      { priority: ultimate ? 4 : 3, from: .76, to: 1.08, yaw: fighter.facing, spin: ultimate ? -.35 : .38, opacity: .92 });
    if (!entry) return; this.mark(ultimate ? 'ultimate' : 'cast');
    if (this.budget.layers > 1) this.emit('ring', { ...pos, y: .09 }, shade, ultimate ? 9 : 4.6, ultimate ? .85 : .52, { priority: 2, from: .24, to: 1.15, opacity: .75 });
    if (this.budget.layers > 1) this.emit('flare', { ...pos, y: 1 + (fighter.y || 0) }, shade, ultimate ? 2 : .92, .33, { priority: 2, from: .65, to: 1.5, stretch: ultimate ? 2.4 : 1.2, opacity: .62 });
    if (ultimate && this.budget.layers > 2) {
      this.emit('seal', { ...pos, y: .12 }, 0xffefcd, 4.7, .95, { priority: 3, from: 1.2, to: .82, spin: .65, delay: .10, opacity: .48 });
      this.emit('ring', { ...pos, y: .1 }, shade, 10, .8, { priority: 3, from: .1, to: 1.1, delay: .18, opacity: .7 });
    }
    this.motes({ ...pos, y: .35 }, shade, ultimate ? 2 : 1.2, { count: ultimate ? 30 : 12, heal: true });
    if (this.budget.lighting) this.battle.flashLight?.({ ...pos, y: 1 }, shade, ultimate ? 1.2 : .5, .26);
  }
  impact(pos, color, direction, { power = 1, guarded = false } = {}) {
    if (!this.canEmit(pos) || !this.unique('impact', pos)) return;
    const shade = guarded ? 0xb3e5ff : color ?? 0xffdda1;
    const force = clamp(power, .55, 2);
    if (!this.emit('flare', pos, shade, force * (guarded ? 1.05 : 1.65), .23, { priority: 4, from: .4, to: 1.25, opacity: .92, stretch: guarded ? .65 : 1 })) return;
    this.mark('impact');
    if (this.budget.layers > 1) this.emit('ring', { x: pos.x, y: .1, z: pos.z }, shade, force * 2.7, .39, { priority: 2, from: .3, to: 1.2, opacity: guarded ? .7 : .4 });
    this.motes(pos, shade, force, { count: guarded ? 8 : 13, direction });
    if (this.budget.lighting && !guarded) this.battle.flashLight?.(pos, shade, .35 * force, .15);
  }
  burst(pos, elem, color, power = 1, grand = false) {
    if (!this.canEmit(pos) || !this.unique('burst', pos, .065)) return;
    const strength = clamp(power, .45, 2.6), shade = color ?? palette[elem] ?? 0xb6dfff;
    if (!this.emit('flare', { x: pos.x, y: Math.max(.5, pos.y || 0), z: pos.z }, shade, strength * 1.65, grand ? .48 : .3, { priority: grand ? 3 : 1, from: .35, to: 1.55, opacity: grand ? .76 : .52 })) return;
    this.mark('burst');
    if (grand || this.budget.layers > 1) this.emit('ring', { x: pos.x, y: .1, z: pos.z }, shade, strength * 4, .65, { priority: 2, from: .25, to: 1.2, opacity: .73 });
    this.motes(pos, shade, strength, { count: grand ? 25 : 9 });
  }
  shockwave(pos, color, radius, delay = 0) {
    if (!this.canEmit(pos)) return;
    const diameter = clamp(radius * 2.2, 1, 25);
    if (!this.emit('ring', { ...pos, y: .11 }, color, diameter, .55, { priority: 3, from: .12, to: 1.1, delay, opacity: .95 })) return;
    this.mark('shockwave');
    if (this.budget.layers > 1) this.emit('seal', { ...pos, y: .08 }, color, diameter * .8, .64, { priority: 2, from: .7, to: 1.05, delay, spin: .3, opacity: .62 });
    this.motes({ ...pos, y: .3 }, color, clamp(radius * .4, .7, 2), { count: 18, delay });
  }
  heal(pos, color = 0xa2ffc9, radius = 3) {
    if (!this.canEmit(pos)) return;
    if (!this.emit('seal', { x: pos.x, y: .09, z: pos.z }, color, clamp(radius * 1.8, 2, 10), .9, { priority: 3, from: .82, to: 1.08, spin: -.35, opacity: .72 })) return;
    this.mark('heal');
    if (this.budget.layers > 1) this.emit('flare', { x: pos.x, y: 1, z: pos.z }, color, 1.5, .75, { priority: 1, stretch: 2.1, rise: .75, opacity: .34 });
    this.motes({ x: pos.x, y: .3, z: pos.z }, color, 1.5, { count: 22, heal: true });
  }
  shards(pos, color, size) { if (this.canEmit(pos) && this.unique('shards', pos, .08)) this.motes(pos, color, clamp(size || 1, .4, 2), { count: 10 }); }
  spark(pos, color, size = 1) { if (this.canEmit(pos) && this.unique('spark', pos, .055)) this.emit('flare', pos, color, Math.max(.25, size * 1.4), .2, { priority: 1, from: .5, to: 1.1, opacity: .58 }); }
  puff(pos, color, size = 1) { if (this.canEmit(pos) && !this.budget.reduced && this.unique('puff', pos, .11)) this.motes(pos, color, Math.max(.35, size), { count: 2 }); }
  painted(pos, elem, slot, size, life, options = {}) {
    if (!this.canEmit(pos)) return null;
    const shade = palette[((Number(elem) || 0) % palette.length + palette.length) % palette.length];
    // Smoke and scattered glints share the point batch; keep readable ground
    // telegraphs and blade arcs as the high-priority geometry layers.
    if ([3, 7, 9].includes(slot) && !options.flat) { this.motes(pos, shade, clamp(size * .3, .4, 2), { count: slot === 3 ? 3 : 6, delay: options.delay }); return null; }
    const kind = options.flat ? (slot === 5 ? 'seal' : 'ring') : slot === 6 ? 'arc' : 'flare';
    const entry = this.emit(kind, pos, shade, Math.min(size, kind === 'flare' ? 6 : 18), life,
      { priority: options.flat ? 2 : 0, delay: options.delay, from: 1, to: options.grow ?? 1.6, yaw: options.rot || 0,
        spin: options.spin || 0, rise: options.rise || 0, stretch: slot === 2 ? 1.8 : 1, opacity: (options.op ?? 1) * (kind === 'flare' ? .55 : .8) });
    return entry?.object || null;
  }
  afterimage(fighter, color) {
    const pos = { x: fighter.pos.x, y: 1 + (fighter.y || 0), z: fighter.pos.z };
    if (!this.canEmit(pos) || this.budget.reduced || !this.unique('dash', pos, .08)) return;
    this.emit('arc', pos, color, 1.6, .23, { priority: 0, from: .8, to: 1.1, yaw: fighter.facing + 1.1, opacity: .32, tilt: .3 });
  }
  projectile(pos, color, radius = .3) {
    const entry = this.emit('trail', pos, color, 1, 6, { priority: 2, opacity: .76 });
    if (!entry) return { stop() {} };
    entry.source = pos; entry.history = []; entry.width = clamp(radius * .65, .09, .65); entry.stopped = false;
    entry.object.position.set(0, 0, 0); entry.object.rotation.set(0, 0, 0); entry.object.scale.set(1, 1, 1);
    this.mark('projectile');
    return { stop: () => { if (!entry.dead) { entry.stopped = true; entry.source = null; } } };
  }
  tickTrail(entry, dt) {
    entry.history.forEach(point => point.age += dt);
    entry.history = entry.history.filter(point => point.age < .32);
    const source = entry.source, newest = entry.history[entry.history.length - 1];
    if (source && finitePoint(source) && (!newest || Math.hypot(source.x - newest.x, source.y - newest.y, source.z - newest.z) > .04)) {
      entry.history.push({ x: source.x, y: source.y, z: source.z, age: 0 });
      if (entry.history.length > this.budget.segments) entry.history.shift();
    }
    if (entry.stopped && !entry.history.length) return false;
    const history = entry.history, geometry = entry.object.geometry, positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < history.length; i++) {
      const point = history[i], next = history[Math.min(i + 1, history.length - 1)], previous = history[Math.max(0, i - 1)];
      _direction.set(next.x - previous.x, next.y - previous.y, next.z - previous.z).normalize();
      _camera.copy(this.battle.camera?.position || { x: 0, y: 8, z: 12 }).sub(point);
      _side.crossVectors(_direction, _camera).normalize();
      if (_side.lengthSq() < .01) _side.set(1, 0, 0);
      const taper = Math.min(1, (i + 1) / 3) * (1 - point.age / .32), width = entry.width * taper;
      positions.setXYZ(i * 2, point.x - _side.x * width, point.y - _side.y * width, point.z - _side.z * width);
      positions.setXYZ(i * 2 + 1, point.x + _side.x * width, point.y + _side.y * width, point.z + _side.z * width);
      uv.setXY(i * 2, i / Math.max(1, history.length - 1), 0); uv.setXY(i * 2 + 1, i / Math.max(1, history.length - 1), 1);
    }
    positions.needsUpdate = uv.needsUpdate = true; geometry.setDrawRange(0, Math.max(0, history.length - 1) * 6);
    entry.object.material.uniforms.opacity.value = entry.opacity;
    return entry.age < entry.life;
  }
  tick(dt) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    // An inactive tab cannot leave a stale trail or resume with a burst of motes.
    const elapsed = Math.min(dt, 8) * (this.battle.slowmo > 0 ? .4 : 1); this.clock += elapsed; this.budget = combatEffectBudget(this.readEnvironment());
    this.special?.tick(Math.min(dt, 8));
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i]; entry.age += elapsed;
      if (entry.kind === 'trail') {
        if (!this.tickTrail(entry, elapsed)) { this.recycle(entry); this.active.splice(i, 1); }
        continue;
      }
      if (entry.age >= entry.life) { this.recycle(entry); this.active.splice(i, 1); continue; }
      entry.object.visible = entry.age >= 0;
      if (entry.age >= 0) this.paint(entry, entry.age / entry.life);
    }
    while (this.active.length + (this.special?.active.length || 0) > this.budget.emitters && this.active.length) {
      let index = 0; for (let i = 1; i < this.active.length; i++) if (this.active[i].priority < this.active[index].priority) index = i;
      this.recycle(this.active.splice(index, 1)[0]);
    }
    if (this.particles.length > this.budget.particles) this.particles.splice(0, this.particles.length - this.budget.particles);
    const attributes = this.particleMesh.geometry.attributes;
    let written = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]; particle.age += elapsed;
      if (particle.age >= particle.life) { this.particles.splice(i, 1); continue; }
      if (particle.age < 0) continue;
      const t = particle.age;
      attributes.position.setXYZ(written, particle.x + particle.vx * t, Math.max(.07, particle.y + particle.vy * t + .5 * particle.gravity * t * t), particle.z + particle.vz * t);
      attributes.color.setXYZ(written, particle.color.r, particle.color.g, particle.color.b);
      attributes.alpha.setX(written, Math.pow(1 - t / particle.life, 1.5)); attributes.size.setX(written, particle.size); written++;
    }
    this.particleMesh.geometry.setDrawRange(0, written); this.particleMesh.visible = written > 0;
    if (written) for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
  }
  recycle(entry) {
    entry.dead = true; entry.source = null; entry.history = null; entry.object.removeFromParent();
    const pool = this.pools.get(entry.kind);
    if (pool.length < (entry.kind === 'trail' ? 3 : 4)) pool.push(entry.object); else this.disposeObject(entry.object);
  }
  releaseTexture(texture) { if (!this.releasedTextures.has(texture)) { this.releasedTextures.add(texture); texture.dispose(); } }
  disposeObject(object) { object.material.dispose(); if (object.userData.ownedGeometry) object.geometry.dispose(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; live.delete(this); this.special?.dispose();
    for (const entry of this.active) { entry.dead = true; entry.source = null; entry.history = null; this.disposeObject(entry.object); }
    for (const pool of this.pools.values()) for (const object of pool) this.disposeObject(object);
    this.particleMesh.geometry.dispose(); this.particleMesh.material.dispose(); this.plane.dispose(); this.arc.dispose();
    for (const texture of this.textures.values()) this.releaseTexture(texture);
    this.group.clear(); this.group.removeFromParent(); this.active.length = this.particles.length = 0;
    this.pools.clear(); this.textures.clear(); this.recent.clear();
  }
}
export function presentationFor(battle) { return (battle.presentation ??= new CelestialCombatFX(battle)); }
