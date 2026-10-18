// 玩家角色：創角、能力、裝備、道具、升級配點、聲望、就職、轉職、晉級、學技能。全部是純規則，畫面只呼叫這些。
// 回傳 {ok:false,msg} 表示做不到，畫面直接把 msg 顯示給玩家。
import {derive,BP_KEYS,CREATE_BP,BP_PER_LEVEL,MAX_LEVEL,singleCapAt,expFor,validElement} from './stats.mjs';
import {applyInjury,addInjury,treatCost} from './injury.mjs';
import {JOBS,RANK_LEVEL,RANK_SKILL,RANK_REP,RANK_QUEST,PROMOTE_FEE,CHANGE_FEE,skillCap,gearCap,REP_START,REP_DAILY,REP_POOL_MAX,rankName} from '../data/jobs.mjs';
import {SKILLS,SKILL_EXP,SKILL_SLOTS} from '../data/skills.mjs';
import {ITEMS,SLOTS} from '../data/items.mjs';
import {makeRng} from './rng.mjs';
import {RECIPES,CRAFT_EXP} from '../data/recipes.mjs';
import {QUESTS} from '../data/quests.mjs';
import {OFFICERS,PARTY_MAX} from '../data/officers.mjs';
import {newOfficer,officerStats,officerUnit} from './officer.mjs';
import {newPet,petStats,petUnit,PET_MAX,PET_SLOTS,PET_SKILL_SHOP,petSkills,petLearnLv} from './pet.mjs';

export const BAG_SIZE=20; // 道具欄 20 格（原作）
export const START_GOLD=500; // ◎ 原作開局金額未查證
const no=msg=>({ok:false,msg}),yes=(msg,extra)=>({ok:true,msg,...extra});

export function createPlayer({name,look,bp,elem,seed=Date.now()}){
 name=String(name||'').trim();
 if(!name||name.length>8)return no('名字要 1～8 個字。');
 const total=BP_KEYS.reduce((n,k)=>n+(bp[k]||0),0);
 if(total!==CREATE_BP)return no(`點數要剛好分完 ${CREATE_BP} 點（現在 ${total}）。`);
 if(BP_KEYS.some(k=>(bp[k]||0)<0||(bp[k]||0)>singleCapAt(1)))return no(`單項最多 ${singleCapAt(1)} 點。`);
 if(!validElement(elem))return no('屬性要剛好 10 點，最多兩種，而且要相鄰（地水、水火、火風、風地）。');
 const rng=makeRng(seed);
 const p={v:1,name,look,lv:1,exp:0,freeBp:0,bp:Object.fromEntries(BP_KEYS.map(k=>[k,(bp[k]||0)*100])),elem:{...elem},
  luck:rng.int(1,5),// 運氣是隱藏數值，創角時隨機（◎ 範圍自訂）
  job:'none',rank:0,rep:REP_START,repPool:REP_DAILY,repDay:dayKey(Date.now()),gold:START_GOLD,
  skills:[],bag:[],equip:{weapon:null,head:null,body:null,feet:null},flags:{},place:'luoyang',quiz:null,officers:{},party:[],pets:[],petOut:null,petSeq:0,
  settings:{speed:1,auto:false},lastCmds:null,seed:rng.int(1,2**31)};
 const s=stats(p);p.hp=s.maxHp;p.mp=s.maxMp;
 return yes('',{player:p});
}

// 面板數值＝BP 換算＋裝備
export function stats(p){
 const s=derive(p.bp),o={maxHp:s.hp,maxMp:s.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0};
 for(const slot of SLOTS){const id=p.equip[slot];if(!id)continue;const it=ITEMS[id];
  for(const k of ['atk','def','agi','spr','matk'])o[k]+=it[k]||0;if(it.hp)o.maxHp+=it.hp;if(it.mp)o.maxMp+=it.mp;}
 return o;
}
export const weaponOf=p=>p.equip.weapon?ITEMS[p.equip.weapon]:null;
export const jobTitle=p=>rankName(p.job,p.rank);

