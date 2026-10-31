// 職業：系統照原作（見習→正職→王宮→師範→大師）。名稱照台版魔力寶貝；原作沒有的導師名、公會名是自訂的（◎）。
// promoteBy：'level' 看人物等級（20/50/70/95），否則看該技能等級（4/6/8/10）。
export const RANK_LEVEL=[0,20,50,70,95];
export const RANK_SKILL=[0,4,6,8,10];
// 晉級需要的聲望（戰鬥系）：呢喃的歌聲、蒼之風雲、歡喜的慈雨、敬畏的寂靜
export const RANK_REP=[0,10000,50000,100000,160000];
export const RANK_QUEST=[null,'treant','beast','curse','oath'];
// 技能等級上限，依職階
export const CAPS={main:[4,6,8,10,10],sub:[4,4,5,6,7],magicPhys:[2,2,2,2,3],none:[0,0,0,0,0]};
// 主武器、主防具的裝備等級上限
export const GEAR_CAP=[4,6,8,10,11];
export const PROMOTE_FEE=[0,1000,5000,10000,20000]; // ◎ 原版金額未證實，用私服資料
export const CHANGE_FEE=1000; // ◎ 轉職費自訂

const PHYS=['combo','allin','blade','swift','volley'],MAGIC=['earth','water','fire','wind'].flatMap(e=>[e+'1',e+'2',e+'3']),HOLY=['heal','heal2','heal3','cure','revive'],
 CURSE=['poison1','sleep1','stone1','confuse1','drunk1','forget1'],
 CURSE_X=['poison','sleep','stone','confuse','drunk','forget'].flatMap(k=>[k+'2',k+'3']),PRAYER=['pray_earth','pray_water','pray_fire','pray_wind','reverse'],
 BARRIER=['pAbsorb','mAbsorb','pReflect','mReflect','pNull','mNull'],RESIST=['poison','sleep','stone','confuse','drunk','forget'].map(k=>k+'Res');
