// 全遊戲共用：目前的角色、存檔、換畫面。存檔 key：localStorage 'sanguo-cg-v1'（改格式要遷移舊檔）。
import {stats,jobTitle} from './core/player.mjs';
import {h,bar} from './view/ui.mjs';
import {titleOf} from './data/jobs.mjs';
export const SAVE_KEY='sanguo-cg-v1';
export const G={p:null};
export const go={}; // 各畫面在 main.mjs 註冊：title、create、town、map、field、battle
export function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G.p));}catch{}}
export function load(){try{const s=localStorage.getItem(SAVE_KEY);if(!s)return null;return migrate(JSON.parse(s));}catch{return null;}}
function migrate(p){if(!p||p.v!==1)return null;p.settings||={speed:1,auto:false};p.flags||={};return p;}
export function wipe(){try{localStorage.removeItem(SAVE_KEY);}catch{}}
// 上方狀態列
export function hud(...right){
 const p=G.p,s=stats(p);
 return h('div',{class:'hud'},
  h('span',{class:'name'},p.name),h('span',{},`Lv${p.lv} ${jobTitle(p)}`),
  h('span',{},'生命 ',bar(p.hp,s.maxHp,'#c8463a'),` ${p.hp}/${s.maxHp}`),
  h('span',{},'魔力 ',bar(p.mp,s.maxMp,'#4f9ee8'),` ${p.mp}/${s.maxMp}`),
  h('span',{class:'gold'},`${p.gold} 金`),p.freeBp?h('span',{class:'green'},`可配點 ${p.freeBp}`):null,
  h('span',{class:'spacer'}),...right);
}
export const repTitle=p=>titleOf(p.rep);
