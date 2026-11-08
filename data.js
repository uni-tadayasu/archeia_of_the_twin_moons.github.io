// RF_GRAND_FOUR_20261108 data.js
// 戦士データ。skills[0]=技A（立ち）, [1]=技A（移動中）, [2]=技B（立ち）, [3]=技B（移動中）
export const FIGHTERS = {
  rowen: {
    name: 'ロウエン', title: '灰燼の渡り剣士', model: 'assets/models/hero-swordsman.glb',
    color: 0xffb347, height: 1.8, hp: 1000, speed: 6.2, overGain: 1, light: { dmg: 38, range: 2.1 },
    skills: [
      { name: '焔牙・昇', cost: 18, kind: 'shockwave', dmg: 70, radius: 2.8, color: 0xff9a4a },
      { name: '燕翔閃', cost: 22, kind: 'dash', dmg: 90, speed: 18, dur: 0.32, color: 0xffd27a },
      { name: '双燕', cost: 20, kind: 'projectile', visual: 'crescent', count: 2, spreadAng: 0.18, dmg: 50, speed: 18, radius: 0.5, color: 0xffc070 },
      { name: '灰舞', cost: 28, kind: 'rain', visual: 'blade', count: 6, spread: 1.6, radius: 1.3, dmg: 40, delay: 0.15, interval: 0.06, color: 0xff8a3d }
    ],
    over: { name: '灰燼百華', kind: 'rain', visual: 'blade', count: 16, spread: 3, radius: 1.6, dmg: 55, delay: 0.3, interval: 0.07, color: 0xff8a3d }
  },
  minase: {
    name: 'ミナセ', title: '霜を綴る織り手', model: 'assets/models/mage-weaver.glb',
    color: 0x8fd8ff, height: 1.65, hp: 850, speed: 5.6, overGain: 1.1, light: { dmg: 30, range: 1.9 },
    skills: [
      { name: '氷花連弾', cost: 20, kind: 'projectile', visual: 'ice', count: 3, spreadAng: 0.25, dmg: 55, speed: 16, radius: 0.6, color: 0x9fe8ff },
      { name: '霜柱', cost: 24, kind: 'rain', visual: 'crystal', count: 4, spread: 2, radius: 1.4, dmg: 60, delay: 0.4, interval: 0.1, color: 0xbff0ff },
      { name: '雪華陣', cost: 22, kind: 'shockwave', dmg: 65, radius: 4, color: 0xd8f6ff },
      { name: '凍て星', cost: 32, kind: 'rain', visual: 'meteor', count: 1, spread: 0, radius: 2.6, dmg: 130, delay: 0.7, interval: 0, color: 0x7fc8ff }
    ],
    over: { name: '蒼穹の落涙', kind: 'rain', visual: 'meteor', count: 8, spread: 3.5, radius: 2.2, dmg: 85, delay: 0.8, interval: 0.16, color: 0x6fb6ff }
  },
  garou: {
    name: 'ガロウ', title: '砂嵐の斧鬼', model: 'assets/models/brute-axe.glb',
    color: 0xd2603a, height: 2.0, hp: 1250, speed: 5.0, overGain: 0.9, light: { dmg: 52, range: 2.3 },
    skills: [
      { name: '地裂轟', cost: 25, kind: 'shockwave', dmg: 80, radius: 5, color: 0xffa060 },
      { name: '猛進斧', cost: 22, kind: 'dash', dmg: 95, speed: 14, dur: 0.4, color: 0xff7040 },
      { name: '投げ大斧', cost: 20, kind: 'projectile', visual: 'axe', count: 1, spreadAng: 0, dmg: 100, speed: 12, radius: 0.9, color: 0xe08050 },
      { name: '砂竜巻', cost: 30, kind: 'rain', visual: 'blade', count: 8, spread: 2.2, radius: 1.5, dmg: 45, delay: 0.3, interval: 0.08, color: 0xe8c080 }
    ],
    over: { name: '砕界の牙', kind: 'shockwave', dmg: 150, radius: 9, color: 0xff5a2a, double: true }
  },
  tsubaki: {
    name: 'ツバキ', title: '朧を渡る双刃', model: 'assets/models/shinobi-twin.glb',
    color: 0xd8405a, height: 1.6, hp: 820, speed: 7.2, overGain: 1.2, light: { dmg: 28, range: 1.8 },
    skills: [
      { name: '苦無五連', cost: 18, kind: 'projectile', visual: 'kunai', count: 5, spreadAng: 0.16, dmg: 28, speed: 22, radius: 0.35, color: 0xff7a90 },
      { name: '影走り', cost: 16, kind: 'dash', dmg: 70, speed: 24, dur: 0.24, color: 0xb03050 },
      { name: '霞斬', cost: 20, kind: 'shockwave', dmg: 60, radius: 2.6, color: 0xff98b0 },
      { name: '落葉', cost: 26, kind: 'rain', visual: 'blade', count: 9, spread: 2, radius: 1.1, dmg: 32, delay: 0.2, interval: 0.05, color: 0xff5070 }
    ],
    over: { name: '千影朧月', kind: 'rain', visual: 'blade', count: 26, spread: 3, radius: 1.2, dmg: 34, delay: 0.25, interval: 0.04, color: 0xff3a60 }
  },
  harlan: {
    name: 'ハーラン', title: '錆びぬ誓いの老騎士', model: 'assets/models/old-knight.glb',
    color: 0x7aa0d8, height: 1.85, hp: 1350, speed: 5.0, overGain: 0.9, light: { dmg: 46, range: 2.4 },
    skills: [
      { name: '盾鳴り', cost: 18, kind: 'shockwave', dmg: 55, radius: 3.2, color: 0xa8c8ff },
      { name: '突撃槍', cost: 22, kind: 'dash', dmg: 100, speed: 16, dur: 0.36, color: 0xc8d8ff },
      { name: '鉄壁の祈り', cost: 30, kind: 'heal', heal: 160, radius: 4, color: 0x9dffb0 },
      { name: '槍雨', cost: 28, kind: 'rain', visual: 'spear', count: 7, spread: 2.4, radius: 1.3, dmg: 50, delay: 0.4, interval: 0.07, color: 0xd8e4ff }
    ],
    over: { name: '老兵の凱歌', kind: 'rain', visual: 'spear', count: 16, spread: 3.2, radius: 1.5, dmg: 55, delay: 0.5, interval: 0.06, color: 0x9ec0ff }
  },
  pip: {
    name: 'ピップ', title: 'すす汚れの錬金見習い', model: 'assets/models/alchemist-boy.glb',
    color: 0x9be36a, height: 1.3, hp: 780, speed: 6.0, overGain: 1.15, light: { dmg: 26, range: 1.7 },
    skills: [
      { name: '火薬瓶', cost: 16, kind: 'projectile', visual: 'bomb', count: 1, spreadAng: 0, dmg: 70, speed: 13, radius: 0.8, color: 0xffb040 },
      { name: '連鎖爆薬', cost: 24, kind: 'rain', visual: 'meteor', count: 4, spread: 2.2, radius: 1.6, dmg: 50, delay: 0.5, interval: 0.15, color: 0xffa030 },
      { name: '薬草調合', cost: 28, kind: 'heal', heal: 140, radius: 5, color: 0x9dffb0 },
      { name: '煙玉ぽん', cost: 18, kind: 'shockwave', dmg: 45, radius: 3.5, color: 0xc8f0a0 }
    ],
    over: { name: '大釜のかんしゃく', kind: 'rain', visual: 'meteor', count: 11, spread: 3.8, radius: 2, dmg: 70, delay: 0.6, interval: 0.12, color: 0x9bff5a }
  },
  velka: {
    name: 'ヴェルカ', title: '森番の弓手', model: 'assets/models/ranger-archer.glb',
    color: 0x6fcf7f, height: 1.75, hp: 880, speed: 6.4, overGain: 1.05, light: { dmg: 32, range: 2.0 },
    skills: [
      { name: '三つ矢', cost: 16, kind: 'projectile', visual: 'arrow', count: 3, spreadAng: 0.12, dmg: 40, speed: 24, radius: 0.4, color: 0xb8ff9a },
      { name: '風翔', cost: 14, kind: 'dash', dmg: 50, speed: 20, dur: 0.25, color: 0x9affc0 },
      { name: '貫き矢', cost: 22, kind: 'projectile', visual: 'arrow', count: 1, spreadAng: 0, dmg: 110, speed: 30, radius: 0.5, color: 0xf0ffb0 },
      { name: '星降り矢', cost: 28, kind: 'rain', visual: 'spear', count: 9, spread: 2.6, radius: 1.2, dmg: 42, delay: 0.45, interval: 0.06, color: 0xc8ffb0 }
    ],
    over: { name: '天弓・百雨', kind: 'rain', visual: 'spear', count: 24, spread: 3.6, radius: 1.2, dmg: 38, delay: 0.5, interval: 0.04, color: 0x8affa0 }
  },
  osric: {
    name: 'オズリック', title: '黒鋼の流れ傭兵', model: 'assets/models/dark-mercenary.glb',
    color: 0x9a6adf, height: 1.95, hp: 1150, speed: 5.4, overGain: 1, light: { dmg: 50, range: 2.4 },
    skills: [
      { name: '虚空斬', cost: 24, kind: 'shockwave', dmg: 95, radius: 4.5, color: 0xb080ff },
      { name: '黒刃突', cost: 22, kind: 'dash', dmg: 105, speed: 17, dur: 0.33, color: 0x7a40d0 },
      { name: '黒炎弾', cost: 20, kind: 'projectile', visual: 'flame', count: 2, spreadAng: 0.3, dmg: 60, speed: 15, radius: 0.7, color: 0xa060ff },
      { name: '断罪の刃', cost: 32, kind: 'rain', visual: 'sword', count: 3, spread: 1.2, radius: 2, dmg: 90, delay: 0.5, interval: 0.15, color: 0xc090ff }
    ],
    over: { name: '冥夜崩し', kind: 'judgment', visual: 'pillar', count: 6, spread: 4, radius: 2, dmg: 60, delay: 0.7, interval: 0.12, finalDmg: 200, finalRadius: 5.5, color: 0x9a50ff }
  },
  noa: {
    name: 'ノア', title: '鐘を抱く巡礼者', model: 'assets/models/bell-priestess.glb',
    color: 0xf2f0c8, height: 1.6, hp: 800, speed: 5.6, overGain: 1.2, light: { dmg: 26, range: 1.9 },
    skills: [
      { name: '癒しの鈴', cost: 26, kind: 'heal', heal: 180, radius: 6, color: 0x9dffb0 },
      { name: '聖鈴弾', cost: 16, kind: 'projectile', visual: 'orb', count: 3, spreadAng: 0.2, dmg: 38, speed: 15, radius: 0.5, color: 0xfff8c0 },
      { name: '光輪', cost: 20, kind: 'shockwave', dmg: 60, radius: 4, color: 0xfff4b0 },
      { name: '祝福の灯柱', cost: 28, kind: 'rain', visual: 'pillar', count: 5, spread: 2.5, radius: 1.4, dmg: 55, delay: 0.5, interval: 0.1, color: 0xfffad0 }
    ],
    over: { name: '鐘楼の奇跡', kind: 'heal', heal: 450, radius: 12, color: 0xc8ffd0 }
  },
  kurouga: {
    name: 'クロウガ', title: '月吠えの獣戦士', model: 'assets/models/wolf-warrior.glb',
    color: 0x9fb2d8, height: 1.9, hp: 1100, speed: 6.6, overGain: 1.05, light: { dmg: 40, range: 1.9 },
    skills: [
      { name: '遠吠え', cost: 20, kind: 'shockwave', dmg: 60, radius: 3.6, color: 0xc8d8ff },
      { name: '裂爪', cost: 18, kind: 'dash', dmg: 85, speed: 20, dur: 0.28, color: 0xd8e4ff },
      { name: '牙投げ', cost: 18, kind: 'projectile', visual: 'kunai', count: 3, spreadAng: 0.2, dmg: 40, speed: 20, radius: 0.45, color: 0xeef4ff },
      { name: '狩りの月', cost: 28, kind: 'rain', visual: 'blade', count: 7, spread: 2, radius: 1.3, dmg: 42, delay: 0.2, interval: 0.06, color: 0xb0c8ff }
    ],
    over: { name: '銀狼月牙', kind: 'rain', visual: 'blade', count: 20, spread: 3, radius: 1.4, dmg: 40, delay: 0.3, interval: 0.05, color: 0xe0ecff }
  },
  rinfa: {
    name: 'リンファ', title: '拳で祈る修行僧', model: 'assets/models/monk-brawler.glb',
    color: 0xff7a3a, height: 1.65, hp: 950, speed: 6.8, overGain: 1.1, light: { dmg: 34, range: 1.7 },
    skills: [
      { name: '炎拳弾', cost: 16, kind: 'projectile', visual: 'flame', count: 1, spreadAng: 0, dmg: 75, speed: 18, radius: 0.7, color: 0xff8a40 },
      { name: '縮地', cost: 14, kind: 'dash', dmg: 60, speed: 22, dur: 0.22, color: 0xffb070 },
      { name: '旋風脚', cost: 20, kind: 'shockwave', dmg: 70, radius: 3, color: 0xffa060 },
      { name: '百烈天衝', cost: 28, kind: 'rain', visual: 'pillar', count: 3, spread: 1.2, radius: 1.5, dmg: 70, delay: 0.3, interval: 0.12, color: 0xff6a2a }
    ],
    over: { name: '紅蓮昇華', kind: 'judgment', visual: 'pillar', count: 5, spread: 2.5, radius: 1.8, dmg: 60, delay: 0.5, interval: 0.1, finalDmg: 180, finalRadius: 4.5, color: 0xff5020 }
  },
  igna: {
    name: 'イグナ', title: '竜鱗の跳槍騎', model: 'assets/models/dragoon-lancer.glb',
    color: 0x3ac0a0, height: 1.8, hp: 1050, speed: 6.0, overGain: 1, light: { dmg: 42, range: 2.6 },
    skills: [
      { name: '跳槍', cost: 22, kind: 'rain', visual: 'spear', count: 1, spread: 0, radius: 2.4, dmg: 120, delay: 0.55, interval: 0, color: 0x6affd0 },
      { name: '疾槍', cost: 20, kind: 'dash', dmg: 90, speed: 19, dur: 0.3, color: 0x8affe0 },
      { name: '薙ぎ払い', cost: 20, kind: 'shockwave', dmg: 70, radius: 3.2, color: 0x5ae0b0 },
      { name: '竜鱗弾', cost: 20, kind: 'projectile', visual: 'ice', count: 3, spreadAng: 0.22, dmg: 45, speed: 17, radius: 0.55, color: 0x7affd8 }
    ],
    over: { name: '天墜竜槍', kind: 'rain', visual: 'spear', count: 12, spread: 3.2, radius: 1.8, dmg: 65, delay: 0.6, interval: 0.08, color: 0x40ffc0 }
  },
  petra: {
    name: 'ペトラ', title: 'ぜんまい仕掛けの人形師', model: 'assets/models/clockwork-puppeteer.glb',
    color: 0xe0b050, height: 1.5, hp: 880, speed: 5.8, overGain: 1.15, light: { dmg: 28, range: 1.9 },
    skills: [
      { name: '歯車弾', cost: 16, kind: 'projectile', visual: 'axe', count: 2, spreadAng: 0.25, dmg: 45, speed: 15, radius: 0.6, color: 0xffd070 },
      { name: '糸繰り', cost: 16, kind: 'dash', dmg: 60, speed: 18, dur: 0.28, color: 0xfff0b0 },
      { name: '人形の舞', cost: 28, kind: 'rain', visual: 'sword', count: 5, spread: 2.4, radius: 1.4, dmg: 55, delay: 0.4, interval: 0.1, color: 0xffc860 },
      { name: '発条炸裂', cost: 22, kind: 'shockwave', dmg: 70, radius: 4, color: 0xffb040 }
    ],
    over: { name: '大劇場・終幕', kind: 'rain', visual: 'sword', count: 14, spread: 3.5, radius: 1.6, dmg: 55, delay: 0.5, interval: 0.08, color: 0xffe080 }
  },
  seraphel: {
    name: 'セラフェル', title: '終天の裁定者', model: 'assets/models/verdict-maiden-v2.glb',
    color: 0x6aa8ff, height: 1.85, hp: 2200, speed: 6.0, overGain: 1.6, locked: true, light: { dmg: 48, range: 2.4 },
    skills: [
      { name: '光槍連星《ルクス・カスケード》', cost: 30, kind: 'rain', visual: 'spear', count: 18, spread: 4, radius: 1.3, dmg: 40, delay: 0.5, interval: 0.05, color: 0xfff6c8 },
      { name: '天秤の刃', cost: 20, kind: 'dash', dmg: 110, speed: 20, dur: 0.3, color: 0xfff0a0 },
      { name: '審問光弾', cost: 22, kind: 'projectile', visual: 'feather', count: 5, spreadAng: 0.22, dmg: 45, speed: 17, radius: 0.6, color: 0xfffbd8 },
      { name: '白翼陣', cost: 26, kind: 'shockwave', dmg: 90, radius: 6, color: 0xffffff }
    ],
    over: { name: '千重審判《ミリアド・ヴァーディクト》', kind: 'judgment', visual: 'pillar', count: 12, spread: 6, radius: 2.4, dmg: 70, delay: 1.0, interval: 0.12, finalDmg: 260, finalRadius: 7, color: 0xfff1a0 }
  }
};

