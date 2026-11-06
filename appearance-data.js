// 外見の設計値。描画ライブラリ・DOMに依存しないのでサーバーからも読み込める。
// 同じ素体を使っていた二人目以降だけに、体形・髪・頭飾り・衣装・得物を割り当てる。
const PALETTES = [
  [0x6c2935, 0xc19b53, 0x2c1924, 0xead6b5],
  [0x273b64, 0xb7c9d4, 0x182235, 0xd4b489],
  [0x436253, 0xc5a868, 0x273628, 0xe8d6b0],
  [0x5a3a6b, 0xc4adb9, 0x211a34, 0xe4bdae],
  [0x9a5837, 0xe2be78, 0x3c2924, 0xb8c5d1],
  [0x65758b, 0xd2cbbb, 0x293341, 0xf3e5c6],
  [0x81734c, 0xc5b592, 0x333624, 0xbfd4cb],
  [0x476d7b, 0xbed8d3, 0x22313d, 0xdec6ab],
  [0x5e4240, 0xbb8d67, 0x271d24, 0xddd7c5],
  [0x4d436c, 0xbcad73, 0x211d38, 0xccc4df],
  [0xa17e42, 0xe4cf92, 0x483727, 0xbfd1d1],
  [0x5a6a3d, 0xc8b983, 0x282f26, 0xdfc3ac],
  [0x855769, 0xd4bac7, 0x372733, 0xf0d9bd],
  [0x346465, 0xbbc9ae, 0x233b3a, 0xe0c5a0],
  [0x53515a, 0xc8b786, 0x27232c, 0xc6d5df]
];
const HEAD_NAMES = ['羽飾り兜', '枝角冠', '高僧帽', '獣耳フード', '広つば帽', '双結い髪', '双角兜', '三日月冠', '波紋の冠', '長い結い髪', '鉄面', '翼飾り冠', '尖りフード', '巻き布と面布', '長い横髪', '光輪冠', '工房の眼鏡', '鱗の冠', '王冠と編み髪'];
const COAT_NAMES = ['重ね胸甲', '二重法衣', '片肩の外套', '毛皮の肩掛け', '札甲', '長裾の上衣', '骨の胸甲', '結び布', '翼襟の礼装', '薬瓶の革鎧', '大肩甲', '菱紋の胴衣'];
function hash(s) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
const fraction = (seed, offset) => ((seed >>> offset) & 255) / 255;

/** Gives duplicate-derived fighters their own stable, geometry-changing identity. */
export function assignUniqueAppearances(fighters) {
  const firstByModel = new Map();
  const counts = new Map();
  const originals = [];
  const changed = [];
  for (const [id, fighter] of Object.entries(fighters)) {
    const model = fighter.model;
    if (!firstByModel.has(model)) {
      firstByModel.set(model, { id, family: firstByModel.size });
      originals.push(id);
      continue;
    }
    const source = firstByModel.get(model);
    const ordinal = counts.get(model) || 0;
    counts.set(model, ordinal + 1);
    const seed = hash(`riftfall-appearance-v1:${id}`);
    const palette = PALETTES[(ordinal * 7 + source.family * 3) % PALETTES.length];
    const head = (ordinal + source.family * 3) % HEAD_NAMES.length;
    const coat = (ordinal * 7 + source.family * 5) % COAT_NAMES.length;
    fighter.appearance = {
      version: 1, id, source: source.id, family: source.family, ordinal, seed,
      head, coat, back: (ordinal * 5 + source.family * 2) % 9,
      weapon: (source.family * 2 + ordinal) % 10,
      crest: 3 + ((ordinal + source.family) % 5),
      trim: (ordinal * 3 + source.family) % 6,
      colors: palette.slice(),
      // Head / shoulder / waist changes alter real vertices, not merely material hue.
      shape: [
        +(0.88 + fraction(seed, 0) * 0.26).toFixed(4),
        +(0.91 + fraction(seed, 8) * 0.22).toFixed(4),
        +(0.86 + fraction(seed, 16) * 0.31).toFixed(4),
        +(0.88 + fraction(seed, 24) * 0.28).toFixed(4),
        +(0.92 + (ordinal % 7) * 0.025).toFixed(4)
      ],
      label: `${HEAD_NAMES[head]}・${COAT_NAMES[coat]}`,
      modelIdentity: `generated:${id}:v1`
    };
    fighter.face = `assets/portraits/${id}.webp?v=20261106-illustrated1`;
    delete fighter.faceHue;
    changed.push(id);
  }
  return Object.freeze({ originals: Object.freeze(originals), changed: Object.freeze(changed) });
}
