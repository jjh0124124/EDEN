const {test}=require('node:test'),assert=require('node:assert/strict');
const {game}=require('./game-harness.cjs');
const frames=(g,n=60,dt=1/60)=>{for(let i=0;i<n;i++)g.step(dt);};
function duel(){const g=game(true);g.engage();g.player.x=g.boss.x-40;return g;}
test('Shift moves in either direction with no contact damage and respects walls',()=>{
 for(const [x,dir] of [[8,-1],[453,1],[320,1]]){const g=duel();g.player.x=x;g.keys.add(dir===1?'d':'a');g.press('shift');frames(g,20);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.slashes.length,0);assert.ok(g.player.x>=8&&g.player.x<=453);}
});
test('guard has a visible warning and never retroactively blocks the triggering poke',()=>{
 const g=duel();g.boss.psiGuardPending=true;g.step();assert.ok(g.boss.psiGuardWarn>0);assert.equal(g.boss.psiGuard||0,0);g.boss.update(.1);assert.ok(g.boss.psiGuardWarn>0);frames(g,20);assert.ok(g.boss.psiGuard>0);
});
test('taking damage cancels psychic startups; death/retry resets all new boss states',()=>{
 const g=duel();g.press('w');g.player.damage(10,-1);frames(g,30);assert.equal(g.boss.hp,g.boss.maxHp);g.boss.psiGuard=.5;g.startBoss(0);assert.equal(g.boss.psiGuard,undefined);assert.equal(g.player.linkWindow,0);
});


test('J alternates lead and rear hands without mirroring facing, resets after a pause or hit',()=>{
 const g=duel();g.player.x=65;for(const hand of [0,1,0,1]){g.press('j');assert.equal(g.player.psiHand,hand);assert.equal(g.player.face,1);frames(g,17);}frames(g,60);g.press('j');assert.equal(g.player.psiHand,0);g.player.damage(1,-1);frames(g,40);g.press('j');assert.equal(g.player.psiHand,0);
});
test('skills require SP and do not create free effects or attacks on rejected input',()=>{
 const g=duel();g.player.sp=0;for(const key of ['q','w','e'])g.player.skill(['q','w','e'].indexOf(key));assert.equal(g.slashes.length,0);assert.equal(g.player.attack,0);
});

test('single-boss victory terminates progression and obsolete saves restart in the first corridor',()=>{
 const g=duel();assert.equal(g.BOSSES.length,1);g.boss.hurt(2000);assert.equal(g.boss.phase,2);assert.equal(g.boss.dead,false);g.boss.tele=0;g.boss.inv=0;g.boss.hurt(2000);frames(g,200);assert.equal(g.state,'ending');assert.equal(g.load().boss,0);assert.equal(g.load().complete,true);g.finishBoss();assert.equal(g.upgrade,0);
 for(const old of [{boss:4,stage:'boss',upgrade:5},{boss:1,stage:'reward',complete:true}]){const h=game(true);h.setSave(old);h.title();h.press('enter');assert.equal(h.state,'explore');assert.equal(h.player.hp,100);assert.equal(h.load().boss,0);}
});

function coreDuel(side=-1,dt=1/60){
 const g=game(true);g.engage();g.boss.x=side<0?330:120;g.player.x=g.boss.x+side*125;g.player.face=-side;g.boss.t=0;g.step(dt);
 assert.equal(g.boss.counterCast,true);return g;
}
function until(g,predicate,dt=1/60){for(let i=0;i<1200&&!predicate();i++)g.step(dt);assert.ok(predicate(),'expected combat event did not occur');}

