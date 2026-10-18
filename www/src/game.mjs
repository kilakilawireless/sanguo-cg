// 全遊戲共用：目前的角色、存檔、換畫面。存檔 key：localStorage 'sanguo-cg-v1'（改格式要遷移舊檔）。
import {stats,jobTitle} from './core/player.mjs';
import {h,bar,injTag} from './view/ui.mjs';
import {titleOf,JOBS} from './data/jobs.mjs';
import {ITEMS} from './data/items.mjs';
import {SKILLS} from './data/skills.mjs';
import {OFFICERS} from './data/officers.mjs';
import {MONSTERS} from './data/monsters.mjs';
export const SAVE_KEY='sanguo-cg-v1';
export const G={p:null};
export const go={}; // 各畫面在 main.mjs 註冊：title、create、town、map、field、battle
export function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G.p));}catch{}}
// 讀不到的存檔先另外備份到 sanguo-cg-v1-broken，免得按「新的旅程」就整個蓋掉（第 3 輪防呆）
export function load(){let s=null;try{s=localStorage.getItem(SAVE_KEY);if(!s)return null;const p=migrate(JSON.parse(s));if(p)return p;}catch{}
 try{if(s&&localStorage.getItem(SAVE_KEY+'-broken')!==s)localStorage.setItem(SAVE_KEY+'-broken',s);}catch{}G.broken=!!s;return null;}
// 改版刪掉或改了 id 的道具、技能、傭兵，舊存檔裡的就拿掉，不然打開狀態視窗會當掉
function prune(p){p.bag=(p.bag||[]).filter(x=>ITEMS[x?.id]);for(const k of Object.keys(p.equip||{}))if(p.equip[k]&&!ITEMS[p.equip[k]])p.equip[k]=null;
 p.skills=(p.skills||[]).filter(x=>SKILLS[x?.id]);for(const id of Object.keys(p.officers||{}))if(!OFFICERS[id])delete p.officers[id];p.party=(p.party||[]).filter(id=>OFFICERS[id]&&p.officers[id]);
 p.pets=(p.pets||[]).filter(x=>MONSTERS[x?.mon]);if(p.petOut&&!p.pets.some(x=>x.uid===p.petOut))p.petOut=null;
 if(!JOBS[p.job])p.job='none';return p;}
function migrate(p){if(!p||p.v!==1)return null;prune(p);p.settings||={speed:1,auto:false};p.flags||={};p.officers||={};p.party||=[];p.pets||=[];p.petOut??=null;p.petSeq||=0;p.quests||={};p.inj||=0;return p;}
export function wipe(){try{localStorage.removeItem(SAVE_KEY);}catch{}}
// 上方狀態列
export function hud(...right){
 const p=G.p,s=stats(p);
 return h('div',{class:'hud'},
  h('span',{class:'name'},p.name),injTag(p.inj),h('span',{},`Lv${p.lv} ${jobTitle(p)}`),
  h('span',{},'生命 ',bar(p.hp,s.maxHp,'#c8463a'),` ${p.hp}/${s.maxHp}`),
  h('span',{},'魔力 ',bar(p.mp,s.maxMp,'#4f9ee8'),` ${p.mp}/${s.maxMp}`),
  h('span',{class:'gold'},`${p.gold} 金`),p.freeBp?h('button',{class:'link',onclick:()=>go.status?.()},`可配點 ${p.freeBp}`):null,
  h('span',{class:'spacer'}),...right);
}
export const repTitle=p=>titleOf(p.rep);
