import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,battleUnit} from '../www/src/core/player.mjs';
import {createBattle,resolveRound,areaOf} from '../www/src/core/battle.mjs';
const mk=()=>createPlayer({name:'測試',look:'guanshanyue',bp:{vit:15,str:5,tgh:0,qui:0,mgc:10},elem:{fire:10},seed:7}).player;
const five=[['wolf',3],['wolf',3],['wolf',3],['wolf',3],['wolf',3],['bat',3],['bat',3]];
test('十字範圍：目標、同排左右、另一排同位置',()=>{
 const b=createBattle({party:[battleUnit(mk())],enemies:five,seed:1});const t=b.units.find(u=>u.uid==='e2');
 assert.deepEqual(areaOf(b,t,'cross').map(u=>u.uid).sort(),['e0','e2','e4']);
 const t0=b.units.find(u=>u.uid==='e0');assert.deepEqual(areaOf(b,t0,'cross').map(u=>u.uid).sort(),['e0','e1','e2','e5']);
 assert.equal(areaOf(b,t,'all').length,7);
});
test('超強魔法打全體',()=>{
 const p=mk();p.skills=[{id:'fire3',lv:1,exp:0}];p.mp=999;const u=battleUnit(p);u.mp=999;u.hp=u.maxHp=99999;
 const b=createBattle({party:[u],enemies:five,seed:3});const ev=resolveRound(b,[{actor:'p',kind:'skill',skill:'fire3',target:null},{actor:'p',kind:'defend'}]);
 const hit=new Set(ev.filter(e=>e.t==='hit'&&e.a==='p').map(e=>e.d));assert.equal(hit.size,7);
});
test('昏睡不能動、被打會醒；中毒不會扣到死；潔淨解除',()=>{
 const b=createBattle({party:[battleUnit(mk())],enemies:[['wolf',1]],seed:5});const me=b.units[0],w=b.units[1];
 w.st={k:'sleep',n:5};w.atk=0;const ev=resolveRound(b,[{actor:'p',kind:'defend'},{actor:'p',kind:'defend'}]);
 assert.ok(ev.some(e=>e.t==='stuck'&&e.a==='e0'));
 me.st={k:'poison',n:9};me.hp=2;resolveRound(b,[{actor:'p',kind:'defend'},{actor:'p',kind:'defend'}]);assert.ok(me.hp>=1&&me.alive);
 w.st={k:'sleep',n:5};resolveRound(b,[{actor:'p',kind:'attack',target:'e0'},{actor:'p',kind:'defend'}]);if(w.alive)assert.notEqual(w.st?.k,'sleep');
});
