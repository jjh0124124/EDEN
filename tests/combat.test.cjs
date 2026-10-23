const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function game(){
  const events={}, storage=new Map();
  const ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?s=>({width:s.length*6}):()=>{},set:()=>true});
  const canvas={width:480,height:270,getContext:()=>ctx,addEventListener(){},focus(){}};
  const world={console,Math,performance:{now:()=>0},requestAnimationFrame:()=>{},
    addEventListener:(n,fn)=>{(events[n]??=[]).push(fn);},document:{querySelectorAll:()=>[],querySelector:s=>s==='#game'?canvas:{classList:{add(){}}}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    EdenPresentation:{zero(){},drawZero(){},boss(){},background(){},Soundtrack:class{tone(){}noise(){}tick(){}wake(){}}}};
  world.window=world;
  const exports=`globalThis.testGame={player,Boss,BOSSES,startBoss,startExplore,update,updateCombat,finishBoss,load,save,keys,pressed,
    step(dt=.016){update(dt);pressed.clear();},
    press(k){pressed.add(k);update(.016);pressed.clear();},
    engage(i=0){startBoss(i);state='combat';boss.inv=0;boss.t=999;},
    get boss(){return boss},get state(){return state},get hazards(){return hazards},get slashes(){return slashes},get room(){return room},get upgrade(){return upgrade},get paused(){return paused},get dialogue(){return dialogue},get checkpoint(){return checkpointStage},get archiveCount(){return archiveCount},
    get augments(){return augments},get chain(){return chain},chooseReward,rewardPointer,
    title(){state='title';dialogue=null;hitstop=0;menu=0},setUpgrade(v){upgrade=v},resume(){paused=false},};`;
  const source=fs.readFileSync(__dirname+'/../src/game.js','utf8').replace('})();',exports+'\n})();');
  vm.runInNewContext(source,world);world.testGame.dispatch=(type,event)=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};return world.testGame;
}
const frames=(g,n=60)=>{for(let i=0;i<n;i++)g.step(1/60);};

test('heavy attack survives its windup and damages a nearby boss',()=>{const g=game();g.engage();g.player.x=g.boss.x-35;g.player.face=1;g.player.strike(true);frames(g,22);assert.ok(g.boss.hp<g.boss.maxHp);});
test('HOUND melee activates after telegraph instead of expiring',()=>{const g=game();g.engage(1);g.boss.act();const s=g.slashes[0];g.player.x=s.x+20;frames(g,30);assert.ok(g.player.hp<100);});
test('ORACLE locks a location and remains frozen during pause',()=>{const g=game();g.engage(4);g.boss.act();const h=g.hazards[0],x=h.x;g.press('escape');const delay=h.delay;frames(g,100);assert.equal(h.delay,delay);g.press('escape');g.player.x=300;frames(g,60);assert.equal(h.x,x);assert.equal(g.player.hp,100);});
test('aimed projectiles reach the player lane',()=>{const g=game();g.engage();g.boss.arc(3,125);const middle=g.hazards[1];assert.ok(middle.vx<0);assert.ok(middle.vy>0);});
test('dead player cannot move or launch skills',()=>{const g=game();g.engage();g.player.damage(100,1);const sp=g.player.sp;g.keys.add('d');g.press('q');frames(g,5);assert.equal(g.player.hp,0);assert.equal(g.player.sp,sp);assert.equal(g.player.cool[0],0);});
test('boss defeat clears hazards and awards one pending core',()=>{const g=game();g.engage();g.boss.arc(3,125);g.boss.hurt(2000);assert.equal(g.hazards.length,0);frames(g,180);assert.equal(g.state,'reward');assert.equal(g.upgrade,1);assert.equal(g.load().boss,1);g.finishBoss();assert.equal(g.upgrade,1);assert.equal(g.load().stage,'reward');});