export const ROSTER = ['rowen', 'minase', 'garou', 'tsubaki', 'harlan', 'pip', 'velka', 'osric', 'noa', 'kurouga', 'rinfa', 'igna', 'petra'];
const BASE_KEYS = ROSTER.slice();
for (const k of [...BASE_KEYS, 'seraphel']) FIGHTERS[k].face = `assets/face-${k}.webp`;
FIGHTERS.uninomiya = {
  name: '宇邇宮', title: '雅を極めし白粉の公達', model: 'assets/models/uninomiya.glb', face: 'assets/face-uninomiya.webp',
  color: 0xb8b0a0, height: 1.75, hp: 1150, speed: 5.8, overGain: 1.2,
  // 通常攻撃：天叢雲の太刀で周囲を薙ぐ回転斬り
  light: { dmg: 40, range: 2.4, spin: true, color: 0x40c8ff },
  skills: [
    // 光の槍を天から降らせる
    { name: '煌槍・天降り', cost: 22, kind: 'rain', visual: 'spear', count: 9, spread: 2.6, radius: 1.3, dmg: 46, delay: 0.35, interval: 0.06, elem: 5, color: 0xffd040, vivid: true },
    // 雷をまとった神威の刃を敵頭上へ三度落とす
    { name: '神威雷刃', cost: 24, kind: 'rain', visual: 'bolt', count: 3, spread: 0.8, radius: 1.8, dmg: 72, delay: 0.3, interval: 0.18, elem: 2, color: 0xfff020, vivid: true },
    // 三つの雷光球が連なって走る
    { name: '三華雷閃', cost: 20, kind: 'projectile', visual: 'spark', count: 3, spreadAng: 0.0, chain: 0.12, dmg: 48, speed: 19, radius: 0.7, elem: 2, color: 0x80e0ff, vivid: true },
    { name: '公達の摺り足', cost: 16, kind: 'dash', dmg: 80, speed: 18, dur: 0.3, elem: 3, color: 0x60ffc0, vivid: true }
  ],
  // 天を裂く巨大な雷の剣が落ち、紫電の柱が乱れ立つ
  over: { name: '天譴大雷剣・憤怒の審', kind: 'judgment', visual: 'bolt', finalVisual: 'bigsword', count: 8, spread: 3.8, radius: 1.8, dmg: 55, delay: 0.6, interval: 0.09, finalDmg: 240, finalRadius: 6, elem: 2, color: 0xb070ff, vivid: true }
};
ROSTER.push('uninomiya');
// セラフェル：裁定者の5つの大技（通常攻撃は赤い光線弾の連射）
Object.assign(FIGHTERS.seraphel, {
  light: { dmg: 16, range: 2.4, shots: 4, color: 0xff1a2a },
  skills: [
    // 太古の星を灼熱とともに落とす
    { name: '太古星焔《アルカ・ノヴァ》', cost: 30, kind: 'rain', visual: 'nova', count: 1, spread: 0, radius: 4.2, dmg: 190, delay: 0.9, interval: 0, elem: 0, color: 0xff5010, vivid: true },
    // 闇の重力で敵を引き寄せ、圧し潰して爆ぜる
    { name: '終圧崩界《インプロード・フィン》', cost: 28, kind: 'implode', dmg: 150, radius: 6, elem: 6, color: 0x9a20ff, vivid: true },
    // 刃のような暴風が渦巻いて吹き荒れる
    { name: '戦慄の大旋嵐《テラー・テンペスト》', cost: 28, kind: 'rain', visual: 'tornado', count: 5, spread: 3.2, radius: 2, dmg: 55, delay: 0.3, interval: 0.14, elem: 3, color: 0x30ffb0, vivid: true },
    // 神裁の雷刃
    { name: '神裁雷刃《セイクリッド・エッジ》', cost: 24, kind: 'rain', visual: 'bolt', count: 4, spread: 1, radius: 1.8, dmg: 62, delay: 0.3, interval: 0.14, elem: 2, color: 0xffe830, vivid: true }
  ],
  // 天から聖なる光の奔流が降り注ぎ、すべてを浄め消し去る
  over: { name: '大浄滅《グラン・パージ》', kind: 'judgment', visual: 'pillar', count: 12, spread: 6, radius: 2.4, dmg: 70, delay: 1.0, interval: 0.1, finalDmg: 280, finalRadius: 7.5, elem: 5, color: 0xffc030, vivid: true }
});

// 運営長専用：白耀の天后ルミナリア（運営の鍵でのみ使える、全戦士中ずば抜けた最強）
FIGHTERS.chief = {
  name: 'ルミナリア', title: '白耀の天后（運営長）', model: 'assets/models/chief-empress.glb', face: 'assets/face-chief.webp',
  color: 0xfff4d0, height: 1.85, hp: 1500, speed: 6, overGain: 1.5, locked: true, special: 'chief',
  light: { dmg: 22, range: 2.6, shots: 5, color: 0xffd040 },
  skills: [
    { name: '天后の鳳翼《フェニクス・ロア》', cost: 24, kind: 'rain', visual: 'nova', count: 3, spread: 2.5, radius: 3.6, dmg: 160, delay: 0.6, interval: 0.2, elem: 0, color: 0xff7020, vivid: true },
    { name: '白耀天輪', cost: 22, kind: 'shockwave', dmg: 170, radius: 8, elem: 5, color: 0xffe060, vivid: true },
    { name: '天裁雷雨《ディヴァイン・ストーム》', cost: 24, kind: 'rain', visual: 'bolt', count: 7, spread: 3, radius: 2, dmg: 70, delay: 0.25, interval: 0.08, elem: 2, color: 0xfff030, vivid: true },
    { name: '袖下の深淵', cost: 26, kind: 'implode', dmg: 180, radius: 7, elem: 6, color: 0xb040ff, vivid: true }
  ],
  over: { name: '天地開闢・白耀の御宣', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 16, spread: 7, radius: 2.6, dmg: 90, delay: 0.8, interval: 0.07, finalDmg: 400, finalRadius: 9, elem: 5, color: 0xffd860, vivid: true }
};
// ショップ（課金）で解放：紅外套の剣士クレイド
FIGHTERS.crimson = {
  name: 'クレイド', title: '紅外套の流浪剣士', model: 'assets/models/crimson-swordsman.glb', face: 'assets/face-crimson.webp',
  color: 0xe04a28, height: 1.75, hp: 1150, speed: 6.6, overGain: 1.15, shop: true,
  light: { dmg: 44, range: 2.2 },
  skills: [
    { name: '魔神閃', cost: 16, kind: 'projectile', dmg: 70, speed: 18, radius: 0.8, count: 1, spreadAng: 0, elem: 3, color: 0x40ffc0, vivid: true },
    { name: '紅蓮翔斬', cost: 20, kind: 'dash', dmg: 105, speed: 20, dur: 0.3, elem: 0, color: 0xff4010, vivid: true },
    { name: '獅吼烈破', cost: 22, kind: 'shockwave', dmg: 110, radius: 5, elem: 5, color: 0xffc040, vivid: true },
    { name: '天落雷斬', cost: 24, kind: 'rain', visual: 'bolt', count: 3, spread: 1, radius: 1.8, dmg: 60, delay: 0.3, interval: 0.15, elem: 2, color: 0xfff040, vivid: true }
  ],
  over: { name: '冥空紅蓮斬', kind: 'judgment', visual: 'pillar', count: 8, spread: 4, radius: 2, dmg: 60, delay: 0.6, interval: 0.1, finalDmg: 260, finalRadius: 6, elem: 0, color: 0xff3010, vivid: true }
};
// 運営長専用：冥紫の魔后ヴェスペラ（第一形態）→ 体力半分で第二形態「緋髪の深淵后」へ戦闘中に変身
FIGHTERS.sovereign = {
  name: 'ヴェスペラ', title: '冥紫の魔后（運営長・第一形態）', model: 'assets/models/void-sovereign-f1.glb', face: 'assets/face-sovereign.webp',
  color: 0x9a40ff, height: 1.8, hp: 1600, speed: 6.4, overGain: 1.6, locked: true, special: 'chief', form2: 'sovereign2',
  light: { dmg: 30, range: 2.6, shots: 6, color: 0xb050ff },
  skills: [
    { name: '冥鎖刃《ノクス・チェイン》', cost: 20, kind: 'projectile', dmg: 150, speed: 22, radius: 1.1, count: 1, spreadAng: 0, elem: 6, color: 0xa040ff, vivid: true },
    { name: '紫影閃舞', cost: 20, kind: 'dash', dmg: 170, speed: 24, dur: 0.32, elem: 6, color: 0xc060ff, vivid: true },
    { name: '冥雷葬列', cost: 24, kind: 'rain', visual: 'bolt', count: 9, spread: 3.2, radius: 2.1, dmg: 80, delay: 0.25, interval: 0.07, elem: 2, color: 0xd070ff, vivid: true },
    { name: '虚空の檻', cost: 26, kind: 'implode', dmg: 220, radius: 7.5, elem: 6, color: 0x8020ff, vivid: true }
  ],
  over: { name: '終夜・冥紫天蓋', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 18, spread: 7, radius: 2.6, dmg: 100, delay: 0.7, interval: 0.06, finalDmg: 460, finalRadius: 9.5, elem: 6, color: 0xa040ff, vivid: true }
};
FIGHTERS.sovereign2 = {
  name: 'ヴェスペラ', title: '緋髪の深淵后（運営長・第二形態）', model: 'assets/models/void-sovereign-f2.glb', face: 'assets/face-sovereign2.webp',
  color: 0xff3050, height: 2.15, hp: 2400, speed: 6.8, overGain: 2, locked: true, special: 'chief', hidden: true,
  light: { dmg: 34, range: 2.8, shots: 8, color: 0xff3060 },
  skills: [
    { name: '緋天冠刃《クラウン・レイ》', cost: 18, kind: 'projectile', dmg: 190, speed: 26, radius: 1.3, count: 1, spreadAng: 0, elem: 9, color: 0xff2040, vivid: true },
    { name: '深淵環《アビス・ヘイロー》', cost: 22, kind: 'shockwave', dmg: 240, radius: 9, elem: 6, color: 0xc040ff, vivid: true },
    { name: '血紅流星雨', cost: 24, kind: 'rain', visual: 'nova', count: 6, spread: 3.5, radius: 3.2, dmg: 150, delay: 0.5, interval: 0.12, elem: 0, color: 0xff3020, vivid: true },
    { name: '冥后の抱擁', cost: 26, kind: 'implode', dmg: 280, radius: 8.5, elem: 9, color: 0xff2060, vivid: true }
  ],
  over: { name: '深淵開闢・緋紫の終焉', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 24, spread: 8, radius: 2.8, dmg: 120, delay: 0.7, interval: 0.05, finalDmg: 650, finalRadius: 11, elem: 9, color: 0xff2050, vivid: true }
};

