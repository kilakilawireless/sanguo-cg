// 城鎮（法蘭城、維諾亞村）：曹操傳式選單，點設施找 NPC。就職、轉職、晉級、學技能、商店、醫院都在這裡。
import {h,mount,spriteCanvas,talk,toast,choose,modal,ask} from './ui.mjs';
import {G,go,save,hud,repTitle} from '../game.mjs';
import {openStatus,itemLine} from './status.mjs';
import * as P from '../core/player.mjs';
import {JOBS,COMBAT_JOBS,GATHER_JOBS,CRAFT_JOBS,MEDIC_JOBS,CHANGE_FEE,PROMOTE_FEE} from '../data/jobs.mjs';
import {SKILLS} from '../data/skills.mjs';
import {ITEMS,SHOPS,sellPrice} from '../data/items.mjs';
import {OFFICERS,OFFICER_ORDER,PARTY_MAX} from '../data/officers.mjs';
import {officerStats} from '../core/officer.mjs';
import {RECIPES} from '../data/recipes.mjs';
import {PET_SLOTS,PET_SKILL_SHOP,petSkills,petLearnLv} from '../core/pet.mjs';
import {PLACES} from '../data/places.mjs';
import {QUESTS,QUEST_ORDER} from '../data/quests.mjs';

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
function promoteGoal(p){
 const c=P.promoteCheck(p),miss=c.rows.filter(r=>!r[1]);
 if(!miss.length)return `晉級條件都達到了，回導師那裡晉級為${c.name}。`;
 return `晉級${c.name}還差：${miss.map(r=>`${r[0]}（${r[2]}）`).join('、')}。`+(miss.some(r=>r[0].startsWith('聲望'))?'聲望靠打怪、採集、製造累積。':'');
}
export function goal(p){
 if(!p.party.length&&!Object.keys(p.officers).length)return '先到酒吧找傭兵蓋爾，他願意免費跟你同行。之後還能招募羅蘭、艾倫、梅林，湊滿五人隊伍。';
 if(p.job==='none'){
  if(Object.values(JOBS).some(j=>j.letter&&P.countItem(p,j.letter)))return '帶著推薦信去找那個職業的導師就職。';
  if(P.countItem(p,'trialPass'))return '先到商店街的武器店買想學的那種武器裝上，再到試煉洞窟 6 樓找試煉官拿推薦信。想當傳教士的話，直接去魔法公會找神父答題。';
  if(P.countItem(p,'painkiller'))return '把止痛藥交給職業公會裡受傷的士兵。';
  return '到醫院買止痛藥，交給職業公會裡受傷的士兵，換試煉洞窟的通行證。';
 }
 if(JOBS[p.job].gather&&p.rank<2)return promoteGoal(p); // 採集職靠技能等級晉級，不用晉級任務
 if(p.rank===0){
  if(p.flags.treant)return promoteGoal(p);
  if(p.lv>=20)return '去樹精之森打倒樹精長老，完成晉級任務「樹精長老的末日」。';
  // 還拿著國民裝備：提醒魔石賣錢、存錢換 1 級裝備
  if((p.job==='fighter'?['body']:['weapon','body']).some(s=>ITEMS[p.equip[s]]?.cheap||!p.equip[s])&&p.lv>=3)return '打到的魔石拿去商店街的道具店賣，存到 1500 金就能換 1 級武器或盔甲。補給很花錢，魔力不夠時可以只補生命。';
  return '到芙蕾雅、盜賊的巢穴歷練。20 級後挑戰樹精之森，晉級正職。';
 }
 if(p.rank===1){
  if(p.flags.beast)return promoteGoal(p);
  if(!p.flags.hangu)return p.lv<24?'在樹精之森練到 24 級左右，再去莎蓮娜海底洞窟。黑騎士團長擋住了往維諾亞村的路。':'去海底洞窟打倒黑騎士團長，打通往維諾亞村的路。';
  if(p.lv<45)return '到維諾亞村的酒吧招募克勞斯、莉莉安。古代王墓適合 32～42 級。45 級以後去神獸之谷挑戰咆哮的神獸。';
  return '去神獸之谷打倒咆哮的神獸，完成晉級任務。';
 }
 return '恭喜晉級王宮職！後面的晉級任務之後開放。';
}

