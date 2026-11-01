"""Exercise the new SURGEON patterns with real keyboard input and rendering."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.patternTest={get p(){return player},get b(){return boss},get hazards(){return hazards},lance(side){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.x=side<0?330:100;player.x=side<0?130:300;player.face=-side;boss.t=0;boss.lanceCasts=1;boss.lastPattern=0;},cross(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.x=330;player.x=205;boss.t=0;boss.loomCasts=2;}};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 for side,response in [(-1,'parry'),(1,'jump')]:
  page.evaluate(f'patternTest.lance({side})');page.wait_for_function('patternTest.b.move===3&&patternTest.b.windup>.4')
  if side==-1:page.screenshot(path='/tmp/eden26-lance-warning.png')
  if side==-1:page.wait_for_function('patternTest.hazards.some(h=>h.heavyLance&&h.delay<=0&&Math.abs(h.x-(patternTest.p.x+9))<115)');page.screenshot(path='/tmp/eden26-lance-flight.png')
  distance=35 if response=='parry' else 75
  page.wait_for_function(f'patternTest.hazards.some(h=>h.heavyLance&&h.delay<=0&&Math.abs(h.x-(patternTest.p.x+9))<{distance})')
  page.keyboard.press('k' if response=='parry' else 'Space')
  page.wait_for_function('!patternTest.hazards.some(h=>h.heavyLance)',timeout=8000)
  assert page.evaluate('patternTest.p.hp')==100
  if response=='parry':assert page.evaluate('patternTest.p.superMeter')>=14
 page.evaluate('patternTest.cross()');page.wait_for_function('patternTest.b.move===4&&patternTest.b.windup>.4');page.screenshot(path='/tmp/eden26-cross-warning.png')
 target=page.evaluate('patternTest.b.target.x')
 page.wait_for_function(f'patternTest.hazards.filter(h=>h.crossStitch&&h.x!=={target}).length===2 && patternTest.hazards.filter(h=>h.crossStitch&&h.x!=={target}).every(h=>h.y>226)')
 page.keyboard.down('a');page.wait_for_function('!patternTest.hazards.some(h=>h.crossStitch)',timeout=8000);page.keyboard.up('a')
 assert page.evaluate('patternTest.p.hp')==100
 assert not errors,errors
 print('PASS: lance warning and keyboard parry/jump; cross-stitch warning and moving after side drops; no JS errors')
 browser.close()
