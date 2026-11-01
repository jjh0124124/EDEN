const fs=require('node:fs');
const vm=require('node:vm');
function game(psychic=false){
  const events={}, storage=new Map();
  const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?s=>({width:s.length*6}):()=>{},set:()=>true});
  const canvas={width:480,height:270,getContext:()=>ctx,addEventListener(){},focus(){}};
  const world={console,Math,performance:{now:()=>0},requestAnimationFrame:()=>{},
    addEventListener:(n,fn)=>{(events[n]??=[]).push(fn);},document:{querySelectorAll:()=>[],querySelector:s=>s==='#game'?canvas:{classList:{add(){}}}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    EdenPresentation:{zero(){},drawZero(){},boss(){},background(){},Soundtrack:class{constructor(){this.events=[]}tone(...args){this.events.push(['tone',...args])}noise(...args){this.events.push(['noise',...args])}tick(){}wake(){}}}};
  world.window=world;
  const exports=`globalThis.testGame={player,Boss,BOSSES,startBoss,startExplore,update,updateCombat,finishBoss,load,save,keys,pressed,
    step(dt=.016){update(dt);pressed.clear();},
    press(k){pressed.add(k);update(.016);pressed.clear();},
    engage(i=0){startBoss(i);state='combat';boss.inv=0;boss.t=999;},
    get boss(){return boss},get state(){return state},get hazards(){return hazards},get slashes(){return slashes},get room(){return room},get upgrade(){return upgrade},get paused(){return paused},get dialogue(){return dialogue},get checkpoint(){return checkpointStage},get archiveCount(){return archiveCount},
    get augments(){return augments},get chain(){return chain},get sounds(){return audio.events},get feedback(){return {shake,hitstop,particles:particles.length,numbers:damageNumbers.length}},chooseReward,rewardPointer,freeze(t){hitstop=t},
    title(){state='title';dialogue=null;hitstop=0;menu=0},setUpgrade(v){upgrade=v},resume(){paused=false},};`;
  const source=fs.readFileSync(__dirname+'/../src/game.js','utf8').replace('})();',exports+'\n})();');
  if(psychic)vm.runInNewContext(fs.readFileSync(__dirname+'/../src/psychic.js','utf8'),world);
  vm.runInNewContext(source,world);world.testGame.dispatch=(type,event)=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};return world.testGame;
}
module.exports={game};
