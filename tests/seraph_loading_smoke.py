"""First phase can start while phase-two art loads, with a safe transition gate."""
import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.seraphLoadTest={get p(){return player},get b(){return boss},get state(){return state},first(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;},transform(){boss.hp=900;boss.operationUsed=true;boss.checkPhase()}};})();''')
base=os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4177')+'/'

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('''window.loadTexts=new Set();const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(v,...a){if(typeof v==='string'&&v.includes('SERAPH 이미지'))loadTexts.add(v);return f.call(this,v,...a)}''')
  await page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  gate=asyncio.Event()
  async def hold(route):
   await gate.wait();await route.continue_()
  await page.route('**/seraph-inbetween-v37.png',hold)
  await page.goto(base,wait_until='domcontentloaded');await page.wait_for_function("document.querySelector('#boot').classList.contains('ready')")
  assert await page.evaluate("EdenPresentation.seraphStatus==='loading'")
  await page.evaluate('seraphLoadTest.first()');await page.keyboard.press('j');await page.wait_for_function('seraphLoadTest.p.attackSerial>0');assert await page.evaluate('seraphLoadTest.b.phase')==1
  await page.evaluate('seraphLoadTest.transform()');await page.wait_for_timeout(350)
  assert await page.evaluate('seraphLoadTest.b.tele')==7 and await page.evaluate('seraphLoadTest.b.inv')==7
  assert await page.evaluate("Array.from(loadTexts).some(s=>s.includes('불러오는 중'))")
  gate.set();await page.wait_for_function("EdenPresentation.seraphStatus==='ready'");await page.wait_for_function('seraphLoadTest.b.tele<6.9')
  assert not errors,errors
  failed=await browser.new_page();await failed.add_init_script('''window.loadTexts=new Set();const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(v,...a){if(typeof v==='string'&&v.includes('SERAPH 이미지'))loadTexts.add(v);return f.call(this,v,...a)}''')
  await failed.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'));await failed.route('**/seraph-inbetween-v37.png',lambda r:r.abort())
  await failed.goto(base,wait_until='domcontentloaded');await failed.wait_for_function("document.querySelector('#boot').classList.contains('ready')");await failed.wait_for_function("EdenPresentation.seraphStatus==='failed'")
  await failed.evaluate('seraphLoadTest.first();seraphLoadTest.transform()');await failed.wait_for_timeout(300)
  assert await failed.evaluate('seraphLoadTest.b.tele')==7
  assert await failed.evaluate("Array.from(loadTexts).some(s=>s.includes('로딩 실패'))")
  print('PASS: first-phase controls work during SERAPH downloads; pending and failed art safely pause transformation with a visible message; ready art resumes it')
  await browser.close()

asyncio.run(main())
