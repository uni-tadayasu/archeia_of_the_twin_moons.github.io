const READY_SECONDS = 1.3;
const START_SECONDS = 3 + READY_SECONDS;
const GO_SECONDS = .9;

export function createBattleCountdown(element, cue) {
  let current = null;
  let lastLabel = '';
  let goRemaining = 0;

  function render(label, go = false) {
    if (lastLabel === label) return;
    lastLabel = label;
    element.hidden = false;
    element.textContent = label;
    element.classList.toggle('fight', go);
    element.classList.remove('go');
    void element.offsetWidth;
    element.classList.add('go');
    cue(go ? 'burst' : 'ui');
  }

  function clear() {
    if (current) current.introCountdown = false;
    current = null;
    lastLabel = '';
    goRemaining = 0;
    element.hidden = true;
  }

  return {
    begin(battle) {
      clear();
      current = battle;
      battle.introCountdown = true;
      battle.intro = START_SECONDS;
      render('構え……');
    },
    tick(battle, frameSeconds) {
      if (!current || current !== battle) return;
      const elapsed = Math.min(.25, Math.max(0, frameSeconds));
      if (goRemaining > 0) {
        goRemaining -= elapsed;
        if (goRemaining <= 0) clear();
        return;
      }
      if (battle.intro > 0) {
        battle.intro = Math.max(0, battle.intro - elapsed);
        if (battle.intro > 1e-6) {
          render(battle.intro > 3 + 1e-6 ? '構え……' : String(Math.ceil(battle.intro - 1e-6)));
          return;
        }
      }
      battle.intro = 0;
      battle.introCountdown = false;
      goRemaining = GO_SECONDS;
      render('戦闘開始！', true);
    },
    clear,
  };
}