// 運営長専用・単一形態：氷鋼覇王ヴァルガルド。旧炎竜の進化/炎系を廃止。
FIGHTERS.valgard = {
  name: 'ヴァルガルド', title: '氷鋼の覇王（運営長専用）',
  model: 'assets/models/iron-warlord.glb', face: 'assets/face-valgard.webp',
  color: 0x8cdcff, height: 2.06, hp: 1850, speed: 5.8, overGain: 1.65,
  locked: true, special: 'chief',
  light: { dmg: 66, range: 2.6, color: 0xb8efff },
  skills: [
    { name: '凍牙・氷鋼砕', cost: 21, kind: 'shockwave', dmg: 160, radius: 6.3, elem: 1, color: 0x89e7ff, vivid: true },
    { name: '白銀氷鎧突', cost: 19, kind: 'dash', dmg: 145, speed: 19, dur: 0.34, elem: 1, color: 0xb4efff, vivid: true },
    { name: '第九位氷晶術《グレイシャル・ランス》', cost: 29, castTime: 1.65, kind: 'projectile', visual: 'ice', count: 8, spreadAng: 0.20, dmg: 82, speed: 23, radius: 0.75, elem: 1, color: 0x64d5ff, vivid: true },
    { name: '禁呪《絶対氷葬界》', cost: 36, castTime: 1.85, kind: 'judgment', visual: 'crystal', finalVisual: 'pillar', count: 10, spread: 4.8, radius: 2.1, dmg: 105, delay: 0.55, interval: 0.10, finalDmg: 370, finalRadius: 7.8, elem: 1, color: 0xc6f4ff, vivid: true }
  ],
  over: { name: '終極氷皇術《エターナル・ゼロ》', castTime: 2.45, kind: 'judgment', visual: 'crystal', finalVisual: 'pillar', count: 16, spread: 7.2, radius: 2.5, dmg: 108, delay: 0.7, interval: 0.08, finalDmg: 520, finalRadius: 9.1, elem: 1, color: 0x70ddff, vivid: true }
};
// 運営長だけが灯晶で購入できる特別キャラ：血魔ザルグレイヴ（血属性）
export const BLOODFIEND_PRICE = 50000;
FIGHTERS.bloodfiend = {
  name: 'ザルグレイヴ', title: '紅翼の血魔（運営長・灯晶限定）', model: 'assets/models/blood-fiend-v2.glb', face: 'assets/face-bloodfiend-v2.webp',
  color: 0xc8102e, height: 1.95, hp: 1500, speed: 6.6, overGain: 1.5, locked: true, special: 'chief', shardPrice: BLOODFIEND_PRICE,
  light: { dmg: 30, range: 2.6, shots: 5, color: 0xe0103c },
  skills: [
    { name: '血爪閃《クリムゾン・クロウ》', cost: 18, kind: 'projectile', visual: 'crescent', count: 3, spreadAng: 0.2, dmg: 120, speed: 22, radius: 1, elem: 9, color: 0xe0103c, vivid: true },
    { name: '紅翼急襲', cost: 20, kind: 'dash', dmg: 170, speed: 25, dur: 0.32, elem: 9, color: 0xff2040, vivid: true },
    { name: '鮮血千本槍', cost: 24, kind: 'rain', visual: 'spear', count: 12, spread: 3.6, radius: 1.8, dmg: 90, delay: 0.3, interval: 0.05, elem: 9, color: 0xc8102e, vivid: true },
    { name: '血界・吸命陣', cost: 26, kind: 'implode', dmg: 230, radius: 8, elem: 9, color: 0x9a0020, vivid: true }
  ],
  over: { name: '紅月葬送・血華の宴', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 18, spread: 7, radius: 2.6, dmg: 100, delay: 0.7, interval: 0.06, finalDmg: 480, finalRadius: 9.5, elem: 9, color: 0xe0103c, vivid: true }
};
// RF_OPERATOR_GIGANTES_20261108: Separate from the chief-only Valgard.
FIGHTERS.operator_gigantes = {
  name: '機神ギガンテス', title: '終焉機神（運営専用・運営長不可）',
  model: 'assets/models/operator-gigantes.glb',
  face: 'assets/portraits/operator-gigantes.webp',
  color: 0xb584ff, tint: null, height: 4.85, hp: 4400,
  speed: 5.2, overGain: 1.38, locked: true, special: 'operator',
  light: { dmg: 182, range: 3.7, color: 0xf09bff },
  skills: [
    { name: '破壊光線《デストラクション・レイ》', kind: 'projectile', visual: 'orb', count: 1,
      dmg: 460, speed: 35, radius: 1.8, cost: 24, castTime: 0.66, elem: 8, color: 0xd86aff, vivid: true },
    { name: '機神光剣《ビームサーベル》', kind: 'dash', dmg: 490,
      speed: 20.5, dur: 0.48, cost: 22, elem: 8, color: 0xfe8cff, vivid: true },
    { name: '追尾砲陣《ファンネル》', kind: 'rain', visual: 'bolt',
      count: 12, spread: 4.8, radius: 1.4, dmg: 125, delay: 0.35, interval: 0.08,
      cost: 26, elem: 8, color: 0xcd8aff, vivid: true },
    { name: '星葬砲雨《フルバースト》', kind: 'judgment', visual: 'pillar', finalVisual: 'nova',
      count: 10, spread: 4.6, radius: 2.0, dmg: 225, delay: 0.4,
      interval: 0.07, finalDmg: 760, finalRadius: 7.6,
      cost: 42, castTime: 1.7, elem: 8, color: 0xf4a1ff, vivid: true },
    { name: '機神装甲・自己修復', kind: 'heal', heal: 850, radius: 5,
      cost: 30, elem: 8, color: 0xbafff0, vivid: true }
  ],
  over: { name: '最終殲滅《オメガ・バスター》', kind: 'judgment', visual: 'pillar',
    finalVisual: 'nova', count: 17, spread: 6.4, radius: 2.7,
    dmg: 245, delay: 0.55, interval: 0.06, finalDmg: 1700, finalRadius: 10.4,
    castTime: 2.3, elem: 8, color: 0xf4c5ff, vivid: true }
};

// 通常プレイヤーがパーティーに入れられない特別枠
export const SPECIAL_KEYS = ['seraphel', 'chief', 'crimson', 'sovereign', 'bloodfiend', 'valgard', 'operator_gigantes', 'valdarion'];

// ---------- 決定的な乱数（毎回同じ内容を生成する） ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];
function shiftHex(hex, dh, ds = 0, dl = 0) {
  let r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (((h + dh) % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s + ds));
  l = Math.max(0.05, Math.min(0.95, l + dl));
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// ---------- 技の書：100種 ----------
// 属性：st=状態異常キー, sn=表示名, sc=表示色
export const ELEMS = [
  { n: '炎', c: 0xff4a12, p: 'flame', st: 'burn', sn: '火傷' },
  { n: '氷', c: 0x30d0ff, p: 'ice', st: 'freeze', sn: '凍結' },
  { n: '雷', c: 0xffe010, p: 'orb', st: 'para', sn: '麻痺' },
  { n: '風', c: 0x20f0a0, p: 'feather', st: 'slow', sn: '鈍足' },
  { n: '地', c: 0xc0701c, p: 'axe', st: 'petrify', sn: '石化' },
  { n: '光', c: 0xffb820, p: 'orb', st: 'blind', sn: '眩惑' },
  { n: '闇', c: 0x8a1cff, p: 'flame', st: 'curse', sn: '呪い' },
  { n: '水', c: 0x1a60ff, p: 'orb', st: 'silence', sn: '封技' },
  { n: '毒', c: 0x90e010, p: 'feather', st: 'poison', sn: '毒' },
  { n: '血', c: 0xe0103c, p: 'kunai', st: 'bleed', sn: '出血' }
];
const ELEM_HINT = [/[焔炎火紅灰燼爆薬釜]/, /[氷霜雪凍冷蒼]/, /[雷鳴電神]/, /[風翔嵐燕旋矢]/, /[地砂岩石砕鉄盾斧発条歯車]/, /[光聖鈴輪祝白天星翼]/, /[闇黒冥虚影夜断]/, /[水雨涙流]/, /[毒煙薬草花]/, /[血牙爪刃斬裂槍]/];
function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}
// 名前付きの技に属性・色・形・音を振る（未指定のもの）
function finalizeSkill(s, fallbackElem) {
  if (s.elem == null) {
    const i = ELEM_HINT.findIndex((re) => re.test(s.name));
    s.elem = i >= 0 ? i : fallbackElem;
  }
  const h = hashStr(s.name);
  s.shape ??= h % 100;
  s.snd ??= (h >>> 8) % 100;
  if (s.kind === 'heal') s.color = 0x30ff70;
  else if (!s.vivid) s.color = shiftHex(ELEMS[s.elem].c, (((h >>> 4) % 9) - 4) * 0.02, 0, (((h >>> 12) % 5) - 2) * 0.05);
  s.vivid = true;
  return s;
}
const FORMS = [
  (e) => ({ name: e.n + '牙衝', cost: 20, kind: 'shockwave', dmg: 70, radius: 3.2 }),
  (e) => ({ name: e.n + '迅閃', cost: 18, kind: 'dash', dmg: 85, speed: 19, dur: 0.3 }),
  (e) => ({ name: e.n + '連弾', cost: 18, kind: 'projectile', visual: e.p, count: 3, spreadAng: 0.2, dmg: 42, speed: 17, radius: 0.55 }),
  (e) => ({ name: e.n + '刃雨', cost: 26, kind: 'rain', visual: 'blade', count: 7, spread: 2.2, radius: 1.3, dmg: 42, delay: 0.25, interval: 0.06 }),
  (e) => ({ name: e.n + '落星', cost: 30, kind: 'rain', visual: 'meteor', count: 3, spread: 2.2, radius: 1.8, dmg: 70, delay: 0.55, interval: 0.15 }),
  (e) => ({ name: e.n + '天柱', cost: 26, kind: 'rain', visual: 'pillar', count: 4, spread: 2.4, radius: 1.4, dmg: 55, delay: 0.45, interval: 0.1 }),
  (e) => ({ name: e.n + '月刃', cost: 20, kind: 'projectile', visual: 'crescent', count: 2, spreadAng: 0.16, dmg: 52, speed: 18, radius: 0.55 }),
  (e) => ({ name: e.n + '大輪陣', cost: 26, kind: 'shockwave', dmg: 85, radius: 5 }),
  (e) => ({ name: e.n + '槍雨', cost: 26, kind: 'rain', visual: 'spear', count: 7, spread: 2.4, radius: 1.3, dmg: 48, delay: 0.4, interval: 0.07 }),
  (e) => ['光', '水'].includes(e.n)
    ? { name: e.n + '癒結', cost: 28, kind: 'heal', heal: 150, radius: 5 }
    : { name: e.n + '晶棘', cost: 24, kind: 'rain', visual: 'crystal', count: 4, spread: 2, radius: 1.4, dmg: 58, delay: 0.4, interval: 0.1 }
];
export const SKILLS = [];
ELEMS.forEach((e, ei) => FORMS.forEach((fm, fi) => {
  const s = { ...fm(e), color: shiftHex(e.c, (fi - 4.5) * 0.022, 0, ((fi % 3) - 1) * 0.07), elem: ei, shape: ei * 10 + fi, snd: ei * 10 + fi, vivid: true };
  if (s.kind === 'heal') s.color = 0x30ff70;
  SKILLS.push(s);
}));
// 名前付き戦士（基本13体・宇邇宮・セラフェル）の技を仕上げる
Object.values(FIGHTERS).forEach((f, fi) => {
  f.skills.forEach((s) => finalizeSkill(s, fi % 10));
  finalizeSkill(f.over, fi % 10);
});
const OVER_WORDS = ['百華', '天墜', '終焉', '神鳴', '大輪', '万象'];
function makeOver(r, e) {
  const kind = r();
  const name = e.n + pickOf(r, OVER_WORDS) + '・極';
  const o = makeOver0(r, e, kind, name);
  o.elem = ELEMS.indexOf(e);
  return finalizeSkill(o, o.elem);
}
function makeOver0(r, e, kind, name) {
  if (kind < 0.35) return { name, kind: 'rain', visual: pickOf(r, ['blade', 'spear', 'sword']), count: 16, spread: 3.2, radius: 1.5, dmg: 52, delay: 0.4, interval: 0.06, color: e.c };
  if (kind < 0.6) return { name, kind: 'rain', visual: 'meteor', count: 9, spread: 3.6, radius: 2, dmg: 75, delay: 0.6, interval: 0.13, color: e.c };
  if (kind < 0.85) return { name, kind: 'judgment', visual: 'pillar', count: 6, spread: 3.5, radius: 1.9, dmg: 58, delay: 0.6, interval: 0.11, finalDmg: 190, finalRadius: 5, color: e.c };
  return { name, kind: 'shockwave', dmg: 150, radius: 8.5, double: true, color: e.c };
}

