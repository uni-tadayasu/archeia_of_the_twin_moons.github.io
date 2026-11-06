// 戦闘ボイス：ブラウザの音声合成で、戦士ごとに声質と「性格」を変え、場面ごとの多彩な台詞で叫ぶ
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
let muted = false;
let vol = 0.9;
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => /^ja/i.test(v.lang));
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}
function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

// ---- 性格ごとの台詞（{n} は技名） ----
const T = {
  hero: {
    skill: ['はっ！{n}！', 'いくぞ！{n}！', 'そこだ、{n}！', '受けてみろ！{n}！', 'せいっ！{n}！', '負けるもんか！{n}！', 'これでどうだ！{n}！', '道を開けろ！{n}！'],
    over: ['みんなの想いを乗せて…{n}！', '全力でいく！{n}ーっ！', 'この一撃に、すべてを懸ける！{n}！', '届けぇっ！{n}！', '俺たちは負けない！{n}！'],
    hi: ['限界なんて超えてやる！秘奥義、{n}！', 'これが最後の切り札だ！{n}！', '光よ、集え！{n}！'],
    awaken: ['力が…溢れてくる！', 'まだだ…まだ終わらない！', 'ここからが本番だ！', '仲間のためなら、何度でも立ち上がる！'],
    summon: ['来い！{n}！', '力を貸してくれ、{n}！', '頼んだぞ、{n}！'],
    hurt: ['ぐっ…！', 'まだまだ！', 'くそっ…！', 'これくらい…！', 'うあっ！'],
    pinch: ['ここで倒れるわけには…！', 'まだ…やれる！', '諦めるもんか…！'],
    ko: ['すまない…みんな…', 'ここまで…か…', 'くっ…無念…'],
    kill: ['よし！', '次だ！', 'まだいけるぞ！']
  },
  cool: {
    skill: ['{n}。', '遅い。{n}！', '見切った。{n}！', '終わりだ。{n}。', '一瞬で決める。{n}！', '甘いな。{n}！', '隙だらけだ。{n}！'],
    over: ['静かに散れ…{n}。', '終わらせる。{n}！', 'これが俺の答えだ…{n}！', '刻め、その身に。{n}！'],
    hi: ['見せてやろう、真の極みを…秘奥義、{n}。', '貴様には過ぎた技だ…{n}！'],
    awaken: ['…面白い。本気で行く。', '眠っていた力が目を覚ます…', '少し、遊びが過ぎたようだな。'],
    summon: ['出ろ、{n}。', '{n}…蹴散らせ。'],
    hurt: ['ちっ…', 'やるな…', '…っ！', '浅い。'],
    pinch: ['…悪くない。だが、まだだ。', 'この程度で…'],
    ko: ['…見事だ。', '俺としたことが…'],
    kill: ['当然だ。', '次。', '脆いな。']
  },
  fierce: {
    skill: ['オラァッ！{n}！', '吹っ飛べぇ！{n}！', 'ぶっ潰す！{n}！', 'どりゃあっ！{n}！', '砕けろ！{n}！', 'ぬぅん！{n}！', '喰らいやがれ！{n}！'],
    over: ['うおおおおっ！{n}ーーっ！', '全部まとめてぶっ飛ばす！{n}！', '大地ごと砕けろぉ！{n}！', '俺の拳を受けてみろぉ！{n}！'],
    hi: ['燃え尽きるまで暴れてやる！秘奥義、{n}！', 'これが魂の一撃だぁ！{n}！'],
    awaken: ['うおおおおっ！血が滾るぜぇ！', 'もっとだ…もっと寄越せぇ！', 'ここからが祭りだぁ！'],
    summon: ['出てこい、{n}！暴れろぉ！', '行けぇ、{n}！'],
    hurt: ['ぐおっ！', '効かねぇなぁ！', 'いってぇな！', 'ぬぐっ！'],
    pinch: ['へっ…面白くなってきたじゃねぇか！', 'まだ倒れねぇぞ！'],
    ko: ['ぐはっ…やるじゃ…ねぇか…', 'ちくしょう…'],
    kill: ['ハッハァ！', '次はどいつだぁ！', '弱ぇ弱ぇ！']
  },
  noble: {
    skill: ['参ります。{n}！', '光よ、{n}！', '舞いなさい、{n}！', 'お覚悟を。{n}！', '祈りを力に…{n}！', 'えいっ！{n}！'],
    over: ['天よ、我が願いに応えて…{n}！', 'すべてを清めます…{n}！', '双つの月の名のもとに…{n}！', '咲き誇れ…{n}！'],
    hi: ['この命の輝き、すべて捧げます…秘奥義、{n}！', '月光よ、奇跡を…{n}！'],
    awaken: ['この身に宿る光…今こそ！', '負けられません…皆のためにも！', '目覚めなさい、私の力！'],
    summon: ['おいでなさい、{n}！', '{n}、力を貸して！'],
    hurt: ['きゃっ…！', 'うっ…！', 'まだ…平気です！', 'くっ…！'],
    pinch: ['ここで…倒れるわけには…', '皆さん…もう少しだけ…！'],
    ko: ['ごめんなさい…', 'あと…少し…だったのに…'],
    kill: ['安らかに。', 'お見事でしょう？', '次へ参ります！']
  },
  villain: {
    skill: ['フハハ！{n}！', '跪け。{n}！', '愚か者め…{n}！', '絶望を味わえ！{n}！', '消えろ。{n}！', '虫けらが…{n}！', '我が力を思い知れ！{n}！'],
    over: ['闇に呑まれろ…{n}！', 'この世のすべてを紅に染めてやろう…{n}！', '恐怖こそ我が糧…{n}！', '滅びの宴を始めよう…{n}！'],
    hi: ['禁忌の力、その目に焼き付けよ！秘奥義、{n}！', '神すら屠る我が真髄…{n}！'],
    awaken: ['クク…ようやく楽しくなってきたぞ。', 'この力…抑えきれん！', '貴様らに真の恐怖を教えてやろう。'],
    summon: ['目覚めよ、{n}！喰らい尽くせ！', '来たれ、{n}！我が敵を屠れ！', '血の契約に従え…{n}！'],
    hurt: ['小賢しい！', 'ぐっ…貴様ァ！', '…痒いな。', 'その程度か！'],
    pinch: ['この我が…押されているだと…？', 'おのれ…許さんぞ！'],
    ko: ['馬鹿な…この我が…', 'これで…終わりと…思うな…'],
    kill: ['フハハハハ！', '脆い、脆すぎる！', '次の贄は誰だ？']
  }
};
// ---- 声の性格と声質（戦士ごとに決定的） ----
const PROFILE = new Map();
function profile(key, def) {
  if (PROFILE.has(key)) return PROFILE.get(key);
  const h = hash(key);
  const t = `${def?.title || ''}${def?.name || ''}`;
  const big = (def?.height || 1.8) > 2 || /斧|鬼|竜|巨|獣|豪/.test(t);
  let kind;
  if (def?.special === 'chief' || /魔|王|后|深淵|血|冥|邪|闇/.test(t)) kind = 'villain';
  else if (big || /拳|斧|戦鬼|豪/.test(t)) kind = 'fierce';
  else if (/姫|聖|巫|歌|舞|祈|癒|女|鈴|扇|天使|熾/.test(t)) kind = 'noble';
  else kind = ['hero', 'cool', 'hero', 'cool', 'noble', 'fierce'][h % 6];
  const base = kind === 'villain' ? 0.45 : kind === 'fierce' ? 0.4 : kind === 'noble' ? 1.35 : kind === 'cool' ? 0.8 : 1.0;
  const p = {
    kind,
    pitch: Math.max(0.1, Math.min(2, base + ((h % 30) - 15) / 100 - (big ? 0.15 : 0))),
    rate: (kind === 'cool' || kind === 'villain' ? 0.95 : 1.08) + ((h >>> 8) % 25) / 100,
    vi: h >>> 16
  };
  PROFILE.set(key, p);
  return p;
}
// 直前と同じ台詞を避けて選ぶ
const LAST = new Map();
function pick(key, kind, pool) {
  const lk = key + kind;
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && LAST.get(lk) === i) i = (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  LAST.set(lk, i);
  return pool[i];
}
// 《…》の読みがあればそちらを、無ければ技名を読む
function spokenName(name) {
  const m = /《(.+?)》/.exec(name || '');
  return (m ? m[1] : name || '').replace(/[・･]/g, ' ');
}
// 場面ごとの優先度と最小間隔
const PRIO = { hi: 5, over: 4, awaken: 4, summon: 3, ko: 3, pinch: 2, skill: 1, kill: 1, hurt: 0 };
let lastAt = 0, curPrio = -1, generation = 0;

