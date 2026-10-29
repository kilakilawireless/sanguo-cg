// 技能特效（Leo 2026-10-26）：畫在戰鬥畫面上，純 Canvas，不用圖檔。
// B.fx 是正在播的特效：{type, uid, t0, elem, color}；pos 是這一格各單位的位置 {x, y（腳下）, h（身高）}
import {SKILLS} from '../data/skills.mjs';
const ELEM_COLOR={fire:'#ff7a2a',water:'#5fc8ff',wind:'#7dffa8',earth:'#c89a52',none:'#c58cff'};
const KIND_COLOR={phys:'#ffd36b',magic:'#c58cff',heal:'#7dff9a',selfheal:'#7dff9a',regen:'#7dff9a',cure:'#ffffff',revive:'#ffe27a',status:'#b46bff',wall:'#ffe27a',cover:'#ffe27a',stance:'#ff6b5a'};
export const skillColor=id=>{const s=SKILLS[id];return s?.elem?ELEM_COLOR[s.elem]:KIND_COLOR[s?.kind]||'#ffffff';};
export const addFx=(B,f)=>{(B.fx||=[]).push({...f,t0:performance.now()/1000,seed:Math.random()*1000});}; // f.delay＝晚幾個 dur 才開始（飛行道具到了才爆）
// 晚一點才做的事（頓格、震屏、音效跟著飛行道具到達）
const later=(B,delay,fn)=>{(B.later||=[]).push({t0:performance.now()/1000,delay,fn});};
// 技能特效分段（Leo 2026-10-27：1／4／7／10 級要不一樣）：Lv1～3 一段、4～6 二段、7～9 三段、10 四段，越高越大、越多、越久
export const tierOf=lv=>lv>=10?4:lv>=7?3:lv>=4?2:1;
const rnd=(i,s)=>{const x=Math.sin(i*12.9898+s*78.233)*43758.5453;return x-Math.floor(x);};
const glow=(ctx,x,y,r,color,a)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');const op=ctx.globalCompositeOperation;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation=op;};
// 火舌：水滴形，底部圓、尖端朝上
const flame=(ctx,x,y,r,a,c1,c2)=>{const g=ctx.createLinearGradient(x,y+r,x,y-r*2);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.globalAlpha=Math.max(0,a);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y-r*2.2);ctx.quadraticCurveTo(x+r*1.1,y-r*.2,x,y+r);ctx.quadraticCurveTo(x-r*1.1,y-r*.2,x,y-r*2.2);ctx.fill();};

// 一支箭：木桿、鐵箭頭、兩片紅白箭羽；sink＝沒入身體幾成（插著的箭頭看不到），glowC＝技能箭的光
function arrowAt(ctx,x,y,ang,L,a,glowC,sink=0){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.globalAlpha=Math.max(0,a);const tip=L*(.5-sink),tail=-L*.5;
 if(glowC){ctx.shadowColor=glowC;ctx.shadowBlur=12;}
 ctx.strokeStyle='#5a3a1c';ctx.lineWidth=Math.max(2.2,L*.07);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(tail,0);ctx.lineTo(tip-(sink?0:L*.1),0);ctx.stroke();
 ctx.strokeStyle='#c8a46a';ctx.lineWidth=Math.max(1,L*.03);ctx.beginPath();ctx.moveTo(tail,-.5);ctx.lineTo(tip-(sink?0:L*.1),-.5);ctx.stroke();ctx.shadowBlur=0;
 if(!sink){const hl=L*.16,hw=L*.07;ctx.fillStyle='#d8dde6';ctx.strokeStyle='#4a4f58';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tip+hl*.35,0);ctx.lineTo(tip-hl*.65,-hw);ctx.lineTo(tip-hl*.45,0);ctx.lineTo(tip-hl*.65,hw);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(tip+hl*.3,0);ctx.lineTo(tip-hl*.5,-hw*.6);ctx.lineTo(tip-hl*.4,0);ctx.closePath();ctx.fill();}
 const fw=L*.26,fh=L*.09;for(const sd of [-1,1]){ctx.fillStyle=sd<0?'#c8382a':'#f2ece0';ctx.beginPath();ctx.moveTo(tail+L*.04,0);ctx.lineTo(tail+fw,sd*.6);ctx.lineTo(tail+fw*.75,sd*fh);ctx.lineTo(tail-L*.02,sd*fh*1.1);ctx.closePath();ctx.fill();}
 ctx.fillStyle='#2a1a0c';ctx.fillRect(tail-L*.03,-1.5,L*.04,3);ctx.restore();}
