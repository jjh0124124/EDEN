"""First-boss ultimate: actual keyboard evasion and final parry in the shipped renderer."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
source=(Path(__file__).resolve().parents[1]/'src/game.js').read_text()
source=source.replace('})();','''window.protocolTest={get player(){return player},get boss(){return boss},
setup(final=false){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.phase=2;player.x=final?boss.x-45:230;player.face=1;if(final){boss.protocolUsed=true;boss.beginProtocolCast(2);}},};})();''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(os.environ.get('EDEN_BASE_URL','http://127.0.0.1:4173/'),wait_until='networkidle')
    page.wait_for_function('EdenPresentation.assetStatus.surgeonDuel && EdenPresentation.assetStatus.surgeonLow')
    page.evaluate('protocolTest.setup()')
    page.wait_for_function('protocolTest.boss.protocol?.wave===0')
    held=None;seen=set()
    for _ in range(100):
        state=page.evaluate('''()=>({wave:protocolTest.boss.protocol?.wave??-1,target:protocolTest.boss.target?.x,x:protocolTest.player.x,windup:protocolTest.boss.windup,ground:protocolTest.player.onGround})''')
        wave=state['wave']
        if wave<0:break
        seen.add(wave);wanted=None
        if wave<2 and abs(state['x']+9-state['target'])<125:wanted='d' if state['target']<240 else 'a'
        if wanted!=held:
            if held:page.keyboard.up(held)
            if wanted:page.keyboard.down(wanted)
            held=wanted
        if wave==2 and state['windup']<.2 and state['ground']:page.keyboard.press('Space',delay=20)
        page.wait_for_timeout(70)
    if held:page.keyboard.up(held)
    page.wait_for_timeout(450)
    assert seen=={0,1,2},seen
    assert page.evaluate('protocolTest.player.hp')==100
    assert page.evaluate('protocolTest.boss.protocolUsed')
    page.evaluate('protocolTest.setup(true)')
    page.screenshot(path='/tmp/eden-protocol-warning.png')
    page.wait_for_function('protocolTest.boss.release>0')
    page.wait_for_timeout(55)
    page.keyboard.down('k')
    page.wait_for_function('protocolTest.player.parryFollow>0')
    assert page.evaluate('protocolTest.boss.recovery')>1.9
    page.keyboard.press('j',delay=20)
    page.keyboard.up('k')
    page.wait_for_function('protocolTest.boss.hp<protocolTest.boss.maxHp')
    page.screenshot(path='/tmp/eden-protocol-counter.png')
    assert not errors,errors
    print('PASS: two targeted waves → final cut avoided without parry; final K parry → J counter; no browser errors')
    browser.close()
