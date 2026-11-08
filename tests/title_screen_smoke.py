"""Verify the opening art and real keyboard/pointer navigation in Chromium."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();',"window.titleTest={get state(){return state},get menu(){return menu}};})();")
base=os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/'
saved={'boss':0,'stage':'boss','upgrade':0,'augments':[0,0,0],'archives':0,'records':[],'defeats':0,'complete':False}

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.titleDraws=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src?.includes('eden-title-v30.png'))window.titleDraws++;return draw.call(this,im,...args)}''')
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(base,wait_until='networkidle');page.wait_for_function('titleTest.state==="title" && titleDraws>0')
 assert page.evaluate('EdenPresentation.assetStatus.titleArt')
 assert 'BUILD 30' in page.locator('.masthead').inner_text()
 page.screenshot(path='/tmp/eden30-title-new.png')
 page.locator('#advance').click();page.wait_for_function('titleTest.state==="interlude"')

 # A saved boss checkpoint still resumes via the first canvas menu item.
 page.evaluate('(s)=>localStorage.setItem("eden-save-v1",JSON.stringify(s))',saved)
 page.reload(wait_until='networkidle');page.wait_for_function('titleTest.state==="title" && titleDraws>0')
 page.screenshot(path='/tmp/eden30-title-saved.png')
 canvas=page.locator('#game');box=canvas.bounding_box()
 canvas.click(position={'x':box['width']*335/480,'y':box['height']*174/270})
 page.wait_for_function('titleTest.state==="intro"');page.keyboard.press('Enter');page.wait_for_function('titleTest.state==="combat"')

 # Selecting the second item by pointer and by keyboard starts a fresh game.
 for mode in ['pointer','keyboard']:
  page.evaluate('(s)=>localStorage.setItem("eden-save-v1",JSON.stringify(s))',saved)
  page.reload(wait_until='networkidle');page.wait_for_function('titleTest.state==="title" && titleDraws>0')
  if mode=='pointer':
   box=canvas.bounding_box();canvas.click(position={'x':box['width']*335/480,'y':box['height']*197/270})
  else:
   page.keyboard.press('ArrowDown');page.wait_for_function('titleTest.menu===1');page.keyboard.press('Enter')
  page.wait_for_function('titleTest.state==="interlude"')
  assert page.evaluate('localStorage.getItem("eden-save-v1")') is None

 mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 mobile.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 mobile.goto(base,wait_until='networkidle');mobile.wait_for_function('titleTest.state==="title" && EdenPresentation.assetStatus.titleArt')
 assert mobile.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 mobile.screenshot(path='/tmp/eden30-title-mobile.png')
 mobile_canvas=mobile.locator('#game');box=mobile_canvas.bounding_box()
 mobile_canvas.tap(position={'x':box['width']*335/480,'y':box['height']*174/270});mobile.wait_for_function('titleTest.state==="interlude"')
 mobile.reload(wait_until='networkidle');mobile.wait_for_function('titleTest.state==="title" && EdenPresentation.assetStatus.titleArt')
 mobile.locator('#advance').click();mobile.wait_for_function('titleTest.state==="interlude"')
 assert not errors,errors
 print('PASS: title art renders; new/continue work with pointer, keyboard and mobile; boss checkpoint remains playable; no JS errors')
 browser.close()