// 道具欄：消耗品與魔石可疊放，裝備一件占一格
const stacks=id=>['use','crystal','key','material'].includes(ITEMS[id].kind);
export const countItem=(p,id)=>p.bag.filter(x=>x.id===id).reduce((n,x)=>n+x.n,0);
export function addItem(p,id,n=1){
 if(stacks(id)){const s=p.bag.find(x=>x.id===id);if(s){s.n+=n;return true;}if(p.bag.length>=BAG_SIZE)return false;p.bag.push({id,n});return true;}
 for(let i=0;i<n;i++){if(p.bag.length>=BAG_SIZE)return false;p.bag.push({id,n:1});}return true;
}
export function removeItem(p,id,n=1){
 if(countItem(p,id)<n)return false;
 while(n>0){const i=p.bag.findIndex(x=>x.id===id),s=p.bag[i],k=Math.min(n,s.n);s.n-=k;n-=k;if(!s.n)p.bag.splice(i,1);}
 return true;
}

export function canEquip(p,id){
 const it=ITEMS[id];if(!it?.slot)return no('這不能裝備。');
 const cap=gearCap(p.job,p.rank,it);
 if(!cap)return no(`${JOBS[p.job].name}不能用這種裝備。`);
 if(it.lv>cap)return no(`${jobTitle(p)}只能用 ${cap} 級以下的裝備。`);
 return yes();
}
export function equip(p,id){
 const r=canEquip(p,id);if(!r.ok)return r;if(!removeItem(p,id))return no('身上沒有。');
 const old=p.equip[ITEMS[id].slot];p.equip[ITEMS[id].slot]=id;if(old)addItem(p,old);clampHpMp(p);return yes(`裝備了${ITEMS[id].name}。`);
}
export function unequip(p,slot){
 const id=p.equip[slot];if(!id)return no('');if(p.bag.length>=BAG_SIZE)return no('道具欄滿了。');
 p.equip[slot]=null;addItem(p,id);clampHpMp(p);return yes(`卸下了${ITEMS[id].name}。`);
}
// 轉職後不能用的裝備自動卸下
function dropIllegalGear(p){for(const slot of SLOTS){const id=p.equip[slot];if(id&&!canEquip(p,id).ok){p.equip[slot]=null;addItem(p,id);}}}
export function clampHpMp(p){const s=stats(p);p.hp=Math.min(p.hp,s.maxHp);p.mp=Math.min(p.mp,s.maxMp);}
export function useItemOutside(p,id){
 const it=ITEMS[id];if(it.kind!=='use')return no('這不能使用。');const s=stats(p);
 if(!(it.hp&&p.hp<s.maxHp||it.mp&&p.mp<s.maxMp))return no('不需要使用。');
 removeItem(p,id);if(it.hp)p.hp=Math.min(s.maxHp,p.hp+it.hp);if(it.mp)p.mp=Math.min(s.maxMp,p.mp+it.mp);return yes(`使用了${it.name}。`);
}

// 升級：每級 4 點，自己分配（照原作，不自動加）
export function gainExp(p,n){
 const ups=[];p.exp+=n;
 while(p.lv<MAX_LEVEL&&p.exp>=expFor(p.lv+1)){p.lv++;p.freeBp+=BP_PER_LEVEL;ups.push(p.lv);}
 return ups;
}
export function allocBp(p,key,n=1){
 if(p.freeBp<n)return no('沒有可分配的點數。');
 if(p.bp[key]/100+n>singleCapAt(p.lv))return no(`單項不能超過總點數的一半（${singleCapAt(p.lv)} 點）。`);
 const before=stats(p);p.bp[key]+=n*100;p.freeBp-=n;const after=stats(p);
 p.hp+=Math.max(0,after.maxHp-before.maxHp);p.mp+=Math.max(0,after.maxMp-before.maxMp);return yes();
}

