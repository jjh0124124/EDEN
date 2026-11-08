const {test}=require('node:test'),assert=require('node:assert/strict');
const {game}=require('./game-harness.cjs');
const frames=(g,n=60,dt=1/60)=>{for(let i=0;i<n;i++)g.step(dt);};
function duel(){const g=game(true);g.engage();g.player.x=g.boss.x-40;return g;}
test('psychic J is a directional poke, W a committed palm, E a close grab; no rail or automatic third kick',()=>{
 for(const [key,kind,damage] of [['j','psiJab',12],['w','psiPalm',32],['e','psiGrab',18]]){const g=duel();if(key==='e')g.player.x=g.boss.x-28;g.press(key);assert.equal(g.slashes[0].kind,kind);frames(g,28);assert.ok(g.boss.hp<g.boss.maxHp);assert.equal(g.hazards.length,0);assert.equal(g.player.combo,0);}
});
test('Shift moves in either direction with no contact damage and respects walls',()=>{
 for(const [x,dir] of [[8,-1],[453,1],[320,1]]){const g=duel();g.player.x=x;g.keys.add(dir===1?'d':'a');g.press('shift');frames(g,20);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.slashes.length,0);assert.ok(g.player.x>=8&&g.player.x<=453);}
});
test('jab confirms Q or W, but repeated J cannot cancel recovery and a whiff cannot confirm',()=>{
 const g=duel();g.press('j');frames(g,8);assert.ok(g.player.linkWindow>0);g.freeze(0);g.press('w');assert.equal(g.player.weaponMode,'psiPalm');
 const h=duel();h.player.x=65;h.press('j');h.press('w');assert.equal(h.player.weaponMode,'psiJab');
 const j=duel();j.press('j');frames(j,8);j.freeze(0);j.press('j');assert.equal(j.player.attackSerial,1);
});
test('guard has a visible warning and never retroactively blocks the triggering poke',()=>{
 const g=duel();g.boss.psiGuardPending=true;g.step();assert.ok(g.boss.psiGuardWarn>0);assert.equal(g.boss.psiGuard||0,0);g.boss.update(.1);assert.ok(g.boss.psiGuardWarn>0);frames(g,20);assert.ok(g.boss.psiGuard>0);
});
test('frontal guard blocks hits and super confirmation; rear attack and close grab defeat guard',()=>{
 for(const kind of ['j','r','e','rear']){const g=duel();g.boss.psiGuard=.65;g.boss.dir=-1;g.player.superMeter=100;if(kind==='rear'){g.player.x=g.boss.x+50;g.player.face=-1;}g.press(kind==='rear'?'j':kind);frames(g,20);if(kind==='j'||kind==='r'){assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.player.linkWindow,0);assert.equal(g.player.ultimateT,0);}else{assert.ok(g.boss.hp<g.boss.maxHp);if(kind==='e')assert.ok(g.boss.psiGrabLock>0);}}
});
test('grab fails during committed attack, cannot chain lock, and whiff leaves recovery',()=>{
 for(const field of ['windup','release','tele','psiGrabLock']){const g=duel();g.boss[field]=1;g.press('e');frames(g,16);assert.equal(g.boss.hp,g.boss.maxHp);assert.ok(g.player.attack>0);}
 const g=duel();g.player.x=65;g.press('e');frames(g,16);assert.equal(g.player.linkWindow,0);assert.ok(g.player.attack>0);
});
test('Q staggers an exposed SURGEON without lifting either character at 30/60fps',()=>{
 for(const dt of [1/30,1/60]){const g=duel();g.boss.recovery=1.5;g.press('q');for(let i=0;i<20&&!g.boss.psiStagger;i++)g.step(dt);assert.ok(g.boss.psiStagger>0);assert.equal(g.boss.y,126);assert.equal(g.player.onGround,true);frames(g,45,dt);assert.equal(g.boss.y,126);}
});
test('taking damage cancels psychic startups; death/retry resets all new boss states',()=>{
 const g=duel();g.press('w');g.player.damage(10,-1);frames(g,30);assert.equal(g.boss.hp,g.boss.maxHp);g.boss.psiGuard=.5;g.startBoss(0);assert.equal(g.boss.psiGuard,undefined);assert.equal(g.player.linkWindow,0);
});

