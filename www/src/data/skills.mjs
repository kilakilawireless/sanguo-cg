// 技能：等級 1~10，耗魔與效果隨等級變化（數值照蔚藍幻境台版資料；標 ◎ 為原作查不到、自訂）。
// kind：phys 物理招、magic 攻擊魔法、heal 補血、revive 氣絕回復
// target：enemy 敵方單體、ally 我方單體、dead 我方氣絕者
export const SKILLS={
 combo:{name:'連環斬',kind:'phys',target:'enemy',melee:true,price:100,teacher:'sword',
  mp:L=>10+5*(L-1),hits:L=>2+Math.floor((L-1)/2),randomTarget:L=>L%2===1,
  desc:L=>`連續攻擊 ${2+Math.floor((L-1)/2)} 次，每次傷害為普攻的 ${Math.round(100/(2+Math.floor((L-1)/2)))}%；奇數級隨機對象，偶數級同一對象。`},
 allin:{name:'破釜沉舟',kind:'phys',target:'enemy',melee:true,price:100,teacher:'sword',
  mp:L=>10+8*(L-1),mult:L=>1.1+.1*(L-1),hitPenalty:L=>3*L,
  desc:L=>`傷害 ${(1.1+.1*(L-1)).toFixed(1)} 倍，命中 −${3*L}%。`},
 blade:{name:'背水一戰',kind:'phys',target:'enemy',melee:true,price:100,teacher:'axe',
  mp:L=>10+8*(L-1),atkUp:L=>7*L,selfDown:L=>5*L,
  desc:L=>`攻擊 +${7*L}%，自己的防禦與精神 −${5*L}% 到下回合。`},
 swift:{name:'兵貴神速',kind:'phys',target:'enemy',melee:true,price:6000,teacher:'sword',
  mp:L=>5+4*(L-1),atkMult:L=>2+.1*(L-1),speedMult:L=>1.1+.1*(L-1),
  desc:L=>`攻擊 ${200+10*(L-1)}%、出手速度 ${110+10*(L-1)}%，下一回合不能行動。`},
 volley:{name:'萬箭齊發',kind:'phys',target:'enemy',melee:false,price:100,teacher:'bow', // ◎ 原作數值未查到，比照連環斬
  mp:L=>10+5*(L-1),hits:L=>2+Math.floor((L-1)/2),randomTarget:()=>true,
  desc:L=>`隨機射出 ${2+Math.floor((L-1)/2)} 箭，每箭為普攻的 ${Math.round(100/(2+Math.floor((L-1)/2)))}%。`},
 // 拳師（原作格鬥士）◎ 數值原作查不到，自訂
 qigong:{name:'隔山打牛',kind:'phys',target:'enemy',melee:false,price:100,teacher:'fighter',
  mp:L=>10+5*(L-1),targets:L=>1+Math.floor((L-1)/3),mult:L=>.8+.04*L,
  desc:L=>{const n=1+Math.floor((L-1)/3);return `隔空發勁打 ${n} 個不同的敵人，每人受普攻 ${Math.round((.8+.04*L)*100)}% 傷害，不會被反擊。`;}},
 smash:{name:'開碑手',kind:'phys',target:'enemy',melee:true,price:100,teacher:'fighter',
  mp:L=>10+6*(L-1),pierce:L=>10+4*L,
  desc:L=>`破開對方的防禦架勢（防禦指令無效），並無視對方 ${10+4*L}% 防禦。`},
 meditate:{name:'運氣調息',kind:'selfheal',target:'self',price:100,teacher:'fighter',
  mp:L=>5+5*L,healPct:50,
  desc:L=>`調整內息，回復自己回復力 ${50*L}% 的生命，並解除異常狀態。`},
 // 甲士（原作士兵）、刺客（原作忍者）◎ 數值原作查不到，自訂
 cover:{name:'捨身護主',kind:'cover',target:'ally',price:100,teacher:'guard',mp:L=>5+3*L,cut:L=>10+3*L,
  desc:L=>`這一回合替一名隊友擋下所有物理攻擊，自己受到的傷害 −${10+3*L}%。`},
 wall:{name:'固守如山',kind:'wall',target:'self',price:100,teacher:'guard',mp:L=>5+3*L,rate:L=>.5-.025*L,counter:L=>20+6*L,
  desc:L=>`這一回合死守：受到的物理傷害只剩 ${Math.round((.5-.025*L)*100)}%，被近身打有 ${20+6*L}% 機率反擊。`},
 kill:{name:'一擊必殺',kind:'phys',target:'enemy',melee:true,price:100,teacher:'assassin',mp:L=>10+6*L,chance:L=>2+2*L,
  desc:L=>`攻擊時有 ${2+2*L}% 機率一刀斃命（頭目無效，對方血越少越容易，最多兩倍），沒得手就是普通一擊。`},
 venom:{name:'淬毒刃',kind:'phys',target:'enemy',melee:true,price:100,teacher:'assassin',mp:L=>8+4*L,
  desc:L=>`攻擊並讓對方中毒，成功率約 ${50+5*L}%，持續 ${3+Math.floor(L/3)} 回合。`},
 earth1:{name:'落石術',kind:'magic',elem:'earth',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`地屬性單體魔法（Lv${L}）。`}, // ◎ 耗魔自訂
 water1:{name:'水箭術',kind:'magic',elem:'water',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`水屬性單體魔法（Lv${L}）。`},
 fire1:{name:'火矢術',kind:'magic',elem:'fire',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`火屬性單體魔法（Lv${L}）。`},
 wind1:{name:'疾風術',kind:'magic',elem:'wind',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`風屬性單體魔法（Lv${L}）。`},
 // 強力（十字：目標和前後左右）、超強（全體）魔法，照原作分三級；◎ 耗魔與學費自訂，基礎傷害照原作 cross/all 表
 ...Object.fromEntries(['earth','water','fire','wind'].flatMap(e=>{const [el,n2,n3]={earth:['地','山崩','天崩地裂'],water:['水','水攻','水淹七軍'],fire:['火','火攻','火燒連營'],wind:['風','狂風','借東風']}[e];return [
  [e+'2',{name:n2,kind:'magic',elem:e,area:'cross',target:'enemy',price:1000,teacher:'mage',mp:L=>25*L,desc:L=>`${el}屬性十字範圍魔法，打目標和牠前後左右（Lv${L}）。`}],
  [e+'3',{name:n3,kind:'magic',elem:e,area:'all',target:'enemy',price:3000,teacher:'mage',mp:L=>40*L,desc:L=>`${el}屬性全體魔法，打所有敵人（Lv${L}）。`}]];})),
 heal:{name:'青囊術',kind:'heal',target:'ally',price:100,teacher:'priest',mp:L=>15*L,healPct:60,
  desc:L=>`單體回復，回復量為對象回復力的 ${60*L}%。`},
 heal2:{name:'回春術',kind:'heal',area:'cross',target:'ally',price:1000,teacher:'priest',mp:L=>25*L,healPct:40, // ◎
  desc:L=>`十字範圍回復，每人回復對象回復力的 ${40*L}%。`},
 heal3:{name:'懸壺濟世',kind:'heal',area:'all',target:'ally',price:3000,teacher:'priest',mp:L=>40*L,healPct:30, // ◎
  desc:L=>`我方全體回復，每人回復對象回復力的 ${30*L}%。`},
 cure:{name:'清心術',kind:'cure',target:'ally',price:100,teacher:'priest',mp:L=>10,desc:()=>'解除一名隊友的中毒、昏睡、石化、混亂、酒醉、遺忘。'},
 // 異常狀態魔法（原作咒術師）：成功率看技能等級與等級差，頭目減半；◎ 機率、回合數自訂
 ...Object.fromEntries([['poison','中毒','每回合結束扣血（不會扣到死）','施毒計'],['sleep','昏睡','不能行動，被打就醒','迷魂術'],['stone','石化','不能行動','定身術'],
  ['confuse','混亂','攻擊時敵我不分','離間計'],['drunk','酒醉','出手變得很慢','美酒計'],['forget','遺忘','不能用技能','亂神計']].map(([k,n,what,name])=>
  [k+'1',{name,kind:'status',st:k,target:'enemy',price:100,teacher:'sorcerer',mp:L=>10+5*L,desc:L=>`讓敵人${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}])),
 // 採集（原作的伐木、挖掘、狩獵）：在野外停下來採集，每次耗 1 魔力（◎）。等級越高，能採到越好的材料。
 lumber:{name:'伐木',kind:'gather',price:100,teacher:'lumber',mp:()=>1,desc:L=>`在野外砍樹拿木材。Lv${L} 能採到 ${L} 階以下的木材。`},
 mining:{name:'挖掘',kind:'gather',price:100,teacher:'miner',mp:()=>1,desc:L=>`在野外和洞窟挖礦。Lv${L} 能採到 ${L} 階以下的礦石。`},
 hunting:{name:'狩獵',kind:'gather',price:100,teacher:'hunter',mp:()=>1,desc:L=>`在野外打獵拿肉和毛皮。Lv${L} 能採到 ${L} 階以下的獵物。`},
 // 製造：在工匠坊用材料做裝備，技能等級要 ≥ 裝備等級。耗魔＝裝備等級×10（◎）
 ...Object.fromEntries([['craftSword','鑄劍','劍','smithSword'],['craftAxe','造斧','斧','smithAxe'],['craftSpear','造槍','槍','smithSpear'],['craftBow','造弓','弓','bowyer'],
  ['craftStaff','造杖','杖','staffer'],['craftMail','製鎧','鎧甲與頭盔','armorer'],['craftCloth','裁縫','衣、袍、頭巾、道冠與鞋','tailor'],['medicine','製藥','補生命的藥','pharmacist'],['cookery','料理','補魔力的菜','cook']].map(([id,name,what,teacher])=>
  [id,{name,kind:'craft',price:100,teacher,mp:()=>0,desc:L=>`用材料做${what}。Lv${L} 做得出 ${L} 級以下的東西。`}])),
 revive:{name:'起死回生',kind:'revive',target:'dead',price:100,teacher:'priest',mp:L=>5*L,
  desc:L=>`戰鬥中讓一名氣絕的隊友復活，並回復 ${60*L} 生命。`},
};
export const MAGIC_IDS=['earth1','water1','fire1','wind1'];
export const STATUS_NAMES={poison:'中毒',sleep:'昏睡',stone:'石化',confuse:'混亂',drunk:'酒醉',forget:'遺忘'};
// 技能經驗：Lv1→10 累積門檻
export const SKILL_EXP=[0,1800,7200,19800,45000,82800,133200,183600,246600,322200];
export const SKILL_EXP_PER_USE=20; // ◎ 每次使用得「20 × 敵方平均等級」
export const SKILL_SLOTS=10;
