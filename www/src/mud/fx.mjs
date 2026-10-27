// 技能特效（Leo 2026-10-26）：畫在戰鬥畫面上，純 Canvas，不用圖檔。
// B.fx 是正在播的特效：{type, uid, t0, elem, color}；pos 是這一格各單位的位置 {x, y（腳下）, h（身高）}
import {SKILLS} from '../data/skills.mjs';
const ELEM_COLOR={fire:'#ff7a2a',water:'#5fc8ff',wind:'#7dffa8',earth:'#c89a52',none:'#c58cff'};
const KIND_COLOR={phys:'#ffd36b',magic:'#c58cff',heal:'#7dff9a',selfheal:'#7dff9a',regen:'#7dff9a',cure:'#ffffff',revive:'#ffe27a',status:'#b46bff',wall:'#ffe27a',cover:'#ffe27a',stance:'#ff6b5a'};
export const skillColor=id=>{const s=SKILLS[id];return s?.elem?ELEM_COLOR[s.elem]:KIND_COLOR[s?.kind]||'#ffffff';};
export const addFx=(B,f)=>{(B.fx||=[]).push({...f,t0:performance.now()/1000,seed:Math.random()*1000});}; // f.delay＝晚幾個 dur 才開始（飛行道具到了才爆）
// 晚一點才做的事（頓格、震屏、音效跟著飛行道具到達）
const later=(B,delay,fn)=>{(B.later||=[]).push({t0:performance.now()/1000,delay,fn});};
const rnd=(i,s)=>{const x=Math.sin(i*12.9898+s*78.233)*43758.5453;return x-Math.floor(x);};
const glow=(ctx,x,y,r,color,a)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');const op=ctx.globalCompositeOperation;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation=op;};
// 火舌：水滴形，底部圓、尖端朝上
const flame=(ctx,x,y,r,a,c1,c2)=>{const g=ctx.createLinearGradient(x,y+r,x,y-r*2);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y-r*2.2);ctx.quadraticCurveTo(x+r*1.1,y-r*.2,x,y+r);ctx.quadraticCurveTo(x-r*1.1,y-r*.2,x,y-r*2.2);ctx.fill();};