test('ZERO POINT confirms only on hit and completes its existing four-contact sequence',()=>{const g=duel();g.player.superMeter=100;g.press('r');frames(g,140);assert.ok(g.boss.hp<=g.boss.maxHp-100);assert.equal(g.player.ultimateT,0);assert.equal(g.player.superMeter,0);});
test('airborne repeated Q cannot relaunch ZERO and released jab cannot be stacked by rapid inputs',()=>{const g=duel();g.player.x=65;g.press(' ');frames(g,8);g.press('q');frames(g,2);g.player.skill(0);assert.ok(g.player.vy>=30);frames(g,60);assert.ok(g.player.onGround);const h=duel();for(let i=0;i<8;i++)h.press('j');assert.equal(h.player.attackSerial,1);});
test('phase transition/death clears guard and airborne boss displacement',()=>{for(const dead of [false,true]){const g=duel();g.boss.psiLift=.3;g.boss.y=105;g.boss.psiGuard=.5;if(dead)g.boss.dead=true;else g.boss.tele=1;g.boss.update(.016);assert.equal(g.boss.y,126);assert.equal(g.boss.psiGuard,0);}});

test('J alternates lead and rear hands without mirroring facing, resets after a pause or hit',()=>{
 const g=duel();g.player.x=65;for(const hand of [0,1,0,1]){g.press('j');assert.equal(g.player.psiHand,hand);assert.equal(g.player.face,1);frames(g,17);}frames(g,60);g.press('j');assert.equal(g.player.psiHand,0);g.player.damage(1,-1);frames(g,40);g.press('j');assert.equal(g.player.psiHand,0);
});
test('E binds at midrange and W consumes compression for a single stronger rupture',()=>{
 const g=duel();g.player.x=g.boss.x-55;g.boss.psiGuard=.8;g.boss.dir=-1;g.press('e');for(let i=0;i<30&&!g.boss.psiCompression;i++)g.step();assert.ok(g.boss.psiCompression>0);assert.equal(g.boss.psiGuard,0);g.freeze(0);const hp=g.boss.hp;g.press('w');frames(g,28);assert.equal(g.boss.psiCompression,0);assert.ok(hp-g.boss.hp>=50);const again=g.boss.hp;g.boss.t=999;until(g,()=>g.player.cool[1]<=0);g.player.x=g.boss.x-40;g.boss.recovery=0;g.boss.inv=0;g.player.skill(1);frames(g,28);assert.equal(again-g.boss.hp,32);
});
test('skills require SP and do not create free effects or attacks on rejected input',()=>{
 const g=duel();g.player.sp=0;for(const key of ['q','w','e'])g.player.skill(['q','w','e'].indexOf(key));assert.equal(g.slashes.length,0);assert.equal(g.player.attack,0);
});
test('new ultimate locks only after contact, defers phase change, and cancels hostile attacks',()=>{
 const g=duel();g.boss.hp=g.boss.maxHp*.5+20;g.player.superMeter=100;g.press('r');for(let i=0;i<30&&g.player.ultimateT<=0;i++)g.step();assert.ok(g.player.ultimateT>1.2);assert.equal(g.boss.phase,1);assert.equal(g.slashes.filter(s=>s.superHit).length,3);frames(g,65);assert.equal(g.boss.phase,1);frames(g,65);assert.equal(g.boss.phase,2);assert.equal(g.player.ultimateT,0);
 const h=duel();h.player.x=65;h.player.superMeter=100;h.press('r');frames(h,50);assert.equal(h.player.ultimateT,0);assert.equal(h.boss.hp,h.boss.maxHp);assert.equal(h.player.superMeter,0);
});

test('single-boss victory terminates progression and obsolete saves restart in the first corridor',()=>{
 const g=duel();assert.equal(g.BOSSES.length,1);g.boss.hurt(2000);frames(g,200);assert.equal(g.state,'ending');assert.equal(g.load().boss,0);assert.equal(g.load().complete,true);g.finishBoss();assert.equal(g.upgrade,0);
 for(const old of [{boss:4,stage:'boss',upgrade:5},{boss:1,stage:'reward',complete:true}]){const h=game(true);h.setSave(old);h.title();h.press('enter');assert.equal(h.state,'explore');assert.equal(h.player.hp,100);assert.equal(h.load().boss,0);}
});

