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
  vm.runInNewContext(source,world);world.testGame.dispatch=(type,event)=>{for(const fn of events[type]||[])fn({preventDefault(){},...event});};return world.testGame;
}
const frames=(g,n=60)=>{for(let i=0;i<n;i++)g.step(1/60);};

test('SURGEON chooses spacing-based attacks without reading input',()=>{for(const [x,pattern] of [[310,0],[220,1],[60,2]]){const g=game();g.engage();g.player.x=x;g.boss.t=0;g.keys.add('q');g.step();assert.equal(g.boss.move,pattern);const target=g.boss.target.x;g.player.x=440;g.step();assert.equal(g.boss.target.x,target);}});
test('SURGEON varies repeated patterns and cannot be cast-broken repeatedly',()=>{const g=game();g.engage();g.player.x=310;g.boss.t=0;g.step();g.boss.windup=0;g.boss.t=0;g.step();g.boss.windup=0;g.boss.t=0;g.step();assert.notEqual(g.boss.move,0);g.boss.windup=1;g.boss.hurt(52,true);assert.equal(g.boss.windup,0);g.boss.inv=0;g.boss.windup=1;g.boss.hurt(52,true);assert.equal(g.boss.windup,1);});

test('J second hit advances and third hit pushes only a neutral SURGEON',()=>{const g=game();g.engage();g.player.strike(false);frames(g,18);const x=g.player.x;g.player.strike(false);frames(g,9);assert.ok(g.player.x>=x+17);for(const casting of [false,true]){const h=game();h.engage();h.player.combo=2;h.player.x=h.boss.x-35;h.boss.windup=casting?1:0;const bx=h.boss.x;h.player.strike(false);frames(h,12);assert.ok(casting?h.boss.x===bx:h.boss.x>=bx+24);}});
test('R can be interrupted before its strike becomes active',()=>{const g=game();g.engage();g.player.x=g.boss.x-40;g.player.superMeter=100;g.player.skill(3);g.player.damage(10,-1);frames(g,35);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.player.attack,0);assert.equal(g.player.finishWindow,0);});
test('first boss can be cleared with normal stats, spacing, evasion and confirms',()=>{
  const g=game();g.engage();g.boss.t=1.4;
  for(let frame=0;frame<7200&&g.state==='combat';frame++){
    const p=g.player,b=g.boss,dist=b.x-p.x,dir=Math.sign(dist)||1;g.keys.clear();
    if(b.dead){g.step(1/60);continue;}
    let move=Math.abs(dist)>43?dir:0;
    if(b.windup>0&&b.move%3===1&&Math.abs(p.x+9-b.target.x)<70)move=p.x<350?1:-1;
    if(move)g.keys.add(move>0?'d':'a');
    if(b.windup>0&&b.move%3===0&&b.windup<.35&&p.onGround)g.pressed.add(' ');
    const threat=g.hazards.some(h=>h.owner==='b'&&h.delay<=.05&&Math.hypot(h.x-(p.x+9),h.y-(p.y+24))<48);
    if(threat&&p.dash<=0&&p.sp>=12)g.pressed.add('shift');
    if(p.finishWindow>0&&p.sp>=55&&p.cool[3]<=0)g.pressed.add('r');
    else if(p.linkWindow>0&&p.sp>=24&&Math.abs(dist)<60)g.pressed.add('q');
    else if(p.attack<=0&&Math.abs(dist)<65)g.pressed.add('j');
    g.step(1/60);
  }
  assert.equal(g.state,'reward');assert.ok(g.player.hp>0);assert.equal(g.boss.hp,0);
});

test('Q link requires a recent hit and sufficient SP',()=>{const g=game();g.engage();g.player.cool[0]=3;g.player.strike(false);g.press('q');frames(g,20);assert.equal(g.player.attackDuration,.24);g.player.x=g.boss.x-35;g.player.strike(false);for(let i=0;i<20&&g.player.linkWindow<=0;i++)g.step(1/60);g.player.sp=23;g.player.skill(0);assert.equal(g.player.attackDuration,.27);g.player.sp=100;frames(g,25);g.player.skill(0);assert.equal(g.player.attackDuration,.27);});
test('taking damage removes Q link permission',()=>{const g=game();g.engage();g.player.x=g.boss.x-35;g.player.strike(false);for(let i=0;i<20&&g.player.linkWindow<=0;i++)g.step(1/60);assert.ok(g.player.linkWindow>0);g.player.damage(1,1);assert.equal(g.player.linkWindow,0);});

