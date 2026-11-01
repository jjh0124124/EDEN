"""Keyboard-facing, aerial confirm, recoil re-entry and locked pursuit regression."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.mobilityTest={get p(){return player},get b(){return boss},setup(x=260){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;boss.x=300;player.x=x;player.face=1;},pursuit(){this.setup(65);boss.lastPattern=2;boss.t=0;}};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('mobilityTest.setup(200)');page.keyboard.down('a');page.wait_for_function('mobilityTest.p.face===-1');page.keyboard.up('a')
 page.keyboard.down('d');page.wait_for_function('mobilityTest.p.face===1');page.keyboard.up('d')
 page.evaluate('mobilityTest.setup()');page.keyboard.press('q');page.wait_for_function('mobilityTest.p.linkWindow>0');page.keyboard.press('j')
 page.wait_for_function('mobilityTest.p.weaponMode==="dive"');page.screenshot(path='/tmp/eden20-dive.png')
 page.wait_for_function('mobilityTest.p.reverseDrive===1');assert page.evaluate('mobilityTest.b.hp<mobilityTest.b.maxHp-24')
 page.keyboard.press('Shift');page.wait_for_function('mobilityTest.p.weaponMode==="drive"');page.wait_for_function('mobilityTest.p.onGround&&mobilityTest.p.attack<=0')
 page.evaluate('mobilityTest.setup(245)');page.keyboard.press('w');page.wait_for_function('mobilityTest.p.reverseDrive===1');page.keyboard.press('Shift');page.wait_for_function('mobilityTest.p.weaponMode==="drive"')
 page.evaluate('mobilityTest.pursuit()');page.wait_for_function('!!mobilityTest.b.approach');destination=page.evaluate('mobilityTest.b.approach.to')
 page.keyboard.down('d');page.wait_for_function('mobilityTest.b.windup<.38');page.keyboard.up('d');page.keyboard.press('Space')
 page.wait_for_function('mobilityTest.b.recovery>0');page.screenshot(path='/tmp/eden20-pursuit.png')
 assert abs(page.evaluate('mobilityTest.b.x')-destination)<1
 page.wait_for_function('mobilityTest.p.onGround');assert page.evaluate('mobilityTest.p.hp')==100
 assert not errors,errors
 print('PASS: keyboard turning; Q→air J→boost; W→Shift; locked pursuit jumped safely; all assets loaded, no JS errors')
 b.close()
