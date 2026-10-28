// 文字版擂台的畫面：上面是名帖（狀態），選單跟在名帖下面（不固定在螢幕底部，Leo 2026-10-26），再下面是各頁內容。
// 角色是三國武將的立繪（generals.mjs），魔物用本作的動作圖。戰鬥：場景圖上畫雙方，指令在圖的正下方，戰況一行一行往下長。
// 規則全在 core/ 與 mud/rules.mjs；交易所、存檔在 mud/online.mjs。
import {h,spriteCanvas} from '../view/ui.mjs';
import {drawMotion,createMotionBank} from '../motion.mjs';
import * as P from '../core/player.mjs';
import * as R from './rules.mjs';
import * as D from './dungeon.mjs';
import {derive,BP_KEYS,BP_NAMES,CREATE_BP,singleCapAt,expFor,ELEM_NAMES} from '../core/stats.mjs';
import {injuryOf} from '../core/injury.mjs';
import {autoCommand,autoPotion,chooseAllyAction,HEAL_SET_AT} from '../core/ai.mjs';
import {makeRng} from '../core/rng.mjs';
import {CG_CATS} from './gear.mjs';
import * as E from './events.mjs';
import {drawFx,fxFromEvent,sfxOn} from './fx.mjs';
import {JOBS,rankName,titleOf} from '../data/jobs.mjs';
import {SKILLS,STATUS_NAMES,SKILL_EXP_PER_USE,weaponOk,mpCost} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOT_NAMES,WEAPON_TYPE_NAMES,sellPrice} from '../data/items.mjs';
import {PLACES} from '../data/places.mjs';
import {MONSTERS} from '../data/monsters.mjs';
import {GENERALS,GENERAL_BY_ID,FACTIONS} from './generals.mjs';
import {GUIDE,BP_TABLE,jobFacts,TIPS} from './guide.mjs';
import * as H from './httpdb.mjs';
import {BUILD} from './version.mjs';
import {pidOf,loadHero,saveHero,clearLocal,exportCode,importCode,otherSave,keepCurrent,watchRivals,recordBout,boutsAgainstMe,net,watchMarket,postListing,cancelListing,buyListing,collectSales,LIST_MAX,heartbeat,isOnline,sendChallenge,watchChallenges,answerChallenge,watchPk,writePk,deletePk,createParty,inviteParty,watchInvites,watchParty,writeParty,deleteParty,watchBoard,postBoard,deleteBoard,BOARD_MAX,BOARD_LEN} from './online.mjs';

const app=document.getElementById('app');
const p0=()=>S.p;
const S={p:null,tab:'town',shop:'weapon',guide:'sword',log:[],rivals:[],npcs:R.npcRivals(),against:null,battle:null,confirmWipe:false,market:[],uid:null,docs:[],me:null,mkMsg:'',mkBusy:false,pickLook:false,pkAsks:[],pkWait:null,coop:null,coopWait:null,board:[],boardText:'',boardMsg:''};
const bank=createMotionBank();
const say=(t,c='sys')=>{S.log.push({t,c});if(S.log.length>80)S.log.splice(0,S.log.length-80);};
const save=()=>{if(S.p)E.roll(S.p);saveHero(S.p);};
const ARMOR_NAMES={heavy:'鎧',light:'衣',robe:'袍'};
const ELEM_PRESETS=R.ELEM_PRESETS,elemText=R.elemText;
const elemTags=e=>Object.entries(e||{}).filter(([,v])=>v>0).map(([k,v])=>h('span',{class:'el el-'+k},ELEM_NAMES[k]+v));
const jobOf=p=>rankName(p.job,p.rank);
const KIND_CLASS={weapon:'k-weapon',armor:'k-armor',use:'k-use',crystal:'k-crystal',material:'k-mat',key:'k-key'};
const loop=new Set();
(function tick(now){for(const f of [...loop]){try{f(now);}catch(e){console.error(e);loop.delete(f);}}requestAnimationFrame(tick);})(performance.now()); // 一個畫面出錯不能拖垮整個動畫迴圈
const art=id=>`./assets/mud/${id}.png`;

// ---------- 小元件 ----------
// 戰鬥用的血條：掉血時留一截黃色慢慢縮（看得出打掉多少），不到五成橘、三成紅
function hpMeter(v,max){
 const pct=x=>Math.max(0,Math.min(100,x/Math.max(1,max)*100))+'%',now=performance.now()/1000,ghost=v.ghost>v.hp&&now-(v.ghostT||0)<1.5?v.ghost:null;
 const g=ghost!=null?h('i',{class:'ghost',style:{width:pct(ghost)}}):null;if(g)requestAnimationFrame(()=>requestAnimationFrame(()=>{g.style.width=pct(v.hp);}));
 return h('div',{class:'meter hp'+(v.hp<=max*.3?' low':v.hp<=max*.5?' mid':'')},g,h('i',{style:{width:pct(v.hp)}}),h('span',{},`${v.hp}/${max}`));
}
function meter(cls,v,max,label){return h('div',{class:'meter '+cls},h('i',{style:{width:Math.max(0,Math.min(100,v/Math.max(1,max)*100))+'%'}}),h('span',{},label));}
// 武將頭像：從立繪裁出來的臉（assets/mud/face/，照膚色找臉的位置裁的）
function face(id,size=56,cls=''){return h('span',{class:'face '+cls,style:{width:size+'px',height:size+'px'}},h('img',{src:`./assets/mud/face/${id}.png`,alt:GENERAL_BY_ID[id]?.name||'',loading:'lazy'}));}
const head=(title,sub)=>h('div',{class:'head'},h('h2',{},title),sub?h('span',{class:'small dim'},sub):null);
const act=(fn,ok='heal')=>()=>{const r=fn();if(r.msg)say(r.msg,r.ok?ok:'sys');if(r.ok)save();render();};

// ---------- 創角 ----------
function createView(mate=false){
 const st={name:'',named:false,look:mate?(S.p.look==='zhaoyun'?'guanyu':'zhaoyun'):'zhaoyun',faction:'蜀',bp:{vit:10,str:15,tgh:0,qui:5,mgc:0},elem:{fire:10},msg:''};
 const draw=()=>{
  const used=BP_KEYS.reduce((n,k)=>n+st.bp[k],0),d=derive(Object.fromEntries(BP_KEYS.map(k=>[k,st.bp[k]*100]))),cap=singleCapAt(1),g=GENERAL_BY_ID[st.look];
  if(!st.named)st.name=g.name;
  app.replaceChildren(h('div',{class:'page'},buildCard(),
   h('header',{class:'hero-banner'},h('span',{class:'seal'},'擂'),h('div',{},h('h1',{class:'title'},'魔力擂台'),h('p',{class:'sub'},'三國群雄，照魔力寶貝的規矩一決高下'))),mate?null:h('div',{},accountBox(),saveCard()),
   mate==='lead'?h('section',{class:'card'},head('建一位新角色帶頭'),h('p',{class:'small dim'},`現在帶頭的 ${S.p.name} 會寄放到酒館，隨時能再帶出來；錢、道具、材料、夥伴都留著。新角色從 1 級開始。`),
    h('button',{class:'ghost',onclick:()=>{S.tab='tavern';render();}},'先不換')):
   mate?h('section',{class:'card'},head('建一位新角色'),h('p',{class:'small dim'},'新角色從 1 級開始，錢、道具大家共用；出戰的人滿了會先住在酒館，到「隊伍」頁換他出戰或操作。'),
    h('button',{class:'ghost',onclick:()=>{S.tab='tavern';render();}},'先不建')):null,
   h('section',{class:'card'},head('選一位武將',`${GENERALS.length} 位`),
    h('div',{class:'tabs'},...FACTIONS.map(f=>h('button',{class:'f-'+f+(st.faction===f?' on':''),onclick:()=>{st.faction=f;draw();}},f))),
    h('div',{class:'gen-grid'},...GENERALS.filter(x=>x.faction===st.faction).map(x=>h('button',{class:'gen'+(st.look===x.id?' on':''),onclick:()=>{st.look=x.id;draw();}},face(x.id,52),h('span',{},x.name)))),
    h('div',{class:'gen-pick'},h('img',{class:'stand',src:art(g.id),alt:g.name}),h('div',{class:'grow'},h('b',{class:'big-name'},g.name),h('span',{class:'small dim'},`　字${g.courtesy}・${g.faction}`),h('p',{class:'small'},g.bio),
     h('label',{class:'field'},h('span',{class:'small dim'},'名號（預設是武將名，可以改，1～8 個字）'),h('input',{value:st.name,maxlength:8,oninput:e=>{st.name=e.target.value;st.named=true;}}))))),
   h('section',{class:'card'},head(`BP 配點 ${used}/${CREATE_BP}`,`單項最多 ${cap}`),
    h('div',{class:'row wrap'},...[['物理型',{vit:10,str:15,tgh:0,qui:5,mgc:0}],['魔法型',{vit:10,str:0,tgh:0,qui:5,mgc:15}],['耐打型',{vit:15,str:10,tgh:5,qui:0,mgc:0}]].map(([n,b])=>h('button',{class:'chip',onclick:()=>{st.bp={...b};draw();}},n))),
    ...BP_KEYS.map(k=>h('div',{class:'row bp'},h('span',{class:'grow'},BP_NAMES[k]),
     h('button',{class:'step',disabled:st.bp[k]<=0,onclick:()=>{st.bp[k]--;draw();}},'−'),h('b',{class:'num'},st.bp[k]),
     h('button',{class:'step',disabled:st.bp[k]>=cap||used>=CREATE_BP,onclick:()=>{st.bp[k]++;draw();}},'＋'))),
    h('div',{class:'statline'},...[['生命',d.hp],['魔力',d.mp],['攻擊',d.atk],['防禦',d.def],['敏捷',d.agi],['精神',d.spr],['回復',d.rec]].map(([k,v])=>h('span',{},h('small',{},k),h('b',{},v))))),
   h('section',{class:'card'},head('屬性','地水火風合計 10，相鄰兩種'),h('div',{class:'row wrap'},...ELEM_PRESETS.map(e=>h('button',{class:'chip'+(JSON.stringify(e)===JSON.stringify(st.elem)?' on':''),onclick:()=>{st.elem=e;draw();}},...elemTags(e))))),
   st.msg?h('p',{class:'warn'},st.msg):null,
   h('button',{class:'main',onclick:()=>{
    const opts={name:st.name,look:st.look,bp:st.bp,elem:st.elem,seed:(Math.random()*2**31)>>>0};
    if(mate==='lead'){const r=R.newLeader(S.p,opts);if(!r.ok){st.msg=r.msg;draw();return;}say(r.msg,'win');say('先到「公會」就職、「商店」買裝備，再去「冒險」練功。');save();S.tab='town';render();return;}
    if(mate){const r=R.addMate(S.p,opts);if(!r.ok){st.msg=r.msg;draw();return;}say(r.msg,'win');save();S.tab='tavern';render();return;}
    const r=R.newHero(opts);
    if(!r.ok){st.msg=r.msg;draw();return;}
    S.p=r.player;S.log=[];say(`${S.p.name}來到了法蘭城。`,'win');say('先到「公會」就職、「商店」買裝備，再去「冒險」練功。魔石拿去商店賣錢。');
    save();S.tab='town';render();}},mate==='lead'?'換他':mate?'就是他了':'踏入法蘭城')));
 };
 S.redraw=draw;draw(); // 建角色那頁的登入框、存檔碼要重畫這頁，不能叫 render()（還沒有角色；Leo 2026-10-28 開局頁登入沒反應就是這樣）
}

// ---------- 主畫面 ----------
// 強制更新（Leo 2026-10-28：裝成 App 的沒更新，每個人玩到的版本不一樣）：伺服器 /api/ping 的 build 跟這份程式的 BUILD 不同就是有新版。
// 開啟時、切回前景時各比一次；第一次自動重新載入（sessionStorage 記住免得一直轉），還是舊的就留一張卡叫玩家關掉 App 重開。
const BUILD_KEY='sanguo-cg-mud-build';
async function checkBuild(info){
 if(!info)info=await H.pingFresh();const b=info?.build;if(!b||!BUILD||b==='dev'||BUILD==='dev'||b===BUILD){if(S.newBuild){S.newBuild=null;S.redraw?.();}return;}
 if(S.battle)return; // 打到一半不重載，下次切回前景再比
 let tried='';try{tried=sessionStorage.getItem(BUILD_KEY)||'';}catch{}
 if(tried!==b){try{sessionStorage.setItem(BUILD_KEY,b);}catch{}if(S.p)save();location.reload();return;}
 S.newBuild=b;S.redraw?.();
}
const buildCard=()=>S.newBuild?h('section',{class:'card warn'},h('p',{class:'small'},`有新版本（${S.newBuild}），你手上的是舊的（${BUILD}）。請把 App 完全關掉再開，或重新整理。`),h('button',{class:'chip',onclick:()=>location.reload()},'重新載入')):null;
// 每一頁最上面都是整隊名帖（Leo 2026-10-28「主畫面就不用帶頭啦，現在是隊伍遊戲」「只有首頁有變是怎樣」）：出戰的每人一格並排，金幣、存檔碼共用；
// 要選人操作的頁（WHO_PAGES）操作中的那格標起來，點別格換他操作、留在同一頁；其他頁點格子換操作並跳到狀態頁
function partyCard(){
 const p=S.p,rows=[],who=WHO_PAGES.has(S.tab); // 要選人操作的頁：點格子只換操作、留在這頁（Leo 2026-10-28：每頁都要同一張）
 const row=(c,i,extra)=>{const s=P.stats(c),inj=injuryOf(c.inj||0),on=who&&i===0;
  // 一人一格（Leo 2026-10-28：太大了，不用血條，給 HP、MP、名字、大頭就好）
  return h('div',{class:'member'+(c.hp>0?'':' down')+(on?' on':''),onclick:i==null||on?null:()=>{if(i){const r=R.swapMate(p,i);say(r.msg,'win');}S.openSkill=null;S.pickSlot=null;if(!who){S.tab='status';scrollTo(0,0);}save();render();}},
   face(c.look,36),h('b',{class:'nm'},c.name),on?h('span',{class:'small gold'},'操作中'):null,h('span',{class:'small dim lv'},`Lv${c.lv} ${extra||jobOf(c)}`),
   h('span',{class:'small hpv'+(c.hp<s.maxHp*.3?' low':'')},`HP ${c.hp}/${s.maxHp}`),h('span',{class:'small mpv'},`MP ${c.mp}/${s.maxMp}`),
   inj?h('span',{class:'small warn'},inj.name):null,c.freeBp?h('span',{class:'small ok'},`配點 ${c.freeBp}`):null);};
 rows.push(row(p,0));for(const i of R.mateIds(p))rows.push(R.withMate(p,()=>row(p,i),i));
 if(R.guestGoing(p))rows.push(row(p.guest.f,null,`${jobOf(p.guest.f)}・借將`));
 // 並排（Leo 2026-10-28：一列一列佔太多位子）：每人一小格，3 格一排、人多自動換行
 return h('header',{class:'status team'},h('div',{class:'grow'},h('div',{class:'members'},...rows),
  h('div',{class:'row between small foot'},h('span',{class:'gold'},`${p.gold} 金`),h('span',{class:'dim'},`出戰 ${rows.length} 人`),h('button',{class:'link',onclick:go2('tavern')},'隊伍'),
   h('button',{class:'link',onclick:()=>{S.tab='status';S.saveUi='out';render();scrollTo(0,0);}},'存檔碼'))));
}
// 選單：五大項；其他店家、擂台、攻略從「城中」進去，角色、冒險底下再分兩頁（Leo 2026-10-27：醫院、工房放上面）
const GROUPS=[['town','城中','城',['town','shop','guild','master','tavern','market','arena','guide','raid','daily','codex']],['char','角色','將',['status','bag','pets']],['adv','冒險','戰',['hunt','dungeon']],['hospital','醫院','醫',['hospital']],['forge','工房','鍛',['forge']]];
const PAGE_NAMES={town:'城中',status:'狀態',bag:'道具',pets:'收服',shop:'商店',hospital:'醫院',guild:'公會',master:'技能大師',tavern:'隊伍',forge:'工房',market:'交易所',hunt:'練功',dungeon:'地下城',arena:'擂台',guide:'攻略',raid:'迷宮王',daily:'每日委託',codex:'圖鑑・成就'};
const groupOf=tab=>GROUPS.find(g=>g[3].includes(tab))||GROUPS[0];
const go2=tab=>()=>{S.tab=tab;S.pickSlot=null;S.confirmWipe=false;S.pickLook=false;S.confirmDrop=false;render();scrollTo(0,0);};
// 一排臉：點誰就操作誰（Leo 2026-10-28：不分帶頭，換裝、學技能、就職、配點都是「操作中」那位的）；角色、公會、技能大師、工房、商店、醫院頁最上面都有
const WHO_PAGES=new Set(['status','bag','pets','guild','master','forge','shop','hospital']);
function subNav(){
 const g=groupOf(S.tab),who=null,seg=g[3].length>1?h('div',{class:'seg'},...g[3].map(t=>h('button',{class:S.tab===t?'on':'',onclick:go2(t)},PAGE_NAMES[t]))):null;
 if(g[0]==='town')return S.tab==='town'?null:h('div',{},h('div',{class:'crumb'},h('button',{class:'back',onclick:go2('town')},'‹ 城中'),h('b',{},PAGE_NAMES[S.tab])),who);
 return who||seg?h('div',{},who,seg):null;
}
function render(){
 S.redraw=render;if(!S.p)return createView();
 if(S.battle)return battleView();
 const body={town:townView,status:statusView,bag:bagView,pets:petsView,shop:shopView,hospital:hospitalView,guild:guildView,tavern:tavernView,master:masterView,hunt:huntView,dungeon:dungeonView,forge:forgeView,arena:arenaView,market:marketView,guide:guideView,raid:raidView,daily:dailyView,codex:codexView,board:boardView}[S.tab]();
 app.replaceChildren(h('div',{class:'page'},buildCard(),partyCard(),pkAskCard(),pkWaitCard(),coopCard(),coopWaitCard(),
  h('nav',{class:'menu'},...GROUPS.map(([k,n,gl,tabs])=>h('button',{class:groupOf(S.tab)[0]===k?'on':'',onclick:go2(tabs[0])},h('i',{},gl),h('span',{},n)))),subNav(),body));
}
// 帳號：發布的網頁用 claude.ai 帳號登入（db、user 能力）；沒登入時存檔只在這台裝置
function accountBox(){
 const canNet=!!globalThis.window?.claude?.use;
 if(!canNet&&S.server)return h('div',{},cloudBox(),serverLogin());
 const box=S.online?h('div',{class:'acct ok small'},h('b',{},'☁ 已登入'),h('span',{},'存檔跟著你的 Claude 帳號，手機、電腦都能接著玩。'),pidBox())
  :!canNet?h('div',{class:'acct small'},h('b',{},'離線版'),h('span',{},'存檔只在這台瀏覽器，清掉網頁資料就不見；記得匯出存檔碼。'))
  :h('div',{class:'acct warn small'},h('b',{},'未登入'),h('span',{},'存檔只在這台裝置的瀏覽器，清掉網頁資料就會不見，也不能上擂台、交易所。先登入 claude.ai 再打開這個網頁，或定期匯出存檔碼。'),
   h('a',{href:'https://claude.ai/login',target:'_blank',rel:'noopener'},'去登入'),h('button',{class:'chip',onclick:()=>location.reload()},'登入好了，重新連線'));
 return h('div',{},cloudBox(),box);
}
// 玩家名稱（Leo 2026-10-28：擂台、借將要知道是誰的角色；要帳號主人的名稱、不是帳號）：顯示給別人看，沒填就不顯示；狀態頁的帳號框和擂台頁都能填
const ownerTag=a=>a?h('span',{class:'small dim'},`　${a} 的`):null;
function pidBox(){
 const p=S.p;if(!p||!S.online)return null;const st=S.pidUi||={v:null},cur=st.v??(p.pid||'');
 return h('div',{class:'row pid'},h('span',{class:'small dim'},'你的名稱'),h('input',{value:cur,maxlength:12,placeholder:'例如 Leo，顯示給別人看',oninput:e=>{st.v=e.target.value;}}),
  h('button',{class:'chip',onclick:()=>{p.pid=String(st.v??p.pid??'').trim().slice(0,12);st.v=null;save();say(p.pid?`別人會看到這是「${p.pid}」的角色。`:'清掉了名稱，別人只看得到角色名。','win');render();}},'存'));
}
// 自己架的伺服器（Leo 2026-10-28）：帳號密碼登入，登入後重新整理，存檔、名單、交易所、PK 都走伺服器
function serverLogin(){
 if(S.online)return h('div',{class:'acct ok small'},h('b',{},`☁ 已登入：${S.name||''}`),h('span',{},'存檔在伺服器，換手機、換電腦用同一組帳號密碼就能接著玩。'),
  h('button',{class:'chip',onclick:async()=>{await H.logout();location.reload();}},'登出'),pidBox());
 const st=S.loginUi||={name:'',pass:'',msg:'',busy:false};
 const rd=()=>(S.redraw||render)(),go=reg=>async()=>{if(st.busy)return;st.busy=true;st.msg='……';rd();const r=await (reg?H.register:H.login)(st.name.trim(),st.pass);st.busy=false;
  if(r.ok){st.msg='登入了，重新連線……';rd();location.reload();}else{st.msg=r.msg||'失敗';rd();}};
 return h('div',{class:'acct warn small login'},h('b',{},'未登入'),h('span',{},'登入後存檔會存在伺服器，才能上擂台、交易所、找人 PK；沒登入只存這台瀏覽器。第一次玩按「註冊」。'),
  h('div',{class:'row'},h('input',{placeholder:'名字（2～12 字）',maxlength:12,value:st.name,oninput:e=>{st.name=e.target.value;}}),h('input',{type:'password',placeholder:'密碼',maxlength:64,value:st.pass,oninput:e=>{st.pass=e.target.value;}})),
  h('div',{class:'row'},h('button',{class:'chip hot',disabled:st.busy,onclick:go(false)},'登入'),h('button',{class:'chip',disabled:st.busy,onclick:go(true)},'註冊'),st.msg?h('span',{class:'small'},st.msg):null));
}
// 存檔碼放成一張明顯的卡（Leo 2026-10-27：藏在帳號框下面找不到）
function saveCard(){
 return h('section',{class:'card save'},head('存檔碼','換裝置、怕存檔不見就用這個'),saveCodeBox());
}
// 雲端另有一份比較強的存檔（讀檔時沒連上雲端、又建了新角色）：讓玩家選，選之前雲端不蓋掉
function cloudBox(){
 const o=otherSave(),p=S.p;if(!o||!p)return null;
 return h('div',{class:'acct warn small'},h('b',{},'有兩份存檔'),h('span',{},`現在用的是 ${p.name} Lv${p.lv}，另一份是 ${o.name} Lv${o.lv}（${(o.t||0)>(p.t||0)?'比較新':'比較舊'}）。選一份；選之前雲端那份不會被蓋掉。`),
  h('button',{class:'chip',onclick:()=>{S.p=o;keepCurrent();save();S.tab='town';say(`換成 ${o.name}。`,'win');render();}},`換成 ${o.name}`),
  h('button',{class:'chip',onclick:()=>{keepCurrent();save();render();}},`留著 ${p.name}`));
}
// 匯出／匯入存檔碼：沒登入的人換裝置、瀏覽器被清掉時的保險
function saveCodeBox(){
 const mode=S.saveUi,p=S.p,redraw=()=>S.p?render():(S.redraw||createView)(); // 建角色那頁也能匯入
 const btns=h('div',{class:'row wrap'},p?h('button',{class:'chip'+(mode==='out'?' on':''),onclick:()=>{S.saveUi=mode==='out'?null:'out';redraw();}},'匯出存檔碼'):null,
  h('button',{class:'chip'+(mode==='in'?' on':''),onclick:()=>{S.saveUi=mode==='in'?null:'in';S.saveMsg='';redraw();}},'匯入存檔碼'));
 let body=null;
 if(mode==='out'&&p){const code=exportCode(p);const ta=h('textarea',{readonly:true,rows:3,onclick:e=>e.target.select()},code);
  body=h('div',{},h('p',{class:'small dim'},'把這串字存到記事本或傳給自己；換裝置時貼回「匯入存檔碼」就能接著玩。打到一半記得再匯一次。'),ta,
   h('div',{class:'row'},h('button',{class:'chip',onclick:async()=>{try{await navigator.clipboard.writeText(code);S.saveMsg='已複製。';}catch{ta.select();S.saveMsg='請長按／全選上面的字自己複製。';}redraw();}},'複製'),S.saveMsg?h('span',{class:'small dim'},S.saveMsg):null));}
 if(mode==='in'){const ta=h('textarea',{rows:3,placeholder:'貼上 MUD1. 開頭的存檔碼'});
  const read=()=>{const q=importCode(ta.value);if(!q){S.saveMsg='這不是有效的存檔碼。';redraw();return;}S.pendIn=q;S.saveMsg='';redraw();};
  const q=S.pendIn;
  body=h('div',{},S.pendIn?null:ta,
   q?h('div',{class:'row wrap'},h('span',{class:'grow warn'},`讀到 ${q.name} Lv${q.lv}${p?`，會蓋掉現在的 ${p.name} Lv${p.lv}`:''}，確定？`),
     h('button',{class:'danger',onclick:()=>{S.p=q;S.pendIn=null;S.saveUi=null;keepCurrent();save();S.tab='town';say(`讀入存檔：${q.name}。`,'win');redraw();}},'確定讀入'),
     h('button',{onclick:()=>{S.pendIn=null;redraw();}},'取消'))
    :h('div',{class:'row'},h('button',{class:'chip',onclick:read},'讀入'),S.saveMsg?h('span',{class:'small warn'},S.saveMsg):null));}
 return h('div',{class:'savecode'},btns,body);
}
function logBox(){const box=h('div',{class:'log'},...S.log.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});return box;}
function townView(){
 const p=S.p;
 const tile=([k,gl,n,sub])=>h('button',{class:'tile',onclick:go2(k)},h('i',{},gl),h('b',{},n),h('small',{},sub));
 const top=[['shop','商','商店','武器、防具、藥'],['market','易','交易所','跟玩家買賣']];
 const tiles=[['guild','會','公會',p.job==='none'?'先來就職':`${jobOf(p)}・晉級`],['master','師','技能大師',`技能 ${p.skills.length}/10`],['tavern','隊','隊伍',`出戰 ${1+R.mateIds(p).length} 人${(p.roster||[]).length?`・休息 ${p.roster.length}`:''}`],
  ['daily','託','每日委託',(()=>{const t=p.daily?.tasks||[];return `完成 ${t.filter(x=>x.claimed).length}/${t.length}`;})()],['raid','王','迷宮王',(()=>{const n=D.DUNGEONS.filter(d=>D.raidOpen(p,d)).length;return n?`${n} 位等你挑戰`:R.fullParty(p)<D.RAID_PARTY?`${raidLv()} 級開放`:'先通關一座地下城';})()],
  ['arena','擂','擂台',`賽季 ${p.season?.pts||0} 分`],['board','告','布告',S.board.length?`${S.board[0].name}：${S.board[0].text.slice(0,8)}${S.board[0].text.length>8?'…':''}`:S.online?'約人組隊、留言':'連線版才有'],['codex','鑑','圖鑑・成就',`${Object.keys(p.codex?.kill||{}).length} 種魔物`],['guide','略','攻略','職業怎麼練']];
 return h('div',{},h('section',{class:'town-hero'},h('h2',{},'法蘭城'),h('p',{},PLACES.luoyang.desc.split('。')[0]+'。')),tutCard(),S.online?null:accountBox(),saveCard(),
  h('div',{class:'town-top'},formationBox(),h('div',{class:'stack'},...top.map(tile))),
  h('div',{class:'tiles'},...tiles.map(tile)),logBox());
}

