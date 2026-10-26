// 文字版擂台的畫面：上面是狀態，選單跟在狀態下面（不固定在螢幕底部，Leo 2026-10-26），再下面是各頁內容。
// 戰鬥：場景圖上畫雙方的動作圖，指令在圖的正下方，戰況一行一行往下長。規則全在 core/ 與 mud/rules.mjs。
import {h} from '../view/ui.mjs';
import {drawMotion,createMotionBank} from '../motion.mjs';
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import {derive,BP_KEYS,BP_NAMES,CREATE_BP,singleCapAt,expFor,ELEM_NAMES} from '../core/stats.mjs';
import {injuryOf} from '../core/injury.mjs';
import {autoCommand} from '../core/ai.mjs';
import {JOBS,rankName,titleOf} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOT_NAMES,WEAPON_TYPE_NAMES,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {LOOKS,WEAPON_ART} from '../data/looks.mjs';
import {loadHero,saveHero,clearLocal,watchRivals,recordBout,boutsAgainstMe,net} from './online.mjs';

const app=document.getElementById('app');
const S={p:null,tab:'town',shop:'weapon',log:[],rivals:[],npcs:R.npcRivals(),against:null,battle:null,confirmWipe:false};
const bank=createMotionBank();
const say=(t,c='sys')=>{S.log.push({t,c});if(S.log.length>80)S.log.splice(0,S.log.length-80);};
const save=()=>saveHero(S.p);
const ARMOR_NAMES={heavy:'鎧',light:'衣',robe:'袍'};
const ELEM_PRESETS=[{earth:10},{water:10},{fire:10},{wind:10},{earth:5,water:5},{water:5,fire:5},{fire:5,wind:5},{wind:5,earth:5}];
const elemText=e=>Object.entries(e||{}).filter(([,v])=>v>0).map(([k,v])=>ELEM_NAMES[k]+v).join(' ')||'無';
const jobOf=p=>rankName(p.job,p.rank);
const loop=new Set();

// ---------- 小元件 ----------
function meter(cls,v,max,label){return h('div',{class:'meter '+cls},h('i',{style:{width:Math.max(0,Math.min(100,v/Math.max(1,max)*100))+'%'}}),h('span',{},label));}
// 一個人的動作圖（待機），畫在小畫布上
function portrait(id,size=72){
 const cv=h('canvas',{class:'por',width:size*2,height:size*2,style:{width:size+'px',height:size+'px'}}),ctx=cv.getContext('2d'),t0=performance.now();
 const draw=now=>{if(!cv.isConnected){loop.delete(draw);return;}ctx.clearRect(0,0,cv.width,cv.height);drawMotion(ctx,bank,id,'idle',(now-t0)/1000,{x:size,y:size*1.92,height:size*1.7,facing:'front-left'});};
 loop.add(draw);return cv;
}
(function tick(now){for(const f of [...loop])f(now);requestAnimationFrame(tick);})(performance.now());

