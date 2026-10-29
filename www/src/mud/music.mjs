// 背景音樂（Leo 2026-10-28「遊戲來點音樂吧」：原作的不能拿，寫同風格的）：WebAudio 現場合成；有 CC0 音檔的曲子改播音檔（musicFiles）。
// 音檔五段：城中、野外（練功、地下城）、戰鬥、王戰、勝利（只播一次）。合成的三段各 8 小節循環：城中（G 大調、慢、長笛＋豎琴分解和弦）、戰鬥（A 小調、快、鼓＋八分音符低音）、王戰（D 小調、沉）。
// 第一次出聲要等玩家按過畫面（瀏覽器規定），所以 setMusic 只記住想播什麼，按下去才真的開始。設定 settings.bgm 關掉。
let ac=null,master=null,noise=null,timer=null,seq=null;
export const music={on:true,kind:null,vol:.3};
const mtof=m=>440*Math.pow(2,(m-69)/12);
// 曲子：bpm、每小節拍數、和弦（每小節一組 midi）、主旋律 [midi 或 0＝休止, 拍數]
const TUNES={
 town:{bpm:96,bars:8,chords:[[55,59,62],[52,55,59],[48,52,55],[50,54,57],[55,59,62],[52,55,59],[48,52,55,50,54,57],[55,59,62]],
  bass:[43,40,36,38,43,40,36,43],arp:true,drums:'soft',inst:'flute',
  lead:[[71,.5],[74,.5],[79,1],[78,.5],[76,.5],[74,1], [76,1],[79,.5],[76,.5],[74,.5],[71,.5],[69,1], [72,.5],[76,.5],[79,1],[76,.5],[74,.5],[72,1], [74,1],[78,.5],[81,.5],[74,2],
   [71,.5],[74,.5],[79,1],[81,.5],[83,.5],[81,1], [79,.5],[76,.5],[71,1],[76,.5],[74,.5],[71,1], [72,.5],[76,.5],[79,1],[78,.5],[76,.5],[74,1], [67,3],[0,1]]},
 battle:{bpm:152,bars:8,chords:[[57,60,64],[57,60,64],[53,57,60],[55,59,62],[57,60,64],[57,60,64],[53,57,60,55,59,62],[52,56,59]],
  bass:[45,45,41,43,45,45,41,40],arp:false,drums:'rock',inst:'brass',
  lead:[[69,.5],[69,.5],[72,.5],[76,.5],[74,.5],[72,.5],[71,.5],[69,.5], [76,1],[79,.5],[76,.5],[74,1],[72,.5],[71,.5], [77,.5],[77,.5],[81,.5],[77,.5],[76,.5],[74,.5],[72,.5],[74,.5], [71,.5],[74,.5],[79,1],[77,.5],[76,.5],[74,1],
   [81,.5],[81,.5],[79,.5],[76,.5],[77,.5],[76,.5],[74,.5],[72,.5], [76,.5],[72,.5],[69,1],[71,.5],[72,.5],[74,1], [77,.5],[76,.5],[74,.5],[72,.5],[71,.5],[72,.5],[74,.5],[71,.5], [76,2],[68,.5],[71,.5],[76,1]]},
 boss:{bpm:118,bars:8,chords:[[50,53,57],[46,50,53],[43,46,50],[45,49,52],[50,53,57],[46,50,53],[43,46,50,45,49,52],[50,53,57]],
  bass:[38,34,31,33,38,34,31,38],arp:false,drums:'heavy',inst:'dark',
  lead:[[74,1],[77,.5],[76,.5],[74,1],[69,1], [70,1],[74,.5],[72,.5],[70,1],[69,1], [67,.5],[70,.5],[74,1],[72,.5],[70,.5],[69,1], [73,1],[76,1],[81,2],
   [74,.5],[74,.5],[77,.5],[81,.5],[79,.5],[77,.5],[76,.5],[74,.5], [70,1],[74,1],[77,1],[74,1], [79,.5],[77,.5],[76,.5],[74,.5],[73,.5],[74,.5],[76,.5],[73,.5], [74,3],[0,1]]}};