test('whiff has no camera kick and contact scales without moving boss hitbox',()=>{const g=game();g.engage();g.player.skill(1);assert.equal(g.feedback.shake,0);const x=g.boss.x,y=g.boss.y;g.boss.hurt(12);const light=g.feedback.hitstop;assert.ok(g.boss.recoil>0);g.boss.inv=0;g.boss.hurt(52);assert.ok(g.feedback.hitstop>light);assert.ok(g.feedback.shake<=1.8);assert.equal(g.boss.x,x);assert.equal(g.boss.y,y);assert.equal(g.boss.hp,g.boss.maxHp-64);});
test('burst hits cap shake, labels and pause instead of accumulating them',()=>{const g=game();g.engage();g.boss.hp=g.boss.maxHp=10000;for(let i=0;i<20;i++){g.boss.inv=0;g.boss.hurt(12);}assert.ok(g.feedback.shake<=1.8);assert.ok(g.feedback.hitstop<=.065);assert.ok(g.feedback.numbers<=8);});
test('rapid repeated presses cannot overlap attack startups',()=>{const g=game();g.engage();for(let i=0;i<8;i++)g.press('j');assert.equal(g.player.combo,1);assert.equal(g.slashes.length,1);frames(g,15);assert.equal(g.player.combo,2);});
test('both walls contain dash and attacks without trapping the player',()=>{for(const [x,face,key] of [[8,-1,'d'],[453,1,'a']]){const g=game();g.engage();g.player.x=x;g.player.face=face;g.press('shift');g.press('j');frames(g,25);assert.ok(g.player.x>=8&&g.player.x<=453);g.keys.add(key);frames(g,20);assert.ok(face<0?g.player.x>30:g.player.x<430);}});
test('air attack preserves horizontal control and returns to floor',()=>{const g=game();g.engage();const x=g.player.x;g.press(' ');g.keys.add('d');frames(g,6);g.press('j');frames(g,8);assert.equal(g.player.onGround,false);assert.ok(g.player.x>x+15);assert.ok(g.player.attack>0);frames(g,80);assert.equal(g.player.onGround,true);assert.equal(g.player.y+g.player.h,226);});
test('hit during attack clears reservation and respects damage invulnerability',()=>{const g=game();g.engage();g.press('j');frames(g,6);g.press('j');g.player.damage(10,-1);assert.equal(g.player.buffer,null);assert.ok(g.player.stun>0);g.player.damage(10,1);assert.equal(g.player.hp,90);frames(g,42);g.player.damage(10,1);assert.equal(g.player.hp,80);});
test('boss dies during windup without emitting a late attack',()=>{const g=game();g.engage();g.boss.windup=.2;g.boss.move=1;g.boss.hurt(2000);frames(g,180);assert.equal(g.state,'reward');assert.equal(g.hazards.length,0);assert.equal(g.upgrade,1);});
test('restart resets input, particles and camera feedback',()=>{const g=game();g.engage();g.player.damage(100,1);frames(g,100);assert.equal(g.state,'gameover');g.press('enter');assert.equal(g.state,'intro');assert.equal(g.player.hp,g.player.maxHp);assert.equal(g.player.buffer,null);assert.equal(g.feedback.shake,0);assert.equal(g.feedback.hitstop,0);assert.equal(g.feedback.particles,0);});
test('jump input during hitstop is not lost',()=>{const g=game();g.engage();g.freeze(.065);g.press(' ');frames(g,6);assert.equal(g.player.onGround,false);assert.ok(g.player.vy<0);});
test('damage lift reports airborne without changing knockback velocity',()=>{const g=game();g.engage();g.player.damage(10,-1);assert.equal(g.player.onGround,false);assert.equal(g.player.vx,-95);assert.equal(g.player.vy,-90);});
test('contact sound occurs only on accepted damage, not during invulnerability',()=>{const g=game();g.engage();g.player.strike(false);const windupSounds=g.sounds.length;assert.equal(g.feedback.numbers,0);g.boss.hurt(12);assert.equal(g.sounds.length,windupSounds+2);const accepted=g.sounds.length;g.boss.hurt(12);assert.equal(g.sounds.length,accepted);});
test('hitstop uses fractional remainder at both frame rates',()=>{for(const dt of [1/30,1/60]){const g=game();g.engage();g.player.cool[0]=1;g.freeze(.022);g.step(dt);g.step(dt);assert.ok(Math.abs(g.player.cool[0]-(1-(2*dt-.022)))<.0001);}});

test('early J inputs link a three-hit combo with a stronger longer finisher',()=>{const g=game();g.engage();g.press('j');frames(g,8);g.press('j');assert.equal(g.player.combo,1);frames(g,8);assert.equal(g.player.combo,2);frames(g,6);g.press('j');frames(g,12);assert.equal(g.player.combo,3);const finisher=g.slashes.find(s=>s.combo===3);assert.equal(finisher.dmg,24);assert.equal(finisher.w,52);});
test('attack input during hitstop survives until action resumes',()=>{const g=game();g.engage();g.freeze(.08);g.press('j');assert.equal(g.player.attack,0);frames(g,8);assert.equal(g.player.combo,1);assert.ok(g.player.attack>0);});
test('holding J does not repeat or spend extra attacks',()=>{const g=game();g.engage();g.player.x=g.boss.x-30;g.dispatch('keydown',{code:'KeyJ',key:'j'});frames(g,90);assert.equal(g.boss.maxHp-g.boss.hp,12);});
test('expired inputs cannot launch a delayed surprise attack',()=>{const g=game();g.engage();g.player.strike(true);g.press('j');frames(g,40);assert.equal(g.player.attack,0);assert.equal(g.player.combo,0);assert.equal(g.player.buffer,null);});
test('damage and pause discard pending attacks',()=>{for(const cancel of ['damage','pause']){const g=game();g.engage();g.press('j');frames(g,6);g.press('j');if(cancel==='damage')g.player.damage(5,1);else{g.press('escape');g.press('escape');}frames(g,40);assert.equal(g.player.combo,cancel==='damage'?0:1);assert.equal(g.player.buffer,null);}});

