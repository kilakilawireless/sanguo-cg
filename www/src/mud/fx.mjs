// 技能特效（Leo 2026-10-26）：畫在戰鬥畫面上，純 Canvas，不用圖檔。
// B.fx 是正在播的特效：{type, uid, t0, elem, color}；pos 是這一格各單位的位置 {x, y（腳下）, h（身高）}
import {SKILLS} from '../data/skills.mjs';
const ELEM_COLOR={fire:'#ff7a2a',water:'#5fc8ff',wind:'#7dffa8',earth:'#c89a52',none:'#c58cff'};
const KIND_COLOR={phys:'#ffd36b',magic:'#c58cff',heal:'#7dff9a',selfheal:'#7dff9a',regen:'#7dff9a',cure:'#ffffff',revive:'#ffe27a',status:'#b46bff',wall:'#ffe27a',cover:'#ffe27a',stance:'#ff6b5a'};
export const skillColor=id=>{const s=SKILLS[id];return s?.elem?ELEM_COLOR[s.elem]:KIND_COLOR[s?.kind]||'#ffffff';};
export const addFx=(B,f)=>{(B.fx||=[]).push({...f,t0:performance.now()/1000,seed:Math.random()*1000});};
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
 const dur=1/speed;B.fx=(B.fx||[]).filter(f=>now-f.t0<dur);
 for(const f of B.fx){const p=pos.get(f.uid);if(!p)continue;const q=(now-f.t0)/dur,cx=p.x,cy=p.y-p.h*.5,R=p.h*.5,s=f.seed,fade=1-q;
  switch(f.type){
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
   case 'holy':{const g=ctx.createLinearGradient(0,p.y-p.h*1.3,0,p.y);g.addColorStop(0,'rgba(255,226,122,0)');g.addColorStop(1,'rgba(255,240,180,.9)');ctx.globalAlpha=fade;ctx.fillStyle=g;ctx.fillRect(cx-R*.35*(1-q*.5),p.y-p.h*1.3,R*.7*(1-q*.5),p.h*1.3);break;}
  }}
 ctx.restore();
}
// 戰鬥事件 → 特效
export function fxFromEvent(B,e){
 if(e.t==='act'){B.cur=e.kind==='skill'?{a:e.a,sk:e.skill}:null;if(e.kind==='skill')addFx(B,{type:'cast',uid:e.a,color:skillColor(e.skill)});return;}
 if(e.t==='hit'){const sk=!e.counter&&B.cur?.a===e.a?SKILLS[B.cur.sk]:null;
  if(e.elem||sk?.kind==='magic')addFx(B,{type:'elem',uid:e.d,elem:e.elem||sk?.elem||'none'});else if(sk)addFx(B,{type:'slash',uid:e.d,color:skillColor(B.cur.sk)});
  if(e.crit)addFx(B,{type:'crit',uid:e.d});return;}
 if(e.t==='heal'&&B.cur)addFx(B,{type:'heal',uid:e.d});
 if(e.t==='status'&&e.ok)addFx(B,{type:'curse',uid:e.d});
 if(e.t==='counter')addFx(B,{type:'counter',uid:e.a});
 if(e.t==='mpLoss')addFx(B,{type:'drain',uid:e.d});
 if(e.t==='revive')addFx(B,{type:'holy',uid:e.d});
 if(e.t==='cure'&&e.ok)addFx(B,{type:'heal',uid:e.d});
}
