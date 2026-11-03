"""Exercise BUILD 27's new decisions with browser keyboard input."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
source = (root / 'src/game.js').read_text().replace('})();', '''window.build27={
 get p(){return player},get b(){return boss},get hazards(){return hazards},get slashes(){return slashes},
 setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=330;boss.inv=0;boss.t=999;player.x=210;player.face=1;}
};})();''')

with sync_playwright() as p:
 browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
 page = browser.new_page(viewport={'width':1440,'height':1050})
 errors=[]
 page.on('pageerror', lambda e: errors.append(str(e)))
 page.route('**/src/game.js*', lambda r: r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')

 # Close E → J confirms during recovery and grants the resource reward exactly once.
 page.evaluate('build27.setup();build27.p.x=build27.b.x-32;build27.p.sp=40')
 page.keyboard.press('e')
 page.wait_for_function('build27.b.psiCompression>0 && build27.p.attack>0')
 before=page.evaluate('({sp:build27.p.sp,meter:build27.p.superMeter})')
 page.keyboard.press('j')
 page.wait_for_function('build27.b.psiCompression===0')
 after=page.evaluate('({sp:build27.p.sp,meter:build27.p.superMeter})')
 assert after['sp']>=before['sp']+12 and after['meter']>=before['meter']+10
 page.screenshot(path='/tmp/eden27-reclaim.png')

 # A real K parry earns one free directional step.
 page.evaluate("build27.setup();build27.p.x=build27.b.x-45;build27.p.sp=30;build27.b.move=0;build27.b.dir=-1;build27.b.act()")
 page.wait_for_function('build27.slashes.some(s=>s.kind==="scalpel"&&s.delay<=.05)')
 page.keyboard.press('k')
 page.wait_for_function('build27.p.parryFollow>0')
 sp=page.evaluate('build27.p.sp')
 page.keyboard.down('a');page.keyboard.press('Shift');page.keyboard.up('a')
 page.wait_for_function('build27.p.dash>0')
 assert page.evaluate('build27.p.dashDir')==-1
 assert page.evaluate('build27.p.sp')>=sp
 assert page.evaluate('build27.p.parryFollow')==0

 # The fixed needle marks a locked location; moving leaves it standing behind.
 page.evaluate('build27.setup();build27.p.x=180;build27.b.patternCount=3;build27.b.t=0')
 page.wait_for_function('build27.b.move===6 && build27.b.windup>.5')
 locked=page.evaluate('build27.b.target.x')
 page.screenshot(path='/tmp/eden27-field-warning.png')
 page.keyboard.down('a')
 page.wait_for_function('build27.hazards.some(h=>h.sterileField && h.delay<=0)')
 page.keyboard.up('a')
 assert page.evaluate('build27.hazards.find(h=>h.sterileField).x')==locked
 assert page.evaluate('build27.p.hp')==100
 page.wait_for_timeout(160)
 page.screenshot(path='/tmp/eden27-field-active.png')

 # High needle passes over the grounded player; jump the following low needle.
 page.evaluate('build27.setup();build27.p.x=120;build27.b.patternCount=1;build27.b.t=0')
 page.wait_for_function('build27.b.move===5 && build27.b.windup>.5')
 page.screenshot(path='/tmp/eden27-dissection-warning.png')
 page.wait_for_function('build27.hazards.some(h=>h.dissection && h.y===212 && h.delay<=0 && Math.abs(h.x-(build27.p.x+9))<55)')
 assert page.evaluate('build27.p.hp')==100
 page.keyboard.press('Space')
 page.wait_for_function('!build27.hazards.some(h=>h.dissection)',timeout=5000)
 assert page.evaluate('build27.p.hp')==100
 assert not errors,errors
 print('PASS: real-key E→J, K→Shift, fixed field dodge and high/low jump; no JS errors')
 browser.close()
