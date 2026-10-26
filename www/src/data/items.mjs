// 道具與裝備。lv 是裝備等級（職階決定能穿到幾級，見 jobs.mjs GEAR_CAP）。賣價＝買價一半，魔石另訂。
// kind：use 消耗品、key 任務道具、weapon 武器、armor 防具、crystal 魔石（怪物掉落，拿去道具店換錢，照原作）
export const ITEMS={
 painkiller:{name:'止痛藥',kind:'key',price:3,desc:'醫院賣的藥。職業公會的人正需要它。'},
 trialPass:{name:'試煉通行證',kind:'key',price:0,desc:'給試煉洞窟守衛看，就能進洞。'},
 letterSword:{name:'劍士推薦信',kind:'key',price:0,desc:'拿給劍士公會的導師就能就職劍士。'},
 letterAxe:{name:'戰斧鬥士推薦信',kind:'key',price:0,desc:'拿給戰斧鬥士公會的導師就能就職戰斧鬥士。'},
 letterSpear:{name:'騎士推薦信',kind:'key',price:0,desc:'拿給騎士團長就能就職騎士。'},
 letterBow:{name:'弓箭手推薦信',kind:'key',price:0,desc:'拿給弓箭手公會的導師就能就職弓箭手。'},
 letterFist:{name:'格鬥士推薦信',kind:'key',price:0,desc:'拿給格鬥士道場的導師就能就職格鬥士。'},
 letterDagger:{name:'忍者推薦信',kind:'key',price:0,desc:'拿給忍者頭目就能就職忍者。'},
 letterGuard:{name:'士兵推薦信',kind:'key',price:0,desc:'拿給士兵隊長就能就職士兵。'},
 letterStaff:{name:'魔術師推薦信',kind:'key',price:0,desc:'拿給魔術師、咒術師或巫師的導師就能就職。'},
 treantSap:{name:'樹精長老的樹心',kind:'key',price:0,desc:'打倒樹精長老的證明，晉級正職要用。'},
 tigerFang:{name:'神獸之牙',kind:'key',price:0,desc:'打倒咆哮的神獸的證明，晉級王宮職要用。'},
 curseSeal:{name:'詛咒的封印',kind:'key',price:0,desc:'打倒詛咒之王的證明，晉級師範要用。'},
 // 藥照原作行情 1 點生命 1 金（原作醫院賣的生命力回復藥 75 點 75 金，比醫院補血貴一倍）；◎ 食物比照醫院補魔 1 點 1 金。自己做的藥、菜賣半價
 potion:{name:'回復藥',kind:'use',price:100,hp:100,battle:true,desc:'回復 100 生命。'},
 potion2:{name:'高級回復藥',kind:'use',price:300,hp:300,battle:true,desc:'回復 300 生命。'},
 bun:{name:'麵包',kind:'use',price:100,mp:100,battle:false,desc:'回復 100 魔力（戰鬥中不能吃）。'},
 // 藥劑師做的藥、廚師做的菜（商店不賣）：藥補生命、菜補魔力，照原作分工（◎ 回復量自訂）
 potion3:{name:'特效藥',kind:'use',price:600,hp:600,battle:true,desc:'回復 600 生命。藥劑師才做得出來。'},
 potion4:{name:'靈藥',kind:'use',price:1000,hp:1000,battle:true,desc:'回復 1000 生命。藥劑師才做得出來。'},
 roast:{name:'烤肉',kind:'use',price:100,mp:100,battle:false,desc:'回復 100 魔力（戰鬥中不能吃）。'},
 meatBun:{name:'三明治',kind:'use',price:250,mp:250,battle:false,desc:'回復 250 魔力（戰鬥中不能吃）。'},
 hotpot:{name:'燉肉',kind:'use',price:450,mp:450,battle:false,desc:'回復 450 魔力（戰鬥中不能吃）。'},
 feast:{name:'豪華大餐',kind:'use',price:800,mp:800,battle:false,desc:'回復 800 魔力（戰鬥中不能吃）。'},
 // 魔石賣價照原作的行情隨魔物等級升高（原作：靈堂約 96、海底洞窟 108～124、雪山與神獸迷宮 200～230）；分六級、名稱與分界 ◎；2026-10-24 照帶寵物的玩法（economy.mjs PET=1）大魔石以上再降一成五（小、中魔石不降，不然魔術師前期沒錢補魔會一路輸）
 crystalS:{name:'小魔石',kind:'crystal',sell:45,desc:'魔物身上的結晶（1～5 級魔物），道具店收購。'},
 crystalM:{name:'中魔石',kind:'crystal',sell:140,desc:'魔物身上的結晶（6～14 級魔物），道具店收購。'},
 crystalL:{name:'大魔石',kind:'crystal',sell:187,desc:'魔物身上的結晶（15～24 級魔物），道具店收購。'},
 crystalXL:{name:'特大魔石',kind:'crystal',sell:195,desc:'魔物身上的結晶（25～39 級魔物），道具店收購。'},
 crystalXXL:{name:'極大魔石',kind:'crystal',sell:340,desc:'魔物身上的結晶（40～49 級魔物），道具店收購。'},
 crystalX3:{name:'巨大魔石',kind:'crystal',sell:357,desc:'魔物身上的結晶（50 級以上魔物），道具店收購。'},
 // 材料：採集得到，tier 是階級（採集技能等級要夠），賣價照原作一樣很低（◎）。之後製造職業會用到。
 pine:{name:'松木',kind:'material',tier:1,sell:3,desc:'最常見的木材。'},
 herb:{name:'草藥',kind:'material',tier:1,sell:3,desc:'伐木時順手採的藥草，做藥的基本材料。'},
 ginseng:{name:'鼠尾草',kind:'material',tier:2,sell:7,desc:'補氣的好藥材。'},
 lingzhi:{name:'百里香',kind:'material',tier:4,sell:20,desc:'稀有的藥草，傳說能救命。'},
 oak:{name:'橡木',kind:'material',tier:2,sell:6,desc:'堅硬的木材，適合做杖和弓。'},
 cypress:{name:'柏木',kind:'material',tier:3,sell:11,desc:'帶著香氣的好木材。'},
 ebony:{name:'黑檀木',kind:'material',tier:4,sell:18,desc:'名貴的木材。'},
 copper:{name:'銅礦',kind:'material',tier:1,sell:4,desc:'煉成銅就能打造兵器。'},
 ironOre:{name:'鐵礦',kind:'material',tier:2,sell:8,desc:'煉成鐵就能打造兵器。'},
 silver:{name:'銀礦',kind:'material',tier:3,sell:14,desc:'少見的礦石。'},
 goldOre:{name:'金礦',kind:'material',tier:4,sell:22,desc:'閃閃發亮的礦石。'},
 meat:{name:'獸肉',kind:'material',tier:1,sell:3,desc:'可以拿來做菜。'},
 hide:{name:'獸皮',kind:'material',tier:1,sell:4,desc:'做衣服、靴子、弓弦都用得到。'},
 marten:{name:'貂皮',kind:'material',tier:2,sell:8,desc:'又輕又暖的毛皮。'},
 antler:{name:'鹿角',kind:'material',tier:3,sell:12,desc:'可以拿來入藥。'},
 tigerSkin:{name:'虎皮',kind:'material',tier:4,sell:20,desc:'威風的上等毛皮。'},
 // 國民裝備（原作法蘭城就有賣，150 金、頭盔 75 金）：很弱但便宜，剛來的冒險者先用這個（數值照原作比例換算 ◎）
 swordN:{name:'國民劍',kind:'weapon',slot:'weapon',type:'sword',lv:1,price:150,atk:4,cheap:true},
 axeN:{name:'國民斧',kind:'weapon',slot:'weapon',type:'axe',lv:1,price:150,atk:5,def:-1,agi:-1,cheap:true},
 spearN:{name:'國民槍',kind:'weapon',slot:'weapon',type:'spear',lv:1,price:150,atk:3,cheap:true},
 bowN:{name:'國民弓',kind:'weapon',slot:'weapon',type:'bow',lv:1,price:150,atk:5,ranged:true,cheap:true},
 staffN:{name:'國民杖',kind:'weapon',slot:'weapon',type:'staff',lv:1,price:150,atk:2,spr:2,matk:2,cheap:true},
 daggerN:{name:'國民小刀',kind:'weapon',slot:'weapon',type:'dagger',lv:1,price:150,atk:2,agi:2,cheap:true},
 mailN:{name:'國民鎧',kind:'armor',slot:'body',armor:'heavy',lv:1,price:150,def:5,cheap:true},
 helmN:{name:'國民盔',kind:'armor',slot:'head',armor:'heavy',lv:1,price:75,def:2,cheap:true},
 // 武器：type 決定職業與必殺、反擊（斧必殺×4、槍反擊×4），弓是遠距離（不會被反擊）
 swordC:{name:'銅劍',kind:'weapon',slot:'weapon',type:'sword',lv:1,price:200,atk:20},
 swordI:{name:'鐵劍',kind:'weapon',slot:'weapon',type:'sword',lv:2,price:600,atk:35},
 swordS:{name:'鋼劍',kind:'weapon',slot:'weapon',type:'sword',lv:3,price:1500,atk:50},
 axeC:{name:'銅斧',kind:'weapon',slot:'weapon',type:'axe',lv:1,price:200,atk:24,agi:-2},
 axeI:{name:'鐵斧',kind:'weapon',slot:'weapon',type:'axe',lv:2,price:650,atk:40,agi:-3},
 spearC:{name:'銅槍',kind:'weapon',slot:'weapon',type:'spear',lv:1,price:200,atk:21},
 spearI:{name:'鐵槍',kind:'weapon',slot:'weapon',type:'spear',lv:2,price:620,atk:37},
 // 小刀（忍者用）：攻擊低一點，加敏捷（◎）
 daggerC:{name:'小刀',kind:'weapon',slot:'weapon',type:'dagger',lv:1,price:200,atk:15,agi:6},
 daggerI:{name:'鐵小刀',kind:'weapon',slot:'weapon',type:'dagger',lv:2,price:600,atk:28,agi:10},
 daggerS:{name:'鋼小刀',kind:'weapon',slot:'weapon',type:'dagger',lv:3,price:1500,atk:40,agi:14},
 bowW:{name:'木弓',kind:'weapon',slot:'weapon',type:'bow',lv:1,price:200,atk:16,ranged:true},
 bowH:{name:'獵弓',kind:'weapon',slot:'weapon',type:'bow',lv:2,price:600,atk:30,ranged:true},
 staffS:{name:'短杖',kind:'weapon',slot:'weapon',type:'staff',lv:1,price:200,atk:5,matk:12,spr:4},
 staffO:{name:'橡木杖',kind:'weapon',slot:'weapon',type:'staff',lv:2,price:600,atk:9,matk:40,spr:8},
 staffJ:{name:'水晶杖',kind:'weapon',slot:'weapon',type:'staff',lv:3,price:1500,atk:13,matk:70,spr:12},
 // 防具：armor 是鎧（heavy）、衣（light）、袍（robe）三類，照原作各職業能穿的不同
 mailL:{name:'皮甲',kind:'armor',slot:'body',armor:'heavy',lv:1,price:180,def:12},
 mailI:{name:'鐵甲',kind:'armor',slot:'body',armor:'heavy',lv:2,price:560,def:24,agi:-2},
 clothC:{name:'布衣',kind:'armor',slot:'body',armor:'light',lv:1,price:150,def:8,agi:2},
 clothH:{name:'獵裝',kind:'armor',slot:'body',armor:'light',lv:2,price:480,def:16,agi:3},
 robeC:{name:'布袍',kind:'armor',slot:'body',armor:'robe',lv:1,price:150,def:6,spr:4},
 robeS:{name:'絲袍',kind:'armor',slot:'body',armor:'robe',lv:2,price:480,def:12,spr:8},
 helmL:{name:'皮盔',kind:'armor',slot:'head',armor:'heavy',lv:1,price:120,def:5},
 hoodC:{name:'頭巾',kind:'armor',slot:'head',armor:'light',lv:1,price:80,def:3},
 hatR:{name:'法帽',kind:'armor',slot:'head',armor:'robe',lv:1,price:80,def:2,spr:3},
 // 商店買不到、只能由工匠做的裝備（◎ 數值自訂，照商店裝備的成長往上推）
 swordG:{name:'騎士劍',kind:'weapon',slot:'weapon',type:'sword',lv:4,price:3600,atk:68,craft:true},
 axeS:{name:'鋼斧',kind:'weapon',slot:'weapon',type:'axe',lv:3,price:1600,atk:56,agi:-3,craft:true},
 axeG:{name:'巨斧',kind:'weapon',slot:'weapon',type:'axe',lv:4,price:3800,atk:76,agi:-4,craft:true},
 spearS:{name:'鋼槍',kind:'weapon',slot:'weapon',type:'spear',lv:3,price:1550,atk:52,craft:true},
 spearG:{name:'騎士長槍',kind:'weapon',slot:'weapon',type:'spear',lv:4,price:3700,atk:71,craft:true},
 bowC:{name:'複合弓',kind:'weapon',slot:'weapon',type:'bow',lv:3,price:1500,atk:44,ranged:true,craft:true},
 bowG:{name:'長弓',kind:'weapon',slot:'weapon',type:'bow',lv:4,price:3600,atk:60,ranged:true,craft:true},
 staffG:{name:'星之杖',kind:'weapon',slot:'weapon',type:'staff',lv:4,price:3600,atk:17,matk:100,spr:16,craft:true},
 mailS:{name:'鋼甲',kind:'armor',slot:'body',armor:'heavy',lv:3,price:1400,def:36,agi:-3,craft:true},
 mailG:{name:'騎士鎧',kind:'armor',slot:'body',armor:'heavy',lv:4,price:3400,def:50,agi:-3,craft:true},
 helmI:{name:'鐵盔',kind:'armor',slot:'head',armor:'heavy',lv:2,price:400,def:9,craft:true},
 clothM:{name:'毛皮大衣',kind:'armor',slot:'body',armor:'light',lv:3,price:1200,def:25,agi:4,craft:true},
 robeG:{name:'魔導長袍',kind:'armor',slot:'body',armor:'robe',lv:3,price:1200,def:18,spr:13,craft:true},
 bootT:{name:'獸皮靴',kind:'armor',slot:'feet',lv:3,price:900,def:9,agi:3,craft:true},
 bootL:{name:'皮靴',kind:'armor',slot:'feet',lv:1,price:100,def:4},
 sandal:{name:'布鞋',kind:'armor',slot:'feet',lv:1,price:60,def:2,agi:2},
};
// 盾照原作是獨立的一格（目前只有文字版擂台做得出盾，見 mud/dungeon.mjs）
export const SLOTS=['weapon','shield','head','body','feet'];
export const SLOT_NAMES={weapon:'武器',shield:'盾',head:'頭',body:'身體',feet:'腳'};
export const WEAPON_TYPE_NAMES={sword:'劍',axe:'斧',spear:'槍',bow:'弓',staff:'杖',dagger:'小刀'};
// 裝備價錢照原作商店行情：武器、身體 1～6 級 1500／3000／6000／15000／30000／35000，頭、腳 750／2250／4500／15000／30000／35000（國民裝備除外）
const GEAR_PRICE={main:[1500,3000,6000,15000,30000,35000],small:[750,2250,4500,15000,30000,35000]};
for(const it of Object.values(ITEMS))if(it.slot&&!it.cheap)it.price=GEAR_PRICE[['head','feet','shield'].includes(it.slot)?'small':'main'][it.lv-1];
// 賣給商店：裝備比照原作卡片、圖鑑賣店公式 (等級+1)²×10（◎ 原作裝備賣價查不到），其他東西半價
export const sellPrice=id=>{const it=ITEMS[id];return it.sell??(it.slot?(it.lv+1)**2*10:Math.floor((it.price||0)/2));};
export const SHOPS={
 weapon:{name:'武器店',keeper:'武器店老闆',stock:['swordN','axeN','spearN','bowN','staffN','daggerN','swordC','swordI','swordS','axeC','axeI','spearC','spearI','daggerC','daggerI','daggerS','bowW','bowH','staffS','staffO','staffJ']},
 armor:{name:'防具店',keeper:'防具店老闆',stock:['mailN','helmN','mailL','mailI','clothC','clothH','robeC','robeS','helmL','hoodC','hatR','bootL','sandal']},
 goods:{name:'道具店',keeper:'道具店老闆',stock:['potion','potion2','bun']},
 // 工房師傅做好的成品（◎ 原作要跟玩家工匠買，單機改成師傅賣，價錢照商店行情，比自己採材料做貴得多）
 smithy:{name:'工房',keeper:'工房師傅',stock:[]},
};
SHOPS.smithy.stock=Object.keys(ITEMS).filter(id=>ITEMS[id].craft);
