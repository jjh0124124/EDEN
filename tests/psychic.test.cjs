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
 const g=duel();g.player.x=g.boss.x-55;g.boss.psiGuard=.8;g.boss.dir=-1;g.press('e');for(let i=0;i<30&&!g.boss.psiCompression;i++)g.step();assert.ok(g.boss.psiCompression>0);assert.equal(g.boss.psiGuard,0);g.freeze(0);const hp=g.boss.hp;g.press('w');frames(g,28);assert.equal(g.boss.psiCompression,0);assert.ok(hp-g.boss.hp>=50);const again=g.boss.hp;g.boss.recovery=0;g.boss.inv=0;g.player.skill(1);frames(g,28);assert.equal(again-g.boss.hp,32);
});
test('skills require SP and do not create free effects or attacks on rejected input',()=>{
 const g=duel();g.player.sp=0;for(const key of ['q','w','e'])g.player.skill(['q','w','e'].indexOf(key));assert.equal(g.slashes.length,0);assert.equal(g.player.attack,0);
});
test('new ultimate locks only after contact, defers phase change, and cancels hostile attacks',()=>{
 const g=duel();g.boss.hp=400;g.player.superMeter=100;g.press('r');for(let i=0;i<30&&g.player.ultimateT<=0;i++)g.step();assert.ok(g.player.ultimateT>1.2);assert.equal(g.boss.phase,1);assert.equal(g.slashes.filter(s=>s.superHit).length,3);frames(g,65);assert.equal(g.boss.phase,1);frames(g,65);assert.equal(g.boss.phase,2);assert.equal(g.player.ultimateT,0);
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

test('SURGEON core can be reflected with timed Q from either side at 30 and 60 fps',()=>{
 for(const side of [-1,1])for(const dt of [1/30,1/60]){
  const g=coreDuel(side,dt);until(g,()=>g.hazards.some(h=>h.counterable&&h.delay<=0&&h.y>=110),dt);
  g.press('q');until(g,()=>g.hazards.some(h=>h.psiReturn),dt);until(g,()=>g.boss.hp<g.boss.maxHp,dt);
  assert.equal(g.player.hp,100);assert.ok(g.boss.recovery>=1.5);assert.ok(g.player.superMeter>10);
  const hp=g.boss.hp;frames(g,15,dt);assert.equal(g.boss.hp,hp,'return hits only once');
 }
});
test('the core locks its target, can be dodged, and punishes a premature Q',()=>{
 const g=coreDuel(),locked=g.boss.target.x;g.keys.add('a');frames(g,110);g.keys.clear();
 assert.equal(g.boss.target.x,locked);assert.equal(g.player.hp,100);
 const h=coreDuel();until(h,()=>h.hazards.some(x=>x.counterable));h.press('q');until(h,()=>h.player.hp<100);
 assert.equal(h.player.hp,86);assert.equal(h.boss.hp,h.boss.maxHp);
});
test('phase-two surgical protocol keeps its normal needles and cannot be interrupted by a late reflected core',()=>{
 const g=coreDuel();g.boss.beginProtocolCast(0);until(g,()=>g.hazards.some(h=>h.protocol));
 assert.equal(g.hazards.filter(h=>h.protocol).length,3);assert.ok(g.hazards.every(h=>!h.counterable));
 const h=coreDuel();until(h,()=>h.hazards.some(x=>x.counterable&&x.delay<=0&&x.y>=110));h.press('q');until(h,()=>h.hazards.some(x=>x.psiReturn));
 const returned=h.hazards.find(x=>x.psiReturn);h.boss.beginProtocolCast(0);returned.x=h.boss.x-1;returned.y=h.boss.y+35;returned.vx=220;returned.vy=0;h.freeze(0);h.step();
 assert.ok(h.boss.protocol);assert.ok(h.boss.windup>0);assert.ok((h.boss.recovery||0)<1);
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
