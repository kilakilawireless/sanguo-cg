// 背景音樂（Leo 2026-10-28「遊戲來點音樂吧」：原作的不能拿，寫同風格的）：WebAudio 現場合成，不用音檔。
// 三段各 8 小節循環：城中（G 大調、慢、長笛＋豎琴分解和弦）、戰鬥（A 小調、快、鼓＋八分音符低音）、王戰（D 小調、沉）。
// 第一次出聲要等玩家按過畫面（瀏覽器規定），所以 setMusic 只記住想播什麼，按下去才真的開始。設定 settings.bgm 關掉。
let ac=null,master=null,noise=null,timer=null,seq=null;
export const music={on:true,kind:null,vol:.3};
const mtof=m=>440*Math.pow(2,(m-69)/12);
// 曲子：bpm、每小節拍數、和弦（每小節一組 midi）、主旋律 [midi 或 0＝休止, 拍數]
const TUNES={
 town:{bpm:96,bars:8,chords:[[55,59,62],[52,55,59],[48,52,55],[50,54,57],[55,59,62],[52,55,59],[48,52,55,50,54,57],[55,59,62]],
  bass:[43,40,36,38,43,40,36,43],arp:true,drums:'soft',
  lead:[[71,.5],[74,.5],[79,1],[78,.5],[76,.5],[74,1], [76,1],[79,.5],[76,.5],[74,.5],[71,.5],[69,1], [72,.5],[76,.5],[79,1],[76,.5],[74,.5],[72,1], [74,1],[78,.5],[81,.5],[74,2],
   [71,.5],[74,.5],[79,1],[81,.5],[83,.5],[81,1], [79,.5],[76,.5],[71,1],[76,.5],[74,.5],[71,1], [72,.5],[76,.5],[79,1],[78,.5],[76,.5],[74,1], [67,3],[0,1]]},
 battle:{bpm:152,bars:8,chords:[[57,60,64],[57,60,64],[53,57,60],[55,59,62],[57,60,64],[57,60,64],[53,57,60,55,59,62],[52,56,59]],
  bass:[45,45,41,43,45,45,41,40],arp:false,drums:'rock',
  lead:[[69,.5],[69,.5],[72,.5],[76,.5],[74,.5],[72,.5],[71,.5],[69,.5], [76,1],[79,.5],[76,.5],[74,1],[72,.5],[71,.5], [77,.5],[77,.5],[81,.5],[77,.5],[76,.5],[74,.5],[72,.5],[74,.5], [71,.5],[74,.5],[79,1],[77,.5],[76,.5],[74,1],
   [81,.5],[81,.5],[79,.5],[76,.5],[77,.5],[76,.5],[74,.5],[72,.5], [76,.5],[72,.5],[69,1],[71,.5],[72,.5],[74,1], [77,.5],[76,.5],[74,.5],[72,.5],[71,.5],[72,.5],[74,.5],[71,.5], [76,2],[68,.5],[71,.5],[76,1]]},
 boss:{bpm:118,bars:8,chords:[[50,53,57],[46,50,53],[43,46,50],[45,49,52],[50,53,57],[46,50,53],[43,46,50,45,49,52],[50,53,57]],
  bass:[38,34,31,33,38,34,31,38],arp:false,drums:'heavy',
  lead:[[74,1],[77,.5],[76,.5],[74,1],[69,1], [70,1],[74,.5],[72,.5],[70,1],[69,1], [67,.5],[70,.5],[74,1],[72,.5],[70,.5],[69,1], [73,1],[76,1],[81,2],
   [74,.5],[74,.5],[77,.5],[81,.5],[79,.5],[77,.5],[76,.5],[74,.5], [70,1],[74,1],[77,1],[74,1], [79,.5],[77,.5],[76,.5],[74,.5],[73,.5],[74,.5],[76,.5],[73,.5], [74,3],[0,1]]}};
function ctx(){
 if(ac)return ac;ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=music.vol;master.connect(ac.destination);
 noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return ac;
}
// ---- 樂器 ----
function lead(m,t,dur){const f=mtof(m),o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),lp=ac.createBiquadFilter(),lfo=ac.createOscillator(),lg=ac.createGain();
 o.type='triangle';o2.type='sine';o.frequency.value=f;o2.frequency.value=f*2.001;lp.type='lowpass';lp.frequency.value=2600;
 lfo.frequency.value=5.5;lg.gain.value=f*.006;lfo.connect(lg).connect(o.frequency);lfo.start(t);lfo.stop(t+dur+.3);
 const a=.025,r=Math.min(.18,dur*.4);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.42,t+a);g.gain.setValueAtTime(.42,t+Math.max(a,dur-r));g.gain.exponentialRampToValueAtTime(.0001,t+dur+.05);
 const g2=ac.createGain();g2.gain.value=.25;o.connect(lp).connect(g);o2.connect(g2).connect(g);g.connect(master);o.start(t);o2.start(t);o.stop(t+dur+.1);o2.stop(t+dur+.1);}
function pad(ms,t,dur,soft){for(const m of ms){const f=mtof(m);for(const det of [-5,5]){const o=ac.createOscillator(),g=ac.createGain(),lp=ac.createBiquadFilter();o.type=soft?'triangle':'sawtooth';o.frequency.value=f;o.detune.value=det;
  lp.type='lowpass';lp.frequency.value=soft?1400:900;const v=(soft?.07:.05)/ms.length*3;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.25);g.gain.setValueAtTime(v,t+dur-.3);g.gain.linearRampToValueAtTime(.0001,t+dur);
  o.connect(lp).connect(g).connect(master);o.start(t);o.stop(t+dur+.05);}}}
