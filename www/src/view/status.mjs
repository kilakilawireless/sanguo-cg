// 狀態視窗：能力與配點、裝備、道具、技能、聲望。
import {h,modal,toast,bar,ask,injTag,choose} from './ui.mjs';
import {injuryOf} from '../core/injury.mjs';
import {G,save,repTitle} from '../game.mjs';
import {FIST_ATK,careTargets,useFieldSkill,stats,allocBp,jobTitle,equip,unequip,useItemOutside,canEquip,capOf,forgetSkill,BAG_SIZE,weaponOf,removeItem} from '../core/player.mjs';
import {BP_KEYS,BP_NAMES,STAT_NAMES,ELEMS,ELEM_NAMES,singleCapAt,expFor} from '../core/stats.mjs';
import {ITEMS,SLOTS,SLOT_NAMES,WEAPON_TYPE_NAMES} from '../data/items.mjs';
// 盾、飾品只有文字版做得出來：主遊戲沒有這類道具時不列空格（第 67 輪）
const HAS_SLOT=new Set(Object.values(ITEMS).map(it=>it.slot).filter(Boolean));
import {SKILLS,SKILL_EXP,SKILL_SLOTS,weaponOk} from '../data/skills.mjs';
import {JOBS,gearCap} from '../data/jobs.mjs';
import {OFFICERS} from '../data/officers.mjs';
import {officerStats,officerUnit} from '../core/officer.mjs';
import {partyOf,setPetOut,releasePet} from '../core/player.mjs';
import {petStats,gradeSum,PET_MAX,petSkills,petLearnLv} from '../core/pet.mjs';
import {MONSTERS} from '../data/monsters.mjs';
import {QUESTS,QUEST_ORDER} from '../data/quests.mjs';
import {PLACES} from '../data/places.mjs';
import {questOf,questProgress,promoteCheck} from '../core/player.mjs';

export function itemLine(id){const it=ITEMS[id],b=[];
 if(it.slot){b.push(`${it.lv}級`);if(it.type)b.push(WEAPON_TYPE_NAMES[it.type]);if(it.armor)b.push({heavy:'鎧',light:'衣',robe:'袍'}[it.armor]);
  for(const k of ['atk','def','agi','spr','matk'])if(it[k])b.push(`${{atk:'攻',def:'防',agi:'敏',spr:'精',matk:'魔攻'}[k]}${it[k]>0?'+':''}${it[k]}`);if(it.ranged)b.push('遠距');}
 else if(it.desc)b.push(it.desc);
 return b.join(' ');}

// 收材料的委託寫哪裡採得到（第一個有這種材料的地方＋要哪種採集技能；第 89 輪）
function whereGather(id){for(const pl of Object.values(PLACES))for(const [sk,l] of Object.entries(pl.gather||{}))if(l.includes(id))return `　${pl.name}用${SKILLS[sk]?.name||sk}採得到`;return '';}

// 跟身上那件比：武器看攻擊、防具看防禦（第 95 輪：之前要自己記身上穿什麼）
export function vsWorn(p,id){const it=ITEMS[id],cur=it.slot&&p.equip[it.slot];if(!it.slot)return null;
 if(!cur)return h('span',{class:'green'},'　這格空著');if(cur===id)return '　穿著中';
 // 每項能力都比（袍子加精神、鞋子加敏捷，只比防禦看不出來；第 120 輪）
 const N={atk:'攻',def:'防',agi:'敏',spr:'精',matk:'魔攻'},k=it.slot==='weapon'?'atk':'def',ds=Object.keys(N).map(x=>[x,(it[x]||0)-(ITEMS[cur][x]||0)]).filter(([x,d])=>d||x===k);
 return h('span',{},'　比身上',...ds.map(([x,d])=>h('span',{class:d>0?'green':d<0?'red':''},`${N[x]}${d>0?'+':''}${d} `)));}
// 配點預覽：這項 +1 點後能力會多多少（第 123 輪）
const plusOne=(p,s,k)=>{const q=structuredClone(p);if(!allocBp(q,k,1).ok)return '';const t=stats(q);
 return ['maxHp','maxMp','atk','def','agi','spr','rec'].map(x=>[x,t[x]-s[x]]).filter(([,d])=>d).map(([x,d])=>`${STAT_NAMES[x==='maxHp'?'hp':x==='maxMp'?'mp':x]}${d>0?'+':''}${d}`).join(' ');};