test('charge is canceled immediately on taking damage',()=>{const g=game();g.engage();g.dispatch('keydown',{code:'KeyK',key:'k'});frames(g,50);g.player.damage(5,1);g.dispatch('keyup',{code:'KeyK',key:'k'});frames(g,20);assert.equal(g.slashes.length,0);assert.equal(g.player.charging,false);});
test('full charge interrupts SURGEON casting and creates a punish window',()=>{const g=game();g.engage();g.player.x=g.boss.x-80;g.player.face=1;g.boss.windup=.8;g.boss.windupMax=1;g.boss.target={x:80,y:200};g.player.strike(true,1);frames(g,12);assert.equal(g.boss.windup,0);assert.ok(g.boss.recovery>1.5);assert.equal(g.hazards.length,0);assert.ok(g.boss.maxHp-g.boss.hp>=65);});
test('SURGEON recovery takes more damage than neutral',()=>{const g=game();g.engage();g.boss.hurt(20);const neutral=g.boss.maxHp-g.boss.hp;g.boss.inv=0;g.boss.recovery=1;const hp=g.boss.hp;g.boss.hurt(20);assert.equal(hp-g.boss.hp,neutral*1.25);});
test('SURGEON target locks during warning and moving away avoids needles',()=>{const g=game();g.engage();g.player.x=220;g.boss.t=0;g.step();const target=g.boss.target.x;assert.ok(g.boss.windup>=.8);g.keys.add('d');frames(g,45);g.keys.delete('d');assert.equal(g.boss.target.x,target);frames(g,95);assert.equal(g.player.hp,100);});
test('standing in SURGEON needle warning takes damage',()=>{const g=game();g.engage();g.player.x=220;g.boss.t=0;frames(g,135);assert.ok(g.player.hp<100);});
test('SURGEON low incision can be jumped',()=>{const g=game();g.engage();g.boss.move=3;g.player.x=g.boss.x-60;g.press(' ');frames(g,8);g.boss.act();frames(g,25);assert.equal(g.player.hp,100);});
test('cloak margin is not a hurtbox while torso remains vulnerable',()=>{const g=game();g.engage();g.hazards.push({kind:'needle',owner:'b',x:g.player.x+1,y:g.player.y+20,r:1,life:1,dmg:10});g.step();assert.equal(g.player.hp,100);g.hazards.push({kind:'needle',owner:'b',x:g.player.x+9,y:g.player.y+20,r:2,life:1,dmg:10});g.step();assert.equal(g.player.hp,90);});
test('corridor drone locks a readable shot that can be dodged',()=>{const g=game();g.startExplore();g.player.x=445;g.step();g.player.x=150;g.room.drones[1].hp=0;g.room.drones[0].t=0;g.step();const shot=g.hazards[0];assert.ok(shot.delay>=.7);const velocity=shot.vx;g.keys.add('a');frames(g,50);g.keys.delete('a');assert.equal(shot.vx,velocity);g.press(' ');frames(g,50);assert.equal(g.player.hp,100);});

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
test('Korean IME and shifted letters use physical key codes',()=>{const g=game();g.engage();const x=g.player.x;g.dispatch('keydown',{code:'KeyD',key:'ㅇ',isComposing:true});frames(g,30);assert.ok(g.player.x>x+25);g.dispatch('keyup',{code:'KeyD',key:'D'});assert.equal(g.keys.has('d'),false);g.dispatch('keydown',{code:'KeyA',key:'Process'});assert.ok(g.keys.has('a'));g.dispatch('keyup',{code:'KeyA',key:'ㅁ'});assert.equal(g.keys.has('a'),false);});
test('arrow movement and two shift keys release independently',()=>{const g=game();g.engage();g.dispatch('keydown',{code:'ArrowRight',key:'ArrowRight'});assert.ok(g.keys.has('d'));g.dispatch('keyup',{code:'ArrowRight',key:'ArrowRight'});assert.equal(g.keys.has('d'),false);g.dispatch('keydown',{code:'ShiftLeft',key:'Shift'});g.dispatch('keydown',{code:'ShiftRight',key:'Shift'});g.dispatch('keyup',{code:'ShiftLeft',key:'Shift'});assert.ok(g.keys.has('shift'));g.dispatch('keyup',{code:'ShiftRight',key:'Shift'});assert.equal(g.keys.has('shift'),false);});
test('window blur clears held input and pauses gameplay',()=>{const g=game();g.engage();g.dispatch('keydown',{code:'KeyD',key:'d'});g.dispatch('blur',{});assert.equal(g.keys.size,0);assert.equal(g.paused,true);});

function parrySetup(){const g=game();g.engage(0);g.player.x=g.boss.x-55;g.player.face=1;g.boss.move=0;g.boss.dir=-1;g.boss.act();g.slashes[0].delay=0;g.dispatch('keydown',{code:'KeyK',key:'k'});return g;}
test('parry cannot be rearmed by a rapid second charge and cannot block other bosses',()=>{
  const g=parrySetup();g.step();g.freeze(0);g.dispatch('keyup',{code:'KeyK',key:'k'});g.step();frames(g,29);g.dispatch('keydown',{code:'KeyK',key:'k'});g.step();assert.equal(g.player.parryWindow,0);
  const h=game();h.engage(1);h.dispatch('keydown',{code:'KeyK',key:'k'});h.step();assert.equal(h.player.parryWindow,0);h.player.parryWindow=.12;assert.equal(h.player.tryParry({owner:'b',kind:'scalpel',parryable:true,dir:-1}),false);
});
test('J pressed during parry hitstop is retained for the counter',()=>{const g=parrySetup();g.step();g.dispatch('keydown',{code:'KeyJ',key:'j'});g.step(.01);g.dispatch('keyup',{code:'KeyJ',key:'j'});frames(g,4);assert.equal(g.player.charging,false);assert.equal(g.player.weaponMode,'kick');assert.ok(g.player.attack>0);});