// ---------- 追加の戦士：合計100体 ----------
const BASE_ROLE = ['剣士', '術士', '斧使い', '忍び', '騎士', '錬金術師', '弓手', '傭兵', '巫女', '獣戦士', '拳士', '槍騎士', '人形師'];
const EPITHETS = ['流れ星の', '霧雨の', '鉄錆の', '白夜の', '夕凪の', '砂紋の', '月下の', '雷鳴の', '花冷えの', '灰色の', '星読みの', '真鍮の', '琥珀の', '朝凪の', '宵闇の', '渡り鳥の', '風見の', '雪割りの', '紅蓮の', '翡翠の'];
const SY1 = ['ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ラ', 'ヴァ', 'ゼ', 'リ', 'ミ', 'ユ', 'ク', 'シ', 'ト', 'ノ', 'フ', 'ル', 'セ', 'エ', 'オ'];
const SY2 = ['ル', 'リ', 'ナ', 'ロ', 'ズ', 'ヤ', 'ミ', 'レ', 'ガ', 'ディ', 'キ', 'サ'];
const SY3 = ['ン', 'ア', 'ス', 'オ', 'ラ', 'ト', 'ヴ', 'エ', 'ル', 'カ'];
const usedNames = new Set(Object.values(FIGHTERS).map((f) => f.name));
function freshName(r) {
  for (let i = 0; i < 200; i++) {
    const n = pickOf(r, SY1) + pickOf(r, SY2) + pickOf(r, SY3);
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  return 'ナナシ' + usedNames.size;
}
function genFighter(r, bi, extra) {
  const base = FIGHTERS[BASE_KEYS[bi]];
  const e = ELEMS[Math.floor(r() * ELEMS.length)];
  const pool = SKILLS.filter((s) => s.elem === ELEMS.indexOf(e) || r() < 0.08);
  const picks = [];
  while (picks.length < 4) {
    const s = pickOf(r, pool);
    if (!picks.includes(s)) picks.push(s);
  }
  return {
    name: freshName(r), title: pickOf(r, EPITHETS) + BASE_ROLE[bi], model: base.model, face: base.face, faceHue: Math.round(r() * 300 + 30),
    color: e.c, tint: shiftHex(e.c, 0, -0.2, -0.1), height: base.height * (0.92 + r() * 0.16),
    hp: Math.round(base.hp * (0.9 + r() * 0.2)), speed: +(base.speed * (0.93 + r() * 0.14)).toFixed(2),
    overGain: base.overGain, light: { ...base.light },
    skills: picks.map((s) => ({ ...s })), over: makeOver(r, e), ...extra
  };
}
{
  const r = rng(2024);
  for (let i = 0; ROSTER.length < 100; i++) {
    const k = 'g' + i;
    FIGHTERS[k] = genFighter(r, i % BASE_KEYS.length, {});
    ROSTER.push(k);
  }
}

// ---------- 敵キャラ：100体（選択不可、物語と共闘戦に登場） ----------
const FOE_PRE = ['朽ちた', '狂える', '影の', '砂喰いの', '氷棺の', '錆鉄の', '夜啼きの', '偽りの', '呪われし', '黄昏の'];
const FOE_KIND = ['亡霊剣士', '魔女', '鬼', '刺客', '黒騎士', '小鬼', '狩人', '傀儡兵', '堕ちた巫女', '人狼', '破戒僧', '竜騎兵', 'からくり'];
export const ENEMY_ROSTER = [];
{
  const r = rng(666);
  for (let i = 0; i < 100; i++) {
    const bi = i % BASE_KEYS.length;
    const pre = FOE_PRE[Math.floor(i / BASE_KEYS.length + i) % FOE_PRE.length];
    const f = genFighter(r, bi, { enemy: true });
    f.name = pre + FOE_KIND[bi];
    if (ENEMY_ROSTER.some((k) => FIGHTERS[k].name === f.name)) f.name += '・' + '壱弐参肆伍陸漆捌玖'[i % 9];
    f.title = '灯を喰らう者';
    f.tint = shiftHex(f.color, 0, -0.3, -0.35);
    f.hp = Math.round(f.hp * 0.8);
    FIGHTERS['m' + i] = f;
    ENEMY_ROSTER.push('m' + i);
  }
}

// seg=床の多角形の辺数, pshape=柱の形, cshape=浮遊石の形
export const STAGES = [
  { id: 'moon', name: '双月の闘技場', sky: 'assets/twin-moon-sky.webp', floor: 0xffffff, seg: 64, rim: 0xc9a65a, pillar: 0x8c8aa0, pshape: 'cyl', crystal: 0x9fe8ff, cshape: 'oct', fog: 0x2a2850, hemi: 0xcfd8ff, sun: 0xfff0d8 },
  { id: 'desert', name: '砂塵の古円', sky: 'assets/desert-dusk-sky.webp', floor: 0xf2c88a, seg: 8, rim: 0xb07a3a, pillar: 0xb08050, pshape: 'box', crystal: 0xffa040, cshape: 'ico', fog: 0x9a5a3a, hemi: 0xffd8b0, sun: 0xffb070 },
  { id: 'frost', name: '霜の書架', sky: 'assets/frost-aurora-sky.webp', floor: 0xbfe6ff, seg: 6, rim: 0xe0f4ff, pillar: 0xdff4ff, pshape: 'spire', crystal: 0x8fe0ff, cshape: 'oct', fog: 0x4a6a8a, hemi: 0xc8f0ff, sun: 0xd8f0ff },
  { id: 'bamboo', name: '鳴かぬ竹林', sky: 'assets/bamboo-night-sky.webp', floor: 0xa8d090, seg: 12, rim: 0x6a9a4a, pillar: 0x5a9a4a, pshape: 'bamboo', crystal: 0xc8ff8a, cshape: 'ico', fog: 0x1f3a2a, hemi: 0xb8e8c8, sun: 0xe8f8d0 },
  { id: 'heaven', name: '天秤の間', sky: 'assets/heaven-scale-sky.webp', floor: 0xfff2cc, seg: 4, rim: 0xffe08a, pillar: 0xfff8e0, pshape: 'cyl', crystal: 0xfff1a0, cshape: 'torus', fog: 0xd8c08a, hemi: 0xfff4d8, sun: 0xffffff },
  { id: 'ember', name: '燠火の祭壇', sky: 'assets/desert-dusk-sky.webp', floor: 0xff9a7a, seg: 5, rim: 0xff5a2a, pillar: 0x5a2a2a, pshape: 'spire', crystal: 0xff5a2a, cshape: 'ico', fog: 0x4a1a1a, hemi: 0xffb0a0, sun: 0xff8050 },
  { id: 'void', name: '月影の回廊', sky: 'assets/twin-moon-sky.webp', floor: 0x9a8acc, seg: 10, rim: 0xc090ff, pillar: 0x4a3a6a, pshape: 'box', crystal: 0xc090ff, cshape: 'torus', fog: 0x1a1030, hemi: 0xb8a8ff, sun: 0xd8c8ff }
];

// ---------- 音楽：100曲（Web Audioで生成） ----------
const BGM_A = ['暁', '黄昏', '月影', '嵐', '星屑', '灯火', '雪解け', '砂塵', '深淵', '凱旋'];
const BGM_B = ['の行進', 'の舞曲', 'の円舞', 'の鼓動', 'の追想', 'の戦歌', 'の祈り', 'の疾走', 'の残響', 'の序曲'];
export const BGM = [];
for (let i = 0; i < 100; i++) {
  // テンポは136〜175で散らし、10曲に3曲は壮大編成（金管・聖歌隊）に
  BGM.push({ name: BGM_A[i % 10] + BGM_B[Math.floor(i / 10)], seed: 1000 + i * 7919, bpm: 136 + ((i * 17) % 40), epic: i % 10 < 3 });
}
// 頂上決戦の専用曲（1=運営長ルミナリアの乱入、2=ヴェスペラ戦）
export const APEX_BGM = {
  1: { name: '裁定の双月 — 天穹を裂く者', seed: 777001, bpm: 176, apex: 1 },
  2: { name: '冥紫の深淵后 — 緋き終焉', seed: 777777, bpm: 168, apex: 2 }
};

// ---------- ステージ：合計100 ----------
{
  const PLACE_A = ['蒼き', '紅の', '白銀の', '黒曜の', '黄金の', '朽ちた', '逆さの', '眠れる', '歌う', '沈む'];
  const PLACE_B = ['湖畔', '神殿', '砦', '峡谷', '雲海', '墓所', '花園', '鉱山', '港', '回廊'];
  const SKIES = ['assets/twin-moon-sky.webp', 'assets/desert-dusk-sky.webp', 'assets/frost-aurora-sky.webp', 'assets/bamboo-night-sky.webp', 'assets/heaven-scale-sky.webp'];
  const r = rng(777);
  const base = STAGES.slice();
  STAGES.forEach((s, i) => (s.bgm = i));
  let n = 0;
  while (STAGES.length < 100) {
    const b = base[n % base.length];
    const dh = r() * 0.8 - 0.4;
    const name = PLACE_A[n % 10] + PLACE_B[Math.floor(n / 10) % 10];
    STAGES.push({
      ...b, id: 's' + STAGES.length, name, sky: SKIES[Math.floor(r() * SKIES.length)],
      floor: shiftHex(b.floor === 0xffffff ? 0xd8d0ff : b.floor, dh), rim: shiftHex(b.rim, dh), pillar: shiftHex(b.pillar, dh),
      crystal: shiftHex(b.crystal, dh), fog: shiftHex(b.fog, dh), hemi: shiftHex(b.hemi, dh * 0.5), sun: shiftHex(b.sun, dh * 0.3),
      seg: pickOf(r, [3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 64]), pshape: pickOf(r, ['cyl', 'box', 'spire', 'bamboo']),
      cshape: pickOf(r, ['oct', 'ico', 'torus']), bgm: STAGES.length
    });
    n++;
  }
}

// ---------- 強化：100種（各5段） ----------
export const MAX_LV = 5;
const UPG_STATS = [
  { id: 'hp', noun: '器', what: '体力の上限', per: 8, sign: '+' },
  { id: 'atk', noun: '刃', what: '与える傷', per: 6, sign: '+' },
  { id: 'def', noun: '鎧', what: '受ける傷', per: 5, sign: '−' },
  { id: 'flux', noun: '灯', what: '灯力の戻り', per: 12, sign: '+' },
  { id: 'over', noun: '火', what: '奥義の溜まり', per: 10, sign: '+' }
];
const UPG_PRE = ['若葉の', '鉄の', '銀の', '金の', '星の', '月の', '竜の', '古の', '祈りの', '嵐の', '焔の', '氷の', '雷の', '風の', '大地の', '深海の', '天空の', '夜明けの', '黄昏の', '永劫の'];
const FIRST_LABEL = { hp: '生命の器', atk: '刃の冴え', def: '鎧の芯', flux: '灯の巡り', over: '昂りの火' };
export const UPGRADES = [];
UPG_PRE.forEach((pre, pi) => UPG_STATS.forEach((s) => {
  const w = pi === 0 ? 1 : 0.25;
  const pct = +(s.per * w).toFixed(2);
  UPGRADES.push({ id: pi === 0 ? s.id : s.id + pi, stat: s.id, w, pct, what: s.what, sign: s.sign, label: pi === 0 ? FIRST_LABEL[s.id] : pre + s.noun, desc: `${s.what} ${s.sign}${pct}%／段` });
}));
// 詠唱短縮：既存100種に加える独立強化。1段につき3％、最大45％短縮。
// 旧セーブに cast がなくても0段として扱うため、既存の進行を壊さない。
UPGRADES.push({ id: 'cast', stat: 'cast', w: 1, pct: 3, what: '技・奥義・秘奥義の詠唱時間', sign: '−', label: '詠唱の研鑽', name: '詠唱の研鑽', desc: '1段につき詠唱を3％短縮（最大45％）' });
// ---------- 限界突破：全強化を極めると解放。上限段+5、各強化の効果+20%（1回ごと） ----------
export const LB_MAX = 10;
export const LB_STEP = 5;
export const lbMaxLv = (lb) => MAX_LV + LB_STEP * lb;
export const lbMul = (lb) => 1 + 0.2 * lb;
export const lbCost = (lb) => 5000 * (lb + 1);
// ---------- 武器・装備：100種 ----------
const WEP_TYPES = ['剣', '杖', '大斧', '双刃', '槍', '弓', '錬金瓶', '拳甲', '聖鈴', '雅扇'];
const WEP_TIER = ['木の', '鉄の', '鋼の', '銀の', '霊銀の', '竜骨の', '月光の', '天星の', '灯脈の', '双月の'];
const WEP_FOCUS = [['atk'], ['flux', 'over'], ['atk', 'hp'], ['atk', 'over'], ['atk', 'def'], ['atk', 'flux'], ['flux', 'hp'], ['atk', 'def'], ['hp', 'def'], ['over', 'flux']];
export const WEAPONS = [];
WEP_TIER.forEach((tier, ti) => WEP_TYPES.forEach((type, yi) => {
  const pow = 1 + ti * 1.1;
  const bonus = {};
  WEP_FOCUS[yi].forEach((s, j) => (bonus[s] = +(pow * (j ? 0.6 : 1)).toFixed(1)));
  WEAPONS.push({ id: 'w' + (ti * 10 + yi), name: tier + type, bonus, price: 30 + ti * ti * 25 + ti * 30 });
}));
// ---------- 防具：100種（装備すると戦闘・ワールドで見た目に反映） ----------
const ARM_TYPES = ['軽鎧', '重鎧', '法衣', '外套', '胸当て', '肩鎧', '竜鱗鎧', '聖衣', '影装束', '王冠鎧'];
const ARM_FOCUS = [['def', 'hp'], ['def'], ['flux', 'def'], ['hp', 'over'], ['def', 'atk'], ['def', 'hp'], ['hp', 'def'], ['over', 'flux'], ['atk', 'over'], ['def', 'over']];
export const ARMORS = [];
WEP_TIER.forEach((tier, ti) => ARM_TYPES.forEach((type, yi) => {
  const pow = 0.8 + ti * 1.0;
  const bonus = {};
  ARM_FOCUS[yi].forEach((s, j) => (bonus[s] = +(pow * (j ? 0.6 : 1)).toFixed(1)));
  ARMORS.push({ id: 'a' + (ti * 10 + yi), name: tier + type, bonus, price: 25 + ti * ti * 22 + ti * 28 });
}));
// ---------- 至宝（最高額の装備） ----------
WEAPONS.push({ id: 'w100', name: '草薙の剣', bonus: { atk: 16, over: 9, flux: 6 }, price: 150000, relic: true, desc: '大蛇を討った英雄が尾より得たと伝わる黄金の神剣' });
ARMORS.push({ id: 'a100', name: '草薙の盾', bonus: { def: 16, hp: 12, over: 5 }, price: 150000, relic: true, desc: '紅玉と黄金で鍛えられた、災いを退ける神盾' });
// ---------- 召喚獣（運営長・ザルグレイヴ専用。通常攻撃の代わりに発動） ----------
// HPは使い手の最大HPの60%。倒されるまで使い手の前方に居続け、前からの攻撃を受け止める（倒されると15秒後に再召喚可）
export const SUMMONS = [
  { id: 's0', name: 'ヤマタノオロチ', fighter: 'bloodfiend', chief: true, price: 300000, desc: '八つ首の災竜。前方に居座り、通常攻撃の代わりに一斉に噛みつく。前からの攻撃を受け止める' },
  { id: 's1', name: 'スサノオ', fighter: 'crimson', price: 200000, desc: '翠雷をまとう鎧の荒神。前方に立ちはだかり、通常攻撃の代わりに剛腕で薙ぎ払う。前からの攻撃を受け止める' }
];
export const STAT_LABEL = { hp: '体力', atk: '攻撃', def: '守り', flux: '灯力', over: '奥義' };

// 強化の合計上限（段換算）
export const UPG_CAP = { hp: 25, atk: 25, def: 14, flux: 25, over: 20, cast: 15 };

const STORY_BASE = [
  {
    title: '一の灯　砂の街道', stage: 'desert',
    before: [
      ['ロウエン', '灯脈の光が、また一本消えた。双つの月が重なる夜まで、あと七日しかない。'],
      ['ガロウ', 'その腰の灯石、置いていけ。砂漠じゃ光は水より高く売れるんだ。'],
      ['ロウエン', '悪いな。これは売り物じゃない。']
    ],
    enemies: [{ k: 'garou' }],
    after: [['ガロウ', '……ちっ。北の書架へ行くなら、霜の魔女に気をつけな。']]
  },
  {
    title: '二の灯　霜の書架', stage: 'frost',
    before: [
      ['ミナセ', '灯脈を盗んでいるのはあなたね。灯石の匂いがする。'],
      ['ロウエン', '逆だよ。取り返しに来たんだ。……話、聞いてくれないよな。'],
      ['ミナセ', '腕で語って。嘘をつく剣は、氷に映るから。']
    ],
    enemies: [{ k: 'minase' }],
    after: [['ミナセ', '映らなかった。……ごめんなさい。私も行く。東の竹林で、灯を狩る忍びを見たの。']]
  },
  {
    title: '三の灯　鳴かぬ竹林', stage: 'bamboo',
    before: [
      ['ツバキ', '依頼主の名は言えない。けど、その灯石は持ち帰る約束なの。'],
      ['ミナセ', '約束で人を斬るの？'],
      ['ツバキ', '斬らずに済むなら、それが一番。——構えて。']
    ],
    ally: 'minase',
    enemies: [{ k: 'tsubaki' }],
    after: [['ツバキ', '依頼主は「白い翼の使い」。……もう、あの人の仕事はしない。']]
  },
  {
    title: '四の灯　錆びた砦', stage: 'moon',
    before: [
      ['ハーラン', '若いの。この砦を越えたければ、老いぼれの槍をくぐってゆけ。'],
      ['ロウエン', '退いてくれ。あんたと戦う理由がない。'],
      ['ハーラン', '理由なら作ってやろう。覚悟の重さを見せてみよ。']
    ],
    ally: 'minase',
    enemies: [{ k: 'harlan' }],
    after: [['ハーラン', '……良い目だ。この先の工房に、灯脈を詰めた瓶を造る子供がおる。叱ってやってくれ。']]
  },
  {
    title: '五の灯　すす煙の工房', stage: 'ember',
    before: [
      ['ピップ', 'わ、わあ！来ないで！これ、ヴェルカ姉ちゃんが守ってくれるんだから！'],
      ['ヴェルカ', '子供に手を出すなら、森番の矢が黙ってない。'],
      ['ミナセ', '誤解よ……って言っても、もう遅いみたい。']
    ],
    ally: 'minase',
    enemies: [{ k: 'pip' }, { k: 'velka', hpMul: 0.8 }],
    after: [
      ['ピップ', '灯を瓶に詰めたら、白い羽の人がお菓子くれるって……ごめんなさい。'],
      ['ヴェルカ', 'その羽の主、黒い傭兵を雇って塔の門を守らせてる。']
    ]
  },
  {
    title: '六の灯　黒鋼の門', stage: 'void',
    before: [
      ['オズリック', '金はもらった。門は通さない。それだけの話だ。'],
      ['ロウエン', '雇い主が世界の半分を消そうとしてても、か。'],
      ['オズリック', '……なら、俺を倒して証明しろ。']
    ],
    ally: 'minase',
    enemies: [{ k: 'osric' }],
    after: [['オズリック', '報酬は返しておく。塔の中には、鐘を鳴らす巡礼者が囚われている。']]
  },
  {
    title: '七の灯　写し身の回廊', stage: 'void',
    before: [
      ['影写しのロウエン', 'おまえが諦めた道を、俺は全部歩いてきた。'],
      ['ノア', '（遠くで鐘の音）……影は、光を借りて立っているだけです！'],
      ['ミナセ', '二人なら崩せる！']
    ],
    ally: 'minase',
    enemies: [
      { k: 'rowen', tint: 0x2a1f44, name: '影写しのロウエン' },
      { k: 'osric', tint: 0x3b2f66, name: '虚ろの黒騎', hpMul: 0.7 }
    ],
    after: [['ノア', 'ありがとう。鐘で道を照らします。上へ——天秤の間へ。']]
  },
  {
    title: '終の灯　双月の天秤', stage: 'heaven',
    boss: true,
    before: [
      ['セラフェル', '二つの世界は、どちらか一つしか灯せない。私はそれを量り続けてきた。'],
      ['ロウエン', 'だったら天秤ごと壊す。両方灯す方法を、俺たちが探す。'],
      ['セラフェル', 'では裁こう。千の光で。']
    ],
    ally: 'noa',
    enemies: [{ k: 'seraphel', hpMul: 1.3 }],
    after: [
      ['セラフェル', '……天秤が、傾かない。おかしな者たちだ。'],
      ['ミナセ', '灯脈が戻っていく。どちらの空にも。'],
      ['ロウエン', '旅はここからだな。——みんな、ありがとう。']
    ]
  }
];

// ---------- 長編「双月のアルケイア」全十部・百章 ----------
const ARCS = [
  {
    part: '第一部　灯脈の旅立ち', ally: 'minase', stages: ['heaven'],
    titles: ['砂の街道', '霜の書架', '鳴かぬ竹林', '錆びた砦', 'すす煙の工房', '黒鋼の門', '写し身の回廊', '鐘の巡礼者', '白い羽の手紙', '天秤の間・扉前'],
    boss: { k: 'seraphel', name: 'セラフェルの幻影', tint: 0x8090c0, hpMul: 0.55 },
    close: [['セラフェルの幻影', 'まだ量るに足りぬ。世界を巡り、灯の重さを知ってから来るがいい。'], ['ロウエン', '……いいだろう。全部見てきてやる。'], ['ミナセ', '九つの地に、天秤の秘密が散らばっている。ノアの鐘がそう告げてる。']]
  },
  {
    part: '第二部　砂海の王冠', ally: 'minase', stages: ['desert', 'ember'],
    intro: [['ミナセ', '灯脈の乱れは天秤の間だけじゃなかった。南の砂海で、灯を喰う王が目覚めたって。'], ['ロウエン', 'セラフェルは「片方しか灯せない」と言った。その理由が、どこかに埋まってる気がする。'], ['ミナセ', 'なら掘り返しましょう。砂の底まで。']],
    titles: ['蜃気楼の隊商', '塩の井戸', '骨の市場', '砂鯨の背', '盗賊王の手紙', '沈んだ鐘楼', '熱風の審問', '砂時計の墓', '王冠の影', '砂王ザハル'],
    boss: { k: 'garou', name: '砂王ザハル', tint: 0xd8b040, hpMul: 1.6 },
    close: [['砂王ザハル', '王冠は……灯を守るための枷だった。外せば、砂海は灯を飲み干す……'], ['ロウエン', 'だったら別の方法で守る。王冠じゃなく、人の手で。']]
  },
  {
    part: '第三部　霜天の書', ally: 'noa', stages: ['frost'],
    intro: [['ノア', '鐘が北で鳴いています。書架の奥に、天秤を造った人の記録があるはず。'], ['ロウエン', 'ミナセの故郷か。'], ['ミナセ', '私も知らない階層があるの。……少し怖い。']],
    titles: ['凍てた写本', '白い司書', '閉ざされた閲覧室', '雪狼の群れ', '禁書の頁', '氷河の礼拝堂', '吹雪の証言', '星図の欠片', '書架の最奥', '氷書官グレイシア'],
    boss: { k: 'minase', name: '氷書官グレイシア', tint: 0x4060a0, hpMul: 1.7 },
    close: [['氷書官グレイシア', '天秤を造ったのは、二つの世界の王たち自身。灯を分け合えず、争いを量りに委ねたのよ。'], ['ノア', 'なら、量りを捨てる勇気も、人にはあるはずです。']]
  },
  {
    part: '第四部　竹影の誓約', ally: 'tsubaki', stages: ['bamboo', 'void'],
    intro: [['ツバキ', '私を育てた里が、白い翼の使いと手を結んだ。けじめは私がつける。'], ['ロウエン', '一人で背負うな。灯を返す旅は、みんなの旅だ。'], ['ツバキ', '……変な人。でも、ありがとう。']],
    titles: ['鳴かぬ笛', '隠れ里の門', '九つの影', '月見の宴', '裏切りの苦無', '竹の迷宮', '師の墓標', '霧の決闘場', '影頭の屋敷', '影頭ムラクモ'],
    boss: { k: 'kurouga', name: '影頭ムラクモ', tint: 0x302040, hpMul: 1.7 },
    close: [['影頭ムラクモ', '里を守るため、片方の世界を売った。それが影の務めだ。'], ['ツバキ', '影は光の隣でしか立てない。——師匠の言葉よ。']]
  },
  {
    part: '第五部　錆鉄の行軍', ally: 'harlan', stages: ['moon', 'ember', 'desert'],
    intro: [['ハーラン', 'かつての戦友が、灯脈を砲弾に変えておる。老いぼれにも、やり残しがあってな。'], ['ロウエン', '手を貸すよ、ハーラン。'], ['ハーラン', 'ふん。若いのに借りを作るとはな。']],
    titles: ['錆びた軍旗', '老兵の帰還', '鉄の橋', '補給線の夜', '機械仕掛けの歩兵', '燃える穀倉', '捕虜の歌', '城壁の亀裂', '将軍の天幕', '鉄将ヴォルグ'],
    boss: { k: 'osric', name: '鉄将ヴォルグ', tint: 0x8a4a2a, hpMul: 1.8 },
    close: [['鉄将ヴォルグ', '勝てば片方の空は守れた。……お前は、両方を選ぶのか。'], ['ハーラン', '選ぶのではない。背負うのだ。わしらの時代にできなかったことを。']]
  },
  {
    part: '第六部　すす煙の発明', ally: 'pip', stages: ['ember', 'moon'],
    intro: [['ピップ', 'ぼく、灯を瓶に詰める方法を考えたんだ。今度は「増やす」方法！'], ['ペトラ', 'その理論、私の師が盗んだものと同じ……。'], ['ロウエン', '増やせるなら、天秤なんていらなくなるな。']],
    titles: ['爆ぜる煙突', '歯車の街', '盗まれた設計図', 'ぜんまい人形の反乱', '錬金ギルドの査問', '硝子の温室', '灯の蒸留塔', '地下の溶鉱炉', '師匠の工房', '大錬師アルケム'],
    boss: { k: 'petra', name: '大錬師アルケム', tint: 0x6a5a2a, hpMul: 1.8 },
    close: [['大錬師アルケム', '灯を増やせば、世界は灯に溺れる。量りが必要なのだよ！'], ['ピップ', 'じゃあ、ぼくが量りより賢い器を作る！']]
  },
  {
    part: '第七部　月吠えの荒野', ally: 'kurouga', stages: ['moon', 'frost', 'bamboo'],
    intro: [['クロウガ', '月が欠けるたび、群れが灯を食い荒らす。長の目が濁ったんだ。'], ['ロウエン', '長と話はできないのか。'], ['クロウガ', '牙でしか話さない奴だ。だから俺が牙で話す。']],
    titles: ['銀の足跡', '狩り場の掟', '灯を咥えた狼', '荒野の焚き火', '月蝕の遠吠え', '群れの裏切り者', '渓谷の吊り橋', '古き獣の祠', '双月の丘', '群れの長フェンリス'],
    boss: { k: 'kurouga', name: '群れの長フェンリス', tint: 0x202838, hpMul: 1.9 },
    close: [['群れの長フェンリス', '……月の声が、二つに割れていた。どちらに吠えればよかったのだ。'], ['クロウガ', '両方さ。俺たちは二つの月の下で生まれたんだから。']]
  },
  {
    part: '第八部　燠火の祭典', ally: 'rinfa', stages: ['ember'],
    intro: [['リンファ', '燠火の寺では、灯を炎として祀っています。けれど最近、祀りが生贄に変わったと。'], ['イグナ', '竜の血を引く者として、見過ごせない。'], ['ロウエン', '行こう。燃やすべきなのは、人じゃない。']],
    titles: ['火渡りの儀', '赤い経文', '灰の巡礼', '燃えない寺', '竜の鱗', '炎舞の祭', '十の試練', '溶岩の回廊', '火口の祭壇', '炎の神官イフラ'],
    boss: { k: 'rinfa', name: '炎の神官イフラ', tint: 0x802010, hpMul: 1.9 },
    close: [['炎の神官イフラ', '炎は捧げねば消える。消えれば寺も、民も……'], ['リンファ', '祈りは奪うものではなく、分け合うもの。拳で教えました。']]
  },
  {
    part: '第九部　月影の深層', ally: 'osric', stages: ['void', 'heaven'],
    intro: [['オズリック', '回廊の底で、俺たちの写し身が軍を成している。セラフェルの裁きの残り滓だ。'], ['ロウエン', '俺の影は、一度倒したはずだ。'], ['オズリック', '影は何度でも生まれる。お前が迷うたびにな。']],
    titles: ['鏡の門', '偽りの記憶', '二人目のミナセ', '名を失った街', '逆さの空', '写し身の軍勢', '影の玉座', '光を借りる者', '虚ろの天秤', '写し身の王'],
    boss: { k: 'rowen', name: '写し身の王', tint: 0x1a1030, hpMul: 2.0 },
    close: [['写し身の王', 'おまえが迷いを捨てるなら、俺も消えよう。'], ['ロウエン', '捨てないさ。迷ったまま、それでも進む。それが俺だ。']]
  },
  {
    part: '第十部　双月の天秤', ally: 'noa', stages: ['heaven'],
    intro: [['ノア', 'すべての灯脈が、天秤の間へ流れ込み始めました。セラフェルが最後の裁きを始めるつもりです。'], ['ミナセ', '今度こそ、天秤ごと。'], ['ロウエン', 'ああ。九つの地で知った灯の重さ、全部持っていく。']],
    titles: ['天への階', '九人の証人', '量られた街', '白翼の騎士団', '天秤の皿', '失われた片割れ', '鐘の約束', '灯脈の源', '裁きの前夜', '双月の天秤']
  }
];
// ---------- ボス：全25体（各部の主＋中ボス15体＋ラスボス・セラフェル） ----------
// 専用の戦士データを作り、属性ごとに固有の技と奥義を持たせる
export const BOSS_ROSTER = [];
function makeBoss(spec, i) {
  const base = FIGHTERS[spec.k];
  const r = rng(9000 + i * 17);
  const e = ELEMS[spec.elem];
  const pool = SKILLS.filter((s) => s.elem === spec.elem && s.kind !== 'heal');
  const picks = [];
  while (picks.length < 4) {
    const s = pickOf(r, pool);
    if (!picks.includes(s) || picks.length >= pool.length) picks.push(s);
  }
  const over = makeOver(r, e);
  over.name = spec.over;
  over.dmg = Math.round((over.dmg || 0) * 1.15);
  if (over.finalDmg) over.finalDmg = Math.round(over.finalDmg * 1.15);
  const key = 'boss' + i;
  FIGHTERS[key] = {
    ...base, name: spec.name, title: spec.title, color: e.c, tint: spec.tint, enemy: true, locked: true,
    hp: Math.round(base.hp * 1.15), overGain: base.overGain * 1.3,
    light: { ...base.light, dmg: Math.round(base.light.dmg * 1.2) },
    skills: picks.map((s) => ({ ...s })), over
  };
  BOSS_ROSTER.push(key);
  return { k: key, name: spec.name, tint: spec.tint, hpMul: spec.hpMul, scale: spec.scale || 1.2 };
}
// 各部の主（第二〜九部）
const PART_BOSSES = [
  null,
  { k: 'garou', name: '砂王ザハル', title: '砂海を統べる王', elem: 4, tint: 0xd8b040, hpMul: 1.6, over: '砂冠崩落・王墓' },
  { k: 'minase', name: '氷書官グレイシア', title: '禁書を守る司書長', elem: 1, tint: 0x4060a0, hpMul: 1.7, over: '永久凍書・白頁' },
  { k: 'kurouga', name: '影頭ムラクモ', title: '隠れ里の頭領', elem: 6, tint: 0x302040, hpMul: 1.7, over: '影喰い九尾陣' },
  { k: 'osric', name: '鉄将ヴォルグ', title: '錆鉄軍の総大将', elem: 9, tint: 0x8a4a2a, hpMul: 1.8, over: '鉄血大行軍' },
  { k: 'petra', name: '大錬師アルケム', title: '錬金ギルドの長', elem: 8, tint: 0x6a5a2a, hpMul: 1.8, over: '大釜の禁薬・万毒' },
  { k: 'kurouga', name: '群れの長フェンリス', title: '月吠えの古狼', elem: 3, tint: 0x202838, hpMul: 1.9, over: '双月嵐牙' },
  { k: 'rinfa', name: '炎の神官イフラ', title: '燠火寺の大神官', elem: 0, tint: 0x802010, hpMul: 1.9, over: '劫火曼荼羅' },
  { k: 'rowen', name: '写し身の王', title: '影写しの軍勢の主', elem: 6, tint: 0x1a1030, hpMul: 2.0, over: '虚像千刃・鏡界' }
];
// 中ボス：各部の第五章（10体）＋第二〜六部の第八章（5体）
const MID_BOSSES = {
  '0-7': { k: 'harlan', name: '錆びた番兵長ガルド', title: '砦に囚われた騎士', elem: 4, tint: 0x6a6050, hpMul: 1.3, over: '錆盾の大崩し' },
  '1-4': { k: 'tsubaki', name: '砂刃の盗賊カシム', title: '骨の市場の顔役', elem: 9, tint: 0xa07040, hpMul: 1.4, over: '砂塵千刃' },
  '1-7': { k: 'noa', name: '砂時計の巫女セト', title: '時を量る墓守', elem: 5, tint: 0xc0a060, hpMul: 1.5, over: '砂刻の審判' },
  '2-4': { k: 'velka', name: '雪狼使いヘルガ', title: '白き狩人', elem: 1, tint: 0x8090b0, hpMul: 1.5, over: '吹雪狩り・千本矢' },
  '2-7': { k: 'pip', name: '星図の書記ロルフ', title: '頁を喰らう学徒', elem: 7, tint: 0x406080, hpMul: 1.5, over: '星降る禁頁' },
  '3-4': { k: 'tsubaki', name: '宴の刺客サザナミ', title: '月見の宴の影', elem: 7, tint: 0x203048, hpMul: 1.6, over: '月下水影斬' },
  '3-7': { k: 'harlan', name: '霧の剣聖オボロ', title: '師を斬った者', elem: 3, tint: 0x506070, hpMul: 1.6, over: '霧散・無影剣' },
  '4-4': { k: 'petra', name: '機巧兵団長ギア', title: '鋼の歩兵の指揮官', elem: 2, tint: 0x605848, hpMul: 1.6, over: '機巧雷撃砲' },
  '4-7': { k: 'garou', name: '城壁の巨人ゴウザン', title: '割れぬ壁', elem: 4, tint: 0x504030, hpMul: 1.8, scale: 1.4, over: '大地震・城崩し' },
  '5-4': { k: 'igna', name: '査問官ヴィトリオ', title: '錬金ギルドの処刑人', elem: 8, tint: 0x507030, hpMul: 1.7, over: '硝子毒槍陣' },
  '5-7': { k: 'garou', name: '溶鉱炉の主バルカ', title: '地下の鍛冶王', elem: 0, tint: 0x803010, hpMul: 1.8, scale: 1.35, over: '溶鉄の大瀑布' },
  '6-4': { k: 'kurouga', name: '月蝕のスコル', title: '月を喰らう狼', elem: 6, tint: 0x181828, hpMul: 1.8, over: '月蝕牙' },
  '7-4': { k: 'igna', name: '炎竜騎ザラム', title: '竜鱗の祭司', elem: 0, tint: 0x902818, hpMul: 1.9, over: '竜炎天墜' },
  '8-4': { k: 'minase', name: '逆さ空の魔女ユラ', title: '偽りのミナセ', elem: 7, tint: 0x281848, hpMul: 1.9, over: '逆巻く涙の空' },
  '9-4': { k: 'harlan', name: '白翼騎士団長アウレル', title: '天秤の守護騎士', elem: 5, tint: 0xc8c0a0, hpMul: 2.0, over: '白翼聖騎行' }
};
const PART_BOSS_SPEC = PART_BOSSES.map((s, i) => (s ? makeBoss(s, i) : null));
const MID_BOSS_SPEC = {};
Object.entries(MID_BOSSES).forEach(([key, s], i) => {
  MID_BOSS_SPEC[key] = makeBoss(s, 20 + i);
});
const NAME_OF = (k) => FIGHTERS[k]?.name || k;
const TAUNTS = [
  'ここから先は通さぬ。灯の匂いがする者は、すべて敵だ。', 'お前たちの噂は聞いている。天秤に逆らう愚か者ども。',
  '灯を置いていけ。そうすれば命までは取らない。', '主の命だ。恨むなら、自分の歩いた道を恨め。',
  '今宵は月がよく見える。斬り合うには、いい夜だ。', 'この地の灯は、もう我らのものだ。',
  '量りの外に立つ者は、ここで消える定めだ。', '腹が減った……灯を、灯をよこせ……'
];
const HERO_LINES = [
  (t) => `「${t}」……ここにも灯の欠片が残っているはずだ。`, () => '退いてくれ。俺たちは奪いに来たんじゃない。',
  () => '話しても無駄みたいだな。——構えろ。', () => '灯脈がまた細くなってる。急ごう。',
  (t) => `${t}か。噂よりずっと静かだな……静かすぎる。`, () => '何度でも言う。灯は、誰か一人のものじゃない。'
];
const ALLY_LINES = ['気をつけて。この気配、ただの番人じゃない。', '後ろは任せて。あなたは前だけ見て。', '灯が泣いてる……早く返してあげないと。', '数が多い。囲まれる前に崩しましょう。', '大丈夫、今日の私は調子がいいの。'];
const AFTER_LINES = [
  (e) => [e, '……強いな。先へ進め。だが、その先はもっと暗いぞ。'], (e) => [e, '主は……この先で待っている。'],
  (e, a) => [a, '灯がひとつ、空へ帰っていく。'], (e, a, p) => ['ロウエン', `次へ行こう。${p}の奥へ。`],
  (e) => [e, '光が……あたたかい。こんなもの、忘れていた。']
];
const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const chapNo = (n) => {
  const t = Math.floor(n / 10), o = n % 10;
  return n === 100 ? '百' : (t > 1 ? KANJI[t] : '') + (t ? '十' : '') + KANJI[o];
};
export const STORY = [];
{
  const r = rng(4242);
  ARCS.forEach((arc, ai) => {
    const place = arc.part.split('　')[1];
    arc.titles.forEach((title, ci) => {
      const no = ai * 10 + ci + 1;
      const head = `第${chapNo(no)}章　${title}`;
      // 第一部の1〜7章と最終章は原典の物語をそのまま使う
      if (ai === 0 && ci < 7) {
        STORY.push({ ...STORY_BASE[ci], title: head, part: arc.part });
        return;
      }
      if (no === 100) {
        STORY.push({ ...STORY_BASE[7], title: head, part: arc.part });
        return;
      }
      const stage = ci % 3 === 2 && ai > 0 ? 's' + (7 + ((ai * 10 + ci) * 13) % 93) : pickOf(r, arc.stages);
      const isBoss = ci === 9 && arc.boss;
      const mid = MID_BOSS_SPEC[ai + '-' + ci];
      const lvl = 0.75 + ai * 0.08;
      let enemies;
      if (isBoss) {
        enemies = [{ ...(PART_BOSS_SPEC[ai] || arc.boss) }];
        if (ai > 1) enemies.push({ k: pickOf(r, ENEMY_ROSTER), hpMul: lvl * 0.6 });
      } else if (mid) {
        enemies = [{ ...mid }];
      } else {
        const cnt = Math.min(3, 1 + Math.floor(ci / 4) + (ai > 5 ? 1 : 0));
        enemies = Array.from({ length: cnt }, () => ({ k: pickOf(r, ENEMY_ROSTER), hpMul: +(lvl * (cnt > 1 ? 0.75 : 1.1)).toFixed(2) }));
      }
      const en = enemies[0].name || NAME_OF(enemies[0].k);
      const an = NAME_OF(arc.ally);
      let before;
      if (ci === 0 && arc.intro) {
        before = [...arc.intro, [en, pickOf(r, TAUNTS)]];
      } else if (isBoss) {
        before = [[en, 'よく来た。九つの章を越えてきた足音は、遠くからでも聞こえていた。'], ['ロウエン', `${place}の灯、返してもらう。`], [an, pickOf(r, ALLY_LINES)]];
      } else if (mid) {
        before = [[en, `我は${FIGHTERS[mid.k].title}、${en}。この先へは一歩も通さぬ。`], ['ロウエン', '強い灯の気配……こいつ、ただの番人じゃない。'], [an, pickOf(r, ALLY_LINES)]];
      } else {
        before = [['ロウエン', pickOf(r, HERO_LINES)(title)], [en, pickOf(r, TAUNTS)], [an, pickOf(r, ALLY_LINES)]];
      }
      const after = isBoss ? arc.close : mid ? [[en, 'ぐ……主よ、お許しを……'], ['ロウエン', `${place}の灯、ひとつ取り戻した。`]] : [pickOf(r, AFTER_LINES)(en, an, place)];
      STORY.push({ title: head, part: arc.part, stage, ally: arc.ally, enemies, before, after, boss: !!(isBoss || mid) });
    });
  });
}
// ---- 各章を1〜3話に：話の合間の会話（第2話・第3話の前） ----
{
  const EP2 = [
    (a, p) => [['ロウエン', '……まだ終わりじゃない。気配がもうひとつ近づいてくる。'], [a, `${p}の灯を狙う群れが、残っていたみたい。`]],
    (a) => [[a, '待って、足音が増えてる！'], ['ロウエン', '休む暇はなさそうだな。構えろ！']],
    (a, p) => [['謎の声', `${p}の灯は渡さぬ……我らが主のために。`], ['ロウエン', '主？　誰のことだ。答えてもらうぞ！']],
    (a) => [[a, '空気が変わった……今度のは手ごわいよ。'], ['ロウエン', '背中は任せた。一気に行く！']]
  ];
  const EP3 = [
    (a, p) => [['ロウエン', 'これで最後だ。この地の影を、ここで断つ！'], [a, `${p}に灯を還そう。全部、終わらせて。`]],
    (a) => [['影の声', '……よくぞここまで。だが、最後の番人が貴様らを待つ。'], [a, '最後の番人……！　ロウエン、気をつけて。']],
    (a) => [[a, '灯が震えてる……決着の時みたい。'], ['ロウエン', 'ああ。三度目の正直だ。']]
  ];
  STORY.forEach((ch, n) => {
    ch.eps = 1 + (n % 3 === 1 ? 1 : n % 3 === 2 ? 2 : 0) + (ch.boss && n % 3 === 0 ? 1 : 0);
    ch.eps = Math.min(3, ch.eps);
    const an = NAME_OF(ch.ally || 'minase');
    const place = (ch.part || '').split('　')[1] || 'この地';
    ch.epLines = [];
    if (ch.eps >= 2) ch.epLines.push(EP2[n % EP2.length](an, place));
    if (ch.eps >= 3) ch.epLines.push(EP3[n % EP3.length](an, place));
  });
}

// ---- 最強格：宇邇宮とセラフェルを全戦士（ボス含む）の頂点に据える ----
{
  const others = Object.entries(FIGHTERS).filter(([k]) => k !== 'uninomiya' && k !== 'seraphel' && k !== 'chief' && k !== 'sovereign' && k !== 'sovereign2' && k !== 'bloodfiend' && k !== 'valgard').map(([, f]) => f);
  const top = (fn) => Math.max(...others.map((f) => fn(f) || 0));
  const maxHp = top((f) => f.hp), maxSpd = top((f) => f.speed), maxOg = top((f) => f.overGain);
  const maxLight = top((f) => f.light?.dmg * (f.light?.shots || 1));
  const maxPow = top((f) => f.power), maxArm = Math.min(1, ...others.map((f) => f.armor || 1));
  for (const k of ['seraphel', 'uninomiya']) {
    const f = FIGHTERS[k];
    const lead = k === 'seraphel' ? 1.12 : 1.1;
    f.hp = Math.round(Math.max(f.hp, maxHp) * lead);
    f.speed = +(Math.max(f.speed, maxSpd) * 1.05).toFixed(2);
    f.overGain = +(Math.max(f.overGain, maxOg) * 1.1).toFixed(2);
    if (f.light) f.light.dmg = Math.max(f.light.dmg, Math.ceil((maxLight * 1.1) / (f.light.shots || 1)));
    f.power = Math.max(1, maxPow) * 1.35 * (k === 'seraphel' ? 1.05 : 1);
    f.armor = maxArm * 0.7;
    f.fluxMul = 1.4;
  }
  // 運営長はさらにその上をずば抜ける
  const s = FIGHTERS.seraphel, c = FIGHTERS.chief;
  c.hp = Math.round(s.hp * 1.5);
  c.speed = +(s.speed * 1.08).toFixed(2);
  c.overGain = +(s.overGain * 1.3).toFixed(2);
  c.light.dmg = Math.ceil((s.light.dmg * (s.light.shots || 1) * 1.4) / c.light.shots);
  c.power = s.power * 1.6;
  c.armor = s.armor * 0.6;
  c.fluxMul = 2;
  // ヴェスペラはルミナリアのさらに上（第二形態はもう一段上）
  const v1 = FIGHTERS.sovereign, v2 = FIGHTERS.sovereign2;
  v1.hp = Math.round(c.hp * 1.25); v1.speed = +(c.speed * 1.05).toFixed(2); v1.overGain = +(c.overGain * 1.15).toFixed(2);
  v1.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.3) / v1.light.shots);
  v1.power = c.power * 1.3; v1.armor = c.armor * 0.8; v1.fluxMul = 2.4;
  v2.hp = Math.round(c.hp * 1.6); v2.speed = +(c.speed * 1.12).toFixed(2); v2.overGain = +(c.overGain * 1.4).toFixed(2);
  v2.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.7) / v2.light.shots);
  v2.power = c.power * 1.7; v2.armor = c.armor * 0.6; v2.fluxMul = 3;
  // ザルグレイヴはルミナリアと同格
  const bf = FIGHTERS.bloodfiend;
  bf.hp = Math.round(c.hp * 1.05); bf.speed = +(c.speed * 1.04).toFixed(2); bf.overGain = c.overGain;
  bf.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.05) / bf.light.shots);
  bf.power = c.power * 1.05; bf.armor = c.armor; bf.fluxMul = 2;
}

