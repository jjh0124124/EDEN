const {test}=require('node:test'),assert=require('node:assert/strict');
const {game}=require('./game-harness.cjs');
function until(g,fn,dt=1/60,max=1000){for(let i=0;i<max&&!fn();i++)g.step(dt);assert.ok(fn(),'expected event did not occur');}
function setup(move,side=-1){const g=game(true);g.engage();g.boss.phase=2;g.boss.tele=0;g.boss.inv=0;g.boss.x=240;g.boss.y=111;g.boss.t=999;g.boss.seraphCycle=0;g.player.x=g.boss.x+side*45;g.player.face=-side;g.boss.beginSeraph(move);return g;}

test('first-phase threshold launches a seven-second protected transformation and a new combat phase',()=>{
 const g=game(true);g.engage();g.boss.hp=900;g.boss.checkPhase();assert.equal(g.boss.phase,2);assert.equal(g.boss.tele,7);assert.equal(g.boss.inv,7);
 for(let i=0;i<350;i++)g.step(1/60);assert.ok(g.boss.tele>1);assert.equal(g.hazards.length,0);const hp=g.boss.hp;g.boss.hurt(50);assert.equal(g.boss.hp,hp);
 until(g,()=>g.boss.tele===0);assert.equal(g.boss.inv,0);assert.ok(g.boss.y<=118,'hover hitbox should match the end of the transformation');until(g,()=>g.boss.seraphMove==='cleave'&&g.boss.windup>0);assert.equal(g.boss.d.type,'surgeon');
});

test('first-phase SURGEON still selects the existing surgical incision',()=>{
 const g=game(true);g.engage();g.boss.x=240;g.player.x=195;g.boss.t=0;g.step();assert.equal(g.boss.phase,1);assert.equal(g.boss.move,0);assert.ok(g.boss.windup>0);assert.equal(g.boss.seraphMove,undefined);
});

test('Seraphic Cleave is announced and can be parried from both sides',()=>{
 for(const dt of [1/30,1/60])for(const side of [-1,1]){const g=setup('cleave',side);assert.ok(g.boss.windup>=.9);until(g,()=>g.slashes.some(s=>s.seraph&&s.delay<=.04),dt);g.press('k');until(g,()=>g.player.parryFollow>0,dt);assert.equal(g.player.hp,100);assert.ok(g.boss.recovery>0);}
});

test('Divine Descent targets a fixed position, rises and can be escaped',()=>{
 for(const dt of [1/30,1/60]){const g=setup('descent');const x=g.boss.seraphTarget.x;g.keys.add('a');let minY=126;for(let i=0;i<Math.ceil(2/dt);i++){g.step(dt);minY=Math.min(minY,g.boss.y);}g.keys.clear();assert.ok(minY<100);assert.equal(g.boss.seraphTarget.x,x);assert.equal(g.player.hp,100);assert.ok(g.boss.recovery>0);}
});

test('Crimson Feathers fires three readable groups and can be jumped',()=>{
 for(const dt of [1/30,1/60]){const g=setup('feathers');until(g,()=>g.hazards.filter(h=>h.seraphFeather).length===24,dt);let jumped=false;
  for(let i=0;i<Math.ceil(3.2/dt);i++){
   const low=g.hazards.find(h=>h.seraphFeather&&h.y>200&&h.delay<=0&&Math.abs(h.x-(g.player.x+9))<70);
   if(!jumped&&low){g.press(' ');jumped=true;}else g.step(dt);
  }
  assert.ok(jumped);assert.equal(g.player.hp,100,`dt ${dt}`);
 }
});

test('Halo Judgment and Final Revelation are telegraphed, jumpable and followed by recovery',()=>{
 for(const move of ['halo','final'])for(const dt of [1/30,1/60]){const g=setup(move);const start=g.boss.windup;assert.ok(start>=1.3);until(g,()=>g.boss.windup>0&&g.boss.windup<.16,dt);g.press(' ');until(g,()=>g.hazards.some(h=>h.seraphBeam&&h.delay<=0),dt);assert.ok(g.boss.recovery>0);until(g,()=>!g.hazards.some(h=>h.seraphBeam),dt);assert.equal(g.player.hp,100,`${move} ${dt}`);}
});

