// RF554_TOUCH_SAFE_AREA_20261111: preserve saved positions and clamp visible controls to safe areas.
/** Riftfall Arena V45 responsive control & graphics settings.
 * DOM-only configuration: never alters fighter state, authentication, combat damage, or GLB assets.
 */
const QUALITY_KEY = 'rf45-quality-v1';
const LAYOUT_KEY = 'rf45-touch-layout-v1';
const SIZE_KEY = 'rf45-touch-size-v1';
const QUALITY = Object.freeze({
  low:      { label:'軽量', mobileDpr:0.65, desktopDpr:0.80, mobileFps:25, desktopFps:35, fx:28, sprites:22, threeD:3 },
  standard: { label:'標準', mobileDpr:0.90, desktopDpr:1.10, mobileFps:30, desktopFps:55, fx:75, sprites:48, threeD:6 },
  high:     { label:'高画質', mobileDpr:1.30, desktopDpr:1.50, mobileFps:45, desktopFps:60, fx:150, sprites:85, threeD:10 }
});
const ACTIONS = Object.freeze([
  ['joy','移動'], ['guard','構'], ['skill','技A'], ['skill2','技B'],
  ['jump','跳'], ['over','奥'], ['attack','斬'], ['heal','癒']
]);
const CLAMP = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const save = (key,v) => { try { localStorage.setItem(key,v); } catch { /* storage disabled */ } };
const copy = v => JSON.parse(JSON.stringify(v));
const defaults = () => ({
  portrait: {
    joy:[20,85], guard:[64,74], skill:[79,72], skill2:[93,74],
    jump:[64,85], over:[79,83], attack:[93,85], heal:[79,94]
  },
  landscape: {
    joy:[15,77], guard:[68,51], skill:[80,46], skill2:[92,51],
    jump:[68,75], over:[80,71], attack:[92,75], heal:[80,91]
  }
});
const orientation = () => window.innerWidth <= window.innerHeight ? 'portrait' : 'landscape';
const safeParse = () => { try { return JSON.parse(read(LAYOUT_KEY) || '{}') || {}; } catch { return {}; } };
const validPosition = p => Array.isArray(p) && p.length===2 && p.every(x=>Number.isFinite(x)&&x>=0&&x<=100);
function layoutsFromStorage(){
  const src=safeParse(),out=defaults();
  for(const mode of ['portrait','landscape'])for(const [name] of ACTIONS){
    if(validPosition(src?.[mode]?.[name]))out[mode][name]=src[mode][name];
  }
  return out;
}
let active = null;
export function initResponsiveV45({ isTouch=false }={}){
  if(active) return active;
  const storedQuality = read(QUALITY_KEY);
  let selected = QUALITY[storedQuality] ? storedQuality : (isTouch?'standard':'high');
  let buttonScale = CLAMP(Number(read(SIZE_KEY))||100,80,120);
  let layouts = layoutsFromStorage();
  let editorMode = orientation(),editor=null;
  const quality = () => QUALITY[selected];
  const dpr = () => Math.min(Math.max(1,window.devicePixelRatio||1), isTouch?quality().mobileDpr:quality().desktopDpr);
  const fps = () => isTouch?quality().mobileFps:quality().desktopFps;
  const actualButtonPx = () => {
    const portrait=orientation()==='portrait';
    const base=portrait?CLAMP(window.innerWidth*.12,42,60):CLAMP(window.innerHeight*.115,39,57);
    return Math.max(44,base*buttonScale/100);
  };
  const actualJoyPx = () => {
    const portrait=orientation()==='portrait';
    const base=portrait?CLAMP(window.innerWidth*.27,96,142):CLAMP(window.innerHeight*.29,90,135);
    return base*buttonScale/100;
  };
  function saveLayouts(){save(LAYOUT_KEY,JSON.stringify(layouts));}
  // Read physical notch / home-indicator insets from resolved CSS env() values.
  // Do not change LAYOUT_KEY or write clamped values back to saved settings.
  let safeProbe=null;
  function safeInsets(){
    if(!safeProbe){
      safeProbe=document.createElement('div');
      safeProbe.setAttribute('aria-hidden','true');
      safeProbe.style.cssText='position:fixed;left:-99999px;top:-99999px;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      (document.body||document.documentElement).append(safeProbe);
    }
    const c=getComputedStyle(safeProbe), num=v=>Math.max(0,parseFloat(v)||0);
    return {top:num(c.paddingTop),right:num(c.paddingRight),bottom:num(c.paddingBottom),left:num(c.paddingLeft)};
  }
  function applyPosition(element,p,size){
    if(!element||!p)return;
    const safe=safeInsets(),edge=size/2+6,w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
    const lx=Math.min(w/2,safe.left+edge),rx=Math.max(lx,w-safe.right-edge);
    const ty=Math.min(h/2,safe.top+edge),by=Math.max(ty,h-safe.bottom-edge);
    const x=CLAMP(p[0]*w/100,lx,rx), y=CLAMP(p[1]*h/100,ty,by);
    element.style.setProperty('left',x+'px','important');
    element.style.setProperty('top',y+'px','important');
    element.style.setProperty('right','auto','important');
    element.style.setProperty('bottom','auto','important');
    element.style.setProperty('transform','translate(-50%,-50%)','important');
  }
  function relayout(){
    document.documentElement.style.setProperty('--rf45-button-size',actualButtonPx()+'px');
    document.documentElement.style.setProperty('--rf45-joy-size',actualJoyPx()+'px');
    document.body.classList.add('rf45-responsive');
    const mode=orientation();
    for(const [name] of ACTIONS){
      const el=name==='joy'?document.getElementById('joy'):document.querySelector('#tbtns button[data-act="'+name+'"]');
      applyPosition(el,layouts[mode][name],name==='joy'?actualJoyPx():actualButtonPx());
    }
    if(editor&&!editor.hidden)paintEditor();
  }
  function setQuality(next){
    if(!QUALITY[next])return;
    selected=next;save(QUALITY_KEY,next);
    document.body.dataset.rf45Quality=next;
    const label=document.getElementById('rf45-quality-status');
    if(label)label.textContent='現在：'+quality().label+'／描画上限 '+fps()+'fps';
    document.dispatchEvent(new CustomEvent('riftfall-quality-change',{detail:{quality:next}}));
  }
  function reset(mode){
    layouts[mode]=copy(defaults()[mode]);saveLayouts();relayout();paintEditor();
  }
  function mirror(mode){
    for(const [name] of ACTIONS){const pos=layouts[mode][name];layouts[mode][name]=[100-pos[0],pos[1]];}
    saveLayouts();relayout();paintEditor();
  }
  const make = (html) => {const t=document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;};
  function createEditor(){
    if(editor)return editor;
    editor=make(`<section id="rf45-layout-editor" hidden role="dialog" aria-modal="true" aria-label="スマホボタン配置編集">
      <div class="rf45-editor-head">
        <strong>操作ボタンの配置</strong>
        <label>向き <select id="rf45-orientation"><option value="portrait">縦画面</option><option value="landscape">横画面</option></select></label>
        <button type="button" id="rf45-mirror">左右反転</button><button type="button" id="rf45-default">初期配置</button>
        <button type="button" class="rf45-primary" id="rf45-finish">保存して閉じる</button>
      </div>
      <p class="rf45-editor-help">● を指でドラッグして移動できます。設定は端末内に保存され、縦・横それぞれに適用します。</p>
      <div id="rf45-editor-controls" aria-label="配置プレビュー"></div>
    </section>`);
    document.body.append(editor);
    editor.querySelector('#rf45-orientation').onchange=(e)=>{editorMode=e.target.value;paintEditor();};
    editor.querySelector('#rf45-default').onclick=()=>reset(editorMode);
    editor.querySelector('#rf45-mirror').onclick=()=>mirror(editorMode);
    const close=()=>{saveLayouts();editor.hidden=true;relayout();};
    editor.querySelector('#rf45-finish').onclick=close;
    editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
    for(const [name,label] of ACTIONS){
      const b=document.createElement('button');b.type='button';b.className='rf45-editor-control';b.dataset.control=name;
      b.textContent=name==='joy'?'＋':label;b.setAttribute('aria-label',label+'の位置');
      if(name==='joy')b.classList.add('rf45-editor-joy');
      const update=e=>{
        const size=name==='joy'?actualJoyPx():actualButtonPx();
        layouts[editorMode][name]=[
          CLAMP(e.clientX/window.innerWidth*100,(size/2+6)/window.innerWidth*100,100-(size/2+6)/window.innerWidth*100),
          CLAMP(e.clientY/window.innerHeight*100,(size/2+6)/window.innerHeight*100,100-(size/2+6)/window.innerHeight*100)
        ];
        paintEditor();
      };
      b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);update(e);});
      b.addEventListener('pointermove',e=>{if(b.hasPointerCapture(e.pointerId))update(e);});
      b.addEventListener('pointerup',()=>saveLayouts());
      b.addEventListener('pointercancel',()=>saveLayouts());
      editor.querySelector('#rf45-editor-controls').append(b);
    }
    return editor;
  }
  function paintEditor(){
    if(!editor)return;
    const sel=editor.querySelector('#rf45-orientation');sel.value=editorMode;
    for(const [name] of ACTIONS){
      const b=editor.querySelector('[data-control="'+name+'"]');
      const px=name==='joy'?actualJoyPx():actualButtonPx();
      b.style.width=px+'px';b.style.height=px+'px';
      applyPosition(b,layouts[editorMode][name],px);
    }
  }
  function showEditor(){
    createEditor();editorMode=orientation();editor.hidden=false;paintEditor();
    editor.querySelector('#rf45-finish')?.focus({preventScroll:true});
  }
  function createOptions(){
    const target=document.querySelector('#scr-options .menu');
    if(!target||document.getElementById('rf45-settings'))return;
    const section=make(`<section class="rf45-settings" id="rf45-settings" aria-label="表示とスマホ操作設定">
      <h3>画質・操作レイアウト</h3>
      <div class="rf45-settings-grid">
      <label>画質<select id="rf45-quality"><option value="low">軽量（負荷を抑える）</option><option value="standard">標準（バランス）</option><option value="high">高画質（演出重視）</option></select></label>
      <label>操作ボタンの大きさ <output id="rf45-size-label">100%</output><input type="range" id="rf45-size" min="80" max="120" step="5" value="100"></label>
      </div>
      <p id="rf45-quality-status" class="rf45-quality-status" aria-live="polite"></p>
      <div class="rf45-settings-actions"><button type="button" id="rf45-edit-layout">ボタン配置を編集</button><button type="button" id="rf45-reset-layout">縦・横の配置を初期化</button></div>
      <small>設定はこの端末に保存されます。PCのキーボード操作、ゲームパッド、キャラクター能力・モデル・セーブは変更しません。</small>
    </section>`);
    const diff=target.querySelector('#opt-diff');if(diff)diff.insertAdjacentElement('afterend',section);else target.prepend(section);
    const select=section.querySelector('#rf45-quality');select.value=selected;
    select.addEventListener('change',e=>setQuality(e.target.value));
    const slider=section.querySelector('#rf45-size'),label=section.querySelector('#rf45-size-label');slider.value=buttonScale;
    label.textContent=buttonScale+'%';
    slider.oninput=()=>{buttonScale=CLAMP(Number(slider.value)||100,80,120);label.textContent=buttonScale+'%';save(SIZE_KEY,buttonScale);relayout();};
    section.querySelector('#rf45-edit-layout').onclick=showEditor;
    section.querySelector('#rf45-reset-layout').onclick=()=>{layouts=defaults();saveLayouts();relayout();};
    section.querySelector('#rf45-quality-status').textContent='現在：'+quality().label+'／描画上限 '+fps()+'fps';
  }
  active = Object.freeze({
    getQuality:()=>selected, pixelRatio:dpr, fps, fxLimit:()=>quality().fx,
    maxPaintedFx:()=>quality().sprites,maxThreeDEffects:()=>quality().threeD,
    relayout, setQuality,showEditor
  });
  window.RF45Performance=active;
  const initDom=()=>{document.body.dataset.rf45Quality=selected;createOptions();relayout();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDom,{once:true});else initDom();
  // Layout coordinates are based on the layout viewport, not the reduced keyboard viewport.
  // Avoid dozens of expensive style updates while Safari animates the on-screen keyboard.
  let relayoutPending=false,lastWidth=0,lastHeight=0;
  function queueRelayout(){
    if(document.documentElement.classList.contains('rf554-keyboard-open'))return;
    if(relayoutPending)return;
    relayoutPending=true;
    requestAnimationFrame(()=>{
      relayoutPending=false;
      if(document.documentElement.classList.contains('rf554-keyboard-open'))return;
      const w=window.innerWidth,h=window.innerHeight;
      if(w===lastWidth&&h===lastHeight)return;
      lastWidth=w;lastHeight=h;relayout();
    });
  }
  window.addEventListener('resize',queueRelayout,{passive:true});
  window.addEventListener('orientationchange',()=>{
    lastWidth=0;lastHeight=0;queueRelayout();
    setTimeout(()=>{lastWidth=0;queueRelayout();},160);
    setTimeout(()=>{lastWidth=0;queueRelayout();},430);
  },{passive:true});
  window.visualViewport?.addEventListener('resize',queueRelayout,{passive:true});
  document.addEventListener('rf554-keyboard-closed',()=>{lastWidth=0;lastHeight=0;queueRelayout();});
  return active;
}
