"""Normal-input corridor clear plus authored air/landing and sentry frame review."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.sentryTest={get p(){return player},get room(){return room},get state(){return state},setup(){releaseInputs();dialogue=null;bossIndex=0;startExplore();room.section=1;enterSection();}};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('sentryTest.setup()')
 for i in range(2):
  target=page.evaluate('(i)=>sentryTest.room.drones[i].x-32',i)
  page.keyboard.down('d');page.wait_for_function('(x)=>sentryTest.p.x>=x',arg=target);page.keyboard.up('d')
  for _ in range(12):
   page.keyboard.press('j');page.wait_for_timeout(290)
   if page.evaluate('(i)=>sentryTest.room.drones[i].hp<=0',i):break
  assert page.evaluate('(i)=>sentryTest.room.drones[i].hp<=0',i)
 assert page.evaluate('sentryTest.p.hp')>0
 page.screenshot(path='/tmp/eden-sentry-clear.png')
 page.keyboard.press('Space');page.wait_for_function('!sentryTest.p.onGround')
 page.wait_for_function('sentryTest.p.onGround')
 page.keyboard.down('d');page.wait_for_function('sentryTest.room.section===2');page.keyboard.up('d')
 page.keyboard.down('d');page.wait_for_function('sentryTest.p.x>385');page.keyboard.up('d');page.keyboard.press('f')
 page.wait_for_function('sentryTest.state==="intro"');page.keyboard.press('Enter');page.wait_for_function('sentryTest.state==="combat"')
 count=page.evaluate('''()=>{
 const c=document.createElement('canvas');c.id='review';c.width=1000;c.height=400;c.style.cssText='width:1000px;height:400px;aspect-ratio:auto;max-width:none';document.body.prepend(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#17212c';ctx.fillRect(0,0,1000,400);
 for(let i=0;i<4;i++){ctx.save();ctx.translate(125+i*250,130);ctx.scale(3,3);EdenPresentation.drawSentry(ctx,{x:-10,y:-10,hp:i===3?0:38,release:i===2?.1:0,aiming:i===1?.4:0,t:2},-100);ctx.restore();}
 // Dead sprites are grounded at world floor; draw its wreck in a separate local coordinate system.
 ctx.save();ctx.translate(875,130-226*3);ctx.scale(3,3);EdenPresentation.drawSentry(ctx,{x:-10,y:0,hp:0},-100);ctx.restore();
 let hashes=[];for(let i=0;i<4;i++){ctx.save();ctx.translate(125+i*250,370);ctx.scale(2.7,2.7);EdenPresentation.drawZero(ctx,{duelMode:true,hp:100,stun:0,dash:0,attack:0,charging:false,onGround:i>=2,landing:i===2?.08:0,vy:i===0?-130:120,vx:0,face:1,x:-9,y:-48,h:48,inv:0},0);ctx.restore();let h=0;for(const v of ctx.getImageData(i*250,200,250,200).data)h=(31*h+v)|0;hashes.push(h);}return new Set(hashes).size;
 }''')
 assert count==4
 page.locator('#review').screenshot(path='/tmp/eden-air-sentry-review.png')
 assert not errors,errors
 print('PASS: normal keyboard corridor kills, jump/land, corridor→SURGEON; four distinct air/landing/idle poses and sentry sprites, no JS errors')
 b.close()