// 聲望：每天最多拿 800，用不完的可以存，最多存 4800（照原作，真實時間）
export const dayKey=t=>{const d=new Date(t);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();};
const daysBetween=(a,b)=>{const f=k=>Date.UTC(Math.floor(k/10000),Math.floor(k/100)%100-1,k%100)/864e5;return Math.round(f(b)-f(a));};
export function tickRep(p,now=Date.now()){const k=dayKey(now),d=daysBetween(p.repDay,k);if(d>0){p.repPool=Math.min(REP_POOL_MAX,p.repPool+REP_DAILY*d);p.repDay=k;}}
export function gainRep(p,n,now=Date.now()){tickRep(p,now);if(p.job==='none')return 0;const g=Math.max(0,Math.min(n,p.repPool));p.rep+=g;p.repPool-=g;return g;}

// 技能
export const skillOf=(p,id)=>p.skills.find(s=>s.id===id);
export const capOf=(p,id)=>skillCap(p.job,p.rank,id);
export function learnSkill(p,id){
 const sk=SKILLS[id];
 if(p.job==='none'&&!capOf(p,id))return no('遊民還不能學這個，先去就職吧。');
 if(skillOf(p,id))return no('已經學會了。');
 if(p.skills.length>=SKILL_SLOTS)return no(`技能欄只有 ${SKILL_SLOTS} 格。`);
 if(!capOf(p,id))return no(`${JOBS[p.job].name}學不了這招。`);
 if(p.gold<sk.price)return no('錢不夠。');
 p.gold-=sk.price;p.skills.push({id,lv:1,exp:0});return yes(`學會了${sk.name}。`);
}
export function forgetSkill(p,id){const i=p.skills.findIndex(s=>s.id===id);if(i<0)return no('');p.skills.splice(i,1);return yes(`忘記了${SKILLS[id].name}。`);}
// 技能經驗：到上限就不再增加
export function addSkillExp(p,id,n){
 const s=skillOf(p,id);if(!s)return null;const cap=capOf(p,id);
 if(s.lv>=cap)return null;s.exp+=n;let up=null;
 while(s.lv<Math.min(cap,10)&&s.exp>=SKILL_EXP[s.lv]){s.lv++;up=s.lv;}
 if(s.lv>=cap)s.exp=Math.min(s.exp,SKILL_EXP[s.lv-1]);
 return up;
}