function coreDuel(side=-1,dt=1/60){
 const g=game(true);g.engage();g.boss.x=side<0?330:120;g.player.x=g.boss.x+side*125;g.player.face=-side;g.boss.t=0;g.step(dt);
 assert.equal(g.boss.counterCast,true);return g;
}
function until(g,predicate,dt=1/60){for(let i=0;i<300&&!predicate();i++)g.step(dt);assert.ok(predicate(),'expected combat event did not occur');}

test('only K is a parry: offensive skills do not reflect the falling core',()=>{
 for(const key of ['q','w','e','r'])for(const dt of [1/30,1/60]){
  const g=coreDuel(-1,dt);g.player.superMeter=100;until(g,()=>g.hazards.some(h=>h.heavyCore&&h.delay<=0&&h.y>=110),dt);
  g.press(key);until(g,()=>g.player.hp<100,dt);
  assert.equal(g.player.hp,86);assert.equal(g.boss.hp,g.boss.maxHp);assert.ok(g.hazards.every(h=>h.owner!=='p'));
 }
});
test('the core locks its target, can be dodged, and phase-two protocol keeps ordinary needles',()=>{
 const g=coreDuel(),locked=g.boss.target.x;g.keys.add('a');frames(g,110);g.keys.clear();
 assert.equal(g.boss.target.x,locked);assert.equal(g.player.hp,100);
 const h=coreDuel();h.boss.beginProtocolCast(0);until(h,()=>h.hazards.some(x=>x.protocol));
 assert.equal(h.hazards.filter(x=>x.protocol).length,3);assert.ok(h.hazards.every(x=>!x.heavyCore));
});

test('E compression offers Q for grounded spacing instead of W damage, without pushing through arena walls',()=>{
 for(const side of [-1,1]){
  const g=game(true);g.engage();g.boss.x=side<0?260:190;g.player.x=g.boss.x+side*55;g.player.face=-side;
  g.press('e');until(g,()=>g.boss.psiCompression>0);g.freeze(0);g.press('q');until(g,()=>g.boss.psiCompression===0);
  const x=g.boss.x,hp=g.boss.hp;frames(g,22);assert.ok((g.boss.x-x)*-side>25);assert.equal(g.boss.y,126);assert.ok(g.boss.recovery>0);assert.ok(g.boss.maxHp-hp<70);
 }
 for(const [x,side] of [[395,-1],[45,1]]){
  const g=game(true);g.engage();g.boss.x=x;g.player.x=x+side*55;g.player.face=-side;g.press('e');until(g,()=>g.boss.psiCompression>0);g.freeze(0);g.press('q');until(g,()=>g.boss.psiCompression===0);frames(g,22);
  assert.ok(g.boss.x>=45&&g.boss.x<=395);assert.equal(g.boss.y,126);
 }
});

test('SURGEON follows a nearby completed guard with a readable counter that can be jumped or parried',()=>{
 for(const response of ['none','jump','parry']){
  const g=duel();g.boss.psiGuard=.1;g.boss.dir=-1;until(g,()=>g.boss.windup>0);
  assert.ok(g.boss.windup>=.7);assert.equal(g.boss.move,0);
  if(response==='jump'){until(g,()=>g.boss.windup>0&&g.boss.windup<.37);g.press(' ');}
  if(response==='parry'){until(g,()=>g.boss.release>0);g.press('k');}
  if(response==='none')until(g,()=>g.player.hp<100);else {frames(g,45);assert.equal(g.player.hp,100);if(response==='parry')assert.ok(g.player.superMeter>=14);}
  assert.ok(g.boss.recovery>0);
 }
});
test('breaking guard with E or leaving its range prevents the guard counter',()=>{
 const g=duel();g.boss.psiGuard=.65;g.boss.dir=-1;g.press('e');until(g,()=>g.boss.psiCompression>0);frames(g,35);assert.ok(g.boss.windup<=0);
 const h=duel();h.player.x=80;h.boss.psiGuard=.1;until(h,()=>h.boss.psiGuard===0);assert.ok(h.boss.windup<=0);
});

