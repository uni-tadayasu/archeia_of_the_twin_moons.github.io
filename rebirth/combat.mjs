/** Deterministic, renderer-independent combat. All distances are world metres. */
const TAU = Math.PI * 2;
const STEP = 1 / 120;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createObstacles(stage = 'moon') {
  if (stage === 'castle' || stage === 'keep') {
    return [-14, 14].flatMap(x => [-20, -6, 8, 22].map(z => ({ kind: 'rect', x, z, width: 2.2, depth: 2.2 })));
  }
  if (stage === 'forest' || stage === 'river') {
    return [[-12, -19], [13, -12], [-14, 6], [12, 20], [-6, -27], [17, 2]].map(([x, z]) => ({ kind: 'circle', x, z, radius: 1.25 }));
  }
  return [-13, 13].flatMap(x => [-18, 0, 18].map(z => ({ kind: 'circle', x, z, radius: 1.1 })));
}

function actor(def, id, team, x, z) {
  const maxHp = Math.max(1, finite(def.hp, 1000));
  return {
    id, key: def.id || def.key || (team ? 'garou' : 'rowen'), def, team, x, z, y: 0,
    hp: maxHp, maxHp, energy: 100, maxEnergy: 100, ultimate: 0,
    facing: team ? 0 : Math.PI, state: 'idle', actionName: '', actionTime: 0,
    hitFlash: 0, dead: false, radius: .55, guarding: false, invulnerable: 0,
    attackCooldown: 0, skillCooldowns: [0, 0], dodgeCooldown: 0, healCooldown: 0,
    comboStep: 0, comboTimer: 0, targetId: null, vx: 0, vz: 0,
    aiTimer: .7 + (id % 4) * .23, aiSkillTimer: 2.5 + (id % 4) * .8,
    stun: 0, dashTime: 0, dashX: 0, dashZ: 0, dashSpec: null, dashHits: new Set(),
    kills: 0, damageDealt: 0, damageTaken: 0,
  };
}

export class Combat {
  constructor({ fighter, enemies = [], mode = 'duel', difficulty = 50, stage = 'moon', seed = 1, wave = 1 } = {}) {
    if (!fighter) throw new TypeError('Combat requires a fighter definition');
    this.mode = mode;
    this.difficulty = clamp(finite(difficulty, 50), 1, 100);
    this.stage = stage;
    this.wave = Math.max(1, Math.floor(finite(wave, 1)));
    this.bounds = { minX: -22, maxX: 22, minZ: -32, maxZ: 32 };
    this.obstacles = createObstacles(stage);
    this.seed = (finite(seed, 1) >>> 0) || 1;
    this.player = actor(fighter, 1, 0, 0, 10);
    this.foes = enemies.map((def, i) => {
      const columns = Math.min(5, enemies.length);
      const result = actor(def, i + 2, 1, ((i % columns) - (columns - 1) / 2) * 3.6, 2 - Math.floor(i / columns) * 5.3);
      this.resolvePosition(result);
      return result;
    });
    this.entities = [this.player, ...this.foes];
    this.projectiles = [];
    this.effects = [];
    this.events = [];
    this.pending = [];
    this.elapsed = 0;
    this.status = 'playing';
    this.kills = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTime = 0;
    this._nextId = 1000;
    this._accumulator = 0;
    this._input = {};
    this._pendingInput = {};
    this.target = this.foes[0] || null;
  }

