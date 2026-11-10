// RF_FUJIWARA_BGM_PRIORITY_V37 — existing game ZIP + user-provided MP3 -> changed files only.
'use strict';
const VERSION='rf-fujiwara-bgm-priority-v37-20261110';
const TARGET='fujiwara_nobuyori';
const MUSIC_PATH='assets/audio/fujiwara-nobuyori-theme.mp3';
const $=id=>document.getElementById(id);
const log=(msg)=>{const e=$('log');e.textContent+=String(msg)+'\n';e.scrollTop=e.scrollHeight;};
const requirePart=(s,q,label)=>{if(!s.includes(q))throw Error(label+'が見つかりません。現在のゲームZIPを選択してください。');};
function replaceOne(s,old,replacement,label){
  let count=0,where=-1,searchAt=0;
  while((where=s.indexOf(old,searchAt))>=0){count++;searchAt=where+old.length;}
  if(count!==1)throw Error(label+'の書式が変わっています（検出数 '+count+'）。対応する最新ZIPをご利用ください。');
  return s.replace(old,replacement);
}
function patchMain(source){
  let s=source.replace(/^\uFEFF/,'');
  if(s.includes('// RF_FUJIWARA_BGM_PRIORITY_V37')){
    log('優先BGM処理は既にV37適用済みです。音源ファイルのみ更新します。');
    return s;
  }
  for(const [pat,label] of [
    ['const MUSIC_FILES = {','MUSIC_FILES'],['function shouldForceValgard() {','ヴァルガルド優先関数'],
    ['function syncMusicTrack() {','BGM排他再生'],['function beginBattle(boss) {','戦闘BGM'],
    ["if (state.mode === 'adventure') {\n    playTrack('adventure');",'アドベンチャーBGM'],
    ["const fighters = state.battle?.fighters;",'定期BGM再判定']
  ])requirePart(s,pat,label);
  s=replaceOne(s,'const MUSIC_FILES = {',
    "// RF_FUJIWARA_BGM_PRIORITY_V37 — Highest BGM priority (chief-only character)\nconst MUSIC_FILES = {\n  fujiwara: 'fujiwara-nobuyori-theme.mp3',",
    'MUSIC_FILES');
  // Highest priority is chosen at playback, regardless of which game mode calls playTrack().
  const fn=`function shouldForceFujiwara() {
  // Do not keep stale fighters from a previous session playing over the title UI.
  const titleOpen = isScreen('scr-press') || isScreen('scr-title');
  const b = state?.battle;
  const inBattle = !titleOpen && b && !b.ended && b.fighters?.some(f => !f.dead && f.key === 'fujiwara_nobuyori');
  const field = state?.field;
  const fieldPresent = !titleOpen && !!field && [state.myKey, field.o?.mainKey, ...(field.o?.partyKeys || [])].includes('fujiwara_nobuyori');
  const restPresent = !titleOpen && state?.mode === 'adventure' && !!state?.adventureRest && state.myKey === 'fujiwara_nobuyori';
  // The online/world room receives signed per-player profile proofs from the Worker.
  // Only a verified Fujiwara fighter can force the world-wide highest-priority BGM.
  const worldPresent = !titleOpen && apiEnabled() && Object.values(state?.worldPeers || {}).some(p =>
    p?.fk === 'fujiwara_nobuyori' && ['field','story','op'].includes(p.role) &&
    typeof p.id === 'string' && peerVerified(p.id,'fujiwara_nobuyori'));
  return !!(inBattle || fieldPresent || restPresent || worldPresent);
}
`;
  s=replaceOne(s,'function shouldForceValgard() {',fn+'function shouldForceValgard() {','優先BGM判定');
  const oldKey="const key = state.mode === 'adventure' ? 'adventure' : shouldForceValgard() ? 'valgard' : musicKey(audio.wanted);";
  const newKey="const key = shouldForceFujiwara() ? 'fujiwara' : state.mode === 'adventure' ? 'adventure' : shouldForceValgard() ? 'valgard' : musicKey(audio.wanted);";
  s=replaceOne(s,oldKey,newKey,'BGM優先順位');
  s=replaceOne(s,"audio.current = key === 'valgard' ? 'valgard' : audio.wanted;",
    "audio.current = (key === 'fujiwara' || key === 'valgard') ? key : audio.wanted;",'BGM状態');
  // Do not let Zarugureibu's 650ms watcher overwrite the scene's intended music while Fujiwara is present.
  s=replaceOne(s,"!fighters.some((f) => f.key === 'valgard') &&",
    "!fighters.some((f) => f.key === 'valgard' || f.key === 'fujiwara_nobuyori') &&",'既存専用BGMの監視');
  const oldBegin="if (state.mode === 'adventure') {\n    playTrack('adventure');";
  const newBegin=`if (participants.includes('fujiwara_nobuyori')) {
    // Keep the original scene music as the fallback. Fujiwara takes priority inside syncMusicTrack().
    const fallback = state.mode === 'adventure' ? 'adventure'
      : participants.includes('valgard') ? 'valgard'
      : participants.includes('bloodfiend') ? 'zarugureibu'
      : apex ? 'apex:' + apex
      : state.mode === 'event' ? 'event' : boss ? 'boss' : 'battle';
    playTrack(fallback);
    ui.banner({ name: '— ♪ 藤原信頼 専用BGM —' }, '他の全BGMより最優先');
  } else if (state.mode === 'adventure') {
    playTrack('adventure');`;
  s=replaceOne(s,oldBegin,newBegin,'戦闘開始の専用BGM');
  // Force a cache miss for already-open clients that had loaded old JS module URLs.
  if(!s.includes('fujiwara-nobuyori-theme.mp3'))throw Error('BGM定義の更新に失敗しました');
  return s;
}
function patchIndex(s){
  const rx=/(main\.js\?v=)[^'"<>\s]+/g;
  const matches=[...s.matchAll(rx)];
  if(matches.length!==1)throw Error('index.html の main.js読み込みが見つからないか複数あります');
  return s.replace(rx,(_,prefix)=>prefix+VERSION);
}
function fileRoot(files){
  const candidates=Object.keys(files).filter(n=>n==='index.html'||n.endsWith('/index.html'));
  if(!candidates.length)throw Error('ゲームZIP内にindex.htmlがありません');
  const entry=candidates.sort((a,b)=>a.length-b.length)[0];
  return entry.slice(0,-'index.html'.length);
}
let lastURL=null;
async function build(){
  const gameFile=$('game').files[0],musicFile=$('music').files[0];
  if(!gameFile || !musicFile){$('log').textContent='現在のゲーム全データZIPと wafuu (1).mp3 を選択してください。';return;}
  const btn=$('build'),download=$('download'),bar=$('progress');
  btn.disabled=true;download.hidden=true;bar.value=1;$('log').textContent='';
  try {
    if(!/\.mp3$/i.test(musicFile.name))throw Error('MP3形式を選んでください');
    const hdr=new Uint8Array(await musicFile.slice(0,8).arrayBuffer());
    if(hdr.byteLength<4 || !((hdr[0]===73&&hdr[1]===68&&hdr[2]===51) || (hdr[0]===255 && (hdr[1]&224)===224)))throw Error('MP3のヘッダーが不正です。元のwafuu (1).mp3を指定してください。');
    log('BGM: '+musicFile.name+' / '+(musicFile.size/1024/1024).toFixed(2)+'MiB / MP3を無加工で収録');
    bar.value=12;
    const source=await JSZip.loadAsync(gameFile);
    const root=fileRoot(source.files);log('ゲームZIPルート: '+(root||'ルート直下'));
    const jsFile=source.file(root+'main.js');const htmlFile=source.file(root+'index.html');
    if(!jsFile || !htmlFile)throw Error('ZIP内にmain.jsまたはindex.htmlがありません');
    const [main,index]=await Promise.all([jsFile.async('string'),htmlFile.async('string')]);
    const patchedMain=patchMain(main);const patchedIndex=patchIndex(index);
    if(!main.includes('fujiwara_nobuyori'))log('注意: ゲームZIPに藤原信頼の登録が見つかりません。V36導入後のZIPで生成することを推奨します。');
    bar.value=56;
    const zip=new JSZip();
    zip.file('main.js',patchedMain);
    zip.file('index.html',patchedIndex);
    // preserve the original MP3 binary exactly (no re-encoding or normalization).
    zip.file(MUSIC_PATH,new Uint8Array(await musicFile.arrayBuffer()),{binary:true,compression:'STORE'});
    const readme=`Riftfall Arena V37 藤原信頼 最上位専用BGM

更新ファイル:
・main.js
・index.html
・assets/audio/fujiwara-nobuyori-theme.mp3 (添付 wafuu (1).mp3 の元データそのまま)

【適用】
1. 藤原信頼キャラ・全モード対応V36を先に導入してください（既に導入済みなら不要）。
2. この差分ZIPの中身だけGitHubリポジトリのルートにアップロードして上書きしてください。
3. GitHub Pagesデプロイ後、Ctrl + Shift + Rでゲームを再読込してください。
4. 音量/ミュートは通常のBGM設定を使用します。

【優先順位】
藤原信頼 > アドベンチャー > ヴァルガルド > ザルグレイヴ/ボス/イベント/通常戦闘/フィールド
※藤原信頼が戦闘の敵味方・オンライン参加者・物語フィールド・アドベンチャー休憩所にいると優先。
※世界ルーム内の他プレイヤーはサーバー署名付きプロフィールで本人の使用権が確認できた場合のみ対象。
※タイトル画面で藤原信頼が使用中ではない場合、通常のメニューBGMに戻ります。
※同時にBGMが2曲以上流れないよう既存の排他制御を維持。

新規Workerは不要。モデル/画像/戦闘性能/保存データは変更しません。
このツールはMP3の元データをブラウザ上でZIPにコピーします。外部に送信しません。
`;
    zip.file('README_V37.txt',readme);
    bar.value=72;
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},p=>{bar.value=72+p.percent*0.28});
    if(lastURL)URL.revokeObjectURL(lastURL);
    lastURL=URL.createObjectURL(blob);
    download.href=lastURL;download.download='Riftfall_Fujiwara_BGM_V37_CHANGED_ONLY.zip';download.hidden=false;
    log('完了: 更新コード2個＋MP3 1個（＋説明書） '+(blob.size/1024/1024).toFixed(2)+'MiB');
    bar.value=100;download.click();
  }catch(e){log('エラー: '+(e?.message||String(e)));console.error('[Fujiwara BGM V37]',e);}
  finally{btn.disabled=false;}
}
$('build').addEventListener('click',build);