export function showTown(id){
 const p=G.p;if(!TOWN_FAC[id])id=TOWN_FAC[p.place]?p.place:'luoyang';p.place=id;save();const FAC=TOWN_FAC[id];
 const draw=()=>root.replaceChildren(
  hud(h('button',{class:p.settings.townList?'on':'',onclick:()=>{p.settings.townList=!p.settings.townList;save();draw();}},'清單'),h('button',{onclick:()=>openStatus('stat',draw)},'狀態'),h('button',{class:'primary',onclick:()=>go.map()},'出城')),
  h('div',{class:'place-title'},h('h2',{},PLACES[id].name),h('span',{class:'muted small'},goal(p))),
  p.settings.townList?h('div',{class:'facilities scroll'},...GROUPS.flatMap(([g,title])=>{const list=buildings(FAC).filter(b=>b.g===g);return list.length?[h('div',{class:'fac-group'},title),...list.map(b=>h('button',{class:'fac',onclick:()=>enterBld(b,draw)},spriteCanvas(b.art),h('span',{},h('b',{},b.name),h('small',{},bldNote(b)))))]:[];})):townScene(p,buildings(FAC),draw));
 const root=h('div',{class:p.settings.townList?'screen bg':'screen'});
 go.refresh=draw;draw();mount(root);
}

