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
test('uppercut lifts only an exposed SURGEON and returns him to the floor at 30/60fps',()=>{
 for(const dt of [1/30,1/60]){const g=duel();g.boss.recovery=1.5;g.press('q');frames(g,8,dt);assert.ok(g.boss.psiLaunchLock>0);for(let i=0;i<8&&g.boss.y===126;i++)g.step(dt);assert.ok(g.boss.y<126);frames(g,30,dt);assert.equal(g.boss.y,126);}
});
test('taking damage cancels psychic startups; death/retry resets all new boss states',()=>{
 const g=duel();g.press('w');g.player.damage(10,-1);frames(g,30);assert.equal(g.boss.hp,g.boss.maxHp);g.boss.psiGuard=.5;g.startBoss(0);assert.equal(g.boss.psiGuard,undefined);assert.equal(g.player.linkWindow,0);
});
test('new module does not change later-boss charge or skills',()=>{const g=game(true);g.engage(1);g.player.skill(0);assert.equal(g.player.weaponMode,'triple');assert.equal(g.slashes.length,3);});
test('ZERO POINT confirms only on hit and completes its existing four-contact sequence',()=>{const g=duel();g.player.superMeter=100;g.press('r');frames(g,100);assert.ok(g.boss.hp<=g.boss.maxHp-100);assert.equal(g.player.ultimateT,0);assert.equal(g.player.superMeter,0);});
test('airborne repeated Q cannot relaunch ZERO and released jab cannot be stacked by rapid inputs',()=>{const g=duel();g.player.x=65;g.press('q');frames(g,12);const y=g.player.y;g.player.skill(0);assert.ok(g.player.vy>=30);frames(g,60);assert.ok(g.player.onGround);const h=duel();for(let i=0;i<8;i++)h.press('j');assert.equal(h.player.attackSerial,1);});
test('phase transition/death clears guard and airborne boss displacement',()=>{for(const dead of [false,true]){const g=duel();g.boss.psiLift=.3;g.boss.y=105;g.boss.psiGuard=.5;if(dead)g.boss.dead=true;else g.boss.tele=1;g.boss.update(.016);assert.equal(g.boss.y,126);assert.equal(g.boss.psiGuard,0);}});
