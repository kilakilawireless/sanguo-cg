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
 CURSE=['poison1','sleep1','stone1','confuse1','drunk1','forget1'];
export const JOBS={
 none:{name:'遊民',cg:'遊民',ranks:['遊民'],weapons:['sword','axe','spear','bow','staff'],armor:['heavy','light','robe'],main:[],sub:[]},
 sword:{name:'劍士',cg:'劍士',mentor:'劍士導師',hall:'劍士公會',weapon:'sword',weapons:['sword'],armor:['heavy'],promoteBy:'level',
  ranks:['見習劍士','劍士','王宮劍士','劍士師範','劍士大師'],main:['combo','allin','swift'],sub:['blade','volley'],letter:'letterSword'},
 axe:{name:'戰斧鬥士',cg:'戰斧鬥士',mentor:'戰斧導師',hall:'戰斧鬥士公會',weapon:'axe',weapons:['axe'],armor:['heavy'],promoteBy:'level',
  ranks:['見習戰斧鬥士','戰斧鬥士','王宮戰斧鬥士','戰斧鬥士師範','戰斧鬥士大師'],main:['combo','allin','blade'],sub:['swift','volley'],letter:'letterAxe'},
 spear:{name:'騎士',cg:'騎士',mentor:'騎士團長',hall:'騎士團',weapon:'spear',weapons:['spear'],armor:['heavy'],promoteBy:'level',
  ranks:['見習騎士','騎士','王宮騎士','騎士師範','騎士大師'],main:['blade','combo'],sub:['allin','swift','volley'],letter:'letterSpear'},
 bow:{name:'弓箭手',cg:'弓箭手',mentor:'弓箭手導師',hall:'弓箭手公會',weapon:'bow',weapons:['bow'],armor:['light'],promoteBy:'level',
  ranks:['見習弓箭手','弓箭手','王宮弓箭手','弓箭手師範','弓箭手大師'],main:['volley'],sub:['combo','allin','blade','swift'],letter:'letterBow'},
 mage:{name:'魔術師',cg:'魔術師',mentor:'魔術師導師',hall:'魔術師公會',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習魔術師','魔術師','王宮魔術師','魔術師師範','魔術師大師'],main:MAGIC,sub:[...PHYS,...HOLY,...CURSE],letter:'letterStaff'},
 // 格鬥士：不拿武器，空手打；空手去找試煉官就給推薦信
 fighter:{name:'格鬥士',cg:'格鬥士',mentor:'格鬥士導師',hall:'格鬥士道場',weapon:'fist',weapons:[],armor:['light'],promoteBy:'level',
  ranks:['見習格鬥士','格鬥士','王宮格鬥士','格鬥士師範','格鬥士大師'],main:['qigong','smash','meditate'],sub:['combo','allin','blade','swift'],letter:'letterFist'},
 // 士兵：劍斧槍都能用，護住隊友、死守陣地；穿著鎧甲、拿劍斧槍去找試煉官，會多給一封士兵推薦信（◎）
 guard:{name:'士兵',cg:'士兵',mentor:'士兵隊長',hall:'士兵營',weapon:'sword',weapons:['sword','axe','spear'],armor:['heavy'],promoteBy:'level',
  ranks:['見習士兵','士兵','王宮士兵','士兵師範','士兵大師'],main:['cover','wall'],sub:['combo','allin','blade','swift'],letter:'letterGuard'},
 // 忍者：用小刀，出手快
 assassin:{name:'忍者',cg:'忍者',mentor:'忍者頭目',hall:'忍者之家',weapon:'dagger',weapons:['dagger'],armor:['light'],promoteBy:'level',
  ranks:['見習忍者','忍者','王宮忍者','忍者師範','忍者大師'],main:['kill','venom'],sub:['combo','swift','volley'],letter:'letterDagger'},
 // 巫師：吸取生命、持續回復；跟魔術師拿同一封推薦信
 wizard:{name:'巫師',cg:'巫師',mentor:'巫師導師',hall:'巫師之家',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習巫師','巫師','王宮巫師','巫師師範','巫師大師'],main:['drain','regen'],sub:[...PHYS,...MAGIC,...HOLY,...CURSE],letter:'letterStaff'},
 // 封印師：封印魔物當寵物；馴獸師：帶寵物作戰。這兩行不用推薦信，直接拜師（◎）
 sealer:{name:'封印師',cg:'封印師',mentor:'封印師導師',hall:'封印師之家',weapon:'dagger',weapons:['dagger','staff'],armor:['light','robe'],promoteBy:'level',free:true,
  ranks:['見習封印師','封印師','王宮封印師','封印師師範','封印師大師'],main:['seal'],sub:['combo','venom','poison1','sleep1']},
 beastmaster:{name:'馴獸師',cg:'馴獸師',mentor:'馴獸師導師',hall:'馴獸師之家',weapon:'dagger',weapons:['dagger','sword'],armor:['light'],promoteBy:'level',free:true,
  ranks:['見習馴獸師','馴獸師','王宮馴獸師','馴獸師師範','馴獸師大師'],main:['rally','seal'],sub:['combo','swift','heal']},
 // 咒術師：用杖，跟魔術師拿同一封推薦信
 sorcerer:{name:'咒術師',cg:'咒術師',mentor:'咒術師導師',hall:'咒術師之家',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習咒術師','咒術師','王宮咒術師','咒術師師範','咒術師大師'],main:CURSE,sub:[...PHYS,...MAGIC,...HOLY],letter:'letterStaff'},
 priest:{name:'傳教士',cg:'傳教士',mentor:'神父',hall:'教會',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'heal',
  ranks:['見習傳教士','傳教士','王宮傳教士','傳教士師範','傳教士大師'],main:HOLY,sub:[...PHYS,...MAGIC,...CURSE],quiz:true},
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

export function skillCap(jobId,rank,skillId){
 const j=JOBS[jobId];if(!j)return 0;
 // 採集技能誰都能學（遊民也行），不是本行的上限比照副技能（◎）
 if(GATHER_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.sub[rank];
 // 製造技能誰都能學，但不是本行最多 2 級（只做得出 1～2 級裝備，◎）
 if(CRAFT_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.magicPhys[rank];
 if(jobId==='none')return 0;
 if(j.main.includes(skillId))return CAPS.main[rank];
 if(j.sub.includes(skillId)){
  const physJob=!['mage','priest','sorcerer','wizard'].includes(jobId);
  return physJob&&(MAGIC.includes(skillId)||HOLY.includes(skillId)||CURSE.includes(skillId))?CAPS.magicPhys[rank]:CAPS.sub[rank];
 }
 return physJobMagic(jobId,skillId)?CAPS.magicPhys[rank]:0;
}
const physJobMagic=(jobId,s)=>!['mage','priest','sorcerer','wizard'].includes(jobId)&&(MAGIC.includes(s)||HOLY.includes(s)||CURSE.includes(s));
export const isSpecialty=(jobId,skillId)=>!!JOBS[jobId]?.main.includes(skillId);
export const rankName=(jobId,rank)=>JOBS[jobId].ranks[Math.min(rank,JOBS[jobId].ranks.length-1)];
export function gearCap(jobId,rank,item){
 const j=JOBS[jobId];
 if(jobId==='none')return 1;
 if(item.slot==='weapon')return j.weapons.includes(item.type)?GEAR_CAP[rank]:0;
 if(item.armor)return j.armor.includes(item.armor)?GEAR_CAP[rank]:0;
 return GEAR_CAP[rank];
}

// 戰鬥系聲望稱號
export const TITLES=[[-3000,'惡人'],[-999,'無名的旅人'],[2000,'路旁的落葉'],[5000,'水面上的小草'],[10000,'呢喃的歌聲'],[20000,'地上的月影'],[33000,'奔跑的春風'],[50000,'蒼之風雲'],[70000,'搖曳的金星'],[100000,'歡喜的慈雨'],[130000,'蘊含的太陽'],[160000,'敬畏的寂靜'],[200000,'無盡星空']];
export const titleOf=rep=>{let t=TITLES[0][1];for(const [v,n] of TITLES)if(rep>=v)t=n;return t;};
export const REP_START=1000,REP_DAILY=800,REP_POOL_MAX=4800;
