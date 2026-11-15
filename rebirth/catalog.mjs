import { FIGHTERS } from '../data.js';

// This catalogue is deliberately separate from online entitlements. Shop,
// operator and hidden fighters remain behind their existing classic access rules.
export const PLAYABLE_IDS = Object.freeze([
  'rowen', 'minase', 'garou', 'tsubaki', 'harlan', 'pip', 'velka',
  'osric', 'noa', 'kurouga', 'rinfa', 'igna', 'petra', 'uninomiya'
]);

const ELEMENTS = {
  rowen: '炎', minase: '氷', garou: '地', tsubaki: '影', harlan: '鋼',
  pip: '錬金', velka: '風', osric: '闇', noa: '光', kurouga: '月',
  rinfa: '炎', igna: '竜', petra: '機巧', uninomiya: '雷', seraphel: '光'
};
const ROLES = {
  rowen: '剣士', minase: '魔導士', garou: '重戦士', tsubaki: '忍',
  harlan: '守護騎士', pip: '錬金術師', velka: '弓手', osric: '魔剣士',
  noa: '治癒師', kurouga: '獣戦士', rinfa: '武闘家', igna: '槍騎士',
  petra: '人形師', uninomiya: '公達', seraphel: '裁定者'
};
const clone = (value) => JSON.parse(JSON.stringify(value));

function normalize(id) {
  const source = FIGHTERS[id];
  if (!source) throw new Error(`Unknown fighter: ${id}`);
  return {
    id, key: id, name: source.name, title: source.title, model: source.model,
    face: source.face, color: source.color, element: ELEMENTS[id] || '無',
    role: ROLES[id] || '戦士',
    // The old UI doubled common actors globally. The new world's unit is 1 m.
    height: source.height > 2.5 ? source.height / 2 : source.height,
    hp: source.hp, speed: source.speed, overGain: source.overGain || 1,
    light: { name: '通常攻撃', ...clone(source.light) },
    skills: clone(source.skills || []), over: clone(source.over),
    hi: source.hi ? clone(source.hi) : null
  };
}

export const ROSTER = Object.freeze(PLAYABLE_IDS
  .filter(id => {
    const fighter = FIGHTERS[id];
    return fighter && !fighter.locked && !fighter.special && !fighter.shop && !fighter.hidden;
  })
  .map(id => Object.freeze(normalize(id))));

export const STAGES = Object.freeze([
  { id: 'moon', name: '双月の参道', subtitle: 'THE MOONLIT APPROACH', image: 'assets/rf5525/moonkeep-wide.webp', description: '二つの月に照らされる、朱の灯籠と古い石畳。すべての旅はここから始まる。' },
  { id: 'river', name: '翠流の街道', subtitle: 'THE EMERALD PASSAGE', image: 'assets/rf5523/river-path.webp', description: '清流の音に紛れて、失われた灯脈の鼓動が聞こえる。' },
  { id: 'keep', name: '常夜の天守', subtitle: 'THE ENDLESS KEEP', image: 'assets/rf562/japanese-palace.webp', description: '金屏風の奥に続く長い回廊。最上階を知る者は、まだいない。' },
  { id: 'frost', name: '蒼穹の霜庭', subtitle: 'THE FROZEN FIRMAMENT', image: 'assets/frost-aurora-sky.webp', description: '凍った庭を渡る月光が、沈黙した星見の塔へと導く。' }
]);