  random() {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  drainEvents() { return this.events.splice(0); }

  snapshot() {
    return {
      elapsed: this.elapsed, status: this.status, kills: this.kills,
      combo: this.combo, bestCombo: this.bestCombo,
      player: { hp: this.player.hp, maxHp: this.player.maxHp, energy: this.player.energy, ultimate: this.player.ultimate },
      remaining: this.foes.filter(f => !f.dead).length,
    };
  }

  /** Handles a maximum 100 ms per frame to avoid a tab-return damage burst. */
  update(dt, input = {}) {
    const duration = clamp(finite(dt, 0), 0, .1);
    if (!duration) return;
    this._input = {
      ...input, x: clamp(finite(input.x, 0), -1, 1), z: clamp(finite(input.z, 0), -1, 1),
    };
    // Preserve a tapped action if the render frame is shorter than a simulation step.
    for (const name of ['attack', 'skill', 'skill2', 'over', 'hi', 'heal', 'dash']) {
      this._pendingInput[name] ||= !!input[name];
    }
    this._accumulator += duration;
    while (this._accumulator + 1e-9 >= STEP) {
      this._accumulator -= STEP;
      this.step(STEP, { ...this._input, ...Object.fromEntries(Object.entries(this._pendingInput).map(([key, value]) => [key, value || !!this._input[key]])) });
      this._pendingInput = {};
    }
  }

  step(dt, input) {
    this.tickVisuals(dt);
    if (this.status !== 'playing') return;
    this.elapsed += dt;
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (!this.comboTime) this.combo = 0;
    for (const entity of this.entities) this.tickActor(entity, dt);
    this.controlPlayer(dt, input);
    for (const enemy of this.foes) this.controlEnemy(enemy, dt);
    this.tickPending(dt);
    this.tickProjectiles(dt);
    this.separateActors();
    this.target = this.nearest(this.player);
    this.player.targetId = this.target?.id ?? null;
    this.finishIfNeeded();
  }

  tickVisuals(dt) {
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
  }

  tickActor(entity, dt) {
    for (const key of ['hitFlash', 'invulnerable', 'attackCooldown', 'dodgeCooldown', 'healCooldown', 'comboTimer', 'stun']) {
      entity[key] = Math.max(0, entity[key] - dt);
    }
    entity.skillCooldowns = entity.skillCooldowns.map(cooldown => Math.max(0, cooldown - dt));
    entity.actionTime = Math.max(0, entity.actionTime - dt);
    entity.energy = Math.min(entity.maxEnergy, entity.energy + (entity.guarding ? 2 : 8.5) * dt);
    if (entity.dead) return;
    if (!entity.comboTimer) entity.comboStep = 0;
    if (entity.dashTime > 0) {
      entity.dashTime = Math.max(0, entity.dashTime - dt);
      const speed = entity.dashSpec ? clamp(finite(entity.dashSpec.speed, 21), 8, 34) : 23;
      this.move(entity, entity.dashX * speed * dt, entity.dashZ * speed * dt);
      if (entity.dashSpec) {
        for (const target of this.opponents(entity)) {
          if (!entity.dashHits.has(target.id) && distance(entity, target) < 2.3) {
            entity.dashHits.add(target.id);
            this.damage(entity, target, finite(entity.dashSpec.dmg, 90), { kind: 'dash', knockback: 1.2 });
          }
        }
      }
      if (!entity.dashTime) entity.dashSpec = null;
    }
    if (entity.actionTime <= 0 && entity.dashTime <= 0) entity.state = 'idle';
    entity.y = entity.state === 'dodge' ? Math.sin(Math.min(1, entity.actionTime / .32) * Math.PI) * .35 : 0;
  }

  opponents(entity) { return (entity.team === 0 ? this.foes : [this.player]).filter(target => !target.dead); }

  nearest(entity, maxDistance = Infinity) {
    let target = null;
    let best = maxDistance;
    for (const candidate of this.opponents(entity)) {
      const d = distance(entity, candidate);
      if (d < best) { best = d; target = candidate; }
    }
    return target;
  }

  faceTarget(entity, target) {
    if (target) entity.facing = Math.atan2(target.x - entity.x, target.z - entity.z);
    entity.targetId = target?.id ?? null;
  }

  controlPlayer(dt, input) {
    const p = this.player;
    if (p.dead) return;
    const magnitude = Math.hypot(input.x, input.z);
    const mx = magnitude > 1 ? input.x / magnitude : input.x;
    const mz = magnitude > 1 ? input.z / magnitude : input.z;
    const moving = magnitude > .05;
    p.guarding = !!input.guard && p.dashTime <= 0 && p.actionTime <= 0 && p.stun <= 0;
    if (p.stun > 0) return;
    if (input.dash && p.dodgeCooldown <= 0 && p.energy >= 12 && p.dashTime <= 0) {
      const direction = moving ? Math.atan2(mx, mz) : p.facing;
      p.energy -= 12;
      p.dashX = Math.sin(direction); p.dashZ = Math.cos(direction);
      p.facing = direction; p.dashTime = .22; p.actionTime = .32;
      p.state = 'dodge'; p.invulnerable = .32; p.dodgeCooldown = .8;
      p.guarding = false; p.dashSpec = null;
      this.emitAction(p, '回避', 'dodge');
      this.effect('dash', p.x, p.z, 1, p.def.color, .35, { facing: direction });
      return;
    }
    if (p.dashTime > 0) return;
    if (p.actionTime <= 0 && !p.guarding) {
      if (input.hi && p.ultimate >= 100 && p.energy >= 50 && p.def.hi) {
        p.ultimate = 0; p.energy -= 50;
        this.cast(p, p.def.hi, 'hi');
      } else if (input.over && p.ultimate >= 100) {
        p.ultimate = 0;
        this.cast(p, p.def.over || { name: '双月一閃', kind: 'shockwave', dmg: 240, radius: 7 }, 'over');
      } else if (input.heal && p.healCooldown <= 0 && p.energy >= 35 && p.hp < p.maxHp) {
        p.energy -= 35; p.healCooldown = 10; p.actionTime = .65; p.state = 'skill';
        const amount = Math.min(p.maxHp - p.hp, p.maxHp * .23);
        p.hp += amount;
        this.effect('heal', p.x, p.z, 2.5, 0x99e8b2, .9);
        this.emitAction(p, '灯の祈り', 'heal');
        this.events.push({ type: 'heal', targetId: p.id, amount, x: p.x, z: p.z });
      } else if (input.skill2) this.trySkill(p, 1, moving);
      else if (input.skill) this.trySkill(p, 0, moving);
      else if (input.attack && p.attackCooldown <= 0) this.melee(p);
    }
    if (p.dashTime > 0) return;
    if (moving && p.actionTime <= .12) {
      const speed = clamp(finite(p.def.speed, 6), 2, 13) * (p.guarding ? .4 : 1);
      this.move(p, mx * speed * dt, mz * speed * dt);
      if (!p.guarding) p.facing = Math.atan2(mx, mz);
      if (p.actionTime <= 0) p.state = p.guarding ? 'guard' : 'run';
    } else if (p.guarding) {
      this.faceTarget(p, this.nearest(p, 12));
      p.state = 'guard';
    }
  }

  controlEnemy(enemy, dt) {
    if (enemy.dead || this.player.dead || enemy.stun > 0 || enemy.dashTime > 0) return;
    enemy.guarding = false;
    enemy.aiTimer -= dt;
    enemy.aiSkillTimer -= dt;
    if (enemy.actionTime > 0) return;
    const target = this.player;
    this.faceTarget(enemy, target);
    const d = distance(enemy, target);
    const awareness = this.mode === 'duel' ? Infinity : 18 + this.difficulty * .08;
    if (d > awareness) return;
    const activeAttackers = this.foes.filter(f => !f.dead && (f.state === 'attack' || f.state === 'skill')).length;
    if (enemy.aiSkillTimer <= 0 && d > 3 && d < 12 && activeAttackers < 2 && this.difficulty >= 15) {
      const options = (enemy.def.skills || []).filter(spec => ['projectile', 'rain', 'shockwave', 'dash', 'judgment'].includes(spec.kind));
      const spec = options[Math.floor(this.random() * options.length)];
      if (spec && enemy.energy >= finite(spec.cost, 20)) {
        enemy.energy -= finite(spec.cost, 20);
        this.cast(enemy, spec, 'skill');
        enemy.aiSkillTimer = 6.8 - this.difficulty * .035 + this.random() * 2;
        return;
      }
    }
    if (d < finite(enemy.def.light?.range, 2.1) + .5 && enemy.aiTimer <= 0 && activeAttackers < 3) {
      this.melee(enemy);
      enemy.aiTimer = 2 - this.difficulty * .011 + this.random() * .4;
      return;
    }
    if (d > 1.7) {
      // A gentle side component keeps a crowd from becoming one overlapping line.
      const side = enemy.id % 2 ? .26 : -.26;
      let angle = enemy.facing + (d < 4 ? side : 0);
      const speed = clamp(finite(enemy.def.speed, 5.5), 2, 11) * (.55 + this.difficulty * .0036);
      // Look ahead and skirt a pillar instead of running against it forever.
      const lookAhead = .9 + enemy.radius;
      if (this.blocked(enemy.x + Math.sin(angle) * lookAhead, enemy.z + Math.cos(angle) * lookAhead, enemy.radius)) {
        const turn = enemy.id % 2 ? 1 : -1;
        for (const offset of [turn * .65, -turn * .65, turn * 1.25, -turn * 1.25, turn * 1.8]) {
          const candidate = enemy.facing + offset;
          if (!this.blocked(enemy.x + Math.sin(candidate) * lookAhead, enemy.z + Math.cos(candidate) * lookAhead, enemy.radius)) {
            angle = candidate;
            break;
          }
        }
      }
      this.move(enemy, Math.sin(angle) * speed * dt, Math.cos(angle) * speed * dt);
      enemy.state = 'run';
    }
  }

  melee(entity) {
    const target = this.nearest(entity, 5);
    this.faceTarget(entity, target);
    entity.comboStep = entity.comboTimer > 0 ? entity.comboStep % 3 + 1 : 1;
    entity.comboTimer = 1.15;
    const step = entity.comboStep;
    const enemy = entity.team !== 0;
    const windup = enemy ? .8 - this.difficulty * .004 : .085 + (step === 3 ? .04 : 0);
    const duration = enemy ? windup + .35 : [0, .29, .3, .43][step];
    entity.actionTime = duration;
    entity.attackCooldown = duration;
    entity.state = 'attack';
    const range = finite(entity.def.light?.range, 2.1) + .5 + (step === 3 ? .4 : 0);
    if (enemy) this.effect('telegraph', entity.x, entity.z, range, 0xff574f, windup, { facing: entity.facing, arc: 1.9 });
    this.pending.push({ delay: windup, kind: 'melee', source: entity, facing: entity.facing, range,
      dmg: finite(entity.def.light?.dmg, 38) * [0, 1, 1.15, 1.65][step], step });
    this.emitAction(entity, ['','一閃','連閃','月断'][step], 'attack');
  }

  trySkill(entity, slot, moving) {
    if (entity.skillCooldowns[slot] > 0) return false;
    const list = entity.def.skills || [];
    const index = slot * 2 + (moving ? 1 : 0);
    const spec = list[index] || list[slot] || { name: slot ? '飛月' : '月光陣', kind: slot ? 'projectile' : 'shockwave', dmg: 95, radius: 4, cost: 22 };
    const cost = clamp(finite(spec.cost, 22), 0, 100);
    if (entity.energy < cost) return false;
    entity.energy -= cost;
    entity.skillCooldowns[slot] = spec.kind === 'heal' ? 6 : 1.6;
    this.cast(entity, spec, slot ? 'skill2' : 'skill');
    return true;
  }

  cast(entity, spec, action) {
    const target = this.nearest(entity);
    this.faceTarget(entity, target);
    const ultimate = action === 'over' || action === 'hi';
    const hostile = entity.team !== 0;
    const castTime = hostile ? .7 + clamp(finite(spec.castTime, .2), 0, .7) : ultimate ? .55 : .22;
    entity.actionTime = castTime + (ultimate ? .6 : .3);
    entity.state = ultimate ? 'ultimate' : 'skill';
    if (ultimate) entity.invulnerable = entity.actionTime;
    this.emitAction(entity, spec.name || '灯術', action);
    this.effect(ultimate ? 'ultimate' : 'cast', entity.x, entity.z, ultimate ? 4 : 1.7, spec.color || entity.def.color, entity.actionTime, { facing: entity.facing });
    const radius = clamp(finite(spec.radius, 4), .5, 18);
    if (hostile && ['shockwave', 'judgment'].includes(spec.kind)) this.effect('telegraph', entity.x, entity.z, radius, 0xff574f, castTime);
    this.pending.push({ delay: castTime, kind: 'cast', source: entity, spec, ultimate,
      x: target?.x ?? entity.x + Math.sin(entity.facing) * 5,
      z: target?.z ?? entity.z + Math.cos(entity.facing) * 5, facing: entity.facing });
  }

  emitAction(source, name, action) {
    source.actionName = name;
    this.events.push({ type: 'action', sourceId: source.id, actorId: source.id, team: source.team, name, action, x: source.x, z: source.z });
  }

  tickPending(dt) {
    const due = [];
    for (const action of this.pending) {
      action.delay -= dt;
      if (action.delay <= 0) due.push(action);
    }
    this.pending = this.pending.filter(action => action.delay > 0);
    for (const action of due) {
      if (action.source.dead || this.status !== 'playing') continue;
      if (action.kind === 'melee') {
        const source = action.source;
        if (source.stun > 0) continue;
        this.effect('slash', source.x, source.z, action.range, source.def.color, .3, { facing: action.facing, combo: action.step });
        for (const target of this.opponents(source)) {
          const angle = Math.atan2(target.x - source.x, target.z - source.z);
          if (distance(source, target) <= action.range + target.radius && Math.abs(angleDelta(angle, action.facing)) < 1.2) {
            this.damage(source, target, action.dmg, { kind: 'melee', knockback: action.step === 3 ? 1.3 : .35 });
          }
        }
      } else if (action.kind === 'cast') this.resolveCast(action);
      else if (action.kind === 'impact') {
        this.effect(action.ultimate ? 'burst' : 'impact', action.x, action.z, action.radius, action.color, .65);
        for (const target of this.opponents(action.source)) {
          if (Math.hypot(target.x - action.x, target.z - action.z) < action.radius + target.radius) {
            this.damage(action.source, target, action.dmg, { kind: 'spell', knockback: action.ultimate ? .8 : .2 });
          }
        }
      }
    }
  }

  resolveCast(action) {
    const { source, spec, ultimate } = action;
    if (source.stun > 0 && !ultimate) return;
    const color = spec.color || source.def.color || 0xe7c88b;
    const dmg = Math.max(1, finite(spec.dmg, ultimate ? 180 : 85));
    const radius = clamp(finite(spec.radius, ultimate ? 7 : 4), .4, 18);
    const kind = spec.kind || 'shockwave';
    if (kind === 'heal') {
      const amount = Math.min(source.maxHp - source.hp, finite(spec.heal, source.maxHp * .2));
      source.hp += amount;
      this.effect('heal', source.x, source.z, 3, 0x99e8b2, 1);
      this.events.push({ type: 'heal', targetId: source.id, amount, x: source.x, z: source.z });
    } else if (kind === 'projectile') {
      const count = clamp(Math.round(finite(spec.count, 1)), 1, 16);
      const spread = clamp(finite(spec.spreadAng, .13), 0, .7);
      for (let i = 0; i < count; i++) {
        const angle = action.facing + (i - (count - 1) / 2) * spread;
        const speed = clamp(finite(spec.speed, 18), 6, 42);
        this.projectiles.push({ id: this._nextId++, source, team: source.team,
          x: source.x + Math.sin(angle) * .8, z: source.z + Math.cos(angle) * .8,
          vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed,
          radius: clamp(radius, .2, 1), color, life: 2.5, maxLife: 2.5, dmg, visual: spec.visual || 'orb', ultimate });
      }
    } else if (kind === 'dash') {
      source.dashTime = clamp(finite(spec.dur, .32), .15, .55);
      source.dashX = Math.sin(action.facing); source.dashZ = Math.cos(action.facing);
      source.dashSpec = { ...spec, dmg }; source.dashHits.clear();
      source.invulnerable = source.dashTime * .7;
      source.actionTime = source.dashTime + .1;
      this.effect('dash', source.x, source.z, 2, color, .5, { facing: action.facing });
    } else if (kind === 'rain' || kind === 'judgment') {
      const count = clamp(Math.round(finite(spec.count, ultimate ? 8 : 4)), 1, 18);
      const spread = clamp(finite(spec.spread, 2), 0, 8);
      for (let i = 0; i < count; i++) {
        const a = this.random() * TAU;
        const r = i === 0 ? 0 : Math.sqrt(this.random()) * spread;
        const x = clamp(action.x + Math.sin(a) * r, this.bounds.minX, this.bounds.maxX);
        const z = clamp(action.z + Math.cos(a) * r, this.bounds.minZ, this.bounds.maxZ);
        const delay = .35 + clamp(finite(spec.delay, .2), 0, 1.3) + i * clamp(finite(spec.interval, .1), .04, .3);
        this.effect('telegraph', x, z, radius, source.team ? 0xff574f : color, delay);
        this.pending.push({ kind: 'impact', delay, source, x, z, radius, color, dmg, ultimate });
      }
      if (kind === 'judgment' && spec.finalDmg) this.pending.push({ kind: 'impact', delay: 1.5 + count * .1, source, x: action.x, z: action.z,
        radius: clamp(finite(spec.finalRadius, radius * 2), 1, 18), color, dmg: finite(spec.finalDmg, dmg * 2), ultimate: true });
    } else {
      this.effect(ultimate ? 'burst' : 'ring', source.x, source.z, radius, color, .7);
      for (const target of this.opponents(source)) {
        if (distance(source, target) < radius + target.radius) this.damage(source, target, dmg, { kind: 'spell', knockback: ultimate ? 2 : .7 });
      }
      if (spec.double) this.pending.push({ kind: 'impact', delay: .45, source, x: source.x, z: source.z, radius, color, dmg: dmg * .65, ultimate });
    }
  }

  tickProjectiles(dt) {
    for (const shot of this.projectiles) {
      if (shot.life <= 0) continue;
      shot.life -= dt;
      const oldX = shot.x, oldZ = shot.z;
      shot.x += shot.vx * dt; shot.z += shot.vz * dt;
      const dx = shot.x - oldX, dz = shot.z - oldZ;
      const length2 = dx * dx + dz * dz;
      for (const target of this.opponents(shot.source)) {
        const t = clamp(((target.x - oldX) * dx + (target.z - oldZ) * dz) / (length2 || 1), 0, 1);
        if (Math.hypot(oldX + dx * t - target.x, oldZ + dz * t - target.z) < target.radius + shot.radius) {
          this.damage(shot.source, target, shot.dmg, { kind: 'projectile', knockback: .3 });
          this.effect('impact', shot.x, shot.z, shot.radius * 2, shot.color, .35);
          shot.life = 0; break;
        }
      }
      if (shot.x < this.bounds.minX || shot.x > this.bounds.maxX || shot.z < this.bounds.minZ || shot.z > this.bounds.maxZ || this.blocked(shot.x, shot.z, .05)) shot.life = 0;
    }
    this.projectiles = this.projectiles.filter(shot => shot.life > 0);
  }

  damage(source, target, rawDamage, { kind = 'melee', knockback = 0 } = {}) {
    if (target.dead || source.dead || this.status !== 'playing' || target.invulnerable > 0) return 0;
    const sourceScale = source.team === 0 ? 1 : .4 + this.difficulty * .006;
    const frontAngle = Math.atan2(source.x - target.x, source.z - target.z);
    const blocked = target.guarding && Math.abs(angleDelta(frontAngle, target.facing)) < 1.8 && target.energy >= 3;
    const reduction = blocked ? .22 : 1;
    if (blocked) target.energy = Math.max(0, target.energy - 3);
    const amount = Math.min(target.hp, Math.max(1, Math.round(finite(rawDamage, 1) * sourceScale * reduction)));
    target.hp = Math.max(0, target.hp - amount);
    target.damageTaken += amount;
    source.damageDealt += amount;
    target.hitFlash = .18;
    target.ultimate = clamp(target.ultimate + Math.min(5, amount / target.maxHp * 80), 0, 100);
    source.ultimate = clamp(source.ultimate + (kind === 'melee' ? 6 : 2.8) * finite(source.def.overGain, 1), 0, 100);
    if (source === this.player) {
      this.combo++; this.comboTime = 2.5; this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    if (target === this.player && !blocked) { this.combo = 0; this.comboTime = 0; }
    if (!blocked && target.state !== 'ultimate' && !target.def.superArmor) {
      target.stun = .1;
      target.state = 'hurt'; target.actionTime = .15;
      this.pending = this.pending.filter(action => action.source !== target || !['melee', 'cast'].includes(action.kind));
      if (knockback > 0) this.move(target, -Math.sin(frontAngle) * knockback, -Math.cos(frontAngle) * knockback);
    }
    this.effect(blocked ? 'guard' : 'hit', target.x, target.z, blocked ? 1.3 : .8, blocked ? 0x9acfff : source.def.color, .3);
    this.events.push({ type: 'damage', sourceId: source.id, targetId: target.id, amount, blocked, kind, x: target.x, z: target.z });
    if (target.hp <= 0) {
      target.dead = true; target.state = 'dead'; target.guarding = false; target.dashTime = 0;
      target.actionTime = 1.2;
      source.kills++;
      if (target.team !== 0) this.kills++;
      this.effect('death', target.x, target.z, 2.4, target.def.color, 1.2);
      this.events.push({ type: 'kill', sourceId: source.id, targetId: target.id, key: target.key, x: target.x, z: target.z });
      if (source === this.player) {
        source.energy = Math.min(100, source.energy + 12);
        source.ultimate = Math.min(100, source.ultimate + 8);
      }
    }
    return amount;
  }

  finishIfNeeded() {
    if (this.status !== 'playing') return;
    if (this.player.dead) this.status = 'defeat';
    else if (this.foes.every(enemy => enemy.dead)) this.status = 'victory';
    if (this.status !== 'playing') {
      this.pending = [];
      this.projectiles = [];
      this.player.guarding = false;
      this.events.push({ type: this.status, elapsed: this.elapsed, kills: this.kills, bestCombo: this.bestCombo });
    }
  }

  effect(kind, x, z, radius, color = 0xe7c88b, life = .5, extra = {}) {
    const effect = { id: this._nextId++, kind, x, z, radius, color: color ?? 0xe7c88b, life, maxLife: life, facing: 0, ...extra };
    this.effects.push(effect);
    if (this.effects.length > 120) this.effects.splice(0, this.effects.length - 120);
    return effect;
  }

  blocked(x, z, radius) {
    return this.obstacles.some(obstacle => {
      if (obstacle.kind === 'circle') return Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius;
      return Math.abs(x - obstacle.x) < obstacle.width / 2 + radius && Math.abs(z - obstacle.z) < obstacle.depth / 2 + radius;
    });
  }

  move(entity, dx, dz) {
    const oldX = entity.x, oldZ = entity.z;
    // Axis-separated collision slides naturally along columns and walls.
    entity.x = clamp(entity.x + dx, this.bounds.minX + entity.radius, this.bounds.maxX - entity.radius);
    if (this.blocked(entity.x, entity.z, entity.radius)) entity.x = oldX;
    entity.z = clamp(entity.z + dz, this.bounds.minZ + entity.radius, this.bounds.maxZ - entity.radius);
    if (this.blocked(entity.x, entity.z, entity.radius)) entity.z = oldZ;
    entity.vx = dx / STEP; entity.vz = dz / STEP;
  }

  resolvePosition(entity) {
    entity.x = clamp(entity.x, this.bounds.minX + entity.radius, this.bounds.maxX - entity.radius);
    entity.z = clamp(entity.z, this.bounds.minZ + entity.radius, this.bounds.maxZ - entity.radius);
    for (const obstacle of this.obstacles) {
      if (obstacle.kind === 'circle') {
        const dx = entity.x - obstacle.x, dz = entity.z - obstacle.z;
        const d = Math.hypot(dx, dz), min = entity.radius + obstacle.radius;
        if (d < min) { entity.x = obstacle.x + (d ? dx / d : 1) * min; entity.z = obstacle.z + (d ? dz / d : 0) * min; }
      } else if (Math.abs(entity.x - obstacle.x) < obstacle.width / 2 + entity.radius && Math.abs(entity.z - obstacle.z) < obstacle.depth / 2 + entity.radius) {
        const px = obstacle.width / 2 + entity.radius - Math.abs(entity.x - obstacle.x);
        const pz = obstacle.depth / 2 + entity.radius - Math.abs(entity.z - obstacle.z);
        if (px < pz) entity.x += (entity.x < obstacle.x ? -1 : 1) * px;
        else entity.z += (entity.z < obstacle.z ? -1 : 1) * pz;
      }
    }
  }

  separateActors() {
    const alive = this.entities.filter(entity => !entity.dead);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = a.radius + b.radius;
      if (d >= min) continue;
      const push = (min - d) * .5;
      const nx = d ? dx / d : 1, nz = d ? dz / d : 0;
      this.move(a, -nx * push, -nz * push); this.move(b, nx * push, nz * push);
    }
  }
}
