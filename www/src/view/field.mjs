// 大地圖（點了就到）與野外、洞窟的「模擬行走」：角色自己往前走，走 5～7 秒隨機遇敵（Leo 2026-10-18）。
// 洞窟每層走路累積探索度，滿 100% 就找到往下的樓梯；頭目層滿了就能挑戰頭目。
import {h,mount,toast,talk,bar,choose} from './ui.mjs';
import {G,go,save,hud} from '../game.mjs';
import {openStatus} from './status.mjs';
import {PLACES,PLACE_ORDER,ROADS,TOWNS} from '../data/places.mjs';
import {ITEMS} from '../data/items.mjs';
import {MONSTERS} from '../data/monsters.mjs';
import {SKILLS} from '../data/skills.mjs';
import * as P from '../core/player.mjs';
import {drawMotion,hasAction,preloadMotion} from '../motion.mjs';
import {bank} from './ui.mjs';

export function lockReason(p,id){
 const pl=PLACES[id];
 if(pl.need&&!P.countItem(p,pl.need))return `要有${ITEMS[pl.need].name}`;
 if(pl.needJob&&p.job==='none')return '要先就職';
 if(pl.needRank&&p.rank<pl.needRank)return '要先晉級正職';
 if(pl.needFlag&&!p.flags[pl.needFlag])return `要先打下${PLACES[Object.keys(PLACES).find(k=>PLACES[k].flag===pl.needFlag)].name}`;
 if(pl.needLv&&p.lv<pl.needLv)return `要 ${pl.needLv} 級`;
 return null;
}

export function showMap(){
 const p=G.p;
 // 還沒打通的地方不顯示（照原作，地圖是走過才知道）
 const seen=id=>!PLACES[id].needFlag||p.flags[PLACES[id].needFlag];
 const svg=`<svg viewBox="0 0 100 100" preserveAspectRatio="none">${ROADS.filter(r=>r.every(seen)).map(([a,b])=>`<line x1="${PLACES[a].x*100}" y1="${PLACES[a].y*100}" x2="${PLACES[b].x*100}" y2="${PLACES[b].y*100}" stroke="rgba(214,168,74,.45)" stroke-width=".6" stroke-dasharray="2 1.5"/>`).join('')}</svg>`;
 const nodes=PLACE_ORDER.filter(seen).map(id=>{const pl=PLACES[id],lock=lockReason(p,id);
  const town=TOWNS.includes(id);return h('button',{class:'node'+(town?' primary':''),style:{left:pl.x*100+'%',top:pl.y*100+'%'},disabled:!!lock,onclick:()=>town?go.town(id):enter(id)},
   pl.name,h('small',{},lock||(pl.lv?`Lv${pl.lv[0]}～${pl.lv[1]}`+(pl.flag&&p.flags[pl.flag]?'・已平定':''):'城鎮')));});
 go.refresh=showMap;mount(h('div',{class:'screen bg',style:{'--bg':'url(./assets/scenes/snow.webp)'}},hud(h('button',{onclick:()=>openStatus('stat',showMap)},'狀態')),
  h('div',{class:'place-title'},h('h2',{},'法蘭王國'),h('span',{class:'small muted'},'點地名直接前往。')),
  h('div',{class:'map',html:svg},...nodes)));
}

function enter(id){const p=G.p;p.dungeon={place:id,floor:1,explore:0};save();go.field();}

function rollGroup(pl,floor){
 const [a,b]=pl.groups,n=a+Math.floor(Math.random()*(b-a+1)),list=pl.floorMons?pl.floorMons(floor):pl.mons,tot=list.reduce((s,x)=>s+x[1],0);
 const lo=pl.lv[0]+(pl.floors?Math.floor((floor-1)*(pl.lv[1]-pl.lv[0])/Math.max(1,pl.floors-1)):0),hi=Math.min(pl.lv[1],lo+2);
 return Array.from({length:n},()=>{let r=Math.random()*tot,m=list[0][0];for(const [id,w] of list){if((r-=w)<0){m=id;break;}}return [m,lo+Math.floor(Math.random()*(hi-lo+1))];});
}
// 遇敵：走 5～7 秒（平均 6 秒）隨機遇一次（Leo 2026-10-18 從 8 秒改成 6 秒）
const ENCOUNTER=()=>5+Math.random()*2;
const EXPLORE_PER_SEC=100/18; // ◎ 一層大約遇三次敵就走完
const GATHER_SEC=3; // ◎ 採集一次 3 秒；採集時一樣會遇敵（照原作）