let bus=null,rev=null,echo=null,comp=null;
function ctx(){
 if(ac)return ac;ac=new (window.AudioContext||window.webkitAudioContext)();
 // 訊號鏈（Leo 2026-10-28「音質不能好點嗎」）：樂器 → bus → master（淡入淡出）→ 壓縮器 → 喇叭；另有混響、回音兩條送出
 comp=ac.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=12;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.25;
 master=ac.createGain();master.gain.value=music.vol;const hi=ac.createBiquadFilter();hi.type='highshelf';hi.frequency.value=6500;hi.gain.value=-4;
 bus=ac.createGain();bus.connect(hi).connect(master).connect(comp).connect(ac.destination);
 noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 // 混響：2.4 秒指數衰減的雜訊脈衝（立體聲），送出的訊號先切掉低頻免得糊
 const L=Math.floor(ac.sampleRate*2.4),ir=ac.createBuffer(2,L,ac.sampleRate);for(let c=0;c<2;c++){const x=ir.getChannelData(c);for(let i=0;i<L;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/L,2.6)*(i<200?i/200:1);}
 rev=ac.createGain();const cv=ac.createConvolver();cv.buffer=ir;const rh=ac.createBiquadFilter();rh.type='highpass';rh.frequency.value=300;rev.connect(rh).connect(cv).connect(bus);
 // 回音：附點八分拍左右，回授 0.3，每次回音越來越悶
 echo=ac.createGain();const dl=ac.createDelay(1);dl.delayTime.value=.3;const fb=ac.createGain();fb.gain.value=.3;const dh=ac.createBiquadFilter();dh.type='lowpass';dh.frequency.value=2200;
 echo.connect(dl);dl.connect(dh).connect(fb).connect(dl);dh.connect(bus);
 return ac;
}
// ---- 樂器 ----
// 共用：每個聲部一條 gain 接 bus，再按比例送到混響／回音；pan 做左右
function out(g,pan,r,e){const p=ac.createStereoPanner();p.pan.value=pan||0;g.connect(p).connect(bus);if(r){const s=ac.createGain();s.gain.value=r;p.connect(s).connect(rev);}if(e){const s=ac.createGain();s.gain.value=e;p.connect(s).connect(echo);}}
function env(g,t,a,peak,dur,r){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+Math.max(a,dur-r));g.gain.exponentialRampToValueAtTime(.0001,t+dur+.03);}
function osc(type,f,det,t,end){const o=ac.createOscillator();o.type=type;o.frequency.value=f;if(det)o.detune.value=det;o.start(t);o.stop(end);return o;}
// 長笛：正弦基音＋微弱 2、3 倍泛音＋一點氣聲，顫音 0.15 秒後才進來；城中用
function flute(m,t,dur){const f=mtof(m),end=t+dur+.3,g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(1800,t);lp.frequency.linearRampToValueAtTime(3200,t+.08);lp.frequency.setTargetAtTime(2200,t+.2,.4);
 const o1=osc('sine',f,0,t,end),o2=osc('sine',f*2,0,t,end),o3=osc('triangle',f*3,0,t,end),g2=ac.createGain(),g3=ac.createGain();g2.gain.value=.3;g3.gain.value=.06;
 const lfo=osc('sine',5.2,0,t,end),lg=ac.createGain();lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*.008,t+.35);lfo.connect(lg);lg.connect(o1.frequency);lg.connect(o2.frequency);
 const n=ac.createBufferSource(),nf=ac.createBiquadFilter(),ng=ac.createGain();n.buffer=noise;nf.type='bandpass';nf.frequency.value=f*2;nf.Q.value=6;ng.gain.value=.05;n.start(t);n.stop(end);n.connect(nf).connect(ng).connect(g);
 o1.connect(lp);o2.connect(g2).connect(lp);o3.connect(g3).connect(lp);lp.connect(g);env(g,t,.04,.5,dur,Math.min(.2,dur*.4));out(g,.08,.35,.22);}
// 合成銅管：兩把鋸齒波微分音＋濾波包絡（開場亮、慢慢收）；戰鬥、王戰用
function brass(m,t,dur,dark){const f=mtof(m),end=t+dur+.2,g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=2;lp.frequency.setValueAtTime(dark?500:700,t);lp.frequency.exponentialRampToValueAtTime(dark?2200:3400,t+.05);lp.frequency.setTargetAtTime(dark?1100:1600,t+.1,.25);
 const o1=osc('sawtooth',f,-6,t,end),o2=osc('sawtooth',f,6,t,end),o3=osc('square',f/2,0,t,end),g3=ac.createGain();g3.gain.value=.12;
 const lfo=osc('sine',5.5,0,t,end),lg=ac.createGain();lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*.005,t+.3);lfo.connect(lg);lg.connect(o1.frequency);lg.connect(o2.frequency);
 o1.connect(lp);o2.connect(lp);o3.connect(g3).connect(lp);lp.connect(g);env(g,t,.02,.3,dur,Math.min(.12,dur*.35));out(g,-.05,.25,.1);}
