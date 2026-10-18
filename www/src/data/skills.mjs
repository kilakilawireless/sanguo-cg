// 技能：等級 1~10，耗魔與效果隨等級變化（數值照蔚藍幻境台版資料；標 ◎ 為原作查不到、自訂）。
// kind：phys 物理招、magic 攻擊魔法、heal 補血、revive 氣絕回復
// target：enemy 敵方單體、ally 我方單體、dead 我方氣絕者
export const SKILLS={
 combo:{name:'連擊',kind:'phys',target:'enemy',melee:true,price:100,teacher:'sword',
  mp:L=>10+5*(L-1),hits:L=>2+Math.floor((L-1)/2),randomTarget:L=>L%2===1,
  desc:L=>`連續攻擊 ${2+Math.floor((L-1)/2)} 次，每次傷害為普攻的 ${Math.round(100/(2+Math.floor((L-1)/2)))}%；奇數級隨機對象，偶數級同一對象。`},
 allin:{name:'乾坤一擲',kind:'phys',target:'enemy',melee:true,price:100,teacher:'sword',
  mp:L=>10+8*(L-1),mult:L=>1.1+.1*(L-1),hitPenalty:L=>3*L,
  desc:L=>`傷害 ${(1.1+.1*(L-1)).toFixed(1)} 倍，命中 −${3*L}%。`},
 blade:{name:'諸刃',kind:'phys',target:'enemy',melee:true,price:100,teacher:'axe',
  mp:L=>10+8*(L-1),atkUp:L=>7*L,selfDown:L=>5*L,
  desc:L=>`攻擊 +${7*L}%，自己的防禦與精神 −${5*L}% 到下回合。`},
 swift:{name:'迅速果斷',kind:'phys',target:'enemy',melee:true,price:6000,teacher:'sword',
  mp:L=>5+4*(L-1),atkMult:L=>2+.1*(L-1),speedMult:L=>1.1+.1*(L-1),
  desc:L=>`攻擊 ${200+10*(L-1)}%、出手速度 ${110+10*(L-1)}%，下一回合不能行動。`},
 volley:{name:'亂射',kind:'phys',target:'enemy',melee:false,price:100,teacher:'bow', // ◎ 原作數值未查到，比照連擊
  mp:L=>10+5*(L-1),hits:L=>2+Math.floor((L-1)/2),randomTarget:()=>true,
  desc:L=>`隨機射出 ${2+Math.floor((L-1)/2)} 箭，每箭為普攻的 ${Math.round(100/(2+Math.floor((L-1)/2)))}%。`},
 earth1:{name:'隕石魔法',kind:'magic',elem:'earth',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`地屬性單體魔法（Lv${L}）。`}, // ◎ 耗魔自訂
 water1:{name:'冰凍魔法',kind:'magic',elem:'water',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`水屬性單體魔法（Lv${L}）。`},
 fire1:{name:'火焰魔法',kind:'magic',elem:'fire',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`火屬性單體魔法（Lv${L}）。`},
 wind1:{name:'風刃魔法',kind:'magic',elem:'wind',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`風屬性單體魔法（Lv${L}）。`},
 heal:{name:'補血魔法',kind:'heal',target:'ally',price:100,teacher:'priest',mp:L=>15*L,
  desc:L=>`單體回復，回復量為對象回復力的 ${60*L}%。`},
 revive:{name:'氣絕回復',kind:'revive',target:'dead',price:100,teacher:'priest',mp:L=>5*L,
  desc:L=>`戰鬥中讓一名氣絕的隊友復活，並回復 ${60*L} 生命。`},
};
export const MAGIC_IDS=['earth1','water1','fire1','wind1'];
// 技能經驗：Lv1→10 累積門檻
export const SKILL_EXP=[0,1800,7200,19800,45000,82800,133200,183600,246600,322200];
export const SKILL_EXP_PER_USE=20; // ◎ 每次使用得「20 × 敵方平均等級」
export const SKILL_SLOTS=10;
