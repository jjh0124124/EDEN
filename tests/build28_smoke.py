"""Use real keyboard input to cross and re-enter SURGEON's persistent field."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
source = (root / 'src/game.js').read_text().replace('})();', '''window.build28={
 get p(){return player},get b(){return boss},get hazards(){return hazards},
 setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=330;boss.inv=0;boss.patternCount=3;boss.t=0;player.x=180;player.face=1;player.sp=50;}
};})();''')

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('build28.setup()')
 page.wait_for_function('build28.b.move===6 && build28.b.windup>0 && build28.b.windup<.3')
 page.keyboard.down('a')
 page.wait_for_function('build28.hazards.some(h=>h.sterileField && h.delay<=0)')
 page.keyboard.up('a')
 page.evaluate('build28.b.t=999')
 field_x=page.evaluate('build28.hazards.find(h=>h.sterileField).x')
 page.keyboard.down('d');page.keyboard.press('Shift')
 page.wait_for_function(f'build28.p.x>{field_x+12} && build28.p.dash<=0')
 page.keyboard.up('d')
 assert page.evaluate('build28.p.hp')==100
 assert page.evaluate('build28.hazards.some(h=>h.sterileField && h.evadeRewarded)')
 page.screenshot(path='/tmp/eden28-field-after-evade.png')
 page.keyboard.down('a')
 page.wait_for_function('build28.p.hp<100',timeout=2500)
 page.keyboard.up('a')
 assert page.evaluate('build28.p.hp')==84
 assert page.evaluate('build28.hazards.some(h=>h.sterileField)')
 page.wait_for_function('!build28.hazards.some(h=>h.sterileField)',timeout=3000)
 assert not errors,errors
 print('PASS: keyboard dash crosses without damage; field persists, hurts on return, then expires; no JS errors')
 browser.close()