function protocolSetup(x=230){const g=game();g.engage();g.boss.phase=2;g.player.x=x;g.step();assert.ok(g.boss.protocol);return g;}
test('protocol locks each wave, runs twice then one low finisher, and does not repeat',()=>{
  const g=protocolSetup();const locked=g.boss.target.x;g.player.x=100;g.step();assert.equal(g.boss.target.x,locked);
  const waves=new Set();let finalSeen=false;for(let i=0;i<420;i++){if(g.boss.protocol)waves.add(g.boss.protocol.wave);if(g.slashes.some(s=>s.protocolFinal))finalSeen=true;g.step(1/60);}
  assert.deepEqual([...waves],[0,1,2]);assert.equal(finalSeen,true);assert.equal(g.boss.protocol,null);assert.equal(g.boss.protocolUsed,true);
  frames(g,180);assert.equal(g.boss.protocol,null);
});
test('protocol is avoidable without parry at both walls and center at 30/60 fps',()=>{
  for(const dt of [1/30,1/60])for(const x of [8,230,453]){
    const g=protocolSetup(x);let elapsed=0;
    while(elapsed<6.6){g.keys.clear();const b=g.boss,p=g.player;
      if(b.protocol&&b.protocol.wave<2){const target=b.target.x,dir=target<240?1:-1;if(Math.abs(p.x+9-target)<125)g.keys.add(dir>0?'d':'a');}
      else if(b.protocol?.wave===2&&b.windup<.2&&p.onGround)g.pressed.add(' ');
      g.step(dt);elapsed+=dt;
    }
    assert.equal(g.player.hp,100,`x=${x}, dt=${dt}`);assert.equal(g.player.parryFollow,0);
  }
});
test('maximum charge interrupts protocol and clears its pending hazards without restarting it',()=>{
  const g=protocolSetup();frames(g,55);assert.ok(g.hazards.some(h=>h.protocol));g.boss.beginProtocolCast(1);g.boss.inv=0;g.boss.hurt(52,true);
  assert.equal(g.boss.protocol,null);assert.equal(g.hazards.some(h=>h.protocol),false);assert.ok(g.boss.recovery>0);frames(g,180);assert.equal(g.boss.protocol,null);
});
test('protocol pauses, cancels on boss death, and resets on first-boss retry',()=>{
  const g=protocolSetup();g.press('escape');const remaining=g.boss.protocol.timer;frames(g,90);assert.equal(g.boss.protocol.timer,remaining);g.press('escape');g.boss.inv=0;g.boss.hurt(9999);assert.equal(g.boss.protocol,null);assert.equal(g.hazards.length,0);g.startBoss(0);assert.equal(g.boss.protocolUsed,undefined);
});
test('only the protocol final parry adds an opening, without damage or a stun chain',()=>{
  const g=protocolSetup(320);g.boss.beginProtocolCast(2);g.boss.protocol.timer=.01;g.step();assert.equal(g.slashes[0].protocolFinal,true);const hp=g.boss.hp;
  g.dispatch('keydown',{code:'KeyK',key:'k'});g.slashes[0].delay=0;g.step();assert.equal(g.player.hp,100);assert.equal(g.boss.hp,hp);assert.ok(g.boss.recovery>=2);assert.equal(g.player.inv,0);
});
test('SURGEON release sprite keeps the committed attack direction when crossed',()=>{const g=game();g.engage();g.boss.dir=-1;g.boss.move=0;g.boss.act();g.player.x=440;g.step();assert.equal(g.boss.dir,-1);assert.equal(g.slashes[0].dir,-1);});

