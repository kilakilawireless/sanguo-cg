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
 // 強力（十字：目標和前後左右）、超強（全體）魔法，照原作分三級；◎ 耗魔與學費自訂，基礎傷害照原作 cross/all 表
 ...Object.fromEntries(['earth','water','fire','wind'].flatMap(e=>{const n={earth:'隕石',water:'冰凍',fire:'火焰',wind:'風刃'}[e];return [
  [e+'2',{name:`強力${n}魔法`,kind:'magic',elem:e,area:'cross',target:'enemy',price:1000,teacher:'mage',mp:L=>25*L,desc:L=>`${n.slice(0,1)}屬性十字範圍魔法，打目標和牠前後左右（Lv${L}）。`}],
  [e+'3',{name:`超強${n}魔法`,kind:'magic',elem:e,area:'all',target:'enemy',price:3000,teacher:'mage',mp:L=>40*L,desc:L=>`${n.slice(0,1)}屬性全體魔法，打所有敵人（Lv${L}）。`}]];})),
 heal:{name:'補血魔法',kind:'heal',target:'ally',price:100,teacher:'priest',mp:L=>15*L,healPct:60,
  desc:L=>`單體回復，回復量為對象回復力的 ${60*L}%。`},
 heal2:{name:'強力補血魔法',kind:'heal',area:'cross',target:'ally',price:1000,teacher:'priest',mp:L=>25*L,healPct:40, // ◎
  desc:L=>`十字範圍回復，每人回復對象回復力的 ${40*L}%。`},
 heal3:{name:'超強補血魔法',kind:'heal',area:'all',target:'ally',price:3000,teacher:'priest',mp:L=>40*L,healPct:30, // ◎
  desc:L=>`我方全體回復，每人回復對象回復力的 ${30*L}%。`},
 cure:{name:'潔淨魔法',kind:'cure',target:'ally',price:100,teacher:'priest',mp:L=>10,desc:()=>'解除一名隊友的中毒、昏睡、石化、混亂、酒醉、遺忘。'},
 // 異常狀態魔法（原作咒術師）：成功率看技能等級與等級差，頭目減半；◎ 機率、回合數自訂
 ...Object.fromEntries([['poison','中毒','每回合結束扣血（不會扣到死）'],['sleep','昏睡','不能行動，被打就醒'],['stone','石化','不能行動'],
  ['confuse','混亂','攻擊時敵我不分'],['drunk','酒醉','出手變得很慢'],['forget','遺忘','不能用技能']].map(([k,n,what])=>
  [k+'1',{name:`${n}魔法`,kind:'status',st:k,target:'enemy',price:100,teacher:'sorcerer',mp:L=>10+5*L,desc:L=>`讓敵人${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}])),
 // 採集（原作的伐木、挖掘、狩獵）：在野外停下來採集，每次耗 1 魔力（◎）。等級越高，能採到越好的材料。
 lumber:{name:'伐木',kind:'gather',price:100,teacher:'lumber',mp:()=>1,desc:L=>`在野外砍樹拿木材。Lv${L} 能採到 ${L} 階以下的木材。`},
 mining:{name:'挖掘',kind:'gather',price:100,teacher:'miner',mp:()=>1,desc:L=>`在野外和洞窟挖礦。Lv${L} 能採到 ${L} 階以下的礦石。`},
 hunting:{name:'狩獵',kind:'gather',price:100,teacher:'hunter',mp:()=>1,desc:L=>`在野外打獵拿肉和毛皮。Lv${L} 能採到 ${L} 階以下的獵物。`},
 // 製造：在工匠坊用材料做裝備，技能等級要 ≥ 裝備等級。耗魔＝裝備等級×10（◎）
 ...Object.fromEntries([['craftSword','鑄劍','劍','smithSword'],['craftAxe','造斧','斧','smithAxe'],['craftSpear','造槍','槍','smithSpear'],['craftBow','造弓','弓','bowyer'],
  ['craftStaff','造杖','杖','staffer'],['craftMail','製鎧','鎧甲與頭盔','armorer'],['craftCloth','裁縫','衣、袍、頭巾、道冠與鞋','tailor'],['medicine','製藥','補生命的藥','pharmacist'],['cookery','料理','補魔力的菜','cook']].map(([id,name,what,teacher])=>
  [id,{name,kind:'craft',price:100,teacher,mp:()=>0,desc:L=>`用材料做${what}。Lv${L} 做得出 ${L} 級以下的東西。`}])),
 revive:{name:'氣絕回復',kind:'revive',target:'dead',price:100,teacher:'priest',mp:L=>5*L,
  desc:L=>`戰鬥中讓一名氣絕的隊友復活，並回復 ${60*L} 生命。`},
};
export const MAGIC_IDS=['earth1','water1','fire1','wind1'];
export const STATUS_NAMES={poison:'中毒',sleep:'昏睡',stone:'石化',confuse:'混亂',drunk:'酒醉',forget:'遺忘'};
// 技能經驗：Lv1→10 累積門檻
export const SKILL_EXP=[0,1800,7200,19800,45000,82800,133200,183600,246600,322200];
export const SKILL_EXP_PER_USE=20; // ◎ 每次使用得「20 × 敵方平均等級」
export const SKILL_SLOTS=10;