test('Final Revelation triggers once below 25 percent, and boss death clears its attack',()=>{
 const g=setup('halo');g.boss.windup=0;g.boss.recovery=0;g.boss.release=0;g.boss.t=0;g.boss.hp=450;g.step();assert.equal(g.boss.seraphMove,'final');assert.equal(g.boss.seraphFinalUsed,true);until(g,()=>g.hazards.some(h=>h.seraphFinal));g.boss.inv=0;g.boss.hurt(1000);assert.ok(g.boss.dead);assert.equal(g.hazards.length,0);assert.equal(g.slashes.length,0);
});

test('ZERO can hit airborne SERAPH with the existing J and Q attacks',()=>{
 for(const key of ['j','q']){const g=setup('cleave');g.boss.windup=0;g.boss.t=999;g.press(key);until(g,()=>g.boss.hp<g.boss.maxHp);assert.equal(g.boss.phase,2);}
});

test('both beam attacks remain jumpable from either arena wall',()=>{
 for(const move of ['halo','final'])for(const [bx,px] of [[45,95],[395,345]]){
  const g=setup(move);g.boss.x=bx;g.player.x=px;g.player.face=bx<px?-1:1;g.boss.beginSeraph(move);
  until(g,()=>g.boss.windup>0&&g.boss.windup<.16);g.press(' ');until(g,()=>g.hazards.some(h=>h.seraphBeam&&h.delay<=0));until(g,()=>!g.hazards.some(h=>h.seraphBeam));assert.equal(g.player.hp,100,`${move} at ${bx}`);
 }
});

test('Divine Descent can connect during its movement, before the landing impact',()=>{
 const g=setup('descent');until(g,()=>g.player.hp<100);assert.ok(g.boss.seraphDive);assert.equal(g.player.hp,84);
});

test('a correctly timed K parry of Divine Descent avoids its landing follow-up',()=>{
 const g=setup('descent');until(g,()=>g.boss.seraphDive&&g.boss.x<230);g.press('k');until(g,()=>g.player.parryFollow>0);for(let i=0;i<45;i++)g.step();assert.equal(g.player.hp,100);
});

test('SERAPH tracks early movement, then locks its direction with a readable dodge window',()=>{
 for(const move of ['cleave','feathers','halo','final'])for(const dt of [1/30,1/60])for(const side of [-1,1]){
  const g=setup(move,side);assert.equal(g.boss.seraphLocked,false);g.player.x=g.boss.x-side*60;g.step(dt);assert.equal(g.boss.dir,-side);
  until(g,()=>g.boss.seraphLocked,dt);const lockedDir=g.boss.dir,remaining=g.boss.windup;assert.ok(remaining>=g.boss.seraphLockAt-dt-.001);
  g.player.x=g.boss.x+side*60;g.step(dt);assert.equal(g.boss.dir,lockedDir);
 }
});

test('players can still move behind a locked halo or ultimate beam',()=>{
 for(const move of ['halo','final'])for(const dt of [1/30,1/60]){
  const g=setup(move);until(g,()=>g.boss.seraphLocked,dt);const dir=g.boss.dir;g.keys.add('d');until(g,()=>g.boss.release>0,dt);assert.equal(g.boss.dir,dir);
  for(let i=0;i<Math.ceil(.65/dt);i++)g.step(dt);assert.equal(g.player.hp,100,`${move} ${dt}`);
 }
});

test('cleave impact art and sound wait for the active attack',()=>{
 const g=setup('cleave');g.boss.windup=0;g.boss.performSeraph();const initial=g.feedback.particles,sounds=g.sounds.length;g.step(.03);assert.equal(g.feedback.particles,initial);assert.equal(g.sounds.length,sounds);
 until(g,()=>g.slashes.some(s=>s.seraphImpact&&s.delay<=0));assert.equal(g.feedback.particles,initial+1);assert.ok(g.sounds.length>sounds);
});