/**
 * kind: 'skill' | 'over' | 'hi' | 'awaken' | 'summon' | 'hurt' | 'pinch' | 'ko' | 'kill'
 * important=true の時は再生中の声を止めて割り込む
 */
export function sayBattle(f, kind, specName, important = false) {
  if (!synth || muted || !f) return;
  const now = performance.now();
  const pr = PRIO[kind] ?? 1;
  const busy = synth.speaking && now - lastAt < 4000;
  if (!important && busy && pr <= curPrio) return;
  if (!important && now - lastAt < (pr === 0 ? 1400 : 600)) return;
  // 被弾の声は控えめな確率で
  if (kind === 'hurt' && Math.random() > 0.45) return;
  const key = f.key || f.def?.name || f.name;
  const p = profile(key, f.def);
  const pool = T[p.kind][kind] || T[p.kind].skill;
  const text = pick(key, kind, pool).replace('{n}', spokenName(specName));
  const id = ++generation;
  if (important || (busy && pr > curPrio)) synth.cancel();
  lastAt = now;
  curPrio = pr;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (voices.length) u.voice = voices[p.vi % voices.length];
  // 場面で抑揚を変える（奥義は高く力強く、瀕死は低く遅く）
  const dp = { hi: 0.18, over: 0.12, awaken: 0.08, summon: 0.1, hurt: 0.15, pinch: -0.1, ko: -0.2 }[kind] || 0;
  const dr = { skill: 0.12, hurt: 0.2, kill: 0.1, pinch: -0.12, ko: -0.25, over: -0.04, hi: -0.08 }[kind] || 0;
  u.pitch = Math.max(0, Math.min(2, p.pitch + dp + (Math.random() - 0.5) * 0.08));
  u.rate = Math.max(0.5, Math.min(2, p.rate + dr + (Math.random() - 0.5) * 0.06));
  u.volume = Math.max(0, Math.min(1, vol * (f.team === 0 ? 1 : 0.8) * (kind === 'hurt' ? 0.8 : 1)));
  // キャンセルされた古い声の完了通知で、新しい声の優先度を消さない。
  u.onend = u.onerror = () => { if (id === generation) curPrio = -1; };
  synth.speak(u);
}
export function setVoiceMuted(m) {
  muted = !!m;
  if (muted) stopVoices();
}
export function stopVoices() {
  generation++;
  synth?.cancel();
  curPrio = -1;
}