// 酒館：找隨行夥伴、管理夥伴（◎ 地點自訂）。夥伴跟新角色一樣從 1 級、遊民、沒技能開始，自己練
// 隊伍（Leo 2026-10-28：不分帶頭，所有角色一張表，看誰出戰；「操作中」那位是各頁在處理的人；休息的住在酒館）
function tavernView(){
 const p=S.p,all=R.allChars(p),slots=R.mateSlots(p),outN=1+R.mateIds(p).length,next=R.PARTY_LVS.slice().reverse().find(([l])=>R.topLv(p)<l),free=R.freeSlotOf(p);
 const resetBtn=mate=>{const c=charOf(mate),cost=R.resetBpCost(c),k='p'+mate;
  return S.confirmReset===k?h('div',{class:'row'},h('span',{class:'grow small warn'},`花 ${cost} 金重置${c.name}的點數？`),h('button',{class:'danger',onclick:()=>{S.confirmReset=null;act(()=>R.resetBp(p,mate),'win')();}},'重置'),h('button',{onclick:()=>{S.confirmReset=null;render();}},'不要'))
   :h('button',{class:'wide',disabled:p.gold<cost,onclick:()=>{S.confirmReset=k;render();}},`重置${c.name}的點數　${cost} 金`);};
 const row=x=>{const c=x.c,mx=x.out?(x.i?R.withMate(p,()=>P.stats(p).maxHp,x.i):P.stats(p).maxHp):null,ops=[];
  if(x.out&&x.i)ops.push(h('button',{class:'chip',onclick:()=>{const r=R.swapMate(p,x.i);say(r.msg,'win');save();render();}},'操作'));
  if(!x.out)ops.push(free?h('button',{class:'chip hot',onclick:act(()=>R.takeFromRoster(p,x.j),'win')},'出戰'):h('button',{class:'chip hot',onclick:()=>{S.swapFor=S.swapFor===x.j?null:x.j;render();}},'出戰（換誰）'));
  if(x.out)ops.push(h('button',{class:'chip',disabled:!!p.dg||(x.i===0&&!R.mateIds(p).length),onclick:act(()=>R.restChar(p,x.i),'sys')},'休息'));
  if(x.k!=='p')ops.push(S.confirmDismiss===x.k?h('button',{class:'danger chip',onclick:()=>{S.confirmDismiss=null;act(()=>x.out?R.dropMate(p,x.i):R.dismissRoster(p,x.j),'sys')();}},'確定離開'):h('button',{class:'ghost chip',onclick:()=>{S.confirmDismiss=x.k;render();}},'離開'));
  return h('div',{class:'item'},h('div',{class:'row'},face(c.look,44),h('div',{class:'grow'},h('b',{},c.name),x.k==='p'?h('span',{class:'small gold'},'　操作中'):null,h('span',{class:'badge'},x.out?'出戰':'休息'),
    h('div',{class:'small dim'},`Lv${c.lv}　${rankName(c.job,c.rank)}${mx?`　生命 ${c.hp}/${mx}`:''}${c.freeBp?`　可配點 ${c.freeBp}`:''}${c.skills?.length?`　技能 ${c.skills.length}`:''}`),
    x.out?rowPicker(x.i,'站位'):null),h('div',{class:'col'},...ops)),
   S.swapFor===x.j&&!x.out?h('div',{class:'row wrap'},h('span',{class:'small dim'},'換下誰：'),...R.mateIds(p).map(k=>h('button',{class:'chip',onclick:()=>{S.swapFor=null;act(()=>R.takeFromRoster(p,x.j,k),'win')();}},p[R.MK(k)].name))):null);};
 return h('div',{},
  h('section',{class:'card'},head('隊伍',`出戰 ${outN}/${slots+1}`),
   h('p',{class:'small dim'},`出戰的人一起練功、打地下城；最多幾人照你所有角色裡最高的等級${next?`（有人到 ${next[0]} 級就能出 ${next[1]+1} 人）`:''}。「操作中」的那位是角色頁、公會、技能大師、工房在處理的人，各頁最上面點臉就能換；休息的人按「操作」就會換上來。錢、道具大家共用。`),
   ...all.map(row),
   h('button',{class:'wide',disabled:!free&&(p.roster||[]).length>=R.ROSTER_MAX,onclick:()=>createView(true)},'建新角色')),
  borrowCard(),
  h('section',{class:'card'},head('重置點數','等級² × 20 金'),h('p',{class:'small dim'},'把配好的 BP 全部收回重配。'),resetBtn(0),...R.mateIds(p).map(i=>resetBtn(i))),logBox());
}
// 換屬性（Leo 2026-10-27）：水晶碎片集滿就能換，附相剋解說
function elemPicker(p){
 const have=p.mats?.[R.SHARD]||0;
 return h('div',{class:'elem-pick'},h('p',{class:'small'},`水晶碎片 ${have}／${R.SHARD_COST} 片`,h('span',{class:'dim'},have>=R.SHARD_COST?'　選一個換：':'　魔物身上有機會掉，地下城的王一定掉')),
  h('div',{class:'row wrap'},...ELEM_PRESETS.map(e=>h('button',{class:'chip'+(R.sameElem(e,p.elem)?' on':''),disabled:have<R.SHARD_COST||R.sameElem(e,p.elem),onclick:()=>{const r=R.changeElem(p,e);say(r.msg,r.ok?'win':'sys');if(r.ok){S.pickElem=false;save();}render();}},...elemTags(e)))),
  h('ul',{class:'small dim help'},...R.ELEM_HELP.map(t=>h('li',{},t))));
}
function statusView(){
 const p=S.p,s=P.stats(p),cap=singleCapAt(p.lv),g=GENERAL_BY_ID[p.look];
 return h('div',{},
  h('section',{class:'card'},h('div',{class:'gen-pick'},h('img',{class:'stand',src:art(p.look),alt:g.name}),h('div',{class:'grow'},
   h('b',{class:'big-name'},p.name),h('div',{class:'small dim'},`${g.name}・${g.faction}　${jobOf(p)}`),
   h('table',{class:'kv small'},...[['等級',`${p.lv}　經驗 ${p.exp}/${expFor(p.lv+1)}`],['聲望',`${p.rep}・${titleOf(p.rep)}`],['屬性',h('span',{},...elemTags(p.elem),h('button',{class:'chip tiny',onclick:()=>{S.pickElem=!S.pickElem;render();}},S.pickElem?'收起':'換屬性'),injuryOf(p.inj||0)?h('span',{class:'warn'},`　${injuryOf(p.inj).name}`):null)]].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v)))),
   h('button',{class:'chip',onclick:()=>{S.pickLook=!S.pickLook;render();}},S.pickLook?'收起':'換立繪'))),
   S.pickElem?elemPicker(p):null,
   S.pickLook?h('div',{class:'gen-grid'},...GENERALS.map(x=>h('button',{class:'gen'+(p.look===x.id?' on':''),onclick:()=>{p.look=x.id;S.pickLook=false;save();render();}},face(x.id,44),h('span',{},x.name)))):null),
  saveCard(),
  h('section',{class:'card'},head('BP',p.freeBp?`可分配 ${p.freeBp} 點（單項最多 ${cap}）`:`單項最多 ${cap}`),
   h('div',{class:'bpgrid'},...BP_KEYS.map(k=>h('div',{class:'bpcell'},h('small',{},BP_NAMES[k]),h('b',{},Math.floor(p.bp[k]/100)),
    p.freeBp?h('button',{class:'step',disabled:p.bp[k]/100>=cap,onclick:()=>{const r=P.allocBp(p,k,1);if(r.ok)save();render();}},'＋'):null))),
   h('div',{class:'statline'},...[['生命',s.maxHp],['魔力',s.maxMp],['攻擊',s.atk],['防禦',s.def],['敏捷',s.agi],['精神',s.spr],['回復',s.rec]].map(([k,v])=>h('span',{},h('small',{},k),h('b',{},v)))),
   modLine(p)),
  h('section',{class:'card'},h('div',{class:'head'},h('h2',{},'裝備'),h('button',{class:'chip',onclick:act(()=>R.equipBest(p),'sys')},'一鍵換最好的')),
   ...Object.entries(SLOT_NAMES).flatMap(([slot,n])=>{const id=p.equip[slot],ch=R.gearChoices(p,slot),open=S.pickSlot===slot;
   // 點一下這一格：列出背包裡穿得上的，直接換
   return [h('div',{class:'row item gearrow',onclick:()=>{S.pickSlot=open?null:slot;render();}},h('span',{class:'slot'},n),h('span',{class:'grow'},id?gearLine(id):h('span',{class:'dim'},'—'),id?durTag(p,slot):null),
     ch.length?h('span',{class:'small ok'},`${ch.length} 件 ${open?'▲':'▼'}`):null,id?h('button',{class:'chip',onclick:e=>{e.stopPropagation();act(()=>P.unequip(p,slot),'sys')();}},'卸下'):null),
    open?h('div',{class:'gearpick'},ch.length?null:h('p',{class:'small dim'},'背包裡沒有穿得上的。'),...ch.map(x=>h('div',{class:'row'},h('span',{class:'grow small'},gearLine(x)),h('button',{class:'chip hot',onclick:()=>{S.pickSlot=null;act(()=>P.equip(p,x),'sys')();}},'換上')))):null];})),
  (p.titles||[]).length?h('section',{class:'card'},head('稱號','點一下戴上'),h('div',{class:'row wrap'},h('button',{class:'chip'+(p.title?'':' on'),onclick:()=>{p.title='';save();render();}},'不戴'),...p.titles.map(t=>h('button',{class:'chip'+(p.title===t?' on':''),onclick:()=>{p.title=t;save();render();}},t)))):null,
  h('section',{class:'card'},head('站位',R.ROW_NAMES[R.rowOf(P.battleUnit(p),p.row)]+'排'),h('p',{class:'small dim'},'近戰只打得到前排；弓、魔法打得到後排。'),rowPicker(false)),
  h('section',{class:'card'},head('技能',`${p.skills.length}/10 格・點一下看效果`),p.skills.length?null:h('p',{class:'dim'},'還沒學技能，到城中的「技能大師」學。'),
   h('details',{class:'howto'},h('summary',{},'技能怎麼升級？'),h('ol',{class:'small'},
    h('li',{},'到「大師」花錢學會，一開始是 Lv1。'),
    h('li',{},`在練功或地下城用這招，打贏那一場才算數：每用一次得「${SKILL_EXP_PER_USE} × 敵人平均等級」熟練度（擂台不算）。打越強的魔物升越快。`),
    h('li',{},'熟練度滿了自動升一級，耗魔和效果一起變強。點下面的技能可以看下一級的效果和熟練度。'),
    h('li',{},'每個職業、職階練得到的等級有上限（本行技能最高，別行的低）；晉級之後上限會提高。'),
    h('li',{},'技能等級高了，戰鬥中仍然放最高級；想省魔可以用「練功用的技能」設定交給自動戰鬥。'))),
   ...p.skills.map(x=>skillRow(p,x))),
  accountBox(),
  h('section',{class:'card'},S.confirmWipe?h('div',{class:'row'},h('span',{class:'grow warn'},'角色會整個刪掉，確定嗎？'),h('button',{class:'danger',onclick:()=>{clearLocal();S.p=null;S.confirmWipe=false;createView();}},'刪掉'),h('button',{onclick:()=>{S.confirmWipe=false;render();}},'不要'))
   :h('button',{class:'ghost',onclick:()=>{S.confirmWipe=true;render();}},'重新建立角色')));
}
// 站位設定：mate＝第幾位夥伴（0＝帶頭的）。withMate 會換掉 p.mate 這個物件，所以每次都重新拿
const charOf=mate=>mate?S.p[R.MK(+mate)]:S.p;
const unitOf=mate=>mate?R.withMate(S.p,()=>P.battleUnit(S.p),+mate):P.battleUnit(S.p);
function rowPicker(mate,label){
 const cur=R.rowOf(unitOf(mate),charOf(mate).row); // 沒設定過的照武器（弓、杖站後）
 const seg=h('div',{class:'seg'},...Object.entries(R.ROW_NAMES).map(([k,n])=>h('button',{class:cur===k?'on':'',onclick:()=>{charOf(mate).row=k;save();render();}},n)));
 return label?h('div',{class:'rowpick'},h('span',{class:'small dim'},label),seg):seg;
}
// 陣型（Leo 2026-10-27）：前排、後排各 5 格；點一個人再點一格就搬過去，那格有人就對調。最前面那格最常被打
function formationBox(){
 const p=S.p,list=R.formation(p),sel=S.formSel&&list.some(m=>m.k===S.formSel)?S.formSel:null;
 const cell=(row,pos)=>{const m=list.find(x=>x.row===row&&x.pos===pos);
  return h('button',{class:'fcell'+(m?' has':'')+(m&&m.k===sel?' sel':'')+(m?.kind==='pet'?' pet':''),onclick:()=>{if(sel&&(!m||m.k!==sel)){R.placeMember(p,sel,row,pos);S.formSel=null;save();render();}else{S.formSel=m&&m.k!==sel?m.k:null;render();}}},
   m?[face(m.look,26),h('span',{},m.name)]:h('span',{class:'dim'},pos===0?'最前':''));};
 return h('section',{class:'card rows form'},h('div',{class:'row between'},h('b',{class:'small'},'陣型'),h('span',{class:'small dim'},sel?'點一格放過去':'點人再點格子')),
  ...['front','back'].map(row=>h('div',{class:'frow'},h('span',{class:'small dim'},R.ROW_NAMES[row]),...[0,1,2,3,4].map(pos=>cell(row,pos)))));
}
// 一招技能：點開看這一級和下一級的效果、耗魔、熟練度
function skillRow(p,x){
 const sk=SKILLS[x.id],open=S.openSkill===x.id,pr=R.skillProgress(p,x);
 return h('div',{class:'item skill'+(open?' open':''),onclick:()=>{S.openSkill=open?null:x.id;render();}},
  h('div',{class:'row between'},h('b',{},`${sk.name} Lv${x.lv}`),h('span',{class:'small dim'},`耗魔 ${sk.mp(x.lv)}　${open?'▲':'▼'}`)),
  open?h('div',{class:'skill-detail'},
   h('p',{},h('span',{class:'tag'},'現在'),R.skillDesc(x.id,x.lv)),
   x.lv<pr.cap?h('p',{},h('span',{class:'tag'},`Lv${x.lv+1}`),R.skillDesc(x.id,x.lv+1),h('span',{class:'dim'},`（耗魔 ${sk.mp(x.lv+1)}）`)):null,
   pr.need?h('div',{},meter('exp',x.exp,pr.need,`熟練度 ${x.exp}/${pr.need}`)):null,
   h('p',{class:'small dim'},pr.need?`練功時用這招，打贏後每用一次得「${pr.perUse} × 敵人平均等級」熟練度（擂台不算）。`:`已經到上限 Lv${pr.cap}${pr.cap<10?'（晉級之後上限會提高）':''}。`,`這一招你的上限 Lv${pr.cap}。`)):null);
}
// i＝第幾位夥伴；第二到第四位要隊伍裡有人到 20／30／50 級（rules.mjs PARTY_LVS）
function gearLine(id){const it=ITEMS[id],bits=[],base=ITEMS[String(id).split('~')[0].split('@')[0]];
 // 還沒打的（工房清單）顯示範圍；打出來的照擲到的數值，另外標品質
 for(const [k,n] of [['atk','攻'],['def','防'],['agi','敏'],['spr','精'],['matk','魔攻'],['rec','回復'],['hp','命'],['mp','魔'],['crit','必殺'],['counter','反擊'],['hit','命中'],['dodge','閃躲'],['mres','抗魔'],...Object.entries(D.GEM_RES)])if(it[k]){const r=!it.rolled&&it.rng?.[k]&&it.rng[k].map(v=>Math.round(v*D.heavyMult(it,k)));bits.push(n+(r?`${r[0]}～${r[1]}`:(it[k]>0?'+':'')+it[k]));}
 for(const [k,v] of Object.entries(it.mpPct||{}))bits.push(`${SKILLS[k].name}耗魔${v>0?'+':''}${v}%`);
 const q=D.rollQuality(String(id).split('@')[0]);if(q!=null&&q>=.6)bits.push(D.rollNote(String(id).split('@')[0]));
 const kind=it.cg?CG_CATS[it.cg]:it.slot==='weapon'?WEAPON_TYPE_NAMES[it.type]:it.slot==='body'&&it.armor?ARMOR_NAMES[it.armor]:SLOT_NAMES[it.slot];
 return h('span',{},h('b',{class:KIND_CLASS[it.kind]},it.name),h('span',{class:'small dim'},`（${kind}・${it.lv}級）${bits.join(' ')}`));}
const itemName=(id,n=1)=>h('b',{class:KIND_CLASS[ITEMS[id].kind]},ITEMS[id].name+(n>1?` ×${n}`:''));

