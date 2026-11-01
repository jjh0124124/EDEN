"""Real-keyboard test of SURGEON's relay objective and extraction wave."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.operationTest={get p(){return player},get b(){return boss},get slashes(){return slashes},get hazards(){return hazards},get state(){return state},setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=365;boss.inv=0;boss.hp=560;boss.t=0;player.x=65;player.face=1;}};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function("document.querySelector('#boot').classList.contains('ready')")
 page.evaluate('operationTest.setup()');page.wait_for_function('operationTest.b.operation!==undefined && operationTest.b.operation!==null')
 page.screenshot(path='/tmp/eden25-operation.png')
 page.evaluate('operationTest.p.superMeter=100');page.keyboard.press('r');page.wait_for_timeout(100)
 assert page.evaluate('operationTest.p.superMeter===100 && operationTest.p.attack<=0')
 for index in [0,1]:
  if index:
   page.keyboard.down('d');page.wait_for_function('operationTest.p.x>=operationTest.b.operation.nodes[1].x-34');page.keyboard.up('d')
  while page.evaluate(f'operationTest.b.operation && operationTest.b.operation.nodes[{index}].hp>0'):
   page.wait_for_function('operationTest.p.attack<=0');page.keyboard.press('j');page.wait_for_timeout(130)
 page.wait_for_function('operationTest.b.operation===null && operationTest.b.recovery>1')
 assert page.evaluate('operationTest.p.hp')==100
 page.evaluate('operationTest.setup()');page.wait_for_function('!!operationTest.b.operation')
 for _ in range(3):
  page.wait_for_function('operationTest.p.attack<=0');page.keyboard.press('j');page.wait_for_timeout(130)
 page.wait_for_function('operationTest.b.operation.nodes[0].hp<=0')
 page.keyboard.down('d');page.wait_for_function('operationTest.p.x>=operationTest.b.operation.nodes[0].x+8');page.keyboard.up('d')
 page.evaluate('operationTest.b.operation.time=.8');page.screenshot(path='/tmp/eden25-operation-safe.png')
 page.wait_for_function('operationTest.b.operation===null');page.wait_for_timeout(400)
 assert page.evaluate('operationTest.p.hp')==100
 page.evaluate('operationTest.setup()');page.wait_for_function('!!operationTest.b.operation');page.evaluate('operationTest.b.operation.time=.25')
 page.keyboard.press('Space');page.wait_for_function('operationTest.slashes.some(s=>s.kind==="operationWave" && s.delay<=0)');page.screenshot(path='/tmp/eden25-operation-wave.png');page.wait_for_timeout(350)
 assert page.evaluate('operationTest.p.hp')==100
 page.evaluate('''operationTest.setup();operationTest.b.hp=760;operationTest.b.phase=2;operationTest.b.protocolUsed=true;operationTest.b.operationUsed=true;operationTest.b.x=330;operationTest.b.move=0;operationTest.b.dir=-1;operationTest.b.windup=.1;operationTest.p.x=120''')
 page.wait_for_function('operationTest.b.followup && operationTest.b.followup.x!==null');locked=page.evaluate('operationTest.b.followup.x')
 page.keyboard.down('d');page.wait_for_function('operationTest.hazards.some(h=>h.kind==="syringe" && h.y>200)');page.keyboard.up('d')
 assert page.evaluate('operationTest.p.hp')==100
 assert page.evaluate('operationTest.hazards.find(h=>h.kind==="syringe").x')==locked
 assert not errors,errors
 print('PASS: keyboard destroys both relays; safe zone; jump over full wave; phase-two follow-up dodge; no JS errors')
 browser.close()