function pluck(m,t){const f=mtof(m),o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.connect(g).connect(master);o.start(t);o.stop(t+.55);}
function bass(m,t,dur){const f=mtof(m),o=ac.createOscillator(),s=ac.createOscillator(),g=ac.createGain();o.type='triangle';s.type='sine';o.frequency.value=f;s.frequency.value=f/2;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.4,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);s.connect(g);g.connect(master);o.start(t);s.start(t);o.stop(t+dur+.05);s.stop(t+dur+.05);}
function kick(t,big){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(big?150:120,t);o.frequency.exponentialRampToValueAtTime(40,t+.14);g.gain.setValueAtTime(big?.9:.6,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g).connect(master);o.start(t);o.stop(t+.25);}
function snare(t){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noise;f.type='bandpass';f.frequency.value=1800;f.Q.value=.8;g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.0001,t+.13);n.connect(f).connect(g).connect(master);n.start(t);n.stop(t+.15);}
function hat(t,open){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noise;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(open?.12:.07,t);g.gain.exponentialRampToValueAtTime(.0001,t+(open?.18:.04));n.connect(f).connect(g).connect(master);n.start(t);n.stop(t+.2);}
// ---- 排程：把一首歌展開成「第幾拍做什麼」，每 100ms 往前排 0.35 秒 ----
function build(kind){const T=TUNES[kind],ev=[];let beat=0;
 for(const [m,d] of T.lead){if(m)ev.push({b:beat,f:t=>lead(m,t,d*60/T.bpm*.95)});beat+=d;}
 for(let i=0;i<T.bars;i++){const ch=T.chords[i],b0=i*4,bd=60/T.bpm;
  if(ch.length>3){ev.push({b:b0,f:t=>pad(ch.slice(0,3),t,2*bd,T.arp)});ev.push({b:b0+2,f:t=>pad(ch.slice(3),t,2*bd,T.arp)});}else ev.push({b:b0,f:t=>pad(ch,t,4*bd,T.arp)});
  if(T.arp){const notes=[ch[0],ch[2],ch[1]+12,ch[2],ch[0]+12,ch[2],ch[1]+12,ch[2]];notes.forEach((m,k)=>ev.push({b:b0+k*.5,f:t=>pluck(m,t)}));}
  const bm=T.bass[i];if(T.drums==='soft'){ev.push({b:b0,f:t=>bass(bm,t,1.6*bd)});ev.push({b:b0+2,f:t=>bass(bm,t,1.6*bd)});}
  else for(let k=0;k<8;k++)ev.push({b:b0+k*.5,f:t=>bass(k%4===3?bm+7:bm,t,.45*bd)});
  if(T.drums==='rock'){for(let k=0;k<8;k++)ev.push({b:b0+k*.5,f:t=>hat(t,k===7)});ev.push({b:b0,f:t=>kick(t)});ev.push({b:b0+2,f:t=>kick(t)});ev.push({b:b0+2.5,f:t=>kick(t)});ev.push({b:b0+1,f:t=>snare(t)});ev.push({b:b0+3,f:t=>snare(t)});}
  else if(T.drums==='heavy'){for(let k=0;k<4;k++)ev.push({b:b0+k,f:t=>kick(t,true)});ev.push({b:b0+1,f:t=>snare(t)});ev.push({b:b0+3,f:t=>snare(t)});ev.push({b:b0+3.5,f:t=>snare(t)});for(let k=0;k<8;k++)ev.push({b:b0+k*.5,f:t=>hat(t,false)});}
  else{ev.push({b:b0+1,f:t=>hat(t,false)});ev.push({b:b0+3,f:t=>hat(t,true)});}}
 ev.sort((x,y)=>x.b-y.b);return {ev,loop:T.bars*4,bd:60/T.bpm};}
function tick(){if(!seq||!ac)return;const now=ac.currentTime;
 while(true){const e=seq.s.ev[seq.i],t=seq.t0+(e.b+seq.loopN*seq.s.loop)*seq.s.bd;if(t>now+.35)break;if(t>=now-.05)try{e.f(t);}catch{}
  seq.i++;if(seq.i>=seq.s.ev.length){seq.i=0;seq.loopN++;}}}
function startNow(kind){if(!ac)return;if(seq&&seq.kind===kind)return;stopNow();const s=build(kind);seq={kind,s,i:0,loopN:0,t0:ac.currentTime+.1};master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(.0001,ac.currentTime);master.gain.linearRampToValueAtTime(music.vol,ac.currentTime+.6);tick();timer=setInterval(tick,100);}
function stopNow(){if(timer){clearInterval(timer);timer=null;}seq=null;if(ac&&master){try{master.gain.setValueAtTime(master.gain.value,ac.currentTime);master.gain.linearRampToValueAtTime(.0001,ac.currentTime+.3);}catch{}}}
// 聲音節點在 stop 之後還會響到自然結束（最多一小節），fade 掉 master 就好
let armed=false;
function unlock(){try{ctx();if(ac.state==='suspended')ac.resume();}catch{return;}if(music.on&&music.kind&&!document.hidden)startNow(music.kind);}
export function setMusic(kind){music.kind=kind;if(!armed){armed=true;for(const ev of ['pointerdown','keydown','touchend'])document.addEventListener(ev,unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNow();else if(ac&&music.on&&music.kind)startNow(music.kind);});}
 if(!ac||ac.state!=='running')return;if(!music.on||!kind){stopNow();return;}startNow(kind);}
export function musicOn(v){music.on=!!v;if(!music.on)stopNow();else if(ac&&music.kind)startNow(music.kind);}
export const _music=()=>({ac,master,seq}); // 測試用
