import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.psiTest={get state(){return state},get p(){return player},get b(){return boss},setup(x=270){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=300;boss.inv=0;boss.t=999;player.x=x;},guard(){this.setup();boss.psiGuard=.65;boss.dir=-1;},strike(){player.x=boss.x-50;boss.dir=-1;boss.move=0;boss.act();}};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4174')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('psiTest.setup()');page.keyboard.press('j');page.wait_for_function('psiTest.p.linkWindow>0');page.keyboard.press('q');page.wait_for_function('psiTest.p.weaponMode==="psiRise"');page.screenshot(path='/tmp/eden21-uppercut.png')
 page.wait_for_function('psiTest.p.onGround&&psiTest.p.attack<=0')
 page.evaluate('psiTest.guard()');page.keyboard.press('j');page.wait_for_function('psiTest.p.attack<=0&&psiTest.p.attackSerial>0');assert page.evaluate('psiTest.b.hp===psiTest.b.maxHp&&psiTest.p.linkWindow===0')
 page.evaluate('psiTest.guard()');page.keyboard.press('e');page.wait_for_function('psiTest.b.psiGrabLock>0');page.keyboard.press('w');page.wait_for_function('psiTest.p.weaponMode==="psiPalm"');page.wait_for_function('psiTest.b.hp<psiTest.b.maxHp-35');page.screenshot(path='/tmp/eden21-clinch-palm.png')
 page.evaluate('psiTest.setup();psiTest.p.superMeter=100');page.keyboard.press('r');page.wait_for_function('psiTest.p.ultimateT>0');page.screenshot(path='/tmp/eden21-super.png');page.wait_for_function('psiTest.p.ultimateT===0&&psiTest.p.attack<=0')
 page.evaluate('psiTest.setup(100)');page.keyboard.down('a');page.wait_for_function('psiTest.p.face===-1');page.keyboard.up('a');page.keyboard.press('Shift');page.wait_for_function('psiTest.p.x<70');assert page.evaluate('psiTest.b.hp===psiTest.b.maxHp')
 page.evaluate('psiTest.setup(250)')
 for _ in range(7):
  page.wait_for_function('psiTest.p.inv<=0');hp=page.evaluate('psiTest.p.hp');page.evaluate('psiTest.strike()');page.wait_for_function(f'psiTest.p.hp<{hp}')
 page.wait_for_function('psiTest.state==="gameover"');page.keyboard.press('Enter');page.wait_for_function('psiTest.state==="intro"');page.keyboard.press('Enter');page.wait_for_function('psiTest.state==="combat"');page.keyboard.press('j');page.wait_for_function('psiTest.p.weaponMode==="psiJab"')
 assert not errors,errors
 print('PASS: generated psychic art loaded; keyboard J→Q, guard rejects J, E breaks guard→W, confirmed R, directional non-attacking Shift; death/retry; no JS errors')
 b.close()
