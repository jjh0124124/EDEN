"""Optional visual smoke test; requires Playwright and Chromium, not game dependencies."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, Error

root = Path(__file__).resolve().parents[1]
source = (root / 'src/game.js').read_text()
# Test driver exists only in intercepted test responses, never in shipped game code.
driver = '''window.edenTest = {
  get state(){return state}, get player(){return player}, get boss(){return boss},
  get dialogue(){return dialogue},get room(){return room},get paused(){return paused},
  arena(i){dialogue=null;startBoss(i);state='combat';boss.inv=0;player.inv=99;},
  phase(){boss.hp=boss.maxHp*.49;boss.inv=0;boss.hurt(1);},
  finish(){boss.inv=0;boss.hurt(9999);},
};'''
source = source.replace('})();', driver + '\n})();')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width':1280,'height':800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/src/game.js', lambda route: route.fulfill(body=source, content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/', wait_until='networkidle')
    page.screenshot(path='/tmp/eden-title-v2.png')
    def press(key):
        page.keyboard.press(key, delay=35)
        page.wait_for_timeout(70)
    press('Enter')
    page.wait_for_function('edenTest.state === "interlude"')
    press('Enter')
    assert page.evaluate('edenTest.state') == 'explore'
    for _ in range(3): press('Enter')
    assert page.evaluate('edenTest.dialogue') is None
    x = page.evaluate('edenTest.player.x')
    page.keyboard.down('d')
    page.wait_for_timeout(350)
    page.keyboard.up('d')
    assert page.evaluate('edenTest.player.x') > x + 15
    press('Space')
    assert page.evaluate('edenTest.player.onGround') is False
    press('Escape')
    assert page.evaluate('edenTest.paused') is True
    press('Escape')
    page.screenshot(path='/tmp/eden-explore-v2.png')
    page.evaluate('edenTest.arena(0);edenTest.finish()')
    page.wait_for_function('edenTest.state === "reward"')
    assert page.evaluate('edenTest.state') == 'reward'
    page.reload(wait_until='networkidle')
    press('Enter')
    assert page.evaluate('edenTest.state') == 'reward'
    press('d')
    page.screenshot(path='/tmp/eden-reforge.png')
    # Use actual touchscreen input at the third card, then the existing advance button.
    box = page.locator('#game').bounding_box()
    cdp = page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':box['x']+390*box['width']/480,'y':box['y']+150*box['height']/270}]})
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    page.locator('#advance').click()
    page.wait_for_timeout(100)
    assert page.evaluate('edenTest.state') == 'interlude'
    assert page.evaluate('JSON.parse(localStorage.getItem("eden-save-v1")).augments[2]') == 1
    press('Enter')
    assert page.evaluate('edenTest.player.maxHp') == 125
    for i in range(7):
        page.evaluate('(i)=>edenTest.arena(i)',i)
        page.wait_for_timeout(200)
        page.evaluate('edenTest.player.x=edenTest.boss.x-35; edenTest.player.face=1;')
        hp = page.evaluate('edenTest.boss.hp')
        press('k')
        page.wait_for_timeout(250)
        assert page.evaluate('edenTest.boss.hp') < hp
        press('q')
        page.wait_for_timeout(150)
        page.screenshot(path=f'/tmp/eden-boss-{i}-v2.png')
        page.evaluate('edenTest.phase()')
        page.wait_for_timeout(1800)
        assert page.evaluate('edenTest.boss.phase') == 2
    page.evaluate('edenTest.finish()')
    page.wait_for_function('edenTest.state === "ending"')
    assert page.evaluate('edenTest.state') == 'ending'
    page.reload(wait_until='networkidle')
    press('Enter')
    assert page.evaluate('edenTest.state') == 'ending'
    try:
        page.goto((root / 'index.html').as_uri(), wait_until='load')
        page.wait_for_timeout(200)
        assert page.locator('#boot.ready').count() == 1
        print('PASS: direct file launch')
    except Error as exc:
        if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(exc):
            raise
        print('SKIP: direct file launch blocked by managed browser policy; HTTP launch was tested')
    assert not errors, errors
    print('PASS: title, dialogue, movement, jump, pause, 7 boss renders and heavy hits, 7 phase transitions, ending persistence; no JS errors')
    browser.close()
