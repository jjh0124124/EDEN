"""Capture actual walk/punch/skill rendering and verify the first-boss-only flow."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.animTest={get p(){return player},get b(){return boss},get state(){return state},setup(x=245){releaseInputs();dialogue=null;startBoss();state='combat';boss.x=300;boss.inv=0;boss.t=999;player.x=x;},get frames(){return particles.filter(p=>p.sprite).map(p=>p.sprite)}};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4175')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('''animTest.setup(80);window.walkFrames=new Set();const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...a){if(im.src?.includes('zero-walk-v25')&&animTest.p.attack<=0&&Math.abs(animTest.p.vx)>25)walkFrames.add(a[0]+','+a[1]);return draw.call(this,im,...a)};void 0;''')
 page.keyboard.down('d');page.wait_for_function('walkFrames.size===8');page.keyboard.up('d')
 page.evaluate('animTest.setup(80)')
 for hand in [0,1]:
  page.keyboard.press('j');page.wait_for_function(f'animTest.p.attack>0&&animTest.p.psiHand==={hand}');page.wait_for_function('animTest.p.attack<.15&&animTest.p.attack>.07');page.screenshot(path=f'/tmp/eden22-j{hand+1}.png');page.wait_for_function('animTest.p.attack<=0')
 page.evaluate('animTest.setup();animTest.b.recovery=1')
 page.keyboard.press('q');page.wait_for_function('animTest.b.psiStagger>0');assert page.evaluate('animTest.b.y')==126;page.screenshot(path='/tmp/eden22-q.png')
 page.evaluate('animTest.setup();animTest.b.psiGuard=.8;animTest.b.dir=-1');page.keyboard.press('e');page.wait_for_function('animTest.b.psiCompression>0');page.screenshot(path='/tmp/eden22-e.png');page.keyboard.press('w');page.wait_for_function('animTest.b.psiCompression===0&&animTest.b.hp<700');page.screenshot(path='/tmp/eden22-ew.png')
 page.evaluate('animTest.setup();animTest.p.superMeter=100');page.keyboard.press('r');page.wait_for_function('animTest.p.ultimateT>0')
 page.wait_for_function('animTest.p.ultimateT<1.15');page.screenshot(path='/tmp/eden22-r-charge.png')
 page.wait_for_function('animTest.p.ultimateT<.25&&animTest.p.ultimateT>0');page.screenshot(path='/tmp/eden22-r-final.png')
 page.wait_for_function('animTest.p.ultimateT===0');assert page.evaluate('animTest.b.hp<650')
 # Legacy completed saves beyond the first encounter cannot enter removed content.
 page.unroute('**/src/game.js*');page.evaluate('localStorage.setItem("eden-save-v1",JSON.stringify({boss:5,stage:"boss",upgrade:12}))');page.reload(wait_until='networkidle');page.keyboard.press('Enter');page.wait_for_timeout(300);assert not errors,errors
 print('PASS: all 8 walk frames rendered; alternating hands; grounded Q stagger; E→W rupture; dedicated R charge/final; obsolete save loads without errors')
 b.close()
