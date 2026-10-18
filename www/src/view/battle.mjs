// 戰鬥畫面：左邊敵方、右邊我方，各分前後兩排五格（照原作）。
// 規則都在 core/battle.mjs；這裡只負責下指令、照事件清單播動畫。速度 1x/2x/3x 只改播放快慢（戰鬥時鐘），結果完全一樣。
// 自動戰鬥：重複上一回合的指令（技能魔力不夠時核心會改成普攻）；沒有上一回合就普攻。
import {h,mount,modal,toast} from './ui.mjs';
import {G,save} from '../game.mjs';
import * as P from '../core/player.mjs';
import {createBattle,resolveRound,rewards,actionsOf,allies,foes} from '../core/battle.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS} from '../data/items.mjs';
import {drawMotion,hasAction,loadMotion} from '../motion.mjs';
import {drawVfx,createVfxBank,VFX} from '../vfx.mjs';
import {WEAPON_ART} from '../data/looks.mjs';
import {bank} from './ui.mjs';
import {officerGainExp} from '../core/officer.mjs';
import {OFFICERS} from '../data/officers.mjs';

const SLOT_ORDER=[2,1,3,0,4];
const ELEM_COLOR={earth:'#c9a25a',water:'#5fb4ff',fire:'#ff7a3a',wind:'#8ee08a'};
let vbank=null;