// ---- 週替わりイベント（ボーナスステージ）：日本時間の月曜0時に切り替わる ----
// foes: 'mob'=魔物 / 'boss'=ボス / 'roster'=戦士 / 'mirror'=自分の写し / キー名
export const EVENTS = [
  { name: '魔物の大行進', desc: '弱めの魔物が6体押し寄せる。まとめて薙ぎ払え！', foes: [['mob', 6]], hp: 0.45, atk: 0.7, ally: 0, first: 600, reward: 120, stage: 2 },
  { name: '巨影の襲来', desc: '巨大化したボスが1体。体力3倍の大物を討て！', foes: [['boss', 1]], hp: 3, atk: 1, scale: 1.6, ally: 1, first: 800, reward: 150, stage: 4 },
  { name: '灯晶の雨', desc: '相棒と二人で魔物3体に挑む。報酬がいつもの3倍！', foes: [['mob', 3]], hp: 0.8, atk: 0.8, ally: 1, first: 500, reward: 180, stage: 1 },
  { name: '天秤の試練', desc: '最強格セラフェルとの一騎打ち。勝てば大量の灯晶！', foes: [['seraphel', 1]], hp: 1, atk: 1, ally: 0, first: 1200, reward: 200, stage: 5 },
  { name: '双月の鏡', desc: '自分と同じ戦士の写しが2体。己を越えよ！', foes: [['mirror', 2]], hp: 0.9, atk: 0.9, ally: 0, first: 700, reward: 140, stage: 3 },
  { name: '包囲突破', desc: 'たった一人で戦士4体に囲まれる。生き残れ！', foes: [['roster', 4]], hp: 0.6, atk: 0.75, ally: 0, first: 900, reward: 170, stage: 0 },
  { name: '連合討伐戦', desc: '相棒2人とボス2体の大乱戦！', foes: [['boss', 2]], hp: 1.4, atk: 0.9, scale: 1.25, ally: 2, first: 1000, reward: 180, stage: 6 },
  { name: '血月の夜', desc: '血に飢えた戦士3体。攻撃は激しいが体力は低い。', foes: [['roster', 3]], hp: 0.5, atk: 1.4, ally: 0, first: 800, reward: 160, stage: 7 }
];
const WEEK_MS = 7 * 24 * 3600 * 1000;
// 1970-01-05(月) 0:00 JST を起点にした週番号
export function eventWeek(now = Date.now()) {
  return Math.floor((now + 9 * 3600 * 1000 - 4 * 24 * 3600 * 1000) / WEEK_MS);
}
// ---- 運営長が作る特別イベント（受信データもここで検証） ----
export const EV_FOE_KINDS = { mob: '魔物', boss: 'ボス', roster: '戦士', mirror: '自分の写し' };
const evNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function sanitizeEvent(e, fighters) {
  if (!e || typeof e !== 'object') return null;
  const t = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const name = t(e.name, 24);
  if (!name) return null;
  const foes = (Array.isArray(e.foes) ? e.foes : []).slice(0, 4)
    .map((f) => Array.isArray(f) ? [String(f[0]), Math.round(evNum(f[1], 1, 8, 1))] : null)
    .filter((f) => f && (EV_FOE_KINDS[f[0]] || fighters?.[f[0]]));
  if (!foes.length || foes.reduce((s, f) => s + f[1], 0) > 10) return null;
  const at = Math.round(evNum(e.at, 0, 1e13, 0)), ends = Math.round(evNum(e.ends, 0, 1e13, 0));
  if (!at || ends <= at || ends - at > 31 * 86400000) return null;
  return {
    custom: true, name, desc: t(e.desc, 80), foes,
    hp: evNum(e.hp, 0.2, 10, 1), atk: evNum(e.atk, 0.2, 5, 1), scale: evNum(e.scale, 0.6, 2.5, 1),
    ally: Math.round(evNum(e.ally, 0, 3, 0)), first: Math.round(evNum(e.first, 0, 20000, 500)),
    reward: Math.round(evNum(e.reward, 0, 5000, 100)), stage: Math.round(evNum(e.stage, 0, 20, 0)), at, ends
  };
}
export function currentEvent(now = Date.now()) {
  const w = eventWeek(now);
  const ends = (w + 1) * WEEK_MS - 9 * 3600 * 1000 + 4 * 24 * 3600 * 1000;
  return { week: w, ev: EVENTS[((w % EVENTS.length) + EVENTS.length) % EVENTS.length], ends };
}