test('guard counter remains jumpable at both walls at 30 and 60 fps',()=>{
 for(const dt of [1/30,1/60])for(const [bossX,playerX] of [[45,90],[395,350]]){
  const g=game(true);g.engage();g.boss.x=bossX;g.player.x=playerX;g.player.face=Math.sign(bossX-playerX);g.boss.psiGuard=.1;
  until(g,()=>g.boss.windup>0,dt);until(g,()=>g.boss.windup>0&&g.boss.windup<.37,dt);g.press(' ');until(g,()=>g.boss.release>0,dt);frames(g,10,dt);
  assert.equal(g.player.hp,100);
 }
});

 test('Q W E have independent cooldowns and rejected repeats do not spend SP',()=>{
 for(const key of ['q','w','e']){const g=game(true);g.engage();g.player.x=80;const i=['q','w','e'].indexOf(key);g.press(key);assert.ok(g.player.cool[i]>0);frames(g,35);const serial=g.player.attackSerial,sp=g.player.sp;g.press(key);assert.equal(g.player.attackSerial,serial);assert.ok(g.player.sp>=sp);until(g,()=>g.player.cool[i]<=0);g.press(key);assert.equal(g.player.attackSerial,serial+1);}
 });

function operationDuel(dt=1/60){
 const g=game(true);g.engage();g.boss.hp=g.boss.maxHp*.74;g.boss.t=0;g.player.x=65;g.step(dt);assert.ok(g.boss.operation);return g;
}
test('SURGEON operation: attacking both relays interrupts the ultimate and opens a punish',()=>{
 for(const dt of [1/30,1/60]){
  const g=operationDuel(dt),op=g.boss.operation;assert.equal(op.nodes.length,2);
  const hp=g.boss.hp;g.player.x=g.boss.x-30;g.press('j');frames(g,20,dt);assert.equal(g.boss.hp,hp,'boss is protected while relays are active');
  for(const node of op.nodes){g.player.x=node.x-30;g.player.face=1;while(node.hp>0){until(g,()=>g.player.attack<=0,dt);g.press('j');frames(g,14,dt);}}
  assert.equal(g.boss.operation,null);assert.ok(g.boss.recovery>1);assert.ok(g.boss.operationUsed);assert.equal(g.slashes.filter(s=>s.kind==='operationWave').length,0);
 }
});
test('SURGEON operation wave damages idle players, but a broken relay or a jump provides safety',()=>{
 for(const dt of [1/30,1/60])for(const response of ['none','safe','jump']){
  const g=operationDuel(dt),op=g.boss.operation;g.player.x=120;
  if(response==='safe'){op.nodes[0].hp=0;g.player.x=op.nodes[0].x+8;}
  op.time=.25;if(response==='jump')g.press(' ');
  frames(g,35,dt);assert.equal(g.player.hp,response==='none'?76:100,response);
 }
});
test('SURGEON operation clears on boss death and retry',()=>{
 const g=operationDuel();g.boss.hurt(g.boss.maxHp*2);assert.equal(g.boss.operation,null);frames(g,50);assert.ok(g.slashes.every(s=>s.kind!=='operationWave'));g.startBoss();assert.equal(g.boss.operation,undefined);
});

function secondCut(dt=1/60,x=120){
 const g=game(true);g.engage();g.boss.phase=2;g.boss.protocolUsed=true;g.boss.operationUsed=true;g.boss.x=330;g.boss.move=0;g.boss.dir=-1;g.boss.windup=.01;g.boss.windupMax=.7;g.player.x=x;g.player.face=1;g.step(dt);assert.ok(g.boss.followup);return g;
}
test('phase two follows a low incision with a locked, dodgeable surgical drop',()=>{
 for(const dt of [1/30,1/60]){
  const g=secondCut(dt);until(g,()=>g.boss.followup&&g.boss.followup.x!==null,dt);const locked=g.boss.followup.x;g.keys.add('d');until(g,()=>g.hazards.some(h=>h.kind==='syringe'),dt);assert.equal(g.hazards.find(h=>h.kind==='syringe').x,locked);frames(g,55,dt);g.keys.clear();assert.equal(g.player.hp,100);
  const h=secondCut(dt);until(h,()=>h.player.hp<100,dt);assert.equal(h.player.hp,88);
 }
});
test('parrying a phase-two low incision cancels its follow-up',()=>{
 const g=secondCut(1/60,290);g.press('k');until(g,()=>!g.boss.followup);assert.equal(g.player.hp,100);assert.ok(g.player.superMeter>=14);frames(g,100);assert.ok(g.hazards.every(h=>h.kind!=='syringe'));
});

