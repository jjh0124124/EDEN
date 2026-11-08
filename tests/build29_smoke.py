"""Exercise the PINCER, psychic compression and live link guidance in Chromium."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.build29={
 get p(){return player},get b(){return boss},get lift(){return psychicLift(boss)},get hazards(){return hazards},get particles(){return particles},get messages(){return messages},
 setup(x=295){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=330;boss.inv=0;boss.t=999;player.x=x;player.face=1;}
};})();''')

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('''()=>{window.uiSeen=new Set();const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(typeof t==='string'&&(t==='LINK'||t.includes('금색 기술')))uiSeen.add(t);return original.call(this,t,...a)}}''')

 # Confirmed J visibly exposes only ready skill links.
 page.evaluate('build29.setup()');page.keyboard.press('j')
 page.wait_for_function('build29.p.linkWindow>0');page.wait_for_function('uiSeen.has("LINK")')
 page.screenshot(path='/tmp/eden29-link.png')

 # E's restraint appears, and R consumes it for the stronger psychic finish.
 page.evaluate('build29.setup();build29.p.superMeter=100');page.keyboard.press('e')
 page.wait_for_function('build29.b.psiCompression>0 && build29.particles.some(p=>p.sprite==="psiHold")')
 page.screenshot(path='/tmp/eden29-hold.png');page.wait_for_timeout(750)
 assert page.evaluate('build29.b.psiCompression>0 && build29.particles.some(p=>p.sprite==="psiHold" && p.requiresCompression)')
 page.keyboard.press('r')
 page.wait_for_function('build29.p.ultimateT>1.2 && build29.p.superCompressed')
 assert page.evaluate('build29.b.psiCompression')==0
 assert page.evaluate('build29.particles.some(p=>p.sprite==="psiCrush")')
 page.wait_for_function('build29.particles.every(p=>!p.requiresCompression)')
 page.wait_for_function('build29.p.ultimateT<.9 && build29.p.ultimateT>.45')
 assert page.evaluate('build29.lift>4 && build29.b.y===126')
 page.screenshot(path='/tmp/eden29-crush.png')
 page.wait_for_function('build29.p.ultimateT===0')

 # A committed boss attack rejects E with a specific on-screen reason.
 page.evaluate('build29.setup();build29.b.move=0;build29.b.windup=1;build29.b.windupMax=1')
 page.keyboard.press('e');page.wait_for_function('build29.messages.some(m=>m.text.includes("E 실패"))')
 assert not page.evaluate('build29.b.psiCompression>0')

 # The surgical pincer is telegraphed; a real K parry removes the field and opens a punish.
 page.evaluate('build29.setup(130);build29.b.patternCount=2;build29.b.t=0')
 page.wait_for_function('build29.b.move===7 && build29.b.windup>.5')
 assert page.evaluate('build29.b.speech.includes("퇴로")')
 page.screenshot(path='/tmp/eden29-pincer-warning.png')
 page.wait_for_function('build29.hazards.some(h=>h.pincerShot && h.delay<=0 && Math.abs(h.x-(build29.p.x+9))<35)')
 page.keyboard.press('k');page.wait_for_function('build29.p.parryFollow>0')
 assert page.evaluate('build29.p.hp')==100
 assert page.evaluate('build29.hazards.every(h=>!h.pincerField)')
 assert page.evaluate('build29.b.recovery')>1
 assert page.evaluate('build29.messages.some(m=>m.text.includes("봉쇄 해제"))')
 page.screenshot(path='/tmp/eden29-pincer-parry.png')

 # Two rear hits during a committed attack produce a warned two-sided sweep.
 page.evaluate('build29.setup(375);build29.p.face=-1;build29.b.dir=-1;build29.b.move=0;build29.b.windup=2;build29.b.windupMax=2')
 page.keyboard.press('j');page.wait_for_function('build29.b.hp<build29.b.maxHp')
 page.wait_for_function('build29.p.attack<=0');page.keyboard.press('j')
 page.wait_for_function('build29.b.rearCounterPending')
 page.wait_for_function('build29.b.move===8 && build29.b.windup>.5')
 page.screenshot(path='/tmp/eden29-rear-warning.png')
 page.wait_for_function('build29.b.windup>0 && build29.b.windup<.34');page.keyboard.press('Space')
 page.wait_for_function('build29.hazards.some(h=>h.rearSweep)')
 page.wait_for_function('!build29.hazards.some(h=>h.rearSweep)')
 assert page.evaluate('build29.p.hp')==100

 # The guide is available with keyboard focus and its Enter does not advance the game.
 page.locator('.combat-guide summary').focus();page.keyboard.press('Enter')
 assert page.locator('.combat-guide').evaluate('e=>e.open')
 assert 'SURGEON 압축' in page.locator('.combat-guide').inner_text()
 assert not errors,errors
 print('PASS: real-key hit links, E→R psychic finish, E rejection, PINCER K, rear sweep jump and keyboard guide; no JS errors')
 browser.close()