// ---- 全戦士共通の回復技（skills[4]。H キー／「癒」ボタン） ----
export const HEAL_SLOT = 4;
for (const [k, f] of Object.entries(FIGHTERS)) {
  if (!f.skills || f.skills.length > HEAL_SLOT) continue;
  while (f.skills.length < HEAL_SLOT) f.skills.push({ ...f.skills[0] });
  const v = k === 'sovereign' || k === 'sovereign2';
  f.skills.push(finalizeSkill({
    name: v ? '冥后の再誕《リザレクト・ノクス》' : '癒しの灯',
    cost: v ? 22 : 30, kind: 'heal', heal: Math.round((f.hp || 300) * (v ? 0.3 : 0.2)), radius: v ? 9 : 5, elem: v ? 5 : 7, vivid: true
  }, 7));
}

// ヴァルガルド専用の氷晶回復
if (FIGHTERS.valgard?.skills?.[HEAL_SLOT]) Object.assign(FIGHTERS.valgard.skills[HEAL_SLOT], { name: '氷晶の再生', elem: 1, color: 0x91e4ff });

// ---- ヴェスペラ：全10属性の最上級技（skills[5..14]）。技ボタンを押すたびに順に繰り出す ----
{
  const TOP = [
    { name: '劫焔煉獄《インフェルノ・クラウン》', kind: 'rain', visual: 'meteor', count: 9, spread: 3.6, radius: 2.6, dmg: 150, delay: 0.5, interval: 0.08 },
    { name: '永劫氷葬《アブソリュート・ゼロ》', kind: 'implode', dmg: 260, radius: 9 },
    { name: '神鳴万雷《ディヴァイン・ボルト》', kind: 'rain', visual: 'bolt', count: 12, spread: 4, radius: 2.2, dmg: 110, delay: 0.25, interval: 0.05 },
    { name: '天嵐神威《テンペスト・ロード》', kind: 'shockwave', dmg: 250, radius: 10, double: true },
    { name: '大地崩壊《ガイア・ブレイカー》', kind: 'rain', visual: 'crystal', count: 10, spread: 3.8, radius: 2.4, dmg: 130, delay: 0.4, interval: 0.07 },
    { name: '聖天裁光《ジャッジメント・レイ》', kind: 'rain', visual: 'pillar', count: 10, spread: 4, radius: 2.3, dmg: 135, delay: 0.4, interval: 0.06 },
    { name: '冥獄終夜《エターナル・ナイト》', kind: 'implode', dmg: 290, radius: 9.5 },
    { name: '蒼海大渦《リヴァイアサン・タイド》', kind: 'projectile', visual: 'orb', count: 5, spreadAng: 0.22, dmg: 160, speed: 24, radius: 1.3 },
    { name: '万毒腐界《ヴェノム・パンデミア》', kind: 'rain', visual: 'nova', count: 7, spread: 4, radius: 3, dmg: 140, delay: 0.45, interval: 0.1 },
    { name: '血華千刃《ブラッド・サウザンド》', kind: 'rain', visual: 'blade', count: 14, spread: 4, radius: 1.8, dmg: 105, delay: 0.25, interval: 0.04 }
  ];
  for (const [key, mul] of [['sovereign', 1], ['sovereign2', 1.25]]) {
    const f = FIGHTERS[key];
    TOP.forEach((t, ei) => {
      f.skills.push(finalizeSkill({ ...t, dmg: Math.round(t.dmg * mul), cost: 24, elem: ei, color: ELEMS[ei].c, vivid: true }, ei));
    });
    f.pool = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  }
}


