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
 swift:{name:'迅速果斷',kind:'phys',target:'enemy',melee:true,price:6000,teacher:'sword',weapons:['sword','axe','spear','staff','fist'],
  mp:L=>5+4*(L-1),atkMult:L=>2+.1*(L-1),speedMult:L=>1.1+.1*(L-1),
  desc:L=>`攻擊 ${200+10*(L-1)}%、出手速度 ${110+10*(L-1)}%，下一回合不能行動。不能用小刀、弓。`},
 // 以下照蔚藍幻境「戰鬥攻擊／防禦／輔助技能」表（2026-10-26 補進來）；原作沒寫的標 ◎
 moon:{name:'追月',kind:'phys',target:'enemy',melee:true,price:6000,teacher:'sword',mp:L=>5*L,
  targets:L=>[Math.ceil(L/2),Math.floor(L/2)+1],
  desc:L=>{const [lo,hi]=[Math.ceil(L/2),Math.floor(L/2)+1];return `一口氣砍 ${lo===hi?lo:lo+'～'+hi} 個敵人，每人受一次普通攻擊的傷害（◎）。`;}},
 twobird:{name:'一石二鳥',kind:'phys',target:'enemy',melee:true,price:100,teacher:'spear',weapons:['sword','axe','spear','fist'],mp:L=>10+8*(L-1),
  front:()=>.45,back:L=>.45+.1*L,
  desc:L=>`打穿一整列：前排受 45% 傷害、後排受 ${45+10*L}% 傷害；後面沒人就只打前排。不能用杖、小刀、弓。`},
 focus:{name:'戒驕戒躁',kind:'phys',target:'enemy',melee:true,price:100,teacher:'axe',weapons:['sword','axe','spear','fist'],mp:L=>10+8*(L-1),
  mult:L=>1+.05*L,crit:L=>38+2*L,speedMult:()=>.7,
  desc:L=>`傷害 ${Math.round((1+.05*L)*100)}%、必殺率 +${38+2*L}%，出手變慢（◎ 速度 70%）。不能用杖、小刀、弓。`},
 sure:{name:'一擊必中',kind:'phys',target:'enemy',melee:false,price:100,teacher:'bow',weapons:['bow'],mp:L=>4+6*L,
  mult:L=>L===1?1.01:1+.03*(L-1),crit:()=>30,speedMult:()=>.7,
  desc:L=>`傷害 ${L===1?101:100+3*(L-1)}%、必殺率 +30%，出手變慢（◎ 速度 70%）。只能用弓。`},
 terror:{name:'戰慄襲心',kind:'phys',target:'enemy',melee:true,price:100,teacher:'fighter',weapons:['sword','axe','spear','staff','fist'],mp:L=>10*L,
  pct:L=>5*L,desc:L=>`攻擊對方的心神，削掉他剩下魔力的 ${5*L}%（不扣生命，◎ 必中）。不能用小刀、弓。`},
 chaos:{name:'混亂攻擊',kind:'phys',target:'enemy',melee:true,price:100,teacher:'fighter',weapons:['fist'],mp:L=>5*L,
  pool:L=>['poison','sleep',...(L>=4?['confuse','drunk']:[]),...(L>=7?['stone','forget']:[])],
  desc:L=>`普通攻擊，打中時有機會讓對方隨機中一種異常（◎ 機率同異常魔法；4 級起多了混亂、酒醉，7 級起多了石化、遺忘）。只能空手。`},
 counter:{name:'反擊',kind:'stance',target:'self',price:100,teacher:'spear',mp:L=>5+4*(L-1),mult:L=>.7+.1*L,
  desc:L=>`這回合被近身打到就一定回敬一擊（◎ 必定反擊），傷害為普攻的 ${70+10*L}%。`},
 haze:{name:'陽炎',kind:'stance',target:'self',price:100,teacher:'assassin',mp:L=>3+2*L,pct:L=>7*L,
  desc:L=>`這回合身形飄忽：閃躲率 +${7*L}%、防禦 −${7*L}%（◎ 照原作數字，閃躲用乘的）。`},
 volley:{name:'亂射',kind:'phys',target:'enemy',melee:false,price:100,teacher:'bow', // ◎ 原作數值未查到，比照連擊
  mp:L=>10+5*(L-1),hits:L=>2+Math.floor((L-1)/2),randomTarget:()=>true,
  desc:L=>`隨機射出 ${2+Math.floor((L-1)/2)} 箭，每箭為普攻的 ${Math.round(100/(2+Math.floor((L-1)/2)))}%。`},
 // 格鬥士◎ 數值原作查不到，自訂
 qigong:{name:'氣功彈',kind:'phys',target:'enemy',melee:false,price:100,teacher:'fighter',
  mp:L=>10+5*(L-1),targets:L=>1+Math.floor((L-1)/3),mult:L=>.8+.04*L,
  desc:L=>{const n=1+Math.floor((L-1)/3);return `發出氣功彈打 ${n} 個不同的敵人，每人受普攻 ${Math.round((.8+.04*L)*100)}% 傷害，不會被反擊。`;}},
 smash:{name:'崩擊',kind:'phys',target:'enemy',melee:true,price:100,teacher:'fighter',
  mp:L=>10+6*(L-1),pierce:L=>10+4*L,
  desc:L=>`破開對方的防禦架勢（防禦指令無效），並無視對方 ${10+4*L}% 防禦。`},
 meditate:{name:'明鏡止水',kind:'selfheal',target:'self',price:100,teacher:'fighter',
  mp:L=>5+5*L,healPct:50,
  desc:L=>`靜心調息，回復自己回復力 ${50*L}% 的生命，並解除異常狀態。`},
 // 士兵、忍者 ◎ 數值原作查不到，自訂（聖盾的名字也是自訂）
 cover:{name:'護衛',kind:'cover',target:'ally',price:100,teacher:'guard',mp:L=>5+3*L,cut:L=>10+3*L,
  desc:L=>`這一回合替一名隊友擋下所有物理攻擊，自己受到的傷害 −${10+3*L}%。`},
 wall:{name:'聖盾',kind:'wall',target:'self',price:100,teacher:'guard',mp:L=>5+3*L,rate:L=>.5-.025*L,counter:L=>20+6*L,
  desc:L=>`這一回合死守：受到的物理傷害只剩 ${Math.round((.5-.025*L)*100)}%，被近身打有 ${20+6*L}% 機率反擊。`},
 kill:{name:'暗殺',kind:'phys',target:'enemy',melee:true,price:100,teacher:'assassin',mp:L=>10+6*L,chance:L=>2+2*L,
  desc:L=>`攻擊時有 ${2+2*L}% 機率一擊斃命（頭目無效，對方血越少越容易，最多兩倍），沒得手就是普通一擊。`},
 venom:{name:'毒擊',kind:'phys',target:'enemy',melee:true,price:100,teacher:'assassin',mp:L=>8+4*L,
  desc:L=>`攻擊並讓對方中毒，成功率約 ${50+5*L}%，持續 ${3+Math.floor(L/3)} 回合。`},
 // 巫師、封印師、馴獸師 ◎ 數值原作查不到，自訂
 drain:{name:'吸血魔法',kind:'magic',drain:50,target:'enemy',price:100,teacher:'wizard',mp:L=>12*L,desc:L=>`用自己的屬性打一個敵人，吸回傷害的一半當生命（Lv${L}）。`},
 regen:{name:'恢復魔法',kind:'regen',target:'ally',price:100,teacher:'wizard',mp:L=>10+6*L,
  desc:L=>`替一名隊友施加恢復魔法，接下來 3 回合每回合結束回復他回復力 ${20*L}% 的生命。`},
 seal:{name:'封印',kind:'capture',target:'enemy',price:100,teacher:'sealer',mp:L=>5+3*L,bonus:L=>5+4*L,
  desc:L=>`用封印卡收服怪物，成功率比徒手捕捉高 ${5+4*L}%（頭目抓不到）。`},
 rally:{name:'寵物強化',kind:'rally',target:'self',price:100,teacher:'beastmaster',mp:L=>8+4*L,pct:L=>10+4*L,
  desc:L=>`激勵出戰的寵物，接下來 3 回合寵物的攻擊、防禦 +${10+4*L}%。`},
 // 醫療（原作醫生的治療、護士的急救）：戰鬥外在狀態視窗的技能頁用（◎ 數值自訂）
 treat:{name:'治療',kind:'field',price:100,teacher:'doctor',mp:L=>10+4*L,cure:L=>12*L,desc:L=>`替一名隊友（或寵物）治傷，受傷程度 −${12*L}。`},
 firstaid:{name:'急救',kind:'field',price:100,teacher:'nurse',mp:L=>5+3*L,heal:L=>80*L,desc:L=>`替一名隊友（或寵物）止血包紮，回復 ${80*L} 生命。`},
 earth1:{name:'隕石魔法',kind:'magic',elem:'earth',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`地屬性單體魔法（Lv${L}）。`}, // ◎ 耗魔自訂
 water1:{name:'冰凍魔法',kind:'magic',elem:'water',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`水屬性單體魔法（Lv${L}）。`},
 fire1:{name:'火焰魔法',kind:'magic',elem:'fire',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`火屬性單體魔法（Lv${L}）。`},
 wind1:{name:'風刃魔法',kind:'magic',elem:'wind',target:'enemy',price:100,teacher:'mage',mp:L=>15*L,desc:L=>`風屬性單體魔法（Lv${L}）。`},
 // 強力（十字：目標和前後左右）、超強（全體）魔法，照原作分三級；◎ 耗魔與學費自訂，基礎傷害照原作 cross/all 表
 ...Object.fromEntries(['earth','water','fire','wind'].flatMap(e=>{const [el,n2,n3]={earth:['地','強力隕石魔法','超強隕石魔法'],water:['水','強力冰凍魔法','超強冰凍魔法'],fire:['火','強力火焰魔法','超強火焰魔法'],wind:['風','強力風刃魔法','超強風刃魔法']}[e];return [
  [e+'2',{name:n2,kind:'magic',elem:e,area:'cross',target:'enemy',price:1000,teacher:'mage',mp:L=>25*L,desc:L=>`${el}屬性十字範圍魔法，打目標和牠前後左右（Lv${L}）。`}],
  [e+'3',{name:n3,kind:'magic',elem:e,area:'all',target:'enemy',price:3000,teacher:'mage',mp:L=>40*L,desc:L=>`${el}屬性全體魔法，打所有敵人（Lv${L}）。`}]];})),
 heal:{name:'補血魔法',kind:'heal',target:'ally',price:100,teacher:'priest',mp:L=>15*L,healPct:60,
  desc:L=>`單體回復，回復量為對象回復力的 ${60*L}%。`},
 heal2:{name:'強力補血魔法',kind:'heal',area:'cross',target:'ally',price:1000,teacher:'priest',mp:L=>25*L,healPct:40, // ◎
  desc:L=>`十字範圍回復，每人回復對象回復力的 ${40*L}%。`},
 heal3:{name:'超強補血魔法',kind:'heal',area:'all',target:'ally',price:3000,teacher:'priest',mp:L=>40*L,healPct:30, // ◎
  desc:L=>`我方全體回復，每人回復對象回復力的 ${30*L}%。`},
 cure:{name:'潔淨魔法',kind:'cure',target:'ally',price:100,teacher:'priest',mp:L=>10,desc:()=>'解除一名隊友的中毒、昏睡、石化、混亂、酒醉、遺忘。'},
 // 異常狀態魔法（原作咒術師）：成功率看技能等級與等級差，頭目減半；◎ 機率、回合數自訂
 ...Object.fromEntries([['poison','中毒','每回合結束扣血（不會扣到死）','中毒魔法'],['sleep','昏睡','不能行動，被打就醒','昏睡魔法'],['stone','石化','不能行動','石化魔法'],
  ['confuse','混亂','攻擊時敵我不分','混亂魔法'],['drunk','酒醉','出手變得很慢','酒醉魔法'],['forget','遺忘','不能用技能','遺忘魔法']].map(([k,n,what,name])=>
  [k+'1',{name,kind:'status',st:k,target:'enemy',price:100,teacher:'sorcerer',mp:L=>10+5*L,desc:L=>`讓敵人${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}])),
 // 採集（原作的伐木、挖掘、狩獵）：在野外停下來採集，每次耗 1 魔力（◎）。等級越高，能採到越好的材料。
 lumber:{name:'伐木',kind:'gather',price:100,teacher:'lumber',mp:()=>1,desc:L=>`在野外砍樹拿木材。Lv${L} 能採到 ${L} 階以下的木材。`},
 mining:{name:'挖掘',kind:'gather',price:100,teacher:'miner',mp:()=>1,desc:L=>`在野外和洞窟挖礦。Lv${L} 能採到 ${L} 階以下的礦石。`},
 hunting:{name:'狩獵',kind:'gather',price:100,teacher:'hunter',mp:()=>1,desc:L=>`在野外打獵拿肉和毛皮。Lv${L} 能採到 ${L} 階以下的獵物。`},
 // 製造：在工房用材料做裝備，技能等級要 ≥ 裝備等級。耗魔＝裝備等級×10（◎）
 ...Object.fromEntries([['craftSword','鑄劍','劍','smithSword'],['craftAxe','造斧','斧','smithAxe'],['craftSpear','造槍','槍','smithSpear'],['craftBow','造弓','弓','bowyer'],
  ['craftStaff','造杖','杖','staffer'],['craftMail','製鎧','鎧甲與頭盔','armorer'],['craftCloth','裁縫','衣、袍、頭巾、法帽與鞋','tailor'],['medicine','製藥','補生命的藥','pharmacist'],['cookery','料理','補魔力的菜','cook']].map(([id,name,what,teacher])=>
  [id,{name,kind:'craft',price:100,teacher,mp:()=>0,desc:L=>`用材料做${what}。Lv${L} 做得出 ${L} 級以下的東西。`}])),
 revive:{name:'氣絕回復',kind:'revive',target:'dead',price:100,teacher:'priest',mp:L=>5*L,
  desc:L=>`戰鬥中讓一名氣絕的隊友復活，並回復 ${60*L} 生命。`},
};
// 技能限定的武器（weapons 沒寫就不限）；空手算 fist
export const weaponOk=(u,id)=>!SKILLS[id]?.weapons||SKILLS[id].weapons.includes(u.weaponType||'fist');
export const MAGIC_IDS=['earth1','water1','fire1','wind1'];
export const STATUS_NAMES={poison:'中毒',sleep:'昏睡',stone:'石化',confuse:'混亂',drunk:'酒醉',forget:'遺忘'};
// 技能經驗：Lv1→10 累積門檻
export const SKILL_EXP=[0,1800,7200,19800,45000,82800,133200,183600,246600,322200];
export const SKILL_EXP_PER_USE=20; // ◎ 每次使用得「20 × 敵方平均等級」
export const SKILL_SLOTS=10;
