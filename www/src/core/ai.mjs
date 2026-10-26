// 敵方行動：照設定機率放招（魔力夠才放），不然普攻隨機一名我方。
// 遺忘中不放招；異常狀態魔法只對還沒中異常的人放，全員都中了就不浪費魔力。
import {SKILLS} from '../data/skills.mjs';
export function chooseEnemyAction(b,u,rng){
 if(u.st?.k!=='forget')for(const s of u.skills||[]){
  if(!rng.chance(s.pct)||u.mp<SKILLS[s.id].mp(s.lv))continue;
  if(SKILLS[s.id].kind==='status'){const t=b.units.filter(x=>x.side!==u.side&&x.alive&&!x.st);if(!t.length)continue;return {kind:'skill',skill:s.id,target:t[Math.floor(rng.next()*t.length)].uid};}
  return {kind:'skill',skill:s.id,target:null};
 }
 return {kind:'attack',target:null};
}

// 傭兵：有補血的先救人（生命不到一半的隊友），有氣絕回復的先復活，魔術師放魔法，其他偶爾用招、平常普攻。
// 遺忘中只能普攻；會潔淨魔法的先解隊友的昏睡、石化、混亂，還有會用技能的隊友的遺忘。
const ELEM_BEATS={earth:'water',water:'fire',fire:'wind',wind:'earth'};
export function chooseAllyAction(b,u,rng){
 if(u.st?.k==='forget')return {kind:'attack',target:null};
 const mine=b.units.filter(x=>x.side===u.side),foes=b.units.filter(x=>x.side!==u.side&&x.alive);
 const can=id=>{const s=u.skills.find(x=>x.id===id);return s&&u.mp>=SKILLS[id].mp(s.lv);};
 const dead=mine.filter(x=>!x.alive);if(dead.length&&can('revive'))return {kind:'skill',skill:'revive',target:dead[0].uid};
 const stuck=mine.find(x=>x.alive&&x!==u&&(['sleep','stone','confuse'].includes(x.st?.k)||x.st?.k==='forget'&&x.skills?.length));if(stuck&&can('cure'))return {kind:'skill',skill:'cure',target:stuck.uid};
 if(u.hp<u.maxHp*.4&&can('meditate'))return {kind:'skill',skill:'meditate',target:u.uid};
 // 同一回合已經有人要補的，別的補師就不重複補（省魔，◎）
 const hurt=mine.filter(x=>x.alive&&x.hp<x.maxHp*.5&&!b.healing?.has(x.uid)).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp);
 // 補血照原作可以選低等級：只放補得滿最傷那個人的等級，省魔（◎）
 const healLv=(id,t)=>Math.max(1,Math.ceil((t.maxHp-t.hp)/Math.max(1,t.rec*(SKILLS[id].healPct||60)/100)));
 if(hurt.length>=2)for(const id of ['heal3','heal2'])if(can(id)){for(const x of hurt)b.healing?.add(x.uid);return {kind:'skill',skill:id,target:hurt[0].uid,lv:healLv(id,hurt[0])};}
 if(hurt.length&&can('heal')){b.healing?.add(hurt[0].uid);return {kind:'skill',skill:'heal',target:hurt[0].uid,lv:healLv('heal',hurt[0])};}
 // 咒術師：35% 機率對還沒中異常狀態的敵人下咒（優先頭目）
 const curse=u.skills.filter(s=>SKILLS[s.id].kind==='status'&&can(s.id)),clean=foes.filter(f=>!f.st).sort((a,c)=>(c.boss?1:0)-(a.boss?1:0));
 if(curse.length&&clean.length&&rng.chance(35))return {kind:'skill',skill:curse[Math.floor(rng.next()*curse.length)].id,target:clean[0].uid};
 // 省魔（補魔要花錢）：打雜兵時（擂台 b.pvp 當作打頭目，全力出手）範圍魔法用最便宜的那招、單體魔法只打剋得到屬性的；有頭目才放大招；單體魔法平常 40% 機率才放（◎）
 const boss=b.pvp||foes.some(f=>f.boss),cost=s=>SKILLS[s.id].mp(s.lv);
 const lv=s=>boss?undefined:Math.max(1,Math.ceil(s.lv/2)); // 打雜兵魔法、物理招都用一半等級放（◎）
 const area=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&SKILLS[s.id].area&&can(s.id)).sort((a,c)=>cost(a)-cost(c));
 if(area.length&&foes.length>=3){const s=boss?area[area.length-1]:area[0];return {kind:'skill',skill:s.id,target:foes[Math.floor(rng.next()*foes.length)].uid,lv:lv(s)};}
 const magic=u.skills.filter(s=>SKILLS[s.id].kind==='magic'&&!SKILLS[s.id].area&&can(s.id));
 if(magic.length){
  // 挑剋得到的屬性打
  for(const s of magic){const t=foes.find(f=>(f.elem?.[ELEM_BEATS[SKILLS[s.id].elem]]||0)>=5);if(t)return {kind:'skill',skill:s.id,target:t.uid,lv:lv(s)};}
  if(boss||rng.chance(40)){const s=magic[Math.floor(rng.next()*magic.length)];return {kind:'skill',skill:s.id,target:null,lv:lv(s)};}
 }
 const phys=u.skills.filter(s=>SKILLS[s.id].kind==='phys'&&can(s.id));
 if(phys.length&&rng.chance(35))return {kind:'skill',skill:phys[0].id,target:null,lv:lv(phys[0])};
 return {kind:'attack',target:null};
}

// 自動戰鬥：照原作重複上一回合的指令，但補給要花錢，所以不浪費——
// 補血道具、補血魔法只在有人生命不到一半時用（沒人需要就改普攻）；主角生命不到 30% 時先喝身上最便宜的回復藥（◎）。
// prev 上一回合這個位置的指令，u 下指令的人，have(id) 道具數量，items 道具表，first 是不是這回合主角的第一個行動
export function autoCommand(b,prev,u,have,items,first=true){
 const c={...prev},mine=b.units.filter(x=>x.side===u.side&&x.alive),hurt=x=>x&&x.alive&&x.hp<x.maxHp*.5;
 const anyHurt=mine.some(hurt),pick=()=>mine.filter(hurt).sort((a,d)=>a.hp/a.maxHp-d.hp/d.maxHp)[0];
 if(first&&u.kind==='player'&&u.hp<u.maxHp*.3){const pot=Object.entries(items).filter(([id,it])=>it.kind==='use'&&it.battle&&it.hp&&have(id)).sort((a,d)=>a[1].price-d[1].price)[0];
  if(pot)return {kind:'item',item:pot[0],target:u.uid};}
 if(c.kind==='item'&&items[c.item]?.hp&&!items[c.item]?.mp){if(!anyHurt)return {kind:'attack',target:null};if(!hurt(b.units.find(x=>x.uid===c.target)))c.target=pick().uid;}
 if(c.kind==='skill'&&SKILLS[c.skill]?.kind==='heal'){if(!anyHurt)return {kind:'attack',target:null};if(!hurt(b.units.find(x=>x.uid===c.target)))c.target=pick().uid;}
 return c;
}
