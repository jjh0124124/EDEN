"""Exercise the three isolated concepts through real keyboard input and renderer."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
base=os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4173')
lab=(root/'experiments/combat-systems.js').read_text()+'''
window.labScenario={get p(){return player},get b(){return boss},setup(x=100){labRestart();boss.inv=0;boss.x=300;boss.t=999;player.x=x;},opening(){this.setup(260);boss.recovery=2;},strike(){player.x=boss.x-50;boss.dir=-1;boss.move=0;boss.act();}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/experiments/combat-systems.js',lambda r:r.fulfill(body=lab,content_type='application/javascript'))
 page.goto(base+'/');page.evaluate('localStorage.setItem("eden-save-v1",JSON.stringify({boss:3,stage:"boss"}))')
 for concept in ['pressure','thermal','clamp']:
  page.goto(base+'/experiments/combat-lab.html?concept='+concept,wait_until='networkidle')
  page.wait_for_function('window.edenLab&&Object.values(EdenPresentation.assetStatus).every(Boolean)')
  assert page.evaluate('edenLab.concept')==concept
  page.evaluate('labScenario.setup()')
  if concept=='pressure':
   page.keyboard.down('d');page.keyboard.press('Shift');page.wait_for_function('labScenario.p.lab.travel>=36');page.keyboard.press('e');page.keyboard.up('d')
   page.wait_for_function('labScenario.p.lab.pressure>0&&labScenario.p.attack<=0')
   page.keyboard.press('q');page.wait_for_function('!labScenario.p.onGround');assert page.evaluate('labScenario.p.lab.spent')==1
  elif concept=='thermal':
   for attack in range(5):
    page.keyboard.press('j');page.wait_for_function(f'labScenario.p.lab.branches.jab>={attack+1}');page.wait_for_function('labScenario.p.attack<=0')
   heat=page.evaluate('labScenario.p.lab.heat');assert heat>65
   page.keyboard.press('e');page.wait_for_function('labScenario.p.lab.vents===1');assert page.evaluate('labScenario.p.lab.heat')<heat-35
  else:
   for key in ['j','q','w']:
    page.evaluate('labScenario.opening()');page.keyboard.press('j');page.wait_for_function('labScenario.p.lab.grip>0');page.keyboard.press('e');page.wait_for_function('labScenario.p.lab.pin>0')
    meter=page.evaluate('labScenario.p.superMeter');hp=page.evaluate('labScenario.b.hp');page.keyboard.press(key)
    page.wait_for_function('labScenario.p.lab.pin===0')
    if key=='j':page.wait_for_function(f'labScenario.b.hp<{hp}')
    if key=='q':page.wait_for_function('labScenario.p.x>labScenario.b.x+labScenario.b.w')
    if key=='w':assert page.evaluate('labScenario.p.superMeter')>=meter+18
  page.screenshot(path=f'/tmp/eden-lab-{concept}.png')
  # Actual failure and retry flow; not an HP/stat shortcut.
  page.evaluate('labScenario.setup(250)')
  for _ in range(7):
   page.wait_for_function('labScenario.p.inv<=0');hp=page.evaluate('labScenario.p.hp');page.evaluate('labScenario.strike()');page.wait_for_function(f'labScenario.p.hp<{hp}')
  page.wait_for_function('edenLab.snapshot().state==="gameover"')
  page.keyboard.press('Enter');page.wait_for_function('edenLab.snapshot().state==="intro"');page.keyboard.press('Enter');page.wait_for_function('edenLab.snapshot().state==="combat"')
  assert page.evaluate('labScenario.p.lab.pressure===0&&labScenario.p.lab.heat===0&&labScenario.p.lab.pin===0')
  assert page.evaluate('JSON.parse(localStorage.getItem("eden-save-v1")).boss')==3
  print('PASS:',concept,'real keyboard branch / death-retry / original save intact')
 assert not errors,errors
 browser.close()