function lead(m,t,dur,inst){if(inst==='flute')flute(m,t,dur);else brass(m,t,dur,inst==='dark');}
// 弦樂墊：每個音四把微分音鋸齒（或三角）分左右，慢進慢出，濾波器隨時間慢慢打開
function pad(ms,t,dur,soft){for(const m of ms){const f=mtof(m);[[-9,-.5],[-3,-.2],[3,.2],[9,.5]].forEach(([det,pan])=>{const g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=.7;lp.frequency.setValueAtTime(soft?700:500,t);lp.frequency.linearRampToValueAtTime(soft?1500:1100,t+dur*.6);
  const o=osc(soft?'triangle':'sawtooth',f,det,t,t+dur+.1);const v=(soft?.05:.035)*3/ms.length;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.35);g.gain.setValueAtTime(v,t+Math.max(.35,dur-.4));g.gain.linearRampToValueAtTime(.0001,t+dur+.05);
  o.connect(lp).connect(g);out(g,pan,.45,0);});}}
// 豎琴：三角＋正弦兩層，濾波器隨著衰減關上（撥弦的感覺）
function pluck(m,t){const f=mtof(m),end=t+1.3,g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(5000,t);lp.frequency.exponentialRampToValueAtTime(600,t+.9);
 const o=osc('triangle',f,0,t,end),s=osc('sine',f*2,0,t,end),sg=ac.createGain();sg.gain.value=.25;o.connect(lp);s.connect(sg).connect(lp);lp.connect(g);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+1.2);out(g,.3,.4,.15);}
// 貝斯：鋸齒過低通（濾波包絡）＋低一個八度的正弦
function bass(m,t,dur){const f=mtof(m),end=t+dur+.1,g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=1.5;lp.frequency.setValueAtTime(1200,t);lp.frequency.exponentialRampToValueAtTime(220,t+Math.max(.08,dur*.6));
 const o=osc('sawtooth',f,0,t,end),s=osc('sine',f/2,0,t,end),sg=ac.createGain();sg.gain.value=.7;o.connect(lp).connect(g);s.connect(sg).connect(g);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.012);g.gain.setValueAtTime(.3,t+Math.max(.012,dur-.05));g.gain.exponentialRampToValueAtTime(.0001,t+dur+.02);out(g,0,.06,0);}
// 鼓：大鼓＝掃頻正弦＋一下敲擊聲；小鼓＝雜訊＋ 180Hz 鼓身；鈸＝高通雜訊，短
function kick(t,big){const g=ac.createGain(),o=osc('sine',big?160:130,0,t,t+.3);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(big?.95:.7,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.25);o.connect(g);out(g,0,.05,0);
 const n=ac.createBufferSource(),f=ac.createBiquadFilter(),cg=ac.createGain();n.buffer=noise;f.type='lowpass';f.frequency.value=2500;cg.gain.setValueAtTime(.25,t);cg.gain.exponentialRampToValueAtTime(.0001,t+.02);n.connect(f).connect(cg);out(cg,0,0,0);n.start(t);n.stop(t+.03);}
function snare(t){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noise;f.type='bandpass';f.frequency.value=2200;f.Q.value=.6;g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.0001,t+.16);n.connect(f).connect(g);out(g,.05,.3,0);n.start(t);n.stop(t+.2);
 const b=ac.createGain(),o=osc('triangle',190,0,t,t+.15);o.frequency.exponentialRampToValueAtTime(120,t+.08);b.gain.setValueAtTime(.35,t);b.gain.exponentialRampToValueAtTime(.0001,t+.1);o.connect(b);out(b,0,.1,0);}