// 就職流程（照原作的試煉洞窟）：醫館買止痛藥 → 交給職業公會換通行證 → 試煉洞窟 6 樓拿對應武器的推薦信 → 找導師就職
export function givePainkiller(p){
 if(countItem(p,'trialPass'))return no('你已經有通行證了。');
 if(!removeItem(p,'painkiller'))return no('「我的傷口痛得要命……要是有止痛藥就好了。醫館有賣。」');
 addItem(p,'trialPass');return yes('「謝謝！這張試煉洞窟的通行證就送你吧。」');
}
const LETTER_OF={sword:'letterSword',axe:'letterAxe',spear:'letterSpear',bow:'letterBow',staff:'letterStaff'};
export function askLetter(p){
 const w=weaponOf(p);if(!w)return no('「想就職的話，把你想學的那種武器拿在手上再來找我。」');
 const id=LETTER_OF[w.type];if(countItem(p,id))return no('「推薦信已經給你了。」');
 if(!addItem(p,id))return no('道具欄滿了。');return yes(`「你很適合用${w.name}。拿著這封信去找導師吧。」得到${ITEMS[id].name}。`);
}
// 道士（原作傳教士）不用推薦信，要答對于吉的問題
export const QUIZ=[
 ['張角傳的道叫什麼？',['太平道','五斗米道','全真道'],0],
 ['于吉在哪裡傳道？',['江東','西涼','益州'],0],
 ['道士治病常用什麼？',['符水','火藥','毒蛇'],0],
];
export function answerQuiz(p,answers){
 if(answers.length!==QUIZ.length||answers.some((a,i)=>a!==QUIZ[i][2]))return no('「心不誠，下次再來。」');
 p.flags.quizPassed=true;return yes('「很好，你可以入我道門。」');
}
export function canTakeJob(p,jobId){
 const j=JOBS[jobId];
 if(p.job===jobId)return no('你已經是這個職業了。');
 if(j.gather){}
 else if(j.quiz){if(!p.flags.quizPassed)return no('「先回答我的問題。」');}
 else if(!countItem(p,j.letter))return no(`「拿${ITEMS[j.letter].name}來，我才收你。」`);
 if(p.job!=='none'&&p.gold<CHANGE_FEE)return no(`轉職要 ${CHANGE_FEE} 金。`);
 return yes();
}
// 遊民就職免費；從別的職業換過來就是轉職：付錢、聲望歸零、從見習重來、超過新上限的技能降級（照原作）
export function takeJob(p,jobId){
 const r=canTakeJob(p,jobId);if(!r.ok)return r;const j=JOBS[jobId],change=p.job!=='none';
 if(j.letter)removeItem(p,j.letter);else if(j.quiz)delete p.flags.quizPassed;
 if(change){p.gold-=CHANGE_FEE;p.rep=0;}
 p.job=jobId;p.rank=0;
 const down=[];for(const s of p.skills){const c=capOf(p,s.id);if(s.lv>c){s.lv=Math.max(1,c);s.exp=SKILL_EXP[s.lv-1];down.push(SKILLS[s.id].name);}}
 dropIllegalGear(p);
 return yes(`${change?'轉職':'就職'}成為${jobTitle(p)}！`+(down.length?`（${down.join('、')}降到新職業的上限）`:'')+(change?'聲望歸零。':''));
}
// 回到遊民：失去所有技能（照原作）
export function quitJob(p){if(p.job==='none')return no('');p.job='none';p.rank=0;p.skills=[];dropIllegalGear(p);return yes('你回到了遊民身份，所有技能都忘了。');}

// 晉級：等級（或專職技能等級）、聲望、晉級任務三項都要達到，再付錢
export function promoteCheck(p){
 const j=JOBS[p.job];if(p.job==='none')return {ok:false,rows:[],msg:'遊民不能晉級。'};
 const to=p.rank+1;if(to>4)return {ok:false,rows:[],msg:'已經是最高職階了。'};
 const rows=[];
 if(j.promoteBy==='level')rows.push([`等級 ${RANK_LEVEL[to]}`,p.lv>=RANK_LEVEL[to],`現在 ${p.lv}`]);
 else{const s=skillOf(p,j.promoteBy);rows.push([`${SKILLS[j.promoteBy].name} ${RANK_SKILL[to]} 級`,(s?.lv||0)>=RANK_SKILL[to],`現在 ${s?.lv||0}`]);}
 rows.push([`聲望 ${RANK_REP[to]}`,p.rep>=RANK_REP[to],`現在 ${p.rep}`]);
 const q=RANK_QUEST[to];if(!j.gather)rows.push([QUEST_NAMES[q],!!p.flags[q],p.flags[q]?'已完成':'未完成']);
 rows.push([`${PROMOTE_FEE[to]} 金`,p.gold>=PROMOTE_FEE[to],`現在 ${p.gold}`]);
 return {ok:rows.every(r=>r[1]),rows,to,name:rankName(p.job,to)};
}
export const QUEST_NAMES={treant:'晉級任務「長老樹精的末日」',beast:'晉級任務「咆哮的神獸」',curse:'晉級任務「詛咒的迷宮」（之後開放）',oath:'晉級任務「誓言之花」（之後開放）'};
export function promote(p){
 const c=promoteCheck(p);if(!c.ok)return no(c.msg||'條件還沒達到。');
 p.gold-=PROMOTE_FEE[c.to];p.rank=c.to;return yes(`晉級為${c.name}！技能和裝備的上限提高了。`);
}

