/* Riftfall Arena — Green Loading UI v1. No fake byte transfer percentages. */
(function(){
  'use strict';
  if(window.RiftfallLoading)return;
  const tasks=new Map();let seq=0,el=null,parts={},hideTimer=0;
  function mount(){
    if(el||!document.body)return;
    el=document.createElement('div');el.id='rf-loading-screen';el.hidden=true;el.className='rf-vanish';
    el.setAttribute('role','status');el.setAttribute('aria-label','ゲームのロード画面');el.setAttribute('aria-live','polite');
    el.innerHTML='<section class="rf-load-panel"><div class="rf-load-emblem" aria-hidden="true"></div><h2 class="rf-load-description" id="rf-load-description">出撃の準備をしています</h2><div class="rf-load-bar-shell rf-indeterminate" id="rf-load-shell" role="progressbar" aria-label="読み込みの進捗" aria-valuemin="0" aria-valuemax="100"><div class="rf-load-bar-fill" id="rf-load-fill"></div></div><div class="rf-load-meta"><span class="rf-load-filename" id="rf-load-file"></span><span class="rf-load-percent" id="rf-load-percent">準備中</span></div><button type="button" class="rf-load-dismiss" id="rf-load-dismiss">閉じる</button></section>';
    document.body.append(el);
    parts={desc:el.querySelector('#rf-load-description'),shell:el.querySelector('#rf-load-shell'),fill:el.querySelector('#rf-load-fill'),file:el.querySelector('#rf-load-file'),percent:el.querySelector('#rf-load-percent'),dismiss:el.querySelector('#rf-load-dismiss')};
    parts.dismiss.addEventListener('click',()=>{tasks.clear();conceal();});
    refresh();
  }
  function current(){return [...tasks.values()].at(-1)||null;}
  function refresh(){
    if(!el){mount();if(!el)return;}
    const t=current();if(!t){conceal();return;}
    clearTimeout(hideTimer);el.hidden=false;el.classList.remove('rf-vanish');
    el.classList.toggle('rf-load-error-state',!!t.error);
    parts.desc.textContent=t.title||'読み込み中…';
    parts.file.textContent=t.error||t.note||'冒険の準備をしています…';
    const determinate=Number.isFinite(t.total)&&t.total>0;
    parts.shell.classList.toggle('rf-indeterminate',!determinate);
    if(determinate){
      const pc=Math.max(0,Math.min(100,Math.round((t.completed/t.total)*100)));
      parts.fill.style.width=pc+'%';parts.percent.textContent=pc+'%';
      parts.shell.setAttribute('aria-valuenow',String(pc));
    }else{parts.fill.style.removeProperty('width');parts.percent.textContent='読み込み中';parts.shell.removeAttribute('aria-valuenow');}
  }
  function conceal(){
    if(!el)return;
    el.classList.add('rf-vanish');clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{if(!tasks.size && el)el.hidden=true;},360);
  }
  function begin(title,options){
    const opt=options||{};
    const token=opt.token||'job-'+(++seq);
    const task={id:token,title:title||'読み込み中…',total:Number.isFinite(opt.total)&&opt.total>0?opt.total:null,completed:0,note:opt.note||'',error:null};
    tasks.delete(token);tasks.set(token,task);
    const delay=Number.isFinite(opt.delay)?Math.max(0,opt.delay):(token==='boot'?0:160);
    if(delay===0)refresh();else setTimeout(()=>{if(tasks.has(token))refresh();},delay);
    return token;
  }
  function progress(token,completed,total,note){
    const t=tasks.get(token);if(!t)return;
    if(Number.isFinite(total)&&total>0)t.total=total;
    t.completed=Number.isFinite(completed)?Math.max(0,completed):t.completed;
    if(typeof note==='string')t.note=note;
    if(current()===t && el&&!el.hidden)refresh();
  }
  function end(token){
    const t=tasks.get(token);if(!t)return;
    if(t.total){t.completed=t.total;if(current()===t)refresh();}
    tasks.delete(token);setTimeout(()=>{if(!tasks.size)conceal();else refresh();},210);
  }
  function error(token,message){
    const t=tasks.get(token);if(!t)return;
    t.title='読み込みを完了できませんでした';t.error=String(message||'モデルの場所と通信を確認してください');
    refresh();
  }
  function transition(title,callback){
    const token=begin(title||'次の舞台を準備しています');
    return Promise.resolve().then(callback).then(v=>{end(token);return v;},e=>{error(token,e?.message||String(e));throw e;});
  }
  const api={begin,progress,end,error,transition,manual:begin};
  Object.defineProperty(window,'RiftfallLoading',{value:api,configurable:false});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('pagehide',()=>clearTimeout(hideTimer));
})();