test('SURGEON telegraphs a damage-triggered retreat without invulnerability or an automatic hit',()=>{
  const g=game();g.engage();g.boss.x=300;g.player.x=265;g.boss.hurt(43);g.freeze(0);g.step();assert.ok(g.boss.retreat);const x=g.boss.x;frames(g,15);assert.equal(g.boss.x,x);assert.equal(g.player.hp,100);g.boss.inv=0;const hp=g.boss.hp;g.boss.hurt(12);assert.ok(g.boss.hp<hp);frames(g,36);assert.ok(g.boss.x>x+40);assert.equal(g.player.hp,100);assert.ok(g.boss.retreatCooldown>3);
});
test('retreat waits for punish windows and never clips outside either wall',()=>{
  for(const x of [45,395]){const g=game();g.engage();g.boss.x=x;g.player.x=x===45?100:330;g.boss.recovery=1;g.boss.hurt(68);g.freeze(0);frames(g,10);assert.equal(g.boss.retreat,undefined);g.boss.recovery=0;g.boss.pressure=50;frames(g,60);assert.ok(g.boss.x>=45&&g.boss.x<=395);assert.equal(g.player.hp,100);}
});
test('E anchors SURGEON during retreat windup but does not cancel its attacks',()=>{
  const g=game();g.engage();g.boss.x=300;g.player.x=255;g.boss.hurt(43);g.freeze(0);g.step();assert.ok(g.boss.retreat);g.boss.inv=0;g.player.skill(2);frames(g,23);assert.ok(g.boss.anchorTime>0);assert.equal(g.boss.retreat,null);assert.equal(g.boss.x,300);g.boss.windup=.5;g.boss.move=0;g.boss.anchor();frames(g,35);assert.ok(g.slashes.some(s=>s.owner==='b'));
});
test('first-operation Q requires an opening and a hit interrupts future chain strikes',()=>{
  const g=game();g.engage();g.player.skill(0);assert.equal(g.player.inv,0);g.player.damage(8,1);assert.equal(g.player.attack,0);assert.equal(g.slashes.length,0);
  const h=game();h.engage(1);h.player.skill(0);assert.equal(h.player.inv,.5);assert.equal(h.player.duelMode,false);
});
test('first-operation attack facing stays aligned with the hit while moving backwards',()=>{
  const g=game();g.engage();g.player.face=1;g.player.strike(false);g.keys.add('a');frames(g,5);assert.equal(g.player.face,1);assert.equal(g.slashes[0].dir,1);assert.ok(g.player.vx<0);
  const h=game();h.engage(1);h.player.strike(false);h.keys.add('a');frames(h,5);assert.equal(h.player.face,-1);
});
test('moving kick startup follows the leg before contact, then commits its position',()=>{
  const g=game();g.engage();g.player.x=200;g.player.strike(false);g.keys.add('d');g.step();assert.equal(g.slashes[0].x,g.player.x+14);frames(g,5);const x=g.slashes[0].x;frames(g,3);assert.equal(g.slashes[0].x,x);
});
test('first-operation backdash cancels attack while preserving facing',()=>{const g=game();g.engage();g.player.x=200;g.player.face=1;g.player.strike(false);g.keys.add('a');g.press('shift');frames(g,5);assert.ok(g.player.x<180);assert.equal(g.player.face,1);assert.equal(g.player.attack,0);});

test('reverse drive is earned through defense, expires, and is not active in later bosses',()=>{
  const g=parrySetup();g.step();assert.equal(g.player.reverseDrive,1);assert.ok(g.player.driveTime>5);g.freeze(0);g.keys.clear();frames(g,370);assert.equal(g.player.reverseDrive,0);
  const h=game();h.engage(1);h.player.recoverDrive();assert.equal(h.player.reverseDrive,0);h.player.skill(0);assert.equal(h.player.weaponMode,'triple');assert.equal(h.slashes.length,3);
});
test('propulsion advances without phasing through the boss or escaping arena walls',()=>{
  for(const boosted of [false,true]){const g=game();g.engage();g.player.x=g.boss.x-45;if(boosted)g.player.recoverDrive();g.player.skill(0);frames(g,25);assert.ok(g.player.x+g.player.w<=g.boss.x);assert.ok(g.boss.hp<g.boss.maxHp);}
  for(const [x,face] of [[8,-1],[453,1]]){const g=game();g.engage();g.player.x=x;g.player.face=face;g.player.recoverDrive();g.player.skill(0);frames(g,35);assert.ok(g.player.x>=8&&g.player.x<=453);}
});
test('boss retreat becomes a telegraphed counter instead of free idle time',()=>{
  const g=game();g.engage();g.boss.x=300;g.player.x=255;g.boss.hurt(43);g.freeze(0);frames(g,80);assert.equal(g.boss.move,2);assert.ok(g.boss.windup>0);const aim=g.boss.target.x;g.player.x=30;frames(g,5);assert.equal(g.boss.target.x,aim);assert.equal(g.player.hp,100);
});

test('whiff cannot compress K or bypass attack recovery',()=>{
  const g=game();g.engage();g.player.strike(false);g.keys.add('k');g.press('k');
  assert.equal(g.player.charging,false);assert.ok(g.player.attack>0);
});

test('SURGEON aimed volley leaves approach time after its distant projectile arrives',()=>{
  const recoveries=[];
  for(const x of [280,60]){const g=game();g.engage();g.player.x=x;
    g.boss.move=2;g.boss.dir=-1;g.boss.target={x:x+9,y:201};g.boss.windup=.01;
    g.step(1/60);const recovery=g.boss.recovery;recoveries.push(recovery);
    assert.ok(recovery>=1.35&&recovery<=2.6);assert.equal(g.hazards.length,3);
    g.player.x=440;g.step(1/60);assert.ok(g.boss.recovery<recovery);
  }
  assert.ok(recoveries[1]>recoveries[0]+1);
});

test('first-operation jump buffers a press just before landing without repeating held input',()=>{
  const g=game();g.engage();g.player.y=172;g.player.onGround=false;g.player.vy=110;
  g.keys.add(' ');g.press(' ');assert.ok(g.player.jumpBuffer>0);
  for(let i=0;i<8&&g.player.vy>=0;i++)g.step(1/60);
  assert.ok(g.player.vy<0);assert.equal(g.player.jumpBuffer,0);
  frames(g,65);assert.equal(g.player.onGround,true);assert.equal(g.player.vy,0);
});
test('jump buffer expires when pressed too early and is cleared by damage',()=>{
  const g=game();g.engage();g.player.y=80;g.player.onGround=false;g.player.vy=10;
  g.press(' ');frames(g,50);assert.equal(g.player.onGround,true);assert.equal(g.player.jumpBuffer,0);
  g.player.jumpBuffer=.1;g.player.damage(5,1);assert.equal(g.player.jumpBuffer,0);
});
test('short support grace permits one jump only and landing pose does not lock movement',()=>{
  const g=game();g.engage();g.step();g.player.onGround=false;g.player.y-=4;
  g.press(' ');assert.ok(g.player.vy<0);const vy=g.player.vy;g.press(' ');assert.ok(g.player.vy>vy);
  g.player.y=177;g.player.vy=120;g.step();assert.ok(g.player.landing>0);
  const x=g.player.x;g.keys.add('d');frames(g,4);assert.ok(g.player.x>x);g.press('j');assert.ok(g.player.attack>0);
});