// 醫館：補滿生命魔力（◎ 收費＝少掉的生命＋魔力 ÷ 10）
export function restCost(p){const s=stats(p);let n=s.maxHp-p.hp+s.maxMp-p.mp;
 for(const o of partyOf(p)){const t=officerStats(o.id,o.lv);n+=t.maxHp-o.hp+t.maxMp-o.mp;}
 for(const x of p.pets||[]){const t=petStats(x);n+=t.maxHp-x.hp+t.maxMp-x.mp;}return Math.ceil(n/10);}
export function rest(p){const c=restCost(p);if(!c)return no('大家都很健康。');if(p.gold<c)return no('錢不夠。');p.gold-=c;const s=stats(p);p.hp=s.maxHp;p.mp=s.maxMp;
 for(const o of partyOf(p)){const t=officerStats(o.id,o.lv);o.hp=t.maxHp;o.mp=t.maxMp;}
 for(const x of p.pets||[]){const t=petStats(x);x.hp=t.maxHp;x.mp=t.maxMp;}return yes('傷都治好了。');}

// 武將：在酒館招募、離隊。離隊的武將留在酒館，等級不會掉。
export const partyOf=p=>(p.party||[]).map(id=>p.officers[id]);
export function canRecruit(p,id){
 const d=OFFICERS[id];if(p.party.includes(id))return no('已經在隊伍裡了。');
 if(p.party.length>=PARTY_MAX)return no(`隊伍最多 ${PARTY_MAX+1} 人。`);
 if(d.need==='job'&&p.job==='none')return no('「等你就職了再來找我吧。」');
 if(!p.officers[id]&&p.gold<d.fee)return no(`要 ${d.fee} 金。`);
 return yes();
}
export function recruit(p,id){
 const r=canRecruit(p,id);if(!r.ok)return r;const d=OFFICERS[id];
 if(!p.officers[id]){p.gold-=d.fee;p.officers[id]=newOfficer(id,Math.max(1,p.lv-1));}
 p.party.push(id);return yes(`${d.name}加入了隊伍。`);
}
export function dismiss(p,id){const i=p.party.indexOf(id);if(i<0)return no('');p.party.splice(i,1);return yes(`${OFFICERS[id].name}留在酒館等你。`);}
// 站位：近身的站前排，其他站後排；主角在後排正中間
// 主角可以選站前排或後排（原作可調站位，預設後排），寵物站主角的另一排同位置
export function partyUnits(p){
 const pet=petOutOf(p),me=battleUnit(p),pool={front:[0,1,2,3,4],back:[0,1,2,3,4]},take=(row,s)=>pool[row]=pool[row].filter(x=>x!==s);
 take(me.row,0);const pu=pet?{...petUnit(pet),row:me.row==='back'?'front':'back',slot:0}:null;if(pu)take(pu.row,0);
 // 武將照原作的玩家隊友站法：跟主角同一排、排在兩側（主角在中間），寵物站另一排
 const os=partyOf(p).map(o=>{let row=me.row;if(!pool[row].length)row=row==='front'?'back':'front';const s=pool[row].shift();return {...officerUnit(o,s),row};});
 return [applyInjury(me,p.inj),...(pu?[applyInjury(pu,pet.inj)]:[]),...os.map(u=>applyInjury(u,p.officers[u.oid].inj))];
}
// 寵物
export const petOutOf=p=>(p.pets||[]).find(x=>x.uid===p.petOut)||null;
export function addPet(p,mon,lv,rng){if(p.pets.length>=PET_MAX)return null;const pet=newPet(mon,lv,rng,'pet'+(++p.petSeq));p.pets.push(pet);if(!p.petOut)p.petOut=pet.uid;return pet;}
export function setPetOut(p,uid){p.petOut=p.petOut===uid?null:uid;return yes(p.petOut?`${petOutOf(p).name}出戰。`:'寵物休息。');}
export function releasePet(p,uid){const i=p.pets.findIndex(x=>x.uid===uid);if(i<0)return no('');const [x]=p.pets.splice(i,1);if(p.petOut===uid)p.petOut=null;return yes(`放生了${x.name}。`);}
export const petRoom=p=>PET_MAX-(p.pets||[]).length;
export function petLearn(p,uid,id){
 const x=p.pets.find(q=>q.uid===uid);if(!x)return no('');const have=petSkills(x);
 if(have.some(s=>s.id===id))return no(`${x.name}已經會了。`);
 if(have.length>=PET_SLOTS)return no(`${x.name}的技能欄滿了（${PET_SLOTS} 格），先忘掉一個。`);
 const price=PET_SKILL_SHOP[id];if(p.gold<price)return no('錢不夠。');
 p.gold-=price;(x.learned||=[]).push({id,lv:petLearnLv(x)});return yes(`${x.name}學會了${SKILLS[id].name} Lv${petLearnLv(x)}。`);
}
export function petForget(p,uid,id){const x=p.pets.find(q=>q.uid===uid),i=x?.learned?.findIndex(s=>s.id===id);if(i==null||i<0)return no('天生的技能忘不掉。');x.learned.splice(i,1);return yes(`${x.name}忘記了${SKILLS[id].name}。`);}
// 戰鬥結束把武將的生命魔力寫回去（氣絕的剩 1）
export function syncParty(p,units){for(const u of units){const o=u.kind==='officer'?p.officers[u.oid]:u.kind==='pet'?p.pets.find(x=>x.uid===u.pid):null;if(o){o.hp=Math.max(1,u.hp);o.mp=u.mp;}}}
// 戰後受傷：這場被打倒過的人（主角、武將、寵物）加受傷程度；回傳 [[名字, 受傷程度]]
export function injureParty(p,units,rand=Math.random){const out=[];for(const u of units){if(!u.downs)continue;const o=u.kind==='player'?p:u.kind==='officer'?p.officers[u.oid]:u.kind==='pet'?p.pets.find(x=>x.uid===u.pid):null;if(o)out.push([u.name,addInjury(o,u.downs,rand)]);}return out;}
// 醫館治傷：整隊（含在酒館休息的武將、所有寵物）一起治
const injured=p=>[{o:p,lv:p.lv},...Object.values(p.officers||{}).map(o=>({o,lv:o.lv})),...(p.pets||[]).map(o=>({o,lv:o.lv}))].filter(x=>x.o.inj>0);
export const treatAllCost=p=>injured(p).reduce((n,x)=>n+treatCost(x.o.inj,x.lv),0);
export function treatAll(p){const c=treatAllCost(p);if(!c)return no('沒有人受傷。');if(p.gold<c)return no('錢不夠。');p.gold-=c;for(const x of injured(p))x.o.inj=0;return yes('傷都治好了，可以照常出戰。');}

