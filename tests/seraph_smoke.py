"""Focused live-browser verification of the SURGEON to SERAPH phase."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.seraphTest={
 get p(){return player},get b(){return boss},get state(){return state},get hazards(){return hazards},get slashes(){return slashes},
 first(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=250;boss.inv=0;boss.hp=901;boss.operationUsed=true;boss.t=999;player.x=215;player.face=1;},
 phase(move){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.phase=2;boss.tele=0;boss.inv=0;boss.hp=900;boss.x=240;boss.y=111;boss.seraphCycle=0;boss.t=999;player.x=195;player.face=1;boss.beginSeraph(move);}
};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.inversionFrames=0;window.seraphText=new Set();const fill=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...args){if(this.globalCompositeOperation==='difference')window.inversionFrames++;return fill.call(this,...args)};const text=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){if(typeof value==='string'&&(value.includes('CAST / 방향')||value.includes('EXPOSED')||value.includes('ATTACK /')))window.seraphText.add(value);return text.call(this,value,...args)}''')
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('seraphTest.first()');page.keyboard.press('j');page.wait_for_function('seraphTest.b.phase===2 && seraphTest.b.tele>6.7');assert page.evaluate('seraphTest.b.inv')>6.7
 page.locator('#game').screenshot(path='/tmp/seraph32-kneel.png')
 page.wait_for_function('seraphTest.b.tele<4.6');page.locator('#game').screenshot(path='/tmp/seraph32-core.png')
 page.wait_for_function('seraphTest.b.tele<2.4');page.locator('#game').screenshot(path='/tmp/seraph32-wings.png')
 page.wait_for_function('seraphTest.b.tele<1.0');page.locator('#game').screenshot(path='/tmp/seraph32-reveal.png')
 page.wait_for_function('seraphTest.b.tele===0');assert page.evaluate('seraphTest.b.hp')<901
 # Actual rendering uses the complete animated body-and-wing poses at each stage.
 frames=page.evaluate('''()=>{const c=document.createElement('canvas');c.width=480;c.height=270;const ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let kind='',seen=new Set();ctx.drawImage=(im,...a)=>{if(im.src?.includes(kind))seen.add(a[0]+','+a[1]);return orig(im,...a)};kind='seraph-transform-v33';for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:7-(i+.1)*7/16},0);const transition=seen.size;kind='seraph-inbetween-v33';seen=new Set();for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:7-(i+.6)*7/16},0);const between=seen.size;kind='seraph-idle-v33';seen=new Set();for(let i=0;i<8;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,windup:0,release:0,recovery:0,seraphDive:null,seraphMoving:false,seraphFrameClock:i+.1},0);return [transition,between,seen.size]}''');assert frames==[16,16,8],frames
 # The transformation grows progressively and ends at the same scale as the combat sprite.
 sizes=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let size=0;ctx.drawImage=(im,...a)=>{if(/seraph-(transform|inbetween|idle)-v33/.test(im.src||''))size=Math.abs(ctx.getTransform().a)*a[7];return orig(im,...a)};return [6.99,1,0].map(tele=>{size=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele,seraphMove:null,windup:0,release:0,recovery:0,seraphDive:null},0);return size})}''');assert 99<sizes[0]<101 and 134<sizes[1]<136 and 134<sizes[2]<136,sizes
 # The discarded surgical arms appear only during the opening of the transformation.
 arms=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let n=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-parts-v32')&&a[0]===444&&a[1]===444)n++;return orig(im,...a)};function draw(tele){n=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele},2);return n}return [draw(6),draw(3)]}''');assert arms==[2,0],arms
 # Every attack uses its own body-and-wing animation, through startup, hit and recovery.
 actions=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx),out={};let name='',seen=new Set();ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-'+name))seen.add(a[0]+','+a[1]);return orig(im,...a)};for(const [move,file] of [['cleave','cut-v34'],['descent','dive-v33'],['feathers','feathers-v34'],['halo','beam-v34']]){name=file;seen=new Set();for(const [windup,release,recovery] of [[.85,0,0],[.15,0,0],[0,.35,1],[0,0,.5]])EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,seraphMove:move,seraphDive:null,windupMax:1,windup,release,recovery},2);out[move]=seen.size}return out}''');assert all(value==4 for value in actions.values()),actions
 # The exposed core appears only during safe recovery; the HUD distinguishes the active attack.
 counts=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let n=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-vfx-v33')&&a[0]===1086&&a[1]===724)n++;return orig(im,...a)};function draw(release){n=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,recovery:1,release,windup:0,seraphDive:null},2);return n}return [draw(.2),draw(0)]}''');assert counts==[0,1],counts
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.recovery=1;seraphTest.b.release=.3;seraphTest.b.t=999")
 page.wait_for_function('Array.from(seraphText).some(s=>s.includes("ATTACK / 공격 중"))');page.wait_for_function('Array.from(seraphText).some(s=>s.includes("EXPOSED / 피해 +25%"))');page.locator('#game').screenshot(path='/tmp/seraph33-recovery.png')
 # The new slash art is shown during the actual expanded collision.
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.performSeraph()")
 page.wait_for_function('seraphTest.slashes.some(s=>s.seraphImpact && s.delay<=0)');page.locator('#game').screenshot(path='/tmp/seraph34-cleave.png')
 # A real airborne J connects with the wing while outside the old torso box.
 page.evaluate("seraphTest.phase('cleave');Object.assign(seraphTest.b,{windup:0,t:999});Object.assign(seraphTest.p,{x:172,y:130,vy:0,onGround:false,face:1})")
 page.keyboard.press('j');page.wait_for_function('seraphTest.b.hp<900')
 # K follows the normal live incision collision; the second K uses the existing counter input.
 page.evaluate("seraphTest.phase('cleave')");page.wait_for_function("seraphTest.slashes.some(s=>s.seraph && s.delay<=.05)");page.keyboard.press('k');page.wait_for_function('seraphTest.p.parryFollow>0');page.keyboard.press('k');page.wait_for_function('seraphTest.p.weaponMode==="psiCounter"');page.wait_for_function('seraphTest.b.hp<900');assert page.evaluate('seraphTest.p.hp')==100
 # Actual input during the low beam; the same jump response also covers the larger ultimate.
 for move in ['halo','final']:
  page.evaluate('(m)=>seraphTest.phase(m)',move);page.wait_for_function('seraphTest.b.windup>0 && seraphTest.b.windup<.16');page.keyboard.press('Space')
  page.wait_for_function('seraphTest.hazards.some(h=>h.seraphBeam && h.delay<=0)');page.locator('#game').screenshot(path='/tmp/seraph32-'+move+'.png')
  page.wait_for_function('!seraphTest.hazards.some(h=>h.seraphBeam)');assert page.evaluate('seraphTest.p.hp')==100,move
 assert page.evaluate('inversionFrames')>0
 # Move through the boss while it tracks, then cross back during the locked warning.
 page.evaluate("seraphTest.phase('final')");page.keyboard.down('d')
 page.wait_for_function('seraphTest.p.x+9>seraphTest.b.x+21 && seraphTest.b.dir===1 && !seraphTest.b.seraphLocked');page.keyboard.up('d')
 page.wait_for_function('seraphTest.b.seraphLocked');page.wait_for_function('Array.from(seraphText).some(s=>s.includes("CAST / 방향 고정"))');assert page.evaluate('Array.from(seraphText).some(s=>s.includes("CAST / 방향 추적"))')
 page.keyboard.down('a');page.wait_for_function('seraphTest.p.x+9<seraphTest.b.x+21');page.keyboard.up('a');assert page.evaluate('seraphTest.b.dir')==1
 page.wait_for_function('seraphTest.hazards.some(h=>h.seraphFinal && h.delay<=0)');page.wait_for_function('!seraphTest.hazards.some(h=>h.seraphFinal)');assert page.evaluate('seraphTest.p.hp')==100
 # Existing player damage and normal boss death end the fight.
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.t=999;seraphTest.b.hp=20")
 page.keyboard.press('q');page.wait_for_function('seraphTest.b.dead');page.wait_for_function('seraphTest.state==="ending"',timeout=8000)
 assert not errors,errors
 print('PASS: real J triggers seven-second transformation; 32 transformation frames and 8 idle frames, K parry/counter, jumpable halo/ultimate, tracking/locked directions, inversion and victory; no browser errors')
 browser.close()
