// 存檔防呆：壞掉的存檔先備份，舊存檔裡已經不存在的道具、技能、傭兵會拿掉。
import test from 'node:test';import assert from 'node:assert/strict';
const store={};globalThis.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
const {load,G,SAVE_KEY}=await import('../www/src/game.mjs');
const P=await import('../www/src/core/player.mjs');
test('舊存檔拿掉不存在的東西',()=>{
 const p=P.createPlayer({name:'測',look:'liufeixing',bp:{vit:15,str:15},elem:{fire:10}}).player;P.addItem(p,'potion');
 p.bag.push({id:'oldThing',n:1});p.skills.push({id:'oldSkill',lv:1,exp:0});p.equip.head='gone';p.party.push('nobody');
 store[SAVE_KEY]=JSON.stringify(p);const q=load();
 assert.deepEqual(q.bag.map(x=>x.id),['potion']);assert.equal(q.skills.length,0);assert.equal(q.equip.head,null);assert.deepEqual(q.party,[]);
});
test('壞掉的存檔先備份',()=>{
 store[SAVE_KEY]='{壞掉';assert.equal(load(),null);assert.equal(store[SAVE_KEY+'-broken'],'{壞掉');assert.equal(G.broken,true);
});
test('舊存檔缺欄位、數字壞掉也能載入，不會算出 NaN',()=>{
 const base=P.createPlayer({name:'測',look:'liufeixing',bp:{vit:15,str:15},elem:{fire:10}}).player;
 const ok=q=>{assert.ok(q);for(const u of P.partyUnits(q))for(const k of ['hp','mp','maxHp','lv'])assert.ok(Number.isFinite(u[k]),`${u.name} ${k}`);
  assert.ok(Number.isFinite(P.restCost(q)));for(const k of ['gold','rep','exp','freeBp','rank'])assert.ok(Number.isFinite(q[k]),k);};
 for(const k of Object.keys(base))if(k!=='v')for(const v of [undefined,null]){const p=structuredClone(base);if(v===undefined)delete p[k];else p[k]=v;store[SAVE_KEY]=JSON.stringify(p);ok(load());}
 const p=structuredClone(base);p.officers.dianwei={id:'dianwei'};p.party=['dianwei'];p.bag=[{id:'potion'}];p.skills=[{id:'combo'}];store[SAVE_KEY]=JSON.stringify(p);ok(load());
});
test('舊存檔的寵物缺欄位也能載入，生命超過上限不會讓醫院倒貼錢',()=>{
 const base=P.createPlayer({name:'測',look:'liufeixing',bp:{vit:15,str:15},elem:{fire:10}}).player;
 const pet={uid:'pet1',mon:'bat',name:'迷你蝙蝠',lv:3,exp:81,grade:[16,20,12,44,18],hp:119,mp:117};
 for(const k of Object.keys(pet))if(k!=='mon'){const p=structuredClone(base);const x={...pet};delete x[k];p.pets=[x];p.petOut='pet1';p.petSeq=1;store[SAVE_KEY]=JSON.stringify(p);
  const q=load();assert.ok(q,k);const y=q.pets[0];assert.ok(y.uid&&y.name&&Array.isArray(y.grade),k);
  for(const f of ['lv','exp','hp','mp','inj'])assert.ok(Number.isFinite(y[f]),`${k} ${f}`);
  assert.ok(P.restCost(q)>=0,k);assert.ok(Number.isFinite(P.treatAllCost(q)),k);for(const u of P.partyUnits(q))assert.ok(u.hp<=u.maxHp&&u.name,k);}
 const p=structuredClone(base);p.hp=9999;p.mp=9999;store[SAVE_KEY]=JSON.stringify(p);const q=load();assert.equal(P.restCost(q),0);
});
