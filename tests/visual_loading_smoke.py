"""Check slow/failed art loading and capture locomotion and ultimate in Chromium."""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.visualTest={get p(){return player},get b(){return boss},get state(){return state},setup(x=120){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=350;boss.inv=0;boss.t=999;player.x=x;},setupExplore(){releaseInputs();dialogue=null;startExplore();room.section=1;enterSection();player.x=180;player.face=1;player.superMeter=100;room.drones[1].hp=0;}};})();''')

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':1050});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  gate=asyncio.Event()
  async def hold(route):
   await gate.wait();await route.continue_()
  await page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  await page.route('**/zero-psychic.png',hold)
  await page.route('**/surgical-cathedral.png',hold)
  await page.route('**/eden-title-v30.png',hold)
  await page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='domcontentloaded')
  assert await page.locator('#advance').is_disabled()
  assert not await page.locator('#boot').evaluate("e=>e.classList.contains('ready')")
  assert not await page.evaluate('EdenPresentation.assetStatus.psychic || EdenPresentation.assetStatus.titleArt')
  await page.keyboard.press('Enter');gate.set()
  await page.wait_for_function("document.querySelector('#boot').classList.contains('ready')")
  assert await page.evaluate('visualTest.state')=='title'
  assert await page.evaluate('EdenPresentation.assetStatus.psychic && EdenPresentation.assetStatus.cathedral && EdenPresentation.assetStatus.titleArt')
  assert await page.locator('#advance').is_enabled()
  await page.evaluate('visualTest.setup()');await page.wait_for_timeout(100);await page.screenshot(path='/tmp/eden25-idle.png')
  await page.keyboard.down('d');await page.wait_for_function('visualTest.p.vx>80 && visualTest.p.stridePhase>2');await page.screenshot(path='/tmp/eden25-walk.png');await page.keyboard.up('d')
  await page.keyboard.press('Space');await page.wait_for_function('!visualTest.p.onGround && visualTest.p.vy < -70');await page.screenshot(path='/tmp/eden25-jump.png')
  await page.evaluate('visualTest.setup(310);visualTest.p.superMeter=100');await page.keyboard.press('r');await page.wait_for_function('visualTest.p.ultimateT>1.3');await page.wait_for_timeout(110);await page.screenshot(path='/tmp/eden25-super-cutin.png')
  await page.wait_for_function('visualTest.p.ultimateT<.3 && visualTest.p.ultimateT>0');await page.screenshot(path='/tmp/eden25-super-final.png')
  await page.evaluate('visualTest.setupExplore()');await page.keyboard.press('r');await page.wait_for_function('visualTest.p.ultimateT>1.3');await page.wait_for_timeout(110);await page.screenshot(path='/tmp/eden25-super-explore.png')
  assert not errors,errors
  for asset in ['eden-title-v30.png','zero-walk-v28.png','zero-jab-v29.png','psi-control-v29.png']:
   failed=await browser.new_page();await failed.route('**/'+asset,lambda route:route.abort())
   await failed.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='domcontentloaded')
   await failed.wait_for_function("document.querySelector('#boot').textContent.includes('불러오지 못했습니다')")
   assert await failed.locator('#advance').is_disabled()
   await failed.close()
  print('PASS: delayed loading cannot expose old art or accept start; failed art reports retry; idle/walk/jump and R cut-in captured; no JS errors')
  await browser.close()

asyncio.run(main())