test('destroying a first-operation sentry cancels its queued shot, not released projectiles',()=>{
  for(const released of [false,true]){const g=game();g.startExplore();g.player.x=445;g.step();
    const d=g.room.drones[0];d.t=0;g.room.drones[1].t=999;g.step();
    const shot=g.hazards.find(h=>h.source===d);assert.ok(shot);
    if(released)shot.delay=0;d.hp=0;g.step();
    assert.equal(g.hazards.includes(shot),released);
  }
});

test('J3 cannot displace SURGEON during committed release, recovery or protocol',()=>{
  for(const state of ['release','recovery','protocol']){const g=game();g.engage();g.player.x=g.boss.x-35;g.player.combo=2;
    if(state==='protocol')g.boss.protocol={wave:0,waiting:true,timer:2};else g.boss[state]=1;
    const x=g.boss.x;g.player.strike(false);frames(g,12);assert.equal(g.boss.x,x);
  }
});
test('charged piston reaches by propelling ZERO, remains inside walls and cannot cross the boss',()=>{
  const g=game();g.engage();g.player.x=150;g.player.strike(true,1);const x=g.player.x;
  frames(g,9);assert.ok(g.player.x>=x+31);assert.equal(g.slashes[0].w,48);
  for(const [x,face] of [[453,1],[8,-1],[340,1]]){const h=game();h.engage();h.player.x=x;h.player.face=face;h.player.strike(true,1);frames(h,15);
    assert.ok(h.player.x>=8&&h.player.x<=453);if(x===340)assert.ok(h.player.x+h.player.w<=h.boss.x);
  }
  const later=game();later.engage(1);later.player.strike(true,1);assert.equal(later.slashes[0].w,104);assert.equal(later.player.stepRemaining,0);
});