export function showField({paused=false,resume='walk'}={}){
 const p=G.p,d=p.dungeon,pl=PLACES[d.place];
 const isHall=pl.hall&&d.floor===pl.hall,isBossFloor=pl.boss&&d.floor===pl.boss.at;
 let mode=isHall||paused?'stop':resume,gt=0,lastGather=-1e9,next=ENCOUNTER(),acc=0,t=0,last=performance.now(),dead=false,flash=0,shown=-1;
 const img=new Image();img.src=`./assets/scenes/${pl.scene}.webp`;
 const cv=h('canvas'),ctx=cv.getContext('2d'),bgEl=h('div',{class:'stage-bg scroll-x',style:{backgroundImage:`url(./assets/scenes/${pl.scene}.webp)`}});
 const walking=()=>mode==='walk',gathering=()=>mode.startsWith('g:');
 const stopBtn=h('button',{onclick:()=>{mode=walking()?'stop':'walk';drawUi();}});
 const canGather=()=>p.skills.filter(s=>SKILLS[s.id].kind==='gather'&&pl.gather?.[s.id]);
 async function gatherBtn(){
  if(gathering()){mode='stop';return drawUi();}
  const list=canGather();const id=list.length===1?list[0].id:await choose('採集',list.map(s=>({label:`${SKILLS[s.id].name} Lv${s.lv}`,value:s.id})));
  if(!id)return;mode='g:'+id;gt=0;drawUi();toast(`停下來${SKILLS[id].name}。每次耗 1 魔力，一樣會遇敵。`,2200);
 }
 const info=h('div',{class:'explore'});
 const bottom=h('div',{class:'float bottom'});
 const root=h('div',{class:'screen'});
 function drawUi(){
  root.replaceChildren(hud(h('button',{class:p.settings.auto?'on':'',onclick:()=>{p.settings.auto=!p.settings.auto;save();drawUi();}},'自動戰鬥'),h('button',{onclick:()=>{mode='stop';openStatus('stat',drawUi);}},'狀態')),h('div',{class:'stage'},bgEl,cv,h('div',{class:'float top'},h('b',{class:'gold'},pl.name+(pl.floors?` ${d.floor}F`:''))),bottom));
  stopBtn.textContent=walking()?'停下':'前進';
  const kids=[];
  if(pl.floors&&!isHall){updInfo();kids.push(info);}
  if(isHall)kids.push(h('span',{class:'grow'},'試煉洞窟 6 樓大廳。'),h('button',{class:'primary',onclick:trialOfficer},'找試煉官'));
  else if(pl.floors&&d.explore>=100){
   if(isBossFloor)kids.push(h('button',{class:'primary',onclick:fightBoss},'挑戰頭目'));
   else if(d.floor<pl.floors)kids.push(h('button',{class:'primary',onclick:()=>{d.floor++;d.explore=0;save();stop();showField();}},`下到 ${d.floor+1}F`));
  }
  if(!isHall&&canGather().length)kids.push(h('button',{class:gathering()?'on':'',onclick:gatherBtn},gathering()?`停止${SKILLS[mode.slice(2)].name}`:'採集'));
  if(!isHall)kids.push(stopBtn);
  kids.push(h('button',{onclick:()=>{stop();p.dungeon=null;save();go.map();}},pl.floors?'離開':'回地圖'));
  bottom.replaceChildren(...kids);
 }
 function updInfo(){info.replaceChildren(h('div',{class:'small'},`探索度 ${Math.floor(d.explore)}%`),bar(d.explore,100,'#d6a84a'));}
 function stop(){dead=true;}
 async function trialOfficer(){
  await talk([['試煉官','palaceGuard','能走到這裡，就有資格就職。讓我看看你手上的武器。']]);
  const r=P.askLetter(p);save();await talk([['試煉官','palaceGuard',r.msg]]);drawUi();
 }
 async function battle(enemies,{boss=false}={}){
  stop();const res=await go.battle({enemies,canEscape:!boss,scene:pl.scene});
  if(res==='lose'){p.dungeon=null;const s=P.stats(p);p.hp=1;p.mp=Math.min(p.mp,s.maxMp);const home=pl.home||'luoyang';save();go.town(home);await talk([[home==='changan'?'維諾亞的醫生':'醫院的護士','suxin','你被人抬回醫院了。受了傷力氣會變小，先在這裡治傷再出城吧。']]);return null;}
  return res;
 }
 async function fightBoss(){
  const res=await battle(pl.boss.group,{boss:true});if(res!=='win'){if(res)showField();return;}
  const first=!p.flags[pl.flag];p.flags[pl.flag]=true;if(first&&pl.reward)P.addItem(p,pl.reward);p.dungeon=null;save();go.map();
  toast(first&&pl.reward?`得到${ITEMS[pl.reward].name}！`:`${pl.name}平定了！`,3000); // 重打頭目不會再給晉級道具
 }
 function frame(now){
  if(dead||!cv.isConnected)return;const dt=Math.min(.1,(now-last)/1000);last=now;
  if(gathering()&&!flash){acc+=dt;gt+=dt;if(gt>=GATHER_SEC){gt=0;lastGather=now;const r=P.gather(p,pl.gather,mode.slice(2));save();toast(r.msg,1400);if(!r.ok)mode='stop';drawUi();}}
  if(walking()&&!flash){t+=dt;acc+=dt;if(pl.floors&&d.explore<100){d.explore=Math.min(100,d.explore+EXPLORE_PER_SEC*dt);const e=Math.floor(d.explore);if(e!==shown){shown=e;updInfo();}if(d.explore>=100){mode='stop';save();drawUi();toast(isBossFloor?'前方有強大的氣息……':'找到往下的樓梯了。');}}
   }
  if(acc>=next&&(walking()||gathering())&&!flash)flash=now;
  if(flash&&now-flash>350){flash=0;acc=0;next=ENCOUNTER();battle(rollGroup(pl,d.floor)).then(r=>{if(!r)return;const low=p.hp<P.stats(p).maxHp*.3;showField({paused:low,resume:mode});if(low)toast('生命不到三成，先停下來。可以用道具補血，或回城治療。',3500);});return;}
  const W=cv.clientWidth,H=cv.clientHeight,dpr=Math.min(2,devicePixelRatio||1);if(cv.width!==W*dpr){cv.width=W*dpr;cv.height=H*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.clearRect(0,0,W,H);
  // 背景是畫布底下一條橫向重複的 CSS 圖，走路時只移動它（交給顯示卡），畫布每格只畫人物（第 1 輪優化）
  if(img.complete&&img.naturalWidth){const s=Math.max(H/img.naturalHeight,W/img.naturalWidth),iw=img.naturalWidth*s,off=(t*90)%iw;const bk=W+'|'+iw;if(bgEl._w!==bk){bgEl._w=bk;bgEl.style.width=(W+iw*2)+'px';bgEl.style.backgroundSize=`${iw}px ${img.naturalHeight*s}px`;}bgEl.style.transform=`translate3d(${-off}px,0,0)`;}
  const art=p.look;const ga=gathering()&&now-lastGather<700&&hasAction(art,'attack');drawMotion(ctx,bank(),art,ga?'attack':walking()&&hasAction(art,'walk')?'walk':'idle',ga?(now-lastGather)/1000:t,{x:W*.38,y:H*.82,height:Math.min(150,H*.3),facing:'right'});
  if(isHall)drawMotion(ctx,bank(),'palaceGuard','idle',now/1000,{x:W*.62,y:H*.82,height:Math.min(150,H*.3),facing:'left'});
  if(flash){ctx.fillStyle=`rgba(255,255,255,${Math.min(1,(now-flash)/350)})`;ctx.fillRect(0,0,W,H);}
  requestAnimationFrame(frame);
 }
 preloadMotion(bank(),[p.look,...(isHall?['palaceGuard']:[])]); // 走路、採集要整張動作圖
 go.refresh=drawUi;drawUi();mount(root);requestAnimationFrame(frame);
 if(d.floor===1&&!d.explore&&pl.desc)toast(pl.desc,3000);
}