export function showBattle({enemies,canEscape=true,scene='forest'}){
 vbank||=createVfxBank();
 return new Promise(resolve=>{
  const p=G.p,b=createBattle({party:P.partyUnits(p),enemies,seed:(Math.random()*2**31)>>>0,canEscape});
  loadMotion(b.units.map(u=>u.art)).catch(()=>{});
  const img=new Image();img.src=`./assets/scenes/${scene}.webp`;
  // 每個單位的畫面狀態
  // 橫向：敵左我右；直向（手機直拿）：照原作斜對角，敵在左上、我方在右下
  const view=new Map();let W=960,H=540,portrait=false;
  function layout(){
   for(const u of b.units){
    const ds=SLOT_ORDER[u.slot%5],enemy=u.side==='enemy',front=u.row==='front';let x,y;
    if(portrait){x=50+ds*80+(enemy?-15:15);y=enemy?(front?340:215)-ds*16+40:(front?545:665)-ds*16+40;}
    else{x=enemy?(front?380:210)-(ds-2)*20:(front?590:790)+(ds-2)*20;y=168+ds*74;}
    const v=view.get(u.uid);if(v){if(!v.tw&&v.x===v.hx&&v.y===v.hy){v.x=x;v.y=y;}v.hx=x;v.hy=y;}else view.set(u.uid,{hx:x,hy:y,x,y,act:'idle',t0:0,tw:null,alpha:1});
   }
  }
  layout();
  const floats=[],fx=[];let clock=0,banner=null,waits=[],last=performance.now(),over=false;
  const S=()=>p.settings.speed||1;
  const wait=ms=>new Promise(r=>waits.push({at:clock+ms/1000,r}));
  const U=id=>b.units.find(u=>u.uid===id),V=id=>view.get(id);
  const setAct=(id,act)=>{const v=V(id),u=U(id);v.act=hasAction(u.art,act)?act:(act==='hit'||act==='dodge'?'parry':'idle');if(!hasAction(u.art,v.act))v.act='idle';v.t0=clock;};
  const tween=(id,x,y,ms)=>{const v=V(id);v.tw={fx:v.x,fy:v.y,tx:x,ty:y,t0:clock,d:ms/1000};return wait(ms);};
  const float=(id,text,color='#fff',big=false)=>{const v=V(id);floats.push({x:v.x,y:v.y-(U(id).h||90)-10,text,color,t0:clock,big});};
  const effect=(key,id,{color=null,scale=.5}={})=>{const v=V(id);fx.push({key,x:v.x,y:v.y-(U(id).h||90)*.5,t0:clock,color,scale});};

  // 畫面
  const cv=h('canvas',{width:W,height:H}),ctx=cv.getContext('2d');
  const cmd=h('div',{class:'cmd'}),topbar=h('div',{class:'float top'});
  const root=h('div',{class:'screen'},h('div',{class:'stage'},cv,topbar),cmd);
  function drawTop(){
   topbar.replaceChildren(h('b',{class:'gold'},`第 ${Math.max(1,b.round+(over?0:1))} 回合`),h('span',{class:'grow'}),
    h('button',{class:p.settings.auto?'on':'',onclick:()=>{p.settings.auto=!p.settings.auto;save();drawTop();if(p.settings.auto&&phase==='cmd')autoCommands();}},'自動'),
    h('button',{class:S()>1?'on':'',onclick:()=>{p.settings.speed=S()%3+1;save();drawTop();}},`${S()}x`));
  }
  function render(now){
   if(!cv.isConnected)return;const dt=Math.min(.1,(now-last)/1000);last=now;clock+=dt*S();
   for(const w of waits.splice(0))if(clock>=w.at)w.r();else waits.push(w);
   // 畫布照容器比例縮放，保持 16:9 的邏輯座標
   const cw=cv.clientWidth,ch=cv.clientHeight,dpr=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);}
   const tall=cv.height>cv.width*1.1;if(tall!==portrait){portrait=tall;W=tall?420:960;H=tall?740:540;layout();}
   const k=Math.min(cv.width/W,cv.height/H);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
   if(img.complete&&img.naturalWidth){const s=Math.max(cv.width/img.naturalWidth,cv.height/img.naturalHeight);ctx.globalAlpha=.75;ctx.drawImage(img,(cv.width-img.naturalWidth*s)/2,(cv.height-img.naturalHeight*s)/2,img.naturalWidth*s,img.naturalHeight*s);ctx.globalAlpha=1;}
   ctx.setTransform(k,0,0,k,(cv.width-W*k)/2,(cv.height-H*k)/2);cv._k=k;
   const list=[...b.units].sort((a,c)=>V(a.uid).y-V(c.uid).y);
   for(const u of list){const v=V(u.uid);
    if(v.tw){const q=Math.min(1,(clock-v.tw.t0)/v.tw.d);v.x=v.tw.fx+(v.tw.tx-v.tw.fx)*q;v.y=v.tw.fy+(v.tw.ty-v.tw.fy)*q;if(q>=1)v.tw=null;}
    if(!u.alive&&u.side==='enemy')v.alpha=Math.max(0,v.alpha-dt*S()*1.2);if(v.alpha<=0)continue;
    // 單次動作播完回到待機（倒下的保持倒地）
    const oneShot=!['idle','walk','run','critical'].includes(v.act);if(oneShot&&clock-v.t0>.6&&v.act!=='defeat')v.act=u.alive?(u.hp/u.maxHp<.25&&hasAction(u.art,'critical')?'critical':'idle'):'defeat';
    ctx.save();ctx.globalAlpha=v.alpha;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(v.x,v.y,u.h*.32,u.h*.09,0,0,7);ctx.fill();
    drawMotion(ctx,bank(),u.art,v.act,clock-v.t0,{x:v.x,y:v.y,height:u.h,facing:u.side==='enemy'?'front-right':(portrait?'back-left':'front-left'),weapon:u.kind==='player'?WEAPON_ART[u.weaponType]||null:null});
    ctx.restore();
    // 名字與血條：原作看不到敵人的血，只顯示名字
    if(target&&u.side==='enemy'&&u.alive){ctx.strokeStyle='#ffd75a';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.ellipse(v.hx,v.hy,u.h*.4,u.h*.12,0,0,7);ctx.stroke();ctx.setLineDash([]);}
   }
   // 第二輪才畫名字和血條，疊在所有人物上面，不會被後面的人蓋住
   for(const u of list){const v=V(u.uid);if(v.alpha<=0)continue;ctx.globalAlpha=v.alpha;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';
    if(u.side==='enemy'){ctx.font='bold 12px serif';const t=`${u.name} Lv${u.lv}`;ctx.strokeText(t,v.hx,v.hy+18);ctx.fillStyle='#ffd9a0';ctx.fillText(t,v.hx,v.hy+18);}
    else{const bw=72,bx=v.hx-bw/2;ctx.fillStyle='#000b';ctx.fillRect(bx,v.hy+6,bw,11);ctx.fillStyle='#c8463a';ctx.fillRect(bx+1,v.hy+7,(bw-2)*u.hp/u.maxHp,4);ctx.fillStyle='#4f9ee8';ctx.fillRect(bx+1,v.hy+12,(bw-2)*u.mp/Math.max(1,u.maxMp),4);
     ctx.font='bold 12px serif';const t=`${u.name} ${u.hp}/${u.mp}`;ctx.strokeText(t,v.hx,v.hy+30);ctx.fillStyle=u.kind==='player'?'#bfe6ff':'#d8f0c8';ctx.fillText(t,v.hx,v.hy+30);}
    ctx.globalAlpha=1;}
   for(let i=fx.length-1;i>=0;i--){const f=fx[i],d=VFX[f.key],n=Math.floor((clock-f.t0)*d.fps);if(n>=d.n){fx.splice(i,1);continue;}drawVfx(ctx,vbank,f.key,n,{x:f.x,y:f.y,scale:f.scale,color:f.color});}
   for(let i=floats.length-1;i>=0;i--){const f=floats[i],a=clock-f.t0;if(a>1){floats.splice(i,1);continue;}
    ctx.globalAlpha=Math.min(1,2-a*2);ctx.font=`bold ${f.big?30:24}px serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#000';ctx.strokeText(f.text,f.x,f.y-a*30);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-a*30);ctx.globalAlpha=1;}
   if(banner&&clock-banner.t0<1){ctx.font='bold 26px serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#000';ctx.strokeText(banner.text,W/2,portrait?120:70);ctx.fillStyle='#f2d48a';ctx.fillText(banner.text,W/2,portrait?120:70);}
   requestAnimationFrame(render);
  }

  // 播事件
  async function play(ev){
   let cur=null,curAct=null,counter=false;
   const home=async id=>{const v=V(id);if(v.x!==v.hx||v.y!==v.hy){if(U(id).alive)setAct(id,hasAction(U(id).art,'run')?'run':'walk');await tween(id,v.hx,v.hy,200);if(U(id).alive)setAct(id,'idle');}};
   for(const e of ev){
    if(e.t==='round')continue;
    if(e.t==='act'){if(cur&&cur!==e.a)await home(cur);cur=e.a;curAct=e;
     if(e.kind==='skill'){float(e.a,e.name+(e.lv?` Lv${e.lv}`:''),'#f2d48a');await wait(380);}
     else if(e.kind==='item'){float(e.a,e.name,'#bfe6ff');await wait(300);}
     else if(e.kind==='defend'){float(e.a,'防禦','#bfe6ff');setAct(e.a,'parry');await wait(300);}
     continue;}
    if(e.t==='counter'){counter=true;float(e.a,'反擊','#ffb46a');await wait(150);continue;}
    if(e.t==='hit'||e.t==='miss'){
     const sk=curAct?.kind==='skill'?SKILLS[curAct.skill]:null,magic=!!e.elem,melee=!counter&&!magic&&!(curAct?.ranged)&&!(sk&&!sk.melee);
     if(melee&&U(e.a).alive){const d=V(e.d);setAct(e.a,hasAction(U(e.a).art,'run')?'run':'walk');await tween(e.a,portrait?d.hx+(U(e.d).side==='enemy'?30:-30):d.hx+(U(e.d).side==='enemy'?70:-70),portrait?d.hy+(U(e.d).side==='enemy'?60:-60):d.hy,180);}
     setAct(e.a,magic&&hasAction(U(e.a).art,'special')?'special':'attack');await wait(magic?350:200);
     if(e.t==='hit'){setAct(e.d,'hit');
      if(magic)effect(e.elem==='fire'?'V23':'V02',e.d,{color:ELEM_COLOR[e.elem],scale:e.elem==='fire'?.35:.45});else effect(e.crit?'V02':'V01',e.d,{scale:e.crit?.5:.6});
      float(e.d,String(e.dmg),e.crit?'#ffd75a':'#ffffff',e.crit);if(e.crit)float(e.a,'必殺！','#ffd75a');}
     else{setAct(e.d,'dodge');float(e.d,'Miss','#bbbbbb');}
     await wait(330);if(counter){counter=false;}
     continue;}
    if(e.t==='die'){setAct(e.d,'defeat');await wait(350);continue;}
    if(e.t==='heal'){effect('V09',e.d,{scale:.6});float(e.d,'+'+e.n,'#8fe39b');await wait(450);continue;}
    if(e.t==='mp'){float(e.d,'+'+e.n,'#7fc4ff');await wait(300);continue;}
    if(e.t==='revive'){V(e.d).alpha=1;setAct(e.d,'idle');float(e.d,'復活','#8fe39b');await wait(400);continue;}
    if(e.t==='escape'){float(e.a,e.ok?'逃走了':'逃跑失敗',e.ok?'#bfe6ff':'#ff8a7a');if(e.ok){setAct(e.a,'run');await tween(e.a,W+80,V(e.a).y,500);}else await wait(500);continue;}
    if(e.t==='msg'){banner={text:e.text,t0:clock};await wait(500);continue;}
   }
   if(cur)await home(cur);
  }

  // 下指令
  let phase='cmd',cmds=[],target=null;
  const me=()=>allies(b).find(u=>u.kind==='player');
  const useItem=id=>P.removeItem(p,id);
  function clean(c){return {kind:c.kind,skill:c.skill,item:c.item,target:c.target};}
  function autoCommands(){
   const n=actionsOf(b,me()),base=p.lastCmds?.length?p.lastCmds:[{kind:'attack'}];
   cmds=Array.from({length:n},(_,i)=>{const c={...(base[i]||base[0]),actor:'p',useItem};
    if(c.kind==='item'&&!P.countItem(p,c.item))c.kind='attack';
    if(c.kind==='skill'&&!P.skillOf(p,c.skill))c.kind='attack';
    if(c.target&&!U(c.target)?.alive)c.target=null;return c;});
   runRound();
  }
  function drawCmd(){
   if(phase!=='cmd'){cmd.replaceChildren(h('div',{class:'hint'},over?'':'……'));return;}
   const n=actionsOf(b,me()),i=cmds.length,m=me();
   if(target){cmd.replaceChildren(h('div',{class:'hint'},target.hint),h('div',{class:'list'},...target.list.map(u=>h('button',{onclick:()=>pick(u.uid)},`${u.name}${u.side==='ally'?` ${u.hp}/${u.maxHp}`:` Lv${u.lv}`}`)),h('button',{onclick:()=>{target=null;drawCmd();}},'取消')));return;}
   cmd.replaceChildren(h('div',{class:'row'},h('span',{class:'hint grow'},`${m.name} 第 ${i+1}／${n} 次行動`),i?h('button',{class:'small',onclick:()=>{cmds.pop();drawCmd();}},'重選上一個'):null),
    h('div',{class:'btns'},
     h('button',{class:'primary',onclick:()=>askTarget({kind:'attack'},'enemy')},'攻擊'),
     h('button',{disabled:!m.skills.length,onclick:skillMenu},'技能'),
     h('button',{onclick:()=>push({kind:'defend'})},'防禦'),
     h('button',{onclick:itemMenu},'道具'),
     h('button',{disabled:!b.canEscape,onclick:()=>{while(cmds.length<n)cmds.push({actor:'p',kind:cmds.length===i?'escape':'skip'});runRound();}},'逃跑')));
  }
  function askTarget(c,side){
   const list=side==='enemy'?foes(b).filter(u=>u.alive):side==='dead'?allies(b).filter(u=>!u.alive):allies(b).filter(u=>u.alive);
   if(side!=='enemy'&&list.length===1)return push({...c,target:list[0].uid});
   if(!list.length){toast('沒有可以選的對象');return;}
   target={c,list,hint:side==='enemy'?'選擇目標（也可以直接點畫面上的敵人）':'選擇對象'};drawCmd();
  }
  function pick(uid){const c=target.c;target=null;push({...c,target:uid});}
  function push(c){cmds.push({...c,actor:'p',useItem});if(cmds.length>=actionsOf(b,me()))runRound();else drawCmd();}
  async function skillMenu(){
   const m=me();const list=h('div',{class:'opts'},...m.skills.map(s=>{const d=SKILLS[s.id],cost=d.mp(s.lv);
    return h('button',{disabled:m.mp<cost,onclick:()=>{dlg.close();askTarget({kind:'skill',skill:s.id},d.target);}},`${d.name} Lv${s.lv}　耗魔 ${cost}`,h('small',{},d.desc(s.lv)));}));
   const dlg=modal('技能',list);
  }
  function itemMenu(){
   const usable=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id].battle);
   const list=h('div',{class:'opts'},usable.length?null:h('div',{class:'muted'},'沒有戰鬥中能用的道具。'),...usable.map(x=>h('button',{onclick:()=>{dlg.close();askTarget({kind:'item',item:x.id},'ally');}},`${ITEMS[x.id].name} ×${x.n}`,h('small',{},ITEMS[x.id].desc))));
   const dlg=modal('道具',list);
  }
  cv.addEventListener('click',e=>{
   if(!target||target.list[0]?.side!=='enemy')return;const r=cv.getBoundingClientRect(),k=cv._k||1,ox=(cv.width-W*k)/2,oy=(cv.height-H*k)/2,dpr=cv.width/r.width;
   const x=((e.clientX-r.left)*dpr-ox)/k,y=((e.clientY-r.top)*dpr-oy)/k;
   let best=null,bd=1e9;for(const u of target.list){const v=V(u.uid),d=Math.hypot(v.hx-x,v.hy-u.h*.5-y);if(d<bd&&d<u.h*.7){bd=d;best=u;}}
   if(best)pick(best.uid);
  });

  async function runRound(){
   if(cmds.some(c=>c.kind!=='escape'&&c.kind!=='skip'))p.lastCmds=cmds.map(clean);
   phase='play';drawCmd();const ev=resolveRound(b,cmds);cmds=[];drawTop();
   await play(ev);
   if(b.over)return finish();
   phase='cmd';drawTop();
   if(!me().alive){await wait(150);cmds=[];return runRound();}
   if(p.settings.auto){await wait(150);autoCommands();}else drawCmd();
  }

  async function finish(){
   over=true;phase='end';drawCmd();const m=me();
   p.hp=Math.max(b.over==='win'?1:0,m.hp);p.mp=m.mp;P.syncParty(p,allies(b));
   if(b.over==='lose'){banner={text:'全軍覆沒……',t0:clock};await wait(1200);save();return resolve('lose');}
   if(b.over==='escaped'){save();await wait(300);return resolve('escaped');}
   const r=rewards(b,p),lines=[];
   const ups=P.gainExp(p,r.exp);lines.push(`經驗 +${r.exp}`);if(ups.length)lines.push(`升到 ${p.lv} 級！得到 ${ups.length*4} 點可以分配（在狀態裡加點）。`);
   const got=[],lost=[];for(const id of r.items)(P.addItem(p,id)?got:lost).push(ITEMS[id].name);
   if(got.length)lines.push(`得到 ${got.join('、')}`);if(lost.length)lines.push(`道具欄滿了，丟下 ${lost.join('、')}`);
   for(const [id,n] of Object.entries(r.officerExp||{})){const o=p.officers[id];if(o&&officerGainExp(o,n))lines.push(`${OFFICERS[id].name}升到 ${o.lv} 級！`);}
   for(const [id,n] of Object.entries(r.skillGain)){const up=P.addSkillExp(p,id,n);if(up)lines.push(`${SKILLS[id].name}升到 Lv${up}！`);}
   if(p.job!=='none'){const g=P.gainRep(p,r.rep);lines.push(g?`聲望 +${g}`:'今天的聲望已經拿滿了');}
   save();
   const box=h('div',{class:'col'},...lines.map(t=>h('div',{},t)));
   if(p.settings.auto&&!ups.length){cmd.replaceChildren(h('div',{class:'hint'},'勝利！'),box);await wait(900);return resolve('win');}
   cmd.replaceChildren(h('div',{class:'hint'},'勝利！'),box,h('button',{class:'primary',onclick:()=>resolve('win')},'繼續'));
  }

  mount(root);drawTop();requestAnimationFrame(render);
  if(p.settings.auto)wait(300).then(autoCommands);else drawCmd();
 });
}
