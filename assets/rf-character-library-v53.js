/* V53: search, favorites & per-player display nicknames, preserving real IDs */
export function installCharacterLibrary({FIGHTERS,save,persist}){
 if(window.rf53Library)return window.rf53Library;
 const pref=()=>save.rfCharacterPrefs||(save.rfCharacterPrefs={});
 const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('ja').trim();
 const safe=s=>[...String(s||'').normalize('NFKC').replace(/[\u0000-\u001f<>]/g,'').trim()].slice(0,16).join('');
 const fav=k=>!!pref()[k]?.favorite,alias=k=>fav(k)?safe(pref()[k]?.nick||''):'';
 const textName=k=>alias(k)?alias(k)+'（'+FIGHTERS[k]?.name+'）':FIGHTERS[k]?.name||k;
 const match=(k,q)=>{const d=FIGHTERS[k];return d&&!q||!!d&&norm([d.name,d.title,d.attribute,k,alias(k),...(d.skills||[]).map(s=>s.name)].join(' ')).includes(norm(q))};
 let pending=false,modal=null;
 const tag=(t,c,label)=>{const e=document.createElement(t);if(c)e.className=c;if(label!=null)e.textContent=label;return e};
 function set(k,delta){if(!FIGHTERS[k])return;const old=pref()[k]||{};const favorite=delta.favorite??old.favorite??false;
 pref()[k]={favorite,nick:favorite?safe(delta.nick??old.nick):'',at:Date.now()};persist();request();if(modal)draw();}
 const api={favorite:fav,nickname:alias,displayName:textName,match,setFavorite:(k,on)=>set(k,{favorite:!!on}),setNickname:(k,n)=>set(k,{favorite:true,nick:n}),open:open,choose:choose,refresh:request};
 window.rf53Library=api;
 function fighterOf(el){
  const key=el.dataset.rf53Key||el.dataset.specialKey||el.dataset.fighterId;if(FIGHTERS[key])return key;
  const label=el.querySelector('b,strong')?.textContent?.trim()||'';
  const found=Object.entries(FIGHTERS).find(([k,d])=>d.name===label||label.startsWith(d.name+'【')||label.startsWith(d.name+'　'));return found?.[0]||'';
 }
 function card(el,k){
  if(!el||!k||!FIGHTERS[k]||el.classList.contains('stage-tile'))return;
  el.dataset.rf53Key=k;
  if(el.matches('button.card,button.chip,button.party-picker-choice')&&!el.disabled){
    let star=el.querySelector(':scope > .rf53-star');
    if(!star){star=tag('span','rf53-star');star.setAttribute('role','button');star.tabIndex=0;el.append(star);}
    star.dataset.rf53Favorite=k;const label=fav(k)?'★':'☆';if(star.textContent!==label)star.textContent=label;star.classList.toggle('is-fav',fav(k));
    star.setAttribute('aria-label',FIGHTERS[k].name+(fav(k)?'のお気に入りを解除':'をお気に入り登録'));
  }
  let nick=el.querySelector(':scope > .rf53-nick');
  if(alias(k)){if(!nick){nick=tag('small','rf53-nick');el.append(nick)}nick.textContent='呼び名：'+alias(k)}
  else nick?.remove();
 }
 const queryState=new Map();
 function attachSearch(list,id){
  if(!list?.parentElement)return null;
  let input=document.getElementById(id);
  if(!input){const parent=tag('div','rf53-toolbar');input=tag('input','rf53-search');input.id=id;input.type='search';input.autocomplete='off';input.placeholder='キャラ名・属性・ニックネームで探す';
    input.value=queryState.get(id)||'';
    parent.append(input);
    if(list.id==='forge-list')list.prepend(parent);else list.before(parent);
    input.addEventListener('input',()=>{queryState.set(id,input.value);request()});}
  return input;
 }
 function filterList(id,searchId,selector){
  const el=document.getElementById(id);if(!el)return;
  const search=attachSearch(el,searchId),term=search?.value||'';
  for(const node of el.querySelectorAll(selector)){const k=fighterOf(node);if(!k)continue;card(node,k);const show=match(k,term);if(node.hidden===show)node.hidden=!show;}
 }
 function selectList(){
  const el=document.getElementById('select-grid');if(!el)return;
  const buttons=[...el.querySelectorAll(':scope > button.card')];
  const stage=buttons.some(x=>x.classList.contains('stage-tile'));
  let favOnly=document.getElementById('rf53-fav-only');
  const toolbar=document.querySelector('#scr-select .select-tools');
  if(toolbar&&!favOnly){favOnly=tag('button','rf53-toggle','☆ お気に入りのみ');favOnly.id='rf53-fav-only';favOnly.type='button';favOnly.dataset.on='0';
    const manager=tag('button','rf53-open','★ お気に入り管理');manager.type='button';manager.onclick=open;
    toolbar.append(favOnly,manager);favOnly.onclick=()=>{favOnly.dataset.on=favOnly.dataset.on==='1'?'0':'1';favOnly.setAttribute('aria-pressed',String(favOnly.dataset.on==='1'));request()};}
  if(favOnly)favOnly.hidden=stage;
  const term=document.getElementById('select-search')?.value||'';
  let count=0;for(const b of buttons){
    const k=fighterOf(b);
    if(k&&!stage)card(b,k);
    const show=stage?norm(b.dataset.search||b.textContent).includes(norm(term)):k?match(k,term)&&(!favOnly||favOnly.dataset.on!=='1'||fav(k)):true;
    if(b.hidden===show)b.hidden=!show;if(show)count++;
  }
  const counter=document.getElementById('select-counter');if(counter&&counter.textContent!==count+' / '+buttons.length+'件')counter.textContent=count+' / '+buttons.length+'件';
  const empty=document.getElementById('select-empty');if(empty)empty.hidden=count>0;
 }
 function castleSearch(){
  const area=document.getElementById('castle-content');if(!area)return;
  for(const s of area.querySelectorAll('select.cr-select')){
    if(s.dataset.rf53Ready)continue;
    const orig=[...s.options].map(o=>({value:o.value,label:o.textContent}));
    if(!orig.length||orig.some(o=>!FIGHTERS[o.value]))continue;
    s.dataset.rf53Ready='1';
    const i=tag('input','rf53-search rf53-castle');i.type='search';i.placeholder='領主・出撃キャラの名前を検索';
    s.before(i);
    i.addEventListener('input',()=>{
      const old=s.value,valid=orig.filter(o=>match(o.value,i.value));
      s.replaceChildren(...valid.map(o=>{const item=tag('option','',textName(o.value));item.value=o.value;return item}));
      if(valid.some(o=>o.value===old))s.value=old;
    });
  }
 }
 function top(){
  const host=document.querySelector('#scr-title .portal-services');if(!host||document.getElementById('rf53-library-open'))return;
  const button=tag('button','rf53-home');button.id='rf53-library-open';button.type='button';
  button.append(tag('span','service-icon','★'),tag('b','','お気に入りキャラ'),tag('small','','検索・ニックネーム'));button.onclick=open;host.append(button);
 }
 function scan(){
  selectList();filterList('forge-list','rf53-forge-search',':scope > button');filterList('shop-list','rf53-shop-search',':scope > .card');
  for(const b of document.querySelectorAll('#party-picker-results button')){const k=fighterOf(b);if(k)card(b,k)}
  castleSearch();top();
 }
 function request(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;scan()})}
 function draw(){
  if(!modal)return;
  const list=modal.querySelector('.rf53-list'),term=modal.querySelector('.rf53-query')?.value||'',only=modal.querySelector('.rf53-only')?.checked;
  list.replaceChildren();
  const keys=Object.keys(FIGHTERS).filter(k=>!FIGHTERS[k].hidden&&(!only||fav(k))&&match(k,term)).sort((a,b)=>Number(fav(b))-Number(fav(a))||FIGHTERS[a].name.localeCompare(FIGHTERS[b].name,'ja')).slice(0,280);
  for(const k of keys){const row=tag('div','rf53-item'),star=tag('button','rf53-starbtn'+(fav(k)?' on':''),fav(k)?'★':'☆');
    star.type='button';star.onclick=()=>set(k,{favorite:!fav(k)});
    const label=tag('div','rf53-text');label.append(tag('strong','',textName(k)),tag('small','',FIGHTERS[k].name+'・'+(FIGHTERS[k].attribute||FIGHTERS[k].title||'')));
    const edit=tag('button','rf53-edit','呼び名編集');edit.type='button';edit.disabled=!fav(k);edit.onclick=()=>editNick(k);
    row.append(star,label,edit);list.append(row);}
  if(!keys.length)list.append(tag('p','rf53-empty','一致するキャラクターはありません'));
 }
 function editNick(k){const area=modal.querySelector('.rf53-editbox');area.replaceChildren();
  const label=tag('label','',FIGHTERS[k].name+' のニックネーム（最大16文字）');const field=tag('input','rf53-search');field.value=alias(k);field.maxLength=32;
  const saveButton=tag('button','rf53-save','保存');saveButton.type='button';saveButton.onclick=()=>{set(k,{favorite:true,nick:field.value});area.replaceChildren()};
  const cancel=tag('button','','キャンセル');cancel.type='button';cancel.onclick=()=>area.replaceChildren();
  area.append(label,field,saveButton,cancel);field.focus();
 }
 function choose(keys,callback,title='キャラクターを選択'){
  const valid=[...new Set(keys||[])].filter(k=>FIGHTERS[k]);
  const shade=tag('div','rf53-modal');shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',title);
  const panel=tag('section','rf53-panel'),head=tag('div','rf53-head'),close=tag('button','','閉じる ×');
  close.type='button';head.append(tag('h2','',title),close);
  const search=tag('input','rf53-search');search.type='search';search.placeholder='名前・属性・ニックネームで検索';
  const list=tag('div','rf53-list');
  const dismiss=()=>shade.remove();close.onclick=dismiss;
  shade.addEventListener('pointerdown',e=>{if(e.target===shade)dismiss()});
  shade.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss()}});
  const draw=()=>{
    list.replaceChildren();
    const items=valid.filter(k=>match(k,search.value)).sort((a,b)=>Number(fav(b))-Number(fav(a))||FIGHTERS[a].name.localeCompare(FIGHTERS[b].name,'ja'));
    for(const k of items){
      const b=tag('button','rf53-choice', (fav(k)?'★ ':'')+textName(k)+'　'+(FIGHTERS[k].attribute||''));
      b.type='button';b.onclick=()=>{dismiss();callback?.(k)};list.append(b);
    }
    if(!items.length)list.append(tag('p','rf53-empty','該当するキャラクターがありません。'));
  };
  panel.append(head,search,list);shade.append(panel);document.body.append(shade);
  search.addEventListener('input',draw);draw();search.focus();
 }
  function open(){
  if(modal){modal.querySelector('.rf53-query')?.focus();return}
  modal=tag('div','rf53-modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','お気に入りとニックネーム');
  const panel=tag('section','rf53-panel'),head=tag('div','rf53-head'),close=tag('button','','閉じる ×');
  close.type='button';close.onclick=()=>{modal?.remove();modal=null;request()};
  head.append(tag('h2','','★ お気に入りキャラクター'),close);
  const search=tag('input','rf53-search rf53-query');search.type='search';search.placeholder='キャラ名・属性・ニックネームで検索';
  const label=tag('label','rf53-only-label'),check=tag('input','rf53-only');check.type='checkbox';label.append(check,document.createTextNode('お気に入りのみ'));
  const editor=tag('div','rf53-editbox'),list=tag('div','rf53-list');
  panel.append(head,search,label,editor,list);modal.append(panel);document.body.append(modal);
  search.oninput=draw;check.onchange=draw;modal.addEventListener('pointerdown',e=>{if(e.target===modal)close.click()});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close.click()}});
  draw();search.focus();
 }
 document.addEventListener('click',e=>{const s=e.target.closest?.('[data-rf53-favorite]');if(!s)return;
  e.preventDefault();e.stopImmediatePropagation();set(s.dataset.rf53Favorite,{favorite:!fav(s.dataset.rf53Favorite)});},true);
 document.addEventListener('keydown',e=>{const s=e.target.closest?.('[data-rf53-favorite]');if(!s||!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();set(s.dataset.rf53Favorite,{favorite:!fav(s.dataset.rf53Favorite)});},true);
 document.getElementById('select-search')?.addEventListener('input',request);
 document.getElementById('party-picker-search')?.addEventListener('input',request);
 const ui=document.getElementById('ui');if(ui)new MutationObserver(changes=>{if(changes.some(c=>c.type==='childList'))request()}).observe(ui,{childList:true,subtree:true});
 request();return api;
}
