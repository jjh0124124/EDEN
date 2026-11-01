const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function lab(concept){
 const events={},ctx=new Proxy({}, {get:(o,k)=>k==='measureText'?s=>({width:s.length*6}):()=>{},set:()=>true});
 const canvas={width:480,height:270,getContext:()=>ctx,addEventListener(){},focus(){}};
 const world={console,Math,EDEN_LAB_CONCEPT:concept,performance:{now:()=>0},requestAnimationFrame:()=>{},addEventListener:(n,fn)=>{(events[n]??=[]).push(fn);},document:{querySelectorAll:()=>[],querySelector:s=>s==='#game'?canvas:{classList:{add(){}}}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},EdenPresentation:{Soundtrack:class{tone(){}noise(){}tick(){}wake(){}}}};
 world.window=world;
 const hook=`window.labTest={get p(){return player},get b(){return boss},get state(){return state},get slashes(){return slashes},keys,pressed,step(dt=1/60){update(dt);pressed.clear()},press(k){pressed.add(k);update(1/60);pressed.clear()},freeze(v){hitstop=v},setState(s){state=s},restart:labRestart};`;
 let source=fs.readFileSync('src/game.js','utf8'),experiment=fs.readFileSync('experiments/combat-systems.js','utf8');
 source=source.slice(0,source.lastIndexOf('})();'))+experiment+hook+'})();';vm.runInNewContext(source,world);
 const g=world.labTest;g.b.inv=0;g.b.t=999;return g;
}
function frames(g,n=60,dt=1/60){for(let i=0;i<n;i++)g.step(dt);}
function resetPause(g){g.freeze(0);}
function opening(g){g.p.x=g.b.x-40;g.p.face=1;g.b.recovery=2;g.press('j');for(let i=0;i<25&&g.p.lab.grip<=0;i++)g.step();resetPause(g);}
for(const concept of ['pressure','thermal','clamp']){
 test(`${concept}: Shift moves without free attack damage and J is a single poke`,()=>{const g=lab(concept);g.p.x=g.b.x-65;g.press('shift');frames(g,30);assert.equal(g.b.hp,g.b.maxHp);assert.equal(g.slashes.length,0);g.p.x=g.b.x-35;g.p.face=1;g.press('j');frames(g,25);assert.ok(g.b.hp<g.b.maxHp);assert.equal(g.p.combo,1);});
 test(`${concept}: restart clears resource state and victory cannot advance to another boss`,()=>{const g=lab(concept);g.p.lab.heat=80;g.p.lab.pressure=2;g.p.lab.pin=.5;g.setState('reward');g.press('enter');assert.equal(g.state,'combat');assert.equal(g.b.d.type,'surgeon');assert.equal(g.p.lab.heat,0);assert.equal(g.p.lab.pressure,0);assert.equal(g.p.lab.pin,0);});
}
test('pressure: stationary/wall brakes cannot farm; actual travel can be stored and expires',()=>{
 const g=lab('pressure');g.press('e');assert.equal(g.p.lab.pressure,0);g.p.x=453;g.keys.add('d');frames(g,30);g.press('e');assert.equal(g.p.lab.pressure,0);
 g.p.x=100;g.press('shift');frames(g,10);g.press('e');assert.ok(g.p.lab.pressure>=1);assert.equal(g.p.dash,0);assert.equal(g.p.vx,0);g.keys.clear();frames(g,260);assert.equal(g.p.lab.pressure,0);
});
test('pressure: vault spends one unit while full piston spends both and breaks a cast',()=>{
 for(const dt of [1/30,1/60]){const g=lab('pressure');g.p.lab.pressure=2;g.p.lab.bankLife=4;g.press('q');assert.equal(g.p.lab.pressure,1);assert.ok(g.p.vy<0);frames(g,90,dt);g.p.x=g.b.x-35;g.p.face=1;g.p.lab.pressure=2;g.p.lab.bankLife=4;g.b.windup=1;g.b.windupMax=1;g.press('w');assert.equal(g.p.lab.pressure,0);frames(g,14,dt);assert.equal(g.b.windup,0);assert.ok(g.b.recovery>0);}
});
test('thermal: repeated attacks saturate; exhaust trades position for capacity, no free attack',()=>{
 const g=lab('thermal');for(let i=0;i<6;i++){g.press('j');frames(g,15);}assert.ok(g.p.lab.denied>0);const heat=g.p.lab.heat,x=g.p.x,hp=g.b.hp;g.press('e');frames(g,18);assert.ok(g.p.lab.heat<heat-35);assert.ok(g.p.x<x);assert.equal(g.b.hp,hp);assert.equal(g.p.lab.vents,1);
});
test('clamp: neutral hit does not permit capture, exposed confirmed hit does',()=>{
 const g=lab('clamp');g.p.x=g.b.x-35;g.press('j');frames(g,7);resetPause(g);g.press('e');assert.equal(g.p.lab.pin,0);frames(g,30);opening(g);g.press('e');assert.ok(g.p.lab.pin>0);assert.ok(g.b.superLock>0);assert.equal(g.p.lab.catches,1);
});
test('clamp: three outcomes trade damage, side change, or super resource; cannot chain holds',()=>{
 for(const key of ['j','q','w']){const g=lab('clamp');opening(g);g.press('e');assert.ok(g.p.lab.pin>0);const hp=g.b.hp,meter=g.p.superMeter;g.press(key);frames(g,65);assert.equal(g.p.lab.pin,0);assert.equal(g.b.superLock,0);if(key==='j')assert.ok(g.b.hp<hp);else assert.equal(g.b.hp,hp);if(key==='q')assert.ok(g.p.x>g.b.x+g.b.w);if(key==='w')assert.equal(g.p.superMeter,meter+18);assert.ok(g.p.lab.pinLock>0);}
});
test('clamp: incoming damage releases both participants immediately',()=>{const g=lab('clamp');opening(g);g.press('e');g.p.damage(10,-1);assert.equal(g.p.lab.pin,0);assert.equal(g.b.superLock,0);assert.ok(g.p.stun>0);});

