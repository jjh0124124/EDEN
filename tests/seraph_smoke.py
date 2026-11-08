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
 page.add_init_script('''window.inversionFrames=0;const fill=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...args){if(this.globalCompositeOperation==='difference')window.inversionFrames++;return fill.call(this,...args)}''')
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('seraphTest.first()');page.keyboard.press('j');page.wait_for_function('seraphTest.b.phase===2 && seraphTest.b.tele>6.7');assert page.evaluate('seraphTest.b.inv')>6.7
 page.locator('#game').screenshot(path='/tmp/seraph32-kneel.png')
 page.wait_for_function('seraphTest.b.tele<4.6');page.locator('#game').screenshot(path='/tmp/seraph32-core.png')
 page.wait_for_function('seraphTest.b.tele<2.4');page.locator('#game').screenshot(path='/tmp/seraph32-wings.png')
 page.wait_for_function('seraphTest.b.tele<1.0');page.locator('#game').screenshot(path='/tmp/seraph32-reveal.png')
 page.wait_for_function('seraphTest.b.tele===0');assert page.evaluate('seraphTest.b.hp')<901
 # Count separate wing draws, rather than judging six wings from a single static picture.
 count=page.evaluate('''()=>{const c=document.createElement('canvas');c.width=480;c.height=270;const ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let wings=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-parts-v32')&&a[1]===0)wings++;return orig(im,...a)};EdenPresentation.boss(ctx,seraphTest.b,1.7);return wings}''');assert count==6,count
 # K follows the normal live incision collision; the second K uses the existing counter input.
 page.evaluate("seraphTest.phase('cleave')");page.wait_for_function("seraphTest.slashes.some(s=>s.seraph && s.delay<=.05)");page.keyboard.press('k');page.wait_for_function('seraphTest.p.parryFollow>0');page.keyboard.press('k');page.wait_for_function('seraphTest.p.weaponMode==="psiCounter"');page.wait_for_function('seraphTest.b.hp<900');assert page.evaluate('seraphTest.p.hp')==100
 # Actual input during the low beam; the same jump response also covers the larger ultimate.
 for move in ['halo','final']:
  page.evaluate('(m)=>seraphTest.phase(m)',move);page.wait_for_function('seraphTest.b.windup>0 && seraphTest.b.windup<.16');page.keyboard.press('Space')
  page.wait_for_function('seraphTest.hazards.some(h=>h.seraphBeam && h.delay<=0)');page.locator('#game').screenshot(path='/tmp/seraph32-'+move+'.png')
  page.wait_for_function('!seraphTest.hazards.some(h=>h.seraphBeam)');assert page.evaluate('seraphTest.p.hp')==100,move
 assert page.evaluate('inversionFrames')>0
 # Existing player damage and normal boss death end the fight.
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.t=999;seraphTest.b.hp=20")
 page.keyboard.press('q');page.wait_for_function('seraphTest.b.dead');page.wait_for_function('seraphTest.state==="ending"',timeout=8000)
 assert not errors,errors
 print('PASS: real J triggers seven-second transformation; six individually drawn wings, K parry/counter, jumpable halo/ultimate, inversion and victory; no browser errors')
 browser.close()
