"""Exercise SURGEON's core and skill interactions using browser keyboard input."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
source = (root / 'src/game.js').read_text().replace('})();', '''window.coreTest={
 get p(){return player}, get b(){return boss}, get hazards(){return hazards},
 setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=330;boss.inv=0;boss.t=.4;player.x=205;player.face=1;}
};})();''')
with sync_playwright() as p:
 browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
 page = browser.new_page(viewport={'width':1440,'height':1050})
 errors=[]
 page.on('pageerror', lambda e: errors.append(str(e)))
 page.route('**/src/game.js*', lambda r: r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('coreTest.setup()')
 page.wait_for_function('coreTest.b.counterCast && coreTest.b.windup>.3')
 page.wait_for_timeout(150)
 page.screenshot(path='/tmp/eden23-core-warning.png')
 page.wait_for_function('coreTest.hazards.some(h=>h.heavyCore&&h.delay<=0&&h.y>=110)')
 page.keyboard.press('q')
 page.wait_for_function('coreTest.p.hp<100')
 assert page.evaluate('coreTest.p.hp===86 && coreTest.b.hp===coreTest.b.maxHp && coreTest.hazards.every(h=>h.owner!=="p")')
 page.evaluate('coreTest.setup();coreTest.b.t=999;coreTest.p.x=coreTest.b.x-55')
 page.keyboard.press('e')
 page.wait_for_function('coreTest.b.psiCompression>0')
 page.keyboard.press('w')
 page.wait_for_function('coreTest.b.psiCompression===0 && coreTest.b.hp<coreTest.b.maxHp-50')
 page.evaluate('coreTest.setup();coreTest.b.t=999;coreTest.p.x=coreTest.b.x-55')
 page.keyboard.press('e')
 page.wait_for_function('coreTest.b.psiCompression>0')
 boss_x = page.evaluate('coreTest.b.x')
 page.keyboard.press('q')
 page.wait_for_function(f'coreTest.b.x>{boss_x+25}')
 assert page.evaluate('coreTest.b.y===126 && coreTest.b.psiCompression===0')
 page.screenshot(path='/tmp/eden23-repulse.png')
 page.evaluate('coreTest.setup()')
 page.wait_for_function('coreTest.b.counterCast && coreTest.b.windup>.3')
 locked = page.evaluate('coreTest.b.target.x')
 page.keyboard.down('a')
 page.wait_for_function('coreTest.hazards.some(h=>h.heavyCore&&h.y>215)')
 page.keyboard.up('a')
 assert page.evaluate('coreTest.b.target.x') == locked
 assert page.evaluate('coreTest.p.hp') == 100
 page.evaluate('coreTest.setup();coreTest.p.x=coreTest.b.x-45;coreTest.b.t=999;coreTest.b.psiGuard=.15;coreTest.b.dir=-1')
 page.wait_for_function('coreTest.b.windup>0 && coreTest.b.windup<.38')
 page.screenshot(path='/tmp/eden24-guard-counter.png')
 page.keyboard.press('Space')
 page.wait_for_function('coreTest.b.release>0')
 page.wait_for_timeout(350)
 assert page.evaluate('coreTest.p.hp') == 100
 assert not errors, errors
 print('PASS: rendered core warning; Q does not parry; E→W and E→Q; core dodge; guard counter jump; no JS errors')
 browser.close()