// ---------- 創角 ----------
function createView(){
 const st={name:'',look:LOOKS[0].id,bp:{vit:10,str:15,tgh:0,qui:5,mgc:0},elem:{fire:10},msg:''};
 const draw=()=>{
  const used=BP_KEYS.reduce((n,k)=>n+st.bp[k],0),d=derive(Object.fromEntries(BP_KEYS.map(k=>[k,st.bp[k]*100]))),cap=singleCapAt(1);
  app.replaceChildren(h('div',{class:'page'},
   h('h1',{class:'title'},'魔力擂台'),h('p',{class:'sub'},'被召喚到法蘭城的冒險者，在競技場一決高下'),
   h('div',{class:'card'},h('label',{class:'field'},'名字（1～8 個字）',h('input',{value:st.name,maxlength:8,oninput:e=>{st.name=e.target.value;}}))),
   h('div',{class:'card'},h('h3',{},'造型'),h('div',{class:'grid'},...LOOKS.map(l=>h('button',{class:'pick'+(st.look===l.id?' on':''),onclick:()=>{st.look=l.id;draw();}},portrait(l.id,64),h('span',{},`${l.name}（${l.sex}）`))))),
   h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},`BP 配點 ${used}/${CREATE_BP}`),h('span',{class:'small dim'},`單項最多 ${cap}`)),
    h('div',{class:'row wrap'},...[['物理型',{vit:10,str:15,tgh:0,qui:5,mgc:0}],['魔法型',{vit:10,str:0,tgh:0,qui:5,mgc:15}],['耐打型',{vit:15,str:10,tgh:5,qui:0,mgc:0}]].map(([n,b])=>h('button',{class:'ghost',onclick:()=>{st.bp={...b};draw();}},n))),
    ...BP_KEYS.map(k=>h('div',{class:'row bp'},h('span',{class:'grow'},BP_NAMES[k]),
     h('button',{disabled:st.bp[k]<=0,onclick:()=>{st.bp[k]--;draw();}},'−'),h('b',{class:'num'},st.bp[k]),
     h('button',{disabled:st.bp[k]>=cap||used>=CREATE_BP,onclick:()=>{st.bp[k]++;draw();}},'＋'))),
    h('p',{class:'small dim'},`生命 ${d.hp}　魔力 ${d.mp}　攻擊 ${d.atk}　防禦 ${d.def}　敏捷 ${d.agi}　精神 ${d.spr}　回復 ${d.rec}`)),
   h('div',{class:'card'},h('h3',{},'屬性（地水火風，合計 10）'),h('div',{class:'row wrap'},...ELEM_PRESETS.map(e=>h('button',{class:JSON.stringify(e)===JSON.stringify(st.elem)?'on':'',onclick:()=>{st.elem=e;draw();}},elemText(e))))),
   st.msg?h('p',{class:'warn'},st.msg):null,
   h('button',{class:'main',onclick:()=>{
    const r=R.newHero({name:st.name,look:st.look,bp:st.bp,elem:st.elem,seed:(Math.random()*2**31)>>>0});
    if(!r.ok){st.msg=r.msg;draw();return;}
    S.p=r.player;S.log=[];say(`${S.p.name}被召喚到了法蘭城。`,'win');say('先到「公會」就職、到「商店」買把武器，再去「練功」。打倒魔物掉的魔石拿去商店賣錢。');
    save();S.tab='town';render();}},'開始冒險')));
 };
 draw();
}

// ---------- 主畫面 ----------
function statusCard(){
 const p=S.p,s=P.stats(p),inj=injuryOf(p.inj||0);
 return h('div',{class:'status'},portrait(p.look,64),h('div',{class:'grow'},
  h('div',{class:'row between'},h('b',{},p.name),h('span',{class:'small'},`Lv${p.lv} ${jobOf(p)}`)),
  meter('hp',p.hp,s.maxHp,`生命 ${p.hp}/${s.maxHp}`),meter('mp',p.mp,s.maxMp,`魔力 ${p.mp}/${s.maxMp}`),
  h('div',{class:'row between small'},h('span',{class:'gold'},`${p.gold} 金`),inj?h('span',{class:'warn'},inj.name):null,p.freeBp?h('span',{class:'ok'},`可配點 ${p.freeBp}`):null,h('span',{class:'dim'},`擂台 ${p.w||0} 勝 ${p.l||0} 敗`))));
}
const TABS=[['town','城中'],['status','狀態'],['bag','道具'],['shop','商店'],['hospital','醫院'],['guild','公會'],['hunt','練功'],['arena','擂台']];
function render(){
 if(S.battle)return battleView();
 const body={town:townView,status:statusView,bag:bagView,shop:shopView,hospital:hospitalView,guild:guildView,hunt:huntView,arena:arenaView}[S.tab]();
 app.replaceChildren(h('div',{class:'page'},statusCard(),
  h('nav',{class:'menu'},...TABS.map(([k,n])=>h('button',{class:S.tab===k?'on':'',onclick:()=>{S.tab=k;S.confirmWipe=false;render();}},n))),body));
}
function logBox(){const box=h('div',{class:'log'},...S.log.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});return box;}
function townView(){return h('div',{},h('div',{class:'card'},h('h2',{},'法蘭城'),h('p',{class:'dim'},PLACES.luoyang.desc)),logBox());}

