import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,partyUnits,injureParty,treatAll,treatAllCost} from '../www/src/core/player.mjs';
import {injuryOf,applyInjury} from '../www/src/core/injury.mjs';
const mk=()=>createPlayer({name:'測試',look:'liufeixing',bp:{vit:10,str:12,tgh:4,qui:4},elem:{wind:7,earth:3}}).player;
test('被打倒會受傷、能力下降，醫院治好',()=>{
 const p=mk();p.gold=99999;const u=partyUnits(p)[0];
 assert.equal(injuryOf(0),null);assert.equal(injuryOf(30).name,'中傷');assert.equal(injuryOf(80).name,'瀕死');
 const out=injureParty(p,[{...u,downs:1}],()=>0);assert.equal(p.inj,5);assert.equal(out[0][1],5);
 const hurt=partyUnits(p)[0];assert.ok(hurt.atk<u.atk&&hurt.def<=u.def);
 injureParty(p,[{...u,downs:9}],()=>.99);assert.equal(p.inj,100);
 assert.ok(treatAllCost(p)>0);assert.ok(treatAll(p).ok);assert.equal(p.inj,0);assert.equal(partyUnits(p)[0].atk,u.atk);
 assert.equal(applyInjury({atk:100},0).atk,100);
});
test('錢不夠治好全部時，先治傷最重的',()=>{
 const p=mk();p.inj=80;p.officers={a:{id:'dianwei',lv:1,inj:40}};const full=treatAllCost(p);
 p.gold=Math.floor(full/2);const r=treatAll(p);assert.ok(r.ok);assert.ok(p.gold<2);assert.ok(p.inj<80);assert.equal(p.officers.a.inj,40);
 p.gold=0;assert.ok(!treatAll(p).ok);
});