test('both relays can be reached and destroyed using only movement and J from either wall or center in both phases',()=>{
 for(const phase of [1,2])for(const bx of [55,200,395])for(const dt of [1/30,1/60]){
  const g=game(true);g.engage();g.boss.x=bx;g.boss.hp=g.boss.maxHp*(phase===1?.74:.29);g.boss.phase=phase;g.boss.protocolUsed=phase===2;g.boss.operationUsed=phase===2;g.boss.t=0;g.player.x=bx;g.step(dt);let steps=0;
  while(g.boss.operation&&steps++<500){const nodes=g.boss.operation.nodes.filter(n=>n.hp>0);const n=nodes.reduce((a,b)=>Math.abs(a.x-g.player.x)<Math.abs(b.x-g.player.x)?a:b);const dx=n.x+14-(g.player.x+9);g.keys.clear();if(Math.abs(dx)>32)g.keys.add(dx>0?'d':'a');if(Math.abs(dx)<55&&g.player.attack<=0&&g.player.face===(Math.sign(dx)||g.player.face))g.press('j');else g.step(dt);}
  assert.equal(g.boss.operation,null);assert.ok(g.boss.recovery>1.9);assert.equal(g.player.hp,100);
 }
});

test('dash afterimages clear when J, Q, W, E or R begins',()=>{
 for(const key of ['j','q','w','e','r']){
  const g=game(true);g.engage();g.player.x=80;g.player.superMeter=100;g.keys.add('d');g.press('shift');until(g,()=>g.player.dash<=0);assert.ok(g.echoes.length>0);
  g.press(key);assert.equal(g.player.weaponMode,{j:'psiJab',q:'psiRise',w:'psiPalm',e:'psiGrab',r:'psiSuper'}[key]);assert.equal(g.echoes.length,0);
 }
});

test('SURGEON has 1800 HP and launches the long lance with readable jump and K responses',()=>{
 for(const side of [-1,1])for(const dt of [1/30,1/60])for(const response of ['none','jump','parry']){
  const g=game(true);g.engage();assert.equal(g.boss.maxHp,1800);g.boss.x=side<0?330:100;g.player.x=side<0?130:300;g.player.face=-side;g.boss.t=0;g.boss.lanceCasts=1;g.boss.lastPattern=0;g.step(dt);
  assert.equal(g.boss.move,3);assert.ok(g.boss.windup>.7);assert.equal(g.hazards.length,0);until(g,()=>g.hazards.some(h=>h.heavyLance),dt);
  let acted=false,seen=false;for(let i=0;i<180;i++){
   const h=g.hazards.find(x=>x.heavyLance);if(h){seen=true;const distance=Math.abs(h.x-(g.player.x+9));if(!acted&&response==='jump'&&distance<75){g.press(' ');acted=true;continue;}if(!acted&&response==='parry'&&distance<30){g.press('k');acted=true;continue;}}
   if(seen&&!h)break;g.step(dt);
  }
  assert.equal(g.player.hp,response==='none'?82:100);if(response==='parry')assert.ok(g.player.superMeter>=14);
 }
});
test('cross-stitch drops the sides before the center and can be escaped after the first wave',()=>{
 for(const dt of [1/30,1/60])for(const response of ['none','move']){
  const g=game(true);g.engage();g.boss.x=330;g.player.x=205;g.boss.t=0;g.boss.loomCasts=2;g.step(dt);assert.equal(g.boss.move,4);const target=g.boss.target.x;
  let moved=false,spawn=false;for(let i=0;i<250;i++){
   const shots=g.hazards.filter(h=>h.crossStitch);if(shots.length)spawn=true;const sides=shots.filter(h=>h.x!==target);
   if(response==='move'&&!moved&&spawn&&sides.length&&sides.every(h=>h.y>226)){g.keys.add('a');moved=true;}
   g.step(dt);if(spawn&&!g.hazards.some(h=>h.crossStitch))break;
  }
  assert.equal(g.player.hp,response==='none'?88:100);if(response==='move')assert.ok(moved);
 }
});
test('cross-stitch keeps its three lanes distinct near either wall',()=>{
 for(const [px,bx] of [[8,130],[453,330]]){const g=game(true);g.engage();g.player.x=px;g.boss.x=bx;g.boss.t=0;g.boss.loomCasts=2;g.step();assert.equal(g.boss.move,4);until(g,()=>g.hazards.some(h=>h.crossStitch));const lanes=g.hazards.filter(h=>h.crossStitch).map(h=>h.x);assert.equal(new Set(lanes).size,3);assert.ok(lanes.every(x=>x>=15&&x<=465));}
});
test('the surgical operation returns once in phase two with a shorter warning',()=>{
 const g=operationDuel();g.boss.endOperation(true);g.freeze(0);g.boss.recovery=0;g.boss.phase=2;g.boss.protocolUsed=true;g.boss.hp=g.boss.maxHp*.29;g.boss.t=0;g.step();assert.ok(g.boss.operation);assert.ok(g.boss.operation.time<=5.8);assert.ok(g.boss.phase2OperationUsed);
});

