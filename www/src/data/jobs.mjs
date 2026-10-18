// 職業：系統照原作（見習→正職→王宮→師範→大師），三國版「王宮」稱「羽林」。
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

const PHYS=['combo','allin','blade','swift','volley'],MAGIC=['earth1','water1','fire1','wind1'],HOLY=['heal','revive'];
export const JOBS={
 none:{name:'遊民',cg:'遊民',ranks:['遊民'],weapons:['sword','axe','spear','bow','staff'],armor:['heavy','light','robe'],main:[],sub:[]},
 sword:{name:'劍客',cg:'劍士',mentor:'王越',hall:'劍術館',weapon:'sword',weapons:['sword'],armor:['heavy'],promoteBy:'level',
  ranks:['見習劍客','劍客','羽林劍客','劍術師範','劍術宗師'],main:['combo','allin','swift'],sub:['blade','volley'],letter:'letterSword'},
 axe:{name:'斧將',cg:'戰斧鬥士',mentor:'潘鳳',hall:'斧將營',weapon:'axe',weapons:['axe'],armor:['heavy'],promoteBy:'level',
  ranks:['見習斧將','斧將','羽林斧將','斧術師範','斧術宗師'],main:['combo','allin','blade'],sub:['swift','volley'],letter:'letterAxe'},
 spear:{name:'驍騎',cg:'騎士',mentor:'馬騰',hall:'驍騎營',weapon:'spear',weapons:['spear'],armor:['heavy'],promoteBy:'level',
  ranks:['見習驍騎','驍騎','羽林驍騎','驍騎師範','驍騎宗師'],main:['blade','combo'],sub:['allin','swift','volley'],letter:'letterSpear'},
 bow:{name:'神射手',cg:'弓箭手',mentor:'黃忠',hall:'射場',weapon:'bow',weapons:['bow'],armor:['light'],promoteBy:'level',
  ranks:['見習弓手','神射手','羽林射手','弓術師範','弓術宗師'],main:['volley'],sub:['combo','allin','blade','swift'],letter:'letterBow'},
 mage:{name:'術士',cg:'魔術師',mentor:'司馬徽',hall:'水鏡莊',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'level',
  ranks:['見習術士','術士','羽林術士','術法師範','術法宗師'],main:MAGIC,sub:[...PHYS,...HOLY],letter:'letterStaff'},
 priest:{name:'道士',cg:'傳教士',mentor:'于吉',hall:'道觀',weapon:'staff',weapons:['staff'],armor:['robe'],promoteBy:'heal',
  ranks:['見習道士','道士','祭酒','治頭祭酒','師君'],main:HOLY,sub:[...PHYS,...MAGIC],quiz:true},
 // 採集系（原作樵夫、礦工、獵人）：不用推薦信，到百工坊直接就職（◎）；晉級看採集技能等級與聲望，不用晉級任務
 lumber:{name:'樵夫',cg:'樵夫',mentor:'老樵夫',hall:'百工坊',gather:true,weapons:['axe'],armor:['light'],promoteBy:'lumber',
  ranks:['見習樵夫','樵夫','羽林樵夫','樵夫師範','樵夫宗師'],main:['lumber'],sub:['mining','hunting']},
 miner:{name:'礦工',cg:'礦工',mentor:'礦頭',hall:'百工坊',gather:true,weapons:['axe'],armor:['light'],promoteBy:'mining',
  ranks:['見習礦工','礦工','羽林礦工','礦工師範','礦工宗師'],main:['mining'],sub:['lumber','hunting']},
 hunter:{name:'獵人',cg:'獵人',mentor:'老獵戶',hall:'百工坊',gather:true,weapons:['bow'],armor:['light'],promoteBy:'hunting',
  ranks:['見習獵人','獵人','羽林獵人','獵人師範','獵人宗師'],main:['hunting'],sub:['lumber','mining']},
 // 製造系（原作鑄劍工、造斧工……）：不用推薦信，到工匠坊直接就職（◎）；晉級看製造技能等級與聲望
 ...Object.fromEntries([['smithSword','鑄劍工','craftSword','sword'],['smithAxe','造斧工','craftAxe','axe'],['smithSpear','造槍工','craftSpear','spear'],['bowyer','造弓工','craftBow','bow'],
  ['staffer','造杖工','craftStaff','staff'],['armorer','鎧甲工','craftMail','sword'],['tailor','裁縫工','craftCloth','bow']].map(([id,name,sk,w])=>[id,{name,cg:name,mentor:name.replace('工','師傅'),hall:'工匠坊',craft:true,gather:true,
  weapons:[w],armor:['light'],promoteBy:sk,ranks:['見習'+name,name,'羽林'+name,name+'師範',name+'宗師'],main:[sk],sub:['lumber','mining','hunting']}])),
};
export const COMBAT_JOBS=['sword','axe','spear','bow','mage','priest'];
export const GATHER_JOBS=['lumber','miner','hunter'];
export const GATHER_SKILLS=['lumber','mining','hunting'];
export const CRAFT_JOBS=['smithSword','smithAxe','smithSpear','bowyer','staffer','armorer','tailor'];
export const CRAFT_SKILLS=['craftSword','craftAxe','craftSpear','craftBow','craftStaff','craftMail','craftCloth'];

export function skillCap(jobId,rank,skillId){
 const j=JOBS[jobId];if(!j)return 0;
 // 採集技能誰都能學（遊民也行），不是本行的上限比照副技能（◎）
 if(GATHER_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.sub[rank];
 // 製造技能誰都能學，但不是本行最多 2 級（只做得出 1～2 級裝備，◎）
 if(CRAFT_SKILLS.includes(skillId))return j.main.includes(skillId)?CAPS.main[rank]:CAPS.magicPhys[rank];
 if(jobId==='none')return 0;
 if(j.main.includes(skillId))return CAPS.main[rank];
 if(j.sub.includes(skillId)){
  const physJob=!['mage','priest'].includes(jobId);
  return physJob&&(MAGIC.includes(skillId)||HOLY.includes(skillId))?CAPS.magicPhys[rank]:CAPS.sub[rank];
 }
 return physJobMagic(jobId,skillId)?CAPS.magicPhys[rank]:0;
}
const physJobMagic=(jobId,s)=>!['mage','priest'].includes(jobId)&&(MAGIC.includes(s)||HOLY.includes(s));
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
