"""Optional browser check: npm run dev, then python3 tests/local_start_smoke.py."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
# Observe state only. All transitions and actions use real UI/keyboard input.
source = (root / 'src/game.js').read_text().replace('})();', '''
window.localSmoke = {
 get state(){return state}, get player(){return player},
 get dialogue(){return dialogue}, get paused(){return paused},
};
})();''')
with sync_playwright() as p:
    options = {'headless': True}
    if os.environ.get('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width':1280,'height':960})
    errors, failed = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failed.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.route('**/src/game.js', lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(os.environ.get('EDEN_BASE_URL', 'http://127.0.0.1:4173/'), wait_until='networkidle')
    page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
    assert page.evaluate('localSmoke.state') == 'title'
    page.locator('#advance').click()
    page.wait_for_function('localSmoke.state === "interlude"')
    page.locator('#advance').click()
    page.wait_for_function('localSmoke.state === "explore"')
    for _ in range(3):
        page.locator('#advance').click()
        page.wait_for_timeout(100)
    page.wait_for_function('localSmoke.dialogue === null')
    x = page.evaluate('localSmoke.player.x')
    page.keyboard.down('d')
    page.wait_for_timeout(350)
    page.keyboard.up('d')
    assert page.evaluate('localSmoke.player.x') > x + 15
    page.keyboard.press('Space', delay=35)
    page.wait_for_function('!localSmoke.player.onGround')
    page.wait_for_function('localSmoke.player.onGround')
    page.keyboard.press('j', delay=35)
    page.wait_for_function('localSmoke.player.attack > 0')
    page.wait_for_function('localSmoke.player.attack <= 0')
    page.keyboard.down('k')
    page.wait_for_function('localSmoke.player.chargeLevel === 2')
    page.keyboard.up('k')
    page.wait_for_function('localSmoke.player.attack > 0 && !localSmoke.player.charging')
    page.keyboard.press('Escape', delay=35)
    page.wait_for_function('localSmoke.paused')
    page.locator('#advance').click()
    page.wait_for_function('!localSmoke.paused')
    # Also exercise unmodified shipped scripts with the browser's persisted save.
    page.unroute('**/src/game.js')
    page.reload(wait_until='networkidle')
    page.locator('#boot.ready').wait_for(state='attached')
    page.locator('#advance').click()
    page.wait_for_function('document.querySelector("#control-status").textContent.includes("이동")')
    assert not errors, errors
    assert not failed, failed
    print('PASS: title → start → dialogue → gameplay; move/jump/J/K/pause/resume; all image assets; unmodified reload; no JS/HTTP errors')
    browser.close()