function statusView(){
 const p=S.p,s=P.stats(p),cap=singleCapAt(p.lv);
 return h('div',{},
  h('div',{class:'card'},h('h2',{},`${p.name}　${jobOf(p)}`),
   h('table',{class:'kv'},...[['等級',`${p.lv}（經驗 ${p.exp}/${expFor(p.lv+1)}）`],['聲望',`${p.rep}（${titleOf(p.rep)}）`],['屬性',elemText(p.elem)],['受傷',injuryOf(p.inj||0)?`${injuryOf(p.inj).name}（${p.inj}）`:'沒有']].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v))))),
  h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},'BP'),h('span',{class:p.freeBp?'ok':'dim'},`可分配 ${p.freeBp} 點（單項最多 ${cap}）`)),
   ...BP_KEYS.map(k=>h('div',{class:'row bp'},h('span',{class:'grow'},BP_NAMES[k]),h('b',{class:'num'},Math.floor(p.bp[k]/100)),
    h('button',{disabled:!p.freeBp||p.bp[k]/100>=cap,onclick:()=>{const r=P.allocBp(p,k,1);if(r.ok)save();render();}},'＋1'))),
   h('table',{class:'kv'},...[['生命',s.maxHp],['魔力',s.maxMp],['攻擊',s.atk],['防禦',s.def],['敏捷',s.agi],['精神',s.spr],['回復',s.rec]].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v))))),
  h('div',{class:'card'},h('h3',{},'裝備'),...Object.entries(SLOT_NAMES).map(([slot,n])=>{const id=p.equip[slot];
   return h('div',{class:'row item'},h('span',{class:'slot'},n),h('span',{class:'grow'},id?gearLine(id):'—'),id?h('button',{onclick:()=>{const r=P.unequip(p,slot);if(r.msg)say(r.msg);save();render();}},'卸下'):null);})),
  h('div',{class:'card'},h('h3',{},'技能'),p.skills.length?null:h('p',{class:'dim'},'還沒學技能。到公會學。'),
   ...p.skills.map(x=>h('div',{class:'item'},h('b',{},`${SKILLS[x.id].name} Lv${x.lv}`),h('span',{class:'small dim'},`　上限 Lv${P.capOf(p,x.id)}　耗魔 ${SKILLS[x.id].mp(x.lv)}`),h('div',{class:'small dim'},SKILLS[x.id].desc(x.lv))))),
  h('div',{class:'card'},S.confirmWipe?h('div',{class:'row'},h('span',{class:'grow warn'},'角色會整個刪掉，確定嗎？'),h('button',{class:'danger',onclick:()=>{clearLocal();S.p=null;S.confirmWipe=false;createView();}},'刪掉'),h('button',{onclick:()=>{S.confirmWipe=false;render();}},'不要'))
   :h('button',{class:'ghost',onclick:()=>{S.confirmWipe=true;render();}},'重新建立角色')));
}
function gearLine(id){const it=ITEMS[id],bits=[];for(const [k,n] of [['atk','攻'],['def','防'],['agi','敏'],['spr','精'],['matk','魔攻'],['hp','命'],['mp','魔']])if(it[k])bits.push(n+(it[k]>0?'+':'')+it[k]);
 const kind=it.slot==='weapon'?WEAPON_TYPE_NAMES[it.type]:it.armor?ARMOR_NAMES[it.armor]:SLOT_NAMES[it.slot];
 return `${it.name}（${kind}・${it.lv}級）${bits.join(' ')}`;}