// ARK-20261107-BALANCE-CAST
// Model-matched portraits: re-use the original illustrated portrait for each GLB.
// Derived characters sharing that exact mesh keep its portrait, rather than
// an arbitrary hue-rotation that changes clothing/skin colors independently.
const portraitForModel = new Map();
for (const [key, f] of Object.entries(FIGHTERS)) {
  if (f?.model && f?.face && !f.enemy && !/^g\d+$/.test(key)) portraitForModel.set(f.model, f.face);
}
for (const f of Object.values(FIGHTERS)) {
  if (portraitForModel.has(f.model)) f.face = portraitForModel.get(f.model);
  // hue rotation doesn't correspond to the actual glb's painted textures.
  if (f.faceHue != null) f.faceHue = 0;
}

// ARK-20261107-PORTRAIT-NEW
// Newly illustrated character portraits supplied for 13 model archetypes.
// Select / party select use FIGHTERS[key].face. These art assets never alter GLBs.
const NEW_MODEL_PORTRAITS = {
  'hero-swordsman.glb': ['assets/portraits/hero-swordsman-01.webp', 'assets/portraits/hero-swordsman-02.webp'],
  'mage-weaver.glb': ['assets/portraits/mage-weaver-01.webp', 'assets/portraits/mage-weaver-02.webp', 'assets/portraits/mage-weaver-03.webp'],
  'brute-axe.glb': ['assets/portraits/brute-axe-01.webp', 'assets/portraits/brute-axe-02.webp'],
  'shinobi-twin.glb': ['assets/portraits/shinobi-twin-01.webp', 'assets/portraits/shinobi-twin-02.webp', 'assets/portraits/shinobi-twin-03.webp', 'assets/portraits/shinobi-twin-04.webp', 'assets/portraits/shinobi-twin-05.webp'],
  'old-knight.glb': ['assets/portraits/old-knight-01.webp', 'assets/portraits/old-knight-02.webp', 'assets/portraits/old-knight-03.webp', 'assets/portraits/old-knight-04.webp', 'assets/portraits/old-knight-05.webp', 'assets/portraits/old-knight-06.webp', 'assets/portraits/old-knight-07.webp'],
  'alchemist-boy.glb': ['assets/portraits/alchemist-boy-01.webp', 'assets/portraits/alchemist-boy-02.webp', 'assets/portraits/alchemist-boy-03.webp'],
  'ranger-archer.glb': ['assets/portraits/ranger-archer-01.webp', 'assets/portraits/ranger-archer-02.webp'],
  'dark-mercenary.glb': ['assets/portraits/dark-mercenary-01.webp', 'assets/portraits/dark-mercenary-02.webp', 'assets/portraits/dark-mercenary-03.webp'],
  'bell-priestess.glb': ['assets/portraits/bell-priestess-01.webp', 'assets/portraits/bell-priestess-02.webp', 'assets/portraits/bell-priestess-03.webp', 'assets/portraits/bell-priestess-04.webp'],
  'wolf-warrior.glb': ['assets/portraits/wolf-warrior-01.webp', 'assets/portraits/wolf-warrior-02.webp', 'assets/portraits/wolf-warrior-03.webp', 'assets/portraits/wolf-warrior-04.webp'],
  'monk-brawler.glb': ['assets/portraits/monk-brawler-01.webp', 'assets/portraits/monk-brawler-02.webp'],
  'dragoon-lancer.glb': ['assets/portraits/dragoon-lancer-01.webp', 'assets/portraits/dragoon-lancer-02.webp', 'assets/portraits/dragoon-lancer-03.webp', 'assets/portraits/dragoon-lancer-04.webp'],
  'clockwork-puppeteer.glb': ['assets/portraits/clockwork-puppeteer-01.webp', 'assets/portraits/clockwork-puppeteer-02.webp', 'assets/portraits/clockwork-puppeteer-03.webp'],
};
for (const [id, fighter] of Object.entries(FIGHTERS)) {
  if (!fighter?.model) continue;
  const modelName = fighter.model.substring(fighter.model.lastIndexOf('/') + 1);
  const variants = NEW_MODEL_PORTRAITS[modelName];
  if (!variants?.length) continue; // Special characters keep their own art.
  if (fighter.face && !fighter.originalSelectFace) fighter.originalSelectFace = fighter.face;
  const generated = /^([gm])(\d+)$/.exec(id);
  const sequence = generated
    ? Math.floor(Number(generated[2]) / 13) + (generated[1] === 'm' ? 2 : 1)
    : 0;
  fighter.face = variants[sequence % variants.length];
  fighter.faceHue = 0;
}

