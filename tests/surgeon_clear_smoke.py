"""Render a normal-stat first-boss clear; bot uses normal controls, never edits damage/HP."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
driver='''window.sliceTest={get state(){return state},get hp(){return player.hp},get phase(){return boss?.phase},setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';},tick(){
 if(state!=='combat')return;
 for(let i=0;i<4&&state==='combat';i++){
  const p=player,b=boss,dist=b.x-p.x,dir=Math.sign(dist)||1;keys.clear();
  if(!b.dead){let move=Math.abs(dist)>43?dir:0;
   if(b.windup>0&&b.move%3===1&&Math.abs(p.x+9-b.target.x)<70)move=p.x<350?1:-1;
   if(move)keys.add(move>0?'d':'a');
   if(b.windup>0&&b.move%3===0&&b.windup<.35&&p.onGround)pressed.add(' ');
   const threat=hazards.some(h=>h.owner==='b'&&h.delay<=.05&&Math.hypot(h.x-(p.x+9),h.y-(p.y+24))<48);
   if(threat&&p.dash<=0&&p.driveLock<=0&&p.sp>=12){keys.clear();keys.add(dir>0?'a':'d');pressed.add('shift');}
   if((p.finishWindow>0||p.linkWindow>0)&&p.superMeter>=100)pressed.add('r');
   else if(p.linkWindow>0&&p.cool[0]<=0&&p.sp>=14&&Math.abs(dist)<60)pressed.add('q');
   else if(p.attack<=0&&Math.abs(dist)<65)pressed.add('j');
  }update(1/60);pressed.clear();
 }
}};'''
source=(root/'src/game.js').read_text().replace('})();',driver+'})();').replace('update(dt);render();','if(window.sliceRun)window.sliceTest.tick();else update(dt);render();')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('sliceTest.setup();window.sliceRun=true')
 page.wait_for_function('sliceTest.phase===2 || sliceTest.state!=="combat"',timeout=45000)
 page.screenshot(path='/tmp/eden-surgeon-phase2.png')
 page.wait_for_function('sliceTest.state!=="combat"',timeout=45000)
 assert page.evaluate('sliceTest.state')=='reward'
 assert page.evaluate('sliceTest.hp')>0
 page.screenshot(path='/tmp/eden-surgeon-clear.png')
 assert not errors,errors
 print('PASS: production renderer and normal-stat input bot clear both SURGEON phases to victory, no JS errors; HP:',page.evaluate('sliceTest.hp'))
 browser.close()