// 每一格先畫持續的架勢（聖盾、反擊、陽炎），再畫正在播的特效
export function drawFx(ctx,B,pos,now,speed=1){
 ctx.save();
 for(const u of B.b.units){const p=pos.get(u.uid);if(!p||!u.alive)continue;const cx=p.x,cy=p.y-p.h*.5,pulse=.5+.5*Math.sin(now*5);
  if(u.wall>0){ctx.globalAlpha=.25+.15*pulse;ctx.strokeStyle='#ffe27a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(cx,cy,p.h*.42,p.h*.55,0,0,Math.PI*2);ctx.stroke();glow(ctx,cx,cy,p.h*.5,'rgba(255,226,122,.35)',.5);}
  if(u.counterSt){glow(ctx,cx,p.y-p.h*.35,p.h*.45,'rgba(255,90,70,.55)',.35+.25*pulse);}
  if(u.haze){for(let i=0;i<3;i++){ctx.globalAlpha=.18;ctx.strokeStyle='#dff6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx+Math.sin(now*3+i*2)*6,cy,p.h*(.25+i*.08),p.h*(.45+i*.06),0,0,Math.PI*2);ctx.stroke();}}
 }
 const dur=1/speed;B.fx=(B.fx||[]).filter(f=>now-f.t0<dur*(1+(f.delay||0)));
 B.later=(B.later||[]).filter(L=>{if(now-L.t0<L.delay*dur)return true;L.fn();return false;});
 for(const f of B.fx){const p=pos.get(f.uid);if(!p)continue;const q=(now-f.t0)/dur-(f.delay||0),cx=p.x,cy=p.y-p.h*.5,R=p.h*.5,s=f.seed,fade=1-q;if(q<0)continue;
  switch(f.type){
   case 'bolt':{ // 飛行道具：魔法是拖著光尾的光球、弓是箭，從出手的人飛到目標
    const a=pos.get(f.from);if(!a)break;const qq=Math.min(1,q/f.len);if(qq>=1)break;const e=qq*qq*(3-2*qq),x0=a.x,y0=a.y-a.h*.55,x1=cx,y1=cy,arc=f.kind==='magic'?-Math.sin(qq*Math.PI)*p.h*.5:-Math.sin(qq*Math.PI)*p.h*.25,x=x0+(x1-x0)*e,y=y0+(y1-y0)*e+arc;
    if(f.kind==='arrow'){const ang=Math.atan2(y1-y0,x1-x0),L=p.h*.45;ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.globalAlpha=1;ctx.strokeStyle='#e8d8b0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-L/2,0);ctx.lineTo(L/2,0);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(L/2+4,0);ctx.lineTo(L/2-4,-3);ctx.lineTo(L/2-4,3);ctx.fill();ctx.strokeStyle='#c8382a';ctx.beginPath();ctx.moveTo(-L/2,0);ctx.lineTo(-L/2-5,-3);ctx.moveTo(-L/2,0);ctx.lineTo(-L/2-5,3);ctx.stroke();ctx.restore();}
    else{for(let i=0;i<6;i++){const qb=Math.max(0,qq-i*.05),eb=qb*qb*(3-2*qb);glow(ctx,x0+(x1-x0)*eb,y0+(y1-y0)*eb-Math.sin(qb*Math.PI)*p.h*.5,R*(.32-i*.04),f.color,.9-i*.13);}glow(ctx,x,y,R*.18,'#ffffff',1);}
    break;}
   case 'circle':{ // 施法：腳下轉動的法陣（兩圈＋刻度），顏色照屬性
    const r1=R*.95,r2=R*.7,rot=q*3+s;ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.32);ctx.globalAlpha=Math.min(1,q*6)*(q>.8?(1-q)*5:1)*.9;ctx.strokeStyle=f.color;ctx.lineWidth=2.5;ctx.shadowColor=f.color;ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(0,0,r1,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r2,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<12;i++){const a=rot+i/12*Math.PI*2,L=i%3?r1*.1:r1*.22;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*(r1-L),Math.sin(a)*(r1-L));ctx.stroke();}
    ctx.beginPath();for(let i=0;i<=6;i++){const a=-rot*.7+i/3*Math.PI;ctx[i?'lineTo':'moveTo'](Math.cos(a)*r2,Math.sin(a)*r2);}ctx.stroke();ctx.restore();break;}
   case 'cast':{ // 腳下一圈光環往外擴，光點往上飄
    glow(ctx,p.x,p.y-p.h*.5,p.h*.7,f.color,fade*.5);ctx.globalAlpha=fade*.9;ctx.strokeStyle=f.color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,R*(.4+q),R*(.12+q*.25),0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<10;i++){const a=rnd(i,s)*Math.PI*2,r=R*.6*rnd(i+9,s);glow(ctx,p.x+Math.cos(a)*r,p.y-p.h*q*(.4+rnd(i+3,s)*.8),5,f.color,fade);}break;}
   case 'elem':{
    if(f.elem==='fire'){glow(ctx,cx,p.y-R*.6,R*1.5,'#ff6a1a',fade*.9);
     for(let i=0;i<11;i++){const x=cx+(rnd(i,s)-.5)*R*1.5,y=p.y-R*.2-q*R*(.6+rnd(i+1,s)*.8),r=R*(.18+.18*rnd(i+4,s))*(1-q*.5)*Math.min(1,q*5);flame(ctx,x,y,r,fade,'#ffdf6a',i%3?'#ff3a10':'#ff9a20');}}
    else if(f.elem==='water'){glow(ctx,cx,cy,R*1.4,'#3fb0ff',fade);ctx.globalAlpha=fade;for(let i=0;i<14;i++){const a=i/14*Math.PI*2+s,r=R*(.1+q*1.1),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.8,L=R*.45;ctx.fillStyle=i%2?'#ffffff':'#bfeaff';ctx.beginPath();ctx.moveTo(x-Math.cos(a)*L*.3,y-Math.sin(a)*L*.3);ctx.lineTo(x+Math.cos(a+1.57)*6,y+Math.sin(a+1.57)*6);ctx.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L);ctx.lineTo(x-Math.cos(a+1.57)*6,y-Math.sin(a+1.57)*6);ctx.closePath();ctx.fill();}}
    else if(f.elem==='wind'){glow(ctx,cx,cy,R*1.2,'#6dffa0',fade*.7);ctx.lineCap='round';for(let i=0;i<6;i++){ctx.globalAlpha=fade;ctx.strokeStyle=i%2?'#ffffff':'#7dffa8';ctx.lineWidth=5-i*.5;ctx.beginPath();const r=R*(.25+i*.16),a0=q*10+i*1.3+s;ctx.ellipse(cx,cy-i*4,r,r*.55,0,a0,a0+2.4);ctx.stroke();}}
    else if(f.elem==='earth'){for(let i=0;i<7;i++){const x=cx+(rnd(i,s)-.5)*R*1.4,fall=Math.min(1,q*1.8+rnd(i+5,s)*.3),y=cy-R*1.6+fall*R*1.7;ctx.globalAlpha=fade;ctx.fillStyle=i%2?'#7a4a1b':'#c89a52';ctx.strokeStyle='#3a2410';ctx.lineWidth=2;const z=R*(.16+rnd(i+2,s)*.14);ctx.beginPath();ctx.moveTo(x-z,y);ctx.lineTo(x-z*.4,y-z);ctx.lineTo(x+z*.8,y-z*.6);ctx.lineTo(x+z,y+z*.3);ctx.lineTo(x,y+z);ctx.closePath();ctx.fill();ctx.stroke();}
     if(q>.4)glow(ctx,cx,p.y-R*.2,R*1.2,'#e0b070',fade*.8);
     if(q>.45){ctx.globalAlpha=fade;ctx.strokeStyle='#e8c88a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,R*(q*1.2),R*.2*q,0,0,Math.PI*2);ctx.stroke();}}
    else{for(let i=0;i<8;i++){const a=i/8*Math.PI*2+q*4,r=R*(.7-q*.5);glow(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,R*.25,'#b46bff',fade);}}
    break;}
   case 'slash':{ // 兩三道交叉的刀光
    ctx.lineCap='round';for(let i=0;i<3;i++){const a=-.9+i*.9+rnd(i,s)*.3,len=R*1.3*Math.min(1,q*3),d=(rnd(i+7,s)-.5)*R*.4;
     ctx.globalAlpha=fade;ctx.strokeStyle=i===1?'#ffffff':f.color;ctx.lineWidth=9*fade+2;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(cx-Math.cos(a)*len/2+d,cy-Math.sin(a)*len/2);ctx.lineTo(cx+Math.cos(a)*len/2+d,cy+Math.sin(a)*len/2);ctx.stroke();}break;}
   case 'crit':{ctx.globalAlpha=fade;ctx.strokeStyle='#fff6c0';ctx.lineWidth=2;for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r1=R*.2,r2=R*(.4+q*.9)*(i%2?.6:1);ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke();}glow(ctx,cx,cy,R*.6,'#ffffff',fade*.8);break;}
   case 'heal':{ctx.fillStyle='#9dffb0';for(let i=0;i<9;i++){const x=cx+(rnd(i,s)-.5)*R*1.2,y=p.y-p.h*(q*(.6+rnd(i+1,s)*.6)),z=4+rnd(i+2,s)*4;ctx.globalAlpha=fade;ctx.fillRect(x-z,y-1.5,z*2,3);ctx.fillRect(x-1.5,y-z,3,z*2);}glow(ctx,cx,cy,R,'rgba(125,255,154,.6)',fade*.6);break;}
   case 'curse':{ctx.lineWidth=2.5;ctx.strokeStyle=f.color||'#b46bff';for(let i=0;i<3;i++){ctx.globalAlpha=fade;ctx.beginPath();const a0=q*8+i*2.1;ctx.ellipse(cx,cy-R*.3+i*R*.3,R*(.6-q*.3),R*.18,0,a0,a0+4);ctx.stroke();}break;}
   case 'counter':{glow(ctx,cx,cy,R*(.6+q*.6),'#ff5a46',fade);break;}
   case 'drain':{for(let i=0;i<10;i++){const x=cx+(rnd(i,s)-.5)*R,y=cy-q*R*1.4*(.5+rnd(i+1,s));glow(ctx,x,y,6,'#5fc8ff',fade);}break;}
   case 'spark':{ // 打中的瞬間：白色衝擊圈＋往外噴的火花
    const big=f.crit?1.5:1,qq=Math.min(1,q*2.4);ctx.globalAlpha=Math.max(0,1-qq);ctx.strokeStyle='#fffbe8';ctx.lineWidth=5*(1-qq)+1;ctx.beginPath();ctx.arc(cx,cy,R*(.15+qq*.75)*big,0,Math.PI*2);ctx.stroke();
    ctx.lineCap='round';for(let i=0;i<10;i++){const a=rnd(i,s)*Math.PI*2,r1=R*(.1+qq*.5)*big,r2=r1+R*(.25+rnd(i+3,s)*.3)*(1-qq)*big;ctx.strokeStyle=i%3?'#ffd36b':'#ffffff';ctx.lineWidth=3*(1-qq)+.5;
     ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke();}
    glow(ctx,cx,cy,R*.7*big,f.crit?'#fff3b0':'rgba(255,240,200,.8)',(1-qq)*.9);break;}
   case 'num':{ // 傷害數字：先放大再縮回、往上飄
    const pop=q<.12?1.7-q/.12*.7:1,rise=p.h*(.15+q*.35),fz=(f.crit?30:f.kind==='miss'?16:22)*pop*(p.h/140+.4);
    ctx.globalAlpha=q<.75?1:Math.max(0,(1-q)*4);ctx.font=`900 ${fz}px "Noto Serif TC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const txt=f.kind==='heal'?`+${f.n}`:f.kind==='miss'?'閃避':(f.crit?'必殺 ':'')+f.n;
    ctx.lineWidth=fz/5;ctx.strokeStyle='rgba(20,8,0,.85)';ctx.strokeText(txt,cx+(f.dx||0),p.y-p.h-rise+p.h*.35);
    ctx.fillStyle=f.kind==='heal'?'#8dffa6':f.kind==='miss'?'#dfe6ee':f.crit?'#ffd23a':'#ffffff';ctx.fillText(txt,cx+(f.dx||0),p.y-p.h-rise+p.h*.35);break;}
   case 'holy':{const g=ctx.createLinearGradient(0,p.y-p.h*1.3,0,p.y);g.addColorStop(0,'rgba(255,226,122,0)');g.addColorStop(1,'rgba(255,240,180,.9)');ctx.globalAlpha=fade;ctx.fillStyle=g;ctx.fillRect(cx-R*.35*(1-q*.5),p.y-p.h*1.3,R*.7*(1-q*.5),p.h*1.3);break;}
  }}
 ctx.restore();
}
// 打擊感（Leo 2026-10-26）：打中時頓一下（hit-stop）、畫面震動、必殺閃白、目標被打退、跳傷害數字、打擊音效
export function impact(B,e,maxHp,delay=0){
 const crit=!!e.crit,heavy=Math.min(1,e.dmg/Math.max(1,maxHp)*3);
 const hit=()=>{const now=performance.now()/1000;B.stopUntil=now+(crit?.16:.06+heavy*.06);B.stopAt=now;
  B.shake={t0:now,mag:crit?11:3+heavy*7};if(crit)B.flash=now;sfx(crit?'crit':heavy>.5?'heavy':'hit');};
 if(delay)later(B,delay,hit);else hit();
 addFx(B,{type:'spark',uid:e.d,crit,delay});addFx(B,{type:'num',uid:e.d,n:e.dmg,crit,dx:(Math.random()-.5)*16,delay});
}
// 打擊音效：WebAudio 現場合成（低頻悶響＋雜訊爆裂），不用音檔；第一次出聲在玩家按過按鈕之後
let ac=null,noiseBuf=null;
export const sfxOn={v:true};
function sfx(kind){
 if(!sfxOn.v)return;try{
  ac||=new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();const t=ac.currentTime,out=ac.createGain();out.gain.value=.5;out.connect(ac.destination);
  if(!noiseBuf){noiseBuf=ac.createBuffer(1,ac.sampleRate*.3,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);}
  if(kind==='miss'){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noiseBuf;f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(600,t);f.frequency.exponentialRampToValueAtTime(3000,t+.18);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5,t+.04);g.gain.exponentialRampToValueAtTime(.0001,t+.2);n.connect(f).connect(g).connect(out);n.start(t);n.stop(t+.22);return;}
  const big=kind==='crit'?1.6:kind==='heavy'?1.25:1;
  // 低頻：往下掉的正弦波＝肉被打到的悶響
  const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.setValueAtTime(150*big,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);
  og.gain.setValueAtTime(.9*big,t);og.gain.exponentialRampToValueAtTime(.0001,t+.2*big);o.connect(og).connect(out);o.start(t);o.stop(t+.3*big);
  // 雜訊：拳頭打下去的「啪」
  const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noiseBuf;f.type='lowpass';f.frequency.value=kind==='crit'?5200:2600;
  g.gain.setValueAtTime(.8*big,t);g.gain.exponentialRampToValueAtTime(.0001,t+.09*big);n.connect(f).connect(g).connect(out);n.start(t);n.stop(t+.15*big);
  if(kind==='crit'){const c=ac.createOscillator(),cg=ac.createGain();c.type='square';c.frequency.setValueAtTime(1800,t);c.frequency.exponentialRampToValueAtTime(600,t+.08);cg.gain.setValueAtTime(.15,t);cg.gain.exponentialRampToValueAtTime(.0001,t+.1);c.connect(cg).connect(out);c.start(t);c.stop(t+.12);}
 }catch{}
}
// 戰鬥事件 → 特效
export function fxFromEvent(B,e){
 if(e.t==='miss'){addFx(B,{type:'num',uid:e.d,kind:'miss'});sfx('miss');}
 if(e.t==='heal'||e.t==='revive')addFx(B,{type:'num',uid:e.d,kind:'heal',n:e.n??e.hp});
 if(e.t==='poison'||e.t==='recoil')addFx(B,{type:'num',uid:e.d,n:e.dmg});
 if(e.t==='act'){B.cur=e.kind==='skill'?{a:e.a,sk:e.skill}:null;if(e.kind==='skill'){const c=skillColor(e.skill);addFx(B,{type:'cast',uid:e.a,color:c});if(SKILLS[e.skill]?.kind==='magic'||SKILLS[e.skill]?.elem)addFx(B,{type:'circle',uid:e.a,color:c});}return;}
 if(e.t==='hit'){const u=B.b.units.find(x=>x.uid===e.d),att=B.b.units.find(x=>x.uid===e.a),sk=!e.counter&&B.cur?.a===e.a?SKILLS[B.cur.sk]:null;
  // 魔法：光球從施法的人飛到目標才炸；弓：箭飛過去才中（Leo 2026-10-27 魔法要有特效）
  const magic=!!(e.elem||sk?.kind==='magic'),arrow=!magic&&!sk&&!e.counter&&!!att?.ranged,fly=(magic||arrow)&&att&&e.a!==e.d,delay=fly?(magic?.3:.22):0;
  if(fly)addFx(B,{type:'bolt',uid:e.d,from:e.a,len:delay,kind:magic?'magic':'arrow',color:magic?ELEM_COLOR[e.elem||sk?.elem||'none']:'#e8d8b0'});
  impact(B,e,u?.maxHp||1,delay);
  if(magic)addFx(B,{type:'elem',uid:e.d,elem:e.elem||sk?.elem||'none',delay});else if(sk)addFx(B,{type:'slash',uid:e.d,color:skillColor(B.cur.sk)});
  if(e.crit)addFx(B,{type:'crit',uid:e.d,delay});return;}
 if(e.t==='heal'&&B.cur)addFx(B,{type:'heal',uid:e.d});
 if(e.t==='status'&&e.ok)addFx(B,{type:'curse',uid:e.d});
 if(e.t==='counter')addFx(B,{type:'counter',uid:e.a});
 if(e.t==='mpLoss')addFx(B,{type:'drain',uid:e.d});
 if(e.t==='revive')addFx(B,{type:'holy',uid:e.d});
 if(e.t==='cure'&&e.ok)addFx(B,{type:'heal',uid:e.d});
}