function hat(t,open){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noise;f.type='highpass';f.frequency.value=8500;g.gain.setValueAtTime(open?.09:.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+(open?.22:.05));n.connect(f).connect(g);out(g,-.25,open?.2:0,0);n.start(t);n.stop(t+.25);}
// ---- 排程：把一首歌展開成「第幾拍做什麼」，每 100ms 往前排 0.35 秒 ----
function build(kind){const T=TUNES[kind],ev=[];let beat=0;
 for(const [m,d] of T.lead){if(m)ev.push({b:beat,f:t=>lead(m,t,d*60/T.bpm*(T.inst==='flute'?.98:.9),T.inst)});beat+=d;}
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
function stopNow(){stopFile();if(timer){clearInterval(timer);timer=null;}seq=null;if(ac&&master){try{master.gain.setValueAtTime(master.gain.value,ac.currentTime);master.gain.linearRampToValueAtTime(.0001,ac.currentTime+.3);}catch{}}}
// 音檔（Leo 2026-10-29 選 CC0 音檔，來源授權在 assets/music/CREDITS.md）：musicFiles 有列的曲子用到才下載 assets/music/<檔名>，
// 下載解碼好之前先放合成的（野外借城中那段、勝利沒有合成就安靜），好了淡入換過去；讀不到就記住、之後都用合成的。音檔不經過合成那條的濾波混響，直接進壓縮器。
export const musicFiles={town:'town.mp3',field:'field.mp3',battle:'battle.mp3',boss:'boss.mp3',victory:'victory.mp3'};
const SYNTH={field:'town',victory:null},ONCE={victory:1}; // 沒有合成版的借哪段；只播一次的（勝利）
const bufs={},bad={};let src=null; // src＝正在播的音檔 {kind,n,g}
function load(kind){if(!ac||!musicFiles[kind]||bufs[kind]||bad[kind])return;
 bufs[kind]=fetch(new URL('../../assets/music/'+musicFiles[kind],import.meta.url)).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})
  .then(a=>ac.decodeAudioData(a)).then(x=>{bufs[kind]=x;x.edge=edges(x);if(music.on&&music.kind===kind&&!document.hidden&&ac.state==='running')playFile(kind,x);})
  .catch(()=>{bad[kind]=1;delete bufs[kind];});}
export function prefetch(kind){if(music.on)load(kind);} // 先下載下一段可能用到的（練功時先抓戰鬥、戰鬥中先抓勝利）
function want(kind){const b=bufs[kind];if(b instanceof AudioBuffer){playFile(kind,b);return;}
 const syn=kind in SYNTH?SYNTH[kind]:kind;if(syn)startNow(syn);else stopNow();load(kind);}
// mp3 頭尾會多一點編碼器補的靜音，循環時跳過（前後 0.2 秒內低於 -60dB 的）
function edges(b){const d=b.getChannelData(0),sr=b.sampleRate,lim=Math.min(d.length>>1,sr*.2|0);let s=0,e=d.length-1;
 while(s<lim&&Math.abs(d[s])<1e-3)s++;while(e>d.length-lim&&Math.abs(d[e])<1e-3)e--;return [s/sr,(e+1)/sr];}
function playFile(kind,b){if(src&&src.kind===kind)return;stopNow();const t=ac.currentTime,g=ac.createGain(),n=ac.createBufferSource(),[s0,s1]=b.edge||[0,b.duration];n.buffer=b;
 if(!ONCE[kind]){n.loop=true;n.loopStart=s0;n.loopEnd=s1;}
 g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(music.vol*1.5,t+(ONCE[kind]?.05:1));n.connect(g).connect(comp);n.start(t,s0);src={kind,n,g};}
function stopFile(){if(!src||!ac)return;const {n,g}=src,t=ac.currentTime;src=null;try{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(.0001,t+.8);n.stop(t+.9);}catch{}}
// 聲音節點在 stop 之後還會響到自然結束（最多一小節），fade 掉 master 就好
let armed=false;
function unlock(){try{ctx();if(ac.state==='suspended')ac.resume();}catch{return;}if(music.on&&music.kind&&!document.hidden)want(music.kind);}
export function setMusic(kind){music.kind=kind;if(!armed){armed=true;for(const ev of ['pointerdown','keydown','touchend'])document.addEventListener(ev,unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNow();else if(ac&&music.on&&music.kind)want(music.kind);});}
 if(!ac||ac.state!=='running')return;if(!music.on||!kind){stopNow();return;}want(kind);}
export function musicOn(v){music.on=!!v;if(!music.on)stopNow();else if(ac&&music.kind)want(music.kind);}
export const _music=()=>({ac,master,seq,src,bad,bufs}); // 測試用