test('airborne J and Q hit the visible inner wings on both sides without changing phase one',()=>{
 for(const [key,left,right] of [['j',172,320],['q',141,360]])for(const [x,face] of [[left,1],[right,-1]])for(const phase of [1,2]){
  const g=game(true);g.engage();Object.assign(g.boss,{phase,x:240,y:phase===2?111:126,tele:0,inv:0,t:999});Object.assign(g.player,{x,y:130,vy:0,onGround:false,face});g.press(key);
  for(let i=0;i<50;i++)g.step();assert.equal(g.boss.maxHp-g.boss.hp,phase===2?(key==='j'?12:24):0,`${key} face ${face} phase ${phase}`);
 }
});

test('a shard strikes the wing before the torso and an area attack damages the boss only once',()=>{
 const g=game(true);g.engage();Object.assign(g.boss,{phase:2,x:240,y:111,tele:0,inv:0,t:999});Object.assign(g.player,{x:90,y:130,vy:0,onGround:false,face:1});g.press('w');
 let nearest=0;for(let i=0;i<100&&g.boss.hp===g.boss.maxHp;i++){nearest=Math.max(0,...g.hazards.filter(h=>h.kind==='psiShard'&&h.delay<=0).map(h=>h.x));g.step();}
 assert.ok(g.boss.hp<g.boss.maxHp);assert.ok(nearest<g.boss.x-12,'the first shard should connect at the wing');
 const e=game(true);e.engage();Object.assign(e.boss,{phase:2,x:240,y:111,tele:0,inv:0,t:999});Object.assign(e.player,{x:200,y:130,vy:0,onGround:false,face:1});e.press('e');for(let i=0;i<50;i++)e.step();assert.equal(e.boss.maxHp-e.boss.hp,32);
});

test('SERAPH chooses for distance, avoids repeats and retains every pattern',()=>{
 for(const dt of [1/30,1/60])for(const [x,first] of [[200,'cleave'],[40,'halo']]){
  const g=game(true);g.engage();Object.assign(g.boss,{phase:2,x:240,y:111,tele:0,inv:0,t:0});g.player.x=x;const moves=[];
  for(let i=0;i<6;i++){Object.assign(g.boss,{windup:0,release:0,recovery:0,t:0});g.step(dt);moves.push(g.boss.seraphMove);}
  assert.equal(moves[0],first);for(let i=1;i<moves.length;i++)assert.notEqual(moves[i],moves[i-1]);assert.equal(new Set(moves).size,4);
 }
});

test('SERAPH accelerates and settles without resetting the idle animation clock',()=>{
 const g=game(true);g.engage();Object.assign(g.boss,{phase:2,x:240,y:111,tele:0,inv:0,t:5});g.player.x=20;g.step();const first=Math.abs(g.boss.seraphVX),clock=g.boss.seraphFrameClock;
 for(let i=0;i<20;i++)g.step();assert.ok(Math.abs(g.boss.seraphVX)>first*3);g.player.x=g.boss.x-100;
 for(let i=0;i<45;i++)g.step();assert.ok(Math.abs(g.boss.seraphVX)<1);assert.ok(g.boss.seraphFrameClock>clock+4);
});

test('the expanded cleave reaches its warning and remains avoidable',()=>{
 for(const dt of [1/30,1/60])for(const [x,expected] of [[120,84],[70,100]]){
  const g=setup('cleave');g.player.x=x;g.boss.windup=0;g.boss.dir=-1;g.boss.performSeraph();assert.equal(g.slashes.find(s=>s.seraphImpact).w,150);
  for(let i=0;i<Math.ceil(.6/dt);i++)g.step(dt);assert.equal(g.player.hp,expected,`x=${x}, dt=${dt}`);
 }
});

test('descent warning stays centered on its actual landing at either wall',()=>{
 for(const [bossX,playerX,expected] of [[395,8,66],[45,455,416]]){
  const g=setup('descent');g.boss.x=bossX;g.player.x=playerX;g.boss.beginSeraph('descent');assert.equal(g.boss.seraphTarget.x,expected);
  until(g,()=>g.slashes.some(s=>s.seraph&&!s.parryable));const landing=g.slashes.find(s=>s.seraph&&!s.parryable);assert.equal(landing.w,116);assert.equal(landing.x+landing.w/2,expected);
 }
});
