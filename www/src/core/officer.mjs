// 武將的成長與戰鬥數值。等級與經驗跟主角一樣算（各自拿經驗，照原作公式），點數照武將的分配比例自動加。
import {derive,BP_KEYS,totalBpAt,singleCapAt,expFor,MAX_LEVEL} from './stats.mjs';
import {skillCap} from '../data/jobs.mjs';
import {OFFICERS} from '../data/officers.mjs';

// ◎ 武將不換裝，裝備加成照等級算（約等於同等級玩家買得到的裝備）
const gearOf=(o,lv)=>({atk:OFFICERS[o].weapon==='staff'?5+lv:16+3*lv,def:10+2*lv,matk:OFFICERS[o].weapon==='staff'?12+6*lv:0});
export function officerBp(id,lv){
 const w=OFFICERS[id].w,total=totalBpAt(lv),cap=singleCapAt(lv),bp={};let left=total;
 BP_KEYS.forEach((k,i)=>{const v=Math.min(cap,Math.floor(total*w[i]));bp[k]=v;left-=v;});
 for(const k of [...BP_KEYS].sort((a,b)=>w[BP_KEYS.indexOf(b)]-w[BP_KEYS.indexOf(a)])){const add=Math.min(left,cap-bp[k]);bp[k]+=add;left-=add;}
 return Object.fromEntries(BP_KEYS.map(k=>[k,bp[k]*100]));
}
export function officerStats(id,lv){
 const s=derive(officerBp(id,lv)),g=gearOf(id,lv);
 return {maxHp:s.hp,maxMp:s.mp,atk:s.atk+g.atk,def:s.def+g.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:g.matk};
}
// 技能等級：每 5 級升一級，不超過職業見習的上限
export const officerSkillLv=(id,sid,lv)=>Math.max(1,Math.min(skillCap(OFFICERS[id].job,0,sid),1+Math.floor(lv/5)));
export function newOfficer(id,lv){const s=officerStats(id,lv);return {id,lv,exp:expFor(lv),hp:s.maxHp,mp:s.maxMp};}
export function officerGainExp(o,n){
 const before=officerStats(o.id,o.lv);let up=false;o.exp+=n;
 while(o.lv<MAX_LEVEL&&o.exp>=expFor(o.lv+1)){o.lv++;up=true;}
 if(up){const s=officerStats(o.id,o.lv);o.hp+=s.maxHp-before.maxHp;o.mp+=s.maxMp-before.maxMp;}
 return up;
}
export function officerUnit(o,slot){
 const d=OFFICERS[o.id],s=officerStats(o.id,o.lv);
 return {uid:'o_'+o.id,oid:o.id,kind:'officer',ai:true,name:d.name,art:d.art,h:96,lv:o.lv,race:'human',elem:d.elem,luck:3,
  maxHp:s.maxHp,hp:Math.min(o.hp,s.maxHp),maxMp:s.maxMp,mp:Math.min(o.mp,s.maxMp),atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:s.matk,
  weaponType:d.weapon,ranged:d.weapon==='bow',skills:[...d.skills,...(d.later||[]).filter(([,lv])=>o.lv>=lv).map(([id])=>id)].map(id=>({id,lv:officerSkillLv(o.id,id,o.lv)})),row:d.front?'front':'back',slot};
}