function duel(concept,tactical){
 const g=lab(concept);g.b.t=1.4;g.b.inv=.8;
 let frame=0;
 for(;frame<10800&&g.state==='combat';frame++){
  const p=g.p,b=g.b,l=p.lab;g.keys.clear();
  if(p.hp<=0||b.dead){g.step();continue;}
  const dx=b.x+21-p.x-9,dir=Math.sign(dx)||1,range=Math.abs(dx);
  let move=range>48?dir:0;
  if(p.face!==dir)move=dir;
  if(tactical){
   if(b.windup>0&&b.move%3===1&&Math.abs(p.x+9-b.target.x)<65)move=p.x<240?-1:1;
   if(b.tele>0)move=-dir;
  }
  if(move)g.keys.add(move>0?'d':'a');
  if(tactical&&b.windup>0&&b.move%3===0&&b.windup<.22&&range<140&&p.onGround){if(p.attack<=0&&p.face===dir&&p.parryLock<=0)g.pressed.add('k');else g.pressed.add(' ');}
  else if(tactical&&p.superMeter>=100&&range<60&&b.recovery>0)g.pressed.add('r');
  else if(tactical===true&&concept==='pressure'){
   if(l.travel>=35&&l.pressure<2&&p.onGround&&Math.abs(p.vx)>70)g.pressed.add('e');
   else if(l.pressure&&range<60&&p.onGround){g.pressed.add(b.move%3===1&&b.windup>0?'q':'w');}
   else if(range>90&&p.driveLock<=0&&p.sp>=10)g.pressed.add('shift');
   else if(range<60&&p.attack<=0)g.pressed.add('j');
  }else if(tactical===true&&concept==='thermal'){
   if(l.heat>65&&l.ventLock<=0&&p.sp>=10)g.pressed.add('e');
   else if(l.heat<=65&&range>48&&range<95&&p.attack<=0)g.pressed.add('q');
   else if(range<60&&p.attack<=0)g.pressed.add('j');
  }else if(tactical===true&&concept==='clamp'){
   if(l.pin>0)g.pressed.add(p.x<60||p.x>400?'q':p.superMeter<82?'w':'j');
   else if(l.grip>0&&b.recovery>0&&b.release<=0&&b.windup<=0&&b.tele<=0&&!b.protocol&&l.pinLock<=0)g.pressed.add('e');
   else if(range<60&&p.attack<=0)g.pressed.add('j');
  }else if(range<60&&p.attack<=0)g.pressed.add('j');
  g.step();
 }
 return {concept,tactical,state:g.state,seconds:Math.round(frame/60),hp:g.p.hp,bossHp:g.b.hp,phase:g.b.phase,branches:g.p.lab.branches,denied:g.p.lab.denied};
}
test('comparative normal-stat duels remain finite and record decisions for all candidates',()=>{
 const results=[];
 for(const concept of ['pressure','thermal','clamp'])for(const tactical of [false,'defense',true]){const result=duel(concept,tactical);results.push(result);assert.ok(Number.isFinite(result.hp));assert.ok(result.bossHp>=0);}
 console.log('LAB COMPARISON',JSON.stringify(results));
 fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'eden-lab-comparison.json'),JSON.stringify(results,null,2));
});
