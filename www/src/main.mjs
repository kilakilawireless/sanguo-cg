// 進入點：註冊各畫面，從標題開始。
import {go} from './game.mjs';
import {showTitle,showCreate} from './view/create.mjs';
import {showTown} from './view/town.mjs';
import {showMap,showField} from './view/field.mjs';
import {showBattle} from './view/battle.mjs';
Object.assign(go,{title:showTitle,create:showCreate,town:showTown,map:showMap,field:showField,battle:showBattle});
showTitle();
