"""Actual keyboard hit-confirm compression and production ordnance rendering."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.compressionTest={get p(){return player},get b(){return boss},get hazards(){return hazards},
setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;player.x=boss.x-35;player.face=1;},
show(){player.attack=0;player.charging=false;hazards=[{kind:'pillar',owner:'p',x:280,y:FLOOR,delay:0,life:.35,dmg:30},{kind:'needle',owner:'b',x:210,y:140,vx:-100,vy:20,life:2},{kind:'syringe',owner:'b',x:160,y:150,vy:100,life:2},{kind:'rail',owner:'p',x:100,y:180,vx:100,life:2}];}
};})();''').replace('update(dt);render();','if(!window.freezeReview)update(dt);render();')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
    page.evaluate('compressionTest.setup()');page.keyboard.press('j')
    page.wait_for_function('compressionTest.p.linkWindow>0')
    page.keyboard.down('k');page.wait_for_function('compressionTest.p.charging')
    assert page.evaluate('compressionTest.p.parryWindow')==0
    page.wait_for_function('compressionTest.p.chargeLevel===2',timeout=1200)
    page.keyboard.up('k');page.wait_for_function('compressionTest.p.weaponMode==="heavy"')
    page.wait_for_function('compressionTest.b.hp<compressionTest.b.maxHp-40')
    page.evaluate('window.freezeReview=true;compressionTest.show()')
    page.wait_for_timeout(60);page.screenshot(path='/tmp/eden-compression-ordnance.png')
    count=page.evaluate('''()=>{
      const c=document.createElement('canvas');c.width=640;c.height=200;c.id='ordnance';c.style.cssText='width:960px;height:300px;max-width:none;aspect-ratio:auto';document.body.prepend(c);
      const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#17212c';ctx.fillRect(0,0,640,200);
      const kinds=['syringe','needle','pillar','rail'];let count=0;
      kinds.forEach((kind,i)=>{ctx.save();ctx.translate(i*160+80,kind==='pillar'?175:100);ctx.scale(2.4,2.4);if(EdenPresentation.drawOrdnance(ctx,{kind,x:0,y:0,vx:1,vy:0,life:.3,delay:0}))count++;ctx.restore();});return count;
    }''')
    assert count==4
    page.locator('#ordnance').screenshot(path='/tmp/eden-ordnance-review.png')
    page.evaluate("""()=>{
      const c=document.querySelector('#ordnance');c.width=1120;c.height=600;c.style.cssText='width:1120px;height:600px;aspect-ratio:auto;max-width:none';const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#17212c';ctx.fillRect(0,0,1120,600);
      const modes=['heavy','pile','crown'],durations=[.46,.7,.72],times=[[.01,.08,.16,.4],[.03,.18,.32,.6],[.01,.13,.24,.6]];
      for(let row=0;row<3;row++)for(let f=0;f<4;f++){ctx.save();ctx.translate(f*280+140,row*200+178);ctx.scale(2.5,2.5);EdenPresentation.drawZero(ctx,{duelMode:true,hp:100,stun:0,dash:0,attack:durations[row]-times[row][f],attackDuration:durations[row],weaponMode:modes[row],charging:false,onGround:true,vy:0,vx:0,face:1,x:-9,y:-48,h:48,inv:0},0);ctx.restore();}
    }""")
    page.locator('#ordnance').screenshot(path='/tmp/eden-mechanisms-review.png')
    assert not errors,errors
    print('PASS: real J→K compression→charged impact, no cancel parry, four production ordnance sprites, no JS errors')
    browser.close()