// Valgard's new illustration replaces the previous generic ice crest.
if (FIGHTERS.valgard) FIGHTERS.valgard.face = 'assets/portraits/valgard-mecha.webp?v=20261108-operator-models';

const bound = (x, lo, hi) => Math.max(lo, Math.min(hi, Number(x) || 0));
// Centralized damage budget. Standard / elite / bosses / chief characters
// retain unique attributes but are prevented from extreme outliers.
for (const [key, f] of Object.entries(FIGHTERS)) {
  if (!f?.skills?.length || !f.light) continue;
  const chief = f.special === 'chief' || f.special === 'operator';
  const elite = key === 'seraphel' || key === 'uninomiya';
  const boss = !!f.enemy;
  const group = chief ? 'chief' : elite ? 'elite' : boss ? 'enemy' : 'normal';
  f.balanceClass = group;
  const limits = chief
    ? { hp: [1300, 3900], speed: [4.5, 8.4], light: [24, 75], power: [0.8, 2.25], armor: [0.5, 1.25], skill: 178, ultimate: 228, final: 560, radius: 9.8, flux: 2.25 }
    : elite
      ? { hp: [1050, 2400], speed: [5.2, 7.9], light: [28, 60], power: [0.9, 1.5], armor: [0.7, 1.15], skill: 144, ultimate: 194, final: 400, radius: 8.6, flux: 1.55 }
      : boss
        ? { hp: [680, 1740], speed: [4.7, 7.5], light: [26, 62], power: [0.8, 1.35], armor: [0.74, 1.2], skill: 132, ultimate: 180, final: 360, radius: 8, flux: 1.42 }
        : { hp: [730, 1450], speed: [4.9, 7.35], light: [25, 55], power: [0.8, 1.22], armor: [0.78, 1.18], skill: 117, ultimate: 158, final: 290, radius: 7, flux: 1.4 };
  f.hp = Math.round(bound(f.hp, ...limits.hp));
  f.speed = +bound(f.speed, ...limits.speed).toFixed(2);
  f.power = +bound(f.power == null ? 1 : f.power, ...limits.power).toFixed(3);
  f.armor = +bound(f.armor == null ? 1 : f.armor, ...limits.armor).toFixed(3);
  f.fluxMul = +bound(f.fluxMul == null ? 1 : f.fluxMul, 0.75, limits.flux).toFixed(2);
  f.overGain = +bound(f.overGain ?? 1, 0.7, chief ? 2.6 : elite ? 1.7 : 1.45).toFixed(2);
  const shots = Math.max(1, f.light.shots || 1);
  f.light.dmg = Math.round(bound(f.light.dmg, limits.light[0] / Math.sqrt(shots), Math.min(limits.light[1], limits.light[1] * 2 / Math.sqrt(shots))));
  const tune = (skill, ultimate = false) => {
    if (!skill) return;
    const count = Math.max(1, Number(skill.count) || 1);
    const multi = (skill.kind === 'rain' || skill.kind === 'projectile') && count > 1;
    const maxDmg = (ultimate ? limits.ultimate : limits.skill) / (multi ? (1 + Math.max(0, count - 2) * 0.085) : 1);
    if (Number.isFinite(+skill.dmg)) skill.dmg = Math.round(bound(skill.dmg, 16, maxDmg));
    if (Number.isFinite(+skill.finalDmg)) skill.finalDmg = Math.round(bound(skill.finalDmg, 24, limits.final));
    if (Number.isFinite(+skill.radius)) skill.radius = +bound(skill.radius, 0.3, limits.radius).toFixed(2);
    if (Number.isFinite(+skill.finalRadius)) skill.finalRadius = +bound(skill.finalRadius, 1, limits.radius + 1.8).toFixed(2);
    if (Number.isFinite(+skill.heal)) skill.heal = Math.round(bound(skill.heal, 20, f.hp * (chief ? 0.34 : 0.28)));
  };
  f.skills.forEach(x => tune(x, false));
  tune(f.over, true);
}

// Measured in battle seconds: small spells are quick, complex spells and
// special/secret arts require longer chanting. Used by every fighter/CPU.
export function spellCastTime(spec, slot = 's') {
  if (!spec) return 0.5;
  const cost = bound(spec.cost || 18, 0, 40);
  const power = Math.max(0, +spec.dmg || 0, (+spec.finalDmg || 0) * 0.62, (+spec.heal || 0) * 0.42);
  const count = bound(spec.count || 1, 1, 30);
  const kindBonus = spec.kind === 'judgment' ? 0.38
    : spec.kind === 'rain' || spec.kind === 'implode' ? 0.19
      : spec.kind === 'shockwave' ? 0.09 : 0;
  const computed = 0.2 + cost * 0.012 + power * 0.0022 + (count - 1) * 0.012 + kindBonus;
  const base = Number.isFinite(+spec.castTime) && +spec.castTime > 0 ? +spec.castTime : computed;
  if (slot === 'hi') return +bound(Math.max(2.55, base + 1.1), 2.55, 3.6).toFixed(1);
  if (slot === 'over') return +bound(Math.max(1.65, base + 0.85), 1.65, 2.8).toFixed(1);
  if (slot?.startsWith('f')) return +bound(base + 0.23, 0.5, 2.2).toFixed(1);
  return +bound(base, 0.35, 1.85).toFixed(1);
}


// Individually mastered select cards. Each card uses artwork drawn for the
// same original GLB archetype, but has unique framing, name, element emblems.
// The actual 3D models and the original 44 drawings are never modified.
for (const [key, fighter] of Object.entries(FIGHTERS)) {
  const modelName = fighter.model?.split('/').pop();
  if (!NEW_MODEL_PORTRAITS[modelName]?.length) continue;
  fighter.originalSelectFace ||= fighter.face;
  fighter.face = `assets/portraits/unique/${key}.webp`;
  fighter.faceHue = 0;
}

// Operator-accessible special fighters now share access labels; Valgard remains chief-only.
for (const key of ['chief', 'sovereign', 'sovereign2', 'bloodfiend']) {
  const d = FIGHTERS[key];
  if (d?.title) d.title = d.title.replace('（運営長', '（運営・運営長');
}

// GAIZORG-ADVENTURE-INSTALLED-v20261108b
// 運営長だけが使用できる大型・炎属性キャラクター。通常戦闘と探索に共通。
// このキーはオンライン対戦・協力でも既存の役職検証の対象にする。
FIGHTERS.gaizorg = {
  name:'ガイゾルグ',title:'熔殻の超甲獣（運営長専用）',
  model:'assets/models/gaizorg-boss.glb',face:'assets/portraits/gaizorg.webp',
  color:0xff7434,tint:null,height:4.25,hp:6000,speed:4.85,overGain:1.30,
  locked:true,special:'chief',power:1.25,armor:.86,
  light:{dmg:230,range:3.8,color:0xffb052},
  skills:[
    {name:'獄炎の息吹《ヴォルカニック・ブレス》',kind:'projectile',visual:'fire',
     elem:0,color:0xff792b,damageType:'fire',cost:24,castTime:.65,count:6,spreadAng:.075,chain:.075,dmg:105,speed:22,radius:1.25,vivid:true},
    {name:'剛爪破砕《タイタン・クロウ》',kind:'dash',elem:0,color:0xffaa58,
     cost:21,speed:13,dur:.42,dmg:450,stun:.85,kb:12,vivid:true},
    {name:'灼星火球《マグマ・スフィア》',kind:'projectile',visual:'orb',elem:0,
     color:0xff7629,cost:26,castTime:.78,count:3,spreadAng:.13,chain:.10,dmg:250,speed:24,radius:1.3,vivid:true},
    {name:'太古炎天術《紅星終焉》',kind:'judgment',visual:'meteor',finalVisual:'pillar',elem:0,
     color:0xff6222,cost:46,castTime:2.65,count:12,spread:4.6,radius:2.3,
     dmg:230,delay:.52,interval:.10,finalDmg:1000,finalRadius:8.5,vivid:true},
    {name:'熔命の再生',kind:'heal',elem:0,color:0xffd287,cost:32,heal:950,radius:5.2,vivid:true}
  ],
  over:{name:'終極火界《地心ノヴァ》',kind:'judgment',visual:'meteor',
    finalVisual:'nova',elem:0,color:0xffb03f,cost:0,castTime:2.95,count:15,
    spread:6,radius:2.9,dmg:260,delay:.55,interval:.08,finalDmg:1500,finalRadius:10.0,vivid:true}
};


// RF_VALDARION_CHIEF_20261108: Genuine model path; source GLB is not modified.
FIGHTERS.valdarion = {
  name: '虚無機神ヴァルダリオン', title: '無の尊座・至高位機神（運営長専用）',
  model: 'assets/models/valdarion.glb', face: 'assets/portraits/valdarion.webp',
  attribute: '無', nullElement: true,
  color: 0xc6b5ff, tint: null, height: 3.95, hp: 7800, speed: 5.7,
  overGain: 1.48, locked: true, special: 'chief', power: 1.4, armor: .72,
  light: {dmg: 230, range: 3.4, color: 0xe6d5ff},
  guardArt: {name: '絶対護装《無傷の煌鎧》', duration: 30, damageMultiplier: .5,
    staggerImmune: true, knockbackImmune: true, continueAttacking: true, cooldown: 75},
  skills: [
    {name:'虚無光砲《アビス・ゼロ》', kind:'projectile', visual:'orb', count:5, spreadAng:.10, chain:.06,
      dmg:180, speed:30, radius:1.15, cost:27, castTime:.8, elem:6, nullElement:true, color:0xc5a7ff, vivid:true},
    {name:'零界断刀《ゼロ・エクスカリオン》',kind:'dash',dmg:520,speed:25,dur:.42,
      cost:25,castTime:.68,elem:6,nullElement:true,color:0xf8efff,vivid:true},
    {name:'無限裂界《ノヴァ・ファンネル》',kind:'rain',visual:'crystal',count:15,spread:5.0,
      radius:1.75,dmg:160,delay:.35,interval:.065,cost:32,elem:6,nullElement:true,color:0xbb98ff,vivid:true},
    {name:'現実歪曲《リアリティ・リライト》',kind:'judgment',visual:'nova',finalVisual:'pillar',
      count:13,spread:6,radius:2.3,dmg:230,delay:.5,interval:.065,finalDmg:870,finalRadius:8.8,
      cost:42,castTime:2,elem:6,nullElement:true,color:0xf5e2ff,vivid:true},
    {name:'虚空再編《無の復元》',kind:'heal',heal:1100,radius:5.7,cost:30,
      elem:6,nullElement:true,color:0xc4eaff,vivid:true}
  ],
  hi: {name:'超越禁呪《原初の空白》',kind:'judgment',visual:'pillar',finalVisual:'nova',
    count:17,spread:6.5,radius:2.5,dmg:250,delay:.55,interval:.05,finalDmg:1300,finalRadius:10,
    castTime:3.15,elem:6,nullElement:true,color:0xebddff,vivid:true},
  over: {name:'無限終焉《エターナル・ヌル》',kind:'judgment',visual:'nova',finalVisual:'pillar',
    count:20,spread:7,radius:2.7,dmg:280,delay:.55,interval:.055,finalDmg:1700,finalRadius:11,
    castTime:2.65,elem:6,nullElement:true,color:0xf5e4ff,vivid:true}
};

