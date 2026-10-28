"""Browser regression for Korean physical keys and on-screen pointer controls."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.inputTest={
 get x(){return player.x},get state(){return state},get dialogue(){return dialogue},get paused(){return paused},get keys(){return [...keys]}
};})();''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'],headless=True)
    page=browser.new_page(viewport={'width':1280,'height':1000},has_touch=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    for _ in range(5):
        page.locator('#advance').click()
        page.wait_for_timeout(80)
    assert page.evaluate('inputTest.state')=='explore'
    assert page.evaluate('inputTest.dialogue') is None
    x=page.evaluate('inputTest.x')
    page.evaluate("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',key:'ㅇ',isComposing:true,bubbles:true}))")
    page.wait_for_timeout(400)
    assert page.evaluate('inputTest.x')>x+20
    page.evaluate("dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD',key:'D',bubbles:true}))")
    assert 'd' not in page.evaluate('inputTest.keys')
    page.wait_for_timeout(250)
    button=page.locator('[data-key="a"]')
    box=button.bounding_box()
    x=page.evaluate('inputTest.x')
    page.mouse.move(box['x']+10,box['y']+10)
    page.mouse.down()
    page.wait_for_timeout(350)
    assert page.evaluate('inputTest.x')<x-15
    page.mouse.move(box['x']+180,box['y']-40)
    page.mouse.up()
    assert 'a' not in page.evaluate('inputTest.keys')
    # Actual touch pointer: hold right, release, then cancel a second gesture.
    client=page.context.new_cdp_session(page)
    box=page.locator('[data-key="d"]').bounding_box()
    x=page.evaluate('inputTest.x')
    point={'x':box['x']+10,'y':box['y']+10,'id':1}
    client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
    page.wait_for_timeout(350)
    assert page.evaluate('inputTest.x')>x+15
    client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert 'd' not in page.evaluate('inputTest.keys')
    client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
    client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
    assert 'd' not in page.evaluate('inputTest.keys')
    page.evaluate("dispatchEvent(new Event('blur'))")
    page.wait_for_timeout(80)
    assert page.locator('#advance').inner_text()=='계속하기'
    page.locator('#advance').click()
    page.wait_for_timeout(80)
    assert page.evaluate('inputTest.paused') is False
    page.screenshot(path='/tmp/eden-input-fixed.png')
    assert not errors,errors
    print('PASS: clickable start/dialogue, Korean IME movement, mouse hold/release outside, touch hold/end/cancel, blur resume; no JS errors')
    browser.close()