test('only K is a parry: offensive skills do not reflect the falling core',()=>{
 for(const key of ['q','w','e','r'])for(const dt of [1/30,1/60]){
  const g=coreDuel(-1,dt);g.player.superMeter=100;until(g,()=>g.hazards.some(h=>h.heavyCore&&h.delay<=0&&h.y>=110),dt);
  g.press(key);until(g,()=>g.player.hp<100,dt);
  assert.equal(g.player.hp,86);assert.ok(g.hazards.every(h=>!h.reflected));
 }
});
test('the core locks its target, can be dodged, and the surgical protocol keeps ordinary needles',()=>{
 const g=coreDuel(),locked=g.boss.target.x;g.keys.add('a');frames(g,110);g.keys.clear();
 assert.equal(g.boss.target.x,locked);assert.equal(g.player.hp,100);
 const h=coreDuel();h.boss.beginProtocolCast(0);until(h,()=>h.hazards.some(x=>x.protocol));
 assert.equal(h.hazards.filter(x=>x.protocol).length,3);assert.ok(h.hazards.every(x=>!x.heavyCore));
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
test('SURGEON operation clears on transformation and retry',()=>{
 const g=operationDuel();g.boss.hurt(g.boss.maxHp*2);assert.equal(g.boss.operation,null);assert.equal(g.boss.phase,2);frames(g,50);assert.ok(g.slashes.every(s=>s.kind!=='operationWave'));g.startBoss();assert.equal(g.boss.operation,undefined);
});

test('both relays can be reached and destroyed using only movement and J from either wall or center in phase one',()=>{
 for(const phase of [1])for(const bx of [55,200,395])for(const dt of [1/30,1/60]){
  const g=game(true);g.engage();g.boss.x=bx;g.boss.hp=g.boss.maxHp*(phase===1?.74:.29);g.boss.phase=phase;g.boss.protocolUsed=phase===2;g.boss.operationUsed=phase===2;g.boss.t=0;g.player.x=bx;g.step(dt);let steps=0;
  while(g.boss.operation&&steps++<500){const nodes=g.boss.operation.nodes.filter(n=>n.hp>0);const n=nodes.reduce((a,b)=>Math.abs(a.x-g.player.x)<Math.abs(b.x-g.player.x)?a:b);const dx=n.x+14-(g.player.x+9);g.keys.clear();if(Math.abs(dx)>32)g.keys.add(dx>0?'d':'a');if(Math.abs(dx)<55&&g.player.attack<=0&&g.player.face===(Math.sign(dx)||g.player.face))g.press('j');else g.step(dt);}
  assert.equal(g.boss.operation,null);assert.ok(g.boss.recovery>1.9);assert.equal(g.player.hp,100);
 }
});

test('dash afterimages clear when J, Q, W, E or R begins',()=>{
 for(const key of ['j','q','w','e','r']){
  const g=game(true);g.engage();g.player.x=80;g.player.superMeter=100;g.keys.add('d');g.press('shift');until(g,()=>g.player.dash<=0);assert.ok(g.echoes.length>0);
  g.press(key);assert.equal(g.player.weaponMode,{j:'psiJab',q:'psiShock',w:'psiBarrage',e:'psiBlast',r:'psiSuper'}[key]);assert.equal(g.echoes.length,0);
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
  const g=scheduledPattern(number);until(g,()=>g.hazards.some(h=>h[property]));g.boss.hurt(5000);assert.equal(g.boss.phase,2);assert.equal(g.boss.dead,false);assert.ok(g.hazards.every(h=>!h[property]));g.boss.tele=0;g.boss.inv=0;g.boss.hurt(5000);assert.equal(g.boss.dead,true);
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
 const g=duel();g.boss.rearCounterPending=true;g.boss.windup=1;g.boss.dir=-1;g.player.superMeter=100;g.press('r');until(g,()=>g.player.ultimateT>0);assert.equal(g.boss.rearCounterPending,true);
});

test('SURGEON rear sweep reaches both arena edges at different boss positions and frame rates',()=>{
 for(const dt of [1/30,1/60])for(const bx of [45,240,395]){
  const g=game(true);g.engage();g.boss.x=bx;g.boss.t=999;g.boss.move=8;g.player.x=bx+11;g.boss.act();let left=Infinity,right=-Infinity;
  for(let i=0;i<Math.ceil(2.7/dt);i++){for(const h of g.hazards.filter(h=>h.rearSweep&&h.delay<=0)){if(h.vx<0)left=Math.min(left,h.x);else right=Math.max(right,h.x);}g.step(dt);}
  assert.ok(left<=8&&right>=472,`boss=${bx} dt=${dt} reached ${left},${right}`);
 }
});

test('Q W E have distinct timings, resource costs, cooldowns and reference-scaled damage in both directions',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1])for(const [key,mode,dmg,cd,cost] of [['q','psiShock',24,3,12],['w','psiBarrage',58,9,20],['e','psiBlast',32,12,18]]){
  const g=game(true);g.engage();g.boss.x=230;g.player.x=g.boss.x+side*(key==='w'?60:35);g.player.face=-side;g.press(key);
  assert.equal(g.player.weaponMode,mode);assert.ok(Math.abs(g.player.cool['qwe'.indexOf(key)]-cd)<.05);assert.ok(g.player.sp<=100-cost+.2);
  frames(g,Math.ceil(2/dt),dt);assert.equal(g.boss.maxHp-g.boss.hp,dmg,`${key}, side ${side}, dt ${dt}`);
 }
});

