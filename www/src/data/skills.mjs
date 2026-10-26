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
 // 亂射：照蔚藍幻境，箭數 L+2、耗魔 5×L、只能用弓；同一個人連中越多箭傷害越低。◎ 每箭普攻 40%，同一人每多中一箭再 ×0.75
 volley:{name:'亂射',kind:'phys',target:'enemy',melee:false,price:100,teacher:'bow',weapons:['bow'],
  mp:L=>5*L,arrows:L=>L+2,arrowMult:.4,decay:.75,
  desc:L=>`隨機射出 ${L+2} 箭，每箭為普攻的 40%；同一個人連中越多箭傷害越低（每多一箭 ×0.75）。只能用弓。`},
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
 regen:{name:'恢復魔法',kind:'regen',target:'ally',price:100,teacher:'wizard',mp:L=>15*L,pct:20,
  desc:L=>`替一名隊友施加恢復魔法，接下來 6 回合每回合結束回復他回復力 ${20*L}% 的生命（重複施放不疊加）。`},
 regen2:{name:'強力恢復魔法',kind:'regen',area:'cross',target:'ally',price:1000,teacher:'wizard',mp:L=>18*L,pct:12,
  desc:L=>`十字範圍的隊友 6 回合內每回合回復回復力 ${12*L}% 的生命。`},
 regen3:{name:'超強恢復魔法',kind:'regen',area:'all',target:'ally',price:3000,teacher:'wizard',mp:L=>24*L,pct:8,
  desc:L=>`我方全體 6 回合內每回合回復回復力 ${8*L}% 的生命。`},
 // 巫師的屏障：一名隊友身上，持續 BARRIER_TURNS 回合；吸收、反彈擋一下，無效擋兩下（◎ 次數），擋完就消失
 ...Object.fromEntries([['pAbsorb','攻擊吸收','受到的下一次物理攻擊變成回復生命'],['mAbsorb','魔法吸收','受到的下一次攻擊魔法變成回復生命'],
  ['pReflect','攻擊反彈','受到的下一次近身物理攻擊整個彈回給對方（遠攻、氣功彈只會被擋掉）'],['mReflect','魔法反彈','受到的下一次攻擊魔法彈回給施法的人'],
  ['pNull','攻擊無效','接下來兩次物理攻擊不受傷害'],['mNull','魔法無效','接下來兩次攻擊魔法不受傷害']].map(([id,name,what])=>
  [id,{name,kind:'barrier',target:'ally',price:5000,teacher:'wizard',mp:L=>10+10*L,hits:id.endsWith('Null')?2:1,
   desc:L=>`替一名隊友張開屏障，${BARRIER_TURNS[L-1]} 回合內有效：${what}。異常狀態擋不住。`}])),
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
  [[k+'1',{name,kind:'status',st:k,target:'enemy',price:100,teacher:'sorcerer',mp:L=>5*L,desc:L=>`讓敵人${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}],
   [k+'2',{name:'強力'+name,kind:'status',st:k,area:'cross',target:'enemy',price:1000,teacher:'sorcerer',mp:L=>10*L,desc:L=>`讓目標和他前後左右${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}],
   [k+'3',{name:'超強'+name,kind:'status',st:k,area:'all',target:'enemy',price:3000,teacher:'sorcerer',mp:L=>20*L,desc:L=>`讓敵人全體${n}：${what}。成功率約 ${50+5*L}%，持續 ${2+Math.floor(L/3)} 回合。`}]]).flat()),
 // 祈禱：把一名隊友的屬性換成單一屬性（地／水／火／風 10）；屬性反轉：把敵人的屬性翻到對面（地↔火、水↔風）。持續回合照原作表
 ...Object.fromEntries([['earth','大地的祈禱','地'],['water','海洋的祈禱','水'],['fire','火焰的祈禱','火'],['wind','雲群的祈禱','風']].map(([e,name,el])=>
  ['pray_'+e,{name,kind:'elemset',elem:e,target:'ally',price:5000,teacher:'sorcerer',mp:L=>11+4*L,desc:L=>`把一名隊友的屬性變成${el} 10，持續 ${ELEM_TURNS[L-1]} 回合。用來躲開對方剋你的屬性。`}])),
 reverse:{name:'屬性反轉',kind:'elemset',flip:true,target:'enemy',price:5000,teacher:'sorcerer',mp:L=>10+Math.floor(2.5*(L-1)),
  desc:L=>`把一個敵人的屬性翻到對面（地↔火、水↔風），持續 ${ELEM_TURNS[L-1]} 回合。`},
 // 採集（原作的伐木、挖掘、狩獵）：在野外停下來採集，每次耗 1 魔力（◎）。等級越高，能採到越好的材料。
 lumber:{name:'伐木',kind:'gather',price:100,teacher:'lumber',mp:()=>1,desc:L=>`在野外砍樹拿木材。Lv${L} 能採到 ${L} 階以下的木材。`},
 mining:{name:'挖掘',kind:'gather',price:100,teacher:'miner',mp:()=>1,desc:L=>`在野外和洞窟挖礦。Lv${L} 能採到 ${L} 階以下的礦石。`},
 hunting:{name:'狩獵',kind:'gather',price:100,teacher:'hunter',mp:()=>1,desc:L=>`在野外打獵拿肉和毛皮。Lv${L} 能採到 ${L} 階以下的獵物。`},
 // 製造：在工房用材料做裝備，技能等級要 ≥ 裝備等級。耗魔＝裝備等級×10（◎）
 ...Object.fromEntries([['craftSword','鑄劍','劍','smithSword'],['craftAxe','造斧','斧','smithAxe'],['craftSpear','造槍','槍','smithSpear'],['craftBow','造弓','弓','bowyer'],
  ['craftStaff','造杖','杖','staffer'],['craftMail','製鎧','鎧甲與頭盔','armorer'],['craftCloth','裁縫','衣、袍、頭巾、法帽與鞋','tailor'],['medicine','製藥','補生命的藥','pharmacist'],['cookery','料理','補魔力的菜','cook']].map(([id,name,what,teacher])=>
  [id,{name,kind:'craft',price:100,teacher,mp:()=>0,desc:L=>`用材料做${what}。Lv${L} 做得出 ${L} 級以下的東西。`}])),