// 收服頁（Leo 2026-10-27）：收服的全隊共用一池（Leo 2026-10-28 寵物不歸誰、最多 10 位）；每個出戰的人各帶一位，「出戰」＝跟著現在操作的這位
const RACE_NAMES={human:'人形',beast:'野獸',plant:'植物',undead:'不死',dragon:'龍',flying:'飛行',insect:'昆蟲',special:'特殊',metal:'金屬',demon:'邪魔'};
function petsView(){
 const p=S.p,pets=p.pets||[];
 const card=x=>{const t=R.petStats(x),out=p.petOut===x.uid,who=R.petCarrier(p,x.uid),mx=R.gradeMax(x),sk=R.petSkills(x),k='pet'+x.uid;
  return h('section',{class:'card pet'+(out?' out':'')},
   h('div',{class:'row'},face(x.look,52),h('div',{class:'grow'},h('b',{},`${x.name} Lv${x.lv}`),h('span',{class:'small dim'},`　${GENERAL_BY_ID[x.look]?.faction||''}・`),h('span',{class:'small gold',title:R.archOf(x.look).tip},`${R.archOf(x.look).name}`),h('span',{class:'small dim'},'　'),...elemTags(x.elem),
    // 檔次（Leo 2026-10-27：重點就是檔次）：每項和這個職業的最高檔次（原本 +2）比；滿檔標金色
    h('div',{class:'small grade'},'檔次 ',...['體','力','強','速','魔'].map((k,i)=>h('span',{class:x.grade[i]>=mx[i]?'full':x.grade[i]<mx[i]-2?'low':''},`${k}${x.grade[i]}`)),h('span',{class:'dim'},`　合計 ${R.gradeSum(x)}／滿檔 ${mx.reduce((a,b)=>a+b,0)}`)),
    h('div',{class:'small dim'},`攻擊 ${t.atk}　防禦 ${t.def}　敏捷 ${t.agi}　精神 ${t.spr}　回復 ${t.rec}`)),
    h('button',{class:out?'hot':'',style:{flex:'none'},onclick:act(()=>R.setPetOut(p,x.uid),'win')},out?'跟著我':who?'改跟我':'出戰')),
   h('div',{class:'small '+(who?'':'dim')},out?`跟著${p.name}出戰中，點「跟著我」改成休息。`:who?`跟著${who.c.name}${who.out?'出戰中':'（他在休息，不會出戰）'}。`:'沒人帶，不會出戰。'),
   h('div',{class:'grid2'},meter('hp',x.hp,t.maxHp,`${x.hp}/${t.maxHp}`),meter('mp',x.mp,t.maxMp,`${x.mp}/${t.maxMp}`)),
   h('div',{class:'small'},`技能 ${sk.length}/${R.PET_SLOTS}：`,sk.length?sk.map(q=>`${SKILLS[q.id].name} Lv${q.lv}`).join('、'):'沒有'),
   h('div',{class:'row small'},h('button',{class:'chip',onclick:()=>{S.petEdit=S.petEdit===k?null:k;render();}},S.petEdit===k?'收起':'改名／學技能'),
    S.confirmRelease===x.uid?h('span',{class:'grow row'},h('span',{class:'warn grow'},'放走就找不回來了'),h('button',{class:'danger',onclick:()=>{S.confirmRelease=null;act(()=>R.releasePet(p,x.uid),'sys')();}},'放走'),h('button',{onclick:()=>{S.confirmRelease=null;render();}},'不要'))
     :h('button',{class:'ghost',onclick:()=>{S.confirmRelease=x.uid;render();}},'放走')),
   S.petEdit===k?h('div',{class:'pet-edit'},
    h('div',{class:'row'},h('input',{maxlength:8,value:x.name,placeholder:'新名字（1～8 字）',oninput:e=>{S.petName=e.target.value;}}),h('button',{onclick:()=>{const r=R.renamePet(p,x.uid,S.petName);say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},'改名')),
    h('p',{class:'small dim'},`學技能：一學就是 Lv${R.petLearnLv(x)}（照他現在的等級），之後不會變。`),
    h('div',{class:'grid2'},...Object.keys(R.PET_SKILL_SHOP).map(id=>{const have=sk.find(q=>q.id===id),price=R.petLearnPrice(x,id),full=sk.length>=R.PET_SLOTS;
     return h('button',{disabled:!have&&(full||p.gold<price),class:have&&!have.innate?'ghost':'',onclick:have?(have.innate?null:act(()=>R.petForget(p,x.uid,id),'sys')):act(()=>R.petLearn(p,x.uid,id),'win')},`${SKILLS[id].name}`,h('small',{},have?(have.innate?'天生':`已學 Lv${have.lv}・點了忘記`):full?'技能欄滿了':`${price} 金`));}))):null);};
 return h('div',{},
  h('section',{class:'card'},h('div',{class:'row between'},head('收服的冒險者',`全隊共用 ${pets.length}/${R.PET_MAX} 位`),h('button',{class:'chip',onclick:()=>{S.petHelp=!S.petHelp;render();}},S.petHelp?'收起說明':'怎麼玩')),S.petHelp||!pets.length?h('ul',{class:'small dim help'},...R.PET_HELP.map(t=>h('li',{},t))):null),
  pets.length?null:h('section',{class:'card'},h('p',{class:'dim small'},'還沒收服任何人。10 級起練功會遇到敵對冒險隊，把其中一人打到剩一點血再按「捕捉」；練功頁可以設定自動捕捉。')),
  ...pets.map(card),logBox());
}
function bagView(){
 const p=S.p;
 return h('div',{},h('section',{class:'card'},head(`道具欄 ${p.bag.length}/${P.BAG_SIZE}`,'魔石拿去商店賣'),
  p.bag.length?null:h('p',{class:'dim'},'什麼都沒有。'),
  ...p.bag.map(x=>{const it=ITEMS[x.id],wear=it.slot&&P.canEquip(p,x.id);
   return h('div',{class:'row item'},h('div',{class:'grow'},it.slot?gearLine(x.id):itemName(x.id,x.n),h('div',{class:'small dim'},it.slot?(wear.ok?'':wear.msg):it.desc||'')),
    h('div',{class:'btns'},
     it.slot?h('button',{disabled:!wear.ok,onclick:act(()=>P.equip(p,x.id),'sys')},'裝備'):null,
     it.kind==='use'?h('button',{onclick:act(()=>P.useItemOutside(p,x.id))},'使用'):null));})),
  matsCard());
}
// 材料袋：材料、寶石、水龍素材都放這裡，不佔道具欄
const matList=p=>Object.entries(p.mats||{}).filter(([,n])=>n>0).sort((a,b)=>(ITEMS[a[0]].tier||0)-(ITEMS[b[0]].tier||0)||a[0].localeCompare(b[0]));
function matsCard(){
 const p=S.p,list=matList(p);
 return h('section',{class:'card'},head('材料袋',`${list.length} 種・不佔道具欄`),list.length?null:h('p',{class:'dim small'},'打魔物會掉礦石、木材、毛皮、水晶碎片；地下城的王會掉寶石。'),
  h('div',{class:'mats big'},...list.map(([id,n])=>h('span',{class:'mat',title:ITEMS[id].desc},`${ITEMS[id].name} ×${n}`))));
}
function shopView(){
 const p=S.p,list=R.shopStock(S.shop);
 return h('div',{},
  h('div',{class:'tabs'},...['weapon','armor','goods'].map(k=>h('button',{class:S.shop===k?'on':'',onclick:()=>{S.shop=k;render();}},SHOPS[k].name))),
  h('section',{class:'card'},head(SHOPS[S.shop].name,`身上 ${p.gold} 金`),...list.map(id=>{const it=ITEMS[id],wear=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row item'+(wear.ok?'':' faded')},h('div',{class:'grow'},it.slot?gearLine(id):itemName(id),h('div',{class:'small dim'},(it.slot?'':it.desc)+(wear.ok?'':'你穿不上'))),
    h('button',{class:'buy',disabled:p.gold<it.price,onclick:act(()=>R.buy(p,id),'sys')},`${it.price} 金`));})),
  h('section',{class:'card'},head('收購','材料、寶石不收'),h('button',{class:'hot wide',onclick:act(()=>R.sellCrystals(p),'win')},'魔石全部賣掉'),
   ...p.bag.filter(x=>!['key','material'].includes(ITEMS[x.id].kind)).map(x=>h('div',{class:'row item'},h('span',{class:'grow'},itemName(x.id,x.n)),
    h('button',{onclick:act(()=>R.sell(p,x.id),'sys')},`賣 ${sellPrice(x.id)} 金`)))),
  );
}
function hospitalView(){
 const p=S.p,all=R.restCost(p,'all'),hp=R.restCost(p,'hp'),mp=R.restCost(p,'mp'),tr=R.treatCost(p);
 return h('div',{},h('section',{class:'card'},head('法蘭城醫院','補生命 1 點 0.5 金、補魔力 1 點 1 金'),h('p',{class:'dim small'},`夥伴和收服的人一起算。錢不夠時，護士會免費幫你把生命補到三成。拿杖的法系（魔術師、巫師、傳教士）補魔最多只收 (等級−1)×15+137 金，${P.isCaster(p)?`你現在是 ${P.mpCap(p)} 金封頂`:'魔力越空越划算'}。`),
  h('div',{class:'stack'},
   h('button',{class:'main',disabled:!all,onclick:act(()=>R.rest(p,'all'))},all?`全部補滿　${all} 金`:'生命魔力都是滿的'),
   h('div',{class:'grid2'},h('button',{disabled:!hp,onclick:act(()=>R.rest(p,'hp'))},`只補生命　${hp} 金`),h('button',{disabled:!mp,onclick:act(()=>R.rest(p,'mp'))},`只補魔力　${mp} 金`)),
   h('button',{disabled:!tr,onclick:act(()=>R.treat(p))},tr?`治傷　${tr} 金`:'沒有受傷'))),logBox());
}
function guildView(){
 const p=S.p,learn=R.learnable(p);
 return h('div',{},
  h('section',{class:'card'},head('職業公會',p.job==='none'?'遊民就職免費':'轉職 1000 金、聲望歸零、從見習重來'),
   ...R.MUD_JOBS.map(id=>{const j=JOBS[id],cur=p.job===id,f=jobFacts(id);
    return h('div',{class:'row item'+(cur?' current':'')},h('div',{class:'grow'},h('b',{},j.name),h('span',{class:'small dim'},`　${GUIDE[id].role}`),h('div',{class:'small dim'},`${f.weapons}・${f.armor}　專長：${f.main.slice(0,3).join('、')}${f.main.length>3?'…':''}`)),
     h('button',{disabled:cur,onclick:act(()=>R.joinJob(p,id),'win')},cur?'目前':p.job==='none'?'就職':'轉職'));})),
  promoteCard());
}
// 晉級：照原作的等級、聲望、晉級費；晉級任務改成通關指定的地下城（◎）
function promoteCard(){
 const p=S.p;if(p.job==='none')return null;const c=D.promoteCheck(p);
 return h('section',{class:'card'},head('晉級',`現在：${jobOf(p)}`),!c.rows.length?h('p',{class:'dim small'},c.msg):h('div',{},
  
  ...c.rows.map(([t,ok,now])=>h('div',{class:'row between small'},h('span',{class:ok?'ok':''},(ok?'✓ ':'・')+t),h('span',{class:'dim'},now))),
  h('button',{class:'main',disabled:!c.ok,onclick:act(()=>D.promote(p),'win')},`晉級成${c.name}`)));
}
// 技能大師：每位大師教自己那一行的招；學不學得到、上限幾級看你的職業
function masterView(){
 const p=S.p,m=R.MASTERS.find(x=>x.job===S.master)||R.MASTERS.find(x=>x.skills.some(id=>P.capOf(p,id)>0))||R.MASTERS[0];
 return h('div',{},
  h('section',{class:'card'},head('技能大師',`技能欄 ${p.skills.length}/10 格`),p.job==='none'?h('p',{class:'warn'},'遊民什麼都學不了，先到「公會」就職。'):null,
   h('div',{class:'tabs wrap'},...R.MASTERS.map(x=>h('button',{class:(x===m?'on':'')+(x.skills.some(id=>P.capOf(p,id)>0)?'':' dimmed'),onclick:()=>{S.master=x.job;render();}},x.who)))),
  h('section',{class:'card'},head(`${m.hall}・${m.who}`,JOBS[m.job].name+'的本事'),
   ...m.skills.map(id=>{const sk=SKILLS[id],have=P.skillOf(p,id),cap=P.capOf(p,id);
    return h('div',{class:'row item'+(cap?'':' faded')},h('div',{class:'grow'},h('b',{},sk.name),h('span',{class:'small dim'},`　${cap?`你最多練到 Lv${cap}`:`${JOBS[p.job].name}學不了`}　${have?`已學 Lv${have.lv}`:sk.price+' 金'}`),h('div',{class:'small dim'},R.skillDesc(id,have?.lv||1))),
     have?h('button',{class:'ghost',onclick:act(()=>P.forgetSkill(p,id),'sys')},'忘記'):h('button',{disabled:!cap||p.gold<sk.price,onclick:act(()=>P.learnSkill(p,id),'win')},'學'));})),logBox());
}
function huntView(){
 const p=S.p,s=P.stats(p);
 return h('div',{},h('section',{class:'card'},head('練功',`${R.humans(p).length} 人同行${R.partyUnits(p).length>R.humans(p).length?`、${R.partyUnits(p).length-R.humans(p).length} 位收服的`:''}，一次遇到 1～${R.groupMax(p.lv,R.fullExtra(p))} 隻（照滿組算，人少也一樣）`),  p.hp<s.maxHp*.3?h('p',{class:'warn'},'生命不到三成，先去醫院吧。'):null,
  autoSetup(),
  ...R.HUNT_SPOTS.map(id=>{const pl=R.SPOTS[id],open=R.spotOpen(p,id);
   return h('div',{class:'spot'+(open.ok?'':' faded'),style:{'--bg':`url(./assets/scenes/${pl.scene}.webp)`}},h('div',{class:'grow'},h('b',{},pl.name),h('span',{class:'badge'},`Lv${pl.lv[0]}～${pl.lv[1]}`),h('div',{class:'small'},open.ok?pl.desc:open.msg),pl.needLv&&p.lv<pl.needLv?h('div',{class:'small warn'},`建議 ${pl.needLv} 級以上，現在去會很吃力`):null),
    h('button',{class:'hot',disabled:!open.ok||p.hp<=1,onclick:()=>startHunt(id)},'出發'));})));
}
// 練功的自動設定：自動戰鬥用哪一招、打完自動下一場（Leo 2026-10-26）
// 每個角色各自設定（o＝帶頭的 p 或夥伴 p.mate；夥伴沒設定就照電腦的判斷打）
function huntSkillPick(mate){
 const u=unitOf(mate),o=charOf(mate),sk=o.skills.filter(x=>weaponOk(u,x.id)&&!['field','gather','craft','passive'].includes(SKILLS[x.id].kind)).map(x=>[x.id,`${SKILLS[x.id].name}${x.lv}（${mpCost(u,x.id,x.lv)}魔）`]);
 const opts=[['',mate?'電腦判斷':'重複上回合'],...(mate?[]:[['ai','電腦判斷（補師補血少的、近戰打前排）']]),['attack','普通攻擊'],...sk],opts2=[['','同第一回合'],['attack','普通攻擊'],...sk];
 const sel=(k,list)=>{if(o[k]&&!list.some(([v])=>v===o[k]))o[k]='';return h('select',{onchange:e=>{charOf(mate)[k]=e.target.value;save();}},...list.map(([v,n])=>h('option',{value:v,selected:(o[k]||'')===v},n)));};
 return h('label',{class:'pick small'},h('span',{},o.name),sel('huntSkill',opts),sel('huntSkill2',opts2));
}
// 第一、三、五…回合用 huntSkill，第二、四…回合用 huntSkill2（沒設定就跟第一回合一樣；Leo 2026-10-27）
const roundSkill=(o,b)=>(b.round%2?o?.huntSkill2:'')||o?.huntSkill;
function autoSetup(dg){
 const p=S.p,st=p.settings;
 return h('div',{class:'autoset'},
  h('div',{class:'pick small dim'},h('b',{},'自動戰鬥'),h('span',{},'第一回合'),h('span',{},'第二回合')),huntSkillPick(0),...R.mateIds(p).map(i=>huntSkillPick(i)),
  h('label',{class:'pick small'},h('span',{},'補血門檻（電腦判斷用）'),h('select',{onchange:e=>{st.healAt=+e.target.value;save();}},...[[30,'隊友生命不到三成才補'],[50,'不到五成才補'],[70,'不到七成就補']].map(([v,n])=>h('option',{value:v,selected:(st.healAt??50)===v},n)))),
  potionPick(),
  dg?null:h('label',{class:'row small check'},h('input',{type:'checkbox',checked:!!st.autoNext,onchange:e=>{st.autoNext=e.target.checked;if(st.autoNext)st.auto=true;save();}}),'自動下一場（生命不到三成、魔力不夠就停）'),
  dg?null:catchPick());
}
// 自動喝藥（Leo 2026-10-27）：回復藥在戰鬥中喝，帶頭的和夥伴都照「生命不到幾成」喝最便宜的；魔力藥戰鬥中不能喝（Leo 2026-10-27），自動下一場時在兩場之間照「魔力不到幾成（或不夠放設定的招）」喝
const POT_HP=[[0,'不喝'],[30,'生命不到三成'],[50,'不到五成'],[70,'不到七成']],POT_MP=[[0,'不喝'],[15,'不夠放招或不到 15%'],[30,'不到三成'],[50,'不到五成']];
const potOpt=()=>{const st=S.p.settings;return {hp:st.autoHp??30,mp:0,between:st.autoMp??15};};
function potionPick(){
 const st=S.p.settings,o=potOpt(),sel=(k,list,v)=>h('select',{onchange:e=>{st[k]=+e.target.value;save();}},...list.map(([n,t])=>h('option',{value:n,selected:v===n},t)));
 return h('div',{},h('label',{class:'pick small'},h('span',{},'戰鬥中回復藥'),sel('autoHp',POT_HP,o.hp)),h('label',{class:'pick small'},h('span',{},'兩場間魔力藥'),sel('autoMp',POT_MP,o.between)));
}
// 兩場之間自動喝藥（Leo 2026-10-27；自動下一場、地下城往下一層前）：帶頭的和出門的夥伴各自看，生命不到門檻喝回復藥、魔力不夠放設定的招或不到門檻喝魔力藥，都挑最便宜的，每人每種最多三瓶
function drinkBetween(log){
 const p=S.p,o=potOpt(),cheapest=k=>p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id][k]).sort((a,b)=>ITEMS[a.id].price-ITEMS[b.id].price)[0];
 const lines=[];
 for(const i of [0,...R.goingMates(p)]){const c=charOf(i);
  for(let n=0;n<3&&o.hp;n++){const u=unitOf(i);if(c.hp>=u.maxHp*o.hp/100)break;const pot=cheapest('hp');if(!pot)break;R.usePotion(p,pot.id,i);lines.push(`${c.name}喝了${ITEMS[pot.id].name}`);}
  for(let n=0;n<3&&o.between;n++){const u=unitOf(i),id=c.huntSkill&&c.huntSkill!=='attack'?c.huntSkill:null,s=id&&u.skills.find(x=>x.id===id),need=s?mpCost(u,id,s.lv):0;
   if(!(c.mp<need||c.mp<u.maxMp*o.between/100))break;const pot=cheapest('mp');if(!pot)break;R.usePotion(p,pot.id,i);lines.push(`${c.name}喝了${ITEMS[pot.id].name}`);}}
 if(lines.length){save();log?.push({c:'sys',t:lines.join('、')+'。'});}
 return lines;
}
// 自動捕捉（Leo 2026-10-27）：選一種魔物，自動戰鬥時先用普攻把牠打到成功率夠高再按捕捉，那回合夥伴和寵物都防禦；抓到或寵物滿了就停下自動下一場
function catchPick(){
 const p=S.p,st=p.settings;if(p.lv<10)return null;
 return h('label',{class:'row small'},h('span',{},'自動捕捉'),h('select',{onchange:e=>{st.autoCatch=e.target.value||null;save();render();}},h('option',{value:'',selected:!st.autoCatch},'不抓'),h('option',{value:'any',selected:st.autoCatch==='any'},'任何職業'),...R.MUD_JOBS.map(id=>h('option',{value:id,selected:st.autoCatch===id},JOBS[id].name))),
  h('span',{class:'dim'},st.autoCatch?`已收服 ${(p.pets||[]).length}/${R.PET_MAX}，成功率到 ${R.CATCH_AT}% 就出手`:''));
}
// 地下城兩場之間喝藥（Leo 2026-10-27）：選人、點藥
function potionBox(){
 const p=S.p,who=[0,...R.mateIds(p)],t=who.includes(S.potT)?S.potT:0,pots=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&(ITEMS[x.id].hp||ITEMS[x.id].mp));
 const line=i=>{const c=charOf(i),s=i?R.withMate(p,()=>P.stats(p),i):P.stats(p);return `${c.name} ${c.hp}/${s.maxHp}・${c.mp}/${s.maxMp}`;};
 return h('section',{class:'card'},head('喝藥','兩場之間補一下'),
  h('div',{class:'seg'},...who.map(i=>h('button',{class:t===i?'on':'',onclick:()=>{S.potT=i;render();}},line(i)))),
  pots.length?h('div',{class:'grid2'},...pots.map(x=>h('button',{onclick:act(()=>R.usePotion(p,x.id,t),'sys')},`${ITEMS[x.id].name} ×${x.n}`,h('small',{},ITEMS[x.id].desc)))):h('p',{class:'small dim'},'身上沒有恢復藥。'));
}
// 裝備（含寶石）加的修正值合計（Leo 2026-10-27：狀態頁要看得到）
function modLine(p){
 const sum={},add=(k,v)=>{if(v)sum[k]=(sum[k]||0)+v;};
 for(const id of Object.values(p.equip))if(id&&ITEMS[id])for(const k of ['matk','crit','counter','hit','dodge','mres',...Object.keys(D.GEM_RES)])add(k,ITEMS[id][k]);
 const keys=[['crit','必殺'],['counter','反擊'],['hit','命中'],['dodge','閃躲'],['mres','抗魔'],['matk','魔攻'],...Object.entries(D.GEM_RES)].filter(([k],i)=>i<5||sum[k]);
 return h('div',{class:'statline mods'},...keys.map(([k,n])=>h('span',{},h('small',{},n),h('b',{},(sum[k]>0?'+':'')+(sum[k]||0)))));
}
function dungeonView(){
 const p=S.p,cur=p.dg&&D.DUNGEON_BY_ID[p.dg.id],s=P.stats(p);
 return h('div',{},
  cur?h('section',{class:'card'},head(cur.name,`第 ${p.dg.floor}／${D.FLOORS} 層`),
   h('div',{class:'row'},h('button',{class:'hot',disabled:p.hp<=1,onclick:()=>startFloor()},'繼續往下'),h('button',{class:'ghost',onclick:()=>{D.leaveDungeon(p);save();render();}},'撤退'))):null,
  cur?potionBox():null,
  h('section',{class:'card'},head('地下城',`每座 ${D.FLOORS} 層，最深處有王`),autoSetup(true),h('p',{class:'small dim'},`一群最多 ${R.groupMax(p.lv,R.fullExtra(p))} 隻、王的強度都照滿組（${R.fullParty(p)} 人各帶一位收服的）設定，人少也不會變弱。`),
   h('p',{class:'small dim'},'王有自己的職業和招式，一回合兩動、生命比較多，必掉寶石。'),
   p.hp<s.maxHp*.5?h('p',{class:'warn'},'生命不到一半，先去醫院吧。'):null,
   ...D.DUNGEONS.map(d=>{const open=D.dungeonOpen(p,d),n=D.cleared(p,d);
    return h('div',{class:'row item'+(open.ok?'':' faded')},face(d.look,44),h('div',{class:'grow'},h('b',{},d.name),h('span',{class:'badge'},`王 Lv${d.lv}`),n?h('span',{class:'small ok'},`　通關 ${n} 次`):null,
     h('div',{class:'small'},...D.bossKits(d).map(([n,rk,sk,style])=>h('div',{},h('span',{class:'gold'},`${d.pair?n+' ':''}${rk}・${style}`),'　',sk.map(([k,l])=>`${k}${l}`).join('、')))),
     h('div',{class:'small dim'},open.ok?`魔物 Lv${d.monLv[0]}～${d.monLv[1]}`:open.msg),p.lv<d.needLv?h('div',{class:'small warn'},`建議 ${d.needLv} 級以上`):null),
     h('button',{class:'hot',disabled:!open.ok||!!p.dg||p.hp<=1,onclick:()=>{const r=D.enterDungeon(p,d.id);if(r.ok){save();startFloor();}}},'進入'));})));
}
// 王戰（Leo 2026-10-27）：通關過的王帶五名護衛再打一次，獎勵加倍；要靠戰術（先處理後排的軍醫、解異常、繞過近衛）
const raidLv=()=>Math.min(...R.PARTY_LVS.filter(([,n])=>1+n>=D.RAID_PARTY).map(([l])=>l)); // 隊伍能帶 RAID_PARTY 人的等級
// 迷宮王（Leo 2026-10-28：原本叫王戰、藏在地下城頁找不到，改成城中一塊磚，世界王拿掉）
function raidView(){
 const p=S.p,list=D.DUNGEONS.filter(d=>D.coopOpen(p,d)),open=R.fullParty(p)>=D.RAID_PARTY; // 通關過的都列；單人王戰要 20 級，組隊打不限
 return h('div',{},h('section',{class:'card raid'},head('迷宮王',list.length?`${list.length} 位`:'還沒開放'),
  h('p',{class:'small dim'},`通關過的地下城，那座的王會帶一隊人再等你（${D.raidGuardN(p)} 個，照你能帶的人數），每個王的陣型不一樣，王和護衛至少是你隊裡最高等級減 ${D.RAID_LAG}，剛好的等級按自動是過不了的，要自己下令。打贏王的掉落兩份、水晶碎片多一片，第一次另送一顆寶石。可以逃跑。`),
  open?null:h('p',{class:'warn small'},`自己帶隊挑戰要隊伍能帶 ${D.RAID_PARTY} 人（${raidLv()} 級）${S.online?'；跟線上的朋友「組隊打」不限等級':''}。`),
  // 還在地下城裡（打到一半關掉、重新載入）會按不了（Leo 2026-10-28「迷宮王沒做完然後變成不能打了」）：寫清楚、這裡就能撤退
  p.dg?h('p',{class:'warn small row'},h('span',{class:'grow'},`你還在${D.DUNGEON_BY_ID[p.dg.id]?.name||'地下城'}第 ${p.dg.floor} 層，先打完或撤退才能挑戰迷宮王。`),h('button',{class:'chip',onclick:()=>{S.tab='dungeon';render();scrollTo(0,0);}},'去地下城'),h('button',{class:'chip',onclick:()=>{D.leaveDungeon(p);save();say('從地下城撤退了。');render();}},'撤退')):null,
  p.hp<=1?h('p',{class:'warn small'},'生命太低，先去醫院。'):null,
  !list.length?h('p',{class:'dim small'},'先到「冒險→地下城」通關一座，王就會出現在這裡。'):null,
  // 之前這裡的變數叫 open 把外面的 open 蓋掉了，變成沒展開「怎麼打」就按不了挑戰（Leo 2026-10-28「變成不能打了」）
  ...list.map(d=>{const set=D.raidSet(d),showHelp=S.raidHelp===d.id;return h('div',{class:'item'},h('div',{class:'row'},face(d.look,40),h('div',{class:'grow'},h('b',{},d.boss),h('span',{class:'badge'},`Lv${D.raidLv(d,R.topLv(p))}`),h('span',{class:'gold'},`　${set.name}`),D.raidWins(p,d)?h('span',{class:'small ok'},`　勝 ${D.raidWins(p,d)} 次`):null,h('div',{class:'small dim'},set.text)),
    h('div',{class:'col'},h('button',{class:'hot',disabled:!open||!!p.dg||p.hp<=1,onclick:()=>startRaid(d.id)},'挑戰'),S.online?h('button',{disabled:!!S.coop||!!S.coopWait||!!p.dg,onclick:()=>coopStart(d.id)},'組隊打'):null,h('button',{class:'ghost small',onclick:()=>{S.raidHelp=showHelp?null:d.id;render();}},showHelp?'收起':'怎麼打'))),
    showHelp?h('p',{class:'help small'},set.hint):null);}),
  S.online&&list.length?h('p',{class:'small dim'},R.COOP_HELP):null),logBox());
}
function startRaid(id){
 const p=S.p,d=D.DUNGEON_BY_ID[id],b=D.startRaid(p,id,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'raid',scene:d.lv<20?'cave':'courtyard',lines:[{c:'sys',t:`迷宮王：${D.bossLabel(d)}帶著護衛隊迎上來——${R.foes(b).filter(u=>!u.boss).map(u=>`${u.name}${u.row==='back'?'（後排）':''}`).join('、')}！`}]};
 beginBattle();
}
// 寶石合成：三顆同等級 → 隨機同等級；三顆同一種 → 升一級
function gemFuseView(kindTabs){
 const p=S.p,tray=(S.fuse||=[]).filter(id=>D.matCount(p,id)>0),own=D.gemsIn(p).sort((a,b)=>ITEMS[b].grade-ITEMS[a].grade||ITEMS[a].name.localeCompare(ITEMS[b].name));S.fuse=tray;
 const inTray=id=>tray.filter(x=>x===id).length,pv=D.fusePreview(tray);
 const canAdd=id=>tray.length<3&&inTray(id)<D.matCount(p,id)&&(!tray.length||ITEMS[tray[0]].grade===ITEMS[id].grade);
 return h('div',{},kindTabs,
  h('section',{class:'card'},head('寶石合成','三顆同等級'),
   h('div',{class:'fuse'},...[0,1,2].map(i=>tray[i]?h('button',{class:'slotgem on',onclick:()=>{tray.splice(i,1);render();}},h('b',{},ITEMS[tray[i]].name),h('small',{},'點一下拿掉')):h('span',{class:'slotgem'},'空'))),
   h('p',{class:'small '+(pv?'ok':'dim')},pv?(pv.up?`三顆一樣 → ${ITEMS[pv.out].name}`:`隨機一顆等級 ${pv.grade} 的寶石`):'放三顆同等級的寶石。三顆同一種會升一級，不同種會隨機變成同等級的一顆。'),
   h('button',{class:'main',disabled:!pv,onclick:()=>{const r=D.fuseGems(p,tray);S.fuse=[];say(r.msg,r.ok?'win':'sys');if(r.ok)save();render();}},pv?`合成（${D.fuseFee(ITEMS[tray[0]].grade)} 金）`:'合成')),
  h('section',{class:'card'},head('身上的寶石',`${own.length} 種`),own.length?null:h('p',{class:'small dim'},'地下城的王會掉寶石。'),
   ...own.map(id=>{const n=D.matCount(p,id),it=ITEMS[id],three=n>=3&&D.fusePreview([id,id,id])?.up;
    return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{class:'k-mat'},`${it.name} ×${n}`),h('div',{class:'small dim'},it.desc)),
     three?h('button',{class:'ghost',onclick:()=>{S.fuse=[id,id,id];render();}},'放三顆'):null,
     h('button',{disabled:!canAdd(id),onclick:()=>{tray.push(id);render();}},'放入'));})),logBox());
}
// 打造時要鑲的寶石：點開列出身上的寶石，每顆寫出鑲在兵器／防具上會加什麼（Leo 2026-10-27：原本的下拉選單看不懂）
function gemPicker(gems,kind){
 const p=S.p,cur=S.forgeGem,eff=g=>kind==='weapon'?[['兵器',D.gemEffect(g,'weapon')]]:kind==='armor'?[['防具',D.gemEffect(g,'head')]]:[['兵器',D.gemEffect(g,'weapon')],['防具',D.gemEffect(g,'head')]];
 const line=g=>h('span',{class:'gemfx'},...eff(g).map(([n,t])=>h('small',{},`${n}：${t}`)));
 const pick=g=>()=>{S.forgeGem=g;S.gemOpen=false;render();};
 return h('div',{class:'gempick'},
  h('button',{class:'gemcur',onclick:()=>{S.gemOpen=!S.gemOpen;render();}},h('span',{},h('b',{},'鑲寶石：'),cur?`${ITEMS[cur].name}`:'不鑲'),cur?line(cur):h('small',{class:'dim'},'選一顆寶石，鑲在兵器和防具上加的不一樣'),h('i',{},S.gemOpen?'▲':'▼')),
  S.gemOpen?h('div',{class:'gemlist'},
   h('button',{class:cur?'':'on',onclick:pick('')},h('b',{},'不鑲')),
   ...gems.map(g=>h('button',{class:cur===g?'on':'',onclick:pick(g)},h('b',{},`${ITEMS[g].name}`,h('small',{class:'dim'},`　${ITEMS[g].grade} 級・有 ${p.mats[g]} 顆`)),line(g))),
   h('p',{class:'small dim'},'三顆同等級可以在「寶石合成」換成新的或升級。')):null);
}
function forgeView(){
 const p=S.p,kind=S.forgeKind||'weapon',cats=Object.keys(CG_CATS).filter(c=>kind==='weapon'?['sword','axe','spear','bow','staff','dagger'].includes(c):kind==='armor'&&!['sword','axe','spear','bow','staff','dagger','acc'].includes(c)),cat=cats.includes(S.forgeCat)?S.forgeCat:'';
 const list=Object.keys(D.RECIPES).filter(id=>D.recipeKind(id)===kind&&(!cat||ITEMS[id].cg===cat)).sort((a,b)=>ITEMS[a].lv-ITEMS[b].lv||(ITEMS[a].type||ITEMS[a].slot).localeCompare(ITEMS[b].type||ITEMS[b].slot));
 const kindTabs=h('div',{class:'tabs'},...[['weapon','兵器'],['armor','防具'],['acc','飾品'],['dragon','水龍系列'],['socket','鑲寶石'],['gem','寶石合成']].map(([k,n])=>h('button',{class:kind===k?'on':'',onclick:()=>{S.forgeKind=k;S.forgeCat='';render();}},n)));
 if(kind==='gem')return gemFuseView(kindTabs);if(kind==='socket')return socketView(kindTabs);
 const mine=list.filter(id=>!S.forgeAll?P.canEquip(p,id).ok||kind==='dragon':true);S.forgeGem='';
 return h('div',{},
  repairCard(),wearingCard(p),
  kindTabs,
  cats.length?h('div',{class:'tabs wrap small'},...[['','全部'],...cats.map(c=>[c,CG_CATS[c]])].map(([c,n])=>h('button',{class:cat===c?'on':'',onclick:()=>{S.forgeCat=c;render();}},n))):null,
  h('section',{class:'card'},head('工房',`身上 ${p.gold} 金`),kind==='dragon'?h('p',{class:'small dim'},'生鏽／破爛的裝備＋鋼騎之礦＋魔族的水晶＋幻之鋼條／朴／百里香。王宮職階才穿得上。'):null,
   h('p',{class:'small dim'},'打好的裝備到「鑲寶石」分頁再鑲，先看數值擲得好不好。'),
   // 按等級分頁（Leo 2026-10-26：一次列全部眼睛會花）；預設開最高一級還有東西做得出來的那頁
   (()=>{const ready=id=>D.canForge(p,id,S.forgeGem||null).ok,lvs=[...new Set(mine.map(id=>ITEMS[id].lv))].sort((a,b)=>a-b);
    if(!lvs.includes(S.forgeLv))S.forgeLv=[...lvs].reverse().find(l=>mine.some(id=>ITEMS[id].lv===l&&ready(id)))||lvs[0];
    const shown=mine.filter(id=>ITEMS[id].lv===S.forgeLv&&(!S.forgeReady||ready(id)));
    return h('div',{},
     h('div',{class:'tabs wrap'},...lvs.map(l=>h('button',{class:'chip'+(S.forgeLv===l?' on':'')+(mine.some(id=>ITEMS[id].lv===l&&ready(id))?'':' dimmed'),onclick:()=>{S.forgeLv=l;render();}},`${l}級`))),
     h('div',{class:'row wrap small'},h('button',{class:'chip'+(S.forgeReady?' on':''),onclick:()=>{S.forgeReady=!S.forgeReady;render();}},'只看做得出來的'),h('button',{class:'chip'+(S.forgeAll?' on':''),onclick:()=>{S.forgeAll=!S.forgeAll;render();}},'也列穿不上的')),
     shown.length?null:h('p',{class:'small dim'},'這一級沒有做得出來的。'),
     ...shown.map(id=>{const rc=D.RECIPES[id],ok=ready(id),wear=P.canEquip(p,id),out=id;
      return h('div',{class:'row item forge'+(ok?'':' faded-soft')},h('div',{class:'grow'},gearLine(out),
       h('div',{class:'small'},...[...rc.mats.map(([m,n])=>{const have=D.matCount(p,m);return h('span',{class:have>=n?'ok':'warn'},have>=n?`${ITEMS[m].name}${n}`:`${ITEMS[m].name}${have}/${n}`);}),h('span',{class:p.gold>=rc.fee?'dim':'warn'},`${rc.fee}金`)].flatMap((x,i)=>i?[h('span',{class:'dim'},'・'),x]:[x]),wear.ok?h('span',{class:'dim'},''):h('span',{class:'dim'},'　穿不上'))),
       h('button',{class:'chip hot',disabled:!ok,onclick:act(()=>{const r=D.forge(p,id,null);if(r.ok){p.codex.forge++;E.track(p,'forge');}return r;},'win')},'打造'));}));})()),logBox());
}
// 鑲寶石（Leo 2026-10-28）：先選寶石，再點背包裡打好的裝備
// 工房最上面列操作中這位現在穿的（Leo 2026-10-28「工坊要可以看到自己現在穿什麼」），打造前好比較；點一列跳狀態頁那格換裝
function wearingCard(p){
 return h('section',{class:'card wearing'},h('div',{class:'head'},h('h2',{},`${p.name} 現在穿的`),h('button',{class:'chip',onclick:()=>{S.tab='status';S.pickSlot=null;render();scrollTo(0,0);}},'去換裝')),
  ...Object.entries(SLOT_NAMES).map(([slot,n])=>{const id=p.equip[slot];
   return h('div',{class:'row item gearrow',onclick:()=>{S.tab='status';S.pickSlot=slot;render();scrollTo(0,0);}},h('span',{class:'slot'},n),h('span',{class:'grow small'},id?gearLine(id):h('span',{class:'dim'},'—'),id?durTag(p,slot):null));}));
}
function socketView(kindTabs){
 const p=S.p,gems=D.gemsIn(p),items=D.socketable(p);if(S.forgeGem&&!gems.includes(S.forgeGem))S.forgeGem='';
 const g=S.forgeGem;
 return h('div',{},repairCard(),wearingCard(p),kindTabs,
  h('section',{class:'card'},head('鑲寶石','打好的裝備再鑲，一件一顆'),
   h('p',{class:'small dim'},'先選寶石，再點要鑲的裝備。穿在身上的先到狀態頁脫下來；鑲了就拆不下來，效果擲 80%～120%。'),
   gems.length?gemPicker(gems,'all'):h('p',{class:'small warn'},'身上沒有寶石。地下城的王會掉、敵對冒險者也有機會掉。'),
   items.length?null:h('p',{class:'small dim'},'背包裡沒有能鑲的裝備（飾品不能鑲，鑲過的不能再鑲）。'),
   ...items.map(id=>{const kind=ITEMS[id].slot==='weapon'?'weapon':'head',ok=g?D.canSocket(p,id,g):null,e=p.bag.find(x=>x.id===id);
    return h('div',{class:'row item forge'},h('div',{class:'grow'},gearLine(id),g?h('div',{class:'small gold'},`＋${D.gemEffect(g,kind)}`):null,e?.dur!=null?h('div',{class:'small dim'},`耐久 ${e.dur}/${E.maxDur(id)}`):null),
     h('button',{class:'chip hot',disabled:!g||!ok?.ok,title:ok&&!ok.ok?ok.msg:'',onclick:act(()=>D.socketGem(p,id,g),'win')},'鑲'));})),
  logBox());
}
function arenaView(){
 if(!S.against){S.against=[];boutsAgainstMe().then(l=>{S.against=l;if(S.tab==='arena'&&!S.battle)render();});}
 // 在線上的人可以找他即時 PK（Leo 2026-10-28）；不在的照舊由電腦代打
 const row=r=>{const on=!r.npc&&isOnline(r);return h('div',{class:'row item rival'},face(r.look,48),h('div',{class:'grow'},h('b',{},r.name),r.npc?null:ownerTag(r.acct),on?h('span',{class:'small gold'},' ● 線上'):null,h('span',{class:'small'},`　Lv${r.lv} ${rankName(r.job,r.rank)}`),h('div',{class:'small dim'},r.npc?`${GENERAL_BY_ID[r.look]?.faction||''}・競技場常駐`:`${r.w} 勝 ${r.l} 敗`)),
  on?h('button',{class:'hot',disabled:!!S.pkWait,onclick:()=>challenge(r)},'即時 PK'):null,on?h('button',{class:'hot',disabled:!!S.pkWait,onclick:()=>challenge(r,'team')},'團 PK'):null,h('button',{class:on?'ghost':'hot',onclick:()=>startBout(r)},on?'代打':'挑戰'));};
 const rivals=[...S.rivals].sort((a,b)=>(isOnline(b)-isOnline(a))||b.lv-a.lv),onN=rivals.filter(isOnline).length;
 return h('div',{},
  h('section',{class:'card'},head('競技場',`${p0().w||0} 勝 ${p0().l||0} 敗`),h('p',{class:'small dim'},'一對一。雙方補滿再打，打完不扣血；30 回合沒分勝負比剩下的生命比例。'),h('p',{class:'small dim'},R.PK_HELP),S.online?h('p',{class:'small dim'},R.TEAM_HELP):null,h('p',{class:'small dim'},`上擂台、一對一 PK 的是現在操作的 ${p0().name}（角色頁最上面點臉可以換人）。`)),
  seasonCard(),
  S.online?h('section',{class:'card'},head('你的名稱','擂台、借將上顯示給別人看，讓人知道這是誰的角色'),pidBox()):null,
  h('section',{class:'card'},head('線上的冒險者',S.rivals.length?`${S.rivals.length} 人${onN?`，${onN} 人在線上`:''}`:''),S.rivals.length?null:h('p',{class:'dim small'},S.online?'還沒有別人建立角色。':'這是離線版，只有常駐好手。'),...rivals.map(row)),
  h('section',{class:'card'},head('常駐名將'),...S.npcs.map(row)),
  S.against?.length?h('section',{class:'card'},head('有人來挑戰過你'),...S.against.map(r=>h('p',{class:'small'},`${r.byName} 挑戰你，${r.win===1?'他贏了':r.win===0?'你守住了':'平手'}　${new Date(r.t).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`))):null);
}
// ---------- 交易所 ----------
function marketView(){
 const p=S.p;
 if(!S.online)return h('section',{class:'card'},head('交易所'),h('p',{class:'dim'},'交易所要在發布的網頁（連線版）才開。這裡是離線版。'));
 const mine=S.market.filter(l=>l.seller===S.uid),others=S.market.filter(l=>l.seller!==S.uid&&!l.buyer);
 const sellable=[...p.bag.filter(x=>ITEMS[x.id].kind!=='key'),...matList(p).map(([id,n])=>({id,n}))];if(!sellable.some(x=>x.id===S.mkPick))S.mkPick=sellable[0]?.id||'';
 const run=fn=>async()=>{if(S.mkBusy)return;S.mkBusy=true;S.mkMsg='……';render();const r=await fn();S.mkBusy=false;S.mkMsg=r.msg||'';if(r.msg)say(r.msg,r.ok?'win':'sys');render();};
 const sel=h('select',{onchange:e=>{S.mkPick=e.target.value;}},...sellable.map(x=>h('option',{value:x.id,selected:x.id===S.mkPick},`${ITEMS[x.id].name}${x.n>1&&!ITEMS[x.id].slot?` ×${x.n}`:''}`)));
 const inp=h('input',{type:'number',inputmode:'numeric',min:1,placeholder:'價錢（金）',value:S.mkPrice||'',oninput:e=>{S.mkPrice=e.target.value;}});
 return h('div',{},
  h('section',{class:'card'},head('交易所',`身上 ${p.gold} 金`),h('p',{class:'small dim'},`賣掉的錢下次打開遊戲時收進來，最多掛 ${LIST_MAX} 張單。`),
   S.mkMsg?h('p',{class:'note'},S.mkMsg):null,
   sellable.length?h('div',{class:'sellform'},sel,inp,h('button',{class:'hot',disabled:S.mkBusy,onclick:run(async()=>{const r=await postListing(p,S.mkPick,S.mkPrice,mine.length);if(r.ok)S.mkPrice='';return r;})},'上架')):h('p',{class:'dim small'},'道具欄沒有能賣的東西。')),
  h('section',{class:'card'},head('掛單',`${others.length} 張`),others.length?null:h('p',{class:'dim small'},'現在沒有人在賣東西。'),
   ...others.map(l=>h('div',{class:'row item'},h('div',{class:'grow'},ITEMS[l.item].slot?gearLine(l.item):itemName(l.item,l.n),h('div',{class:'small dim'},`賣家：${l.sellerName}`)),
    h('button',{class:'buy',disabled:S.mkBusy||p.gold<l.price,onclick:run(()=>buyListing(p,l))},`${l.price} 金`)))),
  mine.length?h('section',{class:'card'},head('我的掛單',`${mine.length}/${LIST_MAX}`),...mine.map(l=>h('div',{class:'row item'},h('div',{class:'grow'},itemName(l.item,l.n),h('div',{class:'small dim'},l.buyer?`${l.buyerName} 買了，收錢中`:`${l.price} 金`)),
   l.buyer?null:h('button',{class:'ghost',disabled:S.mkBusy,onclick:run(()=>cancelListing(p,l))},'收回')))):null);
}
// ---------- 新手引導（Leo 2026-10-28）：第一次進城，照進度一次一張卡帶到就職、學招、練功、打造；按「不用了」或走完就不再出現（p.flags.tutDone） ----------
const TUT_STEPS=[
 {when:p=>p.job==='none',t:'先到公會就職',d:'遊民什麼招都學不了。公會有九種職業，看「攻略」挑一個；就職後 BP 配點在狀態頁。',go:'guild',btn:'去公會'},
 {when:p=>!p.skills.length,t:'到技能大師學第一招',d:'就職了就能學本行的技能，先學一招攻擊或補血的，練功會快很多。',go:'master',btn:'去技能大師'},
 {when:p=>p.lv<5,t:'到野外練功',d:'冒險→練功，芙蕾雅最適合新手。開「自動戰鬥」和「自動下一場」可以掛著打，生命不到三成會自己停。',go:'hunt',btn:'去練功'},
 {when:p=>p.lv<12,t:'到工房打造裝備',d:'商店只賣國民裝備，好裝備要拿打怪掉的礦石、木材、毛皮到工房做，賣魔石的錢拿來付工錢。',go:'forge',btn:'去工房'},
 {when:p=>true,t:'接下來',d:'通關地下城後，城中「迷宮王」可以單挑或找線上朋友「組隊打」；要約人就到「布告」。祝你玩得開心！',go:'',btn:''},
];
function tutCard(){
 const p=S.p;if(p.flags?.tutDone)return null;const st=TUT_STEPS.find(s=>s.when(p)),i=TUT_STEPS.indexOf(st),done=()=>{p.flags.tutDone=true;save();render();};
 return h('section',{class:'card tut'},h('div',{class:'row between'},h('b',{},`新手引導 ${i+1}／${TUT_STEPS.length}：${st.t}`),h('button',{class:'ghost small',onclick:done},'不用了')),
  h('p',{class:'small'},st.d),st.go?h('button',{class:'main',onclick:go2(st.go)},st.btn):h('button',{class:'main',onclick:done},'知道了'));
}
// ---------- 布告（Leo 2026-10-28）：大家共用的留言板，約組隊、聊天；最近 50 則 ----------
const ago=t=>{const m=Math.floor((Date.now()-(+t||0))/60000);return m<1?'剛剛':m<60?`${m} 分鐘前`:m<1440?`${Math.floor(m/60)} 小時前`:`${Math.floor(m/1440)} 天前`;};
function boardView(){
 const p=S.p;
 if(!S.online)return h('section',{class:'card'},head('布告'),h('p',{class:'dim'},'布告要在連線版才有。'));
 const run=fn=>async()=>{if(S.mkBusy)return;S.mkBusy=true;render();const r=await fn();S.mkBusy=false;S.boardMsg=r?.msg||'';render();};
 return h('div',{},
  h('section',{class:'card'},head('布告',`最近 ${BOARD_MAX} 則`),h('p',{class:'small dim'},'要約人打迷宮王、交易、閒聊都在這裡。只留最近的留言，舊的會自動消失。'),
   S.boardMsg?h('p',{class:'note'},S.boardMsg):null,
   h('div',{class:'sellform'},h('input',{type:'text',maxlength:BOARD_LEN,placeholder:`寫點什麼（最多 ${BOARD_LEN} 字）`,value:S.boardText,oninput:e=>{S.boardText=e.target.value;},onkeydown:e=>{if(e.key==='Enter')e.target.parentNode.querySelector('button').click();}}),
    h('button',{class:'hot',disabled:S.mkBusy,onclick:run(async()=>{const r=await postBoard(p,S.boardText,S.board);if(r.ok)S.boardText='';return r;})},'貼出'))),
  h('section',{class:'card'},S.board.length?null:h('p',{class:'dim small'},'還沒有人留言。'),
   ...S.board.map(m=>h('div',{class:'row item'},h('div',{class:'grow'},h('div',{class:'small'},h('b',{},m.name||'？'),h('span',{class:'dim'},`　${ago(m.t)}`)),h('div',{},m.text)),
    m.uid===S.uid?h('button',{class:'ghost small',disabled:S.mkBusy,onclick:run(async()=>{await deleteBoard(m);return {msg:''};})},'刪'):null))));
}
// ---------- 攻略 ----------
function guideView(){
 const id=S.guide,g=GUIDE[id],f=jobFacts(id),total=g.bp.reduce((a,b)=>a+b,0);
 return h('div',{},
  h('section',{class:'card'},head('職業攻略','一個人出戰、一回合兩動的打法'),
   h('div',{class:'tabs wrap'},...R.MUD_JOBS.map(j=>h('button',{class:id===j?'on':'',onclick:()=>{S.guide=j;render();}},JOBS[j].name))),
   h('div',{class:'guide'},
    h('h3',{class:'g-title'},JOBS[id].name,h('span',{class:'small dim'},`　${g.role}`)),
    h('table',{class:'kv'},...[['武器',f.weapons],['防具',f.armor],['專長技能',f.main.join('、')],['職階',f.ranks.join(' → ')]].map(([k,v])=>h('tr',{},h('th',{},k),h('td',{},v)))),
    h('h4',{},'建議配點（每升一級 4 點）'),
    h('div',{class:'bpbar'},...BP_KEYS.map((k,i)=>g.bp[i]?h('span',{class:'bp-'+k,style:{flex:g.bp[i]}},`${BP_NAMES[k][0]} ${Math.round(g.bp[i]/total*100)}%`):null)),
    h('h4',{},'先學'),h('p',{},g.learn.map(s=>SKILLS[s].name).join(' → ')),
    h('h4',{},'擂台'),h('p',{},g.pvp),
    h('h4',{},'練功'),h('p',{},g.hunt))),
  h('section',{class:'card'},head('BP 換算','每 1 點'),h('table',{class:'kv'},...BP_TABLE.map(([k,v])=>h('tr',{},h('th',{},k),h('td',{class:'small'},v))))),
  h('section',{class:'card'},head('新手須知'),...TIPS.map(([t,x])=>h('div',{class:'item'},h('b',{},t),h('p',{class:'small'},x)))));
}

