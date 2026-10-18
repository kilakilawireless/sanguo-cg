import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayer,partyUnits,injureParty,treatAll,treatAllCost} from '../www/src/core/player.mjs';
import {injuryOf,applyInjury} from '../www/src/core/injury.mjs';
const mk=()=>createPlayer({name:'測試',look:'liufeixing',bp:{vit:10,str:12,tgh:4,qui:4},elem:{wind:7,earth:3}}).player;
test('被打倒會受傷、能力下降，醫院治好',()=>{
 const p=mk();p.gold=99999;const u=partyUnits(p)[0];
 assert.equal(injuryOf(0),null);assert.equal(injuryOf(30).name,'中傷');assert.equal(injuryOf(80).name,'瀕死');
 const out=injureParty(p,[{...u,downs:1}],()=>0);assert.equal(p.inj,10);assert.equal(out[0][1],10);
 const hurt=partyUnits(p)[0];assert.ok(hurt.atk<u.atk&&hurt.def<=u.def);
 injureParty(p,[{...u,downs:9}],()=>.99);assert.equal(p.inj,100);
 assert.ok(treatAllCost(p)>0);assert.ok(treatAll(p).ok);assert.equal(p.inj,0);assert.equal(partyUnits(p)[0].atk,u.atk);
 assert.equal(applyInjury({atk:100},0).atk,100);
});