// 戰鬥用的我方單位
export function battleUnit(p){
 const s=stats(p),w=weaponOf(p);
 return {uid:'p',kind:'player',name:p.name,art:p.look,h:92,lv:p.lv,race:'human',elem:p.elem,luck:p.luck,
  maxHp:s.maxHp,hp:p.hp,maxMp:s.maxMp,mp:p.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:s.matk,
  weaponType:w?.type||null,ranged:!!w?.ranged,skills:p.skills.filter(s=>!['gather','craft'].includes(SKILLS[s.id].kind)).map(s=>({id:s.id,lv:s.lv})),row:p.settings?.row||'back',slot:0};
}

// 採集（原作伐木、挖掘、狩獵）：每次耗 1 魔力，成功就拿到這個地方有的、技能等級夠的材料。
// ◎ 成功率 60%＋每級 4%；技能經驗每次 100×材料階級；採集系每次成功得 5 聲望。
export function gather(p,table,skillId,rand=Math.random){
 const s=skillOf(p,skillId),sk=SKILLS[skillId];if(!s)return no('還沒學會這個技能。');
 const list=(table?.[skillId]||[]).filter(id=>ITEMS[id].tier<=s.lv);
 if(!list.length)return no(`這裡沒有能${sk.name}的東西。`);
 if(p.mp<sk.mp(s.lv))return no('魔力不夠，沒力氣了。');
 p.mp-=sk.mp(s.lv);
 if(rand()*100>=60+4*s.lv)return yes('什麼都沒採到。',{item:null});
 const id=list[Math.floor(rand()*list.length)];
 if(!addItem(p,id))return no('道具欄滿了。');
 const up=addSkillExp(p,skillId,100*ITEMS[id].tier);
 if(JOBS[p.job].gather)gainRep(p,5);
 return yes(`得到${ITEMS[id].name}。`+(up?`${sk.name}升到 ${up} 級！`:''),{item:id,up});
}

