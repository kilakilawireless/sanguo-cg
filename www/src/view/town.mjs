// 城鎮（法蘭城、維諾亞村）：曹操傳式選單，點設施找 NPC。就職、轉職、晉級、學技能、商店、醫院都在這裡。
import {h,mount,spriteCanvas,talk,toast,choose,modal,ask} from './ui.mjs';
import {G,go,save,hud,repTitle} from '../game.mjs';
import {openStatus,itemLine} from './status.mjs';
import * as P from '../core/player.mjs';
import {JOBS,COMBAT_JOBS,GATHER_JOBS,CRAFT_JOBS,MEDIC_JOBS,CHANGE_FEE,PROMOTE_FEE,RANK_SKILL} from '../data/jobs.mjs';
import {SKILLS,SKILL_SLOTS} from '../data/skills.mjs';
import {ITEMS,SHOPS,SLOTS,sellPrice} from '../data/items.mjs';
import {OFFICERS,OFFICER_ORDER,PARTY_MAX} from '../data/officers.mjs';
import {officerStats} from '../core/officer.mjs';
import {RECIPES} from '../data/recipes.mjs';
import {PET_SLOTS,PET_SKILL_SHOP,petSkills,petLearnLv,petLearnPrice,petStats} from '../core/pet.mjs';
import {PLACES} from '../data/places.mjs';
import {QUESTS,QUEST_ORDER} from '../data/quests.mjs';
import {goal} from './goal.mjs';
export {goal};

const MENTOR_ART={lumber:'commonerM',miner:'shaolinMonk',hunter:'hfSpear',sword:'shuofeng',axe:'shaolinMonk',spear:'hfSpear',bow:'commonerM',fighter:'evilThug',guard:'palaceGuard',assassin:'hfBlade',wizard:'tombBell',sealer:'yunzhonghe',beastmaster:'commonerF',doctor:'suxin',nurse:'suxin',mage:'changming',sorcerer:'yunzhonghe',priest:'wudangTaoist'};
const FAC=[
 {id:'clinic',name:'醫院',who:'醫院的護士',art:'suxin',note:'治療、止痛藥'},
 {id:'guild',name:'職業公會',who:'受傷的士兵',art:'palaceGuard',note:'通行證、聲望'},
 {id:'tavern',name:'酒吧',who:'老闆娘',art:'commonerF',note:'招募傭兵'},
 {id:'board',name:'佈告欄',who:'居民的委託',art:'commonerM',note:'支線任務'},
 {id:'tamer',name:'寵物小屋',who:'寵物訓練師',art:'commonerF',note:'寵物學技能'},
 {id:'workshop',name:'採集者公會',who:'公會會長',art:'commonerM',note:'樵夫・礦工・獵人'},
 {id:'smithy',name:'工房',who:'工房師傅',art:'shaolinMonk',note:'打造武器防具、製藥、料理'},
 ...COMBAT_JOBS.map(j=>({id:'job_'+j,job:j,name:JOBS[j].hall,who:JOBS[j].mentor,art:MENTOR_ART[j],note:`${JOBS[j].name}導師`})),
 {id:'weapon',name:'武器店',who:SHOPS.weapon.keeper,art:'commonerM',note:'劍斧槍弓杖'},
 {id:'armor',name:'防具店',who:SHOPS.armor.keeper,art:'commonerF',note:'鎧、衣、袍'},
 {id:'goods',name:'道具店',who:SHOPS.goods.keeper,art:'aheng',note:'藥品、收購魔石材料'},
];
const F=id=>FAC.find(f=>f.id===id);
// 建築：同類的 NPC 收在同一棟裡，點建築再選要找誰（Leo 2026-10-19）。只有一個人的建築直接對話。
const BLD=[
 {id:'clinic',name:'醫院',art:'suxin',g:'life',in:['clinic']},
 {id:'tavern',name:'酒吧',art:'commonerF',g:'life',in:['tavern']},
 {id:'board',name:'佈告欄',art:'commonerM',g:'life',in:['board']},
 {id:'guild',name:'職業公會',art:'palaceGuard',g:'job',note:'通行證・戰鬥系職業',in:['guild',...['sword','axe','spear','bow','fighter','guard','assassin'].map(j=>'job_'+j)]},
 {id:'magic',name:'魔法公會',art:'changming',g:'job',note:'魔法系職業',in:['mage','sorcerer','wizard','priest'].map(j=>'job_'+j)},
 {id:'tamer',name:'寵物小屋',art:'commonerF',g:'job',note:'寵物學技能・封印師・馴獸師',in:['tamer','job_sealer','job_beastmaster']},
 {id:'workshop',name:'採集者公會',art:'commonerM',g:'job',in:['workshop']},
 {id:'smithy',name:'工房',art:'shaolinMonk',g:'shop',in:['smithy']},
 {id:'market',name:'商店街',art:'aheng',g:'shop',note:'武器店・防具店・道具店',in:['weapon','armor','goods']},
];
const GROUPS=[['life','城中'],['job','職業'],['shop','商店與工房']];
// 這座城有的建築，和建築裡的人
const buildings=FAC=>BLD.map(b=>({...b,list:b.in.map(id=>FAC.find(f=>f.id===id)).filter(Boolean)})).filter(b=>b.list.length);
const bldNote=b=>b.note||`${b.list[0].who}・${b.list[0].note}`;
async function enterBld(b,redraw){
 if(b.list.length===1)return visit(b.list[0],redraw);
 const id=await choose(b.name,b.list.map(f=>({label:f.who,value:f.id,note:f.job?(G.p.job===f.job?'你的職業':JOBS[f.job].name):f.note})),{text:'要找誰？'});
 const f=b.list.find(f=>f.id===id);if(f)return visit(f,redraw);
}
// 維諾亞村：醫院、酒吧、工房、商店（◎ 照原作每個城鎮都有醫院和商店）
const TOWN_FAC={luoyang:FAC,changan:[{...F('clinic'),who:'維諾亞的醫生'},{...F('tavern'),who:'酒保'},F('board'),F('tamer'),F('smithy'),F('weapon'),F('armor'),F('goods')]};