// ---------- 活動（events.mjs） ----------
function durTag(c,slot){const id=c.equip[slot],v=E.durOf(c,slot),m=E.maxDur(id);return h('small',{class:'dur'+(v<=0?' warn':v<m*.2?' low':'')},v<=0?'　壞了':`　耐久 ${v}/${m}`);}
const rankRows=(rows,unit)=>rows.length?h('ol',{class:'board small'},...rows.slice(0,10).map(r=>h('li',{class:r.me?'me':''},h('span',{},r.name),h('b',{},`${r.n.toLocaleString()} ${unit}`)))):h('p',{class:'small dim'},'還沒有人上榜。');
function worldView(){
 const p=S.p;E.roll(p);const w=E.wbOf(),left=E.wbLeft(S.docs,S.me,p),rows=E.wbBoard(S.docs,S.me,p),prize=E.wbPrize(S.docs,S.me,p),tries=E.WB_TRIES-p.wb.tries;
 return h('div',{},
  prize?h('section',{class:'card'},head('上週的獎勵',`第 ${prize.rank} 名`),h('button',{class:'main wide',onclick:act(()=>E.claimWb(S.docs,S.me,p),'win')},'領取')):null,
  h('section',{class:'card'},head(`本週世界王：${w.name}`,`剩 ${left.toLocaleString()} / ${E.WB_HP.toLocaleString()}`),
   h('div',{class:'row'},face(w.look,56),h('div',{class:'grow'},meter('hp',left,E.WB_HP,`共用生命 ${Math.round(left/E.WB_HP*100)}%`),
    h('p',{class:'small dim'},`大家一起打同一隻。每天 ${E.WB_TRIES} 次、每次 ${E.WB_ROUNDS} 回合，打掉多少算多少；補滿血打，打完不扣。王的強度跟著你的等級。`))),
   h('p',{class:'small'},`你這週打了 ${p.wb.dmg.toLocaleString()}。每次拿到傷害×0.3 的錢；週一結算排名：第 1 名 7 級寶石＋稱號＋鼠王寶石的碎片、前 3 名 5 級、其他 3 級，有打倒再加一級。`),
   h('button',{class:'main wide',disabled:tries<=0||left<=0||p.lv<10,onclick:startWorld},p.lv<10?'10 級才能挑戰':left<=0?'這週已經打倒了':tries>0?`挑戰（今天還有 ${tries} 次）`:'今天的次數用完了')),
  h('section',{class:'card'},head('本週傷害排名',S.online?'':'離線版只有自己'),rankRows(rows,'')),logBox());
}
function startWorld(){
 const r=E.startWorld(S.p,E.wbLeft(S.docs,S.me,S.p),(Math.random()*2**31)>>>0);if(!r.ok){say(r.msg);render();return;}
 S.battle={b:r.b,kind:'world',scene:'courtyard',lines:[{c:'sys',t:`世界王：${E.wbOf().name}（剩 ${E.wbLeft(S.docs,S.me,S.p).toLocaleString()}）擋在前面！${E.WB_ROUNDS} 回合，盡量打。`}]};
 save();beginBattle();
}
function seasonCard(){
 const p=S.p;E.roll(p);const rows=E.seasonBoard(S.docs,S.me,p),prize=E.seasonPrize(S.docs,S.me,p);
 return h('section',{class:'card'},head('本週賽季',`你 ${p.season.pts} 分`),
  h('p',{class:'small dim'},`每場：贏線上玩家 等級×${E.BOUT_GOLD.win} 金＋3 分、贏常駐名將 等級×${E.BOUT_GOLD.npcWin} 金＋1 分、平手 等級×${E.BOUT_GOLD.draw} 金＋1 分，一天算前 ${E.SEASON_DAILY} 場；連勝 3／5／10 場另給水晶碎片 1／2／3 片${p.season.streak?`（現在 ${p.season.streak} 連勝）`:''}。週一結算：第 1 名「擂台王者」＋6 級寶石、前 3 名「擂台好手」＋4 級、前 10 名 2 級，有打都拿 1000 金。`),
  prize?h('button',{class:'main wide',onclick:act(()=>E.claimSeason(S.docs,S.me,p),'win')},`領上週獎勵（第 ${prize.rank} 名）`):null,
  rankRows(rows,'分'));
}
function dailyView(){
 const p=S.p;E.roll(p);const rw=E.dailyReward(p);
 return h('div',{},h('section',{class:'card'},head('每日委託','每天換新'),h('p',{class:'small dim'},`每個 ${rw.gold} 金、聲望 ${rw.rep}、升一級所需經驗的 ${E.DAILY_EXP*100}%（夥伴也有）；三個都做完再送一顆寶石。`),
  ...p.daily.tasks.map((t,i)=>h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},E.dailyName(t)),meter('exp',t.got,t.need,`${t.got}/${t.need}`)),
   t.claimed?h('span',{class:'small ok'},'已領'):h('button',{class:'hot',disabled:t.got<t.need,onclick:act(()=>E.claimDaily(p,i),'win')},'領取')))),logBox());
}
function codexView(){
 const p=S.p;E.roll(p);const all=E.allMonsters(),k=p.codex.kill;
 return h('div',{},
  h('section',{class:'card'},head('成就','達成就能領'),...E.ACH.map(([key,name,f,rw,title])=>{const [v,need]=f(p),done=!!p.ach[key];
   return h('div',{class:'row item'},h('div',{class:'grow'},h('b',{},name),h('div',{class:'small dim'},`稱號「${title}」＋${rw.gem?`${rw.gem} 級寶石`:`${rw.gold} 金`}`),done?null:meter('exp',Math.min(v,need),need,`${Math.min(v,need)}/${need}`)),
    done?h('span',{class:'small ok'},'已領'):h('button',{class:'hot',disabled:v<need,onclick:act(()=>E.claimAch(p,key),'win')},'領取'));})),
  h('section',{class:'card'},head('魔物圖鑑',`${Object.keys(k).filter(id=>all.includes(id)).length}/${all.length}`),
   h('div',{class:'codex'},...all.map(id=>h('span',{class:k[id]?'got':''},k[id]?`${MONSTERS[id].name}・${k[id]}`:'？？？')))));
}
function borrowCard(){
 const p=S.p,g=p.guest;
 if(g)return h('section',{class:'card'},head('借將',`${g.name} 還會跟 ${g.left} 場`),h('p',{class:'small dim'},`${g.owner?`這是玩家「${g.owner}」的角色，`:''}跟你練功、打地下城，電腦代打、不拿經驗。`));
 const list=S.rivals.filter(r=>!r.npc).slice(0,12);
 const can=E.canBorrow(p);
 return h('section',{class:'card'},head('借將','借線上玩家的角色多帶一位'),
  h('p',{class:'small dim'},`有夥伴、隊伍還沒滿 ${R.PARTY_MAX} 人時可以借，跟你打 ${E.GUEST_FIGHTS} 場練功或地下城。租金＝他的等級×30，一半給他。`),
  !S.online?h('p',{class:'small dim'},'離線版借不到人。'):!can.ok?h('p',{class:'small dim'},can.msg):list.length?null:h('p',{class:'small dim'},'現在沒有別的玩家。'),
  ...(S.online&&can.ok?list.map(r=>h('div',{class:'row item'},face(r.look,40),h('div',{class:'grow'},h('b',{},r.name),r.acct?h('span',{class:'small dim'},`　${r.acct} 的`):null,h('div',{class:'small dim'},`Lv${r.lv} ${rankName(r.job,r.rank)}`)),
   h('button',{class:'hot',disabled:p.gold<E.guestFee(r.fighter),onclick:act(()=>E.borrow(p,r),'win')},`${E.guestFee(r.fighter)} 金`))):[]));
}
function repairCard(){
 const p=S.p,who=[0,...R.mateIds(p)],rows=who.flatMap(i=>{const c=charOf(i);return Object.keys(c.equip||{}).filter(s=>c.equip[s]&&E.repairFee(c,s)>0).map(s=>[i,c,s]);});
 if(!rows.length)return null;const total=rows.reduce((n,[,c,s])=>n+E.repairFee(c,s),0);
 return h('section',{class:'card'},head('修理',`全部 ${total} 金`),
  h('button',{class:'wide',disabled:p.gold<total,onclick:act(()=>{let sum=0;for(const i of who){const c=charOf(i),fee=Object.keys(c.equip||{}).reduce((n,s)=>n+E.repairFee(c,s),0);const x=E.repair(p,c);if(x.ok)sum+=fee;else if(x.msg!=='不用修。')return x;}return sum?{ok:true,msg:`全部修好了，花了 ${sum} 金。`}:{ok:false,msg:''};},'sys')},`全部修好（${total} 金）`), // 訊息寫總共花多少（楓洋 2026-10-28：顯示 18000 卻扣 54000，之前只寫最後一位的）
  ...rows.map(([i,c,s])=>h('div',{class:'row item'},h('span',{class:'grow small'},`${c.name}・${ITEMS[c.equip[s]].name}`,durTag(c,s)),h('button',{class:'chip',disabled:p.gold<E.repairFee(c,s),onclick:act(()=>E.repair(p,charOf(i),s),'sys')},`${E.repairFee(c,s)} 金`))));
}