// BUILD18 replaces charge-to-release K and Q-bound drive with the approved controls.
test('K tap or hold performs one finite parry and never releases an attack',()=>{
  const g=game();g.engage();g.dispatch('keydown',{code:'KeyK',key:'k'});g.step();
  assert.ok(g.player.parryWindow>0);assert.equal(g.player.charging,true);
  frames(g,90);assert.equal(g.player.charging,false);assert.equal(g.slashes.length,0);assert.equal(g.player.charge,0);
  g.dispatch('keyup',{code:'KeyK',key:'k'});g.step();assert.equal(g.slashes.length,0);
});
test('K parry survives hitstop, cannot refresh by holding, and cancels on blur',()=>{
  const g=game();g.engage();g.freeze(.08);g.dispatch('keydown',{code:'KeyK',key:'k'});frames(g,7);assert.ok(g.player.parryWindow>0);
  const window=g.player.parryWindow;g.dispatch('keydown',{code:'KeyK',key:'k',repeat:true});g.step();assert.ok(g.player.parryWindow<window);
  g.dispatch('blur',{});assert.equal(g.player.charging,false);assert.equal(g.slashes.length,0);
});
test('successful K parry earns meter and a powered Shift follow-up without direct damage',()=>{
  for(const dt of [1/30,1/60]){const g=parrySetup();const hp=g.boss.hp;g.step(dt);assert.equal(g.player.hp,100);assert.equal(g.boss.hp,hp);assert.equal(g.player.reverseDrive,1);assert.equal(g.player.superMeter,14);
    g.freeze(0);g.press('shift');assert.equal(g.player.weaponMode,'drive');assert.equal(g.player.reverseDrive,0);assert.ok(g.player.sp>=92&&g.player.sp<94);
  }
});
test('parry rejects early timing, air and a rear projectile',()=>{
  for(const mode of ['early','air','rear']){const g=game();g.engage();g.player.x=g.boss.x-50;g.press('k');
    if(mode==='early')frames(g,15);if(mode==='air')g.player.onGround=false;
    assert.equal(g.player.tryParry({owner:'b',kind:'scalpel',parryable:true,dir:mode==='rear'?1:-1}),false,mode);
  }
});
test('forward Shift is a two-contact drive at both frame rates; back Shift evades without attacks',()=>{
  for(const dt of [1/30,1/60]){const g=game();g.engage();g.player.x=g.boss.x-40;g.press('shift');for(let i=0;i<35;i++)g.step(dt);assert.equal(g.boss.maxHp-g.boss.hp,26);}
  const g=game();g.engage();g.player.x=200;g.keys.add('a');g.press('shift');assert.ok(g.player.dash>0);assert.ok(g.player.inv>0);assert.equal(g.slashes.length,0);frames(g,10);assert.ok(g.player.x<160);assert.equal(g.player.face,1);
});
test('back Shift during hitstop cancels a queued attack when simulation resumes',()=>{
  const g=game();g.engage();g.player.x=200;g.press('q');g.freeze(.08);g.keys.add('a');g.press('shift');frames(g,7);
  assert.ok(g.player.dash>0);assert.equal(g.player.attack,0);assert.equal(g.slashes.filter(s=>s.delay>0).length,0);
});
test('Q is an aerial rising strike, not the old drive',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-35;g.press('q');assert.equal(g.player.weaponMode,'riser');assert.ok(g.player.vy<0);assert.equal(g.player.onGround,false);assert.equal(g.player.inv,0);
  frames(g,14);assert.equal(g.boss.maxHp-g.boss.hp,23);assert.ok(g.player.y<150);
});
test('J confirms into Q and E while whiffs must finish recovery',()=>{
  for(const key of ['q','e']){const g=game();g.engage();g.player.x=g.boss.x-35;g.press('j');for(let i=0;i<20&&!g.player.linkWindow;i++)g.step();g.freeze(0);g.press(key);assert.equal(g.player.weaponMode,key==='q'?'riser':'hook');}
  const g=game();g.engage();g.press('j');g.press('q');assert.equal(g.player.weaponMode,'kick');frames(g,20);assert.equal(g.player.weaponMode,'kick');g.press('q');assert.equal(g.player.weaponMode,'riser');
});
test('W fires from the moving leg and recoils after discharge, with no floor pillar',()=>{
  const g=game();g.engage();g.player.x=250;g.player.skill(1);const x=g.player.x;assert.equal(g.hazards[0].kind,'rail');assert.equal(g.player.stepRemaining,0);
  frames(g,8);assert.ok(g.hazards[0].delay>0);frames(g,12);assert.ok(g.player.x<x-10);frames(g,35);assert.ok(g.boss.hp<g.boss.maxHp);
});
test('E is a directional heel hook that anchors SURGEON without spawning ground objects',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-45;g.player.skill(2);assert.equal(g.hazards.length,0);assert.equal(g.slashes[0].kind,'hook');frames(g,15);assert.ok(g.boss.anchorTime>0);assert.equal(g.boss.maxHp-g.boss.hp,18);
});
test('new skills obey SP and short cooldowns, while R requires earned meter',()=>{
  for(const i of [0,1,2]){const g=game();g.engage();g.player.sp=0;g.player.skill(i);assert.equal(g.player.attack,0);g.player.sp=100;g.player.skill(i);const sp=g.player.sp;g.player.skill(i);assert.equal(g.player.sp,sp);}
  const g=game();g.engage();g.player.skill(3);assert.equal(g.player.attack,0);g.boss.hurt(100);assert.equal(g.player.superMeter,35);
});
test('R whiff spends meter without invulnerability or a cinematic lock',()=>{
  const g=game();g.engage();g.player.superMeter=100;g.press('r');assert.equal(g.player.superMeter,0);assert.equal(g.player.inv,0);frames(g,40);assert.equal(g.player.ultimateT,0);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.player.attack,0);
});
test('confirmed R performs four contacts and defers the phase transition until recovery',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-35;g.player.superMeter=100;g.boss.hp=430;g.press('r');
  for(let i=0;i<30&&g.player.ultimateT<=0;i++)g.step();assert.ok(g.player.ultimateT>0);assert.ok(g.boss.superLock>0);assert.equal(g.boss.phase,1);
  let deferred=false;for(let i=0;i<110;i++){g.step();if(g.boss.hp<g.boss.maxHp*.5&&g.boss.superLock>0){deferred=true;assert.equal(g.boss.phase,1);}}
  assert.equal(deferred,true);assert.ok(g.boss.hp<=320);assert.equal(g.boss.phase,2);assert.equal(g.player.ultimateT,0);assert.equal(g.player.superMeter,0);
});
test('R startup can be interrupted and boss death clears the confirmed sequence',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-35;g.player.superMeter=100;g.press('r');g.player.damage(10,-1);frames(g,65);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.player.ultimateT,0);
  const h=game();h.engage();h.player.x=h.boss.x-35;h.player.superMeter=100;h.boss.hp=20;h.press('r');frames(h,100);assert.equal(h.boss.dead,true);assert.equal(h.player.ultimateT,0);assert.equal(h.slashes.length,0);
});
test('ultimate freezes correctly on pause and cannot be restarted by repeated R',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-35;g.player.superMeter=100;g.press('r');frames(g,15);g.press('escape');const t=g.player.ultimateT;assert.ok(t>0);frames(g,50);assert.equal(g.player.ultimateT,t);g.press('escape');g.press('r');frames(g,90);assert.equal(g.player.superMeter,0);assert.equal(g.player.ultimateT,0);
});
test('damage cancels unreleased W but preserves a discharged projectile',()=>{
  for(const released of [false,true]){const g=game();g.engage();g.player.skill(1);if(released)g.hazards[0].delay=0;g.player.damage(10,-1);assert.equal(g.hazards.length,released?1:0);}
});
test('J sweep VFX appears on active frames without adding whiff damage or camera shake',()=>{
  const g=game();g.engage();g.press('j');frames(g,6);assert.ok(g.feedback.particles>0);assert.equal(g.feedback.shake,0);assert.equal(g.boss.hp,g.boss.maxHp);
});
test('later-boss K charge and Q remain unchanged',()=>{
  const g=game();g.engage(1);g.dispatch('keydown',{code:'KeyK',key:'k'});frames(g,45);assert.equal(g.player.charging,true);assert.equal(g.player.chargeLevel,2);g.dispatch('keyup',{code:'KeyK',key:'k'});g.step();assert.equal(g.slashes[0].dmg,52);
  const h=game();h.engage(1);h.player.skill(0);assert.equal(h.player.weaponMode,'triple');assert.equal(h.slashes.length,3);
});

