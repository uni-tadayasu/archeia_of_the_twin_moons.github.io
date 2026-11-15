/** One input state for keyboard, pointer, touch and standard gamepads. */
export class InputController {
  constructor(canvas, {onPause=()=>{}}={}) {
    this.canvas=canvas; this.active=false; this.keys=new Set(); this.held=new Set(); this.pulses=new Set(); this.stick={x:0,z:0}; this.abort=new AbortController();
    const opts={signal:this.abort.signal};
    // A connected mouse may make the primary pointer "fine" on a touch device.
    // Keep touch controls available for any touchscreen, including hybrid laptops.
    this.touchObserved=false;
    this.touchQuery=window.matchMedia('(any-pointer: coarse)');
    const updateTouch=()=>document.documentElement.classList.toggle('touch-input',this.touchObserved||navigator.maxTouchPoints>0||this.touchQuery.matches);
    this.touchQuery.addEventListener('change',updateTouch,opts);
    document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){this.touchObserved=true;updateTouch();}},opts);
    updateTouch();
    const keys={KeyJ:'attack',KeyK:'skill',KeyI:'skill2',KeyU:'skill2',KeyL:'over',KeyH:'heal',ShiftLeft:'guard',ShiftRight:'guard',Space:'dash'};
    window.addEventListener('keydown',e=>{
      if(!this.active || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
      if(e.code==='Escape'){e.preventDefault();onPause();return;}
      if(keys[e.code] || /^(Key[WASD]|Arrow)/.test(e.code)) e.preventDefault();
      if(!e.repeat&&keys[e.code])this.pulses.add(keys[e.code]); this.keys.add(e.code);
    },opts);
    window.addEventListener('keyup',e=>this.keys.delete(e.code),opts);
    window.addEventListener('blur',()=>this.reset(),opts);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),opts);
    canvas.addEventListener('pointerdown',e=>{if(!this.active)return;const act=e.button===2?'skill':'attack';this.held.add(act);this.pulses.add(act);canvas.setPointerCapture(e.pointerId);},opts);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{this.held.delete('attack');this.held.delete('skill');},opts);
    document.querySelectorAll('[data-action]').forEach(button=>{
      const act=button.dataset.action;
      button.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();button.setPointerCapture(e.pointerId);this.held.add(act);this.pulses.add(act);button.classList.add('pressed');},opts);
      for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{this.held.delete(act);button.classList.remove('pressed');},opts);
    });
    const joy=document.getElementById('joystick'),knob=document.getElementById('joystick-knob');
    let pointer=null;
    const move=e=>{if(pointer!==e.pointerId)return;const r=joy.getBoundingClientRect(),limit=r.width*.31,dx=e.clientX-r.left-r.width/2,dz=e.clientY-r.top-r.height/2,m=Math.max(limit,Math.hypot(dx,dz));this.stick={x:dx/m,z:dz/m};knob.style.transform=`translate(${this.stick.x*limit}px,${this.stick.z*limit}px)`;};
    joy.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();pointer=e.pointerId;joy.setPointerCapture(pointer);move(e);},opts);
    joy.addEventListener('pointermove',move,opts);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,e=>{if(pointer!==e.pointerId)return;pointer=null;this.stick={x:0,z:0};knob.style.transform='';},opts);
    this.keyMap=keys;
  }
  sample(){
    if(!this.active)return {x:0,z:0};
    const down=k=>this.keys.has(k);
    let x=Number(down('KeyD')||down('ArrowRight'))-Number(down('KeyA')||down('ArrowLeft'))+this.stick.x;
    let z=Number(down('KeyS')||down('ArrowDown'))-Number(down('KeyW')||down('ArrowUp'))+this.stick.z;
    const actions={};for(const [key,act]of Object.entries(this.keyMap))if(down(key))actions[act]=true;
    for(const act of this.held)actions[act]=true;for(const act of this.pulses)actions[act]=true;
    const pad=navigator.getGamepads?.()?.find(p=>p?.connected);if(pad){const dead=v=>Math.abs(v)>.15?v:0;x+=dead(pad.axes[0]||0);z+=dead(pad.axes[1]||0);['attack','dash','skill','skill2','guard','over','heal'].forEach((a,i)=>{if(pad.buttons[i]?.pressed)actions[a]=true;});}
    const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}this.pulses.clear();return {x,z,...actions};
  }
  reset(){this.keys.clear();this.held.clear();this.pulses.clear();this.stick={x:0,z:0};document.querySelectorAll('.pressed').forEach(n=>n.classList.remove('pressed'));const k=document.getElementById('joystick-knob');if(k)k.style.transform='';}
  setActive(value){this.active=value;this.reset();}
  dispose(){this.abort.abort();this.reset();}
}