test('close E to J consumes compression once for SP and meter instead of W damage',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1]){
  const g=game(true);g.engage();g.boss.x=240;g.player.x=g.boss.x+side*32;g.player.face=-side;g.player.sp=40;g.press('e');until(g,()=>g.boss.psiCompression>0,dt);g.freeze(0);
  const hp=g.boss.hp,sp=g.player.sp,meter=g.player.superMeter;assert.ok(g.player.attack>0);g.press('j');assert.equal(g.player.weaponMode,'psiJab');until(g,()=>g.boss.psiCompression===0,dt);
  assert.ok(g.player.sp>=sp+12);assert.ok(g.player.superMeter>=meter+10);assert.ok(hp-g.boss.hp<30);
  const after=g.player.sp;g.boss.t=999;until(g,()=>g.player.attack<=0,dt);g.press('j');frames(g,15,dt);assert.ok(g.player.sp<after+9,'no second compression refund');
 }
 const h=duel();h.player.x=65;h.press('e');frames(h,15);h.freeze(0);const serial=h.player.attackSerial;h.press('j');assert.equal(h.player.attackSerial,serial,'whiff does not cancel into J');
});

test('successful K parry permits one free directional shift; ordinary or expired steps still cost SP',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1]){
  const g=game(true);g.engage();g.boss.x=240;g.player.x=g.boss.x+side*45;g.player.face=-side;g.player.sp=30;g.boss.move=0;g.boss.dir=side;g.boss.act();until(g,()=>g.slashes.some(s=>s.delay<=.04),dt);g.press('k');until(g,()=>g.player.parryFollow>0,dt);g.freeze(0);
  const before=g.player.sp;g.keys.add(side<0?'a':'d');g.press('shift');assert.ok(g.player.dash>0);assert.equal(g.player.dashDir,side);assert.equal(g.player.parryFollow,0);assert.ok(g.player.sp>=before);
  until(g,()=>g.player.driveLock<=0,dt);g.freeze(0);const next=g.player.sp;g.press('shift');assert.ok(g.player.sp<next-9);
 }
 const g=duel();g.player.sp=8;g.press('shift');assert.equal(g.player.dash,0);g.player.parryFollow=.02;frames(g,3);const sp=g.player.sp;g.press('shift');assert.equal(g.player.dash,0);assert.ok(g.player.sp>=sp);
});

function scheduledPattern(number,playerX=120,bossX=330,dt=1/60){
 const g=game(true);g.engage();g.player.x=playerX;g.player.face=Math.sign(bossX-playerX);g.boss.x=bossX;g.boss.patternCount=number-1;g.boss.t=0;g.step(dt);return g;
}
test('the first retreat counter uses PINCER and alternates with the needle counter',()=>{
 const g=duel();g.boss.counterReady=true;g.step();assert.equal(g.boss.move,7);assert.ok(g.boss.windup>=1);assert.ok(Math.abs(g.boss.pincerX-(g.player.x+9))>=35);
 g.boss.windup=0;g.boss.release=0;g.boss.recovery=0;g.boss.counterReady=true;g.step();assert.equal(g.boss.move,2);assert.ok(g.boss.windup>=.65);
});
test('sterile field locks and marks player position; moving escapes at both walls',()=>{
 for(const dt of [1/30,1/60])for(const [px,bx,direction] of [[8,130,'d'],[453,330,'a'],[180,330,'a']]){
  const g=scheduledPattern(4,px,bx,dt);assert.equal(g.boss.move,6);assert.ok(g.boss.windup>=.75);const target=g.boss.target.x;g.keys.add(direction);until(g,()=>g.hazards.some(h=>h.sterileField),dt);g.keys.clear();
  const h=g.hazards.find(h=>h.sterileField);assert.equal(h.x,target);assert.ok(h.life>2);frames(g,50,dt);assert.equal(g.player.hp,100);
 }
 const g=scheduledPattern(4);until(g,()=>g.player.hp<100);assert.equal(g.player.hp,84);
});