test('Shift preserves back-direction intent even if the direction is released before the frame',()=>{
  const g=game();g.engage();g.player.x=250;g.dispatch('keydown',{code:'KeyA',key:'a'});g.dispatch('keydown',{code:'ShiftLeft',key:'Shift'});g.dispatch('keyup',{code:'KeyA',key:'a'});g.step();assert.ok(g.player.dash>0);assert.equal(g.player.dashDir,-1);assert.equal(g.slashes.length,0);
});
test('rapid J on hit cannot cancel its own recovery into unbounded damage',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-35;g.press('j');for(let i=0;i<20&&!g.player.linkWindow;i++)g.step();g.freeze(0);g.press('j');assert.equal(g.player.combo,1);frames(g,15);assert.equal(g.player.combo,2);
});
test('airborne Q descends and cannot create an infinite rising loop',()=>{
  const g=game();g.engage();g.press(' ');frames(g,8);g.press('q');assert.ok(g.player.vy>0);frames(g,65);assert.equal(g.player.onGround,true);
});

test('first-corridor sentry shots can be parried before reaching SURGEON',()=>{
  const g=game();g.startExplore();g.press('k');g.hazards.push({kind:'needle',owner:'b',x:g.player.x+9,y:g.player.y+24,vx:-85,vy:0,r:4,delay:0,life:1,dmg:8});g.step();assert.equal(g.player.hp,100);assert.equal(g.player.superMeter,14);assert.equal(g.player.reverseDrive,1);assert.equal(g.hazards.length,0);
});
test('earned corridor meter carries into SURGEON but resets after a boss retry',()=>{
  const g=game();g.startExplore();g.player.superMeter=45;g.startBoss(0);assert.equal(g.player.superMeter,45);g.press('enter');g.player.damage(999,1);frames(g,100);g.press('enter');assert.equal(g.player.superMeter,0);
});

test('E catches retreat then Q breaks the anchored joint for one extended opening',()=>{
  for(const dt of [1/30,1/60]){const g=game();g.engage();g.boss.x=300;g.player.x=255;g.boss.hurt(43);g.freeze(0);g.step(dt);g.boss.inv=0;
    g.press('e');for(let i=0;i<30&&!g.player.linkWindow;i++)g.step(dt);
    assert.ok(g.boss.anchorTime>0);assert.equal(g.boss.retreat,null);
    g.freeze(0);const meter=g.player.superMeter;g.press('q');for(let i=0;i<30&&!g.boss.breakLock;i++)g.step(dt);
    assert.ok(g.boss.breakLock>3.5);assert.equal(g.boss.anchorTime,0);assert.ok(g.boss.recovery>=.9);assert.ok(g.player.superMeter>meter+10);
    const t=g.boss.recovery,m=g.player.superMeter;g.boss.anchorTime=1;
    assert.equal(g.boss.breakAnchor(),false);assert.equal(g.player.superMeter,m);assert.equal(g.boss.recovery,t);
  }
});
test('joint break rejects active attacks, protocol, phase change, neutral and later bosses',()=>{
  for(const state of ['windup','release','tele','protocol','neutral','dead','superLock']){const g=game();g.engage();g.boss.anchorTime=1;g.boss.recovery=.5;
    if(state==='neutral')g.boss.recovery=0;else g.boss[state]=state==='protocol'?{wave:0}:1;
    assert.equal(g.boss.breakAnchor(),false,state);assert.equal(g.player.superMeter,0);assert.equal(g.boss.anchorTime,1);
  }
  const g=game();g.engage(1);g.boss.anchorTime=1;g.boss.recovery=1;assert.equal(g.boss.breakAnchor(),false);
});
test('W contact opens a recovery cancel, but a whiff or rejected hit does not',()=>{
  for(const protectedBoss of [false,true]){const g=game();g.engage();g.player.x=g.boss.x-45;if(protectedBoss)g.boss.inv=1;
    g.press('w');for(let i=0;i<20&&!g.player.linkWindow;i++)g.step(1/60);
    if(protectedBoss){assert.equal(g.player.linkWindow,0);continue;}
    assert.ok(g.player.attack>0);g.freeze(0);g.press('q');assert.equal(g.player.weaponMode,'riser');
  }
  const g=game();g.engage();g.press('w');frames(g,28);assert.equal(g.player.linkWindow,0);
});
test('late W projectile cannot grant a cancel to a different attack',()=>{
  const g=game();g.engage();g.player.x=g.boss.x-150;g.press('w');
  frames(g,27);g.player.strike(false);const hp=g.boss.hp;frames(g,9);
  assert.ok(g.boss.hp<hp);assert.equal(g.player.linkWindow,0);
});

test('a projectile from an older W cannot confirm a newer W cast',()=>{
  const g=game();g.engage();g.player.x=65;g.player.skill(1);const old=g.hazards[0];
  g.player.cool[1]=0;g.player.skill(1);assert.notEqual(old.castId,g.player.attackSerial);
  old.x=g.boss.x+5;old.y=g.boss.y+30;old.delay=0;const hp=g.boss.hp;g.step();
  assert.ok(g.boss.hp<hp);assert.equal(g.player.linkWindow,0);
});