// 製造：材料夠、技能等級 ≥ 裝備等級、魔力夠就做得出來（照原作必定成功；◎ 耗魔、經驗、聲望 20 自訂）
export function canCraft(p,id){
 const r=RECIPES[id],s=skillOf(p,r.skill);
 if(!s)return no(`要先學會${SKILLS[r.skill].name}。`);
 if(s.lv<r.lv)return no(`${SKILLS[r.skill].name}要 ${r.lv} 級。`);
 const lack=r.mats.filter(([m,n])=>countItem(p,m)<n);if(lack.length)return no(`材料不夠：${lack.map(([m,n])=>`${ITEMS[m].name}${countItem(p,m)}/${n}`).join('、')}。`);
 if(p.mp<r.mp)return no(`魔力不夠（要 ${r.mp}）。`);
 return yes();
}
export function craft(p,id){
 const c=canCraft(p,id);if(!c.ok)return c;const r=RECIPES[id];
 const bagAfter=p.bag.length-r.mats.filter(([m,n])=>countItem(p,m)===n).length;if(!(stacks(id)&&countItem(p,id))&&bagAfter>=BAG_SIZE)return no('道具欄滿了。');
 for(const [m,n] of r.mats)removeItem(p,m,n);p.mp-=r.mp;addItem(p,id);
 const up=addSkillExp(p,r.skill,CRAFT_EXP(r.lv));if(JOBS[p.job].craft)gainRep(p,20);
 return yes(`做出了${ITEMS[id].name}！`+(up?`${SKILLS[r.skill].name}升到 ${up} 級！`:''),{up});
}

// 支線任務：p.quests[id]={state:'active'|'done',kills}
export const questOf=(p,id)=>(p.quests||={})[id]||null;
export function questProgress(p,id){const q=QUESTS[id],s=questOf(p,id);return q.need.item?countItem(p,q.need.item):(s?.kills||0);}
export function acceptQuest(p,id){const q=QUESTS[id];if(questOf(p,id))return no('');if(p.lv<q.minLv)return no(`要 ${q.minLv} 級才能接。`);p.quests[id]={state:'active',kills:0};return yes(`接下了「${q.name}」。`);}
export function questKills(p,mons){const got=[];for(const [id,q] of Object.entries(QUESTS)){const s=questOf(p,id);if(s?.state!=='active'||!q.need.kill)continue;const before=s.kills;s.kills=Math.min(q.need.n,s.kills+mons.filter(m=>m===q.need.kill).length);if(s.kills>=q.need.n&&before<q.need.n)got.push(q.name);}return got;}
export function finishQuest(p,id){
 const q=QUESTS[id],s=questOf(p,id);if(s?.state!=='active')return no('');
 if(questProgress(p,id)<q.need.n)return no('還沒完成。');
 const r=q.reward;if(r.item&&p.bag.length>=BAG_SIZE&&!countItem(p,r.item[0]))return no('道具欄滿了。');
 if(q.need.item)removeItem(p,q.need.item,q.need.n);
 s.state='done';p.gold+=r.gold||0;const ups=gainExp(p,r.exp||0);if(r.item)addItem(p,r.item[0],r.item[1]);
 return yes(`任務完成！得到 ${r.gold} 金、經驗 ${r.exp}`+(r.item?`、${ITEMS[r.item[0]].name}×${r.item[1]}`:'')+(ups.length?`。升到 ${p.lv} 級！`:'。'));
}