// 騎士之譽：這回合替生命比自己少的隊友擋近身攻擊，擋的時候防禦變成 110%～200%、不能閃躲；隊友生命超過自己就不擋了
 honor:{name:'騎士之譽',kind:'honor',target:'self',price:6000,teacher:'spear',mp:L=>3+2*L,def:L=>1+.1*L,
  desc:L=>`這回合替生命比你少的隊友擋下近身攻擊（遠攻、魔法擋不了），擋的時候防禦 ${100+10*L}%、不能閃躲，照樣會反擊。`},
 // 攻擊魔法防禦：不耗魔，這回合受到的攻擊魔法隨機剩 1 點或 10%～50%，但物理攻擊閃不掉
 mguard:{name:'攻擊魔法防禦',kind:'stance',target:'self',price:100,teacher:'mage',mp:()=>0,
  desc:()=>`這回合擋攻擊魔法：每次魔法傷害隨機變成 1 點或原本的 10%～50%。不耗魔；擋的時候閃不掉物理攻擊。`},
 // 因果報應：迴力鏢的招（這裡沒有迴力鏢，◎ 不限武器），傷害三段隨機，自己也受反噬
 karma:{name:'因果報應',kind:'phys',target:'enemy',melee:false,price:6000,teacher:'beastmaster',mp:L=>6+4*L,
  mult:L=>(.7+.05*(L-1)),self:L=>14+L,
  desc:L=>{const m=70+5*(L-1);return `遠距離一擊，傷害隨機是普攻的 ${Math.round(m*.8)}%、${m}% 或 ${Math.round(m*1.2)}%；自己受到打出傷害的 ${14+L}%（不會死）。`;}},
 // 偷竊：從魔物身上偷一樣東西（每隻只能偷一次），戰鬥打贏才拿得到；◎ 成功率
 steal:{name:'偷竊',kind:'steal',target:'enemy',price:5000,teacher:'assassin',mp:()=>5,rate:L=>30+5*L,
  desc:L=>`從一隻魔物身上偷東西，成功率 ${30+5*L}%（每隻只能偷到一次，打贏才帶得走）。對人沒用。`},
 // 羊頭狗肉：抄對方的攻擊、防禦、敏捷、精神、回復，維持 L 回合
 copycat:{name:'羊頭狗肉',kind:'copycat',target:'enemy',price:6000,teacher:'assassin',mp:L=>2+8*L,
  desc:L=>`把一個敵人的攻擊、防禦、敏捷、精神、回復抄到自己身上，維持 ${L} 回合。`},
 // 精神衝擊波：打目標那一整排，魔法加物理的混合傷害；排上的敵人越多，每人分到的越少（◎）
 psy:{name:'精神衝擊波',kind:'psy',target:'enemy',price:6000,teacher:'mage',mp:L=>20*L,
  desc:L=>`衝擊目標那一整排（前排或後排）的敵人，魔法和物理各半的傷害（Lv${L}）；那排人越多，每人受到的越少。`},
 // 忍者的狀態抵抗（被動，不用放）：被下異常時成功率 −4%×等級、持續少 等級/4 回合（◎）；被下咒時會累積熟練度
 ...Object.fromEntries([['poison','中毒','百毒不侵'],['sleep','昏睡','懸樑刺股'],['stone','石化','鏡盾反射'],['confuse','混亂','亂中有序'],['drunk','酒醉','眾人皆醉我獨醒'],['forget','遺忘','永生難忘']].map(([k,n])=>
  [k+'Res',{name:n+'抵抗',kind:'passive',resist:k,price:5000,teacher:'assassin',mp:()=>0,desc:L=>`被動：別人對你下${n}時，成功率 −${4*L}%、持續少 ${Math.floor(L/4)} 回合。被下咒就會累積熟練度。`}])),
 // 虛死為上（被動）：逃跑失敗時有機會裝死，騙過敵人逃掉（◎ 機率）
 playdead:{name:'虛死為上',kind:'passive',price:6000,teacher:'guard',mp:()=>0,rate:L=>10+4*L,
  desc:L=>`被動：逃跑失敗時，有 ${10+4*L}% 機率倒地裝死騙過敵人，照樣逃掉。`},
 revive:{name:'氣絕回復',kind:'revive',target:'dead',price:100,teacher:'priest',mp:L=>5*L,
  desc:L=>`戰鬥中讓一名氣絕的隊友復活，並回復 ${60*L} 生命。`},
};
// 技能限定的武器（weapons 沒寫就不限）；空手算 fist
export const weaponOk=(u,id)=>!SKILLS[id]?.weapons||SKILLS[id].weapons.includes(u.weaponType||'fist');
// 屏障、屬性變化的持續回合（照原作 1～10 級：2,3,3,4,4,5,5,6,6,7）
export const BARRIER_TURNS=[2,3,3,4,4,5,5,6,6,7],ELEM_TURNS=BARRIER_TURNS;
export const MAGIC_IDS=['earth1','water1','fire1','wind1'];
export const STATUS_NAMES={poison:'中毒',sleep:'昏睡',stone:'石化',confuse:'混亂',drunk:'酒醉',forget:'遺忘'};
// 技能經驗：Lv1→10 累積門檻
export const SKILL_EXP=[0,1800,7200,19800,45000,82800,133200,183600,246600,322200];
export const SKILL_EXP_PER_USE=20; // ◎ 每次使用得「20 × 敵方平均等級」
export const SKILL_SLOTS=10;
