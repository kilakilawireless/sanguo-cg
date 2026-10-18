// 存檔防呆：壞掉的存檔先備份，舊存檔裡已經不存在的道具、技能、武將會拿掉。
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