test('pending reward survives reload and can only be claimed once',()=>{const g=game();g.engage();g.finishBoss();g.title();g.press('enter');assert.equal(g.state,'reward');g.press('d');g.press('enter');assert.equal(g.augments[1],1);g.chooseReward();assert.equal(g.augments[1],1);assert.equal(g.load().stage,'explore');g.title();g.press('enter');assert.equal(g.state,'explore');assert.equal(g.augments[1],1);});
test('RAZOR increases boss damage beyond automatic core scaling',()=>{const g=game();g.engage();g.finishBoss();g.press('enter');g.engage(1);g.boss.hurt(100);assert.equal(g.boss.maxHp-g.boss.hp,120);});
test('FLUX regenerates energy and accelerates cooldowns',()=>{const g=game();g.engage();g.finishBoss();g.press('d');g.press('enter');g.engage(1);g.player.sp=0;g.player.cool[0]=3;g.player.update(1);assert.equal(g.player.sp,13);assert.ok(Math.abs(g.player.cool[0]-1.85)<.001);});
test('RAZOR also applies to corridor enemies',()=>{const g=game();g.engage();g.finishBoss();g.press('enter');g.startExplore();g.player.x=445;g.step();const drone=g.room.drones[0],hp=drone.hp;g.player.x=drone.x-25;g.player.face=1;g.player.strike(true);frames(g,22);assert.equal(hp-drone.hp,26);});
test('AEGIS persists max health and reduces incoming damage',()=>{const g=game();g.engage();g.finishBoss();g.press('a');g.press('enter');g.startBoss(1);assert.equal(g.player.maxHp,125);g.player.damage(50,1);assert.equal(g.player.hp,79);});
test('chain expires and resets on damage',()=>{const g=game();g.engage();g.boss.hurt(10);g.boss.inv=0;g.boss.hurt(10);assert.equal(g.chain,2);g.player.damage(1,1);assert.equal(g.chain,0);g.boss.inv=0;g.boss.hurt(10);frames(g,160);assert.equal(g.chain,0);});
test('all seven encounters have usable attacks and phase transitions',()=>{for(let i=0;i<7;i++){const g=game();g.engage(i);g.boss.act();assert.ok(g.hazards.length+g.slashes.length>0);g.boss.inv=0;g.boss.hp=50;g.boss.hurt(1);assert.equal(g.boss.phase,2);assert.ok(g.boss.tele>0);}});
test('new ending is preserved as a completed record',()=>{const g=game();g.engage(6);g.boss.hurt(2000);frames(g,180);assert.equal(g.state,'ending');assert.equal(g.load().complete,true);g.press('enter');assert.equal(g.state,'title');g.press('enter');assert.equal(g.state,'ending');});
test('checkpoint restores boss and core upgrade',()=>{const g=game();g.setUpgrade(3);g.startBoss(3);const old=g.load();assert.equal(old.boss,3);assert.equal(old.stage,'boss');assert.equal(old.upgrade,3);assert.equal(g.player.maxHp,115);});
test('exploration security lock and terminal gate are playable',()=>{const g=game();g.startExplore();g.player.x=445;g.step();assert.equal(g.room.section,1);g.player.x=445;g.step();assert.equal(g.room.section,1);g.room.drones.forEach(d=>d.hp=0);g.player.x=445;g.step();assert.equal(g.room.section,2);g.player.x=405;g.press('f');assert.equal(g.state,'intro');assert.equal(g.checkpoint,'boss');});
test('archive pauses action until dialogue is dismissed',()=>{const g=game();g.startExplore();g.player.x=209;g.press('f');assert.ok(g.dialogue);const before=g.player.x;g.keys.add('d');frames(g,20);assert.equal(g.player.x,before);g.press('enter');g.press('enter');assert.equal(g.dialogue,null);assert.equal(g.archiveCount,1);});
test('stationary evade still moves in facing direction',()=>{const g=game();g.engage();const x=g.player.x;g.press('shift');frames(g,10);assert.ok(g.player.x>x+25);});
test('WARDEN guard reduces light hits and breaks under heavy pressure',()=>{const g=game();g.engage(2);g.boss.hurt(10);assert.equal(g.boss.maxHp-g.boss.hp,4);g.boss.inv=0;g.boss.hurt(22);g.boss.inv=0;g.boss.hurt(22);assert.ok(g.boss.guardBroken>0);g.boss.inv=0;const hp=g.boss.hp;g.boss.hurt(10);assert.equal(hp-g.boss.hp,10);});
test('archive recovery is not duplicated after restarting the corridor',()=>{const g=game();g.startExplore();g.player.x=209;g.press('f');g.press('enter');g.press('enter');g.startExplore();g.player.x=209;g.press('f');assert.equal(g.archiveCount,1);assert.equal(g.load().records.length,1);});
test('skills enforce both energy and cooldown',()=>{const g=game();g.engage();g.player.sp=23;g.player.skill(0);assert.equal(g.slashes.length,0);g.player.sp=100;g.player.skill(0);assert.equal(g.player.sp,76);const count=g.slashes.length;g.player.skill(0);assert.equal(g.slashes.length,count);assert.equal(g.player.sp,76);});
test('Korean IME and shifted letters use physical key codes',()=>{const g=game();g.engage();const x=g.player.x;g.dispatch('keydown',{code:'KeyD',key:'ㅇ',isComposing:true});frames(g,30);assert.ok(g.player.x>x+25);g.dispatch('keyup',{code:'KeyD',key:'D'});assert.equal(g.keys.has('d'),false);g.dispatch('keydown',{code:'KeyA',key:'Process'});assert.ok(g.keys.has('a'));g.dispatch('keyup',{code:'KeyA',key:'ㅁ'});assert.equal(g.keys.has('a'),false);});
test('arrow movement and two shift keys release independently',()=>{const g=game();g.engage();g.dispatch('keydown',{code:'ArrowRight',key:'ArrowRight'});assert.ok(g.keys.has('d'));g.dispatch('keyup',{code:'ArrowRight',key:'ArrowRight'});assert.equal(g.keys.has('d'),false);g.dispatch('keydown',{code:'ShiftLeft',key:'Shift'});g.dispatch('keydown',{code:'ShiftRight',key:'Shift'});g.dispatch('keyup',{code:'ShiftLeft',key:'Shift'});assert.ok(g.keys.has('shift'));g.dispatch('keyup',{code:'ShiftRight',key:'Shift'});assert.equal(g.keys.has('shift'),false);});
test('window blur clears held input and pauses gameplay',()=>{const g=game();g.engage();g.dispatch('keydown',{code:'KeyD',key:'d'});g.dispatch('blur',{});assert.equal(g.keys.size,0);assert.equal(g.paused,true);});
test('shin rail projectile waits for deployment and then hits',()=>{const g=game();g.engage();g.player.skill(1);frames(g,10);assert.equal(g.boss.hp,g.boss.maxHp);frames(g,80);assert.ok(g.boss.hp<g.boss.maxHp);assert.equal(g.player.weaponMode,'rail');});
