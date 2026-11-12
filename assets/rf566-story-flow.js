/* Riftfall Arena V55.16 — continuous story chapter travel.
 * No saved progress manipulation: main.js still awards, persists and increments
 * each chapter. This layer only advances the existing result button and moves
 * the next chapter's start position from town to the next wilderness route.
 */
import {Field} from '../field.js?v=rf-v9-2-20261109';

if(!window.__rf566StoryFlow){
  window.__rf566StoryFlow=true;
  const STORE='rf566-story-chain-enabled';
  const TRANSIT='rf566-story-transition';
  const enabled=()=>{try{return localStorage.getItem(STORE)!=='off';}catch{return true;}};
  const $=s=>document.querySelector(s);
  const oldBuild=Field.prototype.buildActors;
  Field.prototype.buildActors=function(...args){
    const result=oldBuild.apply(this,args);
    let state=null;
    try{state=JSON.parse(sessionStorage.getItem(TRANSIT)||'null');}catch{}
    if(state && Date.now()-Number(state.time||0)<90_000 && this.player?.pos){
      // A new chapter begins in the open countryside, NOT back at the village plaza.
      const z=-128-(Number(this.o?.chapter||0)%4)*21;
      this.player.pos.set(0,0,z);
      this.player.root?.position?.copy?.(this.player.pos);
      this.trail=[];
      for(const member of this.followers||[]){
        member.pos.copy(this.player.pos);
        member.pos.z+=(this.followers.indexOf(member)+1)*1.4;
        member.root?.position?.copy?.(member.pos);
      }
      this.inv=Math.max(this.inv||0,3); // no instant encounter after transition
      this.region='';
      this.__rf566ContinuousArrival=true;
    }
    try{sessionStorage.removeItem(TRANSIT);}catch{}
    return result;
  };
  let lastStamp='',timer=0;
  function removeCurtain(){
    document.documentElement.classList.remove('rf566-chapter-transition');
    document.getElementById('rf566-chapter-transition')?.remove();
  }
  function curtain(title){
    let node=document.getElementById('rf566-chapter-transition');
    if(!node){node=document.createElement('div');node.id='rf566-chapter-transition';document.body.append(node);}
    node.textContent=title;
    document.documentElement.classList.add('rf566-chapter-transition');
    setTimeout(removeCurtain,1450);
  }
  function inspect(){
    const screen=$('#scr-result'),next=$('#btn-next');
    if(!screen || !screen.classList.contains('on') || !next || next.hidden || !enabled()){lastStamp='';return;}
    const title=($('#res-title')?.textContent||'').trim();
    if(title!=='灯がひとつ戻った')return;
    const text=($('#res-text')?.textContent||'').trim();
    const stamp=title+'|'+text;
    if(stamp===lastStamp)return;
    lastStamp=stamp;
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!screen.classList.contains('on') || next.hidden || !enabled())return;
      try{sessionStorage.setItem(TRANSIT,JSON.stringify({time:Date.now()}));}catch{}
      curtain('新たな旅路へ — 物語は続く');
      next.click(); // main.js own handler progresses to the next chapter/dialogue
    },800);
  }
  function init(){
    const screen=$('#scr-result');
    if(screen){
      new MutationObserver(inspect).observe(screen,{attributes:true,attributeFilter:['class','style','hidden']});
    }
    const next=$('#btn-next');
    if(next){new MutationObserver(inspect).observe(next,{attributes:true,attributeFilter:['hidden']});}
    const options=$('#scr-options .inner');
    if(options&&!$('#rf566-story-toggle')){
      const label=document.createElement('label');label.id='rf566-story-toggle';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=enabled();
      checkbox.addEventListener('change',()=>{try{localStorage.setItem(STORE,checkbox.checked?'on':'off')}catch{}});
      const text=document.createElement('span');text.textContent='物語を連続進行（次章は町へ戻らず街道から再開）';
      label.append(checkbox,text);options.append(label);
    }
    inspect();
    window.RF566Story={get continuous(){return enabled()},setContinuous(value){try{localStorage.setItem(STORE,value?'on':'off');}catch{}}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