// 不分職業、戰鬥系都學得到（上限比照副技能）
export const ANY_JOB=['mguard','playdead','psy'];
export const JOBS={
 none:{name:'遊民',cg:'遊民',ranks:['遊民'],weapons:['sword','axe','spear','bow','staff'],armor:['heavy','light','robe'],main:[],sub:[]},
 sword:{shield:'main',name:'劍士',cg:'劍士',mentor:'劍士導師',hall:'劍士公會',weapon:'sword',weapons:['sword'],armor:['heavy'],promoteBy:'level',
  ranks:['見習劍士','劍士','王宮劍士','劍士師範','劍士大師'],main:['combo','allin','swift'],sub:['blade','volley'],letter:'letterSword'},
 axe:{shield:'main',name:'戰斧鬥士',cg:'戰斧鬥士',mentor:'戰斧導師',hall:'戰斧鬥士公會',weapon:'axe',weapons:['axe'],armor:['heavy'],promoteBy:'level',
  ranks:['見習戰斧鬥士','戰斧鬥士','王宮戰斧鬥士','戰斧鬥士師範','戰斧鬥士大師'],main:['combo','allin','blade'],sub:['swift','volley'],letter:'letterAxe'},
 spear:{shield:'main',name:'騎士',cg:'騎士',mentor:'騎士團長',hall:'騎士團',weapon:'spear',weapons:['spear'],armor:['heavy'],promoteBy:'level',
  ranks:['見習騎士','騎士','王宮騎士','騎士師範','騎士大師'],main:['blade','combo','honor'],sub:['allin','swift','volley'],letter:'letterSpear'},
 bow:{shield:[3,3,3,3,4],name:'弓箭手',cg:'弓箭手',mentor:'弓箭手導師',hall:'弓箭手公會',weapon:'bow',weapons:['bow'],armor:['light'],promoteBy:'level',
  ranks:['見習弓箭手','弓箭手','王宮弓箭手','弓箭手師範','弓箭手大師'],main:['volley'],sub:['combo','allin','blade','swift'],letter:'letterBow'},
 mage:{name:'魔術師',cg:'魔術師',mentor:'魔術師導師',hall:'魔術師公會',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習魔術師','魔術師','王宮魔術師','魔術師師範','魔術師大師'],main:MAGIC,sub:[...PHYS,...HOLY,...CURSE],letter:'letterStaff'},
 // 格鬥士：不拿武器，空手打；空手去找試煉官就給推薦信
 fighter:{name:'格鬥士',cg:'格鬥士',mentor:'格鬥士導師',hall:'格鬥士道場',weapon:'fist',weapons:[],armor:['light'],promoteBy:'level',
  ranks:['見習格鬥士','格鬥士','王宮格鬥士','格鬥士師範','格鬥士大師'],main:['qigong','smash','meditate'],sub:['combo','allin','blade','swift'],letter:'letterFist'},
 // 士兵：劍斧槍都能用，護住隊友、死守陣地；穿著鎧甲、拿劍斧槍去找試煉官，會多給一封士兵推薦信（◎）
 guard:{shield:[3,4,5,6,7],name:'士兵',cg:'士兵',mentor:'士兵隊長',hall:'士兵營',weapon:'sword',weapons:['sword','axe','spear'],armor:['heavy'],promoteBy:'level',
  ranks:['見習士兵','士兵','王宮士兵','士兵師範','士兵大師'],main:['cover','wall'],sub:['combo','allin','blade','swift','steal'],letter:'letterGuard'},
 // 忍者：用小刀，出手快
 assassin:{name:'忍者',cg:'忍者',mentor:'忍者頭目',hall:'忍者之家',weapon:'dagger',weapons:['dagger'],armor:['light'],promoteBy:'level',
  ranks:['見習忍者','忍者','王宮忍者','忍者師範','忍者大師'],main:['kill','venom',...RESIST],sub:['combo','swift','volley','steal','copycat'],letter:'letterDagger'},
 // 巫師：吸取生命、持續回復；跟魔術師拿同一封推薦信
 wizard:{name:'巫師',cg:'巫師',mentor:'巫師導師',hall:'巫師之家',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習巫師','巫師','王宮巫師','巫師師範','巫師大師'],main:['drain','regen','regen2','regen3',...BARRIER],sub:[...PHYS,...MAGIC,...HOLY,...CURSE,'copycat'],letter:'letterStaff'},
 // 封印師：封印魔物當寵物；馴獸師：帶寵物作戰。這兩行不用推薦信，直接拜師（◎）
 sealer:{shield:[3,3,4,4,5],name:'封印師',cg:'封印師',mentor:'封印師導師',hall:'封印師之家',weapon:'dagger',weapons:['dagger','staff'],armor:['light','robe'],promoteBy:'level',free:true,
  ranks:['見習封印師','封印師','王宮封印師','封印師師範','封印師大師'],main:['seal'],sub:['combo','venom','poison1','sleep1']},
 beastmaster:{shield:[3,3,4,4,5],name:'馴獸師',cg:'馴獸師',mentor:'馴獸師導師',hall:'馴獸師之家',weapon:'dagger',weapons:['dagger','sword'],armor:['light'],promoteBy:'level',free:true,
  ranks:['見習馴獸師','馴獸師','王宮馴獸師','馴獸師師範','馴獸師大師'],main:['rally','seal','karma'],sub:['combo','swift','heal']},
 // 咒術師：用杖，跟魔術師拿同一封推薦信
 sorcerer:{name:'咒術師',cg:'咒術師',mentor:'咒術師導師',hall:'咒術師之家',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習咒術師','咒術師','王宮咒術師','咒術師師範','咒術師大師'],main:[...CURSE,...CURSE_X,...PRAYER],sub:[...PHYS,...MAGIC,...HOLY,'copycat'],letter:'letterStaff'},
 priest:{name:'傳教士',cg:'傳教士',mentor:'神父',hall:'教會',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'heal',
  ranks:['見習傳教士','傳教士','王宮傳教士','傳教士師範','傳教士大師'],main:[...HOLY,...CURSE,...CURSE_X,...PRAYER],sub:[...PHYS,...MAGIC,'copycat'],quiz:true}, // 咒術師併進來（Leo 2026-10-26）：咒術全歸傳教士本行,
 // 採集系（原作樵夫、礦工、獵人）：不用推薦信，到採集者公會直接就職（◎）；晉級看採集技能等級與聲望，不用晉級任務
 lumber:{name:'樵夫',cg:'樵夫',mentor:'老樵夫',hall:'採集者公會',gather:true,weapons:['axe'],armor:['light'],promoteBy:'lumber',
  ranks:['見習樵夫','樵夫','王宮樵夫','樵夫師範','樵夫大師'],main:['lumber'],sub:['mining','hunting']},
 miner:{name:'礦工',cg:'礦工',mentor:'礦工頭目',hall:'採集者公會',gather:true,weapons:['axe'],armor:['light'],promoteBy:'mining',
  ranks:['見習礦工','礦工','王宮礦工','礦工師範','礦工大師'],main:['mining'],sub:['lumber','hunting']},
 hunter:{name:'獵人',cg:'獵人',mentor:'老獵人',hall:'採集者公會',gather:true,weapons:['bow'],armor:['light'],promoteBy:'hunting',
  ranks:['見習獵人','獵人','王宮獵人','獵人師範','獵人大師'],main:['hunting'],sub:['lumber','mining']},
 // 製造系（原作鑄劍工、造斧工……）：不用推薦信，到工房直接就職（◎）；晉級看製造技能等級與聲望
 ...Object.fromEntries([['smithSword','鑄劍工','craftSword','sword'],['smithAxe','造斧工','craftAxe','axe'],['smithSpear','造槍工','craftSpear','spear'],['bowyer','造弓工','craftBow','bow'],
  ['staffer','造杖工','craftStaff','staff'],['armorer','鎧甲工','craftMail','sword'],['tailor','裁縫工','craftCloth','bow'],
  ['pharmacist','藥劑師','medicine','staff','老藥師'],['cook','廚師','cookery','axe','大廚']].map(([id,name,sk,w,m])=>[id,{name,cg:name,mentor:m||name.replace('工','師傅'),hall:'工房',craft:true,gather:true,
  weapons:[w],armor:['light'],promoteBy:sk,ranks:['見習'+name,name,'王宮'+name,name+'師範',name+'大師'],main:[sk],sub:['lumber','mining','hunting']}])),
 // 醫療系（原作醫生、護士）：不用推薦信，在醫院拜師（◎）。技能在城外、戰鬥外用：醫生治受傷，護士替人補血。晉級看專職技能等級與聲望
 doctor:{name:'醫生',cg:'醫生',mentor:'醫生導師',hall:'醫院',gather:true,free:true,weapons:['staff','dagger'],armor:['robe','light'],promoteBy:'treat',
  ranks:['見習醫生','醫生','王宮醫生','醫生師範','醫生大師'],main:['treat'],sub:['firstaid','heal','cure','lumber','mining','hunting']},
 nurse:{name:'護士',cg:'護士',mentor:'護士長',hall:'醫院',gather:true,free:true,weapons:['staff','dagger'],armor:['robe','light'],promoteBy:'firstaid',
  ranks:['見習護士','護士','王宮護士','護士師範','護士大師'],main:['firstaid'],sub:['treat','heal','cure','lumber','mining','hunting']},
};
export const MEDIC_JOBS=['doctor','nurse'];
export const COMBAT_JOBS=['sword','axe','spear','bow','fighter','guard','assassin','wizard','sealer','beastmaster','mage','sorcerer','priest'];
export const GATHER_JOBS=['lumber','miner','hunter'];
export const GATHER_SKILLS=['lumber','mining','hunting'];
export const CRAFT_JOBS=['smithSword','smithAxe','smithSpear','bowyer','staffer','armorer','tailor','pharmacist','cook'];
export const CRAFT_SKILLS=['craftSword','craftAxe','craftSpear','craftBow','craftStaff','craftMail','craftCloth','medicine','cookery'];

// 戰鬥系職業的物理技能上限，照蔚藍幻境各職業頁的「戰鬥技能上限」表（見習→大師；沒列的＝學不了）。本行技能（main）照舊用 CAPS.main
const M=[4,6,8,10,10],H=[4,4,5,6,7],Q=[3,4,5,6,7],T=[2,3,4,4,5],G=[2,3,4,5,6],N=[2,4,5,6,7],B5=[4,4,4,4,5];
export const PHYS_SKILLS=['combo','moon','allin','haze','volley','qigong','blade','smash','counter','terror','wall','cover','meditate','kill','chaos','twobird','focus','swift','venom','sure'];
export const PHYS_CAPS={
   sword:{combo:M,moon:[0,0,0,8,10],allin:M,haze:M,qigong:T,blade:M,smash:H,counter:H,terror:H,wall:M,cover:H,meditate:M,twobird:H,focus:Q,swift:M,venom:T,sure:Q},
   axe:{combo:M,moon:[0,0,0,6,8],allin:M,haze:H,qigong:T,blade:M,smash:M,counter:H,terror:M,wall:H,cover:H,meditate:M,twobird:H,focus:M,swift:Q,venom:T,sure:Q},
   spear:{combo:M,moon:[0,0,0,6,8],allin:M,haze:H,qigong:T,blade:M,smash:H,counter:M,terror:H,wall:H,cover:M,meditate:M,twobird:M,focus:Q,swift:Q,venom:T,sure:Q},
   bow:{combo:B5,allin:B5,haze:M,volley:M,qigong:T,blade:B5,smash:B5,counter:B5,terror:B5,wall:B5,cover:M,meditate:M,twobird:[0,1,2,3,4],focus:[0,1,2,3,4],swift:[0,1,2,3,4],venom:Q,sure:M},
   guard:{combo:G,allin:G,haze:G,volley:[2,3,3,3,4],qigong:G,blade:G,smash:G,counter:G,terror:G,wall:G,cover:G,meditate:G,kill:[2,3,3,3,4],chaos:T,twobird:G,focus:[3,4,5,5,6],swift:Q,venom:Q,sure:G},
   fighter:{allin:[0,0,0,0,3],haze:M,qigong:M,smash:M,counter:M,terror:M,cover:M,meditate:M,chaos:M,twobird:[0,0,0,0,4],focus:M,swift:[2,4,5,6,7]},
   assassin:{combo:N,allin:N,haze:M,qigong:N,blade:N,smash:N,counter:N,terror:N,cover:N,meditate:N,kill:M,twobird:N,focus:N,swift:Q,venom:M,sure:M},
};
// 其他技能（魔法、防禦魔法攻擊、因果報應、騎士之譽、偷竊、抵抗、羊頭狗肉、精神衝擊波）的上限，照蔚藍幻境各職業頁的「魔法／其他技能上限」表；
// 魔法職業的戰鬥技能也在這裡（物理職業的戰鬥技能看上面的 PHYS_CAPS）。沒列的職業（封印師、馴獸師）照舊用 CAPS 推
export const SKILL_TABLE={
 'sword':{steal:[0,0,0,0,0],mguard:[1,1,1,1,1],karma:[1,2,3,4,5],honor:[3,4,5,6,7],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[2,2,2,2,3],water1:[2,2,2,2,3],fire1:[2,2,2,2,3],wind1:[2,2,2,2,3],earth2:[2,2,2,2,3],water2:[2,2,2,2,3],fire2:[2,2,2,2,3],wind2:[2,2,2,2,3],earth3:[2,2,2,2,3],water3:[2,2,2,2,3],fire3:[2,2,2,2,3],wind3:[2,2,2,2,3],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[0,0,0,0,0],psy:[0,0,0,0,0]},
 'axe':{steal:[0,0,0,0,0],mguard:[1,1,1,1,1],karma:[2,2,3,4,5],honor:[3,4,5,6,7],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[2,2,2,2,3],water1:[2,2,2,2,3],fire1:[2,2,2,2,3],wind1:[2,2,2,2,3],earth2:[2,2,2,2,3],water2:[2,2,2,2,3],fire2:[2,2,2,2,3],wind2:[2,2,2,2,3],earth3:[2,2,2,2,3],water3:[2,2,2,2,3],fire3:[2,2,2,2,3],wind3:[2,2,2,2,3],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[0,0,0,0,0],psy:[0,0,0,0,0]},
 'spear':{steal:[0,0,0,0,0],mguard:[1,1,1,1,1],karma:[1,2,3,4,5],honor:[4,6,8,10,10],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[2,2,2,2,3],water1:[2,2,2,2,3],fire1:[2,2,2,2,3],wind1:[2,2,2,2,3],earth2:[2,2,2,2,3],water2:[2,2,2,2,3],fire2:[2,2,2,2,3],wind2:[2,2,2,2,3],earth3:[2,2,2,2,3],water3:[2,2,2,2,3],fire3:[2,2,2,2,3],wind3:[2,2,2,2,3],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[0,0,0,0,0],psy:[0,0,0,0,0]},
 'bow':{steal:[0,0,0,0,0],mguard:[1,1,1,1,1],karma:[2,2,3,4,5],honor:[4,4,4,4,4],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[2,2,2,2,3],water1:[2,2,2,2,3],fire1:[2,2,2,2,3],wind1:[2,2,2,2,3],earth2:[2,2,2,2,3],water2:[2,2,2,2,3],fire2:[2,2,2,2,3],wind2:[2,2,2,2,3],earth3:[2,2,2,2,3],water3:[2,2,2,2,3],fire3:[2,2,2,2,3],wind3:[2,2,2,2,3],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[0,0,0,0,0],psy:[0,0,0,0,0]},
 'guard':{steal:[2,3,3,3,4],mguard:[1,1,1,1,1],karma:[2,3,4,5,6],honor:[2,3,4,5,6],heal:[2,3,4,5,6],heal2:[2,3,4,5,6],heal3:[2,3,4,5,6],revive:[2,3,4,5,6],earth1:[2,3,4,5,6],water1:[2,3,4,5,6],fire1:[2,3,4,5,6],wind1:[2,3,4,5,6],earth2:[2,3,4,5,6],water2:[2,3,4,5,6],fire2:[2,3,4,5,6],wind2:[2,3,4,5,6],earth3:[2,3,4,5,6],water3:[2,3,4,5,6],fire3:[2,3,4,5,6],wind3:[2,3,4,5,6],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,2],pAbsorb:[2,3,4,5,6],mAbsorb:[2,3,4,5,6],pReflect:[2,3,4,5,6],mReflect:[2,3,4,5,6],pNull:[2,3,4,5,6],mNull:[2,3,4,5,6],regen:[2,3,4,5,6],regen2:[2,3,4,5,6],regen3:[2,3,4,5,6],cure:[2,3,4,5,6],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,3,4,5,6],sleepRes:[2,3,4,5,6],stoneRes:[2,3,4,5,6],drunkRes:[2,3,4,5,6],confuseRes:[2,3,4,5,6],forgetRes:[2,3,4,5,6],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[0,0,0,0,0]},
 'fighter':{steal:[0,0,0,0,0],mguard:[1,1,1,1,1],karma:[0,0,0,0,0],honor:[4,6,8,10,10],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[2,2,2,2,3],water1:[2,2,2,2,3],fire1:[2,2,2,2,3],wind1:[2,2,2,2,3],earth2:[2,2,2,2,3],water2:[2,2,2,2,3],fire2:[2,2,2,2,3],wind2:[2,2,2,2,3],earth3:[2,2,2,2,3],water3:[2,2,2,2,3],fire3:[2,2,2,2,3],wind3:[2,2,2,2,3],poison1:[2,2,2,2,3],sleep1:[2,2,2,2,3],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,2,2,2,3],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,2,2,2,3],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,2,2,2,3],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,3,4,4,5],sleepRes:[2,3,4,4,5],stoneRes:[2,3,4,4,5],drunkRes:[2,3,4,4,5],confuseRes:[2,3,4,4,5],forgetRes:[2,3,4,4,5],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[0,0,0,0,0]},
 'assassin':{steal:[2,3,4,4,5],mguard:[1,1,1,1,1],karma:[4,6,7,10,10],honor:[2,4,5,6,7],heal:[2,3,4,4,5],heal2:[2,3,4,4,5],heal3:[2,3,4,4,5],revive:[2,3,4,4,5],earth1:[2,3,4,4,5],water1:[2,3,4,4,5],fire1:[2,3,4,4,5],wind1:[2,3,4,4,5],earth2:[2,3,4,4,5],water2:[2,3,4,4,5],fire2:[2,3,4,4,5],wind2:[2,3,4,4,5],earth3:[2,3,4,4,5],water3:[2,3,4,4,5],fire3:[2,3,4,4,5],wind3:[2,3,4,4,5],poison1:[2,3,4,4,5],sleep1:[2,2,2,2,3],stone1:[2,3,4,4,5],drunk1:[2,3,4,4,5],confuse1:[2,3,4,4,5],forget1:[2,2,2,2,3],poison2:[2,3,4,4,5],sleep2:[2,2,2,2,3],stone2:[2,3,4,4,5],drunk2:[2,3,4,4,5],confuse2:[2,3,4,4,5],forget2:[2,2,2,2,3],poison3:[2,3,4,4,5],sleep3:[2,2,2,2,3],stone3:[2,3,4,4,5],drunk3:[2,3,4,4,5],confuse3:[2,3,4,4,5],forget3:[2,2,2,2,3],drain:[2,3,4,4,5],pAbsorb:[2,3,4,4,5],mAbsorb:[2,3,4,4,5],pReflect:[2,3,4,4,5],mReflect:[2,3,4,4,5],pNull:[2,3,4,4,5],mNull:[2,3,4,4,5],regen:[2,3,4,4,5],regen2:[2,3,4,4,5],regen3:[2,3,4,4,5],cure:[2,3,4,4,5],reverse:[2,3,4,4,5],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[4,6,8,10,10],sleepRes:[4,6,8,10,10],stoneRes:[4,6,8,10,10],drunkRes:[4,6,8,10,10],confuseRes:[4,6,8,10,10],forgetRes:[4,6,8,10,10],playdead:[1,1,1,1,1],copycat:[1,2,3,4,4],psy:[0,0,0,0,0]},
 'mage':{combo:[2,2,2,2,3],moon:[0,0,0,0,0],allin:[2,2,2,2,3],haze:[2,2,2,2,3],volley:[0,0,0,0,0],qigong:[2,2,2,2,3],blade:[2,2,2,2,3],smash:[2,2,2,2,3],counter:[2,2,2,2,3],terror:[2,2,2,2,3],wall:[0,0,0,0,0],cover:[2,2,2,2,3],meditate:[2,2,2,2,3],kill:[0,0,0,0,0],chaos:[0,0,0,0,0],steal:[0,0,0,0,0],mguard:[1,1,1,1,1],twobird:[2,2,2,2,3],focus:[2,2,2,2,3],swift:[2,2,2,2,3],venom:[3,4,5,6,7],sure:[3,4,5,6,7],karma:[0,0,0,0,0],honor:[2,2,2,2,3],heal:[2,2,2,2,3],heal2:[2,2,2,2,3],heal3:[2,2,2,2,3],revive:[2,2,2,2,3],earth1:[4,6,8,10,10],water1:[4,6,8,10,10],fire1:[4,6,8,10,10],wind1:[4,6,8,10,10],earth2:[4,6,8,10,10],water2:[4,6,8,10,10],fire2:[4,6,8,10,10],wind2:[4,6,8,10,10],earth3:[4,6,8,10,10],water3:[4,6,8,10,10],fire3:[4,6,8,10,10],wind3:[4,6,8,10,10],poison1:[2,4,5,6,7],sleep1:[2,2,2,2,3],stone1:[2,4,5,6,7],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,4,5,6,7],poison2:[2,4,5,6,7],sleep2:[2,2,2,2,3],stone2:[2,4,5,6,7],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,4,5,6,7],poison3:[2,4,5,6,7],sleep3:[2,2,2,2,3],stone3:[2,4,5,6,7],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,4,5,6,7],drain:[4,6,8,10,10],pAbsorb:[2,3,4,4,5],mAbsorb:[2,3,4,4,5],pReflect:[2,3,4,4,5],mReflect:[2,3,4,4,5],pNull:[2,3,4,4,5],mNull:[2,3,4,4,5],regen:[2,3,4,4,5],regen2:[2,3,4,4,5],regen3:[2,3,4,4,5],cure:[2,2,2,2,3],reverse:[2,2,2,2,3],pray_earth:[2,2,2,2,3],pray_water:[2,2,2,2,3],pray_fire:[2,2,2,2,3],pray_wind:[2,2,2,2,3],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[2,4,6,8,10]},
 'priest':{combo:[2,2,2,2,3],moon:[0,0,0,0,0],allin:[2,2,2,2,3],haze:[2,2,2,2,3],volley:[0,0,0,0,0],qigong:[2,2,2,2,3],blade:[2,2,2,2,3],smash:[2,2,2,2,3],counter:[2,2,2,2,3],terror:[2,2,2,2,3],wall:[0,0,0,0,0],cover:[2,2,2,2,3],meditate:[2,2,2,2,3],kill:[0,0,0,0,0],chaos:[0,0,0,0,0],steal:[0,0,0,0,0],mguard:[1,1,1,1,1],twobird:[2,2,2,2,3],focus:[2,2,2,2,3],swift:[2,2,2,2,3],venom:[2,4,5,6,7],sure:[2,4,5,6,7],karma:[1,2,3,4,5],honor:[0,0,0,0,0],heal:[4,6,8,10,10],heal2:[4,6,8,10,10],heal3:[4,6,8,10,10],revive:[4,6,8,10,10],earth1:[2,4,5,6,7],water1:[2,4,5,6,7],fire1:[2,4,5,6,7],wind1:[2,4,5,6,7],earth2:[2,4,5,6,7],water2:[2,4,5,6,7],fire2:[2,4,5,6,7],wind2:[2,4,5,6,7],earth3:[2,4,5,6,7],water3:[2,4,5,6,7],fire3:[2,4,5,6,7],wind3:[2,4,5,6,7],poison1:[2,2,2,2,3],sleep1:[2,4,5,6,7],stone1:[2,2,2,2,3],drunk1:[2,2,2,2,3],confuse1:[2,2,2,2,3],forget1:[2,4,5,6,7],poison2:[2,2,2,2,3],sleep2:[2,4,5,6,7],stone2:[2,2,2,2,3],drunk2:[2,2,2,2,3],confuse2:[2,2,2,2,3],forget2:[2,4,5,6,7],poison3:[2,2,2,2,3],sleep3:[2,4,5,6,7],stone3:[2,2,2,2,3],drunk3:[2,2,2,2,3],confuse3:[2,2,2,2,3],forget3:[2,4,5,6,7],drain:[2,2,2,2,3],pAbsorb:[2,2,2,2,3],mAbsorb:[2,2,2,2,3],pReflect:[2,2,2,2,3],mReflect:[2,2,2,2,3],pNull:[2,2,2,2,3],mNull:[2,2,2,2,3],regen:[4,4,5,6,7],regen2:[2,4,5,6,7],regen3:[2,4,5,6,7],cure:[4,4,5,6,7],reverse:[2,3,4,4,5],pray_earth:[2,3,4,4,5],pray_water:[2,3,4,4,5],pray_fire:[2,3,4,4,5],pray_wind:[2,3,4,4,5],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[2,4,6,8,10]},
 'wizard':{combo:[2,2,2,2,3],moon:[0,0,0,0,0],allin:[2,2,2,2,3],haze:[2,2,2,2,3],volley:[0,0,0,0,0],qigong:[2,2,2,2,3],blade:[2,2,2,2,3],smash:[2,2,2,2,3],counter:[2,2,2,2,3],terror:[2,2,2,2,3],wall:[0,0,0,0,0],cover:[2,2,2,2,3],meditate:[2,2,2,2,3],kill:[0,0,0,0,0],chaos:[0,0,0,0,0],steal:[0,0,0,0,0],mguard:[1,1,1,1,1],twobird:[2,2,3,3,4],focus:[2,2,3,3,4],swift:[2,2,3,3,4],venom:[2,4,5,6,7],sure:[2,4,5,6,7],karma:[2,2,2,2,3],honor:[2,2,3,4,5],heal:[2,3,4,4,5],heal2:[2,3,4,4,5],heal3:[2,3,4,4,5],revive:[2,4,8,8,8],earth1:[2,4,5,6,7],water1:[2,4,5,6,7],fire1:[2,4,5,6,7],wind1:[2,4,5,6,7],earth2:[2,4,5,6,7],water2:[2,4,5,6,7],fire2:[2,4,5,6,7],wind2:[2,4,5,6,7],earth3:[2,4,5,6,7],water3:[2,4,5,6,7],fire3:[2,4,5,6,7],wind3:[2,4,5,6,7],poison1:[2,2,2,2,3],sleep1:[2,4,5,6,7],stone1:[2,2,2,2,3],drunk1:[2,4,5,6,7],confuse1:[2,4,5,6,7],forget1:[2,2,2,2,3],poison2:[2,2,2,2,3],sleep2:[2,4,5,6,7],stone2:[2,2,2,2,3],drunk2:[2,4,5,6,7],confuse2:[2,4,5,6,7],forget2:[2,2,2,2,3],poison3:[2,2,2,2,3],sleep3:[2,4,5,6,7],stone3:[2,2,2,2,3],drunk3:[2,4,5,6,7],confuse3:[2,4,5,6,7],forget3:[2,2,2,2,3],drain:[2,4,5,6,7],pAbsorb:[4,6,8,10,10],mAbsorb:[4,6,8,10,10],pReflect:[4,6,8,10,10],mReflect:[4,6,8,10,10],pNull:[4,6,8,10,10],mNull:[4,6,8,10,10],regen:[4,6,8,10,10],regen2:[4,6,8,10,10],regen3:[4,6,8,10,10],cure:[4,6,8,10,10],reverse:[2,4,5,6,7],pray_earth:[2,4,5,6,7],pray_water:[2,4,5,6,7],pray_fire:[2,4,5,6,7],pray_wind:[2,4,5,6,7],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[2,4,6,8,10]},
 'sorcerer':{combo:[2,2,2,2,3],moon:[0,0,0,0,0],allin:[2,2,2,2,3],haze:[2,2,2,2,3],volley:[0,0,0,0,0],qigong:[2,2,2,2,3],blade:[2,2,2,2,3],smash:[2,2,2,2,3],counter:[2,2,2,2,3],terror:[2,2,2,2,3],wall:[0,0,0,0,0],cover:[2,2,2,2,3],meditate:[2,2,2,2,3],kill:[0,0,0,0,0],chaos:[0,0,0,0,0],steal:[0,0,0,0,0],mguard:[1,1,1,1,1],twobird:[2,2,2,2,3],focus:[2,2,2,2,3],swift:[2,2,2,2,3],venom:[2,4,5,6,7],sure:[2,4,5,6,7],karma:[0,0,0,0,0],honor:[2,2,2,2,2],heal:[2,4,5,6,7],heal2:[2,4,5,6,7],heal3:[2,4,5,6,7],revive:[2,3,4,4,5],earth1:[2,4,5,6,7],water1:[2,4,5,6,7],fire1:[2,4,5,6,7],wind1:[2,4,5,6,7],earth2:[2,4,5,6,7],water2:[2,4,5,6,7],fire2:[2,4,5,6,7],wind2:[2,4,5,6,7],earth3:[2,4,5,6,7],water3:[2,4,5,6,7],fire3:[2,4,5,6,7],wind3:[2,4,5,6,7],poison1:[4,6,8,10,10],sleep1:[4,6,8,10,10],stone1:[4,6,8,10,10],drunk1:[4,6,8,10,10],confuse1:[4,6,8,10,10],forget1:[4,6,8,10,10],poison2:[4,6,8,10,10],sleep2:[4,6,8,10,10],stone2:[4,6,8,10,10],drunk2:[4,6,8,10,10],confuse2:[4,6,8,10,10],forget2:[4,6,8,10,10],poison3:[4,6,8,10,10],sleep3:[4,6,8,10,10],stone3:[4,6,8,10,10],drunk3:[4,6,8,10,10],confuse3:[4,6,8,10,10],forget3:[4,6,8,10,10],drain:[2,3,4,4,5],pAbsorb:[2,4,5,6,7],mAbsorb:[2,4,5,6,7],pReflect:[2,4,5,6,7],mReflect:[2,4,5,6,7],pNull:[2,4,5,6,7],mNull:[2,4,5,6,7],regen:[2,2,2,2,3],regen2:[2,2,2,2,3],regen3:[2,2,2,2,3],cure:[2,3,4,4,5],reverse:[4,6,8,10,10],pray_earth:[4,6,8,10,10],pray_water:[4,6,8,10,10],pray_fire:[4,6,8,10,10],pray_wind:[4,6,8,10,10],poisonRes:[2,2,2,2,3],sleepRes:[2,2,2,2,3],stoneRes:[2,2,2,2,3],drunkRes:[2,2,2,2,3],confuseRes:[2,2,2,2,3],forgetRes:[2,2,2,2,3],playdead:[1,1,1,1,1],copycat:[2,2,2,2,3],psy:[2,4,6,8,10]},
};
// 咒術師併進傳教士：咒術、祈禱、屬性反轉照咒術師的表
for(const k of [...CURSE,...CURSE_X,...PRAYER])SKILL_TABLE.priest[k]=SKILL_TABLE.priest[k].map((v,i)=>Math.max(v,SKILL_TABLE.sorcerer[k][i]));
export function skillCap(jobId,rank,skillId){
 const j=JOBS[jobId];if(!j||j.noSkills)return 0; // 文字版的製造工什麼技能都不能學
 // 採集技能誰都能學（遊民也行），不是本行的上限比照副技能（◎）
 if(GATHER_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.sub[rank];
 // 製造技能誰都能學，但不是本行最多 2 級（只做得出 1～2 級裝備，◎）
 if(CRAFT_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.magicPhys[rank];
 if(jobId==='none')return 0;
 // 戰鬥技能上限表有列的照表（Leo 2026-10-27：士兵的聖盾、護衛表上只到 2～6 級，不是本行的 10 級）
 if(PHYS_CAPS[jobId]?.[skillId])return PHYS_CAPS[jobId][skillId][rank]||0;
 if(SKILL_TABLE[jobId]?.[skillId])return SKILL_TABLE[jobId][skillId][rank]||0;
 if(j.main.includes(skillId))return CAPS.main[rank];
 if(ANY_JOB.includes(skillId))return COMBAT_JOBS.includes(jobId)?CAPS.sub[rank]:0;
 if(PHYS_CAPS[jobId]&&PHYS_SKILLS.includes(skillId))return PHYS_CAPS[jobId][skillId]?.[rank]||0;
 if(j.sub.includes(skillId)){
  const physJob=!['mage','priest','sorcerer','wizard'].includes(jobId);
  return physJob&&(MAGIC.includes(skillId)||HOLY.includes(skillId)||CURSE.includes(skillId))?CAPS.magicPhys[rank]:CAPS.sub[rank];
 }
 return physJobMagic(jobId,skillId)?CAPS.magicPhys[rank]:0;
}
const physJobMagic=(jobId,s)=>!['mage','priest','sorcerer','wizard'].includes(jobId)&&(MAGIC.includes(s)||HOLY.includes(s)||CURSE.includes(s));
export const isSpecialty=(jobId,skillId)=>!!JOBS[jobId]?.main.includes(skillId);
export const rankName=(jobId,rank)=>JOBS[jobId].ranks[Math.min(rank,JOBS[jobId].ranks.length-1)];
// 盾：照蔚藍幻境各職業「裝備上限」表的盾牌欄。劍士、戰斧、騎士跟主裝備一樣；弓箭手、士兵、封印師、馴獸師較低；其他職業不能拿盾
// 各職業每類裝備能穿到幾級：照蔚藍幻境各職業頁的「裝備上限」表（2026-10-27）。沒列的職業照舊用 weapons／armor／GEAR_CAP 推
const GA=[4,6,8,10,11],G3=[3,3,3,3,4],G35=[3,3,4,4,5],GS=[3,4,5,6,7],G0=[0,0,0,0,0],GM=[0,0,0,0,1];
export const GEAR_TABLE={
 'sword':{sword:GA,axe:G3,spear:G3,bow:G3,staff:G0,dagger:G3,shield:GA,helm:GA,hat:G3,mail:GA,cloth:G3,robe:G0,boots:GA,shoes:G3},
 'axe':{sword:G3,axe:GA,spear:G3,bow:G3,staff:G0,dagger:G3,shield:GA,helm:GA,hat:G3,mail:GA,cloth:G3,robe:G0,boots:GA,shoes:G3},
 'spear':{sword:G3,axe:G3,spear:GA,bow:G3,staff:G0,dagger:G3,shield:GA,helm:GA,hat:G3,mail:GA,cloth:G3,robe:G0,boots:GA,shoes:G3},
 'bow':{sword:[3,3,4,4,4],axe:[3,3,4,4,4],spear:[3,3,4,4,4],bow:GA,staff:G0,dagger:GS,shield:G3,helm:G3,hat:GA,mail:G3,cloth:GA,robe:G0,boots:G3,shoes:GA},
 'guard':{sword:GS,axe:GS,spear:GS,bow:GS,staff:G0,dagger:GS,shield:GS,helm:GS,hat:GS,mail:GS,cloth:GS,robe:G0,boots:GS,shoes:GS},
 'fighter':{sword:G0,axe:G0,spear:G0,bow:G0,staff:G0,dagger:G0,shield:G0,helm:G0,hat:GA,mail:G0,cloth:GA,robe:G0,boots:G0,shoes:GA},
 'assassin':{sword:[2,4,6,8,10],axe:[2,4,6,8,10],spear:[2,4,6,8,10],bow:[2,4,6,8,10],staff:G0,dagger:GA,shield:G0,helm:GM,hat:GM,mail:G0,cloth:GM,robe:G0,boots:GM,shoes:GM},
 'mage':{sword:G0,axe:G0,spear:G0,bow:G0,staff:GA,dagger:G35,shield:G0,helm:G0,hat:GA,mail:G0,cloth:G35,robe:GA,boots:G0,shoes:GA},
 'wizard':{sword:G0,axe:G0,spear:G0,bow:G0,staff:GA,dagger:G0,shield:G0,helm:G0,hat:GA,mail:G0,cloth:G35,robe:GA,boots:G0,shoes:GA},
 'priest':{sword:G0,axe:G0,spear:G0,bow:G0,staff:GA,dagger:G0,shield:G0,helm:G0,hat:GA,mail:G0,cloth:G35,robe:GA,boots:G0,shoes:GA},
 'sorcerer':{sword:G0,axe:G0,spear:G0,bow:G0,staff:GA,dagger:G35,shield:G0,helm:G0,hat:GA,mail:G0,cloth:G35,robe:GA,boots:G0,shoes:GA},
};
// 裝備屬於哪一類（工房打的有 cg；商店的照武器種類、防具種類推）
export const gearCat=it=>it.cg||(it.slot==='weapon'?it.type:it.slot==='shield'?'shield':it.slot==='head'?([it.armor].flat().includes('heavy')?'helm':'hat')
 :it.slot==='body'?({heavy:'mail',light:'cloth',robe:'robe'}[[it.armor].flat()[0]]||'cloth'):it.slot==='feet'?([it.armor].flat().includes('heavy')?'boots':'shoes'):null);
export function gearCap(jobId,rank,item){
 const j=JOBS[jobId];
 if(jobId==='none')return 1;
 if(item.slot==='acc')return GEAR_CAP[rank]; // 飾品不分職業，照職階的等級上限（◎）
 const g=GEAR_TABLE[jobId];if(g&&item.slot==='feet'&&!item.armor&&!item.cg)return Math.max(g.boots[rank],g.shoes[rank])||0; // 主遊戲的靴子沒分靴／鞋，照能穿的那類較高的
 const t=GEAR_TABLE[jobId]?.[gearCat(item)];if(t)return t[rank]||0;
 if(item.slot==='weapon')return j.weapons.includes(item.type)?GEAR_CAP[rank]:0;
 if(item.slot==='shield')return j.shield==null?0:Array.isArray(j.shield)?j.shield[rank]:GEAR_CAP[rank];
 if(item.armor)return [item.armor].flat().some(a=>j.armor.includes(a))?GEAR_CAP[rank]:0; // 帽子、靴子可以好幾種人穿（陣列）
 return GEAR_CAP[rank];
}

// 戰鬥系聲望稱號
export const TITLES=[[-3000,'惡人'],[-999,'無名的旅人'],[2000,'路旁的落葉'],[5000,'水面上的小草'],[10000,'呢喃的歌聲'],[20000,'地上的月影'],[33000,'奔跑的春風'],[50000,'蒼之風雲'],[70000,'搖曳的金星'],[100000,'歡喜的慈雨'],[130000,'蘊含的太陽'],[160000,'敬畏的寂靜'],[200000,'無盡星空']];
export const titleOf=rep=>{let t=TITLES[0][1];for(const [v,n] of TITLES)if(rep>=v)t=n;return t;};
// 聲望：原作每天最多拿 800、最多存 4800；單機版不設上限（Leo 2026-10-20 決定）
export const REP_START=1000;