function bagView(){
 const p=S.p;
 return h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},`道具欄 ${p.bag.length}/${P.BAG_SIZE}`),h('span',{class:'small dim'},'魔石拿去商店賣')),
  p.bag.length?null:h('p',{class:'dim'},'什麼都沒有。'),
  ...p.bag.map(x=>{const it=ITEMS[x.id],wear=it.slot&&P.canEquip(p,x.id);
   return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},it.name+(x.n>1?` ×${x.n}`:'')),h('div',{class:'small dim'},it.slot?gearLine(x.id)+(wear.ok?'':'　'+wear.msg):it.desc||'')),
    h('div',{class:'btns'},
     it.slot?h('button',{disabled:!wear.ok,onclick:()=>{const r=P.equip(p,x.id);say(r.msg);save();render();}},'裝備'):null,
     it.kind==='use'?h('button',{onclick:()=>{const r=P.useItemOutside(p,x.id);say(r.msg);if(r.ok)save();render();}},'使用'):null));}));
}
function shopView(){
 const p=S.p,list=R.shopStock(S.shop);
 return h('div',{},
  h('div',{class:'row wrap'},...['weapon','armor','goods'].map(k=>h('button',{class:S.shop===k?'on':'',onclick:()=>{S.shop=k;render();}},SHOPS[k].name)),
   h('button',{class:'hot',onclick:()=>{const r=R.sellCrystals(p);say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},'賣魔石和材料')),
  h('div',{class:'card'},...list.map(id=>{const it=ITEMS[id],wear=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},it.name),h('span',{class:'gold small'},`　${it.price} 金`),h('div',{class:'small dim'},(it.slot?gearLine(id):it.desc)+(wear.ok?'':'　（你穿不上）'))),
    h('button',{disabled:p.gold<it.price,onclick:()=>{const r=R.buy(p,id);say(r.msg);if(r.ok)save();render();}},'買'));})),
  h('div',{class:'card'},h('h3',{},'賣東西'),...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>h('div',{class:'row item'},h('span',{class:'grow'},`${ITEMS[x.id].name}${x.n>1?' ×'+x.n:''}`),
   h('button',{onclick:()=>{const r=R.sell(p,x.id);say(r.msg);if(r.ok)save();render();}},`賣 ${sellPrice(x.id)} 金`)))));
}
function hospitalView(){
 const p=S.p,all=P.restCost(p,'all'),hp=P.restCost(p,'hp'),mp=P.restCost(p,'mp'),tr=P.treatAllCost(p);
 const act=(fn,label)=>()=>{const r=fn();say(r.msg,r.ok?'heal':'sys');if(r.ok)save();render();};
 return h('div',{},h('div',{class:'card'},h('h2',{},'法蘭城醫院'),h('p',{class:'dim small'},'補生命 1 點 0.5 金、補魔力 1 點 1 金（照原作）。錢不夠時護士會免費幫你補到三成生命。'),
  h('div',{class:'stack'},
   h('button',{disabled:!all,onclick:act(()=>P.rest(p,'all'))},`全部補滿　${all} 金`),
   h('button',{disabled:!hp,onclick:act(()=>P.rest(p,'hp'))},`只補生命　${hp} 金`),
   h('button',{disabled:!mp,onclick:act(()=>P.rest(p,'mp'))},`只補魔力　${mp} 金`),
   h('button',{disabled:!tr,onclick:act(()=>P.treatAll(p))},tr?`治傷　${tr} 金`:'沒有受傷'))),logBox());
}
function guildView(){
 const p=S.p,learn=R.learnable(p);
 return h('div',{},
  h('div',{class:'card'},h('h2',{},'職業公會'),h('p',{class:'small dim'},p.job==='none'?'遊民就職免費。':'換別的職業是轉職：要 1000 金、聲望歸零、從見習重來。'),
   ...R.MUD_JOBS.map(id=>{const j=JOBS[id],cur=p.job===id;
    return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},j.name),h('div',{class:'small dim'},`武器：${j.weapons.map(w=>WEAPON_TYPE_NAMES[w]).join('、')||'空手'}　防具：${j.armor.map(a=>ARMOR_NAMES[a]).join('、')}　專長：${j.main.filter(s=>SKILLS[s]).slice(0,4).map(s=>SKILLS[s].name).join('、')}${j.main.length>4?'…':''}`)),
     h('button',{disabled:cur,onclick:()=>{const r=R.joinJob(p,id);say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},cur?'目前':p.job==='none'?'就職':'轉職'));})),
  h('div',{class:'card'},h('h3',{},`學技能（${p.skills.length}/10 格）`),p.job==='none'?h('p',{class:'dim'},'先就職才能學技能。'):null,
   ...learn.map(id=>{const sk=SKILLS[id],have=P.skillOf(p,id);
    return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},sk.name),h('span',{class:'small dim'},`　上限 Lv${P.capOf(p,id)}　${have?`已學 Lv${have.lv}`:sk.price+' 金'}`),h('div',{class:'small dim'},sk.desc(have?.lv||1))),
     have?h('button',{class:'ghost',onclick:()=>{const r=P.forgetSkill(p,id);say(r.msg);save();render();}},'忘記')
      :h('button',{disabled:p.gold<sk.price,onclick:()=>{const r=P.learnSkill(p,id);say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},'學'));})));
}
function huntView(){
 const p=S.p,s=P.stats(p);
 return h('div',{},h('div',{class:'card'},h('h2',{},'練功'),h('p',{class:'small dim'},`一個人出戰（不帶寵物、傭兵），一回合可以行動兩次；一次遇到 1～${R.SOLO_GROUP_MAX} 隻魔物。打倒會掉魔石。`),
  p.hp<s.maxHp*.3?h('p',{class:'warn'},'生命不到三成，先去醫院吧。'):null,
  ...R.HUNT_SPOTS.map(id=>{const pl=PLACES[id],open=R.spotOpen(p,id);
   return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},pl.name),h('span',{class:'small dim'},`　魔物 Lv${pl.lv[0]}～${pl.lv[1]}`),h('div',{class:'small dim'},open.ok?pl.desc:open.msg)),
    h('button',{disabled:!open.ok||p.hp<=1,onclick:()=>startHunt(id)},'出發'));})));
}
function arenaView(){
 const p=S.p;
 if(!S.against){S.against=[];boutsAgainstMe().then(l=>{S.against=l;if(S.tab==='arena'&&!S.battle)render();});}
 const row=r=>h('div',{class:'row item'},portrait(r.look,48),h('div',{class:'grow'},h('b',{},r.name),h('span',{class:'small'},`　Lv${r.lv} ${rankName(r.job,r.rank)}`),h('div',{class:'small dim'},r.npc?'競技場常駐':`${r.w} 勝 ${r.l} 敗`)),
  h('button',{class:'hot',onclick:()=>startBout(r)},'挑戰'));
 return h('div',{},
  h('div',{class:'card'},h('h2',{},'競技場'),h('p',{class:'small dim'},'一對一比武，雙方先補滿生命魔力，打完不扣、不會受傷；喝掉的藥是真的喝掉了。對手不在線上也能打，由電腦照他的技能代打。30 回合沒分勝負比剩下的生命比例。')),
  h('div',{class:'card'},h('h3',{},'線上的冒險者'),S.rivals.length?null:h('p',{class:'dim small'},S.online?'還沒有別人建立角色。':'這是離線版，只有常駐好手。'),...S.rivals.map(row)),
  h('div',{class:'card'},h('h3',{},'常駐好手'),...S.npcs.map(row)),
  S.against?.length?h('div',{class:'card'},h('h3',{},'有人來挑戰過你'),...S.against.map(r=>h('p',{class:'small'},`${r.byName} 挑戰你，${r.win===1?'他贏了':r.win===0?'你守住了':'平手'}　${new Date(r.t).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`))):null);
}