export const MODES = Object.freeze([
  { id: 'story', name: '双月の物語', kicker: 'STORY', description: '灯の消えた街道を辿る、全四章の物語。会話と戦いが、ひとつの結末へ繋がる。', image: 'assets/rf5525/moonkeep-wide.webp', tag: '全4章', stages: 4 },
  { id: 'adventure', name: '灯脈の旅路', kicker: 'ADVENTURE', description: '十の試練を越え、最奥に待つ裁定者へ。第五の試練の後は休息で体勢を整える。', image: 'assets/rf5523/river-path.webp', tag: '全10戦', stages: 10 },
  { id: 'endless', name: '無限天守', kicker: 'ENDLESS KEEP', description: '残された体力で、どこまで登れるか。階を重ねるほど手強くなる連戦に挑む。', image: 'assets/rf562/japanese-palace.webp', tag: '終わりなき挑戦' },
  { id: 'duel', name: '月下の手合わせ', kicker: 'FREE BATTLE', description: '戦士と舞台を選び、剣と術を磨く。CPUの強さは1〜100から自由に調整できる。', image: 'assets/rf5526/moon-arena.webp', tag: '自由対戦' }
]);

export const CLASSIC_FEATURES = Object.freeze([
  { name: '従来版：オンライン対戦・共闘', description: '従来版を開き、現在のアカウントと対戦サーバーを利用します。', href: './classic.html' },
  { name: '従来版：拠点・ショップ・運営', description: '従来版の所有キャラクター、灯晶、拠点データをそのまま利用します。新章の灯晶とは別に保存されます。', href: './classic.html' }
]);

export const CHAPTERS = Object.freeze([
  {
    id: 0, title: '第一章　消えた道標', stage: 'moon',
    before: [
      { who: '語り', text: '二つの月が重なる夜、山城へ続く道の灯が、ひとつずつ消えていった。' },
      { who: 'ロウエン', text: '月はいつもどおりだ。おかしいのは、この静けさの方だな。' },
      { who: 'ミナセ', text: '灯脈が途切れている。参道の向こうに、流れを塞ぐ影がいるわ。' }
    ],
    after: [
      { who: 'ミナセ', text: '戻った……小さいけれど、ちゃんと灯っている。' },
      { who: 'ロウエン', text: 'なら、次の灯まで歩こう。誰かが待っているかもしれない。' }
    ]
  },
  {
    id: 1, title: '第二章　川の記憶', stage: 'river',
    before: [
      { who: '語り', text: '参道の灯は清流のほとりへ続いていた。水面に映る月だけが、赤く揺れている。' },
      { who: 'ヴェルカ', text: 'この川は、城の地下から流れてくる。上流で何かが灯をせき止めているんだ。' },
      { who: 'ロウエン', text: '道を守る影を散らす。流れを取り戻せば、城への道も見える。' }
    ],
    after: [
      { who: 'ヴェルカ', text: '水の色が戻った。ほら、霧の向こう……あれが星見の塔。' },
      { who: 'ミナセ', text: '塔は凍っている。でも灯脈は、まだ生きているわ。' }
    ]
  },
  {
    id: 2, title: '第三章　霜に眠る願い', stage: 'frost',
    before: [
      { who: '語り', text: '塔の庭には、消えた灯を閉じ込めた氷の花が咲いていた。' },
      { who: 'ノア', text: '誰かが守ろうとしたんです。灯が失われないよう、時間ごと凍らせて。' },
      { who: 'ミナセ', text: '閉じ込めたままでは、道を照らせない。私たちの手で、春を連れ戻しましょう。' }
    ],
    after: [
      { who: 'ノア', text: '灯が城へ帰っていく……。あの人も、きっと気づいているはず。' },
      { who: 'ロウエン', text: '最後の扉だ。今度は剣だけじゃなく、言葉も届けよう。' }
    ]
  },
  {
    id: 3, title: '終章　明日を灯すもの', stage: 'keep',
    before: [
      { who: 'セラフェル', text: '灯を守れば、人は争う。灯を閉ざせば、人は迷う。私は、答えを見失った。' },
      { who: 'ロウエン', text: '俺たちも間違える。だから、消えた灯を一緒に灯し直すんだ。' },
      { who: 'セラフェル', text: 'では、その意志を示しなさい。双月の下で、最後の裁定を。' }
    ],
    after: [
      { who: 'セラフェル', text: '見届けました。答えは、ひとつの灯の中にあったのではないのですね。' },
      { who: 'ミナセ', text: 'ほら、街道が見える。私たちが歩いてきた道、全部。' },
      { who: '語り', text: '二つの月は、再び旅人の道を照らした。その先の物語は、あなたの歩みとともに続いてゆく。' }
    ]
  }
]);

