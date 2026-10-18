// 寵物：戰鬥中用「捕捉」抓怪物。抓到的寵物每項檔次在原本的 ±2 之間浮動（原作的「檔次浮動」，◎ 幅度自訂），
// 之後照檔次成長，攻防用寵物係數。帶寵物出戰時，主角每回合只行動一次，寵物行動一次（原作）。
import {derive,expFor,MAX_LEVEL} from './stats.mjs';
import {MONSTERS,gradeBp} from '../data/monsters.mjs';
export const PET_MAX=5; // 身上最多帶 5 隻（原作）

export function newPet(mon,lv,rng,uid){
 const grade=MONSTERS[mon].grade.map(g=>Math.max(1,g+rng.int(-2,2)));
 const p={uid,mon,name:MONSTERS[mon].name,lv,exp:expFor(lv),grade};const s=petStats(p);p.hp=s.maxHp;p.mp=s.maxMp;return p;
}
export function petStats(p){const s=derive(gradeBp(p.grade,p.lv),true);return {maxHp:s.hp,maxMp:s.mp,atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0};}
export const gradeSum=p=>p.grade.reduce((a,b)=>a+b,0);
export function petGainExp(p,n){
 const before=petStats(p);let up=false;p.exp+=n;
 while(p.lv<MAX_LEVEL&&p.exp>=expFor(p.lv+1)){p.lv++;up=true;}
 if(up){const s=petStats(p);p.hp+=s.maxHp-before.maxHp;p.mp+=s.maxMp-before.maxMp;}
 return up;
}
export function petUnit(p,owner='p'){
 const m=MONSTERS[p.mon],s=petStats(p);
 return {uid:'pet',pid:p.uid,kind:'pet',owner,name:p.name,art:m.art,h:m.h,lv:p.lv,race:m.race,elem:m.elem,luck:0,
  maxHp:s.maxHp,hp:Math.min(p.hp,s.maxHp),maxMp:s.maxMp,mp:Math.min(p.mp,s.maxMp),atk:s.atk,def:s.def,agi:s.agi,spr:s.spr,rec:s.rec,matk:0,
  skills:(m.skills||[]).map(([id,L])=>({id,lv:L})),row:'front',slot:2};
}
// ◎ 捕捉成功率：原作沒有公開公式。血越少越好抓，等級比自己高越難抓；頭目抓不到。
export function captureRate(a,t){
 if(MONSTERS[t.mon]?.boss)return 0;
 return Math.max(5,Math.min(90,Math.round(10+70*(1-t.hp/t.maxHp)+2*(a.lv-t.lv))));
}
