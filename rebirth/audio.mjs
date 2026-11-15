/** A single music channel prevents overlapping tracks across menus and battles. */
export class GameAudio {
  constructor(){this.music=new Audio();this.music.loop=true;this.music.preload='none';this.volume=.5;this.sfxVolume=.7;this.unlocked=false;this.context=null;this.current='';this.mutedForPause=false;}
  unlock(){this.unlocked=true;try{this.context??=new (window.AudioContext||window.webkitAudioContext)();void this.context.resume().catch(()=>{});}catch{}this.play();}
  setVolume(v,sfx=.7){this.volume=Math.max(0,Math.min(1,v));this.sfxVolume=sfx;this.music.volume=this.volume*.5;if(this.volume===0)this.music.pause();else this.play();}
  track(name){const path={home:'assets/audio/title-theme.mp3',story:'assets/audio/story-theme.mp3',adventure:'assets/audio/battle-theme.mp3',endless:'assets/audio/event-theme.mp3',duel:'assets/audio/battle-theme.mp3',victory:'assets/audio/story-theme.mp3'}[name]||name;if(path===this.current)return;this.music.pause();this.current=path;this.music.src=path;this.music.currentTime=0;this.play();}
  play(){if(this.unlocked&&this.volume>0&&!this.mutedForPause&&this.music.src)void this.music.play().catch(()=>{});}
  suspend(){this.mutedForPause=true;this.music.pause();}
  resume(){this.mutedForPause=false;this.play();}
  effect(type){if(!this.context||this.sfxVolume===0||this.mutedForPause)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type==='damage'?'triangle':'sine';const f=type==='kill'?660:type==='action'?330:150;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.38,t+.13);g.gain.setValueAtTime(this.sfxVolume*.055,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.start(t);o.stop(t+.19);}
  dispose(){this.music.pause();this.music.removeAttribute('src');void this.context?.close();}
}
