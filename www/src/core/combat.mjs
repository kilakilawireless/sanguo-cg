// 戰鬥公式，全部照原作社群整理（企劃書「原作研究一」）。標 ◎ 的是原作查不到、我們自訂的值。
export const SOFT_CAP=241; // 攻、防、敏超過 241 的部分只算 30%
export const soft=x=>x<=SOFT_CAP?x:SOFT_CAP+(x-SOFT_CAP)*.3;
export const DEFEND_RATE=.5; // ◎ 防禦指令受到的物理傷害 ×0.5
export const WEAPON_MULT=1.15;

// 物理基礎傷害 = ATK² / (ATK/3 + DEF)
export function physBase(atk,def){
 const A=soft(atk),D=soft(def);if(A<=0)return 1;
 return D>=0?A*A/(A/3+D):A*A/(A/3)-D;
}

// 屬性修正（百分點）：純屬性剋純屬性 +30。沒有屬性的一方視為被完全剋制。
const E=['earth','water','fire','wind'];
const has=e=>e&&E.some(k=>e[k]>0);
export function elemMod(a,d){
 const A=has(a),D=has(d);if(!A&&!D)return 0;if(A&&!D)return 30;if(!A&&D)return -30;
 const x=k=>(a[k]||0)/10,y=k=>(d[k]||0)/10;
 const win=x('earth')*y('water')+x('water')*y('fire')+x('fire')*y('wind')+x('wind')*y('earth');
 const lose=x('water')*y('earth')+x('fire')*y('water')+x('wind')*y('fire')+x('earth')*y('wind');
 return 30*(win-lose);
}

// 種族修正：全剋 ±20、半剋 ±10；邪魔打所有種族 +10、被打 −20。
export const RACES=['human','beast','plant','undead','dragon','flying','insect','special','metal','demon'];
const FULL=[['human','beast','plant','undead'],['dragon','flying','insect','special','metal']];
const HALF=['human','insect','plant','special','dragon','beast','flying','undead','metal'];
const beats=(chains,a,d)=>chains.some(c=>{const i=c.indexOf(a);return i>=0&&c[(i+1)%c.length]===d;});
export function raceMod(a,d){
 if(!a||!d||a===d)return 0;
 let m=0;if(a==='demon')m+=10;if(d==='demon')m-=20;
 if(beats(FULL,a,d))m+=20;else if(beats(FULL,d,a))m-=20;
 else if(beats([HALF],a,d))m+=10;else if(beats([HALF],d,a))m-=10;
 return m;
}

// 閃躲率：指數 = 防方敏捷 / 攻方敏捷 × 10（取整，夾在 10~28）查表，再加減修正，限制 1~70%。
export function dodgeRate(attAgi,defAgi,{hitMod=0,avoidMod=0,skillHit=0}={}){
 const i=Math.max(10,Math.min(28,Math.floor(soft(defAgi)/Math.max(1,soft(attAgi))*10)));
 const table=i<=10?1:i<=20?5*(i-10):50+2.5*(i-20);
 return Math.max(1,Math.min(70,table+avoidMod-hitMod-skillHit));
}

// 必殺率：修正 + 技能 + 運氣×(持斧 4，否則 1) − 1；怪物與寵物用 +4 − 1。
export const critRate=(u,skillCrit=0)=>Math.max(0,(u.critMod||0)+skillCrit+(u.kind==='player'?(u.luck||1)*(u.weaponType==='axe'?4:1):4)-1);
// 必殺額外傷害 = 目標面板防禦 × 攻方等級 ÷ 目標等級 ÷ 2
export const critExtra=(defPanel,attLv,defLv)=>Math.floor(Math.max(0,defPanel)*attLv/Math.max(1,defLv)/2);
// 反擊率：修正 + 運氣×(持槍 4，否則 1) − 1；只有近身物理攻擊能觸發。
export const counterRate=u=>Math.max(0,(u.counterMod||0)+(u.kind==='player'?(u.luck||1)*(u.weaponType==='spear'?4:1):1)-1);
export const COUNTER_MULT=.75;

// 出手速度：(有效敏捷/2 + 行動加成 + 運氣×5) × [2 − (HP+MP)/(最大HP+最大MP)]；約 10% 機率抽到亂數類別。
export function speedOf(u,rng,as=0){
 const roll=rng.next();
 if(roll<.05)return rng.int(501,1000);
 if(roll<.10)return rng.int(0,500);
 const ratio=(u.hp+u.mp)/Math.max(1,u.maxHp+u.maxMp);
 return (soft(u.agi)/2+as+(u.luck||1)*5)*(2-ratio);
}

// 魔法傷害 = 基礎值 × A(精神比) × (B + C) × rand(95~105)% × (100 + 屬性 + 種族)%
const A_PLAYER=[[119,1.1],[113,1.0],[105,.9],[97,.7],[89,.6],[79,.4],[69,.3]];
const A_PET=[[119,1.1],[113,1.1],[105,1.05],[97,.95],[89,.9],[79,.7],[69,.6]];
export function magicA(mySpr,tSpr,pet=false){
 const r=Math.max(1,mySpr)/Math.max(1,tSpr)*100;
 for(const [t,v] of pet?A_PET:A_PLAYER)if(r>t)return v;
 return pet?.4:.1;
}
export const sprNeed=lv=>103+20*lv;
export const matkNeed=lv=>10+30*(lv-1);
export const magicB=(spr,lv)=>Math.max(0,Math.min(.8,.8*spr/sprNeed(lv)+.005));
export const magicC=(matk,lv)=>Math.max(0,Math.min(.4,(matk-matkNeed(lv))/lv/10+.005));
const lerp=(a,b,lv)=>a+(b-a)*(lv-1)/9;
export const MAGIC_BASE={single:[95,722],cross:[57,433],all:[38,289],drain:[63,481]};
export const magicBase=(kind,lv)=>lerp(...MAGIC_BASE[kind],lv);

// 逃跑：係數 = 連續逃跑次數×30 + 運氣×3 + (自己等級 − 敵方最高等級)/2；成功率 = (係數−1)/99
export function escapeRate(tries,luck,myLv,enemyMaxLv){
 const c=tries*30+luck*3+Math.trunc((myLv-enemyMaxLv)/2);
 return Math.max(0,Math.min(1,(Math.max(1,c)-1)/99));
}

// 經驗：怪物等級 × (2×怪物等級 − 自己等級 + 13) ÷ 2，最低 1；怪比自己高 6 級以上只拿 63%。
export function expFrom(monLv,myLv){
 let e=Math.max(1,Math.floor(monLv*(2*monLv-myLv+13)/2));
 if(monLv-myLv>=6)e=Math.floor(e*.6333);
 return e;
}