// 每一格先畫持續的架勢（聖盾、反擊、陽炎），再畫正在播的特效
export function drawFx(ctx,B,pos,now,speed=1){
 ctx.save();
 for(const u of B.b.units){const p=pos.get(u.uid);if(!p||!u.alive)continue;const cx=p.x,cy=p.y-p.h*.5,pulse=.5+.5*Math.sin(now*5);
  if(u.wall>0){ctx.globalAlpha=.25+.15*pulse;ctx.strokeStyle='#ffe27a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(cx,cy,p.h*.42,p.h*.55,0,0,Math.PI*2);ctx.stroke();glow(ctx,cx,cy,p.h*.5,'rgba(255,226,122,.35)',.5);}
  if(u.counterSt){glow(ctx,cx,p.y-p.h*.35,p.h*.45,'rgba(255,90,70,.55)',.35+.25*pulse);}
  if(u.haze){for(let i=0;i<3;i++){ctx.globalAlpha=.18;ctx.strokeStyle='#dff6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx+Math.sin(now*3+i*2)*6,cy,p.h*(.25+i*.08),p.h*(.45+i*.06),0,0,Math.PI*2);ctx.stroke();}}
 }
 const dur=1/speed;B.fx=(B.fx||[]).filter(f=>now-f.t0<dur*((f.long||1)+(f.delay||0)));
 B.later=(B.later||[]).filter(L=>{if(now-L.t0<L.delay*dur)return true;L.fn();return false;});
 for(const f of B.fx){const p=pos.get(f.uid);if(!p)continue;const T=f.tier||1,K=1+(T-1)*.3,q=((now-f.t0)/dur-(f.delay||0))/(f.long||1),cx=p.x,cy=p.y-p.h*.5,R=p.h*.5*K,s=f.seed,fade=1-q;if(q<0||q>=1)continue;
  switch(f.type){
   case 'bolt':{ // 飛行道具：魔法是拖著光尾的光球、弓是箭，從出手的人飛到目標
    const a=pos.get(f.from);if(!a)break;const qq=Math.min(1,q/f.len);if(qq>=1)break;const e=qq*qq*(3-2*qq),x0=a.x,y0=a.y-a.h*.55,x1=cx,y1=cy,arc=f.kind==='magic'?-Math.sin(qq*Math.PI)*p.h*.5:-Math.sin(qq*Math.PI)*p.h*.25,x=x0+(x1-x0)*e,y=y0+(y1-y0)*e+arc;
    {const n=4+T*2;for(let i=0;i<n;i++){const qb=Math.max(0,qq-i*.045),eb=qb*qb*(3-2*qb);glow(ctx,x0+(x1-x0)*eb,y0+(y1-y0)*eb-Math.sin(qb*Math.PI)*p.h*.5,R*(.32-i*.03),f.color,.9-i*.1);}glow(ctx,x,y,R*.18,'#ffffff',1);
     if(T>=3)for(let i=0;i<T;i++){const a=qq*12+i/T*Math.PI*2;glow(ctx,x+Math.cos(a)*R*.3,y+Math.sin(a)*R*.3,R*.12,f.color,.8);}}
    break;}
   case 'arrow':{ // 弓（Leo 2026-10-29「弓箭射出去要有弓箭的樣子」）：拋物線飛過去、箭頭跟著弧線轉，射中插在身上晃一下再淡掉，閃掉的飛過頭掉下去
    const a=pos.get(f.from);if(!a)break;const el=(now-f.t0)/dur-(f.dl||0);if(el<0)break;const fl=el/f.len,sgn=Math.sign(cx-a.x)||1,L=Math.max(22,p.h*.5);
    const x0=a.x+sgn*a.h*.18,y0=a.y-a.h*.58,x1=cx+(f.ox||0)*p.h,y1=cy+(f.oy||0)*p.h,hgt=Math.abs(x1-x0)*(.16+(f.arc||0)),P=t=>[x0+(x1-x0)*t,y0+(y1-y0)*t-4*hgt*t*(1-t)],ang=t=>{const[xa,ya]=P(t-.01),[xb,yb]=P(t+.01);return Math.atan2(yb-ya,xb-xa);};
    if(fl<.2)glow(ctx,x0,y0,a.h*.22,f.color||'#fff3c0',(1-fl/.2)*.8); // 放弦的一閃
    if(fl<1||f.miss){const tt=Math.min(fl,1.6);if(f.miss&&tt>1.2)break;const[x,y]=P(tt),A=ang(tt),al=f.miss&&tt>1?1-(tt-1)/.6:1;
     for(let i=1;i<=4;i++){const[xs,ys]=P(Math.max(0,tt-i*.05));glow(ctx,xs,ys,L*.18*(1-i*.15),f.color||'rgba(255,250,230,.8)',al*(.5-i*.1));} // 拖尾
     arrowAt(ctx,x,y,A,L,al,f.color);break;}
    // 插在身上：沒入三成、剛插進去抖幾下
    const st=(el-f.len)/Math.max(.3,(f.long||1)-f.len),A=ang(1)+Math.sin(st*40)*.18*Math.max(0,1-st*4);if(st>=1)break;
    arrowAt(ctx,x1,y1,A,L,st<.7?1:(1-st)/.3,null,.3);break;}
   case 'circle':{ // 施法：腳下轉動的法陣（兩圈＋刻度），顏色照屬性
    const r1=R*.95,r2=R*.7,rot=q*3+s;ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.32);ctx.globalAlpha=Math.min(1,q*6)*(q>.8?(1-q)*5:1)*.9;ctx.strokeStyle=f.color;ctx.lineWidth=2.5;ctx.shadowColor=f.color;ctx.shadowBlur=12;
    if(T>=2){ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r1*1.25,0,Math.PI*2);ctx.stroke();}if(T>=4){ctx.beginPath();for(let i=0;i<=4;i++){const a=rot*.5+i/2*Math.PI;ctx[i?'lineTo':'moveTo'](Math.cos(a)*r1*1.25,Math.sin(a)*r1*1.25);}ctx.stroke();}ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(0,0,r1,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r2,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<12;i++){const a=rot+i/12*Math.PI*2,L=i%3?r1*.1:r1*.22;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*(r1-L),Math.sin(a)*(r1-L));ctx.stroke();}
    ctx.beginPath();for(let i=0;i<=6;i++){const a=-rot*.7+i/3*Math.PI;ctx[i?'lineTo':'moveTo'](Math.cos(a)*r2,Math.sin(a)*r2);}ctx.stroke();ctx.restore();break;}
   case 'cast':{ // 腳下一圈光環往外擴，光點往上飄
    glow(ctx,p.x,p.y-p.h*.5,p.h*.7,f.color,fade*.5);ctx.globalAlpha=fade*.9;ctx.strokeStyle=f.color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,R*(.4+q),R*(.12+q*.25),0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<6+T*4;i++){const a=rnd(i,s)*Math.PI*2,r=R*.6*rnd(i+9,s);glow(ctx,p.x+Math.cos(a)*r,p.y-p.h*q*(.4+rnd(i+3,s)*.8),5,f.color,fade);}break;}
   case 'elem':{
    if(T>=3){ctx.globalAlpha=fade*.8;ctx.strokeStyle=f.elem==='fire'?'#ffb060':f.elem==='water'?'#bfeaff':f.elem==='wind'?'#bfffd0':f.elem==='earth'?'#e8c88a':'#e0b0ff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,R*(.5+q*1.3),R*(.15+q*.35),0,0,Math.PI*2);ctx.stroke();} // 三段以上：地上一圈衝擊波
    if(T>=4)glow(ctx,cx,cy,R*3,f.elem==='fire'?'rgba(255,120,40,.6)':f.elem==='water'?'rgba(120,200,255,.6)':f.elem==='wind'?'rgba(140,255,180,.5)':f.elem==='earth'?'rgba(220,170,100,.6)':'rgba(190,120,255,.6)',fade*.6); // 四段：整片光
    if(f.elem==='fire'){glow(ctx,cx,p.y-R*.6,R*1.5,'#ff6a1a',fade*.9);if(T>=3){const g=ctx.createLinearGradient(0,p.y-p.h*2*K,0,p.y);g.addColorStop(0,'rgba(255,120,20,0)');g.addColorStop(.6,'rgba(255,160,40,.7)');g.addColorStop(1,'rgba(255,230,120,.9)');ctx.globalAlpha=fade*Math.min(1,q*4);ctx.fillStyle=g;ctx.fillRect(cx-R*.3,p.y-p.h*2*K,R*.6,p.h*2*K);}
     for(let i=0;i<5+T*3;i++){const x=cx+(rnd(i,s)-.5)*R*1.5,y=p.y-R*.2-q*R*(.6+rnd(i+1,s)*.8),r=R*(.18+.18*rnd(i+4,s))*(1-q*.5)*Math.min(1,q*5);flame(ctx,x,y,r,fade,'#ffdf6a',i%3?'#ff3a10':'#ff9a20');}}
    else if(f.elem==='water'){glow(ctx,cx,cy,R*1.4,'#3fb0ff',fade);ctx.globalAlpha=fade;const nw=6+T*5;for(let i=0;i<nw;i++){const a=i/nw*Math.PI*2+s,r=R*(.1+q*1.1),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.8,L=R*.45;ctx.fillStyle=i%2?'#ffffff':'#bfeaff';ctx.beginPath();ctx.moveTo(x-Math.cos(a)*L*.3,y-Math.sin(a)*L*.3);ctx.lineTo(x+Math.cos(a+1.57)*6,y+Math.sin(a+1.57)*6);ctx.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L);ctx.lineTo(x-Math.cos(a+1.57)*6,y-Math.sin(a+1.57)*6);ctx.closePath();ctx.fill();}}
    else if(f.elem==='wind'){glow(ctx,cx,cy,R*1.2,'#6dffa0',fade*.7);ctx.lineCap='round';const nwd=3+T*2;for(let i=0;i<nwd;i++){ctx.globalAlpha=fade;ctx.strokeStyle=i%2?'#ffffff':'#7dffa8';ctx.lineWidth=Math.max(1.5,5-i*.4);ctx.beginPath();const r=R*(.25+i*.14),a0=q*10+i*1.3+s;ctx.ellipse(cx,cy-i*5*K,r,r*.55,0,a0,a0+2.4);ctx.stroke();}}
    else if(f.elem==='earth'){for(let i=0;i<3+T*3;i++){const x=cx+(rnd(i,s)-.5)*R*1.4,fall=Math.min(1,q*1.8+rnd(i+5,s)*.3),y=cy-R*1.6+fall*R*1.7;ctx.globalAlpha=fade;ctx.fillStyle=i%2?'#7a4a1b':'#c89a52';ctx.strokeStyle='#3a2410';ctx.lineWidth=2;const z=R*(.16+rnd(i+2,s)*.14);ctx.beginPath();ctx.moveTo(x-z,y);ctx.lineTo(x-z*.4,y-z);ctx.lineTo(x+z*.8,y-z*.6);ctx.lineTo(x+z,y+z*.3);ctx.lineTo(x,y+z);ctx.closePath();ctx.fill();ctx.stroke();}
     if(q>.4)glow(ctx,cx,p.y-R*.2,R*1.2,'#e0b070',fade*.8);
     if(q>.45){ctx.globalAlpha=fade;ctx.strokeStyle='#e8c88a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,R*(q*1.2),R*.2*q,0,0,Math.PI*2);ctx.stroke();}}
    else{const nd=4+T*3;for(let i=0;i<nd;i++){const a=i/nd*Math.PI*2+q*4,r=R*(.7-q*.5);glow(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,R*.25,'#b46bff',fade);}}
    break;}
   case 'wash':{ // 全體魔法：整個戰場閃一片屬性色，從上面壓下來再散掉
    const W=ctx.canvas.width,H=ctx.canvas.height,a=q<.3?q/.3:1-(q-.3)/.7;const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,f.color);g.addColorStop(1,'rgba(0,0,0,0)');
    const op=ctx.globalCompositeOperation;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,a)*(.35+.1*T);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<6+T*4;i++){const x=rnd(i,s)*W,y=(rnd(i+3,s)*.6+q*.5)*H,r=8+rnd(i+7,s)*14*K;glow(ctx,x,y,r,f.color,Math.max(0,a)*.8);}ctx.globalCompositeOperation=op;break;}
   case 'slash':{ // 兩三道交叉的刀光
    ctx.lineCap='round';const ns=1+T;for(let i=0;i<ns;i++){const a=-.9+i*(1.8/Math.max(1,ns-1))+rnd(i,s)*.3,len=R*1.3*Math.min(1,q*3),d=(rnd(i+7,s)-.5)*R*.4;
     ctx.globalAlpha=fade;ctx.strokeStyle=i%2?'#ffffff':f.color;ctx.lineWidth=(7+T*2)*fade+2;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(cx-Math.cos(a)*len/2+d,cy-Math.sin(a)*len/2);ctx.lineTo(cx+Math.cos(a)*len/2+d,cy+Math.sin(a)*len/2);ctx.stroke();}break;}
   case 'crit':{ctx.globalAlpha=fade;ctx.strokeStyle='#fff6c0';ctx.lineWidth=2;for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r1=R*.2,r2=R*(.4+q*.9)*(i%2?.6:1);ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke();}glow(ctx,cx,cy,R*.6,'#ffffff',fade*.8);break;}
   case 'heal':{ctx.fillStyle='#9dffb0';for(let i=0;i<4+T*4;i++){const x=cx+(rnd(i,s)-.5)*R*1.2,y=p.y-p.h*(q*(.6+rnd(i+1,s)*.6)),z=4+rnd(i+2,s)*4;ctx.globalAlpha=fade;ctx.fillRect(x-z,y-1.5,z*2,3);ctx.fillRect(x-1.5,y-z,3,z*2);}glow(ctx,cx,cy,R,'rgba(125,255,154,.6)',fade*.6);break;}
   case 'curse':{ctx.lineWidth=2.5;ctx.strokeStyle=f.color||'#b46bff';for(let i=0;i<2+T;i++){ctx.globalAlpha=fade;ctx.beginPath();const a0=q*8+i*2.1;ctx.ellipse(cx,cy-R*.3+i*R*.3,R*(.6-q*.3),R*.18,0,a0,a0+4);ctx.stroke();}break;}
   case 'counter':{glow(ctx,cx,cy,R*(.6+q*.6),'#ff5a46',fade);break;}
   case 'drain':{for(let i=0;i<10;i++){const x=cx+(rnd(i,s)-.5)*R,y=cy-q*R*1.4*(.5+rnd(i+1,s));glow(ctx,x,y,6,'#5fc8ff',fade);}break;}
   case 'swipe':{ // 近戰普攻：一道弧形刀光掃過目標（拳頭是三圈衝擊）；方向照出手的人在哪邊
    const a=pos.get(f.from),sgn=a?Math.sign(cx-a.x)||1:1,qq=Math.min(1,q*2.2),al=qq<.3?1:1-(qq-.3)/.7;if(al<=0)break;ctx.save();ctx.translate(cx,cy);ctx.scale(sgn,1);ctx.globalCompositeOperation='lighter';
    if(f.wt==='fist'){for(let i=0;i<3;i++){const r=R*(.2+qq*(.5+i*.2));ctx.globalAlpha=al*(1-i*.25);ctx.strokeStyle=i?'#ffd36b':'#ffffff';ctx.lineWidth=(4-i)*(1-qq)+1;ctx.beginPath();ctx.ellipse(0,0,r*.5,r,0,0,Math.PI*2);ctx.stroke();}}
    else{const thrust=f.wt==='spear'||f.wt==='dagger',r0=R*.95,a0=-2.2,a1=a0+(thrust?0:2.6)*Math.min(1,qq*2.2);
     if(thrust){const len=R*1.8*Math.min(1,qq*2.5);const g=ctx.createLinearGradient(-len,0,R*.5,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.95)');ctx.globalAlpha=al;ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-len,-R*.05);ctx.lineTo(R*.5,0);ctx.lineTo(-len,R*.05);ctx.fill();}
     else for(let i=0;i<6;i++){ctx.globalAlpha=al*(1-i*.15);ctx.strokeStyle=i?'#fff3c0':'#ffffff';ctx.lineWidth=Math.max(1,(f.wt==='axe'?12:8)*(1-i*.17)*(1-qq*.5));ctx.lineCap='round';ctx.beginPath();ctx.arc(-R*.3,0,r0,Math.max(a0,a1-.18*(i+1)-.6),a1-.18*i);ctx.stroke();}}
    ctx.restore();break;}
   case 'critburst':{ // 必殺：四周壓暗、集中線往目標收、「必殺」大字蓋章
    const W=ctx.canvas.width,H=ctx.canvas.height,la=q<.06?q/.06:Math.max(0,1-(q-.06)/.34),a=q<.6?1:(1-q)/.4;ctx.save();ctx.setTransform(1,0,0,1,0,0);const sx=ctx.canvas.width/(ctx.canvas.clientWidth||W);
    const X=cx*sx,Y=cy*sx,vg=ctx.createRadialGradient(X,Y,R*sx*.6,X,Y,Math.max(W,H)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(10,0,0,.6)');ctx.globalAlpha=la;ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,250,235,.85)';for(let i=0;i<20;i++){const an=rnd(i,s)*Math.PI*2,r1=Math.max(W,H)*(.25+rnd(i+2,s)*.2)*(1-q*.3),r2=Math.max(W,H)*.9;ctx.lineWidth=(1+rnd(i+5,s)*3)*sx;ctx.globalAlpha=la*.5;ctx.beginPath();ctx.moveTo(X+Math.cos(an)*r1,Y+Math.sin(an)*r1);ctx.lineTo(X+Math.cos(an)*r2,Y+Math.sin(an)*r2);ctx.stroke();}
    ctx.restore();
    const pop=q<.12?2.4-q/.12*1.4:1,fz=Math.max(26,p.h*.34)*pop,jit=q<.25?(rnd(Math.floor(q*60),s)-.5)*6:0;ctx.save();ctx.translate(cx+jit,cy-p.h*.25);ctx.rotate(-.12);ctx.globalAlpha=a;ctx.font=`900 ${fz}px "Noto Serif TC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.lineWidth=fz/4;ctx.strokeStyle='#3a0800';ctx.strokeText('必殺',0,0);const g=ctx.createLinearGradient(0,-fz/2,0,fz/2);g.addColorStop(0,'#fff6c0');g.addColorStop(.5,'#ffcf3a');g.addColorStop(1,'#ff7a1a');ctx.fillStyle=g;ctx.fillText('必殺',0,0);ctx.restore();break;}
   case 'whoosh':{ // 閃避：幾道往後拉的風線＋淡青色殘光
    const a=pos.get(f.from),sgn=a?Math.sign(cx-a.x)||1:1,al=1-q;ctx.lineCap='round';for(let i=0;i<5;i++){const y=cy-p.h*.3+i*p.h*.15,x=cx+sgn*p.h*(.05+q*.35)+(rnd(i,s)-.5)*p.h*.2,len=p.h*(.25+rnd(i+3,s)*.25);
     ctx.globalAlpha=al*.8;ctx.strokeStyle=i%2?'#bff4ff':'#ffffff';ctx.lineWidth=2.5-i*.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+sgn*len,y);ctx.stroke();}break;}
   case 'spark':{ // 打中的瞬間：白色衝擊圈＋往外噴的火花
    const big=f.crit?1.5:1,qq=Math.min(1,q*2.4);ctx.globalAlpha=Math.max(0,1-qq);ctx.strokeStyle='#fffbe8';ctx.lineWidth=5*(1-qq)+1;ctx.beginPath();ctx.arc(cx,cy,R*(.15+qq*.75)*big,0,Math.PI*2);ctx.stroke();
    const fa=pos.get(f.from),dirA=fa?Math.atan2(cy-(fa.y-fa.h*.5),cx-fa.x):null;ctx.lineCap='round';for(let i=0;i<(f.crit?18:12);i++){const a=dirA==null?rnd(i,s)*Math.PI*2:dirA+(rnd(i,s)-.5)*2.2,r1=R*(.1+qq*.5)*big,r2=r1+R*(.25+rnd(i+3,s)*.3)*(1-qq)*big;ctx.strokeStyle=i%3?'#ffd36b':'#ffffff';ctx.lineWidth=3*(1-qq)+.5;
     ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke();}
    glow(ctx,cx,cy,R*.7*big,f.crit?'#fff3b0':'rgba(255,240,200,.8)',(1-qq)*.9);break;}
   case 'num':{ // 傷害數字：先放大再縮回、往上飄
    const pop=q<.12?1.7-q/.12*.7:1,rise=p.h*(.15+q*.35),fz=(f.crit?34:f.kind==='miss'?18:22)*pop*(p.h/140+.4);
    ctx.globalAlpha=q<.75?1:Math.max(0,(1-q)*4);ctx.font=`900 ${fz}px "Noto Serif TC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const txt=f.kind==='heal'?`+${f.n}`:f.kind==='miss'?'閃避':''+f.n;if(f.kind==='miss')ctx.font=`italic 900 ${fz}px "Noto Serif TC",serif`;
    ctx.lineWidth=fz/5;ctx.strokeStyle='rgba(20,8,0,.85)';const nx=cx+(f.dx||0)+(f.kind==='miss'?(f.side||1)*p.h*.3*Math.min(1,q*3):0);ctx.strokeText(txt,nx,p.y-p.h-rise+p.h*.35);
    ctx.fillStyle=f.kind==='heal'?'#8dffa6':f.kind==='miss'?'#aef0ff':f.crit?'#ffd23a':'#ffffff';ctx.fillText(txt,nx,p.y-p.h-rise+p.h*.35);break;}
   case 'holy':{const g=ctx.createLinearGradient(0,p.y-p.h*1.3,0,p.y);g.addColorStop(0,'rgba(255,226,122,0)');g.addColorStop(1,'rgba(255,240,180,.9)');ctx.globalAlpha=fade;ctx.fillStyle=g;ctx.fillRect(cx-R*.35*(1-q*.5),p.y-p.h*1.3,R*.7*(1-q*.5),p.h*1.3);break;}
  }}
 ctx.restore();
}
// 打擊感（Leo 2026-10-26）：打中時頓一下（hit-stop）、畫面震動、必殺閃白、目標被打退、跳傷害數字、打擊音效
export function impact(B,e,maxHp,delay=0){
 const crit=!!e.crit,heavy=Math.min(1,e.dmg/Math.max(1,maxHp)*3);
 const hit=()=>{const now=performance.now()/1000;B.stopUntil=now+(crit?.16:.06+heavy*.06);B.stopAt=now;
  B.shake={t0:now,mag:crit?13:3+heavy*7};if(crit){B.flash=now;B.stopUntil=now+.3;B.zoom={t0:now,uid:e.d};}sfx(crit?'crit':heavy>.5?'heavy':'hit');}; // 必殺：頓久一點、鏡頭往目標推近
 if(delay)later(B,delay,hit);else hit();
 addFx(B,{type:'spark',uid:e.d,from:e.a,crit,delay});addFx(B,{type:'num',uid:e.d,n:e.dmg,crit,dx:(Math.random()-.5)*16,delay:crit?delay+.15:delay});
 if(crit)addFx(B,{type:'critburst',uid:e.d,delay,long:.9});
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
 if(e.t==='miss'){const att=B.b.units.find(x=>x.uid===e.a),sk=B.cur?.a===e.a?SKILLS[B.cur.sk]:null,arrow=att?.ranged&&(!sk||sk.kind==='phys')&&e.a!==e.d,dl=arrow?.26:0;
  if(arrow)addFx(B,{type:'arrow',uid:e.d,from:e.a,len:dl,miss:true,long:dl*1.7,color:sk?skillColor(B.cur.sk):null,ox:(Math.random()-.5)*.2,oy:(Math.random()-.5)*.3});
  const side=Math.sign((B.pos?.get(e.d)?.x||0)-(B.pos?.get(e.a)?.x||0))||1;addFx(B,{type:'num',uid:e.d,kind:'miss',side,delay:dl});addFx(B,{type:'whoosh',uid:e.d,from:e.a,delay:dl,long:.6});
  if(dl)later(B,dl,()=>sfx('miss'));else sfx('miss');}
 if(e.t==='heal'||e.t==='revive')addFx(B,{type:'num',uid:e.d,kind:'heal',n:e.n??e.hp});
 if(e.t==='poison'||e.t==='recoil')addFx(B,{type:'num',uid:e.d,n:e.dmg});
 if(e.t==='act'){const T=tierOf(e.lv||1);B.cur=e.kind==='skill'?{a:e.a,sk:e.skill,tier:T,area:SKILLS[e.skill]?.area||null,n:0}:null;if(e.kind==='skill'){const c=skillColor(e.skill);addFx(B,{type:'cast',uid:e.a,color:c,tier:T});if(SKILLS[e.skill]?.kind==='magic'||SKILLS[e.skill]?.elem)addFx(B,{type:'circle',uid:e.a,color:c,tier:T,long:1+(T-1)*.15});}return;}
 if(e.t==='hit'){const u=B.b.units.find(x=>x.uid===e.d),att=B.b.units.find(x=>x.uid===e.a),sk=!e.counter&&B.cur?.a===e.a?SKILLS[B.cur.sk]:null;
  // 魔法：光球從施法的人飛到目標才炸；弓：箭飛過去才中（Leo 2026-10-27 魔法要有特效）
  const magic=!!(e.elem||sk?.kind==='magic'),arrow=!magic&&(!sk||sk.kind==='phys')&&!e.counter&&!!att?.ranged,fly=(magic||arrow)&&att&&e.a!==e.d,delay=fly?(magic?.3:.26):0;
  const T=sk?B.cur.tier||1:1,long=1+(T-1)*.2; // 段數越高特效越大、越久
  // 範圍魔法（強力＝十字、超強＝全體，Leo 2026-10-28 問全部敵人有沒有一起被打到）：所有目標同時炸；全體的整個戰場先閃一片屬性色，十字的光球只飛向第一個目標
  const area=sk?.area&&magic?B.cur:null;if(area)area.n++;
  if(fly&&arrow)addFx(B,{type:'arrow',uid:e.d,from:e.a,len:delay,long:1.3,color:sk?skillColor(B.cur.sk):null,ox:(Math.random()-.5)*.18,oy:(Math.random()-.5)*.3,arc:sk?Math.random()*.08:0});
  else if(fly&&(!area||area.n===1&&area.area!=='all'))addFx(B,{type:'bolt',uid:e.d,from:e.a,len:delay,kind:'magic',color:ELEM_COLOR[e.elem||sk?.elem||'none'],tier:T});
  if(!magic&&!arrow&&!sk&&att&&e.a!==e.d)addFx(B,{type:'swipe',uid:e.d,from:e.a,wt:att.weaponType,long:.6}); // 普攻的刀光
  if(area&&area.n===1&&area.area==='all')addFx(B,{type:'wash',uid:e.a,color:ELEM_COLOR[e.elem||sk?.elem||'none'],tier:T,long:long+.3});
  impact(B,e,u?.maxHp||1,delay);
  if(magic)addFx(B,{type:'elem',uid:e.d,elem:e.elem||sk?.elem||'none',delay,tier:T,long});else if(sk)addFx(B,{type:'slash',uid:e.d,color:skillColor(B.cur.sk),tier:T,long:1+(T-1)*.1});
  if(e.crit)addFx(B,{type:'crit',uid:e.d,delay});return;}
 if(e.t==='heal'&&B.cur)addFx(B,{type:'heal',uid:e.d,tier:B.cur.tier||1});
 if(e.t==='status'&&e.ok)addFx(B,{type:'curse',uid:e.d,tier:B.cur?.tier||1});
 if(e.t==='counter')addFx(B,{type:'counter',uid:e.a});
 if(e.t==='mpLoss')addFx(B,{type:'drain',uid:e.d});
 if(e.t==='revive')addFx(B,{type:'holy',uid:e.d});
 if(e.t==='cure'&&e.ok)addFx(B,{type:'heal',uid:e.d});
}
