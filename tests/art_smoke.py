"""Render the shipped pixel assets through the actual game renderer."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    assert page.evaluate('Object.values(EdenPresentation.assetStatus).every(Boolean)')
    count=page.evaluate('''() => {
      const c=document.createElement('canvas');c.width=1024;c.height=704;
      const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#090e17';g.fillRect(0,0,c.width,c.height);
      const hashes=new Set();
      for(let row=0;row<4;row++)for(let frame=0;frame<4;frame++){
        const name=['IDLE','RUN','LEG SCYTHE','SHIN RAIL'][row];
        g.save();g.translate(frame*256,row*176);g.beginPath();g.rect(0,0,256,176);g.clip();g.fillStyle='#697b92';g.font='12px monospace';g.fillText(name+' / '+frame,12,18);
        g.strokeStyle='#293647';g.strokeRect(.5,.5,255,175);g.scale(2,2);
        const p={x:45,y:18,h:60,face:1,onGround:true,inv:0,dash:0,attack:0,stun:0,vx:0,vy:0};
        let t=frame/5+.01;
        if(row===1){p.vx=92;t=frame/11+.01;}
        if(row>=2){p.attackDuration=1;p.attack=1-[.08,.35,.65,.9][frame];p.attackKind=2;p.weaponMode=row===2?'heavy':'rail';}
        EdenPresentation.drawZero(g,p,t);g.restore();
        hashes.add(g.getImageData(frame*256+1,row*176+30,254,145).data.join(','));
      }
      document.body.replaceChildren(c);document.body.style.display='block';c.style.width='1024px';c.style.height='704px';c.id='review';
      return hashes.size;
    }''')
    assert count==16
    page.locator('#review').screenshot(path='/tmp/eden-animation-review.png')
    assert not errors,errors
    print('PASS: all generated assets loaded; 16 animation poses rendered without JS errors')
    browser.close()
