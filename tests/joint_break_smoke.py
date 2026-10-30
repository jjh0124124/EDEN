"""Real keyboard retreat interception / joint break / recoil-shot confirm."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.jointTest={get p(){return player},get b(){return boss},
setup(retreat=true){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;boss.x=300;player.x=255;player.face=1;if(retreat){boss.pressure=50;}},
};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('jointTest.setup()');page.wait_for_function('!!jointTest.b.retreat')
 page.keyboard.press('e');page.wait_for_function('jointTest.b.anchorTime>0&&jointTest.p.linkWindow>0')
 meter=page.evaluate('jointTest.p.superMeter');page.keyboard.press('q')
 page.wait_for_function('jointTest.b.breakLock>0');assert page.evaluate('jointTest.b.anchorTime')==0
 assert page.evaluate('jointTest.p.superMeter')>meter+10
 assert page.evaluate('jointTest.p.hp')==100
 page.screenshot(path='/tmp/eden-joint-break.png')
 page.wait_for_function('jointTest.p.onGround&&jointTest.p.attack<=0')
 page.evaluate('jointTest.setup(false)');page.keyboard.press('w')
 page.wait_for_function('jointTest.p.linkWindow>0&&jointTest.p.attack>0')
 page.keyboard.press('q');page.wait_for_function('jointTest.p.weaponMode==="riser"&&!jointTest.p.onGround')
 page.wait_for_function('jointTest.p.onGround');assert page.evaluate('jointTest.p.hp')==100
 assert not errors,errors
 print('PASS: real E catches retreat→Q joint break; W hit-confirm→Q; landing/control recovery; no JS errors')
 b.close()