test('dissection rewards staying grounded for the high needle then jumping or parrying the low one',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1])for(const response of ['idle','jump','parry','earlyJump']){
  const g=scheduledPattern(2,side<0?120:350,side<0?330:120,dt);assert.equal(g.boss.move,5);assert.ok(g.boss.windup>=.75);until(g,()=>g.hazards.filter(h=>h.dissection).length===2,dt);
  let acted=false;for(let i=0;i<220;i++){
   const high=g.hazards.find(h=>h.dissection&&h.y===175),low=g.hazards.find(h=>h.dissection&&h.y===212);
   const threat=response==='earlyJump'?high:low,dist=threat?Math.abs(threat.x-(g.player.x+9)):999;
   if(!acted&&threat&&threat.delay<=0&&dist<(response==='parry'?27:48)){if(response==='jump'||response==='earlyJump')g.press(' ');else if(response==='parry')g.press('k');else g.step(dt);acted=true;}
   else g.step(dt);
   if(!g.hazards.some(h=>h.dissection))break;
  }
  if(response==='jump'||response==='parry'){assert.equal(g.player.hp,100,`${dt} ${side} ${response}`);assert.ok(acted);}
  else assert.ok(g.player.hp<100,`${dt} ${side} ${response}`);
 }
});
test('new boss hazards clear on death and do not leak into retry',()=>{
 for(const [number,property] of [[2,'dissection'],[3,'pincerField'],[3,'pincerShot'],[4,'sterileField']]){
  const g=scheduledPattern(number);until(g,()=>g.hazards.some(h=>h[property]));g.boss.hurt(5000);assert.equal(g.boss.dead,true);assert.ok(g.hazards.every(h=>!h[property]));
  frames(g,200);assert.equal(g.state,'ending');g.startBoss();assert.ok(g.hazards.every(h=>!h[property]));assert.equal(g.boss.patternCount,undefined);
 }
});
test('a sterile field remains after an evade or hit, and awards the evade only once',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1]){
  const g=scheduledPattern(4);until(g,()=>g.hazards.some(h=>h.sterileField&&h.delay<=0),dt);const h=g.hazards.find(h=>h.sterileField);g.boss.t=999;g.player.x=h.x+side*35;g.player.face=-side;g.player.sp=40;g.keys.add(side<0?'d':'a');g.press('shift');
  until(g,()=>side*(g.player.x-h.x)<-10,dt);g.keys.clear();assert.equal(g.player.hp,100);assert.ok(g.hazards.includes(h));assert.equal(h.evadeRewarded,true);assert.ok(g.player.sp<40,'repeated overlap cannot farm SP');
  until(g,()=>!h.passGrace,dt);g.player.x=h.x-7;g.player.vx=0;g.player.dash=0;g.player.inv=0;g.step(dt);assert.equal(g.player.hp,84);assert.ok(g.hazards.includes(h));frames(g,8,dt);assert.equal(g.player.hp,84,'normal damage invulnerability prevents repeated hits');
  until(g,()=>!g.hazards.includes(h),dt);
 }
});

