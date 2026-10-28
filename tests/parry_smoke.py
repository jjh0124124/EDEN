"""Focused first-boss parry checks with real keyboard input, using test-only arena setup."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
source=(Path(__file__).resolve().parents[1]/'src/game.js').read_text()
source=source.replace('})();','''window.parryTest={get player(){return player},get boss(){return boss},
setup(face=1){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;player.x=boss.x-45;player.face=face;},
cut(){boss.move=0;boss.dir=-1;boss.act();},};})();''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(os.environ.get('EDEN_BASE_URL','http://127.0.0.1:4173/'),wait_until='networkidle')
    page.wait_for_function('EdenPresentation.assetStatus.zeroDuel && EdenPresentation.assetStatus.surgeonLow')
    page.evaluate('parryTest.setup();parryTest.cut()')
    page.wait_for_timeout(65)
    page.keyboard.down('k')
    page.wait_for_function('parryTest.player.parryFollow>0')
    assert page.evaluate('parryTest.player.hp')==100
    page.keyboard.press('j',delay=25)
    page.wait_for_function('parryTest.player.attack>0 && parryTest.player.weaponMode==="kick"')
    page.keyboard.up('k')
    page.wait_for_function('parryTest.boss.hp<parryTest.boss.maxHp')
    page.evaluate('parryTest.setup(-1);parryTest.cut()')
    page.wait_for_timeout(65);page.keyboard.down('k')
    page.wait_for_function('parryTest.player.hp<100')
    assert page.evaluate('parryTest.player.parryFollow')==0
    page.keyboard.up('k')
    assert not errors,errors
    print('PASS: frontal K parry → J counter; rear attack damages player; real keyboard input and sprite renderer; no JS errors')
    browser.close()
