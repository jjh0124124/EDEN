"""Real browser charge input and first-boss presentation checks; HTTP server on 4173."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
source = (root / 'src/game.js').read_text()
driver = '''window.combatTest={
 get player(){return player},get slashes(){return slashes},get boss(){return boss},get state(){return state},
 arena(){dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;player.x=190;},
 warning(){boss.t=0;boss.move=0;},
};'''
source = source.replace('})();', driver+'\n})();')
source = source.replace('update(dt);render();', 'if(!window.edenFreeze)update(dt);render();')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':960}, has_touch=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    page.evaluate('combatTest.arena();combatTest.player.x=combatTest.boss.x-35')
    page.keyboard.press('j')
    for stage in [1,2]:
        page.wait_for_function('(stage)=>combatTest.player.combo===stage && combatTest.player.attack<.14',arg=stage)
        page.keyboard.press('j')
        page.wait_for_function('(stage)=>combatTest.player.combo===stage+1',arg=stage)
    page.wait_for_function('combatTest.boss.hp<=combatTest.boss.maxHp-51')
    page.evaluate('window.edenFreeze=true')
    page.screenshot(path='/tmp/eden-combo.png')
    page.evaluate('window.edenFreeze=false')
    page.evaluate('combatTest.arena()')
    page.keyboard.down('k')
    page.wait_for_function('combatTest.player.chargeLevel===2')
    assert page.evaluate('combatTest.slashes.length') == 0
    page.screenshot(path='/tmp/eden-charge.png')
    page.keyboard.up('k')
    page.wait_for_function('combatTest.player.attack>0')
    assert page.evaluate('combatTest.player.charging') is False
    page.wait_for_timeout(600)
    # Mouse hold and release, including capture outside the button.
    button=page.locator('[data-key="k"]')
    box=button.bounding_box()
    page.mouse.move(box['x']+box['width']/2,box['y']+10)
    page.mouse.down()
    page.wait_for_function('combatTest.player.chargeLevel===2 && combatTest.player.charging')
    page.mouse.move(5,5)
    page.mouse.up()
    page.wait_for_function('!combatTest.player.charging && combatTest.player.attack>0')
    page.wait_for_timeout(600)
    # Native touch cancellation must not release a charged attack.
    box=button.bounding_box()
    cdp=page.context.new_cdp_session(page)
    point={'x':box['x']+box['width']/2,'y':box['y']+10}
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
    page.wait_for_function('combatTest.player.charging && combatTest.player.charge>.4')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
    page.wait_for_timeout(100)
    assert page.evaluate('combatTest.player.charging') is False
    assert page.evaluate('combatTest.player.attack') == 0
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
    page.wait_for_function('combatTest.player.charging && combatTest.player.charge>.4')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.wait_for_function('combatTest.player.attack>0')
    page.wait_for_timeout(600)
    page.evaluate('combatTest.arena();combatTest.warning()')
    page.wait_for_function('combatTest.boss.windup>.5')
    page.evaluate('window.edenFreeze=true')
    page.screenshot(path='/tmp/eden-surgeon-warning.png')
    # Capture distinct effects through the real renderer, without shipping a debug menu.
    for key,name,delay in [('q','triple',130),('w','rail',480),('e','pile',410),('r','crown',430)]:
        page.evaluate('window.edenFreeze=false;combatTest.arena()')
        page.keyboard.press(key)
        page.wait_for_timeout(delay)
        page.evaluate('window.edenFreeze=true')
        page.wait_for_timeout(40)
        page.screenshot(path=f'/tmp/eden-effect-{name}.png')
    page.evaluate('window.edenFreeze=false;combatTest.arena()')
    for _ in range(5):
        page.keyboard.press('j')
        page.wait_for_timeout(25)
    assert page.evaluate('combatTest.player.combo') <= 2
    for x,face,outward,inward in [(8,-1,'a','d'),(453,1,'d','a')]:
        page.evaluate('([x,face])=>{combatTest.arena();combatTest.player.x=x;combatTest.player.face=face}',[x,face])
        page.keyboard.down(outward)
        page.keyboard.press('Shift')
        page.wait_for_timeout(360)
        page.keyboard.up(outward)
        assert 8 <= page.evaluate('combatTest.player.x') <= 453
        page.keyboard.down(inward)
        page.wait_for_timeout(300)
        page.keyboard.up(inward)
        assert abs(page.evaluate('combatTest.player.x')-x)>15
    page.evaluate('combatTest.arena()')
    page.keyboard.press('Space')
    page.keyboard.down('d')
    page.keyboard.press('j')
    page.wait_for_timeout(100)
    assert page.evaluate('!combatTest.player.onGround && combatTest.player.attack>0')
    page.keyboard.up('d')
    page.wait_for_function('combatTest.player.onGround')
    page.evaluate('combatTest.arena()')
    page.keyboard.press('j')
    page.wait_for_timeout(50)
    page.evaluate('combatTest.player.damage(10,-1);combatTest.player.damage(10,-1)')
    assert page.evaluate('combatTest.player.hp') == 90
    page.screenshot(path='/tmp/eden-player-hit.png')
    page.wait_for_timeout(700)
    page.evaluate('combatTest.arena()')
    page.keyboard.press('j')
    page.wait_for_timeout(40)
    page.keyboard.press('Shift')
    page.wait_for_timeout(40)
    assert page.evaluate('combatTest.player.dash>0 && combatTest.player.attack>0')
    page.evaluate('combatTest.boss.windup=.2;combatTest.boss.hurt(9999)')
    page.wait_for_function('combatTest.state==="reward"')
    page.evaluate('combatTest.arena();combatTest.player.damage(999,1)')
    page.wait_for_function('combatTest.state==="gameover"')
    page.keyboard.press('Enter')
    page.wait_for_function('combatTest.state==="intro"')
    assert page.evaluate('combatTest.player.hp===combatTest.player.maxHp')
    assert not errors,errors
    print('PASS: combos, repeated input, both walls, air control/attack, damage immunity, dash/attack, enemy death during windup, restart, keyboard/mouse/touch charge, four skill renders; no JS errors')
    browser.close()