// 晉級任務做完後：直接列出還差哪幾項（數字跟導師那裡的晉級條件同一份，不會寫錯）
export function showTown(id){
 const p=G.p;if(!TOWN_FAC[id])id=TOWN_FAC[p.place]?p.place:'luoyang';p.place=id;save();const FAC=TOWN_FAC[id];
 const draw=()=>root.replaceChildren(
  hud(h('button',{class:p.settings.townList?'on':'',onclick:()=>{p.settings.townList=!p.settings.townList;save();draw();}},'清單'),h('button',{onclick:()=>openStatus('stat',draw)},'狀態'),h('button',{class:'primary',onclick:()=>go.map()},'出城')),
  placeTitle(p,id,FAC),
  p.settings.townList?h('div',{class:'facilities scroll'},...GROUPS.flatMap(([g,title])=>{const list=buildings(FAC).filter(b=>b.g===g);return list.length?[h('div',{class:'fac-group'},title),...list.map(b=>h('button',{class:'fac','data-bid':b.id,onclick:()=>enterBld(b,draw)},spriteCanvas(b.art),h('span',{},h('b',{},b.name),h('small',{},bldNote(b)))))]:[];})):townScene(p,buildings(FAC),draw));
 const root=h('div',{class:p.settings.townList?'screen bg':'screen'});
 go.refresh=draw;draw();mount(root);
}