const STAGE_SEQUENCE = ['moon', 'river', 'river', 'frost', 'keep', 'moon', 'river', 'frost', 'keep', 'keep'];
const ENEMY_KEYS = ['garou', 'tsubaki', 'osric', 'kurouga', 'igna', 'harlan', 'minase', 'rinfa'];

function enemy(id, ordinal, hpScale = 1, damageScale = 1, name) {
  const definition = normalize(id);
  definition.id = `${id}-foe-${ordinal}`;
  definition.key = id;
  definition.name = name || definition.name;
  definition.hp = Math.max(180, Math.round(definition.hp * hpScale));
  definition.light.dmg = Math.max(8, Math.round(definition.light.dmg * damageScale));
  for (const skill of [...definition.skills, definition.over, definition.hi].filter(Boolean)) {
    if (skill.dmg) skill.dmg = Math.round(skill.dmg * damageScale);
    if (skill.finalDmg) skill.finalDmg = Math.round(skill.finalDmg * damageScale);
    if (skill.heal) skill.heal = Math.round(skill.heal * hpScale);
  }
  return definition;
}

/** Zero-based encounter index, including endless floor = index + 1. */
export function getEncounter(mode = 'duel', index = 0, selectedId = 'rowen') {
  if (!MODES.some(item => item.id === mode)) throw new TypeError('Unknown game mode');
  const step = Math.max(0, Math.min(9999, Math.floor(Number(index) || 0)));
  if (mode === 'story') {
    const chapter = CHAPTERS[Math.min(step, 3)];
    const teams = [
      ['garou', 'tsubaki', 'velka'],
      ['tsubaki', 'velka', 'garou', 'osric'],
      ['minase', 'harlan', 'kurouga', 'minase', 'igna'],
      ['seraphel', 'harlan', 'osric']
    ];
    return {
      mode, index: chapter.id, title: chapter.title, stage: chapter.stage,
      enemies: teams[chapter.id].map((key, n) => enemy(key, n, key === 'seraphel' ? .65 : .27 + chapter.id * .035, .48 + chapter.id * .04)),
      restAfter: false, isFinal: chapter.id === 3, chapter
    };
  }
  if (mode === 'adventure') {
    const level = Math.min(step, 9);
    const final = level === 9;
    const count = final ? 3 : Math.min(6, 3 + Math.floor(level / 3));
    return {
      mode, index: level, title: final ? '第十の試練・終天の裁定者' : `第${level + 1}の試練`,
      stage: STAGE_SEQUENCE[level],
      enemies: Array.from({ length: count }, (_, n) => {
        const boss = final && n === 0;
        return enemy(boss ? 'seraphel' : ENEMY_KEYS[(level + n * 2) % ENEMY_KEYS.length], n, boss ? .75 : .26 + level * .02, .44 + level * .02);
      }),
      restAfter: level === 4, isFinal: final
    };
  }
  if (mode === 'endless') {
    const count = Math.min(10, 4 + Math.floor(step / 3));
    // Logarithmic scaling avoids overflowing numbers even after long runs.
    const growth = Math.log2(1 + step) * .16;
    return {
      mode, index: step, title: `無限天守・第${step + 1}階`, stage: 'keep',
      enemies: Array.from({ length: count }, (_, n) => enemy(ENEMY_KEYS[(step * 3 + n) % ENEMY_KEYS.length], n, .23 + growth, .4 + growth * .55)),
      restAfter: false, isFinal: false
    };
  }
  const pool = ROSTER.filter(fighter => fighter.id !== selectedId);
  const opponent = pool[step % pool.length] || ROSTER[0];
  return { mode, index: step, title: '月下の手合わせ', stage: STAGES[step % STAGES.length].id, enemies: [enemy(opponent.id, 0)], restAfter: false, isFinal: true };
}