const say=(f,t)=>talk([[f.who,f.art,t]]);
async function visit(f,redraw){
 const p=G.p,done=r=>{save();redraw();if(r?.msg)return say(f,r.msg);};
 if(f.id==='clinic'){
  const c=P.restCost(p),ch=P.restCost(p,'hp'),cm=P.restCost(p,'mp'),tc=P.treatAllCost(p);
  const v=await choose(`${f.name}・${f.who}`,[
   {label:`補生命和魔力（${c} 金）`,value:'all',disabled:!c,note:(b=>[['主角',b.me],['傭兵',b.officers],['寵物',b.pets]].filter(x=>x[1]).map(([n,v])=>`${n} ${v}`).join('、')||'大家都很健康')(P.restCostBy(p))+(p.gold<c?`。錢不夠補滿，會有多少補多少`:'')},
   {label:`只補生命（${ch} 金）`,value:'hp',disabled:!ch,note:'1 點 0.5 金'+(p.gold<ch?'，錢不夠會有多少補多少':'')},
   {label:`只補魔力（${cm} 金）`,value:'mp',disabled:!cm,note:'1 點 1 金'+(p.gold<cm?'，錢不夠會有多少補多少':'')},
   {label:`治傷（${tc} 金）`,value:'treat',disabled:!tc,note:tc?'治好主角、傭兵、寵物的受傷':'沒有人受傷'},
   {label:`買止痛藥（${ITEMS.painkiller.price} 金）`,value:'pk',note:'就職要用'},
   {label:'拜師學醫',value:'medic',note:'醫生（治療）、護士（急救），不用推薦信'},
  ],{text:'「哪裡不舒服？」'});
  if(['all','hp','mp'].includes(v))return done(P.rest(p,v));
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
  if(v==='how')return talk([[ '公會書記','commonerM','想就職的話，先拿到試煉洞窟的通行證。洞窟 6 樓的試煉官看你手上拿什麼武器，就替你寫哪個職業的推薦信。'],['公會書記','commonerM','劍士、戰斧鬥士、騎士、弓箭手、忍者、格鬥士、士兵的導師都在這棟職業公會裡；魔術師、咒術師、巫師在魔法公會，杖拿推薦信去那裡。傳教士不用推薦信，去魔法公會答神父的問題就行。封印師、馴獸師在寵物小屋，也不用推薦信。'],['公會書記','commonerM',`已經有職業的人想換，就是轉職：要再拿一次推薦信、付 ${CHANGE_FEE} 金，聲望會歸零，從見習重新開始，超過新職業上限的技能會降級。`]]);
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
   ...CRAFT_JOBS.map(id=>({label:`${JOBS[id].mentor}（${JOBS[id].name}）`,value:id,note:p.job===id?'你的職業':`教${SKILLS[JOBS[id].main[0]].name}`}))],
   {text:'「材料拿來，我這裡的爐子、木台隨你用。商店買不到的 3、4 級好裝備，只有工匠做得出來；藥劑師做藥、廚師做菜也在這裡。不是本行的人也能學，但最多只能學到 2 級。」'});
  if(j==='craft')return workshopCraft(redraw);
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
  if(p.job!=='none'&&!await ask(`轉職要 ${CHANGE_FEE} 金，聲望歸零、從見習重新開始，超過新上限的技能會降級。`,'轉職'))return;
  return done(P.takeJob(p,f.job));
 }
 if(v==='quiz'){
  const ans=[];
  for(const [q,choices] of P.QUIZ){const a=await choose('神父的問題',choices.map((c,i)=>({label:c,value:i})),{text:q});if(a==null)return;ans.push(a);}
  return done(P.answerQuiz(p,ans));
 }
 if(v==='learn'){
  const id=await choose('學技能',teach.map(([id,s])=>{const have=P.skillOf(p,id),cap=P.capOf(p,id);
   return {label:`${s.name}　${s.price} 金`,value:id,disabled:!!have,note:have?'已學會':`${s.desc(1)}${cap?`（你的上限 ${cap} 級）`:'（你學不了）'}`};}),{text:`金錢 ${p.gold}。技能欄 ${p.skills.length}/10。`});
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
  return {label:`${d.name}　${JOBS[d.job].name}${o?` Lv${o.lv}`:''}　${inParty?'（隊伍中，點了離隊）':o?'（在酒吧等你）':d.fee?`${d.fee} 金`:'免費'}`,value:id,note:inParty?'':c.ok?'':c.msg};}),
  {text:`隊伍 ${p.party.length+1}/${PARTY_MAX+1} 人。傭兵會自己判斷行動，經驗照各自的等級算。金錢 ${p.gold}`});
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
  modal(`${s.name}・買`,(refresh)=>h('div',{class:'col'},h('div',{class:'gold'},`金錢 ${p.gold}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...[...s.stock].sort((a,b)=>(ITEMS[a].slot&&!P.canEquip(p,a).ok)-(ITEMS[b].slot&&!P.canEquip(p,b).ok)).map(id=>{const it=ITEMS[id],ok=it.slot?P.canEquip(p,id):{ok:true};
   return h('div',{class:'row',style:ok.ok?null:{opacity:.55}},h('span',{class:'grow'},it.name,h('div',{class:'small muted'},itemLine(id),it.slot&&!ok.ok?`（${ok.msg}）`:''),p.gold<it.price?h('div',{class:'small red'},`還差 ${it.price-p.gold} 金`):null),h('span',{class:'gold'},it.price),
    h('button',{disabled:p.gold<it.price,onclick:()=>{if(!P.addItem(p,id)){toast('道具欄滿了');return;}p.gold-=it.price;save();redraw();refresh();toast(`買了${it.name}`);}},'買'));})));
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
  const rows=Object.entries(RECIPES).filter(([,r])=>mine.some(s=>s.id===r.skill)&&r.lv<=Math.max(P.capOf(p,r.skill),1)).sort((a,b)=>a[1].skill.localeCompare(b[1].skill)||a[1].lv-b[1].lv);
  return h('div',{class:'col'},h('div',{class:'gold'},`魔力 ${p.mp}　道具欄 ${p.bag.length}/${P.BAG_SIZE}`),...rows.map(([id,r])=>{const c=P.canCraft(p,id);
   return h('div',{class:'row',style:c.ok?null:{opacity:.6}},h('span',{class:'grow'},`${ITEMS[id].name}（${r.lv} 級${SKILLS[r.skill].name}）`,
    h('div',{class:'small muted'},itemLine(id)),h('div',{class:'small'},...r.mats.map(([m,n])=>h('span',{class:P.countItem(p,m)>=n?'green':'red'},`${ITEMS[m].name} ${P.countItem(p,m)}/${n}　`)),`魔力 ${P.craftMp(p,id)}`),
    ...r.mats.filter(([m,n])=>P.countItem(p,m)<n).map(([m])=>matFrom(m)&&h('div',{class:'small muted'},`${ITEMS[m].name}：${matFrom(m)}`))),
    h('button',{disabled:!c.ok,onclick:()=>{const res=P.craft(p,id);save();redraw();refresh();toast(res.msg);}},'做'));}));
 });
}

// 寵物小屋：寵物花錢學技能、忘記學來的技能
async function tamer(f,redraw){
 const p=G.p;
 if(!p.pets.length)return say(f,'「你還沒有寵物。戰鬥中用「捕捉」抓一隻，帶來我教牠本事。」');
 const uid=await choose('寵物小屋・選寵物',p.pets.map(x=>({label:`${x.name} Lv${x.lv}`,value:x.uid,note:`技能 ${petSkills(x).length}/${PET_SLOTS}：${petSkills(x).map(s=>SKILLS[s.id].name).join('、')||'無'}`})),{text:`「學到的技能等級看寵物現在的等級，學了就不會再變。」金錢 ${p.gold}`});
 if(!uid)return;const x=p.pets.find(q=>q.uid===uid),have=petSkills(x);
 const v=await choose(`${x.name}・學技能（Lv${petLearnLv(x)}）`,[
  ...Object.entries(PET_SKILL_SHOP).map(([id,price])=>({label:`${SKILLS[id].name}　${price} 金`,value:'learn:'+id,disabled:have.some(s=>s.id===id)||have.length>=PET_SLOTS||p.gold<price,note:have.some(s=>s.id===id)?'已經會了':SKILLS[id].desc(petLearnLv(x))})),
  ...(x.learned||[]).map(s=>({label:`忘記${SKILLS[s.id].name}`,value:'forget:'+s.id,note:'空出技能欄'}))],{text:`技能欄 ${have.length}/${PET_SLOTS}。金錢 ${p.gold}`});
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
  ...BL.map(b=>{const [x,y]=NPC_POS[b.id]||[50,50];return h('button',{class:'npc',style:{left:x+'%',bottom:(100-y)+'%'},onclick:()=>enterBld(b,redraw),title:bldNote(b)},
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