// ---------- 戰鬥 ----------
function startHunt(spot){
 const b=R.startHunt(S.p,spot,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'hunt',spot,scene:PLACES[spot].scene,lines:[{c:'sys',t:`${PLACES[spot].name}${b.floor>1?` 第 ${b.floor} 層`:''}：遇到${R.foes(b).map(u=>`${u.name} Lv${u.lv}`).join('、')}！`}]};
 beginBattle();
}
function startBout(r){
 const b=R.startBout(S.p,r.fighter,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'bout',rival:r,scene:'sect',lines:[{c:'sys',t:`擂台比武：${S.p.name} 對 ${r.name}（Lv${r.lv} ${rankName(r.job,r.rank)}）`}]};
 beginBattle();
}
function beginBattle(){
 const B=S.battle,b=B.b;B.shown=new Map(b.units.map(u=>[u.uid,{hp:u.hp,mp:u.mp,act:'idle',t0:0,dead:!u.alive}]));
 B.cmds=[];B.menu='main';B.busy=false;B.prev=S.p.lastMud||[{kind:'attack',target:null},{kind:'attack',target:null}];
 battleView();if(S.p.settings.auto)setTimeout(autoRound,300);
}
const me=b=>R.allies(b)[0];
function stage(B){
 const cv=h('canvas',{class:'stage'}),ctx=cv.getContext('2d'),bg=new Image();bg.src=`./assets/scenes/${B.scene}.webp`;
 const draw=now=>{
  if(!cv.isConnected){loop.delete(draw);return;}
  const dpr=Math.min(2,devicePixelRatio||1),W=cv.clientWidth||360,H=cv.clientHeight||220;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  if(bg.complete&&bg.naturalWidth){const s=Math.max(W/bg.naturalWidth,H/bg.naturalHeight);ctx.globalAlpha=.85;ctx.drawImage(bg,(W-bg.naturalWidth*s)/2,(H-bg.naturalHeight*s)*.6,bg.naturalWidth*s,bg.naturalHeight*s);ctx.globalAlpha=1;}
  const k=H/230,t=now/1000,fs=R.foes(B.b);
  const put=(u,x,y,facing)=>{const v=B.shown.get(u.uid);if(!v)return;const act=v.dead?'defeat':v.act,sec=act==='idle'?t:t-v.t0;
   if(act!=='idle'&&!v.dead&&sec>.7)v.act='idle';
   ctx.save();if(u.tint)ctx.filter=u.tint;if(v.dead)ctx.globalAlpha=.6;
   drawMotion(ctx,bank,u.art,act,Math.max(0,sec),{x,y,height:(u.h||90)*k,facing,weapon:u.kind==='player'?(u.weaponType==='fist'?'none':WEAPON_ART[u.weaponType]||null):null});ctx.restore();};
  fs.forEach((u,i)=>put(u,W*(fs.length===1?.27:i===0?.32:.13),H-(i===0?10:34)*k,'front-right'));
  put(me(B.b),W*.74,H-14*k,'front-left');
 };
 loop.add(draw);return cv;
}
function unitBars(B){
 const row=u=>{const v=B.shown.get(u.uid);return h('div',{class:'unit'+(v.dead?' dead':'')},h('div',{class:'row between small'},h('b',{},u.name),h('span',{class:'dim'},`Lv${u.lv}${u.st&&!v.dead?'　'+({poison:'中毒',sleep:'昏睡',stone:'石化',confuse:'混亂',drunk:'酒醉',forget:'遺忘'}[u.st.k]):''}`)),
  meter('hp',v.hp,u.maxHp,`${v.hp}/${u.maxHp}`),u.side==='ally'||B.kind==='bout'?meter('mp',v.mp,u.maxMp,`${v.mp}/${u.maxMp}`):null);};
 return h('div',{class:'sides'},h('div',{},...R.foes(B.b).map(row)),h('div',{},row(me(B.b))));
}
function battleView(){
 const B=S.battle;if(!B)return render();
 const box=h('div',{class:'log blog'},...B.lines.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
 app.replaceChildren(h('div',{class:'page bout'},stage(B),unitBars(B),commands(B),box));
}
function commands(B){
 const b=B.b,p=S.p,u=me(b),n=R.actionsOf(b,u),i=B.cmds.length;
 if(b.over&&!B.busy){
  const res={win:['勝利！','win'],lose:['敗北……','lose'],escaped:['逃走了','sys'],draw:['平手','sys']}[b.over];
  return h('div',{class:'cmds'},h('p',{class:'big '+res[1]},res[0]),h('div',{class:'row'},
   B.kind==='hunt'&&b.over!=='lose'?h('button',{class:'main',onclick:()=>startHunt(B.spot)},'繼續練功'):null,
   h('button',{class:'ghost',onclick:()=>{S.battle=null;S.tab=B.kind==='hunt'?'hunt':'arena';render();}},B.kind==='hunt'?'回城':'回擂台')));
 }
 const toggles=h('div',{class:'row toggles'},
  h('button',{class:p.settings.auto?'on':'',onclick:()=>{p.settings.auto=!p.settings.auto;save();battleView();if(p.settings.auto&&!B.busy)autoRound();}},p.settings.auto?'自動中':'自動'),
  h('button',{class:p.settings.speed===3?'on':'',onclick:()=>{p.settings.speed=p.settings.speed===3?1:3;save();battleView();}},'三倍速'),
  h('span',{class:'small dim grow right'},`第 ${b.round+1} 回合`));
 if(B.busy||p.settings.auto)return h('div',{class:'cmds'},h('p',{class:'dim small'},B.busy?'……':'自動戰鬥中（重複上一回合的指令）'),toggles);
 const pick=c=>{B.cmds.push({actor:'p',...c});B.menu='main';if(B.cmds.length>=n)playRound(B.cmds.splice(0));else battleView();};
 const enemies=R.foes(b).filter(x=>x.alive),target=(c)=>enemies.length>1?(B.pending=c,B.menu='target',battleView()):pick({...c,target:enemies[0]?.uid});
 const back=h('button',{class:'ghost',onclick:()=>{B.menu='main';battleView();}},'返回');
 let body;
 if(B.menu==='skill'){
  const list=u.skills.filter(s=>SKILLS[s.id].kind!=='field');
  body=h('div',{class:'grid2'},...list.map(s=>{const sk=SKILLS[s.id],mp=sk.mp(s.lv),self=['heal','selfheal','regen','cure','wall'].includes(sk.kind);
   return h('button',{disabled:u.mp<mp*(1+B.cmds.filter(c=>c.kind==='skill').length),onclick:()=>self?pick({kind:'skill',skill:s.id,target:'p'}):target({kind:'skill',skill:s.id})},`${sk.name} Lv${s.lv}`,h('small',{},`耗魔 ${mp}`));}),back);
 }else if(B.menu==='item'){
  const list=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id].battle);
  body=h('div',{class:'grid2'},...list.map(x=>h('button',{onclick:()=>pick({kind:'item',item:x.id,target:'p',useItem:id=>P.removeItem(p,id)})},`${ITEMS[x.id].name} ×${x.n}`)),list.length?null:h('p',{class:'dim small'},'沒有戰鬥中能用的藥。'),back);
 }else if(B.menu==='target'){
  body=h('div',{class:'grid2'},...enemies.map(e=>h('button',{onclick:()=>pick({...B.pending,target:e.uid})},`${e.name}`,h('small',{},`${B.shown.get(e.uid).hp}/${e.maxHp}`))),back);
 }else{
  body=h('div',{class:'grid4'},
   h('button',{class:'hot',onclick:()=>target({kind:'attack'})},'攻擊'),
   h('button',{disabled:!u.skills.length,onclick:()=>{B.menu='skill';battleView();}},'技能'),
   h('button',{onclick:()=>pick({kind:'defend'})},'防禦'),
   h('button',{onclick:()=>{B.menu='item';battleView();}},'道具'),
   B.kind==='hunt'?h('button',{class:'ghost',onclick:()=>pick({kind:'escape'})},'逃跑'):null);
 }
 return h('div',{class:'cmds'},h('p',{class:'small dim'},n>1?`第 ${i+1}／${n} 個行動`:'行動'),body,toggles);
}
function autoRound(){
 const B=S.battle;if(!B||B.busy||B.b.over||!S.p.settings.auto)return;
 const b=B.b,u=me(b),n=R.actionsOf(b,u),have=id=>P.countItem(S.p,id),cmds=[];
 for(let i=0;i<n;i++){const c=autoCommand(b,B.prev[i]||{kind:'attack',target:null},u,have,ITEMS,i===0);if(c.kind==='item')c.useItem=id=>P.removeItem(S.p,id);
  if(c.target&&c.kind!=='item'&&!['heal','selfheal','regen','cure','wall'].includes(SKILLS[c.skill]?.kind)&&!b.units.find(x=>x.uid===c.target)?.alive)c.target=null;cmds.push({actor:'p',...c});}
 playRound(cmds);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms/(S.p.settings.speed||1)));