test('Q is a narrow frontal hit with a short commitment and cannot damage behind or out of range',()=>{
 for(const [dx,expected] of [[45,true],[-50,false],[110,false]]){const g=duel();g.player.x=200;g.player.face=1;g.boss.x=g.player.x+dx;g.press('q');assert.ok(g.player.attack<=.2);frames(g,30);assert.equal(g.boss.hp<g.boss.maxHp,expected,`boss offset ${dx}`);}
});

test('W emits five independent projectiles with a distinct stronger finisher and reduces movement speed',()=>{
 const g=duel();g.player.x=80;g.boss.x=380;g.keys.add('d');g.press('w');const shards=g.hazards.filter(h=>h.kind==='psiShard');assert.equal(shards.length,5);assert.deepEqual(Array.from(shards,h=>h.dmg),[10,10,10,10,18]);assert.ok(shards[4].large);assert.ok(shards.every(h=>h.delay>0));frames(g,25);assert.ok(g.player.x>80&&g.player.x<120);assert.ok(g.player.attack>0);frames(g,65);assert.equal(g.player.attack,0);
});

test('E is circular, hits either side once and can hit multiple nearby drones',()=>{
 for(const [dx,expected] of [[-65,true],[55,true],[120,false]]){const g=duel();g.player.x=200;g.boss.x=g.player.x+dx;g.press('e');frames(g,25);assert.equal(g.boss.maxHp-g.boss.hp,expected?32:0,`offset ${dx}`);}
 const g=game(true);g.startExplore();g.player.x=200;g.room.drones=[{x:155,y:178,w:20,h:20,hp:100,t:99},{x:245,y:178,w:20,h:20,hp:100,t:99}];g.press('e');frames(g,20);assert.deepEqual(Array.from(g.room.drones,d=>d.hp),[68,68]);
});

test('Q W E deal damage during a boss windup without moving, locking or cancelling the boss',()=>{
 for(const key of ['q','w','e']){const g=duel();g.player.x=g.boss.x-42;g.boss.windup=g.boss.windupMax=3;g.boss.move=0;const x=g.boss.x,y=g.boss.y;g.press(key);frames(g,90);assert.ok(g.boss.hp<g.boss.maxHp,key);assert.ok(g.boss.windup>0,key);assert.equal(g.boss.x,x);assert.equal(g.boss.y,y);assert.ok(!(g.boss.superLock>0));}
});

test('frontal guard blocks psychic attacks, while attacks from behind deal normal damage',()=>{
 for(const key of ['q','w','e'])for(const side of [-1,1]){const g=duel();g.boss.x=220;g.player.x=g.boss.x+side*35;g.player.face=-side;g.boss.dir=-1;g.boss.psiGuard=2;g.press(key);frames(g,80);assert.equal(g.boss.hp<g.boss.maxHp,side===1,`${key} ${side}`);}
});

