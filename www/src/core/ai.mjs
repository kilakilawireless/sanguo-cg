// 敵方行動：照設定機率放招（魔力夠才放），不然普攻隨機一名我方。
// 遺忘中不放招；異常狀態魔法只對還沒中異常的人放，全員都中了就不浪費魔力。
import {SKILLS,weaponOk,mpCost} from '../data/skills.mjs';
export function chooseEnemyAction(b,u,rng){
 if(u.st?.k!=='forget')for(const s of u.skills||[]){
  if(!rng.chance(s.pct)||u.mp<mpCost(u,s.id,s.lv))continue;
  if(SKILLS[s.id].kind==='status'){const t=b.units.filter(x=>x.side!==u.side&&x.alive&&!x.st);if(!t.length)continue;return {kind:'skill',skill:s.id,target:t[Math.floor(rng.next()*t.length)].uid};}
  return {kind:'skill',skill:s.id,target:null};
 }
 return {kind:'attack',target:null};
}

// 傭兵：有補血的先救人（生命不到一半的隊友），有氣絕回復的先復活，魔術師放魔法，其他偶爾用招、平常普攻。
// 遺忘中只能普攻；會潔淨魔法的先解隊友的昏睡、石化、混亂，還有會用技能的隊友的遺忘。
const ELEM_BEATS={earth:'water',water:'fire',fire:'wind',wind:'earth'};
// 王（u.boss）挑目標像人（Leo 2026-10-28）：先打會補血的，沒有就打血比例最少的；近戰照「前排還在就只能打前排」
function bossTarget(b,u,foes,melee){
 const pool=melee&&b.mods?.frontOnly&&foes.some(f=>f.row!=='back')?foes.filter(f=>f.row!=='back'):foes;if(!pool.length)return null;
 const healer=pool.find(f=>(f.skills||[]).some(s=>SKILLS[s.id]?.kind==='heal'));
 return (healer||pool.slice().sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0]).uid;
}
export function chooseAllyAction(b,u,rng){
 if(u.st?.k==='forget')return {kind:'attack',target:null};
 const mine=b.units.filter(x=>x.side===u.side),foes=b.units.filter(x=>x.side!==u.side&&x.alive);
 const smart=!!u.boss,tgt=melee=>smart?bossTarget(b,u,foes,melee):null,desperate=smart&&u.hp<u.maxHp*.3; // 王血不到三成：有招就放、不省魔
 const can=id=>{const s=u.skills.find(x=>x.id===id);return s&&u.mp>=mpCost(u,id,s.lv)&&weaponOk(u,id);};
 // 王戰的近衛（u.guardOf）：先護衛王、聖盾沒了就補，不然反擊架勢
 if(u.guardOf){const k=mine.find(x=>x.uid===u.guardOf&&x.alive);if(k&&!(u.coverLeft>1)&&can('cover'))return {kind:'skill',skill:'cover',target:k.uid};if(!(u.wallLeft>1)&&can('wall'))return {kind:'skill',skill:'wall',target:u.uid};if(!u.counterSt&&can('counter')&&rng.chance(50))return {kind:'skill',skill:'counter',target:u.uid};}
 const dead=mine.filter(x=>!x.alive);if(dead.length&&can('revive'))return {kind:'skill',skill:'revive',target:dead[0].uid};
 const stuck=mine.find(x=>x.alive&&x!==u&&(['sleep','stone','confuse'].includes(x.st?.k)||x.st?.k==='forget'&&x.skills?.length));if(stuck&&can('cure'))return {kind:'skill',skill:'cure',target:stuck.uid};
 if(u.hp<u.maxHp*.4&&can('meditate'))return {kind:'skill',skill:'meditate',target:u.uid};
 // 同一回合已經有人要補的，別的補師就不重複補（省魔，◎）
 const hAt=(b.mods?.healAt??50)/100; // 補血門檻（文字版可設定：隊友生命不到幾成才補）
 const hurt=mine.filter(x=>x.alive&&x.hp<x.maxHp*hAt&&!b.healing?.has(x.uid)).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp);
 // 補血照原作可以選低等級：只放補得滿最傷那個人的等級，省魔（◎）
 const healLv=(id,t)=>Math.max(1,Math.ceil((t.maxHp-t.hp)/Math.max(1,t.rec*(SKILLS[id].healPct||60)/100)));
 if(hurt.length>=2)for(const id of ['heal3','heal2'])if(can(id)){for(const x of hurt)b.healing?.add(x.uid);return {kind:'skill',skill:id,target:hurt[0].uid,lv:healLv(id,hurt[0])};}
 if(hurt.length&&can('heal')){b.healing?.add(hurt[0].uid);return {kind:'skill',skill:'heal',target:hurt[0].uid,lv:healLv('heal',hurt[0])};}
 // 咒術師：35% 機率對還沒中異常狀態的敵人下咒（優先頭目）
 const curse=u.skills.filter(s=>SKILLS[s.id].kind==='status'&&can(s.id)),clean=foes.filter(f=>!f.st).sort((a,c)=>(c.boss?1:0)-(a.boss?1:0));
 if(curse.length&&clean.length&&rng.chance(35))return {kind:'skill',skill:curse[Math.floor(rng.next()*curse.length)].id,target:clean[0].uid};
 // 省魔（補魔要花錢）：打雜兵時（擂台 b.pvp 當作打頭目，全力出手）範圍魔法用最便宜的那招、單體魔法只打剋得到屬性的；有頭目才放大招；單體魔法平常 40% 機率才放（◎）
 const boss=b.pvp||foes.some(f=>f.boss),cost=s=>mpCost(u,s.id,s.lv);
 const lv=s=>boss?undefined:Math.max(1,Math.ceil(s.lv/2)); // 打雜兵魔法、物理招都用一半等級放（◎）
 const area=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&SKILLS[s.id].area&&can(s.id)).sort((a,c)=>cost(a)-cost(c));
 if(area.length&&(foes.length>=3||boss&&rng.chance(50))){const s=boss?area[area.length-1]:area[0];return {kind:'skill',skill:s.id,target:foes[Math.floor(rng.next()*foes.length)].uid,lv:lv(s)};}
 const magic=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&!SKILLS[s.id].area&&can(s.id));
 if(magic.length){
  // 挑剋得到的屬性打
  for(const s of magic){const t=foes.find(f=>(f.elem?.[ELEM_BEATS[SKILLS[s.id].elem]]||0)>=5);if(t)return {kind:'skill',skill:s.id,target:t.uid,lv:lv(s)};}
  if(boss||rng.chance(40)){const s=magic[Math.floor(rng.next()*magic.length)];return {kind:'skill',skill:s.id,target:tgt(false),lv:lv(s)};}
 }
 const rnd=a=>a[Math.floor(rng.next()*a.length)];
 // 護衛：隊友生命不到六成時 30% 機率擋在他前面；架勢、聖盾、屏障、恢復魔法：身上還沒有的話 25% 機率先放（◎）
 const weak=mine.find(x=>x.alive&&x!==u&&x.hp<x.maxHp*.6);if(weak&&!(u.coverLeft>1)&&can('cover')&&rng.chance(30))return {kind:'skill',skill:'cover',target:weak.uid};
 const has={wall:u.wallLeft>1,barrier:!!u.barrier,regen:!!u.regen,stance:false};
 const buff=u.skills.filter(s=>SKILLS[s.id].kind in has&&!has[SKILLS[s.id].kind]&&can(s.id));
 if(buff.length&&rng.chance(25))return {kind:'skill',skill:rnd(buff).id,target:u.uid};
 const elem=u.skills.filter(s=>SKILLS[s.id].kind==='elemset'&&SKILLS[s.id].flip&&can(s.id));if(elem.length&&boss&&rng.chance(15))return {kind:'skill',skill:elem[0].id,target:rnd(foes).uid};
 const phys=u.skills.filter(s=>['phys','steal'].includes(SKILLS[s.id].kind)&&can(s.id));
 if(phys.length&&rng.chance(desperate?90:smart?50:35)){const s=rnd(phys);return {kind:'skill',skill:s.id,target:tgt(!u.ranged),lv:lv(s)};}
 return {kind:'attack',target:tgt(!u.ranged)};
}