// 寵物、傭兵的經驗條：這一級走到哪、還差多少（第 116 輪）
const expRow=x=>{const a=expFor(x.lv),z=expFor(x.lv+1);return h('div',{class:'row small'},'經驗 ',bar(x.exp-a,z-a,'#d6a84a'),h('span',{class:'muted'},` 還差 ${Math.max(0,z-x.exp)} 升 Lv${x.lv+1}`));};
export function openStatus(tab='stat',onChange){
 let cur=tab;
 const m=modal('狀態',(refresh)=>{
  const p=G.p,s=stats(p),done=()=>{save();refresh();onChange?.();};
  const tabs=h('div',{class:'tabs'},...[['stat','能力'],['equip','裝備'],['bag','道具'],['skill','技能'],['pet','寵物'],['party','隊伍']].map(([k,n])=>h('button',{class:cur===k?'on':'',onclick:()=>{cur=k;refresh();}},n)));
  let body;
  if(cur==='stat'){
   const cap=singleCapAt(p.lv);
   // 裝備加了多少：脫光算一次相減（第 121 輪）
   const bare=stats({...p,equip:{}}),gearAdd=Object.fromEntries(['atk','def','agi','spr','rec'].map(k=>[k,s[k]-bare[k]]));
   body=h('div',{class:'col'},
    h('div',{},h('b',{class:'gold'},p.name),` Lv${p.lv}　${jobTitle(p)}　稱號「${repTitle(p)}」`),
    injuryOf(p.inj)?h('div',{class:'small'},injTag(p.inj),` 受傷程度 ${p.inj}：戰鬥時攻擊、防禦、敏捷、精神、回復 −${Math.round(injuryOf(p.inj).down*100)}%，到醫院治傷。`):null,
    expRow(p),h('div',{class:'small muted'},`聲望 ${p.job==='none'?'（遊民不累積）':p.rep}`), // 主角經驗也畫成條（第 118 輪）
    // 晉級還差什麼（第 147 輪）
    (c=>c.rows.length?h('div',{class:'small'+(c.ok?' green':'')},c.ok?`晉級條件都達到了，回城找師傅晉級為${c.name}。`:`晉級為${c.name}還差：`+c.rows.filter(r=>!r[1]).map(([n,,now])=>`${n}（${now}）`).join('、')):null)(promoteCheck(p)),
    h('div',{class:'small'},'屬性：',ELEMS.filter(k=>p.elem[k]).map(k=>`${ELEM_NAMES[k]}${p.elem[k]}`).join(' ')),
    h('div',{},p.freeBp?h('span',{class:'green'},`可分配 ${p.freeBp} 點（單項上限 ${cap}）`):h('span',{class:'muted small'},`升級得 4 點自己分配，單項上限 ${cap}`)),
    ...BP_KEYS.map(k=>h('div',{class:'bp-row'},h('span',{},BP_NAMES[k]),h('b',{},p.bp[k]/100),h('span',{class:'small muted'},p.freeBp?plusOne(p,s,k):''),
      h('button',{disabled:!p.freeBp,onclick:()=>{const r=allocBp(p,k,1);if(!r.ok)toast(r.msg);done();}},'+1'),
      // 「全」直接寫會加幾點（加到這項上限或點數用完；第 122 輪）
      (n=>h('button',{disabled:p.freeBp<4||n<=0,onclick:()=>{const r=allocBp(p,k,n);if(!r.ok)toast(r.msg);done();}},n>1&&p.freeBp>=4?`全 +${n}`:'全'))(Math.min(p.freeBp,cap-p.bp[k]/100)))),
    h('table',{class:'stat'},...[['hp',`${p.hp}/${s.maxHp}`],['mp',`${p.mp}/${s.maxMp}`],['atk',!p.equip.weapon&&p.job==='fighter'?`${s.atk+FIST_ATK(p.lv)}（空手）`:s.atk],['def',s.def],['agi',s.agi],['spr',s.spr],['rec',s.rec]].map(([k,v])=>h('tr',{},h('td',{},STAT_NAMES[k]),h('td',{},v,gearAdd[k]?h('span',{class:'small muted'},`（裝備 ${gearAdd[k]>0?'+':''}${gearAdd[k]}）`):null))),
     s.matk?h('tr',{},h('td',{},'魔攻'),h('td',{},s.matk)):null),
    // 接了的委託在外面也看得到進度（第 87 輪）
    ...QUEST_ORDER.filter(id=>questOf(p,id)?.state==='active').map((id,i)=>{const q=QUESTS[id],n=Math.min(q.need.n,questProgress(p,id)),ok=n>=q.need.n;
     return h('div',{class:'small'},i?'':h('b',{},'委託　'),`${q.name}：${q.need.item?ITEMS[q.need.item].name:MONSTERS[q.need.kill]?.name||q.need.kill} ${n}/${q.need.n}`,
      h('span',{class:ok?'green':'muted'},ok?`　回${PLACES[q.town]?.name||''}找${q.giver}回報`:q.need.item?whereGather(q.need.item):''));}));
  }else if(cur==='equip'){
   body=h('div',{class:'col'},...SLOTS.filter(sl=>p.equip[sl]||HAS_SLOT.has(sl)).map(sl=>{const id=p.equip[sl];return h('div',{class:'row'},h('span',{style:{width:'3em'}},SLOT_NAMES[sl]),h('span',{class:'grow'},id?ITEMS[id].name:h('span',{class:'muted'},'（無）'),id?h('div',{class:'small muted'},itemLine(id)):null),
     id?h('button',{onclick:()=>{const r=unequip(p,sl);toast(r.msg);done();}},'卸下'):null);}),
    h('div',{class:'small muted'},`${JOBS[p.job].name}能用：${p.job==='none'?'所有 1 級裝備':Object.keys(WEAPON_TYPE_NAMES).map(w=>[w,gearCap(p.job,p.rank,{slot:'weapon',type:w})]).filter(x=>x[1]>0).map(([w,c])=>`${WEAPON_TYPE_NAMES[w]}（到 ${c} 級）`).join('、')||'空手'}`),
    ...p.bag.filter(x=>ITEMS[x.id].slot).map(x=>{const ok=canEquip(p,x.id);return h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,h('div',{class:'small muted'},itemLine(x.id),ok.ok?vsWorn(p,x.id):`（${ok.msg}）`)),h('button',{disabled:!ok.ok,onclick:()=>{const r=equip(p,x.id);toast(r.msg);done();}},'裝備'));}));
  }else if(cur==='bag'){
   // 「整理」照種類排：藥、魔石、材料、武器、防具、重要道具，同種照道具表順序（第 130 輪）
   const ORD=['use','crystal','material','weapon','armor','key'],IDX=Object.keys(ITEMS),rank=x=>{const k=ORD.indexOf(ITEMS[x.id].kind);return (k<0?9:k)*1e4+IDX.indexOf(x.id);};
   body=h('div',{class:'col'},h('div',{class:'row'},h('span',{class:'small muted grow'},`道具欄 ${p.bag.length}/${BAG_SIZE}`),p.bag.length>1?h('button',{class:'small',onclick:()=>{p.bag.sort((a,b)=>rank(a)-rank(b));toast('照種類排好了。');done();}},'整理'):null),
    ...p.bag.map(x=>h('div',{class:'row'},h('span',{class:'grow'},ITEMS[x.id].name,x.n>1?` ×${x.n}`:'',h('div',{class:'small muted'},itemLine(x.id))),
     ITEMS[x.id].kind==='use'?h('button',{onclick:()=>{const r=useItemOutside(p,x.id);toast(r.msg);done();}},'使用'):null,
     // 道具欄滿了在野外也能騰位置（重要道具不能丟；第 84 輪）
     ITEMS[x.id].kind!=='key'?h('button',{class:'small',onclick:async()=>{if(await ask(`丟掉${ITEMS[x.id].name}${x.n>1?`（${x.n} 個）`:''}？丟了就找不回來，回城賣給商店比較划算。`,'丟掉')){removeItem(p,x.id,x.n);done();}}},'丟'):null)));
  }else if(cur==='pet'){
   const RACE={human:'人形',beast:'野獸',plant:'植物',undead:'不死',dragon:'龍',flying:'飛行',insect:'昆蟲',special:'特殊',metal:'金屬',demon:'邪魔'};
   body=h('div',{class:'col'},h('div',{class:'small muted'},`寵物 ${p.pets.length}/${PET_MAX}。戰鬥中用「捕捉」抓怪物，血越少越好抓。帶寵物出戰時，你每回合行動一次，寵物也行動一次。`),
    ...p.pets.map(x=>{const t=petStats(x),out=p.petOut===x.uid,m=MONSTERS[x.mon];return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'gold grow'},`${x.name} Lv${x.lv}`,injTag(x.inj)),h('span',{class:'small muted'},`${RACE[m.race]}　檔次合計 ${gradeSum(x)}`),
      h('button',{class:out?'on':'',onclick:()=>{setPetOut(p,x.uid);done();}},out?'出戰中':'出戰'),
      h('button',{class:'small',onclick:async()=>{if(await ask(`放生${x.name}？放生後就找不回來了。`,'放生')){releasePet(p,x.uid);done();}}},'放生')),
     h('div',{class:'row small wrap'},h('span',{class:'nw'},'生命 ',bar(x.hp,t.maxHp,'#c8463a'),` ${x.hp}/${t.maxHp}`),h('span',{class:'nw'},'魔力 ',bar(x.mp,t.maxMp,'#4f9ee8'),` ${x.mp}/${t.maxMp}`)),
     expRow(x),
     h('div',{class:'small muted'},`攻擊 ${t.atk}　防禦 ${t.def}　敏捷 ${t.agi}　精神 ${t.spr}　回復 ${t.rec}`),
     petSkills(x).length?h('div',{class:'small'},'技能：',petSkills(x).map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、'),
      // 學來的技能可以到寵物小屋升級（第 140 輪）
      (x.learned||[]).some(s=>s.lv<petLearnLv(x))?h('span',{class:'gold'},`　寵物小屋可以升到 Lv${petLearnLv(x)}`):null):null);}));
  }else if(cur==='party'){
   const list=partyOf(p);
   const row=p.settings.row||'back';
   body=h('div',{class:'col'},h('div',{class:'row'},h('span',{class:'grow'},`你的站位：${row==='front'?'前排':'後排'}`),
     h('button',{onclick:()=>{p.settings.row=row==='front'?'back':'front';done();}},row==='front'?'改站後排':'改站前排')),
    h('div',{class:'small muted'},'寵物會站在你另一排的同一個位置。強力魔法打十字範圍，站位會影響誰被波及。'),
    list.length?null:h('div',{class:'muted'},'還沒有傭兵同行。到法蘭城的酒吧招募吧。'),
    ...list.map(o=>{const d=OFFICERS[o.id],t=officerStats(o.id,o.lv);return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'gold grow'},`${d.name} Lv${o.lv}`,injTag(o.inj)),h('span',{class:'small'},`見習${JOBS[d.job].name}`)),
     h('div',{class:'row small wrap'},h('span',{class:'nw'},'生命 ',bar(o.hp,t.maxHp,'#c8463a'),` ${o.hp}/${t.maxHp}`),h('span',{class:'nw'},'魔力 ',bar(o.mp,t.maxMp,'#4f9ee8'),` ${o.mp}/${t.maxMp}`)),
     expRow(o),
     h('div',{class:'small muted'},`攻擊 ${t.atk}　防禦 ${t.def}　敏捷 ${t.agi}　精神 ${t.spr}　回復 ${t.rec}${t.matk?`　魔攻 ${t.matk}`:''}`),
     h('div',{class:'small'},'技能：',officerUnit(o,0).skills.map(s=>`${SKILLS[s.id].name} Lv${s.lv}`).join('、'),
      // 之後幾級會學新招（第 133 輪）
      (d.later||[]).filter(([,lv])=>o.lv<lv).map(([id,lv])=>h('span',{class:'muted'},`　Lv${lv} 學會${SKILLS[id].name}`))));}));
  }else{
   body=h('div',{class:'col'},h('div',{class:'small muted'},`技能欄 ${p.skills.length}/${SKILL_SLOTS}。技能在戰鬥中使用會累積經驗，到職階上限就不再成長。`),
    ...p.skills.map(sk=>{const d=SKILLS[sk.id],cap=capOf(p,sk.id),next=SKILL_EXP[sk.lv],use=Math.max(1,Math.min(sk.lv,cap));return h('div',{class:'panel col'},
     h('div',{class:'row'},h('b',{class:'grow gold'},`${d.name} Lv${sk.lv}`),h('span',{class:'small muted'},`上限 ${cap}　耗魔 ${d.mp(use)}`+(cap&&d.mp(use)>0&&!['craft','gather'].includes(d.kind)?`（現在夠放 ${Math.floor(p.mp/d.mp(use))} 次）`:''))), // 魔力夠放幾次（第 124 輪）
     sk.lv>cap?h('div',{class:'small red'},cap?`現在的職業只能用到 Lv${cap}（等級沒掉）`:'現在的職業用不了（等級沒掉）'):null, // 轉職不降級（Leo 2026-10-29），戰鬥時壓到上限
     cap&&!weaponOk({weaponType:weaponOf(p)?.type},sk.id)?h('div',{class:'small red'},`手上的武器用不了，要拿${d.weapons.map(w=>WEAPON_TYPE_NAMES[w]||'空手').join('、')}`):null, // 換武器後看得出哪些招不能放（第 83 輪）
     h('div',{class:'small'},d.desc(use)),
     h('div',{class:'row small'},sk.lv<cap&&next?['經驗 ',bar(sk.exp,next,'#d6a84a'),` ${sk.exp}/${next}`]:h('span',{class:'muted'},'已達上限'),h('span',{class:'grow'}),
      d.kind==='field'?h('button',{class:'small',disabled:p.mp<d.mp(sk.lv),onclick:async()=>{const ref=await choose(`${d.name}・對誰用`,careTargets(p).map(x=>({label:x.name,value:x.ref,note:`生命 ${x.o.hp}/${x.max}${x.o.inj?`　受傷 ${x.o.inj}`:''}`})));if(!ref)return;const r=useFieldSkill(p,sk.id,ref);toast(r.msg);done();}},'使用'):null,
      h('button',{class:'small',onclick:async()=>{if(await ask(`忘記${d.name}後，技能經驗會全部消失。`,'忘記')){forgetSkill(p,sk.id);done();}}},'忘記')));}));
  }
  return h('div',{class:'col'},tabs,body);
 },{onClose:onChange});
 return m;
}