test('K parry followed by K performs one strong frontal counter with no boss displacement or SP cost',()=>{
 for(const side of [-1,1]){const g=duel();g.boss.x=230;g.player.x=g.boss.x+side*45;g.player.face=-side;g.boss.windup=2;g.boss.move=0;g.press('k');assert.ok(g.player.tryParry({owner:'b',kind:'scalpel',parryable:true,dir:side}));assert.equal(g.boss.windup,0);assert.ok(g.boss.psiStagger>0&&g.boss.recovery>=1.2);g.freeze(0);const sp=g.player.sp,x=g.boss.x;g.press('k');assert.equal(g.player.weaponMode,'psiCounter');frames(g,30);assert.equal(g.boss.maxHp-g.boss.hp,55);assert.equal(g.boss.x,x);assert.ok(g.boss.recovery>0);assert.ok(g.player.sp>=sp);}
});

test('an early second K is buffered only for a successful parry; a held or missed K never auto-counters',()=>{
 const g=duel();g.press('k');g.press('k');assert.ok(g.player.buffer?.counterIntent);assert.ok(g.player.tryParry({owner:'b',kind:'scalpel',parryable:true,dir:-1}));g.freeze(0);g.step();assert.equal(g.player.weaponMode,'psiCounter');
 const missed=duel();missed.press('k');missed.press('k');frames(missed,50);assert.notEqual(missed.player.weaponMode,'psiCounter');assert.equal(missed.boss.hp,missed.boss.maxHp);
 const held=duel();held.keys.add('k');held.press('k');assert.ok(held.player.tryParry({owner:'b',kind:'scalpel',parryable:true,dir:-1}));frames(held,40);assert.notEqual(held.player.weaponMode,'psiCounter');
});

test('R compresses one fixed area in four hits instead of firing W projectiles',()=>{
 const g=duel();g.player.x=g.boss.x-45;g.player.superMeter=100;g.press('r');assert.equal(g.player.ultimateT,2.5);assert.equal(g.player.superMeter,0);
 assert.equal(g.hazards.filter(h=>h.owner==='p').length,0);assert.deepEqual(Array.from(g.slashes.filter(s=>s.kind.startsWith('psiCrush')),s=>s.dmg),[14,16,18,108]);
 frames(g,210);assert.equal(g.boss.maxHp-g.boss.hp,156);assert.equal(g.player.ultimateT,0);assert.equal(g.hazards.filter(h=>h.owner==='p').length,0);
 g.player.x=g.boss.x-45;g.player.face=1;g.player.superMeter=100;g.player.sp=100;g.player.stun=0;g.boss.inv=0;g.boss.t=999;g.boss.retreat=null;g.boss.pressure=0;const hp=g.boss.hp;g.press('r');assert.equal(g.player.ultimateT,2);frames(g,180);assert.equal(hp-g.boss.hp,156);assert.equal(g.player.ultimateT,0);
});

test('R preserves an active boss cast and hostile objects rather than controlling the boss',()=>{
 const g=duel();g.player.x=g.boss.x-45;g.boss.windup=g.boss.windupMax=3;g.boss.move=0;g.boss.rearCounterPending=true;g.player.superMeter=100;const x=g.boss.x,y=g.boss.y;g.press('r');frames(g,160);assert.ok(g.boss.hp<g.boss.maxHp);assert.ok(g.boss.windup>0);assert.equal(g.boss.x,x);assert.equal(g.boss.y,y);assert.ok(!(g.boss.superLock>0));assert.equal(g.boss.rearCounterPending,true);
});

