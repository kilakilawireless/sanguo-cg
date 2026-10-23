// 城裡的目標提示：照前幾輪實際走過的流程，確認每個階段都指得到下一步、不會指錯地方。
import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,addItem} from '../www/src/core/player.mjs';
import {goal} from '../www/src/view/goal.mjs';
const mk=()=>createPlayer({name:'測',look:'liufeixing',bp:{vit:15,str:15},elem:{fire:10}}).player;
const has=(p,...words)=>{const g=goal(p);for(const w of words)assert.ok(g.includes(w),`「${g}」應該提到「${w}」`);return g;};

test('新手：找傭兵→止痛藥→通行證→武器→6 樓→就職→學技能',()=>{
 const p=mk();has(p,'酒吧','蓋爾');
 p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei'];has(p,'止痛藥');
 addItem(p,'painkiller');has(p,'受傷的士兵');
 p.bag=[];addItem(p,'trialPass');has(p,'武器店');
 p.equip.weapon='swordN';has(p,'6 樓','推薦信');
 p.job='sword';has(p,'職業公會','劍士導師','學技能');
 p.skills=[{id:'combo',lv:1,exp:0}];has(p,'芙蕾雅');
});

test('就職後照等級指練功點，18～19 級不會叫人進樹精之森',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo'];p.officers.huatuo={id:'huatuo',lv:1};
 p.job='sword';p.skills=[{id:'combo',lv:1,exp:0}];p.equip.weapon='swordN';p.equip.body='mailN';
 p.lv=3;has(p,'芙蕾雅','1500 金');
 p.lv=7;has(p,'試煉洞窟');
 p.equip.weapon='swordC';p.equip.body='mailL';p.lv=19;assert.ok(!goal(p).startsWith('去樹精之森'));has(p,'盜賊的巢穴','20 級');
 p.lv=20;has(p,'樹精之森','樹精長老');
 p.party=['dianwei'];p.lv=6;has(p,'酒吧','羅蘭');
});

test('正職：32 級前留在海底洞窟，之後去古代王墓、45 級去神獸之谷',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo','taishici'];
 p.job='sword';p.rank=1;p.skills=[{id:'combo',lv:1,exp:0}];p.flags.treant=true;p.flags.hangu=true;
 p.lv=28;has(p,'海底洞窟','克勞斯');
 p.lv=35;has(p,'古代王墓');
 p.officers.machao={id:'machao',lv:30};p.officers.caiwenji={id:'caiwenji',lv:30};assert.ok(!goal(p).includes('克勞斯'));
 p.lv=45;has(p,'神獸之谷');
});

test('王宮職：先打古代王墓，再去詛咒的迷宮練到 70 級，打倒詛咒之王後提示晉級條件',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo','taishici'];
 p.job='sword';p.rank=2;p.skills=[{id:'combo',lv:1,exp:0}];Object.assign(p.flags,{treant:true,hangu:true,beast:true});p.lv=48;
 has(p,'古代王墓');p.flags.lishan=true;has(p,'神獸之谷');p.lv=60;has(p,'詛咒的迷宮','70');
 p.flags.curse=true;has(p,'師範','等級 70');
});

test('生產職：先學主技能，再說怎麼練',()=>{
 for(const [job,sk,where] of [['lumber','lumber','採集'],['smithSword','craftSword','製造'],['doctor','treat','狀態→技能']]){
  const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei'];p.job=job;
  has(p,'學');p.skills=[{id:sk,lv:1,exp:0}];has(p,where,'4 級');
 }
});

test('傳教士：提示補血魔法還差幾級',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo'];p.job='priest';p.lv=12;
 p.skills=[{id:'heal',lv:2,exp:0}];p.equip.weapon='staffS';p.equip.body='robeC';has(p,'補血魔法 4 級','現在 2');
 p.skills[0].lv=4;assert.ok(!goal(p).includes('補血魔法 4 級'));
});

test('有買得起的更好裝備就提示去哪裡買，已經買了還沒裝也會提醒',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo','taishici'];
 p.job='sword';p.rank=1;p.skills=[{id:'combo',lv:1,exp:0}];p.flags.treant=true;p.flags.hangu=true;p.lv=28;
 p.equip.weapon='swordS';p.equip.body='mailI';p.equip.head='helmI';p.equip.feet='bootT';p.gold=1000;assert.ok(!goal(p).includes('更好'));
 p.gold=20000;has(p,'工房','騎士劍');
 p.bag.push({id:'mailG',n:1});has(p,'騎士鎧還沒裝上');
});
test('頭、腳空著也會提示買',()=>{
 const p=mk();p.officers.dianwei={id:'dianwei',lv:1};p.party=['dianwei','huatuo','taishici'];
 p.job='sword';p.rank=1;p.skills=[{id:'combo',lv:1,exp:0}];p.flags.treant=true;p.flags.hangu=true;p.lv=28;
 p.equip.weapon='swordG';p.equip.body='mailG';p.gold=3000;has(p,'工房','鐵盔');
});