// 自動喝藥（Leo 2026-10-27 要能設定）：opt.hp＝生命不到幾 % 喝回復藥（0 不喝）、opt.mp＝魔力不到幾 % 或不夠放 planned 那招就喝魔力藥（0 不喝；文字版的魔力藥 battle:false，戰鬥中喝不到）；都挑身上最便宜的、戰鬥中能喝的（it.battle）
export function autoPotion(b,u,planned,have,items,opt={hp:30,mp:15}){
 const cheapest=k=>Object.entries(items).filter(([id,it])=>it.kind==='use'&&it.battle&&it[k]&&have(id)).sort((a,d)=>a[1].price-d[1].price)[0];
 if(opt.hp>0&&u.hp<u.maxHp*opt.hp/100){const pot=cheapest('hp');if(pot)return {kind:'item',item:pot[0],target:u.uid};}
 const need=planned&&SKILLS[planned]?mpCost(u,planned,u.skills?.find(s=>s.id===planned)?.lv||1):0;
 if(opt.mp>0&&(u.mp<need||u.mp<u.maxMp*opt.mp/100)){const pot=cheapest('mp');if(pot)return {kind:'item',item:pot[0],target:u.uid};}
 return null;
}
// 自動戰鬥：照原作重複上一回合的指令，但補給要花錢，所以不浪費——
// 補血道具、補血魔法只在有人生命不到一半時用（沒人需要就改普攻）；自己生命、魔力不夠時照 opt 的設定先喝藥（autoPotion）。
// prev 上一回合這個位置的指令，u 下指令的人，have(id) 道具數量，items 道具表，first 是不是這回合主角的第一個行動
export function autoCommand(b,prev,u,have,items,first=true,opt=undefined){
 const hAt=(b.mods?.healAt??50)/100,c={...prev},mine=b.units.filter(x=>x.side===u.side&&x.alive),hurt=x=>x&&x.alive&&x.hp<x.maxHp*hAt;
 const anyHurt=mine.some(hurt),pick=()=>mine.filter(hurt).sort((a,d)=>a.hp/a.maxHp-d.hp/d.maxHp)[0];
 if(first&&u.kind==='player'){const pot=autoPotion(b,u,c.kind==='skill'?c.skill:null,have,items,opt);if(pot)return pot;}
 // 補血的藥、補血技能都補生命比例最低的隊友，不照上一回合的對象（Leo 2026-10-28：補師設了補血技能卻不去補血最少的）
 if(c.kind==='item'&&items[c.item]?.hp&&!items[c.item]?.mp){if(!anyHurt)return {kind:'attack',target:null};c.target=pick().uid;}
 if(c.kind==='skill'&&(c.skill==='wall'&&u.wallLeft>1||c.skill==='cover'&&u.coverLeft>1))return {kind:'attack',target:null}; // 聖盾、護衛還撐著就不重放
 if(c.kind==='skill'&&SKILLS[c.skill]?.kind==='heal'){if(!anyHurt)return {kind:'attack',target:null};c.target=pick().uid;}
 return c;
}