// ---------- 戰鬥 ----------
function startHunt(spot){
 const b=D.startHunt(S.p,spot,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'hunt',spot,scene:R.SPOTS[spot].scene,lines:[{c:'sys',t:`${R.SPOTS[spot].name}${b.floor>1?` 第 ${b.floor} 層`:''}：遇到${b.team?`敵對的${b.team}：`:''}${R.foes(b).map(u=>`${u.name} Lv${u.lv}`).join('、')}！`}]};
 beginBattle();
}
function startFloor(){
 const p=S.p,d=D.DUNGEON_BY_ID[p.dg.id],drank=p.dg.floor>1?drinkBetween():[],b=D.startFloor(p,(Math.random()*2**31)>>>0),boss=p.dg.floor>=D.FLOORS;
 S.battle={b,kind:'dungeon',scene:d.lv<20?'cave':'courtyard',lines:[...(drank.length?[{c:'sys',t:drank.join('、')+'。'}]:[]),{c:'sys',t:boss?`${d.name}最深處：${D.bossLabel(d)}擋在前面！`:`${d.name}第 ${p.dg.floor} 層：遇到${R.foes(b).map(u=>`${u.name} Lv${u.lv}`).join('、')}！`}]};
 beginBattle();
}
// ---------- 即時 PK（Leo 2026-10-28）：挑戰的人算、對方照著播，單子在資料庫 pk/<id> ----------
const clearChallenge=w=>{w.unsub?.();clearTimeout(w.timer);if(S.pkWait===w)S.pkWait=null;};
// kind：'pk' 一對一、'team' 團 PK（Leo 2026-10-28：整隊對整隊，邀請單多帶自己整隊的描述 hostT）
async function challenge(r,kind='pk'){
 if(S.pkWait||S.battle)return;const w=S.pkWait={rival:r,id:null,kind,msg:'送出邀請中……'};render();
 const id=await sendChallenge(S.p,r,kind==='team'?{kind:'team',hostT:R.teamOf(S.p)}:{});if(!id){clearChallenge(w);say('邀請送不出去，等一下再試。');render();return;}
 w.id=id;w.msg=`等 ${r.name} 接受……`;if(S.pkWait===w)render();
 const unsub=await watchPk(id,d=>{if(S.pkWait!==w)return;
  if(!d){clearChallenge(w);pkNote('邀請被取消了。');render();return;}
  if(d.state==='on'){clearChallenge(w);startPkBattle('host',d);return;}
  if(d.state==='declined'){clearChallenge(w);deletePk(id);pkNote(`${r.name} 婉拒了。`);render();}});
 w.unsub=unsub;if(S.pkWait!==w){unsub();return;}
 w.timer=setTimeout(()=>{if(S.pkWait===w){clearChallenge(w);deletePk(id);pkNote(`${r.name} 沒有回應。`);render();}},R.PK_ASK_TTL);
}
function cancelChallenge(){const w=S.pkWait;if(!w)return;clearChallenge(w);if(w.id)deletePk(w.id);render();}
const pkNote=t=>{S.pkNote={t,at:Date.now()};say(t);};
function pkWaitCard(){const w=S.pkWait;
 if(!w)return S.pkNote&&Date.now()-S.pkNote.at<20000?h('section',{class:'card pk'},h('div',{class:'row item'},h('span',{class:'grow small'},S.pkNote.t),h('button',{class:'ghost',onclick:()=>{S.pkNote=null;render();}},'知道了'))):null;
 return h('section',{class:'card pk'},h('div',{class:'row item'},face(w.rival.look,40),h('div',{class:'grow'},h('b',{},w.kind==='team'?'團 PK':'即時 PK'),h('div',{class:'small dim'},w.msg)),h('button',{class:'ghost',onclick:cancelChallenge},'取消')));}