async function playRound(cmds){
 const B=S.battle,b=B.b;B.busy=true;
 // 自動戰鬥照原作重複上一回合的指令（存起來，下次進戰鬥也沿用；逃跑不重複）
 if(cmds.length&&!cmds.some(c=>c.kind==='escape'))B.prev=S.p.lastMud=cmds.map(({actor,useItem,...c})=>c);
 battleView();
 const ev=R.resolveRound(b,cmds);if(B.kind==='bout')R.boutTimeout(b);
 for(const e of ev){
  const line=R.narrate(b,e),now=performance.now()/1000,v=id=>B.shown.get(id);
  if(e.t==='act'){v(e.a).act=e.kind==='skill'?'special':'attack';v(e.a).t0=now;if(e.mp!=null)v(e.a).mp=e.mp;}
  if(e.t==='hit'||e.t==='poison'){v(e.d).hp=e.hp;if(!v(e.d).dead){v(e.d).act='hit';v(e.d).t0=now;}}
  if(e.t==='heal'||e.t==='revive'){v(e.d).hp=e.hp;if(e.t==='revive')v(e.d).dead=false;}
  if(e.t==='mp')v(e.d).mp=e.mp;
  if(e.t==='miss'){v(e.d).act='dodge';v(e.d).t0=now;}
  if(e.t==='die'){v(e.d).dead=true;v(e.d).t0=now;}
  if(!line)continue;
  B.lines.push(line);if(B.lines.length>200)B.lines.splice(0,B.lines.length-200);
  if(S.battle===B)battleView();await wait(e.t==='round'?250:520);
 }
 // 異常狀態、回合末的毒、魔力：把畫面數字對齊實際值
 for(const u of b.units){const v=B.shown.get(u.uid);v.hp=u.hp;v.mp=u.mp;v.dead=!u.alive;}
 if(b.round>=R.BOUT_ROUNDS&&B.kind==='bout'&&b.over)B.lines.push({c:'sys',t:`${R.BOUT_ROUNDS} 回合到了，比剩下的生命比例。`});
 if(b.over)endBattle(B);
 B.busy=false;if(S.battle===B)battleView();
 if(!b.over&&S.p.settings.auto)setTimeout(autoRound,150/(S.p.settings.speed||1));
}
function endBattle(B){
 const b=B.b,p=S.p;
 if(B.kind==='hunt'){
  const r=R.finishHunt(p,b);
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:b.over==='win'?'打贏了！':b.over==='lose'?'你倒下了。':'離開了戰場。'});
  for(const t of r.lines){B.lines.push({c:'sys',t});say(t);}
  if(b.over==='lose')p.settings.auto=false;
 }else{
  R.finishBout(p,b);const r=B.rival;
  const res=b.over==='win'?`你贏了 ${r.name}！`:b.over==='lose'?`你輸給了 ${r.name}。`:`你和 ${r.name} 打成平手。`;
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:res});say('擂台：'+res,b.over==='win'?'win':'sys');
  if(!r.npc)recordBout(p.name,{vs:r.key,vsName:r.name,win:b.over==='win'?1:b.over==='lose'?0:-1,t:Date.now()});
 }
 save();
}

// ---------- 開始 ----------
export async function start(){
 const p=await loadHero();
 net().then(n=>{S.online=!!n;if(n)watchRivals(l=>{S.rivals=l;if(S.tab==='arena'&&!S.battle&&S.p)render();});});
 if(!p)return createView();
 S.p=p;say(`歡迎回來，${p.name}。`);render();
}