test('R allows movement and jumping, while Shift cancels pending attacks and returns to play',()=>{
 const g=duel();g.player.x=80;g.player.superMeter=100;g.press('r');g.keys.add('d');frames(g,15);assert.ok(g.player.x>85);g.press(' ');frames(g,3);assert.equal(g.player.onGround,false);g.press('shift');assert.equal(g.player.ultimateT,0);assert.ok(g.player.dash>0);assert.ok(g.hazards.every(h=>h.owner!=='p'||h.delay<=0));assert.ok(g.slashes.every(s=>s.owner!=='p'||s.delay<=0));
});

test('damage interrupts R and removes every unfired projectile and wave; retry resets the cinematic',()=>{
 const g=duel();g.player.superMeter=100;g.press('r');g.player.damage(5,-1);assert.equal(g.player.ultimateT,0);assert.equal(g.player.attack,0);assert.equal(g.hazards.filter(h=>h.owner==='p').length,0);assert.equal(g.slashes.filter(s=>s.owner==='p').length,0);frames(g,45);assert.equal(g.feedback.particles,0);g.startBoss(0);assert.equal(g.player.superCinematicPlayed,false);
});

test('the operation shield blocks R without consuming its gauge, while W can damage the relays',()=>{
 const g=operationDuel(),op=g.boss.operation;g.player.superMeter=100;g.press('r');assert.equal(g.player.superMeter,100);assert.equal(g.player.ultimateT,0);
 const node=op.nodes[0];g.player.x=node.x-55;g.player.face=1;g.press('w');frames(g,110);assert.ok(node.hp<node.maxHp);
});

test('repeated cancelled ultimates do not accumulate particles, projectiles or stale cinematic state',()=>{
 const g=duel();g.player.x=65;for(let i=0;i<8;i++){g.player.superMeter=100;g.player.sp=100;g.player.driveLock=0;g.player.dash=0;g.player.attack=0;g.press('r');frames(g,5);g.press('shift');frames(g,30);assert.equal(g.player.ultimateT,0);assert.ok(g.hazards.length<12);assert.ok(g.feedback.particles<15);}
 frames(g,120);assert.equal(g.hazards.filter(h=>h.owner==='p').length,0);assert.equal(g.feedback.particles,0);
});

test('R compression hits at near and far ranges at 30 and 60 fps',()=>{
 for(const dt of [1/30,1/60])for(const gap of [45,205])for(const repeat of [false,true]){
  const g=game(true);g.engage();g.boss.x=300;g.player.x=300-gap;g.boss.retreatCooldown=999;g.player.superMeter=100;g.player.superCinematicPlayed=repeat;g.press('r');frames(g,Math.ceil(7/dt),dt);assert.equal(g.boss.maxHp-g.boss.hp,156,`${dt} ${gap} ${repeat}`);
 }
});

test('R targets a forward position once and misses an enemy that leaves it',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1]){
  const g=duel();g.boss.x=240;g.player.x=g.boss.x+side*90;g.player.face=-side;g.player.superMeter=100;g.press('r');
  const field=g.slashes.find(s=>s.kind==='psiCrushFinal');assert.ok(Math.abs(field.x+field.radius-(g.boss.x+g.boss.w/2))<1);
  const locked=field.x;g.boss.x+=side*150;frames(g,160,dt);assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(field.x,locked);
 }
});

test('R cannot spend its gauge while the boss is transforming',()=>{
 const g=duel();g.boss.tele=4;g.player.superMeter=100;g.press('r');assert.equal(g.player.superMeter,100);assert.equal(g.player.ultimateT,0);assert.equal(g.slashes.filter(s=>s.kind.startsWith('psiCrush')).length,0);
});

test('existing surgical-operation stagger expires and the rear counter can resume',()=>{
 const g=operationDuel();g.boss.endOperation(true);g.freeze(0);g.boss.rearCounterPending=true;assert.ok(g.boss.psiStagger>0);until(g,()=>g.boss.move===8&&g.boss.windup>0);assert.equal(g.boss.psiStagger,0);
});