// 別人找我：最上面一張卡，接受就開打
function pkAskCard(){
 const now=Date.now(),list=S.pkAsks.filter(c=>now-(+c.t||0)<R.PK_ASK_TTL);if(!list.length||S.pkWait||S.coopWait)return null;const c=list[0],f=c.hostF||{};
 if(c.kind==='coop'){const d=D.DUNGEON_BY_ID[c.dg];return h('section',{class:'card pk'},h('div',{class:'row item'},GENERAL_BY_ID[f.look]?face(f.look,40):null,h('div',{class:'grow'},h('b',{},`${c.hostName||'有人'}${c.hostAcct?`（${c.hostAcct}）`:''} 找你一起打迷宮王`),h('div',{class:'small dim'},`${d?`${d.boss}（Lv${d.lv}）`:'？'}・每人帶自己的角色，補滿再打、打完不扣`)),
  h('button',{class:'hot',disabled:!!S.coop||!!S.battle,onclick:()=>acceptInvite(c,true)},'加入'),h('button',{class:'ghost',onclick:()=>acceptInvite(c,false)},'婉拒')));}
 if(c.kind==='team'){const n=(c.hostT?.units||[]).length,mine=R.teamOf(S.p).units.length;return h('section',{class:'card pk'},h('div',{class:'row item'},GENERAL_BY_ID[f.look]?face(f.look,40):null,h('div',{class:'grow'},h('b',{},`${c.hostName||'有人'}${c.hostAcct?`（${c.hostAcct}）`:''} 找你團 PK`),h('div',{class:'small dim'},`他帶 ${n} 個、你帶 ${mine} 個（帶頭、出門的夥伴、出戰的收服者）・補滿再打、打完不扣`)),
  h('button',{class:'hot',onclick:()=>acceptChallenge(c,true)},'接受'),h('button',{class:'ghost',onclick:()=>acceptChallenge(c,false)},'婉拒')));}
 return h('section',{class:'card pk'},h('div',{class:'row item'},GENERAL_BY_ID[f.look]?face(f.look,40):null,h('div',{class:'grow'},h('b',{},`${c.hostName||'有人'}${c.hostAcct?`（${c.hostAcct}）`:''} 找你即時 PK`),h('div',{class:'small dim'},`Lv${f.lv||'?'} ${rankName(f.job,f.rank)}・補滿再打、打完不扣`)),
  h('button',{class:'hot',onclick:()=>acceptChallenge(c,true)},'接受'),h('button',{class:'ghost',onclick:()=>acceptChallenge(c,false)},'婉拒')));
}
async function acceptChallenge(c,ok){
 if(S.battle)return;S.pkAsks=S.pkAsks.filter(x=>x.id!==c.id);render();
 const myT=c.kind==='team'?R.teamOf(S.p):null; // 團 PK：自己整隊的描述寫上單子，開打也用同一份
 const done=await answerChallenge(S.p,c,ok,myT);if(!ok)return;
 if(!done){pkNote('接受失敗，對方可能已經取消。');render();return;}
 startPkBattle('guest',{...c,state:'on',...(myT?{guestT:myT}:{})});
}
function startPkBattle(role,d){
 const p=S.p,team=d.kind==='team',myT=team?(role==='host'?d.hostT:d.guestT):null,foeT=team?(role==='host'?d.guestT:d.hostT):null;
 const f=team?R.heroFrom(foeT?.units?.[0]?.hero):R.fighterFrom(role==='host'?d.guestF:d.hostF);if(!f||(team&&!myT)){say('對方的角色資料讀不到。');render();return;}
 const foeUid=role==='host'?d.guest:d.host,b=team?R.startTeam(myT,foeT,(+d.seed||1)>>>0):R.startBout(p,f,(+d.seed||1)>>>0);
 if(team&&(!R.allies(b).length||!R.foes(b).length)){say('隊伍資料讀不到，開不了團 PK。');render();return;}
 const rival={key:'fighters/'+foeUid,uid:foeUid,npc:false,name:f.name,look:f.look,lv:f.lv,job:f.job,rank:f.rank,fighter:f};
 // uid 對應：一對一是 p↔e0；團 PK 照兩隊的順序（R.teamMap）。toThem＝自己的叫法→對方畫面的叫法，fromThem 反過來
 const map=team?{toThem:R.teamMap(R.teamUids(myT),R.teamUids(foeT)),fromThem:R.teamMap(R.teamUids(foeT),R.teamUids(myT))}:{toThem:R.flipUid,fromThem:R.flipUid};
 S.pkAsks=[];const B=S.battle={b,kind:'pk',rival,scene:'sect',pk:{id:d.id,role,team,map,foeName:f.name,doc:d,ai:0},lines:[{c:'sys',t:team?`團 PK：${p.name}的隊伍（${R.allies(b).length} 個）對 ${f.name}的隊伍（${R.foes(b).length} 個）——${R.foes(b).map(u=>u.name+(u.row==='back'?'（後排）':'')).join('、')}`:`即時 PK：${p.name} 對 ${f.name}（Lv${f.lv} ${rankName(f.job,f.rank)}）`}]};
 watchPk(d.id,doc=>{if(S.battle!==B){B.pk.unsub?.();return;}pkDoc(B,doc);}).then(u=>{B.pk.unsub=u;if(S.battle!==B)u();});
 beginBattle();
}
// 單子有變：挑戰的人看對方的指令到了沒；被挑戰的人看結果到了沒
function pkDoc(B,d){
 const k=B.pk,b=B.b;k.doc=d;if(b.over)return;const idle=!B.busy||!!B.wait;
 if(!d){if(idle)pkEndBy(B,'win',`${k.foeName}離開了，這場算你贏。`);return;}
 if(d.ff){if(idle)pkEndBy(B,d.ff===k.role?'lose':'win',d.ff===k.role?'你認輸了。':`${k.foeName}認輸了。`);return;}
 if(k.role==='host'){pkTry(B);return;}
 const r=d.res;if(r&&r.n>b.round&&!k.playing){k.playing=true;clearTimeout(k.timer);B.lost=false;
  if(r.n>b.round+1)B.lines.push({c:'sys',t:'（中間少接到一回合，直接接上）'});
  R.applySnap(b,r.snap,k.map.fromThem,true);B.wait='';showRound(B,R.mapEvents(r.ev,k.map.fromThem)).then(()=>{k.playing=false;if(S.battle===B&&k.doc!==d)pkDoc(B,k.doc);});}
}
function pkEndBy(B,over,text){const k=B.pk;clearTimeout(k.timer);B.b.over=over;B.wait='';B.lost=false;B.lines.push({c:'sys',t:text});showRound(B,[]);}
// 自己這回合的指令：挑戰的人留著等對方；被挑戰的人寫到單子上等結果
async function pkSubmit(B,cmds){
 const k=B.pk,b=B.b,mine=new Set(R.allies(b).filter(u=>u.kind!=='pet').map(u=>u.uid)),clean=R.cleanCmds(cmds.filter(c=>mine.has(c.actor)));B.wait=`等 ${k.foeName} 下令……`;battleView();clearTimeout(k.timer); // 自己這邊的人（收服者由電腦）
 if(k.role==='host'){k.my={n:b.round+1,cmds:clean};pkTry(B);
  k.timer=setTimeout(()=>{if(S.battle===B&&k.my&&k.my.n===b.round+1)pkResolve(B,null);},R.PK_WAIT*1000);}
 else{k.sent={n:b.round+1,cmds:clean};const ok=await writePk(k.id,{gc:k.sent});if(!ok&&S.battle===B)B.lines.push({c:'sys',t:'指令送不出去，再等一下……'});
  k.timer=setTimeout(()=>{if(S.battle===B&&!b.over&&b.round<k.sent.n){B.lost=true;battleView();}},R.PK_GONE*1000);}
}
function pkTry(B){const k=B.pk,b=B.b,d=k.doc;if(!k.my||k.my.n!==b.round+1||B.b.over)return;if(d?.gc?.n===b.round+1)pkResolve(B,d.gc.cmds);}
async function pkResolve(B,guestCmds){
 const k=B.pk,b=B.b,my=k.my;if(!my)return;k.my=null;clearTimeout(k.timer);
 k.ai=guestCmds?0:k.ai+1;const gc=guestCmds?R.foeCmds(b,R.mapCmds(guestCmds,k.map.fromThem)):[];
 const ev=R.resolveRound(b,[...my.cmds,...gc]);R.boutTimeout(b);
 if(!guestCmds)ev.push({t:'msg',text:`${k.foeName}沒下令，由電腦代打。`});
 if(k.ai>=3&&!b.over){b.over='win';ev.push({t:'msg',text:`${k.foeName}一直沒有回應，這場算你贏。`});}
 writePk(k.id,{res:{n:b.round,ev,snap:R.pkSnap(b)},...(b.over?{state:'done'}:{})});
 B.wait='';await showRound(B,ev);
}
function pkForfeit(B){const k=B.pk;B.ffAsk=false;writePk(k.id,{ff:k.role});pkEndBy(B,'lose','你認輸了。');}
function pkGone(B){const k=B.pk;writePk(k.id,{ff:k.role==='host'?'guest':'host'});pkEndBy(B,'win',`${k.foeName}沒有回應，這場算你贏。`);}
// ---------- 線上組隊打迷宮王（Leo 2026-10-28）：隊長開隊、邀線上的人，出發後隊長算回合、隊員送指令；單子在 party/<id>，邀請用 pk/ 的單子 ----------
async function coopStart(dg){
 if(S.coop||S.coopWait||S.battle)return;const c=S.coop={id:null,dg,members:[{uid:S.uid,name:S.p.name,f:R.publicOf(S.p)}],invited:{},notes:[],msg:'開隊中……'};render();
 const id=await createParty(S.p,dg);if(!id||S.coop!==c){if(S.coop===c)S.coop=null;say('開不了隊，等一下再試。');render();return;}
 c.id=id;c.msg='';render();
 const unsub=await watchInvites(list=>{if(S.coop!==c)return;let changed=false;
  for(const x of list){if(x.party!==id)continue;const was=c.invited[x.guest];
   if(x.state==='on'&&!c.members.some(m=>m.uid===x.guest)&&c.members.length<R.COOP_MAX&&x.guestF){c.members.push({uid:x.guest,name:x.guestName||'',f:x.guestF});changed=true;}
   if(x.state==='declined'&&was!=='declined'){c.invited[x.guest]='declined';c.notes.push(`${x.guestName} 婉拒了。`);deletePk(x.id);changed=true;}}
  if(changed)render();});
 c.unsub=unsub;if(S.coop!==c)unsub();
}
async function coopInvite(r){const c=S.coop;if(!c?.id||c.invited[r.uid])return;c.invited[r.uid]='ask';render();const pid=await inviteParty(S.p,c.id,c.dg,r);if(!pid){delete c.invited[r.uid];}else c.invited[r.uid]=pid;render();}
function coopDisband(){const c=S.coop;if(!c)return;c.unsub?.();S.coop=null;if(c.id)deleteParty(c.id);for(const v of Object.values(c.invited))if(v&&v!=='ask'&&v!=='declined')deletePk(v);render();}
async function coopGo(){
 const c=S.coop;if(!c?.id||c.members.length<R.COOP_MIN||c.going)return;c.going=true;c.msg='出發！';render();
 const seed=(Math.random()*2**31)>>>0,members=c.members.slice(0,R.COOP_MAX);
 const ok=await writeParty(c.id,{state:'on',members,seed});if(!ok){c.going=false;c.msg='出發失敗，再按一次。';render();return;}
 c.unsub?.();S.coop=null;for(const v of Object.values(c.invited))if(v&&v!=='ask'&&v!=='declined')deletePk(v);
 startCoopBattle({id:c.id,dg:c.dg,members,seed,host:S.uid},0);
}
function coopCard(){
 const c=S.coop;if(!c)return null;const d=D.DUNGEON_BY_ID[c.dg],n=c.members.length;
 const cands=S.rivals.filter(r=>!r.npc&&isOnline(r)&&!c.members.some(m=>m.uid===r.uid));
 return h('section',{class:'card pk'},head('組隊打迷宮王',`${d.boss} Lv${d.lv}`),
  h('div',{class:'row wrap'},...c.members.map(m=>{const f=m.f||{};return h('span',{class:'chip on'},GENERAL_BY_ID[f.look]?face(f.look,24):null,` ${m.name} Lv${f.lv||'?'}`);})),
  h('p',{class:'small dim'},c.msg||`${n}／${R.COOP_MAX} 人${n<R.COOP_MIN?`，再找 ${R.COOP_MIN-n} 位就能出發`:''}。王的生命 ×${D.COOP_HP(Math.max(n,R.COOP_MIN)).toFixed(2)}、護衛 ${D.coopGuardN(Math.max(n,R.COOP_MIN))} 個（照人數）。`),
  ...c.notes.slice(-3).map(t=>h('p',{class:'small warn'},t)),
  n<R.COOP_MAX?h('div',{class:'list'},cands.length?null:h('p',{class:'small dim'},'現在沒有別的人在線上。'),
   ...cands.map(r=>h('div',{class:'row item'},face(r.look,32),h('div',{class:'grow'},h('b',{},r.name),h('span',{class:'small'},`　Lv${r.lv} ${rankName(r.job,r.rank)}`)),
    h('button',{class:'hot',disabled:!c.id||!!c.invited[r.uid],onclick:()=>coopInvite(r)},c.invited[r.uid]==='declined'?'婉拒了':c.invited[r.uid]?'邀請中':'邀請')))):null,
  h('div',{class:'row'},h('button',{class:'main',disabled:n<R.COOP_MIN||!!c.going,onclick:coopGo},n<R.COOP_MIN?'人還不夠':'出發'),h('button',{class:'ghost',style:{whiteSpace:'nowrap'},onclick:coopDisband},'解散')));
}
// 被邀的人：按加入後等隊長出發
async function acceptInvite(c,ok){
 if(S.battle||S.coop)return;S.pkAsks=S.pkAsks.filter(x=>x.id!==c.id);render();
 const done=await answerChallenge(S.p,c,ok);if(!ok)return;
 if(!done){pkNote('加入失敗，隊長可能已經解散了。');render();return;}
 const w=S.coopWait={id:c.party,host:c.hostName,dg:c.dg,msg:`已加入，等 ${c.hostName} 出發……`};render();
 const unsub=await watchParty(c.party,d=>{if(S.coopWait!==w)return;
  if(!d||d.state==='done'){clearCoopWait(w);pkNote('隊伍解散了。');render();return;}
  if(d.state==='on'){const i=(d.members||[]).findIndex(m=>m.uid===S.uid);clearCoopWait(w);if(i<0){pkNote('隊伍已經出發了，沒有排到你。');render();return;}startCoopBattle(d,i);}});
 w.unsub=unsub;if(S.coopWait!==w)unsub();
}
const clearCoopWait=w=>{w.unsub?.();if(S.coopWait===w)S.coopWait=null;};
function coopWaitCard(){const w=S.coopWait;if(!w)return null;const d=D.DUNGEON_BY_ID[w.dg];
 return h('section',{class:'card pk'},h('div',{class:'row item'},face(d.look,40),h('div',{class:'grow'},h('b',{},`組隊打 ${d.boss}`),h('div',{class:'small dim'},w.msg)),h('button',{class:'ghost',onclick:()=>{clearCoopWait(w);render();}},'離開')));}