// 目標提示裡提到的設施（取最先提到的那個）：點提示就捲到那個人身上閃一下，新手找得到酒吧在哪（第 53 輪）
function placeTitle(p,id,FAC){
 const g=goal(p),t=buildings(FAC).map(b=>[b,g.indexOf(b.name)]).filter(x=>x[1]>=0).sort((a,b)=>a[1]-b[1])[0]?.[0];
 const show=e=>{const n=e.currentTarget.parentNode.querySelector(`[data-bid="${t.id}"]`);if(!n)return;n.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});n.classList.remove('hint');void n.offsetWidth;n.classList.add('hint');};
 return h('div',{class:'place-title'+(t?' tap':''),onclick:t?show:null},h('h2',{},PLACES[id].name),h('span',{class:'muted small'},g,t?h('span',{class:'gold'},`（點這裡看${t.name}在哪）`):null));
}
const say=(f,t)=>talk([[f.who,f.art,t]]);
async function visit(f,redraw){
 const p=G.p,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 if(f.id==='clinic'){
  const c=P.restCost(p),ch=P.restCost(p,'hp'),tc=P.treatAllCost(p);
  const v=await choose(`${f.name}・${f.who}`,[
   {label:`補生命和魔力（${c} 金）`,value:'all',disabled:!P.restNeed(p),note:(b=>([['主角',b.me],['傭兵',b.officers]].filter(x=>x[1]).map(([n,v])=>`${n} ${v}`).join('、')||(P.restNeed(p)?'只有寵物要補':'大家都很健康'))+'。補 1 點魔力送 2 點生命'+(P.isCombat(p)&&b.me?`，主角這份最多收 ${P.nurseCap(p)} 金`:''))(P.restCostBy(p))+(p.pets?.length?'，寵物免費':'')+(p.gold<c?`。錢不夠補滿，會有多少補多少`:'')},
   {label:`只補生命（${ch} 金）`,value:'hp',disabled:!P.restNeed(p,'hp'),note:'1 點 0.5 金'+(p.gold<ch?'，錢不夠會有多少補多少':'')},
   {label:`治傷（${tc} 金）`,value:'treat',disabled:!tc,note:tc?'治好主角、傭兵、寵物的受傷'+(p.gold<tc?'，錢不夠時重傷會免費治到中傷，再用錢先治傷最重的':''):'沒有人受傷'},
   {label:`買止痛藥（${ITEMS.painkiller.price} 金）`,value:'pk',note:'就職要用'},
   {label:'拜師學醫',value:'medic',note:'醫生（治療）、護士（急救），不用推薦信'},
  ],{text:'「哪裡不舒服？」'});
  if(['all','hp'].includes(v))return done(P.rest(p,v));
  if(v==='treat')return done(P.treatAll(p));
  if(v==='medic'){const j=await choose(`${f.name}・拜師`,MEDIC_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${SKILLS[JOBS[id].main[0]].name}`})));if(j)return mentor({id:'job_'+j,job:j,name:f.name,who:JOBS[j].mentor,art:MENTOR_ART[j]},redraw);return;}
  if(v==='pk'){if(p.gold<ITEMS.painkiller.price)return say(f,'「錢不夠喔。」');if(!P.addItem(p,'painkiller'))return say(f,'「你的道具欄滿了。」');p.gold-=ITEMS.painkiller.price;return done({msg:'「止痛藥給你。職業公會那邊有個受了傷的士兵，好像正需要。」'});}
  return;
 }
 if(f.id==='guild'){
  const v=await choose(`${f.name}`,[
   {label:'把止痛藥給受傷的士兵',value:'pk',note:'換試煉洞窟通行證'},
   {label:'問就職的事',value:'how'},
   {label:'查看聲望與稱號',value:'rep'},
   {label:'回到遊民',value:'quit',disabled:p.job==='none',note:'會失去所有技能'},
  ]);
  if(v==='pk')return done(P.givePainkiller(p));
  if(v==='how')return talk([[ '公會書記','commonerM','想就職的話，先拿到試煉洞窟的通行證。洞窟 6 樓的試煉官看你手上拿什麼武器，就替你寫哪個職業的推薦信。'],['公會書記','commonerM','劍士、戰斧鬥士、騎士、弓箭手、忍者、格鬥士、士兵的導師都在這棟職業公會裡；魔術師、咒術師、巫師在魔法公會，杖拿推薦信去那裡。傳教士不用推薦信，去魔法公會答神父的問題就行。封印師、馴獸師在寵物小屋，也不用推薦信。'],['公會書記','commonerM',`已經有職業的人想換，就是轉職：要再拿一次推薦信、付 ${CHANGE_FEE} 金，聲望會歸零，從見習重新開始，技能等級不會掉，只是超過新職業上限的只能用到上限。`]]);
  if(v==='rep')return say({who:'公會書記',art:'commonerM'},p.job==='none'?'「遊民不會累積聲望。先就職吧。」':`「你的聲望是 ${p.rep}，稱號『${repTitle(p)}』。打怪、採集、製造都會累積聲望。」`);
  if(v==='quit'&&await ask('回到遊民會失去所有技能。','回到遊民'))return done(P.quitJob(p));
  return;
 }
 if(f.id==='tavern')return tavern(f,redraw);
 if(f.id==='tamer')return tamer(f,redraw);
 if(f.id==='board')return board(redraw);
 if(f.id==='workshop'){
  const j=await choose('採集者公會',GATHER_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${JOBS[id].main.map(s=>SKILLS[s].name).join('')}`})),{text:'「出城砍樹、挖礦、打獵，也能過日子。採到的材料拿去道具店賣，以後還能拿來做東西。遊民也能先學採集。」'});
  if(j)return mentor({id:'job_'+j,job:j,name:'採集者公會',who:JOBS[j].mentor,art:MENTOR_ART[j]},redraw);
  return;
 }
 if(f.id==='smithy'){
  const mine=p.skills.filter(s=>SKILLS[s.id].kind==='craft');
  const j=await choose('工房',[{label:'製造',value:'craft',disabled:!mine.length,note:mine.length?mine.map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、'):'要先跟師傅學製造技能'},
   {label:'買師傅做好的裝備',value:'buy',note:'3、4 級的好裝備，比自己做貴'},
   ...CRAFT_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${SKILLS[JOBS[id].main[0]].name}`}))],
   {text:'「材料拿來，我這裡的爐子、木台隨你用。商店買不到的 3、4 級好裝備是工匠做的，師傅做好的成品也能直接買，不過自己採材料來做便宜得多；藥劑師做藥、廚師做菜也在這裡。不是本行的人也能學，但最多只能學到 2 級。」'});
  if(j==='craft')return workshopCraft(redraw);
  if(j==='buy')return shop(f,SHOPS.smithy,redraw);
  if(j)return mentor({id:'job_'+j,job:j,name:'工房',who:JOBS[j].mentor,art:'commonerM'},redraw);
  return;
 }
 if(f.job)return mentor(f,redraw);
 return shop(f,SHOPS[f.id],redraw);
}

async function mentor(f,redraw){
 const p=G.p,j=JOBS[f.job],mine=p.job===f.job,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 const teach=Object.entries(SKILLS).filter(([,s])=>s.teacher===f.job);
 const opts=[];
 if(!mine)opts.push({label:p.job==='none'?`就職成為${j.ranks[0]}`:`轉職為${j.ranks[0]}（${CHANGE_FEE} 金）`,value:'join',note:j.gather||j.free?'不用推薦信':j.quiz?'要先答對問題':`要${ITEMS[j.letter]?.name||'推薦信'}`});
 if(j.quiz&&!mine)opts.push({label:'回答神父的問題',value:'quiz',disabled:!!p.flags.quizPassed});
 if(teach.length)opts.push({label:'學技能',value:'learn'});
 if(mine)opts.push({label:'晉級',value:'promote'});
 opts.push({label:'聊聊',value:'chat'});
 const v=await choose(`${j.hall}・${j.mentor}`,opts,{text:mine?`「${P.jobTitle(p)}，修行得怎麼樣？」`:`「這裡是${j.hall}，教的是${j.name}的本事。」`});
 if(v==='join'){
  const c=P.canTakeJob(p,f.job);if(!c.ok)return say(f,c.msg);
  if(p.job!=='none'&&!await ask(`轉職要 ${CHANGE_FEE} 金，聲望歸零、從見習重新開始，技能等級不會掉，超過新職業上限的只能用到上限。`,'轉職'))return;
  return done(P.takeJob(p,f.job));
 }
 if(v==='quiz'){
  const ans=[];
  for(const [q,choices] of P.QUIZ){const a=await choose('神父的問題',choices.map((c,i)=>({label:c,value:i})),{text:q});if(a==null)return;ans.push(a);}
  return done(P.answerQuiz(p,ans));
 }
 if(v==='learn'){
  const id=await choose('學技能',teach.map(([id,s])=>{const have=P.skillOf(p,id),cap=P.capOf(p,id);
   return {label:`${s.name}　${s.price} 金`,value:id,disabled:!!have,note:have?`已學會（Lv${have.lv}）`:`${s.desc(1)}${cap?`（你的上限 ${cap} 級）`:'（現在的職業學不了）'}${cap&&p.gold<s.price?`　還差 ${s.price-p.gold} 金`:''}`};}),{text:`金錢 ${p.gold}。技能欄 ${p.skills.length}/${SKILL_SLOTS}${p.skills.length>=SKILL_SLOTS?'（滿了，先到狀態→技能忘掉一招）':''}。`}); // 錢不夠、欄滿先寫出來（第 79 輪）
  if(id)return done(P.learnSkill(p,id));
  return;
 }
 if(v==='promote'){
  const c=P.promoteCheck(p);
  if(!c.rows.length)return say(f,c.msg);
  const go2=await choose('晉級',[{label:`晉級為${c.name}`,value:'ok',disabled:!c.ok}],{text:h('div',{},...c.rows.map(([n,ok,now])=>h('div',{class:ok?'green':'red'},`${ok?'✓':'✗'} ${n}（${now}）`)))});
  if(go2)return done(P.promote(p));
  return;
 }
 if(v==='chat')return say(f,CHAT[f.job]||(j.craft?`「${j.name}靠${SKILLS[j.main[0]].name}吃飯。技能等級越高，做得出越好的裝備；材料去野外採，或跟採集的人買。」`:'「好好修行。」'));
}
const CHAT={
 sword:'「劍士什麼都能打。連擊、乾坤一擲、迅速果斷，都是劍士的看家本領。」',
 axe:'「拿斧頭的人最容易打出必殺！諸刃雖然傷身，威力可是一流。」',
 spear:'「拿槍的人反擊最多。敵人越打你，你還手越多。」',
 bow:'「弓箭手站在後面放箭，近身的反擊打不到你。亂射能一口氣射好幾支。」',
 mage:'「魔法看的是精神與魔攻。屬性相剋的話，傷害能差上三成。」',
 lumber:'「伐木要在有樹的地方，芙蕾雅、盜賊的巢穴、樹精之森都行。伐木等級越高，砍得到越好的木材。」',
 miner:'「試煉洞窟裡有銅礦、鐵礦，運氣好還有銀礦。挖礦很耗力氣，魔力用光就挖不動了。」',
 hunter:'「芙蕾雅有獸肉、獸皮。樹精之森有鹿角、貂皮，不過那裡的魔物很兇。」',
 fighter:'「格鬥士不拿武器，靠的是一雙拳頭。氣功彈能打好幾個人，崩擊連防禦都擋不住；受了傷就用明鏡止水。」',
 guard:'「士兵不求殺得多，只求一個都不倒。護衛替同伴擋攻擊，聖盾讓敵人打不動你。」',
 assassin:'「忍者要快、要準。暗殺對頭目沒用，但對血少的魔物很靈；毒擊讓對方慢慢流血。」',
 wizard:'「巫師不求速勝。吸血魔法奪取生命補自己，恢復魔法讓同伴撐過難關。」',
 sealer:'「魔物也能變成夥伴。用封印比空手捕捉容易得多，頭目卻是怎樣都封不了的。」',
 beastmaster:'「寵物跟人一樣，要有人帶。寵物強化一下，牠就拚了命地打。」',
 doctor:'「受了傷，補血是補不回來的。醫生的治療，能在城外替同伴把傷治好，省下回醫院的路。」',
 nurse:'「護士隨隊出發，急救不必花大錢也能止血。技能等級越高，一次補得越多。」',
 sorcerer:'「咒術不傷人，卻能讓人睡、讓人亂、讓人忘。頭目心志堅定，比較難得手。中了石化或昏睡的隊友，要靠傳教士的潔淨魔法。」',
 priest:'「補血魔法的回復量看對象的回復力。傳教士晉級看的是補血魔法的等級，不是人的等級。」',
};

// 酒吧：招募或請傭兵離隊（原作的組隊，單機版由傭兵補滿五人）
async function tavern(f,redraw){
 const p=G.p;
 const v=await choose('酒吧・招募傭兵',OFFICER_ORDER.filter(id=>(OFFICERS[id].town||'luoyang')===p.place||p.party.includes(id)).map(id=>{const d=OFFICERS[id],o=p.officers[id],inParty=p.party.includes(id),c=P.canRecruit(p,id);
  return {label:`${d.name}　${JOBS[d.job].name}${o?` Lv${o.lv}`:''}　${inParty?'隊伍中':o?'在酒吧等你':d.fee?`${d.fee} 金`:'免費'}`,value:id,note:[`${d.front?'站前排':'站後排'}，會${d.skills.map(k=>SKILLS[k].name).join('、')}`,inParty?'點了離隊':c.ok?'':c.msg].filter(Boolean).join('。')};}), // 寫出站位和技能，挑傭兵看得出誰補血誰打（第 77 輪）
  {text:`隊伍 ${p.party.length+1}/${PARTY_MAX+1} 人。傭兵會自己判斷行動，經驗照各自的等級算。會用魔法的傭兵回城補魔力比較花錢。金錢 ${p.gold}`});
 if(!v)return;const d=OFFICERS[v];
 if(p.party.includes(v)){if(await ask(`請${d.name}離隊？他會留在酒吧，等級不會掉。`,'離隊')){const r=P.dismiss(p,v);save();redraw();toast(r.msg);}return;}
 const r=P.canRecruit(p,v);if(!r.ok)return talk([[d.name,d.art,r.msg]]);
 if(!p.officers[v])await talk([[d.name,d.art,d.intro]]);
 const res=P.recruit(p,v);save();redraw();toast(res.msg);
}

async function shop(f,s,redraw){
 const p=G.p;
 const v=await choose(`${s.name}・${s.keeper}`,[{label:'買',value:'buy'},{label:'賣',value:'sell'}],{text:`「歡迎光臨。」金錢 ${p.gold}`});
 if(v==='buy'){
  // 自己職業不能用的裝備收起來，點了才展開（武器店清單太長，手機要一直捲）
  // 能穿的照部位、等級排（工房師傅賣五十多件，混在一起很難找，第 60 輪）
  const ord=id=>ITEMS[id].slot?SLOTS.indexOf(ITEMS[id].slot)*10+ITEMS[id].lv:-1;
  const can=id=>!ITEMS[id].slot||P.canEquip(p,id).ok,mine=s.stock.filter(can).sort((a,b)=>ord(a)-ord(b)),other=s.stock.filter(id=>!can(id));let more=false;
  const row=id=>{const it=ITEMS[id],ok=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row',style:ok.ok?null:{opacity:.55}},h('span',{class:'grow'},it.name,h('div',{class:'small muted'},itemLine(id),it.slot&&!ok.ok?`（${ok.msg}）`:''),ok.ok&&p.gold<it.price?h('div',{class:'small red'},`還差 ${it.price-p.gold} 金`):null),h('span',{class:'gold'},it.price),
    h('button',{disabled:p.gold<it.price,onclick:()=>{if(!P.addItem(p,id)){toast('道具欄滿了');return;}p.gold-=it.price;save();redraw();refresh();toast(`買了${it.name}`);}},'買'));};
  let refresh;
  modal(`${s.name}・買`,(r)=>(refresh=r,h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...mine.map(row),
   other.length?h('button',{onclick:()=>{more=!more;refresh();}},more?'收起其他職業的裝備':`其他職業的裝備（${other.length} 件）`):null,...(more?other.map(row):[]))));
 }else if(v==='sell'){
  modal(`${s.name}・賣`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}`),...p.bag.filter(x=>ITEMS[x.id].kind!=='key').map(x=>
   h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,x.n>1?` ×${x.n}`:''),h('span',{class:'gold'},sellPrice(x.id)),
    h('button',{onclick:()=>{P.removeItem(p,x.id);p.gold+=sellPrice(x.id);save();redraw();refresh();}},'賣'),
    x.n>1?h('button',{onclick:()=>{const n=x.n;P.removeItem(p,x.id,n);p.gold+=sellPrice(x.id)*n;save();redraw();refresh();}},'全賣'):null))));
 }
}