test('PINCER telegraphs a safe offset at both walls, and a jump or K avoids its shot',()=>{
 for(const dt of [1/30,1/60])for(const [px,bx] of [[130,330],[350,120],[8,130],[453,330]])for(const response of ['none','jump','parry']){
  const g=scheduledPattern(3,px,bx,dt);assert.equal(g.boss.move,7);assert.ok(g.boss.windup>.8);assert.ok(Math.abs(g.boss.pincerX-(px+9))>=35);
  until(g,()=>g.hazards.some(h=>h.pincerShot),dt);let acted=false;
  for(let i=0;i<220;i++){
   const h=g.hazards.find(x=>x.pincerShot);if(!h)break;
   const dx=h.x-(g.player.x+9),distance=Math.abs(dx);
   if(!acted&&h.delay<=0&&distance<(response==='parry'?30:75)){
    if(response==='jump')g.press(' ');else if(response==='parry')g.press('k');else g.step(dt);acted=true;
   }else g.step(dt);
   if(h.delay<=0&&dx*Math.sign(h.vx)>30)break;
  }
  if(response==='none')assert.equal(g.player.hp,84,`${dt} ${px} ${response}`);
  else{assert.equal(g.player.hp,100,`${dt} ${px} ${response}`);assert.ok(acted);}
  if(response==='parry'){assert.ok(g.player.superMeter>=14);assert.ok(g.hazards.every(h=>!h.pincerField));assert.ok(g.boss.recovery>1.1);}
 }
});

test('E compression is consumed by confirmed R for one stronger final impact',()=>{
 const totals=[];
 for(const compressed of [false,true]){
  const g=duel();g.player.superMeter=100;
  if(compressed){g.press('e');until(g,()=>g.boss.psiCompression>0);g.freeze(0);g.player.superMeter=100;}
  const hp=g.boss.hp;g.press('r');until(g,()=>g.player.ultimateT>0);assert.equal(g.player.superCompressed,compressed);assert.equal(g.boss.psiCompression||0,0);frames(g,140);totals.push(hp-g.boss.hp);assert.equal(g.player.ultimateT,0);
 }
 assert.equal(totals[1]-totals[0],20);
 const g=duel();g.player.superMeter=100;g.player.x=65;g.player.superCompressed=true;g.press('r');frames(g,40);assert.equal(g.player.superCompressed,false);assert.equal(g.player.ultimateT,0);
});
test('a confirmed R cancels both parts of an active PINCER',()=>{
 const g=scheduledPattern(3,225,260);until(g,()=>g.hazards.some(h=>h.pincerShot));g.player.superMeter=100;g.press('r');until(g,()=>g.player.ultimateT>0);
 assert.ok(g.hazards.every(h=>!h.pincerShot&&!h.pincerField));assert.ok(g.boss.superLock>0);assert.equal(g.player.hp,100);
});
test('repeated rear hits during a cast trigger a warned, avoidable two-sided response',()=>{
 for(const dt of [1/30,1/60])for(const [bx,px] of [[240,285],[240,195],[45,8],[395,453]])for(const response of ['none','jump','parry']){
  const g=game(true);g.engage();g.boss.x=bx;g.player.x=px;g.player.face=Math.sign(bx-px);g.boss.dir=g.player.face;g.boss.windup=g.boss.windupMax=2;g.boss.move=0;
  g.press('j');until(g,()=>g.boss.hp<g.boss.maxHp,dt);until(g,()=>g.player.attack<=0,dt);g.freeze(0);g.press('j');until(g,()=>g.boss.rearCounterPending,dt);
  assert.ok(g.boss.windup>0,'the original attack keeps its windup');until(g,()=>g.boss.move===8&&g.boss.windup>0,dt);assert.ok(g.boss.windup>=1);
  if(response==='jump'){until(g,()=>g.boss.windup<.34,dt);g.press(' ');}
  if(response==='parry'){until(g,()=>g.hazards.some(h=>h.rearSweep&&Math.sign(h.vx)===Math.sign(px-bx)&&h.delay<=0&&Math.abs(h.x-(g.player.x+9))<30),dt);g.press('k');}
  if(response==='none')until(g,()=>g.hazards.some(h=>h.rearSweep),dt);
  frames(g,65,dt);assert.equal(g.player.hp,response==='none'?86:100,`${dt} ${px} ${response}`);if(response==='parry')assert.ok(g.player.superMeter>=14);
 }
 const g=duel();g.boss.rearCounterPending=true;g.boss.windup=1;g.boss.dir=-1;g.player.superMeter=100;g.press('r');until(g,()=>g.player.ultimateT>0);assert.equal(g.boss.rearCounterPending,false);
});