function startCoopBattle(d,idx){
 const p=S.p,dg=D.DUNGEON_BY_ID[d.dg],b=D.startCoop(d.members,d.dg,(+d.seed||1)>>>0,idx);
 if(!R.allies(b).some(u=>u.uid==='p')){say('隊伍資料讀不到。');render();return;}
 const names=Object.fromEntries(d.members.map((m,i)=>[R.coopUid(i),m.name]));
 const B=S.battle={b,kind:'coop',scene:dg.lv<20?'cave':'courtyard',coop:{id:d.id,role:idx?'guest':'host',idx,map:R.coopMap(idx),doc:d,ai:{},names,left:{}},
  lines:[{c:'sys',t:`組隊打迷宮王：${d.members.map(m=>m.name).join('、')} 對上 ${D.bossLabel(dg)}和護衛隊——${R.foes(b).filter(u=>!u.boss).map(u=>`${u.name}${u.row==='back'?'（後排）':''}`).join('、')}！`}]};
 watchParty(d.id,doc=>{if(S.battle!==B){B.coop.unsub?.();return;}coopDoc(B,doc);}).then(u=>{B.coop.unsub=u;if(S.battle!==B)u();});
 beginBattle();
}
// 單子有變：隊長看隊員的指令到了沒；隊員看結果到了沒
function coopDoc(B,d){
 const k=B.coop,b=B.b;k.doc=d;if(b.over)return;const idle=!B.busy||!!B.wait;
 if(k.role==='host'){
  if(!d){if(idle)coopEndBy(B,'escaped','隊伍解散了。');return;}
  for(const m of d.members||[])if(d['ff_'+m.uid]&&!k.left[m.uid]){k.left[m.uid]=true;B.lines.push({c:'sys',t:`${m.name}離隊了，剩下的回合由電腦代打。`});}
  coopTry(B);return;}
 // 隊員：先看有沒有新結果（最後一回合的結果和 state done 是同一筆寫進來的，要先播完）
 const r=d?.res;if(r&&r.n>b.round){if(k.playing)return;k.playing=true;clearTimeout(k.timer);B.lost=false;
  if(r.n>b.round+1)B.lines.push({c:'sys',t:'（中間少接到一回合，直接接上）'});
  R.applySnap(b,r.snap,k.map);B.wait='';showRound(B,R.mapEvents(r.ev,k.map)).then(()=>{k.playing=false;if(S.battle===B&&k.doc!==d)coopDoc(B,k.doc);});return;}
 if(!d||d.ffHost||d.state==='done'){if(idle&&!k.playing)coopEndBy(B,'escaped','隊長離開了，這場不算。');}
}
function coopEndBy(B,over,text){const k=B.coop;clearTimeout(k.timer);B.b.over=over;B.wait='';B.lost=false;B.lines.push({c:'sys',t:text});showRound(B,[]);}
// 自己這回合的指令：隊長留著等大家；隊員寫到單子上等結果（uid 換成單子上的叫法）
async function coopSubmit(B,cmds){
 const k=B.coop,b=B.b,clean=R.cleanCmds(cmds.filter(c=>c.actor==='p'));B.wait='等其他人下令……';battleView();clearTimeout(k.timer);
 if(k.role==='host'){k.my={n:b.round+1,cmds:clean};coopTry(B);
  k.timer=setTimeout(()=>{if(S.battle===B&&k.my&&k.my.n===b.round+1)coopResolve(B);},R.PK_WAIT*1000);}
 else{k.sent={n:b.round+1,cmds:R.mapCmds(clean,k.map)};const ok=await writeParty(k.id,{['gc_'+S.uid]:k.sent});if(!ok&&S.battle===B)B.lines.push({c:'sys',t:'指令送不出去，再等一下……'});
  k.timer=setTimeout(()=>{if(S.battle===B&&!b.over&&b.round<k.sent.n){B.lost=true;battleView();}},R.PK_GONE*1000);}
}
// 隊長：還活著、沒離隊的隊員都交了這回合的指令就算
const coopOthers=B=>{const k=B.coop;return (k.doc?.members||[]).map((m,i)=>({m,i,u:B.b.units.find(x=>x.uid===R.coopUid(i))})).filter(x=>x.i>0&&x.u?.alive&&!k.left[x.m.uid]);};
function coopTry(B){const k=B.coop,b=B.b,d=k.doc;if(!k.my||k.my.n!==b.round+1||b.over)return;if(coopOthers(B).every(x=>d?.['gc_'+x.m.uid]?.n===b.round+1))coopResolve(B);}
async function coopResolve(B){
 const k=B.coop,b=B.b,my=k.my,d=k.doc;if(!my)return;k.my=null;clearTimeout(k.timer);
 const all=[...my.cmds],late=[];
 for(const x of coopOthers(B)){const g=d?.['gc_'+x.m.uid];if(g?.n===b.round+1){all.push(...R.pkCmds(b,x.u.uid,g.cmds));k.ai[x.m.uid]=0;}else{k.ai[x.m.uid]=(k.ai[x.m.uid]||0)+1;late.push(x.m.name);}}
 const ev=R.resolveRound(b,all);
 if(late.length)ev.push({t:'msg',text:`${late.join('、')}沒下令，由電腦代打。`});
 writeParty(k.id,{res:{n:b.round,ev,snap:R.pkSnap(b)},...(b.over?{state:'done'}:{})});
 B.wait='';await showRound(B,ev);
}
// 隊員離隊（剩下的回合電腦代打、拿不到獎勵）；隊長離開＝解散
function coopLeave(B){const k=B.coop;B.ffAsk=false;if(k.role==='host')writeParty(k.id,{ffHost:1,state:'done'});else writeParty(k.id,{['ff_'+S.uid]:1});coopEndBy(B,'escaped',k.role==='host'?'你解散了隊伍。':'你離隊了。');}
function coopGone(B){coopEndBy(B,'escaped','隊長沒有回應，這場不算。');}
function startBout(r){
 const b=R.startBout(S.p,r.fighter,(Math.random()*2**31)>>>0);
 S.battle={b,kind:'bout',rival:r,scene:'sect',lines:[{c:'sys',t:`擂台比武：${S.p.name} 對 ${r.name}（Lv${r.lv} ${rankName(r.job,r.rank)}）`}]};
 beginBattle();
}
// 戰場上的橫幅字（回合、開戰、勝負）：B.banner＝{text,c,t0}，stage 畫 0.9 秒
const banner=(B,text,c='#ffd86a')=>{B.banner={text,c,t0:performance.now()/1000};};
function beginBattle(){
 const B=S.battle,b=B.b;B.shown=new Map(b.units.map(u=>[u.uid,{hp:u.hp,mp:u.mp,act:'idle',t0:0,dead:!u.alive}]));
 B.t0=performance.now()/1000;const boss=b.units.find(u=>u.boss&&u.side!=='ally');banner(B,boss?`${boss.name} 現身`:B.kind==='bout'?'比武開始':'戰鬥開始',boss?'#ff8a6a':'#ffd86a');
 b.mods={...b.mods,healAt:S.p.settings.healAt??50}; // 補血門檻（練功頁設定；電腦判斷的補師照這個）
 B.menu='main';B.first=null;B.busy=false;B.prev=S.p.lastMud||[{kind:'attack',target:null},{kind:'attack',target:null}];
 battleView();if(S.p.settings.auto)setTimeout(autoRound,300);
}
const me=b=>R.allies(b)[0];
// 現在的目標：選過的那個，不然先打前排
const curTarget=B=>{const en=R.foes(B.b).filter(x=>x.alive);return en.find(e=>e.uid===B.tgt)?.uid??(en.find(e=>e.row!=='back')||en[0])?.uid;};
// 陣形：[離外側的 x 比例, 離底部的高度]，照人數；前排的排前面
const SPRITE_SCALE=[.8,.8,.72,.64,.57,.52,.47,.43,.4,.38,.36]; // 照每邊人數縮小（最多 5 人＋5 位收服的；Leo 2026-10-27 說人太大，整體再縮）
const SPRITE_H=W=>W*.42; // 武將立繪的基準高（像素，照畫面寬，不跟畫面高走；戰場拉高人不會跟著變大）
// 站位（Leo 2026-10-27 說擠成一團）：每邊一條樓梯式斜線，從靠中間的下方往外側上方走，前排在下、後排接著往上，後排再往外、往上退一點看得出在後面
// 回傳 [離外側的 x 比例, 離底部的高度（k 單位）]；j 是這個人在斜線上的第幾階
// 回傳 [離外側的 x（畫面寬比例）, 離底部的高度（像素）]；top＝上面浮著的血條佔掉的高度，最上面那個人不能頂到它
const ROW_XY=(row,j,n,W,H,top,sc=SPRITE_SCALE[n])=>{const sh=SPRITE_H(W)*sc,dx=n<=2?.13:Math.min(.1,.3/(n-1)),dy=Math.min(H*.13,Math.max(14,(H-top-10-sh-H*.03)/Math.max(1,n-1))),x0=n<=2?.36:.42,b=row==='back';return [x0-j*dx-(b?.04:0),H*.03+j*dy+(b?dy*.4:0)];};
// 平行兩條斜線的座標：每一步往左下 (sx,sy)，前後排／敵我之間往右下 (px,py) 錯開；算完再整體縮放平移，塞進血條下面到底邊之間
function parallelLines(foes,allies,W,H,top,sh){
 const sx=W*.1,sy=H*.07,px=W*.13,py=H*.065,gap=2; // gap＝敵我前排之間差幾個 p
 const out=[];out.k=1;
 const line=(list,side)=>{const rows=[list.filter(u=>u.row!=='back'),list.filter(u=>u.row==='back')];
  rows.forEach((row,ri)=>{const n=row.length;if(!n)return;const k=(side==='ally'?gap/2:-gap/2)+(side==='ally'?1:-1)*ri*1.1; // 離中線幾個 p
   row.forEach((u,j)=>{const t=j-(n-1)/2;out.push({u,side,x:W/2-t*sx+k*px,y:t*sy+k*py});});});};
 line(foes,'enemy');line(allies,'ally');
 if(!out.length)return out;
 // 塞進可用範圍：上面不頂到血條、下面留一點邊；太高就整體壓扁，再置中
 // 擠不下時人也跟著縮一點（最多縮到 0.7），不然會疊成一團
 const y0=Math.min(...out.map(o=>o.y))-sh,y1=Math.max(...out.map(o=>o.y)),avail=H-10-(top+6),f0=avail/Math.max(1,y1-y0),k=out.k=Math.max(.7,Math.min(1,f0)),f=Math.min(1,avail/Math.max(1,(y1-y0)-sh*(1-k)));
 const cy=(y0+y1)/2,mid=top+6+avail/2;for(const o of out)o.y=mid+(o.y-cy)*f;
 const x0=Math.min(...out.map(o=>o.x)),x1=Math.max(...out.map(o=>o.x)),w=sh*.5,fx=Math.min(1,(W-w-16)/Math.max(1,x1-x0));for(const o of out)o.x=W/2+(o.x-W/2)*fx;
 return out;
}
const imgs={};
const imgOf=src=>{let i=imgs[src];if(!i){i=imgs[src]=new Image();i.src=src;}return i;};
function stage(B,hud){
 const cv=h('canvas',{class:'stage'}),ctx=cv.getContext('2d'),bg=imgOf(`./assets/scenes/${B.scene}.webp`);
 const draw=now=>{
  if(!cv.isConnected){loop.delete(draw);return;}
  const dpr=Math.min(2,devicePixelRatio||1),W=cv.clientWidth||360,H=cv.clientHeight||220;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  // 打擊感：頓格時時間停住；畫面震動（背景放大一點，震的時候不露邊）
  const real=now/1000,frozen=B.stopUntil&&real<B.stopUntil,sk=B.shake&&real-B.shake.t0<.28?B.shake:null;
  if(sk){const d=1-(real-sk.t0)/.28,m=sk.mag*d*d;ctx.translate((Math.random()-.5)*2*m,(Math.random()-.5)*2*m);}
  if(bg.complete&&bg.naturalWidth){const s=Math.max(W/bg.naturalWidth,H/bg.naturalHeight)*1.06;ctx.drawImage(bg,(W-bg.naturalWidth*s)/2,(H-bg.naturalHeight*s)*.6,bg.naturalWidth*s,bg.naturalHeight*s);}
  // 景深與打光（Leo 2026-10-27 說畫面簡陋）：遠處壓暗起霧、地上一灘暖光、四角暗角，人才會浮出來
  const fog=ctx.createLinearGradient(0,0,0,H*.55);fog.addColorStop(0,'rgba(12,10,24,.55)');fog.addColorStop(1,'rgba(12,10,24,0)');ctx.fillStyle=fog;ctx.fillRect(0,0,W,H);
  const pool=ctx.createRadialGradient(W/2,H*.82,0,W/2,H*.82,W*.62);pool.addColorStop(0,'rgba(255,214,150,.22)');pool.addColorStop(1,'rgba(255,214,150,0)');ctx.fillStyle=pool;ctx.fillRect(0,0,W,H);
  const sh=ctx.createLinearGradient(0,H*.55,0,H);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=sh;ctx.fillRect(0,0,W,H);
  const vig=ctx.createRadialGradient(W/2,H*.55,W*.3,W/2,H*.55,W*.8);vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  const k=H/230,km=W/300,t=frozen?B.stopAt:real,fs=R.foes(B.b),pos=new Map(),top=(hud?.offsetTop||0)+(hud?.offsetHeight||0);
  const ent=B.t0?Math.min(1,(real-B.t0)/.55):1,ease=1-(1-ent)*(1-ent); // 開戰：兩邊從外側滑進來
  const put=(u,x,y,facing,sc=1)=>{const v=B.shown.get(u.uid);if(!v||v.caught)return;const act=v.dead?'defeat':v.act,sec=act==='idle'?t:t-v.t0;
   if(act!=='idle'&&!v.dead&&sec>.8)v.act='idle';
   // 打擊感：出手的人往前衝一下，挨打的人被打退（我方在右邊，往左打）
   const dir=u.side==='ally'?-1:1,sh=SPRITE_H(W)*sc;
   x-=dir*(1-ease)*W*.22;
   // 衝到目標面前（用上一格的位置），打完跑回來
   if(v.rush){const tp=B.pos?.get(v.rush.tgt),sp=S.p.settings.speed||1;if(tp){const dx2=tp.x-dir*(tp.h*.3+sh*.25),dy2=tp.y+4,eo=q=>1-(1-q)*(1-q),q1=eo(Math.min(1,(real-v.rush.t0)*sp/.18));
     if(v.rush.back){const q2=eo(Math.min(1,(real-v.rush.back)*sp/.24));x=dx2+(x-dx2)*q2;y=dy2+(y-dy2)*q2;if(q2>=1)v.rush=null;}else{x+=(dx2-x)*q1;y+=(dy2-y)*q1;}}else v.rush=null;}
   if((act==='attack'||act==='special')&&sec<.32&&!v.dead)x+=dir*Math.sin(sec/.32*Math.PI)*22*k;
   if(act==='hit'&&sec<.4&&!v.dead){const q=sec/.4;x-=dir*(q<.15?q/.15:1-(q-.15)/.85)*16*k;}
   pos.set(u.uid,{x,y,h:(GENERAL_BY_ID[u.art]?SPRITE_H(W)*.85:(u.h||90)*km)*sc});
   // 腳下的影子：中間深、邊緣散
   const shd=ctx.createRadialGradient(x,y,0,x,y,30*km*sc);shd.addColorStop(0,'rgba(0,0,0,.42)');shd.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shd;ctx.save();ctx.translate(x,y);ctx.scale(1,.27);ctx.translate(-x,-y);ctx.beginPath();ctx.arc(x,y,30*km*sc,0,Math.PI*2);ctx.fill();ctx.restore();
   ctx.save();ctx.globalAlpha=(v.dead?.55:1)*ease;
   if(GENERAL_BY_ID[u.art]){
    // 武將立繪：原圖面向右，站在右邊（我方）的翻過來；出手換出招圖，挨打抖一下，倒下躺平
    const atk=(act==='attack'||act==='special')&&sec<.5,img=imgOf(art(u.art+(atk?'_atk':''))),s=SPRITE_H(W)/328*sc;
    if(img.complete&&img.naturalWidth){const w=img.naturalWidth*s,hh=img.naturalHeight*s,mirror=facing==='front-left';
     let dx=act==='hit'&&sec<.3?Math.sin(sec*70)*3:0,dy=v.dead||act!=='idle'?0:Math.sin(t*2.1+u.slot*1.7+(u.side==='ally'?2:0))*hh*.008; // 站著時輕輕呼吸
     ctx.translate(x+dx,y+dy);if(mirror)ctx.scale(-1,1);
     // 倒下：變灰、往下沉一點（轉九十度會轉出畫面外）
     if(v.dead){ctx.filter='grayscale(1)';ctx.translate(0,hh*.08*Math.min(1,(t-v.t0)*3));}
     else if(act==='hit'&&sec<.12)ctx.filter='brightness(3) saturate(0)';else if(act==='hit'&&sec<.25)ctx.filter='brightness(1.6) sepia(1) hue-rotate(-30deg) saturate(3)';
     // 出招圖比站姿寬（往前伸的兵器），跟站姿的背後對齊，不然人會往後跳
     const idle=imgOf(art(u.art)),left=atk&&idle.naturalWidth?-idle.naturalWidth*s/2:-w/2;
     ctx.drawImage(img,left,-hh,w,hh);}
   }else{if(u.tint)ctx.filter=u.tint;if(act==='hit'&&sec<.12&&!v.dead)ctx.filter='brightness(3) saturate(0)';
    drawMotion(ctx,bank,u.art,act,Math.max(0,sec),{x,y,height:(u.h||90)*km*sc,facing,weapon:null});}
   ctx.restore();};
  // 站位（Leo 2026-10-27：要像原作，敵我是平行的兩條斜線）：敵人一條斜線在左上、我方一條平行的在右下，
  // 線都是從右上往左下走；後排再往外（敵方左上、我方右下）平行錯開半格。兩邊用同一個比例，照人多的那邊縮；先畫上面的，下面的蓋在上面
  const back=u=>u.row==='back',order=l=>l.slice().sort((a,c)=>(back(a)-back(c))||(a.slot-c.slot));
  const cnt=l=>Math.min(SPRITE_SCALE.length-1,l.length),als=R.allies(B.b),sc=SPRITE_SCALE[Math.max(cnt(fs),cnt(als))];
  const spots=parallelLines(order(fs).slice(0,SPRITE_SCALE.length-1),order(als).slice(0,SPRITE_SCALE.length-1),W,H,top,SPRITE_H(W)*sc);
  spots.sort((a,c)=>(!!B.shown.get(a.u.uid)?.rush)-(!!B.shown.get(c.u.uid)?.rush)||a.y-c.y).forEach(({u,x,y,side})=>put(u,x,y,side==='ally'?'front-left':'front-right',sc*spots.k*(back(u)?.9:1)));
  B.pos=pos;
  // 下令時：輪到的人腳下金圈、頭上金色箭頭；目標頭上紅色箭頭（點戰場上的敵人也能換目標）
  if(!B.busy&&!B.b.over&&!S.p.settings.auto){const pulse=.5+.5*Math.sin(real*6),mark=(p,color,ring)=>{if(!p)return;
    if(ring){ctx.save();ctx.globalAlpha=.55+.35*pulse;ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.shadowColor=color;ctx.shadowBlur=10;ctx.beginPath();ctx.ellipse(p.x,p.y,p.h*.3,p.h*.09,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    const ay=p.y-p.h-8-pulse*5,z=Math.max(7,W*.022);ctx.save();ctx.fillStyle=color;ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=4;ctx.beginPath();ctx.moveTo(p.x,ay);ctx.lineTo(p.x-z,ay-z*1.4);ctx.lineTo(p.x+z,ay-z*1.4);ctx.closePath();ctx.fill();ctx.restore();};
   mark(pos.get(B.curUid),'#ffd86a',true);const tg=curTarget(B);if(tg&&tg!==B.curUid)mark(pos.get(tg),'#ff5a46',false);}
  drawFx(ctx,B,pos,t,S.p.settings.speed||1);
  // 橫幅：開戰、第幾回合、勝負，從左滑進中間再滑出
  if(B.banner){const q=(real-B.banner.t0)/(1.1/(S.p.settings.speed||1));if(q>=1)B.banner=null;else{const ease=x=>x<.5?2*x*x:1-(-2*x+2)**2/2,x=q<.25?W*(ease(q/.25)-1)*.5:q>.75?W*ease((q-.75)/.25)*.5:0,a=q<.15?q/.15:q>.85?(1-q)/.15:1;
    ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=a;const y=H*.46,bh=Math.max(34,W*.12);const band=ctx.createLinearGradient(0,0,W,0);band.addColorStop(0,'rgba(20,10,5,0)');band.addColorStop(.2,'rgba(20,10,5,.78)');band.addColorStop(.8,'rgba(20,10,5,.78)');band.addColorStop(1,'rgba(20,10,5,0)');ctx.fillStyle=band;ctx.fillRect(0,y-bh/2,W,bh);
    ctx.fillStyle=B.banner.c;ctx.fillRect(W*.12,y-bh/2,W*.76,1);ctx.fillRect(W*.12,y+bh/2-1,W*.76,1);
    ctx.font=`900 ${Math.max(20,W*.072)}px "Noto Serif TC",serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=8;ctx.fillStyle=B.banner.c;ctx.fillText(B.banner.text,W/2+x,y+1);ctx.restore();}}
  // 必殺：整個畫面閃白一下
  if(B.flash&&real-B.flash<.15){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=.45*(1-(real-B.flash)/.15);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
 };
 // 點戰場上的敵人換目標（跟點血條一樣）
 cv.onclick=e=>{if(B.busy||B.b.over||!B.pos)return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const hit=R.foes(B.b).filter(u=>u.alive&&!B.shown.get(u.uid)?.caught).map(u=>[u,B.pos.get(u.uid)]).filter(([,p])=>p&&Math.abs(x-p.x)<p.h*.3&&y<p.y+6&&y>p.y-p.h).sort((a,c)=>c[1].y-a[1].y)[0];
  if(hit&&hit[0].uid!==B.tgt){B.tgt=hit[0].uid;battleView();}};
 loop.add(draw);
 return h('div',{class:'stage-wrap'},cv,h('span',{class:'round'},B.b.over&&!B.busy?'結束':`第 ${B.b.round+(B.busy?0:1)} 回合`),hud);
}
function unitCard(B,u){
 const v=B.shown.get(u.uid),st=u.st&&!v.dead?STATUS_NAMES[u.st.k]:'';
 const pickable=u.side!=='ally'&&!v.dead&&R.foes(B.b).filter(x=>x.alive).length>1,on=pickable&&(B.tgt===u.uid||!R.foes(B.b).some(x=>x.alive&&x.uid===B.tgt)&&(R.foes(B.b).find(x=>x.alive&&x.row!=='back')||R.foes(B.b).find(x=>x.alive))===u);
 if(v.caught)return h('div',{class:'unit dead'},h('div',{class:'row between small'},h('b',{},u.name),h('span',{class:'dim'},'收服了')));
 return h('div',{class:'unit'+(v.dead?' dead':'')+(u.side==='ally'?' mine':'')+(on?' tgt':'')+(pickable?' pick':'')+(B.curUid===u.uid&&!B.busy&&!B.b.over&&!S.p.settings.auto?' cur':''),onclick:pickable&&!B.busy?()=>{B.tgt=u.uid;battleView();}:null},
  h('div',{class:'row between small'},h('b',{},u.name),h('span',{class:'dim'},`Lv${u.lv}`,u.side!=='ally'?elemTags(u.elem).map(x=>(x.classList.add('tiny'),x)):null,u.side==='enemy'&&u.row==='back'&&B.b.mods?.frontOnly?h('span',{class:'st'},'後排'):null,st?h('span',{class:'st'},st):null,u.wallLeft>0&&!v.dead?h('span',{class:'st'},`聖盾 ${u.wallLeft}`):null,u.coverLeft>0&&!v.dead?h('span',{class:'st'},`護衛 ${u.coverLeft}`):null)),
  hpMeter(v,u.maxHp),u.side==='ally'||B.kind==='bout'?meter('mp',v.mp,u.maxMp,`${v.mp}/${u.maxMp}`):null);
}
function battleView(){
 const B=S.battle;if(!B)return render();
 const box=h('div',{class:'log blog'},...B.lines.map(x=>h('p',{class:x.c},x.t)));requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
 // 血條、名字縮小浮在戰場上方（Leo 2026-10-27），戰場才能放大
 // 一邊超過 3 個就排兩欄（Leo 2026-10-27：血條佔太高，戰場擠成一團）
 const col=list=>h('div',{class:list.length>3?'two':''},...list.map(u=>unitCard(B,u)));
 const hud=h('div',{class:'hud'},col(R.foes(B.b)),col(R.allies(B.b)));
 app.replaceChildren(h('div',{class:'page bout'},stage(B,hud),commands(B),box));
}
const SELF_KINDS=['heal','selfheal','regen','cure','wall','stance','cover','honor','barrier'];
const isSelf=sk=>SELF_KINDS.includes(sk.kind)||sk.target==='ally'||sk.target==='self';
const NO_BATTLE=['passive','field','gather','craft'];
// 護衛的對象是夥伴；其他自己用的招對象是自己
const selfTarget=sk=>sk.kind==='cover'?'m':'p';
// 手動全員下令（Leo 2026-10-27）：這回合要下令的人＝活著的帶頭的、夥伴、借將（收服的照電腦打）；settings.cmdAll＝false 就只管自己
const cmdList=B=>B.kind==='coop'||S.p.settings.cmdAll===false?[me(B.b)].filter(u=>u.alive):R.allies(B.b).filter(u=>u.alive&&!u.pid);
// 自己用的招對象是自己；護衛的對象是別的活著的隊友（帶頭的優先）
const selfTgtOf=(sk,u,b)=>sk.kind==='cover'?(R.allies(b).find(x=>x.alive&&x.uid!==u.uid&&!x.pid)||R.allies(b).find(x=>x.alive&&x.uid!==u.uid))?.uid||u.uid:u.uid;
// 自動、三倍速、自動下一場（練功才有）
function togglesOf(B){
 const p=S.p,b=B.b;
 return h('div',{},B.showStats&&!b.over?statsBox(B):null,h('div',{class:'row toggles'},
  b.over?null:h('button',{class:'chip'+(p.settings.auto?' on':''),onclick:()=>{p.settings.auto=!p.settings.auto;if(!p.settings.auto)p.settings.autoNext=false;save();battleView();if(p.settings.auto&&!B.busy)autoRound();}},p.settings.auto?'自動中':'自動'),
  b.over||p.settings.auto||R.allies(b).filter(x=>!x.pid).length<2?null:h('button',{class:'chip'+(p.settings.cmdAll!==false?' on':''),onclick:()=>{p.settings.cmdAll=p.settings.cmdAll===false;B.pend=[];save();battleView();}},p.settings.cmdAll!==false?'全員下令':'只管自己'),
  b.over?null:h('button',{class:'chip'+(p.settings.speed===3?' on':''),onclick:()=>{p.settings.speed=p.settings.speed===3?1:3;save();battleView();}},'三倍速'),
  b.over?null:h('button',{class:'chip'+(p.settings.sfx!==false?' on':''),onclick:()=>{p.settings.sfx=p.settings.sfx===false;sfxOn.v=p.settings.sfx;save();battleView();}},'音效'),
  b.over?null:h('button',{class:'chip'+(B.showStats?' on':''),onclick:()=>{B.showStats=!B.showStats;battleView();}},'戰績'),
  B.kind==='hunt'?h('button',{class:'chip'+(p.settings.autoNext?' on':''),onclick:()=>{const st=p.settings;st.autoNext=!st.autoNext;
   if(st.autoNext&&!st.auto){st.auto=true;if(!B.busy&&!b.over)setTimeout(autoRound,50);}save();battleView();if(b.over&&!B.busy)queueNext(B);}},'自動下一場'):null));
}
function commands(B){
 const b=B.b,p=S.p,order=cmdList(B),pend=B.pend||=[],u=order.find(x=>!pend.some(y=>y.actor===x.uid))||me(b),n=R.actionsOf(b,u);B.curUid=u.uid;
 if(b.over&&!B.busy){
  const res={win:['勝利','win'],lose:['敗北','lose'],escaped:['逃走了','sys'],draw:['平手','sys']}[b.over];
  return h('div',{class:'cmds over'},h('p',{class:'result '+res[1]},res[0]),statsBox(B),h('div',{class:'row'},
   B.kind==='hunt'&&b.over!=='lose'?h('button',{class:'main',onclick:()=>startHunt(B.spot)},'繼續練功'):null,
   B.kind==='dungeon'&&p.dg?h('button',{class:'main',onclick:()=>startFloor()},p.dg.floor>=D.FLOORS?`前往最深處（${D.DUNGEON_BY_ID[p.dg.id].boss}）`:`前進第 ${p.dg.floor} 層`):null,
   B.kind==='dungeon'&&p.dg?h('button',{class:'ghost',onclick:()=>{D.leaveDungeon(p);save();S.battle=null;S.tab='dungeon';render();}},'撤退回城'):
   h('button',{class:'ghost',onclick:()=>{S.battle=null;S.tab={hunt:'hunt',dungeon:'dungeon',raid:'raid',world:'raid',coop:'raid'}[B.kind]||'arena';render();}},B.kind==='bout'||B.kind==='pk'?'回擂台':B.kind==='raid'||B.kind==='coop'?'回迷宮王':'回城')),
   B.stopMsg?h('p',{class:'small warn'},B.stopMsg):B.nextAt?h('p',{class:'small dim'},'馬上自動下一場……（關掉「自動下一場」就停）'):null,
   B.kind==='hunt'?togglesOf(B):null,
   B.kind==='dungeon'&&p.dg&&b.over==='win'?potionBox():null);
 }
 const toggles=togglesOf(B);
 // 組隊：等人、倒下的時候也能離隊／解散
 const leaveBtn=B.kind==='coop'&&!b.over?(B.ffAsk?h('p',{class:'small warn'},B.coop.role==='host'?'真的解散？大家這場都不算。':'真的離隊？這場拿不到獎勵。',h('button',{class:'chip',onclick:()=>coopLeave(B)},'確定'),h('button',{class:'chip',onclick:()=>{B.ffAsk=false;battleView();}},'再等')):h('button',{class:'ghost small',onclick:()=>{B.ffAsk=true;battleView();}},B.coop.role==='host'?'解散':'離隊')):null;
 if(B.busy||p.settings.auto||!u.alive||!order.length)return h('div',{class:'cmds'},h('p',{class:'dim small'},B.busy?(B.wait||'交手中……'):!u.alive||!order.length?'你倒下了，夥伴還在打……':'自動戰鬥中（重複上一回合的指令）'),
  B.lost?h('button',{class:'ghost',onclick:()=>B.kind==='coop'?coopGone(B):pkGone(B)},B.kind==='coop'?'隊長沒回應，離開':'對方沒回應，結束比武'):null,B.wait||!u.alive?leaveBtn:null,toggles);
 // 按一下就出完這回合（Leo 2026-10-26）：一回合兩動；技能一回合只能放一次，第二動改成攻擊；道具、逃跑的第二動改防禦
 const enemies=R.foes(b).filter(x=>x.alive),tgt=curTarget(B); // 沒選目標時先打前排
 // 兩動自由搭配（Leo 2026-10-28 選的：一技能一藥水也行）：兩動時第一動選完再選第二動（技能一回合只能放一次，第二動的技能鈕關掉）；逃跑、捕捉照舊第二動防禦
 const first=B.first&&B.first.actor===u.uid?B.first:null;
 const go=c=>{let list;
  if(n>1&&!first&&c.kind!=='escape'&&c.kind!=='capture'){B.first={actor:u.uid,...c};B.menu='main';battleView();return;}
  if(first){list=[first,{actor:u.uid,...c}];B.first=null;}
  else{const second=c.kind==='escape'||c.kind==='capture'?{kind:'defend'}:c;list=[c,second].slice(0,n).map(x=>({actor:u.uid,...x}));}
  B.menu='main';pend.push(...list);
  if(c.kind==='escape'||order.every(x=>pend.some(y=>y.actor===x.uid))){B.pend=[];B.first=null;playRound(pend);}else battleView();};
 const cmdName=c=>c.kind==='attack'?'攻擊':c.kind==='defend'?'防禦':c.kind==='skill'?SKILLS[c.skill]?.name||'技能':c.kind==='item'?ITEMS[c.item]?.name||'道具':c.kind;
 const back=h('button',{class:'ghost',onclick:()=>{B.menu='main';battleView();}},'返回');
 const undo=first?h('button',{class:'ghost small',onclick:()=>{B.first=null;B.menu='main';battleView();}},'重選第一動'):pend.length?h('button',{class:'ghost small',onclick:()=>{const last=pend[pend.length-1].actor;B.pend=pend.filter(x=>x.actor!==last);B.menu='main';battleView();}},'上一位'):null;
 let body;
 // 補血、潔淨、屏障、護衛、氣絕回復和藥：隊友不只一個時先選要用在誰身上（Leo 2026-10-28：回血不能自己選目標）
 const allyTargets=sk=>R.allies(b).filter(x=>sk?.kind==='revive'?!x.alive:x.alive&&(sk?.kind!=='cover'||x.uid!==u.uid));
 const pickAlly=(cmd,sk)=>{const ts=allyTargets(sk);if(ts.length<=1)return go({...cmd,target:ts[0]?.uid||u.uid});B.menu='tgt';B.pick={cmd,sk};battleView();};
 if(B.menu==='tgt'){
  const {cmd,sk}=B.pick,ts=allyTargets(sk);
  body=h('div',{class:'grid2'},h('p',{class:'small dim wide'},`${cmd.kind==='item'?ITEMS[cmd.item].name:SKILLS[cmd.skill].name}用在誰身上？`),...ts.map(x=>h('button',{onclick:()=>go({...cmd,target:x.uid})},x.name,h('small',{},x.alive?`生命 ${x.hp}/${x.maxHp}${x.st?'・'+(STATUS_NAMES[x.st.k]||''):''}`:'氣絕'))),back);
 }else if(B.menu==='skill'){
  const mateUp=b.units.some(x=>x.side==='ally'&&x.uid!=='p'&&x.alive),PICK=['heal','regen','cure','cover','barrier','revive'];
  body=h('div',{class:'grid2'},...u.skills.filter(s=>!NO_BATTLE.includes(SKILLS[s.id].kind)).map(s=>{const sk=SKILLS[s.id],mp=mpCost(u,s.id,s.lv),self=isSelf(sk),wOk=weaponOk(u,s.id),noMate=(sk.kind==='cover'||sk.kind==='honor')&&!mateUp;
   const cmd={kind:'skill',skill:s.id};
   return h('button',{disabled:u.mp<mp||!wOk||noMate,onclick:()=>PICK.includes(sk.kind)&&!sk.area?pickAlly(cmd,sk):go({...cmd,target:self?selfTgtOf(sk,u,b):tgt})},`${sk.name} Lv${s.lv}`,h('small',{},!wOk?'武器不合':noMate?'要有夥伴':`耗魔 ${mp}`));}),back);
 }else if(B.menu==='item'){
  const list=p.bag.filter(x=>ITEMS[x.id].kind==='use'&&ITEMS[x.id].battle);
  body=h('div',{class:'grid2'},...list.map(x=>h('button',{onclick:()=>pickAlly({kind:'item',item:x.id,useItem:id=>P.removeItem(p,id)},{kind:'item'})},`${ITEMS[x.id].name} ×${x.n}`,h('small',{},ITEMS[x.id].desc))),list.length?null:h('p',{class:'dim small'},'沒有戰鬥中能用的藥。'),back);
 }else{
  body=h('div',{class:'grid4'},
   h('button',{class:'hot',onclick:()=>go({kind:'attack',target:tgt})},h('i',{class:'ic'},'⚔'),'攻擊'),
   h('button',{disabled:!u.skills.length||first?.kind==='skill',onclick:()=>{B.menu='skill';battleView();}},h('i',{class:'ic'},'✦'),'技能',first?.kind==='skill'?h('small',{},'一回合一次'):null),
   h('button',{onclick:()=>go({kind:'defend'})},h('i',{class:'ic'},'◈'),'防禦'),
   B.kind==='pk'||B.kind==='coop'?(first?null:h('button',{class:'ghost',onclick:()=>{B.ffAsk=!B.ffAsk;battleView();}},h('i',{class:'ic'},'⚐'),B.kind==='coop'?(B.coop.role==='host'?'解散':'離隊'):'認輸')):h('button',{onclick:()=>{B.menu='item';battleView();}},h('i',{class:'ic'},'✚'),'道具'),
   b.canEscape&&u.kind==='player'&&!u.guest&&!first?h('button',{class:'ghost',onclick:()=>go({kind:'escape'})},h('i',{class:'ic'},'↩'),'逃跑'):null,
   u.kind==='player'&&!u.guest&&!first&&(B.kind==='hunt'||B.kind==='dungeon')&&enemies.some(e=>e.rival&&!e.boss)?(()=>{const t=enemies.find(e=>e.uid===tgt),room=b.captureRoom>0,can=t&&t.rival&&!t.boss;
    return h('button',{class:'ghost',disabled:!room||!can,onclick:()=>go({kind:'capture',target:tgt})},'捕捉',h('small',{},!room?`已滿 ${R.PET_MAX} 位`:!can?'只能抓冒險者':`${R.captureRate(u,t)}%`));})():null);
 }
 // 輪到誰：臉、名字、血魔小條（Leo 2026-10-27 戰鬥畫面要有質感）
 const vv=B.shown.get(u.uid)||{hp:u.hp,mp:u.mp},who=h('div',{class:'row actor'},GENERAL_BY_ID[u.art]?face(u.art,44):null,
  h('div',{class:'grow'},h('div',{class:'row between small'},h('b',{},u.name,h('span',{class:'dim'},` Lv${u.lv}`)),h('span',{class:'dim'},order.length>1?`下令 ${order.findIndex(x=>x.uid===u.uid)+1}／${order.length}`:`第 ${b.round+1} 回合`)),
   h('div',{class:'row bars'},meter('hp',vv.hp,u.maxHp,`${vv.hp}/${u.maxHp}`),meter('mp',vv.mp,u.maxMp,`${vv.mp}/${u.maxMp}`))),undo);
 const ff=B.ffAsk?h('p',{class:'small warn'},B.kind==='coop'?(B.coop.role==='host'?'真的解散？大家這場都不算。':'真的離隊？這場拿不到獎勵。'):'真的認輸？這場算輸。',h('button',{class:'chip',onclick:()=>B.kind==='coop'?coopLeave(B):pkForfeit(B)},B.kind==='coop'?'確定':'認輸'),h('button',{class:'chip',onclick:()=>{B.ffAsk=false;battleView();}},'再打')):null;
 return h('div',{class:'cmds'},who,h('p',{class:'small dim'},(first?`第二動（第一動：${cmdName(first)}）`:n>1?'一回合兩動：先選第一動，技能一回合只能放一次':'這回合的行動')+(enemies.length>1?'；點敵人換目標':'')),ff,body,toggles);
}
// 練功、地下城的自動戰鬥照「自動戰鬥用」的設定出招；技能一回合只放一次，第二動攻擊
function huntPlan(B,u,n){
 const id=roundSkill(S.p,B.b);if(!id||B.kind==='bout'||B.kind==='pk'||B.kind==='coop')return null;
 if(id==='ai')return aiPlan(B.b,u,n); // 「電腦判斷」：跟夥伴同一套 AI（補師補生命不到門檻的隊友、沒人要補才攻擊、近戰打前排）
 if(id==='attack')return [{kind:'attack',target:null},{kind:'attack',target:null}];
 const s=u.skills.find(x=>x.id===id);if(!s)return null;const sk=SKILLS[id],self=isSelf(sk),c={kind:'skill',skill:id,target:self?selfTarget(sk):null};
 return [c,{kind:'attack',target:null}];
}
function aiPlan(b,u,n){const rng=makeRng((Math.random()*2**31)>>>0);return Array.from({length:n},()=>{const c=chooseAllyAction(b,u,rng);return {kind:c.kind,...(c.skill?{skill:c.skill}:{}),target:c.target??null,...(c.lv?{lv:c.lv}:{})};});}
// 夥伴照「自動戰鬥用的招」出手（練功、地下城；擂台沒有夥伴）。沒設定、魔力不夠、沒人要補時交給電腦判斷
function mateCmds(B){return R.MATE_IDS.flatMap(i=>mateCmdsOf(B,i));}
function mateCmdsOf(B,i){
 const uid=R.mateUid(i),b=B.b,m=b.units.find(u=>u.uid===uid&&u.alive),id=roundSkill(S.p[R.MK(i)],b);if(!m||B.kind==='bout')return [];
 const n=R.actionsOf(b,m);
 // 夥伴也照「自動喝藥」的設定喝藥（道具欄共用）
 if(B.kind==='hunt'||B.kind==='dungeon'){const pot=autoPotion(b,m,id&&id!=='attack'?id:null,x=>P.countItem(S.p,x),ITEMS,potOpt());
  if(pot)return [{actor:uid,...pot,useItem:x=>P.removeItem(S.p,x)},...Array.from({length:n-1},()=>({actor:uid,kind:'attack',target:null}))];}
 if(!id)return [];
 if(id==='attack')return Array.from({length:n},()=>({actor:uid,kind:'attack',target:null}));
 const s=m.skills.find(x=>x.id===id),sk=SKILLS[id];if(!s||!weaponOk(m,id)||m.mp<mpCost(m,id,s.lv))return [];
 const mine=b.units.filter(x=>x.side==='ally'&&x.alive),hurt=mine.filter(x=>x.hp<x.maxHp*HEAL_SET_AT).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0]; // 夥伴設了補血技能：不看門檻，有人掉血超過一成就補最低的
 if(sk.kind==='heal'&&!hurt)return [];if(sk.kind==='wall'&&m.wallLeft>1)return [];
 const self=isSelf(sk),c={actor:uid,kind:'skill',skill:id,target:sk.kind==='heal'?hurt.uid:self?(sk.kind==='cover'?'p':uid):null};
 return [c,...Array.from({length:n-1},()=>({actor:uid,kind:'attack',target:null}))];
}
// 自動捕捉那回合其他人不是全防禦（Leo 2026-10-28：隊員一直防禦）：打得到別的敵人就打別的，只有沒別人可打才防禦，免得把要抓的打死
function holdCmd(b,x,ct){
 const others=b.units.filter(e=>e.side==='enemy'&&e.alive&&e.uid!==ct);
 const front=b.units.some(e=>e.side==='enemy'&&e.alive&&e.row!=='back');
 const pool=x.ranged||!b.mods?.frontOnly||!front?others:others.filter(e=>e.row!=='back');
 return pool.length?{actor:x.uid,kind:'attack',target:pool[0].uid}:{actor:x.uid,kind:'defend'};
}
// 自動下一場：打贏練功就接著打；生命不到三成、或魔力不夠放設定的那招就停
function queueNext(B){
 const p=S.p,st=p.settings;if(B.kind!=='hunt'||B.b.over!=='win'||!st.autoNext||B.nextAt)return;
 const s=P.stats(p),sk=p.huntSkill&&p.huntSkill!=='attack'&&p.skills.find(x=>x.id===p.huntSkill);
 if(p.hp<s.maxHp*.3){B.stopMsg='生命不到三成，自動下一場先停下。去醫院補一補吧。';return;}
 drinkBetween(B.lines);
 if(sk&&p.mp<mpCost(unitOf(0),sk.id,sk.lv)){B.stopMsg=`魔力不夠放${SKILLS[sk.id].name}，自動下一場先停下。`;return;}
 if(st.autoCatch&&B.b.captured?.length){B.stopMsg='收服到人了！自動下一場先停下，到「角色→收服」看檔次；要再抓就按繼續練功。';return;}
 if(st.autoCatch&&R.petRoom(p)<=0){B.stopMsg=`已經收服 ${R.PET_MAX} 位，自動下一場先停下。放走幾位或關掉自動捕捉再繼續。`;return;}
 B.nextAt=Date.now();setTimeout(()=>{if(S.battle===B&&st.autoNext)startHunt(B.spot);else{B.nextAt=0;if(S.battle===B)battleView();}},1200/(st.speed||1));
}
function autoRound(){
 const B=S.battle;if(!B||B.busy||B.b.over)return;
 if(!cmdList(B).length)return playRound([]); // 能下令的都倒了，剩下的自己打
 if(!S.p.settings.auto)return;
 const b=B.b,u=me(b),n=R.actionsOf(b,u),have=id=>P.countItem(S.p,id),cmds=[];
 // 自動捕捉：目標還活著就先把牠打到成功率夠，再按捕捉（那回合其他人防禦，免得把牠打死）
 const want=S.p.settings.autoCatch,ct=want&&b.captureRoom>0&&(B.kind==='hunt'||B.kind==='dungeon')?R.foes(b).find(e=>e.alive&&e.rival&&!e.boss&&(want==='any'||e.job===want)):null;
 if(ct){B.hold=false;if(R.captureRate(u,ct)>=R.CATCH_AT){B.hold=ct.uid;return playRound([{actor:'p',kind:'capture',target:ct.uid},...Array.from({length:n-1},()=>holdCmd(b,u,ct.uid))]);}
  return playRound(Array.from({length:n},()=>({actor:'p',kind:'attack',target:ct.uid})));}
 B.hold=false;
 // 沒設定招式時照上一回合；但自動戰鬥是要打的，上一回合的防禦、捕捉、逃跑改成攻擊（Leo 2026-10-28：前排倒了之後只會防禦）
 const plan=huntPlan(B,u,n)||B.prev.map(c=>['defend','capture','escape'].includes(c.kind)?{kind:'attack',target:null}:c);
 for(let i=0;i<n;i++){const c=autoCommand(b,plan[i]||{kind:'attack',target:null},u,have,ITEMS,i===0,potOpt());if(c.kind==='item')c.useItem=id=>P.removeItem(S.p,id);
  if(c.target&&c.kind!=='item'&&!(SKILLS[c.skill]&&isSelf(SKILLS[c.skill]))&&!b.units.find(x=>x.uid===c.target)?.alive)c.target=null;cmds.push({actor:'p',...c});}
 playRound(cmds);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms/(S.p.settings.speed||1)));
async function playRound(cmds){
 const B=S.battle,b=B.b;B.busy=true;if(b.round>0&&B.kind!=='pk'&&B.kind!=='coop')banner(B,`第 ${b.round+1} 回合`);
 // 自動戰鬥照原作重複上一回合的指令（存起來，下次進戰鬥也沿用；逃跑不重複）
 // 逃跑、自動捕捉那回合（捕捉＋其他人防禦）不記，免得之後自動一直重複防禦（Leo 2026-10-28）
 if(cmds.length&&!B.hold&&!cmds.some(c=>c.kind==='escape'||c.kind==='capture'))B.prev=S.p.lastMud=cmds.map(({actor,useItem,...c})=>c);
 battleView();
 if(B.kind==='pk')return pkSubmit(B,cmds); // 即時 PK：不在這裡算，等雙方指令都到
 if(B.kind==='coop')return coopSubmit(B,cmds); // 組隊：隊長等大家的指令、隊員等隊長的結果
 const given=new Set(cmds.map(c=>c.actor));cmds=[...cmds,...(B.hold?b.units.filter(x=>x.side==='ally'&&x.alive&&!given.has(x.uid)).map(x=>holdCmd(b,x,B.hold)):mateCmds(B).filter(c=>!given.has(c.actor)))];
 const ev=R.resolveRound(b,cmds);if(B.kind==='bout')R.boutTimeout(b);if(B.kind==='world')E.worldTimeout(b);
 await showRound(B,ev);
}
// 戰績（圭 2026-10-28 想看總輸出、抗傷）：照事件累計每個人這場打了多少（輸出）、挨了多少（承受，含中毒、反噬）、補了多少（補血給出的算在剛出手的人身上）、閃掉幾次
function tally(B,ev){const st=B.stats||=new Map(),at=uid=>{let x=st.get(uid);if(!x){x={out:0,in:0,heal:0,dodge:0,kills:0};st.set(uid,x);}return x;};let cur=null;
 for(const e of ev){if(e.t==='act')cur=e.a;else if(e.t==='counter')cur=e.a;
  else if(e.t==='hit'){at(e.a).out+=e.dmg;at(e.d).in+=e.dmg;}
  else if(e.t==='poison'||e.t==='recoil')at(e.d).in+=e.dmg;
  else if(e.t==='heal'&&e.n>0){if(cur&&cur!==e.d)at(cur).heal+=e.n;else if(cur===e.d)at(cur).heal+=e.n;}
  else if(e.t==='miss')at(e.d).dodge++;
  else if(e.t==='die'&&cur&&cur!==e.d)at(cur).kills++;}}
function statsBox(B){const b=B.b,st=B.stats||new Map(),side=s=>b.units.filter(u=>u.side===s),row=u=>{const x=st.get(u.uid)||{out:0,in:0,heal:0,dodge:0,kills:0};
  return h('tr',{class:u.alive?'':'dead'},h('td',{},u.name),h('td',{},x.out),h('td',{},x.in),h('td',{},x.heal||'－'),h('td',{},x.dodge||'－'));};
 const tbl=(title,list)=>list.length?h('table',{class:'stats'},h('thead',{},h('tr',{},h('th',{},title),h('th',{},'輸出'),h('th',{},'承受'),h('th',{},'補血'),h('th',{},'閃躲'))),h('tbody',{},...list.map(row))):null;
 return h('div',{class:'statsbox'},tbl('我方',side('ally')),tbl('敵方',side('enemy')));}
// 算好的一回合：播事件、更新血條、結算
async function showRound(B,ev){
 const b=B.b;B.busy=true;B.pend=[];B.first=null;if((B.kind==='pk'||B.kind==='coop')&&b.round>1&&!b.over)banner(B,`第 ${b.round} 回合`);
 // 播放或結算途中出錯，也要把「交手中」解開、照常結算（Leo 2026-10-27 打完卡在交手中）
 tally(B,ev);
 try{await playEvents(B,ev);}catch(err){console.error(err);B.lines.push({c:'sys',t:`畫面出了點錯（${err.message}），先跳過這段。`});}
 for(const u of b.units){const v=B.shown.get(u.uid);if(v){v.hp=u.hp;v.mp=u.mp;v.dead=!u.alive;}}
 if(b.round>=R.BOUT_ROUNDS&&(B.kind==='bout'||B.kind==='pk')&&b.over)B.lines.push({c:'sys',t:`${R.BOUT_ROUNDS} 回合到了，比剩下的生命比例。`});
 if(b.over&&!B.ended){B.ended=true;try{endBattle(B);}catch(err){console.error(err);B.lines.push({c:'sys',t:`結算出了點錯（${err.message}）。`});save();}}
 B.busy=false;if(S.battle===B)battleView();
 if(!b.over&&(S.p.settings.auto||!cmdList(B).length))setTimeout(autoRound,150/(S.p.settings.speed||1));
}
async function playEvents(B,ev){
 const b=B.b;
 for(const e of ev){
  const line=R.narrate(b,e),now=performance.now()/1000,v=id=>B.shown.get(id)||(B.shown.set(id,{hp:0,mp:0,act:'idle',t0:0,dead:false}),B.shown.get(id));sfxOn.v=S.p.settings.sfx!==false;fxFromEvent(B,e);
  if(e.t==='act'||e.t==='round'){for(const w of B.shown.values())if(w.rush&&!w.rush.back)w.rush.back=now;} // 上一個衝出去的人跑回來
  if(e.t==='act'){v(e.a).act=e.kind==='skill'?'special':'attack';v(e.a).t0=now;if(e.mp!=null)v(e.a).mp=e.mp;
   // 近戰（Leo 2026-10-27）：普攻或物理技能、不是弓的，衝到目標面前打；目標看後面第一個打中／閃掉的事件
   const au=b.units.find(x=>x.uid===e.a),phys=e.kind==='attack'||(e.kind==='skill'&&SKILLS[e.skill]?.kind==='phys');
   if(phys&&au&&!au.ranged){const i=ev.indexOf(e),nx=ev.slice(i+1,i+12).find(x=>(x.t==='hit'||x.t==='miss')&&x.a===e.a&&x.d&&x.d!==e.a);if(nx)v(e.a).rush={tgt:nx.d,t0:now,back:null};}}
  if(e.t==='hit'||e.t==='poison'||e.t==='recoil'){const w=v(e.d);if(!(w.ghost>w.hp))w.ghost=w.hp;w.ghostT=now;w.hp=e.hp;if(!w.dead){w.act='hit';w.t0=now;}}
  // 物理打中的瞬間，出手的人剛好衝到最前面
  if(e.t==='hit'&&!e.elem&&e.a!==e.d&&v(e.a)&&!v(e.a).dead){v(e.a).act='attack';v(e.a).t0=now-.16;}
  if(e.t==='heal'||e.t==='revive'){v(e.d).hp=e.hp;if(e.t==='revive')v(e.d).dead=false;}
  if(e.t==='mp')v(e.d).mp=e.mp;
  if(e.t==='miss'){v(e.d).act='dodge';v(e.d).t0=now;}
  if(e.t==='die'){v(e.d).dead=true;v(e.d).t0=now;}
  if(e.t==='capture'){if(e.ok){v(e.d).dead=true;v(e.d).t0=now;v(e.d).caught=true;}else{v(e.d).act='dodge';v(e.d).t0=now;}}
  // 範圍魔法（Leo 2026-10-28）：同一招打到的每個人一起出現，不一個一個等
  if(e.t==='act')B.area=e.kind==='skill'&&SKILLS[e.skill]?.area?e.a:null;
  const burst=B.area&&(e.t==='hit'||e.t==='miss')&&e.a===B.area&&(()=>{const nx=ev[ev.indexOf(e)+1];return nx&&(nx.t==='hit'||nx.t==='miss')&&nx.a===e.a&&nx.d!==e.d;})();
  if(!line)continue;
  B.lines.push(line);if(B.lines.length>200)B.lines.splice(0,B.lines.length-200);
  if(S.battle===B)battleView();await wait(burst?40:e.t==='round'?250:e.t==='act'&&e.kind==='attack'?160:520);
 }
 const now=performance.now()/1000;for(const w of B.shown.values())if(w.rush&&!w.rush.back)w.rush.back=now;
}
function endBattle(B){
 const b=B.b,p=S.p;banner(B,{win:'勝利',lose:'敗北',escaped:'逃走',draw:'平手'}[b.over]||'結束',b.over==='win'?'#ffd86a':b.over==='lose'?'#ff8a6a':'#e8dcc0');
 if(B.kind==='hunt'||B.kind==='dungeon'||B.kind==='raid'){
  E.recordKills(p,b);const r=D.finishFight(p,b);
  if(r.next||r.cleared)E.track(p,'floor');if(r.cleared){E.track(p,'dungeon');p.codex.boss[b.dg]=(p.codex.boss[b.dg]||0)+1;}
  for(const i of [0,...R.goingMates(p)]){const c=charOf(i),broke=E.wear(c);if(broke.length)r.lines.push(`${c.name}的${broke.join('、')}壞了，到工房修理（壞掉的裝備戰鬥中沒有效果）。`);}
  if(b.units.some(u=>u.guest)){const g=E.guestUsed(p);if(g)r.lines.push(g);}
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:b.over==='win'?'打贏了！':b.over==='lose'?'你倒下了。':'離開了戰場。'});
  for(const t of r.lines){B.lines.push({c:'sys',t});say(t);}
  if(b.over==='lose')p.settings.auto=false;
  queueNext(B);
 }else if(B.kind==='coop'){
  const k=B.coop;k.unsub?.();clearTimeout(k.timer);if(k.role==='host'&&b.over!=='escaped')writeParty(k.id,{state:'done'});
  const r=D.finishCoop(p,b,E.dayKey());if(b.over==='win')E.recordKills(p,b);
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:b.over==='win'?'打贏了！':b.over==='lose'?'全隊倒下了。':'離開了戰場。'});
  for(const t of r.lines){B.lines.push({c:'sys',t});say(t);}
 }else if(B.kind==='world'){
  B.lines.push({c:'sys',t:b.over==='lose'?'全員倒下，這次挑戰結束。':`${E.WB_ROUNDS} 回合到了。`});
  for(const t of E.finishWorld(p,b)){B.lines.push({c:'win',t});say(t,'win');}
 }else{
  if(B.kind==='pk'){B.pk.unsub?.();clearTimeout(B.pk.timer);if(B.pk.role==='host')writePk(B.pk.id,{state:'done'});}
  R.finishBout(p,b);const r=B.rival;
  const res=b.over==='win'?`你贏了 ${r.name}！`:b.over==='lose'?`你輸給了 ${r.name}。`:`你和 ${r.name} 打成平手。`;
  B.lines.push({c:b.over==='win'?'win':b.over==='lose'?'lose':'sys',t:res});say((B.kind==='pk'?(B.pk.team?'團 PK：':'即時 PK：'):'擂台：')+res,b.over==='win'?'win':'sys');
  const sp=E.seasonBout(p,b.over==='win'?'win':b.over==='lose'?'lose':'draw',r.npc);if(sp)B.lines.push({c:'sys',t:sp});
  if(!r.npc)recordBout(p.name,{vs:r.key,vsName:r.name,win:b.over==='win'?1:b.over==='lose'?0:-1,t:Date.now()},pidOf(p));
 }
 save();
}

// ---------- 開始 ----------
export async function start(){
 let info=null;if(!globalThis.window?.claude?.use){info=await H.serverInfo();S.server=!!info;} // 先問有沒有伺服器（最多等 1.5 秒），建角色那頁才畫得出登入框（Leo 2026-10-28：開局頁沒地方登入）
 if(S.server){checkBuild(info);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkBuild();});}
 const p=await loadHero();
 const n0=await net();S.online=!!n0;S.uid=n0?.uid||null;S.name=n0?.name||'';
 Promise.resolve(n0).then(n=>{if(!n)return;
  heartbeat();watchChallenges(list=>{S.pkAsks=list;if(S.p&&!S.battle)render();},R.PK_ASK_TTL);
  watchRivals((l,raw,me)=>{S.rivals=l;S.docs=raw;S.me=me;if(S.p){const got=E.collectLends(S.p,raw,me);for(const t of got)say(t,'win');if(got.length)save();}if(['arena','tavern'].includes(S.tab)&&!S.battle&&S.p)render();});
  watchBoard(list=>{S.board=list;if(S.p&&!S.battle&&(S.tab==='board'||S.tab==='town')&&document.activeElement?.tagName!=='INPUT')render();});
  watchMarket(async(list)=>{S.market=list;
   if(S.p){const got=await collectSales(S.p,list);for(const t of got)say(t,'win');}
   // 正在輸入價錢時不重畫，免得字被洗掉
   if(S.p&&!S.battle&&(S.tab==='market'||S.tab==='town')&&!['INPUT','SELECT'].includes(document.activeElement?.tagName))render();});
 });
 if(!p)return createView();
 S.p=p;say(`歡迎回來，${p.name}。`);render();
 if(n0)save(); // 剛登入：本機的角色先推上伺服器，名單、擂台才看得到他
}
