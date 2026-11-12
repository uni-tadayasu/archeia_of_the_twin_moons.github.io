const TURN = Math.PI / 6;
export function approachYaw(current, x, z, factor) {
  const delta = Math.atan2(-x, -z) - current;
  return current + Math.atan2(Math.sin(delta), Math.cos(delta)) * factor;
}
export function createOrbitControls(panel, canvas, camera, active) {
  const view = { yaw: null };
  const auto = panel.querySelector('[data-view="auto"]');
  const status = panel.querySelector('output');
  const direction = camera.position.clone();
  const dragArea = panel.querySelector('.rf5520-orbit-drag');
  let drag = null;
  function reflect() {
    const automatic = view.yaw === null;
    auto.setAttribute('aria-pressed', String(automatic));
    status.textContent = automatic ? '自動視点' : '手動視点';
  }
  function rotate(amount) {
    if (!active()) return;
    if (view.yaw === null) {
      camera.getWorldDirection(direction);
      view.yaw = Math.atan2(-direction.x, -direction.z);
    }
    view.yaw = (view.yaw + amount) % (2 * Math.PI);
    reflect();
  }
  function reset() { view.yaw = null; reflect(); }
  panel.addEventListener('click', event => {
    const action=event.target.closest('[data-view]')?.dataset.view;
    if(action==='auto')reset();
    if(action==='left'||action==='right')rotate(action==='left'?-TURN:TURN);
  });
  window.addEventListener('keydown', event => {
    if (!active() || event.altKey || event.ctrlKey || event.metaKey ||
        event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const amount = event.code === 'KeyQ' ? -TURN : event.code === 'KeyE' ? TURN : 0;
    if (!amount && event.code !== 'KeyR') return;
    event.preventDefault();
    if (amount) rotate(event.repeat ? amount * .35 : amount);
    else reset();
  });
  for (const surface of [canvas, dragArea]) {
    surface.addEventListener('pointerdown', event => {
      if (!active() || drag || (surface === canvas && event.button !== 1)) return;
      drag = { id:event.pointerId, x:event.clientX };
      surface.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    surface.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      drag.x = event.clientX;
      if (dx) rotate(-dx * .009);
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) {
      surface.addEventListener(name, event => { if(drag?.id===event.pointerId)drag=null; });
    }
  }
  function fitTouchPanel() {
    panel.style.removeProperty('bottom');
    if (panel.hidden || !document.body.classList.contains('rf5520-touch')) return;
    const rect=panel.getBoundingClientRect();
    const controls=[...document.querySelectorAll('#touch.active #joy,#touch.active #tbtns button')]
      .map(el=>el.getBoundingClientRect()).filter(box=>box.width&&box.height&&box.right>rect.left&&box.left<rect.right);
    const fits=top=>controls.every(box=>top+rect.height+6<=box.top||top>=box.bottom+6);
    if(fits(rect.top))return;
    const candidates=controls.flatMap(box=>[box.top-rect.height-6,box.bottom+6])
      .filter(top=>top>=55&&top+rect.height<=innerHeight-6&&fits(top))
      .sort((a,b)=>Math.abs(a-rect.top)-Math.abs(b-rect.top));
    if(candidates.length)panel.style.bottom=innerHeight-candidates[0]-rect.height+'px';
  }
  document.addEventListener('riftfall-touch-layout',fitTouchPanel);
  return {
    view,reset,
    refresh(){
      panel.hidden=!active();
      if(panel.hidden)drag=null;
      else fitTouchPanel();
    },
    movement(input){
      if(!active()||view.yaw===null)return input;
      camera.getWorldDirection(direction);
      const length=Math.hypot(direction.x,direction.z);
      if(length<.001)return input;
      const sin=-direction.x/length,cos=-direction.z/length;
      return {...input,mx:input.mx*cos+input.mz*sin,mz:input.mz*cos-input.mx*sin};
    }
  };
}