// 材料從哪裡來：哪些野外能用哪個採集技能採到、技能要幾級
function matFrom(m){
 const by={};for(const pl of Object.values(PLACES))for(const [sk,l] of Object.entries(pl.gather||{}))if(l.includes(m))(by[sk]||=[]).push(pl.name);
 return Object.entries(by).map(([sk,ns])=>`${SKILLS[sk].name} ${ITEMS[m].tier||1} 級：${ns.join('、')}`).join('；');
}
// 製造：列出會的製造技能能做的裝備（到技能上限為止），材料不夠的反灰
function workshopCraft(redraw){
 const p=G.p;
 modal('製造',(refresh)=>{
  const mine=p.skills.filter(s=>SKILLS[s.id].kind==='craft');
  const rows=Object.entries(RECIPES).filter(([,r])=>mine.some(s=>s.id===r.skill)&&r.lv<=Math.max(P.capOf(p,r.skill),1)),own=id=>JOBS[p.job].main.includes(id)?0:1; // 本行的製造技能排前面（第 74 輪）
  rows.sort((a,b)=>own(a[1].skill)-own(b[1].skill)||a[1].skill.localeCompare(b[1].skill)||a[1].lv-b[1].lv);
  return h('div',{class:'col'},h('div',{class:'gold'},`魔力 ${p.mp}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...rows.map(([id,r])=>{const c=P.canCraft(p,id);
   return h('div',{class:'row',style:c.ok?null:{opacity:.6}},h('span',{class:'grow'},`${ITEMS[id].name}（${r.lv} 級${SKILLS[r.skill].name}）`,
    h('div',{class:'small muted'},itemLine(id)),h('div',{class:'small'},...r.mats.map(([m,n])=>h('span',{class:P.countItem(p,m)>=n?'green':'red'},`${ITEMS[m].name} ${P.countItem(p,m)}/${n}　`)),`魔力 ${P.craftMp(p,id)}`),
    !c.ok&&!c.msg.startsWith('材料')?h('div',{class:'small red'},c.msg):null, // 技能等級、魔力不夠也寫出來，不然反灰看不出為什麼（第 73 輪）
    ...r.mats.filter(([m,n])=>P.countItem(p,m)<n).map(([m])=>matFrom(m)&&h('div',{class:'small muted'},`${ITEMS[m].name}：${matFrom(m)}`))),
    h('button',{disabled:!c.ok,onclick:()=>{const res=P.craft(p,id);save();redraw();refresh();toast(res.msg);}},'做'));}));
 });
}

// 寵物小屋：寵物花錢學技能、忘記學來的技能
async function tamer(f,redraw){
 const p=G.p;
 if(!p.pets.length)return say(f,'「你還沒有寵物。戰鬥中用「捕捉」抓一隻，帶來我教牠本事。」');
 const uid=await choose('寵物小屋・選寵物',p.pets.map(x=>({label:`${x.name} Lv${x.lv}`,value:x.uid,note:`技能 ${petSkills(x).length}/${PET_SLOTS}：${petSkills(x).map(s=>SKILLS[s.id].name).join('、')||'無'}`})),{text:`「學到的技能等級看寵物現在的等級，學了就不會再變；等級越高學費越貴。」金錢 ${p.gold}`});
 if(!uid)return;const x=p.pets.find(q=>q.uid===uid),have=petSkills(x);
 const v=await choose(`${x.name}・學技能（Lv${petLearnLv(x)}）`,[
  ...Object.keys(PET_SKILL_SHOP).map(id=>[id,petLearnPrice(x,id)]).map(([id,price])=>({label:`${SKILLS[id].name}　${price} 金`,value:'learn:'+id,disabled:have.some(s=>s.id===id)||have.length>=PET_SLOTS||p.gold<price,note:have.some(s=>s.id===id)?'已經會了':SKILLS[id].desc(petLearnLv(x))})),
  ...(x.learned||[]).map(s=>({label:`忘記${SKILLS[s.id].name}`,value:'forget:'+s.id,note:'空出技能欄'}))],{text:(st=>`技能欄 ${have.length}/${PET_SLOTS}。金錢 ${p.gold}。${x.name}：攻擊 ${st.atk}、精神 ${st.spr}、魔力 ${st.maxMp}。攻擊高的學物理招，精神、魔力高的學魔法。`)(petStats(x))}); // 寵物適合學什麼（第 76 輪）
 if(!v)return;const [op,id]=v.split(':');
 const r=op==='learn'?P.petLearn(p,uid,id):P.petForget(p,uid,id);save();redraw();toast(r.msg);
}

// 佈告欄：這座城的支線任務
async function board(redraw){
 const p=G.p,list=QUEST_ORDER.filter(id=>QUESTS[id].town===p.place);
 const status=id=>{const q=QUESTS[id],s=P.questOf(p,id),n=P.questProgress(p,id);
  if(!s)return p.lv<q.minLv?`要 ${q.minLv} 級`:'可以接';if(s.state==='done')return '已完成';return n>=q.need.n?'可以回報！':`進行中 ${n}/${q.need.n}`;};
 const id=await choose('佈告欄',list.map(id=>({label:`${QUESTS[id].name}（${QUESTS[id].giver}）`,value:id,disabled:P.questOf(p,id)?.state==='done',note:status(id)})),{text:'城裡居民的委託。完成後回來找委託人領報酬。'});
 if(!id)return;const q=QUESTS[id],who={who:q.giver,art:q.art},s=P.questOf(p,id);
 if(!s){await say(who,q.text);const r=P.acceptQuest(p,id);save();redraw();return r.ok?toast(r.msg):say(who,`「${r.msg}」`);}
 const r=P.finishQuest(p,id);
 if(!r.ok)return say(who,`「還沒好嗎？${q.need.item?`${ITEMS[q.need.item].name}要 ${q.need.n} 個，你身上有 ${P.questProgress(p,id)} 個。`:`還差 ${q.need.n-P.questProgress(p,id)} 隻。`}」`);
 save();redraw();await say(who,q.done);toast(r.msg,3500);
}

// 城鎮場景（照原作）：場景圖上站著各個 NPC，點人就對話、開功能；手機直拿時可以左右滑。主角站在廣場中間。
// 座標是 NPC 腳底在場景圖上的位置（%）。「清單」按鈕可以切回設施清單。
const NPC_POS={clinic:[12,64],tavern:[22,46],board:[69,34],guild:[82,44],magic:[70,72],tamer:[88,80],workshop:[26,80],smithy:[45,46],market:[34,34]};
const townScroll={};
function townScene(p,BL,redraw){
 const scene=h('div',{class:'town-scene'},
  ...BL.map(b=>{const [x,y]=NPC_POS[b.id]||[50,50];return h('button',{class:'npc','data-bid':b.id,style:{left:x+'%',bottom:(100-y)+'%'},onclick:()=>enterBld(b,redraw),title:bldNote(b)},
   h('span',{class:'plate'},b.name),spriteCanvas(b.art,{w:70,h:96,height:84,facing:x<50?'front-right':'front-left'}));}),
  h('div',{class:'npc me',style:{left:'50%',bottom:'36%'}},h('span',{class:'plate'},p.name),spriteCanvas(p.look,{w:70,h:96,height:84,facing:'front-right'})));
 const wrap=h('div',{class:'town-stage'},scene);
 // 手機直拿時只看得到三分之一的城：兩邊放箭頭，寫出那邊還有幾個地方，點了往那邊捲（第 2 輪優化）
 const xs=BL.map(b=>(NPC_POS[b.id]||[50])[0]/100);
 const arrow=dir=>h('button',{class:'town-arrow '+dir,onclick:()=>wrap.scrollBy({left:(dir==='left'?-1:1)*wrap.clientWidth*.7,behavior:'smooth'})});
 const L=arrow('left'),R=arrow('right');
 const upd=()=>{const W=scene.offsetWidth,a=wrap.scrollLeft,b=a+wrap.clientWidth,nl=a>1?xs.filter(x=>x*W<a+20).length:0,nr=b<wrap.scrollWidth-1?xs.filter(x=>x*W>b-20).length:0;
  L.hidden=!nl;R.hidden=!nr;L.textContent=`◀ ${nl}`;R.textContent=`${nr} ▶`;L.title=`左邊還有 ${nl} 個地方`;R.title=`右邊還有 ${nr} 個地方`;};
 // 買東西、學技能後畫面會重畫：記住捲到哪裡，不要每次都跳回中間（第 4 輪）；第一次進城才置中
 wrap.addEventListener('scroll',()=>{upd();townScroll[p.place]=wrap.scrollLeft;},{passive:true});
 // 站在最邊邊的人，名牌會超出城的圖，右邊多出一條黑邊、還能多捲幾格（第 9 輪）：把超出的名牌往內推
 const fit=()=>{const W=scene.offsetWidth;for(const n of scene.querySelectorAll('.npc')){const x=n.dataset.x||(n.dataset.x=n.style.left);n.style.left=x;const c=n.offsetLeft+n.offsetWidth/2,hw=Math.max(...[...n.children].map(e=>e.offsetWidth))/2,d=Math.min(0,W-2-(c+hw))||Math.max(0,2-(c-hw));if(d)n.style.left=`calc(${x} + ${d}px)`;}upd();};
 new ResizeObserver(fit).observe(wrap);
 requestAnimationFrame(()=>{fit();wrap.scrollLeft=townScroll[p.place]??(wrap.scrollWidth-wrap.clientWidth)/2;upd();});
 return h('div',{class:'town-box'},wrap,L,R);
}
